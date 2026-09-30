// All sound is synthesised with the Web Audio API. No audio files.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ------------------------------------------------------------------ songs
// A song: { bpm, steps (16ths), parts: [...] }. Each part yields note events
// { step, midi, len (16ths), gain } or drum hits.

function chordBass(roots, pattern) {
  const out = [];
  roots.forEach((root, bar) => {
    pattern.forEach(([s, off, len, g]) => out.push({ step: bar * 16 + s, midi: root + off, len, gain: g || 1 }));
  });
  return out;
}

function melody(list) {
  // list: [step, midi, len]
  return list.map(([step, midi, len]) => ({ step, midi, len, gain: 1 }));
}

const N = { C2: 36, D2: 38, E2: 40, F2: 41, G2: 43, A2: 45, B2: 47, C3: 48, D3: 50, E3: 52, F3: 53, G3: 55, A3: 57, B3: 59,
  C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83, C6: 84 };

const SONGS = {
  bgm_1: {
    bpm: 128,
    steps: 128,
    parts: [
      {
        wave: 'sawtooth', gain: 0.5, cutoff: 900, decay: 0.12,
        notes: chordBass([N.C2, N.G2, N.A2, N.F2, N.C2, N.G2, N.A2, N.F2],
          [[0, 0, 2], [2, 0, 2], [4, 12, 2], [6, 0, 2], [8, 0, 2], [10, 7, 2], [12, 12, 2], [14, 7, 2]]),
      },
      {
        wave: 'square', gain: 0.22, cutoff: 3200, decay: 0.3, vibrato: true,
        notes: melody([
          [0, 76, 2], [2, 79, 2], [4, 81, 4], [8, 79, 2], [10, 76, 2], [12, 74, 4],
          [16, 74, 4], [20, 71, 2], [22, 74, 2], [24, 79, 6],
          [32, 81, 2], [34, 84, 2], [36, 83, 4], [40, 81, 2], [42, 79, 2], [44, 76, 4],
          [48, 77, 4], [52, 81, 2], [54, 79, 2], [56, 77, 4], [60, 74, 4],
          [64, 76, 2], [66, 79, 2], [68, 84, 4], [72, 83, 2], [74, 79, 2], [76, 81, 4],
          [80, 79, 4], [84, 74, 2], [86, 76, 2], [88, 79, 6],
          [96, 81, 2], [98, 79, 2], [100, 76, 4], [104, 72, 2], [106, 74, 2], [108, 76, 4],
          [112, 77, 4], [116, 76, 2], [118, 74, 2], [120, 72, 8],
        ]),
      },
      {
        wave: 'triangle', gain: 0.16, cutoff: 2000, decay: 0.15,
        notes: (() => {
          const chords = [[60, 64, 67], [59, 62, 67], [60, 64, 69], [60, 65, 69], [60, 64, 67], [59, 62, 67], [60, 64, 69], [60, 65, 69]];
          const out = [];
          chords.forEach((ch, bar) => [2, 6, 10, 14].forEach((s) => ch.forEach((m) => out.push({ step: bar * 16 + s, midi: m, len: 1, gain: 1 }))));
          return out;
        })(),
      },
      { drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12], ohat: [14] } },
    ],
  },
  bgm_2: {
    bpm: 138,
    steps: 128,
    parts: [
      {
        wave: 'sawtooth', gain: 0.45, cutoff: 700, decay: 0.09,
        notes: chordBass([N.A2, N.F2, N.C3, N.E2, N.A2, N.F2, N.D2, N.E2],
          [[0, 0, 1], [1, 0, 1], [2, 0, 1], [3, 12, 1], [4, 0, 1], [5, 0, 1], [6, 0, 1], [7, 12, 1],
            [8, 0, 1], [9, 0, 1], [10, 0, 1], [11, 12, 1], [12, 0, 1], [13, 0, 1], [14, 7, 1], [15, 12, 1]]),
      },
      {
        wave: 'square', gain: 0.2, cutoff: 2800, decay: 0.25, vibrato: true,
        notes: melody([
          [0, 69, 3], [3, 72, 3], [6, 76, 2], [8, 74, 4], [12, 72, 4],
          [16, 77, 6], [22, 76, 2], [24, 74, 4], [28, 72, 4],
          [32, 76, 3], [35, 79, 3], [38, 76, 2], [40, 74, 4], [44, 72, 2], [46, 71, 2],
          [48, 71, 4], [52, 68, 4], [56, 76, 8],
          [64, 81, 3], [67, 79, 3], [70, 76, 2], [72, 74, 4], [76, 72, 4],
          [80, 81, 6], [86, 79, 2], [88, 77, 4], [92, 76, 4],
          [96, 74, 3], [99, 77, 3], [102, 81, 2], [104, 79, 4], [108, 77, 4],
          [112, 76, 4], [116, 74, 4], [120, 71, 8],
        ]),
      },
      {
        wave: 'sawtooth', gain: 0.07, cutoff: 1200, decay: 1.2, attack: 0.15,
        notes: (() => {
          const chords = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [52, 56, 59], [57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]];
          const out = [];
          chords.forEach((ch, bar) => ch.forEach((m) => out.push({ step: bar * 16, midi: m, len: 15, gain: 1 })));
          return out;
        })(),
      },
      { drums: { kick: [0, 4, 8, 10, 12], snare: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], ohat: [] } },
    ],
  },
  bgm_3: {
    bpm: 152,
    steps: 128,
    parts: [
      {
        wave: 'square', gain: 0.55, cutoff: 600, decay: 0.1,
        notes: chordBass([N.E2, N.C2, N.G2, N.D2, N.E2, N.C2, N.A2, N.B2],
          [[0, 0, 2], [2, 0, 2], [4, 0, 2], [6, 0, 2], [8, 0, 2], [10, 0, 2], [12, 0, 2], [14, 0, 2]]),
      },
      {
        wave: 'square', gain: 0.15, cutoff: 2600, decay: 0.08,
        notes: (() => {
          const chords = [[52, 55, 59], [48, 52, 55], [55, 59, 62], [50, 54, 57], [52, 55, 59], [48, 52, 55], [45, 48, 52], [47, 51, 54]];
          const seq = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1, 2, 3];
          const out = [];
          chords.forEach((ch, bar) => {
            const notes = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24, ch[1] + 24];
            seq.forEach((ix, s) => out.push({ step: bar * 16 + s, midi: notes[ix], len: 1, gain: s % 4 === 0 ? 1 : 0.7 }));
          });
          return out;
        })(),
      },
      {
        wave: 'sawtooth', gain: 0.14, cutoff: 1800, decay: 0.6, vibrato: true, attack: 0.03,
        notes: melody([
          [0, 71, 8], [8, 67, 8], [16, 76, 12], [28, 74, 4], [32, 74, 8], [40, 71, 8], [48, 69, 8], [56, 66, 8],
          [64, 79, 8], [72, 76, 8], [80, 72, 8], [88, 76, 8], [96, 69, 4], [100, 72, 4], [104, 76, 8], [112, 78, 8], [120, 75, 8],
        ]),
      },
      { drums: { kick: [0, 4, 8, 12], snare: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], ohat: [14] } },
    ],
  },
};

