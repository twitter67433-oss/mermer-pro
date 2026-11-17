/* NEON//TERMINAL v7.11 — SCALP 2-5 DK: per-candle LONG / SHORT / BEKLE for 2–5 minute in-and-out trades.
   • data: Binance public market data only (no API key): USDⓈ-M futures klines 1m (primary) + 3m/5m (multi-timeframe), live kline + depth20 WebSocket,
     futures public stats (funding, open interest 5m, global long/short ratio 5m, taker buy/sell 5m). Falls back to spot (api.binance.com → data-api.binance.vision).
   • ~26 indicators computed in the browser, each votes −1…+1 with a weight; BEKLE when agreement is weak, timeframes conflict, trend is absent or the move is too small for fees.
   • signal history (last 50 closed candles per coin) with outcome after 2/3/5 minutes (TP1 vs stop, stop counted first when both hit in one candle) → running hit rate, in localStorage.
   SIGNAL ONLY: this module never places orders and never reads API keys or wallets. Pure math is exported as SCM (window.SCM / module.exports). */
"use strict";
(function (root, factory){ const M = factory(); if (typeof module === "object" && module.exports) module.exports = M; else root.SCM = M; })(typeof self !== "undefined" ? self : this, function (){
const last = a => a[a.length - 1], fin = x => typeof x === "number" && isFinite(x), clip = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x)), sgn = (x, band = 0) => x > band ? 1 : x < -band ? -1 : 0;
function sma(v, n){ const o = []; let s = 0; for (let i = 0; i < v.length; i++){ s += v[i]; if (i >= n) s -= v[i - n]; o.push(i >= n - 1 ? s/n : null); } return o; }
function ema(v, n){ const k = 2/(n + 1), o = []; let e = null, s = 0, c = 0; for (let i = 0; i < v.length; i++){ const x = v[i]; if (!fin(x)){ o.push(e); continue; } if (e === null){ s += x; c++; if (c === n) e = s/n; o.push(e); } else { e = x*k + e*(1 - k); o.push(e); } } return o; }
function rsi(v, n = 14){ const o = v.map(() => null); if (v.length <= n) return o; let g = 0, l = 0; for (let i = 1; i <= n; i++){ const d = v[i] - v[i - 1]; if (d > 0) g += d; else l -= d; } g /= n; l /= n;
  const R = () => l === 0 ? (g === 0 ? 50 : 100) : 100 - 100/(1 + g/l); o[n] = R(); for (let i = n + 1; i < v.length; i++){ const d = v[i] - v[i - 1]; g = (g*(n - 1) + Math.max(d, 0))/n; l = (l*(n - 1) + Math.max(-d, 0))/n; o[i] = R(); } return o; }
function stochRsi(v, n = 14, m = 14, ks = 3, ds = 3){ const r = rsi(v, n), st = r.map((x, i) => { if (x === null || i < n + m - 1) return null; const w = r.slice(i - m + 1, i + 1); const hi = Math.max(...w), lo = Math.min(...w); return hi === lo ? 50 : (x - lo)/(hi - lo)*100; });
  const sm = (a, p) => a.map((x, i) => { if (i < p - 1) return null; const w = a.slice(i - p + 1, i + 1); return w.some(y => y === null) ? null : w.reduce((s, y) => s + y, 0)/p; }); const K = sm(st, ks); return { k: K, d: sm(K, ds) }; }
function macd(v, f = 12, s = 26, sig = 9){ const ef = ema(v, f), es = ema(v, s), m = v.map((_, i) => ef[i] !== null && es[i] !== null ? ef[i] - es[i] : null);
  const idx = m.findIndex(x => x !== null), sg = idx < 0 ? m.map(() => null) : Array(idx).fill(null).concat(ema(m.slice(idx), sig)); return { macd: m, signal: sg, hist: m.map((x, i) => x !== null && sg[i] !== null ? x - sg[i] : null) }; }
function boll(v, n = 20, k = 2){ const mid = sma(v, n), up = [], lo = [], bw = []; for (let i = 0; i < v.length; i++){ if (mid[i] === null){ up.push(null); lo.push(null); bw.push(null); continue; } let s = 0; for (let j = i - n + 1; j <= i; j++) s += (v[j] - mid[i])**2; const sd = Math.sqrt(s/n); up.push(mid[i] + k*sd); lo.push(mid[i] - k*sd); bw.push(mid[i] ? 2*k*sd/mid[i] : 0); } return { mid, up, lo, bw }; }
function trs(b){ return b.map((x, i) => i ? Math.max(x.h - x.l, Math.abs(x.h - b[i - 1].c), Math.abs(x.l - b[i - 1].c)) : x.h - x.l); }
function atr(b, n = 14){ const tr = trs(b), o = tr.map(() => null); if (b.length < n) return o; let a = tr.slice(0, n).reduce((s, x) => s + x, 0)/n; o[n - 1] = a; for (let i = n; i < b.length; i++){ a = (a*(n - 1) + tr[i])/n; o[i] = a; } return o; }
function supertrend(b, n = 10, m = 3){ const a = atr(b, n), dir = b.map(() => 0), line = b.map(() => null); let fu = null, fl = null, d = 1;
  for (let i = 0; i < b.length; i++){ if (a[i] === null) continue; const hl = (b[i].h + b[i].l)/2, bu = hl + m*a[i], bl = hl - m*a[i], pc = i ? b[i - 1].c : b[i].c;
    fu = fu === null || bu < fu || pc > fu ? bu : fu; fl = fl === null || bl > fl || pc < fl ? bl : fl;
    if (d === 1 && b[i].c < fl) d = -1; else if (d === -1 && b[i].c > fu) d = 1; dir[i] = d; line[i] = d === 1 ? fl : fu; } return { dir, line }; }
function adx(b, n = 14){ const L = b.length, pdi = Array(L).fill(null), mdi = Array(L).fill(null), ax = Array(L).fill(null); if (L < 2*n + 1) return { adx: ax, pdi, mdi };
  const tr = trs(b); let sTr = 0, sP = 0, sM = 0, dxs = [], a = null;
  for (let i = 1; i < L; i++){ const up = b[i].h - b[i - 1].h, dn = b[i - 1].l - b[i].l, pdm = up > dn && up > 0 ? up : 0, mdm = dn > up && dn > 0 ? dn : 0;
    if (i <= n){ sTr += tr[i]; sP += pdm; sM += mdm; if (i < n) continue; } else { sTr = sTr - sTr/n + tr[i]; sP = sP - sP/n + pdm; sM = sM - sM/n + mdm; }
    const p = sTr ? 100*sP/sTr : 0, m = sTr ? 100*sM/sTr : 0, dx = p + m ? 100*Math.abs(p - m)/(p + m) : 0; pdi[i] = p; mdi[i] = m;
    if (a === null){ dxs.push(dx); if (dxs.length === n){ a = dxs.reduce((s, x) => s + x, 0)/n; ax[i] = a; } } else { a = (a*(n - 1) + dx)/n; ax[i] = a; } } return { adx: ax, pdi, mdi }; }
function ichimoku(b, t = 9, k = 26, s = 52){ const mid = (i, p) => { if (i < p - 1) return null; let hi = -Infinity, lo = Infinity; for (let j = i - p + 1; j <= i; j++){ hi = Math.max(hi, b[j].h); lo = Math.min(lo, b[j].l); } return (hi + lo)/2; };
  const i = b.length - 1, tk = mid(i, t), kj = mid(i, k), j = i - k; const tk0 = j >= 0 ? mid(j, t) : null, kj0 = j >= 0 ? mid(j, k) : null;
  const sa = tk0 !== null && kj0 !== null ? (tk0 + kj0)/2 : null, sb = j >= 0 ? mid(j, s) : null; return { tenkan: tk, kijun: kj, sa, sb, top: sa !== null && sb !== null ? Math.max(sa, sb) : null, bot: sa !== null && sb !== null ? Math.min(sa, sb) : null }; }
function psar(b, st = 0.02, mx = 0.2){ const o = b.map(() => null); if (b.length < 3) return { sar: o, up: o.map(() => 0) }; const up = b.map(() => 0);
  let bull = b[1].c >= b[0].c, sar = bull ? b[0].l : b[0].h, ep = bull ? b[1].h : b[1].l, af = st; o[1] = sar; up[1] = bull ? 1 : -1;
  for (let i = 2; i < b.length; i++){ sar = sar + af*(ep - sar);
    if (bull){ sar = Math.min(sar, b[i - 1].l, b[i - 2].l); if (b[i].l < sar){ bull = false; sar = ep; ep = b[i].l; af = st; } else if (b[i].h > ep){ ep = b[i].h; af = Math.min(mx, af + st); } }
    else { sar = Math.max(sar, b[i - 1].h, b[i - 2].h); if (b[i].h > sar){ bull = true; sar = ep; ep = b[i].h; af = st; } else if (b[i].l < ep){ ep = b[i].l; af = Math.min(mx, af + st); } }
    o[i] = sar; up[i] = bull ? 1 : -1; } return { sar: o, up }; }
