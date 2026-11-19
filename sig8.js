/* MERMER TERMİNAL v7.50 — SİNYAL 8 (deneysel): weighted-evidence signal engine. Pure math, no DOM, no network, NO ORDERS (signal only, never feeds auto-buy).
   • Data quality first: invalid / gapped / stale bars → hard block (the only hard blocks are: invalid data, impossible execution, risk/security).
   • Regime: STRONG/WEAK UP/DOWN TREND, RANGE, BREAKOUT/BREAKDOWN, REVERSAL + HIGH/LOW VOL flags, UNKNOWN when data is short.
   • Four separate strategies (trend pullback, breakout, reversal, range) produce LONG and SHORT candidates continuously; nothing needs "all indicators agree".
   • Evidence layers (each −1…+1 in the candidate's direction) with the spec's starting weights: trend & structure 25, volume & flow 20, derivatives 20 (live only,
     dropped and re-normalised when missing — never treated as 0), MTF 15 (disagreement LOWERS confidence, never rejects), liquidity 10, volatility & regime 10.
   • Technical confidence (0–100) is NOT a win probability. The historical rate comes only from the walk-forward backtest (tools/sig8-bt.js).
   • Grades GÜÇLÜ / ORTA / ZAYIF by configurable thresholds; below ZAYIF = "reddedildi (zayıf kanıt)" — still listed with its reasons.
   • Costs (spec H): maker/taker fee per leg, spread, slippage (stop exits ×2), funding per 8 h — all % and configurable; R and % are always net of them.
   Only closed candles are used (x !== false); higher intervals only when their candle closed at or before the bar's close (no look-ahead). */
"use strict";
(function (root, factory){ const M = factory(typeof module === "object" && module.exports ? require("./scalp.js") : root.SCM); if (typeof module === "object" && module.exports) module.exports = M; else root.SIG8 = M; })(typeof self !== "undefined" ? self : this, function (SCM){
const fin = x => typeof x === "number" && isFinite(x), clip = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x)), sgn = (x, band = 0) => x > band ? 1 : x < -band ? -1 : 0;
/* ---------- costs (all in %) ---------- */
const COST = { taker: 0.05, maker: 0.02, entry: "taker", exit: "taker", spread: 0.01, slip: 0.02, stopSlipX: 2, fund8h: 0.01 };
function costPct(o = {}, C = COST){ const fe = C[C.entry] ?? C.taker, fx = C[C.exit] ?? C.taker, slip = C.slip*(1 + (o.stop ? (C.stopSlipX - 1) : 0));
  const fund = Math.abs(C.fund8h)*Math.max(0, o.holdMs || 0)/288e5; return fe + fx + C.spread + C.slip + slip + fund; }
/* ---------- config ---------- */
const W0 = { trend: 0.25, flow: 0.20, der: 0.20, mtf: 0.15, liq: 0.10, reg: 0.10 };
const DEF = { W: W0, g: { strong: 70, medium: 60, weak: 50 }, minShow: "medium", strat: { trend: true, breakout: true, reversal: true, range: true },
  tpR: { trend: 2, breakout: 2, reversal: 1.5, range: 1.5 }, maxB: { trend: 32, breakout: 32, reversal: 24, range: 24 }, minDQ: 60, adxLo: 20, adxHi: 25 };
const STRAT = { trend: "TREND (geri çekilme)", breakout: "KIRILIM", reversal: "DÖNÜŞ", range: "YATAY BANT" };
const GRADE = { strong: "GÜÇLÜ", medium: "ORTA", weak: "ZAYIF" };
/* ---------- data quality ---------- */
function dq(b, tms, now){ const n = b.length, why = []; let s = 100; if (n < 220){ return { s: 0, why: [`mum az (${n}/220)`], ok: false }; }
  let bad = 0, gaps = 0, dup = 0; for (let i = Math.max(1, n - 300); i < n; i++){ const x = b[i], p = b[i - 1];
    if (![x.o, x.h, x.l, x.c, x.v].every(fin) || x.h < Math.max(x.o, x.c) - 1e-12 || x.l > Math.min(x.o, x.c) + 1e-12 || x.v < 0 || x.l <= 0) bad++;
    const dt = x.t - p.t; if (dt === 0) dup++; else if (dt < 0) bad++; else if (tms && dt > tms*1.5) gaps++; }
  if (bad){ s -= 60; why.push(`${bad} geçersiz mum`); } if (dup){ s -= 30; why.push(`${dup} tekrar eden mum`); } if (gaps){ s -= Math.min(40, gaps*10); why.push(`${gaps} eksik mum aralığı`); }
  if (now && tms){ const age = now - b[n - 1].T; if (age > 2*tms + 6e4){ s -= 50; why.push(`veri bayat (${Math.round(age/6e4)} dk)`); } }
  s = Math.max(0, s); return { s, why, ok: s >= DEF.minDQ }; }
