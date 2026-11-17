/* NEON//TERMINAL v7.13 — AKILLI SİNYAL engine (pure math, no DOM, no network). Exported as SMT (window.SMT / module.exports).
   • prep(): every indicator computed ONCE over the whole series; votesAt(i) only reads values at ≤ i (no lookahead).
   • walk(): walk-forward self-learning — each feature's hit rate is learned only from candles whose outcome was already known at that time
     (exponentially decayed so it adapts), features that do not predict get weight 0, ones that work backwards get a negative weight.
   • A+ filter: a LONG/SHORT is shown only when the learned score is strong, the parts agree, higher timeframes do not oppose, the move pays for fees,
     the time-of-day is not a losing one AND this setup's own past result on this coin+interval is ≥55 % with ≥20 samples and positive average after fees.
   • squeeze → breakout (SIKIŞMA / PUMP / DUMP / SAHTE KIRILIM), contextual candle patterns with per-pattern hit rates, CVD divergence, key levels,
     BTC lead–lag, session stats. Live-only helpers: liquidation magnets (from OI history) and order-book walls / spoofing.
   Everything here is probabilistic. Nothing places orders. */
"use strict";
(function (root, factory){ const M = factory(typeof module === "object" && module.exports ? require("./scalp.js") : root.SCM); if (typeof module === "object" && module.exports) module.exports = M; else root.SMT = M; })(typeof self !== "undefined" ? self : this, function (SCM){
const fin = x => typeof x === "number" && isFinite(x), clip = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x)), sgn = (x, band = 0) => x > band ? 1 : x < -band ? -1 : 0, last = a => a[a.length - 1];
const FEE = 0.10; /* % round trip, taker both sides */
const NAMES = { ema: "EMA 9/21/50", vwap: "VWAP", rsi: "RSI 14", rdiv: "RSI uyumsuzluk", srsi: "Stoch RSI", macd: "MACD", bb: "Bollinger", st: "SuperTrend", adx: "ADX/DMI", ichi: "Ichimoku", psar: "Parabolic SAR",
  cci: "CCI", wr: "Williams %R", mfi: "MFI", obv: "OBV", cvd: "CVD / taker delta", vol: "Hacim patlaması", ha: "Heikin Ashi", pat: "Mum formasyonu (bağlamlı)", cvdd: "CVD uyumsuzluğu", lvl: "Kilit seviye", sqz: "Sıkışma kırılımı",
  btc: "BTC öncülük", mtf: "Üst zaman dilimleri", ext: "Aşırı uzama" };
const FT = ["ema", "vwap", "rsi", "rdiv", "srsi", "macd", "bb", "st", "adx", "ichi", "psar", "cci", "wr", "mfi", "obv", "cvd", "vol", "ha", "pat", "cvdd", "lvl", "sqz", "btc", "mtf"];
const FR = ["rsi", "srsi", "bb", "cci", "wr", "mfi", "rdiv", "pat", "cvdd", "lvl", "ext", "vwap"];
const SESS = h => h < 7 ? "Asya" : h < 13 ? "Avrupa" : h < 21 ? "ABD" : "Gece";
/* ---------------- candle patterns (bar i, uses i-2..i) ---------------- */
function patternsAt(b, i){ const out = []; if (i < 2) return out; const x = b[i], p = b[i - 1], q = b[i - 2], rng = x.h - x.l || 1e-12, body = Math.abs(x.c - x.o), up = x.h - Math.max(x.o, x.c), lo = Math.min(x.o, x.c) - x.l;
  const pb = Math.abs(p.c - p.o), prng = p.h - p.l || 1e-12, bull = x.c > x.o, pbull = p.c > p.o, add = (k, n, d) => out.push({ k, n, d });
  if (bull && !pbull && x.c >= p.o && x.o <= p.c && body > pb) add("engB", "Yutan boğa", 1);
  if (!bull && pbull && x.o >= p.c && x.c <= p.o && body > pb) add("engS", "Yutan ayı", -1);
  if (body/rng < 0.1) add("doji", "Doji", 0);
  const hammerShape = lo >= 2*body && up <= 0.35*body + 0.1*rng, invShape = up >= 2*body && lo <= 0.35*body + 0.1*rng;
  if (hammerShape) add(lo/rng > 0.66 ? "pinB" : "hammer", lo/rng > 0.66 ? "Pin bar ↑" : "Çekiç / Asılı adam", 0); /* direction from context */
  if (invShape) add(up/rng > 0.66 ? "pinS" : "invh", up/rng > 0.66 ? "Pin bar ↓" : "Ters çekiç / Kayan yıldız", 0);
  if (body/rng > 0.85) add(bull ? "maruB" : "maruS", bull ? "Marubozu yeşil" : "Marubozu kırmızı", bull ? 1 : -1);
  const qb = Math.abs(q.c - q.o), qr = q.h - q.l || 1e-12;
  if (q.c < q.o && qb/qr > 0.5 && pb/prng < 0.3 && bull && x.c > (q.o + q.c)/2) add("mstar", "Sabah yıldızı", 1);
  if (q.c > q.o && qb/qr > 0.5 && pb/prng < 0.3 && !bull && x.c < (q.o + q.c)/2) add("estar", "Akşam yıldızı", -1);
  if (bull && pbull && q.c > q.o && x.c > p.c && p.c > q.c && body/rng > 0.5 && pb/prng > 0.5 && qb/qr > 0.5) add("3ws", "Üç beyaz asker", 1);
  if (!bull && !pbull && q.c < q.o && x.c < p.c && p.c < q.c && body/rng > 0.5 && pb/prng > 0.5 && qb/qr > 0.5) add("3bc", "Üç kara karga", -1);
  if (Math.max(x.o, x.c) < Math.max(p.o, p.c) && Math.min(x.o, x.c) > Math.min(p.o, p.c) && pb > 2*body) add(pbull ? "haramiS" : "haramiB", pbull ? "Harami ayı" : "Harami boğa", pbull ? -1 : 1);
  const tol = 0.05*rng; if (Math.abs(x.h - p.h) <= tol && pbull && !bull) add("twT", "Cımbız tepe", -1); if (Math.abs(x.l - p.l) <= tol && !pbull && bull) add("twB", "Cımbız dip", 1);
  if (x.h <= p.h && x.l >= p.l) add("inside", "İç bar", 0); if (x.h > p.h && x.l < p.l) add("outside", "Dış bar", bull ? 1 : -1);
  return out; }
