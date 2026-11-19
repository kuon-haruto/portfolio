// Independently re-read the real Unity YAML, intercepting ALL extractor writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createRequire}=require('node:module'),{spawnSync}=require('node:child_process');
const {chromium}=require('../../node_modules/playwright');
const extractor=path.resolve(__dirname,'../vlink-companion/extract-ame.cjs'),reads=new Set();let original;
const io={...fs,readFileSync(p,...args){reads.add(String(p));return fs.readFileSync(p,...args);},mkdirSync(){},copyFileSync(source,dest){assert.deepEqual(fs.readFileSync(source),fs.readFileSync(dest));},writeFileSync(p,data){assert.equal(path.basename(p),'ame.json');original=JSON.parse(data);}};
vm.runInNewContext(fs.readFileSync(extractor,'utf8'),{require:n=>n==='node:fs'?io:createRequire(extractor)(n),__dirname:path.dirname(extractor),Buffer,console:{log(){}}},{filename:extractor});
const web=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../vlink-companion/assets/ame.json'),'utf8'));
assert.deepEqual(original,web);
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const report={sourcePrefab:'D:/Vlink/Assets/TechC/VBattle/Models/Character/Ame/Ame_liltoon.prefab',sourceMeshes:[...reads].filter(p=>p.endsWith('.asset')&&p.includes('Meshes')),sourceHash:digest(original),webHash:digest(web),exactMatch:true,meshes:original.meshes.map(m=>({name:m.name,vertices:m.position.length/3,triangles:m.indices.length/3})),method:'Fresh read-only Unity YAML extraction, all source extraction writes intercepted. Full JSON deep equality and texture byte equality checked.',limitations:['Source is the prefab-referenced baked Unity Mesh assets, not a recovered .vrm or character FBX.','Both panels use the same Three.js MeshStandardMaterial and source main textures. This is NOT an original Unity/lilToon shader comparison.','Original lilToon outlines, shader effects, blendshape expressions, spring-bone physics and original animation clips are not reproduced. Gait and presentation pose are authored for this prototype.']};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:960,height:640}});
  await page.route('**/live-ame-source.json',route=>route.fulfill({json:original}));
  await page.goto('http://127.0.0.1:4177/launcher/test-output/title-home-review/live-ame-comparison.html');
  await page.waitForFunction(()=>window.comparisonReady,{timeout:60000});
  const data=await page.evaluate(()=>window.recordComparison());
  const webm=path.join(__dirname,'live-ame-comparison.webm'),mp4=path.join(__dirname,'live-ame-comparison.mp4');
  fs.writeFileSync(webm,Buffer.from(data,'base64'));
  const result=spawnSync('ffmpeg',['-y','-i',webm,'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',mp4],{encoding:'utf8',windowsHide:true});
  if(result.status!==0)throw Error(result.stderr);
  const probe=spawnSync('ffprobe',['-v','error','-show_entries','stream=width,height,nb_frames:format=duration','-of','json',mp4],{encoding:'utf8',windowsHide:true});
  if(probe.status!==0)throw Error(probe.stderr);report.video=JSON.parse(probe.stdout);assert(Number(report.video.format.duration)>=5.9);
  await page.screenshot({path:path.join(__dirname,'live-ame-comparison.png')});
  fs.unlinkSync(webm);fs.writeFileSync(path.join(__dirname,'live-ame-source-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
