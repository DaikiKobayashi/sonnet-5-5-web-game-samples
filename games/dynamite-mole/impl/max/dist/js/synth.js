/* synth.js - every sound in the game is synthesised here with the Web Audio API (chiptune style).
 * No audio files, no samples. All functions take (ctx, destination, startTime) so they also run on an
 * OfflineAudioContext (used by tools/verify-audio.js to check peak levels and lengths). */
(function (root) {
  'use strict';
  var DM = root.DM = root.DM || {};

  function freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  var NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function N(name) {
    var m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) throw new Error('bad note ' + name);
    return 12 * (parseInt(m[3], 10) + 1) + NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }

  /* ------------------------------------------------------------------ building blocks */
  function noiseBuf(ctx) {
    if (ctx.__dmNoise) return ctx.__dmNoise;
    var len = Math.floor(ctx.sampleRate * 1.5), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    var r = DM.mulberry32(0x2468ACE);
    for (var i = 0; i < len; i++) d[i] = r() * 2 - 1;
    ctx.__dmNoise = b;
    return b;
  }
  function pulseWave(ctx, duty) {
    ctx.__dmWaves = ctx.__dmWaves || {};
    var key = 'p' + duty;
    if (ctx.__dmWaves[key]) return ctx.__dmWaves[key];
    var n = 48, re = new Float32Array(n), im = new Float32Array(n);
    for (var k = 1; k < n; k++) {
      re[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
      im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
    }
    var w = ctx.createPeriodicWave(re, im);
    ctx.__dmWaves[key] = w;
    return w;
  }

  /*
   * tone: o = { type | duty, f, f2, t, d, v, a, s, rel, vib:[rateHz, cents] }
   *   percussive (default): attack a -> exponential decay to silence at t+d
   *   sustained (s given): attack, decay to v*s, hold, release over rel at the end
   */
  function tone(ctx, dest, o) {
    var osc = ctx.createOscillator(), g = ctx.createGain();
    if (o.duty) osc.setPeriodicWave(pulseWave(ctx, o.duty)); else osc.type = o.type || 'square';
    var t = o.t, d = o.d, a = o.a == null ? 0.003 : o.a;
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + d);
    g.gain.value = 0;                                   // silent before the first automation event (no stray samples)
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.v, t + a);
    if (o.s != null) {
      var rel = o.rel == null ? 0.04 : o.rel;
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.v * o.s), t + a + Math.min(0.1, d * 0.4));
      g.gain.setValueAtTime(Math.max(0.0002, o.v * o.s), Math.max(t + a + 0.01, t + d - rel));
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.v * o.s * 0.05), t + d);
    } else {
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.v * 0.03), t + d);
    }
    g.gain.linearRampToValueAtTime(0, t + d + 0.012);
    osc.connect(g);
    g.connect(dest);
    if (o.vib) {
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = o.vib[0];
      lg.gain.value = o.vib[1];
      lfo.connect(lg); lg.connect(osc.detune);
      lfo.start(t); lfo.stop(t + d + 0.03);
    }
    osc.start(t);
    osc.stop(t + d + 0.03);
    return osc;
  }

  /* filtered noise burst. o = { t, d, v, type, f, f2, q, a } */
  function noise(ctx, dest, o) {
    var src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf(ctx);
    src.loop = true;
    fl.type = o.type || 'lowpass';
    fl.Q.value = o.q == null ? 0.8 : o.q;
    fl.frequency.setValueAtTime(o.f, o.t);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), o.t + o.d);
    var a = o.a == null ? 0.002 : o.a;
    g.gain.value = 0;
    g.gain.setValueAtTime(0, o.t);
    g.gain.linearRampToValueAtTime(o.v, o.t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.v * 0.03), o.t + o.d);
    g.gain.linearRampToValueAtTime(0, o.t + o.d + 0.012);
    src.connect(fl); fl.connect(g); g.connect(dest);
    src.start(o.t, ((o.t * 7.13) % 1.0));
    src.stop(o.t + o.d + 0.03);
  }

  /* play a list of [midi, start, dur] with a voice spec */
  function line(ctx, dest, t0, notes, spec) {
    notes.forEach(function (n) {
      var o = { t: t0 + n[1], d: n[2], f: freq(n[0]), v: (n[3] != null ? n[3] : 1) * spec.v };
      if (spec.duty) o.duty = spec.duty; else o.type = spec.type;
      if (spec.s != null) { o.s = spec.s; o.rel = spec.rel; }
      if (spec.vib && n[2] > 0.3) o.vib = spec.vib;
      tone(ctx, dest, o);
    });
  }

  /* ------------------------------------------------------------------ sound effects (peak <= 0.35 each) */
  var SFX = {};

  SFX.start = function (ctx, d, t) {                       // rising three-note arpeggio, 0.36 s
    line(ctx, d, t, [[N('C5'), 0, 0.1], [N('E5'), 0.11, 0.1], [N('G5'), 0.22, 0.14]], { type: 'square', v: 0.13 });
    line(ctx, d, t, [[N('C6'), 0.22, 0.14]], { duty: 0.25, v: 0.06 });
  };
  SFX.place = function (ctx, d, t) {                       // low "pon", 0.1 s
    tone(ctx, d, { type: 'sine', f: 300, f2: 95, t: t, d: 0.1, v: 0.3, a: 0.002 });
    noise(ctx, d, { t: t, d: 0.03, v: 0.06, type: 'lowpass', f: 900, q: 0.5 });
  };
  SFX.explode = function (ctx, d, t) {                     // noise + falling boom, 0.5 s
    noise(ctx, d, { t: t, d: 0.5, v: 0.18, type: 'lowpass', f: 3400, f2: 160, q: 0.9, a: 0.004 });
    tone(ctx, d, { type: 'sine', f: 150, f2: 34, t: t, d: 0.48, v: 0.14, a: 0.004 });
    tone(ctx, d, { type: 'triangle', f: 70, f2: 28, t: t, d: 0.45, v: 0.07, a: 0.004 });
  };
  SFX['break'] = function (ctx, d, t) {                    // dry crunch, 0.15 s
    noise(ctx, d, { t: t, d: 0.14, v: 0.22, type: 'bandpass', f: 2200, f2: 700, q: 1.2 });
    tone(ctx, d, { type: 'square', f: 420, f2: 150, t: t, d: 0.06, v: 0.07 });
    tone(ctx, d, { type: 'square', f: 300, f2: 110, t: t + 0.05, d: 0.07, v: 0.05 });
  };
  SFX.enemyDie = function (ctx, d, t) {                    // falling blip, 0.3 s
    tone(ctx, d, { type: 'square', f: 760, f2: 110, t: t, d: 0.3, v: 0.17, a: 0.002, vib: [22, 60] });
    tone(ctx, d, { duty: 0.25, f: 1140, f2: 165, t: t, d: 0.22, v: 0.05 });
    noise(ctx, d, { t: t, d: 0.05, v: 0.09, type: 'highpass', f: 1800, q: 0.6 });
  };
  SFX.hit = function (ctx, d, t) {                         // metallic clang, 0.15 s
    tone(ctx, d, { type: 'square', f: 1180, t: t, d: 0.15, v: 0.09, a: 0.001 });
    tone(ctx, d, { type: 'square', f: 1770, t: t, d: 0.12, v: 0.07, a: 0.001 });
    tone(ctx, d, { type: 'triangle', f: 2830, t: t, d: 0.09, v: 0.07, a: 0.001 });
    noise(ctx, d, { t: t, d: 0.04, v: 0.1, type: 'highpass', f: 4000, q: 0.7 });
  };
  SFX.playerDie = function (ctx, d, t) {                   // long falling sweep, 0.9 s
    tone(ctx, d, { type: 'sawtooth', f: 760, f2: 52, t: t, d: 0.9, v: 0.15, a: 0.004, vib: [11, 90] });
    tone(ctx, d, { type: 'square', f: 380, f2: 40, t: t + 0.04, d: 0.85, v: 0.09, a: 0.004 });
    noise(ctx, d, { t: t, d: 0.12, v: 0.07, type: 'bandpass', f: 1500, f2: 300, q: 1 });
  };
  SFX.item = function (ctx, d, t) {                        // two-note chime, 0.2 s
    line(ctx, d, t, [[N('E6'), 0, 0.09], [N('B6'), 0.09, 0.12]], { type: 'square', v: 0.12 });
    line(ctx, d, t, [[N('E7'), 0.09, 0.1]], { type: 'triangle', v: 0.06 });
  };
  SFX.life = function (ctx, d, t) {                        // 4-note jingle, 0.6 s
    line(ctx, d, t, [[N('C5'), 0, 0.13], [N('E5'), 0.13, 0.13], [N('G5'), 0.26, 0.13], [N('C6'), 0.39, 0.22]], { type: 'square', v: 0.12 });
    line(ctx, d, t, [[N('E6'), 0.39, 0.22]], { duty: 0.25, v: 0.05 });
    line(ctx, d, t, [[N('C4'), 0, 0.2], [N('C4'), 0.39, 0.22]], { type: 'triangle', v: 0.1 });
  };
  SFX.exitOpen = function (ctx, d, t) {                    // short fanfare, 0.5 s
    line(ctx, d, t, [[N('G4'), 0, 0.09], [N('C5'), 0.09, 0.09], [N('E5'), 0.18, 0.09], [N('G5'), 0.27, 0.22]], { type: 'square', v: 0.11 });
    line(ctx, d, t, [[N('C5'), 0.27, 0.22], [N('E5'), 0.27, 0.22]], { duty: 0.25, v: 0.05 });
    line(ctx, d, t, [[N('C3'), 0, 0.25], [N('C3'), 0.27, 0.22]], { type: 'triangle', v: 0.12 });
  };
  SFX.stageClear = function (ctx, d, t) {                  // jingle, ~2.0 s
    var lead = [
      [N('G4'), 0, 0.1], [N('C5'), 0.11, 0.1], [N('E5'), 0.22, 0.1], [N('G5'), 0.33, 0.1],
      [N('E5'), 0.44, 0.1], [N('G5'), 0.55, 0.1], [N('C6'), 0.66, 0.5],
      [N('G5'), 1.2, 0.1], [N('E5'), 1.31, 0.1], [N('G5'), 1.42, 0.1], [N('C6'), 1.53, 0.5]
    ];
    line(ctx, d, t, lead, { type: 'square', v: 0.11, s: 0.7, rel: 0.05, vib: [6, 14] });
    line(ctx, d, t, [[N('E5'), 0.66, 0.5], [N('C5'), 1.53, 0.5], [N('E5'), 1.53, 0.5]], { duty: 0.25, v: 0.05, s: 0.7, rel: 0.05 });
    line(ctx, d, t, [[N('C3'), 0, 0.4], [N('G3'), 0.44, 0.4], [N('C3'), 0.88, 0.3], [N('F3'), 1.2, 0.3], [N('C3'), 1.53, 0.5]], { type: 'triangle', v: 0.13, s: 0.8, rel: 0.05 });
    [0, 1, 2, 3, 4, 5].forEach(function (i) { tone(ctx, d, { type: 'square', f: freq(N('C7')) * (i % 2 ? 1.25 : 1), t: t + 1.6 + i * 0.05, d: 0.06, v: 0.03 }); });
  };
  SFX.gameOver = function (ctx, d, t) {                    // sad descending jingle, ~2.7 s
    var lead = [[N('E4'), 0, 0.45], [N('D4'), 0.5, 0.45], [N('C4'), 1.0, 0.45], [N('B3'), 1.5, 0.45]];
    line(ctx, d, t, lead, { type: 'triangle', v: 0.19, s: 0.75, rel: 0.1, vib: [5, 10] });
    line(ctx, d, t, [[N('C4'), 0, 0.45], [N('B3'), 0.5, 0.45], [N('A3'), 1.0, 0.45], [N('G3'), 1.5, 0.45]], { duty: 0.25, v: 0.045, s: 0.75, rel: 0.1 });
    tone(ctx, d, { type: 'triangle', f: freq(N('A3')), f2: freq(N('A3')) * 0.93, t: t + 2.0, d: 0.7, v: 0.2, a: 0.01, vib: [4, 20] });
    tone(ctx, d, { type: 'sine', f: freq(N('A2')), f2: freq(N('A2')) * 0.95, t: t + 1.5, d: 1.2, v: 0.14, a: 0.05 });
  };
  SFX.gameClear = function (ctx, d, t) {                   // triumphant fanfare, ~3.6 s (a different tune from stageClear)
    var lead = [
      [N('C5'), 0, 0.12], [N('E5'), 0.14, 0.12], [N('G5'), 0.28, 0.12], [N('C6'), 0.42, 0.12],
      [N('G5'), 0.6, 0.1], [N('A5'), 0.7, 0.1], [N('B5'), 0.8, 0.1], [N('C6'), 0.9, 0.1], [N('D6'), 1.0, 0.1], [N('E6'), 1.1, 0.5],
      [N('A5'), 1.8, 0.16], [N('G5'), 1.98, 0.16], [N('F5'), 2.16, 0.16], [N('E5'), 2.34, 0.16],
      [N('D5'), 2.6, 0.13], [N('G5'), 2.75, 0.13], [N('B5'), 2.9, 0.13], [N('D6'), 3.05, 0.13],
      [N('E6'), 3.2, 0.4]
    ];
    line(ctx, d, t, lead, { type: 'square', v: 0.1, s: 0.75, rel: 0.05, vib: [6, 16] });
    line(ctx, d, t, [[N('E5'), 0.42, 0.12], [N('C6'), 1.1, 0.5], [N('G5'), 2.16, 0.3], [N('C6'), 3.2, 0.4], [N('G5'), 3.2, 0.4]], { duty: 0.25, v: 0.05, s: 0.75, rel: 0.05 });
    line(ctx, d, t, [[N('C3'), 0, 0.5], [N('G3'), 0.6, 0.5], [N('C3'), 1.1, 0.6], [N('F3'), 1.8, 0.7], [N('G3'), 2.6, 0.55], [N('C3'), 3.2, 0.4]], { type: 'triangle', v: 0.13, s: 0.85, rel: 0.06 });
    for (var i = 0; i < 8; i++) tone(ctx, d, { type: 'square', f: freq(i % 2 ? N('G6') : N('E6')), t: t + 3.2 + i * 0.05, d: 0.05, v: 0.025 });
  };
  SFX.pause = function (ctx, d, t) {                       // short blip, 0.1 s
    tone(ctx, d, { type: 'square', f: 880, t: t, d: 0.05, v: 0.13 });
    tone(ctx, d, { type: 'square', f: 1320, t: t + 0.05, d: 0.05, v: 0.13 });
  };
  SFX.warn = function (ctx, d, t) {                        // tick, 0.05 s
    tone(ctx, d, { type: 'square', f: 1600, t: t, d: 0.05, v: 0.13, a: 0.001 });
    tone(ctx, d, { type: 'sine', f: 800, t: t, d: 0.05, v: 0.12, a: 0.001 });
  };

  /* ------------------------------------------------------------------ BGM: compact pattern language */
  var CHORD_TYPES = { M: [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10] };

  function parseBar(str) {
    var out = [], pos = 0;
    str.trim().split(/\s+/).forEach(function (tok) {
      var p = tok.split(':'), len = p[1] ? parseInt(p[1], 10) : 2;
      if (p[0] !== '.') out.push({ step: pos, midi: N(p[0]), len: len });
      pos += len;
    });
    if (pos !== 16) throw new Error('bar does not add up to 16 steps: "' + str + '" = ' + pos);
    return out;
  }
  function chord(sym) {
    var m = /^([A-G][#b]?)(M|m7|m|7)$/.exec(sym);
    if (!m) throw new Error('bad chord ' + sym);
    var root = N(m[1] + '2');
    return { root: root, tones: CHORD_TYPES[m[2]].map(function (i) { return root + i; }) };
  }

  var BASS = {
    bounce: function (c, add) { for (var i = 0; i < 8; i++) add(i * 2, c.root + (i % 2 ? 12 : 0), 2, i % 4 === 0 ? 1 : 0.8); },
    fifth: function (c, add) { add(0, c.root, 3, 1); add(4, c.root, 3, 0.8); add(8, c.tones[2], 3, 0.9); add(12, c.root, 3, 0.8); },
    walk: function (c, add) { add(0, c.root, 4, 1); add(4, c.tones[1], 4, 0.8); add(8, c.tones[2], 4, 0.9); add(12, c.tones[1], 4, 0.8); },
    drive: function (c, add) { for (var i = 0; i < 16; i++) add(i, c.root + (i % 8 === 6 ? 12 : 0), 1, i % 4 === 0 ? 1 : 0.72); },
    drone: function (c, add) { add(0, c.root, 15, 1); },
    pulse: function (c, add) { add(0, c.root, 3, 1); add(6, c.root, 2, 0.7); add(8, c.root, 3, 0.9); add(14, c.root + 12, 2, 0.6); }
  };
  var ARP = {
    up16: function (c, add) { var t = c.tones, seq = [0, 1, 2, 1]; for (var i = 0; i < 16; i++) add(i, t[seq[i % 4] % t.length] + 24, 1, [0.9, 0.55, 0.7, 0.55][i % 4]); },
    sparkle: function (c, add) { var t = c.tones, seq = [2, 0, 1, 2, 1, 0, 2, 1]; for (var i = 0; i < 8; i++) add(i * 2, t[seq[i] % t.length] + 24, 2, [0.8, 0.5][i % 2]); },
    slow: function (c, add) { add(0, c.tones[2] + 24, 5, 0.8); add(8, c.tones[1] + 24, 5, 0.7); },
    off: function () { }
  };
  var DRUMS = {
    soft: { k: [0, 8], s: [], h: [2, 6, 10, 14] },
    rock: { k: [0, 8], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] },
    bounce: { k: [0, 6, 8, 10], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] },
    floor: { k: [0, 4, 8, 12], s: [4, 12], h: [2, 6, 10, 14] },
    heart: { k: [0, 3], s: [], h: [] },
    lite: { k: [0, 8], s: [12], h: [4, 12] }
  };

  /* Compile a song description into per-step event lists (16th-note grid, 8 bars) */
  function compile(def) {
    var steps = 8 * 16, ev = [], i;
    for (i = 0; i < steps; i++) ev.push([]);
    function add(step, ch, midi, len, vel) { if (step < steps) ev[step].push({ ch: ch, midi: midi, len: len, vel: vel }); }
    def.melody.forEach(function (bar, b) {
      parseBar(bar).forEach(function (n) { add(b * 16 + n.step, 'lead', n.midi, n.len, 1); });
    });
    def.chords.forEach(function (sym, b) {
      var c = chord(sym);
      BASS[def.bass](c, function (s, m, l, v) { add(b * 16 + s, 'bass', m, l, v); });
      if (def.arpBars[b]) ARP[def.arp](c, function (s, m, l, v) { add(b * 16 + s, 'arp', m, l, v); });
      var dr = DRUMS[def.drums];
      var fill = def.fill && (b % 4 === 3);
      for (i = 0; i < dr.k.length; i++) add(b * 16 + dr.k[i], 'kick', 0, 1, 1);
      for (i = 0; i < dr.s.length; i++) add(b * 16 + dr.s[i], 'snare', 0, 1, 1);
      for (i = 0; i < dr.h.length; i++) add(b * 16 + dr.h[i], 'hat', 0, 1, i % 2 ? 0.6 : 1);
      if (fill) { add(b * 16 + 13, 'snare', 0, 1, 0.6); add(b * 16 + 14, 'snare', 0, 1, 0.8); add(b * 16 + 15, 'snare', 0, 1, 1); }
    });
    return { id: def.id, bpm: def.bpm, steps: steps, stepDur: 60 / def.bpm / 4, ev: ev, def: def };
  }

  var SONGS = {
    title: { bpm: 96, bass: 'fifth', arp: 'sparkle', arpBars: [0, 0, 0, 0, 1, 1, 1, 1], drums: 'soft', fill: false, lead: { duty: 0.25, v: 1, vib: true }, echo: true,
      chords: ['Am', 'FM', 'CM', 'GM', 'Am', 'FM', 'GM', 'E7'],
      melody: ['A4:2 C5:2 E5:4 A5:4 G5:2 E5:2', 'F5:4 E5:2 D5:2 C5:4 A4:4', 'E5:2 G5:2 C6:4 B5:2 G5:2 E5:4', 'D5:4 B4:2 G4:2 B4:4 D5:4',
        'A4:2 C5:2 E5:4 A5:4 C6:2 B5:2', 'A5:4 G5:2 F5:2 E5:4 C5:4', 'D5:2 E5:2 G5:4 B5:4 A5:2 G5:2', 'E5:8 G#4:2 B4:2 E5:4'] },
    stage1: { bpm: 132, bass: 'bounce', arp: 'up16', arpBars: [0, 0, 0, 0, 1, 1, 1, 1], drums: 'rock', fill: true, lead: { duty: 0.25, v: 1 },
      chords: ['CM', 'GM', 'Am', 'FM', 'CM', 'GM', 'FM', 'GM'],
      melody: ['E5:2 E5:2 G5:2 E5:2 C5:2 E5:2 G5:4', 'D5:2 D5:2 B4:2 D5:2 G4:2 B4:2 D5:4', 'C5:2 C5:2 E5:2 C5:2 A4:2 C5:2 E5:4', 'A4:2 C5:2 F5:4 E5:2 D5:2 C5:4',
        'E5:2 G5:2 C6:4 B5:2 A5:2 G5:4', 'D5:2 G5:2 B5:4 A5:2 G5:2 D5:4', 'A5:2 G5:2 F5:2 E5:2 D5:2 C5:2 A4:4', 'G4:2 B4:2 D5:2 G5:2 F5:2 D5:2 B4:4'] },
    stage2: { bpm: 108, bass: 'walk', arp: 'sparkle', arpBars: [1, 1, 1, 1, 1, 1, 1, 1], drums: 'lite', fill: false, lead: { duty: 0.125, v: 1.1, vib: true }, echo: true,
      chords: ['Dm', 'BbM', 'FM', 'CM', 'Dm', 'BbM', 'CM', 'Am'],
      melody: ['D5:4 F5:2 A5:2 G5:4 F5:2 E5:2', 'D5:4 F5:4 E5:2 D5:2 Bb4:4', 'A4:2 C5:2 F5:4 E5:2 C5:2 A4:4', 'G4:4 C5:4 E5:4 D5:2 C5:2',
        'F5:2 A5:2 D6:4 C6:2 A5:2 F5:4', 'Bb5:4 A5:2 F5:2 D5:4 F5:4', 'E5:2 G5:2 C6:4 B5:2 G5:2 E5:4', 'A4:2 C5:2 E5:2 A5:2 G5:4 E5:4'] },
    stage3: { bpm: 120, bass: 'pulse', arp: 'up16', arpBars: [0, 1, 0, 1, 1, 1, 1, 1], drums: 'bounce', fill: true, lead: { duty: 0.25, v: 1 },
      chords: ['Em', 'CM', 'GM', 'DM', 'Em', 'CM', 'DM', 'B7'],
      melody: ['E5:2 G5:2 B5:4 A5:2 G5:2 E5:4', 'E5:2 G5:2 C6:4 B5:2 G5:2 E5:4', 'D5:2 G5:2 B5:4 A5:2 G5:2 D5:4', 'F#5:2 A5:2 D6:4 C#6:2 A5:2 F#5:4',
        'B5:4 A5:2 G5:2 E5:4 G5:4', 'C6:4 B5:2 A5:2 G5:4 E5:4', 'A5:2 F#5:2 D5:2 F#5:2 A5:4 D6:4', 'D#5:2 F#5:2 B5:4 A5:2 F#5:2 D#5:4'] },
    stage4: { bpm: 144, bass: 'drive', arp: 'off', arpBars: [0, 0, 0, 0, 0, 0, 0, 0], drums: 'floor', fill: true, lead: { duty: 0.5, v: 0.9 },
      chords: ['Am', 'Am', 'FM', 'EM', 'Am', 'Am', 'Dm', 'EM'],
      melody: ['A4:2 A4:2 C5:2 A4:2 E5:2 A4:2 C5:2 A4:2', 'E5:2 E5:2 G5:2 E5:2 A5:4 G5:2 E5:2', 'F5:2 F5:2 A5:2 F5:2 C6:4 A5:2 F5:2', 'E5:2 G#5:2 B5:4 G#5:2 E5:2 B4:4',
        'A4:2 A4:2 C5:2 A4:2 E5:2 A4:2 C5:2 A4:2', 'E5:2 E5:2 G5:2 E5:2 A5:4 C6:2 B5:2', 'D5:2 F5:2 A5:4 G5:2 F5:2 D5:4', 'E5:4 G#5:4 B5:4 E6:4'] },
    stage5: { bpm: 88, bass: 'drone', arp: 'slow', arpBars: [1, 1, 1, 1, 1, 1, 1, 1], drums: 'heart', fill: false, lead: { duty: 0.125, v: 1.15, vib: true }, echo: true,
      chords: ['F#m', 'DM', 'AM', 'EM', 'F#m', 'DM', 'C#m', 'C#7'],
      melody: ['F#5:6 A5:2 C#6:8', 'A5:4 F#5:4 D5:8', 'E5:6 C#5:2 A4:8', 'G#4:4 B4:4 E5:8',
        'C#6:4 A5:4 F#5:8', 'D6:6 A5:2 F#5:8', 'E5:4 G#5:4 C#6:4 B5:4', 'F5:4 G#5:4 B5:4 C#6:4'] }
  };
  var TRACKS = {};
  Object.keys(SONGS).forEach(function (id) { var d = SONGS[id]; d.id = id; TRACKS[id] = compile(d); });
  /* stage songs are addressed by the ids the game uses */

  /* per-instrument levels; the whole mix peaks below 0.2 (verified offline) */
  var LV = { lead: 0.045, arp: 0.021, bass: 0.073, kick: 0.073, snare: 0.043, hat: 0.017 };

  function bgmStep(ctx, out, track, step, time, dur) {
    var evs = track.ev[step], def = track.def;
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i], len = Math.max(0.05, e.len * dur);
      if (e.ch === 'lead') {
        var L = def.lead, o = { duty: L.duty, f: freq(e.midi), t: time, d: len * 0.98, v: LV.lead * L.v, a: 0.006, s: 0.6, rel: 0.05 };
        if (L.duty === 0.5) { delete o.duty; o.type = 'square'; }
        if (L.vib && e.len >= 4) o.vib = [5.5, 14];
        tone(ctx, out, o);
        if (def.echo) tone(ctx, out, { duty: L.duty === 0.5 ? undefined : L.duty, type: L.duty === 0.5 ? 'square' : undefined, f: freq(e.midi), t: time + dur * 3, d: len * 0.8, v: LV.lead * L.v * 0.32, a: 0.006, s: 0.6, rel: 0.05 });
      } else if (e.ch === 'bass') {
        tone(ctx, out, { type: 'triangle', f: freq(e.midi), t: time, d: Math.max(0.06, e.len * dur * 0.92), v: LV.bass * e.vel, a: 0.004, s: 0.8, rel: 0.03 });
      } else if (e.ch === 'arp') {
        tone(ctx, out, { duty: 0.125, f: freq(e.midi), t: time, d: Math.max(0.05, e.len * dur * 0.9), v: LV.arp * e.vel, a: 0.003 });
      } else if (e.ch === 'kick') {
        tone(ctx, out, { type: 'sine', f: 150, f2: 42, t: time, d: 0.11, v: LV.kick, a: 0.001 });
      } else if (e.ch === 'snare') {
        noise(ctx, out, { t: time, d: 0.11, v: LV.snare * e.vel, type: 'highpass', f: 1400, q: 0.5 });
        tone(ctx, out, { type: 'triangle', f: 210, f2: 140, t: time, d: 0.08, v: LV.snare * 0.8 * e.vel, a: 0.001 });
      } else if (e.ch === 'hat') {
        noise(ctx, out, { t: time, d: 0.035, v: LV.hat * e.vel, type: 'highpass', f: 7000, q: 0.7 });
      }
    }
  }

  DM.Synth = { sfx: SFX, tracks: TRACKS, bgmStep: bgmStep, N: N, freq: freq };
  /* the stage tracks are also reachable as 'stage1'...'stage5' (see SONGS) */
})(typeof window !== 'undefined' ? window : globalThis);
