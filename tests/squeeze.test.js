// v7.27 SQUEEZE RİSKİ (squeeze.js) tests: node tests/squeeze.test.js
const Q = require("../squeeze.js"); let f = 0;
const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i !== undefined ? "  · " + i : "")); if (!c) f++; };
const evaa = { oiCoins: 13.8e6, px: 4.9, circ: 6.62e6, mcap: 32e6, ls: [0.51, 0.47, 0.45, 0.43], chg24: 22 };
{ const r = Q.evaluate(evaa); ok("EVAA 19 Nov: OI 2.1× supply, L/S 0.43 falling, +22 % → ON", r.on && !r.partial && r.supRatio > 2, r.why); ok("line says SHORT GİRME", /SQUEEZE RİSKİ — SHORT GİRME/.test(Q.line(r))); }
ok("L/S rising → OFF", !Q.evaluate({ ...evaa, ls: [0.40, 0.45, 0.5, 0.55] }).on);
ok("L/S ≥ 0.6 → OFF", !Q.evaluate({ ...evaa, ls: [0.9, 0.8, 0.7, 0.62] }).on);
ok("24h +15 % → OFF", !Q.evaluate({ ...evaa, chg24: 15 }).on);
ok("OI small vs supply and mcap → OFF", !Q.evaluate({ ...evaa, oiCoins: 1e6 }).on);
ok("OI USD ≥ 1.5× mcap alone is enough (supply unknown)", Q.evaluate({ ...evaa, circ: null, oiCoins: 10e6, mcap: 30e6 }).on);
{ const r = Q.evaluate({ ...evaa, circ: null, mcap: null }); ok("no supply data → L/S + 24h only, marked partial", r.on && r.partial && /kısmi/.test(Q.line(r))); }
ok("1000PEPEUSDT → PEPE ×1000", Q.base("1000PEPEUSDT").b === "PEPE" && Q.base("1000PEPEUSDT").m === 1000 && Q.base("EVAAUSDT").m === 1);
ok("multiplier applied to OI coins", Q.evaluate({ oiCoins: 7e3, mult: 1000, px: 1, circ: 6e6, mcap: 1e9, ls: [0.5, 0.4], chg24: 30 }).supRatio > 1);
{ const src = require("fs").readFileSync(require("path").join(__dirname, "..", "squeeze.js"), "utf8"); ok("warning only: no order endpoints / keys", !/fapi\/v1\/order|X-MBX-APIKEY|signature|MEME\.|manual\(/.test(src)); }
console.log(f ? `${f} FAILED` : "ALL PASS"); process.exit(f ? 1 : 0);
