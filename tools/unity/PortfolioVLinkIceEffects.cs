using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.VFX;

// These five graphs need their silhouettes, not the generic sparkle fallback.
public static class PortfolioVLinkIceEffects
{
    private const string Root = "Assets/TechC/VBattle/";
    private const string Generated = "Assets/PortfolioWebGenerated/";
    private static readonly Color Ice = new Color(.2f, .8f, 1f, .95f);
    private static readonly Color WhiteIce = new Color(.8f, .96f, 1f, .95f);

    public static bool TryReplace(VisualEffect source, string path)
    {
        if (Environment.GetEnvironmentVariable("PORTFOLIO_WEB_VLINK") != "1" ||
            !path.StartsWith(Root + "Prefabs/InGame/Ame/", StringComparison.Ordinal)) return false;
        string name = Path.GetFileNameWithoutExtension(path);
        if (!new[] { "IceWall", "Ame_IceSlash", "Ame_FlyingSlash", "BladeStorm", "Ame_IceExplosion" }.Contains(name)) return false;
        Material ice = IceMaterial();
        Transform parent = source.transform;
        switch (name)
        {
            case "IceWall":
                // Mesh, angle, scale and lifetime come from wall.vfx. The attack's own lifetime remains untouched.
                MeshParticle(parent, "IceWall", Mesh("Scenes/WorkScene/Work_Z/Icewall/Icewall.fbx", -2942931350421230642L), ice, 1.5f, 1f, Vector3.zero, Ice);
                Shards(parent, ice, 20, .9f, 2f, .12f);
                break;
            case "Ame_IceSlash":
                Material slash = IceMaterial("IceSlash", arc: 1);
                MeshParticle(parent, "SlashOuter", Mesh("Models/Effects/OutSlash01.fbx", -3326229507395459808L), slash,
                    Float(source, "MainLifetime", .5f), .72f, new Vector3(0, 0, 180), WhiteIce);
                MeshParticle(parent, "SlashInner", Mesh("Models/Effects/Ice_SlashMesh.fbx", -3326229507395459808L), slash,
                    Float(source, "SubLifetime", .6f), .68f, new Vector3(0, 0, 180), Ice);
                Shards(parent, ice, 12, .45f, 1.5f, .035f);
                break;
            case "Ame_FlyingSlash":
                MeshParticle(parent, "FlyingSlash", Mesh("Models/Effects/FlyingSlashMesh.fbx", 4536773283001372330L), ice,
                    Float(source, "BladeDuration", 3f), 1f, new Vector3(0, 0, -90), Ice);
                Shards(parent, ice, 12, .8f, 1f, .04f);
                break;
            case "BladeStorm":
                Material storm = IceMaterial("IceStorm", swirl: 1);
                var core = MeshParticle(parent, "StormCore", Mesh("Models/Effects/BladeStorm.fbx", -593053110101353100L), storm,
                    Float(source, "Duration", 1f), 60f, new Vector3(-90, 180, 0), WhiteIce);
                var shell = MeshParticle(parent, "StormShell", Mesh("Models/Effects/BladeStorm.fbx", 4977202743080756836L), storm,
                    Float(source, "Duration", 1f), 60f, new Vector3(-90, 180, 0), Ice);
                shell.transform.localScale = new Vector3(1.5f, 2.01f, 1.5f);
                Spin(core, 360); Spin(shell, -300);
                Shards(parent, ice, 24, 1f, 2f, .06f);
                break;
            case "Ame_IceExplosion":
                // Reuse the source graph's 8x8 explosion flipbook, tinted with the prefab's ice palette.
                var blast = Particles(parent, "IceBlast", 1.25f, 6, Ice);
                var main = blast.main;
                main.startSize = new ParticleSystem.MinMaxCurve(2.5f, 4f);
                main.startSpeed = new ParticleSystem.MinMaxCurve(.2f, .8f);
                main.startRotation = new ParticleSystem.MinMaxCurve(0f, Mathf.PI * 2);
                var shape = blast.shape; shape.enabled = true; shape.shapeType = ParticleSystemShapeType.Sphere; shape.radius = .3f;
                var sheet = blast.textureSheetAnimation;
                sheet.enabled = true; sheet.numTilesX = 8; sheet.numTilesY = 8;
                sheet.frameOverTime = new ParticleSystem.MinMaxCurve(1f, AnimationCurve.Linear(0, 0, 1, 1));
                blast.GetComponent<ParticleSystemRenderer>().sharedMaterial = ExplosionMaterial();
                var size = blast.sizeOverLifetime; size.enabled = true;
                size.size = new ParticleSystem.MinMaxCurve(1f, AnimationCurve.EaseInOut(0, .25f, 1, 1));
                Shards(parent, ice, 40, 1.35f, 3f, .1f);
                break;
        }
        Debug.Log("PORTFOLIO_WEB_ICE_REPLACED: " + name);
        return true;
    }

