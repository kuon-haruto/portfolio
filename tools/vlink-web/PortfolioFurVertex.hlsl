// Adapted from lilToon (MIT); see FUR-LICENSE.txt.
// Fin topology replaces the geometry stage; the original lilToon vertex/fragment
// functions still calculate skin-space direction, lighting, noise and coverage.
struct PortfolioFurSource
{
    float4 position;
    float4 normal;
    float4 tangent;
    float4 uv;
};
StructuredBuffer<PortfolioFurSource> _PortfolioFurSource;

struct PortfolioFinInput
{
    float4 position : POSITION;
    float2 layerCorner : TEXCOORD0;
    float2 side : TEXCOORD1;
    float3 indices : TEXCOORD2;
};

v2g PortfolioReadFurVertex(uint index)
{
    PortfolioFurSource source = _PortfolioFurSource[index];
    appdata data;
    LIL_INITIALIZE_STRUCT(appdata, data);
    data.positionOS = source.position;
    data.normalOS = source.normal.xyz;
    data.tangentOS = source.tangent;
    data.uv0 = source.uv.xy;
    data.vertexID = index;
    return PortfolioSourceVertex(data);
}

v2f PortfolioFinVertex(PortfolioFinInput mesh)
{
    v2f output;
    LIL_INITIALIZE_STRUCT(v2f, output);
    if (_Invisible) return output;
    v2g input[3];
    input[0] = PortfolioReadFurVertex((uint)mesh.indices.x);
    input[1] = PortfolioReadFurVertex((uint)mesh.indices.y);
    input[2] = PortfolioReadFurVertex((uint)mesh.indices.z);
    uint fl = (uint)mesh.layerCorner.x;
    uint ii = (uint)mesh.layerCorner.y;
    uint ii2 = ii == 3 ? 0 : ii;
    float lpmix = fl / (float)_FurLayerNum;
    float3 wpc = (input[0].positionWS + input[1].positionWS + input[2].positionWS) * 0.333333333333;
    float3 fvc = (input[0].furVector + input[1].furVector + input[2].furVector) * 0.333333333333;
    float3 ndc = (input[0].normalWS + input[1].normalWS + input[2].normalWS) * 0.333333333333;
    float2 uv0c = (input[0].uv0 + input[1].uv0 + input[2].uv0) * 0.333333333333;
    float2 outUV = lerp(input[ii2].uv0, uv0c, lpmix);
    output.uv0 = outUV;
    output.normalWS = lerp(input[ii2].normalWS, ndc, lpmix);
    #if defined(LIL_V2G_LIGHTCOLOR)
        output.lightColor = input[0].lightColor;
    #endif
    #if defined(LIL_V2G_LIGHTDIRECTION)
        output.lightDirection = input[0].lightDirection;
    #endif
    #if defined(LIL_V2G_INDLIGHTCOLOR)
        output.indLightColor = input[0].indLightColor;
    #endif
    #if defined(LIL_V2G_VERTEXLIGHT_FOG)
        LIL_VERTEXLIGHT_FOG_TYPE vlfc = (input[0].vlf + input[1].vlf + input[2].vlf) * 0.333333333333;
        output.vlf = lerp(input[ii2].vlf, vlfc, lpmix);
    #endif
    float3 positionWS = lerp(input[ii2].positionWS, wpc, lpmix);
    if (mesh.side.x > 0.5)
    {
        float3 fvmix = lerp(input[ii2].furVector, fvc, lpmix);
        uint3 n0 = (input[0].vertexID * input[1].vertexID * input[2].vertexID + (fl * 439853 + ii * 364273 + 1)) * uint3(1597334677U, 3812015801U, 2912667907U);
        float3 noise0 = normalize(float3(n0) * (2.0 / float(0xffffffffU)) - 1.0);
        fvmix += noise0 * _FurVector.w * _FurRandomize;
        #if defined(LIL_FEATURE_FurLengthMask)
            fvmix *= LIL_SAMPLE_2D_LOD(_FurLengthMask, lil_sampler_linear_repeat, outUV * _MainTex_ST.xy + _MainTex_ST.zw, 0).r;
        #endif
        positionWS += fvmix;
    }
    output.positionWS = positionWS;
    output.positionCS = lilTransformWStoCS(positionWS);
    output.furLayer = mesh.side.x;
    return output;
}
