// All images are generated at startup from code (pixel drawing into offscreen canvases). No external files.
import { drawText, atlas, GLYPHS } from './font.js';
import { mulberry32 } from './course.js';

function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}
const R = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
const PX = (g, col, x, y) => R(g, col, Math.round(x), Math.round(y), 1, 1);

function disc(g, col, cx, cy, rx, ry) {
  g.fillStyle = col;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1);
    }
  }
}
function quad(g, col, x0, y0, cx, cy, x1, y1, th = 1, vertical = true) {
  g.fillStyle = col;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, u = 1 - t;
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
    const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
    if (vertical) g.fillRect(Math.round(x), Math.round(y), 1, th);
    else g.fillRect(Math.round(x), Math.round(y), th, 1);
  }
}
function sheet(fw, fh, n, fn) {
  const [c, g] = cv(fw * n, fh);
  for (let f = 0; f < n; f++) {
    g.save();
    g.translate(f * fw, 0);
    g.beginPath();
    g.rect(0, 0, fw, fh);
    g.clip();
    fn(g, f);
    g.restore();
  }
  return { canvas: c, frames: n, fw, fh };
}
function shearFrame(src, fw, fh, f, dir, amt) {
  // shift rows horizontally: top rows move more (leaning car)
  const [c, g] = cv(fw, fh);
  for (let y = 0; y < fh; y++) {
    const s = Math.round(dir * amt * (1 - y / (fh - 1)));
    g.drawImage(src, f * fw, y, fw, 1, s, y, fw, 1);
  }
  return c;
}

// ---------------------------------------------------------------- cars
function wheels(g, w, h, ww, wh) {
  for (const x of [0, w - ww]) {
    R(g, '#0c0c12', x, h - wh, ww, wh);
    R(g, '#3a3a48', x === 0 ? x + ww - 2 : x + 1, h - wh + 1, 1, wh - 2);
  }
}
function tail(g, x, y, w2, h2, on) {
  R(g, on ? '#ff3a2a' : '#b01818', x, y, w2, h2);
  R(g, on ? '#fff0d0' : '#ff6a5a', x + 1, y, Math.max(1, w2 - 2), 1);
  if (on) { R(g, 'rgba(255,60,40,0.45)', x - 1, y - 1, w2 + 2, h2 + 2); R(g, '#ff3a2a', x, y, w2, h2); R(g, '#fff0d0', x + 1, y, Math.max(1, w2 - 2), 1); }
}
function plate(g, x, y, w2) {
  R(g, '#e8e8dc', x, y, w2, 3);
  R(g, '#404050', x + 1, y + 1, w2 - 2, 1);
}
function sedan(g, w, h, p, on) {
  R(g, 'rgba(0,0,0,0.35)', 2, h - 2, w - 4, 2);
  wheels(g, w, h, 6, 7);
  R(g, p.dark, 2, 8, w - 4, 10);
  R(g, p.body, 2, 8, w - 4, 8);
  R(g, p.light, 3, 8, w - 6, 1);
  R(g, p.dark, 3, 15, w - 6, 3);
  R(g, p.body, 9, 0, 18, 2);
  R(g, p.light, 10, 0, 16, 1);
  R(g, p.body, 6, 2, 24, 6);
  R(g, '#243858', 8, 3, 20, 4);
  R(g, '#7fb4e8', 9, 3, 5, 1);
  R(g, '#5a88b8', 16, 4, 3, 1);
  R(g, p.dark, 6, 7, 24, 1);
  tail(g, 3, 10, 7, 3, on);
  tail(g, w - 10, 10, 7, 3, on);
  plate(g, 14, 12, 8);
  R(g, '#22222c', 8, 17, 3, 2);
  R(g, '#22222c', w - 11, 17, 3, 2);
}
function truck(g, w, h, p, on) {
  R(g, 'rgba(0,0,0,0.35)', 2, h - 2, w - 4, 2);
  wheels(g, w, h, 7, 9);
  R(g, p.cont, 3, 0, w - 6, 23);
  R(g, p.light, 3, 0, w - 6, 1);
  R(g, p.dark, 3, 7, w - 6, 1);
  R(g, p.dark, 3, 15, w - 6, 1);
  R(g, p.dark, w / 2 - 1, 0, 2, 23);
  R(g, p.dark, w - 5, 0, 2, 23);
  R(g, p.stripe, 3, 19, w - 6, 3);
  R(g, '#22222c', 5, 23, w - 10, 6);
  R(g, '#d8d8d0', 3, 24, w - 6, 4);
  for (let x = 3; x < w - 6; x += 6) R(g, '#d02828', x, 24, 3, 4);
  tail(g, 4, 25, 6, 3, on);
  tail(g, w - 10, 25, 6, 3, on);
  plate(g, w / 2 - 4, 28, 8);
  R(g, '#22222c', 9, 29, 26, 2);
}
function sports(g, w, h, p, on, cabinC = '#1c2a44') {
  R(g, 'rgba(0,0,0,0.35)', 2, h - 2, w - 4, 2);
  wheels(g, w, h, 7, 8);
  R(g, p.dark, 2, 7, w - 4, 9);
  R(g, p.body, 2, 7, w - 4, 6);
  R(g, p.light, 3, 7, w - 6, 1);
  R(g, p.body, 11, 1, w - 22, 1);
  R(g, p.body, 9, 2, w - 18, 5);
  R(g, cabinC, 11, 3, w - 22, 3);
  R(g, '#6a9ad0', 12, 3, 4, 1);
  R(g, p.dark, 3, 5, w - 6, 2);
  R(g, p.body, 3, 4, w - 6, 1);
  R(g, p.dark, 6, 5, 2, 3);
  R(g, p.dark, w - 8, 5, 2, 3);
  tail(g, 4, 9, 12, 2, on);
  tail(g, w - 16, 9, 12, 2, on);
  plate(g, w / 2 - 3, 11, 6);
  R(g, '#20202a', 2, 14, w - 4, 2);
}
function playerCar(g, w, h, on) {
  const p = { body: '#e8342c', dark: '#a01820', light: '#ff7a5a' };
  R(g, 'rgba(0,0,0,0.4)', 2, h - 2, w - 4, 2);
  wheels(g, w, h, 8, 9);
  R(g, p.dark, 3, 9, w - 6, 11);
  R(g, p.body, 3, 9, w - 6, 8);
  R(g, p.light, 4, 9, w - 8, 1);
  // cabin
  R(g, p.body, 12, 2, w - 24, 1);
  R(g, p.body, 10, 3, w - 20, 6);
  R(g, '#1a2844', 12, 4, w - 24, 4);
  R(g, '#7ab0e8', 13, 4, 5, 1);
  R(g, '#4c78b0', 21, 5, 4, 1);
  R(g, '#2a3450', w / 2 - 1, 4, 2, 4);
  // spoiler
  R(g, '#2a2a34', 4, 6, w - 8, 2);
  R(g, p.light, 4, 5, w - 8, 1);
  R(g, '#2a2a34', 8, 7, 3, 3);
  R(g, '#2a2a34', w - 11, 7, 3, 3);
  // lights
  tail(g, 5, 11, 10, 3, on);
  tail(g, w - 15, 11, 10, 3, on);
  R(g, '#2a0a10', 15, 11, w - 30, 3);
  plate(g, w / 2 - 4, 14, 8);
  R(g, '#20202a', 3, 17, w - 6, 3);
  R(g, '#3a3a48', 8, 19, 4, 2);
  R(g, '#3a3a48', w - 12, 19, 4, 2);
}

