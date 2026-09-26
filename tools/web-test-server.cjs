const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4', '.unityweb': 'application/octet-stream' };

function createServer() {
  return http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { response.writeHead(400).end(); return; }
    // This test server only exposes the new Web players and their image assets.
    if (!/^\/(play|files)\//.test(pathname)) { response.writeHead(404).end(); return; }
    let file = path.resolve(root, '.' + pathname);
    const allowed = ['play', 'files'].some(folder => file === path.join(root, folder) || file.startsWith(path.join(root, folder) + path.sep));
    if (!allowed) { response.writeHead(403).end(); return; }
    try {
      if (fs.statSync(file).isDirectory()) {
        if (!pathname.endsWith('/')) { response.writeHead(302, { Location: pathname + '/' }).end(); return; }
        file = path.join(file, 'index.html');
      }
      const stat = fs.statSync(file);
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache' });
      fs.createReadStream(file).pipe(response);
    } catch { response.writeHead(404).end(); }
  });
}
module.exports = { createServer };
if (require.main === module) {
  const server = createServer();
  server.listen(Number(process.env.PORT || 0), '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}/play/`));
}
