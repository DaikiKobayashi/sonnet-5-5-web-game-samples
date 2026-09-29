// 定数(仕様 3.2)
export const W = 640, H = 360;
export const STEP = 1 / 60;
export const SEG_LEN = 200;
export const ROAD_HALF = 2000;
export const LANES = 3;
export const LANE_X = [-2 / 3, 0, 2 / 3];
export const CAM_HEIGHT = 1000;
export const CAM_DEPTH = 1 / Math.tan((50 * Math.PI) / 180);
export const PLAYER_Z = CAM_HEIGHT * CAM_DEPTH;
export const DRAW_DIST = 200;
export const RUMBLE_SEGS = 3;
export const MAX_SPEED = 12000;
export const KMH = 40; // 1 km/h = 40 u/s
export const M_UNIT = 144; // 144 u = 1 m
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
export const STORAGE_KEY = 'sunset-rush:v1';