const SEDAN_P = [
  { body: '#3a78d8', dark: '#22489a', light: '#78b0ff' },
  { body: '#e8c020', dark: '#a08010', light: '#fff080' },
  { body: '#e4e4ee', dark: '#9898b0', light: '#ffffff' },
];
const TRUCK_P = [
  { cont: '#e4e4ee', dark: '#a0a0b4', light: '#ffffff', stripe: '#3a78d8' },
  { cont: '#d8642a', dark: '#8c3814', light: '#ff9a5a', stripe: '#f0e0b0' },
  { cont: '#2f9a68', dark: '#1a5c40', light: '#6ad8a0', stripe: '#e4e4ee' },
];
const SPORT_P = [
  { body: '#f0d020', dark: '#a88a10', light: '#fff490' },
  { body: '#20c4d4', dark: '#107888', light: '#80f0ff' },
  { body: '#ff5a9a', dark: '#b02860', light: '#ffa0c8' },
];

function carSheet(w, h, fn) { return sheet(w, h, 1, (g) => fn(g, w, h)); }

function playerSheet(brake) {
  const base = sheet(40, 22, 1, (g) => playerCar(g, 40, 22, brake));
  const s = sheet(40, 22, 3, (g, f) => {
    if (f === 0) g.drawImage(base.canvas, 0, 0);
    else g.drawImage(shearFrame(base.canvas, 40, 22, 0, f === 1 ? -1 : 1, 3), 0, 0);
  });
  // side frames: also nudge the wheels for a "steering" look
  return s;
}

// ---------------------------------------------------------------- roadside
function outlined(g, discs, base, light, dark, out) {
  for (const [cx, cy, rx, ry] of discs) disc(g, out, cx, cy, rx + 1, ry + 1);
  for (const [cx, cy, rx, ry] of discs) disc(g, dark, cx + 1, cy + 1, rx, ry);
  for (const [cx, cy, rx, ry] of discs) disc(g, base, cx, cy, rx - 0.5, ry - 0.5);
  for (const [cx, cy, rx, ry] of discs) disc(g, light, cx - rx * 0.25, cy - ry * 0.3, rx * 0.5, ry * 0.4);
}

