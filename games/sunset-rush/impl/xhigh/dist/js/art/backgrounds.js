// 背景(空・遠景・近景)。水平方向にシームレスにタイリングする 640px 幅の画像を手続き的に描く。

import { Pix, C, bayer, mix, artRng } from '../pix.js';

const W = 640;
const wx = (x) => ((Math.floor(x) % W) + W) % W;

function setW(p, x, y, c) { p.set(wx(x), y, c); }

function rectW(p, x, y, w, h, c) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) setW(p, x + i, y + j, c);
}

function discW(p, cx, cy, r, colFn) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) {
        const c = colFn(x, y, Math.sqrt(dx * dx + dy * dy) / r);
        if (c) setW(p, x, y, c);
      }
    }
  }
}

function ellipseW(p, cx, cy, rx, ry, colFn) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        const c = colFn(x, y, dx, dy);
        if (c) setW(p, x, y, c);
      }
    }
  }
}

// stops: [[y, color], ...] の間をディザで補間して縦グラデーションを塗る
function gradientStops(p, stops, y1) {
  for (let y = 0; y <= y1; y++) {
    let i = 0;
    while (i < stops.length - 2 && y > stops[i + 1][0]) i++;
    const [ya, ca] = stops[i];
    const [yb, cb] = stops[i + 1];
    const f = Math.max(0, Math.min(1, (y - ya) / Math.max(1, yb - ya)));
    for (let x = 0; x < p.w; x++) p.set(x, y, f > bayer(x, y) ? cb : ca);
  }
}

// 周期 640 の滑らかなノイズ(整数周期の正弦波の和)
function periodic(seed, terms) {
  const rng = artRng(seed);
  const parts = [];
  for (const [k, amp] of terms) parts.push([k, amp, rng() * Math.PI * 2]);
  return (x) => {
    let v = 0;
    for (const [k, amp, ph] of parts) v += amp * Math.sin((2 * Math.PI * k * x) / W + ph);
    return v;
  };
}

// 周期ノイズ(ギザギザ用): 整数格子上の値を線形補間
function valueNoise(seed, cells) {
  const rng = artRng(seed);
  const vals = [];
  for (let i = 0; i < cells; i++) vals.push(rng());
  return (x) => {
    const t = ((x % W) + W) % W / (W / cells);
    const i = Math.floor(t);
    const f = t - i;
    const a = vals[i % cells];
    const b = vals[(i + 1) % cells];
    return a + (b - a) * f;
  };
}

function stars(p, seed, count, maxY, cols) {
  const rng = artRng(seed);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rng() * W);
    const y = Math.floor(Math.pow(rng(), 1.3) * maxY);
    const c = cols[Math.floor(rng() * cols.length)];
    setW(p, x, y, c);
    if (rng() < 0.12) {
      setW(p, x - 1, y, mix(c, '#000000', 0.5));
      setW(p, x + 1, y, mix(c, '#000000', 0.5));
      setW(p, x, y - 1, mix(c, '#000000', 0.5));
      setW(p, x, y + 1, mix(c, '#000000', 0.5));
    }
  }
}

function streakCloud(p, cx, cy, rx, ry, body, top, rim) {
  ellipseW(p, cx, cy, rx, ry, (x, y, dx, dy) => {
    if (dy < -0.4) return top;
    if (dy > 0.45) return rim;
    return body;
  });
  // 尾を引く細い筋
  for (let i = 0; i < 3; i++) {
    const len = rx * (0.5 - i * 0.12);
    rectW(p, cx + rx * 0.4 - len * 0.2, cy + ry + i - 1, len, 1, i === 0 ? rim : body);
  }
}

// ---------------------------------------------------------------- ステージ 1: 夕焼けの海

