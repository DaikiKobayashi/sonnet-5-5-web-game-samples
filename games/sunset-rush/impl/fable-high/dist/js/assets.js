// Builds every image asset at start-up from string art and procedural painting.
// Result: { id: { id, canvas, fw, fh, n } } where canvas is a horizontal frame strip.

import { Pix, makeStrip } from './pix.js';
import { mulberry32, mixColor, rgba, hex, lerp, clamp } from './util.js';
import { GLYPHS, GLYPH_ORDER, GLYPH_W, GLYPH_H, blitText, textWidth } from './font.js';
import * as ART from './art.js';

const rnd = mulberry32(0x5eed1234); // asset-only randomness (deterministic)
const R = () => rnd();
const RI = (n) => Math.floor(rnd() * n);

function fromRows(rows, pal, w, h) {
  const p = new Pix(w, h);
  p.blit(rows, pal, 0, 0);
  return p;
}

// ---------------------------------------------------------------- cars

function playerFrames(pal, wheelPhase) {
  const rows = ART.CAR_PLAYER.map((r) => r);
  const p = fromRows(rows, pal, 40, 22);
  if (wheelPhase) {
    // alternate tyre tread: swap t/T on tyre columns
    const q = fromRows(rows.map((r) => r.replace(/[tT]/g, (c) => (c === 't' ? 'T' : 't'))), pal, 40, 22);
    // keep the outer silhouette from the original (only inner treads swap)
    for (let y = 15; y <= 20; y++) for (let x = 0; x < 40; x++) {
      const ch = rows[y][x];
      if (ch === 't' || ch === 'T') {
        const i = (y * 40 + x) * 4;
        p.d.set(q.d.subarray(i, i + 4), i);
      }
    }
  }
  // steering frames: skew the upper body
  const left = p.shiftRows(0, 5, -3).shiftRows(6, 10, -2).shiftRows(11, 14, -1);
  // show a sliver of the side panel on the turning frames
  const right = left.flipX();
  return [p, left, right];
}

function trafficFrames(rows, pals, w, h) {
  return pals.map((v) => fromRows(rows, { ...ART.TRAFFIC_BASE_PAL, ...v }, w, h));
}

// ---------------------------------------------------------------- roadside

function palm() {
  const p = new Pix(40, 72);
  const cx = 24, cy = 22;
  // trunk (curved)
  for (let y = 71; y >= cy - 2; y--) {
    const t = (71 - y) / (71 - cy);
    const x0 = Math.round(16 + 7 * t * t);
    const w = y > 56 ? 5 : 4;
    const ring = (71 - y) % 5 === 0;
    for (let i = 0; i < w; i++) {
      const c = ring ? '#5a3a1c' : i === 0 ? '#b07a44' : i === w - 1 ? '#6b4522' : '#8f5c32';
      p.set(x0 + i, y, c);
    }
  }
  // fronds
  const fronds = [
    [-165, 18, 10], [-135, 17, 9], [-100, 15, 7], [-70, 15, 8], [-35, 17, 9], [-5, 18, 11], [-190, 14, 12],
  ];
  for (const [deg, len, droop] of fronds) {
    const a = (deg * Math.PI) / 180;
    let px = cx, py = cy;
    for (let s = 0; s <= 1; s += 0.06) {
      const x = cx + Math.cos(a) * s * len;
      const y = cy + Math.sin(a) * s * len + droop * s * s;
      const light = Math.cos(a) < 0;
      p.line(px, py, x, y, light ? '#4fae52' : '#2f8a3c');
      // leaflets
      if (s > 0.2) {
        const nx = -Math.sin(a), ny = Math.cos(a);
        const k = ((s * 10) | 0) % 2 === 0 ? 1 : -1;
        const ll = 2 + (s > 0.5 ? 1 : 0);
        p.line(x, y, x + nx * ll * k, y + ny * ll * k + 1, light ? '#3d9a45' : '#256f30');
      }
      px = x; py = y;
    }
  }
  // coconuts
  p.disc(cx - 2, cy + 2, 1.5, '#7a4a22');
  p.disc(cx + 2, cy + 3, 1.5, '#5e3618');
  p.disc(cx, cy + 4, 1.5, '#8a5a2c');
  p.outline('#123a1a');
  return p;
}

function pine() {
  const p = new Pix(40, 88);
  p.rect(18, 44, 4, 44, '#6a4424');
  p.vline(18, 44, 87, '#8c5c32');
  p.vline(21, 44, 87, '#472c14');
  for (let i = 0; i < 5; i++) {
    const tip = 3 + i * 13;
    const base = tip + 22;
    const hw = 6 + i * 3.4;
    p.tri(20, tip, 20 - hw, base, 20, base, '#3a8a50');
    p.tri(20, tip, 20 + hw, base, 20, base, '#1f5c36');
    // jagged bottom edge
    for (let x = Math.round(20 - hw); x <= Math.round(20 + hw); x += 3) {
      p.vline(x, base, base + 2, x < 20 ? '#3a8a50' : '#1f5c36');
    }
    // snow/light on left ridge
    p.line(20, tip, 20 - hw + 1, base - 1, '#6ac07a');
  }
  p.outline('#0e2a18');
  return p;
}

