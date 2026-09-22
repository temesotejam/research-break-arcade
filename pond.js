(() => {
"use strict";
const canvas=document.getElementById("pondCanvas"),ctx=canvas.getContext("2d");
const intro=document.getElementById("intro"),enterButton=document.getElementById("enterButton");
const soundButton=document.getElementById("soundButton"),pauseButton=document.getElementById("pauseButton");
const viewButton=document.getElementById("viewButton"),viewLabel=document.getElementById("viewLabel");
const feedButton=document.getElementById("feedButton"),rainButton=document.getElementById("rainButton"),duskButton=document.getElementById("duskButton");
const dayPhaseText=document.getElementById("dayPhaseText"),weatherText=document.getElementById("weatherText"),visitorText=document.getElementById("visitorText");
const statusText=document.getElementById("statusText"),hintText=document.getElementById("hintText"),dayFill=document.getElementById("dayFill");
const messageBubble=document.getElementById("messageBubble"),povBadge=document.getElementById("povBadge");
const W=canvas.width,H=canvas.height,pond={cx:W*.5,cy:H*.58,rx:W*.39,ry:H*.30};
const lilyPads=[{x:W*.34,y:H*.48,r:34},{x:W*.56,y:H*.43,r:27},{x:W*.68,y:H*.61,r:31},{x:W*.44,y:H*.69,r:24},{x:W*.73,y:H*.42,r:22}];
const viewModes=["pond","fish","frog","dragonfly"];
let viewIndex=0,viewMode="pond",running=false,paused=false,lastTime=performance.now(),day=.24,rainTimer=0,feedCooldown=0,rainCooldown=0,soundOn=false,audioCtx=null,messageTimer=0,eventTimer=5;
const fish=[],ripples=[],feed=[],rainDrops=[],fireflies=[],bubbles=[];
const frog={pad:0,x:lilyPads[0].x,y:lilyPads[0].y-8,jumping:false,t:0,dur:1,sx:0,sy:0,tx:0,ty:0,timer:8};
const dragonfly={active:true,x:W*.28,y:H*.23,tx:W*.7,ty:H*.3,timer:2};
const turtle={active:false,x:W*.5,y:H*.6,timer:22,life:0};
let observation="水面が静かです。";
let cam={x:W/2,y:H/2,scale:1,angle:0,targetX:W/2,targetY:H/2,targetScale:1,targetAngle:0};

function rnd(a,b){return a+Math.random()*(b-a)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function inside(x,y,m=.9){const nx=(x-pond.cx)/(pond.rx*m),ny=(y-pond.cy)/(pond.ry*m);return nx*nx+ny*ny<=1}
function randomPond(s=.8){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*s;return{x:pond.cx+Math.cos(a)*pond.rx*r,y:pond.cy+Math.sin(a)*pond.ry*r}}
function init(){
 const colors=["#e2b58e","#d5ddd7","#d59c7a","#bfc9b5","#e2cf9d","#a9c7ca","#d7b2a6"];
 for(let i=0;i<8;i++){const p=randomPond(.76);fish.push({x:p.x,y:p.y,vx:rnd(-22,22),vy:rnd(-14,14),speed:rnd(18,31),size:rnd(.75,1.1),color:colors[i%colors.length],phase:Math.random()*6.28,timer:rnd(1,2.4)})}
 for(let i=0;i<16;i++)fireflies.push({x:rnd(70,W-70),y:rnd(80,H*.45),vx:rnd(-5,5),vy:rnd(-4,4),phase:Math.random()*6.28});
}
init();

function enter(){running=true;intro.hidden=true;showMessage("しばらく、何もしなくて大丈夫です。")}
function togglePause(){if(!running)return;paused=!paused;pauseButton.textContent=paused?"RESUME":"PAUSE";pauseButton.setAttribute("aria-pressed",paused?"true":"false")}
function cycleView(){if(!running)return;viewIndex=(viewIndex+1)%viewModes.length;viewMode=viewModes[viewIndex];if(viewMode==="dragonfly"&&!dragonfly.active){day=.48;dragonfly.active=true}showMessage(viewMode==="pond"?"池全体を眺めます。":viewMode==="fish"?"魚の目線へ。":viewMode==="frog"?"葉の上の目線へ。":"トンボの目線へ。");updateViewLabel()}
function updateViewLabel(){const label={pond:"POND VIEW",fish:"FISH POV",frog:"FROG POV",dragonfly:"DRAGONFLY POV"}[viewMode];povBadge.textContent=label;viewLabel.textContent=label}
function feedPond(){if(!running||paused||feedCooldown>0)return;const c=randomPond(.45);for(let i=0;i<20;i++)feed.push({x:c.x+rnd(-20,20),y:c.y+rnd(-10,10),life:rnd(7,11),r:rnd(1,2.2)});feedCooldown=4;addRipple(c.x,c.y,4,1);observation="魚たちが餌に気づきました。";showMessage("ぱらぱら、と餌。");tone(430,.05,.012)}
function rain(){if(!running||paused||rainCooldown>0)return;rainTimer=13;rainCooldown=23;weatherText.textContent="Soft rain";observation="細い雨が水面を叩いています。";showMessage("少しだけ、雨。")}
function dusk(){if(!running||paused)return;day=day<.72?.67:.86;showMessage(day<.8?"空が紫色になってきた。":"ホタルの時間です。")}
function addRipple(x,y,r=2,s=1){ripples.push({x,y,r,life:1,s});if(ripples.length>50)ripples.shift()}
function showMessage(t){messageBubble.textContent=t;messageBubble.hidden=false;messageTimer=3}
function tap(clientX,clientY){if(!running||paused)return;const rect=canvas.getBoundingClientRect(),sx=(clientX-rect.left)/rect.width*W,sy=(clientY-rect.top)/rect.height*H;const p=screenToWorld(sx,sy);if(!inside(p.x,p.y,1))return;addRipple(p.x,p.y,3,1);observation="魚が波紋の様子を見に来ています。";for(const f of fish){const dx=p.x-f.x,dy=p.y-f.y,d=Math.hypot(dx,dy);if(d<220&&d>1){f.vx+=dx/d*8;f.vy+=dy/d*8}}}

function update(dt,now){
 if(!running||paused)return;
 day=(day+dt/260)%1;rainTimer=Math.max(0,rainTimer-dt);rainCooldown=Math.max(0,rainCooldown-dt);feedCooldown=Math.max(0,feedCooldown-dt);
 if(rainTimer<=0)weatherText.textContent="Calm";
 if(messageTimer>0&&(messageTimer-=dt)<=0)messageBubble.hidden=true;
 eventTimer-=dt;
 updateFish(dt,now);updateFrog(dt);updateDragonfly(dt,now);updateTurtle(dt);updateFeed(dt);updateRain(dt);updateRipples(dt);updateFireflies(dt,now);updateBubbles(dt);
 if(eventTimer<=0){smallEvent();eventTimer=rnd(6,12)}
 updateCamera(dt);updateLabels();
}
function updateFish(dt,now){
 for(let i=0;i<fish.length;i++){const f=fish[i];f.timer-=dt;let ax=0,ay=0,near=null,nd=1e9;
  for(const p of feed){const d=Math.hypot(p.x-f.x,p.y-f.y);if(d<nd){nd=d;near=p}}
  if(near&&nd<240){ax+=(near.x-f.x)/Math.max(1,nd)*18;ay+=(near.y-f.y)/Math.max(1,nd)*18}
  else if(f.timer<=0){const a=Math.random()*6.28;ax+=Math.cos(a)*12;ay+=Math.sin(a)*8;f.timer=rnd(.9,2.3)}
  const nx=(f.x-pond.cx)/(pond.rx*.77),ny=(f.y-pond.cy)/(pond.ry*.77);if(nx*nx+ny*ny>.72){ax+=(pond.cx-f.x)*.15;ay+=(pond.cy-f.y)*.15}
  f.vx+=ax*dt;f.vy+=ay*dt;let sp=Math.hypot(f.vx,f.vy),mx=f.speed+(near&&nd<120?8:0);if(sp>mx){f.vx=f.vx/sp*mx;f.vy=f.vy/sp*mx}
  f.x+=f.vx*dt;f.y+=f.vy*dt;if(!inside(f.x,f.y,.88)){f.vx+=(pond.cx-f.x)*.06;f.vy+=(pond.cy-f.y)*.06}
  if(Math.random()<dt*.04)bubbles.push({x:f.x,y:f.y,life:1,r:rnd(1,2)})
 }
}
function updateFrog(dt){frog.timer-=dt;if(!frog.jumping&&frog.timer<=0){let n=frog.pad;while(n===frog.pad)n=Math.floor(Math.random()*lilyPads.length);const p=lilyPads[n];frog.jumping=true;frog.t=0;frog.dur=rnd(.7,1);frog.sx=frog.x;frog.sy=frog.y;frog.tx=p.x;frog.ty=p.y-8;frog.next=n;frog.timer=rnd(8,16);observation="カエルが別の葉へ移りました。";if(Math.random()<.5)showMessage("ぴょん。")}
 if(frog.jumping){frog.t+=dt/frog.dur;const t=clamp(frog.t,0,1);frog.x=frog.sx+(frog.tx-frog.sx)*t;frog.y=frog.sy+(frog.ty-frog.sy)*t-Math.sin(t*Math.PI)*36;if(t>=1){frog.jumping=false;frog.pad=frog.next}}}
function updateDragonfly(dt,now){const daylight=getLight()>.48;dragonfly.active=daylight&&rainTimer<=0;if(!dragonfly.active)return;dragonfly.timer-=dt;if(dragonfly.timer<=0||Math.hypot(dragonfly.tx-dragonfly.x,dragonfly.ty-dragonfly.y)<12){dragonfly.tx=rnd(W*.16,W*.84);dragonfly.ty=rnd(H*.15,H*.40);dragonfly.timer=rnd(2,4.5)}dragonfly.x+=(dragonfly.tx-dragonfly.x)*dt*.55;dragonfly.y+=(dragonfly.ty-dragonfly.y)*dt*.55+Math.sin(now*.014)*.1}
function updateTurtle(dt){turtle.timer-=dt;if(!turtle.active&&turtle.timer<=0){const p=randomPond(.45);turtle.x=p.x;turtle.y=p.y;turtle.active=true;turtle.life=rnd(4,7);observation="カメが少しだけ顔を出しました。";showMessage("……カメ。")}if(turtle.active&&(turtle.life-=dt)<=0){turtle.active=false;turtle.timer=rnd(22,40);addRipple(turtle.x,turtle.y,4,.6)}}
function updateFeed(dt){for(let i=feed.length-1;i>=0;i--){const p=feed[i];p.life-=dt;if(p.life<=0){feed.splice(i,1);continue}for(const f of fish){if(Math.hypot(f.x-p.x,f.y-p.y)<12){feed.splice(i,1);break}}}}
function updateRain(dt){if(rainTimer<=0)return;for(let i=0;i<6;i++)rainDrops.push({x:Math.random()*W,y:rnd(-30,H*.7),vy:rnd(250,390)});for(let i=rainDrops.length-1;i>=0;i--){const r=rainDrops[i];r.y+=r.vy*dt;if(r.y>H*.82){if(inside(r.x,r.y,1)&&Math.random()<.5)addRipple(r.x,r.y,1,.25);rainDrops.splice(i,1)}}}
function updateRipples(dt){for(let i=ripples.length-1;i>=0;i--){const r=ripples[i];r.r+=dt*(22+15*r.s);r.life-=dt*.48;if(r.life<=0)ripples.splice(i,1)}}
function updateFireflies(dt,now){for(const f of fireflies){f.vx+=Math.sin(now*.001+f.phase)*dt;f.vy+=Math.cos(now*.0012+f.phase)*dt*.8;f.x+=f.vx*dt;f.y+=f.vy*dt;if(f.x<50||f.x>W-50)f.vx*=-1;if(f.y<60||f.y>H*.48)f.vy*=-1}}
function updateBubbles(dt){for(let i=bubbles.length-1;i>=0;i--){const b=bubbles[i];b.life-=dt*.6;b.y-=dt*5;if(b.life<=0)bubbles.splice(i,1)}}
function smallEvent(){const n=getNight(),r=Math.random();if(n>.5&&r<.5)observation="ホタルが水辺をゆっくり横切っています。";else if(dragonfly.active&&r<.45)observation="トンボが水面を低く横切りました。";else if(r<.7){const p=randomPond(.7);addRipple(p.x,p.y,2,.4);observation="どこかで小さく、水が跳ねました。"}else observation="魚たちはそれぞれ好きな場所を泳いでいます。"}
function getLight(){const a=day*Math.PI*2;return clamp(.25+.75*Math.max(0,Math.sin(a)),.18,1)}
function getNight(){return clamp((.58-getLight())/.4,0,1)}
function phaseName(){if(day<.08)return"Deep night";if(day<.22)return"Early morning";if(day<.46)return"Quiet afternoon";if(day<.66)return"Late afternoon";if(day<.78)return"Dusk";if(day<.92)return"Firefly night";return"Deep night"}
function updateLabels(){dayPhaseText.textContent=phaseName();dayFill.style.width=Math.round(day*100)+"%";statusText.textContent=observation;const n=getNight();visitorText.textContent=rainTimer>0?"Fish stay a little deeper.":n>.55?"Fireflies are out.":dragonfly.active?"A dragonfly is visiting.":"The pond is quiet."}

function updateCamera(dt){
 let tx=W/2,ty=H/2,ts=1,ta=0;
 if(viewMode==="fish"){const f=fish[0];tx=f.x;ty=f.y;ts=2.15;ta=-(Math.atan2(f.vy,f.vx)-Math.PI/2)}
 else if(viewMode==="frog"){tx=frog.x;ty=frog.y;ts=2;ta=0}
 else if(viewMode==="dragonfly"){tx=dragonfly.x;ty=dragonfly.y;ts=1.45;ta=0}
 cam.targetX=tx;cam.targetY=ty;cam.targetScale=ts;cam.targetAngle=ta;
 cam.x+=(tx-cam.x)*Math.min(1,dt*3.2);cam.y+=(ty-cam.y)*Math.min(1,dt*3.2);cam.scale+=(ts-cam.scale)*Math.min(1,dt*3);let da=ta-cam.angle;while(da>Math.PI)da-=Math.PI*2;while(da<-Math.PI)da+=Math.PI*2;cam.angle+=da*Math.min(1,dt*2.5)
}
function applyCamera(){ctx.translate(W/2,H/2);ctx.scale(cam.scale,cam.scale);ctx.rotate(cam.angle);ctx.translate(-cam.x,-cam.y)}
function screenToWorld(sx,sy){let x=(sx-W/2)/cam.scale,y=(sy-H/2)/cam.scale;const c=Math.cos(-cam.angle),s=Math.sin(-cam.angle);const rx=x*c-y*s,ry=x*s+y*c;return{x:rx+cam.x,y:ry+cam.y}}

function draw(){const l=getLight(),n=getNight();drawSky(l,n);ctx.save();applyCamera();drawBank(l);drawPond(l,n);drawRipples();drawLilies(l);drawFeed();drawFish();drawBubbles();drawTurtle(l);drawFrog(l);drawDragonfly();drawReeds(l);ctx.restore();drawFireflies(n);drawRain();drawPovOverlay(n)}
function drawSky(l,n){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,n>.5?"#171d35":"#385943");g.addColorStop(1,n>.5?"#263c48":"#78966c");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);if(n>.3){ctx.globalAlpha=n*.7;ctx.fillStyle="#ebe7ca";ctx.beginPath();ctx.arc(W*.82,H*.14,24,0,6.28);ctx.fill();ctx.globalAlpha=1}}
function drawBank(l){ctx.fillStyle=l>.5?"#536d42":"#2e4437";ctx.beginPath();ctx.ellipse(pond.cx,pond.cy,pond.rx+70,pond.ry+62,0,0,6.28);ctx.fill();ctx.fillStyle=l>.5?"#3e5939":"#283b33";ctx.beginPath();ctx.ellipse(pond.cx,pond.cy,pond.rx+30,pond.ry+26,0,0,6.28);ctx.fill()}
function drawPond(l,n){const g=ctx.createRadialGradient(pond.cx-80,pond.cy-60,20,pond.cx,pond.cy,pond.rx);g.addColorStop(0,n>.5?"#365c6a":"#57908a");g.addColorStop(1,n>.5?"#1e3349":"#285f5d");ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(pond.cx,pond.cy,pond.rx,pond.ry,0,0,6.28);ctx.fill()}
function drawRipples(){for(const r of ripples){ctx.globalAlpha=Math.max(0,r.life)*.45;ctx.strokeStyle="#d9eeea";ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(r.x,r.y,r.r*1.6,r.r*.55,0,0,6.28);ctx.stroke()}ctx.globalAlpha=1}
function drawLilies(l){for(const p of lilyPads){ctx.fillStyle=l>.5?"#547a48":"#39594b";ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.28);ctx.lineTo(p.x,p.y);ctx.arc(p.x,p.y,p.r,-.25,.25);ctx.closePath();ctx.fill()}}
function drawFeed(){ctx.fillStyle="#d9bb78";for(const p of feed){ctx.globalAlpha=clamp(p.life/3,0,.75);ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.28);ctx.fill()}ctx.globalAlpha=1}
function drawFish(){for(let i=0;i<fish.length;i++){const f=fish[i];if(viewMode==="fish"&&i===0)continue;const a=Math.atan2(f.vy,f.vx),s=12*f.size;ctx.save();ctx.translate(f.x,f.y);ctx.rotate(a);ctx.globalAlpha=.68;ctx.fillStyle=f.color;ctx.beginPath();ctx.ellipse(0,0,s,s*.42,0,0,6.28);ctx.fill();ctx.beginPath();ctx.moveTo(-s*.85,0);ctx.lineTo(-s*1.4,-s*.45);ctx.lineTo(-s*1.4,s*.45);ctx.closePath();ctx.fill();ctx.restore()}ctx.globalAlpha=1}
function drawBubbles(){ctx.strokeStyle="rgba(224,245,243,.44)";for(const b of bubbles){ctx.globalAlpha=Math.max(0,b.life);ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,6.28);ctx.stroke()}ctx.globalAlpha=1}
function drawFrog(l){if(viewMode==="frog")return;ctx.fillStyle=l>.5?"#7ba85e":"#557957";ctx.beginPath();ctx.ellipse(frog.x,frog.y,12,8,0,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(frog.x-6,frog.y-7,5,0,6.28);ctx.arc(frog.x+6,frog.y-7,5,0,6.28);ctx.fill()}
function drawDragonfly(){if(!dragonfly.active||viewMode==="dragonfly")return;ctx.save();ctx.translate(dragonfly.x,dragonfly.y);ctx.strokeStyle="rgba(199,233,231,.55)";ctx.beginPath();ctx.ellipse(-2,-3,10,3,-.4,0,6.28);ctx.ellipse(-2,3,10,3,.4,0,6.28);ctx.stroke();ctx.strokeStyle="#486c67";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(8,0);ctx.stroke();ctx.restore()}
function drawTurtle(l){if(!turtle.active)return;ctx.globalAlpha=.65;ctx.fillStyle=l>.5?"#617d57":"#445d50";ctx.beginPath();ctx.ellipse(turtle.x,turtle.y,18,12,.2,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(turtle.x+18,turtle.y,6,0,6.28);ctx.fill();ctx.globalAlpha=1}
function drawReeds(l){ctx.strokeStyle=l>.5?"#526f45":"#3a5144";ctx.lineWidth=3;for(let i=0;i<28;i++){const a=i/28*6.28,x=pond.cx+Math.cos(a)*(pond.rx+25),y=pond.cy+Math.sin(a)*(pond.ry+20);ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+Math.cos(a)*8,y-24,x+Math.cos(a)*14,y-52-rnd(0,18));ctx.stroke()}}
function drawFireflies(n){if(n<=.18)return;for(const f of fireflies){ctx.globalAlpha=n*(.35+.65*(.5+.5*Math.sin(f.phase+performance.now()*.004)));ctx.fillStyle="#fff3a2";ctx.beginPath();ctx.arc(f.x,f.y,2.2,0,6.28);ctx.fill()}ctx.globalAlpha=1}
function drawRain(){if(rainTimer<=0)return;ctx.strokeStyle="rgba(210,230,236,.32)";ctx.lineWidth=1;for(const r of rainDrops){ctx.beginPath();ctx.moveTo(r.x,r.y);ctx.lineTo(r.x-3,r.y+10);ctx.stroke()}}
function drawPovOverlay(n){if(viewMode==="fish"){ctx.fillStyle="rgba(22,77,84,.15)";ctx.fillRect(0,0,W,H);ctx.fillStyle="rgba(255,255,255,.35)";ctx.beginPath();ctx.moveTo(W/2,H*.91);ctx.lineTo(W*.47,H);ctx.lineTo(W*.53,H);ctx.closePath();ctx.fill()}else if(viewMode==="frog"){ctx.fillStyle="rgba(34,66,38,.10)";ctx.fillRect(0,0,W,H)}else if(viewMode==="dragonfly"){ctx.fillStyle="rgba(220,235,255,.06)";ctx.fillRect(0,0,W,H)}}

function tone(freq,dur,vol){if(!soundOn)return;if(!audioCtx){const AC=window.AudioContext||window.webkitAudioContext;if(AC)audioCtx=new AC()}if(!audioCtx)return;try{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type="sine";o.frequency.value=freq;g.gain.value=vol;o.connect(g).connect(audioCtx.destination);o.start();g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+dur);o.stop(audioCtx.currentTime+dur)}catch(_){}}

enterButton.addEventListener("click",enter);pauseButton.addEventListener("click",togglePause);viewButton.addEventListener("click",cycleView);feedButton.addEventListener("click",feedPond);rainButton.addEventListener("click",rain);duskButton.addEventListener("click",dusk);
soundButton.addEventListener("click",()=>{soundOn=!soundOn;soundButton.textContent=soundOn?"SOUND ON":"SOUND OFF";soundButton.setAttribute("aria-pressed",soundOn?"true":"false");tone(620,.05,.01)});
canvas.addEventListener("pointerdown",e=>{e.preventDefault();tap(e.clientX,e.clientY)});
window.addEventListener("blur",()=>{if(running&&!paused)togglePause()});
function frame(now){const dt=Math.max(0,Math.min(.035,(now-lastTime)/1000));lastTime=now;update(dt,now);draw();requestAnimationFrame(frame)}
draw();requestAnimationFrame(frame);
})();