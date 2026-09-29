// 受け入れ基準 26: ステージごとの支配色(空・全体の平均色と色相の分布)を数値で確認する
import { open } from './lib.mjs';

const out = [];
for (const stage of [1, 2, 3]) {
  const g = await open({ query: `debug=1&seed=42&stage=${stage}` });
  await g.press('Enter');
  await g.waitScene('playing', 6000);
  await g.wait(1800);
  const r = await g.page.evaluate(() => {
    const d = document.getElementById('game').getContext('2d').getImageData(0, 0, 640, 360).data;
    const region = (y0, y1) => {
      let R = 0; let G = 0; let B = 0; let n = 0;
      const hue = { warm: 0, purple: 0, blue: 0, dark: 0, green: 0, other: 0 };
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < 640; x++) {
          const i = (y * 640 + x) * 4;
          const r = d[i]; const g = d[i + 1]; const b = d[i + 2];
          R += r; G += g; B += b; n++;
          const max = Math.max(r, g, b); const min = Math.min(r, g, b);
          if (max < 60) { hue.dark++; continue; }
          if (r >= g && r >= b && (r - b > 40)) hue.warm++;
          else if (b >= r && b >= g && r > g + 15) hue.purple++;
          else if (b >= r && b >= g) hue.blue++;
          else if (g >= r && g >= b && max - min > 30) hue.green++;
          else hue.other++;
        }
      }
      const tot = n;
      Object.keys(hue).forEach((k) => { hue[k] = +(hue[k] / tot).toFixed(2); });
      return { avg: [Math.round(R / n), Math.round(G / n), Math.round(B / n)], hue };
    };
    return { sky: region(60, 170), ground: region(190, 300), all: region(0, 360) };
  });
  out.push({ stage, ...r });
  await g.close();
}
console.log(JSON.stringify(out, null, 1));