function boulder() {
  const p = new Pix(40, 28);
  p.ellipse(20, 16, 19, 11, '#7d7d8e');
  // shadow lower part
  for (let y = 18; y <= 27; y++) for (let x = 0; x < 40; x++) if (p.alphaAt(x, y)) p.set(x, y, '#585870');
  p.tri(6, 12, 18, 5, 24, 10, '#aaaabc');
  p.tri(8, 16, 18, 8, 15, 16, '#9a9aac');
  p.line(22, 8, 27, 14, '#4a4a5c');
  p.line(27, 14, 26, 20, '#4a4a5c');
  p.line(10, 18, 14, 22, '#4a4a5c');
  p.hline(4, 36, 27, '#3a3a4c');
  p.outline('#22222f');
  return p;
}

function lamp() {
  const p = new Pix(20, 88);
  p.rect(5, 84, 10, 4, '#3c3f4c');
  p.rect(6, 82, 8, 2, '#5a5e6c');
  for (let y = 10; y < 84; y++) {
    p.set(8, y, '#aab0bc'); p.set(9, y, '#7c8290'); p.set(10, y, '#4c5060');
  }
  // arm
  p.line(9, 12, 12, 8, '#7c8290');
  p.line(12, 8, 17, 7, '#7c8290');
  p.line(9, 11, 12, 7, '#aab0bc');
  // head
  p.rect(13, 5, 7, 5, '#2c2f3c');
  p.rect(14, 9, 5, 1, '#fff6c0');
  p.rect(15, 10, 3, 1, '#ffe38a');
  p.rect(13, 4, 7, 1, '#4c5060');
  // glow
  p.rect(12, 11, 7, 2, '#ffe38a66');
  p.rect(13, 13, 5, 2, '#ffe38a33');
  p.outline('#0e1018');
  return p;
}

function neon() {
  const p = new Pix(56, 52);
  p.rect(9, 36, 3, 16, '#3a3c4c');
  p.rect(44, 36, 3, 16, '#3a3c4c');
  p.rect(10, 36, 1, 16, '#5a5e70');
  p.rect(45, 36, 1, 16, '#5a5e70');
  p.rect(0, 0, 56, 38, '#1a1030');
  p.rect(0, 0, 56, 2, '#ff45c6'); p.rect(0, 36, 56, 2, '#ff45c6');
  p.rect(0, 0, 2, 38, '#ff45c6'); p.rect(54, 0, 2, 38, '#ff45c6');
  p.rect(2, 2, 52, 1, '#ffa8ea'); p.rect(2, 2, 1, 34, '#ffa8ea');
  // bulbs
  for (let x = 4; x < 54; x += 5) { p.set(x, 1, '#fff2a0'); p.set(x, 36, '#fff2a0'); }
  blitText(p, 'NEON', 5, 6, 2, '#3af0ff');
  p.rect(5, 6 + 2, 46, 1, '#c8fbffaa');
  blitText(p, 'CLUB', 5, 24, 1, '#ffe060');
  // star
  p.disc(41, 27, 3, '#ff45c6');
  p.set(41, 22, '#ffd0f2'); p.set(41, 32, '#ffd0f2'); p.set(36, 27, '#ffd0f2'); p.set(46, 27, '#ffd0f2');
  p.disc(41, 27, 1, '#ffffff');
  p.outline('#0a0614');
  return p;
}

function building() {
  const p = new Pix(64, 128);
  p.rect(4, 10, 56, 118, '#1d2340');
  p.rect(4, 10, 2, 118, '#2e3660');
  p.rect(58, 10, 2, 118, '#12172c');
  p.rect(2, 8, 60, 3, '#2a3056');
  p.rect(44, 1, 10, 7, '#2b3150'); p.rect(43, 0, 12, 1, '#3a4068');
  p.vline(12, 0, 8, '#4a5078'); p.set(12, 0, '#ff5050');
  const cols = [10, 18, 26, 34, 42, 50];
  for (let r = 0; r < 14; r++) for (const cx of cols) {
    const y = 14 + r * 8;
    const v = R();
    let c = '#0f1428';
    if (v < 0.5) c = '#f6d97a';
    else if (v < 0.58) c = '#6ee8f0';
    else if (v < 0.65) c = '#f78ad2';
    p.rect(cx, y, 4, 5, c);
    if (c !== '#0f1428') p.rect(cx, y, 4, 1, mixColor(c, '#ffffff', 0.4));
  }
  // vertical neon sign on the left
  p.rect(0, 40, 4, 52, '#b02a8a');
  p.rect(1, 42, 2, 48, '#ff62d2');
  for (let y = 44; y < 90; y += 6) p.rect(1, y, 2, 2, '#ffd6f4');
  p.outline('#080a14');
  return p;
}

