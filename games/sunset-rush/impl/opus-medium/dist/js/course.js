// Course data, segment generation and seeded placement.
import { ASSET_INFO } from './assets.js';

export const SEG_LEN = 200;

export const STAGES = [
  {
    name: 'SEASIDE', N: 2160, time: 30, cps: [720, 1440], cpAdd: 18, traffic: 36, ratio: [0.5, 0.25, 0.25],
    sections: [[100, 0, 0], [140, 2, 0], [120, 0, 2000], [160, -2, 0], [140, 3, -2000], [100, 0, 0],
      [180, -3, 2000], [120, 0, 2000], [160, 4, -2000], [140, 0, -2000], [120, -2, 0], [160, 3, 2000],
      [140, 0, -2000], [100, -4, 0], [120, 0, 0], [100, 2, 0], [60, 0, 0]],
    solids: ['rs_palm', 'rs_rock', 'rs_billboard'], decors: ['rs_shrub'],
    colors: {
      grass: ['#e2aa66', '#d0985a'], road: ['#6e6478', '#645a6e'], rumble: ['#f6f0e6', '#d8323c'], lane: '#fff2d8',
      fog: '#ffb080', ground: '#d8a060',
    },
    bgm: 'bgm_1',
  },
  {
    name: 'PINE RIDGE', N: 2592, time: 32, cps: [864, 1728], cpAdd: 20, traffic: 54, ratio: [0.4, 0.3, 0.3],
    sections: [[80, 0, 0], [140, 3, 0], [120, 0, 3000], [160, -4, 0], [100, 0, -3000], [140, 4, 2000],
      [160, -3, 4000], [120, 0, -4000], [140, 5, -2000], [100, 0, 0], [180, -5, 3000], [120, 0, -3000],
      [140, 3, 0], [140, -3, 2000], [120, 0, -2000], [160, 5, 0], [100, 0, 3000], [140, -4, -3000],
      [120, 4, 0], [112, 0, 0]],
    solids: ['rs_pine', 'rs_boulder', 'rs_signpost'], decors: ['rs_fern'],
    colors: {
      grass: ['#2e5a3e', '#244a34'], road: ['#4c4664', '#423c58'], rumble: ['#ece4f6', '#7442a8'], lane: '#e8e0ff',
      fog: '#7a3e7e', ground: '#264c36',
    },
    bgm: 'bgm_2',
  },
  {
    name: 'NEON CITY', N: 3024, time: 32, cps: [1008, 2016], cpAdd: 22, traffic: 72, ratio: [0.3, 0.3, 0.4],
    sections: [[80, 0, 0], [120, 3, 0], [100, 0, 0], [140, -5, 2000], [120, 0, 0], [140, 6, -2000],
      [100, 0, 0], [160, -4, 3000], [140, 4, -3000], [120, 0, 0], [160, -6, 0], [100, 0, 4000],
      [140, 5, -4000], [120, 0, 0], [140, -5, 2000], [120, 3, -2000], [160, 0, 0], [140, 6, 0],
      [120, -6, 0], [100, 0, 3000], [140, 4, -3000], [100, -3, 0], [120, 3, 0], [144, 0, 0]],
    solids: ['rs_lamp', 'rs_neon', 'rs_bollard'], decors: ['rs_building', 'rs_building_b'],
    colors: {
      grass: ['#1a1834', '#12102a'], road: ['#2c2c40', '#232334'], rumble: ['#ff3cb4', '#2a1a48'], lane: '#5af0ff',
      fog: '#1c1840', ground: '#141230',
    },
    bgm: 'bgm_3',
  },
];

export const CAR_TYPES = {
  sedan: { id: 'car_sedan', min: 80, max: 110, hit: 0.10, worldW: 0.225 },
  truck: { id: 'car_truck', min: 60, max: 80, hit: 0.13, worldW: 0.275 },
  sports: { id: 'car_sports', min: 120, max: 150, hit: 0.10, worldW: 0.2375 },
};
export const LANE_X = [-0.667, 0, 0.667];

