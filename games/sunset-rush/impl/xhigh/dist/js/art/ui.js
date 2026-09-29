// タイトルロゴ(ドット絵)とエフェクト(煙・砂煙・火花)

import { Pix, sheet, bayer, mix, shade } from '../pix.js';

// ---------------------------------------------------------------- ロゴ 240x72

// 文字の骨格(セル 18x26、線幅 5 のストローク)。各要素は [x,y] の折れ線
const LETTERS = {
  S: [[[16, 3.5], [2.5, 3.5], [2.5, 13], [15.5, 13], [15.5, 22.5], [2, 22.5]]],
  U: [[[2.5, 1], [2.5, 22.5], [15.5, 22.5], [15.5, 1]]],
  N: [[[2.5, 25], [2.5, 1]], [[15.5, 25], [15.5, 1]], [[2.5, 3], [15.5, 23]]],
  E: [[[2.5, 1], [2.5, 25]], [[2.5, 3.5], [17, 3.5]], [[2.5, 13], [15, 13]], [[2.5, 22.5], [17, 22.5]]],
  T: [[[0.5, 3.5], [17.5, 3.5]], [[9, 3.5], [9, 25]]],
  R: [[[2.5, 1], [2.5, 25]], [[2.5, 3.5], [13.5, 3.5], [15.5, 5.5], [15.5, 11], [13.5, 13], [2.5, 13]], [[8, 14], [15.5, 25]]],
  H: [[[2.5, 1], [2.5, 25]], [[15.5, 1], [15.5, 25]], [[2.5, 13], [15.5, 13]]],
};

export function buildLogo() {
  const W = 240; const H = 72;
  const TEXT = 'SUNSET RUSH';
  const CELL = 21;
  const x0 = 6;
  const y0 = 20;
  const skew = 0.22;

  // 1. 文字のマスク(白で描いて 2 値化)
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.lineWidth = 5;
  g.strokeStyle = '#fff';
  g.lineCap = 'butt';
  g.lineJoin = 'miter';
  g.miterLimit = 3;
  let cx = x0;
  for (const ch of TEXT) {
    if (ch === ' ') { cx += 12; continue; }
    g.setTransform(1, 0, -skew, 1, cx + skew * 26, y0);
    for (const stroke of LETTERS[ch]) {
      g.beginPath();
      stroke.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    }
    cx += CELL;
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  const img = g.getImageData(0, 0, W, H).data;
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = img[i * 4 + 3] >= 110 ? 1 : 0;
  const m = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : mask[y * W + x]);

  const p = new Pix(W, H);

  // 2. 背景の太陽(横縞で抜く)
  const sx = 120; const sy = 34; const sr = 27;
  const sunCols = ['#fff6b8', '#ffe070', '#ffb040', '#ff7a48', '#e8405e'];
  for (let y = sy - sr; y <= sy + sr; y++) {
    for (let x = sx - sr; x <= sx + sr; x++) {
      const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
      if (d > sr) continue;
      const v = (y - (sy - sr)) / (2 * sr);
      if (v > 0.42 && (y % 5) < (v - 0.38) * 7) continue;
      p.set(x, y, sunCols[Math.min(4, Math.floor(v * 5))]);
    }
  }
  // 太陽のまわりのハロー
  for (let y = 0; y < 60; y++) {
    for (let x = 60; x < 180; x++) {
      const d = Math.hypot(x + 0.5 - sx, (y + 0.5 - sy) * 1.1);
      if (d > sr + 1 && d < sr + 12 && (1 - (d - sr) / 12) * 0.5 > bayer(x, y)) p.set(x, y, '#ff9a6a');
    }
  }

  // 3. 影・縁取り・塗り
  const dil = (r) => {
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let on = 0;
        for (let dy = -r; dy <= r && !on; dy++) for (let dx = -r; dx <= r; dx++) if (m(x + dx, y + dy)) { on = 1; break; }
        out[y * W + x] = on;
      }
    }
    return out;
  };
  const d1 = dil(1);
  const d2 = dil(2);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // 影(右下にずらす)
      const sxx = x - 3; const syy = y - 3;
      if (sxx >= 0 && syy >= 0 && d2[syy * W + sxx] && !d2[y * W + x]) p.set(x, y, '#1a0a3acc');
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d2[y * W + x] && !d1[y * W + x]) p.set(x, y, '#2a0f4a');
      else if (d1[y * W + x] && !mask[y * W + x]) p.set(x, y, '#fff0c8');
    }
  }
  const fillCols = [
    [0, '#fffbe0'], [3, '#ffe36a'], [8, '#ffb238'], [13, '#ff7a3c'], [18, '#f03c6a'], [23, '#b02a8e'],
  ];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      const ry = y - y0;
      let c = fillCols[0][1];
      for (const [t, col] of fillCols) if (ry >= t) c = col;
      // 上端のハイライト・下端の影
      if (!m(x, y - 1)) c = '#ffffff';
      else if (!m(x, y + 1)) c = shade(c, -0.35);
      else if (!m(x - 1, y)) c = shade(c, 0.25);
      else if (!m(x + 1, y)) c = shade(c, -0.2);
      // クローム風の細い切れ目
      if (ry === 15 || ry === 16) c = ry === 15 ? '#5a1466' : shade(c, -0.15);
      p.set(x, y, c);
    }
  }

  // 4. 下のスピードライン
  const lines = [[20, 220, 57, '#ffd070'], [34, 206, 61, '#ff9a54'], [52, 188, 65, '#f0507a'], [74, 166, 69, '#a03a9c']];
  for (const [a, b, y, col] of lines) {
    for (let x = a; x <= b; x++) {
      const edge = Math.min(x - a, b - x);
      if (edge < 6 && edge % 2 === 1) continue;
      p.set(x, y, col);
      if (y < 66 && edge > 4) p.set(x, y + 1, shade(col, -0.35));
    }
  }
  // 火花
  for (const [x, y] of [[8, 22], [232, 20], [118, 4], [200, 8]]) {
    p.set(x, y, '#ffffff');
    p.set(x - 1, y, '#ffd8a0'); p.set(x + 1, y, '#ffd8a0'); p.set(x, y - 1, '#ffd8a0'); p.set(x, y + 1, '#ffd8a0');
  }
  return p;
}