function buildingB() {
  const p = new Pix(64, 112);
  p.rect(2, 40, 60, 72, '#232a48');
  p.rect(2, 40, 2, 72, '#343c66');
  p.rect(14, 8, 36, 34, '#1a2040');
  p.rect(14, 8, 2, 34, '#2a3260');
  p.rect(12, 6, 40, 3, '#2d3560');
  for (let r = 0; r < 6; r++) {
    const y = 48 + r * 10;
    for (let x = 6; x < 58; x += 6) {
      const on = R() < 0.6;
      p.rect(x, y, 4, 4, on ? '#9ad8ff' : '#111830');
      if (on) p.rect(x, y, 4, 1, '#d6f0ff');
    }
  }
  for (let r = 0; r < 3; r++) for (let x = 18; x < 46; x += 6) {
    const on = R() < 0.55;
    p.rect(x, 14 + r * 9, 3, 5, on ? '#f6d97a' : '#0f1428');
  }
  // rooftop sign
  p.rect(16, 0, 32, 9, '#12101e');
  p.rect(16, 0, 32, 1, '#ff5cc8'); p.rect(16, 8, 32, 1, '#ff5cc8');
  blitText(p, 'HOTEL', 18, 1, 1, '#ff7ad6');
  p.vline(20, 9, 12, '#5a5e70'); p.vline(43, 9, 12, '#5a5e70');
  p.outline('#080a14');
  return p;
}

function billboard() {
  const p = new Pix(48, 56);
  // legs
  p.rect(8, 32, 3, 24, '#6b5040'); p.rect(37, 32, 3, 24, '#6b5040');
  p.vline(8, 32, 55, '#8c6a52'); p.vline(10, 32, 55, '#4a3428');
  p.vline(37, 32, 55, '#8c6a52'); p.vline(39, 32, 55, '#4a3428');
  p.line(11, 44, 36, 36, '#5a4034');
  // board
  p.rect(0, 0, 48, 32, '#3b2f2a');
  for (let y = 2; y < 30; y++) {
    const t = (y - 2) / 27;
    const c = y < 20 ? mixColor('#ff7a3c', '#ffd66a', t / 0.66) : (y % 2 ? '#2a98b4' : '#3ab4cc');
    p.hline(2, 45, y, c);
  }
  p.disc(35, 15, 6, '#fff0a0');
  p.hline(29, 41, 17, '#ffd66a'); p.hline(29, 41, 19, '#ffd66a');
  p.hline(6, 12, 24, '#a8e8f4'); p.hline(20, 28, 26, '#a8e8f4');
  blitText(p, 'SUNSET', 5, 5, 1, '#3b2f2a');
  blitText(p, 'SUNSET', 4, 4, 1, '#ffffff');
  p.rect(0, 0, 48, 1, '#5c4a42'); p.rect(0, 31, 48, 1, '#2a1f1c');
  p.outline('#1c1410');
  return p;
}

function signpost() {
  const p = new Pix(20, 44);
  p.rect(9, 18, 2, 26, '#7c8090');
  p.vline(9, 18, 43, '#aab0bc');
  // diamond sign
  p.tri(10, 1, 1, 10, 19, 10, '#f2c53d');
  p.tri(1, 10, 19, 10, 10, 19, '#f2c53d');
  p.line(10, 1, 1, 10, '#141414'); p.line(1, 10, 10, 19, '#141414');
  p.line(10, 19, 19, 10, '#141414'); p.line(19, 10, 10, 1, '#141414');
  // curve arrow
  p.line(8, 15, 8, 10, '#141414'); p.line(8, 10, 10, 7, '#141414'); p.line(10, 7, 13, 7, '#141414');
  p.line(9, 15, 9, 10, '#141414');
  p.set(12, 5, '#141414'); p.set(12, 9, '#141414'); p.set(13, 6, '#141414'); p.set(13, 8, '#141414');
  p.outline('#1a1810');
  return p;
}

