// O-6 規模、M01 のルート絶対参照検索、M40 の fillText/strokeText/.font= 検索(ファイルシステムから直接)
import fs from 'fs';
import path from 'path';
import { EFFORTS, GAME_ROOT, EVAL_DIR } from './config.mjs';

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
// 引数で variant を指定した場合はその variant だけを計算し、既存の static.json に追記する(既存キーは変えない)
const ONLY = process.argv.slice(2);
const OUT = path.join(EVAL_DIR, 'raw', 'static.json');
const prev = ONLY.length && fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const out = {};
for (const e of ONLY.length ? ONLY : EFFORTS) {
  const base = path.join(GAME_ROOT, 'impl', e);
  const dist = path.join(base, 'dist');
  const files = walk(dist);
  const src = files.filter((f) => /\.(js|mjs|html|css)$/.test(f));
  let lines = 0, nonEmpty = 0; const perFile = {};
  const absRefs = [], textHits = [];
  for (const f of src) {
    const t = fs.readFileSync(f, 'utf8'); const ls = t.split('\n');
    const n = t.endsWith('\n') ? ls.length - 1 : ls.length;
    lines += n; const ne = ls.filter((l) => l.trim()).length; nonEmpty += ne; perFile[path.relative(dist, f)] = n;
    ls.forEach((l, i) => {
      if (/(src|href)\s*=\s*["']\/(?!\/)|url\(\s*["']?\/(?!\/)|from\s+["']\/(?!\/)|import\(\s*["']\/(?!\/)|fetch\(\s*["']\/(?!\/)/.test(l)) absRefs.push(`${path.relative(dist, f)}:${i + 1}: ${l.trim().slice(0, 140)}`);
      if (/fillText|strokeText|\.font\s*=/.test(l)) textHits.push(`${path.relative(dist, f)}:${i + 1}: ${l.trim().slice(0, 160)}`);
    });
  }
  const outside = walk(base).filter((f) => !f.startsWith(dist + path.sep));
  out[e] = {
    distFiles: files.length,
    distBytes: files.reduce((a, f) => a + fs.statSync(f).size, 0),
    srcLines: lines, srcNonEmptyLines: nonEmpty, perFile,
    outsideDistFiles: outside.length, outsideList: outside.map((f) => path.relative(base, f)),
    indexExists: fs.existsSync(path.join(dist, 'index.html')),
    rootAbsoluteRefs: absRefs, textApiHits: textHits,
  };
}
fs.writeFileSync(OUT, JSON.stringify({ ...prev, ...out }, null, 1));
for (const [e, v] of Object.entries(out)) console.log(e, v.distFiles, v.distBytes, v.srcLines, v.srcNonEmptyLines, 'outside', v.outsideDistFiles, 'abs', v.rootAbsoluteRefs.length, 'text', v.textApiHits.length, v.textApiHits.slice(0, 5));
