#!/usr/bin/env bash
# Every GF game test, from source. Green here is the bar for every commit to gf/ (docs/GF_REWRITE_PLAN.md, "Rules").
#   parity  : the arena build vs the REAL 460 C engine (gf/ref/c460: tag 460 + the shankpit-460 fixes, see gf/ref/README.md), tick for tick
#   engine  : module hygiene, screens, input, bot matches, the wire protocol, determinism
#   soak    : bots at every level keep fighting and moving
#   survival: SURVIVAL played headlessly (city, waves, zombies, pickups, chests, death, AGAIN)
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$PATH"
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
scripts/gf_build.sh gf/arena.modules "$W/arena.wasm"
scripts/gf_build.sh gf/gf.modules "$W/gf.wasm"
gcc -O2 -ffp-contract=off -w -Igf/ref/c460/packages -o "$W/parity_ref" gf/ref/parity_ref.c -lm
echo "== parity (arena wasm vs the 460 C engine)"; node gf/tests/parity_test.mjs "$W/arena.wasm" "$W/parity_ref" gf/ref/v0_shankpit.map | tail -2
echo "== engine";   node gf/tests/engine_test.mjs "$W/arena.wasm" | tail -1
echo "== soak";     node gf/tests/bot_soak.mjs "$W/arena.wasm" 12000 | tail -1
echo "== survival (unified gf.wasm)"; node gf/tests/survival_test.mjs "$W/gf.wasm" | tail -1
