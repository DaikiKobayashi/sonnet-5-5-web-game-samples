// Web Audio synthesis: chiptune SFX, jingles and a small step sequencer for BGM.
(function () {
  'use strict';
  var DM = window.DM;

  var NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freq(n) {
    // e.g. 'C5', 'F#4', 'Bb3'
    var m = /^([A-G])([#b]?)(\d)$/.exec(n);
    if (!m) return 0;
    var semi = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    var midi = (parseInt(m[3], 10) + 1) * 12 + semi;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  function seq(str) { return str.trim().split(/\s+/); }

  // ---- BGM tracks: 8th-note steps. '.' rest, '_' hold ----
  var TRACKS = {
    title: {
      bpm: 96, lead: 'triangle',
      mel: seq('A4 _ C5 E5 _ D5 C5 _ B4 _ G4 _ A4 _ _ _ A4 _ C5 E5 _ G5 F5 E5 D5 _ B4 _ C5 _ _ _ ' +
               'F4 _ A4 C5 _ B4 A4 _ G4 _ E4 _ G#4 _ _ _ A4 _ B4 C5 _ E5 D5 C5 B4 _ G#4 _ A4 _ _ _'),
      bass: seq('A2 . E3 . A2 . E3 . G2 . D3 . G2 . D3 . A2 . E3 . A2 . E3 . E2 . B2 . E2 . B2 . ' +
                'F2 . C3 . F2 . C3 . E2 . B2 . E2 . B2 . A2 . E3 . A2 . E3 . E2 . G#2 . A2 . . .'),
      drum: 'h.......h.......h.......h.......h.......h.......h.......h.......'
    },
    stage1: {
      bpm: 132, lead: 'square',
      mel: seq('C5 . E5 G5 . E5 C5 . D5 . F5 A5 . F5 D5 . E5 . G5 C6 . G5 E5 . D5 _ _ _ G4 _ _ _ ' +
               'C5 . E5 G5 . E5 C5 . F5 . A5 C6 . A5 F5 . E5 . D5 C5 . B4 C5 . C5 _ _ _ . . . .'),
      bass: seq('C3 . G3 . C3 . G3 . D3 . A3 . D3 . A3 . C3 . G3 . C3 . G3 . G2 . D3 . G2 . B2 . ' +
                'C3 . G3 . C3 . G3 . F2 . C3 . F2 . C3 . G2 . D3 . G2 . D3 . C3 . G2 . C3 . . .'),
      drum: 'k.h.s.h.k.h.s.h.k.h.s.h.k.h.s.hhk.h.s.h.k.h.s.h.k.h.s.h.k.k.s.s.'
    },
    stage2: {
      bpm: 118, lead: 'triangle',
      mel: seq('E5 . B4 . E5 F#5 G5 . F#5 . E5 . D5 . B4 . C5 . G4 . C5 D5 E5 . D5 . C5 . B4 _ _ _ ' +
               'E5 . B4 . E5 F#5 G5 . A5 . G5 . F#5 . D5 . E5 . D5 B4 G4 . A4 B4 E4 _ _ _ . . . .'),
      bass: seq('E2 . B2 E3 . B2 E2 . G2 . D3 G3 . D3 G2 . C3 . G3 C4 . G3 C3 . B2 . F#3 B3 . F#3 B2 . ' +
                'E2 . B2 E3 . B2 E2 . D2 . A2 D3 . A2 D2 . C3 . G3 C4 . G3 C3 . B2 . F#3 B3 . B2 . .'),
      drum: 'k...h.s.k.k.h.s.k...h.s.k.k.h.s.k...h.s.k.k.h.s.k...h.s.k.h.s.s.'
    },
    stage3: {
      bpm: 124, lead: 'square',
      mel: seq('A5 . E5 . A5 B5 C6 . B5 . A5 . E5 . C5 . D5 . F5 . A5 . G5 . F5 . E5 . D5 _ _ _ ' +
               'C5 . E5 . A5 . G5 . F5 . E5 . D5 . F5 . E5 . C5 . B4 . G#4 . A4 _ _ _ . . E5 .'),
      bass: seq('A2 A3 A2 A3 A2 A3 A2 A3 F2 F3 F2 F3 F2 F3 F2 F3 D2 D3 D2 D3 D2 D3 D2 D3 E2 E3 E2 E3 E2 E3 E2 E3 ' +
                'A2 A3 A2 A3 F2 F3 F2 F3 D2 D3 D2 D3 E2 E3 E2 E3 A2 A3 A2 A3 E2 E3 G#2 G#3 A2 A3 A2 A3 E2 E3 E2 E3'),
      drum: 'k.h.s.h.k.h.s.h.k.h.s.h.k.h.s.h.k.h.s.h.k.h.s.h.k.h.s.h.k.s.s.s.'
    },
    stage4: {
      bpm: 140, lead: 'square',
      mel: seq('D5 . D5 F5 . D5 G5 . F5 . D5 . C5 . A4 . D5 . D5 F5 . A5 G5 . F5 . E5 . C#5 _ _ _ ' +
               'D5 . F5 . A5 . Bb5 . A5 . G5 . F5 . E5 . D5 . F5 E5 . D5 C#5 . D5 _ _ _ . . A4 .'),
      bass: seq('D2 D2 D3 D2 D2 D3 D2 C3 D2 D2 D3 D2 C2 C3 C2 A2 Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 A2 A1 A1 A2 A1 A1 A2 C#2 E2 ' +
                'D2 D2 D3 D2 F2 F2 F3 F2 G2 G2 G3 G2 A2 A2 A3 A2 Bb1 Bb1 Bb2 Bb1 A1 A1 A2 A1 D2 D2 D3 D2 A1 A1 C#2 E2'),
      drum: 'k.hsk.hsk.hsk.hsk.hsk.hsk.hsk.hsk.hsk.hsk.hsk.hsk.hsk.hsk.hsks.s'
    },
    stage5: {
      bpm: 108, lead: 'triangle',
      mel: seq('B4 _ _ . D5 _ C#5 . B4 _ F#4 _ _ _ . . G4 _ _ . B4 _ A4 . F#4 _ _ _ _ _ . . ' +
               'B4 _ _ . D5 _ E5 . F#5 _ _ . E5 _ D5 . C#5 _ A4 . B4 _ _ _ _ _ _ _ . . . .'),
      bass: seq('B1 . B2 . B1 . B2 . B1 . B2 . B1 . B2 . G1 . G2 . G1 . G2 . F#1 . F#2 . F#1 . F#2 . ' +
                'B1 . B2 . B1 . B2 . A1 . A2 . A1 . A2 . G1 . G2 . F#1 . F#2 . B1 . B2 . B1 . . .'),
      drum: 'k.......h...s...k.......h...s...k.......h...s...k.......h...s.h.'
    }
  };

  var A = {
    ctx: null, master: null, sfxBus: null, bgmBus: null, noiseBuf: null,
    unlocked: false, muted: false, bgm: null, sfxLog: [],
    playing: null, step: 0, nextTime: 0, tempo: 1, pausedDuck: false,
    lastPlay: {}
  };
  DM.Audio = A;

  A.init = function (muted) { A.muted = !!muted; };

  A.unlock = function () {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') { try { A.ctx.resume(); } catch (e) { /* ignore */ } }
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      var ctx = new AC();
      A.ctx = ctx;
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 10; comp.ratio.value = 6;
      comp.attack.value = 0.003; comp.release.value = 0.15;
      comp.connect(ctx.destination);
      A.master = ctx.createGain();
      A.master.gain.value = A.muted ? 0 : 0.8;
      A.master.connect(comp);
      A.sfxBus = ctx.createGain(); A.sfxBus.gain.value = 0.75; A.sfxBus.connect(A.master);
      A.bgmBus = ctx.createGain(); A.bgmBus.gain.value = 0.6; A.bgmBus.connect(A.master);
      var len = Math.floor(ctx.sampleRate * 1.0);
      A.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = A.noiseBuf.getChannelData(0);
      var s = 12345;
      for (var i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
      if (ctx.state === 'suspended') ctx.resume();
      A.unlocked = true;
    } catch (e) {
      A.ctx = null;
    }
  };

  A.setMuted = function (m) {
    A.muted = m;
    if (A.ctx && A.master) {
      var t = A.ctx.currentTime;
      A.master.gain.cancelScheduledValues(t);
      A.master.gain.setValueAtTime(m ? 0 : 0.8, t);
    }
  };

  function ok() { return A.ctx && !A.muted && A.ctx.state !== 'closed'; }

  function tone(f, t0, dur, type, vol, fEnd, bus) {
    var ctx = A.ctx;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t0);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    g.gain.setValueAtTime(vol, t0 + Math.max(0.006, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus || A.sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.02);
    return o;
  }
  function noise(t0, dur, vol, filt, fEnd, type, bus) {
    var ctx = A.ctx;
    var src = ctx.createBufferSource();
    src.buffer = A.noiseBuf; src.loop = true;
    var bq = ctx.createBiquadFilter();
    bq.type = type || 'lowpass';
    bq.frequency.setValueAtTime(filt, t0);
    if (fEnd) bq.frequency.exponentialRampToValueAtTime(fEnd, t0 + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bq); bq.connect(g); g.connect(bus || A.sfxBus);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
  }
  function melody(notes, t0, stepDur, type, vol, bass) {
    notes.forEach(function (n, i) {
      if (!n || n === '.') return;
      var len = 1;
      if (Array.isArray(n)) { len = n[1]; n = n[0]; }
      tone(freq(n), t0 + i * stepDur, stepDur * len * 0.95, type, vol);
    });
    if (bass) bass.forEach(function (n, i) {
      if (!n || n === '.') return;
      var len = 1;
      if (Array.isArray(n)) { len = n[1]; n = n[0]; }
      tone(freq(n), t0 + i * stepDur, stepDur * len * 0.95, 'triangle', vol * 1.1);
    });
  }

  var SFX = {
    start: function (t) { melody(['C5', 'E5', 'G5'], t, 0.1, 'square', 0.18); tone(freq('C6'), t + 0.3, 0.1, 'square', 0.12); },
    place: function (t) { tone(200, t, 0.1, 'triangle', 0.3, 90); noise(t, 0.04, 0.08, 1800); },
    explode: function (t) {
      noise(t, 0.55, 0.32, 3000, 180);
      tone(140, t, 0.5, 'sine', 0.3, 38);
      tone(90, t, 0.35, 'square', 0.08, 30);
    },
    'break': function (t) { noise(t, 0.15, 0.22, 2400, 600, 'bandpass'); tone(320, t, 0.08, 'square', 0.06, 140); },
    enemyDie: function (t) { tone(900, t, 0.3, 'square', 0.14, 160); tone(1350, t, 0.12, 'triangle', 0.1, 400); },
    hit: function (t) { tone(1250, t, 0.15, 'square', 0.1); tone(1873, t, 0.15, 'square', 0.07); tone(620, t, 0.08, 'triangle', 0.15); },
    playerDie: function (t) {
      var o = tone(880, t, 0.95, 'square', 0.16, 55);
      var lfo = A.ctx.createOscillator(), lg = A.ctx.createGain();
      lfo.frequency.value = 14; lg.gain.value = 30; lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t); lfo.stop(t + 1);
    },
    item: function (t) { tone(freq('E6'), t, 0.09, 'square', 0.14); tone(freq('B6'), t + 0.09, 0.12, 'square', 0.14); },
    life: function (t) { melody(['C5', 'E5', 'G5', ['C6', 3]], t, 0.12, 'square', 0.16); },
    exitOpen: function (t) { melody(['G5', 'C6', 'E6', ['G6', 3]], t, 0.08, 'square', 0.15, ['C4', 'E4', 'G4', ['C5', 3]]); },
    stageClear: function (t) {
      melody(['C5', 'E5', 'G5', 'C6', '.', 'G5', ['C6', 2], 'D6', 'E6', 'D6', 'C6', 'G5', 'A5', 'B5', ['C6', 4]], t, 0.12, 'square', 0.14,
             ['C3', '.', 'G3', '.', 'C3', '.', 'G3', '.', 'F3', '.', 'G3', '.', 'G2', '.', 'B2', ['C3', 4]]);
    },
    gameOver: function (t) {
      melody([['G4', 2], ['F#4', 2], ['F4', 2], ['E4', 2], '.', 'C4', 'D4', 'Eb4', ['D4', 3], '.', ['C4', 6]], t, 0.14, 'triangle', 0.2,
             [['C3', 4], ['B2', 4], '.', ['Ab2', 4], ['G2', 3], '.', ['C2', 6]]);
    },
    gameClear: function (t) {
      melody(['C5', 'C5', 'C5', ['C5', 2], ['Ab4', 2], ['Bb4', 2], 'C5', '.', 'Bb4', ['C5', 4],
              'E5', 'G5', 'C6', 'G5', 'E5', 'G5', 'C6', 'E6', ['G6', 2], ['E6', 2], ['C6', 4]], t, 0.12, 'square', 0.14,
             [['C3', 2], '.', ['C3', 2], ['Ab2', 2], ['Bb2', 2], 'C3', '.', 'G2', ['C3', 4], 'C3', 'G3', 'C3', 'G3', 'F3', 'A3', 'F3', 'A3', ['G3', 2], ['G2', 2], ['C3', 4]]);
    },
    pause: function (t) { tone(660, t, 0.05, 'square', 0.12); tone(990, t + 0.05, 0.05, 'square', 0.12); },
    warn: function (t) { tone(1500, t, 0.05, 'square', 0.1); }
  };

  A.sfx = function (name) {
    A.sfxLog.push({ name: name, time: performance.now() });
    if (A.sfxLog.length > 20) A.sfxLog.splice(0, A.sfxLog.length - 20);
    if (!ok() || !SFX[name]) return;
    var now = A.ctx.currentTime;
    if (name === 'explode' && A.lastPlay.explode && now - A.lastPlay.explode < 0.05) return;
    A.lastPlay[name] = now;
    try { SFX[name](now + 0.005); } catch (e) { /* ignore audio errors */ }
  };

  // BGM sequencer. Called every frame with the desired track id.
  A.update = function (track, tempo, paused) {
    A.bgm = track;
    if (!A.ctx) return;
    var now = A.ctx.currentTime;
    if (A.bgmBus) {
      var target = paused ? 0.15 : 0.6;
      if (A.bgmBus.gain.value !== target) A.bgmBus.gain.setTargetAtTime(target, now, 0.05);
    }
    if (track !== A.playing) {
      A.playing = track;
      A.step = 0;
      A.nextTime = now + 0.06;
    }
    if (!track) return;
    var T = TRACKS[track];
    if (!T) return;
    if (A.nextTime < now - 0.25) A.nextTime = now + 0.05; // after a stall (hidden tab)
    var stepDur = 60 / T.bpm / 2 / (tempo || 1);
    var len = Math.max(T.mel.length, T.bass.length);
    while (A.nextTime < now + 0.15) {
      var t = A.nextTime, i = A.step % len;
      if (ok() && !paused) {
        playVoice(T.mel, i, t, stepDur, T.lead, 0.07);
        playVoice(T.bass, i, t, stepDur, 'triangle', 0.1);
        var dch = T.drum[i % T.drum.length];
        if (dch === 'k') { tone(120, t, 0.12, 'sine', 0.14, 45, A.bgmBus); }
        else if (dch === 's') { noise(t, 0.1, 0.06, 3000, 1200, 'bandpass', A.bgmBus); }
        else if (dch === 'h') { noise(t, 0.03, 0.03, 8000, null, 'highpass', A.bgmBus); }
      }
      A.nextTime += stepDur;
      A.step++;
    }
  };
  function playVoice(arr, i, t, stepDur, type, vol) {
    var n = arr[i % arr.length];
    if (!n || n === '.' || n === '_') return;
    var hold = 1;
    for (var k = i + 1; k < arr.length && arr[k] === '_'; k++) hold++;
    tone(freq(n), t, stepDur * hold * 0.92, type, vol, null, A.bgmBus);
  }
})();
