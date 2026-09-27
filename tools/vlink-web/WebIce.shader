Shader "Portfolio/WebIce"
{
    Properties
    {
        _IceTexture ("Ice texture", 2D) = "white" {}
        _BaseColor ("Tint", Color) = (1,1,1,1)
        _Arc ("Slash arc", Range(0,1)) = 0
        _Swirl ("Storm ribbons", Range(0,1)) = 0
    }
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "Queue"="Transparent" "RenderType"="Transparent" }
        Pass
        {
            Tags { "LightMode"="UniversalForward" }
            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite Off
            Cull Off
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            TEXTURE2D(_IceTexture);
            SAMPLER(sampler_IceTexture);
            CBUFFER_START(UnityPerMaterial)
                float4 _IceTexture_ST;
                half4 _BaseColor;
                half _Arc;
                half _Swirl;
            CBUFFER_END
            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; float2 uv : TEXCOORD0; half4 color : COLOR; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 normalWS : TEXCOORD0; float3 positionWS : TEXCOORD1; float2 uv : TEXCOORD2; float2 arcPosition : TEXCOORD3; half4 color : COLOR; };
            Varyings Vert(Attributes input)
            {
                Varyings output;
                output.positionWS = TransformObjectToWorld(input.positionOS.xyz);
                output.positionCS = TransformWorldToHClip(output.positionWS);
                output.normalWS = TransformObjectToWorldNormal(input.normalOS);
                output.uv = TRANSFORM_TEX(input.uv, _IceTexture);
                output.color = input.color * _BaseColor;
                output.arcPosition = input.positionOS.xy;
                return output;
            }
            half4 Frag(Varyings input) : SV_Target
            {
                half3 normal = normalize(input.normalWS);
                half3 view = normalize(GetWorldSpaceViewDir(input.positionWS));
                half rim = pow(1 - abs(dot(normal, view)), 3);
                half facet = .5h + .5h * abs(dot(normal, normalize(half3(.4h, .8h, -.3h))));
                half frost = SAMPLE_TEXTURE2D(_IceTexture, sampler_IceTexture, input.uv).r;
                half3 color = input.color.rgb * (facet * (.65h + .35h * frost));
                color += half3(.18h, .55h, .7h) * rim;
                half angle = atan2(input.arcPosition.y, input.arcPosition.x) / 6.2831853h + .5h;
                half arc = smoothstep(.06h, .2h, angle) * (1 - smoothstep(.68h, .88h, angle));
                half ribbon = smoothstep(.25h, .65h, .5h + .5h * sin((input.uv.y * 4 + input.uv.x - _Time.y * 2) * 6.2831853h));
                half alpha = input.color.a * lerp(1, arc, _Arc) * lerp(1, ribbon, _Swirl);
                return half4(color, alpha);
            }
            ENDHLSL
        }
    }
}
