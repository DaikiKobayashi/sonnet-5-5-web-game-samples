// Keyboard (KeyboardEvent.code) + optional touch buttons.

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export class Input {
  constructor() {
    this.keys = new Set();
    this.virtual = new Set();
    this.presses = []; // one-shot key codes (keydown without repeat)
    window.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.presses.push(e.code);
    });
    window.addEventListener('keyup', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
  }

  clear() {
    this.keys.clear();
    this.virtual.clear();
    this.presses.length = 0;
  }

  down(code) {
    return this.keys.has(code) || this.virtual.has(code);
  }

  get throttle() { return this.down('ArrowUp') || this.down('KeyW'); }
  get brake() { return this.down('ArrowDown') || this.down('KeyS'); }
  get left() { return this.down('ArrowLeft') || this.down('KeyA'); }
  get right() { return this.down('ArrowRight') || this.down('KeyD'); }

  // Consume all pending one-shot presses.
  takePresses() {
    const p = this.presses;
    this.presses = [];
    return p;
  }

  // Touch buttons (Should): only on coarse-pointer devices.
  setupTouch(container, onTap) {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (!coarse) return;
    container.hidden = false;
    for (const btn of container.querySelectorAll('[data-key]')) {
      const code = btn.dataset.key;
      const press = (e) => { e.preventDefault(); this.virtual.add(code); btn.classList.add('on'); };
      const release = (e) => { if (e) e.preventDefault(); this.virtual.delete(code); btn.classList.remove('on'); };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    const canvas = document.getElementById('game');
    canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); onTap(); });
  }
}
