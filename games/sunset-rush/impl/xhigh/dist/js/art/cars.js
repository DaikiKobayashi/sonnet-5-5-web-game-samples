// 車のドット絵(プレイヤー車・交通車)。後ろ姿。左半分の文字列アートを鏡写しにして作る。

import { Pix, shade, mix } from '../pix.js';

// 文字列アート(右端 = 中心列)を鏡写しにして w × h の Pix にする
function fromHalf(rows, pal, w, h) {
  const hw = w / 2;
  const half = new Pix(hw, h);
  rows.forEach((r, y) => {
    const off = hw - r.length;
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      if (ch === '.' || ch === ' ') continue;
      if (!pal[ch]) throw new Error(`car palette missing '${ch}'`);
      half.set(off + x, y, pal[ch]);
    }
  });
  const p = new Pix(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < hw; x++) {
      const c = half.get(x, y);
      if (c[3] === 0) continue;
      p.set(x, y, c);
      p.set(w - 1 - x, y, c);
    }
  }
  return p;
}

// ボディ色から 4 段階の色を作る
function bodyPalette(base) {
  return {
    R: base,
    r: shade(base, -0.34),
    H: shade(base, 0.28),
    h: shade(base, 0.6),
  };
}

const COMMON = {
  K: '#171221',
  G: '#1f3352',
  g: '#4f86b8',
  T: '#e8182a',
  O: '#ff7a30',
  t: '#8e1024',
  D: '#2b2536',
  d: '#443e55',
  B: '#14121a',
  b: '#3d3948',
  S: '#c3c8d8',
  s: '#6c7086',
  W: '#f2f2f6',
  w: '#aeb0c4',
  Z: '#0a081266',
  z: '#0a081299',
};

// タイヤ(w × h)。frame でトレッドの位置を入れ替える
function drawTire(p, x, y, w, h, frame) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const edgeX = i === 0 || i === w - 1;
      const edgeY = j === 0 || j === h - 1;
      if ((edgeX && edgeY)) continue;
      let c = '#14121a';
      if (edgeX || edgeY) c = '#0b0910';
      else if ((j + frame) % 3 === 0) c = '#3d3948';
      else if (i === 1) c = '#26232f';
      p.set(x + i, y + j, c);
    }
  }
}

// ---------------------------------------------------------------- プレイヤー車(40x22)

const PLAYER_ROWS = [
  'KKKKKKKK',
  'KHHHHHHH',
  'KRGGGGGGG',
  'KRRGGGGgGG',
  'KRRGGGgGGG',
  'KRRRGGGGGGG',
  'KRRRGGGgGGGG',
  'KRRRRKKKKKKKK',
  'KHHHHHHHHHHHHHHHH',
  'KRRRRRRRRRRRRRRRRR',
  'KKKKKKKKKKKKKRRRRR',
  'KKOOOOOOOOOOKDDDDD',
  'KKTTTTTTTTTTKDWWWW',
  'KKttttttttttKDwwww',
  'KKKKKKKKKKKKKDDDDD',
  'KRRRDDDDDDDDDDDDDD',
  'KrrrDDdDDdDDdDDdDD',
  'KrrKDDsSSSDDDDDDDD',
  'KKKKKKKKKKKKKKKKKK',
];

const PLAYER_PAL = { ...COMMON, ...bodyPalette('#e4243c') };

// dir: 0 直進 / 1 左 / 2 右。brake: ブレーキランプ点灯。anim: -1 なし / 0,1 走行アニメ
export function buildPlayerCar(dir = 0, brake = false, anim = -1) {
  const p = fromHalf(PLAYER_ROWS, PLAYER_PAL, 40, 22);
  // 下のシャドウ
  for (let y = 19; y <= 21; y++) {
    for (let x = 6; x <= 33; x++) p.set(x, y, y === 21 ? '#0a08124d' : '#0a081280');
  }
  // 排気アニメ(ふかし)
  if (anim >= 0) {
    const puff = anim === 0 ? ['#9a9cb0', '#c4c6d6'] : ['#c4c6d6', '#9a9cb0'];
    p.set(10, 19, puff[0]); p.set(29, 19, puff[0]);
    p.set(9, 20, puff[1]); p.set(30, 20, puff[1]);
  }
  // タイヤ
  const fr = anim < 0 ? 0 : anim;
  drawTire(p, 0, 14, 7, 8, fr);
  drawTire(p, 33, 14, 7, 8, fr);

  if (brake) applyBrake(p);

  if (dir === 0) return p;
  // 旋回: 上のほうほど横にずらして「向きが変わった」ように見せ、旋回側の側面(暗い赤)をのぞかせる
  const s = dir === 1 ? -1 : 1;
  const q = p.shear((y) => (y <= 3 ? 2 * s : y <= 8 ? s : y <= 10 ? s : 0));
  const base = dir === 1 ? 2 : 37;
  for (let y = 10; y <= 18; y++) {
    q.set(base, y, '#8a1226');
    q.set(base + (dir === 1 ? -1 : 1), y, '#8a1226');
  }
  return q;
}

function applyBrake(p) {
  p.mapPixels((x, y, c) => {
    if (c[0] === 0xe8 && c[1] === 0x18 && c[2] === 0x2a) return '#ff5a4a'; // T
    if (c[0] === 0xff && c[1] === 0x7a && c[2] === 0x30) return '#ffd27a'; // O
    if (c[0] === 0x8e && c[1] === 0x10 && c[2] === 0x24) return '#ff2a30'; // t
    return null;
  });
  // 点灯の芯とにじみ
  for (let x = 5; x <= 13; x++) { p.set(x, 12, '#fff0b0'); p.set(39 - x, 12, '#fff0b0'); }
  for (let x = 4; x <= 13; x++) { p.set(x, 11, '#ffb060'); p.set(39 - x, 11, '#ffb060'); }
  for (let x = 3; x <= 14; x++) { p.set(x, 9, '#ff8a70b0'); p.set(39 - x, 9, '#ff8a70b0'); }
}

