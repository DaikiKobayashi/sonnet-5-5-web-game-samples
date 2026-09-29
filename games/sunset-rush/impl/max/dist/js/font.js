// font_pixel: hand-made 5x7 bitmap font (A-Z, 0-9, symbols). All on-screen text is drawn with this.
// Each glyph = 7 rows of 5 columns ('#' = lit pixel).

const G = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.',
  D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.###.',
  H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '.###./..#../..#../..#../..#../..#../.###.',
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
  0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  1: '..#../.##../..#../..#../..#../..#../.###.',
  2: '.###./#...#/....#/...#./..#../.#.../#####',
  3: '#####/...#./..#../...#./....#/#...#/.###.',
  4: '...#./..##./.#.#./#..#./#####/...#./...#.',
  5: '#####/#..../####./....#/....#/#...#/.###.',
  6: '..##./.#.../#..../####./#...#/#...#/.###.',
  7: '#####/....#/...#./..#../.#.../.#.../.#...',
  8: '.###./#...#/#...#/.###./#...#/#...#/.###.',
  9: '.###./#...#/#...#/.####/....#/...#./.##..',
  '.': '...../...../...../...../...../.##../.##..',
  ',': '...../...../...../...../.##../..#../.#...',
  ':': '...../.##../.##../...../.##../.##../.....',
  '!': '..#../..#../..#../..#../..#../...../..#..',
  '?': '.###./#...#/....#/...#./..#../...../..#..',
  '+': '...../..#../..#../#####/..#../..#../.....',
  '-': '...../...../...../#####/...../...../.....',
  '/': '....#/....#/...#./..#../.#.../#..../#....',
  '%': '##..#/##..#/...#./..#../.#.../#..##/#..##',
  "'": '..#../..#../.#.../...../...../...../.....',
  '[': '.###./.#.../.#.../.#.../.#.../.#.../.###.',
  ']': '.###./...#./...#./...#./...#./...#./.###.',
  '<': '...#./..#../.#.../#..../.#.../..#../...#.',
  '>': '.#.../..#../...#./....#/...#./..#../.#...',
  '=': '...../...../#####/...../#####/...../.....',
  ' ': '...../...../...../...../...../...../.....',
};

export const GLYPH_W = 5;
export const GLYPH_H = 7;
export const ADVANCE = 6; // 5 px glyph + 1 px spacing
export const CHARSET = Object.keys(G).join('');
export const GLYPH_COUNT = CHARSET.length;

export const GLYPHS = {};
for (const ch of CHARSET) GLYPHS[ch] = G[ch].split('/');

export function glyphRows(ch) {
  return GLYPHS[ch] || GLYPHS['?'];
}

export function measure(str, scale) {
  return str.length === 0 ? 0 : (str.length * ADVANCE - 1) * scale;
}

// Draw text into a Px buffer (used to letter the gates etc.). (x, y) = top-left.
export function drawTextPx(px, str, x, y, color, scale = 1) {
  for (let i = 0; i < str.length; i++) {
    const rows = glyphRows(str[i]);
    for (let r = 0; r < GLYPH_H; r++) {
      for (let c = 0; c < GLYPH_W; c++) {
        if (rows[r][c] === '#') px.rect(x + (i * ADVANCE + c) * scale, y + r * scale, scale, scale, color);
      }
    }
  }
}

// ------- canvas text (runtime) -------------------------------------------------
// Glyph atlases are cached per (scale, colour, outline colour). Outlines are baked into each cell.

const atlasCache = new Map();

function outlineWidth(scale) {
  return scale <= 3 ? 1 : scale <= 7 ? 2 : 3;
}

function buildAtlas(scale, color, outlineColor) {
  const o = outlineColor ? outlineWidth(scale) : 0;
  const cellW = ADVANCE * scale + o * 2;
  const cellH = GLYPH_H * scale + o * 2;
  const canvas = document.createElement('canvas');
  canvas.width = cellW * CHARSET.length;
  canvas.height = cellH;
  const g = canvas.getContext('2d');
  for (let i = 0; i < CHARSET.length; i++) {
    const rows = GLYPHS[CHARSET[i]];
    const ox = i * cellW + o;
    if (outlineColor) {
      g.fillStyle = outlineColor;
      for (let r = 0; r < GLYPH_H; r++) {
        for (let c = 0; c < GLYPH_W; c++) {
          if (rows[r][c] === '#') g.fillRect(ox + c * scale - o, o + r * scale - o, scale + o * 2, scale + o * 2);
        }
      }
    }
    g.fillStyle = color;
    for (let r = 0; r < GLYPH_H; r++) {
      for (let c = 0; c < GLYPH_W; c++) {
        if (rows[r][c] === '#') g.fillRect(ox + c * scale, o + r * scale, scale, scale);
      }
    }
  }
  return { canvas, cellW, cellH, o };
}

function getAtlas(scale, color, outlineColor) {
  const key = scale + '|' + color + '|' + (outlineColor || '');
  let a = atlasCache.get(key);
  if (!a) {
    a = buildAtlas(scale, color, outlineColor);
    atlasCache.set(key, a);
  }
  return a;
}

// opts: { scale=1, color='#fff', outline='#000'|null, align='left'|'center'|'right', alpha=1 }
export function drawText(ctx, str, x, y, opts = {}) {
  const scale = Math.max(1, Math.min(8, opts.scale | 0 || 1));
  const color = opts.color || '#ffffff';
  const outline = opts.outline === undefined ? null : opts.outline;
  str = String(str).toUpperCase();
  const atlas = getAtlas(scale, color, outline);
  const w = measure(str, scale);
  let px = x;
  if (opts.align === 'center') px = x - Math.floor(w / 2);
  else if (opts.align === 'right') px = x - w;
  px = Math.round(px);
  const py = Math.round(y);
  const prevAlpha = ctx.globalAlpha;
  if (opts.alpha !== undefined) ctx.globalAlpha = prevAlpha * opts.alpha;
  const { canvas, cellW, cellH, o } = atlas;
  for (let i = 0; i < str.length; i++) {
    let idx = CHARSET.indexOf(str[i]);
    if (idx < 0) idx = CHARSET.indexOf('?');
    if (str[i] === ' ') continue;
    ctx.drawImage(canvas, idx * cellW, 0, cellW, cellH, px + i * ADVANCE * scale - o, py - o, cellW, cellH);
  }
  ctx.globalAlpha = prevAlpha;
  return w;
}

// Glyph sheet as a Px (for the asset gallery): every glyph side by side, 5x7 each.
export function glyphSheetPx(PxClass, color = 0xffffff) {
  const p = new PxClass(GLYPH_W * CHARSET.length, GLYPH_H);
  for (let i = 0; i < CHARSET.length; i++) {
    const rows = GLYPHS[CHARSET[i]];
    for (let r = 0; r < GLYPH_H; r++) for (let c = 0; c < GLYPH_W; c++) if (rows[r][c] === '#') p.set(i * GLYPH_W + c, r, color);
  }
  return p;
}
