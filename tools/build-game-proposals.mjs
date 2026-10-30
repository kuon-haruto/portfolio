import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = process.env.CODEX_RUNTIME || 'C:/Users/shima/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const skill = process.env.PRESENTATIONS_SKILL || 'C:/Users/shima/.codex/plugins/cache/openai-primary-runtime/presentations/26.1026.10807/skills/presentations';
process.env.RUNTIME_NODE_MODULES ||= path.join(runtime, 'node/node_modules');
const { Presentation, PresentationFile } = await import(pathToFileURL(path.join(runtime, 'node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs')));
const { finalizePresentation } = await import(pathToFileURL(path.join(skill, 'container_tools/artifact_tool_utils.mjs')));
const build = path.join(root, 'launcher/test-output/proposals');
const output = path.join(root, 'documents/proposals');
const font = 'Meiryo';
const base = 'https://kuon-haruto.github.io/portfolio/';
const assets = 'documents/proposals/assets/';
const metadata = [];
await fs.mkdir(build, { recursive: true });

function deck(id, title, theme, sources) {
  const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
  p.theme.defaultFont = font;
  p.theme.colorScheme = { name: title, themeColors: {
    accent1: theme.accent, accent2: '#24B6AC', accent3: '#FBD069',
    accent4: '#E85166', accent5: '#8F78CD', accent6: '#4B985A',
    bg1: theme.bg, bg2: theme.bg, tx1: theme.ink, tx2: theme.muted,
    dk1: '#111111', dk2: '#222222', lt1: '#FFFFFF', lt2: '#EEEEEE',
    hlink: theme.accent, folHlink: theme.accent,
  } };
  return { id, title, theme, sources, p, titles: [], links: [] };
}
function text(d, s, value, x, y, w, h, size = 27, color = d.theme.ink, bold = false) {
  const shape = s.shapes.add({ name: value.slice(0, 36), geometry: 'textbox', position: { left: x, top: y, width: w, height: h }, fill: 'none', line: { fill: 'none', width: 0 } });
  shape.text = value;
  shape.text.style = { typeface: font, fontSize: size, color, bold, insets: 0, autoFit: 'none', verticalAlignment: 'top', wrap: 'square', lineSpacing: 1.18 };
  return shape;
}
async function image(s, file, x, y, w, h, alt) {
  const contentType = /\.jpe?g$/i.test(file) ? 'image/jpeg' : 'image/png';
  s.images.add({ blob: await fs.readFile(path.join(root, file)), contentType, alt, fit: 'contain', position: { left: x, top: y, width: w, height: h } });
}
function page(d, title, subtitle) {
  const s = d.p.slides.add();
  s.background.fill = d.theme.bg;
  d.titles.push(title);
  text(d, s, title, 64, 46, 1152, 70, 44, d.theme.ink, true);
  if (subtitle) text(d, s, subtitle, 64, 120, 1152, 42, 24, d.theme.accent);
  s.speakerNotes.text = '根拠資料\n' + d.sources.join('\n') + '\n想定プレイヤー・企画の狙いは提案上の位置付け。市場調査の結果ではありません。';
  return s;
}
function block(d, s, heading, body, x, y, w, height = 112) {
  text(d, s, heading, x, y, w, 42, 28, d.theme.accent, true);
  text(d, s, body, x, y + 50, w, height, 26);
}
function link(d, s, label, url, x, y, w = 1100) {
  const sh = text(d, s, label, x, y, w, 40, 25, d.theme.accent, true);
  sh.text.get(label).link = { uri: url, isExternal: true };
  d.links.push({ page: d.p.slides.items.indexOf(s), label, url, x, y, width: w, height: 40 });
}
async function save(d) {
  const dir = path.join(build, d.id);
  await fs.mkdir(dir, { recursive: true });
  const candidatePath = path.join(dir, 'candidate.pptx');
  await (await PresentationFile.exportPptx(d.p)).save(candidatePath);
  const verified = path.join(dir, 'validated', 'proposal.pptx');
  await fs.mkdir(path.dirname(verified), { recursive: true });
  const receipt = path.join(dir, 'validation.json');
  await fs.rm(verified, { force: true });
  await fs.rm(receipt, { force: true });
  await finalizePresentation({
    workspaceDir: root, candidatePath, finalPath: verified,
    pythonExecutable: path.join(runtime, 'python/python.exe'),
    integrityValidatorPath: path.join(skill, 'container_tools/inspect_presentation_package_integrity.py'),
    layoutValidatorPath: path.join(skill, 'container_tools/inspect_presentation_layout_geometry.py'),
    layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-heading-fit'],
    explicitTotalSlideCount: 6, requiredNativeTableOwnerSlides: [], requiredNativeChartOwnerSlides: [],
    fontPolicy: { basis: 'design', families: [font] }, verifyArtifactToolImport: true, receiptPath: receipt,
  });
  const pptx = path.join(output, `${d.id}_proposal.pptx`);
  await fs.copyFile(verified, pptx);
  await fs.unlink(verified);
  const pdf = path.join(root, 'files', `${d.id}_proposal.pdf`);
  const candidatePdf = path.join(dir, 'candidate.pdf');
  const command = `
$ErrorActionPreference = 'Stop'
$app = New-Object -ComObject PowerPoint.Application
$existing = $app.Presentations.Count
$deck = $null
try {
  $deck = $app.Presentations.Open($env:PROPOSAL_PPTX, $true, $false, $false)
  $deck.SaveAs($env:PROPOSAL_PDF, 32)
} finally {
  if ($null -ne $deck) { $deck.Close() }
  if ($existing -eq 0) { $app.Quit() }
}`;
  execFileSync('powershell.exe', ['-NoProfile', '-Command', command], { env: { ...process.env, PROPOSAL_PPTX: pptx, PROPOSAL_PDF: candidatePdf }, stdio: 'inherit' });
  const navigation = path.join(dir, 'navigation.json');
  await fs.writeFile(navigation, JSON.stringify({ title: d.title, titles: d.titles, links: d.links }));
  execFileSync(path.join(runtime, 'python/python.exe'), [path.join(root, 'tools/finalize-proposal-pdf.py'), candidatePdf, navigation, pdf], { stdio: 'inherit' });
  execFileSync(path.join(runtime, 'native/poppler/Library/bin/pdftoppm.exe'), ['-scale-to', '1280', '-png', pdf, path.join(dir, 'page')]);
  metadata.push({ id: d.id, title: d.title, pages: 6, titles: d.titles, pptx: path.relative(root, pptx).replaceAll('\\', '/'), pdf: path.relative(root, pdf).replaceAll('\\', '/'), links: d.links });
  console.log(`Created ${d.id}: PPTX + PDF, 6 pages`);
}

