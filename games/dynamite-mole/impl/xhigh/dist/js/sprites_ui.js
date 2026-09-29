/* sprites_ui.js - HUD panel (A21), title logo (A19), title background (A20), light/vignette sprites (A29), touch art. */
(function () {
  'use strict';
  var DM = window.DM;
  var sh = DM.sh;
  var ell = sh.ell, rect = sh.rect, rrect = sh.rrect, sub = sh.sub, mv = sh.mv, and = sh.and, seg = sh.seg, poly = sh.poly, or = sh.or;
  var hash = DM.hash, vnoise = DM.vnoise, mix = DM.mix;

  function fbm(x, y, seed, oct) {
    var v = 0, a = 0.5, f = 1;
    for (var i = 0; i < oct; i++) {
      v += a * vnoise(x * f, y * f, seed + i * 17);
      a *= 0.5;
      f *= 2;
    }
    return v / (1 - Math.pow(0.5, oct));
  }

  /* ---------------------------------------------------------- HUD panel 480 x 64 (stone bricks) */
  function hudPanel() {
    var S = new DM.Spr(480, 64, 480);
    S.fillFn(null, function (ux, uy, x, y) {
      var row = Math.floor(y / 8);
      var off = row % 2 ? 12 : 0;
      var bx = (x + off) % 24;
      var by = y % 8;
      if (by === 7 || bx === 23) return '#120d18';
      var t = hash(Math.floor((x + off) / 24), row, 31);
      var c = t < 0.33 ? '#241b2c' : t < 0.66 ? '#2a2033' : '#20182a';
      if (by === 0 || bx === 0) c = '#372a42';
      else if (by === 6 || bx === 22) c = '#191320';
      else if (hash(x, y, 5) < 0.05) c = '#30253b';
      return c;
    });
    /* bottom trim: wooden beam with gold edge */
    S.fill(rect(0, 58, 480, 64), '#4a2e18');
    S.fill(rect(0, 58, 480, 59), '#e0b060');
    S.fill(rect(0, 59, 480, 60), '#a8763a');
    S.fill(rect(0, 62, 480, 64), '#24140a');
    for (var x = 8; x < 480; x += 40) {
      S.fill(rect(x, 60, x + 2, 62), '#c8d0e0');
    }
    return S.toCanvas();
  }

  /* ---------------------------------------------------------- lights */
  function lightSprite(size, r, g, b, power, maxA) {
    var c = DM.mkCanvas(size, size);
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(size, size);
    var h = size / 2;
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var d = Math.sqrt((x + 0.5 - h) * (x + 0.5 - h) + (y + 0.5 - h) * (y + 0.5 - h)) / h;
        var a = d >= 1 ? 0 : Math.pow(1 - d, power);
        var i = (y * size + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = Math.round(a * maxA * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function vignette() {
    var W = 480, H = 352;
    var c = DM.mkCanvas(W, H);
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(W, H);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var dx = (x + 0.5 - W / 2) / (W / 2), dy = (y + 0.5 - H / 2) / (H / 2);
        var d = Math.sqrt(dx * dx * 0.85 + dy * dy * 1.05);
        var a = d < 0.55 ? 0 : Math.min(1, (d - 0.55) / 0.75);
        a = a * a * 0.62;
        /* ordered dither keeps it pixel-art-ish instead of smooth gradient */
        var bay = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][(y & 3) * 4 + (x & 3)] / 16;
        var q = Math.floor(a * 8 + bay) / 8;
        var i = (y * W + x) * 4;
        img.data[i] = 6;
        img.data[i + 1] = 4;
        img.data[i + 2] = 14;
        img.data[i + 3] = Math.round(Math.min(1, q) * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /* ---------------------------------------------------------- logo */
  function boxBlur(src, W, H, r) {
    var tmp = new Float32Array(W * H), out = new Float32Array(W * H);
    var n = 2 * r + 1, x, y, k, acc;
    for (y = 0; y < H; y++) {
      acc = 0;
      for (k = -r; k <= r; k++) acc += src[y * W + Math.max(0, Math.min(W - 1, k))];
      for (x = 0; x < W; x++) {
        tmp[y * W + x] = acc / n;
        acc += src[y * W + Math.min(W - 1, x + r + 1)] - src[y * W + Math.max(0, x - r)];
      }
    }
    for (x = 0; x < W; x++) {
      acc = 0;
      for (k = -r; k <= r; k++) acc += tmp[Math.max(0, Math.min(H - 1, k)) * W + x];
      for (y = 0; y < H; y++) {
        out[y * W + x] = acc / n;
        acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
      }
    }
    return out;
  }

  function buildLogo() {
    var W = 440, H = 120;
    var mask = new Float32Array(W * H);
    var lines = [
      { t: 'DYNAMITE', k: 7, y: 8 },
      { t: 'MOLE', k: 8, y: 62 }
    ];
    lines.forEach(function (L) {
      var n = L.t.length;
      var total = n * 6 * L.k - L.k;
      var x0 = Math.round((W - total) / 2);
      for (var i = 0; i < n; i++) {
        var rows = DM.font.glyphRows(L.t.charAt(i));
        for (var r = 0; r < 7; r++)
          for (var c = 0; c < 5; c++)
            if (rows[r].charAt(c) === '#') {
              for (var yy = 0; yy < L.k; yy++)
                for (var xx = 0; xx < L.k; xx++) {
                  var px = x0 + (i * 6 + c) * L.k + xx, py = L.y + r * L.k + yy;
                  if (px >= 0 && px < W && py >= 0 && py < H) mask[py * W + px] = 1;
                }
            }
      }
    });
    /* round the blocky glyphs: blur + threshold (twice) */
    var m = boxBlur(boxBlur(mask, W, H, 3), W, H, 2);
    var bin = new Uint8Array(W * H);
    for (var i = 0; i < W * H; i++) bin[i] = m[i] > 0.3 ? 1 : 0;

    /* distance from the inside edge (chamfer) */
    var dist = new Uint8Array(W * H);
    var x, y;
    for (i = 0; i < W * H; i++) dist[i] = bin[i] ? 255 : 0;
    for (y = 0; y < H; y++)
      for (x = 0; x < W; x++) {
        i = y * W + x;
        if (!bin[i]) continue;
        var d = 255;
        d = Math.min(d, x > 0 ? dist[i - 1] + 1 : 1, y > 0 ? dist[i - W] + 1 : 1);
        dist[i] = d;
      }
    for (y = H - 1; y >= 0; y--)
      for (x = W - 1; x >= 0; x--) {
        i = y * W + x;
        if (!bin[i]) continue;
        var d2 = dist[i];
        d2 = Math.min(d2, x < W - 1 ? dist[i + 1] + 1 : 1, y < H - 1 ? dist[i + W] + 1 : 1);
        dist[i] = d2;
      }
    /* outline: dilate by 3 px */
    var out = new DM.Spr(W, H, W);
    function inside(px, py) {
      return px >= 0 && py >= 0 && px < W && py < H && bin[py * W + px];
    }
    var OL = '#3a1208', OL2 = '#6a2410';
    for (y = 0; y < H; y++)
      for (x = 0; x < W; x++) {
        if (bin[y * W + x]) continue;
        var near = 99;
        for (var dy = -3; dy <= 3 && near > 1; dy++)
          for (var dx = -3; dx <= 3; dx++) {
            if (dx * dx + dy * dy > 10) continue;
            if (inside(x + dx, y + dy)) {
              var dd = Math.max(Math.abs(dx), Math.abs(dy));
              if (dd < near) near = dd;
            }
          }
        if (near <= 3) out.set(x, y, near === 3 ? OL2 : OL);
      }
    /* drop shadow (under everything) */
    var sh2 = new DM.Spr(W, H, W);
    for (y = 0; y < H; y++)
      for (x = 0; x < W; x++) {
        if (out.d[y * W + x] >>> 24) {
          var tx = x + 3, ty = y + 4;
          if (tx < W && ty < H) sh2.d[ty * W + tx] = DM.col('#00000070');
        }
      }
    var res = new DM.Spr(W, H, W);
    res.blit(sh2, 0, 0);
    res.blit(out, 0, 0);
    /* fill */
    for (y = 0; y < H; y++)
      for (x = 0; x < W; x++) {
        i = y * W + x;
        if (!bin[i]) continue;
        var ly = y < 60 ? (y - 8) / 49 : (y - 62) / 56; /* 0..1 within its line */
        var col;
        if (ly < 0.28) col = '#fff58a';
        else if (ly < 0.5) col = '#ffd23c';
        else if (ly < 0.74) col = '#ff9a26';
        else col = '#e9581c';
        var dd2 = dist[i];
        if (dd2 <= 2) col = ly < 0.5 ? '#f0a428' : '#c2400f';
        /* bevel: lit top-left edge, shaded bottom-right edge */
        if (dd2 > 2 && dd2 <= 5) {
          var litTL = !inside(x - 4, y - 4);
          var shBR = !inside(x + 4, y + 4);
          if (litTL) col = '#fffbd0';
          else if (shBR) col = ly < 0.5 ? '#e8902a' : '#b8340c';
        }
        /* stripe: a thin hot band */
        if (dd2 > 5 && (y % 14 === 0)) col = mix(col, '#ffffff', 0.25);
        if (hash(x, y, 77) < 0.035 && dd2 > 3) col = mix(col, '#ffffff', 0.25);
        res.set(x, y, col);
      }
    return res.toCanvas();
  }

  /* ---------------------------------------------------------- title background (3 layers) */
  var TW = 504, TH = 416;

  function titleFar() {
    var S = new DM.Spr(TW, TH, TW);
    var pal = ['#0c0816', '#130c20', '#1a1128', '#231835', '#2e2044'];
    S.fillFn(null, function (ux, uy, x, y) {
      var n = fbm(x * 0.02, y * 0.03, 5, 4);
      var st = 0.5 + 0.5 * Math.sin((y + n * 90) * 0.07);
      var v = 0.6 * n + 0.4 * st;
      v = v - Math.abs(x - TW / 2) / TW * 0.35 + (1 - y / TH) * 0.1;
      var q = Math.floor(v * 6.2 - 1.2);
      if (q < 0) q = 0;
      if (q > 4) q = 4;
      /* dithered band edges */
      if (hash(x, y, 9) < 0.06) q = Math.min(4, q + 1);
      return pal[q];
    });
    /* ore glints */
    for (var i = 0; i < 90; i++) {
      var gx = Math.floor(hash(i, 1, 44) * TW), gy = Math.floor(hash(i, 2, 44) * (TH - 90));
      var gc = i % 3 === 0 ? '#5ae0ff' : i % 3 === 1 ? '#ffd23a' : '#ff7ad8';
      S.set(gx, gy, gc);
      if (i % 4 === 0) {
        S.set(gx + 1, gy, gc + '99');
        S.set(gx - 1, gy, gc + '99');
        S.set(gx, gy + 1, gc + '99');
        S.set(gx, gy - 1, gc + '99');
      }
    }
    return S.toCanvas();
  }

  function titleMid() {
    var S = new DM.Spr(TW, TH, TW);
    /* ceiling stalactites */
    var rockC = ['#1c1226', '#2a1c36', '#3a2a48', '#4e3a5e'];
    var top = new Int16Array(TW);
    var x, y;
    for (x = 0; x < TW; x++) {
      var h = 26 + 34 * fbm(x * 0.012, 3, 12, 3);
      top[x] = h;
    }
    var spikes = [[40, 110, 26], [120, 80, 20], [190, 130, 30], [275, 96, 24], [330, 122, 28], [410, 84, 22], [470, 112, 26], [80, 60, 14], [240, 60, 14], [370, 60, 12]];
    spikes.forEach(function (s) {
      for (x = Math.max(0, s[0] - s[2]); x < Math.min(TW, s[0] + s[2]); x++) {
        var t = 1 - Math.abs(x - s[0]) / s[2];
        var hh = top[x] + (s[1] - top[x]) * Math.pow(t, 1.3);
        if (hh > top[x]) top[x] = Math.round(hh);
      }
    });
    for (x = 0; x < TW; x++) {
      for (y = 0; y < top[x]; y++) {
        var edge = top[x] - y;
        var c = rockC[1];
        if (edge <= 1) c = rockC[3];
        else if (edge <= 3) c = rockC[2];
        else if (hash(x, y, 8) < 0.06) c = rockC[2];
        else if (fbm(x * 0.05, y * 0.05, 3, 2) > 0.62) c = rockC[0];
        S.set(x, y, c);
      }
    }
    /* ground */
    var gy0 = new Int16Array(TW);
    for (x = 0; x < TW; x++) gy0[x] = Math.round(238 + 6 * fbm(x * 0.02, 9, 21, 3) - 3);
    for (x = 0; x < TW; x++) {
      for (y = gy0[x]; y < TH; y++) {
        var dep = y - gy0[x];
        var gc = '#3a2a2a';
        if (dep === 0) gc = '#8a6a4a';
        else if (dep <= 2) gc = '#6a4c38';
        else if (hash(x, y, 4) < 0.07) gc = '#4c3a36';
        else if (fbm(x * 0.06, y * 0.09, 6, 2) > 0.6) gc = '#2e2224';
        S.set(x, y, gc);
      }
    }
    /* small rocks and tufts on the ground */
    [[70, 5, 9], [150, 3, 6], [330, 4, 8], [420, 6, 10], [250, 3, 5]].forEach(function (r, i) {
      var gx = r[0], gy = gy0[gx];
      S.fill(function (px, py) {
        var dx = (px - gx) / r[2], dy = (py - (gy - r[1] * 0.3)) / (r[1] + 1);
        return dx * dx + dy * dy <= 1 && py < gy + 1;
      }, '#5e4c58');
      S.fill(function (px, py) {
        var dx = (px - gx + 2) / (r[2] * 0.6), dy = (py - (gy - r[1] * 0.6)) / (r[1] * 0.6);
        return dx * dx + dy * dy <= 1;
      }, '#8a7484');
    });
    /* crystals bottom-right and left */
    function crystal(cx, base, w, h, c1, c2, c3) {
      S.fill(poly([cx - w, base, cx - w * 0.6, base - h * 0.7, cx, base - h, cx + w * 0.7, base - h * 0.6, cx + w, base]), c2);
      S.fill(poly([cx, base - h, cx + w * 0.7, base - h * 0.6, cx + w, base, cx, base]), c3);
      S.fill(poly([cx - w * 0.6, base - h * 0.7, cx, base - h, cx - w * 0.15, base - h * 0.2, cx - w * 0.5, base - h * 0.3]), c1);
      S.fill(rect(cx - w * 0.3, base - h * 0.85, cx - w * 0.3 + 1.5, base - h * 0.5), '#ffffff');
    }
    crystal(432, gy0[432] + 4, 14, 44, '#c8fbff', '#52dcff', '#1b8fc4');
    crystal(452, gy0[452] + 4, 10, 30, '#ffd8ff', '#d070ff', '#7a30b8');
    crystal(414, gy0[414] + 4, 8, 24, '#c8fbff', '#52dcff', '#1b8fc4');
    crystal(58, gy0[58] + 4, 12, 34, '#ffd8ff', '#d070ff', '#7a30b8');
    crystal(78, gy0[78] + 4, 8, 22, '#c8fbff', '#52dcff', '#1b8fc4');
    return S.toCanvas();
  }

  function titleNear() {
    var S = new DM.Spr(480, 416, 480);
    var x, y;
    function post(x0, x1) {
      for (y = 0; y < 246; y++)
        for (x = x0; x < x1; x++) {
          var u = x - x0;
          var c = '#7a4c28';
          if (u < 2) c = '#b07a44';
          else if (u >= x1 - x0 - 4) c = '#3e2410';
          else if ((u + Math.floor(y / 40)) % 5 === 1 && hash(x, y, 2) < 0.9) c = '#946034';
          if (hash(x, y, 6) < 0.05) c = '#4e2e16';
          S.set(x, y, c);
        }
      /* iron bands */
      [70, 150, 216].forEach(function (by) {
        S.fill(rect(x0 - 2, by, x1 + 2, by + 8), '#3a3f4c');
        S.fill(rect(x0 - 2, by, x1 + 2, by + 2), '#8a92a6');
        S.fill(rect(x0 - 2, by + 6, x1 + 2, by + 8), '#1c2028');
        S.fill(rect(x0 + 2, by + 3, x0 + 4, by + 5), '#d0d8e8');
        S.fill(rect(x1 - 5, by + 3, x1 - 3, by + 5), '#d0d8e8');
      });
    }
    post(6, 32);
    post(448, 474);
    /* top beam */
    for (y = 0; y < 26; y++)
      for (x = 0; x < 480; x++) {
        var c2 = '#7a4c28';
        if (y < 2) c2 = '#b07a44';
        else if (y >= 22) c2 = '#3e2410';
        else if ((x + y * 3) % 47 < 2 && hash(x, y, 5) < 0.9) c2 = '#946034';
        if (hash(x, y, 7) < 0.05) c2 = '#4e2e16';
        S.set(x, y, c2);
      }
    /* braces */
    S.fill(poly([32, 26, 32, 70, 92, 26]), '#6a4020');
    S.fill(poly([32, 26, 32, 66, 84, 26]), '#8a5a30');
    S.fill(poly([448, 26, 448, 70, 388, 26]), '#6a4020');
    S.fill(poly([448, 26, 448, 66, 396, 26]), '#8a5a30');
    /* lantern chains */
    [56, 424].forEach(function (lx) {
      S.fill(rect(lx - 0.5, 26, lx + 0.5, 46), '#2a2a34');
      S.fill(rrect(lx - 8, 46, lx + 8, 52, 2), '#3a3a44');
      S.fill(rect(lx - 6, 52, lx + 6, 70), '#3a2a12');
      S.fill(rect(lx - 5, 53, lx + 5, 69), '#ffcf5a');
      S.fill(rect(lx - 3, 55, lx + 3, 67), '#fff6c8');
      S.fill(rect(lx - 0.5, 53, lx + 0.5, 69), '#3a2a12');
      S.fill(rect(lx - 5, 60, lx + 5, 61), '#3a2a12');
      S.fill(rrect(lx - 8, 68, lx + 8, 74, 2), '#3a3a44');
    });
    return S.outline('#1a0e06').toCanvas();
  }

  /* ---------------------------------------------------------- title art: big mole and dynamite (R = 64) */
  function titleArt() {
    var out = { mole: [], bomb: [] };
    out.mole.push(DM.makeMole(64, 'down', { bob: 0 }).toCanvas());
    out.mole.push(DM.makeMole(64, 'down', { bob: 0, breath: 1 }).toCanvas());
    out.mole.push(DM.makeMole(64, 'down', { bob: -1, shut: true }).toCanvas());
    for (var i = 0; i < 3; i++) out.bomb.push(DM.makeDynamite(64, i, false).toCanvas());
    return out;
  }

  DM.buildUiSprites = function () {
    var ui = {};
    var times = (DM.uiTimes = {});
    function T(name, fn) {
      var t0 = performance.now();
      var v = fn();
      times[name] = Math.round(performance.now() - t0);
      return v;
    }
    ui.hud = T('hud', hudPanel);
    ui.logo = T('logo', buildLogo);
    ui.titleFar = T('far', titleFar);
    ui.titleMid = T('mid', titleMid);
    ui.titleNear = T('near', titleNear);
    ui.art = T('art', titleArt);
    ui.light = T('light', function () {
      return lightSprite(128, 255, 255, 255, 1.5, 1);
    });
    ui.glowWarm = lightSprite(128, 255, 176, 84, 2.0, 0.55);
    ui.glowRed = lightSprite(128, 255, 90, 40, 1.8, 0.6);
    ui.vignette = T('vignette', vignette);
    return ui;
  };
})();
