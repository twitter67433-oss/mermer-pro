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
// v7.29 TERSİ (LONG): mirrored stop, stop-first, trailing max(stop, high − atr), 60 bars, fee
r = X.simLong(10, 10.2, 0.1, m([[10.1, 9.75, 9.9]]));
ok(r && r.why === "stop" && Math.abs(r.exit - 9.8) < 1e-9 && Math.abs(r.net - (-0.02 - 0.001)) < 1e-9, "simLong: mirrored stop 9.8 hit → −2% −fee");
r = X.simLong(10, 10.2, 0.1, m([[10.5, 9.95, 10.4], [10.45, 10.35, 10.4]]));
ok(r && r.why === "iz" && Math.abs(r.exit - 10.4) < 1e-9 && r.net > 0, "simLong: trailing locks profit");
ok(X.simLong(10, 10.2, 0.5, m(Array.from({ length: 10 }, () => [10.05, 9.95, 10]))) === null, "simLong: unresolved before 60 bars");
r = X.simLong(10, 10.2, 0.5, m(Array.from({ length: 60 }, () => [10.1, 9.95, 10.05])));
ok(r && r.why === "60dk" && Math.abs(r.net - (0.005 - 0.001)) < 1e-9, "simLong: 60 min close");
{ const bb = m([[10.1, 9.5, 9.6], [9.7, 9.55, 9.6]]), a = X.simExit(10, 10.2, 0.1, bb), c = X.simLong(10, 10.2, 0.1, bb); ok(a.net > 0 && c.net < 0, "same bars: SHORT wins, TERSİ loses"); }
// DEFTER summary / CSV
const JJ = [{ sym: "SOLUSDT", t: Date.UTC(2026, 10, 19, 15, 0), entry: 75, stop: 76, res: { net: 0.01, why: "iz", exit: 74.2 }, rev: { net: -0.014, why: "stop", exit: 74 } },
  { sym: "EVAAUSDT", t: Date.UTC(2026, 10, 19, 15, 15), entry: 5, stop: 5.1, sq: 1, res: { net: -0.021, why: "stop", exit: 5.1 }, rev: { net: 0.004, why: "60dk", exit: 5.03 } },
  { sym: "DOGEUSDT", t: Date.UTC(2026, 10, 19, 15, 30), entry: 0.2, stop: 0.202 }];
const S1 = X.summary(JJ), V1 = X.summary(JJ, "rev");
ok(S1.toplam === 3 && S1.dogru === 1 && S1.yanlis === 1 && S1.acik === 1 && S1.kazanma === 0.5 && Math.abs(S1.net - (-0.011)) < 1e-12 && Math.abs(S1.ort - (-0.0055)) < 1e-12, "summary: toplam/doğru/yanlış/açık/kazanma/ort/toplam net");
ok(V1.dogru === 1 && V1.yanlis === 1 && Math.abs(V1.net - (-0.01)) < 1e-12, "summary TERSİ (LONG)");
ok(X.sonuc(JJ[0]) === "DOĞRU" && X.sonuc(JJ[1]) === "YANLIŞ" && X.sonuc(JJ[2]) === "AÇIK" && X.sonuc(JJ[1], "rev") === "DOĞRU", "sonuc: DOĞRU = net > 0");
{ const c = X.csv(JJ).split("\n"); ok(c.length === 4 && /tersi net %/.test(c[0]) && c[1].startsWith("2026-11-19 16:00;SOL;75;76;74;73;DOĞRU;trailing;74.2;1.000;;;;;74;76;77;YANLIŞ;stop;74;-1.400") && /;evet;/.test(c[2]) && /AÇIK/.test(c[3]), "CSV: Berlin time, fields, TERSİ columns"); }
// v7.29 Önerilen SL / TP1 / TP2 and which comes first
{ const L = X.levels(10, 10.2, -1), M = X.levels(10, 10.2, 1); ok(Math.abs(L.tp1 - 9.8) < 1e-9 && Math.abs(L.tp2 - 9.6) < 1e-9 && Math.abs(M.sl - 9.8) < 1e-9 && Math.abs(M.tp1 - 10.2) < 1e-9 && Math.abs(M.tp2 - 10.4) < 1e-9, "levels: TP1 = −1R, TP2 = −2R, LONG mirrored"); }
let t = X.tpTrack(-1, 10, 10.2, m([[10.1, 9.75, 9.8], [10.25, 9.9, 10.1]]));
ok(t && t.first === "TP1" && t.tp1 && !t.tp2, "tpTrack: TP1 then SL → first TP1");
t = X.tpTrack(-1, 10, 10.2, m([[10.1, 9.75, 9.8], [9.9, 9.55, 9.6]])); ok(t && t.first === "TP2" && t.tp2, "tpTrack: TP2");
t = X.tpTrack(-1, 10, 10.2, m([[10.21, 9.7, 9.8]])); ok(t && t.first === "SL" && !t.tp1, "tpTrack: same bar SL+TP1 → SL (conservative)");
ok(X.tpTrack(-1, 10, 10.2, m([[10.1, 9.9, 10]])) === null, "tpTrack: unresolved before 60 bars");
t = X.tpTrack(-1, 10, 10.2, m(Array.from({ length: 60 }, () => [10.1, 9.9, 10]))); ok(t && t.first === null && !t.tp1, "tpTrack: neither in 60 dk → iz/60dk from trailing");
t = X.tpTrack(1, 10, 10.2, m([[10.25, 9.9, 10.2]].concat(Array.from({ length: 59 }, () => [10.1, 9.95, 10])))); ok(t && t.first === "TP1", "tpTrack LONG mirror");
{ const JT = [{ sym: "A", t: 0, entry: 1, stop: 1.1, res: { net: 0.01, why: "iz" }, tp: { tp1: true, tp2: true, first: "TP2" }, tpr: { tp1: false, tp2: false, first: "SL" } },
    { sym: "B", t: 0, entry: 1, stop: 1.1, res: { net: -0.01, why: "60dk" }, tp: { tp1: false, tp2: false, first: null }, tpr: { tp1: true, tp2: false, first: "TP1" } }];
  const a = X.summary(JT), b2 = X.summary(JT, "rev"); ok(a.tp1 === 0.5 && a.tp2 === 0.5 && b2.tp1 === 0.5 && b2.tp2 === 0, "summary: TP1/TP2 hit rates, both sides");
  ok(X.ilk(JT[0]) === "TP2" && X.ilk(JT[1]) === "60dk" && X.ilk(JT[1], "rev") === "TP1", "ilk: TP first or exit reason");
  const c = X.csv(JT).split("\n"); ok(/;TP1;TP2;/.test(c[0]) && /tersi TP2 vurdu/.test(c[0]) && /;TP2;evet;evet;/.test(c[1]) && /;SL;hayır;hayır$/.test(c[1]), "CSV: SL/TP levels, ilk, hits, mirrored"); }
