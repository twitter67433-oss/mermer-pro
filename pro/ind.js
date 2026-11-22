/* MERMER PRO — indicator library (pure, causal: value[i] uses bars[0..i] only; nothing here reads the future).
   bars: [{t (open ms), o, h, l, c, v (base vol), qv (quote vol), tb (taker-buy quote vol)}] oldest → newest, CLOSED candles only.
   Conventions match TradingView/Binance defaults: EMA seeded with SMA, RSI/ATR/ADX Wilder (RMA), Bollinger population SD, VWAP anchored 00:00 UTC. */
"use strict";
(function (root, f){ const M = f(); if (typeof module === "object" && module.exports) module.exports = M; else root.MPI = M; })(typeof self !== "undefined" ? self : this, function (){
const N = null, fin = x => typeof x === "number" && isFinite(x);
function sma(v, n){ const o = new Array(v.length).fill(N); let s = 0; for (let i = 0; i < v.length; i++){ s += v[i]; if (i >= n) s -= v[i - n]; if (i >= n - 1) o[i] = s/n; } return o; }
function ema(v, n){ const o = new Array(v.length).fill(N), k = 2/(n + 1); let e = N, s = 0;
  for (let i = 0; i < v.length; i++){ if (e === N){ s += v[i]; if (i === n - 1){ e = s/n; o[i] = e; } } else { e = v[i]*k + e*(1 - k); o[i] = e; } } return o; }
function rma(v, n, start = 0){ const o = new Array(v.length).fill(N); let a = N, s = 0, c = 0;
  for (let i = start; i < v.length; i++){ if (a === N){ s += v[i]; c++; if (c === n){ a = s/n; o[i] = a; } } else { a = (a*(n - 1) + v[i])/n; o[i] = a; } } return o; }
function tr(b){ return b.map((x, i) => i ? Math.max(x.h - x.l, Math.abs(x.h - b[i - 1].c), Math.abs(x.l - b[i - 1].c)) : x.h - x.l); }
function atr(b, n = 14){ return rma(tr(b), n); }
function rsi(c, n = 14){ const g = c.map((x, i) => i ? Math.max(x - c[i - 1], 0) : 0), l = c.map((x, i) => i ? Math.max(c[i - 1] - x, 0) : 0);
  const ag = rma(g, n, 1), al = rma(l, n, 1); return c.map((_, i) => ag[i] === N ? N : al[i] === 0 ? (ag[i] === 0 ? 50 : 100) : 100 - 100/(1 + ag[i]/al[i])); }
function macd(c, f = 12, s = 26, g = 9){ const ef = ema(c, f), es = ema(c, s), m = c.map((_, i) => ef[i] === N || es[i] === N ? N : ef[i] - es[i]);
  const st = m.findIndex(x => x !== N), sig = new Array(c.length).fill(N); if (st >= 0){ const e = ema(m.slice(st), g); for (let i = 0; i < e.length; i++) sig[st + i] = e[i]; }
  return { macd: m, signal: sig, hist: m.map((x, i) => x === N || sig[i] === N ? N : x - sig[i]) }; }
function adx(b, n = 14){ const L = b.length, up = new Array(L).fill(0), dn = new Array(L).fill(0), T = tr(b);
  for (let i = 1; i < L; i++){ const u = b[i].h - b[i - 1].h, d = b[i - 1].l - b[i].l; up[i] = u > d && u > 0 ? u : 0; dn[i] = d > u && d > 0 ? d : 0; }
  const st = rma(T, n, 1), sp = rma(up, n, 1), sm = rma(dn, n, 1), pdi = new Array(L).fill(N), mdi = new Array(L).fill(N), dx = new Array(L).fill(N);
  for (let i = 0; i < L; i++) if (st[i] !== N && st[i] > 0){ pdi[i] = 100*sp[i]/st[i]; mdi[i] = 100*sm[i]/st[i]; const s = pdi[i] + mdi[i]; dx[i] = s ? 100*Math.abs(pdi[i] - mdi[i])/s : 0; }
  const f = dx.findIndex(x => x !== N), ax = new Array(L).fill(N); if (f >= 0){ const r = rma(dx.slice(f), n); for (let i = 0; i < r.length; i++) ax[f + i] = r[i]; }
  return { adx: ax, pdi, mdi }; }
function boll(c, n = 20, k = 2){ const m = sma(c, n), up = new Array(c.length).fill(N), lo = new Array(c.length).fill(N), w = new Array(c.length).fill(N), pb = new Array(c.length).fill(N);
  for (let i = n - 1; i < c.length; i++){ let s = 0; for (let j = i - n + 1; j <= i; j++) s += (c[j] - m[i])**2; const sd = Math.sqrt(s/n); up[i] = m[i] + k*sd; lo[i] = m[i] - k*sd; w[i] = m[i] ? (up[i] - lo[i])/m[i] : N; pb[i] = up[i] > lo[i] ? (c[i] - lo[i])/(up[i] - lo[i]) : 0.5; }
  return { mid: m, up, lo, width: w, pctb: pb }; }
function obv(b){ let s = 0; return b.map((x, i) => { if (i) s += x.c > b[i - 1].c ? x.v : x.c < b[i - 1].c ? -x.v : 0; return s; }); }
function vwap(b){ const o = []; let day = N, pv = 0, vv = 0; for (const x of b){ const d = Math.floor(x.t/864e5); if (d !== day){ day = d; pv = 0; vv = 0; } pv += (x.h + x.l + x.c)/3*x.v; vv += x.v; o.push(vv ? pv/vv : x.c); } return o; }
/* taker delta per bar: (buy − sell)/total ∈ [−1, 1]  (Binance kline field 10 = taker-buy quote volume) */
function delta(b){ return b.map(x => x.qv > 0 ? (2*x.tb - x.qv)/x.qv : 0); }
/* rolling sum over the previous n bars INCLUDING i */
function rsum(v, n){ const o = new Array(v.length).fill(N); let s = 0; for (let i = 0; i < v.length; i++){ s += v[i]; if (i >= n) s -= v[i - n]; if (i >= n - 1) o[i] = s; } return o; }
/* highest high / lowest low of the n bars BEFORE i (excludes bar i) */
function donch(b, n){ const H = new Array(b.length).fill(N), L = new Array(b.length).fill(N);
  for (let i = n; i < b.length; i++){ let h = -Infinity, l = Infinity; for (let j = i - n; j < i; j++){ if (b[j].h > h) h = b[j].h; if (b[j].l < l) l = b[j].l; } H[i] = h; L[i] = l; } return { hi: H, lo: L }; }
/* percentile rank of v[i] within the previous w values (incl. i), 0..1 */
function prank(v, w){ const o = new Array(v.length).fill(N); for (let i = 0; i < v.length; i++){ if (v[i] === N || i < w - 1) continue; let c = 0, n = 0; for (let j = i - w + 1; j <= i; j++){ if (v[j] === N) continue; n++; if (v[j] <= v[i]) c++; } o[i] = n ? c/n : N; } return o; }
/* swing pivots with k bars each side. A pivot at p is only KNOWN at p+k → reported at index p+k (no look-ahead). */
function swings(b, k = 3){ const out = []; for (let p = k; p + k < b.length; p++){ let hi = true, lo = true;
    for (let j = p - k; j <= p + k; j++){ if (j === p) continue; if (j < p ? b[j].h >= b[p].h : b[j].h > b[p].h) hi = false; if (j < p ? b[j].l <= b[p].l : b[j].l < b[p].l) lo = false; }
    if (hi) out.push({ p, at: p + k, kind: "H", px: b[p].h }); if (lo) out.push({ p, at: p + k, kind: "L", px: b[p].l }); }
  return out.sort((x, y) => x.at - y.at || x.p - y.p); }
/* market structure known at bar i: last two confirmed swing highs/lows → HH/HL (up), LH/LL (down); BOS = close beyond last confirmed swing */
function structureAt(sw, b, i){ const H = [], L = []; for (const s of sw){ if (s.at > i) break; (s.kind === "H" ? H : L).push(s); }
  if (H.length < 2 || L.length < 2) return { trend: 0, lastH: H.length ? H[H.length - 1].px : N, lastL: L.length ? L[L.length - 1].px : N, bos: 0, label: "—" };
  const h1 = H[H.length - 1].px, h0 = H[H.length - 2].px, l1 = L[L.length - 1].px, l0 = L[L.length - 2].px;
  const up = h1 > h0 && l1 > l0, dn = h1 < h0 && l1 < l0, c = b[i].c, pc = i ? b[i - 1].c : c;
  const bos = c > h1 && pc <= h1 ? 1 : c < l1 && pc >= l1 ? -1 : 0;
  return { trend: up ? 1 : dn ? -1 : 0, lastH: h1, lastL: l1, bos, label: (h1 > h0 ? "HH" : "LH") + "/" + (l1 > l0 ? "HL" : "LL") }; }
/* resample closed 15m bars into a higher timeframe (tfMs multiple of 15m). Only COMPLETE buckets are emitted; returns bars with T = close time. */
function resample(b, tfMs){ const o = []; let cur = N, cnt = 0, need = tfMs/900000;
  for (const x of b){ const k = Math.floor(x.t/tfMs)*tfMs; if (!cur || cur.t !== k){ if (cur && cnt === need) o.push(cur); cur = { t: k, o: x.o, h: x.h, l: x.l, c: x.c, v: x.v, qv: x.qv, tb: x.tb }; cnt = 1; }
    else { cur.h = Math.max(cur.h, x.h); cur.l = Math.min(cur.l, x.l); cur.c = x.c; cur.v += x.v; cur.qv += x.qv; cur.tb += x.tb; cnt++; } }
  if (cur && cnt === need) o.push(cur); return o; }
/* for each base bar i (closing at b[i].t + baseMs) → index of the last higher-TF bar CLOSED at or before that moment (or −1) */
function alignIdx(b, baseMs, hb, hMs){ const o = new Array(b.length).fill(-1); let j = -1;
  for (let i = 0; i < b.length; i++){ const close = b[i].t + baseMs; while (j + 1 < hb.length && hb[j + 1].t + hMs <= close) j++; o[i] = j; } return o; }
return { sma, ema, rma, tr, atr, rsi, macd, adx, boll, obv, vwap, delta, rsum, donch, prank, swings, structureAt, resample, alignIdx, fin };
});
