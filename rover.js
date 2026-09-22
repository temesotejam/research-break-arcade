(() => {
"use strict";

const SAVE_KEY="rba-tiny-bot-canvas-v1";

const $=id=>document.getElementById(id);
const canvas=$("roverCanvas");
const ctx=canvas.getContext("2d");
const intro=$("intro"),enterButton=$("enterButton"),pauseButton=$("pauseButton");
const viewButton=$("viewButton"),lightButton=$("lightButton"),newLifeButton=$("newLifeButton");
const viewBadge=$("viewBadge"),decisionBadge=$("decisionBadge"),viewName=$("viewName");
const stateText=$("stateText"),mapText=$("mapText"),missionText=$("missionText"),missionStepText=$("missionStepText");
const activityText=$("activityText"),detailText=$("detailText"),batteryText=$("batteryText"),speedText=$("speedText");
const partsText=$("partsText"),sampleText=$("sampleText"),exploreText=$("exploreText"),headingText=$("headingText");
const lightLabel=$("lightLabel"),logList=$("logList"),upgradeList=$("upgradeList"),inventoryList=$("inventoryList");
const curiosityFill=$("curiosityFill"),cautionFill=$("cautionFill"),improveFill=$("improveFill");
const curiosityText=$("curiosityText"),cautionText=$("cautionText"),improveText=$("improveText");

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rnd=(a,b)=>a+Math.random()*(b-a);
const wrap=a=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a};
const deg=r=>r*180/Math.PI;

const WORLD=64;
const HALF=WORLD/2;
const CELL=5;
const FOV=Math.PI*70/180;
const LIGHTS=[
  {name:"DAY",shade:0},
  {name:"SUNSET",shade:0.17},
  {name:"NIGHT",shade:0.52}
];

const MAPS=[
  {
    name:"OVERWORLD PLAINS",biome:"overworld",sky:"#79b9e7",ground:"#6fa34b",soil:"#765132",rock:"#737373",
    core:"FLINT & STEEL",portal:"NETHER PORTAL",
    zones:[
      {id:"M-01",x:-16,z:-11,kind:"geology",label:"stone cluster",className:"STONE",interest:.72},
      {id:"M-02",x:14,z:-13,kind:"parts",label:"iron ore",className:"IRON ORE",parts:2},
      {id:"M-03",x:18,z:7,kind:"geology",label:"coal ore",className:"COAL ORE",interest:.46},
      {id:"M-04",x:-15,z:15,kind:"core",label:"flint and steel cache",className:"FLINT & STEEL"},
      {id:"M-05",x:21,z:17,kind:"gate",label:"ruined obsidian portal",className:"NETHER PORTAL"},
      {id:"M-06",x:4,z:19,kind:"parts",label:"redstone ore",className:"REDSTONE ORE",parts:1}
    ]
  },
  {
    name:"NETHER WASTES",biome:"nether",sky:"#3a1518",ground:"#873630",soil:"#5f2422",rock:"#353035",
    core:"ENDER EYE",portal:"END PORTAL",
    zones:[
      {id:"N-01",x:-18,z:-8,kind:"geology",label:"basalt",className:"BASALT",interest:.80},
      {id:"N-02",x:13,z:-17,kind:"parts",label:"nether quartz ore",className:"QUARTZ ORE",parts:2},
      {id:"N-03",x:19,z:3,kind:"core",label:"ender eye cache",className:"ENDER EYE"},
      {id:"N-04",x:-13,z:16,kind:"geology",label:"blackstone",className:"BLACKSTONE",interest:.90},
      {id:"N-05",x:20,z:18,kind:"gate",label:"ancient end portal",className:"END PORTAL"},
      {id:"N-06",x:-3,z:20,kind:"parts",label:"nether gold ore",className:"GOLD ORE",parts:2}
    ]
  },
  {
    name:"THE END",biome:"end",sky:"#181522",ground:"#d6d09e",soil:"#b8b183",rock:"#2a2430",
    core:"GATEWAY CRYSTAL",portal:"END GATEWAY",
    zones:[
      {id:"E-01",x:-17,z:-16,kind:"parts",label:"purpur cache",className:"PURPUR",parts:2},
      {id:"E-02",x:15,z:-15,kind:"geology",label:"end stone",className:"END STONE",interest:.68},
      {id:"E-03",x:18,z:6,kind:"core",label:"gateway crystal",className:"GATEWAY CRYSTAL"},
      {id:"E-04",x:-15,z:13,kind:"parts",label:"amethyst cache",className:"AMETHYST",parts:2},
      {id:"E-05",x:20,z:18,kind:"gate",label:"end gateway",className:"END GATEWAY"},
      {id:"E-06",x:2,z:20,kind:"geology",label:"obsidian spire",className:"OBSIDIAN",interest:.88}
    ]
  }
];

const UPGRADE_DEFS={
  speed:{label:"MOVEMENT MODULE",cost:2,effect:"MOVE ×1.48"},
  mining:{label:"MINING MODULE",cost:3,effect:"MINE ×1.85"},
  vision:{label:"LONG-RANGE OPTICS",cost:2,effect:"VISION ×1.65"},
  detection:{label:"DETECTION ARRAY",cost:2,effect:"DETECTION +14%"},
  analysis:{label:"FAST ANALYZER",cost:2,effect:"ANALYZE ×1.75"},
  efficiency:{label:"POWER EFFICIENCY",cost:3,effect:"ENERGY ×0.63"}
};

function seeded(seed){
  let s=(seed>>>0)||1;
  return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
}

function mapConfig(index){
  const base=structuredClone(MAPS[index%MAPS.length]);
  if(index>=MAPS.length){
    base.name=base.name+" · CHUNK "+String(index+1).padStart(2,"0");
    base.zones.forEach((z,i)=>{
      z.id="X"+(index+1)+"-"+(i+1);
      z.x=clamp(z.x+Math.sin(index*1.37+i)*3,-25,25);
      z.z=clamp(z.z+Math.cos(index*.91+i)*3,-25,25);
    });
  }
  return base;
}

function freshLife(){
  return{
    version:1,mapIndex:0,materials:0,analyses:0,battery:100,upgrades:[],
    personality:{curiosity:rnd(.48,.90),caution:rnd(.36,.80),improve:rnd(.45,.92)},
    exp:{stucks:0,charges:0,distance:0,scans:0,portals:0},
    maps:{},position:null,currentMission:null,lastSeen:Date.now()
  };
}

function loadLife(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw)return freshLife();
    const v=JSON.parse(raw);
    if(!v||v.version!==1)return freshLife();
    return v;
  }catch(_){return freshLife()}
}

