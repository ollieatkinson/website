#!/usr/bin/env bash
set -euo pipefail

SDK_ID="${SWIFT_WASM_SDK_ID:-swift-6.3.1-RELEASE_wasm}"
BACKGROUND_OUTPUT_DIR="${1:-Assets/wasm}"
BUILD_BACKGROUND_WASM="${BUILD_BACKGROUND_WASM:-1}"

node Scripts/compile-metal-background.mjs

if [[ "$BUILD_BACKGROUND_WASM" == "1" ]]; then
  rm -rf "$BACKGROUND_OUTPUT_DIR"

  swift package \
    --swift-sdk "$SDK_ID" \
    --allow-writing-to-package-directory \
    js \
    --product WASMBackgroundRender \
    --use-cdn \
    --configuration release \
    --output "$BACKGROUND_OUTPUT_DIR"
fi
