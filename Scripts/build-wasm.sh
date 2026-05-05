#!/usr/bin/env bash
set -euo pipefail

SDK_ID="${SWIFT_WASM_SDK_ID:-swift-6.3.1-RELEASE_wasm}"
BACKGROUND_OUTPUT_DIR="${1:-Assets/wasm}"
SWIFT_SCRIPT_OUTPUT_DIR="${2:-Assets/swift-script}"
BUILD_BACKGROUND_WASM="${BUILD_BACKGROUND_WASM:-1}"
BUILD_SWIFT_SCRIPT_WASM="${BUILD_SWIFT_SCRIPT_WASM:-1}"

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

if [[ "$BUILD_SWIFT_SCRIPT_WASM" == "1" ]]; then
  rm -rf "$SWIFT_SCRIPT_OUTPUT_DIR"

  swift package \
    --swift-sdk "$SDK_ID" \
    --allow-writing-to-package-directory \
    js \
    --product WASMSwiftScriptRunner \
    --use-cdn \
    --configuration release \
    --output "$SWIFT_SCRIPT_OUTPUT_DIR"
fi
