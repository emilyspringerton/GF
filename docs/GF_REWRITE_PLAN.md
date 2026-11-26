# GF: the SHANKPIT rewrite plan

Owner: the founder. Written 2026-11-26 (sess-20261126-1643-452c2f1a) so other agents (freebuff first) can work through it unattended.
This is the plan of record for GF. Every task has an ID, the files it touches, and a test that decides whether it is done.
**Start at "Rules for agents" and "Bootstrap", then take the first open task in "Order of work".**

---

## 1. What GF is

Founder, 2026-11-26:

> "if we're doing a rewrite start with shankpit 460 and add features from there it lines up with a specific release on github
> (tag 460) ... that's the original point of divergence for the rewrite ... shankpit is a huge surface lets get the menu system,
> survival mode, queue mode and engine stuff figured out first ... [SPGF] is basically a clean room PARENA rewrite ... we can have it
> set up like gary's mod where we have a playground and we can test out all the physics and affordances ... it should be like goat
> simulator"

GF is **SHANKPIT rewritten in PARENA, starting from release 460 and adding features forward**, with a **physics playground** as a
first-class mode: Garry's Mod style (spawn things, grab them, weld them, break them) with Goat Simulator's tone (silly, physical,
chaos is the point). The playground is an original design: no names, art, levels or characters from either game.

Where it came from: `garyredg/SPGF`, a fork of SHANKPIT taken 2026-11-05. Gary removed the C sources, kept the headers and began a
clean-room rebuild in PARENA (72 commits). It was pushed with its full history to `emilyspringerton/GF`. Gary's remote is kept as
`gary` (`git fetch gary`) so his later work can be merged.

## 2. The baseline: what "460" means

- **Tag `460`** is `55b80f7` (2026-03-31, "add katana weapon with blade dash ability"), and it is in this repo. Read any 460 source with
  `git show 460:<path>`, for example `git show 460:apps/lobby/src/main.c`. The whole of 460 is about 13k lines:
  - the client: `apps/lobby/src/main.c`, 2.2k lines;
  - the server: `apps/server/src/main.c`, 557 lines;
  - physics: `packages/common/physics.h`, 848 lines;
  - the wire: `packages/common/protocol.h`, 181 lines;
  - offline play: `packages/simulation/local_game.h`, 336 lines.
- **`shankpit-460`** (`github.com/emilyspringerton/shankpit-460`) is the 460 line as it is live today. It adds three small fixes to tag 460:
  1. **Respawn delay** (`RESPAWN_DELAY_TICKS 180`), so a death survives into a snapshot.
  2. **Map files** (`map_loader.h`, `maps/v0_shankpit.map`).
  3. **IDUNA connect tickets** (`hmac_sha256.h`; a 36-byte ticket appended to `PACKET_CONNECT`).
  It also adds the `emily-bot` pool. Its headers are vendored in **`gf/ref/c460/`**, and they are **the behavioural reference for GF**.
- **The 460 engine already exists in PARENA, and GF starts from it.** It is a line-for-line port of the online movement path
  (`gf/engine/`, about 4.9k lines, a copy of `PARENA/stdlib/shankpit460` at PARENA `ee07efe`):
  - **Parity:** across 40 scenarios and 2,223 player checkpoints, the worst difference from the C engine is 5e-7.
  - **Included:** a software renderer at 640x360, bots that perceive, the HUD, the title and end screens, and a matchmaking client.
  - **Build:** 207 KB of wasm with no imports and no allocator.
  - **Deployed:** live at `wotan.okemily.com/shankpit-460/`, and shipped as the shankpit-460 Android APK.
- **Already built on top of it** (`gf/modes/survival/`): **SURVIVAL**, as a level plus a set of mods through the engine's mod surface
  (`gf/engine/sp_mods.prn`, 14 hooks). It ships today as the SHANKPHONE's Survival button
  (`SHANKPIT/android-netkit`, `SHANKPIT/apps/netkit`).

**Where newer OG behaviour lives** (for porting features forward):
- `git show 04967da:<path>`: SHANKPIT master as Gary forked it (2026-11-05), the last tree in this repo that still has all the C.
- The live `../SHANKPIT` checkout: master today.

## 3. Decisions (made; change one only with the founder)

