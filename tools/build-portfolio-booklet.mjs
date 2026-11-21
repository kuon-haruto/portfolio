import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = process.env.CODEX_RUNTIME || 'C:/Users/shima/.cache/codex-runtimes/codex-primary-runtime/dependencies';
process.env.RUNTIME_NODE_MODULES ||= path.join(runtime, 'node/node_modules');
const skillRoot = path.join(os.homedir(), '.codex/plugins/cache/openai-primary-runtime/presentations');
async function findPresentationSkill() {
  if (process.env.PRESENTATIONS_SKILL) return process.env.PRESENTATIONS_SKILL;
  const versions = (await fs.readdir(skillRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory()).map(entry => entry.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const version of versions) {
    const directory = path.join(skillRoot, version, 'skills/presentations');
    try { await fs.access(path.join(directory, 'container_tools/artifact_tool_utils.mjs')); return directory; }
    catch { /* Skip incomplete plugin installs. */ }
  }
  throw new Error('Presentation helpers not found. Set PRESENTATIONS_SKILL to the installed skill directory.');
}
const skill = await findPresentationSkill();
const { Presentation, PresentationFile } = await import(pathToFileURL(path.join(runtime, 'node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs')));
const sharp = createRequire(import.meta.url)(path.join(runtime, 'node/node_modules/sharp'));
const { finalizePresentation } = await import(pathToFileURL(path.join(skill, 'container_tools/artifact_tool_utils.mjs')));
const build = path.join(root, 'launcher/test-output/portfolio-booklet');
const output = path.join(root, 'documents/portfolio');
const python = path.join(runtime, 'python/python.exe');
const ffmpeg = process.env.FFMPEG || 'D:/FFmpeg/ffmpeg-master-latest-win64-gpl-shared/bin/ffmpeg.exe';
const poppler = path.join(runtime, 'native/poppler/Library/bin/pdftoppm.exe');
const base = 'https://kuon-haruto.github.io/portfolio/';
const appStore = 'https://apps.apple.com/jp/app/id6816609277';
const windowsVlink = 'https://github.com/kuon-haruto/portfolio/releases/download/launcher-v0.2.0/v-link-battle-1.0.0.zip';
const parkingSource = 'D:/すべる宇宙船/Assets/SlidingSpaceParking';
const font = 'Meiryo';
const C = { ink: '#182528', muted: '#58696C', blue: '#225DAD', teal: '#007C73', pink: '#B52B77', white: '#FFFFFF', light: '#EDF3F3', paper: '#F7F9F8', dark: '#141E20', lime: '#C6F36B', mint: '#72E2CF', rose: '#FF9ACD', rule: '#CFDAD8' };
const fontPolicy = { basis: 'design', families: [font] };

await fs.mkdir(build, { recursive: true });
await fs.mkdir(output, { recursive: true });

// Use real PNGs so viewers that cannot display Office SVGs keep the original colors.
const toolIcons = ['unity', 'visualstudiocode', 'git', 'microsoftpowerpoint', 'microsoftexcel', 'googlesheets', 'blender', 'unrealengine'];
for (const id of toolIcons) {
  try { await fs.access(path.join(root, `files/icons/${id}.png`)); }
  catch {
    await sharp(path.join(root, `files/icons/${id}.svg`), { density: 768 })
      .resize(256, 256).png().toFile(path.join(root, `files/icons/${id}.png`));
  }
}

function frame(source, name, seconds) {
  const target = path.join(build, name + '.jpg');
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(seconds), '-i', source, '-frames:v', '1', '-q:v', '3', target]);
  return target;
}
function pdfPage(source, name, page, crop = null) {
  const target = path.join(build, name);
  const cropArgs = crop ? ['-x', String(crop[0]), '-y', String(crop[1]), '-W', String(crop[2]), '-H', String(crop[3])] : [];
  execFileSync(poppler, ['-f', String(page), '-l', String(page), '-singlefile', '-scale-to', '1800', ...cropArgs, '-png', source, target]);
  return target + '.png';
}
const media = {
  cover: frame(path.join(root, 'files/Vlinkvideo.mp4'), 'cover-vlink', 27),
  appeal: path.join(root, 'documents/proposals/assets/vlink-battle.jpg'),
  comments: path.join(root, 'documents/proposals/assets/vlink-comments.jpg'),
  selection: path.join(root, 'documents/proposals/assets/vlink-selection.jpg'),
  parking: path.join(root, 'files/images/sliding-space-parking-store-gameplay.jpg'),
  spec: pdfPage(path.join(root, 'files/futago_spec.pdf'), 'futago-spec', 3, [65, 300, 1140, 380]),
  dungeon: pdfPage(path.join(root, 'files/FiveMinuteDungeon.pdf'), 'dungeon-cover', 1),
  seibutsu: pdfPage(path.join(root, 'files/seibutsu-master.pdf'), 'seibutsu-cover', 1),
};
const battleSequence = [[27, '対峙'], [29, '攻撃エフェクト'], [31, '相手が後退']];
media.battleSequence = battleSequence.map(([second]) => frame(path.join(root, 'files/Vlinkvideo.mp4'), `vlink-sequence-${second}`, second));

const printHeight = 905;
const printTop = 70;
const presentation = Presentation.create({ slideSize: { width: 1280, height: printHeight } });
const slides = [];
const links = [];
const titles = [];
const contents = [];
const themes = new Map();

function band(slide, x, y, w, h, color, name = 'section divider') {
  return slide.shapes.add({ name, geometry: 'rect', position: { left: x, top: y + printTop, width: w, height: h }, fill: color, line: { fill: 'none', width: 0 } });
}

function sectionFor(number) {
  if (number <= 3) return 'PROFILE';
  if (number <= 6) return 'SELECTED WORK 01';
  if (number <= 10) return 'SELECTED WORK 02';
  if (number <= 17) return 'GAME WORKS';
  if (number <= 19) return 'PLANNING';
  return number === 20 ? 'SKILLS' : number === 21 ? 'LINKS' : 'CONTACT';
}