    private static float Float(VisualEffect source, string name, float fallback) => source.HasFloat(name) ? source.GetFloat(name) : fallback;

    private static Mesh Mesh(string path, long localId)
    {
        // Mesh particles are expanded on the CPU on WebGL; the player needs readable vertex data.
        var importer = AssetImporter.GetAtPath(Root + path) as ModelImporter;
        if (importer != null && !importer.isReadable) { importer.isReadable = true; importer.SaveAndReimport(); }
        foreach (var mesh in AssetDatabase.LoadAllAssetsAtPath(Root + path).OfType<Mesh>())
            if (AssetDatabase.TryGetGUIDAndLocalFileIdentifier(mesh, out string _, out long id) && id == localId) return mesh;
        throw new InvalidOperationException("Original ice mesh is missing: " + path + " / " + localId);
    }

    private static ParticleSystem Particles(Transform parent, string name, float lifetime, int count, Color color)
    {
        var go = new GameObject("WebIce_" + name) { layer = parent.gameObject.layer };
        go.transform.SetParent(parent, false);
        var particles = go.AddComponent<ParticleSystem>();
        particles.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
        particles.useAutoRandomSeed = false; particles.randomSeed = 73;
        var main = particles.main;
        main.duration = Mathf.Max(.1f, lifetime); main.loop = false; main.playOnAwake = true;
        main.startLifetime = lifetime; main.startSpeed = 0f; main.startSize = 1f; main.startColor = color;
        main.maxParticles = count; main.simulationSpace = ParticleSystemSimulationSpace.Local;
        main.scalingMode = ParticleSystemScalingMode.Hierarchy;
        main.cullingMode = ParticleSystemCullingMode.AlwaysSimulate;
        var emission = particles.emission; emission.rateOverTime = 0;
        emission.SetBursts(new[] { new ParticleSystem.Burst(0f, (short)count) });
        var shape = particles.shape; shape.enabled = false;
        var fade = particles.colorOverLifetime; fade.enabled = true;
        var gradient = new Gradient();
        gradient.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(Color.white, 1) },
            new[] { new GradientAlphaKey(0, 0), new GradientAlphaKey(1, .08f), new GradientAlphaKey(1, .65f), new GradientAlphaKey(0, 1) });
        fade.color = gradient;
        var renderer = particles.GetComponent<ParticleSystemRenderer>();
        renderer.shadowCastingMode = ShadowCastingMode.Off; renderer.receiveShadows = false;
        renderer.sortMode = ParticleSystemSortMode.Distance;
        renderer.maxParticleSize = 1f;
        renderer.SetActiveVertexStreams(new List<ParticleSystemVertexStream> {
            ParticleSystemVertexStream.Position, ParticleSystemVertexStream.Normal,
            ParticleSystemVertexStream.Color, ParticleSystemVertexStream.UV });
        return particles;
    }

    private static ParticleSystem MeshParticle(Transform parent, string name, Mesh mesh, Material material, float lifetime, float size, Vector3 angle, Color color)
    {
        var particles = Particles(parent, name, lifetime, 1, color);
        var main = particles.main; main.startSize = size;
        main.startRotation3D = true;
        main.startRotationX = angle.x * Mathf.Deg2Rad; main.startRotationY = angle.y * Mathf.Deg2Rad; main.startRotationZ = angle.z * Mathf.Deg2Rad;
        var renderer = particles.GetComponent<ParticleSystemRenderer>();
        renderer.renderMode = ParticleSystemRenderMode.Mesh; renderer.mesh = mesh;
        renderer.alignment = ParticleSystemRenderSpace.Local;
        renderer.sharedMaterial = material;
        return particles;
    }

    private static void Shards(Transform parent, Material material, int count, float lifetime, float speed, float size)
    {
        var particles = Particles(parent, "Shards", lifetime, count, Ice);
        var main = particles.main;
        main.startLifetime = new ParticleSystem.MinMaxCurve(lifetime * .5f, lifetime);
        main.startSpeed = new ParticleSystem.MinMaxCurve(speed * .4f, speed);
        main.startSize = new ParticleSystem.MinMaxCurve(size * .5f, size);
        main.startRotation3D = true;
        main.startRotationX = new ParticleSystem.MinMaxCurve(-Mathf.PI, Mathf.PI);
        main.startRotationY = new ParticleSystem.MinMaxCurve(-Mathf.PI, Mathf.PI);
        main.startRotationZ = new ParticleSystem.MinMaxCurve(-Mathf.PI, Mathf.PI);
        var shape = particles.shape; shape.enabled = true; shape.shapeType = ParticleSystemShapeType.Sphere; shape.radius = .2f;
        var renderer = particles.GetComponent<ParticleSystemRenderer>();
        renderer.renderMode = ParticleSystemRenderMode.Mesh;
        renderer.mesh = Mesh("Scenes/WorkScene/Work_Z/Icewall/bloc.fbx", -6503296336104585457L);
        float extent = Mathf.Max(renderer.mesh.bounds.size.x, renderer.mesh.bounds.size.y, renderer.mesh.bounds.size.z);
        main.startSize = new ParticleSystem.MinMaxCurve(size * .5f / extent, size / extent);
        renderer.sharedMaterial = material;
        Spin(particles, 120);
    }

    private static void Spin(ParticleSystem particles, float degrees)
    {
        var rotation = particles.rotationOverLifetime; rotation.enabled = true; rotation.separateAxes = true;
        rotation.y = degrees * Mathf.Deg2Rad;
    }

    private static Material IceMaterial(string name = "IceMesh", float arc = 0, float swirl = 0)
    {
        string path = Generated + name + ".mat";
        var material = AssetDatabase.LoadAssetAtPath<Material>(path);
        var shader = Shader.Find("Portfolio/WebIce");
        if (shader == null) throw new InvalidOperationException("Web ice shader is missing.");
        if (material == null) { material = new Material(shader); AssetDatabase.CreateAsset(material, path); }
        material.SetTexture("_IceTexture", AssetDatabase.LoadAssetAtPath<Texture2D>(Root + "Shaders/Ice2.png"));
        material.SetFloat("_Arc", arc); material.SetFloat("_Swirl", swirl);
        EditorUtility.SetDirty(material);
        return material;
    }

    private static Material ExplosionMaterial()
    {
        const string path = Generated + "IceExplosion.mat";
        var material = AssetDatabase.LoadAssetAtPath<Material>(path);
        var shader = Shader.Find("Portfolio/WebIceBlast");
        if (shader == null) throw new InvalidOperationException("Web ice explosion shader is missing.");
        if (material == null) { material = new Material(shader); AssetDatabase.CreateAsset(material, path); }
        material.shader = shader;
        var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(Root + "Texture/FireBall04_8x8.exr");
        if (texture == null) throw new InvalidOperationException("Original explosion flipbook is missing.");
        material.SetTexture("_IceTexture", texture);
        EditorUtility.SetDirty(material);
        return material;
    }
}
