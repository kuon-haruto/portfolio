using System;
using System.IO;
using System.Globalization;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

public static class PortfolioFurReference
{
    private const string Package = "Packages/jp.lilxyzw.liltoon/Shader/";
    private const string Generated = "Assets/PortfolioWebGenerated/";
    private static Camera camera;
    private static SkinnedMeshRenderer robe;
    private static Material original, baseOnly;
    private static PortfolioFurRenderer fur;
    private static string output;
    private static int step, settle;
    private static double deadline;

    public static void GenerateShader()
    {
        string source = File.ReadAllText(Package + "ltsmulti_fur.shader");
        string header = source.Substring(0, source.IndexOf("        // Forward", StringComparison.Ordinal));
        int passStart = source.IndexOf("        // Fur\n", header.Length, StringComparison.Ordinal);
        if (passStart < 0) passStart = source.IndexOf("        // Fur\r\n", header.Length, StringComparison.Ordinal);
        if (passStart < 0) throw new InvalidOperationException("Fur shader pass is missing.");
        int passEnd = source.IndexOf("        // ShadowCaster", passStart, StringComparison.Ordinal);
        // The generated package uses a blank separator before the next pass.
        if (passEnd < 0) passEnd = source.IndexOf("        Pass", source.IndexOf("ENDHLSL", passStart, StringComparison.Ordinal), StringComparison.Ordinal);
        if (passStart < 0 || passEnd < 0) throw new InvalidOperationException("Fur shader pass layout changed.");
        string pass = source.Substring(passStart, passEnd - passStart);
        string shader = header + pass + "\n    }\n}\n";
        int nameEnd = shader.IndexOf('"', shader.IndexOf('"') + 1);
        shader = "Shader \"Portfolio/VLink/OriginalFur\"" + shader.Substring(nameEnd + 1);
        shader = shader.Replace("#pragma require geometry", "")
            .Replace("#pragma geometry geom", "")
            .Replace("#pragma vertex vert", "#pragma vertex PortfolioFinVertex")
            .Replace("#pragma multi_compile_instancing", "")
            .Replace("#pragma multi_compile _ DOTS_INSTANCING_ON", "")
            .Replace("#include \"Includes/", "#include \"" + Package + "Includes/")
            .Replace(Package + "Includes/lil_pass_forward_fur.hlsl", Generated + "PortfolioFurPass.hlsl");
        File.WriteAllText(Generated + "PortfolioFur.shader", shader);
        string vertex = File.ReadAllText(Package + "Includes/lil_common_vert_fur.hlsl");
        vertex = vertex.Substring(0, vertex.IndexOf("// Fin", StringComparison.Ordinal)) + "\n#endif\n";
        vertex = vertex.Replace("v2g vert(appdata input)", "v2g PortfolioSourceVertex(appdata input)");
        vertex = AbsoluteIncludes(vertex);
        File.WriteAllText(Generated + "PortfolioFurSourceVertex.hlsl", vertex);
        string forward = AbsoluteIncludes(File.ReadAllText(Package + "Includes/lil_pass_forward_fur.hlsl"));
        forward = forward.Replace("#include \"" + Package + "Includes/lil_common_vert_fur.hlsl\"",
            "#include \"" + Generated + "PortfolioFurSourceVertex.hlsl\"\n#include \"" + Generated + "PortfolioFurVertex.hlsl\"");
        File.WriteAllText(Generated + "PortfolioFurPass.hlsl", forward);
        AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
    }

    private static string AbsoluteIncludes(string text) => text.Replace("#include \"lil_", "#include \"" + Package + "Includes/lil_");

    public static void Begin()
    {
        output = Environment.GetEnvironmentVariable("PORTFOLIO_FUR_REFERENCE_OUTPUT");
        if (string.IsNullOrEmpty(output) || !Path.IsPathRooted(output)) throw new InvalidOperationException("Absolute output required.");
        Directory.CreateDirectory(output);
        SetupScene(true);
        step = 0;
        settle = 5;
        deadline = EditorApplication.timeSinceStartup + 240;
        EditorApplication.update += Tick;
        Debug.Log("PORTFOLIO_FUR_REFERENCE_BEGIN: vertices=" + fur.FinVertexCount);
    }