function cci(b, n = 20){ const tp = b.map(x => (x.h + x.l + x.c)/3), m = sma(tp, n); return tp.map((x, i) => { if (m[i] === null) return null; let md = 0; for (let j = i - n + 1; j <= i; j++) md += Math.abs(tp[j] - m[i]); md /= n; return md ? (x - m[i])/(0.015*md) : 0; }); }
function willr(b, n = 14){ return b.map((x, i) => { if (i < n - 1) return null; let hi = -Infinity, lo = Infinity; for (let j = i - n + 1; j <= i; j++){ hi = Math.max(hi, b[j].h); lo = Math.min(lo, b[j].l); } return hi === lo ? -50 : -100*(hi - x.c)/(hi - lo); }); }
function mfi(b, n = 14){ const tp = b.map(x => (x.h + x.l + x.c)/3); return b.map((x, i) => { if (i < n) return null; let p = 0, q = 0; for (let j = i - n + 1; j <= i; j++){ const f = tp[j]*b[j].v; if (tp[j] > tp[j - 1]) p += f; else if (tp[j] < tp[j - 1]) q += f; } return q === 0 ? (p === 0 ? 50 : 100) : 100 - 100/(1 + p/q); }); }
function obv(b){ let s = 0; return b.map((x, i) => { if (i) s += x.c > b[i - 1].c ? x.v : x.c < b[i - 1].c ? -x.v : 0; return s; }); }
function vwap(b){ const o = []; let day = null, pv = 0, vv = 0; for (const x of b){ const d = Math.floor(x.t/86400000); if (d !== day){ day = d; pv = 0; vv = 0; } pv += (x.h + x.l + x.c)/3*x.v; vv += x.v; o.push(vv ? pv/vv : x.c); } return o; }
function heikin(b){ const o = []; for (let i = 0; i < b.length; i++){ const x = b[i], c = (x.o + x.h + x.l + x.c)/4, op = i ? (o[i - 1].o + o[i - 1].c)/2 : (x.o + x.c)/2; o.push({ o: op, c, h: Math.max(x.h, op, c), l: Math.min(x.l, op, c) }); } return o; }
function slope(v, n){ const w = v.slice(-n).filter(fin); const m = w.length; if (m < 3) return 0; const mx = (m - 1)/2, my = w.reduce((s, x) => s + x, 0)/m; let a = 0, d = 0; w.forEach((y, i) => { a += (i - mx)*(y - my); d += (i - mx)**2; }); return d ? a/d : 0; }
/* candlestick patterns on the last bar (b[i]) with the previous bar for engulfing */
function pattern(b, i){ if (i < 1) return { name: "—", v: 0 }; const x = b[i], p = b[i - 1], rng = x.h - x.l || 1e-12, body = Math.abs(x.c - x.o), up = x.h - Math.max(x.o, x.c), lo = Math.min(x.o, x.c) - x.l, pb = Math.abs(p.c - p.o);
  if (x.c > x.o && p.c < p.o && x.c >= p.o && x.o <= p.c && body > pb) return { name: "yutan boğa", v: 1 };
  if (x.c < x.o && p.c > p.o && x.o >= p.c && x.c <= p.o && body > pb) return { name: "yutan ayı", v: -1 };
  if (body/rng < 0.1) return { name: "doji (kararsız)", v: 0 };
  if (lo >= 2*body && up <= 0.35*body + 0.1*rng) return { name: lo/rng > 0.66 ? "pin bar ↑" : "çekiç", v: 0.8 };
  if (up >= 2*body && lo <= 0.35*body + 0.1*rng) return { name: up/rng > 0.66 ? "pin bar ↓" : "kayan yıldız", v: -0.8 };
  if (body/rng > 0.7) return { name: x.c > x.o ? "güçlü yeşil (marubozu)" : "güçlü kırmızı (marubozu)", v: x.c > x.o ? 0.5 : -0.5 }; return { name: "nötr", v: 0 }; }
/* regular RSI divergence between the last two pivot lows/highs (2 bars each side) inside the last `lb` bars */
function divergence(b, r, lb = 40){ const n = b.length, s = Math.max(2, n - lb), lows = [], highs = [];
  for (let i = s; i < n - 2; i++){ if (r[i] === null) continue; const L = b[i].l, H = b[i].h; if (L <= b[i - 1].l && L <= b[i - 2].l && L < b[i + 1].l && L < b[i + 2].l) lows.push(i); if (H >= b[i - 1].h && H >= b[i - 2].h && H > b[i + 1].h && H > b[i + 2].h) highs.push(i); }
  if (lows.length >= 2){ const [a, c] = lows.slice(-2); if (b[c].l < b[a].l && r[c] > r[a] + 2 && n - 1 - c <= 8) return { v: 1, why: "boğa uyumsuzluğu (fiyat düşük dip, RSI yüksek dip)" }; }
  if (highs.length >= 2){ const [a, c] = highs.slice(-2); if (b[c].h > b[a].h && r[c] < r[a] - 2 && n - 1 - c <= 8) return { v: -1, why: "ayı uyumsuzluğu (fiyat yüksek tepe, RSI düşük tepe)" }; } return { v: 0, why: "uyumsuzluk yok" }; }
/* short trend vote for a higher timeframe (3m / 5m) */
function tfVote(b){ if (!b || b.length < 40) return null; const c = b.map(x => x.c), e9 = last(ema(c, 9)), e21 = last(ema(c, 21)), st = last(supertrend(b).dir), h = last(macd(c).hist), A = last(atr(b)) || last(c)*0.001;
  const v = (sgn(e9 - e21, 0.05*A) + st + sgn(h, 0.02*A) + sgn(last(c) - e21, 0.2*A))/4; return { v, e9, e21, st, h }; }
