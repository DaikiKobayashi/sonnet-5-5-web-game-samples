// 疑似 3D 描画(仕様書 §3.4)。セグメント投影 + スプライト拡縮 + 視差背景。

import {
  W, H, SEG_LEN, ROAD_HALF, CAM_HEIGHT, CAM_DEPTH, PLAYER_Z, DRAW_DIST, RUMBLE_SEGS, HORIZON,
  KMH, CRASH_INVULN, STAGES,
} from './constants.js';
import { mixHex, parseHex, clamp } from './util.js';

// ステージごとの配色。[明, 暗] の 2 色ペア(縞用)
const THEMES = [
  null,
  {
    grass: ['#46b894', '#369f83'], rumble: ['#fff0dc', '#e2384a'], road: ['#9d8a9e', '#8b788f'],
    lane: '#fff0dc', fog: '#ffcf9c', night: false,
  },
  {
    grass: ['#318f5b', '#287d4d'], rumble: ['#dccdff', '#7a56d0'], road: ['#66618a', '#585378'],
    lane: '#ece2ff', fog: '#b9709e', night: false,
  },
  {
    grass: ['#16263e', '#0e1a2f'], rumble: ['#ff4fc0', '#26d6ec'], road: ['#323a72', '#282e5c'],
    lane: '#5af0ff', fog: '#5a2a84', night: true,
  },
];

const FOG_LEVELS = 24;

function buildFogTable(theme) {
  const tab = [];
  for (let i = 0; i < FOG_LEVELS; i++) {
    const f = (i / (FOG_LEVELS - 1)) * 0.95;
    tab.push({
      grass: [mixHex(theme.grass[0], theme.fog, f), mixHex(theme.grass[1], theme.fog, f)],
      rumble: [mixHex(theme.rumble[0], theme.fog, f), mixHex(theme.rumble[1], theme.fog, f)],
      road: [mixHex(theme.road[0], theme.fog, f), mixHex(theme.road[1], theme.fog, f)],
      lane: mixHex(theme.lane, theme.fog, f),
    });
  }
  return tab;
}

function fogLevel(n) {
  const t = n / (DRAW_DIST - 1);
  return Math.min(FOG_LEVELS - 1, Math.floor(Math.pow(t, 2.2) * (FOG_LEVELS - 1) + 0.5));
}

// 事前に作る発光スプライト(加算合成用)
function makeGlow(rgb, size = 64) {
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${rgb},0.95)`);
  grad.addColorStop(0.25, `rgba(${rgb},0.5)`);
  grad.addColorStop(0.6, `rgba(${rgb},0.16)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return cv;
}

const mod = (a, n) => ((a % n) + n) % n;

export class Renderer {
  constructor(ctx, assets) {
    this.ctx = ctx;
    this.assets = assets;
    this.fog = [null, buildFogTable(THEMES[1]), buildFogTable(THEMES[2]), buildFogTable(THEMES[3])];
    this.glow = {
      warm: makeGlow('255,220,120'), pink: makeGlow('255,80,200'), cyan: makeGlow('80,240,255'),
      red: makeGlow('255,50,50'), white: makeGlow('255,255,255'),
    };
    // 地平線付近の霞(縦グラデーション)
    this.haze = [null, 1, 2, 3].map((st) => {
      if (!st) return null;
      const [r, g, b] = parseHex(THEMES[st].fog);
      const grad = ctx.createLinearGradient(0, HORIZON, 0, HORIZON + 40);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.95)`);
      grad.addColorStop(0.35, `rgba(${r},${g},${b},0.55)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      return grad;
    });
    this.carBuckets = [];
    for (let i = 0; i < DRAW_DIST; i++) this.carBuckets.push([]);
    this.lastN = 0;
    // ヘッドライトの光(夜)
    this.beam = (() => {
      const cv = document.createElement('canvas');
      cv.width = 128; cv.height = 128;
      const g = cv.getContext('2d');
      const grad = g.createLinearGradient(0, 128, 0, 0);
      grad.addColorStop(0, 'rgba(255,240,180,0.55)');
      grad.addColorStop(0.5, 'rgba(255,240,180,0.18)');
      grad.addColorStop(1, 'rgba(255,240,180,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(40, 128); g.lineTo(88, 128); g.lineTo(124, 0); g.lineTo(4, 0);
      g.closePath();
      g.fill();
      return cv;
    })();
  }

