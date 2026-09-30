// All sound is synthesised with Web Audio.
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Songs: 8 bars, 16 steps per bar. lead: 8th notes (number = MIDI, '-' = hold, 0 = rest)
const SONGS = {
  bgm_1: {
    bpm: 128,
    chords: [[50, 'M'], [47, 'm'], [43, 'M'], [45, 'M'], [50, 'M'], [47, 'm'], [40, 'm'], [45, 'M']],
    lead: [
      78, '-', 81, '-', 86, '-', 85, 81,
      83, '-', '-', 81, 78, '-', 74, '-',
      79, '-', 83, '-', 86, '-', 83, 79,
      81, '-', '-', '-', 76, 78, 79, 81,
      78, '-', 81, '-', 86, '-', 88, 86,
      83, '-', 86, '-', 83, 81, 78, '-',
      79, '-', 78, '-', 76, '-', 74, 76,
      73, '-', 76, '-', 81, '-', '-', 0,
    ],
    drums: 'k.h.s.h.k.hks.hh',
    bass: 'oct', arp: false, leadType: 'square',
  },
  bgm_2: {
    bpm: 138,
    chords: [[45, 'm'], [41, 'M'], [48, 'M'], [43, 'M'], [45, 'm'], [41, 'M'], [38, 'm'], [40, 'M']],
    lead: [
      76, '-', '-', 74, 72, '-', 69, '-',
      72, '-', 74, '-', 77, '-', 76, 74,
      76, '-', '-', 79, 76, '-', 72, '-',
      74, '-', 71, '-', 67, '-', 71, 74,
      81, '-', '-', 79, 76, '-', 81, '-',
      84, '-', '-', 81, 77, '-', 81, '-',
      77, '-', 76, '-', 74, '-', 72, 74,
      76, '-', '-', '-', 80, '-', 83, '-',
    ],
    drums: 'k.hkskh.k.hks.hs',
    bass: 'drive', arp: false, leadType: 'sawtooth',
  },
  bgm_3: {
    bpm: 150,
    chords: [[49, 'm'], [45, 'M'], [52, 'M'], [47, 'M'], [49, 'm'], [45, 'M'], [47, 'M'], [44, 'm']],
    lead: [
      80, '-', '-', '-', '-', '-', 78, 76,
      76, '-', '-', '-', 73, '-', '-', '-',
      71, '-', '-', '-', 76, '-', 78, '-',
      78, '-', '-', '-', '-', '-', 0, 0,
      80, '-', '-', '-', 83, '-', '-', '-',
      81, '-', '-', '-', 80, '-', 76, '-',
      78, '-', '-', '-', 75, '-', 78, '-',
      80, '-', '-', '-', '-', '-', 0, 0,
    ],
    drums: 'k.h.s.hkk.h.s.hh',
    bass: 'pulse', arp: true, leadType: 'triangle',
  },
};

