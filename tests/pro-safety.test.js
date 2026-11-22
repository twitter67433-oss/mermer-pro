/* MERMER PRO safety: storage namespace isolates the original app's data; PRO tab has no order/key code; LONG/SHORT only from validated strategies */
const assert = require("assert"), fs = require("fs"), path = require("path"), vm = require("vm"), D = path.join(__dirname, ".."); let n = 0; const ok = (m, c) => { assert.ok(c, m); n++; console.log("PASS", m); };
{ const raw = {}; const mkS = () => ({ getItem: k => (k in raw ? raw[k] : null), setItem: (k, v) => { raw[k] = String(v); }, removeItem: k => { delete raw[k]; }, key: i => Object.keys(raw)[i] ?? null, get length(){ return Object.keys(raw).length; } });
  raw["neon.cfg"] = "ORIGINAL"; raw["neon.bk"] = "PIN-ENCRYPTED-SECRET-OF-ORIGINAL-APP";
  const ctx = { localStorage: mkS(), sessionStorage: mkS() }; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(D, "ns.js"), "utf8"), ctx);
  const ls = vm.runInContext("localStorage", ctx);
  ok("ns.js active", vm.runInContext("window.MPRO_NS", ctx) === true);
  ok("MERMER PRO cannot read the original app's keys", ls.getItem("neon.cfg") === null && ls.getItem("neon.bk") === null);
  ls.setItem("neon.cfg", "PRO"); ok("writes go to mpro:… and leave the original untouched", raw["mpro:neon.cfg"] === "PRO" && raw["neon.cfg"] === "ORIGINAL");
  ls.clear(); ok("clear() only removes mpro: keys", raw["neon.bk"] && raw["neon.cfg"] === "ORIGINAL" && !("mpro:neon.cfg" in raw)); }
{ const src = ["pro/ui.js", "pro/core.js", "pro/ind.js"].map(f => fs.readFileSync(path.join(D, f), "utf8")).join("\n");
  ok("PRO code has no order endpoint, signature or API-key header", !/\/fapi\/v1\/order|\/api\/v3\/order|batchOrders|signature=|X-MBX-APIKEY|leverage\?|\/sapi\//i.test(src));
  ok("PRO code never touches MEME auto-buy / trade modules", !/MEME\.|AUTO\.|EXEC\.|TRADE\.|BOT\./.test(src)); }
{ const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(D, "pro/valid.js"), "utf8"), ctx); const V = ctx.window.MPV;
  const rule = h => h.n >= 30 && h.exp > 0 && h.ciLo > -0.05 && h.rand != null && h.exp > h.rand && h.randP < 0.10;
  ok("valid.js 'aktif' flags agree with the pre-registered rule applied to its own numbers", V.rows.every(r => r.pass === (rule(r.h1) && rule(r.h2))) && Object.entries(V.status).every(([k, s]) => s.active === V.rows.some(r => r.key === k && r.pass)));
  const ui = fs.readFileSync(path.join(D, "pro/ui.js"), "utf8"); ok("LONG/SHORT answer is only produced from strategies whose status is active", /const act = ev\.cands\.filter\(c => active\(c\.key\)\)/.test(ui) && /v: c\.dir > 0 \? "LONG" : "SHORT"/.test(ui) && (ui.match(/v: c\.dir > 0 \? "LONG"/g) || []).length === 1 && !/v: "LONG"|v: "SHORT"/.test(ui)); }
{ const html = fs.readFileSync(path.join(D, "index.html"), "utf8"); ok("ns.js is the first script in <head>", html.indexOf('src="ns.js') > 0 && html.indexOf('src="ns.js') < html.indexOf("<script src=", html.indexOf('src="ns.js') + 5) + 1 && html.indexOf('src="ns.js') < html.indexOf('src="appv.js'));
  ok("app named MERMER PRO", /<title>MERMER PRO/.test(html)); }
console.log("\nall passed (" + n + ")");
