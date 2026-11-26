// gf/tests/waterworld_test.mjs -- W1: the garage's tanker gate, the faked sea, and swimming.
// The portal numbers are server/system/portal.go's (SceneOilTanker, PortalIDGarageToTanker/TankerToGarage);
// the sea and the swim step are gf/modes/construct/waterworld.prn.
//   node gf/tests/waterworld_test.mjs <gf.wasm>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const wasmPath = process.argv[2];
if (!wasmPath) { console.error('usage: waterworld_test.mjs <gf.wasm>'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS: ' : 'FAIL: ') + m); };

const fields = {};
for (const m of fs.readFileSync(path.join(here, '../engine/sp_fields.prn'), 'utf8').matchAll(/\(defn k-([a-z0-9-]+) \[\] : I32 (\d+)\)/g)) fields[m[1]] = +m[2];
const G = { mode: 3, phase: 16, boxN: 127, spawnN: 128, mapId: 108, cmdFwd: 100, cmdJump: 102 };

const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasmPath), {});
const x = instance.exports;
x.sp_init();
const dv = () => new DataView(x.memory.buffer);
const gi = (k) => dv().getInt32(135168 + k * 4, true);
const pi = (p, k) => dv().getInt32(x.sp_player_addr(p) + fields[k] * 4, true);
const pf = (p, k) => dv().getFloat32(x.sp_player_addr(p) + fields[k] * 4, true);
const hold = (fwd, jump) => { x.sp_t_poke(G.cmdFwd, fwd ? 0x3f800000 : 0); x.sp_t_poke(G.cmdJump, jump ? 1 : 0); };

// ---- the legacy tanker gate ------------------------------------------------------------------------------------------------------
ok(x.portal_rows() === 7, `the legacy table is seven rows now: five garage exits, the voxworld ring, the tanker's own gate (${x.portal_rows()})`);
ok(x.portal_at(4, -48, 0) === 6, 'the garage gate at (-48, 0) is legacy portal 6 (GarageToTanker)');
ok(x.portal_dest_scene(4, 6) === 6, 'and it goes to scene 6, the tanker (V1 left this at -1)');
ok(x.portal_dest_x(4, 6) === -265 && x.portal_dest_y(4, 6) === 6 && x.portal_dest_z(4, 6) === 0,
  'landing at (-265, 6, 0), the Go resolve point');
ok(x.portal_at(6, 292, 0) === 7, "the tanker's own gate at (292, 0) is portal 7 (TankerToGarage)");
ok(x.portal_dest_scene(6, 7) === 4 && x.portal_dest_x(6, 7) === -38 && x.portal_dest_y(6, 7) === 6 && x.portal_dest_z(6, 7) === 0,
  'and it returns to the garage at (-38, 6, 0)');
const sceneName = (s) => { const a = x.portal_scene_name(s); let out = ''; for (let i = 0; i < 16; i++) { const c = dv().getUint8(a + i); if (!c) break; out += String.fromCharCode(c); } return out; };
ok(sceneName(6) === 'TANKER', `scene 6 is named (${sceneName(6)})`);
ok(x.portal_dest_scene(4, 8) === -1, 'the island exit is still unbuilt (-1), named rather than wrong');

// ---- the sea is a function, not state -------------------------------------------------------------------------------------------
const sea = x.ww_sea();
ok(Math.abs(sea - 12) < 0.001, `the sea line is 12 (${sea})`);
ok(x.ww_bounds() === 320, 'the sea is 320 half-width, so the bow gate at x 292 is inside it');
const s00 = x.ww_surface_at(0, 0, 10);
ok(x.ww_surface_at(0, 0, 10) === s00, 'the surface is the same for the same (x, z, t): no hidden state');
ok(x.ww_surface_at(120, 0, 10) !== s00, 'and it varies along x');
ok(x.ww_surface_at(0, 0, 10) !== x.ww_surface_at(0, 0, 30), 'and with time');
let low = 99, high = -99;
for (let i = 0; i < 400; i++) { const v = x.ww_surface_at(i * 7.3 - 700, i * 3.1 - 300, 0); low = Math.min(low, v); high = Math.max(high, v); }
ok(low > sea - 2.5 && high < sea + 2.5, `over a 1400-unit sweep the swell stays within +-2.5 of the sea line (${low.toFixed(2)} .. ${high.toFixed(2)})`);

// ---- through the gate: the tanker loads ------------------------------------------------------------------------------------------
x.gf_mode_set(4);
x.gf_mode_start(3);
ok(gi(G.phase) === 1 && x.gf_construct_scene() === 4, 'a CONSTRUCT session starts in the garage');
x.sp_t_place(0, -48, 2, 0, 0, 0);
x.sp_t_play(1);
ok(x.gf_construct_scene() === 6 && gi(G.mapId) === 6, 'walking into the (-48, 0) gate loads scene 6, the tanker');
ok(gi(G.boxN) === 43 && gi(G.boxN) === x.ww_box_count(), `the ship is 43 boxes: the slab plus 42 (${gi(G.boxN)})`);
ok(gi(G.spawnN) === 6, 'six spawns: the water landing and five on deck');
ok(Math.abs(pf(0, 'x') + 265) < 0.01 && Math.abs(pf(0, 'y') - 6) < 0.01 && Math.abs(pf(0, 'z')) < 0.01,
  `the player lands at the legacy point (-265, 6, 0) (${pf(0, 'x').toFixed(1)}, ${pf(0, 'y').toFixed(1)}, ${pf(0, 'z').toFixed(1)})`);
