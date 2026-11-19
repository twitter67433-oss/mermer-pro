/* v8.0 delivery checks: SERT gap fill, strict CSP (no inline script / handlers), act.js delegation, version 8.0.0 */
const assert = require("assert"), fs = require("fs"), path = require("path"), vm = require("vm"), D = path.join(__dirname, "..");
const rd = f => fs.readFileSync(path.join(D, f), "utf8"); let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const FEE2 = 0.001;
// 1) SERT gap fill — SHORT
{ const X = require("../sert.js");
  let r = X.simExit(10, 10.2, 0.1, [{ o: 10.5, h: 10.6, l: 10.4, c: 10.5 }]);
  ok(r.why === "stop" && r.exit === 10.5 && r.gap === 1 && Math.abs(r.net - (-0.05 - FEE2)) < 1e-9, "SHORT: bar opens above stop → fill at open, not stop");
  r = X.simExit(10, 10.2, 0.1, [{ o: 10.1, h: 10.25, l: 10.0, c: 10.1 }]);
  ok(r.exit === 10.2 && !r.gap, "SHORT: bar opens below stop → fill at stop");
  r = X.simExit(10, 10.2, 0.1, [{ h: 10.6, l: 10.4, c: 10.5 }]);
  ok(r.exit === 10.2 && !r.gap, "old cache without o → stop (back-compat)");
  r = X.simExit(10, 10.2, 0.1, [{ o: 10, h: 10.05, l: 9.5, c: 9.6 }, { o: 9.9, h: 9.95, l: 9.85, c: 9.9 }]);
  ok(r.why === "iz" && Math.abs(r.exit - 9.9) < 1e-9 && r.gap === 1, "trailing stop gapped through → fill at open (9.9), not 9.6");
  // LONG mirror (simLong takes the SHORT stop, mirrors it)
  r = X.simLong(10, 10.2, 0.1, [{ o: 9.5, h: 9.6, l: 9.4, c: 9.5 }]);
  ok(r.why === "stop" && r.exit === 9.5 && r.gap === 1 && Math.abs(r.net - (-0.05 - FEE2)) < 1e-9, "LONG: opens below stop → fill at open");
  r = X.simLong(10, 10.2, 0.1, [{ o: 9.9, h: 9.95, l: 9.75, c: 9.9 }]);
  ok(r.exit === 9.8 && !r.gap, "LONG: normal stop fill");
  const s = rd("sert.js"); ok(/j\.gf = 1/.test(s) && /o: \+x\[1\]/.test(s), "resolve keeps 1m open + gap-fill migration flag"); }