export const SOUND_IDS = ['bgm_1', 'bgm_2', 'bgm_3', 'sfx_engine', 'sfx_beep', 'sfx_go', 'sfx_checkpoint', 'sfx_crash',
  'sfx_goal', 'sfx_timeup', 'sfx_menu', 'sfx_overtake', 'sfx_offroad', 'sfx_timewarn', 'jingle_title'];

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmId = null;
    this._seq = null;
    this._eng = null;
    this._off = null;
  }

  get state() {
    return this.ctx ? this.ctx.state : 'none';
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const mk = (g, dest) => { const n = ctx.createGain(); n.gain.value = g; n.connect(dest); return n; };
    this.master = mk(this.muted ? 0 : 0.5, ctx.destination);
    this.bgmBus = mk(0.35, this.master);
    this.sfxBus = mk(0.6, this.master);
    this.engBus = mk(0.4, this.master);
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // ---------------------------------------------------------------- engine
  startEngine() {
    if (!this.ctx || this._eng) return;
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 1.6;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 120;
    const o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = 30;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    const g3 = ctx.createGain(); g3.gain.value = 0.6;
    o1.connect(f); o2.connect(g2); g2.connect(f); o3.connect(g3); g3.connect(f);
    f.connect(g); g.connect(this.engBus);
    o1.start(); o2.start(); o3.start();
    this._eng = { o1, o2, o3, f, g };
    // offroad gravel loop (gain 0 until needed)
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const lf = ctx.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 520;
    const og = ctx.createGain(); og.gain.value = 0;
    src.connect(lf); lf.connect(og); og.connect(this.sfxBus);
    src.start();
    this._off = { src, og };
  }

  setEngine(sp, offroad) {
    if (!this._eng) return;
    const t = this.ctx.currentTime;
    const hz = 60 + 140 * sp;
    const e = this._eng;
    e.o1.frequency.setTargetAtTime(hz, t, 0.03);
    e.o2.frequency.setTargetAtTime(hz * 2.005, t, 0.03);
    e.o3.frequency.setTargetAtTime(hz * 0.5, t, 0.03);
    e.f.frequency.setTargetAtTime(300 + 2400 * sp, t, 0.05);
    e.g.gain.setTargetAtTime(0.05 + 0.07 * sp, t, 0.05);
    if (this._off) this._off.og.gain.setTargetAtTime(offroad && sp > 0.02 ? 0.25 : 0, t, 0.05);
  }

  stopEngine() {
    if (!this._eng) return;
    const e = this._eng;
    try { e.o1.stop(); e.o2.stop(); e.o3.stop(); } catch (_) { /* already stopped */ }
    e.g.disconnect();
    this._eng = null;
    if (this._off) { try { this._off.src.stop(); } catch (_) { /* noop */ } this._off.og.disconnect(); this._off = null; }
  }

  // ---------------------------------------------------------------- bgm
  playBgm(id) {
    if (!this.ctx || !SONGS[id]) return;
    if (this.bgmId === id) return;
    this.stopBgm();
    const ctx = this.ctx;
    const song = SONGS[id];
    const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(this.bgmBus);
    const seq = { id, song, bus, step: 0, next: ctx.currentTime + 0.05, stepDur: 60 / song.bpm / 4, timer: 0 };
    const tick = () => {
      while (seq.next < ctx.currentTime + 0.12) {
        this._scheduleStep(seq, seq.step, seq.next);
        seq.step = (seq.step + 1) % song.steps;
        seq.next += seq.stepDur;
      }
    };
    seq.timer = setInterval(tick, 30);
    tick();
    this._seq = seq;
    this.bgmId = id;
  }

  stopBgm() {
    if (!this._seq) return;
    const s = this._seq;
    clearInterval(s.timer);
    const t = this.ctx.currentTime;
    s.bus.gain.setTargetAtTime(0, t, 0.03);
    setTimeout(() => s.bus.disconnect(), 400);
    this._seq = null;
    this.bgmId = null;
  }

  _scheduleStep(seq, step, t) {
    const { song, bus, stepDur } = seq;
    for (const part of song.parts) {
      if (part.drums) {
        const bar = step % 16;
        if (part.drums.kick.includes(bar)) this._kick(t, bus);
        if (part.drums.snare.includes(bar)) this._snare(t, bus);
        if (part.drums.hat.includes(bar)) this._hat(t, bus, false, bar % 2 ? 0.5 : 1);
        if (part.drums.ohat.includes(bar)) this._hat(t, bus, true, 1);
        continue;
      }
      for (const n of part.notes) {
        if (n.step !== step) continue;
        this._tone(bus, part.wave, mtof(n.midi), t, n.len * stepDur, part.gain * n.gain, part);
      }
    }
  }

  _tone(dest, wave, freq, t, dur, gain, opt = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = wave; o.frequency.value = freq;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opt.cutoff || 4000;
    const g = ctx.createGain();
    const a = opt.attack || 0.005, dec = opt.decay || 0.1;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + a);
    g.gain.setTargetAtTime(gain * 0.55, t + a, dec);
    g.gain.setTargetAtTime(0, t + dur, 0.03);
    o.connect(f); f.connect(g); g.connect(dest);
    if (opt.vibrato) {
      const l = ctx.createOscillator(); l.frequency.value = 5.5;
      const lg = ctx.createGain(); lg.gain.value = freq * 0.006;
      l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.3);
    }
    o.start(t); o.stop(t + dur + 0.3);
  }

  _noiseBurst(dest, t, dur, gain, type, freq, q = 1) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t); s.stop(t + dur + 0.05);
  }

  _kick(t, dest) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 0.25);
  }

  _snare(t, dest) {
    this._noiseBurst(dest, t, 0.16, 0.45, 'bandpass', 1800, 0.8);
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.12);
  }

  _hat(t, dest, open, vel) {
    this._noiseBurst(dest, t, open ? 0.18 : 0.04, 0.18 * vel, 'highpass', 7000);
  }

  // ---------------------------------------------------------------- sfx
  play(id) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const d = this.sfxBus;
    switch (id) {
      case 'sfx_beep': this._tone(d, 'square', 440, t, 0.15, 0.4, { decay: 0.4 }); break;
      case 'sfx_go': this._tone(d, 'square', 880, t, 0.4, 0.4, { decay: 0.6 }); break;
      case 'sfx_checkpoint':
        [[0, 784], [0.09, 988], [0.18, 1319]].forEach(([dt, f]) => this._tone(d, 'triangle', f, t + dt, 0.14, 0.5, { decay: 0.3 }));
        this._tone(d, 'square', 1319, t + 0.3, 0.25, 0.25, { decay: 0.3 });
        break;
      case 'sfx_crash': {
        this._noiseBurst(d, t, 0.4, 0.8, 'lowpass', 1200);
        const o = this.ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.4);
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        o.connect(g); g.connect(d); o.start(t); o.stop(t + 0.42);
        break;
      }
      case 'sfx_goal':
        [[0, 523, 0.12], [0.12, 659, 0.12], [0.24, 784, 0.12], [0.36, 1047, 0.3], [0.7, 784, 0.12], [0.82, 1047, 0.6]]
          .forEach(([dt, f, len]) => {
            this._tone(d, 'square', f, t + dt, len, 0.35, { decay: 0.5 });
            this._tone(d, 'triangle', f / 2, t + dt, len, 0.35, { decay: 0.5 });
          });
        break;
      case 'sfx_timeup':
        [880, 740, 622, 523, 440, 370].forEach((f, i) => this._tone(d, 'sawtooth', f, t + i * 0.14, 0.13, 0.35, { cutoff: 2500, decay: 0.3 }));
        break;
      case 'sfx_menu': this._tone(d, 'square', 1200, t, 0.05, 0.3, { decay: 0.1 }); this._tone(d, 'square', 1600, t + 0.05, 0.05, 0.25, { decay: 0.1 }); break;
      case 'sfx_overtake': this._noiseBurst(d, t, 0.14, 0.35, 'bandpass', 3200, 2); this._tone(d, 'square', 1800, t, 0.04, 0.15); break;
      case 'sfx_timewarn': this._tone(d, 'square', 1000, t, 0.03, 0.35, { decay: 0.05 }); break;
      case 'sfx_offroad': this._noiseBurst(d, t, 1.5, 0.25, 'lowpass', 520); break;
      case 'jingle_title':
        [[0, 523], [0.08, 659], [0.16, 784], [0.24, 1047], [0.32, 1319], [0.4, 1568]]
          .forEach(([dt, f]) => this._tone(d, 'triangle', f, t + dt, 0.1, 0.4, { decay: 0.3 }));
        this._tone(d, 'square', 2093, t + 0.5, 0.5, 0.25, { decay: 0.6, vibrato: true });
        break;
      case 'sfx_engine': {
        // 3 second preview of the engine revving up
        this.startEngine();
        const e = this._eng; if (!e) break;
        const steps = 30;
        for (let i = 0; i <= steps; i++) setTimeout(() => this.setEngine(i / steps, false), i * 100);
        setTimeout(() => this.stopEngine(), 3100);
        break;
      }
      default: break;
    }
  }
}
