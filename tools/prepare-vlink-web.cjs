const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const project = path.resolve(process.argv[2] || '');
const expected = path.resolve(os.tmpdir(), 'portfolio-web-builds/sources/v-link-battle');
if (project.toLowerCase() !== expected.toLowerCase()) throw new Error('V-Link adaptations are restricted to the isolated build copy.');
const commit = 'f880cf1582ccda1e9aae945cea72e2a5159514f5';
const git = (...args) => execFileSync('git', ['-C', project, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 ** 2 });
if (git('rev-parse', 'HEAD').trim() !== commit) throw new Error('Unexpected V-Link source revision.');
const record = path.join(project, '.portfolio-web-overrides.json');
const previous = fs.existsSync(record) ? JSON.parse(fs.readFileSync(record, 'utf8')) : {};
const hashes = {};
const normalize = text => text.replace(/\r\n/g, '\n');
const hash = text => createHash('sha256').update(normalize(text)).digest('hex');
const original = file => normalize(git('show', `HEAD:${file}`));
function write(file, content) {
  const destination = path.join(project, file);
  if (fs.existsSync(destination)) {
    const current = hash(fs.readFileSync(destination, 'utf8'));
    let source;
    try { source = hash(original(file)); } catch { source = undefined; }
    if (current !== source && current !== previous[file]) throw new Error(`Unrecognized local edit in build copy: ${file}`);
    if (current === hash(content)) { hashes[file] = current; return; }
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
  hashes[file] = hash(content);
}
function replaceOnce(text, from, to) {
  if (text.split(from).length !== 2) throw new Error(`Source contract changed: ${from}`);
  return text.replace(from, to);
}
const scripts = 'Assets/TechC/VBattle/Scripts/';
write('Assets/PortfolioWebGenerated/SelectionUnlit.shader', fs.readFileSync(path.join(__dirname, 'vlink-web/SelectionUnlit.shader'), 'utf8'));
const windowRoot = scripts + 'Core/Window/';
for (const name of ['BrowserWindowSurface', 'WindowClassManager', 'DrawWindowUtility', 'WebWindow', 'IconManager']) {
  const file = name === 'IconManager' ? scripts + 'Core/Managers/' + name + '.cs' : windowRoot + name + '.cs';
  write(file, fs.readFileSync(path.join(__dirname, 'vlink-web', name + '.cs'), 'utf8'));
}
const utility = original(windowRoot + 'WindowUtility.cs');
const animation = utility.indexOf('        #region アニメーション用メソッド');
if (animation < 0) throw new Error('Original window animation methods not found.');
write(windowRoot + 'WindowUtility.cs', fs.readFileSync(path.join(__dirname, 'vlink-web/WindowUtility.prefix.cs.txt'), 'utf8') + utility.slice(animation));
for (const file of ['Core/Managers/WindowManager.cs', 'InGame/Gimmick/Tab/BaseTab.cs']) {
  write(scripts + file, original(scripts + file).replaceAll('PInvoke.GetWindowRect(', 'WindowUtility.GetWindowRect('));
}
const pointerFile = scripts + 'Select/GamepadPointer.cs';
let pointer = original(pointerFile);
pointer = replaceOnce(pointer, '            PInvoke.GetCursorPos(out var originalPos);', '#if !UNITY_WEBGL\n            PInvoke.GetCursorPos(out var originalPos);');
pointer = replaceOnce(pointer, '            PInvoke.SetCursorPos(originalPos.X, originalPos.Y);', '            PInvoke.SetCursorPos(originalPos.X, originalPos.Y);\n#endif');
pointer = replaceOnce(pointer, '                int style = PInvoke.GetWindowLong', '#if !UNITY_WEBGL\n                int style = PInvoke.GetWindowLong');
pointer = replaceOnce(pointer, '                PInvoke.SetWindowLong((HWND)w.Hwnd, WINDOW_LONG_PTR_INDEX.GWL_EXSTYLE, exStyle);', '                PInvoke.SetWindowLong((HWND)w.Hwnd, WINDOW_LONG_PTR_INDEX.GWL_EXSTYLE, exStyle);\n#endif');
write(pointerFile, pointer);
const viewFile = scripts + 'Core/Utility/GameViewUtils.cs';
write(viewFile, original(viewFile).replace('using UnityEditor;', '#if UNITY_EDITOR\nusing UnityEditor;\n#endif').replaceAll('Screen.mainWindowPosition.x', '0').replaceAll('Screen.mainWindowPosition.y', '0'));
// Preserve the user's current local attack-timing edit without changing their checkout.
const attack = 'Assets/TechC/VBattle/Data/Ame/Weak/Ame_Neutral_W.asset';
write(attack, replaceOnce(original(attack), '  hitTiming: 0.1', '  hitTiming: 0'));
fs.writeFileSync(record, JSON.stringify(hashes, null, 2));
console.log(`Prepared ${Object.keys(hashes).length} V-Link Web adaptations in isolated copy.`);
