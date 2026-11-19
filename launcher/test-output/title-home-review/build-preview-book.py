"""Private review: eight selective replacements, 22 pages, original links kept.

Run with bundled Python; writes only this preview and pdf-pages evidence.
The source PDF is read-only. Existing page dictionaries and annotations survive.
"""
from pathlib import Path
from io import BytesIO
from collections import Counter
from hashlib import sha256
import json
import re
import subprocess
from PIL import Image, ImageDraw
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white

here = Path(__file__).resolve().parent
root = here.parents[2]
source = root / 'documents/portfolio/portfolio.pdf'
output = here / 'portfolio-preview.pdf'
evidence = here / 'pdf-pages'
NAVY, TEAL, MUTED = '#152c46', '#007b84', '#506577'
pdfmetrics.registerFont(TTFont('JP', 'C:/Windows/Fonts/msgothic.ttc', subfontIndex=0))

# The shared notes remain grounded in the local preview's documented sources.
node = Path('C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1118-904-0_26.1118.904.0_x64__3k8sg7r9htsxt/dependencies/node/bin/node.exe')
js = "const fs=require('fs');let s=fs.readFileSync(process.argv[1],'utf8').split('export function renderExtra')[0].replace('export const','const');eval(s+';console.log(JSON.stringify(details))');"
details = json.loads(subprocess.check_output([str(node), '-e', js, str(here/'extra-details.js')], encoding='utf-8'))

games = {
    8: details['v-link-battle'], 15: details['sanshoku-bunki'],
    16: details['bug-hunter'], 17: details['hekorhythm'],
}
games[5] = dict(title='すべる宇宙駐車場', image='sliding-space-parking-store-gameplay.jpg',
    lead='枠に着く前に、いつ減速するか', status='App Store公開 / 4人制作',
    role='企画立案・整理、画像作成、SE',
    notes=[dict(x=48,y=70,title='慣性を見越して逆噴射',text='操作をやめても船は進む。枠までの距離を見て、到着する前に逆噴射を始める。',ref='live.js / parking・作品紹介'),
           dict(x=71,y=38,title='到着ではなく、枠内で止める',text='船を枠へ運ぶだけでなく、そこで止まれる速度に調整する。船全体を枠内へ収めることが目標。',ref='作品紹介「概要」')],
    caveat='公開iOS版の実画面。静止画から入力時刻や停止成立の瞬間までは断定しません。画像・音には生成ツールを使用。')
games[11] = dict(title='双子',image='futago-gameplay.png',status='6人制作 / Unity',
    lead='誰と誰をつなぎ、どの順番で効果を広げるか',
    role='企画・仕様整理・システム設計、タスク振り分け、素材集め',
    notes=[dict(x=25,y=42,title='接続先と残る本数を選ぶ',text='ダメージを共有したい相手と、バフを共有したい相手は同じとは限らない。リンクゲージと設置可能回数を管理し、誰と誰を結ぶかを決める。',ref='作品紹介・live.js / futago'),
           dict(x=49,y=18,title='リンクとコマンドの行動順',text='兄弟のコマンド行動に、リンクを張る順番と発動する順番を組み合わせる。3種類の案からダメージ・バフの2種類へ整理した変更記録は次の12ページへ。',ref='仕様書 p.3 F-C01 / live.js')],
    caveat='実際のプレイ画面。番号は兄弟とコマンド選択の案内に対応。変更はチームの記録であり、個人だけの発案・検証とはしていません。')
games[13] = dict(title='線のこちら側 / 向こう側',image='line-boundary-gameplay.png',status='4人制作 / Unity',
    lead='線の置き方で、ゴールへの進み方を変える',
    role='企画・仕様整理・レベルデザイン、タスク振り分け、素材集め',
    notes=[dict(x=46,y=60,title='2点を選んで境界を作る',text='配置された点から2点を選ぶ。組み合わせによって線の位置が変わる。用意された道を通るだけでなく、線の置き方で攻略法を見つける遊びを目指した。',ref='作品紹介・live.js / line-boundary'),
           dict(x=86,y=61,title='重力の違う領域を越える',text='領域に効果を割り当て、どこで境界を越えればゴール側の足場へ進めるかを考える。重力の違いを利用し、空間認識と発想力を試すパズルにする企画意図。',ref='作品紹介「概要」「企画意図」')],
    caveat='実際のプレイ画面。境界と足場の位置を示すもので、この1枚だけで全ての領域効果や解法は確認できません。')

