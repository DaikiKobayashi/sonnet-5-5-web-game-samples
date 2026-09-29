// Roadside objects (SPEC 6.2 / 6.3). All drawn procedurally into Px buffers.
// Light comes from the upper-left (the sun / moon side); outlines are 1 px dark.

import { Px, hash2, mix, shade, hex, hslOf, fromHsl } from '../pixel.js';
import { drawTextPx } from '../font.js';

const OUT_G = 0x0f1e1c; // dark green-black outline for foliage
const OUT = 0x150f1e;

function bez(a, b, c, t) {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]];
}

// Shaded ellipsoid: pal = colours dark->light. light = unit-ish vector (x right, y down, z toward viewer).
function blob(p, cx, cy, rx, ry, pal, o = {}) {
  const L = o.light || [-0.55, -0.65, 0.5];
  const ln = Math.hypot(L[0], L[1], L[2]);
  const lx = L[0] / ln, ly = L[1] / ln, lz = L[2] / ln;
  const seed = o.seed || 0;
  const noise = o.noise === undefined ? 0.18 : o.noise;
  const edge = o.edge === undefined ? 0 : o.edge;
  const y0 = Math.floor(cy - ry - 2), y1 = Math.ceil(cy + ry + 2);
  const x0 = Math.floor(cx - rx - 2), x1 = Math.ceil(cx + rx + 2);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      const r2 = dx * dx + dy * dy;
      const lim = 1 + (hash2(x, y, seed + 7) - 0.5) * edge;
      if (r2 > lim) continue;
      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, r2)));
      let lum = dx * lx + dy * ly + nz * lz;
      lum += (hash2(x, y, seed) - 0.5) * noise;
      let t = (lum * 0.5 + 0.5) * pal.length;
      let idx = Math.max(0, Math.min(pal.length - 1, Math.floor(t)));
      if (o.mask && !o.mask(x, y)) continue;
      p.set(x, y, pal[idx]);
    }
  }
}

function ramp(base, n = 5) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(shade(base, (i - (n - 1) / 2) * 1.15));
  return out;
}

function shadow(p, cx, y, rx, a = 90) {
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    for (let dy = 0; dy < 2; dy++) {
      const k = (x + 0.5 - cx) / rx;
      if (k * k + (dy ? 0.6 : 0) <= 1 && !p.solid(x, y + dy)) p.set(x, y + dy, 0x0a0614, a);
    }
  }
}

// ------------------------------------------------------------------ palm tree (S1 solid)
export function drawPalm() {
  const p = new Px(40, 72);
  const trunkMid = 0x9a6a3c, trunkHi = 0xc48c52, trunkLo = 0x5e3a22, trunkDeep = 0x3e2416;
  // trunk: curved, thick base
  const a = [19, 71.5], b = [16.5, 47], c = [24.5, 25];
  const N = 90;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const [x, y] = bez(a, b, c, t);
    const r = 2.6 - 1.2 * t;
    const ring = Math.floor(t * 26) % 2 === 0;
    for (let yy = Math.floor(y - 0.5); yy <= Math.floor(y + 0.5); yy++) {
      for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
        const k = (xx + 0.5 - x) / r;
        if (Math.abs(k) > 1) continue;
        const col = k < -0.35 ? (ring ? trunkHi : trunkMid) : k < 0.35 ? (ring ? trunkMid : trunkLo) : (ring ? trunkLo : trunkDeep);
        p.set(xx, yy, col);
      }
    }
  }
  // crown fronds
  const C = [24.5, 25];
  const fronds = [
    { e: [1, 33], c: [8, 12], light: 1 },
    { e: [4, 45], c: [3, 24], light: 0.2 },
    { e: [9, 18], c: [12, 8], light: 1.2 },
    { e: [16, 6], c: [18, 6], light: 1.2 },
    { e: [26, 3], c: [25, 4], light: 1.1 },
    { e: [34, 8], c: [32, 4], light: 0.8 },
    { e: [39, 22], c: [37, 12], light: 0.6 },
    { e: [38, 40], c: [40, 26], light: 0 },
    { e: [30, 46], c: [34, 28], light: -0.2 },
  ];
  const leafMid = 0x2f9a45, leafHi = 0x7ad35a, leafLo = 0x1c6a3a, leafDeep = 0x114a2e;
  for (const f of fronds) {
    const n = 40;
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const [x, y] = bez(C, f.c, f.e, t);
      // leaflets hang below the spine
      const len = 1 + Math.sin(Math.PI * Math.min(1, t * 1.15)) * 5;
      const dir = f.e[0] < C[0] ? -1 : 1;
      if (i % 2 === 0 && t > 0.12) {
        const lx = x + dir * 1.6, ly = y + len;
        p.line(Math.round(x), Math.round(y), Math.round(lx), Math.round(ly), f.light > 0.5 ? leafMid : leafLo);
      }
      if (prev) p.line(Math.round(prev[0]), Math.round(prev[1]), Math.round(x), Math.round(y), f.light > 0.5 ? leafHi : leafMid);
      p.set(Math.round(x), Math.round(y) - 1, f.light > 0.5 ? leafHi : leafMid);
      prev = [x, y];
    }
  }
  // crown shading knot + coconuts
  p.disc(24.5, 26.5, 3, leafLo);
  p.disc(23.5, 26, 1.7, 0x6b4425);
  p.disc(26.5, 27, 1.7, 0x5a3820);
  p.disc(24.5, 28.2, 1.6, 0x7a5030);
  p.set(23, 25, 0xa8784a);
  // fronds outline (dark green) + base
  p.outline(OUT_G, false);
  p.rect(15, 70, 10, 1, trunkLo);
  p.rect(14, 71, 12, 1, trunkDeep);
  shadow(p, 20, 71, 11, 100);
  return p;
}

