// SUNSET RUSH - main game
import { buildAssets, ASSET_INFO, mix } from './assets.js';
import { drawText, textWidth } from './font.js';
import { Sound } from './audio.js';
import { STAGES, buildSegments, placeLayout, SEG_LEN, LANE_X } from './course.js';

// ---------- constants ----------
const W = 640, H = 360;
const STEP = 1 / 60;
const ROAD_HALF = 2000;
const CAM_HEIGHT = 1000;
const CAM_DEPTH = 1 / Math.tan((50 * Math.PI) / 180);
const PLAYER_Z = CAM_HEIGHT * CAM_DEPTH;
const DRAW_DIST = 200;
const MAX_SPEED = 12000, ACCEL = 2400, BRAKE = 6000, COAST = 1800;
const OFFROAD_DECEL = 6000, OFFROAD_LIMIT = 3000;
const STEER_RATE = 2.0, CENTRIFUGAL = 0.3;
const CRASH_SPEED_CAP = 2400, CRASH_INVULN = 1.2, CRASH_PUSH = 0.12;
const PLAYER_HIT_HALFW = 0.10, HIT_Z_WINDOW = 300;
const STORE_KEY = 'sunset-rush:v1';
const K_SKY = 0.15, K_FAR = 0.5, K_NEAR = 1.0;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const pad = (n, l) => String(Math.max(0, Math.floor(n))).padStart(l, '0');

// ---------- setup ----------
const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
let seed = parseInt(params.get('seed'), 10);
if (!Number.isFinite(seed)) seed = ((Date.now() & 0x7fffffff) ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
seed = seed >>> 0;
let startStage = parseInt(params.get('stage'), 10);
if (!(startStage >= 1 && startStage <= 3)) startStage = 1;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

const A = buildAssets();
const sound = new Sound();

// tinted glow sprites for night lights
const glow = {};
for (const [k, c] of Object.entries({ red: '#ff3020', yellow: '#ffd060', pink: '#ff40c0', cyan: '#40e0ff', white: '#fff0d0' })) {
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
  const g = cv.getContext('2d'); g.drawImage(A._glow.frames[0], 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = c; g.fillRect(0, 0, 16, 16);
  glow[k] = cv;
}

// ---------- storage ----------
let best = 0, muted = false;
function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const o = JSON.parse(raw); if (o && typeof o === 'object') { best = Math.max(0, Math.floor(Number(o.best) || 0)); muted = !!o.muted; } }
  } catch (e) { /* storage unavailable */ }
}
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ best, muted })); } catch (e) { /* ignore */ }
}
loadStore();
if (params.get('mute') === '1') muted = true;
sound.muted = muted;

// ---------- state ----------
const segCache = {};
function getSegs(n) { return segCache[n] || (segCache[n] = buildSegments(n)); }

const S = {
  scene: 'title', stage: 1, segs: null, N: 0, goalZ: 0,
  cars: [], lanes: [[], [], []], layoutHash: '',
  pos: 0, speed: 0, playerX: 0, invuln: 0,
  scoreF: 0, overtakes: 0, crashes: 0, timeLeft: 0, cpIdx: 0, checkpointsPassed: 0,
  sceneT: 0, cdBeeps: 0, goT: 0, stageNameT: 0, bannerT: 0, bannerAdd: 0,
  clearTimeLeft: 0, clearTimeBonus: 0, clearStageBonus: 0,
  newBest: false, rank: null,
  skyOff: 0, farOff: 0, nearOff: 0,
  animT: 0, shakeT: 0, fadeT: 0, lastWarn: -1,
  smokeCount: 6, smokeClock: 0, particles: [], popups: [],
  bounce: 0, titleTargetX: 0, steerVis: 0,
};
const score = () => Math.floor(S.scoreF + 1e-9);

function loadWorld(stage) {
  S.stage = stage;
  const st = STAGES[stage - 1];
  S.segs = getSegs(stage);
  S.N = st.N;
  S.goalZ = st.N * SEG_LEN;
  const lay = placeLayout(stage, seed, S.segs);
  S.cars = lay.cars;
  S.layoutHash = lay.hash;
  S.lanes = [[], [], []];
  for (const c of S.cars) S.lanes[c.lane].push(c);
  for (const l of S.lanes) l.sort((a, b) => b.z - a.z);
  for (const c of S.cars) c.prevRel = c.z - PLAYER_Z;
}

function goTitle() {
  sound.resume();
  S.scene = 'title';
  loadWorld(1);
  S.pos = 0; S.speed = 7200; S.playerX = 0; S.invuln = 0;
  S.particles = []; S.popups = [];
  S.fadeT = 0.5; S.sceneT = 0;
  sound.stopBgm(); sound.setOffroad(false);
}

function newRun() {
  S.scoreF = 0; S.overtakes = 0; S.crashes = 0;
  S.newBest = false; S.rank = null;
  startStage_(startStage);
}

function startStage_(n) {
  sound.resume();
  loadWorld(n);
  const st = STAGES[n - 1];
  S.speed = 0; S.playerX = 0; S.pos = 0; S.checkpointsPassed = 0; S.cpIdx = 0; S.invuln = 0;
  S.timeLeft = st.time;
  S.scene = 'countdown'; S.sceneT = 0; S.cdBeeps = 1; S.goT = 0; S.stageNameT = 0; S.bannerT = 0;
  S.particles = []; S.popups = []; S.smokeCount = 6; S.shakeT = 0;
  S.fadeT = 0.4; S.lastWarn = -1;
  S.skyOff = 0; S.farOff = 0; S.nearOff = 0;
  sound.play('sfx_beep');
  sound.playBgm(st.bgm);
  sound.setOffroad(false);
}

function checkBest() {
  const sc = score();
  if (sc > best) { best = sc; S.newBest = true; saveStore(); } else S.newBest = false;
}

