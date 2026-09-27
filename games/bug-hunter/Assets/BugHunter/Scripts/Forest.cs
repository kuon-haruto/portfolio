using UnityEngine;
using System.Collections.Generic;

namespace BugHunter
{
    public sealed class Forest : MonoBehaviour
    {
        public sealed class Wild
        {
            public Individual bug;
            public BugView view;
            public Vector3 home,normal;
            public Quaternion rotation;
            public string habitat;
            public float timer,respawn,startled;
            public Vector3 Aim => view.transform.TransformPoint(new Vector3(0,.5f,.05f));
        }
        public Species[] species;
        public readonly List<Wild> wildlife=new List<Wild>();
        public Transform player;
        public Camera cameraView;
        CharacterController controller;
        float yaw=21,pitch=5,vertical;
        bool lookWasLocked;
        public bool LookLocked=>Cursor.lockState==CursorLockMode.Locked;
        public float ViewYaw=>yaw;
        public float ViewPitch=>pitch;
        public bool exploring;
        public bool inputEnabled=true;
        public float sensitivity=1;
        public Vector2 touchMove,touchLook;
        readonly System.Random random=new System.Random(623);
        public float focus;
        public Wild target;
        Transform net;
        Mesh netMesh;
        float swing;
        public void Initialize(Species[] catalog,Material mat)
        {
            species=catalog;gameObject.AddComponent<Landscape>().Initialize();
            Add(0,Landscape.Ground(1.8f,-7)+new Vector3(0,1.35f,-.49f),Vector3.back,"クヌギの幹");
            Add(1,Landscape.Ground(-8,2)+new Vector3(.53f,1.25f,0),Vector3.right,"樹皮のくぼみ");
            Add(2,Landscape.Ground(-6,-4)+Vector3.up*.42f,Vector3.up,"草の茎");
            Add(3,Landscape.Ground(5,19)+Vector3.up*.05f,Vector3.up,"草むら");
            Add(4,Landscape.Ground(8,6)+Vector3.up*.9f,Vector3.up,"水辺のアシ");
            Add(5,Landscape.Ground(-13,14)+Vector3.up*.35f,Vector3.up,"低木の葉");
            Add(1,Landscape.Ground(-6,8)+new Vector3(1.3f,.86f,.3f),Vector3.up,"倒木");
            Add(0,Landscape.Ground(18,19)+new Vector3(0,1.45f,-.47f),Vector3.back,"木陰の幹");
            player=new GameObject("Explorer",typeof(CharacterController)).transform;
            controller=player.GetComponent<CharacterController>();controller.height=1.7f;controller.radius=.24f;controller.center=new Vector3(0,.85f,0);controller.stepOffset=.35f;
            player.position=Landscape.Ground(0,-12)+Vector3.up*.1f;player.rotation=Quaternion.Euler(0,yaw,0);
            cameraView=new GameObject("Main Camera",typeof(Camera),typeof(AudioListener)).GetComponent<Camera>();cameraView.tag="MainCamera";
            cameraView.clearFlags=CameraClearFlags.Skybox;cameraView.backgroundColor=new Color(.63f,.72f,.7f);
            cameraView.farClipPlane=65;cameraView.nearClipPlane=.05f;cameraView.fieldOfView=58;
            var g=new Geometry();
            g.Stem(new Vector3(.57f,-.92f,.8f),new Vector3(.62f,-.26f,1.4f),.018f,.018f,new Color(.56f,.44f,.25f));
            var center=new Vector3(.62f,.04f,1.44f);
            for(int k=0;k<24;k++)
            {
                float a=k*Mathf.PI*2/24,b=(k+1)*Mathf.PI*2/24;
                g.Stem(center+new Vector3(Mathf.Cos(a)*.3f,Mathf.Sin(a)*.3f,0),center+new Vector3(Mathf.Cos(b)*.3f,Mathf.Sin(b)*.3f,0),.008f,.008f,new Color(.78f,.84f,.82f),5);
                if(k%2==0)g.Stem(center+new Vector3(Mathf.Cos(a)*.3f,Mathf.Sin(a)*.3f,0),center+new Vector3(0,0,.23f),.002f,.002f,new Color(.7f,.8f,.76f),4);
            }
            netMesh=g.Mesh("Net");net=Geometry.Object("Catching net",netMesh,mat,cameraView.transform).transform;
            Explore();
        }
        void Add(int id,Vector3 p,Vector3 normal,string habitat)
        {
            var w=new Wild {bug=Individual.Create(species[id],random.Next()),home=p,normal=normal,habitat=habitat,timer=wildlife.Count*1.7f};
            w.rotation=normal==Vector3.up?Quaternion.Euler(0,random.Next(360),0):Quaternion.LookRotation(Vector3.up,normal);
            w.view=Instantiate(species[id].model,transform).GetComponent<BugView>();w.view.phase=wildlife.Count;w.view.movement=.1f;
            w.view.transform.SetPositionAndRotation(p,w.rotation);w.view.transform.localScale=Vector3.one*(id==4?.24f:.23f)*w.bug.size;
            wildlife.Add(w);
            if(id==2||id==4||id==5)
            {
                var support=new Geometry();var basePoint=new Vector3(p.x,Landscape.Height(p.x,p.z),p.z);
                support.Stem(basePoint,p,.025f,.008f,new Color(.36f,.47f,.18f));
                support.Leaf(p-Vector3.up*.02f,.45f,.15f,new Color(.3f,.5f,.16f),w.rotation);
                Geometry.Object("Habitat perch",support.Mesh("Perch"),GetComponent<Landscape>().foliage,transform);
            }
        }
        public void Explore()
        {
            ReleaseLook();
            exploring=true;if(net)net.gameObject.SetActive(true);cameraView.transform.SetParent(player,false);cameraView.transform.localPosition=new Vector3(0,1.6f,0);
            cameraView.transform.localRotation=Quaternion.Euler(pitch,0,0);target=null;focus=0;
        }
        public void View(Vector3 position,Vector3 lookAt)
        {
            ReleaseLook();
            exploring=false;if(net)net.gameObject.SetActive(false);cameraView.transform.SetParent(null);cameraView.transform.position=position;cameraView.transform.LookAt(lookAt);
            touchMove=Vector2.zero;touchLook=Vector2.zero;
        }
        public void LockLook(){if(exploring)Cursor.lockState=CursorLockMode.Locked;}
        public void ReleaseLook(){Cursor.lockState=CursorLockMode.None;Cursor.visible=true;lookWasLocked=false;}
        void OnApplicationFocus(bool focused){if(!focused)ReleaseLook();}
        public void Catch(Wild wild){wild.respawn=65;wild.view.gameObject.SetActive(false);target=null;focus=0;}
        public void Startle(Wild wild){wild.startled=1.3f;focus=0;}
        public void Swing(){swing=1;}
        public int VisibleCount
        {
            get
            {
                int count=0;foreach(var w in wildlife)
                {
                    if(!w.view.gameObject.activeSelf)continue;
                    var v=cameraView.WorldToViewportPoint(w.Aim);
                    if(v.z>0&&v.z<15&&v.x>0&&v.x<1&&v.y>0&&v.y<1&&!Physics.Linecast(cameraView.transform.position,w.Aim))count++;
                }
                return count;
            }
        }
        void Update()
        {
            float dt=Time.deltaTime;
            foreach(var w in wildlife)
            {
                if(w.respawn>0)
                {
                    w.respawn=Mathf.Max(.001f,w.respawn-dt);
                    if(w.respawn<=.001f && Vector3.Distance(player.position,w.home)>8)
                    {w.respawn=0;w.bug=Individual.Create(species[w.bug.species],random.Next());w.view.gameObject.SetActive(true);}
                    continue;
                }
                w.timer+=dt;w.startled=Mathf.Max(0,w.startled-dt);
                // Movement follows the local surface rather than spinning through the trunk.
                float crawl=Mathf.Sin(w.timer*.28f)*.045f;
                w.view.transform.position=w.home+w.rotation*new Vector3(0,0,crawl);
                w.view.transform.rotation=w.rotation*Quaternion.Euler(0,Mathf.Sin(w.timer*.5f)*3,0);
                w.view.movement=w.startled>0?.8f:.1f;
            }
            if(!exploring||!inputEnabled)return;
            swing=Mathf.Max(0,swing-dt*2.2f);float sw=Mathf.Sin(swing*Mathf.PI);
            if(net){net.localPosition=new Vector3(-sw*.4f,-.5f+sw*.1f,sw*.25f);net.localRotation=Quaternion.Euler(sw*26,sw*-18,sw*12);}
            // Ignore the transition frame so locking cannot jerk the camera.
            bool rotate=LookLocked&&lookWasLocked;lookWasLocked=LookLocked;
            yaw=Mathf.Repeat(yaw+((rotate?Input.GetAxisRaw("Mouse X")*2.2f:0)+touchLook.x*75*dt)*sensitivity,360);
            pitch=Mathf.Clamp(pitch-((rotate?Input.GetAxisRaw("Mouse Y")*2.2f:0)+touchLook.y*55*dt)*sensitivity,-78,78);
            player.rotation=Quaternion.Euler(0,yaw,0);cameraView.transform.localRotation=Quaternion.Euler(pitch,0,0);
            var axes=Vector2.ClampMagnitude(new Vector2(Input.GetAxisRaw("Horizontal"),Input.GetAxisRaw("Vertical"))+touchMove,1);
            vertical=controller.isGrounded?-.7f:vertical-15*dt;
            controller.Move((player.right*axes.x*2.8f+player.forward*axes.y*2.8f+Vector3.up*vertical)*dt);
            if(Mathf.Abs(player.position.x)>28||Mathf.Abs(player.position.z)>28)
            {controller.enabled=false;var p=player.position;player.position=new Vector3(Mathf.Clamp(p.x,-28,28),p.y,Mathf.Clamp(p.z,-28,28));controller.enabled=true;}
            Wild closest=null;float best=0;
            foreach(var w in wildlife)
            {
                if(w.respawn>0||w.startled>0)continue;
                var delta=w.Aim-cameraView.transform.position;float distance=delta.magnitude,dot=Vector3.Dot(cameraView.transform.forward,delta.normalized);
                if(distance<3.2f&&dot>.965f&&dot>best&&!Physics.Linecast(cameraView.transform.position,w.Aim)){closest=w;best=dot;}
            }
            if(target!=closest)focus=0;target=closest;focus=Mathf.Clamp01(focus+(target!=null?.48f:-2)*dt);
        }
        void OnDestroy(){if(netMesh)Destroy(netMesh);}
    }
}
