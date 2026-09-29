// Pseudo-3D renderer (SPEC 3.4): segment projection, hill clipping, sprite scaling, parallax, effects.
// Roads are rasterised row by row with integer boundaries, so there are no seams or anti-aliased edges.

import {
  W, H, HALF_W, HALF_H, HORIZON, SEG_LEN, ROAD_HALF, CAM_HEIGHT, CAM_DEPTH, PLAYER_Z, DRAW_DIST,
  MAX_SPEED, KMH, CAR_TYPES, lerp, clamp,
} from './config.js';
import { css, mix, rgbOf, hash2 } from './pixel.js';
import { drawText } from './font.js';

// Per-stage colour scheme: [light band, dark band] pairs (SPEC 6.1)
export const LOOKS = [
  {
    grass: [0xf2b878, 0xdf9d62], rumble: [0xf6efdc, 0xd8362c], road: [0x6e7190, 0x585b78], lane: 0xf6f0e0,
    fog: 0xffc48a, ground: 0xe9aa6c, fogDensity: 2.6, spec: [0xfff0cc, 0xa86a3c, 0xff9a5a],
  },
  {
    grass: [0x2f6a50, 0x1f4c3a], rumble: [0xe8e0d0, 0x7a2e5c], road: [0x585a7c, 0x454766], lane: 0xf0e6b0,
    fog: 0xa85a86, ground: 0x275a44, fogDensity: 2.6, spec: [0x62b492, 0x113a2a, 0xa8e8c8],
  },
  {
    grass: [0x1f3158, 0x0e1a36], rumble: [0x38f0ff, 0xc0189e], road: [0x3a3e60, 0x22253f], lane: 0x9ff4ff,
    fog: 0x3c1c6e, ground: 0x172646, fogDensity: 2.9, spec: [0x3a5490, 0x060c1c, 0x3ff0ff],
  },
];

const FOG_LEVELS = 6;

function fogAmount(n, density) {
  const t = n / DRAW_DIST;
  return 1 - 1 / Math.exp(t * t * density);
}

export class Renderer {
  constructor(canvas, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.assets = assets;
    this.touched = [];
    this.nDrawn = 0;
    this.baseIdx = 0;
    this.buildFog();
    this.rowCx = new Float64Array(H + 4);
    this.rowW = new Float64Array(H + 4);
    this.stats = { vanishY: H, drawn: 0, hidden: 0 };
  }

  buildFog() {
    this.fogPal = [];
    this.fogLevel = [];
    this.fogRgb = [];
    for (const look of LOOKS) {
      const table = [];
      const lv = [];
      for (let n = 0; n < DRAW_DIST; n++) {
        const f = fogAmount(n, look.fogDensity);
        const bands = [];
        for (let b = 0; b < 2; b++) {
          bands.push({
            grass: css(mix(look.grass[b], look.fog, f)),
            rumble: css(mix(look.rumble[b], look.fog, f)),
            road: css(mix(look.road[b], look.fog, f)),
            lane: css(mix(look.lane, look.fog, f)),
            spec: look.spec.map((c) => css(mix(c, look.fog, Math.min(1, f * 1.25)))),
          });
        }
        table.push(bands);
        lv.push(clamp(Math.floor(f * FOG_LEVELS * 1.05), 0, FOG_LEVELS - 1));
      }
      this.fogPal.push(table);
      this.fogLevel.push(lv);
      this.fogRgb.push(rgbOf(look.fog));
    }
  }

  // ------------------------------------------------------------------ projection
  project(pt, worldX, worldY, worldZ, camX, camY, camZ) {
    const cx = worldX - camX, cy = worldY - camY;
    let cz = worldZ - camZ;
    pt.camZ = cz;
    if (cz === 0) cz = 1e-6;
    const scale = CAM_DEPTH / cz;
    pt.scale = scale;
    pt.sx = Math.round(HALF_W + scale * cx * HALF_W);
    pt.sy = Math.round(HALF_H - scale * cy * HALF_H);
    pt.sw = Math.round(scale * ROAD_HALF * HALF_W);
  }

  drawLayer(spr, offset, y) {
    const ctx = this.ctx;
    const x = -Math.floor(((offset % W) + W) % W);
    ctx.drawImage(spr.canvas, x, y);
    ctx.drawImage(spr.canvas, x + W, y);
  }

