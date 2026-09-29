// All pixel art is drawn from code at startup (self-made, no external files).
export const ASSETS = {};

function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function ell(g, cx, cy, rx, ry, c) {
  g.fillStyle = c;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.0001))));
    g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
  }
}
function tri(g, cx, top, bot, hw, c) {
  g.fillStyle = c;
  for (let y = top; y < bot; y++) { const w = Math.max(1, Math.round(hw * (y - top + 1) / (bot - top))); g.fillRect(Math.round(cx - w), y, w * 2, 1); }
}
function line(g, x0, y0, x1, y1, c, th) {
  g.fillStyle = c;
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), th, th);
}
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = Math.imul(n, 9); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; }
function reg(id, canvas, frames, fw, fh) { ASSETS[id] = { id, canvas, frames, fw, fh }; return ASSETS[id]; }
function make(id, w, h, frames, fn) {
  const c = cv(w * frames, h); const g = c.getContext('2d');
  for (let f = 0; f < frames; f++) fn(g, f * w, f, w, h);
  return reg(id, c, frames, w, h);
}
function lerpC(a, b, t) {
  const pa = hex(a), pb = hex(b);
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
export function hex(s) { return [parseInt(s.substr(1, 2), 16), parseInt(s.substr(3, 2), 16), parseInt(s.substr(5, 2), 16)]; }

// ---------------- font ----------------
const GLYPHS = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 27, 17], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 19, 21, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [30, 1, 1, 14, 1, 1, 30],
  4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], ':': [0, 12, 12, 0, 12, 12, 0], '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4], '+': [0, 4, 4, 31, 4, 4, 0], '-': [0, 0, 0, 31, 0, 0, 0], '/': [1, 1, 2, 4, 8, 16, 16],
  '%': [25, 25, 2, 4, 8, 19, 19], "'": [4, 4, 8, 0, 0, 0, 0], '[': [14, 8, 8, 8, 8, 8, 14], ']': [14, 2, 2, 2, 2, 2, 14],
  '<': [2, 4, 8, 16, 8, 4, 2], '>': [8, 4, 2, 1, 2, 4, 8], '=': [0, 0, 31, 0, 31, 0, 0], ' ': [0, 0, 0, 0, 0, 0, 0],
};
const GLYPH_ORDER = Object.keys(GLYPHS);
const tinted = {};
function fontSheet(color) {
  if (tinted[color]) return tinted[color];
  const c = cv(GLYPH_ORDER.length * 5, 7), g = c.getContext('2d');
  g.fillStyle = color;
  GLYPH_ORDER.forEach((ch, i) => GLYPHS[ch].forEach((row, y) => { for (let x = 0; x < 5; x++) if (row & (16 >> x)) g.fillRect(i * 5 + x, y, 1, 1); }));
  return (tinted[color] = c);
}
export function textWidth(s, sc) { return s.length * 6 * sc - sc; }
export function drawText(g, str, x, y, sc, color = '#fff', align = 'l', outline = null) {
  str = String(str).toUpperCase();
  const w = textWidth(str, sc);
  if (align === 'c') x -= Math.floor(w / 2); else if (align === 'r') x -= w;
  x = Math.round(x); y = Math.round(y);
  const pass = (col, ox, oy) => {
    const sh = fontSheet(col);
    for (let i = 0; i < str.length; i++) {
      const gi = GLYPH_ORDER.indexOf(str[i]); if (gi < 0 || str[i] === ' ') continue;
      g.drawImage(sh, gi * 5, 0, 5, 7, x + i * 6 * sc + ox, y + oy, 5 * sc, 7 * sc);
    }
  };
  if (outline) { for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) pass(outline, ox * sc, oy * sc); }
  pass(color, 0, 0);
}
function buildFont() {
  const c = cv(GLYPH_ORDER.length * 5, 7); c.getContext('2d').drawImage(fontSheet('#ffffff'), 0, 0);
  reg('font_pixel', c, GLYPH_ORDER.length, 5, 7);
}

