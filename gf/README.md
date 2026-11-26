# gf/: SHANKPIT rewritten in PARENA, from release 460

The plan of record is `../docs/GF_REWRITE_PLAN.md`.

| Path | What |
|---|---|
| `engine/` | The 460 engine in PARENA: physics (parity-tested against the 460 C engine, worst 5e-7), bots, a 640x360 software renderer, HUD, input, screens, the 460 matchmaking client, and the mod surface (`sp_mods.prn`). Copied from `PARENA/stdlib/shankpit460` at PARENA `ee07efe`; it evolves here now. |
| `modes/survival/` | SURVIVAL as a level (`sv_city.prn`) plus mods (`sv_mod.prn`) |
| `ref/` | The 460 C reference used by the parity test (see `ref/README.md`) |
| `tests/` | parity, engine, soak, survival |
| `arena.modules`, `survival.modules` | Build manifests |

```bash
scripts/gf_build.sh gf/survival.modules /tmp/survival.wasm    # one module (needs ../PARENA and LLVM 18)
scripts/gf_test.sh                                            # everything
```

Status (2026-11-26): the arena and SURVIVAL build and pass (parity 40/40 scenarios, engine 73, soak ok, survival 31). There is no
menu system, playground, native client or queue client yet; those are the plan's Milestones 1-4.