function gate(kind) {
  const p = new Pix(160, 64);
  const stripes = kind === 'goal' ? ['#1a1a22', '#f4f4f4'] : kind === 'start' ? ['#1e8f4a', '#f4f4f4'] : ['#1f4fb0', '#f4f4f4'];
  for (const x0 of [0, 148]) {
    for (let y = 20; y < 64; y++) {
      const c = stripes[Math.floor((y - 20) / 6) % 2];
      p.hline(x0, x0 + 11, y, c);
      p.set(x0, y, mixColor(c, '#ffffff', 0.3));
      p.set(x0 + 11, y, mixColor(c, '#000000', 0.4));
    }
  }
  // crossbar
  p.rect(0, 20, 160, 3, '#3a3a48');
  p.rect(0, 20, 160, 1, '#6a6a7a');
  if (kind === 'goal') {
    for (let y = 0; y < 20; y++) for (let x = 0; x < 160; x++) {
      p.set(x, y, ((x >> 2) + (y >> 2)) % 2 ? '#f4f4f4' : '#1a1a22');
    }
    p.rect(44, 2, 72, 16, '#12121a');
    p.rect(44, 2, 72, 1, '#ffd23c'); p.rect(44, 17, 72, 1, '#ffd23c');
    blitText(p, 'GOAL', 57, 4, 2, '#ffd23c');
  } else if (kind === 'start') {
    // taller banner so the part seen from right underneath (at the grid) is a plain band
    p.rect(0, 0, 160, 28, '#1e8f4a');
    p.rect(0, 0, 160, 2, '#f4f4f4'); p.rect(0, 26, 160, 2, '#f4f4f4');
    p.rect(0, 22, 160, 2, '#f4f4f4');
    blitText(p, 'START', 52, 4, 2, '#0e3a1e');
    blitText(p, 'START', 51, 3, 2, '#ffffff');
    p.rect(0, 28, 160, 3, '#3a3a48');
    p.rect(0, 28, 160, 1, '#6a6a7a');
  } else {
    p.rect(0, 0, 160, 20, '#1f4fb0');
    p.rect(0, 0, 160, 2, '#f4f4f4'); p.rect(0, 18, 160, 2, '#f4f4f4');
    blitText(p, 'CHECKPOINT', 22, 4, 2, '#0c1e48');
    blitText(p, 'CHECKPOINT', 21, 3, 2, '#ffffff');
  }
  // bulbs on the top edge
  for (let x = 2; x < 160; x += 8) p.set(x, 0, '#fff2a0');
  p.outline('#0e0e16');
  return p;
}

// ---------------------------------------------------------------- effects

function smokeFrames() {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const p = new Pix(12, 12);
    const a = [0xe6, 0xc8, 0x9a, 0x60][i];
    const r = 2 + i;
    const col = hex([200, 200, 210]) + a.toString(16).padStart(2, '0');
    const core = hex([236, 236, 244]) + a.toString(16).padStart(2, '0');
    p.disc(6, 6, r, col);
    p.disc(4 - (i > 1 ? 1 : 0), 6, r - 1, col);
    p.disc(8 + (i > 1 ? 1 : 0), 5, r - 1, col);
    p.disc(6, 5, Math.max(1, r - 2), core);
    out.push(p);
  }
  return out;
}

function dustFrames() {
  return [2, 3, 3].map((r, i) => {
    const p = new Pix(8, 8);
    const a = [0xc0, 0x90, 0x50][i];
    p.disc(4, 4, r, '#d9c08a' + a.toString(16));
    p.disc(3, 3, 1, '#efe0b8' + a.toString(16));
    return p;
  });
}

function sparkFrames() {
  return [3, 2, 1].map((r) => {
    const p = new Pix(6, 6);
    p.hline(3 - r, 2 + r, 2, '#ffd23c');
    p.hline(3 - r, 2 + r, 3, '#ffd23c');
    p.vline(2, 3 - r, 2 + r, '#ffd23c');
    p.vline(3, 3 - r, 2 + r, '#ffd23c');
    p.rect(2, 2, 2, 2, '#ffffff');
    return p;
  });
}

// ---------------------------------------------------------------- backgrounds

function bands(p, x0, w, y0, h, stops, bandH) {
  const sample = (t) => {
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const u = (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
        return mixColor(stops[i - 1][1], stops[i][1], clamp(u, 0, 1));
      }
    }
    return stops[stops.length - 1][1];
  };
  const nb = Math.ceil(h / bandH);
  for (let b = 0; b < nb; b++) {
    const c = sample((b + 0.5) / nb);
    const prev = b > 0 ? sample((b - 0.5) / nb) : c;
    for (let y = b * bandH; y < Math.min(h, (b + 1) * bandH); y++) {
      const dither = y - b * bandH < 2 && b > 0;
      for (let x = 0; x < w; x++) {
        p.set(x0 + x, y0 + y, dither && (x + y) % 2 ? prev : c);
      }
    }
  }
}

