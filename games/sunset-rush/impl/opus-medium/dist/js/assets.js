// All image assets are generated here from code at startup (no external files).
import { GLYPHS, GLYPH_ORDER, GW, GH, ADV } from './font.js';

// ---------- pixel buffer helpers ----------
const colCache = new Map();
function rgba(c) {
  let v = colCache.get(c);
  if (v) return v;
  const h = c.replace('#', '');
  v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255];
  colCache.set(c, v);
  return v;
}
export function hex(r, g, b) {
  const f = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + f(r) + f(g) + f(b);
}
export function mix(a, b, t) {
  const A = rgba(a), B = rgba(b);
  return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export function toRGB(c) { const v = rgba(c); return [v[0], v[1], v[2]]; }

class PB {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  set(x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const v = rgba(c), i = (y * this.w + x) * 4;
    if (v[3] === 255) { this.d[i] = v[0]; this.d[i + 1] = v[1]; this.d[i + 2] = v[2]; this.d[i + 3] = 255; }
    else {
      const a = v[3] / 255, oa = this.d[i + 3] / 255, na = a + oa * (1 - a);
      if (na <= 0) return;
      for (let k = 0; k < 3; k++) this.d[i + k] = (v[k] * a + this.d[i + k] * oa * (1 - a)) / na;
      this.d[i + 3] = na * 255;
    }
  }
  on(x, y) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false; return this.d[(y * this.w + x) * 4 + 3] > 0; }
  clear(x, y) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.d[(y * this.w + x) * 4 + 3] = 0; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  hsym(x, y, w, h, c) { this.rect(x, y, w, h, c); this.rect(this.w - x - w, y, w, h, c); }
  hline(x0, x1, y, c) { for (let x = Math.round(x0); x <= Math.round(x1); x++) this.set(x, y, c); }
  disc(cx, cy, r, c) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, c); }
  text(str, x, y, scale, c) {
    let cx = x;
    for (const ch of str) {
      const g = GLYPHS[ch];
      if (g) for (let r = 0; r < GH; r++) for (let q = 0; q < GW; q++) if (g[r][q] === '#') this.rect(cx + q * scale, y + r * scale, scale, scale, c);
      cx += ADV * scale;
    }
  }
  // dark outline around opaque pixels (1px, 4-neighbour), only where transparent
  outline(c) {
    const pts = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.on(x, y)) continue;
      if (this.on(x - 1, y) || this.on(x + 1, y) || this.on(x, y - 1) || this.on(x, y + 1)) pts.push([x, y]);
    }
    for (const [x, y] of pts) this.set(x, y, c);
  }
  canvas() {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const g = c.getContext('2d');
    const id = g.createImageData(this.w, this.h);
    id.data.set(this.d);
    g.putImageData(id, 0, 0);
    return c;
  }
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const dith = (x, y) => (BAYER[y & 3][x & 3] + 0.5) / 16;

// shaded organic blob. pal = [outline, dark, mid, light, highlight]
function blob(pb, cx, cy, rx, ry, pal, seed, bump = 0.15, flatBottom = null) {
  const r = mulberry(seed);
  const p = [r() * 6.28, r() * 6.28, r() * 6.28];
  for (let y = 0; y < pb.h; y++) for (let x = 0; x < pb.w; x++) {
    if (flatBottom !== null && y > flatBottom) continue;
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    const a = Math.atan2(dy, dx);
    const rr = 1 + bump * (Math.sin(a * 3 + p[0]) * 0.5 + Math.sin(a * 5 + p[1]) * 0.35 + Math.sin(a * 8 + p[2]) * 0.2);
    const d = Math.hypot(dx, dy);
    if (d >= rr) continue;
    if (d > rr - 0.13 * (1 / Math.min(rx, ry)) * 6) { pb.set(x, y, pal[0]); continue; }
    const l = (-dx * 0.55 - dy * 0.85) / rr + (dith(x, y) - 0.5) * 0.35;
    const c = l > 0.55 ? pal[4] : l > 0.15 ? pal[3] : l > -0.3 ? pal[2] : pal[1];
    pb.set(x, y, c);
  }
}

function sheet(w, h, n, fn) {
  const frames = [];
  for (let i = 0; i < n; i++) { const pb = new PB(w, h); fn(pb, i); frames.push(pb.canvas()); }
  return { w, h, frames };
}

// ---------- cars ----------
function playerCar(pb, turn, brake, wheel) {
  const s = turn; // upper body lean
  const t = turn * 2;
  // shadow
  pb.rect(2, 20, 36, 2, '#00000060');
  // tyres
  for (const tx of [2, 30]) {
    pb.rect(tx, 14, 8, 7, '#141418');
    pb.rect(tx + 1, 14, 6, 1, '#2c2c34');
    for (let y = 15 + wheel; y < 21; y += 2) pb.rect(tx + 1, y, 6, 1, '#26262e');
  }
  // lower body
  pb.rect(1 + s, 8, 38, 8, '#c4161c');
  pb.rect(1 + s, 14, 38, 2, '#7c0a10');
  pb.rect(2 + s, 7, 36, 1, '#e8484c');
  pb.rect(1 + s, 8, 1, 7, '#8a0e14'); pb.rect(38 + s, 8, 1, 7, '#8a0e14');
  pb.rect(3 + s, 16, 34, 2, '#26262c'); // bumper
  pb.rect(4 + s, 16, 32, 1, '#44444c');
  // exhausts
  pb.rect(8 + s, 17, 3, 2, '#5a5a62'); pb.rect(9 + s, 18, 1, 1, '#18181c');
  pb.rect(29 + s, 17, 3, 2, '#5a5a62'); pb.rect(30 + s, 18, 1, 1, '#18181c');
  if (wheel) { pb.set(7 + s, 19, '#9a9aa488'); pb.set(6 + s, 20, '#9a9aa466'); pb.set(33 + s, 19, '#9a9aa488'); pb.set(34 + s, 20, '#9a9aa466'); }
  // tail lights
  const tl = brake ? ['#ff3030', '#ffd0c8', '#ff8070'] : ['#9c1016', '#e03a30', '#c02020'];
  for (const lx of [3, 29]) {
    pb.rect(lx + s, 9, 8, 4, '#3a0608');
    pb.rect(lx + 1 + s, 10, 6, 2, tl[0]);
    pb.rect(lx + 2 + s, 10, 3, 1, tl[1]);
    pb.rect(lx + 5 + s, 11, 1, 1, tl[2]);
  }
  // plate
  pb.rect(16 + s, 11, 8, 4, '#f2eedc');
  pb.rect(17 + s, 12, 6, 1, '#40404a'); pb.rect(17 + s, 13, 4, 1, '#8a8a90');
  // rear deck
  pb.rect(4 + t, 5, 32, 3, '#dc2a30');
  pb.rect(5 + t, 5, 30, 1, '#f47074');
  // headrests / occupants
  pb.rect(11 + t, 1, 6, 5, '#3a2418'); // driver hair
  pb.rect(12 + t, 0, 4, 1, '#3a2418');
  pb.rect(12 + t, 4, 4, 1, '#d89a78');
  pb.rect(24 + t, 1, 6, 5, '#f0c848'); // passenger (blonde)
  pb.rect(25 + t, 0, 4, 1, '#f8e070');
  pb.rect(29 + t + turn, 2, 3, 2, '#f0c848'); // hair flowing
  pb.rect(31 + t + turn, 3, 2, 1, '#e0b030');
  // windscreen frame
  pb.rect(6 + t, 3, 1, 3, '#b8b8c8'); pb.rect(33 + t, 3, 1, 3, '#b8b8c8');
  pb.rect(7 + t, 4, 3, 1, '#6a88b0'); pb.rect(18 + t, 4, 5, 1, '#6a88b0'); pb.rect(31 + t, 4, 2, 1, '#6a88b0');
  // side visible when turning
  if (turn !== 0) {
    const sx = turn < 0 ? 38 + s : 0 + s;
    pb.rect(sx, 8, 2, 7, '#901016');
    pb.rect(sx, 8, 2, 1, '#d23036');
  }
}

