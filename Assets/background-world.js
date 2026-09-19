// CPU fallback and deterministic seeds. The primary evolution rules live in
// background.metal; the tests compare the actual GPU state with this fallback.
(function(root) {
  const ink = [16, 21, 20];
  function seed(width, height, value = 7) {
    const cells = new Uint32Array(width * height);
    let random = value >>> 0 || 1;
    const next = () => { random ^= random << 13; random ^= random >>> 17; random ^= random << 5; return (random >>> 0) / 4294967296; };
    // Islands of Life, rather than a uniform TV-static field.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const island = Math.sin(x * .13 + value) * Math.cos(y * .17) > .05;
        if (island && next() < .28) cells[y * width + x] = 1 | (31 << 4);
        if (next() < .008) cells[y * width + x] |= 4 | (31 << 4);
      }
    }
    // A handful of already-unfurled Pascal fans, so the initial still is alive.
    for (let fan = 0; fan < 5; fan++) {
      const cx = Math.floor(next() * width);
      const cy = Math.floor(next() * height);
      for (let row = 0; row < 24; row++) {
        for (let k = 0; k <= row; k++) {
          if ((k & row) === k) {
            const x = ((cx + k * 2 - row) % width + width) % width;
            const y = (cy + row) % height;
            cells[y * width + x] |= 2;
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
