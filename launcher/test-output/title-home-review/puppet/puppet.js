import {defs,character,arm} from './art.js';
let serial=0;
const css=`.puppet-root{position:absolute;inset:0;pointer-events:none;overflow:hidden;isolation:isolate}.puppet-root svg{width:100%;height:100%;display:block}.puppet-root .puppet-hit{position:absolute;top:8%;height:78%;width:22%;padding:0;background:none;border:0;border-radius:0;pointer-events:auto;cursor:pointer}.puppet-hit:focus-visible{outline:2px solid #f4d38b;outline-offset:-5px}.puppet-root a{pointer-events:auto;position:absolute;left:50%;transform:translateX(-50%);text-decoration:none}.puppet-icon{top:35%;width:116px;height:116px;background:#152841;border:2px solid #a5e9eb;border-radius:8px;box-shadow:0 6px 28px #35cbd12e}.puppet-icon img{width:100%;height:100%;object-fit:contain;border-radius:6px}.puppet-cta{bottom:5%;min-height:44px;padding:8px 22px;background:#dff8f2;color:#133f47;border:1px solid #71d9c8;border-radius:5px;font-size:16px;font-weight:700;white-space:nowrap}.puppet-speech{position:absolute;top:3%;left:50%;transform:translateX(-50%);margin:0;color:#f8edd1;font-size:16px;font-weight:700;white-space:nowrap}.puppet-speech:empty{display:none}@media(max-width:700px){.puppet-icon{width:76px;height:76px;top:36%}.puppet-cta{font-size:14px;bottom:2%;padding:7px 15px}.puppet-speech{font-size:13px;top:2%}.puppet-root .puppet-hit{width:29%;height:85%}}`;
export function mount(stage,{mode='home'}={}){
 const home=mode!=='title',uid=`puppet-${++serial}`,root=document.createElement('div');root.className='puppet-root';root.dataset.mode=mode;
 // Namespace paint IDs so two mounted stages cannot steal one another's fills.
 root.innerHTML=`<style>${css}.puppet-speech{max-width:180px;white-space:normal;text-align:center;line-height:1.4}@media(max-width:700px){.puppet-root[data-mode="title"]{top:42px}.puppet-speech{max-width:140px}}</style><svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMax meet">${defs}<g data-rig="ame">${character('ame')}${arm('ame','outer')}${arm('ame','inner')}</g><g data-rig="terami">${character('terami')}${arm('terami','outer')}${arm('terami','inner')}</g><g data-front></g></svg><button class="puppet-hit" data-actor="ame" aria-label="氷ノあめにあいさつ" title="氷ノあめにあいさつ"></button><button class="puppet-hit" data-actor="terami" aria-label="てらみにあいさつ" title="てらみにあいさつ"></button><p class="puppet-speech" aria-live="polite"></p>${home?`<a class="puppet-icon" href="#parking" aria-label="すべる宇宙駐車場の作品を見る"><img src="${new URL('../../../../files/game-icons/sliding-space-parking.png',import.meta.url)}" alt="すべる宇宙駐車場"></a><a class="puppet-cta" href="#parking">作品を見る</a>`:''}`;
 root.querySelectorAll('[id]').forEach(e=>{const old=e.id;e.id=`${uid}-${old}`;root.querySelectorAll(`[fill="url(#${old})"]`).forEach(n=>n.setAttribute('fill',`url(#${uid}-${old})`))});
 stage.append(root);const svg=root.querySelector('svg'),speech=root.querySelector('.puppet-speech'),media=matchMedia('(prefers-reduced-motion: reduce)'),events=new AbortController();
 const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');overlay.setAttribute('preserveAspectRatio','xMidYMax meet');overlay.style.cssText='position:absolute;inset:0;z-index:2;pointer-events:none';overlay.setAttribute('aria-hidden','true');root.append(overlay);
 const palms=[...svg.querySelectorAll('[data-hand]')].map(source=>{const copy=source.cloneNode(true);copy.setAttribute('stroke','#35435c');copy.setAttribute('stroke-width','1.5');copy.setAttribute('stroke-linecap','round');copy.setAttribute('stroke-linejoin','round');overlay.append(copy);return {source,copy}});
 const actors=['ame','terami'].map((id,i)=>({id,i,rig:root.querySelector(`[data-rig="${id}"]`),char:root.querySelector(`[data-character="${id}"]`),head:root.querySelector(`[data-character="${id}"] [data-head]`),hair:root.querySelector(`[data-character="${id}"] [data-fringe]`),hit:root.querySelector(`[data-actor="${id}"]`),arms:['outer','inner'].map(side=>root.querySelector(`[data-arm="${id}-${side}"]`)),tap:-100,look:0,lag:0}));
 root.querySelector('style').textContent+='@media(max-width:700px){.puppet-root[data-mode="title"]{top:64px}}';
 let w=1120,h=360,small=false,frame=0,last=0,t=0,dead=false,px=0,py=0,pointing=false,until=0;
 function layout(){const r=stage.getBoundingClientRect();small=r.width<700;w=small?600:1120;h=360;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);overlay.setAttribute('viewBox',`0 0 ${w} ${h}`);actors.forEach(a=>{a.x=home?(a.i?w/2+165:w/2-165):(a.i?w-137:137);a.hit.style.left=`${(a.x/w)*100-(small?14.5:11)}%`})}
 const resize=new ResizeObserver(layout);resize.observe(stage);layout();
 function greet(a){a.tap=t;actors[1-a.i].tap=t+.45;until=t+3;speech.textContent=a.i?'てらみ「いっしょに見てみよう！」':'あめ「これ、遊んでみて！」';stage.dataset.reaction=a.id;if(media.matches)draw(0)}
 actors.forEach(a=>a.hit.addEventListener('click',()=>greet(a),{signal:events.signal}));
 stage.addEventListener('pointermove',e=>{const r=stage.getBoundingClientRect();px=(e.clientX-r.left)/r.width*w;py=(e.clientY-r.top)/r.height*h;pointing=true;if(media.matches)draw(0)},{signal:events.signal});
 stage.addEventListener('pointerleave',()=>{pointing=false},{signal:events.signal});
 function set(n,s){n.setAttribute('transform',s)}
 // Two-bone planar solve: wrist targets stay attached while shoulder and elbow articulate.
 function poseArm(g,sx,sy,tx,ty,bend,handAngle){const dx=tx-sx,dy=ty-sy,d=Math.min(187,Math.max(25,Math.hypot(dx,dy))),theta=Math.atan2(dy,dx),alpha=Math.acos((d*d+96*96-92*92)/(2*d*96)),a=theta+bend*alpha,ex=sx+Math.cos(a)*96,ey=sy+Math.sin(a)*96,b=Math.atan2(ty-ey,tx-ex);set(g,`translate(${sx} ${sy}) rotate(${a*180/Math.PI-90})`);set(g.querySelector('[data-fore]'),`translate(0 96) rotate(${(b-a)*180/Math.PI})`);set(g.querySelector('[data-hand]'),`translate(0 92) rotate(${handAngle-(b*180/Math.PI-90)}) scale(.7)`)}
 function draw(dt){
  const still=media.matches,cycle=t%18,invite=home&&cycle>12&&cycle<15;
  const works=[['parking','sliding-space-parking','すべる宇宙駐車場'],['v-link-battle','v-link-battle','V-Link Battle'],['sanshoku-bunki','sanshoku-bunki','三色の分岐係']];
  const work=works[Math.floor(t/18)%works.length];
  if(home&&root.dataset.work!==work[0]){
   const icon=root.querySelector('.puppet-icon'),cta=root.querySelector('.puppet-cta'),img=icon.querySelector('img');
   icon.href=cta.href='#'+work[0];img.src=new URL('../../../../files/game-icons/'+work[1]+'.png',import.meta.url);img.alt=work[2];icon.setAttribute('aria-label',work[2]+'の作品を見る');root.dataset.work=work[0];
  }
  if(t>until)speech.textContent=invite?'これ、遊んでみて！':home?work[2]:'';
  actors.forEach(a=>{const sign=a.i?-1:1,elapsed=t-a.tap,wave=!still&&elapsed>=0&&elapsed<2.7,breath=still?0:Math.sin(t*1.8+a.i*.35),lean=still?0:Math.sin(t*.7+a.i*.6)*1.2+(wave?Math.sin(elapsed*2)*2:0);a.look+=( (pointing?Math.max(-1,Math.min(1,(px-a.x)/180)):sign*.4)-a.look)*Math.min(1,dt*7||1);a.lag+=(lean-a.lag)*Math.min(1,dt*3||1);
   set(a.rig,`translate(${a.x} ${12+breath*1.3})`);set(a.char,`rotate(${lean} 0 320)`);set(a.head,`translate(${a.look*2} ${breath*.5}) rotate(${a.look*2+lean*.5} 0 195)`);set(a.hair,`rotate(${still?0:(lean-a.lag)*2+Math.sin(t*1.7-a.i)*.7} 0 55)`);
   const phase=(t+a.i*.13)%5.4,blink=still?1:phase<.16?Math.max(.06,Math.abs(phase-.08)/.08):1;
   a.head.querySelectorAll('[data-eye]').forEach(e=>set(e,`scale(1 ${blink})`));a.head.querySelectorAll('[data-lid]').forEach(e=>e.setAttribute('opacity',blink<.3?'1':'0'));a.head.querySelectorAll('[data-pupil]').forEach(e=>set(e,`translate(${a.look*3} ${pointing?Math.max(-2,Math.min(2,(py-130)/100)):0})`));
   a.head.querySelector('[data-mouth]').setAttribute('d',wave||invite?'M-10 170Q2 190 17 169Q4 176-10 170Z':'M-10 172Q3 181 17 169');a.head.querySelector('[data-mouth]').setAttribute('fill',wave||invite?'#9f596e':'none');
   const inner=home?{x:sign*104,y:139+breath*.7}:{x:sign*58,y:286};
   poseArm(a.arms[1],sign*64,231,inner.x,inner.y,sign,home?-sign*95:sign*35);
   const outer=wave?{x:-sign*(100+Math.sin(elapsed*10)*13),y:123+Math.sin(elapsed*10)*6}:invite&&!still?{x:-sign*115,y:213+Math.sin(t*5)*10}:home?{x:sign*106,y:232}:{x:-sign*88,y:344};
   poseArm(a.arms[0],-sign*66,231,outer.x,outer.y,home&&!wave&&!invite?sign:-sign,wave?sign*14:home?-sign*80:0);
   stage.dataset[a.id+'State']=wave?'wave':invite?'invite':'presenting';
  });const base=svg.getCTM();if(base){const inverse=base.inverse();palms.forEach(({source,copy})=>{const m=inverse.multiply(source.getCTM());set(copy,`matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`)})}stage.dataset.puppetFrame=String(Math.round(t*60));
 }
 function tick(now){if(dead)return;const dt=Math.min(.05,(now-last)/1000||0);last=now;if(!media.matches)t+=dt;draw(dt);if(!media.matches)frame=requestAnimationFrame(tick)}
 function motion(){cancelAnimationFrame(frame);last=0;draw(0);if(!media.matches)frame=requestAnimationFrame(tick)}
 media.addEventListener('change',motion,{signal:events.signal});document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(frame);last=0;if(!document.hidden)motion()},{signal:events.signal});
 draw(0);motion();stage.dataset.puppetReady='true';
 return ()=>{dead=true;cancelAnimationFrame(frame);resize.disconnect();events.abort();root.remove();delete stage.dataset.puppetReady;delete stage.dataset.puppetFrame;delete stage.dataset.ameState;delete stage.dataset.teramiState;delete stage.dataset.reaction};
}
