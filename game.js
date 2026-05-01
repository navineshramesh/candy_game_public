'use strict';
/* ═══════════════════════════════════════════════════════════════════
   CANDY HEIST: KINGDOM OF UTKARSH  — Full Browser Game
   Controls: WASD/Arrows=Move | SPACE=Jump | J=Attack | K=Shoot
             L=Dash | E=Interact
   ═══════════════════════════════════════════════════════════════════ */

const BEAT_DROP = 32; // seconds into ironk.mp3 where beat drops

// ── CONFIG ──────────────────────────────────────────────────────────
const CFG = {
  W:1280, H:720,
  GR:1900, SPD:300, ACC:2200, DEC:1600,
  JMP:-680, DJMP:-550,
  DASHV:760, DASHT:0.17, DASHCD:1.0,
  COYOTE:0.1, JBUF:0.13, MFALL:940,
  HITPAUSE:0.06, SHAKE:true,
};

// ── MATH ─────────────────────────────────────────────────────────────
const M = {
  lerp:(a,b,t)=>a+(b-a)*t,
  clamp:(v,lo,hi)=>Math.max(lo,Math.min(hi,v)),
  eOut:t=>1-(1-t)*(1-t),
  eIO:t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2,
  rand:(a,b)=>Math.random()*(b-a)+a,
  ri:(a,b)=>Math.floor(Math.random()*(b-a+1))+a,
  dist:(a,b)=>Math.hypot(b.x-a.x,b.y-a.y),
  hit:(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y,
  rr(ctx,x,y,w,h,r=6){
    ctx.beginPath();
    ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
  },
};

function star(ctx,cx,cy,r1,r2,n){
  ctx.beginPath();
  for(let i=0;i<n*2;i++){
    const a=i*Math.PI/n-Math.PI/2, r=i%2===0?r1:r2;
    i===0?ctx.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a))
         :ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));
  }ctx.closePath();
}

// ── INPUT ─────────────────────────────────────────────────────────────
class Input {
  constructor(){
    this.d={};this.p={};this.r={};
    window.addEventListener('keydown',e=>{
      if(!this.d[e.code])this.p[e.code]=true;
      this.d[e.code]=true;
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))
        e.preventDefault();
    });
    window.addEventListener('keyup',e=>{this.d[e.code]=false;this.r[e.code]=true;});
  }
  flush(){this.p={};this.r={};}
  get left(){return this.d.ArrowLeft||this.d.KeyA;}
  get right(){return this.d.ArrowRight||this.d.KeyD;}
  get jumpTap(){return this.p.Space||this.p.ArrowUp||this.p.KeyW;}
  get jumpHold(){return this.d.Space||this.d.ArrowUp||this.d.KeyW;}
  get attackTap(){return this.p.KeyJ;}
  get shootTap(){return this.p.KeyK;}
  get dashTap(){return this.p.KeyL;}
  get interact(){return this.p.KeyE;}
  get forceNext(){return this.p.KeyN;}
}

// ── AUDIO ─────────────────────────────────────────────────────────────
class AudioMgr {
  constructor(){this.ctx=null;this.master=null;this.vol=0.7;this.bgEl=null;this._mTmr=null;this._mOn=false;}
  init(){
    try{
      this.ctx=new(window.AudioContext||window.webkitAudioContext)();
      this.master=this.ctx.createGain();
      this.master.gain.value=this.vol;
      this.master.connect(this.ctx.destination);
      this.bgEl=document.getElementById('bm');
      if(this.bgEl){
        const src=this.ctx.createMediaElementSource(this.bgEl);
        const g=this.ctx.createGain();g.gain.value=0.88;
        src.connect(g);g.connect(this.master);
      }
    }catch(e){console.warn('Audio init:',e);}
  }
  resume(){if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume();}
  setVol(v){this.vol=v;if(this.master)this.master.gain.value=v;}
  _o(f,type,dur,vol=0.22){
    if(!this.ctx)return;
    const o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type;o.frequency.value=f;
    g.gain.setValueAtTime(vol,this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+dur);
    o.connect(g);g.connect(this.master);o.start();o.stop(this.ctx.currentTime+dur);
  }
  _n(dur,vol=0.12,freq=600){
    if(!this.ctx)return;
    const buf=this.ctx.createBuffer(1,Math.ceil(this.ctx.sampleRate*dur),this.ctx.sampleRate);
    const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1);
    const s=this.ctx.createBufferSource();s.buffer=buf;
    const f=this.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=freq;
    const g=this.ctx.createGain();
    g.gain.setValueAtTime(vol,this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,this.ctx.currentTime+dur);
    s.connect(f);f.connect(g);g.connect(this.master);s.start();s.stop(this.ctx.currentTime+dur);
  }
  jump(){this._o(280,'sine',0.1,0.18);this._o(440,'sine',0.07,0.1);}
  land(){this._n(0.09,0.14,200);}
  attack(){this._n(0.07,0.22,1200);this._o(140,'sawtooth',0.05,0.1);}
  hurt(){this._o(110,'square',0.28,0.3);this._n(0.18,0.28,300);}
  shoot(){this._o(700,'sine',0.07,0.15);this._o(1100,'sine',0.05,0.08);}
  dash(){this._n(0.14,0.22,2000);this._o(550,'sawtooth',0.1,0.12);}
  hit(){this._n(0.11,0.28,500);this._o(180,'square',0.07,0.14);}
  coin(){this._o(840,'sine',0.09,0.2);this._o(1260,'sine',0.07,0.12);}
  roar(){this._o(55,'sawtooth',0.9,0.45);this._o(75,'square',0.7,0.3);this._n(0.9,0.45,90);}
  victory(){[523,659,784,1047].forEach((f,i)=>setTimeout(()=>this._o(f,'sine',0.45,0.3),i*130));}
  shockwave(){this._o(38,'sine',0.55,0.55);this._n(0.3,0.42,80);}
  buySound(){this._o(600,'sine',0.1,0.2);this._o(900,'sine',0.08,0.15);}
  menuTick(){this._o(440,'sine',0.05,0.1);}

  playBoss(){
    if(!this.bgEl)return;
    this.bgEl.currentTime=BEAT_DROP;
    this.bgEl.play().catch(()=>{});
  }
  stopBoss(){if(!this.bgEl)return;this.bgEl.pause();this.bgEl.currentTime=0;}

  startMenu(){
    if(!this.ctx||this._mOn)return;
    this._mOn=true;this.__menuLoop();
  }
  __menuLoop(){
    if(!this._mOn||!this.ctx)return;
    [130,195,260,310].forEach(f=>{
      const o=this.ctx.createOscillator(),g=this.ctx.createGain();
      o.type='sine';o.frequency.value=f;
      g.gain.setValueAtTime(0,this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.03,this.ctx.currentTime+1.2);
      g.gain.linearRampToValueAtTime(0,this.ctx.currentTime+4.5);
      o.connect(g);g.connect(this.master);o.start();o.stop(this.ctx.currentTime+4.8);
    });
    this._mTmr=setTimeout(()=>this.__menuLoop(),4200);
  }
  stopMenu(){this._mOn=false;clearTimeout(this._mTmr);}
}

