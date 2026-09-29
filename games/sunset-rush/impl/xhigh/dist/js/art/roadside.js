// 路側物とゲートのドット絵。すべて手続き的に 1px ずつ描く。

import { Pix, shade, mix, artRng } from '../pix.js';
import { stampText } from '../font.js';

const OUT = '#1b1226';

// 葉の羽(パーム・シダ共通)。中心 (cx,cy) から角度 ang(度、上向き正)へ len だけ伸びる
function frond(p, cx, cy, ang, len, droop, cols) {
  const a = (ang * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = -Math.sin(a);
  const nx = -dy;
  const ny = dx;
  for (let i = 0; i <= len; i++) {
    const t = i / len;
    const x = cx + dx * i;
    const y = cy + dy * i + droop * t * t;
    // 小葉
    if (i >= 2 && i % 2 === 0) {
      const l = Math.max(2, Math.round((1 - t * 0.6) * (len * 0.32)));
      for (const s of [-1, 1]) {
        const ex = x + nx * s * l * 0.85;
        const ey = y + ny * s * l * 0.85 + l * 0.7;
        p.line(x, y, ex, ey, s * (nx >= 0 ? 1 : -1) > 0 ? cols.dark : cols.mid);
      }
    }
  }
  for (let i = 0; i <= len; i++) {
    const t = i / len;
    p.set(cx + dx * i, cy + dy * i + droop * t * t, cols.light);
  }
}

// ------------------------------------------------------------ ステージ 1

export function buildPalm() {
  const p = new Pix(40, 72);
  // 幹
  for (let y = 24; y <= 70; y++) {
    const t = (70 - y) / 46;
    const cx = 18 + 6 * t * t;
    const w = 5 - 1.6 * t;
    const ring = Math.floor(y / 3) % 2;
    for (let x = Math.round(cx - w / 2); x <= Math.round(cx + w / 2); x++) {
      const left = x <= Math.round(cx - w / 2) + 1;
      p.set(x, y, ring ? (left ? '#a06a3c' : '#7d4c2a') : (left ? '#8a5a32' : '#65391f'));
    }
  }
  // 根元
  for (let y = 66; y <= 70; y++) p.hline(15, 22, y, y >= 68 ? '#65391f' : '#7d4c2a');
  p.hline(13, 24, 70, '#4b2a18');
  // 葉
  const cx = 24;
  const cy = 24;
  const cols = { dark: '#146a45', mid: '#2a9a58', light: '#8ae08a' };
  for (const [ang, len, droop] of [[170, 18, 12], [140, 19, 6], [105, 15, 2], [70, 15, 2], [38, 19, 6], [8, 18, 12], [195, 14, 14], [-25, 15, 14]]) {
    frond(p, cx, cy, ang, len, droop, cols);
  }
  // ココナッツ
  p.disc(cx - 2, cy + 3, 1.6, '#4a2a18');
  p.disc(cx + 1, cy + 4, 1.6, '#5a341c');
  p.disc(cx + 3, cy + 2, 1.5, '#3c2214');
  p.outline(OUT);
  return p;
}

function rockShape(p, pts, base, light, dark, moss) {
  p.poly(pts, base);
  let minX = 99; let maxX = 0; let minY = 99; let maxY = 0;
  for (const q of pts) { minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]); minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]); }
  const w = maxX - minX;
  const h = maxY - minY;
  p.mapPixels((x, y) => {
    const u = (x - minX) / w;
    const v = (y - minY) / h;
    const lit = u * 0.7 + v * 0.9;
    if (moss && v < 0.32 && (x * 7 + y * 3) % 5 !== 0) return moss;
    if (lit < 0.38) return light;
    if (lit > 1.05 && (x + y) % 2 === 0) return dark;
    if (lit > 1.2) return dark;
    return null;
  });
  return p;
}

export function buildRock() {
  const p = new Pix(32, 22);
  p.ellipse(16, 20, 14, 2, '#20142c66');
  rockShape(p, [[2, 19], [1, 13], [5, 8], [10, 4], [18, 2], [25, 5], [29, 11], [30, 19]], '#8a7898', '#b6a4c4', '#5a4a70');
  // ひび
  p.line(14, 6, 16, 11, '#4a3c62');
  p.line(16, 11, 15, 15, '#4a3c62');
  p.line(22, 9, 24, 13, '#5a4a70');
  p.outline(OUT);
  return p;
}

