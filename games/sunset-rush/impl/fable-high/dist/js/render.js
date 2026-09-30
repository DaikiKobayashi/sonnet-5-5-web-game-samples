// Pseudo-3D renderer (segment projection + sprite scaling), HUD and overlays.

import { W, H, SEG_LEN, ROAD_HALF, CAM_HEIGHT, CAM_DEPTH, PLAYER_Z, DRAW_DIST, MAX_SPEED, U_PER_KMH, GATE_WORLD_W } from './const.js';
import { lerp, clamp, mixColor, pad } from './util.js';
import { makeCanvas } from './pix.js';

const FOG_LEVELS = 16;

export class Renderer {
  constructor(canvas, assets, font) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.A = assets;
    this.fnt = font;
    this.fogCache = new Map();
    this.logoBuf = makeCanvas(assets.logo_title.fw, assets.logo_title.fh);
    this.glows = {};
    for (const [name, col] of [['yellow', '#ffe08a'], ['magenta', '#ff58d0'], ['red', '#ff4030'], ['cyan', '#50e8ff'], ['white', '#ffffff']]) {
      const c = makeCanvas(32, 32);
      const x = c.getContext('2d');
      x.drawImage(assets._glow.canvas, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = col;
      x.fillRect(0, 0, 32, 32);
      this.glows[name] = c;
    }
  }

  // Palette colours blended toward fog by quantised level.
  fogPal(pal, level) {
    const key = pal.fog + level;
    let p = this.fogCache.get(key);
    if (!p) {
      const t = level / (FOG_LEVELS - 1);
      const f = (c) => mixColor(c, pal.fog, t);
      p = { grass: pal.grass.map(f), rumble: pal.rumble.map(f), road: pal.road.map(f), lane: f(pal.lane) };
      this.fogCache.set(key, p);
    }
    return p;
  }

  text(str, x, y, s, color, opts) {
    this.fnt.draw(this.ctx, str, x, y, s, color, opts);
  }