    private static void SetupScene(bool native)
    {
        GenerateShader();
        var shader = AssetDatabase.LoadAssetAtPath<Shader>(Generated + "PortfolioFur.shader");
        if (shader == null || ShaderUtil.ShaderHasError(shader)) throw new InvalidOperationException("Portable fur shader failed.");
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var model = UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>(
            "Assets/TechC/VBattle/Models/Character/Ame/Ame_liltoon.prefab"));
        float scale = 1;
        string requestedScale = Environment.GetEnvironmentVariable("PORTFOLIO_FUR_REFERENCE_SCALE");
        if (!string.IsNullOrEmpty(requestedScale)) scale = float.Parse(requestedScale, CultureInfo.InvariantCulture);
        if (!(scale > 0 && scale <= 1000)) throw new InvalidOperationException("Invalid reference scale.");
        model.transform.localScale *= scale;
        foreach (var behaviour in model.GetComponentsInChildren<MonoBehaviour>(true)) behaviour.enabled = false;
        foreach (var animator in model.GetComponentsInChildren<Animator>(true)) animator.enabled = false;
        robe = model.GetComponentsInChildren<SkinnedMeshRenderer>(true).Single(r => r.sharedMaterials.Any(m => m != null && m.name == "Robe"));
        var probe = new Mesh();
        robe.BakeMesh(probe, false);
        Debug.Log("PORTFOLIO_FUR_SCALE: scale=" + scale + " normalLength=" + probe.normals.Average(n => n.magnitude)
            + " bakedBounds=" + probe.bounds + " sourceBounds=" + robe.sharedMesh.bounds
            + " rendererMatrix=" + robe.localToWorldMatrix + " transformMatrix=" + robe.transform.localToWorldMatrix);
        UnityEngine.Object.DestroyImmediate(probe);
        original = robe.sharedMaterial;
        baseOnly = CopyMaterial(original, Generated + "FurReferenceBase.mat", original.shader);
        baseOnly.SetShaderPassEnabled("UniversalForward", false);
        fur = robe.gameObject.AddComponent<PortfolioFurRenderer>();
        fur.source = robe;
        fur.furMaterial = CopyMaterial(original, Generated + "FurReferenceFins.mat", shader);
        if (native) fur.Initialize();
        fur.enabled = !native;
        if (!native) robe.sharedMaterial = baseOnly;
        camera = new GameObject("Fur comparison camera").AddComponent<Camera>();
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.backgroundColor = new Color(.07f, .08f, .11f);
        camera.orthographic = true;
        camera.orthographicSize = 1.15f * scale;
        camera.farClipPlane = Mathf.Max(1000, 10 * scale);
        camera.transform.position = new Vector3(0, .95f, 4) * scale;
        camera.transform.LookAt(new Vector3(0, .95f, 0) * scale);
        if (native) camera.targetTexture = new RenderTexture(960, 960, 24, RenderTextureFormat.ARGB32);
        RenderSettings.ambientLight = Color.white * .8f;
        var light = new GameObject("Reference light").AddComponent<Light>();
        light.type = LightType.Directional;
        light.transform.rotation = Quaternion.Euler(35, -30, 0);
    }

    private static Material CopyMaterial(Material source, string path, Shader shader)
    {
        var material = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (material == null)
        {
            material = new Material(source);
            AssetDatabase.CreateAsset(material, path);
        }
        else material.CopyPropertiesFromMaterial(source);
        material.shader = shader;
        material.renderQueue = source.renderQueue;
        EditorUtility.SetDirty(material);
        return material;
    }

    public static void BuildWeb()
    {
        string destination = Environment.GetEnvironmentVariable("PORTFOLIO_FUR_DIAGNOSTIC_OUTPUT");
        if (string.IsNullOrEmpty(destination) || !Path.IsPathRooted(destination)) throw new InvalidOperationException("Absolute diagnostic output required.");
        PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.WebGL, false);
        PlayerSettings.SetGraphicsAPIs(BuildTarget.WebGL, new[] { GraphicsDeviceType.WebGPU });
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
        PlayerSettings.WebGL.decompressionFallback = true;
        PlayerSettings.WebGL.nameFilesAsHashes = true;
        PlayerSettings.WebGL.template = "APPLICATION:Minimal";
        PortfolioVLinkMigration.Prepare();
        SetupScene(false);
        var diagnostic = new GameObject("PortfolioFurDiagnostic").AddComponent<PortfolioFurDiagnostic>();
        diagnostic.fur = fur;
        diagnostic.captureCamera = camera;
        diagnostic.copyMaterial = AssetDatabase.LoadAssetAtPath<Material>(Generated + "VfxReferenceBlit.mat");
        if (diagnostic.copyMaterial == null)
        {
            var shader = AssetDatabase.LoadAssetAtPath<Shader>("Assets/PortfolioDiagnostics/VfxReferenceBlit.shader");
            if (shader == null) throw new InvalidOperationException("Reference presentation shader is missing.");
            diagnostic.copyMaterial = new Material(shader);
            AssetDatabase.CreateAsset(diagnostic.copyMaterial, Generated + "VfxReferenceBlit.mat");
        }
        AssetDatabase.SaveAssets();
        const string scenePath = Generated + "FurDiagnostic.unity";
        EditorSceneManager.SaveScene(camera.gameObject.scene, scenePath);
        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
            scenes = new[] { scenePath }, locationPathName = destination, target = BuildTarget.WebGL,
            options = BuildOptions.Development, extraScriptingDefines = new[] { "PORTFOLIO_VFX_DIAGNOSTIC" }
        });
        if (report.summary.result != BuildResult.Succeeded) throw new InvalidOperationException("Fur diagnostic build failed.");
        File.WriteAllText(Path.Combine(destination, "unity-version.txt"), Application.unityVersion);
        Debug.Log("PORTFOLIO_FUR_DIAGNOSTIC_BUILD_COMPLETE: " + destination);
    }

    private static void Tick()
    {
        try
        {
            if (EditorApplication.timeSinceStartup > deadline) throw new TimeoutException("Fur reference timed out.");
            if (ShaderUtil.anythingCompiling || EditorApplication.isCompiling) return;
            fur.RefreshPose();
            camera.Render();
            if (settle-- > 0) return;
            var target = camera.targetTexture;
            RenderTexture.active = target;
            var texture = new Texture2D(target.width, target.height, TextureFormat.RGB24, false);
            texture.ReadPixels(new Rect(0, 0, target.width, target.height), 0, 0);
            texture.Apply();
            string name = step == 0 ? "native" : step == 1 ? "portable" : "no-fur";
            File.WriteAllBytes(Path.Combine(output, name + ".png"), texture.EncodeToPNG());
            UnityEngine.Object.DestroyImmediate(texture);
            RenderTexture.active = null;
            Debug.Log("PORTFOLIO_FUR_SAMPLE: " + name);
            if (++step == 3)
            {
                EditorApplication.update -= Tick;
                UnityEngine.Object.DestroyImmediate(fur);
                EditorApplication.Exit(0);
                return;
            }
            robe.sharedMaterial = baseOnly;
            fur.enabled = step == 1;
            settle = 5;
        }
        catch (Exception error)
        {
            Debug.LogException(error);
            EditorApplication.update -= Tick;
            EditorApplication.Exit(1);
        }
    }
}