/* ---------------- prep: all series once ---------------- */
function rollMid(b, p){ const o = Array(b.length).fill(null); for (let i = p - 1; i < b.length; i++){ let hi = -Infinity, lo = Infinity; for (let j = i - p + 1; j <= i; j++){ if (b[j].h > hi) hi = b[j].h; if (b[j].l < lo) lo = b[j].l; } o[i] = (hi + lo)/2; } return o; }
function prepHigher(hb){ if (!hb || hb.length < 40) return null; const c = hb.map(x => x.c), e9 = SCM.ema(c, 9), e21 = SCM.ema(c, 21), st = SCM.supertrend(hb).dir, h = SCM.macd(c).hist, A = SCM.atr(hb);
  const v = hb.map((x, i) => { if (i < 30 || !fin(e21[i])) return null; const a = A[i] || x.c*0.001; return (sgn(e9[i] - e21[i], 0.05*a) + st[i] + sgn(h[i], 0.02*a) + sgn(x.c - e21[i], 0.2*a))/4; }); return { T: hb.map(x => x.T), v }; }
function prep(b, o = {}){ const n = b.length, c = b.map(x => x.c), v = b.map(x => x.v), tms = o.tms || 6e4;
  const P = { b, n, c, tms, e9: SCM.ema(c, 9), e21: SCM.ema(c, 21), e50: SCM.ema(c, 50), rsi: SCM.rsi(c), sr: SCM.stochRsi(c), M: SCM.macd(c), B: SCM.boll(c), A: SCM.atr(b), A50: SCM.atr(b, 50), ST: SCM.supertrend(b), X: SCM.adx(b),
    t9: rollMid(b, 9), k26: rollMid(b, 26), s52: rollMid(b, 52), PS: SCM.psar(b), CC: SCM.cci(b), WR: SCM.willr(b), MF: SCM.mfi(b), OB: SCM.obv(b), vw: SCM.vwap(b, tms < 36e5 ? 864e5 : tms <= 144e5 ? 6048e5 : 2592e6),
    HA: SCM.heikin(b), vs20: SCM.sma(v, 20), vs50: SCM.sma(v, 50), vs5: SCM.sma(v, 5), ke: SCM.ema(c, 20) };
  let cv = 0; P.cvd = b.map(x => (cv += fin(x.tb) ? 2*x.tb - x.v : 0)); P.dlt = b.map(x => fin(x.tb) && x.v ? (2*x.tb - x.v)/x.v : 0);
  P.H1 = prepHigher(o.h1); P.H2 = prepHigher(o.h2); P.btc = o.btc && o.btc.length > 60 ? o.btc : null; if (P.btc) P.btcA = SCM.atr(P.btc);
  /* squeeze box per bar (bars i-len+1 … i) and state */
  P.box = Array(n).fill(null); P.sq = Array(n).fill(false);
  for (let i = 60; i < n; i++){ const a50 = P.A50[i] || P.A[i] || c[i]*0.002; let hi = -Infinity, lo = Infinity, len = 0;
    for (let k = 0; k < 48 && i - k >= 0; k++){ const x = b[i - k], nh = Math.max(hi, x.h), nl = Math.min(lo, x.l); if (nh - nl > 2.6*a50) break; hi = nh; lo = nl; len = k + 1; }
    const w = P.B.bw.slice(Math.max(0, i - 120), i + 1).filter(fin).sort((p, q) => p - q), bwLow = w.length > 40 && P.B.bw[i] <= w[Math.floor(w.length*0.2)];
    const kcIn = fin(P.B.up[i]) && fin(P.ke[i]) && P.B.up[i] < P.ke[i] + 1.5*P.A[i] && P.B.lo[i] > P.ke[i] - 1.5*P.A[i], atrDrop = fin(P.A[i]) && fin(P.A50[i]) && P.A[i] < 0.85*P.A50[i], volDry = fin(P.vs5[i]) && fin(P.vs50[i]) && P.vs5[i] < 0.8*P.vs50[i];
    P.box[i] = len >= 10 ? { hi, lo, len, from: i - len + 1 } : null; P.sq[i] = len >= 10 && (bwLow || kcIn) && (atrDrop || volDry) ? { bwLow, kcIn, atrDrop, volDry } : false; }
  /* key levels (UTC day / week) from bars before i */
  P.lv = Array(n).fill(null); { let day = null, dH = -Infinity, dL = Infinity, pH = NaN, pL = NaN, wk = null, wO = NaN; const daily = tms >= 864e5;
    for (let i = 0; i < n; i++){ const x = b[i], d = Math.floor(x.t/864e5), w = Math.floor((x.t + 3*864e5)/6048e5);
      if (w !== wk){ wk = w; wO = x.o; }
      if (daily){ P.lv[i] = { dH: i ? b[i - 1].h : NaN, dL: i ? b[i - 1].l : NaN, pH: i > 1 ? b[i - 2].h : NaN, pL: i > 1 ? b[i - 2].l : NaN, wO }; continue; }
      if (d !== day){ if (day !== null){ pH = dH; pL = dL; } day = d; dH = -Infinity; dL = Infinity; }
      P.lv[i] = { dH: dH > -Infinity ? dH : NaN, dL: dL < Infinity ? dL : NaN, pH, pL, wO }; dH = Math.max(dH, x.h); dL = Math.min(dL, x.l); } }
  return P; }
