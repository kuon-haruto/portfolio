using UnityEngine;
using UnityEngine.Rendering;
using System.Collections.Generic;

namespace BugHunter
{
    public sealed class Landscape : MonoBehaviour
    {
        public Material soil,bark,foliage;
        readonly System.Random random=new System.Random(4091);
        readonly List<Mesh> meshes=new List<Mesh>();
        public int treeCount,rockCount,triangles;
        float Range(float a,float b)=>a+(float)random.NextDouble()*(b-a);
        public static float StreamX(float z)=>8+Mathf.Sin(z*.14f)*3;
        public static float StreamWidth(float z)=>1.65f+Mathf.Sin(z*.11f)*.3f;
        public static float WaterHeight(float z)=>.10f+z*.008f;
        public static float Height(float x,float z)
        {
            float hills=.38f+Mathf.PerlinNoise((x+90)*.065f,(z+71)*.065f)*1.3f;
            hills+=Mathf.PerlinNoise(x*.24f+54,z*.24f+92)*.16f;
            hills+=Mathf.SmoothStep(0,1,Mathf.InverseLerp(29,64,Mathf.Max(Mathf.Abs(x),Mathf.Abs(z))))*5;
            float distance=Mathf.Abs(x-StreamX(z));
            float bank=1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(StreamWidth(z)-.3f,StreamWidth(z)+1.6f,distance));
            return Mathf.Lerp(hills,WaterHeight(z)-.46f,bank);
        }
        public static Vector3 Ground(float x,float z)=>new Vector3(x,Height(x,z),z);
        static bool Clearing(float x,float z)=>Vector2.Distance(new Vector2(x,z),new Vector2(-2,13))<8;
        GameObject Place(string name,Geometry g,Material mat,bool shadow=true)
        {
            triangles+=g.TriangleCount;var mesh=g.Mesh(name);meshes.Add(mesh);
            var obj=Geometry.Object(name,mesh,mat,transform);var renderer=obj.GetComponent<MeshRenderer>();renderer.receiveShadows=true;
            renderer.shadowCastingMode=shadow?ShadowCastingMode.On:ShadowCastingMode.Off;mesh.UploadMeshData(true);return obj;
        }
        public void Initialize()
        {
            soil=Resources.Load<Material>("Environment/Soil");bark=Resources.Load<Material>("Environment/Trunk");foliage=Resources.Load<Material>("Environment/Foliage");
            TerrainPatch(Vector3.zero,68,true);TerrainPatch(new Vector3(260,-.12f,0),48,false);TerrainPatch(new Vector3(160,-.25f,0),44,false);
            var trunks=new Geometry();var leaves=new Geometry();var plants=new Geometry();var ferns=new Geometry();var stones=new Geometry();
            Tree(trunks,leaves,Ground(1.8f,-7),8.1f,.48f,true);
            Tree(trunks,leaves,Ground(-8,2),9,.52f,true);Tree(trunks,leaves,Ground(18,19),9,.46f,true);
            FlushTrees(ref trunks,ref leaves);
            // A closed western grove, a sunny meadow, and an open stream corridor.
            for(float z=-33;z<=34;z+=5.3f)
            {
              for(float x=-33;x<=34;x+=5.3f)
              {
                float px=x+Range(-1.8f,1.8f),pz=z+Range(-1.8f,1.8f);
                if(Mathf.Abs(px-StreamX(pz))<StreamWidth(pz)+2.6f||Clearing(px,pz))continue;
                if(Vector2.Distance(new Vector2(px,pz),new Vector2(0,-12))<2.8f)continue;
                if(Mathf.Abs(px-Mathf.Sin(pz*.16f)*2.8f)<1.6f||Vector2.Distance(new Vector2(px,pz),new Vector2(1.8f,-7))<3.4f)continue;
                Tree(trunks,leaves,Ground(px,pz),Range(7.5f,12.5f),Range(.3f,.72f),true);
              }
              FlushTrees(ref trunks,ref leaves);
            }
            // Lower overlapping crowns close the sky above the starting woodland path.
            foreach(var p in new[]{new Vector2(-3,-12),new Vector2(-5,-5),new Vector2(-4,-20),new Vector2(2,-18)})
                Tree(trunks,leaves,Ground(p.x,p.y),Range(7,8.2f),.36f,true);
            FlushTrees(ref trunks,ref leaves);
            for(int i=0;i<88;i++)
            {
                float a=i*2.399f,r=Range(40,58),x=Mathf.Cos(a)*r,z=Mathf.Sin(a)*r;
                Tree(trunks,leaves,Ground(x,z),Range(9,15),Range(.35f,.8f),false,true);
                if(i%16==15)FlushTrees(ref trunks,ref leaves);
            }
            FlushTrees(ref trunks,ref leaves);
            for(int i=0;i<38;i++)
            {
                float a=i*2.399f,r=Range(11,20);if(Mathf.Sin(a)*r>1)continue;
                Tree(trunks,leaves,new Vector3(260+Mathf.Cos(a)*r,-.12f,Mathf.Sin(a)*r),Range(8,12),Range(.32f,.65f),false);
            }
            FlushTrees(ref trunks,ref leaves);
            for(int i=0;i<32;i++)
            {
                float a=i*2.399f,r=Range(8,23);if(Mathf.Sin(a)>.05f)continue;
                Tree(trunks,leaves,new Vector3(160+Mathf.Cos(a)*r,-.25f,Mathf.Sin(a)*r),Range(7,12),Range(.3f,.7f),false);
            }
            FlushTrees(ref trunks,ref leaves);
            for(int i=0;i<1900;i++)
            {
                float x=Range(-34,34),z=Range(-33,34),distance=Mathf.Abs(x-StreamX(z));
                if(distance<StreamWidth(z)+.9f||Mathf.Abs(x-Mathf.Sin(z*.16f)*2.8f)<1.15f)continue;
                var p=Ground(x,z);
                if(i%41==0&&Vector2.Distance(new Vector2(x,z),new Vector2(0,-12))>4)
                    Rock(stones,p,new Vector3(Range(.6f,1.8f),Range(.4f,1.3f),Range(.6f,1.6f)),true);
                else if(i%4==0)Grass(plants,p,Range(.25f,.65f),i);
                else Fern(ferns,p,Range(.4f,1.1f)*(Clearing(x,z)?.55f:1));
                if(i%37==0)for(int j=0;j<4;j++)leaves.FoliageCard(p+new Vector3(0,.6f,0),1.3f,Quaternion.Euler(-25,j*73,0),new Color(.72f,.85f,.62f));
            }
            for(int i=0;i<105;i++)
            {
                float z=Range(-33,33),s=i%2==0?-1:1;
                float x=StreamX(z)+s*(StreamWidth(z)+Range(.15f,1.2f));var p=Ground(x,z);
                if(i%3==0)Rock(stones,p,new Vector3(Range(.5f,1.7f),Range(.35f,1.1f),Range(.6f,1.7f)),true);
                else Grass(plants,p,Range(.7f,1.5f),i);
            }
            foreach(var p in new[]{new Vector2(-5,-10),new Vector2(5,3),new Vector2(15,-9),new Vector2(-9,15),new Vector2(18,5)})
            {
                Rock(stones,Ground(p.x,p.y),new Vector3(3.6f,2.4f,3),true);
                Rock(stones,Ground(p.x+1.6f,p.y+1),new Vector3(2,1.1f,1.8f),true);
            }
            // Stable stepping stones keep both riverbanks reachable without swimming.
            foreach(float z in new[]{-4f,14f})for(int i=-2;i<=2;i++)
            {
                float x=StreamX(z)+i*.82f;var p=Ground(x,z);p.y=WaterHeight(z)-.14f;
                Rock(stones,p,new Vector3(.93f,.56f,.86f),true);
            }
            for(int i=0;i<150;i++)
            {
                float a=i*2.399f,r=Range(7.5f,12);var p=new Vector3(260+Mathf.Cos(a)*r,-.12f,Mathf.Sin(a)*r);
                if(i%9==0)Rock(stones,p,new Vector3(1,.6f,.8f),false);else Fern(ferns,p,Range(.4f,.9f));
            }
            var log=Ground(-6,8)+Vector3.up*.42f;trunks.Stem(log,log+new Vector3(3,.05f,.7f),.46f,.39f,Color.white,24);
            var stump=new Geometry();stump.Stem(new Vector3(160,-.2f,0),new Vector3(160,.02f,0),2.1f,2,new Color(.7f,.72f,.57f),64);
            Place("Camp specimen table",stump,bark);
            var ring=new Geometry();
            for(int i=0;i<42;i++){float a=i*Mathf.PI*2/42;ring.SmoothOval(new Vector3(260+Mathf.Cos(a)*6.6f,.01f,Mathf.Sin(a)*6.6f),new Vector3(.32f,.14f,.25f),Color.white,16,10,null,.35f);}
            Place("Arena boundary stones",ring,Resources.Load<Material>("Environment/Rock"));
            Place("Rooted trunks and fallen timber",trunks,bark);Place("Overlapping woodland canopy",leaves,Resources.Load<Material>("Environment/Leaves"));
            Place("Grasses and river reeds",plants,foliage);Place("Fern understory",ferns,Resources.Load<Material>("Environment/Ferns"));
            Place("Mossy boulders and river stones",stones,Resources.Load<Material>("Environment/Rock"));Stream();
        }
        void FlushTrees(ref Geometry trunks,ref Geometry leaves)
        {
            if(trunks.TriangleCount==0)return;
            Place("Woodland trunks "+treeCount,trunks,bark);Place("Woodland crown "+treeCount,leaves,Resources.Load<Material>("Environment/Leaves"));
            trunks=new Geometry();leaves=new Geometry();
            // Release temporary construction buffers before growing the next sector.
            System.GC.Collect();
        }
        void Stream()
        {
            var water=new Geometry();const int count=161;var left=new Vector3[count];var right=new Vector3[count];
            for(int i=0;i<count;i++)
            {
                float z=-40+i*.5f,x=StreamX(z),w=StreamWidth(z);
                left[i]=new Vector3(x-w,WaterHeight(z),z);right[i]=new Vector3(x+w,WaterHeight(z),z);
            }
            water.Ribbon(left,right,Color.white);Place("Flowing woodland stream",water,Resources.Load<Material>("Environment/Water"),false);
        }
        void Rock(Geometry geometry,Vector3 p,Vector3 size,bool solid)
        {
            rockCount++;var center=p+Vector3.up*size.y*.27f;
            geometry.SmoothOval(center,size,new Color(.86f,.9f,.81f),24,16,Quaternion.Euler(Range(-15,15),Range(0,360),Range(-12,12)),.65f);
            if(!solid)return;
            var c=new GameObject("Boulder collider").AddComponent<SphereCollider>();c.transform.SetParent(transform);c.transform.position=center;c.transform.localScale=size*.91f;c.radius=.5f;
        }
        void TerrainPatch(Vector3 center,int half,bool uneven)
        {
            float step=uneven?.5f:1;int width=Mathf.RoundToInt(half*2/step)+1;
            var points=new Vector3[width*width];var colors=new Color[points.Length];var indices=new int[(width-1)*(width-1)*6];int t=0;
            for(int z=0;z<width;z++)for(int x=0;x<width;x++)
            {
                float px=center.x+x*step-half,pz=center.z+z*step-half;int i=z*width+x;points[i]=new Vector3(px,uneven?Height(px,pz):center.y,pz);
                float trail=uneven?Mathf.Abs(px-Mathf.Sin(pz*.16f)*2.8f):Vector2.Distance(new Vector2(px,pz),new Vector2(center.x,center.z));
                float moss=uneven?Mathf.SmoothStep(0,1,Mathf.Clamp01((trail-1.1f)/2)):Mathf.Clamp01((trail-6)/2);
                colors[i]=Color.Lerp(new Color(.87f,.91f,.83f),new Color(.65f,.77f,.52f),moss*.5f);
                if(uneven)colors[i]*=Color.Lerp(Color.white,new Color(.65f,.79f,.57f),Mathf.SmoothStep(0,1,Mathf.InverseLerp(29,56,Mathf.Max(Mathf.Abs(px),Mathf.Abs(pz)))));
                colors[i].a=moss;
                if(x==width-1||z==width-1)continue;
                indices[t++]=i;indices[t++]=i+width;indices[t++]=i+1;indices[t++]=i+1;indices[t++]=i+width;indices[t++]=i+width+1;
            }
            var mesh=new Mesh {name="Forest banks and sloping terrain",indexFormat=points.Length>65535?IndexFormat.UInt32:IndexFormat.UInt16,vertices=points,triangles=indices,colors=colors};mesh.RecalculateNormals();mesh.RecalculateBounds();meshes.Add(mesh);triangles+=indices.Length/3;
            var obj=Geometry.Object(mesh.name,mesh,soil,transform);obj.GetComponent<Renderer>().receiveShadows=true;obj.AddComponent<MeshCollider>().sharedMesh=mesh;
        }
        void Tree(Geometry trunk,Geometry leaves,Vector3 p,float h,float radius,bool collider,bool distant=false)
        {
            treeCount++;var bend=new Vector3(Range(-.7f,.7f),0,Range(-.7f,.7f));
            var low=p+Vector3.up*2.1f;trunk.Stem(p,low,radius,radius*.96f,Color.white,24,false);var previous=low;
            for(int n=1;n<=5;n++)
            {
                float t=n/5f;var next=p+Vector3.up*Mathf.Lerp(2.1f,h,t)+bend*t*t;
                trunk.Stem(previous,next,Mathf.Lerp(radius*.96f,radius*.1f,(n-1)/5f),Mathf.Lerp(radius*.96f,radius*.1f,t),Color.white,20,false);previous=next;
            }
            for(int n=0;n<7;n++)
            {
                float a=n*.898f;var d=new Vector3(Mathf.Cos(a),0,Mathf.Sin(a));var mid=p+d*radius*1.4f+Vector3.up*.18f;
                trunk.Stem(p+Vector3.up*.7f,mid,radius*.42f,radius*.22f,new Color(.75f,.84f,.69f),12);
                trunk.Stem(mid,p+d*radius*3.8f-Vector3.up*.1f,radius*.22f,.014f,Color.white,10);
            }
            for(int n=0;n<(distant?7:13);n++)
            {
                float a=n*2.399f;var d=new Vector3(Mathf.Cos(a),0,Mathf.Sin(a));float tier=h*.54f+(n%4)*h*.075f,reach=Range(3.2f,5.2f)*(1-(n%4)*.09f);
                var start=p+Vector3.up*tier;var mid=start+d*reach*.48f+Vector3.up*.3f+bend*.4f;var end=start+d*reach+Vector3.up*Range(.8f,1.8f)+bend;
                trunk.Stem(start,mid,radius*.43f,radius*.18f,Color.white,12);trunk.Stem(mid,end,radius*.18f,.025f,Color.white,10);
                for(int j=0;j<(distant?6:9);j++)
                {
                    var at=Vector3.Lerp(mid,end,.25f+(j%3)*.35f)+new Vector3(Range(-1.3f,1.3f),Range(-.25f,.75f),Range(-1.3f,1.3f));
                    leaves.FoliageCard(at,Range(2.6f,4),Quaternion.Euler(j%3==0?Range(-15,15):Range(55,115),Range(0,360),Range(-22,22)),new Color(Range(.7f,.94f),Range(.83f,1),Range(.65f,.84f)));
                    if(j%3==0)trunk.Stem(end,at,.025f,.006f,Color.white,6);
                }
            }
            if(collider)
            {
                var c=new GameObject("Trunk collider").AddComponent<CapsuleCollider>();c.transform.SetParent(transform);c.transform.position=p+Vector3.up*h*.5f;c.radius=radius;c.height=h;
            }
        }
        static void Grass(Geometry g,Vector3 p,float height,int seed)
        {for(int j=0;j<9;j++)g.Leaf(p,height*(.6f+(j%3)*.2f),.018f,new Color(.23f,.38f,.1f),Quaternion.Euler(-68+j*4,seed*37+j*51,0));}
        public static void Fern(Geometry g,Vector3 p,float scale)
        {for(int j=0;j<3;j++)g.FoliageCard(p+Vector3.up*scale*.41f,scale,Quaternion.Euler(0,j*60+p.x*21,0),new Color(.69f,.83f,.62f));}
        void OnDestroy(){foreach(var mesh in meshes)if(mesh)Destroy(mesh);}
    }
}
