import {poseAt,sceneAt,backgroundAt,prologueAt,walkingFrame,CYCLE,PROLOGUE} from './motion.js';
import {portraitRenderer} from './portrait.js';
const css=`.puppet-root{position:absolute;inset:0;pointer-events:none;overflow:hidden;isolation:isolate}.puppet-root svg{width:100%;height:100%;display:block}.puppet-root .puppet-hit{position:absolute;top:8%;height:78%;width:22%;padding:0;background:none;border:0;border-radius:0;pointer-events:auto;cursor:pointer}.puppet-hit:focus-visible{outline:2px solid #f4d38b;outline-offset:-5px}.puppet-root a{pointer-events:auto;position:absolute;left:50%;transform:translateX(-50%);text-decoration:none}.puppet-icon{top:35%;width:116px;height:116px;background:#152841;border:2px solid #a5e9eb;border-radius:8px;box-shadow:0 6px 28px #35cbd12e}.puppet-icon img{width:100%;height:100%;object-fit:contain;border-radius:6px}.puppet-cta{bottom:5%;min-height:44px;padding:8px 22px;background:#dff8f2;color:#133f47;border:1px solid #71d9c8;border-radius:5px;font-size:16px;font-weight:700;white-space:nowrap}.puppet-speech{position:absolute;top:3%;left:50%;transform:translateX(-50%);margin:0;color:#f8edd1;font-size:16px;font-weight:700;white-space:nowrap}.puppet-speech:empty{display:none}@media(max-width:700px){.puppet-icon{width:76px;height:76px;top:36%}.puppet-cta{font-size:14px;bottom:2%;padding:7px 15px}.puppet-speech{font-size:13px;top:2%}.puppet-root .puppet-hit{width:29%;height:85%}}`;
export function mount(stage,{mode='home'}={}){
 const home=mode==='home',root=document.createElement('div');
 root.className='puppet-root';
 root.innerHTML=`<style>${css}.puppet-root [hidden]{display:none}.puppet-root canvas{width:100%;height:100%;position:absolute;inset:0}.scene-controls{position:absolute;bottom:8px;left:8px;display:flex;gap:6px}.scene-controls button{pointer-events:auto;background:#0c1226;color:#fff;border:1px solid #64809f;min-height:36px}.puppet-icon-gripped{background:none;border-color:transparent;box-shadow:none}</style>
 <canvas aria-hidden="true"></canvas>
 <button type="button" class="puppet-hit" data-actor="ame" aria-label="氷ノあめ"></button><button type="button" class="puppet-hit" data-actor="terami" aria-label="てらみすい"></button>
 <p class="puppet-speech" aria-live="polite"></p>
 ${home?'<a class="puppet-icon" href="#v-link-battle" hidden><img alt="V-Link Battle" src="../../../files/game-icons/v-link-battle.png"></a><a class="puppet-cta" href="#v-link-battle" hidden>作品を見る</a><div class="scene-controls"><button type="button" data-skip hidden>見送る</button><button type="button" data-replay>もう一度見る</button></div>':''}
 <button type="button" class="host-motion" aria-label="動きを一時停止">Ⅱ</button>`;
 stage.append(root);
 const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),art=new Image(),media=matchMedia('(prefers-reduced-motion: reduce)');
 const reduced=()=>matchMedia(media.media).matches;
 const walk=new Image();
 walk.src=new URL('./walk-sheet.png',import.meta.url).href;
 const idle=new Image();
 idle.src=new URL('./idle-sheet.png',import.meta.url).href;
 const turn=new Image();
 turn.src=new URL('./turn-sheet.png',import.meta.url).href;
 const modelSprites=Object.fromEntries(['idle','walk','turn'].map(kind=>{
  const sheet=new Image();sheet.src=new URL('./model-'+kind+'.png',import.meta.url).href;
  return [kind,sheet];
 }));
 const icon=root.querySelector('.puppet-icon'),cta=root.querySelector('.puppet-cta'),skip=root.querySelector('[data-skip]'),replay=root.querySelector('[data-replay]');
 const workCard=stage.querySelector('.host-work-card');
 let grip=null,carry=null,handoff=null,approach=null,fullCarry=null,retreat=null,retreatBridge=null,gripRenderer=null;
 function gripCel(amount){
  if(amount<.78&&handoff)return handoff;
  return grip;
 }
 function loadGrip(file,width,height,save){
  const sheet=new Image();
  sheet.onload=()=>{
   const layer=document.createElement('canvas');layer.width=width;layer.height=height;
   const paint=layer.getContext('2d');paint.drawImage(sheet,0,0,width,height);
   const pixels=paint.getImageData(0,0,width,height),d=pixels.data;
   for(let j=0;j<d.length;j+=4){
    const excess=d[j+1]-Math.max(d[j],d[j+2]);
    if(excess>8)d[j+3]*=1-Math.min(1,(excess-8)/34);
   }
   paint.putImageData(pixels,0,0);save(layer);draw();
  };
  sheet.src=new URL(file,import.meta.url).href;
 }
 if(home){
  loadGrip('./model-offer-pose.png',1536,1024,layer=>{if(dead)return;grip=layer;try{gripRenderer=portraitRenderer(layer,true)}catch{}});
  loadGrip('./model-handoff-pose.png',1536,1024,layer=>{
   handoff=layer;
   const isolate=(left)=>{
    const piece=document.createElement('canvas');piece.width=1536;piece.height=1024;
    const x=left?0:780,width=left?780:756;
    piece.getContext('2d').drawImage(layer,x,0,width,1024,x,0,width,1024);
    return piece;
   };
   carry=isolate(true);approach=isolate(false);
  });
  loadGrip('./model-carry-full.png',1536,1024,layer=>{fullCarry=layer});
  loadGrip('./retreat-sheet.png',1776,888,layer=>{retreat=layer});
  loadGrip('./retreat-bridge.png',1024,1536,layer=>{retreatBridge=layer});
 }
 const pause=root.querySelector('.host-motion'),speech=root.querySelector('.puppet-speech'),hits=[...root.querySelectorAll('.puppet-hit')];
 const events=new AbortController(),on={signal:events.signal};
 let t=0,last=0,frame=0,paused=false,ready=false,dead=false,renderer=null,done=false,skipAt=null,greetUntil=0;
 let prelude=home?PROLOGUE:0;
 let hasOffered=false;
 const taps=[-100,-100];
 if(home){try{done=Date.now()-Number(sessionStorage.getItem('vlink-intro-seen'))<45000}catch{}}
 function draw(){
  if(!ready||dead||!ctx)return;
  const width=root.clientWidth,height=root.clientHeight;
  if(!width||!height)return;
  const dpr=Math.min(devicePixelRatio||1,1.5),w=width*440/height;
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr)}
  ctx.setTransform(canvas.width/w,0,0,canvas.height/440,0,0);ctx.clearRect(0,0,w,440);
  const still=reduced();
  const sample=time=>still?sceneAt(0,w,home,true):done?backgroundAt(time,w):
   time<prelude?prologueAt(time,w):sceneAt(time-prelude,w,home,false);
  const scene=sample(t),ahead=sample(t+.035),behind=sample(Math.max(0,t-.035));
  root.toggleAttribute('data-foreground',home&&scene.depth>.27);
  const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
  const phase=ease((scene.offer-.36)/.18);
  const dock=grip?ease((scene.offer-.01)/.36):0;
  // Advance the locked pose and its card together just before enabling links.
  const extension=still?1:ease((scene.offer-.88)/.12);
  const jointScale=Math.min(.407,w/1536)*(.9+.1*extension);
  const arriving=scene.cycle>=3.5&&scene.cycle<7.5;
  const leaving=scene.cycle>=26;
  function travelPose(i,figureH,ground){
   const distance=ease((scene.depth-.29)/.49);
   const nearScale=Math.min(w*.49,435)/768*(i?2.55:3.1);
   const s=figureH/444+(nearScale-figureH/444)*distance;
   const position=scene.positions[i],sy=(ground-figureH)*(1-distance)+(i?38:23)*distance;
   const step=walkingFrame(position,s,i,(i?1:-1)*(arriving?-1:1),(i?173:187)/444,true);
   const sx=position+step.offset-222*s;
   return {s,sx,sy,step,card:{x:sx+[206,207,207,206][step.frame]*s,y:sy+120*s,size:51*s}};
  }
  const gripMix=grip&&icon.querySelector('img').naturalWidth?phase:0;
  const frontMix=handoff?ease((scene.offer-.62)/.38):1;
  const carryingPose=home&&carry&&!done&&!still&&scene.carrying>0;
  let carryMix=0,carryAnchor=null,approachPose=null,retreatCard=null;
  const palm=[],poses=[];
  delete root.dataset.card;
  for(let i=0;i<2;i++){
   const p={...poseAt(t,i,taps[i],still,home&&!done,t-prelude),offer:scene.offer},dir=i?-1:1;
   poses.push(p);
   const peekTime=done?t%24:t;
   const background=(home?scene.phase==='background':true)&&Object.values(modelSprites).every(sheet=>sheet.naturalWidth>0);
   if(home&&i===1&&workCard&&scene.phase==='background'&&peekTime>=2&&peekTime<4.18){
    const amount=ease((peekTime-2)/.55)*(1-ease((peekTime-3.55)/.63));
    const card=workCard.getBoundingClientRect(),bounds=canvas.getBoundingClientRect();
    const unit=440/height,cx=(card.left-bounds.left)*unit,cy=(card.top-bounds.top)*unit;
    const k=height<=240?.168:.192,headX=cx+card.width*unit*.62;
    const x=headX-535*k,y=cy+12-amount*83;
    ctx.save();ctx.beginPath();ctx.rect(cx,0,card.width*unit,cy+card.height*unit);ctx.clip();
    if(background)ctx.drawImage(modelSprites.idle,150,504,145,175,headX-40,y,80,96);
    else if(renderer)ctx.drawImage(renderer.draw(i,p,0),x,y,768*k,1024*k);
    else ctx.drawImage(art,768,0,768,1024,x,y,768*k,1024*k);
    ctx.restore();
    Object.assign(hits[i].style,{left:(headX-29)/w*100+'%',top:Math.max(0,y+18)/440*100+'%',width:58/w*100+'%',height:Math.max(0,cy-y-18)/440*100+'%'});
    hits[i].hidden=amount<.4;
    palm.push(null);
    continue;
   }
   const depth=home?scene.depth:1,zoom=ease((depth-.49)/.51);
   const figureH=!home&&background?Math.min(347,w*.43):(background?187:i?173:187)+depth*85;
   const ground=!home?437:352+depth*50;
   const fullScale=Math.min(w*.49,435)/768*(i?1-.24*carryMix:1);
   const walkingHeadScale=figureH/(i?1900:1790);
   const baseScale=walkingHeadScale+(fullScale-walkingHeadScale)*zoom;
   const k=i?baseScale+(jointScale-baseScale)*dock:baseScale;
   const paleX=i?181:680,py=i?560:547;
   const lift=42*p.offer-(i?dock*100:0);
   const nominal=w/2-dir*Math.min(350,w*.29);
   const target=w/2-dir*Math.min(112,w*.16)*.32-(paleX-384)*k;
   const center=scene.positions[i]+(home?(target-nominal)*depth:0);
   const baseX=center-((i?535:340)+(384-(i?535:340))*zoom)*k;
   const x=i?baseX+(w/2+(1120-782)*jointScale-535*k-baseX)*dock:baseX;
   const farY=ground-figureH-(i?75*k:0);
   const y=farY+(8-farY)*zoom+(i?-36*k*(1-dock)*zoom:0)+p.breath*(1-dock)+Math.sin(t*6+i)*scene.travel*1.6;
   const blend=!home&&background?0:home&&walk.complete&&walk.naturalWidth?Math.max(0,Math.min(1,(depth-.16)/.62)):1;
   if(retreat&&(arriving||leaving)&&scene.depth<.78){
    const pose=travelPose(i,figureH,ground);
    const {s,sx,sy,step,card}=pose;
    if(!i)retreatCard=card;
    const bridge=!i&&retreatBridge&&scene.depth>.62;
    if(bridge){
     const ratio=card.size/223;
     ctx.drawImage(retreatBridge,card.x-606*ratio,card.y-320*ratio,1024*ratio,1536*ratio);
    }else{
     const footY=sy+444*s;
     ctx.fillStyle='#080f20a0';ctx.beginPath();ctx.ellipse(step.planted,footY,figureH*.2,4,0,0,Math.PI*2);ctx.fill();
     const modelWalk=i&&modelSprites.walk.naturalWidth;
     if(modelWalk&&leaving){
      ctx.save();ctx.translate(sx+444*s,sy);ctx.scale(-1,1);
      ctx.drawImage(modelSprites.walk,step.frame*444,444,444,444,0,0,444*s,444*s);ctx.restore();
     }else ctx.drawImage(modelWalk?modelSprites.walk:retreat,step.frame*444,i*444,444,444,sx,sy,444*s,444*s);
    }
    palm.push(null);
    hits[i].hidden=true;
    continue;
   }
   if(i===scene.carrier&&carryingPose){
    carryMix=blend*(1-gripMix);
    const scale=k*.78;
    carryAnchor={x:x+340*k+(782-475)*scale,y:y+468*scale,size:347*scale};
   }
   if(blend<1){
    const cellW=walk.naturalWidth/4,cellH=walk.naturalHeight/2,figureW=figureH*cellW/cellH;
    const movement=ahead.positions[i]-behind.positions[i];
    const standing=idle.complete&&idle.naturalWidth&&Math.abs(movement)<1.25;
    const direction=Math.abs(movement)>.06?Math.sign(movement):i?-1:1;
    const walkPose=walkingFrame(center,figureW/444,i,direction,(i?173:187)*cellW/cellH/444);
    ctx.save();ctx.globalAlpha=(1-blend)*(1-gripMix);
    ctx.fillStyle='#080f20a0';ctx.beginPath();ctx.ellipse(standing?center:walkPose.planted,ground,figureW*.22,4,0,0,Math.PI*2);ctx.fill();
    const pivot=scene.pivots?.[i],wave=scene.wave?.[i]||(taps[i]>-100&&t-taps[i]<1.1);
    if(standing&&pivot!=null&&turn.complete&&turn.naturalWidth&&!wave){
     const angle=i?1-pivot:pivot;
     const cell=Math.round(Math.max(0,Math.min(2,2*angle)));
     const tw=turn.naturalWidth/3,th=turn.naturalHeight/2;
     const foot=[[300,255,217],[294,254,218]][i][cell]/512;
     const turnH=figureH*512/500,turnW=turnH*tw/th;
     if(background)ctx.drawImage(modelSprites.turn,cell*444,i*444,444,444,center-figureH/2,ground-figureH,figureH,figureH);
     else ctx.drawImage(turn,cell*tw,i*th,tw,th,center-foot*turnW,ground-turnH*500/512,turnW,turnH);
    }else if(standing){
     const beat=Math.floor((t+i*1.7)/2.6)%4;
     const cell=wave?2:beat===1?1:beat===3?3:0;
     const iw=idle.naturalWidth/4,ih=idle.naturalHeight/2;
     const bootCenter=[[248,250,246,239],[222,221,230,225]][i][cell];
     if(background)ctx.drawImage(modelSprites.idle,cell*444,i*444,444,444,center-figureH/2,ground-figureH,figureH,figureH);
     else ctx.drawImage(idle,cell*iw,i*ih,iw,ih,center-figureW*bootCenter/444,ground-figureH,figureW,figureH);
    }else{
     ctx.translate(center+walkPose.offset,ground);
     const bow=dir*p.greet*.095;
     ctx.translate(walkPose.pivot,0);ctx.rotate(bow);ctx.translate(-walkPose.pivot,0);
     if(walkPose.flipped)ctx.scale(-1,1);
     if(background)ctx.drawImage(modelSprites.walk,walkPose.frame*444,i*444,444,444,-figureW/2,-figureH,figureW,figureH);
     else ctx.drawImage(walk,walkPose.frame*cellW,i*cellH,cellW,cellH,-figureW/2,-figureH,figureW,figureH);
    }
    ctx.restore();
   }
   ctx.save();
   if(i!==scene.carrier&&carryAnchor&&dock>0){
    // The reaching forearm passes behind the card until the dedicated grip pose.
    const s=carryAnchor.size+(347*jointScale-carryAnchor.size)*dock;
    const cx=carryAnchor.x+(w/2-carryAnchor.x)*dock;
    const cy=carryAnchor.y+(8+468*jointScale-carryAnchor.y)*dock;
    ctx.beginPath();ctx.rect(0,0,w,440);ctx.rect(cx-s/2,cy,s,s);ctx.clip('evenodd');
   }
   if(i===1&&carryingPose&&approach)approachPose={x:x+535*k,y,k,alpha:blend*(1-gripMix)};
   ctx.globalAlpha=(i===scene.carrier&&carryingPose)||(i===1&&approachPose)?0:blend*(1-gripMix);
   if(renderer)ctx.drawImage(renderer.draw(i,p,lift),x,y,768*k,1024*k);
   else ctx.drawImage(art,i*768,0,768,1024,x,y,768*k,1024*k);
   ctx.restore();
   palm.push({x:x+paleX*k,y:y+(py-(renderer?lift:0))*k});
   const face=blend<.5?center:x+(i?535:300)*k,box=blend<.5?55:230*k;
   Object.assign(hits[i].style,{left:(face-box/2)/w*100+'%',top:(blend<.5?165:y+130*k)/440*100+'%',width:box/w*100+'%',height:box/440*100+'%'});
   hits[i].hidden=face<0||face>w;
  }
  if(home&&retreatCard){
   root.dataset.card=JSON.stringify(retreatCard);
   const picture=icon.querySelector('img');
   if(picture.complete&&picture.naturalWidth){
    ctx.save();ctx.globalCompositeOperation='destination-over';
    ctx.drawImage(picture,retreatCard.x,retreatCard.y,retreatCard.size,retreatCard.size);
    ctx.restore();
   }
   cta.hidden=skip.hidden=icon.hidden=true;replay.hidden=false;
   if(t>=greetUntil)speech.textContent='';
  }else if(home){
   const offering=reduced()||(!done&&skipAt===null&&scene.phase==='presenting');
   const sz=carryAnchor?.size??Math.min(112,w*.16),anchor=palm[scene.carrier];
   const k=jointScale;
   let cardSize=sz+(347*k-sz)*dock;
   const carryingX=anchor.x+(scene.carrier?-1:1)*sz*.32;
   const fromX=carryAnchor?.x??carryingX;
   let centerX=fromX+(w/2-fromX)*dock;
   const fromY=carryAnchor?.y??anchor.y-sz;
   let cardY=fromY+(8+468*k-fromY)*dock;
   if(retreat&&(arriving||leaving)){
    const {card}=travelPose(0,187+scene.depth*85,352+scene.depth*50);
    const align=ease((.96-scene.depth)/.18);
    centerX+=(card.x+card.size/2-centerX)*align;
    cardY+=(card.y-cardY)*align;
    cardSize+=(card.size-cardSize)*align;
   }
   const cardX=centerX-cardSize/2,gripScale=cardSize/347;
   const gx=cardX-609*gripScale,gy=cardY-468*gripScale;
   const visible=offering||(!done&&scene.carrying>=.02&&(carryMix>0||scene.depth>=.55));
   const picture=icon.querySelector('img');
   if(carryMix){
    ctx.globalAlpha=carryMix;
    if(fullCarry&&scene.depth<.99){
     const s=cardSize/203;
     ctx.drawImage(fullCarry,0,0,812,1024,cardX-578*s,cardY-207*s,812*s,1024*s);
    }else ctx.drawImage(carry,gx,gy,1536*gripScale,1024*gripScale);
    ctx.globalAlpha=1;
    if(carryMix>.5)Object.assign(hits[0].style,{left:(gx+270*gripScale)/w*100+'%',top:(gy+100*gripScale)/440*100+'%',width:340*gripScale/w*100+'%',height:320*gripScale/440*100+'%'});
   }
   if(approachPose){
    const p=approachPose,s=p.k+(gripScale-p.k)*dock;
    const start=p.x-1120*s;
    ctx.save();
    ctx.beginPath();ctx.rect(0,0,w,440);ctx.rect(cardX,cardY,cardSize,cardSize);ctx.clip('evenodd');
    ctx.globalAlpha=p.alpha;
    if(fullCarry&&scene.depth<.99){
     const fullScale=cardSize/203,face=p.x+(gx+1120*gripScale-p.x)*dock;
     ctx.drawImage(fullCarry,812,0,724,1024,face-(1050-812)*fullScale,cardY-207*fullScale,724*fullScale,1024*fullScale);
    }else ctx.drawImage(approach,start+(gx-start)*dock,p.y+(gy-p.y)*dock,1536*s,1024*s);
    ctx.restore();
   }
   if(gripMix){
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.globalAlpha=gripMix;
    const cel=gripCel(frontMix);
    const heldPose=cel===grip&&gripRenderer?gripRenderer.drawPair(...poses):cel;
    ctx.drawImage(heldPose,gx,gy,1536*gripScale,1024*gripScale);
    ctx.restore();
    if(gripMix>.5)hits.forEach((el,i)=>Object.assign(el.style,{left:(gx+(i?920:270)*k)/w*100+'%',top:(gy+100*k)/440*100+'%',width:340*k/w*100+'%',height:320*k/440*100+'%'}));
   }
   if(visible&&picture.complete&&picture.naturalWidth){
    ctx.save();
    ctx.globalCompositeOperation='destination-over';
    ctx.globalAlpha=offering?1:carryingPose?carryMix+gripMix:scene.carrying;
    ctx.drawImage(picture,cardX,cardY,cardSize,cardSize);
    ctx.restore();
   }
   if(visible)root.dataset.card=JSON.stringify({x:cardX,y:cardY,size:cardSize});
   cta.hidden=!offering;skip.hidden=!offering||reduced();
   replay.hidden=offering||reduced();
   if(offering||done)hasOffered=true;
   const label=hasOffered?'もう一度見る':'作品紹介を見る';
   if(replay.textContent!==label)replay.textContent=label;
   icon.hidden=!visible;
   icon.tabIndex=offering?0:-1;icon.style.pointerEvents=offering?'auto':'none';
   Object.assign(icon.style,{left:centerX/w*100+'%',top:cardY/440*100+'%',width:cardSize*height/440+'px',height:cardSize*height/440+'px'});
   icon.classList.add('puppet-icon-gripped');
   picture.style.opacity='0';
   if(t>=greetUntil)speech.textContent=offering?'これ、遊んでみて！':'';
  }else if(t>=greetUntil)speech.textContent='';
  stage.dataset.puppetFrame=String(Math.round(t*60));
  root.dataset.scene=JSON.stringify(scene);
 }
 function tick(now){
  if(dead||document.hidden)return;
  const still=reduced();
  if(still!==pause.hidden){pause.hidden=still;last=0;draw()}
  if(paused||still){last=0;frame=requestAnimationFrame(tick);return}
  const dt=last?Math.min(.05,(now-last)/1000):0;
  last=now;t+=dt*(skipAt!==null&&t<prelude+24?3:1);
  if(home&&!done&&t>=prelude+CYCLE){done=true;t=0;taps.fill(-100);greetUntil=0}
  draw();frame=requestAnimationFrame(tick);
 }
 function run(){cancelAnimationFrame(frame);last=0;pause.hidden=reduced();draw();if(ready&&!document.hidden)frame=requestAnimationFrame(tick)}
 hits.forEach((el,i)=>{
  el.style.touchAction='pan-y';
  el.addEventListener('click',event=>{
   if(event.detail>0){
    const rect=canvas.getBoundingClientRect();
    const x=Math.floor((event.clientX-rect.left)*canvas.width/rect.width);
    const y=Math.floor((event.clientY-rect.top)*canvas.height/rect.height);
    if(ctx.getImageData(x,y,1,1).data[3]<100)return;
   }
   taps[i]=t;greetUntil=t+2;
   speech.textContent=i?'いっしょに見てみよう！':'こんにちは！';
   stage.dataset.reaction=el.dataset.actor;draw();
  },on);
 });
 pause.hidden=reduced();
 pause.addEventListener('click',()=>{paused=!paused;pause.textContent=paused?'▶':'Ⅱ';pause.setAttribute('aria-label',paused?'動きを再開':'動きを一時停止');run()},on);
 if(home){
  const remember=()=>{try{sessionStorage.setItem('vlink-intro-seen',Date.now())}catch{}};
  [icon,cta].forEach(link=>link.addEventListener('click',remember,on));
  skip.addEventListener('click',()=>{skipAt=t;remember();draw()},on);
  replay.addEventListener('click',()=>{done=false;prelude=0;skipAt=null;t=0;taps.fill(-100);greetUntil=0;paused=false;pause.textContent='Ⅱ';pause.setAttribute('aria-label','動きを一時停止');run()},on);
 }
 const resize=new ResizeObserver(draw);resize.observe(stage);
 media.addEventListener('change',()=>{pause.hidden=reduced();run()},on);
 document.addEventListener('visibilitychange',run,on);
 art.onload=()=>{if(dead)return;try{renderer=portraitRenderer(art)}catch{}ready=true;stage.dataset.puppetReady='true';run()};
 art.src=new URL('./hosts.png',import.meta.url).href;
 return ()=>{dead=true;cancelAnimationFrame(frame);resize.disconnect();events.abort();renderer?.dispose();gripRenderer?.dispose();root.remove();delete stage.dataset.puppetReady;delete stage.dataset.puppetFrame;delete stage.dataset.reaction};
}
