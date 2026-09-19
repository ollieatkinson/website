// Keep the browser payload small: transpile the Metal source at development time.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
globalThis.MSLCompilerModule = require('./metal/msl_compiler.js');
require('./metal/metal-bridge.js');
(async () => {
  const source = fs.readFileSync(path.join(root, 'Assets/background.metal'), 'utf8');
  const bridge = await loadMetalCompiler();
  const result = bridge.transpile(source);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics) + '\n' + result.error);
  const digest = crypto.createHash('sha256').update(source).digest('hex');
  const output = '// Generated from background.metal; run node Tools/compile-shader.cjs\n' +
    '// Source SHA-256: ' + digest + '\n' + result.wgsl;
  const destination = path.join(root, 'Assets/background.wgsl');
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(destination, 'utf8') !== output) throw new Error('background.wgsl is stale');
    console.log('Metal shader matches generated WGSL.');
  } else {
    fs.writeFileSync(destination, output);
    console.log('Compiled background.metal → background.wgsl');
  }
  bridge.dispose();
})().catch(error => { console.error(error); process.exitCode = 1; });
