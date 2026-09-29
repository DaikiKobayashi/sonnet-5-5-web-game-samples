// Car sprites (rear view), drawn procedurally with mirrored helpers.
// Native sizes follow SPEC 6.2: player 40x22, sedan 36x20, truck 44x34, sports 38x18.

import { Px, shade, mix, hex } from '../pixel.js';

const OUT = 0x150f1e; // outline
const TIRE = 0x1b1a24;
const TIRE_HI = 0x3c3b4e;
const TIRE_LO = 0x0d0c14;
const CHROME = 0xd5d9e6;
const CHROME_LO = 0x8a90a8;
const DARK = 0x201e2c;
const DARK2 = 0x2c2a3c;
const PLATE = 0xf3f0e4;
const PLATE_LO = 0xb9b4a2;

const GLASS = 0x1f2b4a;
const GLASS_MID = 0x33497a;
const GLASS_HI = 0x8db4ec;

const TL_RED = 0xff2f3f;
const TL_DEEP = 0xa5122a;
const TL_HOT = 0xffd36a;
const TL_WHITE = 0xfff1b0;

class Sym {
  constructor(px) { this.px = px; this.W = px.w; }
  rect(x, y, w, h, c, a = 255) {
    this.px.rect(x, y, w, h, c, a);
    this.px.rect(this.W - x - w, y, w, h, c, a);
  }
  set(x, y, c, a = 255) {
    this.px.set(x, y, c, a);
    this.px.set(this.W - 1 - x, y, c, a);
  }
  poly(pts, c, a = 255) {
    this.px.poly(pts, c, a);
    this.px.poly(pts.map(([x, y]) => [this.W - x, y]).reverse(), c, a);
  }
}

export function bodyRamp(base) {
  return {
    hi: shade(base, 2.4),
    light: shade(base, 1.1),
    mid: base,
    lo: shade(base, -1.4),
    deep: shade(base, -2.6),
  };
}

// darken only transparent pixels in rows [y0, y1] to make a ground shadow
function groundShadow(p, y0, y1, x0, x1, alpha) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) if (!p.solid(x, y)) p.set(x, y, 0x0a0614, alpha);
  }
}

// remove the given source columns and re-centre the remaining ones on the same canvas width
function dropColumns(src, cols, offset) {
  const out = new Px(src.w, src.h);
  let nx = offset;
  for (let x = 0; x < src.w; x++) {
    if (cols.includes(x)) continue;
    for (let y = 0; y < src.h; y++) {
      const i = (y * src.w + x) * 4;
      if (src.data[i + 3] === 0) continue;
      const o = (y * out.w + nx) * 4;
      out.data[o] = src.data[i];
      out.data[o + 1] = src.data[i + 1];
      out.data[o + 2] = src.data[i + 2];
      out.data[o + 3] = src.data[i + 3];
    }
    nx++;
  }
  return out;
}

