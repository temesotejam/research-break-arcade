(() => {
"use strict";

const SAVE_KEY="rba-tiny-bot-retro-world-v1";
const WORLD_SIZE=128;
const HALF=WORLD_SIZE/2;
const VIEW_FOV=Math.PI*120/180;
const SEARCH_CELL=6;
const MAP_CELL=2;

const $=id=>document.getElementById(id);
const canvas=$("roverCanvas"),ctx=canvas.getContext("2d");
const intro=$("intro"),enterButton=$("enterButton");
const viewButton=$("viewButton"),lightButton=$("lightButton"),newLifeButton=$("newLifeButton");
const viewBadge=$("viewBadge"),decisionBadge=$("decisionBadge"),viewName=$("viewName");
const stateText=$("stateText"),mapText=$("mapText"),missionText=$("missionText"),missionStepText=$("missionStepText");
const activityText=$("activityText"),detailText=$("detailText"),batteryText=$("batteryText"),speedText=$("speedText");
const partsText=$("partsText"),sampleText=$("sampleText"),exploreText=$("exploreText"),headingText=$("headingText");
const lightLabel=$("lightLabel"),logList=$("logList"),upgradeList=$("upgradeList"),inventoryList=$("inventoryList");
const curiosityFill=$("curiosityFill"),cautionFill=$("cautionFill"),improveFill=$("improveFill");
const curiosityText=$("curiosityText"),cautionText=$("cautionText"),improveText=$("improveText");

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=(a,b)=>a+Math.random()*(b-a);
const wrap=a=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a};
const deg=r=>r*180/Math.PI;
const dist=(a,b,c,d)=>Math.hypot(a-c,b-d);

const TIMES=[
  {name:"DAY",overlay:"rgba(0,0,0,0)"},
  {name:"SUNSET",overlay:"rgba(109,56,23,.18)"},
  {name:"NIGHT",overlay:"rgba(9,18,52,.48)"}
];

const REGION_THEMES=[
  {
    name:"GREEN KINGDOM",
    colors:{grass:"#5f9f46",grass2:"#70ad52",forest:"#2d6b38",forest2:"#1f532c",water:"#3d78b8",water2:"#5a94d0",mountain:"#77746f",mountain2:"#a19c94",sand:"#cdb66a",road:"#b69a63"},
    gate:"ANCIENT STONE GATE",key:"SUN CREST",ruin:"OLD SHRINE"
  },
  {
    name:"SUNLAND",
    colors:{grass:"#98a650",grass2:"#adb65e",forest:"#526f32",forest2:"#3f5826",water:"#3f8fb6",water2:"#65afca",mountain:"#8a7664",mountain2:"#ad9680",sand:"#d5bd6a",road:"#b89c63"},
    gate:"DESERT ARCH",key:"MOON EMBLEM",ruin:"BURIED TEMPLE"
  },
  {
    name:"SNOW MARCH",
    colors:{grass:"#c5d6d0",grass2:"#d5e4df",forest:"#557568",forest2:"#3e5b50",water:"#6a9fc4",water2:"#91bdd7",mountain:"#8c9296",mountain2:"#b6bcc0",sand:"#d8d1b0",road:"#ada78d"},
    gate:"ICE SHRINE",key:"FROST SIGIL",ruin:"FROZEN RUINS"
  },
  {
    name:"DARKWOOD",
    colors:{grass:"#435f3c",grass2:"#506e47",forest:"#1d3d27",forest2:"#15301f",water:"#315e78",water2:"#417b96",mountain:"#595759",mountain2:"#777477",sand:"#8e8256",road:"#79694c"},
    gate:"FOREST MONOLITH",key:"STAR RELIC",ruin:"LOST SANCTUARY"
  }
];

const UPGRADE_DEFS={
  speed:{label:"MOVEMENT MODULE",cost:2,effect:"MOVE ×1.48"},
  tool:{label:"TOOL MODULE",cost:3,effect:"RECOVER ×1.85"},
  vision:{label:"LONG-RANGE OPTICS",cost:2,effect:"VISION ×1.65"},
  detection:{label:"DETECTION ARRAY",cost:2,effect:"DETECTION +14%"},
  analysis:{label:"FAST ANALYZER",cost:2,effect:"ANALYZE ×1.75"},
  efficiency:{label:"POWER EFFICIENCY",cost:3,effect:"ENERGY ×0.63"}
};

function hash2(x,y,seed){
  let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(seed|0,69069))|0;
  h=(h^(h>>>13));h=Math.imul(h,1274126177);h=h^(h>>>16);
  return (h>>>0)/4294967295;
}
function smooth(t){return t*t*(3-2*t)}
function valueNoise(x,y,scale,seed){
  const fx=x/scale,fy=y/scale,x0=Math.floor(fx),y0=Math.floor(fy),tx=smooth(fx-x0),ty=smooth(fy-y0);
  const a=hash2(x0,y0,seed),b=hash2(x0+1,y0,seed),c=hash2(x0,y0+1,seed),d=hash2(x0+1,y0+1,seed);
  const ab=a+(b-a)*tx,cd=c+(d-c)*tx;
  return ab+(cd-ab)*ty;
}
function regionTheme(index){
  const t=structuredClone(REGION_THEMES[index%REGION_THEMES.length]);
  if(index>=REGION_THEMES.length)t.name=t.name+" FRONTIER "+String(index+1).padStart(2,"0");
  return t;
}

function tileAt(x,y){
  const ix=Math.floor(x),iy=Math.floor(y);
  if(Math.abs(ix)>HALF||Math.abs(iy)>HALF)return"void";
  if(Math.hypot(ix,iy)<4)return"grass";
  const seed=life.regionIndex*997+31;
  const elevation=.55*valueNoise(ix,iy,24,seed)+.30*valueNoise(ix,iy,10,seed+17)+.15*valueNoise(ix,iy,4,seed+43);
  const moisture=.70*valueNoise(ix,iy,21,seed+101)+.30*valueNoise(ix,iy,6,seed+151);
  const detail=valueNoise(ix,iy,3,seed+207);

  if(life.regionIndex%4===1){
    if(elevation<.11)return"water";
    if(elevation>.84)return"mountain";
    if(moisture>.72&&detail>.45)return"forest";
    if(moisture<.63)return"sand";
    return"grass";
  }
  if(life.regionIndex%4===2){
    if(elevation<.14)return"water";
    if(elevation>.80)return"mountain";
    if(moisture>.60)return"forest";
    return detail>.45?"snow":"grass";
  }
  if(life.regionIndex%4===3){
    if(elevation<.16)return"water";
    if(elevation>.82)return"mountain";
    if(moisture>.42)return"forest";
    return detail>.68?"sand":"grass";
  }
  if(elevation<.16)return"water";
  if(elevation>.82)return"mountain";
  if(moisture>.63)return"forest";
  if(moisture<.25&&detail>.55)return"sand";
  return"grass";
}
function passableTile(t){return !["water","mountain","void"].includes(t)}
function terrainSpeed(t){
  if(t==="forest")return .72;
  if(t==="sand")return .84;
  if(t==="snow")return .82;
  return 1;
}

