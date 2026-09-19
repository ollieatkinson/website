# MiniSwift browser runtime

`swift-runtime.js`, `swift-runtime.wasm`, and `stdlib.wasm` are matched snapshots
from https://miniswift.run/wasm/ downloaded on 2026-09-19. Source URLs, byte sizes,
and SHA-256 hashes are recorded in `artifacts.json`. Upstream names the first two
files `miniswift.js` and `miniswift.wasm`; the worker maps the WASM filename locally.
The JavaScript loader is otherwise unchanged.

These are the site's existing kind of vendored browser artifacts, updated from
the upstream service. They are **not** builds of the public MSF repository, and
MSF's MIT license alone does not establish the license of this separate runtime.
The service does not supply a matching source revision or release tag with these
files. The manifest identifies exact bytes, not a reproducible source build.

To update, download all three together, refresh the manifest, and run the browser
suite, including arrays, strings, floating-point printing, errors, and Stop.
`swift-worker.js` bridges the compiler and C stdlib by reading actual numeric
WebAssembly function signatures in `wasm-signatures.js`. Unimplemented imports
fail explicitly. Never use a public MSF HEAD as the version of these artifacts.
