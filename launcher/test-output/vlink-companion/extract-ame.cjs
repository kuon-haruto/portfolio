// Read-only Unity YAML extraction. Source assets are never modified.
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('../../node_modules/js-yaml');
const source = 'D:/Vlink/Assets/TechC/VBattle/Models/Character/Ame';
const out = path.join(__dirname, 'assets');
fs.mkdirSync(out, {recursive:true});
function parse(s) { return yaml.load(s.replace(/fileID: (-?\d+)/g, 'fileID: "$1"')); }
function asset(p) { return parse(fs.readFileSync(p,'utf8').replace(/^%.*\r?\n/gm,'').replace(/^--- !u!.*$/gm,'')); }
const files = fs.readdirSync(source,{recursive:true}).map(p=>path.join(source,p));
const guids = new Map();
for(const p of files.filter(p=>p.endsWith('.meta'))) {
 const g=fs.readFileSync(p,'utf8').match(/^guid: (\w+)/m); if(g) guids.set(g[1],p.slice(0,-5));
}
const docs = new Map();
const prefab = fs.readFileSync(path.join(source,'Ame_liltoon.prefab'),'utf8');
for(const match of prefab.matchAll(/^--- !u!\d+ &(\d+)\r?\n([\s\S]*?)(?=^--- !u!|$(?![\s\S]))/gm)) docs.set(match[1],parse(match[2]));
const nodes=[];
for(const [id,d] of docs) if(d.Transform) {
 const t=d.Transform;
 nodes.push({id,name:docs.get(t.m_GameObject.fileID)?.GameObject.m_Name,parent:t.m_Father.fileID,p:Object.values(t.m_LocalPosition),q:Object.values(t.m_LocalRotation),s:Object.values(t.m_LocalScale)});
}
const materials={};
function material(guid) {
 if(materials[guid]) return guid;
 const p=guids.get(guid); const m=asset(p).Material;
 const tex=m.m_SavedProperties.m_TexEnvs.find(x=>x._MainTex)?._MainTex.m_Texture.guid;
 let url=null;
 if(tex && guids.has(tex)){url=tex+path.extname(guids.get(tex));fs.copyFileSync(guids.get(tex),path.join(out,url));}
 materials[guid]={name:m.m_Name,map:url}; return guid;
}
const meshes=[];
for(const d of docs.values()) if(d.SkinnedMeshRenderer) {
 const r=d.SkinnedMeshRenderer;const p=guids.get(r.m_Mesh.guid); if(!p) throw Error('Missing mesh');
 const m=asset(p).Mesh, v=m.m_VertexData, raw=Buffer.from(v._typelessdata,'hex');
 const sizes=[4,2,1,1,2,2,1,1,2,2,4,4];
 const strides={};for(const c of v.m_Channels) if(c.dimension) strides[c.stream]=Math.max(strides[c.stream]||0,c.offset+sizes[c.format]*c.dimension);
 const starts={};let offset=0;for(const [s,stride] of Object.entries(strides)){starts[s]=offset;offset=Math.ceil((offset+stride*v.m_VertexCount)/16)*16;}
 function channel(n){const c=v.m_Channels[n];if(!c?.dimension)return null;const a=[];for(let i=0;i<v.m_VertexCount;i++)for(let k=0;k<c.dimension;k++){const o=starts[c.stream]+i*strides[c.stream]+c.offset+k*sizes[c.format];a.push(c.format===0?raw.readFloatLE(o):c.format===8?raw.readUInt16LE(o):(()=>{throw Error('Unsupported format '+c.format)})());}return a;}
 const ib=Buffer.from(m.m_IndexBuffer,'hex'), is=m.m_IndexFormat?4:2, indices=[];
 for(let i=0;i<ib.length;i+=is)indices.push(is===4?ib.readUInt32LE(i):ib.readUInt16LE(i));
 const node=nodes.find(n=>docs.get(n.id).Transform.m_GameObject.fileID===r.m_GameObject.fileID);
 meshes.push({name:m.m_Name,node:node.id,position:channel(0),normal:channel(1),uv:channel(4),skinWeight:channel(12),skinIndex:channel(13),indices,groups:m.m_SubMeshes.map((s,i)=>({start:s.firstByte/is,count:s.indexCount,materialIndex:i})),bones:r.m_Bones.map(b=>b.fileID),bind:m.m_BindPose.map(b=>Array.from({length:16},(_,i)=>b['e'+i%4+Math.floor(i/4)])),materials:r.m_Materials.map(x=>material(x.guid))});
}
fs.writeFileSync(path.join(out,'ame.json'),JSON.stringify({nodes,meshes,materials}));
console.log(JSON.stringify({nodes:nodes.length,meshes:meshes.map(m=>({name:m.name,vertices:m.position.length/3,bones:m.bones.length})),materials:Object.values(materials)},null,2));