function toGameOver() { S.scene = 'gameover'; S.sceneT = 0; checkBest(); sound.setOffroad(false); }
function toEnding() {
  S.scene = 'ending'; S.sceneT = 0;
  const sc = score();
  S.rank = sc >= 33000 ? 'S' : sc >= 28000 ? 'A' : sc >= 23000 ? 'B' : 'C';
  checkBest();
  sound.play('jingle_title');
  sound.setOffroad(false);
}
function pauseGame() { S.scene = 'paused'; sound.setOffroad(false); sound.pause(); }
function resumeGame() { S.scene = 'playing'; sound.resume(); }

// ---------- input ----------
const keys = {};
const touch = { left: false, right: false, gas: false, brake: false };
let firstInput = false;
const held = (...codes) => codes.some((c) => keys[c]);
const inThrottle = () => held('ArrowUp', 'KeyW') || touch.gas;
const inBrake = () => held('ArrowDown', 'KeyS') || touch.brake;
const inRight = () => held('ArrowRight', 'KeyD') || touch.right;
const inLeft = () => held('ArrowLeft', 'KeyA') || touch.left;
function clearKeys() { for (const k in keys) keys[k] = false; touch.left = touch.right = touch.gas = touch.brake = false; }

function userGesture() {
  sound.ensure();
  if (!firstInput) { firstInput = true; if (S.scene === 'title') sound.play('jingle_title'); }
}

function confirm() {
  switch (S.scene) {
    case 'title': sound.play('sfx_menu'); newRun(); break;
    case 'stageclear':
      if (S.sceneT >= 1.5) {
        sound.play('sfx_menu');
        if (S.stage < 3) startStage_(S.stage + 1); else toEnding();
      }
      break;
    case 'gameover': sound.play('sfx_menu'); newRun(); break;
    case 'ending': sound.play('sfx_menu'); goTitle(); break;
    default: break;
  }
}

