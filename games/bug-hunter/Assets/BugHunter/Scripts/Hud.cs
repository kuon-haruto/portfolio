using System;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

namespace BugHunter
{
    public sealed class Hud : MonoBehaviour
    {
        Game game;
        Font font;
        RectTransform root, page;
        Text notice, summary, target, detail, battleLog, playerState, enemyState;
        Image captureFill, playerHp, enemyHp, playerEnergy, enemyEnergy, playerBalance, enemyBalance;
        Button capture, attack, guard, skill;
        readonly Color ink=new Color(.1f,.19f,.2f),white=new Color(.97f,.99f,.98f),muted=new Color(.61f,.76f,.73f);
        readonly Color green=new Color(.18f,.6f,.4f),blue=new Color(.19f,.62f,.77f),coral=new Color(.92f,.38f,.28f);
        bool portrait;
        float W=>portrait?720:1280;
        float H=>portrait?1280:720;
        public void Initialize(Game g,Font f)
        {
            game=g;font=f;portrait=Screen.height>Screen.width;
            var canvas=gameObject.AddComponent<Canvas>();canvas.renderMode=RenderMode.ScreenSpaceOverlay;
            var scaler=gameObject.AddComponent<CanvasScaler>();scaler.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution=new Vector2(W,H);scaler.matchWidthOrHeight=.5f;
            gameObject.AddComponent<GraphicRaycaster>();root=(RectTransform)transform;
            if(!FindFirstObjectByType<EventSystem>())new GameObject("EventSystem",typeof(EventSystem),typeof(StandaloneInputModule));
        }
        RectTransform Rect(string name,Transform parent,float x,float y,float width,float height)
        {
            var r=new GameObject(name,typeof(RectTransform)).GetComponent<RectTransform>();r.SetParent(parent,false);
            r.anchorMin=r.anchorMax=new Vector2(0,1);r.pivot=new Vector2(0,1);r.anchoredPosition=new Vector2(x,-y);r.sizeDelta=new Vector2(width,height);return r;
        }
        Image Box(string name,float x,float y,float w,float h,Color color)
        {
            var r=Rect(name,page,x,y,w,h);var image=r.gameObject.AddComponent<Image>();image.color=color;image.raycastTarget=false;return image;
        }
        Text Label(string name,string value,float x,float y,float w,float h,int size=22,Color? color=null,TextAnchor align=TextAnchor.MiddleLeft)
        {
            var r=Rect(name,page,x,y,w,h);var t=r.gameObject.AddComponent<Text>();t.font=font;t.text=value;t.fontSize=size;t.color=color??white;
            t.alignment=align;t.raycastTarget=false;t.horizontalOverflow=HorizontalWrapMode.Wrap;t.verticalOverflow=VerticalWrapMode.Overflow;
            // Noto CJK's Latin metrics exceed its Japanese glyph height; rows include spare leading.
            return t;
        }
        Button Button(string name,string label,float x,float y,float w,float h,Action action,Color? color=null)
        {
            var r=Rect(name,page,x,y,w,h);var image=r.gameObject.AddComponent<Image>();image.color=color??green;
            var b=r.gameObject.AddComponent<Button>();var c=b.colors;c.highlightedColor=new Color(1.13f,1.13f,1.13f);c.pressedColor=new Color(.75f,.8f,.78f);c.disabledColor=new Color(.45f,.5f,.48f);b.colors=c;
            b.onClick.AddListener(()=>action());
            var text=Label(name+"Label",label,x+10,y,w-20,h,23,white,TextAnchor.MiddleCenter);text.transform.SetParent(r,true);
            return b;
        }
        void Hold(string label,float x,float y,Vector2 move,Vector2 look)
        {
            var b=Button("Hold"+label,label,x,y,66,58,()=>{},new Color(.1f,.23f,.24f,.8f));
            var events=b.gameObject.AddComponent<EventTrigger>();
            var down=new EventTrigger.Entry { eventID=EventTriggerType.PointerDown };
            down.callback.AddListener(_=>{if(move!=Vector2.zero)game.forest.touchMove=move;if(look!=Vector2.zero)game.forest.touchLook=look;});events.triggers.Add(down);
            var up=new EventTrigger.Entry { eventID=EventTriggerType.PointerUp };
            up.callback.AddListener(_=>{if(move!=Vector2.zero)game.forest.touchMove=Vector2.zero;if(look!=Vector2.zero)game.forest.touchLook=Vector2.zero;});events.triggers.Add(up);
        }
        Image Bar(string name,float x,float y,float w,float h,Color color)
        {
            Box(name+"Track",x,y,w,h,new Color(.2f,.32f,.31f));
            var f=Box(name,x,y,w,h,color);return f;
        }
        static void Fill(Image bar,float value,float width){if(bar)bar.rectTransform.sizeDelta=new Vector2(width*Mathf.Clamp01(value),bar.rectTransform.sizeDelta.y);}
        void Begin(string section)
        {
            if(page)Destroy(page.gameObject);
            target=detail=battleLog=playerState=enemyState=null;
            captureFill=playerHp=enemyHp=playerEnergy=enemyEnergy=playerBalance=enemyBalance=null;
            capture=attack=guard=skill=null;
            page=Rect("Page "+section,root,0,0,W,H);
            Box("Top",0,0,W,82,new Color(.08f,.18f,.18f,.95f));
            Label("Brand","BUG HUNTER",26,0,300,49,28);
            Label("Section",section,27,45,300,25,16,muted);
            summary=Label("Progress","",portrait?340:780,18,portrait?355:475,47,19,white,TextAnchor.MiddleRight);
            notice=Label("Notice","",24,90,W-48,50,21,new Color(1,.94f,.56f),TextAnchor.MiddleCenter);
        }
        public void Forest()
        {
            Begin("こもれびの森");
            Box("Objective",24,147,portrait?360:300,84,new Color(.08f,.18f,.18f,.85f));
            Label("ObjectiveTitle","夏のフィールドノート",40,157,285,30,21);
            Label("ObjectiveValue",game.save.bugs.Count==0?"最初のパートナーを捕まえよう":"生息地：雑木林・草原・水辺",40,191,310,27,16,muted);
            Box("ReticleHorizontal",W/2-8,H/2-1,16,2,white);
            Box("ReticleVertical",W/2-1,H/2-8,2,16,white);
            float bottom=H-174;
            Box("CatchTarget",W/2-210,bottom-92,420,86,new Color(.08f,.18f,.18f,.88f));
            target=Label("Target","",W/2-190,bottom-89,380,42,23,white,TextAnchor.MiddleCenter);
            captureFill=Bar("CaptureFocus",W/2-180,bottom-35,360,8,new Color(.95f,.75f,.31f));
            capture=Button("Capture","捕まえる",W/2-120,bottom,240,62,game.Capture);
            Button("Collection","虫かご・育成",W-240,H-84,216,58,game.Collection,ink);
            Hold("↑",90,H-150,Vector2.up,Vector2.zero);Hold("←",22,H-88,Vector2.left,Vector2.zero);
            Hold("↓",90,H-88,Vector2.down,Vector2.zero);Hold("→",158,H-88,Vector2.right,Vector2.zero);
            Hold("◀",W-160,H-220,Vector2.zero,Vector2.left);Hold("▶",W-90,H-220,Vector2.zero,Vector2.right);
            if(portrait){Hold("△",W-90,H-346,Vector2.zero,Vector2.up);Hold("▽",W-90,H-284,Vector2.zero,Vector2.down);}
            Refresh();
        }
        public void Collection()
        {
            Begin("ベースキャンプ / 虫かご");
            game.CollectionCamera(portrait);
            Button("Explore","森に戻る",24,142,180,48,game.Explore,ink);
            float x=portrait?24:650,y=portrait?490:148,w=portrait?672:606;
            Box("Research",x,y,w,portrait?584:488,new Color(.08f,.18f,.18f,.96f));
            var bug=game.Selected;
            if(bug==null)
            {
                Label("Empty","虫かごはまだ空っぽ",x+24,y+36,w-48,45,28);
                Button("FirstCapture","探索へ",x+24,y+117,w-48,58,game.Explore);
                Refresh();return;
            }
            var data=game.Data(bug);
            Label("Name",bug.Name(data),x+24,y+16,w-130,46,31);
            Label("Level","Lv."+bug.level,x+w-112,y+18,90,40,26,new Color(.98f,.79f,.34f),TextAnchor.MiddleRight);
            Label("Individual",Species.TypeName(data.type)+" / "+bug.Nature+" / "+(bug.size*100).ToString("F0")+" mm",x+24,y+64,w-48,32,18,muted);
            Label("StatsHead","能力値",x+24,y+110,220,30,17,muted);
            Label("GrowthHead","1レベルの成長",x+w-210,y+110,185,30,17,muted,TextAnchor.MiddleRight);
            string[] labels={"体力","攻撃","防御","素早さ"};
            for(int i=0;i<4;i++)
            {
                float row=y+150+i*47;
                Label("Stat"+i,labels[i],x+24,row,112,32,21);
                Label("Value"+i,bug.Stat(data,i).ToString(),x+137,row,65,32,24);
                float max=i==0?300:100;var bar=Bar("StatBar"+i,x+213,row+9,w-358,12,i==0?green:i==1?coral:i==2?blue:new Color(.9f,.72f,.3f));Fill(bar,bug.Stat(data,i)/max,w-358);
                Label("Growth"+i,"+"+bug.growth[i],x+w-105,row,75,32,23,new Color(.79f,.9f,.61f),TextAnchor.MiddleRight);
            }
            Label("Experience","経験値 "+bug.xp+" / "+bug.NextXp+"    得意技："+data.skill,x+24,y+347,w-48,32,18,muted);
            Button("Train","育成  樹液 8",x+24,y+397,(w-60)/2,55,game.Train,green).interactable=bug.level<20&&game.save.nectar>=8;
            Button("Partner",game.save.partner==bug.id?"パートナー選択中":"パートナーにする",x+36+(w-60)/2,y+397,(w-60)/2,55,game.Partner,blue);
            float navY=portrait?410:558;
            Button("Previous","前の個体",24,navY,156,48,()=>game.Select((game.selected+game.save.bugs.Count-1)%game.save.bugs.Count),ink);
            Label("Index",(game.selected+1)+" / "+game.save.bugs.Count,194,navY,200,48,22,white,TextAnchor.MiddleCenter);
            Button("Next","次の個体",portrait?514:414,navY,156,48,()=>game.Select((game.selected+1)%game.save.bugs.Count),ink);
            Label("CollectionSpecies","発見した種類 "+SpeciesCount()+" / "+game.catalog.Length,24,portrait?342:492,500,36,22,white);
            Button("Practice","練習試合",24,H-74,portrait?260:250,54,()=>game.BattleStart(false),blue);
            Button("Tournament","森の大会へ",portrait?302:292,H-74,portrait?394:330,54,()=>game.BattleStart(true),coral);
            Refresh();
        }
        int SpeciesCount(){var found=new System.Collections.Generic.HashSet<int>();foreach(var b in game.save.bugs)found.Add(b.species);return found.Count;}
        public void Battle()
        {
            Begin(game.tournament?"森の大会 / 第 "+game.round+" 試合":"練習試合");
            Button("Pause","中断",W-148,94,124,42,game.Pause,ink);
            float width=portrait?312:380,xRight=W-width-24;
            Box("PlayerStatus",24,146,width,166,new Color(.08f,.18f,.18f,.95f));
            Box("EnemyStatus",xRight,146,width,166,new Color(.08f,.18f,.18f,.95f));
            playerState=Label("PlayerState","",40,153,width-32,68,20);
            enemyState=Label("EnemyState","",xRight+16,153,width-32,68,20);
            playerHp=Bar("PlayerHp",40,230,width-32,16,green);enemyHp=Bar("EnemyHp",xRight+16,230,width-32,16,coral);
            Label("PlayerBalanceLabel","体勢",40,264,52,25,15,muted);Label("EnemyBalanceLabel","体勢",xRight+16,264,52,25,15,muted);
            playerBalance=Bar("PlayerBalance",97,272,width-89,7,blue);enemyBalance=Bar("EnemyBalance",xRight+73,272,width-89,7,blue);
            playerEnergy=Bar("PlayerEnergy",40,297,width-32,5,new Color(.96f,.78f,.37f));enemyEnergy=Bar("EnemyEnergy",xRight+16,297,width-32,5,new Color(.96f,.78f,.37f));
            battleLog=Label("BattleLog","",24,H-237,W-48,68,25,white,TextAnchor.MiddleCenter);
            Box("Orders",0,H-160,W,160,new Color(.08f,.18f,.18f,.96f));
            float bw=(W-72)/3;
            attack=Button("Attack","攻撃",24,H-136,bw,60,()=>game.Command(0),green);
            guard=Button("Guard","防御",36+bw,H-136,bw,60,()=>game.Command(1),blue);
            skill=Button("Skill",game.battle.player.species.skill,48+bw*2,H-136,bw,60,()=>game.Command(2),coral);
            detail=Label("CurrentOrder","",24,H-66,W-48,48,20,muted,TextAnchor.MiddleCenter);
            Refresh();
        }
        public void Pause()
        {
            Begin("試合を中断中");
            float y=H/2-140;
            Box("PauseDialog",W/2-270,y,540,280,new Color(.08f,.18f,.18f,.98f));
            Label("PauseHeading","試合を中断中",W/2-238,y+24,476,50,30,white,TextAnchor.MiddleCenter);
            Button("Resume","試合に戻る",W/2-226,y+98,452,58,game.Resume,green);
            Button("Retreat","報酬なしでキャンプへ",W/2-226,y+179,452,58,game.Collection,ink);
            Refresh();
        }
        public void Result()
        {
            Begin(game.tournament?"森の大会 / 試合結果":"練習試合 / 結果");
            bool win=game.battle.Victory,champion=win&&game.tournament&&game.round==3;
            Box("Results",W/2-280,portrait?405:190,560,300,new Color(.08f,.18f,.18f,.96f));
            float y=portrait?432:217;
            Label("ResultTitle",champion?"森のチャンピオン！":win?"勝利！":"惜しくも敗北",W/2-250,y,500,66,38,champion?new Color(1,.81f,.35f):white,TextAnchor.MiddleCenter);
            Label("MatchRecord","攻撃 "+game.battle.player.hits+" 回   /   転倒 "+game.battle.player.falls+" 回",W/2-250,y+81,500,48,23,muted,TextAnchor.MiddleCenter);
            Label("GrowthResult","パートナー Lv."+game.battle.player.bug.level+"   樹液 "+game.save.nectar,W/2-250,y+133,500,36,23,white,TextAnchor.MiddleCenter);
            if(win&&game.tournament&&game.round<3)Button("NextRound","次の試合へ",W/2-230,y+195,460,56,game.NextRound,coral);
            else Button("Camp","ベースキャンプへ",W/2-230,y+195,460,56,game.Collection,green);
            Refresh();
        }
        public void Refresh()
        {
            if(notice)notice.text=game.toastTime>0?game.toast:"";
            if(summary)summary.text="虫かご "+game.save.bugs.Count+"/48   樹液 "+game.save.nectar+(portrait?"":"   優勝 "+game.save.trophies);
            if(target)
            {
                target.text=game.forest.target!=null?game.Data(game.forest.target.bug).displayName+" / 集中 "+Mathf.RoundToInt(game.forest.focus*100)+"%":"気配を探している";
                Fill(captureFill,game.forest.focus,360);capture.interactable=game.forest.target!=null;
            }
            if(playerState && game.battle!=null)
            {
                var p=game.battle.player;var e=game.battle.enemy;float width=(portrait?312:380)-32;
                playerState.text=p.bug.Name(p.species)+"  Lv."+p.bug.level+"\n"+Mathf.CeilToInt(p.hp)+" / "+p.MaxHp+"  "+State(p);
                enemyState.text=e.bug.Name(e.species)+"  Lv."+e.bug.level+"\n"+Mathf.CeilToInt(e.hp)+" / "+e.MaxHp+"  "+State(e);
                Fill(playerHp,p.hp/p.MaxHp,width);Fill(enemyHp,e.hp/e.MaxHp,width);
                Fill(playerEnergy,p.energy/100,width);Fill(enemyEnergy,e.energy/100,width);
                Fill(playerBalance,p.balance/100,width-57);Fill(enemyBalance,e.balance/100,width-57);
                battleLog.text=game.battle.message;
                detail.text=p.IsDown?"起き上がりまで "+p.down.ToString("F1")+" 秒":"現在の指示："+new[]{"攻撃","防御","技"}[(int)p.order]+"    スタミナ "+Mathf.RoundToInt(p.energy);
                attack.interactable=guard.interactable=skill.interactable=!p.IsDown&&!game.battle.ended;
            }
        }
        static string State(Battle.Fighter f)=>f.IsDown?"転倒":f.immunity>0?"復帰直後":f.order==Order.Guard?"防御":f.order==Order.Skill?"技の構え":"攻撃";
        void Update()
        {
            bool next=Screen.height>Screen.width;if(next==portrait)return;
            portrait=next;GetComponent<CanvasScaler>().referenceResolution=new Vector2(W,H);
            if(game.screen=="forest")Forest();else if(game.screen=="collection")Collection();else if(game.paused)Pause();else if(game.screen=="battle")Battle();else Result();
        }
    }
}