// ------------------------------------------------------------------ coastal rock (S1 solid)
export function drawRock() {
  const p = new Px(32, 22);
  const pal = [0x3a3448, 0x584f66, 0x7c6f80, 0xa08f8c, 0xd0b7a0];
  blob(p, 15, 13.5, 14, 8.5, pal, { seed: 3, noise: 0.35, edge: 0.25 });
  blob(p, 24, 16, 7, 4.6, pal, { seed: 9, noise: 0.35, edge: 0.3 });
  blob(p, 7, 17.5, 5, 3.4, pal, { seed: 11, noise: 0.3, edge: 0.3 });
  // wet dark base
  for (let x = 2; x < 30; x++) {
    for (let y = 18; y < 21; y++) if (p.solid(x, y) && hash2(x, y, 2) < 0.75) p.set(x, y, y === 18 ? pal[1] : pal[0]);
  }
  // cracks
  p.line(10, 8, 12, 13, pal[0]);
  p.line(12, 13, 11, 16, pal[0]);
  p.line(19, 9, 21, 13, pal[1]);
  // sun-warm rim highlights on the left tops
  for (let x = 4; x < 20; x++) for (let y = 4; y < 12; y++) if (p.get(x, y) === pal[4] && hash2(x, y, 5) < 0.5) p.set(x, y, 0xffd9a8);
  p.outline(OUT);
  shadow(p, 16, 20, 15, 90);
  return p;
}

// ------------------------------------------------------------------ shrub (S1 decor)
export function drawShrub() {
  const p = new Px(32, 20);
  const pal = ramp(0x2f9a52, 5);
  blob(p, 10, 12.5, 8.5, 6.5, pal, { seed: 21, noise: 0.45, edge: 0.6 });
  blob(p, 21.5, 12, 9, 7, pal, { seed: 22, noise: 0.45, edge: 0.6 });
  blob(p, 16, 9, 8, 6.5, pal, { seed: 23, noise: 0.45, edge: 0.6 });
  // blossoms
  const flowers = [[8, 8], [15, 5], [22, 8], [12, 12], [24, 13], [18, 10]];
  flowers.forEach(([x, y], i) => {
    p.set(x, y, i % 2 ? 0xff7ab8 : 0xffe066);
    p.set(x + 1, y, i % 2 ? 0xffb0d4 : 0xfff2a0);
  });
  p.outline(OUT_G);
  shadow(p, 16, 18, 14, 80);
  return p;
}

