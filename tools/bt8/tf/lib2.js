/* FAZ 3b harness: TF=1h|4h. Same SİNYAL 8 resolver/cost model; funding = REAL Binance fundingRate history (replaces the flat fund8h assumption). */
const fs = require("fs"), R = "/workspace/neon-terminal-mobile/", S8 = require(R + "sig8.js");
const TF = process.env.TF || "1h", DIR = `/workspace/r750/d${TF}/`, META = JSON.parse(fs.readFileSync(DIR + "meta.json"));
const TMS = { "1h": 36e5, "4h": 144e5 }[TF], HI = { "1h": ["4h", "1d"], "4h": ["1d", "1w"] }[TF], IVMS = { "1h": 36e5, "4h": 144e5, "1d": 864e5, "1w": 6048e5 };
const toB = a => a.map(x => ({ t: x[0], T: x[6], o: x[1], h: x[2], l: x[3], c: x[4], v: x[5], tb: x[7], qv: x[5]*x[4], x: true }));
const load = (s, iv) => { const f = DIR + `${s}_${iv}.json`; return fs.existsSync(f) ? toB(JSON.parse(fs.readFileSync(f))) : []; };
const fundOf = s => { const f = DIR + `${s}_fund.json`; return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : []; };
const SYMS = META.syms.map(x => x.s).filter(s => fs.existsSync(DIR + `${s}_fund.json`));
/* walk-forward folds: 1h = 6 × ~61 days (fold 1 = training only), 4h = 5 × ~183 days */
const NF = TF === "1h" ? 6 : 5, FL = (META.end - META.start)/NF, FOLDS = Array.from({ length: NF }, (_, k) => [META.start + k*FL, META.start + (k + 1)*FL]);
const OOS0 = FOLDS[1][0], OOS1 = META.end;
const C0 = Object.assign({}, S8.COST, { fund8h: 0 });
/* resolve with the SİNYAL 8 resolver (fees, spread, slippage ×2 on stops), then add the funding actually paid/received between entry close and exit close */
function res(b, i, P, fund){ const o = S8.resolve(b, i, P, TMS, C0); if (!o) return null; const t0 = b[i].T, t1 = b[o.j].T; let f = 0;
  if (fund && fund.length){ let lo = 0, hi = fund.length; while (lo < hi){ const m = (lo + hi) >> 1; if (fund[m][0] <= t0) lo = m + 1; else hi = m; } for (let k = lo; k < fund.length && fund[k][0] <= t1; k++) f += fund[k][1]; }
  /* gap: a stop hit by a bar that OPENS beyond the stop fills at the open, not the stop (TP gaps are left at the TP = conservative) */
  let gap = 0; if (o.r === "SL"){ const op = b[o.j].o; if (P.d > 0 ? op < P.stop : op > P.stop) gap = P.d*(op - P.stop)/P.entry*100; }
  const fc = P.d*f*100, net = o.net - fc + gap, r = o.r === "T+" || o.r === "T−" ? (net > 0 ? "T+" : "T−") : o.r; return Object.assign(o, { net, gross: o.gross + gap, cost: o.cost + fc, fund: fc, R: net/P.riskP, r }); }
module.exports = { fs, R, S8, TF, DIR, META, TMS, HI, load, fundOf, SYMS, FOLDS, OOS0, OOS1, res, IVMS };