let life=loadLife();
let config=mapConfig(life.mapIndex);
let ambient=[];
let zones=[];
let obstacles=[];
let logs=[];
let running=false,paused=false,lastTime=performance.now(),saveTimer=0,lightIndex=0;
let viewMode="world",viewIndex=0;
const views=["world","follow","botcam"];

const bot={
  x:0,z:0,heading:.35,speed:0,targetSpeed:0,battery:life.battery||100,
  state:"THINK",timer:1,target:null,goal:null,navPurpose:null,prevDist:Infinity,stuckTime:0,recoverSign:1,
  headYaw:0,headPitch:-.08,headTargetYaw:0,headTargetPitch:-.08,scanPhase:0,
  arm:0,walkPhase:0,upgradeChoice:null,
  mission:life.currentMission&&life.currentMission.mapIndex===life.mapIndex?structuredClone(life.currentMission):null
};

if(life.position&&life.position.mapIndex===life.mapIndex){
  bot.x=life.position.x;bot.z=life.position.z;bot.heading=life.position.heading;
}
if(bot.mission&&!["evolve","advance"].includes(bot.mission.type))bot.mission=null;

function mem(){
  const k=String(life.mapIndex);
  if(!life.maps[k])life.maps[k]={seen:[],discovered:[],recognized:{},coreHeld:false,portalKnown:false,portalActive:false,visited:[]};
  const m=life.maps[k];
  if(!Array.isArray(m.seen))m.seen=[];
  if(!Array.isArray(m.discovered))m.discovered=[];
  if(!m.recognized)m.recognized={};
  if(!Array.isArray(m.visited))m.visited=[];
  return m;
}

function saveLife(){
  life.battery=bot.battery;
  life.position={mapIndex:life.mapIndex,x:bot.x,z:bot.z,heading:bot.heading};
  life.currentMission=bot.mission?structuredClone(bot.mission):null;
  life.lastSeen=Date.now();
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(life))}catch(_){}
}

function has(id){return life.upgrades.includes(id)}
function movementMult(){return has("speed")?1.48:1}
function miningMult(){return has("mining")?1.85:1}
function visionMult(){return has("vision")?1.65:1}
function detectionBoost(){return has("detection")?.14:0}
function analysisMult(){return has("analysis")?1.75:1}
function efficiencyMult(){return has("efficiency")?.63:1}

function terrainHeight(x,z){
  const raw=.55*Math.sin(x*.13+life.mapIndex*.9)+.42*Math.cos(z*.12-life.mapIndex*.4)+.25*Math.sin((x+z)*.08);
  return Math.round(raw/.33)*.33;
}

function buildWorld(){
  config=mapConfig(life.mapIndex);
  const discovered=new Set(mem().discovered);
  zones=config.zones.map(z=>({...z,taken:discovered.has(z.id)&&(z.kind==="parts"||z.kind==="core")}));
  ambient=[];
  obstacles=[];
  const rand=seeded(4400+life.mapIndex*991);
  const count=config.biome==="overworld"?36:28;
  for(let i=0;i<count;i++){
    let x=rand()*56-28,z=rand()*56-28;
    if(Math.hypot(x,z)<4||zones.some(q=>Math.hypot(q.x-x,q.z-z)<3)){i--;continue}
    let type=config.biome==="overworld"?"TREE":config.biome==="nether"?"BASALT":"CHORUS";
    ambient.push({id:"A-"+life.mapIndex+"-"+i,x,z,type,radius:type==="TREE"?.75:.55,height:type==="TREE"?2.5:1.8});
    obstacles.push({id:"A-"+life.mapIndex+"-"+i,x,z,radius:type==="TREE"?.65:.48});
  }
  for(let i=0;i<44;i++){
    const x=rand()*58-29,z=rand()*58-29;
    if(Math.hypot(x,z)<2.5)continue;
    ambient.push({id:"B-"+life.mapIndex+"-"+i,x,z,type:config.biome==="end"?"END STONE":"STONE",radius:.22+rand()*.18,height:.35});
  }
  zones.forEach(z=>{
    if(z.kind==="geology"||z.kind==="gate")obstacles.push({id:z.id,x:z.x,z:z.z,radius:z.kind==="gate"?1.1:.85});
  });
  updateMapUI();
}

function log(msg){
  logs.unshift(msg);
  if(logs.length>7)logs.length=7;
  logList.innerHTML=logs.map(x=>"<span>"+x+"</span>").join("");
}

function exploration(){
  return mem().discovered.length/Math.max(1,zones.length);
}
function knownUnexplored(){
  const m=mem(),seen=new Set(m.seen),done=new Set(m.discovered);
  return zones.filter(z=>seen.has(z.id)&&!done.has(z.id));
}
function unseenZones(){
  const seen=new Set(mem().seen);
  return zones.filter(z=>!seen.has(z.id));
}
function cellKey(x,z){return Math.round(x/CELL)+","+Math.round(z/CELL)}
function markVisited(){
  const m=mem(),k=cellKey(bot.x,bot.z);
  if(!m.visited.includes(k))m.visited.push(k);
}
function chooseFrontier(){
  const m=mem(),visited=new Set(m.visited),c=[];
  const desired=8.5+life.personality.curiosity*5;
  for(let gx=-5;gx<=5;gx++)for(let gz=-5;gz<=5;gz++){
    const x=gx*CELL,z=gz*CELL,k=gx+","+gz,d=Math.hypot(x-bot.x,z-bot.z);
    if(visited.has(k)||d<3.5)continue;
    c.push({x,z,k,score:-Math.abs(d-desired)*.55+Math.random()*2.2});
  }
  if(!c.length){m.visited=[];return chooseFrontier()}
  c.sort((a,b)=>b.score-a.score);
  return c[0];
}

