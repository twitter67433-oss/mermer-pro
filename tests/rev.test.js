// v7.24 DÖNÜŞ UYARISI (reversal detector) + SCALP (anlık) mode: node tests/rev.test.js
const fs = require("fs"), path = require("path"), SMT = require("../smart.js"), SCM = require("../scalp.js"), SCX = require("../scalpmode.js"), JRN = require("../journal.js"), WAT = require("../watch.js"); let f = 0;
const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i !== undefined ? "  · " + i : "")); if (!c) f++; };
const mk = (fn, n = 300, ms = 6e4) => { const out = []; for (let i = 0; i < n; i++){ const c = fn(i), o = fn(i - 1); out.push({ t: i*ms, o, h: Math.max(o, c)*1.001, l: Math.min(o, c)*0.999, c, v: 100 + (i % 5)*10, tb: 50 + (i % 3)*5, T: i*ms + ms - 1, x: true }); } return out; };
// structure break
{ const b = mk(i => i < 150 ? 100 + i*0.1 + Math.sin(i/3)*0.8 : 115 - (i - 150)*0.3 + Math.sin(i/3)*0.8), B = SMT.bosOf(b);
  ok("bosOf: uptrend → +1, after the dump breaks the last swing low → −1", B[140] === 1 && B[299] === -1, B[140] + "/" + B[299]);
  const B2 = SMT.bosOf(b.slice(0, 200)); ok("bosOf: no lookahead (same values when the future is cut off)", B2.every((x, i) => x === B[i])); }
// detector + cap
const big = { "1h": { d: 0.75 }, "2h": { d: 1 }, "4h": { d: 1 }, "6h": { d: 1 }, "8h": { d: 1 }, "12h": { d: 1 }, "1d": { d: 1 } };
{ const I = { ...big, "1m": { d: -1 }, "3m": { d: -1 }, "5m": { d: -1, bos: -1 }, "15m": { d: -1, bos: -1 }, "30m": { d: -0.5, bos: 0 } };
  const old = SMT.consensus(I, { rev: false }), C = SMT.consensus(I);
  ok("old engine: big picture dominates → LONG while 5dk–30dk are down (the complaint)", old.dir === 1, old.label);
  ok("new: DÖNÜŞ UYARISI fires (bearish turn against the up big picture)", C.rev && C.rev.d === -1, C.rev && C.rev.rv.toFixed(2));
  ok("new: label capped — never LONG / GÜÇLÜ LONG during a confirmed bearish turn", C.dir !== 1 && !/LONG/.test(C.label) && !C.strong, C.label);
  const A = SMT.action(C, { main: {}, px: 100, atr: 1 }), d = SMT.decision(C, A, { px: 100, atr: 1, ema21: 99, hi: 101, lo: 99, revWhy: SMT.revWhy(C.rev, SCM.TF_LBL) });
  ok("decision: no LONG trigger while the bearish turn is active", d.trig.every(t => t.d < 0) && d.trig.length >= 1, d.line);
  ok("decision: carries the DÖNÜŞ UYARISI reason", d.rev && d.rev.d === -1 && /döndü/.test(d.rev.why), d.rev && d.rev.why);
  const a2 = SMT.action(C, { main: { state: "LONG", d: 1, plan: { entry: 100, stop: 99, tp: 101.5 } }, px: 100, atr: 1 });
  ok("A+ LONG setup is not GİR during a confirmed bearish turn (stricter, never looser)", a2.act !== "GİR LONG", a2.act); }
{ const I = { ...big, "5m": { d: -1, bos: 0 }, "15m": { d: 1, bos: 1 }, "30m": { d: 1 } }; const C = SMT.consensus(I);
  ok("no turn without short-term confirmation → old behaviour kept", !C.rev && C.dir === 1); }
{ const I = { "1h": { d: -0.75 }, "2h": { d: -1 }, "4h": { d: -1 }, "6h": { d: -1 }, "8h": { d: -1 }, "12h": { d: -1 }, "1d": { d: -1 }, "5m": { d: 1, bos: 1 }, "15m": { d: 1, bos: 1 }, "30m": { d: 0.5 } };
  const C = SMT.consensus(I); ok("symmetric: bullish turn in a down big picture → never AŞAĞI/SHORT", C.rev && C.rev.d === 1 && C.dir !== -1, C.label); }
