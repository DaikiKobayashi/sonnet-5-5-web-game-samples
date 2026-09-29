/* sprites_mole.js - the player character (A01 walk, A02 death, A03 joy, A17 face icon).
 * Drawn procedurally in a 32-unit design space; R = raster resolution (32 normally, 64 for the title art).
 */
(function () {
  'use strict';
  var DM = window.DM;
  var sh = DM.sh;
  var ell = sh.ell, rect = sh.rect, sub = sh.sub, mv = sh.mv, and = sh.and, seg = sh.seg, poly = sh.poly, or = sh.or;

  var K = {
    ol: '#1e1418',
    shadow: '#00000058',
    fur: '#94827a',
    furL: '#b8a698',
    furH: '#d8c6b6',
    furD: '#66554f',
    furDD: '#463a38',
    belly: '#eed6be',
    bellyD: '#cfb298',
    nose: '#ff8fa8',
    noseL: '#ffd0da',
    noseD: '#d8607e',
    skin: '#f7bca4',
    skinD: '#d98e7e',
    helm: '#ffd23a',
    helmL: '#fff3a0',
    helmD: '#eaa01c',
    helmDD: '#a8620e',
    metal: '#8f9aa8',
    metalD: '#5e6876',
    lamp: '#fffbd8',
    eye: '#1d1420',
    white: '#ffffff',
    cheek: '#ff9db0'
  };
  DM.moleColors = K;

  function helmet(S, cx, cy, o) {
    /* dome (upper half of an ellipse) + brim + ridge + lamp. cx,cy = dome centre */
    var rx = o.rx || 10.6, ry = o.ry || 8;
    var dome = and(ell(cx, cy, rx, ry), function (x, y) {
      return y < cy + (o.cut === undefined ? 1.6 : o.cut);
    });
    S.fill(dome, K.helm);
    S.fill(sub(dome, mv(dome, -1.7, -1.5)), K.helmD);
    S.fill(and(sub(dome, mv(dome, -3.4, -3)), function (x, y) {
      return y > cy + 1;
    }), K.helmDD);
    /* highlight */
    S.fill(ell(cx - rx * 0.42, cy - ry * 0.55, 3.2, 1.7), K.helmL);
    S.fill(ell(cx - rx * 0.42 - 2.4, cy - ry * 0.55 + 1.7, 0.9, 0.9), K.helmL);
    /* brim */
    var brim = ell(cx + (o.brimDx || 0), cy + 1.6, rx + (o.brimW || 1.1), 2.0);
    S.fill(brim, K.helmD);
    S.fill(and(brim, function (x, y) {
      return y < cy + 1.4;
    }), K.helm);
    S.fill(and(brim, function (x, y) {
      return y > cy + 2.4;
    }), K.helmDD);
    if (o.ridge !== false) {
      S.fill(seg(cx, cy - ry + 0.6, cx, cy - 1.2, 1.8), K.helmL);
    }
  }

  function lamp(S, x, y, r) {
    S.fill(ell(x, y, r + 0.9, r + 0.7), K.metalD);
    S.fill(ell(x, y, r + 0.3, r + 0.1), K.metal);
    S.fill(ell(x, y, r - 0.5, r - 0.6), K.lamp);
    S.fill(ell(x - 0.3, y - 0.3, 0.6, 0.6), K.white);
  }

  function eye(S, x, y, rx, ry, o) {
    if (o && o.x) {
      /* dizzy X eye */
      S.fill(seg(x - 1.5, y - 1.5, x + 1.5, y + 1.5, 0.95), K.eye);
      S.fill(seg(x - 1.5, y + 1.5, x + 1.5, y - 1.5, 0.95), K.eye);
      return;
    }
    if (o && o.shut) {
      S.fill(rect(x - 1.5, y, x + 1.5, y + 0.95), K.eye);
      return;
    }
    if (o && o.wide) {
      S.fill(ell(x, y, rx + 0.6, ry + 0.4), K.eye);
      S.fill(ell(x - 0.35, y - 0.55, 0.7, 0.7), K.white);
      return;
    }
    S.fill(ell(x, y, rx, ry), K.eye);
    S.fill(ell(x - 0.35, y - 0.65, 0.62, 0.62), K.white);
  }

  function claws(S, x, y) {
    /* three light claw ticks along the bottom of a paw */
    S.fill(rect(x - 2.2, y, x - 1.3, y + 1.3), K.furH);
    S.fill(rect(x - 0.45, y + 0.2, x + 0.45, y + 1.5), K.furH);
    S.fill(rect(x + 1.3, y, x + 2.2, y + 1.3), K.furH);
  }

  /* ------------------------------------------------------------------ */
  /* front view (facing down / towards the viewer)                       */
  function drawDown(S, o) {
    var b = o.bob || 0, br = o.breath || 0;
    var fl = o.fl || 0, fr = o.fr || 0, al = o.al || 0, ar = o.ar || 0;
    S.fill(ell(16, 29.3, 9.6, 2.2), K.shadow);
    /* feet */
    [[11.3, 27.2 + fl], [20.7, 27.2 + fr]].forEach(function (f) {
      var e = ell(f[0], f[1], 3.4, 2.2);
      S.fill(e, K.skin);
      S.fill(and(e, function (x, y) {
        return y > f[1] + 0.7;
      }), K.skinD);
    });
    /* torso */
    var body = ell(16, 22.4 + b, 8.4, 6.5 + br * 0.5);
    S.fill(body, K.fur);
    S.fill(sub(body, mv(body, -1.6, -1.4)), K.furD);
    S.fill(ell(16, 23.2 + b, 5.2, 5 + br * 0.4), K.belly);
    S.fill(and(ell(16, 23.2 + b, 5.2, 5 + br * 0.4), function (x, y) {
      return y > 25.3 + b;
    }), K.bellyD);
    /* arms */
    [[7.2, al, -1], [24.8, ar, 1]].forEach(function (a) {
      var ay = 22.4 + b + a[1];
      var arm = ell(a[0], ay, 2.7, 4.6);
      S.fill(arm, K.fur);
      S.fill(sub(arm, mv(arm, -1.2, -1.2)), K.furD);
      S.fill(ell(a[0] + a[2] * 0.3, ay + 3.4, 3, 2.3), K.skin);
      S.fill(and(ell(a[0] + a[2] * 0.3, ay + 3.4, 3, 2.3), function (x, y) {
        return y > ay + 4;
      }), K.skinD);
      claws(S, a[0] + a[2] * 0.3, ay + 4.9);
    });
    /* head */
    var head = ell(16, 14.2 + b, 9.4, 8.2);
    S.fill(head, K.fur);
    S.fill(sub(head, mv(head, -1.7, -1.5)), K.furD);
    S.fill(ell(11.4, 12.6 + b, 3.4, 1.9), K.furL);
    /* muzzle */
    S.fill(ell(16, 18.2 + b, 5.6, 3.4), K.furL);
    S.fill(and(ell(16, 18.2 + b, 5.6, 3.4), function (x, y) {
      return y > 19.4 + b;
    }), K.fur);
    /* nose */
    S.fill(ell(16, 17.4 + b, 2.9, 2.2), K.nose);
    S.fill(and(ell(16, 17.4 + b, 2.9, 2.2), function (x, y) {
      return y > 18 + b;
    }), K.noseD);
    S.fill(ell(15, 16.7 + b, 1.1, 0.7), K.noseL);
    /* mouth hint */
    S.fill(rect(15.4, 20 + b, 16.6, 20.9 + b), K.furDD);
    /* eyes */
    var wide = o.wide;
    eye(S, 11.3, 15 + b, 1.35, 1.95, { wide: wide, x: o.xeyes, shut: o.shut });
    eye(S, 20.7, 15 + b, 1.35, 1.95, { wide: wide, x: o.xeyes, shut: o.shut });
    S.fill(ell(8.6, 18 + b, 1.5, 1), K.cheek);
    S.fill(ell(23.4, 18 + b, 1.5, 1), K.cheek);
    /* whiskers */
    S.fill(rect(4.6, 17.3 + b, 7, 17.9 + b), K.furDD);
    S.fill(rect(25, 17.3 + b, 27.4, 17.9 + b), K.furDD);
    /* helmet */
    if (!o.noHelmet) {
      helmet(S, 16 + (o.hx || 0), 10.6 + b + (o.hoff || 0), { rx: 10.4, ry: 8.2 });
      lamp(S, 16 + (o.hx || 0), 7.9 + b + (o.hoff || 0), 2.3);
    }
  }

  /* back view (facing up / away) */
  function drawUp(S, o) {
    var b = o.bob || 0, br = o.breath || 0;
    var fl = o.fl || 0, fr = o.fr || 0, al = o.al || 0, ar = o.ar || 0;
    S.fill(ell(16, 29.3, 9.6, 2.2), K.shadow);
    [[11.3, 27.2 + fl], [20.7, 27.2 + fr]].forEach(function (f) {
      var e = ell(f[0], f[1], 3.4, 2.2);
      S.fill(e, K.skin);
      S.fill(and(e, function (x, y) {
        return y > f[1] + 0.7;
      }), K.skinD);
    });
    /* tail nub */
    S.fill(ell(16, 27.2 + b, 1.6, 1.3), K.nose);
    var body = ell(16, 22.4 + b, 8.4, 6.5 + br * 0.5);
    S.fill(body, K.fur);
    S.fill(sub(body, mv(body, -1.6, -1.4)), K.furD);
    S.fill(ell(12.5, 21 + b, 3, 1.6), K.furL);
    [[7.2, al], [24.8, ar]].forEach(function (a) {
      var ay = 22.6 + b + a[1];
      var arm = ell(a[0], ay, 2.7, 4.4);
      S.fill(arm, K.fur);
      S.fill(sub(arm, mv(arm, -1.2, -1.2)), K.furD);
      S.fill(ell(a[0], ay + 3.2, 2.8, 2.1), K.skin);
      S.fill(and(ell(a[0], ay + 3.2, 2.8, 2.1), function (x, y) {
        return y > ay + 3.8;
      }), K.skinD);
    });
    var head = ell(16, 14.2 + b, 9.4, 8.2);
    S.fill(head, K.fur);
    S.fill(sub(head, mv(head, -1.7, -1.5)), K.furD);
    /* ears peeking out */
    S.fill(ell(7.2, 13.6 + b, 1.8, 2), K.furD);
    S.fill(ell(24.8, 13.6 + b, 1.8, 2), K.furD);
    S.fill(ell(7.6, 13.8 + b, 0.9, 1.1), K.skinD);
    S.fill(ell(24.4, 13.8 + b, 0.9, 1.1), K.skinD);
    /* helmet covers the back of the head */
    S.fill(ell(16, 14.6 + b, 10.3, 5.6), K.helmD);
    S.fill(sub(ell(16, 14.6 + b, 10.3, 5.6), mv(ell(16, 14.6 + b, 10.3, 5.6), 0, -1.3)), K.helmDD);
    helmet(S, 16, 11.4 + b, { rx: 10.6, ry: 9.2, cut: 3.2, brimW: 0.3 });
    /* rear reflector + strap */
    S.fill(rect(14.2, 10.8 + b, 17.8, 12.6 + b), '#e5484d');
    S.fill(rect(14.2, 10.8 + b, 17.8, 11.6 + b), '#ff8b8e');
  }

  /* side view facing left */
  function drawLeft(S, o) {
    var b = o.bob || 0, br = o.breath || 0;
    var sw = o.sw || 0; /* leg swing in units (-2..2) */
    var swa = -sw * 0.7;
    S.fill(ell(16, 29.3, 9.4, 2.2), K.shadow);
    /* back foot then front foot */
    [[18.6 - sw, 27.2 - (sw < 0 ? 0.7 : 0), K.skinD, K.skinD], [13.4 + sw, 27.2 - (sw > 0 ? 0.7 : 0), K.skin, K.skinD]].forEach(function (f) {
      var e = ell(f[0], f[1], 3.6, 2.1);
      S.fill(e, f[2]);
      S.fill(and(e, function (x, y) {
        return y > f[1] + 0.7;
      }), f[3]);
    });
    /* tail */
    S.fill(seg(23.4, 23 + b, 26.6, 21.2 + b, 1.6), K.nose);
    /* back arm (behind body) */
    S.fill(ell(19.6 - swa, 22.4 + b, 2.3, 4), K.furD);
    var body = ell(17.2, 22.4 + b, 7.6, 6.5 + br * 0.5);
    S.fill(body, K.fur);
    S.fill(sub(body, mv(body, -1.6, -1.4)), K.furD);
    S.fill(ell(13.4, 23.6 + b, 3.6, 4.6 + br * 0.4), K.belly);
    S.fill(and(ell(13.4, 23.6 + b, 3.6, 4.6 + br * 0.4), function (x, y) {
      return y > 25.6 + b;
    }), K.bellyD);
    /* front arm */
    var ax = 12.6 + swa, ay = 22.4 + b;
    var arm = ell(ax, ay, 2.6, 4.4);
    S.fill(arm, K.fur);
    S.fill(sub(arm, mv(arm, -1.2, -1.2)), K.furD);
    S.fill(ell(ax - 0.5, ay + 3.3, 3, 2.3), K.skin);
    S.fill(and(ell(ax - 0.5, ay + 3.3, 3, 2.3), function (x, y) {
      return y > ay + 4;
    }), K.skinD);
    claws(S, ax - 0.5, ay + 4.9);
    /* head */
    var head = ell(15, 14.4 + b, 9, 8);
    S.fill(head, K.fur);
    S.fill(sub(head, mv(head, -1.7, -1.5)), K.furD);
    S.fill(ell(15.6, 12.4 + b, 3, 1.7), K.furL);
    /* ear */
    S.fill(ell(20.4, 11.6 + b, 1.9, 2), K.furD);
    S.fill(ell(20, 11.8 + b, 0.9, 1.1), K.skinD);
    /* snout */
    var snout = ell(8.6, 17.6 + b, 4.6, 3.3);
    S.fill(snout, K.furL);
    S.fill(and(snout, function (x, y) {
      return y > 19 + b;
    }), K.fur);
    S.fill(ell(5.4, 16.9 + b, 2.6, 2.3), K.nose);
    S.fill(and(ell(5.4, 16.9 + b, 2.6, 2.3), function (x, y) {
      return y > 17.6 + b;
    }), K.noseD);
    S.fill(ell(4.7, 16.1 + b, 1, 0.7), K.noseL);
    /* eye + cheek */
    eye(S, 11.4, 15 + b, 1.3, 1.9, { wide: o.wide, x: o.xeyes, shut: o.shut });
    S.fill(ell(13.4, 18.2 + b, 1.4, 0.9), K.cheek);
    if (!o.noHelmet) {
      helmet(S, 15.6, 10.8 + b, { rx: 10.2, ry: 8.2, brimDx: -1.6, brimW: 1.6, cut: 1.6 });
      lamp(S, 7.6, 9.6 + b, 2.1);
    }
  }

  function makeMole(R, view, o) {
    var S = new DM.Spr(R);
    if (view === 'down') drawDown(S, o || {});
    else if (view === 'up') drawUp(S, o || {});
    else drawLeft(S, o || {});
    return S.outline(K.ol);
  }
  DM.makeMole = makeMole;

  /* stars circling above the head (dizzy) */
  function stars(S, cx, cy, ph, n) {
    for (var i = 0; i < n; i++) {
      var a = ph + (i * Math.PI * 2) / n;
      var x = cx + Math.cos(a) * 8.5, y = cy + Math.sin(a) * 2.6;
      S.fill(rect(x - 0.6, y - 1.9, x + 0.6, y + 1.9), '#ffe45a');
      S.fill(rect(x - 1.9, y - 0.6, x + 1.9, y + 0.6), '#ffe45a');
      S.fill(rect(x - 0.6, y - 0.6, x + 0.6, y + 0.6), '#ffffff');
    }
  }

  /* ---- build the full set ---- */
  DM.buildMoleSprites = function () {
    var out = { down: [], up: [], left: [], right: [], idle: { down: [], up: [], left: [], right: [] }, die: [], joy: [], icon: null };
    /* walk cycle: neutral, step A, neutral (bob down), step B */
    var dn = [
      { bob: 0, fl: 0, fr: 0, al: 0, ar: 0 },
      { bob: -1, fl: 1.4, fr: -1.6, al: -1.2, ar: 1.2 },
      { bob: 0, fl: 0, fr: 0, al: 0, ar: 0 },
      { bob: -1, fl: -1.6, fr: 1.4, al: 1.2, ar: -1.2 }
    ];
    var sd = [
      { bob: 0, sw: 0 },
      { bob: -1, sw: 2.4 },
      { bob: 0, sw: 0 },
      { bob: -1, sw: -2.4 }
    ];
    var i;
    for (i = 0; i < 4; i++) {
      out.down.push(makeMole(32, 'down', dn[i]).toCanvas());
      out.up.push(makeMole(32, 'up', dn[i]).toCanvas());
      var L = makeMole(32, 'left', sd[i]);
      out.left.push(L.toCanvas());
      out.right.push(L.mirror().toCanvas());
    }
    /* idle: frame 0 = neutral, frame 1 = breathing (chest up, body 1 px higher) */
    out.idle.down = [out.down[0], makeMole(32, 'down', { bob: 0, breath: 1 }).toCanvas()];
    out.idle.up = [out.up[0], makeMole(32, 'up', { bob: 0, breath: 1 }).toCanvas()];
    out.idle.left = [out.left[0], makeMole(32, 'left', { bob: 0, breath: 1 }).toCanvas()];
    out.idle.right = [out.right[0], makeMole(32, 'left', { bob: 0, breath: 1 }).mirror().toCanvas()];

    /* death (6 frames, 0.2 s each): hit flash, helmet pops off, apex, falls back, dizzy stars x2 (last one fades) */
    var d0 = makeMole(32, 'down', { bob: 0, wide: true }).silhouette('#ffffff');
    out.die.push(d0.toCanvas());
    var d1 = new DM.Spr(32);
    drawDown(d1, { bob: 1.5, xeyes: true, hoff: -6, al: -3, ar: -3 });
    out.die.push(d1.outline(K.ol).toCanvas());
    var d2 = new DM.Spr(32);
    drawDown(d2, { bob: 2.5, xeyes: true, hoff: -10, al: 1.5, ar: 1.5 });
    out.die.push(d2.outline(K.ol).toCanvas());
    var d3 = new DM.Spr(32);
    drawDown(d3, { bob: 3.5, xeyes: true, hoff: -4, al: 1.5, ar: 1.5 });
    out.die.push(d3.outline(K.ol).toCanvas());
    var d4 = new DM.Spr(32);
    drawDown(d4, { bob: 3.5, xeyes: true, hoff: 0, hx: 0.6, al: 1.5, ar: 1.5 });
    stars(d4, 16, 2.6, 0.5, 3);
    out.die.push(d4.outline(K.ol).toCanvas());
    var d5 = new DM.Spr(32);
    drawDown(d5, { bob: 3.5, xeyes: true, hoff: 0, hx: 0.6, al: 1.5, ar: 1.5 });
    d5 = d5.outline(K.ol);
    /* fade: checkerboard dither out */
    for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) if ((x + y) % 2 === 0) d5.d[y * 32 + x] = 0;
    stars(d5, 16, 2.6, 2.6, 3);
    out.die.push(d5.toCanvas());

    /* joy: arms up, big smile-eyes, jumping */
    out.joy.push(makeJoy(0).toCanvas(), makeJoy(1).toCanvas());
    return out;
  };

  function makeJoy(f) {
    var S = new DM.Spr(32);
    var up = f ? -2.5 : 0;
    drawDown(S, { bob: up, fl: f ? -1.5 : 0, fr: f ? -1.5 : 0, al: -6, ar: -6, shut: true });
    /* raise arms: overdraw two upward paws */
    [[5.8, -1], [26.2, 1]].forEach(function (a) {
      var ay = 13 + up;
      var arm = ell(a[0], ay, 2.6, 5);
      S.fill(arm, K.fur);
      S.fill(sub(arm, mv(arm, -1.2, -1.2)), K.furD);
      S.fill(ell(a[0], ay - 4.6, 2.9, 2.2), K.skin);
      claws(S, a[0], ay - 7.2);
    });
    /* open smile */
    S.fill(ell(16, 21 + up, 2.2, 1.6), K.eye);
    S.fill(ell(16, 21.8 + up, 1.2, 0.8), '#e0506a');
    return S.outline(K.ol);
  }

  /* 16x16 HUD face icon (A17): hand-placed pixel art, left half mirrored */
  var ICON_HALF = [
    '........',
    '.....ooo',
    '...ooyyy',
    '..oyyyll',
    '.oyyyyll',
    '.oyyyyyy',
    '.odddddd',
    '..ogggGG',
    '..ogkkgg',
    '..ogkkgg',
    '.occgGpp',
    '..ogGppp',
    '...ogGGP',
    '....oogg',
    '......oo',
    '........'
  ];
  DM.buildMoleIcon = function () {
    var S = new DM.Spr(16, 16, 16);
    var pal = {
      o: K.ol, y: K.helm, d: K.helmD, l: K.lamp, g: K.fur, G: K.furL, k: K.eye, c: K.cheek, p: K.nose, P: K.noseD
    };
    for (var y = 0; y < 16; y++) {
      var half = ICON_HALF[y];
      var full = half + half.split('').reverse().join('');
      for (var x = 0; x < 16; x++) {
        var ch = full.charAt(x);
        if (ch !== '.') S.set(x, y, pal[ch]);
      }
    }
    /* highlights (not mirrored) */
    S.set(5, 8, K.white);
    S.set(10, 8, K.white);
    S.set(5, 3, K.helmL);
    S.set(6, 2, K.helmL);
    S.set(7, 4, K.metal);
    S.set(8, 4, K.metal);
    S.set(7, 3, K.white);
    DM.moleIconSpr = S;
    return S.toCanvas();
  };
})();