/* ---------- features (computed once, read at ≤ i) ---------- */
function higherDir(hb){ if (!hb || hb.length < 60) return null; const c = hb.map(x => x.c), e20 = SCM.ema(c, 20), e50 = SCM.ema(c, 50);
  return { T: hb.map(x => x.T), d: hb.map((x, i) => fin(e50[i]) && i >= 50 ? (sgn(e20[i] - e50[i])*0.5 + sgn(x.c - e50[i])*0.5) : null) }; }
function atT(H, T){ if (!H) return null; let lo = 0, hi = H.T.length - 1, k = -1; while (lo <= hi){ const m = (lo + hi) >> 1; if (H.T[m] <= T){ k = m; lo = m + 1; } else hi = m - 1; } return k >= 0 ? H.d[k] : null; }
function prep(b, o = {}){ b = b.filter(x => x.x !== false); const n = b.length, c = b.map(x => x.c), v = b.map(x => x.v);
  const F = { b, n, c, e20: SCM.ema(c, 20), e50: SCM.ema(c, 50), e100: SCM.ema(c, 100), e200: SCM.ema(c, 200), A: SCM.atr(b), X: SCM.adx(b), rsi: SCM.rsi(c), B: SCM.boll(c), vs20: SCM.sma(v, 20), obv: SCM.obv(b), tms: o.tms || 9e5 };
  F.vw = SCM.vwap(b, 864e5); F.H1 = higherDir(o.h1); F.H2 = higherDir(o.h2);
  /* taker delta over 10 bars, bw / atr percentile over 200 bars */
  F.dl = Array(n).fill(null); F.bwP = Array(n).fill(null); F.aP = Array(n).fill(null);
  for (let i = 10; i < n; i++){ let s = 0, w = 0; for (let j = i - 9; j <= i; j++){ const x = b[j]; if (fin(x.tb)){ s += 2*x.tb - x.v; w += x.v; } } F.dl[i] = w ? s/w : null; }
  const pct = (arr, i, L) => { const x = arr[i]; if (!fin(x)) return null; let k = 0, m = 0; for (let j = Math.max(0, i - L + 1); j <= i; j++){ const y = arr[j]; if (!fin(y)) continue; m++; if (y <= x) k++; } return m >= 50 ? k/m : null; };
  const aN = F.A.map((a, i) => fin(a) ? a/c[i] : null); for (let i = 0; i < n; i++){ F.bwP[i] = pct(F.B.bw, i, 200); F.aP[i] = pct(aN, i, 200); }
  /* structure: last confirmed swing break (pivot 3/3 → known 3 bars later) */
  F.bos = Array(n).fill(0); { let sh = null, sl = null, st = 0; for (let i = 0; i < n; i++){ const p = i - 3; if (p >= 3){ let H = true, L = true; for (let j = p - 3; j <= p + 3; j++){ if (j === p) continue; if (b[j].h > b[p].h) H = false; if (b[j].l < b[p].l) L = false; } if (H) sh = b[p].h; if (L) sl = b[p].l; }
    if (sl !== null && b[i].c < sl) st = -1; else if (sh !== null && b[i].c > sh) st = 1; F.bos[i] = st; } }
  /* day high/low so far (before bar i) */
  F.dH = Array(n).fill(null); F.dL = Array(n).fill(null); { let day = null, h = -Infinity, l = Infinity; for (let i = 0; i < n; i++){ const d = Math.floor(b[i].t/864e5); if (d !== day){ day = d; h = -Infinity; l = Infinity; } F.dH[i] = h > -Infinity ? h : null; F.dL[i] = l < Infinity ? l : null; h = Math.max(h, b[i].h); l = Math.min(l, b[i].l); } }
  return F; }