function upgradeNeeds(){
  const e=life.exp;
  return{
    speed:clamp(.28+e.distance/180+e.stucks*.08,0,1),
    mining:clamp(.28+life.materials*.08+e.scans*.035,0,1),
    vision:clamp(unseenZones().length/zones.length*.55+life.mapIndex*.05,0,1),
    detection:clamp(.30+unseenZones().length/zones.length*.42+e.scans*.025,0,1),
    analysis:clamp(.30+e.scans*.055+life.mapIndex*.04,0,1),
    efficiency:clamp(.22+e.charges*.15+e.distance/220,0,1)
  };
}
function desiredUpgrade(){
  const needs=upgradeNeeds();let best=null;
  for(const [id,d] of Object.entries(UPGRADE_DEFS)){
    if(has(id))continue;
    const score=life.personality.improve*34+needs[id]*52+(life.materials>=d.cost?13:0)+Math.random()*7;
    if(!best||score>best.score)best={id,...d,score,need:needs[id]};
  }
  return best;
}

function setMission(m,reason){
  bot.mission={...m,mapIndex:life.mapIndex,startedAt:Date.now()};
  life.currentMission=structuredClone(bot.mission);
  log("mission: "+bot.mission.label.toLowerCase()+" · "+reason);
  decisionBadge.textContent="MISSION · "+bot.mission.label;
  saveLife();
}
function finishMission(note){
  if(bot.mission)log("mission complete · "+bot.mission.label.toLowerCase()+" · "+note);
  bot.mission=null;life.currentMission=null;saveLife();think();
}
function abortMission(note){
  if(bot.mission)log("mission replan · "+bot.mission.label.toLowerCase()+" · "+note);
  bot.mission=null;life.currentMission=null;saveLife();think();
}
function think(){
  bot.state="THINK";bot.timer=.7+rnd(.2,.6);bot.speed=0;bot.arm=0;
  decisionBadge.textContent=bot.mission?"MISSION · "+bot.mission.label:"THINKING…";
}

function usefulUnknownForMission(mission){
  const m=mem(),done=new Set(m.discovered);
  const c=zones.filter(z=>m.seen.includes(z.id)&&!done.has(z.id));
  if(mission.type==="evolve"){
    const res=c.filter(z=>z.kind==="parts");
    if(res.length)return res.sort((a,b)=>Math.hypot(a.x-bot.x,a.z-bot.z)-Math.hypot(b.x-bot.x,b.z-bot.z))[0];
    return c.find(z=>recognitionLabel(z)==="?")||null;
  }
  const portal=c.filter(z=>z.kind==="core"||z.kind==="gate");
  if(portal.length)return portal.sort((a,b)=>Math.hypot(a.x-bot.x,a.z-bot.z)-Math.hypot(b.x-bot.x,b.z-bot.z))[0];
  return c.find(z=>recognitionLabel(z)==="?")||null;
}

function chooseMission(){
  const m=mem(),p=life.personality,up=desiredUpgrade();
  if(!up){setMission({type:"advance",label:"REACH NEXT DIMENSION"},"all current upgrades completed");continueMission();return}
  const upgradeProgress=clamp(life.materials/up.cost,0,1);
  const portalProgress=(m.portalKnown?.35:0)+(m.coreHeld?.35:0)+(m.portalActive?.45:0);
  const evolve=48+p.improve*34+up.need*24+upgradeProgress*20+Math.random()*6;
  const advance=44+p.curiosity*30+portalProgress*34+(life.upgrades.length>=2?8:0)+Math.random()*6;
  if(advance>evolve)setMission({type:"advance",label:"REACH NEXT DIMENSION"},"portal progress is more valuable");
  else setMission({type:"evolve",upgradeId:up.id,label:"SELF EVOLUTION · "+up.label},"capability improvement is more valuable");
  continueMission();
}

function startFrontierTravel(label){
  const g=chooseFrontier();
  bot.scanPhase=0;
  startNavigation({x:g.x,z:g.z},"frontier",null,.68*movementMult());
  log(label+" · viewpoint "+g.k);
}

function continueMission(){
  const mission=bot.mission;
  if(!mission){chooseMission();return}
  const m=mem();
  if(bot.battery<28+life.personality.caution*16){startCharge();return}

  if(mission.type==="evolve"){
    const d=UPGRADE_DEFS[mission.upgradeId];
    if(!d||has(mission.upgradeId)){finishMission("capability acquired");return}
    if(life.materials>=d.cost){mission.step="INSTALLING "+d.label;startUpgrade({id:mission.upgradeId,...d});return}
    const u=usefulUnknownForMission(mission);
    if(u){mission.step="CHECK "+u.id+" FOR MATERIAL";navigateToZone(u);return}
    const missing=d.cost-life.materials;
    mission.step="FIND "+missing+" MATERIAL UNIT"+(missing===1?"":"S")+" FOR "+d.label;
    startFrontierTravel("searching for upgrade material");return;
  }

  if(mission.type==="advance"){
    if(m.portalActive){mission.step="ENTER ACTIVE PORTAL";navigateToPortal("enter");return}
    if(m.portalKnown&&m.coreHeld){mission.step="USE "+config.core+" ON "+config.portal;navigateToPortal("activate");return}
    const u=usefulUnknownForMission(mission);
    if(u){mission.step="CHECK "+u.id+" FOR PORTAL PROGRESS";navigateToZone(u);return}
    mission.step=!m.portalKnown&&!m.coreHeld?"FIND PORTAL OR KEY ITEM":(!m.portalKnown?"FIND PORTAL FRAME":"FIND PORTAL KEY ITEM");
    startFrontierTravel("searching for portal progress");return;
  }
  abortMission("invalid objective");
}
function decideNext(){bot.mission?continueMission():chooseMission()}

function startNavigation(goal,purpose,target,speed){
  bot.goal=goal;bot.navPurpose=purpose;bot.target=target;bot.state="NAV";bot.targetSpeed=speed;bot.prevDist=Infinity;bot.stuckTime=0;
}
function navigateToZone(z){
  const dx=bot.x-z.x,dz=bot.z-z.z,d=Math.max(.001,Math.hypot(dx,dz));
  const stand=z.kind==="gate"?1.8:(z.kind==="geology"?1.3:1);
  startNavigation({x:z.x+dx/d*stand,z:z.z+dz/d*stand},"explore",z,.70*movementMult());
  log("target selected · "+z.id);
}
function portalZone(){return zones.find(z=>z.kind==="gate")}
function navigateToPortal(purpose){
  const p=portalZone();if(!p){think();return}
  startNavigation({x:p.x-1.4,z:p.z},purpose,p,.62*movementMult());
}

