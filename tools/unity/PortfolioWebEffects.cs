using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.VFX;

// VFX Graph requires compute shaders. Web builds use CPU particles instead.
public sealed class PortfolioWebEffects : IDisposable
{
    private readonly Dictionary<string, byte[]> originals = new Dictionary<string, byte[]>();
    public int Count { get; private set; }

    public void Prepare()
    {
        if (Environment.GetEnvironmentVariable("PORTFOLIO_WEB_SIMPLE_EFFECTS") != "1") return;
        Material material = CreateMaterial();
        foreach (string guid in AssetDatabase.FindAssets("t:Prefab", new[] { "Assets" }))
        {
            string path = AssetDatabase.GUIDToAssetPath(guid);
            var asset = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            if (asset.GetComponentsInChildren<VisualEffect>(true).Length == 0) continue;
            originals[path] = File.ReadAllBytes(path);
            GameObject prefab = PrefabUtility.LoadPrefabContents(path);
            try
            {
                foreach (var effect in prefab.GetComponentsInChildren<VisualEffect>(true))
                {
                    GameObject target = effect.gameObject;
                    UnityEngine.Object.DestroyImmediate(effect);
                    foreach (Renderer renderer in target.GetComponents<Renderer>())
                        if (renderer.GetType().Name == "VFXRenderer") UnityEngine.Object.DestroyImmediate(renderer);
                    AddParticles(target, material, Path.GetFileNameWithoutExtension(path));
                    Count++;
                }
                PrefabUtility.SaveAsPrefabAsset(prefab, path);
            }
            finally { PrefabUtility.UnloadPrefabContents(prefab); }
        }
        AssetDatabase.SaveAssets();
        Debug.Log("PORTFOLIO_WEB_SIMPLE_EFFECTS: " + Count);
    }

    private static void AddParticles(GameObject target, Material material, string name)
    {
        string key = name.ToLowerInvariant();
        bool continuous = key.Contains("area") || key.Contains("buff") || key.Contains("heal") || key.Contains("hole");
        Color color = new Color(1f, .86f, .45f);
        if (key.Contains("slow") || key.Contains("water") || key.Contains("deffence")) color = new Color(.3f, .85f, 1f);
        if (key.Contains("fire") || key.Contains("debuff")) color = new Color(1f, .3f, .15f);
        if (key.Contains("poison") || key.Contains("blackhole")) color = new Color(.8f, .35f, 1f);
        if (key.Contains("heal") || (key.Contains("buff") && !key.Contains("debuff"))) color = new Color(.4f, 1f, .6f);
        if (key.Contains("slash") || key.Contains("whitehole")) color = Color.white;
        var particles = target.AddComponent<ParticleSystem>();
        particles.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
        var main = particles.main;
        main.duration = 1f;
        main.loop = continuous;
        main.playOnAwake = true;
        main.startLifetime = new ParticleSystem.MinMaxCurve(.3f, .7f);
        main.startSpeed = new ParticleSystem.MinMaxCurve(.3f, 1.2f);
        main.startSize = new ParticleSystem.MinMaxCurve(.08f, .18f);
        main.startColor = color;
        main.maxParticles = 48;
        main.scalingMode = ParticleSystemScalingMode.Hierarchy;
        var emission = particles.emission;
        emission.rateOverTime = continuous ? 18f : 0f;
        emission.SetBursts(new[] { new ParticleSystem.Burst(0f, 18) });
        var shape = particles.shape;
        shape.shapeType = ParticleSystemShapeType.Sphere;
        shape.radius = continuous ? .6f : .15f;
        var fade = particles.colorOverLifetime;
        fade.enabled = true;
        var gradient = new Gradient();
        gradient.SetKeys(new[] { new GradientColorKey(Color.white, 0f), new GradientColorKey(Color.white, 1f) },
            new[] { new GradientAlphaKey(1f, 0f), new GradientAlphaKey(0f, 1f) });
        fade.color = gradient;
        target.GetComponent<ParticleSystemRenderer>().sharedMaterial = material;
    }

    private static Material CreateMaterial()
    {
        const string folder = "Assets/PortfolioWebGenerated";
        if (!AssetDatabase.IsValidFolder(folder)) AssetDatabase.CreateFolder("Assets", "PortfolioWebGenerated");
        var material = AssetDatabase.LoadAssetAtPath<Material>(folder + "/Particle.mat");
        if (material != null) return material;
        var shader = Shader.Find("Universal Render Pipeline/Particles/Unlit");
        if (shader == null) throw new InvalidOperationException("URP particle shader is missing.");
        var texture = new Texture2D(32, 32, TextureFormat.RGBA32, false);
        for (int y = 0; y < 32; y++)
            for (int x = 0; x < 32; x++)
            {
                float radius = new Vector2((x - 15.5f) / 15.5f, (y - 15.5f) / 15.5f).magnitude;
                texture.SetPixel(x, y, new Color(1f, 1f, 1f, Mathf.Pow(Mathf.Clamp01(1f - radius), 2f)));
            }
        texture.Apply();
        AssetDatabase.CreateAsset(texture, folder + "/Particle.asset");
        material = new Material(shader);
        material.SetTexture("_BaseMap", texture);
        material.SetColor("_BaseColor", Color.white);
        material.SetFloat("_Surface", 1f);
        material.SetFloat("_SrcBlend", (float)BlendMode.SrcAlpha);
        material.SetFloat("_DstBlend", (float)BlendMode.OneMinusSrcAlpha);
        material.SetFloat("_ZWrite", 0f);
        material.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
        material.renderQueue = (int)RenderQueue.Transparent;
        AssetDatabase.CreateAsset(material, folder + "/Particle.mat");
        return material;
    }

    public void Dispose()
    {
        foreach (var original in originals) File.WriteAllBytes(original.Key, original.Value);
        if (originals.Count > 0) AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
    }
}
