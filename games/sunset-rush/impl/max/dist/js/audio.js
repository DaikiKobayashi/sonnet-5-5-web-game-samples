// Web Audio: everything is synthesised at runtime (no audio files).
// Graph: voices -> {bgmBus 0.35 | sfxBus 0.6 | engineBus 0.4} -> compressor -> master (0.5, 0 when muted) -> speakers

import { SONGS, JINGLES, midi, hz } from './music.js';

const MASTER_GAIN = 0.5;
const BGM_GAIN = 0.35;
const SFX_GAIN = 0.6;
const ENGINE_GAIN = 0.4;

export class AudioEngine {
  constructor({ muted = false } = {}) {
    this.muted = !!muted;
    this.ctx = null;
    this.bgm = null; // logical id of the requested BGM (also tracked when no context exists yet)
    this.inst = null; // running BGM instance
    this.engine = null;
    this.engineHz = 0;
    this.off = null;
    this.holdSuspend = false;
    this.timers = new Set();
  }

  get state() {
    return this.ctx ? this.ctx.state : 'none';
  }

  // Must be called from a user gesture (keydown / pointerdown)
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.init(new AC({ latencyHint: 'interactive' }));
      }
      if (this.ctx.state === 'suspended' && !this.holdSuspend) {
        const p = this.ctx.resume();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) { /* audio unavailable: the game stays silent */ }
  }

  init(ctx) {
    this.ctx = ctx;
    const mk = (v, dest) => {
      const g = ctx.createGain();
      g.gain.value = v;
      if (dest) g.connect(dest);
      return g;
    };
    this.master = mk(this.muted ? 0 : MASTER_GAIN, ctx.destination);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 14;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    comp.connect(this.master);
    this.bgmBus = mk(BGM_GAIN, comp);
    this.sfxBus = mk(SFX_GAIN, comp);
    this.engineBus = mk(ENGINE_GAIN, comp);
    // 2 s of white noise, reused by every noise voice
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < len; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      d[i] = (seed / 4294967296) * 2 - 1;
    }
    this.noiseBuf = buf;
    if (this.bgm && !this.inst) this.startBgm(this.bgm);
  }

  setMuted(m) {
    this.muted = !!m;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.muted ? 0 : MASTER_GAIN, t);
  }

  suspend() {
    this.holdSuspend = true;
    if (this.ctx && this.ctx.state === 'running') {
      const p = this.ctx.suspend();
      if (p && p.catch) p.catch(() => {});
    }
  }

  resume() {
    this.holdSuspend = false;
    if (this.ctx && this.ctx.state === 'suspended') {
      const p = this.ctx.resume();
      if (p && p.catch) p.catch(() => {});
    }
  }

  // ------------------------------------------------------------------ primitives
  now() {
    return this.ctx.currentTime;
  }

  tone({ type = 'square', f0, f1 = null, t = this.now(), dur = 0.2, vol = 0.3, attack = 0.005, dest = this.sfxBus, cutoff = 0, detune = 0 }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (detune) o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (cutoff) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = cutoff;
      o.connect(lp);
      node = lp;
    }
    node.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return g;
  }

  noise({ t = this.now(), dur = 0.2, type = 'lowpass', f0 = 2000, f1 = null, q = 0.7, vol = 0.4, dest = this.sfxBus, attack = 0.002 }) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest);
    s.start(t, (t * 0.37) % 1.5, dur + 0.05);
    return g;
  }

  notes(list, wave = 'square', vol = 0.3, dest = this.sfxBus, t0 = this.now(), cutoff = 3400) {
    for (const [name, at, dur] of list) {
      this.tone({ type: wave, f0: hz(midi(name)), t: t0 + at, dur: dur + 0.06, vol, attack: 0.006, dest, cutoff });
      this.tone({ type: 'triangle', f0: hz(midi(name)) * 2, t: t0 + at, dur: dur + 0.04, vol: vol * 0.35, attack: 0.006, dest });
    }
  }

  // ------------------------------------------------------------------ sound effects
  sfx(name) {
    if (!this.ctx) return;
    try {
      const t = this.now();
      switch (name) {
        case 'beep': this.tone({ type: 'square', f0: 440, dur: 0.15, vol: 0.42, cutoff: 3000 }); break;
        case 'go':
          this.tone({ type: 'square', f0: 880, dur: 0.4, vol: 0.42, cutoff: 3600 });
          this.tone({ type: 'triangle', f0: 440, dur: 0.4, vol: 0.3 });
          break;
        case 'checkpoint': this.notes(JINGLES.checkpoint, 'square', 0.3); break;
        case 'crash':
          this.noise({ dur: 0.42, type: 'lowpass', f0: 3600, f1: 180, q: 1.2, vol: 0.9 });
          this.tone({ type: 'sine', f0: 150, f1: 42, dur: 0.4, vol: 0.9, attack: 0.003 });
          this.tone({ type: 'sawtooth', f0: 90, f1: 38, dur: 0.3, vol: 0.28, cutoff: 500 });
          break;
        case 'goal':
          this.notes(JINGLES.goal, 'sawtooth', 0.26, this.sfxBus, t, 3000);
          this.noise({ t: t + 1.1, dur: 0.5, type: 'highpass', f0: 6000, vol: 0.05 });
          break;
        case 'timeup': this.notes(JINGLES.timeup, 'sawtooth', 0.3, this.sfxBus, t, 1800); break;
        case 'menu':
          this.tone({ type: 'square', f0: 660, f1: 1100, dur: 0.09, vol: 0.32, cutoff: 3600 });
          break;
        case 'overtake':
          this.noise({ dur: 0.2, type: 'bandpass', f0: 700, f1: 3400, q: 1.4, vol: 0.28 });
          this.tone({ type: 'triangle', f0: 1300, f1: 1900, dur: 0.09, vol: 0.14 });
          break;
        case 'nearmiss':
          this.tone({ type: 'square', f0: 1200, dur: 0.06, vol: 0.2, cutoff: 3600 });
          this.tone({ type: 'square', f0: 1800, t: t + 0.07, dur: 0.12, vol: 0.2, cutoff: 3600 });
          break;
        case 'timewarn': this.tone({ type: 'square', f0: 1500, dur: 0.05, vol: 0.22, cutoff: 3600 }); break;
        case 'jingle': this.notes(JINGLES.title, 'square', 0.26, this.sfxBus, t, 3200); break;
        default: break;
      }
    } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------------------ engine
  startEngine() {
    if (!this.ctx || this.engine) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    lp.Q.value = 2.4;
    const mk = (type, gain, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g);
      g.connect(lp);
      o.frequency.value = 60;
      o.start();
      return o;
    };
    const o1 = mk('sawtooth', 0.5);
    const o2 = mk('square', 0.3);
    const o3 = mk('sawtooth', 0.32, 11);
    const o4 = mk('square', 0.12);
    lp.connect(out);
    out.connect(this.engineBus);
    this.engine = { o: [o1, o2, o3, o4], lp, out };
    this.setEngine(60, 0);
  }

  // hzVal = base frequency (60 + 140 * sp), sp = speed / max speed
  setEngine(hzVal, sp) {
    this.engineHz = hzVal;
    const e = this.engine;
    if (!e) return;
    const t = this.ctx.currentTime;
    e.o[0].frequency.setTargetAtTime(hzVal, t, 0.03);
    e.o[1].frequency.setTargetAtTime(hzVal * 0.5, t, 0.03);
    e.o[2].frequency.setTargetAtTime(hzVal * 1.006, t, 0.03);
    e.o[3].frequency.setTargetAtTime(hzVal * 2, t, 0.03);
    e.lp.frequency.setTargetAtTime(420 + 2600 * sp, t, 0.06);
    e.out.gain.setTargetAtTime(0.05 + 0.07 * sp, t, 0.05);
  }

  stopEngine() {
    this.engineHz = 0;
    const e = this.engine;
    if (!e) return;
    this.engine = null;
    const t = this.ctx.currentTime;
    e.out.gain.cancelScheduledValues(t);
    e.out.gain.setTargetAtTime(0, t, 0.04);
    for (const o of e.o) { try { o.stop(t + 0.3); } catch (err) { /* already stopped */ } }
  }

  setOffroad(on, sp = 0.3) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this.off) {
      const s = ctx.createBufferSource();
      s.buffer = this.noiseBuf;
      s.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 0.6;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      const g = ctx.createGain();
      g.gain.value = 0;
      // crunchy amplitude wobble
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 23;
      const lg = ctx.createGain();
      lg.gain.value = 0.35;
      lfo.connect(lg);
      const wob = ctx.createGain();
      wob.gain.value = 0.65;
      lg.connect(wob.gain);
      s.connect(bp);
      bp.connect(lp);
      lp.connect(wob);
      wob.connect(g);
      g.connect(this.sfxBus);
      s.start();
      lfo.start();
      this.off = { s, g, lfo };
    }
    const t = ctx.currentTime;
    this.off.g.gain.setTargetAtTime(on ? 0.34 * (0.4 + 0.6 * sp) : 0, t, 0.05);
  }

  // ------------------------------------------------------------------ BGM sequencer
  startBgm(id) {
    this.stopBgm(true);
    this.bgm = id;
    if (!this.ctx || !SONGS[id]) return;
    const ctx = this.ctx;
    const song = SONGS[id];
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(this.bgmBus);
    // lead bus with optional echo
    const lead = ctx.createGain();
    lead.gain.value = 1;
    lead.connect(out);
    if (song.echo > 0) {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = (60 / song.bpm) * 0.75; // dotted eighth
      const fb = ctx.createGain();
      fb.gain.value = 0.38;
      const wet = ctx.createGain();
      wet.gain.value = song.echo;
      const damp = ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 2400;
      lead.connect(delay);
      delay.connect(damp);
      damp.connect(fb);
      fb.connect(delay);
      damp.connect(wet);
      wet.connect(out);
    }
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.4;
    const vg = ctx.createGain();
    vg.gain.value = 9;
    vib.connect(vg);
    vib.start();
    const inst = { id, song, out, lead, vib, vg, step: 0, next: ctx.currentTime + 0.08, timer: 0 };
    this.inst = inst;
    inst.timer = setInterval(() => this.pump(inst), 25);
    this.pump(inst);
  }

  stopBgm(silent = false) {
    if (!silent) this.bgm = null;
    const inst = this.inst;
    if (!inst) return;
    this.inst = null;
    clearInterval(inst.timer);
    if (this.ctx) {
      const t = this.ctx.currentTime;
      inst.out.gain.cancelScheduledValues(t);
      inst.out.gain.setTargetAtTime(0, t, 0.03);
      try { inst.vib.stop(t + 0.5); } catch (e) { /* ignore */ }
      setTimeout(() => { try { inst.out.disconnect(); } catch (e) { /* ignore */ } }, 600);
    }
  }

  pump(inst, until = null) {
    const ctx = this.ctx;
    if (!ctx) return;
    const horizon = until !== null ? until : ctx.currentTime + 0.2;
    let guard = 0;
    while (inst.next < horizon && guard++ < 64) {
      this.playStep(inst, inst.step, inst.next);
      inst.next += inst.song.stepDur;
      inst.step = (inst.step + 1) % inst.song.totalSteps;
    }
  }

  playStep(inst, step, t) {
    const song = inst.song;
    const events = song.steps[step];
    const sd = song.stepDur;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      switch (e.p) {
        case 'lead': this.voiceLead(inst, t, e.m, e.len * sd, e.v); break;
        case 'bass': this.voiceBass(inst, t, e.m, e.len * sd); break;
        case 'pad': this.voicePad(inst, t, e.m, e.len * sd); break;
        case 'stab': for (const m of e.m) this.voicePluck(inst, t, m, sd * 0.9, 0.075, 'square', 2200); break;
        case 'arp': this.voicePluck(inst, t, e.m, sd * 1.1, (e.loud ? 0.1 : 0.06) * e.v, e.wave, e.loud ? 2600 : 2000); break;
        case 'kick': this.drumKick(inst, t, e.v); break;
        case 'snare': this.drumSnare(inst, t, e.v); break;
        case 'hat': this.drumHat(inst, t, 0.035, 0.17 * e.v); break;
        case 'ohat': this.drumHat(inst, t, 0.13, 0.14); break;
        default: break;
      }
    }
  }

  voiceLead(inst, t, m, dur, v) {
    const ctx = this.ctx;
    const f = hz(m);
    const wave = inst.song.leadWave;
    const vol = (wave === 'sawtooth' ? 0.12 : 0.15) * v;
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = f;
    o2.detune.value = 7;
    inst.vg.connect(o.detune);
    inst.vg.connect(o2.detune);
    const g2 = ctx.createGain();
    g2.gain.value = 0.6;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = wave === 'sawtooth' ? 2300 : 3400;
    const g = ctx.createGain();
    const end = t + Math.max(0.06, dur * 0.94);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(vol * 0.62, t + Math.min(0.1, dur * 0.5));
    g.gain.setValueAtTime(vol * 0.62, end);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.06);
    o.connect(lp);
    o2.connect(g2);
    g2.connect(lp);
    lp.connect(g);
    g.connect(inst.lead);
    o.start(t);
    o2.start(t);
    o.stop(end + 0.1);
    o2.stop(end + 0.1);
    o.onended = () => { try { inst.vg.disconnect(o.detune); inst.vg.disconnect(o2.detune); } catch (e) { /* ignore */ } };
  }

  voiceBass(inst, t, m, dur) {
    const ctx = this.ctx;
    const f = hz(m);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.value = f;
    o2.detune.value = -6;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 3;
    lp.frequency.setValueAtTime(1500, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.14);
    const g = ctx.createGain();
    const end = t + Math.max(0.05, dur * 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.005);
    g.gain.setValueAtTime(0.3, end);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.05);
    const gs = ctx.createGain();
    gs.gain.value = 0.55;
    o.connect(lp);
    o2.connect(gs);
    gs.connect(lp);
    lp.connect(g);
    g.connect(inst.out);
    o.start(t);
    o2.start(t);
    o.stop(end + 0.08);
    o2.stop(end + 0.08);
  }

  voicePad(inst, t, notes, dur) {
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + 0.25);
    g.gain.setValueAtTime(1, t + dur - 0.05);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
    lp.connect(g);
    g.connect(inst.out);
    for (const m of notes) {
      for (const det of [-8, 8]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(m);
        o.detune.value = det;
        const vg = ctx.createGain();
        vg.gain.value = 0.026;
        o.connect(vg);
        vg.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.4);
      }
    }
  }

  voicePluck(inst, t, m, dur, vol, wave, cutoff) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = hz(m);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(cutoff, t);
    lp.frequency.exponentialRampToValueAtTime(cutoff * 0.3, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp);
    lp.connect(g);
    g.connect(inst.lead);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  drumKick(inst, t, v) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.85 * v, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g);
    g.connect(inst.out);
    o.start(t);
    o.stop(t + 0.25);
    this.noise({ t, dur: 0.012, type: 'lowpass', f0: 1800, vol: 0.2 * v, dest: inst.out });
  }

  drumSnare(inst, t, v) {
    this.noise({ t, dur: 0.17, type: 'bandpass', f0: 1900, q: 0.9, vol: 0.5 * v, dest: inst.out });
    this.tone({ type: 'triangle', f0: 200, f1: 120, t, dur: 0.1, vol: 0.32 * v, dest: inst.out });
  }

  drumHat(inst, t, dur, vol) {
    this.noise({ t, dur, type: 'highpass', f0: 7000, q: 0.7, vol, dest: inst.out });
  }

  // ------------------------------------------------------------------ gallery previews
  preview(id) {
    if (!this.ctx) return;
    const t = this.now();
    if (id.startsWith('bgm_')) {
      this.startBgm(id);
      setTimeout(() => { if (this.bgm === id) this.stopBgm(); }, 3000);
      return;
    }
    switch (id) {
      case 'sfx_engine': {
        this.startEngine();
        const t0 = performance.now();
        const id2 = setInterval(() => {
          const k = Math.min(1, (performance.now() - t0) / 2600);
          this.setEngine(60 + 140 * k, k);
          if (k >= 1) { clearInterval(id2); setTimeout(() => this.stopEngine(), 400); }
        }, 30);
        break;
      }
      case 'sfx_beep': this.sfx('beep'); break;
      case 'sfx_go': this.sfx('go'); break;
      case 'sfx_checkpoint': this.sfx('checkpoint'); break;
      case 'sfx_crash': this.sfx('crash'); break;
      case 'sfx_goal': this.sfx('goal'); break;
      case 'sfx_timeup': this.sfx('timeup'); break;
      case 'sfx_menu': this.sfx('menu'); break;
      case 'sfx_overtake': this.sfx('overtake'); break;
      case 'sfx_timewarn': this.sfx('timewarn'); break;
      case 'jingle_title': this.sfx('jingle'); break;
      case 'sfx_offroad':
        this.setOffroad(true, 0.8);
        setTimeout(() => this.setOffroad(false), 1500);
        break;
      default: break;
    }
    return t;
  }

  // Offline render helper used by the verification page (gallery): schedules `seconds` of a BGM into an
  // OfflineAudioContext and resolves with basic level statistics.
  static async measureBgm(id, seconds = 20) {
    const OC = window.OfflineAudioContext;
    const rate = 44100;
    const ctx = new OC(2, rate * seconds, rate);
    const eng = new AudioEngine({ muted: false });
    eng.init(ctx);
    // schedule everything up-front (the offline clock does not advance during scheduling)
    eng.bgm = id;
    const song = SONGS[id];
    const out = ctx.createGain();
    out.connect(eng.bgmBus);
    const lead = ctx.createGain();
    lead.connect(out);
    if (song.echo > 0) {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = (60 / song.bpm) * 0.75;
      const fb = ctx.createGain();
      fb.gain.value = 0.38;
      const wet = ctx.createGain();
      wet.gain.value = song.echo;
      lead.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(out);
    }
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.4;
    const vg = ctx.createGain();
    vg.gain.value = 9;
    vib.connect(vg);
    vib.start();
    const inst = { id, song, out, lead, vib, vg, step: 0, next: 0.05 };
    eng.inst = inst;
    eng.pump(inst, seconds);
    const buf = await ctx.startRendering();
    let peak = 0;
    let sum = 0;
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
      sum += d[i] * d[i];
    }
    return { id, peak, rms: Math.sqrt(sum / d.length), seconds };
  }
}
