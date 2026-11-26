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
