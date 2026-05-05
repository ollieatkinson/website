# olbo.dev

Single-page Swift/Raptor site for `olbo.dev`, built as static files for GitHub Pages.

The foreground typeface is bundled from Comic Mono, an MIT-licensed free font derived from Comic Shanns. The upstream package and license are mirrored in `Assets/fonts/comic-mono`.

## Local Development

```sh
swift run Website
python3 -m http.server 5173 --directory dist
```

To build the SwiftWasm/WebGPU background, use an active OSS Swift 6.3.1 toolchain plus the matching Wasm SDK:

```sh
swift sdk install https://download.swift.org/swift-6.3.1-release/wasm-sdk/swift-6.3.1-RELEASE/swift-6.3.1-RELEASE_wasm.artifactbundle.tar.gz --checksum bd47baa20771f366d8beed7970afaa30742b2210097afd15f85427226d8f4cf2
PATH="$HOME/.swiftly/bin:$PATH" Scripts/build-wasm.sh
swift run Website
```

The background algorithm and WebGPU orchestration live in `Sources/WASMBackgroundRender`. The WGSL shader lives in `Assets/background.wgsl`, and `Assets/background.js` is only the minimal browser loader/fallback switch. CSS remains for layout, typography, controls, and the non-WebGPU fallback background.

The Swift playground is a separate SwiftWasm bundle in `Sources/WASMSwiftScriptRunner`. It uses a WASI-trimmed copy of SwiftScript's interpreter core in `Sources/SwiftScriptWasmInterpreter` plus SwiftScript's parser dependency. The generated Foundation/URLSession bridge surface from upstream SwiftScript is intentionally omitted because those APIs do not compile against the current WASI SDK.

## Checks

```sh
swift build
swift run Website
```
