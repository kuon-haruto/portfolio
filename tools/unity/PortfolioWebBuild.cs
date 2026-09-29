using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.VFX;

public static class PortfolioWebBuild
{
    [Serializable]
    private class Metadata
    {
        public string companyName;
        public string productName;
        public string productVersion;
        public string unityVersion;
        public int simplifiedEffects;
        public int iceEffects;
        public string graphicsApi;
        public int originalVfxComponents;
        public string qualityLevel;
    }

    public static void Build()
    {
        string output = Environment.GetEnvironmentVariable("PORTFOLIO_WEB_OUTPUT");
        if (string.IsNullOrWhiteSpace(output) || !Path.IsPathRooted(output))
            throw new InvalidOperationException("PORTFOLIO_WEB_OUTPUT must be an absolute path.");
        string[] scenes = EditorBuildSettings.scenes.Where(scene => scene.enabled).Select(scene => scene.path).ToArray();
        if (scenes.Length == 0) throw new InvalidOperationException("No enabled build scenes.");

        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
        PlayerSettings.WebGL.decompressionFallback = true;
        PlayerSettings.WebGL.dataCaching = true;
        PlayerSettings.WebGL.nameFilesAsHashes = true;
        PlayerSettings.WebGL.template = "APPLICATION:Minimal";
        PlayerSettings.runInBackground = false;
        bool webgpu = Environment.GetEnvironmentVariable("PORTFOLIO_WEBGPU") == "1";
        PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.WebGL, false);
        if (webgpu)
        {
#if UNITY_6000_3_OR_NEWER
            if (Environment.GetEnvironmentVariable("PORTFOLIO_WEB_SIMPLE_EFFECTS") == "1")
                throw new InvalidOperationException("WebGPU must retain original VFX, not replace them.");
            PlayerSettings.SetGraphicsAPIs(BuildTarget.WebGL, new[] { GraphicsDeviceType.WebGPU });
#else
            throw new InvalidOperationException("The WebGPU migration requires Unity 6.3 or newer.");
#endif
        }
        else PlayerSettings.SetGraphicsAPIs(BuildTarget.WebGL, new[] { GraphicsDeviceType.OpenGLES3 });
        if (webgpu) PortfolioVLinkMigration.Prepare();
        // lilToon's build optimizer restores the current scene after scanning assets.
        if (Environment.GetEnvironmentVariable("PORTFOLIO_WEB_VLINK") == "1")
            UnityEditor.SceneManagement.EditorSceneManager.OpenScene(scenes[0]);
        using var effects = new PortfolioWebEffects();
        effects.Prepare();
        using var fur = webgpu ? PortfolioVLinkMigration.PrepareFur() : null;
        int originalVfx = 0;
        if (webgpu)
        {
            foreach (string guid in AssetDatabase.FindAssets("t:Prefab", new[] { "Assets/TechC/VBattle" }))
            {
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(AssetDatabase.GUIDToAssetPath(guid));
                foreach (var effect in prefab.GetComponentsInChildren<VisualEffect>(true))
                {
                    if (effect.visualEffectAsset == null)
                        throw new InvalidOperationException("Original graph reference is missing: " + prefab.name);
                    originalVfx++;
                    Debug.Log("PORTFOLIO_WEBGPU_GRAPH: " + prefab.name + " / " + AssetDatabase.GetAssetPath(effect.visualEffectAsset));
                }
            }
            if (originalVfx < 14) throw new InvalidOperationException("Original V-Link VFX components are missing.");
            Debug.Log("PORTFOLIO_WEBGPU_ORIGINAL_VFX: " + originalVfx);
        }
        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
        {
            scenes = scenes,
            locationPathName = output,
            target = BuildTarget.WebGL,
            options = BuildOptions.None
        });
        if (report.summary.result != BuildResult.Succeeded)
            throw new InvalidOperationException("Web build failed: " + report.summary.result);

        File.WriteAllText(Path.Combine(output, "portfolio-build.json"), JsonUtility.ToJson(new Metadata
        {
            companyName = PlayerSettings.companyName,
            productName = PlayerSettings.productName,
            productVersion = PlayerSettings.bundleVersion,
            unityVersion = Application.unityVersion,
            simplifiedEffects = effects.Count,
            iceEffects = effects.IceCount,
            graphicsApi = webgpu ? "WebGPU" : "WebGL2",
            originalVfxComponents = originalVfx,
            qualityLevel = QualitySettings.names[QualitySettings.GetQualityLevel()]
        }, true));
        Debug.Log("PORTFOLIO_WEB_BUILD_SUCCEEDED: " + output);
    }
}