const SEDAN_PALS = [
  { b: '#2c64c8', d: '#173878', l: '#6a9aee' },
  { b: '#e8e4dc', d: '#9a968e', l: '#ffffff' },
  { b: '#2f8a58', d: '#17482e', l: '#5cc488' },
];
const SPORTS_PALS = [
  { b: '#f0c020', d: '#8a6408', l: '#ffe880' },
  { b: '#c02aa8', d: '#601050', l: '#f070da' },
  { b: '#2a2a34', d: '#101016', l: '#5a5a6a' },
];
const TRUCK_PALS = [
  { b: '#e6e6ea', d: '#9898a4', l: '#ffffff' },
  { b: '#e8801c', d: '#8a4208', l: '#ffb060' },
  { b: '#2a9aa0', d: '#135458', l: '#62d0d4' },
];

function sedan(pb, P) {
  pb.rect(1, 18, 34, 2, '#00000060');
  pb.hsym(2, 14, 6, 5, '#141418');
  pb.hsym(3, 14, 4, 1, '#2c2c34');
  pb.rect(0, 8, 36, 8, P.b);
  pb.rect(0, 14, 36, 2, P.d);
  pb.rect(1, 7, 34, 1, P.l);
  pb.rect(6, 0, 24, 1, P.l);
  pb.rect(5, 1, 26, 6, P.b);
  pb.rect(7, 2, 22, 5, '#1c2436');
  pb.rect(8, 2, 20, 1, '#3c4c6a');
  pb.rect(9, 3, 3, 1, '#6a7ca0'); pb.rect(10, 4, 2, 1, '#6a7ca0');
  pb.hsym(1, 9, 6, 3, '#d02424');
  pb.hsym(2, 9, 3, 1, '#ff8a80');
  pb.rect(14, 11, 8, 3, '#e8e8d8');
  pb.rect(15, 12, 6, 1, '#50505a');
  pb.rect(1, 16, 34, 2, '#2c2c34');
  pb.hsym(0, 8, 1, 6, P.d);
}
function sports(pb, P) {
  pb.rect(1, 16, 36, 2, '#00000060');
  pb.hsym(2, 12, 7, 5, '#141418');
  pb.hsym(3, 12, 5, 1, '#2c2c34');
  pb.rect(0, 7, 38, 7, P.b);
  pb.rect(0, 12, 38, 2, P.d);
  pb.rect(11, 1, 16, 1, P.l);
  pb.rect(9, 2, 20, 4, P.b);
  pb.rect(11, 2, 16, 3, '#1c2436');
  pb.rect(12, 2, 14, 1, '#3c4c6a');
  pb.rect(1, 5, 36, 2, '#18181e'); // spoiler
  pb.rect(1, 5, 36, 1, '#3a3a44');
  pb.hsym(4, 3, 2, 2, '#18181e');
  pb.rect(2, 9, 34, 2, '#b01818');
  pb.hsym(2, 9, 7, 1, '#ff6a60');
  pb.rect(15, 9, 8, 2, '#401010');
  pb.rect(15, 11, 8, 2, '#e8e8d8');
  pb.rect(4, 14, 30, 2, '#2c2c34');
  pb.hsym(6, 14, 2, 2, '#6a6a72');
}
function truck(pb, P) {
  pb.rect(1, 32, 42, 2, '#00000060');
  pb.rect(1, 0, 42, 25, P.b);
  pb.rect(1, 0, 42, 1, P.l);
  for (let x = 4; x < 42; x += 5) pb.rect(x, 2, 1, 22, P.d);
  for (let x = 5; x < 42; x += 5) pb.rect(x, 2, 1, 22, P.l);
  pb.rect(21, 1, 2, 24, P.d);
  pb.rect(1, 23, 42, 2, P.d);
  pb.hsym(1, 0, 1, 25, P.d);
  pb.rect(18, 10, 2, 5, '#606070'); pb.rect(24, 10, 2, 5, '#606070');
  pb.rect(2, 25, 40, 3, '#26262c');
  pb.rect(2, 25, 40, 1, '#44444c');
  pb.hsym(3, 26, 5, 2, '#d02424');
  pb.hsym(4, 26, 2, 1, '#ff8a80');
  pb.hsym(9, 26, 2, 2, '#f0a020');
  pb.rect(18, 26, 8, 3, '#e8e8d8');
  pb.rect(19, 27, 6, 1, '#50505a');
  pb.hsym(3, 28, 9, 5, '#141418');
  pb.hsym(4, 28, 7, 1, '#2c2c34');
  pb.hsym(7, 28, 1, 5, '#26262c');
  pb.hsym(12, 28, 2, 5, '#1c1c22'); // mud flap
}

