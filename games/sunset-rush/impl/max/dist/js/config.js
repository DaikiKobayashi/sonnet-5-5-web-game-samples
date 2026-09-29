// SUNSET RUSH - constants and stage tables (SPEC section 3.2 / 3.3)

export const W = 640;
export const H = 360;
export const HALF_W = W / 2;
export const HALF_H = H / 2;
export const HORIZON = 180;

export const STEP = 1 / 60;
export const SEG_LEN = 200;
export const ROAD_HALF = 2000;
export const LANES = 3;
export const LANE_X = [-2 / 3, 0, 2 / 3];
export const CAM_HEIGHT = 1000;
export const CAM_DEPTH = 1 / Math.tan((100 / 2) * Math.PI / 180); // ~0.8391
export const PLAYER_Z = CAM_HEIGHT * CAM_DEPTH; // ~839.1
export const DRAW_DIST = 200;
export const RUMBLE_SEGS = 3;
export const TAIL_SEGS = 300;

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
export const CRASH_INVULN_STEPS = 72; // 1.2 s
export const CRASH_PUSH = 0.12;
export const PLAYER_HIT_HALFW = 0.10;
export const HIT_Z_WINDOW = 300;

export const STEPS_PER_SEC = 60;
export const COUNTDOWN_STEPS = 180; // 3.0 s
export const GO_STEPS = 48; // ~0.8 s
export const TIMEUP_STEPS = 150; // 2.5 s
export const CLEAR_PANEL_STEPS = 90; // 1.5 s
export const BANNER_STEPS = 120; // 2.0 s
export const CLEAR_DECEL = 3000;
export const TIMEUP_DECEL = 6000;
export const TITLE_SPEED = 7200;

// Background parallax factors (px per segment travelled per unit curve)
export const K_SKY = 0.15;
export const K_FAR = 0.5;
export const K_NEAR = 1.0;

export const SCORE_PER_OVERTAKE = 50;
export const SCORE_CHECKPOINT = 500;
export const SCORE_NEAR_MISS = 20;
export const RANK_S = 33000;
export const RANK_A = 28000;
export const RANK_B = 23000;

export const STORAGE_KEY = 'sunset-rush:v1';

// Section tables: [len, curve, dy]
export const STAGES = [
  {
    id: 1,
    name: 'SEASIDE',
    N: 2160,
    timeStart: 30,
    cp: [720, 1440],
    cpBonus: 18,
    traffic: 36,
    mix: [0.5, 0.25, 0.25], // sedan / truck / sports
    maxCurve: 4,
    solids: ['rs_palm', 'rs_rock', 'rs_billboard'],
    decors: ['rs_shrub'],
    sections: [
      [100, 0, 0], [140, 2, 0], [120, 0, 2000], [160, -2, 0], [140, 3, -2000], [100, 0, 0],
      [180, -3, 2000], [120, 0, 2000], [160, 4, -2000], [140, 0, -2000], [120, -2, 0], [160, 3, 2000],
      [140, 0, -2000], [100, -4, 0], [120, 0, 0], [100, 2, 0], [60, 0, 0],
    ],
  },
  {
    id: 2,
    name: 'PINE RIDGE',
    N: 2592,
    timeStart: 32,
    cp: [864, 1728],
    cpBonus: 20,
    traffic: 54,
    mix: [0.4, 0.3, 0.3],
    maxCurve: 5,
    solids: ['rs_pine', 'rs_boulder', 'rs_signpost'],
    decors: ['rs_fern'],
    sections: [
      [80, 0, 0], [140, 3, 0], [120, 0, 3000], [160, -4, 0], [100, 0, -3000], [140, 4, 2000],
      [160, -3, 4000], [120, 0, -4000], [140, 5, -2000], [100, 0, 0], [180, -5, 3000], [120, 0, -3000],
      [140, 3, 0], [140, -3, 2000], [120, 0, -2000], [160, 5, 0], [100, 0, 3000], [140, -4, -3000],
      [120, 4, 0], [112, 0, 0],
    ],
  },
  {
    id: 3,
    name: 'NEON CITY',
    N: 3024,
    timeStart: 32,
    cp: [1008, 2016],
    cpBonus: 22,
    traffic: 72,
    mix: [0.3, 0.3, 0.4],
    maxCurve: 6,
    solids: ['rs_lamp', 'rs_neon', 'rs_bollard'],
    decors: ['rs_building', 'rs_building_b'],
    sections: [
      [80, 0, 0], [120, 3, 0], [100, 0, 0], [140, -5, 2000], [120, 0, 0], [140, 6, -2000],
      [100, 0, 0], [160, -4, 3000], [140, 4, -3000], [120, 0, 0], [160, -6, 0], [100, 0, 4000],
      [140, 5, -4000], [120, 0, 0], [140, -5, 2000], [120, 3, -2000], [160, 0, 0], [140, 6, 0],
      [120, -6, 0], [100, 0, 3000], [140, 4, -3000], [100, -3, 0], [120, 3, 0], [144, 0, 0],
    ],
  },
];

// Traffic vehicle table (SPEC 3.6)
export const CAR_TYPES = {
  sedan: { id: 'car_sedan', w: 36, h: 20, worldW: 0.225, hit: 0.10, vmin: 80, vmax: 110 },
  truck: { id: 'car_truck', w: 44, h: 34, worldW: 0.275, hit: 0.13, vmin: 60, vmax: 80 },
  sports: { id: 'car_sports', w: 38, h: 18, worldW: 0.2375, hit: 0.10, vmin: 120, vmax: 150 },
};
export const CAR_TYPE_ORDER = ['sedan', 'truck', 'sports'];

// Roadside object table (SPEC 6.2 / 6.3): worldW is width relative to the road half width
export const ROADSIDE = {
  rs_palm: { solid: true, worldW: 0.5, hit: 0.10 },
  rs_rock: { solid: true, worldW: 0.36, hit: 0.14 },
  rs_billboard: { solid: true, worldW: 0.6, hit: 0.16 },
  rs_shrub: { solid: false, worldW: 0.4, hit: 0 },
  rs_pine: { solid: true, worldW: 0.5, hit: 0.09 },
  rs_boulder: { solid: true, worldW: 0.45, hit: 0.16 },
  rs_signpost: { solid: true, worldW: 0.24, hit: 0.06 },
  rs_fern: { solid: false, worldW: 0.35, hit: 0 },
  rs_lamp: { solid: true, worldW: 0.22, hit: 0.05 },
  rs_neon: { solid: true, worldW: 0.7, hit: 0.18 },
  rs_bollard: { solid: true, worldW: 0.14, hit: 0.05 },
  rs_building: { solid: false, worldW: 1.6, hit: 0 },
  rs_building_b: { solid: false, worldW: 1.4, hit: 0 },
};

export const GATE_WORLD_W = 2.6;
export const START_GATE_SEG = 8;

export function pad(n, len) {
  return String(Math.max(0, Math.floor(n))).padStart(len, '0');
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
