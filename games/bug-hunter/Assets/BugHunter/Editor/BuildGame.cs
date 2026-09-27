using System;
using System.IO;
using System.Linq;
using BugHunter;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using UnityEngine;

public static class BuildGame
{
    const string Root="Assets/BugHunter";
    [MenuItem("Bug Hunter/Create initial content")]
    public static void Setup()
    {
        if(File.Exists(Root+"/Scenes/Woodland.unity"))return;
        Directory.CreateDirectory(Root+"/Generated");Directory.CreateDirectory(Root+"/Species");Directory.CreateDirectory(Root+"/Scenes");AssetDatabase.Refresh();
        var mat=new Material(Shader.Find("BugHunter/Woodland")){name="Woodland",enableInstancing=true};AssetDatabase.CreateAsset(mat,Root+"/Generated/Woodland.mat");
        string[] names={"カブトムシ","クワガタ","カマキリ","バッタ","トンボ","テントウムシ"};
        string[] skills={"ホーンリフト","はさみ投げ","れんぞく斬り","ジャンプキック","急降下","ころがり突進"};
        string[] habitats={"雑木林","雑木林","草原","草原","水辺","草原"};
        Color[] colors={new Color(.42f,.24f,.58f),new Color(.14f,.51f,.63f),new Color(.36f,.7f,.29f),new Color(.8f,.64f,.16f),new Color(.19f,.65f,.8f),new Color(.94f,.3f,.27f)};
        int[,] stats={{120,23,14,9},{112,21,16,11},{93,25,9,17},{98,18,10,22},{86,19,9,24},{126,16,22,10}};
        var species=new Species[6];
        for(int i=0;i<6;i++)
        {
            var root=new GameObject(names[i]);var view=root.AddComponent<BugView>();
            Mesh body=Geometry.Insect(i,colors[i]).Mesh(names[i]+" body");AssetDatabase.CreateAsset(body,Root+"/Generated/Body"+i+".asset");
            Geometry.Object("Body",body,mat,root.transform);
            for(int s=-1;s<=1;s+=2)
            {
                Mesh mesh=Geometry.Legs(i,s,colors[i]).Mesh("Legs");AssetDatabase.CreateAsset(mesh,Root+"/Generated/Legs"+i+"_"+s+".asset");
                var leg=Geometry.Object(s<0?"Left legs":"Right legs",mesh,mat,root.transform);
                if(s<0)view.left=leg.transform;else view.right=leg.transform;
            }
            if(i==4)
            {
                var wings=new Geometry();for(int s=-1;s<=1;s+=2)for(int n=0;n<2;n++)
                    wings.Oval(new Vector3(s*.68f,.57f,-.05f+n*.35f),new Vector3(1.1f,.045f,.27f),new Color(.8f,.95f,.99f),8,4,Quaternion.Euler(0,s*(n==0?20:-20),0));
                Mesh mesh=wings.Mesh("Wings");AssetDatabase.CreateAsset(mesh,Root+"/Generated/Wings.asset");view.wings=Geometry.Object("Wings",mesh,mat,root.transform).transform;
            }
            var prefab=PrefabUtility.SaveAsPrefabAsset(root,Root+"/Generated/Bug"+i+".prefab");UnityEngine.Object.DestroyImmediate(root);
            var data=ScriptableObject.CreateInstance<Species>();data.id=i;data.displayName=names[i];data.skill=skills[i];data.habitat=habitats[i];
            data.type=i==0||i==2?BugType.Power:i==1||i==5?BugType.Guard:BugType.Speed;data.shell=colors[i];data.model=prefab;
            data.health=stats[i,0];data.attack=stats[i,1];data.defense=stats[i,2];data.speed=stats[i,3];
            data.growth=new[]{5+i%2,data.type==BugType.Power?3:2,data.type==BugType.Guard?3:2,data.type==BugType.Speed?3:2};
            data.capture=i==0?.76f:i==4?.58f:.68f;
            AssetDatabase.CreateAsset(data,Root+"/Species/"+i+".asset");species[i]=data;
        }
        var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
        var game=new GameObject("BugHunter",typeof(Game)).GetComponent<Game>();game.catalog=species;game.woodland=mat;
        game.font=AssetDatabase.LoadAssetAtPath<Font>(Root+"/Fonts/WoodlandJP.otf");
        if(!game.font)throw new Exception("Japanese font is missing");
        game.icon=AssetDatabase.LoadAssetAtPath<Texture2D>(Root+"/Art/bug-hunter.png");
        var importer=(TextureImporter)AssetImporter.GetAtPath(Root+"/Art/bug-hunter.png");importer.maxTextureSize=512;importer.mipmapEnabled=false;importer.textureCompression=TextureImporterCompression.Compressed;importer.SaveAndReimport();
        EditorSceneManager.SaveScene(scene,Root+"/Scenes/Woodland.unity");
        EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(Root+"/Scenes/Woodland.unity",true)};
        PlayerSettings.companyName="Zenta Shimamoto";PlayerSettings.productName="Bug Hunter";PlayerSettings.bundleVersion="0.1.0";
        PlayerSettings.defaultScreenWidth=1280;PlayerSettings.defaultScreenHeight=720;PlayerSettings.runInBackground=false;
        PlayerSettings.colorSpace=ColorSpace.Gamma;PlayerSettings.SetIconsForTargetGroup(BuildTargetGroup.Unknown,new[]{game.icon});
        PlayerSettings.WebGL.initialMemorySize=64;PlayerSettings.WebGL.maximumMemorySize=256;
        PlayerSettings.WebGL.memoryGrowthMode=WebGLMemoryGrowthMode.Linear;PlayerSettings.WebGL.linearMemoryGrowthStep=16;
        PlayerSettings.WebGL.compressionFormat=WebGLCompressionFormat.Gzip;PlayerSettings.WebGL.decompressionFallback=true;
        PlayerSettings.WebGL.dataCaching=true;PlayerSettings.WebGL.nameFilesAsHashes=true;
        PlayerSettings.WebGL.template="APPLICATION:Minimal";
        QualitySettings.antiAliasing=2;QualitySettings.shadows=ShadowQuality.Disable;QualitySettings.vSyncCount=0;
        AssetDatabase.SaveAssets();Debug.Log("BUG_HUNTER_SETUP_OK");
    }
    public static void Validate()
    {
        Setup();EnvironmentAssets();var data=Enumerable.Range(0,6).Select(i=>AssetDatabase.LoadAssetAtPath<Species>(Root+"/Species/"+i+".asset")).ToArray();
        DomainTests.Run(data);Debug.Log("BUG_HUNTER_VALIDATION_OK");
    }
    static void EnvironmentAssets()
    {
        AssetDatabase.Refresh();
        foreach(string name in new[]{"Ground","Trail","Bark"})
        {
            var importer=(TextureImporter)AssetImporter.GetAtPath(Root+"/Resources/Environment/"+name+".jpg");
            if(importer==null)throw new Exception("Run tools/prepare-bug-hunter-art.cjs first");
            importer.maxTextureSize=1024;importer.mipmapEnabled=true;importer.wrapMode=TextureWrapMode.Repeat;
            importer.textureCompression=TextureImporterCompression.Compressed;importer.anisoLevel=4;importer.SaveAndReimport();
        }
        foreach(string path in Directory.GetFiles(Root+"/Resources/UI","*.png"))
        {
            var importer=(TextureImporter)AssetImporter.GetAtPath(path.Replace('\\','/'));
            importer.textureType=TextureImporterType.Sprite;importer.spriteImportMode=SpriteImportMode.Single;importer.mipmapEnabled=false;
            importer.alphaIsTransparency=true;importer.maxTextureSize=128;importer.textureCompression=TextureImporterCompression.Uncompressed;importer.SaveAndReimport();
        }
        Surface("Soil","Ground",.45f,.04f);
        var soil=AssetDatabase.LoadAssetAtPath<Material>(Root+"/Resources/Environment/Soil.mat");soil.SetTexture("_PathTex",AssetDatabase.LoadAssetAtPath<Texture2D>(Root+"/Resources/Environment/Trail.jpg"));soil.SetFloat("_UsePath",1);EditorUtility.SetDirty(soil);
        Surface("Trunk","Bark",.7f,.08f);
        Surface("Rock","Trail",.7f,.04f);
        Surface("Foliage",null,1,.12f);
        Surface("Water",null,1,.82f);
        var leavesImport=(TextureImporter)AssetImporter.GetAtPath(Root+"/Resources/Environment/OakLeaves.png");
        leavesImport.maxTextureSize=1024;leavesImport.alphaIsTransparency=true;leavesImport.mipmapEnabled=true;leavesImport.mipMapsPreserveCoverage=true;leavesImport.alphaTestReferenceValue=.45f;
        leavesImport.textureCompression=TextureImporterCompression.Compressed;leavesImport.SaveAndReimport();
        string leafPath=Root+"/Resources/Environment/Leaves.mat";var leaves=AssetDatabase.LoadAssetAtPath<Material>(leafPath);
        if(!leaves){leaves=new Material(Shader.Find("BugHunter/Leaves"));AssetDatabase.CreateAsset(leaves,leafPath);}
        leaves.mainTexture=AssetDatabase.LoadAssetAtPath<Texture2D>(Root+"/Resources/Environment/OakLeaves.png");EditorUtility.SetDirty(leaves);
        var fernImport=(TextureImporter)AssetImporter.GetAtPath(Root+"/Resources/Environment/Fern.png");
        fernImport.maxTextureSize=512;fernImport.alphaIsTransparency=true;fernImport.mipmapEnabled=true;fernImport.mipMapsPreserveCoverage=true;fernImport.alphaTestReferenceValue=.45f;
        fernImport.textureCompression=TextureImporterCompression.Compressed;fernImport.SaveAndReimport();
        string fernPath=Root+"/Resources/Environment/Ferns.mat";var fern=AssetDatabase.LoadAssetAtPath<Material>(fernPath);
        if(!fern){fern=new Material(Shader.Find("BugHunter/Leaves"));AssetDatabase.CreateAsset(fern,fernPath);}
        fern.mainTexture=AssetDatabase.LoadAssetAtPath<Texture2D>(Root+"/Resources/Environment/Fern.png");EditorUtility.SetDirty(fern);
        string skyPath=Root+"/Resources/Environment/Sky.mat";
        var sky=AssetDatabase.LoadAssetAtPath<Material>(skyPath);
        if(!sky){sky=new Material(Shader.Find("Skybox/Procedural"));AssetDatabase.CreateAsset(sky,skyPath);}
        sky.SetColor("_SkyTint",new Color(.61f,.69f,.72f));sky.SetFloat("_AtmosphereThickness",.9f);sky.SetFloat("_Exposure",1.1f);
        sky.SetColor("_GroundColor",new Color(.53f,.64f,.61f));
        EditorUtility.SetDirty(sky);PlayerSettings.bundleVersion="0.2.0";
        QualitySettings.shadows=ShadowQuality.HardOnly;QualitySettings.shadowResolution=ShadowResolution.Medium;
        QualitySettings.shadowDistance=22;QualitySettings.shadowCascades=0;
        AssetDatabase.SaveAssets();
    }
    static void Surface(string name,string texture,float scale,float gloss)
    {
        string path=Root+"/Resources/Environment/"+name+".mat";
        var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
        if(!mat){mat=new Material(Shader.Find("BugHunter/ForestSurface"));AssetDatabase.CreateAsset(mat,path);}
        if(texture!=null)mat.mainTexture=AssetDatabase.LoadAssetAtPath<Texture2D>(Root+"/Resources/Environment/"+texture+".jpg");
        mat.SetFloat("_Scale",scale);mat.SetFloat("_Glossiness",gloss);EditorUtility.SetDirty(mat);
    }
    [MenuItem("Bug Hunter/Build Web")]
    public static void Web()
    {
        Validate();string output=Environment.GetEnvironmentVariable("BUG_HUNTER_BUILD");
        if(string.IsNullOrEmpty(output))output="Builds/Web";
        var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions {scenes=EditorBuildSettings.scenes.Where(s=>s.enabled).Select(s=>s.path).ToArray(),locationPathName=output,target=BuildTarget.WebGL,options=BuildOptions.None});
        if(report.summary.result!=BuildResult.Succeeded)throw new Exception("Build failed: "+report.summary.result);
        Debug.Log("BUG_HUNTER_WEB_OK bytes="+report.summary.totalSize);
    }
}
