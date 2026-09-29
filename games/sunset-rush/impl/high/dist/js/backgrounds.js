// 空・遠景・近景(640 幅で水平にシームレス)
import { mk, rect, dot, ell, line } from './pix.js';
import { hash2, hexToRgb, lerp } from './util.js';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function gradientStops(stops, y) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [y0, c0] = stops[i], [y1, c1] = stops[i + 1];
    if (y <= y1) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      return [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];
    }
  }
  return stops[stops.length - 1][1];
}

function skyBase(stops, q) {
  const { c, g } = mk(640, 180);
  const img = g.createImageData(640, 180);
  const d = img.data;
  for (let y = 0; y < 180; y++) {
    const col = gradientStops(stops, y);
    for (let x = 0; x < 640; x++) {
      const b = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * q;
      const i = (y * 640 + x) * 4;
      for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, Math.round((col[k] + b) / q) * q));
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return { c, g };
}

// 水平ラップ付きで描く
function wrap(fn) {
  for (const o of [-640, 0, 640]) fn(o);
}

function cloud(g, x, y, w, h, top, mid, bot) {
  wrap((o) => {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const cx = x + o + (i / (n - 1)) * w, cw = w * (0.22 + 0.1 * hash2(i, x, 1)), chh = h * (0.5 + 0.5 * hash2(i, y, 2));
      ell(g, cx, y - chh * 0.3, cw, chh, mid);
    }
    rect(g, x + o - 4, y - 1, w + 8, h * 0.4, mid);
    // フラットな下面と上面のハイライト
    rect(g, x + o, y + h * 0.15, w, 2, bot);
    rect(g, x + o + 4, y - h * 0.55, w * 0.6, 1, top);
  });
}

function stars(g, count, seed, maxY, cols) {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(hash2(i, 1, seed) * 640), y = Math.floor(hash2(i, 2, seed) * maxY);
    const col = cols[Math.floor(hash2(i, 3, seed) * cols.length)];
    dot(g, x, y, col);
    if (hash2(i, 4, seed) > 0.93) { dot(g, x - 1, y, col); dot(g, x + 1, y, col); dot(g, x, y - 1, col); dot(g, x, y + 1, col); }
  }
}

function glowDisc(g, cx, cy, r, cols, glow) {
  wrap((o) => {
    g.globalAlpha = 0.10;
    for (let k = 4; k >= 1; k--) ell(g, cx + o, cy, r + k * 14, r + k * 14, glow);
    g.globalAlpha = 1;
  });
}

export function makeSky(stage) {
  if (stage === 1) {
    const S = (r, gg, b) => [r, gg, b];
    const { c, g } = skyBase([[0, S(52, 34, 110)], [50, S(150, 62, 140)], [95, S(236, 98, 130)], [135, S(255, 150, 84)], [180, S(255, 214, 128)]], 20);
    glowDisc(g, 470, 158, 40, null, '#ffd27a');
    // 太陽(横縞の切れ込み)
    wrap((o) => {
      ell(g, 470 + o, 158, 42, 42, '#ffb04a');
      ell(g, 470 + o, 158, 38, 38, '#ffd970');
      ell(g, 470 + o, 156, 30, 28, '#fff3b8');
    });
    // 雲
    cloud(g, 60, 62, 120, 12, '#ffd0b8', '#e8709a', '#a04a8a');
    cloud(g, 260, 92, 150, 12, '#ffe0b0', '#ff9a78', '#c05a7a');
    cloud(g, 400, 40, 100, 10, '#ffc8c8', '#d36aa0', '#8a4090');
    cloud(g, 560, 110, 90, 10, '#ffe8b8', '#ffa070', '#d06a78');
    // 鳥
    for (const [bx, by] of [[130, 100], [143, 96], [154, 104]]) { line(g, bx, by, bx + 2, by - 2, '#4a2860'); line(g, bx + 2, by - 2, bx + 4, by, '#4a2860'); }
    return c;
  }
  if (stage === 2) {
    const { c, g } = skyBase([[0, [18, 12, 60]], [55, [52, 30, 110]], [110, [126, 60, 140]], [150, [214, 100, 130]], [180, [255, 164, 120]]], 20);
    stars(g, 70, 21, 100, ['#c8b8ff', '#ffffff', '#9a88e0']);
    glowDisc(g, 150, 150, 26, null, '#ff9ac0');
    wrap((o) => {
      ell(g, 150 + o, 152, 26, 26, '#ffb59a');
      ell(g, 150 + o, 152, 22, 22, '#ffe0c0');
    });
    // 細い雲
    cloud(g, 300, 70, 140, 6, '#c8a0e8', '#6a3a96', '#2f1a60');
    cloud(g, 520, 110, 100, 6, '#e8b0d8', '#8a4a9e', '#3a2064');
    cloud(g, 40, 120, 110, 6, '#e8a0c0', '#9a4a98', '#4a2068');
    return c;
  }
  const { c, g } = skyBase([[0, [2, 3, 12]], [70, [8, 12, 44]], [130, [24, 20, 84]], [180, [78, 30, 112]]], 16);
  stars(g, 190, 31, 130, ['#ffffff', '#bfe8ff', '#ffc8f0', '#9ab8ff']);
  glowDisc(g, 330, 70, 20, null, '#9fd8ff');
  wrap((o) => {
    ell(g, 330 + o, 70, 20, 20, '#d8ecff');
    ell(g, 330 + o, 70, 18, 18, '#f4fbff');
    ell(g, 325 + o, 66, 4, 3, '#c5d8ee');
    ell(g, 337 + o, 76, 3, 3, '#c5d8ee');
    ell(g, 334 + o, 62, 2, 2, '#d0e2f4');
    // 三日月の欠け影
    ell(g, 340 + o, 64, 15, 15, 'rgba(8,12,44,0.0)');
  });
  cloud(g, 120, 110, 130, 6, '#3a2a70', '#1c1850', '#0c0a30');
  cloud(g, 480, 90, 110, 6, '#3a2a70', '#1c1850', '#0c0a30');
  return c;
}