function text(slide, value, x, y, w, h, size = 24, options = {}) {
  const shape = slide.shapes.add({ name: options.name || value.slice(0, 28), geometry: 'textbox', position: { left: x, top: y + printTop, width: w, height: h }, fill: 'none', line: { fill: 'none', width: 0 } });
  shape.text = value;
  const theme = themes.get(slide);
  let color = options.color || (theme?.dark ? C.white : C.ink);
  if (!theme?.dark) color = ({ [C.lime]: C.teal, [C.mint]: C.teal, [C.rose]: C.pink })[color] || color;
  if (theme?.dark) color = ({ [C.muted]: '#AABBBE', [C.blue]: C.lime, [C.teal]: C.mint, [C.pink]: C.rose })[color] || color;
  shape.text.style = { typeface: font, fontSize: size, color, bold: Boolean(options.bold), insets: 0, autoFit: 'none', verticalAlignment: 'top', wrap: 'square', lineSpacing: 1.15, alignment: options.align || 'left' };
  return shape;
}
function link(slide, label, url, x, y, w, size = 20) {
  const shape = text(slide, label, x, y, w, 36, size, { color: C.blue });
  shape.text.get(label).link = { uri: url, isExternal: true };
  shape.text.get(label).color = themes.get(slide)?.dark ? C.lime : C.blue;
  links.push({ page: slides.indexOf(slide), x, y, width: w, height: 36, url });
}
async function image(slide, file, x, y, w, h, alt, options = {}) {
  const source = path.isAbsolute(file) ? file : path.join(root, file);
  const ext = path.extname(source).toLowerCase();
  const contentType = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  const blob = ext === '.svg' ? await fs.readFile(source) : await sharp(source)
    .resize({ width: Math.ceil(w * 1.5), height: Math.ceil(h * 1.5), fit: 'inside', withoutEnlargement: true })
    .toBuffer();
  return slide.images.add({ blob, contentType, alt, fit: options.fit || 'contain', position: { left: x, top: y + printTop, width: w, height: h }, ...(options.crop ? { crop: options.crop } : {}) });
}
async function printQr(slide, url, key, x, y) {
  const file = path.join(build, 'print-qr-' + key + '.png');
  execFileSync(python, ['-c', 'import sys; from PIL import Image, ImageDraw; from reportlab.graphics.barcode.qrencoder import QRCode,QRErrorCorrectLevel; q=QRCode(None,QRErrorCorrectLevel.M); q.addData(sys.argv[1]); q.make(); n=q.getModuleCount(); im=Image.new("RGB",((n+8)*12,)*2,"white"); d=ImageDraw.Draw(im); [d.rectangle(((x+4)*12,(y+4)*12,(x+5)*12-1,(y+5)*12-1),fill="black") for y in range(n) for x in range(n) if q.isDark(y,x)]; im.save(sys.argv[2])', url, file]);
  await image(slide, file, x, y, 120, 120, 'QR: ' + url);
}
function page(title, subtitle = '', color = C.blue) {
  const slide = presentation.slides.add();
  const number = slides.length + 1;
  const dark = false;
  const accent = number >= 4 && number <= 6 ? C.teal : number >= 7 && number <= 10 ? C.pink : color;
  themes.set(slide, { dark, accent });
  slide.background.fill = C.white;
  slides.push(slide);
  titles.push(title);
  text(slide, sectionFor(number), 64, 21, 600, 22, 14, { bold: true, color: accent });
  text(slide, 'GAME PLANNER', 920, 21, 296, 22, 14, { color: C.muted, align: 'right' });
  if (title) text(slide, title, 64, 54, 1152, 60, 38, { bold: true });
  if (subtitle) text(slide, subtitle, 64, 116, 1152, 32, 20, { color: C.muted });
  band(slide, 64, 157, 1152, 1, dark ? '#3A4B4D' : C.rule);
  band(slide, 64, 157, 92, 3, dark ? C.lime : accent);
  if (number === 5) band(slide, 0, 551, 1280, 118, '#E4EFEB', 'design takeaway');
  if (number === 10) {
    band(slide, 0, 176, 1280, 105, '#EDE9EF', 'platform rationale');
    band(slide, 640, 316, 1, 284, C.rule);
  }
  return slide;
}
function notes(slide, sources) { slide.speakerNotes.text = '出典\n' + sources.join('\n'); }
function label(slide, title, body, x, y, w, bodyHeight = 94, color = C.blue) {
  const theme = themes.get(slide);
  band(slide, x, y + 5, 3, 22, theme?.dark ? C.lime : color);
  text(slide, title, x + 14, y, w - 14, 36, 22, { bold: true, color });
  text(slide, body, x, y + 43, w, bodyHeight, 23, { bold: title === '私の担当' || title === '制作の分担' });
}
async function gameHeading(slide, id, title, y = 52) {
  const extensions = { 'hanten-assassination': 'jpeg' };
  await image(slide, `files/game-icons/${id}.${extensions[id] || 'png'}`, 64, y, 54, 54, title + 'のアイコン');
  text(slide, title, 138, y, 1078, 60, 42, { bold: true });
}
function gamePage(id, title, subtitle) {
  const slide = page('', subtitle);
  titles[titles.length - 1] = title;
  return slide;
}

