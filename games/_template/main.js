// Game skeleton: fixed-timestep loop, keyboard input, pause/restart.
// Replace the state/update/render bodies with the actual game.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const { width: W, height: H } = canvas;

const STEP = 1000 / 60; // fixed update step (ms)

const keys = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyP') paused = !paused;
  if (e.code === 'KeyR') state = createState();
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => {
  keys.clear();
  paused = true;
});

let paused = false;
let state = createState();

function createState() {
  return { x: W / 2, y: H / 2, size: 24, speed: 3 };
}

function update() {
  const dx = (keys.has('ArrowRight') || keys.has('KeyD')) - (keys.has('ArrowLeft') || keys.has('KeyA'));
  const dy = (keys.has('ArrowDown') || keys.has('KeyS')) - (keys.has('ArrowUp') || keys.has('KeyW'));
  const len = Math.hypot(dx, dy) || 1;
  state.x = clamp(state.x + (dx / len) * state.speed, state.size / 2, W - state.size / 2);
  state.y = clamp(state.y + (dy / len) * state.speed, state.size / 2, H - state.size / 2);
}

function render() {
  ctx.fillStyle = '#12141a';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#5eead4';
  ctx.fillRect(state.x - state.size / 2, state.y - state.size / 2, state.size, state.size);
  if (paused) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W / 2, H / 2);
  }
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

let last = performance.now();
let acc = 0;
function frame(now) {
  // Cap the delta so returning from a background tab doesn't cause a burst of updates.
  acc += Math.min(now - last, 100);
  last = now;
  while (acc >= STEP) {
    if (!paused) update();
    acc -= STEP;
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
