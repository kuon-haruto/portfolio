export const works=[
 {id:'v-link-battle',icon:'v-link-battle',name:'V-Link Battle'},
 {id:'parking',icon:'sliding-space-parking',name:'すべる宇宙駐車場'},
 {id:'sanshoku-bunki',icon:'sanshoku-bunki',name:'三色の分岐係'}
];
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const window=(t,start,end,ramp)=>smooth((t-start)/ramp)*(1-smooth((t-end)/ramp));
export const CYCLE=32;
export const PROLOGUE=9;
export function prologueAt(time,width){
 const scene=backgroundAt(Math.min(time,7),width);
 const retreat=smooth((time-7)/2);
 return {...scene,positions:scene.positions.map((x,i)=>x+((i?width+130:-130)-x)*retreat)};
}
export function backgroundAt(time,width){
 const phase=time%24;
 const positions=[0,1].map(i=>{
  const side=i?1:-1,edge=i?width+130:-130;
  const back=width/2+side*Math.min(width*.42,510);
  const arrival=smooth((phase-(i?4.2:.6))/(i?2.8:1.65));
  const departure=smooth((phase-(i?20:17))/(i?2.5:2.8));
  const patrol=smooth((phase-(i?7.1:4))/2.3)-smooth((phase-(i?16:13))/2.7);
  const peek=i?155*window(phase,2,3.1,.65):0;
  return edge+((back-edge)*arrival-side*(Math.min(width*(i?.11:.18),i?120:190)*patrol+peek))*(1-departure);
 });
 const wave=[phase>=9.7&&phase<10.7,phase>=10.85&&phase<11.95];
 const pivots=[phase>=11? smooth((phase-11)/1.2):null,phase>=13.2?smooth((phase-13.2)/1.3):null];
 return {positions,phase:'background',depth:0,travel:0,offer:0,carrier:0,carrying:0,pivots,wave};
}
export function sceneAt(time,width,home=true,reduced=false){
 const cycle=reduced?12:time%CYCLE,carrier=Math.floor(time/CYCLE)%2;
 const entering=smooth((cycle-3.5)/4),leaving=smooth((cycle-26)/4);
 const offer=reduced?1:smooth((cycle-7.5)/2.5)*(1-smooth((cycle-24)/2));
 const positions=[0,1].map(i=>{
  const side=i?1:-1,edge=i?width+130:-130;
  const target=home?width/2+side*Math.min(350,width*.29):(i?width-110:110);
  if(reduced)return target;
  if(!home){const peek=window(time-i*.4,.2,2.1,.9);return edge-side*95*peek+(target-edge)*smooth((time-3-i*.3)/2.8)}
  const back=target+side*Math.min(width*.15,155);
  const arrival=smooth((cycle-i*.28)/1.5);
  const idle=Math.sin(cycle*1.3+i*2)*Math.min(width*.035,32)*(1-entering);
  return edge+((back-edge)*arrival+(target-back)*entering*(1-leaving)+idle*arrival)*(1-smooth((cycle-30)/2));
 });
 const dir=carrier?-1:1,carryX=positions[carrier]+dir*172;
 const iconX=carryX+(width/2-carryX)*offer,iconBottom=316-84*offer;
 const phase=cycle<3.5?'peek':cycle<7.5?'carrying':cycle<10?'offering':cycle<24?'presenting':cycle<26?'collecting':cycle<30?'leaving':'hidden';
 return {cycle,carrier,positions,offer,iconX,iconBottom,phase,depth:reduced?1:entering*(1-leaving),
  carrying:window(cycle,3.4,29.8,.3),travel:4*entering*(1-entering)+4*leaving*(1-leaving)};
}
// Map travel in source pixels to the four drawn poses. The planted
// shoe is kept on the same ground point through each contact/passing pair.
export function walkingFrame(x,scale,index,direction,groundScale=scale,retreat=false){
 const stride=112*groundScale,travel=direction*x;
 const step=Math.floor(travel/stride);
 const progress=travel/stride-step;
 const passing=progress>=.52;
 const frame=((step%2+2)%2)*2+Number(passing);
 // Measured sole centers in the original 1776px-wide sheet, as cell offsets.
 const sole=(retreat?[[145,237,162,233],[327,214,305,224]]:[[316,230,307,223],[146,226,132,207]])[index][frame];
 const facing=(index?-1:1)*(retreat?-1:1);
 const flipped=direction!==facing;
 const nominal=222;
 const sourceSole=flipped?444-sole:sole;
 const pivot=(sourceSole-nominal)*scale;
 const planted=direction*(step+.62)*stride;
 const offset=planted-x-pivot;
 // During the retreat, the feet in successive painted cels have different
 // centers. Return to the root at each cel boundary instead of teleporting
 // the entire character from one foot anchor to the next.
 const edgeDistance=Math.min(progress,Math.abs(progress-.52),1-progress);
 const displayOffset=retreat?Math.max(-10,Math.min(10,offset))*smooth(edgeDistance/.2):offset;
 return {frame,flipped,offset:displayOffset,pivot,planted:x+displayOffset+pivot};
}
export function poseAt(time,index,tap=-100,reduced=false,home=true,sceneTime=time){
 const sign=index?-1:1,t=reduced?12:time,cycle=(reduced?12:Math.max(0,sceneTime))%CYCLE,age=time-tap;
 const greet=reduced?0:window(age,0,1.9,.4);
 const offer=home?(reduced?1:smooth((cycle-7.5)/2.5)*(1-smooth((cycle-24)/2))):0;
 // An unequal repeating schedule avoids two characters blinking in lockstep.
 const period=index?13.7:15.3,b=t%period,blinks=index?[2.8,6.5,11.2]:[3.9,8.1,8.48,13.6];
 let blink=0;
 if(!reduced)for(const at of blinks){const age=b-at;blink=Math.max(blink,smooth(age/.065)*(1-smooth((age-.09)/.11)))}
 const speak=!reduced?((home?window(cycle,10.1+index*.65,11.8+index*.65,.22):0)+greet)*(.35+.65*Math.sin(t*10.7+index)**2):0;
 const breath=reduced?0:Math.sin(t*1.6+index*1.9)*1.25;
 const nod=greet*Math.sin(Math.max(0,age)*5)*.035;
 return {offer,blink,mouth:clamp(speak),greet,breath,
  body:reduced?0:Math.sin(t*.62+index*2.1)*.006,
  head:reduced?sign*.012:Math.sin(t*.7+index*1.7)*.014+sign*offer*.025+nod,
  headX:reduced?0:Math.sin(t*.48+index)*1.2,
  hair:reduced?0:Math.sin(t*1.12+index-.6)*.015+Math.sin(t*1.9+index)*.006-nod*.65,
  peek:home||reduced?0:-sign*75*(1-smooth((t-index*.3)/1.8))
 };
}
export function solveArm(shoulder,palm,upper,lower,bend){
 const dx=palm.x-shoulder.x,dy=palm.y-shoulder.y;
 const distance=Math.min(upper+lower-.01,Math.max(Math.abs(upper-lower)+.01,Math.hypot(dx,dy)));
 const theta=Math.atan2(dy,dx),alpha=Math.acos((distance*distance+upper*upper-lower*lower)/(2*distance*upper));
 return {x:shoulder.x+Math.cos(theta+bend*alpha)*upper,y:shoulder.y+Math.sin(theta+bend*alpha)*upper};
}