  // ------------------------------------------------------------------ 背景

  drawBackground(game) {
    const { ctx, assets } = this;
    const st = game.worldStage;
    const theme = THEMES[st];
    const tab = this.fog[st];
    ctx.imageSmoothingEnabled = false;
    // 地面色(丘で道路が隠れたときに見える遠方の草)。地平線に近いほどフォグ色に溶ける
    ctx.fillStyle = tab[11].grass[1];
    ctx.fillRect(-8, HORIZON, W + 16, H - HORIZON + 8);
    ctx.fillStyle = this.haze[st];
    ctx.fillRect(-8, HORIZON, W + 16, 40);
    ctx.fillStyle = theme.fog;
    ctx.fillRect(-8, -8, W + 16, HORIZON + 8);
    const layers = [
      [assets.byId[`bg_sky_${st}`].cv, game.bg.sky, 0],
      [assets.byId[`bg_far_${st}`].cv, game.bg.far, HORIZON - 96],
      [assets.byId[`bg_near_${st}`].cv, game.bg.near, HORIZON - 56],
    ];
    for (const [cv, off, y] of layers) {
      const x = -mod(Math.round(off), 640);
      if (x > -16) ctx.drawImage(cv, x - 640, y); // 画面シェイクで端が見えないように
      ctx.drawImage(cv, x, y);
      ctx.drawImage(cv, x + 640, y);
    }
  }

  // ------------------------------------------------------------------ 道路

  project(p, camX, camY, camZ) {
    p.camZ = p.z - camZ;
    const scale = p.camZ > 0.001 ? CAM_DEPTH / p.camZ : 1e6;
    p.scale = scale;
    p.screenX = Math.round(W / 2 + scale * (-camX) * (W / 2));
    p.screenY = Math.round(H / 2 - scale * (p.y - camY) * (H / 2));
    p.screenW = Math.round(scale * ROAD_HALF * (W / 2));
  }