const hiN = (b, i, k) => { let h = -Infinity; for (let j = Math.max(0, i - k); j < i; j++) h = Math.max(h, b[j].h); return h; }, loN = (b, i, k) => { let l = Infinity; for (let j = Math.max(0, i - k); j < i; j++) l = Math.min(l, b[j].l); return l; };
/* ---------- regime at i ---------- */
function regime(F, i, cfg = DEF){ const b = F.b, x = b[i], A = F.A[i], ax = F.X.adx[i], e20 = F.e20[i], e50 = F.e50[i], e100 = F.e100[i];
  if (i < 210 || ![A, ax, e20, e50, e100].every(fin)) return { k: "UNKNOWN", d: 0, flags: [] };
  const al = e20 > e50 && e50 > e100 ? 1 : e20 < e50 && e50 < e100 ? -1 : 0, sl = (F.e50[i] - F.e50[i - 10])/A, flags = [];
  if (fin(F.aP[i])){ if (F.aP[i] >= 0.9) flags.push("YÜKSEK VOLATİLİTE"); else if (F.aP[i] <= 0.1) flags.push("DÜŞÜK VOLATİLİTE"); }
  const h20 = hiN(b, i, 20), l20 = loN(b, i, 20), rv = fin(F.vs20[i - 1]) && F.vs20[i - 1] ? x.v/F.vs20[i - 1] : 1;
  if (x.c > h20 && rv >= 1.3) return { k: "BREAKOUT", d: 1, flags, adx: ax };
  if (x.c < l20 && rv >= 1.3) return { k: "BREAKDOWN", d: -1, flags, adx: ax };
  if (al && F.bos[i] === -al && F.bos[i - 6] === al) return { k: "REVERSAL", d: -al, flags, adx: ax };
  if (ax >= cfg.adxHi && al && sgn(sl, 0.05) === al) return { k: al > 0 ? "STRONG UPTREND" : "STRONG DOWNTREND", d: al, flags, adx: ax };
  if (ax >= cfg.adxLo && (al || sgn(sl, 0.1))) { const d = al || sgn(sl, 0.1); return { k: d > 0 ? "WEAK UPTREND" : "WEAK DOWNTREND", d, flags, adx: ax }; }
  return { k: "RANGE", d: 0, flags, adx: ax }; }
/* ---------- strategy triggers → raw candidates ---------- */
function plan(F, i, d, stop, tpR, kind, maxB){ const px = F.b[i].c, A = F.A[i], r = Math.abs(px - stop);
  return { d, kind, entry: px, stop, risk: r, riskP: r/px*100, tp1: px + d*r, tp2: px + d*2*r, tp3: px + d*3*r, tp: px + d*tpR*r, tpR, maxB, atrDist: r/A, inval: stop }; }
