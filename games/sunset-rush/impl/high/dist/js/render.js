// 疑似 3D 描画・HUD・オーバーレイ
import * as C from './const.js';
import { STAGES } from './course.js';
import { ASSETS } from './assets.js';
import { drawText, textWidth } from './font.js';
import { hexToRgb, mixRgb, rgbStr, lerp, clamp } from './util.js';

const { W, H } = C;
const HALF_W = W / 2, HALF_H = H / 2;

function fogAmount(n) {
  const t = clamp((n - 20) / 180, 0, 1);
  return Math.pow(t, 1.5) * 0.8;
}

function pad(n, d) {
  return String(Math.max(0, Math.floor(n))).padStart(d, '0');
}

export class Renderer {
  constructor(g) {
    this.g = g;
    this.fog = [];
    for (const st of STAGES) {
      const fogC = hexToRgb(st.pal.fog);
      const tbl = [];
      for (let n = 0; n < C.DRAW_DIST; n++) {
        const f = fogAmount(n);
        const m = (h) => rgbStr(mixRgb(hexToRgb(h), fogC, f));
        tbl.push({ grass: [m(st.pal.grass[0]), m(st.pal.grass[1])], rumble: [m(st.pal.rumble[0]), m(st.pal.rumble[1])], road: [m(st.pal.road[0]), m(st.pal.road[1])], lane: m(st.pal.lane), f });
      }
      tbl.base = rgbStr(mixRgb(hexToRgb(st.pal.grass[0]), fogC, 0.85));
      this.fog.push(tbl);
    }
    this.buckets = Array.from({ length: C.DRAW_DIST }, () => []);
    this.prevPX = 0;
    this.playerDir = 0;
    // ヘッドライトの照射(ステージ 3)
    const gr = g.createLinearGradient(0, 336, 0, 190);
    gr.addColorStop(0, 'rgba(255,244,190,0.13)');
    gr.addColorStop(1, 'rgba(255,244,190,0)');
    this.headGrad = gr;
    this.lineSeed = 0;
  }

  // ---------- 全体 ----------
  render(game, fps) {
    const g = this.g;
    g.imageSmoothingEnabled = false;
    const sc = game.scene;
    g.save();
    if (game.shake > 0 && sc !== 'paused') {
      const a = Math.ceil(game.shake * 12);
      g.translate(Math.round((Math.random() - 0.5) * a), Math.round((Math.random() - 0.5) * a));
    }
    this.drawWorld(game);
    this.drawPlayer(game);
    this.drawFx(game);
    g.restore();
    if (sc !== 'title' && sc !== 'gameover' && sc !== 'ending') this.drawHud(game);
    this.drawOverlays(game);
    if (game.debugOn && fps) drawText(g, `${Math.round(fps)}FPS`, 636, 350, 1, '#9fff9f', { align: 'right' });
  }

  drawLayer(img, y, off) {
    const g = this.g;
    const o = Math.round(((off % 640) + 640) % 640);
    g.drawImage(img.canvas, -o, y);
    g.drawImage(img.canvas, 640 - o, y);
  }

