/* art_tiles.js - themed terrain (A09-A12), exit (A13), dynamite (A14), flames (A15), items (A16),
 * plus light / shadow helper images. Everything is generated procedurally with 1px art dots. */
(function (root) {
  'use strict';
  var DM = root.DM = root.DM || {};
  var Pix = DM.Pix, U = DM.ArtUtil, hex = Pix.hex, ramp = Pix.ramp, OL = U.OL, part = U.part, mix = Pix.mix;
  var hash2 = DM.hash2;

  /* ------------------------------------------------------------------ themes (colour data only) */
  var THEMES = [
    { /* 1: SHALLOW TUNNELS - brown earth, wooden supports */
      floor: ['#b08558', '#a67b4f'], floorLight: '#c99c6a', floorDark: '#8a6238', floorEdge: '#7a5430', floorHi: '#c8996a',
      wallStyle: 'planks', wall: ['#3a2517', '#56361f', '#744a2b', '#93623a'], mortar: '#2a1a0f',
      rock: ['#5e5648', '#857b68', '#aea38b', '#d6ccb2'], crack: '#3a3226', rockDeco: 'clay',
      bg: '#2a1a0f', debris: ['#857b68', '#aea38b', '#d6ccb2', '#5e5648'], dust: '#d9c39a',
      lamp: 'torch', glow: '#ff9a3c', lampGlowAlpha: 0.34, lanternAlpha: 0.20, accent: '#ffd27a'
    },
    { /* 2: MUSHROOM GROTTO - teal floor, purple stone, glowing fungi */
      floor: ['#1f706b', '#1a645f'], floorLight: '#33978c', floorDark: '#124a4a', floorEdge: '#0d3b3d', floorHi: '#3aa093',
      wallStyle: 'bricks', wall: ['#22103a', '#371a5a', '#502b80', '#6d42a6'], mortar: '#150826',
      rock: ['#4b4870', '#6c699a', '#908dc4', '#bab7e6'], crack: '#28264a', rockDeco: 'moss',
      bg: '#150826', debris: ['#6c699a', '#908dc4', '#bab7e6', '#5cc88a'], dust: '#a8e0d8',
      lamp: 'mushroom', glow: '#5affd0', lampGlowAlpha: 0.34, lanternAlpha: 0.20, accent: '#7dffd4'
    },
    { /* 3: CRYSTAL VEIN - blue and cyan */
      floor: ['#2b70b2', '#2667a2'], floorLight: '#4a92d2', floorDark: '#194c82', floorEdge: '#12406f', floorHi: '#5aa4de',
      wallStyle: 'bricks', wall: ['#0a2646', '#10396b', '#1a5595', '#2c7bc4'], mortar: '#071a30',
      rock: ['#5a86b8', '#82aedc', '#aed3f4', '#e2f4ff'], crack: '#345a8c', rockDeco: 'ice',
      bg: '#071a30', debris: ['#82aedc', '#aed3f4', '#e2f4ff', '#5a86b8'], dust: '#b8dcf5',
      lamp: 'crystal', glow: '#8fe8ff', lampGlowAlpha: 0.36, lanternAlpha: 0.20, accent: '#b8f2ff'
    },
    { /* 4: LAVA DEPTHS - red / orange, dark rocks */
      floor: ['#562a2a', '#4b2323'], floorLight: '#733636', floorDark: '#341717', floorEdge: '#2a0f0f', floorHi: '#7e3e38',
      wallStyle: 'bricks', wall: ['#170b0b', '#2b1313', '#431d1b', '#5f2b25'], mortar: '#0d0505',
      rock: ['#221b20', '#392f35', '#54464d', '#76656d'], crack: '#ff7a1a', rockDeco: 'lava',
      bg: '#0d0505', debris: ['#54464d', '#76656d', '#ff8a1a', '#392f35'], dust: '#b09080',
      lamp: 'lava', glow: '#ff6a1a', lampGlowAlpha: 0.40, lanternAlpha: 0.22, accent: '#ffb050'
    },
    { /* 5: THE DEEP DARK - near-black indigo, glowing accents */
      floor: ['#18134a', '#130f3e'], floorLight: '#261f68', floorDark: '#0b0828', floorEdge: '#08061e', floorHi: '#2e2878',
      wallStyle: 'bricks', wall: ['#08051f', '#130d42', '#1f1764', '#30268a'], mortar: '#050316',
      rock: ['#241f54', '#38337c', '#524ca4', '#7b74d0'], crack: '#38f0c8', rockDeco: 'veins',
      bg: '#050316', debris: ['#38337c', '#524ca4', '#7b74d0', '#38f0c8'], dust: '#7a70c0',
      lamp: 'rune', glow: '#a58cff', lampGlowAlpha: 0.38, lanternAlpha: 0.24, accent: '#c9b8ff'
    }
  ];

  /* ------------------------------------------------------------------ helpers */
  function shade(c, k) {
    var u = Pix.unpack(c);
    function f(v) { return Math.max(0, Math.min(255, Math.round(v * k))); }
    return Pix.pack(f(u[0]), f(u[1]), f(u[2]), u[3]);
  }
  function vnoise(x, y, seed) {
    var x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed), c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
    var top = a + (b - a) * fx, bot = c + (d - c) * fx;
    return top + (bot - top) * fy;
  }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  /* ------------------------------------------------------------------ floor */
  function pebbles(p, rng, n, th) {
    var light = hex(th.rock[3]), mid = hex(th.rock[2]), dark = hex(th.floorDark);
    for (var i = 0; i < n; i++) {
      var cx = 4 + rng() * 24, cy = 4 + rng() * 24, rx = 1.2 + rng() * 1.6, ry = 1 + rng() * 1.1;
      p.ellOver(cx + 1, cy + 1.2, rx, ry, Pix.withAlpha(dark, 0.7));
      p.ell(cx, cy, rx, ry, mid);
      p.set(Math.floor(cx - rx * 0.4), Math.floor(cy - ry * 0.4), light);
    }
  }
  function crackLine(p, rng, color, glow) {
    var x = 3 + rng() * 26, y = 3 + rng() * 26, ang = rng() * Math.PI * 2, len = 6 + rng() * 9;
    var pts = [[x, y]];
    for (var i = 0; i < 4; i++) {
      ang += (rng() - 0.5) * 1.6;
      x += Math.cos(ang) * len / 4; y += Math.sin(ang) * len / 4;
      pts.push([x, y]);
    }
    for (var j = 1; j < pts.length; j++) {
      p.lineOver(pts[j - 1][0], pts[j - 1][1], pts[j][0], pts[j][1], color);
      if (glow) p.lineOver(pts[j - 1][0], pts[j - 1][1] - 1, pts[j][0], pts[j][1] - 1, Pix.withAlpha(glow, 0.0));
    }
  }
  function mushMini(p, x, y, cap, capL, stem) {
    p.rect(x, y + 2, 1, 2, stem);
    p.hline(x - 2, y, 5, cap); p.hline(x - 1, y - 1, 3, cap); p.set(x - 1, y - 1, capL); p.set(x - 1, y, capL);
    p.set(x - 2, y + 1, hex('#000000', 0.25)); p.set(x + 2, y + 1, hex('#000000', 0.25));
  }

  function floorDetail(p, th, rng, deco) {
    var t = th.lamp;
    if (t === 'torch') {
      pebbles(p, rng, deco ? 5 : 2 + Math.floor(rng() * 2), th);
      crackLine(p, rng, hex(th.floorDark));
      if (deco) {
        /* a few dry roots / a wooden chip */
        var cx = 6 + rng() * 14, cy = 8 + rng() * 14;
        p.rect(cx, cy, 8, 2, hex('#7a5230')); p.hline(cx, cy, 8, hex('#9b6d3f')); p.set(cx + 8, cy, hex('#5a3a20'));
      }
    } else if (t === 'mushroom') {
      var i, gx, gy;
      for (i = 0; i < 9; i++) { gx = rng() * 30; gy = rng() * 30; p.set(gx, gy, hex(i % 3 ? '#2f8f6f' : '#43ad83')); }
      if (deco) {
        mushMini(p, 8 + rng() * 6, 10 + rng() * 6, hex('#57ffd0'), hex('#c4fff0'), hex('#a8e8d8'));
        mushMini(p, 20 + rng() * 5, 18 + rng() * 6, hex('#ff8fe0'), hex('#ffd4f4'), hex('#e8d0e8'));
        p.ellOver(16, 16, 12, 9, hex('#5affd0', 0.07));
      } else if (rng() < 0.5) { mushMini(p, 6 + rng() * 20, 8 + rng() * 16, hex('#3ad0b0'), hex('#8ff0d8'), hex('#8ac8bc')); }
    } else if (t === 'crystal') {
      for (var s = 0; s < (deco ? 4 : 1); s++) {
        var sx = 5 + rng() * 21, sy = 8 + rng() * 17, h = 3 + Math.floor(rng() * 4);
        p.poly([[sx, sy + h], [sx + 1, sy], [sx + 2, sy + h]], hex('#7fd0ff'));
        p.set(sx + 1, sy, hex('#ffffff'));
        p.set(sx + 1, sy + 1, hex('#c8f0ff'));
        p.set(sx + 2, sy + h, hex('#2a5aa0'));
      }
      for (var q = 0; q < 3; q++) p.set(rng() * 31, rng() * 31, hex(q ? '#7ab6f0' : '#d8f4ff'));
      if (deco) crackLine(p, rng, hex('#6aa4e6'));
    } else if (t === 'lava') {
      if (deco || rng() < 0.4) {
        var x0 = 3 + rng() * 10, y0 = 4 + rng() * 22, ang = (rng() - 0.5) * 1.2, len = 9 + rng() * 10, k;
        var pts = [[x0, y0]];
        for (k = 0; k < 5; k++) { ang += (rng() - 0.5) * 1.5; x0 += Math.cos(ang) * len / 5 + 1.5; y0 += Math.sin(ang) * len / 5; pts.push([x0, y0]); }
        for (k = 1; k < pts.length; k++) {
          p.lineOver(pts[k - 1][0], pts[k - 1][1] + 1, pts[k][0], pts[k][1] + 1, hex('#1a0808'));
          p.lineOver(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], hex('#e2501a'));
        }
        p.set(pts[2][0], pts[2][1], hex('#ffb040'));
      } else crackLine(p, rng, hex(th.floorDark));
      for (var e = 0; e < (deco ? 6 : 2); e++) p.set(rng() * 31, rng() * 31, hex(e % 2 ? '#ff9a30' : '#7a2c1c'));
    } else {
      /* rune: faint spores and cracks */
      for (var sp = 0; sp < (deco ? 8 : 4); sp++) {
        var px = rng() * 30, py = rng() * 30, col = sp % 2 ? '#38f0c8' : '#a58cff';
        p.set(px, py, hex(col, 0.85)); p.over(px + 1, py, hex(col, 0.25)); p.over(px, py + 1, hex(col, 0.25));
      }
      crackLine(p, rng, hex(th.floorDark));
      if (deco) {
        var rx = 16, ry = 16;
        for (var a = 0; a < 12; a++) p.set(rx + Math.cos(a / 12 * 6.283) * 6, ry + Math.sin(a / 12 * 6.283) * 5, hex('#5a4ac8', 0.75));
        p.set(16, 16, hex('#a58cff'));
      }
    }
  }

  function makeFloor(th, variant, seed, deco) {
    var p = new Pix(32, 32);
    var base = hex(th.floor[variant & 1]);
    var sl = hex(th.floorLight), sd = hex(th.floorDark);
    for (var y = 0; y < 32; y++) {
      for (var x = 0; x < 32; x++) {
        var n = hash2(x, y, seed), lf = vnoise(x / 7, y / 7, seed + 5) - 0.5, c = base;
        if (lf > 0.16) c = mix(base, sl, 0.4); else if (lf < -0.16) c = mix(base, sd, 0.4);
        if (n < 0.04) c = sl; else if (n > 0.97) c = sd;
        p.set(x, y, c);
      }
    }
    var rng = DM.mulberry32(seed * 977 + 13);
    floorDetail(p, th, rng, deco);
    var edge = hex(th.floorEdge), hi = hex(th.floorHi);
    p.hline(0, 31, 32, edge); p.vline(31, 0, 32, edge);
    for (var i = 0; i < 31; i++) { p.set(i, 0, mix(p.get(i, 0), hi, 0.5)); p.set(0, i, mix(p.get(0, i), hi, 0.5)); }
    return p;
  }

  /* ------------------------------------------------------------------ outer walls */
  function brickTexture(p, th, seed) {
    var wr = ramp(th.wall), mortar = hex(th.mortar);
    p.fill(mortar);
    for (var r = 0; r < 4; r++) {
      var off = (r % 2) * 8;
      for (var bx = -8; bx < 32; bx += 16) {
        var x0 = bx + off, y0 = r * 8;
        var t = hash2(x0 + 40, y0, seed);
        var base;
        if (t < 0.34) base = wr[1]; else if (t < 0.75) base = wr[2]; else base = wr[3];
        for (var y = 1; y < 8; y++) for (var x = 1; x < 16; x++) {
          var n = hash2(x0 + x, y0 + y, seed + 3);
          var c = base;
          if (n < 0.08) c = shade(base, 1.12); else if (n > 0.93) c = shade(base, 0.86);
          if (y === 1) c = shade(base, 1.22);
          else if (y === 7) c = shade(base, 0.78);
          if (x === 1) c = shade(c, 1.1);
          if (x === 15) c = shade(c, 0.85);
          p.set(x0 + x, y0 + y, c);
        }
      }
    }
  }
  function plankTexture(p, th, seed) {
    var wr = ramp(th.wall);
    p.fill(hex(th.mortar));
    for (var pl = 0; pl < 4; pl++) {
      var x0 = pl * 8, t = hash2(pl, 9, seed);
      var base = t < 0.4 ? wr[1] : t < 0.75 ? wr[2] : wr[1];
      for (var y = 0; y < 32; y++) for (var x = 1; x < 8; x++) {
        var n = hash2(x0 + x, y >> 1, seed + 7);
        var c = base;
        if (n < 0.14) c = shade(base, 1.14); else if (n > 0.88) c = shade(base, 0.82);
        if (x === 1) c = shade(c, 1.16);
        if (x === 7) c = shade(c, 0.8);
        p.set(x0 + x, y, c);
      }
      p.set(x0 + 4, 3, hex('#b0b4c0')); p.set(x0 + 4, 4, hex('#50525e'));
      p.set(x0 + 4, 27, hex('#b0b4c0')); p.set(x0 + 4, 28, hex('#50525e'));
    }
    /* cross beam */
    p.rect(0, 14, 32, 4, wr[3]);
    p.hline(0, 14, 32, shade(wr[3], 1.2)); p.hline(0, 17, 32, wr[0]);
    for (var k = 0; k < 32; k += 8) { p.set(k + 2, 15, hex('#b0b4c0')); p.set(k + 2, 16, hex('#50525e')); }
  }
  function wallDecor(p, th, seed) {
    var rng = DM.mulberry32(seed * 31 + 5), lamp = th.lamp, i;
    if (lamp === 'mushroom') {
      for (i = 0; i < 3; i++) { var x = 3 + rng() * 26, y = 4 + rng() * 22; p.set(x, y, hex('#c0ffe8', 0.9)); p.over(x + 1, y, hex('#5affd0', 0.35)); }
    } else if (lamp === 'crystal') {
      for (i = 0; i < 3; i++) { var cx = 4 + rng() * 24, cy = 5 + rng() * 20; p.poly([[cx, cy + 4], [cx + 1, cy], [cx + 3, cy + 4]], hex('#4aa8e8')); p.set(cx + 1, cy + 1, hex('#e0f8ff')); }
    } else if (lamp === 'lava') {
      for (i = 0; i < 2; i++) {
        var lx = 3 + rng() * 24, ly = 6 + rng() * 18;
        for (var k = 0; k < 7; k++) { p.set(lx + k, ly + Math.round(Math.sin(k * 0.9 + i) * 1.5), hex('#e2501a')); p.set(lx + k, ly + 1 + Math.round(Math.sin(k * 0.9 + i) * 1.5), hex('#3a0d08')); }
        p.set(lx + 3, ly, hex('#ffb040'));
      }
    } else if (lamp === 'rune') {
      for (i = 0; i < 2; i++) {
        var rx = 4 + rng() * 22, ry = 5 + rng() * 18;
        p.set(rx, ry, hex('#7a6ae8')); p.set(rx, ry + 1, hex('#7a6ae8')); p.set(rx + 1, ry + 2, hex('#a58cff')); p.set(rx - 1, ry + 2, hex('#a58cff'));
      }
    }
  }
  function makeWall(th, open, seed) {
    var p = new Pix(32, 32), wr = ramp(th.wall);
    if (th.wallStyle === 'planks') plankTexture(p, th, seed); else brickTexture(p, th, seed);
    wallDecor(p, th, seed);
    var i, y, x, hi = wr[3];
    if (open === 'bottom') {              /* arena is below: dark front face + lit cap on top */
      for (y = 21; y < 32; y++) for (x = 0; x < 32; x++) p.set(x, y, shade(p.get(x, y), y > 28 ? 0.62 : 0.8));
      p.hline(0, 21, 32, shade(hi, 1.1));
      for (i = 0; i < 4; i++) for (x = 0; x < 32; x++) p.set(x, i, shade(p.get(x, i), 1.2));
      p.hline(0, 31, 32, hex(th.mortar));
    } else if (open === 'top') {          /* arena is above: lit top edge */
      for (x = 0; x < 32; x++) { p.set(x, 0, shade(hi, 1.25)); p.set(x, 1, shade(hi, 1.08)); p.set(x, 2, shade(p.get(x, 2), 1.15)); }
      for (y = 26; y < 32; y++) for (x = 0; x < 32; x++) p.set(x, y, shade(p.get(x, y), 0.86));
    } else if (open === 'right') {        /* wall on the left edge, arena to its right */
      for (x = 27; x < 32; x++) for (y = 0; y < 32; y++) p.set(x, y, shade(p.get(x, y), x > 29 ? 0.6 : 0.78));
      for (y = 0; y < 32; y++) p.set(26, y, shade(p.get(26, y), 1.15));
    } else if (open === 'left') {         /* wall on the right edge, arena to its left */
      for (y = 0; y < 32; y++) { p.set(0, y, shade(hi, 1.2)); p.set(1, y, shade(p.get(1, y), 1.16)); p.set(2, y, shade(p.get(2, y), 1.06)); }
      for (x = 26; x < 32; x++) for (y = 0; y < 32; y++) p.set(x, y, shade(p.get(x, y), 0.88));
    }
    return p;
  }

  /* ------------------------------------------------------------------ pillars (A11): theme-specific objects */
  function pillarBase(p) { p.ellOver(16, 29.2, 12.4, 2.6, hex('#05030a', 0.42)); }

  function makePillar(th) {
    var p = new Pix(32, 32);
    pillarBase(p);
    var lamp = th.lamp;
    if (lamp === 'torch') {                       /* square mine timber with iron brackets */
      var WD = ramp(['#5c3818', '#82521f', '#b07a36', '#dba55c']), ME = ramp(['#3a3e48', '#606672', '#8e96a6', '#c2c8d6']);
      part(p, function (l) { l.rect(9, 5, 14, 23, WD[1]); }, OL);
      for (var x = 9; x < 23; x++) for (var y = 12; y < 28; y++) {
        var n = hash2(x, y >> 1, 4), c = x < 12 ? WD[2] : x < 17 ? WD[1] : x < 20 ? WD[1] : WD[0];
        if (x === 9) c = WD[3];
        if (n < 0.1) c = shade(c, 1.14); else if (n > 0.9) c = shade(c, 0.84);
        p.set(x, y, c);
      }
      for (var ty = 5; ty < 12; ty++) for (var tx = 9; tx < 23; tx++) p.set(tx, ty, WD[3]);      // top face (end grain)
      p.rect(10, 6, 12, 5, WD[2]); p.rect(12, 7, 8, 3, WD[3]); p.rect(14, 8, 4, 1, WD[1]);
      p.hline(9, 11, 14, WD[0]);
      p.rect(9, 13, 14, 3, ME[1]); p.hline(9, 13, 14, ME[3]); p.hline(9, 15, 14, ME[0]);        // iron bands
      p.rect(9, 22, 14, 3, ME[1]); p.hline(9, 22, 14, ME[3]); p.hline(9, 24, 14, ME[0]);
      [[11, 14], [20, 14], [11, 23], [20, 23]].forEach(function (r) { p.set(r[0], r[1], ME[3]); });
      part(p, function (l) { l.rrect(6, 26, 20, 4, 1.5, hex('#8b8478')); }, OL);                // stone footing
      p.hline(7, 26, 18, hex('#b5ad9e')); p.hline(7, 29, 18, hex('#5e584e'));
    } else if (lamp === 'mushroom') {             /* giant mushroom */
      var CAP = ramp(['#8a2a78', '#b7439c', '#e065be', '#ff9ae0']), ST = ramp(['#a08c84', '#cdbeb0', '#eee2d4', '#fffaf2']);
      part(p, function (l) { l.rect(12, 15, 8, 12, ST[1]); l.ell(16, 27, 5.5, 2, ST[1]); }, OL);
      for (var sy = 15; sy < 28; sy++) for (var sx = 12; sx < 20; sx++) p.set(sx, sy, sx < 14 ? ST[3] : sx < 17 ? ST[2] : sx < 19 ? ST[1] : ST[0]);
      p.ell(16, 27.2, 5, 1.6, ST[1]);
      p.hline(12, 16, 8, ST[0]);
      part(p, function (l) { l.ellShade(16, 13, 13, 9, CAP, { clipBottom: 16, dither: true }); l.hline(3, 15, 26, CAP[0]); }, OL);
      var spots = [[10, 8, 2.4, 1.7], [18, 6.6, 2.2, 1.6], [22.5, 11.5, 1.9, 1.4], [14, 12.4, 1.6, 1.2], [8, 12.6, 1.4, 1]];
      spots.forEach(function (s) { p.ell(s[0], s[1], s[2], s[3], hex('#fff0f8')); p.set(s[0] - 1, s[1] - 1, hex('#ffffff')); });
      p.set(6, 17, hex('#3fbf6a')); p.set(7, 17, hex('#5ce08a')); p.set(25, 27, hex('#3fbf6a')); p.set(6, 27, hex('#2a8a50')); p.set(7, 26, hex('#5ce08a'));
      p.set(24, 4, hex('#c0ffe8', 0.9)); p.set(5, 9, hex('#c0ffe8', 0.9));
    } else if (lamp === 'crystal') {              /* crystal cluster */
      var CR = ramp(['#1a72b4', '#31a4e2', '#6fd2ff', '#c4f2ff']);
      function prism(pts, facetPts) {
        part(p, function (l) { l.poly(pts, CR[1]); }, OL);
        p.poly(pts, CR[1]);
        if (facetPts) p.poly(facetPts, CR[2]);
      }
      part(p, function (l) { l.rrect(5, 25, 22, 5, 2, hex('#3a4f7a')); }, OL);
      p.hline(6, 25, 20, hex('#6f86b8')); p.hline(6, 29, 20, hex('#232f52'));
      prism([[7, 25], [6, 15], [10, 10], [14, 15], [14, 25]], [[10, 10], [14, 15], [14, 25], [10, 25]]);
      p.poly([[7, 25], [6, 15], [10, 10], [9, 16], [9, 25]], CR[3]);
      prism([[15, 26], [14, 12], [19, 3], [24, 12], [23, 26]], [[19, 3], [24, 12], [23, 26], [19, 26]]);
      p.poly([[15, 26], [14, 12], [19, 3], [18, 12], [18, 26]], CR[3]);
      p.line(19, 3, 19, 26, CR[0]);
      prism([[22, 26], [22, 17], [25, 13], [28, 17], [28, 26]], [[25, 13], [28, 17], [28, 26], [25, 26]]);
      p.set(18, 5, hex('#ffffff')); p.set(18, 6, hex('#ffffff')); p.set(9, 12, hex('#ffffff')); p.set(24, 15, hex('#ffffff'));
      p.set(3, 8, hex('#e0f8ff', 0.9)); p.set(4, 8, hex('#e0f8ff', 0.5)); p.set(3, 7, hex('#e0f8ff', 0.5)); p.set(3, 9, hex('#e0f8ff', 0.5));
    } else if (lamp === 'lava') {                 /* obsidian pillar with glowing seams */
      var OB = ramp(['#17121d', '#2b2231', '#463a52', '#6c5c7c']);
      part(p, function (l) { l.poly([[7, 27], [8, 10], [12, 5], [22, 5], [25, 10], [25, 27]], OB[1]); }, OL);
      p.poly([[7, 27], [8, 10], [12, 5], [22, 5], [25, 10], [25, 27]], OB[1]);
      p.poly([[8, 10], [12, 5], [22, 5], [25, 10], [16, 13]], OB[3]);                   // top face
      p.poly([[8, 10], [16, 13], [16, 27], [7, 27]], OB[2]);                           // left facet
      p.poly([[16, 13], [25, 10], [25, 27], [16, 27]], OB[0]);                          // right facet
      p.line(8, 10, 16, 13, hex('#ff7a1a')); p.line(16, 13, 25, 10, hex('#e2501a')); p.line(16, 13, 16, 27, hex('#e2501a'));
      p.line(12, 18, 15, 21, hex('#ff9a30')); p.line(19, 17, 21, 22, hex('#ff7a1a')); p.line(11, 23, 13, 26, hex('#e2501a'));
      p.set(16, 13, hex('#ffe08a')); p.set(14, 20, hex('#ffe08a'));
      p.set(10, 3, hex('#ff9a30')); p.set(21, 2, hex('#ff7a1a')); p.set(17, 1, hex('#ffd070'));
      p.hline(7, 28, 19, hex('#3a2a2a'));
    } else {                                      /* dark obelisk with a glowing rune */
      var OBL = ramp(['#14103e', '#211a60', '#34298c', '#4e42bc']);
      part(p, function (l) { l.poly([[9, 27], [10, 9], [13, 5], [19, 5], [22, 9], [23, 27]], OBL[1]); }, OL);
      p.poly([[9, 27], [10, 9], [13, 5], [19, 5], [22, 9], [23, 27]], OBL[1]);
      p.poly([[10, 9], [13, 5], [19, 5], [22, 9], [16, 11]], OBL[3]);
      p.poly([[10, 9], [16, 11], [16, 27], [9, 27]], OBL[2]);
      p.poly([[16, 11], [22, 9], [23, 27], [16, 27]], OBL[0]);
      var RN = hex('#a58cff'), RD = hex('#5a4ac8');
      p.vline(15, 14, 9, RD); p.vline(16, 14, 9, RN); p.line(12, 17, 16, 14, RN); p.line(20, 17, 16, 14, RN); p.hline(13, 21, 6, RN); p.hline(14, 24, 4, RD);
      p.set(16, 14, hex('#ffffff'));
      p.hline(8, 28, 17, hex('#191c46'));
      p.set(7, 20, hex('#a58cff', 0.7)); p.set(25, 15, hex('#38f0c8', 0.7));
    }
    return p;
  }

  /* ------------------------------------------------------------------ rocks (A12) - faceted boulders */
  function rockData(th, seed) {
    var rng = DM.mulberry32(seed * 7919 + 3);
    var rr = ramp(th.rock), n = 8, seeds = [], i;
    for (i = 0; i < n; i++) seeds.push([5 + rng() * 22, 6 + rng() * 21]);
    var facet = new Int8Array(32 * 32).fill(-1), border = new Uint8Array(32 * 32);
    var inside = new Uint8Array(32 * 32);
    for (var y = 0; y < 32; y++) {
      for (var x = 0; x < 32; x++) {
        /* superellipse boulder with a chipped edge */
        var dx = Math.abs(x + 0.5 - 16) / 13.6, dy = Math.abs(y + 0.5 - 17.2) / 12.6;
        var chip = 1 + (hash2(x >> 1, y >> 1, seed + 9) - 0.5) * 0.16;
        var e = (Math.pow(dx, 3.4) + Math.pow(dy, 3.4)) * chip;
        if (e > 1) continue;
        inside[y * 32 + x] = 1;
        var best = 1e9, second = 1e9, bi = 0;
        for (i = 0; i < n; i++) {
          var d = Math.hypot(x + 0.5 - seeds[i][0], (y + 0.5 - seeds[i][1]) * 1.15);
          if (d < best) { second = best; best = d; bi = i; } else if (d < second) second = d;
        }
        facet[y * 32 + x] = bi;
        if (second - best < 1.05) border[y * 32 + x] = 1;
      }
    }
    var p = new Pix(32, 32);
    var fb = seeds.map(function (s, k) {
      var lit = 0.5 - ((s[0] - 16) * 0.55 + (s[1] - 16) * 0.85) / 26;         // upper-left facets are brighter
      return Math.max(0, Math.min(3, Math.floor((lit + (hash2(k, 4, seed) - 0.5) * 0.45) * 4)));
    });
    for (y = 0; y < 32; y++) {
      for (x = 0; x < 32; x++) {
        var f = facet[y * 32 + x];
        if (f < 0) continue;
        var idx = fb[f];
        if (y > 22) idx = Math.max(0, idx - 1);                                // front face is darker
        if (y < 6 && idx < 3 && (x + y) % 3 === 0) idx += 1;                   // lit top rim
        p.set(x, y, rr[idx]);
        if (border[y * 32 + x] && hash2(x, y, seed + 21) < 0.85) p.set(x, y, shade(rr[Math.max(0, idx - 1)], 0.8));
      }
    }
    /* per-theme decoration */
    var dr = th.rockDeco, r2 = DM.mulberry32(seed * 131 + 7), k;
    if (dr === 'moss') {
      for (k = 0; k < 14; k++) { var mx = 4 + r2() * 24, my = 4 + r2() * 8; if (p.get(mx, my) && Pix.alphaOf(p.get(mx, my))) p.set(mx, my, hex(k % 3 ? '#4fb87a' : '#7be0a0')); }
      mushMini(p, 21 + Math.floor(r2() * 3), 7, hex('#57ffd0'), hex('#c4fff0'), hex('#a8e8d8'));
    } else if (dr === 'ice') {
      for (k = 0; k < 6; k++) { var ix = 5 + r2() * 22, iy = 4 + r2() * 20; if (Pix.alphaOf(p.get(ix, iy))) { p.set(ix, iy, hex('#ffffff')); p.set(ix + 1, iy, hex('#d8f4ff', 0.8)); } }
    } else if (dr === 'lava') {
      for (y = 0; y < 32; y++) for (x = 0; x < 32; x++) {
        if (border[y * 32 + x] && hash2(x, y, seed + 33) < 0.55 && Pix.alphaOf(p.get(x, y))) p.set(x, y, hex(hash2(x, y, 8) < 0.25 ? '#ffb040' : '#ff6a1a'));
      }
    } else if (dr === 'veins') {
      for (y = 0; y < 32; y++) for (x = 0; x < 32; x++) {
        if (border[y * 32 + x] && hash2(x, y, seed + 44) < 0.4 && Pix.alphaOf(p.get(x, y))) p.set(x, y, hex(hash2(x, y, 9) < 0.3 ? '#a58cff' : '#38f0c8'));
      }
    } else {
      /* clay: little pebbles and dark cracks */
      for (k = 0; k < 5; k++) { var cx = 5 + r2() * 22, cy = 5 + r2() * 18; if (Pix.alphaOf(p.get(cx, cy))) { p.set(cx, cy, hex(th.rock[3])); p.set(cx + 1, cy + 1, hex(th.crack)); } }
    }
    /* outline (dark) */
    var out = p.clone();
    out.outline(shade(rr[0], 0.34), true);
    return { pix: out, facet: facet, seeds: seeds, inside: inside, ramp: rr };
  }

  function crumbleFrames(th, rd) {
    var frames = [], f;
    var cx = 16, cy = 17;
    for (f = 0; f < 3; f++) {
      var p = new Pix(32, 32);
      var off = [1.5, 4.5, 8][f], alpha = [1, 0.95, 0.5][f];
      var src = rd.pix;
      for (var y = 0; y < 32; y++) {
        for (var x = 0; x < 32; x++) {
          var c = src.get(x, y);
          if (!Pix.alphaOf(c)) continue;
          var fid = rd.facet[y * 32 + x];
          var sx = fid >= 0 ? rd.seeds[fid][0] - cx : x - cx, sy = fid >= 0 ? rd.seeds[fid][1] - cy : y - cy;
          var len = Math.hypot(sx, sy) || 1;
          var ox = Math.round(sx / len * off), oy = Math.round(sy / len * off * 0.8) + (f === 2 ? 2 : 0);
          if (f === 2 && hash2(x, y, 3) < 0.45) continue;
          if (f === 1 && hash2(x, y, 4) < 0.12) continue;
          var cc = f === 0 ? mix(c, hex('#ffffff'), 0.22) : c;
          p.over(x + ox, y + oy, alpha < 1 ? Pix.withAlpha(cc, alpha) : cc);
        }
      }
      if (f === 0) {   /* cracks radiating from the centre */
        var ck = hex(th.rockDeco === 'lava' ? '#ffb040' : th.rockDeco === 'veins' ? '#38f0c8' : '#1e1620');
        p.line(16, 17, 8, 8, ck); p.line(16, 17, 25, 10, ck); p.line(16, 17, 12, 27, ck); p.line(16, 17, 24, 25, ck);
      }
      frames.push(p.toCanvas());
    }
    return frames;
  }

  /* ------------------------------------------------------------------ wall lamps (A29 torches / glows) */
  function lampFrame(th, f) {
    var p = new Pix(32, 32), lamp = th.lamp;
    if (lamp === 'torch') {
      var WD = ramp(['#4a2c14', '#6e4220', '#946030', '#c08040']);
      part(p, function (l) { l.rect(14, 17, 4, 11, WD[1]); l.rect(12, 15, 8, 3, hex('#5a5f6c')); }, OL);
      p.vline(14, 18, 9, WD[3]); p.vline(17, 18, 9, WD[0]); p.hline(12, 15, 8, hex('#9098a8'));
      var fl = [[0, 0], [1, -1], [-1, -2]][f % 3];
      part(p, function (l) {
        l.poly([[16 + fl[0], 4 + fl[1]], [20, 10], [19, 14], [13, 14], [12, 10]], hex('#e2501a'));
      }, hex('#7a1f10'));
      p.poly([[16 + fl[0], 6 + fl[1]], [19, 11], [18, 14], [14, 14], [13, 11]], hex('#ff9a30'));
      p.poly([[16 + fl[0] * 0.5, 9 + fl[1] * 0.5], [18, 12], [17, 14], [15, 14], [14, 12]], hex('#ffe070'));
      p.set(16, 13, hex('#ffffff'));
      if (f === 1) { p.set(21, 6, hex('#ffb040')); p.set(11, 8, hex('#ff9a30')); } else if (f === 2) { p.set(20, 4, hex('#ffb040')); p.set(12, 5, hex('#ffd070')); } else { p.set(22, 9, hex('#ff9a30')); }
    } else if (lamp === 'mushroom') {
      var glowc = ['#57ffd0', '#7dffe0', '#40e8c0'][f % 3];
      function mush(x, y, s, col) {
        part(p, function (l) { l.ellShade(x, y, s * 2.6, s * 1.7, ramp(['#188a78', '#28c8a8', col, '#eafff8']), { clipBottom: y + 0.5 }); l.rect(x - 1, y, 2, s * 1.6 + 1, hex('#cfe8e0')); }, hex('#0f3a3a'));
      }
      mush(11, 18, 2, glowc); mush(19, 15, 2.6, '#ff9be6'); mush(23, 21, 1.6, glowc);
      p.set(10, 16, hex('#ffffff')); p.set(18, 12, hex('#fff0fa'));
    } else if (lamp === 'crystal') {
      var CR = ramp(['#1a72b4', '#31a4e2', '#6fd2ff', '#c4f2ff']);
      var pulse = [0, 1, 0.5][f % 3];
      part(p, function (l) { l.poly([[16, 5], [21, 13], [19, 26], [13, 26], [11, 13]], CR[1]); l.poly([[8, 14], [11, 18], [10, 26], [6, 26], [5, 18]], CR[1]); }, hex('#0c2a5a'));
      p.poly([[16, 5], [21, 13], [19, 26], [16, 26]], CR[2]); p.poly([[16, 5], [11, 13], [13, 26], [16, 26]], CR[3]);
      p.set(15, 9, hex('#ffffff')); p.set(15, 10, hex('#ffffff'));
      if (pulse > 0.4) { p.set(22, 8, hex('#ffffff')); p.set(21, 8, hex('#c4f2ff', 0.6)); p.set(23, 8, hex('#c4f2ff', 0.6)); p.set(22, 7, hex('#c4f2ff', 0.6)); p.set(22, 9, hex('#c4f2ff', 0.6)); }
      if (pulse > 0.9) { p.set(7, 12, hex('#ffffff')); }
    } else if (lamp === 'lava') {
      var h = [0, 1, 2][f % 3];
      part(p, function (l) { l.ell(16, 20, 8, 5, hex('#c83a12')); }, hex('#3a0d08'));
      p.ell(16, 20, 6.4, 3.8, hex('#ff6a1a')); p.ell(16, 19.6, 4, 2.4, hex('#ffb040')); p.ell(16, 19.4, 2, 1.2, hex('#fff0a0'));
      p.set(12, 17 - h, hex('#ffb040')); p.set(20, 16 + h - 1, hex('#ff6a1a')); p.set(16, 13 - h, hex('#ffd070'));
      p.vline(9, 6, 8, hex('#3a0d08')); p.vline(23, 5, 9, hex('#3a0d08'));
      p.set(9, 14 + h, hex('#ff6a1a')); p.set(23, 13 + h, hex('#ff8a30'));
    } else {
      var a = [0.6, 1, 0.8][f % 3];
      part(p, function (l) { l.ell(16, 16, 9, 9, hex('#1c2258')); }, hex('#0a0c2a'));
      p.ell(16, 16, 7.4, 7.4, hex('#2d3580'));
      var RN = hex('#a58cff'), RD = hex('#5a4ac8');
      p.vline(15, 11, 10, RD); p.vline(16, 11, 10, RN); p.line(11, 14, 16, 11, RN); p.line(21, 14, 16, 11, RN); p.hline(12, 18, 8, RN);
      p.ellOver(16, 16, 13 * a, 13 * a, hex('#a58cff', 0.12));
      p.set(16, 11, hex('#ffffff'));
    }
    return p.toCanvas();
  }

  /* ------------------------------------------------------------------ exit (A13) */
  function makeExit(open, f) {
    var p = new Pix(32, 32);
    var M = ramp(['#2c3038', '#4a505c', '#7a8292', '#aab2c4']);
    /* frame with hazard stripes */
    part(p, function (l) { l.rrect(2, 3, 28, 27, 3, M[1]); }, OL);
    p.rrect(3, 4, 26, 25, 3, hex('#3a3f4a'));
    for (var i = 0; i < 26; i++) {
      var stripe = ((i >> 2) & 1) ? hex('#f4c21a') : hex('#1c1a22');
      p.set(3 + i, 4, stripe); p.set(3 + i, 5, stripe); p.set(3 + i, 27, stripe); p.set(3 + i, 28, stripe);
      p.set(3, 4 + i, ((i >> 2) & 1) ? hex('#f4c21a') : hex('#1c1a22')); p.set(4, 4 + i, ((i >> 2) & 1) ? hex('#f4c21a') : hex('#1c1a22'));
      p.set(28, 4 + i, ((i >> 2) & 1) ? hex('#f4c21a') : hex('#1c1a22')); p.set(27, 4 + i, ((i >> 2) & 1) ? hex('#f4c21a') : hex('#1c1a22'));
    }
    if (!open) {
      /* closed hatch: two steel leaves with rivets and a red lock light */
      p.rect(6, 8, 20, 17, M[1]);
      p.rect(6, 8, 10, 17, M[2]); p.rect(16, 8, 10, 17, M[1]);
      p.hline(6, 8, 20, M[3]); p.vline(6, 8, 17, M[3]); p.vline(25, 8, 17, M[0]); p.hline(6, 24, 20, M[0]);
      p.vline(15, 8, 17, M[0]); p.vline(16, 8, 17, hex('#1c1a22'));
      [[8, 10], [23, 10], [8, 22], [23, 22]].forEach(function (r) { p.set(r[0], r[1], M[3]); p.set(r[0] + 1, r[1] + 1, M[0]); });
      p.rect(13, 14, 6, 5, hex('#c8a020')); p.hline(13, 14, 6, hex('#ffe070')); p.hline(13, 18, 6, hex('#7a5e0c'));    // lock plate
      p.rect(15, 15, 2, 2, hex('#ff3030')); p.set(15, 15, hex('#ffb0b0'));
      p.set(15, 12, M[3]); p.set(16, 12, M[3]);
    } else {
      /* open hatch: a shaft with a ladder and light */
      p.rect(6, 8, 20, 17, hex('#0e0c14'));
      var pulse = f === 0 ? 0 : 1;
      p.rect(9, 8, 14, 16, hex('#1a1624'));
      p.rect(11, 8, 10, 15, hex(pulse ? '#ffe98a' : '#ffd84a', 1));
      p.rect(13, 8, 6, 15, hex(pulse ? '#fff8d0' : '#ffef9a'));
      /* rays */
      p.poly([[11, 8], [21, 8], [24, 24], [8, 24]], hex('#ffe98a', pulse ? 0.55 : 0.4));
      /* ladder */
      p.vline(12, 8, 16, hex('#7a4a22')); p.vline(19, 8, 16, hex('#7a4a22'));
      p.vline(11, 8, 16, hex('#a8703a')); p.vline(18, 8, 16, hex('#a8703a'));
      for (var y = 10; y < 24; y += 3) { p.hline(11, y, 9, hex('#c58a4a')); p.hline(11, y + 1, 9, hex('#6e4020')); }
      /* open leaves */
      p.rect(3, 8, 3, 17, M[1]); p.vline(3, 8, 17, M[3]); p.rect(26, 8, 3, 17, M[0]);
      /* green arrow */
      var ay = 5 + (pulse ? 0 : 1);
      p.poly([[16, ay - 2], [19, ay + 1], [13, ay + 1]], hex('#5aff8a'));
      p.set(16, ay - 1, hex('#e0ffe8'));
      /* sparkles */
      if (pulse) { p.set(9, 12, hex('#ffffff')); p.set(23, 17, hex('#ffffff')); } else { p.set(23, 11, hex('#ffffff')); p.set(9, 19, hex('#ffffff')); }
    }
    return p.toCanvas();
  }

  /* ------------------------------------------------------------------ dynamite (A14) */
  function makeBomb(f, flash) {
    var p = new Pix(32, 32);
    p.ellOver(16, 28.8, 10, 2.6, U.SHADOW);
    var R = ramp(['#7a1418', '#b02222', '#e23a2e', '#ff7a66']);
    function stick(x0, y0, w, h) {
      part(p, function (l) { l.rrect(x0, y0, w, h, 2, R[2]); }, OL);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var cx = x / (w - 1);
        var c = cx < 0.2 ? R[3] : cx < 0.5 ? R[2] : cx < 0.8 ? R[1] : R[0];
        if (Pix.alphaOf(p.get(x0 + x, y0 + y)) && !(y < 1 && (x === 0 || x === w - 1)) && !(y > h - 2 && (x === 0 || x === w - 1))) p.set(x0 + x, y0 + y, c);
      }
      p.ell(x0 + w / 2, y0 + 1.6, w / 2 - 0.4, 1.7, hex('#ffb6a6'));                  // top cap
      p.ell(x0 + w / 2, y0 + 1.6, w / 2 - 2, 0.9, hex('#ffe0d8'));
    }
    stick(6, 12, 8, 15); stick(18, 12, 8, 15); stick(11, 14, 10, 15);
    /* black tape + label */
    p.rect(6, 20, 20, 3, hex('#23202b')); p.hline(6, 20, 20, hex('#4a4656')); p.hline(6, 22, 20, hex('#100e15'));
    p.rect(12, 23, 8, 4, hex('#f6eedc')); p.hline(12, 23, 8, hex('#ffffff')); p.hline(12, 26, 8, hex('#c8bea8'));
    p.set(13, 24, hex('#c8202a')); p.set(14, 24, hex('#c8202a')); p.set(16, 24, hex('#c8202a')); p.set(18, 24, hex('#c8202a'));
    p.set(15, 25, hex('#c8202a')); p.set(17, 25, hex('#c8202a'));
    p.outline(OL);
    /* fuse */
    var FU = hex('#6b4a2a'), FL = hex('#b58a52');
    var pts = [[16, 13], [16, 11], [17, 10], [18, 9], [18, 7]];
    for (var i = 1; i < pts.length; i++) p.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], i % 2 ? FU : FL);
    p.set(16, 12, FU);
    /* spark */
    var sx = 18, sy = 6;
    if (f === 0) { p.set(sx, sy, hex('#ffffff')); p.set(sx - 1, sy, hex('#ffd23f')); p.set(sx + 1, sy, hex('#ffd23f')); p.set(sx, sy - 1, hex('#ffd23f')); p.set(sx, sy + 1, hex('#ff8a1a')); p.set(sx + 2, sy - 2, hex('#ff8a1a')); p.set(sx - 2, sy - 1, hex('#ffb040')); }
    else if (f === 1) { p.rect(sx - 1, sy - 1, 3, 3, hex('#ffd23f')); p.set(sx, sy, hex('#ffffff')); p.set(sx - 2, sy - 2, hex('#ff8a1a')); p.set(sx + 2, sy - 2, hex('#ffb040')); p.set(sx + 2, sy + 1, hex('#ff8a1a')); p.set(sx, sy - 3, hex('#ffe070')); p.set(sx - 3, sy, hex('#ff8a1a')); p.set(sx + 3, sy, hex('#ffb040')); }
    else { p.set(sx, sy, hex('#ffffff')); p.set(sx, sy - 1, hex('#ffb040')); p.set(sx + 1, sy, hex('#ffd23f')); p.set(sx - 1, sy + 1, hex('#ff8a1a')); p.set(sx + 3, sy - 1, hex('#ffd23f')); p.set(sx - 2, sy - 2, hex('#ff8a1a')); }
    if (flash) return p.tint(hex('#fff2c0'), 0.55);
    return p;
  }

  /* ------------------------------------------------------------------ flames (A15) */
  var FC = { core: hex('#fffbe0'), yellow: hex('#ffe04a'), orange: hex('#ff9a1e'), red: hex('#f0501a'), edge: hex('#8a1c10') };
  function fireColor(t) {
    if (t < 0.3) return FC.core;
    if (t < 0.55) return FC.yellow;
    if (t < 0.8) return FC.orange;
    return FC.red;
  }
  function flameCenter(f, k) {
    var p = new Pix(32, 32);
    for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
      var dx = x + 0.5 - 16, dy = y + 0.5 - 16, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      var spike = Math.pow(Math.abs(Math.cos(2 * a)), 6) * 5.5 * k;
      var wob = (vnoise(a * 2 + f * 1.7, f * 0.9, 21) - 0.5) * 4.2 + Math.sin(a * 5 + f * 1.9) * 0.9;
      var R = (11.2 + spike + wob) * k;
      if (d <= R) p.set(x, y, fireColor(d / R + (hash2(x, y, f + 2) - 0.5) * 0.12));
    }
    p.outline(FC.edge);
    p.set(16, 16, FC.core);
    return p;
  }
  function flameArm(f, k) {
    var p = new Pix(32, 32);
    for (var x = 0; x < 32; x++) {
      var hh = (9.4 + (vnoise(x / 3.2 + f * 1.3, f, 31) - 0.5) * 3.4) * k;
      for (var y = 0; y < 32; y++) {
        var dy = y + 0.5 - 16;
        if (Math.abs(dy) <= hh) p.set(x, y, fireColor(Math.abs(dy) / hh + (hash2(x, y, f + 5) - 0.5) * 0.14));
      }
    }
    /* outline only along the long edges */
    var q = p.clone();
    for (var xx = 0; xx < 32; xx++) {
      var top = -1, bot = -1;
      for (var yy = 0; yy < 32; yy++) if (Pix.alphaOf(p.get(xx, yy))) { if (top < 0) top = yy; bot = yy; }
      if (top > 0) q.set(xx, top - 1, FC.edge);
      if (bot >= 0 && bot < 31) q.set(xx, bot + 1, FC.edge);
    }
    return q;
  }
  function flameTip(f, k) {
    var p = new Pix(32, 32);
    for (var x = 0; x < 32; x++) {
      var hh;
      if (x < 15) hh = (9.4 + (vnoise(x / 3.2 + f * 1.3, f, 31) - 0.5) * 3.4) * k;
      else {
        var t = (x + 0.5 - 15) / (13.5 * k);
        hh = t >= 1 ? -1 : (9.4 * k) * Math.sqrt(Math.max(0, 1 - t * t)) + (vnoise(x / 2 + f, f * 2, 41) - 0.5) * 1.6;
      }
      for (var y = 0; y < 32; y++) {
        var dy = y + 0.5 - 16;
        if (hh > 0 && Math.abs(dy) <= hh) {
          var tt = Math.abs(dy) / hh * 0.7 + (x > 15 ? (x - 15) / 14 * 0.35 : 0);
          p.set(x, y, fireColor(tt + (hash2(x, y, f + 7) - 0.5) * 0.14));
        }
      }
    }
    var q = p.clone();
    for (var xx = 0; xx < 32; xx++) {
      var top = -1, bot = -1;
      for (var yy = 0; yy < 32; yy++) if (Pix.alphaOf(p.get(xx, yy))) { if (top < 0) top = yy; bot = yy; }
      if (top > 0) q.set(xx, top - 1, FC.edge);
      if (bot >= 0 && bot < 31) q.set(xx, bot + 1, FC.edge);
    }
    /* rounded end cap */
    var last = -1;
    for (var x2 = 31; x2 >= 0; x2--) { for (var y2 = 0; y2 < 32; y2++) if (Pix.alphaOf(p.get(x2, y2))) { last = x2; break; } if (last >= 0) break; }
    for (var y3 = 0; y3 < 32; y3++) if (Pix.alphaOf(p.get(last, y3))) q.set(last + 1, y3, FC.edge);
    return q;
  }
  function makeFlames() {
    var out = { center: [], armH: [], armV: [], tip: { right: [], left: [], up: [], down: [] }, small: { center: [], armH: [], armV: [], tip: { right: [], left: [], up: [], down: [] } } };
    function tipSet(dst, pix) {
      dst.right.push(pix.toCanvas()); dst.left.push(pix.flipH().toCanvas()); dst.down.push(pix.rotCW().toCanvas()); dst.up.push(pix.rotCCW().toCanvas());
    }
    var f;
    for (f = 0; f < 4; f++) {
      out.center.push(flameCenter(f, 1).toCanvas());
      var a = flameArm(f, 1);
      out.armH.push(a.toCanvas()); out.armV.push(a.rotCW().toCanvas());
      tipSet(out.tip, flameTip(f, 1));
    }
    [0.78, 0.55].forEach(function (k, i) {
      out.small.center.push(flameCenter(i, k).toCanvas());
      var a2 = flameArm(i, k);
      out.small.armH.push(a2.toCanvas()); out.small.armV.push(a2.rotCW().toCanvas());
      tipSet(out.small.tip, flameTip(i, k));
    });
    return out;
  }

  /* ------------------------------------------------------------------ items (A16) */
  function badge(p, top, bot, rim, rimD) {
    var x0 = 5, y0 = 4, w = 22, h = 22;
    p.ellOver(16, 28.6, 8.4, 1.9, U.SHADOW);
    part(p, function (l) { l.rrect(x0, y0, w, h, 5, rim); }, OL);
    p.rrect(x0, y0, w, h, 5, rim);
    p.rrect(x0 + 1, y0 + 1, w - 2, h - 2, 4.4, rimD);
    for (var y = 0; y < h - 4; y++) {
      var t = y / (h - 5);
      for (var x = 0; x < w - 4; x++) {
        var px = x0 + 2 + x, py = y0 + 2 + y;
        var dx = x - (w - 5) / 2, dy = y - (h - 5) / 2;
        if (Math.abs(dx) > (w - 5) / 2 - (Math.abs(dy) > (h - 5) / 2 - 3 ? 1.6 : 0) + 0.01) continue;
        p.set(px, py, mix(top, bot, t));
      }
    }
    p.hline(x0 + 4, y0 + 2, 10, mix(rim, hex('#ffffff'), 0.55));
    p.set(x0 + 3, y0 + 3, mix(rim, hex('#ffffff'), 0.4));
  }
  function itemFire(f) {
    var p = new Pix(32, 32);
    badge(p, hex('#f0603a'), hex('#a8200e'), hex('#ffd23a'), hex('#c98a10'));
    var cx = 16, cy = 15;
    part(p, function (l) { l.poly([[cx, cy - 8], [cx + 3, cy - 3], [cx + 6, cy + 1], [cx + 4.5, cy + 6], [cx, cy + 8], [cx - 4.5, cy + 6], [cx - 6, cy + 1], [cx - 3, cy - 3]], hex('#ffb02a')); }, hex('#7a1f10'));
    p.poly([[cx, cy - 6], [cx + 3, cy - 1], [cx + 4, cy + 3], [cx + 2, cy + 6], [cx - 2, cy + 6], [cx - 4, cy + 3], [cx - 3, cy - 1]], hex('#ffd83a'));
    p.poly([[cx, cy - 1], [cx + 2, cy + 2], [cx + 1, cy + 6], [cx - 1, cy + 6], [cx - 2, cy + 2]], hex('#fffbe0'));
    p.set(cx - 2, cy - 4, hex('#ff8a1a'));
    if (f) { p.set(23, 7, hex('#ffffff')); p.set(22, 7, hex('#ffe9a8')); p.set(24, 7, hex('#ffe9a8')); p.set(23, 6, hex('#ffe9a8')); p.set(23, 8, hex('#ffe9a8')); }
    else { p.set(8, 21, hex('#ffffff')); p.set(7, 21, hex('#ffe9a8')); p.set(9, 21, hex('#ffe9a8')); p.set(8, 20, hex('#ffe9a8')); p.set(8, 22, hex('#ffe9a8')); }
    return p;
  }
  function itemBomb(f) {
    var p = new Pix(32, 32);
    badge(p, hex('#4a62c8'), hex('#1c2668'), hex('#ffd23a'), hex('#c98a10'));
    var R = ramp(['#7a1418', '#b02222', '#e23a2e', '#ff7a66']);
    function st(x0) {
      part(p, function (l) { l.rrect(x0, 11, 5, 11, 1.4, R[2]); }, OL);
      p.vline(x0, 12, 9, R[3]); p.vline(x0 + 1, 12, 9, R[2]); p.vline(x0 + 2, 12, 9, R[2]); p.vline(x0 + 3, 12, 9, R[1]); p.vline(x0 + 4, 12, 9, R[0]);
      p.hline(x0, 12, 5, hex('#ffb6a6'));
    }
    st(9); st(18); st(13.5);
    p.rect(9, 16, 14, 2, hex('#23202b')); p.hline(9, 16, 14, hex('#4a4656'));
    p.line(16, 10, 17, 8, hex('#c9a06a')); p.line(17, 8, 19, 7, hex('#c9a06a'));
    p.set(19, 6, hex('#ffffff')); p.set(20, 6, hex('#ffd23f')); p.set(18, 6, hex('#ffd23f')); p.set(19, 5, hex('#ffb040')); p.set(19, 7, hex('#ff8a1a'));
    if (f) { p.set(23, 7, hex('#ffffff')); p.set(22, 7, hex('#dfe6ff')); p.set(24, 7, hex('#dfe6ff')); p.set(23, 6, hex('#dfe6ff')); p.set(23, 8, hex('#dfe6ff')); }
    else { p.set(8, 21, hex('#ffffff')); p.set(7, 21, hex('#dfe6ff')); p.set(9, 21, hex('#dfe6ff')); p.set(8, 20, hex('#dfe6ff')); p.set(8, 22, hex('#dfe6ff')); }
    return p;
  }
  function itemBoots(f) {
    var p = new Pix(32, 32);
    badge(p, hex('#3cc46a'), hex('#146a34'), hex('#ffd23a'), hex('#c98a10'));
    var art = U.art([
      '..WWWWW.....',
      '..WBBBW.....',
      '..WBBBW.....',
      '..WBBBW.....',
      '..WBBBW.....',
      '..WBBBWW....',
      '..WBBBBBW...',
      '.WBBBBBBBW..',
      '.WBBBBBBBBW.',
      '.WBBBBBBBBBW',
      '.WWWWWWWWWWW',
      '.KKKKKKKKKKK'
    ], { W: '#fff6e0', B: '#e0a05a', K: '#4a2a14' });
    /* laces & shading */
    art.set(3, 2, hex('#8a5a2a')); art.set(3, 4, hex('#8a5a2a')); art.set(5, 2, hex('#8a5a2a')); art.set(5, 4, hex('#8a5a2a'));
    art.hline(3, 8, 8, hex('#c47a3a')); art.set(9, 9, hex('#ffd9a0')); art.set(3, 5, hex('#ffd9a0'));
    p.blit(art, 10, 8);
    p.outline(OL);
    if (f) { p.set(23, 7, hex('#ffffff')); p.set(22, 7, hex('#dfffe8')); p.set(24, 7, hex('#dfffe8')); p.set(23, 6, hex('#dfffe8')); p.set(23, 8, hex('#dfffe8')); }
    else { p.set(8, 21, hex('#ffffff')); p.set(7, 21, hex('#dfffe8')); p.set(9, 21, hex('#dfffe8')); p.set(8, 20, hex('#dfffe8')); p.set(8, 22, hex('#dfffe8')); }
    return p;
  }
  function itemLife(f) {
    var p = new Pix(32, 32);
    badge(p, hex('#f0609c'), hex('#a01a5c'), hex('#ffd23a'), hex('#c98a10'));
    p.blit(moleIcon(), 8, 6);
    if (f) { p.set(23, 7, hex('#ffffff')); p.set(22, 7, hex('#ffe0f0')); p.set(24, 7, hex('#ffe0f0')); p.set(23, 6, hex('#ffe0f0')); p.set(23, 8, hex('#ffe0f0')); }
    else { p.set(8, 21, hex('#ffffff')); p.set(7, 21, hex('#ffe0f0')); p.set(9, 21, hex('#ffe0f0')); p.set(8, 20, hex('#ffe0f0')); p.set(8, 22, hex('#ffe0f0')); }
    /* tiny "+1" */
    p.set(22, 22, hex('#ffffff')); p.set(21, 22, hex('#ffffff')); p.set(23, 22, hex('#ffffff')); p.set(22, 21, hex('#ffffff')); p.set(22, 23, hex('#ffffff'));
    return p;
  }

  /* 16x16 mole face (HUD life icon, A17) */
  function moleIcon() {
    var p = new Pix(16, 16);
    var FUR = ramp(['#4e4768', '#6e6890', '#9088ae', '#b9b3d0']), HELM = ramp(['#b4650a', '#e0900f', '#f7c62a', '#ffec8c']);
    part(p, function (l) { l.ellShade(8, 9.6, 6.6, 5.4, FUR, { dither: true }); }, OL);
    p.ellShade(8, 12.1, 3.1, 2.1, ramp(['#b23a63', '#df6790', '#ff9dbb']), {});
    p.set(7, 11, hex('#ffb6cd'));
    p.set(4, 8, hex('#160f1f')); p.set(4, 9, hex('#160f1f')); p.set(11, 8, hex('#160f1f')); p.set(11, 9, hex('#160f1f'));
    part(p, function (l) {
      l.ellShade(8, 6, 7.2, 5, HELM, { clipBottom: 6.6, dither: true });
      l.rrect(1, 5.6, 14, 2, 1, hex('#a8580a'));
    }, OL);
    p.hline(2, 6, 12, hex('#f4b21c'));
    p.rect(6, 2, 4, 3, hex('#8b91a8')); p.rect(7, 3, 2, 1, hex('#fffbd0'));
    p.outline(OL);
    return p;
  }

  /* ------------------------------------------------------------------ light images */
  function radialCanvas(size, rgb, peak, stops) {
    var cv = Pix.canvas(size, size), x = cv.getContext('2d');
    var g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(function (s) { g.addColorStop(s[0], 'rgba(' + rgb + ',' + (s[1] * peak) + ')'); });
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
    return cv;
  }
  function hexRgb(h) { var u = Pix.unpack(hex(h)); return u[0] + ',' + u[1] + ',' + u[2]; }

  function makeVignette() {
    var p = new Pix(480, 352);
    for (var y = 0; y < 352; y++) for (var x = 0; x < 480; x++) {
      var dx = (x + 0.5 - 240) / 250, dy = (y + 0.5 - 176) / 190, d = Math.sqrt(dx * dx + dy * dy);
      var a = Math.max(0, (d - 0.62) / 0.55);
      a = Math.min(1, a * a) * 0.5;
      var q = Math.round(a * 10) / 10;            // banded like a retro dither ramp
      if (q > 0) p.set(x, y, Pix.pack(6, 3, 14, Math.round(q * 255)));
    }
    return p.toCanvas();
  }

  function makeShadowStrips() {
    var r = new Pix(6, 32), b = new Pix(32, 6), alphas = [0.34, 0.22, 0.13, 0.07, 0.03];
    for (var i = 0; i < 5; i++) {
      var c = Pix.pack(6, 3, 14, Math.round(alphas[i] * 255));
      for (var j = 0; j < 32; j++) { r.set(i, j, c); b.set(j, i, c); }
    }
    return { r: r.toCanvas(), b: b.toCanvas() };
  }

  /* ------------------------------------------------------------------ build */
  function build(S) {
    S.themes = [];
    THEMES.forEach(function (th, ti) {
      var seed = 100 + ti * 17;
      var floors = [makeFloor(th, 0, seed + 1, false).toCanvas(), makeFloor(th, 1, seed + 2, false).toCanvas()];
      for (var d = 0; d < 4; d++) floors.push(makeFloor(th, d, seed + 10 + d, true).toCanvas());
      var rocks = [rockData(th, seed + 31), rockData(th, seed + 57)];
      S.themes.push({
        name: th.lamp,
        floor: floors,
        wall: {
          plain: makeWall(th, null, seed + 3).toCanvas(), bottom: makeWall(th, 'bottom', seed + 4).toCanvas(),
          top: makeWall(th, 'top', seed + 5).toCanvas(), left: makeWall(th, 'left', seed + 6).toCanvas(), right: makeWall(th, 'right', seed + 7).toCanvas()
        },
        pillar: makePillar(th).toCanvas(),
        rock: rocks.map(function (r) { return r.pix.toCanvas(); }),
        crumble: rocks.map(function (r) { return crumbleFrames(th, r); }),
        lampFrames: [0, 1, 2].map(function (f) { return lampFrame(th, f); }),
        lampPos: [[3 * 32 + 16, 12], [7 * 32 + 16, 12], [11 * 32 + 16, 12]],
        glow: radialCanvas(128, hexRgb(th.glow), 1, [[0, 0.95], [0.3, 0.5], [0.6, 0.16], [1, 0]]),
        lampGlowAlpha: th.lampGlowAlpha, lanternAlpha: th.lanternAlpha,
        bgColor: th.bg, debris: th.debris, dust: th.dust,
        floorColors: th.floor, accent: th.accent
      });
    });
    S.exit = { closed: makeExit(false, 0), open: [makeExit(true, 0), makeExit(true, 1)] };
    S.bomb = [0, 1, 2].map(function (f) { return makeBomb(f, false).toCanvas(); });
    S.bombFlash = [0, 1, 2].map(function (f) { return makeBomb(f, true).toCanvas(); });
    S.flame = makeFlames();
    S.item = {
      fire: [itemFire(0).toCanvas(), itemFire(1).toCanvas()],
      bomb: [itemBomb(0).toCanvas(), itemBomb(1).toCanvas()],
      boots: [itemBoots(0).toCanvas(), itemBoots(1).toCanvas()],
      life: [itemLife(0).toCanvas(), itemLife(1).toCanvas()]
    };
    S.lifeIcon = moleIcon().toCanvas();
    S.iconPix = { mole: moleIcon() };
    var sh = makeShadowStrips();
    S.shadowR = sh.r; S.shadowB = sh.b;
    S.glowFlame = radialCanvas(96, '255,150,40', 1, [[0, 0.95], [0.4, 0.45], [0.75, 0.12], [1, 0]]);
    S.lantern = radialCanvas(128, '255,214,140', 1, [[0, 0.9], [0.35, 0.45], [0.7, 0.14], [1, 0]]);
    S.vignette = makeVignette();
  }

  DM.ArtTiles = { build: build, THEMES: THEMES, makeFloor: makeFloor, makeBomb: makeBomb, moleIcon: moleIcon };
})(typeof window !== 'undefined' ? window : globalThis);
