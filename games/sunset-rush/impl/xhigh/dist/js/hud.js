// HUD・各種オーバーレイの描画(テキストはすべて自作フォント font_pixel)

import { W, H, PLAYER_Z, STAGES, KMH } from './constants.js';
import { drawText, textWidth } from './font.js';
import { clamp, pad } from './util.js';
import { CP_BANNER_STEPS } from './game.js';

const OUTLINE = '#1a1030';

function txt(ctx, s, x, y, scale, color, align = 'left', extra = {}) {
  drawText(ctx, s, x, y, { scale, color, outline: OUTLINE, align, ...extra });
}

const p2 = (n) => pad(n, 2);
const p6 = (n) => pad(n, 6);

// ---------------------------------------------------------------- HUD

export function drawHud(ctx, game) {
  const score = Math.floor(game.score);
  const bestShown = Math.max(game.best, score);

  // 上部に薄い影を敷いて読みやすくする
  const grad = ctx.createLinearGradient(0, 0, 0, 72);
  grad.addColorStop(0, 'rgba(10,6,30,0.5)');
  grad.addColorStop(1, 'rgba(10,6,30,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 72);

  // TIME
  txt(ctx, 'TIME', 8, 6, 2, '#ffe066');
  const low = game.timeLeft <= 10 && game.scene !== 'countdown';
  let timeCol = '#ffffff';
  let timeAlpha = 1;
  if (low) {
    timeCol = '#ff3a3a';
    timeAlpha = Math.floor(game.tick / 15) % 2 === 0 ? 1 : 0.35;
  }
  txt(ctx, p2(Math.ceil(Math.max(0, game.timeLeft) - 1e-9)), 8, 22, 4, timeCol, 'left', { alpha: timeAlpha });

  // SCORE
  txt(ctx, 'SCORE', W / 2, 6, 2, '#ffe066', 'center');
  txt(ctx, p6(score), W / 2, 22, 3, '#ffffff', 'center');

  // STAGE / BEST
  txt(ctx, `STAGE ${game.stage}/3`, 632, 6, 2, '#ffe066', 'right');
  txt(ctx, `BEST ${p6(bestShown)}`, 632, 24, 2, '#ffffff', 'right');

  // 進捗バー
  const bx = 120; const by = 54; const bw = 400; const bh = 8;
  const goalZ = game.course.goalZ;
  const frac = clamp((game.pos + PLAYER_Z) / goalZ, 0, 1);
  ctx.fillStyle = 'rgba(8,6,28,0.7)';
  ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
  ctx.fillStyle = '#3a3060';
  ctx.fillRect(bx, by, bw, bh);
  const fw = Math.round(bw * frac);
  ctx.fillStyle = '#ff9a2e';
  ctx.fillRect(bx, by, fw, bh);
  ctx.fillStyle = '#ffe08a';
  ctx.fillRect(bx, by, fw, 2);
  ctx.fillStyle = '#d8582a';
  ctx.fillRect(bx, by + bh - 2, fw, 2);
  for (const z of game.course.cpZ) {
    const x = bx + Math.round((z / goalZ) * bw);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x - 1, by - 4, 4, bh + 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, by - 3, 2, bh + 6);
  }
  // ゴールの旗
  const fx = bx + bw + 6;
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(fx - 1, by - 7, 3, 21);
  ctx.fillStyle = '#e8e8f0';
  ctx.fillRect(fx, by - 6, 1, 19);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(fx + 1, by - 7, 14, 11);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) {
    ctx.fillStyle = (i + j) % 2 ? '#15151f' : '#f6f6fa';
    ctx.fillRect(fx + 2 + i * 2, by - 6 + j * 2, 2, 2);
  }
  txt(ctx, 'F', fx + 18, by, 1, '#ffffff');
  // 現在位置の三角マーカー
  const mx = bx + fw;
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.moveTo(mx - 6, by - 11); ctx.lineTo(mx + 6, by - 11); ctx.lineTo(mx, by - 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(mx - 4, by - 10); ctx.lineTo(mx + 4, by - 10); ctx.lineTo(mx, by - 3);
  ctx.closePath();
  ctx.fill();

  // 左下: PASSED / ミュート
  txt(ctx, `PASSED ${game.overtakes}`, 8, 330, 2, '#ffffff');
  txt(ctx, game.muted ? '[M] SOUND OFF' : '[M] SOUND ON', 8, 346, 1, '#c8c0ff');

  // 右下: 速度
  const kmh = Math.round(game.speed / KMH);
  txt(ctx, String(kmh), 600, 314, 4, '#ffffff', 'right');
  txt(ctx, 'KM/H', 632, 344, 2, '#ffe066', 'right');
  drawBanners(ctx, game);
}

