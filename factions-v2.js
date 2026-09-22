(() => {
"use strict";

const $=id=>document.getElementById(id);
const canvas=$("simCanvas"),ctx=canvas.getContext("2d");
const newWarButton=$("newWarButton"),speedButton=$("speedButton");
const timeText=$("timeText"),controlText=$("controlText"),unitsText=$("unitsText"),statusText=$("statusText");
const battleLog=$("battleLog");
const emberDoctrine=$("emberDoctrine"),azureDoctrine=$("azureDoctrine");
const emberTraits=$("emberTraits"),azureTraits=$("azureTraits");
const emberThought=$("emberThought"),azureThought=$("azureThought");
const emberMemory=$("emberMemory"),azureMemory=$("azureMemory");

const W=960,H=600;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=(a,b)=>a+Math.random()*(b-a);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const FACTION_COLORS={EMBER:"#e3644e",AZURE:"#5aa0e8"};
const DOCTRINES=["ATTACK","DEFEND","EXPAND","RAID","REGROUP"];

let running=false,last=performance.now(),simTime=0,timeScale=1,logs=[];
let nodes=[],units=[],factions={};

function traitSet(name){
  const aggression=rnd(.30,.90),caution=rnd(.28,.88),coordination=rnd(.35,.92),logistics=rnd(.30,.92),adaptability=rnd(.25,.95);
  return{
    name,
    aggression,caution,coordination,logistics,adaptability,
    supply:30,score:0,doctrine:"EXPAND",thought:"初期配置を確認中",
    memory:"適応履歴なし",nextThink:0,recentLosses:0,kills:0,losses:0,
    doctrineBias:{ATTACK:0,DEFEND:0,EXPAND:0,RAID:0,REGROUP:0},
    lastEval:{control:0,kills:0,losses:0},
    base:name==="EMBER"?{x:70,y:H/2}:{x:W-70,y:H/2},
    spawnTimer:0
  };
}

function reset(){
  simTime=0;logs=[];units=[];nodes=[];
  factions={EMBER:traitSet("EMBER"),AZURE:traitSet("AZURE")};
  createNodes();
  for(let i=0;i<18;i++){spawnUnit("EMBER",true);spawnUnit("AZURE",true)}
  factions.EMBER.supply=20;factions.AZURE.supply=20;
  renderTraits();log("new simulation · two new personalities");
  running=true;statusText.textContent="RUNNING";updateUI();
}

function createNodes(){
  const positions=[
    [W*.22,H*.25],[W*.22,H*.75],[W*.38,H*.50],
    [W*.50,H*.22],[W*.50,H*.78],[W*.62,H*.50],
    [W*.78,H*.25],[W*.78,H*.75]
  ];
  nodes=positions.map((p,i)=>({id:i,x:p[0],y:p[1],owner:null,capture:0,value:i===2||i===5?1.4:1}));
}

function spawnUnit(side,free=false){
  const f=factions[side];if(!f)return;
  const cost=6;if(!free&&f.supply<cost)return false;
  if(!free)f.supply-=cost;
  const roleRoll=Math.random();
  let role="LINE";
  if(roleRoll<.18+.12*(1-f.aggression))role="SCOUT";
  else if(roleRoll>.82-.14*f.coordination)role="SUPPORT";
  units.push({
    side,role,x:f.base.x+rnd(-12,12),y:f.base.y+rnd(-38,38),
    vx:0,vy:0,hp:role==="LINE"?100:(role==="SCOUT"?70:85),
    maxHp:role==="LINE"?100:(role==="SCOUT"?70:85),target:null,mode:"IDLE",
    think:rnd(.15,.7),cooldown:0,knownEnemy:null
  });
  return true;
}

function renderTraits(){
  for(const side of ["EMBER","AZURE"]){
    const f=factions[side],el=side==="EMBER"?emberTraits:azureTraits;
    const traits=[
      ["AGGRESSION",f.aggression],["CAUTION",f.caution],["COORDINATION",f.coordination],
      ["LOGISTICS",f.logistics],["ADAPTABILITY",f.adaptability]
    ];
    el.innerHTML=traits.map(([n,v])=>'<div class="trait"><span>'+n+'</span><div class="bar"><i style="width:'+Math.round(v*100)+'%"></i></div><b>'+Math.round(v*100)+'</b></div>').join("");
  }
}

function log(msg){
  logs.unshift(msg);if(logs.length>8)logs.length=8;
  battleLog.innerHTML=logs.map(x=>"<span>"+x+"</span>").join("");
}

function ownedNodes(side){return nodes.filter(n=>n.owner===side).length}
function living(side){return units.filter(u=>u.side===side&&u.hp>0)}
function enemies(side){return living(side==="EMBER"?"AZURE":"EMBER")}
function enemySide(side){return side==="EMBER"?"AZURE":"EMBER"}

function strategicMetrics(side){
  const f=factions[side],enemy=factions[enemySide(side)];
  const own=living(side),foe=living(enemySide(side));
  const nearBase=foe.filter(u=>Math.hypot(u.x-f.base.x,u.y-f.base.y)<150).length;
  const armyRatio=own.length/Math.max(1,foe.length);
  const nodeRatio=ownedNodes(side)/Math.max(1,nodes.length);
  const enemyNodeRatio=ownedNodes(enemySide(side))/Math.max(1,nodes.length);
  const hurt=own.filter(u=>u.hp/u.maxHp<.45).length/Math.max(1,own.length);
  return{nearBase,armyRatio,nodeRatio,enemyNodeRatio,hurt,supply:f.supply};
}

function thinkFaction(side){
  const f=factions[side],m=strategicMetrics(side);
  const u={};
  u.ATTACK=38+f.aggression*42+(m.armyRatio-1)*24+m.nodeRatio*9-f.caution*m.hurt*26;
  u.DEFEND=24+f.caution*35+m.nearBase*9+(1-m.armyRatio)*22+f.coordination*8;
  u.EXPAND=30+f.logistics*27+(1-m.nodeRatio-m.enemyNodeRatio)*32+f.coordination*10;
  u.RAID=18+f.aggression*18+f.adaptability*15+(m.armyRatio>.85?8:0)+f.coordination*8;
  u.REGROUP=12+f.caution*24+m.hurt*42+(1-m.armyRatio)*30+(f.supply>18?8:0);
  for(const d of DOCTRINES)u[d]+=f.doctrineBias[d]||0;

  const old=f.doctrine;
  f.doctrine=DOCTRINES.slice().sort((a,b)=>u[b]-u[a])[0];
  if(old!==f.doctrine)log(side.toLowerCase()+" doctrine · "+old+" → "+f.doctrine);

  const reasons={
    ATTACK:"戦力優勢を利用して敵陣へ圧力をかける",
    DEFEND:"自陣への圧力を優先して防衛線を形成する",
    EXPAND:"中立拠点を確保して補給基盤を広げる",
    RAID:"正面衝突を避け、薄い拠点を狙う",
    REGROUP:"損耗を抑えて味方の密度を戻す"
  };
  f.thought=reasons[f.doctrine];

  const control=ownedNodes(side),deltaControl=control-f.lastEval.control;
  const deltaKills=f.kills-f.lastEval.kills,deltaLosses=f.losses-f.lastEval.losses;
  const reward=deltaControl*1.4+deltaKills*.35-deltaLosses*.42;
  if(Math.abs(reward)>.2){
    const learn=reward*f.adaptability*1.8;
    f.doctrineBias[old]=clamp((f.doctrineBias[old]||0)+learn,-12,12);
    f.memory=(reward>=0?"成功":"失敗")+"から学習 · "+old+" bias "+(f.doctrineBias[old]>=0?"+":"")+f.doctrineBias[old].toFixed(1);
  }
  f.lastEval={control,kills:f.kills,losses:f.losses};
  f.nextThink=simTime+rnd(1.8,3.6)*(1.25-f.adaptability*.35);
}

function nearest(arr,u){let best=null,bd=Infinity;for(const x of arr){const d=Math.hypot(x.x-u.x,x.y-u.y);if(d<bd){bd=d;best=x}}return best}
function weakestEnemyNode(side){
  const targetSide=enemySide(side);
  const candidates=nodes.filter(n=>n.owner===targetSide);
  if(!candidates.length)return null;
  candidates.sort((a,b)=>nearbyStrength(side,a,90)-nearbyStrength(side,b,90));
  return candidates[0];
}
function nearbyStrength(side,p,r){
  return living(side).filter(u=>Math.hypot(u.x-p.x,u.y-p.y)<r).reduce((s,u)=>s+(u.hp/u.maxHp)*(u.role==="LINE"?1.15:(u.role==="SUPPORT"?.85:.70)),0);
}

function assignUnit(u){
  const f=factions[u.side],foe=enemies(u.side),enemy=factions[enemySide(u.side)];
  const hp=u.hp/u.maxHp;
  if(hp<.25+.25*f.caution){u.mode="RETREAT";u.target=f.base;return}

  if(u.role==="SUPPORT"&&f.coordination>.55){
    const wounded=living(u.side).filter(x=>x!==u&&x.hp/x.maxHp<.65);
    if(wounded.length){u.mode="SUPPORT";u.target=nearest(wounded,u);return}
  }

  if(f.doctrine==="DEFEND"){
    const threats=foe.filter(e=>Math.hypot(e.x-f.base.x,e.y-f.base.y)<220);
    u.mode=threats.length?"INTERCEPT":"GUARD";
    u.target=threats.length?nearest(threats,u):f.base;return;
  }

  if(f.doctrine==="EXPAND"){
    const neutral=nodes.filter(n=>n.owner!==u.side);
    u.mode="CAPTURE";u.target=neutral.length?nearest(neutral,u):enemy.base;return;
  }

  if(f.doctrine==="RAID"){
    const weak=weakestEnemyNode(u.side);
    u.mode="RAID";u.target=weak||enemy.base;return;
  }

  if(f.doctrine==="REGROUP"){
    const anchor=ownedNodes(u.side).length?nearest(nodes.filter(n=>n.owner===u.side),u):f.base;
    u.mode="REGROUP";u.target=anchor;return;
  }

  // ATTACK
  const enemyNodes=nodes.filter(n=>n.owner===enemySide(u.side));
  u.mode="ATTACK";u.target=enemyNodes.length?nearest(enemyNodes,u):enemy.base;
}

function updateUnit(u,dt){
  if(u.hp<=0)return;
  u.think-=dt;u.cooldown=Math.max(0,u.cooldown-dt);
  if(u.think<=0){assignUnit(u);u.think=rnd(.35,.85)}

  const foes=enemies(u.side);
  const close=foes.filter(e=>Math.hypot(e.x-u.x,e.y-u.y)<(u.role==="SCOUT"?55:48));
  if(close.length&&u.mode!=="RETREAT"){
    const e=nearest(close,u);
    u.knownEnemy=e;
    const d=dist(u,e);
    if(d<18){
      const coordination=factions[u.side].coordination;
      const friends=nearbyStrength(u.side,u,45),enemyStr=nearbyStrength(enemySide(u.side),u,45);
      const damage=(u.role==="LINE"?17:(u.role==="SCOUT"?9:7))*(.85+coordination*.30)*(friends>=enemyStr?1.08:.92)*dt;
      e.hp-=damage;
      u.vx*=.55;u.vy*=.55;
      return;
    }
    if(factions[u.side].aggression>.45||u.mode==="INTERCEPT"){u.target=e}
  }

  if(u.role==="SUPPORT"){
    const ally=living(u.side).filter(a=>a!==u&&a.hp<a.maxHp&&dist(a,u)<30).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
    if(ally){ally.hp=Math.min(ally.maxHp,ally.hp+7*dt*(.6+factions[u.side].coordination));}
  }

  const t=u.target;if(!t)return;
  let dx=t.x-u.x,dy=t.y-u.y,d=Math.hypot(dx,dy)||1;
  let speed=u.role==="SCOUT"?48:(u.role==="SUPPORT"?34:38);
  if(u.mode==="RETREAT")speed*=1.18;
  if(u.mode==="REGROUP")speed*=.88;
  dx/=d;dy/=d;

  // Cohesion is stronger for coordinated factions.
  const friends=living(u.side).filter(a=>a!==u&&dist(a,u)<55);
  if(friends.length&&factions[u.side].coordination>.45){
    let cx=0,cy=0;for(const a of friends){cx+=a.x;cy+=a.y}cx/=friends.length;cy/=friends.length;
    const cd=Math.hypot(cx-u.x,cy-u.y)||1;
    const pull=(factions[u.side].coordination-.4)*.30;
    dx=dx*(1-pull)+(cx-u.x)/cd*pull;dy=dy*(1-pull)+(cy-u.y)/cd*pull;
  }

  u.vx+=(dx*speed-u.vx)*Math.min(1,dt*4);
  u.vy+=(dy*speed-u.vy)*Math.min(1,dt*4);
  u.x=clamp(u.x+u.vx*dt,18,W-18);u.y=clamp(u.y+u.vy*dt,18,H-18);
}

function resolveDeaths(){
  for(const u of units){
    if(u.hp>0)continue;
    if(u.deadCounted)continue;
    u.deadCounted=true;
    factions[u.side].losses++;factions[enemySide(u.side)].kills++;
  }
  units=units.filter(u=>u.hp>0);
}

function updateNodes(dt){
  for(const n of nodes){
    const e=nearbyStrength("EMBER",n,48),a=nearbyStrength("AZURE",n,48);
    if(Math.abs(e-a)<.15){n.capture*=Math.max(0,1-dt*.8);continue}
    const winner=e>a?"EMBER":"AZURE",power=Math.abs(e-a);
    if(n.owner===winner){n.capture=Math.max(0,n.capture-dt*1.6);continue}
    n.capture+=(winner==="EMBER"?1:-1)*dt*power*.38;
    if(n.capture>3.5){n.owner="EMBER";n.capture=0;log("ember captured node "+n.id)}
    else if(n.capture<-3.5){n.owner="AZURE";n.capture=0;log("azure captured node "+n.id)}
  }
}

function updateEconomy(dt){
  for(const side of ["EMBER","AZURE"]){
    const f=factions[side],income=(1+ownedNodes(side)*.72)*(0.72+f.logistics*.55);
    f.supply+=income*dt;
    f.spawnTimer-=dt;
    const maxUnits=24+Math.round(f.logistics*10);
    if(f.spawnTimer<=0&&living(side).length<maxUnits&&f.supply>=6){
      spawnUnit(side,false);f.spawnTimer=rnd(1.7,3.3)*(1.15-f.logistics*.25);
    }
  }
}

function checkEnd(){
  for(const side of ["EMBER","AZURE"]){
    const enemy=enemySide(side),base=factions[enemy].base;
    const pressure=nearbyStrength(side,base,62),def=nearbyStrength(enemy,base,62);
    if(pressure>5.4&&pressure>def*1.6&&living(enemy).length<8){
      statusText.textContent=side+" DOMINANT";running=false;log(side.toLowerCase()+" broke the opposing command area");
    }
  }
}

function update(dt){
  simTime+=dt;
  for(const side of ["EMBER","AZURE"])if(simTime>=factions[side].nextThink)thinkFaction(side);
  for(const u of units)updateUnit(u,dt);
  resolveDeaths();updateNodes(dt);updateEconomy(dt);checkEnd();
}

function drawGrid(){
  ctx.fillStyle="#0c0e12";ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="#14171d";ctx.lineWidth=1;
  for(let x=0;x<W;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
  for(let y=0;y<H;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
}

function drawInfluence(){
  for(const n of nodes){
    if(!n.owner)continue;
    const c=n.owner==="EMBER"?"rgba(227,100,78,.055)":"rgba(90,160,232,.055)";
    ctx.fillStyle=c;ctx.beginPath();ctx.arc(n.x,n.y,78,0,Math.PI*2);ctx.fill();
  }
}

function drawBases(){
  for(const side of ["EMBER","AZURE"]){
    const f=factions[side],c=FACTION_COLORS[side];
    ctx.fillStyle=c;ctx.fillRect(f.base.x-7,f.base.y-18,14,36);
    ctx.strokeStyle="#fff";ctx.globalAlpha=.28;ctx.strokeRect(f.base.x-10,f.base.y-24,20,48);ctx.globalAlpha=1;
  }
}

function drawNodes(){
  for(const n of nodes){
    ctx.strokeStyle=n.owner?FACTION_COLORS[n.owner]:"#d0bd72";ctx.lineWidth=2;ctx.strokeRect(n.x-6,n.y-6,12,12);
    if(n.owner){ctx.fillStyle=FACTION_COLORS[n.owner];ctx.globalAlpha=.32;ctx.fillRect(n.x-4,n.y-4,8,8);ctx.globalAlpha=1}
    if(Math.abs(n.capture)>.1){
      ctx.fillStyle=n.capture>0?FACTION_COLORS.EMBER:FACTION_COLORS.AZURE;
      const w=clamp(Math.abs(n.capture)/3.5*18,0,18);ctx.fillRect(n.x-9,n.y+9,w,2);
    }
  }
}

function drawUnits(){
  for(const u of units){
    const c=FACTION_COLORS[u.side],size=u.role==="LINE"?4:(u.role==="SCOUT"?3:5);
    ctx.fillStyle=c;ctx.fillRect(Math.round(u.x-size/2),Math.round(u.y-size/2),size,size);
    if(u.role==="SUPPORT"){ctx.strokeStyle=c;ctx.strokeRect(Math.round(u.x-4),Math.round(u.y-4),8,8)}
    if(u.hp/u.maxHp<.45){ctx.fillStyle="#0a0b0d";ctx.fillRect(u.x-4,u.y-7,8,2);ctx.fillStyle=c;ctx.fillRect(u.x-4,u.y-7,8*u.hp/u.maxHp,2)}
  }
}

function drawLabels(){
  ctx.fillStyle="#848a96";ctx.font="9px ui-monospace,monospace";ctx.textAlign="left";
  ctx.fillText("EMBER BASE",28,H/2-30);
  ctx.textAlign="right";ctx.fillText("AZURE BASE",W-28,H/2-30);ctx.textAlign="left";
}

function render(){
  ctx.imageSmoothingEnabled=false;
  drawGrid();
  if(!factions.EMBER||!factions.AZURE)return;
  drawInfluence();drawBases();drawNodes();drawUnits();drawLabels();
}

function traitHtml(f){
  const arr=[["AGGRESSION",f.aggression],["CAUTION",f.caution],["COORDINATION",f.coordination],["LOGISTICS",f.logistics],["ADAPTABILITY",f.adaptability]];
  return arr.map(([n,v])=>'<div class="trait"><span>'+n+'</span><div class="bar"><i style="width:'+Math.round(v*100)+'%"></i></div><b>'+Math.round(v*100)+'</b></div>').join("");
}

function updateUI(){
  const sec=Math.floor(simTime),mm=String(Math.floor(sec/60)).padStart(2,"0"),ss=String(sec%60).padStart(2,"0");
  timeText.textContent=mm+":"+ss;
  const eOwned=ownedNodes("EMBER"),aOwned=ownedNodes("AZURE"),neutral=nodes.length-eOwned-aOwned;
  const ePct=Math.round((eOwned+neutral*.5)/nodes.length*100),aPct=100-ePct;
  controlText.textContent=ePct+" / "+aPct;
  unitsText.textContent=living("EMBER").length+" / "+living("AZURE").length;
  for(const side of ["EMBER","AZURE"]){
    const f=factions[side];
    (side==="EMBER"?emberDoctrine:azureDoctrine).textContent=f.doctrine;
    (side==="EMBER"?emberThought:azureThought).textContent=f.thought;
    (side==="EMBER"?emberMemory:azureMemory).textContent=f.memory+" · supply "+f.supply.toFixed(0)+" · K/L "+f.kills+"/"+f.losses;
  }
}

function cycleSpeed(){
  timeScale=timeScale===1?2:(timeScale===2?4:1);
  speedButton.querySelector("strong").textContent="SPEED ×"+timeScale;
}

newWarButton.addEventListener("click",reset);
speedButton.addEventListener("click",cycleSpeed);

function resize(){
  const r=canvas.getBoundingClientRect(),w=Math.max(320,Math.round(r.width||960)),h=Math.round(w*600/960);
  canvas.width=w;canvas.height=h;
}
window.addEventListener("resize",resize);resize();

function loop(t){
  const raw=Math.min(.05,Math.max(0,(t-last)/1000||.016));last=t;
  if(running){
    const steps=timeScale*2,dt=raw*timeScale/steps;
    for(let i=0;i<steps;i++)update(dt);
    updateUI();
  }
  const sx=canvas.width/W,sy=canvas.height/H;
  ctx.save();ctx.scale(sx,sy);render();ctx.restore();
  requestAnimationFrame(loop);
}
// Start immediately: no static pre-start state.
reset();
requestAnimationFrame(loop);
})();