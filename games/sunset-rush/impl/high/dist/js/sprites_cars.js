// 自車・交通車のドット絵(コードで描画)
import { mk, rect, dot, ell, line } from './pix.js';

const SH = 'rgba(0,0,0,0.42)';

// ---- 自車 40x22(後ろ姿の赤いスポーツカー) ----
function playerBase(brake, wf) {
  const { c, g } = mk(40, 22);
  const body = '#e3242e', light = '#ff6e5c', dark = '#a3121f', deep = '#5a0b17';
  const glass = '#16233d', glassHi = '#4a7db0';
  // 影
  rect(g, 3, 19, 34, 3, SH);
  rect(g, 6, 21, 28, 1, SH);
  // タイヤ
  for (const tx of [0, 34]) {
    rect(g, tx, 12, 6, 9, '#0d0d14');
    rect(g, tx + (tx ? 4 : 1), 13, 1, 7, '#2b2b38');
    for (let y = 13; y < 21; y++) if ((y + wf) % 3 === 0) rect(g, tx + 1, y, 4, 1, '#3d3d4b');
    rect(g, tx, 12, 6, 1, '#1d1d28');
  }
  // キャビン(リアウインドウ)
  rect(g, 13, 1, 14, 1, dark);
  for (let y = 2; y <= 7; y++) {
    const inset = 7 - y; // 2..0
    const x0 = 11 + Math.max(0, inset - 3), x1 = 28 - Math.max(0, inset - 3);
    rect(g, x0 - 1, y, x1 - x0 + 3, 1, y < 4 ? light : body);
  }
  for (let y = 2; y <= 6; y++) {
    const w0 = 13 - Math.floor((y - 2) / 2), w1 = 26 + Math.floor((y - 2) / 2);
    rect(g, w0, y, w1 - w0 + 1, 1, glass);
  }
  line(g, 15, 5, 19, 2, glassHi);
  line(g, 20, 6, 24, 2, '#2c507c');
  dot(g, 16, 5, '#7fb2df');
  // デッキ
  rect(g, 3, 9, 34, 5, body);
  rect(g, 4, 9, 32, 1, light);
  rect(g, 3, 10, 2, 4, light);
  rect(g, 35, 10, 2, 4, dark);
  // リアウイング
  rect(g, 4, 7, 32, 2, deep);
  rect(g, 4, 7, 32, 1, '#c1303c');
  rect(g, 3, 5, 2, 7, deep);
  rect(g, 35, 5, 2, 7, deep);
  rect(g, 3, 5, 1, 7, dark);
  // テールランプ帯
  rect(g, 4, 12, 32, 4, '#2a0a12');
  const tl = brake ? '#ff3b3b' : '#c4121f';
  const tlHi = brake ? '#ffd8c8' : '#ff5a4c';
  rect(g, 5, 12, 10, 3, tl);
  rect(g, 25, 12, 10, 3, tl);
  rect(g, 5, 12, 10, 1, tlHi);
  rect(g, 25, 12, 10, 1, tlHi);
  if (brake) {
    rect(g, 7, 13, 6, 1, '#fff2e0');
    rect(g, 27, 13, 6, 1, '#fff2e0');
  }
  // ナンバープレート
  rect(g, 16, 12, 8, 4, '#e9eaf0');
  rect(g, 17, 13, 6, 2, '#2a3a66');
  dot(g, 18, 13, '#e9eaf0'); dot(g, 20, 13, '#e9eaf0'); dot(g, 22, 14, '#e9eaf0');
  // リアバンパー/ディフューザー
  rect(g, 4, 16, 32, 3, dark);
  rect(g, 4, 16, 32, 1, '#c1303c');
  rect(g, 8, 18, 24, 1, deep);
  for (let x = 14; x < 27; x += 3) rect(g, x, 17, 1, 2, deep);
  // マフラー
  for (const ex of [9, 28]) {
    rect(g, ex, 17, 4, 3, '#1b1b24');
    rect(g, ex + 1, 17, 2, 2, '#9aa3b4');
    dot(g, ex + 1, 17, '#eef2f8');
  }
  return c;
}

