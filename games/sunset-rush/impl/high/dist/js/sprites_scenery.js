// 路側物・ゲートのドット絵(コードで描画)
import { mk, rect, dot, ell, line, blob } from './pix.js';
import { GLYPH_ROWS } from './font.js';
import { hash2 } from './util.js';

function glyphs(g, str, x, y, s, col) {
  g.fillStyle = col;
  for (let i = 0; i < str.length; i++) {
    const rows = GLYPH_ROWS[str[i]];
    if (!rows) continue;
    rows.forEach((r, ry) => {
      for (let rx = 0; rx < 5; rx++) if (r[rx] === '#') g.fillRect(x + i * 6 * s + rx * s, y + ry * s, s, s);
    });
  }
}

// ---- ステージ 1 ----
export function drawPalm() {
  const { c, g } = mk(40, 72);
  const cx = 21, cy = 22;
  // 幹(ゆるく曲がる)
  for (let y = 71; y >= cy; y--) {
    const t = (71 - y) / (71 - cy);
    const x = 19 + 3.2 * Math.pow(t, 1.6);
    const w = 6 - Math.round(2 * t) + (y > 66 ? 2 : 0);
    const x0 = Math.round(x - w / 2);
    rect(g, x0, y, w, 1, '#9a6a3c');
    rect(g, x0, y, 1 + (w > 5 ? 1 : 0), 1, '#c99760');
    rect(g, x0 + w - 2, y, 2, 1, '#5d3b22');
    if ((71 - y) % 4 === 0) rect(g, x0, y, w, 1, '#6a4527');
  }
  // 葉
  const frond = (ang, len, droop) => {
    for (let i = 0; i <= 44; i++) {
      const t = i / 44;
      const x = cx + Math.cos(ang) * len * t;
      const y = cy + Math.sin(ang) * len * t * 0.5 + droop * len * t * t;
      const th = Math.max(1, Math.round(3 * (1 - t) + 0.6));
      const xi = Math.round(x), yi = Math.round(y);
      rect(g, xi, yi, 1, th, i % 9 < 3 ? '#79d85a' : '#3fa54a');
      dot(g, xi, yi + th, '#1f6a35');
      if (i % 3 === 1 && t > 0.15) {
        const dir = Math.cos(ang) < 0 ? -1 : 1;
        line(g, xi, yi + th, xi + dir, yi + th + 2 + Math.round(2 * (1 - t)), '#2a8540');
      }
    }
  };
  const A = Math.PI;
  frond(A * 1.0, 20, 0.75);
  frond(A * 0.0, 20, 0.75);
  frond(A * 1.18, 19, 0.5);
  frond(A * 1.82, 19, 0.5);
  frond(A * 1.4, 16, 0.2);
  frond(A * 1.6, 16, 0.2);
  frond(A * 0.85, 18, 0.9);
  frond(A * 0.15, 18, 0.9);
  frond(A * 1.5, 12, 0.0);
  // ココナッツ
  ell(g, cx - 2, cy + 3, 2, 2, '#5a3a20');
  ell(g, cx + 2, cy + 3, 2, 2, '#6a4527');
  dot(g, cx - 3, cy + 2, '#9a6a3c');
  return c;
}

export function drawRock() {
  const { c, g } = mk(32, 22);
  rect(g, 2, 19, 28, 3, 'rgba(0,0,0,0.3)');
  blob(g, 15, 13, 14, 9.5, ['#f2e6cf', '#cbb597', '#96806a', '#5f4e42'], 11);
  blob(g, 24, 15, 7, 6, ['#e2d3b8', '#b39d80', '#82705c', '#54463c'], 5);
  line(g, 10, 9, 13, 14, '#4c4036');
  line(g, 13, 14, 12, 18, '#4c4036');
  rect(g, 3, 19, 26, 1, '#3d332c');
  // 波しぶき
  for (const x of [4, 9, 22, 27]) dot(g, x, 20, '#e8f7ff');
  return c;
}

