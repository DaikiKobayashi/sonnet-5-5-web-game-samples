// 交通車・路側物の配置(§3.6 / §3.7 / §3.10)

import {
  STAGES, SEG_LEN, LANE_X, CAR_TYPES, CAR_TYPE_KEYS, KMH, ROADSIDE_KINDS, SPRITE_INFO, PLAYER_Z,
} from './constants.js';
import { seededRng } from './util.js';

function hash32(str, seed) {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function stageRngSeed(seed, stageNo) {
  return (seed ^ Math.imul(stageNo, 0x9E3779B1)) >>> 0;
}

// コースに交通車・路側物・ゲートを配置して { traffic, roadside, layoutHash } を返す
export function spawnWorld(course, stageNo, seed) {
  const st = STAGES[stageNo - 1];
  const { rand, randInt } = seededRng(stageRngSeed(seed, stageNo));
  const N = st.N;

  // --- 交通車 ---
  const traffic = [];
  const count = st.traffic;
  const spacing = (N - 160) / count;
  let prevLane = 0;
  for (let k = 0; k < count; k++) {
    const seg = Math.round(60 + (k + 0.5) * spacing + (rand() - 0.5) * 0.6 * spacing);
    const z = seg * SEG_LEN + rand() * SEG_LEN;
    const lane = k === 0 ? randInt(3) : (prevLane + 1 + randInt(2)) % 3;
    prevLane = lane;
    const r = rand();
    const type = r < st.mix[0] ? 'sedan' : r < st.mix[0] + st.mix[1] ? 'truck' : 'sports';
    const ct = CAR_TYPES[type];
    const speed = (ct.vmin + rand() * (ct.vmax - ct.vmin)) * KMH;
    const variant = randInt(3);
    traffic.push({
      type, variant, id: ct.id, lane, x: LANE_X[lane], z, speed, eff: speed,
      worldW: ct.worldW, hitHalfW: ct.hitHalfW, nw: ct.w, nh: ct.h,
      hit: false, passed: false, rel: z - PLAYER_Z, blink: 0,
    });
  }

  // --- 路側物 ---
  for (const seg of course.segments) seg.sprites.length = 0;
  const roadside = [];
  const kinds = ROADSIDE_KINDS[stageNo];
  const gateSegs = [...st.cpSegs, N];
  for (let seg = 12; seg <= N + 60; seg += 6) {
    for (const side of [-1, 1]) {
      const r = rand();
      const kind = r < 0.35 ? 'solid' : r < 0.75 ? 'decor' : null;
      if (!kind) continue;
      const list = kinds[kind];
      const id = list[randInt(list.length)];
      const off = kind === 'solid' ? 1.45 + rand() * 0.55 : 2.2 + rand() * 1.4;
      const jz = rand() * SEG_LEN;
      if (kind === 'solid') {
        if (seg < 40) continue;
        if (gateSegs.some((g) => Math.abs(seg - g) <= 4)) continue;
      }
      const info = SPRITE_INFO[id];
      const obj = {
        id, solid: kind === 'solid', x: side * off, z: seg * SEG_LEN + jz,
        worldW: info.worldW, hitHalfW: info.hit, nw: info.w, nh: info.h, hit: false, gate: false,
      };
      roadside.push(obj);
      course.segments[Math.floor(obj.z / SEG_LEN)].sprites.push(obj);
    }
  }

  // --- ゲート(道路中央、セグメントの手前端) ---
  const gates = [];
  const addGate = (id, seg) => {
    const info = SPRITE_INFO[id];
    const obj = {
      id, solid: false, x: 0, z: seg * SEG_LEN, worldW: info.worldW, hitHalfW: 0,
      nw: info.w, nh: info.h, hit: false, gate: true,
    };
    gates.push(obj);
    course.segments[seg].sprites.push(obj);
  };
  addGate('gate_start', 8);
  for (const s of st.cpSegs) addGate('gate_checkpoint', s);
  addGate('gate_goal', N);

  // --- 配置ハッシュ ---
  const parts = [];
  for (const c of traffic) parts.push(`${c.type}:${c.variant}:${c.lane}:${Math.round(c.z * 100)}:${Math.round(c.speed)}`);
  for (const o of roadside) parts.push(`${o.id}:${Math.round(o.x * 1000)}:${Math.round(o.z * 100)}`);
  const joined = parts.join('|');
  const layoutHash = hash32(joined, 0).toString(16).padStart(8, '0') + hash32(joined, 0x5bd1e995).toString(16).padStart(8, '0');

  return { traffic, roadside, gates, layoutHash };
}
