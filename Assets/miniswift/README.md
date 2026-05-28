# MiniSwift Artifacts

This experimental branch vendors runtime assets from `https://miniswift.run/`:

- `miniswift.js` / `miniswift.wasm`
- `stdlib.wasm`
- `swiftui.min.js`
- `metal/msl_compiler.js` / `metal/msl_compiler.wasm`
- `metal/metal-bridge.js`
- `metal/preview-runtime.js`

The public `toprakdeviren/msf` repository currently exposes the Swift frontend
only. The full browser runtime, SwiftUI renderer, and Metal compiler are shipped
by `miniswift.run` as browser artifacts.
