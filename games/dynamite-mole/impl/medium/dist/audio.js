/* Web Audio synthesis: sfx + chiptune BGM. Everything is generated in code. */
(function () {
  var ctx = null, master = null, sfxBus = null, bgmBus = null, noiseBuf = null;
  var A = {
    unlocked: false, muted: false, bgm: null, sfxLog: [], paused: false, fast: false
  };

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  A.init = function () {
    if (ctx) { try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) {} return; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -8; comp.ratio.value = 6;
      master = ctx.createGain(); master.gain.value = A.muted ? 0 : 0.9;
      sfxBus = ctx.createGain(); sfxBus.gain.value = 1;
      bgmBus = ctx.createGain(); bgmBus.gain.value = A.paused ? 0.25 : 1;
      sfxBus.connect(master); bgmBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
      var n = ctx.sampleRate * 1, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      noiseBuf = b;
      if (ctx.state === 'suspended') ctx.resume();
      A.unlocked = true;
      resetBgmClock();
    } catch (e) { ctx = null; }
  };

  A.setMuted = function (m) {
    A.muted = !!m;
    if (master) { try { master.gain.value = A.muted ? 0 : 0.9; } catch (e) {} }
  };
  A.setPaused = function (p) {
    A.paused = !!p;
    if (bgmBus) { try { bgmBus.gain.value = p ? 0.25 : 1; } catch (e) {} }
  };

  function tone(o) {
    if (!ctx || A.muted) return;
    try {
      var t0 = ctx.currentTime + (o.delay || 0);
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(o.f0, t0);
      if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + o.dur);
      var v = Math.min(o.vol || 0.2, 0.3);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(v, t0 + (o.attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      osc.connect(g); g.connect(o.bus || sfxBus);
      if (o.vib) {
        var lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 9; lg.gain.value = o.vib; lfo.connect(lg); lg.connect(osc.frequency);
        lfo.start(t0); lfo.stop(t0 + o.dur + 0.02);
      }
      osc.start(t0); osc.stop(t0 + o.dur + 0.02);
    } catch (e) {}
  }
  function noise(o) {
    if (!ctx || A.muted || !noiseBuf) return;
    try {
      var t0 = ctx.currentTime + (o.delay || 0);
      var src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      src.buffer = noiseBuf; src.loop = true;
      f.type = o.ftype || 'lowpass';
      f.frequency.setValueAtTime(o.fa, t0);
      if (o.fb) f.frequency.exponentialRampToValueAtTime(o.fb, t0 + o.dur);
      var v = Math.min(o.vol || 0.2, 0.3);
      g.gain.setValueAtTime(v, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
      src.start(t0, Math.random() * 0.5); src.stop(t0 + o.dur + 0.02);
    } catch (e) {}
  }
  function seq(notes, type, vol, step) {
    var t = 0;
    notes.forEach(function (n) {
      var d = n[1] * (step || 1);
      if (n[0] !== null) tone({ f0: mtof(n[0]), dur: d * 1.1, delay: t, type: type, vol: vol });
      t += d;
    });
  }

  var lastExplode = 0;
  var SFX = {
    start: function () { seq([[72, 0.1], [76, 0.1], [79, 0.16]], 'square', 0.2); },
    place: function () { tone({ f0: 220, f1: 80, dur: 0.1, type: 'triangle', vol: 0.3 }); },
    explode: function () {
      var now = performance.now(); if (now - lastExplode < 40) return; lastExplode = now;
      noise({ fa: 2400, fb: 120, dur: 0.55, vol: 0.3 });
      tone({ f0: 150, f1: 38, dur: 0.5, type: 'sawtooth', vol: 0.25 });
    },
    break: function () { noise({ fa: 1200, fb: 3000, ftype: 'highpass', dur: 0.15, vol: 0.18 }); tone({ f0: 300, f1: 120, dur: 0.08, type: 'square', vol: 0.1 }); },
    enemyDie: function () { tone({ f0: 800, f1: 130, dur: 0.3, type: 'square', vol: 0.2 }); tone({ f0: 400, f1: 60, dur: 0.3, type: 'triangle', vol: 0.15, delay: 0.03 }); },
    hit: function () { tone({ f0: 1500, dur: 0.15, type: 'square', vol: 0.15 }); tone({ f0: 2250, dur: 0.1, type: 'triangle', vol: 0.15 }); noise({ fa: 4000, ftype: 'highpass', dur: 0.05, vol: 0.12 }); },
    playerDie: function () { tone({ f0: 900, f1: 50, dur: 0.95, type: 'sawtooth', vol: 0.2, vib: 40 }); tone({ f0: 450, f1: 30, dur: 0.95, type: 'square', vol: 0.12 }); },
    item: function () { seq([[84, 0.07], [91, 0.12]], 'square', 0.17); },
    life: function () { seq([[72, 0.13], [76, 0.13], [79, 0.13], [84, 0.24]], 'square', 0.2); },
    exitOpen: function () { seq([[67, 0.08], [72, 0.08], [76, 0.08], [79, 0.08], [84, 0.2]], 'square', 0.18); tone({ f0: mtof(60), dur: 0.5, type: 'triangle', vol: 0.2 }); },
    stageClear: function () {
      seq([[72, 0.14], [72, 0.14], [72, 0.14], [76, 0.3], [74, 0.14], [77, 0.14], [79, 0.14], [84, 0.6]], 'square', 0.17);
      seq([[48, 0.28], [48, 0.28], [55, 0.28], [52, 0.28], [55, 0.28], [60, 0.6]], 'triangle', 0.22);
    },
    gameOver: function () {
      seq([[69, 0.35], [67, 0.35], [65, 0.35], [64, 0.35], [62, 0.5], [60, 0.9]], 'triangle', 0.25);
      seq([[57, 0.35], [55, 0.35], [53, 0.35], [52, 0.35], [50, 0.5], [45, 0.9]], 'square', 0.1);
    },
    gameClear: function () {
      var m = [[72, 0.16], [76, 0.16], [79, 0.16], [84, 0.32], [79, 0.16], [84, 0.16], [88, 0.5], [86, 0.16], [84, 0.16], [83, 0.16], [84, 0.16], [88, 0.3], [91, 0.9]];
      seq(m, 'square', 0.16);
      seq([[48, 0.32], [52, 0.32], [55, 0.32], [48, 0.32], [55, 0.32], [52, 0.32], [55, 0.32], [60, 0.9]], 'triangle', 0.22);
    },
    pause: function () { tone({ f0: 880, dur: 0.05, type: 'square', vol: 0.13 }); tone({ f0: 660, dur: 0.05, delay: 0.05, type: 'square', vol: 0.13 }); },
    warn: function () { tone({ f0: 1800, dur: 0.05, type: 'square', vol: 0.09 }); }
  };

  A.sfx = function (name) {
    A.sfxLog.push({ name: name, time: performance.now() });
    if (A.sfxLog.length > 20) A.sfxLog.shift();
    if (ctx && SFX[name]) { try { SFX[name](); } catch (e) {} }
  };

  /* ------------- BGM ------------- */
  var SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11], lydian: [0, 2, 4, 6, 7, 9, 11]
  };
  var DEFS = {
    title: { root: 57, scale: 'minor', prog: [0, 5, 2, 6], tempo: 96, lead: 'triangle', lv: 0.13, seed: 11 },
    stage1: { root: 55, scale: 'major', prog: [0, 3, 4, 0], tempo: 128, lead: 'square', lv: 0.07, seed: 21 },
    stage2: { root: 52, scale: 'lydian', prog: [0, 1, 4, 3], tempo: 118, lead: 'triangle', lv: 0.14, seed: 22 },
    stage3: { root: 57, scale: 'dorian', prog: [0, 3, 6, 4], tempo: 136, lead: 'square', lv: 0.07, seed: 23 },
    stage4: { root: 50, scale: 'phrygian', prog: [0, 1, 0, 6], tempo: 144, lead: 'sawtooth', lv: 0.05, seed: 24 },
    stage5: { root: 47, scale: 'harm', prog: [0, 5, 3, 4], tempo: 132, lead: 'square', lv: 0.06, seed: 25 }
  };
  function degMidi(root, sc, deg) {
    var s = SCALES[sc];
    return root + 12 * Math.floor(deg / 7) + s[((deg % 7) + 7) % 7];
  }
  var built = {};
  function build(id) {
    if (built[id]) return built[id];
    var d = DEFS[id], rng = Level.mulberry32(d.seed * 977);
    var mel = [], bass = [], pos = 7 + 2;
    for (var s = 0; s < 64; s++) {
      var cd = d.prog[Math.floor(s / 8) % d.prog.length];
      var tones = [cd, cd + 2, cd + 4, cd + 7, cd + 9, cd + 11];
      if (s % 4 === 0) {
        var best = tones[0], bd = 99;
        tones.forEach(function (t) { var dd = Math.abs(t + 7 - pos); if (dd < bd) { bd = dd; best = t + 7; } });
        pos = best;
        mel.push(degMidi(d.root, d.scale, pos));
      } else {
        var r = rng();
        if (r < (s % 2 ? 0.35 : 0.2)) { mel.push(null); }
        else {
          var mv = [-2, -1, -1, 0, 1, 1, 2][Math.floor(rng() * 7)];
          pos = Math.max(5, Math.min(15, pos + mv));
          mel.push(degMidi(d.root, d.scale, pos));
        }
      }
      var bm = degMidi(d.root - 12, d.scale, cd);
      if (s % 2 === 0) bass.push(s % 8 === 6 ? bm + 7 : (s % 4 === 2 ? bm + 12 : bm)); else bass.push(null);
    }
    built[id] = { d: d, mel: mel, bass: bass };
    return built[id];
  }

  var bg = { id: null, step: 0, next: 0 };
  function resetBgmClock() { if (ctx) { bg.next = ctx.currentTime + 0.06; bg.step = 0; } }
  A.setBgm = function (id) {
    if (A.bgm === id) return;
    A.bgm = id;
    resetBgmClock();
  };
  A.setFast = function (f) { A.fast = !!f; };

  function playStep(tr, s, t) {
    var d = tr.d, sd = 60 / (d.tempo * (A.fast ? 1.3 : 1)) / 2;
    var m = tr.mel[s], b = tr.bass[s];
    try {
      if (m !== null && m !== undefined) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = d.lead; o.frequency.value = mtof(m);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(d.lv, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + sd * 1.7);
        o.connect(g); g.connect(bgmBus); o.start(t); o.stop(t + sd * 1.8);
      }
      if (b !== null && b !== undefined) {
        var o2 = ctx.createOscillator(), g2 = ctx.createGain();
        o2.type = 'triangle'; o2.frequency.value = mtof(b);
        g2.gain.setValueAtTime(0.0001, t); g2.gain.linearRampToValueAtTime(0.16, t + 0.01);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + sd * 1.9);
        o2.connect(g2); g2.connect(bgmBus); o2.start(t); o2.stop(t + sd * 2);
      }
      if (s % 2 === 1 && A.bgm !== 'title') {
        var src = ctx.createBufferSource(), hg = ctx.createGain(), hf = ctx.createBiquadFilter();
        src.buffer = noiseBuf; hf.type = 'highpass'; hf.frequency.value = 6000;
        hg.gain.setValueAtTime(0.03, t); hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        src.connect(hf); hf.connect(hg); hg.connect(bgmBus); src.start(t, Math.random() * 0.5); src.stop(t + 0.06);
      }
    } catch (e) {}
  }
  setInterval(function () {
    if (!ctx || !A.bgm || !DEFS[A.bgm] || ctx.state !== 'running') return;
    var tr = build(A.bgm);
    if (bg.next < ctx.currentTime - 0.3) bg.next = ctx.currentTime + 0.05;
    while (bg.next < ctx.currentTime + 0.25) {
      var sd = 60 / (tr.d.tempo * (A.fast ? 1.3 : 1)) / 2;
      if (!A.muted) playStep(tr, bg.step % 64, bg.next);
      bg.next += sd; bg.step++;
    }
  }, 40);

  window.Audio2 = A;
})();