function palm(g) {
  const cx = (t) => 18 + Math.round(5 * t * t + t);
  for (let y = 71; y >= 24; y--) {
    const t = (71 - y) / 47;
    const w = t < 0.12 ? 6 : t > 0.7 ? 3 : 4;
    const x0 = cx(t) - Math.floor(w / 2);
    R(g, '#8a5630', x0, y, w, 1);
    R(g, '#5a3220', x0 + w - 1, y, 1, 1);
    R(g, '#b07a48', x0, y, 1, 1);
    if ((y & 3) === 0) R(g, '#4a281a', x0, y, w, 1);
  }
  const P0 = [cx(1), 24];
  const ends = [[-21, 10], [-17, -6], [-8, -16], [2, -19], [12, -14], [17, -2], [16, 10]];
  for (const [dx, dy] of ends) {
    const c = [P0[0] + dx * 0.5, P0[1] + Math.min(dy, -8) - 8];
    quad(g, '#175a30', P0[0], P0[1] + 1, c[0], c[1] + 1, P0[0] + dx, P0[1] + dy + 2, 2);
    quad(g, '#37b048', P0[0], P0[1], c[0], c[1], P0[0] + dx, P0[1] + dy, 2);
    quad(g, '#7ad860', P0[0], P0[1] - 1, c[0], c[1] - 1, P0[0] + dx * 0.8, P0[1] + dy * 0.8 - 1, 1);
  }
  disc(g, '#5a3018', P0[0] - 2, 27, 2, 2);
  disc(g, '#5a3018', P0[0] + 2, 27, 2, 2);
  disc(g, '#7a4826', P0[0], 28, 2, 2);
}
function rock(g, w, h, base, light, dark, out, moss) {
  outlined(g, [[w * 0.36, h * 0.6, w * 0.34, h * 0.38], [w * 0.66, h * 0.66, w * 0.3, h * 0.3], [w * 0.5, h * 0.42, w * 0.28, h * 0.34]], base, light, dark, out);
  R(g, dark, 2, h - 3, w - 4, 2);
  R(g, out, 3, h - 1, w - 6, 1);
  g.fillStyle = dark;
  g.fillRect(Math.round(w * 0.55), Math.round(h * 0.4), 1, 4);
  g.fillRect(Math.round(w * 0.55) + 1, Math.round(h * 0.4) + 3, 2, 1);
  if (moss) { for (let i = 0; i < 12; i++) PX(g, moss, w * 0.3 + (i * 7) % 14, h * 0.28 + (i * 5) % 6); }
}
function shrub(g) {
  outlined(g, [[9, 13, 8, 6], [22, 13, 9, 6], [16, 9, 9, 7]], '#3a9a4a', '#7ad060', '#1e6a34', '#124a24');
  for (const [x, y] of [[8, 9], [13, 6], [20, 8], [25, 12], [11, 14], [18, 12]]) PX(g, '#ff8ab0', x, y);
  for (const [x, y] of [[12, 8], [22, 6], [6, 13]]) PX(g, '#ffe070', x, y);
}
function pine(g) {
  R(g, '#3a2214', 17, 76, 6, 12);
  R(g, '#6a4226', 17, 76, 2, 12);
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const top = 2 + i * 14, hgt = 24, hw0 = 6 + i * 3.6;
    for (let r = 0; r < hgt; r++) {
      const hw = Math.max(1, Math.round((hw0 * (r + 1)) / hgt));
      const y = top + r;
      R(g, '#0c3a26', 20 - hw - 1, y, hw * 2 + 2, 1);
      R(g, '#1c6a3e', 20 - hw, y, hw, 1);
      R(g, '#124c2e', 20, y, hw, 1);
      if (r > hgt - 4) R(g, '#0a2e1e', 20 - hw, y, hw * 2, 1);
      if (r % 5 === 2) PX(g, '#3aa860', 20 - hw + 1 + ((r * 3) % Math.max(1, hw)), y);
    }
  }
}
function fern(g) {
  const b = [14, 15];
  for (const [ex, ey] of [[1, 8], [5, 2], [10, 0], [14, -1], [18, 0], [23, 2], [27, 8]]) {
    const cxp = (b[0] + ex) / 2, cyp = Math.min(ey, 4) - 2;
    quad(g, '#1c6a34', b[0], b[1], cxp, cyp, ex, ey + 4, 2);
    quad(g, '#48c060', b[0], b[1] - 1, cxp, cyp - 1, ex, ey + 3, 1);
  }
  disc(g, '#1c6a34', 14, 14, 3, 2);
}
function lamp(g) {
  disc(g, 'rgba(255,240,150,0.14)', 13, 11, 9, 9);
  disc(g, 'rgba(255,240,150,0.22)', 13, 11, 6, 6);
  R(g, '#2c2c38', 4, 84, 5, 4);
  R(g, '#4a4a5a', 5, 12, 3, 72);
  R(g, '#7a7a90', 5, 12, 1, 72);
  R(g, '#4a4a5a', 5, 9, 11, 3);
  R(g, '#7a7a90', 5, 9, 11, 1);
  R(g, '#2c2c38', 10, 11, 8, 3);
  R(g, '#fff6b8', 11, 13, 6, 2);
  R(g, '#ffffff', 12, 13, 4, 1);
}
function neon(g) {
  R(g, '#2c2c3a', 10, 30, 3, 22);
  R(g, '#2c2c3a', 43, 30, 3, 22);
  R(g, 'rgba(255,60,170,0.35)', 0, 0, 56, 34);
  R(g, '#0c0c22', 2, 2, 52, 30);
  R(g, '#ff3ca8', 2, 2, 52, 2);
  R(g, '#ff3ca8', 2, 30, 52, 2);
  R(g, '#ff3ca8', 2, 2, 2, 30);
  R(g, '#ff3ca8', 52, 2, 2, 30);
  R(g, '#ffb0e0', 4, 3, 48, 1);
  drawText(g, 'NEON', 5, 8, 2, '#40f0ff', 'left', '#0a5a70');
  drawText(g, 'OPEN 24H', 8, 24, 1, '#ff9adc', 'left', null);
}
function building(g, variant) {
  const rnd = mulberry32(variant ? 77 : 33);
  const w = 64, h = variant ? 112 : 128;
  const body = variant ? '#22183c' : '#141a3a', edge = variant ? '#3a2a5c' : '#26305a';
  R(g, '#000', 2, 4, w - 4, h - 4);
  R(g, body, 3, 5, w - 6, h - 5);
  R(g, edge, 3, 5, 2, h - 5);
  R(g, '#08081a', w - 6, 5, 3, h - 5);
  if (variant) { R(g, body, 3, 0, 40, 6); R(g, edge, 3, 0, 40, 1); } else { R(g, '#3a3a50', 30, 0, 2, 6); PX(g, '#ff2a2a', 30, 0); }
  const cols = 6, rows = Math.floor((h - 22) / 8);
  const pal = ['#ffd060', '#60e8ff', '#ff70c8', '#fff0a0'];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const lit = rnd() < 0.5;
    const x = 8 + c * 9, y = 12 + r * 8;
    R(g, lit ? pal[Math.floor(rnd() * pal.length)] : '#0a0e22', x, y, 6, 4);
    if (lit) R(g, 'rgba(255,255,255,0.35)', x, y, 6, 1);
  }
  R(g, variant ? '#40f0ff' : '#ff3ca8', 4, 8, w - 8, 2);
  R(g, variant ? 'rgba(64,240,255,0.3)' : 'rgba(255,60,168,0.3)', 4, 10, w - 8, 2);
  R(g, '#ffd060', 26, h - 10, 12, 10);
  R(g, '#0a0e22', 30, h - 10, 4, 10);
  if (variant) { R(g, '#40f0ff', 56, 20, 2, 60); R(g, 'rgba(64,240,255,0.3)', 58, 20, 2, 60); }
}
function billboard(g) {
  R(g, '#3a3a48', 8, 26, 4, 30);
  R(g, '#3a3a48', 36, 26, 4, 30);
  R(g, '#1a1a24', 0, 0, 48, 28);
  R(g, '#f0e4c8', 1, 1, 46, 26);
  const cols = ['#ff7a3a', '#ff9a4a', '#ffbe5a', '#ffe07a'];
  cols.forEach((c, i) => R(g, c, 3, 3 + i * 4, 42, 4));
  disc(g, '#fff4a0', 32, 18, 6, 6);
  R(g, '#ffe07a', 3, 19, 42, 6);
  R(g, '#2a6a8a', 3, 19, 42, 6);
  R(g, '#3fb8c0', 3, 21, 42, 1);
  drawText(g, 'RUSH', 5, 6, 1, '#7a1a3a', 'left', null);
  R(g, '#3a1a3a', 6, 13, 3, 6);
  disc(g, '#1a5a2a', 7, 11, 4, 2);
}
function signpost(g) {
  R(g, '#5a5a6a', 9, 12, 2, 32);
  R(g, '#9a9aaa', 9, 12, 1, 32);
  R(g, '#1a1a1a', 2, 0, 16, 14);
  R(g, '#f0c828', 3, 1, 14, 12);
  R(g, '#1a1a1a', 8, 3, 2, 3);
  R(g, '#1a1a1a', 7, 4, 4, 1);
  R(g, '#1a1a1a', 9, 6, 2, 1);
  R(g, '#1a1a1a', 6, 8, 8, 2);
  R(g, '#1a1a1a', 12, 7, 1, 4);
  R(g, '#1a1a1a', 3, 15, 14, 6);
  R(g, '#e8e8f0', 4, 16, 12, 4);
  R(g, '#1a1a1a', 6, 17, 8, 1);
}
function bollard(g) {
  R(g, '#101018', 1, 2, 10, 14);
  for (let y = 3; y < 15; y += 4) { R(g, '#f0c828', 2, y, 8, 2); R(g, '#202028', 2, y + 2, 8, 2); }
  R(g, '#101018', 2, 0, 8, 3);
  R(g, '#ff5a3a', 3, 1, 6, 2);
  R(g, '#fff', 4, 1, 2, 1);
}

