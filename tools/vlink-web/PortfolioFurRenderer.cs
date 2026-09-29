using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

// Upload posed source vertices, not expanded geometry, so the original shader
// still performs world-space gravity/noise after skinning and object scaling.
[DisallowMultipleComponent]
[DefaultExecutionOrder(12000)] // VRM spring bones finish at order 11000.
public sealed class PortfolioFurRenderer : MonoBehaviour
{
    public SkinnedMeshRenderer source;
    public Material furMaterial;
    public int submesh;
    private Mesh baked, fins;
    private MeshRenderer draw;
    private ComputeBuffer buffer;
    private MaterialPropertyBlock properties;
    private Vertex[] data;
    private Vector2[] uv;
    private readonly List<Vector3> positions = new List<Vector3>();
    private readonly List<Vector3> normals = new List<Vector3>();
    private readonly List<Vector4> tangents = new List<Vector4>();
    private struct Vertex { public Vector4 position, normal, tangent, uv; }

    public int FinVertexCount => fins == null ? 0 : fins.vertexCount;

    public void Initialize()
    {
        if (buffer != null) return;
        if (source == null || source.sharedMesh == null || furMaterial == null)
            throw new InvalidOperationException("Missing original fur mesh/material.");
        if (furMaterial.GetFloat("_FurMeshType") != 1 || furMaterial.GetFloat("_VertexColor2FurVector") != 0)
            throw new InvalidOperationException("Unsupported fur geometry configuration.");
        int layers = Mathf.RoundToInt(furMaterial.GetFloat("_FurLayerNum"));
        if (layers < 1 || layers > 4) throw new InvalidOperationException("Unexpected fur layer count.");
        Mesh mesh = source.sharedMesh;
        uv = mesh.uv;
        data = new Vertex[mesh.vertexCount];
        baked = new Mesh { name = "Portfolio fur posed source" };
        baked.MarkDynamic();
        fins = CreateFins(mesh, submesh, layers);
        buffer = new ComputeBuffer(data.Length, 64, ComputeBufferType.Structured);
        properties = new MaterialPropertyBlock();
        var child = new GameObject("Original fur fins");
        child.layer = source.gameObject.layer;
        child.transform.SetParent(source.transform, false);
        child.AddComponent<MeshFilter>().sharedMesh = fins;
        draw = child.AddComponent<MeshRenderer>();
        draw.sharedMaterial = furMaterial;
        draw.shadowCastingMode = ShadowCastingMode.Off;
        draw.receiveShadows = source.receiveShadows;
        draw.lightProbeUsage = source.lightProbeUsage;
        draw.reflectionProbeUsage = source.reflectionProbeUsage;
        draw.probeAnchor = source.probeAnchor;
        draw.renderingLayerMask = source.renderingLayerMask;
        draw.sortingLayerID = source.sortingLayerID;
        draw.sortingOrder = source.sortingOrder;
        RefreshPose();
        Debug.Log("PORTFOLIO_FUR_READY: vertices=" + fins.vertexCount);
    }

    private static Mesh CreateFins(Mesh source, int submesh, int layers)
    {
        int[] triangles = source.GetTriangles(submesh);
        int count = triangles.Length / 3 * layers * 8;
        var positions = new Vector3[count];
        var controls = new Vector2[count];
        var sides = new Vector2[count];
        var ids = new List<Vector3>(count);
        var indices = new int[triangles.Length / 3 * layers * 18];
        int vertex = 0, index = 0;
        for (int triangle = 0; triangle < triangles.Length; triangle += 3)
        {
            var sourceIds = new Vector3(triangles[triangle], triangles[triangle + 1], triangles[triangle + 2]);
            for (int layer = 0; layer < layers; layer++)
            {
                int start = vertex;
                for (int corner = 0; corner < 4; corner++)
                    for (int side = 0; side < 2; side++, vertex++)
                    {
                        controls[vertex] = new Vector2(layer, corner);
                        sides[vertex] = new Vector2(side, 0);
                        ids.Add(sourceIds);
                    }
                // Preserve the original eight-vertex triangle strip and winding.
                for (int i = 0; i < 6; i++)
                {
                    indices[index++] = start + i + (i % 2);
                    indices[index++] = start + i + 1 - (i % 2);
                    indices[index++] = start + i + 2;
                }
            }
        }
        var mesh = new Mesh { name = "Portfolio original fur topology", indexFormat = IndexFormat.UInt32 };
        mesh.vertices = positions;
        mesh.uv = controls;
        mesh.uv2 = sides;
        mesh.SetUVs(2, ids);
        mesh.triangles = indices;
        mesh.bounds = source.bounds;
        return mesh;
    }

    public void RefreshPose()
    {
        if (buffer == null) return;
        draw.enabled = enabled && source.enabled && !source.forceRenderingOff;
        if (!draw.enabled) return;
        source.BakeMesh(baked, false);
        baked.GetVertices(positions);
        baked.GetNormals(normals);
        baked.GetTangents(tangents);
        if (positions.Count != data.Length || normals.Count != data.Length || tangents.Count != data.Length)
            throw new InvalidOperationException("Fur source vertex layout changed.");
        Vector3 scale = source.transform.lossyScale;
        float maxScale = Mathf.Max(Mathf.Abs(scale.x), Mathf.Abs(scale.y), Mathf.Abs(scale.z));
        float minScale = Mathf.Min(Mathf.Abs(scale.x), Mathf.Abs(scale.y), Mathf.Abs(scale.z));
        if (minScale < .000001f || maxScale - minScale > maxScale * .0001f)
            throw new InvalidOperationException("Review nonuniform fur source scaling.");
        // This model's CPU skinning retains the inherited model scale in both
        // positions and directions. Remove it before the mesh renderer applies
        // the original object-to-world matrix (selection uses a scale of 573).
        float inverseScale = 1 / maxScale;
        for (int i = 0; i < data.Length; i++)
            data[i] = new Vertex {
                position = new Vector4(positions[i].x * inverseScale, positions[i].y * inverseScale,
                    positions[i].z * inverseScale, 1),
                normal = normals[i] * inverseScale,
                tangent = new Vector4(tangents[i].x * inverseScale, tangents[i].y * inverseScale,
                    tangents[i].z * inverseScale, tangents[i].w),
                uv = new Vector4(uv[i].x, uv[i].y, 0, 0)
            };
        buffer.SetData(data);
        source.GetPropertyBlock(properties, submesh);
        if (properties.isEmpty) source.GetPropertyBlock(properties);
        properties.SetBuffer("_PortfolioFurSource", buffer);
        draw.SetPropertyBlock(properties);
        // Transparent sorting must use the same center as the source renderer.
        var bounds = source.bounds;
        bounds.Expand(Mathf.Abs(furMaterial.GetVector("_FurVector").w) * (maxScale + 1) * 4);
        draw.bounds = bounds;
        draw.gameObject.layer = source.gameObject.layer;
    }

    private void Start() => Initialize();
    private void LateUpdate() => RefreshPose();
    private void OnDisable() { if (draw != null) draw.enabled = false; }
    private void OnDestroy()
    {
        buffer?.Release();
        buffer = null;
        if (draw != null) DestroyOwned(draw.gameObject);
        if (baked != null) DestroyOwned(baked);
        if (fins != null) DestroyOwned(fins);
    }
    private static void DestroyOwned(UnityEngine.Object value)
    {
        if (Application.isPlaying) Destroy(value); else DestroyImmediate(value);
    }
}