window.addEventListener('keydown', (e) => {
  const code = e.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) e.preventDefault();
  userGesture();
  keys[code] = true;
  if (e.repeat) return;
  switch (code) {
    case 'Enter': case 'Space': confirm(); break;
    case 'KeyP':
      if (S.scene === 'playing') pauseGame(); else if (S.scene === 'paused') resumeGame();
      break;
    case 'Escape':
      if (S.scene === 'playing') pauseGame();
      else if (S.scene === 'paused') resumeGame();
      else if (S.scene === 'gameover' || S.scene === 'ending') goTitle();
      break;
    case 'KeyR':
      if (['countdown', 'playing', 'paused', 'gameover', 'ending'].includes(S.scene)) newRun();
      break;
    case 'KeyQ':
      if (S.scene === 'paused' || S.scene === 'gameover') goTitle();
      break;
    case 'KeyM':
      muted = !muted; sound.setMuted(muted); saveStore();
      break;
    case 'KeyF':
      try {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else document.documentElement.requestFullscreen().catch(() => {});
      } catch (err) { /* ignore */ }
      break;
    default: break;
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
function lostFocus() { clearKeys(); if (S.scene === 'playing') pauseGame(); }
window.addEventListener('blur', lostFocus);
document.addEventListener('visibilitychange', () => { if (document.hidden) lostFocus(); else lastT = performance.now(); });
canvas.addEventListener('pointerdown', () => { userGesture(); if (['title', 'stageclear', 'gameover', 'ending'].includes(S.scene)) confirm(); });

// touch buttons (coarse pointers only)
if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
  const pad = document.createElement('div');
  pad.id = 'touch';
  const defs = [['left', 'tb-left'], ['right', 'tb-right'], ['brake', 'tb-brake'], ['gas', 'tb-gas']];
  for (const [k, cls] of defs) {
    const b = document.createElement('div');
    b.className = 'tb ' + cls;
    b.dataset.touch = k;
    b.innerHTML = '<i></i>';
    const on = (ev) => { ev.preventDefault(); userGesture(); touch[k] = true; };
    const off = (ev) => { ev.preventDefault(); touch[k] = false; };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
    pad.appendChild(b);
  }
  document.body.appendChild(pad);
}

// ---------- simulation ----------
function segAt(z) {
  const i = clamp(Math.floor(z / SEG_LEN), 0, S.segs.length - 1);
  return S.segs[i];
}

function updateParallax(dpos) {
  const c = segAt(S.pos + PLAYER_Z).curve;
  const d = c * (dpos / SEG_LEN);
  S.skyOff += d * K_SKY; S.farOff += d * K_FAR; S.nearOff += d * K_NEAR;
}

function updateTraffic(dt) {
  const endZ = (S.N + 280) * SEG_LEN;
  for (const lane of S.lanes) {
    let ahead = null;
    for (const c of lane) {
      if (c.removed) continue;
      let eff = c.speed;
      if (ahead && ahead.z - c.z < 1000) eff = Math.min(eff, ahead.eff);
      c.eff = eff;
      ahead = c;
    }
  }
  for (const c of S.cars) {
    if (c.removed) continue;
    c.z += c.eff * dt;
    if (c.z >= endZ) c.removed = true;
  }
}

function crash(ox) {
  S.speed = Math.min(S.speed, CRASH_SPEED_CAP);
  S.crashes += 1;
  S.invuln = CRASH_INVULN;
  S.playerX = clamp(S.playerX + (S.playerX >= ox ? 1 : -1) * CRASH_PUSH, -2, 2);
  sound.play('sfx_crash');
  S.smokeCount = 0; S.smokeClock = 0;
  S.shakeT = 0.3;
  for (let i = 0; i < 8; i++) {
    S.particles.push({ kind: 'spark', x: 320 + (Math.random() - 0.5) * 60, y: 300 + Math.random() * 20, vx: (Math.random() - 0.5) * 260, vy: -80 - Math.random() * 160, age: 0, life: 0.45 });
  }
}

function collide(prevPZ, pZ) {
  // traffic
  for (const c of S.cars) {
    if (c.removed) continue;
    const rel = c.z - pZ, prev = c.prevRel;
    c.prevRel = rel;
    const flipped = (prev > 0 && rel <= 0) || (prev < 0 && rel >= 0);
    if (!c.hit && S.invuln <= 0 && (Math.abs(rel) < HIT_Z_WINDOW || flipped) && Math.abs(c.x - S.playerX) < PLAYER_HIT_HALFW + c.halfW) {
      c.hit = true;
      crash(c.x);
    }
    if (prev > 0 && rel <= 0 && !c.hit && !c.passed) {
      c.passed = true;
      S.overtakes += 1;
      S.scoreF += 50;
      S.popups.push({ text: '+50', x: 320, y: 250, t: 0, color: '#ffe060' });
      sound.play('sfx_overtake');
      const gap = Math.abs(c.x - S.playerX) - (PLAYER_HIT_HALFW + c.halfW);
      if (S.speed >= 180 * 40 && gap >= 0 && gap < 0.12) {
        S.scoreF += 20;
        S.popups.push({ text: 'NEAR MISS +20', x: 320, y: 228, t: 0, color: '#6af4ff' });
      }
    }
  }
  // roadside solids
  if (S.invuln > 0) return;
  const si = Math.floor(pZ / SEG_LEN);
  for (let i = si - 2; i <= si + 2; i++) {
    const seg = S.segs[i];
    if (!seg) continue;
    for (const sp of seg.sprites) {
      if (!sp.solid || sp.hit) continue;
      const rel = sp.z - pZ, prev = sp.z - prevPZ;
      const flipped = (prev > 0 && rel <= 0);
      if ((Math.abs(rel) < HIT_Z_WINDOW || flipped) && Math.abs(sp.offset - S.playerX) < PLAYER_HIT_HALFW + sp.halfW) {
        sp.hit = true;
        crash(sp.offset);
        return;
      }
    }
  }
}

function stepPlaying(dt) {
  const st = STAGES[S.stage - 1];
  if (S.invuln > 0) S.invuln = Math.max(0, S.invuln - dt);
  // 1. accel
  const throttle = inThrottle(), brake = inBrake();
  let a = throttle ? ACCEL : brake ? -BRAKE : -COAST;
  if (Math.abs(S.playerX) > 1 && S.speed > OFFROAD_LIMIT) a -= OFFROAD_DECEL;
  S.speed = clamp(S.speed + a * dt, 0, MAX_SPEED);
  // 2. steering
  const pSeg = segAt(S.pos + PLAYER_Z);
  const steer = (inRight() ? 1 : 0) + (inLeft() ? -1 : 0);
  const sp = S.speed / MAX_SPEED;
  const dxp = dt * STEER_RATE * sp;
  S.playerX += steer * dxp;
  S.playerX -= dxp * sp * pSeg.curve * CENTRIFUGAL;
  S.playerX = clamp(S.playerX, -2, 2);
  S.steerVis = steer;
  // 3. advance
  const prevPZ = S.pos + PLAYER_Z;
  const dpos = S.speed * dt;
  S.pos += dpos;
  S.scoreF += dpos / 144;
  updateParallax(dpos);
  const pZ = S.pos + PLAYER_Z;
  updateTraffic(dt);
  collide(prevPZ, pZ);
  // checkpoints
  while (S.cpIdx < st.cps.length && pZ >= st.cps[S.cpIdx] * SEG_LEN) {
    S.cpIdx++;
    S.checkpointsPassed++;
    S.timeLeft += st.cpAdd;
    S.scoreF += 500;
    S.bannerT = 2.0; S.bannerAdd = st.cpAdd;
    sound.play('sfx_checkpoint');
  }
  // time
  S.timeLeft -= dt;
  if (pZ >= S.goalZ) {
    // goal has priority
    S.timeLeft = Math.max(0, S.timeLeft);
    S.clearTimeLeft = Math.floor(S.timeLeft);
    S.clearTimeBonus = 100 * S.clearTimeLeft;
    S.clearStageBonus = 1000 * S.stage;
    S.scoreF += S.clearTimeBonus + S.clearStageBonus;
    S.scene = 'stageclear'; S.sceneT = 0;
    sound.stopBgm(); sound.play('sfx_goal'); sound.setOffroad(false);
    return;
  }
  if (S.timeLeft <= 0) {
    S.timeLeft = 0;
    S.scene = 'timeup'; S.sceneT = 0;
    sound.stopBgm(); sound.play('sfx_timeup'); sound.setOffroad(false);
    return;
  }
  if (S.timeLeft <= 10) {
    const c = Math.ceil(S.timeLeft);
    if (c !== S.lastWarn) { S.lastWarn = c; sound.play('sfx_timewarn'); }
  }
  // offroad dust
  if (Math.abs(S.playerX) > 1 && S.speed > 0 && (Math.round(S.animT * 60) % 4 === 0)) {
    for (const sx of [262, 378]) S.particles.push({ kind: 'dust', x: sx + (Math.random() - 0.5) * 10, y: 350, vx: (sx < 320 ? -1 : 1) * (20 + Math.random() * 40), vy: -20 - Math.random() * 30, age: 0, life: 0.45 });
  }
}

function stepAuto(dt, decel) {
  S.speed = Math.max(0, S.speed - decel * dt);
  if (S.invuln > 0) S.invuln = Math.max(0, S.invuln - dt);
  const dpos = S.speed * dt;
  S.pos += dpos;
  updateParallax(dpos);
  updateTraffic(dt);
  for (const c of S.cars) c.prevRel = c.z - (S.pos + PLAYER_Z);
  S.steerVis = 0;
}

function stepTitle(dt) {
  S.speed = 7200;
  const dpos = S.speed * dt;
  S.pos += dpos;
  updateParallax(dpos);
  updateTraffic(dt);
  const pZ = S.pos + PLAYER_Z;
  // pick a clear lane
  const blocked = [false, false, false];
  for (const c of S.cars) { if (!c.removed && c.z - pZ > -300 && c.z - pZ < 4000) blocked[c.lane] = true; }
  const cur = LANE_X.indexOf(S.titleTargetX);
  if (cur < 0 || blocked[cur]) {
    let bestL = -1, bd = 9;
    for (let l = 0; l < 3; l++) if (!blocked[l] && Math.abs(LANE_X[l] - S.playerX) < bd) { bd = Math.abs(LANE_X[l] - S.playerX); bestL = l; }
    if (bestL >= 0) S.titleTargetX = LANE_X[bestL];
  }
  const d = S.titleTargetX - S.playerX;
  const mv = clamp(d, -1.2 * dt, 1.2 * dt);
  S.playerX += mv;
  S.steerVis = Math.abs(d) > 0.05 ? Math.sign(d) : 0;
  if (pZ > (S.N - 40) * SEG_LEN) { goTitle(); }
}

function step() {
  const dt = STEP;
  if (S.scene === 'paused') return;
  S.animT += dt;
  S.sceneT += dt;
  switch (S.scene) {
    case 'title': stepTitle(dt); break;
    case 'countdown':
      S.steerVis = 0;
      if (S.sceneT >= S.cdBeeps && S.cdBeeps < 3) { S.cdBeeps++; sound.play('sfx_beep'); }
      if (S.sceneT >= 3 - 1e-9) {
        S.scene = 'playing'; S.sceneT = 0; S.goT = 0.8; S.stageNameT = 1.0;
        sound.play('sfx_go');
      }
      break;
    case 'playing':
      if (S.goT > 0) S.goT = Math.max(0, S.goT - dt);
      if (S.stageNameT > 0) S.stageNameT = Math.max(0, S.stageNameT - dt);
      if (S.bannerT > 0) S.bannerT = Math.max(0, S.bannerT - dt);
      stepPlaying(dt);
      break;
    case 'stageclear': stepAuto(dt, 3000); if (S.bannerT > 0) S.bannerT = Math.max(0, S.bannerT - dt); break;
    case 'timeup':
      stepAuto(dt, 6000);
      if (S.sceneT >= 2.5 - 1e-9) toGameOver();
      break;
    default: break;
  }
  // effects
  if (S.shakeT > 0) S.shakeT = Math.max(0, S.shakeT - dt);
  if (S.fadeT > 0) S.fadeT = Math.max(0, S.fadeT - dt);
  if (S.smokeCount < 6) {
    if (S.smokeClock >= S.smokeCount * 0.08 - 1e-6) {
      S.particles.push({ kind: 'smoke', x: 320 + (Math.random() - 0.5) * 40, y: 340, vx: (Math.random() - 0.5) * 10, vy: -30, age: 0, life: 0.5 });
      S.smokeCount++;
    }
    S.smokeClock += dt;
  }
  for (const p of S.particles) {
    p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'spark') p.vy += 600 * dt;
  }
  S.particles = S.particles.filter((p) => p.age < p.life);
  for (const p of S.popups) p.t += dt;
  S.popups = S.popups.filter((p) => p.t < 1.0);
  if (Math.round(S.animT * 60) % 3 === 0) {
    const off = Math.abs(S.playerX) > 1;
    S.bounce = S.speed > 0 ? Math.round(Math.random() * (off ? 3 : 1)) : 0;
  }
}

