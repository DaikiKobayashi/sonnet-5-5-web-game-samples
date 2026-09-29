// Web Audio: everything is synthesized. Engine, BGM sequencer, SFX.
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const MAJ = [0, 4, 7, 12, 16, 19];
const MIN = [0, 3, 7, 12, 15, 19];

// Songs: 8 bars x 16 steps. chords = [rootMidi, quality]; lead patterns index chord tones (digits), '.' = rest.
const SONGS = {
  bgm_1: {
    bpm: 128, leadWave: 'square', bassWave: 'sawtooth', leadBase: 12, leadVol: 0.16,
    chords: [[48, 0], [53, 0], [55, 0], [48, 0], [57, 1], [53, 0], [55, 0], [55, 0]],
    bass: 'R.rRR.rRR.rRR.rR',
    lead: ['2.3.4.3.2.1.2...', '4.4.3.2.3.4.5.4.'.slice(0, 16), '2.4.5.4.2.4.3.2.', '4.5.4.3.2.3.4...', '2.3.4.5.4.3.2.1.', '3.4.5.4.3.4.5.3.', '4.5.3.4.5.3.4.2.', '5.4.3.2.3.4.5.5.'],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx',
  },
  bgm_2: {
    bpm: 138, leadWave: 'sawtooth', bassWave: 'square', leadBase: 12, leadVol: 0.12,
    chords: [[45, 1], [41, 0], [48, 0], [43, 0], [45, 1], [41, 0], [40, 1], [40, 1]],
    bass: 'R..rR..rR.rRR..r',
    lead: ['2..3.4..5.4.3...', '4..5.4..3.2.3...', '2.4.5.4.2.4.5.7.'.slice(0, 16), '3..4.5..4.3.2...', '2..3.4..5.4.3.2.', '4.4.5.4.3.4.5...', '3..4.3..2.3.4...', '2.3.4.5.4.3.2.0.'],
    kick: 'x..x..x...x.x...', snare: '....x.......x..x', hat: 'x.xxx.xxx.xxx.xx',
  },
  bgm_3: {
    bpm: 150, leadWave: 'square', bassWave: 'sawtooth', leadBase: 12, leadVol: 0.1,
    chords: [[45, 1], [41, 0], [48, 0], [43, 0], [45, 1], [41, 0], [48, 0], [43, 0]],
    bass: 'RrRrRrRrRrRrRrRr',
    lead: ['0120210301202103', '0123210301232103', '1230321012303210', '0231320102313201', '0120210301202103', '0123210301232103', '2340432123404321', '3452543234525432'],
    kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx',
  },
};

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.wantBgm = null;
    this.playingBgm = null;
    this.engineHz = 0;
    this.timer = null;
    this.offroad = false;
    this.previewTimers = [];
  }

  get state() { return this.ctx ? this.ctx.state : 'none'; }
  get bgm() { return this.ctx ? this.playingBgm : null; }

  ensure() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(ctx.destination);
        this.bgmBus = ctx.createGain(); this.bgmBus.gain.value = 0.35; this.bgmBus.connect(this.master);
        this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.6; this.sfxBus.connect(this.master);
        this.engBus = ctx.createGain(); this.engBus.gain.value = 0.4; this.engBus.connect(this.master);
        // noise buffer
        const len = ctx.sampleRate * 1;
        const nb = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = nb.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = nb;
        // engine
        this.eng1 = ctx.createOscillator(); this.eng1.type = 'sawtooth';
        this.eng2 = ctx.createOscillator(); this.eng2.type = 'square';
        this.eng3 = ctx.createOscillator(); this.eng3.type = 'triangle';
        this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 500; this.engFilter.Q.value = 2;
        this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
        const g2 = ctx.createGain(); g2.gain.value = 0.5;
        const g3 = ctx.createGain(); g3.gain.value = 0.8;
        this.eng1.connect(this.engFilter); this.eng2.connect(g2); g2.connect(this.engFilter); this.eng3.connect(g3); g3.connect(this.engFilter);
        this.engFilter.connect(this.engGain); this.engGain.connect(this.engBus);
        this.eng1.frequency.value = 60; this.eng2.frequency.value = 30; this.eng3.frequency.value = 120;
        this.eng1.start(); this.eng2.start(); this.eng3.start();
        // offroad gravel loop
        this.gravel = ctx.createBufferSource(); this.gravel.buffer = nb; this.gravel.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
        this.gravelGain = ctx.createGain(); this.gravelGain.gain.value = 0;
        this.gravel.connect(lp); lp.connect(this.gravelGain); this.gravelGain.connect(this.sfxBus);
        this.gravel.start();
      }
      if (this.ctx.state === 'suspended' && !this.holdSuspended) this.ctx.resume();
    } catch (e) { /* audio unavailable */ }
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.01);
  }

  setPaused(p) {
    this.holdSuspended = p;
    if (!this.ctx) return;
    if (p && this.ctx.state === 'running') this.ctx.suspend();
    else if (!p && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // ------------------------------------------------ engine
  setEngine(active, sp) {
    this.engineHz = active ? 60 + 140 * sp : 0;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const hz = 60 + 140 * sp;
    this.eng1.frequency.setTargetAtTime(hz, t, 0.03);
    this.eng2.frequency.setTargetAtTime(hz * 0.5, t, 0.03);
    this.eng3.frequency.setTargetAtTime(hz * 2, t, 0.03);
    this.engFilter.frequency.setTargetAtTime(350 + 1400 * sp, t, 0.05);
    this.engGain.gain.setTargetAtTime(active ? 0.05 + 0.07 * sp : 0, t, 0.05);
  }
  setOffroad(on) {
    if (on === this.offroad) return;
    this.offroad = on;
    if (this.ctx) this.gravelGain.gain.setTargetAtTime(on ? 0.35 : 0, this.ctx.currentTime, 0.05);
  }

  // ------------------------------------------------ primitives
  tone(freq, t, dur, type = 'square', vol = 0.3, bus = this.sfxBus, freqEnd = null, attack = 0.005) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(t, dur, vol, ftype, f0, f1, bus = this.sfxBus) {
    if (!this.ctx) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = ftype;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  // ------------------------------------------------ sfx
  sfx(id) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    switch (id) {
      case 'sfx_beep': this.tone(440, t, 0.15, 'square', 0.4); break;
      case 'sfx_go': this.tone(880, t, 0.4, 'square', 0.4); this.tone(1320, t, 0.4, 'triangle', 0.2); break;
      case 'sfx_checkpoint': [660, 880, 1320].forEach((f, i) => this.tone(f, t + i * 0.09, 0.16, 'square', 0.3)); this.tone(1760, t + 0.27, 0.3, 'triangle', 0.25); break;
      case 'sfx_crash': this.noise(t, 0.4, 0.9, 'lowpass', 3000, 200); this.tone(120, t, 0.4, 'sawtooth', 0.5, this.sfxBus, 40); break;
      case 'sfx_goal': {
        const seq = [[523, 0], [659, 0.14], [784, 0.28], [1047, 0.42], [784, 0.62], [1047, 0.76]];
        seq.forEach(([f, d]) => this.tone(f, t + d, 0.2, 'square', 0.28));
        [523, 659, 784, 1047].forEach((f) => { this.tone(f, t + 0.95, 0.9, 'triangle', 0.22); });
        this.tone(262, t + 0.95, 0.9, 'sawtooth', 0.15);
        break;
      }
      case 'sfx_timeup': [440, 370, 311, 220].forEach((f, i) => this.tone(f, t + i * 0.25, 0.3, 'sawtooth', 0.3, this.sfxBus, f * 0.95)); break;
      case 'sfx_menu': this.tone(880, t, 0.07, 'square', 0.3); this.tone(1320, t + 0.06, 0.1, 'square', 0.3); break;
      case 'sfx_overtake': this.noise(t, 0.18, 0.5, 'bandpass', 600, 2400); this.tone(1200, t, 0.08, 'triangle', 0.18); break;
      case 'sfx_timewarn': this.tone(1500, t, 0.05, 'square', 0.25); break;
      case 'jingle_title': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.1, 0.16, 'square', 0.25)); break;
      default: break;
    }
  }

  // ------------------------------------------------ bgm
  setBgm(id) {
    this.wantBgm = id;
    if (!this.ctx) return;
    if (this.playingBgm !== id) {
      if (id) this.startBgm(id); else this.stopBgm();
    }
  }
  startBgm(id) {
    this.stopBgm();
    const song = SONGS[id];
    if (!song || !this.ctx) return;
    this.playingBgm = id;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.06;
    const tick = () => {
      if (!this.ctx) return;
      while (this.nextTime < this.ctx.currentTime + 0.14) {
        this.schedule(song, this.step, this.nextTime);
        this.nextTime += 60 / song.bpm / 4;
        this.step++;
      }
    };
    tick();
    this.timer = setInterval(tick, 25);
  }
  stopBgm() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.playingBgm = null;
  }
  schedule(song, step, t) {
    const bar = Math.floor(step / 16) % 8;
    const s = step % 16;
    const [root, q] = song.chords[bar];
    const tones = q ? MIN : MAJ;
    const sd = 60 / song.bpm / 4;
    const bp = song.bass[s];
    if (bp !== '.') this.tone(mtof(root + (bp === 'r' ? 12 : 0)), t, sd * 1.8, song.bassWave, 0.3, this.bgmBus, null, 0.008);
    const lp = song.lead[bar][s];
    if (lp && lp !== '.') {
      const idx = parseInt(lp, 10);
      const midi = root + song.leadBase + tones[idx % tones.length] + (idx >= tones.length ? 12 : 0) + 12;
      this.tone(mtof(midi), t, sd * 1.6, song.leadWave, song.leadVol, this.bgmBus, null, 0.006);
      if (song.leadWave === 'sawtooth') this.tone(mtof(midi) * 1.005, t, sd * 1.6, 'sawtooth', song.leadVol * 0.5, this.bgmBus);
    }
    if (song.kick[s] === 'x') this.tone(150, t, 0.14, 'sine', 0.7, this.bgmBus, 45);
    if (song.snare[s] === 'x') { this.noise(t, 0.14, 0.55, 'highpass', 1500, 0, this.bgmBus); this.tone(190, t, 0.08, 'triangle', 0.25, this.bgmBus); }
    if (song.hat[s] === 'x') this.noise(t, 0.04, 0.22, 'highpass', 7000, 0, this.bgmBus);
  }

  // ------------------------------------------------ gallery preview
  preview(id) {
    this.ensure();
    if (!this.ctx) return;
    this.previewTimers.forEach(clearTimeout);
    this.previewTimers = [];
    if (id.startsWith('bgm_')) {
      this.startBgm(id);
      this.previewTimers.push(setTimeout(() => this.stopBgm(), 3000));
    } else if (id === 'sfx_engine') {
      this.setEngine(true, 0.4);
      this.previewTimers.push(setTimeout(() => this.setEngine(false, 0), 3000));
    } else if (id === 'sfx_offroad') {
      this.setOffroad(true);
      this.previewTimers.push(setTimeout(() => this.setOffroad(false), 2000));
    } else this.sfx(id);
  }
}

export const SOUND_IDS = ['bgm_1', 'bgm_2', 'bgm_3', 'sfx_engine', 'sfx_beep', 'sfx_go', 'sfx_checkpoint', 'sfx_crash', 'sfx_goal', 'sfx_timeup', 'sfx_menu', 'sfx_overtake', 'sfx_offroad', 'sfx_timewarn', 'jingle_title'];
