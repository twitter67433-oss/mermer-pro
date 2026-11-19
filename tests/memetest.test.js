// v7.26 MEME TEST/SIM "BAKİYE EKLE" + "TEST SERBEST" — must never leak into GERÇEK: node tests/memetest.test.js
const fs = require("fs"), path = require("path"), cp = require("child_process"); let f = 0;
const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i !== undefined ? "  · " + i : "")); if (!c) f++; };
const src = fs.readFileSync(path.join(__dirname, "..", "meme.js"), "utf8");
{ const m = src.match(/const simFree = \(\) => ([^;]+);/); ok("simFree() is false whenever GERÇEK is active", m && /^!isReal\(\) &&/.test(m[1].trim()), m && m[1]); }
{ const m = src.match(/function simAdd\(v\)\{[\s\S]*?\n\/\*/); ok("BAKİYE EKLE (simAdd) refuses GERÇEK and only touches the virtual SIM ledger", m && /if \(isReal\(\)\) throw/.test(m[0]) && !/C\.(maxTrade|budget|dailyLoss|maxPos|rules)/.test(m[0]) && /SIM\.cash \+= v/.test(m[0])); }
{ const m = src.match(/\$\("#mm-loose"\)[\s\S]{0,200}/); ok("TEST SERBEST switch is ignored in GERÇEK", m && /if \(isReal\(\)\) return;/.test(m[0])); }
{ /* every limit / cooldown / confirmation bypass goes through simFree() (so it is SIM-only) */
  const bypass = ["L.length >= cp.max10", "lastMint && Date.now() - lastMint < cp.cool*1000", "await T().confirmSheet({ title: (isReal() ? \"\" : \"SIM · \") + \"AL", "await T().confirmSheet({ title: (isReal() ? \"\" : \"SIM · \") + \"SAT"];
  for (const b of bypass){ const i = src.indexOf(b); const pre = i > 0 ? src.slice(Math.max(0, i - 40), i) : ""; ok("guarded by !simFree(): " + b.slice(0, 40), i > 0 && /!simFree\(\) && (!\()?$/.test(pre), pre.slice(-20)); } }
{ /* GERÇEK limits identical to the previous release: defaults and allowed ranges unchanged */
  let head = ""; try { head = cp.execSync("git show 3d74de4254:meme.js", { cwd: path.join(__dirname, ".."), encoding: "utf8" }); } catch(e){}
  if (!head){ console.log("SKIP no git history"); }
  else { const def = s => (s.match(/const DEF = \{[^\n]*/) || [""])[0].replace(" simLoose: true,", ""), rng = s => (s.match(/const RANGE = \{[^\n]*\n[^\n]*/) || [""])[0];
    ok("GERÇEK defaults (maxTrade/budget/dailyLoss/maxPos/rules…) unchanged", def(src) === def(head));
    ok("allowed setting ranges unchanged", rng(src) === rng(head));
    const fn = (s, n) => { const i = s.indexOf("function " + n); if (i < 0) return "?"; const j = s.slice(i + 1).search(/\n(function |const |let |\/\*)/); return s.slice(i, i + 1 + j); }, lim = s => fn(s, "limitsErr"), rc = s => fn(s, "riskCheck"), pz = s => fn(s, "riskOnClose");
    ok("limitsErr / riskCheck / riskOnClose (pause, halving) unchanged", lim(src) === lim(head) && rc(src) === rc(head) && pz(src) === pz(head)); } }
ok("switching to GERÇEK still needs the typed confirmation", /typedConfirm\("GERÇEK MODA GEÇ"/.test(src));
console.log(f ? `${f} FAILED` : "ALL PASS"); process.exit(f ? 1 : 0);
