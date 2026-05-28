#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "Assets/background.metal");
const outputPath = path.join(root, "Assets/background.wgsl");
const compilerPath = path.join(root, "Assets/miniswift/metal/msl_compiler.js");

const { default: loadCompiler } = await import(pathToFileURL(compilerPath));
const source = await fs.readFile(sourcePath, "utf8");
const compiler = await loadCompiler({
  print() {},
  printErr() {},
});

const length = compiler.lengthBytesUTF8(source);
const sourcePointer = compiler._malloc(length + 1);
compiler.stringToUTF8(source, sourcePointer, length + 1);

let resultPointer = 0;
try {
  resultPointer = compiler._msl_compile_wasm(sourcePointer, length);
} finally {
  compiler._free(sourcePointer);
}

if (!resultPointer) {
  throw new Error("msl_compile_wasm returned NULL");
}

try {
  const diagnostics = collectDiagnostics(compiler, resultPointer);
  if (!compiler._msl_result_ok(resultPointer)) {
    const errorPointer = compiler._msl_result_error(resultPointer);
    const error = errorPointer ? compiler.UTF8ToString(errorPointer) : "Metal compilation failed";
    throw new Error([error, ...diagnostics].filter(Boolean).join("\n"));
  }

  const wgslPointer = compiler._msl_result_wgsl(resultPointer);
  const wgslLength = compiler._msl_result_wgsl_len(resultPointer);
  const wgsl = normalizeWGSL(compiler.UTF8ToString(wgslPointer, wgslLength)).trimEnd();
  await fs.writeFile(
    outputPath,
    `// Generated from Assets/background.metal by Scripts/compile-metal-background.mjs.\n${wgsl}\n`,
    "utf8"
  );
} finally {
  compiler._msl_result_free(resultPointer);
}

function collectDiagnostics(compiler, resultPointer) {
  const diagnostics = [];
  const count = compiler._msl_result_diagnostic_count(resultPointer);

  for (let index = 0; index < count; index += 1) {
    const messagePointer = compiler._msl_result_diagnostic_message(resultPointer, index);
    const message = messagePointer ? compiler.UTF8ToString(messagePointer) : "(no message)";
    diagnostics.push(
      `${compiler._msl_result_diagnostic_line(resultPointer, index)}:${compiler._msl_result_diagnostic_column(
        resultPointer,
        index
      )} ${message}`
    );
  }

  return diagnostics;
}

function normalizeWGSL(wgsl) {
  return wgsl
    .replace("MiniSwift Metal Compiler", "Metal Compiler")
    .replace(
      /^fn vertexMain\((.*)\)\s*->\s*(?!@builtin\(position\)\s*)vec4f\s*\{/m,
      "fn vertexMain($1) -> @builtin(position) vec4f {"
    );
}

function pathToFileURL(filePath) {
  const resolved = path.resolve(filePath).replaceAll(path.sep, "/");
  const prefix = process.platform === "win32" ? "file:///" : "file://";
  return new URL(prefix + encodeURI(resolved));
}