function divAt(P, i, lb = 40){ const b = P.b, r = P.rsi, s = Math.max(2, i - lb), lows = [], highs = [];
  for (let j = s; j <= i - 2; j++){ if (r[j] === null) continue; const L = b[j].l, H = b[j].h; if (L <= b[j - 1].l && L <= b[j - 2].l && L < b[j + 1].l && L < b[j + 2].l) lows.push(j); if (H >= b[j - 1].h && H >= b[j - 2].h && H > b[j + 1].h && H > b[j + 2].h) highs.push(j); }
  if (lows.length >= 2){ const [a, c] = lows.slice(-2); if (b[c].l < b[a].l && r[c] > r[a] + 2 && i - c <= 8) return 1; } if (highs.length >= 2){ const [a, c] = highs.slice(-2); if (b[c].h > b[a].h && r[c] < r[a] - 2 && i - c <= 8) return -1; } return 0; }
function hiAt(H, T){ if (!H) return null; let lo = 0, hi = H.T.length - 1, k = -1; while (lo <= hi){ const m = (lo + hi) >> 1; if (H.T[m] <= T){ k = m; lo = m + 1; } else hi = m - 1; } return k >= 0 ? H.v[k] : null; }
/* context for patterns: at a level/swing and after a move, volume ≥ 1.2× → direction; returns { v, list } */
function patCtx(P, i, A1){ const b = P.b, ps = patternsAt(b, i); if (!ps.length) return { v: 0, list: [] }; const x = b[i], mv = (x.c - b[Math.max(0, i - 6)].c)/A1, vol = fin(P.vs20[i]) && x.v >= 1.2*P.vs20[i];
  let swL = Infinity, swH = -Infinity; for (let j = Math.max(0, i - 30); j < i - 1; j++){ swL = Math.min(swL, b[j].l); swH = Math.max(swH, b[j].h); }
  const L = P.lv[i] || {}, lv = [L.dH, L.dL, L.pH, L.pL, L.wO, swL, swH].filter(fin), near = p => lv.some(q => Math.abs(p - q) <= 0.5*A1);
  const list = []; let v = 0;
  for (const p of ps){ let d = p.d; if (p.k === "hammer" || p.k === "pinB") d = mv < -1 ? 1 : mv > 1 ? -1 : 0; if (p.k === "invh" || p.k === "pinS") d = mv > 1 ? -1 : mv < -1 ? 1 : 0;
    if (p.k === "hammer" && d < 0) p.n = "Asılı adam"; if (p.k === "hammer" && d > 0) p.n = "Çekiç"; if (p.k === "invh" && d < 0) p.n = "Kayan yıldız"; if (p.k === "invh" && d > 0) p.n = "Ters çekiç";
    if (p.k === "inside" || p.k === "doji"){ list.push({ ...p, d: 0, ctx: false }); continue; }
    const rev = d !== 0 && sgn(mv) === -d && Math.abs(mv) >= 1, cont = (p.k === "3ws" || p.k === "3bc" || p.k === "maruB" || p.k === "maruS" || p.k === "outside");
    const ctx = d !== 0 && vol && (cont ? true : rev && (near(x.l) || near(x.h) || Math.abs(mv) >= 2)); list.push({ ...p, d, ctx }); if (ctx) v += d; }
  return { v: clip(v), list }; }
