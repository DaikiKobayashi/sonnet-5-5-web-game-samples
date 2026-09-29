// Course (road) generation from the section tables (SPEC 3.3).

import { STAGES, SEG_LEN, TAIL_SEGS, RUMBLE_SEGS, clamp } from './config.js';

function makePoint() {
  return { camZ: 0, scale: 0, sx: 0, sy: 0, sw: 0 };
}

export class Segment {
  constructor(index, curve, y1, y2) {
    this.index = index;
    this.z1 = index * SEG_LEN;
    this.z2 = (index + 1) * SEG_LEN;
    this.curve = curve;
    this.y1 = y1; // world height at p1
    this.y2 = y2; // world height at p2
    this.band = Math.floor(index / RUMBLE_SEGS) % 2; // 0 = light, 1 = dark
    this.p1 = makePoint();
    this.p2 = makePoint();
    this.clipY = 0;
    this.sprites = []; // static sprites (roadside objects, gates)
    this.solids = []; // roadside solids (subset of sprites)
    this.cars = []; // per-frame traffic list (filled by the renderer)
  }
}

export class Course {
  constructor(stageNo) {
    const st = STAGES[stageNo - 1];
    this.stage = stageNo;
    this.def = st;
    this.segments = [];
    let y0 = 0;
    let idx = 0;
    for (const [len, curve, dy] of st.sections) {
      for (let k = 0; k < len; k++) {
        const t = (k + 0.5) / len;
        const e = clamp(Math.min(t, 1 - t) / 0.25, 0, 1);
        const f = e * e * (3 - 2 * e);
        const yA = y0 + (dy * (1 - Math.cos((Math.PI * k) / len))) / 2;
        const yB = y0 + (dy * (1 - Math.cos((Math.PI * (k + 1)) / len))) / 2;
        this.segments.push(new Segment(idx++, curve * f, yA, yB));
      }
      y0 += dy;
    }
    this.N = idx;
    if (this.N !== st.N) throw new Error('course length mismatch for stage ' + stageNo + ': ' + this.N + ' != ' + st.N);
    for (let k = 0; k < TAIL_SEGS; k++) {
      this.segments.push(new Segment(idx++, 0, y0, y0));
    }
    this.goalZ = this.N * SEG_LEN;
    this.cpZ = st.cp.map((s) => s * SEG_LEN);
  }

  segmentAt(z) {
    const i = Math.floor(z / SEG_LEN);
    const segs = this.segments;
    return segs[i < 0 ? 0 : i >= segs.length ? segs.length - 1 : i];
  }
}