// ---------------------------------------------------------------- gates
function gate(g, kind) {
  const col = { checkpoint: ['#ffc21a', '#8a5a08', 'CHECKPOINT', '#101018'], goal: ['#f0f0f0', '#303040', '', ''], start: ['#38d070', '#106a36', 'START', '#052010'] }[kind];
  for (const x of [2, 148]) {
    R(g, '#1c1c28', x, 0, 10, 64);
    R(g, '#6a6a80', x + 1, 0, 2, 64);
    for (let y = 8; y < 64; y += 8) R(g, col[0], x + 3, y, 6, 4);
    R(g, col[0], x - 1, 60, 12, 4);
  }
  R(g, '#101018', 8, 2, 144, 24);
  R(g, col[0], 10, 4, 140, 20);
  if (kind === 'goal') {
    for (let y = 0; y < 5; y++) for (let x = 0; x < 35; x++) R(g, (x + y) & 1 ? '#181820' : '#f4f4f4', 10 + x * 4, 4 + y * 4, 4, 4);
    R(g, '#d02030', 46, 6, 68, 16);
    drawText(g, 'GOAL', 50, 8, 2, '#ffffff', 'left', '#600', null);
  } else {
    R(g, col[1], 10, 20, 140, 4);
    R(g, 'rgba(255,255,255,0.4)', 10, 4, 140, 2);
    for (let x = 10; x < 150; x += 12) R(g, col[1], x, 4, 6, 2);
    drawText(g, col[2], 80, 8, 2, col[3], 'center', null);
  }
  R(g, 'rgba(255,255,220,0.25)', 8, 26, 144, 2);
  for (const x of [1, 147]) { R(g, '#ffee88', x + 3, -1, 6, 2); }
}

