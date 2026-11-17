// v7.11 SCALP 2-5 DK pure math tests: node tests/scalp.test.js
const M = require("../scalp.js"); let f = 0; const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i !== undefined ? "  · " + i : "")); if (!c) f++; };
const mk = (n, fn, step = 60000, vol = i => 10 + (i % 7)) => Array.from({ length: n }, (_, i) => { const c = fn(i), o = fn(i - 1); return { t: 1.7e12 + i*step, T: 1.7e12 + (i + 1)*step - 1, o, h: Math.max(o, c)*1.0008, l: Math.min(o, c)*0.9992, c, v: vol(i), tb: vol(i)*(c >= o ? 0.65 : 0.35), x: true }; });
const nz = i => Math.sin(i*1.7)*0.05 + Math.sin(i*0.37)*0.04;
const up = s => mk(400, i => 100*Math.exp(s*i/4000) + nz(i)), tf = (s, st) => mk(300, i => 100*Math.exp(s*i*st/4000) + nz(i), st*60000);
const fin = A => A.votes.every(v => isFinite(v.v) && !/NaN|undefined/.test(v.val)) && isFinite(A.conf) && isFinite(A.score);
const U = M.analyze({ b1: up(1), b3: tf(1, 3), b5: tf(1, 5), book: { bid: 120, ask: 80 }, der: { fund: 0.0001, oiCh: 0.6, ls: 1.2, tk: 1.1 }, now: 0 });
ok("26 votes, no NaN", U.votes.length === 26 && fin(U), U.votes.length);
ok("steady uptrend → LONG lean, stop < entry < TP1 < TP2", U.score > 0.2 && U.plan && U.plan.stop < U.plan.entry && U.plan.entry < U.plan.tp1 && U.plan.tp1 < U.plan.tp2, U.side + " " + U.conf + " " + U.score + " " + U.veto.join("|"));
const D = M.analyze({ b1: up(-1), b3: tf(-1, 3), b5: tf(-1, 5), now: 0 });
ok("steady downtrend → SHORT lean, stop above, targets below", D.score < -0.2 && D.plan.stop > D.plan.entry && D.plan.tp1 < D.plan.entry, D.side + " " + D.score);
const F = M.analyze({ b1: mk(400, i => 100 + nz(i)*0.05), b3: mk(300, i => 100 + nz(i)*0.05, 180000), b5: mk(300, i => 100 + nz(i)*0.05, 300000), now: 0 });
ok("flat, tiny moves → BEKLE with veto", F.side === "BEKLE" && F.veto.length > 0, F.veto.join(" | "));
ok("spot (no derivatives/book) → still no NaN", fin(M.analyze({ b1: up(1), now: 0 })));
ok("too few bars → null", M.analyze({ b1: up(1).slice(0, 30) }) === null);
// outcomes
const b = mk(10, i => 100); const L = { t: b[2].t, side: "LONG", entry: 100, stop: 99, tp1: 101 };
b[3].h = 101.2; ok("outcome: TP when high reaches TP1", M.outcome(L, b, 2).r === "TP");
b[3].l = 98.9; ok("outcome: stop first when one candle hits both", M.outcome(L, b, 2).r === "SL");
const b2 = mk(10, i => 100 + i*0.01); ok("outcome: neither → sign of close", M.outcome(L, b2, 3).r === "+");
ok("outcome: not enough bars yet → null", M.outcome({ ...L, t: b[8].t }, b, 5) === null);
const st = M.stats([{ side: "LONG", res: { 2: { r: "TP", pnl: 1 }, 3: { r: "SL", pnl: -1 }, 5: { r: "+", pnl: 0.2 } } }, { side: "BEKLE", res: {} }]);
ok("stats: hit rate per horizon, BEKLE ignored", st[2].hit === 100 && st[3].hit === 0 && st[5].dir === 100 && st[5].n === 1);
// indicators sanity
const c = Array.from({ length: 60 }, (_, i) => 100 + i); ok("supertrend up on rising series", M.supertrend(mk(60, i => 100 + i)).dir[59] === 1);
ok("psar below price on rising series", M.psar(mk(60, i => 100 + i)).up[59] === 1);
ok("adx high on clean trend", M.adx(mk(80, i => 100 + i)).adx[79] > 40);
ok("stoch rsi in 0..100", (() => { const s = M.stochRsi(c.map((x, i) => x + Math.sin(i))); return s.k[59] >= 0 && s.k[59] <= 100; })());
ok("pattern: bullish engulfing", M.pattern([{ o: 101, c: 100, h: 101.1, l: 99.9 }, { o: 99.8, c: 101.5, h: 101.6, l: 99.7 }], 1).v === 1);
const bt = M.backtest(up(1).slice(0, 220), tf(1, 3), tf(1, 5)); ok("backtest runs and returns stats", bt.n > 0 && bt.st[2] !== undefined, bt.sig + " signals");
// v7.12 intervals
ok("higher(): 15m → 30m,1h · 1d → 3d,1w · 12h → 1d,3d", M.higher("15m").join() === "30m,1h" && M.higher("1d").join() === "3d,1w" && M.higher("12h").join() === "1d,3d");
ok("dataPeriod: 1m→5m, 3m→5m, 8h→6h, 1d→1d", M.dataPeriod("1m") === "5m" && M.dataPeriod("3m") === "5m" && M.dataPeriod("8h") === "6h" && M.dataPeriod("1d") === "1d");
{ const hb = mk(12, i => 100, 3600e3); const sg = { tf: "1h", t: hb[2].t, side: "SHORT", entry: 100, stop: 101, tp1: 99 }; hb[4].l = 98.9; ok("outcome counts candles of the signal interval (1h)", M.outcome(sg, hb, 2).r === "TP" && M.outcome({ ...sg, t: hb[9].t }, hb, 3) === null); }
{ const D1 = M.analyze({ tf: "1d", b1: mk(400, i => 100*Math.exp(i/4000) + nz(i), 864e5), b3: mk(150, i => 100*Math.exp(3*i/4000), 2592e5), b5: mk(80, i => 100*Math.exp(7*i/4000), 6048e5), now: 0 });
  ok("1d analysis: no NaN, MTF label uses 3G/1H, hold in days", fin(D1) && /3G .*1H/.test(D1.votes.find(v => v.k === "mtf").val) && (!D1.plan || D1.plan.holdMs >= 2*864e5), D1.votes.find(v => v.k === "mtf").val); }
ok("dur(): 3 dk / 2 saat / 5 gün", M.dur(18e4) === "3 dk" && M.dur(72e5) === "2 saat" && M.dur(5*864e5) === "5 gün");
console.log(f ? f + " FAIL" : "ALL PASS"); process.exit(f ? 1 : 0);