function stripedSun(p, cx, cy, r, colorTop, colorBottom, stripeStart) {
  for (let y = -r; y <= r; y++) {
    const yy = cy + y;
    if (yy >= stripeStart) {
      const k = yy - stripeStart;
      const period = 3 + Math.floor(k / 6);
      if (k % period < Math.min(2, period - 1)) continue;
    }
    const hw = Math.floor(Math.sqrt(r * r - y * y));
    const c = mixColor(colorTop, colorBottom, (y + r) / (2 * r));
    p.hline(cx - hw, cx + hw, yy, c);
  }
}

function cloud(p, x, y, w, color, hi) {
  const rows = Math.max(2, Math.round(w / 12));
  for (let i = 0; i < rows; i++) {
    const shrink = i * (w / (rows * 2));
    p.hline(Math.round(x + shrink * 0.7), Math.round(x + w - shrink), y - i, i === rows - 1 ? hi : color);
  }
  p.hline(x + 4, x + w - 6, y + 1, mixColor(color, '#000000', 0.15));
}

function sky1() {
  const p = new Pix(640, 180);
  bands(p, 0, 640, 0, 180, [
    [0, '#2e1a54'], [0.25, '#7a2a6c'], [0.5, '#d8443e'], [0.75, '#f5883c'], [1, '#ffd36a'],
  ], 12);
  stripedSun(p, 440, 152, 48, '#fff2a8', '#ffb347', 132);
  cloud(p, 60, 60, 90, '#e57a9a', '#ffc2c8');
  cloud(p, 210, 40, 60, '#c95c8c', '#f0a4bc');
  cloud(p, 300, 96, 130, '#ef8f88', '#ffd0be');
  cloud(p, 520, 70, 80, '#e57a9a', '#ffc2c8');
  cloud(p, 120, 118, 70, '#f6a37e', '#ffe0c0');
  // birds
  for (const [bx, by] of [[250, 70], [262, 66], [272, 72]]) {
    p.set(bx, by, '#3a1c40'); p.set(bx + 1, by - 1, '#3a1c40'); p.set(bx + 2, by, '#3a1c40');
  }
  return p;
}

function sky2() {
  const p = new Pix(640, 180);
  bands(p, 0, 640, 0, 180, [
    [0, '#0c1030'], [0.3, '#2c1e64'], [0.6, '#5a3488'], [0.85, '#a0487c'], [1, '#e08a58'],
  ], 12);
  for (let i = 0; i < 60; i++) {
    const x = RI(640), y = RI(110);
    p.set(x, y, i % 4 ? '#c8c0ff' : '#ffffff');
    if (i % 9 === 0) { p.set(x - 1, y, '#8880c0'); p.set(x + 1, y, '#8880c0'); p.set(x, y - 1, '#8880c0'); p.set(x, y + 1, '#8880c0'); }
  }
  // crescent moon
  p.disc(150, 42, 13, '#f4efd6');
  p.disc(156, 39, 12, '#2c1e64');
  p.disc(156, 39, 11, '#2c1e64');
  // venus
  p.set(470, 60, '#ffffff'); p.set(469, 60, '#d0d0ff'); p.set(471, 60, '#d0d0ff'); p.set(470, 59, '#d0d0ff'); p.set(470, 61, '#d0d0ff');
  // afterglow of the set sun
  stripedSun(p, 240, 186, 40, '#ffb070', '#ff7a4a', 160);
  cloud(p, 380, 120, 120, '#6a3878', '#a05890');
  cloud(p, 40, 140, 90, '#8a4470', '#c06a88');
  return p;
}

function sky3() {
  const p = new Pix(640, 180);
  bands(p, 0, 640, 0, 180, [
    [0, '#03040a'], [0.45, '#0a1030'], [0.8, '#152048'], [1, '#2a1c4e'],
  ], 15);
  for (let i = 0; i < 120; i++) {
    const x = RI(640), y = RI(150);
    p.set(x, y, i % 5 ? '#b8c4ff' : '#ffffff');
    if (i % 13 === 0) { p.set(x - 1, y, '#5c6aa0'); p.set(x + 1, y, '#5c6aa0'); p.set(x, y - 1, '#5c6aa0'); p.set(x, y + 1, '#5c6aa0'); }
  }
  // full moon with craters
  p.disc(500, 48, 19, '#4a5a8a44');
  p.disc(500, 48, 18, '#f4f0d8');
  p.disc(493, 42, 3, '#d8d4b8'); p.disc(506, 52, 4, '#d8d4b8'); p.disc(498, 56, 2, '#d8d4b8'); p.disc(508, 40, 2, '#e4e0c4');
  // city glow near horizon
  for (let y = 150; y < 180; y++) {
    const t = (y - 150) / 30;
    for (let x = 0; x < 640; x++) {
      const m = 0.5 + 0.5 * Math.sin((x / 640) * Math.PI * 2 * 3 + 1.2);
      p.set(x, y, mixColor('#a0309a', '#30b0d0', m) + Math.round(t * 70).toString(16).padStart(2, '0'));
    }
  }
  return p;
}

