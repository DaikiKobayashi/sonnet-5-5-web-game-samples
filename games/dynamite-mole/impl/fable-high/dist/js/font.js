/* Dynamite Mole - self-made 8x8 bitmap font (A18).
   Glyphs are 5x7 dots inside an 8x8 cell, drawn with 1px dots at integer scales. */
var Font = (function () {
  'use strict';

  var GLYPHS = {
    'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    'C': ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
    'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    'G': ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.####'],
    'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'I': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
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
    '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '#....', '####.', '....#', '....#', '####.'],
    '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
    ':': ['.....', '..#..', '..#..', '.....', '..#..', '..#..', '.....'],
    '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
    ',': ['.....', '.....', '.....', '.....', '..#..', '..#..', '.#...'],
    '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
    '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
    '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
    '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
    'x': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
    '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
    ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
    "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
    ' ': []
  };

  var ORDER = Object.keys(GLYPHS);
  var INDEX = {};
  ORDER.forEach(function (ch, i) { INDEX[ch] = i; });

  var sheets = {}; // color -> canvas (8 * n wide, 8 tall)

  function buildSheet(color) {
    var c = document.createElement('canvas');
    c.width = ORDER.length * 8;
    c.height = 8;
    var g = c.getContext('2d');
    g.fillStyle = color;
    for (var i = 0; i < ORDER.length; i++) {
      var rows = GLYPHS[ORDER[i]];
      for (var y = 0; y < rows.length; y++) {
        for (var x = 0; x < rows[y].length; x++) {
          if (rows[y][x] === '#') g.fillRect(i * 8 + x + 1, y, 1, 1);
        }
      }
    }
    sheets[color] = c;
    return c;
  }

  // Convert input to the drawable form: letters uppercased, except the
  // multiplication glyph 'x' which is kept as-is (it is a font glyph of its own).
  function normalize(str) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (ch === 'x') { out += ch; continue; }
      var up = ch.toUpperCase();
      out += (INDEX[up] !== undefined) ? up : (INDEX[ch] !== undefined ? ch : ' ');
    }
    return out;
  }

  var listener = null;
  function setListener(fn) { listener = fn; }
  // Record a string that was rendered with this font as a pre-built image (e.g. the logo).
  function note(str) { if (listener) listener(normalize(String(str))); }

  function width(str, scale) { return str.length * 8 * (scale || 1); }

  /* opts: { shadow: color, outline: color, align: 'left'|'center'|'right' } */
  function draw(ctx, str, x, y, scale, color, opts) {
    scale = scale || 1;
    color = color || '#ffffff';
    opts = opts || {};
    var text = normalize(String(str));
    if (listener) listener(text);
    var w = width(text, scale);
    if (opts.align === 'center') x = Math.round(x - w / 2);
    else if (opts.align === 'right') x = Math.round(x - w);
    if (opts.outline) {
      var oc = opts.outline;
      blit(ctx, text, x - scale, y, scale, oc);
      blit(ctx, text, x + scale, y, scale, oc);
      blit(ctx, text, x, y - scale, scale, oc);
      blit(ctx, text, x, y + scale, scale, oc);
    }
    if (opts.shadow) blit(ctx, text, x + scale, y + scale, scale, opts.shadow);
    blit(ctx, text, x, y, scale, color);
    return w;
  }

  function blit(ctx, text, x, y, scale, color) {
    var sheet = sheets[color] || buildSheet(color);
    for (var i = 0; i < text.length; i++) {
      var idx = INDEX[text[i]];
      if (idx === undefined || text[i] === ' ') continue;
      ctx.drawImage(sheet, idx * 8, 0, 8, 8, x + i * 8 * scale, y, 8 * scale, 8 * scale);
    }
  }

  return { draw: draw, width: width, normalize: normalize, setListener: setListener, note: note, GLYPHS: GLYPHS };
})();