// ---------- roadside ----------
function palm(pb) {
  // trunk
  for (let y = 71; y >= 16; y--) {
    const t = (71 - y) / 55;
    const cx = 21 - 6 * t * t + 1.5 * Math.sin(t * 3.2);
    const w = 5.5 - 2.5 * t;
    const x0 = Math.round(cx - w / 2), x1 = Math.round(cx + w / 2);
    const ring = (y % 4) === 0;
    for (let x = x0; x <= x1; x++) {
      let c = x === x0 ? '#3a2214' : x === x1 ? '#b88858' : x - x0 < (x1 - x0) / 2 ? '#6e4a2a' : '#94683e';
      if (ring) c = x === x1 ? '#8a5e36' : '#4a2c18';
      pb.set(x, y, c);
    }
  }
  const cx = 15, cy = 16;
  const fronds = [[-3.0, 17, 0.028], [-2.5, 16, 0.02], [-1.9, 12, 0.012], [-1.3, 12, 0.014], [-0.6, 17, 0.022], [-0.1, 18, 0.03], [3.3, 15, 0.03], [0.5, 14, 0.04], [2.7, 13, 0.045]];
  const greens = ['#123a22', '#1f6232', '#2e8a44', '#58b85a', '#8ade6a'];
  fronds.forEach(([a, L, droop], fi) => {
    for (let s = 0; s <= L; s += 0.5) {
      const x = cx + Math.cos(a) * s, y = cy + Math.sin(a) * s + droop * s * s * 2;
      const th = Math.max(1, 2.6 - s / 8);
      for (let k = -th / 2; k <= th / 2; k += 0.7) pb.set(x, y + k, k < 0 ? greens[3] : greens[2]);
      if (s > 2 && Math.floor(s * 2) % 3 === 0) {
        const lx = Math.round(x), ly = Math.round(y);
        pb.set(lx, ly + 2, greens[1]); pb.set(lx - (fi % 2 ? 1 : -1), ly + 3, greens[1]);
        pb.set(lx, ly - 2, greens[2]);
      }
    }
  });
  pb.outline('#0c2416');
  pb.disc(14, 18, 2, '#5a3a1c'); pb.disc(17, 19, 2, '#6a4422'); pb.set(13, 17, '#a07040'); pb.set(16, 18, '#a07040');
}
function rock(pb) { blob(pb, 16, 14, 15, 11, ['#2a1624', '#5a3444', '#8a5460', '#bc7c7a', '#eab094'], 11, 0.18, 21); pb.rect(3, 21, 26, 1, '#2a1624'); }
function shrub(pb) {
  const pal = ['#123420', '#1d5530', '#2f7a3e', '#4aa24c', '#86cc62'];
  blob(pb, 9, 13, 8, 7, pal, 3, 0.25, 19);
  blob(pb, 22, 13, 9, 7, pal, 5, 0.25, 19);
  blob(pb, 16, 10, 9, 8, pal, 7, 0.25, 19);
  const fl = [[8, 9], [14, 5], [21, 8], [25, 13], [12, 13], [18, 11]];
  for (const [x, y] of fl) { pb.set(x, y, '#ff5a8a'); pb.set(x + 1, y, '#ff5a8a'); pb.set(x, y + 1, '#c02a5a'); pb.set(x + 1, y + 1, '#ffd0e0'); }
}
function pine(pb) {
  pb.rect(18, 66, 4, 22, '#3a2418'); pb.rect(20, 66, 2, 22, '#5a3a24'); pb.rect(18, 66, 1, 22, '#241410');
  const tiers = [[2, 20, 6], [12, 34, 10], [24, 48, 14], [36, 60, 17], [48, 72, 19]];
  const cols = ['#0a1e1c', '#153a30', '#225440', '#3a7052', '#6a9a78'];
  for (const [top, bot, hw] of tiers) {
    for (let y = top; y <= bot; y++) {
      const t = (y - top) / (bot - top);
      let w = hw * t + 1;
      const jag = (y === bot || y === bot - 1) ? 0 : 0;
      for (let x = Math.round(20 - w); x <= Math.round(19 + w); x++) {
        if (y >= bot - 1 && ((x + y) % 3 === 0)) continue;
        const rel = (x - 20) / (w + 0.01);
        const l = rel * 0.7 + (1 - t) * 0.3 + (dith(x, y) - 0.5) * 0.4 + jag;
        pb.set(x, y, l > 0.55 ? cols[4] : l > 0.2 ? cols[3] : l > -0.25 ? cols[2] : cols[1]);
      }
    }
  }
  pb.outline(cols[0]);
}
function boulder(pb) {
  blob(pb, 20, 17, 19, 14, ['#1c1428', '#3e3052', '#5e4c76', '#8676a0', '#b4a8cc'], 21, 0.14, 27);
  pb.rect(3, 27, 34, 1, '#1c1428');
  for (let x = 8; x < 30; x++) for (let y = 4; y < 10; y++) if (pb.on(x, y) && pb.on(x, y - 2) && dith(x, y) > 0.45) pb.set(x, y, dith(x * 3, y) > 0.7 ? '#4e8a5a' : '#2e6040');
}
function fern(pb) {
  const cols = ['#0e2c1c', '#1c5230', '#34804a', '#62b262'];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI + 0.35 + (i / (n - 1)) * (Math.PI - 0.7);
    const L = 11 + (i % 2) * 3;
    for (let s = 0; s <= L; s += 0.5) {
      const x = 14 + Math.cos(a) * s, y = 15 + Math.sin(a) * s * 0.95 + s * s * 0.03;
      pb.set(x, y, cols[2]);
      if (Math.floor(s * 2) % 3 === 0 && s > 1) {
        const nx = -Math.sin(a), ny = Math.cos(a);
        const ll = Math.max(1, 3 - s / 5);
        for (let k = 1; k <= ll; k++) { pb.set(x + nx * k, y + ny * k, cols[1]); pb.set(x - nx * k, y - ny * k, cols[3]); }
      }
    }
  }
  pb.outline(cols[0]);
}
function lamp(pb) {
  pb.rect(9, 8, 2, 76, '#4a4e62'); pb.rect(10, 8, 1, 76, '#7a80a0');
  pb.rect(7, 80, 6, 8, '#2a2c3a'); pb.rect(8, 80, 4, 1, '#5a5e76');
  pb.rect(3, 5, 14, 2, '#4a4e62'); pb.rect(3, 5, 14, 1, '#7a80a0');
  for (const hx of [0, 13]) {
    pb.rect(hx, 6, 7, 3, '#2a2c3a');
    pb.rect(hx + 1, 9, 5, 2, '#fff2b0');
    pb.rect(hx + 2, 9, 3, 1, '#ffffff');
    pb.rect(hx, 11, 7, 1, '#ffd86a88');
  }
  pb.rect(8, 40, 4, 3, '#3a3e52');
}
function neon(pb) {
  pb.rect(10, 34, 4, 18, '#3a3a4a'); pb.rect(42, 34, 4, 18, '#3a3a4a');
  pb.rect(11, 34, 1, 18, '#6a6a80'); pb.rect(43, 34, 1, 18, '#6a6a80');
  pb.rect(1, 0, 54, 35, '#12081e');
  pb.rect(1, 0, 54, 1, '#3a2a4a');
  // neon border
  for (let x = 3; x < 53; x++) { pb.set(x, 2, (x & 1) ? '#ff3cc8' : '#ff9ae6'); pb.set(x, 32, (x & 1) ? '#ff3cc8' : '#ff9ae6'); }
  for (let y = 2; y <= 32; y++) { pb.set(3, y, (y & 1) ? '#ff3cc8' : '#ff9ae6'); pb.set(52, y, (y & 1) ? '#ff3cc8' : '#ff9ae6'); }
  pb.text('MOTEL', 13, 6, 1, '#1a8aa0');
  pb.text('MOTEL', 12, 5, 1, '#6af4ff');
  pb.rect(8, 16, 40, 1, '#ff3cc8');
  pb.text('OPEN', 16, 20, 1, '#a02070');
  pb.text('OPEN', 15, 19, 1, '#ffe060');
  // arrow
  pb.rect(40, 22, 7, 1, '#6af4ff'); pb.set(45, 21, '#6af4ff'); pb.set(45, 23, '#6af4ff');
}
function building(pb, seed, tall, variant) {
  const r = mulberry(seed);
  const w = 64, h = tall;
  const top = variant ? 18 : 6;
  if (variant) {
    pb.rect(8, 0, 48, top, '#10142c'); pb.rect(8, 0, 48, 1, '#2a3060');
    pb.rect(30, 0, 1, 0, '#000');
  } else {
    pb.rect(30, 0, 2, top, '#3a3e52'); pb.set(30, 0, '#ff3030'); pb.set(31, 0, '#ff8080');
  }
  pb.rect(0, top, w, h - top, '#141a36');
  pb.rect(0, top, w, 2, '#2a3262');
  pb.rect(w - 10, top, 10, h - top, '#0c1026');
  const lit = ['#ffd86a', '#ffb347', '#fff0b0', '#6af4ff'];
  const x0 = variant ? 12 : 4;
  for (let y = top + 5; y < h - 12; y += 7) for (let x = x0; x < w - 6; x += 6) {
    if (variant && x > 24 && x < 36) continue;
    const on = r() < 0.45;
    const c = on ? lit[Math.floor(r() * (variant ? 4 : 3))] : '#1e2648';
    const cw = x >= w - 12 ? (on ? '#8a6a30' : '#141a36') : c;
    pb.rect(x, y, 3, 4, cw);
    if (on) pb.rect(x, y + 3, 3, 1, '#00000040');
  }
  if (variant) {
    // vertical neon sign
    pb.rect(26, top + 4, 11, 48, '#1a0620');
    for (let y = top + 4; y < top + 52; y++) { pb.set(26, y, '#ff3cc8'); pb.set(36, y, '#ff3cc8'); }
    'HOTEL'.split('').forEach((ch, i) => pb.text(ch, 29, top + 7 + i * 9, 1, '#ff9ae6'));
  }
  // entrance
  pb.rect(22, h - 10, 20, 10, '#0a0c18');
  pb.rect(24, h - 9, 16, 9, variant ? '#ff3cc8' : '#ffd86a');
  pb.rect(25, h - 8, 14, 8, variant ? '#5a1848' : '#8a6a30');
  pb.rect(31, h - 8, 2, 8, '#0a0c18');
}
function billboard(pb) {
  pb.rect(8, 32, 3, 24, '#4a3a3a'); pb.rect(37, 32, 3, 24, '#4a3a3a');
  pb.rect(9, 32, 1, 24, '#7a6060'); pb.rect(38, 32, 1, 24, '#7a6060');
  pb.rect(0, 0, 48, 33, '#f4eee0');
  pb.rect(0, 32, 48, 1, '#8a8070');
  const sky = ['#ff6a8a', '#ff8a6a', '#ffb05a', '#ffd070'];
  for (let y = 2; y < 22; y++) pb.rect(2, y, 44, 1, sky[Math.min(3, Math.floor((y - 2) / 5))]);
  pb.disc(33, 20, 7, '#fff0a0');
  for (let y = 22; y < 31; y++) pb.rect(2, y, 44, 1, y % 2 ? '#1a8aa0' : '#2ab0c0');
  for (let x = 4; x < 44; x += 7) pb.rect(x, 24 + (x % 3), 3, 1, '#e0ffff');
  pb.text('SURF', 5, 4, 1, '#6a1848');
  pb.text('SURF', 4, 3, 1, '#ffffff');
  pb.rect(0, 0, 48, 1, '#c8c0b0'); pb.rect(0, 0, 1, 33, '#c8c0b0'); pb.rect(47, 0, 1, 33, '#c8c0b0');
}
function signpost(pb) {
  pb.rect(9, 17, 2, 27, '#8a8ea0'); pb.rect(10, 17, 1, 27, '#c0c4d0');
  for (let y = 0; y < 19; y++) for (let x = 0; x < 20; x++) {
    const d = Math.abs(x + 0.5 - 10) + Math.abs(y + 0.5 - 9.5);
    if (d < 9.5) pb.set(x, y, d > 8.3 ? '#1a1a1a' : d > 7.4 ? '#f0e0a0' : '#f0c020');
  }
  // chevron arrow
  for (let i = 0; i < 4; i++) { pb.rect(7 + i, 6 + i, 2, 1, '#1a1a1a'); pb.rect(7 + i, 13 - i, 2, 1, '#1a1a1a'); }
  pb.rect(10, 9, 2, 2, '#1a1a1a');
}
function bollard(pb) {
  pb.rect(2, 3, 8, 13, '#e8c020');
  for (let y = 3; y < 16; y++) for (let x = 2; x < 10; x++) if (((x + y) >> 2) % 2 === 0) pb.set(x, y, '#18181c');
  pb.rect(3, 1, 6, 2, '#e8c020'); pb.rect(4, 0, 4, 1, '#ffe060');
  pb.rect(4, 5, 4, 2, '#ff4040'); pb.rect(4, 5, 2, 1, '#ffb0b0');
  pb.rect(2, 3, 1, 13, '#8a7010'); pb.rect(9, 3, 1, 13, '#fff080');
}

