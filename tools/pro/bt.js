/* MERMER PRO walk-forward validation. node tools/pro/bt.js  → tools/pro/result.json (+ console summary)
   • strategies are pre-registered in pro/core.js with FIXED parameters (nothing is fitted) → each half of the period is out-of-sample;
   • entries: MKT (next 15m open, taker, slippage) and PB (limit 0.3 ATR better, 4 bars, maker; fill only if price trades THROUGH the limit);
   • exits: stop (stop-first on ambiguous bars, gap → open, slippage 2×), TP1 = 1R half + stop to break-even, TP2 = 2R, timeout 8h; funding charged;
   • random baseline: same coin, same half, same direction, same stop distance in ATR, same exits, random entry bar (REPS replications). */
"use strict";
const fs = require("fs"), path = require("path"), C = require("../../pro/core.js");
const DATA = process.env.MPRO_DATA || "/workspace/mpro-data", REPS = +(process.env.REPS || 100), meta = JSON.parse(fs.readFileSync(DATA + "/_meta.json"));
const START = meta.start + 10*864e5, END = meta.end, SPLIT = START + Math.floor((END - START)/2/864e5)*864e5, MODES = ["MKT", "PB"];
const rnd = C.rng(20261122), syms = meta.syms.filter(s => fs.existsSync(`${DATA}/${s}.json`));
const T = [], RB = [];   // actual trades, random-baseline trades
let nb = 0, nEval = 0, regCount = {};
for (const s of syms){
  const d = JSON.parse(fs.readFileSync(`${DATA}/${s}.json`)); const b = d.b.map(x => ({ t: x[0], o: x[1], h: x[2], l: x[3], c: x[4], v: x[5], qv: x[6], tb: x[7] }));
  if (b.length < 2000) continue; nb += b.length;
  const P = C.prepare(b, { fr: d.fr }); const free = {}; const mine = [];
  for (let i = 100; i < b.length - 1; i++){ const t = b[i].t + C.M15; if (t < START || t >= END) continue;
    const ev = C.evalAt(P, i); nEval++; regCount[ev.rg.r] = (regCount[ev.rg.r] || 0) + 1;
    for (const cd of ev.cands) for (const m of MODES){ const k = cd.key + "|" + m; if ((free[k] || 0) > i) continue;
      const r = C.simTrade(P, i, cd, m); if (!r || !r.fill || r.open) { if (r && !r.fill) free[k] = i + 1; continue; }
      free[k] = r.xj + 1; const tr = { sym: s, key: cd.key, mode: m, dir: cd.dir, rg: ev.rg.r, t, half: t < SPLIT ? 1 : 2, ra: cd.R/P.atr[i], pro: cd.pro, con: cd.con, qv24: P.qv24[i], ...r }; T.push(tr); mine.push(tr); } }
  // random baseline for this coin
  const lo1 = b.findIndex(x => x.t + C.M15 >= START), sp = b.findIndex(x => x.t + C.M15 >= SPLIT), hi2 = b.length - 2;
  for (let rep = 0; rep < REPS; rep++) for (const tr of mine){ const [a, z] = tr.half === 1 ? [lo1, sp - 1] : [sp, hi2];
      for (let tries = 0; tries < 20; tries++){ const i = a + Math.floor(rnd()*(z - a)); if (!(P.qv24[i] >= P.o.liqMin) || P.atr[i] == null) continue;
        const c = P.c[i], stop = c - tr.dir*tr.ra*P.atr[i]; const r = C.simTrade(P, i, { dir: tr.dir, entry: c, stop }, tr.mode); if (!r || !r.fill || r.open) continue;
        RB.push({ rep, key: tr.key, mode: tr.mode, half: tr.half, rg: tr.rg, netR: r.netR }); break; } }
  process.stderr.write(".");
}
console.error("\nbars", nb, "evaluations", nEval, "trades", T.length, "random", RB.length);
const st = (L, o) => C.stats(L, Object.assign({ rng: C.rng(7), boot: 2000 }, o));
function randCmp(key, mode, half, rg, actualExp){ const by = new Map(); for (const x of RB) if (x.key === key && x.mode === mode && (half == null || x.half === half) && (rg == null || x.rg === rg)){ const v = by.get(x.rep) || [0, 0]; v[0] += x.netR; v[1]++; by.set(x.rep, v); }
  const ms = [...by.values()].map(v => v[0]/v[1]).sort((a, b) => a - b); if (!ms.length) return { mean: null };
  return { mean: ms.reduce((s, x) => s + x, 0)/ms.length, p95: ms[Math.floor(0.95*ms.length)] ?? ms[ms.length - 1], p: (ms.filter(x => x >= actualExp).length + 1)/(ms.length + 1) }; }
