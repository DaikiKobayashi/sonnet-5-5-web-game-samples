// アセットギャラリー(?gallery=1)。画像アセットの全フレームと、音アセットの試聴ボタンを並べる。

import { getAssets } from './assets.js';
import { AudioSys, SOUND_IDS } from './audio.js';

const STORE_KEY = 'sunset-rush:v1';

const GROUPS = [
  ['Cars', /^car_/],
  ['Roadside', /^rs_/],
  ['Gates', /^gate_/],
  ['Backgrounds', /^bg_/],
  ['UI / Effects', /^(logo_|font_|fx_)/],
];

function el(tag, attrs = {}, text) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

export function startGallery() {
  document.body.classList.add('gallery');
  const root = el('div', { id: 'gallery' });
  document.body.appendChild(root);
  root.appendChild(el('h1', {}, 'SUNSET RUSH - ASSET GALLERY'));
  root.appendChild(el('div', {}, 'All images are drawn by code at startup (no external files). Sounds are synthesized with Web Audio.'));

  const assets = getAssets();
  const used = new Set();
  for (const [title, re] of GROUPS) {
    root.appendChild(el('h2', {}, title));
    const box = el('div');
    for (const a of assets.list) {
      if (!re.test(a.id)) continue;
      used.add(a.id);
      box.appendChild(makeAsset(a));
    }
    root.appendChild(box);
  }
  for (const a of assets.list) {
    if (used.has(a.id)) continue;
    root.appendChild(makeAsset(a));
  }

  // 音
  root.appendChild(el('h2', {}, 'Sounds'));
  let muted = false;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) muted = !!JSON.parse(raw).muted;
  } catch (e) { /* 何もしない */ }
  const audio = new AudioSys(muted);
  const snd = el('div', { class: 'sounds' });
  for (const id of SOUND_IDS) {
    const b = el('button', { 'data-sound-id': id, type: 'button' }, id);
    b.addEventListener('click', () => audio.preview(id));
    snd.appendChild(b);
  }
  const mb = el('button', { 'data-sound-id': 'mute', type: 'button' }, muted ? 'MUTE: ON' : 'MUTE: OFF');
  mb.addEventListener('click', () => {
    audio.ensure();
    muted = !muted;
    audio.setMuted(muted);
    mb.textContent = muted ? 'MUTE: ON' : 'MUTE: OFF';
    mb.setAttribute('data-muted', muted ? 'true' : 'false');
    try {
      let o = {};
      try { o = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e) { o = {}; }
      localStorage.setItem(STORE_KEY, JSON.stringify({ best: Number.isFinite(o.best) ? o.best : 0, muted }));
    } catch (e) { /* 何もしない */ }
  });
  mb.setAttribute('data-muted', muted ? 'true' : 'false');
  snd.appendChild(mb);
  root.appendChild(snd);
  root.appendChild(el('div', {}, 'BGM / engine / gravel previews stop after about 3 seconds (press a BGM button again to stop it).'));
}

function makeAsset(a) {
  const wrap = el('div', { class: 'asset' });
  const total = a.frames * a.fw;
  let zoom = Math.floor(880 / total);
  zoom = Math.max(2, Math.min(zoom, Math.floor(460 / a.fh), 8));
  if (a.id === 'font_pixel') zoom = 6;
  const cv = el('canvas', {
    width: String(total * zoom),
    height: String(a.fh * zoom),
    'data-asset-id': a.id,
    'data-frames': String(a.frames),
    'data-frame-w': String(a.fw),
    'data-frame-h': String(a.fh),
  });
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (a.id === 'font_pixel') {
    // 白いグリフなので、暗い地に置いて読みやすくする(グリフは 1 つずつ隙間なく並べる)
    for (let i = 0; i < a.frames; i++) {
      g.fillStyle = i % 2 ? '#2c2352' : '#1c1636';
      g.fillRect(i * a.fw * zoom, 0, a.fw * zoom, a.fh * zoom);
    }
  }
  g.drawImage(a.cv, 0, 0, total, a.fh, 0, 0, total * zoom, a.fh * zoom);
  const inner = el('div', { class: 'wrap' });
  inner.appendChild(cv);
  wrap.appendChild(inner);
  wrap.appendChild(el('div', { class: 'id' }, `${a.id}  (${a.frames} x ${a.fw}x${a.fh})`));
  return wrap;
}