// v7.29 non-crypto contracts stay in the scanner; only a small tag
ok(X.kind({ symbol: "XAUUSDT", baseAsset: "XAU", underlyingType: "COMMODITY", underlyingSubType: ["TradFi"] }) === "ALTIN" && X.kind({ symbol: "PAXGUSDT", baseAsset: "PAXG", underlyingType: "COIN", underlyingSubType: ["RWA", "Crypto"] }) === "ALTIN"
  && X.kind({ symbol: "XAGUSDT", baseAsset: "XAG", underlyingType: "COMMODITY", underlyingSubType: ["TradFi"] }) === "EMTİA" && X.kind({ symbol: "TSLAUSDT", baseAsset: "TSLA", underlyingType: "EQUITY", underlyingSubType: ["TradFi"] }) === "HİSSE"
  && X.kind({ symbol: "SOLUSDT", baseAsset: "SOL", underlyingType: "COIN", underlyingSubType: ["Layer-1", "Crypto"] }) === "", "kind: ALTIN / EMTİA / HİSSE tags, crypto untagged");
ok(X.top([{ symbol: "XAUUSDT", quoteVolume: "9e9", closeTime: now }, { symbol: "TSLAUSDT", quoteVolume: "8e9", closeTime: now }], 50, now).length === 2, "top: gold/stock contracts are kept");
// v7.29 full universe scan
{ const ei = { symbols: [{ symbol: "BTCUSDT", contractType: "PERPETUAL", status: "TRADING" }, { symbol: "XAUUSDT", contractType: "PERPETUAL", status: "TRADING" }, { symbol: "TSLAUSDT", contractType: "TRADIFI_PERPETUAL", status: "TRADING" },
    { symbol: "BTCUSDT_261225", contractType: "CURRENT_QUARTER", status: "TRADING" }, { symbol: "OLDUSDT", contractType: "PERPETUAL", status: "SETTLING" }, { symbol: "ETHUSDC", contractType: "PERPETUAL", status: "TRADING" }] };
  const U = X.universe(ei); ok(JSON.stringify(U) === JSON.stringify(["BTCUSDT", "XAUUSDT", "TSLAUSDT", "ETHUSDC"]), "universe: every TRADING perpetual (crypto, gold, stocks), no quarterlies/settling");
  const O = X.order(U, ["TSLAUSDT", "NEWUSDT"], { BTCUSDT: 9, XAUUSDT: 20, ETHUSDC: 1 }); ok(JSON.stringify(O) === JSON.stringify(["TSLAUSDT", "NEWUSDT", "XAUUSDT", "BTCUSDT", "ETHUSDC"]), "order: priority first, then 24h volume, no duplicates"); }
{ const old = Array.from({ length: 110 }, (_, i) => ({ t: i*900000, c: i })), nb = [{ t: 109*900000, c: -1 }, { t: 110*900000, c: 110 }, { t: 111*900000, c: 111 }], M = X.merge(old, nb);
  ok(M.length === 110 && M[M.length - 1].t === 111*900000 && M[M.length - 3].c === -1 && M[0].t === 2*900000, "merge: incremental bars, newest wins, capped at 110"); }
{ const src = require("fs").readFileSync(__dirname + "/../sert.js", "utf8"), w = +(src.match(/work\(\), work\(\), work\(\), work\(\), work\(\)/) ? 5 : 0), gap = +(src.match(/await sleep\((\d+)\); \} \};/) || [])[1];
  const perSec = w*1000/(gap + 150), pass = 820/perSec, wFirst = 820*2/(pass/60); ok(w === 5 && pass < 300 && wFirst < 1400, `rate budget: ${perSec.toFixed(1)} req/s, full pass ≈ ${Math.round(pass)} s, first pass ≈ ${Math.round(wFirst)} weight/min (limit 2400)`); }
{ const fs = require("fs"), src = fs.readFileSync(__dirname + "/../sert.js", "utf8"); ok(!/fapi\/v1\/order|batchOrders|X-MBX-APIKEY|signature|MEME\.|sapi\//.test(src), "signal only: no order endpoints, keys or MEME calls"); }
console.log(fails ? `${fails} FAIL` : "ALL PASS"); process.exit(fails ? 1 : 0);
