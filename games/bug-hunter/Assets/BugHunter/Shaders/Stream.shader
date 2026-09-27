Shader "BugHunter/Stream"
{
    Properties { _Color("Deep water",Color)=(.12,.32,.29,.8) }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" }
        ZWrite Off
        Cull Off
        CGPROGRAM
        #pragma surface surf Standard alpha:fade vertex:vert fullforwardshadows
        #pragma target 3.0
        fixed4 _Color;
        struct Input { float3 worldPos; float2 streamUV; };
        void vert(inout appdata_full v,out Input o)
        {
            UNITY_INITIALIZE_OUTPUT(Input,o);o.streamUV=v.texcoord.xy;
            v.vertex.y+=sin(v.vertex.z*3.1+_Time.y*1.6)*.009+sin(v.vertex.x*5.2-v.vertex.z*1.9+_Time.y)*.006;
        }
        void surf(Input IN,inout SurfaceOutputStandard o)
        {
            float2 p=IN.worldPos.xz;
            float a=sin(p.x*7.1+p.y*3.7+_Time.y*2.3),b=sin(p.x*3.3-p.y*8.2+_Time.y*3.6);
            o.Normal=normalize(float3(a*.12,b*.10,1));
            float ripple=pow(saturate(sin(p.y*14+p.x*4+_Time.y*2.6)*.5+.5),24);
            float bank=pow(abs(IN.streamUV.x-.5)*2,10);
            o.Albedo=lerp(_Color.rgb,float3(.58,.69,.6),ripple*.10+bank*.15);
            o.Emission=float3(.16,.22,.2)*ripple*.09;
            o.Metallic=.3;o.Smoothness=.91;o.Alpha=.72+bank*.10;
        }
        ENDCG
    }
    FallBack "Transparent/Diffuse"
}
