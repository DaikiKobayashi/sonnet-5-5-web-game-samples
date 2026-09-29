// Keyboard + touch input. Keys are identified by KeyboardEvent.code.

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
const ACTIONS = {
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'confirm',
  KeyP: 'pause',
  Escape: 'escape',
  KeyR: 'restart',
  KeyQ: 'quit',
  KeyM: 'mute',
  KeyF: 'fullscreen',
};

export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = { up: false, down: false, left: false, right: false };
    this.onAction = null; // (name, event)
    this.onAnyInput = null; // first-gesture hook (audio unlock)
    this.attached = false;
  }

  get up() { return this.keys.has('ArrowUp') || this.keys.has('KeyW') || this.touch.up; }
  get down() { return this.keys.has('ArrowDown') || this.keys.has('KeyS') || this.touch.down; }
  get left() { return this.keys.has('ArrowLeft') || this.keys.has('KeyA') || this.touch.left; }
  get right() { return this.keys.has('ArrowRight') || this.keys.has('KeyD') || this.touch.right; }

  clear() {
    this.keys.clear();
    this.touch.up = this.touch.down = this.touch.left = this.touch.right = false;
    if (this.onClear) this.onClear();
  }

  attach() {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts alone
      if (PREVENT.has(e.code)) e.preventDefault();
      if (this.onAnyInput) this.onAnyInput(e);
      this.keys.add(e.code);
      if (!e.repeat) {
        const a = ACTIONS[e.code];
        if (a && this.onAction) this.onAction(a, e);
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear();
    });
  }
}

// On-screen buttons for touch devices ((pointer: coarse) only). Pressed only while a pointer is down.
export function setupTouch(input) {
  const root = document.getElementById('touch');
  if (!root) return;
  const mq = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
  const apply = () => { root.hidden = !(mq && mq.matches); };
  apply();
  if (mq && mq.addEventListener) mq.addEventListener('change', apply);
  const map = { left: 'left', right: 'right', gas: 'up', brake: 'down' };
  const active = new Map(); // pointerId -> key
  const release = (id) => {
    const k = active.get(id);
    if (!k) return;
    active.delete(id);
    // another pointer might still hold the same key
    let still = false;
    for (const v of active.values()) if (v === k) still = true;
    if (!still) input.touch[k] = false;
    for (const el of root.querySelectorAll('.tbtn')) {
      const key = map[el.dataset.btn];
      let on = false;
      for (const v of active.values()) if (v === key) on = true;
      el.classList.toggle('on', on);
    }
  };
  for (const el of root.querySelectorAll('.tbtn')) {
    const key = map[el.dataset.btn];
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (input.onAnyInput) input.onAnyInput(e);
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      active.set(e.pointerId, key);
      input.touch[key] = true;
      el.classList.add('on');
    });
    const up = (e) => release(e.pointerId);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  input.onClear = () => {
    active.clear();
    for (const el of root.querySelectorAll('.tbtn')) el.classList.remove('on');
  };
}
