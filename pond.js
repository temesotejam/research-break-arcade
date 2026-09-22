(() => {
"use strict";

const THREE_URL="https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js";

async function boot(){
  const canvas=document.getElementById("pondCanvas");
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

  let THREE;
  try{
    THREE=await import(THREE_URL);
  }catch(err){
    const c=canvas.getContext("2d");
    c.fillStyle="#10231c";c.fillRect(0,0,canvas.width,canvas.height);
    c.fillStyle="#e9f1ea";c.font="700 22px system-ui";c.textAlign="center";
    c.fillText("3D renderer could not be loaded.",canvas.width/2,canvas.height/2-8);
    c.fillStyle="#9cad9f";c.font="14px system-ui";
    c.fillText("Network access is required once to load Three.js.",canvas.width/2,canvas.height/2+22);
    observationText.textContent="3Dライブラリを読み込めませんでした。";
    return;
  }

  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
  renderer.setSize(canvas.clientWidth||960,(canvas.clientWidth||960)*600/960,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.03;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;

  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x82978a);
  scene.fog=new THREE.FogExp2(0x426b66,0.045);

  const camera=new THREE.PerspectiveCamera(48,16/10,.05,45);
  const cameraTarget=new THREE.Vector3();
  const cameraDesired=new THREE.Vector3();

  const hemi=new THREE.HemisphereLight(0xdce8dd,0x24332b,1.65);
  scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff1cf,2.2);
  sun.position.set(-5,10,4);
  sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;
  scene.add(sun);

  const lightPresets=[
    {name:"SOFT AFTERNOON",bg:0x82978a,fog:0x426b66,hemi:1.65,sun:2.2,sunColor:0xfff1cf,water:[.18,.30,.34]},
    {name:"GOLDEN HOUR",bg:0x8e806c,fog:0x53665e,hemi:1.25,sun:2.65,sunColor:0xffc77b,water:[.22,.27,.27]},
    {name:"OVERCAST",bg:0x68756f,fog:0x4a5d59,hemi:1.25,sun:.72,sunColor:0xdde5e1,water:[.20,.27,.29]}
  ];

  const pond={rx:5.1,rz:3.55,bottom:-2.55};

  // Basin floor
  const floorGeo=new THREE.CircleGeometry(5.05,96);
  floorGeo.rotateX(-Math.PI/2);
  const floorMat=new THREE.MeshStandardMaterial({color:0x49584a,roughness:.96,metalness:0});
  const floor=new THREE.Mesh(floorGeo,floorMat);
  floor.scale.z=pond.rz/pond.rx;
  floor.position.y=pond.bottom;
  floor.receiveShadow=true;
  scene.add(floor);

  // Bank ring
  const bankGeo=new THREE.RingGeometry(5.05,6.25,128);
  bankGeo.rotateX(-Math.PI/2);
  const bankMat=new THREE.MeshStandardMaterial({color:0x485d40,roughness:1});
  const bank=new THREE.Mesh(bankGeo,bankMat);
  bank.scale.z=pond.rz/pond.rx;
  bank.position.y=.02;
  bank.receiveShadow=true;
  scene.add(bank);

  // Inner sloped wall
  const wallGeo=new THREE.CylinderGeometry(5.08,4.82,2.55,96,1,true);
  wallGeo.scale(1,1,pond.rz/pond.rx);
  const wallMat=new THREE.MeshStandardMaterial({color:0x425149,roughness:.94,side:THREE.DoubleSide});
  const wall=new THREE.Mesh(wallGeo,wallMat);
  wall.position.y=-1.28;
  wall.receiveShadow=true;
  scene.add(wall);

  // Static stones
  const rocks=[
    [-2.7,-2.30,1.05,.52,.76],[2.55,-2.31,1.42,.45,.72],[1.65,-2.32,-1.38,.38,.62],
    [-1.4,-2.33,-1.5,.31,.58],[.25,-2.34,1.55,.29,.50],[-.4,-2.35,.25,.20,.35]
  ];
  const rockMat=new THREE.MeshStandardMaterial({color:0x667067,roughness:1});
  for(let i=0;i<rocks.length;i++){
    const [x,y,z,sx,sz]=rocks[i];
    const g=new THREE.IcosahedronGeometry(1,2);
    const m=new THREE.Mesh(g,rockMat);
    m.position.set(x,y,z);
    m.scale.set(sx,sx*.55,sz);
    m.rotation.set(.15*(i%3),.7*i,.08*(i%2));
    m.castShadow=true;m.receiveShadow=true;
    scene.add(m);
  }

  // Static reeds - environment, not autonomous actors
  const reedMat=new THREE.MeshStandardMaterial({color:0x446640,roughness:.9});
  const reedGeo=new THREE.CylinderGeometry(.022,.035,.72,5);
  for(let i=0;i<46;i++){
    const a=i/46*Math.PI*2;
    const radial=1.02+(i%4)*.015;
    const reed=new THREE.Mesh(reedGeo,reedMat);
    reed.position.set(Math.cos(a)*pond.rx*radial,.36,Math.sin(a)*pond.rz*radial);
    reed.rotation.z=(i%5-2)*.025;
    scene.add(reed);
  }

  // Water shader with subtle surface waves and view-dependent highlights.
  const waterGeo=new THREE.CircleGeometry(5.02,128);
  const waterBase=waterGeo.attributes.position.array.slice();
  waterGeo.rotateX(-Math.PI/2);
  const waterMat=new THREE.MeshPhysicalMaterial({
    color:0x477d78,transparent:true,opacity:.36,roughness:.16,metalness:0,
    transmission:.08,thickness:.1,ior:1.333,side:THREE.DoubleSide,depthWrite:false
  });
  const water=new THREE.Mesh(waterGeo,waterMat);
  water.scale.z=pond.rz/pond.rx;
  water.position.y=.04;
  water.renderOrder=5;
  scene.add(water);

  // Caustic layer on bottom using thin translucent rings.
  const causticGroup=new THREE.Group();
  const causticMat=new THREE.MeshBasicMaterial({color:0xe9fff7,transparent:true,opacity:.055,side:THREE.DoubleSide,depthWrite:false});
  for(let i=0;i<18;i++){
    const ring=new THREE.Mesh(new THREE.RingGeometry(.18+.03*(i%3),.205+.03*(i%3),36),causticMat);
    ring.rotation.x=-Math.PI/2;
    const a=i*2.399963;
    const r=.5+((i*37)%100)/100*3.9;
    ring.position.set(Math.cos(a)*r,pond.bottom+.025,Math.sin(a)*r*.66);
    ring.scale.set(1.8,.8,1);
    causticGroup.add(ring);
  }
  scene.add(causticGroup);

  // ---------- Procedural koi mesh ----------
  const fishGroup=new THREE.Group();
  scene.add(fishGroup);

  const SECTION_COUNT=19,RING=12,LENGTH=1.55;
  const pos=new Float32Array(SECTION_COUNT*RING*3);
  const col=new Float32Array(SECTION_COUNT*RING*3);
  const indices=[];
  for(let i=0;i<SECTION_COUNT-1;i++){
    for(let j=0;j<RING;j++){
      const a=i*RING+j,b=i*RING+(j+1)%RING,c=(i+1)*RING+j,d=(i+1)*RING+(j+1)%RING;
      indices.push(a,c,b,b,c,d);
    }
  }
  const bodyGeo=new THREE.BufferGeometry();
  bodyGeo.setAttribute("position",new THREE.BufferAttribute(pos,3));
  bodyGeo.setAttribute("color",new THREE.BufferAttribute(col,3));
  bodyGeo.setIndex(indices);
  bodyGeo.computeVertexNormals();

  const bodyMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.50,metalness:0,side:THREE.DoubleSide});
  const bodyMesh=new THREE.Mesh(bodyGeo,bodyMat);
  bodyMesh.castShadow=true;
  fishGroup.add(bodyMesh);

  const tailGeo=new THREE.BufferGeometry();
  tailGeo.setAttribute("position",new THREE.BufferAttribute(new Float32Array(18),3));
  tailGeo.setIndex([0,1,2,3,4,5]);
  const tailMat=new THREE.MeshStandardMaterial({color:0xe6e0d6,roughness:.58,side:THREE.DoubleSide,transparent:true,opacity:.92});
  const tailMesh=new THREE.Mesh(tailGeo,tailMat);tailMesh.castShadow=true;fishGroup.add(tailMesh);

  function finGeometry(side){
    const arr=new Float32Array([
       .18,.00, side*.18,
      -.12,.01, side*.43,
      -.28,.00, side*.23
    ]);
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.BufferAttribute(arr,3));
    g.setIndex([0,1,2]);
    return g;
  }
  const finMat=new THREE.MeshStandardMaterial({color:0xd9d1c6,roughness:.62,side:THREE.DoubleSide,transparent:true,opacity:.72});
  const finL=new THREE.Mesh(finGeometry(1),finMat),finR=new THREE.Mesh(finGeometry(-1),finMat);
  finL.castShadow=finR.castShadow=true;fishGroup.add(finL,finR);

  const dorsalGeo=new THREE.BufferGeometry();
  dorsalGeo.setAttribute("position",new THREE.BufferAttribute(new Float32Array([
    .20,.12,0,-.18,.29,0,-.42,.11,0
  ]),3));
  dorsalGeo.setIndex([0,1,2]);
  const dorsal=new THREE.Mesh(dorsalGeo,finMat);fishGroup.add(dorsal);

  const headMat=new THREE.MeshStandardMaterial({color:0xd9d3c9,roughness:.48});
  const headMesh=new THREE.Mesh(new THREE.SphereGeometry(.19,24,16),headMat);
  headMesh.scale.set(1.28,.82,1.0);
  headMesh.position.set(.61,.005,0);
  headMesh.castShadow=true;
  fishGroup.add(headMesh);

  const eyeMat=new THREE.MeshStandardMaterial({color:0x101413,roughness:.30});
  const eyeGeo=new THREE.SphereGeometry(.031,14,10);
  const eyeL=new THREE.Mesh(eyeGeo,eyeMat),eyeR=new THREE.Mesh(eyeGeo,eyeMat);
  eyeL.position.set(.68,.075,.115);eyeR.position.set(.68,.075,-.115);
  fishGroup.add(eyeL,eyeR);

  const mouthMat=new THREE.MeshStandardMaterial({color:0x5b3b35,roughness:.6});
  const mouth=new THREE.Mesh(new THREE.TorusGeometry(.043,.008,8,24),mouthMat);
  mouth.rotation.y=Math.PI/2;
  mouth.position.set(.835,-.025,0);
  fishGroup.add(mouth);

  const fish={
    x:-1.35,z:.25,heading:.08,
    speed:.54,targetSpeed:.54,
    depth:.46,targetDepth:.46,
    verticalVelocity:0,turnRate:0,
    phase:0,state:"cruise",stateTimer:7,
    orbitSign:1,bodyWave:0
  };

  let running=false,paused=false,lastTime=performance.now();
  const views=["pond","follow","pov"];
  let viewIndex=0,viewMode="pond",lightIndex=0;
  let attract=null,attractTimer=0,rippleTimer=0;

  function wrap(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function normEdge(x,z){return Math.sqrt((x/pond.rx)**2+(z/pond.rz)**2)}
  function fishY(){return -.28-fish.depth*1.88}

  function setBehavior(){
    const r=Math.random();
    if(r<.18){fish.state="coast";fish.targetSpeed=.16+Math.random()*.08;fish.stateTimer=4+Math.random()*4;observationText.textContent="尾びれをほとんど止め、惰性だけで流れています。";}
    else if(r<.34){fish.state="surface";fish.targetDepth=.10+Math.random()*.08;fish.targetSpeed=.34+Math.random()*.12;fish.stateTimer=5+Math.random()*4;observationText.textContent="胸びれで姿勢を整えながら、水面へ上がっています。";}
    else if(r<.48){fish.state="deep";fish.targetDepth=.76+Math.random()*.12;fish.targetSpeed=.38+Math.random()*.14;fish.stateTimer=6+Math.random()*5;observationText.textContent="ゆっくり深場へ降りています。";}
    else{fish.state="cruise";fish.targetDepth=.32+Math.random()*.34;fish.targetSpeed=.42+Math.random()*.22;fish.stateTimer=7+Math.random()*8;observationText.textContent="一定のリズムで池を巡っています。";}
    if(Math.random()<.28)fish.orbitSign*=-1;
  }

  function obstacleSteering(){
    const look=1.2+fish.speed*1.2;
    const fx=fish.x+Math.cos(fish.heading)*look;
    const fz=fish.z+Math.sin(fish.heading)*look;
    let steer=0;
    for(const [rx,,rz,sx,sz] of rocks){
      const rad=Math.max(sx,sz)+.44;
      const dx=fx-rx,dz=fz-rz,d=Math.hypot(dx,dz);
      if(d<rad){
        const away=Math.atan2(fz-rz,fx-rx);
        let diff=wrap(away-fish.heading);
        if(Math.abs(diff)<.18)diff=fish.orbitSign*.55;
        steer+=clamp(diff,-1,1)*(1-d/rad)*1.8;
      }
    }
    return steer;
  }

  function updateFish(dt,time){
    fish.stateTimer-=dt;
    if(fish.stateTimer<=0)setBehavior();
    attractTimer=Math.max(0,attractTimer-dt);

    const edge=normEdge(fish.x,fish.z);
    const centerHeading=Math.atan2(-fish.z,-fish.x);
    const tangent=centerHeading+fish.orbitSign*Math.PI/2;
    const inward=clamp((edge-.56)/.32,0,1);
    let desired=wrap(tangent+wrap(centerHeading-tangent)*inward);

    desired+=Math.sin(time*.00022+fish.orbitSign)*.12;

    if(attractTimer>0&&attract){
      desired=Math.atan2(attract.z-fish.z,attract.x-fish.x);
      fish.targetSpeed=.72;
      fish.targetDepth=.18;
      fish.state="investigate";
    }

    desired=wrap(desired+obstacleSteering());

    if(edge>.84){
      const strength=clamp((edge-.84)/.12,0,1);
      desired=wrap(desired+wrap(centerHeading-desired)*strength);
      fish.targetSpeed=Math.min(fish.targetSpeed,.44);
    }

    const err=wrap(desired-fish.heading);
    const maxTurn=.72+.38*(1-clamp(fish.speed/.75,0,1));
    const targetTurn=clamp(err*1.15,-maxTurn,maxTurn);
    fish.turnRate+=(targetTurn-fish.turnRate)*Math.min(1,dt*(1.4+fish.speed*1.2));
    fish.heading=wrap(fish.heading+fish.turnRate*dt);

    // Acceleration is deliberately asymmetric: acceleration is slower than deceleration.
    const accelRate=fish.targetSpeed>fish.speed?.52:.92;
    fish.speed+=(fish.targetSpeed-fish.speed)*Math.min(1,dt*accelRate);
    fish.speed=clamp(fish.speed,.08,.82);

    const depthError=fish.targetDepth-fish.depth;
    fish.verticalVelocity+=depthError*dt*.42;
    fish.verticalVelocity*=Math.pow(.22,dt);
    fish.depth=clamp(fish.depth+fish.verticalVelocity*dt,0.06,.94);

    const surge=.986+.014*Math.sin(fish.phase);
    fish.x+=Math.cos(fish.heading)*fish.speed*surge*dt;
    fish.z+=Math.sin(fish.heading)*fish.speed*surge*dt;

    if(normEdge(fish.x,fish.z)>.965){
      fish.heading=centerHeading;
      fish.x+=Math.cos(centerHeading)*.05;
      fish.z+=Math.sin(centerHeading)*.05;
    }

    const tailHz=.65+fish.speed*1.75;
    fish.phase+=dt*tailHz*Math.PI*2;
    fish.bodyWave=(.025+fish.speed*.105);

    if(attractTimer>0&&attract&&Math.hypot(fish.x-attract.x,fish.z-attract.z)<.38){
      attractTimer=0;attract=null;
      fish.state="coast";fish.targetSpeed=.13;fish.stateTimer=3;
      observationText.textContent="刺激のあった場所で減速し、周囲を確かめています。";
    }

    fishGroup.position.set(fish.x,fishY(),fish.z);
    fishGroup.rotation.y=-fish.heading;
    updateKoiMesh(time);
  }

  function radiusProfile(u){
    const core=Math.sin(Math.PI*Math.pow(u,.88));
    const nose=.11*(1-u);
    const tail=.035+.025*(1-u);
    return tail+core*.185+nose;
  }

  function updateKoiMesh(time){
    const p=bodyGeo.attributes.position.array;
    const colors=bodyGeo.attributes.color.array;
    const amp=fish.bodyWave;
    const turnBias=fish.turnRate*.095;
    for(let i=0;i<SECTION_COUNT;i++){
      const u=i/(SECTION_COUNT-1);
      const x=LENGTH*.5-u*LENGTH;
      const wave=Math.sin(fish.phase-u*5.0)*amp*Math.pow(u,1.55);
      const curvature=-turnBias*Math.pow(u,1.65);
      const centerZ=wave+curvature;
      const rad=radiusProfile(u);
      const vertical=rad*(.73-.15*u);
      for(let j=0;j<RING;j++){
        const th=j/RING*Math.PI*2;
        const k=(i*RING+j)*3;
        p[k]=x;
        p[k+1]=Math.sin(th)*vertical;
        p[k+2]=centerZ+Math.cos(th)*rad;

        const patchA=Math.sin(u*13.2+Math.cos(th)*2.8)+.55*Math.sin(u*5.2-th*1.7);
        const patchB=Math.sin(u*18.8-th*2.3+1.2)+Math.cos(u*6.7+th);
        let c;
        if(patchB>1.47&&u<.62)c=[.10,.12,.11];
        else if(patchA>.82)c=[.73,.25,.16];
        else c=[.86,.83,.78];
        colors[k]=c[0];colors[k+1]=c[1];colors[k+2]=c[2];
      }
    }
    bodyGeo.attributes.position.needsUpdate=true;
    bodyGeo.attributes.color.needsUpdate=true;
    bodyGeo.computeVertexNormals();

    const u=1;
    const tailCenter=Math.sin(fish.phase-u*5.0)*amp+(-turnBias);
    const tailSwing=Math.sin(fish.phase-.45)*(.18+fish.speed*.10);
    const tp=tailGeo.attributes.position.array;
    const vals=[
      -.68,.00,tailCenter+.035,
      -.93,.02,tailCenter+.28+tailSwing,
      -.98,.00,tailCenter,
      -.68,.00,tailCenter-.035,
      -.93,.02,tailCenter-.28+tailSwing,
      -.98,.00,tailCenter
    ];
    for(let i=0;i<18;i++)tp[i]=vals[i];
    tailGeo.attributes.position.needsUpdate=true;
    tailGeo.computeVertexNormals();

    const finBeat=.035*Math.sin(fish.phase*.52);
    finL.rotation.x=.12+finBeat+fish.turnRate*.16;
    finR.rotation.x=-.12-finBeat+fish.turnRate*.16;
    dorsal.rotation.z=-fish.turnRate*.08;
  }

  function updateWater(time){
    const a=water.geometry.attributes.position;
    const arr=a.array;
    for(let i=0;i<arr.length;i+=3){
      const ox=waterBase[i],oy=waterBase[i+1];
      arr[i+1]=Math.sin(ox*1.7+time*.0012)*.018+Math.sin(oy*2.15-time*.0008)*.013;
    }
    a.needsUpdate=true;
    water.geometry.computeVertexNormals();
    causticGroup.rotation.y=Math.sin(time*.00018)*.12;
    for(let i=0;i<causticGroup.children.length;i++){
      const c=causticGroup.children[i];
      const s=1+.16*Math.sin(time*.001+i*.7);
      c.scale.x=1.7*s;c.scale.y=.75/s;
    }
  }

  function updateCamera(dt){
    const fy=fishY();
    const dir=new THREE.Vector3(Math.cos(fish.heading),0,Math.sin(fish.heading));
    const side=new THREE.Vector3(-dir.z,0,dir.x);

    if(viewMode==="pond"){
      cameraDesired.set(0,7.8,7.7);
      cameraTarget.set(0,-.55,0);
    }else if(viewMode==="follow"){
      cameraDesired.set(fish.x-dir.x*2.35+side.x*.55,fy+1.35,fish.z-dir.z*2.35+side.z*.55);
      cameraTarget.set(fish.x+dir.x*.55,fy+.05,fish.z+dir.z*.55);
    }else{
      cameraDesired.set(fish.x+dir.x*.88,fy+.075,fish.z+dir.z*.88);
      cameraTarget.set(fish.x+dir.x*4.8,fy+fish.verticalVelocity*.65,fish.z+dir.z*4.8);
    }

    const follow=viewMode==="pov"?7.5:3.6;
    camera.position.lerp(cameraDesired,1-Math.exp(-dt*follow));
    camera.lookAt(cameraTarget);

    const desiredFov=viewMode==="pov"?64:(viewMode==="follow"?48:46);
    camera.fov+=(desiredFov-camera.fov)*(1-Math.exp(-dt*3));
    camera.updateProjectionMatrix();

    if(viewMode==="pov"){
      scene.fog.density=.085+.025*fish.depth;
      waterMat.opacity=.17;
    }else{
      scene.fog.density=.045;
      waterMat.opacity=.34;
    }
  }

  function setLight(index){
    lightIndex=index;
    const p=lightPresets[index];
    scene.background.setHex(p.bg);
    scene.fog.color.setHex(p.fog);
    hemi.intensity=p.hemi;
    sun.intensity=p.sun;
    sun.color.setHex(p.sunColor);
    waterMat.color.setRGB(p.water[0],p.water[1],p.water[2]);
    lightLabel.textContent=p.name;
  }

  function updateLabels(){
    stateText.textContent=
      fish.state==="coast"?"尾びれを休めています。":
      fish.state==="surface"?"水面へ上がっています。":
      fish.state==="deep"?"深場へ降りています。":
      fish.state==="investigate"?"水面の刺激へ近づいています。":
      "ゆっくり泳いでいます。";
    depthText.textContent="DEPTH "+Math.round(.12+fish.depth*1.72)+" m";
    speedText.textContent="SPEED "+fish.speed.toFixed(2)+" m/s";
    headingText.textContent="Heading "+Math.round((fish.heading*180/Math.PI+360)%360)+"°";
  }

  function cycleView(){
    if(!running)return;
    viewIndex=(viewIndex+1)%views.length;viewMode=views[viewIndex];
    const label={pond:"POND VIEW",follow:"FOLLOW",pov:"KOI POV"}[viewMode];
    viewBadge.textContent=label;viewName.textContent=label.replace(" VIEW","");
  }

  function attractKoi(){
    if(!running||paused)return;
    const a=Math.atan2(fish.z,fish.x)+Math.PI+(Math.random()-.5)*1.0;
    const rr=1.0+Math.random()*.85;
    attract={x:Math.cos(a)*rr,z:Math.sin(a)*rr*.7};
    attractTimer=8;
    rippleTimer=1.5;
    observationText.textContent="水面の振動へ向きを変えました。";
  }

  function updateRipple(dt){
    rippleTimer=Math.max(0,rippleTimer-dt);
    if(!rippleMesh)return;
    rippleMesh.visible=rippleTimer>0;
    if(rippleTimer>0&&attract){
      rippleMesh.position.set(attract.x,.065,attract.z);
      const t=1-rippleTimer/1.5;
      const s=.35+t*1.7;
      rippleMesh.scale.set(s,s,s);
      rippleMat.opacity=(1-t)*.35;
    }
  }

  const rippleMat=new THREE.MeshBasicMaterial({color:0xe7fff8,transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false});
  const rippleMesh=new THREE.Mesh(new THREE.RingGeometry(.18,.205,48),rippleMat);
  rippleMesh.rotation.x=-Math.PI/2;rippleMesh.visible=false;scene.add(rippleMesh);

  function resize(){
    const rect=canvas.getBoundingClientRect();
    const w=Math.max(320,Math.round(rect.width||960));
    const h=Math.round(w*600/960);
    renderer.setSize(w,h,false);
    camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  window.addEventListener("resize",resize);
  resize();

  enterButton.addEventListener("click",()=>{running=true;intro.hidden=true;observationText.textContent="体のしなりと尾びれの遅れを眺めてみてください。";});
  pauseButton.addEventListener("click",()=>{if(!running)return;paused=!paused;pauseButton.textContent=paused?"RESUME":"PAUSE";pauseButton.setAttribute("aria-pressed",paused?"true":"false")});
  viewButton.addEventListener("click",cycleView);
  attractButton.addEventListener("click",attractKoi);
  lightButton.addEventListener("click",()=>setLight((lightIndex+1)%lightPresets.length));

  canvas.addEventListener("pointerdown",e=>{
    if(!running||paused||viewMode==="pov")return;
    const rect=canvas.getBoundingClientRect();
    const ndc=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
    const ray=new THREE.Raycaster();
    ray.setFromCamera(ndc,camera);
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    const point=new THREE.Vector3();
    if(ray.ray.intersectPlane(plane,point)){
      const edge=Math.sqrt((point.x/pond.rx)**2+(point.z/pond.rz)**2);
      if(edge<.93){
        attract={x:point.x,z:point.z};attractTimer=8;rippleTimer=1.5;
        observationText.textContent="水面の小さな刺激に反応しました。";
      }
    }
  });

  setLight(0);
  updateKoiMesh(0);
  updateCamera(.016);
  updateLabels();

  function animate(time){
    const dt=Math.min(.035,Math.max(0,(time-lastTime)/1000||.016));
    lastTime=time;
    if(running&&!paused){
      updateFish(dt,time);
      updateWater(time);
      updateRipple(dt);
      updateCamera(dt);
      updateLabels();
    }else{
      updateWater(time);
      updateCamera(dt*.3);
    }
    renderer.render(scene,camera);
  }
  renderer.setAnimationLoop(animate);
}

boot().catch(err=>{
  console.error(err);
  const o=document.getElementById("observationText");
  if(o)o.textContent="3D描画の初期化に失敗しました。";
});
})();