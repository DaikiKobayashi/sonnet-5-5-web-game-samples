// SUNSET RUSH - bootstrap, fixed-step loop, audio/event glue, verification hooks (window.__game).

import { STEP } from './config.js';
import { randomSeed } from './rng.js';
import { Assets } from './assets.js';
import { Sim } from './sim.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import { AudioEngine } from './audio.js';
import { Input, setupTouch } from './input.js';
import { loadSave, writeSave } from './storage.js';

const params = new URLSearchParams(location.search);

function intParam(name) {
  const v = params.get(name);
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function setFavicon(assets) {
  try {
    const link = document.querySelector('link[rel="icon"]');
    const car = assets.get('car_player').px.crop(0, 0, 40, 22);
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#ff8a3c';
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#ffd35a';
    g.fillRect(0, 0, 32, 12);
    g.fillStyle = '#4a2c86';
    g.fillRect(0, 22, 32, 10);
    g.imageSmoothingEnabled = false;
    g.drawImage(car.toCanvas(), 0, 0, 40, 22, 0, 8, 32, 17.6);
    if (link) link.href = c.toDataURL('image/png');
  } catch (e) { /* the data: URL placeholder stays */ }
}

async function boot() {
  if (params.get('gallery') === '1') {
    const g = await import('./gallery.js');
    g.startGallery();
    return;
  }
  startGame();
}

function startGame() {
  const canvas = document.getElementById('game');
  const save = loadSave();
  const persist = { best: save.best, muted: save.muted }; // what is written to localStorage
  const forcedMute = params.get('mute') === '1';
  const muted = forcedMute ? true : save.muted;
  const seedParam = intParam('seed');
  const seed = seedParam !== null ? seedParam >>> 0 : randomSeed();
  const stageParam = intParam('stage');
  const startStage = stageParam !== null && stageParam >= 1 && stageParam <= 3 ? stageParam : 1;
  const debug = params.get('debug') === '1';

  const assets = new Assets();
  setFavicon(assets);
  const audio = new AudioEngine({ muted });
  const sim = new Sim({
    seed,
    startStage,
    best: save.best,
    muted,
    onSave: ({ best }) => {
      persist.best = best;
      writeSave(persist);
    },
  });
  const renderer = new Renderer(canvas, assets);
  const hud = new Hud(renderer.ctx, assets);
  const input = new Input();
  setupTouch(input);

  // ---------------------------------------------------------------- audio glue
  let jingled = false;
  const unlockAudio = () => audio.unlock();

  function handleEvents() {
    const evs = sim.events;
    if (!evs.length) return;
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      switch (e.type) {
        case 'scene': {
          if (e.prev === 'paused' && e.scene !== 'paused') audio.resume();
          switch (e.scene) {
            case 'countdown':
              audio.startBgm('bgm_' + sim.stage);
              audio.startEngine();
              break;
            case 'paused':
              audio.suspend();
              break;
            case 'stageclear':
            case 'timeup':
              audio.stopBgm();
              break;
            case 'title':
            case 'gameover':
            case 'ending':
              audio.stopBgm();
              audio.stopEngine();
              audio.setOffroad(false);
              if (e.scene === 'ending') audio.sfx('jingle');
              break;
            default: break;
          }
          break;
        }
        case 'beep': audio.sfx('beep'); break;
        case 'go': audio.sfx('go'); break;
        case 'crash': audio.sfx('crash'); break;
        case 'checkpoint': audio.sfx('checkpoint'); break;
        case 'goal': audio.sfx('goal'); break;
        case 'timeup': audio.sfx('timeup'); break;
        case 'overtake': audio.sfx('overtake'); break;
        case 'nearmiss': audio.sfx('nearmiss'); break;
        case 'timewarn': audio.sfx('timewarn'); break;
        case 'menu': audio.sfx('menu'); break;
        default: break;
      }
    }
    evs.length = 0;
  }

  function updateContinuousAudio() {
    const s = sim.scene;
    if (s === 'countdown' || s === 'playing' || s === 'stageclear' || s === 'timeup') {
      const sp = sim.speed / 12000;
      audio.setEngine(60 + 140 * sp, sp);
      audio.setOffroad(s === 'playing' && sim.offroad && sim.speed > 800, sp);
    } else if (s !== 'paused') {
      audio.setOffroad(false);
    }
  }

  // ---------------------------------------------------------------- actions
  function toggleMute() {
    sim.muted = !sim.muted;
    audio.setMuted(sim.muted);
    persist.muted = sim.muted;
    writeSave(persist);
  }

  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        const p = document.exitFullscreen();
        if (p && p.catch) p.catch(() => {});
      } else {
        const el = document.documentElement;
        const p = el.requestFullscreen ? el.requestFullscreen() : null;
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) { /* not available */ }
  }

  input.onAnyInput = (e) => {
    unlockAudio();
    if (!jingled && sim.scene === 'title') {
      jingled = true;
      const isStart = e && e.code && (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter');
      if (!isStart && !(e && e.type && e.type.startsWith('pointer'))) audio.sfx('jingle');
    }
  };
  input.onAction = (a) => {
    switch (a) {
      case 'confirm': sim.confirm(); break;
      case 'pause': if (sim.scene === 'playing' || sim.scene === 'paused') sim.togglePause(); break;
      case 'escape': sim.escape(); break;
      case 'restart': sim.restart(); break;
      case 'quit': sim.quit(); break;
      case 'mute': toggleMute(); break;
      case 'fullscreen': toggleFullscreen(); break;
      default: break;
    }
    handleEvents();
  };
  input.attach();

  // taps: unlock audio; touch/pen taps confirm on title / results / game over / ending
  window.addEventListener('pointerdown', (e) => {
    unlockAudio();
    if (e.pointerType === 'mouse') return;
    if (e.target && e.target.closest && e.target.closest('#touch')) return;
    const s = sim.scene;
    if (s === 'title' || s === 'stageclear' || s === 'gameover' || s === 'ending') {
      sim.confirm();
      handleEvents();
    }
  }, { passive: true });

  // S-15: pause automatically when the window loses focus / is hidden during a run
  const autoPause = () => {
    if (sim.scene === 'playing') {
      sim.togglePause();
      handleEvents();
    }
  };
  window.addEventListener('blur', autoPause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

  // ---------------------------------------------------------------- loop
  let last = 0;
  let acc = 0;
  let fps = 60;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    const real = (now - last) / 1000;
    last = now;
    if (real > 0) fps += (Math.min(1 / real, 240) - fps) * 0.08;
    acc += Math.min(real, 0.1);
    sim.input.up = input.up;
    sim.input.down = input.down;
    sim.input.left = input.left;
    sim.input.right = input.right;
    let n = 0;
    while (acc >= STEP - 1e-9 && n < 6) {
      sim.step();
      acc -= STEP;
      n++;
    }
    if (acc >= STEP) acc = 0; // more than 6 steps behind: drop the rest
    handleEvents();
    updateContinuousAudio();
    renderer.drawWorld(sim);
    hud.fps = fps;
    hud.draw(sim, { showFps: debug });
  }
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- verification hooks
  window.__game = {
    getState() {
      const s = sim.getState();
      s.audio.state = audio.state;
      return s;
    },
  };
  if (debug) {
    window.__game.debug = {
      warp: (m) => sim.debugWarp(Number(m)),
      setTime: (s) => sim.debugSetTime(s),
      setPlayerX: (x) => sim.debugSetPlayerX(x),
      setSpeedKmh: (v) => sim.debugSetSpeedKmh(v),
      // extra, only for the author's own tests
      sim,
      audio,
      renderer,
    };
  }
}

boot().catch((err) => { console.error(err); });
