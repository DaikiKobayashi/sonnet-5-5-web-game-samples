/* audio.js - AudioContext lifecycle, buses, mute, sfx log, BGM scheduler.
 * All sounds are synthesised in synth.js (no audio files). */
(function (root) {
  'use strict';
  var DM = root.DM = root.DM || {};
  var MUTE_KEY = 'dynamiteMole.muted';

  var A = DM.Audio = {
    ctx: null,
    unlocked: false,
    muted: false,
    bgm: null,          // selected track id (or null) - independent of mute / unlock
    log: [],
    paused: false,
    tempoUp: false,
    master: null, sfxBus: null, bgmBus: null
  };

  var bgmRun = null;    // { id, out, step, next, timer, track }
  var lastExplodeAt = -1;

  A.init = function (muted) { A.muted = !!muted; };

  function softClipCurve() {
    var n = 2048, c = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * 2 - 1, ax = Math.abs(x), y;
      if (ax < 0.6) y = ax; else y = 0.6 + 0.35 * Math.tanh((ax - 0.6) / 0.35);
      c[i] = x < 0 ? -y : y;
    }
    return c;
  }

  A.unlock = function () {
    try {
      if (A.ctx) {
        if (A.ctx.state === 'suspended' && A.ctx.resume) A.ctx.resume();
        return;
      }
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      var master = ctx.createGain();
      master.gain.value = A.muted ? 0 : 1;
      var shaper = ctx.createWaveShaper();
      shaper.curve = softClipCurve();
      var sfxBus = ctx.createGain(); sfxBus.gain.value = 1;
      var bgmBus = ctx.createGain(); bgmBus.gain.value = 1;
      sfxBus.connect(master);
      bgmBus.connect(master);
      master.connect(shaper);
      shaper.connect(ctx.destination);
      A.ctx = ctx; A.master = master; A.sfxBus = sfxBus; A.bgmBus = bgmBus;
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      A.unlocked = true;
      if (A.bgm) startBgm(A.bgm);
    } catch (e) {
      A.ctx = null;
    }
  };

  function applyMute() {
    if (!A.ctx || !A.master) return;
    try {
      var t = A.ctx.currentTime;
      A.master.gain.cancelScheduledValues(t);
      A.master.gain.setTargetAtTime(A.muted ? 0 : 1, t, 0.01);
    } catch (e) { /* ignore */ }
  }

  A.toggleMute = function () {
    A.muted = !A.muted;
    DM.storage.set(MUTE_KEY, A.muted ? '1' : '0');
    applyMute();
  };

  A.sfx = function (name) {
    var now = (root.performance && performance.now) ? performance.now() : Date.now();
    A.log.push({ name: name, time: now });
    if (A.log.length > 20) A.log.shift();
    if (!A.ctx || A.muted || !DM.Synth) return;
    try {
      if (name === 'explode') {   // merge audible duplicates that land within 50 ms
        if (lastExplodeAt >= 0 && now - lastExplodeAt < 50) return;
        lastExplodeAt = now;
      }
      var fn = DM.Synth.sfx[name];
      if (fn) fn(A.ctx, A.sfxBus, A.ctx.currentTime + 0.004);
    } catch (e) { /* audio must never break the game */ }
  };

  /* ------------------------------------------------------------ BGM */
  function stopBgm() {
    if (!bgmRun) return;
    if (bgmRun.timer) clearInterval(bgmRun.timer);
    try {
      var t = A.ctx.currentTime;
      bgmRun.out.gain.cancelScheduledValues(t);
      bgmRun.out.gain.setTargetAtTime(0, t, 0.05);
      var o = bgmRun.out;
      setTimeout(function () { try { o.disconnect(); } catch (e) { /* ignore */ } }, 500);
    } catch (e) { /* ignore */ }
    bgmRun = null;
  }

  function pump() {
    if (!bgmRun || !A.ctx) return;
    var ctx = A.ctx, tr = bgmRun.track, guard = 0;
    while (bgmRun.next < ctx.currentTime + 0.18 && guard++ < 32) {
      var dur = tr.stepDur * (A.tempoUp ? 0.8 : 1);
      if (!A.muted && ctx.state === 'running') {
        try { DM.Synth.bgmStep(ctx, bgmRun.out, tr, bgmRun.step, bgmRun.next, dur, A.tempoUp); } catch (e) { /* ignore */ }
      }
      bgmRun.step = (bgmRun.step + 1) % tr.steps;
      bgmRun.next += dur;
    }
  }

  function startBgm(id) {
    if (!A.ctx || !DM.Synth || !DM.Synth.tracks) return;
    var tr = DM.Synth.tracks[id];
    if (!tr) return;
    var out = A.ctx.createGain();
    out.gain.value = 1;
    out.connect(A.bgmBus);
    bgmRun = { id: id, out: out, step: 0, next: A.ctx.currentTime + 0.06, track: tr, timer: null };
    bgmRun.timer = setInterval(pump, 30);
    pump();
  }

  A.setBgm = function (id) {
    if (A.bgm === id) return;
    A.bgm = id;
    if (!A.ctx) return;
    stopBgm();
    if (id) startBgm(id);
  };

  A.setPaused = function (p) {
    A.paused = !!p;
    if (!A.ctx || !A.bgmBus) return;
    try {
      var t = A.ctx.currentTime;
      A.bgmBus.gain.cancelScheduledValues(t);
      A.bgmBus.gain.setTargetAtTime(p ? 0.22 : 1, t, 0.04);
    } catch (e) { /* ignore */ }
  };

  A.setTempoUp = function (b) { A.tempoUp = !!b; };

  A.info = function () {
    return {
      unlocked: A.unlocked,
      muted: A.muted,
      bgm: A.bgm,
      sfxLog: A.log.map(function (l) { return { name: l.name, time: l.time }; })
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