function obstacleSteer(goal){
  const desired=Math.atan2(goal.z-bot.z,goal.x-bot.x);
  const fx=bot.x+Math.cos(bot.heading)*1.0,fz=bot.z+Math.sin(bot.heading)*1.0;
  let avoid=0;
  for(const o of obstacles){
    if(bot.target&&o.id===bot.target.id&&bot.navPurpose==="explore")continue;
    const d=Math.hypot(fx-o.x,fz-o.z);
    if(d<o.radius+.35){
      let away=wrap(Math.atan2(fz-o.z,fx-o.x)-bot.heading);
      if(Math.abs(away)<.1)away=(Math.random()<.5?-1:1)*.6;
      avoid+=clamp(away,-1,1)*(1-d/(o.radius+.35))*1.8;
    }
  }
  return wrap(desired+avoid);
}

function updateNavigation(dt){
  if(!bot.goal){think();return}
  const dist=Math.hypot(bot.goal.x-bot.x,bot.goal.z-bot.z);
  const desired=obstacleSteer(bot.goal),err=wrap(desired-bot.heading);
  bot.heading=wrap(bot.heading+clamp(err*1.6,-1.15,1.15)*dt);
  const turn=1-clamp(Math.abs(err)/1.6,0,.58);
  const target=bot.targetSpeed*turn;
  bot.speed+=(target-bot.speed)*Math.min(1,dt*2.6);
  const step=bot.speed*dt;
  bot.x=clamp(bot.x+Math.cos(bot.heading)*step,-29,29);
  bot.z=clamp(bot.z+Math.sin(bot.heading)*step,-29,29);
  life.exp.distance+=Math.abs(step);

  if(dist>bot.prevDist-.004)bot.stuckTime+=dt;else bot.stuckTime=Math.max(0,bot.stuckTime-dt);
  bot.prevDist=dist;
  if(bot.stuckTime>2.8){
    life.exp.stucks++;bot.recoverSign=Math.random()<.5?-1:1;bot.state="RECOVER";bot.timer=1.4;bot.stuckTime=0;log("path blocked · recovery");
    return;
  }

  if(dist<.28){
    bot.speed=0;
    if(bot.navPurpose==="explore")startScan(bot.target);
    else if(bot.navPurpose==="activate")startPortalActivation();
    else if(bot.navPurpose==="enter")startTransit();
    else if(bot.navPurpose==="frontier"){markVisited();log("goal-directed viewpoint reached");saveLife();think()}
    else think();
  }
}

function recognitionLabel(z){
  const m=mem();
  if(m.recognized[z.id])return m.recognized[z.id];
  if(m.discovered.includes(z.id))return z.className;
  return "?";
}
function identify(z){mem().recognized[z.id]=z.className}

function startScan(z){
  bot.state="SCAN";bot.target=z;bot.timer=2.5/analysisMult();bot.arm=0;life.exp.scans++;log("inspect · "+z.id);
}
function resolveScan(){
  const z=bot.target,m=mem();identify(z);
  if(z.kind==="gate"){
    if(!m.discovered.includes(z.id))m.discovered.push(z.id);
    m.portalKnown=true;log("portal identified · "+z.className.toLowerCase());saveLife();think();return;
  }
  if(z.kind==="core"){
    bot.state="PICKUP";bot.timer=2.2/miningMult();bot.arm=0;log("portal item identified · "+z.className.toLowerCase());return;
  }
  if(z.kind==="parts"){
    bot.state="PICKUP";bot.timer=1.9/miningMult();bot.arm=0;log("resource identified · "+z.className.toLowerCase());return;
  }
  if(!m.discovered.includes(z.id))m.discovered.push(z.id);
  life.analyses++;
  if((z.interest||0)>.7){bot.state="CONTACT";bot.timer=1.7/miningMult();bot.arm=0;log("close analysis selected")}
  else{saveLife();think()}
}
function finishPickup(){
  const z=bot.target,m=mem();
  if(!m.discovered.includes(z.id))m.discovered.push(z.id);
  if(z.kind==="core"){m.coreHeld=true;z.taken=true;log("inventory + "+z.className.toLowerCase())}
  else{life.materials+=z.parts||1;z.taken=true;log("mined "+z.className.toLowerCase()+" · +"+(z.parts||1))}
  saveLife();think();
}
function finishContact(){life.analyses++;log("analysis stored · "+bot.target.label);saveLife();think()}

function startUpgrade(up){bot.state="UPGRADE";bot.timer=3.5;bot.upgradeChoice=up;bot.arm=0;log("self-upgrade · "+up.label.toLowerCase())}
function finishUpgrade(){
  const up=bot.upgradeChoice;
  if(!up||life.materials<up.cost){think();return}
  life.materials-=up.cost;life.upgrades.push(up.id);log("upgrade installed · "+up.label.toLowerCase());saveLife();
  if(bot.mission&&bot.mission.type==="evolve"&&bot.mission.upgradeId===up.id)finishMission("upgrade installed");else think();
}
function startCharge(){bot.state="CHARGE";bot.speed=0;bot.arm=0;life.exp.charges++;log("energy recovery")}
function startPortalActivation(){bot.state="ACTIVATE_GATE";bot.timer=2.6;bot.arm=0;log("using "+config.core.toLowerCase()+" on "+config.portal.toLowerCase())}
function finishPortalActivation(){const m=mem();m.coreHeld=false;m.portalActive=true;life.exp.portals++;log(config.portal.toLowerCase()+" activated");saveLife();think()}
function startTransit(){bot.state="TRANSIT";bot.timer=1.8;bot.speed=.34;log("entering "+config.portal.toLowerCase())}
function advanceMap(){
  life.mapIndex++;life.position=null;life.currentMission=null;bot.mission=null;bot.x=0;bot.z=0;bot.heading=rnd(-Math.PI,Math.PI);bot.speed=0;bot.target=null;
  buildWorld();bot.battery=Math.min(100,bot.battery+15);log("entered dimension · "+config.name.toLowerCase());saveLife();think();
}

