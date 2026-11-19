/* walk-forward (expanding window): for fold k ≥ 2 parameters are chosen on data before the fold (only trades closed before it), applied to fold k. Objective J = ΣR − 0.5·maxDD, needs n ≥ 40 and PF ≥ 1.05 in training. */
const { S8, FOLDS, TMS, TF, fs } = require("./lib2.js");
const D = JSON.parse(fs.readFileSync(`new_${TF}.json`)), F0 = FOLDS[0][0], OF = FOLDS.slice(1);
const STR = ["trend", "breakout", "reversal", "range"], THR = [45, 50, 55, 60, 65, 70, 75, 80, 85], MTF = [null, 0, 0.4], TPV = { trend: [1, 1.5, 2, 3], breakout: [1, 1.5, 2, 3], reversal: [1, 1.5, 2], range: [1, 1.5, "mid"] };
const exitT = x => x.t + (x.oo[2] - x.i)*TMS;
function trades(st, p, lo, hi, scLo = p.thr, scHi = 999){ const T = []; for (const s in D){ let busy = -1; for (const x of D[s]){ if (x.s !== st || x.t < lo || x.t >= hi || x.sc < scLo || x.sc >= scHi) continue; if (p.mtf !== null && !(x.mtf !== null && x.mtf >= p.mtf)) continue;
      const o = x.o[p.tp]; if (!o || x.i <= busy) continue; busy = o[2]; T.push({ t: x.t, i: x.i, R: o[0], net: o[1], r: o[3], oo: o, sc: x.sc, s: x.s, sym: s }); } } return T; }
const J = s => s.n ? s.sumR - 0.5*s.maxDD : -Infinity;
const res = { folds: [], oos: {}, choice: {}, perFold: [] }, OOS = {}, OOSg = {};
for (const [lo, hi] of OF){ const pick = {}, FT = [];
  for (const st of STR){ let best = null; for (const thr of THR) for (const mtf of MTF) for (const tp of TPV[st]){ const p = { thr, mtf, tp }, T = trades(st, p, F0, lo).filter(x => exitT(x) < lo), s = S8.stats(T);
        if (s.n < 40 || !(s.pf >= 1.05)) continue; const j = J(s); if (!best || j > best.j) best = { p, j, s }; }
    const T = best ? trades(st, best.p, lo, hi) : []; OOS[st] = (OOS[st] || []).concat(T); FT.push(...T);
    if (best){ for (const [g, a, b] of [["strong", best.p.thr + 10, 999], ["medium", best.p.thr, best.p.thr + 10], ["weak", best.p.thr - 10, best.p.thr]]) OOSg[g] = (OOSg[g] || []).concat(trades(st, best.p, lo, hi, a, b)); }
    res.choice[new Date(lo).toISOString().slice(0, 10) + " " + st] = best ? Object.assign({}, best.p, { trainN: best.s.n, trainExpR: +best.s.expR.toFixed(3), trainPF: +best.s.pf.toFixed(2), oosN: T.length, oosExpR: T.length ? +S8.stats(T).expR.toFixed(3) : null }) : "KAPALI"; }
  res.perFold.push({ from: new Date(lo).toISOString().slice(0, 10), ...S8.stats(FT) }); }
const all = [].concat(...Object.values(OOS)); res.oos.all = S8.stats(all); for (const st of STR) res.oos[st] = S8.stats(OOS[st] || []); for (const g in OOSg) res.oos["grade_" + g] = S8.stats(OOSg[g]);
fs.writeFileSync(`wf_${TF}.json`, JSON.stringify(res, null, 1));
const f = s => s.n ? `n=${s.n} win=${(s.win*100).toFixed(1)}% expR=${s.expR.toFixed(3)} exp%=${s.expP.toFixed(3)} PF=${(s.pf||0).toFixed(2)} DD=${s.maxDD.toFixed(1)}R` : "n=0";
for (const k in res.choice) console.log(k, JSON.stringify(res.choice[k])); for (const k in res.oos) console.log("OOS", k, f(res.oos[k])); for (const p of res.perFold) console.log("fold", p.from, f(p));
