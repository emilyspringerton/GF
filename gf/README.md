# gf/: SHANKPIT rewritten in PARENA, from release 460

The plan of record is `../docs/GF_REWRITE_PLAN.md`.

| Path | What |
|---|---|
| `engine/` | The 460 engine in PARENA: physics (parity-tested against the 460 C engine, worst 5e-7), bots, a 640x360 software renderer, HUD, input, screens, the 460 matchmaking client, and the mod surface (`sp_mods.prn`). Copied from `PARENA/stdlib/shankpit460` at PARENA `ee07efe`; it evolves here now. |
| `modes/survival/` | SURVIVAL as a level (`sv_city.prn`) plus mods (`sv_mod.prn`) |
| `modes/router.prn` | Owns the engine's 14 `mod-*` hooks, routes them on `g-gf-mode`, and exports `gf-mode` / `gf-mode-set` |
| `ref/` | The 460 C reference used by the parity test (see `ref/README.md`) |
| `tests/` | parity, engine, soak, survival, router |
| `gf.modules` | The unified build: engine + every mode + router + `sp_main` |
| `arena.modules` | The parity build (no router, no modes) |

```bash
scripts/gf_build.sh gf/gf.modules /tmp/gf.wasm   # the game (needs ../PARENA and LLVM 18)
scripts/gf_test.sh                               # everything
```

Status (2026-11-26): one `gf.wasm` boots into the arena and switches to SURVIVAL at runtime (`gf-mode-set`); the router test plays
both modes in one session (28/28) and SURVIVAL passes against the same binary (31/31). The arena parity build still passes 40/40
scenarios, engine 73/73 and soak. There is no menu system, playground, native client or queue client yet; those are the plan's
Milestones 1-4.
