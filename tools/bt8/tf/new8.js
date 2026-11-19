/* every SİNYAL 8 candidate (all grades, unblocked) with its outcome for 1 / 1.5 / 2 / 3R (+ range mid) */
const L2 = require("./lib2.js"), { S8, SYMS, META, TMS, HI, load, fundOf, res, fs, TF } = L2;
const cfg = Object.assign({}, S8.DEF, { minShow: "weak", g: { strong: 999, medium: 999, weak: -1 } }), TPS = [1, 1.5, 2, 3], out = {}; let tot = 0, blk = 0;
for (const s of SYMS){ const b = load(s, TF); if (b.length < 400) continue; const F = S8.prep(b, { tms: TMS, h1: load(s, HI[0]), h2: load(s, HI[1]) }), fu = fundOf(s), L = [];
  for (let i = 220; i < F.n - 1; i++){ if (F.b[i].t < META.start) continue; const r = S8.evalAt(F, i, cfg);
    for (const c of r.cands.concat(r.rejected)){ if (c.blocked){ blk++; continue; } const o = {};
      for (const k of TPS){ const z = res(F.b, i, Object.assign({}, c, { tp: c.entry + c.d*k*c.risk }), fu); if (z) o[k] = [+z.R.toFixed(4), +z.net.toFixed(4), z.j, z.r]; }
      if (c.strat === "range"){ const z = res(F.b, i, c, fu); if (z) o.mid = [+z.R.toFixed(4), +z.net.toFixed(4), z.j, z.r]; }
      if (!o[1]) continue; L.push({ i, t: F.b[i].t, s: c.strat, d: c.d, sc: c.score, reg: r.regime.k, mtf: c.E.mtf, rp: +c.riskP.toFixed(4), o }); } }
  out[s] = L; tot += L.length; }
fs.writeFileSync(`/workspace/r750/tf/new_${TF}.json`, JSON.stringify(out)); console.log(TF, "coins", Object.keys(out).length, "cands", tot, "blocked", blk);