export function buildSky1() {
  const p = new Pix(640, 180);
  gradientStops(p, [
    [0, '#231a5c'], [26, '#3c2a86'], [56, '#7a3a98'], [88, '#c0468e'], [112, '#ec5c86'],
    [134, '#ff8a5c'], [152, '#ffb068'], [168, '#ffd48c'], [179, '#ffe8b8'],
  ], 179);
  // 太陽のハロー
  const sx = 430; const sy = 146;
  for (let y = sy - 100; y <= sy + 34; y++) {
    for (let x = sx - 150; x <= sx + 150; x++) {
      const d = Math.hypot((x - sx) * 0.75, y - sy);
      if (d < 36 || d > 110 || y < 0 || y > 179) continue;
      const f = 1 - (d - 36) / 74;
      if (f * 0.62 > bayer(x, y)) setW(p, x, y, mix(p.get(wx(x), y), '#ffd8a0', 0.55));
    }
  }
  // 雲(太陽の光で縁が染まる)
  const cl = [[70, 36, 90, 5], [210, 62, 120, 6], [330, 98, 70, 4], [520, 48, 100, 6], [600, 84, 80, 4], [150, 118, 96, 4], [440, 116, 60, 3], [40, 100, 60, 3]];
  for (const [cx, cy, rx, ry] of cl) {
    const lowCloud = cy > 90;
    streakCloud(p, cx, cy, rx, ry,
      lowCloud ? '#c8508e' : '#7a3a90', lowCloud ? '#e0648a' : '#9a4a9c', lowCloud ? '#ffc07a' : '#ff9a7a');
  }
  // 太陽
  discW(p, sx, sy, 34, (x, y, d) => {
    const v = (y - (sy - 34)) / 68;
    if (v > 0.5 && ((y - sy) % 7) + 7 > 0 && (Math.floor(y - sy) % 6 + 6) % 6 < (v - 0.45) * 8) return null;
    if (v < 0.3) return '#fff8c8';
    if (v < 0.5) return '#ffe680';
    if (v < 0.72) return '#ffb448';
    return '#ff7a4c';
  });
  // 鳥
  for (const [bx, by] of [[300, 78], [312, 84], [322, 76], [90, 70]]) {
    setW(p, bx, by, '#3a1f5a'); setW(p, bx + 1, by + 1, '#3a1f5a'); setW(p, bx + 2, by, '#3a1f5a');
    setW(p, bx - 1, by - 1, '#3a1f5a'); setW(p, bx + 3, by - 1, '#3a1f5a');
  }
  return p;
}

export function buildFar1() {
  const p = new Pix(640, 96);
  const rng = artRng(21);
  const seaTop = 74;
  // 海面(水平線が明るく、手前が濃い)
  const seaCols = ['#ffc890', '#ff9a86', '#e8688e', '#b0508e', '#7a3f8c'];
  for (let y = seaTop; y < 96; y++) {
    const pos = ((y - seaTop) / (96 - seaTop)) * (seaCols.length - 1);
    const i = Math.min(seaCols.length - 2, Math.floor(pos));
    const f = pos - i;
    for (let x = 0; x < 640; x++) p.set(x, y, f > bayer(x, y) ? seaCols[i + 1] : seaCols[i]);
  }
  // 島(遠くほど淡い)
  const islands = [[80, 60, 15, '#8a4a90'], [250, 34, 8, '#8a4a90'], [330, 46, 12, '#6a3a86'], [520, 78, 22, '#5a2f7c'], [610, 30, 9, '#8a4a90']];
  const noise = valueNoise(5, 64);
  for (const [cx, hw, h, col] of islands) {
    for (let dx = -hw; dx <= hw; dx++) {
      const t = Math.abs(dx) / hw;
      const hh = Math.round(h * (1 - Math.pow(t, 1.6)) * (0.85 + 0.3 * noise(cx + dx)));
      for (let k = 0; k < hh; k++) {
        const y = seaTop - 1 - k;
        let c = col;
        if (k === hh - 1 && dx < hw * 0.2) c = '#e0708a'; // 夕日を受けた縁
        else if (k < 2) c = mix(col, '#c0608a', 0.5);
        setW(p, cx + dx, y, c);
      }
    }
  }
  // 灯台
  for (let y = 0; y < 12; y++) {
    setW(p, 522, seaTop - 22 - y, y % 4 < 2 ? '#f6ecf2' : '#d84a5a');
    setW(p, 523, seaTop - 22 - y, y % 4 < 2 ? '#f6ecf2' : '#d84a5a');
  }
  rectW(p, 521, seaTop - 35, 4, 2, '#ffe680');
  // ヨット
  for (const [bx, by] of [[190, seaTop + 7], [400, seaTop + 4]]) {
    for (let k = 0; k < 7; k++) rectW(p, bx - Math.floor(k / 2), by - k, 1 + Math.floor(k / 2) + 1, 1, '#fff2e8');
    rectW(p, bx - 4, by + 1, 9, 1, '#3a1f5a');
  }
  // きらめき
  for (let i = 0; i < 90; i++) {
    const y = seaTop + 1 + Math.floor(Math.pow(rng(), 1.4) * 21);
    const x = Math.floor(rng() * 640);
    const len = 2 + Math.floor(rng() * (2 + (y - seaTop) * 0.5));
    const bright = rng() < 0.5;
    rectW(p, x, y, len, 1, bright ? '#ffe8a0' : '#ffb070');
  }
  for (let i = 0; i < 40; i++) {
    const y = seaTop + 6 + Math.floor(rng() * 15);
    rectW(p, Math.floor(rng() * 640), y, 2 + Math.floor(rng() * 5), 1, '#6a3a8a');
  }
  return p;
}

