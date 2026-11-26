#!/usr/bin/env bash
# Every GF game test, from source. Green here is the bar for every commit to gf/ (docs/GF_REWRITE_PLAN.md, "Rules").
#   parity  : the arena build vs the REAL 460 C engine (gf/ref/c460: tag 460 + the shankpit-460 fixes, see gf/ref/README.md), tick for tick
#   engine  : module hygiene, screens, input, bot matches, the wire protocol, determinism
#   soak    : bots at every level keep fighting and moving
#   survival: SURVIVAL played headlessly (city, waves, zombies, pickups, chests, death, AGAIN)
#   router  : one gf.wasm starts a bot match and a survival run in the same session (G2)
#   modes   : the G3 registry is the only place the modes are named, and each row starts its mode
#   portals : V1, the Osaka garage portal ring is the legacy layer's table and it triggers
#   voxworld: V2, the garage and VOXWORLD are the 460 geometry, box for box
#   construct: V3, the garage -> voxworld construct with one bot per viewer
#   waterworld: W1, the garage's tanker gate, the faked sea and swimming
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$PATH"
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
scripts/gf_build.sh gf/arena.modules "$W/arena.wasm"
scripts/gf_build.sh gf/gf.modules "$W/gf.wasm"
gcc -O2 -ffp-contract=off -w -Igf/ref/c460/packages -o "$W/parity_ref" gf/ref/parity_ref.c -lm
echo "== parity (arena wasm vs the 460 C engine)"; node gf/tests/parity_test.mjs "$W/arena.wasm" "$W/parity_ref" gf/ref/v0_shankpit.map | tail -2
echo "== engine (arena build)"; node gf/tests/engine_test.mjs "$W/arena.wasm" | tail -1
echo "== engine (unified gf.wasm through the router)"; node gf/tests/engine_test.mjs "$W/gf.wasm" | tail -1
echo "== soak (unified gf.wasm)";   node gf/tests/bot_soak.mjs "$W/gf.wasm" 12000 | tail -1
echo "== survival (unified gf.wasm)"; node gf/tests/survival_test.mjs "$W/gf.wasm" | tail -1
echo "== router (arena + survival, one session)"; node gf/tests/router_test.mjs "$W/gf.wasm" | tail -1
echo "== modes (the G3 table)"; node gf/tests/modes_test.mjs "$W/gf.wasm" | tail -1
echo "== portals (the Osaka garage ring)"; node gf/tests/portals_test.mjs "$W/gf.wasm" | tail -1
echo "== voxworld (garage + voxworld geometry)"; node gf/tests/voxworld_test.mjs "$W/gf.wasm" | tail -1
echo "== construct (garage -> voxworld, one bot per viewer)"; node gf/tests/construct_test.mjs "$W/gf.wasm" | tail -1
echo "== waterworld (the tanker gate, the sea, swimming)"; node gf/tests/waterworld_test.mjs "$W/gf.wasm" | tail -1
