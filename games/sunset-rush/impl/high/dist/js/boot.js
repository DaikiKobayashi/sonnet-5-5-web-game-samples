import * as C from './const.js';
import { W, H } from './const.js';
import { initAssets } from './assets.js';
import { AudioSys } from './audio.js';
import { Game } from './game.js';
import { Renderer } from './render.js';

function makeStore(muteParam) {
  const s = { best: 0, muted: false };
  try {
    const raw = localStorage.getItem(C.STORAGE_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && typeof o.best === 'number' && isFinite(o.best)) s.best = o.best;
      if (o && typeof o.muted === 'boolean') s.muted = o.muted;
    }
  } catch (e) { /* 保存不可でも動く */ }
  s.save = (patch) => {
    if (patch.best !== undefined) s.best = patch.best;
    if (patch.muted !== undefined && !muteParam) s.muted = patch.muted;
    if (patch.muted !== undefined && muteParam) return; // mute=1 は保存しない
    try { localStorage.setItem(C.STORAGE_KEY, JSON.stringify({ best: s.best, muted: s.muted })); } catch (e) { /* noop */ }
  };
  return s;
}

const DRIVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);
const ACTION_KEYS = new Set(['Enter', 'Space', 'KeyP', 'Escape', 'KeyR', 'KeyQ', 'KeyM', 'KeyF']);

export function boot(params) {
  initAssets();
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  const muteParam = params.get('mute') === '1';
  const store = makeStore(muteParam);
  const audio = new AudioSys();
  let seed = parseInt(params.get('seed'), 10);
  if (!Number.isFinite(seed)) seed = ((Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0);
  let startStage = parseInt(params.get('stage'), 10);
  if (!(startStage >= 1 && startStage <= 3)) startStage = 1;
  const debug = params.get('debug') === '1';
  const game = new Game({ seed, startStage, debug, audio, store, muteParam });
  const renderer = new Renderer(ctx);

  // ---- 入力 ----
  const keys = new Set();
  const touch = { left: false, right: false, gas: false, brake: false };
  const getInput = () => {
    const l = keys.has('ArrowLeft') || keys.has('KeyA') || touch.left;
    const r = keys.has('ArrowRight') || keys.has('KeyD') || touch.right;
    return {
      steer: (r ? 1 : 0) + (l ? -1 : 0),
      gas: keys.has('ArrowUp') || keys.has('KeyW') || touch.gas,
      brake: keys.has('ArrowDown') || keys.has('KeyS') || touch.brake,
    };
  };
  let firstGesture = true;
  const gesture = () => {
    const had = !!audio.ctx;
    audio.ensure();
    if (firstGesture && !had && audio.ctx) {
      firstGesture = false;
      if (game.scene === 'title') audio.sfx('jingle_title');
    }
  };
  window.addEventListener('keydown', (e) => {
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    gesture();
    if (DRIVE_KEYS.has(e.code)) keys.add(e.code);
    if (ACTION_KEYS.has(e.code) && !e.repeat) {
      if (e.code === 'KeyF') {
        try {
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen();
        } catch (err) { /* noop */ }
      } else game.onAction(e.code);
    }
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.code); });
  const clearKeys = () => { keys.clear(); touch.left = touch.right = touch.gas = touch.brake = false; document.querySelectorAll('.tb.down').forEach((b) => b.classList.remove('down')); };
  window.addEventListener('blur', clearKeys);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearKeys(); game.pauseIfPlaying(); }
  });

  // ---- タッチ ----
  const touchEl = document.getElementById('touch');
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (coarse) {
    touchEl.classList.add('on');
    touchEl.querySelectorAll('.tb').forEach((b) => {
      const k = b.dataset.k;
      const down = (e) => {
        e.preventDefault(); e.stopPropagation();
        gesture();
        try { b.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
        b.classList.add('down');
        if (k === 'pause') game.onAction('KeyP'); else touch[k] = true;
      };
      const up = (e) => { e.preventDefault(); b.classList.remove('down'); if (k !== 'pause') touch[k] = false; };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
    });
  }
  document.getElementById('stage').addEventListener('pointerdown', (e) => {
    gesture();
    if (e.target.closest && e.target.closest('.tb')) return;
    if (['title', 'stageclear', 'gameover', 'ending'].includes(game.scene)) game.onAction('Enter');
  });

  window.__game = { getState: () => game.getState() };
  if (debug) window.__game.debug = game.debugApi();

  // ---- ループ ----
  let last = performance.now(), acc = 0;
  let fpsAcc = 0, fpsN = 0, fps = 0;
  function frame(now) {
    let dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    acc += dt;
    fpsAcc += dt; fpsN++;
    if (fpsAcc >= 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    let n = 0;
    const inp = getInput();
    while (acc >= C.STEP && n < 6) {
      game.step(inp);
      acc -= C.STEP;
      n++;
    }
    if (n >= 6) acc = 0;
    // 音
    if (audio.ctx) {
      const sc = game.scene;
      const eng = sc === 'countdown' || sc === 'playing' || sc === 'stageclear' || sc === 'timeup';
      audio.setEngine(game.speed / C.MAX_SPEED, eng);
      audio.setOffroad(sc === 'playing' && Math.abs(game.playerX) > 1 && game.speed > 500, game.speed / C.MAX_SPEED);
    }
    renderer.render(game, debug ? fps : 0);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  void W; void H;
}
