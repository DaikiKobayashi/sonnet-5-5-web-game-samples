// キーボード・タッチ入力

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export class Input {
  constructor({ onPress, onBlur }) {
    this.keys = new Set();
    this.touch = { left: false, right: false, gas: false, brake: false };
    this.onPress = onPress;
    this.onBlur = onBlur;

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (PREVENT.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.repeat) return;
      this.onPress(e.code, e);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => this.blur());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.blur();
    });
  }

  blur() {
    this.clear();
    if (this.onBlur) this.onBlur();
  }

  clear() {
    this.keys.clear();
    this.touch.left = this.touch.right = this.touch.gas = this.touch.brake = false;
    for (const b of document.querySelectorAll('#touch .tbtn.on')) b.classList.remove('on');
  }

  get throttle() { return this.keys.has('ArrowUp') || this.keys.has('KeyW') || this.touch.gas; }
  get brake() { return this.keys.has('ArrowDown') || this.keys.has('KeyS') || this.touch.brake; }
  get left() { return this.keys.has('ArrowLeft') || this.keys.has('KeyA') || this.touch.left; }
  get right() { return this.keys.has('ArrowRight') || this.keys.has('KeyD') || this.touch.right; }
}

// タッチ端末用の画面ボタン(押している間だけ有効)
export function setupTouch(input, { onTap, onPauseButton }) {
  const root = document.getElementById('touch');
  if (!root) return;
  const mq = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
  const apply = () => root.classList.toggle('show', !!(mq && mq.matches));
  apply();
  if (mq && mq.addEventListener) mq.addEventListener('change', apply);

  const bind = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    const set = (v) => {
      input.touch[key] = v;
      el.classList.toggle('on', v);
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* 何もしない */ }
      set(true);
      onTap(false);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      el.addEventListener(ev, () => set(false));
    }
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  bind('tc-left', 'left');
  bind('tc-right', 'right');
  bind('tc-gas', 'gas');
  bind('tc-brake', 'brake');
  const pause = document.getElementById('tc-pause');
  if (pause) {
    pause.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onTap(false);
      onPauseButton();
    });
  }
}
