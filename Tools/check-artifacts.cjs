const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
for (const directory of ['Assets/browser-runtime', 'Tools/metal']) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'artifacts.json'), 'utf8'));
  for (const artifact of manifest.artifacts) {
    const bytes = fs.readFileSync(path.join(directory, artifact.file));
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    if (hash !== artifact.sha256 || bytes.length !== artifact.bytes) throw new Error(`Artifact does not match its pin: ${artifact.file}`);
  }
}
console.log('Vendored runtime and compiler hashes verified.');
