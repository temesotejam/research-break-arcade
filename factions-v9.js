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
const DOCTRINE_JA={ATTACK:"攻勢",DEFEND:"防衛",EXPAND:"拡張",RAID:"奇襲",REGROUP:"再編"};
const TRAIT_JA={AGGRESSION:"攻撃性",CAUTION:"慎重さ",COORDINATION:"連携",LOGISTICS:"補給",ADAPTABILITY:"適応力"};
const NODE_TYPES={
  SUPPLY:{label:"補給拠点",mark:"補",color:"#d6b85f",desc:"補給収入が増える"},
  MEDIC:{label:"医療拠点",mark:"医",color:"#78c98b",desc:"周囲の味方を回復"},
  COMMAND:{label:"指揮拠点",mark:"指",color:"#b58ade",desc:"周囲の戦闘力を強化"},
  FACTORY:{label:"生産拠点",mark:"生",color:"#e48b63",desc:"増援の生産を高速化"}
};

let running=false,last=performance.now(),simTime=0,timeScale=1,logs=[];
let nodes=[],units=[],factions={};

function makeFaction(name,traits,base){
  return{
    name,...traits,
    supply:30,score:0,doctrine:"EXPAND",thought:"初期配置を確認中",
    memory:"適応履歴なし",nextThink:0,recentLosses:0,kills:0,losses:0,
    doctrineBias:{ATTACK:0,DEFEND:0,EXPAND:0,RAID:0,REGROUP:0},
    lastEval:{control:0,kills:0,losses:0},
    base,
    spawnTimer:0,
    builtNode:false,
    buildAfter:rnd(6,16)
  };
}
function balancedTraitPair(){
  const base=.62;
  const overallSkew=rnd(-.018,.018);
  let d;
  do{
    d=[rnd(-.24,.24),rnd(-.24,.24),rnd(-.24,.24),rnd(-.24,.24)];
    d.push(-(d[0]+d[1]+d[2]+d[3]));
  }while(Math.abs(d[4])>.24 || d.every(v=>Math.abs(v)<.07));
  const keys=["aggression","caution","coordination","logistics","adaptability"];
  const ember={},azure={};
  keys.forEach((k,i)=>{
    ember[k]=clamp(base+d[i]+overallSkew,.28,.94);
    azure[k]=clamp(base-d[i]-overallSkew,.28,.94);
  });
  return{ember,azure};
}

function reset(){
  simTime=0;logs=[];units=[];nodes=[];
  const pair=balancedTraitPair();
  const emberLeft=Math.random()<.5;
  const leftBase={x:70,y:H/2},rightBase={x:W-70,y:H/2};
  factions={
    EMBER:makeFaction("EMBER",pair.ember,emberLeft?leftBase:rightBase),
    AZURE:makeFaction("AZURE",pair.azure,emberLeft?rightBase:leftBase)
  };
  createNodes();
  for(let i=0;i<18;i++){spawnUnit("EMBER",true);spawnUnit("AZURE",true)}
  factions.EMBER.supply=20;factions.AZURE.supply=20;
  renderTraits();log("新しい戦局を開始 · 総合力は近く、長所・短所と小さな能力差を再生成");
  running=true;statusText.textContent="稼働中";updateUI();
}

function createNodes(){
  const specs=[
    [W*.22,H*.25,"SUPPLY"],[W*.78,H*.25,"SUPPLY"],
    [W*.22,H*.75,"MEDIC"],[W*.78,H*.75,"MEDIC"],
    [W*.38,H*.50,"COMMAND"],[W*.62,H*.50,"COMMAND"],
    [W*.50,H*.22,"FACTORY"],[W*.50,H*.78,"FACTORY"]
  ];
  for(let i=specs.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[specs[i],specs[j]]=[specs[j],specs[i]]}
  nodes=specs.map((p,i)=>({id:i,x:p[0],y:p[1],type:p[2],owner:null,capture:0,value:1}));
}

