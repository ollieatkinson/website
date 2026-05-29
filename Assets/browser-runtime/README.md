# Browser Runtime Artifacts

This project vendors browser runtime assets for local in-browser execution and rendering:

- `swift-runtime.js` / `swift-runtime.wasm`
- `stdlib.wasm`
- `swiftui.min.js`
- `metal/msl_compiler.js` / `metal/msl_compiler.wasm`
- `metal/metal-bridge.js`
- `metal/preview-runtime.js`

The public `toprakdeviren/msf` repository currently exposes the Swift frontend
only. The full browser runtime, SwiftUI renderer, and Metal compiler are shipped
as browser artifacts here.
