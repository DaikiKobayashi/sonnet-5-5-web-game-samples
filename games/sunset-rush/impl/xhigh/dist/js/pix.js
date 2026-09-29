// ピクセルアート作成用の小さなツールキット。
// 画像はすべてコードで 1px ずつ描いて作る(外部素材なし)。色は '#rrggbb' または '#rrggbbaa'。

import { mulberry32 } from './util.js';

const colorCache = new Map();

// 色文字列 -> [r,g,b,a]
export function C(str) {
  if (Array.isArray(str)) return str;
  let c = colorCache.get(str);
  if (!c) {
    const s = str.replace('#', '');
    c = [
      parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16),
      s.length >= 8 ? parseInt(s.slice(6, 8), 16) : 255,
    ];
    colorCache.set(str, c);
  }
  return c;
}

export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
// 0..1 のしきい値
export const bayer = (x, y) => (BAYER4[y & 3][x & 3] + 0.5) / 16;

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }

  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  // 不透明で上書き(alpha があれば単純ブレンド)
  set(x, y, col) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const c = C(col);
    const i = (y * this.w + x) * 4;
    const d = this.d;
    if (c[3] === 255) {
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    } else if (c[3] > 0) {
      const a = c[3] / 255;
      const da = d[i + 3] / 255;
      const oa = a + da * (1 - a);
      d[i] = (c[0] * a + d[i] * da * (1 - a)) / oa;
      d[i + 1] = (c[1] * a + d[i + 1] * da * (1 - a)) / oa;
      d[i + 2] = (c[2] * a + d[i + 2] * da * (1 - a)) / oa;
      d[i + 3] = oa * 255;
    }
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    const i = (Math.floor(y) * this.w + Math.floor(x)) * 4;
    return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
  }

  alpha(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[(Math.floor(y) * this.w + Math.floor(x)) * 4 + 3];
  }

  clear() { this.d.fill(0); }

  rect(x, y, w, h, col) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col);
  }

  hline(x0, x1, y, col) { for (let x = x0; x <= x1; x++) this.set(x, y, col); }
  vline(x, y0, y1, col) { for (let y = y0; y <= y1; y++) this.set(x, y, col); }

  line(x0, y0, x1, y1, col) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // 太い線(円形ブラシ)
  thickLine(x0, y0, x1, y1, r, col) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, col);
    }
  }

  // 中心 (cx,cy)、半径 r の円板。fn(x,y) が false を返した画素は塗らない
  disc(cx, cy, r, col, fn) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2 && (!fn || fn(x, y))) this.set(x, y, col);
      }
    }
  }

  ellipse(cx, cy, rx, ry, col, fn) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && (!fn || fn(x, y))) this.set(x, y, col);
      }
    }
  }

  // 多角形の塗りつぶし(スキャンライン)
  poly(pts, col, fn) {
    let minY = Infinity; let maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const yc = y + 0.5;
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
          xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) {
          if (!fn || fn(x, y)) this.set(x, y, col);
        }
      }
    }
  }

  // 台形: 行 y0..y1(含む)で、左端 xl0→xl1、右端 xr0→xr1 を線形補間(右端は含まない)
  trap(y0, y1, xl0, xr0, xl1, xr1, col, fn) {
    const n = Math.max(1, y1 - y0);
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / n;
      const xl = Math.round(xl0 + (xl1 - xl0) * t);
      const xr = Math.round(xr0 + (xr1 - xr0) * t);
      for (let x = xl; x < xr; x++) if (!fn || fn(x, y)) this.set(x, y, col);
    }
  }

  // 他の Pix を貼る(不透明画素のみ)
  blit(src, ox, oy, opts = {}) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        if (src.d[i + 3] === 0) continue;
        const sx = opts.flipX ? src.w - 1 - x : x;
        const j = (y * src.w + sx) * 4;
        this.set(ox + x, oy + y, [src.d[j], src.d[j + 1], src.d[j + 2], src.d[j + 3]]);
      }
    }
  }

  // 不透明画素の周囲(4 近傍)に輪郭を足す
  outline(col, diag = false) {
    const mark = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y) !== 0) continue;
        if (this.alpha(x - 1, y) || this.alpha(x + 1, y) || this.alpha(x, y - 1) || this.alpha(x, y + 1)
          || (diag && (this.alpha(x - 1, y - 1) || this.alpha(x + 1, y - 1) || this.alpha(x - 1, y + 1) || this.alpha(x + 1, y + 1)))) {
          mark.push([x, y]);
        }
      }
    }
    for (const [x, y] of mark) this.set(x, y, col);
  }

  // マスク画素(alpha>0)だけを別色で塗る関数を適用
  mapPixels(fn) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4;
        if (this.d[i + 3] === 0) continue;
        const r = fn(x, y, [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]);
        if (r) {
          const c = C(r);
          this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = c[3];
        }
      }
    }
  }

  clone() {
    const p = new Pix(this.w, this.h);
    p.d.set(this.d);
    return p;
  }

  // 行ごとの水平ずらし(せん断)。shiftFn(y) が整数のずらし量を返す
  shear(shiftFn) {
    const out = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      const s = shiftFn(y);
      for (let x = 0; x < this.w; x++) {
        const nx = x + s;
        if (nx < 0 || nx >= this.w) continue;
        const i = (y * this.w + x) * 4;
        const j = (y * this.w + nx) * 4;
        out.d[j] = this.d[i]; out.d[j + 1] = this.d[i + 1]; out.d[j + 2] = this.d[i + 2]; out.d[j + 3] = this.d[i + 3];
      }
    }
    return out;
  }

  toCanvas() {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d');
    ctx.putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return cv;
  }
}

// 文字列アート → Pix。palette: 文字 -> 色。'.' と ' ' は透明
export function fromStrings(rows, palette) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const p = new Pix(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      const col = palette[ch];
      if (!col) throw new Error(`palette missing '${ch}'`);
      p.set(x, y, col);
    }
  }
  return p;
}

// 複数の Pix を横に並べたスプライトシートにする
export function sheet(frames) {
  const w = frames[0].w;
  const h = frames[0].h;
  const p = new Pix(w * frames.length, h);
  frames.forEach((f, i) => p.blit(f, i * w, 0));
  return p;
}

// 見た目専用でない、作画専用の決定的な乱数
export function artRng(seed) {
  return mulberry32(seed);
}

// 色の乗算的な明暗(-1..1)
export function shade(col, amt) {
  const c = C(col);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return [f(c[0]), f(c[1]), f(c[2]), c[3]];
}

export function mix(a, b, t) {
  const A = C(a); const B = C(b);
  return [
    Math.round(A[0] + (B[0] - A[0]) * t), Math.round(A[1] + (B[1] - A[1]) * t),
    Math.round(A[2] + (B[2] - A[2]) * t), Math.round(A[3] + (B[3] - A[3]) * t),
  ];
}

// ディザ付きの縦グラデーション(colors を上から下へ)。y0..y1 の範囲を塗る
export function gradientV(p, colors, y0, y1, x0 = 0, x1 = p.w - 1) {
  const n = colors.length - 1;
  for (let y = y0; y <= y1; y++) {
    const pos = ((y - y0) / Math.max(1, y1 - y0)) * n;
    const i = Math.min(n - 1, Math.floor(pos));
    const frac = pos - i;
    for (let x = x0; x <= x1; x++) {
      p.set(x, y, frac > bayer(x, y) ? colors[i + 1] : colors[i]);
    }
  }
}
