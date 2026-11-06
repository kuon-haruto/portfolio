import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = process.env.CODEX_RUNTIME || 'C:/Users/shima/.cache/codex-runtimes/codex-primary-runtime/dependencies';
process.env.RUNTIME_NODE_MODULES ||= path.join(runtime, 'node/node_modules');
const skill = process.env.PRESENTATIONS_SKILL || 'C:/Users/shima/.codex/plugins/cache/openai-primary-runtime/presentations/26.1105.12137/skills/presentations';
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
const C = { ink: '#18242D', muted: '#556571', blue: '#155BC1', teal: '#007E80', pink: '#BB307E', white: '#FFFFFF', light: '#F2F6FA' };
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
function pdfPage(source, name, page) {
  const target = path.join(build, name);
  execFileSync(poppler, ['-f', String(page), '-l', String(page), '-singlefile', '-scale-to', '1800', '-png', source, target]);
  return target + '.png';
}
const media = {
  cover: frame(path.join(root, 'files/Vlinkvideo.mp4'), 'cover-vlink', 27),
  appeal: path.join(root, 'documents/proposals/assets/vlink-battle.jpg'),
  comments: path.join(root, 'documents/proposals/assets/vlink-comments.jpg'),
  selection: path.join(root, 'documents/proposals/assets/vlink-selection.jpg'),
  parking: path.join(root, 'files/images/sliding-space-parking-store-gameplay.jpg'),
  spec: pdfPage(path.join(root, 'files/futago_spec.pdf'), 'futago-spec', 3),
  dungeon: pdfPage(path.join(root, 'files/FiveMinuteDungeon.pdf'), 'dungeon-cover', 1),
  seibutsu: pdfPage(path.join(root, 'files/seibutsu-master.pdf'), 'seibutsu-cover', 1),
};

const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const slides = [];
const links = [];
const titles = [];
const contents = [];

function text(slide, value, x, y, w, h, size = 24, options = {}) {
  const shape = slide.shapes.add({ name: options.name || value.slice(0, 28), geometry: 'textbox', position: { left: x, top: y, width: w, height: h }, fill: 'none', line: { fill: 'none', width: 0 } });
  shape.text = value;
  shape.text.style = { typeface: font, fontSize: size, color: options.color || C.ink, bold: Boolean(options.bold), insets: 0, autoFit: 'none', verticalAlignment: 'top', wrap: 'square', lineSpacing: 1.15, alignment: options.align || 'left' };
  return shape;
}
function link(slide, label, url, x, y, w, size = 20) {
  const shape = text(slide, label, x, y, w, 36, size, { color: C.blue });
  shape.text.get(label).link = { uri: url, isExternal: true };
  links.push({ page: slides.indexOf(slide), x, y, width: w, height: 36, url });
}
async function image(slide, file, x, y, w, h, alt, options = {}) {
  const source = path.isAbsolute(file) ? file : path.join(root, file);
  const ext = path.extname(source).toLowerCase();
  const contentType = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  const blob = ext === '.svg' ? await fs.readFile(source) : await sharp(source)
    .resize({ width: Math.ceil(w * 1.5), height: Math.ceil(h * 1.5), fit: 'inside', withoutEnlargement: true })
    .toBuffer();
  return slide.images.add({ blob, contentType, alt, fit: options.fit || 'contain', position: { left: x, top: y, width: w, height: h }, ...(options.crop ? { crop: options.crop } : {}) });
}
function page(title, subtitle = '', color = C.blue) {
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  slides.push(slide);
  titles.push(title);
  if (title) text(slide, title, 64, 48, 1152, 64, 44, { bold: true });
  if (subtitle) text(slide, subtitle, 64, 115, 1152, 38, 23, { color });
  return slide;
}
function notes(slide, sources) { slide.speakerNotes.text = '出典\n' + sources.join('\n'); }
function label(slide, title, body, x, y, w, bodyHeight = 94, color = C.blue) {
  text(slide, title, x, y, w, 36, 24, { bold: true, color });
  text(slide, body, x, y + 43, w, bodyHeight, 24);
}
async function gameHeading(slide, id, title, y = 48) {
  const extensions = { 'hanten-assassination': 'jpeg' };
  await image(slide, `files/game-icons/${id}.${extensions[id] || 'png'}`, 64, y, 64, 64, title + 'のアイコン');
  text(slide, title, 146, y, 1060, 68, 44, { bold: true });
}
function gamePage(id, title, subtitle) {
  const slide = page('', subtitle);
  titles[titles.length - 1] = title;
  return slide;
}

