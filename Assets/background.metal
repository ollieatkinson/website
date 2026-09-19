#include <metal_stdlib>
using namespace metal;

// Shared with background.js: time (0), pattern (4), resolution (8), pointer (16).
struct Uniforms {
    float time;
    float pattern;
    float2 resolution;
    float2 mouse;
};

// Pascal's triangle modulo two: C(row, column) is odd exactly when
// all set bits of column are also set in row (Lucas's theorem).
fragment float4 fs_main(float4 pos [[position]], constant Uniforms& u [[buffer(0)]]) {
    float2 cell = floor(pos.xy / 4.0);
    float row = cell.y + floor(u.time * 5.0);
    float x = cell.x - floor(u.resolution.x / 8.0);
    if (u.mouse.x >= 0.0) {
        x += floor((u.mouse.x - u.resolution.x * 0.5) / 16.0);
    }
    uint r = uint(row) % 128u;
    float k = (x + float(r)) * 0.5;
    bool alive = false;
    if (u.pattern < 0.5) {
        if (k >= 0.0 && k <= float(r) && fract(k) == 0.0) {
            uint sharedBits = uint(k) & r;
            alive = sharedBits == uint(k);
        }
    } else {
        uint a = uint(abs(x));
        alive = ((a ^ r) % 16u) < 5u;
    }
    float3 ink = float3(0.098, 0.110, 0.106);
    float3 sage = float3(0.659, 0.749, 0.541);
    float3 peach = float3(0.890, 0.663, 0.494);
    float band = floor(float(r) / 16.0);
    float3 color = mix(sage, peach, fmod(band, 3.0) / 2.0);
    if (alive) { return float4(color, 1.0); }
    return float4(ink, 1.0);
}
