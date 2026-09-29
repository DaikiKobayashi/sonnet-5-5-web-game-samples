/* audio.js - everything you hear is synthesised here with Web Audio (no audio files).
 * SFX: chip-style oscillators + filtered noise. BGM: a small step sequencer with 6 original tracks
 * (title, stage1..stage5). Public state mirrors SPEC 7.4 (audio.unlocked / muted / bgm / sfxLog).
 */
(function () {
  'use strict';
  var DM = window.DM;

  var A = (DM.audio = {
    ctx: null,
    unlocked: false,
    muted: false,
    bgm: null,
    sfxLog: [],
    tempoMult: 1,
    paused: false
  });

  var master = null, sfxBus = null, bgmBus = null, noiseBuf = null;
  var waves = {};
  var bgmCur = null; /* {id, gain, step, next} */
  var timer = null;
  var lastExplode = -1;

  /* ------------------------------------------------------------------ utils */
  var NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var fcache = {};
  function freq(name) {
    var f = fcache[name];
    if (f) return f;
    var m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) return 440;
    var n = NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
    f = 440 * Math.pow(2, (n - 69) / 12);
    fcache[name] = f;
    return f;
  }

  function makeWaves(ctx) {
    function pulse(d) {
      var N = 32;
      var re = new Float32Array(N + 1), im = new Float32Array(N + 1);
      for (var n = 1; n <= N; n++) re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * d);
      try {
        return ctx.createPeriodicWave(re, im);
      } catch (e) {
        return null;
      }
    }
    waves.p25 = pulse(0.25);
    waves.p12 = pulse(0.125);
  }

  function setWave(o, type) {
    if (type === 'p25' || type === 'p12') {
      if (waves[type]) o.setPeriodicWave(waves[type]);
      else o.type = 'square';
    } else o.type = type;
  }

  /* one oscillator note */
  function tone(bus, o) {
    var ctx = A.ctx;
    var t0 = o.t;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    setWave(osc, o.type || 'square');
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + o.dur * (o.curve || 1));
    if (o.vib) {
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vib[0];
      lg.gain.value = o.vib[1];
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + o.dur + 0.05);
    }
    var a = o.attack === undefined ? 0.006 : o.attack;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol, t0 + a);
    if (o.sustain !== undefined) {
      g.gain.linearRampToValueAtTime(o.vol * o.sustain, t0 + o.dur * 0.55);
      g.gain.linearRampToValueAtTime(0.0001, t0 + o.dur);
    } else {
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    }
    osc.connect(g);
    g.connect(bus);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.03);
  }

  function noise(bus, o) {
    var ctx = A.ctx;
    var t0 = o.t;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.f0 || 2000, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.f1), t0 + o.dur);
    f.Q.value = o.q || 0.7;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.vol, t0 + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(t0, Math.floor(DM.vfxRng() * 30) / 10);
    src.stop(t0 + o.dur + 0.03);
  }

  /* play a list of [note, startSec, durSec] on a voice */
  function melody(list, o) {
    var t = A.ctx.currentTime + 0.02;
    list.forEach(function (n) {
      tone(sfxBus, {
        t: t + n[1],
        f0: freq(n[0]),
        dur: n[2],
        vol: (n[3] || 1) * o.vol,
        type: o.type || 'square',
        sustain: o.sustain,
        vib: o.vib
      });
    });
  }

  /* ------------------------------------------------------------------ SFX */
  var SFX = {
    start: function (t) {
      [['C5', 0], ['E5', 0.11], ['G5', 0.22]].forEach(function (n, i) {
        tone(sfxBus, { t: t + n[1], f0: freq(n[0]), dur: i === 2 ? 0.17 : 0.1, vol: 0.22, type: 'square', sustain: 0.6 });
      });
      tone(sfxBus, { t: t + 0.22, f0: freq('C6'), dur: 0.17, vol: 0.1, type: 'triangle' });
    },
    place: function (t) {
      tone(sfxBus, { t: t, f0: 210, f1: 78, dur: 0.1, vol: 0.34, type: 'sine', curve: 0.9 });
      tone(sfxBus, { t: t, f0: 420, f1: 150, dur: 0.05, vol: 0.12, type: 'triangle' });
    },
    explode: function (t) {
      noise(sfxBus, { t: t, dur: 0.55, vol: 0.2, filter: 'lowpass', f0: 3400, f1: 160, q: 0.9 });
      tone(sfxBus, { t: t, f0: 130, f1: 34, dur: 0.5, vol: 0.14, type: 'sawtooth', curve: 0.8 });
      tone(sfxBus, { t: t, f0: 62, f1: 28, dur: 0.45, vol: 0.12, type: 'sine' });
      noise(sfxBus, { t: t + 0.02, dur: 0.12, vol: 0.08, filter: 'highpass', f0: 2500, q: 0.6 });
    },
    break: function (t) {
      noise(sfxBus, { t: t, dur: 0.14, vol: 0.26, filter: 'bandpass', f0: 1800, f1: 700, q: 1.2 });
      tone(sfxBus, { t: t, f0: 180, f1: 90, dur: 0.06, vol: 0.14, type: 'square' });
    },
    enemyDie: function (t) {
      tone(sfxBus, { t: t, f0: 880, f1: 110, dur: 0.3, vol: 0.24, type: 'square', sustain: 0.7, curve: 0.9 });
      tone(sfxBus, { t: t + 0.02, f0: 440, f1: 55, dur: 0.26, vol: 0.14, type: 'triangle' });
    },
    hit: function (t) {
      tone(sfxBus, { t: t, f0: 1320, dur: 0.15, vol: 0.2, type: 'square' });
      tone(sfxBus, { t: t, f0: 1980, dur: 0.11, vol: 0.14, type: 'square' });
      tone(sfxBus, { t: t, f0: 2764, dur: 0.06, vol: 0.1, type: 'triangle' });
    },
    playerDie: function (t) {
      tone(sfxBus, { t: t, f0: 760, f1: 44, dur: 0.95, vol: 0.22, type: 'square', sustain: 0.8, curve: 1, vib: [11, 24] });
      tone(sfxBus, { t: t + 0.05, f0: 380, f1: 30, dur: 0.85, vol: 0.14, type: 'triangle' });
      noise(sfxBus, { t: t, dur: 0.25, vol: 0.08, filter: 'lowpass', f0: 1800, f1: 200 });
    },
    item: function (t) {
      tone(sfxBus, { t: t, f0: freq('E6'), dur: 0.09, vol: 0.2, type: 'square', sustain: 0.8 });
      tone(sfxBus, { t: t + 0.08, f0: freq('A6'), dur: 0.13, vol: 0.2, type: 'square', sustain: 0.6 });
      tone(sfxBus, { t: t + 0.08, f0: freq('A5'), dur: 0.13, vol: 0.1, type: 'triangle' });
    },
    life: function (t) {
      [['C5', 0], ['E5', 0.13], ['G5', 0.26], ['C6', 0.39]].forEach(function (n, i) {
        tone(sfxBus, { t: t + n[1], f0: freq(n[0]), dur: i === 3 ? 0.24 : 0.12, vol: 0.22, type: 'square', sustain: 0.7 });
        tone(sfxBus, { t: t + n[1], f0: freq(n[0]) / 2, dur: i === 3 ? 0.24 : 0.12, vol: 0.12, type: 'triangle' });
      });
    },
    exitOpen: function (t) {
      [['G4', 0, 0.1], ['C5', 0.1, 0.1], ['E5', 0.2, 0.1], ['G5', 0.3, 0.22]].forEach(function (n) {
        tone(sfxBus, { t: t + n[1], f0: freq(n[0]), dur: n[2], vol: 0.24, type: 'square', sustain: 0.8 });
        tone(sfxBus, { t: t + n[1], f0: freq(n[0]) / 2, dur: n[2], vol: 0.14, type: 'triangle' });
      });
      tone(sfxBus, { t: t + 0.3, f0: freq('C6'), dur: 0.22, vol: 0.1, type: 'square' });
    },
    stageClear: function (t) {
      var l = [['C5', 0, 0.12], ['E5', 0.14, 0.12], ['G5', 0.28, 0.12], ['C6', 0.42, 0.26], ['G5', 0.72, 0.12], ['C6', 0.86, 0.12], ['E6', 1.0, 0.12], ['G6', 1.14, 0.7]];
      l.forEach(function (n) {
        tone(sfxBus, { t: t + n[1], f0: freq(n[0]), dur: n[2], vol: 0.16, type: 'p25', sustain: 0.8 });
      });
      [['C3', 0, 0.4], ['G3', 0.42, 0.28], ['C3', 0.72, 0.4], ['F3', 1.14, 0.3], ['C3', 1.44, 0.6]].forEach(function (n) {
        tone(sfxBus, { t: t + n[1], f0: freq(n[0]), dur: n[2], vol: 0.16, type: 'triangle', sustain: 0.9 });
      });
      ['C5', 'E5', 'G5'].forEach(function (n) {
        tone(sfxBus, { t: t + 1.14, f0: freq(n), dur: 0.9, vol: 0.05, type: 'square', sustain: 0.6 });
      });
    },
    gameOver: function (t) {
      var l = [['A4', 0, 0.5], ['G4', 0.5, 0.4], ['F4', 0.9, 0.4], ['E4', 1.3, 0.4], ['D4', 1.7, 0.9]];
      l.forEach(function (n, i) {
        tone(sfxBus, { t: t + n[1], f0: freq(n[0]), dur: n[2], vol: 0.22, type: 'p25', sustain: 0.85, vib: [5.5, 6] });
        tone(sfxBus, { t: t + n[1], f0: freq(n[0]) / 2, dur: n[2], vol: 0.2, type: 'triangle', sustain: 0.9 });
      });
      tone(sfxBus, { t: t + 1.7, f0: freq('D5'), f1: freq('D4'), dur: 0.9, vol: 0.1, type: 'sine' });
    },
    gameClear: function (t) {
      var l = [
        ['G4', 0, 0.14], ['B4', 0.16, 0.14], ['D5', 0.32, 0.14], ['G5', 0.48, 0.3],
        ['F#5', 0.86, 0.14], ['A5', 1.02, 0.14], ['D6', 1.18, 0.3],
        ['E5', 1.56, 0.14], ['G5', 1.72, 0.14], ['B5', 1.88, 0.14], ['E6', 2.04, 0.3],
        ['D6', 2.42, 0.14], ['B5', 2.58, 0.14], ['G5', 2.74, 0.14], ['D6', 2.9, 0.16], ['G6', 3.1, 0.7]
      ];
      l.forEach(function (n) {
        tone(sfxBus, { t: t + n[1], f0: freq(n[0]), dur: n[2], vol: 0.16, type: 'p25', sustain: 0.85 });
      });
      [['G3', 0, 0.8], ['E3', 0.86, 0.68], ['C3', 1.56, 0.8], ['D3', 2.42, 0.6], ['G3', 3.1, 0.9]].forEach(function (n) {
        tone(sfxBus, { t: t + n[1], f0: freq(n[0]), dur: n[2], vol: 0.16, type: 'triangle', sustain: 0.9 });
      });
      ['G4', 'B4', 'D5', 'G5'].forEach(function (n) {
        tone(sfxBus, { t: t + 3.1, f0: freq(n), dur: 0.8, vol: 0.04, type: 'square', sustain: 0.7 });
      });
      /* sparkle */
      [0.5, 1.2, 2.06, 3.1].forEach(function (s, i) {
        tone(sfxBus, { t: t + s, f0: 3200 + i * 300, f1: 5200, dur: 0.16, vol: 0.05, type: 'sine' });
      });
    },
    pause: function (t) {
      tone(sfxBus, { t: t, f0: 660, dur: 0.05, vol: 0.2, type: 'square' });
      tone(sfxBus, { t: t + 0.05, f0: 990, dur: 0.06, vol: 0.2, type: 'square' });
    },
    warn: function (t) {
      tone(sfxBus, { t: t, f0: 1500, dur: 0.05, vol: 0.14, type: 'square' });
    }
  };

  var TRIM = {
    start: 1,
    place: 2.6,
    explode: 2.4,
    break: 4.6,
    enemyDie: 1.3,
    hit: 2.6,
    playerDie: 0.95,
    item: 1,
    life: 0.9,
    exitOpen: 0.72,
    stageClear: 0.72,
    gameOver: 0.66,
    gameClear: 0.7,
    pause: 1.6,
    warn: 4
  };

  /* ------------------------------------------------------------------ BGM data */
  /* Tokens are eighth notes, 8 per bar. 'C4' triggers a note, '.' holds, '-' rests. */
  function T(s) {
    return s.trim().split(/\s+/);
  }
  function arpBar(a, b, c) {
    return [a, b, c, b, a, b, c, b].join(' ');
  }
  function bassBar(r, f, style) {
    switch (style) {
      case 'a': return [r, '.', r, '.', r, '.', f, '.'].join(' ');
      case 'b': return [r, r, '.', r, r, '.', f, '.'].join(' ');
      case 'c': return [r, '.', '.', '.', f, '.', '.', '.'].join(' ');
      case 'd': return [r, r, r, r, r, r, f, f].join(' ');
      case 'e': return [r, '.', '.', '.', '.', '.', '.', '.'].join(' ');
      default: return [r, '.', r, '.', r, '.', r, '.'].join(' ');
    }
  }
  var DR = {
    r: 'k h s h k h s h',
    f: 'k h s h k k s h',
    d: 'k k s k k k s k',
    l: 'k - - - s - - -',
    t: 'h - h - h - h -',
    n: '- - - - - - - -'
  };
  function join(arr) {
    return arr.join(' ');
  }

  var TRACKS = {};
  TRACKS.title = {
    bpm: 112,
    lead: {
      type: 'p25',
      vol: 0.28,
      seq: join(['G4 . B4 . D5 . B4 G4', 'E5 . D5 . B4 . G4 .', 'C5 . E5 . G5 . E5 C5', 'D5 . F#5 . A5 . F#5 D5', 'G4 . B4 . D5 . G5 .', 'F#5 . E5 . D5 . B4 .', 'C5 . D5 . E5 . D5 C5', 'D5 . . . G5 . . .'])
    },
    arp: {
      type: 'p12',
      vol: 0.12,
      seq: join([arpBar('G3', 'B3', 'D4'), arpBar('E3', 'G3', 'B3'), arpBar('C4', 'E4', 'G4'), arpBar('D4', 'F#4', 'A4'), arpBar('G3', 'B3', 'D4'), arpBar('E3', 'G3', 'B3'), arpBar('C4', 'E4', 'G4'), arpBar('D4', 'F#4', 'A4')])
    },
    bass: {
      type: 'triangle',
      vol: 0.3,
      seq: join([bassBar('G2', 'D3', 'a'), bassBar('E2', 'B2', 'a'), bassBar('C2', 'G2', 'a'), bassBar('D2', 'A2', 'a'), bassBar('G2', 'D3', 'a'), bassBar('E2', 'B2', 'a'), bassBar('C2', 'G2', 'a'), bassBar('D2', 'D3', 'c')])
    },
    drums: join([DR.r, DR.r, DR.r, DR.f, DR.r, DR.r, DR.r, DR.f])
  };
  TRACKS.stage1 = {
    bpm: 128,
    lead: {
      type: 'p25',
      vol: 0.28,
      seq: join(['E5 . E5 G5 . E5 C5 .', 'D5 . D5 F5 . D5 B4 .', 'C5 E5 G5 . C6 . G5 .', 'F5 . E5 D5 C5 . . .', 'E5 . E5 G5 . E5 C5 .', 'A5 . G5 F5 E5 . D5 .', 'C5 D5 E5 F5 G5 . E5 .', 'D5 . B4 G4 C5 . . .'])
    },
    arp: {
      type: 'p12',
      vol: 0.12,
      seq: join([arpBar('C4', 'E4', 'G4'), arpBar('B3', 'D4', 'G4'), arpBar('C4', 'E4', 'G4'), arpBar('A3', 'C4', 'F4'), arpBar('C4', 'E4', 'G4'), arpBar('A3', 'C4', 'F4'), arpBar('C4', 'E4', 'G4'), arpBar('B3', 'D4', 'G4')])
    },
    bass: {
      type: 'triangle',
      vol: 0.3,
      seq: join([bassBar('C2', 'G2', 'b'), bassBar('G2', 'D3', 'b'), bassBar('C2', 'G2', 'b'), bassBar('F2', 'C3', 'b'), bassBar('C2', 'G2', 'b'), bassBar('F2', 'C3', 'b'), bassBar('C2', 'G2', 'b'), bassBar('G2', 'G2', 'a')])
    },
    drums: join([DR.r, DR.r, DR.f, DR.r, DR.r, DR.r, DR.f, DR.f])
  };
  TRACKS.stage2 = {
    bpm: 104,
    lead: {
      type: 'p25',
      vol: 0.26,
      vib: [5.2, 5],
      seq: join(['D5 . F5 . A5 . G5 F5', 'E5 . D5 . B4 . D5 .', 'D5 . F5 . A5 . C6 .', 'A5 . G5 . E5 . F5 .', 'D5 . F5 A5 . D6 . A5', 'B5 . A5 . G5 . D5 .', 'F5 . E5 . D5 . C5 .', 'D5 . . . . . . .'])
    },
    arp: {
      type: 'p12',
      vol: 0.13,
      seq: join([arpBar('D4', 'F4', 'A4'), arpBar('G3', 'B3', 'D4'), arpBar('D4', 'F4', 'A4'), arpBar('C4', 'E4', 'G4'), arpBar('D4', 'F4', 'A4'), arpBar('G3', 'B3', 'D4'), arpBar('C4', 'E4', 'G4'), arpBar('D4', 'F4', 'A4')])
    },
    bass: {
      type: 'triangle',
      vol: 0.3,
      seq: join([bassBar('D2', 'A2', 'c'), bassBar('G2', 'D3', 'c'), bassBar('D2', 'A2', 'c'), bassBar('C2', 'G2', 'c'), bassBar('D2', 'A2', 'a'), bassBar('G2', 'D3', 'a'), bassBar('C2', 'G2', 'a'), bassBar('D2', 'D2', 'e')])
    },
    drums: join([DR.t, DR.l, DR.t, DR.l, DR.r, DR.r, DR.l, DR.l])
  };
  TRACKS.stage3 = {
    bpm: 120,
    lead: {
      type: 'p25',
      vol: 0.26,
      seq: join(['E5 G5 B5 . G5 B5 E6 .', 'E5 G5 C6 . G5 E5 C5 .', 'D5 G5 B5 . G5 D5 B4 .', 'F#5 A5 D6 . A5 F#5 D5 .', 'B4 E5 G5 . B5 . G5 E5', 'C5 E5 G5 . C6 . G5 E5', 'D5 F#5 A5 . D6 . A5 F#5', 'E5 . B4 . E5 . . .'])
    },
    arp: {
      type: 'p12',
      vol: 0.14,
      seq: join([arpBar('E4', 'G4', 'B4'), arpBar('C4', 'E4', 'G4'), arpBar('G3', 'B3', 'D4'), arpBar('D4', 'F#4', 'A4'), arpBar('E4', 'G4', 'B4'), arpBar('C4', 'E4', 'G4'), arpBar('D4', 'F#4', 'A4'), arpBar('E4', 'G4', 'B4')])
    },
    bass: {
      type: 'triangle',
      vol: 0.3,
      seq: join([bassBar('E2', 'B2', 'a'), bassBar('C2', 'G2', 'a'), bassBar('G2', 'D3', 'a'), bassBar('D2', 'A2', 'a'), bassBar('E2', 'B2', 'b'), bassBar('C2', 'G2', 'b'), bassBar('D2', 'A2', 'b'), bassBar('E2', 'E2', 'c')])
    },
    drums: join([DR.r, DR.r, DR.r, DR.r, DR.f, DR.r, DR.f, DR.f])
  };
  TRACKS.stage4 = {
    bpm: 144,
    lead: {
      type: 'p25',
      vol: 0.28,
      seq: join(['A4 . A4 C5 . A4 E5 .', 'F4 . F4 A4 . F4 C5 .', 'G4 . G4 B4 . G4 D5 .', 'E4 . G#4 B4 . E5 . D5', 'A4 . A4 C5 . E5 A5 .', 'F5 . E5 C5 . A4 F4 .', 'G4 . B4 D5 . G5 . F5', 'E5 . D5 . C5 . B4 .'])
    },
    arp: {
      type: 'p12',
      vol: 0.1,
      seq: join([arpBar('A3', 'C4', 'E4'), arpBar('F3', 'A3', 'C4'), arpBar('G3', 'B3', 'D4'), arpBar('E3', 'G#3', 'B3'), arpBar('A3', 'C4', 'E4'), arpBar('F3', 'A3', 'C4'), arpBar('G3', 'B3', 'D4'), arpBar('E3', 'G#3', 'B3')])
    },
    bass: {
      type: 'sawtooth',
      vol: 0.16,
      seq: join([bassBar('A1', 'E2', 'd'), bassBar('F1', 'C2', 'd'), bassBar('G1', 'D2', 'd'), bassBar('E1', 'B1', 'd'), bassBar('A1', 'E2', 'd'), bassBar('F1', 'C2', 'd'), bassBar('G1', 'D2', 'd'), bassBar('E1', 'E2', 'd')])
    },
    drums: join([DR.d, DR.d, DR.d, DR.f, DR.d, DR.d, DR.d, DR.f])
  };
  TRACKS.stage5 = {
    bpm: 92,
    lead: {
      type: 'p25',
      vol: 0.24,
      vib: [4.6, 7],
      seq: join(['C#5 . . . E5 . . .', 'G#4 . . . B4 . . .', 'A4 . . . C#5 . . .', 'B4 . . . G#4 . . .', 'C#5 . E5 . G#5 . F#5 .', 'E5 . . . B4 . . .', 'A4 . C#5 . E5 . . .', 'G#4 . . . . . . .'])
    },
    arp: {
      type: 'p12',
      vol: 0.12,
      seq: join([arpBar('C#4', 'E4', 'G#4'), arpBar('G#3', 'B3', 'D#4'), arpBar('A3', 'C#4', 'E4'), arpBar('B3', 'D#4', 'F#4'), arpBar('C#4', 'E4', 'G#4'), arpBar('G#3', 'B3', 'D#4'), arpBar('A3', 'C#4', 'E4'), arpBar('G#3', 'B3', 'D#4')])
    },
    bass: {
      type: 'triangle',
      vol: 0.3,
      seq: join([bassBar('C#2', 'C#2', 'e'), bassBar('G#1', 'G#1', 'e'), bassBar('A1', 'A1', 'e'), bassBar('B1', 'B1', 'e'), bassBar('C#2', 'G#2', 'c'), bassBar('G#1', 'D#2', 'c'), bassBar('A1', 'E2', 'c'), bassBar('G#1', 'G#1', 'e')])
    },
    drums: join([DR.t, DR.t, DR.l, DR.t, DR.l, DR.t, DR.l, DR.n])
  };

  /* pre-parse */
  Object.keys(TRACKS).forEach(function (k) {
    var tr = TRACKS[k];
    ['lead', 'arp', 'bass'].forEach(function (v) {
      tr[v].tok = T(tr[v].seq);
    });
    tr.dtok = T(tr.drums);
    tr.len = tr.lead.tok.length;
  });
  A.trackList = Object.keys(TRACKS);

  function stepSec(tr) {
    return 30 / tr.bpm / A.tempoMult;
  }

  function scheduleStep(b, tr) {
    var ctx = A.ctx;
    var i = b.step % tr.len;
    var t = b.next;
    var ss = stepSec(tr);
    ['lead', 'arp', 'bass'].forEach(function (v) {
      var voice = tr[v];
      var tk = voice.tok[i];
      if (!tk || tk === '.' || tk === '-') return;
      var n = 1;
      while (voice.tok[(i + n) % tr.len] === '.' && n < 8) n++;
      var dur = Math.max(0.05, n * ss * (v === 'bass' ? 0.92 : 0.88));
      tone(b.gain, {
        t: t,
        f0: freq(tk),
        dur: dur,
        vol: voice.vol,
        type: voice.type,
        sustain: v === 'arp' ? undefined : 0.75,
        vib: voice.vib && n >= 2 ? voice.vib : undefined,
        attack: v === 'bass' ? 0.01 : 0.006
      });
    });
    var d = tr.dtok[i];
    if (d === 'k') {
      tone(b.gain, { t: t, f0: 150, f1: 42, dur: 0.13, vol: 0.3, type: 'sine' });
    } else if (d === 's') {
      noise(b.gain, { t: t, dur: 0.1, vol: 0.2, filter: 'highpass', f0: 1800, q: 0.6 });
      tone(b.gain, { t: t, f0: 230, f1: 160, dur: 0.07, vol: 0.1, type: 'triangle' });
    } else if (d === 'h') {
      noise(b.gain, { t: t, dur: 0.035, vol: 0.09, filter: 'highpass', f0: 7000, q: 0.5 });
    }
  }

  function tick() {
    var ctx = A.ctx;
    if (!ctx || !bgmCur || A.muted) return;
    var tr = TRACKS[bgmCur.id];
    if (!tr) return;
    if (ctx.state !== 'running') {
      bgmCur.next = ctx.currentTime + 0.05;
      return;
    }
    if (bgmCur.next < ctx.currentTime) bgmCur.next = ctx.currentTime + 0.03;
    var guard = 0;
    while (bgmCur.next < ctx.currentTime + 0.14 && guard++ < 16) {
      scheduleStep(bgmCur, tr);
      bgmCur.next += stepSec(tr);
      bgmCur.step = (bgmCur.step + 1) % tr.len;
    }
  }

  /* ------------------------------------------------------------------ public API */
  A.unlock = function () {
    try {
      if (!A.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        var ctx = new AC();
        A.ctx = ctx;
        master = ctx.createGain();
        master.gain.value = A.muted ? 0 : 0.9;
        var comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 12;
        comp.ratio.value = 8;
        comp.attack.value = 0.003;
        comp.release.value = 0.2;
        master.connect(comp);
        comp.connect(ctx.destination);
        sfxBus = ctx.createGain();
        sfxBus.gain.value = 0.7;
        sfxBus.connect(master);
        bgmBus = ctx.createGain();
        bgmBus.gain.value = 0.13;
        bgmBus.connect(master);
        var len = ctx.sampleRate * 3;
        noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = noiseBuf.getChannelData(0);
        var r = DM.mulberry32(0xbadc0de);
        for (var i = 0; i < len; i++) d[i] = r() * 2 - 1;
        makeWaves(ctx);
        timer = setInterval(tick, 30);
        if (A.bgm) startTrack(A.bgm);
      }
      if (A.ctx.state === 'suspended') {
        var p = A.ctx.resume();
        if (p && p.catch) p.catch(function () {});
      }
      A.unlocked = true;
    } catch (e) {
      /* audio unavailable: the game keeps running silently */
    }
  };

  function startTrack(id) {
    var ctx = A.ctx;
    if (!ctx || !TRACKS[id]) return;
    stopTrack(0.08);
    var g = ctx.createGain();
    g.gain.value = A.paused ? 0.3 : 1;
    g.connect(bgmBus);
    bgmCur = { id: id, gain: g, step: 0, next: ctx.currentTime + 0.06 };
  }
  function stopTrack(fade) {
    var ctx = A.ctx;
    if (!ctx || !bgmCur) {
      bgmCur = null;
      return;
    }
    var g = bgmCur.gain;
    try {
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + (fade || 0.05));
      setTimeout(function () {
        try {
          g.disconnect();
        } catch (e) {}
      }, 400);
    } catch (e) {}
    bgmCur = null;
  }

  /* select the current BGM track id (null = silence). Always recorded, even when muted / locked. */
  A.setBgm = function (id) {
    id = id || null;
    if (id === A.bgm) return;
    A.bgm = id;
    if (!A.ctx) return;
    try {
      if (id) startTrack(id);
      else stopTrack(0.12);
    } catch (e) {}
  };

  A.setPaused = function (p) {
    A.paused = !!p;
    if (A.ctx && bgmCur) {
      try {
        bgmCur.gain.gain.setTargetAtTime(p ? 0.3 : 1, A.ctx.currentTime, 0.03);
      } catch (e) {}
    }
  };

  A.setMuted = function (m) {
    A.muted = !!m;
    if (A.ctx && master) {
      try {
        master.gain.cancelScheduledValues(A.ctx.currentTime);
        master.gain.setTargetAtTime(A.muted ? 0 : 0.9, A.ctx.currentTime, 0.01);
      } catch (e) {}
    }
  };

  A.setTempo = function (m) {
    A.tempoMult = m;
  };

  A.sfx = function (name) {
    A.sfxLog.push({ name: name, time: performance.now() });
    while (A.sfxLog.length > 20) A.sfxLog.shift();
    if (A.ctx && A.ctx.state === 'suspended') {
      try {
        var rp = A.ctx.resume();
        if (rp && rp.catch) rp.catch(function () {});
      } catch (e) {}
    }
    if (!A.ctx || A.muted || A.ctx.state !== 'running' || !SFX[name]) return;
    try {
      var now = A.ctx.currentTime;
      if (name === 'explode') {
        /* many bombs in a chain: keep the mix from stacking into mush */
        if (now - lastExplode < 0.05) return;
        lastExplode = now;
      }
      /* per-effect trim so every effect peaks at or below 0.35 (measured with tools/audio-check.js) */
      var realBus = sfxBus;
      var trim = A.ctx.createGain();
      trim.gain.value = TRIM[name] || 1;
      trim.connect(realBus);
      sfxBus = trim;
      try {
        SFX[name](now + 0.005);
      } finally {
        sfxBus = realBus;
      }
    } catch (e) {}
  };

  /* small introspection hooks used by the offline loudness check in tools/ (not used by the game) */
  A._tick = tick;
  A._trackSeconds = function (id) {
    var tr = TRACKS[id];
    return tr ? tr.len * stepSec(tr) : 0;
  };

  A.snapshot = function () {
    return {
      unlocked: A.unlocked,
      muted: A.muted,
      bgm: A.bgm,
      sfxLog: A.sfxLog.map(function (s) {
        return { name: s.name, time: s.time };
      })
    };
  };
})();
