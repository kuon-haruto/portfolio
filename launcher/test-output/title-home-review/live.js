const files='../../../files/',site='../../../index.html',game='https://unityroom.com/games/sliding-space-parking',shot=files+'images/sliding-space-parking-store-gameplay.jpg',view=document.querySelector('#view');
const btn=(url,label,primary=false)=>`<a class="btn ${primary?'primary':''}" href="${url}">${label}</a>`;
const games=[['sliding-space-parking','すべる宇宙駐車場','App Store公開','#parking'],['v-link-battle','V-Link Battle','神ゲーエボリューション 1次審査通過',site+'#featured-works'],['sanshoku-bunki','三色の分岐係','仕分けゲーム',site+'#game-sanshoku-bunki']];
const tile=([id,title,info,url])=>`<a class="tile" href="${url}"><img src="${files}game-icons/${id}.png" alt=""><span><strong>${title}</strong><small>${info}</small></span></a>`;
const cats=`<nav class="cats"><a href="#games">制作ゲーム</a><a href="#proposals">企画書</a><a href="#specifications">仕様書</a><a href="#ideas">ゲームアイデア</a><a href="#about">自己紹介</a></nav>`;
let dispose,token=0,from='home',lastVerb='すべて';const positions=new Map();
const extras=new Set(['v-link-battle','sanshoku-bunki','hanten-assassination','teruteru-wars','bug-hunter','hekorhythm']);
for(const item of games)if(extras.has(item[0]))item[3]='#'+item[0];
const detailRoutes=new Set(['parking','futago','line-boundary',...extras]);
let pendingOrigin=null;
document.addEventListener('click',e=>{const a=e.target.closest('a');if(a&&a.origin===location.origin&&a.pathname===location.pathname){const here=location.hash.slice(1)||'title';positions.set(here,scrollY);if(detailRoutes.has(a.hash.slice(1))&&here!==a.hash.slice(1))pendingOrigin={destination:a.hash.slice(1),origin:here}}});
function render(){dispose?.();dispose=null;const t=++token,r=location.hash.slice(1)||'title';
if(r==='title')view.innerHTML=`<section class="intro"><img class="peek" alt="氷ノあめ" src="ame-peek.png"><span class="key">ゲームプランナー志望</span><h1>島本善太<br>ゲーム企画ポートフォリオ</h1>${btn('#home','ポートフォリオを開く',true)}<a href="#parking">代表作をすぐ見る →</a></section><h2>代表作</h2><div class="tiles">${games.map(tile).join('')}</div>`;
else if(r==='parking'){view.innerHTML=`<article class="detail"><a href="#${from}">← 戻る</a><p class="key">App Store公開作品</p><h1>すべる宇宙駐車場</h1><p>慣性で滑る宇宙船を、逆噴射で駐車枠に止める。</p><p><b>私の担当：</b>企画立案・整理、画像作成、SE　｜　4人制作・Unity</p><div class="annot"><img class="photo" src="${shot}" alt="すべる宇宙駐車場のプレイ画面"><button class="pin" style="top:48%;left:45%" aria-label="企画メモ1">1</button><button class="pin" style="top:67%;left:61%" aria-label="企画メモ2">2</button></div><div class="memo" aria-live="polite"></div><button id="toggle">画面だけ見る</button><div class="links">${btn(game,'unityroomで遊ぶ',true)}<a href="${files}sliding-space-parking_spec.pdf">仕様書</a><a href="#home">ホームへ戻る</a></div></article>`;const memo=view.querySelector('.memo'),pins=[...view.querySelectorAll('.pin')],toggle=view.querySelector('#toggle'),notes=['① 慣性：操作をやめても船は進む。枠までの距離を見て、到着する前に逆噴射を始める。','② 駐車：船を枠まで運ぶだけでなく、そこで止まれる速度に調整する。'];memo.textContent=notes[0];pins.forEach((p,i)=>p.onclick=()=>memo.textContent=notes[i]);toggle.onclick=()=>{memo.hidden=!memo.hidden;pins.forEach(p=>p.hidden=memo.hidden);toggle.textContent=memo.hidden?'企画メモを見る':'画面だけ見る'};}
else if(r!=='games'){view.innerHTML=`<span class="key">GAME PLANNER PORTFOLIO</span><h1>${r==='games'?'制作ゲーム':'ホーム'}</h1>${cats}<div class="layout"><article class="featured"><a href="#parking"><img class="photo" src="${shot}" alt="すべる宇宙駐車場のプレイ画面"></a><span class="key">代表作　/　App Store公開</span><h2>すべる宇宙駐車場</h2><p>慣性で滑る船を、逆噴射でぴたりと駐車。</p><p>担当：企画立案・整理、画像作成、SE　｜　4人制作</p><div class="links">${btn(game,'遊ぶ',true)}${btn('#parking','作品を見る')}</div></article><aside class="rail">${games.slice(1).map(tile).join('')}<div id="ame-stage"></div></aside></div><p><a href="${site}#works">制作ゲームをすべて見る →</a></p>`;}
if(r==='games'){
 const catalog=[games[0],games[1],games[2],['futago','双子','リンク型コマンドバトル',site+'#game-futago'],['line-boundary','線のこちら側／向こう側','境界線を使うパズル',site+'#game-line-boundary'],['hanten-assassination','反転暗殺','アクション',site+'#game-hanten-assassination'],['teruteru-wars','てるてるウォーズ','制作作品',site+'#game-teruteru-wars'],['bug-hunter','バグハンター','指示式の昆虫バトル',site+'#game-bug-hunter'],['hekorhythm','へこリズム','リズムゲーム',site+'#game-hekorhythm']];
 for(const item of catalog)if(detailRoutes.has(item[0]))item[3]='#'+item[0];
 const filters={'すべて':null,'止める':'sliding-space-parking','つなぐ':'futago','分ける':'line-boundary'};
 view.innerHTML='<h1>制作ゲーム</h1>'+cats+'<div class="links" role="group" aria-label="遊びで絞り込む"></div><div class="tiles" aria-live="polite"></div>';
 const controls=view.querySelector('.links'),list=view.querySelector('.tiles');
 function filter(label){lastVerb=label;const id=filters[label];list.innerHTML=catalog.filter(item=>!id||item[0]===id).map(item=>tile(item).replace('hanten-assassination.png','hanten-assassination.jpeg')).join('');for(const b of controls.children)b.setAttribute('aria-pressed',String(b.textContent===label));history.replaceState({...history.state,verb:label},'')}
 for(const label of Object.keys(filters)){const b=document.createElement('button');b.textContent=label;b.onclick=()=>filter(label);controls.append(b)}filter(Object.hasOwn(filters,history.state?.verb)?history.state.verb:lastVerb);
}
if(r==='ideas'){
 view.innerHTML=`<h1>ゲームアイデア</h1>${cats}<article class="detail"><p class="key">構想段階　/　ゲーム本体は未制作</p><h2>閉店確認</h2><p>早く帰りたい。でも、本当に全部終わった？　片づけの順番を考え、作業の完了条件を確かめてから出口へ向かうゲームの案です。</p><img class="photo" src="${files}idea-images/closing-check.webp" alt="閉店後の店を描いた構想イメージ。実際のプレイ画面ではありません"><details><summary>検討中のこと</summary><p>確認済みの作業をどう残すか。見落としに気づいたとき、どのように戻れると確認自体が遊びになるか。</p></details><div class="links">${btn('../../../ideas.html','構想中のアイデアをすべて見る',true)}<a href="#home">ホームへ戻る</a></div></article>`;
}
if(r==='about'){
 view.innerHTML=`<h1>自己紹介</h1>${cats}<article class="detail"><p class="key">ゲームプランナー志望</p><h2>島本善太</h2><p>独学で企画を学び、思いついた遊びを企画書や仕様書にまとめてきました。一人で企画を考えるときも、遊ぶ人にとっての面白さと、作る仲間への伝わり方の両方から考えるようにしています。</p><h2>仕様を整理して、チームに残す</h2><p>6人で制作した『双子』では、企画・仕様整理・システム設計などを担当しました。リンク案のうち、何を先に実装し、何を見送ったかを変更記録で読めます。</p><div class="links">${btn('#futago','双子の作品・担当を見る',true)}<a href="#specifications">仕様変更の記録を見る</a><a href="#home">ホームへ戻る</a></div></article>`;
}
if(r==='specifications'){
 view.innerHTML=`<h1>仕様書</h1>${cats}<article class="detail"><p class="key">双子　/　仕様変更 F-C01</p><h2>どの効果をリンクで共有するか</h2><img class="photo" src="${files}images/futago-gameplay.png" alt="双子のコマンドバトル画面"><dl><dt><b>変更前の案</b></dt><dd>ダメージ、バフ、パッシブ効果をそれぞれ共有する3種類のリンクを検討。</dd><dt><b>判断と実装範囲</b></dt><dd>優先度の高いダメージ共有とバフ共有を先に固め、パッシブリンクは見送り。現行の種別は2種類です。</dd></dl><p>6人制作。私の担当には仕様整理とシステム設計が含まれます。上記はチームの変更記録です。</p><div class="links">${btn(files+'futago_spec.pdf#page=3','変更記録を読む',true)}<a href="#futago">作品詳細</a><a href="../../../play/futago/">実装版を遊ぶ</a><a href="${site}#specifications">すべての仕様書</a><a href="#home">ホームへ戻る</a></div></article>`;
}
if(r==='proposals'){
 view.innerHTML=`<h1>企画書</h1>${cats}<article class="detail"><p class="key">5分ダンジョン　/　企画書のみ・未制作</p><h2>回復するか、最後の戦いに備えて強化するか。</h2><p>短い冒険で三択を重ね、選んだ戦い方を最後のボス戦で試す企画です。</p><a href="${files}FiveMinuteDungeon.pdf#page=3"><img class="photo" src="dungeon-proposal-p3.png" alt="企画書3ページ：三択から戦闘・強化・回復を選び、ボス戦へ進む流れ"></a><p>企画書3ページ「遊びの流れと具体例」より。実装画面ではありません。</p><div class="links">${btn(files+'FiveMinuteDungeon.pdf','企画書を最初から読む',true)}<a href="${site}#proposals">すべての企画書</a><a href="#home">ホームへ戻る</a></div></article>`;
}
if(r==='parking'){
 const pdf=document.createElement('a');pdf.href='parking-sheet.pdf';pdf.textContent='企画メモをPDFで読む';view.querySelector('.detail .links').append(pdf);
}
if(r==='futago'||r==='line-boundary'){
 const twins=r==='futago',title=twins?'双子':'線のこちら側／向こう側',notes=twins?['① 接続先：ダメージを共有したい相手と、バフを共有したい相手は同じとは限らない。誰と誰を結ぶかを決める。','② 行動順：リンクを張る順番と行動する順番を組み合わせる。仕様書3ページには、リンクを3種類から2種類に整理した記録がある。']:['① 境界：配置済みの点から2点を選ぶ。組み合わせによって、ステージを分ける線の位置が変わる。','② 領域：両側の重力の違いを使い、どこで境界を越えればゴールへ進めるかを考える。'];
 view.innerHTML=`<article class="detail"><a href="#games">← 制作ゲーム一覧へ</a><p class="key">${twins?'つなぐ。':'分ける。'}</p><h1>${title}</h1><p>${twins?'兄弟のコマンド行動とリンクを組み合わせる戦略バトル。':'2点を結ぶ境界線で重力の違う領域を作るパズルアクション。'}</p><p><b>私の担当：</b>企画・タスク振り分け・仕様整理・${twins?'システム設計':'レベルデザイン'}・素材集め　｜　${twins?6:4}人制作</p><img class="photo" src="${files}images/${r}-gameplay.png" alt="${title}のプレイ画面"><div class="links"><button>① ${twins?'接続先':'境界'}</button><button>② ${twins?'行動順':'領域'}</button></div><p class="memo" aria-live="polite"></p><div class="links">${btn('../../../play/'+r+'/','遊ぶ',true)}<a href="${files}${twins?'futago_spec.pdf#page=3':'kochiratomukou_spec.pdf'}">仕様書を読む</a><a href="#home">ホームへ戻る</a></div></article>`;
 const memo=view.querySelector('.memo');memo.textContent=notes[0];view.querySelectorAll('.detail button').forEach((b,i)=>b.onclick=()=>memo.textContent=notes[i]);
}
if(r==='futago'||r==='line-boundary'){
 const twins=r==='futago',img=view.querySelector('.photo'),controls=img.nextElementSibling,memo=controls.nextElementSibling;
 const wrap=document.createElement('div');wrap.className='annot marked-screen';img.before(wrap);wrap.append(img);
 const labels=twins?['接続先を考える兄弟','現在のターン表示']:['2点を結ぶ境界線','ゴール側の足場'];
 const points=twins?[[25,42],[72,17]]:[[46,60],[86,61]];
 const pins=[...controls.children].map((button,i)=>{
  const pin=document.createElement('button');pin.className='pin';pin.textContent=i+1;pin.setAttribute('aria-label',(i+1)+' '+labels[i]);pin.style.left=points[i][0]+'%';pin.style.top=points[i][1]+'%';wrap.append(pin);
  pin.onclick=()=>button.click();button.addEventListener('click',()=>pins.forEach((p,j)=>p.setAttribute('aria-pressed',String(i===j))));return pin
 });
 pins[0].setAttribute('aria-pressed','true');const toggle=document.createElement('button');toggle.textContent='画面だけ見る';memo.after(toggle);
 toggle.onclick=()=>{memo.hidden=!memo.hidden;controls.hidden=memo.hidden;pins.forEach(p=>p.hidden=memo.hidden);toggle.textContent=memo.hidden?'企画メモを見る':'画面だけ見る'};
}
if(r==='title'||r==='home'){
 const intro=view.querySelector('.intro');
 const stage=view.querySelector('#ame-stage')||document.createElement('div');
 if(intro){intro.querySelector('.peek')?.remove();stage.className='title-hosts';intro.prepend(stage)}
 else{stage.className='home-hosts';view.querySelector('.cats').after(stage)}
 import('./puppet/puppet.js').then(async m=>{if(t!==token)return;const clean=await m.mount(stage,{mode:r});if(t!==token)clean?.();else dispose=clean}).catch(console.error)
}
if(extras.has(r))renderExtra(view,r);
if(detailRoutes.has(r)){
 if(pendingOrigin?.destination===r){history.replaceState({...history.state,origin:pendingOrigin.origin,originVerb:lastVerb,originY:positions.get(pendingOrigin.origin)||0},'');pendingOrigin=null}
 if(history.state?.origin==='games'&&history.state.originVerb)lastVerb=history.state.originVerb;
 if(history.state?.origin)positions.set(history.state.origin,history.state.originY||0);
 const origin=history.state?.origin||'games',back=view.querySelector('.detail>a:first-child');
 const labels={games:'制作ゲーム一覧',home:'ホーム',title:'タイトル',about:'自己紹介',specifications:'仕様書'};
 if(back){back.href='#'+(Object.hasOwn(labels,origin)?origin:'games');back.textContent='← '+(labels[origin]||labels.games)+'へ戻る'}
}
view.querySelector('.cats a[href="#'+CSS.escape(r==='home'?'games':r)+'"]')?.setAttribute('aria-current','page');
requestAnimationFrame(()=>scrollTo(0,positions.get(r)||0))}
addEventListener('hashchange',render);render();
import {renderExtra} from './extra-details.js';
