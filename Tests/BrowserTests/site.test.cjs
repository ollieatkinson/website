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
  await p.goto(base + '/?background=off#playground');
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

test('Metal shader renders on WebGPU, pauses, and changes patterns', async () => {
  const p = await page({viewport: {width: 1280, height: 1100}});
  const errors = [];
  p.on('pageerror', error => errors.push(error.message));
  await p.goto(base + '/?background=off');
  await p.waitForFunction(() => document.querySelector('canvas').dataset.renderer === 'webgpu');
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(250);
  const initial = await p.locator('canvas').screenshot();
  await p.waitForTimeout(300);
  assert.ok((await p.locator('canvas').screenshot()).equals(initial), 'Paused pattern should stay unchanged');
  await p.locator('[data-pattern="1"]').click();
  assert.ok(!(await p.locator('canvas').screenshot()).equals(initial), 'Selecting a pattern should change pixels');
  assert.equal(await p.locator('[data-pattern="1"]').getAttribute('aria-pressed'), 'true');
  await p.locator('#motion').click();
  const playing = await p.locator('canvas').screenshot();
  await p.waitForTimeout(500);
  assert.ok(!(await p.locator('canvas').screenshot()).equals(playing), 'Playing should change pixels');
  assert.deepEqual(errors, []);
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
  await p.locator('[data-pattern="1"]').click();
  assert.ok(!(await p.locator('canvas').screenshot()).equals(initial), 'Selecting a pattern should change pixels');
  await p.close();
});

test('Shader fetch failure retains a usable pattern', async () => {
  const p = await page();
  await p.route('**/background.wgsl*', route => route.fulfill({status: 503}));
  await p.goto(base + '/?background=off');
  await p.waitForTimeout(500);
  assert.equal(await p.locator('canvas').getAttribute('data-renderer'), 'canvas');
  await p.locator('[data-pattern="1"]').click();
  assert.match(await p.locator('#pattern-note').innerText(), /XOR/);
  await p.close();
});

test('No JavaScript retains content, links, and a static fractal', async () => {
  const p = await page({javaScriptEnabled: false});
  await p.goto(base);
  assert.equal(await p.locator('h1').innerText(), 'Oliver Atkinson');
  assert.equal(await p.locator('.pattern-fallback').evaluate(el => el.complete && el.naturalWidth > 0), true);
  assert.equal(await p.locator('nav a').count(), 2);
  await p.locator('summary').click();
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
  await p.goto(base + '/?background=off');
  await p.waitForFunction(() => document.querySelector('canvas').dataset.renderer === 'webgpu');
  await p.evaluate(() => window.testDevice.destroy());
  await p.waitForFunction(() => document.querySelector('canvas').dataset.renderer === 'canvas');
  await p.locator('[data-pattern="1"]').click();
  assert.match(await p.locator('#pattern-note').innerText(), /XOR/);
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
