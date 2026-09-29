// Tiny pixel-art toolkit. Sprites are drawn into RGBA buffers (Px) with integer colours (0xRRGGBB),
// so the same code runs in the browser (converted to canvases) and in Node (for previews/tests).

export const hex = (s) => parseInt(String(s).replace('#', ''), 16);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function rgbOf(c) {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}
export function pack(r, g, b) {
  return ((Math.round(r) & 255) << 16) | ((Math.round(g) & 255) << 8) | (Math.round(b) & 255);
}
export function mix(a, b, t) {
  const A = rgbOf(a);
  const B = rgbOf(b);
  return pack(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export const lighten = (c, t) => mix(c, 0xffffff, t);
export const darken = (c, t) => mix(c, 0x000000, t);
export function css(c, a = 1) {
  const [r, g, b] = rgbOf(c);
  return a >= 1 ? 'rgb(' + r + ',' + g + ',' + b + ')' : 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}
export function luma(c) {
  const [r, g, b] = rgbOf(c);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function hslOf(c) {
  const [r0, g0, b0] = rgbOf(c);
  const r = r0 / 255, g = g0 / 255, b = b0 / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
export function fromHsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return pack((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
function hueToward(h, target, amt) {
  let d = ((target - h + 540) % 360) - 180;
  return h + Math.max(-amt, Math.min(amt, d));
}
// Pixel-art style shading: lighter steps drift toward warm yellow, darker steps toward cool violet.
export function shade(c, level) {
  let [h, s, l] = hslOf(c);
  const a = Math.abs(level);
  l = Math.max(0.03, Math.min(0.97, l + level * 0.085));
  if (level > 0) { h = hueToward(h, 52, 5 * a); s = Math.min(1, s * (1 - 0.04 * a)); }
  else if (level < 0) { h = hueToward(h, 262, 7 * a); s = Math.min(1, s * (1 + 0.05 * a)); }
  return fromHsl(h, s, l);
}

// 4x4 Bayer matrix (0..15) for ordered dithering
export const BAYER4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];
export const bayer = (x, y) => (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

// deterministic value hash in [0,1)
export function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export class Px {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  clone() {
    const p = new Px(this.w, this.h);
    p.data.set(this.data);
    return p;
  }

  inb(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x, y, c, a = 255) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const d = this.data;
    if (c === null || c === undefined) { d[i + 3] = 0; return; }
    d[i] = (c >> 16) & 255;
    d[i + 1] = (c >> 8) & 255;
    d[i + 2] = c & 255;
    d[i + 3] = a;
  }

  // alpha-blend a colour over the existing pixel
  blend(x, y, c, a) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const d = this.data;
    const sa = a / 255;
    const da = d[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    d[i] = (((c >> 16) & 255) * sa + d[i] * da * (1 - sa)) / oa;
    d[i + 1] = (((c >> 8) & 255) * sa + d[i + 1] * da * (1 - sa)) / oa;
    d[i + 2] = ((c & 255) * sa + d[i + 2] * da * (1 - sa)) / oa;
    d[i + 3] = oa * 255;
  }

  // returns packed colour or -1 when transparent
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    const i = (y * this.w + x) * 4;
    const d = this.data;
    if (d[i + 3] === 0) return -1;
    return (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
  }

  alphaAt(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  solid(x, y) {
    return this.alphaAt(x, y) > 0;
  }

  clear() {
    this.data.fill(0);
    return this;
  }

  rect(x, y, w, h, c, a = 255) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a);
    return this;
  }
  hline(x, y, w, c, a = 255) { return this.rect(x, y, w, 1, c, a); }
  vline(x, y, h, c, a = 255) { return this.rect(x, y, 1, h, c, a); }

  line(x0, y0, x1, y1, c, a = 255) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }

  // thick line: draws a filled disc at every step
  thickLine(x0, y0, x1, y1, r, c, a = 255) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, c, a);
    }
    return this;
  }

  // centre (cx, cy) in pixel-edge coordinates; pixel (x,y) has its centre at (x+0.5, y+0.5)
  disc(cx, cy, r, c, a = 255) {
    return this.ellipse(cx, cy, r, r, c, a);
  }

  ellipse(cx, cy, rx, ry, c, a = 255) {
    const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c, a);
      }
    }
    return this;
  }

  // even-odd scanline polygon fill sampled at pixel centres; pts = [[x,y],...]
  poly(pts, c, a = 255) {
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(this.h - 1, Math.ceil(maxY));
    for (let y = y0; y <= y1; y++) {
      const yy = y + 0.5;
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const A = pts[i], B = pts[(i + 1) % pts.length];
        if ((A[1] <= yy && B[1] > yy) || (B[1] <= yy && A[1] > yy)) {
          xs.push(A[0] + ((yy - A[1]) / (B[1] - A[1])) * (B[0] - A[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.round(xs[k]), xb = Math.round(xs[k + 1]);
        for (let x = xa; x < xb; x++) this.set(x, y, c, a);
      }
    }
    return this;
  }

  // fn(x, y) -> colour | null, evaluated over the rectangle
  fill(x0, y0, w, h, fn) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const c = fn(x, y);
        if (c !== null && c !== undefined) this.set(x, y, c);
      }
    }
    return this;
  }

  // copy another Px (respecting alpha) at (dx, dy)
  blit(src, dx = 0, dy = 0, opts = {}) {
    const flip = !!opts.flipX;
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const sx = flip ? src.w - 1 - x : x;
        const i = (y * src.w + sx) * 4;
        const a = src.data[i + 3];
        if (a === 0) continue;
        const c = (src.data[i] << 16) | (src.data[i + 1] << 8) | src.data[i + 2];
        if (a === 255) this.set(dx + x, dy + y, c);
        else this.blend(dx + x, dy + y, c, a);
      }
    }
    return this;
  }

  flipped() {
    const p = new Px(this.w, this.h);
    p.blit(this, 0, 0, { flipX: true });
    return p;
  }

  // draw the alpha mask of this image in a single colour, offset by (dx, dy), *behind* the existing pixels
  shadowBehind(dx, dy, c, a = 255) {
    const src = this.clone();
    const out = new Px(this.w, this.h);
    out.blit(src, 0, 0);
    const under = new Px(this.w, this.h);
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        if (src.solid(x, y)) under.set(x + dx, y + dy, c, a);
      }
    }
    under.blit(src, 0, 0);
    this.data.set(under.data);
    return this;
  }

  // external outline: transparent pixels touching an opaque one become colour c
  outline(c, diag = false) {
    const add = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.solid(x, y)) continue;
        let hit = this.solid(x - 1, y) || this.solid(x + 1, y) || this.solid(x, y - 1) || this.solid(x, y + 1);
        if (!hit && diag) hit = this.solid(x - 1, y - 1) || this.solid(x + 1, y - 1) || this.solid(x - 1, y + 1) || this.solid(x + 1, y + 1);
        if (hit) add.push([x, y]);
      }
    }
    for (const [x, y] of add) this.set(x, y, c);
    return this;
  }

  // recolour boundary pixels (inside the shape) that touch transparency
  innerOutline(c) {
    const edge = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!this.solid(x, y)) continue;
        if (!this.solid(x - 1, y) || !this.solid(x + 1, y) || !this.solid(x, y - 1) || !this.solid(x, y + 1)) edge.push([x, y]);
      }
    }
    for (const [x, y] of edge) this.set(x, y, c);
    return this;
  }

  mapColors(fn) {
    for (let i = 0; i < this.data.length; i += 4) {
      if (this.data[i + 3] === 0) continue;
      const c = (this.data[i] << 16) | (this.data[i + 1] << 8) | this.data[i + 2];
      const n = fn(c);
      if (n === null || n === undefined) continue;
      this.data[i] = (n >> 16) & 255;
      this.data[i + 1] = (n >> 8) & 255;
      this.data[i + 2] = n & 255;
    }
    return this;
  }

  // horizontal shear: each row y is shifted by fn(y) pixels (integer)
  shearRows(fn) {
    const out = new Px(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      const s = Math.round(fn(y));
      for (let x = 0; x < this.w; x++) {
        const nx = x + s;
        if (nx < 0 || nx >= this.w) continue;
        const i = (y * this.w + x) * 4;
        if (this.data[i + 3] === 0) continue;
        const o = (y * this.w + nx) * 4;
        out.data[o] = this.data[i];
        out.data[o + 1] = this.data[i + 1];
        out.data[o + 2] = this.data[i + 2];
        out.data[o + 3] = this.data[i + 3];
      }
    }
    this.data.set(out.data);
    return this;
  }

  // Scale2x / EPX upscaling (smooths diagonals of block art)
  scale2x() {
    const o = new Px(this.w * 2, this.h * 2);
    const eq = (a, b) => a === b;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const P = this.get(x, y), A = this.get(x, y - 1), B = this.get(x + 1, y), C = this.get(x - 1, y), D = this.get(x, y + 1);
        let e0 = P, e1 = P, e2 = P, e3 = P;
        if (!eq(C, B) && !eq(A, D)) {
          if (eq(A, C)) e0 = A;
          if (eq(A, B)) e1 = B;
          if (eq(D, C)) e2 = C;
          if (eq(D, B)) e3 = B;
        }
        const put = (px, py, v) => { if (v !== -1) o.set(px, py, v); };
        put(x * 2, y * 2, e0);
        put(x * 2 + 1, y * 2, e1);
        put(x * 2, y * 2 + 1, e2);
        put(x * 2 + 1, y * 2 + 1, e3);
      }
    }
    return o;
  }

  scaled(k) {
    const o = new Px(this.w * k, this.h * k);
    for (let y = 0; y < o.h; y++) {
      for (let x = 0; x < o.w; x++) {
        const c = this.get((x / k) | 0, (y / k) | 0);
        if (c !== -1) o.set(x, y, c, this.alphaAt((x / k) | 0, (y / k) | 0));
      }
    }
    return o;
  }

  crop(x, y, w, h) {
    const o = new Px(w, h);
    o.blit(this, -x, -y);
    return o;
  }

  isBlank() {
    for (let i = 3; i < this.data.length; i += 4) if (this.data[i] !== 0) return false;
    return true;
  }

  toImageData(ctx) {
    const id = ctx.createImageData(this.w, this.h);
    id.data.set(this.data);
    return id;
  }

  toCanvas() {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const g = c.getContext('2d');
    g.putImageData(this.toImageData(g), 0, 0);
    return c;
  }
}

