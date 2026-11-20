/* v8.0.1: HAREKET crypto mover alert + KRİPTO/HİSSE/HEPSİ filter + crypto-first scan + TradFi session volume baseline */
const assert = require("assert"), fs = require("fs"), path = require("path"), D = path.join(__dirname, "..");
const H = require("../hareket.js"), X = require("../sert.js"); let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const t0 = 1_800_000_000_000, M = 60000;
// 1h move: seeded from bars, fires once, dedup within 60 min, again after cooldown; direction separate
{ const S = H.state(), sym = "MMTUSDT"; H.seed(S, sym, [0,1,2,3,4,5].map(i => ({ t: t0 - 90*M + i*15*M, c: 1 })));
  H.feed(S, sym, t0, 1.10); let e = H.check(S, sym, t0, 0.02); ok(e.length === 1 && e[0].w === "1s" && e[0].dir === 1 && Math.abs(e[0].ch - 0.10) < 1e-9, "1h +10% → one ↑ alert");
  H.feed(S, sym, t0 + M, 1.12); ok(H.check(S, sym, t0 + M, 0.02).length === 0, "same coin/window → no repeat");
  ok(H.check(S, sym, t0 + 30*M, 0.02).length === 0, "still inside 60 min → silent"); }
{ const S = H.state(); H.seed(S, "A", [{ t: t0 - 75*M, c: 100 }]); H.feed(S, "A", t0, 103); ok(H.check(S, "A", t0, 0.01).length === 0, "+3% in 1h < 8% → nothing");
  H.feed(S, "A", t0 + M, 91); const e = H.check(S, "A", t0 + M, -0.05); ok(e.length === 1 && e[0].dir === -1, "−9% in 1h → ↓ alert"); }
{ const S = H.state(); ok(H.check(S, "B", t0, NaN).length === 0, "no history → no 1h alert"); H.feed(S, "B", t0, 1); ok(H.check(S, "B", t0, 0.338).filter(e => e.w === "24s").length === 1, "24h +33.8% → alert");
  ok(H.check(S, "B", t0 + 6*3600*1000, 0.34).length === 0, "24h: one per 12 h"); ok(H.check(S, "B", t0 + 13*3600*1000, 0.34).length === 1, "24h: again after 12 h");
  ok(H.check(H.state(), "C", t0, 0.14).length === 0, "24h +14% < 15% default"); ok(H.check(H.state(), "C", t0, 0.14, { h24: 0.10 }).length === 1, "configurable threshold"); }
// 15m bar: needs move AND volume, one per bar
{ const S = H.state(), f = (r15, vr, t = t0) => ({ x: { t }, r15, vr });
  ok(H.check15(S, "D", f(0.05, 4)).length === 1, "15m +5% with 4× volume → alert"); ok(H.check15(S, "D", f(0.05, 4)).length === 0, "same bar → once");
ok(H.check15(H.state(), "E", f(0.06, 2)).length === 0, "volume too low → no alert");
  ok(H.check15(H.state(), "E", f(-0.03, 9)).length === 0, "move too small → no alert"); ok(H.check15(H.state(), "E", f(-0.05, 3))[0].dir === -1, "15m dump"); }
