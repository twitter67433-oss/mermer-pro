/* v8.1 AKSİYON state machine: GİR / BEKLE / ÇIK / KÂR AL — guidance only, no orders */
const assert = require("assert"), fs = require("fs"), path = require("path"), D = path.join(__dirname, "..");
const A = require("../aksiyon.js"), X = require("../sert.js"); let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const t0 = 1_800_000_000_000, M = 60000;
const short = (o = {}) => Object.assign({ k: "sert", side: -1, entry: 100, stop: 101, close: t0, t: t0 - 900000, sym: "BTCUSDT" }, o);
const long = (o = {}) => Object.assign({ k: "lng", side: 1, entry: 100, stop: 99, close: t0, t: t0 - 900000, sym: "ETHUSDT" }, o);
const V = (sig, px, now, opt) => A.verdict(sig, px, now, opt);

// levels match DEFTER
{ const L = A.levels(100, 101, -1), S = X.levels(100, 101, -1);
  ok(L.R === 1 && L.tp1 === 99 && L.tp2 === 98 && L.sl === 101, "SHORT 1R / TP1 / TP2");
  ok(L.tp1 === S.tp1 && L.tp2 === S.tp2 && L.sl === S.sl, "matches SERTX.levels");
  const G = A.levels(100, 99, 1); ok(G.tp1 === 101 && G.tp2 === 102 && G.sl === 99, "LONG mirror"); }

// GİR: in zone, stop not hit
ok(V(short(), 100, t0 + M).st === "GIR" && V(short(), 100, t0 + M).label === "GİR", "at entry → GİR");
ok(V(short(), 100.2, t0 + M).st === "GIR", "slightly against (toward stop) still GİR");
ok(V(short(), 99.7, t0 + M).st === "GIR", "0.3R in favor is still GİR (≤ zone)");
ok(V(short(), 99.6, t0 + M).st === "BEKLE" && V(short(), 99.6, t0 + M).sub === "GEÇ KALDIN", "just past 0.3R → BEKLE GEÇ KALDIN");
ok(V(long(), 100.3, t0 + M).st === "GIR" && V(long(), 100.31, t0 + M).why === "GEC", "LONG zone same in R");

// ÇIK STOP (inclusive, gap-fill = already past the level counts)
ok(V(short(), 101, t0 + M).st === "CIK" && V(short(), 101, t0 + M).sub === "STOP", "SHORT at stop → ÇIK STOP");
ok(V(short(), 101.5, t0 + M).why === "STOP", "SHORT gapped through stop → still STOP (not filled at 101 for the state, but HIT)");
ok(V(long(), 99, t0 + M).why === "STOP" && V(long(), 98.5, t0 + M).why === "STOP", "LONG stop / gap");

// stop-first: same tick hits stop and TP (shouldn't happen on a 1R stop vs 1R TP, but with a wide wick / bad numbers)
ok(V(short({ stop: 99 }), 99, t0 + M).why === "STOP", "stop and a target same tick → STOP (DEFTER conservative)");

// TP2 / TP1
ok(V(short(), 98, t0 + M).st === "CIK" && V(short(), 98, t0 + M).sub === "HEDEF2", "SHORT at TP2 → ÇIK HEDEF2");
ok(V(short(), 97, t0 + M).why === "HEDEF2", "SHORT past TP2 (gap-fill)");
ok(V(short(), 99, t0 + M).st === "KAR" && V(short(), 99, t0 + M).label === "KÂR AL" && V(short(), 99, t0 + M).sub === "STOP GİRİŞE", "SHORT at TP1 → KÂR AL / STOP GİRİŞE");
ok(V(long(), 102, t0 + M).why === "HEDEF2" && V(long(), 101, t0 + M).st === "KAR", "LONG TP2 / TP1");

// time cap 60 min, same as sim / PSIM.SERT.tmax
ok(V(short(), 100, t0 + 60*M).why === "SURE" && V(short(), 100, t0 + 60*M).sub === "SÜRE DOLDU", "exactly 60 min → ÇIK SÜRE DOLDU");
ok(V(short(), 100, t0 + 60*M - 1).st === "GIR", "59:59 still GİR");
ok(A.DEF.tmax === 60*60000, "default cap = 60 min");

// opposite / squeeze
ok(V(short(), 100, t0 + M, { opposite: true }).sub === "TERS SİNYAL", "opposite strong signal → ÇIK TERS SİNYAL");
ok(V(short(), 100, t0 + M, { squeeze: true }).st === "BEKLE" && V(short(), 100, t0 + M, { squeeze: true }).sub === "SQUEEZE", "SHORT + squeeze → BEKLE");
ok(V(long(), 100, t0 + M, { squeeze: true }).st === "GIR", "LONG + squeeze does not block (squeeze is short-side risk)");

// no price
ok(V(short(), NaN, t0 + M).st === "BEKLE" && V(short(), NaN, t0 + M).sub === "FİYAT YOK", "no live price → BEKLE");

