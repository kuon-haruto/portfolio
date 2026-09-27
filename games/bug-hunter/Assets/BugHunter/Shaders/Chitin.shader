Shader "BugHunter/Chitin"
{
    Properties { _Glossiness("Shell smoothness",Range(0,1))=.56 }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows vertex:vert addshadow
        #pragma target 3.0
        float _Glossiness;
        struct Input { fixed4 color:COLOR; float3 worldPos; };
        void vert(inout appdata_full v,out Input o){UNITY_INITIALIZE_OUTPUT(Input,o);o.color=v.color;}
        void surf(Input IN,inout SurfaceOutputStandard o)
        {
            float grain=sin(IN.worldPos.x*170)*sin(IN.worldPos.z*193)*sin(IN.worldPos.y*181);
            o.Albedo=IN.color.rgb*(.97+grain*.03);o.Metallic=.12;o.Smoothness=_Glossiness+grain*.025;o.Occlusion=.96;o.Alpha=1;
        }
        ENDCG
    }
    FallBack "Diffuse"
}
