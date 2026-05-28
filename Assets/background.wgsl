// Generated from Assets/background.metal by Scripts/compile-metal-background.mjs.
// Auto-generated WGSL from MIR (Metal Compiler)

struct Uniforms {
    time: f32,
    width: f32,
    height: f32,
    pointerX: f32,
    pointerY: f32,
    pointerEnergy: f32,
    pad0: f32,
    pad1: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vertexMain(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4f {
    if (vid == 0) {
        return vec4f(-1.0, -1.0, 0.0, 1.0);
    } else {
        if (vid == 1) {
            return vec4f(3.0, -1.0, 0.0, 1.0);
        }
    }
    return vec4f(-1.0, 3.0, 0.0, 1.0);
}

fn hash21(p: vec2f) -> f32 {
    var h = dot(p, vec2f(127.09999999999999, 311.69999999999999));
    return fract(sin(h) * 43758.545312299997);
}

fn valueNoise(p: vec2f) -> f32 {
    var cell = floor(p);
    var local = fract(p);
    var u = local * local * (3.0 - 2.0 * local);
    var a = hash21(cell);
    var b = hash21(cell + vec2f(1.0, 0.0));
    var c = hash21(cell + vec2f(0.0, 1.0));
    var d = hash21(cell + vec2f(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn palette(x: f32) -> vec3f {
    var h = fract(x);
    var cyan = vec3f(0.040000000000000001, 0.92000000000000004, 0.78000000000000003);
    var blue = vec3f(0.12, 0.34000000000000002, 1.0);
    var magenta = vec3f(1.0, 0.16, 0.64000000000000001);
    var lemon = vec3f(1.0, 0.88, 0.22);
    var y = h * 4.0;
    if (y < 1.0) {
        return mix(cyan, blue, smoothstep(0.0, 1.0, y));
    } else {
        if (y < 2.0) {
            return mix(blue, magenta, smoothstep(1.0, 2.0, y));
        } else {
            if (y < 3.0) {
                return mix(magenta, lemon, smoothstep(2.0, 3.0, y));
            }
        }
    }
    return mix(lemon, cyan, smoothstep(3.0, 4.0, y));
}

@fragment
fn fragmentMain(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    var resolution = vec2f(uniforms.width, uniforms.height);
    var uv = pos.xy / max(resolution, vec2f(1.0));
    var aspect = resolution.x / max(resolution.y, 1.0);
    var p = uv * 2.0 - vec2f(1.0);
    p.x *= aspect;
    var pointer = vec2f(uniforms.pointerX * 2.0 - 1.0, 1.0 - uniforms.pointerY * 2.0);
    pointer.x *= aspect;
    var t = uniforms.time;
    var pointerVector = p - pointer;
    var pointerDistance = length(pointerVector);
    var wake = exp(-pointerDistance * pointerDistance * 2.7000000000000002) * uniforms.pointerEnergy;
    var swirl = vec2f(-pointerVector.y, pointerVector.x) * wake * 0.16;
    p = p + swirl + pointerVector * wake * 0.050000000000000003;
    var slow = t * 0.17999999999999999;
    var drift = vec2f(valueNoise(p * 1.1000000000000001 + vec2f(slow, 0.0)), valueNoise(p * 1.1000000000000001 + vec2f(8.0, slow * 0.69999999999999996))) - vec2f(0.5);
    p += drift * 0.22;
    var density = 0.0;
    var colorMix = vec3f(0.0);
    for (var i = 0; i < 14; i = i + 1) {
        var fi = f32(i);
        var lane = hash21(vec2f(fi, fi * 2.3100000000000001));
        var phase = hash21(vec2f(fi * 1.71, fi + 4.2000000000000002)) * 6.2831853000000004;
        var orbit = vec2f(sin(slow * (0.62 + lane * 0.41999999999999998) + phase), cos(slow * (0.47999999999999998 + lane * 0.35999999999999999) + phase * 1.3700000000000001));
        var counter = vec2f(cos(slow * (0.20000000000000001 + lane * 0.20000000000000001) + phase * 0.72999999999999998), sin(slow * (0.23999999999999999 + lane * 0.17999999999999999) + phase * 1.9099999999999999));
        var center = vec2f(mix(-aspect * 0.92000000000000004, aspect * 0.92000000000000004, hash21(vec2f(fi + 21.0, fi))), mix(-0.81999999999999995, 0.81999999999999995, hash21(vec2f(fi, fi + 37.0))));
        center += orbit * vec2f(0.34000000000000002 + lane * 0.23999999999999999, 0.23999999999999999 + lane * 0.17999999999999999) + counter * 0.16;
        center = mix(center, pointer, wake * 0.12 * (0.34999999999999998 + lane));
        var angle = phase + slow * (0.34000000000000002 + lane * 0.19);
        var s = sin(angle);
        var c = cos(angle);
        var delta = p - center;
        var rotated = vec2f(c * delta.x - s * delta.y, s * delta.x + c * delta.y);
        var radius = vec2f(0.32000000000000001 + lane * 0.34000000000000002, 0.22 + hash21(vec2f(fi + 9.0, fi)) * 0.28000000000000003);
        var q = rotated / radius;
        var blob = exp(-dot(q, q) * 1.6499999999999999);
        var softBlob = smoothstep(0.014999999999999999, 0.81999999999999995, blob);
        var blobColor = palette(lane + fi * 0.055 + t * 0.017999999999999999);
        density += blob * (0.73999999999999999 + lane * 0.34000000000000002);
        colorMix += blobColor * softBlob * (0.38 + lane * 0.22);
    }
    var milk = smoothstep(0.22, 1.6799999999999999, density);
    var membrane = smoothstep(0.69999999999999996, 1.04, density) - smoothstep(1.1799999999999999, 1.75, density);
    var velvet = vec3f(0.012, 0.031, 0.02);
    var night = vec3f(0.0060000000000000001, 0.043999999999999997, 0.037999999999999999);
    var base = mix(velvet, night, uv.y * 0.34999999999999998 + valueNoise(p * 0.69999999999999996 + slow) * 0.16);
    var normalizedColor = colorMix / max(0.41999999999999998, milk + density * 0.20000000000000001);
    var vignette = smoothstep(1.3500000000000001, 0.16, length((uv * 2.0 - vec2f(1.0)) * vec2f(0.78000000000000003, 1.1799999999999999)));
    var color = mix(base, normalizedColor, milk * 0.88);
    color += vec3f(0.71999999999999997, 1.0, 0.81999999999999995) * membrane * 0.16;
    color += vec3f(0.62, 1.0, 0.88) * wake * 0.17999999999999999;
    color *= 0.54000000000000004 + vignette * 0.69999999999999996;
    color = pow(max(color, vec3f(0.0)), vec3f(0.85999999999999999));
    return vec4f(color, 1.0);
}
