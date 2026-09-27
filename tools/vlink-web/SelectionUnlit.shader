Shader "Portfolio/VLink/SelectionUnlit"
{
    Properties
    {
        [MainTexture] _BaseMap("Texture", 2D) = "white" {}
        [MainColor] _BaseColor("Color", Color) = (1, 1, 1, 1)
        _Cutoff("Alpha Cutoff", Range(0, 1)) = 0.5
        _Surface("Surface", Float) = 0
        _Cull("Cull", Float) = 2
        _SrcBlend("Source Blend", Float) = 1
        _DstBlend("Destination Blend", Float) = 0
        _SrcBlendAlpha("Source Alpha Blend", Float) = 1
        _DstBlendAlpha("Destination Alpha Blend", Float) = 0
        _ZWrite("Depth Write", Float) = 1
        _ZTest("Depth Test", Float) = 4
        _AlphaToMask("Alpha To Coverage", Float) = 0
        _StencilRef("Stencil Reference", Float) = 0
        _StencilReadMask("Stencil Read Mask", Float) = 255
        _StencilWriteMask("Stencil Write Mask", Float) = 255
        _StencilComp("Stencil Comparison", Float) = 8
        _StencilPass("Stencil Pass", Float) = 0
        _StencilFail("Stencil Fail", Float) = 0
        _StencilZFail("Stencil Depth Fail", Float) = 0
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "UniversalMaterialType"="Unlit" }
        Blend [_SrcBlend] [_DstBlend], [_SrcBlendAlpha] [_DstBlendAlpha]
        ZWrite [_ZWrite]
        ZTest [_ZTest]
        Cull [_Cull]
        Pass
        {
            Name "SelectionUnlit"
            Tags { "LightMode"="SRPDefaultUnlit" }
            // Match URP's existing Web fallback, but keep the selection mask.
            Stencil
            {
                Ref [_StencilRef]
                ReadMask [_StencilReadMask]
                WriteMask [_StencilWriteMask]
                Comp [_StencilComp]
                Pass [_StencilPass]
                Fail [_StencilFail]
                ZFail [_StencilZFail]
            }
            AlphaToMask [_AlphaToMask]
            HLSLPROGRAM
            #pragma target 3.0
            #pragma vertex UnlitPassVertex
            #pragma fragment UnlitPassFragment
            #pragma shader_feature_local_fragment _SURFACE_TYPE_TRANSPARENT
            #pragma shader_feature_local_fragment _ALPHATEST_ON
            #pragma shader_feature_local_fragment _ALPHAMODULATE_ON
            #pragma multi_compile_fog
            #pragma multi_compile_fragment _ _SCREEN_SPACE_OCCLUSION
            #pragma multi_compile_instancing
            #include "Packages/com.unity.render-pipelines.universal/Shaders/UnlitInput.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/Shaders/UnlitForwardPass.hlsl"
            ENDHLSL
        }
        UsePass "Universal Render Pipeline/Unlit/DepthOnly"
        UsePass "Universal Render Pipeline/Unlit/DepthNormalsOnly"
    }
    Fallback Off
}
