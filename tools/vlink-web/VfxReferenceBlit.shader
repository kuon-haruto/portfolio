Shader "Hidden/Portfolio/VfxReferenceBlit"
{
    Properties { _MainTex ("Reference", 2D) = "white" {} }
    SubShader
    {
        Tags { "Queue" = "Overlay" }
        Pass
        {
            Cull Off ZWrite Off ZTest Always Blend Off
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            sampler2D _MainTex;
            struct Input { float4 vertex : POSITION; float2 uv : TEXCOORD0; };
            struct Output { float4 vertex : SV_POSITION; float2 uv : TEXCOORD0; };
            Output vert(Input input)
            {
                Output output;
                output.vertex = UnityObjectToClipPos(input.vertex);
                output.uv = input.uv;
                return output;
            }
            float4 frag(Output input) : SV_Target { return float4(tex2D(_MainTex, input.uv).rgb, 1); }
            ENDHLSL
        }
    }
}
