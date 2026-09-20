const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
let browser, server, base;
const root = path.resolve('dist');
before(async () => {
  server = http.createServer((request, response) => {
    const file = path.join(root, new URL(request.url, 'http://localhost').pathname);
    const target = file.endsWith(path.sep) ? file + 'index.html' : file;
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) { response.writeHead(404); response.end(); return; }
    const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.svg':'image/svg+xml'};
    response.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream');
    fs.createReadStream(target).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADED !== '1',
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--disable-vulkan-surface'],
  });
});
after(async () => { await browser?.close(); server?.close(); });
async function page(options = {}) {
  const p = await browser.newPage(options);
  await p.route('https://cloud.umami.is/**', route => route.abort());
  return p;
}
async function run(p, source) {
  await p.locator('#source').fill(source);
  await p.locator('#run').click();
  await p.waitForFunction(() => !document.querySelector('#run').disabled);
  return {status: await p.locator('#run-status').innerText(), output: await p.locator('#output').innerText()};
}

test('Swift runtime stays lazy; sample, diagnostics, and fresh runs work', async () => {
  const p = await page();
  const requests = [];
  p.on('request', request => requests.push(request.url()));
  await p.goto(base + '/?background=off');
  assert.equal(await p.locator('#source').isVisible(), true);
  assert.equal(await p.locator('#playground').evaluate(el => el.open), true);
  assert.equal(requests.some(url => /swift-runtime|stdlib.wasm/.test(url)), false);
  await p.locator('#run').click();
  await p.waitForFunction(() => document.querySelector('#run-status').textContent.startsWith('Finished'));
  assert.match(await p.locator('#output').innerText(), /Reached 1 in 111 steps/);
  const values = await run(p, 'let xs = [1, 2, 3]\nvar sum = 0\nfor x in xs { sum += x }\nprint("sum=\\(sum)")\nprint(3.5 * 2.0)\nprint("<script>alert(1)</script>")');
  assert.match(values.status, /Finished/, values.output);
  assert.match(values.output, /sum=6/);
  assert.match(values.output, /7/);
  assert.match(values.output, /<script>alert\(1\)<\/script>/);
  assert.equal(await p.locator('#output script').count(), 0);
  const invalid = await run(p, 'let x: Int = "oops"\nprint(x)');
  assert.match(invalid.status, /error/);
  assert.match(invalid.output, /\d+:\d+/);
  const fresh = await run(p, 'print("fresh")');
  assert.match(fresh.status, /Finished/);
  assert.equal(fresh.output.trim(), 'fresh');
  await p.close();
});

test('Stop interrupts an infinite loop and allows another run', async () => {
  const p = await page();
  await p.goto(base + '/#playground');
  await p.locator('#source').fill('while true {}');
  await p.locator('#run').click();
  await p.waitForFunction(() => document.querySelector('#run-status').textContent === 'Running…');
  await p.locator('#stop').click();
  assert.equal(await p.locator('#run-status').innerText(), 'Stopped');
  assert.match((await run(p, 'print(42)')).output, /42/);
  await p.close();
});

test('Runaway printing is bounded', async () => {
  const p = await page();
  await p.goto(base + '/#playground');
  const result = await run(p, 'for i in 0..<2000 { print(i) }');
  assert.match(result.status, /error/);
  assert.match(result.output, /Output limit reached/);
  await p.close();
});

async function captureGPU(p) {
  await p.addInitScript(() => {
    const request = GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice = async function(...args) {
      const device = await request.apply(this, args);
      window.testDevice = device;
      window.testBuffers = {};
      const create = device.createBuffer.bind(device);
      device.createBuffer = options => {
        const buffer = create(options);
        if (options.label?.startsWith('garden-state-')) window.testBuffers[options.label] = buffer;
        return buffer;
      };
      return device;
    };
  });
}

async function compareGPU(p, pointer = null) {
  return p.evaluate(async pointer => {
    const canvas = document.querySelector('canvas');
    const {columns, rows, generation, seed} = canvas.dataset;
    const width = +columns, height = +rows, count = +generation;
    let expected = PixelWorld.seed(width, height, +seed), next = new Uint32Array(expected.length);
    for (let i = 0; i < count; i++) {
      PixelWorld.evolve(expected, next, width, height, i, +seed, i === 0 ? pointer : null);
      [expected, next] = [next, expected];
    }
    const device = window.testDevice;
    const readback = device.createBuffer({size: expected.byteLength, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST});
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(window.testBuffers[`garden-state-${count % 2}`], 0, readback, 0, expected.byteLength);
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    const actual = new Uint32Array(readback.getMappedRange());
    const mismatches = [];
    for (let i = 0; i < actual.length && mismatches.length < 5; i++) {
      if (actual[i] !== expected[i]) mismatches.push({i, actual: actual[i], expected: expected[i]});
    }
    readback.unmap(); readback.destroy();
    return {count, mismatches};
  }, pointer);
}

