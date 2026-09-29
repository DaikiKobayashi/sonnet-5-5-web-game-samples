// BGM(Web Audio で合成)。3 曲・各 16 小節のループ。ベース + リード + コード/アルペジオ + ドラム(ノイズ)。

const NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function midi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error('bad note ' + name);
  let n = NOTE_IDX[m[1]];
  if (m[2] === '#') n += 1;
  if (m[2] === 'b') n -= 1;
  return n + (parseInt(m[3], 10) + 1) * 12;
}
export const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS = {
  maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], sus4: [0, 5, 7, 10],
};

// bars: [ルート音名, コード種, リード(8 分音符 8 個)]。'.' 休符、'-' 前の音を伸ばす
function parseBars(rows) {
  return rows.map(([root, type, lead]) => ({
    root: midi(root),
    tones: CHORDS[type],
    lead: lead.trim().split(/\s+/).map((t) => (t === '.' || t === '-' ? t : midi(t))),
  }));
}

export const SONGS = {
  // ステージ 1: 夕暮れの海沿い。軽快な長調、フュージョン風
  bgm_1: {
    bpm: 126,
    style: 'breeze',
    bars: parseBars([
      ['F2', 'maj7', 'E5 G5 A5 - C6 - B5 A5'],
      ['E2', 'm7', 'G5 - E5 G5 B5 - A5 G5'],
      ['D2', 'm7', 'F5 A5 D6 - C6 - A5 F5'],
      ['G2', 'dom7', 'G5 B5 D6 - B5 - G5 .'],
      ['F2', 'maj7', 'E5 G5 A5 - C6 - E6 D6'],
      ['E2', 'm7', 'B5 - G5 B5 E6 - D6 B5'],
      ['D2', 'm7', 'A5 - F5 A5 D6 C6 A5 F5'],
      ['G2', 'dom7', 'G5 - B5 - D6 - . B5'],
      ['C2', 'maj7', 'C6 - G5 C6 E6 - D6 C6'],
      ['A2', 'm7', 'A5 - C6 E6 A6 - G6 E6'],
      ['D2', 'm7', 'D6 - F6 - A6 - F6 D6'],
      ['G2', 'dom7', 'D6 B5 G5 B5 D6 - . .'],
      ['C2', 'maj7', 'E6 - C6 E6 G6 - E6 C6'],
      ['A2', 'm7', 'E6 - A5 C6 E6 - D6 C6'],
      ['F2', 'maj7', 'A5 C6 F6 - E6 - C6 A5'],
      ['G2', 'sus4', 'G5 - B5 D6 G6 - . .'],
    ]),
    bass: 'r . . r . . r . r . . r . . 5 .',
    stab: '. . . x . . . x . . . x . . x .',
    kick: 'x . . . . . x . x . . . . . x .',
    snare: '. . . . x . . . . . . . x . . .',
    hat: 'x . x . x . x . x . x . x . x x',
  },
  // ステージ 2: 黄昏の山道。短調、疾走感
  bgm_2: {
    bpm: 138,
    style: 'drive',
    bars: parseBars([
      ['A2', 'min', 'A5 - C6 - E6 - D6 C6'],
      ['F2', 'maj', 'C6 - A5 - F5 - A5 C6'],
      ['C2', 'maj', 'E6 - G6 - E6 - D6 C6'],
      ['G2', 'maj', 'D6 - B5 - G5 - B5 D6'],
      ['A2', 'min', 'A5 - C6 - E6 - A6 G6'],
      ['F2', 'maj', 'F6 - E6 - C6 - A5 C6'],
      ['D2', 'min', 'D6 - F6 - A6 - G6 F6'],
      ['E2', 'dom7', 'G#5 - B5 - D6 - E6 .'],
      ['D2', 'min', 'A5 D6 F6 - A6 - F6 D6'],
      ['A2', 'min', 'E6 - C6 E6 A6 - E6 C6'],
      ['F2', 'maj', 'C6 F6 A6 - C7 - A6 F6'],
      ['C2', 'maj', 'G6 - E6 G6 C7 - G6 E6'],
      ['D2', 'min', 'F6 - D6 F6 A6 - F6 D6'],
      ['A2', 'min', 'E6 - A5 C6 E6 - C6 A5'],
      ['E2', 'maj', 'G#5 B5 E6 - D6 B5 G#5 .'],
      ['E2', 'dom7', 'E6 - B5 - G#5 - E5 .'],
    ]),
    bass: 'r . r . r . o . r . r . r . 5 .',
    stab: '. . x . . . x . . . x . . . x .',
    kick: 'x . . . x . . . x . . x x . . .',
    snare: '. . . . x . . . . . . . x . . x',
    hat: 'x x x x x x x x x x x x x x x x',
  },
  // ステージ 3: ネオンの夜景。アルペジオ主体
  bgm_3: {
    bpm: 152,
    style: 'arp',
    bars: parseBars([
      ['C2', 'min', 'G5 - - - Eb6 - D6 -'],
      ['Ab1', 'maj', 'C6 - - - Eb6 - - -'],
      ['Eb2', 'maj', 'G5 - Bb5 - Eb6 - - -'],
      ['Bb1', 'maj', 'D6 - - - F6 - D6 -'],
      ['C2', 'min', 'G5 - - - Eb6 - D6 -'],
      ['Ab1', 'maj', 'C6 - Eb6 - Ab6 - - -'],
      ['Eb2', 'maj', 'G6 - F6 - Eb6 - Bb5 -'],
      ['Bb1', 'maj', 'D6 - - - C6 - Bb5 -'],
      ['F2', 'min', 'C6 - - - F6 - Eb6 -'],
      ['Ab1', 'maj', 'Eb6 - - - C6 - Ab5 -'],
      ['C2', 'min', 'G5 - Bb5 - C6 - Eb6 -'],
      ['G1', 'dom7', 'D6 - - - B5 - D6 -'],
      ['F2', 'min', 'C6 - F6 - Ab6 - - -'],
      ['Ab1', 'maj', 'Eb6 - C6 - Ab5 - C6 -'],
      ['C2', 'min', 'G6 - Eb6 - C6 - G5 -'],
      ['G1', 'dom7', 'D6 - B5 - G5 - . .'],
    ]),
    bass: 'r . r r . r r . r . r r . r r .',
    stab: '. . . . . . . . . . . . . . . .',
    kick: 'x . . . x . . . x . . . x . . .',
    snare: '. . . . x . . . . . . . x . . .',
    hat: '. . x . . . x . . . x . . . x .',
    openHat: '. . x . . . x . . . x . . . x .',
    arp: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 2, 1],
  },
};

