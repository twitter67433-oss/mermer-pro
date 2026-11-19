// v7.26 FORMASYON + DESTEK/DİRENÇ (patterns.js) tests: node tests/patterns.test.js
const P = require("../patterns.js"); let f = 0;
const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i !== undefined ? "  · " + i : "")); if (!c) f++; };
const bar = (o, c, h, l) => ({ o, c, h: h ?? Math.max(o, c) + 0.2, l: l ?? Math.min(o, c) - 0.2 });
const flat = n => Array.from({ length: n }, (_, i) => bar(100 + Math.sin(i)*0.5, 100 + Math.sin(i + 1)*0.5));
{ const b = flat(30); b.push(bar(101, 100)); b.push(bar(99.8, 101.6)); const r = P.candles(b, 3); ok("bullish engulfing found on the last candle", r.some(x => x.k === "yutan" && x.d === 1 && x.i === b.length - 1), JSON.stringify(r)); }
{ const b = flat(30); b.push(bar(100.4, 100.6, 100.7, 98)); const r = P.candles(b, 2); ok("hammer: long lower wick, small body at the top", r.some(x => x.k === "çekiç" && x.i === b.length - 1), JSON.stringify(r)); }
{ const b = flat(30); b.push(bar(100, 100.02, 101.2, 98.8)); const r = P.candles(b, 2); ok("doji: tiny body, wide range", r.some(x => x.k === "doji" && x.i === b.length - 1), JSON.stringify(r)); }
{ // double top: rise → peak 110 → dip 104 → peak 110 → fall
  const path = [], seg = (a, z, n) => { for (let i = 1; i <= n; i++) path.push(a + (z - a)*i/n); };
  seg(100, 100, 10); seg(100, 110, 8); seg(110, 104, 8); seg(104, 110, 8); seg(110, 103, 8);
  const b = path.map((c, i) => bar(i ? path[i - 1] : c, c, Math.max(i ? path[i - 1] : c, c) + 0.1, Math.min(i ? path[i - 1] : c, c) - 0.1)); const r = P.chart(b);
  ok("double top detected with a neckline", r.some(x => x.k === "ikili tepe" && x.lv < 110), JSON.stringify(r));
  const inv = b.map(x => ({ o: 200 - x.o, c: 200 - x.c, h: 200 - x.l, l: 200 - x.h })); ok("double bottom = mirrored double top", P.chart(inv).some(x => x.k === "ikili dip"), JSON.stringify(P.chart(inv))); }
{ const path = [], seg = (a, z, n) => { for (let i = 1; i <= n; i++) path.push(a + (z - a)*i/n); }; seg(100, 100, 22); seg(100, 120, 10); seg(120, 118, 10);
  const b = path.map((c, i) => bar(i ? path[i - 1] : c, c)); const r = P.chart(b); ok("bull flag: strong pole then tight drift", r.some(x => x.k === "bayrak" && x.d === 1), JSON.stringify(r)); }
{ const b = []; for (let k = 0; k < 6; k++){ for (let i = 0; i < 6; i++) b.push(bar(100 + i, 101 + i)); for (let i = 0; i < 6; i++) b.push(bar(106 - i, 105 - i)); }
  const L = P.levels(b, 103); ok("levels: resistance above, support below the price", L.some(x => x.k === "R" && x.p > 103) && L.some(x => x.k === "D" && x.p < 103) && L.every(x => (x.k === "R") === (x.p > 103)), JSON.stringify(L));
  ok("levels: repeated pivots cluster (n ≥ 2)", L.some(x => x.n >= 2)); }
{ ok("short input → no crash, empty", P.chart(flat(10)).length === 0 && P.levels(flat(10), 100).length === 0); }
console.log(f ? `${f} FAILED` : "ALL PASS"); process.exit(f ? 1 : 0);
