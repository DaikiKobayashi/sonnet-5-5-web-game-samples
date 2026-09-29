// HUD and full-screen overlays. Every string is drawn with the bitmap font (font.js).

import { W, H, SEG_LEN, PLAYER_Z, KMH, pad, clamp, CLEAR_PANEL_STEPS, COUNTDOWN_STEPS, GO_STEPS } from './config.js';
import { drawText, measure } from './font.js';

const OUT = '#1a0e2e';
const YEL = '#ffd94a';
const WHITE = '#ffffff';
const RED = '#ff3a3a';
const DRED = '#a81424';
const CYAN = '#63ecff';
const PINK = '#ff6ad0';
const GREEN = '#5cff8a';

function T(ctx, s, x, y, scale, color, align = 'left', extra = {}) {
  return drawText(ctx, s, x, y, { scale, color, outline: extra.outline === undefined ? OUT : extra.outline, align, alpha: extra.alpha });
}

function pixelDisc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y) + 0.3);
    ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

function panel(ctx, x, y, w, h, alpha = 0.82) {
  ctx.fillStyle = `rgba(10,6,30,${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = YEL;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillRect(x + w - 2, y, 2, h);
  ctx.fillStyle = '#8a5aff';
  ctx.fillRect(x + 4, y + 4, w - 8, 1);
  ctx.fillRect(x + 4, y + h - 5, w - 8, 1);
  ctx.fillRect(x + 4, y + 4, 1, h - 8);
  ctx.fillRect(x + w - 5, y + 4, 1, h - 8);
}

export class Hud {
  constructor(ctx, assets) {
    this.ctx = ctx;
    this.assets = assets;
    const logo = assets.get('logo_title');
    this.shine = document.createElement('canvas');
    this.shine.width = logo.canvas.width;
    this.shine.height = logo.canvas.height;
    this.fps = 0;
  }

  // ------------------------------------------------------------------ dispatcher
  draw(sim, opts = {}) {
    const ctx = this.ctx;
    const s = sim.scene;
    switch (s) {
      case 'title':
        this.drawTitle(sim);
        break;
      case 'countdown':
        this.drawHud(sim);
        this.drawCountdown(sim);
        break;
      case 'playing':
        this.drawHud(sim);
        this.drawPlayingOverlays(sim);
        break;
      case 'paused':
        this.drawHud(sim);
        this.drawPlayingOverlays(sim);
        this.drawPaused();
        break;
      case 'stageclear':
        this.drawHud(sim);
        this.drawStageClear(sim);
        break;
      case 'timeup':
        this.drawHud(sim);
        this.drawTimeUp(sim);
        break;
      case 'gameover':
        this.drawGameOver(sim);
        break;
      case 'ending':
        this.drawEnding(sim);
        break;
      default:
        break;
    }
    // short colour flashes: white on crashes, gold on checkpoints
    if (sim.flash && sim.flash.steps > 0 && (s === 'playing' || s === 'paused')) {
      const k = sim.flash.steps / sim.flash.max;
      ctx.fillStyle = sim.flash.kind === 'cp' ? `rgba(255,224,120,${0.28 * k})` : `rgba(255,255,255,${0.42 * k})`;
      ctx.fillRect(0, 0, W, H);
    }
    // fade in from black on major scene changes
    if (s === 'title' || s === 'countdown' || s === 'gameover' || s === 'ending') {
      const a = 1 - (sim.t - sim.sceneStartT) / 14;
      if (a > 0) {
        ctx.fillStyle = `rgba(0,0,0,${clamp(a, 0, 1)})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
    if (opts.showFps) T(ctx, 'FPS ' + Math.round(this.fps), 636, 350, 1, '#9dffb0', 'right');
  }

  // ------------------------------------------------------------------ HUD
  drawHud(sim) {
    const ctx = this.ctx;
    const score = sim.scoreInt;
    // soft scrim so the top HUD stays readable over bright gates / skies
    const sg = ctx.createLinearGradient(0, 0, 0, 74);
    sg.addColorStop(0, 'rgba(8,4,24,0.5)');
    sg.addColorStop(1, 'rgba(8,4,24,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, 74);
    // TIME
    T(ctx, 'TIME', 8, 6, 2, YEL);
    const sec = Math.max(0, Math.ceil(sim.timeLeft));
    let tcol = WHITE;
    if (sim.timeLeft <= 10) tcol = Math.floor(sim.t / 15) % 2 === 0 || sim.scene !== 'playing' ? RED : DRED;
    T(ctx, pad(sec, 2), 8, 22, 4, tcol);
    // SCORE
    T(ctx, 'SCORE', 320, 6, 2, YEL, 'center');
    T(ctx, pad(score, 6), 320, 22, 3, WHITE, 'center');
    // STAGE / BEST
    T(ctx, 'STAGE ' + sim.stage + '/3', 632, 6, 2, YEL, 'right');
    T(ctx, 'BEST ' + pad(Math.max(sim.best, score), 6), 632, 24, 2, WHITE, 'right');
    this.drawProgress(sim);
    // PASSED / mute
    T(ctx, 'PASSED ' + sim.overtakes, 8, 330, 2, WHITE);
    T(ctx, '[M] SOUND ' + (sim.muted ? 'OFF' : 'ON'), 8, 346, 1, sim.muted ? '#ff9a9a' : '#c8ffd8');
    // speed
    const kmh = Math.round(sim.speed / KMH);
    T(ctx, String(kmh), 600, 316, 4, kmh >= 250 ? '#ffb36a' : WHITE, 'right');
    T(ctx, 'KM/H', 600, 346, 2, YEL, 'right');
  }

  drawProgress(sim) {
    const ctx = this.ctx;
    const X = 120, Y = 54, BW = 400, BH = 8;
    const goalZ = sim.course.goalZ;
    const prog = clamp((sim.pos + PLAYER_Z) / goalZ, 0, 1);
    ctx.fillStyle = OUT;
    ctx.fillRect(X - 2, Y - 2, BW + 4, BH + 4);
    ctx.fillStyle = '#3b2c66';
    ctx.fillRect(X, Y, BW, BH);
    const w = Math.round(BW * prog);
    if (w > 0) {
      ctx.fillStyle = '#ff8a3c';
      ctx.fillRect(X, Y, w, BH);
      ctx.fillStyle = '#ffd35a';
      ctx.fillRect(X, Y, w, 3);
      ctx.fillStyle = '#e0522e';
      ctx.fillRect(X, Y + BH - 2, w, 2);
    }
    // checkpoints
    for (const z of sim.course.cpZ) {
      const cx = X + Math.round(BW * (z / goalZ));
      ctx.fillStyle = OUT;
      ctx.fillRect(cx - 2, Y - 4, 4, BH + 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 1, Y - 3, 2, BH + 6);
    }
    // goal flag
    const fx = X + BW + 2;
    ctx.fillStyle = OUT;
    ctx.fillRect(fx - 1, Y - 12, 12, 22);
    ctx.fillStyle = '#e8e8f0';
    ctx.fillRect(fx, Y - 11, 2, 20);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
      ctx.fillStyle = (i + j) % 2 ? '#1a1a26' : '#ffffff';
      ctx.fillRect(fx + 2 + i * 2, Y - 11 + j * 2, 2, 2);
    }
    // player marker (triangle above the bar)
    const mx = X + w;
    ctx.fillStyle = OUT;
    for (let r = 0; r < 6; r++) ctx.fillRect(mx - 5 + r, Y - 12 + r, 11 - r * 2, 1);
    ctx.fillStyle = '#ffffff';
    for (let r = 0; r < 5; r++) ctx.fillRect(mx - 4 + r, Y - 11 + r, 9 - r * 2, 1);
  }

  // GO!, checkpoint banner, stage title in the first seconds
  drawPlayingOverlays(sim) {
    const ctx = this.ctx;
    if (sim.playSteps < 60 + GO_STEPS) this.drawStageTitle(sim);
    if (sim.goSteps > 0) {
      const k = 1 - sim.goSteps / GO_STEPS;
      const scale = k < 0.12 ? 8 : k < 0.3 ? 7 : 6;
      const col = Math.floor(sim.t / 4) % 2 ? GREEN : '#eaffb0';
      const a = sim.goSteps < 10 ? sim.goSteps / 10 : 1;
      T(ctx, 'GO!', 320, 144 - (scale * 7) / 2 + 20, scale, col, 'center', { alpha: a });
    }
    const b = sim.banner;
    if (b) {
      const a = b.steps < 20 ? b.steps / 20 : 1;
      const slide = b.total - b.steps < 8 ? (8 - (b.total - b.steps)) * 6 : 0;
      T(ctx, 'CHECKPOINT!', 320, 100 - slide, 3, Math.floor(sim.t / 5) % 2 ? YEL : '#fff4a8', 'center', { alpha: a });
      T(ctx, '+' + b.sec + ' SEC', 320, 130 - slide, 2, CYAN, 'center', { alpha: a });
    }
  }

  drawStageTitle(sim) {
    const ctx = this.ctx;
    const a = sim.scene === 'countdown' ? 1 : clamp((60 + GO_STEPS - sim.playSteps) / 24, 0, 1);
    T(ctx, 'STAGE ' + sim.stage, 320, 64, 3, WHITE, 'center', { alpha: a });
    T(ctx, sim.def.name, 320, 92, 2, YEL, 'center', { alpha: a });
  }

  drawCountdown(sim) {
    const ctx = this.ctx;
    this.drawStageTitle(sim);
    const n = clamp(Math.floor(sim.sceneT / 60), 0, 2);
    const within = sim.sceneT % 60;
    const digit = 3 - n;
    const scale = within < 8 ? 8 : within < 18 ? 7 : 6;
    T(ctx, String(digit), 320, 150 - (scale * 7) / 2 + 10, scale, WHITE, 'center', { alpha: within > 50 ? 1 - (within - 50) / 20 : 1 });
    // signal lights
    const lit = digit === 3 ? 1 : digit === 2 ? 2 : 3;
    for (let i = 0; i < 3; i++) {
      const cx = 320 + (i - 1) * 30, cy = 124;
      pixelDisc(ctx, cx, cy, 11, '#0c0818');
      pixelDisc(ctx, cx, cy, 9, '#2a2038');
      if (i < lit) {
        pixelDisc(ctx, cx, cy, 9, '#ff2a2a');
        pixelDisc(ctx, cx - 3, cy - 3, 3, '#ff9a8a');
      }
    }
  }

  drawPaused() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(6,3,20,0.6)';
    ctx.fillRect(0, 0, W, H);
    T(ctx, 'PAUSED', 320, 140, 4, WHITE, 'center');
    T(ctx, 'P/ESC: RESUME   R: RESTART   Q: TITLE', 320, 190, 2, YEL, 'center');
  }

  drawStageClear(sim) {
    const ctx = this.ctx;
    const t = sim.sceneT;
    if (t < CLEAR_PANEL_STEPS) {
      const pulse = Math.floor(t / 6) % 2;
      T(ctx, 'GOAL!', 320, 128, 8, pulse ? '#fff4a8' : YEL, 'center');
      return;
    }
    const c = sim.clear;
    const k = clamp((t - CLEAR_PANEL_STEPS) / 45, 0, 1);
    const ease = 1 - (1 - k) * (1 - k);
    const px = 128, py = 76, pw = 384, ph = 216;
    panel(ctx, px, py, pw, ph);
    T(ctx, 'STAGE ' + c.stage + ' CLEAR!', 320, py + 16, 3, YEL, 'center');
    const tb = Math.round(c.timeBonus * ease);
    const sb = Math.round(c.stageBonus * ease);
    const sc = Math.round(c.scoreBefore + (c.score - c.scoreBefore) * ease);
    const x = px + 12;
    T(ctx, 'TIME LEFT   ' + pad(c.timeLeft, 2) + '  X100  = ' + tb, x, py + 62, 2, WHITE);
    T(ctx, 'STAGE BONUS           = ' + sb, x, py + 92, 2, WHITE);
    T(ctx, 'SCORE                 = ' + pad(sc, 6), x, py + 122, 2, CYAN);
    const pulse = k >= 1 && Math.floor(t / 15) % 2 === 0 ? 1 : 0.4;
    T(ctx, 'PRESS ENTER', 320, py + ph - 38, 2, YEL, 'center', { alpha: pulse });
  }

  drawTimeUp(sim) {
    const ctx = this.ctx;
    const pulse = Math.floor(sim.sceneT / 8) % 2;
    ctx.fillStyle = 'rgba(30,0,10,0.28)';
    ctx.fillRect(0, 0, W, H);
    T(ctx, 'TIME UP', 320, 128, 8, pulse ? RED : '#ff8a8a', 'center');
  }

  drawGameOver(sim) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(6,3,20,0.86)';
    ctx.fillRect(0, 0, W, H);
    const score = sim.scoreInt;
    T(ctx, 'GAME OVER', 320, 44, 6, RED, 'center');
    T(ctx, 'REACHED STAGE ' + sim.stage, 320, 112, 3, WHITE, 'center');
    T(ctx, 'SCORE ' + pad(score, 6), 320, 156, 4, YEL, 'center');
    T(ctx, 'BEST ' + pad(sim.best, 6), 320, 204, 3, WHITE, 'center');
    if (sim.newBest) T(ctx, 'NEW BEST!', 320, 240, 3, Math.floor(sim.t / 12) % 2 === 0 ? PINK : YEL, 'center');
    T(ctx, 'ENTER: RETRY   ESC: TITLE', 320, 300, 2, CYAN, 'center');
  }

  drawEnding(sim) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(6,3,20,0.84)';
    ctx.fillRect(0, 0, W, H);
    const score = sim.scoreInt;
    T(ctx, 'ALL CLEAR!', 320, 22, 6, Math.floor(sim.t / 10) % 2 ? YEL : '#fff4a8', 'center');
    T(ctx, 'SCORE ' + pad(score, 6), 320, 80, 3, WHITE, 'center');
    T(ctx, 'RANK', 320, 116, 2, CYAN, 'center');
    const rc = { S: '#ffd94a', A: '#ff6a7a', B: '#63ecff', C: '#b8b8d8' }[sim.rank] || WHITE;
    T(ctx, sim.rank || 'C', 320, 136, 8, rc, 'center');
    T(ctx, 'BEST ' + pad(sim.best, 6), 320, 206, 2, WHITE, 'center');
    if (sim.newBest) T(ctx, 'NEW BEST!', 320, 234, 3, Math.floor(sim.t / 12) % 2 === 0 ? PINK : YEL, 'center');
    T(ctx, 'PRESS ENTER', 320, 296, 3, YEL, 'center', { alpha: Math.floor(sim.t / 20) % 2 === 0 ? 1 : 0.4 });
  }

  // ------------------------------------------------------------------ title
  drawTitle(sim) {
    const ctx = this.ctx;
    const A = this.assets;
    const t = sim.t;
    // soften the lower half so the text reads over the moving road
    const g = ctx.createLinearGradient(0, 140, 0, 360);
    g.addColorStop(0, 'rgba(8,4,24,0)');
    g.addColorStop(0.16, 'rgba(8,4,24,0.4)');
    g.addColorStop(0.5, 'rgba(8,4,24,0.5)');
    g.addColorStop(1, 'rgba(8,4,24,0.66)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 140, W, 220);

    const logo = A.get('logo_title');
    const bob = Math.round(Math.sin(t / 34) * 3);
    const lx = 320 - logo.w, ly = 22 + bob;
    // sweeping shine, clipped to the logo's own pixels
    const cycle = t % 260;
    const sg = this.shine.getContext('2d');
    sg.globalCompositeOperation = 'source-over';
    sg.clearRect(0, 0, this.shine.width, this.shine.height);
    sg.drawImage(logo.canvas, 0, 0);
    if (cycle < 60) {
      const cx = -30 + (cycle / 60) * (logo.w + 80);
      sg.globalCompositeOperation = 'source-atop';
      const gr = sg.createLinearGradient(cx - 14, 0, cx + 14, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0.85)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      sg.fillStyle = gr;
      sg.save();
      sg.translate(cx, 0);
      sg.transform(1, 0, -0.35, 1, 0, 0);
      sg.translate(-cx, 0);
      sg.fillRect(cx - 14, 0, 28, this.shine.height);
      sg.restore();
    }
    ctx.drawImage(this.shine, 0, 0, logo.w, logo.h, lx, ly, logo.w * 2, logo.h * 2);

    T(ctx, 'CHASE THE SUN. BEAT THE CLOCK.', 320, 162, 2, '#ffe9a8', 'center');
    const on = Math.floor(t / 15) % 2 === 0;
    T(ctx, 'PRESS ENTER', 320, 200, 3, on ? WHITE : '#c8c0e0', 'center', { alpha: on ? 1 : 0.22 });
    T(ctx, 'BEST ' + pad(sim.best, 6), 320, 236, 2, YEL, 'center');
    T(ctx, 'UP/W GAS   DOWN/S BRAKE   LEFT-RIGHT/AD STEER', 320, 288, 2, '#e8e0ff', 'center');
    T(ctx, 'P PAUSE    R RESTART      M SOUND', 320, 310, 2, '#e8e0ff', 'center');
    T(ctx, '[M] SOUND ' + (sim.muted ? 'OFF' : 'ON'), 8, 346, 1, sim.muted ? '#ff9a9a' : '#c8ffd8');
  }
}
