/* v7.40 FAZ 2 — Binance order safety (spec items 1–10, 17–19): sizing incl. fees, manual-qty bypass, SL/TP verify, emergency close, idempotency, gate */
const assert = require("assert"), S = require("../bfxsafe.js");
const M = { step: 0.001, qdec: 3, minQty: 0.001, maxQty: 1000, minNotional: 5 };
const base = { side: "long", px: 100, st: 98, tg: 104, lev: 5, maxLoss: 10, accountSize: 1000, capPct: 100, avail: 1000, M };
// 1 auto size: loss at stop incl. fees+slip ≤ maxLoss
{ const r = S.size(base); assert.ok(r.ok, r.issues.join()); assert.ok(r.loss <= 10 + 1e-9 && r.loss > 9.5, "loss " + r.loss); assert.ok(r.loss > r.lossGross, "fees counted"); }
// 2 manual qty over max loss → rejected (not clamped, not ignored)
{ const r = S.size(Object.assign({}, base, { manual: "10" })); assert.ok(!r.ok); assert.ok(r.issues.some(x => /max zararı aşıyor/.test(x))); }
// 3 manual qty within limit → ok, by "elle"
{ const r = S.size(Object.assign({}, base, { manual: "1" })); assert.ok(r.ok, r.issues.join()); assert.strictEqual(r.by, "elle girildi"); }
// 4 invalid manual / stop / target / leverage
for (const bad of ["abc", "-1", "0", "1e", "NaN"]) assert.ok(!S.size(Object.assign({}, base, { manual: bad })).ok, "manual " + bad);
assert.ok(!S.size(Object.assign({}, base, { st: 101 })).ok, "long stop above price");
assert.ok(!S.size(Object.assign({}, base, { tg: 99 })).ok, "long target below price");
assert.ok(!S.size(Object.assign({}, base, { side: "short", st: 98, tg: 104 })).ok, "short wrong sides");
assert.ok(!S.size(Object.assign({}, base, { st: 100 })).ok, "zero stop distance");
assert.ok(!S.size(Object.assign({}, base, { st: NaN })).ok && !S.size(Object.assign({}, base, { lev: 2.5 })).ok && !S.size(Object.assign({}, base, { lev: 0 })).ok && !S.size(Object.assign({}, base, { lev: 200 })).ok);
// 5 margin / minNotional conflict / cap
assert.ok(!S.size(Object.assign({}, base, { avail: 1 })).ok, "insufficient margin");
{ const r = S.size(Object.assign({}, base, { maxLoss: 0.01 })); assert.ok(!r.ok && r.issues.some(x => /çelişiyor|minimum/.test(x)), "minNotional conflict blocks"); }
{ const r = S.size(Object.assign({}, base, { manual: "5", maxLoss: 1000, accountSize: 100, capPct: 10 })); assert.ok(!r.ok && r.issues.some(x => /sınırını aşıyor/.test(x)), "cap"); }
// short sizing symmetric
{ const r = S.size(Object.assign({}, base, { side: "short", st: 102, tg: 96 })); assert.ok(r.ok && r.loss <= 10 + 1e-9); }
assert.ok(S.definitive({ code: -2019 }) && !S.definitive({ code: -1007 }) && !S.definitive(new Error("timeout")) && !S.definitive({ code: -1, http: 503 }));
// ---- mock exchange ----
function mock(o = {}){ const X = { orders: {}, algos: [], sent: [], crit: [], logs: [], pos: o.pos ?? 0, n: 0 };
  X.api = { sleep: async () => {}, log: m => X.logs.push(m), critical: m => X.crit.push(m), err: e => (e && (e.msg || e.message)) || String(e),
    place: async q => { X.sent.push(q); if (o.placeFail && X.sent.length === 1) throw o.placeFail; const r = { orderId: ++X.n, clientOrderId: q.newClientOrderId, status: o.status || "FILLED", executedQty: o.exec ?? q.quantity, avgPrice: "100" };
      X.orders[q.newClientOrderId] = r; if (o.lostReply && X.sent.length === 1) throw new Error("timeout"); if (q.reduceOnly || /x$/.test(q.newClientOrderId)) X.pos = 0; return r; },
    query: async q => { const r = X.orders[q.origClientOrderId]; if (!r) throw { code: -2013, msg: "Order does not exist." }; return r; },
    algoPlace: async q => { X.sent.push(q); if (o.slFail && q.type === "STOP_MARKET") throw { code: -2021, msg: "would immediately trigger" }; if (o.tpFail && q.type === "TAKE_PROFIT_MARKET") throw { code: -4000, msg: "tp fail" };
      const a = { algoId: ++X.n, clientAlgoId: q.clientAlgoId, orderType: q.type, symbol: q.symbol, triggerPrice: q.triggerPrice, positionSide: q.positionSide || "BOTH" }; if (!o.ghost) X.algos.push(a); return a; },
    algoCancel: async q => { X.algos = X.algos.filter(a => a.algoId !== q.algoId); },
    openAlgo: async () => X.algos.slice(), positions: async () => [{ positionAmt: String(X.pos), positionSide: "BOTH" }] }; return X; }