export function drawShrub() {
  const { c, g } = mk(32, 20);
  rect(g, 3, 17, 26, 3, 'rgba(0,0,0,0.25)');
  const pal = ['#a9ec7a', '#5fc46a', '#2f9450', '#1a5c3a'];
  blob(g, 9, 12, 8, 7, pal, 21);
  blob(g, 22, 12, 9, 7, pal, 22);
  blob(g, 16, 8, 10, 8, pal, 23);
  for (const [x, y, col] of [[8, 9, '#ff7ab8'], [14, 5, '#ffe36a'], [21, 8, '#ff7ab8'], [25, 12, '#ffe36a'], [12, 13, '#ffe36a'], [18, 11, '#ff9ad0']]) {
    dot(g, x, y, col); dot(g, x + 1, y, col);
  }
  return c;
}

// ---- ステージ 2 ----
export function drawPine() {
  const { c, g } = mk(40, 88);
  const cx = 20;
  rect(g, 17, 72, 6, 16, '#4d2f24');
  rect(g, 17, 72, 2, 16, '#7a4c36');
  rect(g, 21, 72, 2, 16, '#2e1a17');
  const tiers = 5;
  for (let k = 0; k < tiers; k++) {
    const top = 2 + k * 14, bot = top + 26 + (k === tiers - 1 ? 4 : 0);
    const hw = 8 + k * 3.2;
    for (let y = top; y <= bot; y++) {
      const t = (y - top) / (bot - top);
      let w = t * hw + (hash2(y, k, 3) - 0.5) * 2.2;
      if (y > bot - 3) w -= (y - (bot - 3)) * 0.6;
      w = Math.max(0.5, w);
      const x0 = Math.round(cx - w), x1 = Math.round(cx + w);
      for (let x = x0; x <= x1; x++) {
        const u = (x - cx) / Math.max(1, w);
        let col = u < -0.45 ? '#3b8a63' : u < 0.15 ? '#286b4d' : u < 0.6 ? '#1b4d3d' : '#123a32';
        if (y > bot - 3) col = u < 0 ? '#0f3a30' : '#0a2a26';
        if (hash2(x, y, k + 40) > 0.94 && u < 0) col = '#5fb08a';
        dot(g, x, y, col);
      }
    }
  }
  return c;
}

export function drawBoulder() {
  const { c, g } = mk(40, 28);
  rect(g, 2, 24, 36, 4, 'rgba(0,0,0,0.3)');
  blob(g, 19, 16, 18, 11.5, ['#c9c4dc', '#9c96b8', '#6f6a90', '#463f62'], 31);
  blob(g, 30, 19, 8, 7, ['#b8b2d0', '#8983a6', '#605b80', '#3d3756'], 32);
  // 苔
  for (let y = 5; y < 14; y++) for (let x = 6; x < 30; x++) {
    if (hash2(x, y, 9) > 0.72 && hash2(x >> 2, y >> 1, 4) > 0.45) {
      const nx = (x - 19) / 18, ny = (y - 16) / 11.5;
      if (nx * nx + ny * ny < 0.8) dot(g, x, y, hash2(x, y, 12) > 0.5 ? '#4f9a58' : '#2f6e40');
    }
  }
  line(g, 17, 9, 20, 15, '#332d48');
  line(g, 20, 15, 18, 21, '#332d48');
  rect(g, 4, 25, 32, 1, '#2f2944');
  return c;
}

export function drawFern() {
  const { c, g } = mk(28, 16);
  const bx = 14, by = 15;
  const angs = [-165, -140, -115, -90, -65, -40, -15];
  angs.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180, len = 12 - (i % 2) * 2 + (i === 3 ? 2 : 0);
    let px = bx, py = by;
    for (let s = 0; s < len; s++) {
      const t = s / len;
      const x = bx + Math.cos(a) * s * 1.0 + Math.sin(a) * 0;
      const y = by + Math.sin(a) * s * 0.9 + t * t * 3;
      dot(g, Math.round(x), Math.round(y), '#4fb070');
      if (s > 1) {
        const dir = Math.cos(a) < 0 ? -1 : 1;
        dot(g, Math.round(x) + (s % 2 ? dir : -dir), Math.round(y) + 1, '#2e8a55');
        dot(g, Math.round(x) + (s % 2 ? -dir : dir), Math.round(y), '#79d08f');
      }
      px = x; py = y;
    }
    dot(g, Math.round(px), Math.round(py), '#a9f0b8');
  });
  rect(g, 12, 14, 5, 2, '#1d5a3a');
  return c;
}

