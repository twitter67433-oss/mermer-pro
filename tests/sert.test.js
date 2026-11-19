/* v7.28 SERT SHORT main signal / scanner — pure parts */
const X = require("../sert.js"), P = require("../psim.js"); let fails = 0;
const ok = (c, m) => { if (!c){ fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const now = 1_800_000_000_000;
// top(): perps only, no BTC/ETH/stables, fresh, sorted by quote volume, n
const tk = [["BTCUSDT", 9e9], ["ETHUSDT", 8e9], ["SOLUSDT", 5e9], ["USDCUSDT", 4e9], ["DOGEUSDT", 3e9], ["BTCUSDT_261225", 2e9], ["OLDUSDT", 6e9, now - 7200000], ["PEPEUSDC", 1e9], ["EVAAUSDT", 1e8], ["XUSDT", 0]]
  .map(([symbol, q, ct]) => ({ symbol, quoteVolume: String(q), closeTime: ct || now - 1000 }));
ok(JSON.stringify(X.top(tk, 50, now)) === JSON.stringify(["SOLUSDT", "DOGEUSDT", "EVAAUSDT"]), "top: alts only, by volume");
ok(X.top(tk, 2, now).length === 2, "top: limit n");
// bars: 100 flat bars + a signal bar
function bars(sig){ const b = []; for (let i = 0; i < 100; i++) b.push({ t: i*900000, o: 10, h: 10.1, l: 9.9, c: 10, qv: 1000, tb: 500 });
  b.push(sig || { t: 100*900000, o: 10, h: 10.05, l: 9.6, c: 9.7, qv: 4000, tb: 1200 }); return b; }
const b = bars();
ok(X.pre(b) === true, "pre: red breakdown, 4× vol, 70% sell passes");
ok(P.sertShort(b, 0.02, 0).sig === true && P.sertShort(b, 0, 0).sig === false, "full rule still needs OI or funding fuel");
ok(X.pre(bars({ t: 0, o: 10, h: 10.05, l: 9.6, c: 9.7, qv: 2000, tb: 600 })) === false, "pre: 2× volume fails");
ok(X.pre(bars({ t: 0, o: 10, h: 10.05, l: 9.6, c: 9.7, qv: 4000, tb: 2000 })) === false, "pre: 50% sell fails");
ok(X.pre(bars({ t: 0, o: 10, h: 10.05, l: 9.95, c: 9.95, qv: 4000, tb: 1000 })) === false, "pre: no break of 4-bar low fails");
ok(X.pre(b.slice(0, 60)) === false, "pre: too few bars");
// pre is a superset of the full rule: whenever the rule fires, pre passes
let sup = true; for (let k = 0; k < 300; k++){ const c = 9.5 + Math.random(), o = 9.5 + Math.random(), sg = { t: 0, o, h: Math.max(o, c) + 0.05, l: Math.min(o, c) - 0.05, c, qv: 1000 + Math.random()*5000, tb: Math.random()*3000 };
  const bb = bars(sg); if (P.sertShort(bb, 0.05, 0.001).sig && !X.pre(bb)) sup = false; } ok(sup, "pre never drops a real trigger");
ok(X.okRisk(10, 10.2) && !X.okRisk(10, 10.4) && !X.okRisk(10, 9.9), "risk: stop above entry and ≤3%");
// simExit: stop-first, trailing, 60-min cap, fee
const m = a => a.map(([h, l, c]) => ({ h, l, c }));
let r = X.simExit(10, 10.2, 0.1, m([[10.25, 9.9, 10.1]]));
ok(r && r.why === "stop" && Math.abs(r.net - (-0.02 - 0.001)) < 1e-9, "simExit: stop hit → −2% −fee");
r = X.simExit(10, 10.2, 0.1, m([[10.05, 9.5, 9.6], [9.7, 9.55, 9.6]]));
ok(r && r.why === "iz" && Math.abs(r.exit - 9.6) < 1e-9 && r.net > 0, "simExit: trailing 1×ATR locks profit");
r = X.simExit(10, 10.2, 0.5, m(Array.from({ length: 30 }, () => [10.05, 9.95, 10])));
ok(r === null, "simExit: unresolved before 60 bars");
r = X.simExit(10, 10.2, 0.5, m(Array.from({ length: 60 }, (_, i) => [10.05, 9.9, 9.95])));
ok(r && r.why === "60dk" && Math.abs(r.net - (0.005 - 0.001)) < 1e-9, "simExit: 60 min close");
// stats
const s = X.stats([{ res: { net: 0.01 } }, { res: { net: -0.005 } }, { res: { net: 0.002 } }, {}]);
ok(s.n === 3 && s.open === 1 && Math.abs(s.winRate - 2/3) < 1e-9 && Math.abs(s.avg - 0.007/3) < 1e-12, "stats: live win rate / avg / open");
ok(X.stats([]).winRate === null, "stats: empty");
{ const fs = require("fs"), src = fs.readFileSync(__dirname + "/../sert.js", "utf8"); ok(!/fapi\/v1\/order|batchOrders|X-MBX-APIKEY|signature|MEME\.|sapi\//.test(src), "signal only: no order endpoints, keys or MEME calls"); }
console.log(fails ? `${fails} FAIL` : "ALL PASS"); process.exit(fails ? 1 : 0);
