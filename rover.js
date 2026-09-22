(() => {
"use strict";
const THREE_URL="https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js";
const SAVE_KEY="rba-tiny-rover-life-v3";

async function boot(){
  const $=id=>document.getElementById(id);
  const canvas=$("roverCanvas"),intro=$("intro"),enterButton=$("enterButton"),pauseButton=$("pauseButton");
  const viewButton=$("viewButton"),lightButton=$("lightButton"),newLifeButton=$("newLifeButton");
  const viewBadge=$("viewBadge"),decisionBadge=$("decisionBadge"),viewName=$("viewName"),stateText=$("stateText"),mapText=$("mapText");
  const activityText=$("activityText"),detailText=$("detailText"),batteryText=$("batteryText"),speedText=$("speedText");
  const partsText=$("partsText"),sampleText=$("sampleText"),exploreText=$("exploreText"),headingText=$("headingText");
  const lightLabel=$("lightLabel"),logList=$("logList"),upgradeList=$("upgradeList"),inventoryList=$("inventoryList");
  const curiosityFill=$("curiosityFill"),cautionFill=$("cautionFill"),improveFill=$("improveFill");
  const curiosityText=$("curiosityText"),cautionText=$("cautionText"),improveText=$("improveText");

  let THREE;
  try{THREE=await import(THREE_URL);}
  catch(err){
    const c=canvas.getContext("2d");c.fillStyle="#2b1710";c.fillRect(0,0,canvas.width,canvas.height);
    c.fillStyle="#f5dfc8";c.font="700 22px system-ui";c.textAlign="center";c.fillText("3D renderer could not be loaded.",canvas.width/2,canvas.height/2);
    activityText.textContent="3Dライブラリを読み込めませんでした。";return;
  }

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const wrap=a=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a};
  const lerp=(a,b,t)=>a+(b-a)*t;
  const rnd=(a,b)=>a+Math.random()*(b-a);

  const MAP_TEMPLATES=[
    {
      name:"RED BASIN",theme:{bg:0xa36443,fog:0x986047,ground:0x8b5134,rock:0x624236},rough:.38,seed:1.7,core:"RESONANCE CORE",
      zones:[
        {id:"F-01",x:-5.4,z:-3.6,kind:"geology",interest:.72,label:"angular fragment"},
        {id:"F-02",x:4.8,z:-4.1,kind:"parts",parts:2,label:"sealed actuator"},
        {id:"F-03",x:5.7,z:2.3,kind:"geology",interest:.46,label:"dark cobble"},
        {id:"F-04",x:-4.6,z:4.4,kind:"core",label:"resonance core"},
        {id:"F-05",x:6.4,z:5.0,kind:"gate",label:"dormant frame"},
        {id:"F-06",x:.8,z:5.7,kind:"parts",parts:1,label:"power coupler"}
      ]
    },
    {
      name:"GLASS HOLLOW",theme:{bg:0x384654,fog:0x354954,ground:0x3d4d52,rock:0x53636a},rough:.62,seed:4.2,core:"PRISM KEY",
      zones:[
        {id:"H-01",x:-5.8,z:-2.2,kind:"geology",interest:.81,label:"glassy ridge"},
        {id:"H-02",x:3.9,z:-5.1,kind:"parts",parts:2,label:"sensor block"},
        {id:"H-03",x:6.0,z:.8,kind:"core",label:"prism key"},
        {id:"H-04",x:-3.7,z:4.7,kind:"geology",interest:.91,label:"veined monolith"},
        {id:"H-05",x:5.7,z:5.4,kind:"gate",label:"dark aperture"},
        {id:"H-06",x:-.6,z:5.8,kind:"parts",parts:2,label:"spring assembly"}
      ]
    },
    {
      name:"ANCIENT RELAY",theme:{bg:0x7a6a58,fog:0x6d645b,ground:0x6d5d4e,rock:0x504a43},rough:.48,seed:7.1,core:"SIGNAL SEED",
      zones:[
        {id:"A-01",x:-5.1,z:-4.8,kind:"parts",parts:2,label:"old battery cell"},
        {id:"A-02",x:4.6,z:-4.6,kind:"geology",interest:.69,label:"machined stone"},
        {id:"A-03",x:5.9,z:1.9,kind:"core",label:"signal seed"},
        {id:"A-04",x:-4.8,z:3.8,kind:"parts",parts:2,label:"optical head"},
        {id:"A-05",x:6.2,z:5.2,kind:"gate",label:"relay gate"},
        {id:"A-06",x:.2,z:5.7,kind:"geology",interest:.88,label:"buried plate"}
      ]
    }
  ];

  function configFor(index){
    const base=MAP_TEMPLATES[index%MAP_TEMPLATES.length];
    if(index<MAP_TEMPLATES.length)return structuredClone(base);
    const cycle=Math.floor(index/MAP_TEMPLATES.length);
    const c=structuredClone(base);
    c.name="FRONTIER "+String(index+1).padStart(2,"0");
    c.seed+=cycle*2.73;c.rough=clamp(c.rough+cycle*.025,.35,.78);
    c.core="FRONTIER CORE "+String(index+1).padStart(2,"0");
    c.zones.forEach((z,i)=>{z.id="X"+(index+1)+"-"+(i+1);z.x+=Math.sin(index*1.4+i)*.45;z.z+=Math.cos(index*.9+i)*.4;if(z.kind==="core")z.label=c.core.toLowerCase()});
    return c;
  }

  function freshLife(){
    return{
      version:3,mapIndex:0,parts:0,samples:0,battery:100,upgrades:[],
      personality:{curiosity:rnd(.48,.90),caution:rnd(.36,.80),improve:rnd(.45,.92)},
      exp:{stucks:0,charges:0,distance:0,scans:0,gates:0,contacts:0},
      maps:{},position:null,lastSeen:Date.now()
    };
  }
  function loadLife(){
    try{
      const raw=localStorage.getItem(SAVE_KEY);if(!raw)return freshLife();
      const v=JSON.parse(raw);if(!v||v.version!==3)return freshLife();
      return v;
    }catch(_){return freshLife()}
  }
  let life=loadLife();
  function saveLife(){
    life.battery=roverState.battery;
    life.position={mapIndex:life.mapIndex,x:roverState.x,z:roverState.z,heading:roverState.heading};
    life.lastSeen=Date.now();
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(life))}catch(_){}
  }
  function mem(){
    const k=String(life.mapIndex);
    if(!life.maps[k])life.maps[k]={discovered:[],gateKnown:false,gateActivated:false,coreHeld:false};
    return life.maps[k];
  }

  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;

  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x986047,.025);
  const camera=new THREE.PerspectiveCamera(47,16/10,.05,90),camDesired=new THREE.Vector3(),camTarget=new THREE.Vector3();
  const hemi=new THREE.HemisphereLight(0xffd4ae,0x302621,1.45);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffd9a0,2.5);sun.position.set(-8,11,4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-13;sun.shadow.camera.right=13;sun.shadow.camera.top=13;sun.shadow.camera.bottom=-13;scene.add(sun);
  const lightPresets=[{name:"LOW SUN",mul:1,bg:.0},{name:"HIGH SUN",mul:.88,bg:.08},{name:"DUSTY",mul:.52,bg:-.06}];
  let lightIndex=0;

  let activeConfig=configFor(life.mapIndex),worldGroup=null,zones=[],obstacles=[],gateVisual=null,terrainSeed=activeConfig.seed;
  const WORLD=20;
  function heightAt(x,z){
    const r=activeConfig.rough;
    return r*(.24*Math.sin(x*.48+terrainSeed)+.17*Math.cos(z*.66-terrainSeed*.4)+.10*Math.sin(x*.91+z*.59)+.05*Math.cos(x*1.75-z*.45));
  }

  function disposeGroup(g){
    g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const arr=Array.isArray(o.material)?o.material:[o.material];arr.forEach(m=>m.dispose&&m.dispose())}});
    scene.remove(g);
  }

  function buildWorld(){
    if(worldGroup)disposeGroup(worldGroup);
    activeConfig=configFor(life.mapIndex);terrainSeed=activeConfig.seed;worldGroup=new THREE.Group();scene.add(worldGroup);zones=[];obstacles=[];gateVisual=null;
    scene.background=new THREE.Color(activeConfig.theme.bg);scene.fog.color.setHex(activeConfig.theme.fog);

    const g=new THREE.PlaneGeometry(WORLD,WORLD,96,96);g.rotateX(-Math.PI/2);const a=g.attributes.position;
    for(let i=0;i<a.count;i++)a.setY(i,heightAt(a.getX(i),a.getZ(i)));a.needsUpdate=true;g.computeVertexNormals();
    const ground=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:activeConfig.theme.ground,roughness:.98}));ground.receiveShadow=true;worldGroup.add(ground);

    const pebMat=new THREE.MeshStandardMaterial({color:activeConfig.theme.rock,roughness:1});
    for(let i=0;i<52;i++){
      const rr=.04+.07*((i*17+life.mapIndex*11)%11)/11;
      const m=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),pebMat);
      const x=-8.7+((i*37+life.mapIndex*13)%101)/101*17.4,z=-8.7+((i*61+life.mapIndex*19)%103)/103*17.4;
      m.position.set(x,heightAt(x,z)+rr*.3,z);m.scale.set(rr*1.7,rr*.58,rr*1.35);m.rotation.set(i*.17,i*.37,i*.09);worldGroup.add(m);
    }

    const discovered=new Set(mem().discovered);
    activeConfig.zones.forEach((def,i)=>{
      let mesh=null;
      if(def.kind==="geology"){
        mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(.62+(def.interest||.5)*.22,1),new THREE.MeshStandardMaterial({color:activeConfig.theme.rock,roughness:.9}));
        mesh.scale.y=.7;obstacles.push({x:def.x,z:def.z,rad:.75,zoneId:def.id});
      }else if(def.kind==="parts"){
        mesh=new THREE.Mesh(new THREE.BoxGeometry(.42,.24,.34),new THREE.MeshStandardMaterial({color:0x514b42,roughness:.68,metalness:.25}));
      }else if(def.kind==="core"){
        mesh=new THREE.Mesh(new THREE.OctahedronGeometry(.20,0),new THREE.MeshStandardMaterial({color:0x7a684f,emissive:discovered.has(def.id)?0x57421d:0x000000,emissiveIntensity:1.2,roughness:.35,metalness:.42}));
      }else if(def.kind==="gate"){
        const gate=new THREE.Group();
        const gm=new THREE.MeshStandardMaterial({color:0x4a433d,roughness:.85,metalness:.15});
        const l=new THREE.Mesh(new THREE.BoxGeometry(.42,2.25,.32),gm),rr=l.clone(),top=new THREE.Mesh(new THREE.BoxGeometry(.42,.32,2.2),gm);
        l.position.set(0,1.1,-.92);rr.position.set(0,1.1,.92);top.position.set(0,2.1,0);gate.add(l,rr,top);
        const portalMat=new THREE.MeshBasicMaterial({color:0x7ad7c9,transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false});
        const portal=new THREE.Mesh(new THREE.CircleGeometry(.83,48),portalMat);portal.position.y=1.1;portal.rotation.y=Math.PI/2;portal.visible=mem().gateActivated;gate.add(portal);
        gateVisual={group:gate,portal,mat:portalMat};
        mesh=gate;obstacles.push({x:def.x,z:def.z,rad:1.0,zoneId:def.id});
      }
      if(mesh){
        mesh.position.set(def.x,heightAt(def.x,def.z),def.z);
        if(discovered.has(def.id)&&(def.kind==="parts"||def.kind==="core"))mesh.visible=false;
        mesh.castShadow=true;mesh.receiveShadow=true;worldGroup.add(mesh);
      }
      zones.push({...def,mesh,discovered:discovered.has(def.id)});
    });
    setLight(lightIndex);
    updateMapUI();
  }

  // Rover model
  const rover=new THREE.Group();scene.add(rover);
  const bodyMat=new THREE.MeshStandardMaterial({color:0xc3b19b,roughness:.55,metalness:.08}),darkMat=new THREE.MeshStandardMaterial({color:0x292b2a,roughness:.78});
  const panelMat=new THREE.MeshStandardMaterial({color:0x263b49,roughness:.30,metalness:.32}),brassMat=new THREE.MeshStandardMaterial({color:0x8e774b,roughness:.55,metalness:.35});
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.25,.28,.82),bodyMat);body.position.y=.38;body.castShadow=true;rover.add(body);
  const deck=new THREE.Mesh(new THREE.BoxGeometry(1.06,.055,.72),panelMat);deck.position.y=.56;deck.castShadow=true;rover.add(deck);
  const mast=new THREE.Group();mast.position.set(.18,.58,0);rover.add(mast);
  const mastStem=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.55,10),brassMat);mastStem.position.y=.27;mast.add(mastStem);
  const mastHead=new THREE.Mesh(new THREE.BoxGeometry(.23,.14,.18),darkMat);mastHead.position.y=.58;mast.add(mastHead);
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.045,16),new THREE.MeshStandardMaterial({color:0x0c1115,metalness:.5,roughness:.15}));lens.rotation.z=Math.PI/2;lens.position.set(.13,.59,0);mast.add(lens);

  const wheelGeo=new THREE.CylinderGeometry(.18,.18,.12,24);wheelGeo.rotateX(Math.PI/2);const wheels=[];
  for(const x of [-.46,0,.46])for(const z of [-.49,.49]){const w=new THREE.Mesh(wheelGeo,darkMat);w.position.set(x,.18,z);w.castShadow=true;rover.add(w);wheels.push(w)}

  const armBase=new THREE.Group();armBase.position.set(.50,.47,-.28);rover.add(armBase);
  const baseDisk=new THREE.Mesh(new THREE.CylinderGeometry(.11,.12,.08,16),brassMat);baseDisk.position.y=.02;armBase.add(baseDisk);
  const shoulder=new THREE.Group();shoulder.position.y=.08;armBase.add(shoulder);
  function armSegment(length){const seg=new THREE.Mesh(new THREE.BoxGeometry(length,.075,.075),new THREE.MeshStandardMaterial({color:0xb7a383,roughness:.5,metalness:.1}));seg.position.x=length*.5;seg.castShadow=true;return seg}
  shoulder.add(armSegment(.55));const elbow=new THREE.Group();elbow.position.x=.55;shoulder.add(elbow);elbow.add(armSegment(.47));
  const wrist=new THREE.Group();wrist.position.x=.47;elbow.add(wrist);const tool=new THREE.Mesh(new THREE.CylinderGeometry(.045,.06,.18,12),darkMat);tool.rotation.z=Math.PI/2;tool.position.x=.09;wrist.add(tool);

  // Upgrade visuals
  const auxBattery=new THREE.Mesh(new THREE.BoxGeometry(.42,.20,.60),new THREE.MeshStandardMaterial({color:0x6f695d,roughness:.6}));auxBattery.position.set(-.36,.68,0);rover.add(auxBattery);
  const lidarGroup=new THREE.Group();lidarGroup.position.set(-.18,.66,0);const lidarBase=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,.08,16),darkMat);lidarGroup.add(lidarBase);
  const lidarHead=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.06,18),new THREE.MeshStandardMaterial({color:0x87beb4,emissive:0x203b37,metalness:.25,roughness:.35}));lidarHead.position.y=.07;lidarGroup.add(lidarHead);rover.add(lidarGroup);
  const solarWing=new THREE.Mesh(new THREE.BoxGeometry(.65,.025,.30),panelMat);solarWing.position.set(-.38,.63,-.50);rover.add(solarWing);
  const suspensionGroup=new THREE.Group();for(const x of [-.46,0,.46])for(const z of [-.39,.39]){const s=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.28,8),new THREE.MeshStandardMaterial({color:0xa37c46,metalness:.4,roughness:.5}));s.position.set(x,.31,z);s.rotation.x=z>0?.35:-.35;suspensionGroup.add(s)}rover.add(suspensionGroup);
  const drillTip=new THREE.Mesh(new THREE.ConeGeometry(.065,.18,12),new THREE.MeshStandardMaterial({color:0x777b78,metalness:.6,roughness:.3}));drillTip.rotation.z=-Math.PI/2;drillTip.position.x=.20;wrist.add(drillTip);

  const UPGRADE_DEFS={
    traction:{label:"TRACTION WHEELS",cost:2},
    battery:{label:"AUX BATTERY",cost:3},
    lidar:{label:"LIDAR",cost:2},
    suspension:{label:"ACTIVE SUSPENSION",cost:3},
    arm:{label:"ARM TOOL",cost:3},
    solar:{label:"SOLAR BOOST",cost:2}
  };
  const has=u=>life.upgrades.includes(u);
  function maxBattery(){return has("battery")?150:100}
  function applyUpgradeVisuals(){
    auxBattery.visible=has("battery");lidarGroup.visible=has("lidar");solarWing.visible=has("solar");suspensionGroup.visible=has("suspension");drillTip.visible=has("arm");
    const sc=has("traction")?1.20:1;wheels.forEach(w=>w.scale.set(sc,sc,sc));
  }

  const roverState={
    x:0,z:0,heading:.35,speed:0,targetSpeed:0,battery:clamp(life.battery||100,0,maxBattery()),state:"THINK",timer:1.2,
    targetZone:null,goal:null,navPurpose:null,prevDist:Infinity,stuckTime:0,recoverSign:1,
    mastYaw:0,armProgress:0,armVisual:0,scanProgress:0,yawRate:0,wheelAngleL:0,wheelAngleR:0,upgradeChoice:null
  };
  if(life.position&&life.position.mapIndex===life.mapIndex){roverState.x=life.position.x;roverState.z=life.position.z;roverState.heading=life.position.heading}
  let running=false,paused=false,lastTime=performance.now(),saveTimer=0;
  const views=["overview","follow","rovercam","armcam"];let viewIndex=0,viewMode="overview";
  const logs=[];
  function log(msg){logs.unshift(msg);if(logs.length>6)logs.length=6;logList.innerHTML=logs.map(x=>"<span>"+x+"</span>").join("")}

  function exploration(){
    const m=mem();return m.discovered.length/Math.max(1,activeConfig.zones.length);
  }
  function undiscovered(){const set=new Set(mem().discovered);return zones.filter(z=>!set.has(z.id))}

  function upgradeNeeds(){
    const e=life.exp,c=activeConfig;
    return{
      traction:clamp(c.rough*.46+e.stucks*.16,0,1),
      battery:clamp(e.charges*.18+life.mapIndex*.06+(1-roverState.battery/maxBattery())*.26,0,1),
      lidar:clamp(undiscovered().length/zones.length*.42+e.scans*.025+life.mapIndex*.06,0,1),
      suspension:clamp(c.rough*.42+e.distance/150,0,1),
      arm:clamp(life.samples*.055+e.contacts*.08,0,1),
      solar:clamp(e.charges*.20+life.mapIndex*.05,0,1)
    };
  }
  function bestUpgradeCandidate(){
    const needs=upgradeNeeds();let best=null;
    for(const [id,d] of Object.entries(UPGRADE_DEFS)){
      if(has(id)||life.parts<d.cost)continue;
      const score=life.personality.improve*48+needs[id]*52+Math.random()*8;
      if(!best||score>best.score)best={id,score,cost:d.cost,label:d.label,need:needs[id]};
    }
    return best;
  }

  function think(){
    roverState.state="THINK";roverState.timer=.85+rnd(.25,.8);roverState.speed=0;roverState.yawRate=0;roverState.armProgress=0;decisionBadge.textContent="THINKING…";
  }

  function chooseAction(){
    const m=mem(),exp=exploration(),unknown=undiscovered(),p=life.personality;
    const options=[];
    if(roverState.battery<32+p.caution*18)options.push({type:"charge",score:65+(maxBattery()-roverState.battery)*.7+p.caution*20,label:"CHARGE"});
    const up=bestUpgradeCandidate();if(up)options.push({type:"upgrade",score:up.score,label:"SELF-UPGRADE",upgrade:up});
    if(m.gateKnown&&m.coreHeld&&!m.gateActivated)options.push({type:"activate",score:58+p.curiosity*19+exp*12,label:"ACTIVATE GATE"});
    if(m.gateActivated)options.push({type:"enter",score:25+p.curiosity*46+exp*45-p.caution*14+(unknown.length===0?24:0),label:"ENTER GATE"});
    for(const z of unknown){
      const d=Math.hypot(z.x-roverState.x,z.z-roverState.z);
      options.push({type:"explore",zone:z,score:38+p.curiosity*34-p.caution*d*1.15+Math.random()*13+(unknown.length<3?6:0),label:"EXPLORE "+z.id});
    }
    if(!options.length)options.push({type:"wander",score:30,label:"WANDER"});
    options.sort((a,b)=>b.score-a.score);const pick=options[0],runner=options[1];
    decisionBadge.textContent="CHOICE · "+pick.label;
    log("choice: "+pick.label.toLowerCase()+(runner?" · alt "+runner.label.toLowerCase():""));

    if(pick.type==="charge"){startCharge();return}
    if(pick.type==="upgrade"){startUpgrade(pick.upgrade);return}
    if(pick.type==="activate"){navigateToGate("activate");return}
    if(pick.type==="enter"){navigateToGate("enter");return}
    if(pick.type==="explore"){navigateToZone(pick.zone);return}
    const ang=Math.random()*Math.PI*2,rr=rnd(2,6);startNavigation({x:Math.cos(ang)*rr,z:Math.sin(ang)*rr},"wander",null,.60);
  }

  function startNavigation(goal,purpose,zone,speed){
    roverState.goal=goal;roverState.navPurpose=purpose;roverState.targetZone=zone;roverState.state="NAV";roverState.targetSpeed=speed;
    roverState.prevDist=Infinity;roverState.stuckTime=0;
  }
  function navigateToZone(z){startNavigation({x:z.x,z:z.z},"explore",z,has("suspension")?.88:.70);log("frontier selected · "+z.id)}
  function gateZone(){return zones.find(z=>z.kind==="gate")}
  function navigateToGate(purpose){
    const g=gateZone();if(!g){think();return}
    startNavigation({x:g.x-1.25,z:g.z},purpose,g,has("suspension")?.78:.62);log((purpose==="activate"?"returning to gate":"heading through gate"));
  }

  function steeringTo(goal){
    let desired=Math.atan2(goal.z-roverState.z,goal.x-roverState.x),avoid=0;
    const look=1.0+Math.abs(roverState.speed)*1.15;
    const fx=roverState.x+Math.cos(roverState.heading)*look,fz=roverState.z+Math.sin(roverState.heading)*look;
    for(const o of obstacles){
      if(roverState.targetZone&&o.zoneId===roverState.targetZone.id&&roverState.navPurpose==="explore")continue;
      const d=Math.hypot(fx-o.x,fz-o.z),rad=o.rad+(has("traction")?.18:.32);
      if(d<rad){
        const away=Math.atan2(fz-o.z,fx-o.x);let diff=wrap(away-roverState.heading);
        if(Math.abs(diff)<.15)diff=(Math.random()<.5?-1:1)*.55;
        avoid+=clamp(diff,-1,1)*(1-d/rad)*1.7;
      }
    }
    return wrap(desired+avoid);
  }

  function updateNavigation(dt){
    const g=roverState.goal;if(!g){think();return}
    const dist=Math.hypot(g.x-roverState.x,g.z-roverState.z),desired=steeringTo(g),err=wrap(desired-roverState.heading);
    const roughPenalty=activeConfig.rough*(has("suspension")?.22:.52);
    const maxTurn=1.0*(1-clamp(Math.abs(roverState.speed),0,.9)*.35);
    roverState.yawRate=clamp(err*1.55,-maxTurn,maxTurn);roverState.heading=wrap(roverState.heading+roverState.yawRate*dt);
    const slope=Math.hypot(heightAt(roverState.x+.18,roverState.z)-heightAt(roverState.x-.18,roverState.z),heightAt(roverState.x,roverState.z+.18)-heightAt(roverState.x,roverState.z-.18));
    const terrainFactor=clamp(1-roughPenalty-slope*(has("traction")?.8:1.8),.34,1);
    const turnFactor=1-clamp(Math.abs(err)/1.5,0,.60);
    const goalSpeed=roverState.targetSpeed*terrainFactor*turnFactor;
    roverState.speed+=(goalSpeed-roverState.speed)*Math.min(1,dt*2.0);
    const step=roverState.speed*dt;roverState.x+=Math.cos(roverState.heading)*step;roverState.z+=Math.sin(roverState.heading)*step;
    life.exp.distance+=Math.abs(step);

    if(dist>roverState.prevDist-.006)roverState.stuckTime+=dt;else roverState.stuckTime=Math.max(0,roverState.stuckTime-dt*.9);
    roverState.prevDist=dist;
    const stuckLimit=has("traction")?3.6:2.45;
    if(roverState.stuckTime>stuckLimit){
      life.exp.stucks++;life.personality.caution=clamp(life.personality.caution+.012,.25,.95);life.personality.improve=clamp(life.personality.improve+.015,.25,.98);
      roverState.recoverSign=Math.random()<.5?-1:1;roverState.state="RECOVER";roverState.timer=1.65;roverState.stuckTime=0;log("path failed · learning from recovery");saveLife();return;
    }

    if(dist<.24){
      roverState.speed=0;
      if(roverState.navPurpose==="explore")startScan(roverState.targetZone);
      else if(roverState.navPurpose==="activate")startGateActivation();
      else if(roverState.navPurpose==="enter")startTransit();
      else think();
    }
  }

  function startScan(z){
    roverState.state="SCAN";roverState.targetZone=z;roverState.timer=has("lidar")?1.25:2.55;roverState.scanProgress=0;roverState.mastYaw=0;life.exp.scans++;
    log("local scan · "+z.id);
  }
  function resolveZone(){
    const z=roverState.targetZone,m=mem();if(!m.discovered.includes(z.id))m.discovered.push(z.id);z.discovered=true;
    if(z.kind==="gate"){
      m.gateKnown=true;log("memory: dormant gateway found");activityText.textContent="使い方の分からない構造物を記憶しました。";saveLife();think();return;
    }
    if(z.kind==="core"){
      roverState.state="PICKUP";roverState.timer=has("arm")?1.25:2.35;roverState.armProgress=0;log("unknown device detected");return;
    }
    if(z.kind==="parts"){
      roverState.state="PICKUP";roverState.timer=has("arm")?1.15:2.1;roverState.armProgress=0;log("usable hardware detected");return;
    }
    const contactScore=(z.interest||.5)*(.55+life.personality.curiosity*.65)+(life.parts<2?.16:0);
    if(contactScore>.72){
      roverState.state="CONTACT";roverState.timer=has("arm")?1.35:2.25;roverState.armProgress=0;log("surface contact selected");life.exp.contacts++;
    }else{
      log("scan sufficient · leaving site");saveLife();think();
    }
  }

  function finishPickup(){
    const z=roverState.targetZone,m=mem();
    if(z.kind==="core"){
      m.coreHeld=true;if(z.mesh)z.mesh.visible=false;log("inventory + "+activeConfig.core.toLowerCase());
    }else{
      const gain=(z.parts||1)+(has("arm")?1:0);life.parts+=gain;if(z.mesh)z.mesh.visible=false;log("parts recovered · +"+gain);
    }
    saveLife();think();
  }
  function finishContact(){
    life.samples++;const z=roverState.targetZone;
    if(has("arm")&&Math.random()<.55){life.parts++;log("sample logged · reusable material +1")}else log("sample logged · "+z.label);
    saveLife();think();
  }

  function startCharge(){
    roverState.state="CHARGE";roverState.speed=0;roverState.yawRate=0;roverState.armProgress=0;
    life.exp.charges++;life.personality.caution=clamp(life.personality.caution+.006,.25,.95);
    log("energy risk high · charging");saveLife();
  }
  function startUpgrade(up){roverState.state="UPGRADE";roverState.timer=4.0;roverState.upgradeChoice=up;roverState.armProgress=0;log("self-modification chosen · "+up.label.toLowerCase())}
  function finishUpgrade(){
    const up=roverState.upgradeChoice;if(!up||life.parts<up.cost){think();return}
    life.parts-=up.cost;life.upgrades.push(up.id);roverState.battery=Math.min(maxBattery(),roverState.battery+(up.id==="battery"?35:0));
    life.personality.improve=clamp(life.personality.improve-.008,.25,.98);
    applyUpgradeVisuals();log("upgrade installed · "+up.label.toLowerCase());saveLife();think();
  }

  function startGateActivation(){
    roverState.state="ACTIVATE_GATE";roverState.timer=3.1;roverState.armProgress=0;log("testing "+activeConfig.core.toLowerCase()+" with gateway");
  }
  function finishGateActivation(){
    const m=mem();m.coreHeld=false;m.gateActivated=true;life.exp.gates++;
    if(gateVisual)gateVisual.portal.visible=true;log("gateway online · destination unknown");saveLife();think();
  }
  function startTransit(){roverState.state="TRANSIT";roverState.timer=2.0;roverState.speed=.28;log("crossing threshold by own decision")}
  function advanceMap(){
    life.mapIndex++;life.personality.curiosity=clamp(life.personality.curiosity+.01,.25,.98);life.personality.caution=clamp(life.personality.caution-.006,.22,.95);
    life.position=null;roverState.x=0;roverState.z=0;roverState.heading=rnd(-Math.PI,Math.PI);roverState.speed=0;roverState.targetZone=null;
    buildWorld();roverState.battery=Math.min(maxBattery(),roverState.battery+12);applyUpgradeVisuals();log("new world · "+activeConfig.name.toLowerCase());saveLife();think();
  }

  function updateBehavior(dt,time){
    if(roverState.state==="THINK"){roverState.timer-=dt;roverState.mastYaw+=dt*.65;if(roverState.timer<=0)chooseAction()}
    else if(roverState.state==="NAV")updateNavigation(dt);
    else if(roverState.state==="SCAN"){
      roverState.timer-=dt;roverState.scanProgress+=dt;roverState.mastYaw=Math.sin(roverState.scanProgress*2.8)*.58;
      if(roverState.timer<=0)resolveZone();
    }else if(roverState.state==="PICKUP"){
      roverState.timer-=dt;roverState.armProgress=clamp(roverState.armProgress+dt*(has("arm")?.95:.55),0,1);if(roverState.timer<=0)finishPickup();
    }else if(roverState.state==="CONTACT"){
      roverState.timer-=dt;roverState.armProgress=clamp(roverState.armProgress+dt*(has("arm")?.9:.52),0,1);if(roverState.timer<=0)finishContact();
    }else if(roverState.state==="UPGRADE"){
      roverState.timer-=dt;roverState.armProgress=.55+.35*Math.sin(time*.004)**2;if(roverState.timer<=0)finishUpgrade();
    }else if(roverState.state==="ACTIVATE_GATE"){
      roverState.timer-=dt;roverState.armProgress=clamp(1-roverState.timer/3.1,0,1);if(roverState.timer<=0)finishGateActivation();
    }else if(roverState.state==="CHARGE"){
      roverState.speed=0;roverState.yawRate=0;const rate=has("solar")?5.2:2.7;roverState.battery=Math.min(maxBattery(),roverState.battery+dt*rate);
      if(roverState.battery>=maxBattery()*(.62+life.personality.caution*.14)){log("energy margin restored");saveLife();think()}
    }else if(roverState.state==="RECOVER"){
      roverState.timer-=dt;roverState.speed=-.28;roverState.yawRate=roverState.recoverSign*.44;roverState.heading=wrap(roverState.heading+roverState.yawRate*dt);
      roverState.x+=Math.cos(roverState.heading)*roverState.speed*dt;roverState.z+=Math.sin(roverState.heading)*roverState.speed*dt;
      if(roverState.timer<=0){roverState.speed=0;think()}
    }else if(roverState.state==="TRANSIT"){
      roverState.timer-=dt;roverState.speed=.28;roverState.x+=Math.cos(roverState.heading)*roverState.speed*dt;roverState.z+=Math.sin(roverState.heading)*roverState.speed*dt;
      if(roverState.timer<=0)advanceMap();
    }

    const track=.98,left=roverState.speed-roverState.yawRate*track*.5,right=roverState.speed+roverState.yawRate*track*.5;
    roverState.wheelAngleL=(roverState.wheelAngleL||0)-left*dt/.18;roverState.wheelAngleR=(roverState.wheelAngleR||0)-right*dt/.18;
    const work=["SCAN","PICKUP","CONTACT","UPGRADE","ACTIVATE_GATE"].includes(roverState.state)?.07:0;
    if(roverState.state!=="CHARGE")roverState.battery=Math.max(0,roverState.battery-dt*((Math.abs(roverState.speed)>.06?.30:.065)+work)*(has("battery")?.78:1));
    if(roverState.battery<=3&&roverState.state!=="CHARGE"){startCharge()}
  }

  function updatePose(dt,time){
    const x=roverState.x,z=roverState.z,fwd={x:Math.cos(roverState.heading),z:Math.sin(roverState.heading)},side={x:-fwd.z,z:fwd.x};
    const front=heightAt(x+fwd.x*.5,z+fwd.z*.5),back=heightAt(x-fwd.x*.5,z-fwd.z*.5),left=heightAt(x+side.x*.42,z+side.z*.42),right=heightAt(x-side.x*.42,z-side.z*.42);
    const suspensionFactor=has("suspension")?.55:1;
    rover.position.set(x,heightAt(x,z)+.34+(has("suspension")?.035:0),z);
    rover.rotation.order="YXZ";rover.rotation.y=-roverState.heading;rover.rotation.x=Math.atan2(front-back,1)*suspensionFactor;rover.rotation.z=Math.atan2(right-left,.84)*suspensionFactor;
    wheels.forEach(w=>{w.rotation.z=w.position.z>0?roverState.wheelAngleL:roverState.wheelAngleR});
    mast.rotation.y=roverState.mastYaw;
    lidarHead.rotation.y=time*.004;
    roverState.armVisual+=(roverState.armProgress-roverState.armVisual)*(1-Math.exp(-dt*4.2));
    const p=roverState.armVisual||0,e=p*p*(3-2*p);armBase.rotation.y=-.35+.42*e;shoulder.rotation.z=-(.18+1.05*e);elbow.rotation.z=.12+1.35*e;wrist.rotation.z=-(.05+.42*e);
  }

  function animateWorld(time){
    if(gateVisual&&gateVisual.portal.visible){gateVisual.portal.rotation.z=time*.00045;gateVisual.mat.opacity=.28+.18*(.5+.5*Math.sin(time*.003));}
  }

  function activityCopy(){
    const z=roverState.targetZone,d=z?Math.hypot(z.x-roverState.x,z.z-roverState.z):0;
    switch(roverState.state){
      case"THINK":return["次に何をするか考えています。","探索・改造・充電・ゲート移動を比較しています。"];
      case"NAV":return[roverState.navPurpose==="explore"?"未知領域へ移動中。":roverState.navPurpose==="activate"?"ゲートへ戻っています。":roverState.navPurpose==="enter"?"次の世界へ向かっています。":"自由移動中。",z?"目標まで "+d.toFixed(1)+" m。":"経路を調整しています。"];
      case"SCAN":return["現地を詳しく調べています。","見つけた物が何なのか判別しています。"];
      case"PICKUP":return["見つけた物を回収しています。","将来何に使えるかは、まだ決めていません。"];
      case"CONTACT":return["対象へ接触調査しています。","アームで表面を測定しています。"];
      case"UPGRADE":return["自分自身を改造しています。",roverState.upgradeChoice?roverState.upgradeChoice.label+" を取り付けています。":"部品を組み替えています。"];
      case"ACTIVATE_GATE":return["未知のアイテムをゲートへ接続中。","以前見つけた構造物との関係を試しています。"];
      case"CHARGE":return["充電のため停止しています。","危険を取らず、行動可能時間を回復しています。"];
      case"RECOVER":return["経路から自力で脱出中。","後退して別の進入角を作っています。"];
      case"TRANSIT":return["ゲートを通過しています。","戻るかどうかは分からないまま次の環境へ進みます。"];
      default:return["自律動作中。",""];
    }
  }

  function updateMapUI(){mapText.textContent="MAP "+String(life.mapIndex+1).padStart(2,"0")+" · "+activeConfig.name}
  function updateUI(){
    const [a,b]=activityCopy(),m=mem(),pct=Math.round(exploration()*100);
    stateText.textContent=roverState.state;activityText.textContent=a;detailText.textContent=b;
    batteryText.textContent="BATTERY "+Math.round(roverState.battery/maxBattery()*100)+"%";speedText.textContent="SPEED "+Math.abs(roverState.speed).toFixed(2)+" m/s";
    partsText.textContent="PARTS "+life.parts;sampleText.textContent="SAMPLES "+life.samples;exploreText.textContent="EXPLORED "+pct+"%";
    headingText.textContent="Heading "+Math.round((roverState.heading*180/Math.PI+360)%360)+"°";updateMapUI();
    const P=life.personality;
    curiosityFill.style.width=Math.round(P.curiosity*100)+"%";cautionFill.style.width=Math.round(P.caution*100)+"%";improveFill.style.width=Math.round(P.improve*100)+"%";
    curiosityText.textContent=Math.round(P.curiosity*100);cautionText.textContent=Math.round(P.caution*100);improveText.textContent=Math.round(P.improve*100);
    upgradeList.innerHTML=life.upgrades.length?life.upgrades.map(u=>'<span class="upgrade-chip">'+UPGRADE_DEFS[u].label+'</span>').join(""):'<span class="empty-chip">stock configuration</span>';
    const inv=[];if(m.coreHeld)inv.push(activeConfig.core);if(m.gateKnown)inv.push(m.gateActivated?"GATE: ONLINE":"GATE: REMEMBERED");if(life.parts)inv.push("SPARE PARTS ×"+life.parts);
    inventoryList.innerHTML=inv.length?inv.map(x=>'<span class="item-chip">'+x+'</span>').join(""):'<span class="empty-chip">nothing unusual yet</span>';
  }

  function updateCamera(dt){
    const dir=new THREE.Vector3(Math.cos(roverState.heading),0,Math.sin(roverState.heading)),side=new THREE.Vector3(-dir.z,0,dir.x),baseY=heightAt(roverState.x,roverState.z);
    if(viewMode==="overview"){camDesired.set(7.5,10.5,10.2);camTarget.set(0,0,0)}
    else if(viewMode==="follow"){camDesired.set(roverState.x-dir.x*3.3+side.x*.95,baseY+2.15,roverState.z-dir.z*3.3+side.z*.95);camTarget.set(roverState.x+dir.x*.9,baseY+.45,roverState.z+dir.z*.9)}
    else if(viewMode==="rovercam"){camDesired.set(roverState.x+dir.x*.30,baseY+1.18,roverState.z+dir.z*.30);const a=roverState.heading-roverState.mastYaw;camTarget.set(roverState.x+Math.cos(a)*7,baseY+.95,roverState.z+Math.sin(a)*7)}
    else{const tip=new THREE.Vector3(.12,0,0);wrist.localToWorld(tip);camDesired.copy(tip).add(new THREE.Vector3(0,.08,0));if(roverState.targetZone)camTarget.set(roverState.targetZone.x,heightAt(roverState.targetZone.x,roverState.targetZone.z)+.35,roverState.targetZone.z);else camTarget.copy(tip).add(dir)}
    const k=viewMode==="overview"?2.3:(viewMode==="follow"?4.2:8.0);camera.position.lerp(camDesired,1-Math.exp(-dt*k));
    const now=new THREE.Vector3();camera.getWorldDirection(now);now.multiplyScalar(2).add(camera.position);now.lerp(camTarget,1-Math.exp(-dt*k));camera.lookAt(now);
    const f=viewMode==="rovercam"?58:(viewMode==="armcam"?54:48);camera.fov+=(f-camera.fov)*(1-Math.exp(-dt*3));camera.updateProjectionMatrix();
  }

  function setLight(i){
    lightIndex=i;const p=lightPresets[i],base=new THREE.Color(activeConfig.theme.bg);base.offsetHSL(0,0,p.bg);
    scene.background.copy(base);scene.fog.color.setHex(activeConfig.theme.fog);hemi.intensity=1.45*p.mul;sun.intensity=2.5*p.mul;lightLabel.textContent=p.name;
  }
  function cycleView(){if(!running)return;viewIndex=(viewIndex+1)%views.length;viewMode=views[viewIndex];const l={overview:"OVERVIEW",follow:"FOLLOW",rovercam:"ROVER CAM",armcam:"ARM CAM"}[viewMode];viewBadge.textContent=l;viewName.textContent=l}
  function applyUpgradeVisualsAndBattery(){applyUpgradeVisuals();roverState.battery=clamp(roverState.battery,0,maxBattery())}

  function resize(){const rect=canvas.getBoundingClientRect(),w=Math.max(320,Math.round(rect.width||960)),hh=Math.round(w*600/960);renderer.setSize(w,hh,false);camera.aspect=w/hh;camera.updateProjectionMatrix()}
  window.addEventListener("resize",resize);resize();

  enterButton.addEventListener("click",()=>{running=true;intro.hidden=true;log(life.position?"memory restored":"autonomy enabled");think()});
  pauseButton.addEventListener("click",()=>{if(!running)return;paused=!paused;pauseButton.textContent=paused?"RESUME":"PAUSE";pauseButton.setAttribute("aria-pressed",paused?"true":"false")});
  viewButton.addEventListener("click",cycleView);lightButton.addEventListener("click",()=>setLight((lightIndex+1)%lightPresets.length));
  newLifeButton.addEventListener("click",()=>{if(confirm("Tiny Rover の性格・記憶・改造をすべて初期化しますか？")){try{localStorage.removeItem(SAVE_KEY)}catch(_){}location.reload()}});
  window.addEventListener("blur",()=>{if(running&&!paused){paused=true;pauseButton.textContent="RESUME";pauseButton.setAttribute("aria-pressed","true");saveLife()}});

  buildWorld();applyUpgradeVisualsAndBattery();rover.position.set(roverState.x,heightAt(roverState.x,roverState.z)+.34,roverState.z);updatePose(.016,0);updateUI();updateCamera(.016);
  if(life.position)log("saved life found · map "+String(life.mapIndex+1).padStart(2,"0"));

  function animate(time){
    const dt=Math.min(.035,Math.max(0,(time-lastTime)/1000||.016));lastTime=time;
    if(running&&!paused){updateBehavior(dt,time);updatePose(dt,time);animateWorld(time);updateCamera(dt);updateUI();saveTimer+=dt;if(saveTimer>6){saveTimer=0;saveLife()}}
    else{updatePose(dt*.2,time);animateWorld(time);updateCamera(dt*.25)}
    renderer.render(scene,camera);
  }
  renderer.setAnimationLoop(animate);
}

boot().catch(err=>{console.error(err);const e=document.getElementById("activityText");if(e)e.textContent="3D描画の初期化に失敗しました。";});
})();