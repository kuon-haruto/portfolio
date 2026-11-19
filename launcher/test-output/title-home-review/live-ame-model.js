import * as T from '../vlink-companion/vendor/three.module.js';
export { T };
export const assets = new URL('../vlink-companion/assets/', import.meta.url);

// Same extracted skeleton/skin binding as model-stage.js; no mesh simplification.
export async function createRig(data, resources = new Set()) {
  const root = new T.Group(), bones = new Map(), nodes = new Map(), meshes = [], rest = new Map();
  const own = value => (resources.add(value), value);
  for (const n of data.nodes) {
    const b = new T.Bone(); b.name = n.name;
    b.position.fromArray(n.p); b.quaternion.fromArray(n.q); b.scale.fromArray(n.s);
    nodes.set(n.id, b); bones.set(n.name, b); rest.set(b, b.quaternion.clone());
  }
  for (const n of data.nodes) (nodes.get(n.parent) || root).add(nodes.get(n.id));
  const loader = new T.TextureLoader(), materials = new Map();
  for (const [id, m] of Object.entries(data.materials)) {
    const map = m.map ? own(await loader.loadAsync(new URL(m.map, assets).href)) : null;
    if (map) { map.colorSpace = T.SRGBColorSpace; map.flipY = true; }
    materials.set(id, own(new T.MeshStandardMaterial({map, roughness: .86, side: T.DoubleSide, alphaTest: .4})));
  }
  root.updateMatrixWorld(true);
  for (const m of data.meshes) {
    const g = own(new T.BufferGeometry());
    for (const [key, size] of Object.entries({position:3, normal:3, uv:2, skinWeight:4, skinIndex:4}))
      g.setAttribute(key, key === 'skinIndex' ? new T.Uint16BufferAttribute(m[key], size) : new T.Float32BufferAttribute(m[key], size));
    g.setIndex(m.indices);
    for (const group of m.groups) g.addGroup(group.start, group.count, group.materialIndex);
    const mesh = new T.SkinnedMesh(g, m.materials.map(id => materials.get(id)));
    nodes.get(m.node).add(mesh); mesh.updateMatrixWorld(true);
    mesh.bind(own(new T.Skeleton(m.bones.map(id => nodes.get(id)), m.bind.map(a => new T.Matrix4().fromArray(a)))), new T.Matrix4());
    mesh.frustumCulled = false; meshes.push(mesh);
  }
  function rotate(name, x=0, y=0, z=0) {
    bones.get(name)?.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(x,y,z)));
  }
  function reach(side, localTarget) {
    root.updateMatrixWorld(true);
    const target = root.localToWorld(localTarget.clone()), tip = bones.get(`J_Bip_${side}_Hand`);
    const chain = ['LowerArm','UpperArm'].map(n => bones.get(`J_Bip_${side}_${n}`));
    for (let i=0;i<18;i++) for (const joint of chain) {
      root.updateMatrixWorld(true);
      const center = joint.getWorldPosition(new T.Vector3());
      const from = tip.getWorldPosition(new T.Vector3()).sub(center).normalize();
      const to = target.clone().sub(center).normalize();
      const delta = new T.Quaternion().setFromUnitVectors(from, to);
      const world = joint.getWorldQuaternion(new T.Quaternion());
      joint.quaternion.copy(joint.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(delta.multiply(world)));
    }
  }
  function pose(t, {walk=0, offer=0, wave=0, gaze=0} = {}) {
    for (const [b,q] of rest) b.quaternion.copy(q);
    rotate('J_Bip_L_UpperArm',.04,0,1.24); rotate('J_Bip_R_UpperArm',.04,0,-1.24);
    rotate('J_Bip_L_LowerArm',0,-.13,.12); rotate('J_Bip_R_LowerArm',0,.13,-.12);
    rotate('J_Bip_L_UpperLeg',0,0,-.025); rotate('J_Bip_R_UpperLeg',0,0,.025);
    const sway=Math.sin(t*1.37), lift=(1-Math.cos(t*1.9))*.5;
    rotate('J_Bip_C_Chest',Math.sin(t*1.8)*.028,offer*.055*sway,offer*.055*sway);
    rotate('J_Bip_C_Head',offer*(.13*Math.cos(t*1.9)-.05),Math.sin(t*.6)*.07 + gaze*.32,offer*(.04+.055*Math.sin(t*1.37-.35)));
    const phase=t*Math.PI*2/1.6;
    for (const [side,offset] of [['L',0],['R',Math.PI]]) {
      const stride=Math.sin(phase+offset),lift=Math.max(0,-stride);
      rotate(`J_Bip_${side}_UpperLeg`,-.22*stride*walk);
      rotate(`J_Bip_${side}_LowerLeg`,.38*lift*walk);
      rotate(`J_Bip_${side}_Foot`,(-.16*lift+.08*stride)*walk);
      rotate(`J_Bip_${side}_UpperArm`,.16*stride*walk);
    }
    if (offer>0) {
      const before = new Map([...bones].filter(([n]) => /Arm|Hand/.test(n)).map(([,b]) => [b,b.quaternion.clone()]));
      const x=.045*sway,y=1.1+.12*lift,z=.26+.085*lift;
      reach('L',new T.Vector3(x-.215,y,z)); reach('R',new T.Vector3(x+.215,y,z));
      for (const [b,q] of before) b.quaternion.slerpQuaternions(q,b.quaternion.clone(),offer);
    }
    if (wave>0) {
      const before = ['UpperArm','LowerArm'].map(n => bones.get(`J_Bip_R_${n}`)).map(b => [b,b.quaternion.clone()]);
      reach('R',new T.Vector3(.40+Math.sin(t*13)*.035,1.65,.22));
      for (const [b,q] of before) b.quaternion.slerpQuaternions(q,b.quaternion.clone(),wave);
      rotate('J_Bip_R_Hand',0,0,Math.sin(t*13)*.32*wave);
    }
    root.updateMatrixWorld(true);
    for (const mesh of meshes) mesh.skeleton.update();
  }
  return {root,bones,meshes,pose};
}

export function lightScene(scene) {
  scene.add(new T.HemisphereLight(0xffffff,0xa8bbd1,2.3));
  const key=new T.DirectionalLight(0xffffff,2.1);key.position.set(-2,4,4);scene.add(key);
  const fill=new T.DirectionalLight(0xc5e6f2,.7);fill.position.set(2,2,-3);scene.add(fill);
}