function cameraBearing(){return wrap(bot.heading+bot.headYaw)}
function objectHeight(o){
  if(o.kind==="gate")return 2.4;
  if(o.kind==="core"||o.kind==="parts")return .6;
  if(o.kind==="geology")return .9;
  return o.height||.5;
}
function objectRadius(o){return o.radius||.45}
function allVisuals(){
  const a=ambient.filter(o=>!o.taken);
  const z=zones.filter(o=>!o.taken);
  return z.concat(a);
}
function segmentDistance(px,pz,ax,az,bx,bz){
  const vx=bx-ax,vz=bz-az,wx=px-ax,wz=pz-az;
  const len=vx*vx+vz*vz;if(len<1e-6)return Math.hypot(px-ax,pz-az);
  const t=clamp((wx*vx+wz*vz)/len,0,1);
  return Math.hypot(px-(ax+vx*t),pz-(az+vz*t));
}
function occluded(o){
  const td=Math.hypot(o.x-bot.x,o.z-bot.z);
  for(const q of ambient){
    if(q===o||q.taken)continue;
    const qd=Math.hypot(q.x-bot.x,q.z-bot.z);
    if(qd>=td-.2)continue;
    if(objectHeight(q)<.8)continue;
    if(segmentDistance(q.x,q.z,bot.x,bot.z,o.x,o.z)<objectRadius(q)*.72)return true;
  }
  return false;
}

function detectObjects(){
  const range=11.5*visionMult(),bearing=cameraBearing(),out=[];
  for(const o of allVisuals()){
    const dx=o.x-bot.x,dz=o.z-bot.z,dist=Math.hypot(dx,dz);
    if(dist<.12||dist>range)continue;
    const rel=wrap(Math.atan2(dz,dx)-bearing);
    if(Math.abs(rel)>FOV*.5)continue;
    if(occluded(o))continue;
    const apparent=objectRadius(o)/dist;
    const minApp=(o.kind?0.014:0.019)*(has("detection")?.62:1);
    if(apparent<minApp)continue;
    const centerScore=1-Math.abs(rel)/(FOV*.5);
    const sizeScore=clamp(apparent/.12,0,1);
    const distScore=1-dist/range;
    const confidence=clamp(.18+.30*centerScore+.30*sizeScore+.08*distScore+detectionBoost(),.05,.99);
    let cls="?";
    if(o.kind){
      cls=recognitionLabel(o);
      if(o.kind==="geology"&&cls==="?"&&confidence>.60)cls=o.className;
    }else{
      const known=o.type==="TREE"?"TREE":o.type==="BASALT"?"BASALT":o.type==="CHORUS"?"CHORUS":o.type;
      if(confidence>.66)cls=known;
    }
    out.push({o,dist,rel,confidence,cls,apparent});
  }
  out.sort((a,b)=>Math.abs(a.rel)-Math.abs(b.rel)||a.dist-b.dist);
  return out;
}

let detections=[];
function updatePerception(){
  detections=detectObjects();
  const m=mem();
  for(const d of detections){
    const z=d.o;
    if(!z.kind)continue;
    if(d.confidence>=.30&&!m.seen.includes(z.id)){
      m.seen.push(z.id);
      log("visual contact · "+z.id+" · "+(d.cls==="?"?"?":d.cls.toLowerCase())+" · "+Math.round(d.confidence*100)+"%");
      saveLife();
      if(bot.state==="NAV"&&bot.navPurpose==="frontier"){
        bot.speed=0;
        if(bot.mission)bot.mission.step="NEW VISUAL CONTACT · CHECK RELEVANCE";
        think();
      }
    }
  }
}

function canSeeTarget(){
  if(!bot.target)return false;
  return detections.some(d=>d.o.id===bot.target.id&&d.confidence>.20);
}

function updateHead(dt,time){
  let y=0,p=-.08;
  if(bot.state==="NAV"&&bot.navPurpose==="frontier"){
    bot.scanPhase+=dt;
    y=Math.sin(bot.scanPhase*1.15)*1.05;
    p=Math.sin(bot.scanPhase*.7)>.1?-.42:-.08;
    decisionBadge.textContent=Math.sin(bot.scanPhase*.7)>.1?"MOVING · NEAR FIELD":"MOVING · HORIZON";
  }else if(["SCAN","PICKUP","CONTACT","ACTIVATE_GATE"].includes(bot.state)&&bot.target){
    const bearing=Math.atan2(bot.target.z-bot.z,bot.target.x-bot.x);
    y=clamp(wrap(bearing-bot.heading),-1.55,1.55);
    p=-.18;
  }else if(bot.state==="THINK"){
    y=Math.sin(time*.0007)*.8;p=-.08;
  }else if(bot.state==="UPGRADE"){
    y=-.55;p=-.55;
  }else if(bot.state==="NAV"){
    y=0;p=-.12;
  }
  bot.headTargetYaw=y;bot.headTargetPitch=p;
  const ys=dt*(has("vision")?2.7:2.1),ps=dt*1.7;
  bot.headYaw+=clamp(wrap(bot.headTargetYaw-bot.headYaw),-ys,ys);
  bot.headPitch+=clamp(bot.headTargetPitch-bot.headPitch,-ps,ps);
}

function updateBehavior(dt,time){
  if(bot.state==="THINK"){bot.timer-=dt;if(bot.timer<=0)decideNext()}
  else if(bot.state==="NAV")updateNavigation(dt);
  else if(bot.state==="SCAN"){
    if(canSeeTarget())bot.timer-=dt;
    if(bot.timer<=0)resolveScan();
  }else if(bot.state==="PICKUP"){
    if(canSeeTarget()){bot.timer-=dt;bot.arm=clamp(bot.arm+dt*.7*miningMult(),0,1)}
    if(bot.timer<=0)finishPickup();
  }else if(bot.state==="CONTACT"){
    if(canSeeTarget()){bot.timer-=dt;bot.arm=clamp(bot.arm+dt*.65*miningMult(),0,1)}
    if(bot.timer<=0)finishContact();
  }else if(bot.state==="UPGRADE"){
    bot.timer-=dt;bot.arm=.55+.35*Math.sin(time*.008)**2;
    if(bot.timer<=0)finishUpgrade();
  }else if(bot.state==="ACTIVATE_GATE"){
    if(canSeeTarget()){bot.timer-=dt;bot.arm=clamp(1-bot.timer/2.6,0,1)}
    if(bot.timer<=0)finishPortalActivation();
  }else if(bot.state==="CHARGE"){
    bot.battery=Math.min(100,bot.battery+dt*(has("efficiency")?3.8:2.7));
    if(bot.battery>=72){saveLife();think()}
  }else if(bot.state==="RECOVER"){
    bot.timer-=dt;bot.speed=-.25;bot.heading=wrap(bot.heading+bot.recoverSign*.55*dt);
    bot.x=clamp(bot.x+Math.cos(bot.heading)*bot.speed*dt,-29,29);
    bot.z=clamp(bot.z+Math.sin(bot.heading)*bot.speed*dt,-29,29);
    if(bot.timer<=0){bot.speed=0;think()}
  }else if(bot.state==="TRANSIT"){
    bot.timer-=dt;
    if(bot.timer<=0)advanceMap();
  }
  if(Math.abs(bot.speed)>.06){markVisited();bot.walkPhase+=Math.abs(bot.speed)*dt*8}
  const work=["SCAN","PICKUP","CONTACT","UPGRADE","ACTIVATE_GATE"].includes(bot.state)?.07:0;
  if(bot.state!=="CHARGE")bot.battery=Math.max(0,bot.battery-dt*((Math.abs(bot.speed)>.06?.28:.06)+work)*efficiencyMult());
  if(bot.battery<2&&bot.state!=="CHARGE")startCharge();
}