  // ---------- 道路 ----------
  drawWorld(game) {
    const g = this.g;
    const stage = game.stage;
    const co = game.course, segs = co.segs;
    const st = stage - 1;
    const tbl = this.fog[st];
    // 背景
    g.fillStyle = tbl.base;
    g.fillRect(0, C.HORIZON, W, H - C.HORIZON);
    this.drawLayer(ASSETS['bg_sky_' + stage], 0, game.layer.sky);
    this.drawLayer(ASSETS['bg_far_' + stage], 180 - 96, game.layer.far);
    this.drawLayer(ASSETS['bg_near_' + stage], 180 - 56, game.layer.near);
    // 投影
    const pos = game.pos, playerX = game.playerX;
    const baseIdx = Math.floor(pos / C.SEG_LEN);
    const basePercent = (pos % C.SEG_LEN) / C.SEG_LEN;
    const baseSeg = segs[baseIdx];
    if (!baseSeg) return;
    const playerZ = pos + C.PLAYER_Z;
    const pSeg = segs[Math.floor(playerZ / C.SEG_LEN)] || baseSeg;
    const pPercent = (playerZ % C.SEG_LEN) / C.SEG_LEN;
    const playerY = lerp(pSeg.p1.y, pSeg.p2.y, pPercent);
    const camY = C.CAM_HEIGHT + playerY;
    let maxY = H, x = 0, dx = -baseSeg.curve * basePercent;
    let count = 0;
    for (let n = 0; n < C.DRAW_DIST; n++) {
      const seg = segs[baseIdx + n];
      if (!seg) break;
      count = n + 1;
      seg.clipY = maxY;
      this.project(seg.p1, playerX * C.ROAD_HALF - x, camY, pos);
      this.project(seg.p2, playerX * C.ROAD_HALF - x - dx, camY, pos);
      x += dx;
      dx += seg.curve;
      seg.visible = !(seg.p1.camZ <= C.CAM_DEPTH || seg.p2.screenY >= seg.p1.screenY || seg.p2.screenY >= maxY);
      if (seg.visible) maxY = seg.p1.screenY;
    }
    // スプライト振り分け
    for (const b of this.buckets) b.length = 0;
    const put = (id, z, off, ww, kind, obj) => {
      const s = Math.floor(z / C.SEG_LEN);
      const n = s - baseIdx;
      if (n < 0 || n >= count) return;
      this.buckets[n].push({ a: ASSETS[id], z, off, ww, kind, obj });
    };
    for (const it of game.scenery) {
      if (it.z < pos - 400) continue;
      if (it.z > pos + C.DRAW_DIST * C.SEG_LEN) break;
      put(it.id, it.z, it.offset, it.worldW, it.id === 'rs_lamp' ? 'lamp' : it.id === 'rs_neon' ? 'neon' : 0);
    }
    for (const gt of game.gates) put(gt.id, gt.z, 0, 2.6, 0);
    for (const c of game.traffic) put(c.id, c.z, c.x, c.worldW, 'car');
    // 遠→近の順に描く
    const night = stage === 3;
    for (let n = count - 1; n >= 0; n--) {
      const seg = segs[baseIdx + n];
      if (seg.visible) this.drawSeg(seg, tbl[n]);
      const list = this.buckets[n];
      if (list.length) {
        const f = tbl[n].f;
        const alpha = n > 70 ? 1 - f * 0.9 : 1;
        g.globalAlpha = alpha;
        for (const s of list) this.drawSprite(seg, s, night);
        g.globalAlpha = 1;
      }
    }
    // ヘッドライト
    if (night && (game.scene === 'playing' || game.scene === 'countdown' || game.scene === 'stageclear' || game.scene === 'timeup')) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = this.headGrad;
      g.beginPath();
      g.moveTo(292, 338); g.lineTo(348, 338); g.lineTo(372, 196); g.lineTo(268, 196);
      g.closePath();
      g.fill();
      g.restore();
    }
    // スピード線
    if (game.scene === 'playing' && game.speed / C.KMH >= 250) {
      g.fillStyle = 'rgba(255,255,255,0.28)';
      const k = (game.speed / C.KMH - 250) / 50;
      const cnt = 8 + Math.round(10 * k);
      for (let i = 0; i < cnt; i++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = 140 + Math.random() * 150, r1 = r0 + 24 + Math.random() * 50;
        const cx = 320, cy = 200;
        const x0 = cx + Math.cos(a) * r0 * 1.5, y0 = cy + Math.sin(a) * r0 * 0.75;
        const x1 = cx + Math.cos(a) * r1 * 1.5, y1 = cy + Math.sin(a) * r1 * 0.75;
        g.strokeStyle = 'rgba(255,255,255,0.3)';
        g.beginPath(); g.moveTo(Math.round(x0) + 0.5, Math.round(y0) + 0.5); g.lineTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5); g.stroke();
      }
    }
  }

  project(p, cameraX, cameraY, cameraZ) {
    const camX = 0 - cameraX, camY = p.y - cameraY;
    p.camZ = p.z - cameraZ;
    const cz = p.camZ < 0.5 ? 0.5 : p.camZ;
    p.scale = C.CAM_DEPTH / cz;
    p.screenX = Math.round(HALF_W + p.scale * camX * HALF_W);
    p.screenY = Math.round(HALF_H - p.scale * camY * HALF_H);
    p.screenW = Math.round(p.scale * C.ROAD_HALF * HALF_W);
  }

  quad(xl1, xr1, y1, xl2, xr2, y2) {
    const g = this.g;
    g.beginPath();
    g.moveTo(xl1, y1); g.lineTo(xr1, y1); g.lineTo(xr2, y2); g.lineTo(xl2, y2);
    g.closePath();
    g.fill();
  }

  drawSeg(seg, pal) {
    const g = this.g;
    const p1 = seg.p1, p2 = seg.p2, b = seg.band;
    const y1 = p1.screenY + 1, y2 = p2.screenY;
    const x1 = p1.screenX, w1 = p1.screenW, x2 = p2.screenX, w2 = p2.screenW;
    g.fillStyle = pal.grass[b];
    g.fillRect(0, y2, W, y1 - y2);
    const r1 = w1 / 6, r2 = w2 / 6;
    g.fillStyle = pal.rumble[b];
    this.quad(x1 - w1 - r1, x1 - w1, y1, x2 - w2 - r2, x2 - w2, y2);
    this.quad(x1 + w1, x1 + w1 + r1, y1, x2 + w2, x2 + w2 + r2, y2);
    g.fillStyle = pal.road[b];
    this.quad(x1 - w1, x1 + w1, y1, x2 - w2, x2 + w2, y2);
    if (b === 0) {
      g.fillStyle = pal.lane;
      const l1 = w1 / 64, l2 = w2 / 64;
      for (const s of [-1, 1]) {
        const c1 = x1 + (s * w1) / 3, c2 = x2 + (s * w2) / 3;
        this.quad(c1 - l1, c1 + l1, y1, c2 - l2, c2 + l2, y2);
      }
    }
  }

  drawSprite(seg, s, night) {
    const g = this.g;
    const a = s.a;
    const percent = (s.z % C.SEG_LEN) / C.SEG_LEN;
    const p1 = seg.p1, p2 = seg.p2;
    const camZ = lerp(p1.camZ, p2.camZ, percent);
    if (camZ < 250) return;
    const sScale = lerp(p1.scale, p2.scale, percent);
    const sX = lerp(p1.screenX, p2.screenX, percent) + sScale * s.off * C.ROAD_HALF * HALF_W;
    const sY = lerp(p1.screenY, p2.screenY, percent);
    const roadW = sScale * C.ROAD_HALF * HALF_W;
    const destW = s.ww * roadW;
    if (destW < 1) return;
    const destH = destW * (a.fh / a.fw);
    const top = sY - destH;
    const visH = Math.min(destH, seg.clipY - top);
    if (visH <= 0) return;
    const srcH = Math.min(a.fh, (a.fh * visH) / destH);
    const dw = Math.max(1, Math.round(destW)), dx = Math.round(sX - destW / 2);
    const dy = Math.round(top), dh = Math.max(1, Math.round((visH / destH) * (destH)));
    g.drawImage(a.canvas, 0, 0, a.fw, srcH, dx, dy, dw, Math.max(1, Math.round(visH)));
    void dh;
    if (night && s.kind) {
      const glow = ASSETS._glow.canvas;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = g.globalAlpha * 0.9;
      if (s.kind === 'lamp') {
        const gs = destW * 2.4;
        g.drawImage(glow, dx + dw / 2 - gs / 2, dy + destH * 0.07 - gs / 2, gs, gs);
      } else if (s.kind === 'neon') {
        g.fillStyle = 'rgba(255,60,200,0.15)';
        const gs = destW * 1.9;
        g.globalAlpha = g.globalAlpha * 0.55;
        g.drawImage(glow, dx + dw / 2 - gs / 2, dy + destH * 0.34 - gs / 2, gs, gs);
      } else if (s.kind === 'car') {
        g.globalAlpha = g.globalAlpha * 0.8;
        g.fillStyle = 'rgba(255,40,40,1)';
        const gs = Math.max(3, destW * 0.35);
        g.drawImage(glow, dx + dw * 0.22 - gs / 2, dy + destH * 0.55 - gs / 2, gs, gs);
        g.drawImage(glow, dx + dw * 0.78 - gs / 2, dy + destH * 0.55 - gs / 2, gs, gs);
      }
      g.restore();
    }
  }

  // ---------- 自車 ----------
  drawPlayer(game) {
    const g = this.g;
    const sc = game.scene;
    if (sc === 'paused' || sc === 'title' || sc === 'gameover' || sc === 'ending') {
      // タイトルも自動走行の自車を表示
      if (sc !== 'title' && sc !== 'paused') return;
    }
    let dir = 0;
    if (sc === 'playing' || sc === 'paused') {
      const st = game.input ? game.input.steer : 0;
      dir = st < 0 ? 1 : st > 0 ? 2 : 0;
    } else if (sc === 'title') {
      const d = game.playerX - this.prevPX;
      dir = d < -0.002 ? 1 : d > 0.002 ? 2 : 0;
    }
    this.prevPX = game.playerX;
    if (game.invulnTimer > 0 && game.invulnTimer % 0.1 >= 0.05) return;
    const braking = (sc === 'playing' || sc === 'paused') && game.input && game.input.brake && !game.input.gas && game.speed > 0;
    const wf = game.speed > 0 ? Math.floor(game.animT / 0.1) % 2 : 0;
    const sheet = ASSETS._player[braking ? 'brake' : 'normal'][wf];
    const offroad = Math.abs(game.playerX) > 1;
    const bounce = game.speed > 0 ? Math.random() * (offroad ? 3 : 1) : 0;
    const by = Math.round(354 - bounce);
    g.save();
    if (game.invulnTimer > 0.9) {
      const ang = Math.sin((1.2 - game.invulnTimer) * 55) * 0.16;
      g.translate(320, by - 40);
      g.rotate(ang);
      g.drawImage(sheet, dir * 40, 0, 40, 22, -80, -48, 160, 88);
    } else {
      g.drawImage(sheet, dir * 40, 0, 40, 22, 240, by - 88, 160, 88);
    }
    g.restore();
  }

  drawFx(game) {
    const g = this.g;
    const smoke = ASSETS.fx_smoke, dust = ASSETS.fx_dust, spark = ASSETS.fx_spark;
    for (const p of game.fx.dust) {
      const f = Math.min(2, Math.floor((p.age / 0.35) * 3));
      g.globalAlpha = 1 - p.age / 0.4;
      g.drawImage(dust.canvas, f * 8, 0, 8, 8, Math.round(p.x - 8), Math.round(p.y - 8), 16, 16);
    }
    g.globalAlpha = 1;
    for (const p of game.fx.smoke) {
      const f = Math.min(3, Math.floor((p.age / 0.5) * 4));
      const y = p.y - 30 * p.age;
      g.drawImage(smoke.canvas, f * 12, 0, 12, 12, Math.round(p.x - 12), Math.round(y - 24), 24, 24);
    }
    for (const p of game.fx.sparks) {
      const f = Math.min(2, Math.floor((p.age / 0.3) * 3));
      g.drawImage(spark.canvas, f * 6, 0, 6, 6, Math.round(p.x), Math.round(p.y), 12, 12);
    }
    for (const p of game.fx.pops) {
      g.globalAlpha = clamp(1.4 - p.age / 0.9 * 1.0, 0, 1);
      drawText(g, p.text, p.x, p.y, 2, p.col, { align: 'center' });
    }
    g.globalAlpha = 1;
  }

  // ---------- HUD ----------
  drawHud(game) {
    const g = this.g;
    const blink = Math.floor(game.animT / 0.25) % 2 === 0;
    drawText(g, 'TIME', 8, 6, 2, '#ffe36a');
    const tl = Math.ceil(game.timeLeft);
    const low = game.timeLeft <= 10 && game.scene !== 'countdown';
    drawText(g, pad(tl, 2), 8, 22, 4, low ? (blink ? '#ff3b3b' : '#8a1a22') : '#ffffff');
    drawText(g, 'SCORE', 320, 6, 2, '#ffe36a', { align: 'center' });
    drawText(g, pad(game.score, 6), 320, 22, 3, '#ffffff', { align: 'center' });
    drawText(g, `STAGE ${game.stage}/3`, 632, 6, 2, '#ffe36a', { align: 'right' });
    drawText(g, `BEST ${pad(Math.max(game.best, game.score), 6)}`, 632, 24, 2, '#ffffff', { align: 'right' });
    // 進捗バー
    const st = game.course.st;
    const bx = 120, bw = 400, by = 54, bh = 8;
    g.fillStyle = 'rgba(8,4,20,0.75)';
    g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    g.fillStyle = 'rgba(70,60,100,0.9)';
    g.fillRect(bx, by, bw, bh);
    const prog = clamp((game.pos + C.PLAYER_Z) / game.course.goalZ, 0, 1);
    const fw = Math.round(bw * prog);
    g.fillStyle = '#ff9a3a';
    g.fillRect(bx, by, fw, bh);
    g.fillStyle = '#ffe36a';
    g.fillRect(bx, by, fw, 2);
    for (const s of st.cps) {
      const cx = Math.round(bx + (bw * s * C.SEG_LEN) / game.course.goalZ);
      g.fillStyle = '#ffffff';
      g.fillRect(cx, by - 3, 2, bh + 6);
    }
    drawText(g, 'F', bx + bw + 6, by - 3, 2, '#ffe36a');
    const mx = bx + fw;
    g.fillStyle = '#10081c';
    g.beginPath(); g.moveTo(mx - 6, by - 10); g.lineTo(mx + 6, by - 10); g.lineTo(mx, by - 1); g.closePath(); g.fill();
    g.fillStyle = '#ff3b6b';
    g.beginPath(); g.moveTo(mx - 4, by - 9); g.lineTo(mx + 4, by - 9); g.lineTo(mx, by - 2); g.closePath(); g.fill();
    // 下段
    drawText(g, `PASSED ${game.overtakes}`, 8, 330, 2, '#ffffff');
    drawText(g, game.muted ? '[M] SOUND OFF' : '[M] SOUND ON', 8, 346, 1, '#cfd6ff');
    drawText(g, String(Math.round(game.speed / C.KMH)), 600, 308, 4, '#ffffff', { align: 'right' });
    drawText(g, 'KM/H', 600, 340, 2, '#ffe36a', { align: 'right' });
    // チェックポイントバナー
    if (game.bannerT > 0 && (game.scene === 'playing' || game.scene === 'stageclear' || game.scene === 'timeup')) {
      const fl = game.bannerT > 1.7 ? Math.floor(game.animT / 0.08) % 2 === 0 : true;
      drawText(g, 'CHECKPOINT!', 320, 96, 3, fl ? '#7dff9a' : '#ffffff', { align: 'center' });
      drawText(g, `+${game.bannerSec} SEC`, 320, 124, 2, '#ffe36a', { align: 'center' });
    }
    // GO!
    if (game.scene === 'playing' && game.goT > 0) {
      const t = game.goT / 48;
      const sc = t > 0.75 ? 8 : 6;
      drawText(g, 'GO!', 320, 140, sc, '#7dff9a', { align: 'center' });
    }
  }

  darken(a) {
    this.g.fillStyle = `rgba(6,3,16,${a})`;
    this.g.fillRect(0, 0, W, H);
  }

  // ---------- オーバーレイ ----------
  drawOverlays(game) {
    const g = this.g;
    const sc = game.scene;
    const t = game.animT;
    if (sc === 'title') {
      const logo = ASSETS.logo_title;
      const bob = Math.round(Math.sin(t * 2.2) * 2);
      g.fillStyle = 'rgba(6,3,16,0.28)';
      g.fillRect(0, 0, W, 130);
      g.drawImage(logo.canvas, Math.round(320 - logo.fw / 2), 12 + bob);
      // 輝き
      const sp = (t * 1.2) % 3;
      if (sp < 1) {
        const sx = 320 - 100 + sp * 200, sy = 22 + bob + 20;
        g.fillStyle = 'rgba(255,255,255,0.9)';
        g.fillRect(Math.round(sx) - 4, sy, 9, 1); g.fillRect(Math.round(sx), sy - 4, 1, 9);
      }
      drawText(g, 'CHASE THE SUN. BEAT THE CLOCK.', 320, 136, 2, '#ffe9b0', { align: 'center' });
      if (Math.floor(t / 0.25) % 2 === 0) drawText(g, 'PRESS ENTER', 320, 196, 3, '#ffffff', { align: 'center' });
      drawText(g, `BEST ${pad(game.best, 6)}`, 320, 232, 2, '#ffe36a', { align: 'center' });
      g.fillStyle = 'rgba(6,3,16,0.55)';
      g.fillRect(0, 280, W, 60);
      drawText(g, 'UP/W GAS   DOWN/S BRAKE   LEFT-RIGHT/AD STEER', 320, 288, 2, '#ffffff', { align: 'center', outline: null });
      drawText(g, 'P PAUSE    R RESTART      M SOUND', 320, 312, 2, '#cfd6ff', { align: 'center', outline: null });
      return;
    }
    if (sc === 'countdown') {
      const st = game.course.st;
      drawText(g, `STAGE ${game.stage}`, 320, 60, 3, '#ffffff', { align: 'center' });
      drawText(g, st.name, 320, 86, 2, '#ffe36a', { align: 'center' });
      const n = 3 - Math.floor(game.sceneSteps / 60);
      const lit = 4 - n; // 1..3
      for (let i = 0; i < 3; i++) {
        const cx = 320 + (i - 1) * 24, cy = 118;
        g.fillStyle = '#10081c';
        g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.fill();
        g.fillStyle = i < lit ? (i === 2 ? '#ff5a3a' : '#ff3b3b') : '#4a1a26';
        g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fill();
        if (i < lit) { g.fillStyle = 'rgba(255,220,200,0.8)'; g.fillRect(cx - 3, cy - 3, 2, 2); }
      }
      const frac = (game.sceneSteps % 60) / 60;
      const scl = frac < 0.15 ? 8 : 6;
      drawText(g, String(n), 320, 150 + (scl === 8 ? -7 : 0), scl, '#ffffff', { align: 'center' });
      return;
    }
    if (sc === 'playing') {
      if (game.goT > 0) {
        // 信号:緑
        g.fillStyle = '#10081c'; g.beginPath(); g.arc(320, 118, 9, 0, 7); g.fill();
        g.fillStyle = '#7dff9a'; g.beginPath(); g.arc(320, 118, 6, 0, 7); g.fill();
        drawText(g, `STAGE ${game.stage}`, 320, 60, 3, '#ffffff', { align: 'center' });
        drawText(g, game.course.st.name, 320, 86, 2, '#ffe36a', { align: 'center' });
      }
      return;
    }
    if (sc === 'paused') {
      this.darken(0.6);
      drawText(g, 'PAUSED', 320, 140, 4, '#ffffff', { align: 'center' });
      drawText(g, 'P/ESC: RESUME   R: RESTART   Q: TITLE', 320, 190, 2, '#cfd6ff', { align: 'center' });
      return;
    }
    if (sc === 'stageclear') {
      if (game.sceneSteps < 90) {
        drawText(g, 'GOAL!', 320, 130, 8, '#ffe36a', { align: 'center' });
      } else {
        this.drawResult(game);
      }
      return;
    }
    if (sc === 'timeup') {
      drawText(g, 'TIME UP', 320, 130, 8, '#ff5a5a', { align: 'center' });
      return;
    }
    if (sc === 'gameover') {
      this.darken(0.78);
      drawText(g, 'GAME OVER', 320, 50, 6, '#ff5a5a', { align: 'center' });
      drawText(g, `REACHED STAGE ${game.stage}`, 320, 120, 2, '#ffffff', { align: 'center' });
      drawText(g, `SCORE ${pad(game.score, 6)}`, 320, 156, 3, '#ffffff', { align: 'center' });
      drawText(g, `BEST ${pad(game.best, 6)}`, 320, 196, 2, '#ffe36a', { align: 'center' });
      if (game.newBest && Math.floor(t / 0.3) % 2 === 0) drawText(g, 'NEW BEST!', 320, 226, 3, '#7dff9a', { align: 'center' });
      drawText(g, 'ENTER: RETRY   ESC: TITLE', 320, 292, 2, '#cfd6ff', { align: 'center' });
      return;
    }
    if (sc === 'ending') {
      this.darken(0.78);
      drawText(g, 'ALL CLEAR!', 320, 24, 5, '#ffe36a', { align: 'center' });
      drawText(g, `SCORE ${pad(game.score, 6)}`, 320, 76, 3, '#ffffff', { align: 'center' });
      drawText(g, 'RANK', 320, 116, 2, '#cfd6ff', { align: 'center' });
      const col = { S: '#ffd23f', A: '#ff7a5a', B: '#7ad8ff', C: '#b8b8d0' }[game.rank];
      drawText(g, game.rank, 320, 138, 8, col, { align: 'center' });
      drawText(g, `BEST ${pad(game.best, 6)}`, 320, 214, 2, '#ffe36a', { align: 'center' });
      if (game.newBest && Math.floor(t / 0.3) % 2 === 0) drawText(g, 'NEW BEST!', 320, 240, 3, '#7dff9a', { align: 'center' });
      if (Math.floor(t / 0.25) % 2 === 0) drawText(g, 'PRESS ENTER', 320, 300, 3, '#ffffff', { align: 'center' });
    }
  }

  drawResult(game) {
    const g = this.g;
    const px = 140, py = 80, pw = 360, ph = 200;
    g.fillStyle = 'rgba(8,4,26,0.86)';
    g.fillRect(px, py, pw, ph);
    g.strokeStyle = '#ffb04a';
    g.lineWidth = 2;
    g.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
    g.strokeStyle = '#ff5a9a';
    g.lineWidth = 1;
    g.strokeRect(px + 5.5, py + 5.5, pw - 11, ph - 11);
    const ci = game.clearInfo;
    drawText(g, `STAGE ${game.stage} CLEAR!`, 320, py + 18, 3, '#ffe36a', { align: 'center' });
    const rows = [
      ['TIME LEFT', `${ci.timeLeft}  X100`, `= ${ci.timeBonus}`],
      ['STAGE BONUS', '', `= ${ci.stageBonus}`],
      ['SCORE', '', `= ${pad(game.score, 6)}`],
    ];
    rows.forEach((r, i) => {
      const y = py + 62 + i * 26;
      drawText(g, r[0], px + 16, y, 2, '#ffffff', { outline: null });
      if (r[1]) drawText(g, r[1], px + 152, y, 2, '#ffd0a0', { outline: null });
      drawText(g, r[2], px + pw - 16, y, 2, i === 2 ? '#7dff9a' : '#ffffff', { align: 'right', outline: null });
    });
    if (Math.floor(game.animT / 0.25) % 2 === 0) drawText(g, 'PRESS ENTER', 320, py + ph - 34, 2, '#ffffff', { align: 'center', outline: null });
    void textWidth;
  }
}
