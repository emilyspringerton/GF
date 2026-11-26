// gf/tests/voxworld_test.mjs -- V2: the garage and VOXWORLD are the 460 geometry, box for box.
// The garage is parsed out of physics.h's map_geo_garage. VOXWORLD is recomputed here from
// init_voxworld_city_geo's own formula (same seed, same f32 rounding) and compared to what the wasm built.
//   node gf/tests/voxworld_test.mjs <gf.wasm>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const wasmPath = process.argv[2];
if (!wasmPath) { console.error('usage: voxworld_test.mjs <gf.wasm>'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS: ' : 'FAIL: ') + m); };

const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasmPath), {});
const x = instance.exports;
x.sp_init();
const dv = () => new DataView(x.memory.buffer);
const gi = (k) => dv().getInt32(135168 + k * 4, true);
const G = { boxN: 127, spawnN: 128, mapId: 108 };
const box = (i) => [0, 1, 2, 3, 4, 5].map((k) => dv().getFloat32(163840 + i * 32 + k * 4, true));
const spawn = (i) => [0, 1, 2].map((k) => dv().getFloat32(167936 + i * 16 + k * 4, true));

// ---- the garage is physics.h map_geo_garage --------------------------------------------------------------------------------------
const src = fs.readFileSync(path.join(root, 'gf/ref/c460/packages/common/physics.h'), 'utf8');
const giBody = src.slice(src.indexOf('static const Box map_geo_garage[] = {'));
const garage = [...giBody.slice(0, giBody.indexOf('};')).matchAll(/\{\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+)\s*\}/g)]
  .map((m) => m.slice(1).map(Number));
ok(garage.length === 18, `the C garage has 18 boxes (${garage.length})`);
x.garage_init_bang();
ok(gi(G.boxN) === garage.length, `the wasm garage builds 18 boxes (${gi(G.boxN)})`);
let worst = 0;
for (let i = 0; i < garage.length; i++) for (let k = 0; k < 6; k++) worst = Math.max(worst, Math.abs(box(i)[k] - garage[i][k]));
ok(worst < 1e-6, `every garage box matches the C array (worst ${worst})`);
ok(gi(G.spawnN) === 5 && spawn(0)[0] === -20 && spawn(0)[2] === 20 && spawn(4)[0] === 10,
  'the five garage spawns are physics.h scene_spawn_point: x -20..20 on z 20');

// ---- VOXWORLD is init_voxworld_city_geo, recomputed ---------------------------------------------------------------------------------
const f = Math.fround;
const SEED = 1337, block = f(220), road = f(50), pitch = f(block + road);
const want = [
  [0, -2, 0, 2800, 4, 2800], [0, 100, 1400, 2800, 200, 8], [0, 100, -1400, 2800, 200, 8],
  [1400, 100, 0, 8, 200, 2800], [-1400, 100, 0, 8, 200, 2800],
];
for (let gx = -4; gx <= 4; gx++) for (let gz = -4; gz <= 4; gz++) {
  if ((Math.abs(gx) <= 1 && gz === 0) || (Math.abs(gz) <= 1 && gx === 0)) continue;
  const cx = f(gx * pitch), cz = f(gz * pitch);
  const n1 = f(Math.sin(f(f(gx * 17 + gz * 31 + SEED) * f(0.13))));
  const n2 = f(Math.cos(f(f(gx * 11 - gz * 23 + SEED) * f(0.19))));
  const h = f(f(24 + f(f(n1 + 1) * 28)) + f(f(n2 + 1) * 18));
  const w = f(35 + f(Math.abs(n1) * 45)), d = f(35 + f(Math.abs(n2) * 45));
  want.push([cx, f(h * 0.5), cz, w, h, d]);
  if ((gx + gz) % 3 === 0) want.push([f(cx + f(f(0.35) * block)), f(h * 0.35), f(cz - f(f(0.3) * block)), f(w * 0.55), f(h * 0.7), f(d * 0.55)]);
}
x.voxworld_init_bang();
ok(want.length === 107, `the C formula makes 107 boxes (${want.length})`);
ok(gi(G.boxN) === want.length, `the wasm voxworld builds 107 boxes (${gi(G.boxN)})`);
let vworst = 0, where = '';
for (let i = 0; i < want.length; i++) for (let k = 0; k < 6; k++) {
  const e = Math.abs(box(i)[k] - want[i][k]);
  if (e > vworst) { vworst = e; where = `box ${i} field ${k}: ${box(i)[k]} vs ${want[i][k]}`; }
}
ok(vworst < 0.01, `every voxworld box matches the C formula within 0.01 (worst ${vworst.toFixed(5)}${where ? ' -- ' + where : ''})`);
ok(Math.abs(box(0)[3] - 2800) < 1e-3 && Math.abs(box(0)[1] + 2) < 1e-6, 'box 0 is the 2800 x 2800 floor slab at y -2');
ok(gi(G.spawnN) === 5 && spawn(0)[0] === -120 && spawn(2)[0] === 0 && spawn(4)[0] === 120 && spawn(3)[1] === 6,
  'the five voxworld spawns are offsets -120..120 at y 6 on z 0');
ok(spawn(0)[2] === 0, 'and all of them on the road at z 0');

// ---- the city is a city: walls, blocks and roads ---------------------------------------------------------------------------------
const blocks = want.slice(5).filter((b) => b[2] !== 0 || b[4] > 100);
ok(blocks.length > 70, `the grid really is a grid: ${blocks.length} blocks and annexes`);
const centre = want.slice(5).filter((b) => Math.abs(b[0]) < 150 && Math.abs(b[2]) < 150);
ok(centre.length === 0, 'the central cross is empty (the spawn plaza and the two roads)');
const out = want.slice(5).filter((b) => Math.abs(b[0]) + b[3] / 2 > 1396.01 || Math.abs(b[2]) + b[5] / 2 > 1396.01);
ok(out.length === 0, 'no block reaches the inner face of the 1400-unit wall');
const tall = want.slice(5).filter((b) => b[4] >= 15 && b[4] <= 220);
ok(tall.length === want.length - 5, 'every block and annex is 15..220 units tall, like the C noise');

// ---- the C reference did not drift -------------------------------------------------------------------------------------------------
const formula = src.slice(src.indexOf('static inline void init_voxworld_city_geo'), src.indexOf('static int phys_scene_id'));
ok(/VOXWORLD_SEED 1337/.test(src) && /const float block = 220\.0f;/.test(formula) && /const float road = 50\.0f;/.test(formula),
  'physics.h still has seed 1337, block 220, road 50 (the constants this test assumes)');
ok(x.vx_box_count() === 107 && x.vx_bounds() === 1180 && x.vx_portal_x() === -360,
  'the voxworld words report 107 boxes, bounds 1180 and the ring portal at -360');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
