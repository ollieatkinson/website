// Generated from background.metal; run node Tools/compile-shader.cjs
// Source SHA-256: 7c728b8ab123b5f837e881c51dbae1e7a78e61e259fb42b214a0ad80752ec076
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
@group(0) @binding(1) var<storage, read_write> nextCells: array<u32>;
@group(0) @binding(2) var<uniform> u: Params;

@compute @workgroup_size(64, 1, 1)
fn evolve(@builtin(global_invocation_id) gid_bi: vec3u) {
    let gid: vec2u = gid_bi.xy;
    if (gid.x >= u.width || gid.y >= u.height) {
        return;
    }
    var x = gid.x;
    var y = gid.y;
    var index = y * u.width + x;
    var state = cells[index];
    var living = state & 1;
    var spark = state & 12;
    var ember = state >> 4;
    var neighbors = state & 0;
    var firing = state & 0;
    for (var dy = -1; dy <= 1; dy += 1) {
        for (var dx = -1; dx <= 1; dx += 1) {
            if (dx != 0 || dy != 0) {
                var nx = u32(i32(x) + dx + i32(u.width)) % u.width;
                var ny = u32(i32(y) + dy + i32(u.height)) % u.height;
                var neighbor = cells[ny * u.width + nx];
                neighbors += neighbor & 1;
                var pulse = neighbor & 4;
                if (pulse != 0) {
                    firing += 1;
                }
            }
        }
    }
    var life = state & 0;
    var survives = living != 0 && neighbors == 2;
    if (neighbors == 3 || survives) {
        life = 1;
    }
    var pascal = state & 0;
    if (y > 0) {
        var left = (x + u.width - 1) % u.width;
        var right = (x + 1) % u.width;
        var cross = cells[(y - 1) * u.width + left] ^ cells[(y - 1) * u.width + right];
        pascal = cross & 2;
    } else {
        var beat = u.generation % 96;
        var origin = (u.seed * 37 + u.generation * 13) % u.width;
        if (beat == 0 && x == origin) {
            pascal = 2;
        }
    }
    var nextSpark = state & 0;
    if (spark == 4) {
        nextSpark = 8;
    } else {
        if (spark == 0 && firing == 2) {
            nextSpark = 4;
        }
    }
    var gate = (x + y + u.generation) % 29;
    if (pascal != 0 && gate == 0 && ember == 0) {
        nextSpark = 4;
        if (neighbors <= 1) {
            life = 1;
        }
    }
    if (spark == 4 && neighbors == 2) {
        life = 1;
    }
    if (u.stir != 0) {
        var px = i32(x) - i32(u.pointer.x);
        var py = i32(y) - i32(u.pointer.y);
        var distanceSquared = px * px + py * py;
        if (distanceSquared <= 25) {
            var speck = (x * 7 + y * 11 + u.generation) % 5;
            if (speck == 0) {
                life = 1;
            }
            if (distanceSquared >= 16) {
                nextSpark = 4;
            }
            if (px == 0 && py == 0) {
                pascal = 2;
            }
        }
    }
    if (ember > 0) {
        ember -= 1;
    }
    if (life != 0 || nextSpark == 4) {
        ember = 31;
    }
    var glow = ember << 4;
    nextCells[index] = life | pascal | nextSpark | glow;
}

