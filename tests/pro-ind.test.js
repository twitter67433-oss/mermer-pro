/* MERMER PRO indicators vs reference values: StockCharts' published Wilder RSI example + an independent Python implementation (tests/pro-ind.ref.json) */
const assert = require("assert"), I = require("../pro/ind.js"), R = require("./pro-ind.ref.json"); let n = 0; const ok = (m, c) => { assert.ok(c, m); n++; console.log("PASS", m); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e*Math.max(1, Math.abs(b));
{ const c = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
  const r = I.rsi(c), exp = [70.53, 66.32, 66.55, 69.41, 66.36, 57.97];
  ok("RSI(14) matches StockCharts' Wilder example within 0.1 (their sheet rounds the averages; exact Wilder = 70.46, 66.25 …)", exp.every((v, k) => Math.abs(r[14 + k] - v) < 0.1));
  ok("exact Wilder value 70.4641 (independent recomputation)", Math.abs(r[14] - 70.4641) < 0.001); ok("RSI undefined before 14 changes", r[13] === null); }
const b = R.bars, c = b.map(x => x.c);
const chk = (name, arr, ref, e) => ok(name + " = independent reference at bars " + Object.keys(ref).join(","), Object.entries(ref).every(([i, v]) => arr[+i] !== null && near(arr[+i], v, e)));
chk("EMA20 (SMA seed)", I.ema(c, 20), R.ema20); chk("ATR14 (Wilder)", I.atr(b, 14), R.atr); chk("RSI14", I.rsi(c), R.rsi);
const md = I.macd(c); chk("MACD 12/26", md.macd, R.macd); chk("MACD histogram (signal 9)", md.hist, R.hist);
const ax = I.adx(b, 14); chk("ADX14", ax.adx, R.adx); chk("+DI14", ax.pdi, R.pdi);
const bb = I.boll(c, 20, 2); chk("Bollinger upper", bb.up, R.bbu); chk("Bollinger lower", bb.lo, R.bbl);
chk("OBV", I.obv(b), R.obv); chk("VWAP (UTC day)", I.vwap(b), R.vwap);
{ const x = [{ t: 0, qv: 100, tb: 75 }, { t: 1, qv: 0, tb: 0 }]; const d = I.delta(x); ok("taker delta = (buy − sell)/total, zero volume → 0", d[0] === 0.5 && d[1] === 0); }
{ const m = []; for (let i = 0; i < 10; i++) m.push({ t: i*900000, o: i, h: i + 1, l: i - 1, c: i + 0.5, v: 1, qv: 2, tb: 1 });
  const h = I.resample(m, 3600000); ok("1h resample: only complete 4×15m buckets, OHLCV aggregated", h.length === 2 && h[0].o === 0 && h[0].c === 3.5 && h[0].h === 4 && h[0].l === -1 && h[0].qv === 8);
  const a = I.alignIdx(m, 900000, h, 3600000); ok("alignment: a 15m bar sees the 1h bar only after that hour CLOSED", a[2] === -1 && a[3] === 0 && a[6] === 0 && a[7] === 1); }
{ const s = [1, 3, 2, 5, 4, 6, 3, 2, 4].map((v, i) => ({ t: i, o: v, h: v + 0.5, l: v - 0.5, c: v })); const sw = I.swings(s, 1);
  ok("swing pivots are reported k bars AFTER the pivot (confirmation delay, no look-ahead)", sw.every(x => x.at === x.p + 1) && sw.some(x => x.kind === "H" && x.p === 5)); }
console.log("\nall passed (" + n + ")");