function chooseBuildType(side){
  const f=factions[side],m=strategicMetrics(side);
  const scores={
    SUPPLY:1.0+f.logistics*.9+(m.supply<14?1.4:0)+(m.supplyNodes===0?.35:0),
    MEDIC:.8+f.caution*.8+m.hurt*2.0+(m.medicNodes===0?.25:0),
    COMMAND:.8+f.aggression*.85+f.coordination*.75+(f.doctrine==="ATTACK"||f.doctrine==="RAID"?.9:0)+(m.commandNodes===0?.2:0),
    FACTORY:.9+f.logistics*.65+(m.armyRatio<.9?1.4:0)+(living(side).length<18?.55:0)+(m.factoryNodes===0?.25:0)
  };
  return Object.keys(scores).sort((a,b)=>scores[b]-scores[a])[0];
}
function validBuildPosition(side,x,y){
  if(x<48||x>W-48||y<42||y>H-42)return false;
  if(nodes.some(n=>Math.hypot(x-n.x,y-n.y)<54))return false;
  const own=factions[side].base,enemy=factions[enemySide(side)].base;
  if(Math.hypot(x-own.x,y-own.y)<72)return false;
  if(Math.hypot(x-enemy.x,y-enemy.y)<105)return false;
  return true;
}
function chooseBuildPosition(side,type){
  const f=factions[side],enemy=factions[enemySide(side)],dx=enemy.base.x-f.base.x,dy=enemy.base.y-f.base.y;
  const len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,px=-uy,py=ux;
  const ranges={
    SUPPLY:[105,175,90],
    FACTORY:[115,190,95],
    MEDIC:[155,245,120],
    COMMAND:[205,315,135]
  };
  const [minF,maxF,lateral]=ranges[type];
  let best=null,bestScore=-Infinity;
  for(let i=0;i<70;i++){
    const forward=rnd(minF,maxF),sideOff=rnd(-lateral,lateral);
    const x=f.base.x+ux*forward+px*sideOff,y=f.base.y+uy*forward+py*sideOff;
    if(!validBuildPosition(side,x,y))continue;
    const friend=nearbyStrength(side,{x,y},95),foe=nearbyStrength(enemySide(side),{x,y},95);
    let score=rnd(-8,8);
    if(type==="SUPPLY"||type==="FACTORY")score+=friend*5-foe*9-Math.hypot(x-f.base.x,y-f.base.y)*.025;
    else if(type==="MEDIC")score+=friend*7-foe*4-Math.abs(Math.hypot(x-f.base.x,y-f.base.y)-205)*.035;
    else score+=friend*4-foe*2+Math.hypot(x-f.base.x,y-f.base.y)*.025;
    if(score>bestScore){bestScore=score;best={x,y}}
  }
  return best;
}
function tryBuildFactionNode(side){
  const f=factions[side];
  if(f.builtNode||simTime<f.buildAfter||f.supply<9)return false;
  const type=chooseBuildType(side),pos=chooseBuildPosition(side,type);
  if(!pos){f.buildAfter=simTime+rnd(4,8);return false}
  f.supply-=9;f.builtNode=true;
  nodes.push({
    id:(side==="EMBER"?"E":"A")+"-BUILD",x:pos.x,y:pos.y,type,owner:side,capture:0,value:1,aiBuilt:true
  });
  const name=side==="EMBER"?"エンバー":"アズール";
  log(name+"AIが"+NODE_TYPES[type].label+"を建設");
  f.memory="自律建設 · "+NODE_TYPES[type].label+"を選択";
  return true;
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
    el.innerHTML=traits.map(([n,v])=>'<div class="trait"><span>'+TRAIT_JA[n]+'</span><div class="bar"><i style="width:'+Math.round(v*100)+'%"></i></div><b>'+Math.round(v*100)+'</b></div>').join("");
  }
}

function log(msg){
  logs.unshift(msg);if(logs.length>8)logs.length=8;
  battleLog.innerHTML=logs.map(x=>"<span>"+x+"</span>").join("");
}

function ownedNodes(side){return nodes.filter(n=>n.owner===side).length}
function ownedNodesOfType(side,type){return nodes.filter(n=>n.owner===side&&n.type===type).length}
function nodeAbilitySummary(side){
  const order=["SUPPLY","MEDIC","COMMAND","FACTORY"];
  return order.map(t=>NODE_TYPES[t].mark+ownedNodesOfType(side,t)).join(" ");
}
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
  return{
    nearBase,armyRatio,nodeRatio,enemyNodeRatio,hurt,supply:f.supply,
    supplyNodes:ownedNodesOfType(side,"SUPPLY"),
    medicNodes:ownedNodesOfType(side,"MEDIC"),
    commandNodes:ownedNodesOfType(side,"COMMAND"),
    factoryNodes:ownedNodesOfType(side,"FACTORY")
  };
}