function seeded(seed){
  let s=(seed>>>0)||1;
  return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
}
function findPassable(rand,minR,maxR,used){
  for(let tries=0;tries<1500;tries++){
    const a=rand()*Math.PI*2,r=minR+rand()*(maxR-minR);
    const x=Math.round(Math.cos(a)*r),y=Math.round(Math.sin(a)*r);
    if(!passableTile(tileAt(x,y)))continue;
    if(used.some(p=>dist(x,y,p.x,p.y)<5))continue;
    return{x,y};
  }
  return{x:Math.round(minR),y:0};
}
function makeRegionObjects(){
  const rand=seeded(0x6d2b79f5+life.regionIndex*9187),used=[],out=[];
  const theme=regionTheme(life.regionIndex);

  for(let i=0;i<10;i++){
    const p=findPassable(rand,5,30,used);used.push(p);
    out.push({id:"P-"+life.regionIndex+"-"+i,x:p.x,y:p.y,kind:"parts",label:"lost parts cache",className:"MACHINE PARTS",parts:1+(rand()>.76?1:0),radius:.8});
  }
  for(let i=0;i<6;i++){
    const p=findPassable(rand,7,36,used);used.push(p);
    out.push({id:"R-"+life.regionIndex+"-"+i,x:p.x,y:p.y,kind:"ruin",label:theme.ruin,className:theme.ruin,interest:.45+rand()*.5,radius:1.2});
  }
  const key=findPassable(rand,14,28,used);used.push(key);
  out.push({id:"KEY-"+life.regionIndex,x:key.x,y:key.y,kind:"core",label:theme.key,className:theme.key,radius:.9});

  const gate=findPassable(rand,32,48,used);used.push(gate);
  out.push({id:"GATE-"+life.regionIndex,x:gate.x,y:gate.y,kind:"gate",label:theme.gate,className:theme.gate,radius:2.1});

  return out;
}

function freshLife(){
  return{
    version:1,regionIndex:0,parts:0,discoveries:0,battery:100,upgrades:[],
    personality:{curiosity:rnd(.48,.90),caution:rnd(.36,.80),improve:rnd(.45,.92)},
    exp:{stucks:0,charges:0,distance:0,scans:0,gates:0},
    regions:{},position:null,currentMission:null,lastSeen:Date.now()
  };
}
function loadLife(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);if(!raw)return freshLife();
    const v=JSON.parse(raw);return v&&v.version===1?v:freshLife();
  }catch(_){return freshLife()}
}
let life=loadLife();

function mem(){
  const k=String(life.regionIndex);
  if(!life.regions[k])life.regions[k]={seen:[],discovered:[],recognized:{},keyHeld:false,gateKnown:false,gateActive:false,visited:[],mapped:[],worldVersion:3};
  const m=life.regions[k];
  if(!Array.isArray(m.seen))m.seen=[];
  if(!Array.isArray(m.discovered))m.discovered=[];
  if(!m.recognized)m.recognized={};
  if(m.worldVersion!==3){m.visited=[];m.mapped=[];m.worldVersion=3;}
  if(!Array.isArray(m.visited))m.visited=[];
  if(!Array.isArray(m.mapped))m.mapped=[];
  return m;
}

let theme=regionTheme(life.regionIndex);
let zones=[];
let logs=[];
let running=false,lastTime=performance.now(),lastWall=Date.now(),saveTimer=0,timeIndex=0;
let backgroundTimer=null,hiddenSince=null;
let viewMode="world",viewIndex=0;
const views=["world","close","sensor"];
let detections=[];
const miniCanvas=document.createElement("canvas");
miniCanvas.width=WORLD_SIZE/MAP_CELL;miniCanvas.height=WORLD_SIZE/MAP_CELL;
const miniCtx=miniCanvas.getContext("2d");
let mappedSet=new Set();

const bot={
  x:0,y:0,heading:0,speed:0,targetSpeed:0,battery:life.battery||100,state:"THINK",timer:1,
  target:null,goal:null,navPurpose:null,prevDist:Infinity,stuckTime:0,recoverSign:1,
  arm:0,walkPhase:0,upgradeChoice:null,
  mission:life.currentMission&&life.currentMission.regionIndex===life.regionIndex?structuredClone(life.currentMission):null
};
if(life.position&&life.position.regionIndex===life.regionIndex){
  bot.x=clamp(life.position.x,-HALF+2,HALF-2);
  bot.y=clamp(life.position.y,-HALF+2,HALF-2);
  bot.heading=life.position.heading;
}
if(bot.mission&&!["evolve","advance"].includes(bot.mission.type))bot.mission=null;

function mapCellKey(cx,cy){return cx+","+cy}
function mapCellFromWorld(x,y){
  return{
    cx:clamp(Math.floor((x+HALF)/MAP_CELL),0,miniCanvas.width-1),
    cy:clamp(Math.floor((y+HALF)/MAP_CELL),0,miniCanvas.height-1)
  };
}
function miniColorForTile(t){
  const c=theme.colors;
  if(t==="forest")return c.forest;
  if(t==="water")return c.water;
  if(t==="mountain")return c.mountain;
  if(t==="sand")return c.sand;
  if(t==="snow")return "#d6e3e3";
  return c.grass;
}
function paintMiniCell(cx,cy){
  const wx=-HALF+cx*MAP_CELL+MAP_CELL*.5,wy=-HALF+cy*MAP_CELL+MAP_CELL*.5;
  miniCtx.fillStyle=miniColorForTile(tileAt(wx,wy));
  miniCtx.fillRect(cx,cy,1,1);
}
function resetMiniMap(){
  mappedSet=new Set(mem().mapped);
  miniCtx.fillStyle="#060706";miniCtx.fillRect(0,0,miniCanvas.width,miniCanvas.height);
  for(const key of mappedSet){
    const [cx,cy]=key.split(",").map(Number);
    paintMiniCell(cx,cy);
  }
}
function mapCellKnown(cx,cy){
  const key=mapCellKey(cx,cy);
  if(mappedSet.has(key))return false;
  mappedSet.add(key);mem().mapped.push(key);paintMiniCell(cx,cy);return true;
}
function revealMappedArea(){
  const range=visionRange(),radius=Math.ceil(range/MAP_CELL),base=mapCellFromWorld(bot.x,bot.y);
  // Immediate surroundings are always known.
  for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
    const cx=base.cx+ox,cy=base.cy+oy;
    if(cx>=0&&cy>=0&&cx<miniCanvas.width&&cy<miniCanvas.height)mapCellKnown(cx,cy);
  }
  for(let oy=-radius;oy<=radius;oy++)for(let ox=-radius;ox<=radius;ox++){
    const cx=base.cx+ox,cy=base.cy+oy;
    if(cx<0||cy<0||cx>=miniCanvas.width||cy>=miniCanvas.height)continue;
    const wx=-HALF+cx*MAP_CELL+MAP_CELL*.5,wy=-HALF+cy*MAP_CELL+MAP_CELL*.5;
    const d=dist(bot.x,bot.y,wx,wy);if(d>range)continue;
    const rel=wrap(Math.atan2(wy-bot.y,wx-bot.x)-bot.heading);
    if(d>3&&Math.abs(rel)>VIEW_FOV*.5)continue;
    let blocked=false;
    const steps=Math.ceil(d/2);
    for(let i=1;i<steps;i++){
      const t=i/steps,tx=bot.x+(wx-bot.x)*t,ty=bot.y+(wy-bot.y)*t;
      if(tileAt(tx,ty)==="mountain"){blocked=true;break}
    }
    if(!blocked)mapCellKnown(cx,cy);
  }
}

