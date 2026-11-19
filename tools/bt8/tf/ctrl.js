/* timing-vs-drift control: for each signal, the same trade (same coin, same stop %, same target R, same max bars, same side) opened at a random OOS bar of that coin */
const { S8, OOS0, OOS1, FOLDS, TF, TMS, fs, load, fundOf, res } = require("./lib2.js"); const ND = JSON.parse(fs.readFileSync(`new_${TF}.json`)), lo = +(process.argv[2] || 70), want = (process.argv[3] || "trend:-1").split(":");
let seed = 3; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647; const T = [], C = [], F0 = [];
for (const s in ND){ const b = load(s, TF), fu = fundOf(s), ix = b.map((x, i) => i).filter(i => b[i].t >= OOS0 && i < b.length - 40); let busy = -1;
  for (const x of ND[s]){ if (x.s !== want[0] || x.d !== +want[1] || x.sc < lo) continue; const tp = S8.DEF.tpR[x.s], o = x.o[tp]; if (!o || x.i <= busy) continue; busy = o[2];
    const row = { t: x.t, R: o[0], net: o[1], r: o[3] }; if (x.t < OOS0){ F0.push(row); continue; } T.push(row);
    for (let k = 0; k < 3; k++){ const i = ix[Math.floor(rnd()*ix.length)], e = b[i].c, rp = x.rp/100, d = x.d, stop = e*(1 - d*rp), P = { d, entry: e, stop, tp: e + d*tp*e*rp, maxB: S8.DEF.maxB[x.s], riskP: x.rp }; const z = res(b, i, P, fu); if (z) C.push({ t: b[i].t, R: z.R, net: z.net, r: z.r }); } } }
const f = a => { const s = S8.stats(a); return s.n ? `n=${s.n} expR=${s.expR.toFixed(3)} exp%=${s.expP.toFixed(3)} PF=${s.pf.toFixed(2)} win=${(s.win*100).toFixed(1)}%` : "n=0"; };
console.log(TF, want.join(":"), "≥" + lo); console.log(" training-only fold 0 (pre-OOS):", f(F0)); console.log(" signals OOS :", f(T)); console.log(" random-time control:", f(C));
const FO = FOLDS.slice(1); console.log(" folds signal/control:", FO.map(([p, q]) => { const a = S8.stats(T.filter(x => x.t >= p && x.t < q)), c = S8.stats(C.filter(x => x.t >= p && x.t < q)); return `${a.n ? a.expR.toFixed(3) : "—"}/${c.n ? c.expR.toFixed(3) : "—"}`; }).join("  "));
