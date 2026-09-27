Shader "BugHunter/ForestSurface"
{
    Properties
    {
        _MainTex ("Surface", 2D) = "white" {}
        _PathTex ("Trail",2D) = "white" {}
        _UsePath ("Blend trail",Float) = 0
        _Scale ("World scale", Float) = .4
        _Tint ("Tint", Color) = (1,1,1,1)
        _Glossiness ("Smoothness", Range(0,1)) = .08
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        LOD 200
        Cull Off
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows vertex:vert
        #pragma target 3.0
        sampler2D _MainTex,_PathTex;
        float _Scale, _Glossiness,_UsePath;
        fixed4 _Tint;
        struct Input { float3 worldPos; float3 worldNormal; fixed4 color:COLOR; };
        void vert(inout appdata_full v, out Input o) { UNITY_INITIALIZE_OUTPUT(Input,o); o.color=v.color; }
        void surf(Input IN, inout SurfaceOutputStandard o)
        {
            float3 blend=pow(abs(IN.worldNormal),4);
            blend/=max(.001,blend.x+blend.y+blend.z);
            fixed3 tx=tex2D(_MainTex,IN.worldPos.zy*_Scale).rgb;
            fixed3 ty=tex2D(_MainTex,IN.worldPos.xz*_Scale).rgb;
            fixed3 tz=tex2D(_MainTex,IN.worldPos.xy*_Scale).rgb;
            fixed3 baseColor=tx*blend.x+ty*blend.y+tz*blend.z;
            baseColor=lerp(baseColor,tex2D(_PathTex,IN.worldPos.xz*_Scale).rgb,_UsePath*(1-IN.color.a));
            o.Albedo=baseColor*IN.color.rgb*_Tint.rgb;
            o.Smoothness=_Glossiness; o.Metallic=0; o.Alpha=1;
        }
        ENDCG
    }
    FallBack "Diffuse"
}
