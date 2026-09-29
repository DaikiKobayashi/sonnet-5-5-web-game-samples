/* art_chars.js - the mole (A01-A03), enemies (A04-A07) and enemy death poofs (A08). All procedural pixel art. */
(function (root) {
  'use strict';
  var DM = root.DM = root.DM || {};
  var Pix = DM.Pix, U = DM.ArtUtil, hex = Pix.hex, ramp = Pix.ramp, OL = U.OL, part = U.part;

  /* ------------------------------------------------------------------ palettes */
  var FUR = ramp(['#4e4768', '#6e6890', '#9088ae', '#b9b3d0']);
  var FUR_D = ramp(['#453f5e', '#5f5980', '#7f78a0', '#a19bbf']);
  var BELLY = ramp(['#c4ad97', '#e2d0b8', '#f6e9d6']);
  var HELM = ramp(['#b4650a', '#e0900f', '#f7c62a', '#ffec8c']);
  var HELM_D = hex('#a8580a');
  var PINK = ramp(['#b23a63', '#df6790', '#ff9dbb']);
  var NOSE = ramp(['#7b2247', '#a83060', '#d4527f']);
  var FOOT = ramp(['#b86a82', '#e197ae', '#f9c4d2']);
  var CLAW = hex('#fbf3e6');
  var EYE = hex('#160f1f');
  var WHITE = U.WHITE;
  var LAMP_B = ramp(['#5f6478', '#8b91a8', '#c4c9da']);
  var LENS = hex('#fffbd0');
  var GLOW = hex('#ffe97a', 0.55);

  /* ------------------------------------------------------------------ the mole */
  /*
   * drawMole(o): 32k x 32k sprite. o = { dir:'down'|'up'|'left', k, bob, hy, lf, rf, la, ra, fa:[x,y], fb:[x,y],
   *   eyes:'open'|'happy'|'x'|'hurt', mouth:true, jump, arms:'up' }
   */
  function drawMole(o) {
    var k = o.k || 1, m = function (v) { return v * k; }, W = 32 * k;
    var p = new Pix(W, W);
    var bob = o.bob || 0, hy = o.hy || 0, dir = o.dir || 'down', jump = o.jump || 0;
    var la = o.la || 0, ra = o.ra || 0, lf = o.lf || 0, rf = o.rf || 0;
    var armsUp = o.arms === 'up';

    /* ground shadow (stays on the ground while jumping) */
    p.ellOver(m(16), m(29.7), m(9.6 - (jump ? 1.6 : 0)), m(2.5), U.SHADOW);

    var oy = -jump;              // vertical offset of everything but the shadow
    function E(cx, cy, rx, ry, rampC, opts) { return function (l) { l.ellShade(m(cx), m(cy + oy), m(rx), m(ry), rampC, opts || {}); }; }

    if (dir === 'left') {
      var fa = o.fa || [13.6, 28.4], fb = o.fb || [20, 28.4];
      part(p, E(fb[0], fb[1], 3, 2.1, FOOT), OL);
      part(p, E(25.2, 22.4 + bob, 2.5, 1.8, PINK), OL);                                   // tail
      part(p, E(17.4, 21.8 + bob, 8.2, 7.1, FUR, { dither: true }), OL);                    // body
      part(p, E(fa[0], fa[1], 3.2, 2.2, FOOT), OL);
      part(p, function (l) {                                                             // near arm
        l.ellShade(m(12.4), m(22.4 + bob + la + oy), m(2.6), m(3.4), FUR_D, {});
      }, OL);
      p.set(m(9.4), m(24 + bob + la + oy), CLAW); p.set(m(9.4), m(25.6 + bob + la + oy), CLAW); p.set(m(10.6), m(26.3 + bob + la + oy), CLAW);
      part(p, E(14.4, 14.9 + bob + hy, 8.8, 7.9, FUR, { dither: true }), OL);              // head
      part(p, E(8.4, 17.4 + bob + hy, 4.4, 3.1, PINK), OL);                                // snout
      p.ellShade(m(5.4), m(16.7 + bob + hy + oy), m(1.7), m(1.5), NOSE, {});
      p.set(m(4.6), m(16 + bob + hy + oy), hex('#ffb6cd'));
      eyeSide(p, m, 11.4, 14.4 + bob + hy + oy, o.eyes, k);
      if (o.mouth) p.rect(m(7.5), m(19.4 + bob + hy + oy), m(3), Math.max(1, m(1)), hex('#5a1230'));
      /* helmet */
      part(p, function (l) {
        l.ellShade(m(15.4), m(10.6 + bob + hy + oy), m(9.6), m(7.2), HELM, { clipBottom: m(11.4 + bob + hy + oy), dither: true });
        l.rrect(m(5.6), m(10.2 + bob + hy + oy), m(19.6), m(2.6), m(1), HELM_D);
      }, OL);
      p.hline(m(6.6), m(10.6 + bob + hy + oy), m(17), hex('#f4b21c'));
      p.rect(m(8), m(5.4 + bob + hy + oy), m(4), m(4.2), LAMP_B[1]);
      p.rect(m(8), m(5.4 + bob + hy + oy), m(4), Math.max(1, m(1)), LAMP_B[2]);
      p.rect(m(6.6), m(6.2 + bob + hy + oy), m(1.6), m(2.6), LENS);
      p.outline(OL);
      p.set(m(5.6), m(7.4 + bob + hy + oy), GLOW); p.set(m(5.6), m(8.4 + bob + hy + oy), GLOW);
      p.set(m(12), m(7.4 + bob + hy + oy), hex('#ffec8c'));
    } else if (dir === 'up') {
      part(p, E(11.6, 28.4 - lf, 3.3, 2.3, FOOT), OL);
      part(p, E(20.4, 28.4 - rf, 3.3, 2.3, FOOT), OL);
      part(p, E(16, 21.8 + bob, 8.6, 7.4, FUR, { dither: true }), OL);
      part(p, E(16, 27 + bob, 2.2, 1.7, PINK), OL);                                       // tail nub
      part(p, function (l) { l.ellShade(m(7.4), m(21.6 + bob + la + oy), m(2.7), m(3.7), FUR_D, {}); }, OL);
      part(p, function (l) { l.ellShade(m(24.6), m(21.6 + bob + ra + oy), m(2.7), m(3.7), FUR_D, {}); }, OL);
      part(p, E(16, 14.8 + bob + hy, 9.6, 8.1, FUR, { dither: true }), OL);
      part(p, function (l) {
        l.ellShade(m(16), m(12.6 + bob + hy + oy), m(10.2), m(8.6), HELM, { clipBottom: m(14 + bob + hy + oy), dither: true });
        l.rrect(m(5), m(13.2 + bob + hy + oy), m(22), m(2.6), m(1), HELM_D);
      }, OL);
      p.hline(m(6), m(13.6 + bob + hy + oy), m(20), hex('#f4b21c'));
      p.rect(m(15), m(5.6 + bob + hy + oy), Math.max(1, m(2)), m(7.4), hex('#ffec8c'));       // ridge
      p.rect(m(14), m(11.6 + bob + hy + oy), m(4), Math.max(1, m(1)), hex('#e23a2e'));       // rear reflector
    } else {
      /* front */
      part(p, E(11.6, 28.4 - lf, 3.3, 2.3, FOOT), OL);
      part(p, E(20.4, 28.4 - rf, 3.3, 2.3, FOOT), OL);
      part(p, E(16, 21.8 + bob, 8.6, 7.4, FUR, { dither: true }), OL);
      p.ellShade(m(16), m(23.2 + bob + oy), m(5.2), m(4.9), BELLY, {});
      var laY = armsUp ? 0 : la, raY = armsUp ? 0 : ra;
      if (!armsUp) {
        part(p, function (l) { l.ellShade(m(7.5), m(21.6 + bob + laY + oy), m(2.7), m(3.7), FUR_D, {}); }, OL);
        part(p, function (l) { l.ellShade(m(24.5), m(21.6 + bob + raY + oy), m(2.7), m(3.7), FUR_D, {}); }, OL);
        var cy1 = 24.6 + bob + laY + oy, cy2 = 24.6 + bob + raY + oy;
        p.ellShade(m(7.5), m(cy1), m(2.2), m(1.5), BELLY, {});
        p.ellShade(m(24.5), m(cy2), m(2.2), m(1.5), BELLY, {});
        p.set(m(6.5), m(cy1 + 1.4), hex('#8f7f70')); p.set(m(8.5), m(cy1 + 1.4), hex('#8f7f70'));
        p.set(m(23.5), m(cy2 + 1.4), hex('#8f7f70')); p.set(m(25.5), m(cy2 + 1.4), hex('#8f7f70'));
      }
      part(p, E(16, 14.6 + bob + hy, 9.6, 8.1, FUR, { dither: true }), OL);
      p.ellShade(m(16), m(18.6 + bob + hy + oy), m(4.4), m(3.2), PINK, {});                 // snout
      p.ellShade(m(16), m(17 + bob + hy + oy), m(1.9), m(1.3), NOSE, {});
      p.set(m(15), m(16.5 + bob + hy + oy), hex('#ffb6cd'));
      if (o.mouth) { p.rect(m(14.5), m(20 + bob + hy + oy), m(3), m(1.6), hex('#5a1230')); }
      else { p.set(m(14), m(21 + bob + hy + oy), hex('#8a2b52')); p.set(m(18), m(21 + bob + hy + oy), hex('#8a2b52')); p.hline(m(15), m(21.4 + bob + hy + oy), m(2), hex('#8a2b52')); }
      p.ellOver(m(8.4), m(18.2 + bob + hy + oy), m(1.6), m(1.1), hex('#ff8fb0', 0.5));
      p.ellOver(m(23.6), m(18.2 + bob + hy + oy), m(1.6), m(1.1), hex('#ff8fb0', 0.5));
      if (armsUp) {                                                                     // banzai arms beside the head
        [4.4, 27.6].forEach(function (ax, i) {
          part(p, function (l) { l.ellShade(m(ax), m(14.4 + bob + oy), m(2.6), m(4.4), FUR_D, {}); }, OL);
          p.ellShade(m(ax), m(10.6 + bob + oy), m(2.1), m(1.5), BELLY, {});
          p.set(m(ax - 1), m(9.2 + bob + oy), hex('#8f7f70')); p.set(m(ax + 1), m(9.2 + bob + oy), hex('#8f7f70'));
        });
      }
      eyeFront(p, m, 10.4, 14.6 + bob + hy + oy, 21.6, o.eyes, k);
      part(p, function (l) {                                                             // helmet
        l.ellShade(m(16), m(10.9 + bob + hy + oy), m(10), m(7.6), HELM, { clipBottom: m(11.2 + bob + hy + oy), dither: true });
        l.rrect(m(5), m(10.4 + bob + hy + oy), m(22), m(2.6), m(1), HELM_D);
      }, OL);
      p.hline(m(6), m(10.8 + bob + hy + oy), m(20), hex('#f4b21c'));
      p.rect(m(15.5), m(4.2 + bob + hy + oy), Math.max(1, m(1)), m(1.6), hex('#ffec8c'));
      /* miner's lamp */
      p.rect(m(12.6), m(4.8 + bob + hy + oy), m(6.8), m(5.2), LAMP_B[1]);
      p.rect(m(12.6), m(4.8 + bob + hy + oy), m(6.8), Math.max(1, m(1)), LAMP_B[2]);
      p.rect(m(13.8), m(6 + bob + hy + oy), m(4.4), m(3), LENS);
      p.outline(OL);
      p.set(m(11.6), m(7.2 + bob + hy + oy), GLOW); p.set(m(20.4), m(7.2 + bob + hy + oy), GLOW);
      p.set(m(8.4), m(7 + bob + hy + oy), hex('#ffec8c'));
    }
    if (o.flash) return p.tint(WHITE, o.flash);
    return p;
  }

  function eyeFront(p, m, x1, y, x2, kind, k) {
    var e = EYE;
    if (kind === 'happy') {          // ^ ^
      [x1, x2].forEach(function (x) {
        p.set(m(x - 1), m(y + 2), e); p.set(m(x), m(y + 1), e); p.set(m(x + 1), m(y + 1), e); p.set(m(x + 2), m(y + 2), e);
        if (k > 1) { p.set(m(x - 1) + 1, m(y + 2), e); p.set(m(x) + 1, m(y + 1), e); p.set(m(x + 1) + 1, m(y + 1), e); p.set(m(x + 2) + 1, m(y + 2), e); }
      });
    } else if (kind === 'x') {
      [x1, x2].forEach(function (x) {
        p.line(m(x - 1), m(y), m(x + 2) - 1, m(y + 3) - 1, e); p.line(m(x + 2) - 1, m(y), m(x - 1), m(y + 3) - 1, e);
      });
    } else if (kind === 'hurt') {    // > <
      p.line(m(x1 - 1), m(y), m(x1 + 1), m(y + 1), e); p.line(m(x1 + 1), m(y + 1), m(x1 - 1), m(y + 3) - 1, e);
      p.line(m(x2 + 2), m(y), m(x2), m(y + 1), e); p.line(m(x2), m(y + 1), m(x2 + 2), m(y + 3) - 1, e);
    } else {
      [x1, x2].forEach(function (x) {
        p.rect(m(x - 0.5), m(y), m(2), m(3), e);
        p.set(m(x - 0.5), m(y), WHITE);
        if (k > 1) p.set(m(x - 0.5) + 1, m(y), WHITE);
      });
    }
  }
  function eyeSide(p, m, x, y, kind, k) {
    var e = EYE;
    if (kind === 'happy') { p.set(m(x - 1), m(y + 2), e); p.set(m(x), m(y + 1), e); p.set(m(x + 1), m(y + 1), e); p.set(m(x + 2), m(y + 2), e); }
    else if (kind === 'x') { p.line(m(x - 1), m(y), m(x + 1), m(y + 2), e); p.line(m(x + 1), m(y), m(x - 1), m(y + 2), e); }
    else { p.rect(m(x - 0.5), m(y), m(2), m(3), e); p.set(m(x - 0.5), m(y), WHITE); }
  }

  /* ------------------------------------------------------------------ mole animation sets */
  function moleSets(S) {
    var walk = { down: [], up: [], left: [], right: [] }, idle = { down: [], up: [], left: [], right: [] };
    var seqV = [
      { bob: 0, lf: 0, rf: 0, la: 0, ra: 0 },
      { bob: -1, lf: 2, rf: 0, la: 1, ra: -1 },
      { bob: 0, lf: 0, rf: 0, la: 0, ra: 0 },
      { bob: -1, lf: 0, rf: 2, la: -1, ra: 1 }
    ];
    var seqS = [
      { bob: 0, fa: [13.6, 28.4], fb: [20, 28.4], la: 0 },
      { bob: -1, fa: [10.2, 27.2], fb: [21, 28.4], la: 1 },
      { bob: 0, fa: [14.6, 28.4], fb: [18.6, 28.4], la: 0 },
      { bob: -1, fa: [18.4, 28.4], fb: [10.4, 27.2], la: -1 }
    ];
    ['down', 'up'].forEach(function (d) {
      seqV.forEach(function (s) { walk[d].push(drawMole({ dir: d, bob: s.bob, lf: s.lf, rf: s.rf, la: s.la, ra: s.ra }).toCanvas()); });
      idle[d].push(walk[d][0]);
      idle[d].push(drawMole({ dir: d, hy: 1, bob: 0 }).toCanvas());
    });
    var leftFrames = seqS.map(function (s) { return drawMole({ dir: 'left', bob: s.bob, fa: s.fa, fb: s.fb, la: s.la }); });
    walk.left = leftFrames.map(function (p) { return p.toCanvas(); });
    walk.right = leftFrames.map(function (p) { return p.flipH().toCanvas(); });
    var il = [leftFrames[0], drawMole({ dir: 'left', hy: 1 })];
    idle.left = il.map(function (p) { return p.toCanvas(); });
    idle.right = il.map(function (p) { return p.flipH().toCanvas(); });

    /* joy (A03) */
    var joy = [
      drawMole({ dir: 'down', eyes: 'happy', mouth: true, arms: 'up', bob: 0 }).toCanvas(),
      drawMole({ dir: 'down', eyes: 'happy', mouth: true, arms: 'up', bob: 0, jump: 4, lf: 1, rf: 1 }).toCanvas()
    ];

    /* death (A02): 6 frames over 1.2 s */
    var d = [];
    d.push(drawMole({ dir: 'down', eyes: 'hurt', mouth: true, arms: 'up', flash: 0.72 }).toCanvas());
    (function () {
      var p = deadMole(0);
      d.push(p.toCanvas());
    })();
    d.push(deadMole(1).toCanvas());
    d.push(deadMole(2).toCanvas());
    d.push(deadMole(3).toCanvas());
    d.push(deadMole(4).toCanvas());
    S.player = { walk: walk, idle: idle, death: d, joy: joy };
  }

  /* dizzy, squashed mole with orbiting stars (phase 0..4) */
  function deadMole(phase) {
    var p = new Pix(32, 32);
    p.ellOver(16, 29.6, 10.5, 2.6, U.SHADOW);
    /* helmet popped off and falling back */
    var hy = [-5, -2, 0, 0, 1][phase];
    var hx = [23, 25, 26, 26, 26][phase];
    var fade = phase === 4 ? 0.7 : 1;
    var body = new Pix(32, 32);
    part(body, function (l) { l.ellShade(16, 24.6, 10.4, 5.4, FUR, { dither: true }); }, OL);          // flattened body
    body.ellShade(16, 25.6, 6.4, 3.4, BELLY, {});
    part(body, function (l) { l.ellShade(7.2, 26.2, 2.6, 2.2, FUR_D, {}); }, OL);
    part(body, function (l) { l.ellShade(24.8, 26.2, 2.6, 2.2, FUR_D, {}); }, OL);
    part(body, function (l) { l.ellShade(16, 18.6, 8.6, 6.4, FUR, { dither: true }); }, OL);            // head (bare, squished)
    body.ellShade(16, 21, 4.2, 2.8, PINK, {});
    body.ellShade(16, 19.6, 1.7, 1.1, NOSE, {});
    eyeFront(body, function (v) { return v; }, 11.4, 15.6, 20.6, 'x', 1);
    body.hline(14, 23.2, 4, hex('#5a1230'));
    body.ellOver(8.8, 20.6, 1.6, 1, hex('#ff8fb0', 0.5));
    body.ellOver(23.2, 20.6, 1.6, 1, hex('#ff8fb0', 0.5));
    p.blit(body, 0, 0);
    /* the helmet */
    var hp = new Pix(32, 32);
    part(hp, function (l) {
      l.ellShade(hx, 8 + hy + 3, 6, 4.6, HELM, { clipBottom: 8 + hy + 4.6, dither: true });
      l.rrect(hx - 7, 8 + hy + 3, 14, 2, 1, HELM_D);
    }, OL);
    hp.rect(hx - 3, 8 + hy + 0.5, 4, 3, LAMP_B[1]);
    hp.rect(hx - 2, 8 + hy + 1.5, 2, 2, LENS);
    p.blit(hp, 0, 0, { alpha: fade });
    /* orbiting stars */
    var ang0 = phase * 0.9;
    for (var i = 0; i < 3; i++) {
      var a = ang0 + i * (Math.PI * 2 / 3);
      var sx = Math.round(16 + Math.cos(a) * 10), sy = Math.round(11 + Math.sin(a) * 3.2);
      if (phase >= 1) U.star(p, sx, sy, hex('#ffd23f'), hex('#fff09a'));
    }
    if (phase === 4) {
      var q = new Pix(32, 32);
      q.blit(p, 0, 0, { alpha: 0.75 });
      return q;
    }
    return p;
  }

  /* ------------------------------------------------------------------ enemies */
  var SL = ramp(['#2c8a3a', '#49c04a', '#84e567', '#c8ffa6']);
  var SL_OL = hex('#0f3319');

  function drawSlime(f) {
    var rx = [10, 11.6, 10.6, 9][f], ry = [8.4, 7, 7.8, 10][f];
    var p = new Pix(32, 32);
    var cy = 28 - ry, base = 28;
    p.ellOver(16, 29.3, rx + 0.6, 2.3, U.SHADOW);
    part(p, function (l) {
      l.ellShade(16, cy, rx, ry, SL, { dither: true });
      /* flatten the bottom */
      for (var y = Math.round(base); y < 32; y++) for (var x = 0; x < 32; x++) l.set(x, y, 0);
    }, SL_OL);
    /* inner darker nucleus + bubbles */
    p.ellOver(17.5, cy + 1.6, rx * 0.42, ry * 0.36, hex('#2a8a45', 0.55));
    p.set(12, cy + 3, hex('#d6ffc0')); p.set(21, cy + 2, hex('#d6ffc0')); p.set(20, cy + 4, hex('#d6ffc0'));
    /* highlight */
    p.ellOver(11.6, cy - ry * 0.45, 2.2, 1.5, hex('#ffffff', 0.85));
    p.set(9, cy - ry * 0.05, hex('#ffffff', 0.9));
    /* eyes */
    var ey = cy - 0.6 + (f === 3 ? -1 : 0), sq = f === 1 ? 1 : 0;
    [12.4, 19.6].forEach(function (x) {
      p.rect(x - 1.5, ey - 1, 3, 4 - sq, WHITE);
      p.rect(x - 0.5 + (f === 2 ? 1 : 0), ey + 0.4 - sq * 0, 2, 2, EYE);
      p.set(x - 0.5 + (f === 2 ? 1 : 0), ey + 0.4, hex('#ffffff'));
    });
    /* mouth */
    p.set(14, ey + 4.4, hex('#1b5a2c')); p.set(15, ey + 5.2, hex('#1b5a2c')); p.set(16, ey + 5.2, hex('#1b5a2c')); p.set(17, ey + 4.4, hex('#1b5a2c'));
    /* drip */
    if (f === 3) { p.rect(6, 27, 2, 1, SL[1]); }
    return p;
  }

  var BT = ramp(['#2e1d52', '#4a2f80', '#7048b8', '#9d74e6']);
  var BW = ramp(['#3b2568', '#5c3c9c', '#805ac8']);
  var BAT_OL = hex('#150c28');
  function drawBat(f) {
    var a = [-1, -0.2, 0.9, -0.2][f];            // wing angle: -1 up ... +1 down
    var p = new Pix(32, 32);
    p.ellOver(16, 29.3, 6.5, 1.8, hex('#0b0612', 0.22));
    var ty = 14 + a * 7.5;                        // wing tip y
    function wing(sign) {
      var x0 = 16 + sign * 3.4, y0 = 15.5;
      var tipx = 16 + sign * 14.6, tipy = ty;
      var pts = [[x0, y0 - 1.5], [16 + sign * 8, tipy - 3.2 + a * 1.2], [tipx, tipy], [16 + sign * 12.6, tipy + 4.5 - a * 0.6],
        [16 + sign * 9.6, tipy + 2.6 - a * 1.5], [16 + sign * 7.6, tipy + 6.2 - a * 2.2], [16 + sign * 5.2, tipy + 3.8 - a * 3.2], [x0, y0 + 4.5]];
      var l = new Pix(32, 32);
      l.poly(pts, BW[1]);
      /* membrane shading */
      l.poly([pts[0], pts[1], pts[2], [16 + sign * 8.4, tipy + 1 - a], [x0, y0 + 1.4]], BW[2]);
      /* bones */
      l.line(x0, y0 - 0.5, tipx, tipy, BW[0]);
      l.line(x0, y0 + 0.5, 16 + sign * 12.6, tipy + 4.5 - a * 0.6, BW[0]);
      l.line(x0, y0 + 1.5, 16 + sign * 7.6, tipy + 6.2 - a * 2.2, BW[0]);
      l.outline(BAT_OL);
      p.blit(l, 0, 0);
    }
    wing(-1); wing(1);
    /* ears */
    part(p, function (l) { l.poly([[11.2, 12.4], [12.4, 7], [15, 11.6]], BT[1]); l.poly([[20.8, 12.4], [19.6, 7], [17, 11.6]], BT[1]); }, BAT_OL);
    p.set(12, 9, hex('#ff8fbf')); p.set(20, 9, hex('#ff8fbf')); p.set(12, 10, hex('#ff8fbf')); p.set(20, 10, hex('#ff8fbf'));
    /* body / head */
    part(p, function (l) { l.ellShade(16, 17.6, 5.6, 6.6, BT, { dither: true }); }, BAT_OL);
    p.ellShade(16, 20.4, 3, 3.4, ramp(['#5a3a96', '#7a58c0', '#a888e8']), {});
    /* eyes */
    [13.2, 18.8].forEach(function (x) {
      p.rect(x - 1.2, 14.4, 3, 3, hex('#ff3a3a'));
      p.set(x - 1.2, 14.4, hex('#ffd0d0'));
      p.set(x + 0.4, 15.6, hex('#7a0a14'));
    });
    p.hline(11.6, 13.4, 3, BAT_OL); p.hline(18.4, 13.4, 3, BAT_OL);
    /* fangs */
    p.set(14, 20.2, hex('#5a1230')); p.set(15, 20.6, hex('#5a1230')); p.set(16, 20.6, hex('#5a1230')); p.set(17, 20.2, hex('#5a1230'));
    p.set(14, 21.4, WHITE); p.set(17, 21.4, WHITE);
    /* feet */
    p.set(14, 24, hex('#e8a0c8')); p.set(18, 24, hex('#e8a0c8'));
    return p;
  }

  var GH = ramp(['#9c96cc', '#c6c2ee', '#e7e5fc', '#ffffff']);
  function drawGhost(f, chase) {
    var p = new Pix(32, 32);
    var bob = 0;
    var ph = f * 0.9;
    p.ellOver(16, 29.6, 7.5, 1.8, hex('#0b0612', 0.22));
    var body = new Pix(32, 32);
    var top = 5.5 + bob, bottom = 25.5;
    /* silhouette: dome + column with a scalloped hem */
    for (var y = 0; y < 32; y++) {
      for (var x = 0; x < 32; x++) {
        var dx = (x + 0.5 - 16) / 9.4, inside = false;
        if (y + 0.5 < 15.5 + bob) { var dy = (y + 0.5 - (15.5 + bob)) / 10; inside = dx * dx + dy * dy <= 1; }
        else if (Math.abs(dx) <= 1) {
          var hem = bottom + Math.round(1.7 * Math.sin((x / 32) * Math.PI * 5 + ph)) + (Math.abs(dx) > 0.7 ? -1 : 0);
          inside = y <= hem;
        }
        if (inside) {
          var t = (y - top) / (bottom - top + 2);
          var idx = t < 0.18 ? 3 : t < 0.5 ? 2 : t < 0.82 ? 1 : 0;
          if (x < 12 && idx < 3 && t < 0.6) idx = Math.min(3, idx + 1);
          if (x > 22 && idx > 0) idx = Math.max(0, idx - 1);
          body.set(x, y, GH[idx]);
        }
      }
    }
    var olc = chase ? hex('#4a1830') : hex('#3e3878');
    body.outline(olc);
    if (chase) body = body.tint(hex('#ff9db4'), 0.32);
    p.blit(body, 0, 0);
    /* arms */
    var aw = f % 2 ? 1 : 0;
    part(p, function (l) { l.ellShade(6.2, 19.4 + aw, 2.2, 3, GH, {}); l.ellShade(25.8, 19.4 - aw, 2.2, 3, GH, {}); }, olc);
    /* face */
    if (chase) {
      [12.6, 19.4].forEach(function (x, i) {
        p.rect(x - 1.5, 13, 3, 4, hex('#ff2222')); p.set(x - 1.5, 13, hex('#ffc8c8')); p.set(x + 0.5, 15, hex('#7a0000'));
        var s = i === 0 ? 1 : -1;
        p.line(x - 2 * s, 11.6, x + 2 * s, 12.8, hex('#4a1830'));
      });
      p.rect(14, 19.2, 4, 2.2, hex('#4a1830')); p.set(15, 19.2, WHITE); p.set(16, 19.2, WHITE);
    } else {
      [12.6, 19.4].forEach(function (x) {
        p.rect(x - 1.5, 13, 3, 4, hex('#1d1638')); p.set(x - 1.5, 13, WHITE); p.set(x - 0.5, 16, hex('#4a4090'));
      });
      p.ellOver(16, 20.4, 1.8, 1.7, hex('#1d1638'));
      p.ellOver(9.5, 18, 1.5, 1, hex('#ff9fc0', 0.55)); p.ellOver(22.5, 18, 1.5, 1, hex('#ff9fc0', 0.55));
    }
    return p;
  }

  var GO = ramp(['#4c5066', '#6c718e', '#9298b6', '#c0c6dc']);
  var GO_OL = hex('#1b1c2a');
  function drawGolem(f) {
    var bob = [0, -1, 0, -1][f];
    var swing = [0, 1, 0, -1][f];
    var lLift = [0, 2, 0, 0][f], rLift = [0, 0, 0, 2][f];
    var p = new Pix(32, 32);
    p.ellOver(16, 29.8, 11.5, 2.4, U.SHADOW);
    /* legs */
    part(p, function (l) { l.rrect(8.5, 23.4 - lLift, 6, 6.6, 1.5, GO[1]); l.rrect(17.5, 23.4 - rLift, 6, 6.6, 1.5, GO[1]); }, GO_OL);
    p.rect(9, 27 - lLift, 5, 2, GO[0]); p.rect(18, 27 - rLift, 5, 2, GO[0]);
    /* arms hang behind torso */
    part(p, function (l) {
      l.rrect(3.4, 15.5 + bob + swing, 5.6, 9, 2, GO[1]);
      l.rrect(23, 15.5 + bob - swing, 5.6, 9, 2, GO[1]);
    }, GO_OL);
    p.rect(4, 22 + bob + swing, 4.5, 2.4, GO[0]); p.rect(23.5, 22 + bob - swing, 4.5, 2.4, GO[0]);
    p.hline(4, 15.8 + bob + swing, 4, GO[2]); p.hline(23.5, 15.8 + bob - swing, 4, GO[2]);
    /* torso */
    part(p, function (l) { l.rrect(7.5, 11.4 + bob, 17, 14.4, 3.2, GO[1]); }, GO_OL);
    /* facets: lit top-left, dark bottom-right */
    p.poly([[9, 12.6 + bob], [23, 12.6 + bob], [21, 16 + bob], [11, 16 + bob]], GO[3]);
    p.poly([[8.6, 14 + bob], [11, 16 + bob], [10.4, 24 + bob], [8.6, 22.6 + bob]], GO[2]);
    p.poly([[23.4, 14 + bob], [21, 16 + bob], [21.6, 24 + bob], [23.4, 22.6 + bob]], GO[0]);
    p.poly([[11, 22 + bob], [21, 22 + bob], [22, 24.6 + bob], [10, 24.6 + bob]], GO[0]);
    /* glowing chest crack */
    p.line(16, 15.6 + bob, 14, 18 + bob, hex('#ff8a1a')); p.line(14, 18 + bob, 17, 19.6 + bob, hex('#ff8a1a')); p.line(17, 19.6 + bob, 15, 22 + bob, hex('#ff8a1a'));
    p.set(14, 18 + bob, hex('#ffe08a')); p.set(17, 19.6 + bob, hex('#ffe08a'));
    /* shoulders */
    part(p, function (l) { l.ellShade(8, 13 + bob, 4.2, 3.6, GO, {}); l.ellShade(24, 13 + bob, 4.2, 3.6, GO, {}); }, GO_OL);
    /* moss */
    p.set(6, 11.4 + bob, hex('#5aa04a')); p.set(7, 10.8 + bob, hex('#78c060')); p.set(8, 11.4 + bob, hex('#5aa04a')); p.set(25, 11 + bob, hex('#5aa04a')); p.set(24, 10.6 + bob, hex('#78c060'));
    /* head */
    part(p, function (l) { l.rrect(10.6, 3.6 + bob, 10.8, 9.4, 2.6, GO[2]); }, GO_OL);
    p.rect(11.4, 4.4 + bob, 9, 2.2, GO[3]);
    p.rect(10.8, 10.6 + bob, 10.4, 2, GO[1]);
    p.rect(11.6, 7.4 + bob, 3, 2.4, hex('#ffb02e')); p.rect(17.4, 7.4 + bob, 3, 2.4, hex('#ffb02e'));
    p.set(12, 7.6 + bob, hex('#fff2a0')); p.set(18, 7.6 + bob, hex('#fff2a0'));
    p.hline(11.4, 6.6 + bob, 3.4, GO_OL); p.hline(17.2, 6.6 + bob, 3.4, GO_OL);
    p.hline(13.4, 11.2 + bob, 5.2, GO_OL); p.set(14, 12 + bob, GO_OL); p.set(16, 12 + bob, GO_OL); p.set(18, 12 + bob, GO_OL);
    p.set(15, 4 + bob, hex('#78c060')); p.set(16, 3.6 + bob, hex('#5aa04a'));
    return p;
  }

  /* damage cracks drawn over the golem (level 1 = 2 HP left, level 2 = 1 HP left) */
  function drawGolemCracks(level, f) {
    var bob = [0, -1, 0, -1][f], p = new Pix(32, 32), dk = hex('#14141e'), gl = hex('#ff8a1a'), hot = hex('#ffe08a');
    p.line(16, 5 + bob, 15, 8 + bob, dk); p.line(15, 8 + bob, 17, 11 + bob, dk);
    p.line(20, 14 + bob, 22, 18 + bob, dk); p.line(22, 18 + bob, 21, 21 + bob, dk);
    p.set(15, 8 + bob, gl); p.set(22, 18 + bob, gl);
    if (level >= 2) {
      p.line(10, 15 + bob, 12, 19 + bob, dk); p.line(12, 19 + bob, 10, 23 + bob, dk);
      p.line(13, 24 + bob, 18, 22 + bob, dk); p.line(24, 12 + bob, 26, 15 + bob, dk);
      p.set(12, 19 + bob, gl); p.set(16, 23 + bob, gl); p.set(21, 20 + bob, hot); p.set(17, 11 + bob, hot);
    }
    return p;
  }

  /* death puff (A08): 3 frames, tinted per enemy */
  function drawPoof(f, c1, c2, c3) {
    var p = new Pix(32, 32);
    var cx = 16, cy = 17, i, a;
    if (f === 0) {
      for (i = 0; i < 8; i++) {
        a = i * Math.PI / 4 + 0.2;
        p.line(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3, cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, c1);
        p.line(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3, cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, c2);
      }
      p.ell(cx, cy, 6, 6, c1); p.ell(cx, cy, 4.4, 4.4, c2); p.ell(cx, cy, 2.6, 2.6, WHITE);
    } else if (f === 1) {
      for (i = 0; i < 8; i++) {
        a = i * Math.PI / 4;
        p.ell(cx + Math.cos(a) * 9, cy + Math.sin(a) * 8.4, 3.6, 3.2, c1);
        p.ell(cx + Math.cos(a) * 9 - 0.8, cy + Math.sin(a) * 8.4 - 0.8, 2, 1.7, c2);
      }
      p.ell(cx, cy, 4.4, 4, c3); p.ell(cx - 1, cy - 1, 2.2, 2, c2);
    } else {
      for (i = 0; i < 8; i++) {
        a = i * Math.PI / 4 + 0.4;
        p.ellOver(cx + Math.cos(a) * 12.4, cy + Math.sin(a) * 11.2, 2.4, 2.1, Pix.withAlpha(c1, 0.6));
        p.set(cx + Math.cos(a) * 8.5, cy + Math.sin(a) * 7.5, Pix.withAlpha(c2, 0.7));
      }
      p.ellOver(cx, cy, 3, 2.6, Pix.withAlpha(c3, 0.4));
    }
    return p;
  }

  function build(S) {
    moleSets(S);
    var f;
    S.slime = []; S.bat = []; S.ghost = []; S.ghostChase = []; S.golem = []; S.golemFlash = [];
    for (f = 0; f < 4; f++) {
      S.slime.push(drawSlime(f).toCanvas());
      S.bat.push(drawBat(f).toCanvas());
      S.ghost.push(drawGhost(f, false).toCanvas());
      S.ghostChase.push(drawGhost(f, true).toCanvas());
      var g = drawGolem(f);
      S.golem.push(g.toCanvas());
      S.golemFlash.push(g.tint(WHITE, 0.82).toCanvas());
    }
    var tint = {
      slime: [hex('#4fc24d'), hex('#b8ff9a'), hex('#2c8a3a')],
      bat: [hex('#7048b8'), hex('#c7a8ff'), hex('#3a2568')],
      ghost: [hex('#c6c2ee'), hex('#ffffff'), hex('#9c96cc')],
      golem: [hex('#9298b6'), hex('#ffcf7a'), hex('#5a5e78')]
    };
    S.golemCrack = [0, 1].map(function (lv) { return [0, 1, 2, 3].map(function (fr) { return drawGolemCracks(lv + 1, fr).toCanvas(); }); });
    S.poof = {};
    Object.keys(tint).forEach(function (t) {
      S.poof[t] = [0, 1, 2].map(function (i) { return drawPoof(i, tint[t][0], tint[t][1], tint[t][2]).toCanvas(); });
    });
    S.moleBig = null;
  }

  DM.ArtChars = { build: build, drawMole: drawMole, drawSlime: drawSlime, drawBat: drawBat, drawGhost: drawGhost, drawGolem: drawGolem };
})(typeof window !== 'undefined' ? window : globalThis);
