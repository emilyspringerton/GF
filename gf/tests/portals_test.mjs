// gf/tests/portals_test.mjs -- V1: the Osaka garage portal ring is the legacy layer's table, and it triggers.
// The authority is server/system/portal.go (ScenePortals / ResolvePortalDestination) plus physics.h's
// PORTAL_ID_*/VOXWORLD_PORTAL_*; this test parses the Go file and compares row for row.
//   node gf/tests/portals_test.mjs <gf.wasm>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const wasmPath = process.argv[2];
if (!wasmPath) { console.error('usage: portals_test.mjs <gf.wasm>'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS: ' : 'FAIL: ') + m); };

const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasmPath), {});
const x = instance.exports;
x.sp_init();

const SCENES = { 0: 'ARENA', 2: 'DUST', 4: 'GARAGE', 5: 'VOXWORLD', 6: 'TANKER' };
const sceneName = (s) => { const a = x.portal_scene_name(s); let out = ''; const dv = new DataView(x.memory.buffer); for (let i = 0; i < 16; i++) { const c = dv.getUint8(a + i); if (!c) break; out += String.fromCharCode(c); } return out; };
const rows = x.portal_rows();

// ---- the legacy Go table, parsed ---------------------------------------------------------------------------------------------
const go = fs.readFileSync(path.join(root, 'server/system/portal.go'), 'utf8');
const garageBlock = go.slice(go.indexOf('case SceneGarageOsaka:'), go.indexOf('case SceneStadium:'));
const goPortals = [...garageBlock.matchAll(/\{ID: PortalID(\w+), X: (-?[\d.]+), Z: (-?[\d.]+), Radius: ([\d.]+)\}/g)]
  .map((m) => ({ name: m[1], x: +m[2], z: +m[3], r: +m[4] }));
const goIds = Object.fromEntries([...go.matchAll(/PortalID(\w+)\s*=\s*(\d+)/g)].map((m) => [m[1], +m[2]]));

ok(rows === 7, `the table has seven rows: five garage exits, the voxworld end, the tanker gate (${rows})`);
ok(goPortals.length === 5, `the legacy Go table has five garage portals (${goPortals.length})`);

// ---- garage rows match the Go table, in order ---------------------------------------------------------------------------------
const GARAGE = ['GarageExit', 'GarageToVoxworld', 'GarageToDust', 'GarageToTanker', 'GarageToPooPooisland'];
for (let i = 0; i < 5; i++) {
  const want = goPortals[i], row = i;
  ok(x.portal_row_scene(row) === 4, `row ${row} is in the garage`);
  ok(x.portal_row_id(row) === goIds[GARAGE[i]], `row ${row} id ${x.portal_row_id(row)} = legacy ${GARAGE[i]} (${goIds[GARAGE[i]]})`);
  ok(Math.abs(x.portal_row_x(row) - want.x) < 1e-6 && Math.abs(x.portal_row_z(row) - want.z) < 1e-6,
    `row ${row} sits at (${want.x}, ${want.z}) like the Go table`);
  ok(Math.abs(x.portal_row_r(row) - want.r) < 1e-6, `row ${row} radius ${x.portal_row_r(row)} matches ${want.r}`);
}

// ---- the voxworld end (physics.h VOXWORLD_PORTAL_*) ------------------------------------------------------------------------------
ok(x.portal_row_scene(5) === 5 && x.portal_row_id(5) === 2, 'row 5 is VOXWORLD_TO_STADIUM (id 2) in the voxworld');
ok(x.portal_row_x(5) === -360 && x.portal_row_z(5) === 0 && x.portal_row_r(5) === 16,
  'the ring portal is at (-360, 0) radius 16, as physics.h has it');

// ---- the tanker's own gate (portal.go SceneOilTanker; W1 built the scene it names) ----------------------------------------------
ok(x.portal_row_scene(6) === 6 && x.portal_row_id(6) === goIds.TankerToGarage, 'row 6 is TankerToGarage (id 7) in the tanker');
ok(x.portal_row_x(6) === 292 && x.portal_row_z(6) === 0 && x.portal_row_r(6) === 13,
  'the tanker gate is at (292, 0) radius 13, as the Go table has it');
