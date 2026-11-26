# gf/ref: the 460 C reference

- `c460/packages/{common,simulation}/*.h`: headers from `github.com/emilyspringerton/shankpit-460`. This is tag `460` (`55b80f7`,
  2026-03-31, in this repo: `git show 460:...`) plus three fixes:
  1. `RESPAWN_DELAY_TICKS 180`, so a death survives into a snapshot.
  2. `map_loader.h`, which loads the arena from `v0_shankpit.map`.
  3. IDUNA connect tickets (`hmac_sha256.h`).
  Headers only: they are the engine (physics.h, net_sim.h, local_game.h, protocol.h), and `parity_ref.c` drives them.
- `parity_ref.c`: the C side of `gf/tests/parity_test.mjs` (from `PARENA/tests/shankpit460_parity_ref.c`).
- `v0_shankpit.map`: the arena both sides load. `gf/engine/sp_map_data.prn` is generated from it.

These are reference material: GF never ships them. Do not edit them to make a test pass.