function buildRegion(){
  theme=regionTheme(life.regionIndex);
  const discovered=new Set(mem().discovered);
  zones=makeRegionObjects().map(z=>({...z,taken:discovered.has(z.id)&&(z.kind==="parts"||z.kind==="core")}));
  resetMiniMap();
  mapText.textContent="REGION "+String(life.regionIndex+1).padStart(2,"0")+" · "+theme.name;
}
function saveLife(){
  life.battery=bot.battery;
  life.position={regionIndex:life.regionIndex,x:bot.x,y:bot.y,heading:bot.heading};
  life.currentMission=bot.mission?structuredClone(bot.mission):null;
  life.lastSeen=Date.now();
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(life))}catch(_){}
}
function log(msg){
  logs.unshift(msg);if(logs.length>7)logs.length=7;
  logList.innerHTML=logs.map(x=>"<span>"+x+"</span>").join("");
}
function has(id){return life.upgrades.includes(id)}
function movementMult(){return has("speed")?1.48:1}
function toolMult(){return has("tool")?1.85:1}
function visionRange(){return has("vision")?22:13.5}
function detectionBoost(){return has("detection")?.14:0}
function analysisMult(){return has("analysis")?1.75:1}
function efficiencyMult(){return has("efficiency")?.63:1}

function recognitionLabel(z){
  const m=mem();
  if(m.recognized[z.id])return m.recognized[z.id];
  if(m.discovered.includes(z.id))return z.className;
  return"?";
}
function identify(z){mem().recognized[z.id]=z.className}
function exploration(){
  const m=mem();
  return m.visited.length;
}
function seenUnresolved(){
  const m=mem(),done=new Set(m.discovered);
  return zones.filter(z=>m.seen.includes(z.id)&&!done.has(z.id));
}
function unseenImportant(){
  const seen=new Set(mem().seen);
  return zones.filter(z=>!seen.has(z.id));
}

function searchCellKey(x,y){return Math.round(x/SEARCH_CELL)+","+Math.round(y/SEARCH_CELL)}
function markVisited(){
  const k=searchCellKey(bot.x,bot.y),m=mem();
  if(!m.visited.includes(k))m.visited.push(k);
}
function chooseFrontier(){
  const m=mem(),visited=new Set(m.visited),cx=Math.round(bot.x/SEARCH_CELL),cy=Math.round(bot.y/SEARCH_CELL),c=[];
  const desired=12+life.personality.curiosity*8;
  for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=3;dy++){
    if(dx===0&&dy===0)continue;
    const gx=cx+dx,gy=cy+dy,key=gx+","+gy,x=gx*SEARCH_CELL,y=gy*SEARCH_CELL;
    if(Math.abs(x)>HALF-7||Math.abs(y)>HALF-7||visited.has(key))continue;
    if(!passableTile(tileAt(x,y)))continue;
    const d=dist(bot.x,bot.y,x,y);
    const outward=Math.hypot(x,y)-Math.hypot(bot.x,bot.y);
    c.push({x,y,key,score:-Math.abs(d-desired)*.055+Math.max(0,outward)*.008+Math.random()*2.5});
  }
  if(!c.length){
    m.visited=[];
    return chooseFrontier();
  }
  c.sort((a,b)=>b.score-a.score);
  return c[0];
}

function upgradeNeeds(){
  const e=life.exp;
  return{
    speed:clamp(.30+e.distance/1200+e.stucks*.08,0,1),
    tool:clamp(.28+life.parts*.08+e.scans*.025,0,1),
    vision:clamp(.34+unseenImportant().length/zones.length*.42,0,1),
    detection:clamp(.32+unseenImportant().length/zones.length*.38+e.scans*.02,0,1),
    analysis:clamp(.28+e.scans*.04+life.regionIndex*.04,0,1),
    efficiency:clamp(.22+e.charges*.15+e.distance/1600,0,1)
  };
}
function desiredUpgrade(){
  const needs=upgradeNeeds();let best=null;
  for(const [id,d] of Object.entries(UPGRADE_DEFS)){
    if(has(id))continue;
    const score=life.personality.improve*34+needs[id]*52+(life.parts>=d.cost?13:0)+Math.random()*7;
    if(!best||score>best.score)best={id,...d,score,need:needs[id]};
  }
  return best;
}
function setMission(m,reason){
  bot.mission={...m,regionIndex:life.regionIndex,startedAt:Date.now()};
  life.currentMission=structuredClone(bot.mission);
  log("mission: "+bot.mission.label.toLowerCase()+" · "+reason);
  decisionBadge.textContent="MISSION · "+bot.mission.label;saveLife();
}
function finishMission(note){
  if(bot.mission)log("mission complete · "+bot.mission.label.toLowerCase()+" · "+note);
  bot.mission=null;life.currentMission=null;saveLife();think();
}
function think(){
  bot.state="THINK";bot.timer=.65+rnd(.20,.55);bot.speed=0;bot.arm=0;
  decisionBadge.textContent=bot.mission?"MISSION · "+bot.mission.label:"THINKING…";
}
function usefulTarget(mission){
  const m=mem(),done=new Set(m.discovered),c=zones.filter(z=>m.seen.includes(z.id)&&!done.has(z.id));
  if(mission.type==="evolve"){
    const parts=c.filter(z=>z.kind==="parts");
    if(parts.length)return parts.sort((a,b)=>dist(bot.x,bot.y,a.x,a.y)-dist(bot.x,bot.y,b.x,b.y))[0];
    return c.find(z=>recognitionLabel(z)==="?")||null;
  }
  const path=c.filter(z=>z.kind==="core"||z.kind==="gate");
  if(path.length)return path.sort((a,b)=>dist(bot.x,bot.y,a.x,a.y)-dist(bot.x,bot.y,b.x,b.y))[0];
  return c.find(z=>recognitionLabel(z)==="?")||null;
}
function chooseMission(){
  const m=mem(),p=life.personality,up=desiredUpgrade();
  if(!up){setMission({type:"advance",label:"REACH NEXT REGION"},"all current upgrades completed");continueMission();return}
  const upProgress=clamp(life.parts/up.cost,0,1);
  const gateProgress=(m.gateKnown?.35:0)+(m.keyHeld?.35:0)+(m.gateActive?.45:0);
  const evolve=48+p.improve*34+up.need*24+upProgress*20+Math.random()*6;
  const advance=44+p.curiosity*30+gateProgress*34+(life.upgrades.length>=2?8:0)+Math.random()*6;
  if(advance>evolve)setMission({type:"advance",label:"REACH NEXT REGION"},"the next region is the stronger objective");
  else setMission({type:"evolve",upgradeId:up.id,label:"SELF EVOLUTION · "+up.label},"capability improvement is the stronger objective");
  continueMission();
}
function startFrontierTravel(reason){
  const g=chooseFrontier();
  startNavigation({x:g.x,y:g.y},"frontier",null,3.0*movementMult());
  log(reason+" · search cell "+g.key);
}
function continueMission(){
  const mission=bot.mission;if(!mission){chooseMission();return}
  const m=mem();
  if(bot.battery<25+life.personality.caution*18){startCharge();return}

  if(mission.type==="evolve"){
    const d=UPGRADE_DEFS[mission.upgradeId];
    if(!d||has(mission.upgradeId)){finishMission("capability acquired");return}
    if(life.parts>=d.cost){mission.step="INSTALLING "+d.label;startUpgrade({id:mission.upgradeId,...d});return}
    const t=usefulTarget(mission);
    if(t){mission.step="CHECK "+t.id+" FOR PARTS";navigateToZone(t);return}
    const missing=d.cost-life.parts;
    mission.step="FIND "+missing+" MORE PART"+(missing===1?"":"S")+" FOR "+d.label;
    startFrontierTravel("searching for upgrade parts");return;
  }

  if(mission.type==="advance"){
    if(m.gateActive){mission.step="PASS THROUGH THE ACTIVE GATE";navigateToGate("enter");return}
    if(m.gateKnown&&m.keyHeld){mission.step="BRING "+theme.key+" TO "+theme.gate;navigateToGate("activate");return}
    const t=usefulTarget(mission);
    if(t){mission.step="CHECK "+t.id+" FOR A WAY FORWARD";navigateToZone(t);return}
    mission.step=!m.gateKnown&&!m.keyHeld?"FIND THE GATE OR ITS KEY":(!m.gateKnown?"FIND THE ANCIENT GATE":"FIND THE GATE KEY");
    startFrontierTravel("searching for the next region");return;
  }
  bot.mission=null;think();
}
function decideNext(){bot.mission?continueMission():chooseMission()}