// ------------------------------------------------------------------ pine tree (S2 solid)
export function drawPine() {
  const p = new Px(40, 88);
  const dark = 0x123c3a, mid = 0x1f5c48, light = 0x2f8055, hi = 0x5eab6e, deep = 0x0b2a2c;
  // trunk
  p.rect(18, 70, 4, 18, 0x4b2f2a);
  p.rect(18, 70, 1, 18, 0x75503c);
  p.rect(21, 70, 1, 18, 0x2e1c22);
  const tiers = [
    { y: 6, h: 20, w: 7 },
    { y: 17, h: 22, w: 10 },
    { y: 29, h: 24, w: 13 },
    { y: 42, h: 26, w: 16 },
    { y: 55, h: 22, w: 19 },
  ];
  const cx = 20;
  tiers.forEach((t, ti) => {
    for (let y = t.y; y < t.y + t.h; y++) {
      const k = (y - t.y) / t.h;
      const half = Math.max(0.5, k * t.w) + (hash2(y, ti, 4) - 0.5) * 1.6;
      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half - 1); x++) {
        const rel = (x + 0.5 - cx) / Math.max(1, half);
        let col;
        if (rel < -0.55) col = hi;
        else if (rel < -0.05) col = light;
        else if (rel < 0.5) col = mid;
        else col = dark;
        // jagged branch shadows near the bottom of each tier
        const jag = Math.floor(k * 6);
        if (k > 0.72 && ((x + jag) & 1) === 0) col = col === hi ? light : col === light ? mid : col === mid ? dark : deep;
        p.set(x, y, col);
      }
    }
    // drooping skirt teeth
    for (let x = -t.w; x <= t.w; x += 2) {
      const yy = t.y + t.h;
      p.set(cx + x, yy, x < 0 ? mid : dark);
      p.set(cx + x + 1, yy - 1, x < 0 ? light : mid);
    }
  });
  p.outline(deep);
  shadow(p, 20, 87, 12, 90);
  return p;
}

// ------------------------------------------------------------------ boulder (S2 solid)
export function drawBoulder() {
  const p = new Px(40, 28);
  const pal = [0x2b2a44, 0x454266, 0x6a6488, 0x958ea8, 0xc2b8c4];
  blob(p, 20, 16.5, 18.5, 10.5, pal, { seed: 31, noise: 0.4, edge: 0.25, light: [-0.6, -0.7, 0.4] });
  blob(p, 8, 21, 6, 4.5, pal, { seed: 32, noise: 0.35, edge: 0.3 });
  blob(p, 32, 21.5, 6.5, 4.2, pal, { seed: 33, noise: 0.35, edge: 0.3 });
  // moss on top
  const moss = [0x2d6e3e, 0x43955a, 0x77c273];
  for (let x = 4; x < 36; x++) {
    for (let y = 4; y < 14; y++) {
      if (!p.solid(x, y)) continue;
      const topmost = !p.solid(x, y - 1) || !p.solid(x, y - 2);
      if (topmost && hash2(x, y, 8) < 0.62) p.set(x, y, moss[(x + y) % 3 === 0 ? 2 : 1]);
      else if (!p.solid(x, y - 3) && hash2(x, y, 9) < 0.3) p.set(x, y, moss[0]);
    }
  }
  p.line(16, 12, 18, 19, pal[0]);
  p.line(26, 11, 24, 17, pal[1]);
  p.outline(OUT);
  shadow(p, 20, 26, 19, 100);
  return p;
}

// ------------------------------------------------------------------ fern (S2 decor)
export function drawFern() {
  const p = new Px(28, 16);
  const cols = [0x1a5a3a, 0x2a7d4c, 0x48a464, 0x7ed08a];
  const base = [14, 14.5];
  const ends = [[1, 8], [4, 3], [9, 0.5], [14, 0], [19, 0.5], [24, 3], [27, 8]];
  ends.forEach((e, i) => {
    const ctrl = [base[0] + (e[0] - base[0]) * 0.35, e[1] - 2.5];
    const n = 30;
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const [x, y] = bez(base, ctrl, e, t);
      if (prev) p.line(Math.round(prev[0]), Math.round(prev[1]), Math.round(x), Math.round(y), cols[2]);
      if (k % 2 === 0 && t > 0.15) {
        const dir = e[0] < base[0] ? -1 : e[0] > base[0] ? 1 : (i % 2 ? 1 : -1);
        p.line(Math.round(x), Math.round(y), Math.round(x - dir * 1.5), Math.round(y + 2.2 + t * 1.4), t > 0.6 ? cols[3] : cols[1]);
        p.line(Math.round(x), Math.round(y), Math.round(x + dir * 1.5), Math.round(y + 2.2 + t * 1.4), cols[0]);
      }
      prev = [x, y];
    }
  });
  p.disc(14, 14, 2.5, cols[0]);
  p.outline(OUT_G);
  shadow(p, 14, 15, 10, 70);
  return p;
}