function triggers(F, i, cfg = DEF){ const b = F.b, x = b[i], p = b[i - 1], A = F.A[i], out = []; if (!fin(A) || A <= 0) return out;
  const e20 = F.e20[i], e50 = F.e50[i], ax = F.X.adx[i], r = F.rsi, clampStop = (d, raw, lo, hi) => { const dist = clip(Math.abs(x.c - raw), lo*A, hi*A); return x.c - d*dist; };
  for (const d of [1, -1]){
    if (cfg.strat.trend && fin(ax) && ax >= cfg.adxLo && (e20 - e50)*d > 0){ let touch = false; for (let j = i - 3; j <= i; j++) if (d > 0 ? b[j].l <= F.e20[j] + 0.3*A : b[j].h >= F.e20[j] - 0.3*A) touch = true;
      if (touch && (x.c - e20)*d > 0 && (x.c - x.o)*d > 0 && (x.c - p.c)*d > 0){ const raw = d > 0 ? loN(b, i + 1, 5) - 0.2*A : hiN(b, i + 1, 5) + 0.2*A; out.push(plan(F, i, d, clampStop(d, raw, 0.8, 3), cfg.tpR.trend, "trend", cfg.maxB.trend)); } }
    if (cfg.strat.breakout){ const h20 = hiN(b, i, 20), l20 = loN(b, i, 20), lvl = d > 0 ? h20 : l20; let comp = false; for (let j = i - 5; j <= i - 1; j++) if (fin(F.bwP[j]) && F.bwP[j] <= 0.5) comp = true;
      if ((x.c - lvl)*d > 0 && (p.c - lvl)*d <= 0 && comp){ const raw = d > 0 ? Math.min(loN(b, i + 1, 3), lvl) - 0.2*A : Math.max(hiN(b, i + 1, 3), lvl) + 0.2*A; out.push(plan(F, i, d, clampStop(d, raw, 0.8, 2.5), cfg.tpR.breakout, "breakout", cfg.maxB.breakout)); } }
    if (cfg.strat.reversal && fin(e50)){ let ext = false; for (let j = i - 3; j <= i; j++) if (fin(r[j]) && (d > 0 ? r[j] <= 28 : r[j] >= 72)) ext = true;
      if (ext && (e50 - x.c)*d >= 2*A && (x.c - x.o)*d > 0 && (d > 0 ? x.c > p.h : x.c < p.l)){ const raw = d > 0 ? loN(b, i + 1, 5) - 0.2*A : hiN(b, i + 1, 5) + 0.2*A; out.push(plan(F, i, d, clampStop(d, raw, 0.8, 3), cfg.tpR.reversal, "reversal", cfg.maxB.reversal)); } }
    if (cfg.strat.range && fin(ax) && ax < cfg.adxLo){ const H = hiN(b, i + 1, 48), L = loN(b, i + 1, 48), w = H - L;
      if (w >= 3*A && w <= 14*A){ const pos = (x.c - L)/w, edge = d > 0 ? pos <= 0.25 : pos >= 0.75, rng = x.h - x.l || 1e-12, wick = d > 0 ? (Math.min(x.o, x.c) - x.l)/rng : (x.h - Math.max(x.o, x.c))/rng;
        if (edge && ((x.c - x.o)*d > 0 || wick >= 0.4) && fin(r[i]) && (d > 0 ? r[i] < 45 : r[i] > 55)){ const raw = d > 0 ? L - 0.3*A : H + 0.3*A, P = plan(F, i, d, clampStop(d, raw, 0.6, 3), cfg.tpR.range, "range", cfg.maxB.range);
          const mid = (H + L)/2, rr = Math.abs(mid - x.c)/P.risk; if (rr >= 1){ P.tp = mid; P.tpR = rr; } out.push(P); } } } }
  return out; }
/* ---------- evidence (each −1…+1 in direction d) ---------- */
const SUIT = { trend: { "STRONG UPTREND": 1, "WEAK UPTREND": 0.5, "STRONG DOWNTREND": 1, "WEAK DOWNTREND": 0.5, RANGE: -1, BREAKOUT: 0.3, BREAKDOWN: 0.3, REVERSAL: -0.5 },
  breakout: { BREAKOUT: 1, BREAKDOWN: 1, RANGE: 0.3, "WEAK UPTREND": 0.3, "WEAK DOWNTREND": 0.3, "STRONG UPTREND": 0, "STRONG DOWNTREND": 0, REVERSAL: -0.3 },
  reversal: { REVERSAL: 1, RANGE: 0.3, "WEAK UPTREND": 0, "WEAK DOWNTREND": 0, "STRONG UPTREND": -1, "STRONG DOWNTREND": -1, BREAKOUT: -0.5, BREAKDOWN: -0.5 },
  range: { RANGE: 1, "WEAK UPTREND": -0.3, "WEAK DOWNTREND": -0.3, "STRONG UPTREND": -1, "STRONG DOWNTREND": -1, BREAKOUT: -1, BREAKDOWN: -1, REVERSAL: 0 } };
