/* All art is generated in code. Every sprite is drawn on a 16x16 grid and
   upscaled 2x, so every dot in the game world is exactly 2x2 screen px. */
(function () {
  function mkC(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function P(ctx) {
    return {
      ctx: ctx,
      px: function (x, y, c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); },
      r: function (x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); },
      e: function (cx, cy, rx, ry, c) {
        ctx.fillStyle = c;
        for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
          for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
            if (dx * dx + dy * dy <= 1) ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    };
  }
  function up(c) {
    var o = mkC(32, 32), x = o.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(c, 0, 0, 32, 32);
    return o;
  }
  function outlinePx(c, col) {
    var x = c.getContext('2d'), w = c.width, h = c.height;
    var d = x.getImageData(0, 0, w, h), a = d.data, o = new Uint8ClampedArray(a);
    var rgb = [parseInt(col.substr(1, 2), 16), parseInt(col.substr(3, 2), 16), parseInt(col.substr(5, 2), 16)];
    function A(px, py) { return px < 0 || py < 0 || px >= w || py >= h ? 0 : a[(py * w + px) * 4 + 3]; }
    for (var y = 0; y < h; y++) for (var xx = 0; xx < w; xx++) {
      if (A(xx, y) === 0 && (A(xx - 1, y) > 0 || A(xx + 1, y) > 0 || A(xx, y - 1) > 0 || A(xx, y + 1) > 0)) {
        var i = (y * w + xx) * 4; o[i] = rgb[0]; o[i + 1] = rgb[1]; o[i + 2] = rgb[2]; o[i + 3] = 255;
      }
    }
    d.data.set(o); x.putImageData(d, 0, 0);
  }
  function sprite(fn, outline) {
    var c = mkC(16, 16), x = c.getContext('2d');
    fn(P(x), x);
    if (outline !== false) outlinePx(c, outline || '#1c1018');
    return up(c);
  }
  function tint(c, color) {
    var o = mkC(c.width, c.height), x = o.getContext('2d');
    x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = color; x.fillRect(0, 0, o.width, o.height);
    return o;
  }
  function flip(c) {
    var o = mkC(c.width, c.height), x = o.getContext('2d');
    x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0);
    return o;
  }
  function rot(c, deg) {
    var o = mkC(32, 32), x = o.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.translate(16, 16); x.rotate(deg * Math.PI / 180); x.drawImage(c, -16, -16);
    return o;
  }
  function seeded(seed) { return Level.mulberry32(seed); }

  var Art = {};

  /* ---------------- Mole ---------------- */
  var FUR = '#8a5630', FUR2 = '#6a3e22', BELLY = '#d8a878', SNOUT = '#e8b890', NOSE = '#ff7a90',
    HELM = '#ffd23a', HELMD = '#d9951a', HELMH = '#fff4a8', LAMP = '#ffffe0', EYE = '#141020', CLAW = '#f4e4c0';

  function mole(dir, f, dead) {
    return sprite(function (p) {
      var b = (f === 1 || f === 3 || f === 4) ? 1 : 0;
      var L = f === 1 ? -1 : 0, R = f === 3 ? -1 : 0;
      if (dir === 'down' || dir === 'up') {
        p.r(4, 13 + L, 3, 2, FUR2); p.r(9, 13 + R, 3, 2, FUR2);
        p.px(4, 14 + L, CLAW); p.px(6, 14 + L, CLAW); p.px(9, 14 + R, CLAW); p.px(11, 14 + R, CLAW);
        p.e(8, 10 + b, 5, 4, FUR);
        p.r(2, 9 + b, 2, 4, FUR2); p.r(12, 9 + b, 2, 4, FUR2);
        p.px(2, 13 + b, CLAW); p.px(3, 13 + b, CLAW); p.px(12, 13 + b, CLAW); p.px(13, 13 + b, CLAW);
        if (dir === 'down') {
          p.e(8, 11 + b, 3, 2.5, BELLY);
          p.e(8, 7 + b, 5, 4, FUR);
          p.e(8, 10 + b, 2.6, 1.8, SNOUT);
          p.r(7, 9 + b, 2, 2, NOSE); p.px(7, 9 + b, '#ffb0c0');
          if (dead) {
            [[5, 8], [10, 8]].forEach(function (q) { p.px(q[0], q[1] + b, EYE); p.px(q[0] + 1, q[1] + b, EYE); p.px(q[0], q[1] + 1 + b, EYE); p.px(q[0] + 1, q[1] + 1 + b, EYE); p.px(q[0] + 1, q[1] + b, '#fff'); p.px(q[0], q[1] + 1 + b, '#fff'); });
          } else {
            p.r(5, 8 + b, 1, 2, EYE); p.r(10, 8 + b, 1, 2, EYE); p.px(5, 8 + b, '#5a5a8a'); p.px(10, 8 + b, '#5a5a8a');
          }
          p.e(8, 5 + b, 5.3, 3.3, HELM); p.r(2, 6 + b, 12, 1, HELMD);
          p.r(4, 3 + b, 3, 1, HELMH); p.r(7, 2 + b, 2, 3, LAMP); p.px(7, 2 + b, '#fff'); p.px(8, 5 + b, '#c88a10');
        } else {
          p.e(8, 6 + b, 5.5, 4.8, HELM);
          p.r(7, 2 + b, 2, 9, HELMD); p.r(3, 4 + b, 2, 1, HELMH); p.r(11, 8 + b, 2, 1, HELMD);
          p.r(2, 9 + b, 12, 1, HELMD);
          p.r(7, 13 + b, 2, 2, NOSE);
        }
      } else {
        // left profile
        p.r(5 + (L ? 1 : 0), 13 + L, 3, 2, FUR2); p.r(9 + (R ? -1 : 0), 13 + R, 3, 2, FUR2);
        p.px(5, 14 + L, CLAW); p.px(9, 14 + R, CLAW);
        p.e(9, 10 + b, 4.6, 4, FUR); p.e(9, 11 + b, 2.6, 2.4, BELLY);
        p.e(7.5, 7 + b, 4.6, 4, FUR);
        p.e(3, 9.5 + b, 2.4, 1.8, SNOUT); p.r(1, 9 + b, 2, 2, NOSE);
        p.r(5, 8 + b, 1, 2, EYE); p.px(5, 8 + b, '#5a5a8a');
        if (dead) { p.px(5, 8 + b, EYE); p.px(6, 9 + b, EYE); }
        p.e(8, 5 + b, 5, 3.3, HELM); p.r(2, 6 + b, 10, 1, HELMD); p.r(6, 3 + b, 3, 1, HELMH);
        p.r(2, 4 + b, 2, 2, LAMP); p.px(2, 4 + b, '#fff');
        p.r(11, 5 + b, 2, 2, HELMD);
        p.r(3, 11 + b, 3, 2, FUR2); p.px(2, 12 + b, CLAW); p.px(2, 11 + b, CLAW);
        p.r(12, 11 + b, 2, 2, NOSE);
      }
    });
  }

  function sparkle(x, cx, cy, col) {
    x.fillStyle = col;
    x.fillRect(cx - 2, cy - 2, 4, 4);
    x.fillRect(cx - 6, cy - 2, 12, 4); x.fillRect(cx - 2, cy - 6, 4, 12);
  }

  function buildMole() {
    Art.mole = {};
    ['down', 'up', 'left'].forEach(function (d) {
      Art.mole[d] = [0, 1, 2, 3, 4].map(function (f) { return mole(d, f); });
    });
    Art.mole.right = Art.mole.left.map(flip);
    // death: 6 frames
    var base = mole('down', 0, true);
    Art.moleDie = [];
    for (var i = 0; i < 6; i++) {
      var c = mkC(32, 32), x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      if (i === 0) x.drawImage(tint(mole('down', 0, false), '#ffffff'), 0, 0);
      else if (i === 4 || i === 5) { x.globalAlpha = i === 5 ? 0.75 : 1; x.drawImage(base, 0, 0, 32, 32, 0, 14, 32, 18); x.globalAlpha = 1; }
      else x.drawImage(base, 0, 0);
      if (i >= 1) {
        for (var k = 0; k < 3; k++) {
          var a = (i * 0.9) + k * 2.094;
          var sx = 16 + Math.round(Math.cos(a) * 11 / 2) * 2, sy = (i >= 4 ? 16 : 5) + Math.round(Math.sin(a) * 3 / 2) * 2;
          sparkle(x, sx, sy, '#ffe45a');
        }
      }
      Art.moleDie.push(c);
    }
    Art.hudFace = (function () {
      var c = mkC(16, 16), x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      x.drawImage(Art.mole.down[0], 1, 1, 30, 30, 0, 0, 16, 16);
      return c;
    })();
  }

  /* ---------------- Enemies ---------------- */
  function slime(f) {
    return sprite(function (p) {
      var rx = [5.5, 6, 6.5, 6][f], ry = [4.6, 4.1, 3.6, 4.1][f], cy = 13.5 - ry;
      p.e(8, cy, rx, ry, '#2c9a48');
      p.e(8, cy - 0.5, rx - 0.8, ry - 0.9, '#55d86a');
      p.px(5, Math.round(cy - 2), '#d0ffd8'); p.px(6, Math.round(cy - 2.5), '#d0ffd8'); p.px(5, Math.round(cy - 1), '#a0f0b0');
      var ey = Math.round(cy - 0.5);
      p.r(5, ey, 2, 2, '#fff'); p.r(9, ey, 2, 2, '#fff'); p.px(6, ey + 1, '#101020'); p.px(10, ey + 1, '#101020');
      p.r(7, ey + 2, 2, 1, '#1a5a2a');
    });
  }
  function bat(f) {
    return sprite(function (p) {
      var tip = [3, 5, 9, 6][f], W = '#7a4aa8', WD = '#4a2a70';
      for (var k = 1; k <= 6; k++) {
        var yc = Math.round(8 + (tip - 8) * (k / 6));
        var th = k < 3 ? 4 : (k < 5 ? 3 : 2);
        p.r(8 - 1 - k, yc - 1, 1, th, k % 2 ? W : WD);
        p.r(8 + k, yc - 1, 1, th, k % 2 ? W : WD);
      }
      p.e(8, 8.5, 2.6, 3.2, '#5a3288');
      p.r(5, 4, 2, 3, '#5a3288'); p.r(9, 4, 2, 3, '#5a3288'); p.px(5, 4, '#ff9ac0'); p.px(10, 4, '#ff9ac0');
      p.r(6, 7, 1, 1, '#ff3a3a'); p.r(9, 7, 1, 1, '#ff3a3a');
      p.px(7, 10, '#fff'); p.px(9, 10, '#fff');
    });
  }
  function ghost(f, chase) {
    return sprite(function (p) {
      var B = chase ? '#ffd8d8' : '#e8f0ff', S = chase ? '#e09090' : '#a8b8e8';
      p.e(8, 7, 5, 5, S); p.r(3, 7, 10, 6, S);
      p.e(8, 6.5, 4.5, 4.5, B); p.r(4, 7, 8, 5, B);
      var w = f;
      for (var x = 3; x < 13; x++) {
        var ph = ((x + w * 2) % 6);
        var len = ph < 3 ? 2 : 0;
        p.r(x, 12, 1, len, x % 2 ? B : S);
      }
      p.r(3 - 1 + (f === 1 ? 1 : 0), 9 + (f === 2 ? -1 : 0), 2, 3, B);
      p.r(12 - (f === 1 ? 1 : 0), 9 + (f === 2 ? -1 : 0), 2, 3, B);
      var eye = chase ? '#e01818' : '#181828';
      p.r(5, 6, 2, 3, eye); p.r(9, 6, 2, 3, eye);
      if (chase) { p.r(7, 10, 2, 2, '#a01010'); p.px(5, 6, '#ffa0a0'); p.px(9, 6, '#ffa0a0'); }
      else p.px(5, 6, '#7a7aa8');
    });
  }
  function golem(f) {
    return sprite(function (p) {
      var l1 = f === 1 ? 1 : 0, l2 = f === 3 ? 1 : 0;
      p.r(4, 12, 3, 2 - l1 + 1, '#5a5a6a'); p.r(9, 12, 3, 2 - l2 + 1, '#5a5a6a');
      p.r(3, 5, 10, 8, '#8a8a9c'); p.r(3, 5, 10, 2, '#b4b4c8'); p.r(3, 11, 10, 2, '#66667a');
      p.r(1, 6, 3, 6 + (f === 2 ? 1 : 0), '#767688'); p.r(12, 6, 3, 6 + (f === 0 ? 1 : 0), '#767688');
      p.r(1, 6, 3, 1, '#b4b4c8'); p.r(12, 6, 3, 1, '#b4b4c8');
      p.r(5, 2, 6, 4, '#a0a0b4'); p.r(5, 2, 6, 1, '#c8c8dc');
      p.r(6, 3, 2, 2, '#ff8a1a'); p.r(9, 3, 2, 2, '#ff8a1a'); p.px(6, 3, '#fff0a0'); p.px(9, 3, '#fff0a0');
      p.px(7, 8, '#4a4a5a'); p.px(8, 9, '#4a4a5a'); p.px(6, 10, '#4a4a5a'); p.px(10, 7, '#4a4a5a');
      p.r(7, 7, 2, 2, '#ff8a1a');
    });
  }
  function puff(f) {
    return sprite(function (p) {
      var W = '#f6f0e4', G = '#b8b0a4';
      if (f === 0) { p.e(8, 8, 4, 4, G); p.e(8, 8, 3, 3, W); p.px(8, 4, '#ffe45a'); p.px(8, 12, '#ffe45a'); p.px(4, 8, '#ffe45a'); p.px(12, 8, '#ffe45a'); }
      else if (f === 1) { [[5, 5], [11, 5], [4, 10], [12, 10], [8, 12], [8, 4]].forEach(function (q) { p.e(q[0], q[1], 2.6, 2.6, G); p.e(q[0], q[1], 1.8, 1.8, W); }); }
      else { [[2, 3], [13, 3], [2, 12], [13, 12], [8, 1], [8, 14], [1, 8], [14, 8]].forEach(function (q) { p.r(q[0], q[1], 2, 2, G); p.px(q[0], q[1], W); }); }
    }, false);
  }
  function buildEnemies() {
    Art.slime = [0, 1, 2, 3].map(slime);
    Art.bat = [0, 1, 2, 3].map(bat);
    Art.ghost = [0, 1, 2].map(function (f) { return ghost(f, false); });
    Art.ghostChase = [0, 1, 2].map(function (f) { return ghost(f, true); });
    Art.golem = [0, 1, 2, 3].map(golem);
    Art.puff = [0, 1, 2].map(function (f) {
      var c = mkC(16, 16), x = c.getContext('2d'); // no outline for puffs
      var p = P(x);
      var W = '#f6f0e4', G = '#b8b0a4';
      if (f === 0) { p.e(8, 8, 4, 4, G); p.e(8, 8, 3, 3, W); p.px(8, 3, '#ffe45a'); p.px(8, 12, '#ffe45a'); p.px(3, 8, '#ffe45a'); p.px(12, 8, '#ffe45a'); }
      else if (f === 1) { [[5, 5], [11, 5], [4, 10], [12, 10], [8, 12], [8, 4]].forEach(function (q) { p.e(q[0], q[1], 2.6, 2.6, G); p.e(q[0], q[1], 1.8, 1.8, W); }); }
      else { [[2, 3], [13, 3], [2, 12], [13, 12], [8, 1], [8, 14], [1, 8], [14, 8]].forEach(function (q) { p.r(q[0], q[1], 2, 2, G); p.px(q[0], q[1], W); }); }
      return up(c);
    });
    ['slime', 'bat', 'ghost', 'golem'].forEach(function (t) { });
    Art.white = {};
  }

  /* ---------------- Themes ---------------- */
  var THEMES = [
    { fl: ['#8c5c36', '#7f5230'], fd: '#6a4226', fh: '#a4703f', wall: '#4a2e1a', wHi: '#6e4826', wLo: '#2c1a0c', pil: '#c9935a', pHi: '#efbb7c', pLo: '#87552b', rock: '#b8a48c', rHi: '#dccbb2', rLo: '#7a6856', acc: '#ffd070', kind: 'wood' },
    { fl: ['#1d6a62', '#185e57'], fd: '#134a45', fh: '#2a8a7c', wall: '#2f1a58', wHi: '#4b2f86', wLo: '#1a0e34', pil: '#7a48c8', pHi: '#a878f0', pLo: '#48268a', rock: '#a894d6', rHi: '#d0c2f4', rLo: '#6a58a0', acc: '#ff7ad9', kind: 'mush' },
    { fl: ['#2a5c9c', '#245090'], fd: '#1a3c74', fh: '#4a86c8', wall: '#12305e', wHi: '#20508e', wLo: '#0a1a38', pil: '#38b4e8', pHi: '#9cecff', pLo: '#1c78b0', rock: '#8cbce6', rHi: '#d4f0ff', rLo: '#527ea8', acc: '#b8f4ff', kind: 'crystal' },
    { fl: ['#7c3220', '#702a1a'], fd: '#521c10', fh: '#a04a2a', wall: '#2e0e0c', wHi: '#4e1c14', wLo: '#180605', pil: '#a8442a', pHi: '#e07a3a', pLo: '#6a2214', rock: '#4c3a3c', rHi: '#7a6262', rLo: '#2a1e20', acc: '#ff9a1a', kind: 'lava' },
    { fl: ['#161a44', '#12163a'], fd: '#0c0f2a', fh: '#262c66', wall: '#080a20', wHi: '#141a44', wLo: '#03040e', pil: '#2a3080', pHi: '#4a58c8', pLo: '#141850', rock: '#343a86', rHi: '#5a66c0', rLo: '#1a1e50', acc: '#5af0ff', kind: 'dark' }
  ];

  function tile(fn) { var c = mkC(16, 16), x = c.getContext('2d'); fn(P(x), x); return up(c); }

  function decorAcc(p, t, rng, n, region) {
    for (var i = 0; i < n; i++) {
      var x = region[0] + Math.floor(rng() * region[2]), y = region[1] + Math.floor(rng() * region[3]);
      p.px(x, y, t.acc);
    }
  }

  function buildTheme(t, idx) {
    var th = { floor: [], crumble: [] };
    [0, 1].forEach(function (v) {
      th.floor.push(tile(function (p) {
        var rng = seeded(100 + idx * 10 + v);
        p.r(0, 0, 16, 16, t.fl[v]);
        for (var i = 0; i < 9; i++) p.px(Math.floor(rng() * 16), Math.floor(rng() * 16), rng() < 0.5 ? t.fd : t.fh);
        p.r(0, 15, 16, 1, t.fd); p.r(15, 0, 1, 16, t.fd);
        p.r(0, 0, 16, 1, t.fh); p.r(0, 0, 1, 16, t.fh);
        if (t.kind === 'dark') p.r(0, 0, 16, 1, t.fd), p.r(0, 0, 1, 16, t.fd);
      }));
    });
    th.floor.push(tile(function (p) { // decor variant
      p.r(0, 0, 16, 16, t.fl[0]);
      var rng = seeded(200 + idx);
      for (var i = 0; i < 7; i++) p.px(Math.floor(rng() * 16), Math.floor(rng() * 16), rng() < 0.5 ? t.fd : t.fh);
      p.r(0, 15, 16, 1, t.fd); p.r(15, 0, 1, 16, t.fd); p.r(0, 0, 16, 1, t.fh); p.r(0, 0, 1, 16, t.fh);
      if (t.kind === 'wood') { p.e(10, 10, 2.5, 1.8, t.fd); p.e(10, 9.5, 2, 1.2, '#b08a62'); p.px(4, 5, '#5a8a3a'); p.px(5, 4, '#5a8a3a'); p.px(3, 4, '#7ab04a'); }
      else if (t.kind === 'mush') { p.r(9, 9, 2, 3, '#e8e0f0'); p.e(10, 8.5, 3, 2, t.acc); p.px(9, 8, '#fff'); p.px(11, 9, '#a03a90'); p.px(4, 4, '#7af0d0'); p.px(3, 5, '#7af0d0'); }
      else if (t.kind === 'crystal') { p.r(10, 8, 2, 5, '#7ad0f8'); p.r(10, 7, 1, 1, '#d8f8ff'); p.r(8, 10, 2, 3, '#5ab0e8'); p.px(11, 9, '#fff'); }
      else if (t.kind === 'lava') { p.r(3, 10, 4, 1, '#ff9a1a'); p.r(6, 9, 3, 1, '#ff9a1a'); p.r(8, 8, 3, 1, '#ffd23a'); p.r(3, 11, 2, 1, '#c8460a'); }
      else { p.px(10, 10, t.acc); p.px(9, 10, '#2a7a90'); p.px(11, 10, '#2a7a90'); p.px(10, 9, '#2a7a90'); p.px(10, 11, '#2a7a90'); p.px(4, 5, '#5a66c0'); }
    }));
    th.wall = tile(function (p) {
      var rng = seeded(300 + idx);
      p.r(0, 0, 16, 16, t.wall);
      for (var row = 0; row < 3; row++) {
        var y = row * 5 + 1;
        p.r(0, y + 4, 16, 1, t.wLo);
        p.r(0, y, 16, 1, t.wHi);
        var off = row % 2 ? 4 : 0;
        for (var x = off; x < 16; x += 8) p.r(x, y, 1, 5, t.wLo);
      }
      p.r(0, 0, 16, 1, t.wLo);
      if (t.kind === 'wood') { p.r(0, 6, 16, 3, '#7a5028'); p.r(0, 6, 16, 1, '#a07040'); p.r(0, 8, 16, 1, '#4a2e12'); p.px(3, 7, '#c0c0c8'); p.px(12, 7, '#c0c0c8'); }
      else if (t.kind === 'mush') { p.e(4, 13, 2, 1.5, t.acc); p.r(4, 14, 1, 2, '#e8e0f0'); p.px(11, 5, '#7af0d0'); p.px(12, 5, '#7af0d0'); p.px(11, 6, '#7af0d0'); }
      else if (t.kind === 'crystal') { p.r(11, 2, 2, 5, '#5ab0e8'); p.r(11, 1, 1, 1, '#d8f8ff'); p.r(3, 9, 2, 4, '#7ad0f8'); p.px(3, 8, '#fff'); }
      else if (t.kind === 'lava') { p.r(2, 5, 5, 1, '#ff7a1a'); p.r(6, 6, 1, 4, '#ff7a1a'); p.r(7, 10, 5, 1, '#ffb43a'); p.r(11, 11, 1, 3, '#ff7a1a'); }
      else { decorAcc(p, t, rng, 5, [1, 1, 14, 14]); p.px(8, 8, '#fff'); }
    });
    th.pillar = tile(function (p) {
      p.r(0, 0, 16, 16, t.fl[0]);
      p.r(1, 1, 14, 14, t.pLo);
      p.r(2, 2, 12, 11, t.pil);
      p.r(2, 2, 12, 3, t.pHi);
      p.r(2, 5, 12, 1, t.pLo);
      p.r(13, 2, 1, 11, t.pLo);
      p.r(1, 13, 14, 2, t.wLo);
      p.px(3, 3, '#fff');
      if (t.kind === 'wood') { p.r(6, 5, 4, 8, '#8a5a2c'); p.r(6, 5, 1, 8, '#b98850'); p.px(7, 6, '#3a220e'); p.px(8, 10, '#3a220e'); p.r(2, 8, 12, 1, '#87552b'); }
      else if (t.kind === 'mush') { p.e(8, 8, 3.2, 2.2, '#ff7ad9'); p.px(7, 7, '#fff'); p.px(9, 8, '#a03a90'); p.r(7, 10, 2, 3, '#e8e0f0'); }
      else if (t.kind === 'crystal') { p.r(7, 5, 2, 8, '#e0fbff'); p.r(6, 8, 1, 4, '#9cecff'); p.r(9, 7, 1, 5, '#9cecff'); }
      else if (t.kind === 'lava') { p.r(4, 7, 8, 1, '#ffb43a'); p.r(7, 7, 1, 5, '#ff7a1a'); p.px(5, 10, '#ff7a1a'); }
      else { p.px(5, 8, t.acc); p.px(10, 6, t.acc); p.px(8, 11, t.acc); p.r(7, 8, 2, 2, '#182060'); }
    });
    function rockShape(p, scale, alpha) {
      var s = scale;
      p.e(8, 8.6, 6.9 * s, 6.1 * s, t.rLo);
      p.e(8, 8, 6.2 * s, 5.5 * s, t.rock);
      p.e(6, 5.2, 3.4 * s, 2 * s, t.rHi);
      p.px(4, 9, t.rLo); p.px(5, 10, t.rLo); p.px(6, 11, t.rLo); p.px(10, 6, t.rLo); p.px(11, 7, t.rLo); p.px(11, 8, t.rLo);
      p.px(10, 10, t.rHi); p.px(11, 4, t.rHi);
      if (t.kind === 'lava') { p.px(5, 10, '#ff9a1a'); p.px(6, 11, '#ff9a1a'); p.px(11, 8, '#ff9a1a'); p.px(10, 6, '#ffb43a'); }
      else if (t.kind === 'dark') { p.px(5, 10, t.acc); p.px(11, 7, t.acc); p.px(8, 8, '#8af6ff'); }
      else if (t.kind === 'crystal') { p.r(9, 9, 2, 3, '#e4faff'); p.px(9, 8, '#fff'); }
      else if (t.kind === 'mush') { p.px(5, 8, '#ff7ad9'); p.px(11, 10, '#7af0d0'); }
    }
    th.rock = sprite(function (p) { rockShape(p, 1); }, t.wLo);
    for (var f = 0; f < 3; f++) {
      th.crumble.push((function (f) {
        return sprite(function (p) {
          if (f === 0) { rockShape(p, 0.85); p.px(7, 6, t.wLo); p.px(8, 7, t.wLo); p.px(8, 8, t.wLo); p.px(9, 9, t.wLo); p.px(6, 9, t.wLo); }
          else {
            var rng = seeded(500 + idx * 7 + f);
            var n = 9;
            for (var i = 0; i < n; i++) {
              var a = i / n * Math.PI * 2 + 0.3, d = f === 1 ? 3.5 : 6;
              var x = Math.round(8 + Math.cos(a) * d), y = Math.round(8 + Math.sin(a) * d);
              var sz = f === 1 ? (i % 2 ? 3 : 2) : (i % 2 ? 2 : 1);
              p.r(x - 1, y - 1, sz, sz, i % 3 === 0 ? t.rHi : i % 3 === 1 ? t.rock : t.rLo);
            }
            if (f === 1) { p.r(6, 6, 4, 4, t.rLo); p.r(7, 7, 2, 2, t.rock); }
          }
        }, false);
      })(f));
    }
    // remove outlines from crumble frames 1,2 (already transparent outline color) - fine.
    return th;
  }

  /* ---------------- Objects ---------------- */
  function buildObjects() {
    Art.exitClosed = sprite(function (p) {
      p.r(1, 1, 14, 14, '#4a4e5c'); p.r(2, 2, 12, 12, '#6a707e'); p.r(2, 2, 12, 1, '#9aa0ae');
      p.r(2, 7, 12, 2, '#3a3e4a'); p.r(7, 2, 2, 12, '#3a3e4a');
      p.r(6, 6, 4, 4, '#c8ccd8'); p.r(7, 7, 2, 2, '#d23a3a'); p.px(3, 3, '#e8ecf4'); p.px(12, 3, '#e8ecf4'); p.px(3, 12, '#2a2e38'); p.px(12, 12, '#2a2e38');
    }, '#14161e');
    Art.exitOpen = [0, 1].map(function (f) {
      return sprite(function (p) {
        p.r(1, 1, 14, 14, f ? '#ffe45a' : '#ffb42a');
        p.r(2, 2, 12, 12, '#0c0a18');
        p.r(3, 3, 10, 10, '#1c1638');
        p.r(5, 2, 1, 12, '#c9a25a'); p.r(10, 2, 1, 12, '#c9a25a');
        for (var y = 3; y < 14; y += 3) p.r(5, y, 6, 1, '#e8c47a');
        p.px(2, 2, '#fff'); p.px(13, 2, f ? '#fff' : '#ffe45a'); p.px(2, 13, f ? '#ffe45a' : '#fff');
        p.r(7, 2, 2, 12, f ? '#fff6b0' : '#c8b060');
        p.r(6, 3, 4, 1, 'rgba(255,240,160,0.9)');
      }, '#3a2a10');
    });
    var bomb = function (f, flash) {
      return sprite(function (p) {
        p.r(3, 6, 4, 8, '#d02828'); p.r(6, 6, 4, 8, '#e84a2a'); p.r(9, 7, 4, 7, '#c02020');
        p.r(3, 6, 10, 1, '#f08a5a'); p.r(4, 6, 1, 8, '#ff7a5a');
        p.r(3, 9, 10, 2, '#22222c'); p.px(5, 9, '#4a4a5a'); p.px(10, 9, '#4a4a5a');
        p.r(3, 13, 10, 1, '#7a1414');
        p.px(8, 5, '#c8b070'); p.px(8, 4, '#c8b070'); p.px(9, 3, '#c8b070'); p.px(10, 3, '#a08850');
        var sc = ['#ffd23a', '#ffffff', '#ff8a1a'][f];
        p.px(11, 2, sc); p.px(10, 2, sc); p.px(12, 2, sc); p.px(11, 1, sc); p.px(11, 3, sc);
        if (f === 1) { p.px(13, 1, '#ffd23a'); p.px(9, 1, '#ff8a1a'); }
        if (f === 2) { p.px(12, 1, '#ffd23a'); }
      });
    };
    Art.bomb = [0, 1, 2].map(function (f) { return bomb(f); });
    Art.bombFlash = Art.bomb.map(function (c) { return tint(c, 'rgba(255,255,255,0.75)'); });

    // flames
    function flameSet(f) {
      var o = {};
      o.center = sprite(function (p) {
        var j = f ? 1 : 0;
        p.e(8, 8, 7.4 - j * 0.6, 7.4 - j * 0.6, '#e8480e');
        p.e(8, 8, 6 - j * 0.5, 6 - j * 0.5, '#ff8a1a');
        p.e(8, 8, 4.2, 4.2, '#ffc82a');
        p.e(8, 8, 2.4, 2.4, '#fffbd0');
        if (f) { p.px(1, 8, '#ff8a1a'); p.px(14, 7, '#ffc82a'); p.px(8, 1, '#ffc82a'); p.px(7, 14, '#ff8a1a'); }
        else { p.px(2, 4, '#ffc82a'); p.px(13, 12, '#ff8a1a'); p.px(12, 2, '#ff8a1a'); p.px(3, 13, '#ffc82a'); }
      }, false);
      var armH = sprite(function (p) {
        var j = f ? 1 : 0;
        p.r(0, 3 + j, 16, 10 - j * 2, '#e8480e'); p.r(0, 4 + j, 16, 8 - j * 2, '#ff8a1a');
        p.r(0, 5, 16, 6, '#ffc82a'); p.r(0, 7, 16, 2, '#fffbd0');
        for (var x = (f ? 1 : 3); x < 16; x += 5) { p.px(x, 3 + j, '#ff8a1a'); p.px(x + 2, 12 - j, '#e8480e'); p.px(x + 1, 3 + j, 'rgba(0,0,0,0)'); }
      }, false);
      o.h = armH; o.v = rot(armH, 90);
      var tipR = sprite(function (p) {
        var j = f ? 1 : 0;
        p.r(0, 3, 9, 10, '#e8480e'); p.e(9, 8, 6.4 - j * 0.5, 5, '#e8480e');
        p.r(0, 4, 9, 8, '#ff8a1a'); p.e(9, 8, 5.4 - j * 0.5, 4, '#ff8a1a');
        p.r(0, 5, 9, 6, '#ffc82a'); p.e(9, 8, 4, 3, '#ffc82a');
        p.r(0, 7, 9, 2, '#fffbd0'); p.e(8.5, 8, 2.6, 1, '#fffbd0');
      }, false);
      o.tip = { right: tipR, down: rot(tipR, 90), left: rot(tipR, 180), up: rot(tipR, 270) };
      return o;
    }
    Art.flame = [flameSet(0), flameSet(1)];

    // items
    function badge(col, dark, icon, sp) {
      return sprite(function (p) {
        p.r(2, 2, 12, 12, dark); p.r(3, 1, 10, 14, dark); p.r(1, 3, 14, 10, dark);
        p.r(3, 2, 10, 12, col); p.r(2, 3, 12, 10, col);
        p.r(3, 2, 10, 1, 'rgba(255,255,255,0.45)');
        icon(p);
        if (sp) { p.px(12, 3, '#fff'); p.px(11, 3, '#fff'); p.px(12, 4, '#fff'); p.px(12, 2, '#fff'); }
        else { p.px(4, 12, '#fff'); p.px(3, 12, '#fff'); p.px(4, 11, '#fff'); p.px(4, 13, '#fff'); }
      });
    }
    var icons = {
      fire: [ '#d63a2a', '#7a1410', function (p) { p.e(8, 9, 2.8, 3.4, '#ffd23a'); p.r(7, 4, 2, 3, '#ffd23a'); p.px(8, 3, '#ffd23a'); p.e(8, 10, 1.4, 1.8, '#fffbd0'); p.px(6, 6, '#ffd23a'); }],
      bomb: [ '#2b6fd6', '#122c6a', function (p) { p.e(7.5, 9.5, 3.2, 3.2, '#16161e'); p.px(6, 8, '#6a6a80'); p.r(9, 5, 1, 2, '#c8b070'); p.px(10, 4, '#ffd23a'); p.px(11, 4, '#ff8a1a'); p.px(10, 3, '#ff8a1a'); }],
      boots: [ '#2fa84f', '#0e4a20', function (p) { p.r(5, 4, 4, 6, '#f4e6c8'); p.r(5, 9, 7, 3, '#f4e6c8'); p.r(5, 4, 4, 1, '#fff'); p.r(5, 11, 7, 1, '#8a6a3a'); p.px(11, 9, '#8a6a3a'); }],
      life: [ '#e0508a', '#7a1440', function (p) { p.e(6, 6.5, 2.4, 2.2, '#fff'); p.e(10, 6.5, 2.4, 2.2, '#fff'); p.r(4, 7, 8, 2, '#fff'); p.r(5, 9, 6, 1, '#fff'); p.r(6, 10, 4, 1, '#fff'); p.px(7, 11, '#fff'); p.px(8, 11, '#fff'); p.px(5, 5, '#ffc0d8'); }]
    };
    Art.item = {};
    Object.keys(icons).forEach(function (k) {
      Art.item[k] = [badge(icons[k][0], icons[k][1], icons[k][2], false), badge(icons[k][0], icons[k][1], icons[k][2], true)];
    });

    // HUD panel
    var hp = mkC(480, 64), hx = hp.getContext('2d');
    hx.fillStyle = '#1e1618'; hx.fillRect(0, 0, 480, 64);
    for (var y = 0; y < 64; y += 16) {
      hx.fillStyle = '#2c2024'; hx.fillRect(0, y + 14, 480, 2);
      for (var x = (y / 16 % 2) * 16; x < 480; x += 32) { hx.fillStyle = '#2c2024'; hx.fillRect(x, y, 2, 16); }
      hx.fillStyle = '#382a2e'; hx.fillRect(0, y, 480, 2);
    }
    hx.fillStyle = '#0c0808'; hx.fillRect(0, 60, 480, 4);
    hx.fillStyle = '#8a5a2a'; hx.fillRect(0, 58, 480, 2);
    hx.fillStyle = '#c8894a'; hx.fillRect(0, 56, 480, 2);
    Art.hud = hp;

    // light sprite
    var ls = mkC(128, 128), lx = ls.getContext('2d');
    var g = lx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,0.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    lx.fillStyle = g; lx.fillRect(0, 0, 128, 128);
    Art.light = ls;
    // vignette
    var vg = mkC(480, 352), vx = vg.getContext('2d');
    var vgr = vx.createRadialGradient(240, 176, 150, 240, 176, 320);
    vgr.addColorStop(0, 'rgba(0,0,0,0)'); vgr.addColorStop(1, 'rgba(0,0,0,0.5)');
    vx.fillStyle = vgr; vx.fillRect(0, 0, 480, 352);
    Art.vignette = vg;
  }

  /* ---------------- Title ---------------- */
  function buildTitle() {
    // logo (<= 440x120)
    var lg = mkC(440, 120), x = lg.getContext('2d');
    x.imageSmoothingEnabled = false;
    function layer(str, cx, y, s, color, dx, dy) {
      var w = Font.width(str, s), at = Font.atlas(color), x0 = Math.round(cx - w / 2) + dx;
      for (var i = 0; i < str.length; i++) x.drawImage(at, Font.index[str[i]] * 5, 0, 5, 7, x0 + i * 6 * s, y + dy, 5 * s, 7 * s);
    }
    function word(str, cx, y, s) {
      var d, e;
      for (d = -4; d <= 4; d += 4) for (e = -4; e <= 4; e += 4) layer(str, cx, y, s, '#1a0a06', d, e + 8);
      for (e = 8; e >= 4; e -= 2) layer(str, cx, y, s, '#9a2010', 0, e);
      layer(str, cx, y, s, '#ff9a1a', 0, 0);
      x.save(); x.beginPath(); x.rect(0, y, 440, 3.5 * s); x.clip();
      layer(str, cx, y, s, '#ffe27a', 0, 0); x.restore();
    }
    word('DYNAMITE', 220, 6, 7);
    word('MOLE', 220, 64, 7);
    // fuse spark decoration
    x.fillStyle = '#ffe45a'; x.fillRect(370, 66, 8, 8); x.fillStyle = '#fff'; x.fillRect(372, 68, 4, 4);
    Art.logo = lg;

    // background
    var bg = mkC(480, 416), b = bg.getContext('2d');
    var rng = seeded(4242);
    for (var y = 0; y < 416; y += 8) {
      var t = y / 416;
      b.fillStyle = 'rgb(' + Math.round(18 + t * 30) + ',' + Math.round(12 + t * 14) + ',' + Math.round(32 - t * 10) + ')';
      b.fillRect(0, y, 480, 8);
    }
    // distant rock walls
    for (var i = 0; i < 26; i++) {
      var bx = Math.floor(rng() * 480 / 8) * 8, bw = 24 + Math.floor(rng() * 5) * 8, bh = 40 + Math.floor(rng() * 8) * 8;
      b.fillStyle = i % 2 ? '#241832' : '#1c1226';
      b.fillRect(bx, 416 - 66 - bh, bw, bh);
    }
    // stalactites
    for (i = 0; i < 16; i++) {
      var sx = Math.floor(rng() * 480 / 8) * 8, sw = 16 + Math.floor(rng() * 4) * 8, sh = 24 + Math.floor(rng() * 9) * 8;
      for (var yy = 0; yy < sh; yy += 4) {
        var ww = Math.max(4, Math.round((sw * (1 - yy / sh)) / 4) * 4);
        b.fillStyle = '#3a2a4a'; b.fillRect(sx + (sw - ww) / 2, yy, ww, 4);
        b.fillStyle = '#54406a'; b.fillRect(sx + (sw - ww) / 2, yy, Math.min(4, ww), 4);
      }
    }
    // ground
    for (var gy = 350; gy < 416; gy += 16) {
      for (var gx = ((gy / 16) % 2) * 16; gx < 496; gx += 32) {
        b.fillStyle = '#4a2e1a'; b.fillRect(gx - 16, gy, 32, 16);
        b.fillStyle = '#6a4526'; b.fillRect(gx - 16, gy, 32, 2);
        b.fillStyle = '#2c1a0c'; b.fillRect(gx - 16, gy + 14, 32, 2); b.fillRect(gx + 14, gy, 2, 16);
      }
    }
    // crystals
    [[40, 350, '#5ab0e8'], [72, 358, '#7ad0f8'], [400, 352, '#ff7ad9'], [436, 360, '#b878ff']].forEach(function (c) {
      for (var k = 0; k < 4; k++) { b.fillStyle = c[2]; b.fillRect(c[0] + k * 4, c[1] - (k % 2 ? 24 : 40) , 4, (k % 2 ? 24 : 40)); b.fillStyle = '#ffffff'; b.fillRect(c[0] + k * 4, c[1] - (k % 2 ? 24 : 40), 2, 4); }
    });
    // wooden beams
    [[12, 0], [452, 0]].forEach(function (p) {
      b.fillStyle = '#6b4526'; b.fillRect(p[0], 0, 16, 416); b.fillStyle = '#8a5a2c'; b.fillRect(p[0], 0, 4, 416);
      b.fillStyle = '#3a220e'; b.fillRect(p[0] + 14, 0, 2, 416);
      for (var yy = 20; yy < 416; yy += 48) { b.fillStyle = '#3a220e'; b.fillRect(p[0] + 6, yy, 4, 4); }
    });
    b.fillStyle = '#6b4526'; b.fillRect(12, 20, 456, 16); b.fillStyle = '#8a5a2c'; b.fillRect(12, 20, 456, 4); b.fillStyle = '#3a220e'; b.fillRect(12, 34, 456, 2);
    Art.titleBg = bg;
  }

  function buildAll() {
    buildMole(); buildEnemies(); buildObjects();
    Art.themes = THEMES.map(buildTheme);
    Art.themeDef = THEMES;
    buildTitle();
    Art.tint = tint;
  }
  Art.build = buildAll;
  window.Art = Art;
})();
