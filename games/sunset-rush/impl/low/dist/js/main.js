import { ASSETS, buildAssets, drawText, textWidth, hex, HORIZON } from './assets.js';
import { audio, initAudio, setMuted, suspend, resume, ctxState, setEngine, sfx, startBgm, stopBgm } from './audio.js';

const params = new URLSearchParams(location.search);
const W = 640, H = 360, STEP = 1 / 60, SEG_LEN = 200, ROAD_HALF = 2000, CAM_HEIGHT = 1000;
const CAM_DEPTH = 1 / Math.tan(50 * Math.PI / 180), PLAYER_Z = CAM_HEIGHT * CAM_DEPTH, DRAW_DIST = 200;
const MAX_SPEED = 12000, ACCEL = 2400, BRAKE = 6000, COAST = 1800, OFFROAD_DECEL = 6000, OFFROAD_LIMIT = 3000;
const STEER_RATE = 2.0, CENTRIFUGAL = 0.3, CRASH_SPEED_CAP = 2400, CRASH_INVULN = 1.2, CRASH_PUSH = 0.12;
const PLAYER_HIT_HALFW = 0.10, HIT_Z_WINDOW = 300, M_U = 144;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

buildAssets();

// ---------------- stage data ----------------
const STAGES = [
  {
    name: 'SEASIDE', N: 2160, time: 30, cps: [720, 1440], add: 18, cars: 36, mix: [0.5, 0.25, 0.25],
    sections: [[100, 0, 0], [140, 2, 0], [120, 0, 2000], [160, -2, 0], [140, 3, -2000], [100, 0, 0], [180, -3, 2000], [120, 0, 2000], [160, 4, -2000], [140, 0, -2000], [120, -2, 0], [160, 3, 2000], [140, 0, -2000], [100, -4, 0], [120, 0, 0], [100, 2, 0], [60, 0, 0]],
    solids: ['rs_palm', 'rs_rock', 'rs_billboard'], decors: ['rs_shrub'],
    road: ['#6e6a7c', '#625e70'], grass: ['#d8a860', '#cc9c56'], rumble: ['#f4ecd8', '#d8402c'], lane: '#f4ecd8',
  },
  {
    name: 'PINE RIDGE', N: 2592, time: 32, cps: [864, 1728], add: 20, cars: 54, mix: [0.4, 0.3, 0.3],
    sections: [[80, 0, 0], [140, 3, 0], [120, 0, 3000], [160, -4, 0], [100, 0, -3000], [140, 4, 2000], [160, -3, 4000], [120, 0, -4000], [140, 5, -2000], [100, 0, 0], [180, -5, 3000], [120, 0, -3000], [140, 3, 0], [140, -3, 2000], [120, 0, -2000], [160, 5, 0], [100, 0, 3000], [140, -4, -3000], [120, 4, 0], [112, 0, 0]],
    solids: ['rs_pine', 'rs_boulder', 'rs_signpost'], decors: ['rs_fern'],
    road: ['#5a5478', '#504a6c'], grass: ['#2a5a48', '#245040'], rumble: ['#e0d8f0', '#7a3aa8'], lane: '#d8d0f0',
  },
  {
    name: 'NEON CITY', N: 3024, time: 32, cps: [1008, 2016], add: 22, cars: 72, mix: [0.3, 0.3, 0.4],
    sections: [[80, 0, 0], [120, 3, 0], [100, 0, 0], [140, -5, 2000], [120, 0, 0], [140, 6, -2000], [100, 0, 0], [160, -4, 3000], [140, 4, -3000], [120, 0, 0], [160, -6, 0], [100, 0, 4000], [140, 5, -4000], [120, 0, 0], [140, -5, 2000], [120, 3, -2000], [160, 0, 0], [140, 6, 0], [120, -6, 0], [100, 0, 3000], [140, 4, -3000], [100, -3, 0], [120, 3, 0], [144, 0, 0]],
    solids: ['rs_lamp', 'rs_neon', 'rs_bollard'], decors: ['rs_building', 'rs_building_b'],
    road: ['#2a2a48', '#222240'], grass: ['#0e1a30', '#0a1428'], rumble: ['#30f0ff', '#ff30c0'], lane: '#ffe870',
  },
];
for (const d of STAGES) {
  d.rgb = { road: d.road.map(hex), grass: d.grass.map(hex), rumble: d.rumble.map(hex), lane: hex(d.lane) };
}
const SPR = {
  rs_palm: [0.5, 0.10], rs_rock: [0.36, 0.14], rs_shrub: [0.4, 0], rs_pine: [0.5, 0.09], rs_boulder: [0.45, 0.16], rs_fern: [0.35, 0],
  rs_lamp: [0.22, 0.05], rs_neon: [0.7, 0.18], rs_building: [1.6, 0], rs_billboard: [0.6, 0.16], rs_signpost: [0.24, 0.06],
  rs_bollard: [0.14, 0.05], rs_building_b: [1.4, 0],
};
const CAR_T = [
  { id: 'car_sedan', w: 0.225, hw: 0.10, v0: 80, v1: 110, alts: ['car_sedan', 'car_sedan_alt1', 'car_sedan_alt2'] },
  { id: 'car_truck', w: 0.275, hw: 0.13, v0: 60, v1: 80, alts: ['car_truck', 'car_truck_alt1', 'car_truck_alt2'] },
  { id: 'car_sports', w: 0.2375, hw: 0.10, v0: 120, v1: 150, alts: ['car_sports', 'car_sports_alt1', 'car_sports_alt2'] },
];

