/* pix.js - small pixel-art toolkit (all art in this game is drawn on a 2px dot grid) */
(function () {
  'use strict';
  const DM = (window.DM = window.DM || {});

  const colorCache = {};
  function rgba(c) {
    let v = colorCache[c];
    if (v) return v;
    const h = c.slice(1);
    v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length > 6 ? parseInt(h.slice(6, 8), 16) : 255];
    colorCache[c] = v;
    return v;
  }
  function hx(n) {
    n = Math.max(0, Math.min(255, Math.round(n)));
    return (n < 16 ? '0' : '') + n.toString(16);
  }
  function mix(a, b, t) {
    const A = rgba(a), B = rgba(b);
    return '#' + hx(A[0] + (B[0] - A[0]) * t) + hx(A[1] + (B[1] - A[1]) * t) + hx(A[2] + (B[2] - A[2]) * t);
  }
  const dark = (c, t) => mix(c, '#000000', t);
  const light = (c, t) => mix(c, '#ffffff', t);

  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function mkCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  class Pix {
    constructor(w, h) {
      this.w = w || 16;
      this.h = h || 16;
      this.d = new Array(this.w * this.h).fill(null);
    }
    set(x, y, c) {
      x = Math.floor(x);
      y = Math.floor(y);
      if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
      return this;
    }
    get(x, y) {
      return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : null;
    }
    rect(x, y, w, h, c) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
      return this;
    }
    ellipse(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
        for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) this.set(x, y, c);
        }
      }
      return this;
    }
    line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (let n = 0; n < 200; n++) {
        this.set(x0, y0, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
      return this;
    }
    tri(ax, ay, bx, by, cx, cy, c) {
      const minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx));
      const minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
      const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (den === 0) return this;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5, py = y + 0.5;
          const a = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den;
          const b = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
          const g = 1 - a - b;
          if (a >= -0.001 && b >= -0.001 && g >= -0.001) this.set(x, y, c);
        }
      }
      return this;
    }
    // rows: array of strings; pal: char -> color. '.' and ' ' are transparent. Rows are left aligned at ox.
    art(rows, pal, ox, oy) {
      ox = ox || 0; oy = oy || 0;
      for (let y = 0; y < rows.length; y++) {
        const r = rows[y];
        for (let x = 0; x < r.length; x++) {
          const ch = r[x];
          if (ch === '.' || ch === ' ') continue;
          const c = pal[ch];
          if (c) this.set(ox + x, oy + y, c);
        }
      }
      return this;
    }
    outline(c, diag) {
      const add = [];
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          if (this.get(x, y)) continue;
          let near = this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1);
          if (!near && diag) near = this.get(x - 1, y - 1) || this.get(x + 1, y - 1) || this.get(x - 1, y + 1) || this.get(x + 1, y + 1);
          if (near) add.push(x, y);
        }
      }
      for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], c);
      return this;
    }
    clone() {
      const p = new Pix(this.w, this.h);
      p.d = this.d.slice();
      return p;
    }
    flipH() {
      const p = new Pix(this.w, this.h);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.d[y * this.w + x] = this.d[y * this.w + (this.w - 1 - x)];
      return p;
    }
    flipV() {
      const p = new Pix(this.w, this.h);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.d[y * this.w + x] = this.d[(this.h - 1 - y) * this.w + x];
      return p;
    }
    rot90() { // clockwise
      const p = new Pix(this.h, this.w);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.d[x * p.w + (this.h - 1 - y)] = this.d[y * this.w + x];
      return p;
    }
    shift(dx, dy) {
      const p = new Pix(this.w, this.h);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const c = this.d[y * this.w + x];
        if (c) p.set(x + dx, y + dy, c);
      }
      return p;
    }
    blit(src, ox, oy) {
      ox = ox || 0; oy = oy || 0;
      for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
        const c = src.d[y * src.w + x];
        if (c) this.set(x + ox, y + oy, c);
      }
      return this;
    }
    map(fn) {
      const p = new Pix(this.w, this.h);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const c = this.d[y * this.w + x];
        p.d[y * this.w + x] = c ? fn(c, x, y) : null;
      }
      return p;
    }
    // nearest-neighbour resample about bottom-centre (used for squash / stretch)
    scaleBottom(sx, sy) {
      const p = new Pix(this.w, this.h);
      const cx = this.w / 2, by = this.h;
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          const srcX = Math.floor(cx + (x + 0.5 - cx) / sx);
          const srcY = Math.floor(by + (y + 0.5 - by) / sy);
          p.d[y * this.w + x] = this.get(srcX, srcY);
        }
      }
      return p;
    }
    toCanvas(scale) {
      scale = scale || 2;
      const small = mkCanvas(this.w, this.h);
      const sctx = small.getContext('2d');
      const img = sctx.createImageData(this.w, this.h);
      for (let i = 0; i < this.d.length; i++) {
        const c = this.d[i];
        if (!c) continue;
        const v = rgba(c);
        img.data[i * 4] = v[0]; img.data[i * 4 + 1] = v[1]; img.data[i * 4 + 2] = v[2]; img.data[i * 4 + 3] = v[3];
      }
      sctx.putImageData(img, 0, 0);
      if (scale === 1) return small;
      const out = mkCanvas(this.w * scale, this.h * scale);
      const octx = out.getContext('2d');
      octx.imageSmoothingEnabled = false;
      octx.drawImage(small, 0, 0, this.w * scale, this.h * scale);
      return out;
    }
  }

  DM.rgba = rgba; DM.mix = mix; DM.dark = dark; DM.light = light;
  DM.mulberry32 = mulberry32; DM.mkCanvas = mkCanvas; DM.Pix = Pix;
})();
