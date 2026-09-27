using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.VFX;

public static class PortfolioVLinkIceTests
{
    private static readonly string[] Names = { "IceWall", "Ame_IceSlash", "Ame_FlyingSlash", "BladeStorm", "Ame_IceExplosion" };
    private const string Root = "Assets/TechC/VBattle/Prefabs/InGame/Ame/";

    public static void Verify()
    {
        Environment.SetEnvironmentVariable("PORTFOLIO_WEB_SIMPLE_EFFECTS", "1");
        Environment.SetEnvironmentVariable("PORTFOLIO_WEB_VLINK", "1");
        var before = Names.ToDictionary(name => name, name => File.ReadAllText(Root + name + ".prefab"));
        var gameplay = Names.ToDictionary(name => name, name => Gameplay(AssetDatabase.LoadAssetAtPath<GameObject>(Root + name + ".prefab")));
        using (var effects = new PortfolioWebEffects())
        {
            effects.Prepare();
            Require(effects.IceCount == 5, "All five ice graphs must be replaced");
            foreach (var name in Names)
            {
                var asset = AssetDatabase.LoadAssetAtPath<GameObject>(Root + name + ".prefab");
                // Compare Unity's actual values, including defaults omitted in older prefab YAML.
                Require(Gameplay(asset) == gameplay[name], name + " gameplay settings changed");
                Require(asset.GetComponentsInChildren<VisualEffect>(true).Length == 0, name + " still uses compute VFX");
                var instance = UnityEngine.Object.Instantiate(asset);
                try
                {
                    var systems = instance.GetComponentsInChildren<ParticleSystem>(true);
                    Require(systems.Length >= 2, name + " has no layered ice effect");
                    foreach (var ps in systems)
                    {
                        var renderer = ps.GetComponent<ParticleSystemRenderer>();
                        Require(renderer.sharedMaterial != null && renderer.sharedMaterial.shader.isSupported, name + " unsupported material");
                        if (renderer.renderMode == ParticleSystemRenderMode.Mesh)
                            Require(renderer.mesh != null && renderer.mesh.isReadable && renderer.mesh.vertexCount > 0, name + " unreadable mesh");
                        Require(!ps.collision.enabled && !ps.trigger.enabled && !ps.main.loop, name + " affects gameplay or loops forever");
                        for (int cycle = 0; cycle < 3; cycle++)
                        {
                            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
                            ps.Simulate(.2f, false, true, true);
                            Require(ps.particleCount > 0, name + " did not restart");
                            ps.Simulate(5, false, false, true);
                            Require(ps.particleCount == 0, name + " particles outlive effect");
                        }
                    }
                    Debug.Log("ICE_TEST_OK: " + name + " / " + systems.Length + " systems");
                }
                finally { UnityEngine.Object.DestroyImmediate(instance); }
            }
            RenderPreviews();
        }
        foreach (var name in Names) Require(File.ReadAllText(Root + name + ".prefab") == before[name], name + " source was not restored");
        Debug.Log("PORTFOLIO_ICE_TESTS_PASSED");
    }

    private static void RenderPreviews()
    {
        string output = Environment.GetEnvironmentVariable("PORTFOLIO_ICE_TEST_OUTPUT");
        if (string.IsNullOrEmpty(output)) return;
        Directory.CreateDirectory(output);
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var camera = new GameObject("Ice preview").AddComponent<Camera>();
        camera.clearFlags = CameraClearFlags.SolidColor; camera.backgroundColor = new Color(.07f, .08f, .11f);
        camera.orthographic = true; camera.orthographicSize = 4.5f;
        camera.transform.position = new Vector3(0, 2, -12); camera.transform.LookAt(new Vector3(0, 1, 0));
        var rt = new RenderTexture(960, 720, 24); camera.targetTexture = rt;
        foreach (var name in Names)
        {
            float center = name == "IceWall" ? 2.5f : 0;
            camera.transform.position = new Vector3(0, center, -12);
            camera.transform.rotation = Quaternion.identity;
            var instance = UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>(Root + name + ".prefab"));
            foreach (var ps in instance.GetComponentsInChildren<ParticleSystem>()) ps.Simulate(.25f, false, true, true);
            camera.Render(); RenderTexture.active = rt;
            var image = new Texture2D(960, 720, TextureFormat.RGB24, false);
            image.ReadPixels(new Rect(0, 0, 960, 720), 0, 0); image.Apply();
            File.WriteAllBytes(Path.Combine(output, name + ".png"), image.EncodeToPNG());
            foreach (var mesh in instance.GetComponentsInChildren<ParticleSystemRenderer>().Where(r => r.mesh != null))
                Debug.Log("ICE_MESH_BOUNDS: " + name + " / " + mesh.name + " / " + mesh.mesh.bounds + " / " + mesh.bounds);
            UnityEngine.Object.DestroyImmediate(image); UnityEngine.Object.DestroyImmediate(instance);
        }
        RenderTexture.active = null; camera.targetTexture = null;
        UnityEngine.Object.DestroyImmediate(rt); UnityEngine.Object.DestroyImmediate(camera.gameObject);
    }

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException("Ice regression: " + message);
    }

    private static string Gameplay(GameObject asset) => string.Join("\n", asset.GetComponentsInChildren<Component>(true)
        .Where(c => c is MonoBehaviour || c is Collider || c is Rigidbody)
        .Select(c => c.GetType().FullName + ":" + EditorJsonUtility.ToJson(c)));
}