async function advanceAndPause(p) {
  await p.waitForFunction(() => +document.querySelector('canvas').dataset.generation >= 5);
  await p.evaluate(() => document.querySelector('#motion').click());
}

test('Metal compute evolves real GPU buffers like the fallback, with whole-page input', async () => {
  const p = await page({viewport: {width: 1280, height: 1100}});
  const errors = [];
  p.on('pageerror', error => errors.push(error.message));
  await captureGPU(p);
  for (const [seed, target] of [[7, null], [8, 'h1'], [9, '#source'], [10, null]]) {
    await p.goto(base + '/?background=off&seed=' + seed + '#playground');
    await p.waitForFunction(() => document.querySelector('canvas').dataset.renderer === 'webgpu');
    assert.deepEqual(await compareGPU(p), {count: 0, mismatches: []}, 'Initial GPU seed');
    if (target) {
      await p.locator(target).scrollIntoViewIfNeeded();
      const rect = await p.locator(target).boundingBox();
      await p.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await p.waitForTimeout(150);
    }
    const pointer = await p.evaluate(target => {
      document.querySelector('#motion').click();
      if (!target) return null;
      const element = document.querySelector(target);
      const rect = element.getBoundingClientRect();
      const clientX = rect.x + rect.width / 2, clientY = rect.y + rect.height / 2;
      element.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, pointerType: 'mouse', clientX, clientY}));
      const size = +document.querySelector('canvas').dataset.cellSize;
      return {x: clientX / size, y: clientY / size};
    }, target);
    await advanceAndPause(p);
    const result = await compareGPU(p, pointer);
    assert.deepEqual(result.mismatches, [], `GPU evolution with pointer over ${target || 'nothing'} at generation ${result.count}`);
    assert.ok(result.count >= 5);
    if (pointer) assert.notDeepEqual((await compareGPU(p)).mismatches, [], 'Pointer must change the simulation');
  }
  assert.deepEqual(errors, []);
  await p.close();
});

test('Background fills the viewport, freezes when paused, and reseeds', async () => {
  const p = await page({viewport: {width: 1280, height: 1100}});
  await p.goto(base + '/?background=off&seed=7');
  await p.waitForFunction(() => document.querySelector('canvas').dataset.renderer === 'webgpu');
  await p.evaluate(() => document.fonts.ready);
  assert.deepEqual(await p.locator('canvas').boundingBox(), {x: 0, y: 0, width: await p.evaluate(() => document.documentElement.clientWidth), height: 1100});
  assert.equal(await p.locator('canvas').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
  const initial = await p.locator('canvas').screenshot();
  await p.mouse.move(600, 250);
  await p.waitForTimeout(300);
  assert.ok((await p.locator('canvas').screenshot()).equals(initial), 'Paused background should ignore movement');
  assert.equal(await p.locator('canvas').getAttribute('data-generation'), '0');
  await p.locator('#reseed').click();
  assert.equal(await p.locator('canvas').getAttribute('data-seed'), '8');
  assert.ok(!(await p.locator('canvas').screenshot()).equals(initial), 'Reseeding should change pixels');
  const seeded = await p.locator('canvas').screenshot();
  await p.evaluate(() => document.querySelector('#motion').click());
  await advanceAndPause(p);
  assert.ok(!(await p.locator('canvas').screenshot()).equals(seeded), 'Metal evolution should change pixels');
  await p.locator('#source').scrollIntoViewIfNeeded();
  assert.deepEqual(await p.locator('canvas').boundingBox(), {x: 0, y: 0, width: await p.evaluate(() => document.documentElement.clientWidth), height: 1100});
  await p.close();
});

test('New visits draw a random seed; explicit seeds reproduce worlds and wrap safely', async () => {
  const p = await page();
  await p.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', {value: undefined});
    const random = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = values => {
      if (values instanceof Uint16Array && values.length === 1) { values[0] = 1234; return values; }
      return random(values);
    };
  });
  for (const [query, expected] of [['', 1234], ['&seed=0', 0], ['&seed=65536', 1234], ['&seed=65535', 65535]]) {
    await p.goto(base + '/?background=off' + query);
    assert.equal(await p.locator('canvas').getAttribute('data-seed'), String(expected));
  }
  await p.locator('#reseed').click();
  assert.equal(await p.locator('canvas').getAttribute('data-seed'), '0');
  assert.equal(await p.locator('canvas').getAttribute('data-generation'), '0');
  await p.close();
});

