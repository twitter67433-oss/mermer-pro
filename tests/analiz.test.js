// v7.21 ANALİZ tab: shows exactly the SİNYAL decision; never upgrades a leaning to GİR. node tests/analiz.test.js
const SMT = require("../smart.js"), SCM = require("../scalp.js"), ANZ = require("../analiz.js"); let f = 0;
const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i !== undefined ? "  · " + i : "")); if (!c) f++; };
const TF = SCM.TF_SEL, mkI = (d, st = "BEKLE") => Object.fromEntries(TF.map(t => [t, { st, v: d, d, rel: { n: 30, acc: 0.6 } }]));
const px = 100, atr = 1, f4 = v => (+v).toFixed(4);
const cases = [];
for (const d of [1, -1, 0.3, -0.3, 0]) for (const main of [{ state: "BEKLE" }, { state: d >= 0 ? "LONG" : "SHORT", d: d >= 0 ? 1 : -1, plan: { entry: 100, stop: d >= 0 ? 99 : 101, tp: d >= 0 ? 102 : 98 } }, { state: "SIKIŞMA", plan: { longAbove: 101, shortBelow: 99 }, pUp: 0.6 }]){
  const I = mkI(d), C = SMT.consensus(I); let A = SMT.action(C, { main, px, atr, ema21: 99.5 }); if (A.kind === "trend" && !SMT.gGate(null)) A = { act: "BEKLE", d: 0, prefer: C.dir, kind: "kapı", wait: "A+ onayını bekle" };
  const dec = SMT.decision(C, A, { px, atr, ema21: 99.5, hi: 101, lo: 99, f: f4 }); cases.push({ I, C, A, dec, v: ANZ.view({ dec, C, A, I, sum: ["a", "b", "c", "d"], TF }) }); }
ok("same word as SİNYAL decision in every case (" + cases.length + ")", cases.every(c => c.v.word === c.dec.word));
ok("GİR shown only when SİNYAL says GİR, with its entry/stop/target", cases.every(c => c.v.go === /GİR/.test(c.dec.word) && (!c.v.go || (c.v.plan.entry === c.A.entry && c.v.plan.stop === c.A.stop && c.v.plan.tp === c.A.tp))));
ok("trend without proven gate → BEKLE (leaning never labelled GİR)", cases.filter(c => c.A.kind === "kapı").every(c => c.v.word === "BEKLE" && !c.v.plan) && cases.some(c => c.A.kind === "kapı"));
ok("A+ setup in the trend direction → GİR", cases.some(c => c.v.word === "GİR LONG") && cases.some(c => c.v.word === "GİR SHORT"));
ok("BEKLE shows the leaning from GENEL YÖN (eğilim LONG / SHORT / yatay)", cases.filter(c => !c.v.go).every(c => c.v.lean === (c.C.dir > 0 ? "eğilim LONG" : c.C.dir < 0 ? "eğilim SHORT" : "yatay")));
ok("BEKLE shows the SİNYAL trigger lines", cases.filter(c => !c.v.go).every(c => c.v.trig.length === c.dec.trig.length && c.v.trig.every((t, k) => t.t === c.dec.trig[k].t)));
ok("max 3 reasons, 12-interval row, confidence 0–100", cases.every(c => c.v.reasons.length === 3 && c.v.dirs.length === 12 && c.v.conf >= 0 && c.v.conf <= 100));
const src = require("fs").readFileSync(__dirname + "/../analiz.js", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
ok("signal only: analiz.js has no order / key / wallet code and no own network calls", !/order|apiKey|secret|wallet|EXEC|fetch\(|WebSocket/i.test(src));
console.log(f ? f + " FAIL" : "ALL PASS"); process.exit(f ? 1 : 0);
