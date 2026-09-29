// SUNSET RUSH - ゲームロジック(DOM 非依存。固定ステップで進める)

import {
  STEP, SEG_LEN, PLAYER_Z, MAX_SPEED, KMH, UNITS_PER_M, ACCEL, BRAKE, COAST, OFFROAD_DECEL,
  OFFROAD_LIMIT, STEER_RATE, CENTRIFUGAL, PLAYER_X_CLAMP, CRASH_SPEED_CAP, CRASH_INVULN, CRASH_PUSH,
  PLAYER_HIT_HALFW, HIT_Z_WINDOW, STAGES, TITLE_SPEED, K_SKY, K_FAR, K_NEAR, rankFor,
} from './constants.js';
import { buildCourse } from './course.js';
import { spawnWorld } from './world.js';
import { clamp } from './util.js';

export const COUNTDOWN_STEPS = 180; // 3.0 秒
export const GO_STEPS = 48; // 0.8 秒
export const CP_BANNER_STEPS = 120; // 2.0 秒
export const CLEAR_PANEL_STEPS = 90; // 1.5 秒
export const TIMEUP_STEPS = 150; // 2.5 秒

export class Game {
  constructor(opts) {
    this.seed = opts.seed;
    this.startStage = opts.startStage || 1;
    this.best = opts.best || 0;
    this.muted = !!opts.muted;
    this.emit = opts.emit || (() => {});
    this.courses = [null, buildCourse(1), buildCourse(2), buildCourse(3)];
    // 入力(main.js が毎ステップ前に書き込む)
    this.input = { throttle: false, brake: false, left: false, right: false };

    this.scene = 'title';
    this.stage = this.startStage;
    this.worldStage = 1;
    this.score = 0;
    this.overtakes = 0;
    this.crashes = 0;
    this.tick = 0;
    this.sceneTimer = 0;
    this.newBest = false;
    this.rank = null;
    this.reachedStage = 1;

    this.bg = { sky: 0, far: 0, near: 0 };
    this._lanes = [[], [], []];
    this.fadeReq = 0;
    this.enterTitle();
  }

  // ------------------------------------------------------------------ 状態遷移

  resetFx() {
    this.puffs = [];
    this.dust = [];
    this.sparks = [];
    this.popups = [];
    this.smokeCount = 0;
    this.smokeCd = 0;
    this.dustCd = 0;
    this.shakeT = 0;
    this.goBanner = 0;
    this.cpBanner = 0;
    this.cpBannerSec = 0;
    this.crashAge = 99;
    this.steerInput = 0;
    this.brakeInput = false;
    this.offroad = false;
    this.lastCeil = 99;
  }

  loadWorld(stageNo) {
    this.worldStage = stageNo;
    this.course = this.courses[stageNo];
    this.world = spawnWorld(this.course, stageNo, this.seed);
    this.traffic = this.world.traffic;
    this.trafficTotal = this.traffic.length;
    this.layoutHash = this.world.layoutHash;
  }

  enterTitle() {
    this.scene = 'title';
    this.sceneTimer = 0;
    this.stage = this.startStage;
    this.score = 0;
    this.overtakes = 0;
    this.crashes = 0;
    this.loadWorld(1);
    this.pos = 0;
    this.speed = TITLE_SPEED;
    this.playerX = 0;
    this.timeLeft = STAGES[this.startStage - 1].startTime;
    this.checkpointsPassed = 0;
    this.invulnTimer = 0;
    this.resetFx();
    this.clear = null;
    this.rank = null;
    this.newBest = false;
    this.emit('scene', 'title');
  }

  startRun() {
    this.score = 0;
    this.overtakes = 0;
    this.crashes = 0;
    this.stage = this.startStage;
    this.newBest = false;
    this.rank = null;
    this.beginStage();
  }