test('Reduced motion, Canvas fallback, and mobile layout', async () => {
  const p = await page({viewport: {width: 320, height: 900}, reducedMotion: 'reduce'});
  await p.addInitScript(() => Object.defineProperty(navigator, 'gpu', {value: undefined}));
  await p.goto(base);
  assert.equal(await p.locator('canvas').getAttribute('data-renderer'), 'canvas');
  assert.equal(await p.locator('#motion').innerText(), 'Play');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(250);
  const initial = await p.locator('canvas').screenshot();
  await p.waitForTimeout(300);
  assert.ok((await p.locator('canvas').screenshot()).equals(initial), 'Paused pattern should stay unchanged');
  await p.locator('#reseed').click();
  assert.ok(!(await p.locator('canvas').screenshot()).equals(initial), 'Reseeding should change pixels');
  await p.close();
});

test('Shader fetch failure retains a usable pattern', async () => {
  const p = await page();
  await p.route('**/background.wgsl*', route => route.fulfill({status: 503}));
  await p.goto(base + '/?background=off&seed=7');
  await p.waitForTimeout(500);
  assert.equal(await p.locator('canvas').getAttribute('data-renderer'), 'canvas');
  await p.locator('#reseed').click();
  assert.equal(await p.locator('canvas').getAttribute('data-seed'), '8');
  await p.locator('#motion').click();
  await p.waitForFunction(() => +document.querySelector('canvas').dataset.generation > 0);
  await p.close();
});

test('No JavaScript retains content, links, and a static pixel background', async () => {
  const p = await page({javaScriptEnabled: false});
  await p.goto(base);
  assert.equal(await p.locator('h1').innerText(), 'Oliver Atkinson');
  assert.match(await p.locator('.pixel-background').evaluate(el => getComputedStyle(el, '::before').backgroundImage), /radial-gradient/);
  assert.equal(await p.locator('nav a').count(), 2);
  assert.match(await p.locator('noscript').innerText(), /Enable JavaScript/);
  await p.close();
});

test('Losing a GPU device switches to the interactive Canvas fallback', async () => {
  const p = await page();
  await p.addInitScript(() => {
    const request = GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice = async function(...args) {
      const device = await request.apply(this, args);
      window.testDevice = device;
      return device;
    };
  });
  await p.goto(base + '/?background=off&seed=7');
  await p.waitForFunction(() => document.querySelector('canvas').dataset.renderer === 'webgpu');
  await p.evaluate(() => window.testDevice.destroy());
  await p.waitForFunction(() => document.querySelector('canvas').dataset.renderer === 'canvas');
  await p.locator('#reseed').click();
  assert.equal(await p.locator('canvas').getAttribute('data-seed'), '8');
  await p.locator('#motion').click();
  await p.waitForFunction(() => +document.querySelector('canvas').dataset.generation > 0);
  await p.close();
});

test('A failed runtime download can be retried', async () => {
  const p = await page();
  await p.route('**/swift-runtime.wasm*', route => route.fulfill({status: 503}));
  await p.goto(base + '/#playground');
  const failed = await run(p, 'print("hello")');
  assert.match(failed.status, /error|unavailable/);
  await p.unroute('**/swift-runtime.wasm*');
  const retry = await run(p, 'print("hello")');
  assert.match(retry.status, /Finished/);
  assert.equal(retry.output.trim(), 'hello');
  await p.close();
});

