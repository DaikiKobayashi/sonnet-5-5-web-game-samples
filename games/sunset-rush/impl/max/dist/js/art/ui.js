// Gates (160x64), title logo, and small effect sprites (smoke / dust / spark).

import { Px, mix, shade, hash2, bayer, lighten, darken, fromRows, ditherGradient } from '../pixel.js';
import { drawTextPx, measure } from '../font.js';

const OUT = 0x120a26;

// -------------------------------------------------------------------- gates
function pillar(p, x, w, colHi, colMid, colLo, seg) {
  p.rect(x, 26, w, 38, colMid);
  p.rect(x, 26, 2, 38, colHi);
  p.rect(x + w - 2, 26, 2, 38, colLo);
  for (let y = 34; y < 60; y += 8) p.rect(x, y, w, 1, colLo);
  // footing
  p.rect(x - 1, 59, w + 2, 5, colLo);
  p.rect(x - 1, 59, w + 2, 1, colMid);
  if (seg) seg(p, x, w);
}

function bulbs(p, y, x0, x1, colors) {
  for (let x = x0, i = 0; x <= x1; x += 6, i++) {
    const c = colors[i % colors.length];
    p.rect(x, y, 2, 2, c);
    p.set(x, y, lighten(c, 0.6));
  }
}

export function drawGateCheckpoint() {
  const p = new Px(160, 64);
  const steel = 0x59628c, steelHi = 0x9ba6d4, steelLo = 0x2a2f52;
  pillar(p, 1, 10, steelHi, steel, steelLo, (q, x, w) => { q.rect(x + 3, 30, 4, 20, 0xffcf3a); q.rect(x + 3, 30, 1, 20, 0xfff0a0); });
  pillar(p, 149, 10, steelHi, steel, steelLo, (q, x, w) => { q.rect(x + 3, 30, 4, 20, 0xffcf3a); q.rect(x + 3, 30, 1, 20, 0xfff0a0); });
  // truss
  p.rect(9, 26, 142, 4, steelLo);
  p.rect(9, 26, 142, 1, steel);
  for (let x = 10; x < 150; x += 6) { p.line(x, 29, x + 3, 26, steel); }
  // banner
  p.rect(2, 0, 156, 27, 0x0f1440);
  p.rect(3, 1, 154, 25, 0x1d2a78);
  p.rect(3, 1, 154, 2, 0x3f52b8);
  // gold frame
  p.rect(2, 0, 156, 2, 0xffcf3a);
  p.rect(2, 25, 156, 2, 0xd9962a);
  p.rect(2, 0, 2, 27, 0xffcf3a);
  p.rect(156, 0, 2, 27, 0xd9962a);
  p.rect(3, 1, 154, 1, 0xfff0a0);
  bulbs(p, 3, 8, 148, [0xffe680, 0xff7a5a, 0x7fe8ff]);
  bulbs(p, 21, 8, 148, [0xff7a5a, 0x7fe8ff, 0xffe680]);
  // lettering with a drop shadow
  const w = measure('CHECKPOINT', 2);
  const tx = Math.floor((160 - w) / 2);
  drawTextPx(p, 'CHECKPOINT', tx + 1, 9, 0x0a0f30, 2);
  drawTextPx(p, 'CHECKPOINT', tx, 8, 0xffe680, 2);
  for (let x = tx; x < tx + w; x++) for (let y = 8; y < 22; y++) if (p.get(x, y) === 0xffe680 && p.get(x, y - 1) !== 0xffe680) p.set(x, y, 0xffffff);
  p.outline(OUT);
  return p;
}

