const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const { pipeline } = require('node:stream/promises');
const { validateCatalog } = require('../src/catalog.cjs');
const { verifyFile } = require('./fetch-games.cjs');
const repository = 'kuon-haruto/portfolio';

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'Git command failed');
  return result.stdout.trim();
}
function credential() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  const result = spawnSync('git', ['-c', 'credential.interactive=false', 'credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
  });
  if (result.status !== 0) throw new Error('GitHub authentication is unavailable. Sign in with Git Credential Manager or provide GH_TOKEN in the environment.');
  const fields = Object.fromEntries(result.stdout.trim().split(/\r?\n/).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
  if (!fields.password) throw new Error('GitHub credential missing');
  return fields.password;
}
async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return 'sha256:' + hash.digest('hex');
}
async function main() {
  const { values } = parseArgs({ options: { draft: { type: 'boolean' }, publish: { type: 'boolean' } } });
  if (Boolean(values.draft) === Boolean(values.publish)) throw new Error('Choose exactly one: --draft or --publish');
  const root = path.join(__dirname, '..');
  const repoRoot = path.join(root, '..');
  const appVersion = require('../package.json').version;
  const tag = 'launcher-v' + appVersion;
  const output = path.join(root, 'artifacts', tag);
  const catalog = validateCatalog(JSON.parse(await fs.readFile(path.join(output, 'games.json'), 'utf8')));
  const files = ['games.json', 'game-sources.json', ...catalog.games.map(game => game.package.bundled)].map(name => path.join(output, name));
  files.push(...[`ZentaGameLibrary-Setup-${appVersion}.exe`, `ZentaGameLibrary-Setup-${appVersion}.exe.blockmap`, 'latest.yml'].map(name => path.join(root, 'dist', name)));
  for (const file of files) if (!(await fs.stat(file)).isFile()) throw new Error('Release file missing: ' + file);
  for (const game of catalog.games) {
    if (!await verifyFile(path.join(output, game.package.bundled), game.package)) throw new Error('Package checksum mismatch: ' + game.id);
  }
  if (git(['status', '--porcelain', '--untracked-files=all', '--', 'launcher', '.github/workflows/launcher-build.yml'], repoRoot)) throw new Error('Commit launcher and workflow changes before publishing.');
  const commit = git(['rev-parse', 'HEAD'], repoRoot);
  const token = credential();
  const headers = { Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'ZentaGameLibraryRelease', Accept: 'application/vnd.github+json' };
  async function api(endpoint, method = 'GET', body) {
    const response = await fetch('https://api.github.com/repos/' + repository + endpoint, {
      method, headers: { ...headers, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body), signal: AbortSignal.timeout(60000),
    });
    if (response.status === 404 && method === 'GET') return null;
    const data = await response.json();
    if (!response.ok) throw new Error('GitHub HTTP ' + response.status + ': ' + data.message);
    return data;
  }
  const remote = await api('/commits/' + commit);
  if (!remote) throw new Error('Push the source commit before creating its release.');
  let release = await api('/releases/tags/' + tag);
  if (!release) {
    release = await api('/releases', 'POST', {
      tag_name: tag, target_commitish: commit, name: 'Zenta Game Library ' + appVersion, draft: true, prerelease: false,
      body: '## Windows版\n\n`ZentaGameLibrary-Setup-' + appVersion + '.exe` をインストールしてください。UnityやNode.jsは不要です。\n\n### 収録作品\n- 線のこちら側 / 向こう側\n- 反転暗殺\n- てるてるウォーズ\n- 双子\n- V-Link Battle\n\n作品説明・操作方法・目的・制作情報、ゲームとランチャー本体の更新機能を収録しています。ゲーム一式を同梱しているため、初回はオフラインでも起動できます。\n\nこのビルドは未署名です。ゲームZIPはランチャー・開発者向けで、通常はインストーラーのみ必要です。\n\nSource: `' + commit + '`',
    });
  }
  if (!release.draft) throw new Error('This version is already public. Published releases are immutable; increase the version.');
  for (const file of files) {
    const name = path.basename(file), size = (await fs.stat(file)).size;
    const digest = await sha256(file);
    const existing = release.assets.find(asset => asset.name === name);
    if (existing) {
      if (existing.size !== size || existing.digest !== digest) throw new Error('Draft asset differs; review it before retrying: ' + name);
      console.log('Already uploaded: ' + name); continue;
    }
    console.log('Uploading: ' + name + ' (' + (size / 1024 ** 2).toFixed(1) + ' MB)');
    const asset = await new Promise((resolve, reject) => {
      const request = https.request('https://uploads.github.com/repos/' + repository + '/releases/' + release.id + '/assets?name=' + encodeURIComponent(name), {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream', 'Content-Length': size }, signal: AbortSignal.timeout(30 * 60 * 1000),
      }, async response => {
        try {
          const chunks = [];
          for await (const chunk of response) chunks.push(chunk);
          const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (response.statusCode !== 201) throw new Error('Upload HTTP ' + response.statusCode + ': ' + result.message);
          resolve(result);
        } catch (error) { reject(error); }
      });
      request.on('error', reject);
      pipeline(createReadStream(file), request).catch(reject);
    });
    if (asset.size !== size || asset.digest !== digest) throw new Error('Uploaded asset integrity mismatch: ' + name);
    release.assets.push(asset);
  }
  if (values.publish) release = await api('/releases/' + release.id, 'PATCH', { draft: false, prerelease: false, make_latest: 'true' });
  console.log((release.draft ? 'Draft: ' : 'Published: ') + release.html_url);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