function gate(pb, kind) {
  // pillars
  for (const px of [0, 148]) {
    pb.rect(px, 0, 12, 64, '#d8d8e0');
    for (let y = 0; y < 64; y += 8) pb.rect(px, y, 12, 4, kind === 'goal' ? '#1a1a22' : kind === 'start' ? '#20a040' : '#e03030');
    pb.rect(px, 0, 1, 64, '#7a7a88'); pb.rect(px + 11, 0, 1, 64, '#7a7a88');
    pb.rect(px - 1, 60, 14, 4, '#3a3a44');
  }
  // banner
  const by = 2, bh = 24;
  if (kind === 'goal') {
    for (let y = by; y < by + bh; y++) for (let x = 12; x < 148; x++) pb.set(x, y, (((x - 12) >> 2) + ((y - by) >> 2)) % 2 ? '#101014' : '#f4f4f4');
    pb.rect(48, by + 3, 64, 18, '#c81c24'); pb.rect(48, by + 3, 64, 1, '#ff6a6a');
    pb.text('GOAL', 57, by + 5, 2, '#5a0808');
    pb.text('GOAL', 56, by + 4, 2, '#ffffff');
  } else if (kind === 'start') {
    pb.rect(12, by, 136, bh, '#1a6a34'); pb.rect(12, by, 136, 1, '#5ad07a');
    pb.text('START', 52, by + 6, 2, '#0a2a14');
    pb.text('START', 51, by + 5, 2, '#fff8c0');
    for (const lx of [20, 128]) { pb.rect(lx, by + 5, 12, 14, '#101014'); pb.disc(lx + 6, by + 9, 2.5, '#ff3030'); pb.disc(lx + 6, by + 15, 2.5, '#30ff60'); }
  } else {
    pb.rect(12, by, 136, bh, '#1844a8'); pb.rect(12, by, 136, 1, '#6a9aff'); pb.rect(12, by + bh - 1, 136, 1, '#0c2260');
    pb.text('CHECKPOINT', 22, by + 6, 2, '#0a1a50');
    pb.text('CHECKPOINT', 21, by + 5, 2, '#ffe040');
  }
  // bulbs
  for (let x = 14; x < 148; x += 6) pb.set(x, by + bh, (x / 6) % 2 ? '#ffff80' : '#ffffff'), pb.set(x, by + bh + 1, '#c8a020');
}

