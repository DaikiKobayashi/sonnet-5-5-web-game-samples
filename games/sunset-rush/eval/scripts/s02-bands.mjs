// S-02 の補足: M14 の走行中 2 枚(raw-m14-run-0/500)を、行の帯ごと(y=100〜178)に横ずれ推定する。帯 C(y=130〜176)は遠景と重なるため
import fs from 'fs';
import { launch } from './lib.mjs';
const b = await launch(); const pg = await (await b.newContext()).newPage();
// 引数で variant を指定した場合はその variant だけを計算し、既存の s02-bands.json に追記する
const ONLY = process.argv.slice(2);
const OUTF = '/home/user/sonnet-5-5-web-game-samples/games/sunset-rush/eval/raw/s02-bands.json';
const res = ONLY.length && fs.existsSync(OUTF) ? JSON.parse(fs.readFileSync(OUTF, 'utf8')) : {};
const base='/home/user/sonnet-5-5-web-game-samples/games/sunset-rush/eval/screenshots/';
for (const e of ONLY.length ? ONLY : ['low','medium','high','xhigh','max']) {
  const a = 'data:image/png;base64,'+fs.readFileSync(base+e+'/raw-m14-run-0.png').toString('base64');
  const c = 'data:image/png;base64,'+fs.readFileSync(base+e+'/raw-m14-run-500.png').toString('base64');
  const r = await pg.evaluate(async ([a,c]) => {
    const load = async (d) => { const im = new Image(); im.src = d; await im.decode(); const cv = document.createElement('canvas'); cv.width=640; cv.height=360; const g=cv.getContext('2d'); g.drawImage(im,0,0); return g.getImageData(0,0,640,360); };
    const A = await load(a), B = await load(c);
    const sh = (y0,y1) => { let best=null,bs=0; for (let s=-90;s<=90;s++){ let sum=0,n=0; for(let y=y0;y<=y1;y++) for(let x=100;x<=540;x+=2){ const xa=x-s; if(xa<0||xa>=640) continue; const ia=(y*640+xa)*4, ib=(y*640+x)*4; sum+=Math.abs(A.data[ia]-B.data[ib])+Math.abs(A.data[ia+1]-B.data[ib+1])+Math.abs(A.data[ia+2]-B.data[ib+2]); n++; } const m=sum/n; if(best==null||m<best){best=m;bs=s;} } return bs; };
    const out = {}; for (const [y0,y1] of [[100,120],[120,140],[140,160],[160,170],[170,178]]) out[y0+'-'+y1] = sh(y0,y1); return out;
  }, [a,c]);
  console.log(e, JSON.stringify(r)); res[e] = r;
}
await b.close(); fs.writeFileSync(base + '../raw/s02-bands.json', JSON.stringify(res, null, 1));
