// Asset registry: builds every image at startup from code (no image files, no network) and keeps
// metadata used by the renderer, the collision tables and the asset gallery.

import { Px, strip, css, mix } from './pixel.js';
import { glyphSheetPx, GLYPH_COUNT } from './font.js';
import { drawPlayerCar, trafficCar } from './art/cars.js';
import { ROADSIDE_DRAWERS } from './art/roadside.js';
import { drawSky, drawFar, drawNear } from './art/backgrounds.js';
import {
  drawGateCheckpoint, drawGateGoal, drawGateStart, drawSmokeFrames, drawDustFrames, drawSparkFrames, drawLogo,
} from './art/ui.js';
import { CAR_TYPES, ROADSIDE, GATE_WORLD_W } from './config.js';

export const MUST_IDS = [
  'car_player', 'car_sedan', 'car_truck', 'car_sports',
  'rs_palm', 'rs_rock', 'rs_shrub', 'rs_pine', 'rs_boulder', 'rs_fern', 'rs_lamp', 'rs_neon', 'rs_building',
  'gate_checkpoint', 'gate_goal',
  'bg_sky_1', 'bg_sky_2', 'bg_sky_3', 'bg_far_1', 'bg_far_2', 'bg_far_3',
  'logo_title', 'font_pixel', 'fx_smoke',
];

// glow anchors (sprite pixel coords) for the night lighting pass
const GLOWS = {
  rs_lamp: { x: 5, y: 8, r: 15, color: 'warm' },
  rs_neon: { x: 28, y: 16, r: 34, color: 'magenta' },
  rs_bollard: { x: 6, y: 1, r: 6, color: 'amber' },
  rs_building: { x: 32, y: 60, r: 40, color: 'cyan', dim: true },
};

function make(id, px, extra = {}) {
  const frames = extra.frames || 1;
  const spr = {
    id,
    px,
    canvas: px.toCanvas(),
    w: px.w / frames,
    h: px.h,
    frames,
    ...extra,
  };
  spr.frames = frames;
  spr.tint = new Map();
  return spr;
}

export class Assets {
  constructor() {
    this.list = []; // ordered, for the gallery
    this.byId = {};
    this.sky = [];
    this.far = [];
    this.near = [];
    this.glows = {};
    this.build();
  }

  add(spr) {
    this.list.push(spr);
    this.byId[spr.id] = spr;
    return spr;
  }

  get(id) {
    return this.byId[id];
  }

  build() {
    // ---- player car
    const dirs = [0, -1, 1];
    this.add(make('car_player', strip(dirs.map((l) => drawPlayerCar({ lean: l }))), { frames: 3, worldW: 0.25, kind: 'car' }));
    this.add(make('car_player_brake', strip(dirs.map((l) => drawPlayerCar({ lean: l, brake: true }))), { frames: 3, worldW: 0.25, kind: 'car' }));
    const wheel = [];
    for (const a of [0, 1]) for (const l of dirs) wheel.push(drawPlayerCar({ lean: l, anim: a }));
    this.add(make('car_player_wheel', strip(wheel), { frames: 6, worldW: 0.25, kind: 'car' }));

    // ---- traffic (3 types x 3 colour variants; variant 0 keeps the plain id)
    for (const type of ['sedan', 'truck', 'sports']) {
      const ct = CAR_TYPES[type];
      for (let v = 0; v < 3; v++) {
        const id = v === 0 ? ct.id : ct.id + '_v' + (v + 1);
        this.add(make(id, trafficCar(type, v), { worldW: ct.worldW, hit: ct.hit, kind: 'traffic', glowTail: true }));
      }
    }

    // ---- roadside objects
    for (const [id, fn] of Object.entries(ROADSIDE_DRAWERS)) {
      const meta = ROADSIDE[id];
      this.add(make(id, fn(), { worldW: meta.worldW, hit: meta.hit, kind: 'roadside', solid: meta.solid, glow: GLOWS[id], flipLeft: id === 'rs_lamp' }));
    }
    // mirrored copies for objects that must face the road from either side
    for (const spr of this.list) {
      if (spr.flipLeft) spr.canvasFlipped = spr.px.flipped().toCanvas();
    }

    // ---- gates
    this.add(make('gate_checkpoint', drawGateCheckpoint(), { worldW: GATE_WORLD_W, kind: 'gate' }));
    this.add(make('gate_goal', drawGateGoal(), { worldW: GATE_WORLD_W, kind: 'gate' }));
    this.add(make('gate_start', drawGateStart(), { worldW: GATE_WORLD_W, kind: 'gate' }));

    // ---- backgrounds
    for (let s = 1; s <= 3; s++) {
      this.sky[s] = this.add(make('bg_sky_' + s, drawSky(s), { kind: 'bg' }));
      this.far[s] = this.add(make('bg_far_' + s, drawFar(s), { kind: 'bg' }));
      this.near[s] = this.add(make('bg_near_' + s, drawNear(s), { kind: 'bg' }));
    }

    // ---- ui / fx
    this.add(make('logo_title', drawLogo(), { kind: 'ui' }));
    this.add(make('font_pixel', glyphSheetPx(Px), { frames: GLYPH_COUNT, kind: 'font' }));
    this.add(make('fx_smoke', strip(drawSmokeFrames()), { frames: 4, kind: 'fx' }));
    this.add(make('fx_dust', strip(drawDustFrames()), { frames: 3, kind: 'fx' }));
    this.add(make('fx_spark', strip(drawSparkFrames()), { frames: 3, kind: 'fx' }));

    // ---- soft glow sprites for additive lighting
    const palette = {
      warm: [255, 226, 150],
      magenta: [255, 70, 210],
      cyan: [80, 235, 255],
      amber: [255, 170, 60],
      red: [255, 50, 60],
      white: [255, 250, 230],
    };
    for (const [k, rgb] of Object.entries(palette)) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.95)`);
      grad.addColorStop(0.25, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.5)`);
      grad.addColorStop(0.6, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.14)`);
      grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      this.glows[k] = c;
    }
  }

  // sprite copy blended toward the fog colour (level 1..levels), cached per sprite and orientation
  tinted(spr, fogRgb, level, levels, variantKey = 'n') {
    const key = fogRgb.join(',') + '|' + level + '|' + variantKey;
    let c = spr.tint.get(key);
    if (c) return c;
    const src = variantKey === 'f' && spr.canvasFlipped ? spr.canvasFlipped : spr.canvas;
    c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = (level / levels) * 0.85;
    g.fillStyle = `rgb(${fogRgb[0]},${fogRgb[1]},${fogRgb[2]})`;
    g.fillRect(0, 0, c.width, c.height);
    spr.tint.set(key, c);
    return c;
  }
}

export function frameRect(spr, frame) {
  return [frame * spr.w, 0, spr.w, spr.h];
}
