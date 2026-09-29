/* titleart.js - title logo (A19) and cave background (A20), drawn on a 2px dot grid */
(function () {
  'use strict';
  const DM = (window.DM = window.DM || {});
  const { Pix, mix, dark, light, mulberry32 } = DM;

  DM.makeLogo = function () {
    const W = 220, H = 60;
    const mask = new Set();
    const lineTop = [];
    function addLine(str, y0) {
      const px = DM.font.glyphMask(str);
      const wFp = str.length * 6 - 1;
      const x0 = Math.floor((W - wFp * 4) / 2);
      const fs = new Set(px.map(([a, b]) => a + ',' + b));
      const F = (a, b) => fs.has(a + ',' + b);
      const put = (fx, fy, i0, j0) => { for (let j = j0; j < j0 + 2; j++) for (let i = i0; i < i0 + 2; i++) mask.add((x0 + fx * 4 + i) + ',' + (y0 + fy * 4 + j)); };
      for (const [fx, fy] of px) {
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) mask.add((x0 + fx * 4 + i) + ',' + (y0 + fy * 4 + j));
        // bridge diagonal-only joins so slanted strokes read as continuous
        if (F(fx + 1, fy + 1) && !F(fx + 1, fy) && !F(fx, fy + 1)) { put(fx + 1, fy, 0, 2); put(fx, fy + 1, 2, 0); }
        if (F(fx - 1, fy + 1) && !F(fx - 1, fy) && !F(fx, fy + 1)) { put(fx - 1, fy, 2, 2); put(fx, fy + 1, 0, 0); }
      }
      lineTop.push(y0);
    }
    addLine('DYNAMITE', 2);
    addLine('MOLE', 31);
    const has = (x, y) => mask.has(x + ',' + y);
    const p = new Pix(W, H), m = new Pix(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!has(x, y)) continue;
      const top = y >= lineTop[1] ? lineTop[1] : lineTop[0];
      const t = (y - top) / 28;
      let c = t < 0.28 ? '#ffe45c' : t < 0.52 ? '#ffb82c' : t < 0.78 ? '#f2701c' : '#d03a16';
      // darken the lower-right inner edge (2 dots) and light the upper-left edge
      if (!has(x + 1, y) || !has(x, y + 1)) c = '#7a1a12';
      else if (!has(x + 2, y) || !has(x, y + 2)) c = dark(c, 0.28);
      if (!has(x - 1, y) || !has(x, y - 1)) c = '#fff6c8';
      else if ((!has(x - 2, y) || !has(x, y - 2)) && t < 0.6) c = light(c, 0.35);
      p.set(x, y, c);
      m.set(x, y, '#ffffff');
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (has(x, y)) continue;
      let near = false;
      for (let j = -1; j <= 1 && !near; j++) for (let i = -1; i <= 1; i++) if (has(x + i, y + j)) { near = true; break; }
      if (near) p.set(x, y, '#2a0e08');
    }
    return { canvas: p.toCanvas(), mask: m.toCanvas() };
  };

  DM.makeTitleBg = function () {
    const W = 240, H = 208;
    const p = new Pix(W, H), r = mulberry32(2024);
    // value noise helpers
    const g1 = [], g2 = [];
    for (let i = 0; i < 40 * 40; i++) { g1.push(r()); g2.push(r()); }
    const vn = (g, x, y, s) => {
      const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const a = g[(iy % 40) * 40 + (ix % 40)], b = g[(iy % 40) * 40 + ((ix + 1) % 40)], c = g[((iy + 1) % 40) * 40 + (ix % 40)], d = g[((iy + 1) % 40) * 40 + ((ix + 1) % 40)];
      return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = vn(g1, x, y, 12) * 0.6 + vn(g2, x, y, 5) * 0.4;
      const base = mix('#0a0816', '#2a1c34', Math.min(1, y / 150));
      let c = mix(base, '#4a3452', n * 0.55);
      const d = Math.hypot((x - 120) / 130, (y - 95) / 100);
      c = mix(c, '#5c3c48', Math.max(0, 0.42 - d * 0.42));
      if (((x + y) & 1) === 0 && r() < 0.04) c = dark(c, 0.25);
      p.set(x, y, c);
    }
    // stalactites
    for (let i = 0; i < 26; i++) {
      const cx = Math.floor(r() * W), len = 10 + Math.floor(r() * 30), wd = 4 + Math.floor(r() * 8);
      for (let y = 0; y < len; y++) {
        const half = Math.max(0, Math.round((wd / 2) * (1 - y / len)));
        for (let x = -half; x <= half; x++) {
          const c = x <= -half + 0 && half > 1 ? '#3a2a44' : x >= half && half > 1 ? '#0a0612' : '#1a1226';
          p.set(cx + x, y, c);
        }
      }
    }
    // ground with rock texture
    for (let y = 168; y < H; y++) for (let x = 0; x < W; x++) {
      const n = vn(g2, x, y, 6);
      let c = mix('#2e2028', '#4a3438', n * 0.8);
      if (y === 168) c = '#6a4c48'; else if (y === 169) c = '#3c2a30';
      if (r() < 0.05) c = dark(c, 0.35);
      p.set(x, y, c);
    }
    // crystal clusters
    const crystal = (cx, by, h, col) => {
      for (let k = -1; k <= 1; k++) {
        const hh = h - Math.abs(k) * 5, x = cx + k * 5;
        p.tri(x - 2, by, x + 2, by, x, by - hh, col);
        p.tri(x - 2, by, x, by, x, by - hh, light(col, 0.35));
        p.set(x, by - hh, '#ffffff'); p.set(x, by - hh + 1, light(col, 0.7));
      }
    };
    crystal(20, 178, 24, '#3aa8e8'); crystal(214, 180, 20, '#d04ec0'); crystal(196, 172, 14, '#40e0c8'); crystal(38, 172, 12, '#b058e8');
    // timber frame (mine entrance)
    const wood = (x, y, w, h, horiz) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const a = horiz ? j : i, n = horiz ? h : w;
        let c = a === 0 ? '#a26a34' : a === n - 1 ? '#2e1a0c' : a < 2 ? '#8a5a2c' : '#6b4423';
        if (r() < 0.06) c = '#4a2c14';
        p.set(x + i, y + j, c);
      }
    };
    wood(4, 14, 8, 160, false); wood(228, 14, 8, 160, false); wood(2, 8, 236, 8, true);
    p.line(12, 40, 30, 16, '#4a2c14'); p.line(12, 41, 30, 17, '#6b4423'); p.line(228, 40, 210, 16, '#4a2c14'); p.line(228, 41, 210, 17, '#6b4423');
    for (const y of [60, 100, 140]) { p.rect(4, y, 8, 2, '#3a3a44'); p.rect(228, y, 8, 2, '#3a3a44'); p.set(6, y, '#b8b8c8'); p.set(233, y, '#b8b8c8'); }
    // rails
    for (let x = 14; x < 226; x += 12) p.rect(x, 190, 8, 3, '#4a2c14');
    p.rect(12, 189, 216, 1, '#8a8a96'); p.rect(12, 193, 216, 1, '#5a5a66');
    return p.toCanvas();
  };
})();
