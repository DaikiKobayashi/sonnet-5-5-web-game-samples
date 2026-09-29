// SUNSET RUSH - 定数とステージ表(仕様書 §3.2 / §3.3)

export const W = 640;
export const H = 360;
export const STEP = 1 / 60;

export const SEG_LEN = 200;
export const ROAD_HALF = 2000;
export const LANES = 3;
export const LANE_X = [-0.667, 0, 0.667];
export const CAM_HEIGHT = 1000;
export const FOV = 100;
export const CAM_DEPTH = 1 / Math.tan((FOV / 2) * Math.PI / 180);
export const PLAYER_Z = CAM_HEIGHT * CAM_DEPTH;
export const DRAW_DIST = 200;
export const RUMBLE_SEGS = 3;

export const MAX_SPEED = 12000;
export const KMH = 40; // 1 km/h = 40 u/s
export const UNITS_PER_M = 144;
export const ACCEL = 2400;
export const BRAKE = 6000;
export const COAST = 1800;
export const OFFROAD_DECEL = 6000;
export const OFFROAD_LIMIT = 3000;
export const STEER_RATE = 2.0;
export const CENTRIFUGAL = 0.3;
export const PLAYER_X_CLAMP = 2.0;
export const CRASH_SPEED_CAP = 2400;
export const CRASH_INVULN = 1.2;
export const CRASH_PUSH = 0.12;
export const PLAYER_HIT_HALFW = 0.10;
export const HIT_Z_WINDOW = 300;

export const HORIZON = 180;
export const TITLE_SPEED = 7200;

// 背景視差の係数(§3.4.1)
export const K_SKY = 0.15;
export const K_FAR = 0.5;
export const K_NEAR = 1.0;

// 車種(§3.6)。speed は km/h
export const CAR_TYPES = {
  sedan: { id: 'car_sedan', w: 36, h: 20, worldW: 0.225, hitHalfW: 0.10, vmin: 80, vmax: 110 },
  truck: { id: 'car_truck', w: 44, h: 34, worldW: 0.275, hitHalfW: 0.13, vmin: 60, vmax: 80 },
  sports: { id: 'car_sports', w: 38, h: 18, worldW: 0.2375, hitHalfW: 0.10, vmin: 120, vmax: 150 },
};
export const CAR_TYPE_KEYS = ['sedan', 'truck', 'sports'];

// 路側物・ゲートの寸法表(§6.2 / §6.3)
export const SPRITE_INFO = {
  rs_palm: { w: 40, h: 72, worldW: 0.50, hit: 0.10 },
  rs_rock: { w: 32, h: 22, worldW: 0.36, hit: 0.14 },
  rs_shrub: { w: 32, h: 20, worldW: 0.40, hit: 0 },
  rs_billboard: { w: 48, h: 56, worldW: 0.60, hit: 0.16 },
  rs_pine: { w: 40, h: 88, worldW: 0.50, hit: 0.09 },
  rs_boulder: { w: 40, h: 28, worldW: 0.45, hit: 0.16 },
  rs_fern: { w: 28, h: 16, worldW: 0.35, hit: 0 },
  rs_signpost: { w: 20, h: 44, worldW: 0.24, hit: 0.06 },
  rs_lamp: { w: 20, h: 88, worldW: 0.22, hit: 0.05 },
  rs_neon: { w: 56, h: 52, worldW: 0.70, hit: 0.18 },
  rs_bollard: { w: 12, h: 16, worldW: 0.14, hit: 0.05 },
  rs_building: { w: 64, h: 128, worldW: 1.60, hit: 0 },
  rs_building_b: { w: 64, h: 112, worldW: 1.40, hit: 0 },
  gate_checkpoint: { w: 160, h: 64, worldW: 2.6, hit: 0 },
  gate_goal: { w: 160, h: 64, worldW: 2.6, hit: 0 },
  gate_start: { w: 160, h: 64, worldW: 2.6, hit: 0 },
};

// 路側物の種類(ステージごと)
export const ROADSIDE_KINDS = {
  1: { solid: ['rs_palm', 'rs_rock', 'rs_billboard'], decor: ['rs_shrub'] },
  2: { solid: ['rs_pine', 'rs_boulder', 'rs_signpost'], decor: ['rs_fern'] },
  3: { solid: ['rs_lamp', 'rs_neon', 'rs_bollard'], decor: ['rs_building', 'rs_building_b'] },
};

// ステージ表(§3.3)。sections = [len, curve, dy]
export const STAGES = [
  {
    no: 1, name: 'SEASIDE', N: 2160, startTime: 30, cpSegs: [720, 1440], cpBonus: 18,
    traffic: 36, mix: [0.5, 0.25, 0.25], maxCurve: 4, bgm: 'bgm_1',
    sections: [
      [100, 0, 0], [140, 2, 0], [120, 0, 2000], [160, -2, 0], [140, 3, -2000], [100, 0, 0],
      [180, -3, 2000], [120, 0, 2000], [160, 4, -2000], [140, 0, -2000], [120, -2, 0], [160, 3, 2000],
      [140, 0, -2000], [100, -4, 0], [120, 0, 0], [100, 2, 0], [60, 0, 0],
    ],
  },
  {
    no: 2, name: 'PINE RIDGE', N: 2592, startTime: 32, cpSegs: [864, 1728], cpBonus: 20,
    traffic: 54, mix: [0.4, 0.3, 0.3], maxCurve: 5, bgm: 'bgm_2',
    sections: [
      [80, 0, 0], [140, 3, 0], [120, 0, 3000], [160, -4, 0], [100, 0, -3000], [140, 4, 2000],
      [160, -3, 4000], [120, 0, -4000], [140, 5, -2000], [100, 0, 0], [180, -5, 3000], [120, 0, -3000],
      [140, 3, 0], [140, -3, 2000], [120, 0, -2000], [160, 5, 0], [100, 0, 3000], [140, -4, -3000],
      [120, 4, 0], [112, 0, 0],
    ],
  },
  {
    no: 3, name: 'NEON CITY', N: 3024, startTime: 32, cpSegs: [1008, 2016], cpBonus: 22,
    traffic: 72, mix: [0.3, 0.3, 0.4], maxCurve: 6, bgm: 'bgm_3',
    sections: [
      [80, 0, 0], [120, 3, 0], [100, 0, 0], [140, -5, 2000], [120, 0, 0], [140, 6, -2000],
      [100, 0, 0], [160, -4, 3000], [140, 4, -3000], [120, 0, 0], [160, -6, 0], [100, 0, 4000],
      [140, 5, -4000], [120, 0, 0], [140, -5, 2000], [120, 3, -2000], [160, 0, 0], [140, 6, 0],
      [120, -6, 0], [100, 0, 3000], [140, 4, -3000], [100, -3, 0], [120, 3, 0], [144, 0, 0],
    ],
  },
];

export const TAIL_SEGMENTS = 300;

// ランク(§3.9)
export function rankFor(score) {
  if (score >= 33000) return 'S';
  if (score >= 28000) return 'A';
  if (score >= 23000) return 'B';
  return 'C';
}
