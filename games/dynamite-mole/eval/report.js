'use strict';
// 使い方: node report.js  → results/*.json と manual.json を集計し、results/summary.json と summary.md を書く
const fs = require('fs');
const path = require('path');

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max', 'opus-medium', 'fable-high']; // 末尾 2 つは参考実装
const dir = path.join(__dirname, 'results');
const manual = fs.existsSync(path.join(__dirname, 'manual.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'manual.json'), 'utf8')) : {};

const MUST = Array.from({ length: 40 }, (_, i) => `M${i + 1}`);
const SHOULD = Array.from({ length: 15 }, (_, i) => `S${i + 1}`);

function evalOne(effort) {
  const f = path.join(dir, `${effort}.json`);
  if (!fs.existsSync(f)) return null;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const r = d.results;
  const man = manual[effort] || {};
  const get = (k) => r[k];
  const out = {};
  const put = (id, pass, note, src) => { out[id] = { pass, note: note || '', src }; };
  for (const id of MUST) {
    let v = get(id);
    if (id === 'M17' && v && get('M17b') && get('M17b').pass === false) v = { pass: false, note: v.note + ' / ' + get('M17b').note };
    if (id === 'M28') v = get('M28-auto');
    if (man[id]) { put(id, man[id].pass, man[id].note, 'manual'); continue; }
    if (id === 'M36' || id === 'M37' || id === 'M28') { put(id, null, v ? v.note : '目視未実施', 'auto'); continue; }
    if (!v) { put(id, null, '未計測(検証が実行されなかった)', 'none'); continue; }
    put(id, v.pass, v.note, 'auto');
  }
  // Should
  const sm = d.extra && d.extra.shotMetrics;
  const S = {};
  S.S1 = get('S1'); S.S2 = get('S2'); S.S4 = get('S4'); S.S6 = get('S6'); S.S9 = get('S9');
  if (sm && sm.bombBlink) {
    const b = sm.bombBlink;
    const ok = b.lateRate >= b.earlyRate * 1.3 && b.lateRate > 0;
    S.S7 = { pass: ok, note: `爆弾の絵の変化頻度(回/秒): 導火線 前半 ${b.earlyRate} → 残り 0.8 秒未満 ${b.lateRate}(1.3 倍以上で加速と判定)` };
  }
  if (sm && sm.titleBands) {
    const t = sm.titleBands;
    S.S10 = { pass: t.top > 1 || t.bot > 1, note: `タイトルの 3 秒間の画面変化(領域ごとの異なるフレーム数): 上 ${t.top}・中 ${t.mid}・下 ${t.bot}(中央の PRESS ENTER の点滅を除き、上か下に変化があれば動くと判定)` };
  }
  const a8 = [get('AUDIO-bgm-variety'), get('AUDIO-tempo')];
  if (a8[0] && a8[1]) S.S8 = { pass: a8[0].pass && a8[1].pass, note: `${a8[0].note} / ${a8[1].note}` };
  const hasGc = (d.sfxNames || []).includes('gameClear');
  const jg = get('AUDIO-gameclear-jingle');
  if (jg) S.S14 = { pass: hasGc && jg.pass, note: `sfxLog に gameClear=${hasGc}。${jg.note}` };
  for (const id of SHOULD) {
    if (man[id]) { put(id, man[id].pass, man[id].note, 'manual'); continue; }
    const v = S[id];
    if (!v) { put(id, null, '目視で判定(下記の所見を参照)またはコードで未計測', 'none'); continue; }
    put(id, v.pass, v.note, 'auto');
  }
  const count = (ids) => ({ pass: ids.filter((i) => out[i].pass === true).length, fail: ids.filter((i) => out[i].pass === false).length, unknown: ids.filter((i) => out[i].pass === null).length, total: ids.length });
  return { effort, ranAt: d.ranAt, elapsedSec: d.elapsedSec, must: count(MUST), should: count(SHOULD), items: out, issues: d.issues.length, extra: d.extra, info: Object.fromEntries(Object.entries(r).filter(([k]) => /^(EXTRA|INFO|AUDIO|ERR)/.test(k))), fillText: d.extra && d.extra.fillTextCalls };
}

const all = {};
for (const e of EFFORTS) { const r = evalOne(e); if (r) all[e] = r; }
fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(all, null, 1));

let md = '# 評価ハーネスの集計(自動生成)\n\n';
md += '| effort | Must 合格 | Must 不合格 | Must 未判定 | Should 合格 | Should 不合格 | Should 未判定 | console/404 等 | 測定時間 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n';
for (const e of Object.keys(all)) { const r = all[e]; md += `| ${e} | ${r.must.pass}/40 | ${r.must.fail} | ${r.must.unknown} | ${r.should.pass}/15 | ${r.should.fail} | ${r.should.unknown} | ${r.issues} | ${Math.round(r.elapsedSec)}s |\n`; }
md += '\n## 項目別\n\n| 項目 | ' + Object.keys(all).join(' | ') + ' |\n| --- | ' + Object.keys(all).map(() => '---').join(' | ') + ' |\n';
const sym = (p) => (p === true ? '○' : p === false ? '×' : '?');
for (const id of [...MUST, ...SHOULD]) md += `| ${id} | ${Object.keys(all).map((e) => sym(all[e].items[id].pass) + (all[e].items[id].src === 'manual' ? '(目視)' : '')).join(' | ')} |\n`;
md += '\n## 不合格・未判定の詳細\n\n';
for (const e of Object.keys(all)) {
  md += `### ${e}\n\n`;
  for (const id of [...MUST, ...SHOULD]) { const it = all[e].items[id]; if (it.pass !== true) md += `- **${id}** ${sym(it.pass)}: ${it.note}\n`; }
  md += '\n';
}
fs.writeFileSync(path.join(dir, 'summary.md'), md);
console.log(md.split('\n').slice(0, 12).join('\n'));
