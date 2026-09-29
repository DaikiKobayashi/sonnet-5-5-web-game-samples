/* font.js - self-made bitmap font (asset A18). Glyphs are 7 rows tall inside an 8x8 cell,
 * 1..5 columns wide (proportional, 1px gap). Drawn at integer scales only. No fillText anywhere. */
(function (root) {
  'use strict';
  var DM = root.DM = root.DM || {};

  var G = {
    'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    'G': ['.###.', '#...#', '#....', '#..##', '#...#', '#...#', '.###.'],
    'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'I': ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
    'J': ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
    'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    'N': ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
    'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
    'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
    ':': ['.', '.', '#', '.', '.', '#', '.'],
    '.': ['.', '.', '.', '.', '.', '.', '#'],
    ',': ['..', '..', '..', '..', '..', '.#', '#.'],
    '!': ['#', '#', '#', '#', '#', '.', '#'],
    '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
    '-': ['....', '....', '....', '####', '....', '....', '....'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
    '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
    'x': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
    '(': ['..#', '.#.', '#..', '#..', '#..', '.#.', '..#'],
    ')': ['#..', '.#.', '..#', '..#', '..#', '.#.', '#..'],
    "'": ['#', '#', '.', '.', '.', '.', '.'],
    ' ': ['...', '...', '...', '...', '...', '...', '...']
  };

  var F = DM.Font = {
    texts: [],       // strings drawn during the current frame (upper-cased) - read by __GAME__.snapshot()
    glyph: {},       // ch -> { w, rows:[bitmask...], off }
    atlasW: 0,
    atlases: {},
    CELL: 8
  };

  /* index glyphs */
  (function index() {
    var off = 0;
    Object.keys(G).forEach(function (ch) {
      var rows = G[ch];
      var w = rows[0].length;
      var bits = rows.map(function (r) {
        if (r.length !== w) throw new Error('font glyph width mismatch: ' + ch);
        return r;
      });
      F.glyph[ch] = { w: w, rows: bits, off: off };
      off += w;
    });
    F.atlasW = off;
  })();

  function atlas(color) {
    var a = F.atlases[color];
    if (a) return a;
    var cv = document.createElement('canvas');
    cv.width = F.atlasW;
    cv.height = 7;
    var x = cv.getContext('2d');
    x.fillStyle = color;
    Object.keys(F.glyph).forEach(function (ch) {
      var g = F.glyph[ch];
      for (var r = 0; r < 7; r++) {
        for (var c = 0; c < g.w; c++) {
          if (g.rows[r].charAt(c) === '#') x.fillRect(g.off + c, r, 1, 1);
        }
      }
    });
    F.atlases[color] = cv;
    return cv;
  }

  function keyOf(ch) {
    if (ch === 'x') return 'x';        // lower-case x = multiplication sign glyph
    var u = ch.toUpperCase();
    return F.glyph[u] ? u : null;
  }

  var MONO = 6;   // fixed advance (px at 1x) of the optional monospaced mode

  /* width in px of a string at an integer scale (mono: every glyph advances 6px) */
  F.width = function (str, scale, mono) {
    scale = scale || 1;
    str = String(str);
    if (mono) return Math.max(0, str.length * MONO - 1) * scale;
    var w = 0;
    for (var i = 0; i < str.length; i++) {
      var k = keyOf(str.charAt(i));
      var gw = k ? F.glyph[k].w : 3;
      w += gw + 1;
    }
    return Math.max(0, w - 1) * scale;
  };

  F.begin = function () { F.texts.length = 0; };
  /* record a string that is shown as an image generated from this font's glyphs (the title logo) */
  F.register = function (str) { F.texts.push(String(str).toUpperCase()); };

  function run(ctx, str, x, y, scale, color, mono) {
    var at = atlas(color);
    var cx = x;
    for (var i = 0; i < str.length; i++) {
      var k = keyOf(str.charAt(i));
      if (!k) { cx += (mono ? MONO : 4) * scale; continue; }
      var g = F.glyph[k];
      if (mono) {
        if (k !== ' ') ctx.drawImage(at, g.off, 0, g.w, 7, cx + Math.floor((5 - g.w) / 2) * scale, y, g.w * scale, 7 * scale);
        cx += MONO * scale;
      } else {
        if (k !== ' ') ctx.drawImage(at, g.off, 0, g.w, 7, cx, y, g.w * scale, 7 * scale);
        cx += (g.w + 1) * scale;
      }
    }
  }

  /*
   * F.draw(ctx, str, x, y, {scale, color, shadow, outline, align, alpha})
   * Returns the drawn width. y is the top of the 7-row glyph.
   */
  F.draw = function (ctx, str, x, y, o) {
    o = o || {};
    str = String(str);
    if (!o.silent) F.texts.push(str.toUpperCase());
    var scale = o.scale || 1;
    var mono = !!o.mono;
    var w = F.width(str, scale, mono);
    var ax = x;
    if (o.align === 'center') ax = x - w / 2;
    else if (o.align === 'right') ax = x - w;
    ax = Math.round(ax);
    y = Math.round(y);
    var prevAlpha = ctx.globalAlpha;
    if (o.alpha != null) ctx.globalAlpha = prevAlpha * o.alpha;
    if (o.outline) {
      var oc = o.outline, d = scale, dx, dy;
      for (dy = -1; dy <= 1; dy++) {
        for (dx = -1; dx <= 1; dx++) {
          if (dx || dy) run(ctx, str, ax + dx * d, y + dy * d, scale, oc, mono);
        }
      }
    }
    if (o.shadow) run(ctx, str, ax + scale, y + scale, scale, o.shadow, mono);
    run(ctx, str, ax, y, scale, o.color || '#ffffff', mono);
    ctx.globalAlpha = prevAlpha;
    return w;
  };

  /* Glyph bitmap of a string as an array of rows of 0/1 (used to build the title logo) */
  F.bitmap = function (str, gap) {
    gap = gap == null ? 1 : gap;
    str = String(str);
    var rows = [[], [], [], [], [], [], []];
    for (var i = 0; i < str.length; i++) {
      var k = keyOf(str.charAt(i)) || ' ';
      var g = F.glyph[k];
      for (var r = 0; r < 7; r++) {
        for (var c = 0; c < g.w; c++) rows[r].push(g.rows[r].charAt(c) === '#' ? 1 : 0);
        if (i < str.length - 1) for (var q = 0; q < gap; q++) rows[r].push(0);
      }
    }
    return rows;
  };
})(typeof window !== 'undefined' ? window : globalThis);
