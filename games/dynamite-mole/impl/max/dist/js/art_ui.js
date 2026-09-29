/* art_ui.js - HUD panel (A21), title logo (A19), title background + hero illustration (A20),
 * touch button faces (A23) and the favicon (A22). Procedural, 1px art dots. */
(function (root) {
  'use strict';
  var DM = root.DM = root.DM || {};
  var Pix = DM.Pix, U = DM.ArtUtil, hex = Pix.hex, ramp = Pix.ramp, OL = U.OL, part = U.part, mix = Pix.mix;
  var hash2 = DM.hash2;

  function shade(c, k) {
    var u = Pix.unpack(c);
    function f(v) { return Math.max(0, Math.min(255, Math.round(v * k))); }
    return Pix.pack(f(u[0]), f(u[1]), f(u[2]), u[3]);
  }
  function vnoise(x, y, seed) {
    var x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed), c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
    var top = a + (b - a) * fx, bot = c + (d - c) * fx;
    return top + (bot - top) * fy;
  }

  /* ------------------------------------------------------------------ HUD panel (A21) */
  function makeHudBg() {
    var p = new Pix(480, 64);
    var tones = ['#2d2437', '#342a43', '#3c314b', '#271f30'].map(function (h) { return hex(h); });
    var mortar = hex('#191220');
    p.fill(mortar);
    for (var r = 0; r < 7; r++) {
      var off = (r % 2) * 12;
      for (var bx = -12; bx < 480; bx += 24) {
        var x0 = bx + off, y0 = r * 10;
        var base = tones[Math.floor(hash2(x0, y0, 3) * 4)];
        for (var y = 1; y < 10; y++) for (var x = 1; x < 24; x++) {
          var c = base, n = hash2(x0 + x, y0 + y, 6);
          if (n < 0.07) c = shade(base, 1.14); else if (n > 0.94) c = shade(base, 0.86);
          if (y === 1) c = shade(base, 1.24); else if (y === 9) c = shade(base, 0.76);
          if (x === 1) c = shade(c, 1.1); else if (x === 23) c = shade(c, 0.84);
          p.set(x0 + x, y0 + y, c);
        }
      }
    }
    function inset(x, y, w, h) {
      p.rrect(x - 1, y - 1, w + 2, h + 2, 4, hex('#07040a'));
      p.rrect(x, y, w, h, 3, hex('#130d1b'));
      p.hline(x + 3, y + h, w - 6, hex('#5a4a72'));
      p.hline(x + 3, y - 1, w - 6, hex('#050307'));
      for (var i = 0; i < w; i += 2) p.set(x + i, y + 1, hex('#1a1224'));
    }
    inset(8, 5, 464, 26);
    inset(8, 34, 464, 24);
    /* gold trim along the bottom edge */
    var trim = ['#f6d27a', '#d2a040', '#a8701e', '#6a4014', '#1a0f08'];
    for (var t = 0; t < 5; t++) p.hline(0, 59 + t, 480, hex(trim[t]));
    for (var rx = 6; rx < 480; rx += 48) { p.set(rx, 61, hex('#fff0b8')); p.set(rx + 1, 61, hex('#c8923c')); }
    /* corner rivets */
    [[3, 3], [476, 3], [3, 55], [476, 55]].forEach(function (r) { p.set(r[0], r[1], hex('#c8cede')); p.set(r[0] + 1, r[1] + 1, hex('#454a5c')); });
    return p.toCanvas();
  }

  /* ------------------------------------------------------------------ title logo (A19) */
  function logoMask(str, s, gap) {
    var bmp = DM.Font.bitmap(str, gap);
    var pad = 1, w = bmp[0].length + pad * 2, h = 7 + pad * 2;
    var src = [];
    for (var y = 0; y < h; y++) { src.push([]); for (var x = 0; x < w; x++) src[y].push((y >= pad && y < h - pad && x >= pad && x < w - pad) ? bmp[y - pad][x - pad] : 0); }
    var W = w * s, H = h * s, out = new Uint8Array(W * H);
    function sv(cx, cy) { cx = Math.max(0, Math.min(w - 1, cx)); cy = Math.max(0, Math.min(h - 1, cy)); return src[cy][cx]; }
    for (var oy = 0; oy < H; oy++) {
      for (var ox = 0; ox < W; ox++) {
        var u = (ox + 0.5) / s - 0.5, v = (oy + 0.5) / s - 0.5;
        var x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
        var val = (sv(x0, y0) * (1 - fx) + sv(x0 + 1, y0) * fx) * (1 - fy) + (sv(x0, y0 + 1) * (1 - fx) + sv(x0 + 1, y0 + 1) * fx) * fy;
        out[oy * W + ox] = val >= 0.46 ? 1 : 0;
      }
    }
    return { w: W, h: H, d: out, pad: pad * s, cols: bmp[0].length };
  }
  function distField(m, maxD) {
    var W = m.w, H = m.h, d = new Uint8Array(W * H), i, x, y;
    for (i = 0; i < W * H; i++) d[i] = m.d[i] ? maxD : 0;
    for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) { i = y * W + x; if (d[i]) d[i] = Math.min(d[i], d[i - 1] + 1, d[i - W] + 1); }
    for (y = H - 2; y > 0; y--) for (x = W - 2; x > 0; x--) { i = y * W + x; if (d[i]) d[i] = Math.min(d[i], d[i + 1] + 1, d[i + W] + 1); }
    return d;
  }

  function drawLogoLine(p, str, s, gap, ox, oy, pal) {
    var m = logoMask(str, s, gap), W = m.w, H = m.h;
    var dist = distField(m, 9);
    var top = pal.grad[0], n = pal.grad.length;
    /* find glyph vertical extents for the gradient */
    var y0 = m.pad, y1 = H - m.pad;
    var x, y, i;
    /* drop shadow + outline first */
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      if (!m.d[y * W + x]) continue;
      for (var k = 1; k <= 4; k++) p.over(ox + x + 2, oy + y + 2 + k, hex('#05020a', 0.16));
    }
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      if (!m.d[y * W + x]) continue;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
        if (dx * dx + dy * dy > 5) continue;
        var q = p.get(ox + x + dx, oy + y + dy);
        if (!q || Pix.alphaOf(q) < 255 || q === hex('#05020a', 0.16)) p.set(ox + x + dx, oy + y + dy, hex('#1a0d22'));
      }
    }
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        i = y * W + x;
        if (!m.d[i]) continue;
        var t = Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
        var gi = t * (n - 1), g0 = Math.floor(gi), g1 = Math.min(n - 1, g0 + 1);
        var c = mix(pal.grad[g0], pal.grad[g1], gi - g0);
        var dd = dist[i];
        /* bevel: light from the upper-left */
        var ul = !m.d[(y - 1) * W + (x - 1)] || !m.d[(y - 1) * W + x] || !m.d[y * W + (x - 1)];
        var lr = !m.d[(y + 1) * W + (x + 1)] || !m.d[(y + 1) * W + x] || !m.d[y * W + (x + 1)];
        if (dd <= 2 && ul && !lr) c = pal.hi;
        else if (dd <= 2 && lr && !ul) c = pal.lo;
        else if (dd <= 4 && lr) c = shade(c, 0.86);
        else if (dd <= 4 && ul) c = shade(c, 1.1);
        if (((x + y) & 1) === 0 && dd > 4 && hash2(x >> 1, y >> 1, 4) < 0.16) c = shade(c, 1.07);
        p.set(ox + x, oy + y, c);
      }
    }
    return m;
  }

  function bigStick(p, x, y, h, spark) {
    var R = ramp(['#7a1418', '#b02222', '#e23a2e', '#ff7a66']), w = 18;
    part(p, function (l) { l.rrect(x, y, w, h, 4, R[2]); }, OL);
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
      var cx = i / (w - 1), c = cx < 0.18 ? R[3] : cx < 0.5 ? R[2] : cx < 0.8 ? R[1] : R[0];
      if (Pix.alphaOf(p.get(x + i, y + j))) p.set(x + i, y + j, c);
    }
    p.ell(x + w / 2, y + 3, w / 2 - 0.5, 3, hex('#ffb6a6')); p.ell(x + w / 2, y + 3, w / 2 - 4, 1.6, hex('#ffe4dc'));
    p.rect(x, y + h * 0.42, w, 6, hex('#23202b')); p.hline(x, y + h * 0.42, w, hex('#4a4656')); p.hline(x, y + h * 0.42 + 5, w, hex('#100e15'));
    p.rect(x + 3, y + h * 0.42 + 8, w - 6, 10, hex('#f6eedc')); p.hline(x + 3, y + h * 0.42 + 8, w - 6, hex('#ffffff')); p.hline(x + 3, y + h * 0.42 + 17, w - 6, hex('#c8bea8'));
    for (var k = 0; k < 3; k++) { p.set(x + 6 + k * 3, y + h * 0.42 + 11, hex('#c8202a')); p.set(x + 7 + k * 3, y + h * 0.42 + 12, hex('#c8202a')); p.set(x + 6 + k * 3, y + h * 0.42 + 13, hex('#c8202a')); }
    p.outline(OL);
    /* fuse */
    var fx = x + w / 2, fy = y + 1;
    var FU = hex('#6b4a2a'), FL = hex('#c49a62');
    p.line(fx, fy, fx, fy - 4, FU); p.line(fx, fy - 4, fx + 3, fy - 7, FL); p.line(fx + 3, fy - 7, fx + 3, fy - 10, FU);
    if (spark) {
      var sx = fx + 3, sy = fy - 12;
      p.set(sx, sy, hex('#ffffff')); p.set(sx - 1, sy, hex('#ffd23f')); p.set(sx + 1, sy, hex('#ffd23f')); p.set(sx, sy - 1, hex('#ffd23f')); p.set(sx, sy + 1, hex('#ff8a1a'));
      p.set(sx - 2, sy - 2, hex('#ffb040')); p.set(sx + 2, sy - 2, hex('#ff8a1a')); p.set(sx + 2, sy + 1, hex('#ffb040')); p.set(sx - 3, sy + 1, hex('#ff8a1a'));
    }
  }

  function makeLogo() {
    var p = new Pix(440, 120);
    var pal1 = { grad: [hex('#fff4a8'), hex('#ffd23a'), hex('#ff9420'), hex('#e8401a'), hex('#b8280f')], hi: hex('#fffbe0'), lo: hex('#7a1c0e') };
    var pal2 = { grad: [hex('#fff0a0'), hex('#ffcf3a'), hex('#e69a10'), hex('#a8600a')], hi: hex('#fffbe0'), lo: hex('#6a3c06') };
    var s = 7;
    var m1 = logoMask('DYNAMITE', s, 2), m2 = logoMask('MOLE', s, 2);
    var x1 = Math.round((440 - (m1.w - 2 * m1.pad)) / 2) - m1.pad, y1 = 9 - m1.pad;
    drawLogoLine(p, 'DYNAMITE', s, 2, x1, y1, pal1);
    var x2 = Math.round((440 - (m2.w - 2 * m2.pad)) / 2) - m2.pad, y2 = 61 - m2.pad;
    drawLogoLine(p, 'MOLE', s, 2, x2, y2, pal2);
    /* dynamite sticks flanking MOLE */
    var mw = m2.w - 2 * m2.pad, lx = Math.round((440 - mw) / 2);
    bigStick(p, lx - 46, 66, 46, false);
    bigStick(p, lx + mw + 28, 66, 46, true);
    /* spark on the I of DYNAMITE: position of the 'I' glyph (index 5) */
    var widths = { D: 5, Y: 5, N: 5, A: 5, M: 5, I: 3, T: 5, E: 5 }, str = 'DYNAMITE', acc = 0;
    for (var i = 0; i < 5; i++) acc += widths[str[i]] + 2;
    var ix = x1 + m1.pad + (acc + 1.5) * s;
    return { canvas: p.toCanvas(), pix: p, fuse: [Math.round(ix), 9], sparkX: Math.round(x2 + m2.pad + mw + 28 + 9 + 3) };
  }

  /* ------------------------------------------------------------------ hero illustration for the title */
  function makeHero() {
    var C = DM.ArtChars;
    var frames = [
      C.drawMole({ dir: 'down', k: 2, bob: 0 }).toCanvas(),
      C.drawMole({ dir: 'down', k: 2, hy: 1 }).toCanvas(),
      C.drawMole({ dir: 'down', k: 2, hy: 0, eyes: 'happy' }).toCanvas()
    ];
    return frames;
  }
  function makeBigBundle() {
    var p = new Pix(64, 64);
    p.ellOver(32, 58, 24, 4.6, hex('#05030a', 0.4));
    var R = ramp(['#7a1418', '#b02222', '#e23a2e', '#ff7a66']);
    function stick(x0, y0, w, h) {
      part(p, function (l) { l.rrect(x0, y0, w, h, 4, R[2]); }, OL);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var cx = x / (w - 1), c = cx < 0.18 ? R[3] : cx < 0.5 ? R[2] : cx < 0.82 ? R[1] : R[0];
        if (Pix.alphaOf(p.get(x0 + x, y0 + y))) p.set(x0 + x, y0 + y, c);
      }
      p.ell(x0 + w / 2, y0 + 3, w / 2 - 0.5, 3, hex('#ffb6a6')); p.ell(x0 + w / 2, y0 + 3, w / 2 - 3.5, 1.4, hex('#ffe4dc'));
    }
    stick(8, 20, 16, 34); stick(40, 20, 16, 34); stick(24, 24, 16, 34);
    p.rect(8, 38, 48, 6, hex('#23202b')); p.hline(8, 38, 48, hex('#4a4656')); p.hline(8, 43, 48, hex('#100e15'));
    p.rect(26, 45, 12, 9, hex('#f6eedc')); p.hline(26, 45, 12, hex('#ffffff')); p.hline(26, 53, 12, hex('#c8bea8'));
    for (var k = 0; k < 3; k++) { p.set(28 + k * 3, 47, hex('#c8202a')); p.set(29 + k * 3, 48, hex('#c8202a')); p.set(28 + k * 3, 49, hex('#c8202a')); }
    p.outline(OL);
    var FU = hex('#6b4a2a'), FL = hex('#c49a62');
    p.line(32, 24, 32, 19, FU); p.line(32, 19, 36, 15, FL); p.line(36, 15, 36, 10, FU); p.line(36, 10, 39, 7, FL);
    return p.toCanvas();
  }

  /* ------------------------------------------------------------------ title background layers (A20) */
  function bayer(x, y) { return [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]][y & 3][x & 3] / 16; }

  function makeTitleFar() {
    var W = 560, H = 416, p = new Pix(W, H), x, y;
    var bands = ['#120a24', '#180d2e', '#1f1238', '#281844', '#321f52', '#3d2860'].map(function (h) { return hex(h); });
    for (y = 0; y < H; y++) {
      var t = y / H * (bands.length - 1), b0 = Math.floor(t), fr = t - b0;
      for (x = 0; x < W; x++) p.set(x, y, fr > bayer(x, y) && b0 + 1 < bands.length ? bands[b0 + 1] : bands[b0]);
    }
    /* soft coloured glows (distant crystals) */
    [[80, 250, 46, '#39d4ff'], [200, 170, 36, '#ff5fc8'], [360, 230, 52, '#7a5cff'], [470, 150, 38, '#39d4ff'], [140, 330, 40, '#ff5fc8'], [300, 320, 44, '#39ffc0']].forEach(function (g) {
      for (var k = 0; k < 7; k++) p.ellOver(g[0], g[1], g[2] * (1 - k * 0.13), g[2] * 0.75 * (1 - k * 0.13), hex(g[3], 0.05));
    });
    /* far stalactites */
    for (x = 0; x < W; x++) {
      var len = Math.max(0, (vnoise(x / 22, 3, 11) - 0.35) * 150) + Math.max(0, (vnoise(x / 7, 1, 12) - 0.6) * 60);
      for (y = 0; y < len; y++) p.set(x, y, y > len - 2 ? hex('#3a2570') : hex(y > len - 5 ? '#170c2c' : '#0f0820'));
    }
    /* far stalagmites */
    for (x = 0; x < W; x++) {
      var hgt = Math.max(0, (vnoise(x / 26, 8, 13) - 0.42) * 120) + 30;
      for (y = 0; y < hgt; y++) p.set(x, H - 1 - y, y > hgt - 2 ? hex('#3f2a72') : hex(y > hgt - 6 ? '#1b1036' : '#130a26'));
    }
    /* dust sparkles */
    for (var i = 0; i < 90; i++) { var sx = hash2(i, 1, 51) * W, sy = 30 + hash2(i, 2, 51) * 330; p.set(sx, sy, hex(i % 3 ? '#9c8ce8' : '#e8e0ff', 0.55 + hash2(i, 3, 51) * 0.4)); }
    return p.toCanvas();
  }

  function crystalCluster(p, cx, base, scale, cols) {
    var C = ramp(cols);
    function prism(x, h, w) {
      var top = base - h;
      p.poly([[x - w, base], [x - w * 0.8, top + h * 0.25], [x, top], [x + w * 0.8, top + h * 0.25], [x + w, base]], C[1]);
      p.poly([[x, top], [x + w * 0.8, top + h * 0.25], [x + w, base], [x, base]], C[2]);
      p.poly([[x - w, base], [x - w * 0.8, top + h * 0.25], [x, top], [x - w * 0.3, base]], C[3]);
      p.set(x - w * 0.4, top + h * 0.3, hex('#ffffff'));
      p.line(x, top, x, base, C[0]);
    }
    prism(cx - 8 * scale, 30 * scale, 5 * scale);
    prism(cx, 46 * scale, 6.5 * scale);
    prism(cx + 9 * scale, 24 * scale, 4.5 * scale);
  }
  function lantern(p, x, y, chainLen) {
    var i;
    for (i = 0; i < chainLen; i++) if (i % 3 !== 2) p.set(x, y - chainLen + i, hex(i % 2 ? '#8a8aa0' : '#4a4a5c'));
    part(p, function (l) {
      l.rrect(x - 6, y, 13, 3, 1, hex('#6a5030'));
      l.rrect(x - 5, y + 3, 11, 15, 2, hex('#ffcf5a'));
      l.rrect(x - 6, y + 18, 13, 3, 1, hex('#6a5030'));
    }, OL);
    p.rect(x - 4, y + 4, 9, 13, hex('#ffb83a')); p.rect(x - 3, y + 6, 7, 9, hex('#ffe070')); p.rect(x - 1, y + 8, 3, 5, hex('#fffbe0'));
    p.vline(x - 5, y + 3, 15, hex('#4a3820')); p.vline(x + 5, y + 3, 15, hex('#4a3820'));
    p.set(x, y - 1, hex('#8a8aa0'));
  }
  function mushroom(p, x, y, s, capHex) {
    p.rect(x, y, Math.max(1, s / 2), s * 1.2, hex('#d8ccbc'));
    part(p, function (l) { l.ellShade(x + s / 4, y, s * 1.6, s, ramp([shadeHex(capHex, 0.5), shadeHex(capHex, 0.8), capHex, shadeHex(capHex, 1.3)]), { clipBottom: y + 1 }); }, OL);
    p.set(x - s * 0.4, y - s * 0.4, hex('#ffffff', 0.8));
  }
  function shadeHex(h, k) {
    var u = Pix.unpack(hex(h));
    function f(v) { return Math.max(0, Math.min(255, Math.round(v * k))); }
    var c = (1 << 24) | (f(u[0]) << 16) | (f(u[1]) << 8) | f(u[2]);
    return '#' + c.toString(16).slice(1);
  }

  function makeTitleMid() {
    var W = 560, H = 416, p = new Pix(W, H), x, y;
    var rock = ramp(['#1e1230', '#2b1a44', '#3a2560', '#4d3480']);
    function wall(side) {
      for (y = 0; y < H; y++) {
        var wd = 78 + vnoise(y / 34, side * 7 + 2, 21) * 58 + (y > 300 ? (y - 300) * 0.45 : 0);
        for (var d = 0; d < wd; d++) {
          x = side === 0 ? 40 + d : W - 41 - d;
          var edge = wd - d;
          var c = edge < 2 ? rock[3] : edge < 5 ? rock[2] : edge < 14 ? rock[1] : rock[0];
          if (hash2(x, y, 60) < 0.05) c = shade(c, 1.15);
          p.set(x, y, c);
        }
      }
    }
    wall(0); wall(1);
    /* crystals on the inner edges */
    crystalCluster(p, 40 + 92, 246, 1.05, ['#0a5a8a', '#2ab4f0', '#7fe0ff', '#d8f8ff']);
    crystalCluster(p, W - 41 - 96, 292, 0.9, ['#8a1a72', '#e84cc0', '#ff9ae4', '#ffe0f6']);
    crystalCluster(p, 40 + 90, 150, 0.6, ['#0a5a8a', '#2ab4f0', '#7fe0ff', '#d8f8ff']);
    /* mushrooms near the floor */
    mushroom(p, 40 + 84, 356, 4, '#39d4ff'); mushroom(p, 40 + 97, 361, 3, '#ff8fe0'); mushroom(p, W - 41 - 92, 352, 4, '#ff8fe0'); mushroom(p, W - 41 - 105, 358, 3, '#39ffc0');
    return p.toCanvas();
  }

  function timber(p, x, y, w, h, vertical) {
    var WD = ramp(['#4a2c14', '#6e4220', '#946030', '#b98444']);
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
      var t = vertical ? i / (w - 1) : j / (h - 1);
      var c = t < 0.15 ? WD[3] : t < 0.6 ? WD[2] : t < 0.85 ? WD[1] : WD[0];
      var n = hash2(vertical ? i : i >> 2, vertical ? j >> 2 : j, 71);
      if (n < 0.1) c = shade(c, 1.12); else if (n > 0.9) c = shade(c, 0.82);
      p.set(x + i, y + j, c);
    }
  }
  function makeTitleNear() {
    var W = 560, H = 416, p = new Pix(W, H), x, y;
    /* ground */
    var gnd = ramp(['#1c120c', '#2c1c12', '#40281a', '#5a3a26']);
    for (x = 0; x < W; x++) {
      var gt = 378 + (vnoise(x / 20, 4, 81) - 0.5) * 14;
      for (y = Math.floor(gt); y < H; y++) {
        var d = y - gt;
        var c = d < 2 ? gnd[3] : d < 6 ? gnd[2] : d < 16 ? gnd[1] : gnd[0];
        if (hash2(x, y, 82) < 0.06) c = shade(c, 1.2);
        p.set(x, y, c);
      }
    }
    /* rails + sleepers */
    for (x = 0; x < W; x += 22) { timber(p, x + 3, 392, 14, 6, false); }
    p.hline(0, 393, W, hex('#9aa2b4')); p.hline(0, 394, W, hex('#5a6072')); p.hline(0, 401, W, hex('#9aa2b4')); p.hline(0, 402, W, hex('#5a6072'));
    /* timber frame */
    timber(p, 40, 0, 26, H, true); timber(p, W - 66, 0, 26, H, true);
    timber(p, 40, 0, W - 80, 26, false);
    p.vline(40, 0, H, hex('#2a170b')); p.vline(65, 0, H, hex('#2a170b')); p.vline(W - 66, 0, H, hex('#2a170b')); p.vline(W - 41, 0, H, hex('#2a170b'));
    p.hline(40, 26, W - 80, hex('#2a170b')); p.hline(40, 27, W - 80, hex('#150b05', 0.6));
    /* diagonal braces */
    for (var b = 0; b < 30; b++) { p.rect(66 + b, 27 + b, 6, 1, hex('#6e4220')); p.rect(W - 67 - b - 5, 27 + b, 6, 1, hex('#6e4220')); }
    /* iron bolts / straps */
    [[46, 60], [46, 140], [46, 250], [W - 60, 90], [W - 60, 200], [W - 60, 300]].forEach(function (r) {
      p.rect(r[0] - 2, r[1], 14, 8, hex('#5a6072')); p.hline(r[0] - 2, r[1], 14, hex('#9aa2b4')); p.hline(r[0] - 2, r[1] + 7, 14, hex('#2c3040'));
      p.set(r[0], r[1] + 3, hex('#c8cede')); p.set(r[0] + 9, r[1] + 3, hex('#c8cede'));
    });
    [[130, 6], [230, 6], [330, 6], [430, 6]].forEach(function (r) { p.set(r[0], r[1] + 10, hex('#c8cede')); p.set(r[0] + 1, r[1] + 11, hex('#454a5c')); });
    /* iron wall brackets with short-chain lanterns (they light the posts) */
    function bracket(x0, dir) {
      var xa = dir > 0 ? x0 : x0 - 26;
      p.rect(xa, 148, 26, 3, hex('#6a7084')); p.hline(xa, 148, 26, hex('#aab2c4')); p.hline(xa, 150, 26, hex('#2c3040'));
      p.rect(dir > 0 ? xa + 22 : xa, 150, 4, 3, hex('#4a4f60'));
      p.set(dir > 0 ? xa + 2 : xa + 23, 149, hex('#e8ecf6'));
    }
    bracket(66, 1); bracket(W - 66, -1);
    lantern(p, 88, 158, 7); lantern(p, W - 88, 158, 7);
    /* props: TNT crate with a pickaxe, and a barrel, resting beside the posts */
    var cx0 = 74, red = hex('#c8202a'), bx0 = W - 41 - 64;
    part(p, function (l) { l.rect(cx0, 348, 30, 26, hex('#a8703a')); }, OL);
    timber(p, cx0 + 1, 349, 28, 24, false);
    p.hline(cx0 + 1, 355, 28, hex('#5a3818')); p.hline(cx0 + 1, 366, 28, hex('#5a3818'));
    p.rect(cx0 + 8, 358, 14, 6, hex('#f6eedc')); p.hline(cx0 + 8, 358, 14, hex('#ffffff'));
    for (var k = 0; k < 3; k++) { p.set(cx0 + 10 + k * 4, 360, red); p.set(cx0 + 11 + k * 4, 361, red); p.set(cx0 + 10 + k * 4, 362, red); }
    p.line(cx0 - 5, 372, cx0 + 19, 328, hex('#8a5a2c')); p.line(cx0 - 4, 372, cx0 + 20, 328, hex('#5e3a18'));
    p.poly([[cx0 + 11, 326], [cx0 + 31, 328], [cx0 + 26, 334], [cx0 + 19, 332], [cx0 + 7, 338], [cx0 + 9, 330]], hex('#9aa2b4'));
    p.hline(cx0 + 11, 327, 20, hex('#d8deea'));
    part(p, function (l) { l.rrect(bx0, 350, 22, 26, 4, hex('#7a4a22')); }, OL);
    for (y = 352; y < 375; y++) for (x = bx0 + 1; x < bx0 + 21; x++) p.set(x, y, x < bx0 + 6 ? hex('#a8703a') : x < bx0 + 14 ? hex('#8a5a2c') : hex('#5e3a18'));
    p.hline(bx0, 356, 22, hex('#5a6072')); p.hline(bx0, 368, 22, hex('#5a6072'));
    /* dark stone rubble on the ground */
    for (var r = 0; r < 14; r++) { var rx = hash2(r, 1, 90) * W, rs = 3 + hash2(r, 2, 90) * 6; p.ell(rx, 384 + hash2(r, 3, 90) * 10, rs, rs * 0.6, hex(r % 2 ? '#3a2a22' : '#4d372a')); }
    return p.toCanvas();
  }

  /* ------------------------------------------------------------------ touch buttons (A23) */
  function makeTouchPad(dir, pressed) {
    var p = new Pix(36, 36);
    var body = pressed ? ['#57497a', '#3c3160'] : ['#4b4068', '#2e2548'];
    p.rrect(1, 2, 34, 33, 7, hex('#0c0812'));
    p.rrect(1, pressed ? 2 : 1, 34, 33, 7, hex(pressed ? '#a68ae8' : '#8a78c0'));
    for (var y = 0; y < 30; y++) for (var x = 0; x < 30; x++) {
      var t = y / 29;
      if (Math.abs(x - 14.5) > 14.5 - (Math.abs(y - 14.5) > 11.5 ? 2.4 : 0) + 0.01) continue;
      p.set(3 + x, (pressed ? 4 : 3) + y, mix(hex(body[0]), hex(body[1]), t));
    }
    var cx = 18, cy = pressed ? 19 : 18, a = pressed ? hex('#ffffff') : hex('#e8dcff');
    var tri = { up: [[cx, cy - 8], [cx + 8, cy + 5], [cx - 8, cy + 5]], down: [[cx, cy + 8], [cx + 8, cy - 5], [cx - 8, cy - 5]], left: [[cx - 8, cy], [cx + 5, cy - 8], [cx + 5, cy + 8]], right: [[cx + 8, cy], [cx - 5, cy - 8], [cx - 5, cy + 8]] }[dir];
    var a2 = new Pix(36, 36);
    a2.poly(tri, a);
    a2.outline(hex('#1a1030'));
    p.blit(a2, 0, 0);
    return p;
  }
  function makeTouchRound(label, pressed, w, h, red) {
    var p = new Pix(w, h), cx = w / 2, cy = h / 2 - (pressed ? 0 : 1);
    var R = red ? ramp(['#7a1418', '#b02222', '#e23a2e', '#ff7a66']) : ramp(['#2e2548', '#4b4068', '#6a5c94', '#9a8cc8']);
    var rr = Math.min(w, h) / 2 - 2;
    p.ell(cx, cy + 2, rr, rr, hex('#0c0812'));
    p.ell(cx, cy, rr, rr, hex('#0c0812'));
    p.ellShade(cx, cy, rr - 1.5, rr - 1.5, R, { dither: true, lo: pressed ? -0.9 : -0.55 });
    if (pressed) p.ellOver(cx, cy, rr - 1.5, rr - 1.5, hex('#000000', 0.18));
    return { pix: p, cx: cx, cy: cy };
  }
  function drawLabel(pix, str, cx, y, color) {
    var cv = pix.toCanvas(), x = cv.getContext('2d');
    DM.Font.draw(x, str, cx, y, { scale: 1, color: color, shadow: '#1a1030', align: 'center', silent: true });
    return cv;
  }
  function makeTouch() {
    var T = {};
    ['up', 'down', 'left', 'right'].forEach(function (d) { T[d] = [makeTouchPad(d, false).toCanvas(), makeTouchPad(d, true).toCanvas()]; });
    T.bomb = [false, true].map(function (pr) {
      var r = makeTouchRound('BOMB', pr, 56, 56, true);
      var cv = drawLabel(r.pix, 'BOMB', r.cx + 0.5, r.cy + 9 + (pr ? 1 : 0), '#fff2d0');
      /* small dynamite stick icon above the label */
      var x = cv.getContext('2d');
      x.fillStyle = '#23202b'; x.fillRect(r.cx - 5, r.cy - 12, 10, 3);
      x.fillStyle = '#ffd23f'; x.fillRect(r.cx + 1, r.cy - 18, 2, 2);
      x.fillStyle = '#ffffff'; x.fillRect(r.cx + 6, r.cy - 12, 2, 2);
      x.fillStyle = '#fff2d0'; x.fillRect(r.cx - 4, r.cy - 16, 8, 8); x.fillStyle = '#e23a2e'; x.fillRect(r.cx - 3, r.cy - 15, 6, 6);
      x.fillStyle = '#ff7a66'; x.fillRect(r.cx - 3, r.cy - 15, 1, 6); x.fillStyle = '#23202b'; x.fillRect(r.cx - 4, r.cy - 13, 8, 2);
      return cv;
    });
    T.pause = [false, true].map(function (pr) {
      var p = new Pix(56, 22), y0 = pr ? 2 : 1;
      p.rrect(0, 2, 56, 20, 6, hex('#0c0812'));
      p.rrect(0, y0 - 1, 56, 20, 6, hex(pr ? '#a68ae8' : '#8a78c0'));
      for (var y = 0; y < 17; y++) for (var x = 0; x < 52; x++) {
        if (Math.abs(x - 25.5) > 25.5 - (Math.abs(y - 8) > 6 ? 1.6 : 0) + 0.01) continue;
        p.set(2 + x, y0 + 1 + y, mix(hex(pr ? '#57497a' : '#4b4068'), hex(pr ? '#3c3160' : '#2e2548'), y / 16));
      }
      return drawLabel(p, 'PAUSE', 28, y0 + 5, '#f2e8ff');
    });
    return T;
  }

  /* ------------------------------------------------------------------ favicon (A22) */
  function makeFavicon() {
    var p = new Pix(32, 32);
    p.rrect(0, 0, 32, 32, 7, hex('#0d0714'));
    p.rrect(1, 1, 30, 30, 6, hex('#3a2560'));
    p.rrect(2, 2, 28, 28, 5, hex('#2b1a44'));
    p.ellOver(16, 30, 13, 8, hex('#7a5cff', 0.18));
    var mole = DM.ArtChars.drawMole({ dir: 'down', k: 1 });
    p.blit(mole, 0, 0);
    return p.toCanvas();
  }

  function makeTitleVignette() {
    var p = new Pix(480, 416);
    for (var y = 0; y < 416; y++) for (var x = 0; x < 480; x++) {
      var dx = (x + 0.5 - 240) / 250, dy = (y + 0.5 - 208) / 225, d = Math.sqrt(dx * dx + dy * dy);
      var a = Math.max(0, (d - 0.66) / 0.55);
      a = Math.min(1, a * a) * 0.55;
      var q = Math.round(a * 10) / 10;
      if (q > 0) p.set(x, y, Pix.pack(6, 3, 14, Math.round(q * 255)));
    }
    return p.toCanvas();
  }

  /* ------------------------------------------------------------------ build */
  function build(S) {
    S.hudBg = makeHudBg();
    var lg = makeLogo();
    S.logo = lg.canvas; S.logoMeta = lg;
    S.title = {
      far: makeTitleFar(), mid: makeTitleMid(), near: makeTitleNear(),
      hero: makeHero(), bundle: makeBigBundle(),
      vignette: makeTitleVignette(),
      lamps: [[48, 168], [432, 168]]
    };
    S.touch = makeTouch();
    S.favicon = makeFavicon();
  }

  DM.ArtUi = { build: build, makeFavicon: makeFavicon };
})(typeof window !== 'undefined' ? window : globalThis);
