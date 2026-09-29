/* render.js - draws every screen onto the 480 x 416 canvas. Reads DM.game, never mutates game rules. */
(function () {
  'use strict';
  var DM = window.DM;
  var font = DM.font;

  var W = 480, H = 416, FY = 64;
  var R = (DM.render = {});
  var ctx = null;
  var spr = null;
  var bgCache = { id: -1, canvas: null };
  var lightLayer = null, lightCtx = null;
  var shineTmp = null;

  R.init = function (canvas, sprites) {
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    spr = sprites;
    lightLayer = DM.mkCanvas(W, H - FY);
    lightCtx = lightLayer.getContext('2d');
    shineTmp = DM.mkCanvas(440, 120);
  };

  function txt(str, x, y, o) {
    return font.draw(ctx, str, x, y, o);
  }
  function blit(cv, x, y) {
    ctx.drawImage(cv, Math.round(x), Math.round(y));
  }
  function fmtTime(t) {
    var s = Math.ceil(t);
    if (s < 0) s = 0;
    var m = Math.floor(s / 60), ss = s % 60;
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  /* ---------------------------------------------------------- static level layer */
  function buildBg(L) {
    var T = spr.tiles.themes[L.themeIdx];
    var c = DM.mkCanvas(W, H - FY);
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    var r, cc;
    for (r = 0; r < DM.ROWS; r++) {
      for (cc = 0; cc < DM.COLS; cc++) {
        var outer = r === 0 || r === 10 || cc === 0 || cc === 14;
        if (outer) {
          x.drawImage(T.wall, cc * 32, r * 32);
          continue;
        }
        var h = DM.hash(cc, r, 1234 + L.themeIdx);
        var idx = (cc + r) & 1;
        if (h < 0.11) idx += 2;
        x.drawImage(T.floor[idx], cc * 32, r * 32);
      }
    }
    /* soft shadows under walls / pillars */
    for (r = 1; r < DM.ROWS - 1; r++) {
      for (cc = 1; cc < DM.COLS - 1; cc++) {
        if (DM.isFixedWall(cc, r)) continue;
        if (DM.isFixedWall(cc, r - 1)) {
          for (var i = 0; i < 5; i++) {
            x.fillStyle = 'rgba(0,0,0,' + (0.3 - i * 0.055).toFixed(3) + ')';
            x.fillRect(cc * 32, r * 32 + i, 32, 1);
          }
        }
        if (DM.isFixedWall(cc - 1, r)) {
          for (var j = 0; j < 4; j++) {
            x.fillStyle = 'rgba(0,0,0,' + (0.24 - j * 0.06).toFixed(3) + ')';
            x.fillRect(cc * 32 + j, r * 32, 1, 32);
          }
        }
      }
    }
    for (r = 1; r < DM.ROWS - 1; r++)
      for (cc = 1; cc < DM.COLS - 1; cc++) if (r % 2 === 0 && cc % 2 === 0) x.drawImage(T.pillar, cc * 32, r * 32);
    return c;
  }

  var TORCHES = [[3, 0], [7, 0], [11, 0]];

  /* ---------------------------------------------------------- lighting */
  function drawLighting(G, ox, oy) {
    var L = G.L, p = G.player;
    var T = DM.THEMES[L.themeIdx];
    var lc = lightCtx;
    lc.globalCompositeOperation = 'source-over';
    lc.globalAlpha = 1;
    lc.clearRect(0, 0, W, H - FY);
    lc.fillStyle = T.amb[0];
    lc.globalAlpha = T.amb[1] * 0.9;
    lc.fillRect(0, 0, W, H - FY);
    lc.globalAlpha = 1;
    lc.drawImage(spr.ui.vignette, 0, 0);
    lc.globalCompositeOperation = 'destination-out';
    var flick = 0.85 + 0.15 * Math.sin(G.t * 9.3) * Math.sin(G.t * 5.1 + 1);
    /* player's headlamp */
    if (p.alive || G.state === 'stageClear') {
      var px = p.x * 32 + 16, py = p.y * 32 + 14;
      lc.globalAlpha = 0.95 * flick;
      lc.drawImage(spr.ui.light, px - 88, py - 88, 176, 176);
    }
    var i;
    for (i = 0; i < TORCHES.length; i++) {
      lc.globalAlpha = 0.75 * (0.8 + 0.2 * Math.sin(G.t * 11 + i * 2));
      lc.drawImage(spr.ui.light, TORCHES[i][0] * 32 + 16 - 60, 16 + 4 - 60 + 14, 120, 120);
    }
    for (i = 0; i < L.bombs.length; i++) {
      var b = L.bombs[i];
      lc.globalAlpha = 0.55 + 0.25 * Math.sin(G.t * 14 + i);
      lc.drawImage(spr.ui.light, b.col * 32 + 16 - 40, b.row * 32 + 16 - 40, 80, 80);
    }
    lc.globalAlpha = 0.95;
    for (i = 0; i < L.flames.length; i++) {
      var f = L.flames[i];
      lc.drawImage(spr.ui.light, f.col * 32 + 16 - 56, f.row * 32 + 16 - 56, 112, 112);
    }
    if (L.exit.revealed && L.exit.open) {
      lc.globalAlpha = 0.7;
      lc.drawImage(spr.ui.light, L.exit.col * 32 + 16 - 48, L.exit.row * 32 + 16 - 48, 96, 96);
    }
    lc.globalAlpha = 1;
    lc.globalCompositeOperation = 'source-over';
    ctx.drawImage(lightLayer, 0, FY);

    /* warm additive glows */
    ctx.globalCompositeOperation = 'lighter';
    if (p.alive || G.state === 'stageClear') {
      ctx.globalAlpha = 0.5 * flick;
      ctx.drawImage(spr.ui.glowWarm, p.x * 32 + 16 - 64, FY + p.y * 32 + 14 - 64, 128, 128);
    }
    ctx.globalAlpha = 0.6;
    for (i = 0; i < TORCHES.length; i++) ctx.drawImage(spr.ui.glowWarm, TORCHES[i][0] * 32 + 16 - 40, FY + 18 - 40, 80, 80);
    ctx.globalAlpha = 0.7;
    for (i = 0; i < L.flames.length; i++) ctx.drawImage(spr.ui.glowRed, L.flames[i].col * 32 + 16 - 44, FY + L.flames[i].row * 32 + 16 - 44, 88, 88);
    ctx.globalAlpha = 0.5;
    for (i = 0; i < L.bombs.length; i++) ctx.drawImage(spr.ui.glowRed, L.bombs[i].col * 32 + 16 - 32, FY + L.bombs[i].row * 32 + 16 - 32, 64, 64);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------------------------------------------------------- field */
  function shadowBlob(cx, y, w) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(Math.round(cx - w / 2), Math.round(y), w, 1);
    ctx.fillRect(Math.round(cx - w / 2 + 1), Math.round(y) + 1, w - 2, 1);
    ctx.fillRect(Math.round(cx - w / 2 + 2), Math.round(y) - 1, w - 4, 1);
  }

  function playerSprite(G) {
    var p = G.player, S = spr.mole;
    if (!p.alive) {
      var idx = Math.min(5, Math.floor(p.deathAge / 0.2));
      return S.die[idx];
    }
    if (p.joy) return S.joy[Math.floor(G.stateT / 0.25) % 2];
    if (p.moving || p.idleT < 0.05) {
      /* walking: 4 frames per direction, phase advances with distance walked */
      return S[p.facing][Math.floor(p.walkPhase) % 4];
    }
    var breath = p.idleT > 0.5 ? Math.floor((p.idleT - 0.5) / 0.55) % 2 : 0;
    return S.idle[p.facing][breath];
  }

  function enemySprite(e, G) {
    var E = spr.enemy;
    if (!e.alive) return E.death[e.type][Math.min(3, Math.floor(e.deathAge / 0.1))];
    var t = G.t + e.phase;
    if (e.type === 'slime') return E.slime[Math.floor(t * 6) % 4];
    if (e.type === 'bat') return E.bat[Math.floor(t * 12) % 4];
    if (e.type === 'ghost') return E.ghost[(e.chase ? 4 : 0) + (Math.floor(t * 5) % 4)];
    var fr = Math.floor(t * (e.moving ? 5 : 2)) % 4;
    if (e.invuln > 0 && Math.floor(e.invuln * 16) % 2 === 0) return E.golemFlash[fr];
    return E.golem[fr];
  }

  function drawField(G) {
    var L = G.L, p = G.player;
    var T = spr.tiles.themes[L.themeIdx];
    if (bgCache.id !== L.id) {
      bgCache.canvas = buildBg(L);
      bgCache.id = L.id;
    }
    var i, j;
    var sx = 0, sy = 0;
    if (G.shakeT > 0) {
      var m = 4 * (G.shakeT / 0.2);
      sx = Math.round((DM.vfxRng() - 0.5) * 2 * m);
      sy = Math.round((DM.vfxRng() - 0.5) * 2 * m);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, FY, W, H - FY);
    ctx.clip();
    ctx.translate(sx, sy);
    ctx.drawImage(bgCache.canvas, 0, FY);
    /* torches on the top wall */
    for (i = 0; i < TORCHES.length; i++) blit(spr.tiles.torch[Math.floor(G.t * 9 + i * 1.3) % 4], TORCHES[i][0] * 32, FY + TORCHES[i][1] * 32 + 2);

    /* exit */
    var ex = L.exit;
    if (ex.revealed) {
      var ecv = ex.open ? spr.tiles.exit.open[Math.floor(G.t * 3) % 2] : spr.tiles.exit.closed;
      blit(ecv, ex.col * 32, FY + ex.row * 32);
      if (ex.flash > 0) {
        ctx.globalAlpha = Math.min(1, ex.flash / 0.5) * 0.85;
        ctx.fillStyle = '#fff6c0';
        ctx.fillRect(ex.col * 32 - 4, FY + ex.row * 32 - 4, 40, 40);
        ctx.globalAlpha = 1;
      }
    }
    /* items */
    for (i = 0; i < L.items.length; i++) {
      var it = L.items[i];
      var bob = Math.round(Math.sin(G.t * 4 + it.col * 1.7 + it.row) * 1.6) - 1;
      blit(spr.tiles.item[it.type][Math.floor(G.t * 2.5 + it.col) % 2], it.col * 32, FY + it.row * 32 + bob);
    }
    /* rocks */
    for (i = 0; i < DM.ROWS; i++)
      for (j = 0; j < DM.COLS; j++) if (L.grid[i][j] === DM.SOFT) blit(T.rock, j * 32, FY + i * 32);
    for (i = 0; i < L.crumbles.length; i++) {
      var cr = L.crumbles[i];
      blit(T.crumble[Math.min(2, Math.floor(cr.t / 0.1))], cr.col * 32, FY + cr.row * 32);
    }
    /* bombs */
    for (i = 0; i < L.bombs.length; i++) {
      var b = L.bombs[i];
      var fr = Math.floor(b.age * 8) % 3;
      var hot = b.timeLeft < 0.8 ? Math.floor(b.timeLeft * (b.timeLeft < 0.35 ? 22 : 12)) % 2 === 0 : false;
      /* little hop when the stick is set down */
      var pop = b.age < 0.16 ? Math.round(Math.sin((b.age / 0.16) * Math.PI) * 4) : 0;
      blit(hot ? spr.tiles.bombFlash[fr] : spr.tiles.bomb[fr], b.col * 32, FY + b.row * 32 - pop);
    }
    /* flames */
    for (i = 0; i < L.flames.length; i++) {
      var f = L.flames[i];
      var fa = f.timeLeft < 0.12 ? f.timeLeft / 0.12 : 1;
      if (fa < 1) ctx.globalAlpha = fa;
      blit(spr.tiles.flame[f.kind][Math.floor(f.age * 16) % 4], f.col * 32, FY + f.row * 32);
      if (fa < 1) ctx.globalAlpha = 1;
    }
    /* entities sorted by depth */
    var ents = [];
    for (i = 0; i < L.enemies.length; i++) ents.push({ y: L.enemies[i].y, e: L.enemies[i] });
    ents.push({ y: p.y + 0.001, p: true });
    ents.sort(function (a, c) {
      return a.y - c.y;
    });
    for (i = 0; i < ents.length; i++) {
      var en = ents[i];
      if (en.p) {
        var show = true;
        if (p.alive && p.invincible > 0 && Math.floor(p.invincible / 0.0625) % 2 === 1) show = false;
        if (show) blit(playerSprite(G), p.x * 32, FY + p.y * 32);
      } else {
        var e = en.e;
        var yoff = 0;
        if (e.alive && e.type === 'bat') {
          yoff = -4 + Math.round(Math.sin((G.t + e.phase) * 6) * 1.5);
          shadowBlob(e.x * 32 + 16, FY + e.y * 32 + 28, 12);
        } else if (e.alive && e.type === 'ghost') {
          yoff = -2 + Math.round(Math.sin((G.t + e.phase) * 3) * 1.5);
        }
        var cv = enemySprite(e, G);
        if (e.alive && e.type === 'ghost') ctx.globalAlpha = 0.92;
        blit(cv, e.x * 32, FY + e.y * 32 + yoff);
        ctx.globalAlpha = 1;
      }
    }
    /* particles */
    for (i = 0; i < G.particles.length; i++) {
      var q = G.particles[i];
      var a = Math.max(0, Math.min(1, q.life / q.max));
      if (q.kind === 'dust') {
        ctx.globalAlpha = a * 0.55;
        ctx.fillStyle = q.color;
        var ds = q.size + Math.round((1 - a) * 2);
        ctx.fillRect(Math.round(q.x - ds / 2), Math.round(q.y - ds / 2), ds, ds);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = q.kind === 'spark' ? Math.min(1, a * 1.6) : 1;
        ctx.fillStyle = q.color;
        ctx.fillRect(Math.round(q.x - q.size / 2), Math.round(q.y - q.size / 2), q.size, q.size);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();

    /* ambient light (also shaken with the field) */
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, FY, W, H - FY);
    ctx.clip();
    drawLighting(G, sx, sy);
    ctx.restore();

    /* popups on top of the lighting so the numbers stay readable */
    for (i = 0; i < G.popups.length; i++) {
      var pp = G.popups[i];
      var k = pp.t / 0.8;
      ctx.globalAlpha = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
      txt(pp.text, pp.x, pp.y - k * 22, { scale: 2, align: 'center', color: pp.color, outline: '#1a1030' });
      ctx.globalAlpha = 1;
    }
  }

  /* ---------------------------------------------------------- HUD */
  var HUD_LIFE = null;
  function drawHud(G) {
    var L = G.L, p = G.player;
    ctx.drawImage(spr.ui.hud, 0, 0);
    var sh = '#0a0610';
    txt('SCORE ' + DM.pad(G.score, 6), 10, 4, { scale: 2, color: '#fff0b8', shadow: sh });
    txt('HI ' + DM.pad(Math.max(G.hiSaved, G.score), 6), 470, 4, { scale: 2, color: '#a8e0ff', shadow: sh, align: 'right' });
    var low = G.timeLeft <= 30 && G.timeLeft > 0 && G.state === 'playing';
    var tcol = low ? (Math.floor(G.t * 4) % 2 ? '#ff5a4a' : '#ffffff') : G.timeLeft <= 0 ? '#ff5a4a' : '#ffffff';
    txt('TIME ' + fmtTime(G.timeLeft), 10, 23, { scale: 2, color: tcol, shadow: sh });
    txt('STAGE ' + G.stage + '/5', 470, 23, { scale: 2, color: '#ffd0a0', shadow: sh, align: 'right' });
    /* row 3 */
    ctx.drawImage(spr.mole.icon, 8, 41);
    txt('x' + G.lives, 28, 42, { scale: 2, color: '#ffffff', shadow: sh });
    txt('BOMB ' + p.maxBombs, 84, 42, { scale: 2, color: '#ff9a86', shadow: sh });
    txt('FIRE ' + p.range, 186, 42, { scale: 2, color: '#ffc040', shadow: sh });
    txt('SPD ' + p.boots, 288, 42, { scale: 2, color: '#8ae8ff', shadow: sh });
    txt('SND ' + (DM.audio.muted ? 'OFF' : 'ON'), 470, 42, { scale: 2, color: DM.audio.muted ? '#9a90a8' : '#8affa0', shadow: sh, align: 'right' });
  }

  /* ---------------------------------------------------------- overlays */
  function dim(alpha, y0, h) {
    ctx.fillStyle = 'rgba(6,4,14,' + alpha + ')';
    ctx.fillRect(0, y0 === undefined ? FY : y0, W, h === undefined ? H - FY : h);
  }
  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(10,6,22,0.86)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#e0b060';
    ctx.fillRect(x, y, w, 2);
    ctx.fillRect(x, y + h - 2, w, 2);
    ctx.fillRect(x, y, 2, h);
    ctx.fillRect(x + w - 2, y, 2, h);
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(x + 2, y + 2, w - 4, 1);
    ctx.fillRect(x + 2, y + h - 3, w - 4, 1);
    ctx.fillStyle = '#e0b060';
    ctx.fillRect(x + 4, y + 4, 2, 2);
    ctx.fillRect(x + w - 6, y + 4, 2, 2);
    ctx.fillRect(x + 4, y + h - 6, 2, 2);
    ctx.fillRect(x + w - 6, y + h - 6, 2, 2);
  }

  function drawIntro(G) {
    var def = G.L.def;
    dim(0.62);
    var k = Math.min(1, G.stateT / 0.25);
    var bounce = Math.round((1 - k) * 18);
    panel(60, 150, 360, 176);
    var cx = 240;
    txt('STAGE ' + G.stage, cx, 168 - bounce, { scale: 4, align: 'center', color: '#ffe45a', shadow: '#5a2a0a' });
    txt(def.name, cx, 216, { scale: 2, align: 'center', color: '#ffffff', shadow: '#0a0610' });
    var total = def.enemies.slime + def.enemies.bat + def.enemies.ghost + def.enemies.golem;
    txt('ENEMIES ' + total, cx, 248, { scale: 2, align: 'center', color: '#ff9a86', shadow: '#0a0610' });
    /* small enemy icons: one per enemy, grouped by kind */
    var list = [];
    DM.ENEMY_ORDER.forEach(function (t) {
      for (var n = 0; n < def.enemies[t]; n++) list.push(t);
    });
    var iw = 26;
    var x0 = cx - (list.length * iw) / 2;
    list.forEach(function (t, i) {
      var cvs = spr.enemy[t][t === 'bat' ? 1 : t === 'ghost' ? 0 : Math.floor(G.t * 4 + i) % 2 ? 0 : 1];
      ctx.drawImage(cvs, Math.round(x0 + i * iw - 3), 272);
    });
  }

  function drawPause(G) {
    dim(0.58);
    panel(100, 148, 280, 160);
    txt('PAUSED', 240, 166, { scale: 4, align: 'center', color: '#ffe45a', shadow: '#5a2a0a' });
    txt('P / ESC  RESUME', 240, 222, { scale: 2, align: 'center', color: '#ffffff', shadow: '#0a0610' });
    txt('R  RESTART', 240, 250, { scale: 2, align: 'center', color: '#ffd0a0', shadow: '#0a0610' });
    txt('M  SOUND', 240, 278, { scale: 2, align: 'center', color: '#8ae8ff', shadow: '#0a0610' });
  }

  function drawClear(G) {
    dim(0.36);
    var k = Math.min(1, G.stateT / 0.3);
    var by = Math.round((1 - k) * 24);
    /* keep the mole's happy pose visible: park the panel on the side of the field away from it */
    var py = G.player.y * 32 + 64 > 240 ? 84 : 262;
    panel(70, py, 340, 108);
    txt('STAGE CLEAR!', 240, py + 14 - by, { scale: 3, align: 'center', color: '#ffe45a', shadow: '#5a2a0a' });
    txt('CLEAR BONUS +' + G.clearBonus, 240, py + 52, { scale: 2, align: 'center', color: '#ffffff', shadow: '#0a0610' });
    txt('TIME BONUS +' + G.timeBonus, 240, py + 76, { scale: 2, align: 'center', color: '#8affa0', shadow: '#0a0610' });
  }

  function confetti(G) {
    var cols = ['#ffe45a', '#ff6a5a', '#7ae6ff', '#8affa0', '#ff9aff'];
    for (var i = 0; i < 46; i++) {
      var h1 = DM.hash(i, 1, 5), h2 = DM.hash(i, 2, 5), h3 = DM.hash(i, 3, 5);
      var x = h1 * W + Math.sin(G.t * (1 + h3) + i) * 12;
      var y = FY + ((G.t * (30 + h2 * 40) + h3 * 400) % (H - FY));
      ctx.fillStyle = cols[i % 5];
      var s = 2 + (i % 3);
      ctx.fillRect(Math.round(x), Math.round(y), s, s + (i % 2));
    }
  }

  function drawGameOver(G) {
    dim(0.74);
    panel(96, 78, 288, 276);
    var blink = Math.floor(G.t * 2.5) % 2 === 0;
    txt('GAME OVER', 240, 92, { scale: 4, align: 'center', color: '#ff5a48', shadow: '#3a0a0a' });
    txt('SCORE ' + DM.pad(G.score, 6), 240, 158, { scale: 2, align: 'center', color: '#ffffff', shadow: '#0a0610' });
    txt('BEST  ' + DM.pad(Math.max(G.hiSaved, G.score), 6), 240, 184, { scale: 2, align: 'center', color: '#a8e0ff', shadow: '#0a0610' });
    txt('REACHED STAGE ' + G.stage, 240, 210, { scale: 2, align: 'center', color: '#ffd0a0', shadow: '#0a0610' });
    if (G.newRecord) txt('NEW RECORD!', 240, 244, { scale: 2, align: 'center', color: blink ? '#ffe45a' : '#ff9a26', shadow: '#3a2a0a' });
    var ready = G.stateT >= 0.6;
    txt('ENTER  RETRY', 240, 296, { scale: 2, align: 'center', color: ready ? '#ffffff' : '#7a7090', shadow: '#0a0610' });
    txt('ESC    TITLE', 240, 322, { scale: 2, align: 'center', color: ready ? '#ffffff' : '#7a7090', shadow: '#0a0610' });
  }

  function drawGameClear(G) {
    dim(0.68);
    panel(64, 72, 352, 286);
    confetti(G);
    var blink = Math.floor(G.t * 2.5) % 2 === 0;
    txt('CONGRATULATIONS!', 240, 84, { scale: 3, align: 'center', color: '#ffe45a', shadow: '#5a2a0a' });
    txt('YOU ESCAPED THE MINE', 240, 122, { scale: 2, align: 'center', color: '#ffffff', shadow: '#0a0610' });
    var j = spr.mole.joy[Math.floor(G.t * 3) % 2];
    ctx.drawImage(j, 224, 146 - (Math.floor(G.t * 3) % 2) * 2);
    txt('SCORE ' + DM.pad(G.score, 6), 240, 196, { scale: 2, align: 'center', color: '#ffffff', shadow: '#0a0610' });
    txt('BEST  ' + DM.pad(Math.max(G.hiSaved, G.score), 6), 240, 222, { scale: 2, align: 'center', color: '#a8e0ff', shadow: '#0a0610' });
    if (G.newRecord) txt('NEW RECORD!', 240, 252, { scale: 2, align: 'center', color: blink ? '#ffe45a' : '#ff9a26', shadow: '#3a2a0a' });
    var ready = G.stateT >= 0.6;
    txt('ENTER  PLAY AGAIN', 240, 300, { scale: 2, align: 'center', color: ready ? '#ffffff' : '#7a7090', shadow: '#0a0610' });
    txt('ESC    TITLE', 240, 326, { scale: 2, align: 'center', color: ready ? '#ffffff' : '#7a7090', shadow: '#0a0610' });
  }

  /* ---------------------------------------------------------- title */
  function drawTitle(G) {
    var t = G.t;
    var U = spr.ui;
    var sway = Math.sin(t * 0.35);
    ctx.drawImage(U.titleFar, Math.round(-12 + sway * 7), 0);
    ctx.drawImage(U.titleMid, Math.round(-12 + sway * 3), 0);
    ctx.drawImage(U.titleNear, 0, 0);
    /* glowing ore glints in the far wall */
    for (var g = 0; g < 14; g++) {
      var ph = (t * 0.8 + DM.hash(g, 1, 9) * 6) % 3;
      if (ph < 0.5) {
        var gx = Math.round(DM.hash(g, 2, 9) * 470) + 4, gy = Math.round(DM.hash(g, 3, 9) * 200) + 30;
        ctx.fillStyle = ph < 0.25 ? '#ffffff' : '#ffe07a';
        ctx.fillRect(gx, gy - 2, 1, 5);
        ctx.fillRect(gx - 2, gy, 5, 1);
      }
    }
    /* lantern glow */
    ctx.globalCompositeOperation = 'lighter';
    [56, 424].forEach(function (lx, i) {
      ctx.globalAlpha = 0.75 + 0.15 * Math.sin(t * 7 + i * 2);
      ctx.drawImage(U.glowWarm, lx - 70, 62 - 70, 140, 140);
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    /* logo with a light sweep */
    var lx0 = 20, ly0 = 22;
    var bob = Math.round(Math.sin(t * 1.6) * 2);
    ctx.drawImage(U.logo, lx0, ly0 + bob);
    var cyc = (t % 3.6) / 0.9;
    if (cyc < 1) {
      var sc = shineTmp.getContext('2d');
      sc.globalCompositeOperation = 'source-over';
      sc.clearRect(0, 0, 440, 120);
      sc.drawImage(U.logo, 0, 0);
      sc.globalCompositeOperation = 'source-atop';
      var bx = -60 + cyc * 560;
      sc.fillStyle = 'rgba(255,255,255,0.4)';
      sc.beginPath();
      sc.moveTo(bx, 0);
      sc.lineTo(bx + 26, 0);
      sc.lineTo(bx - 10, 120);
      sc.lineTo(bx - 36, 120);
      sc.closePath();
      sc.fill();
      sc.globalCompositeOperation = 'source-over';
      ctx.drawImage(shineTmp, lx0, ly0 + bob);
    }

    /* mole + dynamite on the ledge */
    var ground = 240;
    var moleF = t % 3.2 > 3.05 ? 2 : Math.floor(t / 0.55) % 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(176, ground - 2, 52, 3);
    ctx.fillRect(180, ground - 4, 44, 2);
    ctx.fillRect(256, ground - 2, 52, 3);
    ctx.fillRect(260, ground - 4, 44, 2);
    ctx.drawImage(U.art.mole[moleF], 170, ground - 57 + (moleF === 1 ? 0 : 0));
    ctx.drawImage(U.art.bomb[Math.floor(t * 8) % 3], 250, ground - 57);
    /* fuse sparks (stateless) */
    for (var s = 0; s < 8; s++) {
      var age = (t * 2.4 + s / 8) % 1;
      var sx = 250 + 45 + Math.cos(s * 2.4) * 26 * age;
      var sy = ground - 57 + 8 - 30 * age + 70 * age * age;
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = s % 2 ? '#ffe45a' : '#ff9a26';
      ctx.fillRect(Math.round(sx), Math.round(sy), 2, 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.6;
    ctx.drawImage(U.glowRed, 250 + 45 - 40, ground - 57 + 8 - 40, 80, 80);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    /* fireflies */
    for (var i = 0; i < 16; i++) {
      var h1 = DM.hash(i, 1, 3), h2 = DM.hash(i, 2, 3), h3 = DM.hash(i, 3, 3);
      var fx = 40 + h1 * 400 + Math.sin(t * (0.4 + h3) + i * 3) * 24;
      var fy = 90 + h2 * 200 + Math.cos(t * (0.5 + h1 * 0.6) + i) * 16;
      var fa = 0.5 + 0.5 * Math.sin(t * (1.5 + h2 * 2) + i * 5);
      ctx.globalAlpha = fa * 0.5;
      ctx.fillStyle = '#c8ff8a';
      ctx.fillRect(Math.round(fx) - 1, Math.round(fy) - 1, 4, 4);
      ctx.globalAlpha = fa;
      ctx.fillStyle = '#f4ffc0';
      ctx.fillRect(Math.round(fx), Math.round(fy), 2, 2);
    }
    ctx.globalAlpha = 1;

    /* vignette over the scene, under the text */
    ctx.globalAlpha = 0.7;
    ctx.drawImage(U.vignette, 0, 0, W, 352, 0, 0, W, H);
    ctx.globalAlpha = 1;

    /* text panel */
    ctx.fillStyle = 'rgba(8,4,14,0.6)';
    ctx.fillRect(56, 250, 368, 150);
    ctx.fillStyle = '#e0b060';
    ctx.fillRect(56, 250, 368, 2);
    ctx.fillRect(56, 398, 368, 2);
    font.note('DYNAMITE MOLE');
    var pulse = Math.floor(t * 2) % 2 === 0;
    txt('PRESS ENTER TO START', 240, 258, { scale: 2, align: 'center', color: pulse ? '#ffffff' : '#a8967a', shadow: '#0a0610' });
    txt('HI-SCORE ' + DM.pad(G.hiSaved, 6), 240, 282, { scale: 2, align: 'center', color: '#ffe45a', shadow: '#3a2a0a' });
    var lines = ['ARROWS / WASD  MOVE', 'SPACE / Z      BOMB', 'P / ESC        PAUSE', 'R              RESTART', 'M              SOUND'];
    lines.forEach(function (ln, i) {
      txt(ln, 96, 312 + i * 17, { scale: 2, color: '#e8dcc0', shadow: '#0a0610' });
    });
  }

  /* ---------------------------------------------------------- entry */
  R.draw = function (G) {
    font.beginFrame();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (G.state === 'title') {
      drawTitle(G);
      return;
    }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    drawField(G);
    switch (G.state) {
      case 'stageIntro':
        drawIntro(G);
        break;
      case 'paused':
        drawPause(G);
        break;
      case 'stageClear':
        drawClear(G);
        break;
      case 'gameOver':
        drawGameOver(G);
        break;
      case 'gameClear':
        drawGameClear(G);
        break;
    }
    drawHud(G);
  };
})();