// ------------------------------------------------------------------ street lamp (S3 solid)
export function drawLamp() {
  const p = new Px(20, 88);
  const steel = 0x424866, steelHi = 0x7c86ac, steelLo = 0x272b42;
  // pole
  p.rect(14, 8, 3, 78, steel);
  p.rect(14, 8, 1, 78, steelHi);
  p.rect(16, 8, 1, 78, steelLo);
  // foot
  p.rect(12, 80, 7, 4, steel);
  p.rect(11, 84, 9, 3, steelLo);
  p.rect(12, 80, 7, 1, steelHi);
  // curved arm to the left
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const [x, y] = bez([14.5, 12], [14.5, 3.5], [5, 4.2], t);
    p.rect(Math.round(x), Math.round(y), 2, 2, steel);
    p.set(Math.round(x), Math.round(y), steelHi);
  }
  // lamp head
  p.rect(1, 4, 8, 3, steelLo);
  p.rect(1, 4, 8, 1, steel);
  p.rect(2, 7, 6, 2, 0xfff2b8);
  p.rect(3, 9, 4, 1, 0xffd868);
  p.set(1, 7, steelLo);
  p.set(8, 7, steelLo);
  p.outline(OUT);
  return p;
}

// ------------------------------------------------------------------ neon sign (S3 solid)
export function drawNeon() {
  const p = new Px(56, 52);
  const steel = 0x3a3f5e, steelHi = 0x6c76a0, steelLo = 0x1e2138;
  // posts
  p.rect(9, 26, 3, 25, steel);
  p.rect(9, 26, 1, 25, steelHi);
  p.rect(44, 26, 3, 25, steel);
  p.rect(44, 26, 1, 25, steelHi);
  p.rect(7, 49, 7, 3, steelLo);
  p.rect(42, 49, 7, 3, steelLo);
  // board
  p.rect(1, 3, 54, 27, 0x0d0c26);
  p.rect(2, 4, 52, 25, 0x171540);
  // cyan tube border
  const cy = 0x3ff0ff, cyHi = 0xd8ffff, mg = 0xff3fc8, mgHi = 0xffb0ec, yl = 0xffe15a;
  p.rect(3, 5, 50, 1, cy);
  p.rect(3, 27, 50, 1, cy);
  p.rect(3, 5, 1, 23, cy);
  p.rect(52, 5, 1, 23, cy);
  p.set(3, 5, cyHi); p.set(52, 5, cyHi); p.set(3, 27, cyHi); p.set(52, 27, cyHi);
  // NEON lettering: 4 glyphs at scale 2 = 46 px, bright tube edge on top of every stroke
  drawTextPx(p, 'NEON', 5, 8, mg, 2);
  for (let x = 5; x < 52; x++) for (let y = 8; y < 22; y++) if (p.get(x, y) === mg && p.get(x, y - 1) !== mg) p.set(x, y, mgHi);
  // underline tube + little star
  p.rect(8, 23, 30, 1, yl);
  p.set(44, 22, yl); p.set(43, 23, yl); p.set(45, 23, yl); p.set(44, 24, yl); p.set(44, 23, 0xfff6c0);
  // board bracing
  p.rect(9, 30, 3, 2, steel);
  p.rect(44, 30, 3, 2, steel);
  p.outline(OUT);
  return p;
}

