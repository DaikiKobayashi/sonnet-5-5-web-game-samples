// アセット登録(すべてコードで生成)。ASSETS[id] = { canvas, frames, fw, fh }
import { mk, rect, dot, ell, blob, frameSheet } from './pix.js';
import { GLYPH_ORDER, fontAtlas, GLYPH_ROWS } from './font.js';
import { hash2 } from './util.js';
import { makePlayerFrames, carSheet } from './sprites_cars.js';
import * as S from './sprites_scenery.js';
import { makeSky, makeFar, makeNear } from './backgrounds.js';

export const ASSETS = {};
export const ASSET_ORDER = [];

function reg(id, canvas, frames, fw, fh) {
  ASSETS[id] = { id, canvas, frames, fw, fh };
  ASSET_ORDER.push(id);
}
const single = (id, canvas) => reg(id, canvas, 1, canvas.width, canvas.height);

// ---- fx ----
function drawSmoke() {
  return frameSheet(4, 12, 12, (g, f) => {
    const r = 3 + f * 1.0;
    const a = [1, 0.85, 0.6, 0.35][f];
    g.globalAlpha = a;
    blob(g, 6, 6.5, r, r, ['#ffffff', '#d8d8e0', '#a8a8b8', '#787890'], 90 + f);
    if (f >= 2) {
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 12 * f; i++) dot(g, Math.floor(hash2(i, f, 3) * 12), Math.floor(hash2(i, f, 4) * 12), '#000');
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 1;
  });
}
function drawDust() {
  return frameSheet(3, 8, 8, (g, f) => {
    for (let i = 0; i < 9 + f * 3; i++) {
      const a = hash2(i, f, 5) * Math.PI * 2, d = 1 + f * 1.2 + hash2(i, f, 6) * 2;
      dot(g, Math.round(4 + Math.cos(a) * d), Math.round(4 + Math.sin(a) * d * 0.8), hash2(i, f, 7) > 0.5 ? '#e0c890' : '#b89a60');
    }
  });
}
function drawSpark() {
  return frameSheet(3, 6, 6, (g, f) => {
    const cols = ['#fff6c0', '#ffc840', '#ff8a30'];
    const c = cols[f];
    if (f === 0) { rect(g, 2, 0, 2, 6, c); rect(g, 0, 2, 6, 2, c); rect(g, 2, 2, 2, 2, '#fff'); }
    else if (f === 1) { rect(g, 2, 1, 2, 4, c); rect(g, 1, 2, 4, 2, c); dot(g, 0, 0, '#ffc840'); dot(g, 5, 5, '#ffc840'); dot(g, 5, 0, '#ff8a30'); dot(g, 0, 5, '#ff8a30'); }
    else { for (const [x, y] of [[0, 1], [5, 1], [1, 5], [4, 4], [2, 0], [3, 3]]) dot(g, x, y, c); }
  });
}

// ---- ロゴ ----
function drawLogo() {
  const W = 256, H = 112;
  const { c, g } = mk(W, H);
  const SC = 6, TH = 1; // 1 セル = 6px、太らせ 2px
  const mask = mk(W, H);
  const put = (str, x0, y0, gap) => {
    const m = mask.g;
    for (let i = 0; i < str.length; i++) {
      const rows = GLYPH_ROWS[str[i]];
      const gx = x0 + i * (5 * SC + TH + gap);
      rows.forEach((r, ry) => {
        for (let rx = 0; rx < 5; rx++) {
          if (r[rx] !== '#') continue;
          const up = ry > 0 && rows[ry - 1][rx] === '#', dn = ry < 6 && rows[ry + 1][rx] === '#';
          const lf = rx > 0 && r[rx - 1] === '#', rt = rx < 4 && r[rx + 1] === '#';
          const x = gx + rx * SC, y = y0 + ry * SC, w = SC + TH, h = SC + TH;
          m.globalCompositeOperation = 'source-over';
          m.fillStyle = '#fff';
          m.fillRect(x, y, w, h);
          m.globalCompositeOperation = 'destination-out';
          if (!up && !lf) m.fillRect(x, y, 2, 2);
          if (!up && !rt) m.fillRect(x + w - 2, y, 2, 2);
          if (!dn && !lf) m.fillRect(x, y + h - 2, 2, 2);
          if (!dn && !rt) m.fillRect(x + w - 2, y + h - 2, 2, 2);
        }
      });
    }
    m.globalCompositeOperation = 'source-over';
  };
  put("SUNSET", 14, 4, 3);
  put("RUSH", 50, 58, 9);
  const md = mask.g.getImageData(0, 0, W, H);
  const dst = new ImageData(W, H);
  for (let y = 0; y < H; y++) {
    const off = Math.round((H - y) * 0.05) - 2;
    for (let x = 0; x < W; x++) {
      const sx = x - off;
      if (sx < 0 || sx >= W) continue;
      const si = (y * W + sx) * 4, di = (y * W + x) * 4;
      dst.data[di + 3] = md.data[si + 3];
    }
  }
  const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && dst.data[(y * W + x) * 4 + 3] > 127;
  // 背後の太陽
  const cx = 128, cy = 62;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    if (dx * dx + dy * dy <= 54 * 54) {
      if (y > 64 && (y - 64) % 6 < (y - 64) / 7) continue;
      const t = y / H;
      dot(g, x, y, t < 0.3 ? '#ffe36a' : t < 0.5 ? '#ffb04a' : t < 0.7 ? '#ff6a6a' : '#c8348a');
    }
  }
  for (const [y, x0, x1] of [[52, 0, 20], [60, 0, 34], [68, 2, 26], [88, 218, 256], [96, 230, 256], [104, 206, 244]]) rect(g, x0, y, x1 - x0, 1, '#ffd0e8');
  // 押し出し + 輪郭
  for (let d = 3; d >= 1; d--) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (on(x - d, y - d)) dot(g, x, y, d > 2 ? '#2a0a3e' : '#4a1258');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (on(x, y)) continue;
    if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) || on(x - 1, y - 1) || on(x + 1, y + 1) || on(x + 1, y - 1) || on(x - 1, y + 1)) dot(g, x, y, '#180830');
  }
  const grad1 = ['#fffbd0', '#ffe66a', '#ffc23a', '#ff8a34', '#ff5a5a', '#ff3a9a', '#d0287e'];
  const grad2 = ['#ffffff', '#c8f4ff', '#7ad8ff', '#5aa8ff', '#8a78ff', '#c860ff', '#ff4aa8'];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!on(x, y)) continue;
    const isTop = y < 54;
    const y0 = isTop ? 2 : 58;
    const t = Math.max(0, Math.min(0.999, (y - y0) / 44));
    const gr = isTop ? grad1 : grad2;
    let col = gr[Math.floor(t * gr.length)];
    if (t > 0.5 && (y - y0) % 4 === 3) col = gr[Math.min(gr.length - 1, Math.floor(t * gr.length) + 1)];
    if (!on(x, y - 1) || !on(x - 1, y)) col = '#ffffff';
    if (!on(x + 1, y) || !on(x, y + 1)) col = isTop ? '#b8306a' : '#4a3ac0';
    dot(g, x, y, col);
  }
  return c;
}

