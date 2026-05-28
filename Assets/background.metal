#include <metal_stdlib>
using namespace metal;

struct Uniforms {
    float time;
    float width;
    float height;
    float pointerX;
    float pointerY;
    float pointerEnergy;
    float pad0;
    float pad1;
};

vertex float4 vertexMain(uint vid [[vertex_id]]) {
    if (vid == 0) {
        return float4(-1.0, -1.0, 0.0, 1.0);
    } else if (vid == 1) {
        return float4(3.0, -1.0, 0.0, 1.0);
    }

    return float4(-1.0, 3.0, 0.0, 1.0);
}

float hash21(float2 p) {
    float h = dot(p, float2(127.1, 311.7));
    return fract(sin(h) * 43758.5453123);
}

float valueNoise(float2 p) {
    float2 cell = floor(p);
    float2 local = fract(p);
    float2 u = local * local * (3.0 - 2.0 * local);
    float a = hash21(cell);
    float b = hash21(cell + float2(1.0, 0.0));
    float c = hash21(cell + float2(0.0, 1.0));
    float d = hash21(cell + float2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float3 palette(float x) {
    float h = fract(x);
    float3 cyan = float3(0.04, 0.92, 0.78);
    float3 blue = float3(0.12, 0.34, 1.00);
    float3 magenta = float3(1.00, 0.16, 0.64);
    float3 lemon = float3(1.00, 0.88, 0.22);
    float y = h * 4.0;

    if (y < 1.0) {
        return mix(cyan, blue, smoothstep(0.0, 1.0, y));
    } else if (y < 2.0) {
        return mix(blue, magenta, smoothstep(1.0, 2.0, y));
    } else if (y < 3.0) {
        return mix(magenta, lemon, smoothstep(2.0, 3.0, y));
    }

    return mix(lemon, cyan, smoothstep(3.0, 4.0, y));
}

fragment float4 fragmentMain(float4 pos [[position]], constant Uniforms& uniforms [[buffer(0)]]) {
    float2 resolution = float2(uniforms.width, uniforms.height);
    float2 uv = pos.xy / max(resolution, float2(1.0));
    float aspect = resolution.x / max(resolution.y, 1.0);
    float2 p = uv * 2.0 - float2(1.0);
    p.x *= aspect;

    float2 pointer = float2(uniforms.pointerX * 2.0 - 1.0, 1.0 - uniforms.pointerY * 2.0);
    pointer.x *= aspect;
    float t = uniforms.time;
    float2 pointerVector = p - pointer;
    float pointerDistance = length(pointerVector);
    float wake = exp(-pointerDistance * pointerDistance * 2.7) * uniforms.pointerEnergy;
    float2 swirl = float2(-pointerVector.y, pointerVector.x) * wake * 0.16;
    p = p + swirl + pointerVector * wake * 0.05;

    float slow = t * 0.18;
    float2 drift = float2(
        valueNoise(p * 1.1 + float2(slow, 0.0)),
        valueNoise(p * 1.1 + float2(8.0, slow * 0.7))
    ) - float2(0.5);
    p += drift * 0.22;

    float density = 0.0;
    float3 colorMix = float3(0.0);

    for (int i = 0; i < 14; i = i + 1) {
        float fi = float(i);
        float lane = hash21(float2(fi, fi * 2.31));
        float phase = hash21(float2(fi * 1.71, fi + 4.2)) * 6.2831853;
        float2 orbit = float2(
            sin(slow * (0.62 + lane * 0.42) + phase),
            cos(slow * (0.48 + lane * 0.36) + phase * 1.37)
        );
        float2 counter = float2(
            cos(slow * (0.20 + lane * 0.20) + phase * 0.73),
            sin(slow * (0.24 + lane * 0.18) + phase * 1.91)
        );
        float2 center = float2(
            mix(-aspect * 0.92, aspect * 0.92, hash21(float2(fi + 21.0, fi))),
            mix(-0.82, 0.82, hash21(float2(fi, fi + 37.0)))
        );
        center += orbit * float2(0.34 + lane * 0.24, 0.24 + lane * 0.18) + counter * 0.16;
        center = mix(center, pointer, wake * 0.12 * (0.35 + lane));

        float angle = phase + slow * (0.34 + lane * 0.19);
        float s = sin(angle);
        float c = cos(angle);
        float2 delta = p - center;
        float2 rotated = float2(c * delta.x - s * delta.y, s * delta.x + c * delta.y);
        float2 radius = float2(0.32 + lane * 0.34, 0.22 + hash21(float2(fi + 9.0, fi)) * 0.28);
        float2 q = rotated / radius;
        float blob = exp(-dot(q, q) * 1.65);
        float softBlob = smoothstep(0.015, 0.82, blob);
        float3 blobColor = palette(lane + fi * 0.055 + t * 0.018);
        density += blob * (0.74 + lane * 0.34);
        colorMix += blobColor * softBlob * (0.38 + lane * 0.22);
    }

    float milk = smoothstep(0.22, 1.68, density);
    float membrane = smoothstep(0.70, 1.04, density) - smoothstep(1.18, 1.75, density);
    float3 velvet = float3(0.012, 0.031, 0.020);
    float3 night = float3(0.006, 0.044, 0.038);
    float3 base = mix(velvet, night, uv.y * 0.35 + valueNoise(p * 0.7 + slow) * 0.16);
    float3 normalizedColor = colorMix / max(0.42, milk + density * 0.20);
    float vignette = smoothstep(1.35, 0.16, length((uv * 2.0 - float2(1.0)) * float2(0.78, 1.18)));
    float3 color = mix(base, normalizedColor, milk * 0.88);
    color += float3(0.72, 1.00, 0.82) * membrane * 0.16;
    color += float3(0.62, 1.00, 0.88) * wake * 0.18;
    color *= 0.54 + vignette * 0.70;
    color = pow(max(color, float3(0.0)), float3(0.86));

    return float4(color, 1.0);
}