export function makeFar(stage) {
  const { c, g } = mk(640, 96);
  if (stage === 1) {
    // 海(上端 y=58)と島
    const seaTop = 60;
    for (let y = seaTop; y < 96; y++) {
      const t = (y - seaTop) / (96 - seaTop);
      const r = Math.round(lerp(255, 34, Math.pow(t, 0.7))), gg = Math.round(lerp(170, 140, t)), b = Math.round(lerp(140, 156, t));
      rect(g, 0, y, 640, 1, `rgb(${r},${gg},${b})`);
    }
    // 島(シルエット)
    const isle = (x, w, h, col, rim) => wrap((o) => {
      for (let i = 0; i < w; i++) {
        const t = i / w;
        const hh = Math.round(h * Math.sin(t * Math.PI) * (0.75 + 0.25 * hash2(i, x, 5)));
        rect(g, x + o + i, seaTop - hh + 1, 1, hh, col);
        if (hh > 0) dot(g, x + o + i, seaTop - hh + 1, rim);
      }
    });
    isle(40, 110, 22, '#5a3a7c', '#c880a0');
    isle(200, 60, 12, '#6a4488', '#d890a8');
    isle(350, 150, 30, '#4a2f6e', '#c0709a');
    isle(560, 70, 15, '#5a3a7c', '#d080a0');
    // 灯台
    wrap((o) => { rect(g, 430 + o, 24, 3, 12, '#f0e6f0'); rect(g, 430 + o, 26, 3, 2, '#d8353c'); rect(g, 429 + o, 22, 5, 2, '#ffe36a'); });
    // 帆船
    wrap((o) => { for (const bx of [150, 500]) { rect(g, bx + o, seaTop + 6, 8, 1, '#4a2f6e'); for (let i = 0; i < 6; i++) rect(g, bx + o + 3, seaTop + i, 1 + Math.floor((6 - i) / 3), 1, '#fff2e0'); } });
    // 海面のきらめき
    for (let i = 0; i < 260; i++) {
      const x = Math.floor(hash2(i, 1, 41) * 640), y = seaTop + 2 + Math.floor(hash2(i, 2, 41) * 32);
      rect(g, x, y, 2 + Math.floor(hash2(i, 3, 41) * 5), 1, hash2(i, 4, 41) > 0.5 ? 'rgba(255,240,190,0.85)' : 'rgba(255,200,170,0.55)');
    }
    // 岸(緑の丘へ繋がる)
    for (let x = 0; x < 640; x++) {
      const h = 5 + Math.round(3 * Math.sin((x / 640) * Math.PI * 2 * 4) + 2 * Math.sin((x / 640) * Math.PI * 2 * 9));
      rect(g, x, 96 - h, 1, h, '#2f8a56');
      dot(g, x, 96 - h, '#7ad28a');
    }
    return c;
  }
  if (stage === 2) {
    const ridge = (x, k) => {
      const t = (x / 640) * Math.PI * 2;
      return Math.sin(t * 2 + k) * 1.0 + Math.sin(t * 5 + k * 2) * 0.55 + Math.sin(t * 11 + k * 3) * 0.25;
    };
    for (let x = 0; x < 640; x++) {
      const h = Math.round(52 + ridge(x, 1) * 22);
      rect(g, x, 96 - h, 1, h, '#5a3a8c');
      rect(g, x, 96 - h, 1, 2, '#c890c8');
      // 雪/光の縁
      if (ridge(x, 1) > 1.1) rect(g, x, 96 - h + 2, 1, 2, '#a878c0');
    }
    for (let x = 0; x < 640; x++) {
      const h = Math.round(34 + ridge(x, 4) * 14);
      rect(g, x, 96 - h, 1, h, '#3a2a70');
      rect(g, x, 96 - h, 1, 1, '#8a60b0');
    }
    // 松林のシルエット
    for (let x = 0; x < 640; x++) {
      const tri = Math.abs(((x + 3) % 10) - 5);
      const cell = Math.floor(((x + 3) % 640) / 10);
      const h = Math.round(10 + (5 - tri) * 1.1 + 6 * hash2(cell, 2, 7) + 5 * hash2(cell, 1, 7));
      rect(g, x, 96 - h, 1, h, '#1c1a4e');
    }
    rect(g, 0, 92, 640, 4, '#1f4a3a');
    return c;
  }
  // ステージ 3: 街のシルエット
  const layer = (seed, minH, maxH, col, win, litRate) => {
    let x = -5;
    let i = 0;
    while (x < 640) {
      const w = 12 + Math.floor(hash2(i, seed, 1) * 18), h = Math.round(minH + hash2(i, seed, 2) * (maxH - minH));
      wrap((o) => {
        rect(g, x + o, 96 - h, w, h, col);
        rect(g, x + o, 96 - h, w, 1, win.rim);
        if (hash2(i, seed, 3) > 0.7) { rect(g, x + o + Math.floor(w / 2), 96 - h - 6, 1, 6, col); dot(g, x + o + Math.floor(w / 2), 96 - h - 6, '#ff3b3b'); }
        if (hash2(i, seed, 4) > 0.8) rect(g, x + o + 2, 96 - h - 3, w - 4, 3, col);
        for (let wy = 96 - h + 4; wy < 94; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) {
          if (hash2(wx, wy, seed) < litRate) dot(g, wx + o, wy, win.cols[Math.floor(hash2(wx, wy, seed + 1) * win.cols.length)]);
        }
      });
      x += w + Math.floor(hash2(i, seed, 5) * 3);
      i++;
    }
  };
  layer(51, 24, 60, '#141a52', { rim: '#3a4aa0', cols: ['#7a86d8', '#5a66b8'] }, 0.18);
  layer(52, 14, 78, '#0a0d30', { rim: '#ff3fc8', cols: ['#ffd66b', '#7ff3ff', '#ff7ad9'] }, 0.22);
  // 塔
  wrap((o) => {
    rect(g, 300 + o, 6, 2, 30, '#0a0d30');
    rect(g, 297 + o, 30, 8, 66, '#0a0d30');
    rect(g, 295 + o, 34, 12, 3, '#25d0f5');
    rect(g, 299 + o, 42, 4, 1, '#ff3fc8');
    dot(g, 300 + o, 5, '#ff3b3b');
  });
  return c;
}

