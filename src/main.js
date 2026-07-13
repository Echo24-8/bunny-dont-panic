import { AUDIO_MANIFEST, loadImageAssets } from './assets/manifest.js';
import { createGame } from './game/create-game.js';
import { createBrowserPlatform } from './platform/browser.js';
import { drawBootScreen } from './render/renderer.js';

const canvas = document.querySelector('#game');
const statusElement = document.querySelector('#game-status');
const platform = createBrowserPlatform({ canvas, statusElement, audioManifest: AUDIO_MANIFEST });
let game = null;
let booting = false;
let retryHandler = null;

async function boot() {
  if (booting) return;
  booting = true;
  if (retryHandler) {
    canvas.removeEventListener('pointerup', retryHandler);
    retryHandler = null;
  }
  drawBootScreen(canvas, platform.viewport.devicePixelRatio(), 'loading');
  platform.a11y.announce('正在加载游戏素材。');
  try {
    const assets = await loadImageAssets();
    platform.input.clear();
    game = createGame({ canvas, platform, assets });
    window.__BUNNY_GAME__ = game;
  } catch (error) {
    drawBootScreen(canvas, platform.viewport.devicePixelRatio(), 'error', error.message);
    platform.a11y.announce('素材加载失败，选择重新加载。');
    retryHandler = (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 360;
      const y = ((event.clientY - rect.top) / rect.height) * 640;
      if (x >= 72 && x <= 288 && y >= 322 && y <= 378) boot();
    };
    canvas.addEventListener('pointerup', retryHandler);
  } finally {
    booting = false;
  }
}

window.addEventListener('beforeunload', () => game?.destroy(), { once: true });
boot();