// SCALP (anlık)
const b1 = mk(i => 100 + Math.sin(i/6)*1.5 + Math.sin(i/2.3)*0.6, 600);
{ const V = SCX.view(b1, {}); ok("SCALP view: lean, strength, plan sized by ATR", V && [-1, 0, 1].includes(V.d) && V.atr > 0 && (!V.d || Math.abs(Math.abs(V.plan.tp - V.plan.entry) - 1.5*Math.abs(V.plan.stop - V.plan.entry)) < 1e-9));
  ok("SCALP: no replay gate → never GİR", V.go === false);
  const r = SCX.toDecision(SMT, V, { hi: 102, lo: 98 }); ok("SCALP decision: BEKLE + anlık yön (ANLIK …)", r.dec.word === "BEKLE" && /ANLIK/.test(r.dec.dirW) && r.C.scalp, r.dec.yon); }
{ const R = SCX.sReplay(b1, {}), R2 = SCX.sReplay(b1.slice(0, 450), {}), early = R2.tr.filter(t => t.k < 440);
  ok("sReplay: no lookahead (trades closed before the cut are identical)", early.every(t => R.tr.find(u => u.t === t.t && Math.abs(u.pnl - t.pnl) < 1e-9)), early.length + " trades");
  ok("sReplay: 0.10 % fee in every trade", R.tr.every(t => t.r !== "TP" || t.pnl < 1.5*Math.abs(t.pnl + 0.1)) && SCX.CFG.fee === 0.10);
  ok("sGate: needs ≥20 trades, ≥45 % winners, positive average", !SCX.sGate({ T: { n: 19, win: 0.9, avg: 1 } }) && !SCX.sGate({ T: { n: 30, win: 0.6, avg: -0.01 } }) && SCX.sGate({ T: { n: 30, win: 0.5, avg: 0.02 } }));
  const V = SCX.view(b1, { gate: { T: { n: 30, win: 0.6, avg: 0.05 }, acc: 0.53 } }); ok("SCALP GİR only with gate + strength + fee check", V.go === (V.d !== 0 && V.strong && V.feeOk && !V.bookVeto)); }
{ const V = SCX.view(b1, { gate: { T: { n: 30, win: 0.6, avg: 0.05 } }, fee: 5 }); ok("SCALP: expected move below fees → BEKLE", !V.go && !V.feeOk); }
// journal records the mode
{ const t = JRN.make({ sym: "BTCUSDT", tf: "1m", d: 1, entry: 100, stop: 99, tp: 101.5, sm: "scalp", t: 1e12 }), u = JRN.make({ sym: "BTCUSDT", tf: "1m", d: 1, entry: 100, stop: 99, tp: 101.5, t: 1e12 });
  ok("SANAL TAKİP: mode recorded (scalp / trend) + CSV column", t.sm === "scalp" && u.sm === "trend" && /mod/.test(JRN.csv([t])) && /SCALP/.test(JRN.csv([t])));
  ok("SANAL TAKİP: scalp trade times out sooner (6 candles)", t.exp - t.t === 6*6e4 && u.exp - u.t > t.exp - t.t); }
// watch engine in SCALP mode
{ const K = { "5m": b1 }; const r = WAT.evalCoin(K, "5m", {}, null, { SMT, SCX, sm: "scalp", sR: null, tfMs: 3e5 }); ok("watch/badges: SCALP branch → same SCALP decision, BEKLE without gate", r && r.dec.word === "BEKLE" && r.C.scalp); }
// safety
{ const s = fs.readFileSync(path.join(__dirname, "../scalpmode.js"), "utf8"); ok("scalpmode.js: signal only — no order endpoints, keys, signing or wallet", !/\/fapi\/v1\/order|signature|apiKey|X-MBX-APIKEY|secret|WALLET|sendTransaction|fetch\(/i.test(s)); }
console.log(f ? f + " FAIL" : "ALL PASS"); process.exit(f ? 1 : 0);
