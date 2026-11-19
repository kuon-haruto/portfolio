const files = '../../../files/';
const source = '../../../';

export const extraRoutes = Object.freeze([
  'v-link-battle', 'sanshoku-bunki', 'hanten-assassination',
  'teruteru-wars', 'bug-hunter', 'hekorhythm',
]);

// Notes separate corroborated rules from proposals and unverified behavior.
const details = {
  'v-link-battle': {
    title: 'V-Link Battle', status: 'Web・Windows版公開 / 8人制作',
    lead: 'VTuberの配信文化を題材にした、3D対戦アクション。',
    role: '企画・仕様整理・システム設計・タスク振り分け・素材集め・3Dオブジェクト作成・エフェクト・アニメーション',
    image: 'v-link-battle.jpg', alt: 'V-Link Battleの対戦画面。中央のキャラクター、氷の攻撃演出、上部のゲージ',
    caption: '公開プレイ映像の対戦画面 / 神ゲーエボリューション2025 1次審査通過',
    notes: [
      { x: 47, y: 63, title: '攻撃とガードの使い分け', text: '移動・弱攻撃・強攻撃・ガードを使い分ける対戦。Web版の入力はWASD・J・K・U。アピールからボルテージ獲得までの循環は企画上の狙いで、実装成立は未確認です。', ref: '仕様書 V-01・V-02' },
      { x: 67, y: 70, title: '氷の形を残すWeb向け演出', text: '汎用の小さな粒子では氷の壁や斬撃の形が伝わらなかったため、専用の代替演出を整備。WebGLは動作優先、WebGPUは元のVFXを重視します。この画像を両モードの表示一致の証拠とはしません。', ref: '仕様書 V-C02' },
    ],
    caveat: 'Web版の通知ウィンドウは画面内の代替表示です。WindowsのOSウィンドウ演出と同一ではなく、一部の攻撃演出も異なります。画面全体の素材を個人制作したという意味ではありません。',
    play: '../../../play/v-link-battle/',
    docs: [['企画書', 'v-link-battle_proposal.pdf'], ['仕様書・変更記録', 'v-link-battle_spec.pdf']],
    evidence: [['担当・人数', 'src/sections/featured-works.html#featured-works'], ['Web版の制限', 'tools/vlink-web/README.md']],
  },
  'sanshoku-bunki': {
    title: '三色の分岐係', status: 'unityroom公開 / 5人制作',
    lead: '品物の種類と状態を見分け、三方向への仕分けと不良品の返却を判断する。',
    role: 'プランナー・企画立案・システム／ルール設計・タスク振り分け・画像／SEの用意',
    image: 'sanshoku-bunki-gameplay.png', alt: '三色の分岐係。中央の三方向分岐、上から流れる品物、右上の仕分けエラー表示',
    caption: '実際のプレイ画面 / 仕分けアクション',
    notes: [
      { x: 50, y: 50, title: '分岐に届く前に行き先を選ぶ', text: 'A・S・Dで左・下・右のレーンを選択。流れてくる品物を見て、中央の分岐点へ届くまでに正しい行き先を決めます。不良品は仕分けず、Wで上へ返却します。', ref: '作品紹介「遊びのポイント」・企画書' },
      { x: 87, y: 9, title: '5回のミスまでスコアに挑戦', text: '仕分けのミスが5回になるまで、スコアを伸ばすルールです。右上に仕分けエラーの枠を並べ、正解・不正解の演出とスコアで結果を示します。', ref: '作品紹介「概要」「特徴」' },
    ],
    play: 'https://unityroom.com/games/sansyokunobunkigakari',
    docs: [['企画書', 'sanshoku-bunki_proposal.pdf']],
    evidence: [['ルール・担当・人数', 'src/sections/works.html#game-sanshoku-bunki']],
  },
  'hanten-assassination': {
    title: '反転暗殺', status: 'Web・Windows版公開 / 4人制作',
    lead: '移動と盤面反転を各1回。行動の順番を考えて敵の背後を取るターン制パズル。',
    role: '企画・タスク振り分け・仕様整理・レベルデザイン・素材集め',
    image: 'hanten-assassination-gameplay.png', alt: '反転暗殺のマス盤面。下に動かす・裏返す・ターン終了のボタン',
    caption: '実際のプレイ画面 / 盤面反転・ターン制パズル',
    notes: [
      { x: 49, y: 90, title: '移動と反転は別々に1回', text: '1ターンに移動1回、反転1回まで。移動→反転、反転→移動のどちらも選べます。両方を使うとターン終了。待機でも進められ、敵ターンには操作できません。', ref: '仕様書 H-01 / H-C01' },
      { x: 61, y: 46, title: '空いているマスの表裏を変える', text: '自分・敵がいるマスは反転不可。反転には移動と同じ隣接条件はありません。通常移動は上下左右の隣接1マスで、斜めや敵の占有マスには進めません。目標は全敵撃破で、脱出到達は必須条件ではありません。', ref: '仕様書 H-02〜04 / H-C02' },
    ],
    caveat: '旧案の連続移動・しゃがみ・秒数制限ではなく、改訂仕様書のターン制を掲載。採用理由は記録がなく、個人の判断として補っていません。',
    play: '../../../play/hanten-assassination/',
    docs: [['企画書', 'hantenansatsu_proposal.pdf'], ['仕様書・変更記録', 'hanntenn-ansatu_spec.pdf']],
    evidence: [['担当・人数', 'src/sections/works.html#game-hanten-assassination']],
  },
  'teruteru-wars': {
    title: 'てるてるウォーズ', status: 'Web・Windows版公開 / 4人制作',
    lead: '通常・反転モードの役割を確認し、てるてる坊主を配置して敵の侵入を防ぐ。',
    role: '企画・タスク振り分け・仕様整理・レベルデザイン・プログラム・素材集め',
    image: 'teruteru-wars-gameplay.png', alt: 'てるてるウォーズの防衛画面。下部にユニット候補、通路に敵と配置済みのてるてる坊主',
    caption: '実際のプレイ画面 / 配置型ディフェンス',
    notes: [
      { x: 53, y: 87, title: '配置時にモードを選ぶ', text: 'ユニットの詳細を開き、配置先と通常・反転モードを選びます。同じユニットでもモード別に性能データを持ちます。配置後に自由に反転できるかは未確認のため、確定ルールには含めません。', ref: '仕様書 T-01・配置操作・確認事項' },
      { x: 74, y: 48, title: '攻撃だけでなく敵への効果を使う', text: 'ユニットには減速・毒・停止・押し戻しなどの効果があります。射程・対象数・持続は個別設定で異なります。制限時間到達、または全ウェーブ完了かつ敵0でクリアする経路があります。', ref: '仕様書 T-02・T-03' },
    ],
    caveat: '画像内の残り時間を全ステージ共通の制限時間とはしません。Web版は一部のVFXをブラウザー向けの代替演出に変更しています。',
    play: '../../../play/teruteru-wars/',
    docs: [['企画書', 'teruteruwars_proposal.pdf'], ['仕様書・変更記録', 'teruteru-wars_spec.pdf']],
    evidence: [['担当・人数', 'src/sections/works.html#game-teruteru-wars']],
  },
  'bug-hunter': {
    title: 'バグハンター', status: 'Web版公開・開発中 / 1人制作（AI実装支援）',
    lead: '昆虫を捕まえて育て、攻撃・防御・技の指示と体勢の駆け引きで戦う。',
    role: '企画・改善方針。プログラムはAIによる実装支援を利用し、本人の手書きコードの実績とは区別',
    image: 'bug-hunter-battle.png', alt: 'バグハンターの練習試合画面。昆虫2匹と、攻撃・防御・技の指示ボタン',
    caption: '実際の練習試合画面 / Unity 6・捕獲／育成／指示式バトル',
    notes: [
      { x: 50, y: 87, title: '移動は虫に任せ、指示を選ぶ', text: '攻撃・防御・技を指示すると、虫が自動で接近します。攻撃には射程と前方条件が必要。防御はダメージ軽減と体勢・スタミナ回復、技には消耗と自分側の体勢崩れのリスクがあります。', ref: '仕様書 B-02 / README「遊び方」' },
      { x: 24, y: 29, title: '能力値だけでなく体勢も判断材料に', text: '能力値だけで強さを決めず、転倒の隙を攻められるようにしたいという本人の要望を反映。転倒中は防御できず、追撃で復帰時間は延びません。復帰後には再転倒を防ぐ時間があります。', ref: '仕様書 B-03 / B-C01' },
    ],
    caveat: '画像にAI生成、環境にCC0素材を使用。過去のQA記録を本人が実施した検証とは断定しません。',
    play: '../../../play/bug-hunter/',
    docs: [['企画書', 'mushi-shooting.pdf'], ['仕様書・変更記録', 'bug-hunter_spec.pdf']],
    evidence: [['制作範囲', 'documents/proposals/reviewed-proposals.json'], ['ルール・実装範囲', 'games/bug-hunter/README.md']],
  },
  hekorhythm: {
    title: 'へこリズム', status: '未公開 / 7人制作',
    lead: '流れてくる型の形を見極め、拍に合わせてパーツをドラッグしてはめ込む。',
    role: '企画立案・仕様書作成・タスク振り分け。ブラッシュアップ時の機能追加全般',
    image: 'hekorhythm-gameplay.png', alt: 'へこリズムのエンドレスモード。中央の型と左右のパーツ、上部にBPM・スコア・コンボ',
    caption: '実際のエンドレスモードのプレイ画面 / Unity 2022.3・未公開',
    notes: [
      { x: 55, y: 59, title: '形の判断とリズムを重ねる', text: '流れてくる型を見て、対応するパーツをドラッグしてはめ込みます。形を見極める判断と、リズムに合わせる操作を組み合わせたゲームです。', ref: '作品紹介「概要」' },
      { x: 59, y: 11, title: '加速しても判断する時間を残す', text: 'エンドレスでは成功数に応じて徐々に加速しつつ、形の判断と操作の時間を残すため上限を設定。難易度別の自己ベストを保存し、結果画面で確認できるようにしました。画像のBPMを上限値とはしていません。', ref: '作品紹介「私の担当と改善」' },
    ],
    caveat: 'ゲームは未公開です。ブラウザー版・ダウンロード版へのプレイリンクはありません。',
    docs: [], evidence: [['担当・人数・改善内容', 'src/sections/works.html#game-hekorhythm']],
  },
};

