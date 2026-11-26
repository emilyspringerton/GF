// gf/tests/router_test.mjs -- G2: ONE gf.wasm runs both modes, in one session, through the router.
// The build boots into the arena (g-gf-mode 0). A bot match plays; the mode is switched to SURVIVAL (1); a run plays; the
// mode is switched back and a bot match plays again, with the survival hooks provably inert.
//   node gf/tests/router_test.mjs <gf.wasm>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const wasmPath = process.argv[2];
if (!wasmPath) { console.error('usage: router_test.mjs <gf.wasm>'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS: ' : 'FAIL: ') + m); };

const fields = {};
for (const m of fs.readFileSync(path.join(here, '../engine/sp_fields.prn'), 'utf8').matchAll(/\(defn k-([a-z0-9-]+) \[\] : I32 (\d+)\)/g)) fields[m[1]] = +m[2];
// engine globals (sp_mem.prn) and the router + survival words
const G = { mode: 3, phase: 16, boxN: 127, mapId: 108, wantQueue: 77,
  svOn: 600, wave: 601, spawned: 602, owned: 604, ticks: 611 };

async function boot() {
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasmPath), {});
  const x = instance.exports;
  x.sp_init();
  let now = 1000;
  const dv = () => new DataView(x.memory.buffer);
  return {
    x, dv,
    frame(n = 1) { for (let i = 0; i < n; i++) { now += 16; x.sp_frame(now); } },
    gi: (k) => dv().getInt32(135168 + k * 4, true),
    pi: (p, k) => dv().getInt32(x.sp_player_addr(p) + fields[k] * 4, true),
    pf: (p, k) => dv().getFloat32(x.sp_player_addr(p) + fields[k] * 4, true),
    click(px, py) { x.sp_pointer(px, py); x.sp_button(0, 1); x.sp_button(0, 0); },
    play() { this.frame(3); this.click(320, 204); x.sp_lock(1); },
    actives() { const a = []; for (let p = 0; p < 8; p++) if (this.pi(p, 'active')) a.push(p); return a; },
    zombies() { let n = 0; for (let p = 1; p <= 9; p++) if (this.pi(p, 'active') && this.pi(p, 'state') === 0 && this.pi(p, 'is-bot')) n++; return n; },
  };
}
const distinct = (fb) => { const s = new Set(); for (let i = 0; i < fb.length; i += 4 * 97) s.add((fb[i] << 16) | (fb[i + 1] << 8) | fb[i + 2]); return s.size; };

// ---- module hygiene: one game, the mode exports, and a fixed memory --------------------------------------------------------------
{
  const mod = new WebAssembly.Module(fs.readFileSync(wasmPath));
  const ex = WebAssembly.Module.exports(mod).map((e) => e.name);
  ok(WebAssembly.Module.imports(mod).length === 0, 'the unified build still imports nothing');
  ok(['gf_mode', 'gf_mode_set', 'mod_title_bang', 'sv_mod_title_bang'].every((n) => ex.includes(n)),
    'it exports the mode switch and both modes\' implementations');
}

// ---- no router or mode global collides with an engine one ------------------------------------------------------------------------
{
  const seen = new Map(); const dup = []; let n = 0;
  // g-*, o-*, kat-* and want-* are the engine's word prefixes (a bare `g` would also match gf-mode-count)
  const WORD = /\(defn ((?:g-|o-|kat-|want-)[a-z0-9-]*) \[\] : I32 (\d+)\)/g;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.prn') || /fields|map_data/.test(e.name)) continue;
      n++;
      for (const m of fs.readFileSync(p, 'utf8').matchAll(WORD)) {
        if (m[1] === 'g-base') continue;
        const k = +m[2];
        if (seen.has(k) && seen.get(k) !== m[1]) dup.push(`${m[1]}/${seen.get(k)}=${k}`); else seen.set(k, m[1]);
      }
    }
  };
  walk(path.join(here, '../engine'));
  walk(path.join(here, '..', 'modes'));
  ok(dup.length === 0, `every global word is used by one name only across the engine and every mode (${n} files, ${seen.size} slots)` + (dup.length ? ' -- ' + dup.join(', ') : ''));
}

const g = await boot();
g.frame(4);

