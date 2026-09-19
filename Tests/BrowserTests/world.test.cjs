const {test} = require('node:test');
const assert = require('node:assert/strict');
const {seed, evolve} = require('../../Assets/background-world.js');
const width = 11, height = 11;
const at = (x, y) => y * width + x;
function step(input, generation = 1) {
  const output = new Uint32Array(input.length);
  evolve(input, output, width, height, generation, 7, null);
  return output;
}
function positions(cells, bit) {
  return [...cells].flatMap((state, i) => state & bit ? [i] : []);
}

test('Life blinker oscillates and a block survives', () => {
  const cells = new Uint32Array(width * height);
  for (const [x, y] of [[4, 5], [5, 5], [6, 5]]) cells[at(x, y)] = 1;
  const next = step(cells);
  assert.deepEqual(positions(next, 1), [at(5, 4), at(5, 5), at(5, 6)]);
  assert.deepEqual(positions(step(next, 2), 1), positions(cells, 1));
  cells.fill(0);
  for (const [x, y] of [[4, 4], [5, 4], [4, 5], [5, 5]]) cells[at(x, y)] = 1;
  assert.deepEqual(positions(step(cells), 1), positions(cells, 1));
});

test('Pascal spores propagate with XOR cancellation', () => {
  const cells = new Uint32Array(width * height);
  cells[at(5, 0)] = 2;
  const next = step(cells);
  assert.deepEqual(positions(next, 2), [at(4, 1), at(6, 1)]);
  assert.deepEqual(positions(step(next, 2), 2), [at(3, 2), at(7, 2)]);
});

test('Sparks fire, recover, and wake cells with exactly two firing neighbors', () => {
  const cells = new Uint32Array(width * height);
  cells[at(4, 5)] = 4;
  let next = step(cells);
  assert.equal(next[at(4, 5)] & 12, 8);
  assert.equal(step(next, 2)[at(4, 5)] & 12, 0);
  cells[at(6, 5)] = 4;
  next = step(cells);
  assert.equal(next[at(5, 5)] & 12, 4);
  assert.equal(next[at(5, 5)] >>> 4, 31);
});

test('A Pascal spore on cooled ground can plant Life and spark', () => {
  const cells = new Uint32Array(width * height);
  cells[at(4, 4)] = 2;
  // x=5, y=5, generation=19 satisfies the sparse planting gate.
  const next = step(cells, 19);
  assert.equal(next[at(5, 5)] & 7, 7);
  cells[at(5, 5)] = 8 << 4;
  assert.equal(step(cells, 19)[at(5, 5)] & 7, 2, 'Afterglow prevents immediate replanting');
});


test('Seeds are reproducible, including zero, on desktop and mobile grids', () => {
  for (const [width, height] of [[180, 140], [56, 121]]) {
    for (const value of [0, 1, 7, 8, 9, 10, 65535]) {
      const cells = seed(width, height, value);
      assert.deepEqual(seed(width, height, value), cells);
      assert.notDeepEqual(seed(width, height, (value + 1) % 65536), cells);
    }
  }
});

test('Reseeding changes population balance and broad composition after evolution', () => {
  for (const [width, height] of [[180, 140], [56, 121]]) {
    const counts = [], fields = [];
    for (const value of [7, 8, 9, 10]) {
      let cells = seed(width, height, value), next = new Uint32Array(cells.length);
      counts.push([1, 2, 4].map(bit => cells.reduce((sum, cell) => sum + !!(cell & bit), 0)));
      for (let generation = 0; generation < 50; generation++) {
        evolve(cells, next, width, height, generation, value, null);
        [cells, next] = [next, cells];
      }
      // Compare occupancy of broad regions, rather than individual noise pixels.
      const regions = new Array(64).fill(0), totals = new Array(64).fill(0);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = Math.floor(y / height * 8) * 8 + Math.floor(x / width * 8);
          regions[index] += !!(cells[y * width + x] & 7);
          totals[index]++;
        }
      }
      fields.push(regions.map((count, index) => count / totals[index]));
    }
    for (const component of [0, 1, 2]) {
      const values = counts.map(count => count[component]);
      assert.ok(Math.max(...values) > Math.max(1, Math.min(...values)) * 3, 'Population balance must vary substantially');
    }
    for (let index = 1; index < fields.length; index++) {
      const difference = fields[index].reduce((sum, value, region) => sum + Math.abs(value - fields[index - 1][region]), 0) / 64;
      assert.ok(difference > .08, `Broad composition remains distinct after five seconds: ${difference}`);
    }
  }
});