  // ------------------------------------------------------------------ world
  drawWorld(sim) {
    const ctx = this.ctx;
    const A = this.assets;
    const st = sim.stage;
    const si = st - 1;
    const look = LOOKS[si];
    const course = sim.course;
    const segs = course.segments;

    const shaking = sim.shake > 0 && sim.scene !== 'paused';
    ctx.save();
    if (shaking) {
      const m = Math.ceil(sim.shake / 4);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, HORIZON);
      ctx.fillStyle = css(look.ground);
      ctx.fillRect(0, HORIZON, W, H - HORIZON);
      ctx.translate(Math.round((Math.random() - 0.5) * 2 * m), Math.round((Math.random() - 0.5) * 2 * m));
    }

    // 0. background (ground colour, sky, far, near)
    ctx.fillStyle = css(look.ground);
    ctx.fillRect(0, HORIZON, W, H - HORIZON);
    this.drawLayer(A.sky[st], sim.bg.sky, 0);
    this.drawLayer(A.far[st], sim.bg.far, HORIZON - 96);
    this.drawLayer(A.near[st], sim.bg.near, HORIZON - 56);

    // 1-3. camera set-up
    const pos = sim.pos;
    const playerZ = pos + PLAYER_Z;
    const baseIdx = Math.max(0, Math.min(segs.length - 1, Math.floor(pos / SEG_LEN)));
    const baseSeg = segs[baseIdx];
    const basePercent = (pos % SEG_LEN) / SEG_LEN;
    const playerSeg = course.segmentAt(playerZ);
    const playerPercent = (playerZ % SEG_LEN) / SEG_LEN;
    const playerY = lerp(playerSeg.y1, playerSeg.y2, playerPercent);
    const cameraY = CAM_HEIGHT + playerY;
    const cameraX0 = sim.playerX * ROAD_HALF;

    let maxY = H;
    let x = 0;
    let dx = -baseSeg.curve * basePercent;
    let nDrawn = 0;
    let hidden = 0;

    const fogTable = this.fogPal[si];
    for (let n = 0; n < DRAW_DIST; n++) {
      const idx = baseIdx + n;
      if (idx >= segs.length) break;
      const seg = segs[idx];
      nDrawn = n + 1;
      seg.clipY = maxY;
      this.project(seg.p1, 0, seg.y1, seg.z1, cameraX0 - x, cameraY, pos);
      this.project(seg.p2, 0, seg.y2, seg.z2, cameraX0 - x - dx, cameraY, pos);
      x += dx;
      dx += seg.curve;
      const p1 = seg.p1, p2 = seg.p2;
      if (p1.camZ <= CAM_DEPTH || p2.sy >= p1.sy || p2.sy >= maxY) {
        if (p2.sy >= maxY && p1.camZ > CAM_DEPTH) hidden++;
        continue;
      }
      this.drawRoadSegment(seg, fogTable[n][seg.band], maxY, n, si);
      if (p1.sy < maxY) maxY = p1.sy;
    }
    this.nDrawn = nDrawn;
    this.baseIdx = baseIdx;
    this.stats = { vanishY: maxY, drawn: nDrawn, hidden };

    // bucket traffic per segment for this frame
    for (const i of this.touched) segs[i].cars.length = 0;
    this.touched.length = 0;
    for (const c of sim.traffic) {
      if (c.gone) continue;
      const i = Math.floor(c.z / SEG_LEN);
      if (i >= baseIdx && i < baseIdx + nDrawn) {
        segs[i].cars.push(c);
        this.touched.push(i);
      }
    }

    // 5. sprites, far to near
    const night = st === 3;
    const fogRgb = this.fogRgb[si];
    const fogLv = this.fogLevel[si];
    ctx.save();
    for (let n = nDrawn - 1; n >= 0; n--) {
      const seg = segs[baseIdx + n];
      if (seg.p1.camZ <= CAM_DEPTH * 1.5) continue;
      const lvl = fogLv[n];
      const sprites = seg.sprites;
      for (let k = 0; k < sprites.length; k++) {
        const o = sprites[k];
        if (o.gate) {
          const spr = A.get(o.kind);
          this.drawSprite(spr, spr.canvas, 0, o.z, 0, seg, lvl, fogRgb, st, false);
        } else {
          const spr = A.get(o.kind);
          const flipped = o.side < 0 && spr.canvasFlipped;
          this.drawSprite(spr, flipped ? spr.canvasFlipped : spr.canvas, 0, o.z, o.x, seg, lvl, fogRgb, st, night && !!spr.glow, flipped ? 'f' : 'n');
        }
      }
      const cars = seg.cars;
      for (let k = 0; k < cars.length; k++) {
        const c = cars[k];
        // attract mode has no player car: never draw a car the camera is about to drive through
        if (sim.scene === 'title' && n < 12 && Math.abs(c.x - sim.playerX) < 0.4) continue;
        const ct = CAR_TYPES[c.type];
        const spr = A.get(c.variant === 0 ? ct.id : ct.id + '_v' + (c.variant + 1));
        this.drawSprite(spr, spr.canvas, 0, c.z, c.x, seg, lvl, fogRgb, st, night, 'n', true);
      }
    }
    ctx.restore();