  // ---------------------------------------------------------------- frame
  render(g) {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (g.shake > 0) {
      const a = g.shake / 0.3 * 5;
      ctx.translate(Math.round((Math.random() - 0.5) * 2 * a), Math.round((Math.random() - 0.5) * 2 * a));
    }
    this.drawWorld(g);
    ctx.restore();
    if (g.shake > 0) {
      // cover the edge revealed by the shake with the ground colour
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, 1); ctx.fillRect(0, H - 1, W, 1);
    }
    switch (g.scene) {
      case 'title': this.drawTitle(g); break;
      case 'countdown': this.drawHud(g); this.drawCountdown(g); break;
      case 'playing': this.drawHud(g); this.drawPlayingOverlays(g); break;
      case 'paused': this.drawHud(g); this.drawPaused(g); break;
      case 'stageclear': this.drawHud(g); this.drawStageClear(g); break;
      case 'timeup': this.drawHud(g); this.drawTimeUp(g); break;
      case 'gameover': this.drawGameOver(g); break;
      case 'ending': this.drawEnding(g); break;
      default: break;
    }
    if (g.debugEnabled) this.text(`FPS ${g.fps}`, 632, 42, 1, '#ffffff', { align: 'right', outline: '#000000' });
  }

  // ---------------------------------------------------------------- world
  drawLayer(asset, y, offset) {
    const ctx = this.ctx;
    const ox = -(((offset % W) + W) % W);
    ctx.drawImage(asset.canvas, Math.round(ox), y);
    ctx.drawImage(asset.canvas, Math.round(ox) + W, y);
  }

  project(p, camX, camY, camZ) {
    const cz = p.z - camZ;
    p.camZ = cz;
    const scale = CAM_DEPTH / (cz === 0 ? 1e-6 : cz);
    p.scale = scale;
    p.x = Math.round(W / 2 + scale * (0 - camX) * (W / 2));
    p.y = Math.round(H / 2 - scale * (p.wy - camY) * (H / 2));
    p.w = Math.round(scale * ROAD_HALF * (W / 2));
  }

  drawWorld(g) {
    const ctx = this.ctx;
    const A = this.A;
    const world = g.world;
    const pal = world.stage.pal;
    const sn = world.stage.num;

    // 0. background
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, H / 2, W, H / 2);
    this.drawLayer(A[`bg_sky_${sn}`], 0, g.off.sky);
    this.drawLayer(A[`bg_far_${sn}`], H / 2 - 96, g.off.far);
    this.drawLayer(A[`bg_near_${sn}`], H / 2 - 56, g.off.near);

    // 1-4. road
    const segs = world.segments;
    const pos = g.pos;
    const playerZ = pos + PLAYER_Z;
    const baseIdx = Math.floor(pos / SEG_LEN);
    const basePct = (pos % SEG_LEN) / SEG_LEN;
    const pIdx = Math.min(segs.length - 1, Math.floor(playerZ / SEG_LEN));
    const pPct = (playerZ % SEG_LEN) / SEG_LEN;
    const pseg = segs[pIdx];
    const playerY = lerp(pseg.y1, pseg.y2, pPct);
    const camY = CAM_HEIGHT + playerY;
    const camZ = pos;
    const px = g.playerX * ROAD_HALF;
    let maxY = H, x = 0, dx = -segs[baseIdx].curve * basePct;
    const visible = [];
    for (let n = 0; n < DRAW_DIST; n++) {
      const seg = segs[baseIdx + n];
      if (!seg) break;
      seg.clipY = maxY;
      this.project(seg.p1, px - x, camY, camZ);
      this.project(seg.p2, px - x - dx, camY, camZ);
      x += dx;
      dx += seg.curve;
      const d = n / DRAW_DIST;
      seg.fog = 1 - Math.exp(-d * d * pal.fogDensity);
      visible.push(seg);
      if (seg.p1.camZ <= CAM_DEPTH || seg.p2.y >= seg.p1.y || seg.p2.y >= maxY) continue;
      this.drawSegment(seg, pal);
      maxY = seg.p1.y;
    }

    // 5. sprites, far to near
    const carsBySeg = new Map();
    for (const c of world.cars) {
      const si = Math.floor(c.z / SEG_LEN);
      if (si < baseIdx || si >= baseIdx + visible.length) continue;
      let arr = carsBySeg.get(si);
      if (!arr) carsBySeg.set(si, (arr = []));
      arr.push(c);
    }
    const night = sn === 3;
    for (let n = visible.length - 1; n >= 0; n--) {
      const seg = visible[n];
      if (seg.p1.camZ <= CAM_DEPTH) continue;
      const cars = carsBySeg.get(seg.index);
      let items = seg.sprites;
      if (cars) items = items.concat(cars);
      if (items.length > 1) items = items.slice().sort((a, b) => b.z - a.z);
      for (const it of items) this.drawSprite(it, seg, night);
    }

    // 6. player car
    if (g.scene !== 'title' || true) this.drawPlayer(g, night);

    // 7. effects
    this.drawFx(g);
  }

  drawSegment(seg, pal) {
    const ctx = this.ctx;
    const p1 = seg.p1, p2 = seg.p2;
    const level = Math.min(FOG_LEVELS - 1, Math.floor(seg.fog * FOG_LEVELS));
    const fp = this.fogPal(pal, level);
    const band = seg.band;
    const grass = fp.grass[band], rumble = fp.rumble[band], road = fp.road[band], lane = fp.lane;
    const h = p1.y - p2.y;
    ctx.fillStyle = grass;
    ctx.fillRect(0, p2.y, W, h + 1);
    for (let y = p2.y; y <= p1.y; y++) {
      const t = h > 0 ? (y - p2.y) / h : 0;
      const cx = Math.round(lerp(p2.x, p1.x, t));
      const hw = Math.round(lerp(p2.w, p1.w, t));
      const rw = Math.max(1, Math.round(hw / 6));
      ctx.fillStyle = rumble;
      ctx.fillRect(cx - hw - rw, y, rw, 1);
      ctx.fillRect(cx + hw, y, rw, 1);
      ctx.fillStyle = road;
      ctx.fillRect(cx - hw, y, hw * 2, 1);
      if (band === 0 && hw > 12) {
        const lw = Math.max(1, Math.round(hw / 32));
        ctx.fillStyle = lane;
        const l1 = Math.round(cx - hw + (2 * hw) / 3 - lw / 2);
        const l2 = Math.round(cx - hw + (4 * hw) / 3 - lw / 2);
        ctx.fillRect(l1, y, lw, 1);
        ctx.fillRect(l2, y, lw, 1);
      }
    }
  }

  drawSprite(it, seg, night) {
    const ctx = this.ctx;
    const a = this.A[it.id];
    if (!a) return;
    const percent = (it.z % SEG_LEN) / SEG_LEN;
    const sScale = lerp(seg.p1.scale, seg.p2.scale, percent);
    const roadW = sScale * ROAD_HALF * (W / 2);
    const sX = lerp(seg.p1.x, seg.p2.x, percent) + roadW * it.x;
    const sY = lerp(seg.p1.y, seg.p2.y, percent);
    const destW = it.worldW * roadW;
    if (!(destW >= 1)) return;
    const destH = destW * (a.fh / a.fw);
    const top = sY - destH;
    const clipY = seg.clipY;
    const visH = Math.min(sY, clipY) - top;
    if (visH <= 0) return;
    const srcH = (visH / destH) * a.fh;
    const frame = it.variant || 0;
    const fogA = seg.fog;
    ctx.globalAlpha = clamp(1 - fogA * fogA, 0, 1);
    ctx.drawImage(a.canvas, frame * a.fw, 0, a.fw, srcH, Math.round(sX - destW / 2), Math.round(top), Math.round(destW), Math.round(visH));
    if (night && seg.fog < 0.6) {
      const dx = Math.round(sX - destW / 2);
      ctx.globalCompositeOperation = 'lighter';
      if (it.id === 'rs_lamp') {
        this.glow('yellow', dx + destW * 0.8, top + destH * 0.1, destW * 2.4, 0.55, clipY);
      } else if (it.id === 'rs_neon') {
        this.glow('magenta', dx + destW * 0.5, top + destH * 0.35, destW * 1.6, 0.35, clipY);
      } else if (it.lane !== undefined) {
        const ly = top + destH * (it.type === 'truck' ? 0.72 : 0.55);
        this.glow('red', dx + destW * 0.12, ly, destW * 0.36, 0.7, clipY);
        this.glow('red', dx + destW * 0.88, ly, destW * 0.36, 0.7, clipY);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  glow(color, cx, cy, size, alpha, clipY) {
    const ctx = this.ctx;
    if (size < 2) return;
    const top = cy - size / 2;
    const visH = Math.min(cy + size / 2, clipY) - top;
    if (visH <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.glows[color], 0, 0, 32, (visH / size) * 32, Math.round(cx - size / 2), Math.round(top), Math.round(size), Math.round(visH));
  }

  drawPlayer(g, night) {
    const ctx = this.ctx;
    const inp = g.input;
    const driving = g.scene === 'playing';
    let frame = 0;
    if (driving) frame = inp.left && !inp.right ? 1 : inp.right && !inp.left ? 2 : 0;
    const braking = driving && inp.brake && g.speed > 0;
    let bounce = 0;
    if (g.speed > 0) bounce = Math.round(Math.random() * (Math.abs(g.playerX) > 1 ? 3 : 1));
    if (g.invulnTimer > 0 && Math.floor(g.invulnTimer / 0.05) % 2 === 1) return;
    const destW = 160, destH = 88;
    const x = 320 - destW / 2, y = 354 - bounce - destH;
    if (night) {
      // headlight cone on the road ahead
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#ffe9a0';
      ctx.beginPath();
      ctx.moveTo(320 - 62, y + destH - 30);
      ctx.lineTo(320 + 62, y + destH - 30);
      ctx.lineTo(320 + 40, 215);
      ctx.lineTo(320 - 40, 215);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    let asset, fi;
    if (braking) { asset = this.A.car_player_brake; fi = frame; }
    else if (g.speed > 0) { asset = this.A.car_player_wheel; fi = frame * 2 + (Math.floor(g.wheelT / 0.1) % 2); }
    else { asset = this.A.car_player; fi = frame; }
    ctx.drawImage(asset.canvas, fi * asset.fw, 0, asset.fw, asset.fh, x, y, destW, destH);
    if (night) {
      ctx.globalCompositeOperation = 'lighter';
      const lc = braking ? 0.9 : 0.45;
      this.glow('red', x + 16, y + 48, 40, lc, H);
      this.glow('red', x + destW - 16, y + 48, 40, lc, H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  drawFx(g) {
    const ctx = this.ctx;
    const A = this.A;
    for (const d of g.dust) {
      const f = Math.min(2, Math.floor((d.t / 0.4) * 3));
      ctx.drawImage(A.fx_dust.canvas, f * 8, 0, 8, 8, Math.round(d.x - 8), Math.round(d.y - 8), 16, 16);
    }
    for (const s of g.smoke) {
      const f = Math.min(3, Math.floor((s.t / 0.5) * 4));
      ctx.drawImage(A.fx_smoke.canvas, f * 12, 0, 12, 12, Math.round(s.x - 12), Math.round(s.y - 12), 24, 24);
    }
    for (const s of g.sparks) {
      const f = Math.min(2, Math.floor((s.t / 0.35) * 3));
      ctx.drawImage(A.fx_spark.canvas, f * 6, 0, 6, 6, Math.round(s.x - 6), Math.round(s.y - 6), 12, 12);
    }
    // speed lines
    if (g.speed >= 250 * U_PER_KMH && (g.scene === 'playing' || g.scene === 'title')) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 10; i++) {
        const side = i % 2 ? 1 : -1;
        const y = 40 + Math.random() * 280;
        const len = 40 + Math.random() * 120;
        const x0 = side > 0 ? W - Math.random() * 60 : Math.random() * 60;
        ctx.fillRect(Math.round(side > 0 ? x0 - len : x0), Math.round(y), Math.round(len), 1);
      }
      ctx.globalAlpha = 1;
    }
    for (const p of g.popups) {
      this.text(p.text, p.x, p.y, 2, '#ffe36a', { outline: '#3a1a10' });
    }
  }

  // ---------------------------------------------------------------- HUD
  drawHud(g) {
    const ctx = this.ctx;
    const out = { outline: '#1a1020' };
    this.text('TIME', 8, 6, 2, '#ffffff', out);
    const blinkRed = g.timeLeft <= 10;
    let tcol = '#ffffff';
    if (blinkRed) tcol = (g.t % 0.5) < 0.25 ? '#ff3c3c' : '#8a1e1e';
    this.text(pad(Math.ceil(g.timeLeft), 2), 8, 22, 4, tcol, out);
    this.text('SCORE', 320, 6, 2, '#ffffff', { align: 'center', ...out });
    this.text(pad(g.score, 6), 320, 22, 3, '#ffe36a', { align: 'center', ...out });
    this.text(`STAGE ${g.stage}/3`, 632, 6, 2, '#ffffff', { align: 'right', ...out });
    this.text(`BEST ${pad(Math.max(g.best, g.score), 6)}`, 632, 24, 2, '#a8e8ff', { align: 'right', ...out });

    // progress bar
    const bx = 120, by = 54, bw = 400, bh = 8;
    const w = g.world;
    const progress = clamp((g.pos + PLAYER_Z) / w.goalZ, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = '#3a3448';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#ffb23c';
    ctx.fillRect(bx, by, Math.round(bw * progress), bh);
    ctx.fillStyle = '#ffffff';
    for (const cp of w.stage.cps) {
      const cx = bx + Math.round((bw * cp * SEG_LEN) / w.goalZ);
      ctx.fillRect(cx, by - 2, 2, bh + 4);
    }
    // goal flag
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx + bw + 1, by - 4, 1, bh + 6);
    this.text('F', bx + bw + 3, by - 5, 1, '#ffffff', { outline: '#1a1020' });
    // marker
    const mx = bx + Math.round(bw * progress);
    ctx.fillStyle = '#ff4040';
    ctx.beginPath();
    ctx.moveTo(mx, by - 1);
    ctx.lineTo(mx - 4, by - 7);
    ctx.lineTo(mx + 4, by - 7);
    ctx.closePath();
    ctx.fill();

    this.text(`PASSED ${g.overtakes}`, 8, 330, 2, '#ffffff', out);
    this.text(`[M] SOUND ${g.muted ? 'OFF' : 'ON'}`, 8, 346, 1, '#d8d0e0', out);
    const kmh = Math.min(999, Math.floor(g.speed / U_PER_KMH));
    this.text(String(kmh), 600, 318, 4, '#ffffff', { align: 'right', ...out });
    this.text('KM/H', 600, 346, 2, '#ffd08a', { align: 'right', ...out });
  }

  drawPlayingOverlays(g) {
    if (g.goTimer > 0) this.text('GO!', 320, 150, 6, '#ffe36a', { align: 'center', outline: '#3a1a10' });
    if (g.stageNameTimer > 0) this.drawStageName(g);
    if (g.bannerTimer > 0) {
      this.text(g.bannerText, 320, 96, 3, '#7af0ff', { align: 'center', outline: '#102030' });
      this.text(g.bannerSub, 320, 124, 2, '#ffffff', { align: 'center', outline: '#102030' });
    }
  }

  drawStageName(g) {
    this.text(`STAGE ${g.stage}`, 320, 64, 3, '#ffffff', { align: 'center', outline: '#3a1a10' });
    this.text(g.stageDef.name, 320, 92, 2, '#ffd08a', { align: 'center', outline: '#3a1a10' });
  }

  drawCountdown(g) {
    this.drawStageName(g);
    const d = Math.max(1, Math.ceil(g.countdownT - 1e-9));
    this.text(String(d), 320, 150, 6, '#ffffff', { align: 'center', outline: '#3a1a10' });
    // signal lights
    const ctx = this.ctx;
    for (let i = 0; i < 3; i++) {
      const lit = 3 - i <= 3 - d + 1;
      ctx.fillStyle = '#1a1020';
      ctx.fillRect(292 + i * 20, 210, 16, 16);
      ctx.fillStyle = lit ? '#ff3c3c' : '#4a2a2a';
      ctx.fillRect(294 + i * 20, 212, 12, 12);
    }
  }

  dim(alpha) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(8,4,16,${alpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawPaused(g) {
    this.dim(0.6);
    this.text('PAUSED', 320, 140, 4, '#ffffff', { align: 'center', outline: '#3a1a10' });
    this.text('P/ESC: RESUME   R: RESTART   Q: TITLE', 320, 190, 2, '#ffd08a', { align: 'center', outline: '#3a1a10' });
  }

  drawStageClear(g) {
    if (g.clearTimer < 1.5) {
      this.text('GOAL!', 320, 140, 6, '#ffe36a', { align: 'center', outline: '#3a1a10' });
      return;
    }
    const ctx = this.ctx;
    const px = 140, py = 80, pw = 360, ph = 200;
    ctx.fillStyle = 'rgba(12,6,24,0.82)';
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = '#ffb23c';
    ctx.fillRect(px, py, pw, 2); ctx.fillRect(px, py + ph - 2, pw, 2); ctx.fillRect(px, py, 2, ph); ctx.fillRect(px + pw - 2, py, 2, ph);
    const k = clamp((g.clearTimer - 1.5) / 0.6, 0, 1);
    this.text(`STAGE ${g.stage} CLEAR!`, 320, py + 16, 3, '#ffe36a', { align: 'center' });
    const tl = Math.round(g.clearTimeLeft * k);
    this.text(`TIME LEFT   ${String(g.clearTimeLeft).padStart(2, ' ')}  X100  = ${pad(Math.round(g.clearBonusTime * k), 4)}`, px + 20, py + 60, 2, '#ffffff');
    this.text(`STAGE BONUS           = ${pad(Math.round(g.clearBonusStage * k), 4)}`, px + 20, py + 84, 2, '#ffffff');
    const shown = Math.round(g.score - (g.clearBonusTime + g.clearBonusStage) * (1 - k));
    this.text(`SCORE                 = ${pad(shown, 6)}`, px + 20, py + 108, 2, '#a8e8ff');
    void tl;
    if ((g.t % 1) < 0.6) this.text('PRESS ENTER', 320, py + 160, 2, '#ffffff', { align: 'center' });
  }

  drawTimeUp(g) {
    this.text('TIME UP', 320, 140, 6, '#ff5a3c', { align: 'center', outline: '#2a0a10' });
  }

  drawGameOver(g) {
    this.dim(0.72);
    this.text('GAME OVER', 320, 60, 5, '#ff5a3c', { align: 'center', outline: '#2a0a10' });
    this.text(`REACHED STAGE ${g.stage}`, 320, 120, 2, '#ffffff', { align: 'center' });
    this.text(`SCORE ${pad(g.score, 6)}`, 320, 160, 3, '#ffe36a', { align: 'center' });
    this.text(`BEST ${pad(g.best, 6)}`, 320, 200, 2, '#a8e8ff', { align: 'center' });
    if (g.newBest && (g.t % 0.6) < 0.4) this.text('NEW BEST!', 320, 228, 2, '#7af0ff', { align: 'center' });
    this.text('ENTER: RETRY   ESC: TITLE', 320, 300, 2, '#ffd08a', { align: 'center' });
  }

  drawEnding(g) {
    this.dim(0.72);
    this.text('ALL CLEAR!', 320, 34, 5, '#ffe36a', { align: 'center', outline: '#3a1a10' });
    this.text(`SCORE ${pad(g.score, 6)}`, 320, 92, 3, '#ffffff', { align: 'center' });
    this.text('RANK', 240, 150, 2, '#ffd08a', { align: 'center' });
    const rc = { S: '#ffe36a', A: '#7af0ff', B: '#a8ffa8', C: '#ffffff' }[g.rank] || '#ffffff';
    this.text(g.rank || '', 330, 130, 8, rc, { align: 'center', outline: '#3a1a10' });
    this.text(`BEST ${pad(g.best, 6)}`, 320, 210, 2, '#a8e8ff', { align: 'center' });
    if (g.newBest && (g.t % 0.6) < 0.4) this.text('NEW BEST!', 320, 236, 2, '#7af0ff', { align: 'center' });
    if ((g.t % 1) < 0.6) this.text('PRESS ENTER', 320, 300, 2, '#ffffff', { align: 'center' });
  }

  drawTitle(g) {
    const ctx = this.ctx;
    const logo = this.A.logo_title;
    const ly = 28 + Math.round(Math.sin(g.t * 2) * 3);
    const lx = Math.round(320 - logo.fw / 2);
    // shine sweep on the logo (offscreen, source-atop)
    const lb = this.logoBuf;
    const lc = lb.getContext('2d');
    lc.clearRect(0, 0, lb.width, lb.height);
    lc.drawImage(logo.canvas, 0, 0);
    lc.globalCompositeOperation = 'source-atop';
    const sx = ((g.t * 120) % (lb.width + 200)) - 100;
    lc.fillStyle = 'rgba(255,255,255,0.35)';
    lc.beginPath();
    lc.moveTo(sx, 0); lc.lineTo(sx + 24, 0); lc.lineTo(sx - 6, lb.height); lc.lineTo(sx - 30, lb.height);
    lc.closePath();
    lc.fill();
    lc.globalCompositeOperation = 'source-over';
    ctx.drawImage(lb, lx, ly);
    this.text('CHASE THE SUN. BEAT THE CLOCK.', 320, 118, 2, '#ffffff', { align: 'center', outline: '#3a1a10' });
    if ((g.t % 0.5) < 0.3) this.text('PRESS ENTER', 320, 186, 3, '#ffe36a', { align: 'center', outline: '#3a1a10' });
    this.text(`BEST ${pad(g.best, 6)}`, 320, 222, 2, '#a8e8ff', { align: 'center', outline: '#3a1a10' });
    this.text('UP/W GAS   DOWN/S BRAKE   LEFT-RIGHT/AD STEER', 320, 292, 2, '#ffffff', { align: 'center', outline: '#3a1a10' });
    this.text('P PAUSE    R RESTART      M SOUND', 320, 314, 2, '#ffffff', { align: 'center', outline: '#3a1a10' });
    this.text(`[M] SOUND ${g.muted ? 'OFF' : 'ON'}`, 8, 346, 1, '#d8d0e0', { outline: '#1a1020' });
  }
}

export { MAX_SPEED, GATE_WORLD_W };