ok(x.ww_box_colour(1) !== -1 && x.ww_box_colour(43) === -1, 'the ship boxes carry their own colours, and past the last box the palette is the engine\'s (-1)');

// ---- swimming: a body in the water floats, it does not sink ---------------------------------------------------------------------
hold(false, false);
let lowY = 99, highY = -99;
for (let i = 0; i < 120; i++) { x.sp_t_play(1); lowY = Math.min(lowY, pf(0, 'y')); highY = Math.max(highY, pf(0, 'y')); }
const floatY = pf(0, 'y');
ok(floatY > 6 && floatY < 13, `after two seconds in the water the body floats near the surface (y ${floatY.toFixed(2)})`);
ok(lowY > 5, `it never sinks toward the seabed (lowest y ${lowY.toFixed(2)})`);

// ---- and it does not walk: water caps the speed ----------------------------------------------------------------------------------
const sx = pf(0, 'x'), sz = pf(0, 'z');
hold(true, false);
let maxStep = 0;
for (let i = 0; i < 40; i++) {
  const bx = pf(0, 'x'), bz = pf(0, 'z');
  x.sp_t_play(1);
  maxStep = Math.max(maxStep, Math.hypot(pf(0, 'x') - bx, pf(0, 'z') - bz));
}
const swam = Math.hypot(pf(0, 'x') - sx, pf(0, 'z') - sz);
ok(maxStep <= 0.45, `a stroke moves at most ${x.ww_swim_speed()} a tick, never the 0.95 walk (${maxStep.toFixed(3)})`);
ok(swam > 1.5, `and it still travels (${swam.toFixed(2)} units in 40 ticks)`);
ok(pf(0, 'y') > 6, 'swimming keeps the body at the surface');

// ---- jump is a stroke: it lifts you to the water line, it does not launch you ------------------------------------------------
hold(false, true);
let topY = -99;
for (let i = 0; i < 45; i++) { x.sp_t_play(1); topY = Math.max(topY, pf(0, 'y')); }
ok(topY > 9.5, `stroking up lifts the body to the surface (top y ${topY.toFixed(2)})`);
ok(topY < 24, 'and it stays in the water: no launching off the sea');
hold(false, false);

// ---- dry land is dry: the deck is not water --------------------------------------------------------------------------------------
x.sp_t_place(0, 0, 21, 0, 0, 0);
for (let i = 0; i < 30; i++) x.sp_t_play(1);
ok(Math.abs(pf(0, 'y') - 20) < 0.2, `on the deck the body stands at 20, no buoyancy (y ${pf(0, 'y').toFixed(2)})`);

// ---- the stern ladder is climbable: its top step is above the sea and below the deck ----------------------------------------------
ok(x.ww_box_colour(30) !== -1, 'the stern ladder steps exist');
x.sp_t_place(0, -244, 19.1, 51, 0, 0);
for (let i = 0; i < 5; i++) x.sp_t_play(1);
ok(pf(0, 'y') > 18, `standing on the top step holds you above the water (y ${pf(0, 'y').toFixed(2)})`);

// ---- the bow gate returns to the garage -------------------------------------------------------------------------------------------
x.sp_t_place(0, 292, 20, 0, 0, 0);
x.sp_t_play(1);
ok(x.gf_construct_scene() === 4 && gi(G.mapId) === 4, 'the bow gate at (292, 0) returns to the garage');
ok(Math.abs(pf(0, 'x') + 38) < 0.01 && Math.abs(pf(0, 'z')) < 0.01, `landing at the legacy (-38, 6, 0) (${pf(0, 'x').toFixed(1)}, ${pf(0, 'z').toFixed(1)})`);
ok(x.cg_mod_box_color(1) === -1, 'the garage is back on the engine palette');

// ---- the sea draws (the faked surface is 196 quads and a seabed, and it must not trap) -------------------------------------------
x.gf_mode_set(4);
x.gf_mode_start(3);
x.sp_t_place(0, -48, 2, 0, 0, 0);
x.sp_t_play(1);
let drew = true;
try { x.sp_t_render_world(-265, 16, 0, 0, -12); } catch (e) { drew = false; console.log('  render trap: ' + e.message); }
ok(drew, 'rendering the tanker from the stern does not trap');
let drew2 = true;
try { x.sp_t_render_world(0, 4, 0, 90, -40); } catch (e) { drew2 = false; console.log('  render trap: ' + e.message); }
ok(drew2, 'and neither does looking down from under the surface');

// ---- leaving the mode clears the sea ---------------------------------------------------------------------------------------------
x.gf_mode_set(0);
ok(gi(G.mapId) === 0, 'back in the arena, the arena map is loaded again');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