export function renderExtra(view, id) {
  const data = details[id];
  if (!data) return false;
  if (!document.querySelector('link[data-extra-details]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = new URL('./extra-details.css', import.meta.url).href;
    css.dataset.extraDetails = '';
    document.head.append(css);
  }
  const memoId = `extra-memo-${id}`;
  view.innerHTML = `<article class="detail extra-detail" data-game="${id}">
    <a href="#games">← 制作ゲーム一覧へ戻る</a>
    <p class="key">${data.status}</p><h1>${data.title}</h1>
    <p class="extra-lead">${data.lead}</p>
    <p class="extra-role"><b>私の担当：</b>${data.role}</p>
    <figure class="extra-figure">
      <div class="extra-screen"><img class="photo" src="${files}images/${data.image}" alt="${data.alt}">
      ${data.notes.map((note, i) => `<button type="button" class="extra-pin" style="left:${note.x}%;top:${note.y}%" aria-label="企画メモ${i + 1}：${note.title}" title="${note.title}" aria-controls="${memoId}" aria-pressed="${i === 0}">${i + 1}</button>`).join('')}</div>
      <figcaption>${data.caption}</figcaption>
    </figure>
    <section class="extra-memo memo" id="${memoId}" aria-live="polite" aria-atomic="true"></section>
    <label class="extra-toggle"><input type="checkbox" checked>企画メモを表示</label>
    ${data.caveat ? `<p class="extra-caveat">${data.caveat}</p>` : ''}
    <div class="links extra-links">${data.play ? `<a class="btn primary" href="${data.play}">ブラウザーで遊ぶ</a>` : ''}${data.docs.map(([label, file]) => `<a href="${files}${file}">${label}</a>`).join('')}<a href="#home">ホームへ戻る</a></div>
    <details class="extra-sources"><summary>掲載内容の根拠</summary><p>番号メモは作品資料・ルールの説明です。チームの決定を個人の発案・検証実績と置き換えていません。</p><ul>${data.evidence.map(([label, file]) => `<li><a href="${source}${file}">${label}</a></li>`).join('')}<li><a href="${source}documents/specifications/specifications.json">改訂仕様・変更記録の元データ</a></li></ul></details>
  </article>`;
  const memo = view.querySelector('.extra-memo');
  const pins = [...view.querySelectorAll('.extra-pin')];
  function select(index) {
    const note = data.notes[index];
    memo.innerHTML = `<h2>${index + 1}. ${note.title}</h2><p>${note.text}</p><small>根拠：${note.ref}</small>`;
    pins.forEach((pin, i) => pin.setAttribute('aria-pressed', String(i === index)));
  }
  pins.forEach((pin, i) => pin.addEventListener('click', () => select(i)));
  view.querySelector('.extra-toggle input').addEventListener('change', event => {
    const hidden = !event.target.checked;
    memo.hidden = hidden;
    pins.forEach(pin => { pin.hidden = hidden; });
  });
  select(0);
  return true;
}
