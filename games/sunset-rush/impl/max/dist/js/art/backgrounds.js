// Parallax backgrounds: bg_sky_N (640x180), bg_far_N (640x96), bg_near_N (640x56).
// All layers tile seamlessly in x (every shape is periodic over 640 px).

import { Px, ditherGradient, mix, shade, hash2, bayer, lighten, darken } from '../pixel.js';

const W = 640;
const TAU = Math.PI * 2;
const wrap = (x) => ((x % W) + W) % W;

// periodic 1-D noise: smooth-ish, repeats every 640 px
function pnoise(x, seed, cell = 8) {
  const n = W / cell;
  const f = x / cell;
  const i = Math.floor(f);
  const t = f - i;
  const a = hash2(((i % n) + n) % n, 0, seed);
  const b = hash2((((i + 1) % n) + n) % n, 0, seed);
  const s = t * t * (3 - 2 * t);
  return a + (b - a) * s;
}

// sum of periodic sines: freqs are integers so the curve tiles
function ridge(x, base, comps) {
  let h = base;
  for (const [amp, freq, phase] of comps) h += amp * Math.sin((TAU * freq * x) / W + phase);
  return h;
}

// draw a horizontally wrapped ellipse; colour picked by colorFn(x, y, nx, ny) -> colour|null
function wrapEllipse(p, cx, cy, rx, ry, colorFn) {
  for (const off of [-W, 0, W]) {
    const x0 = Math.floor(cx + off - rx - 1), x1 = Math.ceil(cx + off + rx + 1);
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || x >= W) continue;
        const nx = (x + 0.5 - (cx + off)) / rx, ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const c = colorFn(x, y, nx, ny);
        if (c !== null && c !== undefined) p.set(x, y, c);
      }
    }
  }
}

function glow(p, cx, cy, r0, r1, color, strength = 0.6) {
  for (let y = Math.max(0, Math.floor(cy - r1)); y < Math.min(p.h, Math.ceil(cy + r1)); y++) {
    for (let x = Math.floor(cx - r1); x <= Math.ceil(cx + r1); x++) {
      const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.15);
      if (d < r0 || d > r1) continue;
      const t = 1 - (d - r0) / (r1 - r0);
      if (t * t * 1.15 > bayer(x, y)) {
        const xx = wrap(x);
        const cur = p.get(xx, y);
        if (cur !== -1) p.set(xx, y, mix(cur, color, strength * (0.4 + 0.6 * t)));
      }
    }
  }
}

function stars(p, count, yMax, seed, colors, twinkle = 0.25) {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(hash2(i, 1, seed) * W);
    const y = Math.floor(Math.pow(hash2(i, 2, seed), 1.4) * yMax);
    const col = colors[Math.floor(hash2(i, 3, seed) * colors.length)];
    const cur = p.get(x, y);
    if (cur === -1) continue;
    p.set(x, y, col);
    if (hash2(i, 4, seed) < twinkle) {
      p.set(x - 1, y, mix(cur, col, 0.5));
      p.set(x + 1, y, mix(cur, col, 0.5));
      p.set(x, y - 1, mix(cur, col, 0.5));
      p.set(x, y + 1, mix(cur, col, 0.5));
    }
  }
}

// sunset-style cloud: dark violet top, hot pink body, bright underlit belly. Built from many
// random bumps so every cloud has an irregular, ragged outline.
function cloud(p, cx, cy, rx, ry, pal, seed) {
  const parts = [[0, 0, rx * 0.95, ry * 0.7], [0, ry * 0.35, rx * 0.8, ry * 0.45]];
  const n = Math.max(4, Math.round(rx / 9));
  for (let k = 0; k < n; k++) {
    const u = (k + 0.5) / n; // 0..1 along the cloud
    const taper = Math.sin(Math.PI * u);
    const ox = (u - 0.5) * 2 * rx * 0.86;
    const bump = 0.35 + hash2(k, 1, seed) * 0.65;
    parts.push([
      ox,
      -ry * (0.15 + hash2(k, 2, seed) * 0.55) * taper,
      rx * (0.12 + hash2(k, 3, seed) * 0.16),
      ry * (0.45 + bump * 0.75) * (0.4 + 0.6 * taper),
    ]);
  }
  const y0 = cy - ry * 1.15, y1 = cy + ry * 0.95;
  for (const [ox, oy, prx, pry] of parts) {
    wrapEllipse(p, cx + ox, cy + oy, Math.max(2, prx), Math.max(1.5, pry), (x, y) => {
      const t = Math.max(0, Math.min(0.999, (y - y0) / (y1 - y0)));
      const jitter = (bayer(x, y) - 0.5) * 0.24 + (hash2(x, y, seed) - 0.5) * 0.08;
      const v = Math.max(0, Math.min(pal.length - 1, (t + jitter) * pal.length));
      return pal[Math.floor(v)];
    });
  }
}