/* ---------------- votes at bar i (trend set T, reversal set R) ---------------- */
function votesAt(P, i){ const b = P.b, c = P.c, px = c[i], A1 = P.A[i] || px*0.001, T = {}, R = {}, info = {};
  const E9 = P.e9[i], E21 = P.e21[i], E50 = P.e50[i], cross = sgn(P.e9[i] - P.e21[i]) !== sgn(P.e9[i - 3] - P.e21[i - 3]) ? sgn(E9 - E21)*0.3 : 0;
  T.ema = clip((sgn(E9 - E21, 0.05*A1) + sgn(E21 - E50, 0.05*A1) + sgn((E9 - P.e9[i - 3])/A1, 0.1))/3 + cross);
  const dv = (px - P.vw[i])/A1; T.vwap = Math.abs(dv) < 0.2 ? 0 : Math.abs(dv) > 4 ? -sgn(dv)*0.3 : sgn(dv)*Math.min(1, 0.4 + Math.abs(dv)/4); R.vwap = Math.abs(dv) > 3 ? -sgn(dv)*0.8 : Math.abs(dv) > 2 ? -sgn(dv)*0.4 : 0;
  const r0 = P.rsi[i], r1 = P.rsi[i - 1]; T.rsi = r0 > 78 ? -0.6 : r0 < 22 ? 0.6 : clip((r0 - 50)/30 + (r0 - r1)/20); R.rsi = r0 > 72 ? -1 : r0 > 65 ? -0.4 : r0 < 28 ? 1 : r0 < 35 ? 0.4 : 0;
  T.rdiv = R.rdiv = divAt(P, i);
  const K = P.sr.k[i], D = P.sr.d[i], K1 = P.sr.k[i - 1], D1 = P.sr.d[i - 1]; T.srsi = fin(K) && fin(D) ? clip((K - D)/40) : 0; R.srsi = 0;
  if (fin(K1) && fin(D1) && fin(K) && fin(D)){ if (K1 <= D1 && K > D && K < 30){ T.srsi = 1; R.srsi = 1; } else if (K1 >= D1 && K < D && K > 70){ T.srsi = -1; R.srsi = -1; } else if (K > 92) R.srsi = -0.4; else if (K < 8) R.srsi = 0.4; }
  const H = P.M.hist[i], H1 = P.M.hist[i - 1], zc = sgn(P.M.macd[i]) !== sgn(P.M.macd[i - 3]) ? sgn(P.M.macd[i])*0.3 : 0; T.macd = fin(H) && fin(H1) ? clip((Math.abs(H) < 0.01*A1 ? 0 : H > 0 ? (H > H1 ? 1 : 0.35) : (H < H1 ? -1 : -0.35)) + zc) : 0;
  const up = P.B.up[i], lo = P.B.lo[i], pb = up > lo ? (px - lo)/(up - lo) : 0.5, sqPrev = P.sq[i - 1]; T.bb = px > up ? (sqPrev ? 1 : -0.3) : px < lo ? (sqPrev ? -1 : 0.3) : (pb - 0.5)*0.6; R.bb = px > up ? -1 : px < lo ? 1 : pb > 0.9 ? -0.4 : pb < 0.1 ? 0.4 : 0;
  const sd = P.ST.dir[i]; T.st = sd*(P.ST.dir[i - 1] !== sd || P.ST.dir[i - 2] !== sd ? 1 : 0.8);
  const AX = P.X.adx[i], PD = P.X.pdi[i], MD = P.X.mdi[i]; T.adx = fin(AX) && AX > 18 ? sgn(PD - MD)*Math.min(1, (AX - 15)/20) : 0;
  { const j = i - 26, sa = j >= 0 && fin(P.t9[j]) && fin(P.k26[j]) ? (P.t9[j] + P.k26[j])/2 : null, sb = j >= 0 ? P.s52[j] : null, top = sa !== null && fin(sb) ? Math.max(sa, sb) : null, bot = sa !== null && fin(sb) ? Math.min(sa, sb) : null;
    const cvv = top === null ? 0 : px > top ? 1 : px < bot ? -1 : 0, tk = fin(P.t9[i]) && fin(P.k26[i]) ? sgn(P.t9[i] - P.k26[i], 0.02*A1) : 0; T.ichi = (cvv + tk)/2; }
  T.psar = P.PS.up[i]*(P.PS.up[i - 1] !== P.PS.up[i] ? 1 : 0.7);
  const C0 = P.CC[i], C1 = P.CC[i - 1]; T.cci = !fin(C0) ? 0 : C0 > 200 ? -0.4 : C0 < -200 ? 0.4 : C0 > 100 ? (C0 > C1 ? 0.6 : 0.1) : C0 < -100 ? (C0 < C1 ? -0.6 : -0.1) : C0/250; R.cci = !fin(C0) ? 0 : C0 > 150 && C0 < C1 ? -1 : C0 < -150 && C0 > C1 ? 1 : 0;
  const w0 = P.WR[i], w1 = P.WR[i - 1]; T.wr = !fin(w0) || !fin(w1) ? 0 : w1 < -50 && w0 >= -50 ? 0.5 : w1 > -50 && w0 <= -50 ? -0.5 : 0; R.wr = !fin(w0) || !fin(w1) ? 0 : w1 > -10 && w0 < w1 ? -0.8 : w1 < -90 && w0 > w1 ? 0.8 : 0;
  const mf = P.MF[i]; T.mfi = !fin(mf) ? 0 : clip((mf - 50)/50*0.6); R.mfi = !fin(mf) ? 0 : mf > 80 ? -1 : mf < 20 ? 1 : 0;
  const avgV = P.vs20[i - 1] || 1, os = ((P.OB[i] - P.OB[i - 10])/10)/avgV; T.obv = Math.abs(os) < 0.05 ? 0 : clip(os*1.5);
  let tb = 0, tv = 0; for (let j = i - 4; j <= i; j++){ tv += b[j].v; tb += fin(b[j].tb) ? b[j].tb : b[j].v/2; } const dr = tv ? (2*tb - tv)/tv : 0; T.cvd = Math.abs(dr) < 0.04 ? 0 : clip(dr*3);
  const vr = P.volProj && i === P.n - 1 ? P.volProj : b[i].v; const rv = vr/avgV; T.vol = rv >= 1.8 ? sgn(b[i].c - b[i].o)*Math.min(1, (rv - 1)/2) : 0;
  const h3 = P.HA.slice(i - 2, i + 1), gr = h3.filter(x => x.c > x.o).length; T.ha = (gr - 1.5)/1.5;
  const pc = patCtx(P, i, A1); T.pat = R.pat = pc.v; info.pats = pc.list;
  { let mxH = -Infinity, mxC = -Infinity, mnL = Infinity, mnC = Infinity; for (let j = i - 20; j < i; j++){ mxH = Math.max(mxH, b[j].h); mxC = Math.max(mxC, P.cvd[j]); mnL = Math.min(mnL, b[j].l); mnC = Math.min(mnC, P.cvd[j]); }
    T.cvdd = R.cvdd = b[i].h >= mxH && P.cvd[i] < mxC ? -1 : b[i].l <= mnL && P.cvd[i] > mnC ? 1 : 0; }
  { const L = P.lv[i] || {}, lv = [["dH", L.dH, -1], ["dL", L.dL, 1], ["pH", L.pH, -1], ["pL", L.pL, 1], ["wO", L.wO, 0]].filter(x => fin(x[1])); let tv2 = 0, rv2 = 0, note = null; const x = b[i], pcl = b[i - 1].c, volOk = x.v >= 1.2*avgV || (P.volProj && i === P.n - 1 && P.volProj >= 1.2*avgV);
    for (const [k, p] of lv){ if (pcl <= p && x.c > p + 0.2*A1 && volOk){ tv2 += 1; note = k + " kırıldı ↑"; } else if (pcl >= p && x.c < p - 0.2*A1 && volOk){ tv2 -= 1; note = k + " kırıldı ↓"; }
      else if (x.h >= p - 0.15*A1 && x.c < p - 0.3*A1 && x.o < p){ rv2 -= 1; note = k + " reddedildi ↓"; } else if (x.l <= p + 0.15*A1 && x.c > p + 0.3*A1 && x.o > p){ rv2 += 1; note = k + " reddedildi ↑"; } }
    T.lvl = clip(tv2 + rv2); R.lvl = clip(rv2); info.lvl = note; }
  { const s = P.sq[i - 1], bx = P.box[i - 1], vOk = (P.volProj && i === P.n - 1 ? P.volProj : b[i].v) >= 1.3*(P.vs20[i - 1] || 1); T.sqz = 0;
    if (s && bx){ if (px > bx.hi + 0.1*A1 && vOk) T.sqz = 1; else if (px < bx.lo - 0.1*A1 && vOk) T.sqz = -1; } }
  T.btc = 0; if (P.btc){ const T0 = b[i].T; let k = -1; for (let j = P.btc.length - 1; j >= 0; j--) if (P.btc[j].T <= T0){ k = j; break; }
    if (k > 25){ const bb = P.btc, ba = P.btcA[k] || bb[k].c*0.002, bm = (bb[k].c - bb[k - 3].c)/ba, cm = (px - c[i - 3])/A1; let hh = -Infinity, ll = Infinity; for (let j = k - 20; j < k - 2; j++){ hh = Math.max(hh, bb[j].h); ll = Math.min(ll, bb[j].l); }
      const brk = bb[k].c > hh ? 1 : bb[k].c < ll ? -1 : 0; if (Math.abs(bm) >= 2 && brk === sgn(bm) && cm*sgn(bm) < 0.5*Math.abs(bm)){ T.btc = sgn(bm)*0.8; info.btc = { dir: sgn(bm), bm, cm }; } } }
  const m1 = hiAt(P.H1, b[i].T - P.tms), m2 = hiAt(P.H2, b[i].T - P.tms); { const ms = [m1, m2].filter(fin); T.mtf = ms.length ? ms.reduce((s, x) => s + x, 0)/ms.length : 0; info.mtf = [m1, m2]; }
  const ext = (px - E21)/A1; R.ext = Math.abs(ext) > 2 ? -sgn(ext) : Math.abs(ext) > 1.5 ? -sgn(ext)*0.5 : 0; info.ext = ext;
  info.revCtx = Math.abs(ext) >= 1.5 || r0 >= 70 || r0 <= 30 || R.lvl !== 0 || pc.v !== 0 || R.cvdd !== 0;
  for (const k in T) if (!fin(T[k])) T[k] = 0; for (const k in R) if (!fin(R[k])) R[k] = 0; return { T, R, info, A: A1 }; }