// risk line
ok(/SQUEEZE RİSKİ/.test(H.risk(1, 0.0001, { on: true })), "pump + SQZ on → squeeze risk");
ok(/squeeze riski/.test(H.risk(1, -0.001, null)), "pump + negative funding → squeeze risk");
ok(/long tasfiye/.test(H.risk(-1, 0.001, null)) && /işareti yok/.test(H.risk(-1, 0.0001, null)), "dump risk lines");
// crypto only
ok(H.crypto({ symbol: "MMTUSDT", contractType: "PERPETUAL", status: "TRADING", quoteAsset: "USDT" }, ""), "crypto perp ok");
ok(!H.crypto({ symbol: "TSLAUSDT", contractType: "TRADIFI_PERPETUAL", status: "TRADING", quoteAsset: "USDT" }, "HİSSE"), "stock excluded");
ok(!H.crypto({ symbol: "XAUUSDT", contractType: "PERPETUAL", status: "TRADING", quoteAsset: "USDT" }, "ALTIN"), "gold excluded");
ok(!H.crypto({ symbol: "BTCUSDC", contractType: "PERPETUAL", status: "TRADING", quoteAsset: "USDC" }, ""), "USDC excluded");
ok(H.cfgOf({ h1: -1, h24: "x" }).h1 === 0.08 && H.cfgOf({ h24: "x" }).h24 === 0.15, "bad config → defaults");
// signal only
{ const src = fs.readFileSync(path.join(D, "hareket.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  ok(!/fapi\/v1\/(order|batchOrders|leverage|algoOrder)|X-MBX-APIKEY|signature|sendTransaction|signAndSend|WALLET|EXEC|PUMP\.|MEME\.|AUTO|TRADE|PSIM|BKEYS|apiKey/i.test(src), "HAREKET: no orders/keys/wallet/auto-buy");
  ok(/!miniTicker@arr/.test(src) && /premiumIndex/.test(src), "public data only"); }
// KRİPTO / HİSSE / HEPSİ + crypto-first scan order
ok(X.KMODES[0] === "kripto" && X.kvis("kripto", "") && !X.kvis("kripto", "HİSSE") && X.kvis("hisse", "ALTIN") && !X.kvis("hisse", "") && X.kvis("hepsi", "HİSSE"), "filter modes");
{ const U = ["TSLAUSDT", "BTCUSDT", "XAUUSDT", "MMTUSDT"], vol = { TSLAUSDT: 9e9, XAUUSDT: 8e9, BTCUSDT: 5e9, MMTUSDT: 1e6 }, T = s => s === "TSLAUSDT" || s === "XAUUSDT";
  ok(X.order(U, ["XAUUSDT"], vol, T).join() === "XAUUSDT,BTCUSDT,MMTUSDT,TSLAUSDT", "watchlist first, then all crypto by volume, then TradFi");
  ok(X.order(U, [], vol).join() === "TSLAUSDT,XAUUSDT,BTCUSDT,MMTUSDT", "no isT → old volume order (back-compat)"); }
{ const src = fs.readFileSync(path.join(D, "sert.js"), "utf8");
  ok(/return X\.KMODES\.includes\(v\) \? v : "kripto"/.test(src), "default view = KRİPTO"); ok(src.includes("VOL, sym => !!KIND[sym])"), "live scan passes TradFi test → crypto first");
  ok(/rowsOf\(k\)\{ return \[\.\.\.R\.L\[k\]\.keys\(\)\]\.filter\(vis\)/.test(src) && /L = L\.filter\(r => vis\(r\.sym\)\)/.test(src), "lists + phone alerts follow the filter");
  ok(/sess: !!KIND\[s\]/.test(src), "TradFi uses session baseline"); }
// session baseline: stock with dead hours
{ const mk = (q, last) => { const b = []; for (let i = 0; i < 120; i++) b.push({ t: i*900000, o: 10, h: 10.1, l: 9.9, c: 10, qv: q(i), tb: q(i)/2 }); b[119] = Object.assign({}, b[119], { qv: last, c: 9.95 }); return b; };
  const stock = mk(i => (i % 4 === 0 ? 1000 : 0), 1500), fp = X.feat(stock), fs2 = X.feat(stock, { sess: true });
  ok(fp.vr >= 5 && fs2.vr < 2, `dead-hour baseline inflates vr (plain ${fp.vr.toFixed(1)}× → session ${fs2.vr.toFixed(1)}×)`);
  const cr = mk(() => 1000, 3500); ok(Math.abs(X.feat(cr).vr - X.feat(cr, { sess: true }).vr) < 1e-9, "steady volume: session = plain");
  ok(X.feat(cr).vr === X.feat(cr, undefined).vr, "crypto default unchanged"); }
// UI wiring
{ const html = fs.readFileSync(path.join(D, "index.html"), "utf8"); ok(/id="mv-short"/.test(html) && /id="mv-long"/.test(html) && html.indexOf("sert.js") < html.indexOf("hareket.js"), "HAREKET blocks + script order"); }
// v8.0.1: Binance split USDⓈ-M WebSockets — legacy /ws and /stream open but stay silent for trades / tickers / liquidations
for (const fn of fs.readdirSync(D).filter(f => f.endsWith(".js"))){ const t = fs.readFileSync(path.join(D, fn), "utf8");
  for (const m of t.matchAll(/wss:\/\/fstream\.binance\.com\/(ws|stream)[^"'`]*/g)){ ok(/depth/.test(m[0]) || fn === "app.js", `${fn}: legacy fstream path for a market stream: ${m[0]}`); } }
ok(/market\/stream\?streams=.*@aggTrade/.test(fs.readFileSync(path.join(D, "psim.js"), "utf8")) && /public\/stream\?streams=.*@depth20/.test(fs.readFileSync(path.join(D, "psim.js"), "utf8")), "PSIM: trades on /market, book on /public");
console.log("hareket.test OK", n, "checks");