function startNavigation(goal,purpose,target,speed){
  bot.goal=goal;bot.navPurpose=purpose;bot.target=target;bot.state="NAV";bot.targetSpeed=speed;bot.prevDist=Infinity;bot.stuckTime=0;
}
function navigateToZone(z){
  const dx=bot.x-z.x,dy=bot.y-z.y,d=Math.max(.001,Math.hypot(dx,dy));
  const stand=z.kind==="gate"?2.5:1.5;
  startNavigation({x:z.x+dx/d*stand,y:z.y+dy/d*stand},"explore",z,3.0*movementMult());
  log("target selected · "+z.id);
}
function gateZone(){return zones.find(z=>z.kind==="gate")}
function navigateToGate(purpose){
  const g=gateZone();if(!g){think();return}
  const angle=Math.atan2(bot.y-g.y,bot.x-g.x);
  startNavigation({x:g.x+Math.cos(angle)*3,y:g.y+Math.sin(angle)*3},purpose,g,2.8*movementMult());
}

function bestHeading(goal){
  const desired=Math.atan2(goal.y-bot.y,goal.x-bot.x);
  const offsets=[0,.22,-.22,.45,-.45,.75,-.75,1.1,-1.1,1.55,-1.55];
  let best=desired,bestScore=-1e9;
  for(const off of offsets){
    const a=desired+off,nx=bot.x+Math.cos(a)*1.25,ny=bot.y+Math.sin(a)*1.25,t=tileAt(nx,ny);
    if(!passableTile(t))continue;
    const align=Math.cos(off)*2.2;
    const terrain=terrainSpeed(t);
    let objectPenalty=0;
    for(const z of zones){
      if(z.taken||bot.target&&z.id===bot.target.id)continue;
      if((z.kind==="gate"||z.kind==="ruin")&&dist(nx,ny,z.x,z.y)<z.radius+.7)objectPenalty-=3;
    }
    const score=align+terrain+objectPenalty+Math.random()*.08;
    if(score>bestScore){bestScore=score;best=a}
  }
  return best;
}
function updateNavigation(dt){
  if(!bot.goal){think();return}
  const d=dist(bot.x,bot.y,bot.goal.x,bot.goal.y),desired=bestHeading(bot.goal),err=wrap(desired-bot.heading);
  bot.heading=wrap(bot.heading+clamp(err*2.4,-2.0,2.0)*dt);
  const terr=terrainSpeed(tileAt(bot.x,bot.y)),turn=1-clamp(Math.abs(err)/1.6,0,.55),target=bot.targetSpeed*terr*turn;
  bot.speed+=(target-bot.speed)*Math.min(1,dt*3.2);
  const step=bot.speed*dt,nx=bot.x+Math.cos(bot.heading)*step,ny=bot.y+Math.sin(bot.heading)*step;
  if(passableTile(tileAt(nx,ny))){
    bot.x=clamp(nx,-HALF+2,HALF-2);bot.y=clamp(ny,-HALF+2,HALF-2);life.exp.distance+=Math.abs(step);
  }else bot.speed*=.35;

  if(d>bot.prevDist-.01)bot.stuckTime+=dt;else bot.stuckTime=Math.max(0,bot.stuckTime-dt*.8);
  bot.prevDist=d;
  if(bot.stuckTime>4.0){
    life.exp.stucks++;bot.state="RECOVER";bot.timer=1.2;bot.recoverSign=Math.random()<.5?-1:1;bot.stuckTime=0;log("route blocked · changing course");return;
  }

  if(d<.6){
    bot.speed=0;
    if(bot.navPurpose==="explore")startScan(bot.target);
    else if(bot.navPurpose==="activate")startGateActivation();
    else if(bot.navPurpose==="enter")startTransit();
    else if(bot.navPurpose==="frontier"){markVisited();log("search cell reached");saveLife();think()}
    else think();
  }
}
function startScan(z){bot.state="SCAN";bot.target=z;bot.timer=2.5/analysisMult();bot.arm=0;life.exp.scans++;log("inspect · "+z.id)}
function resolveScan(){
  const z=bot.target,m=mem();identify(z);
  if(z.kind==="gate"){
    if(!m.discovered.includes(z.id))m.discovered.push(z.id);m.gateKnown=true;life.discoveries++;log("ancient gate identified");saveLife();think();return;
  }
  if(z.kind==="core"){bot.state="PICKUP";bot.timer=2.1/toolMult();bot.arm=0;log("gate key identified · "+z.className.toLowerCase());return}
  if(z.kind==="parts"){bot.state="PICKUP";bot.timer=1.7/toolMult();bot.arm=0;log("usable parts found");return}
  if(!m.discovered.includes(z.id))m.discovered.push(z.id);
  life.discoveries++;
  if((z.interest||0)>.72){bot.state="CONTACT";bot.timer=1.6/analysisMult();bot.arm=0;log("closer inspection selected")}
  else{saveLife();think()}
}
function finishPickup(){
  const z=bot.target,m=mem();if(!m.discovered.includes(z.id))m.discovered.push(z.id);
  if(z.kind==="core"){m.keyHeld=true;z.taken=true;log("inventory + "+z.className.toLowerCase())}
  else{life.parts+=z.parts||1;z.taken=true;log("recovered parts · +"+(z.parts||1))}
  life.discoveries++;saveLife();think();
}
function finishContact(){life.discoveries++;log("discovery recorded · "+bot.target.label.toLowerCase());saveLife();think()}
function startUpgrade(up){bot.state="UPGRADE";bot.timer=3.4;bot.upgradeChoice=up;bot.arm=0;log("self-upgrade · "+up.label.toLowerCase())}
function finishUpgrade(){
  const up=bot.upgradeChoice;if(!up||life.parts<up.cost){think();return}
  life.parts-=up.cost;life.upgrades.push(up.id);log("upgrade installed · "+up.label.toLowerCase());saveLife();
  if(bot.mission&&bot.mission.type==="evolve"&&bot.mission.upgradeId===up.id)finishMission("upgrade installed");else think();
}
function startCharge(){bot.state="CHARGE";bot.speed=0;bot.arm=0;life.exp.charges++;log("energy recovery")}
function startGateActivation(){bot.state="ACTIVATE_GATE";bot.timer=2.7;bot.arm=0;log("using "+theme.key.toLowerCase()+" on "+theme.gate.toLowerCase())}
function finishGateActivation(){const m=mem();m.keyHeld=false;m.gateActive=true;life.exp.gates++;log(theme.gate.toLowerCase()+" activated");saveLife();think()}
function startTransit(){bot.state="TRANSIT";bot.timer=1.8;bot.speed=0;log("passing through "+theme.gate.toLowerCase())}
function advanceRegion(){
  life.regionIndex++;life.position=null;life.currentMission=null;bot.mission=null;bot.x=0;bot.y=0;bot.heading=rnd(-Math.PI,Math.PI);bot.speed=0;bot.target=null;
  buildRegion();bot.battery=Math.min(100,bot.battery+15);log("entered region · "+theme.name.toLowerCase());saveLife();think();
}