// 目次と強みを入口にし、代表作で経験を具体的に伝える。
{
  const s = presentation.slides.add(); s.background.fill = C.white; themes.set(s, { dark: false, accent: C.teal }); slides.push(s); titles.push('ゲーム企画 ポートフォリオ');
  text(s, 'GAME PLANNER / 2028', 64, 61, 510, 30, 19, { color: C.lime, bold: true });
  text(s, '島本 善太', 64, 136, 500, 105, 64, { bold: true });
  text(s, 'ゲームプランナー志望', 64, 249, 510, 44, 28, { bold: true });
  text(s, '2028年卒業予定', 64, 301, 510, 31, 20, { color: C.muted });
  band(s, 64, 385, 432, 1, '#526366');
  text(s, '遊びのルールを考え、\n選んだ理由を仕様に残す。', 64, 424, 500, 110, 33, { bold: true });
  await image(s, 'files/images/sliding-space-parking-store-title.jpg', 580, 40, 636, 298, 'App Store公開作 すべる宇宙駐車場');
  text(s, '01  すべる宇宙駐車場', 580, 346, 636, 30, 24, { color: C.mint, bold: true });
  text(s, 'App Store公開', 580, 382, 636, 24, 18, { color: C.muted });
  await image(s, media.cover, 762, 424, 454, 217, 'V-Link Battleのゲーム画面');
  text(s, '02\nV-Link\nBattle', 580, 442, 170, 120, 27, { color: C.rose, bold: true });
  text(s, '神エボ1次審査通過', 762, 649, 454, 23, 17, { color: C.muted });
  notes(s, ['src/sections/about.html', 'files/Vlinkvideo.mp4', 'src/sections/featured-works.html', appStore]);
}
{
  const s = page('目次', '強み・制作作品・企画書と仕様書');
  await image(s, 'files/images/sliding-space-parking-store-gameplay.jpg', 64, 188, 390, 180, '代表作 すべる宇宙駐車場');
  text(s, '01  すべる宇宙駐車場', 64, 381, 400, 36, 22, { bold: true, color: C.teal });
  await image(s, media.appeal, 64, 433, 390, 219, '代表作 V-Link Battle');
  band(s, 64, 613, 390, 39, C.dark, 'V-Link caption');
  text(s, '02  V-Link Battle', 64, 621, 390, 31, 21, { bold: true, color: C.white });
  const entries = [
    ['私の強み', '私の強み'],
    ['代表作① すべる宇宙駐車場', 'すべる宇宙駐車場'],
    ['代表作② V-Link Battle', 'V-Link Battle'],
    ['その他の制作作品', '双子'],
    ['企画書・仕様書・構想中のアイデア', '企画書で広げる、遊びの切り口'],
    ['制作ツール・スキル', '企画を形にするための制作スキル'],
    ['作品索引・自己紹介', '作品索引'],
  ];
  for (const [i, [title, targetTitle]] of entries.entries()) {
    const y = 189 + i * 61;
    const displayTitle = title.replace('代表作① ', '').replace('代表作② ', '').replace('企画書・仕様書・構想中のアイデア', '企画書・仕様書・アイデア');
    text(s, displayTitle, 530, y, 590, 39, 24, { bold: true });
    band(s, 530, y + 46, 686, 1, C.rule);
    contents.push({ slide: s, targetTitle, y, x: 530, width: 686 });
  }
  text(s, '代表作から：P4 ／ 仕様を決めた実例から：P12「双子」', 530, 631, 686, 28, 18, { color: C.muted });
  notes(s, ['本資料の各作品紹介・企画書・仕様書・プロフィール']);
}
{
  const s = page('私の強み', 'ゲームプランナーを目指して、取り組んできたこと');
  const strengths = [
    ['01', '自分で学び、\n柔軟に考える', '独学で企画と資料作成を学習。\nP16 バグハンター：\n視点と捕獲の操作を見直した。', C.blue],
    ['02', '仕様にまとめ、\n考えを伝える', 'P12 双子：リンク効果を\n2種類に絞った理由を\n仕様書に残した。', C.teal],
    ['03', '仲間と協力し、\n完成まで関わる', 'P6 すべる宇宙駐車場：\n企画を整理し、ゲームに使う\n画像とSEを用意した。', C.pink],
  ];
  strengths.forEach(([number, title, body, color], i) => {
    const x = 64 + i * 396;
    text(s, number, x, 185, 350, 102, 76, { bold: true, color });
    text(s, title, x, 309, 360, 94, 29, { bold: true });
    band(s, x, 423, 350, 2, color);
    text(s, body, x, 448, 360, 190, 20);
  });
  notes(s, ['利用者の確認：プランナーとして独学で企画を進め、まとめてきたこと、仕様書作成の経験', '利用者の確認：仲間とゲームを制作し、完成させている', 'src/sections/about.html', 'files/futago_spec.pdf']);
}
{
  const s = gamePage('sliding-space-parking', 'すべる宇宙駐車場', '慣性で滑る船を、逆噴射で駐車する。');
  await gameHeading(s, 'sliding-space-parking', 'すべる宇宙駐車場');
  await image(s, media.parking, 64, 190, 744, 344, 'App Storeに掲載したiPhone版のプレイ画面');
  label(s, '私の担当', '企画立案・整理\n画像作成・SE', 852, 184, 362, 88, C.teal);
  band(s, 852, 329, 362, 1, '#57717A');
  text(s, '制作人数：4人', 852, 350, 362, 38, 23);
  text(s, 'App Store公開', 852, 400, 362, 40, 25, { bold: true, color: C.teal });
  text(s, '2026年10月7日リリース', 852, 446, 362, 38, 21);
  text(s, 'iPhone・iPad / Unity', 64, 552, 744, 36, 20, { color: C.muted });
  notes(s, [appStore, 'https://itunes.apple.com/lookup?id=6816609277&country=jp（2026-10-09確認）', parkingSource + '/Docs/iOS.md', '利用者の確認：4人制作、担当は企画立案・整理・画像作成・SE']);
}
{
  const s = page('枠に着く前に、いつ減速するか', 'すべる宇宙駐車場 / 実プレイと操作の模式図', C.teal);
  const gif = path.join(root, 'files/images/sliding-space-parking.gif');
  for (const [i, [n, cx, title]] of [[12, 143, '入力を離しても進む'], [21, 194, '枠の手前で逆噴射']].entries()) {
    const x = 64 + i * 590;
    const file = path.join(build, 'parking-phase-' + i + '.png');
    const marker = Buffer.from('<svg width="268" height="88"><circle cx="' + cx + '" cy="39" r="10" stroke="#000" stroke-width="5" fill="none"/><circle cx="' + cx + '" cy="39" r="10" stroke="#fff" stroke-width="2" fill="none"/><rect x="220" y="22" width="35" height="36" fill="none" stroke="#fff" stroke-width="2"/></svg>');
    await sharp(gif, { page: n }).extract({ left: 58, top: 70, width: 268, height: 88 }).composite([{input: marker}]).png().toFile(file);
    text(s, title, x, 186, 560, 45, 29, { bold: true });
    await image(s, file, x, 238, 558, 183, '実プレイ：丸は船、四角は駐車枠');
    text(s, '実プレイ：○ 船　□ 駐車枠', x, 427, 558, 30, 18);
    const diagram = path.join(build, 'parking-arrows-' + i + '.png');
    const arrows = '<svg width="500" height="70"><path d="M25 25H210m-12-8 12 8-12 8" stroke="#182528" stroke-width="4" fill="none"/>' + (i ? '<path d="M460 48H260" stroke="#182528" stroke-width="4" stroke-dasharray="9 7"/><path d="m272 40-12 8 12 8" stroke="#182528" stroke-width="4" fill="none"/>' : '') + '</svg>';
    await sharp(Buffer.from(arrows)).png().toFile(diagram);
    await image(s, diagram, x, 463, 500, 70, '操作の模式図');
    text(s, i ? '枠までの距離を見て、減速を始める。' : '速度が残り、船は枠に近づく。', x, 539, 558, 38, 22, { bold: true });
  }
  text(s, '模式図：実線＝船の進行方向、破線＝逆噴射の推力。', 64, 594, 1152, 32, 20, { bold: true });
  text(s, '実プレイで確認できるのは船の位置変化です。入力の瞬間は画像から判別できません。', 64, 630, 1152, 30, 17, { color: C.muted });
  notes(s, ['src/sections/works.html #game-sliding-space-parking', appStore, parkingSource + '/Docs/Spec.md']);
}
{
  const s = page('画像とSEで、駐車する場面を形にする', 'すべる宇宙駐車場 / 私の担当：企画立案・整理、画像作成、SE', C.teal);
  band(s, 64, 183, 330, 338, '#14242D');
  await image(s, 'documents/proposals/assets/parking-ship.png', 106, 212, 246, 236, 'ゲーム内の宇宙船素材');
  text(s, 'ゲーム内の宇宙船素材', 85, 469, 285, 37, 20, { bold: true, color: C.white });
  await image(s, media.parking, 430, 183, 786, 363, '公開iOS版の使用場面');
  text(s, '公開iOS版での使用場面', 430, 550, 786, 32, 19, { bold: true, color: C.teal });
  text(s, '噴射SE：押している間は鳴り、離すと止まる。推力がかかる間を音で知らせる。', 64, 592, 1152, 33, 20, { bold: true });
  text(s, '画像・音には生成ツールも使用。タッチ操作の実装・テストはチームの開発内容です。', 64, 630, 1152, 34, 18, { color: C.muted });
  notes(s, [parkingSource + '/Docs/Spec.md（旧キーボード専用方針）', parkingSource + '/Tests/PlayMode/TouchControlsTests.cs', parkingSource + '/Docs/DevelopmentGuide.md（素材生成の範囲）', 'documents/specifications/specifications.json S-C01。本人がタッチ操作を実装・テストしたという主張ではない。']);
}
{
  const s = gamePage('v-link-battle', 'V-Link Battle', '代表作 / 公開中 / Unity / 神ゲーエボリューション2025 1次審査通過');
  await gameHeading(s, 'v-link-battle', 'V-Link Battle');
  await image(s, 'files/images/v-link-battle.jpg', 64, 183, 744, 419, '氷の攻撃とコメントが表示されたV-Link Battle');
  label(s, '私の担当', '企画・仕様整理・システム設計\nタスク振り分け\n3D素材・エフェクト\nアニメーション', 852, 183, 362, 142, C.pink);
  text(s, '制作人数：8人', 852, 386, 360, 40, 23);
  label(s, 'どんな遊びか', 'VTuberの配信文化を\n題材にした3D対戦アクション。', 852, 450, 360, 80, C.pink);
  notes(s, ['src/sections/featured-works.html', '制作人数は利用者の確認：8人', '審査通過実績：src/sections/about.html']);
}
{
  const s = page('攻撃するか、隙を見てアピールするか', 'V-Link Battle / 企画時の選択肢とリスク', C.pink);
  text(s, '企画上の判断', 64, 177, 1152, 34, 23, { bold: true, color: C.pink });
  for (const [i, [title, body]] of [['先に攻撃する', 'アピールを挟まず、攻撃する。'], ['隙を見てアピールする', 'アピール中は無防備。\n成功後の攻撃でボルテージを高める構想。']].entries()) {
    const x = 64 + i * 590;
    band(s, x, 218, 562, 143, '#F0E8EF');
    text(s, title, x+18, 232, 526, 37, 25, { bold: true });
    text(s, body, x+18, 275, 526, 72, 21);
  }
  text(s, '想定場面：相手に隙ができた。今の隙を攻撃とアピールのどちらに使うか。', 64, 390, 1152, 46, 24, { bold: true });
  label(s, '攻撃を選ぶ', '今の隙を攻撃に使う。\nアピールによる上乗せは狙わない。', 64, 463, 548, 95, C.pink);
  label(s, 'アピールを選ぶ', '次の攻撃での見返りを狙う。\n演出中に反撃されるリスクを負う。', 654, 463, 562, 95, C.pink);
  text(s, '企画時の想定を示す模式図。公開版での実装を示すものではありません。', 64, 636, 1152, 28, 18, { color: C.muted });
  notes(s, ['files/v-link-battle_proposal.pdf：企画上のルール', 'files/Vlinkvideo.mp4：27・29・31秒。同一動画の時系列であり、改善前後の比較ではない。', 'D:/Vlink/Assets/TechC/VBattle/Scripts/InGame/Input/PlayerInputManager.cs：必殺技入力通知がコメントアウト。企画全体の実装済み・完成済みの循環とは主張しない。']);
}
{
  const s = page('配信文化と対戦の見せ方', 'V-Link Battle / コメントとキャラクター選択', C.pink);
  await image(s, media.comments, 64, 179, 548, 309, 'V-Link Battleのコメント機能');
  band(s, 148, 276, 180, 3, '#FFFFFF', 'コメント帯の位置を示すマーカー');
  text(s, '画面を横切るコメント帯', 70, 460, 410, 26, 17, { bold: true, color: C.white });
  await image(s, media.selection, 668, 179, 548, 309, 'V-Link Battleのキャラクター選択画面');
  label(s, 'コメントを戦いの要素に', '配信らしい画面表現を使い、\nコメントに触れるか避けるかの判断を企画。', 64, 516, 548, 94, C.pink);
  label(s, '対戦前の画面', 'キャラクターと1P・2Pを左右に配置。\nウィンドウを模した枠で世界観を伝えます。', 668, 516, 548, 94, C.pink);
  text(s, '素材担当は制作・収集を含みます。画面全体を一人で制作したものではありません。', 64, 638, 1152, 28, 18, { color: C.muted });
  notes(s, ['files/v-link-battle_proposal.pdf', 'documents/proposals/assets/vlink-comments.jpg：files/Vlinkvideo.mp4の30秒地点', 'documents/proposals/assets/vlink-selection.jpg：同12秒地点']);
}
{
  const s = page('配信らしさを、攻撃以外の選択にも', 'V-Link Battle / 企画で考えたこと', C.pink);
  text(s, 'VTuberの配信文化を、背景だけでなく対戦の判断にも使う。', 64, 188, 1152, 66, 29, { bold: true });
  label(s, 'アピールのタイミング', '相手に隙があるかを見て、\n攻撃を優先するか、魅せるかを選ぶ構想。', 64, 326, 548, 110, C.pink);
  label(s, 'コメントへの対応', 'コメントに触れるか、避けるか。\n画面を横切るコメントにも判断を持たせる企画。', 668, 326, 548, 110, C.pink);
  text(s, '上記は企画上の構想です。公開版の動作を示すものではありません。', 64, 562, 1152, 60, 21, { color: C.muted });
  notes(s, ['src/sections/featured-works.html #vlink-editions-title', '本来の版とWeb版の機能差を省略しない。']);
}
{
  const s = gamePage('futago', '双子', 'リンク型コマンドバトル / 制作人数：6人 / Unity');
  await gameHeading(s, 'futago', '双子');
  await image(s, 'files/images/futago-gameplay.png', 64, 184, 704, 396, '双子のコマンド選択画面');
  label(s, 'どんな遊びか', 'キャラクター同士を線でつなぎ、\nダメージやバフを共有して戦う。', 814, 180, 400, 86);
  label(s, '私の担当', '企画・仕様整理・システム設計\nタスク振り分け・素材集め', 814, 327, 400, 86);
  label(s, '設計の工夫', '誰と誰をつなぎ、\nどの行動から効果を広げるか。\n共有先と残り本数を判断します。', 814, 473, 400, 113);
  notes(s, ['src/sections/works.html #game-futago', 'files/futago_spec.pdf p.3-4', '制作人数は利用者の確認：6人']);
}
{
  const s = page('仕様変更の経緯を、次の担当者へ残す', '双子 / 攻撃と強化を優先し、リンクを2種類に');
  for (const [i, [title, body]] of [['変更前', 'ダメージ・バフに加え、\nパッシブ共有も検討。'], ['変更理由', '優先度の高い攻撃と\n強化の共有を先に固める。'], ['変更後', 'ダメージとバフの2種類。\nパッシブ共有は見送り。']].entries()) {
    const x = 64 + i * 390;
    band(s, x, 183, 372, 145, i === 1 ? '#D6EBE5' : '#EAF0F1');
    text(s, title, x+16, 195, 340, 33, 22, { bold: true, color: C.teal });
    text(s, body, x+16, 238, 340, 78, i === 1 ? 25 : 22, { bold: i === 1 });
  }
  text(s, '根拠：制作仕様書 p.3 / F-C01', 64, 350, 800, 34, 20, { bold: true, color: C.teal });
  await image(s, media.spec, 64, 388, 780, 260, '双子の仕様書 F-C01：変更理由・変更後・影響範囲');
  label(s, '実装確認', '現行コードも\nDamage / Buffの2種。', 880, 423, 335, 86);
  text(s, '左の「背景・理由」と\n「影響範囲」が該当行。', 880, 557, 335, 58, 19);
  notes(s, ['files/futago_spec.pdf p.3 F-C01・F-C02', 'documents/specifications/specifications.json', 'launcher/game-sources/futago/Assets/TechC/App/Scripts/InGame/Link/LinkType.cs：Damage, Buff。理解度・開発効率の向上は計測結果がないため主張しない。']);
}
{
  const s = gamePage('line-boundary', '線のこちら側 / 向こう側', 'パズルアクション / 制作人数：4人 / Unity');
  await gameHeading(s, 'line-boundary', '線のこちら側 / 向こう側');
  await image(s, 'files/images/line-boundary-gameplay.png', 64, 184, 704, 396, '境界線を引いて重力の異なる空間を作る画面');
  label(s, 'どんな遊びか', '2点を結ぶ境界線を作り、\n領域の効果を変えて進みます。', 814, 180, 400, 84);
  label(s, '私の担当', '企画・仕様整理・レベルデザイン\nタスク振り分け・素材集め', 814, 326, 400, 85);
  label(s, '企画意図', '用意された道を通るだけでなく、\n線の置き方で攻略方法を\n作り出す楽しさを目指しました。', 814, 470, 400, 114);
  notes(s, ['src/sections/works.html #game-line-boundary', 'files/line-boundary_proposal.pdf p.2-4', '制作人数は利用者の確認：4人']);
}
{
  const s = page('異なる遊びを考え、形にする', 'チーム制作 / 制作人数：各4人 / Unity');
  await image(s, 'files/game-icons/teruteru-wars.png', 64, 174, 56, 56, 'てるてるウォーズのアイコン');
  text(s, 'てるてるウォーズ', 138, 176, 460, 49, 31, { bold: true });
  await image(s, 'files/game-icons/hanten-assassination.jpeg', 668, 174, 56, 56, '反転暗殺のアイコン');
  text(s, '反転暗殺', 742, 176, 470, 49, 31, { bold: true });
  await image(s, 'files/images/teruteru-wars-gameplay.png', 64, 250, 548, 308, 'てるてる坊主を配置するタワーディフェンス');
  await image(s, 'files/images/hanten-assassination-gameplay.png', 668, 250, 548, 308, '盤面を反転させて敵を避けるゲーム画面');
  text(s, '設計の焦点：配置時に通常・逆さを選び、\n攻撃と妨害を使い分ける。\n担当：企画・仕様整理・プログラム', 64, 569, 548, 98, 20);
  text(s, '設計の焦点：移動と反転を別の手に分け、\nどちらを先に使うか考えさせる。\n担当：企画・仕様整理・レベル設計', 668, 569, 548, 98, 20);
  notes(s, ['src/sections/works.html #game-teruteru-wars, #game-hanten-assassination', '制作人数は利用者の確認：各4人']);
}
{
  const s = gamePage('sanshoku-bunki', '三色の分岐係', '仕分けアクション / 制作人数：5人 / Unity');
  await gameHeading(s, 'sanshoku-bunki', '三色の分岐係');
  await image(s, 'files/images/sanshoku-bunki-gameplay.png', 64, 184, 704, 300, '分岐点が見えるゲーム画面');
  await image(s, 'documents/proposals/assets/sanshoku-normal.png', 64, 493, 122, 122, '正常品');
  await image(s, 'documents/proposals/assets/sanshoku-defective.png', 406, 493, 122, 122, '不良品');
  text(s, '正常品\n種類で3方向へ', 194, 519, 205, 73, 20, { bold: true });
  text(s, '不良品\n種類を問わず上へ', 536, 519, 236, 73, 20, { bold: true });
  label(s, '遊びの核', '流れてくる品物を見分け、\n分岐を切り替えて仕分けます。\n不良品は上へ送り返します。', 814, 180, 400, 105);
  label(s, '私の担当', '企画立案・システム設計\nルール設計・タスク振り分け\n画像・SEの用意', 814, 341, 400, 105);
  label(s, 'ルール設計で分けた判断', '正常品は種類で3方向へ。\n不良品は種類にかかわらず上へ。\n種類だけで即決できない仕分けに。', 814, 500, 400, 105);
  notes(s, ['src/sections/works.html #game-sanshoku-bunki', '利用者の確認：5人制作、プランナー・企画立案・システムとルール設計・タスク振り分け・画像・SEの用意']);
}
{
  const s = gamePage('bug-hunter', 'バグハンター', '企画・改善の検討 / 制作人数：1人 / プログラムはAIの実装支援を利用');
  await gameHeading(s, 'bug-hunter', 'バグハンター');
  await image(s, 'files/images/bug-hunter-battle.png', 64, 184, 704, 328, '昆虫へ攻撃・防御・技を指示するバトル画面');
  text(s, '改善例：右クリック必須の視点移動を見直し、\n自由視点＋左クリック捕獲を改善方針として提示。', 64, 523, 704, 60, 21, { bold: true });
  text(s, 'QA記録：視点移動・捕獲・UI誤操作防止を確認。\n素材：AI生成画像、Poly HavenのCC0テクスチャ。', 64, 587, 704, 55, 18, { color: C.muted });
  label(s, '自分が考えたこと', '指示式バトルに転倒を加え、\n復帰を待つ隙を作る方針。\n能力値だけに頼らない勝負へ。', 814, 180, 400, 105, C.teal);
  label(s, '制作の分担', '企画と改善方針は自分で検討。\nプログラムは自作ではなく、\nAIによる実装支援を利用。', 814, 341, 400, 105, C.teal);
  label(s, 'これから取り組みたいこと', '内容と動作負荷を精査し、\n遊びを保った軽量化を目指す。\n改善前後の比較は今後の課題。', 814, 500, 400, 105, C.teal);
  notes(s, ['利用者の確認（2026-10-30）：制作人数は1人だが自分でプログラムを書いていない。動作負荷と内容の精査、遊びを保った軽量化・品質改善を望んでいる。', '軽量化の実施・性能向上・自作プログラムの実績は主張しない。', 'games/bug-hunter/QA.md v0.2.1：過去の検証記録。本人が実行したという意味ではない。', 'games/bug-hunter/ASSETS.md：AI生成画像とPoly Haven CC0環境テクスチャ。', 'src/sections/works.html #game-bug-hunter']);
}
{
  const s = gamePage('hekorhythm', 'へこリズム', 'リズムアクション / 制作人数：7人 / Unity 2022.3 / 未公開');
  await gameHeading(s, 'hekorhythm', 'へこリズム');
  await image(s, 'files/images/hekorhythm-gameplay.png', 64, 184, 704, 396, 'エンドレスモードのプレイ画面');
  text(s, 'エンドレスモードのプレイ画面', 64, 596, 704, 30, 18, { color: C.muted });
  label(s, 'どんな遊びか', '型を見極めて、拍に合わせて\nパーツをはめ込む。', 814, 180, 400, 84);
  label(s, '私の担当', '企画立案・仕様書作成\nタスク振り分け\nブラッシュアップ時の機能追加全般', 814, 309, 400, 110);
  label(s, '改善で決めたこと', 'エンドレスは段階的に加速し、\n速度に上限を設ける。記録は\n難易度別に比較できるよう保存。', 814, 477, 400, 110);
  notes(s, ['利用者確認：7人制作、公開URLなし。', 'へこリズムを修正：エンドレスの加速上限と自己ベスト表示。']);
}
{
  const s = page('企画書で広げる、遊びの切り口', '以下の2件は企画書のみの作品');
  await image(s, 'documents/proposals/assets/dungeon-concept.png', 64, 180, 548, 300, '5分ダンジョンの画面イメージ案');
  await image(s, 'documents/proposals/assets/seibutsu-card.png', 668, 180, 290, 300, 'せいぶつマスターのカード枠案');
  text(s, '特徴をヒントに\n生物を推理する', 960, 265, 256, 90, 23, { bold: true });
  text(s, '画面イメージ案・実装画面ではありません', 64, 479, 548, 26, 16, { color: C.muted });
  text(s, 'カード枠のイメージ案', 668, 479, 548, 26, 16, { color: C.muted });
  label(s, '5分ダンジョン', '例：体力が少ないとき、回復を選べば\n先へ進みやすくなる。強化を選べば\n次の戦いに備えられる。', 64, 506, 548, 109);
  label(s, 'せいぶつマスター', '生物の特徴から答えを推理する\nカードゲーム。勝ちたい気持ちを、\n知りたい気持ちにつなげます。', 668, 506, 548, 109, C.teal);
  notes(s, ['files/FiveMinuteDungeon.pdf', 'files/seibutsu-master.pdf', '利用者の確認：2件とも企画書のみ。']);
}
{
  const s = page('構想中のアイデア', 'プレイヤーが判断する場面から考えた3案');
  const concepts = [
    ['人狼×建築', 'werewolf-building', '建築のミスと妨害を見分ける。', '建築を進めるか、\n怪しい行動を確かめるか。'],
    ['拍手にまぎれて', 'hidden-in-applause', '拍手に足音を隠して進む。', '今の音で進める距離を読み、\n走るか待つかを判断する。'],
    ['この色、好きですか', 'colors-you-like', '会話を手掛かりに2色を選ぶ。', '色そのものだけでなく、\n相手が求める雰囲気を考える。'],
  ];
  for (const [i, [title, id, core, intent]] of concepts.entries()) {
    const x = 64 + i * 396;
    const png = path.join(build, `idea-${id}.png`);
    await sharp(path.join(root, `files/idea-images/${id}.webp`)).png().toFile(png);
    await image(s, png, x, 183, 360, 220, title + 'のAI生成画面案');
    text(s, title, x, 423, 360, 42, 28, { bold: true, color: C.teal });
    text(s, core + '\n' + intent, x, 481, 360, 112, 22);
  }
  text(s, '画像はAI生成の画面案です。実際のプレイ画面ではありません。上記3案のゲーム本体は未制作です。', 64, 602, 1152, 28, 18, { color: C.muted });
  notes(s, ['src/idea-catalog.json', 'documents/idea-notes-sources.md', '構想・検証中・制作中・制作へ進んだ企画を区別するWeb一覧へ誘導。24案をPDFに転載しない。']);
}
{
  const s = page('企画を形にするための制作スキル', '企画・資料作成・ゲーム制作');
  label(s, '企画・設計', '遊びの核を考え、\nルールや仕様に整理します。', 64, 182, 374, 100);
  label(s, 'チーム制作', 'タスクを振り分け、\n企画意図と実装内容の\n認識をそろえます。', 64, 349, 374, 119);
  label(s, '素材制作', '必要に応じて画像、\n3D素材、エフェクト、\nアニメーションにも関わります。', 64, 518, 374, 112);
  const rows = [
    ['ツール', '経験', '用途'],
    ['Unity', '2年', 'ゲーム制作・レベル設計'],
    ['Visual Studio Code', '2年', 'コード編集・理解'],
    ['Git', '2年', '変更履歴・チーム共有'],
    ['PowerPoint', '2年', '企画書・資料構成'],
    ['Excel', '2年', '表による情報整理'],
    ['Googleスプレッドシート', '2年', '情報共有・改善提案'],
    ['Blender', '1年', '3Dオブジェクト制作'],
    ['Unreal Engine 5', '3か月', '基礎学習'],
  ];
  const table = s.tables.add({ rows: rows.length, columns: 4, left: 475, top: 184 + printTop, width: 741, height: 441, columnWidths: [48, 285, 86, 322], values: rows.map(row => ['', ...row]) });
  table.borders.assign({ fill: '#DCE3EA', width: 0.5, style: 'solid' });
  for (let row = 0; row < rows.length; row++) {
    for (let col = 0; col < 4; col++) {
      const cell = table.getCell(row, col);
      cell.fill = row === 0 ? C.blue : (row % 2 ? C.light : C.white);
      cell.text.style = { typeface: font, fontSize: 23, bold: row === 0, color: row === 0 ? C.white : C.ink, verticalAlignment: 'middle' };
    }
  }
  for (let i = 0; i < toolIcons.length; i++) await image(s, `files/icons/${toolIcons[i]}.png`, 485, 243 + i * 49, 30, 30, rows[i + 1][0]);
  notes(s, ['src/sections/skills.html', 'src/sections/about.html']);
}
{
  const s = page('作品索引', '公開資料のある作品と、冊子内の掲載ページ');
  const entries = [
    ['すべる宇宙駐車場', 'すべる宇宙駐車場', 'https://unityroom.com/games/sliding-space-parking', 'sliding-space-parking_proposal.pdf', 'sliding-space-parking_spec.pdf'],
    ['V-Link Battle', 'V-Link Battle', 'play/v-link-battle/', 'v-link-battle_proposal.pdf', 'v-link-battle_spec.pdf'],
    ['双子', '双子', 'play/futago/', 'futago_proposal.pdf', 'futago_spec.pdf'],
    ['線のこちら側 / 向こう側', '線のこちら側 / 向こう側', 'play/line-boundary/', 'line-boundary_proposal.pdf', 'kochiratomukou_spec.pdf'],
    ['異なる遊びを考え、形にする', 'てるてるウォーズ', 'play/teruteru-wars/', 'teruteruwars_proposal.pdf', 'teruteru-wars_spec.pdf'],
    ['異なる遊びを考え、形にする', '反転暗殺', 'play/hanten-assassination/', 'hantenansatsu_proposal.pdf', 'hanntenn-ansatu_spec.pdf'],
    ['三色の分岐係', '三色の分岐係', 'https://unityroom.com/games/sansyokunobunkigakari', 'sanshoku-bunki_proposal.pdf', null],
    ['バグハンター', 'バグハンター', 'play/bug-hunter/', 'mushi-shooting.pdf', 'bug-hunter_spec.pdf'],
  ];
  text(s, '掲載ページ / 作品', 64, 174, 686, 27, 16, { color: C.muted, bold: true });
  text(s, '公開資料', 815, 174, 400, 27, 16, { color: C.muted, bold: true });
  const ids = ['sliding-space-parking', 'v-link-battle', 'futago', 'line-boundary', 'teruteru-wars', 'hanten-assassination', 'sanshoku-bunki', 'bug-hunter'];
  for (const [i, [targetTitle, title, url, proposal, spec]] of entries.entries()) {
    const y = 204 + i * 45;
    const n = String(titles.indexOf(targetTitle) + 1).padStart(2, '0');
    await image(s, `files/game-icons/${ids[i]}.${ids[i] === 'hanten-assassination' ? 'jpeg' : 'png'}`, 64, y - 1, 32, 32, title + 'のアイコン');
    text(s, n, 112, y, 44, 35, 20, { color: C.muted });
    text(s, title, 174, y, 600, 36, 22);
    if (proposal) text(s, '企画書', 815, y, 130, 36, 21);
    if (spec) text(s, '仕様書', 1000, y, 130, 36, 21);
    band(s, 64, y + 39, 1152, 1, C.rule);
  }
  await printQr(s, base + '#proposals', 'documents', 64, 564);
  text(s, '企画書・仕様書の公開一覧', 200, 581, 800, 35, 23, { bold: true });
  link(s, 'kuon-haruto.github.io/portfolio/#proposals', base + '#proposals', 200, 621, 800, 20);
  notes(s, ['公開資料：src/sections/proposals.html と specifications.html']);
}
{
  const s = page('島本 善太', 'ゲームプランナー志望｜2028年卒業予定');
  text(s, '自分の考えを、\nわかりやすく伝えられる\nプランナーへ。', 64, 203, 680, 174, 40, { bold: true, color: C.lime });
  text(s, '独学で企画を学び、企画書や仕様書に\nまとめることに取り組んできました。\nチーム制作の経験を活かし、自分の判断を\n説明しながら改善を進めていきたいです。', 64, 428, 660, 158, 24);
  band(s, 750, 201, 1, 420, '#3A4B4D');
  text(s, '所属', 800, 203, 416, 32, 20, { color: C.mint, bold: true });
  text(s, '札幌デザイン＆テクノロジー専門学校\nスーパーゲームクリエーター専攻\n4年制 / 2024年入学・2028年卒業予定', 800, 247, 416, 116, 21);
  await printQr(s, base, 'home', 800, 461);
  text(s, 'Webポートフォリオ', 800, 586, 416, 32, 20, { color: C.mint, bold: true });
  link(s, 'kuon-haruto.github.io/portfolio/', base, 800, 624, 416, 20);
  notes(s, ['src/sections/about.html', 'src/sections/contact.html']);
}