// ---------------- cars ----------------
function carBack(g, ox, w, h, p, o = {}) {
  const lean = o.lean || 0, cabinR = o.cabin || 0.42;
  const wh = Math.round(h * 0.34), ww = Math.max(4, Math.round(w * 0.13));
  R(g, ox + 1, h - wh, ww, wh, '#101018'); R(g, ox + w - 1 - ww, h - wh, ww, wh, '#101018');
  const bt = Math.round(h * cabinR);
  R(g, ox + 2, bt, w - 4, h - bt - 2, p.body);
  R(g, ox + 2, bt, w - 4, 2, p.hi);
  R(g, ox + 3, h - 5, w - 6, 3, p.dark);
  const cx0 = ox + Math.round(w * 0.2) + lean, cw = Math.round(w * 0.6);
  R(g, cx0, 1, cw, bt, p.body); R(g, cx0, 1, cw, 1, p.hi);
  R(g, cx0 + 2, 3, cw - 4, Math.max(3, bt - 4), p.glass); R(g, cx0 + 2, 3, cw - 4, 1, p.glassHi);
  const tl = o.brake ? '#fff2a0' : p.tail;
  if (o.brake) { R(g, ox + 1, bt + 1, ww + 2, 5, '#ff6070'); R(g, ox + w - 3 - ww, bt + 1, ww + 2, 5, '#ff6070'); }
  R(g, ox + 3, bt + 2, ww, 3, tl); R(g, ox + w - 3 - ww, bt + 2, ww, 3, tl);
  R(g, ox + w / 2 - 3, bt + 4, 6, 3, '#eeeeee'); R(g, ox + w / 2 - 3, bt + 4, 6, 1, '#bbbbbb');
  R(g, ox + 6, h - 3, 3, 2, '#333'); R(g, ox + w - 9, h - 3, 3, 2, '#333');
}
const PAL = {
  red: { body: '#e8302c', hi: '#ff7a5c', dark: '#8a1418', glass: '#28304a', glassHi: '#6a86b8', tail: '#ff2030' },
  blue: { body: '#2c5ce8', hi: '#7aa0ff', dark: '#142a8a', glass: '#1c2438', glassHi: '#7a96c8', tail: '#ff2030' },
  yellow: { body: '#f0c020', hi: '#fff080', dark: '#a07808', glass: '#28304a', glassHi: '#6a86b8', tail: '#ff2030' },
  white: { body: '#e8e8f0', hi: '#ffffff', dark: '#8a8aa0', glass: '#28304a', glassHi: '#6a86b8', tail: '#ff2030' },
  green: { body: '#28b060', hi: '#78e8a0', dark: '#106030', glass: '#1c2438', glassHi: '#7a96c8', tail: '#ff2030' },
  cyan: { body: '#20c8d8', hi: '#90f4ff', dark: '#087080', glass: '#28304a', glassHi: '#6a86b8', tail: '#ff2030' },
  purple: { body: '#9048d8', hi: '#c898ff', dark: '#502090', glass: '#1c2438', glassHi: '#7a96c8', tail: '#ff2030' },
  orange: { body: '#f07820', hi: '#ffb060', dark: '#983c08', glass: '#28304a', glassHi: '#6a86b8', tail: '#ff2030' },
};
function truckBack(g, ox, w, h, p) {
  R(g, ox + 1, h - 10, 6, 10, '#101018'); R(g, ox + w - 7, h - 10, 6, 10, '#101018');
  R(g, ox + 2, 0, w - 4, h - 9, p.body); R(g, ox + 2, 0, w - 4, 2, p.hi);
  R(g, ox + 2, h - 13, w - 4, 4, p.dark);
  for (let x = 9; x < w - 6; x += 9) R(g, ox + x, 3, 1, h - 17, p.dark);
  R(g, ox + 2, Math.round(h * 0.3), w - 4, 3, p.hi);
  R(g, ox + 4, h - 9, w - 8, 5, '#2a2a34');
  R(g, ox + 3, h - 12, 5, 3, p.tail); R(g, ox + w - 8, h - 12, 5, 3, p.tail);
  R(g, ox + w / 2 - 3, h - 9, 6, 3, '#eee');
}
function buildCars() {
  make('car_player', 40, 22, 3, (g, ox, f) => carBack(g, ox, 40, 22, PAL.red, { lean: f === 1 ? -2 : f === 2 ? 2 : 0 }));
  make('car_player_brake', 40, 22, 3, (g, ox, f) => carBack(g, ox, 40, 22, PAL.red, { lean: f === 1 ? -2 : f === 2 ? 2 : 0, brake: true }));
  const sets = { sedan: [36, 20, ['blue', 'yellow', 'white'], 0.42], sports: [38, 18, ['yellow', 'cyan', 'purple'], 0.5] };
  for (const k in sets) {
    const [w, h, pals, cab] = sets[k];
    pals.forEach((pn, i) => make(i === 0 ? 'car_' + k : `car_${k}_alt${i}`, w, h, 1, (g, ox) => carBack(g, ox, w, h, PAL[pn], { cabin: cab })));
  }
  ['white', 'orange', 'green'].forEach((pn, i) => make(i === 0 ? 'car_truck' : `car_truck_alt${i}`, 44, 34, 1, (g, ox) => truckBack(g, ox, 44, 34, PAL[pn])));
}

