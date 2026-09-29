// サウンド(すべて Web Audio API で合成)。エンジン音・効果音・BGM。

import { Sequencer, hz, midi } from './music.js';

export const SOUND_IDS = [
  'bgm_1', 'bgm_2', 'bgm_3', 'sfx_engine', 'sfx_beep', 'sfx_go', 'sfx_checkpoint', 'sfx_crash', 'sfx_goal',
  'sfx_timeup', 'sfx_menu', 'sfx_overtake', 'sfx_offroad', 'sfx_timewarn', 'jingle_title', 'jingle_clear',
];

export class AudioSys {
  constructor(muted) {
    this.ctx = null;
    this.muted = !!muted;
    this.master = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.engineGain = null;
    this.noise = null;
    this.engine = null;
    this.seq = null;
    this.offroad = null;
    this.bgmId = null;
    this.engineHz = 0;
    this.previewTimer = null;
  }

  get state() {
    if (!this.ctx) return 'none';
    const s = this.ctx.state;
    return s === 'running' ? 'running' : s === 'closed' ? 'closed' : 'suspended';
  }

  // ユーザー操作の中で呼ぶ。AudioContext を作る / resume する
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.knee.value = 12;
      comp.ratio.value = 6;
      comp.attack.value = 0.004;
      comp.release.value = 0.18;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(comp);
      comp.connect(ctx.destination);
      this.bgmGain = ctx.createGain(); this.bgmGain.gain.value = 0.35; this.bgmGain.connect(this.master);
      this.sfxGain = ctx.createGain(); this.sfxGain.gain.value = 0.6; this.sfxGain.connect(this.master);
      this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0.4; this.engineGain.connect(this.master);
      // 白色雑音バッファ
      const len = ctx.sampleRate * 1;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < len; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        d[i] = (seed / 4294967296) * 2 - 1;
      }
      this.noise = buf;
    }
    if (this.ctx.state === 'suspended' && !this.held) this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(this.master.gain.value, t);
      this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.5, t + 0.03);
    }
  }

  // 一時停止: AudioContext を止める / 再開する
  suspend() {
    this.held = true;
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resume() {
    this.held = false;
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  // ------------------------------------------------------------------ エンジン

  startEngine() {
    if (!this.ctx || this.engine) return;
    const c = this.ctx;
    const o1 = c.createOscillator(); o1.type = 'sawtooth';
    const o2 = c.createOscillator(); o2.type = 'square';
    const o3 = c.createOscillator(); o3.type = 'sawtooth';
    const g2 = c.createGain(); g2.gain.value = 0.5;
    const g3 = c.createGain(); g3.gain.value = 0.28;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 2.2;
    const g = c.createGain(); g.gain.value = 0.0001;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); o3.connect(g3); g3.connect(lp);
    lp.connect(g); g.connect(this.engineGain);
    o1.start(); o2.start(); o3.start();
    this.engine = { o1, o2, o3, lp, g };
    this.setEngine(0);
  }

  // sp = speed / MAX_SPEED(0〜1)
  setEngine(sp) {
    const e = this.engine;
    const f = 60 + 140 * sp;
    if (!e) return;
    const t = this.ctx.currentTime;
    e.o1.frequency.setTargetAtTime(f, t, 0.04);
    e.o2.frequency.setTargetAtTime(f * 1.006, t, 0.04);
    e.o3.frequency.setTargetAtTime(f * 2.01, t, 0.04);
    e.lp.frequency.setTargetAtTime(420 + 1900 * sp, t, 0.06);
    e.g.gain.setTargetAtTime(0.05 + 0.07 * sp, t, 0.05);
  }

  stopEngine() {
    const e = this.engine;
    if (!e) return;
    this.engine = null;
    const t = this.ctx.currentTime;
    e.g.gain.cancelScheduledValues(t);
    e.g.gain.setTargetAtTime(0.0001, t, 0.03);
    setTimeout(() => { try { e.o1.stop(); e.o2.stop(); e.o3.stop(); e.g.disconnect(); } catch (err) { /* 何もしない */ } }, 250);
  }

  // コース外の砂利音(ループ)
  setOffroad(active, sp) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (active && !this.offroad) {
      const s = c.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
      const g = c.createGain(); g.gain.value = 0.0001;
      s.connect(lp); lp.connect(hp); hp.connect(g); g.connect(this.sfxGain);
      s.start(0, Math.random() * 0.5);
      this.offroad = { s, g };
    }
    if (this.offroad) {
      const t = c.currentTime;
      this.offroad.g.gain.setTargetAtTime(active ? 0.1 + 0.32 * sp : 0.0001, t, 0.05);
      if (!active) {
        const o = this.offroad;
        this.offroad = null;
        setTimeout(() => { try { o.s.stop(); o.g.disconnect(); } catch (err) { /* 何もしない */ } }, 250);
      }
    }
  }

  // ------------------------------------------------------------------ BGM

  startBgm(id) {
    if (!this.ctx || this.bgmId === id) return;
    this.stopBgm();
    this.seq = new Sequencer(this.ctx, this.bgmGain, this.noise, id);
    this.seq.start();
    this.bgmId = id;
  }

  stopBgm() {
    if (this.seq) { this.seq.stop(); this.seq = null; }
    this.bgmId = null;
  }

  // ------------------------------------------------------------------ 効果音

  tone(f, dur, type = 'square', vol = 0.4, when = 0, opts = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const g = c.createGain();
    const a = opts.attack || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.setValueAtTime(vol, t + Math.max(a, dur * (opts.hold === undefined ? 0.7 : opts.hold)));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (opts.lp) {
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = opts.lp;
      o.connect(lp); node = lp;
    }
    node.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  noiseBurst(dur, vol, type, f0, f1, when = 0) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + when;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const fl = c.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f0, t);
    fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.sfxGain);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.03);
  }

  seqNotes(names, step, type, vol, opts = {}) {
    names.forEach((n, i) => {
      if (n) this.tone(hz(midi(n)), opts.dur || step * 1.4, type, vol, i * step, opts);
    });
  }

  play(id) {
    if (!this.ctx) return;
    switch (id) {
      case 'sfx_beep': this.tone(440, 0.15, 'square', 0.5, 0, { lp: 3000 }); break;
      case 'sfx_go': this.tone(880, 0.4, 'square', 0.55, 0, { lp: 4000, hold: 0.6 }); break;
      case 'sfx_checkpoint':
        this.seqNotes(['C5', 'E5', 'G5', 'C6'], 0.085, 'square', 0.26, { lp: 4200, dur: 0.16 });
        this.seqNotes(['C6', 'E6', 'G6', 'C7'], 0.085, 'triangle', 0.16, { dur: 0.18 });
        break;
      case 'sfx_crash':
        this.noiseBurst(0.42, 0.9, 'lowpass', 2600, 160);
        this.tone(130, 0.4, 'sine', 0.8, 0, { to: 38, hold: 0.2 });
        this.tone(70, 0.3, 'sawtooth', 0.28, 0, { to: 30, lp: 400, hold: 0.1 });
        break;
      case 'sfx_goal':
        // 短いファンファーレ(約 1.6 秒)
        this.seqNotes(['C5', 'C5', 'C5', 'G5', null, 'E5', 'G5', 'C6'], 0.14, 'square', 0.24, { lp: 4200, dur: 0.16 });
        this.seqNotes(['E5', 'E5', 'E5', 'C6', null, 'G5', 'C6', 'E6'], 0.14, 'sawtooth', 0.08, { lp: 3000, dur: 0.16 });
        this.tone(hz(midi('C6')), 0.55, 'square', 0.22, 1.12, { lp: 4200 });
        this.tone(hz(midi('E6')), 0.55, 'square', 0.16, 1.12, { lp: 4200 });
        this.tone(hz(midi('G6')), 0.6, 'triangle', 0.16, 1.12);
        this.tone(hz(midi('C4')), 0.7, 'triangle', 0.3, 1.12);
        break;
      case 'sfx_timeup':
        this.seqNotes(['A4', 'F4', 'D4', 'A3'], 0.26, 'sawtooth', 0.18, { lp: 1800, dur: 0.3 });
        this.tone(hz(midi('A2')), 0.9, 'triangle', 0.3, 0.8, { to: hz(midi('A2')) * 0.6 });
        break;
      case 'sfx_menu':
        this.tone(660, 0.07, 'square', 0.4, 0, { lp: 3500 });
        this.tone(990, 0.1, 'square', 0.4, 0.06, { lp: 3500 });
        break;
      case 'sfx_overtake':
        this.tone(1300, 0.07, 'sine', 0.42, 0, { to: 1900 });
        this.noiseBurst(0.12, 0.12, 'highpass', 2500, 7000);
        break;
      case 'sfx_nearmiss':
        this.tone(1500, 0.06, 'triangle', 0.28, 0, { to: 2300 });
        this.tone(2300, 0.09, 'triangle', 0.22, 0.05, { to: 3000 });
        break;
      case 'sfx_timewarn': this.tone(1100, 0.05, 'square', 0.34, 0, { lp: 3000 }); break;
      case 'jingle_title':
        this.seqNotes(['G4', 'C5', 'E5', 'G5', 'C6'], 0.09, 'square', 0.2, { lp: 4000, dur: 0.12 });
        this.tone(hz(midi('C6')), 0.4, 'triangle', 0.22, 0.45);
        break;
      case 'jingle_clear':
        this.seqNotes(['E5', 'G5', 'C6', 'E6', 'G6', 'C7'], 0.12, 'square', 0.2, { lp: 4200, dur: 0.14 });
        this.seqNotes(['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 0.12, 'triangle', 0.2, { dur: 0.14 });
        this.tone(hz(midi('C6')), 0.9, 'square', 0.2, 0.75, { lp: 4200 });
        this.tone(hz(midi('E6')), 0.9, 'triangle', 0.2, 0.75);
        this.tone(hz(midi('G6')), 0.9, 'triangle', 0.2, 0.75);
        break;
      default: break;
    }
  }

  stopPreview() {
    if (this.previewTimer) { clearTimeout(this.previewTimer); this.previewTimer = null; }
    if (this.previewBgm) { this.stopBgm(); this.previewBgm = false; }
    if (this.previewEngine) { this.stopEngine(); this.previewEngine = false; }
    if (this.previewOff) { this.setOffroad(false, 0); this.previewOff = false; }
  }

  // ギャラリー用のプレビュー(BGM・エンジン・砂利音は約 3 秒で止まる。同じ BGM をもう一度押すと止まる)
  preview(id) {
    if (!this.ensure()) return;
    this.resume();
    if (id.startsWith('bgm_') && this.previewBgm && this.bgmId === id) { this.stopPreview(); return; }
    this.stopPreview();
    if (id.startsWith('bgm_')) {
      this.startBgm(id);
      this.previewBgm = true;
      this.previewTimer = setTimeout(() => this.stopPreview(), 3000);
    } else if (id === 'sfx_engine') {
      this.startEngine();
      this.previewEngine = true;
      let sp = 0;
      const tick = () => { sp = Math.min(1, sp + 0.12); this.setEngine(sp); if (this.previewEngine) setTimeout(tick, 250); };
      tick();
      this.previewTimer = setTimeout(() => this.stopPreview(), 3000);
    } else if (id === 'sfx_offroad') {
      this.setOffroad(true, 0.6);
      this.previewOff = true;
      this.previewTimer = setTimeout(() => this.stopPreview(), 2500);
    } else {
      this.play(id);
    }
  }
}
