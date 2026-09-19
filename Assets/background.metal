#include <metal_stdlib>
using namespace metal;

// 32 bytes, shared by the compute and display passes.
struct Params {
    uint width;
    uint height;
    uint generation;
    uint seed;
    float2 pointer;
    uint stir;
    uint cellSize;
};

// A cell packs Life (bit 0), Pascal spores (bit 1), firing/refractory
// sparks (bits 2/3), and a five-bit afterglow (bits 4..8).
// Read yesterday, write tomorrow: no in-place updates or races.
kernel void evolve(const device uint* cells [[buffer(0)]],
                   device uint* nextCells [[buffer(1)]],
                   constant Params& u [[buffer(2)]],
                   uint2 gid [[thread_position_in_grid]]) {
    if (gid.x >= u.width || gid.y >= u.height) { return; }
    uint x = gid.x;
    uint y = gid.y;
    uint index = y * u.width + x;
    uint state = cells[index];
    uint living = state & 1u;
    uint spark = state & 12u;
    uint ember = state >> 4u;
    uint neighbors = state & 0u;
    uint firing = state & 0u;

    for (int dy = -1; dy <= 1; dy += 1) {
        for (int dx = -1; dx <= 1; dx += 1) {
            if (dx != 0 || dy != 0) {
                uint nx = uint(int(x) + dx + int(u.width)) % u.width;
                uint ny = uint(int(y) + dy + int(u.height)) % u.height;
                uint neighbor = cells[ny * u.width + nx];
                neighbors += neighbor & 1u;
                uint pulse = neighbor & 4u;
                if (pulse != 0u) { firing += 1u; }
            }
        }
    }

    // Conway's B3/S23 rule supplies the little gardens and gliders.
    uint life = state & 0u;
    bool survives = living != 0u && neighbors == 2u;
    if (neighbors == 3u || survives) { life = 1u; }

    // Rule 90: diagonally arriving spores XOR together. Its spacetime
    // diagram is Pascal's triangle modulo two. Fresh pulses enter above.
    uint pascal = state & 0u;
    if (y > 0u) {
        uint left = (x + u.width - 1u) % u.width;
        uint right = (x + 1u) % u.width;
        uint cross = cells[(y - 1u) * u.width + left] ^ cells[(y - 1u) * u.width + right];
        pascal = cross & 2u;
    } else {
        uint beat = u.generation % 96u;
        uint origin = (u.seed * 37u + u.generation * 13u) % u.width;
        if (beat == 0u && x == origin) { pascal = 2u; }
    }

    // Excitable sparks: two firing neighbors wake a resting cell; it
    // fires for one beat, then spends one beat refractory before resting.
    uint nextSpark = state & 0u;
    if (spark == 4u) { nextSpark = 8u; }
    else if (spark == 0u && firing == 2u) { nextSpark = 4u; }

    // Sparse cross-pollination, not a visual overlay: Pascal spores wake
    // sparks and plant Life cells in ground whose afterglow has cooled.
    uint gate = (x + y + u.generation) % 29u;
    if (pascal != 0u && gate == 0u && ember == 0u) {
        nextSpark = 4u;
        if (neighbors <= 1u) { life = 1u; }
    }
    if (spark == 4u && neighbors == 2u) { life = 1u; }

    // Moving anywhere on the page plants a small constellation. A still
    // pointer doesn't keep drawing; paused/reduced-motion worlds don't stir.
    if (u.stir != 0u) {
        int px = int(x) - int(u.pointer.x);
        int py = int(y) - int(u.pointer.y);
        int distanceSquared = px * px + py * py;
        if (distanceSquared <= 25) {
            uint speck = (x * 7u + y * 11u + u.generation) % 5u;
            if (speck == 0u) { life = 1u; }
            if (distanceSquared >= 16) { nextSpark = 4u; }
            if (px == 0 && py == 0) { pascal = 2u; }
        }
    }

    if (ember > 0u) { ember -= 1u; }
    if (life != 0u || nextSpark == 4u) { ember = 31u; }
    uint glow = ember << 4u;
    nextCells[index] = life | pascal | nextSpark | glow;
}