function evidence(F, i, P, R, live = {}){ const b = F.b, x = b[i], A = F.A[i], d = P.d, E = {}, why = [], warn = [];
  const al = F.e20[i] > F.e50[i] && F.e50[i] > F.e100[i] ? 1 : F.e20[i] < F.e50[i] && F.e50[i] < F.e100[i] ? -1 : 0, sl = clip((F.e50[i] - F.e50[i - 10])/A/0.5);
  /* trend & structure: for reversal/range the trend layer measures how strongly the trend is AGAINST the trade (penalty), never a bonus for fading */
  let tr = (al*0.4 + sl*0.3 + F.bos[i]*0.3)*d; if (P.kind === "reversal" || P.kind === "range") tr = Math.min(0, tr) + 0.3*(F.bos[i] === d ? 1 : 0); E.trend = clip(tr);
  const rv = fin(F.vs20[i - 1]) && F.vs20[i - 1] ? x.v/F.vs20[i - 1] : null, dl = fin(F.dl[i]) ? clip(F.dl[i]*4)*d : 0, ob = clip(((F.obv[i] - F.obv[i - 10])/((F.vs20[i] || 1)*10))*2)*d;
  const vol = rv === null ? 0 : P.kind === "breakout" || P.kind === "trend" ? (rv >= 1.5 ? 1 : rv >= 1.1 ? 0.4 : rv < 0.7 ? -0.6 : 0) : (rv >= 1.5 ? 0.5 : 0);
  E.flow = clip(vol*0.5 + (dl*0.6 + ob*0.4)*0.5); if (P.kind === "breakout" && rv !== null && rv < 1.1) warn.push("hacimsiz kırılım (şüpheli)");
  if ((x.c - b[i - 10].c)*d > 0 && dl < -0.2) warn.push("fiyat yönde ama alıcı/satıcı baskısı zayıflıyor");
  const h1 = atT(F.H1, x.T), h2 = atT(F.H2, x.T), m = [h1, h2].filter(fin); E.mtf = m.length ? clip(m.reduce((s, v) => s + v*d, 0)/m.length) : null;
  if (E.mtf !== null && E.mtf < -0.4) warn.push("üst zaman dilimi ters (güven düşürüldü)");
  /* liquidity: room to the target before the day's high/low, sweep of the last 20-bar extreme (reversal/range) */
  const lvl = d > 0 ? F.dH[i] : F.dL[i]; let room = 0; if (fin(lvl)){ const dist = (lvl - x.c)*d; room = dist <= 0 ? 0.3 : dist >= Math.abs(P.tp - x.c) ? 0.6 : dist < P.risk ? -0.6 : 0; }
  const ext = d > 0 ? loN(b, i, 20) : hiN(b, i, 20), swept = d > 0 ? x.l < ext && x.c > ext : x.h > ext && x.c < ext; E.liq = clip(room + (swept && (P.kind === "reversal" || P.kind === "range") ? 0.6 : 0));
  E.reg = clip((SUIT[P.kind][R.k] ?? 0) - (R.flags.includes("YÜKSEK VOLATİLİTE") ? 0.4 : 0));
  /* derivatives: live only (funding / OI change / taker ratio); missing → layer dropped (not 0) */
  if (live && (fin(live.fund) || fin(live.oiCh) || fin(live.tk))){ const p = []; if (fin(live.fund)) p.push(live.fund > 0.0005 ? -d : live.fund < -0.0003 ? d : 0);
    if (fin(live.oiCh)){ const pu = sgn(x.c - b[i - 8].c); p.push(live.oiCh > 0.3 ? pu*d : live.oiCh < -0.3 ? -0.3*pu*d : 0); } if (fin(live.tk)) p.push(clip((live.tk - 1)*5)*d); E.der = clip(p.reduce((s, v) => s + v, 0)/p.length); }
  return { E, warn, rv }; }