// ---------------------------------------------------------------- backgrounds
function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function mixc(a, b, t) {
  const A = hex(a), B = hex(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
function gradStops(stops, t) {
  for (let i = 0; i < stops.length - 1; i++) {
    if (t <= stops[i + 1][0]) return mixc(stops[i][1], stops[i + 1][1], (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]));
  }
  return stops[stops.length - 1][1];
}
function wrapDraw(g, fn) { for (const o of [-640, 0, 640]) { g.save(); g.translate(o, 0); fn(g); g.restore(); } }
const TAU = Math.PI * 2;

function skySheet(n) {
  return sheet(640, 180, 1, (g) => {
    const stops = [
      [[0, '#2d1b5e'], [0.35, '#8a3a8c'], [0.6, '#e0586a'], [0.82, '#ff9a4a'], [1, '#ffd88a']],
      [[0, '#0e0b38'], [0.4, '#2c2088'], [0.72, '#7a44a8'], [1, '#e88aa8']],
      [[0, '#000006'], [0.5, '#050c2a'], [0.8, '#0c1c58'], [1, '#3a2a78']],
    ][n - 1];
    const bands = 30;
    for (let y = 0; y < 180; y++) {
      const b = Math.floor((y / 180) * bands) / (bands - 1);
      let col = gradStops(stops, Math.min(1, b));
      R(g, col, 0, y, 640, 1);
    }
    // dithered band transitions
    for (let bnd = 1; bnd < bands; bnd++) {
      const y0 = Math.round((bnd * 180) / bands);
      const cA = gradStops(stops, (bnd - 1) / (bands - 1)), cB = gradStops(stops, Math.min(1, bnd / (bands - 1)));
      for (let x = 0; x < 640; x += 2) { PX(g, cB, x, y0 - 1); PX(g, cA, x + 1, y0); }
    }
    const rnd = mulberry32(100 + n);
    if (n === 1) {
      // sun with stripes
      for (let r = 44; r > 0; r -= 1) {
        const col = mixc('#fff4b0', '#ff8a3a', 1 - r / 44);
        disc(g, 'rgba(255,190,90,0.05)', 210, 136, r + 24, r + 24);
      }
      const rings = [[56, 'rgba(255,200,120,0.25)'], [46, 'rgba(255,220,140,0.35)']];
      rings.forEach(([r, c]) => disc(g, c, 210, 136, r, r));
      for (let y = -34; y <= 34; y++) {
        const half = Math.floor(Math.sqrt(34 * 34 - y * y));
        if (y > 8 && ((y - 8) % 6) < 2 + Math.floor((y - 8) / 8)) continue;
        R(g, mixc('#fff8c0', '#ff7a3a', (y + 34) / 68), 210 - half, 136 + y, half * 2, 1);
      }
      wrapDraw(g, (gg) => {
        for (let i = 0; i < 9; i++) {
          const x = 30 + i * 70 + Math.floor(rnd() * 20), y = 40 + Math.floor(rnd() * 80), w = 50 + Math.floor(rnd() * 60);
          const col = rnd() < 0.5 ? 'rgba(255,150,170,0.55)' : 'rgba(255,190,120,0.5)';
          R(gg, col, x, y, w, 3); R(gg, col, x + 8, y - 2, w - 16, 2); R(gg, 'rgba(140,50,110,0.5)', x + 4, y + 3, w - 10, 2);
        }
      });
    } else if (n === 2) {
      disc(g, 'rgba(255,190,190,0.2)', 430, 150, 34, 34);
      disc(g, '#ffc8c0', 430, 150, 20, 20);
      disc(g, '#ffe4d8', 428, 148, 15, 15);
      wrapDraw(g, (gg) => {
        for (let i = 0; i < 8; i++) {
          const x = 20 + i * 80 + Math.floor(rnd() * 30), y = 30 + Math.floor(rnd() * 90), w = 60 + Math.floor(rnd() * 70);
          R(gg, 'rgba(50,30,110,0.55)', x, y, w, 3); R(gg, 'rgba(50,30,110,0.45)', x + 10, y + 3, w - 20, 2); R(gg, 'rgba(230,140,200,0.4)', x, y - 1, w, 1);
        }
      });
      for (let i = 0; i < 50; i++) PX(g, 'rgba(255,255,255,0.7)', rnd() * 640, rnd() * 70);
    } else {
      for (let i = 0; i < 160; i++) {
        const y = Math.pow(rnd(), 1.4) * 140;
        PX(g, rnd() < 0.15 ? '#a0d8ff' : rnd() < 0.5 ? '#ffffff' : '#8890c0', rnd() * 640, y);
      }
      for (let i = 0; i < 14; i++) { const x = Math.floor(rnd() * 640), y = Math.floor(rnd() * 100); R(g, '#fff', x, y, 2, 1); R(g, '#fff', x, y - 1, 1, 3); }
      disc(g, 'rgba(150,190,255,0.10)', 430, 50, 44, 44);
      disc(g, 'rgba(180,210,255,0.18)', 430, 50, 30, 30);
      disc(g, '#e8f0ff', 430, 50, 19, 19);
      disc(g, '#c4d0ea', 436, 55, 5, 5);
      disc(g, '#c4d0ea', 424, 44, 3, 3);
      disc(g, '#b4c2e0', 434, 41, 2, 2);
      disc(g, '#0a0e2a', 440, 46, 15, 17); // crescent bite
      disc(g, '#e8f0ff', 425, 50, 16, 16);
      wrapDraw(g, (gg) => {
        for (let i = 0; i < 5; i++) { const x = 40 + i * 130 + Math.floor(rnd() * 40), y = 80 + Math.floor(rnd() * 60); R(gg, 'rgba(70,50,140,0.35)', x, y, 90, 2); R(gg, 'rgba(255,60,170,0.15)', x + 10, y + 2, 70, 1); }
      });
    }
  });
}

function farSheet(n) {
  return sheet(640, 96, 1, (g) => {
    const rnd = mulberry32(200 + n);
    if (n === 1) {
      // sea band with glitter and islands
      const seaTop = 66;
      for (let y = seaTop; y < 96; y++) R(g, gradStops([[0, '#1a9ab0'], [0.5, '#2fc0c0'], [1, '#1a7898']], (y - seaTop) / 30), 0, y, 640, 1);
      R(g, '#ffd8a0', 0, seaTop, 640, 1);
      const isl = [[100, 60, 24], [318, 40, 12], [500, 90, 28], [600, 30, 10]];
      for (const [c, wd, ht] of isl) for (let x = -wd; x <= wd; x++) {
        const hh = Math.round(ht * Math.sqrt(1 - (x / wd) ** 2));
        for (const o of [0, 640, -640]) R(g, hh > ht * 0.6 ? '#4a2a5c' : '#5a3468', c + x + o, seaTop - hh + 1, 1, hh);
      }
      for (const c of [100, 500]) for (let i = 0; i < 6; i++) PX(g, '#1e6a44', c - 8 + i * 3, seaTop - 26 + (i % 2));
      for (let i = 0; i < 90; i++) { const x = Math.floor(rnd() * 640), y = seaTop + 2 + Math.floor(rnd() * 27); R(g, rnd() < 0.5 ? '#ffe4a8' : '#9af0e8', x, y, 2 + Math.floor(rnd() * 4), 1); }
      for (let y = seaTop + 3; y < 96; y += 4) R(g, 'rgba(255,190,110,0.25)', 170, y, 80, 1);
    } else if (n === 2) {
      const prof = (x, base, a1, a2, a3, ph) => base + a1 * Math.sin((TAU * 2 * x) / 640 + ph) + a2 * Math.sin((TAU * 5 * x) / 640 + ph * 2) + a3 * Math.sin((TAU * 11 * x) / 640 + ph * 3);
      for (let x = 0; x < 640; x++) {
        const hb = Math.round(prof(x, 44, 14, 8, 3, 0.7));
        R(g, '#6a4aa0', x, 96 - hb, 1, hb);
        if (hb > 50) R(g, '#8a68c0', x, 96 - hb, 1, 2);
      }
      for (let x = 0; x < 640; x++) {
        const hb = Math.round(prof(x, 28, 8, 6, 2, 2.1));
        R(g, '#2a1c5c', x, 96 - hb, 1, hb);
        const spike = (x % 8) < 4 ? (x % 8) : 8 - (x % 8);
        R(g, '#2a1c5c', x, 96 - hb - spike, 1, spike);
      }
      R(g, '#180f3a', 0, 88, 640, 8);
    } else {
      const layers = [['#141c48', 60, 0.5, '#2a3a8a'], ['#0a1030', 78, 1, '#182060']];
      layers.forEach(([col, maxh, lit, top], li) => {
        let x = 0;
        while (x < 640) {
          let w = 10 + Math.floor(rnd() * 16);
          if (640 - x - w < 8) w = 640 - x;
          const h = 18 + Math.floor(rnd() * (maxh - 18)) - (li === 0 ? 8 : 0);
          R(g, col, x, 96 - h, w, h);
          R(g, top, x, 96 - h, w, 1);
          if (li === 1) {
            for (let yy = 96 - h + 4; yy < 92; yy += 4) for (let xx = x + 2; xx < x + w - 2; xx += 3) {
              if (rnd() < 0.35) PX(g, rnd() < 0.6 ? '#ffd060' : rnd() < 0.5 ? '#60e8ff' : '#ff60c0', xx, yy);
            }
            if (rnd() < 0.3) { R(g, '#ff3ca8', x, 96 - h - 1, w, 1); R(g, 'rgba(255,60,168,0.25)', x, 96 - h - 2, w, 1); }
            if (rnd() < 0.2) { R(g, col, x + (w >> 1), 96 - h - 6, 1, 6); PX(g, '#ff2a2a', x + (w >> 1), 96 - h - 6); }
          }
          x += w + (rnd() < 0.3 ? 2 : 0);
        }
      });
      R(g, '#080a20', 0, 92, 640, 4);
    }
  });
}

function nearSheet(n) {
  return sheet(640, 56, 1, (g) => {
    const rnd = mulberry32(300 + n);
    const fill = ['#4a2048', '#0c1a26', '#04061a'][n - 1];
    const hi = ['#7a3a5c', '#1c3a3a', '#1a2050'][n - 1];
    if (n === 1) {
      for (let x = 0; x < 640; x++) {
        const hb = Math.round(14 + 6 * Math.sin((TAU * 3 * x) / 640) + 3 * Math.sin((TAU * 9 * x) / 640 + 1));
        R(g, fill, x, 56 - hb, 1, hb);
        R(g, hi, x, 56 - hb, 1, 1);
      }
      for (let i = 0; i < 8; i++) {
        const cx = 40 + i * 80 + Math.floor(rnd() * 20), top = 8 + Math.floor(rnd() * 8);
        for (let y = top; y < 42; y++) R(g, fill, cx + Math.round((y - top) / 10), y, 2, 1);
        for (let k = -5; k <= 5; k++) { R(g, fill, cx + k * 2, top - 2 + Math.abs(k) + (k * k > 16 ? 2 : 0), 3, 2); }
      }
    } else if (n === 2) {
      for (let x = 0; x < 640; x++) R(g, fill, x, 46, 1, 10);
      for (let i = 0; i < 46; i++) {
        const cx = Math.floor(rnd() * 640), ht = 22 + Math.floor(rnd() * 26), hw = 4 + Math.floor(ht / 6);
        for (let r = 0; r < ht; r++) {
          const half = Math.round((hw * (r + 1)) / ht);
          for (const o of [0, -640, 640]) R(g, r % 2 ? fill : fill, cx - half + o, 56 - ht - 6 + r, half * 2 + 1, 1);
        }
        R(g, hi, cx, 56 - ht - 6, 1, 1);
      }
    } else {
      let x = 0;
      while (x < 640) {
        let w = 14 + Math.floor(rnd() * 26);
        if (640 - x - w < 12) w = 640 - x;
        const h = 14 + Math.floor(rnd() * 36);
        R(g, fill, x, 56 - h, w, h);
        R(g, hi, x, 56 - h, w, 1);
        for (let yy = 56 - h + 3; yy < 52; yy += 5) for (let xx = x + 3; xx < x + w - 3; xx += 5) if (rnd() < 0.18) PX(g, '#ffd060', xx, yy);
        x += w + 2;
      }
    }
  });
}

// ---------------------------------------------------------------- logo
function logoSheet() {
  const [c, g] = cv(232, 76);
  const [t, tg] = cv(232, 76);
  // sun
  for (let y = -30; y <= 0; y++) {
    const half = Math.floor(Math.sqrt(900 - y * y));
    if (y > -18 && ((y + 30) % 5) < 1 + Math.floor((y + 30) / 9)) continue;
    R(g, mixc('#ffe070', '#ff4a7a', (y + 30) / 30), 116 - half, 42 + y, half * 2, 1);
  }
  // speed lines
  for (let i = 0; i < 6; i++) { R(g, i % 2 ? '#ff9a4a' : '#ff4a9a', 4, 46 + i * 5, 34 - i * 4, 2); R(g, i % 2 ? '#ff9a4a' : '#ff4a9a', 194 + i * 4, 46 + i * 5, 34 - i * 4, 2); }
  // text
  drawText(tg, 'SUNSET', 0, 0, 5, '#ffffff', 'left', null);
  const sw = 6 * 6 * 5 - 5;
  const [t2, t2g] = cv(232, 76);
  drawText(t2g, 'RUSH', 0, 0, 5, '#ffffff', 'left', null);
  const compose = (src, ox, oy, top, bot) => {
    const [m, mg] = cv(232, 76);
    mg.drawImage(src, 0, 0);
    mg.globalCompositeOperation = 'source-in';
    const gr = mg.createLinearGradient(0, 0, 0, 35);
    gr.addColorStop(0, top);
    gr.addColorStop(0.5, bot);
    gr.addColorStop(1, '#ff2a6a');
    mg.fillStyle = gr;
    mg.fillRect(0, 0, 232, 76);
    // outline + shadow
    const [o, og] = cv(232, 76);
    og.drawImage(src, 0, 0);
    og.globalCompositeOperation = 'source-in';
    og.fillStyle = '#2a0a3a';
    og.fillRect(0, 0, 232, 76);
    // italic shear by rows
    const draw = (img, dx, dy) => {
      for (let y = 0; y < 36; y++) g.drawImage(img, 0, y, 232, 1, ox + dx + Math.round((35 - y) / 6), oy + dy + y, 232, 1);
    };
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1], [2, 2], [3, 3]]) draw(o, dx, dy);
    draw(m, 0, 0);
    // highlight scanline
    for (let y = 0; y < 36; y += 1) { if (y === 3) g.drawImage(src, 0, y, 232, 1, ox + Math.round((35 - y) / 6), oy + y - 0, 232, 1); }
  };
  compose(tg.canvas, 12, 3, '#fff6b0', '#ffb040');
  compose(t2g.canvas, 66, 40, '#ffe0e8', '#ff70b0');
  void sw;
  return { canvas: c, frames: 1, fw: 232, fh: 76 };
}

