using UnityEngine;

namespace BugHunter
{
    public static class InsectModel
    {
        static readonly Color Dark=new Color(.055f,.065f,.075f);
        public static Geometry Body(int species,Color shell)
        {
            var g=new Geometry();var shade=Color.Lerp(shell,Dark,.55f);var edge=Color.Lerp(shell,Color.white,.12f);
            bool beetle=species<=1,lady=species==5;
            if(beetle||lady)
            {
                float wide=lady?1.05f:.92f,depth=lady?1.1f:1.2f;
                g.SmoothOval(new Vector3(0,.35f,-.25f),new Vector3(wide*.9f,.4f,depth),shade);
                for(int s=-1;s<=1;s+=2)
                {
                    g.SmoothOval(new Vector3(s*wide*.225f,.51f,-.25f),new Vector3(wide*.54f,lady?.64f:.49f,depth),shell,40,26);
                    if(beetle)for(int ridge=0;ridge<4;ridge++)
                    {
                        float x=s*(.075f+ridge*.09f),y=.705f-Mathf.Abs(x)*.17f;
                        g.Curve(new[]{new Vector3(x*.6f,y-.10f,-.78f),new Vector3(x,y,-.44f),new Vector3(x,y+.01f,-.1f),new Vector3(x*.72f,y-.07f,.2f)},.004f,.003f,edge,6,16);
                    }
                }
                g.Curve(new[]{new Vector3(0,.53f,-.83f),new Vector3(0,lady?.82f:.75f,-.3f),new Vector3(0,.65f,.25f)},.007f,.005f,Dark,8,24);
                g.SmoothOval(new Vector3(0,.51f,.37f),new Vector3(lady?.63f:.76f,.44f,.48f),lady?Dark:shade,36,22);
                g.SmoothOval(new Vector3(0,.51f,.68f),new Vector3(lady?.42f:.57f,.34f,.43f),shade,32,20);
                if(lady)for(int s=-1;s<=1;s+=2)
                {
                    for(int i=0;i<3;i++)g.SmoothOval(new Vector3(s*(i==1?.34f:.22f),i==1?.77f:.75f,-.58f+i*.31f),new Vector3(.16f,.027f,.19f),Dark,24,12);
                    g.SmoothOval(new Vector3(s*.2f,.66f,.48f),new Vector3(.13f,.025f,.13f),new Color(.91f,.88f,.7f),20,10);
                }
            }
            else
            {
                float width=species==3?.57f:.37f,length=species==4?1.65f:1.12f;
                for(int i=0;i<8;i++)
                {
                    float t=i/7f;g.SmoothOval(new Vector3(0,.43f,-.08f-t*length*.7f),new Vector3(width*(1-t*.65f),.33f*(1-t*.7f),length*.20f),Color.Lerp(shell,shade,i%2==0?.0f:.17f),28,16);
                }
                g.SmoothOval(new Vector3(0,.51f,.33f),new Vector3(species==2?.21f:.46f,species==2?.24f:.47f,species==2?.81f:.6f),shell,32,20,Quaternion.Euler(species==2?-14:0,0,0));
                g.SmoothOval(new Vector3(0,.6f,.76f),new Vector3(species==2?.60f:.46f,.32f,.32f),shade,32,20);
                if(species==3)for(int s=-1;s<=1;s+=2)
                    g.SmoothOval(new Vector3(s*.2f,.62f,-.2f),new Vector3(.14f,.12f,1.04f),edge,32,16,Quaternion.Euler(-8,0,s*8));
            }
            for(int s=-1;s<=1;s+=2)
            {
                float x=species==4?.235f:species==2?.26f:.25f;
                var eye=species==4?new Color(.36f,.18f,.12f):new Color(.075f,.045f,.095f);
                g.SmoothOval(new Vector3(s*x,.61f,.79f),new Vector3(species==4?.30f:.145f,species==4?.32f:.16f,.17f),eye,28,20);
                g.SmoothOval(new Vector3(s*(x-.014f),.657f,.863f),Vector3.one*.026f,new Color(.87f,.93f,.88f),16,10);
                float length=species==2?.55f:.3f;
                g.Curve(new[]{new Vector3(s*.16f,.59f,.79f),new Vector3(s*.30f,.66f,.94f),new Vector3(s*.42f,.73f,1.02f+length)},.019f,.006f,shade,10,22);
                if(beetle)g.SmoothOval(new Vector3(s*.42f,.73f,1.02f+length),new Vector3(.09f,.042f,.08f),edge,20,12);
                g.Curve(new[]{new Vector3(s*.13f,.42f,.78f),new Vector3(s*.18f,.40f,.9f),new Vector3(s*.06f,.42f,.96f)},.038f,.003f,shade,12,14);
            }
            if(species==0)
            {
                g.Curve(new[]{new Vector3(0,.66f,.65f),new Vector3(0,.81f,.98f),new Vector3(0,1.15f,1.12f),new Vector3(0,1.22f,1.30f)},.13f,.065f,shade,20,28);
                for(int s=-1;s<=1;s+=2)
                {
                    g.Curve(new[]{new Vector3(0,1.18f,1.20f),new Vector3(s*.16f,1.3f,1.32f),new Vector3(s*.25f,1.29f,1.5f)},.07f,.003f,edge,16,20);
                    g.Curve(new[]{new Vector3(s*.10f,1.24f,1.31f),new Vector3(s*.12f,1.4f,1.42f)},.045f,.002f,edge,12,12);
                }
                g.Curve(new[]{new Vector3(0,.66f,.35f),new Vector3(0,.9f,.45f),new Vector3(0,.97f,.70f)},.1f,.006f,shade,16,20);
            }
            if(species==1)for(int s=-1;s<=1;s+=2)
            {
                g.Curve(new[]{new Vector3(s*.21f,.47f,.80f),new Vector3(s*.39f,.53f,1.12f),new Vector3(s*.35f,.57f,1.42f),new Vector3(s*.08f,.61f,1.64f)},.095f,.002f,shade,20,32);
                for(int tooth=0;tooth<3;tooth++)
                {float z=1.00f+tooth*.18f;g.Curve(new[]{new Vector3(s*.35f,.52f,z),new Vector3(s*.17f,.53f,z+.04f)},.055f,.002f,edge,10,10);}
            }
            return g;
        }
        public static Vector3 LegAnchor(int species,int side,int index)=>new Vector3(side*(species==2?.13f:.24f),.41f,.40f-index*.34f);
        public static Geometry Leg(int species,int side,int index,Color shell)
        {
            var g=new Geometry();var dark=Color.Lerp(shell,Dark,.65f);bool hind=species==3&&index==2,scythe=species==2&&index==0;
            var knee=new Vector3(side*(hind?.68f:.4f),hind?.24f:.02f,.14f-index*.12f);
            var ankle=new Vector3(side*(hind?.80f:.57f),-.34f,.34f-index*.19f);
            if(scythe){knee=new Vector3(side*.26f,.35f,.2f);ankle=new Vector3(side*.14f,.15f,.70f);}
            g.Curve(new[]{Vector3.zero,knee*.55f+Vector3.up*.045f,knee},hind?.105f:.046f,hind?.075f:.034f,shell,14,16);
            g.SmoothOval(knee,Vector3.one*(hind?.15f:.09f),dark,20,12);
            g.Curve(new[]{knee,Vector3.Lerp(knee,ankle,.5f)+new Vector3(side*.035f,0,0),ankle},scythe?.06f:.041f,.021f,dark,14,18);
            var foot=ankle+new Vector3(side*.05f,scythe?.04f:-.03f,.11f);
            g.Curve(new[]{ankle,Vector3.Lerp(ankle,foot,.5f),foot},.024f,.01f,shade(shell),10,12);
            for(int s=-1;s<=1;s+=2)g.Curve(new[]{foot,foot+new Vector3(s*.028f,-.005f,.05f),foot+new Vector3(s*.022f,.016f,.085f)},.009f,.001f,Dark,8,10);
            for(int n=0;n<5;n++)
            {
                var p=Vector3.Lerp(knee,ankle,.2f+n*.14f);
                g.Curve(new[]{p,p+new Vector3(side*(scythe?-.045f:.03f),-.025f,.05f)},.011f,.001f,dark,7,6);
            }
            return g;
        }
        static Color shade(Color c)=>Color.Lerp(c,Dark,.4f);
        public static Geometry Wing(int side)
        {
            var g=new Geometry();var membrane=new Color(.64f,.82f,.82f,.30f);var vein=new Color(.15f,.25f,.22f,.87f);
            for(int n=0;n<2;n++)
            {
                float z=-.19f+n*.4f;var rotation=Quaternion.Euler(0,side*(n==0?19:-15),0);
                g.SmoothOval(new Vector3(side*.62f,0,z),new Vector3(1.25f,.012f,.29f),membrane,40,12,rotation);
                g.Curve(new[]{new Vector3(0,0,z),new Vector3(side*.62f,.008f,z+.06f),new Vector3(side*1.23f,0,z+(n==0?-.15f:.14f))},.008f,.002f,vein,6,22);
                for(int i=1;i<11;i++)
                {float t=i/11f,x=side*t*1.22f;g.Curve(new[]{new Vector3(x,.008f,z-.09f),new Vector3(x+side*.025f,.012f,z+.09f)},.0025f,.002f,vein,5,5);}
            }
            return g;
        }
    }
}