function drawBanners(ctx, game) {
  // GO!
  if (game.scene === 'playing' && game.goBanner > 0) {
    const s = 8; // 拡大は整数倍 1〜8
    const a = game.goBanner < 10 ? game.goBanner / 10 : 1;
    txt(ctx, 'GO!', W / 2, 188 - 3.5 * s, s, '#7cff8a', 'center', { alpha: a });
  }
  // チェックポイント
  if (game.cpBanner > 0) {
    const a = game.cpBanner < 20 ? game.cpBanner / 20 : 1;
    const flash = (CP_BANNER_STEPS - game.cpBanner) < 30 && Math.floor(game.cpBanner / 4) % 2 === 0;
    txt(ctx, 'CHECKPOINT!', W / 2, 92, 3, flash ? '#ffffff' : '#7cffb0', 'center', { alpha: a });
    txt(ctx, `+${game.cpBannerSec} SEC`, W / 2, 122, 2, '#ffe066', 'center', { alpha: a });
  }
  // ポップアップ(+50 など)
  for (const p of game.popups) {
    const a = p.age > p.life * 0.6 ? 1 - (p.age - p.life * 0.6) / (p.life * 0.4) : 1;
    txt(ctx, p.text, p.x, Math.round(p.y), 2, p.color, 'center', { alpha: clamp(a, 0, 1) });
  }
}

// ---------------------------------------------------------------- カウントダウン

export function drawStageIntro(ctx, game) {
  const st = STAGES[game.stage - 1];
  const a = game.sceneTimer > 44 ? (60 - game.sceneTimer) / 16 : 1;
  txt(ctx, `STAGE ${game.stage}`, W / 2, 74, 2, '#ffe066', 'center', { alpha: a });
  txt(ctx, st.name, W / 2, 92, 3, '#ffffff', 'center', { alpha: a });
}

export function drawCountdown(ctx, game) {
  const step = game.sceneTimer;
  const digit = 3 - Math.min(2, Math.floor(step / 60));
  const inSec = step % 60;
  const s = inSec < 8 ? 8 : 6;
  drawStageIntro(ctx, { stage: game.stage, sceneTimer: 0 });
  txt(ctx, String(digit), W / 2, 188 - 3.5 * s, s, '#ffffff', 'center');
  drawSignal(ctx, W / 2, 132, 4 - digit);
}

// 信号ライト(S-17): lit = 点灯数(1〜3)。4 で緑
function drawSignal(ctx, cx, cy, lit) {
  ctx.fillStyle = 'rgba(8,6,28,0.85)';
  ctx.fillRect(cx - 36, cy - 12, 72, 24);
  ctx.fillStyle = '#4a4470';
  ctx.fillRect(cx - 36, cy - 12, 72, 2);
  for (let i = 0; i < 3; i++) {
    const x = cx - 22 + i * 22;
    let on = false;
    let col = '#ff3a3a';
    if (lit >= 4) { on = true; col = '#4aff8a'; } else on = i < lit;
    ctx.fillStyle = on ? col : '#2a2440';
    ctx.beginPath();
    ctx.arc(x, cy, 7, 0, Math.PI * 2);
    ctx.fill();
    if (on) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x - 3, cy - 4, 3, 2);
    }
  }
}

export function drawGoSignal(ctx) {
  drawSignal(ctx, W / 2, 132, 4);
}

// ---------------------------------------------------------------- タイトル

