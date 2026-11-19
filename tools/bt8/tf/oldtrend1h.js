const { load, META } = require("../lib.js"), S8 = require("/workspace/neon-terminal-mobile/sig8.js"), SMT = require("/workspace/r750/old733g/smart.js"), fs = require("fs");
const out = {}; const TF = ["5m", "15m", "30m", "1h", "2h", "4h", "1d"];
for (const s of META.syms){ const K = {}; for (const t of TF) K[t] = load(s, t); const b = K["1h"], g = SMT.gReplay(K, "1h", { maxB: 10 }), L = [];
  const idx = new Map(b.map((x, i) => [x.t, i])); const tr = g.tr.filter(x => x.i !== undefined);
  for (const x of tr){ if (b[x.i].t < META.START) continue; /* causal gate: entries of the same rule in the previous 1000 candles whose 10-candle window closed */
    const prev = tr.filter(y => y.i < x.i && y.i >= x.i - 1000 && y.i + 10 <= x.i), n = prev.length, w = prev.filter(y => y.pnl > 0).length, avg = n ? prev.reduce((q, y) => q + y.pnl, 0)/n : 0;
    if (!(n >= 20 && w/n >= 0.55 && avg > 0)) continue; const P = { d: x.d, entry: x.en, stop: x.st, tp: x.tp, maxB: 10, riskP: Math.abs(x.en - x.st)/x.en*100 }; const o = S8.resolve(b, x.i, P, 36e5); if (!o) continue;
    L.push({ i: x.i, t: b[x.i].t, s: "TREND-GİR", d: x.d, R: o.R, net: o.net, gross: o.gross, r: o.r, j: o.j, riskP: P.riskP }); }
  out[s] = L; process.stdout.write(s + ":" + tr.length + "/" + L.length + " "); }
fs.writeFileSync("/workspace/r750/tf/old_trendgir_1h_120d.json", JSON.stringify(out)); console.log("\ndone");
