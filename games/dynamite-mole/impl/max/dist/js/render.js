/* render.js - draws everything to the single 480x416 canvas. All text goes through DM.Font. */
(function (root) {
  'use strict';
  var DM = root.DM = root.DM || {};
  var F = DM.Font, G = DM.Game, K = DM.K;
  var W = DM.W, T = DM.TILE, COLS = DM.COLS, ROWS = DM.ROWS, HUD_H = DM.HUD_H, FIELD_H = 352;

  var C = {
    cream: '#fff0d0', gold: '#ffd84a', red: '#ff5a4a', green: '#8dffb0', cyan: '#8fe8ff', orange: '#ffb060',
    ink: '#1a0f22', white: '#ffffff', grey: '#9a90a8', pink: '#ff8fbf'
  };

  var R = DM.Render = {};
  var ctx, canvas;
  var stat = { stage: 0, canvas: null };

  R.init = function (cv, c) {
    canvas = cv; ctx = c;
    ctx.imageSmoothingEnabled = false;
  };

  /* ------------------------------------------------------------------ small helpers */
  function pad6(n) { var s = String(Math.max(0, Math.floor(n))); while (s.length < 6) s = '0' + s; return s; }
  function fmtTime(sec) {
    var t = Math.max(0, Math.ceil(sec)), m = Math.floor(t / 60), s = t % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function isWall(c, r) { return DM.isFixedWall(c, r); }
  function isOuter(c, r) { return r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1; }

  function panel(x, y, w, h, alpha) {
    ctx.fillStyle = 'rgba(12,7,20,' + (alpha == null ? 0.86 : alpha) + ')';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#07040c';
    ctx.fillRect(x - 3, y - 3, w + 6, 3); ctx.fillRect(x - 3, y + h, w + 6, 3);
    ctx.fillRect(x - 3, y, 3, h); ctx.fillRect(x + w, y, 3, h);
    ctx.fillStyle = '#b07a30';
    ctx.fillRect(x - 2, y - 2, w + 4, 1); ctx.fillRect(x - 2, y + h + 1, w + 4, 1);
    ctx.fillRect(x - 2, y, 1, h); ctx.fillRect(x + w + 1, y, 1, h);
    ctx.fillStyle = '#f2c766';
    ctx.fillRect(x - 1, y - 1, w + 2, 1); ctx.fillRect(x - 1, y - 1, 1, h + 2);
    ctx.fillStyle = '#6b4218';
    ctx.fillRect(x - 1, y + h, w + 2, 1); ctx.fillRect(x + w, y - 1, 1, h + 2);
  }

  function text(str, x, y, o) { return F.draw(ctx, str, x, y, o); }

  /* ------------------------------------------------------------------ static (never changing) field layer */
  function ensureStatic() {
    if (stat.stage === G.stage && stat.canvas) return;
    var S = DM.Spr, th = S.themes[G.stage - 1];
    var cv = stat.canvas || DM.Pix.canvas(W, FIELD_H);
    var x = cv.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.clearRect(0, 0, W, FIELD_H);
    var r, c;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        var px = c * T, py = r * T;
        if (isWall(c, r)) {
          if (isOuter(c, r)) {
            var w = th.wall.plain;
            if (r === 0 && c > 0 && c < COLS - 1) w = th.wall.bottom;
            else if (r === ROWS - 1 && c > 0 && c < COLS - 1) w = th.wall.top;
            else if (c === 0 && r > 0 && r < ROWS - 1) w = th.wall.right;
            else if (c === COLS - 1 && r > 0 && r < ROWS - 1) w = th.wall.left;
            x.drawImage(w, px, py);
          } else {
            x.drawImage(th.floor[0], px, py);
            x.drawImage(th.pillar, px, py);
          }
        } else {
          var v = (c + r) & 1;
          var hsh = DM.hash2(c, r, 31 + G.stage);
          if (hsh < 0.2 && th.floor.length > 2) v = 2 + Math.floor((hsh / 0.2) * (th.floor.length - 2));
          x.drawImage(th.floor[v], px, py);
        }
      }
    }
    /* baked shadows cast by walls and pillars (light from the upper left) */
    for (r = 1; r < ROWS - 1; r++) {
      for (c = 1; c < COLS - 1; c++) {
        if (isWall(c, r)) continue;
        if (isWall(c - 1, r)) x.drawImage(S.shadowR, c * T, r * T);
        if (isWall(c, r - 1)) x.drawImage(S.shadowB, c * T, r * T);
      }
    }
    stat.canvas = cv;
    stat.stage = G.stage;
  }

  /* ------------------------------------------------------------------ field entities */
  function tileFree(c, r) { return c >= 0 && r >= 0 && c < COLS && r < ROWS && G.grid[r][c] === '.'; }

  function drawRocks(th) {
    var S = DM.Spr, r, c;
    for (r = 1; r < ROWS - 1; r++) {
      for (c = 1; c < COLS - 1; c++) {
        if (G.grid[r][c] !== 'S') continue;
        if (tileFree(c + 1, r)) ctx.drawImage(S.shadowR, (c + 1) * T, r * T);
        if (tileFree(c, r + 1)) ctx.drawImage(S.shadowB, c * T, (r + 1) * T);
      }
    }
    for (r = 1; r < ROWS - 1; r++) {
      for (c = 1; c < COLS - 1; c++) {
        if (G.grid[r][c] !== 'S') continue;
        var v = DM.hash2(c, r, 5) < 0.5 ? 0 : 1;
        ctx.drawImage(th.rock[v], c * T, r * T);
      }
    }
    for (var i = 0; i < G.crumbles.length; i++) {
      var cr = G.crumbles[i];
      var fr = Math.min(2, Math.floor(cr.t / (K.CRUMBLE / 3)));
      var vv = DM.hash2(cr.col, cr.row, 5) < 0.5 ? 0 : 1;
      ctx.drawImage(th.crumble[vv][fr], cr.col * T, cr.row * T);
    }
  }

  function drawExit() {
    var S = DM.Spr, ex = G.exit;
    if (!ex.revealed) return;
    var img;
    if (!ex.open) img = S.exit.closed;
    else img = S.exit.open[Math.floor(G.animT * 4) % 2];
    ctx.drawImage(img, ex.col * T, ex.row * T);
  }

  function drawItems() {
    var S = DM.Spr;
    for (var i = 0; i < G.items.length; i++) {
      var it = G.items[i];
      var bob = Math.round(Math.sin(G.animT * 4 + it.col * 1.3 + it.row) * 1.5);
      var drop = it.t < 0.25 ? Math.round((1 - it.t / 0.25) * -9) : 0;
      var fr = Math.floor(G.animT * 3 + it.col) % 2;
      ctx.drawImage(S.item[it.type][fr], it.col * T, it.row * T + bob + drop);
    }
  }

  function drawBombs() {
    var S = DM.Spr;
    for (var i = 0; i < G.bombs.length; i++) {
      var b = G.bombs[i];
      var fr = Math.floor(b.age * 9) % 3;
      var fast = b.timeLeft < 0.8;
      var flash = fast ? (Math.floor(b.age * 18) & 1) : ((Math.floor(b.age * 3) & 1) && b.timeLeft < 1.6);
      var bounce = (Math.floor(b.age * (fast ? 14 : 5)) & 1) ? 1 : 0;
      var img = flash ? S.bombFlash[fr] : S.bomb[fr];
      ctx.drawImage(img, b.col * T, b.row * T - bounce);
    }
  }

  function flameImg(f) {
    var FL = DM.Spr.flame;
    var fr = Math.floor(f.age * 14) % 4;
    var small = f.timeLeft < 0.14 ? (f.timeLeft < 0.07 ? 1 : 0) : -1;
    var set = small >= 0 ? FL.small : FL;
    var i = small >= 0 ? small : fr;
    if (f.kind === 'center') return set.center[i];
    if (f.kind === 'arm') return (f.dir === 'left' || f.dir === 'right') ? set.armH[i] : set.armV[i];
    return set.tip[f.dir][i];
  }

  function drawFlames() {
    var S = DM.Spr, i, f, pass;
    var order = ['arm', 'tip', 'center'];
    for (pass = 0; pass < 3; pass++) {
      for (i = 0; i < G.flames.length; i++) {
        f = G.flames[i];
        if (f.kind !== order[pass]) continue;
        ctx.drawImage(flameImg(f), f.col * T, f.row * T);
      }
    }
    if (G.flames.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < G.flames.length; i++) {
        f = G.flames[i];
        ctx.globalAlpha = 0.5 * Math.min(1, f.timeLeft / 0.25);
        ctx.drawImage(S.glowFlame, f.col * T + 16 - 48, f.row * T + 16 - 48);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function enemyImg(e) {
    var S = DM.Spr;
    var fr = Math.floor(G.animT * 7 + e.phase * 4) % 4;
    var flash = e.hitT > 0 && (Math.floor(e.hitT / 0.07) & 1);
    switch (e.type) {
      case 'slime': return S.slime[fr];
      case 'bat': return S.bat[fr];
      case 'ghost': return e.chasing ? S.ghostChase[fr] : S.ghost[fr];
      default: return flash ? S.golemFlash[fr] : S.golem[fr];
    }
  }

  function drawEnemies() {
    var S = DM.Spr, list = G.enemies.slice().sort(function (a, b) { return a.y - b.y; });
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var px = Math.round(e.x * T), py = Math.round(e.y * T);
      if (!e.alive) {
        var idx = Math.min(2, Math.floor((K.ENEMY_DEATH - e.deathT) / K.ENEMY_DEATH * 3));
        ctx.drawImage(S.poof[e.type][idx], px, py);
        continue;
      }
      var bob = (e.type === 'ghost' || e.type === 'bat') ? Math.round(Math.sin(G.animT * 3 + e.phase * 6) * 1.5) : 0;
      if (e.hitT > 0 && e.type !== 'golem') continue;
      ctx.drawImage(enemyImg(e), px, py + bob);
      if (e.type === 'golem' && e.hp < 3 && !(e.hitT > 0 && (Math.floor(e.hitT / 0.07) & 1))) {
        ctx.drawImage(S.golemCrack[e.hp === 2 ? 0 : 1][Math.floor(G.animT * 7 + e.phase * 4) % 4], px, py + bob);
      }
    }
  }

  function playerImg() {
    var S = DM.Spr.player, P = G.player;
    if (!P.alive) return S.death[Math.min(S.death.length - 1, Math.floor(P.deathAge / K.DEATH_ANIM * S.death.length))];
    if (G.state === 'stageClear') return S.joy[Math.floor(G.animT * 4) % 2];
    if (P.stepping) return S.walk[P.facing][Math.floor(P.walkDist * 2.4) % 4];
    return S.idle[P.facing][Math.floor(G.animT * 1.6) % 2];
  }

  function drawPlayer() {
    var P = G.player;
    if (P.alive && P.invT > 0 && (Math.floor((K.INV_RESPAWN - P.invT) / 0.0625) & 1)) return;
    ctx.drawImage(playerImg(), Math.round(P.x * T), Math.round(P.y * T));
  }

  function drawParticles(th) {
    var i, p;
    for (i = 0; i < G.particles.length; i++) {
      p = G.particles[i];
      if (p.kind === 'firework') continue;
      var k = p.life / p.max;
      var x = Math.round(p.x), y = Math.round(p.y), s = p.size;
      switch (p.kind) {
        case 'rock':
          ctx.fillStyle = th.debris[p.shade % th.debris.length];
          ctx.fillRect(x, y, s, s);
          break;
        case 'dust':
          ctx.globalAlpha = Math.min(1, k * 1.4) * 0.55;
          ctx.fillStyle = th.dust;
          ctx.fillRect(x - 1, y - 1, s + 1, s + 1);
          ctx.globalAlpha = 1;
          break;
        case 'spark':
          ctx.fillStyle = ['#fff6c0', '#ffd23f', '#ff8a1a'][p.shade % 3];
          s = k > 0.5 ? 2 : 1;
          ctx.fillRect(x, y, s, s);
          break;
        case 'poof':
          ctx.globalAlpha = Math.min(1, k * 1.6);
          ctx.fillStyle = ['#9cf07a', '#c9a6ff', '#f2f0ff', '#d0c8b8', '#ffe9a0', '#ffd0d8'][p.shade % 6];
          ctx.fillRect(x, y, s, s);
          ctx.globalAlpha = 1;
          break;
        case 'glint':
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.fillStyle = '#fffbd0';
          ctx.fillRect(x, y, 1, 1);
          if (k > 0.4) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
          ctx.globalAlpha = 1;
          break;
        case 'confetti':
          ctx.fillStyle = ['#ff5a4a', '#ffd84a', '#5ad0ff', '#8dffb0', '#ff8fbf'][p.shade % 5];
          ctx.fillRect(x, y, 3, 2);
          break;
        default: break;
      }
    }
  }

  function drawPopups() {
    for (var i = 0; i < G.popups.length; i++) {
      var p = G.popups[i], k = p.t / K.POPUP;
      var a = k > 0.65 ? Math.max(0, (1 - k) / 0.35) : 1;
      text(p.text, p.x, p.y - k * 18, { align: 'center', color: p.color, outline: C.ink, alpha: a });
    }
  }

  function drawLighting(t, th) {
    var S = DM.Spr, P = G.player, i;
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < th.lampPos.length; i++) {
      var lp = th.lampPos[i];
      var fl = 0.5 + 0.28 * Math.sin(t * 7.3 + i * 2.1) + 0.14 * Math.sin(t * 13.1 + i * 5.3);
      ctx.globalAlpha = th.lampGlowAlpha * fl;
      ctx.drawImage(th.glow, lp[0] - 64, lp[1] - 64);
    }
    if (P.alive || G.state === 'playing') {
      var lx = P.x * T + 16, ly = P.y * T + 14;
      ctx.globalAlpha = th.lanternAlpha * (0.85 + 0.15 * Math.sin(t * 9.0) + 0.05 * Math.sin(t * 21.0));
      ctx.drawImage(S.lantern, Math.round(lx - 64), Math.round(ly - 64));
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(S.vignette, 0, 0);
  }

  function drawLamps(th, t) {
    for (var i = 0; i < th.lampPos.length; i++) {
      var lp = th.lampPos[i];
      var fr = Math.floor(t * 8 + i * 1.7) % th.lampFrames.length;
      ctx.drawImage(th.lampFrames[fr], lp[0] - 16, lp[1] - 16);
    }
  }

  function drawField(t) {
    var S = DM.Spr, th = S.themes[G.stage - 1];
    ensureStatic();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HUD_H, W, FIELD_H);
    ctx.clip();
    var sx = 0, sy = 0;
    if (G.shakeT > 0 && !G.reducedMotion) {
      var kk = G.shakeT / 0.2 * G.shakeAmp;
      sx = Math.round(Math.sin(G.animT * 97) * kk);
      sy = Math.round(Math.cos(G.animT * 83) * kk);
    }
    ctx.translate(sx, HUD_H + sy);
    ctx.fillStyle = th.bgColor;
    ctx.fillRect(-8, -8, W + 16, FIELD_H + 16);
    ctx.drawImage(stat.canvas, 0, 0);
    drawLamps(th, t);
    drawExit();
    drawRocks(th);
    drawItems();
    drawBombs();
    drawFlames();
    drawEnemies();
    drawPlayer();
    drawParticles(th);
    drawLighting(t, th);
    drawPopups();
    if (G.flashT > 0) {
      ctx.globalAlpha = Math.min(0.55, G.flashT / 0.35 * 0.55);
      ctx.fillStyle = G.flashColor;
      ctx.fillRect(0, 0, W, FIELD_H);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* fireworks are drawn above the dimming overlay of the game-clear screen */
  function drawFireworks() {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, HUD_H, W, FIELD_H); ctx.clip();
    ctx.translate(0, HUD_H);
    ctx.globalCompositeOperation = 'lighter';
    var cols = ['#ff5a4a', '#ffd84a', '#5ad0ff', '#8dffb0', '#ff8fbf'];
    for (var i = 0; i < G.particles.length; i++) {
      var p = G.particles[i];
      if (p.kind !== 'firework') continue;
      var k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 1.8);
      ctx.fillStyle = cols[p.shade % 5];
      ctx.fillRect(Math.round(p.x), Math.round(p.y), k > 0.4 ? 2 : 1, k > 0.4 ? 2 : 1);
      ctx.globalAlpha = Math.min(0.5, k);
      ctx.fillRect(Math.round(p.x - p.vx * 0.03), Math.round(p.y - p.vy * 0.03), 1, 1);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ HUD */
  function drawHud() {
    var S = DM.Spr, sc = 2, y1 = 11, y2 = 40;
    ctx.drawImage(S.hudBg, 0, 0);
    var hi = Math.max(G.hiSaved, G.score);
    var timeStr = 'TIME ' + fmtTime(G.timeLeft);
    var low = G.timeLeft <= 30 && G.state !== 'title';
    var timeCol = C.cream;
    if (low) timeCol = (Math.floor(G.animT * 4) & 1) ? '#ff3b30' : C.cream;      // flashes red / normal at <= 30 s
    var sh = C.ink;

    /* row 1: SCORE .... HI .... TIME (justified) */
    var a = 'SCORE ' + pad6(G.score), b = 'HI ' + pad6(hi);
    var wa = F.width(a, sc), wb = F.width(b, sc), wt = F.width(timeStr, sc);
    var x0 = 12, x1 = W - 12;
    var gap = Math.floor((x1 - x0 - wa - wb - wt) / 2);
    text(a, x0, y1, { scale: sc, color: C.cream, shadow: sh });
    text(b, x0 + wa + gap, y1, { scale: sc, color: C.gold, shadow: sh });
    text(timeStr, x1 - wt, y1, { scale: sc, color: timeCol, shadow: sh });

    /* row 2 */
    var stageStr = 'STAGE ' + G.stage + '/5';
    var lifeStr = 'x' + G.lives;
    var bombStr = 'BOMB ' + G.player.maxBombs;
    var fireStr = 'FIRE ' + G.player.range;
    var spdStr = 'SPD ' + G.player.boots;
    var sndStr = 'SND ' + (DM.Audio.muted ? 'OFF' : 'ON');
    var ws = [F.width(stageStr, sc), 18 + F.width(lifeStr, sc), F.width(bombStr, sc), F.width(fireStr, sc), F.width(spdStr, sc), F.width(sndStr, sc)];
    var tot = 0, i;
    for (i = 0; i < ws.length; i++) tot += ws[i];
    var g2 = Math.floor((x1 - x0 - tot) / (ws.length - 1));
    var x = x0;
    text(stageStr, x, y2, { scale: sc, color: C.cream, shadow: sh }); x += ws[0] + g2;
    ctx.drawImage(S.lifeIcon, x, y2 - 2);
    text(lifeStr, x + 18, y2, { scale: sc, color: C.white, shadow: sh }); x += ws[1] + g2;
    text(bombStr, x, y2, { scale: sc, color: C.orange, shadow: sh }); x += ws[2] + g2;
    text(fireStr, x, y2, { scale: sc, color: '#ff8a68', shadow: sh }); x += ws[3] + g2;
    text(spdStr, x, y2, { scale: sc, color: C.green, shadow: sh }); x += ws[4] + g2;
    text(sndStr, x, y2, { scale: sc, color: DM.Audio.muted ? '#8a80a0' : C.cyan, shadow: sh });
  }

  /* ------------------------------------------------------------------ overlays */
  function dim(alpha) {
    ctx.fillStyle = 'rgba(6,3,12,' + alpha + ')';
    ctx.fillRect(0, HUD_H, W, FIELD_H);
  }
  function fieldMid() { return HUD_H + FIELD_H / 2; }

  function drawIntro() {
    var S = DM.Spr, st = DM.STAGES[G.stage - 1];
    dim(0.62);
    var cy = fieldMid();
    panel(60, cy - 66, 360, 132, 0.8);
    text('STAGE ' + G.stage, 240, cy - 52, { scale: 3, color: C.gold, outline: C.ink, align: 'center' });
    text(st.name, 240, cy - 18, { scale: 2, color: C.cream, shadow: C.ink, align: 'center' });
    text('ENEMIES ' + DM.enemyTotal(G.stage), 240, cy + 8, { scale: 2, color: C.orange, shadow: C.ink, align: 'center' });
    /* small icons of this stage's enemies */
    var list = [];
    DM.ENEMY_ORDER.forEach(function (tp) { for (var n = 0; n < st.enemies[tp]; n++) list.push(tp); });
    var iw = 28, x0 = 240 - (list.length * iw) / 2;
    for (var i = 0; i < list.length; i++) {
      var fr = Math.floor(G.animT * 5 + i) % 4;
      var img = list[i] === 'slime' ? S.slime[fr] : list[i] === 'bat' ? S.bat[fr] : list[i] === 'ghost' ? S.ghost[fr] : S.golem[fr];
      ctx.drawImage(img, Math.round(x0 + i * iw - 2), cy + 26);
    }
  }

  function drawPaused() {
    dim(0.6);
    var cy = fieldMid();
    panel(84, cy - 62, 312, 124, 0.85);
    text('PAUSED', 240, cy - 46, { scale: 3, color: C.gold, outline: C.ink, align: 'center' });
    text('P / ESC  RESUME', 240, cy - 8, { scale: 2, color: C.cream, shadow: C.ink, align: 'center' });
    text('R  RESTART', 240, cy + 16, { scale: 2, color: C.cream, shadow: C.ink, align: 'center' });
    text('M  SOUND', 240, cy + 40, { scale: 2, color: C.cream, shadow: C.ink, align: 'center' });
  }

  function drawStageClear() {
    dim(0.45);
    /* keep the celebrating mole visible: move the banner up/down when it would cover him */
    var P = G.player, px = P.x * T, py = HUD_H + P.y * T;
    var h = 124, y = fieldMid() - 62;
    if (px + T > 52 && px < 428 && py + T > y && py < y + h) y = (py + T / 2 > fieldMid()) ? HUD_H + 14 : HUD_H + FIELD_H - h - 14;
    panel(52, y, 376, h, 0.82);
    text('STAGE CLEAR!', 240, y + 16, { scale: 3, color: C.gold, outline: C.ink, align: 'center' });
    text('CLEAR BONUS +' + G.clearInfo.clear, 240, y + 56, { scale: 2, color: C.cream, shadow: C.ink, align: 'center' });
    text('TIME BONUS +' + G.clearInfo.time, 240, y + 82, { scale: 2, color: C.green, shadow: C.ink, align: 'center' });
  }

  function resultLines(lines, y0, pitch) {
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      text(L.s, 240, y0 + i * pitch, { scale: L.scale || 2, color: L.color || C.cream, shadow: C.ink, outline: L.outline, align: 'center', mono: !!L.mono });
    }
  }

  function drawGameOver() {
    dim(0.72);
    var r = G.result;
    var lines = [
      { s: 'GAME OVER', scale: 3, color: '#ff5a4a', outline: C.ink },
      { s: 'SCORE ' + pad6(r.score), mono: true },
      { s: 'BEST  ' + pad6(r.best), mono: true, color: C.gold },
      { s: 'REACHED STAGE ' + r.stage, mono: true }
    ];
    panel(60, 84, 360, 292, 0.78);
    resultLines(lines, 100, 30);
    var y = 100 + 30 * 4 + 6;
    if (r.newRecord) text('NEW RECORD!', 240, y, { scale: 2, color: (Math.floor(G.animT * 5) & 1) ? C.gold : '#fff6c0', outline: C.ink, align: 'center' });
    var dis = G.lockT > 0;
    text('ENTER  RETRY', 240, y + 44, { scale: 2, color: C.cream, shadow: C.ink, align: 'center', mono: true, alpha: dis ? 0.45 : 1 });
    text('ESC    TITLE', 240, y + 72, { scale: 2, color: C.cream, shadow: C.ink, align: 'center', mono: true, alpha: dis ? 0.45 : 1 });
  }

  function drawGameClear() {
    dim(0.55);
    var r = G.result;
    panel(44, 76, 392, 308, 0.74);
    text('CONGRATULATIONS!', 240, 92, { scale: 3, color: C.gold, outline: C.ink, align: 'center' });
    text('YOU ESCAPED THE MINE', 240, 130, { scale: 2, color: C.cream, shadow: C.ink, align: 'center' });
    text('SCORE ' + pad6(r.score), 240, 172, { scale: 2, color: C.cream, shadow: C.ink, align: 'center', mono: true });
    text('BEST  ' + pad6(r.best), 240, 202, { scale: 2, color: C.gold, shadow: C.ink, align: 'center', mono: true });
    var y = 236;
    if (r.newRecord) text('NEW RECORD!', 240, y, { scale: 2, color: (Math.floor(G.animT * 5) & 1) ? C.gold : '#fff6c0', outline: C.ink, align: 'center' });
    var dis = G.lockT > 0;
    text('ENTER  PLAY AGAIN', 240, y + 44, { scale: 2, color: C.cream, shadow: C.ink, align: 'center', mono: true, alpha: dis ? 0.45 : 1 });
    text('ESC    TITLE', 240, y + 72, { scale: 2, color: C.cream, shadow: C.ink, align: 'center', mono: true, alpha: dis ? 0.45 : 1 });
    drawFireworks();                       // celebration bursts on the side margins, above the panel
  }

  /* ------------------------------------------------------------------ title */
  function drawTitle(t) {
    if (DM.Title) DM.Title.draw(ctx, t);
    else { ctx.fillStyle = '#1a1030'; ctx.fillRect(0, 0, W, DM.H); }
    var blink = (t % 1) < 0.6 ? 1 : 0.28;
    text('PRESS ENTER TO START', 240, 236, { scale: 2, color: C.gold, outline: C.ink, align: 'center', alpha: blink });
    text('HI-SCORE ' + pad6(G.hiSaved), 240, 262, { scale: 2, color: C.cream, shadow: C.ink, align: 'center' });
    var lines = ['ARROWS / WASD  MOVE', 'SPACE / Z      BOMB', 'P / ESC        PAUSE', 'R              RESTART', 'M              SOUND'];
    for (var i = 0; i < lines.length; i++) {
      text(lines[i], 240, 292 + i * 20, { scale: 2, color: C.cream, shadow: C.ink, align: 'center', mono: true });
    }
  }

  /* ------------------------------------------------------------------ frame */
  R.frame = function (t) {
    F.begin();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    var s = G.state;
    if (s === 'title') {
      drawTitle(t);
      return;
    }
    drawField(G.animT);
    drawHud();
    if (s === 'stageIntro') drawIntro();
    else if (s === 'paused') drawPaused();
    else if (s === 'stageClear') drawStageClear();
    else if (s === 'gameOver') drawGameOver();
    else if (s === 'gameClear') drawGameClear();
  };
})(typeof window !== 'undefined' ? window : globalThis);
