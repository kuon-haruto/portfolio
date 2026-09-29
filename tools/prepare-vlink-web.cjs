const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
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
    if (current === hash(content)) { hashes[file] = current; return; }
    let source;
    try { source = hash(original(file)); } catch { source = undefined; }
    if (current !== source && current !== previous[file]) throw new Error(`Unrecognized local edit in build copy: ${file}`);
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
write('Assets/PortfolioWebGenerated/WebIce.shader', fs.readFileSync(path.join(__dirname, 'vlink-web/WebIce.shader'), 'utf8'));
write('Assets/PortfolioWebGenerated/WebIceBlast.shader', fs.readFileSync(path.join(__dirname, 'vlink-web/WebIceBlast.shader'), 'utf8'));
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
if (process.argv.includes('--webgpu')) {
  for (const name of ['PortfolioFurRenderer.cs', 'PortfolioFurVertex.hlsl', 'FUR-LICENSE.txt']) {
    write('Assets/PortfolioWebGenerated/' + name, fs.readFileSync(path.join(__dirname, 'vlink-web', name), 'utf8'));
  }
  write('Assets/Editor/PortfolioFurReference.cs', fs.readFileSync(path.join(__dirname, 'vlink-web/PortfolioFurReference.cs'), 'utf8'));
  write('Assets/Editor/PortfolioFurBuild.cs', fs.readFileSync(path.join(__dirname, 'vlink-web/PortfolioFurBuild.cs'), 'utf8'));
  write('Assets/PortfolioDiagnostics/PortfolioFurDiagnostic.cs', fs.readFileSync(path.join(__dirname, 'vlink-web/PortfolioFurDiagnostic.cs'), 'utf8'));
  const manifestPath = 'Packages/manifest.json';
  const manifest = JSON.parse(original(manifestPath));
  Object.assign(manifest.dependencies, {
    'com.unity.cinemachine': '2.10.7', 'com.unity.collab-proxy': '2.12.4',
    'com.unity.ide.rider': '3.0.40', 'com.unity.ide.visualstudio': '2.0.26',
    'com.unity.inputsystem': '1.19.0', 'com.unity.multiplayer.center': '1.0.1',
    'com.unity.render-pipelines.universal': '17.3.0', 'com.unity.test-framework': '1.6.0',
    'com.unity.timeline': '1.8.12', 'com.unity.ugui': '2.0.0',
    'com.unity.visualeffectgraph': '17.3.0', 'com.unity.visualscripting': '1.9.11',
    'com.unity.modules.accessibility': '1.0.0', 'com.unity.modules.adaptiveperformance': '1.0.0',
    'com.unity.modules.vectorgraphics': '1.0.0',
  });
  delete manifest.dependencies['com.unity.textmeshpro'];
  manifest.dependencies = Object.fromEntries(Object.entries(manifest.dependencies).sort(([a], [b]) => a.localeCompare(b)));
  const currentManifest = fs.readFileSync(path.join(project, manifestPath), 'utf8');
  // Unity groups built-in modules last; equivalent JSON needs no rewrite.
  write(manifestPath, isDeepStrictEqual(JSON.parse(currentManifest), manifest)
    ? currentManifest : JSON.stringify(manifest, null, 2) + '\n');
  {
    // TMP now ships with uGUI; its shaders must match the upgraded mesh UV layout.
    // Import only official shader resources, leaving custom fonts/settings untouched.
    const editorOption = process.argv.find(arg => arg.startsWith('--unity-editor='));
    let uiPackage;
    if (editorOption) {
      uiPackage = path.join(path.dirname(path.resolve(editorOption.slice('--unity-editor='.length))),
        'Data/Resources/PackageManager/BuiltInPackages/com.unity.ugui');
    } else {
      const cache = path.join(project, 'Library/PackageCache');
      const folders = fs.existsSync(cache) ? fs.readdirSync(cache) : [];
      const folder = folders.filter(name => name.startsWith('com.unity.ugui@'))
        .find(name => JSON.parse(fs.readFileSync(path.join(cache, name, 'package.json'), 'utf8')).version === '2.0.0');
      if (folder) uiPackage = path.join(cache, folder);
    }
    if (!uiPackage || JSON.parse(fs.readFileSync(path.join(uiPackage, 'package.json'), 'utf8')).version !== '2.0.0')
      throw new Error('Pass --unity-editor=<Unity 6 editor executable> to prepare official TMP resources before the first import.');
    const resources = path.join(uiPackage, 'Package Resources/TMP Essential Resources.unitypackage');
    const tar = (...args) => execFileSync('tar', args, { encoding: 'utf8', maxBuffer: 4 * 1024 ** 2 });
    const entries = tar('-tzf', resources).split(/\r?\n/).filter(name => name.endsWith('/pathname'));
    let upgradedShaders = 0;
    const settingsPath = 'Assets/TextMesh Pro/Resources/TMP Settings.asset';
    let settingsVersion;
    for (const entry of entries) {
      const file = tar('-xOzf', resources, entry).trim().replaceAll('\\', '/');
      if (file === settingsPath) {
        const settings = normalize(tar('-xOzf', resources, entry.replace(/pathname$/, 'asset')));
        const versions = [...settings.matchAll(/^  assetVersion: (\d+)$/gm)];
        if (versions.length !== 1) throw new Error('Official TMP settings version is missing or ambiguous.');
        settingsVersion = versions[0][1];
      }
      if (!/^Assets\/TextMesh Pro\/Shaders\/[^/]+\.(shader|cginc|hlsl)$/.test(file)) continue;
      if (!fs.existsSync(path.join(project, file))) continue;
      const source = entry.slice(0, -'pathname'.length);
      const officialMeta = tar('-xOzf', resources, source + 'asset.meta');
      const localMeta = fs.readFileSync(path.join(project, file + '.meta'), 'utf8');
      const guid = text => /^guid: ([a-f0-9]{32})$/m.exec(normalize(text))?.[1];
      if (!guid(officialMeta) || guid(officialMeta) !== guid(localMeta)) throw new Error('TMP shader GUID mismatch: ' + file);
      write(file, tar('-xOzf', resources, source + 'asset'));
      upgradedShaders++;
    }
    if (upgradedShaders < 10) throw new Error('Official TMP shader resources are incomplete.');
    if (!settingsVersion) throw new Error('Official TMP settings resource is missing.');
    // TMP's own import callback restores custom settings and marks this same
    // version. Do so only after shader import succeeds, before starting Unity:
    // otherwise its delayed importer window repeatedly steals desktop focus.
    const settings = original(settingsPath);
    if (/^  assetVersion:/m.test(settings)) throw new Error('Review the source TMP settings migration.');
    write(settingsPath, replaceOnce(settings, '  m_Name: TMP Settings\n',
      `  m_Name: TMP Settings\n  assetVersion: ${settingsVersion}\n`));
    console.log('Updated official TMP shader resources: ' + upgradedShaders);
  }
  const autoLoaderPath = scripts + 'Core/Managers/ManagerSceneAutoLoader.cs';
  const initializer = '        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]';
  write(autoLoaderPath, replaceOnce(original(autoLoaderPath), initializer,
    '#if !PORTFOLIO_VFX_DIAGNOSTIC\n' + initializer + '\n#endif'));
  const importerPath = 'Packages/jp.lilxyzw.liltoon/Editor/lilShaderContainerImporter.cs';
  let importer = original(importerPath);
  importer = replaceOnce(importer,
    '            AddHLSLDependency(assetFolderPath, ctx);\n\n            return sb.ToString();',
    '            AddHLSLDependency(assetFolderPath, ctx);\n\n#if UNITY_6000_3_OR_NEWER\n            return PortfolioUniqueSkipVariants(sb.ToString());\n#else\n            return sb.ToString();\n#endif');
  importer = replaceOnce(importer, '        public static string UnpackContainer(string assetPath, AssetImportContext ctx = null)',
    fs.readFileSync(path.join(__dirname, 'vlink-web/DeduplicateSkipVariants.cs.txt'), 'utf8') + '\n        public static string UnpackContainer(string assetPath, AssetImportContext ctx = null)');
  write(importerPath, importer);
  const urpPath = 'Packages/jp.lilxyzw.liltoon/Shader/Includes/lil_pipeline_urp.hlsl';
  write(urpPath, replaceOnce(original(urpPath),
    '#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"',
    '// Unity WebGPU also parses shared lighting for disabled reflection variants.\n' +
    '#if defined(SHADER_API_WEBGPU)\n' +
    '    #ifndef _REFLECTION_PROBE_BOX_PROJECTION\n        #define _REFLECTION_PROBE_BOX_PROJECTION 0\n    #endif\n' +
    '    #ifndef _REFLECTION_PROBE_BLENDING\n        #define _REFLECTION_PROBE_BLENDING 0\n    #endif\n' +
    '#endif\n#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"'));
  const motionPath = 'Packages/jp.lilxyzw.liltoon/Shader/Includes/lil_pass_motionvectors.hlsl';
  write(motionPath, replaceOnce(original(motionPath), '#include "lil_common_appdata.hlsl"',
    '// WebGPU has no geometry stage; retain motion vectors for the base surface.\n' +
    '#if defined(SHADER_API_WEBGPU) && defined(LIL_FUR)\n    #undef LIL_FUR\n#endif\n' +
    '#include "lil_common_appdata.hlsl"'));
}
fs.writeFileSync(record, JSON.stringify(hashes, null, 2));
console.log(`Prepared ${Object.keys(hashes).length} V-Link Web adaptations in isolated copy.`);