export function buildNear1() {
  const p = new Pix(640, 56);
  const dune = periodic(9, [[3, 3.5], [7, 2.2], [13, 1.4]]);
  const dark = '#3a1f58';
  for (let x = 0; x < 640; x++) {
    const h = Math.max(1, Math.round(4.5 + 0.75 * dune(x)));
    for (let k = 0; k < h; k++) {
      p.set(x, 55 - k, k === h - 1 ? '#6a3a7a' : k > h - 3 ? '#4a2a68' : k < 1 ? '#2a1444' : dark);
    }
  }
  // ヤシのシルエット
  const palms = [[64, 34, 1], [206, 42, -1], [352, 30, 1], [520, 38, -1], [590, 26, 1]];
  for (const [x0, height, lean] of palms) {
    const base = 55 - Math.max(1, Math.round(4.5 + 0.75 * dune(x0))) + 3;
    for (let k = 0; k < height; k++) {
      const t = k / height;
      const x = x0 + lean * Math.round(6 * t * t);
      const y = base - k;
      rectW(p, x, y, 2, 1, dark);
    }
    const topX = x0 + lean * 6;
    const topY = base - height;
    for (const [ang, len] of [[160, 11], [130, 12], [90, 8], [50, 12], [20, 11], [200, 9], [-20, 9]]) {
      const a = (ang * Math.PI) / 180;
      for (let i = 0; i <= len; i++) {
        const t = i / len;
        const fx = topX + Math.cos(a) * i;
        const fy = topY - Math.sin(a) * i + t * t * 8;
        setW(p, fx, fy, dark);
        setW(p, fx, fy + 1, dark);
        if (i % 2 === 0) setW(p, fx, fy + 2, dark);
      }
    }
  }
  return p;
}

// ---------------------------------------------------------------- ステージ 2: 黄昏の山

export function buildSky2() {
  const p = new Pix(640, 180);
  gradientStops(p, [
    [0, '#0a0c34'], [34, '#171a58'], [72, '#33288a'], [104, '#5e3a9c'], [132, '#8e4a9c'],
    [154, '#c85c8c'], [168, '#ee8a78'], [179, '#ffb488'],
  ], 179);
  stars(p, 77, 90, 96, ['#ffffff', '#cfd8ff', '#ffe8d0', '#9fa8ff']);
  // 細い月
  const mx = 160; const my = 46;
  discW(p, mx, my, 10, (x, y, d) => {
    const dx = x + 0.5 - (mx + 5);
    const dy = y + 0.5 - (my - 2);
    if (dx * dx + dy * dy <= 9.5 * 9.5) return null;
    return d > 0.7 ? '#fff2d8' : '#fffbea';
  });
  for (let y = my - 22; y <= my + 22; y++) {
    for (let x = mx - 26; x <= mx + 26; x++) {
      const d = Math.hypot(x - mx, y - my);
      if (d > 11 && d < 26 && (1 - (d - 11) / 15) * 0.4 > bayer(x, y)) setW(p, x, y, mix(p.get(wx(x), y), '#b8a8ff', 0.4));
    }
  }
  const cl = [[80, 64, 100, 4], [260, 92, 130, 5], [420, 60, 90, 4], [560, 108, 110, 5], [330, 132, 80, 3], [30, 128, 70, 3]];
  for (const [cx, cy, rx, ry] of cl) {
    streakCloud(p, cx, cy, rx, ry, cy > 100 ? '#8a4a98' : '#3e2a86', cy > 100 ? '#a85a9c' : '#5a3a9a', cy > 100 ? '#f08a80' : '#c86a9a');
  }
  return p;
}

function pineTri(p, cx, baseY, h, col, hi, lo) {
  const tiers = Math.max(2, Math.round(h / 9));
  for (let t = 0; t < tiers; t++) {
    const top = baseY - h + Math.round((t * h) / (tiers + 0.6));
    const bot = top + Math.round(h / tiers) + 4;
    const hw = 2 + ((t + 1) * h) / (tiers * 4.2);
    for (let y = top; y <= bot; y++) {
      const f = (y - top) / (bot - top);
      const half = hw * f;
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        setW(p, x, y, x < cx - half * 0.3 && hi ? hi : x > cx + half * 0.4 && lo ? lo : col);
      }
    }
  }
  rectW(p, cx, baseY - 2, 1, 3, col);
}

