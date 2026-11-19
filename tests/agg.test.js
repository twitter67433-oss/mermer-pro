const assert = require("assert"), A = require("../agg.js"), fs = require("fs"), path = require("path");
assert.strictEqual(A.key("1000PEPEUSDT"), "PEPE"); assert.strictEqual(A.key("PEPE-USDT-SWAP"), "PEPE"); assert.strictEqual(A.key("SOLUSDT"), "SOL");
const c = A.combine([{ ex: "Binance", oiUsd: 300, fr: 0.0001, ls: 0.6 }, { ex: "Bybit", oiUsd: 100, fr: 0.0005, ls: 0.4 }, { ex: "OKX", oiUsd: NaN, fr: 1 }, { ex: "Bitget", oiUsd: 100, fr: NaN }]);
assert.strictEqual(c.oiUsd, 500); assert.strictEqual(c.n, 3); assert.ok(Math.abs(c.fr - 0.0002) < 1e-12); assert.ok(Math.abs(c.ls - 0.55) < 1e-12);
assert.ok(Math.abs(A.chg([{ now: 110, ago: 100 }, { now: 50, ago: NaN }, { now: 220, ago: 200 }]) - 0.1) < 1e-12); assert.ok(isNaN(A.chg([])));
// detector
assert.strictEqual(A.detect({ p1: 0.004, p4: -0.01, v1: 2, oi1: 0.035, td1: 0.05 }).state, "TOPLAMA");
assert.strictEqual(A.detect({ p1: 0.004, p4: -0.01, v1: 2, oi1: 0.02, td1: 0.05 }).state, "");
assert.strictEqual(A.detect({ p1: 0.02, p4: 0.05, v1: 1, oi1: 0.015, td1: -0.12 }).state, "DAĞITIM");
assert.strictEqual(A.detect({ p1: 0.02, p4: 0.05, v1: 1, oi1: 0.015, td1: -0.05 }).state, "");
// kline features: 289 5m bars, flat then last hour heavy buying
const b = Array.from({ length: 289 }, (_, i) => ({ c: 100, qv: 100, tb: 50 })); for (let i = 277; i < 289; i++) b[i] = { c: 100.2, qv: 300, tb: 200 };
const f = A.kfeat(b); assert.ok(Math.abs(f.p1 - 0.002) < 1e-9 && f.v1 > 2.5 && Math.abs(f.td1 - 1/3) < 1e-9);
const src = fs.readFileSync(path.join(__dirname, "..", "agg.js"), "utf8"); assert.ok(!/apiKey|secret|signature=|X-MBX-APIKEY|\/order|OK-ACCESS|X-BAPI-API-KEY|ACCESS-KEY/i.test(src)); assert.ok(!/visibilitychange/.test(src));
console.log("agg.test OK");