# Place markers beside small UI labels rather than covering their characters.
games[16]['notes'][0].update(x=77,y=94)
games[16]['notes'][1].update(x=24,y=34)
games[17]['notes'][1].update(x=65,y=17)
games[15]['notes'][1].update(x=94,y=16)
details['hanten-assassination']['notes'][0].update(x=31,y=91)

def text(c, value, x, top, size=12, color=NAVY):
    c.setFillColor(HexColor(color))
    c.setFont('JP',size)
    c.drawString(x,540-top-size,value)

def paragraph(c,value,x,top,width,size=12,leading=18):
    line=''
    tokens=re.findall(r'[A-Za-z0-9][A-Za-z0-9./_-]*|.',value)
    grouped=[]
    for token in tokens:
        if token in '、。）」』' and grouped:
            grouped[-1]+=token
        else:
            grouped.append(token)
    for char in grouped:
        if pdfmetrics.stringWidth(line+char,'JP',size)>width:
            text(c,line,x,top,size)
            top+=leading
            line=''
        line+=char
    if line:
        text(c,line,x,top,size)
        top+=leading
    return top

def screenshot(c,data,box):
    x,top,w,h=box
    path=root/'files/images'/data['image']
    with Image.open(path) as im:
        iw,ih=im.size
    scale=min(w/iw,h/ih)
    sw,sh=iw*scale,ih*scale
    sx,sy=x+(w-sw)/2,top+(h-sh)/2
    c.drawImage(str(path),sx,540-sy-sh,sw,sh)
    for i,n in enumerate(data['notes'],1):
        px,py=sx+sw*n['x']/100,540-sy-sh*n['y']/100
        c.setFillColor(HexColor(NAVY))
        c.setStrokeColor(white)
        c.setLineWidth(1.8)
        c.circle(px,py,9,stroke=1,fill=1)
        c.setFont('JP',11)
        c.setFillColor(white)
        c.drawCentredString(px,py-3.7,str(i))

def base(c,page,title,subtitle,role):
    c.setFillColor(HexColor('#f6f8fa'))
    c.rect(0,0,960,540,stroke=0,fill=1)
    text(c,'GAME WORKS / ANNOTATED SCREEN',48,17,10,TEAL)
    text(c,title,48,36,27)
    text(c,subtitle,48,72,14)
    text(c,role,48,94,10)
    c.setStrokeColor(HexColor('#ced8e0'))
    c.line(48,35,912,35)
    text(c,'/ PORTFOLIO',48,515,9,MUTED)
    text(c,'次のページへ',720,516,10,MUTED)
    text(c,f'{page:02} / 22',860,516,10,MUTED)

def link_labels(c,original_page):
    for a in original_page.get('/Annots',[]):
        a=a.get_object()
        action=a.get('/A',{})
        if '/URI' in action:
            x1,y1,x2,y2=map(float,a['/Rect'])
            label='対戦映像を見る' if '.mp4' in str(action['/URI']) else 'ブラウザーでプレイ'
            text(c,label,x1+3,540-y2+5,12,TEAL)

def single(c,page,data,original_page):
    base(c,page,data['title'],data['lead'],data['status']+' / 担当：'+data['role'])
    screenshot(c,data,(48,116,600,332))
    y=116
    for i,n in enumerate(data['notes'],1):
        # Wrap headings independently so longer Japanese titles never clip.
        y=paragraph(c,f'{i:02}  '+n['title'],674,y,238,13,18)+7
        y=paragraph(c,n['text'],674,y,238,11.5,16)+7
        y=paragraph(c,'根拠：'+n['ref'],674,y,238,8.5,12)+15
    y=paragraph(c,data.get('caveat',''),674,y,238,9.5,14)
    if page==16:
        y=paragraph(c,'元ページの改善方針：右クリック必須の視点移動を見直し、自動視点＋左クリック近接へ。内容と描画負荷の精査、軽量化、改善前後の比較は今後の課題。',674,y+8,238,9.5,14)
    assert y<=500,(page,'sidebar overflow',y)
    text(c,'実画面：files/images/'+data['image'],48,449,8.5,MUTED)
    text(c,'資料：src/sections/works.html・featured-works.html、extra-details.js、live.js',48,461,8,MUTED)
    link_labels(c,original_page)
    if page==5:
        # The earlier parking preview added this play link; retain it as well.
        text(c,'unityroomでプレイ',48,474,12,TEAL)
        c.linkURL('https://unityroom.com/games/sliding-space-parking',(48,48,288,70),relative=0)

