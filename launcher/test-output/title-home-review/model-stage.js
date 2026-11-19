import * as T from '../vlink-companion/vendor/three.module.js';

// Read the original extracted model; only the review pose is authored here.
const base = new URL('../vlink-companion/assets/', import.meta.url);
const data = await (await fetch(new URL('ame.json', base))).json();
const scene = new T.Scene();
const model = new T.Group(); scene.add(model);
const nodes = new Map(), bones = new Map(), meshes = [];
for (const n of data.nodes) {
  const b = new T.Bone(); b.name=n.name; b.position.fromArray(n.p); b.quaternion.fromArray(n.q); b.scale.fromArray(n.s);
  nodes.set(n.id,b); bones.set(n.name,b);
}
for (const n of data.nodes) (nodes.get(n.parent)||model).add(nodes.get(n.id));
const loader = new T.TextureLoader(), materials = new Map();
for (const [id,m] of Object.entries(data.materials)) {
  const map = m.map ? await loader.loadAsync(new URL(m.map,base).href) : null;
  if(map){map.colorSpace=T.SRGBColorSpace;map.flipY=true;}
  materials.set(id,new T.MeshStandardMaterial({map,roughness:.86,side:T.DoubleSide,alphaTest:.4}));
}
model.updateMatrixWorld(true);
for(const m of data.meshes){
  const g=new T.BufferGeometry();
  for(const [key,size] of Object.entries({position:3,normal:3,uv:2,skinWeight:4,skinIndex:4}))
    g.setAttribute(key,key==='skinIndex'?new T.Uint16BufferAttribute(m[key],size):new T.Float32BufferAttribute(m[key],size));
  g.setIndex(m.indices);for(const group of m.groups)g.addGroup(group.start,group.count,group.materialIndex);
  const mesh=new T.SkinnedMesh(g,m.materials.map(id=>materials.get(id))); nodes.get(m.node).add(mesh);mesh.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton(m.bones.map(id=>nodes.get(id)),m.bind.map(a=>new T.Matrix4().fromArray(a))),new T.Matrix4());mesh.frustumCulled=false;meshes.push(mesh);
}
scene.add(new T.HemisphereLight(0xffffff,0xa8bbd1,2.3));
const key=new T.DirectionalLight(0xffffff,2.1);key.position.set(-2,4,4);scene.add(key);
const fill=new T.DirectionalLight(0xc5e6f2,.7);fill.position.set(2,2,-3);scene.add(fill);
const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(800,1000);renderer.setPixelRatio(1);renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;document.body.append(renderer.domElement);
const camera=new T.OrthographicCamera(-.92,.92,1.15,-1.15,.01,30);camera.position.set(0,1.08,7);camera.lookAt(0,1.08,0);
const rests=new Map([...bones.values()].map(b=>[b,b.quaternion.clone()]));
function rotate(name,x,y,z){bones.get(name)?.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(x,y,z)));}
const iconTexture=await loader.loadAsync('../../../files/game-icons/sliding-space-parking.png');iconTexture.colorSpace=T.SRGBColorSpace;
const icon=new T.Mesh(new T.PlaneGeometry(.40,.40),new T.MeshBasicMaterial({map:iconTexture,transparent:true,side:T.DoubleSide}));
icon.position.set(0,1.20,.25);scene.add(icon);

// CCD moves the actual arm bones so fingertips and the offered icon share 3D space.
function reach(side,target){
  const tip=bones.get('J_Bip_'+side+'_Hand');
  const chain=['LowerArm','UpperArm'].map(n=>bones.get('J_Bip_'+side+'_'+n));
  for(let i=0;i<30;i++)for(const joint of chain){
    model.updateMatrixWorld(true);
    const center=joint.getWorldPosition(new T.Vector3());
    const from=tip.getWorldPosition(new T.Vector3()).sub(center).normalize();
    const to=target.clone().sub(center).normalize();
    const delta=new T.Quaternion().setFromUnitVectors(from,to);
    const world=joint.getWorldQuaternion(new T.Quaternion());
    const parent=joint.parent.getWorldQuaternion(new T.Quaternion()).invert();
    joint.quaternion.copy(parent.multiply(delta.multiply(world)));
  }
}
window.setPose=async function(pose){
  for(const [b,q]of rests)b.quaternion.copy(q);
  rotate('J_Bip_L_UpperArm',.04,0,1.24);rotate('J_Bip_R_UpperArm',.04,0,-1.24);
  rotate('J_Bip_L_LowerArm',0,-.13,.12);rotate('J_Bip_R_LowerArm',0,.13,-.12);
  rotate('J_Bip_L_UpperLeg',0,0,-.025);rotate('J_Bip_R_UpperLeg',0,0,.025);
  icon.visible=pose==='offer';
  if(pose==='offer'){
    reach('L',new T.Vector3(-.215,1.13,.29));reach('R',new T.Vector3(.215,1.13,.29));
    rotate('J_Bip_C_Head',-.04,.03,.025);
  }else if(pose==='peek'){
    rotate('J_Bip_C_Spine',0,0,-.13);rotate('J_Bip_C_Head',0,0,.12);
  }
  model.updateMatrixWorld(true);for(const m of meshes)m.skeleton.update();renderer.render(scene,camera);
  const gl=renderer.getContext(),pixels=new Uint8Array(800*1000*4);gl.readPixels(0,0,800,1000,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let visible=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>32)visible++;
  return {pose,visible,vertices:meshes.reduce((n,m)=>n+m.geometry.attributes.position.count,0),bones:bones.size,
    hands:['L','R'].map(s=>bones.get('J_Bip_'+s+'_Hand').getWorldPosition(new T.Vector3()).toArray())};
};
await window.setPose('idle');window.modelReady=true;
