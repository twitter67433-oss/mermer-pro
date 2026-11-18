// v7.22 SİNYAL ROZETİ (badge.js) tests: node tests/badge.test.js
const fs = require("fs"), path = require("path"), SMT = require("../smart.js"), SCM = require("../scalp.js"), WAT = require("../watch.js"), X = require("../badge.js"); let f = 0;
const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i !== undefined ? "  · " + i : "")); if (!c) f++; };
const NOW = 1_790_000_000_000, MS = { "5m": 3e5, "15m": 9e5, "1h": 36e5 };
// GeckoTerminal style ohlcv_list: [sec, o, h, l, c, v], newest first
function gt(tf, n, fn = i => 1e-4*(1 + Math.sin(i/9)*0.05 + i*0.001)){ const ms = MS[tf], end = Math.floor(NOW/ms)*ms, out = [];
  for (let k = 0; k < n; k++){ const i = n - 1 - k, t = end - k*ms, c = fn(i), o = fn(i - 1); out.push([t/1000, o, Math.max(o, c)*1.01, Math.min(o, c)*0.99, c, 500 + (i % 7)*40]); } return out; }
{ const b = X.dexBars(gt("15m", 5), "15m", NOW); ok("dexBars: oldest first, ms times, close time, last candle live", b.length === 5 && b[0].t < b[4].t && b[4].T === b[4].t + 9e5 - 1 && b[4].x === false && b[3].x === true);
  ok("dexBars: unknown taker-buy volume → neutral half", b[2].tb === b[2].v/2); }
{ const K = {}; for (const t of X.DEX_TF) K[t] = X.dexBars(gt(t, 300), t, NOW); const r = X.dexEval(K, "15m", { SMT, SCM, WAT });
  ok("dexEval: one of the engine words, marked dex", ["GİR LONG", "GİR SHORT", "BEKLE"].includes(r.word) && r.src === "dex", r.word + " · n=" + r.n);
  const items = {}; for (const t of Object.keys(K)) items[t] = WAT.item(K, t, { SMT, SCM }); const C = SMT.consensus(items);
  ok("dexEval: confidence halved vs. the same consensus (DEX = lower confidence)", r.conf === Math.round(C.strength/2) && r.d === C.dir, r.conf + " vs " + C.strength);
  ok("dexEval: no proven replay → trend GİR gated (same A+ gate)", !(r.word.startsWith("GİR") && WAT.evalCoin(K, "15m", items, null, { SMT }).A.kind === "trend")); }
{ const K = { "5m": X.dexBars(gt("5m", 20), "5m", NOW) }; const r = X.dexEval(K, "5m", { SMT, SCM, WAT }); ok("dexEval: too few candles → 'veri yok' (never invented)", r.none && r.word === "veri yok");
  ok("dexEval: nothing → 'veri yok'", X.dexEval({}, "15m", { SMT, SCM, WAT }).none); }
{ const L = X.label; ok("label: GİR LONG / GİR SHORT", L({ word: "GİR LONG" }).txt === "GİR LONG" && L({ word: "GİR SHORT" }).cls === "dn");
  ok("label: BEKLE shows the leaning, never GİR", L({ word: "BEKLE", d: 1 }).txt === "BEKLE · eğilim L" && L({ word: "BEKLE", d: -1 }).txt === "BEKLE · eğilim S" && L({ word: "BEKLE", d: 0 }).txt === "BEKLE · yatay");
  ok("label: none / error / pending", L({ none: true }).txt === "veri yok" && L({ err: "x" }).txt === "hata" && L(null).txt === "⋯"); }
{ const S = { sym: "BTCUSDT", tf: "15m", dec: { word: "BEKLE", trig: [] }, G: { dir: -1, strength: 40 }, I: Object.fromEntries(SCM.TF_SEL.map(t => [t, {}])) };
  ok("fromScalp: same coin+interval → exactly the SİNYAL decision", X.fromScalp(S, "BTCUSDT", "15m").word === "BEKLE" && X.fromScalp(S, "BTCUSDT", "15m").d === -1);
  ok("fromScalp: other coin / interval / incomplete → not reused", !X.fromScalp(S, "ETHUSDT", "15m") && !X.fromScalp(S, "BTCUSDT", "1h") && !X.fromScalp({ ...S, I: { "1m": {} } }, "BTCUSDT", "15m"));
  ok("fromLast: stale watch result ignored", !X.fromLast({ word: "GİR LONG", at: NOW - 400000 }, 180000, NOW) && X.fromLast({ word: "GİR LONG", at: NOW - 1000 }, 180000, NOW).word === "GİR LONG"); }
// display only: no order / wallet / key code in badge.js; trading modules never read the badges
{ const src = fs.readFileSync(path.join(__dirname, "../badge.js"), "utf8");
  ok("badge.js: no order endpoints, signing, swaps, keys or wallet", !/\/fapi\/v1\/order|\/api\/v3\/order|signature|sendTransaction|secretKey|apiKey|X-MBX-APIKEY|jupiter|swap|WALLET\.|MEME\.(buy|sell|arm)|EXEC|AUTO\./i.test(src));
  ok("badge.js: watch engine created with auto:false, trig:false", /auto: false, trig: false/.test(src));
  for (const m of ["auto.js", "exec.js", "agentcore.js", "agents.js", "score.js", "copy.js", "remote.js", "trade.js"]){ const s = fs.readFileSync(path.join(__dirname, "..", m), "utf8"); ok(m + ": does not read signal badges", !/SGB/.test(s)); }
  for (const m of ["meme.js", "pump.js", "bot.js", "coinan.js", "app.js"]){ const s = fs.readFileSync(path.join(__dirname, "..", m), "utf8"), uses = s.match(/SGB\.\w+/g) || []; ok(m + ": badges only rendered (SGB.tag in markup)", uses.length && uses.every(u => u === "SGB.tag"), uses.join(",")); }
  const ai = fs.readFileSync(path.join(__dirname, "../ai.js"), "utf8"); ok("ai.js: badges only as read-only context (snapshot)", (ai.match(/SGB\.\w+/g) || []).every(u => u === "SGB.snapshot")); }
console.log(f ? f + " FAIL" : "ALL PASS"); process.exit(f ? 1 : 0);
