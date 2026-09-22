(() => {
"use strict";

const canvas=document.getElementById("pondCanvas");
const ctx=canvas.getContext("2d");

const intro=document.getElementById("intro");
const enterButton=document.getElementById("enterButton");
const pauseButton=document.getElementById("pauseButton");
const viewButton=document.getElementById("viewButton");
const attractButton=document.getElementById("attractButton");
const lightButton=document.getElementById("lightButton");
const viewBadge=document.getElementById("viewBadge");
const viewLabel=document.getElementById("viewLabel");
const lightLabel=document.getElementById("lightLabel");
const viewName=document.getElementById("viewName");
const stateText=document.getElementById("stateText");
const observationText=document.getElementById("observationText");
const hintText=document.getElementById("hintText");
const depthText=document.getElementById("depthText");
const speedText=document.getElementById("speedText");
const headingText=document.getElementById("headingText");

const W=canvas.width,H=canvas.height;
const pond={cx:W*.5,cy:H*.57,rx:W*.40,ry:H*.31};
const views=["pond","follow","pov"];
const lights=[
  {name:"SOFT AFTERNOON",sky1:"#708c76",sky2:"#adc2a2",water1:"#6e9b91",water2:"#295b55",sun:.78},
  {name:"GOLDEN HOUR",sky1:"#846e58",sky2:"#c7a777",water1:"#789287",water2:"#385853",sun:.64},
  {name:"OVERCAST",sky1:"#63706a",sky2:"#909d94",water1:"#667f79",water2:"#364d4a",sun:.34}
];

let running=false,paused=false,lastTime=performance.now(),viewIndex=0,viewMode="pond",lightIndex=0;
let attract=null,attractTimer=0,ripple=null,rippleLife=0,observationTimer=0;

const fish={
  x:pond.cx-110,y:pond.cy+15,
  vx:26,vy:-5,
  heading:0,desiredHeading:0,
  speed:27,targetSpeed:27,
  depth:.48,targetDepth:.48,
  turnRate:0,tailPhase:0,
  state:"cruise",stateTimer:5.5,
  pathBias:.35
};

const cam={x:W/2,y:H/2,scale:1,angle:0};

const rocks=[
  {x:pond.cx-235,y:pond.cy+78,r:34,t:0.1},
  {x:pond.cx+214,y:pond.cy+86,r:26,t:0.2},
  {x:pond.cx+165,y:pond.cy-94,r:22,t:0.3},
  {x:pond.cx-128,y:pond.cy-108,r:18,t:0.4},
  {x:pond.cx+15,y:pond.cy+118,r:16,t:0.5}
];

const floorPatches=[];
for(let i=0;i<26;i++){
  const a=(i*2.399963)+.4;
  const rr=Math.sqrt((i+.5)/26)*.82;
  floorPatches.push({
    x:pond.cx+Math.cos(a)*pond.rx*rr,
    y:pond.cy+Math.sin(a)*pond.ry*rr,
    rx:18+(i%5)*5,ry:7+(i%4)*3,a:a*.27
  });
}

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function wrap(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
function inside(x,y,m=1){const nx=(x-pond.cx)/(pond.rx*m),ny=(y-pond.cy)/(pond.ry*m);return nx*nx+ny*ny<=1}
function normEdge(x,y){const nx=(x-pond.cx)/pond.rx,ny=(y-pond.cy)/pond.ry;return Math.sqrt(nx*nx+ny*ny)}
function enter(){running=true;intro.hidden=true;observationText.textContent="1匹だけ、静かに泳いでいます。";}
function togglePause(){if(!running)return;paused=!paused;pauseButton.textContent=paused?"RESUME":"PAUSE";pauseButton.setAttribute("aria-pressed",paused?"true":"false")}
function cycleView(){if(!running)return;viewIndex=(viewIndex+1)%views.length;viewMode=views[viewIndex];updateViewLabels()}
function updateViewLabels(){
 const names={pond:"POND VIEW",follow:"FOLLOW",pov:"KOI POV"};
 const short={pond:"POND",follow:"FOLLOW",pov:"KOI POV"};
 viewBadge.textContent=names[viewMode];viewName.textContent=short[viewMode];
}
function cycleLight(){lightIndex=(lightIndex+1)%lights.length;lightLabel.textContent=lights[lightIndex].name}
function attractKoi(){
 if(!running||paused)return;
 const a=Math.atan2(fish.y-pond.cy,fish.x-pond.cx)+Math.PI+(Math.random()-.5)*.9;
 const r=.25+.18*Math.random();
 attract={x:pond.cx+Math.cos(a)*pond.rx*r,y:pond.cy+Math.sin(a)*pond.ry*r};
 attractTimer=7.5;
 ripple={x:attract.x,y:attract.y,r:4};rippleLife=1;
 fish.state="investigate";fish.stateTimer=5.5;
 observationText.textContent="水面の小さな振動に気づいたようです。";
}
function setBehavior(){
 const r=Math.random();
 if(r<.18){fish.state="coast";fish.targetSpeed=12+Math.random()*5;fish.stateTimer=3.5+Math.random()*4;observationText.textContent="ほとんど止まり、ゆっくり姿勢だけを変えています。";}
 else if(r<.34){fish.state="surface";fish.targetDepth=.16+.08*Math.random();fish.targetSpeed=18+Math.random()*7;fish.stateTimer=5+Math.random()*4;observationText.textContent="少し水面へ上がってきました。";}
 else if(r<.48){fish.state="deep";fish.targetDepth=.72+.09*Math.random();fish.targetSpeed=21+Math.random()*8;fish.stateTimer=6+Math.random()*5;observationText.textContent="深い場所へゆっくり降りています。";}
 else {fish.state="cruise";fish.targetDepth=.36+.28*Math.random();fish.targetSpeed=22+Math.random()*11;fish.stateTimer=6+Math.random()*7;observationText.textContent="一定の速さで池を回っています。";}
 fish.pathBias=(Math.random()-.5)*.9;
}
function updateFish(dt){
 fish.stateTimer-=dt;attractTimer=Math.max(0,attractTimer-dt);
 if(fish.stateTimer<=0)setBehavior();

 let desired=fish.desiredHeading;
 const edge=normEdge(fish.x,fish.y);
 if(attractTimer>0&&attract){
   desired=Math.atan2(attract.y-fish.y,attract.x-fish.x);
   fish.targetSpeed=30;
   fish.targetDepth=.30;
 }else{
   const center=Math.atan2(pond.cy-fish.y,pond.cx-fish.x);
   const tangent=center+Math.PI/2*(fish.pathBias>=0?1:-1);
   const inward=clamp((edge-.58)/.34,0,1);
   desired=wrap(tangent*(1-inward)+center*inward);
   desired+=Math.sin(performance.now()*.00037+fish.pathBias*3)*.28;
 }

 if(edge>.84){
   const center=Math.atan2(pond.cy-fish.y,pond.cx-fish.x);
   desired=wrap(desired+(wrap(center-desired))*clamp((edge-.84)/.13,0,1));
 }

 const err=wrap(desired-fish.heading);
 const maxTurn=.72;
 fish.turnRate+=((clamp(err*1.4,-maxTurn,maxTurn))-fish.turnRate)*Math.min(1,dt*2.1);
 fish.heading=wrap(fish.heading+fish.turnRate*dt);

 fish.speed+=(fish.targetSpeed-fish.speed)*Math.min(1,dt*.7);
 fish.depth+=(fish.targetDepth-fish.depth)*Math.min(1,dt*.55);

 const glide=.96+.04*Math.cos(fish.tailPhase);
 fish.vx=Math.cos(fish.heading)*fish.speed*glide;
 fish.vy=Math.sin(fish.heading)*fish.speed*glide;
 fish.x+=fish.vx*dt;fish.y+=fish.vy*dt;

 if(!inside(fish.x,fish.y,.96)){
   const c=Math.atan2(pond.cy-fish.y,pond.cx-fish.x);
   fish.heading=c;
   fish.x+=Math.cos(c)*4;fish.y+=Math.sin(c)*4;
 }

 const tailFreq=.7+fish.speed/22;
 fish.tailPhase+=dt*tailFreq*Math.PI*2;

 if(attractTimer>0&&attract&&Math.hypot(fish.x-attract.x,fish.y-attract.y)<30){
   attractTimer=0;attract=null;fish.state="coast";fish.targetSpeed=10;fish.stateTimer=2.8;
   observationText.textContent="振動のあった場所で、しばらく止まりました。";
 }
}
function updateCamera(dt){
 let tx=W/2,ty=H/2,ts=1,ta=0;
 if(viewMode==="follow"){tx=fish.x;ty=fish.y;ts=1.85;ta=0}
 if(viewMode==="pov"){tx=fish.x;ty=fish.y;ts=1;ta=0}
 cam.x+=(tx-cam.x)*Math.min(1,dt*2.8);
 cam.y+=(ty-cam.y)*Math.min(1,dt*2.8);
 cam.scale+=(ts-cam.scale)*Math.min(1,dt*2.6);
 cam.angle+=(ta-cam.angle)*Math.min(1,dt*2);
}
function update(dt){
 if(!running||paused)return;
 updateFish(dt);updateCamera(dt);
 if(rippleLife>0){rippleLife-=dt*.45;if(ripple)ripple.r+=dt*34}
 observationTimer-=dt;
 if(observationTimer<=0){
   observationTimer=5.5;
   if(fish.state==="cruise"&&fish.speed>27)observationText.textContent="尾びれの振れが少し速くなりました。";
   else if(fish.depth>.68)observationText.textContent="底に近い、暗い場所を選んでいます。";
   else if(fish.depth<.25)observationText.textContent="水面近くの明るい層を泳いでいます。";
 }
 stateText.textContent=fish.state==="coast"?"ほとんど止まっています。":fish.state==="surface"?"水面へ上がっています。":fish.state==="deep"?"深い場所へ降りています。":fish.state==="investigate"?"振動の場所へ向かっています。":"ゆっくり泳いでいます。";
 depthText.textContent="DEPTH "+Math.round(18+fish.depth*72)+" cm";
 speedText.textContent="SPEED "+(fish.speed/100).toFixed(2)+" m/s";
 headingText.textContent="Heading "+Math.round((fish.heading*180/Math.PI+360)%360)+"°";
}

function applyTopCamera(){
 ctx.translate(W/2,H/2);
 ctx.scale(cam.scale,cam.scale);
 ctx.translate(-cam.x,-cam.y);
}
function draw(){
 if(viewMode==="pov")drawPOV();
 else drawTop();
}
function drawTop(){
 const L=lights[lightIndex];
 const bg=ctx.createLinearGradient(0,0,0,H);
 bg.addColorStop(0,L.sky1);bg.addColorStop(1,L.sky2);
 ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);

 ctx.save();applyTopCamera();
 drawBank(L);drawWater(L);drawFloor(L);drawRocks(L);drawCaustics(L);drawKoiShadow();drawKoi();drawRipple();drawEdgePlants(L);
 ctx.restore();

 drawVignette();
}
function drawBank(L){
 ctx.fillStyle=lightIndex===2?"#46534b":"#53684b";
 ctx.beginPath();ctx.ellipse(pond.cx,pond.cy,pond.rx+62,pond.ry+55,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=lightIndex===1?"#5d593d":"#3f5542";
 ctx.beginPath();ctx.ellipse(pond.cx,pond.cy,pond.rx+25,pond.ry+22,0,0,Math.PI*2);ctx.fill();
}
function drawWater(L){
 const g=ctx.createRadialGradient(pond.cx-105,pond.cy-78,18,pond.cx,pond.cy,pond.rx);
 g.addColorStop(0,L.water1);g.addColorStop(1,L.water2);
 ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(pond.cx,pond.cy,pond.rx,pond.ry,0,0,Math.PI*2);ctx.fill();
 ctx.globalAlpha=.12+L.sun*.08;ctx.fillStyle="#d9eee5";ctx.beginPath();ctx.ellipse(pond.cx-90,pond.cy-70,pond.rx*.42,pond.ry*.22,-.15,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
}
function drawFloor(L){
 ctx.save();ctx.beginPath();ctx.ellipse(pond.cx,pond.cy,pond.rx,pond.ry,0,0,Math.PI*2);ctx.clip();
 for(const p of floorPatches){ctx.globalAlpha=.10;ctx.fillStyle=(p.a%1>.5)?"#d6c6a3":"#708071";ctx.beginPath();ctx.ellipse(p.x,p.y,p.rx,p.ry,p.a,0,Math.PI*2);ctx.fill()}
 ctx.globalAlpha=1;ctx.restore();
}
function drawRocks(L){
 for(const r of rocks){
  ctx.globalAlpha=.28;ctx.fillStyle="#1e2824";ctx.beginPath();ctx.ellipse(r.x+5,r.y+8,r.r*1.05,r.r*.45,r.t,0,Math.PI*2);ctx.fill();
  const g=ctx.createRadialGradient(r.x-r.r*.3,r.y-r.r*.3,2,r.x,r.y,r.r);g.addColorStop(0,"#8a9486");g.addColorStop(1,"#3c4941");
  ctx.globalAlpha=.62;ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(r.x,r.y,r.r,r.r*.62,r.t,0,Math.PI*2);ctx.fill();
 }
 ctx.globalAlpha=1;
}
function drawCaustics(L){
 const t=performance.now()*.00035;
 ctx.save();ctx.beginPath();ctx.ellipse(pond.cx,pond.cy,pond.rx,pond.ry,0,0,Math.PI*2);ctx.clip();
 ctx.globalAlpha=.035+.045*L.sun;ctx.strokeStyle="#f3fff8";ctx.lineWidth=2;
 for(let j=0;j<9;j++){
  ctx.beginPath();
  for(let i=0;i<=36;i++){
   const x=pond.cx-pond.rx+i*(pond.rx*2/36);
   const y=pond.cy-pond.ry+j*(pond.ry*2/8)+Math.sin(i*.62+j+t*4)*7+Math.sin(i*.21-t*3)*4;
   if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.stroke();
 }
 ctx.restore();ctx.globalAlpha=1;
}
function drawKoiShadow(){
 const depthScale=.35+.65*fish.depth;
 ctx.save();ctx.translate(fish.x+8,fish.y+12+fish.depth*14);ctx.rotate(fish.heading);
 ctx.globalAlpha=.10+.12*depthScale;ctx.fillStyle="#07120e";
 ctx.beginPath();ctx.ellipse(0,0,31,9,0,0,Math.PI*2);ctx.fill();ctx.restore();ctx.globalAlpha=1;
}
function drawKoi(){
 if(viewMode==="follow"||viewMode==="pond"){
  const wag=Math.sin(fish.tailPhase);
  const yaw=fish.turnRate*.55;
  ctx.save();ctx.translate(fish.x,fish.y);ctx.rotate(fish.heading);

  const depthFade=1-fish.depth*.28;
  ctx.globalAlpha=.82*depthFade;

  ctx.save();ctx.translate(-26,0);ctx.rotate(wag*.38+yaw*.25);
  ctx.fillStyle="#e5ddd0";
  ctx.beginPath();ctx.moveTo(-3,0);ctx.quadraticCurveTo(-22,-13,-31,-17);ctx.quadraticCurveTo(-24,0,-31,17);ctx.quadraticCurveTo(-21,13,-3,0);ctx.fill();
  ctx.restore();

  const body=ctx.createLinearGradient(-28,-12,28,12);
  body.addColorStop(0,"#ece7de");body.addColorStop(.54,"#d8d0c5");body.addColorStop(1,"#b9b2a9");
  ctx.fillStyle=body;
  ctx.beginPath();ctx.moveTo(31,0);ctx.bezierCurveTo(18,-15,-8,-17,-29,-8);ctx.bezierCurveTo(-35,-4,-35,4,-29,8);ctx.bezierCurveTo(-8,17,18,15,31,0);ctx.fill();

  ctx.fillStyle="#b44f3e";ctx.globalAlpha=.72*depthFade;
  ctx.beginPath();ctx.ellipse(8,-5,11,5,-.25,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(-10,5,8,4,.4,0,Math.PI*2);ctx.fill();

  ctx.globalAlpha=.34*depthFade;ctx.fillStyle="#ddd8cf";
  ctx.beginPath();ctx.moveTo(-3,-10);ctx.quadraticCurveTo(3,-23,11,-19);ctx.quadraticCurveTo(9,-11,2,-5);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(-5,9);ctx.quadraticCurveTo(1,22,8,18);ctx.quadraticCurveTo(7,10,0,5);ctx.closePath();ctx.fill();

  ctx.globalAlpha=.92*depthFade;ctx.fillStyle="#141918";
  ctx.beginPath();ctx.arc(21,-4,1.8,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="rgba(240,238,225,.8)";ctx.lineWidth=.8;
  ctx.beginPath();ctx.moveTo(28,-3);ctx.quadraticCurveTo(35,-6,39,-9);ctx.stroke();
  ctx.beginPath();ctx.moveTo(28,3);ctx.quadraticCurveTo(35,6,39,9);ctx.stroke();

  ctx.restore();ctx.globalAlpha=1;
 }
}
function drawRipple(){
 if(!ripple||rippleLife<=0)return;
 ctx.globalAlpha=rippleLife*.42;ctx.strokeStyle="#e5f4ee";ctx.lineWidth=1.4;
 ctx.beginPath();ctx.ellipse(ripple.x,ripple.y,ripple.r*1.6,ripple.r*.55,0,0,Math.PI*2);ctx.stroke();
 ctx.globalAlpha=1;
}
function drawEdgePlants(L){
 ctx.strokeStyle=lightIndex===1?"#665d3d":"#405f42";ctx.lineWidth=3;
 for(let i=0;i<30;i++){
  const a=i/30*Math.PI*2;
  const x=pond.cx+Math.cos(a)*(pond.rx+16),y=pond.cy+Math.sin(a)*(pond.ry+15);
  const h=35+(i%7)*5;
  ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+Math.cos(a)*5,y-h*.55,x+Math.cos(a)*10,y-h);ctx.stroke();
 }
}
function drawVignette(){
 const g=ctx.createRadialGradient(W/2,H/2,H*.28,W/2,H/2,H*.76);
 g.addColorStop(.55,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(0,0,0,.25)");
 ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}

function drawPOV(){
 const L=lights[lightIndex];
 const depth=fish.depth;
 const horizon=H*(.34+depth*.10);
 const g=ctx.createLinearGradient(0,0,0,H);
 g.addColorStop(0,lightIndex===2?"#71847f":"#9fbeb2");
 g.addColorStop(horizon/H,lightIndex===1?"#688b7e":"#5f938a");
 g.addColorStop(1,"#1f3a35");
 ctx.fillStyle=g;ctx.fillRect(0,0,W,H);

 const rel=relativePondGeometry();
 drawPovFloor(rel,L,horizon);
 drawPovBoundary(rel,L,horizon);
 drawPovRocks(rel,L,horizon);
 drawPovLight(L,horizon);
 drawPovNose();
 drawVignette();
}
function relativePondGeometry(){
 const dx=fish.x-pond.cx,dy=fish.y-pond.cy;
 const nx=dx/pond.rx,ny=dy/pond.ry;
 const localX=nx*Math.cos(fish.heading)+ny*Math.sin(fish.heading);
 const localY=-nx*Math.sin(fish.heading)+ny*Math.cos(fish.heading);
 return{edge:clamp(normEdge(fish.x,fish.y),0,1.2),side:localY,forward:localX};
}
function projectWorld(wx,wy,baseY){
 const dx=wx-fish.x,dy=wy-fish.y;
 const c=Math.cos(-fish.heading),s=Math.sin(-fish.heading);
 const fx=dx*c-dy*s,fy=dx*s+dy*c;
 if(fx<8)return null;
 const scale=420/fx;
 return{x:W/2+fy*scale*.9,y:baseY+85*scale*.22,scale:clamp(scale*.055,.15,2.4),dist:fx};
}
function drawPovFloor(rel,L,horizon){
 const floor=ctx.createLinearGradient(0,horizon,0,H);
 floor.addColorStop(0,"rgba(31,67,60,.18)");floor.addColorStop(1,"rgba(45,62,49,.78)");
 ctx.fillStyle=floor;ctx.fillRect(0,horizon,W,H-horizon);
 ctx.strokeStyle="rgba(215,232,214,.07)";ctx.lineWidth=1;
 for(let i=0;i<11;i++){
  const y=horizon+Math.pow(i/10,1.7)*(H-horizon);
  ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
 }
}
function drawPovBoundary(rel,L,horizon){
 const samples=80,pts=[];
 for(let i=0;i<samples;i++){
  const a=i/(samples-1)*Math.PI*2;
  const wx=pond.cx+Math.cos(a)*pond.rx,wy=pond.cy+Math.sin(a)*pond.ry;
  const p=projectWorld(wx,wy,horizon);
  if(p&&p.dist<650)pts.push(p);
 }
 ctx.fillStyle=lightIndex===1?"rgba(86,76,49,.58)":"rgba(50,73,54,.58)";
 for(const p of pts){
  const h=clamp(28*p.scale,4,52);
  ctx.fillRect(p.x-2,p.y-h,4,h);
 }
}
function drawPovRocks(rel,L,horizon){
 const visible=[];
 for(const r of rocks){const p=projectWorld(r.x,r.y,horizon);if(p&&p.dist<520)visible.push({p,r})}
 visible.sort((a,b)=>b.p.dist-a.p.dist);
 for(const item of visible){
  const p=item.p,r=item.r;
  const rx=clamp(r.r*p.scale*.75,3,55),ry=rx*.48;
  const gg=ctx.createRadialGradient(p.x-rx*.25,p.y-ry*.25,1,p.x,p.y,rx);
  gg.addColorStop(0,"#89948a");gg.addColorStop(1,"#3a4941");
  ctx.globalAlpha=.68;ctx.fillStyle=gg;ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,r.t,0,Math.PI*2);ctx.fill();
 }
 ctx.globalAlpha=1;
}
function drawPovLight(L,horizon){
 const t=performance.now()*.001;
 ctx.globalAlpha=.06+.08*L.sun;ctx.strokeStyle="#f3fff8";ctx.lineWidth=2;
 for(let i=0;i<8;i++){
  const x=(i+1)*W/9+Math.sin(t*.45+i)*18;
  ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x-55+Math.sin(t+i)*18,horizon+120);ctx.stroke();
 }
 ctx.globalAlpha=1;
}
function drawPovNose(){
 const g=ctx.createLinearGradient(W/2-45,H,W/2+45,H-80);
 g.addColorStop(0,"rgba(213,207,198,.18)");g.addColorStop(.5,"rgba(237,232,224,.42)");g.addColorStop(1,"rgba(183,177,168,.18)");
 ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(W/2-38,H);ctx.quadraticCurveTo(W/2-25,H-54,W/2,H-66);ctx.quadraticCurveTo(W/2+25,H-54,W/2+38,H);ctx.closePath();ctx.fill();
}

enterButton.addEventListener("click",enter);
pauseButton.addEventListener("click",togglePause);
viewButton.addEventListener("click",cycleView);
lightButton.addEventListener("click",cycleLight);
attractButton.addEventListener("click",attractKoi);
canvas.addEventListener("pointerdown",e=>{
 if(!running||paused)return;
 const r=canvas.getBoundingClientRect();
 const sx=(e.clientX-r.left)/r.width*W,sy=(e.clientY-r.top)/r.height*H;
 if(viewMode!=="pov"){
   const wx=(sx-W/2)/cam.scale+cam.x,wy=(sy-H/2)/cam.scale+cam.y;
   if(inside(wx,wy,.95)){attract={x:wx,y:wy};attractTimer=7;ripple={x:wx,y:wy,r:4};rippleLife=1;fish.state="investigate";fish.stateTimer=5}
 }
});
window.addEventListener("blur",()=>{if(running&&!paused)togglePause()});

function frame(now){
 const dt=Math.max(0,Math.min(.035,(now-lastTime)/1000));
 lastTime=now;update(dt);draw();requestAnimationFrame(frame);
}
updateViewLabels();draw();requestAnimationFrame(frame);
})();