/* v8.0.2 açılış koruması (appv.js): boot screen always removed, error bar, stale-version auto reload once, localStorage untouched */
const assert = require("assert"), fs = require("fs"), path = require("path"), vm = require("vm"), D = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(D, "appv.js"), "utf8"); let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
function env(o = {}){ const T = []; let now = 0; const els = {}, L = {}, ss = {}, replaced = [], removed = [];
  const mk = (id, tag) => ({ id, tagName: tag, className: "", style: {}, children: [], parentNode: null, setAttribute(){}, addEventListener(t, f){ this["on" + t] = f; }, appendChild(c){ c.parentNode = this; this.children.push(c); if (c.id) els[c.id] = c; }, removeChild(c){ removed.push(c.id); delete els[c.id]; c.parentNode = null; } });
  const body = mk("body", "BODY"); const boot = mk("boot", "DIV"); body.appendChild(boot);
  const document = { body, getElementById: id => els[id] || null, createElement: t => mk("", t.toUpperCase()) };
  const ctx = { document, location: { href: "https://x.io/app/?app=android#short", host: "x.io", protocol: "https:", replace: u => replaced.push(u) },
    setTimeout: (f, ms) => T.push([now + ms, f]), Date: { now: () => now }, sessionStorage: { getItem: k => ss[k] || null, setItem: (k, v) => { ss[k] = v; } },
    localStorage: { getItem(){ throw new Error("must not read localStorage"); }, setItem(){ throw new Error("must not write localStorage"); } },
    navigator: { serviceWorker: { getRegistrations: async () => [{ unregister: async () => { ctx.unreg = (ctx.unreg || 0) + 1; return true; } }] } },
    caches: { keys: async () => ["a", "b"], delete: async k => { ctx.cdel = (ctx.cdel || 0) + 1; return true; } },
    fetch: o.fetch || (async () => ({ ok: true, json: async () => ({ v: o.v || "8.0.2" }) })), Promise, String, parseInt, Math, console };
  ctx.window = ctx; ctx.addEventListener = (t, f) => { L[t] = f; };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  const tick = async ms => { const end = now + ms; for (;;){ T.sort((a, b) => a[0] - b[0]); if (!T.length || T[0][0] > end) break; const [t, f] = T.shift(); now = Math.max(now, t); f(); } now = end; for (let k = 0; k < 5; k++) await new Promise(r => setImmediate(r)); };
  return { ctx, els, L, ss, replaced, removed, tick }; }
(async () => {
  { const e = env(); await e.tick(0); ok(e.els.boot, "boot still there at 0 s"); await e.tick(3900); ok(e.els.boot, "boot at 3.9 s"); await e.tick(600); ok(!e.els.boot, "boot removed by 4.5 s even if nothing else runs");
    ok(e.replaced.length === 0, "same version → no reload"); ok(!e.els["boot-err"], "no error → no bar"); }
  { const e = env(); e.L.error({ target: { tagName: "SCRIPT", src: "https://x.io/app/sert.js?v=8.0.2" } }); await e.tick(10); ok(e.els["boot-err"], "failed script → YENİLE bar"); ok(!e.els.boot || / fade/.test(e.els.boot.className), "bar also drops the boot screen");
    const bar = e.els["boot-err"], btn = bar.children[1]; ok(btn.textContent === "YENİLE", "button text"); btn.onclick(); await e.tick(10);
    ok(e.ctx.cdel === 2 && e.ctx.unreg === 1 && e.replaced.length === 1 && /[?&]r=\d+/.test(e.replaced[0]) && /app=android/.test(e.replaced[0]) && !/#/.test(e.replaced[0]), "YENİLE: cache + service worker cleared, reload with ?r= (keeps ?app=android)"); }
  { const e = env(); e.L.error({ target: { tagName: "SCRIPT", src: "https://cdn.other.com/x.js" } }); await e.tick(10); ok(!e.els["boot-err"], "foreign script failure ignored"); }
  { const e = env(); e.L.error({ target: e.ctx, filename: "https://x.io/app/meme.js", message: "x" }); await e.tick(10); ok(e.els["boot-err"], "startup JS error → bar"); }
  { const e = env(); await e.tick(25000); e.L.error({ target: e.ctx, filename: "https://x.io/app/meme.js", message: "x" }); await e.tick(10); ok(!e.els["boot-err"], "later runtime error → no bar (no noise)"); }
  { const e = env({ v: "9.9.9" }); await e.tick(10); await e.tick(10); ok(e.replaced.length === 1 && e.ss["mermer.autoref"] === "9.9.9", "newer version.json → one automatic hard reload");
    const e2 = env({ v: "9.9.9" }); e2.ss["mermer.autoref"] = "9.9.9"; await e2.tick(10); ok(e2.replaced.length === 0, "already tried this version → no loop"); }
  { const e = env({ v: "8.0.1" }); await e.tick(10); ok(e.replaced.length === 0, "older version.json (CDN lag) → no reload"); }
  { const e = env({ fetch: async () => { throw new Error("offline"); } }); await e.tick(5000); ok(e.replaced.length === 0 && !e.els.boot, "offline: no reload, boot still removed"); }
  { const e = env({ fetch: () => new Promise(() => {}) }); await e.tick(5000); ok(!e.els.boot, "hanging version.json never blocks"); }
  // source contracts
  ok(!/=>|`|\blet\b|\bconst\b|\?\?|\?\./.test(src.replace(/\/\*[\s\S]*?\*\//g, "")), "appv.js is plain ES5 (old WebView)");
  const html = fs.readFileSync(path.join(D, "index.html"), "utf8"); ok(html.indexOf("appv.js") < html.indexOf("<body"), "appv.js runs first, in <head>");
  const app = fs.readFileSync(path.join(D, "app.js"), "utf8"); ok(/try \{ await boot\(\); \} catch/.test(app) && !/v7\.18/.test(app), "app.js boot wrapped, no stale version text");
  const spl = fs.readFileSync(path.join(D, "splash.js"), "utf8"); ok(/setTimeout\(close, 4000\)/.test(spl) && /x\.onclick = close/.test(spl), "splash dialog closes itself after 4 s; ✕ closes");
  console.log("boot.test OK", n, "checks"); })().catch(e => { console.error(e); process.exit(1); });
