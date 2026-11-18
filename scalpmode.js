/* MERMER TERMİNAL v7.24 — SCALP (anlık) modu: decision from the SELECTED interval only + microstructure.
   Inputs per candle: EMA 9/21, session VWAP, 3-candle momentum, CVD (taker buy − sell) over 10 candles, volume spike, BTC lead (3 candles);
   live only: order-book imbalance (±0.25 %) and the live candle's taker delta. Higher intervals are a context note, never the label.
   Walk-forward replay (v7.24, 40 coins × 5 weeks, 1m/3m/5m) showed that on these intervals a short push tends to REVERT over the next
   3 candles (following the flow was right only 47–48 %, fading it 52.5–53 %), so the "anlık eğilim" is the measured-better side (tepki)
   and the flow itself (akış) is shown as the reason. Order-book imbalance / live taker delta are not in the replay → info + veto only.
   GİR only when |score| ≥ th, the target (1.5 × ATR) clearly beats fees + spread, the book does not lean hard against it, AND the rule
   was proven on this coin + interval in a walk-forward replay (sGate). Otherwise BEKLE with the "anlık eğilim". Signal only: no orders. */
"use strict";
(function (root, factory){ const M = factory(); if (typeof module === "object" && module.exports) module.exports = M; else root.SCX = M; })(typeof self !== "undefined" ? self : this, function (){
const fin = x => typeof x === "number" && isFinite(x), clip = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x)), sgn = (x, band = 0) => x > band ? 1 : x < -band ? -1 : 0;
const CFG = { agree: false, th: 0.6, lean: 0.15, stopK: 1.0, tpK: 1.5, maxB: 6, fee: 0.10, spread: 0.02, feeX: 2.5, sign: { ema: -1, vwap: -1, mom: -1, cvd: -1, vol: -1, btc: -1 }, W: { ema: 0.2, vwap: 0.15, mom: 0.25, cvd: 0.2, vol: 0.1, btc: 0.1, imb: 0.15, dlt: 0.1 } };
const NAMES = { ema: "EMA 9/21", vwap: "VWAP", mom: "momentum (3 mum)", cvd: "CVD / taker", vol: "hacim patlaması", btc: "BTC öncülük", imb: "emir defteri", dlt: "anlık taker" };
function ema(a, p){ const k = 2/(p + 1), o = Array(a.length).fill(null); let e = null; for (let i = 0; i < a.length; i++){ e = e === null ? a[i] : a[i]*k + e*(1 - k); o[i] = e; } return o; }
function prep(b){ const n = b.length, c = b.map(x => x.c), e9 = ema(c, 9), e21 = ema(c, 21), A = Array(n).fill(null), vw = Array(n).fill(null), va = Array(n).fill(null), cv = Array(n).fill(null);
  let tr = 0, day = -1, pv = 0, vv = 0; for (let i = 0; i < n; i++){ const x = b[i], t = i ? Math.max(x.h - x.l, Math.abs(x.h - b[i - 1].c), Math.abs(x.l - b[i - 1].c)) : x.h - x.l; tr = i < 14 ? (tr*i + t)/(i + 1) : (tr*13 + t)/14; A[i] = tr;
    const d = Math.floor(x.t/864e5); if (d !== day){ day = d; pv = 0; vv = 0; } const tp = (x.h + x.l + x.c)/3; pv += tp*x.v; vv += x.v; vw[i] = vv ? pv/vv : x.c;
    if (i >= 19){ let s = 0; for (let j = i - 19; j <= i; j++) s += b[j].v; va[i] = s/20; } if (i >= 9){ let s = 0, v = 0; for (let j = i - 9; j <= i; j++){ s += 2*(b[j].tb ?? b[j].v/2) - b[j].v; v += b[j].v; } cv[i] = v ? s/v : 0; } }
  return { b, n, c, e9, e21, A, vw, va, cv }; }
/* feature votes at candle i (only data up to i) */
function feats(P, i, bt){ const x = P.b[i], A = P.A[i] || x.c*0.001, F = {};
  F.ema = clip((P.e9[i] - P.e21[i])/(0.6*A)); F.vwap = clip((x.c - P.vw[i])/(1.5*A)); F.mom = i >= 3 ? clip((x.c - P.c[i - 3])/(1.5*A)) : 0; F.cvd = fin(P.cv[i]) ? clip(P.cv[i]*3) : 0;
  F.vol = fin(P.va[i]) && x.v > 1.8*P.va[i] ? sgn(x.c - x.o) : 0;
  if (bt && bt.P){ const j = bt.j; if (j >= 3){ const bA = bt.P.A[j] || bt.P.c[j]*0.001; F.btc = clip((bt.P.c[j] - bt.P.c[j - 3])/(1.5*bA)); } } return F; }
