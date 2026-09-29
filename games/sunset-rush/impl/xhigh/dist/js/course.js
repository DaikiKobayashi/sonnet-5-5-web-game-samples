// コース生成(仕様書 §3.3)

import { STAGES, SEG_LEN, TAIL_SEGMENTS } from './constants.js';
import { clamp } from './util.js';

function makePoint(y, z) {
  return { y, z, camZ: 0, scale: 0, screenX: 0, screenY: 0, screenW: 0 };
}

export function buildCourse(stageNo) {
  const st = STAGES[stageNo - 1];
  const segments = [];

  const add = (curve, yA, yB) => {
    const i = segments.length;
    segments.push({
      index: i,
      curve,
      p1: makePoint(yA, i * SEG_LEN),
      p2: makePoint(yB, (i + 1) * SEG_LEN),
      clipY: 0,
      sprites: [], // 路側物・ゲート(ステージ開始のたびに作り直す)
    });
  };

  let y0 = 0;
  for (const [len, curve, dy] of st.sections) {
    for (let k = 0; k < len; k++) {
      const t = (k + 0.5) / len;
      const e = clamp(Math.min(t, 1 - t) / 0.25, 0, 1);
      const f = e * e * (3 - 2 * e);
      const yA = y0 + dy * (1 - Math.cos(Math.PI * k / len)) / 2;
      const yB = y0 + dy * (1 - Math.cos(Math.PI * (k + 1) / len)) / 2;
      add(curve * f, yA, yB);
    }
    y0 += dy;
  }
  const N = segments.length;
  if (N !== st.N) throw new Error(`stage ${stageNo}: section total ${N} != ${st.N}`);
  for (let i = 0; i < TAIL_SEGMENTS; i++) add(0, y0, y0);

  return {
    stageNo,
    segments,
    N,
    goalZ: N * SEG_LEN,
    cpZ: st.cpSegs.map((s) => s * SEG_LEN),
    length: segments.length,
  };
}
