// Game simulation: scenes, physics, traffic, scoring. No DOM access (unit-testable in Node).
// Everything advances in fixed steps of STEP = 1/60 s (durations are step counts).

import {
  STAGES, STEP, SEG_LEN, PLAYER_Z, MAX_SPEED, KMH, UNITS_PER_M,
  ACCEL, BRAKE, COAST, OFFROAD_DECEL, OFFROAD_LIMIT, STEER_RATE, CENTRIFUGAL, PLAYER_X_CLAMP,
  CRASH_SPEED_CAP, CRASH_INVULN_STEPS, CRASH_PUSH, PLAYER_HIT_HALFW, HIT_Z_WINDOW,
  COUNTDOWN_STEPS, GO_STEPS, TIMEUP_STEPS, CLEAR_PANEL_STEPS, BANNER_STEPS, CLEAR_DECEL, TIMEUP_DECEL,
  TITLE_SPEED, K_SKY, K_FAR, K_NEAR, SCORE_PER_OVERTAKE, SCORE_CHECKPOINT, SCORE_NEAR_MISS,
  RANK_S, RANK_A, RANK_B, LANE_X, clamp,
} from './config.js';
import { Course } from './course.js';
import { generateWorld } from './world.js';

const TITLE_WRAP_EXTRA = 40; // segments past N at which the title demo loops

export class Sim {
  constructor(opts = {}) {
    this.seed = opts.seed >>> 0;
    this.startStage = clamp(Math.floor(opts.startStage) || 1, 1, 3);
    this.best = opts.best > 0 ? Math.floor(opts.best) : 0;
    this.muted = !!opts.muted;
    this.onSave = opts.onSave || null;
    this.events = [];
    this.input = { up: false, down: false, left: false, right: false };

    this.t = 0; // global step counter (advances outside pause)
    this.sceneStartT = 0;
    this.scene = 'title';
    this.sceneT = 0;
    this._changed = false;

    this.scoreF = 0;
    this.overtakes = 0;
    this.crashes = 0;
    this.newBest = false;
    this.rank = null;
    this.clear = null;

    this.steerDir = 0;
    this.braking = false;
    this.offroad = false;
    this.autoTargetX = 0;

    this.loadStage(1);
    this.setScene('title');
    this.speed = TITLE_SPEED;
  }

  // ------------------------------------------------------------------ setup

  get scoreInt() {
    return Math.floor(this.scoreF + 1e-6);
  }

  loadStage(n) {
    this.stage = n;
    this.def = STAGES[n - 1];
    this.course = new Course(n);
    const w = generateWorld(n, this.seed, this.course);
    this.traffic = w.traffic;
    this.lanes = w.lanes;
    this.roadside = w.roadside;
    this.gates = w.gates;
    this.layoutHash = w.layoutHash;
    this.trafficTotal = w.traffic.length;

    this.pos = 0;
    this.speed = 0;
    this.playerX = 0;
    this.timeLeft = this.def.timeStart;
    this.checkpointsPassed = 0;
    this.invuln = 0;
    this.banner = null;
    this.goSteps = 0;
    this.playSteps = 0;
    this.lastWarn = 99;
    this.bg = { sky: 0, far: 0, near: 0 };
    this.fx = { smoke: [], sparks: [], dust: [], popups: [] };
    this.shake = 0;
    this.flash = { steps: 0, max: 1, kind: 'crash' };
    this.crashAge = 999;
    this.smokeSpawned = 6;
    this.dustAcc = 0;
    this.steerDir = 0;
    this.braking = false;
    this.offroad = false;
  }

  setScene(scene) {
    const prev = this.scene;
    this.scene = scene;
    this.sceneT = 0;
    this.sceneStartT = this.t;
    this._changed = true;
    this.events.push({ type: 'scene', scene, prev });
    if (scene === 'countdown') this.events.push({ type: 'beep', n: 3 });
  }

  startRun() {
    this.scoreF = 0;
    this.overtakes = 0;
    this.crashes = 0;
    this.newBest = false;
    this.rank = null;
    this.clear = null;
    this.loadStage(this.startStage);
    this.setScene('countdown');
  }

  toTitle() {
    this.loadStage(1);
    this.speed = TITLE_SPEED;
    this.autoTargetX = 0;
    this.setScene('title');
  }

  // ---------------------------------------------------------------- actions

