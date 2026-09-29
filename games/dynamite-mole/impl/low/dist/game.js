(function(){
'use strict';
var W=480,H=416,COLS=15,ROWS=11,TS=32,HUD=64,STEP=1/60;
var qs=new URLSearchParams(location.search);
var DEBUG=qs.get('debug')==='1';
var canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;
var Art=window.Art,Font=window.Font,Aud=window.GAudio;
var DX=[0,1,0,-1],DY=[-1,0,1,0],DNAME=['up','right','down','left'];
var STAGES=[
 {name:'SHALLOW TUNNELS',dens:0.40,e:{slime:3,bat:0,ghost:0,golem:0},mult:1.00,time:150},
 {name:'MUSHROOM GROTTO',dens:0.42,e:{slime:3,bat:2,ghost:0,golem:0},mult:1.00,time:150},
 {name:'CRYSTAL VEIN',dens:0.45,e:{slime:2,bat:2,ghost:2,golem:0},mult:1.05,time:165},
 {name:'LAVA DEPTHS',dens:0.45,e:{slime:2,bat:2,ghost:2,golem:1},mult:1.10,time:180},
 {name:'THE DEEP DARK',dens:0.48,e:{slime:0,bat:3,ghost:3,golem:2},mult:1.15,time:180}];
var ESPEED={slime:2.0,bat:3.2,ghost:2.4,golem:1.5},EHP={slime:1,bat:1,ghost:1,golem:3},ESCORE={slime:100,bat:200,ghost:300,golem:500};
var EORDER=['slime','bat','ghost','golem'];
var SAFE={'1,1':1,'2,1':1,'3,1':1,'1,2':1,'1,3':1,'3,2':1,'2,3':1};

/* ---------- storage ---------- */
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
var hiStored=parseInt(lsGet('dynamiteMole.hiScore'),10)||0;
Aud.muted=lsGet('dynamiteMole.muted')==='1';
if(qs.get('mute')==='1')Aud.muted=true;
var startStage=(function(){var s=parseInt(qs.get('stage'),10);return(s>=1&&s<=5)?s:1;})();
var reduceMotion=false;try{reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}

/* ---------- rng ---------- */
function mulberry32(a){var s=a>>>0;return function(){s=(s+0x6D2B79F5)>>>0;var t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function newSeed(){var s=parseInt(qs.get('seed'),10);if(qs.has('seed')&&!isNaN(s))return s>>>0;return Math.floor(Math.random()*4294967296)>>>0;}

/* ---------- state ---------- */
var state='title',seed=newSeed(),stage=startStage,score=0,lives=3,timeLeft=150;
var grid,hidden,exitO,bombs,flames,items,enemies,particles,crumbles,popups,P;
var rp=mulberry32(seed^0xC0FFEE);
var pw={maxBombs:1,range:2,boots:0};
var introT=0,clearT=0,lockT=0,clearBonus=0,timeBonus=0,animT=0,realT=0,shakeT=0,flashT=0;
var runActive=false,newRecord=false,brokeFlag=false,god=false,wantBomb=false,lastCeil=0;
var texts=[],held=[],buf=-1,scoreShown=0;

function pad6(n){var s=String(n);while(s.length<6)s='0'+s;return s;}
function inb(c,r){return c>=0&&r>=0&&c<COLS&&r<ROWS;}

/* ---------- stage generation ---------- */
function genStage(s){
  var st=STAGES[s-1],lr=mulberry32((seed+s*7919)>>>0),r,c,i;
  grid=[];for(r=0;r<ROWS;r++){grid[r]=[];for(c=0;c<COLS;c++)grid[r][c]=(r===0||r===ROWS-1||c===0||c===COLS-1||(r%2===0&&c%2===0))?'#':'.';}
  var cands=[];
  for(r=0;r<ROWS;r++)for(c=0;c<COLS;c++)if(grid[r][c]==='.'&&Math.abs(c-1)+Math.abs(r-1)>=7)cands.push([c,r]);
  var spawns=[],near={};
  EORDER.forEach(function(t){for(var k=0;k<st.e[t];k++){var ix=Math.floor(lr()*cands.length),pos=cands.splice(ix,1)[0];spawns.push({type:t,c:pos[0],r:pos[1]});}});
  spawns.forEach(function(e){near[e.c+','+e.r]=1;near[(e.c+1)+','+e.r]=1;near[(e.c-1)+','+e.r]=1;near[e.c+','+(e.r+1)]=1;near[e.c+','+(e.r-1)]=1;});
  var softs=[];
  for(r=0;r<ROWS;r++)for(c=0;c<COLS;c++){
    if(grid[r][c]!=='.'||SAFE[c+','+r]||near[c+','+r])continue;
    if(lr()<st.dens){grid[r][c]='S';softs.push([c,r]);}
  }
  var far=softs.filter(function(q){return Math.abs(q[0]-1)+Math.abs(q[1]-1)>=8;});
  var pool=far.length?far:softs;
  var ex=pool[Math.floor(lr()*pool.length)];
  exitO={col:ex[0],row:ex[1],revealed:false,open:false};
  hidden={};
  softs.forEach(function(q){
    if(q[0]===ex[0]&&q[1]===ex[1])return;
    var u=lr();
    if(u<0.18){var v=lr()*100;hidden[q[1]*COLS+q[0]]=v<35?'fire':v<70?'bomb':v<90?'boots':'life';}
  });
  bombs=[];flames=[];items=[];particles=[];crumbles=[];popups=[];enemies=[];
  spawns.forEach(function(e){
    enemies.push({type:e.type,x:e.c,y:e.r,dir:Math.floor(rp()*4),moving:false,p:0,sx:e.c,sy:e.r,hp:EHP[e.type],alive:true,dieT:0,invT:0,wait:0,spd:ESPEED[e.type]*st.mult,ft:Math.random()*2,chase:false});
  });
  P={x:1,y:1,sx:1,sy:1,dir:2,facing:'down',alive:true,inv:0,moving:false,p:0,par:0,deadT:0,byTime:false};
  timeLeft=st.time;lastCeil=Math.ceil(timeLeft);wantBomb=false;buf=-1;flashT=0;
}
function resetRun(){
  score=0;lives=3;pw={maxBombs:1,range:2,boots:0};stage=startStage;scoreShown=0;
}

/* ---------- audio helpers ---------- */
function sfx(n){Aud.sfx(n);}
function bgmId(){return state==='title'?'title':(state==='playing'||state==='paused')?'stage'+stage:null;}

/* ---------- run flow ---------- */
function endRun(){
  if(!runActive)return;runActive=false;
  newRecord=score>0&&score>hiStored;
  if(score>hiStored){hiStored=score;lsSet('dynamiteMole.hiScore',String(hiStored));}
}
function startRun(){
  endRun();
  seed=newSeed();rp=mulberry32((seed^0xC0FFEE)>>>0);
  resetRun();genStage(stage);
  runActive=true;newRecord=false;state='stageIntro';introT=1.8;sfx('start');
}
function goTitle(){state='title';seed=newSeed();rp=mulberry32((seed^0xC0FFEE)>>>0);stage=startStage;genStage(stage);}
function enterGameOver(){endRun();state='gameOver';lockT=0.6;sfx('gameOver');}

/* ---------- gameplay ---------- */
function bombAt(c,r){for(var i=0;i<bombs.length;i++)if(bombs[i].c===c&&bombs[i].r===r)return bombs[i];return null;}
function pTile(){return[Math.round(P.x),Math.round(P.y)];}
function playerCan(c,r){return inb(c,r)&&grid[r][c]==='.'&&!bombAt(c,r);}
function enemyCan(c,r){return inb(c,r)&&grid[r][c]==='.'&&!bombAt(c,r);}
function popup(x,y,t){popups.push({x:x,y:y,t:0,s:t});}
function spark(x,y,n,cols,spd,life){
  for(var i=0;i<n;i++){var a=Math.random()*6.28,v=(0.3+Math.random())*spd;
    particles.push({x:(x+0.5)*TS,y:HUD+(y+0.5)*TS,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:0,life:life*(0.6+Math.random()*0.6),c:cols[Math.floor(Math.random()*cols.length)],s:2+2*Math.floor(Math.random()*2)});}
}
function addScore(n){score+=n;}
function breakRock(c,r,noScore){
  grid[r][c]='.';if(!noScore)addScore(10);
  crumbles.push({c:c,r:r,t:0});brokeFlag=true;
  var th=Art.themes[stage-1];
  spark(c,r,7,[th.rock,th.rockL,th.rockD],110,0.5);
  var k=r*COLS+c;
  if(hidden[k]){items.push({type:hidden[k],col:c,row:r,t:Math.random()*6});delete hidden[k];}
  if(exitO.col===c&&exitO.row===r)exitO.revealed=true;
}
function addFlame(c,r,kind,dir){var f={col:c,row:r,timeLeft:0.5,kind:kind,dir:dir||0,age:0};flames.push(f);return f;}
function explode(b0){
  var q=[b0];b0.boom=true;
  while(q.length){
    var b=q.shift(),ix=bombs.indexOf(b);if(ix>=0)bombs.splice(ix,1);
    sfx('explode');shakeT=0.2;
    addFlame(b.c,b.r,'c');
    spark(b.c,b.r,8,['#ffd23a','#ff8a1a','#fff2a0'],140,0.4);
    for(var d=0;d<4;d++){
      var last=null;
      for(var i=1;i<=b.range;i++){
        var c=b.c+DX[d]*i,r=b.r+DY[d]*i;
        if(!inb(c,r)||grid[r][c]==='#'){if(last)last.kind='tip';break;}
        if(grid[r][c]==='S'){breakRock(c,r);addFlame(c,r,'tip',d);last=null;break;}
        last=addFlame(c,r,i===b.range?'tip':'arm',d);
        var ob=bombAt(c,r);if(ob&&!ob.boom){ob.boom=true;q.push(ob);}
      }
    }
  }
}
function killEnemy(e){
  e.alive=false;e.dieT=0.4;e.moving=false;addScore(ESCORE[e.type]);
  popup(e.x,e.y,'+'+ESCORE[e.type]);sfx('enemyDie');
}
function hitEnemy(e){
  if(e.invT>0)return;
  e.hp--;
  if(e.hp<=0)killEnemy(e);else{e.invT=0.8;sfx('hit');}
}
function die(byTime){
  if(!P.alive)return;
  lives--;P.alive=false;P.deadT=1.2;P.moving=false;P.byTime=byTime;P.sx=P.x=Math.round(P.x);P.sy=P.y=Math.round(P.y);
  pw.maxBombs=Math.max(1,pw.maxBombs-1);pw.range=Math.max(2,pw.range-1);pw.boots=Math.max(0,pw.boots-1);
  sfx('playerDie');
  spark(P.x,P.y,10,['#8b5a34','#ffd23a','#fff'],120,0.6);
}
function afterDeath(){
  if(lives>0){
    P.x=P.sx=1;P.y=P.sy=1;P.facing='down';P.dir=2;P.alive=true;P.inv=2;P.moving=false;
    if(P.byTime)timeLeft=60;
    lastCeil=Math.ceil(timeLeft);
  }else enterGameOver();
}
function heldLast(){return held.length?held[held.length-1]:-1;}
function updPlayer(dt){
  var spd=4.5+0.6*pw.boots,budget=dt;
  while(budget>1e-9){
    if(!P.moving){
      var d=heldLast();if(d<0)d=buf;buf=-1;
      if(d<0)break;
      P.dir=d;P.facing=DNAME[d];
      var c=Math.round(P.x),r=Math.round(P.y);
      if(playerCan(c+DX[d],r+DY[d])){P.moving=true;P.p=0;P.sx=c;P.sy=r;P.par^=1;
        if(Math.random()<0.5)particles.push({x:(c+0.5)*TS,y:HUD+(r+0.9)*TS,vx:(Math.random()-0.5)*20,vy:-10,t:0,life:0.3,c:'#c9a878',s:2});}
      else break;
    }else{
      var need=(1-P.p)/spd;
      if(budget>=need){P.p=0;P.moving=false;P.x=P.sx+DX[P.dir];P.y=P.sy+DY[P.dir];P.sx=P.x;P.sy=P.y;budget-=need;}
      else{P.p+=budget*spd;budget=0;P.x=P.sx+DX[P.dir]*P.p;P.y=P.sy+DY[P.dir]*P.p;}
    }
  }
}
function dist1(a,b,c,d){return Math.abs(a-c)+Math.abs(b-d);}
function decide(e){
  var cur=e.dir,rev=(cur+2)%4,c=Math.round(e.x),r=Math.round(e.y),i,opts;
  function can(d){return enemyCan(c+DX[d],r+DY[d]);}
  function wander(){
    if(can(cur)&&rp()>=0.2)return cur;
    opts=[];for(i=0;i<4;i++)if(i!==rev&&can(i))opts.push(i);
    if(opts.length)return opts[Math.floor(rp()*opts.length)];
    if(can(rev))return rev;return -1;
  }
  if(e.type==='bat'){
    opts=[];for(i=0;i<4;i++)if(i!==rev&&can(i))opts.push(i);
    if(opts.length)return opts[Math.floor(rp()*opts.length)];
    if(can(rev))return rev;return -1;
  }
  if(e.type==='ghost'){
    var pt=pTile();
    e.chase=P.alive&&dist1(c,r,pt[0],pt[1])<=6;
    if(e.chase){
      if(rp()<0.25)return wander();
      var best=99,bl=[];
      for(i=0;i<4;i++){if(i===rev||!can(i))continue;var dd=dist1(c+DX[i],r+DY[i],pt[0],pt[1]);if(dd<best){best=dd;bl=[i];}else if(dd===best)bl.push(i);}
      if(bl.length)return bl[Math.floor(rp()*bl.length)];
      if(can(rev))return rev;return -1;
    }
  }
  return wander();
}
function updEnemy(e,dt){
  e.ft+=dt;
  if(!e.alive){e.dieT-=dt;return;}
  e.invT=Math.max(0,e.invT-dt);
  var budget=dt;
  while(budget>1e-9){
    if(!e.moving){
      if(e.wait>0){var w=Math.min(e.wait,budget);e.wait-=w;budget-=w;if(e.wait>0)break;continue;}
      var d=decide(e);
      if(d<0){e.wait=0.3;continue;}
      e.dir=d;e.moving=true;e.p=0;e.sx=Math.round(e.x);e.sy=Math.round(e.y);
    }else{
      var need=(1-e.p)/e.spd;
      if(budget>=need){e.moving=false;e.x=e.sx+DX[e.dir];e.y=e.sy+DY[e.dir];budget-=need;}
      else{e.p+=budget*e.spd;budget=0;e.x=e.sx+DX[e.dir]*e.p;e.y=e.sy+DY[e.dir]*e.p;}
    }
  }
}
function flameAt(c,r){for(var i=0;i<flames.length;i++)if(flames[i].col===c&&flames[i].row===r)return true;return false;}
function applyItem(it){
  var t=it.type;
  if(t==='fire')pw.range=Math.min(6,pw.range+1);
  else if(t==='bomb')pw.maxBombs=Math.min(5,pw.maxBombs+1);
  else if(t==='boots')pw.boots=Math.min(3,pw.boots+1);
  else if(t==='life')lives=Math.min(5,lives+1);
  addScore(50);sfx(t==='life'?'life':'item');popup(it.col,it.row,'+50');
  spark(it.col,it.row,6,['#fff6b0','#ffd23a'],80,0.4);
}
function enemiesAlive(){var n=0;enemies.forEach(function(e){if(e.alive)n++;});return n;}
function tick(dt){
  var i,j;brokeFlag=false;animT+=dt;
  if(P.alive){
    var prev=Math.ceil(timeLeft);
    timeLeft-=dt;
    if(timeLeft<=0){timeLeft=0;if(!god)die(true);}
    else if(timeLeft<=10&&Math.ceil(timeLeft)!==prev)sfx('warn');
    P.inv=Math.max(0,P.inv-dt);
  }
  Aud.fast=timeLeft<=30&&timeLeft>0;
  if(P.alive){
    updPlayer(dt);
    if(wantBomb){
      var t=pTile();
      if(bombs.length<pw.maxBombs&&!bombAt(t[0],t[1])&&grid[t[1]][t[0]]==='.'){bombs.push({c:t[0],r:t[1],t:2.5,range:pw.range,boom:false,ph:Math.random()});sfx('place');}
    }
  }else{P.deadT-=dt;if(P.deadT<=0){afterDeath();if(state!=='playing')return;}}
  wantBomb=false;
  for(i=0;i<bombs.length;i++)bombs[i].t-=dt;
  for(i=0;i<bombs.length;i++){if(bombs[i].t<=0&&!bombs[i].boom){explode(bombs[i]);i=-1;}}
  if(brokeFlag)sfx('break');
  enemies.forEach(function(e){updEnemy(e,dt);});
  for(i=enemies.length-1;i>=0;i--)if(!enemies[i].alive&&enemies[i].dieT<=0)enemies.splice(i,1);
  for(i=flames.length-1;i>=0;i--){flames[i].timeLeft-=dt;flames[i].age+=dt;if(flames[i].timeLeft<=0)flames.splice(i,1);}
  enemies.forEach(function(e){if(e.alive&&flameAt(Math.round(e.x),Math.round(e.y)))hitEnemy(e);});
  if(P.alive&&P.inv<=0&&!god){var pt=pTile();if(flameAt(pt[0],pt[1]))die(false);}
  if(P.alive&&P.inv<=0&&!god){
    for(i=0;i<enemies.length;i++){var e=enemies[i];if(!e.alive)continue;
      if(Math.hypot(e.x-P.x,e.y-P.y)<0.6){die(false);break;}}
  }
  if(P.alive){
    var q=pTile();
    for(i=0;i<items.length;i++)if(items[i].col===q[0]&&items[i].row===q[1]){applyItem(items[i]);items.splice(i,1);break;}
  }
  if(!exitO.open&&enemiesAlive()===0){exitO.open=true;sfx('exitOpen');flashT=0.4;}
  if(P.alive&&exitO.open&&exitO.revealed){
    var q2=pTile();
    if(q2[0]===exitO.col&&q2[1]===exitO.row){
      state='stageClear';clearT=3;timeBonus=Math.floor(timeLeft)*10;clearBonus=500;
      addScore(clearBonus+timeBonus);sfx('stageClear');Aud.fast=false;
    }
  }
  /* fx */
  for(i=particles.length-1;i>=0;i--){var pa=particles[i];pa.t+=dt;pa.x+=pa.vx*dt;pa.y+=pa.vy*dt;pa.vy+=200*dt;if(pa.t>pa.life)particles.splice(i,1);}
  for(i=crumbles.length-1;i>=0;i--){crumbles[i].t+=dt;if(crumbles[i].t>0.3)crumbles.splice(i,1);}
  for(i=popups.length-1;i>=0;i--){popups[i].t+=dt;if(popups[i].t>0.8)popups.splice(i,1);}
  if(shakeT>0)shakeT=Math.max(0,shakeT-dt);
  if(flashT>0)flashT=Math.max(0,flashT-dt);
}
function update(dt){
  Aud.bgm=bgmId();Aud.paused=state==='paused';
  if(state==='stageIntro'){introT-=dt;if(introT<=0){state='playing';buf=-1;}}
  else if(state==='playing')tick(dt);
  else if(state==='stageClear'){
    clearT-=dt;animT+=dt;
    if(clearT<=0){
      if(stage>=5){endRun();state='gameClear';lockT=0.6;sfx('gameClear');}
      else{stage++;genStage(stage);state='stageIntro';introT=1.8;}
    }
  }else if(state==='gameOver'||state==='gameClear'){lockT=Math.max(0,lockT-dt);}
  Aud.bgm=bgmId();Aud.paused=state==='paused';
  if(scoreShown<score){scoreShown=Math.min(score,scoreShown+Math.max(10,Math.ceil((score-scoreShown)*0.2)));}
}

/* ---------- debug ---------- */
function debugApi(){
  return{
    killAllEnemies:function(){enemies.forEach(function(e){if(e.alive)killEnemy(e);});},
    revealExit:function(){if(grid[exitO.row][exitO.col]==='S')breakRock(exitO.col,exitO.row,true);exitO.revealed=true;},
    clearBlocks:function(){for(var r=0;r<ROWS;r++)for(var c=0;c<COLS;c++)if(grid[r][c]==='S')breakRock(c,r,true);},
    teleport:function(c,r){if(!inb(c,r)||grid[r][c]==='#')return;if(grid[r][c]==='S')breakRock(c,r,true);
      P.x=P.sx=c;P.y=P.sy=r;P.moving=false;P.p=0;},
    setLives:function(n){lives=Math.max(1,Math.min(5,n|0));},
    setTimeLeft:function(s){timeLeft=+s;lastCeil=Math.ceil(timeLeft);},
    setPowerups:function(o){o=o||{};if(o.maxBombs!==undefined)pw.maxBombs=Math.max(1,Math.min(5,o.maxBombs|0));
      if(o.range!==undefined)pw.range=Math.max(2,Math.min(6,o.range|0));if(o.boots!==undefined)pw.boots=Math.max(0,Math.min(3,o.boots|0));},
    spawnItem:function(t,c,r){if(inb(c,r)&&grid[r][c]==='.'&&ESPEED&&['fire','bomb','boots','life'].indexOf(t)>=0)items.push({type:t,col:c,row:r,t:0});},
    spawnEnemy:function(t,c,r){if(!inb(c,r)||grid[r][c]!=='.'||!ESPEED[t])return;
      enemies.push({type:t,x:c,y:r,dir:Math.floor(rp()*4),moving:false,p:0,sx:c,sy:r,hp:EHP[t],alive:true,dieT:0,invT:0,wait:0,spd:ESPEED[t]*STAGES[stage-1].mult,ft:0,chase:false});},
    godMode:function(on){god=!!on;}
  };
}
window.__GAME__={
  snapshot:function(){
    return JSON.parse(JSON.stringify({
      state:state,seed:seed,stage:stage,score:score,hiScore:Math.max(hiStored,score),lives:lives,timeLeft:timeLeft,
      player:{col:Math.round(P.x),row:Math.round(P.y),x:P.x,y:P.y,facing:P.facing,alive:P.alive,invincible:P.inv,maxBombs:pw.maxBombs,activeBombs:bombs.length,range:pw.range,boots:pw.boots,speed:4.5+0.6*pw.boots},
      bombs:bombs.map(function(b){return{col:b.c,row:b.r,timeLeft:b.t,range:b.range};}),
      flames:flames.map(function(f){return{col:f.col,row:f.row,timeLeft:f.timeLeft};}),
      enemies:enemies.map(function(e){return{type:e.type,col:Math.round(e.x),row:Math.round(e.y),x:e.x,y:e.y,hp:e.hp,alive:e.alive};}),
      items:items.map(function(i){return{type:i.type,col:i.col,row:i.row};}),
      exit:{col:exitO.col,row:exitO.row,revealed:exitO.revealed,open:exitO.open},
      grid:grid.map(function(r){return r.join('');}),
      texts:texts,
      audio:{unlocked:Aud.unlocked,muted:Aud.muted,bgm:bgmId(),sfxLog:Aud.log.slice()}
    }));
  }
};
if(DEBUG)window.__GAME__.debug=debugApi();

/* ---------- input ---------- */
var DIRKEYS={ArrowUp:0,KeyW:0,ArrowRight:1,KeyD:1,ArrowDown:2,KeyS:2,ArrowLeft:3,KeyA:3};
var PREVENT={ArrowUp:1,ArrowDown:1,ArrowLeft:1,ArrowRight:1,Space:1,Enter:1,Escape:1};
function toggleMute(){Aud.muted=!Aud.muted;lsSet('dynamiteMole.muted',Aud.muted?'1':'0');}
function pressKey(code,repeat){
  Aud.unlock();
  if(code in DIRKEYS){var d=DIRKEYS[code];var ix=held.indexOf(d);if(ix<0)held.push(d);else if(!repeat){held.splice(ix,1);held.push(d);}if(!repeat)buf=d;return;}
  if(repeat)return;
  if(code==='KeyM'){toggleMute();return;}
  var act=(code==='Enter'||code==='Space');
  if(state==='title'){if(act)startRun();return;}
  if(code==='KeyR'){if(state==='gameOver'||state==='gameClear'){if(lockT<=0)startRun();}else startRun();return;}
  if(state==='playing'){
    if(code==='Space'||code==='KeyZ')wantBomb=true;
    else if(code==='KeyP'||code==='Escape'){state='paused';sfx('pause');}
  }else if(state==='paused'){
    if(code==='KeyP'||code==='Escape'){state='playing';sfx('pause');}
  }else if(state==='gameOver'||state==='gameClear'){
    if(lockT>0)return;
    if(act)startRun();else if(code==='Escape')goTitle();
  }
}
function releaseKey(code){if(code in DIRKEYS){var ix=held.indexOf(DIRKEYS[code]);if(ix>=0)held.splice(ix,1);}}
window.addEventListener('keydown',function(e){if(PREVENT[e.code]||(e.code in DIRKEYS))e.preventDefault();pressKey(e.code,e.repeat);});
window.addEventListener('keyup',function(e){releaseKey(e.code);});
window.addEventListener('blur',function(){held=[];});
document.addEventListener('visibilitychange',function(){if(document.hidden&&state==='playing'){state='paused';sfx('pause');}});
canvas.addEventListener('pointerdown',function(){Aud.unlock();
  if(state==='title')startRun();else if((state==='gameOver'||state==='gameClear')&&lockT<=0)startRun();});
/* touch UI */
var touchEl=document.getElementById('touch'),touchOn=qs.get('touch')==='1';
try{if(window.matchMedia('(pointer: coarse)').matches)touchOn=true;}catch(e){}
if(touchOn)touchEl.classList.add('on');
Array.prototype.forEach.call(touchEl.querySelectorAll('[data-k]'),function(b){
  var k=b.getAttribute('data-k');
  b.addEventListener('pointerdown',function(e){e.preventDefault();try{b.setPointerCapture(e.pointerId);}catch(x){}b.classList.add('dn');pressKey(k,false);});
  function up(){b.classList.remove('dn');releaseKey(k);}
  b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);
});
function fit(){
  var th=touchOn?touchEl.offsetHeight:0,vw=window.innerWidth,vh=window.innerHeight-th;
  var s=Math.min(vw/W,vh/H);
  canvas.style.width=(W*s)+'px';canvas.style.height=(H*s)+'px';
}
window.addEventListener('resize',fit);fit();

/* ---------- rendering ---------- */
function T(s,x,y,sc,col,opt){
  s=String(s).toUpperCase();texts.push(s);opt=opt||{};
  var w=Font.width(s,sc);
  if(opt.align==='center')x=Math.round(x-w/2);else if(opt.align==='right')x=Math.round(x-w);
  if(opt.shadow!==false)Font.draw(ctx,s,x+sc,y+sc,sc,'#000000');
  Font.draw(ctx,s,x,y,sc,col||'#ffffff');
}
function TC(s,y,sc,col){T(s,W/2,y,sc,col,{align:'center'});}
function px(x){return Math.round((x+0.5)*TS-16);}
function py(y){return Math.round(HUD+(y+0.5)*TS-16);}
var vign=(function(){
  var c=document.createElement('canvas');c.width=W;c.height=352;var x=c.getContext('2d');
  var g=x.createRadialGradient(240,176,120,240,176,320);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,0.55)');
  x.fillStyle=g;x.fillRect(0,0,W,352);return c;
})();
function drawField(){
  var th=stage-1,r,c,i,t;
  ctx.save();
  if(shakeT>0&&!reduceMotion){ctx.translate(Math.round((Math.random()*2-1)*4*(shakeT/0.2)),Math.round((Math.random()*2-1)*4*(shakeT/0.2)));}
  ctx.beginPath();ctx.rect(0,HUD,W,352);ctx.clip();
  for(r=0;r<ROWS;r++)for(c=0;c<COLS;c++){
    var g=grid[r][c],X=c*TS,Y=HUD+r*TS;
    if(g==='#'){ctx.drawImage((r===0||r===ROWS-1||c===0||c===COLS-1)?Art.wall[th]:Art.pillar[th],X,Y);}
    else{ctx.drawImage(Art.floor[th][(c+r)&1],X,Y);}
  }
  if(exitO.revealed||exitO.open&&false){
    ctx.drawImage(exitO.open?Art.exitOpen[Math.floor(realT*4)%2]:Art.exitClosed,exitO.col*TS,HUD+exitO.row*TS);
  }
  for(r=0;r<ROWS;r++)for(c=0;c<COLS;c++)if(grid[r][c]==='S')ctx.drawImage(Art.rock[th],c*TS,HUD+r*TS);
  crumbles.forEach(function(k){ctx.drawImage(Art.crumble[th][Math.min(2,Math.floor(k.t/0.1))],k.c*TS,HUD+k.r*TS);});
  items.forEach(function(it){var bob=Math.round(Math.sin(realT*5+it.t)*1)*2;ctx.drawImage(Art.item[it.type],it.col*TS,HUD+it.row*TS+bob-2);});
  bombs.forEach(function(b){
    var fr=Math.floor(realT*(b.t<0.8?16:6))%3,pulse=b.t<0.8&&Math.floor(realT*12)%2===0;
    ctx.drawImage(Art.bomb[fr],b.c*TS,HUD+b.r*TS);
    if(pulse){ctx.globalAlpha=0.45;ctx.fillStyle='#ffffff';ctx.fillRect(b.c*TS+10,HUD+b.r*TS+12,12,18);ctx.globalAlpha=1;}
  });
  flames.forEach(function(f){
    var fr=Math.floor(f.age*16)%2,img,X=f.col*TS,Y=HUD+f.row*TS;
    if(f.kind==='c')img=Art.flameC[fr];
    else if(f.kind==='arm')img=(f.dir%2)?Art.flameArmH[fr]:Art.flameArmV[fr];
    else img=Art.flameTip[fr][f.dir];
    if(f.timeLeft<0.1){ctx.globalAlpha=f.timeLeft/0.1;}
    ctx.drawImage(img,X,Y);ctx.globalAlpha=1;
  });
  /* enemies */
  enemies.forEach(function(e){
    var X=px(e.x),Y=py(e.y),fr=Math.floor(e.ft*(e.type==='bat'?10:5))%2,img;
    if(!e.alive){img=Art.puff[Math.min(2,Math.floor((0.4-e.dieT)/0.4*3))];ctx.drawImage(img,X,Y);return;}
    if(e.type==='slime')img=Art.slime[fr];
    else if(e.type==='bat')img=Art.bat[fr];
    else if(e.type==='ghost')img=Art.ghost[e.chase?1:0][fr];
    else img=(e.invT>0&&Math.floor(e.invT*20)%2===0)?Art.golemFlash[fr]:Art.golem[fr];
    if(e.type==='golem'&&e.invT>0&&Math.floor(e.invT*20)%2===1){return;}
    var oy=e.type==='ghost'?Math.round(Math.sin(e.ft*3)*1)*2:0;
    ctx.drawImage(img,X,Y+oy);
  });
  /* player */
  var pimg;
  if(!P.alive){
    var dt=1.2-P.deadT;
    pimg=dt<0.25?Art.moleDie[0]:dt<0.55?Art.moleDie[1]:Art.moleDie[2+(Math.floor(dt*6)%2)];
    ctx.drawImage(pimg,px(P.x),py(P.y));
  }else if(!(P.inv>0&&Math.floor(P.inv/0.0625)%2===0)){
    if(state==='stageClear'){var jump=Math.abs(Math.sin(realT*8))*6;ctx.drawImage(Art.mole.down[Math.floor(realT*6)%2],px(P.x),py(P.y)-Math.round(jump/2)*2);}
    else ctx.drawImage(Art.mole[P.facing][P.moving?P.par:0],px(P.x),py(P.y));
  }
  /* particles */
  particles.forEach(function(p){ctx.globalAlpha=Math.max(0,1-p.t/p.life);ctx.fillStyle=p.c;ctx.fillRect(Math.round(p.x/2)*2,Math.round(p.y/2)*2,p.s,p.s);});
  ctx.globalAlpha=1;
  /* lantern light + vignette */
  var pxx=(P.x+0.5)*TS,pyy=HUD+(P.y+0.5)*TS,fl=1+Math.sin(realT*9)*0.05+Math.sin(realT*23)*0.03;
  var gr=ctx.createRadialGradient(pxx,pyy,4,pxx,pyy,110*fl);
  gr.addColorStop(0,'rgba(255,190,90,0.16)');gr.addColorStop(1,'rgba(255,190,90,0)');
  ctx.fillStyle=gr;ctx.fillRect(0,HUD,W,352);
  ctx.drawImage(vign,0,HUD);
  if(flashT>0){ctx.globalAlpha=flashT/0.4*0.5;ctx.fillStyle='#fff6b0';ctx.fillRect(0,HUD,W,352);ctx.globalAlpha=1;}
  popups.forEach(function(p){T(p.s,(p.x+0.5)*TS,HUD+(p.y+0.5)*TS-8-p.t*30,1,'#fff6b0',{align:'center'});});
  ctx.restore();
}
function fmtTime(){var t=Math.max(0,Math.ceil(timeLeft)),m=Math.floor(t/60),s=t%60;return m+':'+(s<10?'0':'')+s;}
function drawHud(){
  ctx.fillStyle='#2a1a0e';ctx.fillRect(0,0,W,HUD);
  for(var i=0;i<W;i+=16){ctx.fillStyle=(i/16)%2?'#33200f':'#2e1c0d';ctx.fillRect(i,0,16,HUD-4);}
  ctx.fillStyle='#6a4527';ctx.fillRect(0,HUD-4,W,2);ctx.fillStyle='#120a05';ctx.fillRect(0,HUD-2,W,2);
  T('SCORE '+pad6(score),8,5,2,'#ffd23a');
  T('HI '+pad6(Math.max(hiStored,score)),192,5,2,'#ffffff');
  var low=timeLeft<=30&&Math.floor(realT*3)%2===0;
  T('TIME '+fmtTime(),W-8,5,2,low?'#ff4a3a':'#8fe8ff',{align:'right'});
  T('STAGE '+stage+'/5',8,24,2,'#ffffff');
  ctx.drawImage(Art.face,142,24);
  T('x'+lives,164,24,2,'#ffffff');
  T('SND '+(Aud.muted?'OFF':'ON'),W-8,24,2,Aud.muted?'#ff8a7a':'#9af09a',{align:'right'});
  T('BOMB '+pw.maxBombs,8,43,2,'#ff9a6a');
  T('FIRE '+pw.range,128,43,2,'#ffb03a');
  T('SPD '+pw.boots,248,43,2,'#a0d8ff');
}
function overlay(a){ctx.fillStyle='rgba(0,0,0,'+a+')';ctx.fillRect(0,HUD,W,352);}
function drawTitle(){
  ctx.drawImage(Art.titleBg,0,0);
  /* fireflies */
  for(var i=0;i<14;i++){var fx=(i*67+Math.sin(realT*0.7+i)*30+480)%480,fy=120+((i*53)%200)+Math.sin(realT*1.3+i*2)*12;
    ctx.globalAlpha=0.5+0.5*Math.sin(realT*3+i);ctx.fillStyle='#ffe98a';ctx.fillRect(Math.round(fx/2)*2,Math.round(fy/2)*2,2,2);}
  ctx.globalAlpha=1;
  var bob=Math.round(Math.sin(realT*2)*2);
  ctx.drawImage(Art.logo,20,24+bob);texts.push('DYNAMITE MOLE');
  /* scene */
  var mx=((realT*40)%560)-40;
  ctx.drawImage(Art.mole.right[Math.floor(realT*6)%2],Math.round(mx/2)*2,180);
  ctx.drawImage(Art.bomb[Math.floor(realT*6)%3],330,180);ctx.drawImage(Art.bomb[Math.floor(realT*6+1)%3],90,180);
  ctx.drawImage(Art.slime[Math.floor(realT*3)%2],200,180);ctx.drawImage(Art.bat[Math.floor(realT*8)%2],420,150+Math.round(Math.sin(realT*3)*3)*2);
  ctx.drawImage(Art.golem[Math.floor(realT*3)%2],40,180);
  if(Math.floor(realT*2)%2===0)TC('PRESS ENTER TO START',232,2,'#ffd23a');else texts.push('PRESS ENTER TO START');
  TC('HI-SCORE '+pad6(hiStored),262,2,'#ffffff');
  var L=['ARROWS / WASD  MOVE','SPACE / Z      BOMB','P / ESC        PAUSE','R              RESTART','M              SOUND'];
  for(i=0;i<5;i++)T(L[i],120,306+i*18,2,'#f4e9d0');
}
function drawIntro(){
  overlay(0.65);var st=STAGES[stage-1];
  TC('STAGE '+stage,HUD+90,4,'#ffd23a');
  TC(st.name,HUD+140,2,'#ffffff');
  TC('ENEMIES '+(st.e.slime+st.e.bat+st.e.ghost+st.e.golem),HUD+170,2,'#ff9a6a');
  var list=[];EORDER.forEach(function(t){for(var k=0;k<st.e[t];k++)list.push(t);});
  var x0=Math.round(W/2-list.length*18)+2;
  list.forEach(function(t,i){ctx.drawImage((t==='ghost'?Art.ghost[0]:Art[t])[Math.floor(realT*4)%2],x0+i*36-2,HUD+198);});
}
function drawResult(){
  overlay(0.78);
  var over=state==='gameOver',y=HUD+40;
  if(over){TC('GAME OVER',y,4,'#ff5a4a');y+=60;TC('SCORE '+pad6(score),y,2,'#ffffff');y+=26;TC('BEST  '+pad6(hiStored),y,2,'#ffd23a');y+=26;TC('REACHED STAGE '+stage,y,2,'#ffffff');y+=30;}
  else{TC('CONGRATULATIONS!',y,3,'#ffd23a');y+=40;TC('YOU ESCAPED THE MINE',y,2,'#ffffff');y+=34;TC('SCORE '+pad6(score),y,2,'#ffffff');y+=26;TC('BEST  '+pad6(hiStored),y,2,'#ffd23a');y+=32;}
  if(newRecord){if(Math.floor(realT*3)%2===0)TC('NEW RECORD!',y,2,'#7dffb0');else texts.push('NEW RECORD!');}
  y+=32;
  TC(over?'ENTER  RETRY':'ENTER  PLAY AGAIN',y,2,'#ffffff');y+=24;TC('ESC    TITLE',y,2,'#ffffff');
}
function render(){
  texts=[];
  ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
  if(state==='title'){drawTitle();return;}
  drawField();drawHud();
  if(state==='stageIntro')drawIntro();
  else if(state==='paused'){overlay(0.6);TC('PAUSED',HUD+100,4,'#ffd23a');TC('P / ESC  RESUME',HUD+160,2,'#ffffff');TC('R  RESTART',HUD+186,2,'#ffffff');TC('M  SOUND',HUD+212,2,'#ffffff');}
  else if(state==='stageClear'){overlay(0.4);TC('STAGE CLEAR!',HUD+100,3,'#ffd23a');TC('CLEAR BONUS +'+clearBonus,HUD+150,2,'#ffffff');TC('TIME BONUS +'+timeBonus,HUD+178,2,'#8fe8ff');}
  else if(state==='gameOver'||state==='gameClear')drawResult();
}

/* ---------- loop ---------- */
genStage(stage);
var last=performance.now(),acc=0;
function frame(now){
  requestAnimationFrame(frame);
  var dt=(now-last)/1000;last=now;if(dt>0.25)dt=0.25;if(dt<0)dt=0;
  realT+=dt;
  if(state==='paused'||document.hidden)acc=0;
  else{acc+=dt;while(acc>=STEP){update(STEP);acc-=STEP;}}
  Aud.bgm=bgmId();Aud.paused=state==='paused';
  render();
}
requestAnimationFrame(frame);
})();
