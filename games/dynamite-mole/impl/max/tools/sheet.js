/* Dev tool: draws zoomed sprite sheets so the procedural art can be inspected as an image.
 * Used by tools/sheet-shot.js (Playwright screenshot). Not part of the game. */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  var kind = q.get('kind') || 'chars';
  var Z = parseInt(q.get('z') || '3', 10);
  var themeIdx = parseInt(q.get('theme') || '0', 10);
  var S = {};
  var DM = window.DM;
  DM.ArtChars.build(S);
  DM.ArtTiles.build(S);
  DM.ArtUi.build(S);
  DM.Spr = S;
  var cv = document.getElementById('c');
  var ctx;
  var F = DM.Font;

  function setup(w, h) { cv.width = w; cv.height = h; ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; }
  function label(t, x, y) { F.draw(ctx, t, x, y, { scale: 1, color: '#e8e8f0' }); }
  function spr(img, x, y, z, bg) {
    z = z || Z;
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(x, y, img.width * z, img.height * z); }
    ctx.drawImage(img, 0, 0, img.width, img.height, x, y, img.width * z, img.height * z);
  }
  function tileBg(th, i) { return th.floorColors ? th.floorColors[i || 0] : '#8a6a44'; }

  function chars() {
    var cell = 32 * Z + 6, cols = 10;
    var rows = 10;
    setup(cols * cell + 10, rows * cell + 20);
    ctx.fillStyle = '#26262e'; ctx.fillRect(0, 0, cv.width, cv.height);
    var floor = '#8d6a45';
    var P = S.player, x0 = 5, y = 5, r = 0;
    ['down', 'up', 'left', 'right'].forEach(function (d) {
      var list = P.walk[d].concat(P.idle[d]);
      if (d === 'down') list = list.concat(P.joy);
      list.forEach(function (im, i) { spr(im, x0 + i * cell, y + r * cell, Z, floor); });
      r++;
    });
    P.death.forEach(function (im, i) { spr(im, x0 + i * cell, y + r * cell, Z, floor); });
    r++;
    S.slime.concat(S.bat).forEach(function (im, i) { spr(im, x0 + i * cell, y + r * cell, Z, floor); });
    r++;
    S.ghost.concat(S.ghostChase).forEach(function (im, i) { spr(im, x0 + i * cell, y + r * cell, Z, '#1a1d44'); });
    r++;
    S.golem.concat(S.golemFlash.slice(0, 2)).forEach(function (im, i) { spr(im, x0 + i * cell, y + r * cell, Z, floor); });
    r++;
    ['slime', 'bat', 'ghost', 'golem'].forEach(function (t, ti) {
      S.poof[t].forEach(function (im, i) { spr(im, x0 + (ti * 3 + i) * cell, y + r * cell, Z, '#2a3a5a'); });
    });
  }

  var kinds = { chars: chars };
  if (window.SheetKinds) Object.keys(window.SheetKinds).forEach(function (k) { kinds[k] = window.SheetKinds[k]; });
  window.__sheet = { setup: setup, spr: spr, label: label, S: S, Z: Z, themeIdx: themeIdx, ctx: function () { return ctx; }, kinds: kinds, run: function () { (kinds[kind] || chars)(); document.title = 'ready'; } };
  window.__sheet.run();
})();
