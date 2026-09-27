using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

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
        // lilToon's build optimizer restores the current scene after scanning assets.
        if (Environment.GetEnvironmentVariable("PORTFOLIO_WEB_VLINK") == "1")
            UnityEditor.SceneManagement.EditorSceneManager.OpenScene(scenes[0]);
        using var effects = new PortfolioWebEffects();
        effects.Prepare();
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
            iceEffects = effects.IceCount
        }, true));
        Debug.Log("PORTFOLIO_WEB_BUILD_SUCCEEDED: " + output);
    }
}
