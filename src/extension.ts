import * as vscode from 'vscode';
import {
  NATIVE_IMAGE_VIEW_TYPE,
  PIXEL_ZOOM_VIEW_TYPE,
  PixelZoomEditorProvider,
  SUPPORTED_EXTENSIONS,
  isEnabled,
  isSupportedImage,
} from './pixelZoomEditorProvider';

const ASSOCIATIONS_SETTING = 'editorAssociations';
const SAVED_ASSOCIATIONS_KEY = 'pixelZoom.savedAssociations';

let lastAppliedEnabled: boolean | undefined;

function associationGlobs(): string[] {
  return SUPPORTED_EXTENSIONS.map((extension) => `*${extension}`);
}

function resolveTargetUri(arg?: vscode.Uri): vscode.Uri | undefined {
  if (arg instanceof vscode.Uri) {
    return arg;
  }
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    return editor.document.uri;
  }
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  if (input instanceof vscode.TabInputCustom) {
    return input.uri;
  }
  if (input instanceof vscode.TabInputText) {
    return input.uri;
  }
  return undefined;
}

async function applyAssociations(
  context: vscode.ExtensionContext,
  enabled: boolean
): Promise<void> {
  const config = vscode.workspace.getConfiguration('workbench');
  const current = config.get<Record<string, string>>(ASSOCIATIONS_SETTING) ?? {};
  const globs = associationGlobs();

  if (enabled) {
    const saved = context.globalState.get<Record<string, string | null>>(SAVED_ASSOCIATIONS_KEY);
    if (!saved) {
      return;
    }
    const next = { ...current };
    for (const glob of globs) {
      const original = saved[glob];
      if (original) {
        next[glob] = original;
      } else {
        delete next[glob];
      }
    }
    await context.globalState.update(SAVED_ASSOCIATIONS_KEY, undefined);
    await config.update(ASSOCIATIONS_SETTING, next, vscode.ConfigurationTarget.Global);
    return;
  }

  if (!context.globalState.get(SAVED_ASSOCIATIONS_KEY)) {
    const saved: Record<string, string | null> = {};
    for (const glob of globs) {
      saved[glob] = current[glob] ?? null;
    }
    await context.globalState.update(SAVED_ASSOCIATIONS_KEY, saved);
  }

  const next = { ...current };
  for (const glob of globs) {
    next[glob] = NATIVE_IMAGE_VIEW_TYPE;
  }
  await config.update(ASSOCIATIONS_SETTING, next, vscode.ConfigurationTarget.Global);
}

async function reopenTab(
  tab: vscode.Tab,
  uri: vscode.Uri,
  viewType: string,
  column: vscode.ViewColumn
): Promise<void> {
  await vscode.commands.executeCommand('vscode.openWith', uri, viewType, column);
  await vscode.window.tabGroups.close(tab, true);
}

async function switchTabs(targetViewType: string): Promise<void> {
  const sourceViewType =
    targetViewType === PIXEL_ZOOM_VIEW_TYPE ? NATIVE_IMAGE_VIEW_TYPE : PIXEL_ZOOM_VIEW_TYPE;
  const jobs: Thenable<unknown>[] = [];

  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input;
      if (!(input instanceof vscode.TabInputCustom)) {
        continue;
      }
      if (input.viewType !== sourceViewType || !isSupportedImage(input.uri)) {
        continue;
      }
      jobs.push(reopenTab(tab, input.uri, targetViewType, group.viewColumn));
    }
  }

  await Promise.all(jobs);
}

function updateStatusBar(item: vscode.StatusBarItem, enabled: boolean): void {
  if (enabled) {
    item.text = '$(zoom-in) Pixel Zoom';
    item.tooltip = vscode.l10n.t('Pixel Zoom: auto-zoom enabled. Click to disable.');
  } else {
    item.text = '$(circle-slash) Pixel Zoom';
    item.tooltip = vscode.l10n.t('Pixel Zoom: disabled. Click to enable.');
  }
}

async function applyEnabled(
  context: vscode.ExtensionContext,
  provider: PixelZoomEditorProvider,
  statusItem: vscode.StatusBarItem,
  enabled: boolean
): Promise<void> {
  if (lastAppliedEnabled !== enabled) {
    lastAppliedEnabled = enabled;
    try {
      await applyAssociations(context, enabled);
      await switchTabs(enabled ? PIXEL_ZOOM_VIEW_TYPE : NATIVE_IMAGE_VIEW_TYPE);
    } catch (error) {
      console.error('Pixel Zoom: failed to apply state', error);
    }
  }
  updateStatusBar(statusItem, enabled);
  provider.broadcastConfig();
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const provider = new PixelZoomEditorProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(PIXEL_ZOOM_VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: true,
    })
  );

  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusItem.command = 'pixelZoom.toggle';
  statusItem.show();
  context.subscriptions.push(statusItem);

  context.subscriptions.push(
    vscode.commands.registerCommand('pixelZoom.open', async (arg?: vscode.Uri) => {
      const uri = resolveTargetUri(arg);
      if (!uri) {
        void vscode.window.showWarningMessage(vscode.l10n.t('Pixel Zoom: no image selected.'));
        return;
      }
      if (!isSupportedImage(uri)) {
        void vscode.window.showWarningMessage(
          vscode.l10n.t('Pixel Zoom: unsupported format ({0}).', uri.path)
        );
        return;
      }
      await vscode.commands.executeCommand(
        'vscode.openWith',
        uri,
        PIXEL_ZOOM_VIEW_TYPE,
        vscode.ViewColumn.Active
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('pixelZoom.toggle', async () => {
      const next = !isEnabled();
      await vscode.workspace
        .getConfiguration('pixelZoom')
        .update('enabled', next, vscode.ConfigurationTarget.Global);
      await applyEnabled(context, provider, statusItem, next);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('pixelZoom.enabled')) {
        await applyEnabled(context, provider, statusItem, isEnabled());
        return;
      }
      if (
        event.affectsConfiguration('pixelZoom.maxPixelArtSize') ||
        event.affectsConfiguration('pixelZoom.defaultSmoothing') ||
        event.affectsConfiguration('pixelZoom.checkerboard')
      ) {
        provider.broadcastConfig();
      }
    })
  );

  await applyEnabled(context, provider, statusItem, isEnabled());
}

export function deactivate(): void {
  // rien à nettoyer
}
