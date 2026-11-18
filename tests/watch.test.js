// v7.20 İZLEME LİSTESİ (watch.js) + journal merge / wide-stop tests: node tests/watch.test.js
const SMT = require("../smart.js"), SCM = require("../scalp.js"), JRN = require("../journal.js"), WAT = require("../watch.js"); let f = 0;
const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i !== undefined ? "  · " + i : "")); if (!c) f++; };
const NOW = 1_790_000_000_000, fl = (t, ms) => Math.floor(t/ms)*ms;
// raw Binance klines for one interval ending with the live candle at NOW
function raw(tf, n, fn = i => 100 + Math.sin(i/7)*3 + i*0.02){ const ms = SCM.TF_MS[tf], end = fl(NOW, ms), out = [];
  for (let k = n - 1; k >= 0; k--){ const t = end - k*ms, i = n - 1 - k, c = fn(i), o = fn(i - 1); out.push([t, o, Math.max(o, c)*1.002, Math.min(o, c)*0.998, c, 1000 + (i % 7)*50, t + ms - 1, 0, 0, 600 + (i % 5)*20]); } return out; }
// pure helpers
{ const a = WAT.bars(raw("1m", 5)), fresh = WAT.bars(raw("1m", 3)).map(b => ({ ...b, c: b.c + 1 }));
  const m = WAT.merge(a, fresh); ok("merge: same open time replaced, no duplicates", m.length === 5 && m[4].c === fresh[2].c);
  const nxt = [{ ...a[4], t: a[4].t + 6e4, T: a[4].T + 6e4 }]; ok("merge: newer candle appended", WAT.merge(a, nxt).length === 6);
  ok("gap: hole between series and refresh detected", WAT.gap(a, [{ ...a[4], t: a[4].t + 5*6e4 }]) && !WAT.gap(a, nxt));
  ok("due: live candle open → not due; closed (+1.5 s) → due; never loaded → due", !WAT.due(a, a[4].T - 10) && WAT.due(a, a[4].T + 1600) && WAT.due(null, 0)); }
{ const K = { "1m": WAT.bars(raw("1m", 5)), "15m": WAT.bars(raw("15m", 5)) }, l15 = K["15m"][4], m1 = { ...K["1m"][4], h: l15.h + 5, l: l15.l - 5, c: 123 };
  WAT.patchLive(K, m1, l15.t + 1000); ok("patchLive: 1m price carried into the live 15dk candle (high/low/close)", l15.c === 123 && l15.h === m1.h && l15.l === m1.l); }
// engine on synthetic data: decision equals SMT.action/decision on the same items
{ const K = {}; for (const t of SCM.TF_SEL) K[t] = WAT.bars(raw(t, 499)); const items = {}; for (const t of SCM.TF_SEL) items[t] = WAT.item(K, t, { SMT, SCM });
  ok("item: every interval evaluated (state + direction)", SCM.TF_SEL.every(t => items[t] && typeof items[t].st === "string" && Number.isFinite(items[t].d)));
  const r = WAT.evalCoin(K, "15m", items, null, { SMT }), C = SMT.consensus(items);
  ok("evalCoin: uses the same GENEL YÖN consensus + one decision word", r && r.C.score === C.score && ["GİR LONG", "GİR SHORT", "BEKLE"].includes(r.dec.word), r && r.dec.word);
  ok("evalCoin: trend GİR is gated (no proven replay → BEKLE 'kapı')", r.A.kind !== "trend"); }
// scheduler with a fake Binance
function fake(){ const calls = []; let mode = "ok"; const fj = async p => { const u = new URL("https://x" + p), s = u.searchParams.get("symbol"), t = u.searchParams.get("interval"), lim = +u.searchParams.get("limit"); calls.push({ s, t, lim });
    if (mode === "429") throw new Error("Binance vadeli HTTP 429 (istek limiti)"); return raw(t, lim); }; return { fj, calls, set: m => mode = m }; }