// ---------- fx ----------
function smoke(pb, i) {
  const r = 2.5 + i * 1.1;
  const a = ['ff', 'e0', 'b0', '70'][i];
  blob(pb, 6, 6.5, r, r * 0.9, ['#5a5a64' + a, '#80808a' + a, '#a4a4ae' + a, '#c8c8d0' + a, '#ececf0' + a], 40 + i, 0.25);
  if (i === 3) for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (dith(x, y) < 0.3) pb.clear(x, y);
}
function dust(pb, i) {
  const r = 1.8 + i * 1.0;
  const a = ['ff', 'd0', '90'][i];
  blob(pb, 4, 4.5, r, r * 0.8, ['#7a5a38' + a, '#a0784a' + a, '#c09a68' + a, '#dcbc8a' + a, '#f0dcb0' + a], 60 + i, 0.3);
}
function spark(pb, i) {
  const c = ['#ffffff', '#fff080', '#ffa030'];
  if (i === 0) { pb.rect(2, 0, 2, 6, c[1]); pb.rect(0, 2, 6, 2, c[1]); pb.rect(2, 2, 2, 2, c[0]); }
  else if (i === 1) { for (let k = 0; k < 6; k++) { pb.set(k, k, c[2]); pb.set(5 - k, k, c[2]); } pb.rect(2, 2, 2, 2, c[1]); }
  else { pb.set(0, 0, c[2]); pb.set(5, 0, c[2]); pb.set(0, 5, c[2]); pb.set(5, 5, c[2]); pb.set(2, 3, c[1]); pb.set(3, 2, c[2]); }
}