// ── PARTICLES ─────────────────────────────────────────────────────────
class Particle {
  constructor(x,y,o){
    this.x=x;this.y=y;
    this.vx=o.vx||0;this.vy=o.vy||0;
    this.life=o.life||1;this.ml=this.life;
    this.sz=o.sz||4;this.sz2=o.sz2!==undefined?o.sz2:0;
    this.col=o.col||'#fff';this.type=o.type||'circle';
    this.gr=o.gr!==undefined?o.gr:300;this.fr=o.fr||0.97;
    this.rot=o.rot||0;this.rs=o.rs||0;this.glow=o.glow||false;
  }
  get al(){return M.clamp(this.life/this.ml,0,1);}
  get tp(){return M.clamp(1-this.life/this.ml,0,1);}
  update(dt){
    this.vy+=this.gr*dt;this.vx*=this.fr;this.vy*=this.fr;
    this.x+=this.vx*dt;this.y+=this.vy*dt;
    this.rot+=this.rs*dt;this.life-=dt;return this.life>0;
  }
  draw(ctx){
    const s=M.lerp(this.sz,this.sz2,this.tp);if(s<=0)return;
    ctx.save();ctx.globalAlpha=this.al;
    ctx.translate(this.x,this.y);ctx.rotate(this.rot);
    if(this.glow){ctx.shadowColor=this.col;ctx.shadowBlur=s*2.5;}
    ctx.fillStyle=this.col;ctx.strokeStyle=this.col;
    if(this.type==='rect'){ctx.fillRect(-s*.5,-s*.75,s,s*1.5);}
    else if(this.type==='candy'){
      ctx.beginPath();ctx.ellipse(0,0,s*.5,s,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillRect(-s*.5,-s*.5,s*.35,s);
    }
    else if(this.type==='star'){star(ctx,0,0,s,s*.4,5);ctx.fill();}
    else if(this.type==='ring'){
      ctx.beginPath();ctx.arc(0,0,s,0,Math.PI*2);ctx.lineWidth=2.5;ctx.stroke();
    }
    else{ctx.beginPath();ctx.arc(0,0,s,0,Math.PI*2);ctx.fill();}
    ctx.shadowBlur=0;ctx.restore();
  }
}

class Particles {
  constructor(){this.list=[];}
  _add(x,y,n,o){
    for(let i=0;i<n;i++){
      const ang=o.ang!==undefined?o.ang+(Math.random()-.5)*(o.spread||Math.PI*2):Math.random()*Math.PI*2;
      const spd=M.rand(o.smin||50,o.smax||200);
      this.list.push(new Particle(x,y,{...o,
        vx:Math.cos(ang)*spd+(o.bvx||0),
        vy:Math.sin(ang)*spd+(o.bvy||0),
        sz:M.rand(o.sz*.7||2,o.sz*1.3||6),
      }));
    }
  }
  hit(x,y,col='#FFD700'){
    this._add(x,y,10,{type:'circle',col,sz:4,sz2:0,smin:80,smax:260,
      life:.35,gr:500,fr:.93,ang:-Math.PI/2,spread:Math.PI*.9,glow:true});
    this._add(x,y,4,{type:'star',col:'#fff',sz:3,sz2:0,smin:50,smax:130,life:.2,gr:200,glow:true});
  }
  candy(x,y,n=8){
    const cols=['#FF6B6B','#FFE66D','#4ECDC4','#A8E6CF','#FF8B94','#C77DFF','#FF9F43','#48dbfb'];
    for(let i=0;i<n;i++)
      this.list.push(new Particle(x,y,{
        type:'candy',col:cols[M.ri(0,7)],sz:M.rand(4,9),sz2:M.rand(1,4),
        vx:M.rand(-200,200),vy:M.rand(-360,-50),
        life:M.rand(.8,1.6),gr:500,fr:.97,rot:Math.random()*Math.PI*2,rs:M.rand(-6,6),
      }));
  }
  dash(x,y,right){
    for(let i=0;i<5;i++)
      this.list.push(new Particle(x+M.rand(-4,4),y+M.rand(-8,8),{
        col:`hsl(${M.rand(180,230)},100%,70%)`,sz:M.rand(3,7),sz2:0,
        vx:right?M.rand(-110,-40):M.rand(40,110),vy:M.rand(-40,40),
        life:.22,gr:0,fr:.92,glow:true,
      }));
  }
  land(x,y){
    this._add(x,y,8,{col:'rgba(200,180,150,.8)',sz:4,sz2:0,smin:20,smax:90,
      ang:-Math.PI/2,spread:Math.PI*.7,life:.45,gr:-50,fr:.93});
  }
  explosion(x,y,sc=1){
    const cols=['#FF6B6B','#FFE66D','#FF9F43','#FF6CAB','#A29BFE','#74B9FF','#fff'];
    for(let i=0;i<28*sc;i++)
      this._add(x,y,1,{
        type:Math.random()<.4?'candy':'circle',
        col:cols[M.ri(0,6)],sz:M.rand(3,10)*sc,sz2:0,
        smin:80,smax:360*sc,life:M.rand(.5,1.4),gr:250,fr:.95,glow:true,
      });
    this.list.push(new Particle(x,y,{type:'ring',col:'rgba(255,255,255,.85)',
      sz:10,sz2:110*sc,vx:0,vy:0,life:.4,gr:0,fr:1}));
  }
  shockwave(x,y,col='#88ff88'){
    for(let r=0;r<3;r++)
      this.list.push(new Particle(x,y,{type:'ring',col,sz:5+r*4,sz2:90+r*24,
        vx:0,vy:0,life:.55,gr:0,fr:1}));
    this._add(x,y,14,{col,sz:5,sz2:0,smin:50,smax:200,life:.6,gr:0,fr:.96,glow:true});
  }
  update(dt){this.list=this.list.filter(p=>p.update(dt));}
  draw(ctx){this.list.forEach(p=>p.draw(ctx));}
  clear(){this.list=[];}
}

// ── CAMERA ───────────────────────────────────────────────────────────
class Camera {
  constructor(){this.x=0;this.y=0;this.sx=0;this.sy=0;this.sm=0;this.sd=0;this.st=0;this.bw=99999;}
  follow(tx,ty,dt){
    const s=1-Math.pow(0.001,dt);
    this.x=M.lerp(this.x,tx-CFG.W/2,s);
    this.y=M.lerp(this.y,ty-CFG.H*.45,s);
    this.x=M.clamp(this.x,0,Math.max(0,this.bw-CFG.W));
    this.y=M.clamp(this.y,0,200);
    this.tx = tx; this.ty = ty; // Store target for debug
  }
  snap(x,y){this.x=x;this.y=y;}
  shake(mag,dur){if(!CFG.SHAKE)return;this.sm=Math.max(this.sm,mag);this.sd=dur;this.st=dur;}
  update(dt){
    if(this.st>0){this.st-=dt;const t=this.st/this.sd;this.sx=M.rand(-this.sm*t,this.sm*t);this.sy=M.rand(-this.sm*t,this.sm*t);}
    else{this.sx=0;this.sy=0;}
  }
  apply(ctx){ctx.save();ctx.translate(Math.round(-this.x+this.sx),Math.round(-this.y+this.sy));}
  restore(ctx){ctx.restore();}
}

// ── CHARACTER DRAWING ─────────────────────────────────────────────────
const DRAW = {
  player(ctx,x,y,facing,state,af,t,dashing){
    ctx.save();ctx.translate(~~x,~~y);if(facing<0)ctx.scale(-1,1);
    const bob=state==='idle'?Math.sin(t*3)*1.8:0;
    const blink=Math.floor(t)%5===0&&(t%1)>.85?0:1;
    // shadow
    ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(0,23+bob,13,3.5,0,0,Math.PI*2);ctx.fill();
    // cape
    const csw=state==='run'?Math.sin(af*Math.PI*2)*5:dashing?-20:Math.sin(t*2)*3;
    ctx.fillStyle='#0e1e35';ctx.beginPath();
    if(dashing){ctx.moveTo(-6,-6+bob);ctx.lineTo(-34,-4+bob);ctx.lineTo(-30,12+bob);ctx.lineTo(6,12+bob);}
    else{ctx.moveTo(-4,-5+bob);ctx.quadraticCurveTo(-18,8+bob,-14+csw,22+bob);ctx.lineTo(-7,22+bob);
      ctx.lineTo(-3,12+bob);ctx.lineTo(3,12+bob);ctx.lineTo(7,22+bob);ctx.lineTo(14,22+bob);
      ctx.quadraticCurveTo(17+csw,8+bob,4,-5+bob);}
    ctx.closePath();ctx.fill();ctx.strokeStyle='#1a3a5c';ctx.lineWidth=1;ctx.stroke();
    // body
    ctx.fillStyle='#122030';ctx.beginPath();ctx.ellipse(0,1+bob,7.5,11,0,0,Math.PI*2);ctx.fill();
    // arms
    ctx.strokeStyle='#0e1e35';ctx.lineWidth=4;ctx.lineCap='round';
    if(state==='attack'){
      const ang=M.lerp(-1.2,1.2,af);
      ctx.save();ctx.translate(5,0+bob);ctx.rotate(ang);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,14);ctx.stroke();ctx.restore();
      ctx.beginPath();ctx.moveTo(-6,0+bob);ctx.lineTo(-10,10+bob);ctx.stroke();
    }else{
      const aw=state==='run'?Math.sin(af*Math.PI*2)*6:0;
      ctx.beginPath();ctx.moveTo(6,0+bob);ctx.lineTo(10+aw,8+bob);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-6,0+bob);ctx.lineTo(-10-aw,8+bob);ctx.stroke();
    }
    // legs
    ctx.strokeStyle='#0c1828';ctx.lineWidth=5;
    if(state==='run'){const lf=Math.sin(af*Math.PI*2)*8;
      ctx.beginPath();ctx.moveTo(-3,10+bob);ctx.lineTo(-5+lf,20+bob);ctx.stroke();
      ctx.beginPath();ctx.moveTo(3,10+bob);ctx.lineTo(5-lf,20+bob);ctx.stroke();
    }else if(state==='jump'||state==='fall'){
      ctx.beginPath();ctx.moveTo(-3,10+bob);ctx.lineTo(-9,17+bob);ctx.stroke();
      ctx.beginPath();ctx.moveTo(3,10+bob);ctx.lineTo(9,17+bob);ctx.stroke();
    }else{
      ctx.beginPath();ctx.moveTo(-3,10+bob);ctx.lineTo(-4,20+bob);ctx.stroke();
      ctx.beginPath();ctx.moveTo(3,10+bob);ctx.lineTo(4,20+bob);ctx.stroke();
    }
    // hood
    ctx.fillStyle='#0e1e35';ctx.beginPath();ctx.ellipse(0,-14+bob,9,7.5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#142840';ctx.beginPath();
    ctx.moveTo(-9,-14+bob);ctx.lineTo(-11,-7+bob);ctx.lineTo(11,-7+bob);ctx.lineTo(9,-14+bob);
    ctx.quadraticCurveTo(5,-22+bob,0,-28+bob);ctx.quadraticCurveTo(-5,-22+bob,-9,-14+bob);
    ctx.closePath();ctx.fill();ctx.strokeStyle='#1e4060';ctx.lineWidth=1;ctx.stroke();
    // horns
    ctx.fillStyle='#1e4060';
    ctx.beginPath();ctx.moveTo(-5,-22+bob);ctx.lineTo(-7,-28+bob);ctx.lineTo(-3,-24+bob);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(5,-22+bob);ctx.lineTo(7,-28+bob);ctx.lineTo(3,-24+bob);ctx.closePath();ctx.fill();
    // face
    ctx.fillStyle='#071014';ctx.beginPath();ctx.ellipse(0,-14+bob,5.5,4.5,0,0,Math.PI*2);ctx.fill();
    // eyes
    if(!dashing){
      ctx.shadowColor='#00ffff';ctx.shadowBlur=8;ctx.fillStyle='#00ffff';
      ctx.beginPath();ctx.ellipse(-2.5,-14.5+bob,2,blink*1.5,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(2.5,-14.5+bob,2,blink*1.5,0,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;
    }else{
      for(let i=0;i<3;i++){ctx.globalAlpha=.3-i*.08;ctx.fillStyle='#00ffff';
        ctx.beginPath();ctx.ellipse(-2.5+i*7,-14.5,2,1.5,0,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=1;
    }
    // nail
    if(state==='attack'){
      const ang=M.lerp(-2.2,1.0,af);
      ctx.save();ctx.translate(4,-4+bob);ctx.rotate(ang);
      ctx.shadowColor='#00ccff';ctx.shadowBlur=10;
      ctx.strokeStyle='rgba(0,200,255,.2)';ctx.lineWidth=14;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-22);ctx.stroke();
      ctx.strokeStyle='#cceeff';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-22);ctx.stroke();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(-2,-22);ctx.lineTo(2,-22);ctx.lineTo(0,-28);ctx.closePath();ctx.fill();
      ctx.shadowBlur=0;ctx.restore();
    }else{
      ctx.save();ctx.translate(10,2+bob);ctx.rotate(.4);
      ctx.shadowColor='#88ccff';ctx.shadowBlur=5;ctx.fillStyle='#5588bb';ctx.fillRect(-4,-1,8,3);
      ctx.strokeStyle='#aaddff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,2);ctx.lineTo(0,18);ctx.stroke();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(-2,18);ctx.lineTo(2,18);ctx.lineTo(0,24);ctx.closePath();ctx.fill();
      ctx.shadowBlur=0;ctx.restore();
    }
    ctx.restore();
  },

  usman(ctx,x,y,facing,phase,af,t){
    ctx.save();ctx.translate(~~x,~~y);if(facing<0)ctx.scale(-1,1);
    const bob=Math.sin(t*3.5)*2,rage=phase>=2;
    ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(0,46,28,6,0,0,Math.PI*2);ctx.fill();
    // legs
    const lf=Math.sin(af*Math.PI*2)*8;
    [-12,12].forEach((lx,i)=>{
      ctx.save();ctx.translate(lx,25+bob);ctx.rotate((i===0?lf:-lf)*.05);
      ctx.fillStyle=rage?'#aa1800':'#8B1a1a';ctx.fillRect(-6,0,12,22);
      ctx.fillStyle='#3d1500';ctx.fillRect(-7,18,14,8);ctx.restore();
    });
    // body
    ctx.fillStyle=rage?'#cc2200':'#A52020';
    ctx.beginPath();ctx.moveTo(-18,-5+bob);ctx.lineTo(-20,25+bob);ctx.lineTo(20,25+bob);ctx.lineTo(18,-5+bob);
    ctx.quadraticCurveTo(0,-8+bob,0,-8+bob);ctx.closePath();ctx.fill();
    ctx.fillStyle='#ff8800';ctx.beginPath();ctx.moveTo(-6,-5+bob);ctx.lineTo(0,6+bob);ctx.lineTo(6,-5+bob);ctx.closePath();ctx.fill();
    ctx.fillStyle='#3d1500';ctx.fillRect(-18,22+bob,36,5);
    // arms
    [[-22,1],[22,-1]].forEach(([px,s],si)=>{
      const aw=Math.sin(af*Math.PI*2+si*Math.PI)*8;
      ctx.save();ctx.translate(px,0+bob);ctx.rotate(s*.2+aw*.05);
      ctx.fillStyle=rage?'#cc4400':'#cc4422';ctx.fillRect(-6,0,12,18);
      ctx.save();ctx.translate(0,18);ctx.rotate(s*.3);
      ctx.fillRect(-5,0,10,16);
      ctx.fillStyle='#8B2010';ctx.beginPath();ctx.ellipse(0,16,8,7,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.2)';[-4,-1,2,5].forEach(kx=>{ctx.beginPath();ctx.arc(kx,11,2,0,Math.PI*2);ctx.fill();});
      if(rage)[0,-2,3].forEach((ox,i2)=>{
        ctx.fillStyle=`hsla(${20+i2*20},100%,${50+i2*10}%,.7)`;ctx.beginPath();
        const fy=-8-Math.abs(Math.sin(t*4+i2))*8;
        ctx.moveTo(ox-3,14);ctx.quadraticCurveTo(ox,fy,ox+3,14);ctx.fill();
      });
      ctx.restore();ctx.restore();
    });
    // pauldrons
    [-22,22].forEach((px,i)=>{
      ctx.fillStyle='#6B0000';ctx.beginPath();ctx.ellipse(px,-4+bob,10,7,i===0?-.3:.3,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#cc2200';ctx.beginPath();ctx.ellipse(px,-4+bob,6,4,i===0?-.3:.3,0,Math.PI*2);ctx.fill();
    });
    // head
    ctx.fillStyle='#c04020';ctx.fillRect(-6,-14+bob,12,10);
    ctx.beginPath();ctx.ellipse(0,-22+bob,15,14,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#a03018';ctx.beginPath();ctx.moveTo(-14,-22+bob);ctx.lineTo(-12,-12+bob);ctx.lineTo(12,-12+bob);ctx.lineTo(14,-22+bob);ctx.closePath();ctx.fill();
    // spiky hair
    ctx.fillStyle=rage?'#ff4400':'#cc2200';
    for(let s=0;s<7;s++){const hh=12+Math.abs(Math.sin(s*1.3))*8+(rage?5:0);
      ctx.beginPath();ctx.moveTo(-18+s*6,-28+bob);ctx.lineTo(-18+s*6+3,-28-hh+bob);ctx.lineTo(-18+s*6+6,-28+bob);ctx.closePath();ctx.fill();}
    ctx.fillStyle='#aa1800';ctx.beginPath();ctx.ellipse(0,-28+bob,16,4,0,0,Math.PI);ctx.fill();
    // eyes
    ctx.fillStyle='#ffdd00';ctx.shadowColor=rage?'#ff8800':'#ffdd00';ctx.shadowBlur=6;
    [-6,6].forEach((ex,i)=>{
      ctx.save();ctx.translate(ex,-23+bob);ctx.fillStyle='#ffdd00';
      ctx.beginPath();ctx.ellipse(0,0,5,2.5,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#000';ctx.beginPath();ctx.arc(i===0?1:-1,0,2,0,Math.PI*2);ctx.fill();ctx.restore();
    });
    ctx.shadowBlur=0;
    ctx.strokeStyle='#3d0000';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-12,-27+bob);ctx.lineTo(-2,-25+bob);ctx.stroke();
    ctx.beginPath();ctx.moveTo(12,-27+bob);ctx.lineTo(2,-25+bob);ctx.stroke();
    ctx.strokeStyle='rgba(255,100,50,.6)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(4,-26+bob);ctx.lineTo(8,-20+bob);ctx.stroke();
    ctx.strokeStyle='#2d0800';ctx.lineWidth=2;
    if(rage){ctx.beginPath();ctx.arc(0,-17+bob,5,.2,Math.PI-.2);ctx.stroke();ctx.fillStyle='#1a0000';ctx.fill();}
    else{ctx.beginPath();ctx.moveTo(-5,-17+bob);ctx.lineTo(5,-17+bob);ctx.stroke();}
    if(rage){ctx.shadowColor='#ff4400';ctx.shadowBlur=20;ctx.strokeStyle='rgba(255,68,0,.1)';ctx.lineWidth=22;ctx.beginPath();ctx.arc(0,0,44,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;}
    ctx.restore();
  },

  suhaib(ctx,x,y,facing,phase,af,t){
    ctx.save();ctx.translate(~~x,~~y);if(facing<0)ctx.scale(-1,1);
    const bob=Math.sin(t*2)*3,glow=Math.abs(Math.sin(t*2))*.4+.6;
    ctx.fillStyle='rgba(0,0,0,.1)';ctx.beginPath();ctx.ellipse(0,44,20,4,0,0,Math.PI*2);ctx.fill();
    // robe
    ctx.fillStyle='#0a0a4a';ctx.beginPath();
    ctx.moveTo(-22,5+bob);ctx.quadraticCurveTo(-26,30+bob,-18,44+bob);ctx.lineTo(18,44+bob);
    ctx.quadraticCurveTo(26,30+bob,22,5+bob);ctx.closePath();ctx.fill();
    ctx.fillStyle='#14145e';ctx.beginPath();
    ctx.moveTo(-16,5+bob);ctx.quadraticCurveTo(-18,28+bob,-12,44+bob);ctx.lineTo(12,44+bob);
    ctx.quadraticCurveTo(18,28+bob,16,5+bob);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#8899bb';ctx.lineWidth=1.5;
    [[-20,8,-15,44],[-10,6,-8,44],[10,6,8,44],[20,8,15,44]].forEach(([ax,ay,bx,by])=>{
      ctx.beginPath();ctx.moveTo(ax,ay+bob);ctx.lineTo(bx,by+bob);ctx.stroke();
    });
    ctx.fillStyle='rgba(150,180,255,.3)';
    [[0,15],[-10,25],[10,25],[-5,35],[5,35]].forEach(([sx,sy])=>{star(ctx,sx,sy+bob,3,1.5,5);ctx.fill();});
    // chest
    ctx.fillStyle='#0f0f5a';ctx.beginPath();ctx.ellipse(0,0+bob,12,15,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#8899bb';ctx.beginPath();ctx.moveTo(-8,-6+bob);ctx.lineTo(0,2+bob);ctx.lineTo(8,-6+bob);ctx.lineTo(6,-14+bob);ctx.lineTo(-6,-14+bob);ctx.closePath();ctx.fill();
    // arms
    ctx.strokeStyle='#0f0f5a';ctx.lineWidth=8;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-12,0+bob);ctx.lineTo(-16,20+bob);ctx.stroke();
    ctx.fillStyle='#8866aa';ctx.beginPath();ctx.ellipse(-16,22+bob,6,5,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.moveTo(12,0+bob);ctx.lineTo(22,12+bob);ctx.stroke();
    ctx.fillStyle='#8866aa';ctx.beginPath();ctx.ellipse(22,14+bob,6,5,0,0,Math.PI*2);ctx.fill();
    if(phase>=2){ctx.strokeStyle=`rgba(150,100,255,${glow})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(22,14+bob,10,0,Math.PI*2);ctx.stroke();}
    // staff
    ctx.strokeStyle='#6644aa';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-16,22+bob);ctx.lineTo(-24,-28+bob);ctx.stroke();
    ctx.strokeStyle='#8866cc';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-15,22+bob);ctx.lineTo(-23,-28+bob);ctx.stroke();
    ctx.shadowColor='#aaaaff';ctx.shadowBlur=15*glow;
    ctx.fillStyle=`rgba(100,100,255,${glow})`;ctx.beginPath();ctx.arc(-24,-32+bob,8,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(200,200,255,.8)';ctx.beginPath();ctx.arc(-26,-34+bob,3,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    [0,120,240].forEach((ang,i)=>{
      const oa=(ang+t*80)*Math.PI/180,ox=Math.cos(oa)*18,oy=Math.sin(oa)*8;
      ctx.fillStyle=`hsl(${200+i*40},100%,${60+i*10}%)`;ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=6;
      ctx.beginPath();ctx.arc(-24+ox,-32+bob+oy,3.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    });
    // hair
    ctx.fillStyle='#1a0a3a';
    ctx.beginPath();ctx.moveTo(-12,-20+bob);ctx.quadraticCurveTo(-20,-10+bob,-18,10+bob);ctx.quadraticCurveTo(-14,6+bob,-10,-14+bob);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(8,-20+bob);ctx.quadraticCurveTo(14,-5+bob,10,10+bob);ctx.quadraticCurveTo(6,4+bob,6,-14+bob);ctx.closePath();ctx.fill();
    // head
    ctx.fillStyle='#9980b0';ctx.beginPath();ctx.ellipse(0,-22+bob,11,12,0,0,Math.PI*2);ctx.fill();
    // hat
    ctx.fillStyle='#0a0a4a';ctx.beginPath();ctx.moveTo(-14,-27+bob);ctx.lineTo(-12,-32+bob);ctx.lineTo(-2,-52+bob);ctx.lineTo(2,-52+bob);ctx.lineTo(12,-32+bob);ctx.lineTo(14,-27+bob);ctx.closePath();ctx.fill();
    ctx.fillStyle='#14145e';ctx.beginPath();ctx.ellipse(0,-27+bob,16,5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(200,200,255,.8)';star(ctx,0,-38+bob,5,2.5,5);ctx.fill();
    // eyes
    ctx.fillStyle='#fff';ctx.shadowColor='#aaaaff';ctx.shadowBlur=8;
    [-4,4].forEach(ex=>{
      ctx.beginPath();ctx.ellipse(ex,-23+bob,3.5,4,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#4488ff';ctx.beginPath();ctx.arc(ex,-23+bob,2,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#000';ctx.beginPath();ctx.arc(ex,-23+bob,1,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff';
    });
    ctx.shadowBlur=0;ctx.strokeStyle='#7755aa';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,-19+bob,4,.3,Math.PI-.3);ctx.stroke();
    ctx.restore();
  },

  noah(ctx,x,y,facing,phase,af,t){
    ctx.save();ctx.translate(~~x,~~y);if(facing<0)ctx.scale(-1,1);
    const bob=Math.sin(t*1.5)*1,berserk=phase>=2;
    ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(0,52,36,7,0,0,Math.PI*2);ctx.fill();
    // shield
    ctx.fillStyle='#2d5a1b';ctx.beginPath();
    ctx.moveTo(-50,-20+bob);ctx.lineTo(-52,0+bob);ctx.lineTo(-48,30+bob);ctx.lineTo(-30,48+bob);ctx.lineTo(-22,40+bob);ctx.lineTo(-22,-20+bob);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#daa520';ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle='#daa520';ctx.fillRect(-41,5+bob,18,4);ctx.fillRect(-34,-2+bob,4,18);
    // body
    ctx.fillStyle='#2d4a20';ctx.beginPath();ctx.moveTo(-20,-20+bob);ctx.lineTo(-24,28+bob);ctx.lineTo(24,28+bob);ctx.lineTo(20,-20+bob);ctx.closePath();ctx.fill();
    ctx.fillStyle='#3d6030';ctx.beginPath();ctx.ellipse(0,-5+bob,16,18,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#daa520';[[-8,-10],[8,-10],[0,-2],[-8,6],[8,6]].forEach(([rx,ry])=>{ctx.beginPath();ctx.arc(rx,ry+bob,2.5,0,Math.PI*2);ctx.fill();});
    if(berserk){ctx.strokeStyle='rgba(255,50,50,.4)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-5,-18+bob);ctx.lineTo(8,-8+bob);ctx.stroke();ctx.beginPath();ctx.moveTo(-10,-5+bob);ctx.lineTo(5,8+bob);ctx.stroke();}
    ctx.fillStyle='#2d4a20';ctx.fillRect(-22,22+bob,44,8);
    // legs
    [-14,14].forEach((lx,i)=>{
      const ls=Math.sin(af*Math.PI*2+(i===0?0:Math.PI))*5;
      ctx.save();ctx.translate(lx,26+bob);ctx.rotate(ls*.04);
      ctx.fillStyle='#2d4a20';ctx.fillRect(-8,0,16,20);
      ctx.fillStyle='#3d6030';ctx.fillRect(-9,2,18,10);
      ctx.fillStyle='#2d2010';ctx.fillRect(-9,18,18,8);ctx.restore();
    });
    // arms
    ctx.strokeStyle='#2d4a20';ctx.lineWidth=14;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-20,-8+bob);ctx.lineTo(-34,20+bob);ctx.stroke();
    ctx.save();ctx.translate(24,-4+bob);ctx.rotate(Math.sin(af*Math.PI*2)*.15);
    ctx.strokeStyle='#2d4a20';ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(10,22);ctx.stroke();
    ctx.save();ctx.translate(10,22);
    ctx.strokeStyle='#6b4010';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,28);ctx.stroke();
    ctx.fillStyle='#888';ctx.beginPath();ctx.moveTo(-14,-2);ctx.lineTo(14,-2);ctx.lineTo(16,14);ctx.lineTo(-16,14);ctx.closePath();ctx.fill();
    ctx.fillStyle='#aaa';ctx.fillRect(-12,0,24,6);ctx.fillStyle='#daa520';ctx.fillRect(-14,4,28,3);
    ctx.restore();ctx.restore();
    // pauldrons
    [-22,22].forEach((px,i)=>{
      ctx.fillStyle='#2d5a1b';ctx.beginPath();ctx.ellipse(px,-14+bob,14,10,i===0?-.4:.4,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#daa520';ctx.lineWidth=2;ctx.stroke();
    });
    // helmet
    ctx.fillStyle='#556b3a';ctx.fillRect(-7,-24+bob,14,8);
    ctx.fillStyle='#2d5a1b';ctx.beginPath();
    ctx.moveTo(-16,-30+bob);ctx.lineTo(-16,-24+bob);ctx.quadraticCurveTo(-16,-50+bob,0,-54+bob);ctx.quadraticCurveTo(16,-50+bob,16,-24+bob);ctx.lineTo(16,-30+bob);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#daa520';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#daa520';ctx.beginPath();ctx.moveTo(-3,-54+bob);ctx.lineTo(0,-62+bob);ctx.lineTo(3,-54+bob);ctx.closePath();ctx.fill();
    ctx.fillStyle='#1a3a10';ctx.fillRect(-12,-38+bob,24,16);
    ctx.strokeStyle=berserk?'rgba(255,80,0,.9)':'rgba(100,255,80,.8)';ctx.lineWidth=2;ctx.shadowColor=berserk?'#ff4400':'#66ff44';ctx.shadowBlur=6;
    ctx.beginPath();ctx.moveTo(-9,-32+bob);ctx.lineTo(9,-32+bob);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-8,-28+bob);ctx.lineTo(8,-28+bob);ctx.stroke();
    ctx.shadowBlur=0;
    ctx.restore();
  },

  utkarsh(ctx,x,y,facing,phase,af,t){
    ctx.save();ctx.translate(~~x,~~y);if(facing<0)ctx.scale(-1,1);
    const bob=Math.sin(t*1.8)*3,enraged=phase>=2,desp=phase>=3;
    // aura
    const ar=72+Math.sin(t*3)*8+(enraged?22:0);
    const ag=ctx.createRadialGradient(0,0,ar*.5,0,0,ar);
    ag.addColorStop(0,'rgba(0,0,0,0)');ag.addColorStop(.7,`hsla(${t*60%360},100%,50%,${enraged?.14:.07})`);ag.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=ag;ctx.beginPath();ctx.arc(0,0,ar,0,Math.PI*2);ctx.fill();
    // cape
    ctx.fillStyle='#4b0082';
    ctx.beginPath();ctx.moveTo(-28,10+bob);ctx.quadraticCurveTo(-60+Math.sin(t*2)*6,0+bob,-55+Math.sin(t*2)*4,60+bob);ctx.lineTo(-30,70+bob);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(28,10+bob);ctx.quadraticCurveTo(60-Math.sin(t*2)*6,0+bob,55-Math.sin(t*2)*4,60+bob);ctx.lineTo(30,70+bob);ctx.closePath();ctx.fill();
    // robe
    const rg=ctx.createLinearGradient(-50,0,50,60);rg.addColorStop(0,'#3d0080');rg.addColorStop(.5,'#5500aa');rg.addColorStop(1,'#2d005a');
    ctx.fillStyle=rg;ctx.beginPath();
    ctx.moveTo(-30,10+bob);ctx.quadraticCurveTo(-55,35+bob,-50,65+bob);ctx.quadraticCurveTo(-30,72+bob,0,74+bob);ctx.quadraticCurveTo(30,72+bob,50,65+bob);ctx.quadraticCurveTo(55,35+bob,30,10+bob);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#ffd700';ctx.lineWidth=2.5;ctx.stroke();
    const rcols=['#ff6b6b','#ffe66d','#4ecdc4','#ff8b94','#c77dff','#48dbfb'];
    [[-20,30,0],[-10,50,1],[10,45,2],[20,30,3],[-5,60,4],[5,55,5]].forEach(([rx,ry,ci])=>{
      ctx.fillStyle=rcols[ci];ctx.beginPath();ctx.ellipse(rx,ry+bob,4,6,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.4)';ctx.fillRect(rx-4,ry-8+bob,3,5);
    });
    // body core
    const bg2=ctx.createLinearGradient(-25,-10,25,30);bg2.addColorStop(0,'#6600cc');bg2.addColorStop(1,'#3d0080');
    ctx.fillStyle=bg2;ctx.beginPath();ctx.ellipse(0,0+bob,24,30,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#ffd700';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#ffd700';ctx.shadowColor='#ffd700';ctx.shadowBlur=8;star(ctx,0,2+bob,14,7,5);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#ff1493';ctx.shadowColor='#ff1493';ctx.shadowBlur=6;star(ctx,0,2+bob,7,3.5,5);ctx.fill();ctx.shadowBlur=0;
    // left arm
    ctx.strokeStyle='#5500aa';ctx.lineWidth=18;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-26,-4+bob);ctx.lineTo(-44,22+bob);ctx.stroke();
    ctx.fillStyle='#6a28aa';ctx.beginPath();ctx.ellipse(-44,26+bob,11,9,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#6a28aa';ctx.lineWidth=5;
    ctx.beginPath();ctx.moveTo(-50,22+bob);ctx.lineTo(-58,16+bob);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-44,32+bob);ctx.lineTo(-48,42+bob);ctx.stroke();
    // right arm + scepter
    const aw2=Math.sin(t*2)*.3;
    ctx.save();ctx.translate(26,-4+bob);ctx.rotate(-aw2);
    ctx.strokeStyle='#5500aa';ctx.lineWidth=18;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(16,26);ctx.stroke();
    ctx.fillStyle='#6a28aa';ctx.beginPath();ctx.ellipse(16,30,11,9,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(16,30);
    ctx.strokeStyle='#8844cc';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(8,-50);ctx.stroke();
    ctx.strokeStyle='#ffd700';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(8,-50);ctx.stroke();
    ctx.save();ctx.translate(8,-50);
    ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-8);ctx.stroke();
    const lpg=ctx.createRadialGradient(0,-20,4,0,-20,20);
    lpg.addColorStop(0,'#ff1493');lpg.addColorStop(.4,'#ff6b6b');lpg.addColorStop(.7,'#ffcc00');lpg.addColorStop(1,'#ff1493');
    ctx.fillStyle=lpg;ctx.shadowColor='#ff1493';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(0,-20,20,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.restore();ctx.restore();ctx.restore();
    // pauldrons
    [-28,28].forEach((px,i)=>{
      ctx.fillStyle='#4b0082';ctx.beginPath();ctx.ellipse(px,-12+bob,16,11,i===0?-.4:.4,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#ffd700';ctx.lineWidth=2;ctx.stroke();
      const gc2=['#ff6b6b','#4ecdc4'][i];ctx.fillStyle=gc2;ctx.shadowColor=gc2;ctx.shadowBlur=6;
      ctx.beginPath();ctx.arc(px,-12+bob,5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    });
    // neck
    ctx.fillStyle='#5500aa';ctx.fillRect(-10,-36+bob,20,10);
    // head
    const hg=ctx.createRadialGradient(-4,-52+bob,5,0,-50+bob,20);hg.addColorStop(0,'#8844cc');hg.addColorStop(1,'#4b0082');
    ctx.fillStyle=hg;ctx.beginPath();ctx.ellipse(0,-50+bob,20,18,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffd700';ctx.lineWidth=1.5;ctx.stroke();
    // crown base
    ctx.fillStyle='#ffd700';ctx.beginPath();ctx.moveTo(-32,-62+bob);ctx.lineTo(-32,-68+bob);ctx.lineTo(32,-68+bob);ctx.lineTo(32,-62+bob);ctx.closePath();ctx.fill();ctx.strokeStyle='#ffaa00';ctx.lineWidth=2;ctx.stroke();
    // crown spikes
    const cpts=[{x:-28,h:22,col:'#ff6b6b',tp:'lollipop'},{x:-18,h:16,col:'#ffe66d',tp:'star'},{x:-8,h:28,col:'#4ecdc4',tp:'point'},{x:0,h:34,col:'#c77dff',tp:'gem'},{x:8,h:28,col:'#ff8b94',tp:'point'},{x:18,h:16,col:'#48dbfb',tp:'star'},{x:28,h:22,col:'#ffd700',tp:'lollipop'}];
    cpts.forEach(({x:cx2,h,col,tp})=>{
      ctx.fillStyle=col;ctx.shadowColor=col;ctx.shadowBlur=8;
      if(tp==='lollipop'){ctx.strokeStyle=col;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx2,-68+bob);ctx.lineTo(cx2,-68-h+5+bob);ctx.stroke();ctx.beginPath();ctx.arc(cx2,-68-h+bob,6,0,Math.PI*2);ctx.fill();}
      else if(tp==='star'){star(ctx,cx2,-68-h/2+bob,9,5,5);ctx.fill();}
      else if(tp==='point'){ctx.beginPath();ctx.moveTo(cx2-6,-68+bob);ctx.lineTo(cx2,-68-h+bob);ctx.lineTo(cx2+6,-68+bob);ctx.closePath();ctx.fill();}
      else{ctx.beginPath();ctx.moveTo(cx2,-68+bob);ctx.lineTo(cx2-8,-68-h*.4+bob);ctx.lineTo(cx2,-68-h+bob);ctx.lineTo(cx2+8,-68-h*.4+bob);ctx.closePath();ctx.fill();}
      ctx.shadowBlur=0;
    });
    // spinning gems
    [0,72,144,216,288].forEach((deg,i)=>{
      const a2=(deg+t*22)*Math.PI/180;
      const gc3=['#ff6b6b','#ffe66d','#4ecdc4','#ff8b94','#c77dff'][i];
      ctx.fillStyle=gc3;ctx.shadowColor=gc3;ctx.shadowBlur=5;
      ctx.beginPath();ctx.arc(Math.cos(a2)*14,-65+Math.sin(a2)*5+bob,3,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    });
    // eyes
    const ec=enraged?'#ff0000':'#ffd700';
    ctx.fillStyle=ec;ctx.shadowColor=ec;ctx.shadowBlur=12;
    [-7,7].forEach(ex=>{
      ctx.beginPath();ctx.ellipse(ex,-50+bob,6,7,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#000';ctx.beginPath();ctx.arc(ex,-50+bob,3.5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.6)';ctx.beginPath();ctx.arc(ex-2,-53+bob,1.5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=ec;
    });
    ctx.shadowBlur=0;
    ctx.strokeStyle=enraged?'#ff4400':'#ffd700';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(-16,-56+bob);ctx.lineTo(-4,-52+bob);ctx.stroke();
    ctx.beginPath();ctx.moveTo(16,-56+bob);ctx.lineTo(4,-52+bob);ctx.stroke();
    ctx.strokeStyle='#ffd700';ctx.lineWidth=2;
    if(enraged){ctx.beginPath();ctx.arc(0,-42+bob,10,.4,Math.PI-.4);ctx.stroke();ctx.fillStyle='#2a0050';ctx.fill();}
    else{ctx.beginPath();ctx.arc(0,-42+bob,7,.3,Math.PI-.3);ctx.stroke();}
    // desp halo
    if(desp){for(let i=0;i<8;i++){const a2=i/8*Math.PI*2+t*3,r2=65+Math.sin(t*3+i)*12;
      const dc=['#ff6b6b','#ffe66d','#4ecdc4','#c77dff','#ff8b94','#48dbfb','#ffd700','#ff1493'][i];
      ctx.fillStyle=dc;ctx.shadowColor=dc;ctx.shadowBlur=8;
      ctx.beginPath();ctx.arc(Math.cos(a2)*r2,Math.sin(a2)*r2*.6+bob,4+Math.sin(t*2+i)*2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}}
    ctx.restore();
  },

  guard(ctx,x,y,facing,af,t){
    ctx.save();ctx.translate(~~x,~~y);if(facing<0)ctx.scale(-1,1);
    const bob=Math.sin(t*3+x*.01)*1.5,walk=Math.sin(af*Math.PI*2)*5;
    ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.ellipse(0,20,12,3,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#cc4444';ctx.lineWidth=5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-4,8+bob);ctx.lineTo(-5+walk,18+bob);ctx.stroke();
    ctx.beginPath();ctx.moveTo(4,8+bob);ctx.lineTo(5-walk,18+bob);ctx.stroke();
    ctx.fillStyle='#dd5555';ctx.beginPath();ctx.ellipse(0,0+bob,10,12,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ffe66d';ctx.beginPath();ctx.arc(0,0+bob,5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#cc3333';ctx.beginPath();ctx.arc(0,-14+bob,12,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ff8888';ctx.beginPath();ctx.ellipse(0,-14+bob,8,5,0,0,Math.PI,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(0,-14+bob,5,4,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#cc0000';ctx.beginPath();ctx.arc(0,-14+bob,2.5,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#cc3333';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(2,-26+bob);ctx.lineTo(6,-34+bob);ctx.stroke();
    ctx.fillStyle='#ffe66d';ctx.beginPath();ctx.arc(6,-35+bob,4,0,Math.PI*2);ctx.fill();
    ctx.restore();
  },
};

// ══════════════════════════════════════════════════════════════════════
// PROJECTILE
// ══════════════════════════════════════════════════════════════════════
class Projectile {
  constructor(x,y,vx,vy,o){
    this.x=x;this.y=y;this.vx=vx;this.vy=vy;
    this.w=o.w||12;this.h=o.h||6;
    this.dmg=o.dmg||8;this.col=o.col||'#00ffff';
    this.friendly=o.friendly||false;
    this.life=o.life||3;this.t=0;
    this.trail=[];this.type=o.type||'bullet';
    this.homing=o.homing||false;this.target=null;
    this.gr=o.gr||0;
  }
  update(dt,target){
    if(this.homing&&target){
      const dx=target.x+target.w/2-this.x,dy=target.y+target.h/2-this.y;
      const d=Math.hypot(dx,dy);if(d>5){this.vx=M.lerp(this.vx,dx/d*300,dt*2);this.vy=M.lerp(this.vy,dy/d*300,dt*2);}
    }
    this.vy+=this.gr*dt;
    this.trail.push({x:this.x,y:this.y});if(this.trail.length>8)this.trail.shift();
    this.x+=this.vx*dt;this.y+=this.vy*dt;
    this.t+=dt;this.life-=dt;
    return this.life>0;
  }
  get rect(){return{x:this.x-this.w/2,y:this.y-this.h/2,w:this.w,h:this.h};}
  draw(ctx){
    // trail
    this.trail.forEach((p,i)=>{
      const al=i/this.trail.length*.5;
      ctx.save();ctx.globalAlpha=al;ctx.fillStyle=this.col;
      ctx.beginPath();ctx.arc(p.x,p.y,this.h*.5*(i/this.trail.length),0,Math.PI*2);ctx.fill();ctx.restore();
    });
    ctx.save();ctx.translate(this.x,this.y);
    ctx.rotate(Math.atan2(this.vy,this.vx));
    ctx.shadowColor=this.col;ctx.shadowBlur=10;
    if(this.type==='candy'){
      ctx.fillStyle=this.col;ctx.beginPath();ctx.ellipse(0,0,this.w*.7,this.h*.7,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.4)';ctx.beginPath();ctx.ellipse(-this.w*.15,-this.h*.2,this.w*.2,this.h*.2,0,0,Math.PI*2);ctx.fill();
    }else if(this.type==='shockring'){
      ctx.strokeStyle=this.col;ctx.lineWidth=4;ctx.globalAlpha=.8;
      ctx.beginPath();ctx.arc(0,0,this.w,0,Math.PI*2);ctx.stroke();
    }else{
      ctx.fillStyle=this.col;
      M.rr(ctx,-this.w/2,-this.h/2,this.w,this.h,this.h/2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.5)';ctx.fillRect(-this.w/2,-this.h/4,this.w*.6,this.h*.3);
    }
    ctx.shadowBlur=0;ctx.restore();
  }
}

// ══════════════════════════════════════════════════════════════════════
// PLATFORM / LEVEL
// ══════════════════════════════════════════════════════════════════════
class Platform {
  constructor(x,y,w,h,col,deco){this.x=x;this.y=y;this.w=w;this.h=h;this.col=col||'#3a2060';this.deco=deco||null;}
  draw(ctx,t){
    // main
    const g=ctx.createLinearGradient(this.x,this.y,this.x,this.y+this.h);
    g.addColorStop(0,this.col);g.addColorStop(1,'rgba(0,0,0,.5)');
    ctx.fillStyle=g;M.rr(ctx,this.x,this.y,this.w,this.h,6);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=1.5;ctx.stroke();
    // top edge highlight
    ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(this.x+6,this.y,this.w-12,2);
    // candy decorations
    if(this.deco==='candy'){
      const cols=['#ff6b6b','#ffe66d','#4ecdc4','#ff8b94','#c77dff'];
      for(let i=0;i<Math.floor(this.w/40);i++){
        const cx=this.x+20+i*40,cy=this.y-8;
        const col=cols[i%5];
        ctx.fillStyle=col;ctx.beginPath();ctx.ellipse(cx,cy+Math.sin(t+i)*2,4,7,0,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(cx,cy+7);ctx.lineTo(cx,cy+14);ctx.stroke();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(cx,cy+14,3,0,Math.PI*2);ctx.fill();
      }
    }
  }
}

function buildLevel(id){
  const plats=[], W=CFG.W, H=CFG.H;
  if(id===0){// Tutorial / Forest of Sweets
    plats.push(new Platform(0,680,3000,60,'#2a1840','candy'));
    plats.push(new Platform(200,540,180,18,'#4b2060'));
    plats.push(new Platform(450,460,160,18,'#4b2060','candy'));
    plats.push(new Platform(680,380,200,18,'#4b2060'));
    plats.push(new Platform(950,300,180,18,'#4b2060','candy'));
    plats.push(new Platform(1200,400,160,18,'#4b2060'));
    plats.push(new Platform(1450,480,200,18,'#4b2060','candy'));
    plats.push(new Platform(1700,360,180,18,'#4b2060'));
    plats.push(new Platform(1950,280,200,18,'#4b2060','candy'));
    plats.push(new Platform(2200,380,180,18,'#4b2060'));
    plats.push(new Platform(2500,560,300,18,'#4b2060','candy'));// shop platform
  }else if(id===1){// Usman arena
    plats.push(new Platform(0,620,2400,60,'#3a1010','candy'));
    plats.push(new Platform(100,480,200,18,'#662020'));
    plats.push(new Platform(550,400,180,18,'#662020','candy'));
    plats.push(new Platform(1000,320,200,18,'#662020'));
    plats.push(new Platform(1400,440,220,18,'#662020','candy'));
    plats.push(new Platform(1900,380,200,18,'#662020'));
  }else if(id===2){// Suhaib arena
    plats.push(new Platform(0,620,2400,60,'#0a0a3a','candy'));
    plats.push(new Platform(100,500,160,18,'#1a1a66'));
    plats.push(new Platform(400,400,200,18,'#1a1a66','candy'));
    plats.push(new Platform(750,300,180,18,'#1a1a66'));
    plats.push(new Platform(1150,420,200,18,'#1a1a66','candy'));
    plats.push(new Platform(1600,340,180,18,'#1a1a66'));
    plats.push(new Platform(1950,500,200,18,'#1a1a66','candy'));
  }else if(id===3){// Noah arena
    plats.push(new Platform(0,620,2400,60,'#0f1a0f','candy'));
    plats.push(new Platform(100,500,180,18,'#1a3a1a'));
    plats.push(new Platform(420,420,200,18,'#1a3a1a','candy'));
    plats.push(new Platform(820,360,180,18,'#1a3a1a'));
    plats.push(new Platform(1200,480,200,18,'#1a3a1a','candy'));
    plats.push(new Platform(1700,400,180,18,'#1a3a1a'));
    plats.push(new Platform(2050,520,200,18,'#1a3a1a','candy'));
  }else if(id===4){// Utkarsh final arena
    plats.push(new Platform(0,640,2800,60,'#1a0030'));
    plats.push(new Platform(0,640,2800,8,'#ffd700'));
    plats.push(new Platform(80,500,200,18,'#5500aa'));
    plats.push(new Platform(400,380,220,18,'#5500aa'));
    plats.push(new Platform(800,300,200,18,'#5500aa'));
    plats.push(new Platform(1200,420,220,18,'#5500aa'));
    plats.push(new Platform(1600,340,200,18,'#5500aa'));
    plats.push(new Platform(2000,480,220,18,'#5500aa'));
    plats.push(new Platform(2400,400,200,18,'#5500aa'));
  }
  const worldW=[3000,2400,2400,2400,2800][id]||3000;
  return{plats,worldW,id};
}

// ══════════════════════════════════════════════════════════════════════
// PLAYER CLASS
// ══════════════════════════════════════════════════════════════════════
class Player {
  constructor(){
    this.x=100;this.y=500;
    this.w=28;this.h=42;
    this.vx=0;this.vy=0;
    this.facing=1;
    this.grounded=false;
    this.djump=false;
    this.coyote=0;
    this.jbuf=0;
    this.dashing=false;
    this.dashDir=1;
    this.dashTimer=0;
    this.dashCd=0;
    this.attackTimer=0;
    this.attackCd=0;
    this.shootCd=0;
    this.animFrame=0;
    this.animTimer=0;
    this.state='idle';// idle run jump fall attack dash
    this.hp=6;this.maxHp=6;
    this.hurtTimer=0;
    this.hitPause=0;
    this.candy=0;
    this.upgrades={hp:0,atk:0,gun:0};
    this.invincible=false;this.invTimer=0;
    this.dead=false
    this.lives=1;
  }
  get cx(){return this.x+this.w/2;}
  get cy(){return this.y+this.h/2;}
  get rect(){return{x:this.x,y:this.y,w:this.w,h:this.h};}
  attackDmg(){return 15+(this.upgrades.atk||0)*6;}
  shootDmg(){return 8+(this.upgrades.gun||0)*5;}

  update(inp,dt,plats,projectiles,parts,audio,cam){
    if(this.dead)return;
    if(this.hitPause>0){this.hitPause-=dt;return;}

    // dash
    if(inp.dashTap&&this.dashCd<=0&&!this.dashing){
      this.dashing=true;this.dashTimer=CFG.DASHT;this.dashCd=CFG.DASHCD;
      this.dashDir=this.facing;
      audio.dash();parts.dash(this.cx,this.cy,this.dashDir>0);
    }
    if(this.dashing){
      this.dashTimer-=dt;
      if(this.dashTimer<=0)this.dashing=false;
      else{this.vx=this.dashDir*CFG.DASHV;this.vy*=0.8;
        parts.dash(this.cx,this.cy,this.dashDir>0);}
    }
    this.dashCd-=dt;this.attackCd-=dt;this.shootCd-=dt;

    // horizontal
    if(!this.dashing){
      const spd=CFG.SPD*(this.upgrades.atk>=2?1.1:1);
      if(inp.left){this.vx=M.lerp(this.vx,-spd,CFG.ACC*dt/spd);this.facing=-1;}
      else if(inp.right){this.vx=M.lerp(this.vx,spd,CFG.ACC*dt/spd);this.facing=1;}
      else this.vx=M.lerp(this.vx,0,CFG.DEC*dt/spd);
    }

    // gravity
    if(!this.dashing)this.vy=Math.min(this.vy+CFG.GR*dt,CFG.MFALL);

    // coyote / jump buffer
    if(this.grounded)this.coyote=CFG.COYOTE;else this.coyote-=dt;
    if(inp.jumpTap)this.jbuf=CFG.JBUF;else this.jbuf-=dt;

    if(this.jbuf>0){
      if(this.coyote>0){
        this.vy=CFG.JMP;this.coyote=0;this.jbuf=0;this.djump=true;audio.jump();
        parts.land(this.cx,this.y+this.h);
      }else if(this.djump){
        this.vy=CFG.DJMP;this.djump=false;this.jbuf=0;audio.jump();
        parts.land(this.cx,this.cy);
      }
    }
    // variable jump
    if(!inp.jumpHold&&this.vy<-200)this.vy=M.lerp(this.vy,-200,0.2);

    // attack
    if(inp.attackTap&&this.attackCd<=0){
      this.attackCd=0.42/(1+this.upgrades.atk*.25);
      this.attackTimer=this.attackCd;audio.attack();
      cam.shake(4,0.12);
    }
    if(this.attackTimer>0)this.attackTimer-=dt;

    // shoot
    if(inp.shootTap&&this.shootCd<=0){
      this.shootCd=0.35-(this.upgrades.gun||0)*.05;
      const spd=480+(this.upgrades.gun||0)*40;
      projectiles.push(new Projectile(this.cx+(this.facing>0?20:-20),this.cy-4,this.facing*spd,0,
        {friendly:true,dmg:this.shootDmg(),col:'#00ffff',w:18,h:7}));
      audio.shoot();
    }

    // move
    this.x+=this.vx*dt;this.y+=this.vy*dt;

    // collide with platforms
    const wasGround=this.grounded;this.grounded=false;
    for(const p of plats){
      if(M.hit(this.rect,p)){
        const ov_x_left=(this.x+this.w)-p.x;
        const ov_x_right=p.x+p.w-this.x;
        const ov_y_top=(this.y+this.h)-p.y;
        const ov_y_bot=p.y+p.h-this.y;
        const min=Math.min(ov_x_left,ov_x_right,ov_y_top,ov_y_bot);
        if(min===ov_y_top&&this.vy>=0){this.y=p.y-this.h;this.vy=0;this.grounded=true;this.djump=true;}
        else if(min===ov_y_bot&&this.vy<0){this.y=p.y+p.h;this.vy=0;}
        else if(min===ov_x_left)this.x=p.x-this.w;
        else this.x=p.x+p.w;
      }
    }
    if(this.grounded&&!wasGround){audio.land();parts.land(this.cx,this.y+this.h);}

    // kill zone
    if(this.y>900){this.hp=0;}{this.lives=0;}

    // clamp world
    this.x=Math.max(0,this.x);

    // invincibility
    if(this.invTimer>0)this.invTimer-=dt;
    else this.invincible=false;

    // animation
    if(this.dashing)this.state='dash';
    else if(this.attackTimer>this.attackCd*.5)this.state='attack';
    else if(!this.grounded)this.state=this.vy<0?'jump':'fall';
    else if(Math.abs(this.vx)>20)this.state='run';
    else this.state='idle';

    const rates={idle:0.5,run:0.18,jump:0.2,fall:0.2,attack:0.08,dash:0.06};
    this.animTimer+=dt;
    if(this.animTimer>rates[this.state]||0.2){this.animFrame=(this.animFrame+1)%8;this.animTimer=0;}

    // hp check
    if(this.hp<=0&&!this.dead){
      if(this.lives>0){
         this.lives--
         this.hp = this.maxHp
      }else{
         this.dead=true;
      }
    }
    
  }
    

  takeDmg(dmg,cam,audio,parts){
    if(this.invincible||this.dead)return;
    this.hp=Math.max(0,this.hp-dmg);
    this.invincible=true;this.invTimer=1.2;
    this.hitPause=CFG.HITPAUSE;
    cam.shake(8,0.25);audio.hurt();
    parts.explosion(this.cx,this.cy,.4);
    if(this.hp<=0&&this.lives===0)this.dead=true;
  }

  draw(ctx,t){
    if(this.dead)return;
    const af=this.animFrame/8;
    if(this.invincible&&Math.floor(t*12)%2===0){ctx.globalAlpha=0.4;}
    DRAW.player(ctx,this.cx,this.y+this.h,this.facing,this.state,af,t,this.dashing);
    ctx.globalAlpha=1;
  }
}

// ══════════════════════════════════════════════════════════════════════
// ENEMY BASE CLASS
// ══════════════════════════════════════════════════════════════════════
class Enemy {
  constructor(x,y,o){
    this.x=x;this.y=y;this.w=o.w||50;this.h=o.h||60;
    this.hp=o.hp||80;this.maxHp=this.hp;
    this.phase=1;this.facing=1;
    this.vx=0;this.vy=0;this.grounded=false;
    this.name=o.name||'Enemy';
    this.type=o.type||'guard';
    this.animFrame=0;this.animTimer=0;this.af=0;
    this.hurtTimer=0;this.hitPause=0;
    this.dead=false;this.dying=0;
    this.ai={timer:0,state:'idle',phase2done:false};
    this.candy=o.candy||20;
    this.isBoss=o.isBoss||false;
    this.invTimer=0;
  }
  get cx(){return this.x+this.w/2;}
  get cy(){return this.y+this.h/2;}
  get rect(){return{x:this.x,y:this.y,w:this.w,h:this.h};}

  baseUpdate(dt,plats){
    if(this.hitPause>0){this.hitPause-=dt;return false;}
    this.vy=Math.min(this.vy+CFG.GR*dt,CFG.MFALL);
    this.x+=this.vx*dt;this.y+=this.vy*dt;
    this.grounded=false;
    for(const p of plats){
      if(M.hit(this.rect,p)){
        const ov_y_top=(this.y+this.h)-p.y;
        const ov_y_bot=p.y+p.h-this.y;
        const ov_x_l=(this.x+this.w)-p.x;
        const ov_x_r=p.x+p.w-this.x;
        const mn=Math.min(ov_y_top,ov_y_bot,ov_x_l,ov_x_r);
        if(mn===ov_y_top&&this.vy>=0){this.y=p.y-this.h;this.vy=0;this.grounded=true;}
        else if(mn===ov_y_bot&&this.vy<0){this.y=p.y+p.h;this.vy=0;}
        else if(mn===ov_x_l)this.x=p.x-this.w;
        else this.x=p.x+p.w;
      }
    }
    // clamp world
    this.x=M.clamp(this.x,0,9999);
    this.animTimer+=dt;
    if(this.animTimer>0.12){this.animFrame=(this.animFrame+1)%8;this.animTimer=0;}
    this.af=this.animFrame/8;
    this.hurtTimer=Math.max(0,this.hurtTimer-dt);
    this.invTimer=Math.max(0,this.invTimer-dt);
    if(this.hp<=0&&!this.dead){this.dead=true;return false;}
    if(this.y > 900) {this.hp = 0; this.dead = true; return false;}
    const p2thresh=this.maxHp*.5;
    if(this.hp<=p2thresh&&this.phase<2){this.phase=2;}
    return !this.dead;
  }

  takeDmg(dmg,cam,audio,parts){
    if(this.invTimer>0||this.dead)return;
    this.hp=Math.max(0,this.hp-dmg);
    this.hitPause=CFG.HITPAUSE;
    this.hurtTimer=0.18;
    parts.hit(this.cx,this.cy,'#FF6B6B');
    cam.shake(5,0.15);audio.hit();
    if(this.isBoss)parts.candy(this.cx,this.cy,3);
  }

  drawHPBar(ctx,label){
    if(!this.isBoss)return;
    const bw=520,bh=18,bx=(CFG.W-bw)/2,by=28;
    ctx.fillStyle='rgba(0,0,0,.7)';M.rr(ctx,bx-4,by-4,bw+8,bh+8,10);ctx.fill();
    ctx.strokeStyle='#ffd700';ctx.lineWidth=2;M.rr(ctx,bx-4,by-4,bw+8,bh+8,10);ctx.stroke();
    const pct=Math.max(0,this.hp/this.maxHp);
    const hcol=pct>.5?`hsl(${M.lerp(0,120,pct*2)},100%,50%)`:`hsl(${M.lerp(0,30,pct*2)},100%,50%)`;
    ctx.fillStyle='#1a0030';M.rr(ctx,bx,by,bw,bh,6);ctx.fill();
    if(pct>0){ctx.fillStyle=hcol;M.rr(ctx,bx,by,bw*pct,bh,6);ctx.fill();}
    ctx.fillStyle='rgba(255,255,255,.15)';M.rr(ctx,bx,by,bw,bh/3,6);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 13px monospace';ctx.textAlign='center';
    ctx.fillText(`${label}  ♥ ${Math.ceil(this.hp)}/${this.maxHp}`,CFG.W/2,by+bh-3);
    if(this.phase>=2){
      ctx.fillStyle='#ff4444';ctx.font='bold 11px monospace';
      ctx.fillText('⚡ PHASE 2',CFG.W/2,by+bh+16);
    }
    if(this.phase>=3){
      ctx.fillStyle='#ff00ff';ctx.fillText('💀 ENRAGED',CFG.W/2,by+bh+32);}
  }
}

// ── USMAN (fast melee) ───────────────────────────────────────────────
class Usman extends Enemy {
  constructor(x,y){
    super(x,y,{w:60,h:72,hp:280,name:'USMAN',type:'usman',isBoss:true,candy:3}); // Changed candy to 3
    this.ai.state='approach';this.ai.timer=0;
    this.dashTimer=0;this.charging=false;
  }
  update(dt,player,plats,projectiles,parts,audio,cam){
    if(!this.baseUpdate(dt,plats))return;
    if(this.phase<2&&this.hp<this.maxHp*.5){this.phase=2;audio.roar();cam.shake(12,0.5);parts.explosion(this.cx,this.cy,.8);}
    if(this.phase<3&&this.hp<this.maxHp*.25){this.phase=3;audio.roar();cam.shake(16,0.6);}
    const dx=player.cx-this.cx,dy=player.cy-this.cy,dist=Math.hypot(dx,dy);
    this.facing=dx>0?1:-1;
    this.ai.timer-=dt;
    const spd=this.phase>=2?220:140;
    if(this.ai.state==='approach'){
      this.vx=M.lerp(this.vx,this.facing*spd,dt*4);
      if(dist<180&&this.ai.timer<=0){
        this.ai.state='attack';this.ai.timer=this.phase>=2?.5:.8;
        if(this.grounded)this.vy=CFG.JMP*.6;
      }
      if(this.ai.timer<=0)this.ai.timer=.4;
    }else if(this.ai.state==='attack'){
      // charge dash
      this.vx=M.lerp(this.vx,this.facing*(this.phase>=2?620:440),dt*10);
      if(this.ai.timer<=0){this.ai.state='approach';this.ai.timer=.6;}
    }else if(this.ai.state==='jump'){
      if(this.grounded)this.vy=CFG.JMP;
      if(this.ai.timer<=0)this.ai.state='approach';
    }
    // phase 2: occasional jump attacks
    if(this.phase>=2&&Math.random()<dt*.4&&this.grounded&&this.ai.state==='approach'){
      this.vy=CFG.JMP*.75;this.vx=this.facing*380;
    }
    // player contact damage
    if(!this.dead && M.hit(player.rect,this.rect)&&!player.invincible)
      player.takeDmg(this.phase>=2?16:10,cam,audio,parts);
    // attack hitbox
    if(!this.dead && this.ai.state==='attack'){
      const atx=this.facing>0?this.x+this.w:this.x-60,aty=this.y,atw=60,ath=this.h;
      if(M.hit(player.rect,{x:atx,y:aty,w:atw,h:ath})&&!player.invincible)
        player.takeDmg(this.phase>=2?22:15,cam,audio,parts);
    }
  }
  draw(ctx,t){
    if(this.dead) ctx.globalAlpha = Math.max(0, this.dying || 0);
    if(this.hurtTimer>0){ctx.filter='brightness(3)';}
    DRAW.usman(ctx,this.cx,this.y+this.h,this.facing,this.phase,this.af,t);
    ctx.filter='none';ctx.globalAlpha=1;
    this.drawHPBar(ctx,'USMAN — THE BLAZING FIST');
  }
}

// ── SUHAIB (ranged mage) ─────────────────────────────────────────────
class Suhaib extends Enemy {
  constructor(x,y){
    super(x,y,{w:56,h:80,hp:240,name:'SUHAIB',type:'suhaib',isBoss:true,candy:30}); // Changed candy to 30
    this.ai.state='float';this.ai.timer=2;this.shootTimer=0;
    this.floatY=y;this.floatT=0;
  }
  update(dt,player,plats,projectiles,parts,audio,cam){
    if(!this.baseUpdate(dt,plats))return;
    if(this.phase<2&&this.hp<this.maxHp*.5){this.phase=2;audio.roar();cam.shake(10,0.4);parts.explosion(this.cx,this.cy,.7);}
    if(this.phase<3&&this.hp<this.maxHp*.25){this.phase=3;}
    const dx=player.cx-this.cx;
    this.facing=dx>0?1:-1;
    this.floatT+=dt;
    // float movement
    this.vy=M.lerp(this.vy,Math.sin(this.floatT*1.2)*60-200,dt*3);
    this.vx=M.lerp(this.vx,this.facing*60,dt*2);
    this.y=M.clamp(this.y,200,500);
    this.ai.timer-=dt;this.shootTimer-=dt;
    const rate=this.phase>=2?1.0:1.8;
    if(this.shootTimer<=0){
      this.shootTimer=rate;
      const ang=Math.atan2(player.cy-this.cy,player.cx-this.cx);
      const spd=this.phase>=2?300:220;
      const spread=this.phase>=2?3:1;
      for(let i=0;i<spread;i++){
        const da=(i-(spread-1)/2)*.25;
        projectiles.push(new Projectile(this.cx,this.cy,
          Math.cos(ang+da)*spd,Math.sin(ang+da)*spd,
          {friendly:false,dmg:this.phase>=2?12:8,col:'#8888ff',w:14,h:10,type:'candy',gr:80}));
      }
      if(this.phase>=3){// homing
        projectiles.push(new Projectile(this.cx,this.cy,this.facing*200,-100,
          {friendly:false,dmg:10,col:'#ff44ff',w:12,h:12,type:'candy',homing:true,gr:0}));
      }
      audio.shoot();
    }
    // player contact dmg
    if(!this.dead && M.hit(player.rect,this.rect)&&!player.invincible)player.takeDmg(8,cam,audio,parts);
    // player hit by projectiles
    for(let i=projectiles.length-1;i>=0;i--){
      const pr=projectiles[i];
      if(!pr.friendly&&M.hit(player.rect,pr.rect)){
        player.takeDmg(pr.dmg,cam,audio,parts);
        parts.hit(pr.x,pr.y,'#8888ff');projectiles.splice(i,1);
      }
    }
  }
  draw(ctx,t){
    if(this.hurtTimer>0)ctx.filter='brightness(3)';
    DRAW.suhaib(ctx,this.cx,this.y+this.h,this.facing,this.phase,this.af,t);
    ctx.filter='none';
    this.drawHPBar(ctx,'SUHAIB — THE ARCANE SCHOLAR');
  }
}

// ── NOAH (tank + shockwaves) ─────────────────────────────────────────
class Noah extends Enemy {
  constructor(x,y){
    super(x,y,{w:70,h:90,hp:360,name:'NOAH',type:'noah',isBoss:true,candy:50}); // Candy is already 50
    this.ai.state='walk';this.ai.timer=1.5;this.shockTimer=0;
  }
  update(dt,player,plats,projectiles,parts,audio,cam){
    if(!this.baseUpdate(dt,plats))return;
    if(this.phase<2&&this.hp<this.maxHp*.5){this.phase=2;audio.roar();cam.shake(14,0.5);parts.shockwave(this.cx,this.cy+this.h,'#ff8800');}
    if(this.phase<3&&this.hp<this.maxHp*.25){this.phase=3;}
    const dx=player.cx-this.cx;
    this.facing=dx>0?1:-1;
    this.ai.timer-=dt;this.shockTimer-=dt;
    const spd=this.phase>=2?90:55;
    if(this.ai.state==='walk'){
      this.vx=M.lerp(this.vx,this.facing*spd,dt*3);
      if(this.ai.timer<=0){
        this.ai.state='stomp';this.ai.timer=this.phase>=2?1.8:2.5;
        this.vx=0;
      }
    }else if(this.ai.state==='stomp'){
      this.vx*=0.8;
      if(this.ai.timer<=0){
        // shockwave
        const sc=this.phase>=2?1.4:1;
        const col=this.phase>=3?'#ff0000':'#88ff44';
        parts.shockwave(this.cx,this.y+this.h,col);
        audio.shockwave();cam.shake(10,0.35);
        projectiles.push(new Projectile(this.cx,this.y+this.h-10,this.facing*340,-80,
          {friendly:false,dmg:18,col,w:30,h:20,type:'shockring',gr:0}));
        if(this.phase>=2){
          projectiles.push(new Projectile(this.cx,this.y+this.h-10,-this.facing*340,-80,
            {friendly:false,dmg:14,col,w:26,h:18,type:'shockring',gr:0}));
        }
        this.ai.state='walk';this.ai.timer=M.rand(1,2);
      }
    }
    // contact
    if(!this.dead && M.hit(player.rect,this.rect)&&!player.invincible)player.takeDmg(this.phase>=2?18:12,cam,audio,parts);
    // check projectile hits on player
    for(let i=projectiles.length-1;i>=0;i--){
      const pr=projectiles[i];
      if(!pr.friendly&&M.hit(player.rect,pr.rect)){
        player.takeDmg(pr.dmg,cam,audio,parts);
        parts.explosion(pr.x,pr.y,.3);projectiles.splice(i,1);
      }
    }
  }
  draw(ctx,t){
    if(this.hurtTimer>0)ctx.filter='brightness(3)';
    DRAW.noah(ctx,this.cx,this.y+this.h,this.facing,this.phase,this.af,t);
    ctx.filter='none';
    this.drawHPBar(ctx,'NOAH — THE IRON COLOSSUS');
  }
}

// ── UTKARSH FINAL BOSS ───────────────────────────────────────────────
class Utkarsh extends Enemy {
  constructor(x,y){
    super(x,y,{w:80,h:120,hp:600,name:'UTKARSH',type:'utkarsh',isBoss:true,candy:100}); // Changed candy to 100
    this.phase=1;this.ai.state='idle';this.ai.timer=2;
    this.shootTimer=0;this.bombTimer=0;this.teleTimer=0;
    this.summonTimer=0;this.laserTimer=0;this.laserActive=0;
    this.teleportTarget={x:400,y:300};
    this.laserY=400;
  }
  update(dt,player,plats,projectiles,parts,audio,cam,guards){
    if(!this.baseUpdate(dt,plats))return;
    // phase transitions
    if(this.hp<this.maxHp*.66&&this.phase<2){
      this.phase=2;audio.roar();cam.shake(16,0.7);
      parts.explosion(this.cx,this.cy,1.5);
    }
    if(this.hp<this.maxHp*.33&&this.phase<3){
      this.phase=3;audio.roar();cam.shake(20,0.9);
      parts.explosion(this.cx,this.cy,2);
    }
    const dx=player.cx-this.cx;
    this.facing=dx>0?1:-1;
    this.ai.timer-=dt;this.shootTimer-=dt;this.bombTimer-=dt;
    this.teleTimer-=dt;this.summonTimer-=dt;this.laserTimer-=dt;
    if(this.laserActive>0){this.laserActive-=dt;cam.shake(3,0.05);}

    // float
    this.vy=M.lerp(this.vy,Math.sin(this.teleTimer*0.7)*40-180,dt*3);
    this.y=M.clamp(this.y,120,480);

    // candy bullet spread
    const sr=this.phase>=3?.5:this.phase>=2?.9:1.4;
    if(this.shootTimer<=0){
      this.shootTimer=sr;
      const n=this.phase>=3?7:this.phase>=2?5:3;
      for(let i=0;i<n;i++){
        const ang=-Math.PI/2+(i-(n-1)/2)*.38*(this.phase>=2?1.4:1);
        const cols=['#FF6B6B','#FFE66D','#4ECDC4','#C77DFF','#FF9F43','#FF6CAB','#48dbfb'];
        projectiles.push(new Projectile(this.cx,this.cy,
          Math.cos(ang)*280,Math.sin(ang)*280,
          {friendly:false,dmg:this.phase>=2?14:10,col:cols[i%7],w:16,h:12,type:'candy',gr:120,life:3.5}));
      }
      // aimed shots phase 2+
      if(this.phase>=2){
        const ang2=Math.atan2(player.cy-this.cy,player.cx-this.cx);
        projectiles.push(new Projectile(this.cx,this.cy,
          Math.cos(ang2)*380,Math.sin(ang2)*380,
          {friendly:false,dmg:18,col:'#ffd700',w:20,h:16,type:'candy',gr:80,homing:this.phase>=3}));
      }
      audio.shoot();
    }

    // bomb drop
    if(this.bombTimer<=0){
      this.bombTimer=this.phase>=3?1.2:this.phase>=2?2:3;
      const bx=player.cx+M.rand(-80,80);
      projectiles.push(new Projectile(bx,this.y,M.rand(-30,30),M.rand(-100,-60),
        {friendly:false,dmg:20,col:'#ff1493',w:24,h:24,type:'candy',gr:500,life:3}));
    }

    // teleport
    if(this.teleTimer<=0){
      this.teleTimer=this.phase>=2?3:5;
      parts.explosion(this.cx,this.cy,.6);
      this.x=M.rand(100,CFG.W-200);this.y=M.rand(150,350);
      parts.explosion(this.cx,this.cy,.6);
    }

    // summon guards phase 2+
    if(this.phase>=2&&this.summonTimer<=0&&guards.length<3){
      this.summonTimer=5;
      guards.push(new GuardMinion(this.cx+M.rand(-120,120),this.y+50));
    }

    // sweep laser phase 3
    if(this.phase>=3&&this.laserTimer<=0){
      this.laserTimer=4;this.laserActive=1.2;
      this.laserY=player.cy+M.rand(-20,20);
      cam.shake(6,1.2);
    }

    // contact
    if(!this.dead && M.hit(player.rect,this.rect)&&!player.invincible)player.takeDmg(20,cam,audio,parts);

    // projectile vs player
    for(let i=projectiles.length-1;i>=0;i--){
      const pr=projectiles[i];
      if(!pr.friendly&&M.hit(player.rect,pr.rect)){
        player.takeDmg(pr.dmg,cam,audio,parts);
        parts.candy(pr.x,pr.y,5);projectiles.splice(i,1);
      }
    }
  }
  draw(ctx,t){
    // laser beam
    if(this.laserActive>0){
      const lal=this.laserActive*.8;
      ctx.save();ctx.globalAlpha=lal;
      const lg=ctx.createLinearGradient(0,this.laserY-8,0,this.laserY+8);
      lg.addColorStop(0,'transparent');lg.addColorStop(.5,'#ff00ff');lg.addColorStop(1,'transparent');
      ctx.fillStyle=lg;ctx.fillRect(0,this.laserY-12,CFG.W+400,24);
      ctx.fillStyle='rgba(255,255,255,.5)';ctx.fillRect(0,this.laserY-3,CFG.W+400,6);
      ctx.restore();
    }
    if(this.hurtTimer>0)ctx.filter='brightness(3)';
    DRAW.utkarsh(ctx,this.cx,this.y+this.h,this.facing,this.phase,this.af,t);
    ctx.filter='none';
    this.drawHPBar(ctx,'UTKARSH — KING OF CANDY');
  }
}

// ── GUARD MINION ──────────────────────────────────────────────────────
class GuardMinion extends Enemy {
  constructor(x,y){super(x,y,{w:34,h:48,hp:60,name:'Guard',type:'guard',candy:8});}
  update(dt,player,plats,projectiles,parts,audio,cam){
    if(!this.baseUpdate(dt,plats))return;
    const dx=player.cx-this.cx;this.facing=dx>0?1:-1;
    this.vx=M.lerp(this.vx,this.facing*160,dt*4);
    if(!this.dead && M.hit(player.rect,this.rect)&&!player.invincible)player.takeDmg(10,cam,audio,parts);
  }
  draw(ctx,t){
    if(this.hurtTimer>0)ctx.filter='brightness(3)';
    DRAW.guard(ctx,this.cx,this.y+this.h,this.facing,this.af,t);
    ctx.filter='none';
    // small hp bar
    const bw=40,pct=this.hp/this.maxHp;
    ctx.fillStyle='#333';ctx.fillRect(this.x,this.y-8,bw,5);
    ctx.fillStyle='#f00';ctx.fillRect(this.x,this.y-8,bw*pct,5);
  }
}

// ══════════════════════════════════════════════════════════════════════
// BACKGROUND RENDERER
// ══════════════════════════════════════════════════════════════════════
function drawBG(ctx,levelId,camX,camY,t){
  const W=CFG.W+200,H=CFG.H+200;
  const px=camX*.05,py=camY*.05;
  // sky gradient per level
  const skies=[
    ['#0a0018','#1a0040','#2a0060'],// 0 candy forest
    ['#1a0000','#3a0000','#500000'],// 1 usman fire
    ['#000015','#000030','#000050'],// 2 suhaib void
    ['#001a00','#003000','#004000'],// 3 noah jungle
    ['#0a0020','#1a0040','#000010'],// 4 utkarsh palace
  ];
  const sky=skies[levelId]||skies[0];
  const bg=ctx.createLinearGradient(0,0,0,H);
  sky.forEach((c,i)=>bg.addColorStop(i/2,c));
  ctx.fillStyle=bg;ctx.fillRect(-100,-100,W+200,H+200);

  // stars
  const stSeed=levelId*31337;
  for(let i=0;i<80;i++){
    const sx=((stSeed+i*7193)%W)-px*.3;
    const sy=((stSeed+i*3571)%H*0.6)-py*.3;
    const br=Math.abs(Math.sin(t*.5+i))*.8+.2;
    ctx.fillStyle=`rgba(255,255,255,${br*.6})`;
    ctx.fillRect(sx,sy,1+Math.floor(i%3),1+Math.floor(i%3));
  }

  // parallax candy mountains / silhouettes (layer 1)
  ctx.save();ctx.translate(-px*.4,py*.1);
  if(levelId===0){// candy mountains
    ctx.fillStyle='#200040';
    for(let i=0;i<8;i++){
      const mx=-100+i*200,mw=160,mh=180+i%3*60;
      ctx.beginPath();ctx.moveTo(mx,H);ctx.lineTo(mx+mw/2,H-mh);ctx.lineTo(mx+mw,H);ctx.closePath();ctx.fill();
    }
    ctx.fillStyle='rgba(255,100,180,.06)';
    for(let i=0;i<5;i++){
      const cx2=i*280+50,cy2=H-100;
      ctx.beginPath();ctx.arc(cx2,cy2,90,0,Math.PI*2);ctx.fill();
    }
  }else if(levelId===1){// fire columns
    ctx.fillStyle='#2a0000';
    for(let i=0;i<6;i++){const cx2=-50+i*240;ctx.fillRect(cx2,H-280,60,280);}
    ctx.fillStyle='rgba(255,40,0,.08)';ctx.fillRect(-100,H-120,W+200,120);
  }else if(levelId===2){// floating runes
    ctx.strokeStyle='rgba(80,80,255,.18)';ctx.lineWidth=1.5;
    for(let i=0;i<12;i++){
      const rx=-80+i*120,ry=60+i%4*80;
      ctx.beginPath();ctx.arc(rx,ry,30,0,Math.PI*2);ctx.stroke();
    }
  }else if(levelId===3){// trees
    ctx.fillStyle='#001800';
    for(let i=0;i<6;i++){
      const tx=-60+i*230;
      ctx.beginPath();ctx.moveTo(tx,H);ctx.lineTo(tx+30,H-220);ctx.lineTo(tx+60,H);ctx.closePath();ctx.fill();
      ctx.fillStyle='#002400';
      ctx.beginPath();ctx.moveTo(tx-20,H-130);ctx.lineTo(tx+30,H-310);ctx.lineTo(tx+80,H-130);ctx.closePath();ctx.fill();
      ctx.fillStyle='#001800';
    }
  }else if(levelId===4){// palace columns
    ctx.fillStyle='#0a0020';
    for(let i=0;i<8;i++){
      const cx2=-60+i*200;ctx.fillRect(cx2,80,40,H);
      ctx.fillStyle='#ffd700';ctx.fillRect(cx2-8,80,56,12);ctx.fillRect(cx2-8,H-12,56,12);
      ctx.fillStyle='#0a0020';
    }
    // floor tiles glow
    ctx.fillStyle='rgba(255,215,0,.03)';ctx.fillRect(-100,H-80,W+200,80);
  }
  ctx.restore();

  // closer layer
  ctx.save();ctx.translate(-px*.65,py*.15);
  if(levelId===0){// candy cane trees
    const cc=['#ff6b6b','#ffffff'];
    for(let i=0;i<5;i++){
      const tx=-50+i*320,th=120+i%2*40;
      for(let s=0;s<8;s++){
        ctx.fillStyle=cc[s%2];ctx.fillRect(tx-5+s*.5,H-s*16-16,14,18);
      }
      ctx.fillStyle='#ff6b6b';ctx.beginPath();ctx.ellipse(tx+2,H-th,20,20,0,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();
}

// ══════════════════════════════════════════════════════════════════════
// HUD
// ══════════════════════════════════════════════════════════════════════
function drawHUD(ctx,player,levelName,t){
  // hearts
  const hx=18,hy=18;
  for(let i=0;i<player.maxHp;i++){
    const full=i<player.hp;
    ctx.fillStyle=full?'#ff2244':'rgba(80,0,20,.6)';
    ctx.shadowColor='#ff2244';ctx.shadowBlur=full?8:0;
    ctx.font='bold 22px monospace';ctx.textAlign='left';
    ctx.fillText('♥',hx+i*26,hy+20);
  }
  ctx.shadowBlur=0;
  // candy count
  ctx.fillStyle='rgba(0,0,0,.5)';M.rr(ctx,hx,hy+30,100,24,8);ctx.fill();
  ctx.fillStyle='#FFE66D';ctx.shadowColor='#FFE66D';ctx.shadowBlur=6;
  ctx.font='bold 14px monospace';ctx.textAlign='left';
  ctx.fillText(`🍬 ${player.candy}`,hx+8,hy+46);
  ctx.shadowBlur=0;
  // level name
  ctx.fillStyle='rgba(255,255,255,.5)';ctx.font='12px monospace';ctx.textAlign='right';
  ctx.fillText(levelName,CFG.W-16,24);
  // controls reminder (tiny)
  ctx.fillStyle='rgba(255,255,255,.2)';ctx.font='10px monospace';ctx.textAlign='left';
  ctx.fillText('J=Attack  K=Shoot  L=Dash  SPACE=Jump  E=Shop',16,CFG.H-10);
}

// ══════════════════════════════════════════════════════════════════════
// SHOP SCENE
// ══════════════════════════════════════════════════════════════════════
class ShopScene {
  constructor(player,audio,onDone){
    this.player=player;this.audio=audio;this.onDone=onDone;
    this.t=0;this.sel=0;this.msg='';this.msgTimer=0;
    this.items=[
      {name:'Extra Heart',desc:'Max HP +1',cost:30,icon:'♥',key:'hp'},
      {name:'Swift Blade',desc:'Attack Speed +25%',cost:40,icon:'⚔',key:'atk'},
      {name:'Power Gun',desc:'Shot DMG & Speed +',cost:35,icon:'✦',key:'gun'},
    ];
  }
  update(inp,dt){
    this.t+=dt;if(this.msgTimer>0)this.msgTimer-=dt;
    if(inp.left||inp.p.ArrowLeft||inp.p.KeyA)this.sel=Math.max(0,this.sel-1);
    if(inp.right||inp.p.ArrowRight||inp.p.KeyD)this.sel=Math.min(this.items.length-1,this.sel+1);
    if(inp.interact){
      const it=this.items[this.sel];
      if(this.player.candy>=it.cost&&(this.player.upgrades[it.key]||0)<3){
        this.player.candy-=it.cost;
        this.player.upgrades[it.key]=(this.player.upgrades[it.key]||0)+1;
        if(it.key==='hp'){this.player.lives++;this.player.hp=Math.min(this.player.hp+1,this.player.maxHp);}
        this.msg=`Bought: ${it.name}!`;this.msgTimer=1.5;this.audio.buySound();
      }else if((this.player.upgrades[it.key]||0)>=3){this.msg='Max level!';this.msgTimer=1;}
      else{this.msg='Not enough candy!';this.msgTimer=1;}
    }
    if(inp.p.Escape||inp.p.KeyX||inp.p.Enter)this.onDone();
  }
  draw(ctx){
    const t=this.t;
    // backdrop
    ctx.fillStyle='rgba(0,0,0,.88)';ctx.fillRect(0,0,CFG.W,CFG.H);
    // candy rain
    for(let i=0;i<30;i++){
      const cx=(i*137.5+t*30)%CFG.W,cy=(t*60+i*73)%CFG.H;
      const cols=['#ff6b6b','#ffe66d','#4ecdc4','#c77dff'];
      ctx.fillStyle=cols[i%4];ctx.globalAlpha=.18;
      ctx.beginPath();ctx.ellipse(cx,cy,3,5,0,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    // title
    ctx.fillStyle='rgba(0,0,0,.7)';M.rr(ctx,CFG.W/2-200,40,400,80,16);ctx.fill();
    ctx.strokeStyle='#ffd700';ctx.lineWidth=2.5;M.rr(ctx,CFG.W/2-200,40,400,80,16);ctx.stroke();
    ctx.fillStyle='#ffd700';ctx.shadowColor='#ffd700';ctx.shadowBlur=15;
    ctx.font='bold 36px monospace';ctx.textAlign='center';ctx.fillText('🍬 CANDY SHOP',CFG.W/2,95);
    ctx.shadowBlur=0;
    ctx.fillStyle='#aaa';ctx.font='13px monospace';ctx.fillText(`Candy: ${this.player.candy}  ·  E=Buy · X/Esc=Leave`,CFG.W/2,124);
    // items
    const itemW=220,itemH=220,gap=30,startX=(CFG.W-(this.items.length*itemW+(this.items.length-1)*gap))/2;
    this.items.forEach((it,i)=>{
      const ix=startX+i*(itemW+gap),iy=160;
      const sel=i===this.sel;
      const lv=this.player.upgrades[it.key]||0;
      const affordable=this.player.candy>=it.cost&&lv<3;
      // card
      ctx.fillStyle=sel?'rgba(80,0,120,.95)':'rgba(20,0,40,.8)';
      M.rr(ctx,ix,iy,itemW,itemH,14);ctx.fill();
      ctx.strokeStyle=sel?'#ffd700':affordable?'#6644aa':'#333';ctx.lineWidth=sel?2.5:1.5;
      M.rr(ctx,ix,iy,itemW,itemH,14);ctx.stroke();
      if(sel){ctx.shadowColor='#ffd700';ctx.shadowBlur=18;ctx.strokeStyle='#ffd700';M.rr(ctx,ix,iy,itemW,itemH,14);ctx.stroke();ctx.shadowBlur=0;}
      // icon
      ctx.font='48px monospace';ctx.textAlign='center';ctx.fillStyle='#fff';
      ctx.fillText(it.icon,ix+itemW/2,iy+66);
      // name
      ctx.fillStyle='#fff';ctx.font=`bold 17px monospace`;ctx.fillText(it.name,ix+itemW/2,iy+98);
      // desc
      ctx.fillStyle='#aaa';ctx.font='12px monospace';ctx.fillText(it.desc,ix+itemW/2,iy+118);
      // cost
      ctx.fillStyle=affordable?'#ffe66d':'#cc3333';ctx.font='bold 15px monospace';
      ctx.fillText(`🍬 ${it.cost}`,ix+itemW/2,iy+142);
      // level pips
      for(let p=0;p<3;p++){
        ctx.fillStyle=p<lv?'#ffd700':'rgba(255,255,255,.18)';
        ctx.beginPath();ctx.arc(ix+itemW/2-20+p*20,iy+168,6,0,Math.PI*2);ctx.fill();
        if(p<lv){ctx.strokeStyle='#ffaa00';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(ix+itemW/2-20+p*20,iy+168,6,0,Math.PI*2);ctx.stroke();}
      }
      if(lv>=3){ctx.fillStyle='#ffe66d';ctx.font='bold 12px monospace';ctx.fillText('MAX',ix+itemW/2,iy+196);}
    });
    // message
    if(this.msgTimer>0){
      ctx.globalAlpha=Math.min(1,this.msgTimer);
      ctx.fillStyle='rgba(0,0,0,.75)';M.rr(ctx,CFG.W/2-140,CFG.H-100,280,44,12);ctx.fill();
      ctx.fillStyle='#ffe66d';ctx.font='bold 18px monospace';ctx.textAlign='center';ctx.fillText(this.msg,CFG.W/2,CFG.H-72);
      ctx.globalAlpha=1;
    }
    // player hp preview
    ctx.fillStyle='#fff';ctx.font='13px monospace';ctx.textAlign='center';
    ctx.fillText(`HP: ${this.player.hp}/${this.player.maxHp}`,CFG.W/2,CFG.H-30);
  }
}


// ══════════════════════════════════════════════════════════════════════
// CUTSCENE SYSTEM
// ══════════════════════════════════════════════════════════════════════
class Cutscene {
  constructor(audio,onDone){
    this.audio=audio;this.onDone=onDone;
    this.t=0;this.phase='fade_in';// fade_in → pan → dialogue → boss_appear → beat_wait → fade_out
    this.fadeAlpha=1;this.camX=0;this.camY=0;
    this.camTargetX=CFG.W/2-200;this.camTargetY=CFG.H/2-100;
    this.textIndex=0;this.textAlpha=0;this.textTimer=0;
    this.bossX=CFG.W+200;this.bossTargetX=CFG.W*.65;
    this.bossAlpha=0;this.bossY=320;this.particleT=0;
    this.lightning=0;this.rumble=0;this.beatPlayed=false;
    this.lines=[
      {speaker:'SYSTEM',text:'The Candy Kingdom trembles...'},
      {speaker:'SYSTEM',text:'You have stolen 3 legendary candies...'},
      {speaker:'SYSTEM',text:'The gates of the palace shatter open...'},
      {speaker:'UTKARSH',text:'"You DARE steal from my kingdom?!"'},
      {speaker:'UTKARSH',text:'"I am Utkarsh — THE CANDY KING!"'},
      {speaker:'UTKARSH',text:'"Your bones will become my candy canes!"'},
      {speaker:'PLAYER',text:'"..."'},
      {speaker:'PLAYER',text:'"Worth it."'},
    ];
    this.parts=new Particles();
    this.linePhase='';
    this.bossAnimT=0;
    this.panSpeed=0;
    // start the track from 0 so beat drop lands correctly
    audio.bgEl&&(audio.bgEl.currentTime=0);
    audio.bgEl&&audio.bgEl.play().catch(()=>{});
  }
  update(dt){
    this.t+=dt;this.bossAnimT+=dt;this.particleT+=dt;
    this.parts.update(dt);
    // lightning flicker
    if(this.lightning>0)this.lightning-=dt;
    if(this.rumble>0)this.rumble-=dt;

    if(this.phase==='fade_in'){
      this.fadeAlpha=Math.max(0,1-this.t*2);
      if(this.t>1.2){this.phase='pan';this.t=0;}
    }
    else if(this.phase==='pan'){
      // slow cinematic pan across the palace
      this.camX=M.lerp(0,CFG.W*.4,M.eIO(Math.min(this.t/2.5,1)));
      if(this.t>2.6){this.phase='darkness';this.t=0;}
    }
    else if(this.phase==='darkness'){
      this.fadeAlpha=Math.min(1,this.t*1.5);
      if(this.t>1.4){this.phase='dialogue';this.t=0;this.textTimer=0;this.textIndex=0;}
    }
    else if(this.phase==='dialogue'){
      this.fadeAlpha=1;
      this.textTimer+=dt;
      if(this.textTimer>3.2||(this.textIndex>=3&&this.textTimer>2.4)){
        this.textIndex++;this.textTimer=0;
        if(this.textIndex>=4){this.phase='boss_appear';this.t=0;}
      }
    }
    else if(this.phase==='boss_appear'){
      this.fadeAlpha=M.lerp(1,0.15,Math.min(this.t/1.2,1));
      this.bossAlpha=Math.min(1,this.t*1.4);
      this.bossX=M.lerp(CFG.W+250,this.bossTargetX,M.eOut(Math.min(this.t/1.8,1)));
      // spawn sparks
      if(Math.random()<dt*12)this.parts.candy(this.bossX+M.rand(-60,60),this.bossY+M.rand(-80,80),2);
      if(this.t>1.5){
        // lightning flash
        this.lightning=0.12;this.rumble=0.4;
        if(Math.floor(this.t*3)%2===0)this.parts.explosion(this.bossX,this.bossY,.4);
      }
      if(this.t>2.2){this.phase='more_dialogue';this.t=0;this.textIndex=3;this.textTimer=0;}
    }
    else if(this.phase==='more_dialogue'){
      this.bossX=M.lerp(this.bossX,this.bossTargetX,dt*2);
      this.textTimer+=dt;
      if(this.textTimer>2.6){this.textIndex++;this.textTimer=0;
        if(this.textIndex>=this.lines.length){this.phase='beat_wait';this.t=0;}}
      // candy particles continuously
      if(Math.random()<dt*6)this.parts.candy(this.bossX+M.rand(-40,40),this.bossY+M.rand(-60,60),1);
    }
    else if(this.phase==='beat_wait'){
      // wait for beat drop
      const musicTime=this.audio.bgEl?this.audio.bgEl.currentTime:0;
      // spawn dramatic particles
      if(Math.random()<dt*4)this.parts.explosion(this.bossX+M.rand(-60,60),this.bossY+M.rand(-60,60),.2);
      // beat drop at BEAT_DROP seconds
      if(musicTime>=BEAT_DROP&&!this.beatPlayed){
        this.beatPlayed=true;
        this.lightning=0.4;this.rumble=0.8;
        this.parts.explosion(this.bossX,this.bossY,2);
        this.audio.roar();
      }
      if(this.beatPlayed&&musicTime>BEAT_DROP+0.8){
        this.phase='fade_out';this.t=0;
      }
    }
    else if(this.phase==='fade_out'){
      this.fadeAlpha=Math.min(1,this.t*2.5);
      if(this.t>0.8){this.onDone();}
    }
  }
  draw(ctx){
    // cinematic black bars
    const barH=80;
    // bg
    const g=ctx.createLinearGradient(0,0,0,CFG.H);
    g.addColorStop(0,'#000010');g.addColorStop(.5,'#0a0020');g.addColorStop(1,'#000008');
    ctx.fillStyle=g;ctx.fillRect(0,0,CFG.W,CFG.H);

    // animated purple nebula
    ctx.save();
    const ng=ctx.createRadialGradient(CFG.W*.5+Math.sin(this.bossAnimT*.4)*40,CFG.H*.4,0,CFG.W*.5,CFG.H*.4,400);
    ng.addColorStop(0,`rgba(80,0,120,${.08+Math.sin(this.bossAnimT)*.04})`);
    ng.addColorStop(.5,`rgba(40,0,80,${.05})`);ng.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=ng;ctx.fillRect(0,0,CFG.W,CFG.H);ctx.restore();

    // stars
    for(let i=0;i<120;i++){
      const sx=((i*1619)%CFG.W),sy=((i*2039)%(CFG.H-barH*2))+barH;
      const br=Math.abs(Math.sin(this.bossAnimT*.3+i))*.5+.1;
      ctx.fillStyle=`rgba(255,255,255,${br})`;ctx.fillRect(sx,sy,i%3===0?2:1,i%3===0?2:1);
    }

    // distant palace silhouette
    ctx.fillStyle='rgba(20,0,40,.8)';
    for(let i=0;i<8;i++){
      const cx=i*180-this.camX*.2,h=150+i%3*80;
      ctx.fillRect(cx,CFG.H-barH-h,40,h);
      ctx.fillRect(cx-10,CFG.H-barH-h-30,60,32);
      ctx.beginPath();ctx.moveTo(cx-10,CFG.H-barH-h-30);ctx.lineTo(cx+20,CFG.H-barH-h-60);ctx.lineTo(cx+50,CFG.H-barH-h-30);ctx.fill();
    }
    // floor glow
    ctx.fillStyle='rgba(100,0,180,.12)';ctx.fillRect(0,CFG.H-barH-40,CFG.W,40);

    // boss drawn behind text
    if(this.phase==='boss_appear'||this.phase==='more_dialogue'||this.phase==='beat_wait'||this.phase==='fade_out'){
      ctx.save();ctx.globalAlpha=this.bossAlpha;
      // dramatic spotlight
      const sg=ctx.createRadialGradient(this.bossX,this.bossY,0,this.bossX,this.bossY,250);
      sg.addColorStop(0,'rgba(120,0,200,.25)');sg.addColorStop(.4,'rgba(80,0,150,.12)');sg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=sg;ctx.fillRect(0,0,CFG.W,CFG.H);
      DRAW.utkarsh(ctx,this.bossX,this.bossY+120,1,Math.floor(this.bossAnimT/3)%3+1,0,this.bossAnimT);
      ctx.restore();
    }

    // particles
    this.parts.draw(ctx);

    // lightning flash
    if(this.lightning>0){
      ctx.fillStyle=`rgba(150,100,255,${this.lightning*1.8})`;ctx.fillRect(0,0,CFG.W,CFG.H);
    }

    // dialogue box
    if(this.phase==='dialogue'||this.phase==='more_dialogue'){
      const line=this.lines[this.textIndex];
      if(line){
        const isUtkarsh=line.speaker==='UTKARSH';
        const isPlayer=line.speaker==='PLAYER';
        const bx=isUtkarsh?CFG.W-660:40;
        const by=CFG.H-barH-160;
        const bw=620,bh=110;
        // speaker box
        ctx.fillStyle=isUtkarsh?'rgba(80,0,30,.92)':isPlayer?'rgba(0,20,60,.92)':'rgba(0,0,0,.85)';
        M.rr(ctx,bx,by,bw,bh,14);ctx.fill();
        ctx.strokeStyle=isUtkarsh?'#ffd700':isPlayer?'#00ffff':'#666';ctx.lineWidth=2.5;
        M.rr(ctx,bx,by,bw,bh,14);ctx.stroke();
        // glow on speaker box
        if(isUtkarsh){ctx.shadowColor='#ffd700';ctx.shadowBlur=16;M.rr(ctx,bx,by,bw,bh,14);ctx.stroke();ctx.shadowBlur=0;}
        // speaker name
        ctx.fillStyle=isUtkarsh?'#ffd700':isPlayer?'#00ffff':'#888';
        ctx.font=`bold 13px monospace`;ctx.textAlign='left';
        ctx.fillText(line.speaker,bx+16,by+22);
        // typewriter text
        const chars=Math.min(line.text.length,Math.floor(this.textTimer*36));
        const shown=line.text.slice(0,chars);
        ctx.fillStyle='#fff';ctx.font=`${isUtkarsh?'bold ':''} 20px monospace`;
        ctx.fillText(shown,bx+16,by+62);
        // blink prompt
        if(chars>=line.text.length&&Math.floor(this.bossAnimT*3)%2===0){
          ctx.fillStyle='rgba(255,255,255,.6)';ctx.font='11px monospace';
          ctx.textAlign='right';ctx.fillText('▶ Continue...',bx+bw-14,by+bh-10);
        }
      }
    }

    // "beat drop incoming" pulse when beat_wait
    if(this.phase==='beat_wait'){
      const pulse=Math.abs(Math.sin(this.bossAnimT*3));
      ctx.fillStyle=`rgba(255,0,200,${pulse*.15})`;ctx.fillRect(0,0,CFG.W,CFG.H);
      ctx.fillStyle=`rgba(255,215,0,${pulse*.9})`;ctx.shadowColor='#ffd700';ctx.shadowBlur=20;
      ctx.font='bold 28px monospace';ctx.textAlign='center';
      ctx.fillText('🎵 THE BEAT DROPS...', CFG.W/2, CFG.H/2-120+Math.sin(this.bossAnimT*4)*6);
      ctx.shadowBlur=0;
      // countdown bars
      if(this.audio.bgEl){
        const musicT=this.audio.bgEl.currentTime;
        const rem=Math.max(0,BEAT_DROP-musicT);
        if(rem>0){
          ctx.fillStyle='rgba(0,0,0,.6)';M.rr(ctx,CFG.W/2-150,CFG.H/2-80,300,20,8);ctx.fill();
          ctx.fillStyle=`hsl(${300-rem*10},100%,60%)`;M.rr(ctx,CFG.W/2-150,CFG.H/2-80,300*(1-rem/10),20,8);ctx.fill();
        }
      }
    }

    // cinematic bars
    const barG=ctx.createLinearGradient(0,0,0,barH);barG.addColorStop(0,'#000');barG.addColorStop(1,'rgba(0,0,0,.85)');
    ctx.fillStyle=barG;ctx.fillRect(0,0,CFG.W,barH);
    const barG2=ctx.createLinearGradient(0,CFG.H-barH,0,CFG.H);barG2.addColorStop(0,'rgba(0,0,0,.85)');barG2.addColorStop(1,'#000');
    ctx.fillStyle=barG2;ctx.fillRect(0,CFG.H-barH,CFG.W,barH);

    // rumble shake effect
    if(this.rumble>0){
      const s=this.rumble*6;
      ctx.save();ctx.translate(M.rand(-s,s),M.rand(-s,s));
    }

    // vignette
    const vg=ctx.createRadialGradient(CFG.W/2,CFG.H/2,CFG.H*.3,CFG.W/2,CFG.H/2,CFG.H*.85);
    vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.7)');
    ctx.fillStyle=vg;ctx.fillRect(0,0,CFG.W,CFG.H);

    // fade overlay
    if(this.fadeAlpha>0){ctx.fillStyle=`rgba(0,0,0,${this.fadeAlpha})`;ctx.fillRect(0,0,CFG.W,CFG.H);}

    if(this.rumble>0)ctx.restore();
  }
}

// ══════════════════════════════════════════════════════════════════════
// VICTORY SCENE
// ══════════════════════════════════════════════════════════════════════
class VictoryScene {
  constructor(audio,onDone){
    this.audio=audio;this.onDone=onDone;
    this.t=0;this.parts=new Particles();this.fadeAlpha=1;
    audio.stopBoss();setTimeout(()=>audio.victory(),200);
  }
  update(dt){
    this.t+=dt;
    this.fadeAlpha=Math.max(0,1-this.t*2.5);
    this.parts.update(dt);
    if(Math.random()<dt*12){
      this.parts.candy(M.rand(0,CFG.W),M.rand(-20,CFG.H*.3),4);
      this.parts.explosion(M.rand(0,CFG.W),M.rand(0,CFG.H),.3);
    }
    for(let i=0;i<3;i++){
      const cols=['#FF6B6B','#FFE66D','#4ECDC4','#C77DFF','#FF9F43'];
      this.parts._add(M.rand(0,CFG.W),M.rand(-20,0),1,{
        col:cols[M.ri(0,4)],type:'star',sz:M.rand(4,10),sz2:0,
        smin:0,smax:40,life:M.rand(2,4),gr:80,fr:.98,
        ang:Math.PI/2,spread:.6,glow:true,bvx:M.rand(-20,20),bvy:0,
      });
    }
    if(this.t>12&&inp&&inp.p&&Object.keys(inp.p).length>0)this.onDone();
  }
  draw(ctx){
    // dark purple bg
    const g=ctx.createLinearGradient(0,0,0,CFG.H);g.addColorStop(0,'#0a0020');g.addColorStop(1,'#000008');
    ctx.fillStyle=g;ctx.fillRect(0,0,CFG.W,CFG.H);
    this.parts.draw(ctx);
    // title
    const pulse=Math.abs(Math.sin(this.t*1.5));
    ctx.save();ctx.translate(CFG.W/2,CFG.H/2-80);ctx.scale(1+pulse*.02,1+pulse*.02);
    ctx.fillStyle=`hsl(${this.t*40%360},100%,65%)`;ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=30;
    ctx.font='bold 72px monospace';ctx.textAlign='center';ctx.fillText('VICTORY!',0,0);
    ctx.shadowBlur=0;ctx.restore();
    // subtitle
    ctx.fillStyle='#ffd700';ctx.font='bold 24px monospace';ctx.textAlign='center';
    ctx.fillText('The Candy Kingdom is yours!',CFG.W/2,CFG.H/2);
    // subtext
    ctx.fillStyle='rgba(255,255,255,.6)';ctx.font='16px monospace';
    ctx.fillText('Utkarsh has been defeated. The candy is free.',CFG.W/2,CFG.H/2+40);
    if(this.t>3){
      ctx.fillStyle=`rgba(255,255,255,${Math.abs(Math.sin(this.t*2))*.8+.2})`;
      ctx.font='14px monospace';ctx.fillText('Press any key to return to menu',CFG.W/2,CFG.H-60);
    }
    // crown graphic
    ctx.save();ctx.translate(CFG.W/2,CFG.H/2-190);ctx.scale(1.4+pulse*.08,1.4+pulse*.08);
    ctx.fillStyle='#ffd700';ctx.shadowColor='#ffd700';ctx.shadowBlur=20;
    ctx.font='56px monospace';ctx.textAlign='center';ctx.fillText('👑',0,0);
    ctx.shadowBlur=0;ctx.restore();
    // fade
    if(this.fadeAlpha>0){ctx.fillStyle=`rgba(0,0,0,${this.fadeAlpha})`;ctx.fillRect(0,0,CFG.W,CFG.H);}
  }
}

// ══════════════════════════════════════════════════════════════════════
// MAIN MENU
// ══════════════════════════════════════════════════════════════════════
class MenuScene {
  constructor(audio,onStart,onSettings,onControls){
    this.audio=audio;this.onStart=onStart;this.onSettings=onSettings;this.onControls=onControls;
    this.t=0;this.sel=0;this.fadeAlpha=1;this.parts=new Particles();
    this.buttons=['Start Game','Settings','Controls'];
    this.hovAnim=[0,0,0];
    audio.startMenu();
  }
  update(inp,dt){
    this.t+=dt;this.fadeAlpha=Math.max(0,this.fadeAlpha-dt*2);
    this.parts.update(dt);
    if(Math.random()<dt*3)this.parts.candy(M.rand(0,CFG.W),M.rand(-20,0),1);
    this.hovAnim=this.hovAnim.map((v,i)=>M.lerp(v,i===this.sel?1:0,dt*8));
    if(inp.p.ArrowUp||inp.p.KeyW){this.sel=Math.max(0,this.sel-1);this.audio.menuTick();}
    if(inp.p.ArrowDown||inp.p.KeyS){this.sel=Math.min(this.buttons.length-1,this.sel+1);this.audio.menuTick();}
    if(inp.p.Enter||inp.p.Space||inp.p.KeyJ){
      if(this.sel===0){this.audio.stopMenu();this.onStart();}
      else if(this.sel===1)this.onSettings();
      else this.onControls();
    }
  }
  draw(ctx){
    const t=this.t;
    // animated bg
    const bg=ctx.createLinearGradient(0,0,0,CFG.H);
    bg.addColorStop(0,'#050010');bg.addColorStop(.5,'#0d0025');bg.addColorStop(1,'#050010');
    ctx.fillStyle=bg;ctx.fillRect(0,0,CFG.W,CFG.H);
    // floating candy BG pattern
    for(let i=0;i<20;i++){
      const px=((i*173+t*18)%CFG.W),py=((i*97+t*22)%CFG.H);
      const cols=['rgba(255,107,107,.08)','rgba(255,230,109,.08)','rgba(78,205,196,.08)','rgba(199,125,255,.08)'];
      ctx.fillStyle=cols[i%4];
      ctx.beginPath();ctx.arc(px,py,20+i%5*8,0,Math.PI*2);ctx.fill();
    }
    this.parts.draw(ctx);
    // title shadow
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.font='bold 68px monospace';ctx.textAlign='center';
    ctx.fillText('CANDY HEIST',CFG.W/2+4,180+4);
    // title gradient
    const tg=ctx.createLinearGradient(CFG.W/2-300,0,CFG.W/2+300,0);
    tg.addColorStop(0,'#FF6B6B');tg.addColorStop(.2,'#FFE66D');tg.addColorStop(.4,'#4ECDC4');
    tg.addColorStop(.6,'#C77DFF');tg.addColorStop(.8,'#FF9F43');tg.addColorStop(1,'#FF6B6B');
    ctx.fillStyle=tg;ctx.shadowColor='rgba(200,100,255,.6)';ctx.shadowBlur=30;
    ctx.fillText('CANDY HEIST',CFG.W/2,180);ctx.shadowBlur=0;
    // subtitle
    ctx.fillStyle='#ffd700';ctx.shadowColor='#ffd700';ctx.shadowBlur=10;
    ctx.font='bold 22px monospace';ctx.fillText('Kingdom of Utkarsh',CFG.W/2,222);ctx.shadowBlur=0;
    // decorative line
    const lg=ctx.createLinearGradient(CFG.W/2-250,0,CFG.W/2+250,0);
    lg.addColorStop(0,'transparent');lg.addColorStop(.5,'#ffd700');lg.addColorStop(1,'transparent');
    ctx.fillStyle=lg;ctx.fillRect(CFG.W/2-250,234,500,2);
    // buttons
    const btnW=300,btnH=56,btnX=CFG.W/2-btnW/2,startY=310;
    this.buttons.forEach((lbl,i)=>{
      const by=startY+i*(btnH+14);const hov=this.hovAnim[i];
      // shadow
      ctx.fillStyle='rgba(0,0,0,.4)';M.rr(ctx,btnX+3,by+3,btnW,btnH,10);ctx.fill();
      // bg
      const bg2=ctx.createLinearGradient(btnX,by,btnX+btnW,by);
      if(i===this.sel){bg2.addColorStop(0,'#5500aa');bg2.addColorStop(1,'#8800cc');}
      else{bg2.addColorStop(0,'rgba(20,0,40,.85)');bg2.addColorStop(1,'rgba(40,0,70,.85)');}
      ctx.fillStyle=bg2;M.rr(ctx,btnX,by,btnW,btnH,10);ctx.fill();
      // border
      ctx.strokeStyle=i===this.sel?'#ffd700':'rgba(150,100,255,.4)';
      ctx.lineWidth=i===this.sel?2.5:1;M.rr(ctx,btnX,by,btnW,btnH,10);ctx.stroke();
      if(i===this.sel){ctx.shadowColor='#ffd700';ctx.shadowBlur=14;M.rr(ctx,btnX,by,btnW,btnH,10);ctx.stroke();ctx.shadowBlur=0;}
      // highlight
      ctx.fillStyle='rgba(255,255,255,.08)';M.rr(ctx,btnX+2,by+2,btnW-4,btnH/3,8);ctx.fill();
      // text
      const icons=['🍬','⚙','🎮'];
      ctx.fillStyle=i===this.sel?'#fff':'rgba(200,180,255,.8)';
      ctx.font=`bold ${i===this.sel?20:18}px monospace`;ctx.textAlign='center';
      ctx.fillText(`${icons[i]}  ${lbl}`,btnX+btnW/2,by+btnH/2+7);
      // arrow
      if(i===this.sel){ctx.fillStyle='#ffd700';ctx.font='18px monospace';ctx.fillText('▶',btnX+18,by+btnH/2+7);}
    });
    // version / hint
    ctx.fillStyle='rgba(255,255,255,.3)';ctx.font='12px monospace';ctx.textAlign='center';
    ctx.fillText('↑↓ Navigate  ·  ENTER / SPACE Select',CFG.W/2,CFG.H-30);
    ctx.fillStyle='rgba(255,255,255,.15)';ctx.fillText('v1.0  ·  A browser game',CFG.W/2,CFG.H-12);
    if(this.fadeAlpha>0){ctx.fillStyle=`rgba(0,0,0,${this.fadeAlpha})`;ctx.fillRect(0,0,CFG.W,CFG.H);}
  }
}

// ── SETTINGS ─────────────────────────────────────────────────────────
class SettingsScene {
  constructor(audio,onBack){
    this.audio=audio;this.onBack=onBack;this.t=0;
    this.rows=[
      {label:'Volume',type:'slider',min:0,max:1,step:.05,val:audio.vol},
      {label:'Screen Shake',type:'toggle',val:CFG.SHAKE},
      {label:'Fullscreen',type:'action',action:()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen();else document.exitFullscreen();}},
    ];
    this.sel=0;
  }
  update(inp,dt){
    this.t+=dt;
    if(inp.p.ArrowUp||inp.p.KeyW)this.sel=Math.max(0,this.sel-1);
    if(inp.p.ArrowDown||inp.p.KeyS)this.sel=Math.min(this.rows.length-1,this.sel+1);
    const row=this.rows[this.sel];
    if(row.type==='slider'){
      if(inp.d.ArrowLeft||inp.d.KeyA){row.val=M.clamp(row.val-row.step,row.min,row.max);this.audio.setVol(row.val);}
      if(inp.d.ArrowRight||inp.d.KeyD){row.val=M.clamp(row.val+row.step,row.min,row.max);this.audio.setVol(row.val);}
    }else if(row.type==='toggle'&&(inp.p.Enter||inp.p.Space||inp.p.KeyJ)){
      row.val=!row.val;if(row.label==='Screen Shake')CFG.SHAKE=row.val;
    }else if(row.type==='action'&&(inp.p.Enter||inp.p.Space||inp.p.KeyJ))row.action();
    if(inp.p.Escape||inp.p.KeyX||inp.p.Backspace)this.onBack();
  }
  draw(ctx){
    ctx.fillStyle='rgba(0,0,0,.92)';ctx.fillRect(0,0,CFG.W,CFG.H);
    ctx.fillStyle='rgba(80,0,120,.3)';ctx.fillRect(0,0,CFG.W,CFG.H);
    ctx.fillStyle='#ffd700';ctx.shadowColor='#ffd700';ctx.shadowBlur=15;
    ctx.font='bold 40px monospace';ctx.textAlign='center';ctx.fillText('⚙ Settings',CFG.W/2,80);ctx.shadowBlur=0;
    const startY=160,rowH=80;
    this.rows.forEach((r,i)=>{
      const ry=startY+i*rowH,sel=i===this.sel;
      ctx.fillStyle=sel?'rgba(80,0,120,.8)':'rgba(0,0,0,.5)';M.rr(ctx,CFG.W/2-280,ry,560,64,10);ctx.fill();
      ctx.strokeStyle=sel?'#ffd700':'#333';ctx.lineWidth=sel?2:1;M.rr(ctx,CFG.W/2-280,ry,560,64,10);ctx.stroke();
      ctx.fillStyle='#fff';ctx.font='bold 18px monospace';ctx.textAlign='left';ctx.fillText(r.label,CFG.W/2-260,ry+38);
      if(r.type==='slider'){
        const bx=CFG.W/2+20,bw=200,bh=12,by=ry+26;
        ctx.fillStyle='#222';ctx.fillRect(bx,by,bw,bh);
        const fg=ctx.createLinearGradient(bx,0,bx+bw,0);fg.addColorStop(0,'#c77dff');fg.addColorStop(1,'#ffd700');
        ctx.fillStyle=fg;ctx.fillRect(bx,by,bw*r.val,bh);
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bx+bw*r.val,by+bh/2,8,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#aaa';ctx.font='14px monospace';ctx.textAlign='right';ctx.fillText(`${Math.round(r.val*100)}%`,CFG.W/2+240,ry+38);
      }else if(r.type==='toggle'){
        const tx=CFG.W/2+80,ty=ry+20;
        ctx.fillStyle=r.val?'#44cc44':'#cc4444';M.rr(ctx,tx,ty,70,28,14);ctx.fill();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(r.val?tx+50:tx+20,ty+14,11,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#fff';ctx.font='14px monospace';ctx.textAlign='right';ctx.fillText(r.val?'ON':'OFF',CFG.W/2+240,ry+38);
      }else{
        ctx.fillStyle='#aaa';ctx.font='14px monospace';ctx.textAlign='right';ctx.fillText('[ENTER]',CFG.W/2+240,ry+38);
      }
    });
    // controls section
    const cy2=startY+this.rows.length*rowH+20;
    ctx.fillStyle='rgba(255,255,255,.5)';ctx.font='bold 16px monospace';ctx.textAlign='center';
    ctx.fillText('── Controls ──',CFG.W/2,cy2);
    const ctrls=[['Move','WASD / Arrow Keys'],['Jump','Space / W / ↑'],['Nail Attack','J'],['Shoot','K'],['Dash','L'],['Interact/Shop','E']];
    ctrls.forEach(([a,b],i)=>{
      ctx.fillStyle='rgba(200,180,255,.7)';ctx.font='14px monospace';ctx.textAlign='right';ctx.fillText(a,CFG.W/2-10,cy2+22+i*22);
      ctx.fillStyle='#fff';ctx.textAlign='left';ctx.fillText(b,CFG.W/2+10,cy2+22+i*22);
    });
    ctx.fillStyle='rgba(255,255,255,.4)';ctx.font='12px monospace';ctx.textAlign='center';
    ctx.fillText('↑↓ Navigate  ·  ←→ Adjust  ·  Esc/X Back',CFG.W/2,CFG.H-20);
  }
}

// ══════════════════════════════════════════════════════════════════════
// GAME STATE MACHINE
// ══════════════════════════════════════════════════════════════════════
class Game {
  constructor(){
    this.canvas=document.getElementById('gc');
    this.ctx=this.canvas.getContext('2d');
    this.canvas.width=CFG.W;this.canvas.height=CFG.H;
    this.inp=new Input();
    this.aud=new AudioMgr();
    this.cam=new Camera();
    this.parts=new Particles();
    this.player=null;
    this.enemies=[];this.guards=[];this.projectiles=[];
    this.level=null;
    this.levelIndex=0;// 0=world, 1=usman, 2=suhaib, 3=noah, 4=utkarsh
    this.scene='menu';// menu settings game boss cutscene victory shop
    this.menu=null;this.settings=null;this.cutscene=null;this.victory=null;this.shop=null;
    this.t=0;this.dt=0;this.lt=0;
    this.transitioning=false;this.transAlpha=0;this.transDir=0;this.transCb=null;
    this.levelNames=['The Candy Forest','Usman\'s Volcanic Arena','Suhaib\'s Arcane Void','Noah\'s Iron Fortress','Utkarsh\'s Sacred Palace'];
    this.shopSign={x:2430,y:520,w:180,h:60};// sign position in level 0
    
    // --- BOSS DEFEAT COUNTDOWN STATE ---
    this.bossDefeated=false;
    this.bossCountdown=0;
    this.beatDrop = false; // Flag for cutscene timeout
    this.beatDropTimer = 0; // Timer for cutscene timeout
    this.nextLevelTimer = 0;
    this.shopSignsData = [
      {x:2430,y:520,w:180,h:60}, // Level 0: On the platform at y=560 (560-40)
      {x:1430,y:560,w:180,h:60}, // Level 1 (Usman): On the main platform at y=620 (620-60)
      {x:1430,y:560,w:180,h:60}, // Level 2 (Suhaib): On the main platform at y=620 (620-60)
      {x:1430,y:560,w:180,h:60}, // Level 3 (Noah): On the main platform at y=620 (620-60)
      {x:2430,y:580,w:180,h:60}, // Level 4 (Utkarsh): On the main platform at y=640 (640-60)
    ];
    this.currentShopSign = null;
    this.shopVisible=false;this.shopPrompt=0;
    this.deathTimer=0;this.deathScreen=false;
    this.init();
  }

  init(){
    this.aud.init();
    window.addEventListener('click',()=>this.aud.resume(),{once:true});
    window.addEventListener('keydown',()=>this.aud.resume(),{once:true});
    this.goMenu();
    requestAnimationFrame(ts=>this.loop(ts));
  }

  goMenu(){
    this.scene='menu';this.parts.clear();
    this.menu=new MenuScene(this.aud,()=>this.startTransition(()=>this.startGame()),()=>this.goSettings(),()=>this.goControls());
  }
  goSettings(){this.scene='settings';this.settings=new SettingsScene(this.aud,()=>{this.scene='menu';});}
  goControls(){this.scene='settings';this.settings=new SettingsScene(this.aud,()=>{this.scene='menu';});}

  startGame(){
    this.player=new Player();this.levelIndex=0;
    this.parts.clear();this.projectiles=[];this.enemies=[];this.guards=[];
    this.loadLevel(0);this.scene='game';
  }

  loadLevel(idx){
    console.log('Loading level:', idx);
    this.levelIndex=idx;
    this.level=buildLevel(idx);
    this.cam.bw=this.level.worldW;
    this.currentShopSign = this.shopSignsData[idx];
    this.projectiles=[];this.enemies=[];this.guards=[];this.parts.clear();
    this.deathScreen=false;this.deathTimer=0;
    this.nextLevelTimer = 0; // Reset progression timer
    this.bossDefeated=false; // Reset boss countdown
    this.bossCountdown=0;

    if(idx===0){// world level with enemies
      [400,700,1000,1300,1600,1900].forEach(ex=>{
        const g=new GuardMinion(ex,560);this.guards.push(g);
      });
      this.player.x=60;this.player.y=520; // Player start position for level 0
      console.log('Player starting at:', this.player.x, this.player.y, 'for level', idx);
      this.cam.snap(0,0);
    }else if(idx===1){// Usman
      this.enemies=[new Usman(900,520)];
      this.player.x=80;this.player.y=520; // Player start position for level 1
      console.log('Player starting at:', this.player.x, this.player.y, 'for level', idx);
      this.cam.snap(0,0);
    }else if(idx===2){// Suhaib
      this.enemies=[new Suhaib(900,420)];
      this.player.x=80;this.player.y=520; // Player start position for level 2
      console.log('Player starting at:', this.player.x, this.player.y, 'for level', idx);
      this.cam.snap(0,0);
    }else if(idx===3){// Noah
      this.enemies=[new Noah(900,470)];
      this.player.x=80;this.player.y=520; // Player start position for level 3
      console.log('Player starting at:', this.player.x, this.player.y, 'for level', idx);
      this.cam.snap(0,0);
    }else if(idx===4){// Utkarsh
      this.enemies=[new Utkarsh(700,300)];
      this.player.x=60;this.player.y=500; // Player start position for level 4
      console.log('Player starting at:', this.player.x, this.player.y, 'for level', idx);
    }
    this.scene=idx>=1?'boss':'game'; // Set scene based on level index
    console.log('Scene set to:', this.scene, 'for level', idx);
  }

  startTransition(cb){
    console.log('Starting transition with callback:', cb);
    this.transitioning=true;this.transAlpha=0;this.transDir=1;this.transCb=cb;
  }
  updateTransition(dt){
    if(!this.transitioning)return;
    this.transAlpha+=this.transDir*dt*3;
    if(this.transDir===1&&this.transAlpha>=1){this.transAlpha=1;this.transDir=-1;if(this.transCb){this.transCb();this.transCb=null;}}
    else if(this.transDir===-1&&this.transAlpha<=0){this.transAlpha=0;this.transitioning=false;}
  }

  loop(ts){
    requestAnimationFrame(t=>this.loop(t));
    this.dt=Math.min((ts-this.lt)/1000,.05);this.lt=ts;this.t+=this.dt;
    const dt=this.dt,ctx=this.ctx;
    this.updateTransition(dt);
    const inp=this.inp;

    // Failsafe for stuck cutscene (using user's terminology)
    // If beatDrop is true, it means the cutscene for Utkarsh is active and being timed.
    // If the timer runs out, force the transition.
    // This check is placed before scene-specific updates to act as an override.
    // ── MENU ──
    if(this.scene==='menu'){
      this.menu&&this.menu.update(inp,dt);
      ctx.clearRect(0,0,CFG.W,CFG.H);
      this.menu&&this.menu.draw(ctx);
    }
    // ── SETTINGS ──
    else if(this.scene==='settings'){
      this.settings&&this.settings.update(inp,dt);
      ctx.clearRect(0,0,CFG.W,CFG.H);
      this.settings&&this.settings.draw(ctx);
    }
    // ── SHOP ──
    else if(this.scene==='shop'){
      this.shop&&this.shop.update(inp,dt);
      ctx.clearRect(0,0,CFG.W,CFG.H);
      this.shop&&this.shop.draw(ctx);
    }
    // ── CUTSCENE ──
    else if(this.scene==='cutscene'){
      this.cutscene&&this.cutscene.update(dt);
      // Failsafe for cutscene getting stuck
      if (this.beatDrop) {
        this.beatDropTimer -= dt;
        if (this.beatDropTimer <= 0) {
          console.warn("Beat drop cutscene timed out! Forcing transition to Utkarsh boss level.");
          this.beatDrop = false;
          this.beatDropTimer = 0;
          this.loadLevel(4); // Load Utkarsh's level
          this.scene = 'boss'; // Ensure scene is set to boss
        }
      }

      ctx.clearRect(0,0,CFG.W,CFG.H);
      this.cutscene&&this.cutscene.draw(ctx);
    }
    // ── VICTORY ──
    else if(this.scene==='victory'){
      this.victory&&this.victory.update(dt);
      ctx.clearRect(0,0,CFG.W,CFG.H);
      this.victory&&this.victory.draw(ctx);
    }
    // ── GAME / BOSS ──
    else if(this.scene==='game'||this.scene==='boss'){
      this.updateGame(dt,inp);
      this.drawGame(ctx);
    }

    // transition overlay
    if(this.transitioning&&this.transAlpha>0){
      ctx.fillStyle=`rgba(0,0,0,${this.transAlpha})`;ctx.fillRect(0,0,CFG.W,CFG.H);
    }
    inp.flush();
  }

  updateGame(dt,inp){
    
    const pl=this.player;
    // update player
    pl.update(inp,dt,this.level.plats,this.projectiles,this.parts,this.aud,this.cam);
    // clamp player to world
    pl.x=M.clamp(pl.x,0,this.level.worldW-pl.w);
    // camera
    this.cam.update(dt);
    this.cam.follow(pl.cx,pl.cy,dt);
    // particles
    this.parts.update(dt);
    // projectiles
    this.projectiles=this.projectiles.filter(p=>{
      const alive=p.update(dt,pl);
      // friendly projectile vs enemies
      if(p.friendly){
        [...this.enemies,...this.guards].forEach(e=>{
          if(!e.dead&&M.hit(p.rect,e.rect)){
            e.takeDmg(pl.shootDmg(),this.cam,this.aud,this.parts);
            this.parts.hit(p.x,p.y);alive&&(p.life=-1);
          }
        });
      }
      return p.life>0;
    });

    // player melee attack vs enemies
    if(pl.attackTimer>pl.attackCd*.4&&pl.attackTimer<pl.attackCd*.85){
      const ar={x:pl.facing>0?pl.x+pl.w:pl.x-48,y:pl.y-4,w:48,h:pl.h+8};
      [...this.enemies,...this.guards].forEach(e=>{
        if(!e.dead&&e.invTimer<=0&&M.hit(ar,e.rect)){
          e.takeDmg(pl.attackDmg(),this.cam,this.aud,this.parts);
        }
      });
    }

    // handle boss death triggers based on health for reliability
    const boss = this.enemies.find(e => e.isBoss);
    if (boss && boss.hp <= 0 && !this.bossDefeated) {
      this.bossDefeated = true;
      boss.dying = 1;
      pl.candy += boss.candy; // award candy immediately
      this.parts.explosion(boss.cx, boss.cy, 2);
      this.aud.victory();this.cam.shake(18,0.8);
      this.bossCountdown = 10; // 10 second countdown as requested
      console.log(`Boss ${boss.name} defeated! Starting 10s auto-advance.`);
    }

    // update enemies
    this.enemies.forEach(e=>{
      if(e.dead){e.dying=Math.max(0,(e.dying||1)-dt*1.5);return;}
      if(e.type==='usman')e.update(dt,pl,this.level.plats,this.projectiles,this.parts,this.aud,this.cam);
      else if(e.type==='suhaib')e.update(dt,pl,this.level.plats,this.projectiles,this.parts,this.aud,this.cam);
      else if(e.type==='noah')e.update(dt,pl,this.level.plats,this.projectiles,this.parts,this.aud,this.cam);
      else if(e.type==='utkarsh')e.update(dt,pl,this.level.plats,this.projectiles,this.parts,this.aud,this.cam,this.guards);
    });
    // update guards
    this.guards.forEach(g=>{
      if(g.dead){
        pl.candy+=g.candy;g.candy=0;
        this.parts.candy(g.cx,g.cy,4);this.aud.coin();
        return;
      }
      g.update(dt,pl,this.level.plats,this.projectiles,this.parts,this.aud,this.cam);
    });
    
    
    this.guards=this.guards.filter(g=>!g.dead);

    // shop interaction
    if(this.currentShopSign){
      const shopArea={x:this.currentShopSign.x,y:this.currentShopSign.y,w:this.currentShopSign.w,h:this.currentShopSign.h+60};
      const near=M.hit(pl.rect,shopArea);
      this.shopPrompt = near ? Math.min(1, this.shopPrompt + dt * 3) : Math.max(0, this.shopPrompt - dt * 3);
      if(near&&inp.interact){
        this.shop=new ShopScene(pl,this.aud,()=>{this.scene='game';});this.scene='shop';
      }
    }

    // player dead
    if(pl.dead&&!this.deathScreen){
      this.deathScreen=true;this.deathTimer=0;this.aud.stopBoss();
    }
    if(this.deathScreen){
      this.deathTimer+=dt;
      if(this.deathTimer>3&&(inp.p.Enter||inp.p.Space||inp.p.KeyJ)){
        // respawn at level start
        this.player=new Player();this.player.candy=pl.candy;
        this.player.upgrades=pl.upgrades;this.player.maxHp=pl.maxHp;this.player.hp=pl.maxHp;
        this.loadLevel(this.levelIndex);
      }
    }

    // boss defeat countdown
    if(this.bossDefeated&&this.bossCountdown>0){
      this.bossCountdown-=dt;
      if(this.bossCountdown<=0||inp.p.KeyI){
        this.bossDefeated=false;
        this.bossCountdown=0;
        this.levelComplete();
      }
    }

    // level progression on world level
    if(this.levelIndex===0){
      // all guards cleared → proceed to boss 1 if reached end
      // Lowered X threshold to 2000 to ensure advancement
      if(pl.x>2000&&this.guards.length===0){
        console.log('Level 0 conditions met: Player past 2700 and all guards defeated. Initiating transition to Level 1.');
        this.startTransition(()=>{this.loadLevel(1);});
      }
    }
  }

  levelComplete(){
    console.log(`ADVANCING: Level ${this.levelIndex} Complete.`);
    let next=this.levelIndex+1;
    if(this.levelIndex===3){// after Noah, trigger Utkarsh cutscene
      // Activate cutscene failsafe timer
      this.startTransition(()=>{
        this.cutscene=new Cutscene(this.aud,()=>{
          // Cutscene finished successfully, disable failsafe
          this.beatDrop = false;
          this.beatDropTimer = 0;
          this.startTransition(()=>{this.loadLevel(4);});
        });
        this.beatDrop = true; // Activate cutscene failsafe
        this.beatDropTimer = 20; // 20 seconds timeout for cutscene
        this.scene='cutscene';
      });
    }else if(this.levelIndex===4){// Utkarsh defeated
      this.aud.stopBoss();
      this.victory=new VictoryScene(this.aud,()=>this.goMenu());
      this.scene='victory';
    }else if(next<=3){
      console.log('Advancing to next level automatically:', next);
      // Automatically advance to the next level
      this.startTransition(()=>this.loadLevel(next));
    }
  }

  drawGame(ctx){
    ctx.clearRect(0,0,CFG.W,CFG.H);
    const cx=this.cam.x,cy=this.cam.y;
    // draw background (no camera translate)
    drawBG(ctx,this.levelIndex,cx,cy,this.t);
    // camera world
    this.cam.apply(ctx);
    // platforms
    this.level.plats.forEach(p=>p.draw(ctx,this.t));
    // shop sign
    if(this.currentShopSign){
      const s=this.currentShopSign;
      ctx.fillStyle='rgba(80,0,120,.9)';M.rr(ctx,s.x,s.y,s.w,s.h,10);ctx.fill();
      ctx.strokeStyle='#ffd700';ctx.lineWidth=2;M.rr(ctx,s.x,s.y,s.w,s.h,10);ctx.stroke();
      ctx.fillStyle='#ffd700';ctx.shadowColor='#ffd700';ctx.shadowBlur=8;
      ctx.font='bold 18px monospace';ctx.textAlign='center';
      ctx.fillText('🍬 SHOP',s.x+s.w/2,s.y+s.h/2+7);ctx.shadowBlur=0;
      // pole
      ctx.strokeStyle='#8866aa';ctx.lineWidth=4;ctx.beginPath();
      // Adjust pole length based on platform height if needed, for now assume it's always above ground
      ctx.moveTo(s.x+s.w/2,s.y+s.h);ctx.lineTo(s.x+s.w/2,s.y+s.h+60);ctx.stroke();
      // E prompt
      if(this.shopPrompt>0){
        ctx.globalAlpha=this.shopPrompt;ctx.fillStyle='#fff';ctx.font='bold 14px monospace';ctx.textAlign='center'; // Changed from this.shopPrompt to this.shopPrompt
        ctx.fillText('[E] Enter Shop',s.x+s.w/2,s.y-12);ctx.globalAlpha=1;
      }
    }
    // enemies
    this.enemies.forEach(e=>!e.dead&&e.draw(ctx,this.t));
    this.guards.forEach(g=>!g.dead&&g.draw(ctx,this.t));
    // projectiles
    this.projectiles.forEach(p=>p.draw(ctx));
    // player
    this.player.draw(ctx,this.t);
    // particles
    this.parts.draw(ctx);

    // NEXT LEVEL COUNTDOWN OVERLAY
    if(this.nextLevelTimer > 0) {
      const secs = Math.ceil(this.nextLevelTimer);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      M.rr(ctx, this.player.x - 100, this.player.y - 80, 200, 40, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Next level in ${secs}s...`, this.player.x, this.player.y - 55);
      ctx.textAlign = 'left';
    }

    this.cam.restore(ctx);

    // HUD (screen-space)
    drawHUD(ctx,this.player,this.levelNames[this.levelIndex],this.t);

    // boss defeat countdown display
    if(this.bossDefeated&&this.bossCountdown>0){
      const secs=Math.ceil(this.bossCountdown);
      const pulse=Math.abs(Math.sin(this.t*4));
      
      // dark overlay
      ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,0,CFG.W,CFG.H);
      
      // victory banner
      ctx.fillStyle='rgba(80,0,120,.95)';
      M.rr(ctx,CFG.W/2-300,CFG.H/2-120,600,200,16);ctx.fill();
      ctx.strokeStyle='#ffd700';ctx.lineWidth=3;
      M.rr(ctx,CFG.W/2-300,CFG.H/2-120,600,200,16);ctx.stroke();
      
      // glow effect
      ctx.shadowColor='#ffd700';ctx.shadowBlur=20;
      M.rr(ctx,CFG.W/2-300,CFG.H/2-120,600,200,16);ctx.stroke();
      ctx.shadowBlur=0;
      
      // victory text
      ctx.fillStyle='#ffd700';ctx.shadowColor='#ffd700';ctx.shadowBlur=15;
      ctx.font='bold 48px monospace';ctx.textAlign='center';
      ctx.fillText('⚔ BOSS DEFEATED! ⚔',CFG.W/2,CFG.H/2-60);
      ctx.shadowBlur=0;
      
      // candy awarded
      ctx.fillStyle='#FFE66D';ctx.font='bold 24px monospace';
      ctx.fillText(`🍬 Candy Collected!`,CFG.W/2,CFG.H/2-10);
      
      // countdown
      ctx.fillStyle=`rgba(255,255,255,${0.7+pulse*0.3})`;
      ctx.font='bold 20px monospace';
      ctx.fillText(`Next level in ${secs}s...`,CFG.W/2,CFG.H/2+30);
      
      // skip prompt
      ctx.fillStyle=`rgba(255,255,255,${0.5+pulse*0.5})`;
      ctx.font='16px monospace';
      ctx.fillText('Press [I] to skip',CFG.W/2,CFG.H/2+70);
    }

    // death screen
    if(this.deathScreen){
      const al=Math.min(1,this.deathTimer*.8);
      ctx.fillStyle=`rgba(0,0,0,${al*.85})`;ctx.fillRect(0,0,CFG.W,CFG.H);
      if(this.deathTimer>0.8){
        ctx.fillStyle='#ff2244';ctx.shadowColor='#ff2244';ctx.shadowBlur=20;
        ctx.font='bold 56px monospace';ctx.textAlign='center';ctx.fillText('YOU DIED',CFG.W/2,CFG.H/2-30);ctx.shadowBlur=0;
        ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='20px monospace';
        ctx.fillText('All your memories remain.',CFG.W/2,CFG.H/2+20);
        if(this.deathTimer>3){ctx.fillStyle=`rgba(255,255,255,${Math.abs(Math.sin(this.t*2))*.8+.2})`;ctx.font='14px monospace';ctx.fillText('ENTER / SPACE to try again',CFG.W/2,CFG.H/2+70);}
      }
    }

    // DEBUG OVERLAY
    this.drawDebug(ctx);
  }

  drawDebug(ctx) {
    ctx.fillStyle = 'rgba(0,255,0,0.7)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    const lines = [
      `LV: ${this.levelIndex} | Scene: ${this.scene}`,
      `PL X: ${~~this.player.x} | Guards: ${this.guards.length}`,
      `Timer: ${this.nextLevelTimer.toFixed(1)}`,
      `Press N to Skip Level`
    ];
    lines.forEach((l, i) => ctx.fillText(l, 10, 100 + i * 12));
  }
}

// ══════════════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════════════
let inp;// global ref for VictoryScene update check
window.addEventListener('DOMContentLoaded',()=>{
  const game=new Game();
  window._game=game;
  inp=game.inp;
  // Responsive canvas
  function resize(){
    const canvas=document.getElementById('gc');
    const wrap=document.getElementById('gw');
    if(!canvas||!wrap)return;
    const ww=window.innerWidth,wh=window.innerHeight;
    const scale=Math.min(ww/CFG.W,wh/CFG.H);
    wrap.style.width=`${CFG.W*scale}px`;wrap.style.height=`${CFG.H*scale}px`;
    wrap.style.transform=`translate(-50%,-50%)`;
    wrap.style.position='absolute';wrap.style.left='50%';wrap.style.top='50%';
  }
  resize();window.addEventListener('resize',resize);
});