const P = { symbol: "BTCUSDT", L: true, qty: "0.010", stPx: "98", tgPx: "104", dual: false, attach: true, cid: "mtTEST" };
(async () => {
  // 6 happy path: SL+TP verified on the exchange
  { const X = mock(); const r = await S.openProtected(X.api, P); assert.strictEqual(r.state, "AÇIK · STOP+HEDEF KURULU"); assert.ok(r.sl.verified && r.tp.verified); assert.strictEqual(X.sent.filter(q => q.type === "MARKET").length, 1); }
  // 7 SL fails twice → emergency reduce-only close + critical alert
  { const X = mock({ slFail: true, pos: 0.01 }); const r = await S.openProtected(X.api, P); assert.ok(/ACİL KAPATILDI/.test(r.state), r.state); assert.ok(X.crit.length >= 2);
    const c = X.sent.find(q => q.newClientOrderId === "mtTESTx"); assert.ok(c && c.reduceOnly === "true" && c.side === "SELL"); assert.strictEqual(X.sent.filter(q => q.type === "STOP_MARKET").length, 2, "SL retried once"); }
  // 8 SL placed but not visible on the exchange (ghost) → treated as failure → emergency close
  { const X = mock({ ghost: true, pos: 0.01 }); const r = await S.openProtected(X.api, P); assert.ok(/ACİL|KORUMASIZ/.test(r.state), r.state); }
  // 9 TP fails → warning, SL kept, position stays open
  { const X = mock({ tpFail: true }); const r = await S.openProtected(X.api, P); assert.strictEqual(r.state, "AÇIK · STOP KURULU, HEDEF YOK"); assert.ok(X.algos.some(a => a.orderType === "STOP_MARKET")); assert.strictEqual(X.crit.length, 0); }
  // 10 reply lost → reconcile by clientOrderId, NEVER resend
  { const X = mock({ lostReply: true }); const r = await S.openProtected(X.api, P); assert.strictEqual(X.sent.filter(q => q.type === "MARKET").length, 1, "no resend"); assert.ok(/AÇIK/.test(r.state), r.state); }
  // 10b unknown error and order not on the exchange → GÖNDERİLMEDİ (no resend); definitive reject → REDDEDİLDİ
  { const X = mock({ placeFail: new Error("socket closed") }); X.api.place = async q => { X.sent.push(q); throw new Error("socket closed"); };
    const r = await S.openProtected(X.api, P); assert.strictEqual(r.state, "GÖNDERİLMEDİ"); assert.strictEqual(X.sent.length, 1); }
  { const X = mock({ placeFail: { code: -2019, msg: "Margin is insufficient." } }); const r = await S.openProtected(X.api, P); assert.strictEqual(r.state, "REDDEDİLDİ"); assert.strictEqual(X.sent.length, 1); }
  // 10c query keeps failing → BELİRSİZ + critical, still no resend
  { const X = mock(); X.api.place = async q => { X.sent.push(q); throw new Error("timeout"); }; X.api.query = async () => { throw new Error("net"); };
    const r = await S.openProtected(X.api, P); assert.strictEqual(r.state, "BELİRSİZ"); assert.strictEqual(X.sent.length, 1); assert.ok(X.crit.length); }
  // 17 partial fill → protection sized by closePosition, partial flagged
  { const X = mock({ exec: "0.004", status: "PARTIALLY_FILLED" }); const r = await S.openProtected(X.api, P); assert.ok(r.partial && r.exec === 0.004); assert.ok(/STOP/.test(r.state)); }
  // 18 duplicate/orphan: same SL already live → reused; orphan SL at another price → cancelled first
  { const X = mock(); X.algos.push({ algoId: 77, orderType: "STOP_MARKET", symbol: "BTCUSDT", triggerPrice: "98", positionSide: "BOTH" }); const r = await S.placeVerified(X.api, P, "SL", "98", 2); assert.ok(r.reused && r.algoId === 77); assert.strictEqual(X.sent.length, 0); }
  { const X = mock(); X.algos.push({ algoId: 78, orderType: "STOP_MARKET", symbol: "BTCUSDT", triggerPrice: "90", positionSide: "BOTH" }); const r = await S.placeVerified(X.api, P, "SL", "98", 2);
    assert.ok(r.ok && !X.algos.some(a => a.algoId === 78)); assert.strictEqual(X.algos.filter(a => a.orderType === "STOP_MARKET").length, 1); }
  // 19 hedge mode: positionSide set, no reduceOnly; other side's SL untouched
  { const X = mock({ slFail: true, pos: 0.01 }); X.algos.push({ algoId: 5, orderType: "STOP_MARKET", symbol: "BTCUSDT", triggerPrice: "120", positionSide: "SHORT" });
    const r = await S.openProtected(X.api, Object.assign({}, P, { dual: true })); const c = X.sent.find(q => q.newClientOrderId === "mtTESTx"); assert.ok(c.positionSide === "LONG" && !c.reduceOnly); assert.ok(X.algos.some(a => a.algoId === 5), "SHORT stop kept"); }
  // no stop chosen → explicit state, no algo orders
  { const X = mock(); const r = await S.openProtected(X.api, Object.assign({}, P, { attach: false })); assert.ok(/STOPSUZ/.test(r.state)); assert.strictEqual(X.algos.length, 0); }
  // gate: kill switch, daily loss, max open, max/day, cooldown
  const now = Date.parse("2026-11-19T12:00:00Z"), day0 = Date.parse("2026-11-19T00:00:00Z"), G = { now, day0, dailyLossLimit: 50, maxOpen: 3, maxDay: 10, lossStreak: 2, coolMin: 60 };
  const tr = (pnl, t, open) => ({ openT: t - 1000, closeT: open ? 0 : t, open: !!open, in: 100, out: open ? undefined : 100 + pnl });
  assert.ok(S.gate([], G).ok); assert.ok(!S.gate([], Object.assign({}, G, { halted: true })).ok);
  { const g = S.gate([tr(-30, now - 7200e3), tr(-25, now - 5000e3)], G); assert.ok(!g.ok && g.stop, "daily loss → stop"); }
  assert.ok(!S.gate([tr(0, now, 1), tr(0, now, 1), tr(0, now, 1)], G).ok, "maxOpen");
  { const g = S.gate([tr(-5, now - 20*60e3), tr(-5, now - 10*60e3)], G); assert.ok(!g.ok && /ardışık/.test(g.why), "cooldown"); }
  assert.ok(S.gate([tr(-5, now - 200*60e3), tr(-5, now - 100*60e3)], G).ok, "cooldown over");
  assert.ok(S.gate([tr(-5, now - 20*60e3), tr(+5, now - 10*60e3)], G).ok, "streak broken");
  console.log("bfxsafe.test OK");
})().catch(e => { console.error(e); process.exit(1); });