const v = deck('v-link-battle', 'V-Link Battle', { bg: '#211E2B', ink: '#FAF8FF', muted: '#C5BDCE', accent: '#FF72B5' }, [
  '既存企画資料：D:/企画書、ポートフォリオ、仕様書/企画書/V-LinkBattle (1).pdf',
  '担当・制作人数：src/sections/featured-works.html、利用者確認（8人）',
  '掲載映像：files/Vlinkvideo.mp4（対戦24秒、コメント30秒、キャラクター選択12秒）',
  '公開版の差異：tools/vlink-web/README.md、documents/specifications/specifications.json',
]);
{
  const s = page(v, 'V-Link Battle', 'VTuberの配信文化を題材にした3D対戦アクション');
  await image(s, 'files/images/v-link-battle.jpg', 420, 190, 796, 448, '氷の攻撃とコメントが飛び交う対戦画面');
  text(v, s, '魅せる行動を、\n勝つための\n戦略に。', 64, 211, 346, 218, 46, v.theme.ink, true);
  text(v, s, '攻撃するだけでなく、\n相手の隙にアピール。\n配信の盛り上がりを\n戦いの力へ変える企画。', 64, 441, 346, 150, 25);
  text(v, s, '制作人数：8人 / Unity\n企画書作成：島本善太', 64, 605, 350, 58, 18, v.theme.muted);
}
{
  const s = page(v, '企画の核とプレイヤー体験', '対戦の駆け引きに、配信者らしい「見せ場」を加える');
  await image(s, 'files/game-icons/v-link-battle.png', 64, 193, 340, 340, 'V-Link Battleのタイトルロゴ');
  block(v, s, '想定するプレイヤー', 'VTuberや配信文化に親しみがあり、\n相手との読み合いや対戦を楽しみたい人。', 460, 194, 756, 85);
  block(v, s, '基本の遊び', '攻撃・ガード・移動で相手のHPを削る。\nそこにアピールを挟み、\n次の攻撃につながる機会を作る。', 460, 363, 756, 112);
  text(v, s, '目指す体験：勝つための判断そのものが、キャラクターの見せ場になる。', 64, 590, 1152, 68, 29, v.theme.accent, true);
}
{
  const s = page(v, 'アピールが生むリスクと見返り', '企画上のルール：攻撃を止める瞬間にも、判断を持たせる');
  await image(s, assets + 'vlink-battle.jpg', 64, 190, 736, 414, '現在掲載している映像の対戦画面。アピールの瞬間を示す画像ではなく、企画ルールの背景として掲載');
  block(v, s, '隙を見つけて魅せる', 'アピール中は無防備。\n成功後の攻撃で\nボルテージを高める。', 842, 191, 374, 115);
  block(v, s, '読み合いの場面', '安全に攻撃を続けるか。\n相手の動きを読んで、\nアピールを挟むか。', 842, 397, 374, 115);
  text(v, s, 'ボルテージを高め、必殺技の見せ場へつなぐ構想。', 64, 620, 1152, 40, 25, v.theme.accent);
}
{
  const s = page(v, '配信を感じさせる画面と演出', 'コメントとウィンドウ風の画面で、デジタルな世界観を伝える');
  await image(s, assets + 'vlink-comments.jpg', 64, 185, 552, 311, '現在掲載している対戦映像。立体のコメントが流れる');
  await image(s, assets + 'vlink-selection.jpg', 664, 185, 552, 311, '現在掲載しているキャラクター選択画面。ブラウザー風の枠内にキャラクターを表示');
  block(v, s, '立体的なコメント', '戦闘空間を横切る言葉で、\n配信の賑わいを表現する。', 64, 514, 552, 81);
  block(v, s, 'ウィンドウ風の画面', 'キャラクター選択もブラウザー風の枠に。\n対戦前から作品の世界観を伝える。', 664, 514, 552, 81);
}
{
  const s = page(v, '企画の見どころと公開版の違い', '企画上の構想と、試遊できる範囲を分けてご案内します');
  block(v, s, '見どころ', '配信文化を背景だけでなく、アピールや戦闘中の出来事に結び付けること。\n氷の攻撃、立体のコメント、ウィンドウ演出でデジタルな雰囲気を作ります。', 64, 190, 1152, 88);
  block(v, s, 'Windows版とブラウザー版', 'Windows版はOSの別ウィンドウを使う演出に対応。\nブラウザー版はゲーム内の疑似表示で、一部のエフェクトも簡略化しています。', 64, 359, 1152, 88);
  text(v, s, '企画にある通知・コメントの一部ギミックは、現行ソースで無効になっています。\n全構想を公開版に実装済みとして紹介するものではありません。', 64, 545, 1152, 90, 24, v.theme.muted);
}
{
  const s = page(v, '制作体制と作品への入口', '制作人数：8人 / 開発環境：Unity / PC向け');
  block(v, s, '私の担当', '企画・仕様整理・システム設計・タスク振り分け。\n素材集め、3Dオブジェクト、エフェクト、アニメーションの制作にも参加。', 64, 191, 1152, 88);
  text(v, s, '配信文化のどの要素を遊びにするか整理し、制作へつなげました。', 64, 362, 1152, 60, 29, v.theme.ink, true);
  link(v, s, 'ブラウザー版をプレイ', base + 'play/v-link-battle/', 64, 463);
  link(v, s, 'Windows版・プレイ映像を見る', base + '#featured-works', 64, 522);
  text(v, s, '実行ファイルを利用できない環境にも、ブラウザー版と映像を用意しています。\n利用可否は所属先のセキュリティ方針に従ってください。', 64, 590, 1152, 70, 22, v.theme.muted);
}
await save(v);