for (const { slide, targetTitle, y, x, width } of contents) {
  const targetPage = titles.indexOf(targetTitle);
  if (targetPage < 0) throw new Error(`Missing contents target: ${targetTitle}`);
  text(slide, String(targetPage + 1).padStart(2, '0'), 1134, y, 82, 40, 29, { color: C.teal, align: 'right', bold: true });
  links.push({ page: slides.indexOf(slide), x, y, width, height: 43, targetPage });
}

for (let i = 0; i < slides.length; i++) {
  const s = slides[i];
  const dark = themes.get(s)?.dark;
  band(s, 64, 676, 1152, 1, dark ? '#3A4B4D' : C.rule);
  text(s, 'GAME PLANNER / PORTFOLIO', 64, 687, 700, 22, 12, { color: C.muted });
  text(s, `${String(i + 1).padStart(2, '0')} / ${slides.length}`, 1128, 683, 88, 25, 17, { color: C.muted, align: 'right', bold: true });
}

const candidatePath = path.join(build, 'candidate.pptx');
const previewArgument = process.argv.find(value => value.startsWith('--preview-pages='));
if (previewArgument) {
  const numbers = previewArgument.split('=')[1].split(',').map(Number);
  for (const number of numbers) {
    if (!Number.isInteger(number) || !slides[number - 1]) throw new Error(`Invalid preview page: ${number}`);
    const png = await presentation.export({ slide: slides[number - 1], format: 'png', scale: 1.5 });
    await fs.writeFile(path.join(build, `page-${String(number).padStart(2, '0')}.png`), new Uint8Array(await png.arrayBuffer()));
    console.log(`Previewed ${number}/${slides.length}`);
  }
  process.exit(0);
}
if (!process.argv.includes('--finalize-only')) {
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
console.log('PPTX draft exported');
for (const [i, slide] of slides.entries()) {
  const png = await presentation.export({ slide, format: 'png', scale: 1.5 });
  await fs.writeFile(path.join(build, `page-${String(i + 1).padStart(2, '0')}.png`), new Uint8Array(await png.arrayBuffer()));
  const layout = await slide.export({ format: 'layout' });
  await fs.writeFile(path.join(build, `page-${String(i + 1).padStart(2, '0')}.layout.json`), await layout.text());
  console.log(`Rendered ${i + 1}/${slides.length}`);
}
await fs.writeFile(path.join(build, 'navigation.json'), JSON.stringify({ titles, links, printHeight, printTop }, null, 2));
const exportPdfCommand = `
$ErrorActionPreference = 'Stop'
$app = New-Object -ComObject PowerPoint.Application
$existing = $app.Presentations.Count
$deck = $null
try {
  $deck = $app.Presentations.Open($env:PORTFOLIO_PPTX_INPUT, $true, $false, $false)
  $deck.SaveAs($env:PORTFOLIO_PDF_OUTPUT, 32)
  Write-Output 'PowerPoint PDF export completed'
} finally {
  if ($null -ne $deck) { $deck.Close() }
  if ($existing -eq 0) { $app.Quit() }
}`;
execFileSync('powershell.exe', ['-NoProfile', '-Command', exportPdfCommand], {
  env: { ...process.env, PORTFOLIO_PPTX_INPUT: candidatePath, PORTFOLIO_PDF_OUTPUT: path.join(build, 'candidate.pdf') },
  stdio: 'inherit',
});
}