const pat = (s) => s.trim().split(/\s+/);

export class Sequencer {
  constructor(ctx, dest, noiseBuf, songId) {
    this.ctx = ctx;
    this.song = SONGS[songId];
    this.id = songId;
    this.noise = noiseBuf;
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(dest);
    this.total = this.song.bars.length * 16;
    this.step = 0;
    this.timer = null;
    this.stepDur = 60 / this.song.bpm / 4;
    this.pats = {
      bass: pat(this.song.bass), stab: pat(this.song.stab), kick: pat(this.song.kick),
      snare: pat(this.song.snare), hat: pat(this.song.hat), openHat: this.song.openHat ? pat(this.song.openHat) : null,
    };
    // 空間系(遅延)
    this.delay = ctx.createDelay(1);
    this.fb = ctx.createGain();
    this.dwet = ctx.createGain();
    const dl = ctx.createBiquadFilter();
    dl.type = 'lowpass';
    dl.frequency.value = 2400;
    if (this.song.style === 'arp') { this.delay.delayTime.value = this.stepDur * 3; this.fb.gain.value = 0.38; this.dwet.gain.value = 0.42; }
    else if (this.song.style === 'drive') { this.delay.delayTime.value = this.stepDur * 2; this.fb.gain.value = 0.22; this.dwet.gain.value = 0.2; }
    else { this.delay.delayTime.value = this.stepDur * 3; this.fb.gain.value = 0.25; this.dwet.gain.value = 0.26; }
    this.delay.connect(dl); dl.connect(this.fb); this.fb.connect(this.delay);
    dl.connect(this.dwet); this.dwet.connect(this.bus);
    this.send = ctx.createGain();
    this.send.gain.value = 1;
    this.send.connect(this.delay);
  }