const tankerBlock = go.slice(go.indexOf('case SceneOilTanker:'), go.indexOf('case ScenePooPooisland:'));
ok(/X: 292, Z: 0, Radius: 13/.test(tankerBlock), 'and that is the Go row it was parsed from');

// ---- triggering: inside, on the boundary, outside -------------------------------------------------------------------------------
ok(x.portal_at(4, 0, 56) === 0, 'standing on the garage exit triggers portal 0');
ok(x.portal_at(4, 0, 49.9) === -1, 'just outside the exit circle at (0, 49.9) has no portal');
ok(x.portal_at(4, 0, 56 + 6) === 0, 'the radius boundary is inclusive (distance 6)');
ok(x.portal_at(4, 0, 56 + 6.01) === -1, 'just outside the radius does not trigger');
ok(x.portal_at(4, 48, 0) === 3, 'the voxworld gate at (48, 0) is portal 3');
ok(x.portal_at(4, 52, -24) === 8, 'the island gate at (52, -24) is portal 8');
ok(x.portal_at(4, 0, 0) === -1, 'the garage floor centre is not a portal');
ok(x.portal_at(5, -360, 0) === 2, 'the voxworld ring portal triggers at (-360, 0)');
ok(x.portal_at(6, 292, 0) === 7 && x.portal_at(6, 0, 0) === -1, 'the tanker gate triggers at the bow, not mid-ship');
ok(x.portal_at(5, -200, 0) === -1, 'the voxworld road away from the ring does not trigger');
ok(x.portal_at(2, 0, 56) === -1, 'the same coordinates in another scene do not reuse the garage table');

// ---- where each one goes --------------------------------------------------------------------------------------------------------
ok(x.portal_dest_scene(4, 0) === 0, 'the garage exit goes to the arena (legacy Stadium)');
ok(x.portal_dest_scene(4, 3) === 5, 'the voxworld gate goes to scene 5 (voxworld)');
ok(x.portal_dest_x(4, 3) === -420 && x.portal_dest_y(4, 3) === 8 && x.portal_dest_z(4, 3) === 180,
  'and lands at (-420, 8, 180), the Go resolve point');
ok(x.portal_dest_scene(4, 4) === 2, 'the dust gate goes to scene 2 (dust compound)');
ok(x.portal_dest_scene(4, 6) === 6 && x.portal_dest_x(4, 6) === -265 && x.portal_dest_y(4, 6) === 6 && x.portal_dest_z(4, 6) === 0,
  'the tanker gate goes to scene 6 at the Go resolve point (-265, 6, 0) (W1 built it)');
ok(x.portal_dest_scene(4, 8) === -1, 'the island exit still names a scene GF has no map for (-1), rather than a wrong scene');
ok(x.portal_dest_scene(6, 7) === 4 && x.portal_dest_x(6, 7) === -38 && x.portal_dest_y(6, 7) === 6 && x.portal_dest_z(6, 7) === 0,
  'and the tanker gate comes back to the garage at (-38, 6, 0)');
ok(x.portal_dest_scene(5, 2) === 0, 'the voxworld ring names the arena, as the legacy table does');
ok(x.portal_dest_scene(4, 99) === -1, 'an unknown portal id has no destination');

// ---- the garage's vehicle pads (physics.h garage_vehicle_pads) --------------------------------------------------------------------
ok(x.garage_pad_count() === 3, 'the garage has three vehicle pads');
ok(x.garage_pad_x(0) === -30 && x.garage_pad_x(1) === 0 && x.garage_pad_x(2) === 30 && x.garage_pad_z(0) === -30,
  'the pads are the three 30-unit bays on z -30');
const label = (i) => { const a = x.garage_pad_label(i); let s = ''; const dv = new DataView(x.memory.buffer); for (let k = 0; k < 24; k++) { const c = dv.getUint8(a + k); if (!c) break; s += String.fromCharCode(c); } return s; };
ok(label(0) === "FOXBODY '93" && label(1) === 'LANDSHIP' && label(2) === 'RESERVED', 'the pad labels are the legacy ones');

ok(sceneName(4) === SCENES[4] && sceneName(5) === SCENES[5] && sceneName(6) === SCENES[6] && sceneName(99) === '', 'scene names come from the table, and an unknown scene is empty');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
