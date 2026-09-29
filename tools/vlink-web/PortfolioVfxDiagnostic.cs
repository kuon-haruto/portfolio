#if UNITY_EDITOR || DEVELOPMENT_BUILD
using System.Collections;
using System.Linq;
using UnityEngine;
using UnityEngine.VFX;
using UnityEngine.UI;

// Only included in the dedicated diagnostic scene, never the released player.
public sealed class PortfolioVfxDiagnostic : MonoBehaviour
{
    public GameObject[] subjects;
    public Vector4[] cameraPoses;
    public Quaternion[] cameraRotations;
    public Camera captureCamera;
    public Material copyMaterial;
    private bool waiting;
    public void Continue() { waiting = false; }

    private IEnumerator Start()
    {
        Application.runInBackground = true;
        Application.targetFrameRate = 60;
        int quality = System.Array.IndexOf(QualitySettings.names, "High Fidelity");
        if (quality < 0) throw new System.InvalidOperationException("Original reference quality setting is missing.");
        QualitySettings.SetQualityLevel(quality, true);
        // Match the native editor reference's LDR target before comparing backend colors.
        // Present the target through Unity UI; WebGPU requires no synchronous GPU readback.
        var target = new RenderTexture(960, 720, 24, RenderTextureFormat.ARGB32);
        captureCamera.targetTexture = target;
        var canvas = new GameObject("Reference surface").AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        var image = new GameObject("Reference image").AddComponent<RawImage>();
        image.transform.SetParent(canvas.transform, false);
        image.rectTransform.anchorMin = Vector2.zero;
        image.rectTransform.anchorMax = Vector2.one;
        image.rectTransform.offsetMin = Vector2.zero;
        image.rectTransform.offsetMax = Vector2.zero;
        image.texture = target;
        image.material = copyMaterial;
        Debug.Log("PORTFOLIO_VFX_DEVICE: " + SystemInfo.graphicsDeviceType + " compute=" + SystemInfo.supportsComputeShaders);
        Debug.Log("PORTFOLIO_VFX_SETTINGS: quality=" + QualitySettings.names[quality] + " color=" + QualitySettings.activeColorSpace + " target=ARGB32");
        int[] samples = { 6, 18, 42, 72 };
        for (int subjectIndex = 0; subjectIndex < subjects.Length; subjectIndex++)
        {
            var subject = subjects[subjectIndex];
            captureCamera.transform.position = cameraPoses[subjectIndex];
            captureCamera.transform.rotation = cameraRotations[subjectIndex];
            captureCamera.orthographicSize = cameraPoses[subjectIndex].w;
            subject.SetActive(true);
            var effects = subject.GetComponentsInChildren<VisualEffect>(true);
            foreach (var effect in effects)
            {
                effect.resetSeedOnPlay = false;
                effect.startSeed = 73;
                effect.Reinit();
                effect.pause = true;
            }
            for (int i = 0; i < 10; i++) yield return new WaitForEndOfFrame();
            for (int frame = 0; frame <= samples.Last(); frame++)
            {
                if (samples.Contains(frame))
                {
                    waiting = true;
                    Debug.Log("PORTFOLIO_VFX_FRAME: " + subject.name + ":" + frame);
                    while (waiting) yield return null;
                }
                foreach (var effect in effects) effect.Simulate(1f / 60f, 1);
                for (int i = 0; i < 3; i++) yield return new WaitForEndOfFrame();
            }
            subject.SetActive(false);
        }
        Debug.Log("PORTFOLIO_VFX_DIAGNOSTIC_COMPLETE");
    }
}
#endif
