// Course data, segment generation, traffic / roadside placement.
export const W = 640, H = 360;
export const STEP = 1 / 60;
export const SEG_LEN = 200;
export const ROAD_HALF = 2000;
export const CAM_HEIGHT = 1000;
export const CAM_DEPTH = 1 / Math.tan((50 * Math.PI) / 180);
export const PLAYER_Z = CAM_HEIGHT * CAM_DEPTH;
export const DRAW_DIST = 200;
export const MAX_SPEED = 12000;
export const M_UNIT = 144;

export const STAGES = [
  {
    name: 'SEASIDE', N: 2160, time: 30, cps: [720, 1440], cpAdd: 18, traffic: 36, mix: [0.5, 0.25, 0.25],
    sections: [
      [100, 0, 0], [140, 2, 0], [120, 0, 2000], [160, -2, 0], [140, 3, -2000], [100, 0, 0],
      [180, -3, 2000], [120, 0, 2000], [160, 4, -2000], [140, 0, -2000], [120, -2, 0], [160, 3, 2000],
      [140, 0, -2000], [100, -4, 0], [120, 0, 0], [100, 2, 0], [60, 0, 0],
    ],
    solids: ['rs_palm', 'rs_rock', 'rs_billboard'], decors: ['rs_shrub'],
  },
  {
    name: 'PINE RIDGE', N: 2592, time: 32, cps: [864, 1728], cpAdd: 20, traffic: 54, mix: [0.4, 0.3, 0.3],
    sections: [
      [80, 0, 0], [140, 3, 0], [120, 0, 3000], [160, -4, 0], [100, 0, -3000], [140, 4, 2000],
      [160, -3, 4000], [120, 0, -4000], [140, 5, -2000], [100, 0, 0], [180, -5, 3000], [120, 0, -3000],
      [140, 3, 0], [140, -3, 2000], [120, 0, -2000], [160, 5, 0], [100, 0, 3000], [140, -4, -3000],
      [120, 4, 0], [112, 0, 0],
    ],
    solids: ['rs_pine', 'rs_boulder', 'rs_signpost'], decors: ['rs_fern'],
  },
  {
    name: 'NEON CITY', N: 3024, time: 32, cps: [1008, 2016], cpAdd: 22, traffic: 72, mix: [0.3, 0.3, 0.4],
    sections: [
      [80, 0, 0], [120, 3, 0], [100, 0, 0], [140, -5, 2000], [120, 0, 0], [140, 6, -2000],
      [100, 0, 0], [160, -4, 3000], [140, 4, -3000], [120, 0, 0], [160, -6, 0], [100, 0, 4000],
      [140, 5, -4000], [120, 0, 0], [140, -5, 2000], [120, 3, -2000], [160, 0, 0], [140, 6, 0],
      [120, -6, 0], [100, 0, 3000], [140, 4, -3000], [100, -3, 0], [120, 3, 0], [144, 0, 0],
    ],
    solids: ['rs_lamp', 'rs_neon', 'rs_bollard'], decors: ['rs_building', 'rs_building_b'],
  },
];

// hit half-widths / world widths of roadside sprites (road half width = 1)
export const ROADSIDE = {
  rs_palm: { worldW: 0.5, hw: 0.10 }, rs_rock: { worldW: 0.36, hw: 0.14 }, rs_billboard: { worldW: 0.6, hw: 0.16 },
  rs_shrub: { worldW: 0.4, hw: 0 },
  rs_pine: { worldW: 0.5, hw: 0.09 }, rs_boulder: { worldW: 0.45, hw: 0.16 }, rs_signpost: { worldW: 0.24, hw: 0.06 },
  rs_fern: { worldW: 0.35, hw: 0 },
  rs_lamp: { worldW: 0.22, hw: 0.05 }, rs_neon: { worldW: 0.7, hw: 0.18 }, rs_bollard: { worldW: 0.14, hw: 0.05 },
  rs_building: { worldW: 1.6, hw: 0 }, rs_building_b: { worldW: 1.4, hw: 0 },
};

export const CAR_TYPES = {
  sedan: { worldW: 0.225, hw: 0.10, vmin: 80, vmax: 110 },
  truck: { worldW: 0.275, hw: 0.13, vmin: 60, vmax: 80 },
  sports: { worldW: 0.2375, hw: 0.10, vmin: 120, vmax: 150 },
};

