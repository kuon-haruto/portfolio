import {T,assets,createRig,lightScene} from './live-ame-model.js';
const output=document.querySelector('canvas'),ctx=output.getContext('2d'),panels=[];
for (const url of [new URL('./live-ame-source.json',import.meta.url),new URL('ame.json',assets)]) {
  const data=await (await fetch(url)).json(),scene=new T.Scene();scene.background=new T.Color(0xedf1f4);lightScene(scene);
  const rig=await createRig(data);scene.add(rig.root);
  const camera=new T.OrthographicCamera(-1.04,1.04,1.16,-1.16,.01,30);camera.position.set(0,1.08,7);camera.lookAt(0,1.08,0);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(480,536);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;
  panels.push({rig,scene,camera,renderer});
}
function draw(t){
  ctx.fillStyle='#edf1f4';ctx.fillRect(0,0,960,640);
  for(const [i,p]of panels.entries()){
    p.rig.root.rotation.y=Math.sin(t*.8)*.28;
    p.rig.pose(t,{offer:T.MathUtils.smoothstep(t,1,2.5)});p.renderer.render(p.scene,p.camera);
    ctx.drawImage(p.renderer.domElement,i*480,64);
  }
  ctx.textAlign='center';ctx.fillStyle='#172733';ctx.font='bold 20px sans-serif';
  ctx.fillText('SOURCE UNITY MESHES',240,34);ctx.fillText('WEB EXTRACTED MESHES',720,34);
  ctx.font='14px sans-serif';ctx.fillText('Same camera, pose, textures, lights and Three.js material',480,610);
  ctx.fillText('Geometry comparison only - NOT the original Unity / lilToon rendering',480,633);
  ctx.strokeStyle='#bac7ce';ctx.beginPath();ctx.moveTo(480,48);ctx.lineTo(480,590);ctx.stroke();
}
draw(0);window.comparisonReady=true;
window.recordComparison=()=>new Promise(resolve=>{
  const stream=output.captureStream(30),chunks=[];
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:4000000});
  recorder.ondataavailable=e=>chunks.push(e.data);
  recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));};
  recorder.start();const start=performance.now();
  function tick(now){const t=(now-start)/1000;draw(Math.min(t,6));if(t<6.4)requestAnimationFrame(tick);else recorder.stop();}
  requestAnimationFrame(tick);
});
