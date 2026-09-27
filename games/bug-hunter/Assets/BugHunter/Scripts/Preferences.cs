using UnityEngine;

namespace BugHunter
{
    public sealed class Preferences
    {
        public const float DefaultSensitivity=1,DefaultVolume=.75f;
        public float sensitivity=DefaultSensitivity,volume=DefaultVolume;
        public static float Valid(float value,float min,float max,float fallback)
            =>float.IsNaN(value)||float.IsInfinity(value)?fallback:Mathf.Clamp(value,min,max);
        public void Load()
        {
            sensitivity=Valid(PlayerPrefs.GetFloat("BugHunter.Sensitivity",DefaultSensitivity),.2f,3,DefaultSensitivity);
            volume=Valid(PlayerPrefs.GetFloat("BugHunter.Volume",DefaultVolume),0,1,DefaultVolume);
        }
        public void Save()
        {
            PlayerPrefs.SetFloat("BugHunter.Sensitivity",sensitivity);PlayerPrefs.SetFloat("BugHunter.Volume",volume);PlayerPrefs.Save();
        }
        public void Reset(){sensitivity=DefaultSensitivity;volume=DefaultVolume;}
    }
}
