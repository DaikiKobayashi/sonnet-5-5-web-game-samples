/* All sprites are generated in code. Every "dot" is 2x2 px (16x16 dot grid per 32x32 cell). */
(function(){
function cv(w,h){var c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function mk(fn,w,h){
  var c=cv(w||32,h||32),x=c.getContext('2d');
  var p=function(a,b,cw,ch,col){x.fillStyle=col;x.fillRect(a*2,b*2,cw*2,ch*2);};
  fn(p,x,c);return c;
}
function flipH(c){var o=cv(c.width,c.height),x=o.getContext('2d');x.translate(c.width,0);x.scale(-1,1);x.drawImage(c,0,0);return o;}
function rot(c,q){var o=cv(c.width,c.height),x=o.getContext('2d');x.translate(c.width/2,c.height/2);x.rotate(q*Math.PI/2);x.drawImage(c,-c.width/2,-c.height/2);return o;}
function whiten(c,a){var o=cv(c.width,c.height),x=o.getContext('2d');x.drawImage(c,0,0);x.globalCompositeOperation='source-atop';x.fillStyle='rgba(255,255,255,'+a+')';x.fillRect(0,0,c.width,c.height);return o;}
function rng(seed){var s=seed>>>0;return function(){s=(s+0x6D2B79F5)>>>0;var t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

var OUT='#1a0f0a';
var TH=[
{fl:['#8c6239','#845b34'],fs:'#6e4a2a',wall:'#4b3018',wallL:'#6a4527',wallD:'#2e1c0e',pil:'#b07a3c',pilL:'#d9a45a',pilD:'#7a4e22',rock:'#cdb58c',rockL:'#eadab8',rockD:'#8f7752',glow:'#ffd27a'},
{fl:['#1d5c5a','#1a5553'],fs:'#124240',wall:'#38246a',wallL:'#55389a',wallD:'#1f1240',pil:'#7a4ab8',pilL:'#b48af0',pilD:'#4a2a80',rock:'#8fd0c0',rockL:'#c8f4e8',rockD:'#4f9084',glow:'#7dffd0'},
{fl:['#2a4f8c','#254680'],fs:'#1a3466',wall:'#152a5a',wallL:'#2a4a8a',wallD:'#0a1533',pil:'#5cc8f0',pilL:'#b8f0ff',pilD:'#2a8ab8',rock:'#a4c4e8',rockL:'#dcecff',rockD:'#6a88b8',glow:'#9ff0ff'},
{fl:['#4a1c14','#42170f'],fs:'#2e0f0a',wall:'#26100c',wallL:'#4a2018',wallD:'#100504',pil:'#7a3018',pilL:'#b04a20',pilD:'#3a1408',rock:'#6c5a58',rockL:'#96807c',rockD:'#3e3230',glow:'#ff8a1a'},
{fl:['#15163a','#111230'],fs:'#0a0b22',wall:'#070818',wallL:'#161a3c',wallD:'#03030c',pil:'#2c3378',pilL:'#5a66c8',pilD:'#161a4a',rock:'#3c4488',rockL:'#6a78d0',rockD:'#1e2256',glow:'#4dffe8'}];

var A={themes:TH};
A.floor=[];A.wall=[];A.pillar=[];A.rock=[];A.crumble=[];
TH.forEach(function(t,ti){
  A.floor.push([0,1].map(function(v){return mk(function(p){
    p(0,0,16,16,t.fl[v]);
    var r=rng(ti*31+v*7+3);
    for(var i=0;i<6;i++){p(Math.floor(r()*14),Math.floor(r()*14),2,1,t.fs);}
    p(0,15,16,1,t.fs);p(15,0,1,16,t.fs);
    if(v===1)p(Math.floor(r()*12)+1,Math.floor(r()*12)+1,1,1,t.glow.replace('#','#')+'');
  });}));
  A.wall.push(mk(function(p){
    p(0,0,16,16,t.wall);
    p(0,0,16,1,t.wallL);p(0,0,1,16,t.wallL);p(0,15,16,1,t.wallD);p(15,0,1,16,t.wallD);
    p(0,5,16,1,t.wallD);p(0,10,16,1,t.wallD);
    p(8,0,1,5,t.wallD);p(4,5,1,5,t.wallD);p(12,5,1,5,t.wallD);p(8,10,1,5,t.wallD);
    p(1,1,6,1,t.wallL);p(9,6,3,1,t.wallL);p(1,11,6,1,t.wallL);
    if(ti===4){p(3,3,1,1,t.glow);p(12,12,1,1,t.glow);}
  }));
  A.pillar.push(mk(function(p){
    p(0,0,16,16,t.fl[0]);
    p(0,15,16,1,t.fs);
    p(2,13,12,2,'rgba(0,0,0,0.35)');
    p(3,2,10,12,OUT);
    p(4,3,8,10,t.pil);p(4,3,2,10,t.pilL);p(10,3,2,10,t.pilD);p(3,2,10,1,t.pilL);
    if(ti===0){p(4,7,8,2,t.pilD);p(6,3,1,10,t.pilD);}
    if(ti===1){p(6,5,4,2,t.glow);p(5,8,2,2,t.glow);p(9,9,2,2,t.glow);}
    if(ti===2){p(7,3,2,10,t.pilL);p(5,6,1,4,'#ffffff');p(10,5,1,5,'#ffffff');}
    if(ti===3){p(6,4,1,3,t.glow);p(7,7,3,1,t.glow);p(9,8,1,4,t.glow);}
    if(ti===4){p(6,5,1,1,t.glow);p(9,8,1,1,t.glow);p(7,11,1,1,t.glow);p(5,8,1,1,t.pilL);}
  }));
  A.rock.push(mk(function(p){
    p(0,0,16,16,t.fl[0]);
    p(2,14,12,1,'rgba(0,0,0,0.35)');
    p(1,3,14,11,OUT);p(2,2,12,1,OUT);
    p(2,3,12,10,t.rock);p(3,2,10,1,t.rockL);p(2,3,3,3,t.rockL);p(3,3,5,1,t.rockL);
    p(2,11,12,2,t.rockD);p(11,4,3,7,t.rockD);
    p(6,6,1,2,t.rockD);p(7,8,2,1,t.rockD);p(8,9,1,2,t.rockD);
    if(ti>=1){p(5,5,1,1,t.glow);p(10,10,1,1,t.glow);}
    if(ti===3){p(4,9,2,1,t.glow);p(7,4,1,2,t.glow);}
  }));
  A.crumble.push([0,1,2].map(function(k){return mk(function(p,x){
    var q=[[2,3],[8,3],[2,8],[8,8]],sz=5-k*1.5,off=k*2+1;
    x.globalAlpha=1-k*0.3;
    q.forEach(function(qq,i){
      var dx=(i%2?1:-1)*off,dy=(i<2?-1:1)*off;
      p(qq[0]+dx+(5-sz)/2,qq[1]+dy+(5-sz)/2,sz,sz,i%2?t.rockD:t.rock);
      p(qq[0]+dx+(5-sz)/2,qq[1]+dy+(5-sz)/2,Math.max(1,sz-2),1,t.rockL);
    });
  });}));
});

/* ---------- mole ---------- */
function moleDraw(p,dir,f,mode){
  var B='#8b5a34',BD='#6b3f22',BL='#c9905e',HY='#ffd23a',HD='#d99a10',LP='#fff6b0',SN='#f0a0a0',CL='#f4e9d0';
  p(3,14,10,1,'rgba(0,0,0,0.35)');
  var la=f?1:0;
  if(dir==='down'||dir==='up'){
    p(3+0,12+la,4,3,OUT);p(9,12+(1-la),4,3,OUT);
    p(4,12+la,2,2,BD);p(10,12+(1-la),2,2,BD);
    p(2,5,12,8,OUT);p(3,6,10,6,B);p(3,6,2,6,BD);
    if(dir==='down'){p(6,8,4,4,BL);p(1,9,2,3,OUT);p(13,9,2,3,OUT);p(2,9,1,2,B);p(13,9,1,2,B);p(1,11,2,1,CL);p(13,11,2,1,CL);}
    else{p(1,9,2,3,OUT);p(13,9,2,3,OUT);p(2,9,1,2,B);p(13,9,1,2,B);p(7,11,2,2,BD);}
    p(2,1,12,6,OUT);p(3,2,10,4,HY);p(3,5,10,1,HD);p(2,5,12,1,OUT);
    p(3,2,3,1,LP);
    if(dir==='down'){
      p(3,6,10,3,B);p(3,6,10,1,HD);
      p(5,7,1,2,'#111');p(10,7,1,2,'#111');
      p(6,8,4,3,SN);p(7,8,2,1,'#5a2a2a');p(6,8,1,1,'#fff');
      p(7,2,2,2,LP);
    }else{p(3,6,10,1,HD);p(7,2,2,2,HD);}
  }else{ /* left */
    p(4,12+la,4,3,OUT);p(9,12+(1-la),4,3,OUT);p(5,12+la,2,2,BD);p(10,12+(1-la),2,2,BD);
    p(4,5,10,8,OUT);p(5,6,8,6,B);p(11,6,2,6,BD);p(5,8,3,3,BL);
    p(3,9,3,3,OUT);p(4,9,1,2,B);p(3,11,2,1,CL);
    p(13,10,2,2,OUT);p(13,10,1,1,BD);
    p(2,1,11,6,OUT);p(3,2,9,4,HY);p(3,5,10,1,HD);p(2,5,11,1,OUT);
    p(4,2,3,1,LP);p(4,2,2,2,LP);
    p(2,6,7,4,OUT);p(3,6,6,3,B);
    p(0,7,3,3,OUT);p(1,7,2,2,SN);p(1,7,1,1,'#5a2a2a');
    p(5,7,1,2,'#111');
  }
}
A.mole={};
['up','down','left'].forEach(function(d){A.mole[d]=[0,1].map(function(f){return mk(function(p){moleDraw(p,d,f);});});});
A.mole.right=A.mole.left.map(flipH);
A.moleDie=[
  mk(function(p){moleDraw(p,'down',0);p(5,7,2,2,'#fff');p(10,7,2,2,'#fff');p(5,7,1,1,'#c00');p(11,8,1,1,'#c00');}),
  mk(function(p){
    p(3,14,10,1,'rgba(0,0,0,0.35)');
    p(1,9,14,5,OUT);p(2,10,12,3,'#8b5a34');p(2,12,12,1,'#6b3f22');
    p(2,6,12,4,OUT);p(3,7,10,2,'#ffd23a');p(3,8,10,1,'#d99a10');
    p(4,10,3,1,'#111');p(9,10,3,1,'#111');p(7,11,2,2,'#f0a0a0');
  })
];
function stars(a){return mk(function(p){
  p(3,14,10,1,'rgba(0,0,0,0.35)');
  p(1,9,14,5,OUT);p(2,10,12,3,'#8b5a34');p(2,12,12,1,'#6b3f22');
  p(2,6,12,4,OUT);p(3,7,10,2,'#ffd23a');p(3,8,10,1,'#d99a10');
  p(4,10,1,1,'#111');p(5,11,1,1,'#111');p(5,10,1,1,'#111');p(4,11,1,1,'#111');p(10,10,1,1,'#111');p(11,11,1,1,'#111');p(11,10,1,1,'#111');p(10,11,1,1,'#111');
  p(7,11,2,2,'#f0a0a0');
  var pos=a?[[3,3],[11,2],[7,5]]:[[11,4],[4,2],[7,0]];
  pos.forEach(function(s){p(s[0],s[1],2,2,'#fff6b0');p(s[0]-1,s[1]+0,1,2,'#ffd23a');p(s[0]+2,s[1],1,2,'#ffd23a');p(s[0],s[1]-1,2,1,'#ffd23a');p(s[0],s[1]+2,2,1,'#ffd23a');});
});}
A.moleDie.push(stars(0),stars(1));
A.face=mk(function(p){
  p(1,0,6,2,'#ffd23a');p(0,1,8,1,'#d99a10');p(3,0,2,1,'#fff6b0');
  p(1,2,6,5,'#8b5a34');p(2,3,1,1,'#111');p(5,3,1,1,'#111');p(3,4,2,2,'#f0a0a0');
},16,16);

/* ---------- enemies ---------- */
A.slime=[0,1].map(function(f){return mk(function(p){
  p(3,14,10,1,'rgba(0,0,0,0.35)');
  if(!f){p(3,5,10,9,OUT);p(4,6,8,7,'#5fd05a');p(4,10,8,3,'#2f8a3a');p(5,6,3,2,'#b8f5a0');
    p(5,8,2,3,'#fff');p(9,8,2,3,'#fff');p(6,9,1,2,'#111');p(10,9,1,2,'#111');p(7,12,2,1,'#1a4a1a');}
  else{p(2,7,12,7,OUT);p(3,8,10,5,'#5fd05a');p(3,11,10,2,'#2f8a3a');p(4,8,3,1,'#b8f5a0');
    p(4,9,2,3,'#fff');p(10,9,2,3,'#fff');p(5,10,1,2,'#111');p(11,10,1,2,'#111');p(7,12,2,1,'#1a4a1a');}
});});
A.bat=[0,1].map(function(f){return mk(function(p){
  p(4,14,8,1,'rgba(0,0,0,0.25)');
  var P='#8a4fd0',PD='#4a2a80';
  if(!f){p(0,2,6,6,OUT);p(10,2,6,6,OUT);p(1,3,5,4,P);p(10,3,5,4,P);p(1,3,2,2,PD);p(13,3,2,2,PD);p(3,6,3,2,PD);p(10,6,3,2,PD);}
  else{p(0,7,6,5,OUT);p(10,7,6,5,OUT);p(1,8,5,3,P);p(10,8,5,3,P);p(1,10,2,1,PD);p(13,10,2,1,PD);}
  p(5,5,6,8,OUT);p(6,6,4,6,P);p(6,6,1,6,'#b088ee');
  p(5,3,2,3,OUT);p(9,3,2,3,OUT);p(6,4,1,2,PD);p(9,4,1,2,PD);
  p(6,7,1,1,'#ffe040');p(9,7,1,1,'#ffe040');p(7,10,1,1,'#fff');p(8,10,1,1,'#fff');
});});
A.ghost=[0,1].map(function(ch){return [0,1].map(function(f){return mk(function(p){
  p(4,14,8,1,'rgba(0,0,0,0.2)');
  var W='#e8f0ff',S='#a8b8e8';
  p(3,2,10,12,OUT);p(4,1,8,1,OUT);
  p(4,2,8,11,W);p(5,1,6,1,W);p(10,3,2,10,S);p(4,11,8,2,S);
  if(!f){p(3,13,2,2,OUT);p(6,13,2,2,OUT);p(9,13,2,2,OUT);p(12,13,1,2,OUT);p(4,13,1,1,W);p(7,13,1,1,W);p(10,13,1,1,W);}
  else{p(4,13,2,2,OUT);p(7,13,2,2,OUT);p(10,13,2,2,OUT);p(3,13,1,2,OUT);p(5,13,1,1,W);p(8,13,1,1,W);p(11,13,1,1,W);}
  var e=ch?'#ff2a2a':'#222';
  p(5,5,2,3,e);p(9,5,2,3,e);if(ch){p(5,5,1,1,'#ffb0b0');p(9,5,1,1,'#ffb0b0');p(6,10,4,1,'#c02020');}else{p(7,10,2,1,'#556');}
});});});
function golemDraw(p,f){
  var G='#8a8a94',GD='#55555f',GL='#b8b8c4';
  p(2,14,12,1,'rgba(0,0,0,0.35)');
  p(2,12+f,4,3-f,OUT);p(10,12+(1-f),4,3-(1-f),OUT);p(3,12+f,2,2,GD);p(11,12+(1-f),2,2,GD);
  p(1,4,14,9,OUT);p(2,5,12,7,G);p(2,5,12,1,GL);p(2,11,12,1,GD);p(11,6,3,6,GD);
  p(0,6,2,6,OUT);p(14,6,2,6,OUT);p(1,7,1,4,GD);p(14,7,1,4,GD);
  p(3,1,10,5,OUT);p(4,2,8,4,GL);p(4,2,8,1,'#d8d8e4');p(4,5,8,1,G);
  p(5,3,2,2,'#ff8a1a');p(9,3,2,2,'#ff8a1a');p(5,3,1,1,'#ffe080');p(9,3,1,1,'#ffe080');
  p(4,8,2,1,GD);p(8,9,3,1,GD);p(6,7,1,2,GD);
}
A.golem=[0,1].map(function(f){return mk(function(p){golemDraw(p,f);});});
A.golemFlash=A.golem.map(function(c){return whiten(c,0.85);});
A.puff=[0,1,2].map(function(k){return mk(function(p,x){
  var r=[3,5,6][k];x.globalAlpha=[1,0.8,0.5][k];
  var cs=['#ffffff','#d8d8e0','#a0a0b0'];
  for(var i=0;i<6;i++){var a=i*Math.PI/3+k*0.5;var cx=8+Math.round(Math.cos(a)*(r*0.8)),cy=8+Math.round(Math.sin(a)*(r*0.8));
    var s=k===2?2:3;p(cx-1,cy-1,s,s,cs[k]);}
  p(8-Math.max(1,3-k),8-Math.max(1,3-k),Math.max(2,6-2*k),Math.max(2,6-2*k),k<2?'#ffe9a0':'#c0c0c8');
});});

/* ---------- objects ---------- */
A.bomb=[0,1,2].map(function(f){return mk(function(p){
  p(3,14,10,1,'rgba(0,0,0,0.4)');
  p(4,5,8,10,OUT);p(5,6,6,8,'#d8302a');p(5,6,2,8,'#f06050');p(9,6,2,8,'#a01c1c');
  p(5,9,6,2,'#f4e9d0');p(6,9,1,2,'#333');p(8,9,2,1,'#333');
  p(5,4,6,2,OUT);p(6,4,4,1,'#888');
  p(8,2,1,2,'#c8a060');
  if(f===0){p(7,0,3,2,'#ffd23a');p(8,0,1,1,'#fff');}
  else if(f===1){p(7,1,3,1,'#ff8a1a');p(8,0,1,1,'#ffd23a');p(6,1,1,1,'#ffd23a');}
  else{p(6,0,5,2,'#fff6b0');p(7,0,3,2,'#ff8a1a');p(8,1,1,1,'#fff');}
});});
var FO='#e8401a',FM='#ff9a1a',FC='#fff2a0';
A.flameC=[0,1].map(function(f){return mk(function(p){
  p(1,1,14,14,FO);p(0,3,16,10,FO);p(3,0,10,16,FO);
  p(3,3,10,10,FM);p(2,5,12,6,FM);p(5,2,6,12,FM);
  p(5,5,6,6,FC);p(6,4,4,8,FC);
  if(f){p(1,1,2,2,'#7a1a0a');p(13,13,2,2,'#7a1a0a');p(6,6,4,4,'#fff');}else{p(13,1,2,2,'#7a1a0a');p(1,13,2,2,'#7a1a0a');p(7,7,2,2,'#fff');}
});});
A.flameArmH=[0,1].map(function(f){return mk(function(p){
  p(0,2,16,12,FO);p(0,4,16,8,FM);p(0,6,16,4,FC);
  if(f){p(2,1,3,1,FO);p(9,14,3,1,FO);p(6,7,3,2,'#fff');}else{p(9,1,3,1,FO);p(3,14,3,1,FO);p(11,7,3,2,'#fff');}
});});
A.flameArmV=A.flameArmH.map(function(c){return rot(c,1);});
A.flameTip=[0,1].map(function(f){var base=mk(function(p){
  p(0,2,12,12,FO);p(12,4,2,8,FO);p(14,6,1,4,FO);
  p(0,4,11,8,FM);p(11,5,2,6,FM);p(0,6,11,4,FC);p(11,7,1,2,FC);
  if(f){p(2,1,3,1,FO);p(6,7,3,2,'#fff');}else{p(7,14,3,1,FO);p(3,7,3,2,'#fff');}
});return [0,1,2,3].map(function(d){return rot(base,[3,0,1,2][d]);});});
/* tip directions: index 0=up,1=right,2=down,3=left (base drawn pointing right) */
A.item={};
function plate(p){p(2,2,12,12,'#503010');p(3,3,10,10,'#fff4d0');p(3,3,10,1,'#fff');p(3,12,10,1,'#d8c090');}
A.item.fire=mk(function(p){plate(p);
  p(7,3,2,2,'#e8401a');p(6,5,4,2,'#e8401a');p(5,7,6,4,'#e8401a');p(6,11,4,1,'#e8401a');
  p(6,8,4,3,'#ff9a1a');p(7,9,2,2,'#fff2a0');});
A.item.bomb=mk(function(p){plate(p);
  p(5,6,6,6,'#222');p(4,7,8,4,'#222');p(5,7,2,2,'#777');
  p(9,4,1,2,'#8a5a20');p(10,3,2,2,'#ff8a1a');p(11,3,1,1,'#ffd23a');});
A.item.boots=mk(function(p){plate(p);
  p(5,4,4,6,'#8a4a20');p(5,9,7,3,'#8a4a20');p(5,4,4,1,'#c88040');p(5,11,7,1,'#3a2010');p(9,9,3,1,'#c88040');p(5,6,4,1,'#3a2010');});
A.item.life=mk(function(p){plate(p);
  p(4,5,3,2,'#e83a5a');p(9,5,3,2,'#e83a5a');p(3,6,10,3,'#e83a5a');p(4,9,8,1,'#e83a5a');p(5,10,6,1,'#e83a5a');p(6,11,4,1,'#e83a5a');
  p(4,5,2,1,'#ffb0c0');p(5,6,1,1,'#ffb0c0');});
A.exitClosed=mk(function(p){
  p(1,1,14,14,OUT);p(2,2,12,12,'#5a3a1a');p(2,2,12,1,'#8a5a2a');
  p(2,5,12,1,'#3a2210');p(2,9,12,1,'#3a2210');p(2,12,12,1,'#3a2210');
  p(2,4,12,1,'#777');p(2,11,12,1,'#777');
  p(6,6,4,4,'#ffd23a');p(7,7,2,2,OUT);p(7,8,2,1,'#ffd23a');
});
A.exitOpen=[0,1].map(function(f){return mk(function(p){
  p(0,0,16,16,f?'rgba(255,230,120,0.35)':'rgba(255,210,90,0.25)');
  p(1,1,14,14,OUT);p(2,2,12,12,'#0a0806');
  p(3,3,10,10,f?'#fff2a0':'#ffd23a');p(4,4,8,8,'#0a0806');
  p(5,3,1,10,'#c8a060');p(10,3,1,10,'#c8a060');
  [4,6,8,10].forEach(function(y){p(6,y,4,1,f?'#fff':'#e8c880');});
});});

/* ---------- logo / title ---------- */
function outlineText(x,s,px,py,sc,fill,fill2,outline,shadow){
  var i,dx,dy;
  for(i=0;i<8;i++){dx=[-1,0,1,-1,1,-1,0,1][i]*sc;dy=[-1,-1,-1,0,0,1,1,1][i]*sc;Font.draw(x,s,px+dx,py+dy+sc*2,sc,shadow);}
  for(i=0;i<8;i++){dx=[-1,0,1,-1,1,-1,0,1][i]*sc;dy=[-1,-1,-1,0,0,1,1,1][i]*sc;Font.draw(x,s,px+dx,py+dy,sc,outline);}
  Font.draw(x,s,px,py,sc,fill);
  x.save();x.beginPath();x.rect(px-sc,py+sc*4,Font.width(s,sc)+2*sc,sc*4);x.clip();Font.draw(x,s,px,py,sc,fill2);x.restore();
}
A.outlineText=outlineText;
A.logo=(function(){
  var c=cv(440,120),x=c.getContext('2d');
  var s1='DYNAMITE',s2='MOLE',sc=7;
  outlineText(x,s1,Math.round((440-Font.width(s1,sc))/2),8,sc,'#ffd23a','#ff8a1a','#3a1408','#8a2410');
  outlineText(x,s2,Math.round((440-Font.width(s2,sc))/2),62,sc,'#ffd23a','#ff8a1a','#3a1408','#8a2410');
  x.drawImage(A.bomb[0],60,70);x.drawImage(A.bomb[0],348,70);
  return c;
})();
A.titleBg=(function(){
  var c=cv(480,416),x=c.getContext('2d'),r=rng(777),i,j;
  var g=x.createLinearGradient(0,0,0,416);g.addColorStop(0,'#150c08');g.addColorStop(1,'#2e1a0e');
  x.fillStyle=g;x.fillRect(0,0,480,416);
  var cols=['#24140c','#2c190f','#33200f','#1c100a','#3a2412'];
  for(j=0;j<52;j++)for(i=0;i<60;i++){if(r()<0.5){x.fillStyle=cols[Math.floor(r()*cols.length)];x.fillRect(i*8,j*8,8,8);}}
  for(i=0;i<480;i+=16){var len=16+Math.floor(r()*56);
    for(var k=0;k<len;k+=4){var w=Math.max(2,Math.round((16-(k*16/len))/2)*2);x.fillStyle=k%8?'#3a2412':'#4a2e18';x.fillRect(i+(16-w)/2,k,w,4);}}
  for(i=0;i<8;i++){var cx=Math.floor(r()*56)*8+8,cy=200+Math.floor(r()*20)*8;
    x.fillStyle='#2a8ab8';x.fillRect(cx,cy,8,24);x.fillRect(cx-8,cy+8,8,16);x.fillRect(cx+8,cy+12,8,12);
    x.fillStyle='#9ff0ff';x.fillRect(cx,cy,4,12);x.fillRect(cx-8,cy+8,4,8);}
  x.fillStyle='#4b3018';x.fillRect(0,320,480,96);
  for(j=0;j<12;j++)for(i=0;i<60;i++){x.fillStyle=(i+j)%2?'#5a3a1c':'#523418';x.fillRect(i*8,320+j*8,8,8);}
  x.fillStyle='#7a5228';x.fillRect(0,320,480,4);
  return c;
})();
window.Art=A;
})();