// ===================================================================== SKY
export function drawSky(stage) {
  const p = new Px(W, 180);
  if (stage === 1) {
    ditherGradient(p, 0, W, 0, 180, [
      { t: 0.0, c: 0x1e1a5a }, { t: 0.2, c: 0x4b2a88 }, { t: 0.38, c: 0x8c3a9c }, { t: 0.55, c: 0xd2519a },
      { t: 0.7, c: 0xf47c6c }, { t: 0.82, c: 0xffa25c }, { t: 0.92, c: 0xffc970 }, { t: 1.0, c: 0xffe7a6 },
    ], 16);
    stars(p, 26, 40, 11, [0xffe9f6, 0xd6c8ff], 0.1);
    glow(p, 430, 146, 30, 96, 0xffd58a, 0.6);
    // clouds
    const pal = [0x5f3590, 0x8c3f9c, 0xc84e98, 0xf0648e, 0xff9a70, 0xffc888];
    cloud(p, 90, 96, 74, 9, pal, 1);
    cloud(p, 210, 122, 46, 6, pal, 2);
    cloud(p, 305, 70, 92, 10, pal, 3);
    cloud(p, 380, 104, 60, 7, pal, 4);
    cloud(p, 520, 132, 84, 8, pal, 5);
    cloud(p, 590, 82, 48, 6, pal, 6);
    cloud(p, 20, 138, 40, 5, pal, 7);
    // sun with retro slits
    const cx = 430, cy = 146, r = 31;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r) continue;
        const dy = y - cy;
        if (dy > 4) {
          const k = dy - 4;
          const gap = 1 + Math.floor(k / 7);
          if (k % 8 < gap) continue;
        }
        const t = (y - (cy - r)) / (2 * r);
        const col = t < 0.3 ? 0xfff6c0 : t < 0.5 ? 0xffe27a : t < 0.7 ? 0xffc04a : t < 0.85 ? 0xff9a3c : 0xff7434;
        // dithered blends between bands
        p.set(x, y, col);
      }
    }
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > r - 2 && d <= r && p.get(x, y) !== -1 && bayer(x, y) > 0.5) {
        const c = p.get(x, y);
        p.set(x, y, mix(c, 0xff8a4a, 0.5));
      }
    }
  } else if (stage === 2) {
    ditherGradient(p, 0, W, 0, 180, [
      { t: 0.0, c: 0x0b0d34 }, { t: 0.25, c: 0x1c1a5c }, { t: 0.45, c: 0x3a2479 }, { t: 0.62, c: 0x6a2f88 },
      { t: 0.78, c: 0xa9447f }, { t: 0.9, c: 0xe2705f }, { t: 1.0, c: 0xffa462 },
    ], 16);
    stars(p, 70, 95, 21, [0xffffff, 0xcfd6ff, 0xffe9c8], 0.18);
    // setting sun, half hidden by the ridge
    glow(p, 128, 170, 14, 70, 0xffb070, 0.55);
    const cx = 128, cy = 172, r = 15;
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > r) continue;
      const t = (y - (cy - r)) / (2 * r);
      p.set(x, y, t < 0.35 ? 0xffe6a0 : t < 0.6 ? 0xffc46a : 0xff9450);
    }
    const pal = [0x2c2170, 0x4a2c86, 0x7a3a94, 0xb0507e, 0xe07a6a];
    cloud(p, 300, 84, 84, 8, pal, 12);
    cloud(p, 440, 112, 60, 6, pal, 13);
    cloud(p, 560, 66, 70, 7, pal, 14);
    cloud(p, 60, 120, 50, 6, pal, 15);
    cloud(p, 190, 58, 46, 5, pal, 16);
  } else {
    ditherGradient(p, 0, W, 0, 180, [
      { t: 0.0, c: 0x010108 }, { t: 0.3, c: 0x04051c }, { t: 0.55, c: 0x0a0f3e }, { t: 0.75, c: 0x1b1662 },
      { t: 0.9, c: 0x4a1a7a }, { t: 1.0, c: 0x9c2c9c },
    ], 16);
    stars(p, 150, 120, 31, [0xffffff, 0xbfd0ff, 0xffd0f0, 0xa0ffff], 0.22);
    // moon: full disc with craters and a dithered halo
    const mx = 470, my = 46, mr = 16;
    glow(p, mx, my, mr, 60, 0x8a9cff, 0.5);
    for (let y = my - mr; y <= my + mr; y++) for (let x = mx - mr; x <= mx + mr; x++) {
      const dx = x + 0.5 - mx, dy = y + 0.5 - my;
      const d = Math.hypot(dx, dy);
      if (d > mr) continue;
      // lit from the upper left, terminator shading on the lower right
      const lit = (-dx * 0.6 - dy * 0.8) / mr;
      let c = lit > 0.35 ? 0xfffbe8 : lit > -0.1 ? 0xf1ecd4 : lit > -0.55 ? 0xd8d2bc : 0xb9b39c;
      p.set(x, y, c);
    }
    for (const [cx, cy, cr] of [[-5, -4, 3], [4, 3, 4], [-3, 7, 2], [7, -6, 2]]) {
      for (let y = -cr; y <= cr; y++) for (let x = -cr; x <= cr; x++) {
        if (x * x + y * y > cr * cr) continue;
        const px = mx + cx + x, py = my + cy + y;
        if (p.get(px, py) !== -1 && Math.hypot(px + 0.5 - mx, py + 0.5 - my) < mr - 1) p.set(px, py, (x + y < 0) ? 0xc9c3ac : 0xe6e0c8);
      }
    }
    // faint city-lit streak clouds
    const pal = [0x0b0b30, 0x161250, 0x2a1a78, 0x5a2a92];
    cloud(p, 120, 124, 90, 6, pal, 22);
    cloud(p, 300, 96, 70, 5, pal, 23);
    cloud(p, 560, 132, 80, 6, pal, 24);
    cloud(p, 380, 150, 60, 5, pal, 25);
  }
  return p;
}

