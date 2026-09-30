// Entry point: boots either the game or the asset gallery.

import { buildAssets } from './assets.js';
import { Font } from './font.js';
import { GameAudio } from './audio.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { Renderer } from './render.js';

const params = new URLSearchParams(location.search);

if (params.get('gallery') === '1') {
  import('./gallery.js').then((m) => m.showGallery());
} else {
  boot();
}

function boot() {
  const assets = buildAssets();
  const font = new Font(assets.font_pixel.canvas);
  const audio = new GameAudio();
  const input = new Input();

  let seed = parseInt(params.get('seed'), 10);
  if (!Number.isFinite(seed)) seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  seed = seed >>> 0;
  let startStage = parseInt(params.get('stage'), 10);
  if (!(startStage >= 1 && startStage <= 3)) startStage = 1;
  const debug = params.get('debug') === '1';
  const muteParam = params.get('mute') === '1';

  const game = new Game({ assets, audio, input, seed, startStage, debug, muteParam });
  const canvas = document.getElementById('game');
  const renderer = new Renderer(canvas, assets, font);

  // AudioContext on first user gesture
  const unlock = () => { audio.init(); audio.resume(); };
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);

  input.setupTouch(document.getElementById('touch'), () => { unlock(); game.tap(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.onHidden(); });
  window.addEventListener('blur', () => game.onHidden());

  window.__game = { getState: () => game.getState() };
  if (debug) window.__game.debug = game.debugApi();

  let last = performance.now();
  function frame(now) {
    const dt = Math.max(0, (now - last) / 1000);
    last = now;
    game.tick(dt);
    renderer.render(game);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
