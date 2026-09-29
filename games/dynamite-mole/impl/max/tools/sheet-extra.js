/* extra sheet kinds for tools/sheet.html (loaded after sheet.js? no: before, see sheet.html) */
(function () {
  'use strict';
  window.SheetKinds = window.SheetKinds || {};
  var K = window.SheetKinds;
  function api() { return window.__sheet; }

  /* big zoom of selected mole frames */
  K.mole = function () {
    var A = api(), S = A.S, Z = A.Z, cell = 32 * Z + 8;
    A.setup(cell * 4 + 10, cell * 3 + 20);
    var ctx = A.ctx();
    ctx.fillStyle = '#26262e'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    var P = S.player;
    var list = [P.walk.down[0], P.walk.down[1], P.walk.up[0], P.walk.left[0],
      P.walk.left[1], P.walk.right[3], P.idle.down[1], P.joy[0],
      P.joy[1], P.death[0], P.death[2], P.death[4]];
    list.forEach(function (im, i) { A.spr(im, 5 + (i % 4) * cell, 5 + Math.floor(i / 4) * cell, Z, '#8d6a45'); });
  };

  K.enemies = function () {
    var A = api(), S = A.S, Z = A.Z, cell = 32 * Z + 8;
    A.setup(cell * 6 + 10, cell * 4 + 20);
    var ctx = A.ctx();
    ctx.fillStyle = '#26262e'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    var list = [S.slime[0], S.slime[1], S.slime[3], S.bat[0], S.bat[1], S.bat[2],
      S.ghost[0], S.ghost[2], S.ghostChase[0], S.ghostChase[1], S.golem[0], S.golem[1],
      S.golem[3], S.golemFlash[0], S.poof.slime[0], S.poof.slime[1], S.poof.slime[2], S.poof.golem[0], S.poof.ghost[1], S.poof.bat[2]];
    list.forEach(function (im, i) { A.spr(im, 5 + (i % 6) * cell, 5 + Math.floor(i / 6) * cell, Z, i >= 6 && i < 10 ? '#1a1d44' : '#8d6a45'); });
  };

  K.tiles = function () {
    var A = api(), S = A.S, Z = A.Z, th = S.themes[A.themeIdx], cell = 32 * Z + 6;
    A.setup(cell * 8 + 10, cell * 3 + 16);
    var ctx = A.ctx();
    ctx.fillStyle = '#26262e'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    var bg = th.floorColors[0];
    th.floor.forEach(function (im, i) { A.spr(im, 5 + i * cell, 5, Z); });
    var row2 = [th.wall.plain, th.wall.bottom, th.wall.top, th.wall.left, th.wall.right, th.pillar, th.rock[0], th.rock[1]];
    row2.forEach(function (im, i) { A.spr(im, 5 + i * cell, 5 + cell, Z, i >= 5 ? bg : null); });
    var row3 = th.crumble[0].concat(th.crumble[1]).concat(th.lampFrames.slice(0, 2));
    row3.forEach(function (im, i) { A.spr(im, 5 + i * cell, 5 + 2 * cell, Z, bg); });
  };

  K.objects = function () {
    var A = api(), S = A.S, Z = A.Z, cell = 32 * Z + 6;
    A.setup(cell * 8 + 10, cell * 6 + 16);
    var ctx = A.ctx();
    ctx.fillStyle = '#26262e'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    var bg = S.themes[A.themeIdx].floorColors[0];
    var rows = [
      [S.exit.closed, S.exit.open[0], S.exit.open[1]].concat(S.bomb).concat(S.bombFlash.slice(0, 2)),
      S.flame.center.concat(S.flame.armH, S.flame.tip.right),
      S.flame.small.center.concat(S.flame.small.armH, S.flame.small.tip.right, S.flame.small.tip.up),
      S.flame.tip.up.concat(S.flame.tip.down, S.flame.tip.left, S.flame.armV).slice(0, 8),
      S.item.fire.concat(S.item.bomb, S.item.boots, S.item.life),
      [S.lifeIcon]
    ];
    rows.forEach(function (row, r) { row.forEach(function (im, i) { A.spr(im, 5 + i * cell, 5 + r * cell, im.width < 20 ? Z * 2 : Z, bg); }); });
  };

  K.ui = function () {
    var A = api(), S = A.S;
    A.setup(960, 900);
    var ctx = A.ctx();
    ctx.fillStyle = '#26262e'; ctx.fillRect(0, 0, 960, 900);
    ctx.drawImage(S.hudBg, 0, 0);
    ctx.drawImage(S.hudBg, 480, 0);
    ctx.fillStyle = '#1b1230'; ctx.fillRect(0, 70, 480, 130);
    ctx.drawImage(S.logo, 20, 76);
    var y = 210;
    ['far', 'mid', 'near'].forEach(function (k, i) { ctx.drawImage(S.title[k], 40, 0, 480, 416, i * 320, y, 320, 277); });
    ctx.drawImage(S.title.hero[0], 500, 76); ctx.drawImage(S.title.hero[1], 570, 76); ctx.drawImage(S.title.hero[2], 640, 76); ctx.drawImage(S.title.bundle, 720, 76);
    var tx = 500, ty = 500;
    ['up', 'down', 'left', 'right'].forEach(function (d, i) { ctx.drawImage(S.touch[d][0], tx + i * 44, ty); ctx.drawImage(S.touch[d][1], tx + i * 44, ty + 44); });
    ctx.drawImage(S.touch.bomb[0], tx, ty + 100); ctx.drawImage(S.touch.bomb[1], tx + 64, ty + 100);
    ctx.drawImage(S.touch.pause[0], tx + 140, ty + 100); ctx.drawImage(S.touch.pause[1], tx + 140, ty + 130);
    ctx.drawImage(S.favicon, tx + 240, ty); ctx.drawImage(S.lifeIcon, tx + 280, ty);
  };
  K.titlebg = function () {
    var A = api(), S = A.S, Z = A.Z;
    A.setup(480 * Z, 416 * Z);
    var ctx = A.ctx();
    ctx.imageSmoothingEnabled = false;
    ctx.save(); ctx.scale(Z, Z);
    ctx.drawImage(S.title.far, -40, 0); ctx.drawImage(S.title.mid, -40, 0); ctx.drawImage(S.title.near, -40, 0);
    ctx.drawImage(S.logo, 20, 12);
    ctx.drawImage(S.title.hero[0], 150, 150); ctx.drawImage(S.title.bundle, 250, 150);
    ctx.restore();
  };
})();
