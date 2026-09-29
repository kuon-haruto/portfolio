#if UNITY_6000_3_OR_NEWER
// Copied explicitly for the diagnostic build, not by the production build script.
using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

public static class PortfolioVfxDiagnosticBuild
{
    public static void Build()
    {
        string output = Environment.GetEnvironmentVariable("PORTFOLIO_VFX_DIAGNOSTIC_OUTPUT");
        if (string.IsNullOrEmpty(output) || !Path.IsPathRooted(output)) throw new InvalidOperationException("Diagnostic output must be absolute.");
        PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.WebGL, false);
        PlayerSettings.SetGraphicsAPIs(BuildTarget.WebGL, new[] { GraphicsDeviceType.WebGPU });
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
        PlayerSettings.WebGL.decompressionFallback = true;
        PlayerSettings.WebGL.nameFilesAsHashes = true;
        PlayerSettings.WebGL.template = "APPLICATION:Minimal";
        PortfolioVLinkMigration.Prepare();
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var controller = new GameObject("PortfolioVfxDiagnostic").AddComponent<PortfolioVfxDiagnostic>();
        var copyShader = AssetDatabase.LoadAssetAtPath<Shader>("Assets/PortfolioDiagnostics/VfxReferenceBlit.shader");
        if (copyShader == null) throw new InvalidOperationException("Reference presentation shader is missing.");
        const string copyMaterialPath = "Assets/PortfolioWebGenerated/VfxReferenceBlit.mat";
        var copyMaterial = AssetDatabase.LoadAssetAtPath<Material>(copyMaterialPath);
        if (copyMaterial == null) { copyMaterial = new Material(copyShader); AssetDatabase.CreateAsset(copyMaterial, copyMaterialPath); }
        controller.copyMaterial = copyMaterial;
        var camera = new GameObject("Reference camera").AddComponent<Camera>();
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.backgroundColor = new Color(.07f, .08f, .11f);
        camera.orthographic = true;
        camera.orthographicSize = 4.5f;
        controller.captureCamera = camera;
        var paths = PortfolioVfxReference.SubjectPaths;
        controller.subjects = new GameObject[paths.Length];
        controller.cameraPoses = new Vector4[paths.Length];
        controller.cameraRotations = new Quaternion[paths.Length];
        for (int i = 0; i < paths.Length; i++)
        {
            var instance = PortfolioVfxReference.CreateSubject(paths[i]);
            PortfolioVfxReference.ConfigureCamera(camera, instance.name);
            var position = camera.transform.position;
            controller.cameraPoses[i] = new Vector4(position.x, position.y, position.z, camera.orthographicSize);
            controller.cameraRotations[i] = camera.transform.rotation;
            instance.SetActive(false);
            controller.subjects[i] = instance;
        }
        const string scenePath = "Assets/PortfolioWebGenerated/VfxDiagnostic.unity";
        EditorSceneManager.SaveScene(scene, scenePath);
        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
            scenes = new[] { scenePath }, locationPathName = output,
            target = BuildTarget.WebGL, options = BuildOptions.Development,
            extraScriptingDefines = new[] { "PORTFOLIO_VFX_DIAGNOSTIC" }
        });
        if (report.summary.result != BuildResult.Succeeded) throw new InvalidOperationException("VFX diagnostic build failed.");
        File.WriteAllText(Path.Combine(output, "unity-version.txt"), Application.unityVersion);
        Debug.Log("PORTFOLIO_VFX_DIAGNOSTIC_BUILD_COMPLETE: " + output);
    }
}
#endif