// ---------------------------------------------------------------- セダン(36x20)

const SEDAN_ROWS = [
  'KKKKKKKKK',
  'KHHHHHHHHH',
  'KRGGGGGGGGG',
  'KRRGGGGgGGGG',
  'KRRGGGgGGGGG',
  'KRRRGGGGGGGGG',
  'KRRRGGGGGGGGG',
  'KRRRRKKKKKKKKK',
  'KHHHHHHHHHHHHHHHH',
  'KRRRRRRRRRRRRRRRRR',
  'KROOOOOOORRDDDDDDD',
  'KRTTTTTTTRRDDWWWWD',
  'KRttttttRRRDDwwwwD',
  'KrrDDDDDDDDDDDDDDD',
  'KrrDdDDdDDdDDdDDdD',
  'KKKKKKKKKKKKKKKKKK',
];

export const SEDAN_COLORS = ['#3b78e0', '#e9e9f2', '#f2c236'];

export function buildSedan(variant = 0) {
  const pal = { ...COMMON, ...bodyPalette(SEDAN_COLORS[variant % SEDAN_COLORS.length]) };
  const p = fromHalf(SEDAN_ROWS, pal, 36, 20);
  for (let y = 16; y <= 19; y++) for (let x = 5; x <= 30; x++) p.set(x, y, y >= 18 ? '#0a08124d' : '#0a081280');
  drawTire(p, 1, 10, 6, 8, 0);
  drawTire(p, 29, 10, 6, 8, 0);
  return p;
}

// ---------------------------------------------------------------- トラック(44x34)

export const TRUCK_COLORS = ['#e9e9f2', '#3f8fd8', '#f08a30'];

export function buildTruck(variant = 0) {
  const w = 44; const h = 34;
  const base = TRUCK_COLORS[variant % TRUCK_COLORS.length];
  const bp = bodyPalette(base);
  const p = new Pix(w, h);
  // 荷台(箱)
  p.rect(1, 0, 42, 22, '#171221');
  p.rect(2, 1, 40, 20, base);
  p.hline(2, 41, 1, bp.H);
  p.hline(2, 41, 2, bp.H);
  for (let y = 5; y <= 19; y += 5) p.hline(2, 41, y, bp.r);
  // 観音開きのドア
  p.vline(21, 2, 20, bp.r);
  p.vline(22, 2, 20, bp.r);
  p.vline(20, 2, 20, bp.H);
  p.vline(23, 2, 20, bp.H);
  // 取っ手とロック
  p.rect(18, 10, 2, 3, '#443e55');
  p.rect(24, 10, 2, 3, '#443e55');
  // 側面の影
  p.vline(2, 2, 20, bp.r);
  p.vline(41, 2, 20, bp.r);
  // 下回り(フレーム)
  p.rect(3, 22, 38, 3, '#2b2536');
  p.hline(3, 40, 22, '#171221');
  // テールランプ
  for (const x0 of [3, 35]) {
    p.rect(x0, 23, 6, 4, '#171221');
    p.rect(x0 + 1, 24, 4, 2, '#e8182a');
    p.set(x0 + 1, 24, '#ff7a30'); p.set(x0 + 2, 24, '#ff7a30'); p.set(x0 + 3, 24, '#ff7a30'); p.set(x0 + 4, 24, '#ff7a30');
  }
  // バンパー
  p.rect(9, 25, 26, 3, '#443e55');
  p.hline(9, 34, 25, '#7b7492');
  p.rect(9, 28, 26, 1, '#171221');
  // ナンバー
  p.rect(17, 25, 10, 3, '#f2f2f6');
  p.hline(17, 26, 27, '#aeb0c4');
  // 泥除け
  p.rect(9, 27, 5, 4, '#171221');
  p.rect(30, 27, 5, 4, '#171221');
  // タイヤ
  drawTire(p, 2, 25, 8, 8, 0);
  drawTire(p, 34, 25, 8, 8, 0);
  // 影
  for (let x = 6; x <= 37; x++) p.set(x, 33, '#0a08124d');
  for (let x = 12; x <= 31; x++) p.set(x, 29, '#0a081266');
  return p;
}

// ---------------------------------------------------------------- スポーツカー(38x18)

const SPORTS_ROWS = [
  'KKKKKKKK',
  'KHHHHHHH',
  'KRRGGGGGG',
  'KRRRGGGgGG',
  'KHHHHHHHHHHHHHHHHHH',
  'KRRRRRRRRRRRRRRRRRR',
  'KrrKKRRRRRRRRRRRRRR',
  'KROOOOOOOOOOOOOOOOO',
  'KRTTTTTTTTTTTTTTTTT',
  'KRttttttttDDWWWWWWW',
  'KrrDDDDDDDDDDwwwwww',
  'KrrDDsSSDDDDDDDDDDD',
  'KKKKKKKKKKKKKKKKKKK',
];

export const SPORTS_COLORS = ['#f2c22c', '#20c4d8', '#a552e0'];

export function buildSports(variant = 0) {
  const pal = { ...COMMON, ...bodyPalette(SPORTS_COLORS[variant % SPORTS_COLORS.length]) };
  const p = fromHalf(SPORTS_ROWS, pal, 38, 18);
  for (let y = 14; y <= 17; y++) for (let x = 5; x <= 32; x++) p.set(x, y, y >= 16 ? '#0a08124d' : '#0a081280');
  drawTire(p, 0, 8, 7, 8, 0);
  drawTire(p, 31, 8, 7, 8, 0);
  return p;
}

export { mix };