// ---- ステージ 3 ----
export function drawLamp() {
  const { c, g } = mk(20, 88);
  rect(g, 6, 82, 8, 6, '#2d3050');
  rect(g, 6, 82, 8, 1, '#6a7095');
  rect(g, 8, 78, 4, 4, '#3a3f66');
  rect(g, 9, 14, 2, 68, '#4a4f78');
  rect(g, 9, 14, 1, 68, '#8c93c0');
  rect(g, 11, 14, 1, 68, '#2a2d4c');
  for (let y = 24; y < 80; y += 14) rect(g, 8, y, 4, 1, '#20233c');
  rect(g, 4, 12, 12, 2, '#3a3f66');
  rect(g, 5, 11, 10, 1, '#8c93c0');
  // ランプ球
  ell(g, 10, 6, 5, 5, '#ffe9a0');
  ell(g, 10, 6, 3.4, 3.4, '#fffbe0');
  rect(g, 5, 1, 10, 2, '#2a2d4c');
  rect(g, 6, 0, 8, 1, '#4a4f78');
  return c;
}

export function drawNeon() {
  const { c, g } = mk(56, 52);
  // ポール
  rect(g, 10, 34, 3, 18, '#3a3f66');
  rect(g, 43, 34, 3, 18, '#3a3f66');
  rect(g, 10, 34, 1, 18, '#7c83b0');
  rect(g, 43, 34, 1, 18, '#7c83b0');
  rect(g, 7, 49, 9, 3, '#2a2d4c');
  rect(g, 40, 49, 9, 3, '#2a2d4c');
  // 看板
  rect(g, 0, 0, 56, 36, '#0b0a22');
  rect(g, 1, 1, 54, 34, '#151238');
  // ネオン枠
  rect(g, 1, 1, 54, 1, '#ff3fc8'); rect(g, 1, 34, 54, 1, '#ff3fc8');
  rect(g, 1, 1, 1, 34, '#ff3fc8'); rect(g, 54, 1, 1, 34, '#ff3fc8');
  rect(g, 3, 3, 50, 1, '#25d0f5'); rect(g, 3, 32, 50, 1, '#25d0f5');
  rect(g, 3, 3, 1, 30, '#25d0f5'); rect(g, 52, 3, 1, 30, '#25d0f5');
  glyphs(g, 'NEON', 5, 6, 2, '#ff6ad8');
  glyphs(g, 'NEON', 5, 5, 2, '#ffd0f4');
  // 矢印
  rect(g, 6, 24, 34, 3, '#25d0f5');
  for (let i = 0; i < 6; i++) rect(g, 40 + i, 21 + i, 1, 9 - i * 2, '#25d0f5');
  rect(g, 6, 24, 34, 1, '#b8f6ff');
  for (const [x, y] of [[48, 8], [49, 9], [50, 8], [48, 10]]) dot(g, x, y, '#ffe36a');
  return c;
}

function windows(g, x0, y0, cols, rows, cw, ch, gx, gy, seed, lit = 0.45, pals = ['#ffd66b', '#7ff3ff', '#ff7ad9', '#fff1b0']) {
  for (let r = 0; r < rows; r++) for (let cc = 0; cc < cols; cc++) {
    const on = hash2(cc, r, seed) < lit;
    const col = on ? pals[Math.floor(hash2(cc, r, seed + 3) * pals.length)] : '#1a1f45';
    rect(g, x0 + cc * gx, y0 + r * gy, cw, ch, col);
    if (on) rect(g, x0 + cc * gx, y0 + r * gy + ch - 1, cw, 1, 'rgba(0,0,0,0.25)');
  }
}

export function drawBuilding() {
  const { c, g } = mk(64, 128);
  rect(g, 4, 10, 56, 118, '#10143a');
  rect(g, 4, 10, 3, 118, '#2b3370');
  rect(g, 57, 10, 3, 118, '#0a0d28');
  rect(g, 4, 10, 56, 2, '#3a4490');
  // 屋上
  rect(g, 12, 4, 14, 6, '#1b2050');
  rect(g, 40, 6, 12, 4, '#1b2050');
  rect(g, 30, 0, 1, 10, '#6a7095');
  dot(g, 30, 0, '#ff3b3b');
  rect(g, 4, 14, 56, 3, '#ff3fc8');
  rect(g, 4, 14, 56, 1, '#ffb0ea');
  windows(g, 10, 22, 6, 12, 6, 4, 8, 8, 5);
  // ネオン縦線
  rect(g, 8, 20, 1, 96, '#25d0f5');
  // 店舗
  rect(g, 4, 118, 56, 10, '#1a1740');
  rect(g, 8, 120, 14, 8, '#ffcf5a');
  rect(g, 26, 120, 10, 8, '#7ff3ff');
  rect(g, 40, 120, 16, 8, '#ff7ad9');
  return c;
}

