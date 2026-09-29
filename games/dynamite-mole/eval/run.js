'use strict';
// 使い方: NODE_PATH=$(npm root -g) node run.js <effort> [--only=a,b,c] [--out=dir]
// 事前に impl/<effort>/ を README の手順どおり静的サーバーで配信しておく(low 5101 ... max 5105)。
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const GROUPS = {
  a: () => require('./checks_a'),
  b: () => require('./checks_b'),
  c: () => require('./checks_c'),
  d: () => require('./checks_d'),
  e: () => require('./checks_e'),
  f: () => require('./checks_f'),
  g: () => require('./checks_g'),
  h: () => require('./checks_h'),
};
const PLAN = {
  a: ['m1', 'm3', 'm4', 'm5m6m7', 'm8m9m10', 'm39'],
  b: ['m11', 'm12', 'm13', 'm14', 'm15', 'm38'],
  c: ['m16m17m18', 'm19', 'm20', 'm21', 'm22'],
  d: ['m23m24', 'm25m26m27'],
  e: ['m29', 'm30', 'm31', 'm32', 'm33m35'],
  f: ['shouldA', 'shouldB'],
  g: ['shots', 'flow', 'final'],
  h: ['audio'],
};

(async () => {
  const effort = process.argv[2];
  if (!L.EFFORT_PORT[effort]) { console.error('effort を指定してください: low|medium|high|xhigh|max'); process.exit(2); }
  const only = (process.argv.find((a) => a.startsWith('--only=')) || '--only=a,b,c,d,e,f,h,g').slice(7).split(',');
  const outDir = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6) || path.join(__dirname, 'results');
  const testFilter = (process.argv.find((a) => a.startsWith('--fn=')) || '').slice(5);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${effort}.json`);
  const env = new L.Env(effort);
  env.shotDir = path.join(__dirname, 'screens', effort);
  fs.mkdirSync(env.shotDir, { recursive: true });
  const prev = fs.existsSync(outFile) && only.length < Object.keys(GROUPS).length ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : null;
  if (prev) { env.results = prev.results || {}; env.extra = prev.extra || {}; env.issues = prev.issues || []; env.sfxNames = new Set(prev.sfxNames || []); env.dbgWorked = new Set(prev.dbgWorked || []); }
  await env.launch();
  const t0 = Date.now();
  for (const g of only) {
    if (!GROUPS[g]) continue;
    let mod;
    try { mod = GROUPS[g](); } catch (e) { console.log(`[${effort}] group ${g} not available: ${e.message}`); continue; }
    for (const fn of PLAN[g]) {
      if (testFilter && fn !== testFilter) continue;
      if (typeof mod[fn] !== 'function') { console.log(`[${effort}] ${g}.${fn} not implemented`); continue; }
      const t1 = Date.now();
      try { await mod[fn](env); } catch (e) {
        console.log(`[${effort}] ${g}.${fn} threw: ${e.stack || e}`);
        env.results[`ERR:${fn}`] = { pass: null, note: `検証コードが例外: ${e.message}` };
      }
      console.log(`[${effort}] ${g}.${fn} done in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
    }
  }
  await env.close();
  const payload = { effort, ranAt: new Date().toISOString(), elapsedSec: (Date.now() - t0) / 1000, results: env.results, extra: env.extra, issues: env.issues, sfxNames: [...env.sfxNames], dbgWorked: [...env.dbgWorked] };
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 1));
  console.log(`[${effort}] wrote ${outFile} (${payload.elapsedSec.toFixed(0)}s), issues=${env.issues.length}`);
})().catch((e) => { console.error(e); process.exit(1); });