// ---------- rendering ----------
const fogCache = new Map();
function fogCol(c, fog, lvl) {
  const k = c + fog + lvl;
  let v = fogCache.get(k);
  if (!v) { v = mix(c, fog, lvl / 20); fogCache.set(k, v); }
  return v;
}
function fogLevel(n) { const t = n / DRAW_DIST; return Math.min(17, Math.round(Math.pow(t, 1.4) * 20)); }

function project(p, camX, camY, camZ) {
  p.camZ = p.z - camZ;
  p.scale = CAM_DEPTH / p.camZ;
  p.screenX = Math.round(W / 2 + p.scale * (0 - camX) * W / 2);
  p.screenY = Math.round(H / 2 - p.scale * (p.y - camY) * H / 2);
  p.screenW = Math.round(p.scale * ROAD_HALF * W / 2);
}

function poly(x1, y1, x2, y2, x3, y3, x4, y4, c) {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
  ctx.closePath(); ctx.fill();
}

function drawLayer(img, off, y) {
  const o = ((off % 640) + 640) % 640;
  const x = -Math.round(o);
  ctx.drawImage(img, x, y);
  ctx.drawImage(img, x + 640, y);
}

let drawn = { base: 0, count: 0 };
function renderWorld() {
  const st = STAGES[S.stage - 1];
  const C = st.colors;
  const n1 = S.stage;
  // background
  ctx.fillStyle = C.ground;
  ctx.fillRect(0, 180, W, 180);
  drawLayer(A['bg_sky_' + n1].frames[0], S.skyOff, 0);
  drawLayer(A['bg_far_' + n1].frames[0], S.farOff, 84);
  drawLayer(A['bg_near_' + n1].frames[0], S.nearOff, 124);

  const segs = S.segs;
  const baseIdx = Math.floor(S.pos / SEG_LEN);
  const baseSeg = segs[Math.min(baseIdx, segs.length - 1)];
  const basePercent = (S.pos % SEG_LEN) / SEG_LEN;
  const pZ = S.pos + PLAYER_Z;
  const pSeg = segAt(pZ);
  const pPercent = (pZ % SEG_LEN) / SEG_LEN;
  const playerY = lerp(pSeg.p1.y, pSeg.p2.y, pPercent);
  const camY = CAM_HEIGHT + playerY;
  let maxY = H, x = 0, dx = -baseSeg.curve * basePercent;
  let count = 0;
  for (let n = 0; n < DRAW_DIST; n++) {
    const seg = segs[baseIdx + n];
    if (!seg) break;
    count++;
    seg.clipY = maxY;
    seg.cars.length = 0;
    project(seg.p1, S.playerX * ROAD_HALF - x, camY, S.pos);
    project(seg.p2, S.playerX * ROAD_HALF - x - dx, camY, S.pos);
    x += dx; dx += seg.curve;
    const p1 = seg.p1, p2 = seg.p2;
    if (p1.camZ <= CAM_DEPTH || p2.screenY >= p1.screenY || p2.screenY >= maxY) continue;
    const lvl = fogLevel(n);
    const b = seg.band;
    const fog = C.fog;
    const y1 = p1.screenY + 1, y2 = p2.screenY;
    const x1 = p1.screenX, x2 = p2.screenX, w1 = p1.screenW, w2 = p2.screenW;
    ctx.fillStyle = fogCol(C.grass[b], fog, lvl);
    ctx.fillRect(0, y2, W, y1 - y2);
    const r1 = w1 / 6, r2 = w2 / 6;
    const rc = fogCol(C.rumble[b], fog, lvl);
    poly(x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, rc);
    poly(x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, rc);
    poly(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, fogCol(C.road[b], fog, lvl));
    if (b === 0) {
      const l1 = w1 / 32, l2 = w2 / 32;
      const lc = fogCol(C.lane, fog, lvl);
      for (const f of [-1 / 3, 1 / 3]) {
        const c1 = x1 + w1 * f, c2 = x2 + w2 * f;
        poly(c1 - l1 / 2, y1, c1 + l1 / 2, y1, c2 + l2 / 2, y2, c2 - l2 / 2, y2, lc);
      }
    }
    maxY = p1.screenY;
  }
  drawn = { base: baseIdx, count };
  // bucket cars into segments
  for (const c of S.cars) {
    if (c.removed) continue;
    const i = Math.floor(c.z / SEG_LEN);
    if (i >= baseIdx && i < baseIdx + count) segs[i].cars.push(c);
  }
  // sprites far to near
  const night = S.stage === 3;
  for (let n = count - 1; n >= 0; n--) {
    const seg = segs[baseIdx + n];
    if (seg.p1.camZ <= CAM_DEPTH) continue;
    if (seg.cars.length > 1) seg.cars.sort((a, b) => b.z - a.z);
    for (const c of seg.cars) {
      const img = A[c.id].frames[c.variant % A[c.id].frames.length];
      const r = drawSprite(seg, img, ASSET_INFO[c.id], c.z, c.x);
      if (r && night) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55;
        const gs = r.w * 0.45;
        const gy = r.y + r.h * (c.type === 'truck' ? 0.8 : 0.52) - gs / 2;
        if (gy < seg.clipY) {
          ctx.drawImage(glow.red, r.x + r.w * 0.12 - gs / 2, gy, gs, gs);
          ctx.drawImage(glow.red, r.x + r.w * 0.88 - gs / 2, gy, gs, gs);
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
    }
    for (const sp of seg.sprites) {
      const r = drawSprite(seg, A[sp.id].frames[0], ASSET_INFO[sp.id], sp.z, sp.offset);
      if (r && night && (sp.id === 'rs_lamp' || sp.id === 'rs_neon')) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45;
        if (sp.id === 'rs_lamp') {
          const gs = r.w * 1.1;
          for (const fx of [0.17, 0.83]) { const gy = r.y + r.h * 0.11 - gs / 2; if (gy < seg.clipY) ctx.drawImage(glow.yellow, r.x + r.w * fx - gs / 2, gy, gs, gs); }
        } else {
          const gs = r.w * 1.1;
          const gy = r.y + r.h * 0.33 - gs * 0.35;
          ctx.globalAlpha = 0.28;
          if (gy < seg.clipY) ctx.drawImage(glow.pink, r.x + r.w / 2 - gs / 2, gy, gs, gs * 0.7);
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
    }
  }
}

function drawSprite(seg, img, info, z, offset) {
  const p1 = seg.p1, p2 = seg.p2;
  const percent = (z % SEG_LEN) / SEG_LEN;
  const sScale = lerp(p1.scale, p2.scale, percent);
  const sX = lerp(p1.screenX, p2.screenX, percent) + sScale * offset * ROAD_HALF * W / 2;
  const sY = lerp(p1.screenY, p2.screenY, percent);
  const roadW = sScale * ROAD_HALF * W / 2;
  const destW = info.worldW * roadW;
  if (!(destW >= 1)) return null;
  const destH = destW * (info.h / info.w);
  const top = sY - destH;
  const clipY = seg.clipY;
  if (top >= clipY) return null;
  const visH = Math.min(destH, clipY - top);
  const srcH = info.h * (visH / destH);
  if (srcH <= 0) return null;
  const dx = Math.round(sX - destW / 2), dy = Math.round(top);
  ctx.drawImage(img, 0, 0, info.w, Math.max(0.01, srcH), dx, dy, Math.round(destW), Math.max(1, Math.round(visH)));
  return { x: dx, y: dy, w: destW, h: destH };
}

function drawPlayerCar() {
  if (S.invuln > 0 && Math.floor(S.invuln / 0.05) % 2 === 1) return;
  const turn = S.steerVis < 0 ? 1 : S.steerVis > 0 ? 2 : 0;
  let img;
  const braking = S.scene === 'playing' && inBrake() && !inThrottle();
  if (braking) img = A.car_player_brake.frames[turn];
  else if (S.speed > 0 && ['playing', 'title', 'stageclear', 'timeup'].includes(S.scene)) img = A.car_player_wheel.frames[turn * 2 + (Math.floor(S.animT * 20) % 2)];
  else img = A.car_player.frames[turn];
  const bottom = 354 - S.bounce;
  if (S.stage === 3) {
    // headlight beams
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,230,160,0.07)';
    for (const bx of [-40, 40]) {
      ctx.beginPath(); ctx.moveTo(320 + bx - 12, bottom - 70); ctx.lineTo(320 + bx + 12, bottom - 70);
      ctx.lineTo(320 + bx * 1.6 + 70, 215); ctx.lineTo(320 + bx * 1.6 - 70, 215); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.drawImage(img, 240, bottom - 88, 160, 88);
  if (S.stage === 3 || braking) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = braking ? 0.6 : 0.3;
    for (const lx of [268, 372]) ctx.drawImage(glow.red, lx - 24, bottom - 88 + 42 - 24, 48, 48);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
}

function drawParticles() {
  for (const p of S.particles) {
    const t = p.age / p.life;
    if (p.kind === 'smoke') {
      const f = Math.min(3, Math.floor(t * 4));
      ctx.drawImage(A.fx_smoke.frames[f], Math.round(p.x - 12), Math.round(p.y - 12), 24, 24);
    } else if (p.kind === 'dust') {
      const f = Math.min(2, Math.floor(t * 3));
      ctx.drawImage(A.fx_dust.frames[f], Math.round(p.x - 12), Math.round(p.y - 12), 24, 24);
    } else {
      const f = Math.min(2, Math.floor(t * 3));
      ctx.drawImage(A.fx_spark.frames[f], Math.round(p.x - 9), Math.round(p.y - 9), 18, 18);
    }
  }
}

function drawSpeedLines() {
  const kmh = S.speed / 40;
  if (kmh < 250 || S.scene !== 'playing') return;
  const a = Math.min(1, (kmh - 250) / 50);
  ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.35 * a})`;
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const y = 80 + Math.random() * 240;
    const x = side < 0 ? Math.random() * 90 : 640 - Math.random() * 90;
    const len = 20 + Math.random() * 40;
    ctx.fillRect(Math.round(side < 0 ? x : x - len), Math.round(y), Math.round(len), 1);
  }
}

// ---------- HUD & overlays ----------
const blink = (period) => (S.animT % period) < period / 2;

function drawHUD() {
  const st = STAGES[S.stage - 1];
  const sc = score();
  drawText(ctx, 'TIME', 8, 6, 2, '#ffe060');
  const tl = Math.ceil(S.timeLeft - 1e-9);
  const warn = S.timeLeft <= 10;
  if (!warn || blink(0.5)) drawText(ctx, pad(tl, 2), 8, 22, 4, warn ? '#ff3030' : '#ffffff');
  drawText(ctx, 'SCORE', 320, 6, 2, '#ffe060', 'center');
  drawText(ctx, pad(sc, 6), 320, 22, 3, '#ffffff', 'center');
  drawText(ctx, `STAGE ${S.stage}/3`, 632, 6, 2, '#ffe060', 'right');
  drawText(ctx, 'BEST ' + pad(Math.max(best, sc), 6), 632, 24, 2, '#ffffff', 'right');
  // progress bar
  const bx = 120, bw = 400, by = 54;
  const prog = clamp((S.pos + PLAYER_Z) / S.goalZ, 0, 1);
  ctx.fillStyle = '#000000'; ctx.fillRect(bx - 2, by - 2, bw + 4, 12);
  ctx.fillStyle = '#34304a'; ctx.fillRect(bx, by, bw, 8);
  ctx.fillStyle = S.stage === 1 ? '#ff9a40' : S.stage === 2 ? '#b070ff' : '#ff3cc8';
  ctx.fillRect(bx, by, Math.round(bw * prog), 8);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by, Math.round(bw * prog), 2);
  for (const c of st.cps) {
    const cx = bx + Math.round(bw * c / st.N);
    ctx.fillStyle = '#000'; ctx.fillRect(cx - 1, by - 3, 3, 14);
    ctx.fillStyle = '#6af4ff'; ctx.fillRect(cx, by - 2, 1, 12);
  }
  // goal flag
  ctx.fillStyle = '#ddd'; ctx.fillRect(bx + bw + 3, by - 6, 1, 16);
  for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < 4; xx++) { ctx.fillStyle = (xx + yy) % 2 ? '#111' : '#fff'; ctx.fillRect(bx + bw + 4 + xx * 2, by - 6 + yy * 2, 2, 2); }
  drawText(ctx, 'F', bx + bw + 14, by, 1, '#ffffff');
  // marker
  const mx = bx + Math.round(bw * prog);
  ctx.fillStyle = '#000';
  for (let i = 0; i < 6; i++) ctx.fillRect(mx - i - 1, by - 9 + i, i * 2 + 3, 1);
  ctx.fillStyle = '#ffe060';
  for (let i = 0; i < 5; i++) ctx.fillRect(mx - i, by - 9 + i, i * 2 + 1, 1);
  drawText(ctx, 'PASSED ' + S.overtakes, 8, 330, 2, '#ffffff');
  drawText(ctx, muted ? '[M] SOUND OFF' : '[M] SOUND ON', 8, 346, 1, muted ? '#ff8080' : '#a0ffa0');
  const kmh = Math.floor(S.speed / 40);
  drawText(ctx, String(kmh), 600, 314, 4, S.speed / 40 >= 250 ? '#ff9a40' : '#ffffff', 'right');
  drawText(ctx, 'KM/H', 600, 344, 2, '#ffe060', 'right');
  // banners
  if (S.bannerT > 0) {
    drawText(ctx, 'CHECKPOINT!', 320, 92, 3, blink(0.2) ? '#ffe040' : '#ffffff', 'center');
    drawText(ctx, `+${S.bannerAdd} SEC`, 320, 118, 2, '#6af4ff', 'center');
  }
  for (const p of S.popups) drawText(ctx, p.text, p.x, Math.round(p.y - p.t * 40), 2, p.color, 'center');
  if (DEBUG) drawText(ctx, 'FPS ' + fps, 632, 300, 1, '#80ff80', 'right');
}

function dim(a) { ctx.fillStyle = `rgba(4,2,12,${a})`; ctx.fillRect(0, 0, W, H); }

function drawTitle() {
  const lg = A.logo_title.frames[0];
  const fy = Math.round(Math.sin(S.animT * 2) * 3);
  ctx.fillStyle = 'rgba(20,6,30,0.35)'; ctx.fillRect(0, 14, W, 128);
  ctx.drawImage(lg, 20, 22 + fy, 600, 96);
  // shine sweep
  const sx = ((S.animT * 220) % 1200) - 200;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(sx, 22 + fy); ctx.lineTo(sx + 16, 22 + fy); ctx.lineTo(sx - 14, 112 + fy); ctx.lineTo(sx - 30, 112 + fy); ctx.closePath(); ctx.fill();
  ctx.restore();
  drawText(ctx, 'CHASE THE SUN. BEAT THE CLOCK.', 320, 124, 2, '#fff0c0', 'center', '#401030');
  if (blink(0.5)) drawText(ctx, 'PRESS ENTER', 320, 186, 3, '#ffffff', 'center', '#401030');
  drawText(ctx, 'BEST ' + pad(best, 6), 320, 220, 2, '#ffe060', 'center', '#401030');
  ctx.fillStyle = 'rgba(10,4,20,0.6)'; ctx.fillRect(0, 290, W, 42);
  drawText(ctx, 'UP/W GAS   DOWN/S BRAKE   LEFT-RIGHT/AD STEER', 320, 296, 2, '#ffffff', 'center');
  drawText(ctx, 'P PAUSE    R RESTART      M SOUND', 320, 314, 2, '#ffffff', 'center');
  drawText(ctx, muted ? '[M] SOUND OFF' : '[M] SOUND ON', 8, 346, 1, muted ? '#ff8080' : '#a0ffa0');
}

function drawCountdown() {
  const st = STAGES[S.stage - 1];
  if (S.scene === 'countdown' || S.stageNameT > 0) {
    drawText(ctx, `STAGE ${S.stage}`, 320, 70, 3, '#ffe060', 'center');
    drawText(ctx, st.name, 320, 96, 3, '#ffffff', 'center');
  }
  if (S.scene === 'countdown') {
    const n = 3 - Math.floor(S.sceneT);
    if (n >= 1) {
      const pop = S.sceneT % 1 < 0.1 ? 7 : 6;
      drawText(ctx, String(n), 320, 150, pop, '#ffffff', 'center', '#401030');
      // signal lamps
      for (let i = 0; i < 3; i++) {
        const lit = i < 4 - n;
        ctx.fillStyle = '#101014'; ctx.fillRect(284 + i * 26, 124, 20, 20);
        ctx.fillStyle = lit ? '#ff3030' : '#3a1010'; ctx.fillRect(287 + i * 26, 127, 14, 14);
      }
    }
  }
  if (S.goT > 0) {
    drawText(ctx, 'GO!', 320, 150, S.goT > 0.7 ? 7 : 6, '#60ff80', 'center', '#103010');
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#101014'; ctx.fillRect(284 + i * 26, 124, 20, 20); ctx.fillStyle = '#40ff60'; ctx.fillRect(287 + i * 26, 127, 14, 14); }
  }
}

function drawStageClear() {
  if (S.sceneT < 1.5) {
    drawText(ctx, 'GOAL!', 320, 130, S.sceneT < 0.15 ? 8 : 7, blink(0.2) ? '#ffe040' : '#ffffff', 'center', '#401030');
    return;
  }
  const t = Math.min(1, (S.sceneT - 1.5) / 0.8);
  ctx.fillStyle = 'rgba(10,6,24,0.82)'; ctx.fillRect(140, 80, 360, 200);
  ctx.fillStyle = '#ffb040'; ctx.fillRect(140, 80, 360, 2); ctx.fillRect(140, 278, 360, 2); ctx.fillRect(140, 80, 2, 200); ctx.fillRect(498, 80, 2, 200);
  ctx.fillStyle = '#ff4a78'; ctx.fillRect(144, 84, 352, 1); ctx.fillRect(144, 275, 352, 1);
  drawText(ctx, `STAGE ${S.stage} CLEAR!`, 320, 96, 3, '#ffe060', 'center');
  const tb = Math.round(S.clearTimeBonus * t), sb = Math.round(S.clearStageBonus * t);
  const shownScore = score() - (S.clearTimeBonus - tb) - (S.clearStageBonus - sb);
  drawText(ctx, 'TIME LEFT', 156, 134, 2, '#ffffff');
  drawText(ctx, `${pad(S.clearTimeLeft, 2)}  X100`, 296, 134, 2, '#ffffff');
  drawText(ctx, '= ' + tb, 484, 134, 2, '#ffffff', 'right');
  drawText(ctx, 'STAGE BONUS', 156, 160, 2, '#ffffff');
  drawText(ctx, '= ' + sb, 484, 160, 2, '#ffffff', 'right');
  drawText(ctx, 'SCORE', 156, 194, 2, '#ffe060');
  drawText(ctx, '= ' + pad(shownScore, 6), 484, 194, 2, '#ffe060', 'right');
  if (blink(0.5)) drawText(ctx, 'PRESS ENTER', 320, 240, 2, '#ffffff', 'center');
}

function drawGameOver() {
  dim(0.72);
  drawText(ctx, 'GAME OVER', 320, 64, 5, '#ff4040', 'center');
  drawText(ctx, `REACHED STAGE ${S.stage}`, 320, 128, 2, '#ffffff', 'center');
  drawText(ctx, 'SCORE ' + pad(score(), 6), 320, 158, 3, '#ffe060', 'center');
  drawText(ctx, 'BEST ' + pad(best, 6), 320, 196, 2, '#ffffff', 'center');
  if (S.newBest && blink(0.5)) drawText(ctx, 'NEW BEST!', 320, 222, 2, '#6af4ff', 'center');
  drawText(ctx, 'ENTER: RETRY   ESC: TITLE', 320, 280, 2, '#ffffff', 'center');
}

function drawEnding() {
  dim(0.72);
  drawText(ctx, 'ALL CLEAR!', 320, 30, 5, blink(0.4) ? '#ffe040' : '#ffb040', 'center', '#401030');
  drawText(ctx, 'TOTAL SCORE', 320, 90, 2, '#ffffff', 'center');
  drawText(ctx, pad(score(), 6), 320, 108, 3, '#ffe060', 'center');
  drawText(ctx, 'RANK', 320, 146, 2, '#ffffff', 'center');
  const rc = { S: '#ffe040', A: '#ff6ad8', B: '#6af4ff', C: '#c0c0c0' }[S.rank] || '#fff';
  drawText(ctx, S.rank || '-', 320, 166, 8, rc, 'center', '#401030');
  drawText(ctx, 'BEST ' + pad(best, 6), 320, 236, 2, '#ffffff', 'center');
  if (S.newBest && blink(0.5)) drawText(ctx, 'NEW BEST!', 320, 260, 2, '#6af4ff', 'center');
  if (blink(0.5)) drawText(ctx, 'PRESS ENTER', 320, 300, 2, '#ffffff', 'center');
}

function render() {
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  if (S.shakeT > 0) ctx.translate(Math.round((Math.random() - 0.5) * 8 * S.shakeT / 0.3), Math.round((Math.random() - 0.5) * 6 * S.shakeT / 0.3));
  renderWorld();
  drawPlayerCar();
  drawParticles();
  ctx.restore();
  drawSpeedLines();
  const sc = S.scene;
  if (sc === 'title') drawTitle();
  else {
    if (sc !== 'gameover' && sc !== 'ending') drawHUD();
    if (sc === 'countdown' || sc === 'playing') drawCountdown();
    if (sc === 'paused') {
      dim(0.6);
      drawText(ctx, 'PAUSED', 320, 140, 4, '#ffffff', 'center');
      drawText(ctx, 'P/ESC: RESUME   R: RESTART   Q: TITLE', 320, 190, 2, '#ffe060', 'center');
    }
    if (sc === 'stageclear') drawStageClear();
    if (sc === 'timeup') drawText(ctx, 'TIME UP', 320, 140, 7, '#ff3030', 'center', '#300808');
    if (sc === 'gameover') drawGameOver();
    if (sc === 'ending') drawEnding();
  }
  if (S.fadeT > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, S.fadeT / 0.4)})`; ctx.fillRect(0, 0, W, H); }
}