function activityCopy(){
  const z=bot.target,d=z?Math.hypot(z.x-bot.x,z.z-bot.z):0;
  switch(bot.state){
    case"THINK":return["次の行動を考えています。","現在の最大目標を進める方法を選んでいます。"];
    case"NAV":return[
      bot.navPurpose==="explore"?"見つけた対象へ移動中。":bot.navPurpose==="activate"?"ポータルへ戻っています。":bot.navPurpose==="enter"?"次のディメンションへ向かっています。":"最大目標のため探索移動中。",
      bot.navPurpose==="frontier"?"素材またはポータルの手掛かりを探しながら歩いています。":(z?"目標まで "+d.toFixed(1)+" m。":"移動中。")
    ];
    case"SCAN":return["対象を解析しています。","カメラで正体を確定しています。"];
    case"PICKUP":return["採掘・回収しています。","右腕で対象を回収しています。"];
    case"CONTACT":return["近距離解析中。","対象を詳しく調べています。"];
    case"UPGRADE":return["自己アップグレード中。",bot.upgradeChoice?bot.upgradeChoice.label+" を組み込んでいます。":"モジュールを組み込んでいます。"];
    case"ACTIVATE_GATE":return["ポータルを起動しています。",config.core+" を使用しています。"];
    case"CHARGE":return["エネルギー回復中。","一時停止して行動可能量を回復しています。"];
    case"RECOVER":return["経路復帰中。","別の方向へ抜けます。"];
    case"TRANSIT":return["ポータル通過中。","次のディメンションへ移動します。"];
    default:return["自律動作中。",""];
  }
}

function updateMapUI(){mapText.textContent="DIMENSION "+String(life.mapIndex+1).padStart(2,"0")+" · "+config.name}
function updateUI(){
  const m=mem(),copy=activityCopy(),pct=Math.round(exploration()*100);
  stateText.textContent=bot.state;activityText.textContent=copy[0];detailText.textContent=copy[1];
  const mission=bot.mission;
  missionText.textContent=mission?mission.label:"NO MISSION";
  if(!mission)missionStepText.textContent="次の最大目標を選んでいます。";
  else if(mission.type==="evolve"){
    const d=UPGRADE_DEFS[mission.upgradeId],need=Math.max(0,(d?d.cost:0)-life.materials);
    missionStepText.textContent=mission.step||(need?"改造材料をあと "+need+" 個探します。":"必要材料が揃いました。");
  }else missionStepText.textContent=mission.step||(m.portalActive?"次のディメンションへ進みます。":m.portalKnown?(m.coreHeld?config.core+" をポータルへ運びます。":"起動アイテムを探します。"):"ポータルと起動アイテムを探します。");
  batteryText.textContent="BATTERY "+Math.round(bot.battery)+"%";
  speedText.textContent="SPEED "+Math.abs(bot.speed).toFixed(2)+" m/s";
  partsText.textContent="MATERIALS "+life.materials;
  sampleText.textContent="ANALYSES "+life.analyses;
  exploreText.textContent="EXPLORED "+pct+"%";
  headingText.textContent="H "+Math.round((deg(bot.heading)+360)%360)+"° · HEAD "+Math.round(deg(bot.headYaw))+"°";
  curiosityFill.style.width=Math.round(life.personality.curiosity*100)+"%";
  cautionFill.style.width=Math.round(life.personality.caution*100)+"%";
  improveFill.style.width=Math.round(life.personality.improve*100)+"%";
  curiosityText.textContent=Math.round(life.personality.curiosity*100);
  cautionText.textContent=Math.round(life.personality.caution*100);
  improveText.textContent=Math.round(life.personality.improve*100);
  upgradeList.innerHTML=life.upgrades.length?life.upgrades.map(u=>'<span class="upgrade-chip">'+UPGRADE_DEFS[u].label+' · '+UPGRADE_DEFS[u].effect+'</span>').join(""):'<span class="empty-chip">stock humanoid configuration</span>';
  const inv=[];
  if(m.coreHeld)inv.push(config.core);
  if(m.portalKnown)inv.push(m.portalActive?"PORTAL: ACTIVE":"PORTAL: FOUND");
  if(life.materials)inv.push("MATERIAL UNITS ×"+life.materials);
  inventoryList.innerHTML=inv.length?inv.map(x=>'<span class="item-chip">'+x+'</span>').join(""):'<span class="empty-chip">nothing unusual yet</span>';
}

function shade(hex,amount){
  const n=parseInt(hex.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  const f=1-amount;
  return"rgb("+Math.round(r*f)+","+Math.round(g*f)+","+Math.round(b*f)+")";
}

function worldToScreen(x,z,h,centerX,centerZ,scale){
  const dx=x-centerX,dz=z-centerZ;
  return{
    x:canvas.width*.5+(dx-dz)*scale,
    y:canvas.height*.52+(dx+dz)*scale*.48-h*scale*1.1
  };
}

function drawDiamond(x,y,s,fill,stroke){
  ctx.beginPath();ctx.moveTo(x,y-s*.48);ctx.lineTo(x+s,y);ctx.lineTo(x,y+s*.48);ctx.lineTo(x-s,y);ctx.closePath();
  ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}
}

