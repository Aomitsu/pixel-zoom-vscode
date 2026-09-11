import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const from = resolve(root, 'node_modules/@vscode/codicons/dist');
const to = resolve(root, 'media');

mkdirSync(to, { recursive: true });

for (const file of ['codicon.css', 'codicon.ttf']) {
  copyFileSync(resolve(from, file), resolve(to, file));
}

console.log('Copied codicon.css and codicon.ttf to media/');
