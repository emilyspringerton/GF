#!/usr/bin/env bash
# Builds one GF game module from a manifest (gf/*.modules) to wasm32: PARENA -> LLVM IR -> opt -> llc -> wasm-ld.
# The same guarantees as the shankpit-460 web build: no allocator, no imports, fixed 8 MB memory (asserted below).
#   scripts/gf_build.sh gf/survival.modules /tmp/gf/survival.wasm
# Needs: a sibling ../PARENA checkout (its .parena-bootstrap compiler; `make .parena-bootstrap` there builds it) and LLVM 18
# (opt, llc, wasm-ld, llvm-nm, llvm-objdump) at $LLVM_TOOLCHAIN_ROOT (default ~/.local/opt/llvm-toolchain, see BOOTSTRAP in docs/GF_REWRITE_PLAN.md).
set -euo pipefail
cd "$(dirname "$0")/.."
MAN="${1:?usage: gf_build.sh <manifest> <out.wasm>}"; OUT="${2:?usage: gf_build.sh <manifest> <out.wasm>}"
TC="${LLVM_TOOLCHAIN_ROOT:-$HOME/.local/opt/llvm-toolchain}"; BIN="$TC/usr/lib/llvm-18/bin"
export LD_LIBRARY_PATH="$TC/usr/lib/x86_64-linux-gnu:$TC/usr/lib/llvm-18/lib:${LD_LIBRARY_PATH:-}"
PARENA="${PARENA_BIN:-../PARENA/.parena-bootstrap}"
[ -x "$PARENA" ] || (cd ../PARENA && make .parena-bootstrap >/dev/null)
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
mapfile -t SRC < <(grep -v '^#' "$MAN" | grep -v '^$')
cat "${SRC[@]}" > "$W/all.prn"
"$PARENA" build "$W/all.prn" -o "$W/all.ll" >/dev/null
"$BIN/opt" -O2 -S "$W/all.ll" -o "$W/all.opt.ll"
"$BIN/llc" -O2 -mtriple=wasm32-unknown-unknown -filetype=obj "$W/all.opt.ll" -o "$W/all.o"
if "$BIN/llvm-nm" "$W/all.o" | grep -Eqw '(malloc|calloc|realloc|free|sbrk|brk)'; then echo "FAIL: an allocator symbol is present" >&2; exit 1; fi
if "$BIN/llvm-objdump" -d "$W/all.o" | grep -Eq 'memory\.grow'; then echo "FAIL: memory.grow present" >&2; exit 1; fi
mkdir -p "$(dirname "$OUT")"
"$BIN/wasm-ld" --no-entry --export-all --allow-undefined --export-memory \
  --initial-memory=8388608 --max-memory=8388608 -z stack-size=65536 -o "$OUT" "$W/all.o"
node --input-type=module -e "
import fs from 'node:fs';
const imp = WebAssembly.Module.imports(new WebAssembly.Module(fs.readFileSync(process.argv[1])));
if (imp.length) { console.error('FAIL: imports ' + JSON.stringify(imp)); process.exit(1); }" "$OUT"
echo "built $OUT ($(wc -c < "$OUT") bytes, 0 imports, fixed 8 MB)"