// ---------------------------------------------------------------- エフェクト

// 煙 12x12 x 4 フレーム(だんだん大きく・薄くなる)
export function buildSmoke() {
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const p = new Pix(12, 12);
    const r = 2.6 + f * 1.15;
    const alpha = [1, 0.85, 0.62, 0.4][f];
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 12; x++) {
        const dx = x + 0.5 - 6;
        const dy = y + 0.5 - 6;
        // 縁をいびつにする
        const wob = 1 + 0.22 * Math.sin(Math.atan2(dy, dx) * 3 + f * 1.7);
        const d = Math.hypot(dx, dy) / wob;
        if (d > r) continue;
        if (alpha < 1 && bayer(x, y) > alpha + 0.1 && d > r * 0.45) continue;
        const lit = dx * -0.5 + dy * -0.6;
        let c = '#c4c4d4';
        if (lit > 1.6) c = '#f4f4fa';
        else if (lit < -1.8) c = '#7c7c94';
        else if (d > r * 0.8) c = '#a0a0b8';
        p.set(x, y, c);
      }
    }
    frames.push(p);
  }
  return sheet(frames);
}

// 砂煙 8x8 x 3
export function buildDust() {
  const frames = [];
  for (let f = 0; f < 3; f++) {
    const p = new Pix(8, 8);
    const r = 1.8 + f * 0.9;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const d = Math.hypot(x + 0.5 - 4, y + 0.5 - 4);
        if (d > r) continue;
        if (f === 2 && bayer(x, y) > 0.55) continue;
        p.set(x, y, d < r * 0.4 ? '#f8e8c0' : d < r * 0.75 ? '#e0c088' : '#b08858');
      }
    }
    frames.push(p);
  }
  return sheet(frames);
}

// 火花 6x6 x 3
export function buildSpark() {
  const f0 = new Pix(6, 6);
  f0.rect(2, 2, 2, 2, '#fffbd0');
  f0.set(2, 0, '#ffd040'); f0.set(3, 0, '#ffd040'); f0.set(2, 5, '#ffd040'); f0.set(3, 5, '#ffd040');
  f0.set(0, 2, '#ffd040'); f0.set(0, 3, '#ffd040'); f0.set(5, 2, '#ffd040'); f0.set(5, 3, '#ffd040');
  const f1 = new Pix(6, 6);
  f1.set(2, 2, '#ffffff'); f1.set(3, 3, '#ffffff'); f1.set(2, 3, '#ffe070'); f1.set(3, 2, '#ffe070');
  f1.set(0, 0, '#ff9a30'); f1.set(5, 0, '#ff9a30'); f1.set(0, 5, '#ff9a30'); f1.set(5, 5, '#ff9a30');
  f1.set(1, 1, '#ffd040'); f1.set(4, 1, '#ffd040'); f1.set(1, 4, '#ffd040'); f1.set(4, 4, '#ffd040');
  const f2 = new Pix(6, 6);
  f2.set(0, 1, '#ff7a30'); f2.set(5, 1, '#ff7a30'); f2.set(1, 5, '#ff7a30'); f2.set(4, 4, '#ffb040');
  f2.set(3, 0, '#ffb040'); f2.set(2, 3, '#ffe070');
  return sheet([f0, f1, f2]);
}

export { mix };