// ---------------------------------------------------------------- player car
// opts: lean -1 (left) / 0 / +1 (right); brake: lit brake lamps; anim: 0/1 tyre tread phase (wheel animation)
export function drawPlayerCar({ lean = 0, brake = false, anim = -1, base = 0xe4293a } = {}) {
  let p = new Px(40, 22);
  const s = new Sym(p);
  const B = bodyRamp(base);

  // tyres (wide, poking out below the tail fascia)
  s.rect(0, 13, 7, 8, TIRE);
  s.rect(1, 14, 1, 6, TIRE_HI);
  s.set(0, 13, null);
  s.set(0, 20, null);
  if (anim >= 0) {
    for (let y = 14; y <= 20; y++) if (((y + anim) & 1) === 0) s.rect(3, y, 3, 1, TIRE_LO);
  } else {
    s.rect(3, 15, 3, 1, TIRE_LO);
    s.rect(3, 18, 3, 1, TIRE_LO);
  }

  // lower valance + diffuser
  s.rect(6, 14, 14, 4, B.lo);
  s.rect(6, 14, 14, 1, B.mid);
  s.rect(7, 18, 13, 2, DARK);
  s.rect(9, 18, 4, 2, CHROME);
  s.rect(10, 19, 2, 1, DARK);
  s.rect(9, 18, 1, 1, CHROME_LO);

  // rear fascia
  s.rect(1, 10, 19, 5, B.mid);
  s.rect(2, 10, 18, 1, B.hi);
  s.rect(2, 14, 18, 1, B.lo);
  s.set(1, 10, null);

  // tail lamps
  s.rect(2, 11, 8, 3, brake ? TL_RED : TL_DEEP);
  s.rect(3, 12, 6, 1, brake ? TL_WHITE : TL_RED);
  s.rect(2, 11, 8, 1, brake ? TL_HOT : TL_RED);
  if (brake) {
    s.rect(3, 13, 6, 1, TL_RED);
  }
  // centre grille panel with slats
  s.rect(11, 11, 9, 3, DARK2);
  s.rect(11, 12, 9, 1, 0x3a384f);

  // deck / trunk lid
  s.poly([[4, 7], [20, 7], [20, 10], [2, 10]], B.mid);
  s.rect(4, 7, 16, 1, B.hi);
  s.rect(8, 8, 12, 1, B.light);
  s.rect(3, 9, 17, 1, B.lo);

  // cabin (pillars), roof and glass
  s.poly([[10, 0], [20, 0], [20, 7], [4, 7]], B.lo);
  s.rect(11, 0, 9, 2, B.mid);
  s.rect(12, 0, 8, 1, B.hi);
  s.poly([[12, 2], [20, 2], [20, 6], [6, 6]], GLASS);
  s.poly([[13, 3], [20, 3], [20, 6], [8, 6]], GLASS_MID);
  p.line(9, 5, 12, 3, GLASS_HI);
  p.line(28, 5, 29, 4, GLASS_HI);
  p.set(19, 2, GLASS_MID);
  p.set(20, 2, GLASS_MID);
  // third brake light inside the rear window
  s.rect(15, 5, 5, 1, brake ? TL_RED : TL_DEEP);

  // licence plate
  p.rect(16, 13, 8, 4, PLATE);
  p.hline(16, 16, 8, PLATE_LO);
  for (let x = 17; x <= 22; x += 2) p.set(x, 14, 0x2b2a3a);
  for (let x = 18; x <= 22; x += 2) p.set(x, 15, 0x2b2a3a);

  // steering: the car is turned a little toward the corner. The rear face gets narrower, the upper body
  // sways toward the turn and the flank on the outside of the turn shows as a darker side panel.
  let q = p;
  if (lean !== 0) {
    q = dropColumns(p, [9, 12, 27, 30], 2);
    q.shearRows((y) => lean * (y < 7 ? 3 : y < 10 ? 2 : y < 12 ? 1 : 0));
    // side panel (flank) on the outside of the turn: right for a left turn, left for a right turn
    const widths = [1, 1, 2, 2, 3, 3, 3]; // rows 7..13
    for (let i = 0; i < widths.length; i++) {
      const y = 7 + i;
      let edge = -1;
      if (lean < 0) { for (let x = q.w - 1; x >= 0; x--) if (q.solid(x, y)) { edge = x; break; } }
      else { for (let x = 0; x < q.w; x++) if (q.solid(x, y)) { edge = x; break; } }
      if (edge < 0) continue;
      for (let k = 1; k <= widths[i]; k++) {
        const x = lean < 0 ? edge + k : edge - k;
        const outer = k === widths[i];
        q.set(x, y, i === 0 ? B.mid : outer ? B.deep : k === 1 && i > 2 ? B.lo : B.lo);
      }
    }
  }
  p = q;

  p.outline(OUT);
  groundShadow(p, 19, 21, 3, 36, 120);
  return p;
}

