// ゲーム状態とシミュレーション(固定ステップ)
import * as C from './const.js';
import { STAGES, getCourse } from './course.js';
import { seededRng, clamp } from './util.js';

export const CAR_TYPES = {
  sedan: { worldW: 0.225, hit: 0.10, v: [80, 110], id: 'car_sedan' },
  truck: { worldW: 0.275, hit: 0.13, v: [60, 80], id: 'car_truck' },
  sports: { worldW: 0.2375, hit: 0.10, v: [120, 150], id: 'car_sports' },
};
const TYPE_NAMES = ['sedan', 'truck', 'sports'];

export const SCENERY = {
  1: { solid: [['rs_palm', 0.5, 0.10], ['rs_rock', 0.36, 0.14], ['rs_billboard', 0.6, 0.16]], decor: [['rs_shrub', 0.4]] },
  2: { solid: [['rs_pine', 0.5, 0.09], ['rs_boulder', 0.45, 0.16], ['rs_signpost', 0.24, 0.06]], decor: [['rs_fern', 0.35]] },
  3: { solid: [['rs_lamp', 0.22, 0.05], ['rs_neon', 0.7, 0.18], ['rs_bollard', 0.14, 0.05]], decor: [['rs_building', 1.6], ['rs_building_b', 1.4]] },
};

const GO_STEPS = 48; // 0.8 秒
const CP_BANNER = 2.0;

export class Game {
  constructor({ seed, startStage, debug, audio, store, muteParam }) {
    this.seed = seed >>> 0;
    this.startStage = startStage;
    this.debugOn = debug;
    this.audio = audio;
    this.store = store;
    this.best = store.best;
    this.muted = muteParam ? true : store.muted;
    audio.muted = this.muted;
    this.scene = 'title';
    this.stage = 1;
    this.scoreF = 0;
    this.overtakes = 0;
    this.crashes = 0;
    this.animT = 0;
    this.sceneSteps = 0;
    this.layer = { sky: 0, far: 0, near: 0 };
    this.newBest = false;
    this.fx = { smoke: [], sparks: [], dust: [], pops: [] };
    this.shake = 0;
    this.cur = {};
    this.buildWorld(1);
    this.resetTitle();
  }

