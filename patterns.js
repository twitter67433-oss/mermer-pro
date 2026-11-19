/* MERMER TERMİNAL v7.26 — FORMASYON + DESTEK/DİRENÇ (pure, used by the charts; display only, never trades).
   candles(b): engulfing, hammer, shooting star, doji on the last candles.
   chart(b): double top / double bottom, triangle (converging highs+lows), flag (strong pole + tight drift) from confirmed pivots.
   levels(b, px): support / resistance = clusters of confirmed pivot highs/lows (ATR-wide bins), strongest 2 above + 2 below. */
"use strict";
(function (root, factory){ const M = factory(); if (typeof module === "object" && module.exports) module.exports = M; else root.PAT = M; })(typeof self !== "undefined" ? self : this, function (){
const fin = x => typeof x === "number" && isFinite(x);
function atr(b, n = 14){ const o = Array(b.length).fill(null); let a = null; for (let i = 0; i < b.length; i++){ const x = b[i], t = i ? Math.max(x.h - x.l, Math.abs(x.h - b[i - 1].c), Math.abs(x.l - b[i - 1].c)) : x.h - x.l; a = a === null ? t : (a*(n - 1) + t)/n; o[i] = a; } return o; }
/* pivots confirmed k candles later (no lookahead beyond the last closed candle) */
function pivots(b, k = 3){ const H = [], L = []; for (let p = k; p < b.length - k; p++){ let h = true, l = true; for (let j = p - k; j <= p + k; j++){ if (j === p) continue; if (j < p ? b[j].h >= b[p].h : b[j].h > b[p].h) h = false; if (j < p ? b[j].l <= b[p].l : b[j].l < b[p].l) l = false; } if (h) H.push({ i: p, p: b[p].h }); if (l) L.push({ i: p, p: b[p].l }); } return { H, L }; }
function candles(b, last = 30){ const out = [], A = atr(b); for (let i = Math.max(2, b.length - last); i < b.length; i++){ const x = b[i], p = b[i - 1], rng = x.h - x.l || 1e-12, body = Math.abs(x.c - x.o), up = x.h - Math.max(x.o, x.c), dn = Math.min(x.o, x.c) - x.l, a = A[i] || rng;
    if (rng < 0.3*a) continue; /* too small to mean anything */
    if (x.c > x.o && p.c < p.o && x.c >= p.o && x.o <= p.c && body > Math.abs(p.c - p.o)) out.push({ i, k: "yutan", t: "Yutan ↑", d: 1 });
    else if (x.c < x.o && p.c > p.o && x.o >= p.c && x.c <= p.o && body > Math.abs(p.c - p.o)) out.push({ i, k: "yutan", t: "Yutan ↓", d: -1 });
    else if (dn >= 2*body && up <= 0.6*body + 0.1*rng && body > 0.05*rng) out.push({ i, k: "çekiç", t: "Çekiç", d: 1 });
    else if (up >= 2*body && dn <= 0.6*body + 0.1*rng && body > 0.05*rng) out.push({ i, k: "kayan yıldız", t: "Kayan yıldız", d: -1 });
    else if (body <= 0.1*rng) out.push({ i, k: "doji", t: "Doji", d: 0 }); }
  return out; }
function chart(b){ if (!b || b.length < 40) return []; const { H, L } = pivots(b), A = atr(b), n = b.length - 1, a = A[n] || b[n].c*0.003, out = [];
  const h2 = H.slice(-2), l2 = L.slice(-2);
  if (h2.length === 2 && Math.abs(h2[0].p - h2[1].p) <= 0.6*a && h2[1].i - h2[0].i >= 5){ const neck = Math.min(...b.slice(h2[0].i, h2[1].i + 1).map(x => x.l)); if (h2[1].p - neck >= 1.5*a) out.push({ k: "ikili tepe", t: "İkili tepe", d: -1, i: h2[1].i, lv: neck }); }
  if (l2.length === 2 && Math.abs(l2[0].p - l2[1].p) <= 0.6*a && l2[1].i - l2[0].i >= 5){ const neck = Math.max(...b.slice(l2[0].i, l2[1].i + 1).map(x => x.h)); if (neck - l2[1].p >= 1.5*a) out.push({ k: "ikili dip", t: "İkili dip", d: 1, i: l2[1].i, lv: neck }); }
  const h3 = H.slice(-3), l3 = L.slice(-3);
  if (h3.length === 3 && l3.length === 3 && h3[0].p > h3[1].p && h3[1].p > h3[2].p && l3[0].p < l3[1].p && l3[1].p < l3[2].p && h3[0].i > n - 80) out.push({ k: "üçgen", t: "Üçgen (sıkışma)", d: 0, i: Math.max(h3[2].i, l3[2].i) });
  /* flag: pole ≥ 4 ATR in ≤ 10 candles, then ≥ 5 candles drifting back ≤ 50 % of the pole inside a tight range */
  for (const len of [8, 12]){ const s = n - len - 10; if (s < 1) continue; const pole = b[s + 10].c - b[s].c, rest = b.slice(s + 10, n + 1), hi = Math.max(...rest.map(x => x.h)), lo = Math.min(...rest.map(x => x.l));
    if (Math.abs(pole) >= 4*a && hi - lo <= 0.5*Math.abs(pole) && (b[n].c - b[s + 10].c)*Math.sign(pole) <= 0.1*Math.abs(pole)){ out.push({ k: "bayrak", t: pole > 0 ? "Boğa bayrağı" : "Ayı bayrağı", d: Math.sign(pole), i: s + 10 }); break; } }
  return out; }
function levels(b, px){ if (!b || b.length < 30) return []; const { H, L } = pivots(b), A = atr(b), a = A[A.length - 1] || px*0.003, pts = H.map(x => ({ p: x.p, i: x.i })).concat(L.map(x => ({ p: x.p, i: x.i }))), cl = [];
  for (const q of pts){ const c = cl.find(c => Math.abs(c.p - q.p) <= 0.5*a); if (c){ c.p = (c.p*c.n + q.p)/(c.n + 1); c.n++; c.last = Math.max(c.last, q.i); } else cl.push({ p: q.p, n: 1, last: q.i }); }
  const sc = c => c.n + c.last/b.length; px = fin(px) ? px : b[b.length - 1].c;
  const up = cl.filter(c => c.p > px).sort((x, y) => sc(y) - sc(x)).slice(0, 2).map(c => ({ p: c.p, k: "R", n: c.n })), dn = cl.filter(c => c.p < px).sort((x, y) => sc(y) - sc(x)).slice(0, 2).map(c => ({ p: c.p, k: "D", n: c.n }));
  return up.concat(dn); }
return { atr, pivots, candles, chart, levels };
});
