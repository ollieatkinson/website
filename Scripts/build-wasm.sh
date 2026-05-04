#!/usr/bin/env bash
set -euo pipefail

SDK_ID="${SWIFT_WASM_SDK_ID:-swift-6.3.1-RELEASE_wasm}"
OUTPUT_DIR="${1:-Assets/wasm}"

rm -rf "$OUTPUT_DIR"

swift package \
  --swift-sdk "$SDK_ID" \
  --allow-writing-to-package-directory \
  js \
  --product WASMBackgroundRender \
  --use-cdn \
  --configuration release \
  --output "$OUTPUT_DIR"
