// Asset gallery (index.html?gallery=1): every image asset on its own <canvas> (all frames left to right,
// integer zoom) and one button per sound asset. Plain DOM page, scrollable.

import { Assets } from './assets.js';
import { AudioEngine } from './audio.js';
import { loadSave, writeSave } from './storage.js';

const SOUND_IDS = [
  'bgm_1', 'bgm_2', 'bgm_3', 'sfx_engine', 'sfx_beep', 'sfx_go', 'sfx_checkpoint', 'sfx_crash', 'sfx_goal',
  'sfx_timeup', 'sfx_menu', 'sfx_overtake', 'sfx_offroad', 'sfx_timewarn', 'jingle_title',
];

const NOTES = {
  car_player: 'player car: straight / left / right',
  car_player_brake: 'brake lamps lit (same order)',
  car_player_wheel: 'tyre + exhaust animation: 2 phases x (straight / left / right)',
  fx_smoke: '4 frames, crash smoke',
  fx_dust: '3 frames, off-road dust',
  fx_spark: '3 frames, crash sparks',
  font_pixel: '5x7 bitmap font: 0-9, A-Z, symbols, space',
};

export function startGallery() {
  document.documentElement.classList.add('gallery-mode');
  const stage = document.getElementById('stage');
  if (stage) stage.hidden = true;
  const touch = document.getElementById('touch');
  if (touch) touch.hidden = true;

  const assets = new Assets();
  const save = loadSave();
  const audio = new AudioEngine({ muted: params().get('mute') === '1' ? true : save.muted });
  window.__gallery = {
    assets: assets.list.map((s) => s.id),
    measureBgm: (id, seconds) => AudioEngine.measureBgm(id, seconds),
  };

  const main = document.createElement('main');
  main.id = 'gallery';
  document.body.appendChild(main);
  main.innerHTML = `
    <h1>SUNSET RUSH - ASSET GALLERY</h1>
    <p class="lead">All images are generated from code at start-up (no image files). Each canvas shows every frame of the asset from left to right, magnified with nearest-neighbour scaling.</p>
    <h2>Sounds</h2>
    <div id="sounds"></div>
    <h2>Images</h2>
    <div id="images"></div>`;

  // ---- sounds
  const sounds = main.querySelector('#sounds');
  let muted = audio.muted;
  const mk = (id, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.soundId = id;
    b.textContent = label || id;
    sounds.appendChild(b);
    return b;
  };
  for (const id of SOUND_IDS) {
    const b = mk(id);
    b.addEventListener('click', () => {
      audio.unlock();
      if ((id.startsWith('bgm_') && audio.bgm === id && audio.inst) || (id === 'sfx_engine' && audio.engine)) {
        audio.stopBgm();
        audio.stopEngine();
        return;
      }
      audio.preview(id);
    });
  }
  const mb = mk('mute', muted ? 'mute: ON' : 'mute: OFF');
  mb.addEventListener('click', () => {
    audio.unlock();
    muted = !muted;
    audio.setMuted(muted);
    mb.textContent = muted ? 'mute: ON' : 'mute: OFF';
    writeSave({ best: save.best, muted });
  });

  // ---- images
  const box = main.querySelector('#images');
  for (const spr of assets.list) {
    const frames = spr.frames;
    const fw = spr.w;
    const fh = spr.h;
    const total = fw * frames;
    const scale = Math.max(2, Math.min(8, Math.floor(1240 / total)));
    const fig = document.createElement('figure');
    const c = document.createElement('canvas');
    c.width = total * scale;
    c.height = fh * scale;
    c.dataset.assetId = spr.id;
    c.dataset.frames = String(frames);
    c.dataset.frameW = String(fw);
    c.dataset.frameH = String(fh);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    if (spr.id === 'font_pixel') {
      // presentation only: dark backing, digits yellow / letters white / symbols cyan (the asset itself is white)
      const tc = document.createElement('canvas');
      tc.width = c.width;
      tc.height = c.height;
      const tg = tc.getContext('2d');
      tg.imageSmoothingEnabled = false;
      tg.drawImage(spr.canvas, 0, 0, spr.canvas.width, spr.canvas.height, 0, 0, c.width, c.height);
      tg.globalCompositeOperation = 'source-atop';
      const cell = fw * scale;
      const bands = [[0, 10, '#ffd94a'], [10, 36, '#ffffff'], [36, frames, '#63ecff']];
      for (const [a, b, col] of bands) {
        tg.fillStyle = col;
        tg.fillRect(a * cell, 0, (b - a) * cell, c.height);
      }
      g.fillStyle = '#231a48';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(tc, 0, 0);
    } else {
      g.drawImage(spr.canvas, 0, 0, spr.canvas.width, spr.canvas.height, 0, 0, c.width, c.height);
    }
    const cap = document.createElement('figcaption');
    const id = document.createElement('code');
    id.textContent = spr.id;
    cap.appendChild(id);
    const info = document.createElement('span');
    info.textContent = ` ${frames} frame${frames > 1 ? 's' : ''}, ${fw}x${fh}px${NOTES[spr.id] ? ' - ' + NOTES[spr.id] : ''}`;
    cap.appendChild(info);
    fig.appendChild(c);
    fig.appendChild(cap);
    box.appendChild(fig);
  }
}

function params() {
  return new URLSearchParams(location.search);
}
