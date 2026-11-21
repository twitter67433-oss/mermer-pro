/* v8.2 honest replay of the BİLEŞİK OTO rule set on REAL Binance data (15m klines + 15m OI history + funding), day by day (Europe/Berlin days).
   node tools/compound820/backtest.js [dataDir=/workspace/r820/data] [out=/workspace/r820/result.json]
   Uses the SAME code as the app: SERTX.evalAll (signals), AKSIYONX.verdict (GİR / ÇIK), PSIM (fills, fees, slippage, stops) and COMPX (stake, TP$, caps, daily stops, cross liquidation).
   Entry variants: A = at the signal-bar close (optimistic: zero scan latency), B = at the close of the NEXT 15m bar, only if the badge is still GİR (pessimistic: 15 min late).
   Limits (also in docs): 15m bar resolution (a bar that touches both stop and target counts as STOP), SQUEEZE badge not reproducible historically (needs live L/S data), survivor universe = today's listed perps,
   simultaneous-adverse-extreme cross check is conservative, no order-book depth (PSIM model fill: spread + slippage + latency). Not investment advice; a measured replay, not a promise. */
const fs = require("fs"), X = require("../../sert.js"), P = require("../../psim.js"), AX = require("../../aksiyon.js"), C = require("../../comp.js");
const DIR = process.argv[2] || "/workspace/r820/data", OUT = process.argv[3] || "/workspace/r820/result.json", SIGF = DIR + "/_signals.json", M15 = 900000;
const meta = JSON.parse(fs.readFileSync(DIR + "/_meta.json")), from = meta.from, end = meta.end;
const files = fs.readdirSync(DIR).filter(f => f.endsWith(".json") && !f.startsWith("_"));
const D = {}; for (const f of files){ const j = JSON.parse(fs.readFileSync(DIR + "/" + f)); D[j.s] = { b: j.b.map(x => ({ t: x[0], o: x[1], h: x[2], l: x[3], c: x[4], qv: x[5], tb: x[6] })), oi: j.oi, fr: j.fr }; }
console.error("coins", Object.keys(D).length);
const at = (arr, t) => { let lo = 0, hi = arr.length - 1, v = NaN; while (lo <= hi){ const m = (lo + hi) >> 1; if (arr[m][0] <= t){ v = arr[m][1]; lo = m + 1; } else hi = m - 1; } return v; };
/* ---- signals: every list trigger the live scanner would have produced at each 15m close ---- */
let SIG; if (fs.existsSync(SIGF)) SIG = JSON.parse(fs.readFileSync(SIGF)); else { SIG = []; let n = 0;
  for (const s in D){ const { b, oi, fr } = D[s];
    for (let j = 100; j < b.length; j++){ const cT = b[j].t + M15; if (cT <= from || cT > end) continue; const bars = b.slice(Math.max(0, j - 299), j + 1), f = X.feat(bars, {}); if (!f || !X.LISTS.some(l => !l.ext && X.preK(l.k, f))) continue;
      const a = at(oi, cT - 3600000), c = at(oi, cT), oi1 = a > 0 && c > 0 ? c/a - 1 : NaN, r = at(fr, cT);
      for (const t of X.evalAll(bars, oi1, r, null, {})) SIG.push({ sym: s, k: t.k, side: t.side, entry: t.entry, stop: t.stop, close: cT, vr: t.vr, oi1: fin(oi1) ? oi1 : null, fr: fin(r) ? r : null }); }
    if (++n % 100 === 0) console.error("signals", n, SIG.length); }
  SIG.sort((a, b) => a.close - b.close || b.vr - a.vr); fs.writeFileSync(SIGF, JSON.stringify(SIG)); }