// ---------- backgrounds ----------
function gradientSky(pb, stops) {
  const n = stops.length - 1;
  for (let y = 0; y < pb.h; y++) {
    const p = (y / (pb.h - 1)) * n;
    const i = Math.min(n - 1, Math.floor(p)), f = p - i;
    for (let x = 0; x < pb.w; x++) pb.set(x, y, f > dith(x, y) ? stops[i + 1] : stops[i]);
  }
}
function stars(pb, seed, count, maxY, cols) {
  const r = mulberry(seed);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(r() * pb.w), y = Math.floor(r() * maxY * r() + r() * 4);
    const c = cols[Math.floor(r() * cols.length)];
    pb.set(x, y, c);
    if (r() < 0.12) { pb.set(x - 1, y, c + '80'); pb.set(x + 1, y, c + '80'); pb.set(x, y - 1, c + '80'); pb.set(x, y + 1, c + '80'); }
  }
}
function wrapStreak(pb, x, y, len, c, c2) {
  for (let i = 0; i < len; i++) { const xx = ((x + i) % pb.w + pb.w) % pb.w; pb.set(xx, y, c); if (c2 && i > 2 && i < len - 3) pb.set(xx, y + 1, c2); }
}
function sky1(pb) {
  gradientSky(pb, ['#24163e', '#3e1f5c', '#6a2a74', '#a2347a', '#d8466e', '#f46a5a', '#ff924a', '#ffb65a', '#ffd67e']);
  stars(pb, 5, 40, 40, ['#ffffff', '#ffd0f0']);
  // sun with synthwave slits
  const cx = 320, cy = 150, R = 46;
  for (let y = cy - R; y <= 179; y++) for (let x = cx - R; x <= cx + R; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > R) { if (d < R + 6 && dith(x, y) < (R + 6 - d) / 12) pb.set(x, y, '#ffe0a0'); continue; }
    const t = (y - (cy - R)) / (2 * R);
    if (y > cy - 12) { const k = y - (cy - 12); const period = 7; const gap = 1 + Math.floor(k / 9); if ((k % period) < gap) continue; }
    pb.set(x, y, t < 0.3 ? '#fff6b0' : t < 0.45 ? (dith(x, y) < 0.5 ? '#fff6b0' : '#ffd860') : t < 0.6 ? '#ffc048' : t < 0.75 ? '#ff9a48' : '#ff6a60');
  }
  // clouds (wrap around)
  const r = mulberry(99);
  for (let i = 0; i < 26; i++) {
    const y = Math.floor(30 + r() * 100), x = Math.floor(r() * 640), len = Math.floor(30 + r() * 110);
    const t = (y - 30) / 100;
    const c = t < 0.4 ? '#8a3a86' : t < 0.7 ? '#c84a7e' : '#e86a6a';
    const hl = t < 0.4 ? '#c0609a' : t < 0.7 ? '#ff8a8a' : '#ffb07a';
    wrapStreak(pb, x + 3, y - 1, len - 8, hl);
    wrapStreak(pb, x, y, len, c, c);
    if (r() < 0.5) wrapStreak(pb, x + 10, y + 2, len - 20, c);
  }
}
function sky2(pb) {
  gradientSky(pb, ['#08061a', '#110c2c', '#1c1444', '#2a1a5c', '#3c2170', '#56287a', '#7a3480', '#9e4682', '#c05e84']);
  stars(pb, 7, 160, 110, ['#ffffff', '#c8c0ff', '#a098e0']);
  // crescent moon
  pb.disc(150, 38, 9, '#f0e8d0');
  pb.disc(154, 35, 8.5, '#00000000');
  for (let y = 26; y < 50; y++) for (let x = 138; x < 162; x++) if (Math.hypot(x + 0.5 - 154, y + 0.5 - 35) < 8.5 && Math.hypot(x + 0.5 - 150, y + 0.5 - 38) < 9) pb.set(x, y, '#1c1444');
  const r = mulberry(33);
  for (let i = 0; i < 18; i++) {
    const y = Math.floor(90 + r() * 70), x = Math.floor(r() * 640), len = Math.floor(40 + r() * 120);
    wrapStreak(pb, x, y, len, y > 135 ? '#b05a8a' : '#6a3a86', y > 135 ? '#96487e' : '#56307a');
  }
}
function sky3(pb) {
  gradientSky(pb, ['#010104', '#03030c', '#050618', '#080a24', '#0c0e30', '#12123a', '#1a1646', '#261a50', '#3a1e5a']);
  stars(pb, 9, 260, 150, ['#ffffff', '#a0c0ff', '#ffe0ff', '#8080a0']);
  // moon with halo
  const mx = 470, my = 48, R = 17;
  for (let y = my - 30; y < my + 30; y++) for (let x = mx - 30; x < mx + 30; x++) {
    const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
    if (d < R) {
      let c = '#e8ecff';
      const cr = [[-5, -4, 4], [4, 3, 3], [-2, 7, 2.5], [7, -6, 2]];
      for (const [ox, oy, rr] of cr) if (Math.hypot(x + 0.5 - mx - ox, y + 0.5 - my - oy) < rr) c = '#b8c0e0';
      if (x - mx > 9 && dith(x, y) < 0.6) c = '#c8d0f0';
      pb.set(x, y, c);
    } else if (d < R + 10 && dith(x, y) < (R + 10 - d) / 22) pb.set(x, y, '#3a4a8a');
  }
}
// periodic heightfield helper for seamless layers
function periodic(seed, terms) {
  const r = mulberry(seed);
  const t = terms.map(([k, a]) => [k, a, r() * Math.PI * 2]);
  return (x) => t.reduce((s, [k, a, p]) => s + a * Math.sin((x / 640) * Math.PI * 2 * k + p), 0);
}
function far1(pb) {
  // islands
  const f = periodic(4, [[2, 1], [3, 0.8], [5, 0.6], [11, 0.25], [23, 0.1]]);
  for (let x = 0; x < 640; x++) {
    const v = f(x);
    const hgt = v > 0.6 ? Math.floor((v - 0.6) * 22) : 0;
    for (let y = 80 - hgt; y < 80; y++) pb.set(x, y, y === 80 - hgt ? '#c86a8a' : (y < 80 - hgt + 3 && dith(x, y) < 0.5) ? '#a0507a' : '#6a2e62');
  }
  // sea
  for (let y = 80; y < 96; y++) for (let x = 0; x < 640; x++) {
    const t = (y - 80) / 16;
    pb.set(x, y, dith(x, y) < t ? '#1c6a80' : y < 83 ? '#e88a78' : '#2a8494');
  }
  const r = mulberry(12);
  for (let i = 0; i < 90; i++) {
    const y = 81 + Math.floor(r() * 15), x = Math.floor(r() * 640), len = 2 + Math.floor(r() * 7);
    wrapStreak(pb, x, y, len, r() < 0.5 ? '#ffb08a' : '#ffe0b0');
  }
}
function far2(pb) {
  const f1 = periodic(8, [[2, 1], [3, 0.7], [7, 0.4], [13, 0.2], [29, 0.08]]);
  const f2 = periodic(9, [[3, 1], [5, 0.6], [9, 0.3], [19, 0.15], [37, 0.06]]);
  for (let x = 0; x < 640; x++) {
    const h1 = Math.floor(52 + f1(x) * 20);
    for (let y = 96 - h1; y < 96; y++) {
      const snow = y < 96 - h1 + 4 && h1 > 62;
      pb.set(x, y, snow ? '#b8a8e0' : y === 96 - h1 ? '#7a64b0' : '#4a3a86');
    }
    const h2 = Math.floor(30 + f2(x) * 12);
    for (let y = 96 - h2; y < 96; y++) pb.set(x, y, y === 96 - h2 ? '#4a3478' : (dith(x, y) < 0.3 && y < 96 - h2 + 4) ? '#3a2a68' : '#261c50');
  }
}
function far3(pb) {
  const r = mulberry(21);
  const draw = (x0, w, h, body, lit) => {
    for (let x = x0; x < x0 + w; x++) {
      const xx = ((x % 640) + 640) % 640;
      for (let y = 96 - h; y < 96; y++) pb.set(xx, y, x === x0 ? '#262a5a' : body);
    }
    for (let y = 96 - h + 3; y < 94; y += 3) for (let x = x0 + 2; x < x0 + w - 1; x += 2) if (r() < lit) pb.set(((x % 640) + 640) % 640, y, ['#ffd86a', '#6af4ff', '#ff6ad8', '#fff0c0'][Math.floor(r() * 4)]);
    if (r() < 0.3) { const ax = ((x0 + (w >> 1)) % 640); for (let y = 96 - h - 8; y < 96 - h; y++) pb.set(ax, y, '#262a5a'); pb.set(ax, 96 - h - 9, '#ff3030'); }
  };
  let x = 0;
  while (x < 640) { const w = 10 + Math.floor(r() * 22); draw(x, w, 26 + Math.floor(r() * 50), '#161a44', 0.18); x += w - 2; }
  x = 5;
  while (x < 640) { const w = 12 + Math.floor(r() * 26); draw(x, w, 12 + Math.floor(r() * 30), '#0c0e2c', 0.25); x += w + Math.floor(r() * 6); }
}
function near1(pb) {
  const f = periodic(14, [[3, 1], [4, 0.6], [9, 0.3], [17, 0.12]]);
  for (let x = 0; x < 640; x++) {
    const v = f(x);
    const h = v > 0.3 ? Math.floor((v - 0.3) * 18) : 0;
    for (let y = 56 - h; y < 56; y++) pb.set(x, y, y === 56 - h ? '#8a4a6a' : '#3e2042');
  }
  // palm silhouettes on the dunes
  const r = mulberry(15);
  for (let i = 0; i < 7; i++) {
    const bx = Math.floor(r() * 640), hh = 24 + Math.floor(r() * 16);
    for (let y = 0; y < hh; y++) { const xx = bx + Math.round(Math.sin(y / hh * 1.4) * 4); pb.set(((xx % 640) + 640) % 640, 55 - y, '#2a1430'); pb.set(((xx + 1) % 640 + 640) % 640, 55 - y, '#2a1430'); }
    const tx = bx + Math.round(Math.sin(1.4) * 4), ty = 55 - hh;
    for (let a = 0; a < 7; a++) {
      const ang = -Math.PI + a * Math.PI / 6;
      for (let s = 0; s < 10; s++) { const x = tx + Math.cos(ang) * s, y = ty + Math.sin(ang) * s * 0.6 + s * s * 0.05; pb.set(((Math.round(x) % 640) + 640) % 640, y, '#2a1430'); }
    }
  }
}
function near2(pb) {
  const r = mulberry(17);
  const base = periodic(18, [[2, 1], [5, 0.5]]);
  for (let x = 0; x < 640; x++) { const h = Math.floor(8 + base(x) * 4); for (let y = 56 - h; y < 56; y++) pb.set(x, y, '#140e26'); }
  for (let i = 0; i < 70; i++) {
    const cx = Math.floor(r() * 640), h = 14 + Math.floor(r() * 30), hw = 3 + h * 0.22;
    for (let y = 56 - h; y < 56; y++) {
      const t = (y - (56 - h)) / h;
      const w = hw * t * (0.8 + 0.2 * ((y % 4) / 4));
      for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) pb.set(((x % 640) + 640) % 640, y, x === Math.round(cx - w) ? '#2a2044' : '#0e1622');
    }
  }
}
function near3(pb) {
  const r = mulberry(27);
  let x = 0;
  while (x < 640) {
    const w = 18 + Math.floor(r() * 30), h = 18 + Math.floor(r() * 34);
    for (let xx = x; xx < x + w; xx++) for (let y = 56 - h; y < 56; y++) pb.set(((xx % 640) + 640) % 640, y, xx === x ? '#1a1a3a' : '#07081a');
    if (r() < 0.55) {
      const sw = 8 + Math.floor(r() * 10), sx = x + 3 + Math.floor(r() * Math.max(1, w - sw - 5)), sy = 56 - h + 4;
      const c = ['#ff3cc8', '#6af4ff', '#ffd040'][Math.floor(r() * 3)];
      for (let xx = sx; xx < sx + sw; xx++) { pb.set(((xx % 640) + 640) % 640, sy, c); pb.set(((xx % 640) + 640) % 640, sy + 3, c); }
      pb.set(((sx % 640) + 640) % 640, sy + 1, c); pb.set(((sx % 640) + 640) % 640, sy + 2, c);
      pb.set((((sx + sw - 1) % 640) + 640) % 640, sy + 1, c); pb.set((((sx + sw - 1) % 640) + 640) % 640, sy + 2, c);
    }
    for (let y = 56 - h + 10; y < 54; y += 4) for (let xx = x + 3; xx < x + w - 2; xx += 4) if (r() < 0.2) pb.set(((xx % 640) + 640) % 640, y, '#ffd86a');
    x += w + Math.floor(r() * 4);
  }
}

