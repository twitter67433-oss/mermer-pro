// v7.33.2: SİMDE AÇ keeps the tab; open paper positions shown inside SHORT/LONG; stop-cross check side-correct
const fs = require("fs"), assert = require("assert");
const s = fs.readFileSync(__dirname + "/../sert.js", "utf8"), p = fs.readFileSync(__dirname + "/../psim.js", "utf8"), h = fs.readFileSync(__dirname + "/../index.html", "utf8");
assert(s.includes("(p - r.stop)*r.side <= 0) return null"), "act() hides only when price crossed the stop");
const crossed = (p, stop, side) => (p - stop)*side <= 0;
assert(crossed(101, 100, -1) && !crossed(99, 100, -1) && crossed(99, 100, 1) && !crossed(101, 100, 1));
assert(!/NAV\.go|scrollIntoView|location\.hash/.test(p), "psim must not navigate");
const so = s.slice(s.indexOf("async function simOpen"), s.indexOf("function paintPos"));
assert(!/NAV\.go|scrollIntoView|location\.hash/.test(so), "simOpen must not navigate");
assert(h.includes('id="hx-pos-short"') && h.includes('id="hx-pos-long"'));
assert(p.includes("closePos") && p.includes('"psim:change"'));
assert(!/fapi\/v1\/order|privateKey|apiKey|X-MBX-APIKEY/i.test(s + p), "paper only, no keys/orders");
console.log("simtab ok");