// ===================================================================== FAR
function fillRidge(p, baseY, hFn, cols, rimColor, dither = true) {
  for (let x = 0; x < W; x++) {
    const h = Math.max(0, Math.round(hFn(x)));
    const top = baseY - h;
    for (let y = top; y <= baseY; y++) {
      const t = h > 0 ? (y - top) / (h + 1) : 0;
      const v = t * (cols.length - 1);
      const i0 = Math.floor(v);
      const f = v - i0;
      const idx = dither && f > bayer(x, y) ? Math.min(cols.length - 1, i0 + 1) : i0;
      p.set(x, y, cols[idx]);
    }
    if (rimColor !== null && h > 0) p.set(x, top, rimColor);
  }
}

export function drawFar(stage) {
  const p = new Px(W, 96);
  if (stage === 1) {
    // distant mainland haze
    fillRidge(p, 84, (x) => ridge(x, 9, [[3, 3, 0.3], [2.5, 8, 1.2], [1.4, 17, 2.1]]), [0xd7679e, 0xc25a9a], 0xf59a9a);
    // islands
    const islands = [[110, 28, 40], [300, 16, 26], [470, 36, 46], [585, 13, 22]];
    const isl = (x) => {
      let h = 0;
      for (const [c, a, s] of islands) {
        let d = Math.abs(x - c);
        d = Math.min(d, W - d);
        h = Math.max(h, a * Math.exp(-((d / s) * (d / s))) + (a > 20 ? (pnoise(x, 5, 3) - 0.5) * 4 * Math.exp(-((d / s) * (d / s))) : 0));
      }
      return h;
    };
    fillRidge(p, 83, isl, [0x9a4fa4, 0x7a3f96, 0x4f3080], 0xffa878);
    // trees on the big island + a lighthouse on the small one
    for (let x = 440; x < 500; x += 3) {
      const h = Math.round(isl(x));
      const top = 83 - h;
      if (h > 12 && hash2(x, 3, 9) < 0.7) { p.rect(x, top - 3, 2, 3, 0x2f2668); p.set(x - 1, top - 3, 0x2f2668); p.set(x + 2, top - 2, 0x2f2668); }
    }
    {
      const lx = 300, ltop = 83 - Math.round(isl(lx));
      p.rect(lx - 1, ltop - 9, 3, 9, 0xf4e6d8);
      p.rect(lx - 1, ltop - 7, 3, 1, 0xd84a4a);
      p.rect(lx - 1, ltop - 4, 3, 1, 0xd84a4a);
      p.rect(lx - 2, ltop - 11, 5, 2, 0x4a2c7c);
      p.set(lx, ltop - 10, 0xffe680);
      p.set(lx, ltop - 12, 0xffe680);
      p.rect(lx - 1, ltop - 9, 1, 9, 0xffffff);
    }
    // sea strip
    const sea = [0xffe9b0, 0xffc884, 0xffa070, 0xf27b7a, 0xdf6580, 0xb75c98, 0x7a63a8, 0x4a7bb0, 0x2f92b2, 0x2288a8, 0x1c7ca0, 0x196e98, 0x175f8c, 0x154f80];
    for (let y = 83; y < 96; y++) {
      const c = sea[Math.min(sea.length - 1, y - 83)];
      for (let x = 0; x < W; x++) p.set(x, y, c);
    }
    // glitter + wave dashes
    for (let i = 0; i < 160; i++) {
      const y = 84 + Math.floor(hash2(i, 1, 41) * 11);
      const x = Math.floor(hash2(i, 2, 41) * W);
      const len = 2 + Math.floor(hash2(i, 3, 41) * (y < 88 ? 5 : 3));
      const near = (y - 84) / 11;
      const col = near < 0.35 ? 0xfff2c0 : near < 0.6 ? 0xffd090 : 0x8ee0e8;
      for (let k = 0; k < len; k++) p.set(wrap(x + k), y, col);
    }
    for (let x = 0; x < W; x += 1) if (hash2(x, 9, 7) < 0.18) p.set(x, 94, 0x0f3e6e);
  } else if (stage === 2) {
    const haze = 0xb0548c;
    // back ridge (pale, hazy)
    fillRidge(p, 94, (x) => ridge(x, 44, [[9, 3, 0.4], [6, 5, 2.1], [4, 11, 0.9], [2, 23, 1.7]]), [haze, 0x9a4a90, 0x83428f], 0xf29a88);
    // mid ridge
    fillRidge(p, 94, (x) => ridge(x, 32, [[10, 4, 1.7], [5, 9, 0.2], [3, 19, 2.6]]), [0x7a3e92, 0x5f3688, 0x4a2f7c], 0xd87a86);
    // front ridge + pine silhouettes
    const front = (x) => ridge(x, 20, [[7, 3, 0.9], [4, 7, 2.5], [2.5, 15, 1.1]]);
    fillRidge(p, 94, front, [0x3a2c74, 0x2b2668, 0x20205a], 0xb0508a);
    for (let x = 0; x < W; x += 3) {
      const n = hash2(x, 5, 17);
      if (n < 0.7) {
        const top = 94 - Math.round(front(x));
        const th = 4 + Math.floor(hash2(x, 6, 17) * 6);
        for (let k = 0; k < th; k++) {
          const half = Math.floor((k + 1) / 2.4);
          for (let dx = -half; dx <= half; dx++) p.set(wrap(x + dx), top - th + k + 2, 0x1c1c52);
        }
        p.set(wrap(x), top - th + 1, 0x1c1c52);
      }
    }
  } else {
    // night skyline in three depth layers
    const layer = (baseY, minH, maxH, minW, maxW, body, edge, winCol, winDensity, seed, hazeTop) => {
      let x = 0, i = 0;
      const blds = [];
      while (x < W) {
        let w = minW + Math.floor(hash2(i, 1, seed) * (maxW - minW + 1));
        if (x + w > W - minW) w = W - x;
        const h = minH + Math.floor(Math.pow(hash2(i, 2, seed), 1.3) * (maxH - minH));
        blds.push({ x, w, h, i });
        x += w;
        i++;
      }
      for (const b of blds) {
        const top = baseY - b.h;
        for (let yy = top; yy <= baseY; yy++) {
          const t = (yy - top) / Math.max(1, b.h);
          for (let xx = b.x; xx < b.x + b.w; xx++) {
            let c = body;
            if (hazeTop) c = mix(body, hazeTop, Math.max(0, 0.6 - t) * 0.5 * (bayer(xx, yy) > 0.4 ? 1 : 0.4));
            p.set(xx, yy, c);
          }
        }
        // roof edge highlight
        for (let xx = b.x; xx < b.x + b.w; xx++) p.set(xx, top, edge);
        p.set(b.x, top + 1, edge);
        // stepped tops and antennas
        const deco = hash2(b.i, 3, seed);
        if (deco < 0.28 && b.w > 8) { p.rect(b.x + 2, top - 3, b.w - 4, 3, body); p.rect(b.x + 2, top - 3, b.w - 4, 1, edge); }
        else if (deco < 0.5) {
          const ax = b.x + (b.w >> 1);
          p.rect(ax, top - 6 - Math.floor(hash2(b.i, 4, seed) * 6), 1, 8, body);
          p.set(ax, top - 6 - Math.floor(hash2(b.i, 4, seed) * 6), 0xff4a4a);
        }
        // windows
        if (winCol) {
          for (let yy = top + 3; yy < baseY - 2; yy += 3) {
            for (let xx = b.x + 2; xx < b.x + b.w - 1; xx += 3) {
              const r = hash2(xx, yy, seed + 5);
              if (r < winDensity) p.set(xx, yy, winCol[Math.floor(hash2(xx, yy, seed + 9) * winCol.length)]);
            }
          }
        }
        // neon accent strips on some towers
        if (hash2(b.i, 8, seed) < 0.18 && b.h > 30) {
          const c = hash2(b.i, 9, seed) < 0.5 ? 0xff3fc8 : 0x3ff0ff;
          for (let yy = top + 6; yy < baseY - 6; yy++) p.set(b.x + b.w - 1, yy, c);
        }
      }
    };
    layer(94, 20, 62, 10, 22, 0x1a1850, 0x4a3a98, null, 0, 51, 0xb03aa0);
    layer(94, 14, 50, 9, 20, 0x100f38, 0x3a2f80, [0xffd870, 0x7fe8ff, 0xff9ad6], 0.14, 52, 0x7a2a90);
    layer(94, 8, 34, 8, 18, 0x0a0a26, 0x2a2a68, [0xffe9a0, 0xffd870, 0x7fe8ff, 0xff9ad6, 0xffb35a], 0.24, 53, null);
    // tall landmark tower with lattice + beacon
    const tx = 150;
    p.rect(tx - 1, 20, 3, 74, 0x0c0c2c);
    for (let y = 30; y < 94; y += 6) { p.rect(tx - 3 - (y - 30) / 12 | 0, y, 3, 1, 0x1c1c52); p.rect(tx + 1 + (y - 30) / 12 | 0, y, 3, 1, 0x1c1c52); }
    p.rect(tx - 2, 44, 5, 3, 0x2a2a68);
    p.set(tx, 18, 0xff4a4a); p.set(tx, 19, 0xff8a8a);
    p.set(tx - 1, 45, 0x7fe8ff); p.set(tx + 1, 45, 0xffd870);
  }
  return p;
}

