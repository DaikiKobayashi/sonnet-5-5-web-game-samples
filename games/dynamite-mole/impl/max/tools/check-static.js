/* node tools/check-static.js
 * Static checks of dist/: every script parses as ES2020 (classic script), no forbidden APIs, no ES modules,
 * no fillText, Math.random only for the run seed, no external / root-absolute references, no node_modules in dist. */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const DIST = path.join(__dirname, '..', 'dist');
let fails = 0;
function check(cond, msg) { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; }

let espree = null;
try { espree = require(path.join(cp.execSync('npm root -g').toString().trim(), 'eslint', 'node_modules', 'espree')); } catch (e) { /* optional */ }

const jsDir = path.join(DIST, 'js');
const files = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));
let parsedAll = true;
files.forEach((f) => {
  const src = fs.readFileSync(path.join(jsDir, f), 'utf8');
  if (espree) {
    try { espree.parse(src, { ecmaVersion: 2020, sourceType: 'script' }); } catch (e) { parsedAll = false; console.log('   parse error in ' + f + ': ' + e.message); }
  }
});
check(espree ? parsedAll : true, 'all ' + files.length + ' scripts parse as ES2020 classic scripts' + (espree ? '' : ' (espree not found: skipped)'));

const all = files.map((f) => ({ f, src: fs.readFileSync(path.join(jsDir, f), 'utf8') }));
function none(re, msg) {
  const hits = [];
  all.forEach(({ f, src }) => src.split('\n').forEach((line, i) => { if (re.test(line) && !/^\s*(\/\/|\/\*|\*)/.test(line)) hits.push(f + ':' + (i + 1) + ' ' + line.trim().slice(0, 80)); }));
  check(hits.length === 0, msg + (hits.length ? '  -> ' + hits.slice(0, 4).join(' | ') : ''));
}
none(/\.fillText\s*\(|\.strokeText\s*\(/, 'no fillText / strokeText (all text is the bitmap font)');
none(/\.replaceAll\s*\(|\.at\s*\(-?\d|Object\.hasOwn|structuredClone|\?\?=|\|\|=|&&=|\bimport\s+[\w{*]|\bexport\s+(default|const|function|class)/, 'no post-ES2020 APIs or module syntax');
none(/https?:\/\//, 'no external URLs in scripts');
none(/new\s+Image\s*\(|fetch\s*\(|XMLHttpRequest|importScripts/, 'no network / image loading in scripts');
const rnd = [];
all.forEach(({ f, src }) => src.split('\n').forEach((line, i) => { if (/Math\.random\s*\(/.test(line) && !/^\s*(\/\/|\/\*|\*)/.test(line)) rnd.push(f + ':' + (i + 1)); }));
check(rnd.length === 1 && rnd[0].startsWith('game.js'), 'Math.random() used exactly once (run seed): ' + rnd.join(', '));

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
check(!/type\s*=\s*["']module["']/.test(html), 'no <script type="module">');
const refs = [];
html.replace(/(?:src|href)\s*=\s*["']([^"']+)["']/g, (m, u) => { refs.push(u); return m; });
check(refs.every((u) => u.startsWith('./')), 'every src/href in index.html is a relative ./ path: ' + refs.filter((u) => !u.startsWith('./')).join(','));
check(refs.every((u) => fs.existsSync(path.join(DIST, u.replace(/^\.\//, '')))), 'every referenced file exists');
check(!/\burl\(\s*["']?\//.test(html) && !/https?:\/\//.test(html), 'no root-absolute url() / external URL in index.html');
check(fs.existsSync(path.join(DIST, 'favicon.png')) && /rel=["']icon["']\s+href=["']\.\/favicon\.png["']/.test(html), 'favicon.png exists and is linked');
check(!fs.existsSync(path.join(DIST, 'node_modules')), 'no node_modules inside dist/');
const bigFiles = [];
(function walk(d) { fs.readdirSync(d).forEach((n) => { const p = path.join(d, n), st = fs.statSync(p); if (st.isDirectory()) walk(p); else if (!/\.(js|html|png)$/.test(n)) bigFiles.push(p); }); })(DIST);
check(bigFiles.length === 0, 'dist/ holds only .html/.js/.png files: ' + bigFiles.join(','));
process.exit(fails ? 1 : 0);