export function buildFar2() {
  const p = new Pix(640, 96);
  const n1 = periodic(31, [[2, 14], [5, 9], [11, 4], [23, 2]]);
  const j1 = valueNoise(3, 160);
  const n2 = periodic(32, [[3, 10], [7, 6], [17, 3], [29, 1.5]]);
  const j2 = valueNoise(4, 213);
  const n3 = periodic(33, [[4, 5], [9, 3], [19, 2]]);
  const fog = '#a05a9e';
  for (let x = 0; x < 640; x++) {
    // 奥の山脈
    const h1 = Math.round(52 + n1(x) + j1(x) * 5);
    for (let k = 0; k < h1; k++) {
      const y = 95 - k;
      let c = '#6a4a9a';
      if (k === h1 - 1) c = '#d47aa8';
      else if (k > h1 - 4) c = '#8a5aa4';
      p.set(x, y, c);
    }
    // 中の山脈
    const h2 = Math.round(38 + n2(x) + j2(x) * 6);
    for (let k = 0; k < h2; k++) {
      const y = 95 - k;
      let c = '#41307a';
      if (k === h2 - 1) c = '#b060a0';
      else if (k > h2 - 3) c = '#5a3e8a';
      p.set(x, y, c);
    }
    // 手前の丘
    const h3 = Math.round(16 + n3(x));
    for (let k = 0; k < h3; k++) {
      p.set(x, 95 - k, k === h3 - 1 ? '#5a4a9a' : '#241c58');
    }
  }
  // 手前の丘に松の点描
  const rng = artRng(41);
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rng() * 640);
    const h3 = Math.round(16 + n3(x));
    const h = 5 + Math.floor(rng() * 5);
    for (let k = 0; k < h; k++) {
      const half = Math.floor((k * 1.6) / h * 2);
      rectW(p, x - Math.floor(half / 2), 95 - h3 - h + k + 2, 1 + half, 1, '#1a1650');
    }
  }
  // 霞(下ほど霧色)
  p.mapPixels((x, y, c) => {
    if (y < 60) return null;
    const f = (y - 60) / 36;
    if (f * 0.75 > bayer(x, y)) return mix(c, fog, 0.55);
    return null;
  });
  return p;
}

export function buildNear2() {
  const p = new Pix(640, 56);
  const rng = artRng(51);
  const dark = '#0e2a34';
  const hi = '#1f5058';
  // 下草のライン
  const gr = periodic(53, [[6, 2], [15, 1.4]]);
  for (let x = 0; x < 640; x++) {
    const h = Math.round(7 + gr(x));
    for (let k = 0; k < h; k++) p.set(x, 55 - k, dark);
  }
  let x = 0;
  while (x < 640) {
    const h = 20 + Math.floor(rng() * 32);
    pineTri(p, x, 56, h, dark, hi, '#081820');
    x += 9 + Math.floor(rng() * 17);
  }
  return p;
}

// ---------------------------------------------------------------- ステージ 3: ネオンの夜

export function buildSky3() {
  const p = new Pix(640, 180);
  gradientStops(p, [
    [0, '#02030d'], [40, '#050822'], [90, '#0c1040'], [128, '#1c1258'], [154, '#40186c'],
    [170, '#6a2482'], [179, '#8e3090'],
  ], 179);
  stars(p, 99, 170, 120, ['#ffffff', '#cfe8ff', '#8ad8ff', '#ffd0f0', '#ffffff']);
  // 月
  const mx = 250; const my = 56;
  for (let y = my - 50; y <= my + 50; y++) {
    for (let x = mx - 60; x <= mx + 60; x++) {
      const d = Math.hypot(x - mx, y - my);
      if (d > 20 && d < 48 && (1 - (d - 20) / 28) * 0.55 > bayer(x, y)) setW(p, x, y, mix(p.get(wx(x), y), '#5a78d8', 0.5));
    }
  }
  discW(p, mx, my, 20, (x, y, d) => {
    const lit = (x - mx) * -0.5 + (y - my) * -0.4;
    if (lit > 6) return '#c4d2f0';
    return d > 0.86 ? '#d8e4ff' : '#eef4ff';
  });
  for (const [cx, cy, r] of [[-6, -4, 4], [6, 5, 5], [-2, 9, 3], [8, -8, 2.5], [-11, 4, 2.5]]) {
    discW(p, mx + cx, my + cy, r, (x, y, d) => (d > 0.75 ? '#c0cef0' : '#a9b8e0'));
  }
  const cl = [[60, 90, 110, 4], [330, 70, 130, 4], [470, 118, 100, 5], [580, 60, 70, 3], [180, 130, 90, 4]];
  for (const [cx, cy, rx, ry] of cl) streakCloud(p, cx, cy, rx, ry, '#1c1250', '#2a1a6a', cy > 100 ? '#d040a8' : '#7a2a9a');
  return p;
}