  start() {
    this.next = this.ctx.currentTime + 0.06;
    this.tick();
    this.timer = setInterval(() => this.tick(), 25);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(0, t + 0.12);
    setTimeout(() => { try { this.bus.disconnect(); this.delay.disconnect(); } catch (e) { /* 何もしない */ } }, 400);
  }

  tick() {
    const c = this.ctx;
    while (this.next < c.currentTime + 0.14) {
      this.schedule(this.next, this.step);
      this.next += this.stepDur;
      this.step = (this.step + 1) % this.total;
    }
  }

  // ---- 音色
  osc(type, f, t, dur, vol, opts = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (opts.detune) o.detune.value = opts.detune;
    const g = c.createGain();
    const a = opts.attack || 0.004;
    const rel = opts.release || 0.05;
    const sus = opts.sustain === undefined ? 0.7 : opts.sustain;
    const susVol = Math.max(0.0001, vol * sus);
    const tD = t + Math.max(a + 0.01, dur * (opts.decay || 0.5));
    const tR = Math.max(tD, t + dur - rel);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(susVol, tD);
    g.gain.setValueAtTime(susVol, tR);
    g.gain.exponentialRampToValueAtTime(0.0001, tR + rel);
    let node = o;
    if (opts.lp) {
      const f1 = c.createBiquadFilter();
      f1.type = 'lowpass';
      f1.frequency.setValueAtTime(opts.lp, t);
      if (opts.lpEnd) f1.frequency.exponentialRampToValueAtTime(opts.lpEnd, t + dur);
      f1.Q.value = opts.q || 0.7;
      o.connect(f1);
      node = f1;
    }
    node.connect(g);
    g.connect(this.bus);
    if (opts.send) { const s = c.createGain(); s.gain.value = opts.send; g.connect(s); s.connect(this.send); }
    if (opts.vibrato) {
      const l = c.createOscillator();
      const lg = c.createGain();
      l.frequency.value = 5.4;
      lg.gain.value = opts.vibrato;
      l.connect(lg); lg.connect(o.detune);
      l.start(t + dur * 0.3); l.stop(tR + rel + 0.05);
    }
    o.start(t);
    o.stop(tR + rel + 0.05);
  }

