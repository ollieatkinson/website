// Generated from background-display.metal; run node Tools/compile-shader.cjs
// Source SHA-256: ac69b495a6cc52573adf1e26976d1762268727b01dd656a03bee3b576aa7f80f
// Auto-generated WGSL from MIR (MiniSwift Metal Compiler)

struct Params {
    width: u32,
    height: u32,
    generation: u32,
    seed: u32,
    pointer: vec2f,
    stir: u32,
    cellSize: u32,
};

@group(0) @binding(0) var<storage> cells: array<u32>;
@group(0) @binding(1) var<uniform> u: Params;

@fragment
fn fs_main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    var x = min(u32(pos.x / f32(u.cellSize)), u.width - 1);
    var y = min(u32(pos.y / f32(u.cellSize)), u.height - 1);
    var state = cells[y * u.width + x];
    var life = state & 1;
    var pascal = state & 2;
    var firing = state & 4;
    var refractory = state & 8;
    var ember = f32(state >> 4) / 31.0;
    var ink = vec3f(0.063, 0.082000000000000003, 0.078);
    var color = mix(ink, vec3f(0.17999999999999999, 0.25, 0.20999999999999999), ember * 0.65000000000000002);
    if (pascal != 0) {
        color = vec3f(0.31, 0.28999999999999998, 0.20000000000000001);
    }
    if (life != 0) {
        color = vec3f(0.34000000000000002, 0.42999999999999999, 0.29999999999999999);
    }
    if (refractory != 0) {
        color = vec3f(0.19, 0.28999999999999998, 0.32000000000000001);
    }
    if (firing != 0) {
        color = vec3f(0.40000000000000002, 0.55000000000000004, 0.56999999999999995);
    }
    var local = pos.xy % vec2f(f32(u.cellSize));
    if (local.x < 1.0 || local.y < 1.0) {
        color = ink;
    }
    return vec4f(color, 1.0);
}