// ---------- audio per frame ----------
function engineSp() { return clamp(S.speed / MAX_SPEED, 0, 1); }
function engineActive() { return ['countdown', 'playing', 'stageclear', 'timeup'].includes(S.scene); }
function updateAudio() {
  const on = engineActive();
  sound.setEngine(on, S.scene === 'countdown' ? 0 : engineSp());
  sound.setOffroad(S.scene === 'playing' && Math.abs(S.playerX) > 1 && S.speed > 0);
  if (S.scene === 'countdown' || S.scene === 'playing') {
    const id = STAGES[S.stage - 1].bgm;
    if (sound.bgmId !== id) sound.playBgm(id);
  }
}

// ---------- loop ----------
let lastT = performance.now(), acc = 0, fps = 0, fpsN = 0, fpsT = 0;
function frame(now) {
  let el = (now - lastT) / 1000;
  lastT = now;
  if (el < 0) el = 0;
  el = Math.min(el, 0.1);
  acc += el;
  let n = 0;
  while (acc >= STEP - 1e-9 && n < 6) { step(); acc -= STEP; n++; }
  if (n >= 6 && acc >= STEP) acc = 0;
  if (acc < 0) acc = 0;
  updateAudio();
  render();
  fpsN++; fpsT += el;
  if (fpsT >= 0.5) { fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
  requestAnimationFrame(frame);
}

// ---------- hooks ----------
function getState() {
  const sc = S.scene;
  const pZ = S.pos + PLAYER_Z;
  const sp = engineSp();
  return {
    scene: sc, seed, stage: S.stage, score: score(), best, timeLeft: S.timeLeft,
    speedKmh: S.speed / 40, playerX: S.playerX, distanceM: S.pos / 144,
    goalRemainingM: Math.max(0, (S.goalZ - pZ) / 144),
    checkpointsPassed: S.checkpointsPassed, overtakes: S.overtakes, crashes: S.crashes,
    invulnerable: S.invuln > 0, trafficTotal: S.cars.length, layoutHash: S.layoutHash, muted,
    rank: sc === 'ending' ? S.rank : null,
    audio: {
      state: sound.state,
      bgm: (sc === 'countdown' || sc === 'playing' || sc === 'paused') ? STAGES[S.stage - 1].bgm : null,
      engineHz: engineActive() ? 60 + 140 * (sc === 'countdown' ? 0 : sp) : 0,
    },
  };
}
window.__game = { getState };
if (DEBUG) {
  window.__game.debug = {
    warp(m) {
      if (S.scene !== 'countdown' && S.scene !== 'playing') return;
      S.pos = clamp(Number(m) * 144, 0, S.goalZ - 3000);
      const pZ = S.pos + PLAYER_Z;
      for (const c of S.cars) { if (c.z < pZ) c.passed = true; c.prevRel = c.z - pZ; }
      const st = STAGES[S.stage - 1];
      while (S.cpIdx < st.cps.length && pZ >= st.cps[S.cpIdx] * SEG_LEN) { S.cpIdx++; S.checkpointsPassed++; }
    },
    setTime(sec) { S.timeLeft = Number(sec); },
    setPlayerX(x) { S.playerX = clamp(Number(x), -2, 2); },
    setSpeedKmh(v) { S.speed = clamp(Number(v), 0, 300) * 40; },
  };
}

goTitle();
S.fadeT = 0;
requestAnimationFrame(frame);
