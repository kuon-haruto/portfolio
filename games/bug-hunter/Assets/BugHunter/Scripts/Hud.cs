using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

namespace BugHunter
{
    public sealed class Hud : MonoBehaviour
    {
        Game game;Font font;
        RectTransform root,page;
        Text notice,nectarCount,bugCount,trophyCount,target,habitat,detail,battleLog,playerState,enemyState,tooltip;
        Image captureFill,playerHp,enemyHp,playerEnergy,enemyEnergy,playerBalance,enemyBalance;
        Image[] selectedOrders;
        Button capture,attack,guard,skill;
        readonly Dictionary<string,Button> buttons=new Dictionary<string,Button>();
        readonly Color ink=new Color(.075f,.095f,.1f,.96f),surface=new Color(.12f,.15f,.15f,.95f),line=new Color(.29f,.34f,.33f,.8f);
        readonly Color white=new Color(.96f,.97f,.94f),muted=new Color(.66f,.73f,.7f),mint=new Color(.35f,.78f,.63f),cyan=new Color(.27f,.76f,.87f),coral=new Color(.97f,.43f,.34f),gold=new Color(.94f,.77f,.4f);
        bool portrait;int viewportWidth,viewportHeight;
        float LayoutScale=>Mathf.Max(.01f,Mathf.Min(Screen.width/(portrait?720f:1280f),Screen.height/(portrait?1280f:720f)));
        float W=>Screen.width/LayoutScale;float H=>Screen.height/LayoutScale;
        public void Initialize(Game g,Font f)
        {
            game=g;font=f;portrait=Screen.height>Screen.width;viewportWidth=Screen.width;viewportHeight=Screen.height;
            var canvas=gameObject.AddComponent<Canvas>();canvas.renderMode=RenderMode.ScreenSpaceOverlay;
            var scaler=gameObject.AddComponent<CanvasScaler>();scaler.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution=new Vector2(W,H);scaler.matchWidthOrHeight=0;
            gameObject.AddComponent<GraphicRaycaster>();root=(RectTransform)transform;
            if(!FindFirstObjectByType<EventSystem>())new GameObject("EventSystem",typeof(EventSystem),typeof(StandaloneInputModule));
        }
        RectTransform Rect(string name,Transform parent,float x,float y,float w,float h)
        {
            var r=new GameObject(name,typeof(RectTransform)).GetComponent<RectTransform>();r.SetParent(parent,false);
            r.anchorMin=r.anchorMax=new Vector2(0,1);r.pivot=new Vector2(0,1);r.anchoredPosition=new Vector2(x,-y);r.sizeDelta=new Vector2(w,h);return r;
        }
        Image Box(string name,float x,float y,float w,float h,Color color)
        {
            var image=Rect(name,page,x,y,w,h).gameObject.AddComponent<Image>();image.color=color;image.raycastTarget=false;return image;
        }
        Text Label(string name,string text,float x,float y,float w,float h,int size=22,Color? color=null,TextAnchor align=TextAnchor.MiddleLeft)
        {
            var t=Rect(name,page,x,y,w,h).gameObject.AddComponent<Text>();t.font=font;t.text=text;t.fontSize=size+(portrait?3:0);t.color=color??white;t.alignment=align;
            t.raycastTarget=false;t.horizontalOverflow=HorizontalWrapMode.Wrap;t.verticalOverflow=VerticalWrapMode.Overflow;return t;
        }
        Image Icon(string icon,float x,float y,float size,Color? color=null)
        {
            var image=Box("Icon "+icon,x,y,size,size,color??white);image.sprite=Resources.Load<Sprite>("UI/"+icon);image.preserveAspect=true;return image;
        }
        Button Button(string name,string text,string icon,float x,float y,float w,float h,Action action,Color? color=null)
        {
            var r=Rect(name,page,x,y,w,h);var image=r.gameObject.AddComponent<Image>();image.color=color??surface;
            var b=r.gameObject.AddComponent<Button>();var colors=b.colors;colors.highlightedColor=new Color(1.2f,1.2f,1.2f);colors.pressedColor=new Color(.7f,.75f,.73f);colors.disabledColor=new Color(.4f,.44f,.42f);b.colors=colors;b.targetGraphic=image;
            b.onClick.AddListener(()=>action());buttons[name]=b;
            if(!string.IsNullOrEmpty(icon))Icon(icon,x+(string.IsNullOrEmpty(text)?(w-32)/2:12),y+(h-32)/2,32).transform.SetParent(r,true);
            if(!string.IsNullOrEmpty(text))Label(name+" label",text,x+(string.IsNullOrEmpty(icon)?12:48),y,w-(string.IsNullOrEmpty(icon)?24:60),h,21,white,TextAnchor.MiddleCenter).transform.SetParent(r,true);
            return b;
        }
        void Tip(Button b,string text)
        {
            var trigger=b.gameObject.AddComponent<EventTrigger>();
            var enter=new EventTrigger.Entry {eventID=EventTriggerType.PointerEnter};enter.callback.AddListener(_=>{if(tooltip){tooltip.text=text;tooltip.transform.SetAsLastSibling();}});trigger.triggers.Add(enter);
            var leave=new EventTrigger.Entry {eventID=EventTriggerType.PointerExit};leave.callback.AddListener(_=>{if(tooltip)tooltip.text="";});trigger.triggers.Add(leave);
        }
        void Hold(string name,string icon,float x,float y,Vector2 move,Vector2 look)
        {
            var b=Button(name,"",icon,x,y,56,56,()=>{},new Color(.1f,.13f,.13f,.65f));
            var trigger=b.gameObject.AddComponent<EventTrigger>();
            var down=new EventTrigger.Entry {eventID=EventTriggerType.PointerDown};down.callback.AddListener(_=>{if(move!=Vector2.zero)game.forest.touchMove=move;if(look!=Vector2.zero)game.forest.touchLook=look;});trigger.triggers.Add(down);
            var up=new EventTrigger.Entry {eventID=EventTriggerType.PointerUp};up.callback.AddListener(_=>{if(move!=Vector2.zero)game.forest.touchMove=Vector2.zero;if(look!=Vector2.zero)game.forest.touchLook=Vector2.zero;});trigger.triggers.Add(up);
        }
        Image Bar(string name,float x,float y,float w,float h,Color color)
        {Box(name+" track",x,y,w,h,new Color(.25f,.29f,.28f));return Box(name,x,y,w,h,color);}
        static void Fill(Image bar,float value,float width){if(bar)bar.rectTransform.sizeDelta=new Vector2(width*Mathf.Clamp01(value),bar.rectTransform.sizeDelta.y);}
        void Begin(string section)
        {
            if(page){page.gameObject.SetActive(false);Destroy(page.gameObject);}buttons.Clear();
            target=habitat=detail=battleLog=playerState=enemyState=null;captureFill=playerHp=enemyHp=playerEnergy=enemyEnergy=playerBalance=enemyBalance=null;
            capture=attack=guard=skill=null;selectedOrders=null;
            game.forest.touchMove=game.forest.touchLook=Vector2.zero;
            page=Rect("Page "+section,root,0,0,W,H);
            Box("Header",0,0,W,74,ink);Box("Header rule",0,73,W,1,line);
            var brand=Rect("Game icon",page,20,14,46,46).gameObject.AddComponent<RawImage>();brand.texture=game.icon;brand.raycastTarget=false;
            Label("Brand","BUG HUNTER",78,3,250,39,24);
            Label("Location",section,79,40,portrait?300:500,27,15,muted);
            Icon("Leaf",W-270,24,26,mint);Icon("Backpack",W-156,24,26,cyan);Icon("Trophy",W-69,24,26,gold);
            nectarCount=Label("Nectar","",W-242,18,78,40,18);
            bugCount=Label("Bug count","",W-128,18,55,40,18);
            trophyCount=Label("Trophies","",W-42,18,38,40,18);
            notice=Label("Notice","",portrait?32:320,84,portrait?656:640,43,20,gold,TextAnchor.MiddleCenter);
            tooltip=Label("Tooltip","",W/2-220,H-35,440,30,16,white,TextAnchor.MiddleCenter);
        }
        public void Forest()
        {
            Begin("こもれびの森 / 探索");
            Box("Field location background",20,100,244,84,new Color(.075f,.095f,.1f,.76f));
            Icon("Compass",24,104,30,gold);Label("Field","雑木林",61,102,240,34,22);
            Label("Discoveries","発見 "+SpeciesCount()+" / 6 種",62,138,220,30,17,white);
            Box("Reticle horizontal",W/2-5,H/2,10,1,white);Box("Reticle vertical",W/2,H/2-5,1,10,white);
            float y=H-213;
            habitat=Label("Habitat","",W/2-190,y,380,28,16,gold,TextAnchor.MiddleCenter);
            target=Label("Target","",W/2-190,y+28,380,43,26,white,TextAnchor.MiddleCenter);
            captureFill=Bar("Capture focus",W/2-100,y+81,200,4,gold);
            capture=Button("Capture","捕まえる","Crosshair",W/2-108,H-116,216,58,game.Capture,new Color(.14f,.39f,.32f,.97f));
            Button("Collection",portrait?"虫かご":"虫かご・育成","Backpack",W-(portrait?178:221),portrait?94:H-86,portrait?154:197,54,game.Collection);
            if(portrait)
            {
                Hold("MoveForward","ArrowUp",80,H-232,Vector2.up,Vector2.zero);
                Hold("MoveLeft","ChevronLeft",22,H-174,Vector2.left,Vector2.zero);Hold("MoveBack","ArrowDown",80,H-174,Vector2.down,Vector2.zero);Hold("MoveRight","ChevronRight",138,H-174,Vector2.right,Vector2.zero);
                Hold("LookUp","ArrowUp",W-136,H-232,Vector2.zero,Vector2.up);
                Hold("LookLeft","ChevronLeft",W-194,H-174,Vector2.zero,Vector2.left);Hold("LookDown","ArrowDown",W-136,H-174,Vector2.zero,Vector2.down);Hold("LookRight","ChevronRight",W-78,H-174,Vector2.zero,Vector2.right);
            }
            Refresh();
        }
        public void Collection()
        {
            Begin("ベースキャンプ / 虫かご");game.CollectionCamera(portrait);
            Box("Camp navigation band",0,74,W,76,new Color(.075f,.095f,.1f,.88f));
            notice.rectTransform.anchoredPosition=new Vector2(portrait?24:285,-(H-114));notice.rectTransform.sizeDelta=new Vector2(portrait?672:540,30);notice.fontSize=16;
            Tip(Button("Explore","","ArrowLeft",24,91,50,48,game.Explore),"森に戻る");
            Label("CollectionTitle","フィールドノート",90,91,430,48,28);
            var bug=game.Selected;
            if(bug==null)
            {
                Box("Empty backdrop",24,H-260,W-48,170,ink);Label("Empty","まだ見つかっていない",48,H-250,W-96,56,28);
                Button("FirstCapture","探索へ","Compass",48,H-173,245,58,game.Explore,new Color(.16f,.42f,.34f));Refresh();return;
            }
            var data=game.Data(bug);
            if(!portrait)
            {
                Box("Roster",24,158,248,H-270,ink);
                Label("Roster title","虫かご",42,167,200,33,19,muted);
                int first=game.selected/5*5;
                for(int i=first;i<Mathf.Min(first+5,game.save.bugs.Count);i++)
                {
                    int index=i;var item=game.save.bugs[i];var species=game.Data(item);float y=212+(i-first)*65;
                    var button=Button("Specimen"+i,"","",35,y,226,59,()=>game.Select(index),i==game.selected?new Color(.2f,.29f,.27f):surface);
                    Box("Species accent "+i,35,y,3,59,species.shell).transform.SetParent(button.transform,true);
                    Label("Species "+i,species.displayName,49,y+1,197,31,19).transform.SetParent(button.transform,true);
                    Label("Individual "+i,"Lv."+item.level+(item.id==game.save.partner?"   パートナー":"   "+item.Nature),49,y+31,195,24,14,muted).transform.SetParent(button.transform,true);
                }
            }
            float x=portrait?24:W-426,y0=portrait?538:158,w=portrait?W-48:402;
            Box("Specimen data",x,y0,w,portrait?580:450,ink);Box("Specimen accent",x,y0,4,58,data.shell);
            Label("Name",data.displayName,x+22,y0+12,w-127,48,portrait?31:27);
            Label("Level","Lv."+bug.level,x+w-105,y0+16,83,40,25,gold,TextAnchor.MiddleRight);
            Label("Individual",Species.TypeName(data.type)+" / "+bug.Nature+" / "+(bug.size*100).ToString("F0")+" mm",x+22,y0+67,w-44,32,17,muted);
            Label("Growth heading","能力値",x+22,y0+115,180,28,16,muted);
            Label("Growth unit","成長 / Lv.",x+w-137,y0+115,115,28,16,muted,TextAnchor.MiddleRight);
            string[] names={"体力","攻撃","防御","素早さ"};string[] icons={"Heart","Swords","Shield","Footprints"};Color[] colors={mint,coral,cyan,gold};
            for(int i=0;i<4;i++)
            {
                float row=y0+157+i*43;
                Icon(icons[i],x+18,row,25,colors[i]);Label("Stat "+i,names[i],x+51,row-4,80,32,18);
                Label("Value "+i,bug.Stat(data,i).ToString(),x+130,row-4,54,32,22,white,TextAnchor.MiddleRight);
                float bw=w-282;var bar=Bar("Stat bar "+i,x+201,row+9,bw,7,colors[i]);Fill(bar,bug.Stat(data,i)/(i==0?300f:100),bw);
                Label("Growth "+i,"+"+bug.growth[i],x+w-62,row-4,40,32,19,colors[i],TextAnchor.MiddleRight);
            }
            Label("Skill","得意技  "+data.skill,x+22,y0+338,w-44,32,19,white);
            Label("Experience","経験値  "+bug.xp+" / "+bug.NextXp,x+22,y0+378,w-44,30,16,muted);
            var xp=Bar("Experience bar",x+22,y0+419,w-44,4,gold);Fill(xp,bug.xp/(float)bug.NextXp,w-44);
            float actions=portrait?1002:622;
            Button("Train",portrait?"育成  樹液 8":"育成  8","Leaf",x,actions,(w-12)/2,54,game.Train,new Color(.18f,.39f,.31f)).interactable=bug.level<20&&game.save.nectar>=8;
            Button("Partner",game.save.partner==bug.id?"選択中":"パートナー",game.save.partner==bug.id?"Check":"Plus",x+(w+12)/2,actions,(w-12)/2,54,game.Partner,new Color(.2f,.3f,.32f));
            float navY=portrait?454:H-165;
            Tip(Button("Previous","","ChevronLeft",portrait?24:320,navY,52,48,()=>game.Select((game.selected+game.save.bugs.Count-1)%game.save.bugs.Count)),"前の個体");
            Label("Index",(game.selected+1)+" / "+game.save.bugs.Count,portrait?244:410,navY,200,48,20,white,TextAnchor.MiddleCenter);
            Tip(Button("Next","","ChevronRight",portrait?W-76:711,navY,52,48,()=>game.Select((game.selected+1)%game.save.bugs.Count)),"次の個体");
            float by=H-86;
            if(portrait){Box("Camp actions",0,by-12,W,98,ink);Button("Practice","練習試合","Swords",24,by,280,58,()=>game.BattleStart(false));Button("Tournament","森の大会","Trophy",320,by,W-344,58,()=>game.BattleStart(true),new Color(.63f,.3f,.22f));}
            else{Button("Practice","練習試合","Swords",24,by,248,58,()=>game.BattleStart(false));Button("Tournament","森の大会へ","Trophy",320,by,443,58,()=>game.BattleStart(true),new Color(.63f,.3f,.22f));}
            Refresh();
        }
        int SpeciesCount(){var set=new HashSet<int>();foreach(var bug in game.save.bugs)set.Add(bug.species);return set.Count;}
        public void Battle()
        {
            Begin(game.tournament?"森の大会 / 第 "+game.round+" 試合":"森のアリーナ / 練習試合");
            float width=portrait?310:408,right=W-width-24;
            FighterHud(24,width,true);FighterHud(right,width,false);
            Tip(Button("Pause","","Pause",W/2-23,portrait?244:91,46,46,game.Pause),"一時停止");
            if(!portrait)Label("Round",game.tournament?"ROUND 0"+game.round:"PRACTICE",W/2-94,144,188,32,16,gold,TextAnchor.MiddleCenter);
            Box("Battle event background",W/2-(portrait?330:320),H-205,portrait?660:640,47,new Color(.075f,.095f,.1f,.85f));
            battleLog=Label("Battle event","",W/2-(portrait?312:300),H-205,portrait?624:600,47,21,white,TextAnchor.MiddleCenter);
            Box("Command bar",0,H-142,W,142,ink);Box("Command rule",0,H-142,W,1,line);
            float bw=portrait?(W-72)/3:248,start=portrait?24:244;
            attack=Button("Attack","攻撃","Swords",start,H-122,bw,61,()=>game.Command(0));
            guard=Button("Guard","防御","Shield",start+bw+12,H-122,bw,61,()=>game.Command(1));
            skill=Button("Skill","技","Zap",start+(bw+12)*2,H-122,bw,61,()=>game.Command(2));
            selectedOrders=new Image[3];Color[] colors={mint,cyan,coral};for(int i=0;i<3;i++)selectedOrders[i]=Box("Order selected "+i,start+(bw+12)*i,H-64,bw,3,colors[i]);
            detail=Label("Current order","",24,H-51,W-48,35,17,muted,TextAnchor.MiddleCenter);Refresh();
        }
        void FighterHud(float x,float width,bool player)
        {
            var f=player?game.battle.player:game.battle.enemy;Color color=player?cyan:coral;
            Box(player?"Partner status":"Opponent status",x,92,width,portrait?140:130,ink);Box("Team accent",x,92,3,portrait?140:130,color);
            Label("Team",player?"PARTNER":"OPPONENT",x+16,100,width-32,23,13,color);
            var state=Label("Fighter state","",x+16,124,width-32,56,portrait?18:20);
            var hp=Bar("Health",x+16,188,width-32,9,color);
            Icon("Zap",x+12,204,18,gold);var energy=Bar("Energy",x+35,211,(width-72)/2,4,gold);
            Icon("Footprints",x+width/2+7,204,18,mint);var balance=Bar("Balance",x+width/2+30,211,(width-92)/2,4,mint);
            if(player){playerState=state;playerHp=hp;playerEnergy=energy;playerBalance=balance;}
            else{enemyState=state;enemyHp=hp;enemyEnergy=energy;enemyBalance=balance;}
        }
        public void Pause()
        {
            Begin("一時停止");Box("Dimmer",0,74,W,H-74,new Color(.04f,.06f,.06f,.65f));float y=H/2-157;
            Box("Pause dialog",W/2-270,y,540,314,ink);Icon("Pause",W/2-24,y+20,48,gold);
            Label("Paused","試合を中断中",W/2-230,y+76,460,46,30,white,TextAnchor.MiddleCenter);
            Button("Resume","試合に戻る","Play",W/2-226,y+149,452,58,game.Resume,new Color(.15f,.4f,.32f));
            Button("Retreat","報酬なしでキャンプへ","ArrowLeft",W/2-226,y+226,452,58,game.Collection);Refresh();
        }
        public void Result()
        {
            Begin(game.tournament?"森の大会 / 試合結果":"練習試合 / 結果");bool win=game.battle.Victory,champion=win&&game.tournament&&game.round==3;
            Box("Dimmer",0,74,W,H-74,new Color(.04f,.06f,.06f,.48f));float y=portrait?382:151;
            Box("Result dialog",W/2-270,y,540,414,ink);Box("Result accent",W/2-270,y,540,3,win?gold:coral);
            Icon(win?"Trophy":"Swords",W/2-26,y+23,52,win?gold:coral);
            Label("Result title",champion?"森のチャンピオン":win?"VICTORY":"DEFEAT",W/2-242,y+91,484,57,champion?33:39,white,TextAnchor.MiddleCenter);
            Label("Match record","攻撃 "+game.battle.player.hits+" 回     転倒 "+game.battle.player.falls+" 回",W/2-232,y+165,464,38,20,muted,TextAnchor.MiddleCenter);
            Label("Growth result","パートナー Lv."+game.battle.player.bug.level+"     樹液 "+game.save.nectar,W/2-232,y+216,464,38,21,gold,TextAnchor.MiddleCenter);
            if(game.tournament)Label("Cup progress",new[]{"1回戦","準決勝","決勝"}[game.round-1]+(win?"  突破":"  終了"),W/2-232,y+267,464,30,18,muted,TextAnchor.MiddleCenter);
            if(win&&game.tournament&&game.round<3)Button("NextRound","次の試合へ","ChevronRight",W/2-226,y+332,452,58,game.NextRound,new Color(.6f,.3f,.23f));
            else Button("Camp","ベースキャンプへ","ArrowLeft",W/2-226,y+332,452,58,game.Collection,new Color(.15f,.4f,.32f));Refresh();
        }
        public void Refresh()
        {
            if(notice)notice.text=game.toastTime>0?game.toast:"";
            if(nectarCount){nectarCount.text=game.save.nectar.ToString();bugCount.text=game.save.bugs.Count.ToString();trophyCount.text=game.save.trophies.ToString();}
            if(target)
            {
                var w=game.forest.target;target.text=w!=null?game.Data(w.bug).displayName:"";habitat.text=w!=null?w.habitat+"   "+Mathf.RoundToInt(game.forest.focus*100)+"%":"";
                Fill(captureFill,game.forest.focus,200);capture.interactable=w!=null;
            }
            if(playerState&&game.battle!=null)
            {
                var p=game.battle.player;var e=game.battle.enemy;float width=portrait?310:408;
                playerState.text=p.species.displayName+"  Lv."+p.bug.level+"\n"+Mathf.CeilToInt(p.hp)+" / "+p.MaxHp+"   "+State(p);
                enemyState.text=e.species.displayName+"  Lv."+e.bug.level+"\n"+Mathf.CeilToInt(e.hp)+" / "+e.MaxHp+"   "+State(e);
                Fill(playerHp,p.hp/p.MaxHp,width-32);Fill(enemyHp,e.hp/e.MaxHp,width-32);
                Fill(playerEnergy,p.energy/100,(width-72)/2);Fill(enemyEnergy,e.energy/100,(width-72)/2);Fill(playerBalance,p.balance/100,(width-92)/2);Fill(enemyBalance,e.balance/100,(width-92)/2);
                battleLog.text=game.battle.message;
                detail.text=p.IsDown?"転倒  /  起き上がりまで "+p.down.ToString("F1")+" 秒":new[]{"接近・攻撃","防御・回復","技："+p.species.skill}[(int)p.order]+"     スタミナ "+Mathf.RoundToInt(p.energy)+"     体勢 "+Mathf.RoundToInt(p.balance);
                attack.interactable=guard.interactable=skill.interactable=!p.IsDown&&!game.battle.ended;
                for(int i=0;i<3;i++)selectedOrders[i].enabled=(int)p.order==i;
            }
        }
        static string State(Battle.Fighter f)=>f.IsDown?"転倒 "+f.down.ToString("F1")+"s":f.immunity>0?"復帰":f.order==Order.Guard?"防御":f.order==Order.Skill?"技":"攻撃";
        [Serializable]public class ControlDiagnostic {public string name;public float x,y,width,height;public bool enabled;}
        public ControlDiagnostic[] Controls()
        {
            var list=new List<ControlDiagnostic>();var corners=new Vector3[4];
            foreach(var pair in buttons)
            {
                if(!pair.Value)continue;((RectTransform)pair.Value.transform).GetWorldCorners(corners);
                list.Add(new ControlDiagnostic {name=pair.Key,x=corners[0].x/Screen.width,y=1-corners[1].y/Screen.height,width=(corners[2].x-corners[0].x)/Screen.width,height=(corners[1].y-corners[0].y)/Screen.height,enabled=pair.Value.interactable});
            }
            return list.ToArray();
        }
        void Update()
        {
            if(Screen.width==viewportWidth&&Screen.height==viewportHeight)return;
            viewportWidth=Screen.width;viewportHeight=Screen.height;portrait=Screen.height>Screen.width;
            GetComponent<CanvasScaler>().referenceResolution=new Vector2(W,H);
            if(game.screen=="forest")Forest();else if(game.screen=="collection")Collection();else if(game.paused)Pause();else if(game.screen=="battle")Battle();else Result();
        }
    }
}
