# olbo.dev

Single-page Swift/Raptor site for `olbo.dev`, built as static files for GitHub Pages.

The foreground typeface is bundled from Comic Mono, an MIT-licensed free font derived from Comic Shanns. The upstream package and license are mirrored in `Assets/fonts/comic-mono`.

## Local Development

```sh
swift run Website
python3 -m http.server 5173 --directory dist
```

The animated background is authored as `Assets/background.metal` and renders locally in the browser. The Metal source compiles to WGSL client-side, then the preview runtime paints the canvas. `Assets/background.js` only handles loading, preferences, and CSS fallback.

The animated background can be disabled with `?background=off`; `?background=on` clears the stored preference and slow-device opt-out. The browser loader also falls back to CSS for reduced motion, constrained devices, and slow background bootstrap. Slow bootstrap detections are stored in `localStorage` for seven days.

The browser playground uses vendored runtime artifacts in `Assets/browser-runtime`: a Swift compiler/runtime wasm, `stdlib.wasm` for emitted programs, and `metal/msl_compiler.wasm` for the Metal editor and animated background. The linked public `msf` repo only contains the lexer/parser/sema frontend; the full browser runtime artifacts are vendored in this repo.

## Checks

```sh
swift build
swift run Website
```