export function drawGateGoal() {
  const p = new Px(160, 64);
  const W_ = 0xf4f4f8, K_ = 0x1a1a26;
  const chk = (x, y, s = 4) => ((((x / s) | 0) + ((y / s) | 0)) & 1 ? K_ : W_);
  // pillars with checker stripes
  for (const x0 of [1, 149]) {
    for (let y = 26; y < 64; y++) for (let x = x0; x < x0 + 10; x++) p.set(x, y, chk(x - x0, y - 26, 5));
    p.rect(x0 - 1, 59, 12, 5, 0x30303c);
    p.rect(x0 - 1, 59, 12, 1, 0x6a6a7c);
  }
  p.rect(9, 26, 142, 4, 0x2a2a3a);
  p.rect(9, 26, 142, 1, 0x5a5a72);
  // checkered banner
  for (let y = 0; y < 27; y++) for (let x = 2; x < 158; x++) p.set(x, y, chk(x - 2, y, 4));
  p.rect(2, 0, 156, 1, 0xffffff);
  p.rect(2, 26, 156, 1, 0x50506a);
  // centre plate
  const px0 = 40, pw = 80;
  p.rect(px0, 2, pw, 23, 0x0d0b1c);
  p.rect(px0 + 1, 3, pw - 2, 21, 0xd8262f);
  p.rect(px0 + 1, 3, pw - 2, 2, 0xff6a58);
  p.rect(px0 + 1, 22, pw - 2, 2, 0x8a1424);
  const w = measure('GOAL', 3);
  const tx = px0 + Math.floor((pw - w) / 2);
  drawTextPx(p, 'GOAL', tx + 1, 5, 0x4a0a14, 3);
  drawTextPx(p, 'GOAL', tx, 4, 0xffffff, 3);
  p.outline(OUT);
  return p;
}

export function drawGateStart() {
  const p = new Px(160, 64);
  const steel = 0x5b6a5c, steelHi = 0xa2b8a2, steelLo = 0x2a352c;
  pillar(p, 1, 10, steelHi, steel, steelLo, null);
  pillar(p, 149, 10, steelHi, steel, steelLo, null);
  p.rect(9, 26, 142, 4, steelLo);
  p.rect(9, 26, 142, 1, steel);
  p.rect(2, 0, 156, 27, 0x0c2a1c);
  p.rect(3, 1, 154, 25, 0x14603a);
  p.rect(3, 1, 154, 2, 0x2fb86a);
  p.rect(2, 0, 156, 2, 0xf4f0e6);
  p.rect(2, 25, 156, 2, 0xb9b4a2);
  p.rect(2, 0, 2, 27, 0xf4f0e6);
  p.rect(156, 0, 2, 27, 0xb9b4a2);
  // signal lamps on both sides
  const lamps = [[16, 0xff4a4a], [30, 0xffd84a], [44, 0x4aff8a]];
  for (const [x, c] of lamps) {
    p.disc(x, 13, 5.5, 0x10101c);
    p.disc(x, 13, 4, c);
    p.disc(x - 1, 12, 1.4, lighten(c, 0.7));
    p.disc(160 - x, 13, 5.5, 0x10101c);
    p.disc(160 - x, 13, 4, c);
    p.disc(160 - x - 1, 12, 1.4, lighten(c, 0.7));
  }
  const w = measure('START', 2);
  const tx = Math.floor((160 - w) / 2);
  drawTextPx(p, 'START', tx + 1, 9, 0x062012, 2);
  drawTextPx(p, 'START', tx, 8, 0xf4f0e6, 2);
  p.outline(OUT);
  return p;
}

// -------------------------------------------------------------------- effects
function puff(p, ox, oy, cx, cy, r, cols, holes, alpha, seed) {
  const lobes = [[0, 0, 1], [-0.7, 0.25, 0.68], [0.7, 0.2, 0.7], [0.1, -0.55, 0.62]];
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      let best = -1;
      for (const [lx, ly, lr] of lobes) {
        const dx = x + 0.5 - (cx + lx * r), dy = y + 0.5 - (cy + ly * r);
        const d = Math.hypot(dx, dy) / (r * lr);
        if (d <= 1) { const shadeK = (dx * -0.5 + dy * -0.8) / (r * lr); best = Math.max(best, shadeK); }
      }
      if (best === -1) continue;
      if (hash2(x + ox, y + oy, seed) < holes) continue;
      const idx = best > 0.35 ? 3 : best > -0.1 ? 2 : best > -0.5 ? 1 : 0;
      p.set(x, y, cols[idx], alpha);
    }
  }
}