// ---------------- roadside ----------------
function buildRoadside() {
  make('rs_palm', 40, 72, 1, (g) => {
    for (let y = 26; y < 72; y++) { const x = 18 + Math.round(3 * Math.sin((72 - y) / 18)); R(g, x, y, 5, 1, y % 5 === 0 ? '#5a3418' : '#8a5a30'); R(g, x, y, 1, 1, '#a87840'); }
    const cx = 21, cy = 26;
    [[2, 36], [6, 20], [16, 12], [26, 12], [35, 20], [39, 36]].forEach(([tx, ty], i) => {
      const mx = (cx + tx) / 2, my = Math.min(cy, ty) - 6;
      line(g, cx, cy, mx, my, i % 2 ? '#1c7a3c' : '#2a9a4c', 3); line(g, mx, my, tx, ty, i % 2 ? '#166030' : '#1c7a3c', 2);
    });
    ell(g, cx, cy + 1, 3, 3, '#5a3418'); R(g, cx - 2, cy + 2, 2, 2, '#c89040'); R(g, cx + 1, cy + 2, 2, 2, '#c89040');
  });
  make('rs_rock', 32, 22, 1, (g) => {
    ell(g, 16, 14, 15, 8, '#4a3c48'); ell(g, 14, 11, 12, 8, '#7a6a72'); ell(g, 12, 9, 7, 4, '#a89aa0');
    R(g, 20, 12, 8, 2, '#5a4c56'); R(g, 4, 18, 24, 3, '#382c38'); R(g, 10, 6, 4, 1, '#d0c4c8');
  });
  make('rs_shrub', 32, 20, 1, (g) => {
    ell(g, 16, 13, 15, 7, '#1c6a34'); ell(g, 10, 10, 8, 6, '#2c8a44'); ell(g, 21, 9, 8, 6, '#38a050'); ell(g, 15, 6, 6, 4, '#58c068');
    [[6, 9], [14, 4], [24, 8], [19, 13], [9, 14]].forEach(([x, y]) => { R(g, x, y, 2, 2, '#ff70a0'); R(g, x, y, 1, 1, '#fff0f4'); });
    R(g, 2, 18, 28, 2, '#124a24');
  });
  make('rs_pine', 40, 88, 1, (g) => {
    R(g, 18, 74, 4, 14, '#4a2c18'); R(g, 18, 74, 1, 14, '#6a4428');
    [[4, 34, 19], [22, 54, 16], [40, 72, 13]].forEach(([t, b, hw], i) => {
      tri(g, 20, t + 0, b + 6, hw + 2, '#0e4a2a'); tri(g, 20, t, b + 6, hw - 3, '#186a3a');
      for (let y = t; y < b + 6; y++) { const w = Math.max(1, Math.round((hw + 2) * (y - t + 1) / (b + 6 - t))); R(g, 20 - w, y, Math.max(1, Math.round(w / 3)), 1, '#2a8a4c'); }
    });
    tri(g, 20, 0, 8, 4, '#186a3a');
  });
  make('rs_boulder', 40, 28, 1, (g) => {
    ell(g, 20, 18, 19, 10, '#3a3248'); ell(g, 18, 14, 16, 10, '#6a6480'); ell(g, 14, 10, 9, 5, '#9a94b0');
    R(g, 22, 8, 1, 10, '#3a3248'); R(g, 23, 17, 6, 1, '#3a3248'); ell(g, 30, 9, 4, 2, '#3a7048'); R(g, 3, 25, 34, 3, '#2a2438');
  });
  make('rs_fern', 28, 16, 1, (g) => {
    const cx = 14, cy = 15;
    [[1, 6], [5, 1], [14, -1], [23, 1], [27, 6], [9, 3], [19, 3]].forEach(([tx, ty], i) => {
      line(g, cx, cy, tx, ty + 3, i % 2 ? '#2a6a34' : '#3a8a44', 2);
      for (let k = 2; k < 6; k++) { const x = cx + (tx - cx) * k / 6, y = cy + (ty + 3 - cy) * k / 6; R(g, x - 2, y, 1, 1, '#58b060'); R(g, x + 2, y, 1, 1, '#58b060'); }
    });
  });
  make('rs_lamp', 20, 88, 1, (g) => {
    R(g, 9, 8, 3, 78, '#4a4a60'); R(g, 9, 8, 1, 78, '#7a7a98'); R(g, 6, 82, 9, 6, '#34344a');
    R(g, 3, 4, 10, 3, '#4a4a60'); R(g, 1, 6, 8, 3, '#fff0a0'); R(g, 0, 8, 10, 2, '#ffd060');
    ell(g, 5, 10, 4, 3, 'rgba(255,220,120,0.35)');
  });
  make('rs_neon', 56, 52, 1, (g) => {
    R(g, 10, 36, 3, 16, '#2a2a40'); R(g, 43, 36, 3, 16, '#2a2a40');
    R(g, 0, 0, 56, 38, '#ff30c0'); R(g, 2, 2, 52, 34, '#180828');
    R(g, 4, 4, 48, 30, '#3a0a52');
    for (let i = 0; i < 4; i++) line(g, 8 + i * 12, 30, 16 + i * 12, 8, i % 2 ? '#30f0ff' : '#ff60d0', 3);
    R(g, 6, 5, 44, 2, '#30f0ff'); R(g, 6, 31, 44, 2, '#30f0ff');
  });
  const windows = (g, w, h, seed, top) => {
    for (let y = top; y < h - 6; y += 6) for (let x = 5; x < w - 6; x += 7) {
      const r = hash(seed + x * 31 + y * 7);
      R(g, x, y, 4, 3, r < 0.5 ? '#ffe070' : r < 0.7 ? '#40e8f0' : r < 0.8 ? '#ff60c8' : '#1c1c3c');
    }
  };
  make('rs_building', 64, 128, 1, (g) => {
    R(g, 0, 8, 64, 120, '#161634'); R(g, 0, 8, 3, 120, '#2a2a58'); R(g, 61, 8, 3, 120, '#0c0c22');
    R(g, 20, 0, 24, 8, '#1e1e44'); R(g, 31, -0, 2, 3, '#ff2050');
    windows(g, 64, 128, 11, 14); R(g, 24, 112, 16, 16, '#0a0a18'); R(g, 26, 114, 12, 2, '#30f0ff');
  });
  make('rs_building_b', 64, 112, 1, (g) => {
    R(g, 6, 20, 52, 92, '#22143e'); R(g, 0, 50, 64, 62, '#1a1030'); R(g, 14, 6, 36, 14, '#2a1a4c');
    R(g, 6, 20, 52, 2, '#ff30c0'); R(g, 0, 50, 64, 2, '#30f0ff');
    windows(g, 64, 112, 77, 26); R(g, 30, 0, 2, 6, '#8a8aa8');
  });
  make('rs_billboard', 48, 56, 1, (g) => {
    R(g, 21, 30, 5, 26, '#5a4a48'); R(g, 0, 0, 48, 32, '#3a2a30'); R(g, 2, 2, 44, 28, '#ffb060');
    ell(g, 34, 22, 9, 9, '#ff5070'); R(g, 2, 22, 44, 8, '#3aa0a8'); drawText(g, 'SUN', 6, 6, 2, '#5a2030');
  });
  make('rs_signpost', 20, 44, 1, (g) => {
    R(g, 9, 14, 3, 30, '#6a6a80'); R(g, 1, 0, 18, 16, '#f0c020'); R(g, 3, 2, 14, 12, '#2a2a30'); R(g, 5, 9, 10, 2, '#f0c020'); R(g, 8, 4, 4, 4, '#f0c020');
  });
  make('rs_bollard', 12, 16, 1, (g) => {
    R(g, 1, 2, 10, 14, '#e8e8f0'); R(g, 1, 6, 10, 3, '#e83040'); R(g, 1, 12, 10, 2, '#e83040'); R(g, 3, 0, 6, 3, '#ffd050'); R(g, 1, 2, 1, 14, '#fff');
  });
}