/* ---------------- walk-forward learning + A+ filter ---------------- */
const DECAY = 0.997, H_LAB = 3, H_OUT = 5;
function wOf(c){ if (!c || c.n < 15) return 0; const acc = (c.ok + 1)/(c.n + 2), z = (acc - 0.5)/(0.5/Math.sqrt(c.n)); return Math.abs(z) < 1.3 ? 0 : (acc - 0.5)*2*Math.min(1, c.n/120); }
function scoreOf(V, cnt, keys){ let s = 0, sw = 0, pos = 0, neg = 0; const parts = []; for (const k of keys){ const w = wOf(cnt[k]), v = V[k] || 0; if (!w) continue; const x = w*v; s += x; sw += Math.abs(w); if (x > 0) pos += x; else neg -= x; if (Math.abs(x) > 1e-9) parts.push({ k, w, v, x }); }
  return { S: sw ? s/Math.max(sw, 0.6) : 0, agree: pos + neg ? Math.max(pos, neg)/(pos + neg) : 0, parts: parts.sort((a, b) => Math.abs(b.x) - Math.abs(a.x)) }; }
function resolveTrade(b, i, d, stop, tp, maxBars){ const e = b[i].c; for (let j = i + 1; j <= Math.min(b.length - 1, i + maxBars); j++){ const x = b[j]; if (x.x === false) return null;
    if (d > 0 ? x.l <= stop : x.h >= stop) return { r: "SL", pnl: d*(stop - e)/e*100, j }; if (d > 0 ? x.h >= tp : x.l <= tp) return { r: "TP", pnl: d*(tp - e)/e*100, j }; }
  if (i + maxBars > b.length - 1 || b[i + maxBars].x === false) return null; const x = b[i + maxBars]; return { r: d*(x.c - e) >= 0 ? "+" : "−", pnl: d*(x.c - e)/e*100, j: i + maxBars }; }
