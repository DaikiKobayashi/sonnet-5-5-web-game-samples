// 画像アセットの登録(すべて起動時にコードで描く)

import { sheet } from './pix.js';
import { buildFontPix, FONT_CHARS } from './font.js';
import {
  buildPlayerCar, buildSedan, buildTruck, buildSports, SEDAN_COLORS, TRUCK_COLORS, SPORTS_COLORS,
} from './art/cars.js';
import {
  buildPalm, buildRock, buildShrub, buildBillboard, buildPine, buildBoulder, buildFern, buildSignpost,
  buildLamp, buildNeon, buildBollard, buildBuilding, buildBuildingB,
  buildGateCheckpoint, buildGateGoal, buildGateStart,
} from './art/roadside.js';
import {
  buildSky1, buildFar1, buildNear1, buildSky2, buildFar2, buildNear2, buildSky3, buildFar3, buildNear3,
} from './art/backgrounds.js';
import { buildLogo, buildSmoke, buildDust, buildSpark } from './art/ui.js';

let cached = null;

export function getAssets() {
  if (cached) return cached;
  const list = [];
  const byId = {};
  const add = (id, pix, frames = 1) => {
    const a = { id, cv: pix.toCanvas(), frames, fw: pix.w / frames, fh: pix.h };
    list.push(a);
    byId[id] = a;
    return a;
  };

  // 車
  add('car_player', sheet([0, 1, 2].map((d) => buildPlayerCar(d, false, -1))), 3);
  add('car_player_brake', sheet([0, 1, 2].map((d) => buildPlayerCar(d, true, -1))), 3);
  add('car_player_wheel', sheet([0, 1].flatMap((a) => [0, 1, 2].map((d) => buildPlayerCar(d, false, a)))), 6);
  const sedans = SEDAN_COLORS.map((_, v) => buildSedan(v));
  const trucks = TRUCK_COLORS.map((_, v) => buildTruck(v));
  const sports = SPORTS_COLORS.map((_, v) => buildSports(v));
  add('car_sedan', sedans[0]);
  add('car_truck', trucks[0]);
  add('car_sports', sports[0]);
  add('car_sedan_variants', sheet(sedans), sedans.length);
  add('car_truck_variants', sheet(trucks), trucks.length);
  add('car_sports_variants', sheet(sports), sports.length);
  const traffic = {
    sedan: sedans.map((p) => p.toCanvas()),
    truck: trucks.map((p) => p.toCanvas()),
    sports: sports.map((p) => p.toCanvas()),
  };

  // 路側物
  add('rs_palm', buildPalm());
  add('rs_rock', buildRock());
  add('rs_shrub', buildShrub());
  add('rs_billboard', buildBillboard());
  add('rs_pine', buildPine());
  add('rs_boulder', buildBoulder());
  add('rs_fern', buildFern());
  add('rs_signpost', buildSignpost());
  add('rs_lamp', buildLamp());
  add('rs_neon', buildNeon());
  add('rs_bollard', buildBollard());
  add('rs_building', buildBuilding());
  add('rs_building_b', buildBuildingB());

  // ゲート
  add('gate_checkpoint', buildGateCheckpoint());
  add('gate_goal', buildGateGoal());
  add('gate_start', buildGateStart());

  // 背景
  add('bg_sky_1', buildSky1());
  add('bg_sky_2', buildSky2());
  add('bg_sky_3', buildSky3());
  add('bg_far_1', buildFar1());
  add('bg_far_2', buildFar2());
  add('bg_far_3', buildFar3());
  add('bg_near_1', buildNear1());
  add('bg_near_2', buildNear2());
  add('bg_near_3', buildNear3());

  // UI・エフェクト
  add('logo_title', buildLogo());
  add('font_pixel', buildFontPix(), FONT_CHARS.length);
  add('fx_smoke', buildSmoke(), 4);
  add('fx_dust', buildDust(), 3);
  add('fx_spark', buildSpark(), 3);

  cached = { list, byId, traffic };
  return cached;
}