    if (night) this.drawHeadlights(sim);
    this.drawSpeedLines(sim);
    this.drawPlayer(sim, night);
    this.drawFx(sim);
    ctx.restore();
  }

  // One road segment as horizontal runs (grass, rumble strips, road, lane markers)
  drawRoadSegment(seg, pal, maxY, n, si) {
    const ctx = this.ctx;
    const p1 = seg.p1, p2 = seg.p2;
    const y1 = p1.sy, y2 = p2.sy;
    const yTop = Math.max(y2, 0);
    const yBot = Math.min(y1, maxY, H);
    if (yTop >= yBot) return;
    const inv = 1 / (y1 - y2);
    const x1 = p1.sx, w1 = p1.sw, x2 = p2.sx, w2 = p2.sw;

    ctx.fillStyle = pal.grass;
    ctx.fillRect(0, yTop, W, yBot - yTop);

    const cxA = this.rowCx, wA = this.rowW;
    for (let y = yTop; y < yBot; y++) {
      const t = (y + 0.5 - y2) * inv;
      cxA[y] = x2 + (x1 - x2) * t;
      wA[y] = w2 + (w1 - w2) * t;
    }
    ctx.fillStyle = pal.rumble;
    for (let y = yTop; y < yBot; y++) {
      const cx = cxA[y], w = wA[y], rw = w / 6;
      const a = Math.round(cx - w - rw), b = Math.round(cx - w), c = Math.round(cx + w), d = Math.round(cx + w + rw);
      if (b > a) ctx.fillRect(a, y, b - a, 1);
      if (d > c) ctx.fillRect(c, y, d - c, 1);
    }
    ctx.fillStyle = pal.road;
    for (let y = yTop; y < yBot; y++) {
      const cx = cxA[y], w = wA[y];
      const b = Math.round(cx - w), c = Math.round(cx + w);
      if (c > b) ctx.fillRect(b, y, c - b, 1);
    }
    if (seg.band === 0) {
      ctx.fillStyle = pal.lane;
      for (let y = yTop; y < yBot; y++) {
        const cx = cxA[y], w = wA[y];
        const lw = w / 64;
        if (lw < 0.25) continue;
        const off = w / 3;
        let l0 = Math.round(cx - off - lw), l1 = Math.round(cx - off + lw);
        if (l1 <= l0) l1 = l0 + 1;
        ctx.fillRect(l0, y, l1 - l0, 1);
        l0 = Math.round(cx + off - lw);
        l1 = Math.round(cx + off + lw);
        if (l1 <= l0) l1 = l0 + 1;
        ctx.fillRect(l0, y, l1 - l0, 1);
      }
    }
    // ground texture: pebbles / grass tufts / distant lights that scroll with the road
    if (n < 120) {
      const idx = seg.index;
      const cnt = n < 30 ? 7 : 6;
      const spec = pal.spec;
      for (let j = 0; j < cnt; j++) {
        const h1 = hash2(idx, j, 11 + si);
        const h2 = hash2(idx, j, 23 + si);
        const h3 = hash2(idx, j, 37 + si);
        const h4 = hash2(idx, j, 53 + si);
        const y = yTop + Math.floor(h2 * (yBot - yTop));
        const cx = cxA[y], w = wA[y];
        const off = 1.22 + h3 * h3 * 3.4;
        const x = cx + (h1 < 0.5 ? -1 : 1) * off * w;
        if (x < -6 || x > W + 2) continue;
        const sz = Math.max(1, Math.round(w * (0.014 + h4 * 0.034)));
        const pick = h4 < 0.45 ? 0 : h4 < 0.92 ? 1 : 2;
        ctx.fillStyle = spec[pick];
        ctx.fillRect(Math.round(x), y, sz, Math.max(1, Math.round(sz * 0.4)));
        if (pick === 0 && sz > 2) ctx.fillRect(Math.round(x) + 1, y - 1, sz - 2, 1);
      }
    }
  }

  // Scaled sprite on the road (SPEC 3.4 sprite rules)
  drawSprite(spr, canvas, frame, z, offset, seg, fogLevel, fogRgb, stage, glow, variantKey, isCar) {
    const p1 = seg.p1, p2 = seg.p2;
    const percent = (z % SEG_LEN) / SEG_LEN;
    const sScale = lerp(p1.scale, p2.scale, percent);
    const roadW = sScale * ROAD_HALF * HALF_W;
    const destW = spr.worldW * roadW;
    if (!(destW >= 1)) return;
    if (destW > 3600) return;
    const destH = destW * (spr.h / spr.w);
    const sX = lerp(p1.sx, p2.sx, percent) + sScale * offset * ROAD_HALF * HALF_W;
    const sY = lerp(p1.sy, p2.sy, percent);
    if (sX + destW / 2 < 0 || sX - destW / 2 > W || sY < 0) return;
    const dw = Math.max(1, Math.round(destW));
    const dh = Math.max(1, Math.round(destH));
    const dx = Math.round(sX - destW / 2);
    const dy = Math.round(sY - destH);
    const clipH = Math.max(0, Math.round(sY) - seg.clipY);
    if (clipH >= dh) return;

    let img = canvas;
    if (fogLevel >= 1) img = this.assets.tinted(spr, fogRgb, fogLevel, FOG_LEVELS, variantKey || 'n');
    const ctx = this.ctx;
    const sxp = frame * spr.w;
    if (clipH > 0) {
      const srcH = spr.h * (dh - clipH) / dh;
      ctx.drawImage(img, sxp, 0, spr.w, srcH, dx, dy, dw, dh - clipH);
    } else {
      ctx.drawImage(img, sxp, 0, spr.w, spr.h, dx, dy, dw, dh);
    }

    // night lighting: glows for lamps / signs, tail-light bloom for cars
    if (glow && clipH === 0) {
      const A = this.assets;
      const prevOp = ctx.globalCompositeOperation;
      const prevA = ctx.globalAlpha;
      ctx.globalCompositeOperation = 'lighter';
      ctx.imageSmoothingEnabled = true;
      const fade = 1 - fogLevel / (FOG_LEVELS + 1);
      if (isCar) {
        const r = Math.max(2, dw * 0.26);
        ctx.globalAlpha = 0.75 * fade;
        const gy = dy + dh * 0.5;
        ctx.drawImage(A.glows.red, dx + dw * 0.17 - r, gy - r, r * 2, r * 2);
        ctx.drawImage(A.glows.red, dx + dw * 0.83 - r, gy - r, r * 2, r * 2);
      } else if (spr.glow) {
        const g = spr.glow;
        const k = dw / spr.w;
        const gx = variantKey === 'f' ? dx + (spr.w - g.x) * k : dx + g.x * k;
        const r = Math.max(3, g.r * k);
        ctx.globalAlpha = (g.dim ? 0.2 : 0.9) * fade;
        ctx.drawImage(A.glows[g.color], gx - r, dy + g.y * k - r, r * 2, r * 2);
      }
      ctx.globalAlpha = prevA;
      ctx.globalCompositeOperation = prevOp;
      ctx.imageSmoothingEnabled = false;
    }
  }

  drawHeadlights(sim) {
    if (sim.scene === 'title' || sim.scene === 'gameover' || sim.scene === 'ending') { /* still lit */ }
    const ctx = this.ctx;
    const prevOp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    const flick = 0.92 + 0.08 * Math.sin(sim.t * 0.5);
    for (const [top, alpha, spread] of [[210, 0.13, 36], [230, 0.17, 27], [256, 0.21, 19]]) {
      const g = ctx.createLinearGradient(0, 340, 0, top);
      g.addColorStop(0, `rgba(255,240,190,${alpha * 1.6 * flick})`);
      g.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(320 - 62, 341);
      ctx.lineTo(320 + 62, 341);
      ctx.lineTo(320 + spread, top);
      ctx.lineTo(320 - spread, top);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = prevOp;
  }

  drawSpeedLines(sim) {
    const kmh = sim.speed / KMH;
    if (kmh < 250 || (sim.scene !== 'playing' && sim.scene !== 'stageclear')) return;
    const ctx = this.ctx;
    const k = clamp((kmh - 250) / 50, 0, 1);
    const t = sim.t;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    const n = 14 + Math.round(10 * k);
    for (let i = 0; i < n; i++) {
      const ang = (i * 2.399963 + Math.floor(t / 90) * 0.7) % (Math.PI * 2);
      const dxa = Math.cos(ang), dya = Math.sin(ang);
      // skip directions that point straight down at the road (keep the driving line readable)
      if (dya > 0.55 && Math.abs(dxa) < 0.55) continue;
      const speedF = 0.028 + 0.02 * ((i * 7) % 5) / 5;
      const ph = ((t * speedF + i * 0.137) % 1);
      const r0 = 70 + ph * ph * 420;
      const len = 6 + ph * 60;
      ctx.globalAlpha = (0.18 + 0.32 * ph) * k;
      const x0 = 320 + dxa * r0, y0 = 190 + dya * r0 * 0.75;
      const x1 = 320 + dxa * (r0 + len), y1 = 190 + dya * (r0 + len) * 0.75;
      // crisp diagonal streak (1 px steps)
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
      for (let s = 0; s <= steps; s += 1) {
        const u = steps ? s / steps : 0;
        ctx.fillRect(Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u), 1, 1);
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ player
  drawPlayer(sim, night) {
    const ctx = this.ctx;
    const A = this.assets;
    const scene = sim.scene;
    if (scene === 'title') return; // attract mode shows only the road (the camera drives itself)
    // blink while invulnerable: 0.1 s period, hidden half of the time
    if (sim.invuln > 0 && Math.floor(sim.invuln / 3) % 2 === 1) return;

    let dir = 0;
    if (sim.steerDir < 0) dir = 1;
    else if (sim.steerDir > 0) dir = 2;
    let xoff = 0;
    if (sim.crashAge < 44 && (scene === 'playing' || scene === 'paused')) {
      // crash wobble: rapid left-right sway that decays
      const k = 1 - sim.crashAge / 44;
      dir = Math.floor(sim.crashAge / 4) % 2 === 0 ? 1 : 2;
      xoff = Math.round(Math.sin(sim.crashAge * 0.95) * 7 * k);
    }
    const moving = sim.speed > 60;
    let spr, frame;
    if (sim.braking && moving && sim.crashAge >= 44) {
      spr = A.get('car_player_brake');
      frame = dir;
    } else if (moving) {
      spr = A.get('car_player_wheel');
      frame = (Math.floor(sim.t / 6) % 2) * 3 + dir;
    } else {
      spr = A.get('car_player');
      frame = dir;
    }
    let bounce = 0;
    if (sim.speed > 0) {
      const wob = (Math.sin(sim.t * 1.3) + Math.sin(sim.t * 2.9 + 1)) * 0.25 + 0.5; // 0..1
      bounce = sim.offroad ? Math.round(wob * 3) : Math.round(wob);
    }
    const dw = 160, dh = 88;
    const dx = 320 - dw / 2 + xoff;
    const dy = 354 - bounce - dh;
    ctx.drawImage(spr.canvas, frame * spr.w, 0, spr.w, spr.h, dx, dy, dw, dh);

    if (night) {
      const prevOp = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.imageSmoothingEnabled = true;
      const lit = sim.braking && moving ? 0.95 : 0.55;
      ctx.globalAlpha = lit;
      const r = sim.braking && moving ? 30 : 22;
      ctx.drawImage(A.glows.red, dx + 36 - r, dy + 50 - r, r * 2, r * 2);
      ctx.drawImage(A.glows.red, dx + 124 - r, dy + 50 - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = prevOp;
      ctx.imageSmoothingEnabled = false;
    }
  }

  // ------------------------------------------------------------------ effects
  drawFx(sim) {
    const ctx = this.ctx;
    const A = this.assets;
    const fx = sim.fx;
    const smoke = A.get('fx_smoke');
    for (const p of fx.smoke) {
      const frame = Math.min(3, Math.floor(p.age / 7.5));
      const y = p.y - 30 * (p.age / 60);
      ctx.drawImage(smoke.canvas, frame * 12, 0, 12, 12, Math.round(p.x - 12), Math.round(y - 24), 24, 24);
    }
    const dust = A.get('fx_dust');
    for (const p of fx.dust) {
      const frame = Math.min(2, Math.floor((p.age / p.life) * 3));
      ctx.drawImage(dust.canvas, frame * 8, 0, 8, 8, Math.round(p.x - 12), Math.round(p.y - 24), 24, 24);
    }
    const spark = A.get('fx_spark');
    for (const p of fx.sparks) {
      const frame = Math.min(2, Math.floor((p.age / p.life) * 3));
      ctx.drawImage(spark.canvas, frame * 6, 0, 6, 6, Math.round(p.x - 6), Math.round(p.y - 6), 12, 12);
    }
    for (const p of fx.popups) {
      const a = p.age > p.life - 12 ? (p.life - p.age) / 12 : 1;
      const color = p.kind === 'nearmiss' ? '#ffe45a' : '#ffffff';
      drawText(ctx, p.text, p.x, p.y, { scale: p.kind === 'nearmiss' ? 2 : 2, color, outline: '#1a0f2e', align: 'center', alpha: clamp(a, 0, 1) });
    }
  }
}
