'use strict';
// 使い方: NODE_PATH=$(npm root -g) node sheets.js  → screens/<effort>/sheet-*.png(目視評価用のコンタクトシート)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const SHEETS = {
  'sheet-a.png': { files: ['title-0.png', 'intro-1.png', 'play-s1.png', 'play-s2.png', 'play-s3.png', 'play-s4.png', 'play-s5.png', 'entities.png'], cols: 4, scale: 0.5 },
  'sheet-b.png': { files: ['exit-open.png', 'stageclear.png', 'gameover.png', 'gameclear.png', 'paused.png', 'death-frame.png'], cols: 3, scale: 0.5 },
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const e of EFFORTS) {
    const dir = path.join(__dirname, 'screens', e);
    if (!fs.existsSync(dir)) continue;
    for (const [name, def] of Object.entries(SHEETS)) {
      const urls = def.files.filter((f) => fs.existsSync(path.join(dir, f))).map((f) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64'));
      if (!urls.length) continue;
      const out = await page.evaluate(async ({ urls, cols, scale }) => {
        const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });
        const imgs = []; for (const u of urls) imgs.push(await load(u));
        const cw = 480 * scale, ch = 416 * scale, gap = 3;
        const rows = Math.ceil(imgs.length / cols);
        const cv = document.createElement('canvas'); cv.width = cols * (cw + gap) + gap; cv.height = rows * (ch + gap) + gap;
        const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#ff00ff'; g.fillRect(0, 0, cv.width, cv.height);
        imgs.forEach((im, i) => g.drawImage(im, 0, 0, im.width, im.height, gap + (i % cols) * (cw + gap), gap + Math.floor(i / cols) * (ch + gap), cw, ch));
        return cv.toDataURL('image/png');
      }, { urls, cols: def.cols, scale: def.scale });
      fs.writeFileSync(path.join(dir, name), Buffer.from(out.split(',')[1], 'base64'));
    }
    console.log('sheets for', e);
  }
  await browser.close();
})();
