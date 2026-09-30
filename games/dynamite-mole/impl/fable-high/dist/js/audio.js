/* Dynamite Mole - Web Audio synthesis: chiptune SFX + sequenced BGM. No external files. */
var Sound = (function () {
  'use strict';

  var ctx = null, master = null, sfxBus = null, bgmBus = null, comp = null;
  var unlocked = false, muted = false;
  var sfxLog = [];
  var bgmId = null;          // track id per spec ('title', 'stage1'.. or null)
  var lastExplode = -1000;
  var noiseBuf = null;

  /* ---------- note helpers ---------- */
  var NOTE_IDX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function freq(name) {
    var m = /^([A-G][#b]?)(-?\d)$/.exec(name);
    if (!m) return 440;
    var n = NOTE_IDX[m[1]] + (parseInt(m[2], 10) + 1) * 12;
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12; comp.knee.value = 20; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
      master = ctx.createGain();
      sfxBus = ctx.createGain(); sfxBus.gain.value = 1;
      bgmBus = ctx.createGain(); bgmBus.gain.value = 1;
      sfxBus.connect(master); bgmBus.connect(master);
      master.connect(comp); comp.connect(ctx.destination);
      master.gain.value = muted ? 0 : 1;
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  function unlock() {
    if (!ensure()) return;
    try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) { /* ignore */ }
    if (!unlocked) {
      unlocked = true;
      if (bgmId && !seq.running && !seq.paused) startSong(bgmId);
    }
  }

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : 1;
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  /* ---------- primitive voices ---------- */
  function tone(bus, type, f0, f1, t0, dur, peak, opts) {
    if (!ctx) return null;
    opts = opts || {};
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) {
      if (opts.linear) o.frequency.linearRampToValueAtTime(f1, t0 + dur);
      else o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    }
    var a = opts.attack || 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    if (opts.hold) g.gain.setValueAtTime(peak, t0 + dur - (opts.release || 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus);
    o.start(t0); o.stop(t0 + dur + 0.02);
    return o;
  }
  function noise(bus, t0, dur, peak, filterType, f0, f1, q) {
    if (!ctx) return null;
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    var flt = ctx.createBiquadFilter();
    flt.type = filterType || 'lowpass';
    flt.frequency.setValueAtTime(f0 || 1000, t0);
    if (f1) flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    flt.Q.value = q || 0.7;
    var g = ctx.createGain();
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(flt); flt.connect(g); g.connect(bus);
    s.start(t0); s.stop(t0 + dur + 0.02);
    return s;
  }

  /* ---------- sound effects ---------- */
  var SFX = {
    start: function (t) {
      tone(sfxBus, 'square', freq('C5'), null, t, 0.1, 0.2);
      tone(sfxBus, 'square', freq('E5'), null, t + 0.1, 0.1, 0.2);
      tone(sfxBus, 'square', freq('G5'), null, t + 0.2, 0.18, 0.22);
    },
    place: function (t) {
      tone(sfxBus, 'sine', 220, 110, t, 0.1, 0.3);
      tone(sfxBus, 'triangle', 330, 140, t, 0.08, 0.12);
    },
    explode: function (t) {
      noise(sfxBus, t, 0.5, 0.35, 'lowpass', 2200, 120, 0.5);
      tone(sfxBus, 'sine', 140, 35, t, 0.45, 0.3);
      tone(sfxBus, 'sawtooth', 90, 30, t, 0.35, 0.1);
    },
    'break': function (t) {
      noise(sfxBus, t, 0.15, 0.25, 'bandpass', 1800, 600, 1.2);
      tone(sfxBus, 'square', 500, 180, t, 0.08, 0.1);
    },
    enemyDie: function (t) {
      tone(sfxBus, 'square', 820, 180, t, 0.3, 0.22);
      tone(sfxBus, 'triangle', 1200, 300, t + 0.03, 0.22, 0.12);
    },
    hit: function (t) {
      tone(sfxBus, 'square', 1250, 1250, t, 0.15, 0.18);
      tone(sfxBus, 'triangle', 1870, 1600, t, 0.12, 0.14);
      noise(sfxBus, t, 0.06, 0.15, 'highpass', 3000, 3000, 1);
    },
    playerDie: function (t) {
      var o = tone(sfxBus, 'sawtooth', 640, 70, t, 0.9, 0.22);
      tone(sfxBus, 'square', 320, 40, t, 0.9, 0.12);
      if (o && ctx) {
        var lfo = ctx.createOscillator(); var lg = ctx.createGain();
        lfo.frequency.value = 12; lg.gain.value = 25;
        lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 0.95);
      }
    },
    item: function (t) {
      tone(sfxBus, 'square', freq('E5'), null, t, 0.09, 0.2);
      tone(sfxBus, 'square', freq('A5'), null, t + 0.09, 0.12, 0.22);
    },
    life: function (t) {
      var n = ['C5', 'E5', 'G5', 'C6'];
      for (var i = 0; i < 4; i++) tone(sfxBus, 'square', freq(n[i]), null, t + i * 0.13, i === 3 ? 0.25 : 0.13, 0.2);
      tone(sfxBus, 'triangle', freq('C4'), null, t, 0.6, 0.12);
    },
    exitOpen: function (t) {
      var n = ['G4', 'C5', 'E5', 'G5'];
      for (var i = 0; i < 4; i++) tone(sfxBus, 'square', freq(n[i]), null, t + i * 0.1, i === 3 ? 0.22 : 0.1, 0.2);
      tone(sfxBus, 'triangle', freq('C5'), null, t + 0.3, 0.25, 0.14);
    },
    stageClear: function (t) {
      var seqn = [['C5', 0.12], ['E5', 0.12], ['G5', 0.12], ['C6', 0.3], ['G5', 0.12], ['A5', 0.12], ['B5', 0.12], ['C6', 0.7]];
      var tt = t;
      for (var i = 0; i < seqn.length; i++) {
        tone(sfxBus, 'square', freq(seqn[i][0]), null, tt, seqn[i][1], 0.18, { hold: true });
        tone(sfxBus, 'triangle', freq(seqn[i][0]) / 2, null, tt, seqn[i][1], 0.1, { hold: true });
        tt += seqn[i][1];
      }
      tone(sfxBus, 'triangle', freq('C4'), null, t + 1.0, 0.9, 0.12);
      tone(sfxBus, 'triangle', freq('E4'), null, t + 1.0, 0.9, 0.1);
    },
    gameOver: function (t) {
      var seqn = [['E4', 0.35], ['Eb4', 0.35], ['D4', 0.35], ['Db4', 0.5], ['C4', 0.9]];
      var tt = t;
      for (var i = 0; i < seqn.length; i++) {
        tone(sfxBus, 'square', freq(seqn[i][0]), null, tt, seqn[i][1], 0.16, { hold: true });
        tone(sfxBus, 'triangle', freq(seqn[i][0]) / 2, null, tt, seqn[i][1], 0.12, { hold: true });
        tt += seqn[i][1];
      }
      tone(sfxBus, 'sine', freq('C3'), freq('C2'), t + 1.5, 1.2, 0.14);
    },
    gameClear: function (t) {
      var seqn = [['C5', 0.12], ['E5', 0.12], ['G5', 0.12], ['C6', 0.36], ['E6', 0.12], ['D6', 0.12], ['C6', 0.36],
        ['G5', 0.12], ['A5', 0.12], ['B5', 0.12], ['C6', 0.36], ['E6', 0.12], ['G6', 0.12], ['E6', 0.12], ['C6', 1.0]];
      var tt = t;
      for (var i = 0; i < seqn.length; i++) {
        tone(sfxBus, 'square', freq(seqn[i][0]), null, tt, seqn[i][1], 0.17, { hold: true });
        tone(sfxBus, 'triangle', freq(seqn[i][0]) / 2, null, tt + 0.01, seqn[i][1], 0.09, { hold: true });
        tt += seqn[i][1];
      }
      var chord = ['C3', 'G3', 'E4'];
      for (i = 0; i < chord.length; i++) tone(sfxBus, 'triangle', freq(chord[i]), null, t + 2.4, 1.3, 0.09, { hold: true });
      for (i = 0; i < 6; i++) tone(sfxBus, 'sine', freq('C7'), null, t + 2.5 + i * 0.15, 0.1, 0.06);
    },
    pause: function (t) {
      tone(sfxBus, 'square', 660, 990, t, 0.1, 0.16);
    },
    warn: function (t) {
      tone(sfxBus, 'square', 1500, 1500, t, 0.05, 0.14);
    }
  };

  function sfx(name) {
    sfxLog.push({ name: name, time: performance.now() });
    if (sfxLog.length > 20) sfxLog.shift();
    if (!ctx || !unlocked) return;
    if (name === 'explode') {
      var pn = performance.now();
      if (pn - lastExplode < 50) return;
      lastExplode = pn;
    }
    var fn = SFX[name];
    if (!fn) return;
    try { fn(ctx.currentTime + 0.01); } catch (e) { /* never throw from audio */ }
  }

  /* ---------- songs ---------- */
  function T(s) { return s.trim().split(/\s+/); }
  var SONGS = {
    title: {
      bpm: 100,
      tracks: [
        { wave: 'triangle', gain: 0.09, notes: T(
          'A4 _ _ _ C5 _ _ _ E5 _ _ _ D5 _ C5 _  B4 _ _ _ _ _ _ _ . . . . E4 _ G4 _ ' +
          'A4 _ _ _ C5 _ _ _ E5 _ _ _ G5 _ E5 _  D5 _ _ _ _ _ _ _ C5 _ _ _ B4 _ _ _') },
        { wave: 'square', gain: 0.05, notes: T(
          'A2 _ _ _ E3 _ _ _ A2 _ _ _ E3 _ _ _  A2 _ _ _ E3 _ _ _ A2 _ _ _ E3 _ _ _ ' +
          'F2 _ _ _ C3 _ _ _ F2 _ _ _ C3 _ _ _  G2 _ _ _ D3 _ _ _ E2 _ _ _ B2 _ _ _') },
        { wave: 'sine', gain: 0.05, notes: T(
          'A5 . E5 . A5 . E5 . A5 . E5 . A5 . E5 .  A5 . E5 . A5 . E5 . A5 . E5 . A5 . E5 . ' +
          'A5 . F5 . A5 . F5 . A5 . F5 . A5 . F5 .  B5 . G5 . B5 . G5 . B5 . E5 . B5 . E5 .') }
      ]
    },
    stageA: {
      bpm: 112,
      tracks: [
        { wave: 'square', gain: 0.08, notes: T(
          'E4 _ G4 _ A4 _ G4 _ E4 _ D4 _ C4 _ D4 _  E4 _ _ _ G4 _ A4 _ C5 _ _ _ A4 _ G4 _ ' +
          'E4 _ G4 _ A4 _ G4 _ E4 _ D4 _ C4 _ A3 _  C4 _ _ _ D4 _ E4 _ D4 _ _ _ . . . .') },
        { wave: 'triangle', gain: 0.1, notes: T(
          'C2 . . C2 . . C2 . G2 . . G2 . . C2 .  A2 . . A2 . . A2 . E2 . . E2 . . A2 . ' +
          'F2 . . F2 . . F2 . G2 . . G2 . . G2 .  C2 . . C2 . . G2 . C2 . . . . . . .') },
        { wave: 'noise', gain: 0.06, notes: T('k . h . s . h . k . h . s . h h '.repeat(4)) }
      ]
    },
    stageB: {
      bpm: 118,
      tracks: [
        { wave: 'square', gain: 0.08, notes: T(
          'E4 _ E4 _ G4 _ E4 _ B4 _ _ _ A4 _ G4 _  F#4 _ F#4 _ A4 _ F#4 _ C5 _ _ _ B4 _ A4 _ ' +
          'G4 _ G4 _ B4 _ G4 _ D5 _ _ _ C5 _ B4 _  A4 _ B4 _ C5 _ B4 _ A4 _ G4 _ F#4 _ D4 _') },
        { wave: 'triangle', gain: 0.1, notes: T(
          'E2 . E2 . E2 . E3 . E2 . E2 . E2 . D3 .  D2 . D2 . D2 . D3 . D2 . D2 . D2 . C3 . ' +
          'C2 . C2 . C2 . C3 . C2 . C2 . C2 . B2 .  B1 . B1 . B1 . B2 . B1 . B1 . D2 . D2 .') },
        { wave: 'noise', gain: 0.06, notes: T('k . h h k . h . k . h h s . h . '.repeat(4)) }
      ]
    },
    stageC: {
      bpm: 100,
      tracks: [
        { wave: 'square', gain: 0.07, notes: T(
          'D4 _ _ _ F4 _ _ _ A4 _ _ _ G4 _ F4 _  E4 _ _ _ _ _ _ _ C4 _ _ _ E4 _ _ _ ' +
          'D4 _ _ _ F4 _ _ _ A4 _ _ _ Bb4 _ A4 _  G4 _ _ _ _ _ E4 _ D4 _ _ _ _ _ _ _') },
        { wave: 'triangle', gain: 0.1, notes: T(
          'D2 _ . . D2 . . . D2 _ . . A2 . . .  C2 _ . . C2 . . . C2 _ . . G2 . . . ' +
          'Bb1 _ . . Bb1 . . . Bb1 _ . . F2 . . .  A1 _ . . A1 . . . A1 _ . . A2 . . .') },
        { wave: 'sine', gain: 0.04, notes: T(
          'D5 . A4 . F4 . A4 . D5 . A4 . F4 . A4 .  C5 . G4 . E4 . G4 . C5 . G4 . E4 . G4 . ' +
          'D5 . Bb4 . F4 . Bb4 . D5 . Bb4 . F4 . Bb4 .  A4 . E4 . C#5 . E4 . A4 . E4 . C#5 . E4 .') },
        { wave: 'noise', gain: 0.05, notes: T('k . . . h . . . s . . . h . h . '.repeat(4)) }
      ]
    }
  };
  function songFor(id) {
    if (id === 'title') return SONGS.title;
    if (id === 'stage1' || id === 'stage2') return SONGS.stageA;
    if (id === 'stage3' || id === 'stage4') return SONGS.stageB;
    if (id === 'stage5') return SONGS.stageC;
    return null;
  }

  /* ---------- sequencer ---------- */
  var seq = { song: null, key: null, step: 0, nextTime: 0, running: false, paused: false, timer: null, tempo: 1, voices: [] };

  function stepDur() { return 60 / (seq.song.bpm * seq.tempo) / 4; }

  function scheduleStep(t) {
    var song = seq.song, i = seq.step;
    var sd = stepDur();
    for (var k = 0; k < song.tracks.length; k++) {
      var tr = song.tracks[k];
      var tok = tr.notes[i % tr.notes.length];
      if (tok === '.' || tok === '_') continue;
      if (tr.wave === 'noise') {
        if (tok === 'k') { seq.voices.push(tone(bgmBus, 'sine', 150, 40, t, 0.12, tr.gain * 2)); }
        else if (tok === 's') { seq.voices.push(noise(bgmBus, t, 0.12, tr.gain * 1.4, 'bandpass', 1600, 900, 0.8)); }
        else { seq.voices.push(noise(bgmBus, t, 0.05, tr.gain, 'highpass', 6000, 6000, 0.7)); }
        continue;
      }
      var len = 1;
      while (tr.notes[(i + len) % tr.notes.length] === '_' && len < 32) len++;
      var dur = len * sd * 0.92;
      seq.voices.push(tone(bgmBus, tr.wave, freq(tok), null, t, dur, tr.gain, { hold: true, attack: 0.01, release: 0.04 }));
    }
    if (seq.voices.length > 200) seq.voices.splice(0, 100);
  }

  function tick() {
    if (!seq.running || !ctx) return;
    var horizon = ctx.currentTime + 0.15;
    var guard = 0;
    while (seq.nextTime < horizon && guard++ < 64) {
      scheduleStep(seq.nextTime);
      seq.nextTime += stepDur();
      seq.step = (seq.step + 1) % 64;
    }
  }

  function startSong(id) {
    var song = songFor(id);
    var key = song === SONGS.title ? 'title' : (song === SONGS.stageA ? 'A' : (song === SONGS.stageB ? 'B' : 'C'));
    if (!song || !ctx || !unlocked) return;
    if (seq.running && seq.key === key) return;
    stopVoices();
    seq.song = song; seq.key = key; seq.step = 0;
    seq.nextTime = ctx.currentTime + 0.05;
    seq.running = true; seq.paused = false;
    if (!seq.timer) seq.timer = setInterval(tick, 40);
    tick();
  }
  function stopVoices() {
    var t = ctx ? ctx.currentTime : 0;
    for (var i = 0; i < seq.voices.length; i++) {
      var v = seq.voices[i];
      if (!v) continue;
      try { v.stop(t); } catch (e) { /* already stopped */ }
    }
    seq.voices = [];
  }
  function stopSong() {
    seq.running = false; seq.paused = false; seq.key = null;
    if (seq.timer) { clearInterval(seq.timer); seq.timer = null; }
    stopVoices();
  }

  /* Public: select the BGM track per spec rules. id is the track id or null. */
  function setBgm(id) {
    bgmId = id;
    if (!id) { stopSong(); return; }
    if (unlocked && ctx) startSong(id);
  }
  function pauseBgm() {
    if (!seq.running) return;
    seq.paused = true; seq.running = false;
    if (seq.timer) { clearInterval(seq.timer); seq.timer = null; }
    stopVoices();
  }
  function resumeBgm() {
    if (!seq.paused || !ctx) return;
    seq.paused = false; seq.running = true;
    seq.nextTime = ctx.currentTime + 0.05;
    if (!seq.timer) seq.timer = setInterval(tick, 40);
  }
  function setTempo(mult) {
    seq.tempo = mult;
  }

  return {
    unlock: unlock, sfx: sfx, setMuted: setMuted, setBgm: setBgm, pauseBgm: pauseBgm, resumeBgm: resumeBgm, setTempo: setTempo,
    isMuted: function () { return muted; },
    isUnlocked: function () { return unlocked; },
    bgm: function () { return bgmId; },
    log: function () { return sfxLog.slice(); }
  };
})();
