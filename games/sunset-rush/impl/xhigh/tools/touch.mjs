// タッチ操作(S-09)の自己チェック: タッチ端末エミュレーションでボタンが出て、押している間だけ効く
import { open, OUT } from './lib.mjs';

const g = await open({ touch: true, viewport: { width: 667, height: 375 }, query: 'debug=1&seed=42' });
await g.wait(300);
const cdp = await g.context.newCDPSession(g.page);
const rectOf = (sel) => g.page.evaluate((s) => {
  const r = document.querySelector(s).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, visible: getComputedStyle(document.querySelector(s)).display !== 'none' && r.width > 0 };
}, sel);
const touch = (type, x, y, id = 1) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id }] });

const shown = await g.page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, show: document.getElementById('touch').classList.contains('show') }));
console.log('touch layer', JSON.stringify(shown));
await g.shot(OUT + 't_title.png');
// キャンバスをタップして開始
const c = await rectOf('#game');
await touch('touchStart', c.x, c.y); await touch('touchEnd');
await g.wait(200);
console.log('after tap', (await g.state()).scene);
await g.waitScene('playing', 6000);
const gas = await rectOf('#tc-gas');
const left = await rectOf('#tc-left');
const right = await rectOf('#tc-right');
const brake = await rectOf('#tc-brake');
console.log('buttons', JSON.stringify({ gas, left, right, brake }));
const s0 = await g.state();
await touch('touchStart', gas.x, gas.y, 1);
await g.wait(1500);
const s1 = await g.state();
await g.shot(OUT + 't_playing.png');
// アクセル + 右ハンドル(2 本指)
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: gas.x, y: gas.y, id: 1 }, { x: right.x, y: right.y, id: 2 }] });
await g.wait(500);
const s2 = await g.state();
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await g.wait(1200);
const s3 = await g.state();
console.log(JSON.stringify({ start: s0.speedKmh, holdGas1500ms: s1.speedKmh, withRight: [s2.speedKmh, s2.playerX], afterRelease1200ms: s3.speedKmh, x: s3.playerX }));
console.log('ok', s1.speedKmh > 60 && s3.speedKmh < s2.speedKmh - 30 && s2.playerX > s1.playerX + 0.02);
console.log('errors', JSON.stringify(g.log.errors), JSON.stringify(g.log.failed));
await g.close();