  noiseHit(t, dur, vol, type, f, q = 0.7, fEnd = null) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const fl = c.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (fEnd) fl.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    fl.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.bus);
    s.start(t, Math.random() * 0.8);
    s.stop(t + dur + 0.02);
  }

  kick(t, vol = 0.9) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 0.22);
    this.noiseHit(t, 0.02, 0.18, 'lowpass', 3000);
  }

  snare(t, vol = 0.5) {
    this.noiseHit(t, 0.16, vol, 'bandpass', 1900, 0.8);
    this.osc('triangle', 210, t, 0.08, vol * 0.5, { release: 0.03, sustain: 0.3, decay: 0.3 });
  }

  hat(t, open, vol = 0.14) {
    this.noiseHit(t, open ? 0.13 : 0.035, open ? vol * 0.9 : vol, 'highpass', 7200, 0.6);
  }

  schedule(t, step) {
    const song = this.song;
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const b = song.bars[bar];
    const P = this.pats;
    const style = song.style;
    const lastBar = bar % 8 === 7;
    const sd = this.stepDur;

    // ドラム
    if (P.kick[s] === 'x') this.kick(t, style === 'arp' ? 0.95 : 0.85);
    let sn = P.snare[s] === 'x';
    if (lastBar && s >= 12 && (s % 1 === 0) && style !== 'arp') sn = sn || s === 13 || s === 14 || s === 15;
    if (lastBar && style === 'arp' && s >= 14) sn = true;
    if (sn) this.snare(t, style === 'drive' ? 0.55 : 0.45);
    if (P.hat[s] === 'x') this.hat(t, false, style === 'drive' ? 0.11 : 0.13);
    if (P.openHat && P.openHat[s] === 'x' && s % 4 === 2) this.hat(t, true, 0.1);
    if (style === 'breeze' && s === 14) this.hat(t, true, 0.09);

    // ベース
    const bt = P.bass[s];
    if (bt !== '.') {
      let m = b.root;
      if (bt === '5') m += 7;
      if (bt === 'o') m += 12;
      const f = hz(m);
      if (style === 'breeze') {
        this.osc('triangle', f, t, sd * 1.8, 0.42, { lp: 900, release: 0.04 });
        this.osc('sine', f, t, sd * 1.8, 0.3, { release: 0.04 });
      } else if (style === 'drive') {
        this.osc('sawtooth', f, t, sd * 1.7, 0.2, { lp: 620, lpEnd: 260, q: 2, release: 0.03 });
        this.osc('square', f * 0.5, t, sd * 1.7, 0.16, { lp: 300, release: 0.03 });
      } else {
        this.osc('sawtooth', f, t, sd * 1.5, 0.22, { lp: 520, lpEnd: 200, q: 3, release: 0.03 });
        this.osc('sine', f, t, sd * 1.5, 0.3, { release: 0.03 });
      }
    }

    // コード(スタブ / アルペジオ)
    if (style === 'arp') {
      const tones = b.tones;
      const k = song.arp[s];
      const oct = k >= tones.length ? 12 : 0;
      const m = b.root + 24 + tones[k % tones.length] + oct;
      this.osc('sawtooth', hz(m), t, sd * 1.05, 0.11, { lp: 1200 + (s % 4 === 0 ? 1800 : 600), lpEnd: 700, q: 4, release: 0.02, sustain: 0.3, send: 0.7, detune: (s % 2) * 7 });
      this.osc('square', hz(m), t, sd * 0.9, 0.05, { lp: 2400, release: 0.02, sustain: 0.2, send: 0.5 });
      // パッド(小節頭)
      if (s === 0) {
        for (const iv of tones) {
          this.osc('sawtooth', hz(b.root + 24 + iv), t, sd * 15.5, 0.035, { lp: 900, attack: 0.25, release: 0.4, sustain: 1, decay: 0.9 });
        }
      }
    } else if (P.stab[s] === 'x') {
      const notes = b.tones.map((iv) => b.root + 24 + iv);
      for (const m of notes) {
        if (style === 'breeze') this.osc('triangle', hz(m), t, sd * 1.6, 0.075, { lp: 3200, release: 0.06, sustain: 0.3, decay: 0.3, send: 0.35 });
        else this.osc('sawtooth', hz(m), t, sd * 1.3, 0.05, { lp: 2600, lpEnd: 900, release: 0.04, sustain: 0.25, decay: 0.3, send: 0.2 });
      }
    }

    // リード(8 分音符グリッド)
    if (s % 2 === 0) {
      const idx = s / 2;
      const tok = b.lead[idx];
      if (typeof tok === 'number') {
        let n = 1;
        while (idx + n < 8 && b.lead[idx + n] === '-') n++;
        const dur = n * sd * 2 * 0.96;
        const f = hz(tok);
        if (style === 'breeze') {
          this.osc('square', f, t, dur, 0.09, { lp: 2800, release: 0.07, sustain: 0.55, send: 0.5, vibrato: n > 2 ? 9 : 0 });
          this.osc('triangle', f * 2, t, dur, 0.03, { release: 0.05, send: 0.3 });
        } else if (style === 'drive') {
          this.osc('sawtooth', f, t, dur, 0.085, { lp: 3000, lpEnd: 1800, q: 1.5, release: 0.06, sustain: 0.6, send: 0.35, vibrato: n > 2 ? 10 : 0 });
          this.osc('square', f, t, dur, 0.04, { lp: 2200, detune: 8, release: 0.06, send: 0.3 });
        } else {
          this.osc('sawtooth', f, t, dur, 0.075, { lp: 3800, q: 2, release: 0.1, sustain: 0.75, send: 0.9, vibrato: 12, attack: 0.02 });
          this.osc('square', f, t, dur, 0.04, { lp: 2600, detune: -9, release: 0.1, send: 0.9, attack: 0.02 });
        }
      }
    }
  }
}