function drawWorldTile(x,z,centerX,centerZ,scale){
  const h=terrainHeight(x,z),p=worldToScreen(x,z,h,centerX,centerZ,scale);
  drawDiamond(p.x,p.y,scale*.98,config.ground,"rgba(0,0,0,.10)");
}

function drawObjectIso(o,centerX,centerZ,scale){
  if(o.taken)return;
  const h=terrainHeight(o.x,o.z),p=worldToScreen(o.x,o.z,h,centerX,centerZ,scale);
  const s=scale;
  if(o.kind==="gate"){
    const active=mem().portalActive;
    ctx.strokeStyle="#211b2b";ctx.lineWidth=Math.max(4,s*.28);
    ctx.strokeRect(p.x-s*.55,p.y-s*1.35,s*1.1,s*1.35);
    if(active){ctx.fillStyle="rgba(151,76,212,.65)";ctx.fillRect(p.x-s*.43,p.y-s*1.22,s*.86,s*1.10)}
    return;
  }
  if(o.kind==="parts"||o.kind==="core"||o.kind==="geology"){
    const col=o.kind==="parts"?"#777":o.kind==="core"?"#a77b45":config.rock;
    ctx.fillStyle=col;ctx.fillRect(p.x-s*.32,p.y-s*.46,s*.64,s*.46);
    if(o.kind==="parts"){ctx.fillStyle=o.className.includes("REDSTONE")?"#b52b2b":o.className.includes("GOLD")?"#d8b33f":o.className.includes("IRON")?"#c6c6c1":"#e7e0d7";ctx.fillRect(p.x-s*.12,p.y-s*.39,s*.20,s*.16)}
    return;
  }
  if(o.type==="TREE"){
    ctx.fillStyle="#795438";ctx.fillRect(p.x-s*.10,p.y-s*.90,s*.20,s*.90);
    ctx.fillStyle="#447c38";ctx.fillRect(p.x-s*.42,p.y-s*1.38,s*.84,s*.62);
  }else if(o.type==="BASALT"){
    ctx.fillStyle="#39343a";ctx.fillRect(p.x-s*.18,p.y-s*1.05,s*.36,s*1.05);
  }else if(o.type==="CHORUS"){
    ctx.fillStyle="#745b79";ctx.fillRect(p.x-s*.10,p.y-s*.92,s*.20,s*.92);
    ctx.fillStyle="#9a78a2";ctx.fillRect(p.x-s*.27,p.y-s*1.15,s*.54,s*.30);
  }else{
    ctx.fillStyle=config.rock;ctx.fillRect(p.x-s*.18,p.y-s*.22,s*.36,s*.22);
  }
}

function drawBotIso(centerX,centerZ,scale){
  const p=worldToScreen(bot.x,bot.z,terrainHeight(bot.x,bot.z),centerX,centerZ,scale);
  const s=Math.max(12,scale*.85);
  const walk=Math.sin(bot.walkPhase)*s*.12;
  ctx.save();ctx.translate(p.x,p.y);
  ctx.fillStyle="#33383a";
  ctx.fillRect(-s*.22+walk*.15,-s*.72,s*.18,s*.58);
  ctx.fillRect(s*.04-walk*.15,-s*.72,s*.18,s*.58);
  ctx.fillStyle="#b7b7b1";ctx.fillRect(-s*.30,-s*1.28,s*.60,s*.62);
  ctx.fillStyle="#b7b7b1";ctx.fillRect(-s*.47,-s*1.23,s*.16,s*.58);ctx.fillRect(s*.31,-s*1.23,s*.16,s*.58);
  ctx.fillStyle="#b7b7b1";ctx.fillRect(-s*.28,-s*1.72,s*.56,s*.40);
  ctx.fillStyle="#22282a";ctx.fillRect(-s*.27,-s*1.62,s*.04,s*.16);
  ctx.fillStyle="#8ed6c7";ctx.fillRect(s*.17,-s*1.59,s*.05,s*.05);ctx.fillRect(s*.17,-s*1.48,s*.05,s*.05);
  if(has("speed")){ctx.fillStyle="#4f8051";ctx.fillRect(-s*.25,-s*.18,s*.22,s*.10);ctx.fillRect(s*.03,-s*.18,s*.22,s*.10)}
  if(has("vision")){ctx.fillStyle="rgba(80,170,200,.75)";ctx.fillRect(-s*.29,-s*1.60,s*.58,s*.12)}
  if(has("detection")){ctx.fillStyle="#72c6b2";ctx.fillRect(-s*.03,-s*1.92,s*.06,s*.20);ctx.fillRect(-s*.08,-s*1.98,s*.16,s*.08)}
  if(has("efficiency")){ctx.fillStyle="#7bd477";ctx.fillRect(-s*.08,-s*1.08,s*.16,s*.16)}
  if(has("mining")){ctx.strokeStyle="#58b7c5";ctx.lineWidth=Math.max(2,s*.06);ctx.beginPath();ctx.moveTo(s*.40,-s*.74);ctx.lineTo(s*.70,-s*.15);ctx.stroke()}
  ctx.restore();
}