// ------------------------------------------------------------------ skyscraper (S3 decor)
function windows(p, x0, y0, cols, rows, cw, ch, gx, gy, seed, bright) {
  const lit = [0xffd870, 0xffe9a0, 0x7fe8ff, 0xff9ad6, 0xffb35a];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const h = hash2(c, r, seed);
      const x = x0 + c * (cw + gx), y = y0 + r * (ch + gy);
      let col;
      if (h < bright) col = lit[Math.floor(hash2(c + 5, r + 9, seed) * lit.length) % lit.length];
      else col = h < bright + 0.18 ? 0x2a3563 : 0x1a2148;
      p.rect(x, y, cw, ch, col);
      if (col !== 0x2a3563 && col !== 0x1a2148) p.set(x, y, 0xffffff, 200);
    }
  }
}

export function drawBuilding() {
  const p = new Px(64, 128);
  const wall = 0x1b2246, wallHi = 0x2d3a72, wallLo = 0x10142e;
  // main tower
  p.rect(6, 14, 52, 114, wall);
  p.rect(6, 14, 3, 114, wallHi);
  p.rect(55, 14, 3, 114, wallLo);
  // setback crown
  p.rect(14, 8, 36, 7, wall);
  p.rect(14, 8, 36, 1, wallHi);
  p.rect(26, 2, 12, 7, wallLo);
  p.rect(26, 2, 12, 1, wallHi);
  // antenna + beacon
  p.rect(31, 0, 2, 4, 0x6c76a0);
  p.set(31, 0, 0xff4a4a); p.set(32, 0, 0xff8a8a);
  // neon trims
  p.rect(6, 14, 52, 1, 0x3ff0ff);
  p.rect(14, 8, 36, 1, 0xff3fc8);
  p.rect(6, 40, 52, 1, 0x1f2a5c);
  p.rect(6, 72, 52, 1, 0x1f2a5c);
  // windows
  windows(p, 11, 18, 8, 5, 3, 4, 3, 2, 3, 0.5);
  windows(p, 11, 44, 8, 4, 3, 4, 3, 3, 4, 0.5);
  windows(p, 11, 76, 8, 6, 3, 4, 3, 4, 5, 0.5);
  // lobby
  p.rect(20, 118, 24, 10, 0x0b0e24);
  p.rect(22, 120, 20, 8, 0xffd870);
  p.rect(31, 120, 2, 8, 0x8a5a2a);
  p.outline(0x0a0818);
  return p;
}

export function drawBuildingB() {
  const p = new Px(64, 112);
  const wall = 0x231a45, wallHi = 0x3d2f7a, wallLo = 0x120d2c;
  // wide podium
  p.rect(2, 72, 60, 40, wall);
  p.rect(2, 72, 3, 40, wallHi);
  p.rect(59, 72, 3, 40, wallLo);
  // tower
  p.rect(14, 22, 36, 52, wall);
  p.rect(14, 22, 3, 52, wallHi);
  p.rect(47, 22, 3, 52, wallLo);
  // dome / roof
  p.ellipse(32, 22, 18, 9, wallHi);
  p.rect(0, 23, 64, 0, wall);
  p.rect(14, 22, 36, 4, wall);
  p.rect(30, 2, 4, 12, 0x6c76a0);
  p.set(31, 1, 0xff4a4a); p.set(32, 1, 0xff4a4a);
  // horizontal window bands
  const bands = [0x7fe8ff, 0xffd870, 0xff9ad6];
  for (let i = 0; i < 6; i++) {
    const y = 30 + i * 7;
    for (let x = 18; x < 46; x += 4) {
      const lit = hash2(x, i, 6) < 0.7;
      p.rect(x, y, 3, 3, lit ? bands[(i + (x >> 2)) % 3] : 0x1a1440);
    }
  }
  for (let i = 0; i < 4; i++) {
    const y = 78 + i * 8;
    for (let x = 6; x < 58; x += 5) {
      const lit = hash2(x, i, 7) < 0.6;
      p.rect(x, y, 3, 4, lit ? bands[(i + (x / 5 | 0)) % 3] : 0x1a1440);
    }
  }
  // sign board on the podium
  p.rect(10, 57, 44, 14, 0x0d0c26);
  p.rect(11, 58, 42, 12, 0x1a1650);
  p.rect(12, 58, 40, 1, 0x3ff0ff);
  p.rect(12, 69, 40, 1, 0x3ff0ff);
  drawTextPx(p, 'HOTEL', 17, 61, 0xff5fd0, 1);
  // entrance
  p.rect(24, 100, 16, 12, 0x0b0e24);
  p.rect(26, 102, 12, 10, 0xffe08a);
  p.outline(0x0a0818);
  return p;
}