  beginStage() {
    const st = STAGES[this.stage - 1];
    this.loadWorld(this.stage);
    this.pos = 0;
    this.speed = 0;
    this.playerX = 0;
    this.checkpointsPassed = 0;
    this.invulnTimer = 0;
    this.timeLeft = st.startTime;
    this.reachedStage = this.stage;
    this.resetFx();
    this.clear = null;
    this.scene = 'countdown';
    this.sceneTimer = 0;
    this.updateRel();
    this.emit('scene', 'countdown');
    this.emit('sfx', 'beep');
  }

  goPlaying() {
    this.scene = 'playing';
    this.sceneTimer = 0;
    this.goBanner = GO_STEPS;
    this.lastCeil = Math.ceil(this.timeLeft);
    this.emit('sfx', 'go');
    this.emit('scene', 'playing');
  }

  goal() {
    const timeBonus = 100 * Math.floor(Math.max(0, this.timeLeft));
    const stageBonus = 1000 * this.stage;
    const before = Math.floor(this.score);
    this.score += timeBonus + stageBonus;
    this.clear = {
      stage: this.stage, timeLeft: Math.floor(Math.max(0, this.timeLeft)), timeBonus, stageBonus,
      scoreBefore: before, panel: false, panelT: 0,
    };
    this.scene = 'stageclear';
    this.sceneTimer = 0;
    this.emit('sfx', 'goal');
    this.emit('scene', 'stageclear');
  }

  timeUp() {
    this.timeLeft = 0;
    this.scene = 'timeup';
    this.sceneTimer = 0;
    this.emit('sfx', 'timeup');
    this.emit('scene', 'timeup');
  }

  updateBest() {
    const s = Math.floor(this.score);
    if (s > this.best) {
      this.best = s;
      this.newBest = true;
      this.emit('save');
    } else {
      this.newBest = false;
    }
  }

  goGameOver() {
    this.scene = 'gameover';
    this.sceneTimer = 0;
    this.updateBest();
    this.emit('scene', 'gameover');
  }

  goEnding() {
    this.scene = 'ending';
    this.sceneTimer = 0;
    this.updateBest();
    this.rank = rankFor(Math.floor(this.score));
    this.emit('sfx', 'jingle_clear');
    this.emit('scene', 'ending');
  }

  // ------------------------------------------------------------------ 入力イベント(キー押下の瞬間)

  confirm() {
    switch (this.scene) {
      case 'title':
        this.emit('sfx', 'menu');
        this.startRun();
        break;
      case 'stageclear':
        if (this.clear && this.clear.panel) {
          this.emit('sfx', 'menu');
          if (this.stage < 3) {
            this.stage += 1;
            this.beginStage();
          } else {
            this.goEnding();
          }
        }
        break;
      case 'gameover':
        this.emit('sfx', 'menu');
        this.startRun();
        break;
      case 'ending':
        this.emit('sfx', 'menu');
        this.enterTitle();
        break;
      default:
        break;
    }
  }

  pauseToggle() {
    if (this.scene === 'playing') {
      this.scene = 'paused';
      this.emit('scene', 'paused');
    } else if (this.scene === 'paused') {
      this.scene = 'playing';
      this.emit('scene', 'playing');
    }
  }

  restart() {
    if (['countdown', 'playing', 'paused', 'gameover', 'ending'].includes(this.scene)) {
      this.startRun();
    }
  }

  quitToTitle() {
    if (this.scene === 'paused' || this.scene === 'gameover') this.enterTitle();
  }

  escape() {
    if (this.scene === 'playing' || this.scene === 'paused') this.pauseToggle();
    else if (this.scene === 'gameover' || this.scene === 'ending') this.enterTitle();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.emit('mute', this.muted);
  }

  // ------------------------------------------------------------------ 固定ステップ

  segAt(z) {
    const segs = this.course.segments;
    return segs[clamp(Math.floor(z / SEG_LEN), 0, segs.length - 1)];
  }

  scrollBg(curve, dpos) {
    const d = curve * (dpos / SEG_LEN);
    this.bg.sky += d * K_SKY;
    this.bg.far += d * K_FAR;
    this.bg.near += d * K_NEAR;
  }

