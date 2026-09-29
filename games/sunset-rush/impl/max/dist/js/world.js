// Traffic and roadside placement (SPEC 3.6 / 3.7 / 3.10). Deterministic per (seed, stage).

import {
  STAGES, SEG_LEN, LANE_X, CAR_TYPES, CAR_TYPE_ORDER, ROADSIDE, KMH, START_GATE_SEG,
} from './config.js';
import { seededRng, stageSeed, fnv1a } from './rng.js';

export const CAR_VARIANTS = 3; // colour variants per vehicle type (art provides them)

export function generateWorld(stageNo, seed, course) {
  const st = STAGES[stageNo - 1];
  const rng = seededRng(stageSeed(seed, stageNo));

  // ---- traffic ----
  const traffic = [];
  const spacing = (st.N - 160) / st.traffic;
  let prevLane = -1;
  for (let k = 0; k < st.traffic; k++) {
    const seg = Math.round(60 + (k + 0.5) * spacing + (rng() - 0.5) * 0.6 * spacing);
    const z = seg * SEG_LEN + rng() * SEG_LEN;
    const lane = k === 0 ? rng.int(3) : (prevLane + 1 + rng.int(2)) % 3;
    prevLane = lane;
    const u = rng();
    const type = u < st.mix[0] ? 'sedan' : u < st.mix[0] + st.mix[1] ? 'truck' : 'sports';
    const ct = CAR_TYPES[type];
    const kmh = ct.vmin + rng() * (ct.vmax - ct.vmin);
    traffic.push({
      id: k,
      type,
      variant: (k + CAR_TYPE_ORDER.indexOf(type)) % CAR_VARIANTS, // colour variant, no extra rng use
      lane,
      x: LANE_X[lane],
      z,
      z0: z,
      speed: kmh * KMH,
      eff: kmh * KMH,
      hitHalf: ct.hit,
      hit: false,
      passed: false,
      gone: false,
      prevRel: 1,
    });
  }

  // Variety guarantee (deterministic, uses no extra randomness): the first 8 cars must include every vehicle
  // type, so all three are on screen within the first few hundred metres whatever the seed.
  const WINDOW = 8;
  for (const need of ['sports', 'truck', 'sedan']) {
    const head = traffic.slice(0, WINDOW);
    if (head.some((c) => c.type === need)) continue;
    const counts = {};
    head.forEach((c) => { counts[c.type] = (counts[c.type] || 0) + 1; });
    for (let k = WINDOW - 1; k >= 0; k--) {
      const c = traffic[k];
      if (counts[c.type] < 2) continue;
      const old = CAR_TYPES[c.type];
      const frac = (c.speed / KMH - old.vmin) / (old.vmax - old.vmin);
      const nt = CAR_TYPES[need];
      c.type = need;
      c.hitHalf = nt.hit;
      c.speed = (nt.vmin + frac * (nt.vmax - nt.vmin)) * KMH;
      c.eff = c.speed;
      c.variant = (k + CAR_TYPE_ORDER.indexOf(need)) % CAR_VARIANTS;
      break;
    }
  }

  // ---- roadside ----
  const roadside = [];
  const gateSegs = [START_GATE_SEG, st.cp[0], st.cp[1], st.N];
  for (let seg = 12; seg <= st.N + 60; seg += 6) {
    for (const side of [-1, 1]) {
      const r = rng();
      let solid;
      let kind;
      let offset;
      if (r < 0.35) {
        solid = true;
        kind = st.solids[rng.int(st.solids.length)];
        offset = 1.45 + rng() * 0.55;
      } else if (r < 0.75) {
        solid = false;
        kind = st.decors[rng.int(st.decors.length)];
        offset = 2.2 + rng() * 1.4;
      } else {
        continue;
      }
      if (solid) {
        if (seg < 40) continue;
        let nearGate = false;
        for (const g of gateSegs) if (Math.abs(seg - g) <= 4) nearGate = true;
        if (nearGate) continue;
      }
      const def = ROADSIDE[kind];
      roadside.push({
        kind,
        solid,
        side,
        seg,
        x: side * offset,
        z: seg * SEG_LEN + SEG_LEN / 2,
        hitHalf: def.hit,
        hit: false,
      });
    }
  }

  // attach to segments (static sprites and solids)
  for (const o of roadside) {
    const s = course.segmentAt(o.z);
    s.sprites.push(o);
    if (o.solid) s.solids.push(o);
  }

  // gates
  const gates = [
    { kind: 'gate_start', z: START_GATE_SEG * SEG_LEN + SEG_LEN / 2, x: 0, gate: true },
    { kind: 'gate_checkpoint', z: st.cp[0] * SEG_LEN + SEG_LEN / 2, x: 0, gate: true },
    { kind: 'gate_checkpoint', z: st.cp[1] * SEG_LEN + SEG_LEN / 2, x: 0, gate: true },
    { kind: 'gate_goal', z: st.N * SEG_LEN + SEG_LEN / 2, x: 0, gate: true },
  ];
  for (const g of gates) course.segmentAt(g.z).sprites.push(g);

  // per-lane lists ordered front (largest z) first; cars never overtake each other
  const lanes = [[], [], []];
  for (const c of traffic) lanes[c.lane].push(c);
  for (const l of lanes) l.sort((a, b) => b.z - a.z);

  const hashList = [stageNo, traffic.length, roadside.length];
  for (const c of traffic) {
    hashList.push(Math.round(c.z), c.lane, CAR_TYPE_ORDER.indexOf(c.type), Math.round(c.speed), c.variant);
  }
  for (const o of roadside) {
    hashList.push(o.seg, o.side, Math.round(Math.abs(o.x) * 1000), o.solid ? 1 : 0, kindIndex(o.kind));
  }
  const layoutHash = fnv1a(hashList);

  return { traffic, lanes, roadside, gates, layoutHash };
}

const KIND_KEYS = Object.keys(ROADSIDE);
function kindIndex(kind) {
  return KIND_KEYS.indexOf(kind);
}