function lineVisibility(z){
  const d=dist(bot.x,bot.y,z.x,z.y),steps=Math.ceil(d);
  let forestCount=0;
  for(let i=1;i<steps;i++){
    const t=i/steps,x=bot.x+(z.x-bot.x)*t,y=bot.y+(z.y-bot.y)*t,tile=tileAt(x,y);
    if(tile==="mountain")return{blocked:true,forest:forestCount};
    if(tile==="forest")forestCount++;
  }
  return{blocked:false,forest:forestCount};
}
function detectObjects(){
  const out=[],range=visionRange();
  for(const z of zones){
    if(z.taken)continue;
    const d=dist(bot.x,bot.y,z.x,z.y);if(d<.2||d>range)continue;
    const rel=wrap(Math.atan2(z.y-bot.y,z.x-bot.x)-bot.heading);
    if(d>3&&Math.abs(rel)>VIEW_FOV*.5)continue;
    const los=lineVisibility(z);if(los.blocked)continue;
    const center=1-clamp(Math.abs(rel)/(VIEW_FOV*.5),0,1),distance=1-d/range,forestPenalty=Math.min(.35,los.forest*.025);
    const confidence=clamp(.26+.28*center+.30*distance+detectionBoost()-forestPenalty,.05,.99);
    if(confidence<.24)continue;
    let cls=recognitionLabel(z);
    if(z.kind==="ruin"&&cls==="?"&&confidence>.68)cls="RUINS";
    out.push({z,d,rel,confidence,cls});
  }
  out.sort((a,b)=>Math.abs(a.rel)-Math.abs(b.rel)||a.d-b.d);
  return out;
}
function updatePerception(){
  revealMappedArea();
  detections=detectObjects();const m=mem();
  for(const d of detections){
    const z=d.z;
    if(d.confidence>=.32&&!m.seen.includes(z.id)){
      m.seen.push(z.id);
      log("visual contact · "+z.id+" · "+(d.cls==="?"?"?":d.cls.toLowerCase())+" · "+Math.round(d.confidence*100)+"%");
      saveLife();
      if(bot.state==="NAV"&&bot.navPurpose==="frontier"){bot.speed=0;if(bot.mission)bot.mission.step="NEW CLUE FOUND · CHECK RELEVANCE";think()}
    }
  }
}
function canSeeTarget(){return bot.target&&detections.some(d=>d.z.id===bot.target.id&&d.confidence>.20)}

function updateBehavior(dt,time){
  if(bot.state==="THINK"){bot.timer-=dt;if(bot.timer<=0)decideNext()}
  else if(bot.state==="NAV")updateNavigation(dt);
  else if(bot.state==="SCAN"){if(canSeeTarget())bot.timer-=dt;if(bot.timer<=0)resolveScan()}
  else if(bot.state==="PICKUP"){if(canSeeTarget()){bot.timer-=dt;bot.arm=clamp(bot.arm+dt*.72*toolMult(),0,1)}if(bot.timer<=0)finishPickup()}
  else if(bot.state==="CONTACT"){if(canSeeTarget()){bot.timer-=dt;bot.arm=clamp(bot.arm+dt*.65*analysisMult(),0,1)}if(bot.timer<=0)finishContact()}
  else if(bot.state==="UPGRADE"){bot.timer-=dt;bot.arm=.55+.35*Math.sin(time*.008)**2;if(bot.timer<=0)finishUpgrade()}
  else if(bot.state==="ACTIVATE_GATE"){if(canSeeTarget()){bot.timer-=dt;bot.arm=clamp(1-bot.timer/2.7,0,1)}if(bot.timer<=0)finishGateActivation()}
  else if(bot.state==="CHARGE"){bot.battery=Math.min(100,bot.battery+dt*(has("efficiency")?3.8:2.6));if(bot.battery>=74){saveLife();think()}}
  else if(bot.state==="RECOVER"){bot.timer-=dt;bot.heading=wrap(bot.heading+bot.recoverSign*1.5*dt);if(bot.timer<=0)think()}
  else if(bot.state==="TRANSIT"){bot.timer-=dt;if(bot.timer<=0)advanceRegion()}

  if(Math.abs(bot.speed)>.05){markVisited();bot.walkPhase+=Math.abs(bot.speed)*dt*5.2}
  const work=["SCAN","PICKUP","CONTACT","UPGRADE","ACTIVATE_GATE"].includes(bot.state)?.06:0;
  if(bot.state!=="CHARGE")bot.battery=Math.max(0,bot.battery-dt*((Math.abs(bot.speed)>.05?.16:.035)+work)*efficiencyMult());
  if(bot.battery<2&&bot.state!=="CHARGE")startCharge();
}

