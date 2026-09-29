import { SEG_LEN, RUMBLE_SEGS } from './const.js';
import { clamp } from './util.js';

// ステージ表(仕様 3.3)
export const STAGES = [
  {
    id: 1, name: 'SEASIDE', N: 2160, time: 30, cps: [720, 1440], cpTime: 18, cars: 36,
    ratio: [0.5, 0.25, 0.25], maxCurve: 4,
    sections: [
      [100, 0, 0], [140, 2, 0], [120, 0, 2000], [160, -2, 0], [140, 3, -2000], [100, 0, 0],
      [180, -3, 2000], [120, 0, 2000], [160, 4, -2000], [140, 0, -2000], [120, -2, 0], [160, 3, 2000],
      [140, 0, -2000], [100, -4, 0], [120, 0, 0], [100, 2, 0], [60, 0, 0],
    ],
    pal: {
      grass: ['#4aa85c', '#3b9350'], rumble: ['#f2ece0', '#d8432f'], road: ['#7e7893', '#67617d'],
      lane: '#f2e9c8', fog: '#f6a56e',
    },
  },
  {
    id: 2, name: 'PINE RIDGE', N: 2592, time: 32, cps: [864, 1728], cpTime: 20, cars: 54,
    ratio: [0.4, 0.3, 0.3], maxCurve: 5,
    sections: [
      [80, 0, 0], [140, 3, 0], [120, 0, 3000], [160, -4, 0], [100, 0, -3000], [140, 4, 2000],
      [160, -3, 4000], [120, 0, -4000], [140, 5, -2000], [100, 0, 0], [180, -5, 3000], [120, 0, -3000],
      [140, 3, 0], [140, -3, 2000], [120, 0, -2000], [160, 5, 0], [100, 0, 3000], [140, -4, -3000],
      [120, 4, 0], [112, 0, 0],
    ],
    pal: {
      grass: ['#2c6b46', '#235a3a'], rumble: ['#e6def5', '#6a3fb0'], road: ['#635b7e', '#514a6a'],
      lane: '#d9c9f0', fog: '#7c5197',
    },
  },
  {
    id: 3, name: 'NEON CITY', N: 3024, time: 32, cps: [1008, 2016], cpTime: 22, cars: 72,
    ratio: [0.3, 0.3, 0.4], maxCurve: 6,
    sections: [
      [80, 0, 0], [120, 3, 0], [100, 0, 0], [140, -5, 2000], [120, 0, 0], [140, 6, -2000],
      [100, 0, 0], [160, -4, 3000], [140, 4, -3000], [120, 0, 0], [160, -6, 0], [100, 0, 4000],
      [140, 5, -4000], [120, 0, 0], [140, -5, 2000], [120, 3, -2000], [160, 0, 0], [140, 6, 0],
      [120, -6, 0], [100, 0, 3000], [140, 4, -3000], [100, -3, 0], [120, 3, 0], [144, 0, 0],
    ],
    pal: {
      grass: ['#15214c', '#0c1436'], rumble: ['#ff3fb8', '#25d0f5'], road: ['#363c62', '#282d4c'],
      lane: '#a8f0ff', fog: '#1d1458',
    },
  },
];

const cache = [];

function mkPoint(z, y) {
  return { y, z, camZ: 0, scale: 0, screenX: 0, screenY: 0, screenW: 0 };
}

// セクション表から N + 300 本のセグメントを生成する(ループしない)
export function getCourse(stage) {
  if (cache[stage]) return cache[stage];
  const st = STAGES[stage - 1];
  const segs = [];
  let y0 = 0;
  for (const [len, curve, dy] of st.sections) {
    for (let k = 0; k < len; k++) {
      const t = (k + 0.5) / len;
      const e = clamp(Math.min(t, 1 - t) / 0.25, 0, 1);
      const f = e * e * (3 - 2 * e);
      const ya = y0 + (dy * (1 - Math.cos((Math.PI * k) / len))) / 2;
      const yb = y0 + (dy * (1 - Math.cos((Math.PI * (k + 1)) / len))) / 2;
      const i = segs.length;
      segs.push({ index: i, curve: curve * f, p1: mkPoint(i * SEG_LEN, ya), p2: mkPoint((i + 1) * SEG_LEN, yb), clipY: 0, visible: false, band: Math.floor(i / RUMBLE_SEGS) % 2 });
    }
    y0 += dy;
  }
  const N = segs.length;
  for (let j = 0; j < 300; j++) {
    const i = N + j;
    segs.push({ index: i, curve: 0, p1: mkPoint(i * SEG_LEN, y0), p2: mkPoint((i + 1) * SEG_LEN, y0), clipY: 0, visible: false, band: Math.floor(i / RUMBLE_SEGS) % 2 });
  }
  cache[stage] = { segs, N, goalZ: N * SEG_LEN, total: N + 300, st };
  return cache[stage];
}
