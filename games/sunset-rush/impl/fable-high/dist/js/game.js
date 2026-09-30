// Game state machine and simulation (fixed STEP).

import {
  STEP, SEG_LEN, PLAYER_Z, MAX_SPEED, U_PER_M, U_PER_KMH, ACCEL, BRAKE, COAST, OFFROAD_DECEL, OFFROAD_LIMIT,
  STEER_RATE, CENTRIFUGAL, PLAYER_X_CLAMP, CRASH_SPEED_CAP, CRASH_INVULN, CRASH_PUSH, PLAYER_HIT_HALFW,
  HIT_Z_WINDOW, STAGES, STORAGE_KEY, DRAW_DIST, TAIL_SEGS,
} from './const.js';
import { clamp } from './util.js';
import { buildWorld } from './course.js';

const K_SKY = 0.15, K_FAR = 0.5, K_NEAR = 1.0;

export class Game {
  constructor({ assets, audio, input, seed, startStage, debug, muteParam }) {
    this.A = assets;
    this.audio = audio;
    this.input = input;
    this.seed = seed;
    this.startStage = startStage;
    this.debugEnabled = debug;
    this.best = 0;
    this.muted = false;
    this.loadSave();
    if (muteParam) this.muted = true;
    audio.setMuted(this.muted);

    this.t = 0; // wall-clock-ish time in steps (for blinking)
    this.acc = 0;
    this.fps = 0;
    this._fpsN = 0;
    this._fpsT = 0;
    this.audioStarted = false;
    this.jinglePlayed = false;

    this.stage = 1;
    this.score = 0;
    this.scoreF = 0;
    this.overtakes = 0;
    this.crashes = 0;
    this.newBest = false;
    this.rank = null;
    this.resetStageVars(STAGES[0]);
    this.enterTitle();
  }

