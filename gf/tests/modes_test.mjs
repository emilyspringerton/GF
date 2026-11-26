// gf/tests/modes_test.mjs -- G3: the mode registry is the only place the modes are named, and every row starts its mode.
// The menu (M1) reads these words and adds no strings of its own; this test is the guard that keeps it that way.
//   node gf/tests/modes_test.mjs <gf.wasm>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const wasmPath = process.argv[2];
if (!wasmPath) { console.error('usage: modes_test.mjs <gf.wasm>'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS: ' : 'FAIL: ') + m); };

const fields = {};
for (const m of fs.readFileSync(path.join(here, '../engine/sp_fields.prn'), 'utf8').matchAll(/\(defn k-([a-z0-9-]+) \[\] : I32 (\d+)\)/g)) fields[m[1]] = +m[2];
const G = { mode: 3, phase: 16, wantQueue: 77, svOn: 600, owned: 604 };

const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasmPath), {});
const x = instance.exports;
x.sp_init();
const dv = () => new DataView(x.memory.buffer);
const gi = (k) => dv().getInt32(135168 + k * 4, true);
const pi = (p, k) => dv().getInt32(x.sp_player_addr(p) + fields[k] * 4, true);
const str = (a) => { let s = ''; for (let i = 0; i < 64; i++) { const c = dv().getUint8(a + i); if (!c) break; s += String.fromCharCode(c); } return s; };
const name = (i) => str(x.gf_mode_name(i));
const desc = (i) => str(x.gf_mode_desc(i));

// ---- the table ---------------------------------------------------------------------------------------------------------------
const n = x.gf_mode_count();
ok(n === 3, `the registry has three modes (${n})`);
const ids = [...Array(n).keys()].map((i) => x.gf_mode_id(i));
ok(JSON.stringify(ids) === '[0,1,3]', `their ids are the router's: arena 0, survival 1, queue 3 (${ids.join(', ')})`);
ok(new Set(ids).size === n, 'no two rows share an id');
const names = [...Array(n).keys()].map(name);
ok(names.every((s) => s.length > 0) && new Set(names).size === n, `every mode has its own name (${names.join(', ')})`);
const descs = [...Array(n).keys()].map(desc);
ok(descs.every((s) => s.length >= 12), 'every mode has a one-line description');
const net = [...Array(n).keys()].map((i) => x.gf_mode_needs_net(i));
ok(net.every((v) => v === 0 || v === 1) && net[2] === 1 && net[0] === 0 && net[1] === 0,
  `only QUEUE needs the network (${net.join(', ')})`);

// ---- the registry is the only place the names live ---------------------------------------------------------------------------
{
  // the names must come from modes.prn, and no draw/menu source may hard-code them again
  const src = fs.readFileSync(path.join(here, '../modes/modes.prn'), 'utf8');
  ok(names.every((s) => src.includes(`"${s}"`)), 'every name is in gf/modes/modes.prn');
  const offenders = [];
  const scan = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { scan(p); continue; }
      if (!e.name.endsWith('.prn')) continue;
      const t = fs.readFileSync(p, 'utf8');
      for (const s of names) if (t.includes(`"${s}"`)) offenders.push(`${path.relative(path.join(here, '..'), p)}: "${s}"`);
    }
  };
  scan(path.join(here, '../engine'));
  scan(path.join(here, '../menu'));   // M1's pages land here; they must read the table, not copy it
  ok(offenders.length === 0, 'no engine or menu file hard-codes a mode name' + (offenders.length ? ' -- ' + offenders.join(', ') : ''));
  const manifest = fs.readFileSync(path.join(here, '../gf.modules'), 'utf8');
  ok(/^gf\/modes\/modes\.prn$/m.test(manifest), 'the registry is in the unified build (gf/gf.modules)');
}

// ---- every row starts its mode, from any state -------------------------------------------------------------------------------
{
  x.gf_mode_start(0);
  ok(gi(G.phase) === 1 && x.gf_mode() === 0 && gi(G.mode) === 0, 'row 0 (BOT MATCH) starts an offline bot match');
  ok(gi(G.wantQueue) === 0, 'and does not ask for the network');

  x.gf_mode_start(1);
  ok(gi(G.phase) === 1 && x.gf_mode() === 1 && gi(G.mode) === 2 && gi(G.svOn) === 1,
    'row 1 (SURVIVAL) starts a survival run');
  ok(pi(0, 'weapon') === 0 && gi(G.owned) === 1, 'with the knife only, as the mode says');

  x.gf_mode_start(2);
  ok(gi(G.phase) === 1 && x.gf_mode() === 3 && gi(G.wantQueue) === 1,
    'row 2 (QUEUE) starts a bot match and opens the matchmaking search');
  ok(gi(G.mode) === 0, 'queue is the arena game on the wire (g-mode 0)');

  x.gf_mode_start(0);
  ok(gi(G.phase) === 1 && x.gf_mode() === 0 && gi(G.mode) === 0, 'and row 0 works again after both');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
