// Web Audio による合成 BGM / 効果音 / エンジン音(音声ファイルは使わない)
const NOTE_IDX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function nn(name) {
  const m = /^([A-G]#?)(\d)$/.exec(name);
  return m ? 12 * (parseInt(m[2], 10) + 1) + NOTE_IDX[m[1]] : null;
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const melody = (s) => s.trim().split(/\s+/);

const SONGS = {
  // SEASIDE: 128 BPM 長調・4 つ打ち
  bgm_1: {
    bpm: 128, leadWave: 'square', bassWave: 'sawtooth', stab: true, arp: null,
    bass: ['D2', 'A1', 'B1', 'G1', 'D2', 'A1', 'G1', 'A1'],
    chordRoot: [62, 57, 59, 55, 62, 57, 55, 57], chordType: ['M', 'M', 'm', 'M', 'M', 'M', 'M', 'M'],
    bassPat: [0, 0, 12, 0, 0, 12, 7, 0],
    lead: [
      'A5 - F#5 A5 B5 - A5 F#5', 'E5 - E5 F#5 E5 - C#5 -', 'D5 - F#5 B5 A5 - F#5 D5', 'E5 - G5 B5 A5 G5 E5 -',
      'F#5 A5 D6 - B5 A5 F#5 -', 'E5 G5 A5 - C#6 - B5 A5', 'G5 - B5 D6 B5 A5 G5 E5', 'A5 - - - E5 F#5 G5 A5',
    ],
    kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], openHat: [6, 14],
  },
  // PINE RIDGE: 138 BPM 短調
  bgm_2: {
    bpm: 138, leadWave: 'sawtooth', bassWave: 'square', stab: false, arp: 'soft',
    bass: ['A1', 'F1', 'C2', 'G1', 'A1', 'F1', 'G1', 'E1'],
    chordRoot: [57, 53, 60, 55, 57, 53, 55, 52], chordType: ['m', 'M', 'M', 'M', 'm', 'M', 'M', 'M'],
    bassPat: [0, 0, 12, 0, 7, 0, 12, 0],
    lead: [
      'A5 - C6 - B5 - A5 E5', 'F5 - A5 - C6 - A5 F5', 'E5 - G5 - E6 - D6 C6', 'B5 - D6 - B5 - G5 D5',
      'A5 - C6 E6 D6 C6 B5 A5', 'C6 - A5 F5 A5 - C6 -', 'D6 - B5 G5 B5 D6 - G5', 'G#5 - B5 - E6 - D6 B5',
    ],
    kick: [0, 6, 8, 11], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], openHat: [14],
  },
  // NEON CITY: 152 BPM アルペジオ主体
  bgm_3: {
    bpm: 152, leadWave: 'sawtooth', bassWave: 'sawtooth', stab: false, arp: 'main',
    bass: ['E2', 'C2', 'G2', 'D2', 'E2', 'C2', 'D2', 'B1'],
    chordRoot: [64, 60, 67, 62, 64, 60, 62, 59], chordType: ['m', 'M', 'M', 'M', 'm', 'M', 'M', 'M'],
    bassPat: [0, 0, 12, 0, 0, 12, 0, 12],
    lead: [
      'B5 - - - E6 - G6 -', 'E6 - - - D6 - C6 -', 'D6 - B5 - G5 - B5 D6', 'A5 - F#5 - A5 - D6 -',
      'B5 - E6 - G6 - F#6 E6', 'E6 - G6 - E6 - C6 -', 'D6 - F#6 - A6 - F#6 D6', 'D#6 - F#6 - B6 - A6 F#6',
    ],
    kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14, 15], openHat: [2, 10],
  },
};

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmId = null;
    this.engineHz = 0;
    this.userSuspended = false;
    this.bgmTimer = null;
    this.bgmRun = null;
    this.offroadOn = false;
  }
  get state() { return this.ctx ? this.ctx.state : 'none'; }

  // ユーザー操作の中で呼ぶ
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { this.ctx = new AC(); } catch (e) { return null; }
      const c = this.ctx;
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.ratio.value = 4;
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.comp.connect(this.master); this.master.connect(c.destination);
      this.bgmBus = c.createGain(); this.bgmBus.gain.value = 0.35; this.bgmBus.connect(this.comp);
      this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.6; this.sfxBus.connect(this.comp);
      this.engBus = c.createGain(); this.engBus.gain.value = 0.4; this.engBus.connect(this.comp);
      // ノイズバッファ
      const len = c.sampleRate * 2;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.buildEngine();
      this.buildOffroad();
      if (this.bgmId) this.startScheduler();
    }
    if (this.ctx.state === 'suspended' && !this.userSuspended) this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.01);
  }
  suspend() {
    this.userSuspended = true;
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }
  resume() {
    this.userSuspended = false;
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  // ---- エンジン ----
  buildEngine() {
    const c = this.ctx;
    this.eng = {
      o1: c.createOscillator(), o2: c.createOscillator(), o2g: c.createGain(),
      lp: c.createBiquadFilter(), g: c.createGain(),
    };
    const e = this.eng;
    e.o1.type = 'sawtooth'; e.o2.type = 'square';
    e.o1.frequency.value = 60; e.o2.frequency.value = 60.6;
    e.o2g.gain.value = 0.5;
    e.lp.type = 'lowpass'; e.lp.frequency.value = 500; e.lp.Q.value = 2;
    e.g.gain.value = 0;
    e.o1.connect(e.lp); e.o2.connect(e.o2g); e.o2g.connect(e.lp); e.lp.connect(e.g); e.g.connect(this.engBus);
    e.o1.start(); e.o2.start();
  }
  // active=false のときは停止(無音・engineHz=0)
  setEngine(sp, active) {
    if (!active) { this.engineHz = 0; if (this.eng) this.eng.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03); return; }
    const hz = 60 + 140 * sp;
    this.engineHz = hz;
    if (!this.eng) return;
    const t = this.ctx.currentTime;
    this.eng.o1.frequency.setTargetAtTime(hz, t, 0.03);
    this.eng.o2.frequency.setTargetAtTime(hz * 1.01, t, 0.03);
    this.eng.lp.frequency.setTargetAtTime(350 + 1600 * sp, t, 0.05);
    this.eng.g.gain.setTargetAtTime(0.05 + 0.07 * sp, t, 0.03);
  }
  buildOffroad() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 200;
    const g = c.createGain(); g.gain.value = 0;
    src.connect(lp); lp.connect(hp); hp.connect(g); g.connect(this.sfxBus);
    src.start();
    this.offG = g;
  }
  setOffroad(on, sp = 0.5) {
    if (!this.ctx) return;
    this.offroadOn = on;
    this.offG.gain.setTargetAtTime(on ? 0.25 + 0.35 * sp : 0, this.ctx.currentTime, 0.05);
  }

  // ---- 基本発音 ----
  tone(t, freq, dur, wave, vol, dest, o = {}) {
    const c = this.ctx;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
    if (o.vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = 5.5; lg.gain.value = freq * 0.008;
      l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.1);
    }
    const atk = o.atk ?? 0.005, rel = o.rel ?? 0.04;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.setValueAtTime(vol, Math.max(t + atk, t + dur - rel));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) {
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q ?? 0.7;
      osc.connect(f); node = f;
    }
    node.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  noise(t, dur, vol, dest, type, freq, o = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = o.q ?? 0.7;
    if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.02);
  }
  kick(t, v = 0.7) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(this.bgmRun ? this.bgmRun.gain : this.bgmBus);
    o.start(t); o.stop(t + 0.2);
  }

  // ---- BGM ----
  playBgm(id) {
    this.stopBgm();
    this.bgmId = id;
    if (this.ctx) this.startScheduler();
  }
  stopBgm() {
    this.bgmId = null;
    if (this.bgmTimer) { clearInterval(this.bgmTimer); this.bgmTimer = null; }
    if (this.bgmRun && this.ctx) {
      const r = this.bgmRun;
      r.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      r.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      setTimeout(() => { try { r.gain.disconnect(); } catch (e) { /* noop */ } }, 400);
    }
    this.bgmRun = null;
  }
  startScheduler() {
    const song = SONGS[this.bgmId];
    if (!song || !this.ctx) return;
    const c = this.ctx;
    const gain = c.createGain();
    gain.gain.value = 1;
    gain.connect(this.bgmBus);
    const run = { gain, song, step: 0, next: c.currentTime + 0.06, id: this.bgmId };
    this.bgmRun = run;
    const stepDur = 60 / song.bpm / 4;
    const tick = () => {
      if (this.bgmRun !== run) return;
      while (run.next < c.currentTime + 0.18) {
        this.scheduleStep(run, run.step, run.next, stepDur);
        run.next += stepDur;
        run.step++;
      }
    };
    tick();
    this.bgmTimer = setInterval(tick, 30);
  }
  scheduleStep(run, step, t, sd) {
    const s = run.song, dest = run.gain;
    const bars = 16;
    const bar = Math.floor(step / 16) % bars, i16 = step % 16;
    const phrase = bar % 8, second = bar >= 8;
    // ドラム
    if (s.kick.includes(i16)) this.kick(t, 0.6);
    if (s.snare.includes(i16)) {
      this.noise(t, 0.14, 0.32, dest, 'highpass', 1800);
      this.tone(t, 190, 0.09, 'triangle', 0.2, dest, { slideTo: 120 });
    }
    if (phrase === 7 && i16 >= 12 && i16 !== 12) this.noise(t, 0.08, 0.22, dest, 'highpass', 1800);
    if (s.hat.includes(i16)) this.noise(t, s.openHat.includes(i16) ? 0.09 : 0.03, i16 % 4 === 0 ? 0.11 : 0.07, dest, 'highpass', 7500);
    // ベース(8 分)
    if (i16 % 2 === 0) {
      const root = nn(s.bass[phrase]);
      const off = s.bassPat[i16 / 2];
      const long = s.arp === 'main';
      this.tone(t, mtof(root + off), sd * (long ? 1.9 : 1.8), s.bassWave, 0.2, dest, { lp: 700, atk: 0.004, rel: 0.05 });
    }
    // コード(スタブ or パッド)
    const cr = s.chordRoot[phrase], ty = s.chordType[phrase];
    const third = ty === 'm' ? 3 : 4;
    if (s.stab && (i16 === 2 || i16 === 6 || i16 === 10 || i16 === 14)) {
      for (const iv of [0, third, 7]) this.tone(t, mtof(cr + iv), sd * 1.6, 'sawtooth', 0.045, dest, { lp: 2400, rel: 0.05 });
    }
    if (i16 === 0 && !s.stab) {
      for (const iv of [0, third, 7]) this.tone(t, mtof(cr + iv - 12), sd * 15.5, 'triangle', 0.05, dest, { atk: 0.05, rel: 0.2 });
    }
    // アルペジオ
    if (s.arp === 'main' || (s.arp === 'soft' && second)) {
      const notes = [0, third, 7, 12];
      const pat = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];
      const idx = pat[i16];
      const soft = s.arp === 'soft';
      this.tone(t, mtof(cr + 12 + notes[idx]), sd * 0.9, soft ? 'triangle' : 'square', soft ? 0.07 : 0.055, dest, { lp: soft ? 3000 : 3600, rel: 0.03 });
    }
    // リード(2 周目は 1 オクターブ上を重ねる)
    if (i16 % 2 === 0) {
      const tok = melody(s.lead[phrase])[i16 / 2];
      if (tok !== '-') {
        let len = 1;
        const arr = melody(s.lead[phrase]);
        for (let k = i16 / 2 + 1; k < 8 && arr[k] === '-'; k++) len++;
        const m = nn(tok);
        if (m !== null) {
          this.tone(t, mtof(m), sd * 2 * len * 0.92, s.leadWave, 0.075, dest, { lp: 3800, vib: len > 1, rel: 0.05 });
          if (second) this.tone(t, mtof(m + 12), sd * 2 * len * 0.8, 'triangle', 0.04, dest, { rel: 0.05 });
        }
      }
    }
  }

  // ---- 効果音 ----
  sfx(name) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + 0.005, d = this.sfxBus;
    switch (name) {
      case 'sfx_beep': this.tone(t, 440, 0.15, 'square', 0.3, d, { lp: 3000 }); break;
      case 'sfx_go': this.tone(t, 880, 0.4, 'square', 0.3, d, { lp: 4000, rel: 0.1 }); this.tone(t, 1320, 0.4, 'triangle', 0.15, d, { rel: 0.1 }); break;
      case 'sfx_checkpoint':
        [659.25, 783.99, 1046.5].forEach((f, i) => this.tone(t + i * 0.09, f, 0.16, 'square', 0.25, d, { lp: 4000 }));
        this.tone(t + 0.27, 1318.5, 0.3, 'triangle', 0.2, d, { rel: 0.15 });
        break;
      case 'sfx_crash':
        this.noise(t, 0.4, 0.9, d, 'lowpass', 3000, { sweepTo: 200 });
        this.tone(t, 110, 0.4, 'sine', 0.7, d, { slideTo: 38, rel: 0.2 });
        this.tone(t, 70, 0.3, 'sawtooth', 0.25, d, { slideTo: 30, lp: 300 });
        break;
      case 'sfx_goal': this.fanfare(t, d); break;
      case 'sfx_timeup':
        [523.25, 440, 349.23, 261.63, 196].forEach((f, i) => this.tone(t + i * 0.22, f, 0.28, 'sawtooth', 0.22, d, { lp: 1800, rel: 0.1 }));
        this.tone(t + 1.1, 130.8, 0.8, 'sawtooth', 0.22, d, { lp: 900, rel: 0.5, slideTo: 90 });
        break;
      case 'sfx_menu': this.tone(t, 660, 0.06, 'square', 0.25, d, { lp: 3500 }); this.tone(t + 0.06, 990, 0.1, 'square', 0.25, d, { lp: 3500 }); break;
      case 'sfx_overtake': this.tone(t, 1300, 0.06, 'square', 0.14, d, { lp: 4000 }); this.noise(t, 0.18, 0.18, d, 'bandpass', 2500, { sweepTo: 700, q: 1.2 }); break;
      case 'sfx_timewarn': this.tone(t, 1000, 0.035, 'square', 0.2, d, { lp: 4000 }); break;
      case 'jingle_title':
        [392, 493.88, 587.33, 783.99, 987.77].forEach((f, i) => this.tone(t + i * 0.08, f, 0.18, 'square', 0.18, d, { lp: 3500 }));
        this.tone(t + 0.45, 1174.66, 0.5, 'triangle', 0.2, d, { rel: 0.3 });
        break;
      case 'jingle_clear':
        [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(t + i * 0.13, f, 0.2, 'square', 0.2, d, { lp: 4000 }));
        this.tone(t + 0.95, 1568, 0.9, 'triangle', 0.22, d, { rel: 0.5 });
        break;
      case 'sfx_engine': this.setEngine(0.5, true); setTimeout(() => this.setEngine(0, false), 3000); break;
      default: break;
    }
  }
  fanfare(t, d) {
    const seq = [[523.25, 0, 0.14], [659.25, 0.14, 0.14], [783.99, 0.28, 0.14], [1046.5, 0.42, 0.4], [783.99, 0.9, 0.14], [1046.5, 1.04, 0.14], [1318.5, 1.18, 0.7]];
    for (const [f, o, dur] of seq) {
      this.tone(t + o, f, dur, 'square', 0.22, d, { lp: 4200, rel: 0.06 });
      this.tone(t + o, f / 2, dur, 'triangle', 0.22, d, { rel: 0.06 });
    }
  }
}

export const SOUND_IDS = ['bgm_1', 'bgm_2', 'bgm_3', 'sfx_engine', 'sfx_beep', 'sfx_go', 'sfx_checkpoint', 'sfx_crash', 'sfx_goal', 'sfx_timeup', 'sfx_menu', 'sfx_overtake', 'sfx_offroad', 'sfx_timewarn', 'jingle_title', 'jingle_clear'];
