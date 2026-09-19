// Generated from background.metal; run node Tools/compile-shader.cjs
// Source SHA-256: a92f9c89c4565d313706c7171781cd3ae860fae3bbc297031c8177931cffbcfd
// Auto-generated WGSL from MIR (MiniSwift Metal Compiler)

struct Uniforms {
    time: f32,
    pattern: f32,
    resolution: vec2f,
    mouse: vec2f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

@fragment
fn fs_main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    var cell = floor(pos.xy / 4.0);
    var row = cell.y + floor(u.time * 5.0);
    var x = cell.x - floor(u.resolution.x / 8.0);
    if (u.mouse.x >= 0.0) {
        x += floor((u.mouse.x - u.resolution.x * 0.5) / 16.0);
    }
    var r = u32(row) % 128;
    var k = (x + f32(r)) * 0.5;
    var alive = false;
    if (u.pattern < 0.5) {
        if (k >= 0.0 && k <= f32(r) && fract(k) == 0.0) {
            var sharedBits = u32(k) & r;
            alive = sharedBits == u32(k);
        }
    } else {
        var a = u32(abs(x));
        alive = (a ^ r) % 16 < 5;
    }
    var ink = vec3f(0.098000000000000004, 0.11, 0.106);
    var sage = vec3f(0.65900000000000003, 0.749, 0.54100000000000004);
    var peach = vec3f(0.89000000000000001, 0.66300000000000003, 0.49399999999999999);
    var band = floor(f32(r) / 16.0);
    var color = mix(sage, peach, band % 3.0 / 2.0);
    if (alive) {
        return vec4f(color, 1.0);
    }
    return vec4f(ink, 1.0);
}

