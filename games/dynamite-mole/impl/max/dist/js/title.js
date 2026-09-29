/* title.js - animated title screen: parallax cave, lantern glow, fireflies, fuse sparks, shimmering logo, breathing mole */
(function (root) {
  'use strict';
  var DM = root.DM = root.DM || {};
  var T = DM.Title = {};

  var lastT = null, sparks = [], flies = [], shineCv = null, shineCtx = null;
  var HERO = { x: 150, y: 148 }, BUNDLE = { x: 254, y: 152 };

  function init() {
    flies = [];
    for (var i = 0; i < 16; i++) {
      flies.push({ ax: 40 + DM.hash2(i, 1, 7) * 400, ay: 60 + DM.hash2(i, 2, 7) * 300, rx: 12 + DM.hash2(i, 3, 7) * 40, ry: 8 + DM.hash2(i, 4, 7) * 26,
        sp: 0.25 + DM.hash2(i, 5, 7) * 0.5, ph: DM.hash2(i, 6, 7) * 6.28, col: i % 3 });
    }
  }

  T.reset = function () { sparks.length = 0; lastT = null; };

  T.draw = function (ctx, t) {
    var S = DM.Spr, A = S.title;
    if (!flies.length) init();
    var dt = lastT == null ? 0 : Math.max(0, Math.min(0.1, t - lastT));
    lastT = t;
    var sway = Math.sin(t * 0.28);
    var ox0 = Math.round(sway * 8), ox1 = Math.round(sway * 16), ox2 = Math.round(sway * 26);
    ctx.drawImage(A.far, -40 + ox0, 0);
    ctx.drawImage(A.mid, -40 + ox1, 0);

    ctx.drawImage(A.near, -40 + ox2, 0);

    /* lantern glows (additive light, drawn over the timber frame) */
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < A.lamps.length; i++) {
      var fl = 0.55 + 0.25 * Math.sin(t * 6.1 + i * 2) + 0.12 * Math.sin(t * 13.3 + i);
      ctx.globalAlpha = 0.38 * fl;
      ctx.drawImage(S.themes[0].glow, A.lamps[i][0] + ox2 - 64, A.lamps[i][1] - 64);
    }
    ctx.globalAlpha = 0.16 + 0.05 * Math.sin(t * 2.4);
    ctx.drawImage(S.themes[0].glow, BUNDLE.x + 32 - 64 + 8, BUNDLE.y + 8 - 64);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';


    /* hero illustration: breathing / blinking mole and the lit dynamite */
    var hf = ((t % 3.2) > 3.05) ? 2 : (Math.floor(t * 1.6) & 1);
    ctx.drawImage(A.hero[hf], HERO.x, HERO.y + (hf === 1 ? 0 : 0));
    ctx.drawImage(A.bundle, BUNDLE.x, BUNDLE.y);
    /* sparks flying from the fuse */
    var fx = BUNDLE.x + 39, fy = BUNDLE.y + 7;
    var emit = dt * 46 + (T._carry || 0), n = Math.floor(emit);
    T._carry = emit - n;
    for (var k = 0; k < n && sparks.length < 60; k++) {
      var a = -Math.PI / 2 + (DM.fxRand() - 0.5) * 2.4, sp = 25 + DM.fxRand() * 60;
      sparks.push({ x: fx, y: fy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + DM.fxRand() * 0.4, max: 0.8, c: k % 3 });
    }
    for (var j = sparks.length - 1; j >= 0; j--) {
      var s = sparks[j];
      s.life -= dt; if (s.life <= 0) { sparks.splice(j, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 90 * dt;
      ctx.fillStyle = ['#fffbd0', '#ffd23f', '#ff8a1a'][s.c];
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.life > 0.25 ? 2 : 1, s.life > 0.25 ? 2 : 1);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(fx, fy - 1, 1, 3); ctx.fillRect(fx - 1, fy, 3, 1);

    /* fireflies */
    ctx.globalCompositeOperation = 'lighter';
    for (var q = 0; q < flies.length; q++) {
      var f = flies[q];
      var px = f.ax + Math.cos(t * f.sp + f.ph) * f.rx + ox1 * 0.6, py = f.ay + Math.sin(t * f.sp * 1.3 + f.ph) * f.ry;
      var tw = 0.5 + 0.5 * Math.sin(t * 3 + f.ph * 3);
      ctx.globalAlpha = 0.25 * tw;
      ctx.fillStyle = ['#7dffd4', '#ffd27a', '#ff9be6'][f.col];
      ctx.fillRect(Math.round(px) - 2, Math.round(py) - 1, 5, 3);
      ctx.fillRect(Math.round(px) - 1, Math.round(py) - 2, 3, 5);
      ctx.globalAlpha = 0.5 + 0.5 * tw;
      ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    /* logo with sway and a light sweep */
    var ly = 10 + Math.round(Math.sin(t * 1.5) * 1.5);
    ctx.drawImage(S.logo, 20, ly);
    DM.Font.register('DYNAMITE MOLE');      // the logo is built from the bitmap font's glyphs
    var cyc = (t % 4.2) / 4.2;
    if (cyc < 0.42) {
      if (!shineCv) { shineCv = document.createElement('canvas'); shineCv.width = 440; shineCv.height = 120; shineCtx = shineCv.getContext('2d'); }
      shineCtx.clearRect(0, 0, 440, 120);
      shineCtx.globalCompositeOperation = 'source-over';
      shineCtx.drawImage(S.logo, 0, 0);
      shineCtx.globalCompositeOperation = 'source-atop';
      var px0 = -60 + cyc / 0.42 * 560;
      var g = shineCtx.createLinearGradient(px0 - 26, 0, px0 + 26, 40);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      shineCtx.fillStyle = g;
      shineCtx.fillRect(0, 0, 440, 120);
      shineCtx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.9;
      ctx.drawImage(shineCv, 20, ly);
      ctx.globalAlpha = 1;
    }
    /* sparkle on the fuse of the right dynamite */
    var lm = S.logoMeta;
    var tw2 = (Math.floor(t * 10) % 3);
    ctx.fillStyle = tw2 === 0 ? '#ffffff' : '#ffd23f';
    ctx.fillRect(20 + lm.sparkX - 1, ly + 66 - 12, tw2 === 1 ? 3 : 1, 1); ctx.fillRect(20 + lm.sparkX, ly + 66 - 13, 1, tw2 === 1 ? 3 : 1);
    ctx.drawImage(A.vignette, 0, 0);
  };
})(typeof window !== 'undefined' ? window : globalThis);