  // ---------- ワールド生成 ----------
  buildWorld(stage) {
    this.stage = stage;
    const co = getCourse(stage);
    this.course = co;
    const st = co.st;
    const N = co.N;
    const rng = seededRng((this.seed ^ Math.imul(stage, 0x9e3779b1)) >>> 0);
    const randInt = (n) => Math.floor(rng() * n);
    const cars = [];
    const spacing = (N - 160) / st.cars;
    let prevLane = 0;
    for (let k = 0; k < st.cars; k++) {
      const seg = Math.round(60 + (k + 0.5) * spacing + (rng() - 0.5) * 0.6 * spacing);
      const z = seg * C.SEG_LEN + rng() * C.SEG_LEN;
      const lane = k === 0 ? randInt(3) : (prevLane + 1 + randInt(2)) % 3;
      prevLane = lane;
      const r = rng();
      const type = r < st.ratio[0] ? 'sedan' : r < st.ratio[0] + st.ratio[1] ? 'truck' : 'sports';
      const ct = CAR_TYPES[type];
      const speed = (ct.v[0] + rng() * (ct.v[1] - ct.v[0])) * C.KMH;
      const variant = randInt(3);
      cars.push({ type, lane, x: C.LANE_X[lane], z, speed, eff: speed, hit: false, passed: false, relPrev: 0, variant, id: variant ? `${ct.id}_v${variant}` : ct.id, worldW: ct.worldW, hitW: ct.hit });
    }
    this.traffic = cars;
    this.trafficTotal = cars.length;
    this.lanes = [[], [], []];
    for (const c of cars) this.lanes[c.lane].push(c);
    for (const l of this.lanes) l.sort((a, b) => b.z - a.z);
    // ゲート
    this.gates = [];
    const gateSegs = [];
    st.cps.forEach((s, i) => { this.gates.push({ id: 'gate_checkpoint', seg: s, z: s * C.SEG_LEN + 100, cp: i }); gateSegs.push(s); });
    this.gates.push({ id: 'gate_goal', seg: N, z: N * C.SEG_LEN + 100, goal: true });
    gateSegs.push(N);
    this.gates.push({ id: 'gate_start', seg: 8, z: 8 * C.SEG_LEN + 100, start: true });
    gateSegs.push(8);
    // 路側物
    const sc = SCENERY[stage];
    const items = [];
    for (let seg = 12; seg <= N + 60; seg += 6) {
      for (const side of [-1, 1]) {
        const r = rng(), tr = rng(), orr = rng();
        let kind = null;
        if (r < 0.35) kind = 'solid';
        else if (r < 0.75) kind = 'decor';
        if (!kind) continue;
        if (kind === 'solid') {
          if (seg < 40) continue;
          if (gateSegs.some((g) => Math.abs(seg - g) <= 4)) continue;
          const t = sc.solid[Math.floor(tr * sc.solid.length)];
          items.push({ id: t[0], worldW: t[1], hitW: t[2], solid: true, hit: false, z: seg * C.SEG_LEN + 100, offset: side * (1.45 + orr * 0.55), seg });
        } else {
          const t = sc.decor[Math.floor(tr * sc.decor.length)];
          items.push({ id: t[0], worldW: t[1], solid: false, z: seg * C.SEG_LEN + 100, offset: side * (2.2 + orr * 1.4), seg });
        }
      }
    }
    this.scenery = items;
    this.solids = items.filter((i) => i.solid);
    // ハッシュ
    let h = 2166136261 >>> 0;
    const mix = (v) => { h = Math.imul(h ^ (v | 0), 16777619) >>> 0; };
    for (const c of cars) { mix(c.z * 10); mix(c.lane); mix(TYPE_NAMES.indexOf(c.type)); mix(c.speed); mix(c.variant); }
    for (const s of items) { mix(s.z); mix(s.offset * 1000); mix(s.solid ? 1 : 2); mix(s.id.length * 31 + s.id.charCodeAt(4)); }
    this.layoutHash = h.toString(16).padStart(8, '0');
  }

  resetStageVars() {
    const st = this.course.st;
    this.speed = 0;
    this.playerX = 0;
    this.pos = 0;
    this.checkpointsPassed = 0;
    this.cpDone = [false, false];
    this.invulnTimer = 0;
    this.timeLeft = st.time;
    this.bannerT = 0;
    this.bannerSec = 0;
    this.goT = 0;
    this.lastCeil = -1;
    this.smokeT = 0;
    this.smokeN = 0;
    this.dustT = 0;
    this.fx = { smoke: [], sparks: [], dust: [], pops: [] };
    this.shake = 0;
    this.input = { steer: 0, gas: false, brake: false };
    this.prevPlayerZ = C.PLAYER_Z;
    this.syncRel();
    this.clearInfo = null;
  }
  syncRel() {
    const pz = this.pos + C.PLAYER_Z;
    for (const c of this.traffic) c.relPrev = c.z - pz;
    this.prevPlayerZ = pz;
  }

  resetTitle() {
    this.scene = 'title';
    this.audio.stopBgm();
    this.buildWorld(1);
    this.resetStageVars();
    this.speed = 7200;
    this.sceneSteps = 0;
    this.titleTarget = 0;
    this.layer = { sky: 0, far: 0, near: 0 };
  }