function mkPoint(y, z) { return { y, z, camZ: 0, scale: 0, sx: 0, sy: 0, sw: 0 }; }
const worldCache = {};
function getSegs(stage) {
  if (worldCache[stage]) return worldCache[stage];
  const def = STAGES[stage - 1], segs = [];
  let y0 = 0, idx = 0;
  for (const [len, curve, dy] of def.sections) {
    for (let k = 0; k < len; k++) {
      const t = (k + 0.5) / len, e = clamp(Math.min(t, 1 - t) / 0.25, 0, 1), f = e * e * (3 - 2 * e);
      segs.push({
        index: idx, curve: curve * f, sprites: [], clipY: H,
        p1: mkPoint(y0 + dy * (1 - Math.cos(Math.PI * k / len)) / 2, idx * SEG_LEN),
        p2: mkPoint(y0 + dy * (1 - Math.cos(Math.PI * (k + 1) / len)) / 2, (idx + 1) * SEG_LEN),
      });
      idx++;
    }
    y0 += dy;
  }
  if (segs.length !== def.N) throw new Error('bad N ' + segs.length);
  for (let i = 0; i < 300; i++) { segs.push({ index: idx, curve: 0, sprites: [], clipY: H, p1: mkPoint(y0, idx * SEG_LEN), p2: mkPoint(y0, (idx + 1) * SEG_LEN) }); idx++; }
  return (worldCache[stage] = segs);
}
function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const seedParam = params.get('seed');
const SEED = seedParam !== null && seedParam !== '' && !isNaN(+seedParam) ? (+seedParam | 0) : ((Date.now() ^ (Math.random() * 1e9)) | 0);
const LANE_X = [-0.667, 0, 0.667];

function buildWorld(stage) {
  const def = STAGES[stage - 1], segs = getSegs(stage), N = def.N;
  segs.forEach((s) => (s.sprites.length = 0));
  const rng = mulberry32(SEED ^ Math.imul(stage, 0x9E3779B1));
  const randInt = (n) => Math.floor(rng() * n);
  const traffic = [];
  const spacing = (N - 160) / def.cars;
  let lane = 0;
  for (let k = 0; k < def.cars; k++) {
    const seg = Math.round(60 + (k + 0.5) * spacing + (rng() - 0.5) * 0.6 * spacing);
    const z = seg * SEG_LEN + rng() * SEG_LEN;
    lane = k === 0 ? randInt(3) : (lane + 1 + randInt(2)) % 3;
    const r = rng(); const ty = r < def.mix[0] ? 0 : r < def.mix[0] + def.mix[1] ? 1 : 2;
    const T = CAR_T[ty], spd = (T.v0 + rng() * (T.v1 - T.v0)) * 40;
    traffic.push({ z, x: LANE_X[lane], lane, ty, base: spd, speed: spd, hit: false, passed: false, prevRel: 0, gone: false, img: T.alts[(k * 7 + stage) % 3] });
  }
  const gateSegs = [...def.cps, N];
  const roadside = [];
  for (let seg = 12; seg <= N + 60; seg += 6) {
    for (const side of [-1, 1]) {
      const r = rng(); let solid;
      if (r < 0.35) solid = true; else if (r < 0.75) solid = false; else continue;
      const list = solid ? def.solids : def.decors;
      const id = list[randInt(list.length)];
      const off = solid ? 1.45 + rng() * 0.55 : 2.2 + rng() * 1.4;
      if (solid && (seg < 40 || gateSegs.some((g) => Math.abs(g - seg) <= 4))) continue;
      const o = { z: seg * SEG_LEN + rng() * SEG_LEN, x: side * off, id, w: SPR[id][0], hw: SPR[id][1], solid, hit: false, prevRel: 0 };
      roadside.push(o); segs[seg].sprites.push(o);
    }
  }
  def.cps.forEach((c) => segs[c].sprites.push({ z: c * SEG_LEN, x: 0, id: 'gate_checkpoint', w: 2.6 }));
  segs[N].sprites.push({ z: N * SEG_LEN, x: 0, id: 'gate_goal', w: 2.6 });
  segs[8].sprites.push({ z: 8 * SEG_LEN + 100, x: 0, id: 'gate_start', w: 2.6 });
  // layout hash
  let h = 2166136261;
  const mix = (v) => { h ^= Math.round(v) & 0xffffffff; h = Math.imul(h, 16777619); };
  traffic.forEach((c) => { mix(c.z); mix(c.lane); mix(c.ty); mix(c.base); });
  roadside.forEach((o) => { mix(o.z); mix(o.x * 1000); mix(o.solid ? 1 : 0); mix(o.id.length * 31 + o.id.charCodeAt(4)); });
  return { stage, def, segs, N, goalZ: N * SEG_LEN, traffic, roadside, layoutHash: (h >>> 0).toString(16).padStart(8, '0') };
}