function activityCopy(){
  const z=bot.target,d=z?dist(bot.x,bot.y,z.x,z.y):0;
  switch(bot.state){
    case"THINK":return["次の行動を考えています。","現在の最大目標を進める方法を選んでいます。"];
    case"NAV":return[
      bot.navPurpose==="explore"?"見つけた場所へ向かっています。":bot.navPurpose==="activate"?"古代の門へ戻っています。":bot.navPurpose==="enter"?"次の地域へ向かっています。":"最大目標のため探索移動中。",
      bot.navPurpose==="frontier"?"部品または次地域への手掛かりを探しています。":(z?"目標まで "+d.toFixed(1)+" tile。":"移動中。")
    ];
    case"SCAN":return["対象を調べています。","何なのかを確認しています。"];
    case"PICKUP":return["回収しています。","右腕で部品・遺物を回収しています。"];
    case"CONTACT":return["近距離調査中。","遺跡を詳しく確認しています。"];
    case"UPGRADE":return["自己アップグレード中。",bot.upgradeChoice?bot.upgradeChoice.label+" を組み込んでいます。":"モジュールを組み込んでいます。"];
    case"ACTIVATE_GATE":return["古代の門を起動しています。",theme.key+" を使用しています。"];
    case"CHARGE":return["エネルギー回復中。","しばらく停止します。"];
    case"RECOVER":return["経路を変更しています。","通れない地形を避けます。"];
    case"TRANSIT":return["門を通過しています。","次の地域へ移動します。"];
    default:return["自律動作中。",""];
  }
}

function updateUI(){
  const m=mem(),copy=activityCopy();
  stateText.textContent=bot.state;activityText.textContent=copy[0];detailText.textContent=copy[1];
  mapText.textContent="REGION "+String(life.regionIndex+1).padStart(2,"0")+" · "+theme.name;
  missionText.textContent=bot.mission?bot.mission.label:"NO MISSION";
  if(!bot.mission)missionStepText.textContent="次の最大目標を選んでいます。";
  else if(bot.mission.type==="evolve"){
    const d=UPGRADE_DEFS[bot.mission.upgradeId],need=Math.max(0,(d?d.cost:0)-life.parts);
    missionStepText.textContent=bot.mission.step||(need?"改造部品をあと "+need+" 個探します。":"必要部品が揃いました。");
  }else{
    missionStepText.textContent=bot.mission.step||(m.gateActive?"門は起動済みです。次の地域へ進みます。":m.gateKnown?(m.keyHeld?theme.key+" を門へ運びます。":"門を開く遺物を探します。"):"古代の門とキー遺物を探します。");
  }
  batteryText.textContent="BATTERY "+Math.round(bot.battery)+"%";
  speedText.textContent="SPEED "+Math.abs(bot.speed).toFixed(2)+" tile/s";
  partsText.textContent="PARTS "+life.parts;
  sampleText.textContent="DISCOVERIES "+life.discoveries;
  const mappedPct=mappedSet.size/(miniCanvas.width*miniCanvas.height)*100;
  exploreText.textContent="MAPPED "+mappedPct.toFixed(mappedPct<10?1:0)+"%";
  headingText.textContent="X "+Math.round(bot.x)+" · Y "+Math.round(bot.y)+" · DIR "+Math.round((deg(bot.heading)+360)%360)+"°";
  curiosityFill.style.width=Math.round(life.personality.curiosity*100)+"%";
  cautionFill.style.width=Math.round(life.personality.caution*100)+"%";
  improveFill.style.width=Math.round(life.personality.improve*100)+"%";
  curiosityText.textContent=Math.round(life.personality.curiosity*100);
  cautionText.textContent=Math.round(life.personality.caution*100);
  improveText.textContent=Math.round(life.personality.improve*100);
  upgradeList.innerHTML=life.upgrades.length?life.upgrades.map(u=>'<span class="upgrade-chip">'+UPGRADE_DEFS[u].label+' · '+UPGRADE_DEFS[u].effect+'</span>').join(""):'<span class="empty-chip">stock configuration</span>';
  const inv=[];if(m.keyHeld)inv.push(theme.key);if(m.gateKnown)inv.push(m.gateActive?"GATE: ACTIVE":"GATE: FOUND");if(life.parts)inv.push("PARTS ×"+life.parts);
  inventoryList.innerHTML=inv.length?inv.map(x=>'<span class="item-chip">'+x+'</span>').join(""):'<span class="empty-chip">nothing important yet</span>';
}

function drawTile(tx,ty,px,py,size,type){
  const c=theme.colors;
  let fill=c.grass;
  if(type==="forest")fill=c.forest;
  else if(type==="water")fill=c.water;
  else if(type==="mountain")fill=c.mountain;
  else if(type==="sand")fill=c.sand;
  else if(type==="snow")fill="#d6e3e3";
  else if(type==="void")fill="#0b0c10";
  ctx.fillStyle=fill;ctx.fillRect(px,py,size,size);

  const h=hash2(tx,ty,life.regionIndex*71+5);
  if(type==="grass"){
    ctx.fillStyle=h>.5?c.grass2:"rgba(255,255,255,.08)";
    ctx.fillRect(px+3+(h*7|0),py+5,size>26?3:2,size>26?3:2);
  }else if(type==="forest"){
    ctx.fillStyle=c.forest2;
    ctx.fillRect(px+size*.22,py+size*.18,size*.56,size*.48);
    ctx.fillStyle="#5a432b";ctx.fillRect(px+size*.44,py+size*.62,size*.12,size*.26);
  }else if(type==="water"){
    ctx.fillStyle=c.water2;ctx.fillRect(px+3,py+size*.30,size*.50,2);ctx.fillRect(px+size*.45,py+size*.68,size*.40,2);
  }else if(type==="mountain"){
    ctx.fillStyle=c.mountain2;
    ctx.beginPath();ctx.moveTo(px+size*.15,py+size*.78);ctx.lineTo(px+size*.5,py+size*.15);ctx.lineTo(px+size*.85,py+size*.78);ctx.closePath();ctx.fill();
  }else if(type==="sand"){
    ctx.fillStyle="rgba(90,70,30,.18)";ctx.fillRect(px+size*.25,py+size*.30,2,2);ctx.fillRect(px+size*.70,py+size*.72,2,2);
  }else if(type==="snow"){
    ctx.fillStyle="rgba(95,130,150,.20)";ctx.fillRect(px+size*.25,py+size*.55,size*.35,2);
  }
  ctx.strokeStyle="rgba(0,0,0,.055)";ctx.strokeRect(px+.5,py+.5,size-1,size-1);
}

