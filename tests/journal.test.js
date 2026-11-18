// v7.17 SANAL TAKİP journal tests: node tests/journal.test.js
const J = require("../journal.js"); let f = 0; const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i !== undefined ? "  · " + i : "")); if (!c) f++; };
const T0 = 1_700_000_000_000, bar = (k, o, h, l, c) => ({ t: T0 + k*6e4, T: T0 + k*6e4 + 59999, o, h, l, c });
const L = (o = {}) => J.make({ sym: "BTCUSDT", tf: "15m", d: 1, entry: 100, stop: 99, tp: 102, t: T0 + 30000, ...o });
// fees
ok("fee math: LONG 100→102 = +2 % − 0.10 % = +1.90 %", Math.abs(J.netPct(1, 100, 102) - 1.9) < 1e-9);
ok("fee math: SHORT 100→99 = +0.90 %, SHORT stop 100→101 = −1.10 %", Math.abs(J.netPct(-1, 100, 99) - 0.9) < 1e-9 && Math.abs(J.netPct(-1, 100, 101) + 1.1) < 1e-9);
// validation
ok("make: rejects stop/target on the wrong side", !J.make({ sym: "X", tf: "1m", d: 1, entry: 100, stop: 101, tp: 102 }) && !J.make({ sym: "X", tf: "1m", d: -1, entry: 100, stop: 99, tp: 98 }) && !!L());
// resolution
{ const a = J.resolveBars(L(), [bar(1, 100, 101, 99.5, 100.5), bar(2, 100.5, 102.2, 100.2, 102)], T0 + 9e5); ok("target first → DOĞRU, exit at target, net +1.90 %", a.st === "closed" && a.how === "TP" && a.ok && a.exit === 102 && Math.abs(a.net - 1.9) < 1e-9); }
{ const a = J.resolveBars(L(), [bar(1, 100, 100.5, 98.9, 99)], T0 + 9e5); ok("stop first → YANLIŞ, net −1.10 %", a.how === "SL" && !a.ok && Math.abs(a.net + 1.1) < 1e-9); }
{ const a = J.resolveBars(L(), [bar(1, 100, 102.5, 98.5, 101)], T0 + 9e5); ok("same candle touches stop AND target → STOP counted first (conservative)", a.how === "SL" && !a.ok); }
{ const a = J.resolveBars(L(), [bar(0, 97, 103, 97, 100)], T0 + 9e5); ok("candle that started before the entry is ignored (pre-entry prices unknown)", a.st === "open"); }
{ const s = J.make({ sym: "B", tf: "15m", d: -1, entry: 100, stop: 101, tp: 98, t: T0 + 30000 }), a = J.resolveBars(s, [bar(1, 100, 100.5, 97.9, 98)], T0 + 9e5); ok("SHORT: target below hit → DOĞRU", a.how === "TP" && a.ok && Math.abs(a.net - 1.9) < 1e-9); }
{ const tr = L({ tf: "1m" }), bs = []; for (let k = 1; k <= 25; k++) bs.push(bar(k, 100, 100.5, 99.6, 100.3)); const a = J.resolveBars(tr, bs, T0 + 30*6e4);
  ok("timeout after 20 candles of the interval → SÜRE, closed at last price, DOĞRU only if net > 0", a.how === "SÜRE" && a.exit === 100.3 && a.ok === (a.net > 0) && Math.abs(a.net - 0.2) < 1e-9, a.net.toFixed(3)); }
{ const tr = L(); J.resolveBars(tr, [bar(1, 100, 101, 99.5, 100.5)], T0 + 2*6e4); const c1 = tr.chk; J.resolveBars(tr, [bar(1, 100, 101, 99.5, 100.5), bar(2, 100.5, 101.5, 99.8, 101)], T0 + 3*6e4);
  ok("incremental: already-checked candles are skipped, state stays open, chk advances", tr.st === "open" && tr.chk > c1); }
// live ticks
{ const a = J.tick(L(), 102.01, T0 + 6e4); ok("live tick ≥ target → DOĞRU", a.how === "TP"); const b = J.tick(L(), 98.99, T0 + 6e4); ok("live tick ≤ stop → YANLIŞ", b.how === "SL"); }
// dedupe + cap
{ let r = J.add([], L()); r = J.add(r.list, L()); ok("dedupe: same coin+interval+direction not re-opened while open", r.list.length === 1 && !r.added);
  r = J.add(r.list, L({ d: -1, stop: 101, tp: 98 })); ok("dedupe: opposite direction is a separate trade", r.list.length === 2);
  r = J.add(r.list, L({ tf: "1h" })); ok("dedupe: other interval is a separate trade", r.list.length === 3);
  const cl = J.close(r.list.find(x => x.tf === "1h"), "TP", 102, T0); r = J.add(r.list, L({ tf: "1h" })); ok("dedupe: after it closes, the same setup can open again", r.added);
  let big = []; for (let k = 0; k < 520; k++){ const x = L({ sym: "S" + k, t: T0 + k }); J.close(x, "SL", 99, T0 + k); big = J.add(big, x).list; } big = J.add(big, L({ sym: "OPEN" })).list;
  ok("cap: list kept at " + J.MAXN + ", newest kept, open trades never dropped", big.length === J.MAXN && big.some(x => x.sym === "OPEN") && big.some(x => x.sym === "S519") && !big.some(x => x.sym === "S0")); void cl; }
// triggers
{ ok("trigger: breakout fires only on a CLOSE beyond the level", !!J.trigFired({ d: 1, k: "kırılım", lv: 100 }, { o: 99, h: 101, l: 98, c: 100.5 }) && !J.trigFired({ d: 1, k: "kırılım", lv: 100 }, { o: 99, h: 101, l: 98, c: 99.9 }));
  const p = J.trigFired({ d: 1, k: "geri çekilme", a: 98, b: 99 }, { o: 100, h: 100.5, l: 98.8, c: 99.5 }); ok("trigger: pullback zone touched → entry at zone top", p && p.entry === 99); }
// stats + csv
{ const A = J.close(L(), "TP", 102, T0), B = J.close(L({ tf: "1h" }), "SL", 99, T0), Cc = L({ tf: "5m" }); const s = J.stats([A, B, Cc]);
  ok("stats: toplam 3, doğru 1, yanlış 1, açık 1, isabet 50 %, net +0.80 %", s.n === 3 && s.ok === 1 && s.bad === 1 && s.open === 1 && s.hit === 0.5 && Math.abs(s.net - 0.8) < 1e-9);
  ok("stats: breakdown by interval and type; filter by interval", s.byTf["15m"].n === 1 && s.byType["A+"].n === 2 && J.stats([A, B, Cc], { tf: "1h" }).n === 1);
  const c = J.csv([A]); ok("csv: header + row, Berlin time, DOĞRU", c.split("\n").length === 2 && /zaman \(Berlin\)/.test(c) && /DOĞRU/.test(c)); }
// paper only
{ const src = require("fs").readFileSync(__dirname + "/../journal.js", "utf8"); ok("paper only: journal.js has no network, order, key or wallet code", !/fetch\(|WebSocket|XMLHttpRequest|order|apiKey|secret|WALLET|EXEC|sign/i.test(src.replace(/\/\*[\s\S]*?\*\//g, ""))); }
console.log(f ? f + " FAIL" : "ALL PASS"); process.exit(f ? 1 : 0);
