// Read numeric function types so the compiler's i64 Swift values can cross the
// C stdlib's i32 pointer ABI without guessing signatures by calling functions.
function wasmSignatures(bytes) {
  let offset = 8;
  const types = [], functionTypes = [], imports = [], exports = [];
  const byte = () => bytes[offset++];
  function uint() {
    let value = 0, shift = 0, next;
    do { next = byte(); value += (next & 127) * 2 ** shift; shift += 7; } while (next & 128);
    return value;
  }
  const vector = read => Array.from({length: uint()}, read);
  function name() { const size = uint(); const value = new TextDecoder().decode(bytes.subarray(offset, offset + size)); offset += size; return value; }
  function limits() { const flags = uint(); uint(); if (flags & 1) uint(); }
  while (offset < bytes.length) {
    const section = byte();
    const size = uint();
    const end = offset + size;
    if (section === 1) {
      vector(() => {
        if (byte() !== 0x60) throw new Error('Unsupported WASM function type');
        types.push({parameters: vector(byte), results: vector(byte)});
      });
    } else if (section === 2) {
      vector(() => {
        const module = name(), field = name(), kind = byte();
        if (kind === 0) {
          const type = uint(); functionTypes.push(type); imports.push({module, name: field, type});
        } else if (kind === 1) { byte(); limits(); }
        else if (kind === 2) limits();
        else if (kind === 3) { byte(); byte(); }
        else throw new Error('Unsupported WASM import kind');
      });
    } else if (section === 3) {
      functionTypes.push(...vector(uint));
    } else if (section === 7) {
      vector(() => { const field = name(), kind = byte(), index = uint(); if (kind === 0) exports.push({name: field, index}); });
    }
    offset = end;
  }
  return {
    imports: imports.map(entry => ({...entry, signature: types[entry.type]})),
    exports: Object.fromEntries(exports.map(entry => [entry.name, types[functionTypes[entry.index]]])),
  };
}

function bridgeWasmFunction(fn, target, caller) {
  if (target.parameters.length !== caller.parameters.length || target.results.length !== caller.results.length) {
    throw new Error('Incompatible compiler / stdlib function signature');
  }
  function convert(value, type) { return type === 0x7e ? BigInt(value) : Number(value); }
  return (...args) => {
    const result = fn(...args.map((value, index) => convert(value, target.parameters[index])));
    if (!caller.results.length) return;
    if (caller.results.length > 1) return result.map((value, index) => convert(value, caller.results[index]));
    return convert(result, caller.results[0]);
  };
}
