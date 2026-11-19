/* v7.50 FAZ 3 — SİNYAL 8 (deneysel) + H cost model: costs, data quality, look-ahead, MTF lowers (never rejects), low ADX → range, grades, hard blocks, outcome accounting, frequency, signal-only */
const assert = require("assert"), fs = require("fs"), path = require("path"), G = require("../sig8.js"), D = path.join(__dirname, "..");
let seed = 7; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;
const T0 = Date.parse("2026-01-01T00:00:00Z"), M15 = 9e5;
function series(n, drift = 0, vol = 0.004, start = 100, f){ const b = []; let p = start; for (let i = 0; i < n; i++){ const o = p, mv = (f ? f(i) : drift) + (rnd() - 0.5)*2*vol; p = Math.max(0.01, o*(1 + mv));
    const h = Math.max(o, p)*(1 + rnd()*vol*0.6), l = Math.min(o, p)*(1 - rnd()*vol*0.6), v = 100 + rnd()*50; b.push({ t: T0 + i*M15, T: T0 + (i + 1)*M15 - 1, o, h, l, c: p, v, tb: v*(0.4 + rnd()*0.2), x: true }); } return b; }
const agg = (b, k) => { const o = []; for (let i = 0; i + k <= b.length; i += k){ const s = b.slice(i, i + k); o.push({ t: s[0].t, T: s[k - 1].T, o: s[0].o, h: Math.max(...s.map(x => x.h)), l: Math.min(...s.map(x => x.l)), c: s[k - 1].c, v: s.reduce((q, x) => q + x.v, 0), tb: s.reduce((q, x) => q + x.tb, 0), x: true }); } return o; };
// ---- H: cost model ----
{ const C = G.COST; assert.ok(Math.abs(G.costPct({}) - (C.taker*2 + C.spread + C.slip*2)) < 1e-12, "taker both legs + spread + slippage both legs");
  assert.ok(Math.abs(G.costPct({ stop: true }) - G.costPct({}) - C.slip*(C.stopSlipX - 1)) < 1e-12, "stop exit pays extra slippage");
  assert.ok(Math.abs(G.costPct({ holdMs: 288e5 }) - G.costPct({}) - C.fund8h) < 1e-12, "funding per 8 h");
  const mk = Object.assign({}, C, { entry: "maker" }); assert.ok(G.costPct({}, mk) < G.costPct({}), "maker entry cheaper"); }
// ---- data quality ----
{ const b = series(400); assert.ok(G.dq(b, M15).ok && G.dq(b, M15).s === 100);
  const bn = b.map(x => Object.assign({}, x)); bn[390].c = NaN; assert.ok(!G.dq(bn, M15).ok, "NaN → blocked");
  const bg = b.filter((_, i) => i < 380 || i > 384); assert.ok(G.dq(bg, M15).s < 100 && G.dq(bg, M15).why.some(w => /eksik/.test(w)), "missing candles detected");
  assert.ok(!G.dq(b, M15, b[399].T + 3*36e5).ok, "stale data blocked"); assert.ok(!G.dq(b.slice(0, 100), M15).ok, "too short");
  const F = G.prep(bn), r = G.evalAt(F, F.n - 1, G.DEF, { dq: G.dq(bn, M15) }); assert.ok(r.hard && !r.cands.length, "bad data → hard block, no candidates"); }
// ---- look-ahead: result at bar i identical with or without future bars (incl. higher intervals) ----
{ const b = series(900, 0.0004), h1 = agg(b, 4), h2 = agg(b, 16); let tested = 0;
  for (let i = 400; i < 860; i += 7){ const A = G.evalAt(G.prep(b, { h1, h2 }), i, Object.assign({}, G.DEF, { minShow: "weak" }));
    const cut = b.slice(0, i + 1), Bv = G.evalAt(G.prep(cut, { h1: h1.filter(x => x.T <= b[i].T), h2: h2.filter(x => x.T <= b[i].T) }), i, Object.assign({}, G.DEF, { minShow: "weak" }));
    assert.strictEqual(A.regime.k, Bv.regime.k); const s = r => r.cands.concat(r.rejected).map(c => c.strat + c.d + ":" + c.score).sort().join(); assert.strictEqual(s(A), s(Bv), "look-ahead at " + i); tested += A.cands.length + A.rejected.length; }
  assert.ok(tested > 0, "some candidates were compared"); }
