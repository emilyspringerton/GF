// gf/tests/construct_test.mjs -- V3: CONSTRUCT is a mode that starts in the garage, walks the portal ring
// into the voxworld, and seats one bot per viewer the host reports.
//   node gf/tests/construct_test.mjs <gf.wasm>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const wasmPath = process.argv[2];
if (!wasmPath) { console.error('usage: construct_test.mjs <gf.wasm>'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS: ' : 'FAIL: ') + m); };

const fields = {};
for (const m of fs.readFileSync(path.join(here, '../engine/sp_fields.prn'), 'utf8').matchAll(/\(defn k-([a-z0-9-]+) \[\] : I32 (\d+)\)/g)) fields[m[1]] = +m[2];
const G = { mode: 3, phase: 16, boxN: 127, spawnN: 128, mapId: 108, wantQueue: 77 };

const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasmPath), {});
const x = instance.exports;
x.sp_init();
const dv = () => new DataView(x.memory.buffer);
const gi = (k) => dv().getInt32(135168 + k * 4, true);
const pi = (p, k) => dv().getInt32(x.sp_player_addr(p) + fields[k] * 4, true);
const pf = (p, k) => dv().getFloat32(x.sp_player_addr(p) + fields[k] * 4, true);
const bots = () => { let n = 0; for (let p = 1; p <= 7; p++) if (pi(p, 'active') && pi(p, 'is-bot')) n++; return n; };
const name = (p) => { const a = 172032 + p * 32; let s = ''; for (let i = 0; i < 20; i++) { const c = dv().getUint8(a + i); if (!c) break; s += String.fromCharCode(c); } return s; };

// ---- the mode starts in the garage -----------------------------------------------------------------------------------------------
x.gf_mode_set(4);
ok(x.gf_mode() === 4, 'gf_mode_set(4) selects CONSTRUCT');
ok(gi(G.phase) === 0 && gi(G.mapId) === 4 && gi(G.boxN) === 18, `it returns to the title screen on the garage (map ${gi(G.mapId)}, ${gi(G.boxN)} boxes)`);
ok(x.gf_construct_scene() === 4 && x.gf_construct_bots() === 0, 'the garage is loaded and no bots are seated');
ok(gi(G.wantQueue) === 0, 'the construct does not ask the page for a matchmaking socket');

// the registry row starts it the same way
x.gf_mode_set(0);
x.gf_mode_start(3);
ok(gi(G.phase) === 1 && x.gf_mode() === 4 && gi(G.mapId) === 4, 'registry row 3 (CONSTRUCT) starts a garage session');
ok(pi(0, 'active') === 1 && Math.abs(pf(0, 'x') + 20) < 0.01 && Math.abs(pf(0, 'z') - 20) < 0.01,
  'the local player stands on garage spawn 0 (-20, 20)');
ok(x.gf_viewer_waiting() === 0 && x.gf_construct_bots() === 0, 'with no viewers, no bots');

// viewers cannot be in the garage: seats are for the voxworld
x.gf_viewer_set(9);
ok(x.gf_viewer_count() === 9 && x.gf_construct_bots() === 0 && bots() === 0, 'nine viewers in the garage seat no bots');

// ---- through the portal into the voxworld -----------------------------------------------------------------------------------------
x.sp_t_place(0, 48, 2, 0, 0, 0);
x.sp_t_play(1);
ok(x.gf_construct_scene() === 5, 'walking into the (48, 0) gate switches to the voxworld');
ok(gi(G.mapId) === 5 && gi(G.boxN) === 107, `the voxworld is loaded (map ${gi(G.mapId)}, ${gi(G.boxN)} boxes)`);
ok(Math.abs(pf(0, 'x') + 420) < 0.01 && Math.abs(pf(0, 'y') - 8) < 0.01 && Math.abs(pf(0, 'z') - 180) < 0.01,
  'and lands at the legacy destination (-420, 8, 180)');
ok(x.gf_construct_bots() === 7 && bots() === 7, `nine viewers seat the seven available bots (${bots()})`);
ok(x.gf_viewer_waiting() === 2, 'two viewers wait: seven slots is the engine, the rest queue');

// ---- the roster follows the count -------------------------------------------------------------------------------------------------
x.gf_viewer_set(3);
ok(x.gf_construct_bots() === 3 && bots() === 3, 'a stream that drops to three viewers leaves three bots');
x.gf_viewer_set(12);
ok(bots() === 7 && x.gf_viewer_waiting() === 5, 'twelve viewers: seven bots, five waiting');
x.gf_viewer_set(0);
ok(bots() === 0 && x.gf_construct_bots() === 0, 'zero viewers: the voxworld empties');

// a seated bot is a body on a voxworld spawn, named for its viewer
x.gf_viewer_set(2);
ok(pi(1, 'is-bot') === 1 && pi(2, 'is-bot') === 1, 'viewer 1 and 2 take slots 1 and 2');
ok(name(1) === 'VIEWER 1' && name(2) === 'VIEWER 2', `the bots carry viewer names (${name(1)}, ${name(2)})`);
const s = pi(1, 'active') && pf(1, 'y') >= 6 - 0.01;
ok(!!s, 'and stand on the voxworld spawn height');
ok(pi(3, 'is-bot') === 0, 'no bot is seated in slot 3 while only two viewers watch');

// ---- bots are the engine's, the mode only seats them ---------------------------------------------------------------------------
const seen = new Set();
for (let i = 0; i < 30; i++) { x.sp_t_play(1); seen.add(`${pf(1, 'x').toFixed(1)},${pf(1, 'z').toFixed(1)}`); }
ok(seen.size > 1, `a seated viewer bot is alive and moving through the engine AI (${seen.size} positions in 30 ticks)`);

// ---- back through the ring --------------------------------------------------------------------------------------------------------
x.sp_t_place(0, -360, 6, 0, 0, 0);
x.sp_t_play(1);
ok(x.gf_construct_scene() === 4 && gi(G.mapId) === 4, 'the voxworld ring returns to the garage');
ok(bots() === 0 && x.gf_construct_bots() === 0, 'and the viewer bodies are cleared out of the slots');
ok(Math.abs(pf(0, 'x')) < 0.01 && Math.abs(pf(0, 'z') - 46) < 0.01, 'the player lands in front of the garage exits at (0, 46)');

// ---- leaving the mode leaves nothing running --------------------------------------------------------------------------------------
x.gf_mode_set(0);
ok(x.gf_mode() === 0 && gi(G.mapId) === 0 && gi(G.boxN) > 20 && gi(G.boxN) < 40, 'going back to the arena restores its map');
ok(x.gf_construct_bots() === 0, 'and the construct seats nobody');
ok(x.gf_viewer_count() === 2, 'the host count is kept for the next session');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
