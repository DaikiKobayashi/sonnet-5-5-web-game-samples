import { ASSETS } from './assets.js';
import { audio, initAudio, setMuted, sfx, startBgm, stopBgm, setEngine, BGM_IDS } from './audio.js';

export function startGallery() {
  const old = document.getElementById('game'); if (old) old.remove();
  document.body.classList.add('gallery');
  const wrap = document.createElement('div'); wrap.style.padding = '12px'; document.body.appendChild(wrap);
  const h = document.createElement('h1'); h.textContent = 'SUNSET RUSH asset gallery'; wrap.appendChild(h);
  for (const id of Object.keys(ASSETS)) {
    const a = ASSETS[id], z = a.fw * a.frames > 400 ? 1 : Math.max(2, Math.min(6, Math.floor(600 / (a.fw * a.frames))));
    const box = document.createElement('div');
    const c = document.createElement('canvas');
    c.width = a.fw * a.frames * z; c.height = a.fh * z;
    c.style.width = c.width + 'px'; c.style.height = c.height + 'px';
    c.dataset.assetId = id; c.dataset.frames = a.frames; c.dataset.frameW = a.fw; c.dataset.frameH = a.fh;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(a.canvas, 0, 0, c.width, c.height);
    const label = document.createElement('div'); label.textContent = id + ' (' + a.frames + ' x ' + a.fw + 'x' + a.fh + ')';
    box.appendChild(c); box.appendChild(label); wrap.appendChild(box);
  }
  const sh = document.createElement('h2'); sh.textContent = 'Sounds'; wrap.appendChild(sh);
  const btn = (id, fn) => { const b = document.createElement('button'); b.dataset.soundId = id; b.textContent = id; b.addEventListener('click', () => { initAudio(); fn(); }); wrap.appendChild(b); };
  let t = null;
  BGM_IDS.forEach((id) => btn(id, () => { stopBgm(); startBgm(id); clearTimeout(t); t = setTimeout(stopBgm, 3000); }));
  btn('sfx_engine', () => { setEngine(true, 0.5); setTimeout(() => setEngine(false, 0), 3000); });
  ['sfx_beep', 'sfx_go', 'sfx_checkpoint', 'sfx_crash', 'sfx_goal', 'sfx_timeup', 'sfx_menu', 'sfx_overtake', 'sfx_timewarn'].forEach((id) => btn(id, () => sfx(id)));
  btn('mute', () => setMuted(!audio.muted));
}
