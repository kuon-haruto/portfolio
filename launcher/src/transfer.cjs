const fs = require('node:fs');
const fsp = require('node:fs/promises');
const https = require('node:https');
const crypto = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

function trustedUrl(value, hosts) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !hosts.includes(url.hostname)) {
    throw new Error('配布元として許可されていないURLです。');
  }
  return url;
}
function response(url, hosts, signal, redirects = 0) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = trustedUrl(url, hosts); } catch (error) { reject(error); return; }
    const request = https.get(parsed, { signal, headers: { 'User-Agent': 'ZentaGameLibrary', 'Accept-Encoding': 'identity' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.resume();
        if (redirects >= 5 || !res.headers.location) return reject(new Error('Too many redirects'));
        response(new URL(res.headers.location, parsed).href, hosts, signal, redirects + 1).then(resolve, reject);
      } else if (res.statusCode !== 200) {
        res.resume();
        const error = new Error('配布サーバーの応答: HTTP ' + res.statusCode);
        error.code = 'HTTP_' + res.statusCode;
        reject(error);
      } else resolve(res);
    });
    request.setTimeout(30000, () => request.destroy(new Error('通信がタイムアウトしました。')));
    request.on('error', reject);
  });
}
async function readJson(url, hosts, signal) {
  const stream = await response(url, hosts, signal);
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > 1024 * 1024) { stream.destroy(); throw new Error('Catalog too large'); }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function copyVerified(source, destination, pkg, hosts, signal, progress = () => {}) {
  const output = await fsp.open(destination, 'wx');
  let size = 0;
  const hash = crypto.createHash('sha256');
  const meter = new Transform({
    transform(chunk, encoding, callback) {
      size += chunk.length;
      if (size > pkg.size) return callback(new Error('配布ファイルのサイズが一致しません。'));
      hash.update(chunk);
      progress({ bytes: size, total: pkg.size });
      callback(null, chunk);
    },
  });
  try {
    const input = source.url ? await response(source.url, hosts, signal) : fs.createReadStream(source.file);
    await pipeline(input, meter, output.createWriteStream(), { signal });
    if (size !== pkg.size || hash.digest('hex') !== pkg.sha256) throw new Error('ファイルの検証に失敗しました。再取得してください。');
  } catch (error) {
    await output.close();
    await fsp.rm(destination, { force: true });
    throw error;
  } finally { await output.close(); }
}
module.exports = { trustedUrl, readJson, copyVerified };
