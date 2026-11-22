/* MERMER PRO risk engine: sizing from stop distance, leverage cap, stop inside liquidation, daily loss, cooldown, kill switch, no size-up after losses */
const assert = require("assert"), C = require("../pro/core.js"); let n = 0; const ok = (m, c) => { assert.ok(c, m); n++; console.log("PASS", m); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e*Math.max(1, Math.abs(b));
{ const s = C.size({ balance: 1000, riskPct: 0.01, entry: 100, stop: 98 }); ok("1 % of $1000 with a 2 % stop → $10 risk, $500 notional, 1×", s.ok && near(s.riskUsd, 10) && near(s.notional, 500) && s.lev === 1 && near(s.qty, 5)); }
{ const s = C.size({ balance: 1000, riskPct: 0.01, entry: 100, stop: 99.8 }); ok("0.2 % stop → $5000 notional needs 10× > cap 5× → notional capped at $2500, risk cut to 0.5 %", s.ok && s.lev === 5 && near(s.notional, 2500) && near(s.riskUsd, 5) && /tavan/.test(s.why.join())); }
{ const s = C.size({ balance: 1000, riskPct: 0.01, entry: 100, stop: 102 }); ok("short: liquidation above entry", s.ok && s.liq > 100); }
{ const s = C.size({ balance: 1000, riskPct: 0.01, entry: 100, stop: 100 }); ok("no stop (= entry) → refused", !s.ok); }
{ const s = C.size({ balance: 1000, riskPct: 0.02, entry: 100, stop: 83, maxLev: 5, marginPct: 0.02 }); ok("stop 17 % away at 5× (liq ≈ 19.5 %) is beyond 80 % of the liquidation distance → refused", !s.ok && s.lev === 5 && /likidasyon/.test(s.why.join()));
  const z = C.size({ balance: 1000, riskPct: 0.02, entry: 100, stop: 90, maxLev: 5, marginPct: 0.02 }); ok("10 % stop at 5× is inside the liquidation distance → allowed", z.ok && z.lev === 5); }
{ const s = C.size({ balance: 100, riskPct: 0.001, entry: 100, stop: 50 }); ok("tiny position below minimum notional → refused", !s.ok && /küçük/.test(s.why.join())); }
{ const g = C.guard({ balance: 965, dayStart: 1000, open: 0 }, 0); ok("daily loss −3.5 % ≥ 3 % limit → no new trade", !g.ok && /günlük/.test(g.why.join())); }
{ const st = { balance: 1000, consec: 0 }; for (let k = 0; k < 3; k++) C.afterClose(st, -10, 1000); ok("3 losses in a row → 12 h cooldown", st.coolUntil === 1000 + 12*3600000 && !C.guard(st, 2000).ok && C.guard(st, 1000 + 12*3600000 + 1).ok); }
{ ok("kill switch blocks everything", !C.guard({ balance: 1000, dayStart: 1000, kill: true }, 0).ok); ok("max open positions", !C.guard({ balance: 1000, dayStart: 1000, open: 2 }, 0).ok); }
{ const L = []; for (let k = 0; k < 6; k++) L.push({ sym: "S" + k, t: k*10*3600000, t1: k*10*3600000 + 1000, netR: -1 });
  const p = C.portfolio(L, { start: 1000, dailyLoss: 1, maxConsec: 99 }); const steps = p.curve.map((x, i, a) => i ? a[i - 1][1] - x[1] : 0).slice(1);
  ok("no martingale: each loss risks 1 % of the CURRENT (smaller) balance", steps.every((d, i) => i === 0 || d < steps[i - 1] + 1e-9) && near(steps[0], 10)); }
{ const L = [{ sym: "A", t: 0, t1: 100, netR: 1 }, { sym: "A", t: 50, t1: 150, netR: 1 }]; ok("one position per coin at a time", C.portfolio(L).taken === 1); }
console.log("\nall passed (" + n + ")");