// ------------------------------------------------------------------ billboard (S1 solid #3)
export function drawBillboard() {
  const p = new Px(48, 56);
  const wood = 0x7a5232, woodHi = 0xa87848, woodLo = 0x452c1c;
  p.rect(8, 26, 4, 30, wood);
  p.rect(8, 26, 1, 30, woodHi);
  p.rect(36, 26, 4, 30, wood);
  p.rect(36, 26, 1, 30, woodHi);
  p.rect(6, 54, 8, 2, woodLo);
  p.rect(34, 54, 8, 2, woodLo);
  // frame
  p.rect(1, 2, 46, 28, 0xf4e6c8);
  p.rect(1, 2, 46, 1, 0xffffff);
  p.rect(1, 29, 46, 1, 0xb59a70);
  // ad art: sunset gradient, sun, waves
  const grad = [0xff8a4a, 0xff7a5a, 0xf0628a, 0xc8508c, 0x7c4a9a];
  for (let y = 4; y < 27; y++) {
    const t = (y - 4) / 23;
    const idx = Math.min(grad.length - 1, Math.floor(t * grad.length));
    p.rect(3, y, 42, 1, grad[idx]);
  }
  p.disc(14, 19, 7, 0xffe38a);
  p.disc(14, 19, 5, 0xfff3b8);
  for (let y = 21; y < 27; y += 2) p.rect(3, y, 42, 1, 0x2fa5b0);
  p.rect(3, 23, 42, 4, 0x1e7f9a);
  for (let x = 4; x < 44; x += 5) p.set(x, 24, 0x8fe8f0);
  drawTextPx(p, 'SURF', 20, 7, 0xffffff, 1);
  p.rect(20, 15, 23, 1, 0xffe38a);
  p.outline(OUT);
  return p;
}

// ------------------------------------------------------------------ signpost (S2 solid #3)
export function drawSignpost() {
  const p = new Px(20, 44);
  const wood = 0x8a5e38, woodHi = 0xb98a58, woodLo = 0x4d331f;
  p.rect(8, 16, 4, 28, wood);
  p.rect(8, 16, 1, 28, woodHi);
  p.rect(11, 16, 1, 28, woodLo);
  p.rect(6, 42, 8, 2, woodLo);
  // sign board with arrow
  p.rect(1, 3, 18, 13, 0x2a5f8a);
  p.rect(1, 3, 18, 1, 0x5c9ac8);
  p.rect(1, 15, 18, 1, 0x173d5c);
  p.rect(2, 4, 16, 1, 0xf4f0e6);
  p.rect(2, 14, 16, 1, 0xf4f0e6);
  // arrow
  p.rect(4, 9, 10, 2, 0xf4f0e6);
  p.poly([[13, 6], [17, 10], [13, 14]], 0xf4f0e6);
  p.outline(OUT);
  return p;
}

// ------------------------------------------------------------------ bollard (S3 solid #3)
export function drawBollard() {
  const p = new Px(12, 16);
  p.rect(3, 2, 6, 13, 0xf0d43a);
  p.rect(3, 2, 1, 13, 0xfff08a);
  p.rect(8, 2, 1, 13, 0xb89a1c);
  for (let y = 5; y < 13; y += 4) p.rect(3, y, 6, 2, 0x1c1a28);
  p.rect(3, 1, 6, 2, 0xfff4b8);
  p.rect(4, 0, 4, 1, 0xff9a3a);
  p.rect(2, 14, 8, 2, 0x2b2a3a);
  p.outline(OUT);
  return p;
}

export const ROADSIDE_DRAWERS = {
  rs_palm: drawPalm,
  rs_rock: drawRock,
  rs_shrub: drawShrub,
  rs_pine: drawPine,
  rs_boulder: drawBoulder,
  rs_fern: drawFern,
  rs_lamp: drawLamp,
  rs_neon: drawNeon,
  rs_building: drawBuilding,
  rs_building_b: drawBuildingB,
  rs_billboard: drawBillboard,
  rs_signpost: drawSignpost,
  rs_bollard: drawBollard,
};
