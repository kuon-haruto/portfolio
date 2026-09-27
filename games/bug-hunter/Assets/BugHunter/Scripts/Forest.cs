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
            public Vector3 home;
            public float timer, respawn;
        }
        public Material material;
        public Species[] species;
        public readonly List<Wild> wildlife = new List<Wild>();
        public Transform player;
        public Camera cameraView;
        CharacterController controller;
        float yaw, pitch = 12, vertical;
        public bool exploring;
        public Vector2 touchMove, touchLook;
        readonly System.Random random = new System.Random(623);
        public float focus;
        public Wild target;
        Transform net;
        float swing;
        float Range(float a,float b) => a+(float)random.NextDouble()*(b-a);
        public void Initialize(Species[] catalog, Material mat)
        {
            species=catalog; material=mat;
            var land=new Geometry();
            land.Stem(new Vector3(0,-.5f,0),new Vector3(0,-.03f,0),42,42,new Color(.33f,.61f,.3f),64);
            land.Stem(new Vector3(11,.0f,8),new Vector3(11,.02f,8),6,6,new Color(.25f,.76f,.88f),32);
            land.Stem(new Vector3(11,-.04f,8),new Vector3(11,-.02f,8),6.6f,6.6f,new Color(.69f,.76f,.49f),32);
            for(int i=0;i<22;i++)
            {
                float z=-14+i*1.4f, x=Mathf.Sin(z*.13f)*3;
                land.Oval(new Vector3(x,-.015f,z),new Vector3(3.2f,.06f,2),new Color(.65f,.73f,.46f),12,4);
            }
            Geometry.Object("Forest floor",land.Mesh("Forest floor"),mat,transform);
            var ground=new GameObject("Ground collider").AddComponent<BoxCollider>();
            ground.transform.SetParent(transform); ground.transform.position=new Vector3(0,-.6f,0);ground.size=new Vector3(84,1.1f,84);
            var trees = new Geometry();
            for(int i=0;i<65;i++)
            {
                float x=Range(-33,33),z=Range(-28,32);
                if(Mathf.Abs(x)<5 || Vector2.Distance(new Vector2(x,z),new Vector2(11,8))<7) continue;
                float h=Range(4,8); var p=new Vector3(x,0,z);
                trees.Stem(p,p+Vector3.up*h,.38f,.18f,new Color(.33f,.25f,.22f));
                trees.Stem(p+Vector3.up*(h*.56f),p+new Vector3(1.3f,h*.85f,.2f),.16f,.05f,new Color(.33f,.25f,.22f));
                for(int j=0;j<3;j++)
                    trees.Oval(p+new Vector3(Range(-1,1),h+j*.5f,Range(-1,1)),new Vector3(4.6f,3.3f,4),new Color(Range(.16f,.3f),Range(.46f,.68f),Range(.21f,.35f)),7,4);
                var col=new GameObject("Tree collider").AddComponent<CapsuleCollider>();col.transform.SetParent(transform);
                col.transform.position=p+Vector3.up*h*.5f;col.height=h;col.radius=.42f;
            }
            Geometry.Object("Canopy",trees.Mesh("Canopy"),mat,transform);
            var flora = new Geometry();
            for(int i=0;i<240;i++)
            {
                var p=new Vector3(Range(-30,30),0,Range(-25,30));
                if(Vector2.Distance(new Vector2(p.x,p.z),new Vector2(11,8))<6.4f)continue;
                if(i%9==0) flora.Oval(p,new Vector3(Range(.6f,1.6f),.7f,1),new Color(.47f,.57f,.56f),7,4);
                else for(int j=0;j<4;j++)flora.Leaf(p,Range(.3f,.8f),.12f,new Color(.17f,.49f,.29f),Quaternion.Euler(-18,j*90+i,0));
                if(i%4==0)
                {
                    flora.Stem(p,p+Vector3.up*.55f,.02f,.01f,new Color(.2f,.47f,.21f),5);
                    flora.Oval(p+Vector3.up*.55f,new Vector3(.22f,.14f,.22f),i%8==0?new Color(1,.64f,.39f):new Color(.88f,.4f,.56f),6,4);
                }
            }
            Geometry.Object("Ferns and flowers",flora.Mesh("Ferns and flowers"),mat,transform);
            var props=new Geometry();
            props.Stem(new Vector3(-3,.35f,-3),new Vector3(-6,.35f,-2.3f),.5f,.5f,new Color(.49f,.34f,.24f),10);
            props.Stem(new Vector3(-2.96f,.35f,-3.01f),new Vector3(-2.94f,.35f,-3.02f),.39f,.39f,new Color(.83f,.7f,.44f),10);
            props.Stem(new Vector3(-1.6f,0,-7),new Vector3(-1.6f,1.3f,-7),.075f,.06f,new Color(.4f,.31f,.23f));
            props.Oval(new Vector3(-1.6f,1.45f,-7),new Vector3(.7f,.48f,.14f),new Color(1,.69f,.3f),6,4);
            Geometry.Object("Trail props",props.Mesh("Trail props"),mat,transform);
            var arena = new Geometry();
            arena.Stem(new Vector3(80,-.5f,0),new Vector3(80,0,0),10,10,new Color(.3f,.57f,.31f),40);
            arena.Stem(new Vector3(80,-.03f,0),new Vector3(80,.05f,0),4.8f,4.8f,new Color(.68f,.48f,.29f),40);
            arena.Stem(new Vector3(80,.05f,0),new Vector3(80,.07f,0),4.5f,4.5f,new Color(.88f,.76f,.48f),40);
            for(int i=0;i<24;i++)
            {
                float a=i*Mathf.PI*2/24;var p=new Vector3(80+Mathf.Cos(a)*7,0,Mathf.Sin(a)*7);
                arena.Stem(p,p+Vector3.up*2.4f,.09f,.04f,new Color(.31f,.38f,.31f));
                arena.Leaf(p+Vector3.up*2.3f,1.4f,.5f,i%2==0?new Color(.27f,.7f,.85f):new Color(.98f,.49f,.38f),Quaternion.Euler(10,-a*Mathf.Rad2Deg,70));
            }
            Geometry.Object("Tournament ring",arena.Mesh("Tournament ring"),mat,transform);
            var podium=new Geometry();podium.Stem(new Vector3(60,-.3f,0),new Vector3(60,0,0),3.4f,3.4f,new Color(.33f,.53f,.4f),32);
            Geometry.Object("Research podium",podium.Mesh("Research podium"),mat,transform);
            for(int i=0;i<18;i++)
            {
                int s=i%catalog.Length;
                Vector3 p=i==0?new Vector3(0,0,-4.3f):s==4?new Vector3(Range(7,15),0,Range(4,11)):new Vector3(Range(-13,13),0,Range(-5,22));
                var w=new Wild { bug=Individual.Create(catalog[s],random.Next()),home=p,timer=Range(0,10)};
                w.view=Instantiate(catalog[s].model,transform).GetComponent<BugView>();w.view.phase=i;
                w.view.transform.position=p;w.view.transform.localScale=Vector3.one*(s==4?.8f:.74f)*w.bug.size;
                wildlife.Add(w);
            }
            player=new GameObject("Explorer",typeof(CharacterController)).transform;
            controller=player.GetComponent<CharacterController>();controller.height=1.7f;controller.radius=.28f;controller.center=new Vector3(0,.85f,0);controller.stepOffset=.25f;
            player.position=new Vector3(0,.15f,-10);
            cameraView=new GameObject("Main Camera",typeof(Camera),typeof(AudioListener)).GetComponent<Camera>();cameraView.tag="MainCamera";
            cameraView.clearFlags=CameraClearFlags.SolidColor;cameraView.backgroundColor=new Color(.64f,.87f,.94f);
            cameraView.farClipPlane=85;cameraView.nearClipPlane=.05f;cameraView.fieldOfView=58;
            var netMesh=new Geometry();
            netMesh.Stem(new Vector3(.57f,-.92f,.8f),new Vector3(.62f,-.26f,1.4f),.025f,.025f,new Color(.77f,.52f,.24f));
            var center=new Vector3(.62f,.04f,1.44f);
            for(int k=0;k<20;k++)
            {
                float a=k*Mathf.PI*2/20,b=(k+1)*Mathf.PI*2/20;
                netMesh.Stem(center+new Vector3(Mathf.Cos(a)*.3f,Mathf.Sin(a)*.3f,0),center+new Vector3(Mathf.Cos(b)*.3f,Mathf.Sin(b)*.3f,0),.012f,.012f,new Color(.9f,.93f,.88f),5);
                if(k%2==0)netMesh.Stem(center+new Vector3(Mathf.Cos(a)*.3f,Mathf.Sin(a)*.3f,0),center+new Vector3(0,0,.23f),.003f,.003f,new Color(.7f,.87f,.88f),4);
            }
            net=Geometry.Object("Catching net",netMesh.Mesh("Net"),mat,cameraView.transform).transform;
            Explore();
        }
        public void Explore()
        {
            exploring=true;if(net)net.gameObject.SetActive(true); cameraView.transform.SetParent(player,false);cameraView.transform.localPosition=new Vector3(0,1.6f,0);
            cameraView.transform.localRotation=Quaternion.Euler(pitch,0,0);target=null;focus=0;
        }
        public void View(Vector3 position, Vector3 lookAt)
        {
            exploring=false;if(net)net.gameObject.SetActive(false);cameraView.transform.SetParent(null);cameraView.transform.position=position;cameraView.transform.LookAt(lookAt);
            touchMove=Vector2.zero;touchLook=Vector2.zero;
        }
        public void Catch(Wild wild)
        {
            wild.respawn=14;wild.view.gameObject.SetActive(false);target=null;focus=0;
        }
        public void Swing(){swing=1;}
        void Update()
        {
            float dt=Time.deltaTime;
            foreach(var w in wildlife)
            {
                if(w.respawn>0)
                {
                    w.respawn-=dt;
                    if(w.respawn<=0) { w.bug=Individual.Create(species[w.bug.species],random.Next());w.view.gameObject.SetActive(true); }
                    continue;
                }
                w.timer+=dt;
                var p=w.home+new Vector3(Mathf.Sin(w.timer*.45f)*.55f,w.bug.species==4?1.05f:0,Mathf.Cos(w.timer*.45f)*.35f);
                w.view.transform.position=p;w.view.transform.rotation=Quaternion.Euler(0,w.timer*18,0);
            }
            if(!exploring) return;
            swing=Mathf.Max(0,swing-dt*2.2f);float sw=Mathf.Sin(swing*Mathf.PI);
            if(net){net.localPosition=new Vector3(-sw*.4f,-.42f+sw*.1f,sw*.25f);net.localRotation=Quaternion.Euler(sw*26,sw*-18,sw*12);}
            bool rotate=Input.GetMouseButton(1);
            yaw+=(rotate?Input.GetAxisRaw("Mouse X")*2.2f:0)+touchLook.x*75*dt;
            pitch=Mathf.Clamp(pitch-(rotate?Input.GetAxisRaw("Mouse Y")*2.2f:0)-touchLook.y*55*dt,-55,55);
            player.rotation=Quaternion.Euler(0,yaw,0);cameraView.transform.localRotation=Quaternion.Euler(pitch,0,0);
            Vector2 axes=new Vector2(Input.GetAxisRaw("Horizontal"),Input.GetAxisRaw("Vertical"))+touchMove;
            axes=Vector2.ClampMagnitude(axes,1);vertical=controller.isGrounded?-.5f:vertical-15*dt;
            controller.Move((player.right*axes.x*3.5f+player.forward*axes.y*3.5f+Vector3.up*vertical)*dt);
            if(Mathf.Abs(player.position.x)>28||Mathf.Abs(player.position.z)>28)
            { controller.enabled=false;var p=player.position;player.position=new Vector3(Mathf.Clamp(p.x,-28,28),p.y,Mathf.Clamp(p.z,-28,28));controller.enabled=true; }
            Wild closest=null;float best=0;
            foreach(var w in wildlife)
            {
                if(w.respawn>0) continue;
                var delta=w.view.transform.position+Vector3.up*.42f-cameraView.transform.position;
                float distance=delta.magnitude, dot=Vector3.Dot(cameraView.transform.forward,delta.normalized);
                if(distance<5.7f && dot>.81f && dot>best && !Physics.Linecast(cameraView.transform.position,w.view.transform.position+Vector3.up*.42f))
                { closest=w;best=dot; }
            }
            if(target!=closest)focus=0;
            target=closest;focus=Mathf.Clamp01(focus+(target!=null?.42f:-2)*dt);
        }
    }
}
