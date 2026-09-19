/* ─────────────────────────────────────────────────────────────────────────
   metal-bridge.js — clean wrapper around msl_compiler.wasm

   Exposes:
     await loadMetalCompiler()       → resolves with the bridge object
     bridge.transpile(metalSource)   → { ok, wgsl, mir, error, diagnostics }
     bridge.dispose()                → free the most recent result

   Language detection happens by ATTEMPTING the transpile — the C lexer +
   parser + sema in libMetal is the source of truth. If `result.ok` is true,
   the source is Metal; if false, it isn't. No regex sniffing.

   The bridge owns one MSLResult at a time and disposes the previous one
   before each new transpile.
   ───────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  let MOD = null;          // Emscripten module
  let loading = null;      // in-flight load promise
  let lastResult = 0;      // current MSLResult pointer (so we can free it)

  function _writeCString(str) {
    // Allocate room for UTF-8 + NUL, write the string, return pointer.
    const bytes = MOD.lengthBytesUTF8(str) + 1;
    const ptr = MOD._malloc(bytes);
    MOD.stringToUTF8(str, ptr, bytes);
    return ptr;
  }

  function _readSlice(ptr, len) {
    if (!ptr || !len) return '';
    return MOD.UTF8ToString(ptr, len);
  }

  function _collectDiagnostics(resultPtr) {
    const out = [];
    const count = MOD._msl_result_diagnostic_count(resultPtr);
    for (let i = 0; i < count; i++) {
      const msgPtr  = MOD._msl_result_diagnostic_message(resultPtr, i);
      out.push({
        message:    msgPtr ? MOD.UTF8ToString(msgPtr) : '(no message)',
        line:       MOD._msl_result_diagnostic_line(resultPtr, i),
        column:     MOD._msl_result_diagnostic_column(resultPtr, i),
        endLine:    MOD._msl_result_diagnostic_end_line(resultPtr, i),
        endColumn:  MOD._msl_result_diagnostic_end_column(resultPtr, i),
        severity:   MOD._msl_result_diagnostic_severity(resultPtr, i),
      });
    }
    return out;
  }

  async function loadMetalCompiler() {
    if (MOD) return _bridge();
    if (loading) return loading;
    loading = (async () => {
      // The Emscripten glue is a UMD that exposes MSLCompilerModule.
      if (typeof MSLCompilerModule !== 'function') {
        throw new Error('msl_compiler.js not loaded yet — include it before metal-bridge.js');
      }
      // Don't pass locateFile — Emscripten's default takes the directory of
      // the <script> that loaded msl_compiler.js (captured at IIFE time as
      // _scriptName) and prefixes it to "msl_compiler.wasm". Overriding to
      // `(p) => p` would request the WASM from the document root → 404.
      MOD = await MSLCompilerModule({
        print:    (t) => { /* swallow */ },
        printErr: (t) => { /* swallow */ },
      });
      return _bridge();
    })();
    return loading;
  }

  function _bridge() {
    return {
      transpile,
      lex,
      dispose,
    };
  }

  // ── Lexer-only pass — returns flat tokens for syntax highlighting.
  // Uses the same C tokenizer the compiler uses; no regex sniffing.
  // Token kinds match MSL_TOK_* in metal/src/internal/token.h:
  //   1 IDENTIFIER · 2 KEYWORD · 3 INTEGER_LIT · 4 FLOAT_LIT
  //   5 STRING_LIT · 6 CHAR_LIT · 7 OPERATOR · 8 PUNCT
  //   9 ATTR_OPEN · 10 ATTR_CLOSE · 11 PREPROCESSOR · 12 COMMENT
  function lex(metalSource) {
    if (!MOD) throw new Error('Metal compiler not loaded');
    const srcPtr = _writeCString(metalSource);
    let handle = 0;
    try {
      handle = MOD._msl_lex_wasm(srcPtr);
    } finally {
      MOD._free(srcPtr);
    }
    if (!handle) return [];
    const out = [];
    const n = MOD._msl_lex_count(handle);
    for (let i = 0; i < n; i++) {
      out.push({
        kind:   MOD._msl_lex_kind(handle, i),
        offset: MOD._msl_lex_offset(handle, i),
        length: MOD._msl_lex_length(handle, i),
      });
    }
    MOD._msl_lex_free_wasm(handle);
    return out;
  }

  function _freeLast() {
    if (lastResult) {
      MOD._msl_result_free(lastResult);
      lastResult = 0;
    }
  }

  function transpile(metalSource) {
    if (!MOD) throw new Error('Metal compiler not loaded — call loadMetalCompiler() first');
    _freeLast();

    const srcPtr = _writeCString(metalSource);
    const srcLen = MOD.lengthBytesUTF8(metalSource);
    let resultPtr = 0;
    try {
      resultPtr = MOD._msl_compile_wasm(srcPtr, srcLen);
    } finally {
      MOD._free(srcPtr);
    }

    if (!resultPtr) {
      return {
        ok: false,
        wgsl: '',
        mir: '',
        entryPoints: [],
        error: 'msl_compile_wasm returned NULL',
        diagnostics: [],
      };
    }

    lastResult = resultPtr;

    const ok = !!MOD._msl_result_ok(resultPtr);
    const wgsl = ok
      ? _readSlice(MOD._msl_result_wgsl(resultPtr), MOD._msl_result_wgsl_len(resultPtr))
      : '';
    const mir = ok
      ? _readSlice(MOD._msl_result_mir(resultPtr), MOD._msl_result_mir_len(resultPtr))
      : '';
    const errPtr = MOD._msl_result_error(resultPtr);
    const error = errPtr ? MOD.UTF8ToString(errPtr) : '';

    // Structural check on MIR — list functions whose qualifier marks them as
    // a GPU entry point (vertex / fragment / kernel). Used by the playground
    // to decide "is this actually Metal?" without sniffing the source.
    let entryPoints = [];
    if (mir) {
      try {
        const m = JSON.parse(mir);
        const fns = (m && (m.functions || (m.module && m.module.functions))) || [];
        entryPoints = fns
          .filter(f => f && f.qualifier && f.qualifier !== 'normal')
          .map(f => ({ qualifier: f.qualifier, name: f.name }));
      } catch (_) { /* malformed MIR — leave entryPoints empty */ }
    }

    return {
      ok,
      wgsl,
      mir,
      entryPoints,
      error,
      diagnostics: _collectDiagnostics(resultPtr),
    };
  }

  function dispose() {
    _freeLast();
  }

  global.loadMetalCompiler = loadMetalCompiler;
})(typeof window !== 'undefined' ? window : globalThis);