function score(F, W = CFG.W, raw = false){ let s = 0, w = 0; for (const k in F){ if (!fin(F[k]) || !W[k]) continue; s += W[k]*F[k]*(raw ? 1 : CFG.sign[k] ?? 1); w += W[k]; } return w ? s/w : 0; }
/* the live view of one interval. o: { btc: bars, micro: { imb, dlt }, fee, spread, gate (sReplay result) } */
function view(b, o = {}){ if (!b || b.length < 60) return null; const P = o.P || prep(b), i = P.n - 1, x = b[i], A = P.A[i] || x.c*0.001;
  let bt = null; if (o.btc && o.btc.length > 30){ const BP = prep(o.btc); let j = BP.n - 1; while (j > 0 && BP.b[j].t > x.t) j--; bt = { P: BP, j }; }
  const F = feats(P, i, bt), M = {}; if (o.micro){ if (fin(o.micro.imb)) M.imb = clip(o.micro.imb*2); if (fin(o.micro.dlt)) M.dlt = clip(o.micro.dlt*2); }
  const s = score(F), d = sgn(s, CFG.lean), flow = score(F, CFG.W, true), fee = o.fee ?? CFG.fee, spread = o.spread ?? CFG.spread, expP = CFG.tpK*A/x.c*100, feeOk = expP >= CFG.feeX*(fee + spread);
  const strong = Math.abs(s) >= (o.th ?? CFG.th), gateOk = sGate(o.gate), bookVeto = d && fin(M.imb) && M.imb*d <= -0.6;
  const parts = Object.keys(F).concat(Object.keys(M)).map(k => ({ k, n: NAMES[k], v: fin(F[k]) ? F[k] : M[k] })).filter(p => fin(p.v) && Math.abs(p.v) >= 0.3).sort((a, z) => Math.abs(z.v)*CFG.W[z.k] - Math.abs(a.v)*CFG.W[a.k]);
  const plan = d ? { entry: x.c, stop: x.c - d*CFG.stopK*A, tp: x.c + d*CFG.tpK*A } : null, go = !!(d && strong && feeOk && gateOk && !bookVeto);
  const acc = o.gate && fin(o.gate.acc) ? ` (bu coin + aralıkta yön isabeti %${Math.round(o.gate.acc*100)})` : "", fw = flow > 0.15 ? "alış" : flow < -0.15 ? "satış" : null;
  const why = !d ? "anlık yön yok (akış dengeli)" : (fw ? `son mumlarda ${fw} itişi aşırı → kısa tepki ${d > 0 ? "yukarı" : "aşağı"} beklentisi${acc}` : `kısa tepki ${d > 0 ? "yukarı" : "aşağı"} beklentisi${acc}`) +
    (go ? "" : !strong ? " — güçlü değil" : !feeOk ? ` — beklenen hareket %${expP.toFixed(2)}, ücret+spread (%${(fee + spread).toFixed(2)}) için yetersiz` : bookVeto ? " — emir defteri ters yönde" : !gateOk ? " — bu kural bu coin + aralıkta geçmişte ücret sonrası kazandırmadı" : "");
  return { s, d, flow, strength: Math.round(Math.abs(s)*100), F, M, parts, go, strong, feeOk, gateOk, bookVeto, expP, atr: A, plan, why, px: x.c, ema21: P.e21[i], holdB: o.gate && o.gate.hold ? o.gate.hold : [2, CFG.maxB] }; }