export function drawSmokeFrames() {
  const frames = [];
  const cols = [0x6a6a80, 0x8e8ea6, 0xb8b8cc, 0xe4e4f0];
  const rs = [2.6, 3.7, 4.7, 5.5];
  const holes = [0, 0.05, 0.2, 0.42];
  const alphas = [255, 245, 215, 150];
  for (let i = 0; i < 4; i++) {
    const p = new Px(12, 12);
    puff(p, i * 12, 0, 6, 6.5 - (i > 1 ? 0.5 : 0), rs[i], cols, holes[i], alphas[i], 90 + i);
    frames.push(p);
  }
  return frames;
}

export function drawDustFrames() {
  const frames = [];
  const cols = [0x9a7a52, 0xb8946a, 0xd9b98a, 0xf0dcb0];
  const rs = [2.0, 2.9, 3.6];
  const holes = [0, 0.1, 0.35];
  const alphas = [255, 220, 150];
  for (let i = 0; i < 3; i++) {
    const p = new Px(8, 8);
    puff(p, i * 8, 0, 4, 4.5, rs[i], cols, holes[i], alphas[i], 130 + i);
    frames.push(p);
  }
  return frames;
}

export function drawSparkFrames() {
  const frames = [];
  const a = new Px(6, 6);
  a.rect(2, 1, 2, 4, 0xfff6c0); a.rect(1, 2, 4, 2, 0xfff6c0);
  a.rect(2, 2, 2, 2, 0xffffff);
  frames.push(a);
  const b = new Px(6, 6);
  b.set(0, 0, 0xffb038); b.set(5, 0, 0xffb038); b.set(0, 5, 0xffb038); b.set(5, 5, 0xffb038);
  b.set(1, 1, 0xffd86a); b.set(4, 1, 0xffd86a); b.set(1, 4, 0xffd86a); b.set(4, 4, 0xffd86a);
  b.rect(2, 2, 2, 2, 0xfff6c0);
  frames.push(b);
  const c = new Px(6, 6);
  c.set(1, 1, 0xff7a2a); c.set(4, 1, 0xff7a2a); c.set(1, 4, 0xff5a2a); c.set(4, 4, 0xff7a2a);
  c.set(2, 3, 0xffb038); c.set(3, 2, 0xffb038);
  frames.push(c);
  return frames;
}

// -------------------------------------------------------------------- logo
const BASE = {
  S: ['.#######.', '#########', '###...###', '###......', '.######..', '..######.', '......###', '###...###', '#########', '.#######.'],
  U: ['###...###', '###...###', '###...###', '###...###', '###...###', '###...###', '###...###', '###...###', '#########', '.#######.'],
  N: ['####..###', '####..###', '#####.###', '#####.###', '#########', '#########', '###.#####', '###.#####', '###..####', '###..####'],
  E: ['#########', '#########', '###......', '###......', '#######..', '#######..', '###......', '###......', '#########', '#########'],
  T: ['#########', '#########', '...###...', '...###...', '...###...', '...###...', '...###...', '...###...', '...###...', '...###...'],
  R: ['########.', '#########', '###...###', '###...###', '#########', '########.', '###..###.', '###...###', '###...###', '###...###'],
  H: ['###...###', '###...###', '###...###', '###...###', '#########', '#########', '###...###', '###...###', '###...###', '###...###'],
};