| # | Decision | Why |
|---|---|---|
| D1 | **The engine is `gf/engine/` (the PARENA 460 engine), and parity with 460 is protected by tests.** New behaviour is added as modes and mods, not by editing the parity path. | It already plays 460 exactly and runs on web, Android and the SHANKPHONE. Starting over would throw that away. |
| D2 | **The game's PARENA source lives in GF** (`gf/`). The compiler and the shared rule files stay in `../PARENA` (a sibling checkout; GF never forks the compiler). `PARENA/stdlib/shankpit460` stays as the WOTAN esports build. | One repo for the rewrite; agents work in one place. |
| D3 | **A mode is a level plus a mod set** (SURVIVAL is the precedent). One game binary holds every mode: the hooks become a **mode router** (task G2) that dispatches on the current mode. | The menu has to switch modes at runtime, and PARENA has no dynamic dispatch. |
| D4 | **Two hosts, one game module.** H-WASM: the browser, the SHANKPHONE and the Android WebView; it exists. H-NATIVE: Windows and Linux with SDL2 (task E2). The game module imports nothing, so the host is only a window, input, sound and sockets. | The PARENA-first rule: no game logic in a host. |
| D5 | **Rendering stays the 640x360 software rasterizer** until the playground needs more (E6 measures it first). No GL in the game module. | It runs everywhere with zero imports; GL is a host concern for later. |
| D6 | **Queue mode first targets the live 460 server** (`play.okemily.com` UDP 4600: 460's own wire, IDUNA tickets, 9 bots from emily-bot). The OG queue on 6969 (newer protocol) comes after. | 460 physics plus 460 wire means client prediction matches the server exactly. |
| D7 | **Gary's clean-room layer is kept and absorbed, not deleted.** It is `apps/game`, `packages/game`, `packages/sim`, `bazel/parena.bzl` and `docs/PARENA_GAPS.md`. His mod ABI (`packages/sim/mod_abi.prn`), REFLUX level mods (`packages/game/level_mods.prn`), net seam and capability handshake (`net_rules.prn`), and build-profile table become GF's runtime-mod and networking architecture in later milestones (G6, Q5). | It is real work, and his gaps document is the compiler backlog for D4's native build. |
| D8 | **Everything is PARENA-first.** No hand-written JavaScript in products, host C kept minimal, and third-party code only as a labelled stopgap with a replacement task. | Monorepo rule (root `CLAUDE.md`). |

## 4. Rules for agents (freebuff and anyone else)

1. **One task ID per commit**, and the commit subject names it: `feat(gf): G2 mode router`. Every commit message ends with a blank line, then
   `session: <tag>` (use your own session tag, or `session: freebuff-<date>`), then any trailers.
2. **`scripts/gf_test.sh` must be green before every commit.** Add your task's test to it in the same commit. A task is not done until its
   acceptance test is in the script and passes.
3. **Never edit the parity path to make a feature work.** That path is `gf/engine/sp_phys.prn`, `sp_sim.prn` `world-step!`, and
   `sp_map*.prn` data. Use a hook; if no hook fits, add one to `sp_mods.prn` with a no-op default, as the 14 existing hooks do.
4. **Globals:** every new `g-*` word or memory region goes in the table in §9 first. Overlaps are caught by `gf/tests/engine_test.mjs`
   and `survival_test.mjs`.
5. **Do not edit generated files.** The game's JS host is generated from `sp_host.prn`; regenerate it instead.
6. **Do not push to WOTAN or SHANKPIT `master` from GF work**, and do not touch the live servers, DNS, Vultr or Cloudflare. If a task needs
   one of those, write it in `docs/QUESTIONS.md` and move on.
7. **No secrets** in the repo, in logs or in commit messages. Tickets and tokens for tests come from environment variables.
8. **Stuck for more than an hour, or need a decision?** Write the question in `docs/QUESTIONS.md` with the task ID, then take the next task.
9. **Log as you go:** a dated bullet in `CHANGELOG.md` per task, and tick the task in §8 (`[x]`, with the commit hash).
10. **Honesty:** if something was not run (on a device, on Windows, against the live server), say so in the CHANGELOG.

## 5. Bootstrap (a fresh Linux box, no sudo)

```bash
# siblings: GF needs ../PARENA (compiler + shared rules); SHANKPIT is useful for reading the OG code
git clone git@github.com:emilyspringerton/GF.git && git clone git@github.com:emilyspringerton/PARENA.git
cd PARENA && make .parena-bootstrap && cd ..
# LLVM 18 (wasm backend) into ~/.local/opt/llvm-toolchain
mkdir -p /tmp/llvmdeb && cd /tmp/llvmdeb && apt-get download llvm-18 lld-18 libllvm18 liblld-18 \
  && for d in *.deb; do dpkg-deb -x "$d" ~/.local/opt/llvm-toolchain; done
# node >= 22.18 (the PARENA TS host build needs node:module stripTypeScriptTypes)
curl -fsSL https://nodejs.org/dist/v22.18.0/node-v22.18.0-linux-x64.tar.xz | tar -xJ -C ~/.local/opt \
  && ln -sf ~/.local/opt/node-v22.18.0-linux-x64/bin/node ~/.local/bin/node
export PATH=$HOME/.local/bin:$PATH
cd GF && scripts/gf_test.sh      # parity / engine / soak / survival: all must pass
```

`scripts/gf_build.sh <manifest> <out.wasm>` builds one module (`gf/arena.modules` for parity, `gf/gf.modules` for the game; a mode is
selected at runtime since G2, so there is no per-mode manifest).
For native work (E0+) you also need gcc and SDL2 headers. On a box without sudo, `BOOTSTRAP.md` in the monorepo root has the
`apt-get download` + `dpkg-deb -x` recipe.

## 6. The surface, in priority order

Founder: *"shankpit is a huge surface lets get the menu system survival mode queue mode and engine stuff figured out first."* So:
**Engine (E), Menu (M), Survival (S), Queue (Q)** first, then **Playground (P)**, then packaging (A) and everything else (F).

## 7. Tasks

Each task lists: **what** · **files** · **done when** (the acceptance test).

### G: game structure

- **G1 Unified manifest.** `gf/gf.modules` = the engine + every mode + `gf/modes/router.prn` + `sp_main`. Build `gf.wasm` with it.
  Done when `scripts/gf_build.sh gf/gf.modules` builds and `gf_test.sh` runs the survival test against `gf.wasm` (plus the arena tests
  against `arena.wasm`, which stays the parity build).
- **G2 Mode router.** Rename every SURVIVAL hook implementation in `gf/modes/survival/sv_mod.prn` from `mod-*` to `sv-mod-*`.
  `gf/modes/router.prn` then defines each `mod-*` hook as a `case` on a new global `g-gf-mode` (0 arena, 1 survival, 2 playground, 3 queue),
  calling `sv-mod-*`, `pg-mod-*`, and so on, and the no-op default for the arena. Done when one `gf.wasm` can start a bot match and a
  survival run in the same session (a new test `gf/tests/router_test.mjs`). The arena path through the router must still pass
  `engine_test` and `soak` when it is run against `gf.wasm`.
- **G3 Mode registry.** `gf/modes/modes.prn`: a table of mode id, name, a one-line description, a start function and whether it needs the
  network. The menu (M1) reads only this table. Done when the menu lists modes from the table, with no hard-coded mode strings in `gf/menu/`.
  *(Landed ahead of M1: the table, `gf-mode-*` words and `gf-mode-start(i)` are in, and `gf/tests/modes_test.mjs` starts every row and
  fails on a mode name hard-coded anywhere under `gf/`. M1 is the menu that has to consume it.)*
- **G4 Settings block.** A memory region (§9) of persisted settings: sensitivity, FOV, invert-Y, bot level, player name, volume, last mode.
  Two exports, `gf_settings_addr` and `gf_settings_len`; hosts save and load the bytes (browser `localStorage`, Android SharedPreferences
  through the bridge, a file on native). Done when a test round-trips the block and the game reads it at `sp_init`.
- **G5 Pause.** Esc, pad Start or the phone's Back opens a pause menu over play (M3). Bot match, survival and playground freeze; queue
  does not. Done when a test pauses, waits 500 ticks and sees no simulation tick in an offline mode.
- **G6 Runtime mods (later).** Adopt Gary's `mod_abi.prn` and REFLUX level-mod mask so a level can switch mods on and off at runtime
  without a rebuild. Design note first in `docs/GF_MODS.md`, then implement. Done when a level toggles a mod (for example low gravity)
  live, with a test.

### E: engine and hosts

- **E0 The C emitter reaches the engine.** (Compiler work in `../PARENA`, the D4 prerequisite.) Today `parena build x.c` rejects
  `cond` and typed `let` bindings (`(let [(x : F32) ...])`), and emits `load32`, `store32_`, `f32`, `i32`, `f64` as calls nothing
  defines; see `docs/PARENA_GAPS.md` 1-3. Make the C emitter accept both forms, and add `stdlib/c/parena_mem.h`: a fixed `uint8_t
  parena_mem[8 MB]` plus inline `load8/16/32/f32/f64` and `store*_` over it, and the numeric conversions. Done when
  `gf/gf.modules` compiles to C with `gcc -std=c11 -O2 -Wall -Werror`, and a C harness (`gf/tests/c_engine_test.c`) runs the same
  1,000-tick bot match as the wasm and gets the same `sp_ticks` and final player positions to the bit. PARENA tests stay green.
  *Stopgap if E0 stalls:* the native host runs `gf.wasm` through `wasm3` (vendored in SHANKPIT `third_party/wasm3`), labelled as a
  stopgap with E0 as its replacement.
- **E1 Build targets.** `Makefile` in GF with `gf-wasm`, `gf-native` (after E0), `gf-test`, and `gf-web` (wasm + generated host +
  `gf/web/index.html`). Done when `make gf-test` = `scripts/gf_test.sh`.
- **E2 Native host** `gf/hosts/native/gf_host.c`, SDL2 only:
  - **Window:** 1280x720, resizable; integer-scales the 640x360 framebuffer.
  - **Input:**
    - keys → `sp_key` (the browser `keyCode` values; there is a mapping table);
    - relative mouse → `sp_mouse`, with `sp_lock` while playing;
    - buttons → `sp_button`;
    - `SDL_GameController` → `sp_pad`.
  - **Sound:** plays the sound ring (E4).
  - **Clock:** a `SDL_GetTicks64` clock drives `sp_frame`.
  - **Settings:** the G4 block is saved to `gf_settings.bin`.
  - **Windows:** cross-built with mingw (Gary's `game-factory.yml` already does this for his client; reuse it).
  Done when Linux and Windows builds run, and a scripted Xvfb run (`gf/tests/native_smoke.sh`) boots, presses Enter, and finds the
  title and play screens are not blank (the SHANKPIT `ux_screenshot_test.sh` method).
- **E3 Bigger world limits.** 10 players → 32, 128 boxes → 512, 64 projectiles → 256. Move the memory regions (§9). Done when parity,
  engine, soak and survival are all green, and a new test fills 32 players and 512 boxes without overlapping regions.
- **E4 Sound.** The engine writes events into its sound ring (`sp_fx.prn` `snd!`). Write a PARENA synth that renders each event id to
  PCM in linear memory (`gf/engine/sp_synth.prn`, with export `gf_audio_render(frames)`), so every host only copies samples.
  The web host plays them through an AudioWorklet or ScriptProcessor (generated JS); native through an SDL audio callback; the
  SHANKPHONE through the same web path. Done when a test renders one second for each event id, checks it is non-silent and bounded,
  and the browser test hears samples (analyser RMS > 0).
- **E5 Frame budget.** Add `gf/tests/bench.mjs`: median and 95th-percentile ms per frame for arena, survival and playground at 640x360.
  The budget is under 8 ms median on the dev box (the current survival figure is 7 ms) so that a mid-range phone holds 30 fps. Fails
  the suite if any mode regresses more than 20% from `gf/tests/bench_baseline.json`.
- **E6 Renderer decision for the playground.** Measure 200 dynamic boxes under the software rasterizer. If they don't fit E5's budget,
  write `docs/GF_RENDER.md` with options: span buffers and occlusion in PARENA first; a GL/WebGL host path second, with the game
  emitting a draw list instead of pixels. Founder decides.

### M: menu system

The 460 lobby menu (`git show 460:apps/lobby/src/main.c`, `LOBBY_LABELS`) had DEMO (SOLO), BATTLE (BOTS), TEAM DM (BOTS), LAN CTF,
EVOLUTION and JOIN. The OG client later grew pages for GAMES, MODES (SURVIVAL, ZOMBIES, QUEUE, LEVELS, TYLER, LAB, EDIT MAP), APPS and
CUSTOMIZE (`git show 04967da:apps/lobby/src/main.c`, search `MODES_LABELS`). GF's menu is new, data-driven, and works the same with keys,
pad, mouse and touch.

- **M1 Menu core** `gf/menu/menu.prn`:
  - **Pages:** an id, a title, and items (label, kind = action / submenu / toggle / slider / text, target, enabled flag).
  - **Navigation:** a focus index, a back stack, and repeat-on-hold.
  - **Input:** arrows / WASD / D-pad / left stick move; Enter / Space / A select; Esc / B / phone Back go back; a pointer hover or tap
    focuses and activates.
  - **Drawing:** the engine's 2D kit (`sp_gfx.prn` `card`, `draw-text`) on a `sp_hud.prn`-style panel.
  - **Wiring:** replaces `render-title!` and `ui-click!` / `ui-keys!` for phase 0 through `mod-title!` and new hooks (`mod-ui-click!`,
    `mod-ui-keys!`).
  Done when `gf/tests/menu_test.mjs` drives every page by keys only, by pad only and by pointer only, and reaches every item.
- **M2 The page tree:**
  - **Title:** PLAY, PLAYGROUND, SETTINGS, QUIT on native only.
  - **PLAY:** QUEUE (online), SURVIVAL, BOT MATCH with an easy / normal / hard chip.
  - **SETTINGS:** sensitivity, FOV, invert-Y, volume, name, controls help.
  Done when every item starts the right mode through the G3 table (asserted in `menu_test`).
- **M3 In-game pause** (from G5): RESUME, SETTINGS, QUIT TO MENU. Done when it is tested from each mode.
- **M4 End screens.** One shared end-screen layout: the mode's headline, a stats table and AGAIN / MENU. SURVIVAL's `mod-end!` and the
  arena's `render-end!` both use it. Done when both end screens render through it (screenshot test, not blank, buttons respond).
- **M5 Touch layout data.** Expose the HUD's safe rectangles from the game (`gf_hud_rect(i)`) so hosts place touch controls without
  covering the health or ammo panels. Today the SHANKPHONE hard-codes 64 px. Done when the SHANKPHONE reads it (A1).

### S: survival

Reference: the OG C survival code.
- `git show 04967da:packages/simulation/witness_ai.c`, from line 2254: the waves.
- `git show 04967da:apps/lobby/src/main.c`: `lobby_start_survival_mode` and `lobby_survival_guns_tick`.
- `gun_items.c`, `chests.c`, `zombie_taxonomy.c` and `zombie_brain*.c` in `packages/simulation/`.
The current deviations are listed in `gf/modes/survival/README.md`.

- **S1 Behind the router** (with G2). Done when the survival test passes against `gf.wasm`.
- **S2 Zombie brain.** Moods (idle, wander, hunting, frenzied), the hunger and agitation inputs, and attack timing from the shared
  `../PARENA/stdlib/shankpit/zombie_brain_rules.prn` (already PARENA; the C client uses it). Done when a test sees the mood
  transitions under the stimuli the C tests use (`git show 04967da:packages/simulation/zombie_brain_rules_test.c`, if present;
  otherwise derive cases from the rules file).
- **S3 Zombie classes.** The walker, plus the taxonomy classes with HP and damage by level (`zombie_taxonomy.c`). Waves mix classes by
  wave number. Done when a test checks the class mix per wave and HP per class.
- **S4 16 zombie slots** (needs E3). Done when wave 5 (quota 19) runs with the C client's cap of 16 alive.
- **S5 City completeness.** The ring highway at r 520 with its guardrails and corner segments, and a 9x9 or larger grid if E5 allows.
  Hydrants and props are optional. Done when the box count and a collision test on the highway pass.
- **S6 Arsenal parity.**
  - Add the missile launcher as weapon 6 with a projectile, a blast radius and chest damage x2 (`chest_rules.prn` already prices it).
  - Make katana slashes hit chests.
  - Add the flashlight, with a dark night.
  Done when the tests cover each.
- **S7 Day/night.** `../PARENA/stdlib/shankpit/sky_rules.prn` and `day_night` from the C client: the sky colour and fog distance follow
  the clock, and the night spawns faster. Done when a test reads the fog distance and colour at four times of day.
- **S8 Scoring and best runs.** Store best wave and best time in the G4 block, and show them on the title and end screen.

### Q: queue mode (online)

- **Q1 The 460 wire in PARENA.** `gf/net/wire460.prn` encodes and decodes, byte for byte, the structs in
  `gf/ref/c460/packages/common/protocol.h`:
  - `NetHeader`, `UserCmd` (with `BTN_*`) and `NetPlayer`;
  - the packet types CONNECT (with the 36-byte ticket), USERCMD, SNAPSHOT, WELCOME and DISCONNECT.
  Read the server's send and receive code for the exact layout and packing: `gf/ref/c460` holds only headers, so read the server from
  the shankpit-460 repo, `apps/server/src/main.c`. Done when round-trip tests pass against packets produced by a C harness built from
  those headers (`gf/tests/wire460_ref.c`).
- **Q2 Client netcode.** Port 460's client side from `git show 460:apps/lobby/src/main.c`:
  - command history and sequence numbers;
  - prediction through the same `simulate-movement-tick!`;
  - reconciliation against `last_seq`;
  - remote interpolation (`rinterp`);
  - time sync and the spawn-transition sync.
  This all becomes a new GF mode, "queue", driven by `wire460`. Done when a local loopback test against a real 460 server built from the
  shankpit-460 sources (`make server` there; the source is not in GF) keeps the predicted position within 0.05 units of the server for
  10 seconds of scripted input.
- **Q3 Datagram pipe in hosts.** Exports `gf_net_out_addr` and `gf_net_out_len`, plus an inbox the host fills. Native: a UDP socket in
  `gf_host.c`. SHANKPHONE: new `udpOpen`/`udpSend`/`udpClose` streaming calls in `NativeBridge` (Java only pipes bytes, like `tcpOpen`).
  Browser: no UDP, so the 460 WebSocket matchmaker path stays (the engine already has it in `sp_net.prn`). Done when native and
  SHANKPHONE both reach the server in a test.
- **Q4 Tickets.** The host gets an IDUNA ticket: sign in (device flow or guest), then `POST /api/v1/shankpit/ticket` with a Bearer JWT,
  which returns the 36 bytes appended to CONNECT. Hosts do HTTPS; the game only receives the bytes (`gf_ticket_set`). Done when a test
  with `GF_TEST_TICKET` set connects to `play.okemily.com:4600` and is WELCOMEd. That test runs only when the env var is present; never
  commit a ticket.
- **Q5 Matchmaking UX.**
  - "SEARCHING..." while queued: the 460 flow is a bot match while you search (`sp_ui.prn` `begin-session!`).
  - "MATCH FOUND", then join.
  - The end screen offers REQUEUE.
  - Disconnect and timeout screens.
  Later, Gary's capability handshake and interest filtering (`packages/game/net_rules.prn`) come in when GF's own server exists.
  Done when the scripted flow test passes against a local server.
- **Q6 (later) OG queue on 6969.** The newer protocol (WOW wire, modes such as 108): needs its own wire module. A separate milestone.

### P: playground (Garry's Mod structure, Goat Simulator spirit)

A sandbox mode: one big open level for throwing physics around and testing every affordance. SHANKPIT's backlog section 644
(RB-0..3) is the same request from 2026-11-24, and GF absorbs it.

- **P0 Affordance audit (RB-0).** Write `docs/GF_AFFORDANCES.md`: a ledger of physics, material, rigid-body, brick, debris, gravity,
  vehicle, ragdoll and pickup capabilities in `../PARENA/stdlib` and in OG SHANKPIT (`git show 04967da:packages/simulation/*`). For each:
  surfaced in the game or not, and what it would take. Done when the ledger exists with a source line reference per row.
- **P1 Playground level and mode.** `gf/modes/playground/`:
  - **Level:** a flat open field with ramps, a quarter-pipe, a seesaw, stacked crates, a ledge course, a pool (low friction) and a
    trampoline pad.
  - **Rules:** no enemies, no deaths (you ragdoll and get up), free movement, and a noclip toggle (V).
  Done when the mode starts from the menu and a test walks the course.
- **P2 Rigid bodies v1** `gf/physics/rb.prn` (in GF first; promote to PARENA stdlib once stable):
  - axis-aligned boxes with mass, gravity, friction and restitution;
  - box-box and box-world contacts, stacking with sleep, and player push;
  - up to 128 bodies in a fixed memory region.
  The engine's static map boxes stay as they are; bodies are a separate set. Done when headless tests show: energy does not grow with
  no input; a 10-high stack stands still for 10 s; a dropped box bounces with restitution e; heavier pushes lighter.
- **P3 Materials (RB-1).** A table for wood, steel, concrete, rubber, foam, ice, glass and explosive, each with density, friction,
  restitution, break threshold and sound. "Material estimation": mass and inertia from size x density. Done when the tests compare
  mass ratios, rubber against concrete bounce, and ice against wood slide distance.
- **P4 Grab gun (RB-2).** Hold E or right mouse to pick up a body (mass-limited), carry it on a spring at a distance (scroll changes
  the distance), throw it with fire, punt it with a fire tap. Done when tests cover pick, carry, throw speed by mass, and refusing a
  body that is too heavy.
- **P5 Spawn menu.** Q opens a grid: crates by material and size, a ramp, a barrel, a ball, a plank. Click to spawn at the crosshair;
  Z undoes the last spawn; there is a clear-all. A menu page built with M1. Done when tests spawn each item, undo, and clear.
- **P6 Rotation (RB v2).** Oriented boxes with angular velocity and torque from off-centre hits, so things tumble. Done when a plank
  on a fulcrum tips when a weight is added (the seesaw) and the tests stay stable.
- **P7 Tools.** Weld (two bodies become one compound), rope (distance constraint) and thruster. Gary's-mod-style tool gun on slot 6.
  Done when there is a test per tool.
- **P8 The goat.** A playable creature mode in the playground (C switches between person and goat):
  - **Headbutt:** a short-range impulse that scales with run speed.
  - **Tongue grab:** a sticky spring to any body; you can drag things around, or swing from them.
  - **Ragdoll on hard landings.**
  - **Slow-mo** on a key.
  - **Chaos score:** points for knocking things over, airtime, flips, and a combo multiplier.
  Original names and art only. Done when tests check the headbutt impulse against speed, that the tongue holds a body, that a fall
  over a threshold ragdolls, and that the score is deterministic for a scripted run.
- **P9 Breakables and explosives.** Glass shatters into debris bodies (a pool, with lifetime); explosive barrels push bodies in a radius
  and break nearby glass. Done when tests check the debris count and the falloff of the explosion impulse.
- **P10 Vehicles in the sandbox.** Port the buggy from 460 (`git show 460:packages/common/physics.h` `VEH_BUGGY`) as a drivable body.

### V: the construct, portals and voxworld (founder 2026-11-26)

Founder, 2026-11-26: *"do we have the legacy portal system from osaka garage set up? we need the construct set up such
that if we are oauthed into TWITCH via IDUNA and WOTAN then we can have a stream powered construct where it spawns in
bots for every viewer in my stream also i want OG voxworld ported with the terrain and vehicles"*. This milestone is
that request, scoped: the garage hub and its ring first, then the 460 voxworld, then the viewer seats, then what the
OG has that 460 does not (terrain, vehicle bodies), then the Twitch side that is the founder's to provide.

- **V1 Osaka garage and its portals.** `gf/modes/portals.prn` (the legacy table: `server/system/portal.go`
  `ScenePortals`/`ResolvePortalDestination` + `physics.h` `PORTAL_ID_*`) and `gf/modes/construct/garage.prn`
  (`map_geo_garage`, `scene_spawn_point(SCENE_GARAGE_OSAKA)`, `garage_vehicle_pads`). Portals are a circle test
  with an inclusive boundary and a destination scene/point; scenes are `g-map-id` (0 arena, 2 dust, 4 garage,
  5 voxworld), and a legacy scene with no GF map resolves to -1 rather than a wrong scene. Done when
  `gf/tests/portals_test.mjs` compares the rows to the Go table, checks inside/boundary/outside triggering and
  every destination.
- **V2 VOXWORLD.** `gf/modes/construct/voxworld.prn`: 460's `init_voxworld_city_geo` (seed 1337, 220/50 blocks,
  9x9 grid, central cross, 107 boxes) and `scene_spawn_point(SCENE_VOXWORLD)` / `VOXWORLD_PORTAL_*`. This is the
  460 box city, **not** the later OG heightfield (V4). Done when `gf/tests/voxworld_test.mjs` compares every
  box to the C formula and the C array (garage 18, voxworld 107) and checks the plaza, the wall and the spawns.
- **V3 CONSTRUCT mode.** `gf/modes/construct/construct.prn` + mode id 4: starts in the garage, the (48, 0) portal
  lands at the legacy (-420, 8, 180), viewers are seated one per bot (7 slots, the rest wait), the voxworld ring
  returns to the garage (no stadium scene in GF yet, named not hidden). Host seam: `gf_viewer_set(n)`,
  `gf_viewer_count()`, `gf_viewer_waiting()`. Done when `gf/tests/construct_test.mjs` walks garage -> voxworld ->
  garage and tests 0/2/9/12 viewers and a moving viewer bot.
- **V4 Terrain.** The later OG heightfield (`voxworld_height_at`, `terrain_sample_height`, `g_scene_terrain`) as an
  engine surface: needs a ground-height hook in `sp_phys`/`sp_sim` and a map-data channel, i.e. E3-sized work.
  Done when a slide, a jump and a spawn on a 1:1 heightfield match a C reference. **Not started.**
- **V5 Vehicle bodies.** 460 had no vehicle entities -- `in_vehicle` was a speed class -- so this ports the OG
  buggy/landship bodies from `git show 04967da:packages/common/physics.h` (`VEH_*`) onto the three garage pads.
  Done when a test drives one off a pad and its collision, speed and exit match the C rules. **Not started.**
- **V6 The stream itself (founder).** Twitch OAuth through IDUNA, the WOTAN viewer feed and the ingest the
  broadcast feed targets (`packages/render/stream_out.h` already sends RTMP). Founder-only credentials; see
  `docs/QUESTIONS.md`. Done when a real stream's viewer count reaches `gf_viewer_set` and the STREAM mode's
  overlay shows a handle per seat.

### A: packaging and distribution

- **A1 The SHANKPHONE plays `gf.wasm`.** `SHANKPIT/apps/netkit` loads `gf.wasm` instead of `survival.wasm`; the Survival object opens
  the GF menu at PLAY → SURVIVAL, and a new Playground object opens PLAYGROUND. Then remove `PARENA/stdlib/shankpit_survival`, which GF
  supersedes. (A cross-repo task: GF builds it, SHANKPIT vendors it, PARENA's `build_netkit_web.sh` is pointed at GF.) Done when the
  netkit browser test passes with `gf.wasm`.
- **A2 Web page.** `gf/web/index.html` + the generated host (from `sp_host.prn`, adapted for G4 and E4). Done when it is served locally
  and Chromium plays it (a copy of the netkit browser test).
- **A3 Releases.** A GitHub Actions job in GF builds `gf.wasm`, the web bundle and the native Windows/Linux clients, and attaches them
  to a release with a CONSTRUCT file (monorepo Principle 21; Gary's `game-factory.yml` is the starting point).

### F: later, after E/M/S/Q/P

TDM and CTF with bots (460 had both), EVOLUTION, the remaining scenes (Stadium, Oil Tanker, Poo Poo Island; Garage Osaka and Voxworld
are V), story, the level editor, NOCK levels, IDUNA stats and leaderboards, skins, vehicle bodies beyond the garage pads. Each becomes a
mode or mod in the same shape. Scope them one at a time with the founder.

## 8. Order of work (take the first open one)

Milestone 1, **one game, three modes** (offline):
- [x] G1 (`cb40a46`) · [x] G2 (`58f83b1`) · [x] S1 (`58f83b1`) · [x] G3 (`edadd8f`) · [ ] M1 · [ ] M2 · [ ] G4 · [ ] G5/M3 · [ ] M4 · [ ] P1 (field only) · [ ] E5 · [ ] A2

Milestone 2, **native desktop**:
- [ ] E0 (in PARENA) · [ ] E1 · [ ] E2 · [ ] E4 · [ ] A3

Milestone 3, **queue**:
- [ ] Q1 · [ ] Q2 · [ ] Q3 · [ ] Q4 · [ ] Q5

Milestone 4, **playground physics**:
- [ ] P0 · [ ] E6 · [ ] P2 · [ ] P3 · [ ] P4 · [ ] P5 · [ ] P6 · [ ] P8 · [ ] P9 · [ ] P7

Milestone 5, **survival parity and the bigger world**:
- [ ] E3 · [ ] S2 · [ ] S3 · [ ] S4 · [ ] S5 · [ ] S6 · [ ] S7 · [ ] S8

Milestone 6, **the construct, portals and voxworld**:
- [x] V1 (`06c7cca`) · [x] V2 (`8bed6d6`) · [x] V3 (`c3886a8`) · [ ] V4 · [ ] V5 · [ ] V6

Ships to phones:
- [ ] A1 (after Milestone 1) · [ ] M5

Founder-only items: Vultr, DNS, store listings, signing keys, anything that costs money; anything in `docs/QUESTIONS.md`.

## 9. Memory map and global words (the engine's, plus what GF has claimed)

The linear memory is a fixed 8 MB (`gf/engine/sp_mem.prn` has the full map):

| Region | What |
|---|---|
| `0x020000` | CTL (input) |
| `0x021000` | G (global words; 1024 of them) |
| `0x022000` | players |
| `0x024000` | projectiles |
| `0x025000` | tracers |
| `0x026000` | particles |
| `0x028000` | map boxes |
| `0x029000` | spawns |
| `0x02A000` | names |
| `0x02B000` / `0x02D000` | net in / out |
| `0x02F000` | token |
| `0x030000` | font |
| `0x031000` | feed |
| `0x032000` | board |
| `0x033000` | 3D scratch |
| `0x100000` | framebuffer |
| `0x200000` | depth buffer |
| `0x300000` | sound ring |

Claimed by GF:

| Range | Owner |
|---|---|
| G words 600..639 | survival (`sv_mod.prn`) |
| G words 640..659 | router and menu: 640 is `g-gf-mode` (G2), 641..659 reserved for M1 |
| G words 660..699 | queue (Q; reserve) |
| G words 700..759 | playground (P; reserve) |
| G words 760..779 | construct (`construct.prn`: scene, on, viewers, bots, portals) |
| `0x080000`..`0x081FFF` | survival region (box colours, guns, chests, per-slot) |
| `0x083000`..`0x0831FF` | construct box colours (reserved by V3; boxes use the engine palette today) |
| `0x082000`..`0x082FFF` | settings block (G4) |
| `0x090000`..`0x0BFFFF` | rigid bodies (P2) |
| `0x0C0000`..`0x0FFFFF` | audio PCM out (E4) |

E3 moves the engine's own regions: update this table in the same commit.

## 10. Where things are (quick map)

| Path | What |
|---|---|
| `gf/engine/` | The 460 engine in PARENA (parity path: `sp_phys`, `sp_sim` `world-step!`, `sp_map*`) |
| `gf/modes/` | The router (`router.prn`), the mode registry (`modes.prn`, G3), the legacy portal table (`portals.prn`, V1), SURVIVAL (`survival/`) and CONSTRUCT (`construct/`: garage, voxworld, mode) |
| `gf/ref/c460/` | The 460 C reference headers (parity) · `gf/ref/parity_ref.c` · `gf/ref/v0_shankpit.map` |
| `gf/tests/` | parity, engine, soak, survival, router, modes, portals, voxworld, construct (node) |
| `gf/*.modules` | Build manifests (file lists, in order) |
| `scripts/gf_build.sh`, `scripts/gf_test.sh` | Build one module; run everything |
| `apps/game`, `packages/game`, `packages/sim`, `bazel/` | Gary's clean-room layer (D7) |
| `docs/PARENA_GAPS.md` | Compiler gaps Gary hit (E0 fixes 1-3) |
| `git show 460:...` | Release 460, the C original |
| `git show 04967da:...` | OG SHANKPIT master at the fork (all the later C) |
| `../PARENA/stdlib/shankpit/*_rules.prn` | Shared rule files (the C client uses them too); read-only from GF unless a task says otherwise |
