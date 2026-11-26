// gf/tests/boat_test.mjs -- W2: the launch on the tanker's water. Board it, drive it, turn it, ride the swell,
// step off, and stay inside the sea. The boat is gf/modes/construct/boats.prn; the water it rides is W1's.
//   node gf/tests/boat_test.mjs <gf.wasm>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const wasmPath = process.argv[2];
if (!wasmPath) { console.error('usage: boat_test.mjs <gf.wasm>'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS: ' : 'FAIL: ') + m); };

const fields = {};
for (const m of fs.readFileSync(path.join(here, '../engine/sp_fields.prn'), 'utf8').matchAll(/\(defn k-([a-z0-9-]+) \[\] : I32 (\d+)\)/g)) fields[m[1]] = +m[2];
const G = { boxN: 127, mapId: 108, cmdFwd: 100, cmdStr: 101, cmdJump: 102, cmdCrouch: 104, tick: 7 };

const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasmPath), {});
const x = instance.exports;
x.sp_init();
const dv = () => new DataView(x.memory.buffer);
const gi = (k) => dv().getInt32(135168 + k * 4, true);
const pf = (p, k) => dv().getFloat32(x.sp_player_addr(p) + fields[k] * 4, true);
const ctl = (fwd, str, jump, crouch) => {
  x.sp_t_poke(G.cmdFwd, fwd ? 0x3f800000 : 0);
  x.sp_t_poke(G.cmdStr, str ? 0x3f800000 : 0);
  x.sp_t_poke(G.cmdJump, jump ? 1 : 0);
  x.sp_t_poke(G.cmdCrouch, crouch ? 1 : 0);
};

// ---- into the water --------------------------------------------------------------------------------------------------------------
x.gf_mode_set(4);
x.gf_mode_start(3);
x.sp_t_place(0, -48, 2, 0, 0, 0);
x.sp_t_play(1);
ok(x.gf_construct_scene() === 6 && gi(G.mapId) === 6, 'the tanker loads (scene 6)');

// ---- the launch is moored and floating ------------------------------------------------------------------------------------------
ok(x.wb_active() === 1 && x.wb_rider() === -1, 'there is one launch, with nobody aboard');
ok(Math.abs(x.wb_home_x() + 250) < 0.01 && Math.abs(x.wb_home_z() - 90) < 0.01, 'moored off the stern at (-250, 90)');
let floatOk = true, maxErr = 0;
for (let i = 0; i < 60; i++) {
  x.sp_t_play(1);
  const surf = x.ww_surface_at(x.wb_x(), x.wb_z(), x.ww_t());
  const err = Math.abs(x.wb_y() - (surf + 0.6));
  maxErr = Math.max(maxErr, err);
  if (err > 1.2) floatOk = false;
}
ok(floatOk, `the hull rides the swell under it (worst gap to the surface ${maxErr.toFixed(2)})`);
ok(x.wb_speed() === 0, 'and it does not drift on its own');

// ---- boarding: jump beside the hull ------------------------------------------------------------------------------------------
x.sp_t_place(0, x.wb_x(), x.wb_y() + 2, x.wb_z(), 0, 0);
ctl(false, false, true, false);
x.sp_t_play(1);
ok(x.wb_rider() === 0, 'jump beside the hull boards it');
ctl(false, false, false, false);
const bx0 = x.wb_x(), bz0 = x.wb_z();

// ---- under way: forward drives, the rider is carried ------------------------------------------------------------------------
ctl(true, false, false, false);
for (let i = 0; i < 45; i++) x.sp_t_play(1);
const moved = Math.hypot(x.wb_x() - bx0, x.wb_z() - bz0);
ok(x.wb_speed() > 0.5, `full ahead builds speed (${x.wb_speed().toFixed(2)} of ${x.wb_max_speed()})`);
ok(moved > 4, `and the hull travels (${moved.toFixed(1)} units in 45 ticks)`);
ok(Math.abs(pf(0, 'x') - x.wb_x()) < 2.5 && Math.abs(pf(0, 'z') - x.wb_z()) < 2.5 && Math.abs(pf(0, 'y') - (x.wb_y() + 1.6)) < 0.2,
  'the rider is carried on the deck, not swimming beside it');
ok(pf(0, 'y') > 12, `the rider rides above the sea line (y ${pf(0, 'y').toFixed(1)})`);

// ---- steering only works under way --------------------------------------------------------------------------------------------
const yaw0 = x.wb_yaw();
ctl(true, true, false, false);
for (let i = 0; i < 20; i++) x.sp_t_play(1);
ok(Math.abs(x.wb_yaw() - yaw0) > 5, `the helm turns her while she has way on (${yaw0.toFixed(1)} -> ${x.wb_yaw().toFixed(1)})`);

