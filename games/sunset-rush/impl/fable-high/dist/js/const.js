// Constants from SPEC §3.2 and the stage table §3.3.

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
export const U_PER_M = 144;
export const U_PER_KMH = 40;
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
export const PLAYER_HIT_HALFW = 0.1;
export const HIT_Z_WINDOW = 300;
export const TAIL_SEGS = 300;
export const STORAGE_KEY = 'sunset-rush:v1';

export const TRAFFIC_TYPES = {
  sedan: { id: 'car_sedan', worldW: 0.225, halfW: 0.1, minKmh: 80, maxKmh: 110 },
  truck: { id: 'car_truck', worldW: 0.275, halfW: 0.13, minKmh: 60, maxKmh: 80 },
  sports: { id: 'car_sports', worldW: 0.2375, halfW: 0.1, minKmh: 120, maxKmh: 150 },
};
export const TRAFFIC_ORDER = ['sedan', 'truck', 'sports'];

// Roadside object catalogue (worldW = width relative to road half width).
export const ROADSIDE = {
  rs_palm: { worldW: 0.5, halfW: 0.1 },
  rs_rock: { worldW: 0.36, halfW: 0.14 },
  rs_shrub: { worldW: 0.4 },
  rs_billboard: { worldW: 0.6, halfW: 0.16 },
  rs_pine: { worldW: 0.5, halfW: 0.09 },
  rs_boulder: { worldW: 0.45, halfW: 0.16 },
  rs_fern: { worldW: 0.35 },
  rs_signpost: { worldW: 0.24, halfW: 0.06 },
  rs_lamp: { worldW: 0.22, halfW: 0.05 },
  rs_neon: { worldW: 0.7, halfW: 0.18 },
  rs_building: { worldW: 1.6 },
  rs_building_b: { worldW: 1.4 },
  rs_bollard: { worldW: 0.14, halfW: 0.05 },
};
export const GATE_WORLD_W = 2.6;

export const STAGES = [
  {
    num: 1,
    name: 'SEASIDE',
    N: 2160,
    time: 30,
    cps: [720, 1440],
    cpBonus: 18,
    traffic: 36,
    mix: [0.5, 0.25, 0.25],
    solids: ['rs_palm', 'rs_rock', 'rs_billboard'],
    decors: ['rs_shrub'],
    sections: [
      [100, 0, 0], [140, 2, 0], [120, 0, 2000], [160, -2, 0], [140, 3, -2000], [100, 0, 0],
      [180, -3, 2000], [120, 0, 2000], [160, 4, -2000], [140, 0, -2000], [120, -2, 0], [160, 3, 2000],
      [140, 0, -2000], [100, -4, 0], [120, 0, 0], [100, 2, 0], [60, 0, 0],
    ],
    pal: {
      ground: '#7ab25e',
      grass: ['#86bf66', '#6fa654'],
      rumble: ['#f6eee2', '#d9503f'],
      road: ['#7b7484', '#6d6675'],
      lane: '#f6eedc',
      fog: '#f0a068',
      fogDensity: 3,
    },
  },
  {
    num: 2,
    name: 'PINE RIDGE',
    N: 2592,
    time: 32,
    cps: [864, 1728],
    cpBonus: 20,
    traffic: 54,
    mix: [0.4, 0.3, 0.3],
    solids: ['rs_pine', 'rs_boulder', 'rs_signpost'],
    decors: ['rs_fern'],
    sections: [
      [80, 0, 0], [140, 3, 0], [120, 0, 3000], [160, -4, 0], [100, 0, -3000], [140, 4, 2000],
      [160, -3, 4000], [120, 0, -4000], [140, 5, -2000], [100, 0, 0], [180, -5, 3000], [120, 0, -3000],
      [140, 3, 0], [140, -3, 2000], [120, 0, -2000], [160, 5, 0], [100, 0, 3000], [140, -4, -3000],
      [120, 4, 0], [112, 0, 0],
    ],
    pal: {
      ground: '#2d6a46',
      grass: ['#33774f', '#275f3f'],
      rumble: ['#dcd0ec', '#6c4296'],
      road: ['#544e6c', '#494360'],
      lane: '#ece4fa',
      fog: '#6a4c9c',
      fogDensity: 3,
    },
  },
  {
    num: 3,
    name: 'NEON CITY',
    N: 3024,
    time: 32,
    cps: [1008, 2016],
    cpBonus: 22,
    traffic: 72,
    mix: [0.3, 0.3, 0.4],
    solids: ['rs_lamp', 'rs_neon', 'rs_bollard'],
    decors: ['rs_building', 'rs_building_b'],
    sections: [
      [80, 0, 0], [120, 3, 0], [100, 0, 0], [140, -5, 2000], [120, 0, 0], [140, 6, -2000],
      [100, 0, 0], [160, -4, 3000], [140, 4, -3000], [120, 0, 0], [160, -6, 0], [100, 0, 4000],
      [140, 5, -4000], [120, 0, 0], [140, -5, 2000], [120, 3, -2000], [160, 0, 0], [140, 6, 0],
      [120, -6, 0], [100, 0, 3000], [140, 4, -3000], [100, -3, 0], [120, 3, 0], [144, 0, 0],
    ],
    pal: {
      ground: '#171b2e',
      grass: ['#1d2238', '#141829'],
      rumble: ['#f2f0ff', '#e0309c'],
      road: ['#2e3048', '#262838'],
      lane: '#dde4ff',
      fog: '#090b16',
      fogDensity: 2.5,
    },
  },
];
