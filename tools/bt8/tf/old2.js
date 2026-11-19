/* old engines (v7.33.3 code) on 1h/4h — same resolver + cost model + real funding. node old2.js walk|scalp|sert */
const L2 = require("./lib2.js"), { S8, SYMS, META, TMS, HI, TF, load, fundOf, res, fs } = L2;
const SMT = require("/workspace/r750/old733/smart.js"), SCX = require("/workspace/neon-terminal-mobile/scalpmode.js");
const which = process.argv[2], out = {}, btc = load("BTCUSDT", TF), C0 = Object.assign({}, S8.COST, { fund8h: 0 });
const SR = { sert: [-1, 0.03], sqs: [-1, 0.05], dvs: [-1, 0.05], lng: [1, 0.03], sql: [1, 0.05], kap: [1, 0.05], dvl: [1, 0.05] };
function fundAt(fu, t){ let lo = 0, hi = fu.length; while (lo < hi){ const m = (lo + hi) >> 1; if (fu[m][0] <= t) lo = m + 1; else hi = m; } return lo ? fu[lo - 1][1] : NaN; }
function fsum(fu, t0, t1){ let f = 0; for (const x of fu) if (x[0] > t0 && x[0] <= t1) f += x[1]; return f; }
/* SERT-style exit (app "stoplu"): stop = signal extreme ± 0.05 %, trail 1×ATR, close after 4 bars (= 60 min on 15m) */
function trail(b, i, d, stop, atr, fu){ let s = stop; const e = b[i].c, riskP = Math.abs(e - stop)/e*100; for (let j = i + 1; j <= i + 4; j++){ if (j >= b.length) return null; const k = b[j];
    if (d < 0 ? k.h >= s : k.l <= s){ return fin(d < 0 ? Math.max(s, k.o) : Math.min(s, k.o), j, true); } s = d < 0 ? Math.min(s, k.l + atr) : Math.max(s, k.h - atr); } return fin(b[i + 4].c, i + 4, false);
  function fin(x, j, st){ const g = d*(x - e)/e*100, c = S8.costPct({ stop: st }, C0) + d*fsum(fu, b[i].T, b[j].T)*100, net = g - c; return { R: net/riskP, net, gross: g, r: st ? "SL" : (net > 0 ? "T+" : "T−"), j, riskP }; } }
for (const s of SYMS){ const b = load(s, TF); if (b.length < 400) continue; const fu = fundOf(s), L = [];
  const rec = (i, d, entry, stop, tp, maxB, eng) => { const P = { d, entry, stop, tp, maxB, riskP: Math.abs(entry - stop)/entry*100 }; if (!(P.riskP > 0)) return; const o = res(b, i, P, fu); if (!o) return; L.push({ i, t: b[i].t, s: eng, d, R: o.R, net: o.net, r: o.r, j: o.j }); };
  if (which === "walk"){ const P = SMT.prep(b, { tms: TMS, h1: load(s, HI[0]), h2: load(s, HI[1]), btc: s === "BTCUSDT" ? null : btc });
    for (const mode of ["trend", "rev"]){ const W = SMT.walk(P, { mode }); for (const x of W.sig) if (b[x.i].t >= META.start) rec(x.i, x.d, x.entry, x.stop, x.tp, SMT.H_OUT, "A+" + mode);
      if (mode === "trend") for (const x of W.brk) if (b[x.i].t >= META.start){ const bx = P.box[x.i - 1]; rec(x.i, x.d, x.entry, x.stop, x.tp, Math.max(10, Math.min(30, bx ? bx.len : 20)), "PUMP/DUMP"); } } }
  if (which === "scalp"){ const C = SCX.CFG, P = SCX.prep(b), BP = SCX.prep(btc); let j = 0, gate = null, step = TF === "1h" ? 4 : 2;
    for (let i = 1000; i < b.length - 1; i++){ if (b[i].t < META.start) continue; while (j + 1 < BP.n && BP.b[j + 1].t <= b[i].t) j++;
      if (!gate || i % step === 0){ gate = SCX.sReplay(b.slice(i - 999, i + 1), { btc: s === "BTCUSDT" ? null : btc.slice(Math.max(0, j - 999), j + 1) }); }
      const F = SCX.feats(P, i, s === "BTCUSDT" ? null : { P: BP, j }), sc = SCX.score(F), d = Math.sign(Math.abs(sc) > C.lean ? sc : 0), x = b[i], At = P.A[i] || x.c*0.001;
      if (d && Math.abs(sc) >= C.th && C.tpK*At/x.c*100 >= C.feeX*(C.fee + C.spread) && SCX.sGate(gate)) rec(i, d, x.c, x.c - d*C.stopK*At, x.c + d*C.tpK*At, C.maxB, "SCALP"); } }
  if (which === "sert"){ const SX = require("/workspace/neon-terminal-mobile/sert.js"); let busy = {};
    for (let i = 300; i < b.length - 5; i++){ if (b[i].t < META.start) continue; const w = b.slice(i - 299, i + 1), f = SX.feat(w); if (!f) continue; const fr = fundAt(fu, b[i].T);
      for (const k in SR){ if ((busy[k] ?? -1) >= i || !SX.preK(k, f)) continue; const [d, maxR] = SR[k];
        /* OI history (>30 days) is not public → OI conditions dropped; funding = last settled rate */
        const ok = { sert: fr >= 0.0005, sqs: SX.fullK("sqs", f, NaN, fr), dvs: fr >= 0, lng: true, sql: fr <= -0.0003, kap: true, dvl: fr <= 0.0001 }[k]; if (!ok) continue;
        const x = f.x, stop = SX.stopK(k, f); if (Math.abs(stop - x.c)/x.c > maxR) continue; const o = trail(b, i, d, stop, f.atr, fu); if (!o) continue; busy[k] = o.j;
        L.push({ i, t: b[i].t, s: "SERT-" + k, d, R: o.R, net: o.net, r: o.r, j: o.j }); } } }
  out[s] = L; }
fs.writeFileSync(`/workspace/r750/tf/old_${which}_${TF}.json`, JSON.stringify(out)); console.log(TF, which, "done", Object.values(out).reduce((a, x) => a + x.length, 0));