  // ---------- run / stage 制御 ----------
  newRun() {
    this.scoreF = 0;
    this.overtakes = 0;
    this.crashes = 0;
    this.newBest = false;
    this.startStageRun(this.startStage);
  }
  startStageRun(stage) {
    this.buildWorld(stage);
    this.resetStageVars();
    this.scene = 'countdown';
    this.sceneSteps = 0;
    this.layer = { sky: 0, far: 0, near: 0 };
    this.audio.playBgm('bgm_' + stage);
    this.audio.sfx('sfx_beep');
  }
  get playerZ() { return this.pos + C.PLAYER_Z; }
  get score() { return Math.floor(this.scoreF + 1e-6); }

  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      this.store.save({ best: this.best });
    }
  }

  // ---------- 入力イベント ----------
  onAction(code) {
    const sc = this.scene;
    const confirm = code === 'Enter' || code === 'Space';
    if (code === 'KeyM') {
      this.muted = !this.muted;
      this.audio.setMuted(this.muted);
      this.store.save({ muted: this.muted });
      return;
    }
    if (confirm) {
      if (sc === 'title') { this.audio.sfx('sfx_menu'); this.newRun(); }
      else if (sc === 'stageclear' && this.sceneSteps >= 90) {
        this.audio.sfx('sfx_menu');
        if (this.stage >= 3) this.enterEnding();
        else this.startStageRun(this.stage + 1);
      } else if (sc === 'gameover') { this.audio.sfx('sfx_menu'); this.newRun(); }
      else if (sc === 'ending') { this.audio.sfx('sfx_menu'); this.toTitle(); }
      return;
    }
    if (code === 'KeyP' || code === 'Escape') {
      if (sc === 'playing') { this.scene = 'paused'; this.audio.suspend(); }
      else if (sc === 'paused') { this.scene = 'playing'; this.audio.resume(); }
      else if ((sc === 'gameover' || sc === 'ending') && code === 'Escape') this.toTitle();
      return;
    }
    if (code === 'KeyR') {
      if (['countdown', 'playing', 'paused', 'gameover', 'ending'].includes(sc)) {
        if (sc === 'paused') this.audio.resume();
        this.newRun();
      }
      return;
    }
    if (code === 'KeyQ') {
      if (sc === 'paused') { this.audio.resume(); this.toTitle(); }
      else if (sc === 'gameover') this.toTitle();
    }
  }
  pauseIfPlaying() {
    if (this.scene === 'playing') { this.scene = 'paused'; this.audio.suspend(); }
  }
  toTitle() {
    this.resetTitle();
  }
  enterEnding() {
    this.scene = 'ending';
    this.sceneSteps = 0;
    this.audio.stopBgm();
    this.audio.sfx('jingle_clear');
    const s = this.score;
    this.rank = s >= 33000 ? 'S' : s >= 28000 ? 'A' : s >= 23000 ? 'B' : 'C';
    this.saveBest();
  }

  // ---------- 1 ステップ ----------
  step(input) {
    if (this.scene === 'paused') return;
    this.animT += C.STEP;
    this.sceneSteps++;
    const sc = this.scene;
    if (sc === 'title') this.stepTitle();
    else if (sc === 'countdown') this.stepCountdown();
    else if (sc === 'playing') this.stepPlaying(input);
    else if (sc === 'stageclear') this.stepStageClear();
    else if (sc === 'timeup') this.stepTimeup();
    this.updateFx();
  }

  advance(dtPos) {
    // 背景オフセット(仕様 3.4.1)
    const seg = this.course.segs[Math.floor((this.pos + C.PLAYER_Z) / C.SEG_LEN)];
    const cv = seg ? seg.curve : 0;
    const d = cv * (dtPos / C.SEG_LEN);
    this.layer.sky += d * 0.15;
    this.layer.far += d * 0.5;
    this.layer.near += d * 1.0;
  }

  moveTraffic(dt) {
    const endZ = (this.course.N + 280) * C.SEG_LEN;
    for (const lane of this.lanes) {
      for (let i = 0; i < lane.length; i++) {
        const c = lane[i];
        c.eff = c.speed;
        if (i > 0) {
          const lead = lane[i - 1];
          if (lead.z > c.z && lead.z - c.z < 1000) c.eff = Math.min(c.speed, lead.eff);
        }
      }
      for (const c of lane) c.z += c.eff * dt;
    }
    if (this.traffic.length && this.traffic.some((c) => c.z >= endZ)) {
      this.traffic = this.traffic.filter((c) => c.z < endZ);
      for (const l of this.lanes) { for (let i = l.length - 1; i >= 0; i--) if (l[i].z >= endZ) l.splice(i, 1); }
    }
  }

  stepTitle() {
    const dt = C.STEP;
    // 空いているレーンへ自動で寄る
    const pz = this.playerZ;
    let best = 1, bd = -1;
    for (let l = 0; l < 3; l++) {
      let d = 6000;
      for (const c of this.lanes[l]) { const r = c.z - pz; if (r > -700 && r < d) d = r; }
      const score = d + (Math.abs(C.LANE_X[l] - this.playerX) < 0.4 ? 900 : 0);
      if (score > bd) { bd = score; best = l; }
    }
    const tx = C.LANE_X[best];
    this.playerX += clamp(tx - this.playerX, -1, 1) * 0.04;
    this.pos += this.speed * dt;
    this.advance(this.speed * dt);
    this.moveTraffic(dt);
    if (this.pos > this.course.goalZ - 8000) {
      this.buildWorld(1);
      this.resetStageVars();
      this.speed = 7200;
    }
  }

  stepCountdown() {
    if (this.sceneSteps % 60 === 0 && this.sceneSteps < 180) this.audio.sfx('sfx_beep');
    if (this.sceneSteps >= 180) {
      this.scene = 'playing';
      this.sceneSteps = 0;
      this.goT = GO_STEPS;
      this.audio.sfx('sfx_go');
    }
  }

  stepPlaying(input) {
    const dt = C.STEP;
    if (this.goT > 0) this.goT--;
    const throttle = input.gas, brake = input.brake;
    let a;
    if (throttle) a = C.ACCEL;
    else if (brake) a = -C.BRAKE;
    else a = -C.COAST;
    if (Math.abs(this.playerX) > 1 && this.speed > C.OFFROAD_LIMIT) a -= C.OFFROAD_DECEL;
    this.speed = clamp(this.speed + a * dt, 0, C.MAX_SPEED);
    const steer = input.steer;
    this.input = { steer, gas: throttle, brake };
    const sp = this.speed / C.MAX_SPEED;
    const dxp = dt * C.STEER_RATE * sp;
    const pz0 = this.playerZ;
    const seg0 = this.course.segs[Math.floor(pz0 / C.SEG_LEN)];
    this.playerX += steer * dxp;
    this.playerX -= dxp * sp * (seg0 ? seg0.curve : 0) * C.CENTRIFUGAL;
    this.playerX = clamp(this.playerX, -C.PLAYER_X_CLAMP, C.PLAYER_X_CLAMP);
    const dpos = this.speed * dt;
    this.prevPlayerZ = pz0;
    this.pos += dpos;
    this.advance(dpos);
    this.scoreF += dpos / C.M_UNIT;
    this.moveTraffic(dt);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.collide();
    // チェックポイント
    const pz = this.playerZ;
    const st = this.course.st;
    for (let i = 0; i < 2; i++) {
      if (!this.cpDone[i] && pz >= st.cps[i] * C.SEG_LEN) {
        this.cpDone[i] = true;
        this.checkpointsPassed++;
        this.timeLeft += st.cpTime;
        this.scoreF += 500;
        this.bannerT = CP_BANNER;
        this.bannerSec = st.cpTime;
        this.audio.sfx('sfx_checkpoint');
      }
    }
    if (this.bannerT > 0) this.bannerT = Math.max(0, this.bannerT - dt);
    // タイマー
    this.timeLeft -= dt;
    if (pz >= this.course.goalZ) { this.goal(); return; }
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.scene = 'timeup';
      this.sceneSteps = 0;
      this.audio.stopBgm();
      this.audio.sfx('sfx_timeup');
      return;
    }
    const cl = Math.ceil(this.timeLeft);
    if (this.timeLeft <= 10 && cl !== this.lastCeil) { this.audio.sfx('sfx_timewarn'); }
    this.lastCeil = cl;
    // 砂煙
    if (Math.abs(this.playerX) > 1 && this.speed > 500) {
      this.dustT -= dt;
      if (this.dustT <= 0) {
        this.dustT = 0.05;
        for (const s of [-1, 1]) this.fx.dust.push({ x: 320 + s * (45 + Math.random() * 15), y: 346 + Math.random() * 6, vx: s * (20 + Math.random() * 30), age: 0 });
      }
    }
  }

  collide() {
    const pz = this.playerZ, ppz = this.prevPlayerZ;
    // 追い越し・衝突(交通車)
    for (const c of this.traffic) {
      const rel = c.z - pz;
      const flip = (c.relPrev > 0) !== (rel > 0);
      if (this.invulnTimer <= 0 && !c.hit && (Math.abs(rel) < C.HIT_Z_WINDOW || flip)) {
        if (Math.abs(c.x - this.playerX) < C.PLAYER_HIT_HALFW + c.hitW) this.crash(c.x, c);
      }
      if (c.relPrev > 0 && rel <= 0 && !c.hit && !c.passed) {
        c.passed = true;
        this.overtakes++;
        this.scoreF += 50;
        this.audio.sfx('sfx_overtake');
        this.fx.pops.push({ text: '+50', x: 320 + (c.x - this.playerX) * 60, y: 250, age: 0, col: '#ffffff' });
        const gap = Math.abs(c.x - this.playerX) - (C.PLAYER_HIT_HALFW + c.hitW);
        if (this.speed / C.KMH >= 180 && gap >= 0 && gap < 0.12) {
          this.scoreF += 20;
          this.fx.pops.push({ text: 'NEAR MISS +20', x: 320, y: 226, age: 0, col: '#ffe36a' });
        }
      }
      c.relPrev = rel;
    }
    // 路側物
    if (this.invulnTimer <= 0) {
      for (const s of this.solids) {
        if (s.z < ppz - 600) continue;
        if (s.z > pz + 600) break;
        if (s.hit) continue;
        const rel = s.z - pz, relPrev = s.z - ppz;
        const flip = (relPrev > 0) !== (rel > 0);
        if ((Math.abs(rel) < C.HIT_Z_WINDOW || flip) && Math.abs(s.offset - this.playerX) < C.PLAYER_HIT_HALFW + s.hitW) {
          this.crash(s.offset, s);
          break;
        }
      }
    }
  }

  crash(ox, obj) {
    obj.hit = true;
    this.speed = Math.min(this.speed, C.CRASH_SPEED_CAP);
    this.crashes++;
    this.invulnTimer = C.CRASH_INVULN;
    this.playerX += (this.playerX >= ox ? 1 : -1) * C.CRASH_PUSH;
    this.playerX = clamp(this.playerX, -C.PLAYER_X_CLAMP, C.PLAYER_X_CLAMP);
    this.audio.sfx('sfx_crash');
    this.smokeT = 0.5;
    this.smokeAcc = 0;
    this.smokeN = 0;
    this.shake = 0.3;
    for (let i = 0; i < 8; i++) this.fx.sparks.push({ x: 320 + (Math.random() - 0.5) * 40, y: 318, vx: (Math.random() - 0.5) * 200, vy: -60 - Math.random() * 120, age: 0 });
  }

  goal() {
    const st = this.course.st;
    const tl = Math.floor(this.timeLeft);
    this.clearInfo = { timeLeft: tl, timeBonus: tl * 100, stageBonus: 1000 * this.stage, scoreBefore: this.scoreF };
    this.scoreF += tl * 100 + 1000 * this.stage;
    this.scene = 'stageclear';
    this.sceneSteps = 0;
    this.audio.stopBgm();
    this.audio.sfx('sfx_goal');
    void st;
  }

  stepStageClear() {
    this.decelMove(3000);
    this.moveTraffic(C.STEP);
  }
  stepTimeup() {
    this.decelMove(6000);
    this.moveTraffic(C.STEP);
    if (this.sceneSteps >= 150) {
      this.scene = 'gameover';
      this.sceneSteps = 0;
      this.saveBest();
    }
  }
  decelMove(d) {
    this.speed = Math.max(0, this.speed - d * C.STEP);
    const maxPos = (this.course.total - 5) * C.SEG_LEN - C.PLAYER_Z;
    const dp = Math.min(this.speed * C.STEP, Math.max(0, maxPos - this.pos));
    this.pos += dp;
    this.advance(dp);
  }

  updateFx() {
    const dt = C.STEP;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    if (this.smokeT > 0) {
      this.smokeT -= dt;
      this.smokeAcc = (this.smokeAcc ?? 0) - dt;
      while (this.smokeAcc <= 0 && this.smokeN < 6) {
        this.smokeAcc += 0.08;
        this.smokeN++;
        this.fx.smoke.push({ x: 320 + (Math.random() - 0.5) * 30, y: 338, age: 0 });
      }
    }
    for (const p of this.fx.smoke) p.age += dt;
    this.fx.smoke = this.fx.smoke.filter((p) => p.age < 0.5);
    for (const p of this.fx.sparks) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; }
    this.fx.sparks = this.fx.sparks.filter((p) => p.age < 0.3);
    for (const p of this.fx.dust) { p.age += dt; p.x += p.vx * dt; p.y -= 25 * dt; }
    this.fx.dust = this.fx.dust.filter((p) => p.age < 0.35);
    for (const p of this.fx.pops) { p.age += dt; p.y -= 18 * dt; }
    this.fx.pops = this.fx.pops.filter((p) => p.age < 0.9);
  }

  // ---------- 状態公開 ----------
  audioInfo() {
    const sc = this.scene;
    const engineOn = sc === 'countdown' || sc === 'playing' || sc === 'stageclear' || sc === 'timeup';
    const bgmOn = sc === 'countdown' || sc === 'playing' || sc === 'paused';
    return { state: this.audio.state, bgm: bgmOn ? this.audio.bgmId : null, engineHz: engineOn ? 60 + 140 * (this.speed / C.MAX_SPEED) : 0 };
  }
  getState() {
    const pz = this.playerZ;
    return {
      scene: this.scene,
      seed: this.seed,
      stage: this.stage,
      score: this.score,
      best: this.best,
      timeLeft: this.timeLeft,
      speedKmh: this.speed / C.KMH,
      playerX: this.playerX,
      distanceM: this.pos / C.M_UNIT,
      goalRemainingM: Math.max(0, (this.course.goalZ - pz) / C.M_UNIT),
      checkpointsPassed: this.checkpointsPassed,
      overtakes: this.overtakes,
      crashes: this.crashes,
      invulnerable: this.invulnTimer > 0,
      trafficTotal: this.trafficTotal,
      layoutHash: this.layoutHash,
      muted: this.muted,
      rank: this.scene === 'ending' ? this.rank : null,
      audio: this.audioInfo(),
    };
  }

  // ---------- デバッグ ----------
  debugApi() {
    return {
      warp: (m) => {
        if (this.scene !== 'countdown' && this.scene !== 'playing') return;
        this.pos = clamp(m * C.M_UNIT, 0, this.course.goalZ - 3000);
        const pz = this.playerZ;
        for (const c of this.traffic) { c.relPrev = c.z - pz; if (c.z < pz) c.passed = true; }
        this.prevPlayerZ = pz;
        const st = this.course.st;
        for (let i = 0; i < 2; i++) if (!this.cpDone[i] && pz >= st.cps[i] * C.SEG_LEN) { this.cpDone[i] = true; this.checkpointsPassed++; }
      },
      setTime: (s) => { this.timeLeft = s; },
      setPlayerX: (x) => { this.playerX = clamp(x, -2, 2); },
      setSpeedKmh: (v) => { this.speed = clamp(v, 0, 300) * C.KMH; },
      masterGain: () => (this.audio.master ? this.audio.master.gain.value : null),
    };
  }
}
