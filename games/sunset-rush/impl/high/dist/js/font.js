// 自作ビットマップフォント font_pixel (5x7)。文字はすべてこの字形の拡縮で描く。
const G = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.####/#..../#..../#..../#..../#..../.####',
  D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.####/#..../#..../#..##/#...#/#...#/.###.',
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
  0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  1: '..#../.##../..#../..#../..#../..#../.###.',
  2: '.###./#...#/....#/...#./..#../.#.../#####',
  3: '####./....#/....#/.###./....#/....#/####.',
  4: '...#./..##./.#.#./#..#./#####/...#./...#.',
  5: '#####/#..../####./....#/....#/#...#/.###.',
  6: '.###./#..../#..../####./#...#/#...#/.###.',
  7: '#####/....#/...#./..#../.#.../.#.../.#...',
  8: '.###./#...#/#...#/.###./#...#/#...#/.###.',
  9: '.###./#...#/#...#/.####/....#/....#/.###.',
  '.': '...../...../...../...../...../...../..#..',
  ',': '...../...../...../...../..#../..#../.#...',
  ':': '...../..#../..#../...../..#../..#../.....',
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

export const GLYPH_ORDER = Object.keys(G).filter((k) => k !== ' ').sort((a, b) => order(a) - order(b));
GLYPH_ORDER.push(' ');
function order(k) {
  const s = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:!?+-/%\'[]<>=';
  return s.indexOf(k);
}

export const GLYPH_ROWS = {};
for (const k of Object.keys(G)) GLYPH_ROWS[k] = G[k].split('/');

export const GLYPH_W = 5, GLYPH_H = 7;
const IDX = {};
GLYPH_ORDER.forEach((k, i) => (IDX[k] = i));

let atlasBase = null;
const tinted = new Map();

function buildBase() {
  const c = document.createElement('canvas');
  c.width = GLYPH_ORDER.length * GLYPH_W;
  c.height = GLYPH_H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  GLYPH_ORDER.forEach((k, i) => {
    GLYPH_ROWS[k].forEach((row, y) => {
      for (let x = 0; x < 5; x++) if (row[x] === '#') g.fillRect(i * 5 + x, y, 1, 1);
    });
  });
  return c;
}

export function fontAtlas(color = '#fff') {
  if (!atlasBase) atlasBase = buildBase();
  if (color === '#fff') return atlasBase;
  let t = tinted.get(color);
  if (!t) {
    t = document.createElement('canvas');
    t.width = atlasBase.width;
    t.height = atlasBase.height;
    const g = t.getContext('2d');
    g.drawImage(atlasBase, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, t.width, t.height);
    tinted.set(color, t);
  }
  return t;
}

export function textWidth(str, scale = 1) {
  return str.length ? (str.length * 6 - 1) * scale : 0;
}

function rawText(g, str, x, y, scale, color) {
  const atlas = fontAtlas(color);
  for (let i = 0; i < str.length; i++) {
    let ch = str[i].toUpperCase();
    let idx = IDX[ch];
    if (idx === undefined) idx = IDX[' '];
    if (ch === ' ') continue;
    g.drawImage(atlas, idx * 5, 0, 5, 7, x + i * 6 * scale, y, 5 * scale, 7 * scale);
  }
}

// opts: align('left'|'right'|'center'), outline(色), shadow(色)
export function drawText(g, str, x, y, scale = 1, color = '#fff', opts = {}) {
  str = String(str);
  const w = textWidth(str, scale);
  if (opts.align === 'right') x -= w;
  else if (opts.align === 'center') x -= Math.round(w / 2);
  x = Math.round(x);
  y = Math.round(y);
  const ol = opts.outline === undefined ? '#10081c' : opts.outline;
  if (ol) {
    const d = scale >= 3 ? 2 : 1;
    for (const [dx, dy] of [[-d, 0], [d, 0], [0, -d], [0, d], [-d, -d], [d, -d], [-d, d], [d, d]]) rawText(g, str, x + dx, y + dy, scale, ol);
  }
  if (opts.shadow) rawText(g, str, x + scale, y + scale, scale, opts.shadow);
  rawText(g, str, x, y, scale, color);
}