def double(c):
    base(c,14,'てるてるウォーズ / 反転暗殺','配置の選択と、一手の順番。異なる遊びを考え、形にする。',
         '各4人制作 / 担当：企画・仕様整理・タスク振り分け・素材集め、てるてる：プログラム、反転：レベルデザイン')
    for x,key in zip((48,492),('teruteru-wars','hanten-assassination')):
        data=details[key]
        text(c,data['title'],x,116,17)
        screenshot(c,data,(x,143,420,220))
        y=372
        bodies = ([
            '同じユニットでもモード別に性能が異なる。配置後の自由な反転は未確認。',
            '減速・毒・停止・押し戻しなどを利用。時間到達、または全ウェーブ完了かつ敵0のクリア経路がある。'] if key=='teruteru-wars' else [
            '順序は自由。両方を使うとターン終了。待機でも進行し、敵ターン中は操作できない。',
            '占有マスは反転不可。通常移動は上下左右の隣接1マス。全敵撃破が目標で、脱出到達は必須ではない。'])
        for i,(n,body) in enumerate(zip(data['notes'],bodies),1):
            text(c,f'{i:02}  '+n['title'],x,y,12,TEAL)
            y=paragraph(c,body,x,y+18,420,10.5,14)+6
        refs='T-01〜03' if key=='teruteru-wars' else 'H-01〜04 / H-C01・02'
        text(c,'根拠：仕様書 '+refs+' / extra-details.js',x,y,8.5,MUTED)
        caveat=('実プレイ画面。時間・射程は個別設定。Webは一部VFXを代替。' if key=='teruteru-wars' else '実プレイ画面。旧案の連続移動・しゃがみ・秒数制限ではなく改訂ターン制。採用理由は未記録。')
        y=paragraph(c,caveat,x,y+14,420,9,12)
        assert y<=502,('double overflow',y)

def targets(reader):
    ids={p.indirect_reference.idnum:i for i,p in enumerate(reader.pages,1)}
    counts=Counter()
    for i,p in enumerate(reader.pages,1):
        for a in p.get('/Annots',[]):
            a=a.get_object()
            if a.get('/Subtype')!='/Link':
                continue
            action=a.get('/A',{})
            dest=a.get('/Dest',action.get('/D'))
            target=ids[dest[0].idnum] if dest else str(action.get('/URI'))
            counts[i,target]+=1
    return counts

def main():
    before=sha256(source.read_bytes()).hexdigest()
    original=PdfReader(source)
    writer=PdfWriter(clone_from=original)
    changed=sorted([*games,14])
    for number in changed:
        buffer=BytesIO()
        c=canvas.Canvas(buffer,pagesize=(960,540))
        double(c) if number==14 else single(c,number,games[number],original.pages[number-1])
        c.showPage()
        c.save()
        sheet=PdfReader(BytesIO(buffer.getvalue())).pages[0]
        target=writer.pages[number-1]
        # Never remove /Annots: both the original hit boxes and destinations survive.
        for key in ('/Contents','/Resources'):
            target.pop(key,None)
        target.merge_page(sheet)
    writer.write(output)
    result=PdfReader(output)
    assert len(result.pages)==len(original.pages)==22
    expected=targets(original)
    expected[5,'https://unityroom.com/games/sliding-space-parking']+=1
    assert targets(result)==expected
    assert targets(result)[5,6]==1
    for number in range(1,23):
        if number not in changed:
            assert result.pages[number-1].extract_text()==original.pages[number-1].extract_text()
            assert result.pages[number-1].get_contents().get_data()==original.pages[number-1].get_contents().get_data()
    assert sha256(source.read_bytes()).hexdigest()==before
    subprocess.run([__import__('sys').executable,str(here/'check-book-links.py')],check=True)
    evidence.mkdir(exist_ok=True)
    for number in changed:
        subprocess.run(['pdftoppm','-f',str(number),'-l',str(number),'-singlefile','-scale-to','1440','-png',str(output),str(evidence/f'page-{number:02}')],check=True)
    contact=Image.new('RGB',(1440,1700),'#dce3e9')
    draw=ImageDraw.Draw(contact)
    for i,number in enumerate(changed):
        with Image.open(evidence/f'page-{number:02}.png') as im:
            contact.paste(im.resize((720,405)),((i%2)*720,(i//2)*425+20))
        draw.text(((i%2)*720+8,(i//2)*425+4),f'PDF page {number:02}',fill=NAVY)
    contact.save(evidence/'modified-contact.png')
    report=dict(pages=22,modified_pages=changed,games=9,original_links=targets(original).total(),preview_links=targets(result).total(),missing_links=[],restored_next_link='5 -> 6',untouched_page_streams=14,canonical_sha256=before,source_unchanged=True,render='Actual final PDF / Poppler / 1440px',evidence=[f'page-{n:02}.png' for n in changed])
    (evidence/'build-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))

if __name__=='__main__':
    main()