// ---------------------------------------------------------------- traffic cars
export function drawSedan(base = 0x2f6fe0) {
  const p = new Px(36, 20);
  const s = new Sym(p);
  const B = bodyRamp(base);

  s.rect(0, 11, 6, 8, TIRE);
  s.rect(1, 12, 1, 6, TIRE_HI);
  s.set(0, 11, null);
  s.set(0, 18, null);
  s.rect(3, 14, 2, 1, TIRE_LO);

  s.rect(5, 13, 13, 4, B.lo);
  s.rect(5, 13, 13, 1, B.mid);
  s.rect(6, 16, 12, 2, DARK);
  s.rect(7, 16, 3, 2, CHROME);
  s.set(8, 17, DARK);

  s.rect(1, 8, 17, 6, B.mid);
  s.rect(2, 8, 16, 1, B.hi);
  s.rect(2, 13, 16, 1, B.lo);
  s.set(1, 8, null);
  s.rect(2, 9, 7, 3, TL_DEEP);
  s.rect(3, 10, 5, 1, TL_RED);
  s.rect(2, 9, 7, 1, TL_RED);
  s.rect(10, 9, 8, 3, DARK2);
  s.rect(10, 10, 8, 1, 0x3a384f);

  s.poly([[5, 5], [18, 5], [18, 8], [2, 8]], B.mid);
  s.rect(5, 5, 13, 1, B.hi);
  s.rect(9, 6, 9, 1, B.light);

  s.poly([[8, 0], [18, 0], [18, 5], [4, 5]], B.lo);
  s.rect(9, 0, 9, 1, B.hi);
  s.poly([[10, 1], [18, 1], [18, 5], [6, 5]], GLASS);
  s.poly([[11, 2], [18, 2], [18, 5], [7, 5]], GLASS_MID);
  p.line(8, 4, 10, 2, GLASS_HI);
  p.line(25, 4, 26, 3, GLASS_HI);

  p.rect(14, 12, 8, 4, PLATE);
  p.hline(14, 15, 8, PLATE_LO);
  for (let x = 15; x <= 20; x += 2) p.set(x, 13, 0x2b2a3a);
  for (let x = 16; x <= 20; x += 2) p.set(x, 14, 0x2b2a3a);

  p.outline(OUT);
  groundShadow(p, 17, 19, 3, 32, 110);
  return p;
}

export function drawTruck(box = 0xe9e6dc, accent = 0x2f6fe0) {
  const p = new Px(44, 34);
  const s = new Sym(p);
  const B = bodyRamp(box);
  const A = bodyRamp(accent);

  // wheels (dual)
  s.rect(2, 25, 8, 9, TIRE);
  s.rect(6, 26, 1, 7, TIRE_LO);
  s.rect(3, 26, 1, 7, TIRE_HI);
  s.rect(8, 26, 1, 7, TIRE_HI);
  s.set(2, 25, null);
  s.set(2, 33, null);

  // chassis / bumper
  s.rect(4, 24, 18, 2, DARK);
  s.rect(3, 26, 19, 3, 0x6d7288);
  s.rect(3, 26, 19, 1, CHROME_LO);
  s.rect(3, 28, 19, 1, 0x3c3f52);
  s.rect(10, 27, 3, 6, DARK);
  s.rect(10, 27, 1, 6, DARK2);

  // cargo box
  s.rect(3, 0, 19, 24, B.mid);
  s.rect(3, 0, 19, 2, B.hi);
  s.rect(4, 2, 18, 1, B.light);
  s.rect(3, 22, 19, 2, B.lo);
  s.rect(3, 2, 1, 21, B.lo);
  s.rect(4, 3, 1, 19, B.light);
  // top corner rounding
  s.set(3, 0, null);
  // door seam + hinges + handles
  p.vline(21, 2, 20, B.deep);
  p.vline(22, 2, 20, B.deep);
  s.rect(5, 5, 1, 3, DARK2);
  s.rect(5, 15, 1, 3, DARK2);
  p.rect(19, 11, 2, 4, DARK2);
  p.rect(23, 11, 2, 4, DARK2);
  p.set(19, 11, CHROME);
  p.set(24, 11, CHROME);
  // accent stripe
  s.rect(5, 8, 16, 2, A.mid);
  s.rect(5, 8, 16, 1, A.hi);
  // reflective tape
  for (let x = 4; x < 21; x += 2) {
    s.rect(x, 21, 1, 2, (x & 2) ? 0xff4a3c : 0xffffff);
  }

  // tail lamps and plate
  s.rect(3, 25, 4, 2, TL_DEEP);
  s.rect(4, 25, 2, 1, TL_RED);
  s.rect(3, 25, 4, 1, TL_RED);
  p.rect(17, 26, 10, 3, PLATE);
  p.hline(17, 28, 10, PLATE_LO);
  for (let x = 18; x <= 25; x += 2) p.set(x, 27, 0x2b2a3a);

  p.outline(OUT);
  groundShadow(p, 31, 33, 10, 33, 110);
  return p;
}

