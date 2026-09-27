Shader "BugHunter/Leaves"
{
    Properties { _MainTex ("Leaf spray",2D)="white" {} _Cutoff ("Cutoff",Range(0,1))=.45 }
    SubShader
    {
        Tags { "Queue"="AlphaTest" "RenderType"="TransparentCutout" }
        Cull Off
        CGPROGRAM
        #pragma surface surf Lambert alphatest:_Cutoff addshadow vertex:vert
        #pragma target 3.0
        sampler2D _MainTex;
        struct Input { float2 uv_MainTex; fixed4 color:COLOR; };
        void vert(inout appdata_full v,out Input o)
        {
            UNITY_INITIALIZE_OUTPUT(Input,o);o.color=v.color;
            float3 world=mul(unity_ObjectToWorld,v.vertex).xyz;
            v.vertex.x+=sin(world.x*.4+world.z*.3+_Time.y*.8)*.065*v.texcoord.y;
            v.vertex.z+=cos(world.x*.3+_Time.y*.7)*.04*v.texcoord.y;
        }
        void surf(Input IN,inout SurfaceOutput o)
        {
            fixed4 c=tex2D(_MainTex,IN.uv_MainTex)*IN.color;
            o.Albedo=c.rgb*.8;o.Emission=c.rgb*.2;o.Alpha=c.a;
        }
        ENDCG
    }
    FallBack "Transparent/Cutout/Diffuse"
}