function thinkFaction(side){
  const f=factions[side],m=strategicMetrics(side);
  tryBuildFactionNode(side);
  const u={};
  u.ATTACK=38+f.aggression*42+(m.armyRatio-1)*24+m.nodeRatio*9-f.caution*m.hurt*26;
  u.DEFEND=24+f.caution*35+m.nearBase*9+(1-m.armyRatio)*22+f.coordination*8;
  u.EXPAND=30+f.logistics*27+(1-m.nodeRatio-m.enemyNodeRatio)*32+f.coordination*10;
  u.RAID=18+f.aggression*18+f.adaptability*15+(m.armyRatio>.85?8:0)+f.coordination*8;
  u.REGROUP=12+f.caution*24+m.hurt*42+(1-m.armyRatio)*30+(f.supply>18?8:0);
  for(const d of DOCTRINES)u[d]+=f.doctrineBias[d]||0;

  const old=f.doctrine;
  f.doctrine=DOCTRINES.slice().sort((a,b)=>u[b]-u[a])[0];
  if(old!==f.doctrine)log((side==="EMBER"?"エンバー":"アズール")+" 方針変更 · "+DOCTRINE_JA[old]+" → "+DOCTRINE_JA[f.doctrine]);

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
    f.memory=(reward>=0?"成功":"失敗")+"から学習 · "+DOCTRINE_JA[old]+"の選択傾向 "+(f.doctrineBias[old]>=0?"+":"")+f.doctrineBias[old].toFixed(1);
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
function commandAura(side,p){
  return nodes.some(n=>n.owner===side&&n.type==="COMMAND"&&Math.hypot(n.x-p.x,n.y-p.y)<95)?1.14:1;
}
function nearbyStrength(side,p,r){
  const aura=commandAura(side,p);
  return living(side).filter(u=>Math.hypot(u.x-p.x,u.y-p.y)<r).reduce((s,u)=>s+(u.hp/u.maxHp)*(u.role==="LINE"?1.15:(u.role==="SUPPORT"?.85:.70)),0)*aura;
}
function nodeStrategicValue(side,n){
  const f=factions[side],m=strategicMetrics(side);
  let v=1;
  if(n.type==="SUPPLY")v+=.65+f.logistics*.55+(m.supply<14?.65:0);
  if(n.type==="MEDIC")v+=.45+f.caution*.50+m.hurt*.95;
  if(n.type==="COMMAND")v+=.50+f.aggression*.45+f.coordination*.50+(f.doctrine==="ATTACK"?.35:0);
  if(n.type==="FACTORY")v+=.55+f.logistics*.45+(m.armyRatio<.9?.75:0);
  if(n.owner===enemySide(side))v+=.22;
  return v;
}
function chooseNodeTarget(side,u,candidates){
  let best=null,bestScore=-Infinity;
  for(const n of candidates){
    const d=Math.hypot(n.x-u.x,n.y-u.y);
    const score=nodeStrategicValue(side,n)*95-d+rnd(-5,5);
    if(score>bestScore){bestScore=score;best=n}
  }
  return best;
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
    u.mode="CAPTURE";u.target=neutral.length?chooseNodeTarget(u.side,u,neutral):enemy.base;return;
  }

  if(f.doctrine==="RAID"){
    const enemyNodes=nodes.filter(n=>n.owner===enemySide(u.side));
    const target=enemyNodes.length?chooseNodeTarget(u.side,u,enemyNodes):weakestEnemyNode(u.side);
    u.mode="RAID";u.target=target||enemy.base;return;
  }

  if(f.doctrine==="REGROUP"){
    const anchor=ownedNodes(u.side).length?nearest(nodes.filter(n=>n.owner===u.side),u):f.base;
    u.mode="REGROUP";u.target=anchor;return;
  }

  // ATTACK
  const enemyNodes=nodes.filter(n=>n.owner===enemySide(u.side));
  u.mode="ATTACK";u.target=enemyNodes.length?chooseNodeTarget(u.side,u,enemyNodes):enemy.base;
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
      const damage=(u.role==="LINE"?17:(u.role==="SCOUT"?9:7))*(.85+coordination*.30)*(friends>=enemyStr?1.08:.92)*commandAura(u.side,u)*dt;
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
    if(n.owner===winner){
      const step=dt*1.6;
      n.capture=Math.abs(n.capture)<=step?0:n.capture-Math.sign(n.capture)*step;
      continue;
    }
    n.capture+=(winner==="EMBER"?1:-1)*dt*power*.38;
    if(n.capture>3.5){n.owner="EMBER";n.capture=0;log("エンバーが"+NODE_TYPES[n.type].label+" "+n.id+" を確保")}
    else if(n.capture<-3.5){n.owner="AZURE";n.capture=0;log("アズールが"+NODE_TYPES[n.type].label+" "+n.id+" を確保")}
  }
}

function updateNodeAbilities(dt){
  for(const side of ["EMBER","AZURE"]){
    const medics=nodes.filter(n=>n.owner===side&&n.type==="MEDIC");
    if(!medics.length)continue;
    for(const u of living(side)){
      if(u.hp>=u.maxHp)continue;
      let heal=0;
      for(const n of medics)if(Math.hypot(u.x-n.x,u.y-n.y)<82)heal+=5.2;
      if(heal>0)u.hp=Math.min(u.maxHp,u.hp+heal*dt);
    }
  }
}