function startGame() {
  const canvas = document.getElementById('game');
  const g = canvas.getContext('2d', { alpha: false });
  g.imageSmoothingEnabled = false;
  const startStageParam = (() => { const s = parseInt(params.get('stage'), 10); return s >= 1 && s <= 3 ? s : 1; })();

  // ---- persistence ----
  const save = { best: 0, muted: false };
  try { const v = JSON.parse(localStorage.getItem('sunset-rush:v1')); if (v) { save.best = +v.best || 0; save.muted = !!v.muted; } } catch (e) { }
  const persist = () => { try { localStorage.setItem('sunset-rush:v1', JSON.stringify({ best: save.best, muted: save.muted })); } catch (e) { } };
  if (params.get('mute') === '1') save.muted = true;
  audio.muted = save.muted;

  // ---- state ----
  const S = {
    scene: 'title', stage: 1, world: null, pos: 0, speed: 0, playerX: 0, timeLeft: 0, cpDone: [false, false], checkpointsPassed: 0,
    invuln: 0, score: 0, distScore: 0, extra: 0, overtakes: 0, crashes: 0, cdT: 0, cdLast: 4, goT: 0, cpBanner: 0, cpAdd: 0,
    sceneT: 0, res: null, newBest: false, rank: null, smoke: [], smokeT: 0, smokeEmit: 0, shake: 0, offs: [0, 0, 0], clock: 0,
    input: { throttle: false, brake: false, steer: 0 }, popups: [], lastWarn: -1, reached: 1,
  };
  S.world = buildWorld(1);
  const scoreInt = () => Math.floor(S.distScore + S.extra + 1e-6);
  const keys = {};
  const down = (...c) => c.some((k) => keys[k]);

  function goTitle() {
    S.scene = 'title'; S.world = buildWorld(1); S.pos = 0; S.speed = 7200; S.playerX = 0; S.smoke = []; S.popups = [];
    initTraffic(); stopBgm(); resume();
  }
  function initTraffic() { const pz = S.pos + PLAYER_Z; S.world.traffic.forEach((c) => (c.prevRel = c.z - pz)); S.world.roadside.forEach((o) => (o.prevRel = o.z - pz)); }
  function newRun() {
    S.score = 0; S.distScore = 0; S.extra = 0; S.crashes = 0; S.overtakes = 0; S.stage = startStageParam; S.newBest = false; S.rank = null;
    startStage();
  }
  function startStage() {
    const def = STAGES[S.stage - 1];
    S.world = buildWorld(S.stage); S.speed = 0; S.playerX = 0; S.pos = 0; S.checkpointsPassed = 0; S.cpDone = [false, false];
    S.invuln = 0; S.timeLeft = def.time; S.scene = 'countdown'; S.cdT = 3.0; S.cdLast = 4; S.goT = 0; S.cpBanner = 0; S.sceneT = 0;
    S.smoke = []; S.smokeT = 0; S.popups = []; S.offs = [0, 0, 0]; S.reached = S.stage; S.lastWarn = -1;
    initTraffic(); startBgm('bgm_' + S.stage);
  }
  function finishRun(ending) {
    S.newBest = false;
    const sc = scoreInt();
    if (sc > save.best) { save.best = sc; S.newBest = true; persist(); }
    if (ending) S.rank = sc >= 33000 ? 'S' : sc >= 28000 ? 'A' : sc >= 23000 ? 'B' : 'C';
  }

  // ---- input ----
  const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
  window.addEventListener('keydown', (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    initAudio();
    keys[e.code] = true;
    if (e.repeat) return;
    onKey(e.code);
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  const clearKeys = () => { for (const k in keys) keys[k] = false; };
  window.addEventListener('blur', clearKeys);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearKeys(); });
  window.addEventListener('pointerdown', () => { initAudio(); });
  canvas.addEventListener('pointerdown', () => { if (['title', 'gameover', 'ending'].includes(S.scene) || (S.scene === 'stageclear' && S.sceneT >= 1.5)) onKey('Enter'); });

  function onKey(code) {
    if (code === 'KeyM') { save.muted = !save.muted; setMuted(save.muted); persist(); return; }
    if (code === 'KeyF') { try { if (document.fullscreenElement) document.exitFullscreen(); else canvas.requestFullscreen(); } catch (e) { } return; }
    const decide = code === 'Enter' || code === 'Space';
    const sc = S.scene;
    if (sc === 'title') { if (decide) { sfx('sfx_menu'); newRun(); } return; }
    if (code === 'KeyR' && ['countdown', 'playing', 'paused', 'gameover', 'ending'].includes(sc)) { resume(); newRun(); return; }
    if (sc === 'playing' && (code === 'KeyP' || code === 'Escape')) { S.scene = 'paused'; suspend(); return; }
    if (sc === 'paused') {
      if (code === 'KeyP' || code === 'Escape') { S.scene = 'playing'; resume(); } else if (code === 'KeyQ') goTitle();
      return;
    }
    if (sc === 'stageclear' && decide && S.sceneT >= 1.5) {
      sfx('sfx_menu');
      if (S.stage >= 3) { S.scene = 'ending'; finishRun(true); } else { S.stage++; startStage(); }
      return;
    }
    if (sc === 'gameover') {
      if (decide) { sfx('sfx_menu'); newRun(); } else if (code === 'Escape' || code === 'KeyQ') goTitle();
      return;
    }
    if (sc === 'ending') { if (decide) { sfx('sfx_menu'); goTitle(); } else if (code === 'Escape') goTitle(); }
  }

  // ---- simulation ----
  const segAt = (z) => S.world.segs[Math.min(S.world.segs.length - 1, Math.max(0, Math.floor(z / SEG_LEN)))];

  function moveTraffic(dt) {
    const T = S.world.traffic, lim = (S.world.N + 280) * SEG_LEN;
    for (let l = 0; l < 3; l++) {
      const cars = T.filter((c) => c.lane === l && !c.gone).sort((a, b) => b.z - a.z);
      let front = null;
      for (const c of cars) {
        let v = c.base;
        if (front && front.z - c.z < 1000) v = Math.min(v, front.speed);
        c.speed = v; front = c;
      }
    }
    for (const c of T) { if (c.gone) continue; c.z += c.speed * dt; if (c.z >= lim) c.gone = true; }
  }

  function crash(o) {
    S.speed = Math.min(S.speed, CRASH_SPEED_CAP); S.crashes++; S.invuln = CRASH_INVULN;
    S.playerX = clamp(S.playerX + (S.playerX >= o.x ? 1 : -1) * CRASH_PUSH, -2, 2);
    o.hit = true; sfx('sfx_crash'); S.smokeT = 0.5; S.smokeEmit = 0; S.shake = 0.3;
  }

  function stepAuto(dt, decel) {
    S.speed = Math.max(0, S.speed - decel * dt);
    S.pos = Math.min(S.pos + S.speed * dt, (S.world.segs.length - 2) * SEG_LEN - PLAYER_Z);
    moveTraffic(dt);
    if (S.invuln > 0) S.invuln = Math.max(0, S.invuln - dt);
    updateBg(S.speed * dt);
  }
  function updateBg(dPos) {
    const cv = segAt(S.pos + PLAYER_Z).curve, k = [0.15, 0.5, 1.0];
    for (let i = 0; i < 3; i++) S.offs[i] += cv * (dPos / SEG_LEN) * k[i];
  }

  function stepPlaying(dt) {
    const inp = S.input, w = S.world, def = w.def;
    const pSeg = segAt(S.pos + PLAYER_Z);
    let a = inp.throttle ? ACCEL : inp.brake ? -BRAKE : -COAST;
    if (Math.abs(S.playerX) > 1 && S.speed > OFFROAD_LIMIT) a -= OFFROAD_DECEL;
    S.speed = clamp(S.speed + a * dt, 0, MAX_SPEED);
    const sp = S.speed / MAX_SPEED, dxp = dt * STEER_RATE * sp;
    S.playerX += inp.steer * dxp;
    S.playerX -= dxp * sp * pSeg.curve * CENTRIFUGAL;
    S.playerX = clamp(S.playerX, -2, 2);
    const d = S.speed * dt;
    S.pos += d; S.distScore += d / M_U;
    updateBg(d);
    moveTraffic(dt);
    if (S.invuln > 0) S.invuln = Math.max(0, S.invuln - dt);
    const pz = S.pos + PLAYER_Z;
    for (const c of w.traffic) {
      if (c.gone) continue;
      const rel = c.z - pz, T = CAR_T[c.ty];
      const flip = (c.prevRel > 0 && rel <= 0) || (c.prevRel < 0 && rel >= 0);
      if (S.invuln <= 0 && !c.hit && (Math.abs(rel) < HIT_Z_WINDOW || flip) && Math.abs(c.x - S.playerX) < PLAYER_HIT_HALFW + T.hw) crash(c);
      if (c.prevRel > 0 && rel <= 0 && !c.hit && !c.passed) {
        c.passed = true; S.overtakes++; S.extra += 50; sfx('sfx_overtake');
        S.popups.push({ t: 0, txt: '+50', y: 300 });
        const gap = Math.abs(c.x - S.playerX) - (PLAYER_HIT_HALFW + T.hw);
        if (S.speed / 40 >= 180 && gap >= 0 && gap < 0.12) { S.extra += 20; S.popups.push({ t: 0, txt: 'NEAR MISS +20', y: 280 }); }
      }
      c.prevRel = rel;
    }
    for (const o of w.roadside) {
      const rel = o.z - pz;
      if (o.solid && S.invuln <= 0 && !o.hit) {
        const flip = (o.prevRel > 0 && rel <= 0) || (o.prevRel < 0 && rel >= 0);
        if ((Math.abs(rel) < HIT_Z_WINDOW || flip) && Math.abs(o.x - S.playerX) < PLAYER_HIT_HALFW + o.hw) crash(o);
      }
      o.prevRel = rel;
    }
    // checkpoints
    def.cps.forEach((c, i) => {
      if (!S.cpDone[i] && pz >= c * SEG_LEN) {
        S.cpDone[i] = true; S.checkpointsPassed++; S.timeLeft += def.add; S.extra += 500; S.cpBanner = 2.0; S.cpAdd = def.add; sfx('sfx_checkpoint');
      }
    });
    S.timeLeft -= dt;
    if (pz >= w.goalZ) {
      const tb = Math.floor(Math.max(0, S.timeLeft)), sb = 1000 * S.stage;
      S.extra += 100 * tb + sb;
      S.res = { tb, tbPts: 100 * tb, sb };
      S.scene = 'stageclear'; S.sceneT = 0; stopBgm(); sfx('sfx_goal');
    } else if (S.timeLeft <= 0) {
      S.timeLeft = 0; S.scene = 'timeup'; S.sceneT = 0; stopBgm(); sfx('sfx_timeup');
    } else if (S.timeLeft <= 10 && Math.ceil(S.timeLeft) !== S.lastWarn) { S.lastWarn = Math.ceil(S.timeLeft); sfx('sfx_timewarn'); }
  }

  function update(dt) {
    S.clock += dt;
    const sc = S.scene;
    // popups / smoke / shake always animate except paused
    if (sc !== 'paused') {
      S.smoke.forEach((p) => (p.age += dt)); S.smoke = S.smoke.filter((p) => p.age < 0.5);
      S.popups.forEach((p) => (p.t += dt)); S.popups = S.popups.filter((p) => p.t < 1.0);
      if (S.smokeT > 0) {
        S.smokeT -= dt; S.smokeEmit -= dt;
        if (S.smokeEmit <= 0 && S.smoke.length < 40) { S.smoke.push({ age: 0, x: 320 + (Math.random() - 0.5) * 20, y: 340 }); S.smokeEmit += 0.08; }
      }
      if (S.shake > 0) S.shake = Math.max(0, S.shake - dt);
      if (S.cpBanner > 0) S.cpBanner -= dt;
      if (S.goT > 0) S.goT -= dt;
    }
    if (sc === 'title') {
      S.pos += 7200 * dt; updateBg(7200 * dt);
      moveTraffic(dt);
      if (S.pos + PLAYER_Z > (S.world.N - 400) * SEG_LEN) { S.world = buildWorld(1); S.pos = 0; initTraffic(); }
    } else if (sc === 'countdown') {
      S.cdT -= dt;
      const n = Math.ceil(S.cdT - 1e-9);
      if (n !== S.cdLast && n >= 1) { S.cdLast = n; sfx('sfx_beep'); }
      if (S.cdT <= 0) { S.scene = 'playing'; S.goT = 0.8; S.sceneT = 0; sfx('sfx_go'); }
      moveTraffic(0);
    } else if (sc === 'playing') {
      S.sceneT += dt;
      S.input.throttle = down('ArrowUp', 'KeyW'); S.input.brake = down('ArrowDown', 'KeyS');
      S.input.steer = (down('ArrowRight', 'KeyD') ? 1 : 0) - (down('ArrowLeft', 'KeyA') ? 1 : 0);
      stepPlaying(dt);
    } else if (sc === 'stageclear') {
      S.sceneT += dt; stepAuto(dt, 3000);
    } else if (sc === 'timeup') {
      S.sceneT += dt; stepAuto(dt, 6000);
      if (S.sceneT >= 2.5) { S.scene = 'gameover'; finishRun(false); }
    }
  }

  // ---- rendering ----
  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  const mixc = (a, b, t) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;

  function project(p, cx, cy, cz) {
    const camX = 0 - cx, camY = p.y - cy, camZ = p.z - cz;
    p.camZ = camZ; p.scale = CAM_DEPTH / camZ;
    p.sx = Math.round(W / 2 + p.scale * camX * W / 2);
    p.sy = Math.round(H / 2 - p.scale * camY * H / 2);
    p.sw = Math.round(p.scale * ROAD_HALF * W / 2);
  }
  function drawLayer(id, y, off) {
    const im = ASSETS[id].canvas, x = -(((off % 640) + 640) % 640);
    g.drawImage(im, Math.round(x), y); g.drawImage(im, Math.round(x) + 640, y);
  }
  function rows(color, yTop, yBot, fn) {
    g.fillStyle = color;
    for (let y = yTop; y < yBot; y++) { const r = fn((y - yTop + 0.5) / (yBot - yTop)); g.fillRect(r[0], y, r[1], 1); }
  }

  let drawnN = 0;
  function renderWorld() {
    const w = S.world, segs = w.segs, def = w.def, st = w.stage;
    g.fillStyle = rgb(def.rgb.grass[0]); g.fillRect(0, 180, W, 180);
    g.fillStyle = '#000'; drawLayer('bg_sky_' + st, 0, S.offs[0]); drawLayer('bg_far_' + st, 84, S.offs[1]); drawLayer('bg_near_' + st, 124, S.offs[2]);
    const fogC = hex(HORIZON[st]);
    const baseIdx = Math.min(segs.length - 1, Math.floor(S.pos / SEG_LEN)), base = segs[baseIdx], basePct = (S.pos % SEG_LEN) / SEG_LEN;
    const pz = S.pos + PLAYER_Z, pSeg = segs[Math.min(segs.length - 1, Math.floor(pz / SEG_LEN))], pPct = (pz % SEG_LEN) / SEG_LEN;
    const playerY = lerp(pSeg.p1.y, pSeg.p2.y, pPct), camY = CAM_HEIGHT + playerY;
    let maxY = H, x = 0, dx = -base.curve * basePct;
    drawnN = 0;
    for (let n = 0; n < DRAW_DIST; n++) {
      const idx = baseIdx + n; if (idx >= segs.length) break;
      const seg = segs[idx]; drawnN = n + 1;
      seg.clipY = maxY;
      const cx = S.playerX * ROAD_HALF - x;
      project(seg.p1, cx, camY, S.pos); project(seg.p2, cx - dx, camY, S.pos);
      x += dx; dx += seg.curve;
      const p1 = seg.p1, p2 = seg.p2;
      if (p1.camZ <= CAM_DEPTH || p2.sy >= p1.sy || p2.sy >= maxY) continue;
      const band = Math.floor(seg.index / 3) % 2, fog = Math.min(0.92, Math.pow(n / DRAW_DIST, 2) * 1.1);
      const yTop = Math.max(0, p2.sy), yBot = Math.min(H, p1.sy, maxY);
      if (yBot > yTop) {
        const c = (arr) => mixc(arr[band], fogC, fog);
        g.fillStyle = c(def.rgb.grass); g.fillRect(0, yTop, W, yBot - yTop);
        const hh = p1.sy - p2.sy;
        const geo = (t) => { const xx = lerp(p2.sx, p1.sx, t), ww = lerp(p2.sw, p1.sw, t); return [xx, ww]; };
        const tf = (y) => (y - p2.sy + 0.5) / hh;
        g.fillStyle = c(def.rgb.rumble);
        for (let y = yTop; y < yBot; y++) { const [xx, ww] = geo(tf(y)); const rw = ww / 6; g.fillRect(Math.round(xx - ww - rw), y, Math.round(2 * (ww + rw)), 1); }
        g.fillStyle = c(def.rgb.road);
        for (let y = yTop; y < yBot; y++) { const [xx, ww] = geo(tf(y)); g.fillRect(Math.round(xx - ww), y, Math.round(2 * ww), 1); }
        if (band === 0) {
          g.fillStyle = mixc(def.rgb.lane, fogC, fog);
          for (let y = yTop; y < yBot; y++) {
            const [xx, ww] = geo(tf(y)), lw = Math.max(1, Math.round(ww / 32));
            g.fillRect(Math.round(xx - ww / 3 - lw / 2), y, lw, 1); g.fillRect(Math.round(xx + ww / 3 - lw / 2), y, lw, 1);
          }
        }
      }
      maxY = p1.sy;
    }
    // sprites far -> near
    const buckets = new Map();
    for (const c of w.traffic) {
      if (c.gone) continue;
      const i = Math.floor(c.z / SEG_LEN) - baseIdx;
      if (i >= 0 && i < drawnN) { let b = buckets.get(i); if (!b) buckets.set(i, (b = [])); b.push(c); }
    }
    for (let n = drawnN - 1; n >= 0; n--) {
      const seg = segs[baseIdx + n];
      for (const s of seg.sprites) drawSprite(s.id, s.z, s.x, s.w, seg);
      const b = buckets.get(n);
      if (b) for (const c of b) drawSprite(c.img, c.z, c.x, CAR_T[c.ty].w, seg);
    }
  }
  function drawSprite(id, z, offset, worldW, seg) {
    const p1 = seg.p1, p2 = seg.p2;
    if (p1.camZ <= CAM_DEPTH) return;
    const pc = (z % SEG_LEN) / SEG_LEN, sc = lerp(p1.scale, p2.scale, pc);
    const sX = lerp(p1.sx, p2.sx, pc) + sc * offset * ROAD_HALF * W / 2, sY = lerp(p1.sy, p2.sy, pc);
    const rw = sc * ROAD_HALF * W / 2, dW = worldW * rw;
    if (!(dW >= 1)) return;
    const a = ASSETS[id], dH = dW * a.fh / a.fw;
    const clipH = Math.max(0, sY - seg.clipY);
    if (clipH >= dH) return;
    const vis = (dH - clipH) / dH;
    g.drawImage(a.canvas, 0, 0, a.fw, a.fh * vis, Math.round(sX - dW / 2), Math.round(sY - dH), Math.round(dW), Math.max(1, Math.round(dH - clipH)));
  }

  function drawPlayer() {
    const inp = S.input, playing = S.scene === 'playing';
    const braking = playing && inp.brake && !inp.throttle;
    const a = ASSETS[braking ? 'car_player_brake' : 'car_player'];
    const fr = playing ? (inp.steer < 0 ? 1 : inp.steer > 0 ? 2 : 0) : 0;
    let bounce = 0;
    if (S.speed > 0) bounce = Math.abs(S.playerX) > 1 ? Math.random() * 3 : Math.random();
    if (S.invuln > 0 && Math.floor(S.invuln / 0.05) % 2 === 1) return;
    g.drawImage(a.canvas, fr * 40, 0, 40, 22, 320 - 80, Math.round(354 - bounce - 88), 160, 88);
  }

  function drawFx() {
    const sm = ASSETS.fx_smoke;
    for (const p of S.smoke) {
      const f = Math.min(3, Math.floor(p.age / 0.5 * 4));
      g.drawImage(sm.canvas, f * 12, 0, 12, 12, Math.round(p.x - 12), Math.round(p.y - p.age * 30 - 12), 24, 24);
    }
    const spd = S.speed / 40;
    if (spd >= 250 && S.scene === 'playing') {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 12; i++) {
        const ang = Math.random() * Math.PI * 2, r0 = 150 + Math.random() * 150, l = 20 + Math.random() * 30;
        const x0 = 320 + Math.cos(ang) * r0 * 1.4, y0 = 170 + Math.sin(ang) * r0 * 0.6;
        g.fillRect(Math.round(x0), Math.round(y0), Math.max(1, Math.round(Math.cos(ang) * l * 0.4)), 1);
      }
    }
    if (S.world.stage === 3 && S.scene !== 'title') {
      g.fillStyle = 'rgba(255,240,170,0.10)';
      g.beginPath(); g.moveTo(290, 266); g.lineTo(350, 266); g.lineTo(440, 200); g.lineTo(200, 200); g.fill();
    }
  }

  const two = (n) => String(Math.max(0, n)).padStart(2, '0');
  const six = (n) => String(Math.max(0, n)).padStart(6, '0');
  const T = (s, x, y, sc, col = '#fff', al = 'l') => drawText(g, s, x, y, sc, col, al, '#1a1030');

  function drawHud() {
    const w = S.world, sc = scoreInt();
    const tl = Math.ceil(Math.max(0, S.timeLeft));
    T('TIME', 8, 6, 2, '#ffe070');
    const red = S.timeLeft <= 10, blink = Math.floor(S.clock / 0.25) % 2 === 0;
    if (!(red && !blink)) T(two(tl), 8, 22, 4, red ? '#ff4050' : '#ffffff');
    T('SCORE', 320, 6, 2, '#ffe070', 'c'); T(six(sc), 320, 22, 3, '#fff', 'c');
    T(`STAGE ${S.stage}/3`, 632, 6, 2, '#ffe070', 'r'); T('BEST ' + six(Math.max(save.best, sc)), 632, 24, 2, '#fff', 'r');
    // progress
    g.fillStyle = '#1a1030'; g.fillRect(119, 53, 402, 10); g.fillStyle = '#403060'; g.fillRect(120, 54, 400, 8);
    const prog = clamp((S.pos + PLAYER_Z) / w.goalZ, 0, 1);
    g.fillStyle = '#ffb040'; g.fillRect(120, 54, Math.round(400 * prog), 8);
    w.def.cps.forEach((c) => { g.fillStyle = '#fff'; g.fillRect(120 + Math.round(400 * c * SEG_LEN / w.goalZ), 52, 2, 12); });
    T('F', 528, 54, 1, '#ffe070'); g.fillStyle = '#fff'; g.fillRect(520, 50, 2, 14); g.fillStyle = '#e02838'; g.fillRect(522, 50, 6, 5);
    const mx = 120 + Math.round(400 * prog); g.fillStyle = '#30f0ff';
    for (let i = 0; i < 4; i++) g.fillRect(mx - 3 + i, 44 + i, 7 - i * 2, 1);
    T('PASSED ' + S.overtakes, 8, 330, 2); T(save.muted ? '[M] SOUND OFF' : '[M] SOUND ON', 8, 346, 1, '#ccc');
    T(String(Math.floor(S.speed / 40)), 600, 322, 4, '#fff', 'r'); T('KM/H', 632, 340, 1, '#ffe070', 'r');
    if (S.cpBanner > 0) { T('CHECKPOINT!', 320, 100, 3, '#ffe860', 'c'); T(`+${S.cpAdd} SEC`, 320, 128, 2, '#fff', 'c'); }
    for (const p of S.popups) T(p.txt, 320, p.y - p.t * 30, 2, '#ffe860', 'c');
  }

  function dim(a) { g.fillStyle = `rgba(10,6,20,${a})`; g.fillRect(0, 0, W, H); }
  function draw() {
    g.save();
    if (S.shake > 0) g.translate(Math.round((Math.random() - 0.5) * 6), Math.round((Math.random() - 0.5) * 6));
    renderWorld(); drawPlayer(); drawFx();
    g.restore();
    const sc = S.scene, w = S.world;
    if (sc === 'title') {
      const logo = ASSETS.logo_title;
      g.drawImage(logo.canvas, 320 - logo.fw / 2 * 1.5 | 0, 24 + Math.round(Math.sin(S.clock * 2) * 2), logo.fw * 1.5, logo.fh * 1.5);
      T('CHASE THE SUN. BEAT THE CLOCK.', 320, 118, 2, '#fff', 'c');
      if (Math.floor(S.clock / 0.25) % 2 === 0) T('PRESS ENTER', 320, 170, 3, '#ffe070', 'c');
      T('BEST ' + six(save.best), 320, 200, 2, '#fff', 'c');
      T('UP/W GAS   DOWN/S BRAKE   LEFT-RIGHT/AD STEER', 320, 300, 1, '#fff', 'c');
      T('P PAUSE    R RESTART      M SOUND', 320, 314, 1, '#fff', 'c');
    } else {
      drawHud();
      if (sc === 'countdown' || (sc === 'playing' && S.sceneT < 1.0)) { T(`STAGE ${S.stage}`, 320, 60, 3, '#ffe070', 'c'); T(w.def.name, 320, 88, 2, '#fff', 'c'); }
      if (sc === 'countdown') T(String(Math.max(1, Math.ceil(S.cdT - 1e-9))), 320, 150, 6, '#fff', 'c');
      if (sc === 'playing' && S.goT > 0) T('GO!', 320, 150, 6, '#7dff8a', 'c');
      if (sc === 'paused') {
        dim(0.6); T('PAUSED', 320, 140, 4, '#fff', 'c'); T('P/ESC: RESUME   R: RESTART   Q: TITLE', 320, 190, 2, '#ddd', 'c');
      }
      if (sc === 'timeup') T('TIME UP', 320, 140, 6, '#ff4050', 'c');
      if (sc === 'stageclear') {
        if (S.sceneT < 1.5) T('GOAL!', 320, 140, 6, '#ffe860', 'c');
        else {
          g.fillStyle = 'rgba(10,6,30,0.8)'; g.fillRect(130, 80, 380, 210); g.strokeStyle = '#ffe070'; g.lineWidth = 2; g.strokeRect(131, 81, 378, 208);
          T(`STAGE ${S.stage} CLEAR!`, 320, 96, 3, '#ffe860', 'c');
          const r = S.res, L = 146;
          T(`TIME LEFT   ${two(r.tb)}  X100  = ${r.tbPts}`, L, 146, 2);
          T(`STAGE BONUS           = ${r.sb}`, L, 176, 2);
          T(`SCORE                 = ${six(scoreInt())}`, L, 206, 2);
          if (Math.floor(S.clock / 0.25) % 2 === 0) T('PRESS ENTER', 320, 256, 2, '#7dff8a', 'c');
        }
      }
      if (sc === 'gameover') {
        dim(0.8); T('GAME OVER', 320, 60, 5, '#ff4050', 'c'); T(`REACHED STAGE ${S.reached}`, 320, 120, 2, '#fff', 'c');
        T('SCORE ' + six(scoreInt()), 320, 156, 3, '#ffe070', 'c'); T('BEST ' + six(save.best), 320, 196, 2, '#fff', 'c');
        if (S.newBest) T('NEW BEST!', 320, 228, 3, '#7dff8a', 'c');
        T('ENTER: RETRY   ESC: TITLE', 320, 290, 2, '#ddd', 'c');
      }
      if (sc === 'ending') {
        dim(0.8); T('ALL CLEAR!', 320, 24, 5, '#ffe860', 'c'); T('SCORE ' + six(scoreInt()), 320, 76, 3, '#fff', 'c');
        T(S.rank, 320, 116, 8, S.rank === 'S' ? '#ffe860' : S.rank === 'A' ? '#ff8a4c' : '#30f0ff', 'c');
        T('BEST ' + six(save.best), 320, 190, 2, '#fff', 'c');
        if (S.newBest) T('NEW BEST!', 320, 218, 3, '#7dff8a', 'c');
        T('PRESS ENTER', 320, 290, 2, '#ddd', 'c');
      }
    }
  }

  function updateAudio() {
    const sc = S.scene, on = sc === 'countdown' || sc === 'playing' || sc === 'stageclear' || sc === 'timeup';
    setEngine(on, on ? S.speed / MAX_SPEED : 0);
  }

  // ---- loop ----
  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    if (S.scene !== 'paused') {
      acc += dt; let n = 0;
      while (acc >= STEP && n < 6) { update(STEP); acc -= STEP; n++; }
      if (n === 6) acc = 0;
    } else acc = 0;
    updateAudio(); draw();
    requestAnimationFrame(frame);
  }
  goTitle();
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });

  // ---- hooks ----
  const api = {
    getState() {
      const sc = S.scene, w = S.world;
      return {
        scene: sc, seed: SEED, stage: sc === 'title' ? S.stage : S.stage, score: scoreInt(), best: save.best,
        timeLeft: S.timeLeft, speedKmh: S.speed / 40, playerX: S.playerX, distanceM: S.pos / M_U,
        goalRemainingM: Math.max(0, (w.goalZ - (S.pos + PLAYER_Z)) / M_U), checkpointsPassed: S.checkpointsPassed,
        overtakes: S.overtakes, crashes: S.crashes, invulnerable: S.invuln > 0, trafficTotal: w.traffic.length, layoutHash: w.layoutHash,
        muted: save.muted, rank: sc === 'ending' ? S.rank : null,
        audio: { state: ctxState(), bgm: (sc === 'countdown' || sc === 'playing' || sc === 'paused') ? 'bgm_' + S.stage : null, engineHz: audio.engineHz },
      };
    },
  };
  if (params.get('debug') === '1') {
    api.debug = {
      warp(m) {
        if (S.scene !== 'countdown' && S.scene !== 'playing') return;
        S.pos = clamp(m * M_U, 0, S.world.goalZ - 3000);
        const pz = S.pos + PLAYER_Z;
        S.world.traffic.forEach((c) => { if (c.z < pz) c.passed = true; });
        S.world.def.cps.forEach((c, i) => { if (c * SEG_LEN <= pz && !S.cpDone[i]) { S.cpDone[i] = true; S.checkpointsPassed++; } });
        initTraffic();
      },
      setTime(s) { S.timeLeft = s; },
      setPlayerX(x) { S.playerX = clamp(x, -2, 2); },
      setSpeedKmh(v) { S.speed = clamp(v, 0, 300) * 40; },
    };
    const fps = document.createElement('div');
    fps.style.cssText = 'position:fixed;right:4px;bottom:4px;color:#0f0;font:12px monospace;z-index:9';
    document.body.appendChild(fps);
    let fc = 0, ft = performance.now();
    (function loop() { fc++; const n = performance.now(); if (n - ft > 500) { fps.textContent = Math.round(fc * 1000 / (n - ft)) + ' FPS'; fc = 0; ft = n; } requestAnimationFrame(loop); })();
  }
  window.__game = api;
}

if (params.get('gallery') === '1') {
  import('./gallery.js').then((m) => m.startGallery());
} else {
  startGame();
}