// a hull at rest does not pivot on the spot (drag brings her down first)
ctl(false, false, false, false);
for (let i = 0; i < 300; i++) x.sp_t_play(1);
ok(Math.abs(x.wb_speed()) < 0.02, `she comes off the plane and stops (${x.wb_speed().toFixed(3)})`);
const yawRest = x.wb_yaw();
ctl(false, true, false, false);
for (let i = 0; i < 20; i++) x.sp_t_play(1);
ok(Math.abs(x.wb_yaw() - yawRest) < 1.0, 'stopped, the helm does nothing: no turning on the spot');

// ---- reverse ------------------------------------------------------------------------------------------------------------------
ctl(false, false, false, false);
for (let i = 0; i < 40; i++) x.sp_t_play(1);
const sp0 = x.wb_speed();
ctl(false, false, false, false);
x.sp_t_poke(G.cmdFwd, 0xbf800000);   // -1.0f
for (let i = 0; i < 30; i++) x.sp_t_play(1);
ok(x.wb_speed() < 0 && x.wb_speed() >= -x.wb_reverse() - 0.001, `astern works, and is slower than ahead (${sp0.toFixed(2)} then ${x.wb_speed().toFixed(2)})`);
ctl(false, false, false, false);

// ---- she collides with the ship ------------------------------------------------------------------------------------------------
// moored north of the tanker, bows to the north (-z): full ahead puts her into the starboard side at z 45
x.wb_place_bang(250, 250, 0);
ctl(false, false, false, false);
for (let i = 0; i < 40; i++) x.sp_t_play(1);
ctl(true, false, false, false);
for (let i = 0; i < 260; i++) x.sp_t_play(1);
ok(x.wb_z() > 44, `the hull does not drive through the tanker (z ${x.wb_z().toFixed(1)}, side at 45)`);
ok(x.wb_z() < 90, `she is stopped against it, not still running (z ${x.wb_z().toFixed(1)})`);
ok(Math.abs(x.wb_speed()) < 0.4, `and she has lost her way (speed ${x.wb_speed().toFixed(2)})`);
ctl(false, false, false, false);

// ---- and with a channel buoy ---------------------------------------------------------------------------------------------------
x.wb_place_bang(160, 250, 0);
for (let i = 0; i < 40; i++) x.sp_t_play(1);
ctl(true, false, false, false);
for (let i = 0; i < 120; i++) x.sp_t_play(1);
ok(x.wb_z() > 160, `the buoy at (160, 160) is solid too (z ${x.wb_z().toFixed(1)})`);
ok(x.wb_z() < 190, 'and she pulls up beside it');
ctl(false, false, false, false);

// ---- the sea keeps her in -------------------------------------------------------------------------------------------------------
x.wb_place_bang(250, 300, 90);
x.sp_t_poke(G.cmdFwd, 0xbf800000);   // astern, away from the ship, into the edge
for (let i = 0; i < 80; i++) x.sp_t_play(1);
const lim = x.ww_bounds() - 12;
ok(Math.abs(x.wb_z()) <= lim + 0.001 && Math.abs(x.wb_x()) <= lim + 0.001,
  `and the edge of the sea holds her (${x.wb_x().toFixed(1)}, ${x.wb_z().toFixed(1)}; limit ${lim})`);
ctl(false, false, false, false);

// ---- stepping off (back in open water: the launch does not collide with the ship's boxes yet) --------------------------------
x.wb_place_bang(x.wb_home_x(), x.wb_home_z(), 90);
x.sp_t_play(1);
ok(Math.abs(pf(0, 'x') - x.wb_x()) < 2.5 && Math.abs(pf(0, 'z') - x.wb_z()) < 2.5, 'moved by hand, the hull still carries its rider');
ctl(false, false, false, true);
x.sp_t_play(1);
ok(x.wb_rider() === -1, 'crouch aboard steps off');
ctl(false, false, false, false);
const px = pf(0, 'x'), pz = pf(0, 'z');
for (let i = 0; i < 20; i++) x.sp_t_play(1);
ok(Math.hypot(pf(0, 'x') - x.wb_x(), pf(0, 'z') - x.wb_z()) > 2.5, 'and the hull no longer carries them');
ok(Math.hypot(pf(0, 'x') - px, pf(0, 'z') - pz) < 20, 'the swimmer stays in the water where they stepped off');

// ---- it draws --------------------------------------------------------------------------------------------------------------------
let drew = true;
try { x.sp_t_render_world(x.wb_x(), x.wb_y() + 8, x.wb_z() + 20, 0, -20); } catch (e) { drew = false; console.log('  render trap: ' + e.message); }
ok(drew, 'rendering the launch does not trap');

// the hull test itself: open water is free, the ship's side is not
x.gf_mode_set(4);
x.gf_mode_start(3);
x.sp_t_place(0, -48, 2, 0, 0, 0);
x.sp_t_play(1);
ok(x.wb_blocked_p(0, 200, 90, 12) === 0, 'a point in open water is not blocked');
ok(x.wb_blocked_p(0, 45, 90, 12) === 1, "and the tanker's side is");

// ---- leaving the mode clears it ----------------------------------------------------------------------------------------------------
x.gf_mode_set(0);
ok(x.wb_rider() === -1 && gi(G.mapId) === 0, 'back to the arena, nobody is aboard');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
