// ギャラリーの全 canvas を 1 枚のシートに並べる(目視用)。各 canvas を toDataURL で取り出し、ID ラベル付きで縦に積む
import path from 'path';
import { EFFORTS, PORTS, EVAL_DIR } from './config.mjs';
import { launch, saveDataUrl, sleep } from './lib.mjs';

const b = await launch();
for (const e of process.argv[2] ? [process.argv[2]] : EFFORTS) {
  const pg = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await pg.goto(`http://localhost:${PORTS[e]}/dist/?gallery=1`);
  await sleep(2000);
  const groups = { cars: /^(car_|fx_)/, roadside: /^(rs_|gate_)/, bg: /^(bg_|logo_|font_)/ };
  for (const [g, re] of Object.entries(groups)) {
    const d = await pg.evaluate((src) => {
      const re = new RegExp(src);
      const list = [...document.querySelectorAll('canvas[data-asset-id]')].filter((c) => re.test(c.dataset.assetId));
      // native サイズの frames 枚に分けて、4 倍(背景は 1 倍)で描き直す
      const items = list.map((c) => {
        const fw = +c.dataset.frameW, fh = +c.dataset.frameH, n = +c.dataset.frames;
        const big = fw >= 200; const s = big ? 1 : (fw <= 12 ? 6 : 3);
        const sc = c.width / (fw * n); // gallery での拡大率
        const nn = c.dataset.assetId === 'font_pixel' ? n : Math.min(n, 8);
        return { c, fw, fh, n: nn, s, sc, id: c.dataset.assetId + ' x' + n };
      });
      const W = 1280; let y = 0; const rows = [];
      let x = 0, rowH = 0;
      for (const it of items) {
        const w = it.id.startsWith('font_pixel') ? Math.min(W, it.fw * it.s * 2 * it.n) : it.fw * it.s * it.n + 8;
        if (x + w > W) { y += rowH + 16; x = 0; rowH = 0; }
        rows.push({ it, x, y, w }); x += Math.max(w, 120) + 8; rowH = Math.max(rowH, it.fh * it.s * (it.id.startsWith('font_pixel') ? 2 : 1) + 4);
      }
      const H = y + rowH + 20;
      const out = document.createElement('canvas'); out.width = W; out.height = H; const g = out.getContext('2d');
      g.fillStyle = '#556'; g.fillRect(0, 0, W, H); g.imageSmoothingEnabled = false; g.font = '11px monospace';
      for (const { it, x, y } of rows) {
        const s = it.id.startsWith('font_pixel') ? it.s * 2 : it.s;
        g.drawImage(it.c, 0, 0, it.c.width * Math.min(1, it.n / (+it.c.dataset.frames)), it.c.height, x, y, it.fw * s * it.n, it.fh * s);
        g.fillStyle = '#fff'; g.fillText(it.id, x, y + it.fh * s + 12);
      }
      return out.toDataURL('image/png');
    }, re.source);
    await saveDataUrl(d, path.join(EVAL_DIR, 'screenshots', e, `o7-gallery-${g}.png`));
  }
  await pg.context().close();
}
await b.close();
