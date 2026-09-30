// 参考実装の画像アセットが既存 5 実装の画像と酷似していないかの確認(7 実装すべての組み合わせを同じ方法で比べる)。
// ?gallery=1 の各 canvas から native サイズのフレームを取り出し(canvas 幅 ÷ (frame-w × frames) の拡大率で最近傍サンプリング)、
//   - フレームの RGBA が完全一致する組
//   - 同じ ID の 1 フレーム目どうしの、不透明マスクの IoU と、両方不透明な画素の平均色差(0〜255)
//   - font_pixel のグリフ(2 値マスク)が一致する数(並び順に依存しないよう、マスクの集合で比較)
// を出す。既存 5 実装どうしの値が「同じ仕様書から独立に作った場合の基準」。出力: eval/raw/asset-similarity.json
// 使い方: 7 実装のサーバー(510x)を起動した状態で node asset-similarity.mjs
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EFFORTS, REFS, PORTS, EVAL_DIR } from './config.mjs';
import { launch, sleep } from './lib.mjs';

const V = [...EFFORTS, ...REFS];
const b = await launch();
const A = {};
for (const v of V) {
  const pg = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await pg.goto(`http://localhost:${PORTS[v]}/dist/?gallery=1`);
  await sleep(2500);
  A[v] = await pg.evaluate(() => {
    const out = {};
    for (const c of document.querySelectorAll('canvas[data-asset-id]')) {
      const id = c.dataset.assetId, fw = +c.dataset.frameW, fh = +c.dataset.frameH, n = +c.dataset.frames;
      if (!fw || !fh || !n) continue;
      const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data;
      // 縦の拡大率を横にも使い、フレーム間の隙間(canvas 幅の余り)を均等に割り振る(隙間なしの実装では 0)
      const sy = c.height / fh, sx = sy;
      const gap = n > 1 ? (c.width - n * fw * sx) / (n - 1) : 0;
      const frames = [];
      for (let f = 0; f < n; f++) {
        const px = [];
        for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
          const X = Math.floor(f * (fw * sx + gap) + (x + 0.5) * sx), Y = Math.floor((y + 0.5) * sy);
          const i = (Y * c.width + X) * 4; px.push(d[i], d[i + 1], d[i + 2], d[i + 3]);
        }
        frames.push(px);
      }
      out[id] = { fw, fh, n, sx: +sx.toFixed(3), sy: +sy.toFixed(3), gap: +gap.toFixed(2), frames };
    }
    return out;
  });
  await pg.context().close();
}
await b.close();

const hash = (px) => crypto.createHash('sha256').update(Buffer.from(px)).digest('hex').slice(0, 16);
const res = { variants: V, scale: {}, exactFrameMatches: [], pairs: {}, font: {} };
for (const v of V) res.scale[v] = Object.fromEntries(Object.entries(A[v]).map(([id, a]) => [id, [a.sx, a.sy, a.gap]]));
// 完全一致
const idx = {};
for (const v of V) for (const [id, a] of Object.entries(A[v])) a.frames.forEach((px, f) => { if (px.some((x, i) => i % 4 === 3 && x > 0)) (idx[hash(px)] ||= []).push(`${v}:${id}#${f}`); });
for (const [h, l] of Object.entries(idx)) if (new Set(l.map((x) => x.split(':')[0])).size > 1) res.exactFrameMatches.push(l);
// 同じ ID の 1 フレーム目どうしの類似
const cmp = (p, q) => {
  let inter = 0, uni = 0, cd = 0, nb = 0;
  for (let i = 0; i < p.length; i += 4) {
    const a = p[i + 3] > 0, c = q[i + 3] > 0;
    if (a || c) uni++;
    if (a && c) { inter++; cd += (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2])) / 3; nb++; }
  }
  return { iou: uni ? inter / uni : 1, colorDiff: nb ? cd / nb : null };
};
const SKIP = new Set(['font_pixel']);
for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
  const a = V[i], c = V[j]; const per = {};
  for (const id of Object.keys(A[a])) {
    if (SKIP.has(id) || !A[c][id]) continue;
    const x = A[a][id], y = A[c][id];
    if (x.fw !== y.fw || x.fh !== y.fh) continue;
    const r = cmp(x.frames[0], y.frames[0]);
    per[id] = { iou: +r.iou.toFixed(3), colorDiff: r.colorDiff == null ? null : +r.colorDiff.toFixed(1) };
  }
  const ious = Object.values(per).map((x) => x.iou).sort((p, q) => p - q);
  const cds = Object.values(per).map((x) => x.colorDiff).filter((x) => x != null).sort((p, q) => p - q);
  res.pairs[`${a}|${c}`] = { n: ious.length, iouMedian: ious[Math.floor(ious.length / 2)], iouMax: ious[ious.length - 1], colorDiffMedian: cds[Math.floor(cds.length / 2)], colorDiffMin: cds[0], highIou: Object.entries(per).filter(([, x]) => x.iou >= 0.9).map(([k, x]) => `${k}(${x.iou}/${x.colorDiff})`), per };
}
// font
const glyphs = (v) => { const f = A[v].font_pixel; if (!f) return []; return f.frames.map((px) => { let s = ''; for (let i = 0; i < px.length; i += 4) s += px[i + 3] > 0 && (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) > 100 ? '#' : '.'; return s; }); };
const G = Object.fromEntries(V.map((v) => [v, glyphs(v)]));
for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
  const a = V[i], c = V[j]; const sa = new Set(G[a].filter((g) => g.includes('#'))), sc = new Set(G[c].filter((g) => g.includes('#')));
  const common = [...sa].filter((g) => sc.has(g)).length;
  let sameIdx = 0; for (let k = 0; k < Math.min(G[a].length, G[c].length); k++) if (G[a][k] === G[c][k] && G[a][k].includes('#')) sameIdx++;
  res.font[`${a}|${c}`] = { glyphsA: sa.size, glyphsB: sc.size, commonMasks: common, sameIndex: sameIdx };
}
res.glyphs = G;
fs.writeFileSync(path.join(EVAL_DIR, 'raw', 'asset-similarity.json'), JSON.stringify(res, null, 1));
const brief = (k) => { const p = res.pairs[k]; return `${k}: n=${p.n} iouMed=${p.iouMedian} cdMed=${p.colorDiffMedian} high=${p.highIou.join(',')}`; };
for (const k of Object.keys(res.pairs)) console.log(brief(k));
for (const [k, f] of Object.entries(res.font)) console.log('font', k, JSON.stringify(f));
console.log('exact frame matches across variants:', res.exactFrameMatches.length, JSON.stringify(res.exactFrameMatches.slice(0, 20)));