function screenFor(x,y,tileSize){
  return{x:canvas.width*.5+(x-bot.x)*tileSize,y:canvas.height*.5+(y-bot.y)*tileSize};
}
function drawPOI(z,tileSize){
  if(z.taken)return;
  const p=screenFor(z.x,z.y,tileSize);
  if(p.x<-40||p.y<-40||p.x>canvas.width+40||p.y>canvas.height+40)return;
  const s=Math.max(8,tileSize*.62),known=mem().seen.includes(z.id);
  ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));
  if(z.kind==="parts"){
    ctx.fillStyle="#7c603c";ctx.fillRect(-s*.45,-s*.35,s*.9,s*.70);
    ctx.fillStyle="#d7b85f";ctx.fillRect(-s*.34,-s*.28,s*.68,s*.12);
  }else if(z.kind==="ruin"){
    ctx.fillStyle="#aaa48b";ctx.fillRect(-s*.45,-s*.55,s*.25,s);ctx.fillRect(s*.20,-s*.55,s*.25,s);ctx.fillRect(-s*.45,-s*.55,s*.90,s*.20);
  }else if(z.kind==="core"){
    ctx.fillStyle="#e4d36b";ctx.beginPath();ctx.moveTo(0,-s*.55);ctx.lineTo(s*.45,0);ctx.lineTo(0,s*.55);ctx.lineTo(-s*.45,0);ctx.closePath();ctx.fill();
  }else if(z.kind==="gate"){
    ctx.fillStyle="#6f6c64";ctx.fillRect(-s*.60,-s*.75,s*.25,s*1.5);ctx.fillRect(s*.35,-s*.75,s*.25,s*1.5);ctx.fillRect(-s*.60,-s*.75,s*1.2,s*.25);
    if(mem().gateActive){ctx.fillStyle="rgba(103,180,220,.75)";ctx.fillRect(-s*.25,-s*.48,s*.5,s*.98)}
  }
  if(known){
    ctx.fillStyle="rgba(12,14,12,.72)";ctx.fillRect(-s*.65,s*.62,s*1.3,12);
    ctx.fillStyle="#f4f0d8";ctx.font="9px ui-monospace,monospace";ctx.textAlign="center";ctx.fillText(recognitionLabel(z),0,s*.62+9);
  }
  ctx.restore();
}

function facing4(){
  const a=(bot.heading+Math.PI*2)%(Math.PI*2);
  if(a<Math.PI*.25||a>=Math.PI*1.75)return"right";
  if(a<Math.PI*.75)return"down";
  if(a<Math.PI*1.25)return"left";
  return"up";
}
function drawBot(tileSize){
  const x=Math.round(canvas.width*.5),y=Math.round(canvas.height*.5),s=Math.max(12,tileSize*.72),walk=Math.sin(bot.walkPhase)>0?1:0,dir=facing4();
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle="rgba(0,0,0,.22)";ctx.fillRect(-s*.30,s*.26,s*.60,s*.16);
  ctx.fillStyle="#40484c";ctx.fillRect(-s*.22,-s*.06,s*.18,s*.34);ctx.fillRect(s*.04,-s*.06,s*.18,s*.34);
  if(walk){ctx.fillRect(-s*.27,s*.17,s*.18,s*.08);ctx.clearRect(s*.09,s*.18,s*.14,s*.08)}
  ctx.fillStyle="#bbbcb3";ctx.fillRect(-s*.31,-s*.62,s*.62,s*.56);
  ctx.fillStyle="#777f78";ctx.fillRect(-s*.46,-s*.56,s*.13,s*.48);ctx.fillRect(s*.33,-s*.56,s*.13,s*.48);
  ctx.fillStyle="#c9c9c1";ctx.fillRect(-s*.28,-s*.98,s*.56,s*.34);
  ctx.fillStyle="#243036";
  if(dir==="right"){ctx.fillRect(s*.18,-s*.86,s*.05,s*.05);ctx.fillRect(s*.18,-s*.73,s*.05,s*.05)}
  else if(dir==="left"){ctx.fillRect(-s*.23,-s*.86,s*.05,s*.05);ctx.fillRect(-s*.23,-s*.73,s*.05,s*.05)}
  else{ctx.fillRect(-s*.14,-s*.84,s*.05,s*.05);ctx.fillRect(s*.09,-s*.84,s*.05,s*.05)}
  if(has("speed")){ctx.fillStyle="#5fa160";ctx.fillRect(-s*.25,s*.20,s*.20,s*.08);ctx.fillRect(s*.05,s*.20,s*.20,s*.08)}
  if(has("vision")){ctx.fillStyle="#5b9fb3";ctx.fillRect(-s*.29,-s*.86,s*.58,s*.08)}
  if(has("detection")){ctx.fillStyle="#75c7aa";ctx.fillRect(-s*.03,-s*1.10,s*.06,s*.13)}
  if(has("efficiency")){ctx.fillStyle="#77d178";ctx.fillRect(-s*.07,-s*.42,s*.14,s*.14)}
  ctx.restore();
}

function renderMap(tileSize,sensor=false){
  ctx.fillStyle="#111";ctx.fillRect(0,0,canvas.width,canvas.height);
  const cols=Math.ceil(canvas.width/tileSize)+4,rows=Math.ceil(canvas.height/tileSize)+4;
  const startX=Math.floor(bot.x-cols/2),startY=Math.floor(bot.y-rows/2);
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const tx=startX+i,ty=startY+j,p=screenFor(tx+.5,ty+.5,tileSize);
    drawTile(tx,ty,Math.round(p.x-tileSize*.5),Math.round(p.y-tileSize*.5),Math.ceil(tileSize)+1,tileAt(tx,ty));
  }
  zones.forEach(z=>drawPOI(z,tileSize));
  drawBot(tileSize);

  if(sensor){
    ctx.fillStyle="rgba(3,10,16,.42)";ctx.fillRect(0,0,canvas.width,canvas.height);
    const range=visionRange()*tileSize;
    ctx.strokeStyle="rgba(100,220,190,.45)";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(canvas.width*.5,canvas.height*.5,range,0,Math.PI*2);ctx.stroke();
    for(const d of detections){
      const p=screenFor(d.z.x,d.z.y,tileSize);
      ctx.strokeStyle=d.cls==="?"?"#e6c16d":"#9ee5c4";ctx.lineWidth=2;ctx.strokeRect(p.x-8,p.y-8,16,16);
      ctx.fillStyle="rgba(5,10,8,.75)";ctx.fillRect(p.x+10,p.y-16,100,22);
      ctx.fillStyle=d.cls==="?"?"#efd08a":"#c7eedb";ctx.font="10px ui-monospace,monospace";ctx.fillText(d.cls+" "+Math.round(d.confidence*100)+"%",p.x+14,p.y-2);
    }
  }

  ctx.fillStyle="rgba(7,9,7,.65)";ctx.fillRect(10,10,178,38);
  ctx.fillStyle="#f0e6ba";ctx.font="11px ui-monospace,monospace";
  ctx.fillText("X "+Math.round(bot.x)+"  Y "+Math.round(bot.y),18,25);
  ctx.fillText("WORLD "+WORLD_SIZE+" × "+WORLD_SIZE,18,41);

  if(TIMES[timeIndex].overlay!=="rgba(0,0,0,0)"){ctx.fillStyle=TIMES[timeIndex].overlay;ctx.fillRect(0,0,canvas.width,canvas.height)}
  drawMiniMap();
}