const bucket = () => ({ n: 0, tp: 0, sl: 0, pnl: 0 }), addB = (B, r) => { B.n++; if (r.r === "TP") B.tp++; else if (r.r === "SL") B.sl++; B.pnl += r.pnl - FEE; }, hitB = B => B.tp + B.sl ? B.tp/(B.tp + B.sl) : null;
/* opts: { mode: "trend"|"rev", from, minN, minHit } ; returns live state at the last bar + replay list of A+ signals and breakouts (all decided walk-forward) */
function walk(P, opts = {}){ const b = P.b, n = P.n, from = Math.max(60, opts.from || 60), mode = opts.mode === "rev" ? "rev" : "trend", minN = opts.minN || 20, minHit = opts.minHit || 0.55, keys = mode === "rev" ? FR : FT;
  const cntT = {}, cntR = {}, V = [], Sx = [], hourB = {}, setB = {}, patB = {}, sqB = { up: bucket(), dn: bucket(), ups: 0, dns: 0 }, pend = [], sqPend = [], sig = [], brk = [];
  const intraday = P.tms < 144e5, closedN = b[n - 1].x === false ? n - 1 : n;
  for (let i = from; i < n; i++){ const isLive = i >= closedN;
    /* 1) label for bar j = i - H_LAB is now known */
    const j = i - H_LAB; if (j >= from && !isLive){ const a = V[j - from]; if (a){ const mv = b[i].c - b[j].c, y = Math.abs(mv) >= 0.25*a.A ? sgn(mv) : 0;
      for (const cn of [cntT, cntR]) for (const k in cn){ cn[k].n *= DECAY; cn[k].ok *= DECAY; }
      if (y){ const upd = (cn, vv) => { for (const k in vv){ const v = vv[k]; if (Math.abs(v) <= 0.1) continue; const c = cn[k] = cn[k] || { n: 0, ok: 0 }; c.n++; if (sgn(v) === y) c.ok++; } }; upd(cntT, a.T); upd(cntR, a.R);
        for (const p of a.info.pats) if (p.ctx){ const B = patB[p.k] = patB[p.k] || { n: 0, ok: 0, name: p.n }; B.n++; if (p.d === y) B.ok++; }
        const s = Sx[j - from]; if (intraday && s && Math.abs(s) > 0.1){ const hr = new Date(b[j].t).getUTCHours(), hb = hourB[hr] = hourB[hr] || { n: 0, ok: 0 }; hb.n++; if (sgn(s) === y) hb.ok++; } } } }
    /* 2) resolve pending candidates / breakouts whose window has closed */
    for (let q = pend.length - 1; q >= 0; q--){ const c = pend[q]; if (c.i + H_OUT > i || isLive) continue; const r = resolveTrade(b, c.i, c.d, c.stop, c.tp, H_OUT); pend.splice(q, 1); if (!r) continue; c.res = r; addB(setB[c.key] = setB[c.key] || bucket(), r); }
    for (let q = sqPend.length - 1; q >= 0; q--){ const c = sqPend[q]; if (isLive) continue; const r = resolveTrade(b, c.i, c.d, c.stop, c.tp, c.max); if (!r && c.i + c.max > i) continue; if (r && r.j > i) continue; sqPend.splice(q, 1); if (!r) continue; c.res = r; addB(c.d > 0 ? sqB.up : sqB.dn, r); }
    /* 3) votes + learned score at i */
    const a = votesAt(P, i); V.push(a); const sc = scoreOf(mode === "rev" ? a.R : a.T, mode === "rev" ? cntR : cntT, keys); Sx.push(sc.S);
    const d = sgn(sc.S), A1 = a.A, px = b[i].c, sdist = 1.5*A1, sPct = sdist/px*100, hr = new Date(b[i].t).getUTCHours(), hb = hourB[hr];
    const why = []; let cand = Math.abs(sc.S) >= 0.2 && sc.agree >= 0.65 && d !== 0;
    if (!cand) why.push(Math.abs(sc.S) < 0.2 ? "öğrenilmiş skor zayıf" : "göstergeler çelişiyor");
    if (cand && mode === "trend"){ if (a.T.mtf*d <= -0.5){ cand = false; why.push("üst zaman dilimi ters"); } if (a.info.ext*d > 2){ cand = false; why.push("fiyat çok uzamış (kovalama)"); } }
    if (cand && mode === "rev" && !a.info.revCtx){ cand = false; why.push("dönüş bağlamı yok (uzama/seviye/formasyon)"); }
    if (cand && sPct < 0.15){ cand = false; why.push("hareket ücrete göre küçük"); }
    const key = mode + "|" + (Math.abs(sc.S) >= 0.4 ? "güçlü" : "orta"), SB = setB[key] || bucket(), sh = hitB(SB), net = SB.n ? SB.pnl/SB.n : null;
    let aplus = cand; if (cand){ if (SB.n < minN){ aplus = false; why.push(`kurulum örneği az (${SB.n}/${minN})`); } else if (sh < minHit){ aplus = false; why.push(`kurulum geçmişte %${Math.round(sh*100)} tuttu (<%${Math.round(minHit*100)})`); } else if (net <= 0){ aplus = false; why.push("kurulum ücret sonrası zararda"); } }
    if (aplus && intraday && hb && hb.n >= 15 && hb.ok/hb.n < 0.47){ aplus = false; why.push(`bu saat (${hr}:00 UTC) tutmuyor`); }
    const stop = px - d*sdist, tp = px + d*sdist;
    if (cand && !isLive) pend.push({ i, d, stop, tp, key });
    if (aplus && !isLive) sig.push({ i, t: b[i].t, d, entry: px, stop, tp, key, hit: sh, n: SB.n });
    /* squeeze / breakout */
    let sq = null; if (a.T.sqz && P.box[i - 1]){ const bx = P.box[i - 1], h = bx.hi - bx.lo, dd = a.T.sqz; sq = { kind: dd > 0 ? "PUMP" : "DUMP", box: bx, stop: dd > 0 ? bx.lo : bx.hi, tp: px + dd*h, d: dd };
      if (!isLive){ sqPend.push({ i, d: dd, stop: sq.stop, tp: sq.tp, max: Math.max(10, Math.min(30, bx.len)) }); brk.push({ i, d: dd, t: b[i].t, entry: px, stop: sq.stop, tp: sq.tp }); if (dd > 0) sqB.ups++; else sqB.dns++; } }
    if (i === n - 1){ const live = { i, a, sc, d, cand, aplus, why, key, setup: { n: SB.n, hit: sh, net }, plan: d ? { d, entry: px, stop, tp, tp2: px + 2*d*sdist, sPct, netR: (sPct - FEE)/sPct } : null, sq, hour: hr, hourB: hb, sess: SESS(hr) };
      /* fake-out: a breakout within the last 3 closed bars whose close is back inside its box */
      for (const k of brk.slice(-3)) if (i - k.i <= 3 && i > k.i){ const bx = P.box[k.i - 1]; if (bx && px < bx.hi && px > bx.lo) live.fake = { d: k.d, box: bx, at: k.i }; }
      const s0 = P.sq[i] || P.sq[i - 1]; if (!sq && s0) live.squeeze = { box: P.box[i] || P.box[i - 1], cond: s0 };
      const recent = brk.filter(k => i - k.i <= 2 && i > k.i).pop(); if (!sq && recent && !live.fake) live.sqRecent = recent;
      const out = { live, cntT, cntR, hourB, setB, patB, sqB, sig, brk, mode, keys, V, Sx, from }; return out; } }
  return null; }