// side-by-side frames -> single Px strip
export function strip(frames) {
  const w = frames[0].w, h = frames[0].h;
  const out = new Px(w * frames.length, h);
  frames.forEach((f, i) => out.blit(f, i * w, 0));
  return out;
}

// Parse a character-grid sprite. rows: array of equal-length strings; palette: {char: colour}
export function fromRows(rows, palette) {
  const h = rows.length, w = rows[0].length;
  const p = new Px(w, h);
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) throw new Error('fromRows: row ' + y + ' has length ' + rows[y].length + ', expected ' + w);
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      const col = palette[ch];
      if (col === undefined) throw new Error('fromRows: unknown palette char "' + ch + '"');
      if (col !== null) p.set(x, y, col);
    }
  }
  return p;
}

// Ordered-dither vertical gradient over rows [y0, y1) given colour stops [{t, c}], quantised to `bands` steps.
export function ditherGradient(px, x0, x1, y0, y1, stops, bands = 12) {
  const colorAt = (t) => {
    if (t <= stops[0].t) return stops[0].c;
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i].t) {
        const a = stops[i - 1], b = stops[i];
        return mix(a.c, b.c, (t - a.t) / (b.t - a.t));
      }
    }
    return stops[stops.length - 1].c;
  };
  const pal = [];
  for (let i = 0; i < bands; i++) pal.push(colorAt(i / (bands - 1)));
  for (let y = y0; y < y1; y++) {
    const t = (y - y0 + 0.5) / (y1 - y0);
    const v = t * (bands - 1);
    const i0 = Math.floor(v);
    const f = v - i0;
    for (let x = x0; x < x1; x++) {
      const idx = f > bayer(x, y) ? Math.min(bands - 1, i0 + 1) : i0;
      px.set(x, y, pal[idx]);
    }
  }
}