function skyline(p, seed, minH, maxH, minW, maxW, body, edge, winProb, winCols, baseY) {
  const rng = artRng(seed);
  let x = 0;
  const bs = [];
  while (x < 640) {
    let w = minW + Math.floor(rng() * (maxW - minW));
    if (640 - (x + w) < minW) w = 640 - x;
    const h = minH + Math.floor(rng() * (maxH - minH));
    bs.push([x, w, h, rng]);
    x += w;
  }
  for (const [bx, bw, bh] of bs) {
    for (let y = 0; y < bh; y++) {
      for (let dx = 0; dx < bw; dx++) {
        let c = body;
        if (y === bh - 1) c = edge;
        else if (dx === 0) c = edge;
        p.set(bx + dx, baseY - y, c);
      }
    }
    // アンテナ
    if (rng() < 0.4) {
      const ax = bx + Math.floor(bw / 2);
      for (let k = 1; k < 8; k++) p.set(ax, baseY - bh - k, edge);
      p.set(ax, baseY - bh - 8, '#ff3a5a');
    }
    // 窓
    if (winProb > 0) {
      for (let y = 3; y < bh - 3; y += 4) {
        for (let dx = 2; dx < bw - 2; dx += 3) {
          if (rng() < winProb) p.set(bx + dx, baseY - y, winCols[Math.floor(rng() * winCols.length)]);
        }
      }
    }
    // ネオンのライン
    if (rng() < 0.25 && bh > 30) {
      const col = rng() < 0.5 ? '#ff4fc8' : '#4af0ff';
      const ny = baseY - 6 - Math.floor(rng() * (bh - 16));
      for (let dx = 1; dx < bw - 1; dx++) p.set(bx + dx, ny, col);
    }
  }
}

export function buildFar3() {
  const p = new Pix(640, 96);
  skyline(p, 301, 18, 52, 16, 34, '#221a58', '#3a2e8a', 0.08, ['#7a6ad0', '#5a8ae0'], 95);
  skyline(p, 302, 26, 82, 14, 36, '#120c34', '#2a2072', 0.32, ['#ffd866', '#5af0ff', '#ff5ac8', '#ffd866'], 95);
  // 下ほど紫の靄
  p.mapPixels((x, y, c) => {
    if (y < 70) return null;
    const f = (y - 70) / 26;
    return f * 0.7 > bayer(x, y) ? mix(c, '#8e3090', 0.45) : null;
  });
  return p;
}

export function buildNear3() {
  const p = new Pix(640, 56);
  const rng = artRng(311);
  let x = 6;
  while (x < 610) {
    const w = Math.min(28 + Math.floor(rng() * 50), 634 - x);
    if (w < 20) break;
    const h = 16 + Math.floor(rng() * 38);
    const cols = ['#0a0620', '#170c38'];
    for (let dx = 0; dx < w && x + dx < 640; dx++) {
      for (let y = 0; y < h; y++) {
        let c = cols[0];
        if (y === h - 1 || dx === 0) c = '#2c2078';
        p.set(x + dx, 55 - y, c);
      }
    }
    for (let y = 4; y < h - 3; y += 5) {
      for (let dx = 3; dx < w - 3; dx += 4) {
        if (rng() < 0.22) p.set(x + dx, 55 - y, rng() < 0.5 ? '#ffd866' : rng() < 0.5 ? '#ff5ac8' : '#5af0ff');
      }
    }
    if (rng() < 0.5) {
      const col = rng() < 0.5 ? '#ff4fc8' : '#4af0ff';
      for (let y = 4; y < h - 4; y++) p.set(x + w - 2, 55 - y, col);
    }
    x += w + 4 + Math.floor(rng() * 34);
  }
  return p;
}

export { C };
