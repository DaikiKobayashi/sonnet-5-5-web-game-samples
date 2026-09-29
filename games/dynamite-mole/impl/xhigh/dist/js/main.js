/* main.js - boot, input, fixed-step loop, canvas fitting, touch UI, window.__GAME__ hooks. */
(function () {
  'use strict';
  var DM = window.DM;
  var G = DM.game;
  var A = DM.audio;

  var params = new URLSearchParams(window.location.search);
  function intParam(name) {
    var v = params.get(name);
    if (v === null || v === '') return null;
    var n = parseInt(v, 10);
    return isFinite(n) ? n : null;
  }
  var debug = params.has('debug') && params.get('debug') !== '0' && params.get('debug') !== 'false';

  /* ------------------------------------------------------------ sprites */
  var sprites = {
    mole: DM.buildMoleSprites(),
    enemy: DM.buildEnemySprites(),
    tiles: DM.buildTileSprites(),
    ui: DM.buildUiSprites()
  };
  sprites.mole.icon = DM.buildMoleIcon();
  DM.sprites = sprites;

  /* ------------------------------------------------------------ init */
  var canvas = document.getElementById('game');
  DM.render.init(canvas, sprites);
  var reduce = false;
  try {
    reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}
  var st = intParam('stage');
  G.init({
    seed: intParam('seed'),
    stage: st,
    debug: debug,
    mute: params.get('mute') === '1',
    reduceMotion: reduce
  });

  /* ------------------------------------------------------------ window.__GAME__ */
  var api = {
    snapshot: function () {
      /* redraw first so `texts` always describes the current state, even right after an input event */
      DM.render.draw(G);
      return G.snapshot();
    }
  };
  if (debug) api.debug = Object.freeze(G.debugApi);
  Object.defineProperty(window, '__GAME__', { value: Object.freeze(api), writable: false, configurable: false, enumerable: true });

  /* ------------------------------------------------------------ keyboard */
  var HANDLED = {
    ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Space: 1, Enter: 1, Escape: 1,
    KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1, KeyZ: 1, KeyP: 1, KeyR: 1, KeyM: 1
  };
  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (HANDLED[e.code]) e.preventDefault();
    A.unlock();
    if (HANDLED[e.code]) G.keyDown(e.code, e.repeat);
  });
  window.addEventListener('keyup', function (e) {
    if (HANDLED[e.code]) e.preventDefault();
    G.keyUp(e.code);
  });
  window.addEventListener('blur', function () {
    G.releaseAllKeys();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      G.releaseAllKeys();
      if (G.state === 'playing') G.pause();
    }
  });

  /* ------------------------------------------------------------ canvas fitting + touch UI */
  var touchEl = document.getElementById('touch');
  var stageEl = document.getElementById('stage');
  var coarse = false;
  try {
    coarse = window.matchMedia('(pointer: coarse)').matches;
  } catch (e) {}
  var touchOn = coarse || params.get('touch') === '1';
  if (touchOn) {
    touchEl.hidden = false;
    document.body.classList.add('has-touch');
  }

  function fit() {
    var th = touchOn ? touchEl.offsetHeight : 0;
    var availW = window.innerWidth;
    var availH = Math.max(50, window.innerHeight - th);
    stageEl.style.height = availH + 'px';
    var s = Math.min(availW / 480, availH / 416);
    canvas.style.width = 480 * s + 'px';
    canvas.style.height = 416 * s + 'px';
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  fit();

  /* canvas tap = Enter on title / gameOver / gameClear */
  canvas.addEventListener('pointerdown', function (e) {
    A.unlock();
    G.tapConfirm();
  });

  /* touch buttons: bitmap-font labels rendered to canvases (no system fonts) */
  function labelCanvas(text, scale, color) {
    var w = DM.font.width(text, scale) + 2;
    var c = DM.mkCanvas(w, 7 * scale + 2);
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    DM.font.draw(x, text, 1, 1, { scale: scale, color: color, shadow: '#0a0610', record: false });
    return c;
  }
  function arrowCanvas(dir) {
    var S = new DM.Spr(16, 16, 16);
    var P = DM.sh.poly;
    var pts = { up: [8, 3, 13, 10, 3, 10], down: [8, 13, 13, 6, 3, 6], left: [3, 8, 10, 3, 10, 13], right: [13, 8, 6, 3, 6, 13] }[dir];
    S.fill(P(pts), '#fff2c0');
    S.fill(DM.sh.sub(P(pts), DM.sh.mv(P(pts), -1.2, -1.2)), '#d8a040');
    S.outline('#1a1030');
    return S.toCanvas();
  }
  function setFace(btn, canvasEl, scale) {
    var img = canvasEl;
    var url = img.toDataURL();
    btn.style.backgroundImage = 'url(' + url + ')';
    btn.style.backgroundSize = img.width * scale + 'px ' + img.height * scale + 'px';
  }
  function bindHold(btn, code) {
    var down = false;
    function press(e) {
      e.preventDefault();
      A.unlock();
      if (down) return;
      down = true;
      btn.classList.add('on');
      try {
        btn.setPointerCapture(e.pointerId);
      } catch (er) {}
      G.keyDown(code, false);
    }
    function release(e) {
      if (!down) return;
      down = false;
      btn.classList.remove('on');
      G.keyUp(code);
    }
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });
  }
  ['up', 'down', 'left', 'right'].forEach(function (d) {
    var b = document.getElementById('btn-' + d);
    if (!b) return;
    setFace(b, arrowCanvas(d), 3);
    bindHold(b, { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[d]);
  });
  var bombBtn = document.getElementById('btn-bomb');
  setFace(bombBtn, labelCanvas('BOMB', 3, '#fff2c0'), 1);
  bindHold(bombBtn, 'Space');
  var pauseBtn = document.getElementById('btn-pause');
  setFace(pauseBtn, labelCanvas('PAUSE', 2, '#e8f0ff'), 1);
  bindHold(pauseBtn, 'KeyP');

  /* ------------------------------------------------------------ main loop (fixed 1/60 s step) */
  var DT = 1 / 60;
  var acc = 0;
  var last = performance.now();
  function frame() {
    window.requestAnimationFrame(frame);
    var now = performance.now();
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    if (dt < 0) dt = 0;
    if (G.state === 'paused') {
      acc = 0; /* time does not pile up while paused */
    } else {
      acc += dt;
      var guard = 0;
      while (acc >= DT && guard++ < 30) {
        G.update(DT);
        acc -= DT;
        if (G.state === 'paused') {
          acc = 0;
          break;
        }
      }
    }
    DM.render.draw(G);
  }
  window.requestAnimationFrame(frame);
})();
