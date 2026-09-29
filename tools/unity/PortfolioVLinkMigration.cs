using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEngine;

public static class PortfolioVLinkMigration
{
    public static IDisposable PrepareFur()
    {
        Type adapter = AppDomain.CurrentDomain.GetAssemblies().Select(assembly => assembly.GetType("PortfolioFurBuild"))
            .FirstOrDefault(type => type != null);
        if (adapter == null) throw new InvalidOperationException("Prepare the WebGPU fur adapter before building.");
        return (IDisposable)adapter.GetMethod("Create", BindingFlags.Public | BindingFlags.Static).Invoke(null, null);
    }

    public static void Prepare()
    {
        if (Environment.GetEnvironmentVariable("PORTFOLIO_WEBGPU") != "1") return;
        CheckTmpResources();
        var qualityAssets = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/QualitySettings.asset");
        if (qualityAssets.Length != 1) throw new InvalidOperationException("Quality settings could not be loaded.");
        var quality = new SerializedObject(qualityAssets[0]);
        var defaults = quality.FindProperty("m_PerPlatformDefaultQuality");
        SerializedProperty webDefault = null;
        int nativeDefault = -1;
        for (int i = 0; i < defaults.arraySize; i++)
        {
            var entry = defaults.GetArrayElementAtIndex(i);
            string platform = entry.FindPropertyRelative("first").stringValue;
            if (platform == "Standalone") nativeDefault = entry.FindPropertyRelative("second").intValue;
            if (platform == "WebGL") webDefault = entry.FindPropertyRelative("second");
        }
        if (nativeDefault < 0 || webDefault == null) throw new InvalidOperationException("Native/Web default quality is missing.");
        webDefault.intValue = nativeDefault;
        quality.ApplyModifiedPropertiesWithoutUndo();
        QualitySettings.SetQualityLevel(nativeDefault, true);
        Debug.Log("PORTFOLIO_NATIVE_QUALITY: " + QualitySettings.names[nativeDefault]);
        foreach (string guid in AssetDatabase.FindAssets("t:Texture2D", new[] { "Assets/TechC/VBattle/Texture" }))
        {
            string path = AssetDatabase.GUIDToAssetPath(guid);
            if (!path.EndsWith(".exr", StringComparison.OrdinalIgnoreCase)) continue;
            var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            Debug.Log("PORTFOLIO_HDR_TEXTURE: " + path + " loaded=" + texture.graphicsFormat
                + " native=" + importer.GetAutomaticFormat("Standalone") + " web=" + importer.GetAutomaticFormat("WebGL"));
            // Web's automatic DXT5 import clips the original BC6H explosion texture's HDR values.
            // Half-float retains the range without requiring optional BC compression on the GPU.
            var webTexture = importer.GetPlatformTextureSettings("WebGL");
            if (!webTexture.overridden || webTexture.format != TextureImporterFormat.RGBAHalf)
            {
                webTexture.overridden = true;
                webTexture.format = TextureImporterFormat.RGBAHalf;
                importer.SetPlatformTextureSettings(webTexture);
                importer.SaveAndReimport();
            }
            texture = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            if (texture.format != TextureFormat.RGBAHalf) throw new InvalidOperationException("HDR texture import failed: " + path);
            Debug.Log("PORTFOLIO_HDR_PRESERVED: " + path + " format=" + texture.graphicsFormat);
        }
        // Unity's 2022 upgrade retains a compatibility flag that 6.3 refuses at build time.
        // This project uses the built-in URP passes; explicitly migrate to Render Graph.
        var pipeline = AssetDatabase.LoadMainAssetAtPath("Assets/UniversalRenderPipelineGlobalSettings.asset");
        if (pipeline == null) throw new InvalidOperationException("V-Link URP global settings are missing.");
        var serialized = new SerializedObject(pipeline);
        var property = serialized.GetIterator();
        bool found = false;
        while (property.Next(true))
        {
            if (property.name != "m_EnableRenderCompatibilityMode") continue;
            property.boolValue = false;
            found = true;
        }
        if (!found) throw new InvalidOperationException("Review the upgraded Render Graph settings schema.");
        serialized.ApplyModifiedPropertiesWithoutUndo();
        EditorUtility.SetDirty(pipeline);
        AssetDatabase.SaveAssets();
        Debug.Log("PORTFOLIO_URP_RENDER_GRAPH_ENABLED");
        const string package = "Packages/jp.lilxyzw.liltoon/";
        if (!File.ReadAllText(package + "Editor/lilShaderContainerImporter.cs").Contains("PortfolioUniqueSkipVariants"))
            throw new InvalidOperationException("Apply the lilToon Unity 6.3 compatibility patch before building.");

        // Keep the installed package's current settings, and regenerate its cached shader text.
        // Reflection keeps this shared build helper usable in games without lilToon.
        Type inspector = AppDomain.CurrentDomain.GetAssemblies()
            .Select(assembly => assembly.GetType("lilToon.lilToonInspector")).FirstOrDefault(type => type != null);
        if (inspector == null) throw new InvalidOperationException("The original lilToon editor package is missing.");
        const BindingFlags flags = BindingFlags.Public | BindingFlags.Static;
        var settings = new object[] { null };
        inspector.GetMethod("InitializeShaderSetting", flags).Invoke(null, settings);
        inspector.GetMethod("ApplyShaderSetting", flags).Invoke(null, new[] { settings[0], null });
        AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);

        int shaders = 0;
        foreach (string file in Directory.GetFiles(package + "Shader", "*.shader", SearchOption.AllDirectories))
        {
            var seen = new HashSet<string>();
            foreach (string line in File.ReadLines(file))
            {
                string[] words = line.Trim().Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                if (words.Length < 3 || words[0] != "#pragma" || words[1] != "skip_variants") continue;
                foreach (string keyword in words.Skip(2))
                    if (!seen.Add(keyword)) throw new InvalidOperationException("Duplicate skip_variants " + keyword + " in " + file);
            }
            shaders++;
        }
        Debug.Log("PORTFOLIO_LILTOON_REGENERATED: " + shaders);
    }

    private static void CheckTmpResources()
    {
        var settings = AssetDatabase.LoadMainAssetAtPath("Assets/TextMesh Pro/Resources/TMP Settings.asset");
        if (settings == null) throw new InvalidOperationException("Original TMP settings are missing.");
        Type type = settings.GetType();
        string expected = (string)type.GetField("s_CurrentAssetVersion", BindingFlags.NonPublic | BindingFlags.Static).GetValue(null);
        var version = new SerializedObject(settings).FindProperty("assetVersion");
        if (version == null || version.stringValue != expected)
            throw new InvalidOperationException("Finish the official TMP resource migration before starting Unity builds.");
        type.GetProperty("instance", BindingFlags.Public | BindingFlags.Static).GetValue(null);
    }

    public static void VerifyTmpResources()
    {
        CheckTmpResources();
        double deadline = EditorApplication.timeSinceStartup + 5;
        EditorApplication.CallbackFunction tick = null;
        tick = () =>
        {
            bool visible = Resources.FindObjectsOfTypeAll<EditorWindow>()
                .Any(window => window.GetType().FullName == "TMPro.TMP_PackageResourceImporterWindow");
            if (!visible && EditorApplication.timeSinceStartup < deadline) return;
            EditorApplication.update -= tick;
            if (visible) Debug.LogError("PORTFOLIO_TMP_IMPORTER_UNEXPECTED");
            else Debug.Log("PORTFOLIO_TMP_RESOURCES_VERIFIED: importerWindows=0");
            EditorApplication.Exit(visible ? 1 : 0);
        };
        EditorApplication.update += tick;
    }
}
