/* MERMER PRO — analysis core (pure; shared 1:1 by the app and by tools/pro backtests so live == tested).
   prepare(m15, opt) computes every series ONCE from CLOSED 15m bars (1h/4h are resampled from them, only complete buckets);
   evalAt(P, i) reads only values at indices ≤ i (bar i = last closed bar) → families, regime, strategy candidates, rejections.
   simTrade() resolves a signal against LATER bars (stop first on ambiguous bars, gaps fill at the open, fees + spread/slippage + funding).
   Nothing here places orders. */
"use strict";
(function (root, f){ const M = f(typeof module === "object" && module.exports ? require("./ind.js") : root.MPI); if (typeof module === "object" && module.exports) module.exports = M; else root.MPC = M; })(typeof self !== "undefined" ? self : this, function (I){
const M15 = 900000, H1 = 3600000, H4 = 14400000, N = null, fin = x => typeof x === "number" && isFinite(x), sgn = x => x > 0 ? 1 : x < 0 ? -1 : 0;
const P0 = { atrN: 14, rankW: 960, liqMin: 20e6, adxTrend: 25, adxRange: 20, hiVolRank: 0.95, timeout: 32, pbAtr: 0.3, pbBars: 4, minStopAtr: 0.6, maxStopAtr: 3.0, frHot: 0.0003, frCold: -0.0001 };
/* cost model: taker fee per side, maker fee for limit fills, spread+slippage per side by 24h quote volume tier; stops slip 2× */
const COST = { taker: 0.0005, maker: 0.0002, stopX: 2 };
function slipFor(qv24){ return !fin(qv24) ? 0.001 : qv24 >= 5e8 ? 0.0001 : qv24 >= 1e8 ? 0.0002 : qv24 >= 2e7 ? 0.0005 : 0.001; }

function prepare(b, opt = {}){
  const o = Object.assign({}, P0, opt), n = b.length, c = b.map(x => x.c);
  const atr = I.atr(b, o.atrN), rsi = I.rsi(c), md = I.macd(c), e20 = I.ema(c, 20), e50 = I.ema(c, 50), bb = I.boll(c, 20, 2), vw = I.vwap(b), ob = I.obv(b), dl = I.delta(b);
  const qv = b.map(x => x.qv), tb = b.map(x => x.tb), qv24 = I.rsum(qv, 96), qv4 = I.rsum(qv, 4), tb4 = I.rsum(tb, 4);
  const d4 = qv4.map((s, i) => s ? (2*tb4[i] - s)/s : N);
  const vr = qv.map((x, i) => { if (i < 96) return N; const m = (qv24[i - 1] || 0)/96; return m > 0 ? x/m : N; });
  const atrp = atr.map((a, i) => a === N ? N : a/c[i]), atrRank = I.prank(atrp, o.rankW), bbwRank = I.prank(bb.width, o.rankW);
  const dc = I.donch(b, 48), sw = I.swings(b, 3);
  // incremental market structure (only pivots confirmed at ≤ i)
  const stT = new Array(n).fill(0), stH = new Array(n).fill(N), stL = new Array(n).fill(N), stBos = new Array(n).fill(0), stLab = new Array(n).fill("—");
  { const H = [], L = []; let k = 0; for (let i = 0; i < n; i++){ while (k < sw.length && sw[k].at <= i){ (sw[k].kind === "H" ? H : L).push(sw[k].px); k++; }
      if (H.length) stH[i] = H[H.length - 1]; if (L.length) stL[i] = L[L.length - 1];
      if (H.length >= 2 && L.length >= 2){ const h1 = H[H.length - 1], h0 = H[H.length - 2], l1 = L[L.length - 1], l0 = L[L.length - 2];
        stT[i] = h1 > h0 && l1 > l0 ? 1 : h1 < h0 && l1 < l0 ? -1 : 0; stLab[i] = (h1 > h0 ? "HH" : "LH") + "/" + (l1 > l0 ? "HL" : "LL");
        const pc = i ? c[i - 1] : c[i]; stBos[i] = c[i] > h1 && pc <= h1 ? 1 : c[i] < l1 && pc >= l1 ? -1 : 0; } } }
  const h1 = I.resample(b, H1), h4 = I.resample(b, H4), a1 = I.alignIdx(b, M15, h1, H1), a4 = I.alignIdx(b, M15, h4, H4);
  const c1 = h1.map(x => x.c), c4 = h4.map(x => x.c);
  const H = { e50: I.ema(c1, 50), e200: I.ema(c1, 200), adx: I.adx(h1, 14), rsi: I.rsi(c1) }, F = { e20: I.ema(c4, 20), e50: I.ema(c4, 50) };
  const obS = ob.map((x, i) => i >= 16 ? x - ob[i - 16] : N);
  return { b, o, n, c, atr, atrp, rsi, md, e20, e50, bb, vw, dl, d4, vr, qv24, atrRank, bbwRank, dc, obS, stT, stH, stL, stBos, stLab, h1, h4, a1, a4, H, F, fr: opt.fr || [], oi: opt.oi || null };
}
const frAt = (fr, T) => { let lo = 0, hi = fr.length - 1, r = -1; while (lo <= hi){ const m = (lo + hi) >> 1; if (fr[m][0] <= T){ r = m; lo = m + 1; } else hi = m - 1; } return r >= 0 ? fr[r][1] : N; };
/* evidence families — correlated indicators grouped, each family counted ONCE */
function families(P, i){
  const j = P.a1[i], k = P.a4[i], c = P.c[i], out = {};
  const v = (x, a, bnd = 0) => x === N || a === N ? 0 : x > a + bnd ? 1 : x < a - bnd ? -1 : 0;
  const ax = j >= 0 ? P.H.adx.adx[j] : N, di = j >= 0 && P.H.adx.pdi[j] !== N ? sgn(P.H.adx.pdi[j] - P.H.adx.mdi[j]) : 0;
  const tv = [k >= 0 ? v(P.F.e20[k], P.F.e50[k]) : 0, k >= 0 ? v(P.h4[k].c, P.F.e50[k]) : 0, j >= 0 ? v(P.H.e50[j], P.H.e200[j]) : 0, ax !== N && ax >= 20 ? di : 0];
  const ts = tv.reduce((s, x) => s + x, 0); out.trend = { d: Math.abs(ts) >= 2 ? sgn(ts) : 0, s: ts/4, parts: tv, adx1h: ax };
  const hs = P.md.hist[i], hp = i ? P.md.hist[i - 1] : N, r1 = j >= 0 ? P.H.rsi[j] : N;
  const mv = [P.rsi[i] === N ? 0 : P.rsi[i] > 55 ? 1 : P.rsi[i] < 45 ? -1 : 0, hs === N || hp === N ? 0 : hs > 0 && hs > hp ? 1 : hs < 0 && hs < hp ? -1 : 0, r1 === N ? 0 : r1 > 55 ? 1 : r1 < 45 ? -1 : 0];
  const ms = mv.reduce((s, x) => s + x, 0); out.mom = { d: Math.abs(ms) >= 2 ? sgn(ms) : 0, s: ms/3, parts: mv, rsi15: P.rsi[i], rsi1h: r1 };
  const fv = [P.d4[i] === N ? 0 : P.d4[i] > 0.05 ? 1 : P.d4[i] < -0.05 ? -1 : 0, P.obS[i] === N ? 0 : sgn(P.obS[i]), v(c, P.vw[i])];
  const fs = fv.reduce((s, x) => s + x, 0); out.flow = { d: Math.abs(fs) >= 2 ? sgn(fs) : 0, s: fs/3, parts: fv, delta4: P.d4[i], vr: P.vr[i] };
  const fr = frAt(P.fr, P.b[i].t + M15);
  out.pos = { d: fr === N ? 0 : fr >= P.o.frHot ? -1 : fr <= P.o.frCold ? 1 : 0, fr, note: "fonlama kalabalığına karşı (kontra)" };
  out.str = { d: P.stT[i], bos: P.stBos[i], label: P.stLab[i], lastH: P.stH[i], lastL: P.stL[i] };
  out.vol = { atrp: P.atrp[i], atrRank: P.atrRank[i], bbwRank: P.bbwRank[i] };
  return out;
}
function regime(P, i, fam){
  const x = P.b[i], a = P.atr[i];
  if (a === N || P.atrRank[i] === N) return { r: "VERİ AZ", ok: false };
  if (!(x.qv > 0) || (x.h - x.l) > 6*a || (i && P.b[i].t - P.b[i - 1].t !== M15)) return { r: "ANORMAL", ok: false, why: "aşırı mum / veri boşluğu" };
  if (!(P.qv24[i] >= P.o.liqMin)) return { r: "DÜŞÜK LİKİDİTE", ok: false, why: "24s hacim < $" + (P.o.liqMin/1e6) + "M" };
  if (P.atrRank[i] >= P.o.hiVolRank) return { r: "YÜKSEK VOL", ok: true };
  const ax = fam.trend.adx1h;
  if (ax !== N && ax >= P.o.adxTrend && fam.trend.d !== 0) return { r: "TREND", ok: true, d: fam.trend.d };
  if (ax !== N && ax < P.o.adxRange && P.bbwRank[i] !== N && P.bbwRank[i] < 0.6) return { r: "YATAY", ok: true };
  return { r: "GEÇİŞ", ok: true };
}
/* pre-registered strategies (fixed parameters, symmetric long/short). Each returns {dir, stop, why} or {rej}. */
const STRATS = {
  TPB: { name: "Trend geri çekilme", regimes: ["TREND"], fn(P, i, f, rg){ const d = rg.d, a = P.atr[i], b = P.b, c = P.c[i];
      if (f.mom.d === -d) return { rej: "momentum trende ters" };
      let touch = false, rmin = 100, rmax = 0; for (let k = i - 3; k <= i; k++){ if (k < 1) continue; if (d > 0 ? b[k].l <= P.e20[k] + 0.25*a : b[k].h >= P.e20[k] - 0.25*a) touch = true; }
      for (let k = i - 5; k <= i; k++){ const r = P.rsi[k]; if (r === N) continue; rmin = Math.min(rmin, r); rmax = Math.max(rmax, r); }
      if (!touch) return N; if (d > 0 ? !(rmin < 48) : !(rmax > 52)) return N;
      if (d > 0 ? !(c > P.e20[i] && c > b[i - 1].h && P.rsi[i] > P.rsi[i - 1]) : !(c < P.e20[i] && c < b[i - 1].l && P.rsi[i] < P.rsi[i - 1])) return N;
      let ext = d > 0 ? Infinity : -Infinity; for (let k = i - 5; k <= i; k++) ext = d > 0 ? Math.min(ext, b[k].l) : Math.max(ext, b[k].h);
      return { dir: d, stop: ext - d*0.25*a, why: ["1s/4s trend " + (d > 0 ? "yukarı" : "aşağı") + ", ADX " + (f.trend.adx1h || 0).toFixed(0), "EMA20'ye geri çekilme + RSI sıfırlandı", "tetik: önceki mum " + (d > 0 ? "tepesi" : "dibi") + " kırıldı"] }; } },
  RREV: { name: "Yatay bant dönüşü", regimes: ["YATAY"], fn(P, i, f){ const b = P.b, a = P.atr[i], c = P.c[i], bb = P.bb;
      let dir = 0; const out = k => bb.lo[k] !== N && b[k].c < bb.lo[k] ? 1 : bb.up[k] !== N && b[k].c > bb.up[k] ? -1 : 0;
      const o1 = out(i - 1) || out(i - 2); if (!o1) return N;
      if (o1 > 0 && c > bb.lo[i] && c > b[i].o) dir = 1; else if (o1 < 0 && c < bb.up[i] && c < b[i].o) dir = -1; else return N;
      const rx = Math.min(P.rsi[i - 1] ?? 50, P.rsi[i - 2] ?? 50), ry = Math.max(P.rsi[i - 1] ?? 50, P.rsi[i - 2] ?? 50);
      if (dir > 0 ? !(rx < 32) : !(ry > 68)) return { rej: "RSI aşırılık yok" };
      let ext = dir > 0 ? Infinity : -Infinity; for (let k = i - 2; k <= i; k++) ext = dir > 0 ? Math.min(ext, b[k].l) : Math.max(ext, b[k].h);
      const stop = ext - dir*0.3*a, R = Math.abs(c - stop); if (Math.abs(bb.mid[i] - c) < R) return { rej: "orta banda mesafe < 1R" };
      return { dir, stop, why: ["ADX düşük, bant dar (yatay rejim)", "Bollinger dışına taşma sonrası içeri kapanış", "RSI aşırı " + (dir > 0 ? "satım" : "alım") + " sonrası dönüş"] }; } },
  BRK: { name: "Sıkışma kırılımı", regimes: ["GEÇİŞ", "TREND"], fn(P, i, f){ const b = P.b, a = P.atr[i], c = P.c[i], x = b[i];
      if (!(P.bbwRank[i - 1] !== N && P.bbwRank[i - 1] < 0.25)) return N;
      const dir = c > P.dc.hi[i] ? 1 : c < P.dc.lo[i] ? -1 : 0; if (!dir) return N;
      const pos = (c - x.l)/((x.h - x.l) || 1e-12); if (dir > 0 ? pos < 0.7 : pos > 0.3) return { rej: "kapanış mum ucunda değil" };
      if (!(P.vr[i] >= 1.8)) return { rej: "hacim zayıf (<1.8×)" }; if (dir*P.dl[i] < 0.1) return { rej: "taker akışı onaylamıyor" };
      if (f.trend.d === -dir) return { rej: "üst zaman dilimi trendi ters" };
      const stop = dir > 0 ? Math.min(x.l - 0.1*a, c - 1.2*a) : Math.max(x.h + 0.1*a, c + 1.2*a);
      return { dir, stop, why: ["Bollinger sıkışması (genişlik alt %25)", "48 mum " + (dir > 0 ? "tepesi" : "dibi") + " kapanışla kırıldı", "hacim " + P.vr[i].toFixed(1) + "×, taker " + (P.dl[i]*100).toFixed(0) + "%"] }; } },
  SWP: { name: "Likidite süpürme dönüşü", regimes: ["TREND", "YATAY", "GEÇİŞ", "YÜKSEK VOL"], fn(P, i, f){ const b = P.b, a = P.atr[i], x = b[i], rg = (x.h - x.l) || 1e-12;
      const lo = P.dc.lo[i], hi = P.dc.hi[i]; let dir = 0;
      if (x.l < lo - 0.1*a && x.c > lo && (Math.min(x.o, x.c) - x.l)/rg >= 0.5) dir = 1; else if (x.h > hi + 0.1*a && x.c < hi && (x.h - Math.max(x.o, x.c))/rg >= 0.5) dir = -1; else return N;
      if (!(P.vr[i] >= 1.5)) return { rej: "süpürmede hacim yok" };
      return { dir, stop: dir > 0 ? x.l - 0.2*a : x.h + 0.2*a, why: ["48 mum " + (dir > 0 ? "dibinin altı" : "tepesinin üstü") + " süpürüldü, geri içeri kapandı (sahte kırılım)", "uzun fitil " + (dir > 0 ? "alt" : "üst"), "hacim " + P.vr[i].toFixed(1) + "×"] }; } } };
const SKEYS = Object.keys(STRATS);
function costRT(P, i){ const s = slipFor(P.qv24[i]); return 2*(COST.taker + s); }
/* full evaluation at bar i → { fam, rg, cands:[{key,dir,entry,stop,tp1,tp2,R,rr,why,inv}], rej:[{key,why}] } */
function evalAt(P, i, only){
  const fam = families(P, i), rg = regime(P, i, fam), cands = [], rej = [];
  if (i < 60 || !rg.ok){ return { fam, rg, cands, rej: rg.ok ? rej : [{ key: "*", why: "rejim: " + rg.r + (rg.why ? " (" + rg.why + ")" : "") }] }; }
  for (const k of (only || SKEYS)){ const S = STRATS[k];
    if (!S.regimes.includes(rg.r)) continue;
    const r = S.fn(P, i, fam, rg); if (!r) continue; if (r.rej){ rej.push({ key: k, why: r.rej }); continue; }
    const a = P.atr[i], c = P.c[i], R = Math.abs(c - r.stop), ra = R/a;
    if (ra < P.o.minStopAtr){ rej.push({ key: k, why: "stop çok dar (" + ra.toFixed(2) + " ATR)" }); continue; }
    if (ra > P.o.maxStopAtr){ rej.push({ key: k, why: "stop çok geniş (" + ra.toFixed(2) + " ATR)" }); continue; }
    if (R/c < 3*costRT(P, i)){ rej.push({ key: k, why: "stop mesafesi maliyetin 3 katından az" }); continue; }
    const fc = ["trend", "mom", "flow", "pos", "str"].map(x => ({ f: x, d: fam[x].d })), pro = fc.filter(x => x.d === r.dir).length, con = fc.filter(x => x.d === -r.dir).length;
    cands.push({ key: k, name: S.name, dir: r.dir, entry: c, stop: r.stop, tp1: c + r.dir*R, tp2: c + r.dir*2*R, R, rr: 2, why: r.why, pro, con,
      inv: (r.dir > 0 ? "15dk kapanış " : "15dk kapanış ") + (r.dir > 0 ? "< " : "> ") + r.stop.toPrecision(6) + " veya " + P.o.timeout*15/60 + " saat içinde hedef yok" });
  }
  return { fam, rg, cands, rej };
}
/* resolve a signal made at the CLOSE of bar i against bars i+1… (mode "MKT" = next open, "PB" = limit pullback). Returns null if never filled. */
function simTrade(P, i, s, mode = "MKT", fr){
  const b = P.b, n = b.length, d = s.dir, sl = slipFor(P.qv24[i]), a = P.atr[i];
  let e = N, ej = -1, feeIn;
  if (mode === "MKT"){ if (i + 1 >= n) return N; const x = b[i + 1]; if (d > 0 ? x.o <= s.stop : x.o >= s.stop) return { fill: false, why: "açılışta stop geçildi" }; e = x.o*(1 + d*sl); ej = i + 1; feeIn = COST.taker; }
  else { const lim = s.entry - d*P.o.pbAtr*a; feeIn = COST.maker;
    for (let j = i + 1; j <= Math.min(n - 1, i + P.o.pbBars); j++){ const x = b[j];
      if (d > 0 ? x.o <= s.stop : x.o >= s.stop) return { fill: false, why: "dolmadan geçersiz" };
      if (d > 0 ? x.o <= lim : x.o >= lim){ e = x.o; ej = j; break; }
      if (d > 0 ? x.l < lim : x.h > lim){ e = lim; ej = j; break; }
      if (d > 0 ? x.l <= s.stop : x.h >= s.stop) return { fill: false, why: "dolmadan geçersiz" }; }
    if (e === N) return ej < 0 && i + P.o.pbBars >= n ? N : { fill: false, why: "limit dolmadı" }; }
  const R = d*(e - s.stop); if (!(R > 0)) return { fill: false, why: "giriş stopun ötesinde" };
  const tp1 = e + d*R, tp2 = e + d*2*R; let rem = 1, stop = s.stop, pnl = 0, fees = feeIn, out = "TO", xj = -1, hit1 = false;
  const ex = (px, part, slip) => { const p = px*(1 - d*slip); pnl += part*d*(p - e)/e; fees += part*COST.taker; rem -= part; };
  const last = Math.min(n - 1, ej + P.o.timeout);
  for (let j = ej; j <= last; j++){ const x = b[j], first = j === ej;
    if (!first || mode === "MKT"){ if (d > 0 ? x.o <= stop : x.o >= stop){ ex(x.o, rem, sl*COST.stopX); out = hit1 ? "TP1+BE" : "SL"; xj = j; break; } }
    if (d > 0 ? x.l <= stop : x.h >= stop){ ex(stop, rem, sl*COST.stopX); out = hit1 ? "TP1+BE" : "SL"; xj = j; break; }
    if (!(first && mode === "PB")){                      // fill bar of a limit: only the stop is checked (conservative)
      if (!hit1 && (d > 0 ? x.h >= tp1 : x.l <= tp1)){ ex(tp1, 0.5, 0); hit1 = true; stop = e + d*e*(COST.taker*2 + sl); }
      if (hit1 && (d > 0 ? x.h >= tp2 : x.l <= tp2)){ ex(tp2, rem, 0); out = "TP2"; xj = j; break; } }
    if (j === last){ if (last < ej + P.o.timeout && last === n - 1) return { fill: true, open: true, entry: e, ej, R, tp1, tp2, hit1 }; ex(x.c, rem, sl); out = hit1 ? "TP1+TO" : "TO"; xj = j; }
  }
  let fund = 0; const F = fr || P.fr, t0 = b[ej].t, t1 = b[xj].t + M15;
  if (F && F.length) for (const [t, r] of F) if (t > t0 && t <= t1) fund += d*r;   // conservative: full size pays/receives funding until the final exit
  const Rf = R/e, net = pnl - fees - fund;
  return { fill: true, open: false, dir: d, entry: e, ej, xj, R, Rf, out, grossR: pnl/Rf, netR: net/Rf, feesR: fees/Rf, fundR: fund/Rf, bars: xj - ej + 1, t0, t1 };
}
/* ---------- risk engine ---------- */
const RISK0 = { riskPct: 0.01, maxLev: 5, marginPct: 0.5, mmr: 0.005, dailyLoss: 0.03, maxConsec: 3, coolMs: 12*H1, maxOpen: 2, minNotional: 5 };
function size(o){ const c = Object.assign({}, RISK0, o), out = { ok: true, why: [] };
  const dist = Math.abs(c.entry - c.stop), fd = dist/c.entry; if (!(dist > 0)){ return { ok: false, why: ["stop yok / girişe eşit"] }; }
  let riskUsd = c.balance*c.riskPct, notional = riskUsd/fd, lev = Math.max(1, Math.ceil(notional/(c.balance*c.marginPct)));
  if (lev > c.maxLev){ lev = c.maxLev; notional = c.balance*c.marginPct*lev; riskUsd = notional*fd; out.why.push("kaldıraç tavanı: risk " + (riskUsd/c.balance*100).toFixed(2) + "% a düşürüldü"); }
  const liqD = 1/lev - c.mmr, liq = c.entry*(1 - Math.sign(c.entry - c.stop)*liqD);
  if (fd >= 0.8*liqD){ out.ok = false; out.why.push("stop likidasyon mesafesine çok yakın"); }
  if (notional < c.minNotional){ out.ok = false; out.why.push("pozisyon çok küçük (< $" + c.minNotional + ")"); }
  return Object.assign(out, { qty: notional/c.entry, notional, lev, margin: notional/lev, riskUsd, riskPct: riskUsd/c.balance, liq, stopPct: fd }); }
/* guard: may a NEW trade open now? st = {dayStart, balance, day, consec, coolUntil, open, kill} */
function guard(st, now, o = {}){ const c = Object.assign({}, RISK0, o), why = [];
  if (st.kill) why.push("ACİL DURDURMA açık"); if (st.coolUntil && now < st.coolUntil) why.push("art arda " + c.maxConsec + " kayıp → soğuma");
  if (st.dayStart && (st.balance - st.dayStart)/st.dayStart <= -c.dailyLoss) why.push("günlük zarar limiti (" + (c.dailyLoss*100) + "%)");
  if ((st.open || 0) >= c.maxOpen) why.push("açık pozisyon sınırı (" + c.maxOpen + ")");
  return { ok: !why.length, why }; }
function afterClose(st, netUsd, now, o = {}){ const c = Object.assign({}, RISK0, o); st.balance += netUsd; st.consec = netUsd < 0 ? (st.consec || 0) + 1 : 0; if (st.consec >= c.maxConsec){ st.coolUntil = now + c.coolMs; st.consec = 0; } return st; }
/* chronological portfolio replay of resolved trades [{sym,t,t1,netR}] through the risk guard: 1 % risk of CURRENT equity (no size-up after losses),
   max open, daily loss limit, consecutive-loss cooldown, kill switch. Returns equity path summary. */
function portfolio(L, o = {}){ const c = Object.assign({}, RISK0, o), ev = L.slice().sort((a, b) => a.t - b.t), S = { balance: c.start || 1000, dayStart: c.start || 1000, consec: 0, coolUntil: 0, open: 0, kill: !!c.kill };
  let pk = S.balance, dd = 0, open = [], day = -1, taken = 0, skipped = 0; const curve = [[ev.length ? ev[0].t : 0, S.balance]];
  const closeUpTo = T0 => { open.sort((a, b) => a.t1 - b.t1); while (open.length && open[0].t1 <= T0){ const x = open.shift(); afterClose(S, x.risk*x.netR, x.t1, c); pk = Math.max(pk, S.balance); dd = Math.max(dd, (pk - S.balance)/pk); curve.push([x.t1, S.balance]); } };
  for (const t of ev){ closeUpTo(t.t); const d = Math.floor(t.t/864e5); if (d !== day){ day = d; S.dayStart = S.balance; }
    S.open = open.length; if (!guard(S, t.t, c).ok || open.some(x => x.sym === t.sym)){ skipped++; continue; } open.push(Object.assign({}, t, { risk: S.balance*c.riskPct })); taken++; }
  closeUpTo(Infinity); return { start: c.start || 1000, end: S.balance, maxDD: dd, taken, skipped, curve, consec: S.consec, coolUntil: S.coolUntil }; }
/* ---------- statistics ---------- */
function stats(tr, opt = {}){ const B = opt.boot || 2000, rp = opt.riskPct || 0.01; const n = tr.length; if (!n) return { n: 0 };
  const R = tr.map(t => t.netR), w = R.filter(x => x > 0), l = R.filter(x => x <= 0), sum = R.reduce((s, x) => s + x, 0);
  const pf = l.length ? w.reduce((s, x) => s + x, 0)/Math.abs(l.reduce((s, x) => s + x, 0) || 1e-12) : Infinity;
  const so = tr.slice().sort((a, b) => a.t1 - b.t1); let eq = 0, pk = 0, dd = 0; for (const t of so){ eq += t.netR*rp; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  const day = new Map(); for (const t of tr){ const d = Math.floor(t.t1/864e5); day.set(d, (day.get(d) || 0) + t.netR*rp); }
  const d0 = Math.min(...day.keys()), d1 = Math.max(...day.keys()), dr = []; for (let d = d0; d <= d1; d++) dr.push(day.get(d) || 0);
  const mu = dr.reduce((s, x) => s + x, 0)/dr.length, sd = Math.sqrt(dr.reduce((s, x) => s + (x - mu)**2, 0)/Math.max(1, dr.length - 1));
  // day-cluster bootstrap of mean R
  const cl = new Map(); for (const t of tr){ const d = Math.floor(t.t1/864e5); const v = cl.get(d) || [0, 0]; v[0] += t.netR; v[1]++; cl.set(d, v); }
  const C = [...cl.values()], rnd = opt.rng || Math.random, ms = [];
  for (let k = 0; k < B; k++){ let s = 0, m = 0; for (let q = 0; q < C.length; q++){ const v = C[Math.floor(rnd()*C.length)]; s += v[0]; m += v[1]; } ms.push(m ? s/m : 0); }
  ms.sort((a, b) => a - b);
  return { n, win: w.length/n, exp: sum/n, sumR: sum, pf, maxDD: dd, sharpe: sd > 0 ? mu/sd*Math.sqrt(365) : 0, ciLo: ms[Math.floor(0.025*B)], ciHi: ms[Math.floor(0.975*B)], days: dr.length,
    gross: tr.reduce((s, t) => s + t.grossR, 0)/n, fees: tr.reduce((s, t) => s + t.feesR, 0)/n, fund: tr.reduce((s, t) => s + t.fundR, 0)/n }; }
function rng(seed){ let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s/4294967296; }; }
return { P0, COST, slipFor, prepare, families, regime, STRATS, SKEYS, evalAt, simTrade, costRT, RISK0, size, guard, afterClose, portfolio, stats, rng, frAt, M15 };
});
