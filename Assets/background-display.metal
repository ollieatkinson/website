#include <metal_stdlib>
using namespace metal;

struct Params {
    uint width;
    uint height;
    uint generation;
    uint seed;
    float2 pointer;
    uint stir;
    uint cellSize;
};

fragment float4 fs_main(float4 pos [[position]],
                       const device uint* cells [[buffer(0)]],
                       constant Params& u [[buffer(1)]]) {
    uint x = min(uint(pos.x / float(u.cellSize)), u.width - 1u);
    uint y = min(uint(pos.y / float(u.cellSize)), u.height - 1u);
    uint state = cells[y * u.width + x];
    uint life = state & 1u;
    uint pascal = state & 2u;
    uint firing = state & 4u;
    uint refractory = state & 8u;
    float ember = float(state >> 4u) / 31.0;
    float3 ink = float3(0.063, 0.082, 0.078);
    float3 color = mix(ink, float3(0.18, 0.25, 0.21), ember * 0.65);
    if (pascal != 0u) { color = float3(0.31, 0.29, 0.20); }
    if (life != 0u) { color = float3(0.34, 0.43, 0.30); }
    if (refractory != 0u) { color = float3(0.19, 0.29, 0.32); }
    if (firing != 0u) { color = float3(0.40, 0.55, 0.57); }
    float2 local = fmod(pos.xy, float2(float(u.cellSize)));
    if (local.x < 1.0 || local.y < 1.0) { color = ink; }
    return float4(color, 1.0);
}