function buildGates() {
  const post = (g, x, c1, c2) => { for (let y = 8; y < 64; y++) R(g, x, y, 10, 1, Math.floor(y / 6) % 2 ? c1 : c2); };
  make('gate_checkpoint', 160, 64, 1, (g) => {
    post(g, 6, '#f0c020', '#202028'); post(g, 144, '#f0c020', '#202028');
    R(g, 0, 0, 160, 24, '#202028'); R(g, 2, 2, 156, 20, '#f0c020'); R(g, 4, 4, 152, 16, '#2a2a34');
    drawText(g, 'CHECKPOINT', 80, 6, 2, '#ffe860', 'c');
    for (let x = 4; x < 156; x += 8) R(g, x, 20, 4, 2, '#f0c020');
  });
  make('gate_goal', 160, 64, 1, (g) => {
    post(g, 6, '#ffffff', '#202028'); post(g, 144, '#ffffff', '#202028');
    for (let y = 0; y < 24; y += 4) for (let x = 0; x < 160; x += 4) R(g, x, y, 4, 4, ((x + y) / 4) % 2 ? '#111118' : '#f4f4f8');
    R(g, 44, 4, 72, 16, '#e02838'); R(g, 44, 4, 72, 1, '#ff8090'); drawText(g, 'GOAL', 80, 6, 2, '#fff', 'c');
  });
  make('gate_start', 160, 64, 1, (g) => {
    post(g, 6, '#30c0e0', '#202028'); post(g, 144, '#30c0e0', '#202028');
    R(g, 0, 0, 160, 24, '#202028'); R(g, 2, 2, 156, 20, '#30c0e0'); R(g, 4, 4, 152, 16, '#14202a');
    drawText(g, 'START', 80, 6, 2, '#a0f0ff', 'c');
  });
}

