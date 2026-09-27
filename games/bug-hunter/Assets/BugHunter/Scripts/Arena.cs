using UnityEngine;
using UnityEngine.AI;
using System.Collections.Generic;

namespace BugHunter
{
    public sealed class Arena : MonoBehaviour
    {
        sealed class Actor
        {
            public NavMeshAgent agent;
            public BugView view;
            public float kick,stagger,repath,travel;
            public Vector3 last;
        }
        static readonly Vector3 Center=new Vector3(260,0,0);
        readonly Actor[] actors=new Actor[2];
        readonly List<Mesh> meshes=new List<Mesh>();
        NavMeshData navData;
        NavMeshDataInstance instance;
        Battle battle;
        Camera cameraView;
        float elapsed;
        public float lastHitDistance,maxHitDistance;
        public bool Navigating => actors[0]!=null && actors[0].agent.isOnNavMesh && actors[1].agent.isOnNavMesh;
        public Vector3 Position(int side)=>actors[side]?.agent.transform.position??Vector3.zero;
        public float Travel(int side)=>actors[side]?.travel??0;
        public BugView View(int side)=>actors[side].view;
        public void Initialize()
        {
            var settings=NavMesh.GetSettingsByIndex(0);settings.agentRadius=.48f;settings.agentHeight=1.6f;settings.agentClimb=.3f;
            settings.overrideVoxelSize=true;settings.voxelSize=.12f;
            var sources=new List<NavMeshBuildSource> {new NavMeshBuildSource {
                shape=NavMeshBuildSourceShape.Box,transform=Matrix4x4.TRS(Center-Vector3.up*.25f,Quaternion.identity,Vector3.one),size=new Vector3(13,.5f,13),area=0}};
            navData=NavMeshBuilder.BuildNavMeshData(settings,sources,new Bounds(Center,new Vector3(16,5,16)),Vector3.zero,Quaternion.identity);
            if(!navData)throw new System.InvalidOperationException("Arena navigation mesh could not be built");
            instance=NavMesh.AddNavMeshData(navData);
        }
        public void Clear()
        {
            for(int i=0;i<2;i++){if(actors[i]!=null)Destroy(actors[i].agent.gameObject);actors[i]=null;}
            foreach(var mesh in meshes)Destroy(mesh);meshes.Clear();battle=null;
        }
        public void StartFight(Battle simulation,Camera camera,Material mat)
        {
            Clear();battle=simulation;cameraView=camera;elapsed=lastHitDistance=maxHitDistance=0;
            for(int i=0;i<2;i++)
            {
                var fighter=i==0?battle.player:battle.enemy;
                var root=new GameObject(i==0?"Partner navigation":"Opponent navigation");root.transform.SetParent(transform);
                root.transform.position=Center+new Vector3(i==0?-3.6f:3.6f,0,i==0?-1.3f:1.3f);
                var agent=root.AddComponent<NavMeshAgent>();agent.radius=.55f;agent.height=1.4f;agent.acceleration=12;agent.angularSpeed=540;
                agent.updateRotation=false;agent.stoppingDistance=.1f;agent.autoBraking=true;agent.avoidancePriority=40+i*10;
                agent.obstacleAvoidanceType=ObstacleAvoidanceType.HighQualityObstacleAvoidance;
                var view=Instantiate(fighter.species.model,root.transform).GetComponent<BugView>();view.transform.localScale=Vector3.one*1.08f*fighter.bug.size;
                view.transform.localRotation=Quaternion.Euler(0,i==0?70:-110,0);
                foreach(var renderer in view.GetComponentsInChildren<Renderer>())renderer.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.On;
                actors[i]=new Actor {agent=agent,view=view,last=root.transform.position};
                var marker=new Geometry();Color color=i==0?new Color(.2f,.85f,.9f):new Color(1,.35f,.3f);
                for(int k=0;k<32;k++)
                {
                    float a=k*Mathf.PI*2/32,b=(k+1)*Mathf.PI*2/32;
                    marker.Stem(new Vector3(Mathf.Cos(a)*.88f,.015f,Mathf.Sin(a)*.88f),new Vector3(Mathf.Cos(b)*.88f,.015f,Mathf.Sin(b)*.88f),.023f,.023f,color,4);
                }
                var mesh=marker.Mesh("Team marker");meshes.Add(mesh);Geometry.Object("Team marker",mesh,mat,root.transform);
            }
            battle.canStrike=CanStrike;
        }
        bool CanStrike(int side)
        {
            if(!Navigating)return false;
            var delta=Position(1-side)-Position(side);delta.y=0;
            return delta.magnitude<=1.95f && Vector3.Dot(actors[side].view.transform.forward,delta.normalized)>.65f;
        }
        public void Impact(int side,bool heavy)
        {
            actors[side].kick=1;actors[1-side].stagger=heavy?.25f:.12f;
            lastHitDistance=Vector3.Distance(Position(0),Position(1));maxHitDistance=Mathf.Max(maxHitDistance,lastHitDistance);
        }
        public void Tick(float dt,bool paused)
        {
            if(battle==null||!Navigating)return;
            elapsed+=paused?0:dt;
            for(int side=0;side<2;side++)
            {
                var a=actors[side];var f=side==0?battle.player:battle.enemy;
                a.agent.isStopped=paused||f.IsDown||battle.ended;
                if(paused)continue;
                var at=a.agent.transform.position;var other=Position(1-side);var toward=other-at;toward.y=0;
                float distance=toward.magnitude;var direction=toward.sqrMagnitude>.001f?toward.normalized:Vector3.forward;
                var tangent=new Vector3(-direction.z,0,direction.x);
                a.travel+=Vector3.Distance(at,a.last);a.last=at;
                a.repath-=dt;a.kick=Mathf.MoveTowards(a.kick,0,dt*3.2f);a.stagger=Mathf.MoveTowards(a.stagger,0,dt);
                if(!a.agent.isStopped && a.repath<=0)
                {
                    a.repath=.16f;
                    bool guard=f.order==Order.Guard,charge=f.order==Order.Skill&&f.clock<.35f;
                    float flank=Mathf.Sin(elapsed*.47f+side*2.1f)>.0f?1:-1;
                    Vector3 destination;
                    if(guard)destination=other-direction*3.5f+tangent*flank*1.1f;
                    else if(distance>2.2f||f.clock<.45f)destination=other-direction*1.55f;
                    else destination=other-direction*2.2f+tangent*flank*1.8f;
                    var offset=destination-Center;offset.y=0;destination=Center+Vector3.ClampMagnitude(offset,5.5f);
                    a.agent.speed=guard?1.65f:charge?3.8f:2.65f+f.bug.Stat(f.species,3)*.012f;
                    if(NavMesh.SamplePosition(destination,out var hit,.8f,NavMesh.AllAreas))a.agent.SetDestination(hit.position);
                }
                var facing=Quaternion.LookRotation(direction,Vector3.up)*Quaternion.Euler(0,0,f.IsDown?172:0);
                a.view.transform.rotation=Quaternion.Slerp(a.view.transform.rotation,facing,dt*10);
                a.view.transform.localPosition=direction*(a.kick*.34f-a.stagger*.8f)+Vector3.up*(f.IsDown?.45f:Mathf.Sin(a.kick*Mathf.PI)*.13f);
                a.view.movement=f.IsDown?.7f:Mathf.Clamp(a.agent.velocity.magnitude*.5f+a.kick,.08f,1.8f);
            }
            if(!paused)FrameCamera(dt);
        }
        public void FrameCamera(float dt)
        {
            if(!cameraView||actors[0]==null)return;
            bool portrait=Screen.height>Screen.width;
            var middle=(Position(0)+Position(1))*.5f;
            middle=Vector3.Lerp(Center,middle,.55f)+Vector3.up*.45f;
            float distance=Vector3.Distance(Position(0),Position(1));
            float zoom=portrait?Mathf.Max(9.5f,distance*1.5f+2):Mathf.Max(9.7f,distance*1.1f);
            var position=middle+new Vector3(0,zoom*.7f,zoom);
            cameraView.transform.position=Vector3.Lerp(cameraView.transform.position,position,1-Mathf.Exp(-dt*3));
            cameraView.transform.rotation=Quaternion.Slerp(cameraView.transform.rotation,Quaternion.LookRotation(middle-cameraView.transform.position),1-Mathf.Exp(-dt*4));
        }
        void OnDestroy(){Clear();if(instance.valid)instance.Remove();if(navData)Destroy(navData);}
    }
}
