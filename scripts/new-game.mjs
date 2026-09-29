// Scaffold a new game from games/_template and register it in games/games.json.
// Usage: npm run new -- <kebab-case-name> "<表示タイトル>" ["<説明>"]
import { cp, readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const [id, title, description = ''] = process.argv.slice(2);

if (!id || !title || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
  console.error('Usage: npm run new -- <kebab-case-name> "<title>" ["<description>"]');
  process.exit(1);
}

const gamesDir = fileURLToPath(new URL('../games/', import.meta.url));
const dest = join(gamesDir, id);
if (await stat(dest).catch(() => null)) {
  console.error(`games/${id} already exists.`);
  process.exit(1);
}

await cp(join(gamesDir, '_template'), dest, { recursive: true });

for (const name of ['index.html', 'README.md']) {
  const path = join(dest, name);
  const text = await readFile(path, 'utf8');
  await writeFile(path, text.replaceAll('__TITLE__', title));
}

const manifestPath = join(gamesDir, 'games.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.push({ id, title, description });
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Created games/${id}/ and added it to games/games.json`);
