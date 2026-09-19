// Isolated execution: a fresh worker and WASM memory for every Run.
importScripts('/browser-runtime/swift-runtime.js?v=20260919', '/wasm-signatures.js?v=20260919');
const assetVersion = '20260919';
let lines = 0;
let characters = 0;
function appendOutput(text) {
  text = String(text);
  if (++lines > 1000 || (characters += text.length) > 100000) throw new Error('Output limit reached (1,000 lines / 100 KB).');
  postMessage({type: 'output', text});
}
self.onmessage = async ({data: {source}}) => {
  try {
    const module = await MiniSwiftWasm({
      locateFile: () => '/browser-runtime/swift-runtime.wasm?v=20260919',
      print: appendOutput, printErr: appendOutput,
    });
    const encoded = new TextEncoder().encode(source);
    if (encoded.length >= module._ms_src_buf_size()) throw new Error('This snippet is too large.');
    const pointer = module._ms_get_src_buf();
    module.HEAPU8.set(encoded, pointer);
    module.HEAPU8[pointer + encoded.length] = 0;
    postMessage({type: 'status', text: 'Compiling…'});
    module._ms_compile(encoded.length);
    const errors = [];
    for (let i = 0; i < module._ms_error_count(); i++) {
      errors.push(`${module._ms_error_line(i)}:${module._ms_error_col(i)} ${module.UTF8ToString(module._ms_error_message(i))}`);
    }
    if (errors.length) throw new Error(errors.join('\n'));
    const wasmPointer = module._ms_emit_wasm(0);
    const size = module._ms_wasm_size();
    if (!wasmPointer || !size) throw new Error(module.UTF8ToString(module._ms_last_error()) || 'This snippet could not be compiled.');
    postMessage({type: 'status', text: 'Running…'});
    await runGeneratedWasm(module.HEAPU8.slice(wasmPointer, wasmPointer + size));
    postMessage({type: 'done'});
  } catch (error) {
    postMessage({type: 'error', text: error.message || String(error)});
  }
};

  async function runGeneratedWasm(wasmBytes) {
    const memory = new WebAssembly.Memory({ initial: 256, maximum: 32768 });
    let heap = new Uint8Array(memory.buffer);
    const view = () => new DataView(memory.buffer);
    const refreshHeap = () => {
      heap = new Uint8Array(memory.buffer);
    };
    let pendingText = "";

    const imports = {
      wasi_snapshot_preview1: {
        fd_write(_fd, iov, iovCount, writtenPointer) {
          refreshHeap();
          const dataView = view();
          let written = 0;
          let chunk = "";

          for (let index = 0; index < iovCount; index += 1) {
            const pointer = dataView.getUint32(iov + index * 8, true);
            const length = dataView.getUint32(iov + index * 8 + 4, true);
            const bytes = new Uint8Array(memory.buffer, pointer, length);
            chunk += new TextDecoder().decode(bytes.filter((byte) => byte !== 0));
            written += length;
          }

          pendingText += chunk;
          let newlineIndex = pendingText.indexOf("\n");
          while (newlineIndex !== -1) {
            appendOutput(pendingText.slice(0, newlineIndex));
            pendingText = pendingText.slice(newlineIndex + 1);
            newlineIndex = pendingText.indexOf("\n");
          }

          dataView.setUint32(writtenPointer, written, true);
          return 0;
        },
        proc_exit(code) {
          throw new Error(`Program exited (${code}).`);
        },
        clock_time_get(clock, _precision, pointer) {
          const milliseconds = clock === 0 ? Date.now() : performance.now();
          view().setBigUint64(pointer, BigInt(Math.floor(milliseconds * 1e6)), true);
          return 0;
        },
        fd_read() { return 8; },
        fd_close() { return 8; },
        fd_seek() { return 8; },
        environ_sizes_get(count, size) {
          view().setUint32(count, 0, true);
          view().setUint32(size, 0, true);
          return 0;
        },
        environ_get() { return 0; },
        random_get(bufferPointer, length) {
          refreshHeap();
          const bytes = heap.subarray(bufferPointer, bufferPointer + length);

          if (globalThis.crypto?.getRandomValues) {
            for (let offset = 0; offset < bytes.length; offset += 65536) {
              globalThis.crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + 65536, bytes.length)));
            }
          } else {
            for (let index = 0; index < bytes.length; index += 1) {
              bytes[index] = Math.floor(Math.random() * 256);
            }
          }

          return 0;
        },
      },
      env: {
        memory,
        __ms_step() {},

      },
      stdlib: {},
      Foundation: {},
    };

    const stdlibResponse = await fetch(`/browser-runtime/stdlib.wasm?v=${assetVersion}`, {
      cache: "force-cache",
    });
    if (!stdlibResponse.ok) {
      throw new Error(`Could not load Swift stdlib (${stdlibResponse.status}).`);
    }

    const stdlibBytes = new Uint8Array(await stdlibResponse.arrayBuffer());
    const stdlibModule = await WebAssembly.compile(stdlibBytes);
    const stdlibInstance = await WebAssembly.instantiate(stdlibModule, {
      env: {
        memory,
        emscripten_notify_memory_growth() {},
        ...Object.fromEntries(WebAssembly.Module.imports(stdlibModule)
          .filter(entry => entry.name.startsWith('__ms_vfs_'))
          .map(entry => [entry.name, () => { throw new Error('File access is not available in this playground.'); }])),
      },
      wasi_snapshot_preview1: imports.wasi_snapshot_preview1,
    });
    const exportedSignatures = wasmSignatures(stdlibBytes).exports;
    const exportedNames = Object.fromEntries(Object.keys(stdlibInstance.exports).map(name => [normalizedExportName(name), name]));
    for (const entry of wasmSignatures(wasmBytes).imports) {
      if (entry.module === 'env' && !entry.name.startsWith('__dec_')) continue;
      const exportName = exportedNames[entry.name];
      if (!exportName) continue;
      imports[entry.module] ||= {};
      imports[entry.module][entry.name] = bridgeWasmFunction(stdlibInstance.exports[exportName], exportedSignatures[exportName], entry.signature);
    }

    const generatedModule = await WebAssembly.compile(wasmBytes);
    for (const entry of WebAssembly.Module.imports(generatedModule)) {
      if (!(entry.name in (imports[entry.module] || {}))) {
        throw new Error(`Not supported in this playground: ${entry.module}.${entry.name}. Try MiniSwift Studio.`);
      }
    }

    const generatedInstance = await WebAssembly.instantiate(generatedModule, imports);
    try {
      if (generatedInstance.exports._start) {
        generatedInstance.exports._start();
      } else if (generatedInstance.exports.main) {
        generatedInstance.exports.main();
      }
    } catch (error) {
      if (pendingText.length > 0) {
        appendOutput(pendingText);
        pendingText = "";
      }
      throw new Error(`Runtime trap: ${error?.message || error}`);
    }

    if (pendingText.length > 0) {
      appendOutput(pendingText);
    }
  }

function normalizedExportName(name) {
  return name.startsWith('___') || (name.startsWith('_') && !name.startsWith('__')) ? name.slice(1) : name;
}
