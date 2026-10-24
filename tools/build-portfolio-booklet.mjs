import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = process.env.CODEX_RUNTIME || 'C:/Users/shima/.cache/codex-runtimes/codex-primary-runtime/dependencies';
process.env.RUNTIME_NODE_MODULES ||= path.join(runtime, 'node/node_modules');
const skill = process.env.PRESENTATIONS_SKILL || 'C:/Users/shima/.codex/plugins/cache/openai-primary-runtime/presentations/26.1007.11041/skills/presentations';
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
const parkingSource = 'D:/すべる宇宙船/Assets/SlidingSpaceParking';
const font = 'Meiryo';
const C = { ink: '#18242D', muted: '#556571', blue: '#155BC1', teal: '#007E80', pink: '#BB307E', white: '#FFFFFF', light: '#F2F6FA' };
const fontPolicy = { basis: 'design', families: [font] };

await fs.mkdir(build, { recursive: true });
await fs.mkdir(output, { recursive: true });

// Use real PNGs so viewers that cannot display Office SVGs keep the original colors.
const toolIcons = ['unity', 'visualstudiocode', 'git', 'microsoftpowerpoint', 'microsoftexcel', 'googlesheets', 'blender', 'unrealengine'];
for (const id of toolIcons) {
  await sharp(path.join(root, `files/icons/${id}.svg`), { density: 768 })
    .resize(256, 256).png().toFile(path.join(root, `files/icons/${id}.png`));
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
  appeal: frame('D:/自作ゲーム動画/アピール.mov', 'vlink-appeal', 2),
  comments: frame('D:/自作ゲーム動画/コメント機能.mov', 'vlink-comments', 2),
  tabs: frame('D:/自作ゲーム動画/タブ.mov', 'vlink-tabs', 3),
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
  return slide.images.add({ blob: await fs.readFile(source), contentType, alt, fit: options.fit || 'contain', position: { left: x, top: y, width: w, height: h }, ...(options.crop ? { crop: options.crop } : {}) });
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
  text(s, '企画を考え、仲間と遊べる形まで作る。', 66, 285, 1100, 46, 28);
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
    ['企画書・仕様書', '企画書で広げる、遊びの切り口'],
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
  label(s, '自分で学び、柔軟に考える', 'プランナーの役割を一人で担い、独学で企画や資料作成を進めてきました。\n遊ぶ人の気持ちや作る側の進めやすさなど、いろいろな視点から考え、\n一つの案にこだわらず、状況に合わせて企画を見直すことを意識しています。', 64, 183, 1152, 104);
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
  label(s, '公開版の特徴', '全6コース、S〜Cの評価。\nGame Centerのランキングで\nほかのプレイヤーと競えます。', 852, 387, 364, 110, C.teal);
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
  link(s, 'V-Link Battleをプレイ', base + 'play/v-link-battle/', 64, 619, 420);
  notes(s, ['src/sections/featured-works.html', '制作人数は利用者の確認：8人', '審査通過実績：src/sections/about.html']);
}
{
  const s = page('アピールに、攻撃されるリスクを持たせる', 'V-Link Battle / 配信らしさを戦い方につなげる', C.pink);
  await image(s, media.appeal, 64, 184, 704, 396, 'V-Link Battleのアピール動作');
  label(s, '狙い', '攻撃を続けるだけでなく、\n「いつ魅せるか」を考える対戦。', 814, 180, 398, 91, C.pink);
  label(s, '企画上のルール', 'アピール中は無防備。\n成功後の攻撃でボルテージを\n高める仕組みを設計しました。', 814, 346, 398, 119, C.pink);
  text(s, 'プレイヤーの判断\n相手の隙にアピールするか、先に攻撃するか。', 64, 600, 1152, 63, 24, { bold: true });
  notes(s, ['D:/企画書、ポートフォリオ、仕様書/企画書/V-LinkBattle (1).pdf p.5', 'D:/自作ゲーム動画/アピール.mov', '企画ルールの説明であり、全プラットフォームで同一演出を保証するものではない']);
}
{
  const s = page('配信文化をバトルの仕掛けにする', 'V-Link Battle / コメントと通知ウィンドウ', C.pink);
  await image(s, media.comments, 64, 179, 548, 309, 'V-Link Battleのコメント機能');
  await image(s, media.tabs, 668, 179, 548, 309, 'V-Link Battleの通知タブ');
  label(s, 'コメント', '画面を横切るコメントに効果を持たせ、\n触れるか避けるかの判断につなげます。', 64, 516, 548, 94, C.pink);
  label(s, '通知ウィンドウ', '通知の出現とゲーム内イベントを結びつけ、\n相手との間合いやタイミングを変えます。', 668, 516, 548, 94, C.pink);
  notes(s, ['D:/企画書、ポートフォリオ、仕様書/企画書/V-LinkBattle (1).pdf p.6-7', 'D:/自作ゲーム動画/コメント機能.mov', 'D:/自作ゲーム動画/タブ.mov', 'Web版はゲーム画面内の通知表示に調整。Windows版の録画を掲載。']);
}
{
  const s = gamePage('futago', '双子', 'リンク型コマンドバトル / 制作人数：6人 / Unity');
  await gameHeading(s, 'futago', '双子');
  await image(s, 'files/images/futago-gameplay.png', 64, 184, 704, 396, '双子のコマンド選択画面');
  label(s, 'どんな遊びか', 'キャラクター同士を線でつなぎ、\nダメージやバフを共有して戦う。', 814, 180, 400, 86);
  label(s, '私の担当', '企画・仕様整理・システム設計\nタスク振り分け・素材集め', 814, 327, 400, 86);
  label(s, '設計の工夫', '誰と誰をつなぐかに加え、\nリンクの発動順と使用回数を\n判断する仕組みを考えました。', 814, 473, 400, 113);
  link(s, '双子をプレイ', base + 'play/futago/', 64, 619, 450);
  notes(s, ['src/sections/works.html #game-futago', 'files/futago_spec.pdf p.3-4', '制作人数は利用者の確認：6人']);
}
{
  const s = page('仕様で、実装範囲と例外処理を共有する', '双子 / 完成に向けた優先順位と、残った課題');
  await image(s, media.spec, 64, 174, 664, 460, '双子のリンクシステム仕様書の上部抜粋', { crop: { left: 0, top: 0, right: 0, bottom: 0.45 } });
  text(s, '制作仕様書 p.3 抜粋', 64, 635, 664, 26, 17, { color: C.muted });
  label(s, '先に固めたもの', 'ダメージリンクとバフリンクを優先。\nパッシブリンクは実装を見送りました。', 780, 176, 436, 90);
  label(s, 'ルールにしたもの', '発動済みリンクの削除。\n重複回数の制限と、\n死亡した対象への効果の扱い。', 780, 341, 436, 102);
  label(s, '次に改善したいこと', '複雑になった発動順を、\nチーム内でより伝わる言葉と\n手順に整理することです。', 780, 505, 436, 108);
  notes(s, ['files/futago_spec.pdf p.3-5', '仕様書に記載された実装の優先順位と振り返りを要約。']);
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
  const s = gamePage('bug-hunter', 'バグハンター', '昆虫育成・指示式バトル / 制作人数：1人 / Unity');
  await gameHeading(s, 'bug-hunter', 'バグハンター');
  await image(s, 'files/images/bug-hunter-battle.png', 64, 184, 704, 396, '昆虫へ攻撃・防御・技を指示するバトル画面');
  label(s, '企画の出発点', '外で虫取りができなくても、\n捕まえて育てる楽しさを届けたい。', 814, 180, 400, 86, C.teal);
  label(s, '指示式のバトル', '移動や接近は昆虫が行います。\nプレイヤーは攻撃・防御・技を\n選んで指示します。', 814, 334, 400, 100, C.teal);
  label(s, '能力値だけで決まらない勝負', '転倒からの復帰中は無防備。\n個体差に加え、体勢や運も\n勝敗を左右する仕組みです。', 814, 487, 400, 115, C.teal);
  link(s, 'バグハンターをプレイ', base + 'play/bug-hunter/', 64, 619, 520);
  notes(s, ['src/sections/works.html #game-bug-hunter', 'src/sections/proposals.html #proposal-bug-hunter', '利用者が提示した指示式バトル、転倒・復帰時間・運の設計方針。']);
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
    ['04', 'すべる宇宙駐車場', 'https://unityroom.com/games/sliding-space-parking', null, null],
    ['07', 'V-Link Battle', 'play/v-link-battle/', null, null],
    ['10', '双子', 'play/futago/', 'futago_proposal.pdf', 'futago_spec.pdf'],
    ['12', '線のこちら側 / 向こう側', 'play/line-boundary/', 'line-boundary_proposal.pdf', 'kochiratomukou_spec.pdf'],
    ['13', 'てるてるウォーズ', 'play/teruteru-wars/', 'teruteruwars_proposal.pdf', 'teruteru-wars_spec.pdf'],
    ['13', '反転暗殺', 'play/hanten-assassination/', 'hantenansatsu_proposal.pdf', 'hanntenn-ansatu_spec.pdf'],
    ['14', 'バグハンター', 'play/bug-hunter/', 'mushi-shooting.pdf', null],
  ];
  entries.forEach(([n, title, url, proposal, spec], i) => {
    const y = 181 + i * 61;
    text(s, n, 64, y, 66, 35, 23, { color: C.muted });
    link(s, title + 'をプレイ', url.startsWith('https:') ? url : base + url, 140, y, 610, 25);
    if (proposal) link(s, '企画書', base + 'files/' + proposal, 815, y, 130, 23);
    if (spec) link(s, '仕様書', base + 'files/' + spec, 1000, y, 130, 23);
    if (title === 'すべる宇宙駐車場') link(s, 'App Store', appStore, 815, y, 350, 23);
  });
  link(s, '5分ダンジョンの企画書', base + 'files/FiveMinuteDungeon.pdf', 140, 623, 450, 20);
  link(s, 'せいぶつマスターの企画書', base + 'files/seibutsu-master.pdf', 720, 623, 496, 20);
  notes(s, ['公開URLと資料ファイル名：src/sections/works.html, proposals.html, specifications.html', 'V-Link Battleの企画書はWeb未公開のため公開リンクを掲載していません。']);
}
{
  const s = page('島本 善太', 'しまもと ぜんた / ゲームプランナー志望');
  text(s, '札幌デザイン＆テクノロジー専門学校\nスーパーゲームクリエーター専攻（4年制）\n2024年入学・2028年卒業予定', 64, 184, 1152, 126, 28);
  text(s, '考えた遊びを、仲間と形にできるプランナーになりたい。', 64, 354, 1152, 51, 32, { bold: true, color: C.blue });
  text(s, '独学で企画を学び、企画書や仕様書にまとめることに取り組んできました。\nこれからは、自分の考えをもっとわかりやすく伝えられるようになりたいです。', 64, 427, 1152, 92, 25);
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
    layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-bullet-geometry', '--validate-heading-fit', '--require-native-table-slide', '16'],
    requiredNativeTableOwnerSlides: [16], requiredNativeChartOwnerSlides: [],
    fontPolicy, verifyArtifactToolImport: true,
    receiptPath,
  });
  await fs.copyFile(verifiedPath, finalPath);
  await fs.unlink(verifiedPath);
  execFileSync(python, [path.join(root, 'tools/finalize-portfolio-pdf.py'), build, path.join(output, '島本善太_ポートフォリオ.pdf')], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, stdio: 'inherit' });
  console.log('Final portfolio files exported');
}