export function drawSports(base = 0xf2c018) {
  const p = new Px(38, 18);
  const s = new Sym(p);
  const B = bodyRamp(base);
  const wing = shade(base, -2.2);

  // tyres
  s.rect(1, 9, 6, 8, TIRE);
  s.rect(2, 10, 1, 6, TIRE_HI);
  s.set(1, 9, null);
  s.set(1, 16, null);
  s.rect(4, 12, 2, 1, TIRE_LO);

  // diffuser + twin exhausts
  s.rect(6, 12, 13, 4, DARK);
  s.rect(7, 12, 12, 1, B.lo);
  s.rect(9, 14, 3, 2, CHROME);
  s.rect(10, 15, 1, 1, DARK);

  // body
  s.rect(1, 6, 18, 6, B.mid);
  s.rect(2, 6, 17, 1, B.hi);
  s.rect(2, 11, 17, 1, B.lo);
  s.set(1, 6, null);
  s.poly([[5, 4], [19, 4], [19, 7], [2, 7]], B.mid);
  s.rect(6, 4, 13, 1, B.light);

  // tail light bar
  s.rect(2, 8, 17, 2, TL_DEEP);
  s.rect(2, 8, 17, 1, TL_RED);
  s.rect(3, 9, 8, 1, TL_RED);
  s.rect(14, 8, 3, 2, DARK2);
  p.rect(16, 8, 6, 2, DARK2);
  p.rect(17, 8, 4, 1, 0xe4e0ff);

  // low cabin
  s.poly([[9, 1], [19, 1], [19, 4], [6, 4]], B.lo);
  s.poly([[11, 2], [19, 2], [19, 4], [8, 4]], GLASS);
  p.line(9, 3, 11, 2, GLASS_HI);

  // rear wing
  s.rect(3, 0, 16, 2, wing);
  s.rect(4, 0, 15, 1, shade(base, -0.5));
  s.rect(3, 0, 2, 5, wing);
  s.rect(10, 2, 2, 2, DARK);

  // plate
  p.rect(15, 10, 8, 3, PLATE);
  p.hline(15, 12, 8, PLATE_LO);
  for (let x = 16; x <= 21; x += 2) p.set(x, 11, 0x2b2a3a);

  p.outline(OUT);
  groundShadow(p, 15, 17, 3, 34, 110);
  return p;
}

// colour variants (palette swaps): index 0 is the base look
export const SEDAN_COLORS = [0x2f6fe0, 0xe8c31c, 0x2fae62];
export const SPORTS_COLORS = [0xf2c018, 0x31c9e8, 0xd347c8];
export const TRUCK_COLORS = [[0xe9e6dc, 0x2f6fe0], [0xf28a26, 0xf4f0e6], [0x4f9d5a, 0xf4f0e6]];

export function trafficCar(type, variant) {
  if (type === 'sedan') return drawSedan(SEDAN_COLORS[variant % 3]);
  if (type === 'sports') return drawSports(SPORTS_COLORS[variant % 3]);
  const t = TRUCK_COLORS[variant % 3];
  return drawTruck(t[0], t[1]);
}
