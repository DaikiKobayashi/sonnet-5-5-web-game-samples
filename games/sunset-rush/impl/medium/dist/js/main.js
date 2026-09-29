import {
  W, H, STEP, SEG_LEN, ROAD_HALF, CAM_HEIGHT, CAM_DEPTH, PLAYER_Z, DRAW_DIST, MAX_SPEED, M_UNIT,
  STAGES, buildSegments, genTraffic, genRoadside, gatesOf, stageRng, hashLayout,
} from './course.js';
import { drawText, textWidth } from './font.js';
import { buildAssets } from './art.js';
import { AudioSys } from './audio.js';

const params = new URLSearchParams(location.search);

if (params.get('gallery') === '1') {
  const { startGallery } = await import('./gallery.js');
  startGallery();
} else {
  startGame();
}

function startGame() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  const A = buildAssets();
  const audio = new AudioSys();
  const debugOn = params.get('debug') === '1';

  // ---------------------------------------------------------------- constants
  const ACCEL = 2400, BRAKE = 6000, COAST = 1800, OFFROAD_DECEL = 6000, OFFROAD_LIMIT = 3000;
  const STEER_RATE = 2.0, CENTRIFUGAL = 0.3, CRASH_SPEED_CAP = 2400, CRASH_INVULN = 1.2, CRASH_PUSH = 0.12;
  const HIT_HALFW = 0.10, HIT_Z = 300;
  const KEY = 'sunset-rush:v1';

  const PAL = [
    { grass: ['#d8aa64', '#c99a56'], rumble: ['#f0e8d8', '#d8483c'], road: ['#787888', '#646476'], lane: '#f4ecdc', fog: '#f4a878', ground: '#d8aa64' },
    { grass: ['#2f6440', '#265636'], rumble: ['#e8dcf4', '#a850d0'], road: ['#54507a', '#443f66'], lane: '#dcd4f4', fog: '#7a4a98', ground: '#2f6440' },
    { grass: ['#14283f', '#0b1a2c'], rumble: ['#ff3ca8', '#1a2a70'], road: ['#2c2c58', '#1e1e42'], lane: '#40f0ff', fog: '#141a48', ground: '#14283f' },
  ];
  const palCache = [];
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function fogged(base, fog, t) {
    const a = hex(base), b = hex(fog);
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  }
  function palFor(idx) {
    if (palCache[idx]) return palCache[idx];
    const p = PAL[idx];
    const out = { g0: [], g1: [], r0: [], r1: [], d0: [], d1: [], l: [] };
    for (let n = 0; n < DRAW_DIST; n++) {
      const t = Math.min(1, Math.pow(n / DRAW_DIST, 2.0) * 0.92);
      out.g0.push(fogged(p.grass[0], p.fog, t)); out.g1.push(fogged(p.grass[1], p.fog, t));
      out.r0.push(fogged(p.rumble[0], p.fog, t)); out.r1.push(fogged(p.rumble[1], p.fog, t));
      out.d0.push(fogged(p.road[0], p.fog, t)); out.d1.push(fogged(p.road[1], p.fog, t));
      out.l.push(fogged(p.lane, p.fog, t));
    }
    palCache[idx] = out;
    return out;
  }

  // ---------------------------------------------------------------- persistence
  function loadSave() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      if (v && typeof v === 'object') return { best: Number(v.best) || 0, muted: !!v.muted };
    } catch (e) { /* ignore */ }
    return { best: 0, muted: false };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ best: G.best, muted: G.savedMuted })); } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- state
  const seedParam = parseInt(params.get('seed'), 10);
  const SEED = Number.isFinite(seedParam) ? seedParam : (Date.now() & 0x7fffffff);
  const stParam = parseInt(params.get('stage'), 10);
  const START_STAGE = stParam >= 1 && stParam <= 3 ? stParam : 1;
  const saved = loadSave();

  const G = {
    scene: 'title', stage: 1, seed: SEED, score: 0, best: saved.best, muted: params.get('mute') === '1' ? true : saved.muted,
    savedMuted: saved.muted, timeLeft: 30, speed: 0, playerX: 0, pos: 0, checkpointsPassed: 0, invulnTimer: 0,
    overtakes: 0, crashes: 0, cars: [], roadside: [], segs: [], layoutHash: '', trafficTotal: 0,
    off: { sky: 0, far: 0, near: 0 }, tick: 0, cd: 3, cdLast: 4, goT: 99, sceneT: 0, bannerT: 99, bannerAdd: 0,
    smoke: null, puffs: [], sparks: [], dust: [], popups: [], shake: 0, fade: 0, newBest: false, rank: null,
    reached: 1, clearInfo: null, lastTimeInt: 99, input: { left: false, right: false, up: false, down: false },
    demoWrap: 0,
  };
  audio.muted = G.muted;

  function goalZ() { return STAGES[G.stage - 1].N * SEG_LEN; }
  function playerZ() { return G.pos + PLAYER_Z; }

  function loadStage(stageNum) {
    const idx = stageNum - 1, st = STAGES[idx];
    G.stage = stageNum;
    G.segs = buildSegments(idx);
    const rng = stageRng(SEED, stageNum);
    G.cars = genTraffic(idx, rng);
    G.roadside = genRoadside(idx, rng, G.segs);
    G.trafficTotal = st.traffic;
    G.layoutHash = hashLayout(G.cars, G.roadside);
    const gateKind = (seg, kind) => G.segs[seg].objs.push({ kind, x: 0, z: seg * SEG_LEN, worldW: 2.6, hw: 0, solid: false, gate: true });
    st.cps.forEach((s) => gateKind(s, 'gate_checkpoint'));
    gateKind(st.N, 'gate_goal');
    gateKind(8, 'gate_start');
    G.speed = 0; G.playerX = 0; G.pos = 0; G.checkpointsPassed = 0; G.invulnTimer = 0; G.timeLeft = st.time;
    G.smoke = null; G.puffs = []; G.sparks = []; G.dust = []; G.popups = []; G.shake = 0; G.bannerT = 99; G.goT = 99;
    G.lastTimeInt = 99;
    G.pal = palFor(idx);
  }

  function newRun() {
    G.score = 0; G.overtakes = 0; G.crashes = 0; G.newBest = false; G.rank = null;
    startCountdown(START_STAGE);
  }
  function startCountdown(stageNum) {
    loadStage(stageNum);
    G.scene = 'countdown';
    G.cd = 3; G.cdLast = 4; G.sceneT = 0; G.fade = 0.6;
  }
  function toTitle() {
    G.scene = 'title';
    loadStage(1);
    G.newBest = false;
    G.cars.forEach((c) => { c.passed = true; });
    G.speed = 7200;
  }
  function finishRun() {
    const s = Math.floor(G.score);
    G.newBest = false;
    if (s > G.best) { G.best = s; G.newBest = true; G.savedMuted = G.muted; save(); }
  }

  // ---------------------------------------------------------------- input
  const keys = new Set();
  const touchKeys = new Set();
  const down = (...codes) => codes.some((c) => keys.has(c) || touchKeys.has(c));
  const drive = () => {
    G.input.up = down('ArrowUp', 'KeyW');
    G.input.down = down('ArrowDown', 'KeyS');
    G.input.left = down('ArrowLeft', 'KeyA');
    G.input.right = down('ArrowRight', 'KeyD');
  };

  function decide() {
    const s = G.scene;
    if (s === 'title') { audio.sfx('sfx_menu'); newRun(); }
    else if (s === 'stageclear' && G.sceneT >= 1.5) {
      audio.sfx('sfx_menu');
      if (G.stage < 3) startCountdown(G.stage + 1);
      else { G.scene = 'ending'; finishRun(); G.rank = rankOf(Math.floor(G.score)); }
    } else if (s === 'gameover') { audio.sfx('sfx_menu'); newRun(); }
    else if (s === 'ending') { audio.sfx('sfx_menu'); toTitle(); }
  }
  function rankOf(sc) { return sc >= 33000 ? 'S' : sc >= 28000 ? 'A' : sc >= 23000 ? 'B' : 'C'; }
  function togglePause() {
    if (G.scene === 'playing') { G.scene = 'paused'; }
    else if (G.scene === 'paused') { G.scene = 'playing'; }
  }
  function restart() {
    if (['countdown', 'playing', 'paused', 'gameover', 'ending'].includes(G.scene)) newRun();
  }
  function toggleMute() {
    G.muted = !G.muted;
    G.savedMuted = G.muted;
    audio.setMuted(G.muted);
    save();
  }

  let firstInput = true;
  function userGesture() {
    audio.ensure();
    if (firstInput) { firstInput = false; if (G.scene === 'title') audio.sfx('jingle_title'); }
  }

  window.addEventListener('keydown', (e) => {
    const c = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) e.preventDefault();
    userGesture();
    keys.add(c);
    if (e.repeat) return;
    if (c === 'Enter' || c === 'Space') decide();
    else if (c === 'KeyP') togglePause();
    else if (c === 'Escape') {
      if (G.scene === 'gameover' || G.scene === 'ending') toTitle();
      else togglePause();
    } else if (c === 'KeyR') restart();
    else if (c === 'KeyQ') { if (G.scene === 'paused' || G.scene === 'gameover') toTitle(); }
    else if (c === 'KeyM') toggleMute();
    else if (c === 'KeyF') { try { if (document.fullscreenElement) document.exitFullscreen(); else canvas.requestFullscreen(); } catch (err) { /* ignore */ } }
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.code); });
  function clearKeys() { keys.clear(); touchKeys.clear(); }
  window.addEventListener('blur', () => { clearKeys(); if (G.scene === 'playing') togglePause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearKeys(); if (G.scene === 'playing') togglePause(); } });
  window.addEventListener('pointerdown', () => userGesture());
  canvas.addEventListener('pointerdown', () => { if (['title', 'stageclear', 'gameover', 'ending'].includes(G.scene)) decide(); });

  // touch buttons
  const tmap = { tl: 'ArrowLeft', tr: 'ArrowRight', tg: 'ArrowUp', tb: 'ArrowDown' };
  for (const id of Object.keys(tmap)) {
    const el = document.getElementById(id);
    if (!el) continue;
    const on = (e) => { e.preventDefault(); touchKeys.add(tmap[id]); userGesture(); };
    const off = () => touchKeys.delete(tmap[id]);
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
  }

  // ---------------------------------------------------------------- simulation
  function segAt(z) { return G.segs[Math.max(0, Math.min(G.segs.length - 1, Math.floor(z / SEG_LEN)))]; }

  function updateBg(dpos) {
    const seg = segAt(playerZ());
    const d = seg.curve * (dpos / SEG_LEN);
    G.off.sky += d * 0.15; G.off.far += d * 0.5; G.off.near += d * 1.0;
  }

  function moveTraffic(dt) {
    const lanes = [[], [], []];
    for (const c of G.cars) lanes[c.lane].push(c);
    for (const l of lanes) {
      l.sort((a, b) => b.z - a.z);
      let ahead = null;
      for (const c of l) {
        c.effSpeed = c.speed;
        if (ahead && ahead.z - c.z < 1000) c.effSpeed = Math.min(c.speed, ahead.effSpeed);
        ahead = c;
      }
    }
    const limit = (STAGES[G.stage - 1].N + 280) * SEG_LEN;
    for (const c of G.cars) c.z += c.effSpeed * dt;
    if (G.cars.length && G.cars.some((c) => c.z >= limit)) G.cars = G.cars.filter((c) => c.z < limit);
  }

  function crash(ox) {
    G.speed = Math.min(G.speed, CRASH_SPEED_CAP);
    G.crashes++;
    G.invulnTimer = CRASH_INVULN;
    G.playerX += (G.playerX >= ox ? 1 : -1) * CRASH_PUSH;
    G.playerX = Math.max(-2, Math.min(2, G.playerX));
    G.smoke = { age: 0, count: 0 };
    G.shake = 0.3;
    for (let i = 0; i < 8; i++) G.sparks.push({ x: 320 + (Math.random() - 0.5) * 60, y: 336, vx: (Math.random() - 0.5) * 220, vy: -60 - Math.random() * 120, age: 0 });
    audio.sfx('sfx_crash');
  }

  function addPopup(text, x, y, color) { G.popups.push({ text, x, y, age: 0, color }); }

  function stepFx(dt) {
    if (G.smoke) {
      G.smoke.age += dt;
      while (G.smoke.count < 6 && G.smoke.age >= G.smoke.count * 0.08 - 1e-9) {
        G.puffs.push({ x: 320 + (Math.random() - 0.5) * 36, y: 346, age: 0 });
        G.smoke.count++;
      }
      if (G.smoke.count >= 6) G.smoke = null;
    }
    for (const p of G.puffs) p.age += dt;
    G.puffs = G.puffs.filter((p) => p.age < 0.5);
    for (const s of G.sparks) { s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 500 * dt; }
    G.sparks = G.sparks.filter((s) => s.age < 0.3);
    for (const p of G.popups) p.age += dt;
    G.popups = G.popups.filter((p) => p.age < 0.9);
    for (const d of G.dust) { d.age += dt; d.x += d.vx * dt; d.y -= 20 * dt; }
    G.dust = G.dust.filter((d) => d.age < 0.35);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt);
    if (G.bannerT < 99) G.bannerT += dt;
    if (G.goT < 99) G.goT += dt;
    if (G.fade > 0) G.fade = Math.max(0, G.fade - dt);
  }

  function stepPlaying(dt) {
    const inp = G.input;
    G.sceneT += dt;
    const z0 = playerZ();
    for (const c of G.cars) c.prevRel = c.z - z0;
    // 1. accel
    let a;
    if (inp.up) a = ACCEL; else if (inp.down) a = -BRAKE; else a = -COAST;
    const offroad = Math.abs(G.playerX) > 1;
    if (offroad && G.speed > OFFROAD_LIMIT) a -= OFFROAD_DECEL;
    G.speed = Math.max(0, Math.min(MAX_SPEED, G.speed + a * dt));
    // 2. steer
    const sp = G.speed / MAX_SPEED;
    const steer = (inp.right ? 1 : 0) + (inp.left ? -1 : 0);
    const dxp = dt * STEER_RATE * sp;
    G.playerX += steer * dxp;
    G.playerX -= dxp * sp * segAt(z0).curve * CENTRIFUGAL;
    G.playerX = Math.max(-2, Math.min(2, G.playerX));
    // 3. advance
    const dpos = G.speed * dt;
    G.pos += dpos;
    G.score += dpos / M_UNIT;
    updateBg(dpos);
    moveTraffic(dt);
    const z1 = playerZ();
    // collisions
    if (G.invulnTimer > 0) G.invulnTimer = Math.max(0, G.invulnTimer - dt);
    else {
      let hit = false;
      for (const c of G.cars) {
        if (c.hit) continue;
        const rel = c.z - z1;
        const flip = (c.prevRel > 0 && rel <= 0) || (c.prevRel < 0 && rel >= 0);
        if ((Math.abs(rel) < HIT_Z || flip) && Math.abs(c.x - G.playerX) < HIT_HALFW + c.hw) { c.hit = true; crash(c.x); hit = true; break; }
      }
      if (!hit) {
        const s0 = Math.max(0, Math.floor((Math.min(z0, z1) - HIT_Z) / SEG_LEN)), s1 = Math.floor((Math.max(z0, z1) + HIT_Z) / SEG_LEN);
        outer: for (let s = s0; s <= s1 && s < G.segs.length; s++) {
          for (const o of G.segs[s].objs) {
            if (!o.solid || o.hit) continue;
            const r0 = o.z - z0, r1 = o.z - z1;
            const flip = (r0 > 0 && r1 <= 0) || (r0 < 0 && r1 >= 0);
            if ((Math.abs(r1) < HIT_Z || flip) && Math.abs(o.x - G.playerX) < HIT_HALFW + o.hw) { o.hit = true; crash(o.x); break outer; }
          }
        }
      }
    }
    // overtakes
    for (const c of G.cars) {
      const rel = c.z - z1;
      if (c.prevRel > 0 && rel <= 0 && !c.hit && !c.passed) {
        c.passed = true;
        G.overtakes++;
        G.score += 50;
        audio.sfx('sfx_overtake');
        addPopup('+50', 400, 290, '#ffe060');
        const gap = Math.abs(c.x - G.playerX) - (HIT_HALFW + c.hw);
        if (G.speed / 40 >= 180 && gap >= 0 && gap < 0.12) { G.score += 20; addPopup('NEAR MISS +20', 320, 250, '#60f0ff'); }
      }
    }
    // timer / checkpoints / goal
    G.timeLeft -= dt;
    const st = STAGES[G.stage - 1];
    if (G.checkpointsPassed < st.cps.length && z1 >= st.cps[G.checkpointsPassed] * SEG_LEN) {
      G.timeLeft += st.cpAdd;
      G.score += 500;
      G.checkpointsPassed++;
      G.bannerT = 0; G.bannerAdd = st.cpAdd;
      audio.sfx('sfx_checkpoint');
    }
    if (z1 >= st.N * SEG_LEN) {
      const tl = Math.max(0, Math.floor(G.timeLeft));
      const timeBonus = tl * 100, stageBonus = 1000 * G.stage;
      G.score += timeBonus + stageBonus;
      G.clearInfo = { tl, timeBonus, stageBonus };
      G.timeLeft = Math.max(0, G.timeLeft);
      G.scene = 'stageclear'; G.sceneT = 0;
      audio.sfx('sfx_goal');
    } else if (G.timeLeft <= 0) {
      G.timeLeft = 0;
      G.scene = 'timeup'; G.sceneT = 0;
      audio.sfx('sfx_timeup');
    } else {
      const ti = Math.ceil(G.timeLeft);
      if (G.timeLeft <= 10 && ti !== G.lastTimeInt) audio.sfx('sfx_timewarn');
      G.lastTimeInt = ti;
    }
    // dust when off road
    if (offroad && G.speed > 300 && G.tick % 3 === 0) {
      const side = G.playerX > 0 ? 1 : -1;
      G.dust.push({ x: 320 + side * (60 + Math.random() * 20) - 0, y: 340, vx: side * 40 * Math.random(), age: 0 });
      G.dust.push({ x: 320 - side * 55 * 0 + (Math.random() - 0.5) * 100, y: 346, vx: (Math.random() - 0.5) * 60, age: 0 });
    }
  }

  function stepCoast(dt, decel) {
    G.sceneT += dt;
    const z0 = playerZ();
    G.speed = Math.max(0, G.speed - decel * dt);
    let dpos = G.speed * dt;
    const maxZ = (G.segs.length - 2) * SEG_LEN;
    if (z0 + dpos > maxZ) dpos = Math.max(0, maxZ - z0);
    G.pos += dpos;
    updateBg(dpos);
    moveTraffic(dt);
  }

  function step() {
    G.tick++;
    drive();
    const s = G.scene;
    if (s === 'title') {
      const dpos = 7200 * STEP;
      G.speed = 7200;
      G.pos += dpos;
      updateBg(dpos);
      moveTraffic(STEP);
      G.playerX = Math.sin(G.tick / 120) * 0.25;
      G.cars.forEach((c) => { c.passed = true; });
      if (G.pos + PLAYER_Z > (STAGES[0].N - 150) * SEG_LEN) {
        const off = { ...G.off };
        loadStage(1);
        G.off = off;
        G.speed = 7200;
        G.cars.forEach((c) => { c.passed = true; });
      }
      if (G.fade > 0) G.fade = Math.max(0, G.fade - STEP);
    } else if (s === 'countdown') {
      G.sceneT += STEP;
      const prev = G.cd;
      G.cd -= STEP;
      const n = Math.ceil(G.cd - 1e-9);
      if (n !== G.cdLast && n >= 1) { G.cdLast = n; audio.sfx('sfx_beep'); }
      if (prev > 0 && G.cd <= 1e-9) {
        G.scene = 'playing'; G.goT = 0; G.sceneT = 0;
        audio.sfx('sfx_go');
      }
      stepFx(STEP);
    } else if (s === 'playing') {
      stepPlaying(STEP);
      stepFx(STEP);
    } else if (s === 'stageclear') {
      stepCoast(STEP, 3000);
      stepFx(STEP);
    } else if (s === 'timeup') {
      stepCoast(STEP, 6000);
      stepFx(STEP);
      if (G.sceneT >= 2.5) { G.reached = G.stage; G.scene = 'gameover'; finishRun(); }
    }
    // gameover / ending: frozen
  }

  // ---------------------------------------------------------------- rendering
  function poly(col, x1, y1, x2, y2, x3, y3, x4, y4) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  function project(p, cameraX, cameraY, cameraZ) {
    const camX = -cameraX, camY = p.y - cameraY;
    p.camZ = p.z - cameraZ;
    p.scale = CAM_DEPTH / (p.camZ || 1e-6);
    p.screenX = Math.round(W / 2 + p.scale * camX * W / 2);
    p.screenY = Math.round(H / 2 - p.scale * camY * H / 2);
    p.screenW = Math.round(p.scale * ROAD_HALF * W / 2);
  }

  function drawLayer(img, offset, y) {
    const x0 = -(((Math.floor(offset) % 640) + 640) % 640);
    ctx.drawImage(img, x0, y);
    ctx.drawImage(img, x0 + 640, y);
  }

  function drawBackground() {
    const n = G.stage;
    ctx.fillStyle = PAL[n - 1].ground;
    ctx.fillRect(0, 180, W, 180);
    drawLayer(A['bg_sky_' + n].canvas, G.off.sky, 0);
    drawLayer(A['bg_far_' + n].canvas, G.off.far, 180 - 96);
    drawLayer(A['bg_near_' + n].canvas, G.off.near, 180 - 56);
  }

  function drawSprite(img, fw, fh, z, offset, worldW, seg, n, frame = 0) {
    if (seg.p1.camZ <= CAM_DEPTH) return;
    const pct = (z % SEG_LEN) / SEG_LEN;
    const sScale = seg.p1.scale + (seg.p2.scale - seg.p1.scale) * pct;
    const roadW = sScale * ROAD_HALF * W / 2;
    const sX = seg.p1.screenX + (seg.p2.screenX - seg.p1.screenX) * pct + sScale * offset * ROAD_HALF * W / 2;
    const sY = seg.p1.screenY + (seg.p2.screenY - seg.p1.screenY) * pct;
    const destW = worldW * roadW;
    if (destW < 1) return;
    const destH = destW * (fh / fw);
    let dx = sX - destW / 2, dy = sY - destH, dw = destW, dh = destH;
    let sx = frame * fw, sy = 0, sw = fw, sh = fh;
    if (dy + dh > seg.clipY) {
      const cut = dy + dh - seg.clipY;
      if (cut >= dh) return;
      sh = fh * (dh - cut) / dh; dh -= cut;
    }
    if (dx + dw < 0 || dx > W || dy + dh < 0) return;
    if (dx < 0) { const c = -dx; const k = fw * c / dw; sx += k; sw -= k; dw -= c; dx = 0; }
    if (dx + dw > W) { const c = dx + dw - W; sw -= fw * c / (dw + c); dw -= c; }
    if (dy < 0) { const c = -dy; const k = sh * c / dh; sy += k; sh -= k; dh -= c; dy = 0; }
    if (dw <= 0 || dh <= 0 || sw <= 0 || sh <= 0) return;
    const fa = n > 90 ? 1 - Math.pow((n - 90) / 110, 1.5) * 0.75 : 1;
    if (fa < 1) ctx.globalAlpha = fa;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    if (fa < 1) ctx.globalAlpha = 1;
  }

  function carKey(c) { return c.variant === 0 ? 'car_' + c.type : `car_${c.type}_v${c.variant}`; }

  function drawWorld() {
    drawBackground();
    const segs = G.segs;
    const pos = G.pos, pz = playerZ();
    const pal = G.pal;
    const baseSeg = segs[Math.floor(pos / SEG_LEN)];
    const basePercent = (pos % SEG_LEN) / SEG_LEN;
    const playerSeg = segs[Math.floor(pz / SEG_LEN)];
    const playerPercent = (pz % SEG_LEN) / SEG_LEN;
    const playerY = playerSeg.p1.y + (playerSeg.p2.y - playerSeg.p1.y) * playerPercent;
    const cameraY = CAM_HEIGHT + playerY;
    let maxY = H, x = 0, dx = -baseSeg.curve * basePercent;
    for (let n = 0; n < DRAW_DIST; n++) {
      const seg = segs[baseSeg.index + n];
      if (!seg) break;
      seg.clipY = maxY;
      const camXBase = G.playerX * ROAD_HALF;
      project(seg.p1, camXBase - x, cameraY, pos);
      project(seg.p2, camXBase - x - dx, cameraY, pos);
      x += dx; dx += seg.curve;
      const p1 = seg.p1, p2 = seg.p2;
      if (p1.camZ <= CAM_DEPTH || p2.screenY >= p1.screenY || p2.screenY >= maxY) continue;
      const b = seg.band;
      const y1 = p1.screenY, y2 = p2.screenY;
      ctx.fillStyle = b ? pal.g1[n] : pal.g0[n];
      ctx.fillRect(0, y2, W, y1 - y2);
      const r1 = Math.round(p1.screenW / 6), r2 = Math.round(p2.screenW / 6);
      const rc = b ? pal.r1[n] : pal.r0[n];
      poly(rc, p1.screenX - p1.screenW - r1, y1, p1.screenX - p1.screenW + 2, y1, p2.screenX - p2.screenW + 2, y2, p2.screenX - p2.screenW - r2, y2);
      poly(rc, p1.screenX + p1.screenW - 2, y1, p1.screenX + p1.screenW + r1, y1, p2.screenX + p2.screenW + r2, y2, p2.screenX + p2.screenW - 2, y2);
      poly(b ? pal.d1[n] : pal.d0[n], p1.screenX - p1.screenW, y1, p1.screenX + p1.screenW, y1, p2.screenX + p2.screenW, y2, p2.screenX - p2.screenW, y2);
      if (!b) {
        const l1 = Math.max(1, Math.round(p1.screenW / 48)), l2 = Math.max(1, Math.round(p2.screenW / 48));
        const c1 = Math.round(p1.screenW / 3), c2 = Math.round(p2.screenW / 3);
        ctx.fillStyle = pal.l[n];
        for (const s of [-1, 1]) {
          const a1 = p1.screenX + s * c1, a2 = p2.screenX + s * c2;
          poly(pal.l[n], a1 - l1, y1, a1 + l1, y1, a2 + l2, y2, a2 - l2, y2);
        }
      }
      maxY = y1;
    }
    // sprites far -> near
    const buckets = new Map();
    for (const c of G.cars) {
      const si = Math.floor(c.z / SEG_LEN);
      if (si < baseSeg.index || si >= baseSeg.index + DRAW_DIST) continue;
      let l = buckets.get(si);
      if (!l) buckets.set(si, (l = []));
      l.push(c);
    }
    for (let n = DRAW_DIST - 1; n >= 0; n--) {
      const seg = segs[baseSeg.index + n];
      if (!seg) continue;
      for (const o of seg.objs) {
        const a = A[o.kind];
        drawSprite(a.canvas, a.fw, a.fh, o.z, o.x, o.worldW, seg, n);
      }
      const l = buckets.get(seg.index);
      if (l) for (const c of l) { const a = A[carKey(c)]; drawSprite(a.canvas, a.fw, a.fh, c.z, c.x, c.worldW, seg, n); }
    }
  }

  function drawPlayerCar() {
    const s = G.scene;
    if (s === 'title' && false) return;
    if (G.invulnTimer > 0 && Math.floor(G.invulnTimer / 0.05) % 2 === 1) return;
    const driving = s === 'playing';
    const braking = driving && G.input.down && !G.input.up;
    const a = A[braking ? 'car_player_brake' : 'car_player'];
    let frame = 0;
    if (driving) { if (G.input.left && !G.input.right) frame = 1; else if (G.input.right && !G.input.left) frame = 2; }
    const offroad = Math.abs(G.playerX) > 1;
    const bounce = G.speed > 0 ? Math.random() * (offroad ? 3 : 1) : 0;
    ctx.drawImage(a.canvas, frame * 40, 0, 40, 22, 240, Math.round(354 - 88 - bounce), 160, 88);
  }

  function drawFx() {
    for (const d of G.dust) { const f = Math.min(2, Math.floor(d.age / 0.12)); ctx.drawImage(A.fx_dust.canvas, f * 8, 0, 8, 8, Math.round(d.x), Math.round(d.y), 16, 16); }
    for (const p of G.puffs) { const f = Math.min(3, Math.floor(p.age / 0.125)); ctx.drawImage(A.fx_smoke.canvas, f * 12, 0, 12, 12, Math.round(p.x - 12), Math.round(p.y - 30 * p.age - 24), 24, 24); }
    for (const s of G.sparks) { const f = Math.min(2, Math.floor(s.age / 0.1)); ctx.drawImage(A.fx_spark.canvas, f * 6, 0, 6, 6, Math.round(s.x), Math.round(s.y), 12, 12); }
    for (const p of G.popups) drawText(ctx, p.text, p.x, p.y - p.age * 40, 2, p.color, 'center');
  }

  function speedLines() {
    const kmh = G.speed / 40;
    if (kmh < 250) return;
    const k = (kmh - 250) / 50;
    ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.2 * k})`;
    for (let i = 0; i < 14; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r0 = 120 + Math.random() * 60, r1 = r0 + 40 + Math.random() * 60;
      const cx = 320, cy = 190;
      const x0 = cx + Math.cos(ang) * r0 * 1.6, y0 = cy + Math.sin(ang) * r0 * 0.7, x1 = cx + Math.cos(ang) * r1 * 1.6, y1 = cy + Math.sin(ang) * r1 * 0.7;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x1 + 1, y1 + 1); ctx.closePath(); ctx.fill();
    }
  }

  const pad = (n, w) => String(Math.max(0, Math.floor(n))).padStart(w, '0');
  function dimmer(a) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H); }
  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(8,6,24,0.82)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ffb040'; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h);
    ctx.fillStyle = '#ff4a8a'; ctx.fillRect(x + 4, y + 4, w - 8, 1); ctx.fillRect(x + 4, y + h - 5, w - 8, 1);
  }

  function drawHud() {
    const st = STAGES[G.stage - 1];
    const blink = Math.floor(G.tick / 30) % 2 === 0;
    drawText(ctx, 'TIME', 8, 6, 2, '#ffd060', 'left');
    const low = G.timeLeft <= 10;
    drawText(ctx, pad(Math.ceil(G.timeLeft), 2), 8, 22, 4, low ? (blink ? '#ff3030' : '#ffffff') : '#ffffff', 'left');
    drawText(ctx, 'SCORE', 320, 6, 2, '#ffd060', 'center');
    drawText(ctx, pad(G.score, 6), 320, 22, 3, '#ffffff', 'center');
    drawText(ctx, `STAGE ${G.stage}/3`, 632, 6, 2, '#ffffff', 'right');
    drawText(ctx, `BEST ${pad(Math.max(G.best, Math.floor(G.score)), 6)}`, 632, 24, 2, '#ffd060', 'right');
    // progress bar
    const gz = st.N * SEG_LEN;
    const frac = Math.max(0, Math.min(1, playerZ() / gz));
    ctx.fillStyle = '#000'; ctx.fillRect(119, 53, 402, 10);
    ctx.fillStyle = '#2a2450'; ctx.fillRect(120, 54, 400, 8);
    ctx.fillStyle = '#ff9a3a'; ctx.fillRect(120, 54, Math.round(400 * frac), 8);
    ctx.fillStyle = '#ffe0a0'; ctx.fillRect(120, 54, Math.round(400 * frac), 2);
    ctx.fillStyle = '#ffffff';
    for (const cp of st.cps) ctx.fillRect(120 + Math.round((400 * cp * SEG_LEN) / gz), 52, 2, 12);
    drawText(ctx, 'F', 526, 52, 2, '#ffffff', 'left');
    const mx = 120 + Math.round(400 * frac);
    ctx.fillStyle = '#000'; for (let i = 0; i < 5; i++) ctx.fillRect(mx - 4 + i, 43 + i, 9 - i * 2, 1);
    ctx.fillStyle = '#ff4a8a'; for (let i = 0; i < 4; i++) ctx.fillRect(mx - 3 + i, 44 + i, 7 - i * 2, 1);
    drawText(ctx, `PASSED ${G.overtakes}`, 8, 330, 2, '#ffffff', 'left');
    drawText(ctx, `[M] SOUND ${G.muted ? 'OFF' : 'ON'}`, 8, 346, 1, '#ffffff', 'left');
    drawText(ctx, String(Math.floor(G.speed / 40)), 600, 316, 4, '#ffffff', 'right');
    drawText(ctx, 'KM/H', 632, 346, 2, '#ffd060', 'right');
    if (G.bannerT < 2) {
      drawText(ctx, 'CHECKPOINT!', 320, 96, 3, '#ffe060', 'center');
      drawText(ctx, `+${G.bannerAdd} SEC`, 320, 126, 2, '#ffffff', 'center');
    }
  }

  function drawStageName() {
    const st = STAGES[G.stage - 1];
    drawText(ctx, `STAGE ${G.stage}`, 320, 62, 3, '#ffffff', 'center');
    drawText(ctx, st.name, 320, 90, 2, '#ffd060', 'center');
  }

  function drawScene() {
    const s = G.scene;
    let shx = 0, shy = 0;
    if (G.shake > 0) { shx = Math.round((Math.random() - 0.5) * 6); shy = Math.round((Math.random() - 0.5) * 4); }
    ctx.save();
    ctx.translate(shx, shy);
    drawWorld();
    if (G.stage === 3 && ['playing', 'countdown', 'stageclear', 'timeup'].includes(s)) {
      const g = ctx.createLinearGradient(0, 340, 0, 190);
      g.addColorStop(0, 'rgba(255,250,200,0.20)'); g.addColorStop(1, 'rgba(255,250,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(268, 340); ctx.lineTo(372, 340); ctx.lineTo(400, 190); ctx.lineTo(240, 190); ctx.closePath(); ctx.fill();
    }
    if (s === 'playing') speedLines();
    drawPlayerCar();
    drawFx();
    ctx.restore();

    if (s === 'title') drawTitle();
    else if (s === 'countdown') {
      drawHud();
      drawStageName();
      const n = Math.max(1, Math.ceil(G.cd - 1e-9));
      // signal lights
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#000'; ctx.fillRect(290 + i * 24, 118, 20, 8); ctx.fillStyle = i >= n ? '#ff3a2a' : '#301010'; ctx.fillRect(292 + i * 24, 120, 16, 4); }
      drawText(ctx, String(n), 320, 150, 6, '#ffffff', 'center', '#000', null);
    } else if (s === 'playing') {
      drawHud();
      if (G.goT < 1.0) drawStageName();
      if (G.goT < 0.8) drawText(ctx, 'GO!', 320, 140, 6 + (G.goT < 0.2 ? 2 : 0), '#7dff9a', 'center');
    } else if (s === 'paused') {
      drawHud();
      dimmer(0.6);
      drawText(ctx, 'PAUSED', 320, 140, 4, '#ffffff', 'center');
      drawText(ctx, 'P/ESC: RESUME   R: RESTART   Q: TITLE', 320, 190, 2, '#ffd060', 'center');
    } else if (s === 'stageclear') {
      drawHud();
      if (G.sceneT < 1.5) drawText(ctx, 'GOAL!', 320, 130, 8, '#ffe060', 'center');
      else drawResultPanel();
    } else if (s === 'timeup') {
      drawHud();
      drawText(ctx, 'TIME UP', 320, 140, 8, '#ff5050', 'center');
    } else if (s === 'gameover') {
      dimmer(0.75);
      drawText(ctx, 'GAME OVER', 320, 50, 6, '#ff5050', 'center');
      drawText(ctx, `REACHED STAGE ${G.reached}`, 320, 120, 2, '#ffffff', 'center');
      drawText(ctx, `SCORE ${pad(G.score, 6)}`, 320, 160, 3, '#ffffff', 'center');
      drawText(ctx, `BEST ${pad(G.best, 6)}`, 320, 200, 2, '#ffd060', 'center');
      if (G.newBest) drawText(ctx, 'NEW BEST!', 320, 232, 3, Math.floor(G.tick / 15) % 2 ? '#ffe060' : '#ff8a3a', 'center');
      drawText(ctx, 'ENTER: RETRY   ESC: TITLE', 320, 300, 2, '#ffffff', 'center');
    } else if (s === 'ending') {
      dimmer(0.75);
      drawText(ctx, 'ALL CLEAR!', 320, 24, 6, '#ffe060', 'center');
      drawText(ctx, `SCORE ${pad(G.score, 6)}`, 320, 84, 3, '#ffffff', 'center');
      drawText(ctx, 'RANK', 320, 126, 2, '#ffd060', 'center');
      const rc = { S: '#ffe060', A: '#ff8a3a', B: '#60e8ff', C: '#c0c0d0' }[G.rank];
      drawText(ctx, G.rank, 320, 148, 8, rc, 'center');
      drawText(ctx, `BEST ${pad(G.best, 6)}`, 320, 224, 2, '#ffd060', 'center');
      if (G.newBest) drawText(ctx, 'NEW BEST!', 320, 252, 3, Math.floor(G.tick / 15) % 2 ? '#ffe060' : '#ff8a3a', 'center');
      if (Math.floor(G.tick / 30) % 2 === 0) drawText(ctx, 'PRESS ENTER', 320, 306, 3, '#ffffff', 'center');
    }
    if (G.fade > 0) dimmer(Math.min(1, G.fade / 0.6));
    if (debugOn) drawText(ctx, `${fps} FPS`, 632, 350, 1, '#00ff00', 'right');
  }

  function drawResultPanel() {
    const px = 130, py = 80, pw = 380, ph = 210;
    panel(px, py, pw, ph);
    const ci = G.clearInfo || { tl: 0, timeBonus: 0, stageBonus: 0 };
    drawText(ctx, `STAGE ${G.stage} CLEAR!`, 320, py + 18, 3, '#ffe060', 'center');
    const row = (label, val, y) => drawText(ctx, label.padEnd(22) + '= ' + val, px + 16, y, 2, '#ffffff', 'left');
    drawText(ctx, `TIME LEFT   ${pad(ci.tl, 2)}  X100  = ${ci.timeBonus}`, px + 16, py + 62, 2, '#ffffff', 'left');
    row('STAGE BONUS', String(ci.stageBonus), py + 88);
    row('SCORE', pad(G.score, 6), py + 114);
    if (Math.floor(G.tick / 30) % 2 === 0) drawText(ctx, 'PRESS ENTER', 320, py + 164, 3, '#7dff9a', 'center');
  }

  function drawTitle() {
    const logo = A.logo_title;
    const bob = Math.round(Math.sin(G.tick / 25) * 3);
    ctx.drawImage(logo.canvas, 0, 0, logo.fw, logo.fh, 320 - logo.fw, 14 + bob, logo.fw * 2, logo.fh * 2);
    drawText(ctx, 'CHASE THE SUN. BEAT THE CLOCK.', 320, 178, 2, '#ffffff', 'center');
    if (Math.floor(G.tick / 30) % 2 === 0) drawText(ctx, 'PRESS ENTER', 320, 214, 3, '#ffe060', 'center');
    drawText(ctx, `BEST ${pad(G.best, 6)}`, 320, 250, 2, '#ffd060', 'center');
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 296, W, 50);
    drawText(ctx, 'UP/W GAS   DOWN/S BRAKE   LEFT-RIGHT/AD STEER', 320, 303, 1, '#ffffff', 'center');
    drawText(ctx, 'P PAUSE   R RESTART   M SOUND', 320, 319, 1, '#ffffff', 'center');
    drawText(ctx, `[M] SOUND ${G.muted ? 'OFF' : 'ON'}`, 8, 346, 1, '#ffffff', 'left');
  }

  // ---------------------------------------------------------------- audio sync
  function syncAudio() {
    const s = G.scene;
    const run = s === 'countdown' || s === 'playing' || s === 'stageclear' || s === 'timeup';
    audio.setEngine(run, G.speed / MAX_SPEED);
    const bgmOn = s === 'countdown' || s === 'playing' || s === 'paused';
    audio.setBgm(bgmOn ? 'bgm_' + G.stage : null);
    audio.setPaused(s === 'paused');
    audio.setOffroad(s === 'playing' && Math.abs(G.playerX) > 1 && G.speed > 300);
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now(), acc = 0, fps = 0, fpsN = 0, fpsT = 0;
  function frame(now) {
    let dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    fpsN++; fpsT += dt;
    if (fpsT >= 0.5) { fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6) {
      if (G.scene !== 'paused') step();
      acc -= STEP;
      steps++;
    }
    if (steps >= 6) acc = 0;
    syncAudio();
    drawScene();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- hooks
  const rankNow = () => (G.scene === 'ending' ? G.rank : null);
  window.__game = {
    getState() {
      const ps = playerZ();
      return {
        scene: G.scene, seed: SEED, stage: G.stage, score: Math.floor(G.score), best: G.best, timeLeft: G.timeLeft,
        speedKmh: G.speed / 40, playerX: G.playerX, distanceM: G.pos / M_UNIT,
        goalRemainingM: Math.max(0, (goalZ() - ps) / M_UNIT), checkpointsPassed: G.checkpointsPassed,
        overtakes: G.overtakes, crashes: G.crashes, invulnerable: G.invulnTimer > 0, trafficTotal: G.trafficTotal,
        layoutHash: G.layoutHash, muted: G.muted, rank: rankNow(),
        audio: { state: audio.state, bgm: audio.bgm, engineHz: G.scene === 'paused' ? 0 : ['countdown', 'playing', 'stageclear', 'timeup'].includes(G.scene) ? 60 + 140 * (G.speed / MAX_SPEED) : 0 },
      };
    },
  };
  if (debugOn) {
    window.__game.debug = {
      warp(m) {
        if (G.scene !== 'countdown' && G.scene !== 'playing') return;
        G.pos = Math.max(0, Math.min(goalZ() - 3000, m * M_UNIT));
        const pz = playerZ();
        for (const c of G.cars) if (c.z < pz) c.passed = true;
        const st = STAGES[G.stage - 1];
        let n = 0;
        while (n < st.cps.length && st.cps[n] * SEG_LEN <= pz) n++;
        G.checkpointsPassed = Math.max(G.checkpointsPassed, n);
      },
      setTime(s) { G.timeLeft = s; },
      setPlayerX(x) { G.playerX = Math.max(-2, Math.min(2, x)); },
      setSpeedKmh(v) { G.speed = Math.max(0, Math.min(300, v)) * 40; },
    };
  }

  if (G.muted) audio.muted = true;
  toTitle();
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
}