function drawMiniMap(){
  const size=156,pad=12,x=canvas.width-size-pad,y=52;
  ctx.save();
  ctx.fillStyle="rgba(5,7,5,.88)";ctx.fillRect(x-5,y-18,size+10,size+25);
  ctx.strokeStyle="#d7c96b";ctx.lineWidth=2;ctx.strokeRect(x-.5,y-.5,size+1,size+1);
  ctx.imageSmoothingEnabled=false;ctx.drawImage(miniCanvas,x,y,size,size);

  const scale=size/WORLD_SIZE;
  const bx=x+(bot.x+HALF)*scale,by=y+(bot.y+HALF)*scale;
  ctx.fillStyle="#fff2a8";ctx.fillRect(Math.round(bx)-2,Math.round(by)-2,5,5);

  const m=mem();
  for(const z of zones){
    if(!m.seen.includes(z.id)&&!m.discovered.includes(z.id))continue;
    const px=x+(z.x+HALF)*scale,py=y+(z.y+HALF)*scale;
    ctx.fillStyle=z.kind==="gate"?(m.gateActive?"#71d7ff":"#d5d0c0"):z.kind==="core"?"#f3da59":z.kind==="ruin"?"#c1a77d":"#e08b52";
    ctx.fillRect(Math.round(px)-1,Math.round(py)-1,3,3);
  }
  ctx.fillStyle="#f3e9b7";ctx.font="10px ui-monospace,monospace";ctx.textAlign="left";
  ctx.fillText("MEMORY MAP",x,y-6);
  ctx.fillStyle="#9f9b83";ctx.fillText("unknown = black",x+67,y-6);
  ctx.restore();
}

function render(){
  ctx.imageSmoothingEnabled=false;
  if(viewMode==="close")renderMap(34,false);
  else if(viewMode==="sensor")renderMap(22,true);
  else renderMap(22,false);
}
function cycleView(){
  if(!running)return;
  viewIndex=(viewIndex+1)%views.length;viewMode=views[viewIndex];
  const n={world:"WORLD",close:"CLOSE",sensor:"SENSOR"}[viewMode];
  viewBadge.textContent=n;viewName.textContent=n;
}
function setTime(i){timeIndex=i;lightLabel.textContent=TIMES[i].name}
function resize(){
  const r=canvas.getBoundingClientRect(),w=Math.max(320,Math.round(r.width||960)),h=Math.round(w*600/960);
  canvas.width=w;canvas.height=h;ctx.imageSmoothingEnabled=false;
}

function simulateLogicalTime(seconds, source="catch-up"){
  if(!running||seconds<=0)return;
  let remaining=Math.min(seconds, 6*60*60); // bound one resume burst to six hours
  let simulated=0;
  while(remaining>0){
    const step=remaining>1800?1.0:(remaining>300?.5:.2);
    const dt=Math.min(step,remaining);
    updateBehavior(dt,Date.now());
    // Keep perception fresh enough for scan/pickup/gate states and discoveries.
    updatePerception();
    simulated+=dt;remaining-=dt;
  }
  saveLife();
  if(source!=="background"&&seconds>1.0)log(source+" · advanced "+Math.round(seconds)+" s");
}

function startBackgroundClock(){
  if(backgroundTimer!==null)return;
  let tickWall=Date.now();
  backgroundTimer=setInterval(()=>{
    const now=Date.now(),elapsed=(now-tickWall)/1000;tickWall=now;
    if(running&&document.hidden&&elapsed>0){
      simulateLogicalTime(elapsed,"background");
      lastWall=now;
    }
  },1000);
}

function stopBackgroundClock(){
  if(backgroundTimer!==null){clearInterval(backgroundTimer);backgroundTimer=null;}
}

enterButton.addEventListener("click",()=>{
  running=true;intro.hidden=true;lastWall=Date.now();lastTime=performance.now();
  log(life.position?"memory restored":"autonomy enabled");think();startBackgroundClock();
});
viewButton.addEventListener("click",cycleView);
lightButton.addEventListener("click",()=>setTime((timeIndex+1)%TIMES.length));
newLifeButton.addEventListener("click",()=>{if(confirm("Tiny Bot の性格・記憶・改造をすべて初期化しますか？")){localStorage.removeItem(SAVE_KEY);location.reload()}});
window.addEventListener("resize",resize);
window.addEventListener("blur",()=>{if(running)saveLife()});
document.addEventListener("visibilitychange",()=>{
  const now=Date.now();
  if(document.hidden){
    hiddenSince=now;lastWall=now;saveLife();startBackgroundClock();
  }else{
    const base=hiddenSince??lastWall;
    const elapsed=Math.max(0,(now-base)/1000);
    hiddenSince=null;
    // Background timer may have advanced part or all of this period; lastWall tracks that.
    const unaccounted=Math.max(0,(now-lastWall)/1000);
    if(running&&unaccounted>.05)simulateLogicalTime(unaccounted,"resume catch-up");
    lastWall=now;lastTime=performance.now();
  }
});
window.addEventListener("pagehide",()=>{if(running){saveLife();hiddenSince=Date.now();}});
window.addEventListener("pageshow",()=>{
  const now=Date.now(),unaccounted=Math.max(0,(now-lastWall)/1000);
  if(running&&unaccounted>.05)simulateLogicalTime(unaccounted,"page restore");
  lastWall=now;lastTime=performance.now();
});

buildRegion();resize();updatePerception();updateUI();render();
if(life.position)log("saved journey restored · region "+String(life.regionIndex+1).padStart(2,"0"));

function frame(time){
  const rawDt=Math.max(0,(time-lastTime)/1000||.016);lastTime=time;
  const nowWall=Date.now();
  if(running&&!document.hidden){
    if(rawDt>.12){
      // rAF was suspended/throttled: recover the elapsed logical time instead of discarding it.
      simulateLogicalTime(rawDt,"frame catch-up");
    }else{
      const dt=Math.min(.04,rawDt);
      updateBehavior(dt,time);updatePerception();saveTimer+=dt;
      if(saveTimer>6){saveTimer=0;saveLife()}
    }
    lastWall=nowWall;
    updateUI();
  }
  render();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.addEventListener("beforeunload",()=>{stopBackgroundClock();if(running)saveLife()});

})();