test('Swift highlighting follows edits, escapes markup, and preserves undo and Run shortcut', async () => {
  const p = await page();
  await p.goto(base + '/?background=off#playground');
  assert.equal(await p.locator('.source-editor').evaluate(el => el.classList.contains('highlighted')), true);
  assert.equal(await p.locator('.source-highlight').getAttribute('aria-hidden'), 'true');
  const source = '/* outer /* nested */ comment */\nlet value: Int = 42\nlet text = "value=\\(value)"\nlet raw = #"<img src=x onerror=alert(1)>"#\nlet multiline = """\nhello\nworld\n"""';
  await p.locator('#source').fill(source);
  assert.equal(await p.locator('.source-highlight code').textContent(), source);
  assert.equal(await p.locator('.source-highlight .comment').first().textContent(), '/* outer /* nested */ comment */');
  assert.equal(await p.locator('.source-highlight .keyword').first().textContent(), 'let');
  assert.equal(await p.locator('.source-highlight .number').first().textContent(), '42');
  assert.ok(await p.locator('.source-highlight .interpolation').count() > 0);
  assert.equal(await p.locator('.source-highlight img, .source-highlight script').count(), 0);
  assert.notEqual(await p.locator('.source-highlight .keyword').first().evaluate(el => getComputedStyle(el).color), await p.locator('.source-highlight .number').first().evaluate(el => getComputedStyle(el).color));
  await p.locator('#source').fill('print(42)');
  await p.locator('#source').press('ControlOrMeta+End');
  await p.keyboard.insertText('\n// edit');
  await p.locator('#source').press('ControlOrMeta+z');
  assert.equal(await p.locator('#source').inputValue(), 'print(42)');
  assert.equal(await p.locator('.source-highlight code').textContent(), 'print(42)');
  await p.locator('#source').press('ControlOrMeta+Enter');
  await p.waitForFunction(() => document.querySelector('#run-status').textContent.startsWith('Finished'));
  assert.equal((await p.locator('#output').innerText()).trim(), '42');
  await p.close();
});

test('Highlighting keeps wrapping and scroll aligned after mobile resize', async () => {
  const p = await page();
  await p.goto(base + '/?background=off#playground');
  const source = Array.from({length: 50}, (_, i) => `\tprint("Line ${i}: ${'long Swift string '.repeat(8)}")`).join('\n') + '\n';
  await p.locator('#source').fill(source);
  for (const width of [1280, 390]) {
    await p.setViewportSize({width, height: 900});
    await p.locator('#source').evaluate(el => { el.style.height = '400px'; el.scrollTop = el.scrollHeight; });
    await p.waitForFunction(() => {
      const editor = document.querySelector('#source'), mirror = document.querySelector('.source-highlight');
      return mirror.clientWidth === editor.clientWidth && mirror.clientHeight === editor.clientHeight && Math.abs(mirror.scrollTop - editor.scrollTop) < 2;
    });
    const sizes = await p.evaluate(() => {
      const editor = document.querySelector('#source'), mirror = document.querySelector('.source-highlight');
      return {sourceHeight: editor.scrollHeight, mirrorHeight: mirror.scrollHeight, scroll: editor.scrollTop, pageWidth: document.documentElement.scrollWidth, width: innerWidth};
    });
    assert.ok(sizes.scroll > 0);
    assert.ok(Math.abs(sizes.sourceHeight - sizes.mirrorHeight) < 2, JSON.stringify(sizes));
    assert.ok(sizes.pageWidth <= sizes.width);
  }
  await p.close();
});

test('Highlighting falls back to readable text for load failure, large pastes, IME, and forced colours', async () => {
  const p = await page();
  await p.route('**/highlighter/prism-swift.min.js*', route => route.abort());
  await p.goto(base + '/?background=off#playground');
  const isPlain = () => p.locator('#source').evaluate(el => getComputedStyle(el).color !== 'rgba(0, 0, 0, 0)');
  assert.equal(await isPlain(), true);
  assert.match((await run(p, 'print(7)')).output, /7/);
  await p.unroute('**/highlighter/prism-swift.min.js*');
  await p.reload();
  await p.locator('#source').fill('a'.repeat(20001));
  assert.equal(await isPlain(), true);
  await p.locator('#source').fill('let x = 1');
  assert.equal(await isPlain(), false);
  await p.locator('#source').dispatchEvent('compositionstart');
  assert.equal(await isPlain(), true);
  await p.locator('#source').dispatchEvent('compositionend');
  assert.equal(await isPlain(), false);
  await p.emulateMedia({forcedColors: 'active'});
  assert.equal(await isPlain(), true);
  assert.equal(await p.locator('.source-highlight').isVisible(), false);
  await p.close();
});