export function buildShrub() {
  const p = new Pix(32, 20);
  const blobs = [[9, 13, 7], [16, 10, 8], [23, 13, 7], [13, 15, 6], [20, 15, 6], [16, 16, 6]];
  for (const [x, y, r] of blobs) p.disc(x, y, r, '#1f7a52');
  for (const [x, y, r] of blobs) p.disc(x - 1.5, y - 1.5, r * 0.7, '#2fa068', (px, py) => (px + py) % 3 !== 0 || r > 6.5);
  for (const [x, y, r] of blobs) p.disc(x - 2.5, y - 3, r * 0.35, '#72d08a');
  // 花
  for (const [x, y] of [[8, 12], [15, 8], [24, 12], [19, 15], [12, 16]]) { p.set(x, y, '#ff7ab0'); p.set(x + 1, y, '#ffd0e0'); }
  p.rect(6, 18, 20, 1, '#155238');
  p.outline(OUT);
  return p;
}

export function buildBillboard() {
  const p = new Pix(48, 56);
  // 支柱
  p.rect(10, 32, 3, 23, '#585c74');
  p.rect(35, 32, 3, 23, '#585c74');
  p.vline(10, 32, 54, '#8a90aa');
  p.vline(35, 32, 54, '#8a90aa');
  p.rect(8, 53, 7, 2, '#3a3d52');
  p.rect(33, 53, 7, 2, '#3a3d52');
  // 看板
  p.rect(2, 2, 44, 31, '#2a2440');
  for (let y = 4; y <= 30; y++) {
    const t = (y - 4) / 26;
    const c = t < 0.35 ? '#ffd27a' : t < 0.6 ? '#ff9a4a' : t < 0.85 ? '#f0507a' : '#a03a90';
    p.hline(4, 43, y, c);
  }
  // 太陽とヤシ
  p.disc(30, 21, 7, '#fff2a0');
  for (let y = 22; y <= 28; y += 2) p.hline(22, 38, y, y < 25 ? '#ff9a4a' : '#f0507a');
  p.rect(4, 26, 40, 5, '#3b2a70');
  p.line(11, 27, 12, 15, '#1a1230');
  p.line(12, 15, 7, 13, '#1a1230');
  p.line(12, 15, 16, 12, '#1a1230');
  p.line(12, 15, 9, 18, '#1a1230');
  p.line(12, 15, 15, 17, '#1a1230');
  stampText(p, 'BEACH', 6, 6, '#fffbe8');
  p.rect(2, 2, 44, 1, '#5a4c80');
  p.outline(OUT);
  return p;
}

// ------------------------------------------------------------ ステージ 2

export function buildPine() {
  const p = new Pix(40, 88);
  // 幹
  p.rect(18, 74, 4, 13, '#5a3822');
  p.vline(18, 74, 86, '#7a4c2c');
  p.vline(21, 74, 86, '#402414');
  const tiers = 6;
  for (let k = tiers - 1; k >= 0; k--) {
    const top = 3 + k * 12;
    const bot = top + 22;
    const hw = 5 + k * 2.9;
    const cx = 20;
    for (let y = top; y <= bot; y++) {
      const t = (y - top) / (bot - top);
      const half = hw * t + 0.6;
      const jag = (y === bot || y === bot - 1) ? ((y + k) % 2 ? 1 : 0) : 0;
      for (let x = Math.round(cx - half); x <= Math.round(cx + half - jag); x++) {
        const u = (x - (cx - half)) / (2 * half + 0.001);
        let c = '#1d6b4c';
        if (u < 0.32) c = '#2f9464';
        else if (u > 0.72) c = '#124a3a';
        if (y > bot - 3 && u > 0.2) c = '#124a3a';
        if (u < 0.32 && (x + y) % 3 === 0) c = '#5ac088';
        p.set(x, y, c);
      }
      if ((y - top) % 4 === 3) {
        p.set(Math.round(cx - half) - 1, y, '#1d6b4c');
        p.set(Math.round(cx + half) + 1, y, '#124a3a');
      }
    }
  }
  p.outline(OUT);
  return p;
}