export function drawBuildingB() {
  const { c, g } = mk(64, 112);
  rect(g, 18, 0, 28, 14, '#161a48');
  rect(g, 18, 0, 3, 14, '#323a80');
  rect(g, 8, 14, 48, 98, '#0f1740');
  rect(g, 8, 14, 3, 98, '#2a4a8a');
  rect(g, 53, 14, 3, 98, '#0a1030');
  rect(g, 8, 14, 48, 2, '#3a5aa8');
  // 縦帯窓
  for (let i = 0; i < 6; i++) {
    const x = 14 + i * 7;
    rect(g, x, 20, 4, 84, hash2(i, 1, 8) > 0.4 ? '#173060' : '#0f1c48');
    for (let y = 22; y < 102; y += 6) {
      if (hash2(i, y, 6) < 0.5) rect(g, x, y, 4, 3, hash2(i, y, 2) > 0.5 ? '#9ff6ff' : '#ffe27a');
    }
  }
  // リング看板
  ell(g, 32, 6, 8, 5, '#25d0f5');
  ell(g, 32, 6, 5.5, 3, '#161a48');
  rect(g, 8, 104, 48, 8, '#ff3fc8');
  rect(g, 8, 104, 48, 1, '#ffd0f4');
  return c;
}

export function drawBillboard() {
  const { c, g } = mk(48, 56);
  rect(g, 10, 34, 4, 22, '#5a5a70');
  rect(g, 34, 34, 4, 22, '#5a5a70');
  rect(g, 10, 34, 1, 22, '#9a9ab5');
  rect(g, 34, 34, 1, 22, '#9a9ab5');
  rect(g, 0, 0, 48, 36, '#2a2540');
  rect(g, 2, 2, 44, 32, '#ffb04a');
  // 夕日イラスト
  for (let y = 2; y < 34; y++) rect(g, 2, y, 44, 1, y < 14 ? '#ff8a5a' : y < 22 ? '#ffb04a' : '#3d9ea8');
  ell(g, 24, 22, 9, 9, '#fff0a0');
  rect(g, 2, 22, 44, 12, '#2f8f9a');
  for (let i = 0; i < 5; i++) rect(g, 6 + i * 8, 24 + (i % 2) * 3, 5, 1, '#8fe8e0');
  glyphs(g, 'SUN', 12, 4, 1, '#fff6d0');
  rect(g, 0, 0, 48, 2, '#8a8aa8');
  rect(g, 0, 34, 48, 2, '#8a8aa8');
  rect(g, 0, 0, 2, 36, '#8a8aa8');
  rect(g, 46, 0, 2, 36, '#8a8aa8');
  return c;
}

export function drawSignpost() {
  const { c, g } = mk(20, 44);
  rect(g, 9, 14, 2, 30, '#8a8fa8');
  rect(g, 9, 14, 1, 30, '#c9cde0');
  rect(g, 6, 41, 8, 3, '#4a4e66');
  // ひし形標識
  for (let y = 0; y < 15; y++) {
    const w = y < 8 ? y : 14 - y;
    rect(g, 10 - w - 1, y, w * 2 + 2, 1, y === 7 ? '#ffd23f' : '#ffd23f');
  }
  for (let y = 2; y < 13; y++) {
    const w = y < 8 ? y - 1 : 13 - y;
    if (w > 0) rect(g, 10 - w, y, w * 2, 1, '#2a2540');
  }
  rect(g, 7, 7, 6, 1, '#ffd23f');
  dot(g, 12, 6, '#ffd23f'); dot(g, 12, 8, '#ffd23f'); dot(g, 13, 7, '#ffd23f');
  return c;
}

