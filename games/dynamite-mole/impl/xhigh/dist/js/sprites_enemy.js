/* sprites_enemy.js - slime (A04), bat (A05), ghost (A06), golem (A07), enemy death puffs (A08). */
(function () {
  'use strict';
  var DM = window.DM;
  var sh = DM.sh;
  var ell = sh.ell, rect = sh.rect, rrect = sh.rrect, sub = sh.sub, mv = sh.mv, and = sh.and, seg = sh.seg, poly = sh.poly, or = sh.or;

  var SHADOW = '#00000058';

  /* ---------------- slime ---------------- */
  function slime(w, h, look) {
    var S = new DM.Spr(32);
    var base = 28.2;
    S.fill(ell(16, 29.3, w * 0.95 + 1, 2), SHADOW);
    var dome = or(and(ell(16, base, w, h), function (x, y) {
      return y <= base;
    }), rrect(16 - w, base - 2.2, 16 + w, base + 0.9, 1.6));
    S.fill(dome, '#4fd25e');
    S.fill(sub(dome, mv(dome, -1.8, -1.6)), '#26a04c');
    S.fill(and(sub(dome, mv(dome, -3.4, -2.8)), function (x, y) {
      return y > base - 2.4;
    }), '#187a3c');
    /* gloss */
    S.fill(ell(16 - w * 0.42, base - h * 0.72, 2.8, 1.6), '#b6f78e');
    S.fill(ell(16 - w * 0.42 - 2.8, base - h * 0.72 + 2, 0.9, 1), '#d9ffc0');
    /* eyes */
    var ey = base - h * 0.42;
    var ex = 3.6 + (w - 11) * 0.2;
    [16 - ex, 16 + ex].forEach(function (x) {
      S.fill(ell(x, ey, 2.4, 2.9), '#ffffff');
      S.fill(ell(x + (look || 0) * 0.6, ey + 0.5, 1.35, 1.9), '#20142a');
      S.fill(ell(x + (look || 0) * 0.6 - 0.4, ey - 0.2, 0.55, 0.6), '#ffffff');
    });
    /* mouth */
    S.fill(rect(15, ey + 3.6, 17, ey + 4.5), '#187a3c');
    S.fill(rect(14, ey + 3, 15, ey + 3.9), '#187a3c');
    S.fill(rect(17, ey + 3, 18, ey + 3.9), '#187a3c');
    return S.outline('#14401f');
  }

  /* ---------------- bat ---------------- */
  var WING = {
    up: [11.5, 14, 7.5, 8.5, 2.5, 3.5, 3.6, 9.4, 6.2, 9.4, 5.4, 13.6, 8.6, 13.6, 8.6, 18, 11.5, 19],
    mid: [11.5, 14.5, 6, 12, 1.2, 11, 3, 15, 5.6, 14.6, 5.2, 18.2, 8.6, 17.4, 9, 20.6, 11.5, 19.5],
    down: [11.5, 15, 7, 17.2, 2.2, 23, 4.6, 23, 5.6, 20.6, 7.6, 24.6, 9.2, 21.6, 11, 23.2, 11.5, 19.5]
  };
  function mirrorPts(p) {
    var o = [];
    for (var i = 0; i < p.length; i += 2) o.push(32 - p[i], p[i + 1]);
    return o;
  }
  function bat(wing, hover) {
    var S = new DM.Spr(32);
    var dy = hover || 0;
    var pts = WING[wing];
    var L = poly(pts.map(function (v, i) {
      return i % 2 ? v + dy : v;
    }));
    var R = poly(
      mirrorPts(pts).map(function (v, i) {
        return i % 2 ? v + dy : v;
      })
    );
    [L, R].forEach(function (W) {
      S.fill(W, '#7a48c0');
      S.fill(sub(W, mv(W, 0, -1.6)), '#4c2a86');
    });
    /* wing bones */
    var t = pts;
    [[t[0], t[1], t[4], t[5]], [t[0] + 0.5, t[1] + 1.5, t[8] + 1, t[9] + 1]].forEach(function (b) {
      S.fill(seg(b[0], b[1] + dy, b[2], b[3] + dy, 0.9), '#b898f0');
      S.fill(seg(32 - b[0], b[1] + dy, 32 - b[2], b[3] + dy, 0.9), '#b898f0');
    });
    /* ears */
    S.fill(poly([11.6, 12 + dy, 12.2, 6.6 + dy, 15.2, 11 + dy]), '#5a3496');
    S.fill(poly([20.4, 12 + dy, 19.8, 6.6 + dy, 16.8, 11 + dy]), '#5a3496');
    S.fill(poly([12.6, 10.6 + dy, 12.8, 8.6 + dy, 14, 10.4 + dy]), '#ff9ac4');
    S.fill(poly([19.4, 10.6 + dy, 19.2, 8.6 + dy, 18, 10.4 + dy]), '#ff9ac4');
    /* body */
    var body = ell(16, 16.6 + dy, 5.6, 6.2);
    S.fill(body, '#6a3fae');
    S.fill(sub(body, mv(body, -1.4, -1.3)), '#432575');
    S.fill(ell(14, 13.6 + dy, 2.4, 1.4), '#a07ce0');
    S.fill(ell(16, 19.6 + dy, 3, 2.6), '#c8a8ff');
    /* eyes */
    [13.6, 18.4].forEach(function (x) {
      S.fill(ell(x, 15.8 + dy, 1.7, 1.9), '#ffffff');
      S.fill(ell(x, 16.1 + dy, 1.1, 1.4), '#ff2a3a');
      S.fill(rect(x - 0.4, 15.4 + dy, x + 0.3, 16.1 + dy), '#ffd0d0');
    });
    /* fangs */
    S.fill(poly([14.4, 19.6 + dy, 15.6, 19.6 + dy, 15, 21.6 + dy]), '#ffffff');
    S.fill(poly([16.4, 19.6 + dy, 17.6, 19.6 + dy, 17, 21.6 + dy]), '#ffffff');
    return S.outline('#1c0d38');
  }

  /* ---------------- ghost ---------------- */
  function ghost(phase, dy, chase, aw) {
    var S = new DM.Spr(32);
    S.fill(ell(16, 29.3, 7 + (dy ? 0 : 0.6), 1.7), SHADOW);
    var y0 = 5 + dy;
    var body = or(ell(16, y0 + 9, 9.4, 9.4), function (x, y) {
      if (x < 6.6 || x > 25.4 || y < y0 + 9) return false;
      var yb = y0 + 19.2 + 2.2 * Math.cos(((x - 6.6) / 18.8) * 3 * Math.PI * 2 + phase);
      return y < yb;
    });
    var c1 = chase ? '#ece2ff' : '#f2f8ff';
    var c2 = chase ? '#b6a2e6' : '#bcd2f0';
    var c3 = chase ? '#8a72c8' : '#8eaed8';
    S.fill(body, c1);
    S.fill(sub(body, mv(body, -1.8, -1.2)), c2);
    S.fill(and(sub(body, mv(body, -3.6, -2.4)), function (x, y) {
      return y < y0 + 17;
    }), c3);
    S.fill(ell(11.4, y0 + 4.2, 2.8, 1.6), '#ffffff');
    /* arms */
    S.fill(ell(6.2, y0 + 12 + aw, 2.2, 3.2), c2);
    S.fill(ell(25.8, y0 + 12 - aw, 2.2, 3.2), c2);
    /* face */
    if (chase) {
      S.fill(ell(12.4, y0 + 8.4, 2.5, 2.9), '#2a0a18');
      S.fill(ell(19.6, y0 + 8.4, 2.5, 2.9), '#2a0a18');
      S.fill(ell(12.4, y0 + 8.7, 1.6, 2), '#ff2a2a');
      S.fill(ell(19.6, y0 + 8.7, 1.6, 2), '#ff2a2a');
      S.fill(rect(11.6, y0 + 7.8, 12.3, y0 + 8.5), '#ffd8d8');
      S.fill(rect(18.8, y0 + 7.8, 19.5, y0 + 8.5), '#ffd8d8');
      /* angry brows */
      S.fill(seg(9.4, y0 + 4.6, 14.6, y0 + 6.6, 1.3), '#3a2060');
      S.fill(seg(22.6, y0 + 4.6, 17.4, y0 + 6.6, 1.3), '#3a2060');
      S.fill(ell(16, y0 + 14, 2.6, 2), '#2a0a18');
      S.fill(rect(14.2, y0 + 12.8, 15.2, y0 + 13.8), '#ffffff');
      S.fill(rect(16.8, y0 + 12.8, 17.8, y0 + 13.8), '#ffffff');
    } else {
      S.fill(ell(12.4, y0 + 8.4, 1.7, 2.5), '#20204a');
      S.fill(ell(19.6, y0 + 8.4, 1.7, 2.5), '#20204a');
      S.fill(ell(12, y0 + 7.5, 0.6, 0.7), '#ffffff');
      S.fill(ell(19.2, y0 + 7.5, 0.6, 0.7), '#ffffff');
      S.fill(ell(16, y0 + 13, 1.6, 1.9), '#20204a');
      S.fill(ell(9.2, y0 + 11.6, 1.4, 0.9), '#ffc0d8');
      S.fill(ell(22.8, y0 + 11.6, 1.4, 0.9), '#ffc0d8');
    }
    return S.outline(chase ? '#3a2470' : '#34467e');
  }

  /* ---------------- golem ---------------- */
  var G = { base: '#8e91a4', light: '#bcc0d2', dark: '#5c5f78', deep: '#3d3f56', moss: '#5eaa4a', mossD: '#3a7a34', eye: '#ffb62a', eyeL: '#fff0a0' };
  function golem(bob, legA, legB, armA, armB) {
    var S = new DM.Spr(32);
    S.fill(ell(16, 29.4, 10.6, 2.2), SHADOW);
    /* legs */
    [[9.2, legA], [17.8, legB]].forEach(function (l) {
      var r = rrect(l[0], 23.6 - l[1], l[0] + 5.2, 28.6 - l[1] * 0.6, 1.4);
      S.fill(r, G.dark);
      S.fill(and(r, rect(0, 0, l[0] + 2.4, 40)), G.base);
    });
    /* arms */
    [[2.4, armA, -1], [24.6, armB, 1]].forEach(function (a) {
      var ay = 13.6 + bob + a[1];
      var r = rrect(a[0], ay, a[0] + 5.2, ay + 8.6, 2);
      S.fill(r, G.base);
      S.fill(sub(r, mv(r, -1.2, -1.2)), G.dark);
      var fist = rrect(a[0] - 0.8, ay + 6.2, a[0] + 6, ay + 11.6, 2.2);
      S.fill(fist, G.base);
      S.fill(sub(fist, mv(fist, -1.3, -1.3)), G.dark);
      S.fill(rect(a[0] + 1.6, ay + 8.2, a[0] + 2.4, ay + 10.6), G.deep);
      S.fill(rect(a[0] + 3.4, ay + 8.2, a[0] + 4.2, ay + 10.6), G.deep);
    });
    /* torso */
    var tor = rrect(7, 12 + bob, 25, 25 + bob, 3);
    S.fill(tor, G.base);
    S.fill(sub(tor, mv(tor, -1.8, -1.6)), G.dark);
    S.fill(rrect(8.4, 13.4 + bob, 16.4, 16.4 + bob, 1.4), G.light);
    /* cracks + moss */
    S.fill(seg(18, 15.4 + bob, 20.4, 18 + bob, 0.8), G.deep);
    S.fill(seg(20.4, 18 + bob, 19.4, 21.4 + bob, 0.8), G.deep);
    S.fill(seg(11, 20 + bob, 13.4, 22.4 + bob, 0.8), G.deep);
    S.fill(ell(21.4, 14.4 + bob, 2.8, 1.5), G.moss);
    S.fill(ell(22.6, 15.6 + bob, 1.6, 1.1), G.mossD);
    S.fill(ell(10.6, 23 + bob, 2.4, 1.2), G.moss);
    /* head */
    var head = rrect(9.6, 3.6 + bob, 22.4, 14.2 + bob, 2.8);
    S.fill(head, G.base);
    S.fill(sub(head, mv(head, -1.6, -1.6)), G.dark);
    S.fill(rrect(10.8, 4.6 + bob, 17, 6.6 + bob, 1), G.light);
    S.fill(ell(19.6, 4.8 + bob, 2.6, 1.2), G.moss);
    /* glowing eyes */
    [12.6, 17.8].forEach(function (x) {
      S.fill(rect(x - 0.9, 7.2 + bob, x + 3.1, 10.4 + bob), G.deep);
      S.fill(rect(x - 0.1, 7.9 + bob, x + 2.3, 9.9 + bob), G.eye);
      S.fill(rect(x - 0.1, 7.9 + bob, x + 1.2, 8.7 + bob), G.eyeL);
    });
    /* mouth */
    S.fill(rect(12.4, 11.4 + bob, 19.6, 12.4 + bob), G.deep);
    S.fill(rect(14, 11.4 + bob, 14.9, 12.4 + bob), G.light);
    S.fill(rect(17, 11.4 + bob, 17.9, 12.4 + bob), G.light);
    return S.outline('#22243a');
  }

  /* ---------------- death puff ---------------- */
  function puff(k, c1, c2, c3, ol) {
    var S = new DM.Spr(32);
    var cx = 16, cy = 19;
    var blobs = 7;
    var R = 3.2 + k * 3.4;
    var rad = Math.max(1.4, 5.6 - k * 1.25);
    var i;
    if (k < 3) {
      for (i = 0; i < blobs; i++) {
        var a = (i / blobs) * Math.PI * 2 + 0.4;
        var bx = cx + Math.cos(a) * R * (i % 2 ? 1 : 0.8);
        var by = cy + Math.sin(a) * R * 0.85 * (i % 2 ? 1 : 0.8);
        S.fill(ell(bx, by, rad, rad * 0.92), c1);
      }
      S.fill(ell(cx, cy, Math.max(2, 6.5 - k * 1.6), Math.max(2, 5.8 - k * 1.4)), c1);
      for (i = 0; i < blobs; i++) {
        var a2 = (i / blobs) * Math.PI * 2 + 0.4;
        var bx2 = cx + Math.cos(a2) * R * (i % 2 ? 1 : 0.8) - 0.9;
        var by2 = cy + Math.sin(a2) * R * 0.85 * (i % 2 ? 1 : 0.8) - 0.9;
        S.fill(ell(bx2, by2, rad * 0.55, rad * 0.5), c2);
      }
      S.fill(and(ell(cx, cy, Math.max(2, 6.5 - k * 1.6), Math.max(2, 5.8 - k * 1.4)), function (x, y) {
        return x > cx + 1 && y > cy;
      }), c3);
      if (k === 0) {
        /* pop star */
        S.fill(rect(cx - 0.9, cy - 10, cx + 0.9, cy + 10), '#ffffff');
        S.fill(rect(cx - 10, cy - 0.9, cx + 10, cy + 0.9), '#ffffff');
        S.fill(seg(cx - 6.5, cy - 6.5, cx + 6.5, cy + 6.5, 1.4), '#fff3a0');
        S.fill(seg(cx - 6.5, cy + 6.5, cx + 6.5, cy - 6.5, 1.4), '#fff3a0');
        S.fill(ell(cx, cy, 3.6, 3.6), '#ffffff');
      }
      S.outline(ol);
    } else {
      /* dissipating specks that rise */
      for (i = 0; i < 9; i++) {
        var aa = (i / 9) * Math.PI * 2 + 1.1;
        var rr = 8 + (i % 3) * 2.6;
        var px = cx + Math.cos(aa) * rr, py = cy + Math.sin(aa) * rr * 0.8 - 3;
        S.fill(rect(px - 1, py - 1, px + 1, py + 1), i % 2 ? c1 : c2);
      }
      S.fill(ell(cx, cy - 1, 2.2, 1.8), c2);
    }
    return S;
  }

  DM.buildEnemySprites = function () {
    var out = { slime: [], bat: [], ghost: [], golem: [], golemFlash: [], death: {} };
    var sl = [
      [11.4, 13.2, 0],
      [12.8, 11.2, 0],
      [11.4, 13.2, 0],
      [10.4, 14.8, 0]
    ];
    sl.forEach(function (p) {
      out.slime.push(slime(p[0], p[1], p[2]).toCanvas());
    });
    out.bat = [bat('up', -1), bat('mid', 0), bat('down', 1), bat('mid', 0)].map(function (s) {
      return s.toCanvas();
    });
    /* ghost: frames 0-3 calm float, frames 4-7 chase mode (red eyes, arms raised) */
    var gdy = [0, 1, 1.6, 1];
    out.ghost = [0, 1, 2, 3]
      .map(function (k) {
        return ghost((k * Math.PI) / 2, gdy[k], false, [-1.2, 0, 1.2, 0][k]);
      })
      .concat(
        [0, 1, 2, 3].map(function (k) {
          return ghost((k * Math.PI) / 2 + 0.5, gdy[k], true, [-3, -2.2, -3.2, -2.2][k]);
        })
      )
      .map(function (s) {
        return s.toCanvas();
      });
    var gs = [golem(0, 0, 0, 0, 0), golem(-1, 1.6, 0, 1.2, -1.2), golem(0, 0, 0, 0, 0), golem(-1, 0, 1.6, -1.2, 1.2)];
    gs.forEach(function (g) {
      out.golem.push(g.toCanvas());
      out.golemFlash.push(g.silhouette('#ffffff').toCanvas());
    });
    var pal = {
      slime: ['#4fd25e', '#b6f78e', '#26a04c', '#14401f'],
      bat: ['#7a48c0', '#c8a8ff', '#4c2a86', '#1c0d38'],
      ghost: ['#f2f8ff', '#ffffff', '#bcd2f0', '#34467e'],
      golem: ['#8e91a4', '#d0d3e2', '#5c5f78', '#22243a']
    };
    Object.keys(pal).forEach(function (k) {
      var p = pal[k];
      out.death[k] = [0, 1, 2, 3].map(function (f) {
        return puff(f, p[0], p[1], p[2], p[3]).toCanvas();
      });
    });
    return out;
  };
})();