export function buildBoulder() {
  const p = new Pix(40, 28);
  p.ellipse(20, 26, 18, 2.2, '#10182666');
  rockShape(p, [[2, 25], [1, 17], [4, 10], [10, 4], [20, 2], [30, 5], [36, 12], [38, 25]], '#6f6a86', '#a09cba', '#443f5e', '#3d7a48');
  p.line(18, 8, 20, 14, '#3a3552');
  p.line(20, 14, 18, 20, '#3a3552');
  p.line(28, 12, 31, 18, '#3a3552');
  p.outline(OUT);
  return p;
}

export function buildFern() {
  const p = new Pix(28, 16);
  const cols = { dark: '#124f3a', mid: '#23825a', light: '#7adf9a' };
  for (const [ang, len, droop] of [[160, 12, 6], [130, 12, 4], [100, 10, 1], [75, 10, 1], [48, 12, 4], [20, 12, 6]]) {
    frond(p, 14, 14, ang, len, droop, cols);
  }
  p.rect(11, 14, 6, 1, '#124f3a');
  p.outline(OUT);
  return p;
}

export function buildSignpost() {
  const p = new Pix(20, 44);
  p.rect(9, 18, 2, 26, '#5a5f78');
  p.vline(9, 18, 43, '#9096b0');
  p.rect(7, 42, 6, 2, '#3a3d52');
  // ひし形の標識
  p.poly([[10, 0], [19, 9], [10, 18], [1, 9]], '#231a32');
  p.poly([[10, 2], [17, 9], [10, 16], [3, 9]], '#ffd23c');
  p.poly([[10, 2], [3, 9], [10, 9]], '#ffe680');
  // 矢印(右へ曲がる)
  p.rect(6, 10, 6, 2, '#231a32');
  p.rect(10, 6, 2, 6, '#231a32');
  p.poly([[8, 4], [13, 8], [8, 8]], '#231a32');
  p.outline(OUT);
  return p;
}

// ------------------------------------------------------------ ステージ 3

export function buildLamp() {
  const p = new Pix(20, 88);
  p.rect(9, 10, 2, 76, '#4c5068');
  p.vline(9, 10, 85, '#8a90b0');
  p.rect(7, 80, 6, 6, '#3c3f56');
  p.rect(6, 85, 8, 3, '#2c2e42');
  p.hline(6, 13, 85, '#5a5e7a');
  // アーム
  p.line(10, 10, 12, 6, '#4c5068');
  p.line(11, 6, 15, 4, '#4c5068');
  p.line(11, 7, 15, 5, '#8a90b0');
  // ランプ
  p.rect(12, 3, 7, 3, '#2c2e42');
  p.rect(13, 6, 5, 2, '#fff6b0');
  p.set(12, 6, '#ffe070'); p.set(18, 6, '#ffe070');
  p.hline(13, 17, 8, '#ffd860');
  p.outline(OUT);
  return p;
}

export function buildNeon() {
  const p = new Pix(56, 52);
  p.rect(12, 32, 3, 19, '#4c5068');
  p.rect(41, 32, 3, 19, '#4c5068');
  p.vline(12, 32, 50, '#8a90b0');
  p.vline(41, 32, 50, '#8a90b0');
  p.rect(10, 49, 7, 2, '#2c2e42');
  p.rect(39, 49, 7, 2, '#2c2e42');
  // 看板
  p.rect(1, 1, 54, 32, '#171034');
  p.rect(2, 2, 52, 30, '#0d0822');
  // ネオン枠(マゼンタ)
  p.rect(3, 3, 50, 1, '#ff4fc8');
  p.rect(3, 30, 50, 1, '#ff4fc8');
  p.rect(3, 3, 1, 28, '#ff4fc8');
  p.rect(52, 3, 1, 28, '#ff4fc8');
  p.rect(4, 4, 48, 1, '#b02a90');
  p.rect(4, 29, 48, 1, '#b02a90');
  // 文字(シアン)
  stampText(p, 'NEON', 5, 7, '#1a8aa0', 2);
  stampText(p, 'NEON', 4, 6, '#5af4ff', 2);
  p.hline(8, 47, 21, '#ffe066');
  stampText(p, 'OPEN', 17, 23, '#ff9ae0');
  p.outline(OUT);
  return p;
}