// ---------------------------------------------------------------- fx
function smokeSheet() {
  return sheet(12, 12, 4, (g, f) => {
    const r = 3 + f * 0.9;
    const a = [0.95, 0.8, 0.6, 0.35][f];
    disc(g, `rgba(90,90,104,${a})`, 6.5, 6.5, r, r);
    disc(g, `rgba(200,200,214,${a})`, 5.5, 5.5, r - 1, r - 1);
    disc(g, `rgba(236,236,246,${a})`, 4.5, 4.5, Math.max(1, r - 2.6), Math.max(1, r - 2.6));
  });
}
function dustSheet() {
  return sheet(8, 8, 3, (g, f) => {
    const rnd = mulberry32(9 + f);
    for (let i = 0; i < 6 + f * 3; i++) PX(g, rnd() < 0.5 ? '#d8b070' : '#a88850', 4 + (rnd() - 0.5) * (4 + f * 3), 4 + (rnd() - 0.5) * (4 + f * 3));
  });
}
function sparkSheet() {
  return sheet(6, 6, 3, (g, f) => {
    const s = [2, 3, 1][f];
    R(g, '#fff4a0', 3 - s + 0, 3, s * 2, 1);
    R(g, '#fff4a0', 3, 3 - s, 1, s * 2);
    R(g, '#ff8a2a', 2, 2, 2, 2);
    PX(g, '#ffffff', 3, 3);
  });
}