const W = { ema: 1.2, vwap: 0.8, rsi: 0.7, rdiv: 0.7, srsi: 0.6, macd: 1.0, bb: 0.8, atr: 0, st: 1.0, adx: 1.0, ichi: 0.8, psar: 0.6, cci: 0.5, wr: 0.4, mfi: 0.5, obv: 0.6, cvd: 1.0, vol: 0.7, ha: 0.6, pat: 0.7, ob: 0.8, fund: 0.3, oi: 0.5, ls: 0.3, tk: 0.5, mtf: 1.6 };
const NAME = { ema: "EMA 9/21/50", vwap: "VWAP (seans)", rsi: "RSI 14", rdiv: "RSI uyumsuzluk", srsi: "Stoch RSI", macd: "MACD 12/26/9", bb: "Bollinger 20/2", atr: "ATR 14 (filtre)", st: "SuperTrend 10/3", adx: "ADX / DMI 14", ichi: "Ichimoku 9/26/52", psar: "Parabolic SAR", cci: "CCI 20", wr: "Williams %R", mfi: "MFI 14", obv: "OBV eğim", cvd: "CVD / hacim deltası", vol: "Hacim patlaması", ha: "Heikin Ashi", pat: "Mum formasyonu", ob: "Emir defteri dengesizliği", fund: "Funding", oi: "OI değişim (30dk)", ls: "Long/Short oranı", tk: "Taker alış/satış 5dk", mtf: "Çoklu TF 1m/3m/5m" };
const FEE_RT = 0.001; /* ~0.05 % taker per side on Binance USDⓈ-M → ~0.10 % round trip */
/* A = { b1, b3, b5, book:{bid,ask}, der:{fund, oiCh, ls, tk}, now } ; bars oldest → newest, the last 1m bar may still be forming */
function analyze(A){ const b = A.b1 || []; if (b.length < 60) return null; const n = b.length, i = n - 1, c = b.map(x => x.c), px = c[i], V = [];
  const add = (k, v, val) => { if (!fin(v)) v = 0; V.push({ k, name: NAME[k], w: W[k], v: clip(v), val: String(val) }); };
  const A1 = last(atr(b)) || px*0.001, aPct = A1/px*100, ff = (x, d = 2) => fin(x) ? x.toFixed(d) : "—", dp = Math.max(0, Math.min(8, 5 - Math.floor(Math.log10(px || 1)))), fp = x => fin(x) ? x.toFixed(dp) : "—";
  /* 1 EMA */ const e9 = ema(c, 9), e21 = ema(c, 21), e50 = ema(c, 50), E9 = e9[i], E21 = e21[i], E50 = e50[i], sl9 = (E9 - e9[i - 3])/A1;
  const cross = sgn(e9[i] - e21[i]) !== sgn(e9[i - 3] - e21[i - 3]) ? sgn(e9[i] - e21[i])*0.3 : 0;
  add("ema", (sgn(E9 - E21, 0.05*A1) + sgn(E21 - E50, 0.05*A1) + sgn(sl9, 0.1))/3 + cross, `9 ${fp(E9)} · 21 ${fp(E21)} · 50 ${fp(E50)}${cross ? (cross > 0 ? " · yeni kesişim ↑" : " · yeni kesişim ↓") : ""}`);
  /* 2 VWAP */ const VW = last(vwap(b)), dv = (px - VW)/A1; add("vwap", Math.abs(dv) < 0.2 ? 0 : Math.abs(dv) > 4 ? -sgn(dv)*0.3 : sgn(dv)*Math.min(1, 0.4 + Math.abs(dv)/4), `${fp(VW)} · fiyat ${dv >= 0 ? "+" : ""}${ff(dv, 1)} ATR`);
  /* 3 RSI */ const r = rsi(c), R = r[i], R1 = r[i - 1]; add("rsi", R > 78 ? -0.6 : R < 22 ? 0.6 : (R - 50)/30 + (R - R1)/20, `${ff(R, 1)} ${R > R1 ? "↑" : "↓"}${R > 70 ? " aşırı alım" : R < 30 ? " aşırı satım" : ""}`);
  /* 4 divergence */ const dvg = divergence(b, r); add("rdiv", dvg.v, dvg.why);
  /* 5 Stoch RSI */ const S = stochRsi(c), K = S.k[i], D = S.d[i], K1 = S.k[i - 1], D1 = S.d[i - 1];
  { let v = fin(K) && fin(D) ? (K - D)/40 : 0; if (fin(K1) && fin(D1)){ if (K1 <= D1 && K > D && K < 30) v = 1; else if (K1 >= D1 && K < D && K > 70) v = -1; else if (K > 90) v -= 0.3; else if (K < 10) v += 0.3; } add("srsi", v, `K ${ff(K, 0)} · D ${ff(D, 0)}`); }
  /* 6 MACD */ const M = macd(c), H = M.hist[i], H1 = M.hist[i - 1], zc = sgn(M.macd[i]) !== sgn(M.macd[i - 3]) ? sgn(M.macd[i])*0.3 : 0;
  add("macd", (Math.abs(H) < 0.01*A1 ? 0 : H > 0 ? (H > H1 ? 1 : 0.35) : (H < H1 ? -1 : -0.35)) + zc, `hist ${H >= 0 ? "+" : ""}${ff(H/A1, 2)} ATR ${H > H1 ? "↑" : "↓"}${zc ? " · sıfır kesişimi" : ""}`);
  /* 7 Bollinger */ const B = boll(c), up = B.up[i], lo = B.lo[i], bw = B.bw.slice(-60).filter(fin), sq = bw.length > 20 && B.bw[i - 1] <= bw.slice().sort((a, z) => a - z)[Math.floor(bw.length*0.2)], pb = up > lo ? (px - lo)/(up - lo) : 0.5;
  { let v, why; if (px > up){ v = sq ? 1 : -0.4; why = sq ? "sıkışmadan yukarı kırılım" : "üst bant dışı (geri dönüş riski)"; } else if (px < lo){ v = sq ? -1 : 0.4; why = sq ? "sıkışmadan aşağı kırılım" : "alt bant dışı (tepki ihtimali)"; } else { v = (pb - 0.5)*0.6; why = sq ? "sıkışma — kırılım bekleniyor" : "bant içi"; }
    add("bb", v, `%B ${ff(pb*100, 0)} · ${why}`); }
  /* 8 ATR filter */ add("atr", 0, `${fp(A1)} (%${ff(aPct, 3)}) · ${aPct < 0.03 ? "çok düşük" : aPct > 0.6 ? "çok yüksek" : "uygun"}`);
  /* 9 SuperTrend */ const ST = supertrend(b), sd = ST.dir[i], flip = ST.dir[i - 1] !== sd || ST.dir[i - 2] !== sd; add("st", sd*(flip ? 1 : 0.8), `${sd > 0 ? "yukarı" : "aşağı"} · çizgi ${fp(ST.line[i])}${flip ? " · yeni dönüş" : ""}`);
  /* 10 ADX */ const X = adx(b), AX = X.adx[i], P = X.pdi[i], Mi = X.mdi[i]; add("adx", fin(AX) && AX > 18 ? sgn(P - Mi)*Math.min(1, (AX - 15)/20) : 0, `ADX ${ff(AX, 0)} · +DI ${ff(P, 0)} / −DI ${ff(Mi, 0)}${AX < 18 ? " · zayıf trend" : ""}`);
  /* 11 Ichimoku */ const I = ichimoku(b); { const cv = I.top === null ? 0 : px > I.top ? 1 : px < I.bot ? -1 : 0, tkv = fin(I.tenkan) && fin(I.kijun) ? sgn(I.tenkan - I.kijun, 0.02*A1) : 0;
    add("ichi", (cv + tkv)/2, `tenkan ${fp(I.tenkan)} · kijun ${fp(I.kijun)} · ${cv > 0 ? "bulut üstü" : cv < 0 ? "bulut altı" : "bulut içi"}`); }
  /* 12 PSAR */ const PS = psar(b); add("psar", PS.up[i]*(PS.up[i - 1] !== PS.up[i] ? 1 : 0.7), `${fp(PS.sar[i])} · ${PS.up[i] > 0 ? "fiyat altında (yukarı)" : "fiyat üstünde (aşağı)"}`);
  /* 13 CCI */ const CC = cci(b), C0 = CC[i], C1 = CC[i - 1]; add("cci", C0 > 200 ? -0.4 : C0 < -200 ? 0.4 : C0 > 100 ? (C0 > C1 ? 0.6 : 0.1) : C0 < -100 ? (C0 < C1 ? -0.6 : -0.1) : C0/250, ff(C0, 0));
  /* 14 Williams %R */ const WR = willr(b), w0 = WR[i], w1 = WR[i - 1]; add("wr", w1 < -80 && w0 > w1 ? 0.6 : w1 > -20 && w0 < w1 ? -0.6 : w1 < -50 && w0 >= -50 ? 0.5 : w1 > -50 && w0 <= -50 ? -0.5 : 0, ff(w0, 0));
  /* 15 MFI */ const MF = mfi(b)[i]; add("mfi", MF > 80 ? -0.6 : MF < 20 ? 0.6 : (MF - 50)/50*0.6, ff(MF, 0));
  /* 16 OBV */ const OB = obv(b), avgV = b.slice(-21, -1).reduce((s, x) => s + x.v, 0)/20 || 1, os = slope(OB, 10)/avgV; add("obv", Math.abs(os) < 0.05 ? 0 : clip(os*1.5), `eğim ${os >= 0 ? "+" : ""}${ff(os, 2)} (ort. hacim/mum)`);
  /* 17 CVD */ const w5 = b.slice(-5), tb = w5.reduce((s, x) => s + (fin(x.tb) ? x.tb : x.v/2), 0), tv = w5.reduce((s, x) => s + x.v, 0) || 1, dr = (2*tb - tv)/tv; /* (buy − sell) / total */
  { const cvd = b.reduce((a, x) => { a.push((a.length ? last(a) : 0) + (fin(x.tb) ? 2*x.tb - x.v : 0)); return a; }, []), cs = slope(cvd, 10)/avgV; add("cvd", Math.abs(dr) < 0.04 ? 0 : clip(dr*3), `5 mum delta ${dr >= 0 ? "+" : ""}${ff(dr*100, 0)}% · CVD eğim ${cs >= 0 ? "+" : ""}${ff(cs, 2)}`); }
  /* 18 volume spike (closed bar, and the forming bar projected to a full minute) */ { const lc = b[i - 1], el = A.now && b[i].T ? clip((A.now - b[i].t)/(b[i].T - b[i].t + 1), 0.15, 1) : 1, rC = lc.v/avgV, rL = b[i].v/el/avgV, useL = rL > rC, bar = useL ? b[i] : lc, rv = Math.max(rC, rL);
    add("vol", rv >= 1.8 ? sgn(bar.c - bar.o)*Math.min(1, (rv - 1)/2) : 0, `${ff(rv, 1)}x ortalama${rv >= 1.8 ? (bar.c >= bar.o ? " · alıcı mumu" : " · satıcı mumu") : ""}`); }
  /* 19 Heikin Ashi */ const HA = heikin(b), h3 = HA.slice(-3), gr = h3.filter(x => x.c > x.o).length, hl = last(HA), strong = hl.c > hl.o ? hl.l >= Math.min(hl.o, hl.c) - 1e-12 : hl.h <= Math.max(hl.o, hl.c) + 1e-12;
  add("ha", (gr - 1.5)/1.5*(strong ? 1 : 0.7), `${h3.map(x => x.c > x.o ? "▲" : "▼").join("")}${strong ? (hl.c > hl.o ? " · alt fitilsiz (güçlü)" : " · üst fitilsiz (güçlü)") : ""}`);
  /* 20 patterns on the last closed bar */ const pt = pattern(b, i - 1); add("pat", pt.v, pt.name);
  /* 21 order book */ const bk = A.book; if (bk && fin(bk.bid) && fin(bk.ask) && bk.bid + bk.ask > 0){ const im = (bk.bid - bk.ask)/(bk.bid + bk.ask); add("ob", Math.abs(im) < 0.08 ? 0 : clip(im*2), `alış %${ff(50 + im*50, 0)} / satış %${ff(50 - im*50, 0)}`); } else add("ob", 0, "veri yok");
  const Dr = A.der || {};
  /* 22 funding */ if (fin(Dr.fund)) add("fund", Dr.fund > 0.0005 ? -1 : Dr.fund > 0.0002 ? -0.4 : Dr.fund < -0.0003 ? 1 : Dr.fund < 0 ? 0.3 : 0, `%${(Dr.fund*100).toFixed(4)}`); else add("fund", 0, "veri yok (spot)");
  /* 23 OI */ if (fin(Dr.oiCh)){ const pu = sgn(px - (b[n - 31] || b[0]).c); add("oi", Dr.oiCh > 0.3 ? pu : Dr.oiCh < -0.3 ? pu*0.3 : 0, `${Dr.oiCh >= 0 ? "+" : ""}${ff(Dr.oiCh, 2)}% · fiyat ${pu > 0 ? "↑" : pu < 0 ? "↓" : "→"}${Dr.oiCh > 0.3 ? " · yeni para" : Dr.oiCh < -0.3 ? " · pozisyon kapanıyor" : ""}`); } else add("oi", 0, "veri yok (spot)");
  /* 24 L/S */ if (fin(Dr.ls)) add("ls", Dr.ls > 2.5 ? -0.8 : Dr.ls > 1.8 ? -0.3 : Dr.ls < 0.7 ? 0.8 : Dr.ls < 0.9 ? 0.3 : 0, `${ff(Dr.ls, 2)} (kalabalığa karşı)`); else add("ls", 0, "veri yok (spot)");
  /* 25 taker 5m */ if (fin(Dr.tk)) add("tk", Dr.tk > 1.15 ? 1 : Dr.tk > 1.03 ? 0.4 : Dr.tk < 0.87 ? -1 : Dr.tk < 0.97 ? -0.4 : 0, `${ff(Dr.tk, 2)}x`); else add("tk", 0, "veri yok (spot)");
  /* 26 MTF */ const t1 = tfVote(b), t3 = tfVote(A.b3), t5 = tfVote(A.b5), tv3 = [t1, t3, t5].filter(Boolean), mv = tv3.length ? tv3.reduce((s, x) => s + x.v, 0)/tv3.length : 0;
  add("mtf", mv, `1m ${t1 ? (t1.v > 0.25 ? "▲" : t1.v < -0.25 ? "▼" : "◆") : "—"} · 3m ${t3 ? (t3.v > 0.25 ? "▲" : t3.v < -0.25 ? "▼" : "◆") : "—"} · 5m ${t5 ? (t5.v > 0.25 ? "▲" : t5.v < -0.25 ? "▼" : "◆") : "—"}`);
  /* score */ const vw = V.filter(x => x.w > 0), sw = vw.reduce((s, x) => s + x.w, 0), sc = sw ? vw.reduce((s, x) => s + x.v*x.w, 0)/sw : 0, act = vw.filter(x => Math.abs(x.v) > 0.1), aw = act.reduce((s, x) => s + x.w, 0);
  const agree = aw ? act.filter(x => sgn(x.v) === sgn(sc)).reduce((s, x) => s + x.w, 0)/aw : 0.5, conf = Math.round(100*Math.min(0.95, 0.5*Math.min(1, Math.abs(sc)/0.45) + 0.5*agree));
  let side = Math.abs(sc) >= 0.2 && conf >= 62 ? (sc > 0 ? "LONG" : "SHORT") : "BEKLE"; const veto = [];
  const ATR5 = A.b5 && A.b5.length > 20 ? last(atr(A.b5)) : null, sdist = Math.max(1.2*A1, fin(ATR5) ? 0.5*ATR5 : 0), sPct = sdist/px*100, AX3 = A.b3 && A.b3.length > 40 ? last(adx(A.b3).adx) : null;
  if (aPct < 0.03) veto.push("volatilite çok düşük (ATR %" + ff(aPct, 3) + ")");
  if (sPct < 0.12) veto.push("hareket ücretlere göre çok küçük (stop/TP1 %" + ff(sPct, 3) + ", taker gidiş-dönüş ≈ %0.10) — daha oynak coin dene");
  if (fin(AX) && AX < 15 && (!fin(AX3) || AX3 < 15)) veto.push("ADX zayıf (1m " + ff(AX, 0) + (fin(AX3) ? " · 3m " + ff(AX3, 0) : "") + ") — yön yok");
  if (side !== "BEKLE"){ const d = side === "LONG" ? 1 : -1; if (t5 && t5.v*d <= -0.5 || t3 && t3.v*d <= -0.5) veto.push("üst zaman dilimi ters yönde (3m/5m)");
    const ex = (px - E21)/A1; if (ex*d > 1.5) veto.push("fiyat EMA21'den " + ff(Math.abs(ex), 1) + " ATR uzak — kovalama, geri çekilme bekle");
    if (d > 0 && R > 82) veto.push("RSI " + ff(R, 0) + " — tepeyi kovalama"); if (d < 0 && R < 18) veto.push("RSI " + ff(R, 0) + " — dibi kovalama"); }
  if (side !== "BEKLE" && veto.length) side = "BEKLE";
  const lean = sc > 0.08 ? "LONG" : sc < -0.08 ? "SHORT" : null, d = side === "LONG" ? 1 : side === "SHORT" ? -1 : lean === "LONG" ? 1 : lean === "SHORT" ? -1 : 0;
  const plan = d ? { side: side === "BEKLE" ? null : side, lean, entry: px, limit: px - d*0.2*A1, stop: px - d*sdist, tp1: px + d*sdist, tp2: px + d*2*sdist, riskPct: sPct, netR1: (sPct - FEE_RT*100)/(sPct + FEE_RT*100), hold: conf >= 80 ? 5 : conf >= 70 ? 3 : 2 } : null;
  return { px, side, conf, score: +sc.toFixed(3), agree: +agree.toFixed(2), strong: side !== "BEKLE" && conf >= 78, votes: V, veto, plan, atr: A1, atrPct: aPct, adx: AX, rsi: R, t: b[i].t, dp,
    ext: (px - E21)/A1, srsiK: K, lines: { e9: E9, e21: E21, e50: E50, vwap: VW, st: ST.line[i] } }; }