function windows(p, x0, y0, cols, rows, dx, dy, w, h, rng, lit) {
  const cs = ['#ffd866', '#5af0ff', '#ff5ac8', '#ffd866', '#fff2b0'];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const on = rng() < lit;
      const col = on ? cs[Math.floor(rng() * cs.length)] : '#0f1436';
      p.rect(x0 + i * dx, y0 + j * dy, w, h, col);
      if (on) p.hline(x0 + i * dx, x0 + i * dx + w - 1, y0 + j * dy + h - 1, shade(col, -0.3));
    }
  }
}

export function buildBuilding() {
  const p = new Pix(64, 128);
  const rng = artRng(303);
  p.rect(4, 10, 56, 118, '#1a2150');
  p.rect(4, 10, 4, 118, '#28316e');
  p.rect(56, 10, 4, 118, '#11163a');
  // 屋上
  p.rect(2, 8, 60, 3, '#2c3672');
  p.rect(2, 8, 60, 1, '#4a56a0');
  p.rect(10, 4, 10, 4, '#232c60');
  p.rect(44, 3, 8, 5, '#232c60');
  p.vline(31, 0, 8, '#8a90b0');
  p.set(31, 0, '#ff3a3a');
  p.set(31, 1, '#ff8080');
  // 窓
  windows(p, 11, 16, 4, 11, 12, 9, 7, 5, rng, 0.55);
  // ネオンサイン(縦)
  p.rect(6, 30, 2, 40, '#ff4fc8');
  p.rect(5, 30, 1, 40, '#b02a90');
  // 下部の看板
  p.rect(20, 118, 24, 8, '#0d0822');
  stampText(p, 'HOTEL', 22, 119, '#5af4ff');
  p.outline('#0b0e28');
  return p;
}

export function buildBuildingB() {
  const p = new Pix(64, 112);
  const rng = artRng(707);
  // 下層
  p.rect(4, 48, 56, 64, '#251b52');
  p.rect(4, 48, 4, 64, '#3a2c78');
  p.rect(56, 48, 4, 64, '#160f36');
  // 上層
  p.rect(16, 16, 32, 34, '#2c2166');
  p.rect(16, 16, 3, 34, '#463892');
  p.rect(45, 16, 3, 34, '#1a1240');
  p.rect(14, 14, 36, 3, '#463892');
  // 尖塔
  p.rect(30, 2, 4, 12, '#463892');
  p.vline(31, 0, 3, '#8a90b0');
  p.set(31, 0, '#ff3a8a');
  // 窓
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 6; i++) {
      const on = rng() < 0.7;
      p.rect(21 + i * 4, 20 + j * 7, 3, 4, on ? (j % 2 ? '#5af0ff' : '#ff9ae0') : '#100a2c');
    }
  }
  for (let j = 0; j < 6; j++) {
    for (let i = 0; i < 6; i++) {
      const on = rng() < 0.6;
      p.rect(10 + i * 8, 54 + j * 9, 6, 5, on ? (rng() < 0.5 ? '#ffd866' : '#5af0ff') : '#100a2c');
    }
  }
  // 屋上の看板
  p.rect(22, 40, 20, 6, '#0d0822');
  p.rect(23, 41, 18, 1, '#ff4fc8');
  p.rect(23, 44, 18, 1, '#ff4fc8');
  p.outline('#0b0e28');
  return p;
}

export function buildBollard() {
  const p = new Pix(12, 16);
  p.rect(3, 3, 6, 12, '#f0f0f6');
  for (let y = 5; y <= 12; y += 4) p.rect(3, y, 6, 2, '#e0303c');
  p.vline(3, 3, 14, '#ffffff');
  p.vline(8, 3, 14, '#a4a8be');
  p.rect(4, 1, 4, 2, '#ffd860');
  p.set(5, 1, '#fff6b0');
  p.rect(1, 14, 10, 2, '#2c2e42');
  p.outline(OUT);
  return p;
}

// ------------------------------------------------------------ ゲート(160x64)

