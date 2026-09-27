using UnityEngine;
using UnityEngine.Rendering;
using System.Collections.Generic;

namespace BugHunter
{
    public sealed class Landscape : MonoBehaviour
    {
        public Material soil, bark, foliage;
        readonly System.Random random = new System.Random(4091);
        readonly List<Mesh> meshes = new List<Mesh>();
        float Range(float a,float b) => a+(float)random.NextDouble()*(b-a);
        public static float Height(float x,float z)
        {
            float hills=(Mathf.PerlinNoise((x+90)*.068f,(z+71)*.068f)-.5f)*2.3f;
            float pond=Vector2.Distance(new Vector2(x,z),new Vector2(12,9));
            return hills-Mathf.Clamp01((6-pond)/2)*1.3f;
        }
        public static Vector3 Ground(float x,float z) => new Vector3(x,Height(x,z),z);
        GameObject Place(string name,Geometry g,Material mat,bool shadow=true)
        {
            var mesh=g.Mesh(name);meshes.Add(mesh);
            var obj=Geometry.Object(name,mesh,mat,transform);
            var renderer=obj.GetComponent<MeshRenderer>();renderer.receiveShadows=true;
            renderer.shadowCastingMode=shadow?ShadowCastingMode.On:ShadowCastingMode.Off;
            mesh.UploadMeshData(true);
            return obj;
        }
        public void Initialize()
        {
            soil=Resources.Load<Material>("Environment/Soil");
            bark=Resources.Load<Material>("Environment/Trunk");
            foliage=Resources.Load<Material>("Environment/Foliage");
            TerrainPatch(Vector3.zero,38,true);
            TerrainPatch(new Vector3(260,-.12f,0),36,false);
            TerrainPatch(new Vector3(160,-.25f,0),32,false);
            var trunks=new Geometry();var leaves=new Geometry();var plants=new Geometry();var ferns=new Geometry();var stones=new Geometry();
            // Keep the first tree beside the trail so its habitat is easy to discover.
            Tree(trunks,leaves,Ground(1.8f,-7),7.6f,.48f,true);
            Tree(trunks,leaves,Ground(-8,2),9,.52f,true);
            Tree(trunks,leaves,Ground(18,19),8,.46f,true);
            for(int i=0;i<105;i++)
            {
                float x=Range(-35,35),z=Range(-32,35);
                float trail=Mathf.Sin(z*.16f)*2.8f;
                if(Mathf.Abs(x-trail)<3.8f || Vector2.Distance(new Vector2(x,z),new Vector2(12,9))<6.7f || Vector2.Distance(new Vector2(x,z),new Vector2(1.8f,-7))<3)continue;
                Tree(trunks,leaves,Ground(x,z),Range(6.8f,11),Range(.26f,.6f),true);
            }
            for(int i=0;i<42;i++)
            {
                float a=i*2.399f,r=Range(10,17);
                if(Mathf.Sin(a)*r>2)continue;
                Tree(trunks,leaves,new Vector3(260+Mathf.Cos(a)*r,-.12f,Mathf.Sin(a)*r),Range(7,11),Range(.32f,.65f),false);
            }
            for(int i=0;i<12;i++)
            {
                float a=i*2.399f;
                if(Mathf.Sin(a)>0)continue;
                Tree(trunks,leaves,new Vector3(160+Mathf.Cos(a)*6,-.25f,Mathf.Sin(a)*6),Range(6,9),.35f,false);
            }
            for(int i=0;i<30;i++)
            {
                float a=i*2.399f,r=Range(12,25);if(Mathf.Sin(a)>.3f)continue;
                Tree(trunks,leaves,new Vector3(160+Mathf.Cos(a)*r,-.25f,Mathf.Sin(a)*r),Range(6,12),Range(.3f,.7f),false);
            }
            for(int i=0;i<1050;i++)
            {
                float x=Range(-32,32),z=Range(-30,33);
                float pond=Vector2.Distance(new Vector2(x,z),new Vector2(12,9));
                if(pond<5.6f || Mathf.Abs(x-Mathf.Sin(z*.16f)*2.8f)<1.1f)continue;
                var p=Ground(x,z);
                if(i%19==0)for(int s=0;s<3;s++)leaves.FoliageCard(p+Vector3.up*.45f,1.1f,Quaternion.Euler(-18,s*60+i*23,0),new Color(.83f,.95f,.8f));
                if(i%13==0)stones.Oval(p,new Vector3(Range(.3f,1),Range(.18f,.65f),Range(.3f,1)),new Color(.63f,.69f,.61f),9,5);
                else if(i%3!=0)Fern(ferns,p,Range(.4f,.8f));
                else Grass(plants,p,Range(.25f,.7f),i);
            }
            for(int i=0;i<50;i++)
            {
                float a=i*.59f,r=Range(5.2f,6.1f);var p=Ground(12+Mathf.Cos(a)*r,9+Mathf.Sin(a)*r);
                Grass(plants,p,Range(.9f,1.6f),i);
            }
            for(int i=0;i<120;i++)
            {
                float a=i*2.399f,r=Range(7.3f,12);
                var p=new Vector3(260+Mathf.Cos(a)*r,0,Mathf.Sin(a)*r);
                if(i%6==0)stones.Oval(p,new Vector3(1,.5f,.8f),new Color(.65f,.7f,.6f),9,5);else Fern(ferns,p,Range(.4f,.8f));
            }
            var log=Ground(-6,8)+Vector3.up*.42f;
            trunks.Stem(log,log+new Vector3(3,.05f,.7f),.46f,.39f,Color.white,16);
            var stump=new Geometry();
            stump.Stem(new Vector3(160,-.2f,0),new Vector3(160,.02f,0),2.1f,2,new Color(.84f,.75f,.61f),32);
            Place("Camp specimen table",stump,bark);
            var ring=new Geometry();
            for(int i=0;i<42;i++)
            {
                float a=i*Mathf.PI*2/42;
                ring.Oval(new Vector3(260+Mathf.Cos(a)*6.6f,.01f,Mathf.Sin(a)*6.6f),new Vector3(.32f,.14f,.25f),new Color(.79f,.8f,.7f),8,4);
            }
            Place("Arena boundary stones",ring,Resources.Load<Material>("Environment/Rock"));
            Place("Rooted trunks and fallen timber",trunks,bark);
            Place("Branch foliage",leaves,Resources.Load<Material>("Environment/Leaves"));
            Place("Ferns grasses and reeds",plants,foliage);
            Place("Fern understory",ferns,Resources.Load<Material>("Environment/Ferns"));
            Place("Weathered stones",stones,Resources.Load<Material>("Environment/Rock"));
            var water=new Geometry();float waterY=Height(12,9)+.7f;
            water.Stem(new Vector3(12,waterY-.03f,9),new Vector3(12,waterY,9),4.8f,4.8f,new Color(.4f,.63f,.61f),64);
            Place("Forest pond",water,Resources.Load<Material>("Environment/Water"),false);
        }
        void TerrainPatch(Vector3 center,int half,bool uneven)
        {
            int width=half*2+1;var points=new Vector3[width*width];var colors=new Color[points.Length];
            var indices=new int[(width-1)*(width-1)*6];int t=0;
            for(int z=0;z<width;z++)for(int x=0;x<width;x++)
            {
                float px=center.x+x-half,pz=center.z+z-half;
                int i=z*width+x;points[i]=new Vector3(px,uneven?Height(px,pz):center.y,pz);
                float trail=uneven?Mathf.Abs(px-Mathf.Sin(pz*.16f)*2.8f):Vector2.Distance(new Vector2(px,pz),new Vector2(center.x,center.z));
                float moss=uneven?Mathf.SmoothStep(0,1,Mathf.Clamp01((trail-1.5f)/2)):Mathf.Clamp01((trail-6)/2);
                colors[i]=Color.Lerp(new Color(1,.97f,.9f),new Color(.75f,.85f,.62f),moss*.35f);colors[i].a=moss;
                if(x==width-1||z==width-1)continue;
                indices[t++]=i;indices[t++]=i+width;indices[t++]=i+1;
                indices[t++]=i+1;indices[t++]=i+width;indices[t++]=i+width+1;
            }
            var mesh=new Mesh {name="Undulating forest terrain",vertices=points,triangles=indices,colors=colors};mesh.RecalculateNormals();mesh.RecalculateBounds();meshes.Add(mesh);
            var obj=Geometry.Object(mesh.name,mesh,soil,transform);obj.GetComponent<Renderer>().receiveShadows=true;
            obj.AddComponent<MeshCollider>().sharedMesh=mesh;
        }
        void Tree(Geometry trunk,Geometry leaves,Vector3 p,float h,float radius,bool collider)
        {
            var bend=new Vector3(Range(-.5f,.5f),0,Range(-.5f,.5f));
            // The lower trunk stays vertical so surface anchors match its bark.
            var baseTop=p+Vector3.up*2.1f;
            trunk.Stem(p,baseTop,radius,radius*.96f,Color.white,14,false);
            trunk.Stem(baseTop,p+Vector3.up*h+bend,radius*.96f,radius*.28f,Color.white,14,false);
            for(int n=0;n<5;n++)
            {
                float a=n*1.257f;var d=new Vector3(Mathf.Cos(a),0,Mathf.Sin(a));
                trunk.Stem(p+Vector3.up*.45f,p+d*radius*2.8f-Vector3.up*.04f,radius*.3f,.025f,new Color(.82f,.91f,.79f),7);
            }
            for(int n=0;n<9;n++)
            {
                float a=n*2.399f;var d=new Vector3(Mathf.Cos(a),0,Mathf.Sin(a));
                var start=p+Vector3.up*(h*.52f+n*.12f);
                var end=p+Vector3.up*(h*.7f+n*.16f)+d*Range(1.7f,3.2f)+bend;
                trunk.Stem(start,end,radius*.35f,.035f,Color.white,7);
                for(int j=0;j<5;j++)
                {
                    var at=end+new Vector3(Range(-1.2f,1.2f),Range(-.25f,.55f),Range(-1.2f,1.2f));
                    leaves.FoliageCard(at,Range(2,3.5f),Quaternion.Euler(Range(-85,85),Range(0,360),Range(-30,30)),new Color(Range(.8f,1.05f),Range(.88f,1.07f),Range(.75f,.95f)));
                }
            }
            if(collider)
            {
                var c=new GameObject("Trunk collider").AddComponent<CapsuleCollider>();c.transform.SetParent(transform);c.transform.position=p+Vector3.up*h*.5f;c.radius=radius;c.height=h;
            }
        }
        static void Grass(Geometry g,Vector3 p,float height,int seed)
        {
            for(int j=0;j<7;j++)g.Leaf(p,height*(.6f+(j%3)*.2f),.022f,new Color(.28f,.43f,.13f),Quaternion.Euler(-68+j*4,seed*37+j*51,0));
        }
        public static void Fern(Geometry g,Vector3 p,float scale)
        {
            for(int j=0;j<3;j++)g.FoliageCard(p+Vector3.up*scale*.41f,scale,Quaternion.Euler(0,j*60+p.x*21,0),new Color(.82f,.96f,.75f));
        }
        void OnDestroy(){foreach(var mesh in meshes)if(mesh)Destroy(mesh);}
    }
}