export function makeNear(stage) {
  const { c, g } = mk(640, 56);
  if (stage === 1) {
    // 手前の丘とヤシのシルエット
    for (let x = 0; x < 640; x++) {
      const t = (x / 640) * Math.PI * 2;
      const h = Math.round(16 + 8 * Math.sin(t * 3 + 1) + 4 * Math.sin(t * 7));
      rect(g, x, 56 - h, 1, h, '#2a7a4e');
      rect(g, x, 56 - h, 1, 2, '#5fc07a');
    }
    for (const px of [60, 190, 330, 470, 590]) {
      const base = 44;
      for (let y = 0; y < 26; y++) rect(g, px + Math.round(Math.sin(y * 0.15) * 2), base - y, 2, 1, '#2a1d36');
      const topx = px + Math.round(Math.sin(26 * 0.15) * 2);
      for (const a of [-2.7, -2.1, -1.5, -0.9, -0.3]) for (let s = 0; s < 10; s++) {
        dot(g, Math.round(topx + Math.cos(a) * s * 1.2), Math.round(base - 26 + Math.sin(a) * s * 0.6 + s * s * 0.03), '#1c3a3a');
        dot(g, Math.round(topx + Math.cos(a) * s * 1.2), Math.round(base - 26 + Math.sin(a) * s * 0.6 + s * s * 0.03) + 1, '#1c3a3a');
      }
    }
    return c;
  }
  if (stage === 2) {
    for (let x = 0; x < 640; x++) {
      const cell = Math.floor(((x + 4) % 640) / 16);
      const tri = Math.abs(((x + 4) % 16) - 8);
      const h = Math.round(16 + (8 - tri) * 2.0 + 16 * hash2(cell, 1, 61));
      rect(g, x, 56 - h, 1, h, '#12261f');
      if (tri < 2) dot(g, x, 56 - h, '#2f5a48');
    }
    rect(g, 0, 50, 640, 6, '#173a2c');
    return c;
  }
  let x = 0, i = 0;
  while (x < 640) {
    const w = 18 + Math.floor(hash2(i, 1, 71) * 30), h = 22 + Math.floor(hash2(i, 2, 71) * 30);
    for (const o of [-640, 0, 640]) {
      rect(g, x + o, 56 - h, w, h, '#070a22');
      rect(g, x + o, 56 - h, w, 1, '#2a3080');
      if (hash2(i, 3, 71) > 0.5) { rect(g, x + o + 3, 56 - h + 4, w - 6, 2, hash2(i, 4, 71) > 0.5 ? '#ff3fc8' : '#25d0f5'); }
      for (let wy = 56 - h + 9; wy < 54; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 5) if (hash2(wx, wy, 72) < 0.3) rect(g, wx + o, wy, 2, 2, '#ffd66b');
    }
    x += w + 2 + Math.floor(hash2(i, 5, 71) * 6);
    i++;
  }
  return c;
}