  confirm() {
    switch (this.scene) {
      case 'title':
        this.events.push({ type: 'menu' });
        this.startRun();
        return true;
      case 'stageclear':
        if (this.sceneT < CLEAR_PANEL_STEPS) return false;
        this.events.push({ type: 'menu' });
        if (this.stage < 3) {
          this.loadStage(this.stage + 1);
          this.setScene('countdown');
        } else {
          this.finishRun();
        }
        return true;
      case 'gameover':
        this.events.push({ type: 'menu' });
        this.startRun();
        return true;
      case 'ending':
        this.events.push({ type: 'menu' });
        this.toTitle();
        return true;
      default:
        return false;
    }
  }

  togglePause() {
    if (this.scene === 'playing') {
      this.setScene('paused');
      return true;
    }
    if (this.scene === 'paused') {
      this.setScene('playing');
      return true;
    }
    return false;
  }

  escape() {
    if (this.scene === 'playing' || this.scene === 'paused') return this.togglePause();
    if (this.scene === 'gameover' || this.scene === 'ending') {
      this.toTitle();
      return true;
    }
    return false;
  }

  quit() {
    if (this.scene === 'paused' || this.scene === 'gameover') {
      this.toTitle();
      return true;
    }
    return false;
  }

  restart() {
    const s = this.scene;
    if (s === 'countdown' || s === 'playing' || s === 'paused' || s === 'gameover' || s === 'ending') {
      this.startRun();
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------- main step

  step() {
    if (this.scene === 'paused') return;
    this._changed = false;
    this.t++;
    if (this.invuln > 0 && this.scene !== 'playing') this.invuln--;

    switch (this.scene) {
      case 'title': this.stepTitle(); break;
      case 'countdown': this.stepCountdown(); break;
      case 'playing': this.stepPlaying(); break;
      case 'stageclear': this.stepClear(); break;
      case 'timeup': this.stepTimeup(); break;
      default: break; // gameover / ending: nothing but fx timers
    }
    this.updateFx();
    if (!this._changed) this.sceneT++;
  }

  // ------------------------------------------------------------- scenes

  stepTitle() {
    const dpos = TITLE_SPEED * STEP;
    this.speed = TITLE_SPEED;
    this.autopilot();
    this.pos += dpos;
    this.moveTraffic();
    const pz = this.pos + PLAYER_Z;
    this.updateBackground(this.course.segmentAt(pz).curve, dpos);
    const wrapAt = (this.def.N + TITLE_WRAP_EXTRA) * SEG_LEN;
    if (this.pos > wrapAt) {
      this.pos -= wrapAt;
      for (const c of this.traffic) {
        c.z = c.z0;
        c.gone = false;
        c.hit = false;
        c.passed = false;
      }
      for (const lane of this.lanes) lane.sort((a, b) => b.z - a.z);
    }
  }

  autopilot() {
    // Attract mode: pick the emptiest lane and glide toward it.
    const pz = this.pos + PLAYER_Z;
    let cur = 1;
    let bestD = 9;
    for (let l = 0; l < 3; l++) {
      const d = Math.abs(LANE_X[l] - this.autoTargetX);
      if (d < bestD) { bestD = d; cur = l; }
    }
    const free = [0, 0, 0];
    for (let l = 0; l < 3; l++) {
      let f = 24000;
      for (const c of this.lanes[l]) {
        if (c.gone) continue;
        const rel = c.z - pz;
        if (rel > -2500 && rel < f) f = rel;
      }
      free[l] = f;
    }
    let target = cur;
    if (free[cur] < 9000) {
      let bestF = free[cur];
      for (let l = 0; l < 3; l++) {
        if (Math.abs(l - cur) > 1) continue;
        if (free[l] > bestF + 3000) { bestF = free[l]; target = l; }
      }
    }
    this.autoTargetX = LANE_X[target];
    const diff = this.autoTargetX - this.playerX;
    this.playerX += clamp(diff, -0.012, 0.012);
    this.steerDir = Math.abs(diff) > 0.04 ? Math.sign(diff) : 0;
    this.braking = false;
    this.offroad = false;
  }

  stepCountdown() {
    this.steerDir = 0;
    this.braking = false;
    this.offroad = false;
    const n = this.sceneT + 1; // 1-based index of this step within the countdown
    if (n % 60 === 0 && n < COUNTDOWN_STEPS) {
      this.events.push({ type: 'beep', n: 3 - n / 60 });
    }
    if (n >= COUNTDOWN_STEPS) {
      this.goSteps = GO_STEPS;
      this.setScene('playing');
      this.events.push({ type: 'go' });
    }
  }

  stepPlaying() {
    const dt = STEP;
    const inp = this.input;
    if (this.invuln > 0) this.invuln--;
    if (this.goSteps > 0) this.goSteps--;
    this.playSteps++;
    if (this.banner) {
      this.banner.steps--;
      if (this.banner.steps <= 0) this.banner = null;
    }

    const pz0 = this.pos + PLAYER_Z;
    const seg = this.course.segmentAt(pz0);

    // 1. acceleration / braking
    let a;
    if (inp.up) a = ACCEL;
    else if (inp.down) a = -BRAKE;
    else a = -COAST;
    const off = Math.abs(this.playerX) > 1;
    if (off && this.speed > OFFROAD_LIMIT) a -= OFFROAD_DECEL;
    this.speed = clamp(this.speed + a * dt, 0, MAX_SPEED);

    // 2. steering and centrifugal force
    const steer = (inp.right ? 1 : 0) + (inp.left ? -1 : 0);
    const sp = this.speed / MAX_SPEED;
    const dxp = dt * STEER_RATE * sp;
    this.playerX += steer * dxp;
    this.playerX -= dxp * sp * seg.curve * CENTRIFUGAL;
    this.playerX = clamp(this.playerX, -PLAYER_X_CLAMP, PLAYER_X_CLAMP);

    // 3. advance
    const dpos = this.speed * dt;
    this.pos += dpos;
    this.scoreF += dpos / UNITS_PER_M;
    this.updateBackground(seg.curve, dpos);

    this.steerDir = steer;
    this.braking = inp.down && !inp.up;
    this.offroad = Math.abs(this.playerX) > 1;

    const pz = this.pos + PLAYER_Z;

    // traffic + collisions
    this.moveTraffic();
    this.collideTraffic(pz);
    this.collideRoadside(pz);

    // offroad dust
    if (this.offroad && this.speed > 600) {
      this.dustAcc += 1;
      if (this.dustAcc >= 2) {
        this.dustAcc = 0;
        this.spawnDust();
      }
    }

    // 4. timer, checkpoints, goal, time up (goal has priority over time up)
    this.timeLeft -= dt;
    const st = this.def;
    if (this.checkpointsPassed < st.cp.length && pz >= this.course.cpZ[this.checkpointsPassed]) {
      this.checkpointsPassed++;
      this.timeLeft += st.cpBonus;
      this.scoreF += SCORE_CHECKPOINT;
      this.banner = { steps: BANNER_STEPS, sec: st.cpBonus, total: BANNER_STEPS };
      this.flash = { steps: 12, max: 12, kind: 'cp' };
      this.events.push({ type: 'checkpoint' });
    }
    if (pz >= this.course.goalZ) {
      this.finishStage();
      return;
    }
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.events.push({ type: 'timeup' });
      this.setScene('timeup');
      return;
    }
    const c = Math.ceil(this.timeLeft);
    if (c <= 10 && c >= 1 && c !== this.lastWarn) {
      this.lastWarn = c;
      this.events.push({ type: 'timewarn' });
    } else if (c > 10) {
      this.lastWarn = 99;
    }
  }

  stepClear() {
    this.decelerate(CLEAR_DECEL);
    this.moveTraffic();
  }

  stepTimeup() {
    this.decelerate(TIMEUP_DECEL);
    this.moveTraffic();
    if (this.sceneT + 1 >= TIMEUP_STEPS) this.enterGameOver();
  }

  decelerate(rate) {
    const seg = this.course.segmentAt(this.pos + PLAYER_Z);
    this.speed = Math.max(0, this.speed - rate * STEP);
    const dpos = this.speed * STEP;
    this.pos += dpos;
    this.updateBackground(seg.curve, dpos);
    this.steerDir = 0;
    this.braking = true;
    this.offroad = false;
  }

  finishStage() {
    const tl = Math.max(0, Math.floor(this.timeLeft));
    const timeBonus = 100 * tl;
    const stageBonus = 1000 * this.stage;
    const before = this.scoreInt;
    this.scoreF += timeBonus + stageBonus;
    this.clear = { stage: this.stage, timeLeft: tl, timeBonus, stageBonus, scoreBefore: before, score: this.scoreInt };
    this.events.push({ type: 'goal' });
    this.setScene('stageclear');
  }

  enterGameOver() {
    this.updateBest();
    this.setScene('gameover');
  }

  finishRun() {
    const s = this.scoreInt;
    this.rank = s >= RANK_S ? 'S' : s >= RANK_A ? 'A' : s >= RANK_B ? 'B' : 'C';
    this.updateBest();
    this.setScene('ending');
  }

  updateBest() {
    const s = this.scoreInt;
    this.newBest = false;
    if (s > this.best) {
      this.best = s;
      this.newBest = true;
      if (this.onSave) this.onSave({ best: this.best });
    }
  }

  // --------------------------------------------------------------- traffic

  moveTraffic() {
    const endZ = (this.def.N + 280) * SEG_LEN;
    for (const lane of this.lanes) {
      let front = null;
      for (let i = 0; i < lane.length; i++) {
        const c = lane[i];
        if (c.gone) continue;
        let eff = c.speed;
        if (front && front.z - c.z <= 1000 && front.eff < eff) eff = front.eff;
        c.eff = eff;
        front = c;
      }
    }
    for (const c of this.traffic) {
      if (c.gone) continue;
      c.z += c.eff * STEP;
      if (c.z >= endZ) c.gone = true;
    }
  }

  collideTraffic(pz) {
    const canCrash = this.invuln === 0;
    let crashed = false;
    for (const c of this.traffic) {
      if (c.gone) continue;
      const rel = c.z - pz;
      const prev = c.prevRel;
      const flipped = (prev > 0 && rel <= 0) || (prev < 0 && rel >= 0);
      if (canCrash && !crashed && !c.hit && (Math.abs(rel) < HIT_Z_WINDOW || flipped)
        && Math.abs(c.x - this.playerX) < PLAYER_HIT_HALFW + c.hitHalf) {
        this.crash(c);
        crashed = true;
      }
      if (prev > 0 && rel <= 0 && !c.hit && !c.passed) {
        c.passed = true;
        this.overtakes++;
        this.scoreF += SCORE_PER_OVERTAKE;
        this.events.push({ type: 'overtake' });
        this.addPopup('+50', 'overtake');
        const gap = Math.abs(c.x - this.playerX) - (PLAYER_HIT_HALFW + c.hitHalf);
        if (this.speed / KMH >= 180 && gap >= 0 && gap < 0.12) {
          this.scoreF += SCORE_NEAR_MISS;
          this.events.push({ type: 'nearmiss' });
          this.addPopup('NEAR MISS +20', 'nearmiss');
        }
      }
      c.prevRel = rel;
    }
  }

  collideRoadside(pz) {
    if (this.invuln > 0) return;
    const segs = this.course.segments;
    const i0 = Math.max(0, Math.floor((pz - HIT_Z_WINDOW) / SEG_LEN));
    const i1 = Math.min(segs.length - 1, Math.floor((pz + HIT_Z_WINDOW) / SEG_LEN));
    for (let i = i0; i <= i1; i++) {
      const list = segs[i].solids;
      for (let k = 0; k < list.length; k++) {
        const o = list[k];
        if (o.hit) continue;
        if (Math.abs(o.z - pz) < HIT_Z_WINDOW && Math.abs(o.x - this.playerX) < PLAYER_HIT_HALFW + o.hitHalf) {
          this.crash(o);
          return;
        }
      }
    }
  }

  crash(other) {
    this.speed = Math.min(this.speed, CRASH_SPEED_CAP);
    this.crashes++;
    this.invuln = CRASH_INVULN_STEPS;
    this.playerX += (this.playerX >= other.x ? 1 : -1) * CRASH_PUSH;
    this.playerX = clamp(this.playerX, -PLAYER_X_CLAMP, PLAYER_X_CLAMP);
    other.hit = true;
    this.crashAge = 0;
    this.smokeSpawned = 0;
    this.shake = 18;
    this.flash = { steps: 6, max: 6, kind: 'crash' };
    for (let i = 0; i < 9; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 1.2 + Math.random() * 2.2;
      this.fx.sparks.push({
        x: 320 + (Math.random() - 0.5) * 90,
        y: 322 + Math.random() * 16,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 1.4,
        age: 0,
        life: 14 + Math.floor(Math.random() * 8),
      });
    }
    this.events.push({ type: 'crash' });
  }

  addPopup(text, kind) {
    const list = this.fx.popups;
    const ox = kind === 'nearmiss' ? 0 : (Math.random() - 0.5) * 60;
    const base = kind === 'nearmiss' ? 268 : 292;
    list.push({ text, kind, x: 320 + ox, y: base, age: 0, life: 50 });
    if (list.length > 6) list.shift();
  }

  spawnDust() {
    for (const s of [-1, 1]) {
      this.fx.dust.push({
        x: 320 + s * (52 + Math.random() * 10),
        y: 348 + Math.random() * 4,
        vx: s * (0.3 + Math.random() * 0.7),
        vy: -(0.4 + Math.random() * 0.8),
        age: 0,
        life: 22 + Math.floor(Math.random() * 8),
      });
    }
    if (this.fx.dust.length > 40) this.fx.dust.splice(0, this.fx.dust.length - 40);
  }

  updateFx() {
    const fx = this.fx;
    if (this.crashAge < 999) {
      this.crashAge++;
      while (this.smokeSpawned < 6 && this.crashAge - 1 >= this.smokeSpawned * 4.8) {
        fx.smoke.push({ x: 320 + (Math.random() - 0.5) * 16, y: 338 + Math.random() * 4, age: 0 });
        this.smokeSpawned++;
      }
    }
    for (let i = fx.smoke.length - 1; i >= 0; i--) {
      const p = fx.smoke[i];
      if (++p.age >= 30) fx.smoke.splice(i, 1);
    }
    for (let i = fx.sparks.length - 1; i >= 0; i--) {
      const p = fx.sparks[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18;
      if (++p.age >= p.life) fx.sparks.splice(i, 1);
    }
    for (let i = fx.dust.length - 1; i >= 0; i--) {
      const p = fx.dust[i];
      p.x += p.vx;
      p.y += p.vy;
      if (++p.age >= p.life) fx.dust.splice(i, 1);
    }
    for (let i = fx.popups.length - 1; i >= 0; i--) {
      const p = fx.popups[i];
      p.y -= 0.5;
      if (++p.age >= p.life) fx.popups.splice(i, 1);
    }
    if (this.shake > 0) this.shake--;
    if (this.flash.steps > 0) this.flash.steps--;
  }

  updateBackground(curve, dpos) {
    const d = curve * (dpos / SEG_LEN);
    this.bg.sky += d * K_SKY;
    this.bg.far += d * K_FAR;
    this.bg.near += d * K_NEAR;
  }

  // ------------------------------------------------------------- state API

  getState() {
    const sp = this.speed / MAX_SPEED;
    const pz = this.pos + PLAYER_Z;
    const sc = this.scene;
    const bgm = sc === 'countdown' || sc === 'playing' || sc === 'paused' ? 'bgm_' + this.stage : null;
    const engineOn = sc === 'countdown' || sc === 'playing' || sc === 'stageclear' || sc === 'timeup';
    return {
      scene: sc,
      seed: this.seed,
      stage: this.stage,
      score: this.scoreInt,
      best: this.best,
      timeLeft: this.timeLeft,
      speedKmh: this.speed / KMH,
      playerX: this.playerX,
      distanceM: this.pos / UNITS_PER_M,
      goalRemainingM: Math.max(0, (this.course.goalZ - pz) / UNITS_PER_M),
      checkpointsPassed: this.checkpointsPassed,
      overtakes: this.overtakes,
      crashes: this.crashes,
      invulnerable: this.invuln > 0,
      trafficTotal: this.trafficTotal,
      layoutHash: this.layoutHash,
      muted: this.muted,
      rank: sc === 'ending' ? this.rank : null,
      audio: { state: 'none', bgm, engineHz: engineOn ? 60 + 140 * sp : 0 },
    };
  }

  // ------------------------------------------------------------ debug hooks

  debugWarp(m) {
    if (this.scene !== 'countdown' && this.scene !== 'playing') return;
    const goalZ = this.course.goalZ;
    this.pos = clamp(m * UNITS_PER_M, 0, goalZ - 3000);
    const pz = this.pos + PLAYER_Z;
    for (const c of this.traffic) {
      if (c.z < pz) c.passed = true;
      c.prevRel = c.z - pz;
    }
    const cps = this.course.cpZ;
    while (this.checkpointsPassed < cps.length && pz >= cps[this.checkpointsPassed]) this.checkpointsPassed++;
  }

  debugSetTime(sec) {
    this.timeLeft = Number(sec) || 0;
    this.lastWarn = 99;
  }

  debugSetPlayerX(x) {
    this.playerX = clamp(Number(x) || 0, -PLAYER_X_CLAMP, PLAYER_X_CLAMP);
  }

  debugSetSpeedKmh(v) {
    this.speed = clamp(Number(v) || 0, 0, 300) * KMH;
  }
}