export function drawTitle(ctx, game, assets, wall) {
  const logo = assets.byId.logo_title;
  // ロゴ: ふわふわ動き + 光がなめる
  const bob = Math.round(Math.sin(wall * 2.2) * 3);
  if (!drawTitle.shine) {
    drawTitle.shine = document.createElement('canvas');
    drawTitle.shine.width = logo.fw;
    drawTitle.shine.height = logo.fh;
  }
  const sc = drawTitle.shine;
  const g = sc.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, sc.width, sc.height);
  g.imageSmoothingEnabled = false;
  g.drawImage(logo.cv, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  const sx = ((wall * 70) % 420) - 90;
  const gr = g.createLinearGradient(sx, 0, sx + 40, 24);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.75)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, sc.width, sc.height);
  g.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sc, 0, 0, logo.fw, logo.fh, W / 2 - logo.fw, 14 + bob, logo.fw * 2, logo.fh * 2);

  // 文字の背に薄い帯を敷いて読みやすくする
  const band = ctx.createLinearGradient(0, 160, 0, 264);
  band.addColorStop(0, 'rgba(10,6,30,0)');
  band.addColorStop(0.16, 'rgba(10,6,30,0.5)');
  band.addColorStop(0.84, 'rgba(10,6,30,0.5)');
  band.addColorStop(1, 'rgba(10,6,30,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, 160, W, 104);
  txt(ctx, 'CHASE THE SUN. BEAT THE CLOCK.', W / 2, 168, 2, '#ffe8b0', 'center');

  // 0.5 秒周期の点滅(0.35 秒表示・0.15 秒非表示)
  if (wall % 0.5 < 0.35) {
    txt(ctx, 'PRESS ENTER', W / 2, 204, 3, '#ffffff', 'center');
  }
  txt(ctx, `BEST ${p6(game.best)}`, W / 2, 238, 2, '#ffe066', 'center');

  // 操作説明
  ctx.fillStyle = 'rgba(8,6,28,0.72)';
  ctx.fillRect(0, 292, W, 56);
  txt(ctx, 'UP/W GAS   DOWN/S BRAKE   LEFT-RIGHT/AD STEER', W / 2, 298, 2, '#ffffff', 'center', { outline: '#000000' });
  txt(ctx, 'P PAUSE    R RESTART      M SOUND', W / 2, 320, 2, '#c8c0ff', 'center', { outline: '#000000' });
}

// ---------------------------------------------------------------- 一時停止

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(6,4,20,0.6)';
  ctx.fillRect(0, 0, W, H);
  txt(ctx, 'PAUSED', W / 2, 130, 4, '#ffffff', 'center');
  txt(ctx, 'P/ESC: RESUME   R: RESTART   Q: TITLE', W / 2, 180, 2, '#ffe066', 'center');
}

// ---------------------------------------------------------------- ステージクリア

export function drawStageClear(ctx, game, wall) {
  const c = game.clear;
  if (!c) return;
  if (!c.panel) {
    const s = 8;
    const bob = Math.round(Math.sin(game.sceneTimer / 5) * 3);
    txt(ctx, 'GOAL!', W / 2, 120 + bob, s, '#ffe066', 'center');
    return;
  }
  const px = 140; const py = 70; const pw = 360; const ph = 210;
  ctx.fillStyle = 'rgba(8,6,28,0.85)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#ffd05a';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
  ctx.strokeStyle = '#7a5ac8';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 5.5, py + 5.5, pw - 11, ph - 11);

  const e = clamp(c.panelT / 40, 0, 1);
  const ease = 1 - (1 - e) * (1 - e);
  const tb = Math.round(c.timeBonus * ease);
  const sb = Math.round(c.stageBonus * ease);
  const total = c.scoreBefore + Math.round((c.timeBonus + c.stageBonus) * ease);
  const sp = (n) => String(n).padStart(6, ' ');
  const x0 = px + 18;
  txt(ctx, `STAGE ${c.stage} CLEAR!`, W / 2, py + 16, 3, '#ffe066', 'center');
  txt(ctx, `TIME LEFT ${String(c.timeLeft).padStart(3, ' ')}  X100 = ${sp(tb)}`, x0, py + 66, 2, '#ffffff');
  txt(ctx, `STAGE BONUS         = ${sp(sb)}`, x0, py + 92, 2, '#ffffff');
  txt(ctx, `SCORE               = ${p6(total)}`, x0, py + 118, 2, '#7cf5ff');
  txt(ctx, 'PRESS ENTER', W / 2, py + 166, 2, Math.floor(wall / 0.25) % 2 ? '#ffe066' : '#ffffff', 'center');
}

