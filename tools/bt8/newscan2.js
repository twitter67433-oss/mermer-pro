const { load, META, R } = require("./lib.js"), S8 = require(R + "sig8.js"), fs = require("fs");
if (process.env.LOWCOST){ S8.COST.entry = "maker"; S8.COST.slip = 0.01; } const cfg = Object.assign({}, S8.DEF, { minShow: "weak", g: { strong: 999, medium: 999, weak: -1 } }), TPS = [1, 1.5, 2, 3];
const out = {}; let tot = 0, blk = 0;
for (const s of META.syms){ const b = load(s, "15m"), F = S8.prep(b, { tms: 9e5, h1: load(s, "1h"), h2: load(s, "4h") }), L = [];
  for (let i = 220; i < F.n - 1; i++){ if (F.b[i].t < META.START) continue; const r = S8.evalAt(F, i, cfg);
    for (const c of r.cands.concat(r.rejected)){ if (c.blocked){ blk++; continue; } const o = {};
      for (const k of TPS){ const P = Object.assign({}, c, { tp: c.entry + c.d*k*c.risk }); const z = S8.resolve(F.b, i, P, 9e5); if (z) o[k] = [+z.R.toFixed(4), +z.net.toFixed(4), z.j, z.r]; }
      if (c.strat === "range"){ const z = S8.resolve(F.b, i, c, 9e5); if (z) o.mid = [+z.R.toFixed(4), +z.net.toFixed(4), z.j, z.r]; }
      if (!o[1]) continue; L.push({ i, t: F.b[i].t, s: c.strat, d: c.d, sc: c.score, reg: r.regime.k, mtf: c.E.mtf, rp: +c.riskP.toFixed(4), o }); } }
  out[s] = L; tot += L.length; }
fs.writeFileSync("/workspace/r750/new_raw2" + (process.env.LOWCOST ? "_low" : "") + ".json", JSON.stringify(out)); console.log("total", tot, "blocked", blk);
