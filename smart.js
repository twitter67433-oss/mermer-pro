/* NEON//TERMINAL v7.14 — AKILLI SİNYAL engine (+ GENEL YÖN consensus) (pure math, no DOM, no network). Exported as SMT (window.SMT / module.exports).
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
/* ---------------- v7.14 GENEL YÖN: all-interval consensus (pure, no lookahead when fed closed data) ----------------
   Every interval gives a direction d ∈ [-1, 1] (its trend vote: EMA9/21, SuperTrend, MACD, price vs EMA21; an A+ / PUMP / DUMP state overrides to ±1).
   Weights: higher intervals carry the trend (big 60 %, mid 25 %, short 15 %); each interval's weight is scaled by its OWN measured reliability
   (how often its vote matched the next 3 candles, shrunk toward 50 % when there are few samples). Low reliability ⇒ less weight, never fake certainty. */
const GW = { "1m": 0.5, "3m": 0.6, "5m": 0.7, "15m": 0.9, "30m": 1, "1h": 1, "2h": 1, "4h": 1.15, "6h": 1, "8h": 0.9, "12h": 0.9, "1d": 1.1 };
const G_BIG = ["1h", "2h", "4h", "6h", "8h", "12h", "1d"], G_MID = ["15m", "30m"], G_SHORT = ["1m", "3m", "5m"], G_ALL = G_SHORT.concat(G_MID, G_BIG);
/* reliability of an interval's vote, only from samples whose outcome was known by `upTo` */
function tfRel(H, c, k = 3, upTo = Infinity){ let n = 0, w = 0; if (!H) return { n: 0, acc: null };
  for (let j = 0; j + k < H.v.length; j++){ if (H.T[j + k] > upTo) break; const v = H.v[j]; if (!fin(v) || Math.abs(v) < 0.5) continue; const m = c[j + k] - c[j]; if (!m) continue; n++; if ((m > 0) === (v > 0)) w++; }
  return { n, acc: n ? w/n : null }; }
const relAcc = r => r && r.n ? (r.acc*r.n + 0.5*30)/(r.n + 30) : 0.5, relMul = r => clip(1 + (relAcc(r) - 0.5)*6, 0.4, 1.6);
function consensus(I){ const grp = L => { let s = 0, w = 0; const on = []; for (const t of L){ const x = I[t]; if (!x || !fin(x.d)) continue; const ww = GW[t]*relMul(x.rel); s += ww*x.d; w += ww; on.push(t); } return { v: w ? s/w : 0, w, on }; };
  const big = grp(G_BIG), mid = grp(G_MID), sh = grp(G_SHORT); let s = 0, w = 0;
  for (const [g, k] of [[big, 0.6], [mid, 0.25], [sh, 0.15]]) if (g.on.length){ s += k*g.v; w += k; }
  const G = w ? s/w : 0, agree = sgn(big.v, 0.2) !== 0 && sgn(big.v, 0.2) === sgn(mid.v, 0.2), dir = sgn(G, 0.2), strong = dir !== 0 && Math.abs(G) >= 0.5 && agree;
  const label = !dir ? "NÖTR" : (strong ? "GÜÇLÜ " : "") + (dir > 0 ? "LONG" : "SHORT"), n = big.on.length + mid.on.length + sh.on.length;
  const rel = G_ALL.filter(t => I[t] && I[t].rel && I[t].rel.n).map(t => relAcc(I[t].rel)), relAvg = rel.length ? rel.reduce((a, x) => a + x, 0)/rel.length : null;
  return { G, big: big.v, mid: mid.v, short: sh.v, dir, strong, agree, label, strength: Math.round(Math.abs(G)*100), n, relAvg }; }