// dir: 0 直進, 1 左, 2 右。上の行ほど大きくずらしてステア角を出す
function shear(base, dir) {
  if (dir === 0) return base;
  const { c, g } = mk(40, 22);
  const s = dir === 1 ? -1 : 1;
  for (let y = 0; y < 22; y++) {
    const off = s * Math.floor((21 - y) / 8) - (y >= 12 && y < 20 ? 0 : 0);
    g.drawImage(base, 0, y, 40, 1, off, y, 40, 1);
  }
  // 反対側の側面が少し見える(タイヤの膨らみ)
  const sx = s > 0 ? 0 : 39;
  rect(g, sx, 14, 1, 5, '#0d0d14');
  return c;
}

export function makePlayerFrames(brake, wf) {
  const base = playerBase(brake, wf);
  const { c, g } = mk(120, 22);
  g.drawImage(base, 0, 0);
  g.drawImage(shear(base, 1), 40, 0);
  g.drawImage(shear(base, 2), 80, 0);
  return c;
}

// ---- 交通車 ----
export const CAR_PALETTES = {
  sedan: [
    { body: '#2f6fd6', light: '#66a4ff', dark: '#1c4590' },
    { body: '#dfe3ea', light: '#ffffff', dark: '#9aa1b3' },
    { body: '#2fa85f', light: '#6be08f', dark: '#1a6a3a' },
  ],
  truck: [
    { body: '#e9edf2', light: '#ffffff', dark: '#9ba3b5', accent: '#2f6fd6', accent2: '#ffce3a' },
    { body: '#f0a62f', light: '#ffd06a', dark: '#b06a14', accent: '#7a3a14', accent2: '#ffffff' },
    { body: '#8b93a6', light: '#c3cad9', dark: '#585f72', accent: '#d8353c', accent2: '#ffffff' },
  ],
  sports: [
    { body: '#f5c518', light: '#fff07a', dark: '#b58a08' },
    { body: '#8c42e0', light: '#c48cff', dark: '#552399' },
    { body: '#1fc6d6', light: '#7af0fb', dark: '#0f8090' },
  ],
};

export function drawSedan(p) {
  const { c, g } = mk(36, 20);
  const glass = '#16233d', glassHi = '#4d80b3';
  rect(g, 3, 17, 30, 3, SH);
  for (const tx of [0, 31]) {
    rect(g, tx, 10, 5, 8, '#0d0d14');
    rect(g, tx + 1, 11, 1, 6, '#2e2e3b');
    rect(g, tx, 10, 5, 1, '#1d1d28');
  }
  // 屋根とウインドウ
  for (let y = 1; y <= 7; y++) {
    const inset = Math.max(0, 3 - y);
    rect(g, 9 - Math.max(0, y - 4) + inset, y, 18 + 2 * (Math.max(0, y - 4)) - 2 * inset, 1, y === 1 ? p.light : p.body);
  }
  for (let y = 2; y <= 6; y++) {
    const x0 = 11 - Math.floor((y - 2) / 3), x1 = 24 + Math.floor((y - 2) / 3);
    rect(g, x0, y, x1 - x0 + 1, 1, glass);
  }
  line(g, 13, 5, 16, 2, glassHi);
  line(g, 18, 6, 21, 3, '#2d5078');
  // トランク〜ボディ
  rect(g, 3, 8, 30, 2, p.light);
  rect(g, 3, 10, 30, 7, p.body);
  rect(g, 3, 10, 30, 1, p.light);
  rect(g, 30, 10, 3, 7, p.dark);
  rect(g, 3, 15, 30, 2, p.dark);
  // テールランプ
  rect(g, 4, 10, 8, 3, '#b3141f');
  rect(g, 24, 10, 8, 3, '#b3141f');
  rect(g, 4, 10, 8, 1, '#ff5548');
  rect(g, 24, 10, 8, 1, '#ff5548');
  rect(g, 12, 10, 12, 3, '#22161c');
  // プレート
  rect(g, 14, 12, 8, 3, '#eceff3');
  rect(g, 15, 13, 6, 1, '#2a3a66');
  // バンパー
  rect(g, 4, 16, 28, 1, '#20202c');
  dot(g, 8, 17, '#9aa3b4'); dot(g, 27, 17, '#9aa3b4');
  return c;
}