(async () => {
  { const F = fake(), adds = []; let tn = NOW + 1000; const E = WAT.create({ SMT, SCM, JRN, fj: F.fj, now: () => tn, cb: { add: o => adds.push(o) } });
    E.config({ list: Array.from({ length: 20 }, (_, i) => "C" + i + "USDT"), tfs: ["15m", "1h"] }); ok("cap: watchlist limited to " + WAT.MAXC + " coins", E.W.list.length === WAT.MAXC);
    E.config({ list: ["AUSDT", "BUSDT"] }); ok("config: removed coins are dropped from the engine", E.W.coins.size === 2);
    for (let k = 0; k < 24; k++) await E.step(); const full = F.calls.filter(c => c.lim === 499);
    ok("first load: 12 intervals × 2 coins, 499 candles each (weight 2), coins interleaved", full.length === 24 && F.calls[0].s !== F.calls[1].s && E.status().ready === 2, F.calls.length);
    ok("one request per step (serialised, ≥350 ms apart via the timer)", F.calls.length === 24 && WAT.GAP >= 350);
    const before = F.calls.length; await E.step(); ok("nothing due while candles are open → no request", F.calls.length === before);
    tn = fl(NOW, 6e4) + 6e4 + 1600; await E.step(); await E.step(); const r = F.calls.slice(before);
    ok("after the 1m close: only 3-candle refreshes (weight 1)", r.length === 2 && r.every(c => c.lim === 3 && c.t === "1m"), JSON.stringify(r));
    ok("decisions computed for every watched coin × picked interval", ["AUSDT@15m", "AUSDT@1h", "BUSDT@15m", "BUSDT@1h"].every(k => E.W.last[k]));
    ok("records only through cb.add with valid sides (paper)", adds.every(a => JRN.make(a)));
    F.set("429"); tn += 6e4; await E.step(); ok("HTTP 429 → whole engine pauses 60 s", E.status().paused && E.W.pauseTo - tn === 60000);
    const n0 = F.calls.length; await E.step(); ok("paused → no requests", F.calls.length === n0); }
  { const F = fake(); let tn = NOW + 1000; const E = WAT.create({ SMT, SCM, JRN, fj: F.fj, now: () => tn, cb: { add: () => {} } }); E.config({ list: ["AUSDT"], tfs: ["15m"], skip: (s, t) => t === "15m" });
    for (let k = 0; k < 13; k++) await E.step(); ok("skip: the coin+interval already shown on screen is not double-evaluated", !E.W.last["AUSDT@15m"]); }
  { const F = fake(), adds = []; let tn = NOW + 1000; const E = WAT.create({ SMT, SCM, JRN, fj: F.fj, now: () => tn, cb: { add: o => adds.push(o) } }); E.config({ list: ["AUSDT"], tfs: ["15m"] });
    for (let k = 0; k < 12; k++) await E.step(); const c = E.coin("AUSDT"), live = c.K["15m"][c.K["15m"].length - 1]; const inj = () => { c.trig["15m"] = { candle: live.t, trig: [{ d: 1, k: "kırılım", lv: 1 }], atr: 1 }; };
    tn = live.T + 1600; for (let k = 0; k < 12 && !adds.some(a => a.type === "tetik"); k++){ inj(); await E.step(); } const tg = adds.find(a => a.type === "tetik");
    ok("BEKLE trigger fires on the candle close of a watched coin → 'tetik' record", tg && tg.sym === "AUSDT" && tg.tf === "15m" && tg.d === 1 && tg.stop < tg.entry && tg.tp > tg.entry); }
  // journal: merge + wide stop + per coin
  { const T0 = NOW, mk = (o) => JRN.make({ sym: "BTCUSDT", tf: "15m", d: 1, entry: 100, stop: 99, tp: 102, t: T0, ...o });
    const a = JRN.close(mk({ tf: "15m" }), "TP", 102, T0), b = JRN.close(mk({ tf: "1h", t: T0 + 20000 }), "SL", 99, T0), c = JRN.close(mk({ tf: "4h", t: T0 + 30000 }), "TP", 102, T0), d = JRN.close(mk({ sym: "ETHUSDT" }), "SL", 99, T0);
    const s1 = JRN.stats([a, b, c, d]), s2 = JRN.stats([a, b, c, d], {}, { merge: true });
    ok("merge off: 4 records counted", s1.n === 4 && s1.ok === 2);
    ok("merge on: BTC LONG ×3 in the same minute → 1 unit (majority DOĞRU, mean net)", s2.n === 2 && s2.merged === 2 && s2.ok === 1 && Math.abs(s2.net - ((1.9 - 1.1 + 1.9)/3 - 1.1)) < 1e-9, s2.net);
    ok("merge on: per-interval table still counts each record", s2.byTf["15m"].n === 2 && s2.byTf["1h"].n === 1);
    ok("per-coin breakdown", s2.byCoin.BTCUSDT.n === 1 && s2.byCoin.ETHUSDT.n === 1 && s1.byCoin.BTCUSDT.n === 3);
    const o1 = mk({ t: T0 + 60000 }), s3 = JRN.stats([a, o1, b], {}, { merge: true }); ok("merge: other minute or open trade stays separate / open", s3.n === 2 && s3.open === 1);
    const L = Array.from({ length: 6 }, (_, i) => mk({ sym: "S" + i, stop: 99 })); // median 1 %
    ok("geniş stop: > 3× median distance flagged", JRN.wideStop(L, mk({ stop: 96.5 })) && !JRN.wideStop(L, mk({ stop: 98 })));
    ok("geniş stop: > 5 % always flagged, < 5 samples only the 5 % rule", JRN.wideStop([], mk({ stop: 94 })) && !JRN.wideStop([], mk({ stop: 96.5 }))); }
  { const src = require("fs").readFileSync(__dirname + "/../watch.js", "utf8").replace(/\/\*[\s\S]*?\*\//g, ""); ok("paper only: watch.js has no order / key / wallet / signing code and only reads klines", !/order|apiKey|secret|wallet|EXEC|signature|POST|\/fapi\/v1\/(?!klines)/i.test(src)); }
  console.log(f ? f + " FAIL" : "ALL PASS"); process.exit(f ? 1 : 0); })();