export function drawTimeUp(ctx) {
  txt(ctx, 'TIME UP', W / 2, 130, 8, '#ff5a5a', 'center');
}

// ---------------------------------------------------------------- ゲームオーバー / エンディング

function dim(ctx, a) {
  ctx.fillStyle = `rgba(6,4,20,${a})`;
  ctx.fillRect(0, 0, W, H);
}

export function drawGameOver(ctx, game, wall) {
  dim(ctx, 0.78);
  txt(ctx, 'GAME OVER', W / 2, 40, 6, '#ff5a5a', 'center');
  txt(ctx, `REACHED STAGE ${game.reachedStage}`, W / 2, 116, 2, '#ffffff', 'center');
  txt(ctx, 'SCORE', W / 2, 148, 2, '#ffe066', 'center');
  txt(ctx, p6(Math.floor(game.score)), W / 2, 168, 4, '#ffffff', 'center');
  txt(ctx, `BEST ${p6(game.best)}`, W / 2, 212, 2, '#7cf5ff', 'center');
  if (game.newBest) txt(ctx, 'NEW BEST!', W / 2, 240, 3, Math.floor(wall / 0.3) % 2 ? '#ffe066' : '#ff9a3a', 'center');
  txt(ctx, 'ENTER: RETRY   ESC: TITLE', W / 2, 300, 2, '#c8c0ff', 'center');
}

const RANK_COL = { S: '#ffd84a', A: '#ff7a9a', B: '#5af0ff', C: '#b8b4d0' };

// 紙吹雪(見た目専用。時間から決めるだけで乱数は使わない)
function confetti(ctx, wall) {
  const cols = ['#ffd84a', '#ff5ac8', '#5af0ff', '#7cff8a', '#ff8a3a'];
  for (let i = 0; i < 46; i++) {
    const h1 = (Math.imul(i + 1, 2654435761) >>> 8) / 16777216;
    const h2 = (Math.imul(i + 7, 2246822519) >>> 8) / 16777216;
    const h3 = (Math.imul(i + 13, 3266489917) >>> 8) / 16777216;
    const x = h1 * W + Math.sin(wall * (1 + h2) + i) * 14;
    const y = (h3 * H + wall * (36 + h2 * 60)) % (H + 10) - 5;
    ctx.fillStyle = cols[i % cols.length];
    const sz = 2 + (i % 3);
    ctx.fillRect(Math.round(x), Math.round(y), sz, sz + (i % 2));
  }
}

export function drawEnding(ctx, game, wall) {
  dim(ctx, 0.72);
  confetti(ctx, wall);
  const hue = Math.floor(wall * 6) % 2 === 0 ? '#ffe066' : '#ffb03a';
  txt(ctx, 'ALL CLEAR!', W / 2, 24, 6, hue, 'center');
  txt(ctx, 'TOTAL SCORE', W / 2, 88, 2, '#ffe066', 'center');
  txt(ctx, p6(Math.floor(game.score)), W / 2, 108, 4, '#ffffff', 'center');
  txt(ctx, 'RANK', W / 2, 150, 2, '#ffe066', 'center');
  const r = game.rank || 'C';
  txt(ctx, r, W / 2, 170, 8, RANK_COL[r], 'center');
  txt(ctx, `BEST ${p6(game.best)}`, W / 2, 240, 2, '#7cf5ff', 'center');
  if (game.newBest) txt(ctx, 'NEW BEST!', W / 2, 264, 3, Math.floor(wall / 0.3) % 2 ? '#ffe066' : '#ff9a3a', 'center');
  txt(ctx, 'PRESS ENTER', W / 2, 314, 3, Math.floor(wall / 0.25) % 2 ? '#ffe066' : '#ffffff', 'center');
}

export { textWidth };