// ---- the default is the arena ---------------------------------------------------------------------------------------------------
ok(g.x.gf_mode() === 0, 'the build boots into the arena (g-gf-mode 0)');
ok(g.gi(G.phase) === 0 && g.gi(G.mapId) === 0, 'the arena title screen is up, on map 0');
const arenaBoxes = g.gi(G.boxN);
ok(arenaBoxes > 20 && arenaBoxes < 40, `the arena level is loaded behind it (${arenaBoxes} boxes)`);
ok(distinct(new Uint8Array(g.x.memory.buffer, g.x.sp_fb_addr(), 640 * 360 * 4)) > 25, 'the title screen is not blank');

// ---- a bot match through the router ---------------------------------------------------------------------------------------------
g.play();
ok(g.gi(G.phase) === 1 && g.gi(G.mode) === 0, 'PLAY starts the arena bot match (g-mode 0)');
ok(g.gi(G.wantQueue) === 1, 'and it is still the 460 flow: searching for a human match while you play');
ok(g.actives().length === 8, `eight players are on the field (${g.actives().length})`);
g.frame(200);   // the GET READY countdown
const x0 = g.pf(0, 'x'), z0 = g.pf(0, 'z'), t0 = g.gi(0);
g.x.sp_key(87, 1); g.frame(90); g.x.sp_key(87, 0);
ok(g.gi(0) > t0, `the arena simulates through the router (${t0} -> ${g.gi(0)} ticks)`);
ok(Math.hypot(g.pf(0, 'x') - x0, g.pf(0, 'z') - z0) > 1.0, 'the local player moves');
ok(g.gi(G.svOn) === 0 || g.zombies() === 0, 'no survival state leaks into the arena (no zombies)');

// ---- switch to SURVIVAL in the same session -------------------------------------------------------------------------------------
g.x.gf_mode_set(1);
g.frame(4);
ok(g.x.gf_mode() === 1, 'gf_mode_set(1) selects SURVIVAL');
ok(g.gi(G.phase) === 0, 'and returns to the title screen');
ok(g.gi(G.mapId) === 3 && g.gi(G.boxN) >= 40, `the CITY level replaces the arena (${g.gi(G.boxN)} boxes)`);
ok(g.actives().length === 0, 'the bot match\'s players are cleared out');
ok(g.x.mod_title_bang() === 1, 'the SURVIVAL title is the one drawn');

g.play();
ok(g.gi(G.phase) === 1 && g.gi(G.mode) === 2 && g.gi(G.svOn) === 1, 'PLAY now starts a survival run (mode 2), not a bot match');
ok(g.gi(G.wantQueue) === 0, 'and asks the page for no matchmaking socket');
ok(g.pi(0, 'weapon') === 0 && g.gi(G.owned) === 1, 'the hero starts with the knife and owns nothing else');
g.frame(400);   // the countdown, then the 3 s spawn
ok(g.gi(G.wave) === 1 && g.gi(G.spawned) >= 1 && g.zombies() >= 1,
  `wave 1 spawns through the router (${g.gi(G.spawned)} spawned, ${g.zombies()} alive)`);

// ---- back to the arena: the survival hooks must be inert ------------------------------------------------------------------------
const svTicks = g.gi(G.ticks), spawned = g.gi(G.spawned);
g.x.gf_mode_set(0);
g.frame(4);
ok(g.x.gf_mode() === 0 && g.gi(G.phase) === 0, 'gf_mode_set(0) goes back to the arena title');
ok(g.gi(G.mapId) === 0 && g.gi(G.boxN) === arenaBoxes, `the arena level is back (map ${g.gi(G.mapId)}, ${g.gi(G.boxN)} boxes)`);
ok(g.actives().length === 0, 'the zombies are cleared out of the player slots');
g.play();
ok(g.gi(G.phase) === 1 && g.gi(G.mode) === 0 && g.actives().length === 8, 'PLAY is a bot match again');
g.frame(400);
ok(g.gi(G.ticks) === svTicks && g.gi(G.spawned) === spawned,
  'the survival tick does not run: no wave clock, no spawns');
ok(g.gi(G.phase) === 1 && g.gi(G.mode) === 0, 'and the arena match keeps running');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
