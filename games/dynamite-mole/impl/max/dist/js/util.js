/* util.js - namespace, constants, RNG, storage, URL params */
(function (root) {
  'use strict';
  var DM = root.DM = root.DM || {};

  DM.W = 480;
  DM.H = 416;
  DM.TILE = 32;
  DM.COLS = 15;
  DM.ROWS = 11;
  DM.HUD_H = 64;
  DM.STEP = 1 / 60;

  /* mulberry32 exactly as written in the spec (3.3) */
  DM.mulberry32 = function (seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t = t ^ (t + Math.imul(t ^ (t >>> 7), t | 61));
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* visual-only randomness (particles, shake...) - deterministic, never Math.random() */
  var fxState = DM.mulberry32(0x5EED1234);
  DM.fxRand = function () { return fxState(); };

  /* localStorage wrapper: every access is guarded (private mode etc.) */
  DM.storage = {
    get: function (key) {
      try { return root.localStorage.getItem(key); } catch (e) { return null; }
    },
    set: function (key, value) {
      try { root.localStorage.setItem(key, String(value)); return true; } catch (e) { return false; }
    }
  };

  /* URL parameters (all optional) */
  DM.readParams = function () {
    var out = { seed: null, stage: 1, debug: false, mute: false, touch: false };
    var search = '';
    try { search = root.location.search || ''; } catch (e) { search = ''; }
    var map = {};
    search.replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = i < 0 ? kv : kv.slice(0, i);
      var v = i < 0 ? '' : kv.slice(i + 1);
      try { k = decodeURIComponent(k); v = decodeURIComponent(v); } catch (e) { /* keep raw */ }
      map[k] = v;
    });
    if (map.seed !== undefined && /^-?\d+$/.test(map.seed.trim())) {
      var n = parseInt(map.seed.trim(), 10);
      if (isFinite(n)) out.seed = n >>> 0;
    }
    if (map.stage !== undefined && /^\d+$/.test(map.stage.trim())) {
      var st = parseInt(map.stage.trim(), 10);
      if (st >= 1 && st <= 5) out.stage = st;
    }
    out.debug = map.debug === '1';
    out.mute = map.mute === '1';
    out.touch = map.touch === '1';
    return out;
  };

  DM.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };

  /* small integer hash -> [0,1) used for deterministic art noise */
  DM.hash2 = function (x, y, s) {
    var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 2147483647)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  };
})(typeof window !== 'undefined' ? window : globalThis);
