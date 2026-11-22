/* MERMER PRO no-look-ahead: every value the engine uses at bar i must be identical when all bars after i are deleted (truncation invariance). */
const assert = require("assert"), I = require("../pro/ind.js"), C = require("../pro/core.js"); let n = 0; const ok = (m, c) => { assert.ok(c, m); n++; console.log("PASS", m); };
const rnd = C.rng(99); const b = []; let p = 50, t0 = Date.UTC(2026, 0, 1);
for (let i = 0; i < 2600; i++){ const vol = 0.004 + 0.006*Math.abs(Math.sin(i/300)), dr = 0.0004*Math.sin(i/500); const o = p, c = o*(1 + dr + (rnd() - 0.5)*2*vol), h = Math.max(o, c)*(1 + rnd()*vol), l = Math.min(o, c)*(1 - rnd()*vol), qv = 3e5*(0.5 + rnd())*(1 + 3*(rnd() < 0.02));
  b.push({ t: t0 + i*900000, o, h, l, c, v: qv/c, qv, tb: qv*(0.3 + 0.4*rnd()) }); p = c; }
const fr = []; for (let k = 0; k < 2600/32; k++) fr.push([t0 + k*8*3600000, (rnd() - 0.4)*0.0006]);
const full = C.prepare(b, { fr }); const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const idx = [1200, 1500, 1777, 2000, 2311, 2599]; let allSame = true, any = 0, firstBad = null;
for (const i of idx){ const tr = C.prepare(b.slice(0, i + 1), { fr }); const A = C.evalAt(full, i), B = C.evalAt(tr, i); if (!same(A, B)){ allSame = false; firstBad = firstBad || i; } }
ok("evalAt(full series, i) === evalAt(series cut at i, i) — families, regime, candidates, rejections", allSame || console.log("first mismatch at", firstBad));
let fails = 0; for (let i = 1100; i < 2600; i += 7){ const tr = C.prepare(b.slice(0, i + 1), { fr }); const A = C.evalAt(full, i), B = C.evalAt(tr, i); if (!same(A, B)) fails++; any += A.cands.length; }
ok("same over 215 sampled bars (" + any + " candidates seen)", fails === 0);
for (const [nm, f] of [["EMA", x => I.ema(x.map(y => y.c), 50)], ["RSI", x => I.rsi(x.map(y => y.c))], ["ATR", x => I.atr(x)], ["ADX", x => I.adx(x).adx], ["MACD", x => I.macd(x.map(y => y.c)).hist], ["BB", x => I.boll(x.map(y => y.c)).up], ["VWAP", x => I.vwap(x)], ["OBV", x => I.obv(x)], ["Donchian", x => I.donch(x, 48).hi], ["prank", x => I.prank(I.atr(x), 960)]]){
  let bad = 0; for (const i of [500, 1300, 2222]){ const a = f(b)[i], z = f(b.slice(0, i + 1))[i]; if (a !== z) bad++; } ok(nm + ": value at i unchanged by later bars", bad === 0); }
{ const i = 1800, s = C.evalAt(full, i); const P2 = C.prepare(b.slice(0, i + 1).concat(b.slice(i + 1).map(x => ({ ...x, h: x.h*1.5, c: x.c*1.4 }))), { fr }); ok("changing FUTURE bars does not change the decision at i", same(C.evalAt(P2, i), s)); }
console.log("\nall passed (" + n + ")");