/* outcome after h minutes using the 1m bars that closed after the signal candle; stop is counted first when one candle touches both */
function outcome(sig, b1, h){ const st = sig.t + 60000, bars = b1.filter(x => x.t >= st && x.t < st + h*60000 && x.x !== false); if (bars.length < h) return null; const d = sig.side === "LONG" ? 1 : -1;
  for (const x of bars){ const hitS = d > 0 ? x.l <= sig.stop : x.h >= sig.stop, hitT = d > 0 ? x.h >= sig.tp1 : x.l <= sig.tp1; if (hitS) return { r: "SL", pnl: -Math.abs(sig.entry - sig.stop)/sig.entry*100 }; if (hitT) return { r: "TP", pnl: Math.abs(sig.tp1 - sig.entry)/sig.entry*100 }; }
  const pnl = d*(last(bars).c - sig.entry)/sig.entry*100; return { r: pnl >= 0 ? "+" : "−", pnl }; }
/* walk-forward replay on loaded bars: the same analyze() on each closed 1m bar (only data known at that time), outcomes after 2/3/5 min */
function backtest(b1, b3, b5, from = 120){ const b = b1.filter(x => x.x !== false), L = []; for (let i = from; i < b.length - 1; i++){ const T = b[i].T, r = analyze({ b1: b.slice(0, i + 1), b3: (b3 || []).filter(x => x.T <= T), b5: (b5 || []).filter(x => x.T <= T), now: T + 1 });
    if (!r || !r.plan || !r.plan.side) continue; const s = { t: b[i].t, side: r.side, entry: b[i].c, stop: r.plan.stop, tp1: r.plan.tp1, res: {} }; for (const h of [2, 3, 5]){ const o = outcome(s, b, h); if (o) s.res[h] = o; } L.push(s); }
  return { n: b.length - 1 - from, sig: L.length, st: stats(L) }; }
