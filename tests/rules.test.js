/* v7.32 rule book: 7 lists, side-aware stops, SERT identical to PSIM.sertShort, generic DEFTER follow-up */
const assert = require("assert"), X = require("../sert.js"), P = require("../psim.js");
const base = (n = 300, px = 100) => Array.from({ length: n }, (_, i) => ({ t: i*900000, o: px, h: px*1.004, l: px*0.996, c: px*(i % 2 ? 1.001 : 0.999), qv: 1000, tb: 500 }));
const set = (b, x) => { b[b.length - 1] = Object.assign({ t: b[b.length - 1].t }, x); return b; };
assert.strictEqual(X.LISTS.length, 9); assert.deepStrictEqual(X.LISTS.filter(l => l.tab === "short").map(l => l.k), ["sert", "sqs", "dag", "dvs"]); assert.deepStrictEqual(X.LISTS.filter(l => l.tab === "long").map(l => l.k), ["lng", "sql", "kap", "top", "dvl"]);
for (const l of X.LISTS) assert.ok(l.bt && /45g test/.test(l.bt) && l.maxR > 0 && l.maxR <= 0.05);
// red breakdown, 4× volume, 70 % taker sell
let b = set(base(), { o: 100, h: 100.3, l: 98.6, c: 98.8, qv: 4000, tb: 1200 });
const f = X.feat(b); assert.ok(f.red && f.vr > 3.9 && Math.abs(f.sell - 0.7) < 1e-9);
// SERT: same as PSIM.sertShort for a grid of OI / funding
for (const oi of [NaN, 0, 0.012, -0.02]) for (const fr of [NaN, 0, 0.0006, -0.0004]){ const ps = P.sertShort(b, oi, fr).sig, me = X.fullK("sert", f, oi, fr); assert.strictEqual(me, ps, `sert ${oi} ${fr}`); }
let T = X.evalAll(b, 0.02, 0); assert.ok(T.some(t => t.k === "sert" && t.side === -1 && Math.abs(t.stop - 100.3*1.0005) < 1e-9));
// SQUEEZE SHORT via funding ≥ 0.05 %; DEVAM SHORT needs a sharp drop + OI falling + funding ≥ 0
assert.ok(X.fullK("sqs", f, NaN, 0.0006) && !X.fullK("sqs", f, NaN, 0.0001));
assert.ok(!X.fullK("dvs", f, -0.02, 0.0001)); // −1.2 % bar, no −2 %
b = set(base(), { o: 100, h: 100.2, l: 97.4, c: 97.6, qv: 4000, tb: 1500 }); let g = X.feat(b);
assert.ok(X.fullK("dvs", g, -0.02, 0.0001) && !X.fullK("dvs", g, 0.01, 0.0001) && !X.fullK("dvs", g, -0.02, -0.0002));
T = X.evalAll(b, -0.02, 0.0001); const dv = T.find(t => t.k === "dvs"); assert.ok(dv && Math.abs(dv.stop - Math.max(...b.slice(-4).map(y => y.h))*1.0005) < 1e-9);
// LONG side: green breakout, 75 % taker buy, OI +1 %
b = set(base(), { o: 100, h: 101.5, l: 99.9, c: 101.3, qv: 4000, tb: 3000 }); g = X.feat(b);
assert.ok(X.fullK("lng", g, 0.015, 0) && !X.fullK("lng", g, 0.0, 0));
assert.ok(X.fullK("sql", g, 0, -0.0004) && !X.fullK("sql", g, 0, 0.0001));
T = X.evalAll(b, 0.015, -0.0004); const lg = T.find(t => t.k === "lng"); assert.ok(lg && lg.side === 1 && lg.stop < lg.entry && Math.abs(lg.stop - 99.9*0.9995) < 1e-9);
assert.ok(!T.some(t => t.side === -1));
// list toggles: PASİF lists are not evaluated
assert.ok(!X.evalAll(b, 0.015, -0.0004, { lng: false }).some(t => t.k === "lng"));
// KAPİTÜLASYON: 3 red bars then a ≥2 ATR bar with a long lower wick on 3× volume
b = base(); const n = b.length; for (const i of [n - 4, n - 3, n - 2]) b[i] = Object.assign({}, b[i], { o: 100, c: 99.5 }); set(b, { o: 99.4, h: 99.6, l: 96.5, c: 99.2, qv: 4000, tb: 2000 }); g = X.feat(b);
assert.ok(X.preK("kap", g) && X.fullK("kap", g, NaN, NaN)); T = X.evalAll(b, NaN, NaN); assert.ok(T.some(t => t.k === "kap" && t.side === 1));
// risk caps: stop must be on the right side and within maxR
assert.ok(X.okR(-1, 100, 101, 0.03) && !X.okR(-1, 100, 99, 0.03) && !X.okR(1, 100, 101, 0.03) && X.okR(1, 100, 99, 0.03) && !X.okR(1, 100, 94, 0.05));
// generic follow-up: LONG record entry 100, SL 99 (R 1) → TP2 102 hit, mirrored SHORT loses
const bar = (h, l, c) => ({ h, l, c }); const B = [bar(100.5, 99.6, 100.3), bar(102.2, 100.2, 102)].concat(Array(58).fill(bar(102.1, 101.8, 102)));
const o = X.follow({ side: 1, entry: 100, stop: 99, atr: 0.5, t: 0 }, B);
assert.strictEqual(o.ns.why, "TP2"); assert.ok(o.ns.net > 0.018); assert.ok(o.res.net > 0); assert.ok(o.nsr.net < 0); assert.strictEqual(o.tp.first, "TP2"); assert.ok(Math.abs(o.ns.mae - 0.004) < 1e-12);
// SHORT record identical to v7.31 path
const o2 = X.follow({ side: -1, entry: 100, stop: 101, atr: 0.5, t: 0 }, B); assert.deepStrictEqual(o2.res.why, X.simExit(100, 101, 0.5, B, 60).why); assert.ok(o2.ns.net < 0 && o2.nsr.net > 0);
// signal only
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "sert.js"), "utf8"); assert.ok(!/fapi\/v1\/(order|leverage|batchOrders)|apiKey|X-MBX-APIKEY|signature=/i.test(src)); assert.ok(/forceOrder@arr/.test(src));
console.log("rules.test OK");
