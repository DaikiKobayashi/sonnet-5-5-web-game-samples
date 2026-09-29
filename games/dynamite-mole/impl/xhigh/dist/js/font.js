/* font.js - hand-made 5x7 bitmap font (8x8 cell family) and text drawing.
 * Every on-screen string goes through DM.font.draw(); the strings are also
 * recorded (uppercased) in DM.font.texts for window.__GAME__.snapshot().texts.
 */
(function () {
  'use strict';
  var DM = window.DM;

  var G = {
    A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
    B: '####./#...#/#...#/####./#...#/#...#/####.',
    C: '.####/#..../#..../#..../#..../#..../.####',
    D: '####./#...#/#...#/#...#/#...#/#...#/####.',
    E: '#####/#..../#..../####./#..../#..../#####',
    F: '#####/#..../#..../####./#..../#..../#....',
    G: '.####/#..../#..../#.###/#...#/#...#/.####',
    H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
    I: '#####/..#../..#../..#../..#../..#../#####',
    J: '..###/...#./...#./...#./...#./#..#./.##..',
    K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
    L: '#..../#..../#..../#..../#..../#..../#####',
    M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
    N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
    O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
    P: '####./#...#/#...#/####./#..../#..../#....',
    Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
    R: '####./#...#/#...#/####./#.#../#..#./#...#',
    S: '.####/#..../#..../.###./....#/....#/####.',
    T: '#####/..#../..#../..#../..#../..#../..#..',
    U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
    V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
    W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
    X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
    Z: '#####/....#/...#./..#../.#.../#..../#####',
    '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
    '1': '..#../.##../..#../..#../..#../..#../.###.',
    '2': '.###./#...#/....#/...#./..#../.#.../#####',
    '3': '.###./#...#/....#/..##./....#/#...#/.###.',
    '4': '...#./..##./.#.#./#..#./#####/...#./...#.',
    '5': '#####/#..../####./....#/....#/#...#/.###.',
    '6': '..##./.#.../#..../####./#...#/#...#/.###.',
    '7': '#####/....#/...#./..#../.#.../.#.../.#...',
    '8': '.###./#...#/#...#/.###./#...#/#...#/.###.',
    '9': '.###./#...#/#...#/.####/....#/...#./.##..',
    ':': '...../..#../..#../...../..#../..#../.....',
    '.': '...../...../...../...../...../.##../.##..',
    ',': '...../...../...../...../.##../..#../.#...',
    '!': '..#../..#../..#../..#../..#../...../..#..',
    '?': '.###./#...#/....#/...#./..#../...../..#..',
    '-': '...../...../...../#####/...../...../.....',
    '+': '...../..#../..#../#####/..#../..#../.....',
    '/': '....#/....#/...#./..#../.#.../#..../#....',
    x: '...../...../#...#/.#.#./..#../.#.#./#...#',
    '%': '##..#/##..#/...#./..#../.#.../#..##/#..##',
    '(': '...#./..#../.#.../.#.../.#.../..#../...#.',
    ')': '.#.../..#../...#./...#./...#./..#../.#...',
    "'": '..#../..#../.#.../...../...../...../.....',
    '<': '...#./..#../.#.../#..../.#.../..#../...#.',
    '>': '.#.../..#../...#./....#/...#./..#../.#...',
    '*': '...../#.#.#/.###./#####/.###./#.#.#/.....',
    '_': '...../...../...../...../...../...../#####',
    ' ': '...../...../...../...../...../...../.....'
  };

  var CHARS = Object.keys(G);
  var ADV = 6; /* advance per char at 1x (5 px ink + 1 px gap) */
  var sheets = {};

  function sheetFor(color) {
    var s = sheets[color];
    if (s) return s;
    var c = DM.mkCanvas(CHARS.length * 8, 8);
    var ctx = c.getContext('2d');
    ctx.fillStyle = color;
    for (var i = 0; i < CHARS.length; i++) {
      var rows = G[CHARS[i]].split('/');
      for (var y = 0; y < rows.length; y++)
        for (var x = 0; x < 5; x++) if (rows[y].charAt(x) === '#') ctx.fillRect(i * 8 + x, y, 1, 1);
    }
    s = { canvas: c, index: {} };
    for (var j = 0; j < CHARS.length; j++) s.index[CHARS[j]] = j;
    sheets[color] = s;
    return s;
  }

  function norm(str) {
    str = String(str);
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      /* lowercase x is the multiplication glyph used in "x3"; everything else is uppercased */
      out += ch === 'x' ? 'x' : ch.toUpperCase();
    }
    return out;
  }

  var font = (DM.font = { texts: [], ADV: ADV });

  font.beginFrame = function () {
    font.texts.length = 0;
  };

  /* record a string that is shown as bitmap-font artwork (the title logo) without drawing it here */
  font.note = function (str) {
    font.texts.push(norm(str));
  };

  font.width = function (str, scale) {
    scale = scale || 1;
    return Math.max(0, String(str).length * ADV * scale - scale);
  };

  function blitStr(ctx, str, x, y, scale, color) {
    var sh = sheetFor(color);
    for (var i = 0; i < str.length; i++) {
      var idx = sh.index[str.charAt(i)];
      if (idx === undefined || str.charAt(i) === ' ') continue;
      ctx.drawImage(sh.canvas, idx * 8, 0, 5, 7, x + i * ADV * scale, y, 5 * scale, 7 * scale);
    }
  }

  /* opts: scale, color, shadow (colour), outline (colour), align, color2 (colour of lower half), record (default true) */
  font.draw = function (ctx, str, x, y, opts) {
    opts = opts || {};
    var s = norm(str);
    var scale = opts.scale || 1;
    var color = opts.color || '#ffffff';
    if (opts.record !== false) font.texts.push(s);
    var w = font.width(s, scale);
    var x0 = opts.align === 'center' ? Math.round(x - w / 2) : opts.align === 'right' ? Math.round(x - w) : Math.round(x);
    y = Math.round(y);
    if (opts.outline) {
      var o = scale;
      var oc = opts.outline;
      for (var dy = -1; dy <= 1; dy++)
        for (var dx = -1; dx <= 1; dx++) if (dx || dy) blitStr(ctx, s, x0 + dx * o, y + dy * o, scale, oc);
    }
    if (opts.shadow) blitStr(ctx, s, x0 + scale, y + scale, scale, opts.shadow);
    blitStr(ctx, s, x0, y, scale, color);
    if (opts.color2) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0 - scale, y + 4 * scale, w + 2 * scale, 4 * scale);
      ctx.clip();
      blitStr(ctx, s, x0, y, scale, opts.color2);
      ctx.restore();
    }
    return w;
  };

  /* raw glyph rows for the logo builder */
  font.glyphRows = function (ch) {
    var g = G[ch.toUpperCase()] || G[ch];
    return g ? g.split('/') : null;
  };
})();
