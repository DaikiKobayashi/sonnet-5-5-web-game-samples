// All pixel art is generated here in code. Every asset is authored on a
// half-resolution grid (16x16 per 32x32 cell) and scaled up 2x, so one art
// dot is always exactly 2x2 screen pixels.
(function () {
  'use strict';
  var DM = window.DM;

  // ---------- tiny pixel grid helper ----------
  function Grid(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); }
  Grid.prototype.set = function (x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c;
  };
  Grid.prototype.get = function (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.d[y * this.w + x];
  };
  Grid.prototype.rect = function (x, y, w, h, c) {
    for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) this.set(i, j, c);
    return this;
  };
  Grid.prototype.ellipse = function (cx, cy, rx, ry, c, pred) {
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) {
      var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1 && (!pred || pred(x, y))) this.set(x, y, c);
    }
    return this;
  };
  Grid.prototype.rows = function (rows, pal, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    for (var y = 0; y < rows.length; y++) for (var x = 0; x < rows[y].length; x++) {
      var ch = rows[y][x];
      if (ch !== '.' && ch !== ' ' && pal[ch]) this.set(ox + x, oy + y, pal[ch]);
    }
    return this;
  };
  Grid.prototype.clone = function () { var g = new Grid(this.w, this.h); g.d = this.d.slice(); return g; };
  Grid.prototype.map = function (fn) {
    var g = this.clone();
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) {
      var v = this.d[y * this.w + x];
      if (v !== null) g.d[y * this.w + x] = fn(v, x, y);
    }
    return g;
  };
  Grid.prototype.flipX = function () {
    var g = new Grid(this.w, this.h);
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) g.d[y * this.w + x] = this.d[y * this.w + (this.w - 1 - x)];
    return g;
  };
  Grid.prototype.flipY = function () {
    var g = new Grid(this.w, this.h);
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) g.d[y * this.w + x] = this.d[(this.h - 1 - y) * this.w + x];
    return g;
  };
  Grid.prototype.transpose = function () {
    var g = new Grid(this.h, this.w);
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) g.d[x * this.h + y] = this.d[y * this.w + x];
    return g;
  };
  Grid.prototype.shift = function (dx, dy) {
    var g = new Grid(this.w, this.h);
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) {
      var v = this.d[y * this.w + x];
      if (v !== null) g.set(x + dx, y + dy, v);
    }
    return g;
  };
  Grid.prototype.over = function (o, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    for (var y = 0; y < o.h; y++) for (var x = 0; x < o.w; x++) {
      var v = o.d[y * o.w + x];
      if (v !== null) this.set(x + ox, y + oy, v);
    }
    return this;
  };
  Grid.prototype.outline = function (col) {
    var g = this.clone();
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) {
      if (this.get(x, y) !== null) continue;
      if (this.get(x - 1, y) !== null || this.get(x + 1, y) !== null || this.get(x, y - 1) !== null || this.get(x, y + 1) !== null) g.set(x, y, col);
    }
    return g;
  };
  Grid.prototype.canvas = function () {
    var cv = document.createElement('canvas');
    cv.width = this.w * 2; cv.height = this.h * 2;
    var ctx = cv.getContext('2d');
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) {
      var v = this.d[y * this.w + x];
      if (v === null) continue;
      ctx.fillStyle = v;
      ctx.fillRect(x * 2, y * 2, 2, 2);
    }
    return cv;
  };
  DM.Grid = Grid;

  // deterministic hash noise for art
  function hash(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return ((h >>> 0) % 10000) / 10000;
  }
  DM.hash = hash;

  var OUT = '#1a0f1c';

  // ---------- player (mole) ----------
  var PPAL = {
    Y: '#f8c83a', y: '#c8861e', W: '#fffbe0', L: '#ffe27a', B: '#8a5634', b: '#5e3520',
    c: '#c48a62', p: '#f58fae', P: '#9c3a5a', E: '#150c12', h: '#f4d6b8', e: '#ffffff', X: '#150c12'
  };
  var P_DOWN = [
    '................',
    '.....yYYYYy.....',
    '....yYYWWYYy....',
    '...yYYYLLYYYy...',
    '..yyyyyyyyyyyy..',
    '...BBBBBBBBBB...',
    '..BBBEBBBBEBBB..',
    '..BBcccppcccBB..',
    '..BBBccccccBBB..',
    '.hhBBBBBBBBBBhh.',
    '.hhhBBBBBBBBhhh.',
    '..h.bBBBBBBb.h..',
    '....bBBBBBBb....'
  ];
  var P_UP = [
    '................',
    '.....yYYYYy.....',
    '....yYYYYYYy....',
    '...yYYYYYYYYy...',
    '..yyyyyyyyyyyy..',
    '...BBBBBBBBBB...',
    '..BBBBBBBBBBBB..',
    '..BBBBcBBcBBBB..',
    '..BBBBBBBBBBBB..',
    '.hhBBBBBBBBBBhh.',
    '.hhhBBBBBBBBhhh.',
    '..h.bBBBBBBb.h..',
    '....bBBpBBBb....'
  ];
  var P_LEFT = [
    '................',
    '......yYYYYy....',
    '.....yYYYYYYy...',
    '....WYYYYYYYYy..',
    '...yyyyyyyyyyyy.',
    '....BBBBBBBBBB..',
    '...BEBBBBBBBBBB.',
    '.pccBBBBBBBBBBB.',
    '..cccBBBBBBBBBB.',
    '...hhBBBBBBBBBB.',
    '..hhhBBBBBBBBBb.',
    '....bBBBBBBBBb..',
    '.....bBBBBBBbp..'
  ];
  var FEET_V = [
    ['.....bb..bb.....', '................'],
    ['.........bb.....', '.....bb.........'],
    ['.....bb..bb.....', '................'],
    ['.....bb.........', '.........bb.....']
  ];
  var FEET_H = [
    ['......bb..bb....', '................'],
    ['.....bb....bb...', '................'],
    ['......bb..bb....', '................'],
    ['.......bbbb.....', '................']
  ];
  var P_JOY = [
    '................',
    '.....yYYYYy.....',
    '....yYYWWYYy....',
    '.h.yYYYLLYYYy.h.',
    'hhyyyyyyyyyyyyhh',
    '.hhBBBBBBBBBBhh.',
    '..BBBEBBBBEBBB..',
    '..BBcccppcccBB..',
    '..BBBccPPccBBB..',
    '..BBBBBBBBBBBB..',
    '...BBBBBBBBBB...',
    '...bBBBBBBBBb...',
    '....bBBBBBBb....',
    '.....bb..bb.....'
  ];

  function playerGrid(base, feet) {
    var g = new Grid(16, 16);
    g.rows(base, PPAL);
    g.rows(feet, PPAL, 0, 13);
    return g;
  }

  function buildPlayer() {
    var P = { walk: {}, idle2: {}, death: [], joy: [] };
    var sets = { down: [P_DOWN, FEET_V], up: [P_UP, FEET_V], left: [P_LEFT, FEET_H] };
    Object.keys(sets).forEach(function (d) {
      P.walk[d] = [];
      for (var f = 0; f < 4; f++) {
        var g = playerGrid(sets[d][0], sets[d][1][f]);
        P.walk[d].push(g);
      }
    });
    P.walk.right = P.walk.left.map(function (g) { return g.flipX(); });
    // idle breathing frame: helmet sinks by one dot
    ['down', 'up', 'left', 'right'].forEach(function (d) {
      var base = P.walk[d][0];
      var g = new Grid(16, 16);
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
        var v;
        if (y >= 1 && y <= 5) v = base.get(x, y - 1);
        else if (y === 0) v = null;
        else v = base.get(x, y);
        if (y === 5 && v === null) v = base.get(x, 5);
        g.set(x, y, v);
      }
      P.idle2[d] = g;
    });
    // death: X eyes, then squash, then puff
    var dz = playerGrid(P_DOWN, FEET_V[0]);
    [[5, 6], [10, 6]].forEach(function (e) {
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var on = Math.abs(dx) === Math.abs(dy);
        dz.set(e[0] + dx, e[1] + dy, on ? PPAL.X : PPAL.B);
      }
    });
    function squash(src, h) {
      var g = new Grid(16, 16);
      for (var y = 15 - h; y < 15; y++) {
        var sy = 1 + Math.floor((y - (15 - h)) * 14 / h);
        for (var x = 0; x < 16; x++) {
          // widen slightly as it flattens
          var widen = (14 - h) / 14 * 0.35;
          var sx = Math.round(7.5 + (x - 7.5) * (1 - widen));
          g.set(x, y, src.get(sx, sy));
        }
      }
      return g;
    }
    P.death.push(dz, squash(dz, 12), squash(dz, 9), squash(dz, 6), squash(dz, 4));
    var puff = new Grid(16, 16);
    puff.ellipse(8, 11, 6, 3.5, '#9a8f98');
    puff.ellipse(5.5, 9.5, 3, 2.5, '#c8bfc6');
    puff.ellipse(10.5, 9, 3, 2.5, '#c8bfc6');
    puff.ellipse(8, 8, 2.5, 2, '#ece6ea');
    puff.set(7, 13, PPAL.Y); puff.set(8, 13, PPAL.Y); puff.set(9, 13, PPAL.y);
    P.death.push(puff);
    var joy = new Grid(16, 16).rows(P_JOY, PPAL);
    P.joy.push(joy, joy.shift(0, -1));

    function fin(g) { return g.outline(OUT).canvas(); }
    var out = { walk: {}, idle2: {}, death: P.death.map(fin), joy: P.joy.map(fin) };
    Object.keys(P.walk).forEach(function (d) {
      out.walk[d] = P.walk[d].map(fin);
      out.idle2[d] = fin(P.idle2[d]);
    });
    return out;
  }

  // ---------- enemies ----------
  function buildSlime() {
    var frames = [];
    var shapes = [[6, 5, 9.5], [6.8, 4.3, 10.2], [6, 5, 9.5], [5.2, 5.8, 8.7]];
    shapes.forEach(function (s) {
      var g = new Grid(16, 16);
      var rx = s[0], ry = s[1], cy = s[2], cx = 8;
      g.ellipse(cx, cy, rx, ry, '#5fd35a');
      g.ellipse(cx, cy, rx, ry, '#2f9142', function (x, y) { return y + 0.5 > cy + ry * 0.45; });
      g.ellipse(cx + 0.6, cy + 0.4, rx - 1.2, ry - 1.3, '#5fd35a', function (x, y) { return y + 0.5 > cy + ry * 0.45; });
      g.ellipse(cx - rx * 0.45, cy - ry * 0.45, 1.6, 1.2, '#d6ffbf');
      var ey = Math.round(cy - 1);
      [cx - 3, cx + 2].forEach(function (ex) {
        g.set(ex, ey, '#ffffff'); g.set(ex, ey + 1, '#10161a'); g.set(ex + 1, ey, '#10161a'); g.set(ex + 1, ey + 1, '#10161a');
      });
      g.set(cx - 1, ey + 3, '#1f5f2c'); g.set(cx, ey + 3, '#1f5f2c');
      frames.push(g.outline(OUT).canvas());
    });
    return frames;
  }

  function buildBat() {
    var frames = [];
    var phases = [-1, 0, 1, 0];
    phases.forEach(function (ph, fi) {
      var g = new Grid(16, 16);
      for (var i = 0; i < 4; i++) {
        var yc = 7 + ph * (i + 1) * 0.9 - (fi === 1 ? 0.5 : 0);
        var t = 4 - Math.floor(i * 0.9);
        var y0 = Math.round(yc - t / 2);
        for (var k = 0; k < t; k++) {
          var col = k === 0 ? '#9d74d8' : (k === t - 1 && t > 2 ? '#4a2a7a' : '#6b3fa6');
          g.set(4 - i, y0 + k, col);
          g.set(11 + i, y0 + k, col);
        }
      }
      g.ellipse(8, 8, 3.3, 3.8, '#7c4cc0');
      g.ellipse(8.6, 9, 2.4, 2.6, '#5a3490', function (x, y) { return y >= 9; });
      g.set(5, 4, '#7c4cc0'); g.set(5, 3, '#7c4cc0'); g.set(10, 4, '#7c4cc0'); g.set(10, 3, '#7c4cc0');
      g.set(6, 7, '#ffe14a'); g.set(9, 7, '#ffe14a');
      g.set(6, 8, '#ff3a4a'); g.set(9, 8, '#ff3a4a');
      g.set(7, 10, '#ffffff'); g.set(8, 10, '#ffffff');
      g.set(6, 5, '#a883e6');
      var dy = ph < 0 ? -1 : 0;
      frames.push(g.shift(0, dy).outline(OUT).canvas());
    });
    return frames;
  }

  function buildGhost(chase) {
    var frames = [];
    for (var f = 0; f < 3; f++) {
      var g = new Grid(16, 16);
      var body = chase ? '#f4e6ff' : '#eeeaff';
      var shade = chase ? '#c8a4e0' : '#b3aee0';
      g.ellipse(8, 7.5, 6, 6, body, function (x, y) { return y <= 7; });
      g.rect(2, 7, 12, 6, body);
      for (var x = 2; x < 14; x++) {
        var w = (x + f * 1.4) % 4;
        if (w < 2.2) g.set(x, 13, body);
        if (w < 1) g.set(x, 14, body);
      }
      g.rect(11, 8, 3, 5, shade);
      g.ellipse(8, 7.5, 6, 6, shade, function (x, y) { return x >= 12 && y <= 7; });
      g.set(4, 3, '#ffffff'); g.set(5, 3, '#ffffff'); g.set(4, 4, '#ffffff');
      if (!chase) {
        g.rect(5, 6, 2, 2, '#2b2a6a'); g.rect(9, 6, 2, 2, '#2b2a6a');
        g.set(5, 6, '#8a88ff'); g.set(9, 6, '#8a88ff');
        g.set(7, 10, '#6a64a8'); g.set(8, 10, '#6a64a8');
      } else {
        g.rect(5, 6, 2, 2, '#ff2a3a'); g.rect(9, 6, 2, 2, '#ff2a3a');
        g.set(5, 6, '#ffd0d0'); g.set(10, 6, '#ffd0d0');
        g.set(4, 5, '#3a1030'); g.set(5, 5, '#3a1030'); g.set(10, 5, '#3a1030'); g.set(11, 5, '#3a1030');
        g.rect(6, 9, 4, 2, '#3a1030'); g.set(7, 9, '#ffffff'); g.set(8, 10, '#ffffff');
      }
      frames.push(g.outline(OUT).canvas());
    }
    return frames;
  }

  function buildGolem() {
    var frames = [], flash = [];
    var arms = [[0, 0], [-1, 1], [0, 0], [1, -1]];
    var legs = [[0, 0], [1, 0], [0, 0], [0, 1]];
    for (var f = 0; f < 4; f++) {
      var g = new Grid(16, 16);
      var base = '#8f877c', dark = '#5f584f', light = '#b9b1a4';
      // legs
      g.rect(4, 12 + legs[f][0], 3, 2, dark); g.rect(9, 12 + legs[f][1], 3, 2, dark);
      // arms
      g.rect(1, 6 + arms[f][0], 2, 4, dark); g.rect(13, 6 + arms[f][1], 2, 4, dark);
      g.set(1, 9 + arms[f][0], light); g.set(14, 9 + arms[f][1], light);
      // body
      g.rect(3, 3, 10, 10, base);
      g.set(3, 3, null); g.set(12, 3, null);
      g.rect(3, 10, 10, 3, dark);
      g.rect(4, 3, 8, 1, light); g.rect(3, 4, 1, 5, light);
      // head bump
      g.rect(5, 1, 6, 3, base); g.rect(6, 1, 4, 1, light);
      // moss
      g.set(6, 1, '#6d9a4a'); g.set(7, 1, '#8cc05a'); g.set(4, 4, '#6d9a4a'); g.set(11, 4, '#6d9a4a'); g.set(11, 5, '#8cc05a');
      // eyes
      g.rect(5, 6, 2, 1, '#ffb13b'); g.rect(9, 6, 2, 1, '#ffb13b');
      g.set(5, 6, '#fff0b0'); g.set(9, 6, '#fff0b0');
      // cracks
      g.set(8, 8, '#3a342e'); g.set(7, 9, '#3a342e'); g.set(8, 10, '#3a342e');
      g.set(10, 11, '#3a342e'); g.set(5, 11, '#3a342e');
      var o = g.outline(OUT);
      frames.push(o.canvas());
      flash.push(o.map(function (v) { return v === OUT ? '#ffffff' : '#fff4e8'; }).canvas());
    }
    return { frames: frames, flash: flash };
  }

  function buildPuff(tint) {
    var frames = [];
    var g0 = new Grid(16, 16);
    g0.ellipse(8, 8, 2.5, 2.5, '#ffffff');
    [[8, 3], [8, 13], [3, 8], [13, 8], [4, 4], [12, 4], [4, 12], [12, 12]].forEach(function (p) { g0.set(p[0], p[1], tint); });
    [[8, 4], [8, 12], [4, 8], [12, 8]].forEach(function (p) { g0.set(p[0], p[1], '#ffffff'); });
    frames.push(g0.outline(OUT).canvas());
    var g1 = new Grid(16, 16);
    g1.ellipse(8, 8, 5.5, 5.5, '#d8d0e0');
    g1.ellipse(8, 8, 3.2, 3.2, '#ffffff');
    g1.ellipse(6, 6, 1.5, 1.5, tint);
    g1.ellipse(10.5, 10, 1.5, 1.5, tint);
    frames.push(g1.outline(OUT).canvas());
    var g2 = new Grid(16, 16);
    g2.ellipse(4.5, 5, 3, 3, '#b8b0c4'); g2.ellipse(11.5, 5.5, 3, 3, '#b8b0c4'); g2.ellipse(8, 11.5, 3.3, 3, '#b8b0c4');
    g2.ellipse(4, 4.5, 1.5, 1.5, '#e8e2f0'); g2.ellipse(11, 5, 1.5, 1.5, '#e8e2f0'); g2.ellipse(7.5, 11, 1.5, 1.5, '#e8e2f0');
    g2.set(8, 8, tint);
    frames.push(g2.outline('#3a3444').canvas());
    var g3 = new Grid(16, 16);
    [[2, 3], [13, 3], [8, 14], [1, 9], [14, 10], [5, 1], [11, 13]].forEach(function (p) { g3.set(p[0], p[1], '#9a92a8'); });
    [[3, 3], [12, 4], [8, 13]].forEach(function (p) { g3.set(p[0], p[1], tint); });
    frames.push(g3.canvas());
    return frames;
  }

  // ---------- bomb ----------
  function buildBomb() {
    var normal = [], flash = [];
    var sparks = [
      [[11, 2, '#ffffff'], [12, 2, '#ffd23a'], [11, 1, '#ffd23a']],
      [[11, 2, '#ffffff'], [12, 2, '#ffd23a'], [10, 2, '#ffd23a'], [11, 1, '#ffd23a'], [11, 3, '#ff8a2a']],
      [[11, 2, '#ffffff'], [12, 2, '#ffffff'], [10, 2, '#ffd23a'], [11, 1, '#ffffff'], [11, 3, '#ffd23a'], [13, 2, '#ff8a2a'], [12, 1, '#ff8a2a'], [10, 1, '#ff8a2a'], [12, 3, '#ff8a2a'], [11, 0, '#ffd23a']],
      [[11, 2, '#ffffff'], [12, 1, '#ffd23a'], [10, 3, '#ffd23a'], [12, 3, '#ff8a2a'], [10, 1, '#ff8a2a']]
    ];
    for (var f = 0; f < 4; f++) {
      var g = new Grid(16, 16);
      [[3, 6], [6, 5], [9, 6]].forEach(function (s, i) {
        g.rect(s[0], s[1], 3, 14 - s[1], '#e0352b');
        g.rect(s[0], s[1] + 1, 1, 12 - s[1], '#ff7a5a');
        g.rect(s[0] + 2, s[1] + 1, 1, 13 - s[1], '#a01e1e');
        g.rect(s[0], s[1], 3, 1, '#f2d7a8');
        if (i === 1) g.set(s[0] + 1, s[1], '#6a4a2a');
      });
      g.rect(3, 9, 9, 2, '#2a2230'); g.rect(3, 9, 9, 1, '#5a5566');
      g.set(7, 9, '#d8b03a');
      g.set(7, 4, '#d8c89a'); g.set(8, 3, '#d8c89a'); g.set(9, 3, '#d8c89a'); g.set(10, 2, '#d8c89a');
      var sp = sparks[f];
      var body = g.outline(OUT);
      sp.forEach(function (p) { body.set(p[0], p[1], p[2]); });
      normal.push(body.canvas());
      flash.push(body.map(function (v) { return (v === '#e0352b' || v === '#a01e1e' || v === '#ff7a5a') ? '#ffe8e0' : v; }).canvas());
    }
    return { normal: normal, flash: flash };
  }

  // ---------- flames ----------
  var FL = ['#c4281c', '#f0502a', '#ff9a2a', '#ffe04a', '#fffbe8'];
  function flameColor(d, hw) {
    if (d >= hw) return null;
    if (d < hw - 4.5) return FL[4];
    if (d < hw - 3.3) return FL[3];
    if (d < hw - 2.1) return FL[2];
    if (d < hw - 0.9) return FL[1];
    return FL[0];
  }
  function buildFlames() {
    var HW = [5.6, 6.4, 5.9, 6.7, 3.4];
    var out = { center: [], armH: [], armV: [], tip: { right: [], left: [], down: [], up: [] } };
    HW.forEach(function (hw, f) {
      var arm = new Grid(16, 16), center = new Grid(16, 16), tip = new Grid(16, 16);
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
        var wob = ((x + f * 3) % 5 < 2) ? 0.5 : -0.2;
        var wobY = ((y + f * 3) % 5 < 2) ? 0.5 : -0.2;
        var dy = Math.abs(y + 0.5 - 8), dx = Math.abs(x + 0.5 - 8);
        var c1 = flameColor(dy, hw + wob);
        if (c1) arm.set(x, y, c1);
        // center: union of both bands + circle
        var d = Math.min(dy - wob, dx - wobY, Math.sqrt(dx * dx + dy * dy) - 1.6);
        var c2 = flameColor(d, hw);
        if (c2) center.set(x, y, c2);
        // tip pointing right: taper after x=7
        var taper = x + 0.5 <= 7 ? 1 : Math.max(0, 1 - Math.pow((x + 0.5 - 7) / 7.2, 2));
        var h2 = (hw + wob) * Math.sqrt(taper);
        var c3 = flameColor(dy, h2);
        if (c3) tip.set(x, y, c3);
      }
      out.center.push(center.canvas());
      out.armH.push(arm.canvas());
      out.armV.push(arm.transpose().canvas());
      out.tip.right.push(tip.canvas());
      out.tip.left.push(tip.flipX().canvas());
      out.tip.down.push(tip.transpose().canvas());
      out.tip.up.push(tip.transpose().flipY().canvas());
    });
    return out;
  }

  // ---------- items ----------
  function buildItems() {
    var defs = {
      fire: ['#6a1a24', '#ff6a3a', '#ffb070'],
      bomb: ['#22244e', '#6a8aff', '#b0c4ff'],
      boots: ['#1e3e22', '#6ad06a', '#b8f0a8'],
      life: ['#4e1e40', '#ff7ac0', '#ffc0e0']
    };
    var out = {};
    Object.keys(defs).forEach(function (k) {
      var d = defs[k];
      out[k] = [];
      for (var f = 0; f < 2; f++) {
        var g = new Grid(16, 16);
        g.rect(1, 2, 14, 12, d[1]); g.rect(2, 1, 12, 14, d[1]);
        g.rect(2, 3, 12, 10, d[0]); g.rect(3, 2, 10, 12, d[0]);
        g.rect(3, 2, 9, 1, d[2]); g.rect(2, 3, 1, 8, d[2]);
        if (k === 'fire') {
          g.ellipse(8, 9.5, 3.8, 3.5, '#f0502a');
          g.rows(['...#....', '...##...', '..###.#.', '.#####..'], { '#': '#f0502a' }, 4, 3);
          g.ellipse(8, 10, 2.5, 2.4, '#ff9a2a');
          g.ellipse(8, 10.5, 1.4, 1.5, '#ffe04a');
          g.set(8, 11, '#fffbe8');
        } else if (k === 'bomb') {
          g.rect(5, 6, 2, 7, '#e0352b'); g.rect(7, 5, 2, 8, '#e0352b'); g.rect(9, 6, 2, 7, '#e0352b');
          g.rect(6, 6, 1, 7, '#a01e1e'); g.rect(8, 5, 1, 8, '#a01e1e'); g.rect(10, 6, 1, 7, '#a01e1e');
          g.rect(5, 9, 6, 1, '#1a1420');
          g.set(8, 4, '#d8c89a'); g.set(9, 3, '#d8c89a');
          g.set(10, 3, '#ffe04a'); g.set(10, 2, '#fffbe8');
        } else if (k === 'boots') {
          g.rows([
            '..bbbb....',
            '..bBBb....',
            '..bBBb.ww.',
            '..bBBbwww.',
            '..bBBBBbw.',
            '.bBBBBBBb.',
            '.bBBBBBBBb',
            '.kkkkkkkkk'
          ], { b: '#5e3520', B: '#a8683a', w: '#ffffff', k: '#2a1a14' }, 3, 4);
        } else {
          g.rows([
            '..yYYy..',
            '.yYWWYy.',
            'yyyyyyyy',
            'BBEBBEBB',
            'BBcppcBB',
            '.BBccBB.',
            '..BBBB..'
          ], PPAL, 4, 4);
          g.set(12, 11, '#ff3a6a'); g.set(13, 11, '#ff3a6a'); g.set(12, 12, '#ff3a6a');
        }
        if (f === 1) {
          g.set(11, 3, '#ffffff'); g.set(12, 4, '#ffffff'); g.set(10, 4, '#ffffff'); g.set(11, 5, '#ffffff');
          g.set(11, 4, '#ffffff');
        }
        out[k].push(g.outline(OUT).canvas());
      }
    });
    return out;
  }

  // ---------- small HUD icons (16x16 px = 8x8 dots) ----------
  function buildHudIcons() {
    function ic(rows, pal) { return new Grid(8, 8).rows(rows, pal).canvas(); }
    return {
      face: ic([
        '..yYYy..',
        '.yYWWYy.',
        'yyyyyyyy',
        'BBEBBEBB',
        'BBcppcBB',
        '.BBccBB.',
        '..BBBB..',
        '........'
      ], PPAL),
      bomb: ic([
        '.....s..',
        '....f...',
        '.rr.f...',
        '.rRrRr..',
        '.kkkkk..',
        '.rRrRr..',
        '.rRrRr..',
        '........'
      ], { s: '#ffe04a', f: '#d8c89a', r: '#e0352b', R: '#a01e1e', k: '#1a1420' }),
      fire: ic([
        '...r....',
        '..rr..r.',
        '..rorrr.',
        '.rooorr.',
        '.royyor.',
        '.roywor.',
        '..rooor.',
        '........'
      ], { r: '#f0502a', o: '#ff9a2a', y: '#ffe04a', w: '#fffbe8' }),
      boots: ic([
        '.bbb....',
        '.bBb.w..',
        '.bBbww..',
        '.bBBBbw.',
        'bBBBBBb.',
        'bBBBBBBb',
        'kkkkkkkk',
        '........'
      ], { b: '#5e3520', B: '#a8683a', w: '#ffffff', k: '#2a1a14' })
    };
  }

  // ---------- exit ----------
  function buildExit() {
    var closed = new Grid(16, 16);
    closed.rect(2, 2, 12, 12, '#8a5a2e');
    for (var y = 2; y < 14; y++) { closed.set(5, y, '#5a3618'); closed.set(9, y, '#5a3618'); closed.set(13, y, '#5a3618'); }
    closed.rect(2, 2, 12, 1, '#b07a42');
    closed.rect(2, 4, 12, 1, '#6a6a7a'); closed.rect(2, 11, 12, 1, '#6a6a7a');
    closed.set(3, 4, '#b0b0c0'); closed.set(11, 4, '#b0b0c0'); closed.set(3, 11, '#b0b0c0'); closed.set(11, 11, '#b0b0c0');
    closed.rect(7, 7, 2, 2, '#e8b830'); closed.set(7, 6, '#9a9aa8'); closed.set(8, 6, '#9a9aa8');
    closed.set(7, 8, '#5a3a10');
    var c = closed.outline(OUT).canvas();
    var open = [];
    for (var f = 0; f < 2; f++) {
      var g = new Grid(16, 16);
      var rim = f === 0 ? '#ffd24a' : '#fff4b0';
      g.rect(1, 1, 14, 14, rim);
      g.rect(2, 2, 12, 12, '#6a5a3a');
      g.rect(3, 3, 10, 10, '#140a10');
      g.rect(3, 3, 10, 2, '#241820');
      for (var yy = 3; yy < 14; yy++) { g.set(5, yy, '#c08a4a'); g.set(10, yy, '#c08a4a'); }
      [5, 8, 11].forEach(function (ry) { g.rect(5, ry, 6, 1, '#e0a860'); });
      g.set(5, 3, '#8a5a2e'); g.set(10, 3, '#8a5a2e');
      if (f === 1) { g.set(1, 1, '#ffffff'); g.set(14, 14, '#ffffff'); g.set(14, 1, '#ffffff'); g.set(1, 14, '#ffffff'); }
      open.push(g.outline(OUT).canvas());
    }
    return { closed: c, open: open };
  }

  // ---------- torch ----------
  function buildTorch() {
    var frames = [];
    for (var f = 0; f < 3; f++) {
      var g = new Grid(16, 16);
      g.rect(7, 9, 2, 5, '#6a4222'); g.rect(6, 9, 4, 1, '#3a3a44'); g.rect(6, 12, 4, 1, '#3a3a44');
      var h = [4.2, 5, 4.6][f];
      var sway = [0, 0.6, -0.5][f];
      g.ellipse(8 + sway * 0.5, 9 - h / 2, 2.4, h / 2 + 0.6, '#f0502a');
      g.ellipse(8 + sway * 0.3, 9 - h / 2 + 0.7, 1.6, h / 2 - 0.2, '#ff9a2a');
      g.ellipse(8, 8, 0.9, 1.4, '#ffe04a');
      g.set(8 + Math.round(sway * 2), Math.round(8 - h), '#ffe04a');
      frames.push(g.outline(OUT).canvas());
    }
    return frames;
  }

  // ---------- stage themes ----------
  var THEMES = [
    { // 1 SHALLOW TUNNELS
      floorA: '#8a6242', floorB: '#7c583a', fd: '#65462d', fl: '#a07652',
      wall: '#4e3524', wallD: '#2e1f16', wallL: '#6e4c33',
      pil: '#a0703f', pilD: '#65401f', pilL: '#cc9a5e',
      rock: '#a39280', rockD: '#6e6154', rockL: '#cfc2b0',
      acc: '#ffd27a', acc2: '#e89a4a', dark: 0.12, torch: true
    },
    { // 2 MUSHROOM GROTTO
      floorA: '#2e5752', floorB: '#28504b', fd: '#1d3d3a', fl: '#3d6e66',
      wall: '#3e2c58', wallD: '#221836', wallL: '#5d4585',
      pil: '#4a3a6e', pilD: '#2a1f44', pilL: '#6e5a9e',
      rock: '#7a68a0', rockD: '#4c3f6c', rockL: '#a898cc',
      acc: '#6affd6', acc2: '#ff78e0', dark: 0.3, torch: false
    },
    { // 3 CRYSTAL VEIN
      floorA: '#2c4a7c', floorB: '#274473', fd: '#1c335a', fl: '#3a5e96',
      wall: '#1a2a52', wallD: '#0e1734', wallL: '#2e4680',
      pil: '#3a5a92', pilD: '#223a68', pilL: '#5a86c4',
      rock: '#6788b4', rockD: '#40587e', rockL: '#9cc0e6',
      acc: '#9af0ff', acc2: '#e0fcff', dark: 0.26, torch: false
    },
    { // 4 LAVA DEPTHS
      floorA: '#4e2620', floorB: '#46211c', fd: '#321612', fl: '#62332a',
      wall: '#2c1512', wallD: '#170a09', wallL: '#44231d',
      pil: '#3c2a28', pilD: '#1e1413', pilL: '#5c4440',
      rock: '#6e4034', rockD: '#442620', rockL: '#94604c',
      acc: '#ff8a1a', acc2: '#ffd04a', dark: 0.32, torch: true
    },
    { // 5 THE DEEP DARK
      floorA: '#1a1e38', floorB: '#171a32', fd: '#101226', fl: '#242a4c',
      wall: '#0c0e1e', wallD: '#05060e', wallL: '#1c2040',
      pil: '#232a52', pilD: '#12162e', pilL: '#343e74',
      rock: '#353c6c', rockD: '#1f2446', rockL: '#4e5896',
      acc: '#7affc4', acc2: '#b08aff', dark: 0.42, torch: false
    }
  ];
  DM.THEMES = THEMES;

  function floorGrid(T, variant, ti, seed) {
    var g = new Grid(16, 16);
    var base = variant === 1 ? T.floorB : T.floorA;
    g.rect(0, 0, 16, 16, base);
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var h = hash(x, y, seed + variant * 17);
      if (h < 0.07) g.set(x, y, T.fd);
      else if (h > 0.95) g.set(x, y, T.fl);
    }
    // soft pebble
    var px = 3 + Math.floor(hash(1, 2, seed + variant) * 9), py = 3 + Math.floor(hash(3, 4, seed + variant) * 9);
    g.set(px, py, T.fl); g.set(px + 1, py, T.fl); g.set(px, py + 1, T.fd); g.set(px + 1, py + 1, T.fd);
    if (variant === 2) {
      if (ti === 0) { // roots & pebbles
        [[3, 4], [4, 5], [5, 5], [6, 6], [7, 6], [8, 7]].forEach(function (p) { g.set(p[0], p[1], '#5a3a22'); });
        g.rect(10, 10, 2, 2, '#b8a890'); g.set(10, 10, '#d8ccb8'); g.rect(4, 11, 1, 1, '#b8a890');
      } else if (ti === 1) { // glowing mushrooms
        [[5, 9, T.acc], [10, 6, T.acc2]].forEach(function (m) {
          g.rect(m[0], m[1], 1, 2, '#e8e0d0');
          g.rect(m[0] - 1, m[1] - 1, 3, 1, m[2]); g.set(m[0], m[1] - 2, m[2]); g.set(m[0] - 1, m[1] - 1, '#ffffff');
        });
      } else if (ti === 2) { // crystal shard
        g.rect(7, 6, 2, 5, T.acc); g.set(7, 5, T.acc2); g.set(7, 6, T.acc2); g.rect(8, 7, 1, 4, '#5ab8e0');
        g.rect(10, 9, 1, 2, T.acc); g.set(10, 8, T.acc2);
      } else if (ti === 3) { // lava crack
        [[2, 7], [3, 7], [4, 8], [5, 8], [6, 8], [7, 9], [8, 9], [9, 8], [10, 8], [11, 9], [12, 10]].forEach(function (p) { g.set(p[0], p[1], T.acc); });
        g.set(5, 8, T.acc2); g.set(9, 8, T.acc2);
      } else { // glowing moss dots
        [[4, 5], [5, 6], [10, 9], [11, 10], [7, 12]].forEach(function (p, i) { g.set(p[0], p[1], i % 2 ? T.acc2 : T.acc); });
      }
    }
    return g;
  }

  function wallGrid(T, ti) {
    var g = new Grid(16, 16);
    g.rect(0, 0, 16, 16, T.wall);
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var row = Math.floor(y / 4);
      if (y % 4 === 3) g.set(x, y, T.wallD);
      else if ((x + (row % 2) * 4) % 8 === 7) g.set(x, y, T.wallD);
      else if (y % 4 === 0) g.set(x, y, T.wallL);
      else if (hash(x, y, 91 + ti) < 0.08) g.set(x, y, T.wallD);
    }
    if (ti === 1) { g.set(2, 5, T.acc); g.set(12, 9, T.acc2); }
    if (ti === 2) { g.set(4, 1, T.acc); g.set(5, 2, T.acc); g.set(11, 9, T.acc); }
    if (ti === 3) { g.set(3, 7, T.acc); g.set(4, 7, T.acc2); g.set(12, 11, T.acc); g.set(13, 11, T.acc); }
    if (ti === 4) { g.set(6, 5, T.acc); g.set(13, 13, T.acc2); }
    return g;
  }

  function pillarGrid(T, ti) {
    var g = floorGrid(T, 0, ti, 400);
    // shadow
    g.rect(2, 13, 13, 2, 'rgba(0,0,0,0.35)');
    if (ti === 0) {
      // wooden support post: crate-like
      g.rect(1, 1, 14, 13, T.pil);
      for (var y = 1; y < 14; y++) { g.set(5, y, T.pilD); g.set(10, y, T.pilD); }
      g.rect(1, 1, 14, 1, T.pilL);
      g.rect(1, 11, 14, 3, T.pilD);
      g.rect(1, 11, 14, 1, '#4a2e16');
      [[3, 3], [7, 3], [12, 3], [3, 9], [7, 9], [12, 9]].forEach(function (p) { g.set(p[0], p[1], '#3a3a44'); });
    } else {
      g.rect(1, 1, 14, 10, T.pil);
      g.rect(1, 1, 14, 1, T.pilL); g.rect(1, 1, 1, 10, T.pilL);
      g.rect(1, 11, 14, 3, T.pilD);
      g.rect(3, 3, 10, 6, T.pilL); g.rect(4, 4, 8, 4, T.pil);
      if (ti === 1) {
        g.rect(7, 5, 2, 3, '#e8e0d0'); g.rect(5, 3, 6, 2, T.acc2); g.rect(6, 2, 4, 1, T.acc2); g.set(6, 3, '#ffffff'); g.set(9, 3, '#ffd0f0');
      } else if (ti === 2) {
        g.rect(6, 3, 2, 6, T.acc); g.rect(8, 2, 2, 7, T.acc2); g.rect(10, 5, 1, 4, T.acc); g.set(8, 2, '#ffffff'); g.rect(5, 6, 1, 3, '#5ab8e0');
      } else if (ti === 3) {
        [[3, 12], [4, 12], [5, 13], [8, 12], [9, 11], [12, 12]].forEach(function (p) { g.set(p[0], p[1], T.acc); });
        g.set(7, 6, T.acc); g.set(8, 6, T.acc2);
      } else {
        g.rect(7, 5, 2, 2, T.acc); g.set(6, 5, T.acc2); g.set(9, 6, T.acc2);
      }
    }
    // outline
    for (var x = 0; x < 16; x++) { g.set(x, 0, OUT); g.set(x, 14, OUT); }
    for (var yy = 0; yy < 15; yy++) { g.set(0, yy, OUT); g.set(15, yy, OUT); }
    return g;
  }

  function rockGrid(T, ti) {
    var g = new Grid(16, 16);
    g.ellipse(8, 9, 6.8, 5.8, T.rock);
    g.ellipse(6, 5.5, 4, 3.4, T.rock);
    g.ellipse(9.5, 11.2, 5, 3, T.rockD, function (x, y) { return y >= 10; });
    g.ellipse(12, 9, 2.4, 4, T.rockD, function (x) { return x >= 12; });
    g.ellipse(5.4, 4.8, 2, 1.4, T.rockL);
    g.set(3, 7, T.rockL); g.set(4, 7, T.rockL);
    [[8, 5], [9, 6], [9, 7], [10, 8], [7, 9], [6, 10]].forEach(function (p) { g.set(p[0], p[1], T.rockD); });
    if (ti === 1) { g.rect(11, 4, 1, 2, '#e8e0d0'); g.rect(10, 3, 3, 1, T.acc); }
    if (ti === 2) { g.rect(11, 5, 1, 3, T.acc); g.set(11, 4, T.acc2); g.set(12, 6, T.acc); }
    if (ti === 3) { g.set(10, 6, T.acc); g.set(11, 7, T.acc2); g.set(5, 10, T.acc); }
    if (ti === 4) { g.set(10, 6, T.acc); g.set(5, 10, T.acc2); }
    return g;
  }

  function crumble(g, stage, ti) {
    var out = new Grid(16, 16);
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var v = g.get(x, y);
      if (v === null) continue;
      var h = hash(x, y, 777 + stage * 13 + ti);
      var keep = [0.8, 0.5, 0.18][stage - 1];
      if (h > keep) continue;
      var dx = 0, dy = 0;
      if (stage >= 2) {
        var sx = x < 8 ? -1 : 1, sy = y < 9 ? -1 : 1;
        dx = sx * (stage - 1); dy = sy * (stage - 1) + (stage === 3 ? 1 : 0);
      }
      out.set(x + dx, y + dy, v);
    }
    return out;
  }

  DM.buildTheme = function (ti) {
    var T = THEMES[ti];
    var floors = [0, 1, 2].map(function (v) { return floorGrid(T, v, ti, 10 + ti * 7).canvas(); });
    var wall = wallGrid(T, ti).canvas();
    var pillar = pillarGrid(T, ti).canvas();
    var rg = rockGrid(T, ti);
    var rock = rg.outline(OUT).canvas();
    var crum = [1, 2, 3].map(function (s) { return crumble(rg, s, ti).outline(OUT).canvas(); });
    return { floors: floors, wall: wall, pillar: pillar, rock: rock, crumble: crum, T: T };
  };

  // ---------- title logo (300x104) ----------
  function buildLogo() {
    var W = 152, H = 54;
    var g = new Grid(W, H);
    var font = DM.Font.glyphs;
    function word(text, ox, oy, cols) {
      for (var i = 0; i < text.length; i++) {
        var rows = font[text[i]];
        for (var y = 0; y < 7; y++) for (var x = 0; x < 5; x++) {
          if (rows[y][x] !== '#') continue;
          for (var sy = 0; sy < 3; sy++) for (var sx = 0; sx < 3; sx++) {
            var yy = y * 3 + sy;
            var col = cols[Math.min(cols.length - 1, Math.floor(yy / 21 * cols.length))];
            if (sx === 0 && sy === 0 && (x === 0 || rows[y][x - 1] !== '#')) col = '#fff6c8';
            g.set(ox + i * 18 + x * 3 + sx, oy + yy, col);
          }
        }
      }
    }
    var fire = ['#fff0a0', '#ffe066', '#ffc83a', '#ffa22a', '#ff7a1c', '#f0502a', '#d0381e'];
    var helm = ['#fffbe0', '#ffe27a', '#f8c83a', '#f8c83a', '#e0a82a', '#c8861e', '#9a6010'];
    word('DYNAMITE', 4, 2, fire);
    word('MOLE', 4 + 36, 29, helm);
    // shadow + outline
    var shadow = g.map(function () { return '#000000'; }).shift(1, 2);
    var out = new Grid(W, H);
    out.over(shadow.outline('#000000'));
    out.over(g.outline('#2a0e0a'));
    // dynamite stick decoration next to MOLE
    var st = new Grid(W, H);
    st.rect(118, 32, 5, 16, '#e0352b'); st.rect(118, 32, 1, 16, '#ff7a5a'); st.rect(122, 32, 1, 16, '#a01e1e');
    st.rect(118, 38, 5, 2, '#2a2230'); st.rect(118, 32, 5, 1, '#f2d7a8');
    st.set(120, 31, '#d8c89a'); st.set(121, 30, '#d8c89a'); st.set(122, 29, '#d8c89a');
    out.over(st.outline('#2a0e0a'));
    var s2 = new Grid(W, H);
    s2.rect(26, 32, 5, 16, '#e0352b'); s2.rect(26, 32, 1, 16, '#ff7a5a'); s2.rect(30, 32, 1, 16, '#a01e1e');
    s2.rect(26, 38, 5, 2, '#2a2230'); s2.rect(26, 32, 5, 1, '#f2d7a8');
    s2.set(28, 31, '#d8c89a'); s2.set(27, 30, '#d8c89a'); s2.set(26, 29, '#d8c89a');
    out.over(s2.outline('#2a0e0a'));
    return { canvas: out.canvas(), w: W * 2, h: H * 2, sparks: [[123, 28], [25, 28]] };
  }

  // ---------- title background (480x416) ----------
  function buildTitleBg() {
    var W = 240, H = 208;
    var g = new Grid(W, H);
    var x, y;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var band = y / H;
      var c = band < 0.5 ? '#1e1410' : band < 0.8 ? '#241812' : '#2a1c14';
      var n = hash(x >> 1, y >> 1, 5);
      if (n < 0.08) c = '#170f0c';
      else if (n > 0.95) c = '#33241a';
      g.set(x, y, c);
    }
    // back cave ribs
    for (x = 0; x < W; x++) {
      var ceil = 18 + Math.round(8 * Math.sin(x * 0.07) + 5 * Math.sin(x * 0.19 + 1));
      for (y = 0; y < ceil; y++) g.set(x, y, y > ceil - 3 ? '#4a3424' : '#0e0907');
      var floorY = 168 + Math.round(5 * Math.sin(x * 0.05 + 2) + 3 * Math.sin(x * 0.23));
      for (y = floorY; y < H; y++) g.set(x, y, y < floorY + 2 ? '#6e4e34' : (hash(x, y, 9) < 0.1 ? '#3a281c' : '#4e3624'));
      // side walls
    }
    for (y = 0; y < H; y++) {
      var lw = 14 + Math.round(6 * Math.sin(y * 0.09) + 3 * Math.sin(y * 0.31));
      var rw = 14 + Math.round(6 * Math.sin(y * 0.08 + 2) + 3 * Math.sin(y * 0.27 + 1));
      for (x = 0; x < lw; x++) g.set(x, y, x > lw - 3 ? '#4a3424' : '#0e0907');
      for (x = W - rw; x < W; x++) g.set(x, y, x < W - rw + 2 ? '#4a3424' : '#0e0907');
    }
    // stalactites
    [[40, 10], [62, 16], [96, 8], [150, 12], [178, 18], [205, 9]].forEach(function (s) {
      var sx = s[0], len = s[1];
      var top = 16 + Math.round(8 * Math.sin(sx * 0.07) + 5 * Math.sin(sx * 0.19 + 1));
      for (var i = 0; i < len; i++) {
        var w = Math.max(0, Math.round(3 * (1 - i / len)));
        for (var k = -w; k <= w; k++) g.set(sx + k, top + i, k === -w ? '#5a4030' : '#2e2018');
      }
    });
    // stalagmites
    [[30, 12], [58, 7], [190, 10], [214, 14]].forEach(function (s) {
      var sx = s[0], len = s[1];
      for (var i = 0; i < len; i++) {
        var w = Math.max(0, Math.round(4 * (i / len)));
        for (var k = -w; k <= w; k++) g.set(sx + k, 168 - len + i, k === -w ? '#6e4e34' : '#3a281c');
      }
    });
    // mine supports
    [[22, 44], [210, 44]].forEach(function (p) {
      g.rect(p[0], p[1], 5, 130, '#6a4424'); g.rect(p[0], p[1], 1, 130, '#9a6a3a'); g.rect(p[0] + 4, p[1], 1, 130, '#3a2412');
    });
    g.rect(20, 40, 197, 6, '#6a4424'); g.rect(20, 40, 197, 1, '#9a6a3a'); g.rect(20, 45, 197, 1, '#3a2412');
    for (x = 30; x < 210; x += 22) g.set(x, 42, '#3a3a44');
    // rails
    for (x = 0; x < W; x++) {
      g.set(x, 186, '#8a8a96'); g.set(x, 187, '#4a4a54');
      g.set(x, 198, '#8a8a96'); g.set(x, 199, '#4a4a54');
    }
    for (x = 4; x < W; x += 12) g.rect(x, 184, 4, 18, '#5a3a20');
    for (x = 0; x < W; x++) {
      g.set(x, 186, '#9a9aa6'); g.set(x, 198, '#9a9aa6');
    }
    // crystals & mushrooms glowing
    [[48, 150, '#9af0ff'], [186, 140, '#9af0ff'], [120, 166, '#6affd6']].forEach(function (c) {
      g.rect(c[0], c[1], 2, 8, c[2]); g.rect(c[0] + 2, c[1] + 3, 2, 5, '#5ab8e0'); g.rect(c[0] - 2, c[1] + 4, 2, 4, c[2]);
      g.set(c[0], c[1], '#ffffff');
    });
    [[80, 170, '#ff78e0'], [160, 168, '#6affd6']].forEach(function (m) {
      g.rect(m[0], m[1], 1, 3, '#e8e0d0'); g.rect(m[0] - 2, m[1] - 1, 5, 1, m[2]); g.rect(m[0] - 1, m[1] - 2, 3, 1, m[2]);
    });
    // dynamite crate
    g.rect(170, 160, 22, 14, '#8a5a2e'); g.rect(170, 160, 22, 1, '#b07a42'); g.rect(170, 166, 22, 1, '#5a3618');
    g.rect(172, 156, 3, 5, '#e0352b'); g.rect(176, 155, 3, 6, '#e0352b'); g.rect(180, 156, 3, 5, '#e0352b');
    g.rect(173, 162, 16, 3, '#c8a060');
    return g.canvas();
  }

  DM.buildArt = function () {
    var A = {};
    A.player = buildPlayer();
    A.slime = buildSlime();
    A.bat = buildBat();
    A.ghost = buildGhost(false);
    A.ghostChase = buildGhost(true);
    var gol = buildGolem();
    A.golem = gol.frames; A.golemFlash = gol.flash;
    A.puff = { slime: buildPuff('#5fd35a'), bat: buildPuff('#9d74d8'), ghost: buildPuff('#ffffff'), golem: buildPuff('#ffb13b') };
    A.bomb = buildBomb();
    A.flame = buildFlames();
    A.items = buildItems();
    A.hud = buildHudIcons();
    A.exit = buildExit();
    A.torch = buildTorch();
    A.themes = [0, 1, 2, 3, 4].map(DM.buildTheme);
    A.logo = buildLogo();
    A.titleBg = buildTitleBg();
    return A;
  };
})();