// 2) strict CSP
{ const html = rd("index.html"), csp = (html.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1] || "";
  const sp = (csp.match(/script-src ([^;]+)/) || [])[1] || "";
  ok(sp.trim() === "'self'", "script-src 'self' only (no unsafe-inline / eval): " + sp);
  ok(/object-src 'none'/.test(csp) && /frame-src 'none'/.test(csp) && /base-uri 'self'/.test(csp), "object/frame/base locked");
  ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), "no inline <script> blocks");
  const files = fs.readdirSync(D).filter(f => f.endsWith(".js")).concat(["index.html"]);
  const H = /\son(click|change|input|load|error|submit|keydown|keyup|toggle|mouse\w+|focus|blur|touch\w+)\s*=\s*\\?["']/i;
  for (const f of files){ const t = rd(f); ok(!H.test(t), "inline handler in " + f); ok(!/\bnew Function\s*\(|[^.\w]eval\s*\(|javascript:/.test(t), "eval/Function/javascript: in " + f); }
  ok(html.indexOf("appv.js") < html.indexOf("act.js") && html.indexOf("act.js") < html.indexOf("ver.js"), "appv.js → act.js → ver.js order"); }
// 3) act.js delegation (fake DOM)
{ const L = {}, calls = [];
  const doc = { addEventListener: (t, f) => (L[t] = f) };
  const ctx = { document: doc, WALLET: { render: () => calls.push("w") }, CONN: { open: a => calls.push("c:" + a) }, NAV: { go: a => calls.push("n:" + a) }, MEME: { endPause: () => calls.push("m") }, PUMP: { badImg: el => calls.push("p") } };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(rd("act.js"), ctx);
  const el = (act, arg, tag = "BUTTON") => ({ tagName: tag, dataset: { act, arg } });
  const click = e => { let pd = 0; L.click({ target: { closest: () => e }, preventDefault: () => pd++ }); return pd; };
  click(el("wallet-render")); click(el("conn-open", "bn")); ok(click(el("nav", "meme", "A")) === 1, "link default prevented"); click(el("meme-endpause")); click(null); click(el("unknown"));
  ok(calls.join() === "w,c:bn,n:meme,m", "delegated actions: " + calls.join());
  let pd = 0; L.submit({ target: { hasAttribute: a => a === "data-nosubmit" }, preventDefault: () => pd++ }); ok(pd === 1, "data-nosubmit blocks submit");
  let rm = 0; L.error({ target: { tagName: "IMG", dataset: { onerr: "remove" }, remove: () => rm++ } }); L.error({ target: { tagName: "IMG", dataset: { onerr: "pumpbad" } } });
  ok(rm === 1 && calls.includes("p"), "img error handlers");
  ok(!/fetch|order|sign|send/i.test(rd("act.js").replace(/\/\*[\s\S]*?\*\//g, "")), "act.js never trades / fetches"); }
// 4) version
{ const v = JSON.parse(rd("version.json")).v; ok(v === "8.0.0", "version.json 8.0.0"); ok(rd("appv.js").includes(`"${v}"`), "appv.js matches");
  ok(rd("index.html").includes('class="ver">v8.0<'), "header badge v8.0"); }
// 5) Android Keystore layer in BKEYS (mock native plugin)
(async () => { const B = require("../bkeys.js"); const store = {}; let seen = [];
  const plug = { wrap: async o => { seen.push(o.data); const iv = "IV" + Object.keys(store).length; store[iv] = o.data; return { iv, ct: Buffer.from("KS:" + iv).toString("base64"), alias: "mermer_secret_wrap_v1" }; },
                 unwrap: async o => { if (!(o.iv in store)) throw new Error("no key"); return { data: store[o.iv] }; } };
  globalThis.Capacitor = { isNativePlatform: () => true, PluginHeaders: [{ name: "NeonKeystore" }], Plugins: { NeonKeystore: plug } };
  const out = await B.seal({ key: "K", secret: "SECRET-123" }, "pin123456", "test", 1000);
  ok(out.enc.ks && out.enc.ks.iv && !JSON.stringify(out).includes("SECRET-123"), "native: record wrapped by Keystore, no plaintext");
  ok(seen.length === 1 && !seen[0].includes("SECRET") && seen[0] !== "pin123456", "native side only sees PIN-ciphertext");
  ok(await B.dec(out.enc, "pin123456") === "SECRET-123", "native: unwrap + PIN → secret");
  await assert.rejects(B.dec(out.enc, "wrongpin1"), /PIN yanlış/); n++;
  globalThis.Capacitor = { isNativePlatform: () => true, PluginHeaders: [{ name: "KeepAwake" }], Plugins: {} };
  const old = await B.seal({ key: "K", secret: "S2" }, "pin123456", "", 1000); ok(!old.enc.ks && await B.dec(old.enc, "pin123456") === "S2", "old APK (no plugin) → PIN-only, still works");
  await assert.rejects(B.dec(out.enc, "pin123456"), /Android Keystore/); n++;
  delete globalThis.Capacitor; ok(B.ksPlugin() === null, "browser → no keystore");
  await assert.rejects(B.dec(out.enc, "pin123456"), /yalnızca bu cihazdaki/); n++;
  globalThis.Capacitor = { isNativePlatform: () => true, Plugins: { NeonKeystore: { wrap: async () => { throw new Error("hw"); } } } };
  const f = await B.seal({ key: "K", secret: "S3" }, "pin123456", "", 1000); ok(!f.enc.ks && await B.dec(f.enc, "pin123456") === "S3", "keystore failure → PIN-only fallback");
  delete globalThis.Capacitor;
  const J = fs.readFileSync(path.join(D, "android/NeonKeystorePlugin.java"), "utf8");
  ok(/AndroidKeyStore/.test(J) && /AES\/GCM\/NoPadding/.test(J) && /@CapacitorPlugin\(name = "NeonKeystore"\)/.test(J) && !/Log\./.test(J), "plugin source: AndroidKeyStore AES-GCM, no logging");
  console.log("v8.test OK", n, "checks"); })().catch(e => { console.error(e); process.exit(1); });
