using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.VFX;

// Editor-only reference capture; no changes to source graphs or prefabs.
public static class PortfolioVfxReference
{
    public static readonly string[] SubjectPaths = {
        "InGame/Ame/IceWall", "InGame/Ame/Ame_IceSlash", "InGame/Ame/Ame_FlyingSlash",
        "InGame/Ame/BladeStorm", "InGame/Ame/Ame_IceExplosion", "Effects/HitEffect",
        "InGame/Ame/Ame_CloneAttack", "InGame/Ame/Ame_Flower", "InGame/Effects/BreakShield"
    };
    private static readonly string[] Names = SubjectPaths.Select(Path.GetFileName).ToArray();
    private static readonly int[] Frames = { 6, 18, 42, 72 };
    private static readonly List<Sample> Samples = new List<Sample>();
    private static Camera camera;
    private static RenderTexture target;
    private static GameObject instance;
    private static VisualEffect[] effects;
    private static string output;
    private static int index, frame, settle;
    private static double deadline;

    [Serializable] private class Sample { public string name; public int frame; public uint alive; public string image; }
    [Serializable] private class Report { public string unity; public string device; public bool compute; public Sample[] samples; }

    public static void Begin()
    {
        output = Environment.GetEnvironmentVariable("PORTFOLIO_VFX_REFERENCE_OUTPUT");
        if (string.IsNullOrEmpty(output) || !Path.IsPathRooted(output)) throw new InvalidOperationException("Reference output must be absolute.");
        if (!SystemInfo.supportsComputeShaders) throw new InvalidOperationException("Reference capture requires compute shaders.");
        Directory.CreateDirectory(output);
        Samples.Clear();
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        camera = new GameObject("VFX reference camera").AddComponent<Camera>();
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.backgroundColor = new Color(.07f, .08f, .11f);
        camera.orthographic = true;
        camera.orthographicSize = 4.5f;
        target = new RenderTexture(960, 720, 24, RenderTextureFormat.ARGB32);
        camera.targetTexture = target;
        deadline = EditorApplication.timeSinceStartup + 300;
        index = -1;
        Next();
        EditorApplication.update += Tick;
    }

    private static void Next()
    {
        if (instance != null) UnityEngine.Object.DestroyImmediate(instance);
        index++;
        if (index == Names.Length)
        {
            File.WriteAllText(Path.Combine(output, "reference.json"), JsonUtility.ToJson(new Report {
                unity = Application.unityVersion, device = SystemInfo.graphicsDeviceType.ToString(),
                compute = SystemInfo.supportsComputeShaders, samples = Samples.ToArray()
            }, true));
            Debug.Log("PORTFOLIO_VFX_REFERENCE_COMPLETE: " + output);
            EditorApplication.update -= Tick;
            EditorApplication.Exit(0);
            return;
        }
        instance = CreateSubject(SubjectPaths[index]);
        ConfigureCamera(camera, Names[index]);
        effects = instance.GetComponentsInChildren<VisualEffect>(true);
        if (effects.Length == 0) throw new InvalidOperationException("Original VFX was replaced: " + Names[index]);
        foreach (var effect in effects)
        {
            effect.resetSeedOnPlay = false;
            effect.startSeed = 73;
            effect.Reinit();
            effect.pause = true;
        }
        frame = 0;
        settle = 10;
    }

    public static GameObject CreateSubject(string relativePath)
    {
        var asset = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/TechC/VBattle/Prefabs/" + relativePath + ".prefab");
        if (asset == null) throw new InvalidOperationException("Reference prefab missing: " + relativePath);
        var subject = UnityEngine.Object.Instantiate(asset);
        subject.name = Path.GetFileName(relativePath);
        subject.transform.position = Vector3.zero;
        // Preserve source transforms, VFX properties and child activation. Only
        // remove gameplay controllers from this diagnostic instance.
        foreach (var behaviour in subject.GetComponentsInChildren<MonoBehaviour>(true)) UnityEngine.Object.DestroyImmediate(behaviour);
        foreach (var collider in subject.GetComponentsInChildren<Collider>(true)) UnityEngine.Object.DestroyImmediate(collider);
        foreach (var body in subject.GetComponentsInChildren<Rigidbody>(true)) UnityEngine.Object.DestroyImmediate(body);
        return subject;
    }

    public static void ConfigureCamera(Camera targetCamera, string subjectName)
    {
        bool angled = subjectName == "Ame_CloneAttack" || subjectName == "Ame_Flower";
        targetCamera.transform.position = new Vector3(0, angled ? 6 : subjectName == "IceWall" ? 2.5f : 0, -12);
        targetCamera.transform.rotation = angled ? Quaternion.LookRotation(-targetCamera.transform.position) : Quaternion.identity;
        targetCamera.orthographicSize = subjectName == "HitEffect" ? 1.5f : 4.5f;
    }

    private static void Tick()
    {
        try
        {
            if (EditorApplication.timeSinceStartup > deadline) throw new TimeoutException("VFX reference capture timed out.");
            if (EditorApplication.isCompiling || ShaderUtil.anythingCompiling) return;
            camera.Render();
            if (settle-- > 0) return;
            if (Frames.Contains(frame))
            {
                RenderTexture.active = target;
                var texture = new Texture2D(target.width, target.height, TextureFormat.RGB24, false);
                texture.ReadPixels(new Rect(0, 0, target.width, target.height), 0, 0);
                texture.Apply();
                string filename = Names[index] + "-" + frame + ".png";
                File.WriteAllBytes(Path.Combine(output, filename), texture.EncodeToPNG());
                UnityEngine.Object.DestroyImmediate(texture);
                RenderTexture.active = null;
                uint alive = (uint)effects.Sum(effect => (long)effect.aliveParticleCount);
                Samples.Add(new Sample { name = Names[index], frame = frame, alive = alive, image = filename });
                Debug.Log("PORTFOLIO_VFX_SAMPLE: " + filename + " alive=" + alive);
            }
            if (frame == Frames.Last()) { Next(); return; }
            foreach (var effect in effects) effect.Simulate(1f / 60f, 1);
            frame++;
            settle = 2;
        }
        catch (Exception error)
        {
            Debug.LogException(error);
            EditorApplication.update -= Tick;
            EditorApplication.Exit(1);
        }
    }
}