export function mulberry32(a) {
  a >>>= 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function stageRng(seed, stageNum) {
  return mulberry32((seed ^ Math.imul(stageNum, 0x9e3779b1)) >>> 0);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function mkPoint(z, y) {
  return { z, y, camZ: 0, scale: 0, screenX: 0, screenY: 0, screenW: 0 };
}

export function buildSegments(stageIdx) {
  const st = STAGES[stageIdx];
  const segs = [];
  let y0 = 0;
  for (const [len, curve, dy] of st.sections) {
    const yAt = (k) => y0 + (dy * (1 - Math.cos((Math.PI * k) / len))) / 2;
    for (let k = 0; k < len; k++) {
      const t = (k + 0.5) / len;
      const e = clamp(Math.min(t, 1 - t) / 0.25, 0, 1);
      const f = e * e * (3 - 2 * e);
      const i = segs.length;
      segs.push({ index: i, curve: curve * f, p1: mkPoint(i * SEG_LEN, yAt(k)), p2: mkPoint((i + 1) * SEG_LEN, yAt(k + 1)), clipY: 0, objs: [], band: Math.floor(i / 3) % 2 });
    }
    y0 = yAt(len);
  }
  if (segs.length !== st.N) throw new Error('section total mismatch ' + segs.length);
  for (let j = 0; j < 300; j++) {
    const i = segs.length;
    segs.push({ index: i, curve: 0, p1: mkPoint(i * SEG_LEN, y0), p2: mkPoint((i + 1) * SEG_LEN, y0), clipY: 0, objs: [], band: Math.floor(i / 3) % 2 });
  }
  return segs;
}

export function genTraffic(stageIdx, rng) {
  const st = STAGES[stageIdx];
  const count = st.traffic;
  const spacing = (st.N - 160) / count;
  const cars = [];
  let prevLane = 0;
  const randInt = (n) => Math.floor(rng() * n);
  for (let k = 0; k < count; k++) {
    const seg = Math.round(60 + (k + 0.5) * spacing + (rng() - 0.5) * 0.6 * spacing);
    const z = seg * SEG_LEN + rng() * SEG_LEN;
    const lane = k === 0 ? randInt(3) : (prevLane + 1 + randInt(2)) % 3;
    prevLane = lane;
    const r = rng();
    const type = r < st.mix[0] ? 'sedan' : r < st.mix[0] + st.mix[1] ? 'truck' : 'sports';
    const ct = CAR_TYPES[type];
    const speed = (ct.vmin + rng() * (ct.vmax - ct.vmin)) * 40;
    const variant = randInt(3);
    cars.push({ type, lane, x: (lane - 1) * 0.667, z, speed, effSpeed: speed, variant, hit: false, passed: false, prevRel: 0, hw: ct.hw, worldW: ct.worldW });
  }
  return cars;
}

export function gatesOf(stageIdx) {
  const st = STAGES[stageIdx];
  return [...st.cps, st.N];
}

export function genRoadside(stageIdx, rng, segs) {
  const st = STAGES[stageIdx];
  const gates = gatesOf(stageIdx);
  const list = [];
  for (let seg = 12; seg <= st.N + 60; seg += 6) {
    for (const side of [-1, 1]) {
      const r = rng();
      let solid;
      if (r < 0.35) solid = true;
      else if (r < 0.75) solid = false;
      else continue;
      const pool = solid ? st.solids : st.decors;
      const kind = pool[Math.floor(rng() * pool.length)];
      const off = solid ? 1.45 + rng() * 0.55 : 2.2 + rng() * 1.4;
      if (solid && (seg < 40 || gates.some((g) => Math.abs(seg - g) <= 4))) continue;
      const info = ROADSIDE[kind];
      const o = { kind, solid, x: side * off, z: seg * SEG_LEN, hw: info.hw, worldW: info.worldW, hit: false };
      list.push(o);
      segs[seg].objs.push(o);
    }
  }
  return list;
}

export function hashLayout(cars, side) {
  let h = 2166136261 >>> 0;
  const mix = (v) => {
    h ^= Math.round(v * 1000) & 0xffffffff;
    h = Math.imul(h, 16777619) >>> 0;
  };
  for (const c of cars) { mix(c.z); mix(c.x); mix(c.speed); mix(c.type.length); mix(c.variant); }
  for (const o of side) { mix(o.z); mix(o.x); mix(o.kind.length); mix(o.kind.charCodeAt(3)); }
  return h.toString(16).padStart(8, '0');
}