function gateFrame(p, pylonCol, beamCol, beamHi) {
  // 支柱(道路の外側に立つ)
  for (const x0 of [6, 143]) {
    p.rect(x0, 10, 11, 54, pylonCol);
    p.vline(x0, 10, 63, shade(pylonCol, 0.35));
    p.vline(x0 + 1, 10, 63, shade(pylonCol, 0.18));
    p.vline(x0 + 10, 10, 63, shade(pylonCol, -0.4));
    // 足元
    p.rect(x0 - 3, 58, 17, 6, shade(pylonCol, -0.25));
    p.hline(x0 - 3, x0 + 13, 58, shade(pylonCol, 0.3));
  }
  // 梁
  p.rect(2, 2, 156, 24, beamCol);
  p.hline(2, 157, 2, beamHi);
  p.hline(2, 157, 3, beamHi);
  p.hline(2, 157, 25, shade(beamCol, -0.5));
  p.hline(2, 157, 24, shade(beamCol, -0.3));
}

function hazard(p, x0, y0, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      p.set(x0 + x, y0 + y, ((x + y) >> 2) % 2 ? '#1b1226' : '#ffd23c');
    }
  }
}

export function buildGateCheckpoint() {
  const p = new Pix(160, 64);
  gateFrame(p, '#2f3a70', '#37427c', '#6a78c8');
  hazard(p, 6, 44, 11, 14);
  hazard(p, 143, 44, 11, 14);
  // 看板
  p.rect(28, 5, 104, 17, '#0c1030');
  p.rect(29, 6, 102, 15, '#141a4a');
  p.rect(29, 6, 102, 1, '#ffd23c');
  p.rect(29, 20, 102, 1, '#ffd23c');
  stampText(p, 'CHECKPOINT', 51, 10, '#8a6a10', 1);
  stampText(p, 'CHECKPOINT', 50, 9, '#ffe680', 1);
  // 上端の電球
  for (let i = 0; i < 12; i++) {
    const x = 8 + i * 13;
    p.rect(x, 4, 3, 2, i % 2 ? '#7cffb0' : '#ffffff');
  }
  // 支柱上のランプ
  for (const x0 of [8, 145]) {
    p.rect(x0, 26, 7, 4, '#0c1030');
    p.rect(x0 + 1, 27, 5, 2, '#5aff9a');
  }
  p.outline(OUT);
  return p;
}

export function buildGateGoal() {
  const p = new Pix(160, 64);
  gateFrame(p, '#1c1c28', '#20202c', '#5a5a70');
  // 梁のチェッカー
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 156; x++) {
      const on = ((x >> 2) + (y >> 2)) % 2 === 0;
      p.set(2 + x, 2 + y, on ? '#f6f6fa' : '#15151f');
    }
  }
  // 支柱のチェッカー
  for (const x0 of [6, 143]) {
    for (let y = 26; y < 64; y++) {
      for (let x = 0; x < 11; x++) {
        const on = ((x >> 2) + (y >> 2)) % 2 === 0;
        p.set(x0 + x, y, on ? '#f6f6fa' : '#15151f');
      }
    }
  }
  // 中央パネル
  p.rect(50, 4, 60, 20, '#d81f3a');
  p.rect(51, 5, 58, 18, '#ffffff');
  p.rect(52, 6, 56, 16, '#d81f3a');
  stampText(p, 'GOAL', 55, 8, '#7a0e22', 2);
  stampText(p, 'GOAL', 54, 7, '#ffffff', 2);
  p.outline(OUT);
  return p;
}

export function buildGateStart() {
  const p = new Pix(160, 64);
  gateFrame(p, '#3a3f56', '#454b66', '#8890b0');
  hazard(p, 6, 44, 11, 14);
  hazard(p, 143, 44, 11, 14);
  p.rect(40, 5, 80, 17, '#0c1030');
  p.rect(41, 6, 78, 15, '#141a4a');
  // 信号ライト
  const cols = ['#ff3a3a', '#ffd23c', '#4aff8a'];
  cols.forEach((c, i) => {
    p.disc(50 + i * 9, 14, 3.4, shade(c, -0.55));
    p.disc(50 + i * 9, 14, 2.6, c);
  });
  stampText(p, 'START', 82, 10, '#8a6a10', 1);
  stampText(p, 'START', 81, 9, '#ffe680', 1);
  for (const x0 of [8, 145]) {
    p.rect(x0, 26, 7, 4, '#0c1030');
    p.rect(x0 + 1, 27, 5, 2, '#5aff9a');
  }
  p.outline(OUT);
  return p;
}

export { mix };