// 目次と強みを入口にし、代表作で経験を具体的に伝える。
{
  const s = presentation.slides.add(); s.background.fill = C.white; slides.push(s); titles.push('島本善太 ポートフォリオ');
  text(s, 'PORTFOLIO', 64, 48, 1100, 86, 64, { bold: true, color: C.blue });
  text(s, '島本 善太', 64, 151, 600, 73, 48, { bold: true });
  text(s, 'ゲームプランナー志望 / 2028年卒業予定', 66, 232, 1000, 40, 25, { color: C.blue });
  text(s, '遊びの仕組みを考え、遊べる形へ。', 66, 285, 1100, 46, 28);
  await image(s, 'files/images/sliding-space-parking-store-title.jpg', 64, 348, 548, 276, 'App Store公開作 すべる宇宙駐車場');
  await image(s, media.cover, 668, 348, 548, 276, 'V-Link Battleのゲーム画面');
  text(s, 'すべる宇宙駐車場 / App Store公開', 64, 636, 548, 30, 21, { bold: true, color: C.teal });
  text(s, 'V-Link Battle / 神エボ1次審査通過', 668, 636, 548, 30, 21, { bold: true, color: C.pink });
  notes(s, ['src/sections/about.html', 'files/Vlinkvideo.mp4', 'src/sections/featured-works.html', appStore]);
}
{
  const s = page('目次', '強み・制作作品・企画書と仕様書');
  const entries = [
    ['私の強み', '私の強み'],
    ['代表作① すべる宇宙駐車場', 'すべる宇宙駐車場'],
    ['代表作② V-Link Battle', 'V-Link Battle'],
    ['その他の制作作品', '双子'],
    ['企画書・仕様書・構想中のアイデア', '企画書で広げる、遊びの切り口'],
    ['制作ツール・スキル', '企画を形にするための制作スキル'],
    ['作品リンク・自己紹介・連絡先', '作品をプレイする・資料を読む'],
  ];
  for (const [i, [title, targetTitle]] of entries.entries()) {
    const y = 184 + i * 65;
    text(s, title, 64, y, 995, 40, 28, { bold: true });
    contents.push({ slide: s, targetTitle, y });
  }
  text(s, '仕様書の制作例は「双子」の紹介ページにも掲載しています。', 64, 646, 1152, 28, 19, { color: C.muted });
  notes(s, ['本資料の各作品紹介・企画書・仕様書・プロフィール']);
}
{
  const s = page('私の強み', 'ゲームプランナーを目指して、取り組んできたこと');
  label(s, '自分で学び、柔軟に考える', 'チームではプランナーの役割を一人で担い、独学でも企画や資料作成を学んできました。\n遊ぶ人の気持ちや作る側の進めやすさなど、いろいろな視点から考え、\n一つの案にこだわらず、状況に合わせて企画を見直すことを意識しています。', 64, 183, 1152, 104);
  label(s, '仕様書を作った経験', '企画書だけでなく、ルールやゲームの動きを整理した仕様書も作成しました。\n自分の頭の中だけで終わらせず、制作メンバーに伝わるようにまとめることを意識しています。', 64, 347, 1152, 80, C.teal);
  label(s, '仲間と完成させた経験', '仲間と一緒にゲームを制作し、作品を完成させてきました。\n企画の整理や画像作成・SEなど、自分にできることに取り組んでいます。', 64, 511, 1152, 80, C.pink);
  notes(s, ['利用者の確認：プランナーとして独学で企画を進め、まとめてきたこと、仕様書作成の経験', '利用者の確認：仲間とゲームを制作し、完成させている', 'src/sections/about.html', 'files/futago_spec.pdf']);
}
{
  const s = gamePage('sliding-space-parking', 'すべる宇宙駐車場', '代表作 / App Store公開 / iPhone・iPad / Unity');
  await gameHeading(s, 'sliding-space-parking', 'すべる宇宙駐車場');
  await image(s, media.parking, 64, 190, 744, 344, 'App Storeに掲載したiPhone版のプレイ画面');
  text(s, 'App Store公開', 852, 184, 362, 52, 32, { bold: true, color: C.teal });
  text(s, '2026年10月7日リリース', 852, 245, 362, 38, 23);
  label(s, '制作人数', '4人', 852, 317, 362, 88, C.teal);
  label(s, '私の担当', '企画立案・整理\n画像作成・SE', 852, 481, 362, 88, C.teal);
  text(s, '慣性で滑る船を、逆噴射で駐車する。', 64, 558, 744, 44, 28, { bold: true });
  link(s, 'App Storeで見る', appStore, 64, 621, 320, 23);
  link(s, 'ブラウザーでプレイ', 'https://unityroom.com/games/sliding-space-parking', 440, 621, 368, 23);
  notes(s, [appStore, 'https://itunes.apple.com/lookup?id=6816609277&country=jp（2026-10-09確認）', parkingSource + '/Docs/iOS.md', '利用者の確認：4人制作、担当は企画立案・整理・画像作成・SE']);
}
{
  const s = page('慣性と駐車を組み合わせた操作設計', 'すべる宇宙駐車場 / 止めるタイミングを考える遊び', C.teal);
  await image(s, 'files/images/sliding-space-parking-store-meteor.jpg', 64, 190, 744, 344, '隕石と障害物を避けて駐車する公開版の画面');
  label(s, '遊びの核', '指を離しても船は進み続ける。\n反対方向への噴射で減速し、\n枠内で止めます。', 852, 183, 364, 110, C.teal);
  label(s, 'プレイヤーの判断', '進路だけでなく、\nいつ減速を始めるかを考える。\n隕石の予告も見て操作します。', 852, 387, 364, 110, C.teal);
  text(s, '身近な「駐車」を、慣性によって難しくする。', 64, 571, 1152, 44, 28, { bold: true });
  text(s, '少ない操作で枠に収まったときの達成感を狙いました。', 64, 627, 1152, 34, 24);
  notes(s, ['src/sections/works.html #game-sliding-space-parking', appStore, parkingSource + '/Docs/Spec.md']);
}
{
  const s = page('記録を比べ、もう一度挑戦する', 'すべる宇宙駐車場 / 公開版の評価とリプレイ性', C.teal);
  await image(s, 'files/images/sliding-space-parking-store-result.jpg', 64, 190, 744, 344, '走行時間・操作回数・衝突回数を示したリザルト画面');
  label(s, '上達が見える記録', '時間・操作回数・衝突回数を\nコースごとに表示。\n次のプレイと比べられます。', 852, 183, 364, 110, C.teal);
  label(s, '公開版の特徴', '全6コース、S〜Cの評価。\nGame Centerのランキングで\nほかの人と記録を競います。', 852, 387, 364, 110, C.teal);
  text(s, 'クリアの次は、より少ない噴射で。', 64, 571, 1152, 44, 28, { bold: true });
  link(s, '公開中のアプリを見る', appStore, 64, 627, 700, 23);
  notes(s, [appStore, parkingSource + '/Docs/iOS.md', 'App Store掲載のリザルト画面']);
}
{
  const s = gamePage('v-link-battle', 'V-Link Battle', '代表作 / 神ゲーエボリューション2025 1次審査通過');
  await gameHeading(s, 'v-link-battle', 'V-Link Battle');
  await image(s, 'files/images/v-link-battle.jpg', 64, 183, 744, 419, '氷の攻撃とコメントが表示されたV-Link Battle');
  text(s, '制作人数：8人', 852, 183, 360, 94, 32, { bold: true, color: C.pink });
  label(s, 'どんな遊びか', 'VTuberの配信文化を\n題材にした3D対戦アクション。', 852, 302, 360, 80, C.pink);
  label(s, '私の担当', '企画・仕様整理・システム設計\nタスク振り分け\n3D素材・エフェクト\nアニメーション', 852, 444, 362, 142, C.pink);
  link(s, 'ブラウザー版でプレイ', base + 'play/v-link-battle/', 64, 619, 420);
  link(s, 'Windows版ZIP', windowsVlink, 500, 619, 300);
  notes(s, ['src/sections/featured-works.html', '制作人数は利用者の確認：8人', '審査通過実績：src/sections/about.html']);
}
{
  const s = page('アピールに、攻撃されるリスクを持たせる', 'V-Link Battle / 配信らしさを戦い方につなげる', C.pink);
  await image(s, media.appeal, 64, 184, 704, 396, '公開プレイ映像から抜き出したV-Link Battleの対戦画面');
  label(s, '狙い', '攻撃を続けるだけでなく、\n「いつ魅せるか」を考える対戦。', 814, 180, 398, 91, C.pink);
  label(s, '企画上のルール', 'アピール中は無防備。\n成功後の攻撃でボルテージを\n高める仕組みを設計しました。', 814, 346, 398, 119, C.pink);
  text(s, 'プレイヤーの判断\n相手の隙にアピールするか、先に攻撃するか。', 64, 600, 1152, 63, 24, { bold: true });
  notes(s, ['files/v-link-battle_proposal.pdf', 'documents/proposals/assets/vlink-battle.jpg：files/Vlinkvideo.mp4の24秒地点', '対戦画面は企画ルールの動作すべてを実証する画像ではない。全プラットフォームで同一演出を保証するものではない。']);
}
{
  const s = page('配信文化と対戦の見せ方', 'V-Link Battle / コメントとキャラクター選択', C.pink);
  await image(s, media.comments, 64, 179, 548, 309, 'V-Link Battleのコメント機能');
  await image(s, media.selection, 668, 179, 548, 309, 'V-Link Battleのキャラクター選択画面');
  label(s, 'コメント', '画面を横切るコメントに効果を持たせ、\n触れるか避けるかの判断につなげます。', 64, 516, 548, 94, C.pink);
  label(s, '対戦前の画面', 'キャラクターと1P・2Pを左右に配置。\nウィンドウを模した枠で世界観を伝えます。', 668, 516, 548, 94, C.pink);
  notes(s, ['files/v-link-battle_proposal.pdf', 'documents/proposals/assets/vlink-comments.jpg：files/Vlinkvideo.mp4の30秒地点', 'documents/proposals/assets/vlink-selection.jpg：同12秒地点']);
}
{
  const s = page('V-Link Battleの閲覧方法', 'Windows版とブラウザー版の違い', C.pink);
  text(s, '実行ファイルを利用できない環境でも体験していただけるよう、\nブラウザー版も用意しました。', 64, 183, 1152, 86, 28, { bold: true });
  label(s, 'Windows版', '本来の別ウィンドウ演出を含む版です。\nZIPのダウンロードと展開が必要です。\nWindows 10・11の64bit向け。\n未署名のため警告が出る場合があります。', 64, 316, 548, 154, C.pink);
  label(s, 'ブラウザー版', '別ウィンドウはゲーム画面内の疑似表示。\nOSのタスクバー・通知領域とは連携しません。\n動作優先では一部のエフェクトを簡略化。\nゲームデータの読み込みは発生します。', 668, 316, 548, 154, C.blue);
  link(s, 'Windows版ZIPを開く', windowsVlink, 64, 566, 548, 24);
  link(s, 'ブラウザー版でプレイ', base + 'play/v-link-battle/', 668, 566, 548, 24);
  text(s, '利用する端末・組織の方針に従ってください。実行が難しい場合はWebのプレイ映像をご覧いただけます。', 64, 627, 1152, 32, 20, { color: C.muted });
  notes(s, ['src/sections/featured-works.html #vlink-editions-title', '本来の版とWeb版の機能差を省略しない。']);
}
{
  const s = gamePage('futago', '双子', 'リンク型コマンドバトル / 制作人数：6人 / Unity');
  await gameHeading(s, 'futago', '双子');
  await image(s, 'files/images/futago-gameplay.png', 64, 184, 704, 396, '双子のコマンド選択画面');
  label(s, 'どんな遊びか', 'キャラクター同士を線でつなぎ、\nダメージやバフを共有して戦う。', 814, 180, 400, 86);
  label(s, '私の担当', '企画・仕様整理・システム設計\nタスク振り分け・素材集め', 814, 327, 400, 86);
  label(s, '設計の工夫', '誰と誰をつなぎ、\nどの行動から効果を広げるか。\n共有先と残り本数を判断します。', 814, 473, 400, 113);
  link(s, '双子をプレイ', base + 'play/futago/', 64, 619, 450);
  notes(s, ['src/sections/works.html #game-futago', 'files/futago_spec.pdf p.3-4', '制作人数は利用者の確認：6人']);
}
{
  const s = page('仕様変更の経緯を、次の担当者へ残す', '双子 / 変更前・変更理由・変更後を整理');
  await image(s, media.spec, 64, 174, 664, 460, '双子の仕様書に記載した変更経緯');
  text(s, '制作仕様書 p.3 抜粋', 64, 635, 664, 26, 17, { color: C.muted });
  label(s, '変更前', 'ダメージ・バフに加え、\nパッシブ効果を共有する\n第3のリンクを検討していました。', 780, 176, 436, 102);
  label(s, '変更理由と変更後', '優先度の高い2種類を先に固め、\nパッシブリンクは実装を見送りました。\n影響する仕様も一緒に記録しています。', 780, 341, 436, 102);
  label(s, '引き継ぎで意識したこと', '実装の確認結果と、採用した理由を\n分けて記載。理由が未確認の変更は、\n推測で埋めず課題として残します。', 780, 505, 436, 108);
  notes(s, ['files/futago_spec.pdf p.3 F-C01・F-C02', 'documents/specifications/specifications.json']);
}
{
  const s = gamePage('line-boundary', '線のこちら側 / 向こう側', 'パズルアクション / 制作人数：4人 / Unity');
  await gameHeading(s, 'line-boundary', '線のこちら側 / 向こう側');
  await image(s, 'files/images/line-boundary-gameplay.png', 64, 184, 704, 396, '境界線を引いて重力の異なる空間を作る画面');
  label(s, 'どんな遊びか', '線を境に、重力のある領域と\n無重力の領域を作ります。', 814, 180, 400, 84);
  label(s, '私の担当', '企画・仕様整理・レベルデザイン\nタスク振り分け・素材集め', 814, 326, 400, 85);
  label(s, '企画意図', '用意された道を通るだけでなく、\n線の置き方で攻略方法を\n作り出す楽しさを目指しました。', 814, 470, 400, 114);
  link(s, '線のこちら側 / 向こう側をプレイ', base + 'play/line-boundary/', 64, 619, 640);
  notes(s, ['src/sections/works.html #game-line-boundary', 'files/line-boundary_proposal.pdf p.3-7', '制作人数は利用者の確認：4人']);
}
{
  const s = page('異なる遊びを考え、形にする', 'チーム制作 / 制作人数：各4人 / Unity');
  await image(s, 'files/game-icons/teruteru-wars.png', 64, 174, 56, 56, 'てるてるウォーズのアイコン');
  text(s, 'てるてるウォーズ', 138, 176, 460, 49, 31, { bold: true });
  await image(s, 'files/game-icons/hanten-assassination.jpeg', 668, 174, 56, 56, '反転暗殺のアイコン');
  text(s, '反転暗殺', 742, 176, 470, 49, 31, { bold: true });
  await image(s, 'files/images/teruteru-wars-gameplay.png', 64, 250, 548, 308, 'てるてる坊主を配置するタワーディフェンス');
  await image(s, 'files/images/hanten-assassination-gameplay.png', 668, 250, 548, 308, '盤面を反転させて敵を避けるゲーム画面');
  text(s, '通常・逆さの切替と特殊能力で防衛。\n担当：企画・仕様整理・プログラムなど', 64, 578, 548, 80, 23);
  text(s, '盤面反転で安全と危険が入れ替わる。\n担当：企画・仕様整理・レベル設計など', 668, 578, 548, 80, 23);
  notes(s, ['src/sections/works.html #game-teruteru-wars, #game-hanten-assassination', '制作人数は利用者の確認：各4人']);
}
{
  const s = gamePage('sanshoku-bunki', '三色の分岐係', '仕分けアクション / 制作人数：5人 / Unity');
  await gameHeading(s, 'sanshoku-bunki', '三色の分岐係');
  await image(s, 'files/images/sanshoku-bunki-gameplay.png', 64, 184, 704, 396, '三方向への仕分けと上方向への返却を行うゲーム画面');
  label(s, '遊びの核', '流れてくる品物を見分け、\n分岐を切り替えて仕分けます。\n不良品は上へ送り返します。', 814, 180, 400, 105);
  label(s, '私の担当', '企画立案・システム設計\nルール設計・タスク振り分け\n画像・SEの用意', 814, 341, 400, 105);
  label(s, '判断する面白さ', '品物の種類と状態を見て、\n分岐に着く前に送り先を決定。\n選択と結果を点灯や演出で表示。', 814, 500, 400, 105);
  link(s, '三色の分岐係をプレイ', 'https://unityroom.com/games/sansyokunobunkigakari', 64, 619, 600);
  notes(s, ['src/sections/works.html #game-sanshoku-bunki', '利用者の確認：5人制作、プランナー・企画立案・システムとルール設計・タスク振り分け・画像・SEの用意']);
}
{
  const s = gamePage('bug-hunter', 'バグハンター', '企画・改善の検討 / 制作人数：1人 / プログラムはAIの実装支援を利用');
  await gameHeading(s, 'bug-hunter', 'バグハンター');
  await image(s, 'files/images/bug-hunter-battle.png', 64, 184, 704, 396, '昆虫へ攻撃・防御・技を指示するバトル画面');
  label(s, '自分が考えたこと', '指示式バトルに転倒を加え、\n復帰を待つ隙を作る方針。\n能力値だけに頼らない勝負へ。', 814, 180, 400, 105, C.teal);
  label(s, '制作の分担', '企画と改善方針は自分で検討。\nプログラムは自作ではなく、\nAIによる実装支援を利用。', 814, 341, 400, 105, C.teal);
  label(s, 'これから取り組みたいこと', '内容と動作負荷を精査し、\n遊びを保った軽量化を目指す。\n改善前後の比較は今後の課題。', 814, 500, 400, 105, C.teal);
  link(s, 'バグハンターをプレイ', base + 'play/bug-hunter/', 64, 619, 520);
  notes(s, ['利用者の確認（2026-10-30）：制作人数は1人だが自分でプログラムを書いていない。動作負荷と内容の精査、遊びを保った軽量化・品質改善を望んでいる。', '軽量化の実施・性能向上・自作プログラムの実績は主張しない。', 'src/sections/works.html #game-bug-hunter']);
}
{
  const s = page('企画書で広げる、遊びの切り口', '以下の2件は企画書のみの作品');
  await image(s, media.dungeon, 64, 180, 548, 300, '5分ダンジョンの企画書表紙');
  await image(s, media.seibutsu, 668, 180, 548, 300, 'せいぶつマスターの企画書1ページ目');
  label(s, '5分ダンジョン', '短時間で3択を判断し、\nビルドを作るローグライク。\n焦りと選択を遊びの核にしています。', 64, 506, 548, 109);
  label(s, 'せいぶつマスター', '生物の特徴から答えを推理する\nカードゲーム。勝ちたい気持ちを、\n知りたい気持ちにつなげます。', 668, 506, 548, 109, C.teal);
  notes(s, ['files/FiveMinuteDungeon.pdf', 'files/seibutsu-master.pdf', '利用者の確認：2件とも企画書のみ。']);
}
{
  const s = page('構想中のアイデア', '企画の狙いと検討点を、Webの一覧で紹介');
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
  link(s, '構想中のアイデア一覧を見る（24案）', base + 'ideas.html', 64, 640, 940, 23);
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
  const table = s.tables.add({ rows: rows.length, columns: 4, left: 475, top: 184, width: 741, height: 441, columnWidths: [48, 285, 86, 322], values: rows.map(row => ['', ...row]) });
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
  const s = page('作品をプレイする・資料を読む', '各作品名と資料名から、公開ページへ進めます');
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
  entries.forEach(([targetTitle, title, url, proposal, spec], i) => {
    const y = 181 + i * 53;
    const n = String(titles.indexOf(targetTitle) + 1).padStart(2, '0');
    text(s, n, 64, y, 66, 35, 23, { color: C.muted });
    link(s, title + 'をプレイ', url.startsWith('https:') ? url : base + url, 140, y, 610, 25);
    if (proposal) link(s, '企画書', base + 'files/' + proposal, 815, y, 130, 23);
    if (spec) link(s, '仕様書', base + 'files/' + spec, 1000, y, 130, 23);
  });
  link(s, '5分ダンジョンの企画書', base + 'files/FiveMinuteDungeon.pdf', 140, 623, 450, 20);
  link(s, 'せいぶつマスターの企画書', base + 'files/seibutsu-master.pdf', 720, 623, 496, 20);
  notes(s, ['公開URLと資料ファイル名：src/sections/works.html, proposals.html, specifications.html', '三色の分岐係は企画書のみリンク。仕様書の公開ファイルは未確認のため掲載しない。']);
}
{
  const s = page('島本 善太', 'しまもと ぜんた / ゲームプランナー志望');
  text(s, '札幌デザイン＆テクノロジー専門学校\nスーパーゲームクリエーター専攻（4年制）\n2024年入学・2028年卒業予定', 64, 184, 1152, 126, 28);
  text(s, '自分の考えを、わかりやすく伝えられるプランナーへ。', 64, 354, 1152, 51, 32, { bold: true, color: C.blue });
  text(s, '独学で企画を学び、企画書や仕様書にまとめることに取り組んできました。\nチーム制作の経験を活かし、自分の判断を説明しながら改善を進めていきたいです。', 64, 427, 1152, 92, 25);
  link(s, 'shimachan.z@icloud.com', 'mailto:shimachan.z@icloud.com', 64, 551, 820, 27);
  link(s, 'kuon-haruto.github.io/portfolio/', base, 64, 609, 960, 27);
  notes(s, ['src/sections/about.html', 'src/sections/contact.html']);
}

