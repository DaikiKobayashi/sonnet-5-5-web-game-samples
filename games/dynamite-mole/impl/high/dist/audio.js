/* audio.js - all sound is synthesised with the Web Audio API (chiptune style). No audio files. */
(function () {
  'use strict';
  const DM = (window.DM = window.DM || {});

  const A = (DM.audio = {
    ctx: null,
    unlocked: false,
    muted: false,
    bgm: null, // logical track id chosen by the game state (independent of mute / unlock)
    fast: false,
    paused: false,
    sfxLog: [],
  });

  let master = null, sfxBus = null, bgmBus = null, noiseBuf = null;
  let playing = null; // { id, bus, timer, step, nextTime }
  let lastExplode = -1;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /* ------------------------------------------------------------ setup */
  A.unlock = function () {
    try {
      if (!A.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -10; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
        master = ctx.createGain();
        master.gain.value = A.muted ? 0 : 0.9;
        master.connect(comp); comp.connect(ctx.destination);
        sfxBus = ctx.createGain(); sfxBus.gain.value = 0.68; sfxBus.connect(master);
        bgmBus = ctx.createGain(); bgmBus.gain.value = 0.2; bgmBus.connect(master);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        A.ctx = ctx;
        A.nodes = { master, sfxBus, bgmBus };
      }
      if (A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
      A.unlocked = true;
    } catch (e) {
      A.ctx = null;
    }
  };

  A.setMuted = function (m) {
    A.muted = !!m;
    if (master && A.ctx) master.gain.setTargetAtTime(A.muted ? 0 : 0.9, A.ctx.currentTime, 0.01);
    A.sync();
  };

  /* ------------------------------------------------------------ primitives */
  function osc(type, f0, f1, t0, dur, vol, dest, attack) {
    const ctx = A.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.03);
    return o;
  }
  function noise(t0, dur, vol, f0, f1, type, dest, q) {
    const ctx = A.ctx;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = type || 'lowpass'; f.Q.value = q || 0.8;
    f.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxBus);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.03);
  }
  // play a list of [midi|freq, seconds] as a monophonic jingle
  function jingle(list, t0, type, vol, gap, hz) {
    let t = t0;
    for (const [n, d] of list) {
      if (n) osc(type, hz ? n : mtof(n), 0, t, d * 1.15, vol, sfxBus, 0.006);
      t += d + (gap || 0);
    }
    return t;
  }

  /* ------------------------------------------------------------ sound effects */
  const SFX = {
    start(t) { jingle([[72, 0.09], [76, 0.09], [79, 0.18]], t, 'square', 0.22); osc('triangle', mtof(48), 0, t, 0.3, 0.25); },
    place(t) { osc('sine', 220, 90, t, 0.1, 0.32); osc('triangle', 440, 200, t, 0.05, 0.12); },
    explode(t) {
      noise(t, 0.55, 0.32, 2400, 140, 'lowpass', sfxBus, 0.6);
      osc('sine', 150, 38, t, 0.5, 0.34);
      osc('sawtooth', 90, 30, t, 0.4, 0.14);
    },
    break(t) { noise(t, 0.15, 0.24, 3200, 500, 'bandpass', sfxBus, 1.2); osc('square', 320, 90, t, 0.1, 0.1); },
    enemyDie(t) {
      const o = osc('square', 760, 120, t, 0.3, 0.2);
      const lfo = A.ctx.createOscillator(), lg = A.ctx.createGain();
      lfo.frequency.value = 26; lg.gain.value = 40; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 0.32);
      noise(t, 0.08, 0.1, 5000, 1500, 'highpass');
    },
    hit(t) { osc('square', 1240, 1180, t, 0.15, 0.16); osc('square', 1870, 1800, t, 0.12, 0.1); noise(t, 0.04, 0.16, 6000, 4000, 'highpass'); },
    playerDie(t) {
      const o = osc('sawtooth', 780, 50, t, 0.95, 0.24);
      const lfo = A.ctx.createOscillator(), lg = A.ctx.createGain();
      lfo.frequency.value = 9; lg.gain.value = 30; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + 0.95);
      osc('square', 390, 40, t + 0.05, 0.85, 0.12);
    },
    item(t) { osc('triangle', 880, 0, t, 0.11, 0.28); osc('triangle', 1320, 0, t + 0.09, 0.14, 0.28); osc('square', 1760, 0, t + 0.09, 0.08, 0.06); },
    life(t) { jingle([[72, 0.1], [76, 0.1], [79, 0.1], [84, 0.3]], t, 'square', 0.2); jingle([[60, 0.1], [64, 0.1], [67, 0.1], [72, 0.3]], t, 'triangle', 0.26); },
    exitOpen(t) {
      jingle([[67, 0.08], [72, 0.08], [76, 0.08], [79, 0.28]], t, 'square', 0.2);
      osc('triangle', mtof(48), 0, t, 0.5, 0.26);
      noise(t + 0.24, 0.3, 0.05, 6000, 9000, 'highpass');
    },
    stageClear(t) {
      const e = jingle([[72, 0.13], [76, 0.13], [79, 0.13], [84, 0.3], [83, 0.13], [84, 0.13], [88, 0.7]], t, 'square', 0.2, 0.02);
      jingle([[48, 0.26], [55, 0.26], [52, 0.26], [60, 0.26], [55, 0.26], [60, 0.7]], t, 'triangle', 0.28, 0.02);
      return e;
    },
    gameOver(t) {
      jingle([[69, 0.36], [67, 0.36], [65, 0.36], [64, 0.36], [62, 0.42], [57, 1.0]], t, 'square', 0.18, 0.03);
      jingle([[45, 0.7], [41, 0.7], [38, 1.0]], t, 'triangle', 0.26, 0.05);
    },
    gameClear(t) {
      const mel = [[72, 0.14], [72, 0.14], [72, 0.14], [76, 0.36], [74, 0.14], [76, 0.14], [79, 0.5], [77, 0.14], [79, 0.14], [84, 0.36], [83, 0.14], [84, 0.14], [88, 0.3], [86, 0.14], [88, 0.14], [91, 0.9]];
      jingle(mel, t, 'square', 0.18, 0.02);
      jingle(mel.map(([n, d]) => [n - 12, d]), t + 0.02, 'triangle', 0.14, 0.02);
      jingle([[48, 0.6], [53, 0.6], [55, 0.6], [60, 0.6], [55, 0.4], [60, 1.0]], t, 'triangle', 0.26, 0.02);
    },
    pause(t) { osc('square', 660, 880, t, 0.08, 0.16); },
    warn(t) { osc('square', 1200, 1200, t, 0.05, 0.12); },
  };

  A.sfx = function (name) {
    A.sfxLog.push({ name, time: performance.now() });
    if (A.sfxLog.length > 20) A.sfxLog.shift();
    if (!A.ctx || A.muted || !A.unlocked || !SFX[name]) return;
    try {
      if (name === 'explode') {
        const now = performance.now();
        if (now - lastExplode < 50) return;
        lastExplode = now;
      }
      SFX[name](A.ctx.currentTime + 0.005);
    } catch (e) { /* audio must never break the game */ }
  };

  /* ------------------------------------------------------------ BGM */
  const MODES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
  };
  const TRACKS = {
    title: { bpm: 100, root: 57, mode: 'minor', range: [2, 11], roots: [1, 6, 3, 7, 1, 6, 4, 5], bass: 'walk', drums: 1, seed: 11, rhythms: [[2, 2, 2, 2], [2, 1, 1, 2, 2], [3, 1, 2, 2], [4, 2, 2]], arp: false },
    stage1: { bpm: 122, root: 62, mode: 'major', range: [0, 10], roots: [1, 5, 6, 4, 1, 5, 4, 1], bass: 'pump', drums: 2, seed: 21, rhythms: [[2, 2, 2, 2], [1, 1, 2, 2, 2], [2, 1, 1, 2, 2], [1, 1, 1, 1, 2, 2]], arp: false },
    stage2: { bpm: 108, root: 55, mode: 'lydian', range: [3, 13], roots: [1, 2, 1, 5, 1, 2, 6, 5], bass: 'walk', drums: 1, seed: 31, rhythms: [[1, 1, 1, 1, 2, 2], [2, 2, 1, 1, 2], [1, 1, 2, 1, 1, 2], [3, 1, 2, 2]], arp: true },
    stage3: { bpm: 128, root: 64, mode: 'minor', range: [2, 12], roots: [1, 6, 3, 7, 1, 6, 7, 1], bass: 'drive', drums: 2, seed: 41, rhythms: [[1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 2, 1, 1, 2], [2, 1, 1, 2, 2], [1, 1, 1, 1, 2, 2]], arp: true },
    stage4: { bpm: 142, root: 54, mode: 'phrygian', range: [2, 11], roots: [1, 2, 1, 7, 1, 2, 4, 1], bass: 'drive', drums: 2, seed: 51, rhythms: [[1, 1, 2, 1, 1, 2], [2, 1, 1, 2, 2], [1, 1, 1, 1, 2, 2], [3, 1, 3, 1]], arp: false },
    stage5: { bpm: 92, root: 59, mode: 'harmonic', range: [2, 10], roots: [1, 4, 5, 1, 6, 4, 5, 1], bass: 'sparse', drums: 0, seed: 61, rhythms: [[4, 2, 2], [4, 4], [2, 2, 4], [3, 1, 4]], arp: false },
  };
  const BASS = {
    pump: [0, 0, 12, 0, 0, 0, 12, 0],
    walk: [0, null, 7, null, 12, null, 7, null],
    drive: [0, 0, 12, 0, 0, 12, 0, 12],
    sparse: [0, null, null, null, 7, null, null, null],
  };

  function buildTrack(id) {
    const T = TRACKS[id];
    const scale = MODES[T.mode];
    const rng = DM.mulberry32(T.seed * 977);
    const noteMidi = (idx) => T.root + scale[((idx % 7) + 7) % 7] + 12 * Math.floor(idx / 7);
    const chordTones = (rootDeg) => [rootDeg - 1, rootDeg + 1, rootDeg + 3].flatMap((d) => [d, d + 7, d - 7]);
    const [lo, hi] = T.range;
    let prev = Math.floor((lo + hi) / 2);
    const genBar = (rootDeg) => {
      const tones = chordTones(rootDeg).filter((n) => n >= lo && n <= hi);
      const tpl = T.rhythms[Math.floor(rng() * T.rhythms.length)];
      const out = [];
      let step = 0;
      for (const len of tpl) {
        let n;
        if (step % 4 === 0 || rng() < 0.15) {
          const sorted = tones.slice().sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev) + (rng() - 0.5) * 3);
          n = sorted[0];
        } else {
          const dir = rng() < 0.5 ? 1 : -1;
          n = prev + dir * (rng() < 0.7 ? 1 : 2);
          if (n < lo || n > hi) n = prev - dir;
        }
        n = Math.max(lo, Math.min(hi, n));
        out.push({ step, len, idx: n });
        prev = n;
        step += len;
      }
      return out;
    };
    const bars = [];
    const rd = T.roots;
    bars[0] = genBar(rd[0]); bars[1] = genBar(rd[1]);
    bars[2] = genBar(rd[2]); bars[3] = genBar(rd[3]);
    bars[4] = bars[0]; bars[5] = bars[1];
    bars[6] = genBar(rd[6]); bars[7] = genBar(rd[7]);
    // resolve the last bar to the tonic
    const last = bars[7][bars[7].length - 1];
    last.idx = Math.max(lo, Math.min(hi, 7)); last.len = 8 - last.step;
    const lead = new Array(64).fill(null);
    bars.forEach((bar, bi) => bar.forEach((n) => { lead[bi * 8 + n.step] = { midi: noteMidi(n.idx), len: n.len }; }));
    return { T, scale, lead, noteMidi };
  }
  const built = {};
  function getTrack(id) {
    return built[id] || (built[id] = buildTrack(id));
  }

  function scheduleStep(tr, step, t, stepDur) {
    const T = tr.T, s8 = step % 8, bar = Math.floor(step / 8) % 8;
    const bus = playing.bus;
    // lead
    const ln = tr.lead[step];
    if (ln) {
      const d = Math.max(0.08, ln.len * stepDur * 0.95);
      const o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = T.mode === 'phrygian' ? 'sawtooth' : 'square';
      o.frequency.value = mtof(ln.midi);
      const v = T.mode === 'phrygian' ? 0.18 : 0.24;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.01);
      g.gain.exponentialRampToValueAtTime(v * 0.55, t + Math.min(0.12, d));
      g.gain.setValueAtTime(v * 0.5, t + d * 0.85);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + d + 0.02);
      if (T.mode === 'harmonic' || T.mode === 'lydian') { // gentle vibrato
        const lfo = A.ctx.createOscillator(), lg = A.ctx.createGain();
        lfo.frequency.value = 5.5; lg.gain.value = 5; lfo.connect(lg); lg.connect(o.detune); lfo.start(t); lfo.stop(t + d + 0.02);
      }
    }
    // bass
    const off = BASS[T.bass][s8];
    if (off !== null && off !== undefined) {
      const rootDeg = T.roots[bar] - 1;
      const m = T.root - 24 + tr.scale[rootDeg % 7] + off;
      const d = stepDur * (T.bass === 'sparse' ? 3.2 : 0.9);
      const o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = mtof(m);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.4, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + d + 0.02);
    }
    // arpeggio pad
    if (T.arp && step % 2 === 0) {
      const rootDeg = T.roots[bar] - 1;
      const arpIdx = [0, 2, 4, 2][(step / 2) % 4];
      const idx = rootDeg + arpIdx + 7;
      const m = tr.noteMidi(idx);
      osc('square', mtof(m), 0, t, stepDur * 1.6, 0.06, bus, 0.004);
    }
    // drums
    if (T.drums >= 1) {
      if (s8 === 0 || (T.drums >= 2 && s8 === 4) || (T.drums === 1 && s8 === 4)) osc('sine', 150, 45, t, 0.13, 0.42, bus, 0.002);
      if (T.drums >= 2 && (s8 === 2 || s8 === 6)) noise(t, 0.09, 0.32, 3000, 1500, 'bandpass', bus, 0.9);
      if (s8 % 2 === 1 || T.drums >= 2) noise(t, 0.03, T.drums >= 2 ? 0.1 : 0.06, 8000, 8000, 'highpass', bus);
    } else if (s8 === 0 && bar % 2 === 0) {
      osc('sine', 90, 40, t, 0.25, 0.4, bus, 0.004); // heartbeat
    }
  }

  function startBgm(id) {
    stopBgm();
    if (!A.ctx) return;
    const ctx = A.ctx;
    const tr = getTrack(id);
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(bgmBus);
    playing = { id, bus, step: 0, nextTime: ctx.currentTime + 0.06, timer: 0 };
    const tick = () => {
      if (!playing || playing.id !== id) return;
      const stepDur = 60 / tr.T.bpm / 2 / (A.fast ? 1.28 : 1);
      while (playing.nextTime < ctx.currentTime + 0.14) {
        scheduleStep(tr, playing.step % 64, playing.nextTime, stepDur);
        playing.nextTime += stepDur;
        playing.step++;
      }
    };
    playing.timer = setInterval(tick, 25);
    tick();
  }
  function stopBgm() {
    if (!playing) return;
    clearInterval(playing.timer);
    const p = playing;
    playing = null;
    try {
      p.bus.gain.setTargetAtTime(0, A.ctx.currentTime, 0.02);
      setTimeout(() => { try { p.bus.disconnect(); } catch (e) { /* ignore */ } }, 400);
    } catch (e) { /* ignore */ }
  }

  // called every frame: make the audible state follow the logical one
  A.sync = function () {
    if (!A.ctx) return;
    try {
      const want = A.muted ? null : A.bgm;
      if (!want) { if (playing) stopBgm(); }
      else if (!playing || playing.id !== want) startBgm(want);
      if (bgmBus) bgmBus.gain.setTargetAtTime(A.paused ? 0.05 : 0.2, A.ctx.currentTime, 0.03);
    } catch (e) { /* ignore */ }
  };
})();