// ---------- logo ----------
function logo(pb) {
  // big letters: glyphs scaled 4 horiz x 5 vert, italic skew, gradient + stripes, outline + shadow
  const words = 'SUNSET RUSH';
  const sx = 4, sy = 5, ox = 10, oy = 3;
  const mask = new PB(pb.w, pb.h);
  let cx = ox;
  for (const ch of words) {
    const g = GLYPHS[ch];
    for (let r = 0; r < GH; r++) for (let q = 0; q < GW; q++) if (g[r][q] === '#') {
      for (let yy = 0; yy < sy; yy++) for (let xx = 0; xx < sx; xx++) {
        const y = oy + r * sy + yy;
        const skew = Math.floor((oy + GH * sy - y) / 4);
        mask.set(cx + q * sx + xx + skew, y, '#ffffff');
      }
    }
    cx += ADV * sx + 1;
  }
  const grad = ['#fff6b0', '#ffe070', '#ffc048', '#ff9a40', '#ff6a50', '#ff4a78', '#e0308a'];
  // shadow
  for (let y = 0; y < pb.h; y++) for (let x = 0; x < pb.w; x++) if (mask.on(x - 3, y - 3)) pb.set(x, y, '#2a0a3a');
  // outline
  for (let y = 0; y < pb.h; y++) for (let x = 0; x < pb.w; x++) {
    if (mask.on(x, y)) continue;
    let n = false;
    for (let dy = -2; dy <= 2 && !n; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2 && mask.on(x + dx, y + dy)) { n = true; break; }
    if (n) pb.set(x, y, '#4a1050');
  }
  for (let y = 0; y < pb.h; y++) for (let x = 0; x < pb.w; x++) if (mask.on(x, y)) {
    const t = (y - oy) / (GH * sy);
    const i = Math.max(0, Math.min(grad.length - 1, Math.floor(t * grad.length + (dith(x, y) - 0.5))));
    let c = grad[i];
    if (t > 0.5 && ((y - oy) % 5) === 0) c = '#a01860'; // synthwave slits
    if (!mask.on(x, y - 1)) c = '#ffffff';
    pb.set(x, y, c);
  }
  // speed streaks
  for (const [y, x0, x1] of [[oy + 30, 0, 8], [oy + 22, 2, 8], [oy + 14, 4, 8]]) pb.hline(x0, x1, y, '#ff9a40');
  for (let x = 20; x < pb.w - 10; x++) pb.set(x, pb.h - 3, x % 3 ? '#ff4a78' : '#ffc048');
}

