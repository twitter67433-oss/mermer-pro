const assert = require("assert"), X = require("../sert.js");
const bar = (h, l, c) => ({ h, l, c });
// SHORT, entry 100, SL 101 → R 1, TP2 98. Goes against to 102.5 (would stop), then hits 98 → STOPSUZ TP2, MAE 2.5 %
let B = [bar(100.5, 99.8, 100.2), bar(102.5, 100, 102), bar(101, 97.9, 98.2)].concat(Array(57).fill(bar(98.5, 98.1, 98.3)));
let f = X.simFree(-1, 100, 101, B, 60); assert.strictEqual(f.why, "TP2"); assert.strictEqual(f.bars, 3); assert.ok(Math.abs(f.net - (0.02 - 0.001)) < 1e-12); assert.ok(Math.abs(f.mae - 0.025) < 1e-12);
const s = X.simExit(100, 101, 0.5, B, 60); assert.ok(s.net < 0); // STOPLU lost on the same path
// no TP2 → 60dk close; fewer than 60 bars → still open (null)
B = Array(60).fill(bar(100.4, 99.5, 99.7)); f = X.simFree(-1, 100, 101, B, 60); assert.strictEqual(f.why, "60dk"); assert.ok(Math.abs(f.net - (0.003 - 0.001)) < 1e-12); assert.ok(Math.abs(f.mae - 0.004) < 1e-12);
assert.strictEqual(X.simFree(-1, 100, 101, B.slice(0, 30), 60), null);
// TERSİ LONG stopsuz: TP2 = 102, MAE from lows
B = [bar(100.2, 98.6, 99), bar(102.1, 99, 102)]; f = X.simFree(1, 100, 101, B, 60); assert.strictEqual(f.why, "TP2"); assert.ok(Math.abs(f.mae - 0.014) < 1e-12); assert.ok(Math.abs(f.net - 0.019) < 1e-12);
// summary / sonuc / ilk / csv with ns keys
const J = [{ sym: "AUSDT", t: 1, entry: 100, stop: 101, ns: { net: 0.01, why: "TP2", exit: 98, mae: 0.02 }, nsr: { net: -0.02, why: "60dk", exit: 98, mae: 0.03 }, res: { net: -0.011, why: "stop", exit: 101 } },
  { sym: "BUSDT", t: 2, entry: 10, stop: 10.1, ns: { net: -0.005, why: "60dk", exit: 10.05, mae: 0.04 } }, { sym: "CUSDT", t: 3, entry: 1, stop: 1.01 }];
const S = X.summary(J, "ns"); assert.strictEqual(S.toplam, 3); assert.strictEqual(S.dogru, 1); assert.strictEqual(S.yanlis, 1); assert.strictEqual(S.acik, 1); assert.ok(Math.abs(S.maeMax - 0.04) < 1e-12); assert.ok(Math.abs(S.maeOrt - 0.03) < 1e-12);
assert.strictEqual(X.summary(J, "res").maeMax, null);
assert.strictEqual(X.sonuc(J[0], "ns"), "DOĞRU"); assert.strictEqual(X.sonuc(J[0], "res"), "YANLIŞ"); assert.strictEqual(X.ilk(J[0], "ns"), "TP2"); assert.strictEqual(X.ilk(J[1], "ns"), "60dk");
assert.deepStrictEqual(X.KEYS.STOPSUZ, ["ns", "nsr"]); assert.deepStrictEqual(X.KEYS.STOPLU, ["res", "rev"]);
const c = X.csv(J).split("\n"); assert.ok(c[0].includes("stopsuz net %") && c[0].includes("stopsuz MAE %")); assert.strictEqual(c[0].split(";").length, c[1].split(";").length); assert.ok(c.some(l => l.includes(";DOĞRU;TP2;98;1.000;2.000;")));
console.log("stopsuz.test OK");
