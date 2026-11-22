/* MERMER PRO signal resolver (simTrade): stop-first, gaps, TP1 + break-even, TP2, timeout, limit pullback fills, funding, costs */
const assert = require("assert"), C = require("../pro/core.js"); let n = 0; const ok = (m, c) => { assert.ok(c, m); n++; console.log("PASS", m); };
const mk = rows => { const b = rows.map((r, i) => ({ t: i*900000, o: r[0], h: r[1], l: r[2], c: r[3], v: 1, qv: 1e9, tb: 5e8 })); const atr = b.map(() => 1), qv24 = b.map(() => 1e9);
  return { b, n: b.length, atr, qv24, c: b.map(x => x.c), o: Object.assign({}, C.P0), fr: [] }; };
const flat = k => Array.from({ length: k }, () => [100, 100.2, 99.8, 100]);
const sig = { dir: 1, entry: 100, stop: 98 };
{ const P = mk([[100, 100, 100, 100], [100, 103, 99.5, 102.5], [102.5, 104.5, 102, 104]]); const r = C.simTrade(P, 0, sig, "MKT");
  ok("long: TP1 (1R) then TP2 (2R) → out TP2, gross ≈ +1.5R", r.fill && r.out === "TP2" && Math.abs(r.grossR - 1.5) < 0.05 && r.netR < r.grossR); }
{ const P = mk([[100, 100, 100, 100], [100, 101, 97, 97.5]]); const r = C.simTrade(P, 0, sig, "MKT"); ok("stop hit → about −1R plus costs", r.out === "SL" && r.netR < -1 && r.netR > -1.2); }
{ const P = mk([[100, 100, 100, 100], [100, 102.5, 97.5, 101]]); const r = C.simTrade(P, 0, sig, "MKT"); ok("bar touches both TP1 and stop → stop first (conservative)", r.out === "SL"); }
{ const P = mk([[100, 100, 100, 100], [100, 102.2, 99.9, 102], [102, 102.1, 99.9, 100]]); const r = C.simTrade(P, 0, sig, "MKT"); ok("TP1 then back to entry → TP1+BE (half +1R, rest ≈ 0)", r.out === "TP1+BE" && r.grossR > 0.4 && r.grossR < 0.6); }
{ const P = mk([[100, 100, 100, 100], [97, 97.5, 96, 97]]); const r = C.simTrade(P, 0, sig, "MKT"); ok("next open already beyond stop → not entered", r.fill === false); }
{ const P = mk([[100, 100, 100, 100], [100, 100.5, 99.5, 100], [96.5, 97, 96, 96.8]]); const r = C.simTrade(P, 0, sig, "MKT"); ok("gap through the stop fills at the (worse) open", r.out === "SL" && r.netR < -1.6); }
{ const P = mk([[100, 100, 100, 100]].concat(flat(40))); const r = C.simTrade(P, 0, sig, "MKT"); ok("no TP/SL in 8 h → timeout exit, " + r.bars + " bars", r.out === "TO" && r.bars === 33); }
{ const P = mk([[100, 100, 100, 100], [100, 100.4, 99.65, 100.1], [100.1, 102, 100, 101.9]]); const r = C.simTrade(P, 0, sig, "PB");
  ok("PB: limit 0.3 ATR lower fills only when price trades THROUGH it, fill bar can't take profit", r.fill && Math.abs(r.entry - 99.7) < 1e-9 && r.ej === 1); }
{ const P = mk([[100, 100, 100, 100], [100, 100.4, 99.7, 100.1], [100.1, 100.5, 99.71, 100.3], [100.3, 100.6, 99.9, 100.4], [100.4, 100.6, 99.9, 100.5], [100.5, 100.6, 100, 100.5]]); const r = C.simTrade(P, 0, sig, "PB"); ok("PB: touching the limit exactly is NOT a fill → expires after 4 bars", r.fill === false); }
{ const P = mk([[100, 100, 100, 100], [100, 103, 99.5, 102.5], [102.5, 104.5, 102, 104]]); P.fr = [[900000*1.5, 0.001]]; const r = C.simTrade(P, 0, sig, "MKT"); ok("long pays positive funding (0.1 % of notional ≈ 0.05R at a 2 % stop); net = gross − fees − funding", Math.abs(r.fundR - 0.05) < 0.001 && r.fundR > 0 && Math.abs(r.netR - (r.grossR - r.feesR - r.fundR)) < 1e-9); }
{ const P = mk([[100, 100, 100, 100], [100, 101, 97.6, 98], [98, 98.2, 95.5, 96]]); const r = C.simTrade(P, 0, { dir: -1, entry: 100, stop: 102 }, "MKT"); ok("short mirror: TP1 then TP2 hit → +1.5R gross", r.out === "TP2" && Math.abs(r.grossR - 1.5) < 0.01); }
{ const P = mk([[100, 100, 100, 100], [100, 100.5, 99.5, 100]]); ok("not enough future bars → still open (resolved later)", C.simTrade(P, 0, sig, "MKT").open === true); }
console.log("\nall passed (" + n + ")");
