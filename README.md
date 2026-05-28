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

The background algorithm and WebGPU orchestration live in `Sources/WASMBackgroundRender`. The Metal source shader lives in `Assets/background.metal`; regenerate the checked-in WGSL artifact with:

```sh
node Scripts/compile-metal-background.mjs
```

`Assets/background.js` is only the minimal browser loader/fallback switch. CSS remains for layout, typography, controls, and the non-WebGPU fallback background.

The animated background can be disabled with `?background=off`; `?background=on` clears the stored preference and slow-device opt-out. The browser loader also falls back to CSS for reduced motion, constrained devices, slow background bootstrap, and slow frame detection. Slow detections are stored in `localStorage` for seven days.

The browser playground uses vendored MiniSwift artifacts in `Assets/miniswift`: `miniswift.wasm` for Swift/SwiftUI, `stdlib.wasm` for emitted programs, and `metal/msl_compiler.wasm` for the Metal editor. The linked public `msf` repo only contains the lexer/parser/sema frontend; these browser runtime artifacts are copied from `miniswift.run` for this experimental branch.

## Checks

```sh
swift build
swift run Website
```
