using System;
using System.IO;
using UnityEngine;
using UnityEngine.EventSystems;

namespace BugHunter
{
    public sealed class Game : MonoBehaviour
    {
        public Species[] catalog;
        public Material woodland;
        public Font font;
        public Texture2D icon;
        public SaveData save;
        public Forest forest;
        public Hud hud;
        public Battle battle;
        public Arena arena;
        public string screen = "forest", toast = "";
        public float toastTime;
        public int selected, round;
        public bool tournament;
        public bool paused;
        public BugView preview, fighterA, fighterB;
        readonly System.Random random = new System.Random();
        float captureCooldown, uiClock, resultDelay = -1;
        float diagnosticClock;
        int frameCount;
        int forestInputStartFrame=-1;
        float frameTime, fps;
        bool rewarded;
        AudioSource sound;
        AudioClip note;
        string SavePath => Path.Combine(Application.persistentDataPath,"bug-hunter.json");
        public Individual Selected => save.bugs.Count==0?null:save.bugs[Mathf.Clamp(selected,0,save.bugs.Count-1)];
        public Species Data(Individual bug) => catalog[bug.species];
        void Awake()
        {
            #if UNITY_WEBGL && !UNITY_EDITOR
            WebGLInput.stickyCursorLock=false;
            #endif
            Application.targetFrameRate=60; QualitySettings.vSyncCount=0;QualitySettings.antiAliasing=2;
            RenderSettings.fog=true;RenderSettings.fogMode=FogMode.Linear;RenderSettings.fogStartDistance=22;RenderSettings.fogEndDistance=57;RenderSettings.fogColor=new Color(.53f,.64f,.61f);
            RenderSettings.ambientMode=UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor=new Color(.63f,.7f,.73f);RenderSettings.ambientEquatorColor=new Color(.45f,.5f,.37f);RenderSettings.ambientGroundColor=new Color(.25f,.3f,.23f);
            RenderSettings.skybox=Resources.Load<Material>("Environment/Sky");
            QualitySettings.shadows=ShadowQuality.HardOnly;QualitySettings.shadowDistance=22;QualitySettings.shadowResolution=ShadowResolution.Medium;
            var sun=new GameObject("Sun",typeof(Light)).GetComponent<Light>();sun.type=LightType.Directional;sun.transform.rotation=Quaternion.Euler(48,-32,0);sun.intensity=1.15f;sun.color=new Color(1,.96f,.85f);sun.shadows=LightShadows.Hard;sun.shadowStrength=.65f;
            Load();
            forest=new GameObject("Woodland",typeof(Forest)).GetComponent<Forest>();forest.Initialize(catalog,woodland);
            arena=new GameObject("Arena navigation",typeof(Arena)).GetComponent<Arena>();arena.Initialize();
            hud=new GameObject("HUD",typeof(Hud)).GetComponent<Hud>();hud.Initialize(this,font);
            sound=gameObject.AddComponent<AudioSource>();sound.volume=.16f;sound.spatialBlend=0;
            var samples=new float[4410];for(int i=0;i<samples.Length;i++)samples[i]=Mathf.Sin(i*2*Mathf.PI*720/44100f)*(1-i/(float)samples.Length);
            note=AudioClip.Create("Notice",samples.Length,1,44100,false);note.SetData(samples,0);
            hud.Forest();
            if(!string.IsNullOrEmpty(toast))hud.Refresh();
        }
        void Load()
        {
            save=new SaveData();
            if(!File.Exists(SavePath))return;
            try { var data=JsonUtility.FromJson<SaveData>(File.ReadAllText(SavePath));data.Validate(catalog);save=data; }
            catch(Exception e) { Debug.LogWarning("Save was not loaded: "+e.Message);toast="保存データを読み込めませんでした。元のファイルは保持されています。";toastTime=12;saveWritable=false; }
        }
        bool saveWritable=true;
        public void Save()
        {
            if(!saveWritable)return;
            try
            {
                Directory.CreateDirectory(Application.persistentDataPath);
                string temp=SavePath+".tmp";File.WriteAllText(temp,JsonUtility.ToJson(save));
                File.Copy(temp,SavePath,true);File.Delete(temp);
                #if UNITY_WEBGL && !UNITY_EDITOR
                SyncSave();
                #endif
            }
            catch(Exception e) { Debug.LogWarning("Save failed: "+e.Message);Notify("保存できませんでした。ブラウザーの保存設定を確認してください。"); }
        }
        #if UNITY_WEBGL && !UNITY_EDITOR
        [System.Runtime.InteropServices.DllImport("__Internal")] static extern void SyncSave();
        [System.Runtime.InteropServices.DllImport("__Internal")] static extern void ReportStats(string json);
        #endif
        void OnApplicationPause(bool paused){if(paused)Save();}
        void OnApplicationQuit(){Save();}
        public void Notify(string text) { toast=text;toastTime=4; if(sound&&note)sound.PlayOneShot(note); }
        public void Capture()
        {
            if(screen!="forest"||captureCooldown>0)return;
            forest.Swing();
            var w=forest.target;
            if(w==null){Notify("近くに虫がいない");return;}
            if(save.bugs.Count>=48){Notify("虫かごがいっぱい / 48匹");return;}
            captureCooldown=1.1f;
            float chance=catalog[w.bug.species].capture*.65f+forest.focus*.48f;
            if(random.NextDouble()>Mathf.Min(.97f,chance))
            { forest.Startle(w);Notify("警戒している……");return; }
            save.bugs.Add(w.bug);save.captures++;save.nectar+=4;
            if(string.IsNullOrEmpty(save.partner))save.partner=w.bug.id;
            Notify(Data(w.bug).displayName+"を捕まえた！  樹液 +4");forest.Catch(w);Save();hud.Refresh();
        }
        void ClearActors()
        {
            if(preview)Destroy(preview.gameObject);if(arena)arena.Clear();
            preview=fighterA=fighterB=null;
        }
        public void Explore()
        {
            // The menu's release click must not also activate forest input.
            forestInputStartFrame=Time.frameCount;
            paused=false;screen="forest";battle=null;resultDelay=-1;ClearActors();forest.Explore();hud.Forest();Save();
        }
        public void Collection()
        {
            paused=false;screen="collection";battle=null;resultDelay=-1;ClearActors();
            CollectionCamera(Screen.height>Screen.width);
            ShowSelected();hud.Collection();
        }
        public void CollectionCamera(bool portrait)
        {
            forest.View(portrait?new Vector3(160,3,10):new Vector3(159.25f,2.8f,6),portrait?new Vector3(160,-2.1f,0):new Vector3(159.25f,.65f,0));
        }
        public void Select(int index)
        {
            selected=Mathf.Clamp(index,0,Math.Max(0,save.bugs.Count-1));ShowSelected();hud.Collection();
        }
        void ShowSelected()
        {
            if(preview)Destroy(preview.gameObject);
            if(Selected==null)return;
            preview=Instantiate(Data(Selected).model).GetComponent<BugView>();preview.transform.position=new Vector3(160,0,0);
            preview.transform.localScale=Vector3.one*1.6f*Selected.size;preview.transform.rotation=Quaternion.Euler(0,-28,0);
            foreach(var renderer in preview.GetComponentsInChildren<Renderer>())renderer.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.On;
        }
        public void Partner()
        { if(Selected==null)return;save.partner=Selected.id;Notify("パートナーに選んだ");Save();hud.Collection(); }
        public void Train()
        {
            if(Selected==null)return;
            if(Selected.level>=20){Notify("最大レベルです");return;}
            if(save.nectar<8){Notify("樹液が足りない / 必要 8");return;}
            save.nectar-=8;Selected.training++;int level=Selected.Gain(36);
            Notify(level>0?"レベルアップ！ Lv."+Selected.level:"トレーニング完了 / 経験値 +36");Save();hud.Collection();
        }
        public void BattleStart(bool cup)
        {
            if(save.bugs.Count==0){Notify("まず森で虫を捕まえよう");return;}
            tournament=cup;round=1;StartRound();
        }
        void StartRound()
        {
            var bug=save.bugs.Find(b=>b.id==save.partner)??save.bugs[0];
            int enemyId=tournament?(round+1)%catalog.Length:random.Next(catalog.Length);
            var other=Individual.Create(catalog[enemyId],random.Next());other.level=Mathf.Clamp(bug.level+(tournament?round-2:0),1,20);
            battle=new Battle(bug,Data(bug),other,Data(other),random.Next());
            battle.impact=(side,heavy)=>{arena.Impact(side,heavy);sound.pitch=heavy?.65f:1.25f;sound.PlayOneShot(note);};
            ClearActors();arena.StartFight(battle,forest.cameraView,woodland);fighterA=arena.View(0);fighterB=arena.View(1);
            screen="battle";rewarded=false;resultDelay=-1;
            forest.View(new Vector3(260,8,11),new Vector3(260,.4f,0));arena.FrameCamera(10);hud.Battle();
        }
        public void Command(int command)
        {
            if(battle==null||screen!="battle"||paused)return;
            if(!battle.Command((Order)command))Notify("起き上がり中");else hud.Refresh();
        }
        public void NextRound() { if(tournament && battle!=null && battle.Victory && round<3){round++;StartRound();} }
        public void Pause()
        { if(screen!="battle")return;paused=true;hud.Pause(); }
        public void Resume()
        { paused=false;hud.Battle(); }
        void Finish()
        {
            if(rewarded)return;rewarded=true;screen="result";
            int nectar=battle.Victory?10+round*3:4,xp=battle.Victory?38+round*8:18;
            save.nectar+=nectar;int levels=battle.player.bug.Gain(xp);
            if(battle.Victory)save.wins++;
            if(tournament&&round==3&&battle.Victory){save.trophies++;save.nectar+=25;}
            Notify("樹液 +"+nectar+" / 経験値 +"+xp+(levels>0?" / レベルアップ！":""));
            Save();hud.Result();
        }
        void Update()
        {
            float dt=Time.deltaTime;captureCooldown=Mathf.Max(0,captureCooldown-dt);toastTime=Mathf.Max(0,toastTime-dt);
            frameCount++;frameTime+=Time.unscaledDeltaTime;
            if(frameTime>=1){fps=frameCount/frameTime;frameCount=0;frameTime=0;}
            if(screen=="forest"&&Time.frameCount>forestInputStartFrame)
            {
                if(Input.GetKeyDown(KeyCode.Space))Capture();
                if(Input.GetKeyDown(KeyCode.Escape))forest.ReleaseLook();
                if(Input.GetMouseButtonDown(0)&&Input.touchCount==0)
                {
                    if(forest.LookLocked)Capture();
                    else if(new Rect(0,0,Screen.width,Screen.height).Contains(Input.mousePosition)&&!hud.PointerOverControl())forest.LockLook();
                }
            }
            if(Input.GetKeyDown(KeyCode.Tab)){if(screen=="forest")Collection();else if(screen=="collection")Explore();}
            if(screen=="battle" && Input.GetKeyDown(KeyCode.Escape)){if(paused)Resume();else Pause();}
            if(screen=="battle" && !paused)
            {
                if(Input.GetKeyDown(KeyCode.Alpha1))Command(0);if(Input.GetKeyDown(KeyCode.Alpha2))Command(1);if(Input.GetKeyDown(KeyCode.Alpha3))Command(2);
                battle.Tick(dt);
                if(battle.ended){if(resultDelay<0)resultDelay=1.2f;resultDelay-=dt;if(resultDelay<=0)Finish();}
            }
            if(battle!=null && fighterA && fighterB)arena.Tick(dt,paused);
            if(preview)preview.transform.rotation=Quaternion.Euler(0,-28+Mathf.Sin(Time.time*.35f)*16,0);
            uiClock-=dt;if(uiClock<=0){uiClock=.1f;hud.Refresh();}
            #if UNITY_WEBGL && !UNITY_EDITOR
            diagnosticClock-=dt;if(diagnosticClock<=0){diagnosticClock=1;ReportStats(Snapshot());}
            #endif
        }
        // Read-only diagnostics used by the browser smoke test; no save or battle mutations.
        public string Snapshot()
        {
            return JsonUtility.ToJson(new Diagnostic { screen=screen, count=save.bugs.Count, target=forest.target!=null,
                focus=forest.focus, round=round, hp=battle?.player.hp??0, enemyHp=battle?.enemy.hp??0,
                falls=battle?.player.falls??0, level=Selected?.level??0,
                energy=battle?.player.energy??0,balance=battle?.player.balance??0,down=battle?.player.down??0,enemyDown=battle?.enemy.down??0,
                victory=battle?.Victory??false,paused=paused,trophies=save.trophies,nectar=save.nectar,fps=fps,
                memory=UnityEngine.Profiling.Profiler.GetTotalAllocatedMemoryLong(),visibleWild=forest.VisibleCount,wildCount=forest.wildlife.Count,
                targetHabitat=forest.target?.habitat??"",playerPosition=forest.player.position,
                lookLocked=forest.LookLocked,viewYaw=forest.ViewYaw,viewPitch=forest.ViewPitch,
                navigation=arena.Navigating,positionA=arena.Position(0),positionB=arena.Position(1),travelA=arena.Travel(0),travelB=arena.Travel(1),maxHitDistance=arena.maxHitDistance,
                ui=hud.Controls(),habitats=forest.wildlife.ConvertAll(w=>new HabitatDiagnostic {species=w.bug.species,position=w.view.transform.position,normal=w.normal,home=w.home,scale=w.view.transform.localScale.x,habitat=w.habitat}).ToArray() });
        }
        [Serializable] public class HabitatDiagnostic { public int species;public Vector3 position,normal,home;public float scale;public string habitat; }
        [Serializable] public class Diagnostic { public string screen,targetHabitat; public int count,round,falls,level,trophies,nectar,visibleWild,wildCount;public bool target,victory,paused,navigation,lookLocked;public float focus,hp,enemyHp,energy,balance,down,enemyDown,fps,travelA,travelB,maxHitDistance,viewYaw,viewPitch;public long memory;public Vector3 playerPosition,positionA,positionB;public Hud.ControlDiagnostic[] ui;public HabitatDiagnostic[] habitats; }
    }
}
