using System;
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
}