// latch: once ÇIK, stays ÇIK even if price comes back
ok(V(short(), 100, t0 + M, { latch: { st: "CIK", why: "STOP", sub: "STOP" } }).why === "STOP", "latched STOP is not downgraded");

// stillOn: 60 min for live, 8 min linger after ÇIK
ok(A.stillOn(short(), t0 + 59*M, V(short(), 100, t0 + 59*M)), "visible inside 60 min");
ok(!A.stillOn(short(), t0 + 61*M, { st: "GIR" }), "GİR hidden after 60 min (the ÇIK SÜRE row uses linger)");
{ const r = short(), v = V(r, 101, t0 + 10*M); r._cikAt = t0 + 10*M;
  ok(A.stillOn(r, t0 + 10*M + 7*M, v), "ÇIK lingers 8 min"); ok(!A.stillOn(r, t0 + 10*M + 9*M, v), "ÇIK gone after linger"); }

// configurable
ok(V(short(), 99.8, t0 + M, { cfg: { zone: 0.1 } }).why === "GEC" && V(short(), 99.8, t0 + M, { cfg: { zone: 0.5 } }).st === "GIR", "zone is configurable");
ok(V(short(), 100, t0 + 10*M, { cfg: { tmax: 5*M } }).why === "SURE", "tmax configurable");
ok(A.cfgOf({ zone: -1, tmax: "x" }).zone === 0.3 && A.cfgOf({ tmax: "x" }).tmax === 60*M, "bad cfg → defaults");

// HAREKET
{ const ev = { sym: "MMTUSDT", dir: 1, ch: 0.10, w: "1s", t: t0, px: 110 }; /* started at 100, now 110 */
  ok(A.moveVerdict(ev, 110, t0 + M).st === "GIR", "1s pump still at trigger px → GİR");
  ok(A.moveVerdict(ev, 104, t0 + M).why === "GEC", "gave back >50% of the +10% → BEKLE");
  ok(A.moveVerdict(ev, 100, t0 + M).why === "DONDU" && A.moveVerdict(ev, 99, t0 + M).sub === "DÖNDÜ", "back through origin → ÇIK DÖNDÜ");
  ok(A.moveVerdict(ev, 110, t0 + 60*M).why === "SURE", "1s cap 60 min");
  ok(A.moveVerdict(ev, 110, t0 + M, { squeeze: true }).sub === "SQUEEZE", "pump + squeeze → BEKLE");
  const d = { sym: "X", dir: 1, ch: 0.20, w: "24s", t: t0, px: 120 };
  ok(A.moveVerdict(d, 120, t0 + 5*M).st === "GIR", "fresh 24s alert still holding → GİR");
  ok(A.moveVerdict(d, 120, t0 + 31*M).sub === "KOVALAMA", "24s after 30 min → BEKLE KOVALAMA"); }

// badge HTML + no inline handlers
{ const h = A.badge(V(short(), 100, t0 + M)); ok(/ax-gir/.test(h) && /GİR/.test(h) && !h.includes("on"), "GİR badge");
  ok(/ax-cik/.test(A.badge(V(short(), 101, t0 + M))) && /STOP/.test(A.badge(V(short(), 101, t0 + M))), "ÇIK STOP badge");
  ok(/KÂR AL/.test(A.badge(V(short(), 99, t0 + M))), "KÂR AL badge"); }

// signal only
{ const src = fs.readFileSync(path.join(D, "aksiyon.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  ok(!/fapi\/v1\/(order|batchOrders|leverage|algoOrder)|X-MBX-APIKEY|signature|sendTransaction|signAndSend|WALLET|EXEC|PUMP\.|MEME\.|AUTO|TRADE|BKEYS|apiKey/i.test(src), "AKSIYON: no orders/keys/auto-buy");
  ok(/ticker\/price/.test(src), "public price read only"); }

// wiring
{ const html = fs.readFileSync(path.join(D, "index.html"), "utf8"), sert = fs.readFileSync(path.join(D, "sert.js"), "utf8"), hv = fs.readFileSync(path.join(D, "hareket.js"), "utf8");
  ok(html.indexOf("hareket.js") < html.indexOf("aksiyon.js"), "aksiyon.js after hareket.js (paint-time only)");
  ok(/AKSIYON\.badge/.test(sert) && /holdOf/.test(sert) && /HOLD\.get/.test(sert) && /yönlendirme, kanıtlanmadı/.test(sert), "lists + detail + hint wired");
  ok(/AKSIYON\.ofMove/.test(hv) && /AKSIYON\.badge/.test(hv) && /px: f\.x\.c/.test(hv), "HAREKET rows wired + store trigger px");
  ok(/rowsOf\(k\)\{ const sy = new Set/.test(sert), "rowsOf includes HOLD so a signal stays for 60 min"); }

console.log("aksiyon.test OK", n, "checks");