/* ŞİMDİ NE YAPMALI — one actionable line. x: { main: {state,d,plan,pUp}, px, atr, ema21 } */
function action(C, x){ const m = x.main || {}, R = fin(x.atr) && x.atr > 0 ? x.atr : x.px*0.003, px = x.px;
  const mk = (d, kind, entry) => { const stop = entry - d*1.5*R, r = Math.abs(entry - stop); return { d, kind, entry, stop, tp: entry + d*1.5*r }; };
  if (["LONG", "SHORT", "PUMP", "DUMP"].includes(m.state) && m.plan && fin(m.plan.stop) && !(C.dir === -m.d && Math.abs(C.big) >= 0.4))
    return { act: m.d > 0 ? "GİR LONG" : "GİR SHORT", d: m.d, kind: m.state === "PUMP" || m.state === "DUMP" ? "kırılım" : "A+ kurulum", entry: m.plan.entry, stop: m.plan.stop, tp: m.plan.tp };
  if (m.state === "SIKIŞMA" && m.plan && fin(m.plan.longAbove)) return { act: "BEKLE", d: 0, wait: "kırılımı bekle", kind: "sıkışma", longAbove: m.plan.longAbove, shortBelow: m.plan.shortBelow, prefer: C.dir || (m.pUp >= 0.5 ? 1 : -1) };
  if (C.strong && sgn(C.short, 0.25) === C.dir) return Object.assign({ act: C.dir > 0 ? "GİR LONG" : "GİR SHORT", kind: "trend + kısa vade aynı yön" }, mk(C.dir, "trend", px));
  if (C.dir && sgn(C.short, 0.25) === -C.dir){ const z = fin(x.ema21) && (x.ema21 - px)*C.dir < 0 && Math.abs(x.ema21 - px) < 3*R ? x.ema21 : px - C.dir*0.6*R;
    return Object.assign({ act: "BEKLE", wait: "geri çekilmeyi bekle", prefer: C.dir }, mk(C.dir, "geri çekilme", z), { d: 0 }); }
  if (C.dir) return { act: "BEKLE", d: 0, wait: C.strong ? "kısa vade teyidini bekle" : "trend güçlenmesini bekle", prefer: C.dir, kind: "teyit yok" };
  return { act: "BEKLE", d: 0, wait: "net yön yok", kind: "kararsız" }; }