function fontSheet() {
  const c = document.createElement('canvas');
  c.width = atlas.width;
  c.height = 7;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, 7);
  g.drawImage(atlas, 0, 0);
  // white glyphs on black for readability in the gallery
  return { canvas: c, frames: GLYPHS, fw: 5, fh: 7 };
}

export function buildAssets() {
  const A = {};
  A.car_player = playerSheet(false);
  A.car_player_brake = playerSheet(true);
  A.car_sedan = carSheet(36, 20, (g, w, h) => sedan(g, w, h, SEDAN_P[0], false));
  A.car_truck = carSheet(44, 34, (g, w, h) => truck(g, w, h, TRUCK_P[0], false));
  A.car_sports = carSheet(38, 18, (g, w, h) => sports(g, w, h, SPORT_P[0], false));
  for (let v = 1; v < 3; v++) {
    A['car_sedan_v' + v] = carSheet(36, 20, (g, w, h) => sedan(g, w, h, SEDAN_P[v], false));
    A['car_truck_v' + v] = carSheet(44, 34, (g, w, h) => truck(g, w, h, TRUCK_P[v], false));
    A['car_sports_v' + v] = carSheet(38, 18, (g, w, h) => sports(g, w, h, SPORT_P[v], false));
  }
  A.rs_palm = sheet(40, 72, 1, palm);
  A.rs_rock = sheet(32, 22, 1, (g) => rock(g, 32, 22, '#8a7a84', '#b8a8b0', '#5a4a58', '#2a1e2c'));
  A.rs_shrub = sheet(32, 20, 1, shrub);
  A.rs_billboard = sheet(48, 56, 1, billboard);
  A.rs_pine = sheet(40, 88, 1, pine);
  A.rs_boulder = sheet(40, 28, 1, (g) => rock(g, 40, 28, '#76708c', '#a8a2c0', '#4a4468', '#1e1a34', '#3a8a4a'));
  A.rs_fern = sheet(28, 16, 1, fern);
  A.rs_signpost = sheet(20, 44, 1, signpost);
  A.rs_lamp = sheet(20, 88, 1, lamp);
  A.rs_neon = sheet(56, 52, 1, neon);
  A.rs_bollard = sheet(12, 16, 1, bollard);
  A.rs_building = sheet(64, 128, 1, (g) => building(g, 0));
  A.rs_building_b = sheet(64, 112, 1, (g) => building(g, 1));
  A.gate_checkpoint = sheet(160, 64, 1, (g) => gate(g, 'checkpoint'));
  A.gate_goal = sheet(160, 64, 1, (g) => gate(g, 'goal'));
  A.gate_start = sheet(160, 64, 1, (g) => gate(g, 'start'));
  for (let n = 1; n <= 3; n++) {
    A['bg_sky_' + n] = skySheet(n);
    A['bg_far_' + n] = farSheet(n);
    A['bg_near_' + n] = nearSheet(n);
  }
  A.logo_title = logoSheet();
  A.font_pixel = fontSheet();
  A.fx_smoke = smokeSheet();
  A.fx_dust = dustSheet();
  A.fx_spark = sparkSheet();
  return A;
}