const res = { meta: { start: START, end: END, split: SPLIT, coins: syms.length, bars: nb, evaluations: nEval, reps: REPS, regimes: regCount, cost: C.COST, made: Date.now() }, rows: [], regimeRows: [] };
for (const key of C.SKEYS) for (const mode of MODES){
  const L = T.filter(t => t.key === key && t.mode === mode);
  const row = { key, mode, name: C.STRATS[key].name };
  for (const h of [1, 2, 0]){ const LL = h ? L.filter(t => t.half === h) : L; const s = st(LL); const rc = s.n ? randCmp(key, mode, h || null, null, s.exp) : {}; row["h" + h] = Object.assign(s, { rand: rc.mean, randP: rc.p, longShare: LL.length ? LL.filter(t => t.dir > 0).length/LL.length : null }); }
  const ok = h => row[h].n >= 30 && row[h].exp > 0 && row[h].ciLo > -0.05 && row[h].rand != null && row[h].exp > row[h].rand && row[h].randP < 0.10;
  row.pass = ok("h1") && ok("h2"); res.rows.push(row);
  // regime walk-forward: choose regimes positive on one half, test on the other
  for (const rg of C.STRATS[key].regimes){ const R = L.filter(t => t.rg === rg); const a = st(R.filter(t => t.half === 1)), b2 = st(R.filter(t => t.half === 2));
    res.regimeRows.push({ key, mode, rg, h1: a, h2: b2, selH1testH2: a.n >= 30 && a.exp > 0 ? b2.exp : null, selH2testH1: b2.n >= 30 && b2.exp > 0 ? a.exp : null }); }
}
// ---- pre-declared filter experiments (reported, counted in the multiple-testing tally) ----
const FILT = { "aile uyumu (≥3 lehte, 0 aleyhte)": t => t.pro >= 3 && t.con === 0, "yüksek likidite (24s ≥ $100M)": t => t.qv24 >= 1e8 };
res.filterRows = [];
for (const key of C.SKEYS) for (const mode of MODES) for (const [fn, f] of Object.entries(FILT)){ const L = T.filter(t => t.key === key && t.mode === mode && f(t));
  const a = st(L.filter(t => t.half === 1)), b2 = st(L.filter(t => t.half === 2)); res.filterRows.push({ key, mode, filter: fn, h1: a, h2: b2, pass: a.n >= 30 && b2.n >= 30 && a.exp > 0 && b2.exp > 0 && a.ciLo > -0.05 && b2.ciLo > -0.05 }); }
// ---- portfolio simulation: chronological, $1000 start, 1% risk of current equity, max 2 open, daily loss 3%, 3 losses → 12h cooldown ----
const portfolio = L => { const r = C.portfolio(L, { start: 1000 }); delete r.curve; return r; };
res.portfolio = {}; for (const key of C.SKEYS) for (const mode of MODES){ const L = T.filter(t => t.key === key && t.mode === mode); res.portfolio[key + "|" + mode] = { h1: portfolio(L.filter(t => t.half === 1)), h2: portfolio(L.filter(t => t.half === 2)) }; }
res.status = {}; for (const r of res.rows){ const k = r.key; if (!res.status[k] || r.pass) res.status[k] = { active: r.pass || (res.status[k] && res.status[k].active) || false, mode: r.pass ? r.mode : (res.status[k] && res.status[k].mode) || null }; }
fs.writeFileSync(path.join(__dirname, "result.json"), JSON.stringify(res, null, 1));
fs.writeFileSync(path.join(__dirname, "trades.json"), JSON.stringify(T.map(t => [t.sym, t.key, t.mode, t.dir, t.rg, t.t, t.t1, +t.netR.toFixed(4), +t.grossR.toFixed(4), t.out])));
const f = (x, d = 3) => x == null ? "—" : typeof x === "number" ? x.toFixed(d) : x;
for (const r of res.rows){ console.log(r.key.padEnd(5), r.mode.padEnd(4), ["h1", "h2", "h0"].map(h => `${h}: n=${r[h].n} exp=${f(r[h].exp)} [${f(r[h].ciLo)},${f(r[h].ciHi)}] PF=${f(r[h].pf, 2)} win=${f(r[h].win, 2)} DD=${f(r[h].maxDD*100, 1)}% Sh=${f(r[h].sharpe, 2)} rand=${f(r[h].rand)} p=${f(r[h].randP, 3)} gross=${f(r[h].gross)}`).join(" | "), r.pass ? "PASS" : "fail"); }
console.log(JSON.stringify(res.meta.regimes));
for (const r of res.filterRows) console.log("FILT", r.key, r.mode, r.filter, "h1", r.h1.n, f(r.h1.exp), "[" + f(r.h1.ciLo) + "]", "h2", r.h2.n, f(r.h2.exp), "[" + f(r.h2.ciLo) + "]", r.pass ? "PASS" : "");
for (const r of res.regimeRows) console.log("REG", r.key, r.mode, r.rg, "h1", r.h1.n, f(r.h1.exp), "h2", r.h2.n, f(r.h2.exp));
for (const [k, v] of Object.entries(res.portfolio)) console.log("PORT", k, "H1 1000→" + v.h1.end.toFixed(0), "DD " + (v.h1.maxDD*100).toFixed(1) + "% n" + v.h1.taken, "| H2 1000→" + v.h2.end.toFixed(0), "DD " + (v.h2.maxDD*100).toFixed(1) + "% n" + v.h2.taken);
