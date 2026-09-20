// Keep static publishing independent of Node; verify the checked-in browser files
// against the exact npm version in package-lock.json during CI.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = ['components/prism-core.min.js', 'components/prism-swift.min.js', 'LICENSE'];
const destination = path.join(root, 'Assets/highlighter');
if (!process.argv.includes('--check')) fs.mkdirSync(destination, {recursive: true});
for (const file of files) {
  const source = fs.readFileSync(path.join(root, 'node_modules/prismjs', file));
  const target = path.join(destination, path.basename(file));
  if (process.argv.includes('--check')) {
    if (!fs.readFileSync(target).equals(source)) throw new Error(`Prism asset differs from its pinned package: ${file}`);
  } else fs.writeFileSync(target, source);
}
console.log('Prism core, Swift grammar, and license match the pinned npm package.');
