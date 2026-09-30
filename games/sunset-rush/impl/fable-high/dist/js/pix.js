// Tiny pixel painter used to build every image asset at start-up.
// Works on a raw RGBA buffer so drawing is deterministic and pixel-exact,
// then converts to a canvas with putImageData.

import { rgba } from './util.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }

  set(x, y, c) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b, a] = rgba(c);
    const d = this.d;
    const i = (y * this.w + x) * 4;
    if (a >= 255) {
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    } else if (a > 0) {
      const da = d[i + 3] / 255, sa = a / 255;
      const oa = sa + da * (1 - sa);
      if (oa <= 0) return;
      d[i] = (r * sa + d[i] * da * (1 - sa)) / oa;
      d[i + 1] = (g * sa + d[i + 1] * da * (1 - sa)) / oa;
      d[i + 2] = (b * sa + d[i + 2] * da * (1 - sa)) / oa;
      d[i + 3] = oa * 255;
    }
  }

  alphaAt(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[(y * this.w + x) * 4 + 3];
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  hline(x0, x1, y, c) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    for (let x = x0; x <= x1; x++) this.set(x, y, c);
  }

  vline(x, y0, y1, c) {
    if (y1 < y0) [y0, y1] = [y1, y0];
    for (let y = y0; y <= y1; y++) this.set(x, y, c);
  }

  line(x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  disc(cx, cy, r, c) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r + r * 0.5) this.set(cx + x, cy + y, c);
    }
  }

  ellipse(cx, cy, rx, ry, c) {
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx + 0.25) + (y * y) / (ry * ry + 0.25) <= 1) this.set(cx + x, cy + y, c);
    }
  }

  tri(x0, y0, x1, y1, x2, y2, c) {
    const minY = Math.min(y0, y1, y2) | 0, maxY = Math.max(y0, y1, y2) | 0;
    const edge = (ax, ay, bx, by, y) => {
      if (ay === by) return null;
      if (y < Math.min(ay, by) || y > Math.max(ay, by)) return null;
      return ax + ((y - ay) * (bx - ax)) / (by - ay);
    };
    for (let y = minY; y <= maxY; y++) {
      const xs = [edge(x0, y0, x1, y1, y), edge(x1, y1, x2, y2, y), edge(x2, y2, x0, y0, y)].filter((v) => v !== null);
      if (xs.length < 2) continue;
      this.hline(Math.round(Math.min(...xs)), Math.round(Math.max(...xs)), y, c);
    }
  }

  // Draw string-art rows using a palette map { char: color }. '.' and ' ' are transparent.
  blit(rows, pal, ox = 0, oy = 0, flipX = false) {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const c = pal[ch];
        if (!c) continue;
        this.set(ox + (flipX ? row.length - 1 - x : x), oy + y, c);
      }
    }
  }

  blitPix(src, ox = 0, oy = 0) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      if (src.d[i + 3] === 0) continue;
      this.set(ox + x, oy + y, [src.d[i], src.d[i + 1], src.d[i + 2], src.d[i + 3]]);
    }
  }

  // Add a 1px outline around all opaque pixels (4-neighbour).
  outline(c) {
    const src = this.d.slice();
    const w = this.w, h = this.h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] !== 0) continue;
      const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && src[(yy * w + xx) * 4 + 3] > 0;
      if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) this.set(x, y, c);
    }
  }

  // Return a copy shifted by (dx, dy) for rows in [y0, y1].
  shiftRows(y0, y1, dx) {
    const out = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      const s = y >= y0 && y <= y1 ? dx : 0;
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4;
        if (this.d[i + 3] === 0) continue;
        out.set(x + s, y, [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]);
      }
    }
    return out;
  }

  flipX() {
    const out = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = (y * this.w + x) * 4;
      out.d.set(this.d.subarray(i, i + 4), (y * this.w + (this.w - 1 - x)) * 4);
    }
    return out;
  }

  toCanvas() {
    const c = makeCanvas(this.w, this.h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(this.w, this.h);
    img.data.set(this.d);
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

// Combine equally sized frames into one horizontal strip canvas.
export function makeStrip(frames) {
  const fw = frames[0].w, fh = frames[0].h;
  const strip = new Pix(fw * frames.length, fh);
  frames.forEach((f, i) => strip.blitPix(f, i * fw, 0));
  return { canvas: strip.toCanvas(), fw, fh, n: frames.length };
}
