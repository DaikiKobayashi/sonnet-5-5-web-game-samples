/* Dynamite Mole - all pixel art, generated in code at 1px dot resolution.
   Every sprite is an offscreen canvas. Characters get an automatic 1px dark outline. */
var Sprites = (function () {
  'use strict';

  var OUTLINE = '#1a1020';

  /* ---------- tiny pixel toolkit ---------- */
  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function ctxOf(c) {
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return g;
  }
  function px(g, x, y, color) { g.fillStyle = color; g.fillRect(x, y, 1, 1); }
  function rect(g, x, y, w, h, color) { g.fillStyle = color; g.fillRect(x, y, w, h); }
  function drawMap(g, rows, pal, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    for (var y = 0; y < rows.length; y++) {
      var row = rows[y];
      for (var x = 0; x < row.length; x++) {
        var ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        var col = pal[ch];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }
  function mapSize(rows) {
    var w = 0;
    for (var i = 0; i < rows.length; i++) w = Math.max(w, rows[i].length);
    return { w: w, h: rows.length };
  }
  // Adds a 1px outline (4-neighbourhood) around opaque pixels.
  function outline(c, color) {
    var g = ctxOf(c);
    var w = c.width, h = c.height;
    var img = g.getImageData(0, 0, w, h);
    var d = img.data;
    var alpha = function (x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return 0;
      return d[(y * w + x) * 4 + 3];
    };
    var marks = [];
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (alpha(x, y) > 0) continue;
      if (alpha(x - 1, y) || alpha(x + 1, y) || alpha(x, y - 1) || alpha(x, y + 1)) marks.push(x, y);
    }
    g.fillStyle = color || OUTLINE;
    for (var i = 0; i < marks.length; i += 2) g.fillRect(marks[i], marks[i + 1], 1, 1);
    return c;
  }
  function flipH(c) {
    var o = canvas(c.width, c.height);
    var g = ctxOf(o);
    g.translate(c.width, 0);
    g.scale(-1, 1);
    g.drawImage(c, 0, 0);
    return o;
  }
  function rotate(c, quarter) {
    var o = canvas(c.width, c.height);
    var g = ctxOf(o);
    g.translate(c.width / 2, c.height / 2);
    g.rotate(quarter * Math.PI / 2);
    g.drawImage(c, -c.width / 2, -c.height / 2);
    return o;
  }
  // Silhouette in a flat color (used for hit flash).
  function tinted(c, color) {
    var o = canvas(c.width, c.height);
    var g = ctxOf(o);
    g.drawImage(c, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return o;
  }
  // Copies a rectangle of a canvas to a shifted position (used to animate limbs).
  function shiftRegion(g, src, sx, sy, w, h, dx, dy) {
    g.clearRect(sx, sy, w, h);
    g.drawImage(src, sx, sy, w, h, sx + dx, sy + dy, w, h);
  }
  function clone(c) {
    var o = canvas(c.width, c.height);
    ctxOf(o).drawImage(c, 0, 0);
    return o;
  }
  // deterministic RNG for procedural tiles
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function fillCircle(g, cx, cy, r, color) {
    g.fillStyle = color;
    for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r + r * 0.5) g.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  }
  function fillEllipse(g, cx, cy, rx, ry, color) {
    g.fillStyle = color;
    for (var y = -ry; y <= ry; y++) for (var x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx + 0.3) + (y * y) / (ry * ry + 0.3) <= 1) g.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
    }
  }
  function roundRect(g, x, y, w, h, r, color) {
    g.fillStyle = color;
    for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
      var cx = xx < r ? r - xx - 1 : (xx >= w - r ? xx - (w - r) : -1);
      var cy = yy < r ? r - yy - 1 : (yy >= h - r ? yy - (h - r) : -1);
      if (cx >= 0 && cy >= 0 && (cx + 1) * (cx + 1) + (cy + 1) * (cy + 1) > r * r + 1) continue;
      g.fillRect(x + xx, y + yy, 1, 1);
    }
  }
  function line(g, x0, y0, x1, y1, color) {
    var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    g.fillStyle = color;
    for (var i = 0; i < 200; i++) {
      g.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /* ---------- palettes ---------- */
  var MOLE = {
    H: '#f5c542', h: '#b8860b', L: '#fff8c0', l: '#ffd35c',
    B: '#9a6a45', b: '#6b4630', F: '#dfae82', N: '#f2789e', n: '#b04a6a',
    E: '#1a1020', W: '#ffffff', C: '#efe4c8', c: '#b9a98a', X: '#1a1020'
  };

  /* ---------- player (A01, A02, A03) ---------- */
  var MOLE_DOWN = [
    '......HHHHHH......',
    '....HHHHHHHHHH....',
    '...HHHHhLLhHHHH...',
    '...HHHHhLlhHHHH...',
    '..HHHHHHHHHHHHHH..',
    '..hhhhhhhhhhhhhh..',
    '...BBBBBBBBBBBB...',
    '..BBBFFFFFFFFBBB..',
    '..BBFFEWFFFFEWBB..',
    '..BBFFEEFFFFEEBB..',
    '..BBFFFFNNFFFFBB..',
    '...BBFFFnnFFFBB...',
    '....BBBFFFFBBB....',
    '...BBBBFFFFBBBB...',
    '..CCBBBFFFFBBBCC..',
    '..CcBBBFFFFBBBCc..',
    '...BBBBBBBBBBBB...',
    '....BBbbbbbbBB....'
  ];
  var MOLE_UP = [
    '......HHHHHH......',
    '....HHHHHHHHHH....',
    '...HHHHHHHHHHHH...',
    '...HHHhHHHHHHHH...',
    '..HHHHHHHHHHHHHH..',
    '..hhhhhhhhhhhhhh..',
    '...BBBBBBBBBBBB...',
    '..BBBBBBBBBBBBBB..',
    '..BBBBBBBBBBBBBB..',
    '..BBBbbBBBBbbBBB..',
    '..BBBbBBBBBBbBBB..',
    '..BBBbBBBBBBbBBB..',
    '...BBBBBBBBBBBB...',
    '...BBBBBBBBBBBB...',
    '..CCBBBBBBBBBBCC..',
    '..CcBBBBBBBBBBCc..',
    '...BBBBBBBbBBBB...',
    '....BBbbbbbbBB....'
  ];
  var MOLE_LEFT = [
    '.....HHHHHHHH.....',
    '...HHHHHHHHHHHH...',
    '..LLhHHHHHHHHHHH..',
    '..LlhHHHHHHHHHHH..',
    '..HHHHHHHHHHHHHHH.',
    '..hhhhhhhhhhhhhhh.',
    '...BBBBBBBBBBBBB..',
    '..FFBBBBBBBBBBBBB.',
    '.FFFFBEWBBBBBBBBB.',
    'NNFFFFEEBBBBBBBBB.',
    'NNFFFFBBBBBBBBBBB.',
    '.nFFFFBBBBBBBBBBB.',
    '...BBBBBBBBBBBBB..',
    '...BBBBBBBBBBBBB..',
    '..CCCBBBBBBBBBBB..',
    '..CccBBBBBBBBBBB..',
    '...BBBBBBBBBBBBBb.',
    '....BBbbbbbbbBBb..'
  ];
  var FEET_FRONT = [
    ['....bb......bb....', '...bbb......bbb...'],
    ['...bb.......bbb...', '..bbb.......bbb...'],
    ['....bb......bb....', '...bbb......bbb...'],
    ['...bbb.......bb...', '...bbb.......bbb..']
  ];
  var FEET_SIDE = [
    ['....bbb....bbb....', '...bbbb....bbbb...'],
    ['..bbb........bbb..', '.bbbb........bbbb.'],
    ['....bbb....bbb....', '...bbbb....bbbb...'],
    ['......bbb.bbb.....', '.....bbbb.bbbb....']
  ];

  function moleFrame(body, feet, bob, clawDy) {
    var c = canvas(32, 32);
    var g = ctxOf(c);
    var ox = 7, oy = 10;
    drawMap(g, body, MOLE, ox, oy + bob);
    drawMap(g, feet, MOLE, ox, oy + 18);
    if (clawDy) {
      // animate claws: shift the left/right claw blocks
      var tmp = clone(c);
      g.clearRect(0, 0, 32, 32);
      g.drawImage(tmp, 0, 0);
      shiftRegion(g, tmp, ox + 2, oy + bob + 14, 2, 2, 0, clawDy);
      shiftRegion(g, tmp, ox + 14, oy + bob + 14, 2, 2, 0, -clawDy);
      // repair the body under the moved claws
      g.fillStyle = MOLE.B;
      if (clawDy > 0) { g.fillRect(ox + 2, oy + bob + 14, 2, 1); g.fillRect(ox + 14, oy + bob + 15, 2, 1); }
      else { g.fillRect(ox + 2, oy + bob + 15, 2, 1); g.fillRect(ox + 14, oy + bob + 14, 2, 1); }
    }
    return outline(c);
  }
  function moleSideFrame(feet, bob, clawDx) {
    var c = canvas(32, 32);
    var g = ctxOf(c);
    var ox = 7, oy = 10;
    drawMap(g, MOLE_LEFT, MOLE, ox, oy + bob);
    drawMap(g, feet, MOLE, ox, oy + 18);
    if (clawDx) {
      var tmp = clone(c);
      shiftRegion(g, tmp, ox + 2, oy + bob + 14, 3, 2, clawDx, 0);
      g.fillStyle = MOLE.B;
      g.fillRect(ox + 5, oy + bob + 14, 1, 2);
    }
    return outline(c);
  }

  function buildPlayer() {
    var walkBob = [0, -1, 0, -1];
    var clawDy = [0, 1, 0, -1];
    var down = [], up = [], left = [], right = [];
    for (var f = 0; f < 4; f++) {
      down.push(moleFrame(MOLE_DOWN, FEET_FRONT[f], walkBob[f], clawDy[f]));
      up.push(moleFrame(MOLE_UP, FEET_FRONT[f], walkBob[f], clawDy[f]));
      var l = moleSideFrame(FEET_SIDE[f], walkBob[f], f === 1 ? -1 : (f === 3 ? 1 : 0));
      left.push(l);
      right.push(flipH(l));
    }
    // idle breathing: frame 0 and a "settled" frame (body 1px lower, feet fixed)
    var idle = {
      down: [down[0], moleFrame(MOLE_DOWN, FEET_FRONT[0], 1, 0)],
      up: [up[0], moleFrame(MOLE_UP, FEET_FRONT[0], 1, 0)],
      left: [left[0], moleSideFrame(FEET_SIDE[0], 1, 0)]
    };
    idle.right = [right[0], flipH(idle.left[1])];

    // death (A02): 6 frames - knocked back, dizzy with orbiting stars, fading
    var deathFrames = [];
    var DIZZY = MOLE_DOWN.slice();
    DIZZY[8] = '..BBFXFXFFFXFXBB..';
    DIZZY[9] = '..BBFFXFFFFFXFBB..';
    DIZZY[10] = '..BBFXFXNNFXFXBB..';
    DIZZY[11] = '...BBFFFnnFFFBB...';
    for (var i = 0; i < 6; i++) {
      var c = canvas(32, 32);
      var g = ctxOf(c);
      var body = i === 0 ? MOLE_DOWN : DIZZY;
      var lift = i === 0 ? -3 : (i === 1 ? -1 : 0);
      drawMap(g, body, MOLE, 7, 10 + lift);
      drawMap(g, FEET_FRONT[0], MOLE, 7, 28 + lift);
      outline(c);
      if (i >= 1) {
        // orbiting stars
        var ang = i * 1.2;
        for (var s = 0; s < 3; s++) {
          var a = ang + s * Math.PI * 2 / 3;
          var sx = Math.round(16 + Math.cos(a) * 9), sy = Math.round(9 + Math.sin(a) * 3);
          drawStar(g, sx, sy, '#fff27a', '#e0a020');
        }
      }
      deathFrames.push(c);
    }
    // joy pose (A03): arms up, two frames (jump)
    var joy = [];
    for (var j = 0; j < 2; j++) {
      var cj = canvas(32, 32);
      var gj = ctxOf(cj);
      var JOY = MOLE_DOWN.slice();
      JOY[12] = '..C.BBBFFFFBBB.C..';
      JOY[13] = '..CBBBBFFFFBBBBC..';
      JOY[14] = '...BBBBFFFFBBBB...';
      JOY[15] = '...BBBBFFFFBBBB...';
      JOY[8] = '..BBFFEEFFFFEEBB..';
      JOY[9] = '..BBFFFFFFFFFFBB..';
      JOY[11] = '...BBFFnnnnFFBB...';
      drawMap(gj, JOY, MOLE, 7, 10 - j * 3);
      drawMap(gj, FEET_FRONT[0], MOLE, 7, 28 - j * 3);
      // arms up
      rect(gj, 8, 18 - j * 3, 2, 3, MOLE.C);
      rect(gj, 22, 18 - j * 3, 2, 3, MOLE.C);
      outline(cj);
      joy.push(cj);
    }
    return { walk: { down: down, up: up, left: left, right: right }, idle: idle, death: deathFrames, joy: joy };
  }
  function drawStar(g, x, y, c1, c2) {
    px(g, x, y, c1); px(g, x - 1, y, c2); px(g, x + 1, y, c2); px(g, x, y - 1, c2); px(g, x, y + 1, c2);
  }

  /* ---------- enemies (A04-A07) ---------- */
  var SLIME_PAL = { G: '#5fd35a', g: '#2f8f3a', l: '#c4ffb0', E: '#1a1020', W: '#ffffff', m: '#1f6a2a' };
  var SLIME_A = [
    '.......GGGGGG.......',
    '.....GGllGGGGGG.....',
    '....GGlGGGGGGGGG....',
    '...GGGGGGGGGGGGGG...',
    '..GGGWWGGGGGGWWGGG..',
    '..GGGWEGGGGGGWEGGG..',
    '..GGGGGGGGGGGGGGGG..',
    '..GGGGGGGmmmGGGGGG..',
    '.GGGGGGGGGGGGGGGGGG.',
    '.GGGGGGGGGGGGGGGGGG.',
    '.GgGGGGGGGGGGGGGGgG.',
    '.GggGGGGGGGGGGGGggG.',
    '..gggggggggggggggg..'
  ];
  var SLIME_SQUASH = [
    '........GGGGGG........',
    '.....GGGllGGGGGG......',
    '...GGGGlGGGGGGGGGG....',
    '..GGGGWWGGGGGGWWGGGG..',
    '.GGGGGWEGGGGGGWEGGGGG.',
    '.GGGGGGGGGGGGGGGGGGGG.',
    '.GGGGGGGGGmmmGGGGGGGG.',
    'GGGGGGGGGGGGGGGGGGGGGG',
    'GGgGGGGGGGGGGGGGGGGgGG',
    'GgggGGGGGGGGGGGGGGgggG',
    '.gggggggggggggggggggg.'
  ];
  var SLIME_STRETCH = [
    '......GGGGGG......',
    '....GGllGGGGGG....',
    '...GGlGGGGGGGGG...',
    '...GGGGGGGGGGGG...',
    '..GGGWWGGGGWWGGG..',
    '..GGGWEGGGGWEGGG..',
    '..GGGGGGGGGGGGGG..',
    '..GGGGGGmmmGGGGG..',
    '..GGGGGGGGGGGGGG..',
    '..GGGGGGGGGGGGGG..',
    '..GGGGGGGGGGGGGG..',
    '.GGGGGGGGGGGGGGGG.',
    '.GgGGGGGGGGGGGGgG.',
    '.GggGGGGGGGGGGggG.',
    '..gggggggggggggg..'
  ];
  function bottomAligned(rows, pal, bottom) {
    var c = canvas(32, 32);
    var g = ctxOf(c);
    var s = mapSize(rows);
    drawMap(g, rows, pal, Math.floor((32 - s.w) / 2), bottom - s.h);
    return outline(c);
  }
  function buildSlime() {
    var a = bottomAligned(SLIME_A, SLIME_PAL, 29);
    var sq = bottomAligned(SLIME_SQUASH, SLIME_PAL, 29);
    var st = bottomAligned(SLIME_STRETCH, SLIME_PAL, 29);
    return [a, sq, a, st];
  }

  var BAT_PAL = { P: '#9b5de5', p: '#5e2ea0', d: '#3c1b6e', Y: '#ffe95a', R: '#ff4040', W: '#ffffff', E: '#1a1020' };
  var BAT_UP = [
    '.........P....P.........',
    'PP......PP....PP......PP',
    'PPP.....PPPPPPPP.....PPP',
    'PPPP...PPPPPPPPPP...PPPP',
    'pPPPP..PPYEPPPPEYP..PPPP',
    '.pPPPP.PPYYPPPPYYP.PPPPp',
    '..pPPPPPPPPPPPPPPPPPPPp.',
    '...pPPPPPPPWPPWPPPPPPp..',
    '.....pPPPPPPPPPPPPPPp...',
    '.......pPPPPPPPPPPp.....',
    '.........PPPPPPPP.......',
    '..........pppppp........'
  ];
  var BAT_MID = [
    '.........P....P.........',
    '........PP....PP........',
    '........PPPPPPPP........',
    'PPPP...PPPPPPPPPP...PPPP',
    'pPPPPPPPPYEPPPPEYPPPPPPP',
    'ppPPPPPPPYYPPPPYYPPPPPPp',
    '.ppPPPPPPPPPPPPPPPPPPpp.',
    '...ppPPPPPPWPPWPPPPpp...',
    '......PPPPPPPPPPPP......',
    '.......PPPPPPPPPP.......',
    '.........PPPPPPPP.......',
    '..........pppppp........'
  ];
  var BAT_DOWN = [
    '.........P....P.........',
    '........PP....PP........',
    '........PPPPPPPP........',
    '.......PPPPPPPPPP.......',
    '.......PPYEPPPPEYP......',
    '.....PPPPYYPPPPYYPPP....',
    '...PPPPPPPPPPPPPPPPPPP..',
    '..PPPPPPPPPWPPWPPPPPPPP.',
    '.PPPPpPPPPPPPPPPPPpPPPPP',
    'PPPPp.pPPPPPPPPPPp.pPPPP',
    'PPpp...ppPPPPPPpp...ppPP',
    'pp.......pppppp.......pp'
  ];
  function buildBat() {
    var up = bottomAligned(BAT_UP, BAT_PAL, 24);
    var mid = bottomAligned(BAT_MID, BAT_PAL, 25);
    var down = bottomAligned(BAT_DOWN, BAT_PAL, 26);
    return [up, mid, down, mid];
  }

  var GHOST_PAL = { G: '#e8f0ff', g: '#b5c4ea', E: '#2e5bff', m: '#6c7fb0', h: '#ffffff' };
  var GHOST_CHASE_PAL = { G: '#e8f0ff', g: '#b5c4ea', E: '#ff3030', m: '#a03030', h: '#ffffff' };
  var GHOST_A = [
    '......GGGGGG......',
    '....GGhhGGGGGG....',
    '...GGhGGGGGGGGG...',
    '..GGGGGGGGGGGGGG..',
    '..GGGEEGGGGGEEGG..',
    '.GGGGEEGGGGGEEGGG.',
    '.GGGGGGGGGGGGGGGG.',
    '.GGGGGGGmmmGGGGGG.',
    '.GGGGGGGGGGGGGGGG.',
    '.GGGGGGGGGGGGGGGG.',
    '.GGGGGGGGGGGGGGgG.',
    '.GGGGGGGGGGGGGggG.',
    '.GGgGGGGGGGGGgggG.',
    '.GGGGgGGGGGggggGG.',
    '.GG.GGG.GGG.GGG.G.',
    '.G...G...G...G..G.'
  ];
  var GHOST_B = [
    '......GGGGGG......',
    '....GGhhGGGGGG....',
    '...GGhGGGGGGGGG...',
    '..GGGGGGGGGGGGGG..',
    '..GGGEEGGGGGEEGG..',
    '.GGGGEEGGGGGEEGGG.',
    '.GGGGGGGGGGGGGGGG.',
    '.GGGGGGGmmmGGGGGG.',
    '.GGGGGGGGGGGGGGGG.',
    '.GGGGGGGGGGGGGGGG.',
    '.GgGGGGGGGGGGGGGG.',
    '.GggGGGGGGGGGGGGG.',
    '.GgggGGGGGGGGGgGG.',
    '.GGgggGGGGGgGGGGG.',
    '..GGG.GGG.GGG.GG..',
    '...G...G...G...G..'
  ];
  function buildGhost() {
    return {
      normal: [bottomAligned(GHOST_A, GHOST_PAL, 27), bottomAligned(GHOST_B, GHOST_PAL, 27)],
      chase: [bottomAligned(GHOST_A, GHOST_CHASE_PAL, 27), bottomAligned(GHOST_B, GHOST_CHASE_PAL, 27)]
    };
  }

  var GOLEM_PAL = { S: '#9aa0ad', s: '#5f6675', d: '#3d4250', O: '#ff9c2a', o: '#ffe0a0', m: '#5d9a4a', L: '#c4c9d4' };
  var GOLEM = [
    '......SSSSSSSSSS......',
    '.....SLSSSSSSSSSS.....',
    '.....SSOOSSSSOOSS.....',
    '.....SSOoSSSSOoSS.....',
    '.....SSSSSSSSSSSS.....',
    '......SSSsssSSSS......',
    '..SSSSSLSSSSSSSSSSSS..',
    '.SSSSSSSSSSSSSSSSSSSS.',
    '.SSSsSSSSSSSSSSSSsSSS.',
    '.SSSsSSSSSdSSSSSSsSSS.',
    '.SSSsSSSSSdSSSSSSsSSS.',
    '.SSssSSSSdSSSSSSSssSS.',
    '.SSssSSSSSSSSSmmSssSS.',
    '.SSssSSSSSSSSSSSSssSS.',
    '.sssSSSSSSSSSSSSSSsss.',
    '.sss.SSSSSSSSSSSS.sss.',
    '....SSSSSSSSSSSSSS....',
    '....SSSSSsssSSSSSS....',
    '....SSSSS...SSSSSS....',
    '....sssss...ssssss....',
    '...ssssss...sssssss...'
  ];
  function buildGolem() {
    var base = canvas(32, 32);
    var gb = ctxOf(base);
    drawMap(gb, GOLEM, GOLEM_PAL, 5, 9);
    var frames = [];
    var offs = [[0, 0, 0, 0], [-2, 2, -1, 1], [0, 0, 0, 0], [2, -2, 1, -1]];
    for (var i = 0; i < 4; i++) {
      var c = canvas(32, 32);
      var g = ctxOf(c);
      g.drawImage(base, 0, 0);
      var o = offs[i];
      // arms (left cols 6-8, right cols 23-25; rows 15-24 in canvas space)
      shiftRegion(g, base, 6, 15, 3, 10, 0, o[0]);
      shiftRegion(g, base, 23, 15, 3, 10, 0, o[1]);
      // legs (rows 27-30)
      shiftRegion(g, base, 9, 27, 5, 4, 0, o[2]);
      shiftRegion(g, base, 17, 27, 6, 4, 0, o[3]);
      // body bob
      if (i === 1 || i === 3) {
        var tmp = clone(c);
        g.clearRect(0, 0, 32, 32);
        g.drawImage(tmp, 0, 1);
      }
      outline(c);
      frames.push(c);
    }
    return { walk: frames, flash: frames.map(function (f) { return tinted(f, '#ffffff'); }) };
  }

  /* ---------- enemy death puff (A08) ---------- */
  function buildPuff(tint) {
    var frames = [];
    for (var i = 0; i < 3; i++) {
      var c = canvas(32, 32);
      var g = ctxOf(c);
      var r = 5 + i * 3;
      var cols = i === 0 ? ['#ffffff', tint] : (i === 1 ? ['#f0f0f0', '#c8c8d0'] : ['#b8b8c0', '#909098']);
      var n = 4 + i * 2;
      for (var k = 0; k < n; k++) {
        var a = k * Math.PI * 2 / n + i * 0.5;
        var cx = 16 + Math.cos(a) * (r - 2), cy = 16 + Math.sin(a) * (r - 2);
        fillCircle(g, cx, cy, Math.max(2, 5 - i), cols[1]);
      }
      fillCircle(g, 16, 16, Math.max(2, 6 - i * 2), cols[0]);
      if (i === 2) {
        // dissipating dots
        for (var d = 0; d < 6; d++) {
          var ad = d * 1.05;
          px(g, Math.round(16 + Math.cos(ad) * 14), Math.round(16 + Math.sin(ad) * 14), '#d0d0d8');
        }
      }
      outline(c, '#3a3040');
      frames.push(c);
    }
    return frames;
  }

  /* ---------- bomb / dynamite (A14) ---------- */
  function buildBomb() {
    var frames = [];
    var sparkCols = [['#fff8b0', '#ffb020'], ['#ffffff', '#ff6a1a'], ['#ffe070', '#ff9a30']];
    for (var i = 0; i < 3; i++) {
      var c = canvas(32, 32);
      var g = ctxOf(c);
      // three sticks bundle
      var sticks = [[8, 10], [13, 8], [18, 10]];
      for (var s = 0; s < 3; s++) {
        var sx = sticks[s][0], sy = sticks[s][1];
        rect(g, sx, sy, 6, 19, '#d8322c');
        rect(g, sx, sy, 1, 19, '#f06a5a');
        rect(g, sx + 5, sy, 1, 19, '#8f1e1a');
        rect(g, sx, sy + 7, 6, 3, '#f4e9c9');
        rect(g, sx + 1, sy + 8, 4, 1, '#b8a070');
        rect(g, sx, sy + 18, 6, 1, '#8f1e1a');
        rect(g, sx + 1, sy, 4, 1, '#ffb0a0');
      }
      // binding
      rect(g, 8, 20, 16, 2, '#4a3520');
      rect(g, 8, 21, 16, 1, '#2d2012');
      // fuse
      var fuse = [[16, 7], [16, 6], [17, 5], [18, 4], [19, 4], [20, 3]];
      for (var f = 0; f < fuse.length; f++) px(g, fuse[f][0], fuse[f][1], '#6b5a3a');
      outline(c);
      // spark
      var cx = 21, cy = 2 + (i === 1 ? 1 : 0);
      px(g, cx, cy, sparkCols[i][0]);
      px(g, cx - 1, cy, sparkCols[i][1]); px(g, cx + 1, cy, sparkCols[i][1]);
      px(g, cx, cy - 1, sparkCols[i][1]); px(g, cx, cy + 1, sparkCols[i][1]);
      if (i !== 1) { px(g, cx - 2, cy - 1, sparkCols[i][1]); px(g, cx + 2, cy + 1, sparkCols[i][1]); }
      else { px(g, cx + 2, cy - 2, sparkCols[i][1]); px(g, cx - 2, cy + 1, sparkCols[i][1]); }
      frames.push(c);
    }
    return frames;
  }

  /* ---------- flame (A15) ---------- */
  function flameCell(kind, frame) {
    // kind: 'center' | 'arm' (horizontal) | 'tip' (pointing right)
    var c = canvas(32, 32);
    var g = ctxOf(c);
    var r = rng(77 + frame * 13);
    var layers = [['#c8281c', 1.0], ['#ff6a1a', 0.8], ['#ffb020', 0.58], ['#fff3a0', 0.34], ['#ffffff', 0.16]];
    for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
      var nx = (x - 15.5) / 16, ny = (y - 15.5) / 16;
      var d;
      if (kind === 'center') d = Math.sqrt(nx * nx + ny * ny);
      else if (kind === 'arm') d = Math.abs(ny) / 0.72;
      else { // tip: rounded end at right
        if (nx > 0.25) { var ex = (nx - 0.25) / 0.75; d = Math.sqrt(ex * ex + (ny / 0.72) * (ny / 0.72)); }
        else d = Math.abs(ny) / 0.72;
      }
      var jitter = (r() - 0.5) * 0.12 + (frame ? Math.sin(x * 1.3 + y * 0.7) * 0.05 : Math.cos(x * 0.9 + y * 1.1) * 0.05);
      d += jitter;
      var col = null;
      for (var l = 0; l < layers.length; l++) if (d <= layers[l][1]) col = layers[l][0];
      if (col) px(g, x, y, col);
    }
    return c;
  }
  function buildFlames() {
    var out = { center: [], h: [], v: [], right: [], left: [], up: [], down: [] };
    for (var f = 0; f < 2; f++) {
      out.center.push(flameCell('center', f));
      var arm = flameCell('arm', f);
      out.h.push(arm);
      out.v.push(rotate(arm, 1));
      var tip = flameCell('tip', f);
      out.right.push(tip);
      out.left.push(flipH(tip));
      out.down.push(rotate(tip, 1));
      out.up.push(rotate(tip, 3));
    }
    return out;
  }

  /* ---------- items (A16) ---------- */
  function itemBase() {
    var c = canvas(32, 32);
    var g = ctxOf(c);
    roundRect(g, 4, 4, 24, 24, 5, '#f4e6c4');
    roundRect(g, 5, 5, 22, 22, 4, '#2b2340');
    roundRect(g, 6, 6, 20, 20, 3, '#3a3058');
    rect(g, 8, 7, 8, 1, '#5a4c80');
    outline(c);
    return c;
  }
  function buildItems() {
    var base = itemBase();
    var out = {};
    var mk = function (draw) {
      var c = canvas(32, 32);
      var g = ctxOf(c);
      g.drawImage(base, 0, 0);
      draw(g);
      return c;
    };
    out.fire = mk(function (g) {
      drawMap(g, [
        '......R......',
        '.....RR......',
        '....RRR..R...',
        '...RRRRR.RR..',
        '...RROORRRR..',
        '..RROOOORRR..',
        '..RROYYOORR..',
        '..RROYYYORR..',
        '..RROOYYORR..',
        '...RROOORR...',
        '....RRRRR....'
      ], { R: '#ff5a1a', O: '#ffa020', Y: '#fff2a0' }, 10, 9);
    });
    out.bomb = mk(function (g) {
      rect(g, 12, 12, 8, 12, '#d8322c');
      rect(g, 12, 12, 1, 12, '#f06a5a');
      rect(g, 19, 12, 1, 12, '#8f1e1a');
      rect(g, 12, 16, 8, 2, '#f4e9c9');
      px(g, 16, 11, '#6b5a3a'); px(g, 17, 10, '#6b5a3a'); px(g, 18, 9, '#6b5a3a');
      px(g, 19, 8, '#fff8b0'); px(g, 20, 8, '#ffb020'); px(g, 19, 7, '#ffb020'); px(g, 18, 8, '#ffb020'); px(g, 19, 9, '#ffb020');
    });
    out.boots = mk(function (g) {
      drawMap(g, [
        '..BBBB.......',
        '..BbbB.......',
        '..BbbB.......',
        '..BbbB.......',
        '..BbbBB......',
        '..BbbbBBBB...',
        '..BbbbbbbBB..',
        '..YYYYYYYYYB.',
        '..yyyyyyyyyy.'
      ], { B: '#a86a3a', b: '#7a4a22', Y: '#f5c542', y: '#b8860b' }, 10, 10);
      px(g, 13, 11, '#f5c542'); px(g, 13, 13, '#f5c542');
    });
    out.life = mk(function (g) {
      // small mole face with helmet
      drawMap(g, [
        '....HHHHHH....',
        '..HHHHHHHHHH..',
        '..HHHhLLhHHH..',
        '.hhhhhhhhhhhh.',
        '..BBBBBBBBBB..',
        '.BBFFFFFFFFBB.',
        '.BBFEFFFFEFBB.',
        '.BBFFFNNFFFBB.',
        '..BBFFnnFFBB..',
        '...BBBBBBBB...'
      ], MOLE, 9, 10);
      drawMap(g, ['R.R', 'RRR', '.R.'], { R: '#ff4060' }, 22, 8);
    });
    return out;
  }

  /* ---------- exit (A13) ---------- */
  function buildExit() {
    var closed = canvas(32, 32);
    var g = ctxOf(closed);
    // dark pit
    roundRect(g, 3, 3, 26, 26, 4, '#0b0810');
    roundRect(g, 5, 5, 22, 22, 3, '#1c1524');
    // wooden boards across
    var board = function (x, y, w, h, col, dark) {
      rect(g, x, y, w, h, col); rect(g, x, y + h - 1, w, 1, dark); rect(g, x, y, w, 1, '#c99a5a');
    };
    board(2, 8, 28, 6, '#a06a3a', '#6b4222');
    board(2, 18, 28, 6, '#a06a3a', '#6b4222');
    rect(g, 6, 4, 5, 24, '#8a5a2e'); rect(g, 21, 4, 5, 24, '#8a5a2e');
    rect(g, 6, 4, 1, 24, '#c99a5a'); rect(g, 21, 4, 1, 24, '#c99a5a');
    // nails
    [[7, 9], [24, 9], [7, 19], [24, 19], [8, 26], [23, 26], [8, 5], [23, 5]].forEach(function (p) { px(g, p[0], p[1], '#e0e0e8'); });
    // padlock
    rect(g, 13, 12, 6, 6, '#c9a227'); rect(g, 14, 10, 4, 3, '#8a7a3a'); rect(g, 15, 11, 2, 1, '#1c1524'); px(g, 15, 15, '#4a3a10');
    outline(closed);

    var open = [];
    for (var i = 0; i < 2; i++) {
      var c = canvas(32, 32);
      var gg = ctxOf(c);
      var glow = i === 0 ? '#c09040' : '#ffd060';
      roundRect(gg, 2, 2, 28, 28, 5, glow);
      roundRect(gg, 3, 3, 26, 26, 4, i === 0 ? '#2a2030' : '#3a2a30');
      roundRect(gg, 5, 5, 22, 22, 3, '#0b0810');
      // light from below
      for (var y = 8; y < 27; y++) {
        var w = Math.max(2, Math.round((y - 6) * 0.6));
        rect(gg, 16 - w, y, w * 2, 1, i === 0 ? '#2c2418' : '#3c3020');
      }
      // ladder
      rect(gg, 9, 4, 3, 26, '#c99a5a'); rect(gg, 20, 4, 3, 26, '#c99a5a');
      rect(gg, 9, 4, 1, 26, '#e8c080'); rect(gg, 20, 4, 1, 26, '#e8c080');
      for (var r = 7; r < 30; r += 5) { rect(gg, 12, r, 8, 2, '#b58448'); rect(gg, 12, r, 8, 1, '#e0b070'); }
      // sparkles
      if (i === 1) { drawStar(gg, 6, 8, '#ffffff', '#ffd060'); drawStar(gg, 26, 22, '#ffffff', '#ffd060'); }
      else { drawStar(gg, 26, 8, '#ffe0a0', '#c09040'); }
      outline(c);
      open.push(c);
    }
    return { closed: closed, open: open };
  }

  /* ---------- stage themes: floor, wall, pillar, rock (A09-A12) ---------- */
  var THEMES = [
    { // 1 SHALLOW TUNNELS - brown earth, wooden props
      id: 1, floor: ['#b98a5a', '#b07f50'], floorDot: '#9c6b42', floorLight: '#c9a070',
      wall: '#7a4b2a', wallDark: '#4e2d18', wallLight: '#9a6a40', wallMortar: '#5c3620',
      pillar: '#b5793f', pillarDark: '#7a4a22', pillarLight: '#d8a060', pillarStyle: 'wood',
      rock: '#c89a62', rockDark: '#8c6035', rockLight: '#e6c48e', rockSpot: '#a87a48',
      accent: '#f0d080', deco: 'pebble', vignette: 0.25, bg: '#2a1a10'
    },
    { // 2 MUSHROOM GROTTO - teal & purple, glowing mushrooms
      id: 2, floor: ['#3d6e64', '#37655c'], floorDot: '#2c514a', floorLight: '#4d857a',
      wall: '#2c4a58', wallDark: '#16262e', wallLight: '#4a7488', wallMortar: '#1e3540',
      pillar: '#6a4a9a', pillarDark: '#3e2a62', pillarLight: '#9a78c8', pillarStyle: 'stone',
      rock: '#5a9a8a', rockDark: '#2f5f55', rockLight: '#8fd0bc', rockSpot: '#d16cff',
      accent: '#ff7ce0', deco: 'mushroom', vignette: 0.35, bg: '#10201e'
    },
    { // 3 CRYSTAL VEIN - blue & cyan crystals
      id: 3, floor: ['#3a5a9a', '#34528e'], floorDot: '#27407a', floorLight: '#5a80c8',
      wall: '#1f2f5c', wallDark: '#0e1630', wallLight: '#3a5090', wallMortar: '#141f40',
      pillar: '#4a6ab8', pillarDark: '#2a3e80', pillarLight: '#9ad0ff', pillarStyle: 'crystal',
      rock: '#6fb8e8', rockDark: '#2f6fa8', rockLight: '#d0f4ff', rockSpot: '#ffffff',
      accent: '#a0f0ff', deco: 'crystal', vignette: 0.3, bg: '#0a1030'
    },
    { // 4 LAVA DEPTHS - red & orange, dark basalt
      id: 4, floor: ['#5a2a24', '#52251f'], floorDot: '#3a1612', floorLight: '#7a3c30',
      wall: '#3a1a16', wallDark: '#1a0a08', wallLight: '#5e2c24', wallMortar: '#ff6a1a',
      pillar: '#6b3a2a', pillarDark: '#3a1c14', pillarLight: '#a05a40', pillarStyle: 'basalt',
      rock: '#5a4644', rockDark: '#2c1e1c', rockLight: '#8a706c', rockSpot: '#ff8a20',
      accent: '#ffb030', deco: 'lava', vignette: 0.4, bg: '#200806'
    },
    { // 5 THE DEEP DARK - near-black indigo with glowing accents
      id: 5, floor: ['#171d38', '#131a30'], floorDot: '#0d1124', floorLight: '#232c50',
      wall: '#0a0d1c', wallDark: '#04050c', wallLight: '#1a2040', wallMortar: '#101430',
      pillar: '#20284c', pillarDark: '#0c1028', pillarLight: '#3ef0ff', pillarStyle: 'obsidian',
      rock: '#3c4878', rockDark: '#1a2040', rockLight: '#6a7ab8', rockSpot: '#7cf9ff',
      accent: '#c060ff', deco: 'glow', vignette: 0.5, bg: '#04040c'
    }
  ];

  function buildFloor(t, variant) {
    var c = canvas(32, 32);
    var g = ctxOf(c);
    var r = rng(1000 * t.id + variant * 17);
    rect(g, 0, 0, 32, 32, t.floor[variant % 2]);
    // gentle noise
    for (var i = 0; i < 26; i++) {
      var x = Math.floor(r() * 32), y = Math.floor(r() * 32);
      px(g, x, y, r() < 0.5 ? t.floorDot : t.floorLight);
    }
    // decoration
    if (variant === 2) {
      if (t.deco === 'pebble') {
        fillEllipse(g, 10, 20, 3, 2, t.floorDot); fillEllipse(g, 22, 9, 2, 1, t.floorDot); px(g, 9, 19, t.floorLight);
      } else if (t.deco === 'mushroom') {
        rect(g, 19, 16, 2, 5, '#d8d0c0'); fillEllipse(g, 20, 15, 4, 2, '#d16cff'); px(g, 18, 14, '#ffd0ff'); px(g, 22, 15, '#ffd0ff');
        rect(g, 9, 22, 2, 3, '#d8d0c0'); fillEllipse(g, 10, 21, 3, 2, '#ff7ce0'); px(g, 9, 20, '#ffe0ff');
      } else if (t.deco === 'crystal') {
        drawMap(g, ['..C..', '.CCc.', '.CCc.', 'CCCcc', 'CCCcc'], { C: '#a0f0ff', c: '#5aa8e0' }, 18, 12);
        drawMap(g, ['.C.', 'CCc', 'CCc'], { C: '#d0f8ff', c: '#5aa8e0' }, 8, 20);
      } else if (t.deco === 'lava') {
        line(g, 4, 26, 12, 18, '#ff6a1a'); line(g, 12, 18, 20, 20, '#ff9a30'); line(g, 20, 20, 27, 12, '#ff6a1a');
        px(g, 12, 17, '#ffd060');
      } else if (t.deco === 'glow') {
        drawStar(g, 22, 10, '#7cf9ff', '#2a6a80'); px(g, 9, 22, '#c060ff'); px(g, 10, 23, '#5a2a80');
      }
    }
    return c;
  }
  function buildWall(t) {
    var c = canvas(32, 32);
    var g = ctxOf(c);
    var r = rng(500 + t.id);
    rect(g, 0, 0, 32, 32, t.wallMortar);
    // bricks
    for (var row = 0; row < 4; row++) {
      var off = row % 2 ? 8 : 0;
      for (var col = -1; col < 3; col++) {
        var x = col * 16 + off, y = row * 8;
        rect(g, x + 1, y + 1, 14, 6, t.wall);
        rect(g, x + 1, y + 1, 14, 1, t.wallLight);
        rect(g, x + 1, y + 6, 14, 1, t.wallDark);
        rect(g, x + 1, y + 1, 1, 6, t.wallLight);
        for (var k = 0; k < 3; k++) px(g, x + 2 + Math.floor(r() * 12), y + 2 + Math.floor(r() * 4), r() < 0.5 ? t.wallDark : t.wallLight);
      }
    }
    if (t.id === 1) { // wooden beam on top
      rect(g, 0, 0, 32, 4, '#a06a3a'); rect(g, 0, 0, 32, 1, '#c99a5a'); rect(g, 0, 3, 32, 1, '#5c3620');
    }
    if (t.id === 4) { // lava seams
      px(g, 8, 8, '#ff9a30'); px(g, 24, 16, '#ff9a30'); px(g, 16, 24, '#ff6a1a');
    }
    if (t.id === 5) { px(g, 5, 13, '#3ef0ff'); px(g, 26, 27, '#c060ff'); }
    if (t.id === 2) { px(g, 6, 12, '#ff7ce0'); px(g, 25, 27, '#d16cff'); }
    if (t.id === 3) { px(g, 20, 5, '#a0f0ff'); px(g, 4, 22, '#a0f0ff'); }
    rect(g, 0, 0, 32, 1, t.wallDark);
    rect(g, 0, 31, 32, 1, t.wallDark);
    return c;
  }
  function buildPillar(t) {
    var c = canvas(32, 32);
    var g = ctxOf(c);
    rect(g, 0, 0, 32, 32, t.floor[0]);
    if (t.pillarStyle === 'wood') {
      // wooden support beam: square post with a cap
      rect(g, 4, 2, 24, 28, t.pillar);
      rect(g, 4, 2, 24, 3, t.pillarLight);
      rect(g, 4, 27, 24, 3, t.pillarDark);
      rect(g, 4, 2, 2, 28, t.pillarLight);
      rect(g, 26, 2, 2, 28, t.pillarDark);
      for (var i = 0; i < 4; i++) rect(g, 9 + i * 5, 6, 1, 20, t.pillarDark);
      rect(g, 2, 0, 28, 4, '#8a5a2e'); rect(g, 2, 0, 28, 1, '#c99a5a');
      px(g, 7, 8, '#e0e0e8'); px(g, 24, 8, '#e0e0e8'); px(g, 7, 24, '#e0e0e8'); px(g, 24, 24, '#e0e0e8');
    } else if (t.pillarStyle === 'crystal') {
      roundRect(g, 3, 3, 26, 26, 4, t.pillarDark);
      roundRect(g, 5, 5, 22, 22, 3, t.pillar);
      drawMap(g, ['....CC....', '...CCCc...', '...CCCc...', '..CCCCcc..', '..CCCCcc..', '.CCCCCccc.', '.CCCCCccc.', 'CCCCCCcccc'],
        { C: t.pillarLight, c: '#4a80d0' }, 11, 8);
      rect(g, 5, 5, 22, 1, '#7aa0e0');
    } else {
      roundRect(g, 2, 2, 28, 28, 5, t.pillarDark);
      roundRect(g, 4, 3, 24, 24, 4, t.pillar);
      roundRect(g, 6, 5, 20, 8, 3, t.pillarLight);
      roundRect(g, 8, 7, 16, 4, 2, t.pillar);
      rect(g, 6, 22, 20, 3, t.pillarDark);
      if (t.pillarStyle === 'obsidian') { px(g, 10, 14, t.pillarLight); px(g, 22, 18, t.pillarLight); line(g, 12, 16, 20, 19, '#3ef0ff'); }
      if (t.pillarStyle === 'basalt') { line(g, 8, 20, 14, 14, '#ff6a1a'); px(g, 15, 13, '#ffd060'); }
      if (t.pillarStyle === 'stone') { px(g, 9, 18, '#ff7ce0'); px(g, 22, 15, '#d16cff'); rect(g, 8, 16, 3, 1, '#7a9a6a'); }
    }
    outline(c, t.wallDark);
    return c;
  }
  function buildRock(t) {
    var frames = [];
    var r = rng(900 + t.id * 3);
    var spots = [];
    for (var s = 0; s < 6; s++) spots.push([4 + Math.floor(r() * 24), 4 + Math.floor(r() * 24)]);
    for (var f = 0; f < 4; f++) {
      var c = canvas(32, 32);
      var g = ctxOf(c);
      if (f === 0) {
        roundRect(g, 2, 3, 28, 27, 7, t.rockDark);
        roundRect(g, 3, 2, 26, 26, 7, t.rock);
        roundRect(g, 6, 4, 16, 8, 4, t.rockLight);
        roundRect(g, 8, 6, 12, 4, 2, t.rock);
        for (var i = 0; i < spots.length; i++) px(g, spots[i][0], spots[i][1], i % 2 ? t.rockSpot : t.rockDark);
        line(g, 18, 20, 24, 24, t.rockDark);
        line(g, 8, 22, 12, 26, t.rockDark);
        outline(c, t.wallDark);
      } else if (f === 1) {
        roundRect(g, 2, 3, 28, 27, 7, t.rockDark);
        roundRect(g, 3, 2, 26, 26, 7, t.rock);
        roundRect(g, 6, 4, 16, 8, 4, t.rockLight);
        line(g, 6, 8, 16, 18, '#1a1020'); line(g, 16, 18, 26, 12, '#1a1020'); line(g, 16, 18, 14, 28, '#1a1020');
        line(g, 10, 4, 12, 12, '#1a1020');
        outline(c, t.wallDark);
      } else if (f === 2) {
        // broken into chunks
        roundRect(g, 3, 4, 11, 10, 3, t.rock); roundRect(g, 4, 5, 6, 3, 2, t.rockLight);
        roundRect(g, 17, 3, 12, 11, 3, t.rockDark); roundRect(g, 18, 4, 10, 8, 3, t.rock);
        roundRect(g, 5, 18, 10, 9, 3, t.rockDark); roundRect(g, 6, 18, 8, 7, 3, t.rock);
        roundRect(g, 18, 19, 11, 9, 3, t.rock);
        outline(c, t.wallDark);
      } else {
        // scattered pebbles
        var pts = [[6, 8], [22, 6], [12, 22], [24, 22], [16, 14], [8, 26], [26, 14]];
        for (var p = 0; p < pts.length; p++) fillEllipse(g, pts[p][0], pts[p][1], 2, 1, p % 2 ? t.rock : t.rockDark);
        outline(c, t.wallDark);
      }
      frames.push(c);
    }
    return frames;
  }
  function buildThemes() {
    return THEMES.map(function (t) {
      return {
        id: t.id, bg: t.bg, vignette: t.vignette, accent: t.accent,
        floor: [buildFloor(t, 0), buildFloor(t, 1), buildFloor(t, 2)],
        wall: buildWall(t), pillar: buildPillar(t), rock: buildRock(t),
        rockColor: t.rock, rockDark: t.rockDark
      };
    });
  }

  /* ---------- HUD icons (A17) ---------- */
  function buildHudIcons() {
    var face = canvas(16, 16);
    drawMap(ctxOf(face), [
      '....HHHHHH....',
      '..HHHHHHHHHH..',
      '..HHHhLLhHHH..',
      '.hhhhhhhhhhhh.',
      '..BBBBBBBBBB..',
      '.BBFFFFFFFFBB.',
      '.BBFEFFFFEFBB.',
      '.BBFFFNNFFFBB.',
      '..BBFFnnFFBB..',
      '...BBBBBBBB...'
    ], MOLE, 1, 3);
    outline(face);
    var bomb = canvas(16, 16);
    var gb = ctxOf(bomb);
    rect(gb, 5, 5, 6, 9, '#d8322c'); rect(gb, 5, 5, 1, 9, '#f06a5a'); rect(gb, 5, 8, 6, 2, '#f4e9c9');
    px(gb, 8, 4, '#6b5a3a'); px(gb, 9, 3, '#6b5a3a'); px(gb, 10, 2, '#ffb020'); px(gb, 11, 2, '#fff8b0'); px(gb, 10, 1, '#ffb020');
    outline(bomb);
    var fire = canvas(16, 16);
    drawMap(ctxOf(fire), ['....R....', '...RR..R.', '..RRRR.R.', '..ROORRR.', '.RROOORR.', '.ROYYOOR.', '.ROYYYOR.', '..ROOOR..', '...RRR...'], { R: '#ff5a1a', O: '#ffa020', Y: '#fff2a0' }, 3, 3);
    outline(fire);
    var boots = canvas(16, 16);
    drawMap(ctxOf(boots), ['.BBB....', '.BbB....', '.BbB....', '.BbBB...', '.BbbbBB.', '.YYYYYYB', '.yyyyyyy'], { B: '#a86a3a', b: '#7a4a22', Y: '#f5c542', y: '#b8860b' }, 4, 4);
    outline(boots);
    var snd = canvas(16, 16);
    drawMap(ctxOf(snd), ['...W....', '..WW..w.', '.WWW.w.w', 'WWWW.w.w', 'WWWW.w.w', '.WWW.w.w', '..WW..w.', '...W....'], { W: '#e8e8f0', w: '#9ad0ff' }, 3, 4);
    outline(snd);
    return { face: face, bomb: bomb, fire: fire, boots: boots, snd: snd };
  }

  /* ---------- title logo (A19) and title background (A20) ---------- */
  function buildLogo() {
    var w = 440, h = 120;
    var c = canvas(w, h);
    var g = ctxOf(c);
    var t1 = 'DYNAMITE', t2 = 'MOLE';
    var s = 4; // text scale (integer, allowed for font)
    var x1 = Math.round(w / 2 - Font.width(t1, s) / 2);
    var y1 = 14;
    var x2 = Math.round(w / 2 - Font.width(t2, s) / 2);
    var y2 = 62;
    // decorative dynamite sticks on both sides of "MOLE"
    var stick = function (x, y) {
      rect(g, x, y, 10, 30, '#d8322c'); rect(g, x, y, 2, 30, '#f06a5a'); rect(g, x + 8, y, 2, 30, '#8f1e1a');
      rect(g, x, y + 11, 10, 5, '#f4e9c9'); rect(g, x + 2, y + 13, 6, 1, '#b8a070');
      px(g, x + 4, y - 1, '#6b5a3a'); px(g, x + 5, y - 2, '#6b5a3a'); px(g, x + 6, y - 3, '#6b5a3a');
      drawStar(g, x + 7, y - 5, '#fff8b0', '#ff9a30');
    };
    stick(x2 - 40, y2 + 2); stick(x2 + Font.width(t2, s) + 30, y2 + 2);
    // layered text: dark drop, then gradient bands (built once at boot, before the
    // text listener is installed, so nothing is recorded in snapshot().texts)
    var drawBand = function (text, x, y, scale, col) { Font.draw(g, text, x, y, scale, col, { outline: '#1a1020' }); };
    for (var d = 5; d >= 1; d--) { drawBand(t1, x1 + d, y1 + d, s, d === 5 ? '#1a1020' : '#7a3a12'); }
    for (d = 5; d >= 1; d--) { drawBand(t2, x2 + d, y2 + d, s, d === 5 ? '#1a1020' : '#7a4a12'); }
    // main face: fire gradient by rows (clip bands)
    var bands1 = ['#fff3a0', '#ffd23c', '#ffa020', '#ff6a1a', '#e03a14'];
    var bands2 = ['#fff6c0', '#f5c542', '#e0a020', '#b8860b', '#8a5a10'];
    var band = function (text, x, y, cols) {
      var hh = 8 * s, step = hh / cols.length;
      for (var i = 0; i < cols.length; i++) {
        g.save();
        g.beginPath();
        g.rect(x - s, y + Math.floor(i * step), Font.width(text, s) + 2 * s, Math.ceil(step) + 1);
        g.clip();
        Font.draw(g, text, x, y, s, cols[i], { outline: '#1a1020' });
        g.restore();
      }
    };
    band(t1, x1, y1, bands1);
    band(t2, x2, y2, bands2);
    // helmet lamp glint on the logo
    drawStar(g, x1 + 4, y1 + 4, '#ffffff', '#fff3a0');
    return c;
  }

  function buildTitleBg() {
    var w = 480, h = 416;
    var c = canvas(w, h);
    var g = ctxOf(c);
    var r = rng(4242);
    // vertical gradient in bands (1px rows)
    for (var y = 0; y < h; y++) {
      var k = y / h;
      var rr = Math.round(14 + 30 * k), gg = Math.round(8 + 18 * k), bb = Math.round(20 + 12 * k);
      rect(g, 0, y, w, 1, 'rgb(' + rr + ',' + gg + ',' + bb + ')');
    }
    // distant rock texture
    for (var i = 0; i < 700; i++) {
      var x = Math.floor(r() * w), yy = Math.floor(r() * h);
      px(g, x, yy, r() < 0.5 ? '#2a1a20' : '#3a2428');
    }
    // stalactites from the ceiling
    var sx = 0;
    while (sx < w) {
      var sw = 10 + Math.floor(r() * 26), sh = 20 + Math.floor(r() * 60);
      for (var yy2 = 0; yy2 < sh; yy2++) {
        var ww = Math.max(1, Math.round(sw * (1 - yy2 / sh)));
        rect(g, sx + Math.floor((sw - ww) / 2), yy2, ww, 1, yy2 % 7 === 0 ? '#3d2a30' : '#2c1c22');
        px(g, sx + Math.floor((sw - ww) / 2), yy2, '#4a3438');
      }
      sx += sw + Math.floor(r() * 8);
    }
    // cave floor with rubble
    var floorY = 330;
    rect(g, 0, floorY, w, h - floorY, '#3a2718');
    rect(g, 0, floorY, w, 2, '#5a3d24');
    for (i = 0; i < 300; i++) px(g, Math.floor(r() * w), floorY + Math.floor(r() * (h - floorY)), r() < 0.5 ? '#2c1c10' : '#4a3220');
    var boulders = [[40, 322, 22, 12], [120, 326, 16, 8], [330, 320, 30, 14], [420, 326, 18, 9], [250, 328, 12, 6]];
    boulders.forEach(function (b) {
      fillEllipse(g, b[0], b[1], b[2] / 2, b[3] / 2, '#5c4028');
      fillEllipse(g, b[0] - 2, b[1] - 2, b[2] / 3, b[3] / 3, '#7a5a38');
    });
    // wooden support frames left and right
    var frame = function (x) {
      rect(g, x, 120, 12, floorY - 120, '#7a4b2a'); rect(g, x, 120, 2, floorY - 120, '#a06a3a'); rect(g, x + 10, 120, 2, floorY - 120, '#4e2d18');
      rect(g, x - 8, 112, 28, 10, '#8a5a2e'); rect(g, x - 8, 112, 28, 2, '#c99a5a');
    };
    frame(52); frame(416);
    // wooden sign board behind the control list
    rect(g, 14, 334, 276, 76, '#2a1a10'); rect(g, 16, 336, 272, 72, '#4e3520'); rect(g, 16, 336, 272, 2, '#7a5a38');
    for (i = 0; i < 4; i++) rect(g, 16, 353 + i * 18, 272, 1, '#3c2818');
    // lanterns hanging from both wooden frames
    var lantern = function (x, y) {
      rect(g, x + 6, y - 10, 2, 10, '#3a3030');
      rect(g, x, y, 14, 4, '#3a3030'); rect(g, x + 1, y + 4, 12, 16, '#ffd060'); rect(g, x + 3, y + 6, 8, 12, '#fff3a0'); rect(g, x, y + 20, 14, 3, '#3a3030');
    };
    lantern(76, 132); lantern(390, 132);
    // mushrooms & crystals dotted around
    var m = function (x, y, cap) { rect(g, x, y + 3, 2, 4, '#d8d0c0'); fillEllipse(g, x + 1, y + 2, 3, 2, cap); };
    m(90, 318, '#d16cff'); m(300, 322, '#ff7ce0'); m(455, 316, '#d16cff');
    drawMap(g, ['..C..', '.CCc.', '.CCc.', 'CCCcc', 'CCCcc'], { C: '#a0f0ff', c: '#5aa8e0' }, 160, 322);
    drawMap(g, ['.C.', 'CCc', 'CCc'], { C: '#d0f8ff', c: '#5aa8e0' }, 372, 324);
    return c;
  }

  /* ---------- particles helpers / misc ---------- */
  function buildSpark() {
    var c = canvas(3, 3);
    var g = ctxOf(c);
    px(g, 1, 0, '#ffd060'); px(g, 0, 1, '#ffd060'); px(g, 2, 1, '#ffd060'); px(g, 1, 2, '#ffd060'); px(g, 1, 1, '#ffffff');
    return c;
  }

  var S = null;
  function build() {
    if (S) return S;
    S = {
      player: buildPlayer(),
      slime: buildSlime(),
      bat: buildBat(),
      ghost: buildGhost(),
      golem: buildGolem(),
      puff: { slime: buildPuff('#5fd35a'), bat: buildPuff('#9b5de5'), ghost: buildPuff('#b5c4ea'), golem: buildPuff('#9aa0ad') },
      bomb: buildBomb(),
      flame: buildFlames(),
      items: buildItems(),
      exit: buildExit(),
      themes: buildThemes(),
      hud: buildHudIcons(),
      logo: buildLogo(),
      titleBg: buildTitleBg(),
      spark: buildSpark()
    };
    return S;
  }

  return { build: build, canvas: canvas, ctxOf: ctxOf, OUTLINE: OUTLINE };
})();