function stats(list){ const o = {}; for (const h of [2, 3, 5]){ let tp = 0, sl = 0, dir = 0, n = 0, pnl = 0; for (const s of list){ const r = s.res && s.res[h]; if (!r || s.side === "BEKLE") continue; n++; pnl += r.pnl; if (r.r === "TP") tp++; else if (r.r === "SL") sl++; if (r.r === "TP" || r.r === "+") dir++; }
  o[h] = { n, tp, sl, hit: tp + sl ? tp/(tp + sl)*100 : null, dir: n ? dir/n*100 : null, pnl }; } return o; }
return { sma, ema, rsi, stochRsi, macd, boll, atr, supertrend, adx, ichimoku, psar, cci, willr, mfi, obv, vwap, heikin, pattern, divergence, tfVote, analyze, outcome, stats, backtest, W, NAME };
});

/* ------------------------- UI (page only) ------------------------- */
if (typeof window !== "undefined" && typeof document !== "undefined") window.SCALP = (() => {
const $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const FUT = "https://fapi.binance.com", SPOT = ["https://api.binance.com", "https://data-api.binance.vision"], WSF = "wss://fstream.binance.com", WSS = ["wss://data-stream.binance.vision/stream?streams=", "wss://stream.binance.com:9443/stream?streams="];
const QUICK = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "PAXGUSDT"], HK = "neon.scalp.hist", SK = "neon.scalp.stats";
const S = { sym: localStorage.getItem("neon.scalp.sym") || "BTCUSDT", mkt: "fut", spotBase: 0, b: { "1m": [], "3m": [], "5m": [] }, book: null, der: {}, A: null, ws: null, wsOk: false, lastTick: 0, started: false, gen: 0, off: 0,
  err: null, snd: localStorage.getItem("neon.scalp.snd") === "1", exitAt: 0, exitSide: null, lastFinal: 0, list: [], poll: null, wsTry: 0 };
const fp = x => !isFinite(x) ? "—" : (+x).toFixed(S.A ? S.A.dp : 2), now = () => Date.now() + S.off;
const bars = a => a.map(k => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5], T: +k[6], tb: +k[9], x: true }));
async function getJ(url){ const r = await fetch(url, { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }
async function spotJ(p){ let e; for (let k = 0; k < SPOT.length; k++){ const i = (S.spotBase + k) % SPOT.length; try { const j = await getJ(SPOT[i] + p); S.spotBase = i; return j; } catch(x){ e = x; } } throw e; }
const H = { load(){ try { return JSON.parse(localStorage.getItem(HK) || "{}"); } catch(e){ return {}; } }, save(o){ const ks = Object.keys(o).sort((a, z) => ((o[z][0] || {}).t || 0) - ((o[a][0] || {}).t || 0)).slice(0, 12), r = {}; ks.forEach(k => r[k] = o[k].slice(0, 50)); try { localStorage.setItem(HK, JSON.stringify(r)); } catch(e){} } };
const ST = { load(){ try { return JSON.parse(localStorage.getItem(SK) || "{}"); } catch(e){ return {}; } }, bump(sym, h, r){ const o = ST.load(); const k = o[sym] = o[sym] || {}; const x = k[h] = k[h] || { n: 0, tp: 0, sl: 0, dir: 0 }; x.n++; if (r.r === "TP") x.tp++; else if (r.r === "SL") x.sl++; if (r.r === "TP" || r.r === "+") x.dir++; try { localStorage.setItem(SK, JSON.stringify(o)); } catch(e){} } };
function html(){ return `<div class="can-search sc-search"><input id="sc-q" placeholder="coin ara (BTC, SOL, PAXG=altın…)" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(S.sym)}"><button type="button" id="sc-go" class="mini">SEÇ</button></div>
  <div id="sc-list" class="can-list hidden"></div>
  <div class="tfbar sc-quick">${QUICK.map(s => `<button type="button" data-sq="${s}">${s === "PAXGUSDT" ? "ALTIN·PAXG" : s.replace("USDT", "")}</button>`).join("")}</div>
  <div class="sc-st dim" id="sc-st">bağlanıyor…</div>
  <div id="sc-main" class="sc-main"><div class="empty">veri yükleniyor…</div></div>
  <canvas id="sc-cv" class="sc-cv" height="170"></canvas>
  <div class="sc-row"><label class="snd"><input type="checkbox" id="sc-snd" ${S.snd ? "checked" : ""}> 🔔 güçlü sinyalde ses + titreşim</label></div>
  <details class="keys" open><summary>🧮 İndikatör oyları (26)</summary><div id="sc-votes"></div></details>
  <details class="keys" open><summary>📜 Sinyal geçmişi · isabet oranı</summary><div id="sc-hist"></div></details>
  <details class="keys"><summary>⟲ Geriye dönük test (yüklü ~6 saatlik 1m mum)</summary><div class="dim sc-note">Aynı kurallar her kapanmış 1m mumda, yalnızca o ana kadarki veriyle tekrar çalıştırılır (türev ve defter verisi geçmişte yok, onlarsız). Ücret dahil değil.</div><button type="button" id="sc-bt-go" class="mini wide">TESTİ ÇALIŞTIR</button><div id="sc-bt"></div></details>
  <div class="plan-foot">SCALP 2-5 DK yalnızca <b>sinyaldir</b>: emir göndermez, API anahtarı ve cüzdana dokunmaz. Sinyaller <b>olasılıksaldır, garanti değildir</b>; güven % indikatörlerin ne kadar aynı yönü gösterdiğidir, kazanma olasılığı değildir — gerçek isabeti aşağıdaki geçmişten izle. Ücret (~%0.10 gidiş-dönüş) ve kayma küçük hedefleri yer. Veri: Binance herkese açık uç noktalar (anahtarsız). Yatırım tavsiyesi değildir.</div>`; }
async function loadList(){ if (S.list.length) return; const C = window.COINAN && COINAN.S && COINAN.S.list; if (C && C.length){ S.list = C; return; }
  try { const ei = await getJ(FUT + "/fapi/v1/exchangeInfo"); S.list = ei.symbols.filter(s => s.contractType === "PERPETUAL" && s.quoteAsset === "USDT" && s.status === "TRADING").map(s => ({ s: s.symbol, b: s.baseAsset })); } catch(e){} }
function search(q){ q = String(q || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); const L = (window.COINAN && COINAN.S.list.length ? COINAN.S.list : S.list); if (!q) return L.slice(0, 30);
  return L.filter(x => x.s.startsWith(q) || x.b.startsWith(q) || x.b.replace(/^1000+|^1M/, "").startsWith(q)).concat(L.filter(x => !(x.s.startsWith(q) || x.b.startsWith(q)) && x.s.includes(q))).slice(0, 30); }
function paintList(q){ const el = $("#sc-list"); if (!el) return; const r = search(q); el.classList.remove("hidden");
  el.innerHTML = r.length ? r.map(x => `<button type="button" data-ss="${esc(x.s)}"><b>${esc(x.s)}</b><small>vadeli</small><small></small></button>`).join("") : `<div class="dim" style="padding:8px">vadelide yok — Enter ile spotta dene</div>`; }
/* ---------- data ---------- */
async function loadKlines(sym, my){ const tfs = ["1m", "3m", "5m"], lim = { "1m": 500, "3m": 300, "5m": 300 };
  try { const K = await Promise.all(tfs.map(t => getJ(`${FUT}/fapi/v1/klines?symbol=${sym}&interval=${t}&limit=${lim[t]}`))); if (my !== S.gen) return; S.mkt = "fut"; tfs.forEach((t, i) => S.b[t] = bars(K[i])); }
  catch(e){ const K = await Promise.all(tfs.map(t => spotJ(`/api/v3/klines?symbol=${sym}&interval=${t}&limit=${lim[t]}`))); if (my !== S.gen) return; S.mkt = "spot"; tfs.forEach((t, i) => S.b[t] = bars(K[i])); }
  tfs.forEach(t => { const a = S.b[t], l = a[a.length - 1]; if (l && l.T > now()) l.x = false; }); }
async function loadDer(sym, my){ if (S.mkt !== "fut"){ S.der = {}; return; } const o = p => getJ(FUT + p).catch(() => null);
  const [pr, oi, ls, tk] = await Promise.all([o(`/fapi/v1/premiumIndex?symbol=${sym}`), o(`/futures/data/openInterestHist?symbol=${sym}&period=5m&limit=7`), o(`/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=5m&limit=1`), o(`/futures/data/takerlongshortRatio?symbol=${sym}&period=5m&limit=1`)]);
  if (my !== S.gen) return; const oc = oi && oi.length > 1 && +oi[0].sumOpenInterest ? (+oi[oi.length - 1].sumOpenInterest/+oi[0].sumOpenInterest - 1)*100 : NaN;
  S.der = { fund: pr ? +pr.lastFundingRate : NaN, oiCh: oc, ls: ls && ls[0] ? +ls[0].longShortRatio : NaN, tk: tk && tk[0] ? +tk[0].buySellRatio : NaN, at: Date.now() }; }
function setBook(bids, asks){ if (!bids || !asks || !bids.length || !asks.length) return; const mid = (+bids[0][0] + +asks[0][0])/2, band = mid*0.0025; let b = 0, a = 0;
  for (const [p, q] of bids) if (mid - +p <= band) b += +q*+p; for (const [p, q] of asks) if (+p - mid <= band) a += +q*+p; S.book = { bid: b, ask: a, at: Date.now() }; }
async function loadBook(sym, my){ try { const d = S.mkt === "fut" ? await getJ(`${FUT}/fapi/v1/depth?symbol=${sym}&limit=50`) : await spotJ(`/api/v3/depth?symbol=${sym}&limit=50`); if (my === S.gen) setBook(d.bids, d.asks); } catch(e){} }
function onKline(k, tf){ const a = S.b[tf]; if (!a || !a.length) return; const x = { t: +k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v, T: +k.T, tb: +k.V, x: !!k.x }, l = a[a.length - 1];
  if (x.t === l.t) a[a.length - 1] = x; else if (x.t > l.t){ if (!l.x){ l.x = true; if (tf === "1m") finalize(); } a.push(x); if (a.length > 600) a.shift(); } else return;
  if (tf === "1m"){ S.lastTick = Date.now(); if (x.x) finalize(); } }
/* Binance USDⓈ-M WebSocket split (2026): klines on /market, depth on /public; spot uses one combined stream */
function connect(sym){ (S.ws || []).forEach(w => { try { w.close(); } catch(e){} }); S.wsOk = false; S.wsAt = Date.now(); const s = sym.toLowerCase(), my = S.gen, K = [`${s}@kline_1m`, `${s}@kline_3m`, `${s}@kline_5m`];
  const urls = S.mkt === "fut" ? [WSF + "/market/stream?streams=" + K.join("/"), WSF + "/public/stream?streams=" + s + "@depth20@500ms"] : [WSS[S.wsTry % WSS.length] + K.concat(s + "@depth20@1000ms").join("/")];
  S.ws = urls.map((u, n) => { let ws; try { ws = new WebSocket(u); } catch(e){ startPoll(); return null; }
    ws.onopen = () => { if (my !== S.gen) return; if (n === 0){ S.wsOk = true; S.wsAt = Date.now(); } paintSt(); };
    ws.onmessage = ev => { if (my !== S.gen) return; try { const m = JSON.parse(ev.data), d = m.data || m; if (d.k){ onKline(d.k, d.k.i); stopPoll(); } else if (d.b || d.bids) setBook(d.b || d.bids, d.a || d.asks); } catch(e){} };
    ws.onclose = () => { if (my !== S.gen) return; if (n === 0){ S.wsOk = false; S.wsTry++; startPoll(); paintSt(); setTimeout(() => { if (my === S.gen && !S.wsOk) connect(sym); }, 8000); } }; ws.onerror = () => {}; return ws; }).filter(Boolean); }
function startPoll(){ if (S.poll) return; S.poll = setInterval(async () => { const my = S.gen, sym = S.sym; try { const p = S.mkt === "fut" ? `${FUT}/fapi/v1/klines?symbol=${sym}&interval=1m&limit=3` : null;
    const k = p ? await getJ(p) : await spotJ(`/api/v3/klines?symbol=${sym}&interval=1m&limit=3`); if (my !== S.gen) return;
    for (const r of k){ const T = +r[6]; onKline({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5], T, V: r[9], x: T < now() }, "1m"); } loadBook(sym, my); } catch(e){} }, 3000); }
function stopPoll(){ if (S.poll){ clearInterval(S.poll); S.poll = null; } }
async function start(sym){ sym = String(sym || S.sym).toUpperCase().replace(/[^A-Z0-9]/g, ""); if (!sym) return; const my = ++S.gen; S.sym = sym; S.A = null; S.err = null; S.book = null; S.der = {}; stopPoll(); localStorage.setItem("neon.scalp.sym", sym);
  const q = $("#sc-q"); if (q) q.value = sym; const bt = $("#sc-bt"); if (bt) bt.innerHTML = ""; paintAll();
  try { await loadKlines(sym, my); if (my !== S.gen) return; if (!S.b["1m"].length) throw new Error("mum verisi yok");
    await Promise.all([loadDer(sym, my), loadBook(sym, my)]); if (my !== S.gen) return; resolveAll(); connect(sym); compute(true); }
  catch(e){ if (my === S.gen){ S.err = sym + " bulunamadı / veri alınamadı (" + e.message + ")"; paintAll(); } } }
/* ---------- signals ---------- */
function input(closedOnly){ const b1 = closedOnly ? S.b["1m"].filter(x => x.x) : S.b["1m"]; return { b1, b3: S.b["3m"], b5: S.b["5m"], book: S.book, der: S.der, now: now() }; }
let lastRun = 0;
function compute(force){ if (!S.b["1m"].length) return; const t = Date.now(); if (!force && t - lastRun < 900) return; lastRun = t; try { S.A = SCM.analyze(input(false)); } catch(e){ S.err = "hesap hatası: " + e.message; } if (visible()) paintAll(); }
function finalize(){ const b = S.b["1m"].filter(x => x.x), l = b[b.length - 1]; if (!l || l.t <= S.lastFinal) return; S.lastFinal = l.t; let A; try { A = SCM.analyze(input(true)); } catch(e){ return; } if (!A) return;
  const all = H.load(), L = all[S.sym] = all[S.sym] || []; if (L.length && L[0].t >= l.t) return;
  const prev = L[0], P = A.plan, e = { t: l.t, side: A.side, conf: A.conf, score: A.score, entry: l.c, stop: P && P.side ? P.stop : null, tp1: P && P.side ? P.tp1 : null, tp2: P && P.side ? P.tp2 : null, hold: P ? P.hold : null, res: {} };
  L.unshift(e); H.save(all); resolveAll();
  if (A.strong && S.snd && (!prev || prev.side !== A.side)) alarm(A.side); }
function resolveAll(){ const all = H.load(), L = all[S.sym]; if (!L) return; let ch = false; const b1 = S.b["1m"];
  for (const s of L){ if (s.side === "BEKLE" || !isFinite(s.stop)) continue; for (const h of [2, 3, 5]){ if (s.res[h]) continue; const r = SCM.outcome(s, b1, h); if (r){ s.res[h] = r; ch = true; ST.bump(S.sym, h, r); } } }
  if (ch){ H.save(all); paintHist(); } }
function alarm(side){ try { navigator.vibrate && navigator.vibrate(side === "LONG" ? [80, 60, 80] : [200]); } catch(e){}
  try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; const ac = alarm.ac = alarm.ac || new C(), o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = side === "LONG" ? 880 : 330; g.gain.value = 0.08; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.25); } catch(e){} }
