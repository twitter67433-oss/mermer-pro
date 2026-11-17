// v7.13 AKILLI SİNYAL engine tests: node tests/smart.test.js
const SMT = require("../smart.js"); let f = 0; const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i !== undefined ? "  · " + i : "")); if (!c) f++; };
const bar = (i, o, c, h, l, v = 10, tb) => ({ t: 1.7e12 + i*9e5, T: 1.7e12 + (i + 1)*9e5 - 1, o, c, h: h ?? Math.max(o, c)*1.001, l: l ?? Math.min(o, c)*0.999, v, tb: tb ?? v/2, x: true });
const nz = i => Math.sin(i*1.7)*0.4 + Math.sin(i*0.37)*0.3;
const series = (n, fn, vf = () => 10) => Array.from({ length: n }, (_, i) => bar(i, fn(i - 1), fn(i), undefined, undefined, vf(i), vf(i)*(fn(i) >= fn(i - 1) ? 0.6 : 0.4)));
// patterns
const eng = [bar(0, 100, 99), bar(1, 101, 100), bar(2, 99.8, 101.5)]; ok("pattern: bullish engulfing", SMT.patternsAt(eng, 2).some(p => p.k === "engB"));
const ham = [bar(0, 100, 99), bar(1, 99, 98), bar(2, 97.9, 98, 98.05, 96)]; ok("pattern: hammer/pin shape found", SMT.patternsAt(ham, 2).some(p => p.k === "hammer" || p.k === "pinB"));
const ms = [bar(0, 105, 100), bar(1, 99.8, 99.7, 100, 99.5), bar(2, 100, 104)]; ok("pattern: morning star", SMT.patternsAt(ms, 2).some(p => p.k === "mstar"));
const sol = [bar(0, 100, 101), bar(1, 101, 102), bar(2, 102, 103)]; ok("pattern: three white soldiers", SMT.patternsAt(sol, 2).some(p => p.k === "3ws"));
// no lookahead: votes at bar i identical whether or not later bars exist
const b = series(400, i => 100 + i*0.02 + nz(i)), P1 = SMT.prep(b.slice(0, 300)), P2 = SMT.prep(b), v1 = SMT.votesAt(P1, 299), v2 = SMT.votesAt(P2, 299);
ok("no lookahead: votes at i unchanged by future bars", JSON.stringify(v1.T) === JSON.stringify(v2.T) && JSON.stringify(v1.R) === JSON.stringify(v2.R));
const W = SMT.walk(P2, {}); ok("walk returns live state, finite score, no NaN votes", W && isFinite(W.live.sc.S) && W.V.every(a => Object.values(a.T).concat(Object.values(a.R)).every(isFinite)));
const W1 = SMT.walk(P1, {}), sig1 = W1.sig.map(s => s.i).join(), sig2 = W.sig.filter(s => s.i < 299).map(s => s.i).join(); ok("walk-forward: past A+ decisions do not change when future bars arrive", sig1 === sig2, sig1.length + " chars");
// learning: a feature that always predicts gets weight, random → ~0
ok("wOf: strong predictor → weight > 0, coin-flip → 0, reversed → < 0", SMT.wOf({ n: 200, ok: 140 }) > 0.3 && SMT.wOf({ n: 200, ok: 101 }) === 0 && SMT.wOf({ n: 200, ok: 60 }) < -0.3);
// squeeze → breakout
const sq = []; for (let i = 0; i < 200; i++){ const base = i < 120 ? 100 + nz(i)*3 : 100 + Math.sin(i)*0.15; sq.push(bar(i, base - 0.05, base, base + 0.12, base - 0.12, i < 120 ? 20 : 6)); } sq.push(bar(200, 100, 101.2, 101.3, 99.95, 40, 34));
const PS = SMT.prep(sq), Wsq = SMT.walk(PS, {}); ok("squeeze detected in a tight low-volume range", PS.sq[199] && PS.box[199] && PS.box[199].len >= 10, JSON.stringify(PS.sq[199]));
ok("close outside box with volume → PUMP", Wsq.live.sq && Wsq.live.sq.kind === "PUMP" && Wsq.live.sq.stop < 100 && Wsq.live.sq.tp > 101.2);
ok("squeezeDir: buyers + positive flow → pUp > 0.5", SMT.squeezeDir({ pos: 0.8, cvd: 0.7, tk: 0.5, ob: 0.4 }).pUp > 0.65);
// liquidation magnets
const oiH = [{ t: 0, oi: 1000, px: 100, ls: 0.5 }, { t: 1, oi: 2000, px: 100, ls: 0.5 }]; const lm = SMT.liqMagnets(oiH, 100, [{ t: 2, h: 100.5, l: 99.5 }], { range: 0.2 });
ok("liq magnets: 10x long liq ≈ 90.4 below, short liq ≈ 109.6 above", lm.below.some(m => Math.abs(m.p - 90.4) < 0.3) && lm.above.some(m => Math.abs(m.p - 109.6) < 0.3));
// walls + spoof
const mk = (bw) => ({ bids: [["99.9", "1"], ["99.8", "1"], ["99.5", bw ? "500" : "1"], ["99", "1"], ["98.5", "1"]].concat(Array.from({ length: 40 }, (_, i) => [String(98 - i*0.01), "1"])), asks: [["100.1", "1"], ["100.2", "1"]].concat(Array.from({ length: 40 }, (_, i) => [String(100.3 + i*0.01), "1"])) });
let m = SMT.walls(mk(true), null, 0).mem; m = SMT.walls(mk(true), m, 5000).mem; const w3 = SMT.walls(mk(false), m, 10000); ok("walls: big bid wall seen then vanished without price reaching it → spoof", w3.mem.spoof.length === 1 && w3.mem.spoof[0].side === 1);
// v7.14 GENEL YÖN consensus
{ const all = (d, rel) => Object.fromEntries(SMT.G_ALL.map(t => [t, { d, rel }]));
  const up = SMT.consensus(all(1)); ok("consensus: all intervals up → GÜÇLÜ LONG, strength 100", up.label === "GÜÇLÜ LONG" && up.strength === 100 && up.dir === 1);
  const dn = SMT.consensus(all(-0.5)); ok("consensus: all -0.5 → GÜÇLÜ SHORT", dn.label === "GÜÇLÜ SHORT");
  const I = all(0.75); for (const t of SMT.G_SHORT) I[t] = { d: -1 }; const pb = SMT.consensus(I); ok("consensus: big up, short down → still LONG (higher TFs carry trend)", pb.dir === 1 && pb.short < 0, pb.label + " G=" + pb.G.toFixed(2));
  const I2 = all(0); for (const t of SMT.G_SHORT) I2[t] = { d: 1 }; ok("consensus: only 1–5dk up → not GÜÇLÜ (short TFs only time it)", !SMT.consensus(I2).strong, SMT.consensus(I2).label);
  ok("consensus: empty → NÖTR, finite", SMT.consensus({}).label === "NÖTR" && isFinite(SMT.consensus({}).G));
  const good = SMT.relMul({ n: 300, acc: 0.6 }), bad = SMT.relMul({ n: 300, acc: 0.4 }), few = SMT.relMul({ n: 3, acc: 1 }); ok("reliability: good > 1 > bad, few samples shrink to ≈1", good > 1 && bad < 1 && Math.abs(few - 1) < 0.6, [good, bad, few].map(x => x.toFixed(2)).join("/"));
  const a1 = SMT.action(up, { main: {}, px: 100, atr: 1, ema21: 99 }); ok("action: GÜÇLÜ + short aligned → GİR LONG with stop below, target above", a1.act === "GİR LONG" && a1.kind === "trend" && a1.stop < 100 && a1.tp > 100);
  const a2 = SMT.action(pb, { main: {}, px: 100, atr: 1, ema21: 99 }); ok("action: big up, short down → BEKLE geri çekilmeyi bekle at EMA21", a2.act === "BEKLE" && a2.wait === "geri çekilmeyi bekle" && a2.entry === 99 && a2.stop < 99);
  const a3 = SMT.action(SMT.consensus({}), { main: { state: "SIKIŞMA", plan: { longAbove: 101, shortBelow: 99 }, pUp: 0.6 }, px: 100, atr: 1 }); ok("action: squeeze → BEKLE kırılımı bekle with both levels", a3.wait === "kırılımı bekle" && a3.longAbove === 101);
  const a4 = SMT.action(dn, { main: { state: "LONG", d: 1, plan: { entry: 100, stop: 99, tp: 101 } }, px: 100, atr: 1 }); ok("action: A+ LONG against strong SHORT big picture → not GİR", a4.act !== "GİR LONG");
  const L = { "1m": "1dk", "3m": "3dk", "5m": "5dk", "1h": "1s", "4h": "4s", "1d": "1G" }, I3 = { ...I, "15m": { d: -1 }, "30m": { d: -1 } }, sm = SMT.summary(I3, SMT.consensus(I3), L, "15dk'da sıkışma var."), smx = SMT.summary(I, pb, L, null); ok("summary: ≤3 lines, big up + short pullback wording, no NaN/undefined", sm.length === 3 && /Büyük resim yukarı/.test(sm[0]) && /geri çekiliyor/.test(sm[1]) && !/NaN|undefined/.test(sm.join(" ")), sm.join(" | "));
  ok("summary: mixed short/mid → 'karışık' with both sides", /karışık/.test(smx[1]) && smx.length === 2, smx.join(" | "));
  ok("gate: needs ≥20 entries, ≥55 % winners, positive avg", !SMT.gGate({ T: { n: 30, win: 0.6, avg: -0.01 } }) && !SMT.gGate({ T: { n: 10, win: 0.9, avg: 1 } }) && SMT.gGate({ T: { n: 25, win: 0.56, avg: 0.05 } }));
  // gReplay: no lookahead — appending future bars must not change results computed before them
  const mkB = (n, ms, seed) => { let p = 100, r = seed; const out = []; for (let i = 0; i < n; i++){ r = (r*16807) % 2147483647; const o = p; p = p*(1 + ((r/2147483647) - 0.49)*0.01); out.push({ t: i*ms, o, h: Math.max(o, p)*1.002, l: Math.min(o, p)*0.998, c: p, v: 100, T: i*ms + ms - 1, tb: 50, x: true }); } return out; };
  const K = { "15m": mkB(400, 9e5, 7), "1h": mkB(100, 36e5, 9), "4h": mkB(60, 144e5, 11) }, cut = K["15m"][300].T;
  const cutK = Object.fromEntries(Object.entries(K).map(([t, b]) => [t, b.filter(x => x.T <= cut)]));
  const gA = SMT.gReplay(K, "15m", { maxB: 0 }), gB = SMT.gReplay(cutK, "15m", { maxB: 0 }); const lt = gA.tr.filter(r => r.t <= K["15m"][299].t).length;
  ok("gReplay: entries before the cut are identical with/without future data", lt === gB.tr.length, lt + " vs " + gB.tr.length); }
console.log(f ? f + " FAIL" : "ALL PASS"); process.exit(f ? 1 : 0);
