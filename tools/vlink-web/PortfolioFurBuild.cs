using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;
using UnityEngine.SceneManagement;

// Only copied into the isolated Unity 6 project. Source prefabs are restored
// after the build, while serialized references keep the fur shader variants.
public sealed class PortfolioFurBuild : IDisposable
{
    private const string Model = "Assets/TechC/VBattle/Models/Character/Ame/";
    private const string Generated = "Assets/PortfolioWebGenerated/";
    private static readonly Dictionary<Material, Material> Materials = new Dictionary<Material, Material>();
    private readonly Dictionary<string, byte[]> originals = new Dictionary<string, byte[]>();

    public static IDisposable Create()
    {
        var scope = new PortfolioFurBuild();
        try { scope.Prepare(); return scope; }
        catch { scope.Dispose(); throw; }
    }

    private void Prepare()
    {
        Materials.Clear();
        PortfolioFurReference.GenerateShader();
        var shader = AssetDatabase.LoadAssetAtPath<Shader>(Generated + "PortfolioFur.shader");
        if (shader == null || ShaderUtil.ShaderHasError(shader)) throw new BuildFailedException("Original fur vertex shader is unavailable.");
        foreach (string relative in new[] { "Material/Robe.mat", "SelectMat/Robe.mat" })
        {
            string path = Model + relative;
            var source = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (source == null) throw new BuildFailedException("Original robe material is missing: " + path);
            string output = Generated + "Fur-" + AssetDatabase.AssetPathToGUID(path) + ".mat";
            var copy = AssetDatabase.LoadAssetAtPath<Material>(output);
            if (copy == null) { copy = new Material(source); AssetDatabase.CreateAsset(copy, output); }
            else copy.CopyPropertiesFromMaterial(source);
            copy.shader = shader;
            copy.renderQueue = source.renderQueue;
            EditorUtility.SetDirty(copy);
            Materials.Add(source, copy);
        }
        AssetDatabase.SaveAssets();
        int count = 0;
        var paths = AssetDatabase.FindAssets("t:Prefab", new[] { "Assets/TechC/VBattle" })
            .Select(AssetDatabase.GUIDToAssetPath).OrderBy(path => path).ToArray();
        foreach (string path in paths)
        {
            var asset = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            if (!asset.GetComponentsInChildren<SkinnedMeshRenderer>(true).Any(IsTarget)) continue;
            originals[path] = File.ReadAllBytes(path);
            var prefab = PrefabUtility.LoadPrefabContents(path);
            try
            {
                count += Attach(prefab);
                PrefabUtility.SaveAsPrefabAsset(prefab, path);
            }
            finally { PrefabUtility.UnloadPrefabContents(prefab); }
        }
        if (count == 0) throw new BuildFailedException("No original robe renderers were found.");
        AssetDatabase.SaveAssets();
        Debug.Log("PORTFOLIO_FUR_PREFABS: " + originals.Count + " renderers=" + count);
    }

    private static bool IsTarget(SkinnedMeshRenderer renderer) => renderer.sharedMaterials.Any(material => material != null && Materials.ContainsKey(material));

    public static int Attach(GameObject root)
    {
        int count = 0;
        foreach (var renderer in root.GetComponentsInChildren<SkinnedMeshRenderer>(true))
        {
            var materials = renderer.sharedMaterials;
            for (int i = 0; i < materials.Length; i++)
            {
                if (materials[i] == null || !Materials.TryGetValue(materials[i], out Material material)) continue;
                if (i != 0 || renderer.sharedMesh == null || renderer.sharedMesh.vertexCount != 3244 || !renderer.sharedMesh.isReadable)
                    throw new BuildFailedException("Review changed robe mesh: " + renderer.name);
                var fur = renderer.GetComponent<PortfolioFurRenderer>();
                if (fur == null) fur = renderer.gameObject.AddComponent<PortfolioFurRenderer>();
                fur.source = renderer;
                fur.submesh = i;
                fur.furMaterial = material;
                if (PrefabUtility.IsPartOfPrefabInstance(fur)) PrefabUtility.RecordPrefabInstancePropertyModifications(fur);
                EditorUtility.SetDirty(fur);
                count++;
            }
        }
        return count;
    }

    public void Dispose()
    {
        foreach (var entry in originals) File.WriteAllBytes(entry.Key, entry.Value);
        if (originals.Count > 0) AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
        Materials.Clear();
    }
}

public sealed class PortfolioFurSceneProcessor : IProcessSceneWithReport
{
    public int callbackOrder => 200;
    public void OnProcessScene(Scene scene, BuildReport report)
    {
        if (report == null || Environment.GetEnvironmentVariable("PORTFOLIO_WEBGPU") != "1"
            || Environment.GetEnvironmentVariable("PORTFOLIO_WEB_VLINK") != "1") return;
        int count = scene.GetRootGameObjects().Sum(PortfolioFurBuild.Attach);
        Debug.Log("PORTFOLIO_FUR_SCENE: " + scene.name + " renderers=" + count);
    }
}