function renderWorld(close){
  const scale=close?26:15,centerX=bot.x,centerZ=bot.z;
  ctx.fillStyle=config.sky;ctx.fillRect(0,0,canvas.width,canvas.height);
  const radius=close?10:18;
  const items=[];
  for(let ix=Math.floor(centerX-radius);ix<=Math.ceil(centerX+radius);ix++){
    for(let iz=Math.floor(centerZ-radius);iz<=Math.ceil(centerZ+radius);iz++){
      if(ix<-31||ix>31||iz<-31||iz>31)continue;
      items.push({kind:"tile",x:ix,z:iz,depth:ix+iz});
    }
  }
  allVisuals().forEach(o=>{if(Math.abs(o.x-centerX)<radius+4&&Math.abs(o.z-centerZ)<radius+4)items.push({kind:"obj",o,depth:o.x+o.z+.3})});
  items.push({kind:"bot",depth:bot.x+bot.z+.5});
  items.sort((a,b)=>a.depth-b.depth);
  for(const it of items){
    if(it.kind==="tile")drawWorldTile(it.x,it.z,centerX,centerZ,scale);
    else if(it.kind==="obj")drawObjectIso(it.o,centerX,centerZ,scale);
    else drawBotIso(centerX,centerZ,scale);
  }
  const b=cameraBearing(),origin=worldToScreen(bot.x,bot.z,terrainHeight(bot.x,bot.z),centerX,centerZ,scale);
  ctx.strokeStyle="rgba(126,220,195,.30)";ctx.lineWidth=1;
  for(const a of [b-FOV*.5,b,b+FOV*.5]){
    const p=worldToScreen(bot.x+Math.cos(a)*6,bot.z+Math.sin(a)*6,terrainHeight(bot.x,bot.z),centerX,centerZ,scale);
    ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(p.x,p.y);ctx.stroke();
  }
}
function renderBotCam(){
  const sky=LIGHTS[lightIndex].name==="NIGHT"?"#162132":config.sky;
  ctx.fillStyle=sky;ctx.fillRect(0,0,canvas.width,canvas.height*.52);
  ctx.fillStyle=config.ground;ctx.fillRect(0,canvas.height*.52,canvas.width,canvas.height*.48);
  for(let i=0;i<8;i++){
    const y=canvas.height*.54+i*36;
    ctx.strokeStyle="rgba(0,0,0,"+(0.05+i*.012)+")";ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();
  }
  const list=detections.slice().sort((a,b)=>b.dist-a.dist);
  for(const d of list){
    const x=canvas.width*.5+Math.tan(d.rel)/Math.tan(FOV*.5)*canvas.width*.5;
    const size=clamp(260/(d.dist+1),14,180)*(d.o.kind==="gate"?1.7:1);
    const baseY=canvas.height*.64+130/(d.dist+2)-bot.headPitch*140;
    let col="#6f6f6f";
    if(d.o.kind==="parts")col=d.cls.includes("REDSTONE")?"#b52b2b":d.cls.includes("GOLD")?"#d4b13f":d.cls.includes("IRON")?"#c6c6c1":"#ded8ce";
    else if(d.o.kind==="core")col="#a77b45";
    else if(d.o.kind==="gate")col="#241c31";
    else if(d.o.type==="TREE")col="#447c38";
    else if(d.o.type==="BASALT")col="#39343a";
    else if(d.o.type==="CHORUS")col="#8e6e96";
    ctx.fillStyle=col;ctx.fillRect(x-size*.5,baseY-size,size,size);
    ctx.strokeStyle=d.cls==="?"?"#e7c07b":"#b7eadf";ctx.lineWidth=1.5;ctx.strokeRect(x-size*.58,baseY-size*1.08,size*1.16,size*1.16);
    ctx.fillStyle="rgba(8,14,10,.72)";ctx.fillRect(x-size*.58,baseY-size*1.08-31,Math.max(82,size*1.16),28);
    ctx.fillStyle=d.cls==="?"?"#f1d19c":"#c7eee5";ctx.font="700 12px ui-monospace, monospace";ctx.fillText(d.cls,x-size*.53,baseY-size*1.08-17);
    ctx.font="10px ui-monospace, monospace";ctx.fillText(Math.round(d.confidence*100)+"% · "+d.dist.toFixed(1)+" m",x-size*.53,baseY-size*1.08-6);
  }
  ctx.strokeStyle="rgba(183,238,225,.5)";ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(canvas.width*.5-12,canvas.height*.5);ctx.lineTo(canvas.width*.5+12,canvas.height*.5);ctx.moveTo(canvas.width*.5,canvas.height*.5-12);ctx.lineTo(canvas.width*.5,canvas.height*.5+12);ctx.stroke();
  const target=detections[0];
  ctx.fillStyle="rgba(7,12,8,.70)";ctx.fillRect(16,canvas.height-60,260,42);
  ctx.fillStyle="#c7eee5";ctx.font="700 13px ui-monospace, monospace";
  ctx.fillText(target?"VISUAL LOCK · "+target.cls:"SEARCHING",26,canvas.height-40);
  ctx.font="10px ui-monospace, monospace";ctx.fillText(target?(Math.round(target.confidence*100)+"% · "+target.dist.toFixed(1)+" m"):"NO VISUAL CONTACT",26,canvas.height-25);
}

function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(viewMode==="botcam")renderBotCam();
  else renderWorld(viewMode==="follow");
  if(LIGHTS[lightIndex].shade>0){
    ctx.fillStyle="rgba(16,18,28,"+LIGHTS[lightIndex].shade+")";ctx.fillRect(0,0,canvas.width,canvas.height);
  }
}

function cycleView(){
  if(!running)return;
  viewIndex=(viewIndex+1)%views.length;viewMode=views[viewIndex];
  const name={world:"WORLD",follow:"FOLLOW",botcam:"BOT CAM"}[viewMode];
  viewBadge.textContent=name;viewName.textContent=name;
}
function setLight(i){lightIndex=i;lightLabel.textContent=LIGHTS[i].name}

function resize(){
  const rect=canvas.getBoundingClientRect();
  const w=Math.max(320,Math.round(rect.width||960)),h=Math.round(w*600/960);
  canvas.width=w;canvas.height=h;
}
window.addEventListener("resize",resize);

enterButton.addEventListener("click",()=>{running=true;intro.hidden=true;log(life.position?"memory restored":"autonomy enabled");think()});
pauseButton.addEventListener("click",()=>{if(!running)return;paused=!paused;pauseButton.textContent=paused?"RESUME":"PAUSE"});
viewButton.addEventListener("click",cycleView);
lightButton.addEventListener("click",()=>setLight((lightIndex+1)%LIGHTS.length));
newLifeButton.addEventListener("click",()=>{if(confirm("Tiny Bot の性格・記憶・改造をすべて初期化しますか？")){localStorage.removeItem(SAVE_KEY);location.reload()}});
window.addEventListener("blur",()=>{if(running&&!paused){paused=true;pauseButton.textContent="RESUME";saveLife()}});

buildWorld();resize();updateMapUI();updateUI();updatePerception();render();
if(life.position)log("saved life found · dimension "+String(life.mapIndex+1).padStart(2,"0"));

function frame(time){
  const dt=Math.min(.04,Math.max(0,(time-lastTime)/1000||.016));lastTime=time;
  if(running&&!paused){
    updateBehavior(dt,time);updateHead(dt,time);updatePerception();updateUI();
    saveTimer+=dt;if(saveTimer>6){saveTimer=0;saveLife()}
  }else updateHead(dt*.2,time);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

})();