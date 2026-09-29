/* sprites_tiles.js - terrain per theme (A09-A12), exit (A13), dynamite (A14), flames (A15), items (A16), torch.
 * Everything is drawn with 1 px dots by DM.Spr; no external files.
 */
(function () {
  'use strict';
  var DM = window.DM;
  var sh = DM.sh;
  var ell = sh.ell, rect = sh.rect, rrect = sh.rrect, sub = sh.sub, mv = sh.mv, and = sh.and, seg = sh.seg, poly = sh.poly, or = sh.or, blob = sh.blob;
  var mix = DM.mix;
  var hash = DM.hash;

  var SHADOW = '#00000060';

  /* Palettes. fl = floor [a, b, light speck, dark speck, patch]; wl/pl/rk = [base, light, dark, deep, accent] */
  var THEMES = [
    {
      name: 'tunnels',
      fl: ['#d2a66a', '#c79b60', '#e4bd86', '#a98048', '#cfa068'],
      wl: ['#6d4629', '#8f5f38', '#42271a', '#28170d', '#9a6a3a'],
      pl: ['#b57c40', '#e0a860', '#74491f', '#42260e', '#5a5a66'],
      rk: ['#a99f96', '#d6ccc2', '#6f645d', '#453c37', '#5b8a45'],
      ol: '#2a180c',
      amb: ['#1a0e08', 0.16],
      glow: '#ffb464'
    },
    {
      name: 'grotto',
      fl: ['#2e9088', '#298279', '#52bcae', '#1c665f', '#2a8a86'],
      wl: ['#4c3684', '#6f52b0', '#2a1c56', '#180f38', '#5fe0b0'],
      pl: ['#b050d8', '#e496ff', '#6e2c94', '#3e1660', '#7ff0e0'],
      rk: ['#9e98bc', '#d0cae8', '#615a86', '#3c3660', '#6ce0c0'],
      ol: '#150b2c',
      amb: ['#0c0620', 0.3],
      glow: '#7cf0d8'
    },
    {
      name: 'crystal',
      fl: ['#4f7cb4', '#4874aa', '#7ba9dc', '#365b90', '#4c80bc'],
      wl: ['#213c72', '#3d62a8', '#12244a', '#0a1430', '#7ad8ff'],
      pl: ['#52dcff', '#d6fcff', '#1c8ec6', '#0e5488', '#ffffff'],
      rk: ['#b4cfe8', '#eaf6ff', '#7a97bc', '#485f88', '#7ae6ff'],
      ol: '#0a1638',
      amb: ['#060c22', 0.3],
      glow: '#8ad8ff'
    },
    {
      name: 'lava',
      fl: ['#743428', '#6a2c22', '#8f4a36', '#4c1e18', '#7a3626'],
      wl: ['#331414', '#5a2620', '#1a0a0a', '#0c0404', '#ff7a1c'],
      pl: ['#463c46', '#7a6a7a', '#2a222c', '#171218', '#ff8a2a'],
      rk: ['#7c6862', '#b49a8c', '#463a38', '#261e1e', '#ff9a34'],
      ol: '#190807',
      amb: ['#1c0604', 0.32],
      glow: '#ff8a3c'
    },
    {
      name: 'deep',
      fl: ['#242858', '#1f2350', '#363c80', '#14173a', '#282e64'],
      wl: ['#0f1030', '#22265a', '#070818', '#03030c', '#3ef0ff'],
      pl: ['#2a2f62', '#5a64b8', '#141838', '#080a1c', '#3ef0ff'],
      rk: ['#4a5290', '#8792d6', '#2a3060', '#141838', '#46f0e0'],
      ol: '#05061a',
      amb: ['#03041a', 0.42],
      glow: '#5ae0ff'
    }
  ];
  DM.THEMES = THEMES;

  function speckle(S, pred, prob, color, seed) {
    S.fillFn(pred, function (ux, uy, x, y) {
      return hash(x, y, seed) < prob ? color : 0;
    });
  }

  /* ------------------------------------------------------------ floor */
  function floorTile(T, variant, deco, ti) {
    var S = new DM.Spr(32);
    var base = T.fl[variant];
    var seed = ti * 31 + variant * 7 + 3;
    S.fillFn(null, function (ux, uy, x, y) {
      var n = hash(x, y, seed);
      if (n < 0.055) return T.fl[2];
      if (n > 0.955) return T.fl[3];
      var v = DM.vnoise(x * 0.16 + variant * 9, y * 0.16, seed + 5);
      if (v > 0.66) return T.fl[4];
      return base;
    });
    /* soft bevel so the grid reads without harsh lines */
    S.fillFn(rect(0, 0, 32, 1), function () {
      return '#ffffff1e';
    });
    S.fillFn(rect(0, 0, 1, 32), function () {
      return '#ffffff14';
    });
    S.fillFn(rect(0, 31, 32, 32), function () {
      return '#00000026';
    });
    S.fillFn(rect(31, 0, 32, 32), function () {
      return '#0000001c';
    });
    if (deco) decoFloor(S, T, ti, variant);
    return S;
  }

  function decoFloor(S, T, ti, variant) {
    var o = variant ? 1 : 0;
    if (ti === 0) {
      /* pebbles + a crack */
      [[8 + o * 10, 10, 2.2, 1.5], [22 - o * 8, 21, 1.8, 1.3], [12 + o * 9, 25, 1.4, 1]].forEach(function (p) {
        S.fill(ell(p[0] + 0.6, p[1] + 0.8, p[2], p[3]), '#8f6a3e');
        S.fill(ell(p[0], p[1], p[2], p[3]), '#e9d3a8');
        S.fill(ell(p[0] - 0.4, p[1] - 0.3, p[2] * 0.5, p[3] * 0.5), '#fff4d8');
      });
      S.fill(seg(20, 6, 24, 9, 0.9), '#9a7040');
      S.fill(seg(24, 9, 23, 12, 0.9), '#9a7040');
    } else if (ti === 1) {
      /* tiny glowing mushrooms */
      [[9 + o * 12, 22, 1], [13 + o * 9, 25, 0.75], [22 - o * 12, 10, 0.85]].forEach(function (m) {
        var x = m[0], y = m[1], s = m[2];
        S.fill(rect(x - 0.6 * s, y, x + 0.6 * s + 0.4, y + 3 * s), '#dfe6ee');
        S.fill(ell(x, y, 2.6 * s, 1.9 * s), '#ff7ad8');
        S.fill(ell(x - 0.7 * s, y - 0.5 * s, 0.7 * s, 0.6 * s), '#ffd6f4');
        S.fill(ell(x, y + 3.8 * s, 3.4 * s, 1.5 * s), '#7ff0e01c');
      });
    } else if (ti === 2) {
      /* crystal shards */
      [[9 + o * 12, 24, 1], [22 - o * 10, 12, 0.8]].forEach(function (c) {
        var x = c[0], y = c[1], s = c[2];
        S.fill(poly([x - 2 * s, y, x, y - 6 * s, x + 2 * s, y]), '#c8f4ff');
        S.fill(poly([x, y - 6 * s, x + 2 * s, y, x, y]), '#5ec6ee');
        S.fill(poly([x - 4 * s, y + 0.6, x - 3 * s, y - 3 * s, x - 1.5 * s, y + 0.6]), '#9ee4ff');
        S.fill(rect(x - 2.6 * s, y, x + 2.6 * s, y + 1.1), '#2a5a94');
      });
    } else if (ti === 3) {
      /* glowing lava crack */
      var ox = o * 6;
      var pts = [[6 + ox, 8], [11 + ox, 11], [14 + ox, 10], [19 + ox, 15], [22 + ox, 14], [25 + ox, 20]];
      for (var i = 0; i < pts.length - 1; i++) {
        S.fill(seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 2.4), '#3a0e08');
        S.fill(seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1.3), '#ff7a1c');
      }
      S.fill(seg(11 + ox, 11, 12 + ox, 16, 0.9), '#ffb04a');
      S.fill(rect(14 + ox, 9, 15 + ox, 10), '#fff2a0');
    } else {
      /* glowing spores and a rune */
      [[8 + o * 10, 9], [21 - o * 8, 15], [12 + o * 8, 24], [25 - o * 12, 6]].forEach(function (p, i) {
        S.fill(rect(p[0], p[1], p[0] + 1.2, p[1] + 1.2), i % 2 ? '#3ef0ff' : '#c060ff');
        S.fill(rect(p[0] - 1, p[1] - 1, p[0] + 2.2, p[1] + 2.2), i % 2 ? '#3ef0ff20' : '#c060ff20');
      });
      S.fill(seg(14, 18, 18, 18, 0.9), '#3ef0ff66');
      S.fill(seg(16, 16, 16, 21, 0.9), '#3ef0ff66');
    }
  }

  /* ------------------------------------------------------------ outer wall */
  function wallTile(T, ti) {
    var S = new DM.Spr(32);
    var seed = ti * 17 + 91;
    S.fillFn(null, function (ux, uy, x, y) {
      var row = Math.floor(y / 8);
      var off = row % 2 ? 8 : 0;
      var bx = (x + off) % 16;
      var by = y % 8;
      var n = hash(x, y, seed);
      if (by === 7 || bx === 15) return T.wl[3]; /* mortar */
      var bi = Math.floor((x + off) / 16) + row * 5;
      var tone = hash(bi, row, seed + 3);
      var c = tone < 0.33 ? T.wl[0] : tone < 0.66 ? mix(T.wl[0], T.wl[2], 0.28) : mix(T.wl[0], T.wl[1], 0.22);
      if (by === 0 || bx === 0) c = T.wl[1]; /* lit edge */
      else if (by === 6 || bx === 14) c = T.wl[2]; /* shaded edge */
      else if (n < 0.06) c = T.wl[1];
      else if (n > 0.95) c = T.wl[2];
      return c;
    });
    /* themed detail */
    if (ti === 0) {
      speckle(S, null, 0.012, '#c9a070', seed + 8);
    } else if (ti === 1) {
      /* glowing moss creeping along mortar */
      S.fillFn(null, function (ux, uy, x, y) {
        var by = y % 8;
        if ((by === 7 || by === 6) && hash(Math.floor(x / 3), y, seed + 4) < 0.5) return T.wl[4] + (by === 7 ? 'ff' : 'aa');
        return 0;
      });
    } else if (ti === 2) {
      [[6, 4], [24, 12], [12, 20], [26, 27]].forEach(function (p) {
        S.fill(poly([p[0], p[1] - 3, p[0] + 1.5, p[1], p[0], p[1] + 3, p[0] - 1.5, p[1]]), T.wl[4]);
        S.fill(rect(p[0] - 0.5, p[1] - 0.5, p[0] + 0.5, p[1] + 0.5), '#ffffff');
      });
    } else if (ti === 3) {
      S.fillFn(null, function (ux, uy, x, y) {
        var by = y % 8;
        if (by === 7 && hash(Math.floor(x / 4), Math.floor(y / 8), seed + 6) < 0.55) return T.wl[4];
        if (by === 6 && hash(Math.floor(x / 4), Math.floor(y / 8), seed + 6) < 0.55) return '#ff7a1c66';
        return 0;
      });
    } else {
      speckle(S, null, 0.02, '#3ef0ff', seed + 2);
      speckle(S, null, 0.01, '#c060ff', seed + 5);
    }
    return S;
  }

  /* ------------------------------------------------------------ pillar */
  function pillarTile(T, ti) {
    var S = new DM.Spr(32);
    S.fill(ell(16, 28.4, 12.2, 3), SHADOW);
    var P = T.pl;
    if (ti === 0) {
      /* squared timber support post: end-grain top, plank sides, iron brackets, stone footing */
      S.fill(rrect(5, 24, 27, 29.4, 1.6), '#7a7a86');
      S.fill(rect(5, 24, 27, 25.2), '#b4b4c0');
      S.fill(rect(5, 28.2, 27, 29.4), '#4a4a56');
      var front = rect(7, 11, 25, 25);
      S.fill(front, P[0]);
      S.fill(sub(front, mv(front, -3.2, 0)), P[2]);
      S.fillFn(front, function (ux, uy, x, y) {
        if ((x - 7) % 6 === 2) return P[1];
        if ((x - 7) % 6 === 5) return P[3];
        return hash(x, y, 4) > 0.94 ? P[3] : 0;
      });
      S.fill(rect(7, 15.6, 25, 18), '#3a3a46');
      S.fill(rect(7, 15.6, 25, 16.6), '#8a8a9c');
      S.fill(rect(9, 16.4, 10.4, 17.4), '#d0d0e0');
      S.fill(rect(21.6, 16.4, 23, 17.4), '#d0d0e0');
      var topf = poly([5, 11, 27, 11, 25, 5, 7, 5]);
      S.fill(topf, P[1]);
      S.fill(poly([7, 5, 25, 5, 24, 6.4, 8, 6.4]), '#f6d090');
      S.fill(poly([9.4, 7, 22.6, 7, 23.6, 10, 8.4, 10]), P[0]);
      S.fill(poly([12, 8, 20, 8, 21, 9.4, 11, 9.4]), P[1]);
      S.fill(rect(5, 11, 27, 12.2), P[2]);
    } else if (ti === 1) {
      /* giant glowing mushroom */
      var stalk = rrect(11.4, 15, 20.6, 28, 3);
      S.fill(stalk, '#e9dccc');
      S.fill(sub(stalk, mv(stalk, -2.2, 0)), '#c0ae9a');
      S.fill(rect(11.4, 22, 20.6, 23), '#b8a690');
      var cap = and(ell(16, 14, 13.6, 10.6), function (x, y) {
        return y < 20;
      });
      S.fill(cap, P[0]);
      S.fill(sub(cap, mv(cap, -2.4, -2)), P[2]);
      S.fill(and(cap, function (x, y) {
        return y > 17.8;
      }), P[3]);
      S.fill(sub(and(cap, function (x, y) {
        return y < 12;
      }), mv(cap, 2, 2.4)), P[1]);
      [[10, 9, 2.1], [19, 8, 1.7], [22.5, 14, 1.6], [14, 13.5, 1.5], [7, 15, 1.3]].forEach(function (s) {
        S.fill(ell(s[0], s[1], s[2], s[2] * 0.8), '#f4e6ff');
        S.fill(ell(s[0] - 0.3, s[1] - 0.3, s[2] * 0.5, s[2] * 0.4), '#ffffff');
      });
      S.fill(rect(4, 18.2, 28, 19), P[4]);
    } else if (ti === 2) {
      /* crystal cluster */
      var main = poly([16, 1.6, 22.4, 7.6, 21.6, 25.8, 16, 29, 10.4, 25.8, 9.6, 7.6]);
      S.fill(poly([7.6, 12.4, 11.4, 15, 10.6, 26.4, 5.4, 25, 4.6, 15.6]), P[2]);
      S.fill(poly([24.4, 12.4, 27.4, 15.6, 26.6, 25, 21.6, 26.4, 21.2, 15]), P[2]);
      S.fill(poly([7.6, 12.4, 4.6, 15.6, 6, 16]), P[1]);
      S.fill(poly([24.4, 12.4, 27.4, 15.6, 26, 16]), P[1]);
      S.fill(main, P[0]);
      S.fill(poly([16, 1.6, 22.4, 7.6, 21.6, 25.8, 16, 29]), P[2]);
      S.fill(poly([16, 1.6, 16, 29, 10.4, 25.8, 9.6, 7.6]), P[0]);
      S.fill(poly([16, 1.6, 12.6, 5.4, 13.4, 22, 16, 25]), P[1]);
      S.fill(poly([16, 1.6, 22.4, 7.6, 16, 9.4, 9.6, 7.6]), P[1]);
      S.fill(seg(13.6, 10, 13.4, 22, 1), '#ffffff');
      S.fill(rect(15.4, 4, 16.6, 5.4), '#ffffff');
    } else if (ti === 3) {
      /* basalt column with lava veins */
      var col = poly([5.6, 8, 16, 3.6, 26.4, 8, 26.4, 26, 16, 29.4, 5.6, 26]);
      S.fill(col, P[0]);
      S.fill(poly([16, 3.6, 26.4, 8, 16, 12.4, 5.6, 8]), P[1]);
      S.fill(poly([16, 12.4, 26.4, 8, 26.4, 26, 16, 29.4]), P[2]);
      S.fill(poly([16, 12.4, 16, 29.4, 5.6, 26, 5.6, 8]), P[0]);
      S.fill(seg(16, 12.4, 16, 29.4, 0.9), P[3]);
      /* veins */
      [[[9, 15], [11.4, 19], [10, 24]], [[21, 14], [19.6, 19], [22.4, 24]], [[13, 6.4], [16, 8], [19, 6.4]]].forEach(function (v) {
        for (var i = 0; i < v.length - 1; i++) {
          S.fill(seg(v[i][0], v[i][1], v[i + 1][0], v[i + 1][1], 1.8), '#5a1608');
          S.fill(seg(v[i][0], v[i][1], v[i + 1][0], v[i + 1][1], 0.9), P[4]);
        }
      });
      S.fill(rect(9, 15, 10, 16), '#fff2a0');
    } else {
      /* obsidian monolith with a glowing rune */
      var mono = poly([9, 3.6, 23, 3.6, 26, 27.6, 6, 27.6]);
      S.fill(mono, P[0]);
      S.fill(poly([9, 3.6, 23, 3.6, 22, 8, 10, 8]), P[1]);
      S.fill(sub(mono, mv(mono, -3.6, 0)), P[2]);
      S.fill(poly([6, 27.6, 26, 27.6, 27, 29.6, 5, 29.6]), P[3]);
      S.fill(seg(10, 8, 7.2, 27, 0.9), P[1]);
      /* rune */
      var rc = P[4];
      S.fill(seg(16, 11, 16, 24, 1.2), rc);
      S.fill(seg(12, 14, 20, 14, 1.2), rc);
      S.fill(seg(12, 19, 16, 22, 1.2), rc);
      S.fill(seg(20, 19, 16, 22, 1.2), rc);
      S.fill(ell(16, 17, 5.4, 6.4), '#3ef0ff14');
      S.fill(rect(15.4, 15.6, 16.6, 16.6), '#ffffff');
    }
    return S.outline(T.ol);
  }

  /* ------------------------------------------------------------ rock (breakable) */
  function rockTile(T, ti) {
    var S = new DM.Spr(32);
    var R = T.rk;
    var seed = 40 + ti * 5;
    S.fill(ell(16, 28.6, 12.6, 2.6), SHADOW);
    var main = and(blob(16, 17.4, 12.2, seed, 0.09), function (x, y) {
      return y < 28.6;
    });
    S.fill(main, R[0]);
    S.fill(sub(main, mv(main, 2.4, 2.6)), R[1]);
    S.fill(sub(main, mv(main, -2.4, -2.4)), R[2]);
    S.fill(and(sub(main, mv(main, -4.8, -4.6)), function (x, y) {
      return y > 20;
    }), R[3]);
    /* facets */
    S.fill(and(main, poly([7, 16, 13, 9.6, 21, 11, 17, 18, 9, 20])), mix(R[0], R[1], 0.5));
    S.fill(and(main, poly([16, 20, 25, 15, 26, 23, 19, 26])), mix(R[0], R[2], 0.45));
    /* speckles for grain */
    S.fillFn(main, function (ux, uy, x, y) {
      var n = hash(x, y, seed);
      return n < 0.05 ? R[1] : n > 0.95 ? R[2] : 0;
    });
    /* cracks */
    var crack = ti === 3 ? '#3a1408' : R[3];
    S.fill(seg(13, 10, 15, 15, 1), crack);
    S.fill(seg(15, 15, 13, 19, 1), crack);
    S.fill(seg(15, 15, 19, 17, 1), crack);
    S.fill(seg(21, 21, 23.6, 24, 1), crack);
    /* themed accents */
    if (ti === 0) {
      S.fill(ell(22, 8.4, 3.2, 1.4), R[4]);
      S.fill(ell(21, 8, 1.6, 0.8), '#8bc46a');
      S.fill(seg(9, 24, 12, 22, 0.8), '#5a4030');
    } else if (ti === 1) {
      [[9.6, 9.4, 1.2], [21, 8.4, 1.0]].forEach(function (m) {
        S.fill(rect(m[0] - 0.5, m[1], m[0] + 0.5, m[1] + 2.4 * m[2]), '#e4f4ee');
        S.fill(ell(m[0], m[1], 2.5 * m[2], 1.8 * m[2]), '#ff7ad8');
        S.fill(ell(m[0] - 0.7, m[1] - 0.5, 0.7, 0.6), '#ffe0f6');
      });
      speckle(S, main, 0.02, R[4], seed + 2);
    } else if (ti === 2) {
      S.fill(poly([19.4, 10, 21.4, 3.4, 23.6, 10]), '#e6fbff');
      S.fill(poly([21.4, 3.4, 23.6, 10, 21.4, 10]), '#5ec6ee');
      S.fill(poly([14.4, 9.4, 15.6, 5, 17.4, 9.4]), '#c8f4ff');
      S.fill(rect(21, 5, 21.8, 6.6), '#ffffff');
    } else if (ti === 3) {
      [[[13, 10], [15, 15]], [[15, 15], [13, 19]], [[15, 15], [19, 17]], [[21, 21], [23.6, 24]]].forEach(function (s) {
        S.fill(seg(s[0][0], s[0][1], s[1][0], s[1][1], 0.9), R[4]);
      });
      S.fill(rect(14.6, 14.6, 15.6, 15.6), '#fff2a0');
    } else {
      speckle(S, main, 0.03, R[4], seed + 1);
      S.fill(rect(19, 12, 20.2, 13.2), '#c060ff');
      S.fill(rect(11, 21, 12.2, 22.2), R[4]);
    }
    return S.outline(T.ol);
  }

  /* Voronoi-chunked crumble frames: pieces fly apart, dissolve and fade */
  function crumble(rock, k, T) {
    var S = new DM.Spr(32);
    var seeds = [[10, 12], [20, 10], [14, 19], [23, 19], [8, 22], [17, 25], [26, 14]];
    var cx = 16, cy = 18;
    var spread = [1.4, 3.4, 5.6][k - 1];
    var drop = [0.05, 0.3, 0.68][k - 1];
    for (var y = 0; y < 32; y++) {
      for (var x = 0; x < 32; x++) {
        var p = rock.d[y * 32 + x];
        if (p >>> 24 < 255) continue;
        var best = 0, bd = 1e9;
        for (var i = 0; i < seeds.length; i++) {
          var dx = x - seeds[i][0], dy = y - seeds[i][1];
          var d = dx * dx + dy * dy;
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
        var vx = seeds[best][0] - cx, vy = seeds[best][1] - cy;
        var l = Math.sqrt(vx * vx + vy * vy) || 1;
        var fall = k * 1.4;
        var nx = Math.round(x + (vx / l) * spread), ny = Math.round(y + (vy / l) * spread * 0.8 + fall);
        if (hash(x, y, 200 + k) < drop) continue;
        S.set(nx, ny, p);
      }
    }
    S.fill(ell(16, 28.6, 12.6 - k * 2, 2.6 - k * 0.3), DM.withAlpha('#000000', 0.38 * (1 - k / 4)));
    /* dust puff */
    var dust = DM.withAlpha(T.rk[1], [0.5, 0.42, 0.28][k - 1]);
    S.fill(ell(16, 22, 6 + k * 3.2, 3 + k * 1.6), dust);
    S.fill(ell(10 - k, 20, 3 + k, 2 + k * 0.5), dust);
    S.fill(ell(22 + k, 20, 3 + k, 2 + k * 0.5), dust);
    return S;
  }

  /* ------------------------------------------------------------ torch */
  function torch(f, T) {
    var S = new DM.Spr(32);
    /* sconce */
    S.fill(rect(14.6, 17, 17.4, 27), '#5a3a20');
    S.fill(rect(14.6, 17, 15.8, 27), '#8a5a30');
    S.fill(rrect(12, 15, 20, 19, 1.4), '#3a3a44');
    S.fill(rect(12.6, 15.2, 19.4, 16.2), '#6a6a78');
    var h = [9, 10.5, 9.6, 11][f];
    var w = [3.4, 3, 3.6, 3.1][f];
    var sway = [0, 0.7, -0.5, 0.4][f];
    var outer = poly([16 - w, 15, 16 - w * 0.7 + sway * 0.5, 15 - h * 0.5, 16 + sway, 15 - h, 16 + w * 0.7 + sway * 0.5, 15 - h * 0.5, 16 + w, 15]);
    S.fill(outer, '#e8401a');
    S.fill(poly([16 - w * 0.7, 15, 16 + sway * 0.7, 15 - h * 0.78, 16 + w * 0.7, 15]), '#ff8a1e');
    S.fill(poly([16 - w * 0.4, 15, 16 + sway * 0.4, 15 - h * 0.5, 16 + w * 0.4, 15]), '#ffd23a');
    S.fill(rect(15.4, 13, 16.6, 15), '#fff6b0');
    return S.outline('#2a1408');
  }

  /* ------------------------------------------------------------ exit hatch */
  function exitClosed() {
    var S = new DM.Spr(32);
    S.fill(ell(16, 28.6, 14, 2.6), SHADOW);
    var fr = rrect(2.5, 3.5, 29.5, 28, 2.4);
    S.fill(fr, '#4a2c16');
    /* dark shaft boarded shut */
    var shaft = rrect(5.5, 6, 26.5, 26, 1.6);
    S.fill(shaft, '#1a100a');
    S.fillFn(shaft, function (ux, uy, x, y) {
      return (y - 6) % 5 === 4 ? '#0e0806' : hash(x, y, 61) > 0.94 ? '#2a1a10' : 0;
    });
    /* two crossed planks, nailed */
    [[[5.6, 7.4], [26.4, 24.6]], [[26.4, 7.4], [5.6, 24.6]]].forEach(function (pl, i) {
      var a1 = pl[0], a2 = pl[1];
      S.fill(and(seg(a1[0], a1[1], a2[0], a2[1], 5.6), shaft), i ? '#8a5a2e' : '#9a6a38');
      S.fill(and(seg(a1[0], a1[1] - 1.4, a2[0], a2[1] - 1.4, 1.4), shaft), '#c08a52');
      S.fill(and(seg(a1[0], a1[1] + 2.2, a2[0], a2[1] + 2.2, 1.2), shaft), '#5a3618');
    });
    [[7.6, 8.6], [24.4, 8.6], [7.6, 23.4], [24.4, 23.4]].forEach(function (n) {
      S.fill(rect(n[0] - 0.8, n[1] - 0.8, n[0] + 0.8, n[1] + 0.8), '#d0d8e8');
    });
    /* padlock at the crossing */
    S.fill(rrect(12.6, 13.4, 19.4, 20.4, 1.2), '#e8b830');
    S.fill(rect(12.6, 13.4, 19.4, 14.6), '#fff0a0');
    S.fill(rect(12.6, 19.4, 19.4, 20.4), '#a87818');
    S.fill(sub(and(ell(16, 13, 3.2, 3.8), function (x, y) {
      return y < 14.2;
    }), ell(16, 13.4, 1.7, 2.4)), '#aab2c4');
    S.fill(rect(15.4, 15.6, 16.6, 18.2), '#2a1a08');
    S.fill(ell(16, 15.8, 1, 1), '#2a1a08');
    /* warning red tint on the frame rim */
    S.fill(rect(2.5, 27, 29.5, 28), '#8a2a20');
    return S.outline('#1c0e06');
  }

  function exitOpen(f) {
    var S = new DM.Spr(32);
    S.fill(ell(16, 28.6, 14, 2.6), SHADOW);
    var fr = rrect(2.5, 3.5, 29.5, 28, 2.4);
    S.fill(fr, '#4a2c16');
    /* shaft: dark with a warm light rising from below */
    var shaft = rrect(5.5, 6, 26.5, 26, 1.6);
    S.fill(shaft, '#120a06');
    var pulse = f ? 1 : 0;
    S.fillFn(shaft, function (ux, uy) {
      var t = (uy - 6) / 20;
      var a = 0.25 + t * 0.55 + pulse * 0.12;
      return DM.withAlpha('#ffc94a', Math.min(0.9, a));
    });
    /* light rays */
    S.fill(poly([9, 8, 12, 8, 14, 26, 6.8, 26]), '#fff2a022');
    S.fill(poly([20, 8, 23, 8, 25.2, 26, 18, 26]), '#fff2a022');
    /* ladder */
    S.fill(rect(10.2, 6, 12, 26), '#8a5a2e');
    S.fill(rect(20, 6, 21.8, 26), '#8a5a2e');
    S.fill(rect(10.2, 6, 10.9, 26), '#c08a52');
    S.fill(rect(20, 6, 20.7, 26), '#c08a52');
    for (var y = 8; y < 26; y += 4.6) {
      S.fill(rect(12, y, 20, y + 1.6), '#b07840');
      S.fill(rect(12, y, 20, y + 0.6), '#e0a868');
    }
    /* hatch doors thrown open on the rim */
    S.fill(poly([2.5, 3.5, 7.4, 3.5, 5.4, 9, 2.5, 9]), '#7a4a24');
    S.fill(poly([29.5, 3.5, 24.6, 3.5, 26.6, 9, 29.5, 9]), '#7a4a24');
    S.fill(rect(2.5, 3.5, 7.4, 4.5), '#c08a52');
    S.fill(rect(24.6, 3.5, 29.5, 4.5), '#c08a52');
    /* bright rim glow */
    S.fill(rect(5.5, 6, 26.5, 7.2), f ? '#fff6b8' : '#ffe888');
    /* sparkles */
    var sp = f ? [[8, 14], [24, 19], [16, 10]] : [[24, 11], [8, 21], [16, 17]];
    sp.forEach(function (p) {
      S.fill(rect(p[0] - 0.5, p[1] - 2, p[0] + 0.5, p[1] + 2), '#ffffff');
      S.fill(rect(p[0] - 2, p[1] - 0.5, p[0] + 2, p[1] + 0.5), '#ffffff');
    });
    return S.outline('#1c0e06');
  }

  /* ------------------------------------------------------------ dynamite */
  var DYN = { red: '#e4392c', redL: '#ff8062', redD: '#a51f20', redDD: '#6c1012', cream: '#f4e4bc', creamD: '#c8b088', black: '#2a2830', ol: '#180c0e' };
  function dynamite(R, spark, hot) {
    var S = new DM.Spr(R);
    S.fill(ell(16, 28.8, 12, 2.4), SHADOW);
    var xs = [9.6, 16, 22.4];
    var tops = [11.4, 8.6, 11.4];
    xs.forEach(function (x, i) {
      var st = rrect(x - 3.2, tops[i], x + 3.2, 27.6, 1.8);
      S.fill(st, DYN.red);
      S.fill(sub(st, mv(st, -1.8, 0)), DYN.redD);
      S.fill(rect(x - 2.4, tops[i] + 1, x - 1.4, 25.6), DYN.redL);
      /* cream label band */
      S.fill(rect(x - 3.2, 16.4, x + 3.2, 21.4), DYN.cream);
      S.fill(rect(x + 1.2, 16.4, x + 3.2, 21.4), DYN.creamD);
      S.fill(rect(x - 2, 18, x - 0.8, 19.4), DYN.redDD);
      S.fill(rect(x + 0.2, 18, x + 1, 19.4), DYN.redDD);
      /* end cap */
      S.fill(ell(x, tops[i] + 0.6, 3.2, 1.5), DYN.redDD);
      S.fill(ell(x, tops[i] + 0.2, 2.4, 0.9), '#3a2a2a');
    });
    /* tape */
    S.fill(rect(6.4, 22.4, 25.6, 25.4), DYN.black);
    S.fill(rect(6.4, 22.4, 25.6, 23.2), '#5a5a68');
    S.fill(rect(6.4, 24.6, 25.6, 25.4), '#14141a');
    /* fuse */
    var f = [[16, 8.6], [17.4, 6.2], [19.6, 4.6], [22.2, 4.2]];
    for (var i = 0; i < f.length - 1; i++) {
      S.fill(seg(f[i][0], f[i][1], f[i + 1][0], f[i + 1][1], 1.5), '#5a3a22');
      S.fill(seg(f[i][0] - 0.3, f[i][1] - 0.3, f[i + 1][0] - 0.3, f[i + 1][1] - 0.3, 0.7), '#c8a060');
    }
    /* spark */
    var sx = 22.6, sy = 3.8;
    var r = [2.2, 3.6, 2.9][spark % 3];
    S.fill(ell(sx, sy, r + 1.6, r + 1.6), '#ffb02c30');
    S.fill(rect(sx - 0.6, sy - r - 1.2, sx + 0.6, sy + r + 1.2), '#ffcf3a');
    S.fill(rect(sx - r - 1.2, sy - 0.6, sx + r + 1.2, sy + 0.6), '#ffcf3a');
    S.fill(seg(sx - r, sy - r, sx + r, sy + r, 1), '#ff8a1e');
    S.fill(seg(sx - r, sy + r, sx + r, sy - r, 1), '#ff8a1e');
    S.fill(ell(sx, sy, 1.7, 1.7), '#fffbe0');
    var out = S.outline(DYN.ol);
    if (hot) {
      /* blink variant: whole body flashes hot */
      var hs = out.clone();
      for (var p = 0; p < hs.d.length; p++) {
        var c = hs.d[p];
        if (c >>> 24 === 255 && c !== DM.col(DYN.ol)) {
          var m = DM.mix(c, '#ffb070', 0.5);
          hs.d[p] = m;
        }
      }
      return hs;
    }
    return out;
  }

  /* ------------------------------------------------------------ flames */
  var FL = { rim: '#c22e10', outer: '#f04a16', mid: '#ff9a20', inner: '#ffdc44', core: '#fff8c4' };
  function flameHalfH(x, ph, big) {
    return big * (1 + 0.1 * Math.sin(x * 0.75 + ph) + 0.06 * Math.sin(x * 1.9 + ph * 1.7));
  }
  /* horizontal flame predicate: u,v in unit space; returns fn for layer scale s. end: 'arm' | 'tipL' (closed at left) */
  function hFlame(ph, s, end) {
    var big = 10.6 * s;
    return function (x, y) {
      var h = flameHalfH(x, ph, big);
      if (end === 'tipL') {
        var e0 = 3 + (1 - s) * 5;
        if (x < e0) return false;
        var span = 14 - (1 - s) * 5;
        if (x < e0 + span) {
          var t = 1 - (e0 + span - x) / span;
          h *= Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
        }
      }
      return Math.abs(y - 16) <= h;
    };
  }
  function centerFlame(ph, s) {
    var seed = Math.floor(ph * 3) + 11;
    return blob(16, 16, 13.4 * s, seed, 0.12);
  }
  function transpose(p) {
    return function (x, y) {
      return p(y, x);
    };
  }
  function flipX(p) {
    return function (x, y) {
      return p(32 - x, y);
    };
  }
  function flipY(p) {
    return function (x, y) {
      return p(x, 32 - y);
    };
  }
  function flameSprite(kind, f) {
    var S = new DM.Spr(32);
    var ph = f * 1.7;
    var layers = [
      [1.0, FL.rim],
      [0.86, FL.outer],
      [0.62, FL.mid],
      [0.38, FL.inner],
      [0.18, FL.core]
    ];
    layers.forEach(function (L) {
      var p;
      switch (kind) {
        case 'c':
          p = centerFlame(ph, L[0]);
          break;
        case 'h':
          p = hFlame(ph, L[0], 'arm');
          break;
        case 'v':
          p = transpose(hFlame(ph, L[0], 'arm'));
          break;
        case 'l':
          p = hFlame(ph, L[0], 'tipL');
          break;
        case 'r':
          p = flipX(hFlame(ph, L[0], 'tipL'));
          break;
        case 'u':
          p = transpose(hFlame(ph, L[0], 'tipL'));
          break;
        default:
          p = flipY(transpose(hFlame(ph, L[0], 'tipL')));
      }
      S.fill(p, L[1]);
    });
    /* flickering embers */
    [[5, 7], [26, 25], [9, 26], [24, 6]].forEach(function (e, i) {
      if ((i + f) % 2 === 0) S.set(e[0] + (f % 2), e[1], '#ffe07a');
    });
    return S;
  }

  /* ------------------------------------------------------------ items */
  function medallion(S, f) {
    S.fill(ell(16, 28.4, 10.4, 2), SHADOW);
    S.fill(ell(16, 16, 13, 13), '#f2c236');
    S.fill(sub(ell(16, 16, 13, 13), mv(ell(16, 16, 13, 13), -1.8, -1.8)), '#c08a1a');
    S.fill(sub(ell(16, 16, 13, 13), mv(ell(16, 16, 13, 13), 1.8, 1.8)), '#fff0a0');
    S.fill(ell(16, 16, 10.8, 10.8), '#1f2658');
    S.fill(sub(ell(16, 16, 10.8, 10.8), mv(ell(16, 16, 10.8, 10.8), 1.4, 1.6)), '#2c3676');
    S.fill(ell(11.6, 10.4, 2.4, 1.3), '#ffffff40');
  }
  function sparkle(S, x, y, s) {
    S.fill(rect(x - 0.6, y - s, x + 0.6, y + s), '#ffffff');
    S.fill(rect(x - s, y - 0.6, x + s, y + 0.6), '#ffffff');
  }
  function itemFire(f) {
    var S = new DM.Spr(32);
    medallion(S, f);
    var dy = f ? -0.6 : 0;
    var body = or(ell(16, 18.6 + dy, 5.8, 6.2), poly([11, 16.4 + dy, 14.6, 8.4 + dy, 16.4, 4.8 + dy, 17, 9.4 + dy, 20.4, 13 + dy, 21.2, 17 + dy]));
    S.fill(body, '#ff4a1a');
    S.fill(and(body, mv(body, 0.8, 1.6)), '#ff8a20');
    S.fill(ell(16, 20.2 + dy, 3.4, 4), '#ffc22c');
    S.fill(ell(16, 21.4 + dy, 1.8, 2.4), '#fff4b8');
    return S;
  }
  function itemBomb(f) {
    var S = new DM.Spr(32);
    medallion(S, f);
    S.fill(ell(15, 18.4, 6.6, 6.6), '#2e2e3c');
    S.fill(sub(ell(15, 18.4, 6.6, 6.6), mv(ell(15, 18.4, 6.6, 6.6), -1.6, -1.6)), '#14141c');
    S.fill(ell(12.6, 15.8, 2, 1.5), '#8a8aa8');
    S.fill(rect(12.6, 10.8, 17.4, 12.8), '#6a6a78');
    S.fill(seg(15, 10.8, 18, 8.4, 1), '#c8a060');
    var sp = f ? 1.9 : 1.4;
    S.fill(rect(18 - 0.5, 8.4 - sp - 0.6, 18 + 0.5, 8.4 + sp + 0.6), '#ffcf3a');
    S.fill(rect(18 - sp - 0.6, 8.4 - 0.5, 18 + sp + 0.6, 8.4 + 0.5), '#ffcf3a');
    /* plus badge */
    S.fill(rect(21.2, 12.6, 25, 13.8), '#7cff9a');
    S.fill(rect(22.6, 11.2, 23.6, 15.2), '#7cff9a');
    return S;
  }
  function itemBoots(f) {
    var S = new DM.Spr(32);
    medallion(S, f);
    var dy = f ? -0.5 : 0;
    var boot = poly([11, 8 + dy, 17.4, 8 + dy, 17.4, 16.6 + dy, 23.6, 18.6 + dy, 24, 23.4 + dy, 11, 23.4 + dy]);
    S.fill(boot, '#d8843c');
    S.fill(sub(boot, mv(boot, -1.6, -1.2)), '#8e4c1c');
    S.fill(rect(11, 8 + dy, 17.4, 11 + dy), '#f4f4f8');
    S.fill(rect(11, 10.4 + dy, 17.4, 11.2 + dy), '#b8b8c8');
    S.fill(rect(11, 22 + dy, 24, 24 + dy), '#3a2418');
    S.fill(rect(11.8, 12.6 + dy, 13, 20 + dy), '#f0b070');
    /* speed lines / wing */
    S.fill(seg(7, 13 + dy, 10.2, 13 + dy, 1), '#9ae8ff');
    S.fill(seg(6, 17 + dy, 10.2, 17 + dy, 1), '#9ae8ff');
    S.fill(seg(7.4, 21 + dy, 10.2, 21 + dy, 1), '#9ae8ff');
    S.fill(poly([19, 8 + dy, 24.4, 5.6 + dy, 23.4, 10 + dy]), '#ffffff');
    S.fill(poly([19, 10.4 + dy, 23.6, 9.6 + dy, 22, 13 + dy]), '#d8ecff');
    return S;
  }
  function itemLife(f, icon) {
    var S = new DM.Spr(32);
    medallion(S, f);
    var dy = f ? -1 : 0;
    var ic = new DM.Spr(32);
    /* place the 16x16 mole icon centred */
    var tmp = new DM.Spr(32);
    var ctx = null;
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) tmp.d[(y + 8 + dy) * 32 + (x + 8)] = icon.d[y * 16 + x];
    S.blit(tmp, 0, 0);
    /* heart badge */
    S.fill(ell(23.2, 22.6, 2, 1.8), '#ff4a6a');
    S.fill(ell(26, 22.6, 2, 1.8), '#ff4a6a');
    S.fill(poly([21.4, 23.4, 27.8, 23.4, 24.6, 27.4]), '#ff4a6a');
    S.fill(rect(22.4, 21.6, 23.4, 22.4), '#ffb0c0');
    return S;
  }

  DM.makeDynamite = dynamite;
  DM.buildTileSprites = function () {
    var out = { themes: [], exit: {}, bomb: [], bombFlash: [], flame: {}, item: {}, torch: [] };
    THEMES.forEach(function (T, ti) {
      var t = { def: T, floor: [], wall: null, pillar: null, rock: null, crumble: [] };
      t.floor.push(floorTile(T, 0, false, ti).toCanvas());
      t.floor.push(floorTile(T, 1, false, ti).toCanvas());
      t.floor.push(floorTile(T, 0, true, ti).toCanvas());
      t.floor.push(floorTile(T, 1, true, ti).toCanvas());
      t.wall = wallTile(T, ti).toCanvas();
      t.pillar = pillarTile(T, ti).toCanvas();
      var rk = rockTile(T, ti);
      t.rock = rk.toCanvas();
      for (var k = 1; k <= 3; k++) t.crumble.push(crumble(rk, k, T).toCanvas());
      out.themes.push(t);
    });
    out.exit.closed = exitClosed().toCanvas();
    out.exit.open = [exitOpen(0).toCanvas(), exitOpen(1).toCanvas()];
    for (var i = 0; i < 3; i++) {
      out.bomb.push(dynamite(32, i, false).toCanvas());
      out.bombFlash.push(dynamite(32, i, true).toCanvas());
    }
    ['c', 'h', 'v', 'l', 'r', 'u', 'd'].forEach(function (k) {
      out.flame[k] = [0, 1, 2, 3].map(function (f) {
        return flameSprite(k, f).toCanvas();
      });
    });
    if (!DM.moleIconSpr) DM.buildMoleIcon();
    var icon16 = DM.moleIconSpr;
    out.item.fire = [itemFire(0).outline('#1a1030').toCanvas(), sparkled(itemFire(1), 0)];
    out.item.bomb = [itemBomb(0).outline('#1a1030').toCanvas(), sparkled(itemBomb(1), 1)];
    out.item.boots = [itemBoots(0).outline('#1a1030').toCanvas(), sparkled(itemBoots(1), 0)];
    out.item.life = [itemLife(0, icon16).outline('#1a1030').toCanvas(), sparkled(itemLife(1, icon16), 1)];
    for (var f = 0; f < 4; f++) out.torch.push(torch(f).toCanvas());
    return out;
  };

  function sparkled(S, corner) {
    var pos = corner ? [[6, 24], [27, 8]] : [[5, 9], [27, 23]];
    pos.forEach(function (p) {
      sparkle(S, p[0], p[1], 2.6);
    });
    S.fill(rect(pos[0][0] - 0.6, pos[0][1] - 0.6, pos[0][0] + 0.6, pos[0][1] + 0.6), '#fff6a8');
    return S.outline('#1a1030').toCanvas();
  }
})();
