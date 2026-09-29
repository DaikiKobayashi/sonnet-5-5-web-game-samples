// アセットギャラリー(?gallery=1)
import { ASSETS, ASSET_ORDER, initAssets } from './assets.js';
import { AudioSys, SOUND_IDS } from './audio.js';

export function runGallery() {
  initAssets();
  document.body.classList.add('gallery');
  const root = document.getElementById('app');
  root.innerHTML = '';
  const audio = new AudioSys();
  window.__gallery = { audio };

  const h = document.createElement('h1');
  h.textContent = 'SUNSET RUSH - ASSET GALLERY';
  root.appendChild(h);

  const sec1 = document.createElement('h2');
  sec1.textContent = 'IMAGES';
  root.appendChild(sec1);
  const wrap = document.createElement('div');
  wrap.className = 'grid';
  root.appendChild(wrap);
  for (const id of ASSET_ORDER) {
    const a = ASSETS[id];
    const cell = document.createElement('figure');
    const cv = document.createElement('canvas');
    let scale = 2;
    const totalW = a.fw * a.frames;
    if (totalW <= 80) scale = 6;
    else if (totalW <= 200) scale = 4;
    else if (totalW <= 320) scale = 3;
    if (id === 'font_pixel') scale = 4;
    cv.width = totalW * scale;
    cv.height = a.fh * scale;
    cv.dataset.assetId = id;
    cv.dataset.frames = String(a.frames);
    cv.dataset.frameW = String(a.fw);
    cv.dataset.frameH = String(a.fh);
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#5a5f78';
    g.fillRect(0, 0, cv.width, cv.height);
    // 市松の下地
    g.fillStyle = '#4a4f68';
    const cs = 8;
    for (let y = 0; y < cv.height; y += cs) for (let x = 0; x < cv.width; x += cs) if (((x / cs) + (y / cs)) % 2 === 0) g.fillRect(x, y, cs, cs);
    g.drawImage(a.canvas, 0, 0, cv.width, cv.height);
    cv.style.maxWidth = '100%';
    cv.style.imageRendering = 'pixelated';
    const cap = document.createElement('figcaption');
    cap.textContent = id;
    cell.appendChild(cv);
    cell.appendChild(cap);
    wrap.appendChild(cell);
  }

  const sec2 = document.createElement('h2');
  sec2.textContent = 'SOUNDS';
  root.appendChild(sec2);
  const snd = document.createElement('div');
  snd.className = 'sounds';
  root.appendChild(snd);
  let playing = null, stopTimer = null;
  const stopAll = () => {
    audio.stopBgm();
    audio.setEngine(0, false);
    audio.setOffroad(false);
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = null;
    if (playing) playing.classList.remove('on');
    playing = null;
  };
  for (const id of SOUND_IDS) {
    const b = document.createElement('button');
    b.dataset.soundId = id;
    b.textContent = id;
    b.addEventListener('click', () => {
      audio.ensure();
      const was = playing === b;
      stopAll();
      if (was) return;
      if (id.startsWith('bgm_')) audio.playBgm(id);
      else if (id === 'sfx_engine') audio.setEngine(0.5, true);
      else if (id === 'sfx_offroad') audio.setOffroad(true, 0.6);
      else audio.sfx(id);
      playing = b;
      b.classList.add('on');
      stopTimer = setTimeout(stopAll, id.startsWith('bgm_') || id === 'sfx_engine' || id === 'sfx_offroad' ? 3000 : 1800);
    });
    snd.appendChild(b);
  }
  const mute = document.createElement('button');
  mute.dataset.soundId = 'mute';
  mute.textContent = 'mute: OFF';
  mute.addEventListener('click', () => {
    audio.ensure();
    audio.setMuted(!audio.muted);
    mute.textContent = 'mute: ' + (audio.muted ? 'ON' : 'OFF');
  });
  snd.appendChild(mute);
}