// ---- MTF disagreement lowers confidence, never rejects ----
{ const b = series(700, 0.0012, 0.003), F = G.prep(b); let found = 0;
  for (let i = 300; i < 690 && found < 5; i++){ const R = G.regime(F, i); for (const P of G.triggers(F, i)){ const with_ = G.judge(F, i, Object.assign({}, P), R, G.DEF, null), F2 = Object.assign({}, F, { H1: { T: [0], d: [-P.d] }, H2: { T: [0], d: [-P.d] } }),
      against = G.judge(F2, i, Object.assign({}, P), R, G.DEF, null), F3 = Object.assign({}, F, { H1: { T: [0], d: [P.d] }, H2: { T: [0], d: [P.d] } }), agree = G.judge(F3, i, Object.assign({}, P), R, G.DEF, null);
      assert.ok(agree.score > against.score, "MTF agreement > disagreement"); assert.strictEqual(against.blocked, false, "MTF conflict is never a hard block"); assert.ok(against.warn.some(w => /üst zaman/.test(w))); found++; } }
  assert.ok(found > 0, "trend series produced candidates"); }
// ---- regimes: strong trend, low ADX → RANGE with range-strategy candidates; reversal penalised in a strong trend ----
{ const up = series(600, 0.002, 0.002), F = G.prep(up); const ks = new Set(); for (let i = 300; i < 600; i++) ks.add(G.regime(F, i).k); assert.ok(ks.has("STRONG UPTREND"), [...ks].join());
  const flat = []; { let q = 100; for (let i = 0; i < 1200; i++){ const o = q; q = 100 + (q - 100)*0.9 + (rnd() - 0.5)*1.2; flat.push({ t: T0 + i*M15, T: T0 + (i + 1)*M15 - 1, o, h: Math.max(o, q) + rnd()*0.2, l: Math.min(o, q) - rnd()*0.2, c: q, v: 100, tb: 50, x: true }); } }
  const Ff = G.prep(flat); let rg = 0, rc = 0; for (let i = 300; i < 1200; i++){ const r = G.evalAt(Ff, i, Object.assign({}, G.DEF, { minShow: "weak" })); if (r.regime.k === "RANGE") rg++; rc += r.cands.concat(r.rejected).filter(c => c.strat === "range").length; }
  assert.ok(rg > 100, "sideways → RANGE regime"); assert.ok(rc > 0, "low ADX activates the range strategy (signals continue)");
  const P = { d: -1, kind: "reversal", entry: 100, stop: 101, risk: 1, riskP: 1, tp: 98.5, tpR: 1.5, maxB: 24 }, R = { k: "STRONG UPTREND", flags: [] }; const J = G.judge(F, 500, Object.assign({}, P, { entry: F.b[500].c, stop: F.b[500].c*1.01, tp: F.b[500].c*0.985, riskP: 1, risk: F.b[500].c*0.01 }), R, G.DEF, null);
  assert.strictEqual(J.E.reg, -1, "reversal against a strong trend gets the regime penalty"); }
// ---- grades + configurable threshold; hard block only when the target cannot pay costs ----
{ const b = series(700, 0.0012, 0.003), F = G.prep(b); let seen = { strong: 0, medium: 0, weak: 0, below: 0 };
  for (let i = 300; i < 690; i++){ const r = G.evalAt(F, i, Object.assign({}, G.DEF, { minShow: "medium" }));
    for (const c of r.cands){ assert.ok(c.grade === "strong" || c.grade === "medium"); assert.ok(c.score >= G.DEF.g.medium); seen[c.grade]++; }
    for (const c of r.rejected){ if (c.grade === "weak"){ seen.weak++; assert.ok(/eşiğinin altında/.test(c.reason)); } else if (!c.blocked){ seen.below++; assert.ok(/zayıf kanıt/.test(c.reason)); } } }
  assert.ok(seen.weak + seen.medium + seen.strong > 0);
  const i = 500, x = F.b[i], P = { d: 1, kind: "trend", entry: x.c, stop: x.c*0.99, risk: x.c*0.01, riskP: 1, tp: x.c*1.0005, tpR: 0.05, maxB: 32, tp1: 0, tp2: 0, tp3: 0 };
  const J = G.judge(F, i, P, G.regime(F, i), G.DEF, null); assert.ok(J.blocked && /ücret/.test(J.blocks[0]), "target below costs → hard block (impossible execution)");
  const P2 = Object.assign({}, P, { tp: x.c*1.02 }); assert.strictEqual(G.judge(F, i, P2, G.regime(F, i), G.DEF, null).blocked, false, "valid but weak/risky → classified, not blocked"); }