  drawRoad(game) {
    const { ctx } = this;
    const segs = game.course.segments;
    const st = game.worldStage;
    const tab = this.fog[st];
    const pos = game.pos;
    const playerX = game.playerX;
    const playerZ = pos + PLAYER_Z;
    const baseIdx = Math.floor(pos / SEG_LEN);
    const basePercent = (pos % SEG_LEN) / SEG_LEN;
    const playerSeg = segs[clamp(Math.floor(playerZ / SEG_LEN), 0, segs.length - 1)];
    const playerPercent = (playerZ % SEG_LEN) / SEG_LEN;
    const playerY = playerSeg.p1.y + (playerSeg.p2.y - playerSeg.p1.y) * playerPercent;
    const cameraY = CAM_HEIGHT + playerY;

    let maxY = H;
    let x = 0;
    let dx = -segs[baseIdx].curve * basePercent;
    let last = -1;
    for (let n = 0; n < DRAW_DIST; n++) {
      const seg = segs[baseIdx + n];
      if (!seg) break;
      last = n;
      seg.clipY = maxY;
      const cx1 = playerX * ROAD_HALF - x;
      const cx2 = playerX * ROAD_HALF - x - dx;
      this.project(seg.p1, cx1, cameraY, pos);
      this.project(seg.p2, cx2, cameraY, pos);
      x += dx;
      dx += seg.curve;
      const p1 = seg.p1;
      const p2 = seg.p2;
      if (p1.camZ <= CAM_DEPTH || p2.screenY >= p1.screenY || p2.screenY >= maxY) continue;

      // 描く行の範囲 [yTop, yBot)
      const yTop = Math.max(p2.screenY, 0);
      const yBot = Math.min(p1.screenY, maxY, H);
      if (yBot > yTop) {
        const band = Math.floor(seg.index / RUMBLE_SEGS) % 2;
        const col = tab[fogLevel(n)];
        const hh = p1.screenY - p2.screenY;
        const dX = p1.screenX - p2.screenX;
        const dW = p1.screenW - p2.screenW;

        ctx.fillStyle = col.grass[band];
        ctx.fillRect(-8, yTop, W + 16, yBot - yTop);

        // 路肩
        ctx.beginPath();
        for (let y = yTop; y < yBot; y++) {
          const t = (y + 0.5 - p2.screenY) / hh;
          const cx = p2.screenX + dX * t;
          const w = p2.screenW + dW * t;
          const rw = w / 6;
          const xl = Math.round(cx - w);
          const xr = Math.round(cx + w);
          ctx.rect(Math.round(cx - w - rw), y, xl - Math.round(cx - w - rw), 1);
          ctx.rect(xr, y, Math.round(cx + w + rw) - xr, 1);
        }
        ctx.fillStyle = col.rumble[band];
        ctx.fill();

        // 路面
        ctx.beginPath();
        for (let y = yTop; y < yBot; y++) {
          const t = (y + 0.5 - p2.screenY) / hh;
          const cx = p2.screenX + dX * t;
          const w = p2.screenW + dW * t;
          const xl = Math.round(cx - w);
          ctx.rect(xl, y, Math.round(cx + w) - xl, 1);
        }
        ctx.fillStyle = col.road[band];
        ctx.fill();

        // レーン区切り線(色帯が明のセグメントのみ)
        if (band === 0) {
          ctx.beginPath();
          for (let y = yTop; y < yBot; y++) {
            const t = (y + 0.5 - p2.screenY) / hh;
            const cx = p2.screenX + dX * t;
            const w = p2.screenW + dW * t;
            const lw = Math.max(1, Math.round(w / 32));
            if (w < 10) continue;
            const lx = w / 3;
            ctx.rect(Math.round(cx - lx - lw / 2), y, lw, 1);
            ctx.rect(Math.round(cx + lx - lw / 2), y, lw, 1);
          }
          ctx.fillStyle = col.lane;
          ctx.fill();
        }
      }
      maxY = p2.screenY;
    }
    this.lastN = last;
    this.baseIdx = baseIdx;
  }

  // ------------------------------------------------------------------ スプライト

  // 1 つのスプライトを描く。描いた矩形 {x,y,w,h}(切り取り前の全体)を返す(発光用)
  sprite(cv, srcX, nw, nh, z, offset, worldW, seg, pos, alpha) {
    if (z - pos < 100) return null;
    const percent = (z % SEG_LEN) / SEG_LEN;
    const s1 = seg.p1;
    const s2 = seg.p2;
    const sScale = s1.scale + (s2.scale - s1.scale) * percent;
    if (sScale <= 0) return null;
    const half = ROAD_HALF * (W / 2);
    const roadW = sScale * half;
    const destW = worldW * roadW;
    if (destW < 1) return null;
    const sX = s1.screenX + (s2.screenX - s1.screenX) * percent + sScale * offset * half;
    const sY = s1.screenY + (s2.screenY - s1.screenY) * percent;
    const destH = destW * (nh / nw);
    if (destW > 3000 || destH > 3000) return null;
    const dxr = Math.round(sX - destW / 2);
    const dwr = Math.max(1, Math.round(destW));
    const bottom = Math.round(sY);
    const dhr = Math.max(1, Math.round(destH));
    const top = bottom - dhr;
    if (dxr > W || dxr + dwr < 0 || top > H) return null;
    const visBottom = Math.min(bottom, Math.round(seg.clipY));
    const visH = visBottom - top;
    const rect = { x: dxr, y: top, w: dwr, h: dhr };
    if (visH <= 0) return rect;
    const { ctx } = this;
    if (alpha < 1) ctx.globalAlpha = alpha;
    if (visH >= dhr) {
      ctx.drawImage(cv, srcX, 0, nw, nh, dxr, top, dwr, dhr);
    } else {
      const srcH = Math.max(1, Math.round(nh * (visH / dhr)));
      ctx.drawImage(cv, srcX, 0, nw, srcH, dxr, top, dwr, visH);
    }
    if (alpha < 1) ctx.globalAlpha = 1;
    return rect;
  }

