const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.pdf':'application/pdf','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 try {
  const url=new URL(req.url,'http://127.0.0.1');
  const p=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!p.startsWith(root+path.sep)||req.method!=='GET'){res.writeHead(403).end();return;}
  const file=fs.statSync(p).isDirectory()?path.join(p,'index.html'):p;
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
  fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(404).end('Not found');}
});
let port=Number(process.env.PORT||4177);
server.on('error',e=>{if(e.code==='EADDRINUSE')server.listen(++port,'127.0.0.1');else throw e;});
server.listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${server.address().port}/launcher/test-output/vlink-companion/`));
