/* render.js - draws everything to the 480x416 canvas */
(function () {
  'use strict';
  const DM = (window.DM = window.DM || {});
  const G = DM.G;
  const W = 480, H = 416, HUD = 64;
  let SPR, logo, logoMask, logoShadow, titleBg, lightCv, lctx, shineCv, sctx;
  const CREAM = '#fff2d0', GOLD = '#ffd23a', SHADOW = '#1a0e08';

  DM.initRender = function () {
    SPR = DM.SPR;
    const l = DM.makeLogo();
    logo = l.canvas; logoMask = l.mask;
    logoShadow = DM.mkCanvas(440, 120);
    const lsx = logoShadow.getContext('2d');
    lsx.drawImage(logoMask, 0, 0);
    lsx.globalCompositeOperation = 'source-in';
    lsx.fillStyle = '#000000';
    lsx.fillRect(0, 0, 440, 120);
    titleBg = DM.makeTitleBg();
    lightCv = DM.mkCanvas(W, H - HUD); lctx = lightCv.getContext('2d');
    shineCv = DM.mkCanvas(440, 120); sctx = shineCv.getContext('2d');
  };

  const text = (ctx, s, x, y, scale, color, opts) => DM.drawText(ctx, s, x, y, scale, color, Object.assign({ shadow: SHADOW }, opts || {}));
  const ctext = (ctx, s, y, scale, color, opts) => text(ctx, s, W / 2, y, scale, color, Object.assign({ align: 'center' }, opts || {}));
  const pad6 = (n) => String(Math.max(0, Math.floor(n))).padStart(6, '0');
  const fmtTime = (t) => { const s = Math.ceil(Math.max(0, t)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const hash = (c, r) => (Math.imul(c + 1, 73856093) ^ Math.imul(r + 7, 19349663)) >>> 0;

  /* ------------------------------------------------------------ field */
  function isBlocked(c, r) {
    if (r < 0 || c < 0 || r >= G.ROWS || c >= G.COLS) return true;
    return G.grid[r][c] !== 0;
  }

  function drawTiles(ctx, th) {
    for (let r = 0; r < G.ROWS; r++) {
      for (let c = 0; c < G.COLS; c++) {
        const x = c * 32, y = HUD + r * 32, t = G.grid[r][c];
        const isFrame = r === 0 || r === G.ROWS - 1 || c === 0 || c === G.COLS - 1;
        if (t === 1 && isFrame) { ctx.drawImage(th.wall, x, y); continue; }
        const h = hash(c, r);
        ctx.drawImage(h % 7 === 0 ? th.floorDeco[(h >> 4) % 3] : th.floors[(c + r) % 2], x, y);
        if (t === 2) { ctx.drawImage(th.rock[0], x, y); continue; }
        if (t === 1) { ctx.drawImage(SPR.shadowChar, x, y + 6); ctx.drawImage(th.pillar, x, y); continue; }
        if (isBlocked(c, r - 1)) ctx.drawImage(SPR.shadowTop, x, y);
      }
    }
    // torches on the outer wall
    const tf = Math.floor(G.animT * 9) % 2;
    for (const [c, r] of [[0, 3], [0, 7], [14, 3], [14, 7]]) ctx.drawImage(SPR.torch[(tf + c + r) % 2], c * 32, HUD + r * 32);
    // crumbling rocks
    for (const b of G.breaks) {
      const f = Math.min(3, 1 + Math.floor(b.t / 0.1));
      ctx.drawImage(th.rock[f], b.col * 32, HUD + b.row * 32);
    }
  }

  function flameSprite(f) {
    const fr = Math.floor((0.5 - f.timeLeft) * 16) % 4;
    if (f.kind === 'center') return SPR.flame.center[fr];
    if (f.kind === 'arm') return f.dir === 'up' || f.dir === 'down' ? SPR.flame.armV[fr] : SPR.flame.armH[fr];
    return SPR.flame.tip[f.dir === 'right' ? 'right' : f.dir === 'left' ? 'left' : f.dir === 'up' ? 'up' : 'down'][fr];
  }

  function drawPlayer(ctx) {
    const p = G.player;
    const px = Math.round(p.x * 32), py = HUD + Math.round(p.y * 32);
    let img;
    if (!p.alive) {
      img = SPR.moleDie[Math.min(5, Math.floor(p.dieT / 0.2))];
    } else {
      if (p.inv > 0 && Math.floor(p.inv / 0.0625) % 2 === 1) return;
      const dir = p.facing;
      if (G.state === 'stageClear') img = SPR.moleJoy[Math.floor(G.stateT * 4) % 2];
      else if (p.moving) img = SPR.mole[dir][Math.floor(p.walkT * 11) % 4];
      else img = SPR.mole.idle[dir][Math.floor(G.animT * 2.2) % 2];
    }
    ctx.drawImage(SPR.shadowChar, px, py + 8);
    ctx.drawImage(img, px, py);
  }
  function drawEnemy(ctx, e) {
    const px = Math.round(e.x * 32), py = HUD + Math.round(e.y * 32);
    if (!e.alive) {
      const i = Math.min(2, Math.floor(((0.4 - e.deathT) / 0.4) * 3));
      ctx.drawImage(SPR.puff[e.type][Math.max(0, i)], px, py);
      return;
    }
    let img, oy = 0;
    ctx.drawImage(SPR.shadowChar, px, py + 8);
    if (e.type === 'slime') img = SPR.slime[Math.floor(e.anim * 6) % 4];
    else if (e.type === 'bat') { img = SPR.bat[Math.floor(e.anim * 11) % 4]; oy = -2; }
    else if (e.type === 'ghost') { img = (e.chase ? SPR.ghostChase : SPR.ghost)[Math.floor(e.anim * 5) % 4]; oy = -2 - Math.round(Math.sin(e.anim * 3) * 1.5); }
    else {
      const fi = Math.floor(e.anim * 5) % 4;
      img = e.hitT > 0 && Math.floor(e.hitT * 14) % 2 === 0 ? SPR.golemFlash[fi] : SPR.golem[fi];
    }
    if (e.type === 'ghost') ctx.globalAlpha = 0.9;
    ctx.drawImage(img, px, py + oy);
    ctx.globalAlpha = 1;
  }

  function drawObjects(ctx, th) {
    // exit
    const ex = G.exit;
    if (ex.revealed) {
      const img = ex.open ? SPR.exit.open[Math.floor(G.animT * 4) % 2] : SPR.exit.closed;
      ctx.drawImage(img, ex.col * 32, HUD + ex.row * 32);
    }
    // items
    for (const it of G.items) {
      const bob = Math.round(Math.sin(it.t * 4 + it.col) * 2);
      ctx.drawImage(SPR.shadowChar, it.col * 32, HUD + it.row * 32 + 8);
      ctx.drawImage(SPR.item[it.type][Math.floor(it.t * 3) % 2], it.col * 32, HUD + it.row * 32 - 2 + bob);
    }
    // bombs
    for (const b of G.bombs) {
      const fast = b.timeLeft < 0.8;
      const flash = fast ? Math.floor(b.t * 14) % 2 === 0 : false;
      const bob = Math.floor(b.t * 4) % 2 === 0 ? 0 : 1;
      const set = flash ? SPR.bombFlash : SPR.bomb;
      ctx.drawImage(SPR.shadowChar, b.col * 32, HUD + b.row * 32 + 6);
      ctx.drawImage(set[Math.floor(b.t * (fast ? 14 : 8)) % 3], b.col * 32, HUD + b.row * 32 + bob);
    }
    // flames
    for (const f of G.flames) {
      const s = flameSprite(f);
      if (f.timeLeft < 0.1) {
        const k = 0.55 + f.timeLeft * 4.5, sz = Math.round(32 * k);
        ctx.drawImage(s, f.col * 32 + (32 - sz) / 2, HUD + f.row * 32 + (32 - sz) / 2, sz, sz);
      } else ctx.drawImage(s, f.col * 32, HUD + f.row * 32);
    }
    // characters, y-sorted
    const list = G.enemies.map((e) => ({ y: e.y, f: () => drawEnemy(ctx, e) }));
    list.push({ y: G.player.y + 0.01, f: () => drawPlayer(ctx) });
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.f();
  }

  function drawParticles(ctx) {
    for (const p of G.particles) {
      const a = Math.max(0, Math.min(1, p.life / p.max * 1.4));
      if (p.color === 'dust') { ctx.fillStyle = 'rgba(214,190,150,' + (a * 0.6).toFixed(2) + ')'; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size + 2 * (1 - a), p.size + 2 * (1 - a)); }
      else { ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); ctx.globalAlpha = 1; }
    }
    for (const p of G.popups) {
      const a = p.t > 0.6 ? (0.8 - p.t) / 0.2 : 1;
      ctx.globalAlpha = Math.max(0, a);
      text(ctx, p.text, p.x, p.y - p.t * 26, 2, p.color, { align: 'center' });
      ctx.globalAlpha = 1;
    }
  }

  function drawLighting(ctx, th) {
    const amb = th.ambient;
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, W, H - HUD);
    lctx.fillStyle = 'rgba(' + amb[0] + ',' + amb[1] + ',' + amb[2] + ',' + (amb[3] + 0.02) + ')';
    lctx.fillRect(0, 0, W, H - HUD);
    lctx.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => { lctx.globalAlpha = a; lctx.drawImage(SPR.light, x - r, y - HUD - r, r * 2, r * 2); };
    const fl = 1 + Math.sin(G.animT * 13) * 0.03 + Math.sin(G.animT * 5.3) * 0.03;
    const p = G.player;
    hole((p.x + 0.5) * 32, HUD + (p.y + 0.5) * 32, 150 * fl, 1);
    for (const [c, r] of [[0, 3], [0, 7], [14, 3], [14, 7]]) hole((c + 0.5) * 32, HUD + (r + 0.5) * 32, 96 * (1 + Math.sin(G.animT * 9 + r) * 0.06), 0.9);
    for (const b of G.bombs) hole((b.col + 0.5) * 32, HUD + (b.row + 0.5) * 32, 56, 0.8);
    for (const f of G.flames) hole((f.col + 0.5) * 32, HUD + (f.row + 0.5) * 32, 70, 0.9);
    if (G.exit.open && G.exit.revealed) hole((G.exit.col + 0.5) * 32, HUD + (G.exit.row + 0.5) * 32, 64, 0.9);
    lctx.globalAlpha = 1;
    lctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(lightCv, 0, HUD);
    // additive warm glow
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    for (const f of G.flames) ctx.drawImage(SPR.glow, (f.col + 0.5) * 32 - 44, HUD + (f.row + 0.5) * 32 - 44, 88, 88);
    ctx.globalAlpha = 0.34;
    for (const [c, r] of [[0, 3], [0, 7], [14, 3], [14, 7]]) ctx.drawImage(SPR.glow, (c + 0.5) * 32 - 56, HUD + (r + 0.5) * 32 - 56, 112, 112);
    ctx.globalAlpha = 0.3;
    for (const b of G.bombs) ctx.drawImage(SPR.glow, (b.col + 0.5) * 32 - 24, HUD + (b.row + 0.5) * 32 - 24, 48, 48);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (G.exitFlash > 0) {
      ctx.fillStyle = 'rgba(255,255,220,' + (G.exitFlash / 0.5 * 0.45).toFixed(2) + ')';
      ctx.fillRect(0, HUD, W, H - HUD);
    }
  }

  function drawField(ctx) {
    const th = SPR.themes[G.stage - 1];
    ctx.save();
    ctx.beginPath(); ctx.rect(0, HUD, W, H - HUD); ctx.clip();
    if (G.shake > 0) {
      const m = 4 * (G.shake / 0.2);
      ctx.translate(Math.round((Math.random() * 2 - 1) * m), Math.round((Math.random() * 2 - 1) * m));
    }
    drawTiles(ctx, th);
    drawObjects(ctx, th);
    drawParticles(ctx);
    drawLighting(ctx, th);
    ctx.restore();
  }

  /* ------------------------------------------------------------ HUD */
  function drawHud(ctx) {
    ctx.drawImage(SPR.hud, 0, 0);
    const hi = G.hiDisplay();
    text(ctx, 'SCORE ' + pad6(G.score), 10, 6, 2, CREAM);
    text(ctx, 'HI ' + pad6(hi), 184, 6, 2, GOLD);
    const low = G.timeLeft <= 30 && G.state !== 'paused';
    const blink = low && Math.floor(G.animT * 3) % 2 === 0;
    text(ctx, 'TIME ' + fmtTime(G.timeLeft), 350, 6, 2, low ? (blink ? '#ff5a4a' : '#ffb0a0') : CREAM);
    text(ctx, 'STAGE ' + G.stage + '/5', 10, 24, 2, CREAM);
    ctx.drawImage(SPR.iconLife, 146, 22);
    text(ctx, 'x' + G.lives, 166, 24, 2, CREAM);
    text(ctx, 'SND ' + (DM.audio.muted ? 'OFF' : 'ON'), 470, 24, 2, DM.audio.muted ? '#a09088' : '#9af0a0', { align: 'right' });
    const p = G.player;
    ctx.drawImage(SPR.iconBomb, 10, 42);
    text(ctx, 'BOMB ' + p.maxBombs, 30, 44, 2, CREAM);
    ctx.drawImage(SPR.iconFire, 132, 42);
    text(ctx, 'FIRE ' + p.range, 152, 44, 2, CREAM);
    ctx.drawImage(SPR.iconBoot, 254, 42);
    text(ctx, 'SPD ' + p.boots, 274, 44, 2, CREAM);
  }

  /* ------------------------------------------------------------ overlays */
  function dim(ctx, a) {
    ctx.fillStyle = 'rgba(6,4,10,' + a + ')';
    ctx.fillRect(0, HUD, W, H - HUD);
  }
  function panel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(16,10,20,0.82)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#c88a2a'; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h);
    ctx.fillStyle = '#4a3020'; ctx.fillRect(x + 2, y + 2, w - 4, 2); ctx.fillRect(x + 2, y + h - 4, w - 4, 2);
  }

  function drawIntro(ctx) {
    dim(ctx, 0.62);
    const st = G.STAGES[G.stage - 1];
    const k = Math.min(1, G.stateT / 0.25);
    ctx.globalAlpha = k;
    const y0 = HUD + 92 + Math.round((1 - k) * 12);
    ctext(ctx, 'STAGE ' + G.stage, y0, 5, GOLD);
    ctext(ctx, st.name, y0 + 56, 2, CREAM);
    const total = Object.values(st.enemies).reduce((a, b) => a + b, 0);
    ctext(ctx, 'ENEMIES ' + total, y0 + 92, 2, '#ff9a8a');
    // enemy icons
    const icons = [];
    for (const t of ['slime', 'bat', 'ghost', 'golem']) for (let i = 0; i < st.enemies[t]; i++) icons.push(t);
    const gap = 34, x0 = W / 2 - (icons.length * gap) / 2;
    icons.forEach((t, i) => {
      const spr = t === 'slime' ? SPR.slime[Math.floor(G.animT * 6) % 4] : t === 'bat' ? SPR.bat[Math.floor(G.animT * 11) % 4] : t === 'ghost' ? SPR.ghost[Math.floor(G.animT * 5) % 4] : SPR.golem[Math.floor(G.animT * 5) % 4];
      ctx.drawImage(spr, Math.round(x0 + i * gap), y0 + 116);
    });
    ctx.globalAlpha = 1;
  }
  function drawPause(ctx) {
    dim(ctx, 0.6);
    panel(ctx, 100, HUD + 96, 280, 160);
    ctext(ctx, 'PAUSED', HUD + 112, 4, GOLD);
    ctext(ctx, 'P / ESC  RESUME', HUD + 172, 2, CREAM);
    ctext(ctx, 'R  RESTART', HUD + 196, 2, CREAM);
    ctext(ctx, 'M  SOUND', HUD + 220, 2, CREAM);
  }
  function drawClear(ctx) {
    dim(ctx, 0.3);
    // keep the celebrating mole visible: put the panel on the other half of the field
    const top = G.player.y >= 5;
    const y0 = top ? HUD + 20 : HUD + 200;
    panel(ctx, 80, y0, 320, 132);
    const bounce = Math.round(Math.abs(Math.sin(G.stateT * 6)) * 4 * Math.max(0, 1 - G.stateT));
    ctext(ctx, 'STAGE CLEAR!', y0 + 16 - bounce, 3, GOLD);
    ctext(ctx, 'CLEAR BONUS +' + G.clearBonus, y0 + 64, 2, CREAM);
    ctext(ctx, 'TIME BONUS +' + G.timeBonus, y0 + 92, 2, '#9af0a0');
  }
  function drawResult(ctx, won) {
    dim(ctx, 0.72);
    const locked = G.stateT < 0.6;
    if (won) {
      // confetti
      const t = G.stateT;
      const cols = ['#ffd23a', '#ff5a4a', '#5af0ff', '#9af0a0', '#ff7ad9'];
      for (let i = 0; i < 46; i++) {
        const x = (i * 97 + Math.sin(t * 2 + i) * 20 + 480 * 4) % W;
        const y = HUD + ((t * (50 + (i % 5) * 18) + i * 41) % (H - HUD));
        ctx.fillStyle = cols[i % 5];
        ctx.fillRect(Math.round(x), Math.round(y), 4, 4 + (i % 3) * 2);
      }
    }
    const ph = won ? 268 : 244, pt = HUD + Math.round((H - HUD - ph) / 2);
    panel(ctx, 60, pt, 360, ph);
    let y = pt + 20;
    if (won) {
      ctext(ctx, 'CONGRATULATIONS!', y, 3, GOLD); y += 36;
      ctext(ctx, 'YOU ESCAPED THE MINE', y, 2, '#9af0a0'); y += 40;
    } else {
      ctext(ctx, 'GAME OVER', y + 4, 4, '#ff5a4a'); y += 52;
    }
    ctext(ctx, 'SCORE ' + pad6(G.score), y, 2, CREAM); y += 26;
    ctext(ctx, 'BEST  ' + pad6(G.hi), y, 2, GOLD); y += 26;
    if (!won) { ctext(ctx, 'REACHED STAGE ' + G.stage, y, 2, CREAM); y += 26; }
    if (G.newRecord && Math.floor(G.stateT * 3) % 2 === 0) ctext(ctx, 'NEW RECORD!', y, 2, '#ff9adf');
    else if (G.newRecord) ctext(ctx, 'NEW RECORD!', y, 2, '#ffd23a');
    y += 34;
    const c = locked ? '#7a6a70' : CREAM;
    ctext(ctx, won ? 'ENTER  PLAY AGAIN' : 'ENTER  RETRY', y, 2, c); y += 24;
    ctext(ctx, 'ESC    TITLE', y, 2, c);
  }

  /* ------------------------------------------------------------ title */
  function drawTitle(ctx) {
    const t = G.stateT;
    ctx.drawImage(titleBg, 0, 0);
    // fireflies + torch glow
    ctx.globalCompositeOperation = 'lighter';
    const fl = 0.75 + Math.sin(t * 11) * 0.08 + Math.sin(t * 4.1) * 0.08;
    ctx.globalAlpha = 0.55 * fl;
    ctx.drawImage(SPR.glow, 24 - 90, 96 - 90, 180, 180);
    ctx.drawImage(SPR.glow, 456 - 90, 96 - 90, 180, 180);
    ctx.globalAlpha = 0.28;
    ctx.drawImage(SPR.glow, 240 - 170, 78 - 110, 340, 220);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 16; i++) {
      const x = 40 + ((i * 53) % 400) + Math.sin(t * 0.7 + i * 1.7) * 26;
      const y = 150 + ((i * 37) % 250) + Math.cos(t * 0.9 + i * 2.3) * 18;
      const a = 0.35 + 0.35 * Math.sin(t * 3 + i * 5);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = i % 3 === 0 ? '#9af0ff' : '#ffe45c';
      ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
      ctx.globalAlpha = Math.max(0, a * 0.35);
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 6, 6);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // logo (drop shadow, bob, shine)
    const bob = 2 * Math.round(Math.sin(t * 2.1));
    const lx = 20, ly = 10 + bob;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(logoShadow, lx + 4, ly + 6);
    ctx.globalAlpha = 1;
    ctx.drawImage(logo, lx, ly);
    // shine sweep
    sctx.globalCompositeOperation = 'source-over';
    sctx.clearRect(0, 0, 440, 120);
    sctx.drawImage(logoMask, 0, 0);
    sctx.globalCompositeOperation = 'source-in';
    const sx = ((t * 130) % 900) - 220;
    const grd = sctx.createLinearGradient(sx, 0, sx + 90, 60);
    grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.85)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    sctx.fillStyle = grd; sctx.fillRect(0, 0, 440, 120);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7;
    ctx.drawImage(shineCv, lx, ly);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    DM.texts.push('DYNAMITE MOLE');

    drawTitleScene(ctx, t);

    ctx.globalAlpha = t % 1 < 0.62 ? 1 : 0.18;
    ctext(ctx, 'PRESS ENTER TO START', 208, 3, '#fff2d0');
    ctx.globalAlpha = 1;
    ctext(ctx, 'HI-SCORE ' + pad6(G.hi), 246, 2, GOLD);
    panel(ctx, 92, 274, 296, 128);
    const lines = ['ARROWS / WASD  MOVE', 'SPACE / Z      BOMB', 'P / ESC        PAUSE', 'R              RESTART', 'M              SOUND'];
    lines.forEach((s, i) => text(ctx, s, 108, 284 + i * 22, 2, i % 2 ? '#e8d8b8' : CREAM));
  }

  // little looping demo: mole plants dynamite, walks away, boom
  function drawTitleScene(ctx, t) {
    const th = SPR.themes[0];
    const y = 148, cyc = 8, u = t % cyc;
    // strip of tiles
    for (let c = 0; c < 15; c++) {
      const h = hash(c, 3);
      ctx.drawImage(h % 5 === 0 ? th.floorDeco[h % 3] : th.floors[c % 2], c * 32, y);
    }
    for (const c of [3, 11]) { ctx.drawImage(SPR.shadowChar, c * 32, y + 6); ctx.drawImage(th.pillar, c * 32, y); }
    const rockBroken = u >= 4.0;
    if (!rockBroken) ctx.drawImage(th.rock[0], 8 * 32, y);
    else if (u < 4.3) ctx.drawImage(th.rock[Math.min(3, 1 + Math.floor((u - 4.0) / 0.1))], 8 * 32, y);
    ctx.drawImage(th.rock[0], 13 * 32, y);
    // mole position
    let mx, dir = 'right', moving = false;
    if (u < 1.6) { mx = 1 + (u / 1.6) * 5; moving = true; }
    else if (u < 3.4) { mx = 6 - ((u - 1.6) / 1.8) * 3.5; dir = 'left'; moving = true; }
    else { mx = 2.5; dir = 'right'; }
    if (u >= 4.0 && u < 5.0) dir = 'right';
    const walk = Math.floor(t * 11) % 4;
    const img = moving ? SPR.mole[dir][walk] : SPR.mole.idle[dir][Math.floor(t * 2.2) % 2];
    // bomb
    if (u >= 1.6 && u < 4.0) {
      const bt = u - 1.6, fast = u > 3.2;
      ctx.drawImage(SPR.shadowChar, 6 * 32, y + 6);
      ctx.drawImage((fast && Math.floor(bt * 14) % 2 === 0) ? SPR.bombFlash[0] : SPR.bomb[Math.floor(bt * 8) % 3], 6 * 32, y);
    }
    if (u >= 4.0 && u < 4.5) {
      const fr = Math.floor((u - 4.0) * 16) % 4;
      ctx.drawImage(SPR.flame.center[fr], 6 * 32, y);
      for (const c of [5, 7]) ctx.drawImage(SPR.flame.armH[fr], c * 32, y);
      ctx.drawImage(SPR.flame.tip.left[fr], 4 * 32, y);
      ctx.drawImage(SPR.flame.tip.right[fr], 8 * 32, y);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(SPR.glow, 6 * 32 - 100, y - 84, 232, 200);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(SPR.shadowChar, Math.round(mx * 32), y + 8);
    ctx.drawImage(img, Math.round(mx * 32), y);
    // enemy wanders on the right
    const sx = 10 + Math.sin(t * 0.8) * 1.4;
    ctx.drawImage(SPR.slime[Math.floor(t * 6) % 4], Math.round(sx * 32), y);
  }

  /* ------------------------------------------------------------ main entry */
  DM.render = function (ctx) {
    DM.texts = [];
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const s = G.state;
    if (s === 'title') { drawTitle(ctx); return; }
    ctx.fillStyle = '#0a0810';
    ctx.fillRect(0, 0, W, H);
    drawField(ctx);
    drawHud(ctx);
    if (s === 'stageIntro') drawIntro(ctx);
    else if (s === 'paused') drawPause(ctx);
    else if (s === 'stageClear') drawClear(ctx);
    else if (s === 'gameOver') drawResult(ctx, false);
    else if (s === 'gameClear') drawResult(ctx, true);
  };
})();