for (const { slide, targetTitle, y } of contents) {
  const targetPage = titles.indexOf(targetTitle);
  if (targetPage < 0) throw new Error(`Missing contents target: ${targetTitle}`);
  text(slide, String(targetPage + 1).padStart(2, '0'), 1110, y, 106, 40, 28, { color: C.blue, align: 'right' });
  links.push({ page: slides.indexOf(slide), x: 64, y, width: 1152, height: 43, targetPage });
}

for (let i = 0; i < slides.length; i++) {
  text(slides[i], `${String(i + 1).padStart(2, '0')} / ${slides.length}`, 1108, 681, 108, 23, 16, { color: C.muted, align: 'right' });
  if (i + 1 < slides.length) {
    text(slides[i], '次：' + titles[i + 1], 64, 681, 1000, 23, 16, { color: C.muted });
    links.push({ page: i, x: 64, y: 678, width: 990, height: 29, targetPage: i + 1 });
  }
}

const candidatePath = path.join(build, 'candidate.pptx');
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
await fs.writeFile(path.join(build, 'navigation.json'), JSON.stringify({ titles, links }, null, 2));
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
  const finalPath = path.join(output, '島本善太_ポートフォリオ.pptx');
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
    layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-bullet-geometry', '--validate-heading-fit', '--require-native-table-slide', String(titles.indexOf('企画を形にするための制作スキル') + 1)],
    requiredNativeTableOwnerSlides: [titles.indexOf('企画を形にするための制作スキル') + 1], requiredNativeChartOwnerSlides: [],
    fontPolicy, verifyArtifactToolImport: true,
    receiptPath,
  });
  await fs.copyFile(verifiedPath, finalPath);
  await fs.unlink(verifiedPath);
  execFileSync(python, [path.join(root, 'tools/finalize-portfolio-pdf.py'), build, path.join(output, '島本善太_ポートフォリオ.pdf')], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, stdio: 'inherit' });
  console.log('Final portfolio files exported');
}