// ---- outcome accounting: same-bar SL+TP = SL, timeout split, costs, R ----
{ const bar = (o, h, l, c) => ({ o, h, l, c, x: true }); const b = [bar(100, 100, 100, 100), bar(100, 103, 97, 100)], P = { d: 1, entry: 100, stop: 98, tp: 102, maxB: 5, riskP: 2 };
  const r = G.resolve(b, 0, P, M15); assert.strictEqual(r.r, "SL"); assert.ok(Math.abs(r.net - (-2 - G.costPct({ stop: true, holdMs: M15 }))) < 1e-9); assert.ok(Math.abs(r.R - r.net/2) < 1e-12);
  assert.strictEqual(G.resolve([bar(100, 100, 100, 100), Object.assign(bar(100, 100, 100, 100), { x: false })], 0, P, M15), null, "open candle → unresolved");
  const tb = [bar(100, 100, 100, 100), bar(100, 100.5, 99.5, 100.4), bar(100.4, 100.6, 100, 100.5)]; const t = G.resolve(tb, 0, Object.assign({}, P, { maxB: 2 }), M15); assert.strictEqual(t.r, "T+");
  const t2 = G.resolve([bar(100, 100, 100, 100), bar(100, 100.1, 99.9, 100.05), bar(100, 100.1, 99.9, 100.05)], 0, Object.assign({}, P, { maxB: 2 }), M15); assert.strictEqual(t2.r, "T−", "tiny gain eaten by costs = loss");
  const S = G.stats([{ t: 1, R: 2, net: 2 }, { t: 2, R: -1, net: -1 }, { t: 3, R: -1, net: -1 }, { t: 4, R: 1, net: 1 }]); assert.strictEqual(S.n, 4); assert.strictEqual(S.pf, 1.5); assert.strictEqual(S.maxDD, 2); assert.strictEqual(S.false, 2); assert.strictEqual(S.maxLoseStreak, 2); }
// ---- frequency per coin / interval ----
{ let st = {}; st = G.freqAdd(st, "BTCUSDT", "15m", "strong", 1000); st = G.freqAdd(st, "BTCUSDT", "15m", "strong", 1000); st = G.freqAdd(st, "BTCUSDT", "15m", "weak", 2000); st = G.freqAdd(st, "ETHUSDT", "1h", "medium", 2000);
  const f = G.freqOf(st, "BTCUSDT", "15m", 3000); assert.strictEqual(f.n, 2); assert.strictEqual(f.strong, 1); assert.strictEqual(f.weak, 1); assert.strictEqual(G.freqOf(st, "ETHUSDT", "1h", 3000).medium, 1);
  st = G.freqAdd(st, "BTCUSDT", "15m", "weak", 2000 + 8*864e5); assert.strictEqual(st["BTCUSDT|15m"].length, 1, "older than 7 days pruned"); }
// ---- signal-only: no network / orders / auto in the engine or its panel ----
{ const src = fs.readFileSync(path.join(D, "sig8.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, ""); assert.ok(!/fetch\(|WebSocket|XMLHttpRequest|TRADE|AUTO|EXEC|placeOrder|order\.place|localStorage/.test(src), "pure engine");
  const sy = fs.readFileSync(path.join(D, "sinyal.js"), "utf8"), a = sy.indexOf("function s8Run"), z = sy.indexOf("/* ---------------- details", a), blk = sy.slice(a, z);
  assert.ok(a > 0 && z > a); assert.ok(!/TRADE|AUTO\.|EXEC|JOURNAL|alarm\(|checkAlert|jFrom|H\.save/.test(blk), "SİNYAL 8 panel never orders, journals or alerts");
  assert.ok(/KANITLANMADI/.test(blk) && /kazanma olasılığı DEĞİLDİR/.test(blk), "honest labels");
  const html = fs.readFileSync(path.join(D, "index.html"), "utf8"); assert.ok(html.indexOf("scalp.js") < html.indexOf("sig8.js"), "SCM loaded before SIG8"); }
/* v7.51: per-interval backtest labels (1h / 4h tested, nothing proven) — label only, panel stays KANITLANMADI */
{ const S8 = require(path.join(D, "sig8.js")); assert.deepStrictEqual(S8.BT.tested, ["15m", "1h", "4h"]);
  for (const k of ["1h", "4h"]){ const B = S8.BT.byTf[k]; assert.ok(B && B.span && B.note && B.grades.strong.n > 1000, k + " label present"); }
  assert.ok(/zamanlama avantajı yok/.test(S8.BT.byTf["4h"].note), "4h small plus is explained as drift, not edge");
  const sy = fs.readFileSync(path.join(D, "sinyal.js"), "utf8"); assert.ok(/BT0\.byTf\[S\.tf\]/.test(sy) && /BT0\.tested/.test(sy), "panel picks the label of the selected interval"); }
console.log("sig8.test OK");