function fin(x){ return typeof x === "number" && isFinite(x); }
console.error("signals", SIG.length);
/* ---- bar lookup ---- */
const MAP = {}; const barAt = (s, t0) => { let m = MAP[s]; if (!m){ m = MAP[s] = new Map(); for (const b of D[s].b) m.set(b.t, b); } return m.get(t0); };
const days = []; for (let t = from; t < end; ){ const e = Math.min(end, t + 86400000 + 3*3600000); /* DST-safe: find next Berlin midnight */ let n = t + 20*3600000; while (C.berlin(n) === C.berlin(t)) n += 3600000; /* then snap back to the exact midnight */ while (C.berlin(n - 60000) !== C.berlin(t)) n -= 60000; days.push([t, Math.min(n, end)]); t = n; }
function runDay(S, d0, d1, variant, opts){ const pend = []; let peak = S.acct.bal; const recent = new Map(); /* sym → signals seen in the last 60 min */
  const SG = SIG.filter(s => s.close > d0 && s.close <= d1); let si = 0;
  for (let T = d0 + M15; T <= d1; T += M15){ const t = T - 1;
    /* 1) manage open positions on the bar that just closed */
    for (const sym of [...new Set(S.acct.pos.map(p => p.sym))]){ const b = barAt(sym, T - M15); if (b) C.stepSym(S, sym, b, t); }
    /* 2) signals closing now */
    const now = []; while (si < SG.length && SG[si].close === T){ now.push(SG[si++]); }
    for (const s of now){ const a = recent.get(s.sym) || []; a.push(s); recent.set(s.sym, a); }
    const opp = (sym, side) => (recent.get(sym) || []).some(r => r.side !== side && T - r.close <= 3600000 && r.close < T + 1);
    /* 3) ÇIK badge on open positions (HEDEF2 / 60 min / opposite signal) at the bar close */
    for (const p of S.acct.pos.slice()){ const b = barAt(p.sym, T - M15); if (b) C.sigExit(S, p, b.c, t, opp(p.sym, p.side)); }
    C.guard(S, t);
    /* 4) entries */
    const cands = variant === "A" ? now : pend.splice(0).concat([]);
    if (variant === "B") pend.push(...now);
    for (const s of cands){ const bar = barAt(s.sym, T - M15), px = variant === "A" ? s.entry : (bar ? bar.c : NaN); if (!(px > 0)) continue;
      const v = AX.verdict(s, px, t, { opposite: opp(s.sym, s.side) }); const g = C.enter(S, s, px, t, { v }); if (g.ok) g.pos.sigk = s.k; }
    peak = Math.max(peak, S.acct.bal); }
  /* flatten at the end of the day (market, costs paid) */
  for (const p of S.acct.pos.slice()){ const px = S.last[p.sym] ?? p.entry; C.after(S, P.close(S.acct, p.id, px, "gün sonu", d1 - 1), d1 - 1); }
  return peak; }
const med = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1)/2] : (s[n/2 - 1] + s[n/2])/2) : NaN; };
function summarize(rows, hist){ const end = rows.map(r => r.end), nTr = hist.length, w = hist.filter(r => r.net > 0), L = hist.filter(r => r.net <= 0);
  const why = {}; for (const r of hist) why[r.why.replace(/^ÇIK · .*/, "ÇIK")] = (why[r.why.replace(/^ÇIK · .*/, "ÇIK")] || 0) + 1;
  const byK = {}; for (const r of hist){ const k = (r.rule || "").replace("comp:", ""); const o = byK[k] || (byK[k] = { n: 0, w: 0, net: 0 }); o.n++; if (r.net > 0) o.w++; o.net += r.net; }
  const worst = rows.reduce((a, r) => r.end < a.end ? r : a, rows[0]), best = rows.reduce((a, r) => r.end > a.end ? r : a, rows[0]);
  return { days: rows.length, daysTarget: rows.filter(r => r.hit).length, daysLossStop: rows.filter(r => r.stop === "zarar").length, daysUp: rows.filter(r => r.end > r.start).length, daysDown: rows.filter(r => r.end < r.start).length, daysNoTrade: rows.filter(r => r.n === 0).length,
    medianEnd: med(end), meanEnd: end.reduce((a, b) => a + b, 0)/end.length, worstDay: { date: worst.date, end: worst.end, start: worst.start }, bestDay: { date: best.date, end: best.end, start: best.start }, peakMax: Math.max(...rows.map(r => r.peak)),
    liquidations: rows.reduce((a, r) => a + r.liq, 0), trades: nTr, winRate: nTr ? w.length/nTr : null, avgWin: w.length ? w.reduce((a, r) => a + r.net, 0)/w.length : null, avgLoss: L.length ? L.reduce((a, r) => a + r.net, 0)/L.length : null, avgNet: nTr ? hist.reduce((a, r) => a + r.net, 0)/nTr : null,
    breakEvenWinRate: w.length && L.length ? -(L.reduce((a, r) => a + r.net, 0)/L.length)/((w.reduce((a, r) => a + r.net, 0)/w.length) - (L.reduce((a, r) => a + r.net, 0)/L.length)) : null, exits: why, byList: byK }; }
