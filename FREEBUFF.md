# Start here (freebuff and any other agent working on GF)

1. Read `docs/GF_REWRITE_PLAN.md`: §4 Rules, §5 Bootstrap, then §8 Order of work.
2. Make the suite green before you change anything: `scripts/gf_test.sh` (parity / engine / soak / survival).
3. Take the **first unticked task in §8**. One task per commit; the commit subject names the task ID; the message ends with
   `session: <tag>`. Add the task's test to `scripts/gf_test.sh` in the same commit, tick it in §8 with the commit hash, and add a
   dated line to `CHANGELOG.md`. Push.
4. Stuck, or the task needs the founder (servers, DNS, money, keys)? Write it in `docs/QUESTIONS.md` and take the next task.
5. Never edit the parity path (`gf/engine/sp_phys.prn`, `sp_sim.prn` `world-step!`, `sp_map*.prn`) to make a feature work. Use a
   hook in `gf/engine/sp_mods.prn`.