/* squeeze direction probability from live flow (each input −1…+1) */
function squeezeDir(f){ const parts = [["konum (kutu içi)", f.pos, 0.6], ["CVD eğimi", f.cvd, 0.8], ["taker oranı", f.tk, 0.6], ["emir defteri", f.ob, 0.5], ["OI birikimi", f.oi, 0.4], ["funding", f.fund, 0.3], ["likidasyon mıknatısı", f.liq, 0.5], ["üst TF", f.mtf, 0.6], ["BTC", f.btc, 0.4]].filter(x => fin(x[1]));
  const s = parts.reduce((t, x) => t + x[1]*x[2], 0); return { pUp: 0.5 + 0.4*Math.tanh(s), parts }; }
/* liquidation magnets: OI increases (oiHist [{t, oi, px}], taker long share per point) placed at common leverage liq prices, swept clusters removed */
function liqMagnets(oiHist, px, bars, opts = {}){ const LEV = [[10, 0.35], [25, 0.3], [50, 0.2], [100, 0.15]], bin = px*0.0015, map = new Map();
  for (let k = 1; k < oiHist.length; k++){ const a = oiHist[k - 1], z = oiHist[k], dOi = (z.oi - a.oi)*z.px; if (!(dOi > 0)) continue; const ls = fin(z.ls) ? z.ls : 0.5;
    for (const [L, w] of LEV){ for (const [side, sh] of [[1, ls], [-1, 1 - ls]]){ const lp = side > 0 ? z.px*(1 - 1/L + 0.004) : z.px*(1 + 1/L - 0.004); let swept = false;
        for (const x of bars) if (x.t > z.t && (side > 0 ? x.l <= lp : x.h >= lp)){ swept = true; break; } if (swept) continue; const kb = Math.round(lp/bin); const e = map.get(kb) || { p: 0, usd: 0, side, w: 0 }; e.usd += dOi*w*sh; e.p += lp*dOi*w*sh; map.set(kb, e); } } }
  const cl = [...map.values()].filter(e => e.usd > 0).map(e => ({ p: e.p/e.usd, usd: e.usd, side: e.side })).filter(e => Math.abs(e.p/px - 1) < (opts.range || 0.15));
  const above = cl.filter(e => e.p > px).sort((a, b) => b.usd - a.usd).slice(0, 3).sort((a, b) => a.p - b.p), below = cl.filter(e => e.p < px).sort((a, b) => b.usd - a.usd).slice(0, 3).sort((a, b) => b.p - a.p);
  const ua = above.reduce((s, e) => s + e.usd, 0), ub = below.reduce((s, e) => s + e.usd, 0); return { above, below, pull: ua + ub ? (ua - ub)/(ua + ub) : 0 }; }