function fresh(cfg, variant){ const rows = [], hist = []; for (const [d0, d1] of days){ const S = C.create(Object.assign({ on: true }, cfg)); C.roll(S, d0 + 1); const peak = runDay(S, d0, d1, variant); const dd = S.day;
    rows.push({ date: C.berlin(d0 + 1), start: S.cfg.start, end: S.acct.bal, peak, n: dd.n, hit: dd.stop === "hedef" || peak >= S.cfg.target, stop: dd.stop, liq: S.tot.liq }); for (const r of S.acct.hist.slice().reverse()) hist.push(r); } return { rows, hist }; }
function chain(cfg, variant){ const S = C.create(Object.assign({ on: true }, cfg)), rows = [], hist = []; let minEq = S.acct.bal, peakEq = S.acct.bal, mdd = 0;
  for (const [d0, d1] of days){ C.roll(S, d0 + 1); const st = S.acct.bal, n0 = S.tot.n, l0 = S.tot.liq; const peak = runDay(S, d0, d1, variant); rows.push({ date: C.berlin(d0 + 1), start: st, end: S.acct.bal, peak, n: S.tot.n - n0, hit: S.day.stop === "hedef", stop: S.day.stop, liq: S.tot.liq - l0 }); peakEq = Math.max(peakEq, S.acct.bal); mdd = Math.max(mdd, 1 - S.acct.bal/peakEq); minEq = Math.min(minEq, S.acct.bal); }
  return { rows, hist: S.acct.hist, final: S.acct.bal, mdd, minBal: minEq, liq: S.tot.liq, trades: S.tot.n }; }
const result = { meta: { from: new Date(from).toISOString(), end: new Date(end).toISOString(), days: days.length, coins: Object.keys(D).length, signals: SIG.length, signalsByList: SIG.reduce((o, s) => (o[s.k] = (o[s.k] || 0) + 1, o), {}) }, runs: {} };
const RUNS = { "A_varsayilan": [{}, "A"], "B_gecikmeli": [{}, "B"], "A_izsuren": [{ trail: true }, "A"], "B_izsuren": [{ trail: true }, "B"], "A_lev10": [{ lev: 10 }, "A"], "A_tp5": [{ tp: 5 }, "A"], "A_tp10": [{ tp: 10 }, "A"] };
for (const [name, [cfg, v]] of Object.entries(RUNS)){ const f = fresh(cfg, v), s = summarize(f.rows, f.hist); result.runs[name] = { cfg, variant: v, fresh1000: s, perDay: f.rows };
  if (name === "A_varsayilan" || name === "B_gecikmeli"){ const c = chain(cfg, v); result.runs[name].chain = { final: c.final, mdd: c.mdd, minBal: c.minBal, liq: c.liq, trades: c.trades, perDay: c.rows }; }
  console.error(name, JSON.stringify({ n: s.trades, wr: s.winRate, hit: s.daysTarget, med: s.medianEnd, worst: s.worstDay.end, liq: s.liquidations })); }
fs.writeFileSync(OUT, JSON.stringify(result, null, 1)); console.error("written", OUT);
if (process.env.DETAIL){ const f = fresh({}, "A"); const g = {}; for (const r of f.hist){ const k = r.why.replace(/^ÇIK · .*/, "ÇIK"); const o = g[k] || (g[k] = { n: 0, net: 0, w: 0, min: 1e9, max: -1e9, fee: 0, slip: 0 }); o.n++; o.net += r.net; if (r.net > 0) o.w++; o.min = Math.min(o.min, r.net); o.max = Math.max(o.max, r.net); o.fee += r.fee; o.slip += r.slip; }
  for (const k in g){ const o = g[k]; console.log(k, "n", o.n, "avgNet", (o.net/o.n).toFixed(2), "win%", (100*o.w/o.n).toFixed(0), "min", o.min.toFixed(2), "max", o.max.toFixed(2), "avgFee", (o.fee/o.n).toFixed(2), "avgSlip", (o.slip/o.n).toFixed(2)); }
  const gross = f.hist.reduce((a, r) => a + r.net + r.fee + r.slip, 0); console.log("gross before costs per trade", (gross/f.hist.length).toFixed(2), "fees", (f.hist.reduce((a, r) => a + r.fee, 0)/f.hist.length).toFixed(2), "slip", (f.hist.reduce((a, r) => a + r.slip, 0)/f.hist.length).toFixed(2)); }