function compileLead(lead) {
  const ev = [];
  for (let i = 0; i < lead.length; i++) {
    const n = lead[i];
    if (typeof n === 'number' && n > 0) {
      let len = 1;
      while (i + len < lead.length && lead[i + len] === '-') len++;
      ev.push({ step: i * 2, note: n, len: len * 2 });
    }
  }
  return ev;
}
for (const s of Object.values(SONGS)) s.leadEv = compileLead(s.lead);

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.gamePaused = false;
    this.bgmId = null;
    this.engineOn = false;
    this.engineHz = 0;
  }
  get state() { return this.ctx ? this.ctx.state : 'none'; }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      this._build();
    }
    if (this.ctx.state === 'suspended' && !this.gamePaused) this.ctx.resume().catch(() => {});
  }

  _build() {
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(c.destination);
    this.bgmBus = c.createGain(); this.bgmBus.gain.value = 0.35; this.bgmBus.connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.6; this.sfxBus.connect(this.master);
    this.engBus = c.createGain(); this.engBus.gain.value = 0.4; this.engBus.connect(this.master);
    // noise buffer
    const len = c.sampleRate * 1;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // engine: saw + square + sub saw -> lowpass -> gain
    this.engGain = c.createGain(); this.engGain.gain.value = 0;
    this.engLP = c.createBiquadFilter(); this.engLP.type = 'lowpass'; this.engLP.frequency.value = 500; this.engLP.Q.value = 3;
    this.engLP.connect(this.engGain); this.engGain.connect(this.engBus);
    this.engOsc = [];
    for (const [type, mul, g] of [['sawtooth', 1, 0.6], ['square', 1.006, 0.35], ['sawtooth', 0.5, 0.5]]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = 60 * mul;
      const og = c.createGain(); og.gain.value = g;
      o.connect(og); og.connect(this.engLP); o.start();
      this.engOsc.push([o, mul]);
    }
    // offroad gravel loop
    this.offSrc = c.createBufferSource(); this.offSrc.buffer = this.noise; this.offSrc.loop = true;
    this.offLP = c.createBiquadFilter(); this.offLP.type = 'bandpass'; this.offLP.frequency.value = 700; this.offLP.Q.value = 0.8;
    this.offGain = c.createGain(); this.offGain.gain.value = 0;
    this.offSrc.connect(this.offLP); this.offLP.connect(this.offGain); this.offGain.connect(this.sfxBus);
    this.offSrc.start();
    this.timer = setInterval(() => this._schedule(), 25);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setValueAtTime(m ? 0 : 0.5, this.ctx.currentTime);
  }
  pause() { this.gamePaused = true; if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { this.gamePaused = false; if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }

  // ---- engine ----
  setEngine(on, sp) {
    this.engineOn = on;
    this.engineHz = on ? 60 + 140 * sp : 0;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = on ? 0.05 + 0.07 * sp : 0;
    this.engGain.gain.setTargetAtTime(g, t, 0.03);
    if (on) {
      for (const [o, mul] of this.engOsc) o.frequency.setTargetAtTime(this.engineHz * mul, t, 0.03);
      this.engLP.frequency.setTargetAtTime(300 + 1400 * sp, t, 0.05);
    }
  }
  setOffroad(on) {
    if (!this.ctx) return;
    this.offGain.gain.setTargetAtTime(on ? 0.35 : 0, this.ctx.currentTime, 0.05);
  }

  // ---- BGM ----
  playBgm(id) {
    if (this.bgmId === id && this.song) return;
    this.stopBgm();
    this.bgmId = id;
    if (!this.ctx) return;
    this.song = SONGS[id];
    this.songGain = this.ctx.createGain(); this.songGain.gain.value = 1; this.songGain.connect(this.bgmBus);
    this.stepIdx = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
  }
  stopBgm() {
    this.bgmId = null;
    if (this.songGain && this.ctx) {
      const g = this.songGain, t = this.ctx.currentTime;
      g.gain.setTargetAtTime(0, t, 0.02);
      setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 400);
    }
    this.song = null; this.songGain = null;
  }
  _schedule() {
    if (!this.ctx || !this.song || this.ctx.state !== 'running') return;
    const s = this.song, dur = 60 / s.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this._playStep(s, this.stepIdx % 128, this.nextTime, dur);
      this.stepIdx++;
      this.nextTime += dur;
    }
  }
  _playStep(s, step, t, dur) {
    const out = this.songGain;
    const bar = step >> 4, sb = step & 15;
    const [root, q] = s.chords[bar];
    const third = q === 'm' ? 3 : 4;
    // drums
    const dch = s.drums[sb];
    if (dch === 'k') this._kick(t, out);
    if (dch === 's') this._snare(t, out);
    if (dch === 'h' || sb % 2 === 1) this._hat(t, out, dch === 'h' ? 0.12 : 0.05);
    // bass
    if (s.bass === 'oct') {
      if (sb % 2 === 0) this._note(t, mtof(root + ((sb >> 1) % 2 ? 12 : 0)), dur * 1.8, 'square', 0.16, out, 900);
    } else if (s.bass === 'drive') {
      const n = sb === 14 ? root + 7 : sb === 6 ? root + 12 : root;
      this._note(t, mtof(n), dur * 0.9, 'sawtooth', 0.14, out, 700);
    } else {
      if (sb % 4 !== 3) this._note(t, mtof(root - 12 + (sb >= 8 && sb % 4 === 2 ? 12 : 0)), dur * 1.5, 'square', 0.16, out, 600);
    }
    // arpeggio
    if (s.arp) {
      const pat = [0, third, 7, 12, 7, third, 12, 19];
      this._note(t, mtof(root + 24 + pat[sb % 8]), dur * 0.8, 'sawtooth', 0.05, out, 2400);
    } else if (sb % 4 === 2) {
      // off-beat chord stab
      for (const iv of [12, 12 + third, 19]) this._note(t, mtof(root + iv), dur * 1.2, 'triangle', 0.035, out, 3000);
    }
    // lead
    for (const e of s.leadEv) if (e.step === step) this._note(t, mtof(e.note), e.len * dur * 0.95, s.leadType, s.leadType === 'triangle' ? 0.2 : 0.075, out, 3200, true);
  }
  _note(t, f, d, type, g, out, lp, vib) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    const gn = c.createGain();
    gn.gain.setValueAtTime(0, t);
    gn.gain.linearRampToValueAtTime(g, t + 0.008);
    gn.gain.setTargetAtTime(g * 0.6, t + 0.02, 0.08);
    gn.gain.setTargetAtTime(0, t + d, 0.03);
    let node = o;
    if (lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; o.connect(f2); node = f2; }
    if (vib && d > 0.3) {
      const l = c.createOscillator(); l.frequency.value = 5.5; const lg = c.createGain(); lg.gain.value = f * 0.012;
      l.connect(lg); lg.connect(o.frequency); l.start(t + 0.15); l.stop(t + d + 0.2);
    }
    node.connect(gn); gn.connect(out);
    o.start(t); o.stop(t + d + 0.2);
  }
  _noise(t, d, g, out, ftype, freq, q = 1) {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = ftype; f.frequency.value = freq; f.Q.value = q;
    const gn = c.createGain(); gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.001, t + d);
    src.connect(f); f.connect(gn); gn.connect(out);
    src.start(t, Math.random() * 0.5); src.stop(t + d + 0.05);
    return f;
  }
  _kick(t, out) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.14);
    const g = c.createGain(); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2);
  }
  _snare(t, out) { this._noise(t, 0.14, 0.35, out, 'bandpass', 1800, 0.7); this._note(t, 190, 0.05, 'triangle', 0.15, out); }
  _hat(t, out, g) { this._noise(t, 0.04, g, out, 'highpass', 7000); }

  // ---- SFX ----
  play(id) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.005, o = this.sfxBus;
    switch (id) {
      case 'sfx_beep': this._note(t, 440, 0.15, 'square', 0.25, o); break;
      case 'sfx_go': this._note(t, 880, 0.4, 'square', 0.25, o); break;
      case 'sfx_checkpoint': [72, 79, 84].forEach((m, i) => { this._note(t + i * 0.08, mtof(m + 12), 0.12, 'square', 0.18, o); this._note(t + i * 0.08, mtof(m), 0.14, 'triangle', 0.2, o); }); break;
      case 'sfx_crash': {
        const f = this._noise(t, 0.45, 0.9, o, 'lowpass', 3000);
        f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.4);
        const c = this.ctx, s = c.createOscillator(); s.type = 'sine';
        s.frequency.setValueAtTime(120, t); s.frequency.exponentialRampToValueAtTime(35, t + 0.4);
        const g = c.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
        s.connect(g); g.connect(o); s.start(t); s.stop(t + 0.45);
        break;
      }
      case 'sfx_goal': {
        const seq = [[72, 0, 0.12], [76, 0.12, 0.12], [79, 0.24, 0.12], [84, 0.36, 0.3], [79, 0.7, 0.12], [84, 0.84, 0.7]];
        for (const [m, dt, d] of seq) { this._note(t + dt, mtof(m), d, 'square', 0.15, o); this._note(t + dt, mtof(m - 12), d, 'triangle', 0.2, o); if (dt > 0.8) this._note(t + dt, mtof(m + 4), d, 'square', 0.08, o); }
        break;
      }
      case 'sfx_timeup': [81, 78, 74, 69, 62].forEach((m, i) => this._note(t + i * 0.18, mtof(m), i === 4 ? 0.6 : 0.16, 'square', 0.18, o)); break;
      case 'sfx_menu': {
        const c = this.ctx, s = c.createOscillator(); s.type = 'square';
        s.frequency.setValueAtTime(1200, t); s.frequency.exponentialRampToValueAtTime(1800, t + 0.06);
        const g = c.createGain(); g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        s.connect(g); g.connect(o); s.start(t); s.stop(t + 0.1);
        break;
      }
      case 'sfx_overtake': {
        const f = this._noise(t, 0.22, 0.35, o, 'bandpass', 800, 2);
        f.frequency.setValueAtTime(2500, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.2);
        this._note(t, 1568, 0.05, 'square', 0.06, o);
        break;
      }
      case 'sfx_timewarn': this._note(t, 1000, 0.05, 'square', 0.15, o); break;
      case 'jingle_title': [60, 64, 67, 72, 76, 79].forEach((m, i) => this._note(t + i * 0.07, mtof(m + 12), i === 5 ? 0.4 : 0.09, 'square', 0.12, o)); break;
      default: break;
    }
  }
}

export const SOUND_IDS = ['bgm_1', 'bgm_2', 'bgm_3', 'sfx_engine', 'sfx_beep', 'sfx_go', 'sfx_checkpoint', 'sfx_crash', 'sfx_goal', 'sfx_timeup', 'sfx_menu', 'sfx_overtake', 'sfx_offroad', 'sfx_timewarn', 'jingle_title'];