function drawFontSheet() {
  const c = document.createElement('canvas');
  c.width = GLYPH_ORDER.length * 5;
  c.height = 7;
  const g = c.getContext('2d');
  g.drawImage(fontAtlas('#fff'), 0, 0);
  return c;
}

export function initAssets() {
  if (ASSET_ORDER.length) return;
  // 自車 3 種(通常・ブレーキ・走行アニメ)
  reg('car_player', makePlayerFrames(false, 0), 3, 40, 22);
  reg('car_player_brake', makePlayerFrames(true, 0), 3, 40, 22);
  {
    const { c, g } = mk(240, 22);
    g.drawImage(makePlayerFrames(false, 0), 0, 0);
    g.drawImage(makePlayerFrames(false, 1), 120, 0);
    reg('car_player_wheel', c, 6, 40, 22);
  }
  // ブレーキ+走行アニメの合成版(内部用。ギャラリーには出さない)
  ASSETS._player = {
    normal: [makePlayerFrames(false, 0), makePlayerFrames(false, 1)],
    brake: [makePlayerFrames(true, 0), makePlayerFrames(true, 1)],
  };
  for (const type of ['sedan', 'truck', 'sports']) {
    const dims = { sedan: [36, 20], truck: [44, 34], sports: [38, 18] }[type];
    single(`car_${type}`, carSheet(type, 0));
    single(`car_${type}_v1`, carSheet(type, 1));
    single(`car_${type}_v2`, carSheet(type, 2));
    void dims;
  }
  single('rs_palm', S.drawPalm());
  single('rs_rock', S.drawRock());
  single('rs_shrub', S.drawShrub());
  single('rs_billboard', S.drawBillboard());
  single('rs_pine', S.drawPine());
  single('rs_boulder', S.drawBoulder());
  single('rs_fern', S.drawFern());
  single('rs_signpost', S.drawSignpost());
  single('rs_lamp', S.drawLamp());
  single('rs_neon', S.drawNeon());
  single('rs_bollard', S.drawBollard());
  single('rs_building', S.drawBuilding());
  single('rs_building_b', S.drawBuildingB());
  single('gate_checkpoint', S.drawGateCheckpoint());
  single('gate_goal', S.drawGateGoal());
  single('gate_start', S.drawGateStart());
  for (let i = 1; i <= 3; i++) single(`bg_sky_${i}`, makeSky(i));
  for (let i = 1; i <= 3; i++) single(`bg_far_${i}`, makeFar(i));
  for (let i = 1; i <= 3; i++) single(`bg_near_${i}`, makeNear(i));
  single('logo_title', drawLogo());
  reg('font_pixel', drawFontSheet(), GLYPH_ORDER.length, 5, 7);
  reg('fx_smoke', drawSmoke(), 4, 12, 12);
  reg('fx_dust', drawDust(), 3, 8, 8);
  reg('fx_spark', drawSpark(), 3, 6, 6);
  // 夜用のグロー(加算合成用)
  {
    const { c, g } = mk(32, 32);
    for (let r = 15; r >= 1; r--) { g.globalAlpha = 0.07; ell(g, 16, 16, r, r, '#ffffff'); }
    g.globalAlpha = 1;
    ASSETS._glow = { canvas: c, frames: 1, fw: 32, fh: 32 };
  }
}
void blob;