export function drawBollard() {
  const { c, g } = mk(12, 16);
  rect(g, 1, 14, 10, 2, 'rgba(0,0,0,0.35)');
  rect(g, 2, 2, 8, 13, '#ffd23f');
  for (let y = 4; y < 14; y += 4) rect(g, 2, y, 8, 2, '#1a1a24');
  rect(g, 2, 2, 2, 13, 'rgba(255,255,255,0.35)');
  rect(g, 8, 2, 2, 13, 'rgba(0,0,0,0.25)');
  rect(g, 3, 0, 6, 2, '#ffe680');
  rect(g, 4, 1, 4, 1, '#ff5548');
  return c;
}

// ---- ゲート 160x64 ----
function gateFrame(g, beamCol, beamHi, beamLo) {
  // 柱
  for (const px of [0, 150]) {
    rect(g, px, 0, 10, 64, '#6a6f8c');
    rect(g, px, 0, 3, 64, '#a9aecb');
    rect(g, px + 7, 0, 3, 64, '#3f4360');
    for (let y = 26; y < 58; y += 8) rect(g, px + 3, y, 4, 1, '#4a4e6c');
    rect(g, px - (px ? 0 : 0), 58, 10, 6, '#3f4360');
    rect(g, px, 58, 10, 1, '#a9aecb');
  }
  // ビーム
  rect(g, 0, 0, 160, 26, beamCol);
  rect(g, 0, 0, 160, 2, beamHi);
  rect(g, 0, 24, 160, 2, beamLo);
  for (let x = 6; x < 160; x += 8) dot(g, x, 25, '#ffe9a0');
}

export function drawGateCheckpoint() {
  const { c, g } = mk(160, 64);
  gateFrame(g, '#22355e', '#5f83c9', '#0f1a33');
  // ハザード帯
  for (const x0 of [12, 132]) {
    rect(g, x0, 4, 16, 18, '#ffd23f');
    for (let i = -20; i < 24; i += 8) line(g, x0 + i, 22, x0 + i + 18, 4, '#1a1a24', 3);
    rect(g, x0 - 1, 3, 18, 1, '#ffd23f');
  }
  // 中身を抜く(帯が枠からはみ出さない範囲にクリップ済みなので、外側を再描画)
  rect(g, 0, 0, 12, 26, '#22355e'); rect(g, 148, 0, 12, 26, '#22355e');
  rect(g, 28, 4, 104, 18, '#0d1630');
  rect(g, 28, 4, 104, 1, '#25d0f5');
  rect(g, 28, 21, 104, 1, '#25d0f5');
  glyphs(g, 'CHECK', 51, 6, 2, '#000000');
  glyphs(g, 'CHECK', 51, 5, 2, '#ffd23f');
  return c;
}

export function drawGateGoal() {
  const { c, g } = mk(160, 64);
  gateFrame(g, '#f4f4f8', '#ffffff', '#9a9ab0');
  for (let y = 0; y < 26; y += 4) for (let x = 0; x < 160; x += 4) {
    if (((x >> 2) + (y >> 2)) % 2 === 0) rect(g, x, y, 4, 4, '#14141c');
  }
  rect(g, 44, 3, 72, 20, '#d8232f');
  rect(g, 44, 3, 72, 1, '#ff7a70');
  rect(g, 44, 22, 72, 1, '#7a0f18');
  glyphs(g, 'GOAL', 50, 6, 2, '#5a0a12');
  glyphs(g, 'GOAL', 50, 5, 2, '#fff8e0');
  for (let x = 6; x < 160; x += 8) dot(g, x, 25, '#ffe9a0');
  return c;
}

export function drawGateStart() {
  const { c, g } = mk(160, 64);
  gateFrame(g, '#2a2a3c', '#6a6a88', '#12121c');
  for (let x = 12; x < 148; x += 16) { rect(g, x, 3, 8, 3, '#d8232f'); rect(g, x + 8, 3, 8, 3, '#f4f4f8'); rect(g, x, 20, 8, 3, '#f4f4f8'); rect(g, x + 8, 20, 8, 3, '#d8232f'); }
  rect(g, 40, 3, 80, 19, '#0f5a3a');
  glyphs(g, 'START', 49, 6, 2, '#000000');
  glyphs(g, 'START', 49, 5, 2, '#7dff9a');
  return c;
}
