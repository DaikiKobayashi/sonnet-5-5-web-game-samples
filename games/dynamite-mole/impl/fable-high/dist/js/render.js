/* Dynamite Mole - rendering (canvas 480x416, HUD 64px + field 480x352). */
var Render = (function () {
  'use strict';

  var W = 480, H = 416, HUD_H = 64, TILE = 32;
  var S = null, ctx = null, reducedMotion = false;
  var vignettes = [];
  var bombFlash = null;

  function init(context, sprites, reduced) {
    ctx = context; S = sprites; reducedMotion = reduced;
    ctx.imageSmoothingEnabled = false;
    for (var i = 0; i < S.themes.length; i++) vignettes.push(makeVignette(S.themes[i].vignette));
    bombFlash = S.bomb.map(function (f) {
      var c = Sprites.canvas(32, 32), g = Sprites.ctxOf(c);
      g.drawImage(f, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(0, 0, 32, 32);
      return c;
    });
  }
  function makeVignette(strength) {
    var c = Sprites.canvas(W, H - HUD_H), g = Sprites.ctxOf(c);
    var grd = g.createRadialGradient(W / 2, (H - HUD_H) / 2, 60, W / 2, (H - HUD_H) / 2, 330);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,' + strength + ')');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H - HUD_H);
    return c;
  }

  function text(str, x, y, scale, color, opts) { return Font.draw(ctx, str, x, y, scale, color, opts); }
  function pad6(n) { var s = String(Math.floor(n)); while (s.length < 6) s = '0' + s; return s; }
  function fmtTime(sec) {
    var s = Math.max(0, Math.ceil(sec));
    var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  function tileX(x) { return (x + 0.5) * TILE; }
  function tileY(y) { return HUD_H + (y + 0.5) * TILE; }

  /* ---------- main entry ---------- */
  function frame() {
    var G = Game.G;
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    if (G.state === 'title') { drawTitle(G); return; }
    var theme = S.themes[G.stage - 1];
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, W, H);
    // screen shake
    var sx = 0, sy = 0;
    if (G.shakeT > 0 && !reducedMotion) {
      var k = G.shakeT / 0.2;
      sx = Math.round((Math.random() * 2 - 1) * 4 * k);
      sy = Math.round((Math.random() * 2 - 1) * 4 * k);
    }
    ctx.save();
    ctx.translate(sx, sy);
    drawField(G, theme);
    ctx.restore();
    drawHud(G);
    switch (G.state) {
      case 'stageIntro': drawIntro(G); break;
      case 'paused': drawPause(G); break;
      case 'stageClear': drawStageClear(G); break;
      case 'gameOver': drawGameOver(G); break;
      case 'gameClear': drawGameClear(G); break;
    }
  }

  /* ---------- field ---------- */
  function drawField(G, theme) {
    var t = G.totalTime;
    var r, c;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HUD_H, W, H - HUD_H);
    ctx.clip();
    // tiles
    for (r = 0; r < Level.ROWS; r++) for (c = 0; c < Level.COLS; c++) {
      var px = c * TILE, py = HUD_H + r * TILE;
      var cell = G.grid[r][c];
      if (cell === Level.WALL) {
        var outer = r === 0 || c === 0 || r === Level.ROWS - 1 || c === Level.COLS - 1;
        ctx.drawImage(outer ? theme.wall : theme.pillar, px, py);
        continue;
      }
      var v = ((c * 7 + r * 13) % 11 === 0) ? 2 : (c + r) % 2;
      ctx.drawImage(theme.floor[v], px, py);
      if (cell === Level.SOFT) ctx.drawImage(theme.rock[0], px, py);
    }
    // crumbling rocks
    for (var i = 0; i < G.crumbles.length; i++) {
      var cr = G.crumbles[i];
      var f = 1 + Math.min(2, Math.floor(cr.t / 0.1));
      ctx.drawImage(theme.rock[f], cr.col * TILE, HUD_H + cr.row * TILE);
    }
    // exit
    if (G.exit.revealed) {
      var ex = G.exit.col * TILE, ey = HUD_H + G.exit.row * TILE;
      if (G.exit.open) ctx.drawImage(S.exit.open[Math.floor(t * 4) % 2], ex, ey);
      else ctx.drawImage(S.exit.closed, ex, ey);
      if (G.exitFlash > 0) {
        var k = G.exitFlash / 0.6;
        ctx.globalAlpha = k * 0.8;
        ctx.fillStyle = '#fff6c0';
        var rad = 16 + (1 - k) * 40;
        ctx.beginPath(); ctx.arc(ex + 16, ey + 16, rad, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    // items
    for (i = 0; i < G.items.length; i++) {
      var it = G.items[i];
      var bob = Math.round(Math.sin(t * 4 + it.col) * 2);
      ctx.drawImage(S.items[it.type], it.col * TILE, HUD_H + it.row * TILE + bob);
    }
    // bombs
    for (i = 0; i < G.bombs.length; i++) {
      var b = G.bombs[i];
      var fast = b.timeLeft < 0.8;
      var fr = Math.floor(t * (fast ? 20 : 8)) % 3;
      var img = (fast && Math.floor(t * 10) % 2 === 0) ? bombFlash[fr] : S.bomb[fr];
      var pulse = fast ? 0 : Math.round(Math.sin(t * 6) * 1);
      ctx.drawImage(img, b.col * TILE, HUD_H + b.row * TILE + pulse);
    }
    // enemies
    for (i = 0; i < G.enemies.length; i++) drawEnemy(G.enemies[i], t);
    // player
    drawPlayer(G, t);
    // flames
    for (i = 0; i < G.flames.length; i++) {
      var fl = G.flames[i];
      var ff = Math.floor(fl.age * 12) % 2;
      var sprite;
      if (fl.kind === 'center') sprite = S.flame.center[ff];
      else if (fl.kind === 'arm') sprite = fl.axis === 'h' ? S.flame.h[ff] : S.flame.v[ff];
      else sprite = S.flame[fl.dir || 'right'][ff];
      var fx = fl.col * TILE, fy = HUD_H + fl.row * TILE;
      if (fl.timeLeft < 0.15) {
        var sc = 0.5 + fl.timeLeft / 0.3;
        ctx.globalAlpha = Math.max(0.2, fl.timeLeft / 0.15);
        var sz = Math.round(32 * sc);
        ctx.drawImage(sprite, fx + (32 - sz) / 2, fy + (32 - sz) / 2, sz, sz);
        ctx.globalAlpha = 1;
      } else ctx.drawImage(sprite, fx, fy);
    }
    // particles
    for (i = 0; i < G.particles.length; i++) {
      var q = G.particles[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, q.life / q.maxLife * 1.5));
      ctx.fillStyle = q.color === 'rock' ? theme.rockColor : q.color;
      ctx.fillRect(Math.round(tileX(q.x) - q.size / 2), Math.round(tileY(q.y) - q.size / 2), q.size, q.size);
    }
    ctx.globalAlpha = 1;
    // lighting: vignette + lantern glow around the player
    ctx.drawImage(vignettes[G.stage - 1], 0, HUD_H);
    if (G.player.alive || G.state !== 'playing') {
      var lx = tileX(G.player.x), ly = tileY(G.player.y);
      var flick = 0.10 + Math.sin(t * 17) * 0.02 + Math.sin(t * 5.3) * 0.02;
      var grd = ctx.createRadialGradient(lx, ly, 10, lx, ly, 120);
      grd.addColorStop(0, 'rgba(255,220,140,' + flick.toFixed(3) + ')');
      grd.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = grd;
      ctx.fillRect(lx - 120, ly - 120, 240, 240);
      ctx.globalCompositeOperation = 'source-over';
    }
    for (i = 0; i < G.bombs.length; i++) {
      var bb = G.bombs[i];
      var bx = tileX(bb.col), by = tileY(bb.row);
      var g2 = ctx.createRadialGradient(bx, by, 4, bx, by, 40);
      g2.addColorStop(0, 'rgba(255,160,60,' + (0.12 + Math.sin(t * 20) * 0.05).toFixed(3) + ')');
      g2.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g2;
      ctx.fillRect(bx - 40, by - 40, 80, 80);
      ctx.globalCompositeOperation = 'source-over';
    }
    // score popups
    for (i = 0; i < G.popups.length; i++) {
      var pp = G.popups[i];
      var py2 = tileY(pp.y) - 16 - pp.t * 28;
      ctx.globalAlpha = pp.t < 0.6 ? 1 : Math.max(0, (0.8 - pp.t) / 0.2);
      text(pp.text, tileX(pp.x), Math.round(py2), 1, '#fff6a0', { align: 'center', outline: '#1a1020' });
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawEnemy(e, t) {
    var x = Math.round(tileX(e.x) - 16), y = Math.round(tileY(e.y) - 16);
    if (!e.alive) {
      var k = Math.max(0, Math.min(2, Math.floor((0.4 - e.deathT) / 0.4 * 3)));
      ctx.drawImage(S.puff[e.type][k], x, y);
      return;
    }
    var img;
    if (e.type === 'slime') img = S.slime[Math.floor(e.animT * 6) % 4];
    else if (e.type === 'bat') { img = S.bat[Math.floor(e.animT * 14) % 4]; y += Math.round(Math.sin(e.animT * 7) * 2); }
    else if (e.type === 'ghost') {
      img = (e.chasing ? S.ghost.chase : S.ghost.normal)[Math.floor(e.animT * 4) % 2];
      y += Math.round(Math.sin(e.animT * 3) * 3);
      ctx.globalAlpha = 0.92;
    } else {
      var f = e.moving ? Math.floor(e.progress * 4) % 4 : 0;
      img = S.golem.walk[f];
      if (e.invT > 0 && Math.floor(e.invT / 0.0625) % 2 === 0) img = S.golem.flash[f];
    }
    ctx.drawImage(img, x, y);
    ctx.globalAlpha = 1;
  }

  function drawPlayer(G, t) {
    var p = G.player;
    var x = Math.round(tileX(p.x) - 16), y = Math.round(tileY(p.y) - 16);
    var img;
    if (!p.alive) {
      var k = Math.max(0, Math.min(5, Math.floor((1.2 - p.deathT) / 1.2 * 6)));
      img = S.player.death[k];
      if (p.deathT < 0.3) ctx.globalAlpha = Math.max(0.2, p.deathT / 0.3);
      ctx.drawImage(img, x, y);
      ctx.globalAlpha = 1;
      return;
    }
    if (p.invincible > 0 && Math.floor(p.invincible / 0.0625) % 2 === 1) return;
    if (G.state === 'stageClear') {
      img = S.player.joy[Math.floor(G.stateTime * 6) % 2];
    } else if (p.moving) {
      img = S.player.walk[p.facing][Math.floor(p.progress * 4) % 4];
    } else {
      img = S.player.idle[p.facing][Math.floor(p.idleT * 2) % 2];
    }
    ctx.drawImage(img, x, y);
  }

  /* ---------- HUD ---------- */
  function drawHud(G) {
    // stone panel
    ctx.fillStyle = '#2a2430';
    ctx.fillRect(0, 0, W, HUD_H);
    ctx.fillStyle = '#3a3244';
    for (var i = 0; i < W; i += 24) { ctx.fillRect(i + 1, 1, 22, 6); ctx.fillRect(i + (i % 48 ? 0 : 12) + 1, 57, 22, 6); }
    ctx.fillStyle = '#16121c';
    ctx.fillRect(0, HUD_H - 1, W, 1);
    ctx.fillStyle = '#4a4058';
    ctx.fillRect(0, HUD_H - 2, W, 1);
    var t = G.totalTime;
    var timeColor = '#ffffff';
    if (G.timeLeft <= 30 && (G.state === 'playing' || G.state === 'paused')) timeColor = Math.floor(t * 4) % 2 ? '#ff4040' : '#ffb0b0';
    text('SCORE ' + pad6(G.scoreShown), 8, 12, 1, '#ffffff', { shadow: '#101014' });
    text('HI ' + pad6(Math.max(G.hiSaved, G.score)), 128, 12, 1, '#ffd060', { shadow: '#101014' });
    text('TIME ' + fmtTime(G.timeLeft), W - 8, 8, 2, timeColor, { align: 'right', shadow: '#101014' });
    text('STAGE ' + G.stage + '/5', 8, 40, 1, '#ffffff', { shadow: '#101014' });
    ctx.drawImage(S.hud.face, 90, 36);
    text('x' + G.lives, 108, 40, 1, '#ffffff', { shadow: '#101014' });
    ctx.drawImage(S.hud.bomb, 140, 36);
    text('BOMB ' + G.player.maxBombs, 158, 40, 1, '#ffffff', { shadow: '#101014' });
    ctx.drawImage(S.hud.fire, 218, 36);
    text('FIRE ' + G.player.range, 236, 40, 1, '#ffffff', { shadow: '#101014' });
    ctx.drawImage(S.hud.boots, 296, 36);
    text('SPD ' + G.player.boots, 314, 40, 1, '#ffffff', { shadow: '#101014' });
    ctx.drawImage(S.hud.snd, 366, 36);
    text(Sound.isMuted() ? 'SND OFF' : 'SND ON', 384, 40, 1, Sound.isMuted() ? '#9090a0' : '#ffffff', { shadow: '#101014' });
  }

  /* ---------- overlays ---------- */
  function darken(alpha) {
    ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
    ctx.fillRect(0, HUD_H, W, H - HUD_H);
  }
  function panel(x, y, w, h) {
    ctx.fillStyle = '#16121c';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#2a2430';
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = '#4a4058';
    ctx.fillRect(x + 2, y + 2, w - 4, 1);
    ctx.fillStyle = '#f5c542';
    ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  }

  function drawIntro(G) {
    darken(0.62);
    var cy = HUD_H + 176;
    panel(60, cy - 78, 360, 168);
    text('STAGE ' + G.stage, W / 2, cy - 60, 3, '#f5c542', { align: 'center', outline: '#1a1020' });
    text(G.stageDef.name, W / 2, cy - 22, 2, '#ffffff', { align: 'center', shadow: '#101014' });
    var total = G.enemies.length;
    text('ENEMIES ' + total, W / 2, cy + 10, 2, '#ffb0a0', { align: 'center', shadow: '#101014' });
    // small enemy line-up (Should S15)
    var types = ['slime', 'bat', 'ghost', 'golem'];
    var list = [];
    for (var i = 0; i < types.length; i++) {
      var n = G.stageDef.enemies[types[i]];
      for (var k = 0; k < n; k++) list.push(types[i]);
    }
    var x0 = W / 2 - list.length * 18;
    for (i = 0; i < list.length; i++) {
      var img = list[i] === 'slime' ? S.slime[0] : list[i] === 'bat' ? S.bat[1] : list[i] === 'ghost' ? S.ghost.normal[0] : S.golem.walk[0];
      ctx.drawImage(img, Math.round(x0 + i * 36 + 2), cy + 36);
    }
  }

  function drawPause(G) {
    darken(0.55);
    var cy = HUD_H + 176;
    panel(120, cy - 70, 240, 140);
    text('PAUSED', W / 2, cy - 52, 3, '#f5c542', { align: 'center', outline: '#1a1020' });
    text('P / ESC  RESUME', W / 2, cy - 8, 1, '#ffffff', { align: 'center' });
    text('R  RESTART', W / 2, cy + 14, 1, '#ffffff', { align: 'center' });
    text('M  SOUND', W / 2, cy + 36, 1, '#ffffff', { align: 'center' });
  }

  function drawStageClear(G) {
    darken(0.35);
    var cy = HUD_H + 150;
    panel(70, cy - 50, 340, 130);
    var pulse = Math.floor(G.stateTime * 6) % 2 ? '#fff6a0' : '#f5c542';
    text('STAGE CLEAR!', W / 2, cy - 32, 3, pulse, { align: 'center', outline: '#1a1020' });
    text('CLEAR BONUS +' + G.clearBonus, W / 2, cy + 14, 2, '#ffffff', { align: 'center', shadow: '#101014' });
    text('TIME BONUS +' + G.timeBonus, W / 2, cy + 42, 2, '#ffffff', { align: 'center', shadow: '#101014' });
  }

  function drawGameOver(G) {
    darken(0.7);
    var cy = HUD_H + 40;
    panel(90, cy, 300, 270);
    text('GAME OVER', W / 2, cy + 20, 3, '#ff6a5a', { align: 'center', outline: '#1a1020' });
    text('SCORE ' + pad6(G.score), W / 2, cy + 66, 2, '#ffffff', { align: 'center' });
    text('BEST  ' + pad6(G.hiSaved), W / 2, cy + 92, 2, '#ffd060', { align: 'center' });
    text('REACHED STAGE ' + G.reachedStage, W / 2, cy + 122, 1, '#ffffff', { align: 'center' });
    if (G.newRecord) text('NEW RECORD!', W / 2, cy + 150, 2, Math.floor(G.stateTime * 6) % 2 ? '#fff6a0' : '#ffb020', { align: 'center', outline: '#1a1020' });
    var pc = G.stateTime >= 0.6 ? '#ffffff' : '#8a8a9a';
    text('ENTER  RETRY', W / 2, cy + 200, 1, pc, { align: 'center' });
    text('ESC    TITLE', W / 2, cy + 220, 1, pc, { align: 'center' });
  }

  function drawGameClear(G) {
    darken(0.7);
    var cy = HUD_H + 30;
    panel(60, cy, 360, 290);
    var col = Math.floor(G.stateTime * 4) % 2 ? '#fff6a0' : '#f5c542';
    text('CONGRATULATIONS!', W / 2, cy + 20, 2, col, { align: 'center', outline: '#1a1020' });
    text('YOU ESCAPED THE MINE', W / 2, cy + 50, 1, '#ffffff', { align: 'center' });
    ctx.drawImage(S.player.joy[Math.floor(G.stateTime * 6) % 2], W / 2 - 16, cy + 66);
    text('SCORE ' + pad6(G.score), W / 2, cy + 110, 2, '#ffffff', { align: 'center' });
    text('BEST  ' + pad6(G.hiSaved), W / 2, cy + 136, 2, '#ffd060', { align: 'center' });
    if (G.newRecord) text('NEW RECORD!', W / 2, cy + 170, 2, Math.floor(G.stateTime * 6) % 2 ? '#fff6a0' : '#ffb020', { align: 'center', outline: '#1a1020' });
    var pc = G.stateTime >= 0.6 ? '#ffffff' : '#8a8a9a';
    text('ENTER  PLAY AGAIN', W / 2, cy + 224, 1, pc, { align: 'center' });
    text('ESC    TITLE', W / 2, cy + 244, 1, pc, { align: 'center' });
  }

  /* ---------- title ---------- */
  var fireflies = [];
  for (var fi = 0; fi < 18; fi++) fireflies.push({ x: Math.random() * W, y: 80 + Math.random() * 240, ph: Math.random() * 6.28, sp: 0.3 + Math.random() * 0.5 });

  function drawTitle(G) {
    var t = G.totalTime;
    ctx.drawImage(S.titleBg, 0, 0);
    // lantern glow (two lanterns on the wooden frames)
    var lamps = [[83, 144], [397, 144]];
    ctx.globalCompositeOperation = 'lighter';
    for (var li = 0; li < lamps.length; li++) {
      var g = ctx.createRadialGradient(lamps[li][0], lamps[li][1], 6, lamps[li][0], lamps[li][1], 130);
      var fl = 0.22 + Math.sin(t * 13 + li) * 0.03 + Math.sin(t * 3.1 + li * 2) * 0.03;
      g.addColorStop(0, 'rgba(255,220,140,' + fl.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = g;
      ctx.fillRect(lamps[li][0] - 130, lamps[li][1] - 130, 260, 260);
    }
    ctx.globalCompositeOperation = 'source-over';
    // fireflies
    for (var i = 0; i < fireflies.length; i++) {
      var f = fireflies[i];
      var a = 0.4 + Math.sin(t * 2 + f.ph) * 0.4;
      var fx = (f.x + Math.sin(t * f.sp + f.ph) * 20 + t * 6) % W;
      var fy = f.y + Math.cos(t * f.sp * 1.3 + f.ph) * 10;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = i % 3 ? '#c0ff80' : '#a0f0ff';
      ctx.fillRect(Math.round(fx), Math.round(fy), 2, 2);
    }
    ctx.globalAlpha = 1;
    // logo with a gentle bob and pulse glow
    var ly = 28 + Math.round(Math.sin(t * 1.5) * 2);
    var glow = 0.25 + Math.sin(t * 2) * 0.15;
    ctx.globalAlpha = glow;
    ctx.drawImage(S.logo, 20, ly + 2);
    ctx.globalAlpha = 1;
    ctx.drawImage(S.logo, 20, ly);
    Font.note('DYNAMITE MOLE'); // the logo image was rendered with the bitmap font; record its words
    // walking mole and dynamite on the cave floor
    var span = 140, cyc = (t * 40) % (span * 2);
    var mx = 170 + (cyc < span ? cyc : span * 2 - cyc);
    var facing = cyc < span ? 'right' : 'left';
    ctx.drawImage(S.player.walk[facing][Math.floor(t * 8) % 4], Math.round(mx), 300);
    ctx.drawImage(S.bomb[Math.floor(t * 8) % 3], 300, 300);
    ctx.drawImage(S.slime[Math.floor(t * 6) % 4], 100, 300);
    // texts (prompt blinks with a 1 s period)
    if ((t % 1) < 0.7) text('PRESS ENTER TO START', W / 2, 176, 2, '#fff6a0', { align: 'center', outline: '#1a1020' });
    text('HI-SCORE ' + pad6(G.hiSaved), W / 2, 212, 2, '#ffd060', { align: 'center', outline: '#1a1020' });
    var lines = ['ARROWS / WASD  MOVE', 'SPACE / Z      BOMB', 'P / ESC        PAUSE', 'R              RESTART', 'M              SOUND'];
    for (i = 0; i < lines.length; i++) text(lines[i], 24, 344 + i * 13, 1, '#e8e0d0', { shadow: '#101014' });
    text('SND ' + (Sound.isMuted() ? 'OFF' : 'ON'), W - 16, 396, 1, '#b0b0c0', { align: 'right' });
  }

  return { init: init, frame: frame, W: W, H: H };
})();
