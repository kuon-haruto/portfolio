using System.Collections.Generic;
using UnityEngine;

namespace BugHunter
{
    // Colored low-poly geometry is baked into shared meshes by the editor builder.
    public sealed class Geometry
    {
        readonly List<Vector3> vertices = new List<Vector3>();
        readonly List<int> indices = new List<int>();
        readonly List<Color> colors = new List<Color>();
        readonly List<Vector2> uvs = new List<Vector2>();
        void Face(Vector3 a, Vector3 b, Vector3 c, Color color)
        {
            int i = vertices.Count; vertices.Add(a); vertices.Add(b); vertices.Add(c);
            colors.Add(color); colors.Add(color); colors.Add(color);
            uvs.Add(Vector2.zero);uvs.Add(Vector2.zero);uvs.Add(Vector2.zero);
            indices.Add(i); indices.Add(i + 1); indices.Add(i + 2);
        }
        public void FoliageCard(Vector3 center,float size,Quaternion rotation,Color color)
        {
            int i=vertices.Count;
            foreach(var p in new[]{new Vector3(-.5f,-.5f,0),new Vector3(.5f,-.5f,0),new Vector3(.5f,.5f,0),new Vector3(-.5f,.5f,0)})
            {vertices.Add(center+rotation*p*size);colors.Add(color);}
            uvs.Add(new Vector2(0,0));uvs.Add(new Vector2(1,0));uvs.Add(new Vector2(1,1));uvs.Add(new Vector2(0,1));
            indices.Add(i);indices.Add(i+1);indices.Add(i+2);indices.Add(i);indices.Add(i+2);indices.Add(i+3);
        }
        public void Oval(Vector3 position, Vector3 size, Color color, int sides = 10, int rows = 6, Quaternion? rotation = null)
        {
            Quaternion rot = rotation ?? Quaternion.identity;
            Vector3 Point(int x, int y)
            {
                float a = x * Mathf.PI * 2 / sides, b = y * Mathf.PI / rows;
                return position + rot * Vector3.Scale(new Vector3(Mathf.Sin(b) * Mathf.Cos(a), Mathf.Cos(b), Mathf.Sin(b) * Mathf.Sin(a)), size * .5f);
            }
            for (int y = 0; y < rows; y++) for (int x = 0; x < sides; x++)
            { Face(Point(x,y), Point(x+1,y), Point(x+1,y+1), color); Face(Point(x,y), Point(x+1,y+1), Point(x,y+1), color); }
        }
        public void Stem(Vector3 a, Vector3 b, float radiusA, float radiusB, Color color, int sides = 7,bool caps=true)
        {
            Quaternion r = Quaternion.FromToRotation(Vector3.up, (b - a).normalized);
            Vector3 Ring(Vector3 p, float radius, int k) => p + r * new Vector3(Mathf.Cos(k * 2 * Mathf.PI / sides) * radius, 0, Mathf.Sin(k * 2 * Mathf.PI / sides) * radius);
            int start=vertices.Count;
            for (int i = 0; i < sides; i++)
            {
                vertices.Add(Ring(a,radiusA,i));vertices.Add(Ring(b,radiusB,i));
                colors.Add(color);colors.Add(color);uvs.Add(new Vector2(i/(float)sides,0));uvs.Add(new Vector2(i/(float)sides,1));
            }
            int bottom=vertices.Count;vertices.Add(a);vertices.Add(b);colors.Add(color);colors.Add(color);uvs.Add(Vector2.zero);uvs.Add(Vector2.one);
            for(int i=0;i<sides;i++)
            {
                int p=start+i*2,q=start+((i+1)%sides)*2,s=p+1,t=q+1;
                indices.Add(p);indices.Add(s);indices.Add(t);indices.Add(p);indices.Add(t);indices.Add(q);
                if(caps){indices.Add(bottom);indices.Add(p);indices.Add(q);indices.Add(bottom+1);indices.Add(t);indices.Add(s);}
            }
        }
        public void Leaf(Vector3 p, float length, float width, Color color, Quaternion rotation)
        {
            var a = p; var b = p + rotation * new Vector3(-width, .08f, length * .45f);
            var c = p + rotation * new Vector3(0, .2f, length); var d = p + rotation * new Vector3(width, .08f, length * .45f);
            var e = p + rotation * new Vector3(0, .18f, length * .45f);
            int start=vertices.Count;
            vertices.Add(a);vertices.Add(b);vertices.Add(c);vertices.Add(d);vertices.Add(e);
            colors.Add(color);colors.Add(color);colors.Add(color);colors.Add(color*.9f);colors.Add(color);
            uvs.Add(new Vector2(.5f,0));uvs.Add(new Vector2(0,.45f));uvs.Add(new Vector2(.5f,1));uvs.Add(new Vector2(1,.45f));uvs.Add(new Vector2(.5f,.45f));
            for(int i=0;i<4;i++){indices.Add(start+i);indices.Add(start+4);indices.Add(start+(i+1)%4);}
        }
        public Mesh Mesh(string name)
        {
            var mesh = new Mesh { name = name, indexFormat = vertices.Count > 65535 ? UnityEngine.Rendering.IndexFormat.UInt32 : UnityEngine.Rendering.IndexFormat.UInt16 };
            mesh.SetVertices(vertices); mesh.SetTriangles(indices, 0); mesh.SetColors(colors);mesh.SetUVs(0,uvs); mesh.RecalculateNormals(); mesh.RecalculateBounds();
            return mesh;
        }
        public static GameObject Object(string name, Mesh mesh, Material material, Transform parent)
        {
            var obj = new GameObject(name, typeof(MeshFilter), typeof(MeshRenderer));
            obj.transform.SetParent(parent, false); obj.GetComponent<MeshFilter>().sharedMesh = mesh;
            var renderer = obj.GetComponent<MeshRenderer>(); renderer.sharedMaterial = material;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; renderer.receiveShadows = false;
            return obj;
        }
        public static Geometry Insect(int species, Color shell)
        {
            var g = new Geometry(); Color dark = new Color(.1f,.14f,.17f), shine = Color.Lerp(shell, Color.white, .38f);
            bool slim = species == 2 || species == 3 || species == 4;
            float width = slim ? .48f : .92f;
            g.Oval(new Vector3(0,.42f,-.18f), new Vector3(width,.55f,slim ? 1.22f : 1.02f), shell);
            g.Oval(new Vector3(0,.43f,.37f), new Vector3(width*.83f,.5f,.5f), Color.Lerp(shell, dark, .18f));
            g.Oval(new Vector3(0,.52f,.69f), new Vector3(.6f,.52f,.5f), shell);
            for (int side = -1; side <= 1; side += 2)
            {
                g.Oval(new Vector3(side*.215f,.62f,.88f), new Vector3(.22f,.25f,.12f), Color.white);
                g.Oval(new Vector3(side*.22f,.62f,.936f), new Vector3(.095f,.145f,.07f), dark);
                g.Oval(new Vector3(side*.2f,.67f,.97f), Vector3.one*.034f, Color.white, 6,4);
                g.Stem(new Vector3(side*.17f,.7f,.7f), new Vector3(side*.36f,.97f,.9f), .025f,.018f,dark);
                g.Oval(new Vector3(side*.36f,.97f,.9f), new Vector3(.08f,.065f,.08f), shine, 6,4);
            }
            if (species <= 1)
            {
                g.Stem(new Vector3(0,.61f,-.55f), new Vector3(0,.73f,.24f), .014f,.014f,dark);
                for (int s = -1; s <= 1; s += 2) g.Oval(new Vector3(s*.25f,.65f,-.15f), new Vector3(.15f,.06f,.57f),shine,8,4);
                if (species == 0)
                {
                    g.Stem(new Vector3(0,.74f,.7f), new Vector3(0,1.15f,1.0f),.14f,.085f,shell);
                    g.Stem(new Vector3(0,1.15f,1f), new Vector3(-.19f,1.36f,1.08f),.085f,.01f,shine);
                    g.Stem(new Vector3(0,1.15f,1f), new Vector3(.19f,1.36f,1.08f),.085f,.01f,shine);
                }
                else for (int s=-1;s<=1;s+=2)
                {
                    g.Stem(new Vector3(s*.23f,.48f,.85f),new Vector3(s*.38f,.54f,1.28f),.085f,.065f,shell);
                    g.Stem(new Vector3(s*.38f,.54f,1.28f),new Vector3(s*.13f,.6f,1.5f),.065f,.01f,shine);
                    g.Stem(new Vector3(s*.34f,.52f,1.17f),new Vector3(s*.13f,.52f,1.17f),.065f,.005f,shell);
                }
            }
            if (species == 4)
                g.Stem(new Vector3(0,.43f,-.45f),new Vector3(0,.43f,-1.3f),.12f,.035f,shell);
            if (species == 5)
            {
                for (int s=-1;s<=1;s+=2) for(int j=0;j<3;j++)
                    g.Oval(new Vector3(s*(j==1?.33f:.22f),.66f,-.45f+j*.28f),new Vector3(.18f,.065f,.17f),dark,7,4);
                g.Stem(new Vector3(0,.64f,-.6f),new Vector3(0,.71f,.28f),.02f,.02f,dark);
            }
            return g;
        }
        public static Geometry Legs(int species, int side, Color shell)
        {
            var g = new Geometry(); var dark = Color.Lerp(shell, new Color(.08f,.12f,.14f),.6f);
            for (int i=0;i<3;i++)
            {
                float z = .42f-i*.4f, spread = species==3 && i==2 ? 1.03f : .72f;
                var a = new Vector3(side*.25f,.38f,z); var b = new Vector3(side*spread,.31f,z+.2f);
                var c = new Vector3(side*(spread+.14f),.05f,z+.32f);
                if(species==2 && i==0) { b.y=.85f; c=new Vector3(side*.45f,.7f,1.06f); }
                g.Stem(a,b,species==3&&i==2?.11f:.045f,.04f,shell);
                g.Stem(b,c,.04f,.022f,dark); g.Oval(c,new Vector3(.13f,.06f,.17f),dark,6,4);
            }
            return g;
        }
    }
}
