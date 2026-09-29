// Builds the GitHub Pages site into _site/:
//   /                          home: pick a game
//   /games/<game-id>/          pick which effort to open
//   /games/<game-id>/<effort>/ the implementation (copied from games/<game-id>/impl/<effort>/dist/)
//
// Usage: node scripts/build-site.mjs [--root <dir>] [--out <dir>] [--serve] [--port 8080]
// Zero dependencies. All generated links are relative so the site works under /<repo>/ on Pages.
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const EFFORTS = [
  { id: 'low', ja: '低' },
  { id: 'medium', ja: '中' },
  { id: 'high', ja: '高' },
  { id: 'xhigh', ja: '超高' },
  { id: 'max', ja: '最大' },
];

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const ROOT = resolve(opt('--root') ?? fileURLToPath(new URL('..', import.meta.url)));
const OUT = resolve(opt('--out') ?? join(ROOT, '_site'));
const REPO = process.env.GITHUB_REPOSITORY || 'DaikiKobayashi/sonnet-5-5-web-game-samples';
const REPO_URL = `https://github.com/${REPO}`;

const exists = (p) => stat(p).then(() => true, () => false);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`warning: could not parse ${path}: ${err.message}`);
    return {};
  }
}

async function discoverGames() {
  const gamesDir = join(ROOT, 'games');
  if (!(await exists(gamesDir))) return [];
  const games = [];
  for (const entry of await readdir(gamesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || /^[._]/.test(entry.name)) continue;
    const dir = join(gamesDir, entry.name);
    const meta = await readJson(join(dir, 'game.json'));
    const efforts = [];
    for (const e of EFFORTS) {
      const dist = join(dir, 'impl', e.id, 'dist');
      efforts.push({
        ...e,
        dist,
        available: await exists(join(dist, 'index.html')),
        hasSource: await exists(join(dir, 'impl', e.id)),
      });
    }
    if (!meta.id && !(await exists(join(dir, 'impl'))) && !(await exists(join(dir, 'SPEC.md')))) continue;
    games.push({
      id: entry.name,
      title: meta.title || entry.name,
      description: meta.description || '',
      stack: meta.stack || '',
      createdAt: meta.createdAt || '',
      hasSpec: await exists(join(dir, 'SPEC.md')),
      hasResults: await exists(join(dir, 'RESULTS.md')),
      efforts,
    });
  }
  return games.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

const CSS = `:root{color-scheme:light dark;--bg:#f6f7fb;--fg:#1b1e28;--muted:#667085;--card:#fff;--border:#dfe3ec;--accent:#0d9488;--accent-fg:#fff;--off:#eceef4}
@media (prefers-color-scheme:dark){:root{--bg:#12141a;--fg:#e8eaf0;--muted:#9096a8;--card:#1b1e28;--border:#2a2e3b;--accent:#5eead4;--accent-fg:#0b1f1c;--off:#20232e}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;line-height:1.6}
main{width:min(100% - 32px,960px);margin:0 auto;padding:40px 0 64px}
h1{margin:0 0 4px;font-size:1.75rem}h2{margin:32px 0 12px;font-size:1.1rem}
.lead{margin:0 0 28px;color:var(--muted)}
a{color:var(--accent)}
.back{display:inline-block;margin-bottom:16px;color:var(--muted);text-decoration:none;font-size:.9rem}
.back:hover{text-decoration:underline}
ul.cards{list-style:none;margin:0;padding:0;display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
a.card{display:block;height:100%;padding:18px;color:inherit;text-decoration:none;background:var(--card);border:1px solid var(--border);border-radius:12px}
a.card:hover,a.card:focus-visible{border-color:var(--accent);outline:none}
.card h2{margin:0 0 6px;font-size:1.1rem}.card p{margin:0 0 10px;color:var(--muted);font-size:.9rem}
.meta{display:flex;flex-wrap:wrap;gap:6px;font-size:.78rem;color:var(--muted)}
.tag{padding:2px 8px;border:1px solid var(--border);border-radius:999px}
.efforts{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}
.btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:76px;padding:12px;border-radius:12px;text-decoration:none;font-weight:700;font-size:1.1rem;background:var(--accent);color:var(--accent-fg);border:1px solid var(--accent)}
.btn small{font-weight:400;font-size:.78rem;opacity:.85}
a.btn:hover,a.btn:focus-visible{filter:brightness(1.08);outline:2px solid var(--fg);outline-offset:2px}
.btn.off{background:var(--off);color:var(--muted);border-color:var(--border);cursor:not-allowed}
.links{display:flex;flex-wrap:wrap;gap:8px 20px;padding:0;margin:0;list-style:none}
.empty{color:var(--muted)}
footer{margin-top:48px;color:var(--muted);font-size:.85rem}`;

const page = ({ title, css, body }) => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="${css}">
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;

function homePage(games) {
  const cards = games
    .map((g) => {
      const n = g.efforts.filter((e) => e.available).length;
      return `<li><a class="card" href="games/${esc(g.id)}/">
<h2>${esc(g.title)}</h2>
${g.description ? `<p>${esc(g.description)}</p>` : ''}
<div class="meta">${g.stack ? `<span class="tag">${esc(g.stack)}</span>` : ''}<span class="tag">${n} / ${EFFORTS.length} effort</span></div>
</a></li>`;
    })
    .join('\n');
  return page({
    title: 'Web Game Samples',
    css: 'site.css',
    body: `<h1>Web Game Samples</h1>
<p class="lead">Sonnet 5.5 が同じ仕様書から、effort を変えて作ったブラウザゲームの比較です。遊びたいゲームを選んでください。</p>
${games.length ? `<ul class="cards">\n${cards}\n</ul>` : '<p class="empty">まだゲームがありません。</p>'}
<footer><a href="${esc(REPO_URL)}">GitHub リポジトリ</a></footer>`,
  });
}

function gamePage(g) {
  const buttons = g.efforts
    .map((e) =>
      e.available
        ? `<a class="btn" href="${e.id}/">${e.id}<small>${e.ja}</small></a>`
        : `<span class="btn off" aria-disabled="true">${e.id}<small>未実装</small></span>`,
    )
    .join('\n');
  const blob = (p) => `${REPO_URL}/blob/main/games/${encodeURIComponent(g.id)}/${p}`;
  const links = [
    g.hasSpec && `<li><a href="${blob('SPEC.md')}">仕様書 (SPEC.md)</a></li>`,
    g.hasResults && `<li><a href="${blob('RESULTS.md')}">比較結果 (RESULTS.md)</a></li>`,
    ...g.efforts
      .filter((e) => e.hasSource)
      .map((e) => `<li><a href="${REPO_URL}/tree/main/games/${encodeURIComponent(g.id)}/impl/${e.id}">${e.id} のソース</a></li>`),
  ].filter(Boolean);
  return page({
    title: `${g.title} | Web Game Samples`,
    css: '../../site.css',
    body: `<a class="back" href="../../">← ゲーム一覧に戻る</a>
<h1>${esc(g.title)}</h1>
<p class="lead">${esc(g.description)}${g.stack ? ` <span class="tag">${esc(g.stack)}</span>` : ''}</p>
<h2>どの effort で作ったものを開きますか?</h2>
<div class="efforts">
${buttons}
</div>
<p class="empty">ゲームから戻るには、ブラウザの「戻る」を使ってください。</p>
${links.length ? `<h2>関連リンク</h2>\n<ul class="links">\n${links.join('\n')}\n</ul>` : ''}`,
  });
}

async function build() {
  const games = await discoverGames();
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, '.nojekyll'), '');
  await writeFile(join(OUT, 'site.css'), CSS + '\n');
  await writeFile(join(OUT, 'index.html'), homePage(games));
  for (const g of games) {
    const gameOut = join(OUT, 'games', g.id);
    await mkdir(gameOut, { recursive: true });
    await writeFile(join(gameOut, 'index.html'), gamePage(g));
    for (const e of g.efforts.filter((x) => x.available)) {
      await cp(e.dist, join(gameOut, e.id), { recursive: true, filter: (src) => !src.split(sep).includes('node_modules') });
    }
    const ready = g.efforts.filter((e) => e.available).map((e) => e.id);
    console.log(`${g.id}: ${ready.length ? ready.join(', ') : '(no implementation with dist/index.html yet)'}`);
  }
  console.log(`Built ${games.length} game(s) into ${OUT}`);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

function serve(port) {
  createServer(async (req, res) => {
    try {
      const target = resolve(join(OUT, normalize(decodeURIComponent((req.url ?? '/').split('?')[0]))));
      let file = target === OUT || target.startsWith(OUT + sep) ? target : null;
      if (file && (await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
      if (!file || !(await exists(file))) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 Not Found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(400).end('400 Bad Request');
    }
  }).listen(port, () => console.log(`Preview: http://localhost:${port}`));
}

await build();
if (argv.includes('--serve')) serve(Number(opt('--port')) || 8080);