export function drawLogo() {
  const W = 232, H = 64;
  const p = new Px(W, H);

  // ---- retro sun behind the lettering
  const sx = 116, sy = 30, sr = 27;
  for (let y = sy - sr; y <= sy + sr; y++) {
    for (let x = sx - sr; x <= sx + sr; x++) {
      const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
      if (d > sr) continue;
      const dy = y - sy;
      if (dy > 3) {
        const k = dy - 3;
        if (k % 6 < 1 + Math.floor(k / 6)) continue;
      }
      const t = (y - (sy - sr)) / (2 * sr);
      const col = t < 0.3 ? 0xffe27a : t < 0.5 ? 0xffb43e : t < 0.7 ? 0xff7a3a : t < 0.85 ? 0xf0466e : 0xc02a86;
      p.set(x, y, col);
    }
  }
  // dithered glow ring
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x + 0.5 - sx, (y + 0.5 - sy) * 1.5);
      if (d > sr && d < sr + 14 && !p.solid(x, y) && (1 - (d - sr) / 14) * 0.9 > bayer(x, y)) p.set(x, y, 0xff8a5a, 150);
    }
  }

  // ---- lettering
  const word = 'SUNSETRUSH';
  const glyphs = [];
  for (const ch of word) glyphs.push(fromRows(BASE[ch], { '#': 0xffffff }).scale2x());
  const gw = glyphs[0].w, gh = glyphs[0].h; // 18 x 20
  const gap = 2, spaceW = 12, shear = 0.28;
  const totalW = glyphs.length * gw + (glyphs.length - 1) * gap + spaceW - gap;
  const L = new Px(totalW + 8, gh);
  let cx = 0;
  glyphs.forEach((g, i) => {
    L.blit(g, cx, 0);
    cx += gw + gap;
    if (i === 5) cx += spaceW - gap;
  });
  L.shearRows((y) => Math.round((gh - 1 - y) * shear));
  // colour: sunset gradient with dithering
  const fill = new Px(L.w, L.h);
  const stops = [
    { t: 0, c: 0xfffbd8 }, { t: 0.22, c: 0xffe14a }, { t: 0.5, c: 0xff9a2e }, { t: 0.76, c: 0xff4a5e }, { t: 1, c: 0xc82a90 },
  ];
  ditherGradient(fill, 0, L.w, 0, L.h, stops, 10);
  const lettering = new Px(L.w, L.h);
  for (let y = 0; y < L.h; y++) {
    for (let x = 0; x < L.w; x++) {
      if (!L.solid(x, y)) continue;
      let c = fill.get(x, y);
      // bevel: bright top-left edges, dark bottom-right edges
      const tl = !L.solid(x - 1, y - 1) || !L.solid(x, y - 1) || !L.solid(x - 1, y);
      const br = !L.solid(x + 1, y + 1) || !L.solid(x, y + 1) || !L.solid(x + 1, y);
      if (tl) c = lighten(c, 0.55);
      else if (br) c = darken(c, 0.32);
      lettering.set(x, y, c);
    }
  }
  const ox = 10, oy = 16;
  // extrusion (behind), then outline
  const ext = [0x8a2a9c, 0x6a2288, 0x4c1a72, 0x34125a];
  const stack = new Px(W, H);
  for (let k = ext.length; k >= 1; k--) {
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (L.solid(x, y)) stack.set(ox + x + k, oy + y + k, ext[k - 1]);
  }
  stack.blit(lettering, ox, oy);
  stack.outline(OUT, true);
  p.blit(stack, 0, 0);

  // ---- speed lines + road reflection below the lettering
  const bars = [[8, 56, 216, 0xff8a5a], [20, 59, 192, 0xf0466e], [36, 62, 160, 0x7fe8ff]];
  for (const [x0, y, w, col] of bars) {
    for (let x = 0; x < w; x++) {
      const e = Math.min(x, w - 1 - x);
      if (e < 12 && e * 0.09 < bayer(x, y) - 0.05) continue;
      p.set(x0 + x, y, col);
      if (y < 60) p.set(x0 + x, y + 1, darken(col, 0.4));
    }
  }
  // sparkles on the lettering
  for (const [x, y] of [[28, 20], [96, 17], [176, 19], [210, 22]]) {
    p.set(x, y, 0xffffff); p.set(x - 1, y, 0xfff0a0); p.set(x + 1, y, 0xfff0a0); p.set(x, y - 1, 0xfff0a0); p.set(x, y + 1, 0xfff0a0);
  }
  return p;
}
