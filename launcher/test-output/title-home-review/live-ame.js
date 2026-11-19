import {T, assets, createRig, lightScene} from './live-ame-model.js';

// Synchronous teardown remains available while textures are still loading.
export function mount(stage) {
  const host=document.createElement('div'); host.className='live-ame';
  host.innerHTML=`<style>
    .live-ame{position:relative;width:min(100%,300px);height:100%;margin:auto;isolation:isolate;overflow:hidden;pointer-events:none}
    .live-ame canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
    .live-ame .ame-speech{position:absolute;top:3px;left:4px;right:4px;margin:0;text-align:center;font:600 14px/1.45 "Yu Gothic",sans-serif;color:inherit;pointer-events:none}
    .live-ame .ame-hit{position:absolute;display:block;padding:0;border:0;background:transparent;box-shadow:none;pointer-events:auto;cursor:pointer;min-width:0;min-height:0;border-radius:0}
    .live-ame .ame-hit[hidden]{display:none}
    .live-ame .ame-hit:focus-visible{outline:3px solid #ffd255;outline-offset:3px}
    .live-ame .ame-hit:hover{background:transparent}
    @media(max-width:700px){.live-ame{width:min(100%,180px)}.live-ame .ame-speech{font-size:12px;line-height:1.4}}
  </style><p class="ame-speech" role="status">氷ノあめ</p><button class="ame-hit ame-character" aria-label="あめに手を振る" title="あめに手を振る" hidden></button><a class="ame-hit ame-icon" href="#parking" aria-label="すべる宇宙駐車場の作品を見る" title="すべる宇宙駐車場の作品を見る" hidden></a>`;
  stage.append(host);
  const speech=host.querySelector('.ame-speech'), character=host.querySelector('.ame-character'), link=host.querySelector('.ame-icon');
  const abort=new AbortController(), media=matchMedia('(prefers-reduced-motion: reduce)'), resources=new Set();
  let disposed=false, renderer, rig, icon, frame=0, elapsed=0, last=0, waveTime=-1, dirty=true, width=1,height=1;
  let state='loading', reduced=media.matches;
  const scene=new T.Scene();lightScene(scene);
  const camera=new T.OrthographicCamera(-1,1,1.3,-1.3,.01,30);
  camera.position.set(0,1.12,7);camera.lookAt(0,1.12,0);
  const own=v=>(resources.add(v),v);
  function resize(){
    width=host.clientWidth;height=host.clientHeight;
    if(!width||!height)return;
    renderer?.setSize(width,height,false);
    camera.left=-1.3*width/height;camera.right=1.3*width/height;camera.updateProjectionMatrix();dirty=true;
  }
  const observer=new ResizeObserver(resize);observer.observe(host);
  function greet(){if(state==='loading'||state==='leaving'||state==='gone')return;waveTime=0;dirty=true;}
  character.addEventListener('click',greet,{signal:abort.signal});
  media.addEventListener('change',()=>{reduced=media.matches;elapsed=reduced?5:0;waveTime=-1;dirty=true;},{signal:abort.signal});
  function screen(v){const p=v.clone().project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};}
  function rect(el,cx,cy,w,h){el.style.left=`${cx-w/2}px`;el.style.top=`${cy-h/2}px`;el.style.width=`${w}px`;el.style.height=`${h}px`;}
  const smooth=v=>T.MathUtils.smoothstep(v,0,1);
  function draw(now){
    if(disposed)return;
    frame=requestAnimationFrame(draw);
    const dt=Math.min((now-last)/1000||0,.05);last=now;
    if(document.hidden||!width||!height)return;
    if(reduced&&!dirty)return;
    if(waveTime>=0){waveTime+=dt;if(waveTime>=1.7)waveTime=-1;}else if(!reduced)elapsed+=dt;
    const t=reduced?5:elapsed%23, travel=t<2.4?1-smooth(t/2.4):t>13?smooth((t-13)/2.8):0;
    state=t<2.4?'walking-in':t<3.4?'gaze':t<4.5?'presenting':t<11.5?'holding':t<13?'reclaiming':t<15.8?'leaving':'gone';
    const offer=smooth((t-3.4)/1.1)*(1-smooth((t-11.5)/1.5));
    const waving=waveTime>=0&&!reduced?Math.sin(waveTime/1.7*Math.PI):0;
    const walking=t<2.4?Math.sin(Math.PI*Math.min(t/2.4,1)) : t>13&&t<15.8?Math.sin(Math.PI*(t-13)/2.8):0;
    rig.root.position.set(travel*2,0,0);
    rig.root.rotation.y=t<2.4?-Math.PI/2*(1-smooth((t-1.8)/.6)):t>13?Math.PI/2*smooth((t-13)/.5):0;
    const attention=reduced?0:offer*(.45*Math.sin(t*1.3)+.22*Math.sin(t*2.4));
    rig.pose(reduced?0:now/1000,{walk:walking,offer,wave:waving,gaze:state==='gaze'?Math.sin((t-2.4)*Math.PI):attention});
    // Attach the icon to the actual left wrist. The right wrist supports its other edge.
    const hand=rig.bones.get('J_Bip_L_Hand');
    const point=hand.getWorldPosition(new T.Vector3()).add(new T.Vector3(.215,.07,.035));
    icon.position.copy(point);icon.quaternion.copy(camera.quaternion);icon.visible=offer>.02;
    icon.scale.setScalar(.72+.28*offer);
    renderer.render(scene,camera);
    const projected=screen(point), size=.4*height/2.6*icon.scale.x;
    const target=state==='holding'?screen(new T.Vector3(0,1.23,0)):projected;
    rect(link,target.x,target.y,Math.max(44,size+18),Math.max(44,size+22));
    const body=screen(new T.Vector3(rig.root.position.x,1.05,0));
    rect(character,body.x,body.y,.76*height/2.6,1.95*height/2.6);
    character.hidden=t>=15.8;link.hidden=offer<.85||state==='reclaiming'||state==='leaving'||state==='gone';
    const text=waveTime>=0?'こんにちは！':state==='holding'||state==='presenting'?'「すべる宇宙駐車場」、見てみる？':state==='gaze'?'おすすめの作品があるよ。':'';
    if(speech.textContent!==text)speech.textContent=text;
    stage.dataset.ameState=waveTime>=0?'wave':state;
    stage.dataset.ameReady='true';dirty=waveTime>=0;
  }
  async function init(){
    try{
      renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:true});
      renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;
      renderer.domElement.setAttribute('aria-hidden','true');host.prepend(renderer.domElement);resize();
      renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(frame);speech.textContent='あめを表示できませんでした。';character.hidden=link.hidden=true;},{signal:abort.signal});
      const compressed=typeof DecompressionStream==='function';
      const response=await fetch(compressed?new URL('./ame.json.gz',import.meta.url):new URL('ame.json',assets),{signal:abort.signal});
      if(!response.ok)throw Error(`Ame model: ${response.status}`);
      const json=compressed?new Response(response.body.pipeThrough(new DecompressionStream('gzip'))):response;
      rig=await createRig(await json.json(),resources);
      if(disposed)return;
      scene.add(rig.root);
      const map=own(await new T.TextureLoader().loadAsync(new URL('../../../files/game-icons/sliding-space-parking.png',import.meta.url).href));
      if(disposed)return;
      map.colorSpace=T.SRGBColorSpace;
      icon=new T.Mesh(own(new T.PlaneGeometry(.4,.4)),own(new T.MeshBasicMaterial({map,transparent:true,side:T.DoubleSide})));
      scene.add(icon);last=performance.now();frame=requestAnimationFrame(draw);
    }catch(error){if(!disposed){stage.dataset.ameState='error';speech.textContent='あめを表示できませんでした。';console.error('[live-ame]',error);}}
    finally{if(disposed)release();}
  }
  function release(){for(const r of resources)r.dispose();resources.clear();}
  init();
  return ()=>{
    if(disposed)return;disposed=true;abort.abort();observer.disconnect();cancelAnimationFrame(frame);
    release();renderer?.dispose();host.remove();delete stage.dataset.ameReady;delete stage.dataset.ameState;
  };
}