/* plain-Turkish summary lines (max 3). L = interval labels, f = price formatter, extra = most important item text or null */
function summary(I, C, L, extra){ const lst = (ts, d) => ts.filter(t => I[t] && fin(I[t].d) && sgn(I[t].d, 0.25) === d).map(t => L[t] || t);
  const out = [], bd = sgn(C.big, 0.2), sd = sgn(C.short, 0.2);
  if (bd){ const t = lst(G_BIG, bd); out.push(`Büyük resim ${bd > 0 ? "yukarı" : "aşağı"}${t.length ? ` (${t.slice(0, 4).join(", ")} ${bd > 0 ? "LONG" : "SHORT"})` : ""}.`); }
  else out.push("Büyük resim kararsız (1s–1G karışık).");
  /* short + mid (1dk–30dk) = timing */ const TT = G_SHORT.concat(G_MID), ups = lst(TT, 1), dns = lst(TT, -1), rng = a => a.length ? `${a[0]}${a.length > 1 ? "–" + a[a.length - 1] : ""}` : "";
  const td = ups.length >= dns.length + 2 ? 1 : dns.length >= ups.length + 2 ? -1 : 0, tl = td ? ` (${rng(td > 0 ? ups : dns)} ${td > 0 ? "LONG" : "SHORT"})` : "";
  out.push(!td ? (ups.length || dns.length ? `Kısa vade karışık${ups.length ? ` (${rng(ups)} ↑` : " ("}${ups.length && dns.length ? ", " : ""}${dns.length ? `${rng(dns)} ↓` : ""}).` : "Kısa vade yatay (1dk–30dk kararsız).")
    : bd && td === bd ? `Kısa vade de ${td > 0 ? "yukarı" : "aşağı"}${tl} — aynı yön.` : bd ? `Kısa vade ${td > 0 ? "tepki yükselişinde" : "geri çekiliyor"}${tl}.` : `Kısa vade ${td > 0 ? "yukarı" : "aşağı"}${tl}.`); void sd;
  if (extra) out.push(extra); return out.slice(0, 3); }
/* walk-forward replay of GENEL YÖN on one coin: K = { tf: closed bars }, main = interval the trades are taken on.
   At every closed main candle only bars closed by then are used (interval votes + reliabilities); GİR (trend) entries are taken on a change
   into GİR, exit at stop / target / after maxB candles, fee FEE round trip. Used live as the gate for "GİR (trend)" and offline for the report. */
function gReplay(K, main, o = {}){ const maxB = o.maxB || 10, fee = o.fee ?? FEE, from = o.from || 0, lastLE = (a, x) => { let lo = 0, hi = a.length - 1, r = -1; while (lo <= hi){ const m = (lo + hi) >> 1; if (a[m] <= x){ r = m; lo = m + 1; } else hi = m - 1; } return r; };
  const P = {}; for (const t of G_ALL){ const b = (K[t] || []).filter(x => x.x !== false); if (b.length < 40) continue; const H = prepHigher(b), c = b.map(x => x.c), ST = [], cum = [0];
    for (let j = 0; j + 3 < b.length; j++){ const v = H.v[j]; if (!fin(v) || Math.abs(v) < 0.5) continue; const m = c[j + 3] - c[j]; if (!m) continue; ST.push(b[j + 3].T); cum.push(cum[cum.length - 1] + ((m > 0) === (v > 0) ? 1 : 0)); }
    P[t] = { H, Ts: b.map(x => x.T), ST, cum }; }
  const b = (K[main] || []).filter(x => x.x !== false), A = SCM.atr(b), E = SCM.ema(b.map(x => x.c), 21), out = { dir: { n: 0, ok: 0 }, str: { n: 0, ok: 0 }, tr: [], pb: [], lab: {}, flips: 0 };
  const sim = (i, d, en, st, tp, intra) => { for (let k = i + (intra ? 0 : 1); k <= Math.min(b.length - 1, i + maxB); k++){ const x = b[k], hs = d > 0 ? x.l <= st : x.h >= st, ht = d > 0 ? x.h >= tp : x.l <= tp;
      if (hs) return { r: "SL", pnl: d*(st - en)/en*100 - fee, t: b[i].t }; if (intra && k === i) continue; if (ht) return { r: "TP", pnl: d*(tp - en)/en*100 - fee, t: b[i].t }; }
    const k = Math.min(b.length - 1, i + maxB); return { r: "T", pnl: d*(b[k].c - en)/en*100 - fee, t: b[i].t, open: k - i < maxB }; };
  let prev = "", prevL = "";
  for (let i = 30; i < b.length - 1; i++){ if (b[i].T < from) continue; const Tc = b[i].T, I = {};
    for (const t in P){ const p = P[t], j = lastLE(p.Ts, Tc); if (j < 30 || !fin(p.H.v[j])) continue; const n = lastLE(p.ST, Tc) + 1; I[t] = { d: p.H.v[j], rel: { n, acc: n ? p.cum[n]/n : null } }; }
    if (!Object.keys(I).length) continue; const C = consensus(I), px = b[i].c, a = action(C, { main: {}, px, atr: A[i], ema21: E[i] });
    out.lab[C.label] = (out.lab[C.label] || 0) + 1; if (prevL && C.label !== prevL) out.flips++; prevL = C.label;
    if (i + 3 < b.length && C.dir){ const ok = sgn(b[i + 3].c - px) === C.dir; out.dir.n++; out.dir.ok += ok; if (C.strong){ out.str.n++; out.str.ok += ok; } }
    const key = a.act + (a.wait || ""); if (a.act !== "BEKLE" && key !== prev) out.tr.push(sim(i, a.d, px, a.stop, a.tp));
    if (a.wait === "geri çekilmeyi bekle" && key !== prev) for (let k = i + 1; k <= Math.min(b.length - 1, i + 5); k++) if ((a.prefer > 0 && b[k].l <= a.entry) || (a.prefer < 0 && b[k].h >= a.entry)){ out.pb.push(sim(k, a.prefer, a.entry, a.stop, a.tp, true)); break; }
    prev = key; }
  const st = x => { const n = x.length, tp = x.filter(r => r.r === "TP").length, sl = x.filter(r => r.r === "SL").length, w = x.filter(r => r.pnl > 0).length, net = x.reduce((q, r) => q + r.pnl, 0); return { n, tp, sl, win: n ? w/n : null, net, avg: n ? net/n : null }; };
  out.T = st(out.tr); out.PB = st(out.pb); out.days = b.length ? (b[b.length - 1].T - Math.max(from, b[Math.min(30, b.length - 1)].T))/864e5 : 0; return out; }
/* gate: the consensus GİR rule is shown as GİR only when it held on this coin + interval: ≥20 entries, ≥55 % winners, positive average after fees */
const gGate = g => !!(g && g.T && g.T.n >= 20 && g.T.win >= 0.55 && g.T.avg > 0);
/* v7.15 ONE decision: the only big action word is GİR LONG / GİR SHORT / BEKLE; direction is shown separately as YÖN.
   BEKLE always carries direction + concrete trigger(s) and only in the direction's side (both sides only when YÖN is YATAY).
   x: { px, atr, ema21, hi, lo (recent high/low of the selected interval incl. the live candle), f: price formatter } */
const DIRW = { "GÜÇLÜ LONG": "GÜÇLÜ YUKARI", LONG: "YUKARI", "NÖTR": "YATAY", SHORT: "AŞAĞI", "GÜÇLÜ SHORT": "GÜÇLÜ AŞAĞI" }, DIRA = { "GÜÇLÜ LONG": "⇈", LONG: "↑", "NÖTR": "↔", SHORT: "↓", "GÜÇLÜ SHORT": "⇊" };
function decision(C, A, x){ const f = x.f || (v => (+v).toFixed(4)), px = x.px, R = fin(x.atr) && x.atr > 0 ? x.atr : px*0.003, p = C.dir, dirW = DIRW[C.label] || "YATAY", arrow = DIRA[C.label] || "↔";
  const base = { dir: p, dirW, arrow, yon: `${arrow} YÖN: ${dirW}`, note: A.note || null };
  if (A.act === "GİR LONG" || A.act === "GİR SHORT"){ const t = `${A.act} · giriş ${f(A.entry)} · stop ${f(A.stop)} · hedef ${f(A.tp)}`;
    return { ...base, word: A.act, d: A.d, trig: [], line: t, text: `${A.act} (${A.kind}) — giriş ${f(A.entry)}, stop ${f(A.stop)}, hedef ${f(A.tp)}.` }; }
  const sq = A.wait === "kırılımı bekle", up = sq ? A.longAbove : x.hi, dn = sq ? A.shortBelow : x.lo, bx = sq ? "kutu " : "", T = [];
  if (p >= 0 && fin(up)) T.push({ d: 1, t: `${bx}${f(up)} üstü kapanışta LONG` });
  if (p <= 0 && fin(dn)) T.push({ d: -1, t: `${bx}${f(dn)} altı kapanışta SHORT` });
  if (p !== 0){ let z = A.wait === "geri çekilmeyi bekle" && fin(A.entry) ? A.entry : fin(x.ema21) && (px - x.ema21)*p > 0.1*R && Math.abs(px - x.ema21) < 3*R ? x.ema21 : px - p*0.6*R;
    let a = z - 0.25*R, b = z + 0.25*R; if (p > 0) b = Math.min(b, px - 0.05*R); else a = Math.max(a, px + 0.05*R); if (b < a){ const m = (a + b)/2; a = b = m; }
    T.push({ d: p, t: `geri çekilmede ${f(a)}–${f(b)} ${p > 0 ? "LONG" : "SHORT"} bölgesi` }); }
  const yl = dirW.toLocaleLowerCase("tr");
  return { ...base, word: "BEKLE", d: 0, trig: T, line: "BEKLE → " + (T.length ? T.map(t => t.t).join(" · ") : "net tetik yok"),
    text: `BEKLE — yön ${yl}${T.length ? ", tetik: " + T[0].t : ""}.` }; }
/* lower (selected interval) card: same word as the top, never a silent conflict. D = { state, d } of the selected interval, mi = its trend item */
function mainView(dec, D, mi, tfL){ D = D || {}; const stD = D.state === "LONG" || D.state === "PUMP" ? 1 : D.state === "SHORT" || D.state === "DUMP" ? -1 : 0, vd = mi && fin(mi.d) ? sgn(mi.d, 0.25) : 0, own = stD || vd;
  const tag = D.state === "LONG" || D.state === "SHORT" ? `bu aralıkta A+ ${D.state}` : D.state === "PUMP" || D.state === "DUMP" ? `bu aralıkta ${D.state}` : D.state === "SIKIŞMA" ? "bu aralıkta sıkışma" : `bu aralık ${vd > 0 ? "yukarı eğilimli" : vd < 0 ? "aşağı eğilimli" : "yatay"}`;
  const conflict = !!(dec.dir && own && own === -dec.dir) || !!(dec.d && stD && stD === -dec.d);
  const sub = dec.word === "BEKLE" ? `BEKLE · yön ${dec.dirW.toLocaleLowerCase("tr")}${dec.trig.length ? ", tetik: " + dec.trig[0].t : ""}` : dec.line;
  return { word: dec.word, sub, tag, conflict, note: conflict ? `bu aralık ters (${tfL || ""} ${own > 0 ? "yukarı" : "aşağı"}, genel yön ${dec.dirW.toLocaleLowerCase("tr")}): dikkat` : null }; }
return { decision, mainView, DIRW, gReplay, gGate, tfRel, relAcc, relMul, consensus, action, summary, prepHigher, GW, G_BIG, G_MID, G_SHORT, G_ALL, patternsAt, prep, votesAt, walk, wOf, scoreOf, squeezeDir, liqMagnets, walls, replay, resolveTrade, hitB, NAMES, FT, FR, SESS, FEE, H_OUT, H_LAB };
});