  updateRel() {
    const pz = this.pos + PLAYER_Z;
    for (const c of this.traffic) c.rel = c.z - pz;
  }

  // 交通車の移動(同一レーンの先行車が 1000u 以内なら有効速度の小さい方で走る)
  updateTraffic(dt) {
    const lanes = this._lanes;
    lanes[0].length = 0; lanes[1].length = 0; lanes[2].length = 0;
    const list = this.traffic;
    for (let i = 0; i < list.length; i++) lanes[list[i].lane].push(list[i]);
    for (let l = 0; l < 3; l++) {
      const arr = lanes[l];
      arr.sort((a, b) => b.z - a.z);
      let ahead = null;
      for (let i = 0; i < arr.length; i++) {
        const c = arr[i];
        let eff = c.speed;
        if (ahead && ahead.z - c.z < 1000) eff = Math.min(eff, ahead.eff);
        c.eff = eff;
        ahead = c;
      }
    }
    const limit = (this.course.N + 280) * SEG_LEN;
    let removed = false;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      c.z += c.eff * dt;
      if (c.z >= limit) removed = true;
    }
    if (removed) this.traffic = this.world.traffic = list.filter((c) => c.z < limit);
  }

  step() {
    if (this.scene === 'paused') return; // タイマー・車・交通車・アニメーションをすべて止める
    this.tick++;
    const dt = STEP;
    switch (this.scene) {
      case 'title':
        this.sceneTimer++;
        this.stepTitle(dt);
        break;
      case 'countdown':
        this.sceneTimer++;
        if (this.sceneTimer === 60 || this.sceneTimer === 120) this.emit('sfx', 'beep');
        if (this.sceneTimer >= COUNTDOWN_STEPS) this.goPlaying();
        break;
      case 'playing':
        this.sceneTimer++;
        this.stepPlaying(dt);
        break;
      case 'stageclear':
        this.sceneTimer++;
        this.stepCoast(dt, 3000);
        if (this.clear) {
          if (this.sceneTimer >= CLEAR_PANEL_STEPS) {
            this.clear.panel = true;
            this.clear.panelT++;
          }
        }
        break;
      case 'timeup':
        this.sceneTimer++;
        this.stepCoast(dt, 6000);
        if (this.sceneTimer >= TIMEUP_STEPS) this.goGameOver();
        break;
      case 'gameover':
      case 'ending':
        this.sceneTimer++;
        break;
      case 'paused':
        return; // すべて止める
      default:
        break;
    }
    if (this.scene !== 'paused') this.updateFx(dt);
  }

  stepTitle(dt) {
    this.speed = TITLE_SPEED;
    const seg = this.segAt(this.pos + PLAYER_Z);
    const dpos = this.speed * dt;
    this.pos += dpos;
    this.scrollBg(seg.curve, dpos);
    this.playerX = 0.35 * Math.sin(this.tick / 90);
    this.updateTraffic(dt);
    if (this.pos + PLAYER_Z > (this.course.N - 60) * SEG_LEN) {
      this.loadWorld(1);
      this.pos = 0;
      this.fadeReq = 1;
    }
  }

  // ステージクリア・タイムアップ中の自動減速
  stepCoast(dt, decel) {
    this.speed = Math.max(0, this.speed - decel * dt);
    const seg = this.segAt(this.pos + PLAYER_Z);
    const dpos = this.speed * dt;
    const maxPos = (this.course.length - 2) * SEG_LEN - PLAYER_Z;
    this.pos = Math.min(this.pos + dpos, maxPos);
    this.scrollBg(seg.curve, dpos);
    this.updateTraffic(dt);
    this.updateRel();
    this.steerInput = 0;
    this.brakeInput = decel > 0 && this.speed > 0;
    this.offroad = false;
  }

  stepPlaying(dt) {
    const inp = this.input;
    const throttle = inp.throttle;
    const brake = inp.brake;
    const steer = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    this.steerInput = steer;
    this.brakeInput = brake && !throttle;

    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      if (this.invulnTimer < 1e-9) this.invulnTimer = 0;
    }

    // 1. 加減速
    let a;
    if (throttle) a = ACCEL;
    else if (brake) a = -BRAKE;
    else a = -COAST;
    if (Math.abs(this.playerX) > 1 && this.speed > OFFROAD_LIMIT) a -= OFFROAD_DECEL;
    this.speed = clamp(this.speed + a * dt, 0, MAX_SPEED);

    // 2. 操舵と遠心力
    const pz0 = this.pos + PLAYER_Z;
    const seg0 = this.segAt(pz0);
    const sp = this.speed / MAX_SPEED;
    const dxp = dt * STEER_RATE * sp;
    this.playerX += steer * dxp;
    this.playerX -= dxp * sp * seg0.curve * CENTRIFUGAL;
    this.playerX = clamp(this.playerX, -PLAYER_X_CLAMP, PLAYER_X_CLAMP);
    this.offroad = Math.abs(this.playerX) > 1;

    // 3. 前進
    const dpos = this.speed * dt;
    this.pos += dpos;
    this.score += dpos / UNITS_PER_M;
    const pz1 = this.pos + PLAYER_Z;
    this.scrollBg(seg0.curve, dpos);

    // 交通車・衝突・追い越し
    this.updateTraffic(dt);
    this.interactTraffic(pz1);
    this.interactSolids(pz0, pz1);

    // 4. タイム・チェックポイント・ゴール
    this.timeLeft -= dt;
    const st = STAGES[this.stage - 1];
    if (this.checkpointsPassed < st.cpSegs.length && pz1 >= st.cpSegs[this.checkpointsPassed] * SEG_LEN) {
      this.timeLeft += st.cpBonus;
      this.score += 500;
      this.checkpointsPassed++;
      this.cpBanner = CP_BANNER_STEPS;
      this.cpBannerSec = st.cpBonus;
      this.emit('sfx', 'checkpoint');
    }
    const cl = Math.ceil(this.timeLeft - 1e-9);
    if (cl < this.lastCeil && cl <= 10 && cl > 0) this.emit('sfx', 'timewarn');
    this.lastCeil = cl;

    if (pz1 >= this.course.goalZ) {
      this.goal();
    } else if (this.timeLeft <= 1e-9) {
      this.timeUp();
    }
  }

  interactTraffic(pz1) {
    const list = this.traffic;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const prevRel = c.rel;
      const rel = c.z - pz1;
      c.rel = rel;
      if (c.hit) continue;
      const flipped = (prevRel > 0) !== (rel > 0);
      const dx = Math.abs(c.x - this.playerX);
      if (this.invulnTimer <= 0 && (Math.abs(rel) < HIT_Z_WINDOW || flipped)
        && dx < PLAYER_HIT_HALFW + c.hitHalfW) {
        this.crash(c);
        continue;
      }
      if (prevRel > 0 && rel <= 0 && !c.passed) {
        c.passed = true;
        this.overtakes++;
        this.score += 50;
        this.emit('sfx', 'overtake');
        this.popup('+50', 0, '#ffe066');
        // スレスレ(S-07)
        const gap = dx - (PLAYER_HIT_HALFW + c.hitHalfW);
        if (this.speed / KMH >= 180 && gap >= 0 && gap < 0.12) {
          this.score += 20;
          this.popup('NEAR MISS +20', 1, '#7cf5ff');
          this.emit('sfx', 'nearmiss');
        }
      }
    }
  }

  interactSolids(pz0, pz1) {
    const segs = this.course.segments;
    const s0 = Math.max(0, Math.floor((pz1 - 500) / SEG_LEN));
    const s1 = Math.min(segs.length - 1, Math.floor((pz1 + 500) / SEG_LEN));
    for (let i = s0; i <= s1; i++) {
      const sprites = segs[i].sprites;
      for (let j = 0; j < sprites.length; j++) {
        const o = sprites[j];
        if (!o.solid || o.hit) continue;
        if (this.invulnTimer > 0) return;
        const rel = o.z - pz1;
        const prevRel = o.z - pz0;
        const flipped = (prevRel > 0) !== (rel > 0);
        if ((Math.abs(rel) < HIT_Z_WINDOW || flipped)
          && Math.abs(o.x - this.playerX) < PLAYER_HIT_HALFW + o.hitHalfW) {
          this.crash(o);
          return;
        }
      }
    }
  }

  crash(other) {
    this.speed = Math.min(this.speed, CRASH_SPEED_CAP);
    this.crashes++;
    this.invulnTimer = CRASH_INVULN;
    this.playerX += (this.playerX >= other.x ? 1 : -1) * CRASH_PUSH;
    this.playerX = clamp(this.playerX, -PLAYER_X_CLAMP, PLAYER_X_CLAMP);
    other.hit = true;
    this.smokeCount = 6;
    this.smokeCd = 0;
    this.shakeT = 0.3;
    this.crashAge = 0;
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 110;
      this.sparks.push({
        x: 320 + (Math.random() - 0.5) * 60, y: 322 + Math.random() * 16,
        vx: Math.cos(ang) * v, vy: -Math.abs(Math.sin(ang)) * v - 30, age: 0,
      });
    }
    this.emit('sfx', 'crash');
  }

  popup(text, row, color) {
    this.popups.push({ text, x: 320, y: 236 - row * 16, age: 0, life: 0.9, color });
  }

  // ------------------------------------------------------------------ 演出タイマー

  updateFx(dt) {
    if (this.goBanner > 0) this.goBanner--;
    if (this.cpBanner > 0) this.cpBanner--;
    if (this.crashAge < 90) this.crashAge += dt;
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);

    // 煙: 衝突の瞬間から 0.08 秒おきに 6 個
    if (this.smokeCount > 0) {
      this.smokeCd -= dt;
      if (this.smokeCd <= 1e-9) {
        this.puffs.push({ x: 320 + (Math.random() - 0.5) * 12, y: 344, age: 0 });
        this.smokeCount--;
        this.smokeCd += 0.08;
      }
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.age += dt;
      p.y -= 30 * dt;
      if (p.age >= 0.5) this.puffs.splice(i, 1);
    }

    // 砂煙(コース外)
    if (this.scene === 'playing' && this.offroad && this.speed > 800) {
      this.dustCd -= dt;
      if (this.dustCd <= 0) {
        this.dustCd += 0.05;
        for (const s of [-1, 1]) {
          this.dust.push({
            x: 320 + s * (44 + Math.random() * 10), y: 344 - Math.random() * 6,
            vx: s * (30 + Math.random() * 60), vy: -(10 + Math.random() * 40), age: 0,
          });
        }
      }
    }
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const p = this.dust[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.age >= 0.45) this.dust.splice(i, 1);
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.age += dt;
      p.vy += 420 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.age >= 0.3) this.sparks.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.age += dt;
      p.y -= 24 * dt;
      if (p.age >= p.life) this.popups.splice(i, 1);
    }
  }

  // ------------------------------------------------------------------ 検証フック

  warp(m) {
    if (this.scene !== 'countdown' && this.scene !== 'playing') return;
    this.pos = clamp(m * UNITS_PER_M, 0, this.course.goalZ - 3000);
    const pz = this.pos + PLAYER_Z;
    for (const c of this.traffic) {
      c.rel = c.z - pz;
      if (c.z < pz) c.passed = true;
    }
    const cps = this.course.cpZ;
    let n = 0;
    for (const z of cps) if (z <= pz) n++;
    this.checkpointsPassed = Math.max(this.checkpointsPassed, n);
  }

  setTime(sec) {
    this.timeLeft = sec;
    this.lastCeil = Math.ceil(sec);
  }

  setPlayerX(x) {
    this.playerX = clamp(x, -PLAYER_X_CLAMP, PLAYER_X_CLAMP);
  }

  setSpeedKmh(v) {
    this.speed = clamp(v, 0, 300) * KMH;
  }
}
