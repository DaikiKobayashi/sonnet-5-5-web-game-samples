/* Dynamite Mole - bootstrap: loop, input, layout, touch UI, verification hooks. */
(function () {
  'use strict';

  var params = (function () {
    var q = {};
    try {
      var s = window.location.search.replace(/^\?/, '');
      if (s) s.split('&').forEach(function (kv) {
        var p = kv.split('=');
        q[decodeURIComponent(p[0])] = p.length > 1 ? decodeURIComponent(p[1]) : '';
      });
    } catch (e) { /* ignore */ }
    return q;
  })();

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  var reduced = false;
  try { reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduced = false; }

  // Build all art first (nothing is recorded to the text list during this).
  var sprites = Sprites.build();
  Render.init(ctx, sprites, reduced);

  var frameTexts = [], lastTexts = [];
  Font.setListener(function (t) { frameTexts.push(t); });

  Game.init({
    debug: params.debug === '1',
    stage: params.stage,
    seed: params.seed !== undefined ? params.seed : null,
    mute: params.mute === '1',
    touch: params.touch === '1'
  });

  /* ---------- verification hooks ---------- */
  var hooks = {
    snapshot: function () { return Game.snapshot(lastTexts); }
  };
  if (params.debug === '1') hooks.debug = Game.debug;
  window.__GAME__ = hooks;

  /* ---------- input ---------- */
  var GAME_KEYS = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Space: 1, KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1, KeyZ: 1, KeyP: 1, Escape: 1, KeyR: 1, KeyM: 1, Enter: 1 };
  window.addEventListener('keydown', function (e) {
    if (GAME_KEYS[e.code]) e.preventDefault();
    Sound.unlock();
    Game.keyDown(e.code, e.repeat);
  });
  window.addEventListener('keyup', function (e) {
    if (GAME_KEYS[e.code]) e.preventDefault();
    Game.keyUp(e.code);
  });
  window.addEventListener('blur', function () { Game.releaseAllKeys(); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { Game.releaseAllKeys(); Game.pauseIfPlaying(); }
  });
  window.addEventListener('pointerdown', function () { Sound.unlock(); }, { passive: true });
  canvas.addEventListener('pointerdown', function (e) {
    Sound.unlock();
    Game.startFromTouch();
    e.preventDefault();
  });

  /* ---------- touch UI (Should 5.6) ---------- */
  var touchEl = document.getElementById('touch');
  var showTouch = params.touch === '1';
  try { if (!showTouch && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) showTouch = true; } catch (e) { /* ignore */ }
  if (showTouch) {
    touchEl.hidden = false;
    var buttons = touchEl.querySelectorAll('[data-key]');
    var savedListener = null;
    Array.prototype.forEach.call(buttons, function (btn) {
      var code = btn.getAttribute('data-key');
      var label = btn.getAttribute('data-label');
      if (label) {
        // draw the label with the bitmap font (no system font on screen)
        var lc = document.createElement('canvas');
        lc.width = label.length * 8 + 2; lc.height = 10;
        var lg = lc.getContext('2d');
        lg.imageSmoothingEnabled = false;
        Font.setListener(savedListener);
        Font.draw(lg, label, 1, 1, 1, '#ffffff');
        Font.setListener(function (t) { frameTexts.push(t); });
        lc.style.width = (lc.width * 2) + 'px';
        lc.style.height = (lc.height * 2) + 'px';
        btn.appendChild(lc);
      }
      var active = false;
      var press = function (e) {
        e.preventDefault();
        if (active) return;
        active = true;
        btn.classList.add('down');
        Sound.unlock();
        Game.keyDown(code, false);
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      };
      var release = function (e) {
        if (e) e.preventDefault();
        if (!active) return;
        active = false;
        btn.classList.remove('down');
        Game.keyUp(code);
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
  }

  /* ---------- layout ---------- */
  function resize() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var touchH = (showTouch && !touchEl.hidden) ? touchEl.offsetHeight + 8 : 0;
    var availH = Math.max(100, vh - touchH);
    var scale = Math.min(vw / Render.W, availH / Render.H);
    var w = Math.floor(Render.W * scale), h = Math.floor(Render.H * scale);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- loop: fixed 1/60 s steps ---------- */
  var STEP = 1 / 60, acc = 0, last = performance.now();
  function loop(now) {
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    if (Game.G.state !== 'paused') {
      acc += dt;
      var guard = 0;
      while (acc >= STEP && guard++ < 20) {
        Game.update(STEP);
        acc -= STEP;
      }
    } else acc = 0;
    frameTexts = [];
    Render.frame();
    lastTexts = frameTexts;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
