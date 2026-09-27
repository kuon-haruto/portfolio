using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.Video;

public sealed class PortfolioVLinkWeb : IProcessSceneWithReport
{
    public int callbackOrder => 100;
    public void OnProcessScene(Scene scene, BuildReport report)
    {
        if (Environment.GetEnvironmentVariable("PORTFOLIO_WEB_VLINK") != "1" || report == null) return;
        if (scene.name == "SelectScene") PreserveSelectionStencil(scene);
        foreach (GameObject root in scene.GetRootGameObjects())
        {
            foreach (MonoBehaviour component in root.GetComponentsInChildren<MonoBehaviour>(true))
            {
                if (component == null || component.GetType().FullName != "TechC.VBattle.InGame.InGameManager") continue;
                // The source scene's debug roster bypasses character and NPC selection.
                var settings = new SerializedObject(component);
                settings.FindProperty("isDebug").boolValue = false;
                settings.ApplyModifiedPropertiesWithoutUndo();
            }
        }
        foreach (GameObject root in scene.GetRootGameObjects())
        foreach (VideoPlayer player in root.GetComponentsInChildren<VideoPlayer>(true))
        {
            if (player.clip == null) continue;
            string source = AssetDatabase.GetAssetPath(player.clip);
            string filename = AssetDatabase.AssetPathToGUID(source) + Path.GetExtension(source);
            string folder = Path.Combine(Environment.GetEnvironmentVariable("PORTFOLIO_WEB_OUTPUT"), "StreamingAssets");
            Directory.CreateDirectory(folder);
            File.Copy(source, Path.Combine(folder, filename), true);
            player.clip = null;
            player.source = VideoSource.Url;
            player.url = "../builds/v-link-battle/v1/StreamingAssets/" + filename;
            player.audioOutputMode = VideoAudioOutputMode.None;
        }
    }

    private static void PreserveSelectionStencil(Scene scene)
    {
        Shader shader = AssetDatabase.LoadAssetAtPath<Shader>("Assets/PortfolioWebGenerated/SelectionUnlit.shader");
        if (shader == null) throw new BuildFailedException("V-Link selection stencil shader is missing.");
        var replacements = new Dictionary<Material, Material>();
        int writers = 0, readers = 0;
        foreach (GameObject root in scene.GetRootGameObjects())
        foreach (Renderer renderer in root.GetComponentsInChildren<Renderer>(true))
        {
            Material[] materials = renderer.sharedMaterials;
            bool changed = false;
            for (int i = 0; i < materials.Length; i++)
            {
                Material original = materials[i];
                if (original == null || !original.HasProperty("_StencilRef") || original.GetFloat("_StencilRef") != 1f) continue;
                if (!replacements.TryGetValue(original, out Material replacement))
                {
                    // Only the built scene changes; source materials and character transforms stay intact.
                    replacement = new Material(original) { shader = shader, name = original.name + " (Web stencil)" };
                    replacement.renderQueue = original.renderQueue;
                    replacements.Add(original, replacement);
                    if (original.GetFloat("_StencilPass") == 2f) writers++;
                    if (original.GetFloat("_StencilComp") == 3f) readers++;
                }
                materials[i] = replacement;
                changed = true;
            }
            if (changed) renderer.sharedMaterials = materials;
        }
        if (writers == 0 || readers == 0) throw new BuildFailedException("V-Link selection mask materials were not found.");
        Debug.Log($"PORTFOLIO_VLINK_STENCIL: {writers} writer materials, {readers} reader materials");
    }
}
