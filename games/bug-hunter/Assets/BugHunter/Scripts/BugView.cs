using UnityEngine;

namespace BugHunter
{
    public sealed class BugView : MonoBehaviour
    {
        public Transform left, right, wings;
        public float movement = .3f, phase;
        public bool fallen;
        void Update()
        {
            float t = Time.time * 10 + phase;
            if (left) left.localRotation = Quaternion.Euler(0,Mathf.Sin(t)*movement*12,0);
            if (right) right.localRotation = Quaternion.Euler(0,-Mathf.Sin(t)*movement*12,0);
            if (wings) wings.localScale = new Vector3(1, .8f+Mathf.Sin(t*2)*.2f, 1);
        }
    }
}
