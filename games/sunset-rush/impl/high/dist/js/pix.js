// ピクセルアート生成の小道具
import { hash2 } from './util.js';

export function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c, g };
}
export function rect(g, x, y, w, h, col) {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
}
export function dot(g, x, y, col) {
  g.fillStyle = col;
  g.fillRect(x, y, 1, 1);
}
// 楕円(ピクセル単位のテスト)
export function ell(g, cx, cy, rx, ry, col) {
  g.fillStyle = col;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) g.fillRect(x, y, 1, 1);
    }
  }
}
export function line(g, x0, y0, x1, y1, col, t = 1) {
  g.fillStyle = col;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const o = Math.floor(t / 2);
  for (;;) {
    g.fillRect(x0 - o, y0 - o, t, t);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
// 陰影つきの塊(4 階調)。pal = [ハイライト, 明, 中, 暗]
export function blob(g, cx, cy, rx, ry, pal, seed = 1, opt = {}) {
  const lx = opt.lx ?? -0.55, ly = opt.ly ?? -0.65;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const d = nx * nx + ny * ny;
      const wob = (hash2(x, y, seed) - 0.5) * 0.12;
      if (d + wob > 1) continue;
      const nz = Math.sqrt(Math.max(0, 1 - d));
      let l = nx * lx + ny * ly + nz * 0.55 + (hash2(x >> 1, y >> 1, seed + 7) - 0.5) * 0.35;
      const i = l > 0.85 ? 0 : l > 0.45 ? 1 : l > 0.0 ? 2 : 3;
      dot(g, x, y, pal[i]);
    }
  }
}
export function frameSheet(frames, w, h, draw) {
  const { c, g } = mk(w * frames, h);
  for (let i = 0; i < frames; i++) {
    g.save();
    g.translate(i * w, 0);
    g.beginPath();
    g.rect(0, 0, w, h);
    g.clip();
    draw(g, i);
    g.restore();
  }
  return c;
}
