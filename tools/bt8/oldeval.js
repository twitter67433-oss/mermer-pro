/* old engines (v7.33.3 code) on identical history, resolved with the SAME cost model + resolver as SİNYAL 8 */
const { load, META } = require("./lib.js"), S8 = require("/workspace/neon-terminal-mobile/sig8.js"), fs = require("fs");
const SMT = require(process.env.F15 ? "/workspace/r750/old733f/smart.js" : "/workspace/r750/old733/smart.js"), SCX = require("/workspace/neon-terminal-mobile/scalpmode.js");
const which = process.argv[2]; const out = {};
for (const s of META.syms){ const b = load(s, "15m"), btc = load("BTCUSDT", "15m"), L = [], A = S8.prep(b).A;
  const rec = (i, d, entry, stop, tp, maxB, eng) => { const P = { d, entry, stop, tp, maxB, riskP: Math.abs(entry - stop)/entry*100 }; if (!(P.riskP > 0)) return; const o = S8.resolve(b, i, P, 9e5); if (!o) return; L.push({ i, t: b[i].t, s: eng, d, R: o.R, net: o.net, gross: o.gross, r: o.r, j: o.j, riskP: P.riskP }); };
  if (which === "walk"){ const P = SMT.prep(b, { tms: 9e5, h1: load(s, "1h"), h2: load(s, "4h"), btc: s === "BTCUSDT" ? null : btc });
    for (const mode of ["trend", "rev"]){ const W = SMT.walk(P, { mode }); for (const x of W.sig) if (b[x.i].t >= META.START) rec(x.i, x.d, x.entry, x.stop, x.tp, SMT.H_OUT, "A+" + mode);
      if (mode === "trend") for (const x of W.brk) if (b[x.i].t >= META.START){ const bx = P.box[x.i - 1]; rec(x.i, x.d, x.entry, x.stop, x.tp, Math.max(10, Math.min(30, bx ? bx.len : 20)), "PUMP/DUMP"); } } }
  if (which === "scalp"){ /* default SCALP mode: live gate = sReplay over the last 1000 loaded candles (refreshed every 2 min live → every bar here would be exact; every 4 bars to save time) */
    if (process.env.F15){ SCX.CFG.fee = 0.14; SCX.CFG.spread = 0.01; } const C = SCX.CFG, P = SCX.prep(b), BP = SCX.prep(btc); let j = 0, gate = null;
    for (let i = 1000; i < b.length - 1; i++){ if (b[i].t < META.START) continue; while (j + 1 < BP.n && BP.b[j + 1].t <= b[i].t) j++;
      if (!gate || i % 4 === 0){ const w = b.slice(i - 999, i + 1), wb = s === "BTCUSDT" ? null : btc.slice(Math.max(0, j - 999), j + 1); gate = SCX.sReplay(w, { btc: wb }); }
      const F = SCX.feats(P, i, s === "BTCUSDT" ? null : { P: BP, j }), sc = SCX.score(F), d = Math.sign(Math.abs(sc) > C.lean ? sc : 0), x = b[i], At = P.A[i] || x.c*0.001;
      const go = d && Math.abs(sc) >= C.th && C.tpK*At/x.c*100 >= C.feeX*(C.fee + C.spread) && SCX.sGate(gate); if (go) rec(i, d, x.c, x.c - d*C.stopK*At, x.c + d*C.tpK*At, C.maxB, "SCALP"); } }
  out[s] = L; process.stdout.write(s + ":" + L.length + " "); }
if (process.env.F15){ }; fs.writeFileSync(`/workspace/r750/old_${which}${process.env.F15 ? "_f15" : ""}.json`, JSON.stringify(out)); console.log("\ndone");
