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

## Structure

The site keeps data and view composition separate:

- `Sources/Website/HomeContent.swift` contains the page copy, links, and small data models.
- `Sources/Website/HomeComponents.swift` contains the Raptor components that compose the page.
- `Sources/WASMBackgroundRender/WebGPUBackground.swift` owns lifecycle and input.
- `Sources/WASMBackgroundRender/BackgroundScene.swift` owns GPU resources and drawing.
- `Sources/WASMBackgroundRender/BrowserRuntime.swift` owns browser-facing state such as viewport, pointer, and frame timing.

The WGSL shader lives in `Assets/background.wgsl`, and `Assets/background.js` is only the minimal browser loader/fallback switch. CSS remains for layout, typography, controls, and the non-WebGPU fallback background.

## Checks

```sh
swift build
swift run Website
```

## GitHub Pages

Pushes to `trunk` build the SwiftWasm background, then build `dist` with the Xcode Swift toolchain and deploy through GitHub Actions. Set the repository Pages source to GitHub Actions and configure the custom domain as `olbo.dev`.

## Staging

GitHub Pages gives this repository one Pages site and one primary custom domain. To serve branch previews from `staging.olbo.dev`, use a second public Pages repository such as `ollieatkinson/website-staging`, configure its custom domain as `staging.olbo.dev`, and add this DNS record:

```text
CNAME  staging  ollieatkinson.github.io
```

The staging repository can either mirror this source branch, or receive a generated `dist` artifact from a workflow using a deploy key or fine-grained token secret.

## SwiftWasm

The static site generator intentionally uses the bundled Xcode Swift toolchain. The browser background is SwiftWasm and WebGPU; current SwiftWasm tooling requires an OSS Swift toolchain and matching Wasm SDK rather than Xcode's bundled Swift.
