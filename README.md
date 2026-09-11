# Pixel Zoom

**Crisp, auto-zoomed previews for your pixel art — right inside VS Code.**

Small sprites are painful to inspect at 1:1. Pixel Zoom automatically opens your
images in a dedicated viewer and scales small assets up by a **whole-number
factor** with nearest-neighbor rendering, so every pixel stays sharp and readable.
Prefer the stock preview? Flip it off from the status bar.

## Features

- **Automatic** — supported images open straight in Pixel Zoom, no command needed.
- **Pixel-perfect** — integer scaling + `pixelated` rendering, never blurry.
- **Toggle in the status bar** — one click switches everything back to VS Code's
  built-in image preview (and converts already-open tabs).
- **Transparency-aware** — optional checkerboard background reveals alpha.
- **Fully interactive** — wheel zoom, drag to pan, and quick controls.
- **Non-destructive** — read-only viewer, never touches your files.

## Usage

Just open a supported image. To switch the whole feature on or off, click the
**Pixel Zoom** item in the status bar (bottom right):

- `$(zoom-in) Pixel Zoom` — enabled (auto-zoom active)
- `$(circle-slash) Pixel Zoom` — disabled (native preview)

The same toggle is available as **Pixel Zoom: Toggle Auto Zoom** in the Command
Palette, and you can reopen a specific file with **Pixel Zoom: Open Preview**
(Command Palette or right-click a file in the Explorer).

| Action | Control |
| --- | --- |
| Zoom in / out | `+` / `-`, mouse wheel, toolbar buttons |
| Fit to window | `0` or **Fit** |
| Actual size (1:1) | `1` or **1:1** |
| Pan | Click and drag |
| Toggle smoothing | **Smooth** button |

## Auto-zoom rule

If the image's longest side is `<= pixelZoom.maxPixelArtSize` (128 by default),
it is treated as pixel art and scaled up by an **integer** factor to fit the
window. Larger images are shown at 100% (or scaled down to fit) with normal
rendering.

## Supported formats

PNG · JPG/JPEG · BMP · ICO · GIF

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `pixelZoom.enabled` | `true` | Open supported images in Pixel Zoom. Disable to use the built-in preview. |
| `pixelZoom.maxPixelArtSize` | `128` | Longest-side threshold (px) below which an image is treated as pixel art. |
| `pixelZoom.defaultSmoothing` | `false` | Enable smoothing by default (`false` = sharp, pixelated). |
| `pixelZoom.checkerboard` | `true` | Show a checkerboard behind images to reveal transparency. |

## Languages

The UI follows VS Code's display language automatically (English by default,
French included). To add a language, drop in `package.nls.<locale>.json` and
`l10n/bundle.l10n.<locale>.json`, mirroring the existing `fr` files.

## Development

```bash
npm install
npm run compile     # extension (tsc) + webview (esbuild)
npm run typecheck   # type-check extension and webview
npm test            # unit tests for the zoom calculation
```

Press `F5` in VS Code to launch the Extension Development Host.

## Packaging

```bash
npm run package     # produces pixel-zoom-0.0.1.vsix
code-oss --install-extension pixel-zoom-0.0.1.vsix
```

## Release & CI/CD

- **CI** (`.github/workflows/ci.yml`): type-check, tests and packaging on every
  push and pull request.
- **Release** (`.github/workflows/release.yml`): push a tag `vX.X.X` and it will
  build, publish and create a GitHub Release with the `.vsix` attached.

```bash
git tag v0.0.2
git push origin v0.0.2
```

### Publishing authentication

The Visual Studio Marketplace is published through **Microsoft Entra ID** using
GitHub OIDC (no long-lived Personal Access Token). The job runs in the `release`
environment and logs in with a user-assigned managed identity. Open VSX still
uses a token.

Repository/environment secrets:

| Secret | Required | Purpose |
| --- | --- | --- |
| `AZURE_CLIENT_ID` | yes | Client ID of the user-assigned managed identity. |
| `AZURE_TENANT_ID` | yes | Microsoft Entra ID tenant ID. |
| `OVSX_PAT` | no | Open VSX token (for VSCodium). The step is skipped when absent. |

One-time Azure setup:

1. Create a **user-assigned managed identity**.
2. Add a **federated identity credential** (scenario **Other issuer**):
   - Issuer: `https://token.actions.githubusercontent.com`
   - Subject: `repo:Aomitsu/pixel-zoom-vscode:environment:release`
   - Audience: `api://AzureADTokenExchange`
3. Retrieve the identity's **Azure DevOps identity id** (a GUID) and add it as a
   **Contributor** member of the `max-aucube` publisher on the Marketplace. The
   Marketplace `Members` field expects this id, *not* the Azure resource id:

   ```bash
   az login --service-principal -u "$AZURE_CLIENT_ID" \
     --tenant "$AZURE_TENANT_ID" --federated-token "$(cat "$AZURE_FEDERATED_TOKEN_FILE")"
   az rest -u https://app.vssps.visualstudio.com/_apis/profile/profiles/me \
     --resource 499b84ac-1321-427f-aa17-267ca6975798 --query id -o tsv
   ```

### Open VSX (optional)

Open VSX (used by VSCodium) uses a token instead of Entra ID and needs a one-time
namespace. If `OVSX_PAT` is absent, the Open VSX steps are skipped and never block
the release.

1. Create an [Eclipse account](https://accounts.eclipse.org/user/register) (same
   GitHub username) and sign in to [open-vsx.org](https://open-vsx.org) with GitHub.
2. Sign the **Publisher Agreement** (avatar → *Settings* → *Profile*).
3. Generate an **Access Token** (*Settings* → *Access Tokens*) → store it as
   `OVSX_PAT`.
4. Create the namespace once (the workflow also retries it, non-blocking):

   ```bash
   npx ovsx create-namespace max-aucube -p "$OVSX_PAT"
   ```

> Publisher ID is `max-aucube` (VS Code IDs cannot contain `_`); the author handle
> is **Max_auCube**.


## Author

**Max_auCube** — [github.com/Aomitsu](https://github.com/Aomitsu)

## License

MIT