// ---------------- backgrounds ----------------
const SKY = {
  1: ['#3a2a78', '#b83c82', '#ff8a4c', '#ffd08a'],
  2: ['#180e3c', '#40287a', '#9a4a8c', '#e88a7a'],
  3: ['#02020a', '#0a1030', '#1a1a56', '#4a1a6c'],
};
export const HORIZON = { 1: '#ffd08a', 2: '#e88a7a', 3: '#4a1a6c' };
function skyGrad(g, stops) {
  for (let y = 0; y < 180; y += 3) {
    const t = y / 179 * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(t));
    R(g, 0, y, 640, 3, lerpC(stops[i], stops[i + 1], t - i));
  }
}
function wrapEll(g, x, y, rx, ry, c) { ell(g, x, y, rx, ry, c); ell(g, x - 640, y, rx, ry, c); ell(g, x + 640, y, rx, ry, c); }
function buildBackgrounds() {
  make('bg_sky_1', 640, 180, 1, (g) => {
    skyGrad(g, SKY[1]);
    ell(g, 440, 150, 36, 36, '#fff0b0'); ell(g, 440, 150, 30, 30, '#ffe070');
    for (let y = 132; y < 180; y += 6) R(g, 400, y, 80, y > 150 ? 2 : 1, lerpC('#ffb060', '#ff8a4c', (y - 132) / 48));
    [[80, 40, 46, 5], [230, 70, 60, 6], [360, 30, 40, 4], [560, 55, 50, 5], [500, 100, 44, 4], [130, 110, 50, 4]].forEach(([x, y, rx, ry]) => {
      wrapEll(g, x, y, rx, ry, '#ff8aa0'); wrapEll(g, x + 6, y - 2, rx - 8, ry - 2, '#ffc0b0');
    });
  });
  make('bg_sky_2', 640, 180, 1, (g) => {
    skyGrad(g, SKY[2]);
    for (let i = 0; i < 50; i++) R(g, hash(i * 3) * 640, hash(i * 3 + 1) * 70, 1, 1, '#e8e0ff');
    ell(g, 220, 160, 24, 24, '#ff8a50'); ell(g, 220, 160, 19, 19, '#ffb060');
    [[100, 60, 70, 4], [420, 46, 80, 5], [560, 96, 50, 3]].forEach(([x, y, rx, ry]) => wrapEll(g, x, y, rx, ry, '#7a3a90'));
  });
  make('bg_sky_3', 640, 180, 1, (g) => {
    skyGrad(g, SKY[3]);
    for (let i = 0; i < 110; i++) { const x = hash(i * 5) * 640, y = hash(i * 5 + 1) * 120; R(g, x, y, 1, 1, i % 7 === 0 ? '#ffffff' : '#8a90d0'); if (i % 13 === 0) { R(g, x - 1, y, 3, 1, '#c0c8ff'); R(g, x, y - 1, 1, 3, '#c0c8ff'); } }
    ell(g, 470, 48, 26, 26, '#e8ecff'); ell(g, 476, 44, 22, 22, '#fffff4');
    ell(g, 462, 54, 4, 3, '#c8ccec'); ell(g, 484, 40, 3, 3, '#c8ccec'); ell(g, 476, 62, 3, 2, '#c8ccec');
    ell(g, 470, 48, 40, 40, 'rgba(180,190,255,0.12)');
  });
  const TAU = Math.PI * 2;
  make('bg_far_1', 640, 96, 1, (g) => {
    for (let y = 52; y < 96; y += 2) R(g, 0, y, 640, 2, lerpC('#ff9a70', '#2a8a9a', (y - 52) / 44));
    for (let y = 52; y < 96; y += 3) { const w = 10 + hash(y) * 50; R(g, 400 + hash(y * 7) * 20, y, w, 1, '#ffe8a0'); }
    for (let i = 0; i < 40; i++) R(g, hash(i * 11) * 640, 56 + hash(i * 11 + 1) * 40, 6, 1, 'rgba(255,255,255,0.5)');
    [[90, 20, 46, 12], [180, 24, 24, 8], [330, 18, 64, 14], [560, 22, 34, 10]].forEach(([x, w, rx, ry]) => {
      wrapEll(g, x, 52, rx, ry, '#7a3a6a'); wrapEll(g, x + 5, 52, rx - 10, ry - 4, '#8a4a78');
    });
    R(g, 0, 51, 640, 1, '#ffe8b0');
  });
  make('bg_far_2', 640, 96, 1, (g) => {
    const ridge = (base, a, ph, col, hi) => {
      for (let x = 0; x < 640; x++) {
        const h = base + a * Math.sin(TAU * 2 * x / 640 + ph) + a * 0.55 * Math.sin(TAU * 5 * x / 640 + ph * 2) + a * 0.25 * Math.sin(TAU * 11 * x / 640 + ph * 3);
        const top = Math.round(96 - h); R(g, x, top, 1, 96 - top, col); R(g, x, top, 1, 2, hi);
      }
    };
    ridge(52, 16, 1, '#4a2a72', '#7a4a94'); ridge(34, 12, 3, '#2a1a56', '#4a3078');
    for (let i = 0; i < 64; i++) { const x = i * 10 + hash(i) * 6; const h = 34 + 12 * Math.sin(TAU * 2 * x / 640 + 3) + 6.6 * Math.sin(TAU * 5 * x / 640 + 6) + 3 * Math.sin(TAU * 11 * x / 640 + 9); tri(g, Math.round(x), Math.round(96 - h) - 7, Math.round(96 - h) + 2, 3, '#160e3a'); }
  });
  make('bg_far_3', 640, 96, 1, (g) => {
    let x = 0, i = 0;
    while (x < 640) {
      const w = Math.min(640 - x, 14 + Math.floor(hash(i) * 22)), h = 30 + Math.floor(hash(i + 100) * 46);
      R(g, x, 96 - h, w, h, '#1c1442'); R(g, x, 96 - h, w, 1, '#3a2a70');
      for (let wy = 96 - h + 4; wy < 92; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) { const r = hash(i * 977 + wx * 13 + wy); if (r < 0.35) R(g, wx, wy, 2, 2, r < 0.15 ? '#ffe070' : r < 0.25 ? '#30f0ff' : '#ff50c8'); }
      if (i % 5 === 2) { R(g, x + w / 2, 96 - h - 8, 1, 8, '#4a3a80'); R(g, x + w / 2, 96 - h - 9, 1, 1, '#ff2050'); }
      x += w; i++;
    }
    R(g, 0, 90, 640, 6, '#2a1250');
  });
  const nearMake = (n) => make('bg_near_' + n, 640, 56, 1, (g) => {
    if (n === 1) {
      for (let x = 0; x < 640; x++) { const h = 14 + 8 * Math.sin(TAU * 3 * x / 640 + 1) + 5 * Math.sin(TAU * 8 * x / 640); R(g, x, 56 - Math.round(h), 1, Math.round(h), '#6a2a52'); }
      for (let i = 0; i < 8; i++) { const x = 40 + i * 80; R(g, x, 12, 3, 44, '#3a1838'); line(g, x + 1, 12, x - 10, 20, '#3a1838', 3); line(g, x + 1, 12, x + 12, 20, '#3a1838', 3); line(g, x + 1, 12, x, 4, '#3a1838', 3); }
    } else if (n === 2) {
      for (let i = 0; i < 32; i++) { const h = 22 + Math.floor(hash(i + 50) * 24); tri(g, i * 20 + 10, 56 - h, 56, 9, '#0e2a26'); tri(g, i * 20 + 10, 56 - h, 56 - h / 2, 4, '#164036'); }
      R(g, 0, 50, 640, 6, '#0a1e1c');
    } else {
      for (let i = 0; i < 16; i++) {
        const x = i * 40, h = 24 + Math.floor(hash(i + 300) * 28);
        R(g, x + 2, 56 - h, 36, h, '#0a0a1e'); R(g, x + 2, 56 - h, 36, 1, i % 2 ? '#ff30c0' : '#30f0ff');
        for (let wy = 56 - h + 4; wy < 52; wy += 6) for (let wx = x + 5; wx < x + 34; wx += 6) if (hash(i * 71 + wx + wy * 5) < 0.3) R(g, wx, wy, 3, 3, '#ffd070');
      }
    }
  });
  [1, 2, 3].forEach(nearMake);
}

