// Asset gallery (?gallery=1). DOM is allowed here.
import { buildAssets, GALLERY_ORDER } from './assets.js';
import { fontAtlas, GLYPH_ORDER, GW, GH } from './font.js';
import { Sound, SOUND_IDS } from './audio.js';

export function runGallery() {
  document.body.classList.add('gallery');
  const A = buildAssets();
  const root = document.createElement('div');
  root.id = 'gallery';
  root.innerHTML = '<h1>SUNSET RUSH - ASSET GALLERY</h1>';
  document.body.appendChild(root);

  const addItem = (id, frames, fw, fh, count, drawFn, zoom) => {
    const box = document.createElement('div');
    box.className = 'item';
    const c = document.createElement('canvas');
    c.width = fw * count * zoom + (count - 1) * 2 * zoom;
    c.height = fh * zoom;
    c.dataset.assetId = id;
    c.dataset.frames = String(count);
    c.dataset.frameW = String(fw);
    c.dataset.frameH = String(fh);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    drawFn(g, zoom);
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = `${id}  (${fw}x${fh} x ${count})`;
    box.appendChild(c); box.appendChild(label);
    root.appendChild(box);
  };

  for (const id of GALLERY_ORDER) {
    const a = A[id];
    const zoom = a.w >= 300 ? 2 : a.w >= 100 ? 3 : 4;
    addItem(id, a.frames, a.w, a.h, a.frames.length, (g, z) => {
      a.frames.forEach((f, i) => g.drawImage(f, i * (a.w + 2) * z, 0, a.w * z, a.h * z));
    }, zoom);
  }
  // font
  const at = fontAtlas();
  const n = GLYPH_ORDER.length;
  addItem('font_pixel', null, GW, GH, n, (g, z) => {
    for (let i = 0; i < n; i++) g.drawImage(at, i * GW, 0, GW, GH, i * (GW + 2) * z, 0, GW * z, GH * z);
  }, 4);
  const chars = document.createElement('div');
  chars.className = 'label';
  chars.textContent = 'glyphs: ' + GLYPH_ORDER.map((c) => (c === ' ' ? '(space)' : c)).join(' ');
  root.appendChild(chars);

  // sounds
  const snd = new Sound();
  const h2 = document.createElement('h2'); h2.textContent = 'SOUNDS'; root.appendChild(h2);
  const bar = document.createElement('div'); bar.className = 'sounds'; root.appendChild(bar);
  let stopTimer = null, playing = null, engineTimer = null;
  const stopLoop = () => {
    snd.stopBgm(); snd.setEngine(false, 0); snd.setOffroad(false);
    if (engineTimer) { clearInterval(engineTimer); engineTimer = null; }
    if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
    playing = null;
  };
  for (const id of SOUND_IDS) {
    const b = document.createElement('button');
    b.dataset.soundId = id; b.textContent = id;
    b.addEventListener('click', () => {
      snd.ensure();
      if (id.startsWith('bgm_') || id === 'sfx_engine' || id === 'sfx_offroad') {
        const was = playing;
        stopLoop();
        if (was === id) return;
        playing = id;
        if (id.startsWith('bgm_')) snd.playBgm(id);
        else if (id === 'sfx_offroad') snd.setOffroad(true);
        else {
          const t0 = performance.now();
          engineTimer = setInterval(() => { const sp = Math.min(1, (performance.now() - t0) / 2500); snd.setEngine(true, sp); }, 30);
        }
        stopTimer = setTimeout(stopLoop, 3000);
      } else snd.play(id);
    });
    bar.appendChild(b);
  }
  const m = document.createElement('button');
  m.dataset.soundId = 'mute';
  m.textContent = 'mute: off';
  m.addEventListener('click', () => { snd.ensure(); snd.setMuted(!snd.muted); m.textContent = 'mute: ' + (snd.muted ? 'on' : 'off'); });
  bar.appendChild(m);
}