const p = deck('sliding-space-parking', 'すべる宇宙駐車場', { bg: '#111D25', ink: '#FAFCFA', muted: '#BCCBD0', accent: '#FBD069' }, [
  '既存企画・担当確認：src/sections/featured-works.html、制作人数4人（利用者確認）',
  'ゲームルール：D:/すべる宇宙船/Assets/SlidingSpaceParking/Docs/Spec.md',
  'iOS版：同プロジェクト Docs/iOS.md、files/images/sliding-space-parking-store-*.jpg',
  '公開先：https://apps.apple.com/jp/app/id6816609277、https://unityroom.com/games/sliding-space-parking',
]);
{
  const s = page(p, 'すべる宇宙駐車場', '慣性で滑る船を、逆噴射でぴたりと駐車。');
  await image(s, 'files/images/sliding-space-parking-store-title.jpg', 64, 184, 1152, 440, 'App Store掲載のタイトル画面');
  text(p, s, 'App Store・unityroom公開 / 制作人数：4人 / Unity / 企画書作成：島本善太', 64, 633, 1152, 34, 22, p.theme.accent);
}
{
  const s = page(p, '身近な「駐車」を、慣性で難しくする', '目的は、宇宙船を駐車枠の中で止めること');
  await image(s, 'files/images/sliding-space-parking-store-gameplay.jpg', 64, 192, 1152, 352, '障害物を回り込んで駐車枠へ進む実際のゲーム画面');
  block(p, s, '操作と狙い', '噴射で進み、反対向きの噴射で減速。\n入力を離しても進むため、止め時を考えます。', 64, 553, 560, 71);
  block(p, s, '想定するプレイヤー', '少ない操作で試行錯誤を楽しみたい人。\n微調整して成功する達成感を狙います。', 664, 553, 552, 71);
}
{
  const s = page(p, '面白さは「いつ減速を始めるか」', '進む方向だけでなく、止まるまでの距離を読む');
  await image(s, assets + 'parking-ship.png', 100, 210, 290, 300, 'ゲームで使用している宇宙船のドット絵');
  block(p, s, '枠が近づいてからでは、行き過ぎる', '勢いをつけすぎると、逆噴射してもすぐには止まらない。\n少し手前で減速し、最後は小さく調整する。', 460, 194, 756, 95);
  block(p, s, '失敗から次の操作を考えられる', '行き過ぎたら、次は早めに逆噴射。\n止まりすぎたら、少しだけ噴射を足す。\n距離感をつかむ過程を遊びにします。', 460, 382, 756, 125);
  text(p, s, '狙った枠に収まった瞬間、「自分で止めた」と感じられる設計。', 64, 596, 1152, 62, 29, p.theme.accent, true);
}
{
  const s = page(p, '宇宙の駐車場で、進路とタイミングを読む', 'ドット絵の船と立体的な空間で、宇宙らしい浮遊感を表現');
  await image(s, 'files/images/sliding-space-parking-store-meteor.jpg', 64, 192, 1152, 352, '隕石や障害物があるApp Store掲載のコース画面');
  block(p, s, '障害物のあるコース', '曲がる前に減速し、次の進路を整える。\n通路の形で噴射の使い方が変わります。', 64, 553, 560, 71);
  block(p, s, '隕石の予告', '進む先の危険を見て、待つか進むか判断。\n慣性の操作にタイミングの緊張感を加えます。', 664, 553, 552, 71);
}
{
  const s = page(p, 'クリアの次は、もっと少ない噴射で', '記録を見比べ、操作の上達を実感する');
  await image(s, 'files/images/sliding-space-parking-store-result.jpg', 64, 191, 778, 400, '時間・操作回数・衝突回数が並ぶリザルト画面');
  block(p, s, 'やり直す目標が見える', '走行時間・操作回数・\n衝突回数で振り返る。\n次に減らしたいミスを\n決めて再挑戦する。', 883, 191, 333, 159);
  block(p, s, 'iOS公開版', '全6コース、S〜C評価。\nGame Centerの\nランキングにも対応。', 883, 421, 333, 113);
  text(p, s, '初回は駐車成功を、慣れてきたら自分の記録更新を目指す構成。', 64, 617, 1152, 42, 27, p.theme.accent);
}
{
  const s = page(p, '制作体制と公開先', '制作人数：4人 / 開発環境：Unity 6');
  await image(s, 'files/game-icons/sliding-space-parking.png', 64, 194, 300, 300, '公開アプリのアイコン');
  block(p, s, '私の担当', '企画立案・整理・画像作成・SE。\n慣性と駐車を組み合わせた遊びをまとめ、\n画面や音の素材づくりにも取り組みました。', 430, 194, 786, 122);
  block(p, s, '公開形態', 'iPhone・iPad向けにApp Storeで公開。\nPCではunityroomからブラウザーでプレイできます。', 430, 390, 786, 90);
  link(p, s, 'App Storeで見る', 'https://apps.apple.com/jp/app/id6816609277', 64, 559);
  link(p, s, 'unityroomでプレイ', 'https://unityroom.com/games/sliding-space-parking', 64, 616);
}
await save(p);

