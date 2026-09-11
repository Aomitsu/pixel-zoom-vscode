import * as vscode from 'vscode';
import * as path from 'path';

export const PIXEL_ZOOM_VIEW_TYPE = 'pixelZoom.preview';
export const NATIVE_IMAGE_VIEW_TYPE = 'imagePreview.previewEditor';

export const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.bmp', '.ico', '.gif'];

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
};

export interface WebviewSettings {
  maxPixelArtSize: number;
  defaultSmoothing: boolean;
  checkerboard: boolean;
}

interface WebviewMessages {
  smoothed: string;
  pixelated: string;
}

interface PixelZoomDocument extends vscode.CustomDocument {
  readonly uri: vscode.Uri;
}

export function isSupportedImage(uri: vscode.Uri): boolean {
  return SUPPORTED_EXTENSIONS.includes(path.extname(uri.path).toLowerCase());
}

export function isEnabled(): boolean {
  return vscode.workspace.getConfiguration('pixelZoom').get<boolean>('enabled', true);
}

function getSettings(): WebviewSettings {
  const config = vscode.workspace.getConfiguration('pixelZoom');
  return {
    maxPixelArtSize: config.get<number>('maxPixelArtSize', 128),
    defaultSmoothing: config.get<boolean>('defaultSmoothing', false),
    checkerboard: config.get<boolean>('checkerboard', true),
  };
}

function getMessages(): WebviewMessages {
  return {
    smoothed: vscode.l10n.t('smoothed'),
    pixelated: vscode.l10n.t('pixelated'),
  };
}

async function readImageDataUri(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  const mime = MIME_BY_EXTENSION[path.extname(uri.path).toLowerCase()] ?? 'application/octet-stream';
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
}

export class PixelZoomEditorProvider implements vscode.CustomReadonlyEditorProvider<PixelZoomDocument> {
  private readonly panels = new Set<vscode.WebviewPanel>();

  constructor(private readonly extensionUri: vscode.Uri) {}

  public openCustomDocument(uri: vscode.Uri): PixelZoomDocument {
    return { uri, dispose: () => undefined };
  }

  public async resolveCustomEditor(
    document: PixelZoomDocument,
    panel: vscode.WebviewPanel
  ): Promise<void> {
    this.panels.add(panel);
    panel.onDidDispose(() => this.panels.delete(panel));

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    panel.webview.onDidReceiveMessage((message: { type?: string }) => {
      if (message?.type === 'ready') {
        void this.postConfig(panel);
      }
    });

    await this.render(panel, document.uri);
  }

  public broadcastConfig(): void {
    for (const panel of this.panels) {
      void this.postConfig(panel);
    }
  }

  private async render(panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
    const fileName = path.basename(uri.fsPath);
    panel.title = vscode.l10n.t('Pixel Zoom — {0}', fileName);

    try {
      const dataUri = await readImageDataUri(uri);
      panel.webview.html = this.getHtml(panel.webview, dataUri, fileName);
    } catch (error) {
      panel.webview.html = this.getErrorHtml(String(error));
    }
  }

  private async postConfig(panel: vscode.WebviewPanel): Promise<void> {
    await panel.webview.postMessage({
      type: 'config',
      config: { ...getSettings(), messages: getMessages(), enabled: isEnabled() },
    });
  }

  private getErrorHtml(message: string): string {
    const nonce = getNonce();
    const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'`;
    return `<!DOCTYPE html>
<html lang="${vscode.env.language}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>body{font-family:var(--vscode-font-family);padding:1rem;color:var(--vscode-foreground);}</style>
</head>
<body>
<h3>${escapeHtml(vscode.l10n.t('Unable to read image'))}</h3>
<pre>${escapeHtml(message)}</pre>
</body>
</html>`;
  }

  private getHtml(webview: vscode.Webview, dataUri: string, fileName: string): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'main.css')
    );
    const codiconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'codicon.css')
    );
    const nonce = getNonce();
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} data:`,
      `font-src ${webview.cspSource}`,
      `style-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
    ].join('; ');

    const settings = getSettings();
    const bodyClasses = [
      settings.checkerboard ? 'checker' : '',
      settings.defaultSmoothing ? 'smooth' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const initialState = JSON.stringify({
      fileName,
      maxPixelArtSize: settings.maxPixelArtSize,
      defaultSmoothing: settings.defaultSmoothing,
      checkerboard: settings.checkerboard,
      enabled: isEnabled(),
      messages: getMessages(),
    });

    return `<!DOCTYPE html>
<html lang="${vscode.env.language}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="${styleUri}" rel="stylesheet">
<link href="${codiconUri}" rel="stylesheet" id="vscode-codicon-stylesheet">
<title>Pixel Zoom</title>
</head>
<body class="${bodyClasses}">
  <div id="toolbar-bar">
    <vscode-toolbar-container id="toolbar">
      <vscode-toolbar-button data-action="zoom-out" icon="zoom-out" title="${escapeHtml(vscode.l10n.t('Zoom out (-)'))}" label="${escapeHtml(vscode.l10n.t('Zoom out (-)'))}"></vscode-toolbar-button>
      <vscode-toolbar-button data-action="zoom-in" icon="zoom-in" title="${escapeHtml(vscode.l10n.t('Zoom in (+)'))}" label="${escapeHtml(vscode.l10n.t('Zoom in (+)'))}"></vscode-toolbar-button>
      <vscode-toolbar-button data-action="fit" icon="screen-full" title="${escapeHtml(vscode.l10n.t('Fit to window (0)'))}" label="${escapeHtml(vscode.l10n.t('Fit to window (0)'))}"></vscode-toolbar-button>
      <vscode-toolbar-button data-action="actual" icon="screen-normal" title="${escapeHtml(vscode.l10n.t('Actual size (1)'))}" label="${escapeHtml(vscode.l10n.t('Actual size (1)'))}"></vscode-toolbar-button>
      <vscode-toolbar-button data-action="smooth" icon="paintcan" title="${escapeHtml(vscode.l10n.t('Toggle smoothing / pixelated'))}" label="${escapeHtml(vscode.l10n.t('Toggle smoothing / pixelated'))}" toggleable></vscode-toolbar-button>
    </vscode-toolbar-container>
    <span id="info"></span>
  </div>
  <div id="stage"><img id="image" src="${dataUri}" alt="${escapeHtml(fileName)}"></div>
  <script nonce="${nonce}">window.__PIXEL_ZOOM__ = ${initialState};</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}