export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSegments(stage) {
  const st = STAGES[stage - 1];
  const segs = [];
  let y0 = 0, i = 0;
  const mk = (curve, y1, y2) => {
    segs.push({
      index: i, curve, band: Math.floor(i / 3) % 2,
      p1: { y: y1, z: i * SEG_LEN, camZ: 0, scale: 0, screenX: 0, screenY: 0, screenW: 0 },
      p2: { y: y2, z: (i + 1) * SEG_LEN, camZ: 0, scale: 0, screenX: 0, screenY: 0, screenW: 0 },
      clipY: 0, sprites: [], cars: [],
    });
    i++;
  };
  for (const [len, curve, dy] of st.sections) {
    for (let k = 0; k < len; k++) {
      const t = (k + 0.5) / len;
      const e = Math.max(0, Math.min(1, Math.min(t, 1 - t) / 0.25));
      const f = e * e * (3 - 2 * e);
      const ya = y0 + dy * (1 - Math.cos(Math.PI * k / len)) / 2;
      const yb = y0 + dy * (1 - Math.cos(Math.PI * (k + 1) / len)) / 2;
      mk(curve * f, ya, yb);
    }
    y0 += dy;
  }
  for (let k = 0; k < 300; k++) mk(0, y0, y0);
  return segs;
}

// place traffic and roadside objects; returns {cars, sprites, hash}
export function placeLayout(stage, seed, segs) {
  const st = STAGES[stage - 1];
  const rng = seededRng((seed ^ Math.imul(stage, 0x9E3779B1)) >>> 0);
  const randInt = (n) => Math.floor(rng() * n);
  const N = st.N;
  const cars = [];
  const spacing = (N - 160) / st.traffic;
  let prevLane = 0;
  for (let k = 0; k < st.traffic; k++) {
    const seg = Math.round(60 + (k + 0.5) * spacing + (rng() - 0.5) * 0.6 * spacing);
    const z = seg * SEG_LEN + rng() * SEG_LEN;
    const lane = k === 0 ? randInt(3) : (prevLane + 1 + randInt(2)) % 3;
    prevLane = lane;
    const r = rng();
    const type = r < st.ratio[0] ? 'sedan' : r < st.ratio[0] + st.ratio[1] ? 'truck' : 'sports';
    const T = CAR_TYPES[type];
    const kmh = T.min + rng() * (T.max - T.min);
    const variant = randInt(3);
    cars.push({ type, id: T.id, hit: false, passed: false, removed: false, z, lane, x: LANE_X[lane], speed: kmh * 40, eff: kmh * 40, halfW: T.hit, worldW: T.worldW, variant, prevRel: 0 });
  }
  // roadside
  for (const s of segs) s.sprites.length = 0;
  const gates = [...st.cps, N];
  const nearGate = (seg) => gates.some((g) => Math.abs(seg - g) <= 4);
  const sprites = [];
  for (let seg = 12; seg <= N + 60; seg += 6) {
    for (const side of [-1, 1]) {
      const r = rng();
      if (r < 0.35) {
        const id = st.solids[randInt(st.solids.length)];
        const off = 1.45 + rng() * 0.55;
        if (seg < 40 || nearGate(seg)) continue;
        sprites.push({ id, offset: side * off, z: seg * SEG_LEN, solid: true, halfW: ASSET_INFO[id].hit });
      } else if (r < 0.75) {
        const id = st.decors[randInt(st.decors.length)];
        const off = 2.2 + rng() * 1.4;
        sprites.push({ id, offset: side * off, z: seg * SEG_LEN, solid: false });
      }
    }
  }
  // gates (not random)
  sprites.push({ id: 'gate_start', offset: 0, z: 8 * SEG_LEN, solid: false, gate: true });
  for (const c of st.cps) sprites.push({ id: 'gate_checkpoint', offset: 0, z: c * SEG_LEN, solid: false, gate: true });
  sprites.push({ id: 'gate_goal', offset: 0, z: N * SEG_LEN, solid: false, gate: true });
  for (const sp of sprites) { const s = segs[Math.floor(sp.z / SEG_LEN)]; if (s) s.sprites.push(sp); }

  // layout hash (FNV-1a)
  let h = 0x811c9dc5;
  const feed = (str) => { for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } };
  for (const c of cars) feed(`${c.type}${c.lane}${c.z.toFixed(2)}${c.speed.toFixed(2)}${c.variant};`);
  for (const s of sprites) feed(`${s.id}${s.offset.toFixed(3)}${s.z};`);
  return { cars, sprites, hash: h.toString(16).padStart(8, '0') };
}
