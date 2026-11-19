const assert = require("assert"), fs = require("fs"), path = require("path"), V = require("../ver.js"), D = path.join(__dirname, "..");
assert.strictEqual(V.cmp("7.30.1", "7.30"), 1); assert.strictEqual(V.cmp("7.30", "7.30.0"), 0); assert.strictEqual(V.cmp("7.29.4", "7.30"), -1); assert.strictEqual(V.cmp("v7.31", "7.30.9"), 1);
const u = new URL(V.freshUrl("https://x.io/neon/?app=android#a", 123)); assert.strictEqual(u.searchParams.get("app"), "android"); assert.strictEqual(u.searchParams.get("r"), "123"); assert.strictEqual(u.hash, "");
const html = fs.readFileSync(path.join(D, "index.html"), "utf8"), ver = JSON.parse(fs.readFileSync(path.join(D, "version.json"), "utf8")).v;
{ const av = fs.readFileSync(path.join(D, "appv.js"), "utf8"); assert.ok(av.includes(`window.APP_V = "${ver}"`), "APP_V (appv.js) == version.json"); assert.ok(!/<script>/.test(html), "no inline script (v8.0 CSP)"); }
const refs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)[^"]*)"/g)].map(m => m[1]).filter(x => !/^(https?:|data:|\/\/)/.test(x));
assert.ok(refs.length > 40); for (const r of refs) assert.ok(r.endsWith("?v=" + ver), "versiyonsuz/eski: " + r);
assert.ok(html.indexOf("sections.js") < html.indexOf("ver.js") && html.indexOf("ver.js") < html.indexOf("theme.js"));
const src = fs.readFileSync(path.join(D, "ver.js"), "utf8"); assert.ok(/cache:\s*"no-store"/.test(src)); assert.ok(!/order|apiKey|secret/i.test(src));
console.log("ver.test OK", refs.length, "refs @", ver);
// v7.33.3 🔄 header refresh: next to the badge, same cache clear + ?r=, keeps hash (stays on tab), never touches localStorage
{ const u2 = new URL(V.freshUrl("https://x.io/neon/?app=android#short", 9, true)); assert.strictEqual(u2.hash, "#short"); assert.strictEqual(u2.searchParams.get("app"), "android"); assert.strictEqual(u2.searchParams.get("r"), "9");
  assert.strictEqual(new URL(V.freshUrl("https://x.io/?r=1#a", 2)).hash, ""); assert.strictEqual(new URL(V.freshUrl("https://x.io/?r=1", 2)).searchParams.getAll("r").join(), "2");
  assert.ok(/id="ver"[^>]*>[^<]*<\/small><button[^>]*id="ver-rf"/.test(html), "🔄 next to version badge");
  assert.ok(/getElementById\("ver-rf"\)/.test(src) && /caches\.delete/.test(src) && /hardReload\(true\)/.test(src));
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ""); assert.ok(!/localStorage|sessionStorage|indexedDB/.test(code), "refresh must not clear storage"); console.log("ver.test refresh OK"); }
