import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = process.env.CODEX_RUNTIME || 'C:/Users/shima/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const skill = process.env.PRESENTATIONS_SKILL || 'C:/Users/shima/.codex/plugins/cache/openai-primary-runtime/presentations/26.1116.12010/skills/presentations';
process.env.RUNTIME_NODE_MODULES ||= path.join(runtime, 'node/node_modules');
const { Presentation, PresentationFile } = await import(pathToFileURL(path.join(runtime, 'node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs')));
const { finalizePresentation } = await import(pathToFileURL(path.join(skill, 'container_tools/artifact_tool_utils.mjs')));
const build = path.join(root, 'launcher/test-output/proposals');
const output = path.join(root, 'documents/proposals');
const font = 'Meiryo';
const base = 'https://kuon-haruto.github.io/portfolio/';
const assets = 'documents/proposals/assets/';
const metadata = [];
const selectedIds = process.argv.find(arg => arg.startsWith('--only='))?.slice(7).split(',');
const existingMetadata = selectedIds ? JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8')) : [];
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
  if (selectedIds && !selectedIds.includes(d.id)) {
    const previous = existingMetadata.find(item => item.id === d.id);
    if (!previous) throw new Error(`Missing existing manifest entry: ${d.id}`);
    metadata.push(previous);
    return;
  }
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
    explicitTotalSlideCount: d.titles.length, requiredNativeTableOwnerSlides: [], requiredNativeChartOwnerSlides: [],
    fontPolicy: { basis: 'design', families: [font] }, verifyArtifactToolImport: true, receiptPath: receipt,
  });
  const pptx = path.join(output, `${d.id}_proposal.pptx`);
  await fs.copyFile(verified, pptx);
  await fs.unlink(verified);
  const pdf = path.join(root, 'files', d.pdfName || `${d.id}_proposal.pdf`);
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
  metadata.push({ id: d.id, title: d.title, pages: d.titles.length, titles: d.titles, pptx: path.relative(root, pptx).replaceAll('\\', '/'), pdf: path.relative(root, pdf).replaceAll('\\', '/'), links: d.links });
  console.log(`Created ${d.id}: PPTX + PDF, ${d.titles.length} pages`);
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
  text(v, s, '制作人数：8人 / Unity\n企画書作成：ゲーム企画', 64, 605, 350, 58, 18, v.theme.muted);
}
{
  const s = page(v, '企画の核とプレイヤー体験', '対戦の駆け引きに、配信者らしい「見せ場」を加える');
  await image(s, 'files/game-icons/v-link-battle.png', 64, 193, 340, 340, 'V-Link Battleのタイトルロゴ');
  block(v, s, '想定するプレイヤー', 'VTuberや配信文化に親しみがあり、\n相手との読み合いや対戦を楽しみたい人。', 460, 194, 756, 85);
  block(v, s, '企画で目指す遊び', '攻撃・ガード・移動の駆け引きに、\nアピールする隙を探す判断を加える。\n公開版との違いは後のページで示します。', 460, 363, 756, 112);
  text(v, s, '目指す体験：勝つための判断そのものが、キャラクターの見せ場になる。', 64, 590, 1152, 68, 29, v.theme.accent, true);
}
{
  const s = page(v, 'アピールが生むリスクと見返り', '企画上のルール：攻撃を止める瞬間にも、判断を持たせる');
  await image(s, assets + 'vlink-battle.jpg', 64, 190, 736, 414, '現在掲載している映像の対戦画面。アピールの瞬間を示す画像ではなく、企画ルールの背景として掲載');
  block(v, s, '隙を見つけて魅せる', 'アピール中は無防備。\n成功後の攻撃で\nボルテージを高める。', 842, 191, 374, 115);
  block(v, s, '読み合いの場面', '安全に攻撃を続けるか。\n相手の動きを読んで、\nアピールを挟むか。', 842, 397, 374, 115);
  text(v, s, '企画上の構想です。上の対戦画面は、アピールの動作を示すものではありません。', 64, 620, 1152, 40, 23, v.theme.accent);
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
  text(p, s, 'App Store・unityroom公開 / 制作人数：4人 / Unity / 企画書作成：ゲーム企画', 64, 633, 1152, 34, 22, p.theme.accent);
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
  block(p, s, '私の担当', '企画立案・整理・画像作成・SE。\nドット絵にChatGPT画像生成を使用し、\n画像・音には生成スクリプトも利用しています。', 430, 194, 786, 122);
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
  text(c, s, '制作人数：5人 / Unity 6\n企画書作成：ゲーム企画', 792, 590, 424, 66, 22, c.theme.muted);
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
const reviewed = JSON.parse(await fs.readFile(path.join(output, 'reviewed-proposals.json'), 'utf8'));
for (const game of reviewed.games) {
  const d = deck(game.id, game.title, { bg: '#F3F5F5', ink: '#202D36', muted: '#53616D', accent: '#087E83' }, game.sources);
  d.pdfName = game.pdf;
  const status = game.team === null ? '企画書のみ / 未制作' : `制作人数：${game.team}人 / Unity`;
  {
    const s = page(d, game.title, game.genre);
    if (game.image || game.conceptImage) {
      await image(s, game.image || game.conceptImage, 64, 183, 740, 416, game.conceptCaption || '実際のゲーム画面');
      text(d, s, game.pitch, 846, 199, 370, 190, 35, d.theme.accent, true);
      text(d, s, status, 846, 444, 370, 70, 23);
      if (game.conceptCaption) text(d, s, game.conceptCaption, 64, 608, 1152, 32, 19, d.theme.muted);
      if (game.id === 'seibutsu-master') {
        text(d, s, '生物の名前', 316, 195, 232, 36, 24);
        text(d, s, '生物の絵', 340, 318, 200, 40, 26, d.theme.muted);
        text(d, s, '特徴・ヒント', 316, 486, 232, 36, 24);
        text(d, s, '属性の色で分類', 316, 536, 232, 36, 22, d.theme.muted);
      }
    } else {
      text(d, s, game.pitch, 64, 215, 1152, 130, 46, d.theme.accent, true);
      text(d, s, game.overview, 64, 382, 1152, 150, 30);
      text(d, s, status, 64, 565, 1152, 42, 24);
    }
    text(d, s, '企画書作成：ゲーム企画', 64, 642, 1152, 30, 20, d.theme.muted);
  }
  {
    const s = page(d, '遊びの核とプレイヤーの判断', game.pitch);
    block(d, s, 'どんなゲームか', game.overview, 64, 190, 1152, 110);
    block(d, s, '想定するプレイヤー', game.audience, 64, 377, 520, 170);
    block(d, s, '何を選ぶか', game.decision, 668, 377, 548, 205);
  }
  {
    const s = page(d, '遊びの流れと具体例', game.genre);
    const steps = game.flow.split(' → ');
    const track = 1152 / steps.length;
    steps.forEach((step, index) => {
      const x = 64 + index * track;
      text(d, s, String(index + 1).padStart(2, '0'), x, 190, track - 20, 48, 36, d.theme.accent, true);
      text(d, s, step.replace('または', 'または\n'), x, 250, track - 24, 132, 25);
    });
    if (game.image) {
      await image(s, game.image, 64, 398, 520, 264, '実際のゲーム画面');
      block(d, s, 'この場面の判断', game.example, 632, 398, 584, 208);
    } else {
      block(d, s, 'この場面の判断', game.example, 64, 408, 1152, 208);
    }
  }
  {
    const s = page(d, '制作範囲と今後の確認', status);
    block(d, s, game.team === null ? '企画で大切にすること' : '私の担当', game.role, 64, 185, 1152, 130);
    block(d, s, '現在の範囲・未確定事項', game.scope, 64, 388, 1152, 165);
    if (game.team !== null) link(d, s, '公開作品をプレイ', base + 'play/' + game.id + '/', 64, 630);
  }
  await save(d);
}
for (const game of [
  {
    id: 'door-tag', title: 'DOOR TAG（ドアをつくる鬼ごっこ）',
    theme: { bg: '#0E1825', ink: '#F4F8FC', accent: '#78E5DA', muted: '#A7BCCE' },
    hook: '今の逃げ道が、次の鬼の近道になる。',
    coverHook: '今の逃げ道が、\n次の鬼の近道に。',
    genre: '3D追跡アクション / WineEngine / 制作人数：1人',
    beats: [
      ['追われる', '正面の通路を走り続けると鬼に追いつかれる。光る印のある壁を見つける。'],
      ['道を作る', '少し足を止めてドアを設置。追われる前に使うか、ぎりぎりまで引きつけるかを選ぶ。'],
      ['先回りされる', '開いたドアは鬼も通れる。逃げ切るには、ドアを抜けた後の動きまで考える。'],
    ],
    key: ['通路を増やすこと自体を、対戦の判断にする', 'ドアを自分だけの防御手段にせず、誰でも通れる道にしました。鬼が交代しても脱落しないので、追う・追われる両方から同じ地形を読み直します。'],
    compare: ['ドアなし練習で遊びの差を見る', 'ドアなしでは距離と曲がり角、ドアありでは「いつ、どの壁を開けるか」が増えます。通常試合と練習を分け、変化を比べられるようにしました。'],
    role: '企画を担当。ドアを置く役割を制限せず、同じドアが攻めにも逃げにもなる遊びを設計。',
    sources: ['企画メモ（改訂案）', 'ゲーム操作資料（ba5f6d4）'],
  },
  {
    id: 'adventurers-shop', title: '冒険者ショップ',
    theme: { bg: '#152922', ink: '#FFF6E0', accent: '#FFD180', muted: '#B6CABE' },
    hook: '冒険に出る人のために、工房で次の一品を作る。',
    coverHook: '冒険に出る人へ、\n工房で次の一品を。',
    genre: '2D採取・工房シミュレーション / WineEngine / 制作人数：1人',
    beats: [
      ['旅の話を聞く', '店先で目的地や困りごとを聞く。旅に何が必要かを考え、作る品を決める。'],
      ['採って仕立てる', '森・洞窟・遺跡で素材を探し、薬は釜で、武器や道具は鍛冶場で作る。'],
      ['届けて次を知る', '後日、渡した品が旅でどう役立ったか聞く。新しい品や必須素材の手掛かりを得る。'],
    ],
    key: ['素材が道を決め、手を止める場所が品質を決める', '素材を投入すると調合地図に経路が足され、釜を混ぜた分だけ進みます。輪の中心を狙うため、材料選びだけでなく、どこで混ぜるのを止めるかも考えます。'],
    compare: ['鍛冶では、同じ素材でも手を入れる順番が違う', '温度を見ながら叩き、目標の形へ近づけます。水冷と油冷では伸びる性質も異なり、調合とは別の判断を楽しめます。'],
    role: '企画を担当。注文から制作・納品・次の採取へ、プレイヤーの目的がつながる流れを設計。実装・画像・音はAIを活用。',
    sources: ['企画メモ・状態記録', '1.0.0の遊び方（ac1a24f）'],
  },
  {
    id: 'ippatsu-choshoku', title: '一発調色',
    theme: { bg: '#292023', ink: '#FFF6EA', accent: '#FFB26D', muted: '#DBC3B4' },
    hook: '混ぜるまで分からない。見本の色を、一発で。',
    coverHook: '色は混ぜるまで未知。\n見本の色を一発で。',
    genre: '調色パズル / WineEngine / 制作人数：1人',
    beats: [
      ['見本を読む', 'お客さんが持ってきた桜色を見て、赤を中心に、どの色を足すか考えます。'],
      ['小さじで量る', '白・黒・赤・黄・青の量を決めます。混ぜる前なら入れ直せますが、完成色はまだ見えません。'],
      ['一度だけ決める', '混ぜた色が見本の隣に出ます。色の差を読み、同じ見本で配合を変えて練習できます。'],
    ],
    key: ['混ぜるボタンを、予想に答えを出す瞬間にする', '配合中は完成色を表示しません。色を見ながら少しずつ合わせるのではなく、仕上がりを想像してから確定します。'],
    compare: ['得点と練習を分け、外れても次につなげる', '同じ色でやり直しても得点に入るのは初回だけ。見本との差を振り返り、本番と同じ配合で何を変えたらよいか試せます。'],
    role: '企画立案を担当。見本を読む、配合を決める、混ぜて答え合わせをする、という一連の遊びを提案しました。',
    sources: ['WineEngineDock掲載の遊び方', 'Windows版 v1.0.1 実画面'],
  },
]) {
  const d = deck(game.id, game.title, game.theme, game.sources);
  const cover = page(d, game.title, game.genre);
  await image(cover, 'files/images/' + game.id + '-gameplay.jpg', 600, 165, 616, 410, game.title + 'の実際のゲーム画面');
  text(d, cover, game.coverHook, 64, 228, 500, 210, 43, d.theme.ink, true);
  text(d, cover, '実際のゲーム画面', 600, 580, 500, 35, 20, d.theme.muted);
  text(d, cover, 'ゲーム企画書', 64, 606, 700, 44, 23, d.theme.muted);
  const loop = page(d, 'プレイヤーの一場面', '一回のプレイで繰り返す判断');
  game.beats.forEach(([heading, body], i) => block(d, loop, '0' + (i + 1) + '  ' + heading, body, 64 + 392 * i, 230, 342, 260));
  const design = page(d, '遊びの設計', game.hook);
  block(d, design, ...game.key, 64, 202, 1120, 127);
  block(d, design, ...game.compare, 64, 432, 1120, 140);
  const role = page(d, '制作で担当したこと', '企画と実装の範囲');
  block(d, role, '担当：企画', game.role, 64, 202, 1120, 140);
  block(d, role, '配布環境：WineEngineDock / Windows', 'このサイトではゲーム本体を配布していません。入力、判定、確認項目は仕様書に分けています。', 64, 422, 1120, 118);
  link(d, role, 'ポートフォリオの作品詳細', base + '#game-' + game.id, 64, 610);
  await save(d);
}
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(metadata, null, 2) + '\n');
