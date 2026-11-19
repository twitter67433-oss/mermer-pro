// v7.26 VADELİ SİMÜLATÖR (psim.js core) tests: node tests/psim.test.js
const fs = require("fs"), path = require("path"), P = require("../psim.js"); let f = 0;
const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i !== undefined ? "  · " + i : "")); if (!c) f++; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
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
console.log(f ? `${f} FAILED` : "ALL PASS"); process.exit(f ? 1 : 0);