const c = deck('sanshoku-bunki', '三色の分岐係', { bg: '#F3F5F5', ink: '#202D36', muted: '#53616D', accent: '#2364AD' }, [
  '作品紹介：src/sections/works.html #game-sanshoku-bunki',
  '実装：D:/三色分岐/Assets/Scripts/Luggage/RouteJudge.cs、UpJudge.cs、Core/Manager/HPManager.cs',
  '掲載画像：D:/三色分岐/Assets/Images/Background、Item、Tutorial の既存素材',
  '制作人数5人・担当：利用者確認。公開先：https://unityroom.com/games/sansyokunobunkigakari',
]);
{
  const s = page(c, '三色の分岐係', '品物を見分け、分岐を切り替える仕分けアクション');
  await image(s, assets + 'sanshoku-title.png', 64, 186, 664, 442, 'ゲームで使用している三色の分岐係のタイトルロゴ');
  text(c, s, '種類だけでは\n決められない。', 792, 216, 424, 136, 43, c.theme.ink, true);
  text(c, s, '流れてきた品物を見て、\n正しいレーンへ。\n壊れていたら、\n仕分けずに送り返す。', 792, 385, 424, 168, 29);
  text(c, s, '制作人数：5人 / Unity 6\n企画書作成：島本善太', 792, 590, 424, 66, 22, c.theme.muted);
}
{
  const s = page(c, '流れる品物を、その場で判断する', '「何の品物か」と「正常か」を見分ける遊び');
  await image(s, 'files/images/sanshoku-bunki-gameplay.png', 64, 183, 760, 423, '分岐点と三方向のレーンがあるゲーム画面');
  block(c, s, '基本の流れ', '品物を見る。\n送る方向を選ぶ。\n結果を確認して、次へ。', 866, 194, 350, 117);
  block(c, s, '想定するプレイヤー', '観察と素早い判断で、\nスコア更新を楽しみたい人。\n少ないキーで挑戦できます。', 866, 397, 350, 117);
  text(c, s, '分岐点までの短い時間に、判断を間に合わせる緊張感を狙います。', 64, 620, 1152, 42, 27, c.theme.accent, true);
}
{
  const s = page(c, '同じ種類でも、送り先が変わる', '正常品は仕分け、不良品は返却');
  await image(s, assets + 'sanshoku-normal.png', 127, 192, 262, 262, '正常なロボットのゲーム素材');
  await image(s, assets + 'sanshoku-defective.png', 459, 192, 262, 262, '腕が壊れたロボットのゲーム素材');
  text(c, s, '正常品', 171, 474, 250, 43, 31, '#2364AD', true);
  text(c, s, '不良品', 503, 474, 250, 43, 31, '#B82B36', true);
  block(c, s, '形の違いを見落とさない', '「ロボットだから同じ方向」\nと決めつけるとミスになる。\n種類を判断したあとに、\n壊れていないか確かめる。', 790, 216, 426, 159);
  text(c, s, '反射的な仕分けに「もう一度見る」判断を加え、単純作業にしない。', 64, 580, 1152, 70, 29, c.theme.ink, true);
}
{
  const s = page(c, '三方向への仕分けと、上への返却', 'キーの位置と、画面上の方向を対応させる');
  await image(s, assets + 'sanshoku-sort.png', 64, 191, 520, 342, '赤く点灯した左レーンへ品物を送る実際のチュートリアル画像');
  await image(s, assets + 'sanshoku-return.png', 706, 191, 300, 342, '不良品を上方向へ戻すチュートリアル画像');
  block(c, s, '正常品を三方向へ', 'A・S・Dで左・下・右を選択。\nレーンの点灯で選んだ方向を確認できます。', 64, 551, 560, 75);
  block(c, s, '不良品は上へ', 'Wで返却。種類が合っていても、\n不良品を通常レーンへ送るとミスになります。', 664, 551, 552, 75);
}
{
  const s = page(c, '結果がすぐ伝わる、スコアへの挑戦', '正解・不正解の演出で、次の判断につなげる');
  await image(s, assets + 'sanshoku-mistakes.png', 64, 196, 560, 230, 'ゲーム内の仕分けエラー表示');
  block(c, s, 'あと何回間違えられるか', 'ミスはランプで可視化。\n5回ミスするまでに、\nどこまでスコアを伸ばせるか挑戦します。', 64, 459, 560, 112);
  block(c, s, '成功と失敗の手応え', '音と表示で結果をその場で確認。\n間違えた品物の見方を修正し、\n次の仕分けへ気持ちを切り替える。', 704, 204, 512, 125);
  block(c, s, '工場らしい見た目', 'ベルトコンベア、操作卓、作業員を配置。\n分岐の点灯と作業員の動きで、\n自分が仕分けを操作する感覚を支えます。', 704, 438, 512, 126);
}
{
  const s = page(c, '制作体制と公開先', '制作人数：5人 / 開発環境：Unity 6 / PCブラウザー');
  await image(s, 'files/game-icons/sanshoku-bunki.png', 64, 203, 320, 250, '公開作品のアイコン');
  block(c, s, '私の担当', 'プランナー・企画立案・システム／ルール設計。\nタスクの振り分け、画像・SEの用意を担当。', 444, 201, 772, 91);
  block(c, s, '企画でまとめたこと', '三方向へ送る仕分けと、不良品を返す判断を整理。\nプレイヤーが何を見て、どこへ送るかを\nチームで共有できるルールにまとめました。', 444, 379, 772, 126);
  link(c, s, 'unityroomで「三色の分岐係」をプレイ', 'https://unityroom.com/games/sansyokunobunkigakari', 64, 594);
}
await save(c);
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(metadata, null, 2) + '\n');
