struct Uniforms {
    time: f32,
    width: f32,
    height: f32,
    pointerX: f32,
    pointerY: f32,
    pointerEnergy: f32,
    pad0: f32,
    pad1: f32,
}

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(3.0, -1.0),
        vec2<f32>(-1.0, 3.0)
    );

    let position = positions[vertexIndex];
    var output: VertexOutput;
    output.position = vec4<f32>(position, 0.0, 1.0);
    output.uv = position * 0.5 + vec2<f32>(0.5);
    return output;
}

fn hash21(p: vec2<f32>) -> f32 {
    let h = dot(p, vec2<f32>(127.1, 311.7));
    return fract(sin(h) * 43758.5453123);
}

fn valueNoise(p: vec2<f32>) -> f32 {
    let cell = floor(p);
    let local = fract(p);
    let u = local * local * (3.0 - 2.0 * local);
    let a = hash21(cell);
    let b = hash21(cell + vec2<f32>(1.0, 0.0));
    let c = hash21(cell + vec2<f32>(0.0, 1.0));
    let d = hash21(cell + vec2<f32>(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn palette(x: f32) -> vec3<f32> {
    let h = fract(x);
    let cyan = vec3<f32>(0.04, 0.92, 0.78);
    let blue = vec3<f32>(0.12, 0.34, 1.00);
    let magenta = vec3<f32>(1.00, 0.16, 0.64);
    let lemon = vec3<f32>(1.00, 0.88, 0.22);
    let y = h * 4.0;

    if (y < 1.0) {
        return mix(cyan, blue, smoothstep(0.0, 1.0, y));
    } else if (y < 2.0) {
        return mix(blue, magenta, smoothstep(1.0, 2.0, y));
    } else if (y < 3.0) {
        return mix(magenta, lemon, smoothstep(2.0, 3.0, y));
    }

    return mix(lemon, cyan, smoothstep(3.0, 4.0, y));
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    let resolution = vec2<f32>(uniforms.width, uniforms.height);
    let aspect = resolution.x / max(resolution.y, 1.0);
    let uv = input.uv;
    var p = uv * 2.0 - vec2<f32>(1.0);
    p.x = p.x * aspect;

    var pointer = vec2<f32>(uniforms.pointerX * 2.0 - 1.0, 1.0 - uniforms.pointerY * 2.0);
    pointer.x = pointer.x * aspect;
    let t = uniforms.time;
    let pointerVector = p - pointer;
    let pointerDistance = length(pointerVector);
    let wake = exp(-pointerDistance * pointerDistance * 2.7) * uniforms.pointerEnergy;
    let swirl = vec2<f32>(-pointerVector.y, pointerVector.x) * wake * 0.16;
    p = p + swirl + pointerVector * wake * 0.05;

    let slow = t * 0.18;
    let drift = vec2<f32>(
        valueNoise(p * 1.1 + vec2<f32>(slow, 0.0)),
        valueNoise(p * 1.1 + vec2<f32>(8.0, slow * 0.7))
    ) - vec2<f32>(0.5);
    p = p + drift * 0.22;

    var density = 0.0;
    var colorMix = vec3<f32>(0.0);

    for (var i: i32 = 0; i < 14; i = i + 1) {
        let fi = f32(i);
        let lane = hash21(vec2<f32>(fi, fi * 2.31));
        let phase = hash21(vec2<f32>(fi * 1.71, fi + 4.2)) * 6.2831853;
        let orbit = vec2<f32>(
            sin(slow * (0.62 + lane * 0.42) + phase),
            cos(slow * (0.48 + lane * 0.36) + phase * 1.37)
        );
        let counter = vec2<f32>(
            cos(slow * (0.20 + lane * 0.20) + phase * 0.73),
            sin(slow * (0.24 + lane * 0.18) + phase * 1.91)
        );
        var center = vec2<f32>(
            mix(-aspect * 0.92, aspect * 0.92, hash21(vec2<f32>(fi + 21.0, fi))),
            mix(-0.82, 0.82, hash21(vec2<f32>(fi, fi + 37.0)))
        );
        center = center + orbit * vec2<f32>(0.34 + lane * 0.24, 0.24 + lane * 0.18) + counter * 0.16;
        center = mix(center, pointer, wake * 0.12 * (0.35 + lane));

        let angle = phase + slow * (0.34 + lane * 0.19);
        let axis = mat2x2<f32>(
            cos(angle),
            -sin(angle),
            sin(angle),
            cos(angle)
        );
        let radius = vec2<f32>(0.32 + lane * 0.34, 0.22 + hash21(vec2<f32>(fi + 9.0, fi)) * 0.28);
        let q = axis * (p - center) / radius;
        let blob = exp(-dot(q, q) * 1.65);
        let softBlob = smoothstep(0.015, 0.82, blob);
        let blobColor = palette(lane + fi * 0.055 + t * 0.018);
        density = density + blob * (0.74 + lane * 0.34);
        colorMix = colorMix + blobColor * softBlob * (0.38 + lane * 0.22);
    }

    let milk = smoothstep(0.22, 1.68, density);
    let membrane = smoothstep(0.70, 1.04, density) - smoothstep(1.18, 1.75, density);
    let velvet = vec3<f32>(0.010, 0.012, 0.026);
    let night = vec3<f32>(0.005, 0.052, 0.060);
    let base = mix(velvet, night, uv.y * 0.35 + valueNoise(p * 0.7 + slow) * 0.16);
    let normalizedColor = colorMix / max(0.42, milk + density * 0.20);
    let vignette = smoothstep(1.35, 0.16, length((uv * 2.0 - vec2<f32>(1.0)) * vec2<f32>(0.78, 1.18)));
    var color = mix(base, normalizedColor, milk * 0.88);
    color = color + vec3<f32>(0.72, 1.00, 0.82) * membrane * 0.16;
    color = color + vec3<f32>(0.62, 1.00, 0.88) * wake * 0.18;
    color = color * (0.54 + vignette * 0.70);
    color = pow(max(color, vec3<f32>(0.0)), vec3<f32>(0.86));

    return vec4<f32>(color, 1.0);
}
