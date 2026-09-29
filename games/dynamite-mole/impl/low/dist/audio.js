/* Web Audio synthesized SFX and BGM. No external files. */
(function(){
var A={ctx:null,master:null,sfxG:null,bgmG:null,unlocked:false,muted:false,log:[],bgm:null,fast:false,paused:false};
var lastExplode=0,step=0,nextT=0,curTrack=null,timer=null,noiseBuf=null;
function mtof(m){return 440*Math.pow(2,(m-69)/12);}
A.unlock=function(){
  try{
    if(A.ctx){if(A.ctx.state==='suspended')A.ctx.resume();return;}
    var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    var c=new AC();A.ctx=c;
    var comp=c.createDynamicsCompressor();comp.connect(c.destination);
    A.master=c.createGain();A.master.gain.value=0.9;A.master.connect(comp);
    A.sfxG=c.createGain();A.sfxG.gain.value=1;A.sfxG.connect(A.master);
    A.bgmG=c.createGain();A.bgmG.gain.value=1;A.bgmG.connect(A.master);
    var n=c.sampleRate*1,b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);
    for(var i=0;i<n;i++)d[i]=Math.random()*2-1;noiseBuf=b;
    A.unlocked=true;
    timer=setInterval(sched,50);
  }catch(e){}
};
function tone(f,d,type,v,t0,slide,dest){
  var c=A.ctx;if(!c)return;
  try{
    var t=c.currentTime+(t0||0),o=c.createOscillator(),g=c.createGain();
    o.type=type||'square';o.frequency.setValueAtTime(f,t);
    if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t+d);
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(v,t+0.005);
    g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.connect(g);g.connect(dest||A.sfxG);o.start(t);o.stop(t+d+0.02);
  }catch(e){}
}
function noise(d,v,t0,f0,f1,type,dest){
  var c=A.ctx;if(!c||!noiseBuf)return;
  try{
    var t=c.currentTime+(t0||0),s=c.createBufferSource(),fl=c.createBiquadFilter(),g=c.createGain();
    s.buffer=noiseBuf;fl.type=type||'lowpass';fl.frequency.setValueAtTime(f0,t);
    if(f1)fl.frequency.exponentialRampToValueAtTime(f1,t+d);
    g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    s.connect(fl);fl.connect(g);g.connect(dest||A.sfxG);s.start(t);s.stop(t+d+0.02);
  }catch(e){}
}
function seq(notes,type,v,gap){var t=0;notes.forEach(function(n){if(n[0])tone(n[0],n[1]*1.1,type,v,t);t+=n[1]+(gap||0);});}
var N={C4:262,D4:294,E4:330,F4:349,G4:392,A4:440,B4:494,C5:523,D5:587,E5:659,F5:698,G5:784,A5:880,B5:988,C6:1047,E6:1319};
var SFX={
  start:function(){seq([[N.C5,0.11],[N.E5,0.11],[N.G5,0.16]],'square',0.22);},
  place:function(){tone(200,0.1,'sine',0.3,0,90);},
  explode:function(){noise(0.5,0.3,0,1800,120,'lowpass');tone(140,0.5,'sawtooth',0.25,0,30);},
  break:function(){noise(0.15,0.25,0,3000,800,'highpass');tone(300,0.08,'square',0.12,0,100);},
  enemyDie:function(){tone(700,0.3,'square',0.2,0,140);},
  hit:function(){tone(1200,0.15,'triangle',0.3,0);tone(1850,0.1,'square',0.12,0);},
  playerDie:function(){tone(600,0.9,'sawtooth',0.22,0,50);tone(300,0.9,'square',0.1,0.05,40);},
  item:function(){seq([[N.E5,0.09],[N.B5,0.12]],'square',0.2);},
  life:function(){seq([[N.C5,0.13],[N.E5,0.13],[N.G5,0.13],[N.C6,0.25]],'square',0.2);},
  exitOpen:function(){seq([[N.C5,0.09],[N.E5,0.09],[N.G5,0.09],[N.C6,0.09],[N.E6,0.2]],'triangle',0.3);},
  stageClear:function(){seq([[N.C5,0.15],[N.E5,0.15],[N.G5,0.15],[N.C6,0.3],[N.G5,0.15],[N.C6,0.2],[N.E6,0.5]],'square',0.18);
    seq([[N.C4,0.3],[N.G4,0.3],[N.C5,0.4],[N.C4,0.2],[N.G4,0.4]],'triangle',0.25);},
  gameOver:function(){seq([[N.E5,0.35],[N.D5,0.35],[N.C5,0.35],[N.A4,0.35],[N.G4,0.4],[N.E4,0.9]],'triangle',0.3);
    seq([[N.C4,0.7],[N.A4/2,0.7],[N.G4/2,1.1]],'sawtooth',0.08);},
  gameClear:function(){seq([[N.C5,0.18],[N.E5,0.18],[N.G5,0.18],[N.C6,0.3],[N.B5,0.15],[N.C6,0.15],[N.D5*2,0.3],[N.E6,0.5],[N.G5,0.15],[N.C6,0.15],[N.E6,0.15],[1568,0.7]],'square',0.17);
    seq([[N.C4,0.36],[N.G4,0.36],[N.C5,0.36],[N.G4,0.36],[N.F4,0.36],[N.A4,0.36],[N.G4,0.36],[N.C5,0.9]],'triangle',0.25);},
  pause:function(){tone(800,0.05,'square',0.15,0);tone(600,0.05,'square',0.15,0.05);},
  warn:function(){tone(1500,0.05,'square',0.12,0);}
};
A.sfx=function(name){
  var now=performance.now();
  A.log.push({name:name,time:now});if(A.log.length>20)A.log.shift();
  if(A.muted||!A.ctx||!SFX[name])return;
  if(name==='explode'){if(now-lastExplode<50)return;lastExplode=now;}
  try{SFX[name]();}catch(e){}
};
/* ---- BGM ---- */
var TRACKS={};
var SCALES=[[0,2,4,7,9],[0,2,4,7,9],[0,2,3,7,9],[0,2,4,7,9],[0,3,5,7,10],[0,1,5,7,8]];
var ROOTS=[57,55,50,52,45,48],STEPS=[0.3,0.27,0.28,0.26,0.27,0.3];
function build(id){
  var n=id==='title'?0:parseInt(id.slice(5),10);
  var r=(function(s){return function(){s=(s+0x6D2B79F5)>>>0;var t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})(n*977+13);
  var sc=SCALES[n],root=ROOTS[n],mel=[],motif=[],deg=2,i;
  for(i=0;i<8;i++){if(r()<0.22)motif.push(null);else{deg=Math.max(0,Math.min(9,deg+Math.floor(r()*5)-2));motif.push(deg);}}
  var alt=[];deg=3;for(i=0;i<8;i++){if(r()<0.22)alt.push(null);else{deg=Math.max(0,Math.min(9,deg+Math.floor(r()*5)-2));alt.push(deg);}}
  var order=[motif,motif,alt,motif];
  order.forEach(function(m){m.forEach(function(d){mel.push(d===null?null:root+12+sc[d%5]+(d>=5?12:0));});});
  var bass=[];
  for(i=0;i<32;i++){var bar=Math.floor(i/8);var rr=root-12+(bar%2?sc[2]:0);bass.push(i%4===0?rr:(i%4===2?rr+7:null));}
  return{mel:mel,bass:bass,dur:STEPS[n],wave:n%2?'square':'triangle'};
}
function sched(){
  var c=A.ctx;if(!c)return;
  if(A.bgm!==curTrack){curTrack=A.bgm;step=0;nextT=c.currentTime+0.05;}
  if(!curTrack||A.muted||A.paused)return;
  if(c.state!=='running')return;
  var tr=TRACKS[curTrack]||(TRACKS[curTrack]=build(curTrack));
  var dur=tr.dur*(A.fast&&curTrack!=='title'?0.8:1);
  if(nextT<c.currentTime-0.5)nextT=c.currentTime+0.05;
  while(nextT<c.currentTime+0.25){
    var i=step%32,off=nextT-c.currentTime;
    if(tr.mel[i]!==null&&tr.mel[i]!==undefined)tone(mtof(tr.mel[i]),dur*1.6,tr.wave,0.06,off,0,A.bgmG);
    if(tr.bass[i])tone(mtof(tr.bass[i]),dur*1.8,'triangle',0.09,off,0,A.bgmG);
    if(i%2===1)noise(0.04,0.03,off,6000,0,'highpass',A.bgmG);
    if(i%8===0)noise(0.08,0.05,off,300,0,'lowpass',A.bgmG);
    nextT+=dur;step++;
  }
}
window.GAudio=A;
})();
