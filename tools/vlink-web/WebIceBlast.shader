Shader "Portfolio/WebIceBlast"
{
    Properties { _IceTexture ("Explosion flipbook", 2D) = "white" {} }
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "Queue"="Transparent" "RenderType"="Transparent" }
        Pass
        {
            Tags { "LightMode"="UniversalForward" }
            Blend SrcAlpha One
            ZWrite Off
            Cull Off
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            TEXTURE2D(_IceTexture);
            SAMPLER(sampler_IceTexture);
            struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; half4 color : COLOR; };
            struct Varyings { float4 positionCS : SV_POSITION; float2 uv : TEXCOORD0; half4 color : COLOR; };
            Varyings Vert(Attributes input)
            {
                Varyings output;
                output.positionCS = TransformObjectToHClip(input.positionOS.xyz);
                output.uv = input.uv; output.color = input.color;
                return output;
            }
            half4 Frag(Varyings input) : SV_Target
            {
                half4 frame = SAMPLE_TEXTURE2D(_IceTexture, sampler_IceTexture, input.uv);
                // Keep the source flipbook's motion, without its baked warm fire tint.
                half density = max(frame.r, max(frame.g, frame.b));
                return half4(input.color.rgb * (1 + density), saturate(density * 3) * frame.a * input.color.a);
            }
            ENDHLSL
        }
    }
}
