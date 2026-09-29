/* main.js - boot, input, fixed-step loop, layout, touch UI, verification hooks */
(function () {
  'use strict';
  const DM = window.DM;
  const G = DM.G;
  const params = new URLSearchParams(location.search);

  DM.buildSprites();
  DM.initRender();
  G.init(params);
  DM.audio.muted = params.get('mute') === '1' ? true : G.loadMuted();
  try { G.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { G.reducedMotion = false; }

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  /* ------------------------------------------------------------ input */
  const DIRKEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  };
  const GAMEKEYS = new Set(Object.keys(DIRKEYS).concat(['Space', 'KeyZ', 'Enter', 'KeyP', 'Escape', 'KeyR', 'KeyM']));
  let heldCodes = [];
  function syncHeld() {
    const dirs = [];
    for (const c of heldCodes) { const d = DIRKEYS[c]; if (d) { const i = dirs.indexOf(d); if (i >= 0) dirs.splice(i, 1); dirs.push(d); } }
    G.input.held = dirs;
  }
  function keyDown(code) {
    DM.audio.unlock();
    if (DIRKEYS[code]) {
      if (!heldCodes.includes(code)) heldCodes.push(code);
      syncHeld();
      if (G.state === 'playing' && G.player.alive) G.input.buffer = DIRKEYS[code];
      return;
    }
    G.press(code);
  }
  function keyUp(code) {
    const i = heldCodes.indexOf(code);
    if (i >= 0) { heldCodes.splice(i, 1); syncHeld(); }
  }
  window.addEventListener('keydown', (e) => {
    if (GAMEKEYS.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    keyDown(e.code);
  });
  window.addEventListener('keyup', (e) => {
    if (GAMEKEYS.has(e.code)) e.preventDefault();
    keyUp(e.code);
  });
  window.addEventListener('blur', () => { heldCodes = []; syncHeld(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { G.autoPause(); heldCodes = []; syncHeld(); } });

  canvas.addEventListener('pointerdown', (e) => {
    DM.audio.unlock();
    if (G.state === 'title' || G.state === 'gameOver' || G.state === 'gameClear') { G.press('Enter'); e.preventDefault(); }
  });

  /* ------------------------------------------------------------ touch UI */
  const touchEl = document.getElementById('touch');
  let touchOn = params.get('touch') === '1';
  try { if (window.matchMedia('(pointer: coarse)').matches) touchOn = true; } catch (e) { /* ignore */ }

  function buttonImage(kind, pressed, label, W, H) {
    W = W || 56; H = H || 56;
    const c = DM.mkCanvas(W, H), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const base = pressed ? '#c88a2a' : '#4a3a34', hi = pressed ? '#ffd870' : '#8a7060', lo = pressed ? '#8a5a18' : '#1c1410';
    x.fillStyle = lo; x.fillRect(0, 0, W, H);
    x.fillStyle = base; x.fillRect(4, 4, W - 8, H - 8);
    x.fillStyle = hi; x.fillRect(4, 4, W - 8, 4); x.fillRect(4, 4, 4, H - 8);
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(4, H - 8, W - 8, 4); x.fillRect(W - 8, 4, 4, H - 8);
    if (kind === 'arrow') {
      x.save();
      x.translate(W / 2, H / 2);
      x.rotate({ up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[label]);
      x.fillStyle = pressed ? '#3a1c08' : '#ffe8b0';
      for (const [px, py, w] of [[-4, -16, 8], [-8, -12, 16], [-12, -8, 24], [-4, -4, 8], [-4, 0, 8], [-4, 4, 8], [-4, 8, 8]]) x.fillRect(px, py, w, 4);
      x.restore();
    } else {
      const sc = kind === 'big' ? 3 : 2;
      DM.drawText(x, label, W / 2, Math.round(H / 2 - 3.5 * sc), sc, pressed ? '#3a1c08' : '#ffe8b0', { align: 'center', record: false });
    }
    return c.toDataURL();
  }
  function setupTouch() {
    if (!touchOn) return;
    touchEl.hidden = false;
    const defs = [
      ['u', 'ArrowUp', 'arrow', 'up'], ['l', 'ArrowLeft', 'arrow', 'left'], ['r', 'ArrowRight', 'arrow', 'right'], ['d', 'ArrowDown', 'arrow', 'down'],
    ];
    const bind = (el, code, once) => {
      let on = false;
      const up = (e) => { if (!on) return; on = false; el.classList.remove('down'); if (!once) keyUp(code); e.preventDefault(); };
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault(); on = true; el.classList.add('down');
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        keyDown(code);
      });
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    for (const [id, code, kind, label] of defs) {
      const el = document.getElementById('b-' + id);
      el.style.setProperty('--up', 'url(' + buttonImage(kind, false, label) + ')');
      el.style.setProperty('--dn', 'url(' + buttonImage(kind, true, label) + ')');
      bind(el, code, false);
    }
    const bomb = document.getElementById('b-bomb'), pause = document.getElementById('b-pause');
    bomb.style.setProperty('--up', 'url(' + buttonImage('text', false, 'BOMB', 64, 64) + ')');
    bomb.style.setProperty('--dn', 'url(' + buttonImage('text', true, 'BOMB', 64, 64) + ')');
    pause.style.setProperty('--up', 'url(' + buttonImage('text', false, 'PAUSE', 84, 32) + ')');
    pause.style.setProperty('--dn', 'url(' + buttonImage('text', true, 'PAUSE', 84, 32) + ')');
    bind(bomb, 'Space', true);
    bind(pause, 'KeyP', true);
  }
  setupTouch();

  /* ------------------------------------------------------------ layout */
  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const tH = touchOn && !touchEl.hidden ? touchEl.offsetHeight : 0;
    const s = Math.max(0.1, Math.min(vw / 480, (vh - tH) / 416));
    canvas.style.width = Math.floor(480 * s * 100) / 100 + 'px';
    canvas.style.height = Math.floor(416 * s * 100) / 100 + 'px';
    if (tH) touchEl.style.width = Math.min(vw, Math.max(canvas.clientWidth, 320)) + 'px';
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', layout);
  layout();

  /* ------------------------------------------------------------ loop */
  let last = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.25) dt = 0.25;
    if (G.state === 'paused') acc = 0;
    else {
      acc += dt;
      while (acc >= G.FIXED) { G.update(G.FIXED); acc -= G.FIXED; }
    }
    DM.audio.sync();
    DM.render(ctx);
  }
  requestAnimationFrame((t) => { last = t; frame(t); });

  /* ------------------------------------------------------------ verification hooks */
  const hooks = { snapshot: () => G.snapshot() };
  if (params.get('debug') === '1') hooks.debug = G.debug;
  window.__GAME__ = Object.freeze(hooks);
})();