// periodic ridge height (seamless across 640px)
function ridge(x, seed, amp) {
  let h = 0;
  for (let k = 1; k <= 5; k++) h += Math.sin((x / 640) * Math.PI * 2 * k + seed * k * 1.7) * (amp / k);
  return h;
}

function far1() {
  const p = new Pix(640, 96);
  // sea
  for (let y = 62; y < 96; y++) {
    const t = (y - 62) / 34;
    p.hline(0, 639, y, mixColor('#3aa8c0', '#1f6f90', t));
  }
  p.hline(0, 639, 62, '#9ae8f0');
  for (let i = 0; i < 140; i++) {
    const x = RI(640), y = 64 + RI(30);
    p.hline(x, x + 1 + RI(3), y, y % 3 ? '#8fe0ec' : '#ffffff');
  }
  // islands
  const isl = [[70, 210, 12], [330, 400, 7], [470, 590, 15]];
  for (const [a, b, h] of isl) {
    for (let x = a; x <= b; x++) {
      const t = (x - a) / (b - a);
      const hh = Math.round(Math.sin(t * Math.PI) * h + ridge(x, 3, 2));
      if (hh > 0) p.vline(x, 62 - hh, 62, '#4a4a78');
      if (hh > 0) p.set(x, 62 - hh, '#6a6a98');
    }
  }
  // palm silhouettes on the big island
  for (const px of [520, 540]) {
    p.vline(px, 40, 48, '#33335c');
    p.line(px, 40, px - 5, 42, '#33335c'); p.line(px, 40, px + 5, 42, '#33335c');
    p.line(px, 40, px - 3, 37, '#33335c'); p.line(px, 40, px + 3, 37, '#33335c');
  }
  // lighthouse
  p.rect(150, 44, 3, 8, '#e8e8f0'); p.rect(150, 44, 3, 1, '#ff5050'); p.set(151, 43, '#fff0a0');
  // sailboats
  for (const [bx, by] of [[280, 74], [430, 70]]) {
    p.tri(bx, by - 7, bx, by, bx + 4, by, '#ffffff');
    p.hline(bx - 2, bx + 5, by + 1, '#2a2a44');
  }
  return p;
}

function far2() {
  const p = new Pix(640, 96);
  for (let x = 0; x < 640; x++) {
    const h1 = 40 + ridge(x, 1, 14);
    p.vline(x, Math.round(h1), 95, '#4a3670');
    const h2 = 62 + ridge(x, 2, 11);
    p.vline(x, Math.round(h2), 95, '#2c2050');
    // pine spikes on the near ridge
    if (x % 4 === 0) p.vline(x, Math.round(h2) - 3 - (x % 8 === 0 ? 2 : 0), Math.round(h2), '#2c2050');
    if (x % 4 === 1) p.vline(x, Math.round(h2) - 2, Math.round(h2), '#2c2050');
  }
  for (let x = 0; x < 640; x++) {
    const h1 = 40 + ridge(x, 1, 14);
    p.set(x, Math.round(h1), '#6a5490');
  }
  // mist band
  for (let y = 70; y < 80; y++) for (let x = 0; x < 640; x++) if ((x + y) % 2) p.set(x, y, '#8a70b040');
  p.rect(0, 84, 640, 12, '#241a44');
  return p;
}

function far3() {
  const p = new Pix(640, 96);
  p.rect(0, 88, 640, 8, '#0e1226');
  let x = 0;
  while (x < 640) {
    const w = 8 + RI(24);
    const h = 18 + RI(64);
    const top = 96 - 8 - h;
    const col = R() < 0.5 ? '#141a30' : '#181e38';
    p.rect(x, top, w, h + 8, col);
    p.rect(x, top, 1, h + 8, '#222a48');
    for (let wy = top + 3; wy < 88; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) {
      const v = R();
      if (v < 0.35) p.set(wx, wy, v < 0.28 ? '#f2d270' : v < 0.32 ? '#4ee0f0' : '#f060c0');
    }
    if (h > 60) { p.vline(x + (w >> 1), top - 8, top, '#3a4468'); p.set(x + (w >> 1), top - 8, '#ff4040'); }
    if (R() < 0.3) p.rect(x + 1, top, w - 2, 1, R() < 0.5 ? '#ff50c0' : '#40e0f0');
    x += w;
  }
  return p;
}

