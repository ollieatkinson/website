// Keep the browser payload small: transpile the Metal source at development time.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
globalThis.MSLCompilerModule = require('./metal/msl_compiler.js');
require('./metal/metal-bridge.js');
(async () => {
  const bridge = await loadMetalCompiler();
  for (const name of ['background', 'background-display']) {
    const source = fs.readFileSync(path.join(root, `Assets/${name}.metal`), 'utf8');
    const result = bridge.transpile(source);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics) + '\n' + result.error);
    let wgsl = result.wgsl;
    if (name === 'background') {
      // This compiler version drops the access mode of writable Metal pointers.
      // Restore the explicit output buffer's access; all rules remain in Metal.
      const declaration = '@binding(1) var<storage> nextCells: array<u32>';
      if (!wgsl.includes(declaration)) throw new Error('Review compute buffer access lowering');
      wgsl = wgsl.replace(declaration, '@binding(1) var<storage, read_write> nextCells: array<u32>');
    }
    const digest = crypto.createHash('sha256').update(source).digest('hex');
    const output = `// Generated from ${name}.metal; run node Tools/compile-shader.cjs\n` +
      '// Source SHA-256: ' + digest + '\n' + wgsl;
    const destination = path.join(root, `Assets/${name}.wgsl`);
    if (process.argv.includes('--check')) {
      if (fs.readFileSync(destination, 'utf8') !== output) throw new Error(`${name}.wgsl is stale`);
      console.log(`${name}.metal matches generated WGSL.`);
    } else {
      fs.writeFileSync(destination, output);
      console.log(`Compiled ${name}.metal → ${name}.wgsl`);
    }
  }
  bridge.dispose();
})().catch(error => { console.error(error); process.exitCode = 1; });
