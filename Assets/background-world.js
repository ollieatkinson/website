// CPU fallback and deterministic seeds. The primary evolution rules live in
// background.metal; the tests compare the actual GPU state with this fallback.
(function(root) {
  const ink = [16, 21, 20];
  function seed(width, height, value = 7) {
    const cells = new Uint32Array(width * height);
    // Mix all seed bits before drawing parameters; nearby seeds should not
    // produce nearby random streams. Zero is a valid, distinct seed too.
    let random = value >>> 0;
    const next = () => {
      random = (random + 0x6d2b79f5) >>> 0;
      let n = Math.imul(random ^ (random >>> 15), random | 1);
      n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
      return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
    const range = (low, high) => low + next() * (high - low);
    // Consecutive Reseed clicks change the large-scale geometry, not just noise.
    const shape = (value >>> 0) % 4; // islands, strata, rings, Pascal grove
    const scale = Math.min(width, height);
    const angle = range(0, Math.PI), cosine = Math.cos(angle), sine = Math.sin(angle);
    const phase = range(0, Math.PI * 2);
    const spacing = scale * range(.16, .34);
    const centerX = width * range(.25, .75), centerY = height * range(.25, .75);
    const islands = Array.from({length: 3 + Math.floor(next() * 6)}, () => ({
      x: next() * width, y: next() * height, radius: scale * range(.07, .20),
    }));
    const density = [range(.34, .48), range(.28, .40), range(.38, .52), range(.10, .18)][shape];
    const sparkDensity = [range(.0002, .001), range(.004, .014), range(.015, .035), range(.0001, .0005)][shape];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let ground;
        if (shape === 0 || shape === 3) {
          ground = islands.some(island => Math.hypot(x - island.x, y - island.y) < island.radius);
        } else if (shape === 1) {
          const along = x * cosine + y * sine;
          const across = -x * sine + y * cosine;
          const wave = along / spacing * Math.PI * 2 + Math.sin(across / scale * 6 + phase) * .7;
          ground = Math.sin(wave + phase) > .50;
        } else {
          const radius = Math.hypot(x - centerX, y - centerY);
          ground = Math.sin(radius / spacing * Math.PI * 2 + phase) > .65;
        }
        // Keep the negative space empty: geometry remains legible as it grows.
        if (ground && next() < density) cells[y * width + x] = 1 | (31 << 4);
        if (ground && next() < sparkDensity) cells[y * width + x] |= 4 | (31 << 4);
      }
    }
    const fanCount = [1 + Math.floor(next() * 3), 2, 1, 5 + Math.floor(next() * 5)][shape];
    for (let fan = 0; fan < fanCount; fan++) {
      const size = shape === 3
        ? Math.floor(scale * (fan === 0 ? range(.65, .95) : range(.15, .45)))
        : Math.floor(scale * range(.07, .20));
      const rows = Math.max(3, Math.min(height, size));
      // The largest grove grows from the top; smaller fans can enter anywhere.
      const cy = shape === 3 && fan === 0 ? 0 : Math.floor(next() * Math.max(1, height - rows));
      const cx = Math.floor(next() * width);
      for (let row = 0; row < rows; row++) {
        for (let k = 0; k <= row; k++) {
          if ((k & row) === k) {
            const x = ((cx + k * 2 - row) % width + width) % width;
            cells[((cy + row) % height) * width + x] |= 2;
          }
        }
      }
    }
    return cells;
  }

  function evolve(cells, output, width, height, generation, seedValue, pointer) {
    for (let y = 0; y < height; y++) {
      const above = ((y + height - 1) % height) * width;
      const below = ((y + 1) % height) * width;
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const left = (x + width - 1) % width;
        const right = (x + 1) % width;
        const state = cells[row + x];
        let neighbors = 0, firing = 0;
        // Reuse indices, avoiding an array allocation for every cell.
        const count = index => { const cell = cells[index]; neighbors += cell & 1; if (cell & 4) firing++; };
        count(above + left); count(above + x); count(above + right);
        count(row + left); count(row + right);
        count(below + left); count(below + x); count(below + right);
        let life = neighbors === 3 || ((state & 1) && neighbors === 2) ? 1 : 0;
        let pascal = y > 0 ? (cells[above + left] ^ cells[above + right]) & 2
          : generation % 96 === 0 && x === (seedValue * 37 + generation * 13) % width ? 2 : 0;
        const spark = state & 12;
        let nextSpark = spark === 4 ? 8 : spark === 0 && firing === 2 ? 4 : 0;
        let ember = state >>> 4;
        if (pascal && (x + y + generation) % 29 === 0 && ember === 0) {
          nextSpark = 4;
          if (neighbors <= 1) life = 1;
        }
        if (spark === 4 && neighbors === 2) life = 1;
        if (pointer) {
          const px = x - Math.trunc(pointer.x), py = y - Math.trunc(pointer.y);
          const distanceSquared = px * px + py * py;
          if (distanceSquared <= 25) {
            if ((x * 7 + y * 11 + generation) % 5 === 0) life = 1;
            if (distanceSquared >= 16) nextSpark = 4;
            if (px === 0 && py === 0) pascal = 2;
          }
        }
        ember = Math.max(0, ember - 1);
        if (life || nextSpark === 4) ember = 31;
        output[row + x] = life | pascal | nextSpark | (ember << 4);
      }
    }
  }

  function color(state) {
    if (state & 4) return [102, 140, 145];
    if (state & 8) return [48, 74, 82];
    if (state & 1) return [87, 110, 77];
    if (state & 2) return [79, 74, 51];
    const glow = (state >>> 4) / 31 * .65;
    return ink.map((channel, i) => Math.round(channel + ([46, 64, 54][i] - channel) * glow));
  }
  const api = {seed, evolve, color, ink};
  if (typeof module !== 'undefined') module.exports = api;
  else root.PixelWorld = api;
})(globalThis);
