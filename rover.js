(() => {
"use strict";
const THREE_URL="https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js";

async function boot(){
  const canvas=document.getElementById("roverCanvas");
  const intro=document.getElementById("intro");
  const enterButton=document.getElementById("enterButton");
  const pauseButton=document.getElementById("pauseButton");
  const viewButton=document.getElementById("viewButton");
  const lightButton=document.getElementById("lightButton");
  const newSiteButton=document.getElementById("newSiteButton");
  const viewBadge=document.getElementById("viewBadge");
  const viewName=document.getElementById("viewName");
  const stateText=document.getElementById("stateText");
  const activityText=document.getElementById("activityText");
  const detailText=document.getElementById("detailText");
  const batteryText=document.getElementById("batteryText");
  const speedText=document.getElementById("speedText");
  const targetText=document.getElementById("targetText");
  const sampleText=document.getElementById("sampleText");
  const headingText=document.getElementById("headingText");
  const lightLabel=document.getElementById("lightLabel");
  const logList=document.getElementById("logList");

  let THREE;
  try{THREE=await import(THREE_URL);}
  catch(err){
    const c=canvas.getContext("2d");c.fillStyle="#2b1710";c.fillRect(0,0,canvas.width,canvas.height);
    c.fillStyle="#f5dfc8";c.font="700 22px system-ui";c.textAlign="center";c.fillText("3D renderer could not be loaded.",canvas.width/2,canvas.height/2);
    activityText.textContent="3Dライブラリを読み込めませんでした。";
    return;
  }

  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;

  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0xa36443);
  scene.fog=new THREE.FogExp2(0x9a6246,.025);

  const camera=new THREE.PerspectiveCamera(47,16/10,.05,80);
  const camDesired=new THREE.Vector3(),camTarget=new THREE.Vector3();

  const hemi=new THREE.HemisphereLight(0xffd4ae,0x32251f,1.45);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffd9a0,2.6);sun.position.set(-8,11,4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;scene.add(sun);

  const lightPresets=[
    {name:"LOW SUN",bg:0xa36443,fog:0x9a6246,hemi:1.45,sun:2.6,color:0xffd09a},
    {name:"HIGH SUN",bg:0xb87951,fog:0xa96f50,hemi:1.72,sun:2.2,color:0xffe3bd},
    {name:"DUSTY",bg:0x8d604d,fog:0x84604e,hemi:1.10,sun:1.15,color:0xe6b58c}
  ];

  const WORLD=18;
  const terrainSeed=Math.random()*9.7;
  function h(x,z){
    return .16*Math.sin(x*.52+terrainSeed)+.11*Math.cos(z*.71-terrainSeed*.4)+.07*Math.sin(x*.86+z*.63)+.035*Math.cos(x*1.7-z*.44);
  }

  function buildTerrain(){
    const g=new THREE.PlaneGeometry(WORLD,WORLD,90,90);g.rotateX(-Math.PI/2);
    const a=g.attributes.position;
    for(let i=0;i<a.count;i++)a.setY(i,h(a.getX(i),a.getZ(i)));
    a.needsUpdate=true;g.computeVertexNormals();
    const m=new THREE.MeshStandardMaterial({color:0x8b5134,roughness:.97,metalness:0});
    const mesh=new THREE.Mesh(g,m);mesh.receiveShadow=true;scene.add(mesh);

    const patches=new THREE.Group();
    for(let i=0;i<46;i++){
      const rr=.04+.06*((i*13)%7)/7;
      const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:i%3?0x704535:0x5f4439,roughness:1}));
      const x=-8+((i*37)%100)/100*16,z=-8+((i*61)%100)/100*16;
      rock.position.set(x,h(x,z)+rr*.35,z);rock.scale.set(rr*1.8,rr*.65,rr*1.4);rock.rotation.set(.2*i,.37*i,.09*i);
      patches.add(rock);
    }
    scene.add(patches);
  }
  buildTerrain();

  const targetDefs=[
    [-5.4,-3.8,.48,.72,"R-01","angular fragment"],
    [4.9,-4.4,.62,.84,"R-02","layered rock"],
    [5.8,2.5,.55,.46,"R-03","dark cobble"],
    [-4.6,4.8,.72,.93,"R-04","bright slab"],
    [1.1,5.8,.50,.68,"R-05","fractured stone"],
    [-.8,-5.7,.58,.57,"R-06","rounded block"],
    [2.7,.8,.42,.78,"R-07","small outcrop"],
    [-3.0,.7,.46,.52,"R-08","dusty fragment"]
  ];

  const targets=[];
  const obstacleList=[];
  function makeRock(def,i){
    const [x,z,rad,interest,id,label]=def;
    const mat=new THREE.MeshStandardMaterial({color:i%2?0x5c4237:0x65483a,roughness:.92});
    const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(rad,1),mat);
    mesh.position.set(x,h(x,z)+rad*.5,z);mesh.scale.y=.72;mesh.rotation.set(.2*i,.55*i,.13*i);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
    const t={x,z,rad,interest,id,label,mesh,visited:false,sampled:false};
    targets.push(t);obstacleList.push(t);return t;
  }
  targetDefs.forEach(makeRock);

  // Rover model
  const rover=new THREE.Group();scene.add(rover);
  const bodyMat=new THREE.MeshStandardMaterial({color:0xc3b19b,roughness:.55,metalness:.08});
  const darkMat=new THREE.MeshStandardMaterial({color:0x2a2c2b,roughness:.75});
  const panelMat=new THREE.MeshStandardMaterial({color:0x263b49,roughness:.32,metalness:.3});
  const brassMat=new THREE.MeshStandardMaterial({color:0x8e774b,roughness:.55,metalness:.35});

  const body=new THREE.Mesh(new THREE.BoxGeometry(1.25,.28,.82),bodyMat);body.position.y=.38;body.castShadow=true;rover.add(body);
  const deck=new THREE.Mesh(new THREE.BoxGeometry(1.06,.055,.72),panelMat);deck.position.y=.56;deck.castShadow=true;rover.add(deck);
  const mast=new THREE.Group();mast.position.set(.18,.58,0);rover.add(mast);
  const mastStem=new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.55,10),brassMat);mastStem.position.y=.27;mast.add(mastStem);
  const mastHead=new THREE.Mesh(new THREE.BoxGeometry(.23,.14,.18),darkMat);mastHead.position.y=.58;mastHead.castShadow=true;mast.add(mastHead);
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.045,16),new THREE.MeshStandardMaterial({color:0x0c1115,metalness:.5,roughness:.15}));
  lens.rotation.z=Math.PI/2;lens.position.set(.13,.59,0);mast.add(lens);

  const wheelGeo=new THREE.CylinderGeometry(.18,.18,.12,24);
  // CylinderGeometry rotates around local Y by default. Bake the axle alignment
  // into the geometry itself so the wheel mesh can use rotation.z only for rolling.
  wheelGeo.rotateX(Math.PI/2);
  const wheels=[];
  for(const x of [-.46,0,.46]){
    for(const z of [-.49,.49]){
      const w=new THREE.Mesh(wheelGeo,darkMat);
      w.position.set(x,.18,z);
      w.castShadow=true;
      rover.add(w);
      wheels.push(w);
    }
  }

  // Arm: base yaw -> shoulder -> elbow -> wrist/tip
  const armBase=new THREE.Group();armBase.position.set(.50,.47,-.28);rover.add(armBase);
  const baseDisk=new THREE.Mesh(new THREE.CylinderGeometry(.11,.12,.08,16),brassMat);baseDisk.position.y=.02;armBase.add(baseDisk);
  const shoulder=new THREE.Group();shoulder.position.y=.08;armBase.add(shoulder);
  function armSegment(length){
    const g=new THREE.BoxGeometry(length,.075,.075),m=new THREE.MeshStandardMaterial({color:0xb7a383,roughness:.5,metalness:.1});
    const seg=new THREE.Mesh(g,m);seg.position.x=length*.5;seg.castShadow=true;return seg;
  }
  const seg1=armSegment(.55);shoulder.add(seg1);
  const elbow=new THREE.Group();elbow.position.x=.55;shoulder.add(elbow);
  const seg2=armSegment(.47);elbow.add(seg2);
  const wrist=new THREE.Group();wrist.position.x=.47;elbow.add(wrist);
  const tool=new THREE.Mesh(new THREE.CylinderGeometry(.045,.06,.18,12),darkMat);tool.rotation.z=Math.PI/2;tool.position.x=.09;wrist.add(tool);

  const roverState={
    x:0,z:0,heading:.4,speed:0,targetSpeed:0,battery:100,samples:0,
    state:"SURVEY",timer:2.7,target:null,goal:null,prevDist:Infinity,stuckTime:0,recoverSign:1,recoverReturn:"DRIVE",
    mastYaw:0,armProgress:0,scanProgress:0,distanceTravelled:0,yawRate:0,wheelAngleL:0,wheelAngleR:0
  };
  rover.position.set(0,h(0,0)+.32,0);

  const views=["overview","follow","rovercam","armcam"];
  let viewIndex=0,viewMode="overview",running=false,paused=false,lastTime=performance.now(),lightIndex=0;
  const logs=[];

  function log(msg){
    logs.unshift(msg);if(logs.length>5)logs.length=5;
    logList.innerHTML=logs.map(x=>"<span>"+x+"</span>").join("");
  }

  function chooseTarget(){
    let candidates=targets.filter(t=>!t.visited);
    if(!candidates.length){targets.forEach(t=>{t.visited=false;t.sampled=false});candidates=[...targets];log("new survey cycle");}
    candidates.sort((a,b)=>{
      const da=Math.hypot(a.x-roverState.x,a.z-roverState.z),db=Math.hypot(b.x-roverState.x,b.z-roverState.z);
      return (da-a.interest*2.1)-(db-b.interest*2.1);
    });
    roverState.target=candidates[0];
    const t=roverState.target;
    const dx=roverState.x-t.x,dz=roverState.z-t.z,d=Math.max(.001,Math.hypot(dx,dz));
    roverState.goal={x:t.x+dx/d*1.45,z:t.z+dz/d*1.45};
    roverState.state="DRIVE";roverState.targetSpeed=.72;roverState.prevDist=Infinity;roverState.stuckTime=0;
    log("target lock · "+t.id);
  }

  function transition(s,time=0){
    roverState.state=s;roverState.timer=time;
    if(s==="SURVEY"){roverState.targetSpeed=0;log("panoramic survey");}
    if(s==="SCAN"){roverState.targetSpeed=0;roverState.scanProgress=0;log("visual scan · "+roverState.target.id);}
    if(s==="ARM_DEPLOY")log("arm deploy");
    if(s==="SAMPLE")log("surface contact");
    if(s==="RETRACT")log("arm retract");
    if(s==="LOG")log("result stored");
    if(s==="CHARGE")log("solar charging");
    if(s==="RECOVER")log("mobility recovery");
  }

  function steeringTo(goal){
    const dx=goal.x-roverState.x,dz=goal.z-roverState.z;
    let desired=Math.atan2(dz,dx);
    let avoid=0;
    for(const o of obstacleList){
      if(o===roverState.target&&roverState.state==="APPROACH")continue;
      const ox=o.x-roverState.x,oz=o.z-roverState.z;
      const d=Math.hypot(ox,oz);
      if(d<1.35+o.rad){
        const bearing=Math.atan2(oz,ox);
        const diff=wrap(bearing-roverState.heading);
        if(Math.abs(diff)<1.1){
          const side=diff>=0?-1:1;
          avoid+=side*(1-d/(1.35+o.rad))*1.25;
        }
      }
    }
    desired=wrap(desired+avoid);
    return desired;
  }
  function wrap(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}

  function updateDrive(dt){
    const g=roverState.goal;
    if(!g)return;
    const dist=Math.hypot(g.x-roverState.x,g.z-roverState.z);
    const desired=steeringTo(g);
    const err=wrap(desired-roverState.heading);
    const maxTurn=.92*(.45+1-clamp(roverState.speed/.8,0,1)*.45);
    roverState.yawRate=clamp(err*1.65,-maxTurn,maxTurn);
    roverState.heading=wrap(roverState.heading+roverState.yawRate*dt);

    const turnPenalty=1-clamp(Math.abs(err)/1.4,0,.62);
    const goalSpeed=roverState.targetSpeed*turnPenalty;
    roverState.speed+=(goalSpeed-roverState.speed)*Math.min(1,dt*2.1);

    const step=roverState.speed*dt;
    roverState.x+=Math.cos(roverState.heading)*step;
    roverState.z+=Math.sin(roverState.heading)*step;
    roverState.distanceTravelled+=Math.abs(step);

    if(dist>roverState.prevDist-.008)roverState.stuckTime+=dt;else roverState.stuckTime=Math.max(0,roverState.stuckTime-dt*.7);
    roverState.prevDist=dist;
    if(roverState.stuckTime>2.3){
      roverState.recoverSign=Math.random()<.5?-1:1;
      roverState.recoverReturn=roverState.state;
      roverState.stuckTime=0;transition("RECOVER",1.7);return;
    }

    if(dist<.19){
      roverState.speed=0;
      if(roverState.state==="DRIVE")transition("BRAKE",.8);
      else if(roverState.state==="APPROACH")transition("ARM_DEPLOY",2.0);
    }
  }

  function updateBehavior(dt){
    if(roverState.battery<20&&["DRIVE","SURVEY"].includes(roverState.state)){transition("CHARGE",0);roverState.speed=0;}
    switch(roverState.state){
      case "SURVEY":
        roverState.yawRate=0;
        roverState.timer-=dt;roverState.mastYaw+=dt*.75;
        if(roverState.timer<=0)chooseTarget();
        break;
      case "DRIVE":
      case "APPROACH": updateDrive(dt);break;
      case "BRAKE":
        roverState.yawRate=0;
        roverState.timer-=dt;roverState.speed*=Math.pow(.1,dt);
        if(roverState.timer<=0)transition("SCAN",2.6);
        break;
      case "SCAN":
        roverState.yawRate=0;
        roverState.timer-=dt;roverState.scanProgress=1-roverState.timer/2.6;
        roverState.mastYaw=Math.sin(roverState.scanProgress*Math.PI*2)*.48;
        if(roverState.timer<=0){
          const t=roverState.target;
          if(t.interest>.62){
            const dx=roverState.x-t.x,dz=roverState.z-t.z,d=Math.max(.001,Math.hypot(dx,dz));
            roverState.goal={x:t.x+dx/d*.82,z:t.z+dz/d*.82};
            roverState.targetSpeed=.34;roverState.state="APPROACH";log("high-interest feature · "+Math.round(t.interest*100)+"%");
          }else{
            t.visited=true;log("scan complete · no contact needed");transition("LOG",1.4);
          }
        }
        break;
      case "ARM_DEPLOY":
        roverState.yawRate=0;
        roverState.timer-=dt;roverState.armProgress=clamp(1-roverState.timer/2,0,1);
        if(roverState.timer<=0)transition("SAMPLE",2.2);
        break;
      case "SAMPLE":
        roverState.yawRate=0;
        roverState.timer-=dt;roverState.armProgress=1;
        if(roverState.timer<=0){
          roverState.samples++;roverState.target.sampled=true;roverState.target.visited=true;
          log("sample "+String(roverState.samples).padStart(2,"0")+" · "+roverState.target.label);
          transition("RETRACT",1.7);
        }
        break;
      case "RETRACT":
        roverState.yawRate=0;
        roverState.timer-=dt;roverState.armProgress=clamp(roverState.timer/1.7,0,1);
        if(roverState.timer<=0)transition("LOG",1.4);
        break;
      case "LOG":
        roverState.yawRate=0;
        roverState.timer-=dt;
        if(roverState.timer<=0)transition("SURVEY",1.8);
        break;
      case "CHARGE":
        roverState.speed=0;roverState.yawRate=0;roverState.battery=Math.min(100,roverState.battery+dt*2.4);
        roverState.mastYaw*=Math.pow(.2,dt);
        if(roverState.battery>=62){log("charge complete · 62%");transition("SURVEY",1.5);}
        break;
      case "RECOVER":
        roverState.timer-=dt;
        roverState.speed=-.28;
        roverState.yawRate=roverState.recoverSign*.42;
        roverState.heading+=roverState.yawRate*dt;
        roverState.x+=Math.cos(roverState.heading)*roverState.speed*dt;
        roverState.z+=Math.sin(roverState.heading)*roverState.speed*dt;
        if(roverState.timer<=0){
          roverState.speed=0;log("recovery complete");
          roverState.state=roverState.target?roverState.recoverReturn:"SURVEY";
          if(roverState.target)roverState.targetSpeed=roverState.state==="APPROACH"?.34:.55;
        }
        break;
    }

    const trackWidth=.98;
    const leftSpeed=roverState.speed-roverState.yawRate*trackWidth*.5;
    const rightSpeed=roverState.speed+roverState.yawRate*trackWidth*.5;
    roverState.wheelAngleL-=leftSpeed*dt/.18;
    roverState.wheelAngleR-=rightSpeed*dt/.18;

    const drain=(Math.abs(roverState.speed)>.08?.34:.08)+(["SCAN","ARM_DEPLOY","SAMPLE","RETRACT"].includes(roverState.state)?.08:0);
    if(roverState.state!=="CHARGE")roverState.battery=Math.max(0,roverState.battery-dt*drain);
  }

  function updatePose(dt){
    const x=roverState.x,z=roverState.z;
    const fwd={x:Math.cos(roverState.heading),z:Math.sin(roverState.heading)};
    const side={x:-fwd.z,z:fwd.x};
    const front=h(x+fwd.x*.5,z+fwd.z*.5),back=h(x-fwd.x*.5,z-fwd.z*.5);
    const left=h(x+side.x*.42,z+side.z*.42),right=h(x-side.x*.42,z-side.z*.42);
    const pitch=Math.atan2(front-back,1.0);
    const roll=Math.atan2(right-left,.84);
    rover.position.set(x,h(x,z)+.34,z);
    rover.rotation.order="YXZ";rover.rotation.y=-roverState.heading;rover.rotation.x=pitch;rover.rotation.z=roll;

    for(const w of wheels){
      const isLeft=w.position.z>0;
      w.rotation.z=isLeft?roverState.wheelAngleL:roverState.wheelAngleR;
    }

    mast.rotation.y=roverState.mastYaw;

    const p=roverState.armProgress;
    const ease=p*p*(3-2*p);
    armBase.rotation.y=(-.35+.42*ease);
    shoulder.rotation.z=-(.18+1.05*ease);
    elbow.rotation.z=(.12+1.35*ease);
    wrist.rotation.z=-(.05+.42*ease);

    if(roverState.state==="SAMPLE"){
      const pulse=Math.sin(performance.now()*.012)*.03;
      wrist.rotation.z-=pulse;
    }
  }

  function activityCopy(){
    const t=roverState.target;
    const d=t?Math.hypot(t.x-roverState.x,t.z-roverState.z):0;
    switch(roverState.state){
      case"SURVEY":return["周囲を見渡しています。","次に調べる対象を探しています。"];
      case"DRIVE":return["岩 "+t.id+" へ移動中。","距離 "+d.toFixed(1)+" m。障害物を避けながら接近しています。"];
      case"BRAKE":return["停止姿勢へ移行。","車体の揺れが収まるのを待っています。"];
      case"SCAN":return["岩 "+t.id+" を観察中。","マストカメラで形状と表面を確認しています。"];
      case"APPROACH":return["接触できる距離まで接近。","速度を落としてアーム作業位置へ移動しています。"];
      case"ARM_DEPLOY":return["ロボットアームを展開中。","先端ツールを岩へ近づけています。"];
      case"SAMPLE":return["表面へ接触しています。","少しだけ停止して測定しています。"];
      case"RETRACT":return["アームを収納中。","接触作業を終了しています。"];
      case"LOG":return["観察結果を記録中。","次の行動に移る前の短い待機です。"];
      case"CHARGE":return["充電のため停止中。","太陽電池でバッテリーを回復しています。"];
      case"RECOVER":return["経路から抜け出しています。","一度バックして向きを変えています。"];
      default:return["自律動作中。",""];
    }
  }

  function updateLabels(){
    const [a,b]=activityCopy();
    stateText.textContent=roverState.state.replace("_"," ");
    activityText.textContent=a;detailText.textContent=b;
    batteryText.textContent="BATTERY "+Math.round(roverState.battery)+"%";
    speedText.textContent="SPEED "+Math.abs(roverState.speed).toFixed(2)+" m/s";
    targetText.textContent="TARGET "+(roverState.target?roverState.target.id:"—");
    sampleText.textContent="SAMPLES "+roverState.samples;
    headingText.textContent="Heading "+Math.round((roverState.heading*180/Math.PI+360)%360)+"°";
  }

  function updateCamera(dt){
    const dir=new THREE.Vector3(Math.cos(roverState.heading),0,Math.sin(roverState.heading));
    const side=new THREE.Vector3(-dir.z,0,dir.x);
    const baseY=h(roverState.x,roverState.z);

    if(viewMode==="overview"){
      camDesired.set(6.8,9.8,9.2);camTarget.set(0,0,0);
    }else if(viewMode==="follow"){
      camDesired.set(roverState.x-dir.x*3.2+side.x*1.0,baseY+2.2,roverState.z-dir.z*3.2+side.z*1.0);
      camTarget.set(roverState.x+dir.x*.8,baseY+.45,roverState.z+dir.z*.8);
    }else if(viewMode==="rovercam"){
      camDesired.set(roverState.x+dir.x*.28,baseY+1.17,roverState.z+dir.z*.28);
      const a=roverState.heading-roverState.mastYaw;
      camTarget.set(roverState.x+Math.cos(a)*6,baseY+.95,roverState.z+Math.sin(a)*6);
    }else{
      const tipLocal=new THREE.Vector3(.12,0,0);wrist.localToWorld(tipLocal);
      camDesired.copy(tipLocal).add(new THREE.Vector3(0,.08,0));
      if(roverState.target)camTarget.set(roverState.target.x,h(roverState.target.x,roverState.target.z)+roverState.target.rad*.45,roverState.target.z);
      else camTarget.copy(tipLocal).add(dir);
    }

    const speed=viewMode==="overview"?2.4:(viewMode==="follow"?4.5:8.5);
    camera.position.lerp(camDesired,1-Math.exp(-dt*speed));
    const targetNow=new THREE.Vector3();camera.getWorldDirection(targetNow);targetNow.multiplyScalar(2).add(camera.position);
    targetNow.lerp(camTarget,1-Math.exp(-dt*speed));
    camera.lookAt(targetNow);
    const fov=viewMode==="rovercam"?58:(viewMode==="armcam"?54:48);
    camera.fov+=(fov-camera.fov)*(1-Math.exp(-dt*3));camera.updateProjectionMatrix();
  }

  function setLight(i){
    lightIndex=i;const p=lightPresets[i];scene.background.setHex(p.bg);scene.fog.color.setHex(p.fog);
    hemi.intensity=p.hemi;sun.intensity=p.sun;sun.color.setHex(p.color);lightLabel.textContent=p.name;
  }

  function cycleView(){
    if(!running)return;viewIndex=(viewIndex+1)%views.length;viewMode=views[viewIndex];
    const label={overview:"OVERVIEW",follow:"FOLLOW",rovercam:"ROVER CAM",armcam:"ARM CAM"}[viewMode];
    viewBadge.textContent=label;viewName.textContent=label;
  }

  function resetSite(){
    roverState.x=0;roverState.z=0;roverState.heading=Math.random()*Math.PI*2;roverState.speed=0;roverState.targetSpeed=0;roverState.battery=100;roverState.samples=0;
    roverState.target=null;roverState.goal=null;roverState.mastYaw=0;roverState.armProgress=0;roverState.distanceTravelled=0;roverState.yawRate=0;roverState.wheelAngleL=0;roverState.wheelAngleR=0;
    targets.forEach(t=>{t.visited=false;t.sampled=false});
    logs.length=0;logList.innerHTML="";transition("SURVEY",2.6);log("new site initialized");
  }

  function resize(){
    const rect=canvas.getBoundingClientRect(),w=Math.max(320,Math.round(rect.width||960)),hh=Math.round(w*600/960);
    renderer.setSize(w,hh,false);camera.aspect=w/hh;camera.updateProjectionMatrix();
  }
  window.addEventListener("resize",resize);resize();

  enterButton.addEventListener("click",()=>{running=true;intro.hidden=true;transition("SURVEY",2.5);log("autonomy enabled");});
  pauseButton.addEventListener("click",()=>{if(!running)return;paused=!paused;pauseButton.textContent=paused?"RESUME":"PAUSE";pauseButton.setAttribute("aria-pressed",paused?"true":"false")});
  viewButton.addEventListener("click",cycleView);
  lightButton.addEventListener("click",()=>setLight((lightIndex+1)%lightPresets.length));
  newSiteButton.addEventListener("click",()=>{if(!running)return;resetSite()});
  window.addEventListener("blur",()=>{if(running&&!paused){paused=true;pauseButton.textContent="RESUME";pauseButton.setAttribute("aria-pressed","true")}});

  setLight(0);updatePose(.016);updateLabels();transition("SURVEY",2.7);

  function animate(time){
    const dt=Math.min(.035,Math.max(0,(time-lastTime)/1000||.016));lastTime=time;
    if(running&&!paused){updateBehavior(dt);updatePose(dt);updateCamera(dt);updateLabels();}
    else{updatePose(dt*.2);updateCamera(dt*.25);}
    renderer.render(scene,camera);
  }
  renderer.setAnimationLoop(animate);
}

boot().catch(err=>{
  console.error(err);
  const e=document.getElementById("activityText");if(e)e.textContent="3D描画の初期化に失敗しました。";
});
})();