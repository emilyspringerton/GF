# Open questions for the founder

Agents: add a line per question: date, task ID, the question, what you did instead. The founder answers inline.

- 2026-11-26 · G1 · **GitHub push credentials are missing on this box.** `gh auth status` reports no login and `git push` has no
  credential helper, so `cb40a46` (G1, suite green) is committed locally but not pushed. Please push it, or give the agent a token.
  Nothing else in G1 is blocked; the work and its test are in the commit.

- 2026-11-26 · G2/G3 · **Still no push credentials.** `git push origin master` fails with `could not read Username for
  'https://github.com'`; `58f83b1` (G2, S1) and `edadd8f` (G3) are local only, suite green. Same ask as the G1 line: a token, or
  push the three commits.

- 2026-11-26 · G2/G3 · **Where does in-game NOCK level editing belong?** The NOCK server and its browser editor are in GF
  (`tools/local_nock.prn`, `tools/nock_editor.html`, `levels/*.json`), and Gary's C layer already has the custom-level scene and
  level-mod transitions (`SCENE_CUSTOM_LEVEL`, `packages/world/level_boxes.h`). The PARENA game (`gf.wasm`) does not read JSON
  levels at all: its maps are compile-time data in `gf/engine/sp_map*.prn`. So "build levels in the actual game, from the
  SHANKPHONE's webview" needs three things that are not in the plan yet: (1) a JSON level -> engine box/spawn loader, (2) engine
  exports for an edit mode (pick a box, move/resize it, save), (3) a SHANKPHONE surface that opens NOCK next to the game. I did not
  start any of it under G2/G3. Should this become its own milestone (N1-N3) after M1, or replace part of P (playground)?

- 2026-11-26 · V6 · **Twitch OAuth through IDUNA, the WOTAN viewer feed, and the stream ingest.** The construct's game
  side is in (V3: `gf_viewer_set(n)` seats one bot per viewer), but the host side is founder-only: which Twitch scopes
  IDUNA should request, whether WOTAN already exposes a viewer list (EventSub/IRC) or needs one, and where the broadcast
  feed should point (`packages/render/stream_out.h` sends RTMP to any target). I did not invent an endpoint or a token
  flow. Please say the shape (webhook, polled count, or chat relay) and the stream key env var, or wire it in WOTAN and
  hand this repo the count.

- 2026-11-26 · V4/V5 · **Voxworld fidelity: 460 box city now, or the later OG terrain + vehicles?** V2 ported release
  460's `init_voxworld_city_geo` (107 boxes, no terrain, no vehicle bodies -- 460's `in_vehicle` is a speed class, not an
  entity). The heightfield (`voxworld_height_at`, `terrain_sample_height`) and the `VEH_*` bodies live only in the later
  OG tree (`04967da`) and need a ground-height hook in the physics path (E3-sized). V4/V5 are scoped in the plan but not
  started. Which do you want the construct to be: the 460 city it has now, or the OG terrain first?

- 2026-11-26 · V1-V3 · **Push is still blocked, now in two repos.** GF has `06c7cca` (V1), `8bed6d6` (V2), `c3886a8` (V3)
  and the docs commit on top, suite green; PARENA has `a5d132a` (REDGARDEN camera + 460 palette, 17/17) on `main`. Both
  `git push` calls fail with `could not read Username for 'https://github.com'`. Same ask as the earlier lines: a token or
  a push from a box that has one.