// ---------- registry ----------
export const ASSET_INFO = {
  car_player: { w: 40, h: 22, worldW: 0.25 },
  car_player_brake: { w: 40, h: 22, worldW: 0.25 },
  car_player_wheel: { w: 40, h: 22, worldW: 0.25 },
  car_sedan: { w: 36, h: 20, worldW: 0.225, hit: 0.10 },
  car_truck: { w: 44, h: 34, worldW: 0.275, hit: 0.13 },
  car_sports: { w: 38, h: 18, worldW: 0.2375, hit: 0.10 },
  rs_palm: { w: 40, h: 72, worldW: 0.50, hit: 0.10 },
  rs_rock: { w: 32, h: 22, worldW: 0.36, hit: 0.14 },
  rs_shrub: { w: 32, h: 20, worldW: 0.40 },
  rs_pine: { w: 40, h: 88, worldW: 0.50, hit: 0.09 },
  rs_boulder: { w: 40, h: 28, worldW: 0.45, hit: 0.16 },
  rs_fern: { w: 28, h: 16, worldW: 0.35 },
  rs_lamp: { w: 20, h: 88, worldW: 0.22, hit: 0.05 },
  rs_neon: { w: 56, h: 52, worldW: 0.70, hit: 0.18 },
  rs_building: { w: 64, h: 128, worldW: 1.60 },
  rs_billboard: { w: 48, h: 56, worldW: 0.60, hit: 0.16 },
  rs_signpost: { w: 20, h: 44, worldW: 0.24, hit: 0.06 },
  rs_bollard: { w: 12, h: 16, worldW: 0.14, hit: 0.05 },
  rs_building_b: { w: 64, h: 112, worldW: 1.40 },
  gate_checkpoint: { w: 160, h: 64, worldW: 2.6 },
  gate_goal: { w: 160, h: 64, worldW: 2.6 },
  gate_start: { w: 160, h: 64, worldW: 2.6 },
};

export function buildAssets() {
  const A = {};
  const turns = [0, -1, 1];
  A.car_player = sheet(40, 22, 3, (pb, i) => playerCar(pb, turns[i], false, 0));
  A.car_player_brake = sheet(40, 22, 3, (pb, i) => playerCar(pb, turns[i], true, 0));
  A.car_player_wheel = sheet(40, 22, 6, (pb, i) => playerCar(pb, turns[i >> 1], false, i & 1));
  // traffic: frame 0 is the base colour, extra frames are colour variants
  A.car_sedan = sheet(36, 20, 3, (pb, i) => sedan(pb, SEDAN_PALS[i]));
  A.car_truck = sheet(44, 34, 3, (pb, i) => truck(pb, TRUCK_PALS[i]));
  A.car_sports = sheet(38, 18, 3, (pb, i) => sports(pb, SPORTS_PALS[i]));
  A.rs_palm = sheet(40, 72, 1, palm);
  A.rs_rock = sheet(32, 22, 1, rock);
  A.rs_shrub = sheet(32, 20, 1, shrub);
  A.rs_billboard = sheet(48, 56, 1, billboard);
  A.rs_pine = sheet(40, 88, 1, pine);
  A.rs_boulder = sheet(40, 28, 1, boulder);
  A.rs_fern = sheet(28, 16, 1, fern);
  A.rs_signpost = sheet(20, 44, 1, signpost);
  A.rs_lamp = sheet(20, 88, 1, lamp);
  A.rs_neon = sheet(56, 52, 1, neon);
  A.rs_building = sheet(64, 128, 1, (pb) => building(pb, 101, 128, 0));
  A.rs_building_b = sheet(64, 112, 1, (pb) => building(pb, 202, 112, 1));
  A.rs_bollard = sheet(12, 16, 1, bollard);
  A.gate_checkpoint = sheet(160, 64, 1, (pb) => gate(pb, 'cp'));
  A.gate_goal = sheet(160, 64, 1, (pb) => gate(pb, 'goal'));
  A.gate_start = sheet(160, 64, 1, (pb) => gate(pb, 'start'));
  A.bg_sky_1 = sheet(640, 180, 1, sky1);
  A.bg_sky_2 = sheet(640, 180, 1, sky2);
  A.bg_sky_3 = sheet(640, 180, 1, sky3);
  A.bg_far_1 = sheet(640, 96, 1, far1);
  A.bg_far_2 = sheet(640, 96, 1, far2);
  A.bg_far_3 = sheet(640, 96, 1, far3);
  A.bg_near_1 = sheet(640, 56, 1, near1);
  A.bg_near_2 = sheet(640, 56, 1, near2);
  A.bg_near_3 = sheet(640, 56, 1, near3);
  A.logo_title = sheet(300, 48, 1, logo);
  A.fx_smoke = sheet(12, 12, 4, smoke);
  A.fx_dust = sheet(8, 8, 3, dust);
  A.fx_spark = sheet(6, 6, 3, spark);
  // glow sprite for night lights (not a spec asset; helper)
  A._glow = sheet(16, 16, 1, (pb) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8) / 8; if (d < 1 && dith(x, y) < (1 - d) * 1.1) pb.set(x, y, '#ffffff'); } });
  return A;
}

export const GALLERY_ORDER = [
  'car_player', 'car_player_brake', 'car_player_wheel', 'car_sedan', 'car_truck', 'car_sports',
  'rs_palm', 'rs_rock', 'rs_shrub', 'rs_billboard', 'rs_pine', 'rs_boulder', 'rs_fern', 'rs_signpost',
  'rs_lamp', 'rs_neon', 'rs_building', 'rs_building_b', 'rs_bollard',
  'gate_checkpoint', 'gate_goal', 'gate_start',
  'bg_sky_1', 'bg_sky_2', 'bg_sky_3', 'bg_far_1', 'bg_far_2', 'bg_far_3', 'bg_near_1', 'bg_near_2', 'bg_near_3',
  'logo_title', 'fx_smoke', 'fx_dust', 'fx_spark',
];
export { GLYPH_ORDER };