function scoreOf(E, W){ let s = 0, w = 0; for (const k in W){ if (!fin(E[k])) continue; s += W[k]*E[k]; w += W[k]; } return w ? s/w : 0; }
/* ---------- grade one candidate ---------- */
function judge(F, i, P, R, cfg = DEF, live, C = COST){ const ev = evidence(F, i, P, R, live), raw = scoreOf(ev.E, cfg.W), x = F.b[i], A = F.A[i], blocks = [], why = [];
  const cost = costPct({ holdMs: P.maxB*F.tms/2 }, C), costStop = costPct({ stop: true, holdMs: P.maxB*F.tms/2 }, C), gainP = Math.abs(P.tp - P.entry)/P.entry*100;
  const netRR = (gainP - cost)/(P.riskP + costStop); P.cost = cost; P.netRR = netRR; P.netGainP = gainP - cost; P.netLossP = P.riskP + costStop;
  if (!(P.risk > 0) || !fin(P.stop) || !fin(P.tp)) blocks.push("stop/hedef geçersiz");
  if (gainP - cost <= 0) blocks.push(`hedef ücret+kaymayı karşılamıyor (%${gainP.toFixed(2)} ≤ %${cost.toFixed(2)})`);
  let pen = 0; const extA = Math.abs(x.c - F.e20[i])/A; if ((P.kind === "trend" || P.kind === "breakout") && extA > 2.5){ pen += Math.min(15, (extA - 2.5)*6); why.push(`fiyat EMA20'den ${extA.toFixed(1)} ATR uzak (kovalama riski)`); }
  if (netRR < 1.2){ pen += netRR < 0.8 ? 12 : 6; why.push(`ücret sonrası R/R ${netRR.toFixed(2)}`); }
  const score = Math.round(clip(50 + 50*raw - pen, 0, 100)), g = cfg.g, grade = score >= g.strong ? "strong" : score >= g.medium ? "medium" : score >= g.weak ? "weak" : null;
  const parts = Object.keys(cfg.W).filter(k => fin(ev.E[k])).map(k => ({ k, v: ev.E[k] })).sort((a, z) => Math.abs(z.v)*cfg.W[z.k] - Math.abs(a.v)*cfg.W[a.k]);
  return Object.assign(P, { strat: P.kind, name: STRAT[P.kind], score, raw, grade: blocks.length ? null : grade, blocked: blocks.length > 0, blocks, warn: ev.warn.concat(why), E: ev.E, parts, rv: ev.rv, noDer: !fin(ev.E.der) }); }
/* ---------- one bar: all candidates (shown ≥ minShow, the rest listed as rejected with reasons) ---------- */
const RANK = { strong: 3, medium: 2, weak: 1 };
function evalAt(F, i, cfg = DEF, o = {}){ const b = F.b, Q = o.dq || { s: 100, why: [], ok: true }, R = regime(F, i, cfg), res = { i, t: b[i] && b[i].t, regime: R, dq: Q, cands: [], rejected: [], best: null };
  if (!Q.ok){ res.hard = "veri kalitesi düşük: " + Q.why.join(", "); return res; } if (R.k === "UNKNOWN"){ res.hard = "rejim bilinmiyor (veri yetersiz)"; return res; }
  const min = RANK[cfg.minShow] || 2;
  for (const P of triggers(F, i, cfg)){ const J = judge(F, i, P, R, cfg, o.live, o.cost || COST);
    if (J.blocked) res.rejected.push(Object.assign(J, { reason: "ENGEL: " + J.blocks.join(", ") }));
    else if (!J.grade) res.rejected.push(Object.assign(J, { reason: `zayıf kanıt (teknik güven ${J.score} < ${cfg.g.weak})` }));
    else if (RANK[J.grade] < min) res.rejected.push(Object.assign(J, { reason: `${GRADE[J.grade]} — gösterim eşiğinin altında (${GRADE[cfg.minShow]}+)` }));
    else res.cands.push(J); }
  res.cands.sort((a, z) => z.score - a.score); res.best = res.cands[0] || null;
  if (res.best && res.cands.some(c => c.d === -res.best.d && c.score >= res.best.score - 5)){ res.conflict = true; } return res; }