/* order-book walls + spoof tracking: book {bids,asks} (price, qty strings), mem persists between snapshots */
function walls(book, mem, now, opts = {}){ mem = mem || { w: new Map(), spoof: [] }; const bids = book.bids.map(([p, q]) => [+p, +q*+p]), asks = book.asks.map(([p, q]) => [+p, +q*+p]); if (!bids.length || !asks.length) return { mem, list: [] };
  const mid = (bids[0][0] + asks[0][0])/2, rng = mid*(opts.range || 0.03), lv = bids.concat(asks).filter(x => Math.abs(x[0] - mid) <= rng), us = lv.map(x => x[1]).sort((a, b) => a - b), med = us[Math.floor(us.length/2)] || 0, thr = Math.max(med*8, us[Math.floor(us.length*0.985)] || 0);
  const seen = new Set(), list = [];
  for (const [arr, side] of [[bids, 1], [asks, -1]]) for (const [p, u] of arr){ if (Math.abs(p - mid) > rng || u < thr) continue; const k = side + ":" + p; seen.add(k); const w = mem.w.get(k) || { p, side, first: now, max: 0, n: 0, minDist: Infinity }; w.last = now; w.u = u; w.max = Math.max(w.max, u); w.n++; w.minDist = Math.min(w.minDist, Math.abs(p - mid)/mid); mem.w.set(k, w); list.push(w); }
  for (const [k, w] of mem.w) if (!seen.has(k)){ const reached = Math.abs(w.p - mid)/mid < 0.0008; if (w.n >= 2 && !reached && now - w.first < 180000) mem.spoof.unshift({ p: w.p, side: w.side, usd: w.max, life: now - w.first, at: now }); mem.w.delete(k); }
  mem.spoof = mem.spoof.filter(s => now - s.at < 900000).slice(0, 12); const bU = list.filter(w => w.side > 0).reduce((s, w) => s + w.u, 0), aU = list.filter(w => w.side < 0).reduce((s, w) => s + w.u, 0);
  return { mem, mid, thr, list: list.sort((a, b) => b.u - a.u).slice(0, 8), tilt: bU + aU ? (bU - aU)/(bU + aU) : 0 }; }
/* replay summary of walk-forward A+ signals and breakouts (already decided without lookahead) */
function replay(W, b){ const res = { aplus: bucket(), brk: bucket() }; for (const s of W.sig){ const r = resolveTrade(b, s.i, s.d, s.stop, s.tp, H_OUT); if (r) addB(res.aplus, r); }
  for (const k of W.brk){ const bx = null; void bx; const r = resolveTrade(b, k.i, k.d, k.stop, k.tp, 20); if (r) addB(res.brk, r); } return res; }
return { patternsAt, prep, votesAt, walk, wOf, scoreOf, squeezeDir, liqMagnets, walls, replay, resolveTrade, hitB, NAMES, FT, FR, SESS, FEE, H_OUT, H_LAB };
});
