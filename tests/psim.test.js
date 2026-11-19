// v7.26 VADELİ SİMÜLATÖR (psim.js core) tests: node tests/psim.test.js
const fs = require("fs"), path = require("path"), P = require("../psim.js"); let f = 0;
const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i !== undefined ? "  · " + i : "")); if (!c) f++; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const COST0 = Object.assign({}, P.COST); P.setCost({ spread: 0, slip: 0, lat: 0 }); /* v8.0: legacy exact-price tests run with the cost model off; realistic fills are tested at the end */
{ const st = P.create(); ok("default virtual balance 1000 USDT", st.bal === 1000 && st.start === 1000 && !st.pos.length); }
{ const st = P.create(1000), p = P.open(st, { sym: "BTCUSDT", side: 1, margin: 100, lev: 10, px: 50000 });
  ok("open LONG: notional 1000, fee 0.05 % taken at entry", near(p.qty, 0.02) && near(st.bal, 1000 - 0.5) && near(P.free(st), 1000 - 0.5 - 100));
  ok("liquidation estimate LONG 10x ≈ entry·(1 − 1/10 + 0.4 %)", near(p.liq, 50000*(1 - 0.1 + 0.004)), p.liq);
  const r = P.close(st, p.id, 51000, "elle"); ok("manual close: gross +20, exit fee 0.51, net = 20 − 0.5 − 0.51", near(r.net, 20 - 0.5 - 0.51, 1e-9) && near(st.bal, 1000 + r.net, 1e-9), r.net);
  ok("history recorded", st.hist.length === 1 && st.hist[0].why === "elle"); }
{ const st = P.create(1000), p = P.open(st, { sym: "ETHUSDT", side: -1, margin: 50, lev: 5, px: 2000, stop: 2100, tp: 1900 });
  ok("SHORT liq above entry", p.liq > 2000 && near(p.liq, 2000*(1 + 0.2 - 0.004)));
  ok("mark below target does nothing", P.mark(st, "ETHUSDT", 1950).length === 0 && st.pos.length === 1);
  const r = P.mark(st, "ETHUSDT", 1950, 0, 1960, 1899); ok("SHORT target hit via wick → closed at target", r.length === 1 && r[0].why === "hedef" && r[0].exit === 1900 && r[0].net > 0, r[0] && r[0].net); }
{ const st = P.create(1000); P.open(st, { sym: "SOLUSDT", side: 1, margin: 100, lev: 10, px: 100, stop: 98, tp: 104 });
  const r = P.mark(st, "SOLUSDT", 101, 0, 104.5, 97.5); ok("stop and target in one check → stop assumed (conservative)", r.length === 1 && r[0].why === "stop" && r[0].exit === 98 && r[0].net < 0); }
{ const st = P.create(1000); const p = P.open(st, { sym: "SOLUSDT", side: 1, margin: 100, lev: 20, px: 100 });
  const r = P.mark(st, "SOLUSDT", 94, 0); ok("no stop: liquidation closes, loss = margin + entry fee", r.length === 1 && r[0].why === "likidasyon" && near(r[0].net, -100 - p.feeIn) && near(st.bal, 1000 - p.feeIn - 100)); }
{ const st = P.create(100); let e = ""; try { P.open(st, { sym: "BTCUSDT", side: 1, margin: 100, lev: 10, px: 50000 }); } catch(x){ e = x.message; } ok("margin + fee above free balance refused", /serbest/.test(e), e);
  e = ""; try { P.open(st, { sym: "BTCUSDT", side: 1, margin: 10, lev: 10, px: 100, stop: 101 }); } catch(x){ e = x.message; } ok("LONG stop above price refused", /stop/.test(e), e);
  e = ""; try { P.open(st, { sym: "BTCUSDT", side: -1, margin: 10, lev: 10, px: 100, tp: 101 }); } catch(x){ e = x.message; } ok("SHORT target above price refused", /hedef/.test(e), e);
  e = ""; try { P.open(st, { sym: "BTCUSDT", side: 1, margin: 10, lev: 50, px: 100, stop: 97 }); } catch(x){ e = x.message; } ok("stop beyond liquidation refused", /likidasyon/.test(e), e);
  e = ""; try { P.open(st, { sym: "BTCUSDT", side: 1, margin: 10, lev: 10, px: undefined }); } catch(x){ e = x.message; } ok("no live price → refused", /fiyat/.test(e), e); }
{ const st = P.create(1000); P.addBal(st, 500); ok("+ BAKİYE adds virtual funds", st.bal === 1500 && st.start === 1500); P.open(st, { sym: "X", side: 1, margin: 10, lev: 1, px: 1 }); P.reset(st); ok("reset → 1000, no positions, no history", st.bal === 1000 && !st.pos.length && !st.hist.length); }
{ const st = P.create(1000);
  const a = P.open(st, { sym: "A", side: 1, margin: 10, lev: 1, px: 100, sig: { word: "GİR LONG", d: 1 } }); P.close(st, a.id, 110, "elle");
  const b = P.open(st, { sym: "A", side: -1, margin: 10, lev: 1, px: 100, sig: { word: "BEKLE", d: 1 } }); P.close(st, b.id, 105, "elle");
  const c = P.open(st, { sym: "A", side: 1, margin: 10, lev: 1, px: 100, sig: { word: "BEKLE", d: -1 } }); P.close(st, c.id, 103, "elle");
  const d = P.open(st, { sym: "A", side: 1, margin: 10, lev: 1, px: 100 }); P.close(st, d.id, 99, "elle");
  const S = P.stats(st); ok("stats: 4 trades, 2 winners, total = sum of nets", S.n === 4 && S.wins === 2 && near(S.total, st.hist.reduce((s, r) => s + r.net, 0)), JSON.stringify(S));
  ok("sinyal doğruluğu: price moved with the signal direction in 2 of 3 signalled trades", S.sigN === 3 && near(S.sigAcc, 2/3)); ok("GİR trades tracked separately", S.girN === 1 && S.girWin === 1); }
{ const src = fs.readFileSync(path.join(__dirname, "..", "psim.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  ok("paper only: no order / account endpoints, no API key, no signing", !/fapi\/v1\/(order|batchOrders|leverage|marginType|account|positionRisk)|X-MBX-APIKEY|signature|HMAC|apiKey/i.test(src));
  ok("only public price reads (aggTrade stream + ticker/price)", /@aggTrade/.test(src) && /fapi\/v1\/ticker\/price/.test(src)); }
{ /* v7.27 SERT SHORT rule */
  const mk = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  const base = mk(104, i => ({ t: i*9e5, o: 100, h: 100.5, l: 99.5, c: 100, qv: 1000, tb: 500 }));
  const sig = base.concat([{ t: 104*9e5, o: 100, h: 100.2, l: 98, c: 98.5, qv: 3500, tb: 1400 }]);
  let r = P.sertShort(sig, 0.012, 0.0001); ok("SERT: red 15m close below 1h low, vol 3.5×, sell 60 %, OI +1.2 % → signal", r.sig && near(r.stop, 100.2*1.0005) && r.vr > 3.4, r.why);
  ok("SERT: same bar with funding ≥ 0.05 % and flat OI → signal", P.sertShort(sig, 0, 0.0006).sig);
  ok("SERT: no fuel (OI +0.5 %, funding 0.01 %) → no signal", !P.sertShort(sig, 0.005, 0.0001).sig);
  const lowVol = base.concat([{ ...sig[104], qv: 2500, tb: 1000 }]); ok("SERT: volume 2.5× → no signal", !P.sertShort(lowVol, 0.02, 0).sig);
  const buyers = base.concat([{ ...sig[104], tb: 2000 }]); ok("SERT: taker sell < 55 % → no signal", !P.sertShort(buyers, 0.02, 0).sig);
  const noBrk = base.concat([{ ...sig[104], l: 99.6, c: 99.6 }]); ok("SERT: close above the 1h low → no signal", !P.sertShort(noBrk, 0.02, 0).sig);
  ok("SERT: < 101 bars → no signal", !P.sertShort(sig.slice(-50), 0.02, 0.001).sig);
  const st = P.create(1000), p = P.open(st, { sym: "X", side: -1, margin: 100, lev: 10, px: 100, stop: 101, trail: 0.5, tmax: 3600000, rule: "sert", t: 0 });
  P.mark(st, "X", 99, 1000, 99.2, 98.8); ok("trailing: stop follows the low (98.8 + 0.5 = 99.3)", near(p.stop, 99.3), p.stop);
  const c = P.mark(st, "X", 99.4, 2000, 99.4, 99.0); ok("trailing stop hit → closed at 99.3 in profit", c.length === 1 && c[0].why === "stop" && c[0].exit === 99.3 && c[0].net > 0 && c[0].rule === "sert");
  const p2 = P.open(st, { sym: "Y", side: -1, margin: 100, lev: 10, px: 50, stop: 51, trail: 0.3, tmax: 3600000, rule: "sert", t: 0 });
  ok("time stop: nothing before 60 min", P.expire(st, { Y: 49.9 }, 3599999).length === 0);
  const e = P.expire(st, { Y: 49.9 }, 3600000); ok("time stop: closed at 60 min at the live price", e.length === 1 && e[0].why === "süre" && e[0].exit === 49.9);
  const q = P.open(st, { sym: "Z", side: 1, margin: 10, lev: 1, px: 10 }); P.close(st, q.id, 9, "elle");
  const S = P.stats(st, "sert"), A = P.stats(st); ok("rule stats only count SERT trades", S.n === 2 && A.n === 3 && S.wins === 2, JSON.stringify(S)); }
/* v8.0 F — realistic paper fills */
{ P.setCost(COST0); ok("default cost model on: spread 0.01 %, slip 0.02 %, stop ×2, latency 0.01 %", near(P.COST.spread, 0.0001) && near(P.COST.slip, 0.0002) && P.COST.stopSlipX === 2 && near(P.COST.lat, 0.0001));
  const st = P.create(1000), p = P.open(st, { sym: "A", side: 1, margin: 100, lev: 10, px: 100 });
  ok("model LONG entry pays half spread + slip + latency", near(p.entry, 100*(1 + 0.00005 + 0.0002 + 0.0001)) && p.fillVia === "model" && p.filled === 1, p.entry);
  const r = P.close(st, p.id, 100, "elle"); ok("round trip at an unchanged price loses fees + spread + slippage", r.net < -(1000*0.0005*2) && r.slip > 0, r.net);
  const s2 = P.open(st, { sym: "A", side: -1, margin: 100, lev: 10, px: 100, stop: 101 }); const c = P.mark(st, "A", 101, 0, 101, 100);
  ok("SHORT stop exit fills ABOVE the stop (buy) with 2× slip", c.length === 1 && c[0].why === "stop" && near(c[0].exit, 101*(1 + 0.00005 + 0.0004 + 0.0001)) && c[0].trig === 101, c[0] && c[0].exit);
  const st3 = P.create(1000), tp = P.open(st3, { sym: "A", side: 1, margin: 10, lev: 1, px: 100, tp: 102 }); const h = P.mark(st3, "A", 102, 0, 102, 100);
  ok("target (TAKE_PROFIT_MARKET) is a taker exit: below the target for a LONG", h[0].why === "hedef" && h[0].exit < 102 && h[0].exit > 101.9, h[0].exit); }
{ const st = P.create(10000), book = { t: 1000, asks: [[100, 2], [100.5, 3]], bids: [[99.9, 50]] };
  const p = P.open(st, { sym: "B", side: 1, margin: 100, lev: 10, px: 99.95, book, t: 1500 }); /* 10 units: 2 @100 + 3 @100.5 visible = 5 → half filled */
  ok("book walk: partial entry when visible depth is thinner than the order", near(p.filled, (2 + 3)/(1000/99.95), 1e-9) && near(p.margin, 100*p.filled, 1e-9) && p.fillVia === "defter", p.filled);
  ok("book VWAP + latency", near(p.entry, ((2*100 + 3*100.5)/5)*(1 + 0.0001), 1e-9), p.entry);
  const big = { t: 1000, asks: [[100, 1000]], bids: [[99.9, 1], [99.8, 1]] }, q = P.open(st, { sym: "C", side: 1, margin: 100, lev: 10, px: 99.95, book: big, t: 1000 });
  ok("deep book → full fill", q.filled === 1);
  const r = P.close(st, q.id, 99.85, "elle", 1200, { book: big }); ok("exit through a thin book always fills fully; rest priced past the last level", r.exit < 99.8 && r.exit > 99.8*(1 - 0.001), r.exit);
  const stale = P.open(st, { sym: "D", side: 1, margin: 10, lev: 1, px: 100, book: { t: 0, asks: [[50, 1]], bids: [[49, 1]] }, t: 10000 }); ok("stale book (> 3 s) ignored → model fill", stale.fillVia === "model" && stale.entry > 100); }
{ const st = P.create(1000), p = P.open(st, { sym: "E", side: -1, margin: 10, lev: 10, px: 100, book: { t: 0, bids: [[99, 100]], asks: [[101, 100]] }, t: 0 });
  ok("liquidation estimate from the actual fill price", near(p.liq, P.liqPx(-1, p.entry, 10)) && p.entry < 99, p.entry);
  const src = require("fs").readFileSync(require("path").join(__dirname, "../psim.js"), "utf8"); ok("SIM only: no order endpoints / keys in psim.js", !/fapi\/v1\/order|X-MBX-APIKEY|signature=/.test(src)); }
console.log(f ? `${f} FAILED` : "ALL PASS"); process.exit(f ? 1 : 0);