  // ---------------------------------------------------------------- persistence
  loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o && typeof o === 'object') {
          this.best = Number.isFinite(+o.best) ? Math.max(0, Math.floor(+o.best)) : 0;
          this.muted = !!o.muted;
        }
      }
    } catch (_) { /* storage unavailable */ }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ best: this.best, muted: this.muted }));
    } catch (_) { /* storage unavailable */ }
  }

  // ---------------------------------------------------------------- helpers
  get sp() { return this.speed / MAX_SPEED; }
  get playerZ() { return this.pos + PLAYER_Z; }
  get stageDef() { return STAGES[this.stage - 1]; }
  get playerSeg() {
    const segs = this.world.segments;
    return segs[Math.min(segs.length - 1, Math.floor(this.playerZ / SEG_LEN))];
  }

  resetStageVars(stageDef) {
    this.speed = 0;
    this.playerX = 0;
    this.pos = 0;
    this.checkpointsPassed = 0;
    this.invulnTimer = 0;
    this.timeLeft = stageDef.time;
    this.off = { sky: 0, far: 0, near: 0 };
    this.smoke = [];
    this.sparks = [];
    this.dust = [];
    this.popups = [];
    this.shake = 0;
    this.wheelT = 0;
    this.countdownT = 0;
    this.countdownDigit = 0;
    this.goTimer = 0;
    this.stageNameTimer = 0;
    this.bannerTimer = 0;
    this.bannerText = '';
    this.bannerSub = '';
    this.clearTimer = 0;
    this.clearTimeLeft = 0;
    this.timeupTimer = 0;
    this.lastWarnSec = -1;
    this.smokeSpawnT = 0;
    this.smokeLeft = 0;
    this.dustT = 0;
    this.titleTargetLane = 1;
  }

  // ---------------------------------------------------------------- scene changes
  enterTitle() {
    this.scene = 'title';
    this.stage = 1;
    this.resetStageVars(STAGES[0]);
    this.world = buildWorld(STAGES[0], this.seed, this.A);
    this.speed = 7200;
    this.rank = null;
  }

  startRun() {
    this.score = 0;
    this.scoreF = 0;
    this.overtakes = 0;
    this.crashes = 0;
    this.newBest = false;
    this.rank = null;
    this.stage = this.startStage;
    this.startStage_();
  }

  startStage_() {
    const def = this.stageDef;
    this.resetStageVars(def);
    this.world = buildWorld(def, this.seed, this.A);
    this.scene = 'countdown';
    this.countdownT = 3.0;
    this.countdownDigit = 3;
    this.stageNameTimer = 4.0;
    this.audio.play('sfx_beep');
  }

  enterGameOver() {
    this.scene = 'gameover';
    this.commitBest();
  }

  enterEnding() {
    this.scene = 'ending';
    const s = this.score;
    this.rank = s >= 33000 ? 'S' : s >= 28000 ? 'A' : s >= 23000 ? 'B' : 'C';
    this.commitBest();
  }

  commitBest() {
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      this.save();
    } else {
      this.newBest = false;
    }
  }

  togglePause() {
    if (this.scene === 'playing') {
      this.scene = 'paused';
      this.audio.suspend();
    } else if (this.scene === 'paused') {
      this.scene = 'playing';
      this.audio.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    this.audio.setMuted(this.muted);
    this.save();
  }

  // ---------------------------------------------------------------- input
  handlePresses() {
    const presses = this.input.takePresses();
    for (const code of presses) {
      if (!this.audioStarted) {
        this.audioStarted = true;
        if (this.scene === 'title' && !this.jinglePlayed) { this.jinglePlayed = true; this.audio.play('jingle_title'); }
      }
      if (code === 'KeyM') { this.toggleMute(); continue; }
      if (code === 'KeyF') { this.toggleFullscreen(); continue; }
      const enter = code === 'Enter' || code === 'Space';
      switch (this.scene) {
        case 'title':
          if (enter) { this.audio.play('sfx_menu'); this.startRun(); }
          break;
        case 'countdown':
        case 'playing':
          if (code === 'KeyR') { this.startRun(); break; }
          if ((code === 'KeyP' || code === 'Escape') && this.scene === 'playing') this.togglePause();
          break;
        case 'paused':
          if (code === 'KeyP' || code === 'Escape') this.togglePause();
          else if (code === 'KeyR') { this.audio.resume(); this.startRun(); }
          else if (code === 'KeyQ') { this.audio.resume(); this.enterTitle(); }
          break;
        case 'stageclear':
          if (enter && this.clearTimer >= 1.5) {
            this.audio.play('sfx_menu');
            if (this.stage >= 3) this.enterEnding();
            else { this.stage += 1; this.startStage_(); }
          } else if (code === 'KeyR') this.startRun();
          break;
        case 'timeup':
          break;
        case 'gameover':
          if (enter || code === 'KeyR') { this.audio.play('sfx_menu'); this.startRun(); }
          else if (code === 'Escape' || code === 'KeyQ') this.enterTitle();
          break;
        case 'ending':
          if (enter || code === 'Escape' || code === 'KeyQ') { this.audio.play('sfx_menu'); this.enterTitle(); }
          else if (code === 'KeyR') this.startRun();
          break;
        default: break;
      }
    }
  }

  // Tap on the canvas (touch devices) acts as Enter on menu screens.
  tap() {
    if (['title', 'stageclear', 'gameover', 'ending'].includes(this.scene)) this.input.presses.push('Enter');
  }

  toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    } catch (_) { /* unsupported */ }
  }

  onHidden() {
    if (this.scene === 'playing') this.togglePause();
  }

  // ---------------------------------------------------------------- frame / steps
  tick(realDt) {
    this.handlePresses();
    this.acc += Math.min(realDt, 0.1);
    let steps = 0;
    while (this.acc >= STEP && steps < 6) {
      this.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps >= 6) this.acc = 0;
    this._fpsN++;
    this._fpsT += realDt;
    if (this._fpsT >= 0.5) { this.fps = Math.round(this._fpsN / this._fpsT); this._fpsN = 0; this._fpsT = 0; }
    this.syncAudio();
  }

  step(dt) {
    this.t += dt;
    switch (this.scene) {
      case 'title': this.stepTitle(dt); break;
      case 'countdown': this.stepCountdown(dt); break;
      case 'playing': this.stepPlaying(dt); break;
      case 'stageclear': this.stepDecel(dt, 3000); this.clearTimer += dt; this.updateFx(dt); break;
      case 'timeup':
        this.stepDecel(dt, 6000);
        this.updateFx(dt);
        this.timeupTimer -= dt;
        if (this.timeupTimer <= 0) this.enterGameOver();
        break;
      default: break;
    }
  }

  stepTitle(dt) {
    const w = this.world;
    this.speed = 7200;
    // simple autopilot: pick a lane without a car close ahead
    const pz = this.playerZ;
    const blocked = [false, false, false];
    for (const c of w.cars) if (c.z > pz && c.z - pz < 5000) blocked[c.lane] = true;
    if (blocked[this.titleTargetLane]) {
      const free = [1, 0, 2].filter((l) => !blocked[l]);
      if (free.length) this.titleTargetLane = free[0];
    }
    const target = [-0.667, 0, 0.667][this.titleTargetLane];
    this.playerX += clamp(target - this.playerX, -0.8 * dt, 0.8 * dt);
    this.advance(dt);
    this.updateTraffic(dt);
    this.wheelT += dt;
    if (this.pos >= (w.N + TAIL_SEGS - DRAW_DIST - 20) * SEG_LEN) {
      this.pos = 0;
      this.world = buildWorld(STAGES[0], this.seed, this.A);
    }
  }

  stepCountdown(dt) {
    this.countdownT -= dt;
    const digit = Math.ceil(this.countdownT - 1e-9);
    if (digit !== this.countdownDigit && digit >= 1) { this.countdownDigit = digit; this.audio.play('sfx_beep'); }
    this.stageNameTimer -= dt;
    this.updateTraffic(dt);
    if (this.countdownT <= 0) {
      this.scene = 'playing';
      this.goTimer = 0.8;
      this.audio.play('sfx_go');
    }
  }

  // Move forward by speed, accumulate distance points, update parallax.
  advance(dt) {
    const seg = this.playerSeg;
    const dpos = this.speed * dt;
    this.pos += dpos;
    const k = seg.curve * (dpos / SEG_LEN);
    this.off.sky += k * K_SKY;
    this.off.far += k * K_FAR;
    this.off.near += k * K_NEAR;
    return dpos;
  }

  stepDecel(dt, decel) {
    this.speed = Math.max(0, this.speed - decel * dt);
    this.advance(dt);
    this.updateTraffic(dt);
    if (this.speed > 0) this.wheelT += dt;
  }

  stepPlaying(dt) {
    const inp = this.input;
    // 1. accel
    let a = inp.throttle ? ACCEL : inp.brake ? -BRAKE : -COAST;
    const offroad = Math.abs(this.playerX) > 1;
    if (offroad && this.speed > OFFROAD_LIMIT) a -= OFFROAD_DECEL;
    this.speed = clamp(this.speed + a * dt, 0, MAX_SPEED);
    const sp = this.sp;
    // 2. steer + centrifugal
    const steer = (inp.right ? 1 : 0) + (inp.left ? -1 : 0);
    const dxp = dt * STEER_RATE * sp;
    this.playerX += steer * dxp;
    this.playerX -= dxp * sp * this.playerSeg.curve * CENTRIFUGAL;
    this.playerX = clamp(this.playerX, -PLAYER_X_CLAMP, PLAYER_X_CLAMP);
    // 3. forward
    const dpos = this.advance(dt);
    this.scoreF += dpos / U_PER_M;
    if (this.speed > 0) this.wheelT += dt;

    this.updateTraffic(dt);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.checkCollisions();

    // checkpoints / goal
    const w = this.world;
    const pz = this.playerZ;
    const def = this.stageDef;
    while (this.checkpointsPassed < def.cps.length && pz >= def.cps[this.checkpointsPassed] * SEG_LEN) {
      this.checkpointsPassed++;
      this.timeLeft += def.cpBonus;
      this.scoreF += 500;
      this.bannerTimer = 2.0;
      this.bannerText = 'CHECKPOINT!';
      this.bannerSub = `+${def.cpBonus} SEC`;
      this.audio.play('sfx_checkpoint');
    }
    if (pz >= w.goalZ) {
      this.stageClear();
      this.updateFx(dt);
      this.updateScore();
      return;
    }
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.scene = 'timeup';
      this.timeupTimer = 2.5;
      this.audio.play('sfx_timeup');
    } else if (this.timeLeft <= 10) {
      const s = Math.ceil(this.timeLeft);
      if (s !== this.lastWarnSec) { this.lastWarnSec = s; this.audio.play('sfx_timewarn'); }
    }
    // offroad dust
    if (offroad && this.speed > 0) {
      this.dustT += dt;
      if (this.dustT >= 0.05) {
        this.dustT = 0;
        const side = this.playerX > 0 ? 1 : -1;
        this.dust.push({ t: 0, x: 320 + side * 70 + (Math.random() - 0.5) * 20, y: 352 + Math.random() * 4, vx: -side * 20 + (Math.random() - 0.5) * 20 });
      }
    }
    this.updateFx(dt);
    this.updateScore();
  }

  updateScore() {
    this.score = Math.floor(this.scoreF);
  }

  stageClear() {
    this.scene = 'stageclear';
    this.clearTimer = 0;
    this.clearTimeLeft = Math.floor(this.timeLeft);
    this.clearBonusTime = 100 * this.clearTimeLeft;
    this.clearBonusStage = 1000 * this.stage;
    this.scoreF += this.clearBonusTime + this.clearBonusStage;
    this.audio.play('sfx_goal');
  }

  updateTraffic(dt) {
    const w = this.world;
    const lanes = [[], [], []];
    for (const c of w.cars) lanes[c.lane].push(c);
    for (const lane of lanes) {
      lane.sort((a, b) => b.z - a.z);
      let ahead = null;
      for (const c of lane) {
        c.eff = c.speed;
        if (ahead && ahead.z - c.z < 1000) c.eff = Math.min(c.eff, ahead.eff);
        ahead = c;
      }
    }
    const limit = (w.N + 280) * SEG_LEN;
    for (let i = w.cars.length - 1; i >= 0; i--) {
      const c = w.cars[i];
      c.z += c.eff * dt;
      if (c.z >= limit) w.cars.splice(i, 1);
    }
  }

  checkCollisions() {
    const pz = this.playerZ;
    const px = this.playerX;
    const canHit = this.invulnTimer <= 0;
    for (const c of this.world.cars) {
      const rel = c.z - pz;
      const crossed = (c.prevRel > 0) !== (rel > 0);
      let hitNow = false;
      if (canHit && !c.hit && (Math.abs(rel) < HIT_Z_WINDOW || crossed) && Math.abs(c.x - px) < PLAYER_HIT_HALFW + c.halfW) {
        this.crash(c.x);
        c.hit = true;
        hitNow = true;
      }
      if (!hitNow && c.prevRel > 0 && rel <= 0 && !c.hit && !c.passed) {
        c.passed = true;
        this.overtakes++;
        this.scoreF += 50;
        this.audio.play('sfx_overtake');
        this.popups.push({ text: '+50', t: 0, x: 400, y: 296 });
        if (this.speed >= 180 * U_PER_KMH) {
          const gap = Math.abs(c.x - px) - (PLAYER_HIT_HALFW + c.halfW);
          if (gap >= 0 && gap < 0.12) {
            this.scoreF += 20;
            this.popups.push({ text: 'NEAR MISS +20', t: 0, x: 400, y: 278 });
          }
        }
      }
      c.prevRel = rel;
    }
    // roadside solids near the player (only segments around the player)
    const segs = this.world.segments;
    const pi = Math.floor(pz / SEG_LEN);
    for (let i = Math.max(0, pi - 4); i <= Math.min(segs.length - 1, pi + 4); i++) {
      for (const o of segs[i].sprites) {
        if (!o.solid) continue;
        const rel = o.z - pz;
        const crossed = (o.prevRel > 0) !== (rel > 0);
        if (this.invulnTimer <= 0 && !o.hit && (Math.abs(rel) < HIT_Z_WINDOW || crossed) && Math.abs(o.x - px) < PLAYER_HIT_HALFW + o.halfW) {
          this.crash(o.x);
          o.hit = true;
        }
        o.prevRel = rel;
      }
    }
  }

  crash(otherX) {
    this.speed = Math.min(this.speed, CRASH_SPEED_CAP);
    this.crashes++;
    this.invulnTimer = CRASH_INVULN;
    this.playerX += (this.playerX >= otherX ? 1 : -1) * CRASH_PUSH;
    this.playerX = clamp(this.playerX, -PLAYER_X_CLAMP, PLAYER_X_CLAMP);
    this.audio.play('sfx_crash');
    this.smokeLeft = 6;
    this.smokeSpawnT = 0;
    this.shake = 0.3;
    for (let i = 0; i < 8; i++) {
      this.sparks.push({ t: 0, x: 320 + (Math.random() - 0.5) * 100, y: 330 + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 240, vy: -60 - Math.random() * 120 });
    }
  }

  updateFx(dt) {
    if (this.smokeLeft > 0) {
      this.smokeSpawnT -= dt;
      if (this.smokeSpawnT <= 0) {
        this.smokeSpawnT += 0.08;
        this.smokeLeft--;
        this.smoke.push({ t: 0, x: 320 + (Math.random() - 0.5) * 40, y: 350 + (Math.random() - 0.5) * 6 });
      }
    }
    for (const s of this.smoke) { s.t += dt; s.y -= 30 * dt; }
    this.smoke = this.smoke.filter((s) => s.t < 0.5);
    for (const s of this.sparks) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 300 * dt; }
    this.sparks = this.sparks.filter((s) => s.t < 0.35);
    for (const d of this.dust) { d.t += dt; d.x += d.vx * dt; d.y -= 25 * dt; }
    this.dust = this.dust.filter((d) => d.t < 0.4);
    for (const p of this.popups) { p.t += dt; p.y -= 30 * dt; }
    this.popups = this.popups.filter((p) => p.t < 0.8);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    if (this.goTimer > 0) this.goTimer = Math.max(0, this.goTimer - dt);
    if (this.stageNameTimer > 0) this.stageNameTimer -= dt;
    if (this.bannerTimer > 0) this.bannerTimer = Math.max(0, this.bannerTimer - dt);
  }

  // ---------------------------------------------------------------- audio sync
  syncAudio() {
    const s = this.scene;
    const a = this.audio;
    if (!a.ctx) return;
    const wantBgm = s === 'countdown' || s === 'playing' || s === 'paused' ? `bgm_${this.stage}` : null;
    if (wantBgm !== a.bgmId) { if (wantBgm) a.playBgm(wantBgm); else a.stopBgm(); }
    const wantEngine = s === 'countdown' || s === 'playing' || s === 'stageclear' || s === 'timeup';
    if (wantEngine) {
      a.startEngine();
      a.setEngine(this.sp, s === 'playing' && Math.abs(this.playerX) > 1);
    } else if (s !== 'paused') {
      a.stopEngine();
    }
  }

  get engineHz() {
    const s = this.scene;
    return s === 'countdown' || s === 'playing' || s === 'stageclear' || s === 'timeup' ? 60 + 140 * this.sp : 0;
  }

  // ---------------------------------------------------------------- hooks
  getState() {
    const s = this.scene;
    const w = this.world;
    return {
      scene: s,
      seed: this.seed,
      stage: this.stage,
      score: this.score,
      best: this.best,
      timeLeft: this.timeLeft,
      speedKmh: this.speed / U_PER_KMH,
      playerX: this.playerX,
      distanceM: this.pos / U_PER_M,
      goalRemainingM: Math.max(0, (w.goalZ - this.playerZ) / U_PER_M),
      checkpointsPassed: this.checkpointsPassed,
      overtakes: this.overtakes,
      crashes: this.crashes,
      invulnerable: this.invulnTimer > 0,
      trafficTotal: w.trafficTotal,
      layoutHash: w.layoutHash,
      muted: this.muted,
      rank: s === 'ending' ? this.rank : null,
      audio: {
        state: this.audio.state,
        bgm: s === 'countdown' || s === 'playing' || s === 'paused' ? (this.audio.bgmId || `bgm_${this.stage}`) : null,
        engineHz: this.engineHz,
      },
    };
  }

  debugApi() {
    return {
      warp: (m) => {
        if (this.scene !== 'countdown' && this.scene !== 'playing') return;
        const w = this.world;
        this.pos = clamp(m * U_PER_M, 0, w.goalZ - 3000);
        const pz = this.playerZ;
        for (const c of w.cars) { if (c.z <= pz) c.passed = true; c.prevRel = c.z - pz; }
        for (const o of w.roadside) if (o.solid) o.prevRel = o.z - pz;
        const def = this.stageDef;
        while (this.checkpointsPassed < def.cps.length && pz >= def.cps[this.checkpointsPassed] * SEG_LEN) this.checkpointsPassed++;
      },
      setTime: (sec) => { this.timeLeft = +sec; },
      setPlayerX: (x) => { this.playerX = clamp(+x, -PLAYER_X_CLAMP, PLAYER_X_CLAMP); },
      setSpeedKmh: (v) => { this.speed = clamp(+v, 0, 300) * U_PER_KMH; },
    };
  }
}
