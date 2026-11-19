const fs = require("fs"), S8 = require("/workspace/neon-terminal-mobile/sig8.js"), { META } = require("./lib.js");
const OOS0 = META.START + 30*864e5;
function take(L){ const busy = {}, T = []; for (const x of L.slice().sort((a, z) => a.t - z.t)){ const k = x.s; if ((busy[k] ?? -1) >= x.i) continue; busy[k] = x.j; T.push(x); } return T; }
const fmt = s => s.n ? `n=${s.n} win=${(s.win*100).toFixed(1)}% expR=${s.expR.toFixed(3)} exp%=${s.expP.toFixed(3)} PF=${s.pf.toFixed(2)} DD=${s.maxDD.toFixed(1)}R` : "n=0";
for (const f of process.argv.slice(2)){ const D = JSON.parse(fs.readFileSync(f)); const by = {};
  for (const s in D){ const L = Array.isArray(D[s]) ? D[s] : D[s].L; const g = {}; for (const x of L) (g[x.s] = g[x.s] || []).push(x); for (const e in g) by[e] = (by[e] || []).concat(take(g[e]).filter(x => x.t >= OOS0)); }
  for (const e in by) console.log(f, e, fmt(S8.stats(by[e]))); }