function updateEconomy(dt){
  for(const side of ["EMBER","AZURE"]){
    const f=factions[side];
    const supplyBonus=ownedNodesOfType(side,"SUPPLY")*.90;
    const income=(1+ownedNodes(side)*.56+supplyBonus)*(0.72+f.logistics*.55);
    f.supply+=income*dt;
    f.spawnTimer-=dt;
    const factories=ownedNodesOfType(side,"FACTORY");
    const maxUnits=24+Math.round(f.logistics*10)+factories*2;
    const spawnCost=Math.max(4.8,6-factories*.35);
    if(f.spawnTimer<=0&&living(side).length<maxUnits&&f.supply>=spawnCost){
      f.supply-=spawnCost;
      spawnUnit(side,true);
      const factorySpeed=Math.pow(.82,factories);
      f.spawnTimer=rnd(1.7,3.3)*(1.15-f.logistics*.25)*factorySpeed;
    }
  }
}

function checkEnd(){
  const candidates=[];
  for(const side of ["EMBER","AZURE"]){
    const enemy=enemySide(side),base=factions[enemy].base;
    const pressure=nearbyStrength(side,base,62),def=nearbyStrength(enemy,base,62);
    if(pressure>5.4&&pressure>def*1.6&&living(enemy).length<8){
      candidates.push({side,score:pressure/Math.max(.25,def),pressure,def});
    }
  }
  if(!candidates.length)return;
  candidates.sort((a,b)=>b.score-a.score);
  let winner=candidates[0].side;
  if(candidates.length>1&&Math.abs(candidates[0].score-candidates[1].score)<.08){
    winner=Math.random()<.5?candidates[0].side:candidates[1].side;
  }
  statusText.textContent=(winner==="EMBER"?"エンバー":"アズール")+" 優勢";
  running=false;
  log((winner==="EMBER"?"エンバー":"アズール")+" が敵司令地域を制圧");
}

function update(dt){
  simTime+=dt;
  for(const side of ["EMBER","AZURE"]){
    tryBuildFactionNode(side);
    if(simTime>=factions[side].nextThink)thinkFaction(side);
  }
  const order=units.slice();
  for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
  for(const u of order)updateUnit(u,dt);
  resolveDeaths();updateNodes(dt);updateNodeAbilities(dt);updateEconomy(dt);checkEnd();
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
    const nt=NODE_TYPES[n.type];
    ctx.strokeStyle=n.owner?FACTION_COLORS[n.owner]:nt.color;ctx.lineWidth=2;ctx.strokeRect(n.x-7,n.y-7,14,14);
    ctx.fillStyle=nt.color;ctx.globalAlpha=n.owner?.28:.12;ctx.fillRect(n.x-5,n.y-5,10,10);ctx.globalAlpha=1;
    if(n.owner){ctx.strokeStyle=FACTION_COLORS[n.owner];ctx.strokeRect(n.x-9,n.y-9,18,18)}
    if(n.aiBuilt){ctx.strokeStyle="#ffffff";ctx.globalAlpha=.72;ctx.strokeRect(n.x-12,n.y-12,24,24);ctx.globalAlpha=1}
    ctx.fillStyle="#e9e7df";ctx.font="8px ui-monospace,monospace";ctx.textAlign="center";ctx.fillText(nt.mark,n.x,n.y+3);ctx.textAlign="left";
    if(Math.abs(n.capture)>.1){
      ctx.fillStyle=n.capture>0?FACTION_COLORS.EMBER:FACTION_COLORS.AZURE;
      const w=clamp(Math.abs(n.capture)/3.5*18,0,18);ctx.fillRect(n.x-9,n.y+11,w,2);
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
  for(const side of ["EMBER","AZURE"]){
    const f=factions[side],label=side==="EMBER"?"エンバー拠点":"アズール拠点";
    ctx.textAlign=f.base.x<W/2?"left":"right";
    ctx.fillText(label,f.base.x+(f.base.x<W/2?-42:42),H/2-30);
  }
  ctx.textAlign="left";
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
    (side==="EMBER"?emberDoctrine:azureDoctrine).textContent=DOCTRINE_JA[f.doctrine];
    (side==="EMBER"?emberThought:azureThought).textContent=f.thought;
    (side==="EMBER"?emberMemory:azureMemory).textContent=f.memory+" · 補給 "+f.supply.toFixed(0)+" · 撃破/損失 "+f.kills+"/"+f.losses+" · 拠点 "+nodeAbilitySummary(side);
  }
}

function cycleSpeed(){
  timeScale=timeScale===1?2:(timeScale===2?4:1);
  speedButton.querySelector("strong").textContent="速度 ×"+timeScale;
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