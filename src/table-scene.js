import * as THREE from 'three';
import {WALL_SIDES,SEAT_SIDE} from './wall.js';
let renderer, scene, camera, tiles, host, frame, marker;
let flight=null,lastKey=null,eventStart=-Infinity;
let wallPieces=[],openingKey=null,openingStart=-Infinity,currentWallState=null;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const mats=new Map();
const box=new THREE.BoxGeometry(.59,.22,.82);
const wallBack=new THREE.BoxGeometry(.57,.035,.80);
const face=new THREE.PlaneGeometry(.56,.80);
const standing=new THREE.BoxGeometry(.58,.8,.26),back=new THREE.BoxGeometry(.52,.70,.025);
const ivory=new THREE.MeshStandardMaterial({color:0xf8f5e9,roughness:.8});
const jade=new THREE.MeshStandardMaterial({color:0x079824,roughness:.34,metalness:.05});
const loader=new THREE.TextureLoader();
function cloth(){
 const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
 x.fillStyle='#3568a0';x.fillRect(0,0,256,256);
 for(let i=0;i<256;i++){x.strokeStyle=i%2?'#ffffff0f':'#001b2114';x.beginPath();x.moveTo(i,0);x.lineTo(i,256);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(256,i);x.stroke();}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(10,7);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function mesh(geo,material,x,y,z,parent=scene){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function init(){
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor(0x202b49);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.domElement.setAttribute('aria-label','三维麻将牌桌');
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(39,16/9,.1,100);camera.position.set(0,17,13);camera.lookAt(0,0,0);
 scene.add(new THREE.HemisphereLight(0xfff6de,0x345063,2.4));
 const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-7,16,5);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-15,right:15,top:12,bottom:-12});light.shadow.bias=-.0004;scene.add(light);
 const leather=cloth();leather.repeat.set(45,50);
 const rim=new THREE.MeshStandardMaterial({color:0x252535,map:leather,roughness:.95});
 mesh(new THREE.BoxGeometry(24,.65,29),rim,0,-.6,-5);
 mesh(new THREE.BoxGeometry(22.5,.14,28),new THREE.MeshStandardMaterial({map:cloth(),roughness:1}),0,-.19,-5);
 const seams=new THREE.MeshStandardMaterial({color:0x356094,roughness:1});
 for(const x of [-7.3,7.3]){
  for(const edge of [-.3,.3])mesh(new THREE.BoxGeometry(.027,.007,9.6),seams,x+edge,-.11,-.3);
  for(const z of [-5.1,4.5])mesh(new THREE.BoxGeometry(.6,.007,.027),seams,x,-.11,z);
 }
 for(const z of [-6.4,5.3]){for(const edge of [-.22,.22])mesh(new THREE.BoxGeometry(12,.007,.026),seams,0,-.11,z+edge);}
 tiles=new THREE.Group();scene.add(tiles);
 marker=mesh(new THREE.ConeGeometry(.18,.38,4),new THREE.MeshStandardMaterial({color:0xffcd57,emissive:0xb9670d,emissiveIntensity:.35}),0,1,0);marker.visible=false;
 marker.rotation.z=Math.PI;
 const animate=time=>{frame=requestAnimationFrame(animate);if(!host?.isConnected)return;
  if(currentWallState){const elapsed=time-openingStart;let front=currentWallState.front;
   if(elapsed<2000&&currentWallState.front===40&&currentWallState.back===0){front=0;for(let i=0;i<13;i++)if(elapsed>=600+i*100)front+=i<9?4:1;}
   for(const piece of wallPieces){piece.visible=piece.userData.order>=front&&piece.userData.order<84-currentWallState.back;piece.position.y=elapsed<500?Math.max(0,1-elapsed/500)*.8:0;}
  }
  if(flight){const u=Math.min(1,(time-eventStart)/520),e=1-Math.pow(1-u,3);flight.group.position.lerpVectors(flight.from,flight.to,e);flight.group.position.y+=Math.sin(Math.PI*u)*1.35;flight.group.rotation.x=(1-e)*-.75;flight.group.scale.setScalar(1+(1-e)*.55);renderer.domElement.dataset.flight=u<1?'moving':'landed';if(u===1)flight=null;}
  if(marker.visible){marker.position.y=.86+(reduced()?0:Math.sin(time*.006)*.07);marker.rotation.y=reduced()?0:time*.001;}
  renderer.render(scene,camera);
 };frame=requestAnimationFrame(animate);
}
function tile(t,x,z,rotation=0,hidden=false){
 const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=rotation;tiles.add(group);
 if(hidden){mesh(standing,ivory,0,.30,0,group);mesh(back,jade,0,.30,.143,group);}
 else{
  mesh(box,jade,0,.02,0,group);mesh(box,ivory,0,.16,0,group);
  if(t==='?')return group;
  if(!mats.has(t)){const map=loader.load('assets/'+t+'.svg');map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=renderer.capabilities.getMaxAnisotropy();mats.set(t,new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false}));}
  const plane=mesh(face,mats.get(t),0,.281,0,group);plane.rotation.x=-Math.PI/2;
 }
 return group;
}
export function mountScene(element,g,view,showAll){
 host=element;
 try{if(!renderer)init();}catch(e){element.classList.add('scene-fallback');element.textContent='当前设备未能启用三维牌桌，手牌与操作仍可使用。';return;}
 element.append(renderer.domElement);
 tiles.clear();marker.visible=false;flight=null;
 wallPieces=[];currentWallState=g.wallState||null;
 if(g.opening&&g.wallState){
  const key=JSON.stringify([g.round,g.opening.dice,g.opening.startStack,g.seats]);
  if(key!==openingKey){openingKey=key;openingStart=g.wall.length===44?performance.now():-Infinity;}
  let stack=0;
  for(let side=0;side<4;side++)for(let i=0;i<WALL_SIDES[side];i++,stack++){
   const relative=(side-SEAT_SIDE[view]+4)%4,offset=(i-(WALL_SIDES[side]-1)/2)*.65;
   const x=relative===0?offset:relative===1?6.4:relative===2?-offset:-6.4;
   const z=relative===0?4.9:relative===1?-offset:relative===2?-5.5:offset;
   for(let layer=0;layer<2;layer++){
    const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=relative%2?Math.PI/2:0;tiles.add(group);
    mesh(box,ivory,0,.12+layer*.25,0,group);mesh(wallBack,jade,0,.24+layer*.25,0,group);
    group.userData.order=(stack*2+(1-layer)-g.opening.startStack*2+84)%84;
    // Preserve horizontal placement when animating the initial wall rise.
    wallPieces.push(group);
   }
  }
  element.dataset.wallRemaining=String(g.wall.length);
 }
 const last=g.lastDiscard,key=last?`${g.round}:${last.serial}:${last.seat}:${last.tile}`:null;
 const fresh=lastKey!==null&&key!==lastKey;
 if(fresh)eventStart=performance.now();
 lastKey=key||'empty';renderer.domElement.dataset.marker='none';renderer.domElement.dataset.flight='landed';
 const left=(view+2)%3,right=(view+1)%3;
 for(const [seat,x,rot]of [[left,-8.4,Math.PI/2],[right,8.4,-Math.PI/2]]){
  const p=g.players[seat];p.hand.forEach((t,i)=>tile(t,x,-4+i*.64,rot,!(p.liang||showAll)));
  p.melds.forEach((m,j)=>{for(let k=0;k<(m.kind==='peng'?3:4);k++)tile(m.tile,x+(x<0?1:-1),-4+j*1.8+k*.45,rot);});
 }
 for(const [seat,side]of [[view,0],[left,-1],[right,1]]){
  const p=g.players[seat];p.river.forEach((t,i)=>{
   const col=i%6,row=Math.floor(i/6);let x,z,rot;
   if(side===0){x=(col-2.5)*.78;z=1.3+row*.99;rot=0;}
   else{x=side*(3.1+row*.99);z=-2.8+col*.78;rot=side===-1?Math.PI/2:-Math.PI/2;}
   const group=tile(t,x,z,rot);
   group.scale.setScalar(1.18);
   const latest=last?last.seat===seat&&last.index===i&&last.tile===t:g.phase==='react'&&g.pending.source===seat&&i===p.river.length-1;
   if(latest){marker.visible=true;marker.position.set(x,.9,z);renderer.domElement.dataset.marker=`${seat}:${i}:${t}`;
    if(!reduced()&&(fresh||performance.now()-eventStart<520)){flight={group,to:new THREE.Vector3(x,0,z),from:new THREE.Vector3(side?side*8.4:((last?.handIndex??6)-6)*.6,.5,side?-.8:6)};group.position.copy(flight.from);renderer.domElement.dataset.flight='moving';}
   }
  });
 }
 resizeScene();
}
export function resizeScene(){if(!renderer||!host?.isConnected)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
 // Account for the arena's CSS scale, including portrait rotation, before rasterizing.
 const arena=host.closest('.arena'),matrix=new DOMMatrix(getComputedStyle(arena||host).transform),scale=Math.hypot(matrix.a,matrix.b)||1;
 const ratio=Math.min(3,Math.max(1,devicePixelRatio*scale),Math.sqrt(12000000/(w*h)));
 renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);renderer.domElement.style.width='100%';renderer.domElement.style.height='100%';renderer.setViewport(0,0,w,h);renderer.setScissorTest(false);camera.aspect=w/h;camera.position.y=camera.aspect<1.7?19:17;camera.updateProjectionMatrix();renderer.render(scene,camera);}
