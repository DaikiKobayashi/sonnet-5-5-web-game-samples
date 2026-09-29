/* touch.js - on-screen controls (Should S1): d-pad, BOMB and PAUSE buttons under the canvas.
 * Shown when (pointer: coarse) matches or ?touch=1. Buttons are pointer-event driven and behave exactly like the keys.
 * Button faces are pixel-art images drawn by art_ui.js; the DOM text is only for assistive tech (visually hidden). */
(function (root) {
  'use strict';
  var DM = root.DM = root.DM || {};
  var Touch = DM.Touch = { active: false };
  var el = null, buttons = {}, held = {};

  Touch.height = function (vw, vh) {
    return Math.round(Math.max(118, Math.min(214, vh * 0.27)));
  };

  function press(act) {
    var G = DM.Game;
    if (act === 'up' || act === 'down' || act === 'left' || act === 'right') G.dirDown(act);
    else if (act === 'bomb') G.pressBomb(false);
    else if (act === 'pause') G.pressPause();
  }
  function release(act) {
    if (act === 'up' || act === 'down' || act === 'left' || act === 'right') DM.Game.dirUp(act);
  }

  function make(act, label, imgs) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.setAttribute('data-act', act);
    b.style.backgroundImage = 'url(' + imgs[0].toDataURL('image/png') + ')';
    var span = document.createElement('span');
    span.textContent = label;
    span.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;';
    b.appendChild(span);
    var up = imgs[0].toDataURL('image/png'), down = imgs[1].toDataURL('image/png');
    function on(e) {
      e.preventDefault();
      if (DM.Audio) DM.Audio.unlock();
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (held[act]) return;
      held[act] = true;
      b.style.backgroundImage = 'url(' + down + ')';
      press(act);
    }
    function off() {
      if (!held[act]) return;
      held[act] = false;
      b.style.backgroundImage = 'url(' + up + ')';
      release(act);
    }
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('lostpointercapture', off);
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.appendChild(b);
    buttons[act] = b;
    return b;
  }

  Touch.layout = function () {
    if (!Touch.active || !el) return;
    var W = el.clientWidth, H = el.clientHeight;
    var b = Math.floor(Math.min(H * 0.34, 62, W * 0.16));
    var cx = 14 + b * 1.5, cy = H / 2 + 2;
    function place(act, x, y, w, h) {
      var s = buttons[act].style;
      s.left = Math.round(x) + 'px'; s.top = Math.round(y) + 'px'; s.width = Math.round(w) + 'px'; s.height = Math.round(h) + 'px';
    }
    place('up', cx - b / 2, cy - b * 1.5, b, b);
    place('down', cx - b / 2, cy + b * 0.5, b, b);
    place('left', cx - b * 1.5, cy - b / 2, b, b);
    place('right', cx + b * 0.5, cy - b / 2, b, b);
    var B = Math.floor(Math.min(H * 0.72, 112, W * 0.3));
    place('bomb', W - B - 16, H / 2 - B / 2 + 2, B, B);
    var pw = Math.floor(Math.min(96, W * 0.24)), ph = Math.round(pw * 22 / 56);
    place('pause', W / 2 - pw / 2, 8, pw, ph);
  };

  Touch.init = function (container, force) {
    var coarse = false;
    try { coarse = !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches); } catch (e) { coarse = false; }
    Touch.active = !!(force || coarse);
    if (!Touch.active || !container) return;
    el = container;
    var T = DM.Spr.touch;
    make('up', 'UP', T.up); make('down', 'DOWN', T.down); make('left', 'LEFT', T.left); make('right', 'RIGHT', T.right);
    make('bomb', 'BOMB', T.bomb); make('pause', 'PAUSE', T.pause);
    container.classList.add('on');
    root.addEventListener('blur', function () {
      Object.keys(held).forEach(function (a) { if (held[a]) { held[a] = false; release(a); } });
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
