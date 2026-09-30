// Course construction: segments from the section table, traffic and roadside placement.

import { SEG_LEN, TAIL_SEGS, RUMBLE_SEGS, LANE_X, TRAFFIC_TYPES, TRAFFIC_ORDER, ROADSIDE, PLAYER_Z, U_PER_KMH } from './const.js';
import { clamp, mulberry32, fnv1a } from './util.js';

export function buildSegments(stage) {
  const segs = [];
  let y0 = 0;
  let i = 0;
  const push = (curve, y1, y2) => {
    segs.push({
      index: i, curve, y1, y2,
      band: Math.floor(i / RUMBLE_SEGS) % 2,
      p1: { z: i * SEG_LEN, wy: y1, x: 0, y: 0, w: 0, scale: 0, camZ: 0 },
      p2: { z: (i + 1) * SEG_LEN, wy: y2, x: 0, y: 0, w: 0, scale: 0, camZ: 0 },
      clipY: 0,
      sprites: [],
    });
    i++;
  };
  for (const [len, curve, dy] of stage.sections) {
    for (let k = 0; k < len; k++) {
      const t = (k + 0.5) / len;
      const e = clamp(Math.min(t, 1 - t) / 0.25, 0, 1);
      const f = e * e * (3 - 2 * e);
      const ya = y0 + (dy * (1 - Math.cos((Math.PI * k) / len))) / 2;
      const yb = y0 + (dy * (1 - Math.cos((Math.PI * (k + 1)) / len))) / 2;
      push(curve * f, ya, yb);
    }
    y0 += dy;
  }
  for (let k = 0; k < TAIL_SEGS; k++) push(0, y0, y0);
  return segs;
}

export function buildWorld(stage, seed, assets) {
  const N = stage.N;
  const segments = buildSegments(stage);
  const rng = mulberry32((seed ^ Math.imul(stage.num, 0x9e3779b1)) >>> 0);
  const rand = () => rng();
  const randInt = (n) => Math.floor(rng() * n);

  // ---- traffic
  const cars = [];
  const count = stage.traffic;
  const spacing = (N - 160) / count;
  let prevLane = 0;
  for (let k = 0; k < count; k++) {
    const seg = Math.round(60 + (k + 0.5) * spacing + (rand() - 0.5) * 0.6 * spacing);
    const z = seg * SEG_LEN + rand() * SEG_LEN;
    const lane = k === 0 ? randInt(3) : (prevLane + 1 + randInt(2)) % 3;
    prevLane = lane;
    const r = rand();
    const type = r < stage.mix[0] ? 'sedan' : r < stage.mix[0] + stage.mix[1] ? 'truck' : 'sports';
    const tt = TRAFFIC_TYPES[type];
    const speed = (tt.minKmh + rand() * (tt.maxKmh - tt.minKmh)) * U_PER_KMH;
    const variant = randInt(assets[tt.id].n);
    cars.push({
      type, id: tt.id, z, lane, x: LANE_X[lane], speed, eff: speed, halfW: tt.halfW, worldW: tt.worldW,
      variant, hit: false, passed: false, prevRel: z - PLAYER_Z, seg,
    });
  }

  // ---- roadside
  const gateSegs = [...stage.cps, N];
  const nearGate = (seg) => gateSegs.some((g) => Math.abs(seg - g) <= 4);
  const roadside = [];
  for (let seg = 12; seg <= N + 60; seg += 6) {
    for (const side of [-1, 1]) {
      const r = rand();
      if (r < 0.35) {
        const id = stage.solids[randInt(stage.solids.length)];
        const offset = side * (1.45 + rand() * 0.55);
        if (seg >= 40 && !nearGate(seg)) {
          roadside.push({ id, z: seg * SEG_LEN + SEG_LEN / 2, x: offset, seg, solid: true, halfW: ROADSIDE[id].halfW, worldW: ROADSIDE[id].worldW, hit: false, prevRel: 0 });
        }
      } else if (r < 0.75) {
        const id = stage.decors[randInt(stage.decors.length)];
        const offset = side * (2.2 + rand() * 1.4);
        roadside.push({ id, z: seg * SEG_LEN + SEG_LEN / 2, x: offset, seg, solid: false, worldW: ROADSIDE[id].worldW });
      }
    }
  }
  for (const o of roadside) segments[o.seg].sprites.push(o);

  // ---- gates
  const gates = [
    { id: 'gate_start', z: 8 * SEG_LEN, x: 0, seg: 8, worldW: 2.6 },
    ...stage.cps.map((s) => ({ id: 'gate_checkpoint', z: s * SEG_LEN, x: 0, seg: s, worldW: 2.6 })),
    { id: 'gate_goal', z: N * SEG_LEN, x: 0, seg: N, worldW: 2.6 },
  ];
  for (const g of gates) segments[g.seg].sprites.push(g);

  const layoutHash = fnv1a(
    cars.map((c) => `${c.seg}:${c.lane}:${c.type}:${Math.round(c.speed)}`).join('|') + '#' +
    roadside.map((o) => `${o.seg}:${o.id}:${o.x.toFixed(3)}`).join('|'),
  );

  return { stage, N, goalZ: N * SEG_LEN, segments, cars, roadside, gates, layoutHash, trafficTotal: cars.length };
}
