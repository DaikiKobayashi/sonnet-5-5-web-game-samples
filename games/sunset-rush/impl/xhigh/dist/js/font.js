// 自作ビットマップフォント font_pixel(5x7 グリッド)。画面のテキストはすべてこれで描く。

import { Pix } from './pix.js';

const G = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

export const FONT_CHARS = Object.keys(G).sort((a, b) => {
  // A-Z, 0-9, 記号, 空白の順で並べる
  const order = (ch) => (/[A-Z]/.test(ch) ? 0 : /[0-9]/.test(ch) ? 1 : ch === ' ' ? 3 : 2);
  const oa = order(a); const ob = order(b);
  return oa !== ob ? oa - ob : 0;
});
export const GLYPH_W = 5;
export const GLYPH_H = 7;
export const ADVANCE = 6; // 5px + 字間 1px

// フォントアトラス(白)。グリフ i は x = i * 5
export function buildFontPix() {
  const p = new Pix(FONT_CHARS.length * GLYPH_W, GLYPH_H);
  FONT_CHARS.forEach((ch, gi) => {
    const rows = G[ch];
    for (let y = 0; y < GLYPH_H; y++) {
      for (let x = 0; x < GLYPH_W; x++) {
        if (rows[y][x] === '#') p.set(gi * GLYPH_W + x, y, '#ffffff');
      }
    }
  });
  return p;
}

const INDEX = new Map();
FONT_CHARS.forEach((ch, i) => INDEX.set(ch, i));

let atlasCanvas = null;
const tinted = new Map();

function initAtlas() {
  if (atlasCanvas) return;
  atlasCanvas = buildFontPix().toCanvas();
}

function tintedAtlas(color) {
  initAtlas();
  let cv = tinted.get(color);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = atlasCanvas.width;
    cv.height = atlasCanvas.height;
    const c = cv.getContext('2d');
    c.drawImage(atlasCanvas, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = color;
    c.fillRect(0, 0, cv.width, cv.height);
    tinted.set(color, cv);
  }
  return cv;
}

export function textWidth(str, scale = 1) {
  return str.length === 0 ? 0 : (str.length * ADVANCE - 1) * scale;
}

// opts: { scale, color, outline (色), shadow (色), align: 'left'|'center'|'right', alpha }
export function drawText(ctx, str, x, y, opts = {}) {
  const scale = opts.scale || 1;
  const color = opts.color || '#ffffff';
  const w = textWidth(str, scale);
  let x0 = x;
  if (opts.align === 'center') x0 = Math.round(x - w / 2);
  else if (opts.align === 'right') x0 = x - w;
  x0 = Math.round(x0);
  y = Math.round(y);
  const prevAlpha = ctx.globalAlpha;
  if (opts.alpha !== undefined) ctx.globalAlpha = prevAlpha * opts.alpha;
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;

  const passes = [];
  if (opts.outline) {
    const t = Math.max(1, Math.floor(scale / 3));
    const o = tintedAtlas(opts.outline);
    for (const [dx, dy] of [[-t, 0], [t, 0], [0, -t], [0, t], [-t, -t], [t, -t], [-t, t], [t, t]]) passes.push([o, dx, dy]);
  }
  if (opts.shadow) {
    const t = Math.max(1, Math.round(scale / 2));
    passes.push([tintedAtlas(opts.shadow), t, t]);
  }
  passes.push([tintedAtlas(color), 0, 0]);

  for (const [atlas, dx, dy] of passes) {
    for (let i = 0; i < str.length; i++) {
      const gi = INDEX.get(str[i]);
      if (gi === undefined || str[i] === ' ') continue;
      ctx.drawImage(atlas, gi * GLYPH_W, 0, GLYPH_W, GLYPH_H,
        x0 + i * ADVANCE * scale + dx, y + dy, GLYPH_W * scale, GLYPH_H * scale);
    }
  }
  ctx.imageSmoothingEnabled = prevSmooth;
  ctx.globalAlpha = prevAlpha;
}

// Pix にフォントで文字を焼き込む(スプライトの看板など用)
export function stampText(pix, str, x, y, color, scale = 1) {
  for (let i = 0; i < str.length; i++) {
    const rows = G[str[i]];
    if (!rows) continue;
    for (let gy = 0; gy < GLYPH_H; gy++) {
      for (let gx = 0; gx < GLYPH_W; gx++) {
        if (rows[gy][gx] !== '#') continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            pix.set(x + i * ADVANCE * scale + gx * scale + sx, y + gy * scale + sy, color);
          }
        }
      }
    }
  }
}

// 未知の文字を空白に置き換える(大文字化もする)
export function sanitize(str) {
  return str.toUpperCase().split('').map((ch) => (INDEX.has(ch) ? ch : ' ')).join('');
}