/* ---------- paint ---------- */
const visible = () => document.body.dataset.pg === "scalp" && !document.hidden, row = (k, v, c) => `<div><span>${k}</span><b class="${c || ""}">${v}</b></div>`, mmss = ms => { ms = Math.max(0, ms); const s = Math.ceil(ms/1000); return Math.floor(s/60) + ":" + String(s % 60).padStart(2, "0"); };
function paintSt(){ const el = $("#sc-st"); if (!el) return; const age = S.lastTick ? Math.round((Date.now() - S.lastTick)/1000) : null;
  el.innerHTML = `${S.mkt === "fut" ? "Binance USDⓈ-M vadeli" : "Binance SPOT (vadeli yok → türev verisi yok)"} · ${S.wsOk && !S.poll ? '<span class="up">● canlı akış</span>' : S.poll ? '<span class="y">● REST yoklama (3 sn)</span>' : "○ bağlanıyor"}${age !== null ? ` · son tik ${age} sn` : ""}`; }
function paintMain(){ const el = $("#sc-main"); if (!el) return; if (S.err){ el.innerHTML = `<div class="err-line">✖ ${esc(S.err)}</div>`; return; } const A = S.A; if (!A){ el.innerHTML = `<div class="empty">veri yükleniyor… (1m/3m/5m mumlar + derinlik + türev)</div>`; return; }
  const P = A.plan, cls = A.side === "LONG" ? "up" : A.side === "SHORT" ? "dn" : "y", l = S.b["1m"][S.b["1m"].length - 1], left = l ? l.T + 1 - now() : 0, sc = Math.round(A.score*100);
  const ex = S.exitAt ? S.exitAt - now() : 0;
  el.innerHTML = `<div class="sc-head"><div><b class="can-sym">${esc(S.sym)}</b> <span class="sc-px">${fp(A.px)}</span><div class="dim">mum kapanışına <b id="sc-cd" class="sc-cd">${mmss(left)}</b> · 1m</div></div>
    <div class="sc-badge ${cls}${A.strong ? " strong" : ""}">${A.side}<small>${A.side !== "BEKLE" ? "güven %" + A.conf : A.veto.length && A.plan && A.plan.lean ? "filtre · eğilim " + A.plan.lean : "uyum %" + A.conf}</small></div></div>
    <div class="sc-bar"><i style="left:50%;width:0"></i><b class="${sc >= 0 ? "up" : "dn"}" style="${sc >= 0 ? `left:50%;width:${Math.min(50, Math.abs(sc)/2)}%` : `right:50%;width:${Math.min(50, Math.abs(sc)/2)}%`}"></b><span>SHORT</span><span>skor ${sc >= 0 ? "+" : ""}${sc}</span><span>LONG</span></div>
    ${A.veto.length ? `<div class="sc-veto">${A.veto.map(v => `<div>⏸ ${esc(v)}</div>`).join("")}</div>` : A.side === "BEKLE" ? `<div class="sc-veto"><div>⏸ indikatörler yeterince aynı yönde değil (skor ±20 ve güven %62 gerekir)</div></div>` : ""}
    ${P ? `<div class="can-plan">${P.side ? "" : `<div class="dim">eğilim: ${P.lean || "—"} (sinyal değil — yalnızca bilgi)</div>`}
      ${row("giriş (piyasa)", fp(P.entry))}${row("limit giriş", fp(P.limit) + " <small>(0.2 ATR geri çekilme)</small>")}
      ${row("stop", fp(P.stop) + ` <small>(%${P.riskPct.toFixed(3)})</small>`, "dn")}${row("TP1 · 1R", fp(P.tp1), "up")}${row("TP2 · 2R", fp(P.tp2), "up")}
      ${row("ücret sonrası TP1", P.netR1 > 0 ? `${P.netR1.toFixed(2)}R` : "ücreti karşılamaz", P.netR1 > 0.5 ? "up" : "dn")}${row("önerilen çıkış", `en geç ${P.hold} dk`, "y")}</div>` : ""}
    <div class="sc-exit">${S.exitAt ? `<div class="sc-ex-on">⏱ ${esc(S.exitSide)} çıkış sayacı <b id="sc-ex" class="${ex < 30000 ? "dn" : "y"}">${mmss(ex)}</b></div><button type="button" id="sc-exs" class="mini">SAYACI DURDUR</button>`
      : `<button type="button" id="sc-ex-go" class="mini wide" ${P && P.side ? "" : "disabled"}>⏱ GİRDİM → ${P ? P.hold : 3} DK ÇIKIŞ SAYACI BAŞLAT</button>`}</div>
    <div class="dim sc-note">canlı hesap her tikte · mum kapanınca sinyal geçmişe yazılır · RSI ${A.rsi.toFixed(0)} · ADX ${isFinite(A.adx) ? A.adx.toFixed(0) : "—"} · ATR %${A.atrPct.toFixed(3)} · uyum %${Math.round(A.agree*100)}</div>`;
  const g = $("#sc-ex-go"); if (g) g.onclick = () => { if (!S.A || !S.A.plan || !S.A.plan.side) return; S.exitAt = now() + S.A.plan.hold*60000; S.exitSide = S.A.side; paintMain(); };
  const s = $("#sc-exs"); if (s) s.onclick = () => { S.exitAt = 0; paintMain(); }; }
