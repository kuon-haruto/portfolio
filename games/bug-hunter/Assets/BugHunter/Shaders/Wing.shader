Shader "BugHunter/Wing"
{
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" }
        Cull Off
        ZWrite Off
        CGPROGRAM
        #pragma surface surf Standard alpha:fade vertex:vert
        #pragma target 3.0
        struct Input { fixed4 color:COLOR; };
        void vert(inout appdata_full v,out Input o){UNITY_INITIALIZE_OUTPUT(Input,o);o.color=v.color;}
        void surf(Input IN,inout SurfaceOutputStandard o)
        {o.Albedo=IN.color.rgb;o.Metallic=.15;o.Smoothness=.72;o.Alpha=IN.color.a;}
        ENDCG
    }
    FallBack "Transparent/Diffuse"
}