/* ---------- outcome (SL first on a same-bar touch; timeout at maxB; costs incl. stop slippage + funding) ---------- */
function resolve(b, i, P, tms, C = COST){ const d = P.d, e = P.entry; for (let j = i + 1; j <= Math.min(b.length - 1, i + P.maxB); j++){ const x = b[j]; if (x.x === false) return null;
    if (d > 0 ? x.l <= P.stop : x.h >= P.stop){ const g = d*(P.stop - e)/e*100, c = costPct({ stop: true, holdMs: (j - i)*tms }, C); return out("SL", g, c, j); }
    if (d > 0 ? x.h >= P.tp : x.l <= P.tp){ const g = d*(P.tp - e)/e*100, c = costPct({ holdMs: (j - i)*tms }, C); return out("TP", g, c, j); } }
  if (i + P.maxB > b.length - 1) return null; const j = i + P.maxB, g = d*(b[j].c - e)/e*100, c = costPct({ holdMs: P.maxB*tms }, C); return out(g - c > 0 ? "T+" : "T−", g, c, j);
  function out(r, g, c, j){ const net = g - c; return { r, gross: g, cost: c, net, R: net/P.riskP, j, bars: j - i }; } }
/* ---------- statistics (R per trade = net % / initial stop %) ---------- */
function stats(T){ const n = T.length; if (!n) return { n: 0 }; const R = T.map(t => t.R), P = T.map(t => t.net), w = T.filter(t => t.net > 0).length, sum = a => a.reduce((s, x) => s + x, 0);
  const gw = sum(R.filter(x => x > 0)), gl = -sum(R.filter(x => x < 0)); let eq = 0, pk = 0, dd = 0, cl = 0, mcl = 0; for (const t of T.slice().sort((a, z) => a.t - z.t)){ eq += t.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); if (t.net <= 0){ cl++; mcl = Math.max(mcl, cl); } else cl = 0; }
  const m = sum(R)/n, sd = Math.sqrt(sum(R.map(x => (x - m)**2))/Math.max(1, n - 1)), dn = Math.sqrt(sum(R.map(x => Math.min(0, x)**2))/n);
  return { n, win: w/n, expR: m, expP: sum(P)/n, sumR: sum(R), pf: gl ? gw/gl : (gw ? Infinity : null), maxDD: dd, sharpe: sd ? m/sd : null, sortino: dn ? m/dn : null, maxLoseStreak: mcl,
    tp: T.filter(t => t.r === "TP").length, sl: T.filter(t => t.r === "SL").length, to: T.filter(t => t.r === "T+" || t.r === "T−").length, false: T.filter(t => t.net <= 0).length }; }
/* ---------- frequency tracker (pure; caller persists) ---------- */
function freqAdd(st, sym, tf, grade, t, keepMs = 7*864e5){ st = st || {}; const k = sym + "|" + tf, a = (st[k] = st[k] || []); if (!a.length || a[a.length - 1].t !== t) a.push({ t, g: grade }); while (a.length && t - a[0].t > keepMs) a.shift(); return st; }
function freqOf(st, sym, tf, now, ms = 864e5){ const a = (st && st[sym + "|" + tf]) || []; const r = a.filter(x => now - x.t <= ms); return { n: r.length, strong: r.filter(x => x.g === "strong").length, medium: r.filter(x => x.g === "medium").length, weak: r.filter(x => x.g === "weak").length }; }
/* measured, not live: docs/BACKTEST_REPORT.md — 40 Binance USDT perps, 15m, out-of-sample 2026-08-21 → 2026-11-19 (90 days), costs above, one open trade per coin+strategy */
const BT = { span: "15dk · 40 coin · 90 gün örneklem dışı", note: "Geçmiş testte (40 coin, 15dk, 90 gün, ücret+spread+kayma dahil) hiçbir sınıf kârlı çıkmadı; walk-forward ayarında eğitim dönemlerinde kârlı ayar bulunamadı. Eski motordan ölçülebilir şekilde iyi değil.",
  grades: { strong: { n: 13170, win: 0.376, expR: -0.122 }, medium: { n: 8492, win: 0.362, expR: -0.197 }, weak: { n: 7710, win: 0.370, expR: -0.213 } } };
return { BT, COST, costPct, DEF, W0, STRAT, GRADE, dq, prep, regime, triggers, evidence, judge, evalAt, resolve, stats, freqAdd, freqOf, atT };
});
