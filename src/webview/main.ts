import { computeFitScale } from '../scale';

interface PixelZoomMessages {
  smoothed: string;
  pixelated: string;
}

interface PixelZoomConfig {
  fileName: string;
  maxPixelArtSize: number;
  defaultSmoothing: boolean;
  checkerboard: boolean;
  enabled: boolean;
  messages: PixelZoomMessages;
}

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

declare global {
  interface Window {
    __PIXEL_ZOOM__: PixelZoomConfig;
  }
}

const vscode = acquireVsCodeApi();
let config: PixelZoomConfig = window.__PIXEL_ZOOM__;

const stage = document.getElementById('stage') as HTMLDivElement;
const img = document.getElementById('image') as HTMLImageElement;
const info = document.getElementById('info') as HTMLSpanElement;

let naturalWidth = 0;
let naturalHeight = 0;
let scale = 1;
let isPixelArt = false;
let fitMode = true;
let smoothing = config.defaultSmoothing;
let offsetX = 0;
let offsetY = 0;

function viewportSize(): { width: number; height: number } {
  const rect = stage.getBoundingClientRect();
  return { width: Math.max(1, rect.width - 24), height: Math.max(1, rect.height - 24) };
}

function render(): void {
  if (!naturalWidth || !naturalHeight) {
    return;
  }
  img.style.width = `${naturalWidth * scale}px`;
  img.style.height = `${naturalHeight * scale}px`;
  img.style.imageRendering = smoothing ? 'auto' : 'pixelated';
  img.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  updateInfo();
}

function updateInfo(): void {
  const zoom = isPixelArt ? `${Math.round(scale)}x` : `${Math.round(scale * 100)}%`;
  const mode = smoothing ? config.messages.smoothed : config.messages.pixelated;
  info.textContent = `${naturalWidth}x${naturalHeight} - zoom ${zoom} - ${mode}`;
  document.body.classList.toggle('checker', config.checkerboard);
}

function applyFit(): void {
  const { width, height } = viewportSize();
  const result = computeFitScale(
    naturalWidth,
    naturalHeight,
    width,
    height,
    config.maxPixelArtSize
  );
  scale = result.scale;
  isPixelArt = result.isPixelArt;
  fitMode = true;
  offsetX = 0;
  offsetY = 0;
  render();
}

function zoomBy(direction: 1 | -1, anchor?: { x: number; y: number }): void {
  if (!naturalWidth || !naturalHeight) {
    return;
  }
  fitMode = false;
  const previous = scale;

  if (isPixelArt) {
    scale = direction > 0 ? Math.floor(scale) + 1 : Math.max(1, Math.ceil(scale) - 1);
  } else {
    scale = direction > 0 ? scale * 1.25 : scale / 1.25;
    scale = Math.max(0.05, scale);
  }

  if (scale === previous) {
    return;
  }

  if (anchor) {
    const centerX = stage.clientWidth / 2;
    const centerY = stage.clientHeight / 2;
    offsetX = anchor.x - centerX - ((anchor.x - centerX - offsetX) * scale) / previous;
    offsetY = anchor.y - centerY - ((anchor.y - centerY - offsetY) * scale) / previous;
  }

  render();
}

function actualSize(): void {
  fitMode = false;
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  render();
}

function onImageReady(): void {
  naturalWidth = img.naturalWidth;
  naturalHeight = img.naturalHeight;
  if (config.enabled) {
    applyFit();
  } else {
    actualSize();
  }
}

img.addEventListener('load', onImageReady);
if (img.complete && img.naturalWidth) {
  onImageReady();
}

document.getElementById('toolbar')?.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  switch (target.dataset.action) {
    case 'zoom-in':
      zoomBy(1);
      break;
    case 'zoom-out':
      zoomBy(-1);
      break;
    case 'fit':
      applyFit();
      break;
    case 'actual':
      actualSize();
      break;
    case 'smooth':
      smoothing = !smoothing;
      render();
      break;
  }
});

stage.addEventListener(
  'wheel',
  (event) => {
    if (!naturalWidth) {
      return;
    }
    event.preventDefault();
    const rect = stage.getBoundingClientRect();
    zoomBy(event.deltaY < 0 ? 1 : -1, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  },
  { passive: false }
);

let dragging = false;
let dragStart = { x: 0, y: 0 };
let dragOffset = { x: 0, y: 0 };

stage.addEventListener('mousedown', (event) => {
  if (event.button !== 0) {
    return;
  }
  dragging = true;
  fitMode = false;
  dragStart = { x: event.clientX, y: event.clientY };
  dragOffset = { x: offsetX, y: offsetY };
  stage.classList.add('dragging');
});

window.addEventListener('mousemove', (event) => {
  if (!dragging) {
    return;
  }
  offsetX = dragOffset.x + (event.clientX - dragStart.x);
  offsetY = dragOffset.y + (event.clientY - dragStart.y);
  render();
});

window.addEventListener('mouseup', () => {
  dragging = false;
  stage.classList.remove('dragging');
});

window.addEventListener('keydown', (event) => {
  if (event.key === '+' || event.key === '=') {
    zoomBy(1);
  } else if (event.key === '-') {
    zoomBy(-1);
  } else if (event.key === '0') {
    applyFit();
  } else if (event.key === '1') {
    actualSize();
  }
});

const observer = new ResizeObserver(() => {
  if (fitMode) {
    applyFit();
  }
});
observer.observe(stage);

window.addEventListener('message', (event) => {
  const message = event.data as { type?: string; config?: Partial<PixelZoomConfig> };
  if (message?.type === 'config' && message.config) {
    const previousMax = config.maxPixelArtSize;
    const previousEnabled = config.enabled;
    config = { ...config, ...message.config };
    if (config.enabled !== previousEnabled) {
      if (config.enabled) {
        applyFit();
      } else {
        actualSize();
      }
    } else if (config.maxPixelArtSize !== previousMax && fitMode) {
      applyFit();
    } else {
      updateInfo();
    }
  }
});

vscode.postMessage({ type: 'ready' });
