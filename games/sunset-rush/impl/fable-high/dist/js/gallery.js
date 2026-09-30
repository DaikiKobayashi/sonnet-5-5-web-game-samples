// Asset gallery page (?gallery=1). DOM allowed here.

import { buildAssets, GALLERY_ORDER } from './assets.js';
import { GameAudio, SOUND_IDS } from './audio.js';
import { makeCanvas } from './pix.js';

export function showGallery() {
  document.body.classList.add('gallery');
  const root = document.getElementById('gallery');
  const A = buildAssets();
  const h1 = document.createElement('h1');
  h1.textContent = 'SUNSET RUSH - ASSET GALLERY';
  root.appendChild(h1);

  const imgSection = document.createElement('div');
  root.appendChild(imgSection);
  for (const id of GALLERY_ORDER) {
    const a = A[id];
    if (!a) continue;
    const scale = a.fw * a.n > 700 ? 2 : a.fw * a.n > 300 ? 2 : 3;
    const c = makeCanvas(a.fw * a.n * scale, a.fh * scale);
    c.dataset.assetId = id;
    c.dataset.frames = String(a.n);
    c.dataset.frameW = String(a.fw);
    c.dataset.frameH = String(a.fh);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(a.canvas, 0, 0, c.width, c.height);
    const box = document.createElement('div');
    box.className = 'asset';
    box.appendChild(c);
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = `${id}  (${a.n} frame${a.n > 1 ? 's' : ''}, ${a.fw}x${a.fh})`;
    box.appendChild(label);
    imgSection.appendChild(box);
  }

  const h2 = document.createElement('h1');
  h2.textContent = 'SOUNDS';
  root.appendChild(h2);
  const audio = new GameAudio();
  const sndSection = document.createElement('div');
  root.appendChild(sndSection);
  let previewTimer = 0;
  const stopPreview = () => { audio.stopBgm(); clearTimeout(previewTimer); };
  for (const id of SOUND_IDS) {
    const b = document.createElement('button');
    b.dataset.soundId = id;
    b.textContent = id;
    b.addEventListener('click', () => {
      audio.init();
      audio.resume();
      if (id.startsWith('bgm_')) {
        if (audio.bgmId === id) { stopPreview(); return; }
        stopPreview();
        audio.playBgm(id);
        previewTimer = setTimeout(stopPreview, 3000);
      } else {
        audio.play(id);
      }
    });
    sndSection.appendChild(b);
  }
  const mute = document.createElement('button');
  mute.dataset.soundId = 'mute';
  mute.textContent = 'mute: off';
  mute.addEventListener('click', () => {
    audio.init();
    audio.setMuted(!audio.muted);
    mute.textContent = audio.muted ? 'mute: on' : 'mute: off';
  });
  sndSection.appendChild(mute);
}