function near1() {
  const p = new Pix(640, 56);
  for (let x = 0; x < 640; x++) {
    const h = 30 + ridge(x, 5, 9);
    p.vline(x, Math.round(h), 55, '#d0aa6a');
    p.set(x, Math.round(h), '#f0d090');
    const h2 = 44 + ridge(x, 7, 6);
    p.vline(x, Math.round(h2), 55, '#b8904e');
  }
  // grass tufts
  for (let i = 0; i < 40; i++) {
    const x = RI(640), y = 34 + RI(18);
    p.vline(x, y - 3, y, '#6a8a3c'); p.set(x - 1, y - 2, '#6a8a3c'); p.set(x + 1, y - 1, '#6a8a3c');
  }
  // palm silhouettes
  for (const px of [90, 330, 560]) {
    p.line(px, 55, px + 3, 18, '#25423a');
    p.line(px + 1, 55, px + 4, 18, '#25423a');
    for (const [dx, dy] of [[-12, 6], [12, 4], [-8, -6], [9, -7], [0, -10], [14, 10]]) p.line(px + 3, 18, px + 3 + dx, 18 + dy, '#25423a');
  }
  return p;
}

function near2() {
  const p = new Pix(640, 56);
  let x = -6;
  while (x < 646) {
    const h = 20 + RI(30);
    const hw = 5 + RI(5);
    const col = R() < 0.5 ? '#163828' : '#1e4a34';
    p.tri(x, 56 - h, x - hw, 56, x + hw, 56, col);
    p.tri(x, 56 - h + 8, x - hw - 2, 56, x + hw + 2, 56, col);
    p.line(x, 56 - h, x - hw + 2, 56, mixColor(col, '#ffffff', 0.12));
    x += 4 + RI(8);
  }
  return p;
}

function near3() {
  const p = new Pix(640, 56);
  let x = 0;
  while (x < 640) {
    const w = 20 + RI(40);
    const h = 16 + RI(36);
    p.rect(x, 56 - h, w, h, '#0a0e1c');
    p.rect(x, 56 - h, 1, h, '#1a2038');
    for (let wy = 60 - h; wy < 52; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 5) {
      if (R() < 0.3) p.rect(wx, wy, 2, 3, R() < 0.7 ? '#f6d97a' : '#7ae0f0');
    }
    if (R() < 0.5) { const c = R() < 0.5 ? '#ff50c0' : '#40e0f0'; p.rect(x + 2, 56 - h + 2, w - 4, 2, c); }
    x += w + RI(6);
  }
  // overpass rail with lights
  p.rect(0, 40, 640, 2, '#1c2240');
  for (let lx = 6; lx < 640; lx += 16) { p.set(lx, 39, '#ffe08a'); p.set(lx, 38, '#ffe08a88'); }
  return p;
}

// ---------------------------------------------------------------- logo