if (!process.argv.includes('--draft')) {
  const finalPath = path.join(output, 'portfolio.pptx');
  const verifiedPath = path.join(build, 'validated', 'portfolio.pptx');
  const receiptPath = path.join(build, 'presentation.validation.json');
  await fs.mkdir(path.dirname(verifiedPath), { recursive: true });
  await fs.rm(verifiedPath, { force: true });
  await fs.rm(receiptPath, { force: true });
  await finalizePresentation({
    workspaceDir: root, candidatePath, finalPath: verifiedPath,
    pythonExecutable: python,
    integrityValidatorPath: path.join(skill, 'container_tools/inspect_presentation_package_integrity.py'),
    layoutValidatorPath: path.join(skill, 'container_tools/inspect_presentation_layout_geometry.py'),
    layoutArgs: ['--expected-slide-size-emu', '12192000,8620125', '--validate-bullet-geometry', '--validate-heading-fit', '--require-native-table-slide', String(titles.indexOf('企画を形にするための制作スキル') + 1)],
    requiredNativeTableOwnerSlides: [titles.indexOf('企画を形にするための制作スキル') + 1], requiredNativeChartOwnerSlides: [],
    fontPolicy, verifyArtifactToolImport: true,
    receiptPath,
  });
  await fs.copyFile(verifiedPath, finalPath);
  await fs.unlink(verifiedPath);
  execFileSync(python, [path.join(root, 'tools/finalize-portfolio-pdf.py'), build, path.join(output, 'portfolio.pdf')], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, stdio: 'inherit' });
  console.log('Final portfolio files exported');
}