// ---------------- logo & fx ----------------
function buildLogo() {
  const W = 232, H = 50, sc = 3;
  const mask = cv(W, H), mg = mask.getContext('2d');
  drawText(mg, 'SUNSET RUSH', 12, 12, sc, '#ffffff');
  const md = mg.getImageData(0, 0, W, H).data;
  const c = cv(W, H), g = c.getContext('2d');
  // sun with stripes behind
  ell(g, 116, 30, 34, 22, '#ff5a70'); for (let y = 30; y < 52; y += 4) R(g, 70, y, 92, 1 + (y - 30) / 6 | 0, '#20102a');
  for (let i = 0; i < 4; i++) R(g, 6, 40 + i * 2, 220, 1, ['#30f0ff', '#ff30c0', '#ffd050', '#ff8a4c'][i]);
  const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && md[(y * W + x) * 4 + 3] > 0;
  const sh = (y) => Math.floor((H - y) / 6);
  const out = cv(W, H), og = out.getContext('2d');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let hit = false, solid = false;
    for (let dy = -2; dy <= 2 && !solid; dy++) for (let dx = -2; dx <= 2; dx++) if (on(x + dx - 0, y + dy)) { hit = true; }
    if (on(x, y)) solid = true;
    if (solid) {
      const t = (y - 12) / 21;
      og.fillStyle = t < 0.35 ? '#fff4a0' : t < 0.6 ? '#ffb040' : t < 0.85 ? '#ff5a70' : '#c02890';
      og.fillRect(x + sh(y), y, 1, 1);
    } else if (hit) { og.fillStyle = '#28083a'; og.fillRect(x + sh(y), y, 1, 1); }
  }
  g.drawImage(out, 0, 0);
  reg('logo_title', c, 1, W, H);
}
function buildFx() {
  make('fx_smoke', 12, 12, 4, (g, ox, f) => {
    const r = [2, 3, 4.5, 5.5][f], col = ['#e0e0e8', '#c0c0cc', '#a0a0b0', '#8a8a9c'][f];
    ell(g, ox + 6, 6, Math.round(r), Math.round(r), col); ell(g, ox + 5, 5, Math.max(1, Math.round(r - 1.5)), Math.max(1, Math.round(r - 1.5)), '#f4f4fa');
    if (f === 3) for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if ((x + y) % 2 === 0 && hash(x * 13 + y) < 0.5) { g.clearRect(ox + x, y, 1, 1); }
  });
}

export function buildAssets() {
  if (ASSETS.font_pixel) return;
  buildFont(); buildCars(); buildRoadside(); buildGates(); buildBackgrounds(); buildLogo(); buildFx();
}
