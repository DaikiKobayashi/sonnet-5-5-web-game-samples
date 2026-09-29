/* util.js - shared helpers (namespace DM). Plain script, no modules. */
(function () {
  'use strict';
  var DM = (window.DM = window.DM || {});

  /* mulberry32 exactly as defined in SPEC 3.3 */
  DM.mulberry32 = function (seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  DM.clamp = function (v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  };

  /* integer hash -> [0,1). Used only for procedural art (never for gameplay). */
  DM.hash = function (x, y, s) {
    var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((s | 0) + 1, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  /* smooth value noise in [0,1) */
  DM.vnoise = function (x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = DM.hash(xi, yi, s), b = DM.hash(xi + 1, yi, s);
    var c = DM.hash(xi, yi + 1, s), d = DM.hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  /* localStorage wrappers: every access is guarded (SPEC 7.3) */
  DM.store = {
    get: function (key) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    },
    set: function (key, val) {
      try {
        window.localStorage.setItem(key, String(val));
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  DM.mkCanvas = function (w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };

  DM.pad = function (n, len) {
    var s = String(Math.max(0, Math.floor(n)));
    while (s.length < len) s = '0' + s;
    return s;
  };

  /* Visual-only RNG. Gameplay never touches it, Math.random is never used outside run-seed selection. */
  DM.vfxRng = DM.mulberry32(0x5eed1234);
})();
