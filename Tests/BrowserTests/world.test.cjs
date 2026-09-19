const {test} = require('node:test');
const assert = require('node:assert/strict');
const {evolve} = require('../../Assets/background-world.js');
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
