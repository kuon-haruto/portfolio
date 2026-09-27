Shader "BugHunter/Woodland"
{
    Properties { _Color ("Tint", Color) = (1,1,1,1) }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        Pass
        {
            Tags { "LightMode"="ForwardBase" }
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog
            #pragma multi_compile_instancing
            #include "UnityCG.cginc"
            #include "Lighting.cginc"
            struct appdata { float4 vertex : POSITION; float3 normal : NORMAL; fixed4 color : COLOR; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct v2f { float4 pos : SV_POSITION; fixed4 color : COLOR; float3 normal : TEXCOORD0; UNITY_FOG_COORDS(1) };
            fixed4 _Color;
            v2f vert(appdata v)
            {
                UNITY_SETUP_INSTANCE_ID(v);
                v2f o; o.pos = UnityObjectToClipPos(v.vertex);
                o.normal = UnityObjectToWorldNormal(v.normal);
                o.color = v.color * _Color;
                UNITY_TRANSFER_FOG(o, o.pos);
                return o;
            }
            fixed4 frag(v2f i) : SV_Target
            {
                float d = dot(normalize(i.normal), normalize(_WorldSpaceLightPos0.xyz));
                float shade = d > .45 ? 1.08 : d > -.12 ? .85 : .64;
                fixed4 color = fixed4(i.color.rgb * shade, 1);
                UNITY_APPLY_FOG(i.fogCoord, color);
                return color;
            }
            ENDCG
        }
    }
}
