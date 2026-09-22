(() => {
"use strict";
const THREE_URL="https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js";
const SAVE_KEY="rba-tiny-bot-minecraft-v1";

async function boot(){
  const $=id=>document.getElementById(id);
  const canvas=$("roverCanvas"),intro=$("intro"),enterButton=$("enterButton"),pauseButton=$("pauseButton");
  const viewButton=$("viewButton"),lightButton=$("lightButton"),newLifeButton=$("newLifeButton");
  const viewBadge=$("viewBadge"),decisionBadge=$("decisionBadge"),viewName=$("viewName"),stateText=$("stateText"),mapText=$("mapText");
  const missionText=$("missionText"),missionStepText=$("missionStepText");
  const activityText=$("activityText"),detailText=$("detailText"),batteryText=$("batteryText"),speedText=$("speedText");
  const partsText=$("partsText"),sampleText=$("sampleText"),exploreText=$("exploreText"),headingText=$("headingText");
  const lightLabel=$("lightLabel"),logList=$("logList"),upgradeList=$("upgradeList"),inventoryList=$("inventoryList");
  const scopeOverlay=$("scopeOverlay"),scopeDetections=$("scopeDetections"),scopeReticle=$("scopeReticle"),scopeTarget=$("scopeTarget"),scopeDistance=$("scopeDistance");
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
      name:"OVERWORLD PLAINS",dimension:"OVERWORLD",biome:"overworld",
      theme:{bg:0x8cc8f2,fog:0xb7d9ee,ground:0x6da94a,dirt:0x765131,rock:0x737373,fogDensity:.012},
      rough:.20,seed:1.7,core:"FLINT & STEEL",gateName:"NETHER PORTAL",
      zones:[
        {id:"M-01",x:-5.4,z:-3.6,kind:"geology",interest:.72,label:"stone cluster",blockType:"STONE"},
        {id:"M-02",x:4.8,z:-4.1,kind:"parts",parts:2,resource:"IRON",label:"iron ore cluster"},
        {id:"M-03",x:5.7,z:2.3,kind:"geology",interest:.46,label:"coal outcrop",blockType:"COAL ORE"},
        {id:"M-04",x:-4.6,z:4.4,kind:"core",label:"portal igniter",item:"FLINT & STEEL"},
        {id:"M-05",x:6.4,z:5.0,kind:"gate",label:"ruined obsidian portal",portal:"NETHER PORTAL"},
        {id:"M-06",x:.8,z:5.7,kind:"parts",parts:1,resource:"REDSTONE",label:"redstone ore"}
      ]
    },
    {
      name:"NETHER WASTES",dimension:"NETHER",biome:"nether",
      theme:{bg:0x3b1518,fog:0x4c1c1a,ground:0x7c302b,dirt:0x5f2422,rock:0x342c2c,fogDensity:.020},
      rough:.30,seed:4.2,core:"ENDER EYE",gateName:"END PORTAL",
      zones:[
        {id:"N-01",x:-5.8,z:-2.2,kind:"geology",interest:.81,label:"basalt formation",blockType:"BASALT"},
        {id:"N-02",x:3.9,z:-5.1,kind:"parts",parts:2,resource:"QUARTZ",label:"nether quartz ore"},
        {id:"N-03",x:6.0,z:.8,kind:"core",label:"ender eye cache",item:"ENDER EYE"},
        {id:"N-04",x:-3.7,z:4.7,kind:"geology",interest:.91,label:"blackstone ridge",blockType:"BLACKSTONE"},
        {id:"N-05",x:5.7,z:5.4,kind:"gate",label:"ancient end portal",portal:"END PORTAL"},
        {id:"N-06",x:-.6,z:5.8,kind:"parts",parts:2,resource:"GOLD",label:"nether gold ore"}
      ]
    },
    {
      name:"THE END",dimension:"END",biome:"end",
      theme:{bg:0x181522,fog:0x24202c,ground:0xd8d2a0,dirt:0xb9b384,rock:0x25202a,fogDensity:.014},
      rough:.18,seed:7.1,core:"GATEWAY CRYSTAL",gateName:"END GATEWAY",
      zones:[
        {id:"E-01",x:-5.1,z:-4.8,kind:"parts",parts:2,resource:"PURPUR",label:"purpur fragment"},
        {id:"E-02",x:4.6,z:-4.6,kind:"geology",interest:.69,label:"end stone rise",blockType:"END STONE"},
        {id:"E-03",x:5.9,z:1.9,kind:"core",label:"gateway crystal",item:"GATEWAY CRYSTAL"},
        {id:"E-04",x:-4.8,z:3.8,kind:"parts",parts:2,resource:"AMETHYST",label:"crystal block cache"},
        {id:"E-05",x:6.2,z:5.2,kind:"gate",label:"end gateway frame",portal:"END GATEWAY"},
        {id:"E-06",x:.2,z:5.7,kind:"geology",interest:.88,label:"obsidian spire",blockType:"OBSIDIAN"}
      ]
    }
  ];

  const MAP_SCALE=3.05;
  function configFor(index){
    const base=MAP_TEMPLATES[index%MAP_TEMPLATES.length];
    const c=structuredClone(base);
    if(index>=MAP_TEMPLATES.length){
      const cycle=Math.floor(index/MAP_TEMPLATES.length);
      c.name=(c.dimension||"OVERWORLD")+" CHUNK "+String(index+1).padStart(2,"0");
      c.seed+=cycle*2.73;c.rough=clamp(c.rough+cycle*.025,.35,.78);
      c.core="PORTAL KEY "+String(index+1).padStart(2,"0");
      c.zones.forEach((z,i)=>{
        z.id="X"+(index+1)+"-"+(i+1);
        z.x+=Math.sin(index*1.4+i)*.45;z.z+=Math.cos(index*.9+i)*.4;
        if(z.kind==="core")z.label=c.core.toLowerCase();
      });
    }
    c.zones.forEach(z=>{z.x*=MAP_SCALE;z.z*=MAP_SCALE});
    return c;
  }

  function freshLife(){
    return{
      version:4,mapIndex:0,parts:0,samples:0,battery:100,upgrades:[],
      personality:{curiosity:rnd(.48,.90),caution:rnd(.36,.80),improve:rnd(.45,.92)},
      exp:{stucks:0,charges:0,distance:0,scans:0,gates:0,contacts:0},
      maps:{},position:null,lastSeen:Date.now()
    };
  }
  function loadLife(){
    try{
      const raw=localStorage.getItem(SAVE_KEY);if(!raw)return freshLife();
      const v=JSON.parse(raw);if(!v||v.version!==4)return freshLife();
      return v;
    }catch(_){return freshLife()}
  }
  let life=loadLife();
  function saveLife(){
    life.battery=roverState.battery;
    life.position={mapIndex:life.mapIndex,x:roverState.x,z:roverState.z,heading:roverState.heading};
    life.currentMission=roverState&&roverState.mission?structuredClone(roverState.mission):null;
    life.lastSeen=Date.now();
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(life))}catch(_){}
  }
  function mem(){
    const k=String(life.mapIndex);
    if(!life.maps[k])life.maps[k]={seen:[],discovered:[],recognized:{},gateKnown:false,gateActivated:false,coreHeld:false,visitedCells:[],coverageVersion:2};
    if(!Array.isArray(life.maps[k].seen))life.maps[k].seen=[...life.maps[k].discovered];
    if(!life.maps[k].recognized||typeof life.maps[k].recognized!=="object")life.maps[k].recognized={};
    if(life.maps[k].coverageVersion!==2){life.maps[k].visitedCells=[];life.maps[k].coverageVersion=2;}
    if(!Array.isArray(life.maps[k].visitedCells))life.maps[k].visitedCells=[];
    return life.maps[k];
  }

  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;

  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x986047,.025);
  const camera=new THREE.PerspectiveCamera(47,16/10,.05,90),camDesired=new THREE.Vector3(),camTarget=new THREE.Vector3();
  const hemi=new THREE.HemisphereLight(0xffd4ae,0x302621,1.45);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffd9a0,2.5);sun.position.set(-8,11,4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;scene.add(sun);scene.add(sun.target);
  const lightPresets=[{name:"DAY",mul:1,bg:.02},{name:"SUNSET",mul:.78,bg:-.03},{name:"NIGHT",mul:.36,bg:-.15}];
  let lightIndex=0;

  let activeConfig=configFor(life.mapIndex),worldGroup=null,zones=[],obstacles=[],gateVisual=null,terrainSeed=activeConfig.seed;
  let visualObjects=[],occlusionMeshes=[],detectionCache=[],detectionByZoneId=new Map(),attentionDetection=null;
  const WORLD=64,VOXEL=1.0,HEIGHT_STEP=.32;
  function heightAt(x,z){
    const r=activeConfig.rough;
    const raw=r*(1.05*Math.sin(x*.13+terrainSeed)+.82*Math.cos(z*.12-terrainSeed*.4)+.52*Math.sin(x*.075+z*.085));
    return Math.round(raw/HEIGHT_STEP)*HEIGHT_STEP;
  }

  function disposeGroup(g){
    g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const arr=Array.isArray(o.material)?o.material:[o.material];arr.forEach(m=>m.dispose&&m.dispose())}});
    scene.remove(g);
  }

  function registerOccluder(mesh,owner=null){
    if(!mesh)return;
    mesh.traverse(o=>{
      if(!o.isMesh)return;
      o.userData.visualOwner=owner;
      occlusionMeshes.push(o);
    });
  }
  function registerVisual(mesh,meta){
    const obj={mesh,...meta};
    visualObjects.push(obj);
    registerOccluder(mesh,obj);
    return obj;
  }

  function addVoxel(group,mat,x,y,z,sx=1,sy=1,sz=1){
    const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat);
    m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;
  }

  function resourceColor(name){
    return {
      IRON:0xb9b9b4,REDSTONE:0xb92727,QUARTZ:0xe9e1d6,GOLD:0xe3b93d,
      PURPUR:0x9b6bab,AMETHYST:0x9f73d6
    }[name]||0x9aa0a0;
  }

  function blockMaterial(hex,emissive=0){
    return new THREE.MeshStandardMaterial({color:hex,roughness:.92,metalness:.03,emissive,emissiveIntensity:emissive?0.28:0});
  }

  function makeTree(x,z,id){
    const g=new THREE.Group();
    const trunkMat=blockMaterial(0x795438),leafMat=blockMaterial(0x3f7d38);
    addVoxel(g,trunkMat,0,.65,0,.48,1.3,.48);
    addVoxel(g,leafMat,0,1.55,0,1.35,.80,1.35);
    addVoxel(g,leafMat,.42,1.35,.05,.75,.65,.80);
    addVoxel(g,leafMat,-.38,1.38,-.15,.72,.62,.76);
    g.position.set(x,heightAt(x,z),z);worldGroup.add(g);
    registerVisual(g,{id,kind:"tree",className:"TREE",classThreshold:.52,label:"oak tree",zone:null,ambient:true});
    obstacles.push({x,z,rad:.58,zoneId:id});
  }

  function makeNetherPillar(x,z,id){
    const g=new THREE.Group(),basalt=blockMaterial(0x373238),magma=blockMaterial(0x8f3d20,0x4c1605);
    const h=1.25+((id.charCodeAt(id.length-1)||1)%4)*.28;
    addVoxel(g,basalt,0,h*.5,0,.62,h,.62);
    if(id.charCodeAt(id.length-1)%3===0)addVoxel(g,magma,.32,.18,.10,.28,.28,.28);
    g.position.set(x,heightAt(x,z),z);worldGroup.add(g);
    registerVisual(g,{id,kind:"basalt",className:"BASALT",classThreshold:.56,label:"basalt pillar",zone:null,ambient:true});
    obstacles.push({x,z,rad:.48,zoneId:id});
  }

  function makeChorus(x,z,id){
    const g=new THREE.Group(),stem=blockMaterial(0x6e536f),tip=blockMaterial(0x9b78a3);
    const h=1.15+((id.charCodeAt(id.length-1)||1)%3)*.32;
    addVoxel(g,stem,0,h*.5,0,.30,h,.30);
    addVoxel(g,tip,0,h+.22,0,.55,.42,.55);
    addVoxel(g,tip,.32,h-.05,.12,.35,.35,.35);
    g.position.set(x,heightAt(x,z),z);worldGroup.add(g);
    registerVisual(g,{id,kind:"chorus",className:"CHORUS",classThreshold:.58,label:"chorus plant",zone:null,ambient:true});
    obstacles.push({x,z,rad:.38,zoneId:id});
  }

  function makeStoneFormation(def){
    const g=new THREE.Group();
    const hex=def.blockType==="COAL ORE"?0x4a4a48:def.blockType==="BASALT"?0x363238:def.blockType==="BLACKSTONE"?0x2f2b30:def.blockType==="END STONE"?0xd9d3a1:def.blockType==="OBSIDIAN"?0x282033:activeConfig.theme.rock;
    const mat=blockMaterial(hex);
    const count=def.blockType==="OBSIDIAN"?6:4;
    for(let j=0;j<count;j++){
      const bx=(j%2)*.62-.31,bz=Math.floor(j/2)*.58-.35,by=.30+(j===3?.28:0);
      addVoxel(g,mat,bx,by,bz,.58,.58,.58);
    }
    return g;
  }

  function makeOreCluster(def){
    const g=new THREE.Group(),stone=blockMaterial(activeConfig.biome==="nether"?0x6c2b28:(activeConfig.biome==="end"?0xd4cea0:0x737373));
    const ore=blockMaterial(resourceColor(def.resource),def.resource==="REDSTONE"?0x581010:0);
    for(let j=0;j<3;j++){
      const b=addVoxel(g,stone,(j-1)*.48,.27,(j%2)*.28-.14,.50,.50,.50);
      const chip=addVoxel(g,ore,(j-1)*.48+.16,.29,(j%2)*.28-.14,.16,.18,.18);
      chip.rotation.y=j*.7;
    }
    return g;
  }

  function makeKeyCache(def){
    const g=new THREE.Group(),chest=blockMaterial(0x8a5b2f),trim=blockMaterial(0x3f2c1d),metal=blockMaterial(0xb4b4ac);
    addVoxel(g,chest,0,.22,0,.62,.36,.48);
    addVoxel(g,trim,0,.44,0,.64,.13,.50);
    addVoxel(g,metal,.32,.30,0,.06,.12,.12);
    return g;
  }

  function makePortal(def){
    const g=new THREE.Group(),obsidian=blockMaterial(0x241c31),accent=blockMaterial(0x4a315b);
    const bw=.46;
    for(let y=0;y<5;y++){
      addVoxel(g,obsidian,0,.23+y*bw,-.92,bw,bw,bw);
      addVoxel(g,obsidian,0,.23+y*bw,.92,bw,bw,bw);
    }
    for(let z=-.92;z<=.92+.01;z+=bw)addVoxel(g,obsidian,0,.23+4*bw,z,bw,bw,bw);
    addVoxel(g,accent,0,.23,0,.40,.40,1.35);
    const portalMat=new THREE.MeshBasicMaterial({color:activeConfig.biome==="nether"?0x9b4de0:0x6c4fc8,transparent:true,opacity:.48,side:THREE.DoubleSide,depthWrite:false});
    const portal=new THREE.Mesh(new THREE.PlaneGeometry(1.35,1.62),portalMat);
    portal.position.set(.02,1.14,0);portal.rotation.y=Math.PI/2;portal.visible=mem().gateActivated;g.add(portal);
    gateVisual={group:g,portal,mat:portalMat};
    return g;
  }

  function buildWorld(){
    if(worldGroup)disposeGroup(worldGroup);
    activeConfig=configFor(life.mapIndex);terrainSeed=activeConfig.seed;worldGroup=new THREE.Group();scene.add(worldGroup);zones=[];obstacles=[];gateVisual=null;
    visualObjects=[];occlusionMeshes=[];detectionCache=[];detectionByZoneId=new Map();attentionDetection=null;
    scene.background=new THREE.Color(activeConfig.theme.bg);scene.fog.color.setHex(activeConfig.theme.fog);scene.fog.density=activeConfig.theme.fogDensity;

    // Minecraft-like voxel columns: colored top layer over a darker sub-layer.
    const cells=Math.floor(WORLD/VOXEL);
    const topGeo=new THREE.BoxGeometry(.98,.09,.98),soilGeo=new THREE.BoxGeometry(.96,1,.96);
    const topMat=blockMaterial(activeConfig.theme.ground),soilMat=blockMaterial(activeConfig.theme.dirt);
    const tops=new THREE.InstancedMesh(topGeo,topMat,cells*cells),soils=new THREE.InstancedMesh(soilGeo,soilMat,cells*cells);
    const dummy=new THREE.Object3D();let n=0;
    const baseY=-1.35;
    for(let ix=0;ix<cells;ix++)for(let iz=0;iz<cells;iz++){
      const x=-WORLD*.5+.5+ix,z=-WORLD*.5+.5+iz,top=heightAt(x,z);
      dummy.position.set(x,top-.045,z);dummy.scale.set(1,1,1);dummy.updateMatrix();tops.setMatrixAt(n,dummy.matrix);
      const colH=Math.max(.08,top-baseY);
      dummy.position.set(x,baseY+colH*.5,z);dummy.scale.set(1,colH,1);dummy.updateMatrix();soils.setMatrixAt(n,dummy.matrix);
      n++;
    }
    tops.receiveShadow=true;soils.receiveShadow=true;worldGroup.add(soils,tops);
    tops.userData.isTerrain=true;soils.userData.isTerrain=true;

    // Biome-specific ambient voxel landmarks.
    const ambientCount=activeConfig.biome==="overworld"?24:18;
    for(let i=0;i<ambientCount;i++){
      const x=-27+((i*37+life.mapIndex*17)%97)/97*54,z=-27+((i*61+life.mapIndex*23)%101)/101*54;
      if(Math.hypot(x,z)<3.2||activeConfig.zones.some(q=>Math.hypot(q.x-x,q.z-z)<2.4))continue;
      const id="A-"+life.mapIndex+"-"+String(i+1).padStart(2,"0");
      if(activeConfig.biome==="overworld")makeTree(x,z,id);
      else if(activeConfig.biome==="nether")makeNetherPillar(x,z,id);
      else makeChorus(x,z,id);
    }

    // Small block boulders for visual texture and object recognition.
    const stoneMat=blockMaterial(activeConfig.theme.rock);
    for(let i=0;i<34;i++){
      const x=-28+((i*29+life.mapIndex*11)%103)/103*56,z=-28+((i*47+life.mapIndex*19)%107)/107*56;
      if(Math.hypot(x,z)<2.4)continue;
      const g=new THREE.Group();
      const size=.24+.10*((i*7)%5)/5;
      addVoxel(g,stoneMat,0,size*.5,0,size,size,size);
      g.position.set(x,heightAt(x,z),z);worldGroup.add(g);
      registerVisual(g,{id:"B-"+String(i+1).padStart(2,"0"),kind:"ambientRock",className:activeConfig.biome==="end"?"END STONE":"STONE",classThreshold:.64,label:"block",zone:null,ambient:true});
    }

    const discovered=new Set(mem().discovered);
    activeConfig.zones.forEach((def,i)=>{
      let mesh=null;
      if(def.kind==="geology"){
        mesh=makeStoneFormation(def);obstacles.push({x:def.x,z:def.z,rad:.82,zoneId:def.id});
      }else if(def.kind==="parts"){
        mesh=makeOreCluster(def);
      }else if(def.kind==="core"){
        mesh=makeKeyCache(def);
      }else if(def.kind==="gate"){
        mesh=makePortal(def);obstacles.push({x:def.x,z:def.z,rad:1.08,zoneId:def.id});
      }
      let visual=null;
      if(mesh){
        mesh.position.set(def.x,heightAt(def.x,def.z),def.z);
        if(discovered.has(def.id)&&(def.kind==="parts"||def.kind==="core"))mesh.visible=false;
        worldGroup.add(mesh);
        visual=registerVisual(mesh,{id:def.id,kind:def.kind,label:def.label,zone:null,ambient:false});
      }
      const zone={...def,mesh,visual,discovered:discovered.has(def.id)};
      if(visual)visual.zone=zone;
      zones.push(zone);
    });
    setLight(lightIndex);updateMapUI();
  }

  // Minecraft-style humanoid autonomous bot
  const rover=new THREE.Group();scene.add(rover);

  const botSkin=blockMaterial(0xb8b8b2);
  const botDark=blockMaterial(0x30363a);
  const botAccent=blockMaterial(0x4f8051);
  const botFace=blockMaterial(0x202629);
  const botJoint=blockMaterial(0x6f7475);
  const botGlow=new THREE.MeshStandardMaterial({color:0x63b86e,roughness:.45,emissive:0x193d1d,emissiveIntensity:.65});

  const torso=new THREE.Mesh(new THREE.BoxGeometry(.30,.64,.52),botSkin);
  torso.position.set(0,.96,0);torso.castShadow=true;rover.add(torso);
  const chestPanel=new THREE.Mesh(new THREE.BoxGeometry(.025,.26,.28),botDark);
  chestPanel.position.set(.165,1.00,0);rover.add(chestPanel);

  // Head = actual pan/tilt camera platform.
  const mast=new THREE.Group();mast.position.set(0,1.52,0);rover.add(mast);
  const mastTilt=new THREE.Group();mast.add(mastTilt);
  const head=new THREE.Mesh(new THREE.BoxGeometry(.40,.40,.40),botSkin);
  head.castShadow=true;mastTilt.add(head);
  const facePlate=new THREE.Mesh(new THREE.BoxGeometry(.025,.18,.28),botFace);
  facePlate.position.set(.213,0,0);mastTilt.add(facePlate);
  const eyeMat=new THREE.MeshStandardMaterial({color:0x9de2d2,emissive:0x234e46,emissiveIntensity:.9,roughness:.25});
  const eyeL=new THREE.Mesh(new THREE.BoxGeometry(.025,.055,.07),eyeMat);
  const eyeR=eyeL.clone();eyeL.position.set(.228,.035,-.085);eyeR.position.set(.228,.035,.085);mastTilt.add(eyeL,eyeR);
  const lens=new THREE.Object3D();lens.position.set(.235,.02,0);mastTilt.add(lens);

  // Legs.
  const leftLegPivot=new THREE.Group(),rightLegPivot=new THREE.Group();
  leftLegPivot.position.set(0,.66,.15);rightLegPivot.position.set(0,.66,-.15);rover.add(leftLegPivot,rightLegPivot);
  const legGeo=new THREE.BoxGeometry(.24,.64,.22);
  const leftLeg=new THREE.Mesh(legGeo,botDark),rightLeg=new THREE.Mesh(legGeo,botDark);
  leftLeg.position.y=-.32;rightLeg.position.y=-.32;leftLeg.castShadow=rightLeg.castShadow=true;
  leftLegPivot.add(leftLeg);rightLegPivot.add(rightLeg);

  // Arms. The right arm doubles as mining/manipulation arm.
  const leftArmPivot=new THREE.Group();leftArmPivot.position.set(0,1.24,.37);rover.add(leftArmPivot);
  const leftArm=new THREE.Mesh(new THREE.BoxGeometry(.22,.64,.22),botSkin);leftArm.position.y=-.31;leftArm.castShadow=true;leftArmPivot.add(leftArm);

  const armBase=new THREE.Group();armBase.position.set(0,1.24,-.37);rover.add(armBase);
  const shoulder=new THREE.Group();armBase.add(shoulder);
  const upperArm=new THREE.Mesh(new THREE.BoxGeometry(.22,.36,.22),botSkin);upperArm.position.y=-.18;upperArm.castShadow=true;shoulder.add(upperArm);
  const elbow=new THREE.Group();elbow.position.y=-.36;shoulder.add(elbow);
  const foreArm=new THREE.Mesh(new THREE.BoxGeometry(.22,.30,.22),botSkin);foreArm.position.y=-.15;foreArm.castShadow=true;elbow.add(foreArm);
  const wrist=new THREE.Group();wrist.position.y=-.31;elbow.add(wrist);

  // Upgrade visuals: visibly robotic, but not armor/weapon progression.
  const speedBootL=new THREE.Mesh(new THREE.BoxGeometry(.28,.13,.26),botAccent);
  const speedBootR=speedBootL.clone();speedBootL.position.set(.05,-.57,0);speedBootR.position.set(.05,-.57,0);
  leftLegPivot.add(speedBootL);rightLegPivot.add(speedBootR);

  const miningTool=new THREE.Group();
  const toolHandle=new THREE.Mesh(new THREE.BoxGeometry(.08,.58,.08),blockMaterial(0x7d5638));toolHandle.position.y=-.27;
  const toolHead=new THREE.Mesh(new THREE.BoxGeometry(.14,.12,.52),blockMaterial(0x5fb9c7));toolHead.position.y=-.55;
  miningTool.add(toolHandle,toolHead);miningTool.position.set(.04,-.02,0);wrist.add(miningTool);

  const opticVisor=new THREE.Mesh(new THREE.BoxGeometry(.035,.10,.34),new THREE.MeshStandardMaterial({color:0x5ba8c4,transparent:true,opacity:.72,emissive:0x12323d,emissiveIntensity:.5}));
  opticVisor.position.set(.235,.03,0);mastTilt.add(opticVisor);

  const detectionAntenna=new THREE.Group();
  const antStem=new THREE.Mesh(new THREE.BoxGeometry(.05,.28,.05),botJoint);antStem.position.y=.14;
  const antTip=new THREE.Mesh(new THREE.BoxGeometry(.10,.10,.10),botGlow);antTip.position.y=.31;detectionAntenna.add(antStem,antTip);
  detectionAntenna.position.set(0,.22,0);mastTilt.add(detectionAntenna);

  const analysisModule=new THREE.Mesh(new THREE.BoxGeometry(.12,.18,.12),botAccent);
  analysisModule.position.set(-.21,.04,.15);mastTilt.add(analysisModule);

  const efficiencyCore=new THREE.Mesh(new THREE.BoxGeometry(.035,.18,.18),botGlow);
  efficiencyCore.position.set(.185,.98,0);rover.add(efficiencyCore);

  const UPGRADE_DEFS={
    speed:{label:"MOVEMENT MODULE",cost:2},
    mining:{label:"MINING MODULE",cost:3},
    vision:{label:"LONG-RANGE OPTICS",cost:2},
    detection:{label:"DETECTION ARRAY",cost:2},
    analysis:{label:"FAST ANALYZER",cost:2},
    efficiency:{label:"POWER EFFICIENCY",cost:3}
  };
  const has=u=>life.upgrades.includes(u);
  function maxBattery(){return 100}
  function applyUpgradeVisuals(){
    speedBootL.visible=speedBootR.visible=has("speed");
    miningTool.visible=has("mining");
    opticVisor.visible=has("vision");
    detectionAntenna.visible=has("detection");
    analysisModule.visible=has("analysis");
    efficiencyCore.visible=has("efficiency");
  }
  function movementMultiplier(){return has("speed")?1.48:1}
  function miningMultiplier(){return has("mining")?1.85:1}
  function analysisMultiplier(){return has("analysis")?1.75:1}
  function visionMultiplier(){return has("vision")?1.65:1}
  function detectionBoost(){return has("detection")?.14:0}
  function efficiencyMultiplier(){return has("efficiency")?.63:1}

  const roverState={
    x:0,z:0,heading:.35,speed:0,targetSpeed:0,battery:clamp(life.battery||100,0,maxBattery()),state:"THINK",timer:1.2,
    targetZone:null,goal:null,navPurpose:null,prevDist:Infinity,stuckTime:0,recoverSign:1,
    mastYaw:0,mastPitch:-.08,mastYawTarget:0,mastPitchTarget:-.08,movingScanPhase:0,
    armProgress:0,armVisual:0,scanProgress:0,yawRate:0,walkPhase:0,upgradeChoice:null,
    mission:(life.currentMission&&life.currentMission.mapIndex===life.mapIndex)?structuredClone(life.currentMission):null
  };
  if(life.position&&life.position.mapIndex===life.mapIndex){roverState.x=life.position.x;roverState.z=life.position.z;roverState.heading=life.position.heading}
  if(roverState.mission&&!["evolve","advance"].includes(roverState.mission.type)){
    roverState.mission=null;life.currentMission=null;
  }
  let running=false,paused=false,lastTime=performance.now(),saveTimer=0;
  const views=["overview","follow","rovercam","armcam"];let viewIndex=0,viewMode="overview";
  const logs=[];
  function log(msg){logs.unshift(msg);if(logs.length>6)logs.length=6;logList.innerHTML=logs.map(x=>"<span>"+x+"</span>").join("")}

  function exploration(){
    const m=mem();return m.discovered.length/Math.max(1,activeConfig.zones.length);
  }
  function knownUnexplored(){
    const m=mem(),seen=new Set(m.seen),done=new Set(m.discovered);
    return zones.filter(z=>seen.has(z.id)&&!done.has(z.id));
  }
  function unseenZones(){
    const seen=new Set(mem().seen);
    return zones.filter(z=>!seen.has(z.id));
  }

  const CELL=5.0;
  function cellKey(x,z){return Math.round(x/CELL)+","+Math.round(z/CELL)}
  function markVisitedCell(){
    const m=mem(),k=cellKey(roverState.x,roverState.z);
    if(!m.visitedCells.includes(k))m.visitedCells.push(k);
  }
  function chooseFrontierGoal(){
    const m=mem(),visited=new Set(m.visitedCells),candidates=[];
    const desiredStep=8.5+life.personality.curiosity*5.0;
    for(let gx=-5;gx<=5;gx++){
      for(let gz=-5;gz<=5;gz++){
        const x=gx*CELL,z=gz*CELL,k=gx+","+gz;
        if(visited.has(k))continue;
        const d=Math.hypot(x-roverState.x,z-roverState.z);
        if(d<3.5)continue;
        const edge=Math.max(Math.abs(x),Math.abs(z))/25;
        const score=-Math.abs(d-desiredStep)*.55+edge*.45+Math.random()*2.2;
        candidates.push({x,z,k,score});
      }
    }
    if(!candidates.length){
      m.visitedCells=[];
      return chooseFrontierGoal();
    }
    candidates.sort((a,b)=>b.score-a.score);
    return candidates[0];
  }

  function upgradeNeeds(){
    const e=life.exp,c=activeConfig;
    return{
      speed:clamp(.28+c.rough*.28+e.distance/180+e.stucks*.08,0,1),
      mining:clamp(.30+life.parts*.08+e.contacts*.09,0,1),
      vision:clamp(unseenZones().length/zones.length*.48+life.mapIndex*.05,0,1),
      detection:clamp(.34+unseenZones().length/zones.length*.34+e.scans*.025,0,1),
      analysis:clamp(.30+e.scans*.055+life.mapIndex*.04,0,1),
      efficiency:clamp(.24+e.charges*.15+e.distance/220,0,1)
    };
  }

  function desiredUpgradeCandidate(){
    const needs=upgradeNeeds();let best=null;
    for(const [id,d] of Object.entries(UPGRADE_DEFS)){
      if(has(id))continue;
      const score=life.personality.improve*34+needs[id]*52+(life.parts>=d.cost?13:0)+Math.random()*7;
      if(!best||score>best.score)best={id,score,cost:d.cost,label:d.label,need:needs[id]};
    }
    return best;
  }

  function missionZone(){
    const m=roverState.mission;
    return m&&m.targetId?zones.find(z=>z.id===m.targetId)||null:null;
  }

  function setMission(m,reason=""){
    roverState.mission={...m,mapIndex:life.mapIndex,startedAt:Date.now()};
    life.currentMission=structuredClone(roverState.mission);
    log("mission: "+roverState.mission.label.toLowerCase()+(reason?" · "+reason:""));
    decisionBadge.textContent="MISSION · "+roverState.mission.label;
    saveLife();
  }

  function finishMission(note="complete"){
    const old=roverState.mission;
    if(old)log("mission complete · "+old.label.toLowerCase()+" · "+note);
    roverState.mission=null;life.currentMission=null;saveLife();think();
  }

  function abortMission(note="replan"){
    const old=roverState.mission;
    if(old)log("mission replan · "+old.label.toLowerCase()+" · "+note);
    roverState.mission=null;life.currentMission=null;saveLife();think();
  }

  function think(){
    roverState.state="THINK";roverState.timer=.72+rnd(.20,.65);roverState.speed=0;roverState.yawRate=0;roverState.armProgress=0;
    decisionBadge.textContent=roverState.mission?"MISSION · "+roverState.mission.label:"THINKING…";
  }

  function usefulUnknownForMission(mission){
    const memory=mem(),done=new Set(memory.discovered);
    const candidates=zones.filter(z=>memory.seen.includes(z.id)&&!done.has(z.id));
    if(!mission)return candidates[0]||null;

    if(mission.type==="evolve"){
      const salvage=candidates.filter(z=>z.kind==="parts");
      if(salvage.length)return salvage.sort((a,b)=>
        Math.hypot(a.x-roverState.x,a.z-roverState.z)-Math.hypot(b.x-roverState.x,b.z-roverState.z)
      )[0];
      const mystery=candidates.filter(z=>recognitionLabel(z)==="?"); 
      return mystery.sort((a,b)=>
        Math.hypot(a.x-roverState.x,a.z-roverState.z)-Math.hypot(b.x-roverState.x,b.z-roverState.z)
      )[0]||null;
    }

    if(mission.type==="advance"){
      const priority=candidates.filter(z=>z.kind==="core"||z.kind==="gate");
      if(priority.length)return priority.sort((a,b)=>
        Math.hypot(a.x-roverState.x,a.z-roverState.z)-Math.hypot(b.x-roverState.x,b.z-roverState.z)
      )[0];
      const mystery=candidates.filter(z=>recognitionLabel(z)==="?"); 
      return mystery.sort((a,b)=>
        Math.hypot(a.x-roverState.x,a.z-roverState.z)-Math.hypot(b.x-roverState.x,b.z-roverState.z)
      )[0]||null;
    }
    return null;
  }

  function chooseMission(){
    const memory=mem(),p=life.personality;
    const up=desiredUpgradeCandidate();

    if(!up){
      setMission({type:"advance",label:"REACH NEXT DIMENSION"},"no remaining upgrade candidate");
      continueMission();return;
    }

    const upgradeProgress=clamp(life.parts/up.cost,0,1);
    const gateProgress=(memory.gateKnown?0.35:0)+(memory.coreHeld?0.35:0)+(memory.gateActivated?0.45:0);
    const evolveScore=48+p.improve*34+up.need*24+upgradeProgress*20+Math.random()*6;
    const advanceScore=44+p.curiosity*30+gateProgress*34+(life.upgrades.length>=2?8:0)+Math.random()*6;

    if(advanceScore>evolveScore){
      setMission({type:"advance",label:"REACH NEXT DIMENSION"},"next environment has become the stronger objective");
    }else{
      setMission({type:"evolve",upgradeId:up.id,label:"SELF EVOLUTION · "+up.label},"capability improvement is the stronger objective");
    }
    continueMission();
  }

  function startFrontierTravel(purposeLabel="goal-directed search"){
    const g=chooseFrontierGoal();
    roverState.movingScanPhase=0;
    startNavigation({x:g.x,z:g.z},"frontier",null,.68*movementMultiplier());
    decisionBadge.textContent="MISSION · "+(roverState.mission?roverState.mission.label:"GOAL");
    log(purposeLabel+" · viewpoint "+g.k);
  }

  function continueMission(){
    const mission=roverState.mission;
    if(!mission){chooseMission();return}

    const memory=mem();
    if(roverState.battery<28+life.personality.caution*16){
      startCharge();return;
    }

    if(mission.type==="evolve"){
      const d=UPGRADE_DEFS[mission.upgradeId];
      if(!d||has(mission.upgradeId)){finishMission("target capability acquired");return}

      mission.step="BUILD "+d.label;
      if(life.parts>=d.cost){
        mission.step="INSTALLING "+d.label;
        startUpgrade({id:mission.upgradeId,label:d.label,cost:d.cost,score:0,need:1});return;
      }

      const useful=usefulUnknownForMission(mission);
      if(useful){
        mission.step="CHECK "+useful.id+" FOR USEFUL MATERIAL";
        navigateToZone(useful);return;
      }

      const missing=d.cost-life.parts;
      mission.step="FIND "+missing+" MORE PART"+(missing===1?"":"S")+" FOR "+d.label;
      startFrontierTravel("searching for upgrade material");return;
    }

    if(mission.type==="advance"){
      if(memory.gateActivated){
        mission.step="ENTER ACTIVE PORTAL";
        navigateToGate("enter");return;
      }

      if(memory.gateKnown&&memory.coreHeld){
        mission.step="RETURN TO PORTAL WITH KEY ITEM";
        navigateToGate("activate");return;
      }

      const useful=usefulUnknownForMission(mission);
      if(useful){
        if(useful.kind==="core")mission.step="EXAMINE POSSIBLE PORTAL ITEM";
        else if(useful.kind==="gate")mission.step="EXAMINE POSSIBLE PORTAL FRAME";
        else mission.step="IDENTIFY UNKNOWN OBJECT FOR PORTAL CLUES";
        navigateToZone(useful);return;
      }

      if(!memory.gateKnown&&!memory.coreHeld)mission.step="FIND PORTAL FRAME OR KEY ITEM";
      else if(!memory.gateKnown)mission.step="FIND PORTAL FRAME";
      else mission.step="FIND ITEM THAT CAN ACTIVATE THE PORTAL";
      startFrontierTravel("searching for route to next dimension");return;
    }

    abortMission("invalid top-level objective");
  }

  function decideNextStep(){
    if(roverState.mission)continueMission();
    else chooseMission();
  }

  function startNavigation(goal,purpose,zone,speed){
    roverState.goal=goal;roverState.navPurpose=purpose;roverState.targetZone=zone;roverState.state="NAV";roverState.targetSpeed=speed;
    roverState.prevDist=Infinity;roverState.stuckTime=0;
  }
  function navigateToZone(z){
    const dx=roverState.x-z.x,dz=roverState.z-z.z,d=Math.max(.001,Math.hypot(dx,dz));
    const stand=z.kind==="gate"?1.65:(z.kind==="geology"?1.28:.95);
    startNavigation({x:z.x+dx/d*stand,z:z.z+dz/d*stand},"explore",z,.70*movementMultiplier());
    log("frontier selected · "+z.id);
  }
  function gateZone(){return zones.find(z=>z.kind==="gate")}
  function navigateToGate(purpose){
    const g=gateZone();if(!g){think();return}
    startNavigation({x:g.x-1.25,z:g.z},purpose,g,.62*movementMultiplier());log((purpose==="activate"?"returning to portal":"heading through portal"));
  }

  function steeringTo(goal){
    let desired=Math.atan2(goal.z-roverState.z,goal.x-roverState.x),avoid=0;
    const look=1.0+Math.abs(roverState.speed)*1.15;
    const fx=roverState.x+Math.cos(roverState.heading)*look,fz=roverState.z+Math.sin(roverState.heading)*look;
    const seenSet=new Set(mem().seen);
    for(const o of obstacles){
      if(roverState.targetZone&&o.zoneId===roverState.targetZone.id&&roverState.navPurpose==="explore")continue;
      const bodyDist=Math.hypot(roverState.x-o.x,roverState.z-o.z);
      if(!seenSet.has(o.zoneId)&&bodyDist>.62)continue;
      const d=Math.hypot(fx-o.x,fz-o.z),rad=o.rad+.28;
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
    const roughPenalty=activeConfig.rough*.34;
    const maxTurn=1.0*(1-clamp(Math.abs(roverState.speed),0,.9)*.35);
    roverState.yawRate=clamp(err*1.55,-maxTurn,maxTurn);roverState.heading=wrap(roverState.heading+roverState.yawRate*dt);
    const slope=Math.hypot(heightAt(roverState.x+.18,roverState.z)-heightAt(roverState.x-.18,roverState.z),heightAt(roverState.x,roverState.z+.18)-heightAt(roverState.x,roverState.z-.18));
    const terrainFactor=clamp(1-roughPenalty-slope*1.05,.38,1);
    const turnFactor=1-clamp(Math.abs(err)/1.5,0,.60);
    const goalSpeed=roverState.targetSpeed*terrainFactor*turnFactor;
    roverState.speed+=(goalSpeed-roverState.speed)*Math.min(1,dt*2.0);
    const step=roverState.speed*dt;roverState.x+=Math.cos(roverState.heading)*step;roverState.z+=Math.sin(roverState.heading)*step;
    life.exp.distance+=Math.abs(step);

    if(dist>roverState.prevDist-.006)roverState.stuckTime+=dt;else roverState.stuckTime=Math.max(0,roverState.stuckTime-dt*.9);
    roverState.prevDist=dist;
    const stuckLimit=has("speed")?3.0:2.45;
    if(roverState.stuckTime>stuckLimit){
      life.exp.stucks++;life.personality.caution=clamp(life.personality.caution+.012,.25,.95);life.personality.improve=clamp(life.personality.improve+.015,.25,.98);
      roverState.recoverSign=Math.random()<.5?-1:1;roverState.state="RECOVER";roverState.timer=1.65;roverState.stuckTime=0;log("path failed · learning from recovery");saveLife();return;
    }

    if(dist<.24){
      roverState.speed=0;
      if(roverState.navPurpose==="explore")startScan(roverState.targetZone);
      else if(roverState.navPurpose==="activate")startGateActivation();
      else if(roverState.navPurpose==="enter")startTransit();
      else if(roverState.navPurpose==="frontier"){
        markVisitedCell();
        log("goal-directed viewpoint reached");saveLife();think();
      }
      else think();
    }
  }

  function startScan(z){
    roverState.state="SCAN";roverState.targetZone=z;roverState.timer=2.55/analysisMultiplier();roverState.scanProgress=0;roverState.mastYaw=0;life.exp.scans++;
    log("inspect block · "+z.id);
  }
  function resolvedClass(z){
    if(z.kind==="geology")return z.blockType||"STONE";
    if(z.kind==="parts")return (z.resource?z.resource+" ORE":"ORE");
    if(z.kind==="core")return z.item||activeConfig.core||"PORTAL KEY";
    if(z.kind==="gate")return z.portal||activeConfig.gateName||"PORTAL";
    return "BLOCK";
  }
  function recognitionLabel(z){
    const m=mem(),known=m.recognized[z.id];
    if(known)return known;
    if(m.discovered.includes(z.id))return resolvedClass(z);
    return "?";
  }
  function identifyZone(z){
    mem().recognized[z.id]=resolvedClass(z);
  }

  function resolveZone(){
    const z=roverState.targetZone,m=mem();identifyZone(z);
    if(z.kind==="gate"){
      if(!m.discovered.includes(z.id))m.discovered.push(z.id);z.discovered=true;m.gateKnown=true;
      if(z.mesh)z.mesh.visible=true;
      log("portal frame identified · "+resolvedClass(z).toLowerCase());activityText.textContent="ポータル構造を記憶しました。";saveLife();think();return;
    }
    if(z.kind==="core"){
      roverState.state="PICKUP";roverState.timer=2.35/miningMultiplier();roverState.armProgress=0;log("possible portal item identified");return;
    }
    if(z.kind==="parts"){
      roverState.state="PICKUP";roverState.timer=2.10/miningMultiplier();roverState.armProgress=0;log("ore vein identified · "+resolvedClass(z).toLowerCase());return;
    }
    if(!m.discovered.includes(z.id))m.discovered.push(z.id);z.discovered=true;
    const contactScore=(z.interest||.5)*(.55+life.personality.curiosity*.65)+(life.parts<2?.16:0);
    if(contactScore>.72){
      roverState.state="CONTACT";roverState.timer=2.25/miningMultiplier();roverState.armProgress=0;log("surface contact selected");life.exp.contacts++;
    }else{
      log("scan sufficient · leaving site");saveLife();think();
    }
  }

  function finishPickup(){
    const z=roverState.targetZone,m=mem();
    if(!m.discovered.includes(z.id))m.discovered.push(z.id);z.discovered=true;
    if(z.kind==="core"){
      m.coreHeld=true;if(z.mesh)z.mesh.visible=false;log("inventory + "+resolvedClass(z).toLowerCase());
    }else{
      const gain=(z.parts||1);life.parts+=gain;if(z.mesh)z.mesh.visible=false;
      log("mined "+resolvedClass(z).toLowerCase()+" · +"+gain+" material");
    }
    saveLife();think();
  }
  function finishContact(){
    life.samples++;const z=roverState.targetZone;
    log("analysis stored · "+z.label);
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
    applyUpgradeVisuals();log("upgrade installed · "+up.label.toLowerCase());saveLife();
    if(roverState.mission&&roverState.mission.type==="evolve"&&roverState.mission.upgradeId===up.id){finishMission("upgrade installed");}
    else think();
  }

  function startGateActivation(){
    roverState.state="ACTIVATE_GATE";roverState.timer=3.1;roverState.armProgress=0;
    log("using "+activeConfig.core.toLowerCase()+" on "+(activeConfig.gateName||"portal").toLowerCase());
  }
  function finishGateActivation(){
    const m=mem();m.coreHeld=false;m.gateActivated=true;life.exp.gates++;
    if(gateVisual)gateVisual.portal.visible=true;log((activeConfig.gateName||"portal").toLowerCase()+" activated");saveLife();think();
  }
  function startTransit(){roverState.state="TRANSIT";roverState.timer=2.0;roverState.speed=.28;log("crossing threshold by own decision")}
  function advanceMap(){
    life.mapIndex++;life.personality.curiosity=clamp(life.personality.curiosity+.01,.25,.98);life.personality.caution=clamp(life.personality.caution-.006,.22,.95);
    life.position=null;life.currentMission=null;roverState.mission=null;
    roverState.x=0;roverState.z=0;roverState.heading=rnd(-Math.PI,Math.PI);roverState.speed=0;roverState.targetZone=null;
    buildWorld();roverState.battery=Math.min(maxBattery(),roverState.battery+12);applyUpgradeVisuals();log("entered dimension · "+activeConfig.name.toLowerCase());saveLife();think();
  }

  function selfWorkVisible(){
    const panTarget=THREE.MathUtils.degToRad(-48);
    return Math.abs(wrap(roverState.mastYaw-panTarget))<THREE.MathUtils.degToRad(22)
      && roverState.mastPitch<THREE.MathUtils.degToRad(-48);
  }

  function updateBehavior(dt,time){
    if(roverState.state==="THINK"){roverState.timer-=dt;if(roverState.timer<=0)decideNextStep()}
    else if(roverState.state==="NAV"){updateNavigation(dt);if(roverState.navPurpose==="frontier")roverState.movingScanPhase+=dt;}
    else if(roverState.state==="SCAN"){
      const canSee=roverState.targetZone&&visibleToCamera(roverState.targetZone);
      if(canSee){roverState.timer-=dt;roverState.scanProgress+=dt;}
      if(roverState.timer<=0)resolveZone();
    }else if(roverState.state==="PICKUP"){
      const canSee=roverState.targetZone&&visibleToCamera(roverState.targetZone);
      if(canSee){
        roverState.timer-=dt;
        roverState.armProgress=clamp(roverState.armProgress+dt*.72*miningMultiplier(),0,1);
      }
      if(roverState.timer<=0)finishPickup();
    }else if(roverState.state==="CONTACT"){
      const canSee=roverState.targetZone&&visibleToCamera(roverState.targetZone);
      if(canSee){
        roverState.timer-=dt;
        roverState.armProgress=clamp(roverState.armProgress+dt*.68*miningMultiplier(),0,1);
      }
      if(roverState.timer<=0)finishContact();
    }else if(roverState.state==="UPGRADE"){
      if(selfWorkVisible()){
        roverState.timer-=dt;
        roverState.armProgress=.55+.35*Math.sin(time*.004)**2;
      }
      if(roverState.timer<=0)finishUpgrade();
    }else if(roverState.state==="ACTIVATE_GATE"){
      const canSee=roverState.targetZone&&visibleToCamera(roverState.targetZone);
      if(canSee){
        roverState.timer-=dt;
        roverState.armProgress=clamp(1-roverState.timer/3.1,0,1);
      }
      if(roverState.timer<=0)finishGateActivation();
    }else if(roverState.state==="CHARGE"){
      roverState.speed=0;roverState.yawRate=0;const rate=has("efficiency")?3.8:2.7;roverState.battery=Math.min(maxBattery(),roverState.battery+dt*rate);
      if(roverState.battery>=maxBattery()*(.62+life.personality.caution*.14)){log("energy margin restored");saveLife();think()}
    }else if(roverState.state==="RECOVER"){
      roverState.timer-=dt;roverState.speed=-.28;roverState.yawRate=roverState.recoverSign*.44;roverState.heading=wrap(roverState.heading+roverState.yawRate*dt);
      roverState.x+=Math.cos(roverState.heading)*roverState.speed*dt;roverState.z+=Math.sin(roverState.heading)*roverState.speed*dt;
      if(roverState.timer<=0){roverState.speed=0;think()}
    }else if(roverState.state==="TRANSIT"){
      roverState.timer-=dt;roverState.speed=.28;roverState.x+=Math.cos(roverState.heading)*roverState.speed*dt;roverState.z+=Math.sin(roverState.heading)*roverState.speed*dt;
      if(roverState.timer<=0)advanceMap();
    }

    if(Math.abs(roverState.speed)>.08)markVisitedCell();
    roverState.walkPhase+=Math.abs(roverState.speed)*dt*8.2;
    const work=["SCAN","PICKUP","CONTACT","UPGRADE","ACTIVATE_GATE"].includes(roverState.state)?.07:0;
    if(roverState.state!=="CHARGE")roverState.battery=Math.max(0,roverState.battery-dt*((Math.abs(roverState.speed)>.06?.30:.065)+work)*efficiencyMultiplier());
    if(roverState.battery<=3&&roverState.state!=="CHARGE"){startCharge()}
  }

  const PAN_MAX=THREE.MathUtils.degToRad(95),TILT_UP=THREE.MathUtils.degToRad(28),TILT_DOWN=THREE.MathUtils.degToRad(-72);
  const CAMERA_VFOV=THREE.MathUtils.degToRad(46);
  let perceptionTimer=0;

  function aimAnglesAt(zone){
    const dx=zone.x-roverState.x,dz=zone.z-roverState.z;
    const worldBearing=Math.atan2(dz,dx);
    const pan=clamp(wrap(roverState.heading-worldBearing),-PAN_MAX,PAN_MAX);
    const horizontal=Math.max(.1,Math.hypot(dx,dz));
    const targetY=heightAt(zone.x,zone.z)+(zone.kind==="gate"?1.05:.28);
    const cameraY=heightAt(roverState.x,roverState.z)+1.52;
    const tilt=clamp(Math.atan2(targetY-cameraY,horizontal),TILT_DOWN,TILT_UP);
    return{pan,tilt};
  }

  function updateMast(dt,time){
    let pan=0,tilt=-.10;
    if(roverState.state==="NAV"&&roverState.navPurpose==="frontier"){
      const phase=roverState.movingScanPhase;
      const near=Math.sin(phase*.62)>.20;
      pan=Math.sin(phase*1.15)*THREE.MathUtils.degToRad(72);
      tilt=near
        ? THREE.MathUtils.degToRad(-57)+Math.sin(phase*1.7)*THREE.MathUtils.degToRad(8)
        : THREE.MathUtils.degToRad(-9)+Math.sin(phase*.82)*THREE.MathUtils.degToRad(19);
      decisionBadge.textContent=near?"MOVING · NEAR FIELD":"MOVING · HORIZON";
    }else if(roverState.state==="UPGRADE"){
      pan=THREE.MathUtils.degToRad(-48)+Math.sin(time*.0011)*THREE.MathUtils.degToRad(12);
      tilt=THREE.MathUtils.degToRad(-64)+Math.sin(time*.0016)*THREE.MathUtils.degToRad(5);
    }else if(roverState.state==="THINK"){
      pan=Math.sin(time*.00072)*THREE.MathUtils.degToRad(55);
      tilt=THREE.MathUtils.degToRad(-7)+Math.sin(time*.00051)*THREE.MathUtils.degToRad(8);
    }else if(["SCAN","PICKUP","CONTACT","ACTIVATE_GATE"].includes(roverState.state)&&roverState.targetZone){
      const a=aimAnglesAt(roverState.targetZone);pan=a.pan;tilt=a.tilt;
    }else if(roverState.state==="NAV"){
      pan=clamp(-roverState.yawRate*.40,-THREE.MathUtils.degToRad(28),THREE.MathUtils.degToRad(28));
      tilt=THREE.MathUtils.degToRad(-8);
    }else if(roverState.state==="RECOVER"){
      pan=roverState.recoverSign*THREE.MathUtils.degToRad(42);tilt=THREE.MathUtils.degToRad(-12);
    }
    roverState.mastYawTarget=clamp(pan,-PAN_MAX,PAN_MAX);
    roverState.mastPitchTarget=clamp(tilt,TILT_DOWN,TILT_UP);
    const panStep=THREE.MathUtils.degToRad(has("vision")?118:92)*dt;
    const tiltStep=THREE.MathUtils.degToRad(68)*dt;
    const pd=wrap(roverState.mastYawTarget-roverState.mastYaw);
    roverState.mastYaw=wrap(roverState.mastYaw+clamp(pd,-panStep,panStep));
    roverState.mastPitch+=clamp(roverState.mastPitchTarget-roverState.mastPitch,-tiltStep,tiltStep);
  }

  function cameraPose(){
    rover.updateMatrixWorld(true);
    const origin=new THREE.Vector3();lens.getWorldPosition(origin);
    const q=new THREE.Quaternion();mastTilt.getWorldQuaternion(q);
    const forward=new THREE.Vector3(1,0,0).applyQuaternion(q).normalize();
    const right=new THREE.Vector3(0,0,1).applyQuaternion(q).normalize();
    const up=new THREE.Vector3(0,1,0).applyQuaternion(q).normalize();
    return{origin,forward,right,up};
  }

  const sensorCamera=new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(CAMERA_VFOV),camera.aspect,.05,32);
  const sensorFrustum=new THREE.Frustum();
  const sensorMatrix=new THREE.Matrix4();
  const sensorRay=new THREE.Raycaster();
  const boxScratch=new THREE.Box3();
  const centerScratch=new THREE.Vector3();

  function updateSensorCamera(){
    const pose=cameraPose();
    sensorCamera.aspect=camera.aspect;
    sensorCamera.fov=THREE.MathUtils.radToDeg(CAMERA_VFOV);
    sensorCamera.position.copy(pose.origin);
    sensorCamera.up.copy(pose.up);
    sensorCamera.lookAt(pose.origin.clone().add(pose.forward));
    sensorCamera.updateProjectionMatrix();
    sensorCamera.updateMatrixWorld(true);
    sensorCamera.matrixWorldInverse.copy(sensorCamera.matrixWorld).invert();
    sensorMatrix.multiplyMatrices(sensorCamera.projectionMatrix,sensorCamera.matrixWorldInverse);
    sensorFrustum.setFromProjectionMatrix(sensorMatrix);
    return pose;
  }

  function projectedRect(box){
    const pts=[];
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      pts.push(new THREE.Vector3(x,y,z).project(sensorCamera));
    }
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const p of pts){
      if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
      minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
    }
    if(!Number.isFinite(minX))return null;
    const cMinX=clamp(minX,-1,1),cMaxX=clamp(maxX,-1,1),cMinY=clamp(minY,-1,1),cMaxY=clamp(maxY,-1,1);
    const total=Math.max(.000001,(maxX-minX)*(maxY-minY));
    const clipped=Math.max(0,cMaxX-cMinX)*Math.max(0,cMaxY-cMinY);
    if(clipped<=0)return null;
    return{
      minX:cMinX,maxX:cMaxX,minY:cMinY,maxY:cMaxY,
      visibleFraction:clamp(clipped/total,0,1),
      screenFraction:clipped/4
    };
  }

  function samplePoints(box){
    const c=box.getCenter(new THREE.Vector3());
    const sx=(box.max.x-box.min.x)*.28,sy=(box.max.y-box.min.y)*.28,sz=(box.max.z-box.min.z)*.28;
    return[
      c,
      new THREE.Vector3(c.x+sx,c.y,c.z),
      new THREE.Vector3(c.x-sx,c.y,c.z),
      new THREE.Vector3(c.x,c.y+sy,c.z),
      new THREE.Vector3(c.x,c.y,c.z+sz),
      new THREE.Vector3(c.x,c.y,c.z-sz)
    ];
  }

  function terrainOccludes(origin,point){
    const dx=point.x-origin.x,dz=point.z-origin.z,dy=point.y-origin.y;
    const horizontal=Math.hypot(dx,dz);
    const steps=clamp(Math.ceil(horizontal/.65),4,28);
    for(let i=1;i<steps;i++){
      const t=i/steps;
      const x=origin.x+dx*t,z=origin.z+dz*t,lineY=origin.y+dy*t;
      if(heightAt(x,z)>lineY-.05)return true;
    }
    return false;
  }

  function rayVisible(owner,origin,point){
    if(terrainOccludes(origin,point))return false;
    const v=point.clone().sub(origin),dist=v.length();
    if(dist<.08)return true;
    sensorRay.set(origin,v.normalize());sensorRay.near=.03;sensorRay.far=dist+.05;
    const hits=sensorRay.intersectObjects(occlusionMeshes,false);
    if(!hits.length)return true;
    const first=hits[0];
    if(first.object.userData.visualOwner===owner)return true;
    return false;
  }

  function rawClassFor(obj,confidence){
    if(obj.zone){
      const m=mem(),known=m.recognized[obj.zone.id];
      if(known)return known;
      if(m.discovered.includes(obj.zone.id))return recognitionLabel(obj.zone);
      if(obj.zone.kind==="geology")return confidence>=.58?(obj.zone.blockType||"STONE"):"?";
      return "?";
    }
    if(obj.className)return confidence>=(obj.classThreshold||.62)?obj.className:"?";
    if(obj.kind==="ambientRock")return confidence>=.66?"STONE":"?";
    return "?";
  }

  function detectVisualObject(obj,pose){
    if(!obj||!obj.mesh||obj.mesh.visible===false)return null;
    boxScratch.setFromObject(obj.mesh);
    if(boxScratch.isEmpty()||!sensorFrustum.intersectsBox(boxScratch))return null;
    const center=boxScratch.getCenter(centerScratch);
    const dist=center.distanceTo(pose.origin);
    const maxRange=11.5*visionMultiplier();
    if(dist>maxRange)return null;

    const rect=projectedRect(boxScratch);
    if(!rect)return null;
    const detectScale=has("detection")?.62:1;
    const minArea=(obj.ambient?.00009:.00006)*detectScale;
    if(rect.screenFraction<minArea)return null;

    const samples=samplePoints(boxScratch);
    let visibleSamples=0;
    for(const p of samples)if(rayVisible(obj,pose.origin,p))visibleSamples++;
    const occlusion=visibleSamples/samples.length;
    if(occlusion<.17)return null;

    const sizeScore=clamp(Math.sqrt(rect.screenFraction)*7.0,0,1);
    const distanceScore=clamp(1-dist/maxRange,0,1);
    const confidence=clamp(.10+.32*sizeScore+.34*occlusion+.14*rect.visibleFraction+.10*distanceScore+detectionBoost(),.05,.99);
    const cls=rawClassFor(obj,confidence);

    return{obj,rect,dist,confidence,occlusion,cls};
  }

  function detectionForZone(zone){
    return zone?detectionByZoneId.get(zone.id)||null:null;
  }

  function visibleToCamera(zone){
    const d=detectionForZone(zone);
    return !!(d&&d.confidence>=.22&&d.occlusion>=.17);
  }

  function updatePerception(dt){
    perceptionTimer-=dt;if(perceptionTimer>0)return;perceptionTimer=.12;
    const pose=updateSensorCamera(),m=mem(),detections=[];
    detectionByZoneId=new Map();

    for(const obj of visualObjects){
      const d=detectVisualObject(obj,pose);
      if(!d)continue;
      detections.push(d);
      if(obj.zone){
        detectionByZoneId.set(obj.zone.id,d);
        if(d.confidence>=.30&&!m.seen.includes(obj.zone.id)){
          m.seen.push(obj.zone.id);
          log("visual contact · "+obj.zone.id+" · "+(d.cls==="?"?"unknown object":d.cls.toLowerCase())+" · "+Math.round(d.confidence*100)+"%");
          decisionBadge.textContent="SEEN · "+obj.zone.id;
          saveLife();
          if(roverState.state==="NAV"&&roverState.navPurpose==="frontier"){
            roverState.speed=0;
            if(roverState.mission&&obj.zone){
              roverState.mission.step="NEW VISUAL CONTACT · CHECK RELEVANCE TO "+roverState.mission.label;
              log("mission clue found · "+obj.zone.id);
            }
            think();
          }
        }
      }
    }

    detections.sort((a,b)=>{
      const acx=(a.rect.minX+a.rect.maxX)*.5,acy=(a.rect.minY+a.rect.maxY)*.5;
      const bcx=(b.rect.minX+b.rect.maxX)*.5,bcy=(b.rect.minY+b.rect.maxY)*.5;
      return Math.hypot(acx,acy)+a.dist*.003-(Math.hypot(bcx,bcy)+b.dist*.003);
    });
    detectionCache=detections.slice(0,18);
    attentionDetection=detectionCache[0]||null;
  }

  function updatePose(dt,time){
    const x=roverState.x,z=roverState.z;
    const ground=heightAt(x,z);
    rover.position.set(x,ground+.02,z);
    sun.position.set(x-8,11,z+4);sun.target.position.set(x,ground,z);sun.target.updateMatrixWorld();

    rover.rotation.order="YXZ";
    rover.rotation.y=-roverState.heading;
    rover.rotation.x=0;rover.rotation.z=0;

    const moving=clamp(Math.abs(roverState.speed)/.65,0,1);
    const walk=Math.sin(roverState.walkPhase)*.62*moving;
    leftLegPivot.rotation.z=walk;
    rightLegPivot.rotation.z=-walk;
    leftArmPivot.rotation.z=-walk*.78;

    roverState.armVisual+=(roverState.armProgress-roverState.armVisual)*(1-Math.exp(-dt*4.5));
    const work=roverState.armVisual;
    if(work>.06){
      armBase.rotation.y=-.10;
      shoulder.rotation.z=-(.35+1.00*work)+Math.sin(time*.012)*.12*work;
      elbow.rotation.z=.35+.70*work;
      wrist.rotation.z=-.15-.35*work;
    }else{
      armBase.rotation.y=0;
      shoulder.rotation.z=walk*.78;
      elbow.rotation.z=0;
      wrist.rotation.z=0;
    }

    mast.rotation.y=roverState.mastYaw;
    mastTilt.rotation.z=roverState.mastPitch;
  }

  function animateWorld(time){
    if(gateVisual&&gateVisual.portal.visible){
      const pulse=.5+.5*Math.sin(time*.003);
      gateVisual.mat.opacity=.32+.24*pulse;
      gateVisual.portal.scale.set(1,1+.018*Math.sin(time*.005),1);
    }
  }

  function activityCopy(){
    const z=roverState.targetZone,d=z?Math.hypot(z.x-roverState.x,z.z-roverState.z):0;
    switch(roverState.state){
      case"THINK":return["次に何をするか考えています。","カメラで実際に見た記憶だけを使って候補を比較しています。"];
      case"NAV":return[
        roverState.navPurpose==="explore"?"見つけた対象へ移動中。":
        roverState.navPurpose==="activate"?"ポータルへ戻っています。":
        roverState.navPurpose==="enter"?"次のディメンションへ向かっています。":
        roverState.navPurpose==="frontier"?"最大目標を進めるため探索移動中。":"自由移動中。",
        roverState.navPurpose==="frontier"?"改造材料または次のディメンションへの手掛かりを探しながら走行しています。":(z?"目標まで "+d.toFixed(1)+" m。":"経路を調整しています。")
      ];
      case"SCAN":return["現地を詳しく調べています。","見つけた物が何なのか判別しています。"];
      case"PICKUP":return["見つけた物を回収しています。","将来何に使えるかは、まだ決めていません。"];
      case"CONTACT":return["対象へ接触調査しています。","アームで表面を測定しています。"];
      case"UPGRADE":return["自分自身を改造しています。",roverState.upgradeChoice?roverState.upgradeChoice.label+" を取り付けています。":"部品を組み替えています。"];
      case"ACTIVATE_GATE":return["ポータルを起動しています。",(activeConfig.core||"キーアイテム")+" を使ってフレームを起動しています。"];
      case"CHARGE":return["充電のため停止しています。","危険を取らず、行動可能時間を回復しています。"];
      case"RECOVER":return["経路から自力で脱出中。","後退して別の進入角を作っています。"];
      case"TRANSIT":return["ポータルを通過しています。","戻るかどうかは分からないまま次のディメンションへ進みます。"];
      default:return["自律動作中。",""];
    }
  }

  function updateMapUI(){mapText.textContent="DIMENSION "+String(life.mapIndex+1).padStart(2,"0")+" · "+activeConfig.name}
  function updateUI(){
    const [a,b]=activityCopy(),m=mem(),pct=Math.round(exploration()*100);
    stateText.textContent=roverState.state;activityText.textContent=a;detailText.textContent=b;
    const mission=roverState.mission;
    missionText.textContent=mission?mission.label:"NO MISSION";
    if(!mission)missionStepText.textContent="次の最大目標を選んでいます。";
    else if(mission.type==="evolve"){
      const d=UPGRADE_DEFS[mission.upgradeId];
      const need=Math.max(0,(d?.cost||0)-life.parts);
      if(need===0)missionStepText.textContent=(mission.step||"必要部品が揃いました。自己改造へ進みます。");
      else missionStepText.textContent=(mission.step||("改造に必要な部品をあと "+need+" 個探します。"));
    }else if(mission.type==="advance"){
      if(m.gateActivated)missionStepText.textContent="ポータルは起動済みです。次のディメンションへ進みます。";
      else missionStepText.textContent=mission.step||(m.gateKnown?(m.coreHeld?activeConfig.core+" を "+(activeConfig.gateName||"PORTAL")+" へ運びます。":"ポータルを起動できるキーアイテムを探します。"):"ポータルフレームと起動アイテムを探します。");
    }else missionStepText.textContent="最大目標を再計画しています。";
    batteryText.textContent="BATTERY "+Math.round(roverState.battery/maxBattery()*100)+"%";speedText.textContent="SPEED "+Math.abs(roverState.speed).toFixed(2)+" m/s";
    partsText.textContent="MATERIALS "+life.parts;sampleText.textContent="ANALYSES "+life.samples;exploreText.textContent="EXPLORED "+pct+"%";
    headingText.textContent="H "+Math.round((roverState.heading*180/Math.PI+360)%360)+"° · P "+Math.round(THREE.MathUtils.radToDeg(roverState.mastYaw))+"° · T "+Math.round(THREE.MathUtils.radToDeg(roverState.mastPitch))+"°";updateMapUI();
    const P=life.personality;
    curiosityFill.style.width=Math.round(P.curiosity*100)+"%";cautionFill.style.width=Math.round(P.caution*100)+"%";improveFill.style.width=Math.round(P.improve*100)+"%";
    curiosityText.textContent=Math.round(P.curiosity*100);cautionText.textContent=Math.round(P.caution*100);improveText.textContent=Math.round(P.improve*100);
    upgradeList.innerHTML=life.upgrades.length?life.upgrades.map(u=>'<span class="upgrade-chip">'+UPGRADE_DEFS[u].label+'</span>').join(""):'<span class="empty-chip">stock configuration</span>';
    const inv=[];if(m.coreHeld)inv.push(activeConfig.core);if(m.gateKnown)inv.push(m.gateActivated?"PORTAL: ACTIVE":"PORTAL: FOUND");if(life.parts)inv.push("MATERIAL UNITS ×"+life.parts);
    inventoryList.innerHTML=inv.length?inv.map(x=>'<span class="item-chip">'+x+'</span>').join(""):'<span class="empty-chip">nothing unusual yet</span>';
  }

  function updateCamera(dt){
    const dir=new THREE.Vector3(Math.cos(roverState.heading),0,Math.sin(roverState.heading)),side=new THREE.Vector3(-dir.z,0,dir.x),baseY=heightAt(roverState.x,roverState.z);

    if(viewMode==="rovercam"){
      const pose=cameraPose();
      camera.position.copy(pose.origin);
      camera.up.copy(pose.up);
      camTarget.copy(pose.origin).addScaledVector(pose.forward,7);
      camera.lookAt(camTarget);
      camera.fov=THREE.MathUtils.radToDeg(CAMERA_VFOV);
      camera.updateProjectionMatrix();
      return;
    }

    camera.up.set(0,1,0);
    if(viewMode==="overview"){
      camDesired.set(clamp(roverState.x+11.5,-28,28),15.5,clamp(roverState.z+14.0,-28,28));
      camTarget.set(roverState.x,baseY,roverState.z);
    }
    else if(viewMode==="follow"){camDesired.set(roverState.x-dir.x*3.3+side.x*.95,baseY+2.15,roverState.z-dir.z*3.3+side.z*.95);camTarget.set(roverState.x+dir.x*.9,baseY+.45,roverState.z+dir.z*.9)}
    else{const tip=new THREE.Vector3(.12,0,0);wrist.localToWorld(tip);camDesired.copy(tip).add(new THREE.Vector3(0,.08,0));if(roverState.targetZone)camTarget.set(roverState.targetZone.x,heightAt(roverState.targetZone.x,roverState.targetZone.z)+.35,roverState.targetZone.z);else camTarget.copy(tip).add(dir)}
    const k=viewMode==="overview"?2.3:(viewMode==="follow"?4.2:8.0);
    camera.position.lerp(camDesired,1-Math.exp(-dt*k));
    const now=new THREE.Vector3();camera.getWorldDirection(now);now.multiplyScalar(2).add(camera.position);now.lerp(camTarget,1-Math.exp(-dt*k));camera.lookAt(now);
    const f=viewMode==="armcam"?54:48;camera.fov+=(f-camera.fov)*(1-Math.exp(-dt*3));camera.updateProjectionMatrix();
  }

  function updateScope(){
    const active=viewMode==="rovercam";
    scopeOverlay.hidden=!active;
    if(!active){scopeDetections.innerHTML="";return;}

    const detections=[];
    for(const d of detectionCache){
      const left=(d.rect.minX*.5+.5)*100;
      const right=(d.rect.maxX*.5+.5)*100;
      const top=(-d.rect.maxY*.5+.5)*100;
      const bottom=(-d.rect.minY*.5+.5)*100;
      const w=clamp(right-left,2.8,28),h=clamp(bottom-top,3.0,28);
      const cx=(left+right)*.5,cy=(top+bottom)*.5;
      const unknown=d.cls==="?";
      detections.push(
        '<div class="detection-box" style="left:'+cx.toFixed(2)+'%;top:'+cy.toFixed(2)+'%;width:'+w.toFixed(2)+'%;height:'+h.toFixed(2)+'%">'+
        '<div class="detection-label '+(unknown?'unknown':'')+'">'+d.cls+
        '<small>'+Math.round(d.confidence*100)+'% · '+d.dist.toFixed(1)+' m</small></div></div>'
      );
    }
    scopeDetections.innerHTML=detections.join("");

    let d=null;
    const targetDet=roverState.targetZone?detectionForZone(roverState.targetZone):null;
    if(targetDet)d=targetDet;else d=attentionDetection;

    if(!d){
      scopeReticle.classList.add("searching");scopeReticle.classList.remove("locked");
      scopeReticle.style.left="50%";scopeReticle.style.top="50%";
      scopeTarget.textContent="SEARCHING";
      scopeDistance.textContent=roverState.state==="NAV"&&roverState.navPurpose==="frontier"?"SCANNING WHILE MOVING":"NO VISUAL CONTACT";
      return;
    }

    const cx=((d.rect.minX+d.rect.maxX)*.25+.5)*100;
    const cy=(-(d.rect.minY+d.rect.maxY)*.25+.5)*100;
    scopeReticle.classList.remove("searching");scopeReticle.classList.add("locked");
    scopeReticle.style.left=clamp(cx,4,96)+"%";scopeReticle.style.top=clamp(cy,5,95)+"%";
    scopeTarget.textContent="VISUAL LOCK · "+d.cls;
    scopeDistance.textContent=Math.round(d.confidence*100)+"% · "+d.dist.toFixed(1)+" m";
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
  newLifeButton.addEventListener("click",()=>{if(confirm("Tiny Bot の性格・記憶・改造をすべて初期化しますか？")){try{localStorage.removeItem(SAVE_KEY)}catch(_){}location.reload()}});
  window.addEventListener("blur",()=>{if(running&&!paused){paused=true;pauseButton.textContent="RESUME";pauseButton.setAttribute("aria-pressed","true");saveLife()}});

  buildWorld();applyUpgradeVisualsAndBattery();rover.position.set(roverState.x,heightAt(roverState.x,roverState.z)+.02,roverState.z);updatePose(.016,0);updateUI();updateCamera(.016);
  if(life.position)log("saved life found · map "+String(life.mapIndex+1).padStart(2,"0"));

  function animate(time){
    const dt=Math.min(.035,Math.max(0,(time-lastTime)/1000||.016));lastTime=time;
    if(running&&!paused){
      updateBehavior(dt,time);updateMast(dt,time);updatePose(dt,time);updatePerception(dt);animateWorld(time);updateCamera(dt);updateScope();updateUI();
      saveTimer+=dt;if(saveTimer>6){saveTimer=0;saveLife()}
    }
    else{updateMast(dt*.2,time);updatePose(dt*.2,time);animateWorld(time);updateCamera(dt*.25);updateScope()}
    renderer.render(scene,camera);
  }
  renderer.setAnimationLoop(animate);
}

boot().catch(err=>{console.error(err);const e=document.getElementById("activityText");if(e)e.textContent="3D描画の初期化に失敗しました。";});
})();