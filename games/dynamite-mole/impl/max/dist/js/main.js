/* main.js - bootstrap, fixed-step loop (1/60 s, cap 0.25 s), canvas fit, __GAME__ hooks */
(function (root) {
  'use strict';
  var DM = root.DM = root.DM || {};

  var canvas, ctx, touchEl = null;

  /* fit the 480x416 canvas into the window keeping the aspect ratio (fractional scale allowed) */
  function fit() {
    var vw = root.innerWidth, vh = root.innerHeight;
    var th = 0;
    if (touchEl && DM.Touch && DM.Touch.active) {
      th = DM.Touch.height(vw, vh);
      touchEl.style.height = th + 'px';
    }
    var availW = vw, availH = Math.max(50, vh - th);
    var s = Math.min(availW / DM.W, availH / DM.H);
    var dpr = root.devicePixelRatio || 1;
    var cw = Math.floor(DM.W * s * dpr) / dpr, ch = Math.floor(DM.H * s * dpr) / dpr;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    if (touchEl && DM.Touch && DM.Touch.active) DM.Touch.layout();
  }

  function boot() {
    var params = DM.readParams();
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    touchEl = document.getElementById('touch');

    var savedMute = DM.storage.get('dynamiteMole.muted') === '1';
    DM.Audio.init(params.mute ? true : savedMute);
    DM.Art.build();
    DM.Game.init(params);
    DM.Render.init(canvas, ctx);
    DM.Input.init(canvas);
    if (DM.Touch) DM.Touch.init(touchEl, params.touch);

    var api = { snapshot: DM.Game.snapshot };
    if (params.debug) api.debug = DM.Game.debug;
    Object.defineProperty(root, '__GAME__', { value: Object.freeze(api), writable: false, configurable: false, enumerable: true });

    fit();
    root.addEventListener('resize', fit);
    root.addEventListener('orientationchange', fit);

    var last = null, acc = 0, G = DM.Game, STEP = DM.STEP;
    function frame(now) {
      if (last === null) last = now;
      var dt = (now - last) / 1000;
      last = now;
      if (!(dt > 0)) dt = 0;
      if (dt > 0.25) dt = 0.25;
      if (G.state === 'paused') {
        acc = 0;
      } else {
        acc += dt;
        var n = 0;
        while (acc >= STEP && n < 16) { G.update(STEP); acc -= STEP; n++; }
        if (n >= 16) acc = 0;
      }
      DM.Render.frame(now / 1000);
      root.requestAnimationFrame(frame);
    }
    root.requestAnimationFrame(frame);
  }

  DM.fit = fit;
  DM.boot = boot;
})(typeof window !== 'undefined' ? window : globalThis);