test('Resizing and editor toggles preserve live GPU cells and continue their evolution', async () => {
  const p = await page({viewport: {width: 900, height: 650}});
  const errors = [];
  p.on('pageerror', error => errors.push(error.message));
  await captureGPU(p);
  await p.goto(base + '/?background=off&seed=10');
  await p.waitForFunction(() => document.querySelector('canvas').dataset.renderer === 'webgpu');
  await p.evaluate(() => document.querySelector('#motion').click());
  await advanceAndPause(p);
  await p.evaluate(async () => {
    window.readGarden = async () => {
      const {columns, rows, generation, seed} = document.querySelector('canvas').dataset;
      const width = +columns, height = +rows, count = +generation;
      const device = window.testDevice;
      const readback = device.createBuffer({size: width * height * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST});
      const encoder = device.createCommandEncoder();
      encoder.copyBufferToBuffer(window.testBuffers[`garden-state-${count % 2}`], 0, readback, 0, width * height * 4);
      device.queue.submit([encoder.finish()]);
      await readback.mapAsync(GPUMapMode.READ);
      const cells = new Uint32Array(readback.getMappedRange()).slice();
      readback.unmap(); readback.destroy();
      return {width, height, count, seed, cells};
    };
    window.beforeResize = await window.readGarden();
    window.originalGeneration = window.beforeResize.count;
  });
  for (const action of ['collapse', 'expand', 'editor', 'grow', 'shrink', 'large']) {
    if (action === 'collapse' || action === 'expand') {
      await p.evaluate(() => document.querySelector('summary').click());
    } else if (action === 'editor') {
      await p.locator('#source').evaluate(el => { el.style.height = '750px'; });
    } else {
      await p.setViewportSize(action === 'grow' ? {width: 1440, height: 1000}
        : action === 'shrink' ? {width: 390, height: 844} : {width: 1920, height: 1200});
    }
    await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const result = await p.evaluate(async () => {
      const before = window.beforeResize, after = await window.readGarden();
      let changed = 0, added = 0;
      for (let y = 0; y < after.height; y++) {
        for (let x = 0; x < after.width; x++) {
          const cell = after.cells[y * after.width + x];
          if (x < before.width && y < before.height) changed += cell !== before.cells[y * before.width + x];
          else added += cell !== 0;
        }
      }
      window.beforeResize = after;
      return {changed, added, sameGeneration: before.count === after.count, sameSeed: before.seed === after.seed,
        retained: after.width >= before.width && after.height >= before.height};
    });
    assert.deepEqual(result, {changed: 0, added: 0, sameGeneration: true, sameSeed: true, retained: true}, action);
  }
  await p.evaluate(() => document.querySelector('#motion').click());
  await p.waitForFunction(() => +document.querySelector('canvas').dataset.generation >= window.originalGeneration + 3);
  await p.evaluate(() => document.querySelector('#motion').click());
  const mismatches = await p.evaluate(async () => {
    const before = window.beforeResize, after = await window.readGarden();
    let cells = before.cells, next = new Uint32Array(cells.length);
    for (let generation = before.count; generation < after.count; generation++) {
      PixelWorld.evolve(cells, next, after.width, after.height, generation, +after.seed, null);
      [cells, next] = [next, cells];
    }
    return after.cells.reduce((sum, cell, i) => sum + (cell !== cells[i]), 0);
  });
  assert.equal(mismatches, 0, 'GPU must continue from the preserved state after growth');
  assert.deepEqual(errors, []);
  await p.close();
});

test('Canvas fallback retains pixels through resize and collapse; editor starts open at a responsive size', async () => {
  const p = await page({viewport: {width: 1280, height: 1100}});
  await p.addInitScript(() => Object.defineProperty(navigator, 'gpu', {value: undefined}));
  await p.goto(base + '/?background=off&seed=10');
  assert.equal(await p.locator('#source').isVisible(), true);
  const desktopHeight = await p.locator('#source').evaluate(el => el.offsetHeight);
  assert.equal(desktopHeight, 560);
  await p.evaluate(() => document.querySelector('#motion').click());
  await advanceAndPause(p);
  const before = await p.locator('canvas').evaluate(el => ({pixels: el.toDataURL(), generation: el.dataset.generation}));
  for (const open of [false, true]) {
    await p.locator('#playground').evaluate((el, open) => { el.open = open; }, open);
    await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await p.locator('canvas').evaluate(el => el.toDataURL()), before.pixels);
  }
  for (const viewport of [{width: 1600, height: 1100}, {width: 390, height: 844}, {width: 1280, height: 1100}]) {
    await p.setViewportSize(viewport);
    await p.waitForFunction(() => {
      const canvas = document.querySelector('canvas');
      return canvas.width === canvas.parentElement.clientWidth && canvas.height === canvas.parentElement.clientHeight;
    });
    assert.equal(await p.locator('canvas').getAttribute('data-generation'), before.generation);
    if (viewport.width === 390) {
      const mobileHeight = await p.locator('#source').evaluate(el => el.offsetHeight);
      assert.ok(mobileHeight >= 320 && mobileHeight < desktopHeight);
    }
  }
  assert.equal(await p.locator('canvas').evaluate(el => el.toDataURL()), before.pixels);
  await p.close();
});