  glowAt(name, x, y, r, a) {
    if (r < 1.5) return;
    const { ctx } = this;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    ctx.drawImage(this.glow[name], x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  drawSprites(game) {
    const { assets } = this;
    const segs = game.course.segments;
    const pos = game.pos;
    const baseIdx = this.baseIdx;
    const last = this.lastN;
    const night = THEMES[game.worldStage].night;

    // 交通車を所属セグメントごとに振り分ける
    const buckets = this.carBuckets;
    for (let i = 0; i <= last; i++) buckets[i].length = 0;
    for (const c of game.traffic) {
      const n = Math.floor(c.z / SEG_LEN) - baseIdx;
      if (n >= 0 && n <= last) buckets[n].push(c);
    }

    for (let n = last; n >= 0; n--) {
      const seg = segs[baseIdx + n];
      const fa = n > 60 ? 1 - 0.7 * Math.pow(clamp((n - 60) / 140, 0, 1), 1.5) : 1;
      // 路側物・ゲート(遠い順)
      const list = seg.sprites;
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        const a = assets.byId[o.id];
        const r = this.sprite(a.cv, 0, a.fw, a.fh, o.z, o.x, o.worldW, seg, pos, o.gate ? Math.max(fa, 0.85) : fa);
        if (r && night) this.nightGlow(o.id, r);
      }
      // 交通車
      const bk = buckets[n];
      if (bk.length > 1) bk.sort((p, q) => q.z - p.z);
      for (let i = 0; i < bk.length; i++) {
        const c = bk[i];
        const cv = assets.traffic[c.type][c.variant];
        const r = this.sprite(cv, 0, c.nw, c.nh, c.z, c.x, c.worldW, seg, pos, fa);
        if (r && night) {
          // テールランプのにじみ
          const gy = r.y + r.h * (c.type === 'truck' ? 0.74 : c.type === 'sports' ? 0.5 : 0.66);
          const gr = r.w * (c.type === 'truck' ? 0.16 : 0.22);
          this.glowAt('red', r.x + r.w * 0.2, gy, gr, 0.75 * fa);
          this.glowAt('red', r.x + r.w * 0.8, gy, gr, 0.75 * fa);
        }
      }
    }
  }

  nightGlow(id, r) {
    if (id === 'rs_lamp') {
      this.glowAt('warm', r.x + r.w * 0.78, r.y + r.h * 0.08, r.w * 2.6, 0.9);
    } else if (id === 'rs_neon') {
      this.glowAt('pink', r.x + r.w * 0.5, r.y + r.h * 0.34, r.w * 0.85, 0.6);
      this.glowAt('cyan', r.x + r.w * 0.5, r.y + r.h * 0.3, r.w * 0.55, 0.4);
    } else if (id === 'rs_building' || id === 'rs_building_b') {
      this.glowAt('pink', r.x + r.w * 0.5, r.y + r.h * 0.5, r.w * 0.9, 0.16);
    } else if (id === 'rs_bollard') {
      this.glowAt('warm', r.x + r.w * 0.5, r.y + r.h * 0.2, r.w * 1.6, 0.6);
    } else if (id === 'gate_checkpoint' || id === 'gate_start') {
      this.glowAt('cyan', r.x + r.w * 0.5, r.y + r.h * 0.22, r.w * 0.5, 0.25);
    }
  }

  // ------------------------------------------------------------------ プレイヤー車

  drawPlayer(game) {
    const { ctx, assets } = this;
    // 無敵中の点滅(0.1 秒周期、半分は非表示)
    if (game.invulnTimer > 0) {
      const el = CRASH_INVULN - game.invulnTimer;
      if (mod(el, 0.1) < 0.05) return;
    }
    let dir = game.steerInput < 0 ? 1 : game.steerInput > 0 ? 2 : 0;
    if (game.crashAge < 0.5) dir = Math.floor(game.crashAge / 0.06) % 2 ? 1 : 2;
    const moving = game.speed > 0;
    let a;
    let frame;
    if (game.brakeInput && moving) {
      a = assets.byId.car_player_brake;
      frame = dir;
    } else if (moving) {
      a = assets.byId.car_player_wheel;
      frame = (Math.floor(game.tick / 6) % 2) * 3 + dir;
    } else {
      a = assets.byId.car_player;
      frame = dir;
    }
    // 見た目専用の揺れ(tick から決めるので一時停止で止まる)
    const hsh = (Math.imul(game.tick, 2654435761) >>> 24) & 0xff;
    let bounce = 0;
    if (moving) bounce = game.offroad ? hsh % 4 : hsh % 2;
    if (game.crashAge < 0.5) bounce += 1 + (hsh % 2);
    const night = THEMES[game.worldStage].night;
    if (night && game.scene !== 'title') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.85;
      ctx.drawImage(this.beam, 320 - 92, 236 - bounce, 184, 100);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(a.cv, frame * a.fw, 0, a.fw, a.fh, 240, 354 - bounce - 88, 160, 88);
    if (night) {
      this.glowAt('red', 262, 354 - bounce - 88 + 52, 18, game.brakeInput ? 0.9 : 0.5);
      this.glowAt('red', 378, 354 - bounce - 88 + 52, 18, game.brakeInput ? 0.9 : 0.5);
    }
  }

  drawEffects(game) {
    const { ctx, assets } = this;
    ctx.imageSmoothingEnabled = false;
    // 砂煙
    const dust = assets.byId.fx_dust;
    for (const p of game.dust) {
      const f = Math.min(2, Math.floor((p.age / 0.45) * 3));
      const size = Math.round(8 * (1.4 + p.age * 3));
      ctx.drawImage(dust.cv, f * dust.fw, 0, dust.fw, dust.fh, Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size);
    }
    // 煙(2 倍の大きさ、0.5 秒で 4 フレーム)
    const sm = assets.byId.fx_smoke;
    for (const p of game.puffs) {
      const f = Math.min(3, Math.floor((p.age / 0.5) * 4));
      ctx.drawImage(sm.cv, f * sm.fw, 0, sm.fw, sm.fh, Math.round(p.x - 12), Math.round(p.y - 12), 24, 24);
    }
    // 火花
    const sp = assets.byId.fx_spark;
    for (const p of game.sparks) {
      const f = Math.min(2, Math.floor((p.age / 0.3) * 3));
      ctx.drawImage(sp.cv, f * sp.fw, 0, sp.fw, sp.fh, Math.round(p.x - 6), Math.round(p.y - 6), 12, 12);
    }
  }

  // 速度感演出(250km/h 以上)
  drawSpeedLines(game) {
    const kmh = game.speed / KMH;
    if (kmh < 250) return;
    const { ctx } = this;
    const k = (kmh - 250) / 50;
    const n = 16;
    ctx.save();
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const h = (Math.imul(i * 7919 + (game.tick >> 1) * 104729, 2654435761) >>> 20) / 4096;
      const ang = (i / n) * Math.PI * 2 + h * 0.3;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const r0 = 190 + h * 90;
      const r1 = r0 + 40 + h * 60 + k * 40;
      const x0 = 320 + c * r0 * 1.4;
      const y0 = 190 + s * r0 * 0.75;
      const x1 = 320 + c * r1 * 1.4;
      const y1 = 190 + s * r1 * 0.75;
      ctx.strokeStyle = `rgba(255,255,255,${0.16 + 0.22 * k})`;
      ctx.beginPath();
      ctx.moveTo(Math.round(x0) + 0.5, Math.round(y0) + 0.5);
      ctx.lineTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ 1 フレーム

  drawWorld(game, opts = {}) {
    const { ctx } = this;
    let sx = 0;
    let sy = 0;
    if (game.shakeT > 0 && !opts.noShake) {
      const amp = 1 + (game.shakeT / 0.3) * 3;
      sx = Math.round((Math.random() * 2 - 1) * amp);
      sy = Math.round((Math.random() * 2 - 1) * amp);
    }
    ctx.save();
    ctx.translate(sx, sy);
    this.drawBackground(game);
    this.drawRoad(game);
    this.drawSprites(game);
    if (!opts.hideCar) this.drawPlayer(game);
    this.drawEffects(game);
    ctx.restore();
    this.drawSpeedLines(game);
  }
}

export { THEMES, STAGES };