function paintVotes(){ const el = $("#sc-votes"); if (!el || !S.A) return; const V = S.A.votes.slice().sort((a, z) => Math.abs(z.v*z.w) - Math.abs(a.v*a.w));
  el.innerHTML = `<table class="can-t sc-t"><tr><th>indikatör</th><th>değer</th><th>oy</th><th>ağ.</th></tr>${V.map(v => { const c = v.v > 0.1 ? "up" : v.v < -0.1 ? "dn" : "dim";
    return `<tr><td>${esc(v.name)}</td><td class="sc-val">${esc(v.val)}</td><td class="${c}">${v.v > 0.1 ? "▲" : v.v < -0.1 ? "▼" : "•"} ${v.v >= 0 ? "+" : ""}${v.v.toFixed(2)}</td><td>${v.w ? v.w.toFixed(1) : "filtre"}</td></tr>`; }).join("")}</table>`; }
function paintHist(){ const el = $("#sc-hist"); if (!el) return; const L = (H.load()[S.sym] || []), st = SCM.stats(L), tot = (ST.load()[S.sym] || {}), pct = x => x === null || !isFinite(x) ? "—" : "%" + x.toFixed(0);
  const tr = h => { const T = tot[h] || { n: 0, tp: 0, sl: 0, dir: 0 }, hit = T.tp + T.sl ? T.tp/(T.tp + T.sl)*100 : null; return `<tr><td>${h} dk</td><td><b class="${st[h].hit >= 50 ? "up" : st[h].hit === null ? "" : "dn"}">${pct(st[h].hit)}</b> <small>${st[h].tp}/${st[h].tp + st[h].sl}</small></td><td>${pct(st[h].dir)} <small>n${st[h].n}</small></td><td class="${st[h].pnl >= 0 ? "up" : "dn"}">${st[h].pnl >= 0 ? "+" : ""}${st[h].pnl.toFixed(2)}%</td><td>${pct(hit)} <small>${T.tp}/${T.tp + T.sl}</small></td></tr>`; };
  const oc = r => !r ? '<span class="dim">…</span>' : `<span class="${r.r === "TP" || r.r === "+" ? "up" : "dn"}">${r.r === "TP" ? "TP" : r.r === "SL" ? "SL" : r.r + Math.abs(r.pnl).toFixed(2)}</span>`;
  el.innerHTML = `<table class="can-t"><tr><th>süre</th><th>TP isabet (son 50)</th><th>yön doğru</th><th>Σ %</th><th>tüm zamanlar</th></tr>${[2, 3, 5].map(tr).join("")}</table>
    <div class="dim sc-note">TP isabet = TP1'e stoptan önce ulaşan / (TP + SL). Aynı mumda ikisi de değerse SL sayılır. "yön doğru" = süre sonunda kârda. Ücret dahil değil. BEKLE sayılmaz.</div>
    <div class="sc-hl"><table class="can-t"><tr><th>saat</th><th>sinyal</th><th>giriş</th><th>2dk</th><th>3dk</th><th>5dk</th></tr>${L.length ? L.map(s => `<tr><td>${new Date(s.t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</td><td class="${s.side === "LONG" ? "up" : s.side === "SHORT" ? "dn" : "dim"}">${s.side}${s.side !== "BEKLE" ? ` <small>%${s.conf}</small>` : ""}</td><td>${s.side === "BEKLE" ? "—" : fp(s.entry)}</td>${s.side === "BEKLE" ? '<td colspan="3" class="dim">—</td>' : [2, 3, 5].map(h => `<td>${oc(s.res[h])}</td>`).join("")}</tr>`).join("") : '<tr><td colspan="6" class="dim">henüz kapanmış mum yok — her 1m kapanışta bir satır eklenir</td></tr>'}</table></div>
    <button type="button" id="sc-clr" class="mini">bu coinin geçmişini sıfırla</button>`;
  $("#sc-clr").onclick = () => { if (!confirm(S.sym + " sinyal geçmişi ve istatistiği silinsin mi? (yalnızca bu cihaz)")) return; const a = H.load(); delete a[S.sym]; H.save(a); const o = ST.load(); delete o[S.sym]; localStorage.setItem(SK, JSON.stringify(o)); paintHist(); }; }
function paintChart(){ const cv = $("#sc-cv"); if (!cv || !S.A) return; const w = cv.clientWidth || 340, h = 170, dpr = window.devicePixelRatio || 1; if (cv.width !== Math.round(w*dpr)){ cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); } const x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
  const b = S.b["1m"].slice(-60), P = S.A.plan, lv = [P && P.stop, P && P.tp1, P && P.tp2].filter(isFinite); let hi = Math.max(...b.map(k => k.h), ...lv), lo = Math.min(...b.map(k => k.l), ...lv); if (hi === lo){ hi += 1; lo -= 1; }
  const pad = 6, cw = (w - 46)/b.length, Y = p => pad + (hi - p)/(hi - lo)*(h - 2*pad);
  const c = b.map(k => k.c), e9 = SCM.ema(S.b["1m"].map(k => k.c), 9).slice(-60), e21 = SCM.ema(S.b["1m"].map(k => k.c), 21).slice(-60);
  b.forEach((k, i) => { const X = i*cw + cw/2, up = k.c >= k.o; x.strokeStyle = x.fillStyle = up ? "#39ff14" : "#ff3355"; x.beginPath(); x.moveTo(X, Y(k.h)); x.lineTo(X, Y(k.l)); x.stroke(); const y1 = Y(Math.max(k.o, k.c)), y2 = Y(Math.min(k.o, k.c)); x.fillRect(X - cw*0.35, y1, cw*0.7, Math.max(1, y2 - y1)); });
  const ln = (a, col) => { x.strokeStyle = col; x.lineWidth = 1; x.beginPath(); a.forEach((v, i) => { if (!isFinite(v)) return; const X = i*cw + cw/2; i ? x.lineTo(X, Y(v)) : x.moveTo(X, Y(v)); }); x.stroke(); }; ln(e9, "#ffe600"); ln(e21, "#ff2bd6");
  const hl = (p, col, t) => { if (!isFinite(p)) return; x.strokeStyle = col; x.setLineDash([4, 3]); x.beginPath(); x.moveTo(0, Y(p)); x.lineTo(w - 46, Y(p)); x.stroke(); x.setLineDash([]); x.fillStyle = col; x.font = "10px monospace"; x.fillText(t, w - 44, Y(p) + 3); };
  if (P){ hl(P.stop, "#ff3355", "STOP"); hl(P.tp1, "#39ff14", "TP1"); hl(P.tp2, "#39ff14", "TP2"); } hl(S.A.px, "#00f0ff", fp(S.A.px).slice(0, 8)); void c; }
function paintAll(){ paintSt(); paintMain(); paintVotes(); paintHist(); paintChart(); }
function tick(){ if (!S.started) return; if (S.exitAt && now() >= S.exitAt){ const sd = S.exitSide; S.exitAt = 0; alarm(sd); window.NOTIFY && NOTIFY.toast && NOTIFY.toast("⏱ SCALP çıkış zamanı (" + sd + ")", "warn"); if (visible()) paintMain(); }
  if (!visible()) return; const l = S.b["1m"][S.b["1m"].length - 1], cd = $("#sc-cd"), ex = $("#sc-ex"); if (cd && l) cd.textContent = mmss(l.T + 1 - now()); if (ex) ex.textContent = mmss(S.exitAt - now());
  if (l && !S.poll && ((!S.wsOk && now() > l.T + 5000) || (S.wsOk && Date.now() - Math.max(S.lastTick, S.wsAt || 0) > 10000))) startPoll(); if (S.mkt === "fut" && Date.now() - (S.der.at || 0) > 60000 && S.A){ S.der.at = Date.now(); loadDer(S.sym, S.gen).then(() => compute(true)); }
  if (Date.now() - (S.book ? S.book.at : 0) > 15000 && S.A){ S.book = S.book || { bid: NaN, ask: NaN }; S.book.at = Date.now(); loadBook(S.sym, S.gen); } compute(); paintSt(); }
function bind(){ const q = $("#sc-q"); q.oninput = () => paintList(q.value); q.onfocus = () => { q.select(); loadList().then(() => paintList("")); };
  q.onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); const r = search(q.value)[0]; pick(r && r.s === q.value.trim().toUpperCase() ? r.s : (r ? r.s : q.value)); } };
  $("#sc-list").onclick = e => { const b = e.target.closest("[data-ss]"); if (b) pick(b.dataset.ss); };
  $("#sc-go").onclick = () => { const v = q.value.trim().toUpperCase(), r = search(v)[0]; pick(r && (r.s === v || !v.endsWith("USDT")) ? r.s : v); };
  document.querySelector(".sc-quick").onclick = e => { const b = e.target.closest("[data-sq]"); if (b) pick(b.dataset.sq); };
  $("#sc-bt-go").onclick = runBt;
  $("#sc-snd").onchange = e => { S.snd = e.target.checked; localStorage.setItem("neon.scalp.snd", S.snd ? "1" : "0"); if (S.snd) alarm("LONG"); };
  document.addEventListener("click", e => { if (!e.target.closest(".sc-search") && !e.target.closest("#sc-list")){ const l = $("#sc-list"); l && l.classList.add("hidden"); } });
  window.addEventListener("resize", () => visible() && paintChart()); let hidAt = 0; document.addEventListener("visibilitychange", () => { if (document.hidden){ hidAt = Date.now(); return; } if (S.started && hidAt && Date.now() - hidAt > 20000) start(S.sym); hidAt = 0; }); /* phone was asleep → reload bars, resolve outcomes, reconnect */ }