/* walk-forward replay on closed candles (no lookahead): entries when the rule fires (one position at a time), exit at stop / target / after maxB candles, fee round trip */
function sReplay(b, o = {}){ b = (b || []).filter(x => x.x !== false); const fee = o.fee ?? CFG.fee, th = o.th ?? CFG.th, out = { tr: [], dir: { n: 0, ok: 0 }, holds: [] }; if (b.length < 80) return null;
  const P = prep(b), BP = o.btc && o.btc.length > 30 ? prep(o.btc.filter(x => x.x !== false)) : null; let j = 0, busyTo = -1;
  for (let i = 60; i < P.n - 1; i++){ if (BP){ while (j + 1 < BP.n && BP.b[j + 1].t <= b[i].t) j++; } const F = feats(P, i, BP ? { P: BP, j } : null), s = score(F), d = sgn(s, CFG.lean), x = b[i], A = P.A[i] || x.c*0.001;
    if (d && i + 3 < P.n && P.c[i + 3] !== x.c){ out.dir.n++; out.dir.ok += sgn(P.c[i + 3] - x.c) === d ? 1 : 0; } /* flat (no tick moved) outcomes are skipped */
    if (i <= busyTo || !d) continue; const strong = Math.abs(s) >= th && (CFG.agree ? sgn(F.ema)*(CFG.sign.ema ?? 1) === d && sgn(F.mom, 0.1)*(CFG.sign.mom ?? 1) === d : true), feeOk = CFG.tpK*A/x.c*100 >= CFG.feeX*(fee + (o.spread ?? CFG.spread));
    if (!strong || !feeOk) continue; const en = x.c, st = en - d*CFG.stopK*A, tp = en + d*CFG.tpK*A; let r = null;
    for (let k = i + 1; k <= Math.min(P.n - 1, i + CFG.maxB); k++){ const y = b[k]; if (d > 0 ? y.l <= st : y.h >= st){ r = { r: "SL", pnl: d*(st - en)/en*100 - fee, k }; break; } if (d > 0 ? y.h >= tp : y.l <= tp){ r = { r: "TP", pnl: d*(tp - en)/en*100 - fee, k }; break; } }
    if (!r){ const k = Math.min(P.n - 1, i + CFG.maxB); r = { r: "T", pnl: d*(b[k].c - en)/en*100 - fee, k }; } r.t = x.t; r.d = d; out.tr.push(r); out.holds.push(r.k - i); busyTo = r.k; }
  const n = out.tr.length, w = out.tr.filter(r => r.pnl > 0).length, net = out.tr.reduce((q, r) => q + r.pnl, 0), hs = out.holds.slice().sort((a, z) => a - z);
  out.T = { n, win: n ? w/n : null, net, avg: n ? net/n : null }; out.hold = hs.length ? [hs[Math.floor(hs.length*0.25)], hs[Math.floor(hs.length*0.75)]] : null; out.acc = out.dir.n ? out.dir.ok/out.dir.n : null; delete out.holds; return out; }
/* gate per mode: ≥ 20 replay entries, ≥ 45 % winners (target 1.5 × stop), positive average after fees */
const sGate = g => !!(g && g.T && g.T.n >= 20 && g.T.win >= 0.45 && g.T.avg > 0);
/* adapter → the shared decision() of smart.js. ctx = trend consensus (context note only) */
function toDecision(SMT, V, o = {}){ const f = o.f || (v => (+v).toFixed(4)), lab = V.d > 0 ? "LONG" : V.d < 0 ? "SHORT" : "NÖTR";
  const C = { G: V.s, dir: V.d, strong: false, label: lab, strength: V.strength, big: 0, mid: 0, short: V.s, rev: null, scalp: true };
  const tf = o.tfMs || 6e4, hd = V.holdB ? `~${Math.max(1, Math.round(V.holdB[0]*tf/6e4))}–${Math.max(1, Math.round(V.holdB[1]*tf/6e4))} dk` : "";
  const A = V.go ? { act: V.d > 0 ? "GİR LONG" : "GİR SHORT", d: V.d, kind: "scalp", entry: V.plan.entry, stop: V.plan.stop, tp: V.plan.tp, hold: hd }
    : { act: "BEKLE", d: 0, prefer: V.d, kind: "scalp", wait: V.d ? `anlık eğilim ${V.d > 0 ? "LONG" : "SHORT"}` : "net yön yok", note: V.why };
  const dec = SMT.decision(C, A, { px: V.px, atr: V.atr, ema21: V.ema21, hi: o.hi, lo: o.lo, f });
  dec.dirW = V.d > 0 ? "ANLIK YUKARI" : V.d < 0 ? "ANLIK AŞAĞI" : "ANLIK YATAY"; dec.yon = `${dec.arrow} YÖN: ${dec.dirW}`; dec.hold = hd; dec.scalp = { why: V.why, parts: V.parts.slice(0, 3), expP: V.expP, ctx: o.ctx || null, flowW: V.flow > 0.15 ? "alış" : V.flow < -0.15 ? "satış" : "" };
  if (A.act !== "BEKLE") dec.text = `${A.act} (scalp, tutma ${hd}) — giriş ${f(A.entry)}, stop ${f(A.stop)}, hedef ${f(A.tp)}.`;
  return { C, A, dec }; }
/* higher intervals → one context / risk line (never the label) */
function ctxNote(Ct, d){ if (!Ct) return null; const bd = Ct.big > 0.2 ? 1 : Ct.big < -0.2 ? -1 : 0, r = Ct.rev;
  if (r && d && r.d !== d) return `⚠ ${r.d < 0 ? "aşağı" : "yukarı"} DÖNÜŞ UYARISI var — ${d > 0 ? "long" : "short"} riskli`;
  if (bd && d && bd !== d) return `üst zaman dilimleri (1s–1G) ${bd > 0 ? "yukarı" : "aşağı"} — ters yön, kısa tut`;
  return bd ? `üst zaman dilimleri ${bd > 0 ? "yukarı" : "aşağı"} (bağlam)` : "üst zaman dilimleri yatay (bağlam)"; }
return { CFG, NAMES, prep, feats, score, view, sReplay, sGate, toDecision, ctxNote };
});
