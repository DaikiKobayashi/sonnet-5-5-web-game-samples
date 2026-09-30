// Boot, fixed-step loop, input wiring, layout and touch UI.
(function () {
  'use strict';
  var DM = window.DM;
  var G = DM.G;

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  var art = DM.buildArt();
  DM.Render.init(ctx, art);

  // ---------- public hooks ----------
  var api = { snapshot: function () { return G.snapshot(); } };
  if (DM.params.debug) api.debug = G.makeDebug();
  window.__GAME__ = api;

  // ---------- keyboard ----------
  window.addEventListener('keydown', function (e) {
    if (G.GAME_KEYS.indexOf(e.code) >= 0) e.preventDefault();
    G.keyDown(e.code, e.repeat);
  });
  window.addEventListener('keyup', function (e) {
    if (G.GAME_KEYS.indexOf(e.code) >= 0) e.preventDefault();
    G.keyUp(e.code);
  });
  window.addEventListener('blur', function () { G.clearKeys(); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      G.clearKeys();
      if (G.state === 'playing') G.setPaused(true);
    }
  });

  // canvas tap = Enter on title / result screens
  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    DM.Audio.unlock();
    if (G.state === 'title' || G.state === 'gameOver' || G.state === 'gameClear') {
      G.keyDown('Enter', false);
    }
  });

  // ---------- touch UI ----------
  var coarse = false;
  try { coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches; } catch (e) { coarse = false; }
  var touchEl = document.getElementById('touch');
  var showTouch = coarse || DM.params.touch;
  if (showTouch) {
    touchEl.style.display = 'flex';
    Array.prototype.forEach.call(touchEl.querySelectorAll('canvas.lbl'), function (cv) {
      var text = cv.getAttribute('data-text');
      cv.width = DM.Font.width(text, 2) + 4; cv.height = 18;
      var c2 = cv.getContext('2d');
      DM.Font.draw(c2, text, 0, 0, { scale: 2, color: '#f8e8c8', record: false });
    });
    var btns = touchEl.querySelectorAll('[data-code]');
    Array.prototype.forEach.call(btns, function (b) {
      var code = b.getAttribute('data-code');
      var active = {};
      function down(e) {
        e.preventDefault();
        try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        active[e.pointerId] = true;
        b.classList.add('on');
        G.keyDown(code, false);
      }
      function up(e) {
        if (!active[e.pointerId]) return;
        delete active[e.pointerId];
        if (Object.keys(active).length === 0) { b.classList.remove('on'); G.keyUp(code); }
      }
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
  }

  // ---------- layout ----------
  function layout() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var th = showTouch ? touchEl.offsetHeight : 0;
    var avail = Math.max(50, vh - th);
    var s = Math.min(vw / 480, avail / 416);
    var w = Math.floor(480 * s), h = Math.floor(416 * s);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }
  window.addEventListener('resize', layout);
  layout();

  // ---------- loop ----------
  var STEP = 1 / 60;
  var acc = 0;
  var last = performance.now();
  function frame(now) {
    var dt = (now - last) / 1000;
    last = now;
    if (dt < 0) dt = 0;
    if (dt > 0.25) dt = 0.25;
    if (G.state === 'paused') {
      acc = 0;
    } else {
      acc += dt;
      var n = 0;
      while (acc >= STEP && n < 20) {
        G.update(STEP);
        acc -= STEP;
        n++;
        if (G.state === 'paused') { acc = 0; break; }
      }
    }
    var tempo = (G.state === 'playing' && G.timeLeft <= 30) ? 1.25 : 1;
    DM.Audio.update(G.bgmTrack(), tempo, G.state === 'paused');
    DM.Render.draw();
    requestAnimationFrame(frame);
  }
  DM.Render.draw();
  requestAnimationFrame(frame);
})();