const LOGO_LETTERS = {
  S: ['.######', '##....#', '##.....', '###....', '.#####.', '....###', '.....##', '#....##', '######.'],
  U: ['##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##', '.#####.'],
  N: ['##...##', '###..##', '####.##', '##.####', '##..###', '##...##', '##...##', '##...##', '##...##'],
  E: ['#######', '##.....', '##.....', '##.....', '######.', '##.....', '##.....', '##.....', '#######'],
  T: ['#######', '#######', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..'],
  R: ['######.', '##...##', '##...##', '##...##', '######.', '##.##..', '##..##.', '##...##', '##...##'],
  H: ['##...##', '##...##', '##...##', '##...##', '#######', '##...##', '##...##', '##...##', '##...##'],
};

function logo() {
  const S = 4, text = 'SUNSET RUSH';
  const adv = 8 * S;
  const tw = text.length * adv - S;
  const w = tw + 8, h = 80;
  const p = new Pix(w, h);
  // sun behind the text
  const scx = Math.round(w / 2), scy = 36;
  stripedSun(p, scx, scy, 34, '#ffd36a', '#ff6a4a', 40);
  for (let i = 0; i < 3; i++) p.hline(scx - 60 - i * 30, scx + 60 + i * 30, 66 + i * 4, '#ff6a4a');
  // letters
  const ty = 22;
  const rowColor = (yy) => {
    if (yy === 12) return '#ffffff';
    if (yy < 8) return '#fff3b0';
    if (yy < 16) return '#ffc14a';
    if (yy < 26) return '#ff6a4a';
    return '#d63c8a';
  };
  const letters = new Pix(w, h);
  for (let i = 0; i < text.length; i++) {
    const rows = LOGO_LETTERS[text[i]];
    if (!rows) continue;
    for (let y = 0; y < 9; y++) for (let x = 0; x < 7; x++) {
      if (rows[y][x] !== '#') continue;
      for (let sy = 0; sy < S; sy++) {
        const yy = y * S + sy;
        const shear = Math.floor((35 - yy) / 9);
        for (let sx = 0; sx < S; sx++) letters.set(4 + i * adv + x * S + sx + shear, ty + yy, rowColor(yy));
      }
    }
  }
  // drop shadow + outline
  const shadow = new Pix(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (letters.alphaAt(x, y)) shadow.set(x + 3, y + 3, '#2a1038');
  p.blitPix(shadow, 0, 0);
  letters.outline('#2a1038');
  p.blitPix(letters, 0, 0);
  return p;
}

function fontStrip() {
  const p = new Pix(GLYPH_ORDER.length * GLYPH_W, GLYPH_H);
  for (let i = 0; i < GLYPH_ORDER.length; i++) {
    const rows = GLYPHS[GLYPH_ORDER[i]];
    for (let y = 0; y < GLYPH_H; y++) for (let x = 0; x < GLYPH_W; x++) if (rows[y][x] === '#') p.set(i * GLYPH_W + x, y, '#ffffff');
  }
  return p;
}

// ---------------------------------------------------------------- glow (used by night lighting)
function glowDisc() {
  const p = new Pix(32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const d = Math.hypot(x - 15.5, y - 15.5) / 16;
    if (d >= 1) continue;
    const a = Math.round((1 - d) * (1 - d) * 255);
    p.set(x, y, [255, 255, 255, a]);
  }
  return p;
}

export function buildAssets() {
  const A = {};
  const add = (id, frames) => { const s = makeStrip(frames); A[id] = { id, ...s }; return A[id]; };

  add('car_player', playerFrames(ART.PLAYER_PAL, false));
  add('car_player_brake', playerFrames(ART.PLAYER_BRAKE_PAL, false));
  {
    const a = playerFrames(ART.PLAYER_PAL, false), b = playerFrames(ART.PLAYER_PAL, true);
    add('car_player_wheel', [a[0], b[0], a[1], b[1], a[2], b[2]]);
  }
  add('car_sedan', trafficFrames(ART.CAR_SEDAN, ART.TRAFFIC_PALS.sedan, 36, 20));
  add('car_truck', trafficFrames(ART.CAR_TRUCK, ART.TRAFFIC_PALS.truck, 44, 34));
  add('car_sports', trafficFrames(ART.CAR_SPORTS, ART.TRAFFIC_PALS.sports, 38, 18));

  add('rs_palm', [palm()]);
  add('rs_rock', [fromRows(ART.RS_ROCK, ART.ROCK_PAL, 32, 22)]);
  add('rs_shrub', [fromRows(ART.RS_SHRUB, ART.SHRUB_PAL, 32, 20)]);
  add('rs_billboard', [billboard()]);
  add('rs_pine', [pine()]);
  add('rs_boulder', [boulder()]);
  add('rs_fern', [fromRows(ART.RS_FERN, ART.FERN_PAL, 28, 16)]);
  add('rs_signpost', [signpost()]);
  add('rs_lamp', [lamp()]);
  add('rs_neon', [neon()]);
  add('rs_building', [building()]);
  add('rs_building_b', [buildingB()]);
  add('rs_bollard', [fromRows(ART.RS_BOLLARD, ART.BOLLARD_PAL, 12, 16)]);

  add('gate_checkpoint', [gate('checkpoint')]);
  add('gate_goal', [gate('goal')]);
  add('gate_start', [gate('start')]);

  add('bg_sky_1', [sky1()]);
  add('bg_sky_2', [sky2()]);
  add('bg_sky_3', [sky3()]);
  add('bg_far_1', [far1()]);
  add('bg_far_2', [far2()]);
  add('bg_far_3', [far3()]);
  add('bg_near_1', [near1()]);
  add('bg_near_2', [near2()]);
  add('bg_near_3', [near3()]);

  add('logo_title', [logo()]);
  add('font_pixel', [fontStrip()]);
  A.font_pixel.n = GLYPH_ORDER.length;
  A.font_pixel.fw = GLYPH_W;
  A.font_pixel.fh = GLYPH_H;

  add('fx_smoke', smokeFrames());
  add('fx_dust', dustFrames());
  add('fx_spark', sparkFrames());

  A._glow = { id: '_glow', ...makeStrip([glowDisc()]) };
  return A;
}

// Gallery ordering (Must first, then Should).
export const GALLERY_ORDER = [
  'car_player', 'car_sedan', 'car_truck', 'car_sports',
  'rs_palm', 'rs_rock', 'rs_shrub', 'rs_pine', 'rs_boulder', 'rs_fern', 'rs_lamp', 'rs_neon', 'rs_building',
  'gate_checkpoint', 'gate_goal', 'bg_sky_1', 'bg_sky_2', 'bg_sky_3', 'bg_far_1', 'bg_far_2', 'bg_far_3',
  'logo_title', 'font_pixel', 'fx_smoke',
  'bg_near_1', 'bg_near_2', 'bg_near_3', 'rs_billboard', 'rs_signpost', 'rs_bollard', 'rs_building_b',
  'gate_start', 'car_player_brake', 'car_player_wheel', 'fx_dust', 'fx_spark',
];

export { textWidth, rgba, lerp };