function runBt(){ const el = $("#sc-bt"); if (!el || !S.b["1m"].length) return; el.innerHTML = '<div class="empty">hesaplanıyor…</div>'; const sym = S.sym;
  setTimeout(() => { let R; try { R = SCM.backtest(S.b["1m"], S.b["3m"], S.b["5m"]); } catch(e){ el.innerHTML = `<div class="err-line">✖ ${esc(e.message)}</div>`; return; } const pct = x => x === null || !isFinite(x) ? "—" : "%" + x.toFixed(0);
    el.innerHTML = `<div class="dim sc-note">${esc(sym)} · ${R.n} mum · ${R.sig} LONG/SHORT sinyali</div><table class="can-t"><tr><th>süre</th><th>TP isabet</th><th>yön doğru</th><th>ort. %/işlem</th></tr>${[2, 3, 5].map(h => { const x = R.st[h]; return `<tr><td>${h} dk</td><td><b class="${x.hit >= 50 ? "up" : "dn"}">${pct(x.hit)}</b> <small>${x.tp}/${x.tp + x.sl}</small></td><td>${pct(x.dir)}</td><td class="${x.pnl >= 0 ? "up" : "dn"}">${x.n ? (x.pnl/x.n >= 0 ? "+" : "") + (x.pnl/x.n).toFixed(3) : "—"}%</td></tr>`; }).join("")}</table>
      <div class="dim sc-note">1R hedefte %50 ≈ yazı-tura. Ortalama işlem kârı ~%0.10 ücretin altındaysa bu coinde bu sinyalle scalp kârlı değildir.</div>`; }, 30); }
function pick(sym){ const q = $("#sc-q"); q.value = sym; $("#sc-list").classList.add("hidden"); q.blur(); start(sym); }
function ensure(){ if (S.started) { if (visible()) paintAll(); return; } S.started = true; getJ(FUT + "/fapi/v1/time").then(t => { S.off = +t.serverTime - Date.now(); }).catch(() => {}); start(S.sym); setInterval(tick, 1000); }
function init(){ const box = $("#scalp-box"); if (!box) return; box.innerHTML = html(); bind(); if (document.body.dataset.pg === "scalp") ensure();
  window.addEventListener("hashchange", () => { if (document.body.dataset.pg === "scalp") ensure(); }); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
return { ensure, start, get S(){ return S; } };
})();
