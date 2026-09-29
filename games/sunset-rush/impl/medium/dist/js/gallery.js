import { buildAssets } from './art.js';
import { AudioSys, SOUND_IDS } from './audio.js';

export function startGallery() {
  document.documentElement.style.cssText = 'height:auto;overflow:auto;background:#14121f';
  document.body.style.cssText = 'display:block;overflow:auto;background:#14121f;color:#eee;font:14px monospace;padding:12px';
  document.getElementById('game').style.display = 'none';
  const A = buildAssets();
  const audio = new AudioSys();
  const root = document.createElement('div');
  document.body.appendChild(root);
  const h = document.createElement('h1');
  h.textContent = 'SUNSET RUSH - asset gallery';
  root.appendChild(h);

  const main = ['car_player', 'car_sedan', 'car_truck', 'car_sports', 'rs_palm', 'rs_rock', 'rs_shrub', 'rs_pine', 'rs_boulder', 'rs_fern', 'rs_lamp', 'rs_neon', 'rs_building', 'gate_checkpoint', 'gate_goal', 'bg_sky_1', 'bg_sky_2', 'bg_sky_3', 'bg_far_1', 'bg_far_2', 'bg_far_3', 'logo_title', 'font_pixel', 'fx_smoke'];
  const extra = ['bg_near_1', 'bg_near_2', 'bg_near_3', 'rs_billboard', 'rs_signpost', 'rs_bollard', 'rs_building_b', 'gate_start', 'car_player_brake', 'fx_dust', 'fx_spark',
    'car_sedan_v1', 'car_sedan_v2', 'car_truck_v1', 'car_truck_v2', 'car_sports_v1', 'car_sports_v2'];
  for (const id of [...main, ...extra]) {
    const a = A[id];
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin:10px 0';
    const c = document.createElement('canvas');
    const zoom = Math.max(2, Math.min(8, Math.floor(1200 / a.canvas.width)));
    const cw = a.canvas.width, ch = a.canvas.height;
    c.width = cw * zoom; c.height = ch * zoom;
    c.dataset.assetId = id;
    c.dataset.frames = String(a.frames);
    c.dataset.frameW = String(a.fw);
    c.dataset.frameH = String(a.fh);
    c.style.cssText = 'image-rendering:pixelated;background:repeating-conic-gradient(#3a3550 0 25%,#2a2640 0 50%) 0 0/16px 16px;display:block;max-width:100%';
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    if (id === 'font_pixel') { g.fillStyle = '#222'; g.fillRect(0, 0, c.width, c.height); }
    g.drawImage(a.canvas, 0, 0, cw * zoom, ch * zoom);
    wrap.appendChild(c);
    const t = document.createElement('div');
    t.textContent = id + '  (' + a.frames + 'f ' + a.fw + 'x' + a.fh + ')';
    wrap.appendChild(t);
    root.appendChild(wrap);
  }
  const sh = document.createElement('h2');
  sh.textContent = 'Sounds';
  root.appendChild(sh);
  for (const id of [...SOUND_IDS, 'mute']) {
    const b = document.createElement('button');
    b.dataset.soundId = id;
    b.textContent = id;
    b.style.cssText = 'margin:4px;padding:8px 12px;font:14px monospace';
    b.addEventListener('click', () => {
      audio.ensure();
      if (id === 'mute') { audio.setMuted(!audio.muted); b.textContent = audio.muted ? 'mute (ON)' : 'mute'; }
      else audio.preview(id);
    });
    root.appendChild(b);
  }
}
