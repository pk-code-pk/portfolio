/* Monte Carlo balance check for the hidden battle. Evals the exact rules
   block from index.html (between BATTLE-RULES-START / -END), then plays
   N battles per player policy.  usage: node tools/battle-sim.mjs [N] */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');
const m = html.match(/\/\* BATTLE-RULES-START[\s\S]*?\*\/([\s\S]*?)\/\* BATTLE-RULES-END \*\//);
if (!m) throw new Error('rules block not found in index.html');
const { planTurn, RULES } = new Function(`${m[1]}; return { planTurn, RULES };`)();

const N = +(process.argv[2] || 100000);
const POLICIES = {
  'always dragon pulse': () => 'ray-m1',
  'always hyper beam': () => 'ray-m2',
  'random': (st, rnd) => (rnd() < 0.5 ? 'ray-m1' : 'ray-m2'),
};
for (const [name, policy] of Object.entries(POLICIES)) {
  let wins = 0, hits = 0, turns = 0;
  const koAt = [0, 0, 0, 0, 0, 0];
  for (let b = 0; b < N; b++) {
    let st = { ray: 100, lug: 100, stage: 0, recharge: false };
    for (let t = 0; t < 50; t++) {
      const { st: next, acts } = planTurn(st, policy(st, Math.random), Math.random);
      st = next; turns++;
      hits += acts.filter(a => a.move).length;
      const ko = acts.find(a => a.ko);
      if (ko) { if (ko.def === 'lug') wins++; koAt[ko.to]++; break; }
    }
  }
  console.log(`${name.padEnd(20)} win ${(100 * wins / N).toFixed(1)}%  hits/battle ${(hits / N).toFixed(2)}  turns ${(turns / N).toFixed(2)}  ko stage ${koAt.slice(3).map(k => (100 * k / N).toFixed(0) + '%').join('/')}  early KO ${koAt.slice(0, 3).reduce((a, c) => a + c, 0)}`);
}