// ===================================================================== NEAR
export function drawNear(stage) {
  const p = new Px(W, 56);
  if (stage === 1) {
    // dunes with palm silhouettes
    const dune = (x) => ridge(x, 5, [[2, 3, 0.7], [1.4, 8, 2.0], [0.9, 17, 0.5]]);
    fillRidge(p, 55, dune, [0x6a3a7a, 0x4a2c68, 0x3a2258], 0xffa86e);
    const palms = [60, 210, 330, 470, 590];
    for (const px0 of palms) {
      const base = 55 - Math.round(dune(px0));
      const hgt = 26 + Math.floor(hash2(px0, 1, 3) * 14);
      const lean = (hash2(px0, 2, 3) - 0.5) * 8;
      const col = 0x2a1a4a;
      for (let k = 0; k < hgt; k++) {
        const t = k / hgt;
        const x = px0 + lean * t * t;
        p.rect(Math.round(x), base - k, 2, 1, col);
      }
      const cx = px0 + lean, cy = base - hgt;
      const ends = [[-14, 6], [-10, -1], [-4, -5], [4, -5], [10, -1], [14, 6], [-7, 9], [7, 9]];
      for (const [ex, ey] of ends) {
        const n = 10;
        let prev = [cx, cy];
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          const x = cx + ex * t, y = cy + ey * t * t - 6 * t * (1 - t);
          p.line(Math.round(prev[0]), Math.round(prev[1]), Math.round(x), Math.round(y), col);
          prev = [x, y];
        }
      }
    }
  } else if (stage === 2) {
    // dense pine tree line
    const base = 55;
    const ridgeLow = (x) => ridge(x, 4, [[1.5, 4, 0.3], [1, 11, 1.4]]);
    fillRidge(p, base, ridgeLow, [0x232456, 0x1a1c48, 0x14163a], null);
    for (let x = 0; x < W; x += 2) {
      const n = hash2(x >> 1, 1, 61);
      const th = 8 + Math.floor(hash2(x >> 1, 2, 61) * 16) + (n > 0.9 ? 6 : 0);
      const bx = x + (hash2(x >> 1, 3, 61) < 0.5 ? 0 : 1);
      const b = base - Math.round(ridgeLow(x)) + 2;
      const col = hash2(x >> 1, 4, 61) < 0.5 ? 0x181a46 : 0x1e2052;
      for (let k = 0; k < th; k++) {
        const half = Math.floor(((k + 1) / th) * (5 + hash2(x >> 1, 5, 61) * 3) * (0.5 + 0.5 * ((k * 3) % 5) / 5));
        for (let dx = -half; dx <= half; dx++) p.set(wrap(bx + dx), b - th + k, dx <= -half + 1 && k > 4 ? 0x2b2c66 : col);
      }
    }
    // rim light along the tops
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < 56; y++) if (p.solid(x, y)) { if (hash2(x, y, 6) < 0.35) p.set(x, y, 0x3a3478); break; }
    }
  } else {
    // near city block silhouettes
    let x = 0, i = 0;
    while (x < W) {
      let w = 14 + Math.floor(hash2(i, 1, 71) * 20);
      if (x + w > W - 14) w = W - x;
      const h = 8 + Math.floor(Math.pow(hash2(i, 2, 71), 1.3) * 24);
      const top = 55 - h;
      p.rect(x, top, w, h + 1, 0x08081c);
      p.rect(x, top, w, 1, 0x2a2a66);
      p.rect(x, top, 1, h + 1, 0x14143a);
      for (let yy = top + 4; yy < 52; yy += 5) {
        for (let xx = x + 3; xx < x + w - 2; xx += 4) {
          const r = hash2(xx, yy, 72);
          if (r < 0.2) p.rect(xx, yy, 2, 2, r < 0.08 ? 0xffe08a : r < 0.14 ? 0x7fe8ff : 0xff8ad0);
        }
      }
      if (hash2(i, 5, 71) < 0.3) {
        // rooftop neon sign
        const c = hash2(i, 6, 71) < 0.5 ? 0xff3fc8 : 0x3ff0ff;
        p.rect(x + 3, top - 3, Math.max(4, w - 8), 2, c);
        p.rect(x + 3, top - 1, Math.max(4, w - 8), 1, darken(c, 0.5));
      }
      x += w;
      i++;
    }
  }
  return p;
}
