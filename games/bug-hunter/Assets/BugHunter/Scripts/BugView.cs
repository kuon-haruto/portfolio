using UnityEngine;

namespace BugHunter
{
    public sealed class BugView : MonoBehaviour
    {
        public Transform left, right, wings;
        public Transform[] legs,flightWings;
        public float movement = .3f, phase;
        public bool fallen;
        void Update()
        {
            float t = Time.time * 10 + phase;
            if (left) left.localRotation = Quaternion.Euler(0,Mathf.Sin(t)*movement*12,0);
            if (right) right.localRotation = Quaternion.Euler(0,-Mathf.Sin(t)*movement*12,0);
            if (wings) wings.localScale = new Vector3(1, .8f+Mathf.Sin(t*2)*.2f, 1);
            if(legs!=null)for(int i=0;i<legs.Length;i++)
            {
                if(!legs[i])continue;float step=Mathf.Sin(t+(i%3)*Mathf.PI+(i<3?0:Mathf.PI));
                legs[i].localRotation=Quaternion.Euler(Mathf.Max(0,step)*movement*10,step*movement*15,(i<3?-1:1)*Mathf.Max(0,step)*movement*9);
            }
            if(flightWings!=null)for(int i=0;i<flightWings.Length;i++)
                if(flightWings[i])flightWings[i].localRotation=Quaternion.Euler(0,0,(i==0?-1:1)*Mathf.Sin(t*2)*(3+movement*12));
        }
    }
}
