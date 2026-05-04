# olbo.dev

Single-page Swift/Raptor site for `olbo.dev`, built as static files for GitHub Pages.

## Local Development

```sh
swift run Website
python3 -m http.server 5173 --directory dist
```

To build the SwiftWasm/WebGPU background, use an active OSS Swift 6.3.1 toolchain plus the matching Wasm SDK:

```sh
swift sdk install https://download.swift.org/swift-6.3.1-release/wasm-sdk/swift-6.3.1-RELEASE/swift-6.3.1-RELEASE_wasm.artifactbundle.tar.gz --checksum bd47baa20771f366d8beed7970afaa30742b2210097afd15f85427226d8f4cf2
Scripts/build-wasm.sh
swift run Website
```

The background algorithm and WebGPU orchestration live in `Sources/WASMBackgroundRender/main.swift`. The WGSL shader lives in `Assets/background.wgsl`, and `Assets/background.js` is only the minimal browser loader/fallback switch. CSS remains for layout, typography, controls, and the non-WebGPU fallback background.

## Checks

```sh
swift build
swift run Website
```

## GitHub Pages

Pushes to `trunk` build the SwiftWasm background, then build `dist` with the Xcode Swift toolchain and deploy through GitHub Actions. Set the repository Pages source to GitHub Actions and configure the custom domain as `olbo.dev`.

## SwiftWasm

The static site generator intentionally uses the bundled Xcode Swift toolchain. The browser background is SwiftWasm and WebGPU; current SwiftWasm tooling requires an OSS Swift toolchain and matching Wasm SDK rather than Xcode's bundled Swift.
