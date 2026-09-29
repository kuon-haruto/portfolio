#if UNITY_EDITOR || DEVELOPMENT_BUILD
using System.Collections;
using UnityEngine;
using UnityEngine.UI;

public sealed class PortfolioFurDiagnostic : MonoBehaviour
{
    public PortfolioFurRenderer fur;
    public Camera captureCamera;
    public Material copyMaterial;
    private bool waiting;
    public void Continue() => waiting = false;

    private IEnumerator Start()
    {
        Application.runInBackground = true;
        Application.targetFrameRate = 60;
        QualitySettings.SetQualityLevel(System.Array.IndexOf(QualitySettings.names, "High Fidelity"), true);
        var target = new RenderTexture(960, 960, 24, RenderTextureFormat.ARGB32);
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
        fur.Initialize();
        Debug.Log("PORTFOLIO_FUR_DEVICE: " + SystemInfo.graphicsDeviceType + " vertices=" + fur.FinVertexCount);
        foreach (string name in new[] { "portable", "no-fur" })
        {
            fur.enabled = name == "portable";
            for (int frame = 0; frame < 30; frame++) yield return new WaitForEndOfFrame();
            waiting = true;
            Debug.Log("PORTFOLIO_FUR_FRAME: " + name);
            while (waiting) yield return null;
        }
        Debug.Log("PORTFOLIO_FUR_DIAGNOSTIC_COMPLETE");
    }
}
#endif
