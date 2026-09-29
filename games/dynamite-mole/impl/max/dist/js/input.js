/* input.js - keyboard (KeyboardEvent.code on window), canvas tap, tab visibility */
(function (root) {
  'use strict';
  var DM = root.DM = root.DM || {};

  var DIR_KEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right'
  };

  var Input = DM.Input = {};

  var downCodes = {};   // physical keys currently held that map to a direction (W + ArrowUp both mean 'up')

  function dirStillHeld(dir) {
    for (var c in downCodes) if (downCodes[c] && DIR_KEYS[c] === dir) return true;
    return false;
  }

  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var G = DM.Game, code = e.code, handled = true;
    if (DM.Audio) DM.Audio.unlock();
    if (DIR_KEYS[code]) {
      if (!e.repeat && !downCodes[code]) { downCodes[code] = true; G.dirDown(DIR_KEYS[code]); }
    } else if (code === 'Space') {
      if (!e.repeat) G.pressBomb(true);
    } else if (code === 'KeyZ') {
      if (!e.repeat) G.pressBomb(false);
    } else if (code === 'Enter' || code === 'NumpadEnter') {
      if (!e.repeat) G.pressConfirm();
    } else if (code === 'KeyP') {
      if (!e.repeat) G.pressPause();
    } else if (code === 'Escape') {
      if (!e.repeat) G.pressEscape();
    } else if (code === 'KeyR') {
      if (!e.repeat) G.pressRestart();
    } else if (code === 'KeyM') {
      if (!e.repeat && DM.Audio) DM.Audio.toggleMute();
    } else {
      handled = false;
    }
    if (handled) e.preventDefault();
  }

  function onKeyUp(e) {
    var d = DIR_KEYS[e.code];
    if (d) {
      downCodes[e.code] = false;
      if (!dirStillHeld(d)) DM.Game.dirUp(d);
      e.preventDefault();
    }
  }

  Input.init = function (canvas) {
    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('keyup', onKeyUp);
    root.addEventListener('blur', function () { downCodes = {}; DM.Game.clearInput(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { DM.Game.autoPause(); downCodes = {}; DM.Game.clearInput(); }
    });
    /* tap on the canvas = Enter on title / gameOver / gameClear */
    canvas.addEventListener('pointerdown', function (e) {
      try { root.focus(); } catch (err) { /* e.g. inside a sandboxed frame */ }
      if (DM.Audio) DM.Audio.unlock();
      var s = DM.Game.state;
      if (s === 'title' || s === 'gameOver' || s === 'gameClear') DM.Game.pressConfirm();
      e.preventDefault();
    });
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };
})(typeof window !== 'undefined' ? window : globalThis);