export function drawTruck(p) {
  const { c, g } = mk(44, 34);
  rect(g, 3, 30, 38, 4, SH);
  // コンテナ
  rect(g, 2, 0, 40, 22, p.body);
  rect(g, 2, 0, 40, 2, p.light);
  rect(g, 2, 0, 2, 22, p.light);
  rect(g, 40, 0, 2, 22, p.dark);
  rect(g, 2, 20, 40, 2, p.dark);
  // ドア合わせ・リベット
  rect(g, 21, 2, 2, 18, p.dark);
  rect(g, 22, 2, 1, 18, p.light);
  for (let y = 3; y < 20; y += 4) { dot(g, 5, y, p.dark); dot(g, 38, y, p.dark); }
  // ロゴ帯
  rect(g, 4, 7, 16, 4, p.accent);
  rect(g, 24, 7, 16, 4, p.accent);
  rect(g, 6, 8, 5, 2, p.accent2);
  rect(g, 27, 8, 5, 2, p.accent2);
  // ハンドル
  rect(g, 18, 12, 2, 4, '#30303c');
  rect(g, 24, 12, 2, 4, '#30303c');
  // アンダーライド
  rect(g, 4, 22, 36, 2, '#2c2c38');
  // シャーシ・ライト
  rect(g, 5, 24, 34, 6, '#4b4b58');
  rect(g, 5, 24, 34, 1, '#6a6a78');
  rect(g, 3, 23, 6, 4, '#b3141f');
  rect(g, 35, 23, 6, 4, '#b3141f');
  rect(g, 3, 23, 6, 1, '#ff5548');
  rect(g, 35, 23, 6, 1, '#ff5548');
  rect(g, 18, 25, 8, 4, '#ecd36a');
  rect(g, 19, 26, 6, 2, '#3a3a2a');
  // マッドフラップ
  rect(g, 10, 27, 6, 5, '#15151c');
  rect(g, 28, 27, 6, 5, '#15151c');
  // タイヤ
  for (const tx of [0, 37]) {
    rect(g, tx, 23, 7, 10, '#0d0d14');
    rect(g, tx + 1, 24, 1, 8, '#2e2e3b');
    for (let y = 25; y < 33; y += 3) rect(g, tx + 2, y, 4, 1, '#2a2a36');
    rect(g, tx, 23, 7, 1, '#1d1d28');
  }
  for (const tx of [7, 34]) rect(g, tx, 27, 3, 6, '#0d0d14');
  return c;
}

export function drawSports(p) {
  const { c, g } = mk(38, 18);
  const glass = '#16233d';
  rect(g, 3, 15, 32, 3, SH);
  for (const tx of [0, 32]) {
    rect(g, tx, 8, 6, 8, '#0d0d14');
    rect(g, tx + (tx ? 4 : 1), 9, 1, 6, '#2e2e3b');
    rect(g, tx, 8, 6, 1, '#1d1d28');
  }
  // キャビン
  for (let y = 3; y <= 6; y++) {
    const x0 = 11 - (y - 3) , x1 = 26 + (y - 3);
    rect(g, x0, y, x1 - x0 + 1, 1, y === 3 ? p.light : p.body);
  }
  rect(g, 13, 4, 12, 2, glass);
  line(g, 14, 5, 16, 4, '#4d80b3');
  // ボディ
  rect(g, 2, 6, 34, 5, p.body);
  rect(g, 2, 6, 34, 1, p.light);
  rect(g, 33, 7, 3, 4, p.dark);
  // ウイング
  rect(g, 3, 1, 32, 2, '#20202c');
  rect(g, 3, 1, 32, 1, p.dark);
  rect(g, 2, 0, 2, 6, '#20202c');
  rect(g, 34, 0, 2, 6, '#20202c');
  // テールライトバー
  rect(g, 4, 8, 30, 2, '#b3141f');
  rect(g, 4, 8, 30, 1, '#ff5a4c');
  rect(g, 17, 8, 4, 2, '#22161c');
  // ディフューザー
  rect(g, 5, 11, 28, 3, '#15151c');
  for (let x = 8; x < 31; x += 3) rect(g, x, 11, 1, 3, '#33333f');
  for (const ex of [9, 13, 23, 27]) { rect(g, ex, 12, 2, 2, '#aab2c2'); dot(g, ex, 12, '#ffffff'); }
  return c;
}

export function carSheet(type, variant) {
  const p = CAR_PALETTES[type][variant];
  return type === 'sedan' ? drawSedan(p) : type === 'truck' ? drawTruck(p) : drawSports(p);
}

// 未使用のimport抑止
void ell;
