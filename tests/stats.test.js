/* v7.40 FAZ 2 G — honest signal statistics: same-bar SL+TP = SL, timeouts counted, net win after fee, unresolved never counted */
const assert = require("assert"), fs = require("fs"), path = require("path"), SMT = require("../smart.js");
const bar = (o, h, l, c) => ({ o, h, l, c, x: true });
// same candle touches both stop and target → SL (conservative)
{ const b = [bar(100, 100, 100, 100), bar(100, 103, 97, 100)]; const r = SMT.resolveTrade(b, 0, 1, 98, 102, 5); assert.strictEqual(r.r, "SL"); }
{ const b = [bar(100, 100, 100, 100), bar(100, 103, 97, 100)]; const r = SMT.resolveTrade(b, 0, -1, 102, 98, 5); assert.strictEqual(r.r, "SL", "short too"); }
// unclosed bar / not enough future bars → null (never counted)
assert.strictEqual(SMT.resolveTrade([bar(100, 100, 100, 100), Object.assign(bar(100, 100.5, 99.5, 100), { x: false })], 0, 1, 98, 102, 5), null);
assert.strictEqual(SMT.resolveTrade([bar(100, 100, 100, 100), bar(100, 100.5, 99.5, 100)], 0, 1, 98, 102, 5), null);
// timeout classification
{ const b = [bar(100, 100, 100, 100), bar(100, 100.5, 99.5, 100.3), bar(100.3, 100.5, 99.9, 100.2)]; const r = SMT.resolveTrade(b, 0, 1, 98, 102, 2); assert.strictEqual(r.r, "+"); }
// accounting: TP, SL, timeout-win, timeout-loss, tiny timeout gain eaten by the fee
const B = SMT.bucket(); for (const r of [{ r: "TP", pnl: 2 }, { r: "SL", pnl: -1 }, { r: "SL", pnl: -1 }, { r: "+", pnl: 0.5 }, { r: "−", pnl: -0.3 }, { r: "+", pnl: 0.05 }]) SMT.addB(B, r);
assert.strictEqual(B.n, 6); assert.strictEqual(B.tp, 1); assert.strictEqual(B.sl, 2); assert.strictEqual(B.top, 1); assert.strictEqual(B.ton, 2, "+0.05% < fee → loss");
assert.strictEqual(B.tp + B.sl + B.top + B.ton, B.n, "every trade in exactly one class");
assert.strictEqual(B.win, 2); assert.ok(Math.abs(SMT.winB(B) - 2/6) < 1e-12); assert.ok(Math.abs(SMT.hitB(B) - 1/3) < 1e-12); assert.ok(Math.abs(SMT.tpRateB(B) - 1/6) < 1e-12);
assert.ok(Math.abs(B.pnl - (2 - 1 - 1 + 0.5 - 0.3 + 0.05 - 6*0.10)) < 1e-9, "fee per trade");
assert.strictEqual(SMT.winB(SMT.bucket()), null);
// A+ gate uses the stricter of TP/SL rate and net win rate (never weaker than before)
const src = fs.readFileSync(path.join(__dirname, "..", "smart.js"), "utf8"); assert.ok(/Math\.min\(sh, winB\(SB\)\) < minHit/.test(src));
console.log("stats.test OK");
