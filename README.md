# olbo.dev

A small personal site with pixel lettering, a living pixel background, and a Swift
console. HTML is generated in Swift using [Elementary](https://github.com/elementary-swift/elementary).
The shader is written in Metal. GitHub Pages serves the resulting static files.

## Development

With Swift 6.2 or newer (CI uses 6.2.4):

```sh
swift run Website
python3 -m http.server 5173 --directory dist
```

Open http://localhost:5173. `dist` is replaced on each build. No Node installation
is needed to generate the site; Node 22+ is only used for shader development and
browser tests.

## HTML rendering

[Elementary 0.8.1](https://github.com/elementary-swift/elementary/releases/tag/0.8.1)
is pinned in `Package.swift` and `Package.resolved`. It provides typed HTML
components, element-specific attributes, result builders, and automatic text and
attribute escaping, with no transitive dependencies. It is Apache-2.0 licensed
and has community integrations for Vapor and Hummingbird.

`MainLayout` is an `HTMLDocument`; `Home` composes the navigation, introduction,
garden controls, and `SwiftPlayground` components. `Website.publish` renders the
complete document once, at the file-writing boundary. Page markup is not assembled
with raw strings or `HTMLRaw`. Custom attributes cover ARIA and the few browser
attributes that Elementary does not model directly.

The generator requires Swift 6.2+ and macOS 14+ or Linux. Elementary is a build-time
dependency: published pages need no Swift server or additional browser runtime.

## The pixel ecosystem

The background fills the viewport behind the whole page. Conway's Game of Life
forms clusters; Pascal's triangle modulo two sends XOR spores down the field;
excitable sparks fire, recover, and leave fading trails. These rules interact:
spores plant Life and wake sparks in cooled ground. Pointer movement anywhere on
the page plants small disturbances, including over text and the editor.

`Assets/background.metal` evolves the simulation in a Metal compute kernel with
two alternating state buffers. `Assets/background-display.metal` draws the cells
with a one-pixel gutter. Both checked-in WGSL files are generated with the retained
MiniSwift Metal compiler. After editing Metal, run:

```sh
node Tools/compile-shader.cjs
```

The browser fetches only generated shaders, not the compiler. WebGPU runs both
the simulation and rendering; JavaScript provides input, seeds, and scheduling.
This is Metal-authored code compiled to WGSL, not native Metal execution in the
browser. Canvas 2D runs the same rules if WebGPU is unavailable, compilation fails,
or the device is lost. Without JavaScript, CSS supplies a static pixel texture;
the background does not use SVG.

The world advances ten generations per second on a grid capped at 240 × 160.
Hidden tabs stop scheduling frames. Reduced motion and `?background=off` start
paused; Play resumes. Pause freezes both evolution and pointer interaction.
Reseed creates a fresh world, and viewport resizing rebuilds the grid.

WebGPU supports browsers including Chrome/Edge on Windows, without requiring
native Metal. The Swift generator uses cross-platform Foundation; macOS and Linux
are checked in CI. Native Windows builds and Windows GPU execution have not been
verified here.

## Swift playground and the MSF update

The expandable editor runs Swift snippets locally in a fresh Web Worker. It has
Run (also Ctrl/Cmd+Enter), Stop, printed output, line/column compiler diagnostics,
and a link to MiniSwift Studio’s full debugger. There are no embedded SwiftUI or
Metal editors. Breakpoints and variable stepping are available in Studio, not in
this compact console.

The current MiniSwift browser compiler and matching stdlib were downloaded on
2026-09-19 and pinned by SHA-256 in `Assets/browser-runtime/artifacts.json`.
Together they are about 15 MB uncompressed, loaded only after pressing Run.
Execution is limited to 15 seconds and 1,000 output lines / 100 KB. Unsupported
host APIs report errors instead of returning invented results. This is
MiniSwift’s Swift subset, not Apple’s complete Swift toolchain; file access and
Apple framework APIs are not provided by this console.

The public [MSF repository](https://github.com/toprakdeviren/msf) remains a Swift
frontend (lexer/parser/type checker), not the browser compiler/runtime or Metal
translator. Its latest HEAD when checked was
`a060d55bd60ae0c31acc30fbade23e550817e40e` (2026-06-28), with no release tags.
It cannot replace the site generator or be dropped in as a runtime upgrade.
The updated browser artifacts come from [MiniSwift](https://miniswift.run/),
separately from that Git repository; they are unversioned upstream snapshots.
See the runtime and tool READMEs for provenance and update checks.

## Checks

```sh
swift test
swift run Website
npm ci
npx playwright install chromium
npm test
```

Tests cover static publishing, source escaping, live Swift execution, diagnostics,
cancellation, output limits, Metal compilation/rendering, GPU/CPU state parity,
whole-page pointer input, pause/reseed controls,
reduced motion, mobile layout, and JavaScript/WebGPU fallback paths. The browser
suite uses Chromium’s software WebGPU adapter so GPU checks do not require a
physical GPU. An optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` selects an existing
Chromium installation. On Linux containers, install `mesa-vulkan-drivers`,
`xvfb`, and `xauth`, then run `PLAYWRIGHT_HEADED=1 xvfb-run -a npm test`
(as CI does). The software Vulkan driver is required even with SwiftShader
flags; without it Chromium can create a device and immediately lose it.

The pixel typeface is [Silkscreen](https://github.com/google/fonts/tree/main/ofl/silkscreen),
bundled with its SIL Open Font License in `Assets/fonts/silkscreen`.
