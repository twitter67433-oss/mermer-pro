/* v7.30 per-section AKTİF / PASİF — core with a fake timer / socket environment */
const X = require("../sections.js"); let f = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) f++; };
function env(){ let t = 0, id = 0; const Q = new Map(), store = {}; let who = null;
  class WS { constructor(u){ this.url = u; this.readyState = 0; this.L = {}; E.sockets.push(this); } addEventListener(k, h){ (this.L[k] = this.L[k] || []).push(h); }
    close(){ if (this.readyState >= 2) return; this.readyState = 3; (this.L.close || []).forEach(h => h({})); if (this.onclose) this.onclose({}); } open(){ this.readyState = 1; (this.L.open || []).forEach(h => h({})); } send(){} }
  WS.CONNECTING = 0; WS.OPEN = 1; WS.CLOSING = 2; WS.CLOSED = 3;
  const E = { sockets: [], store, set who(v){ who = v; },
    env: { now: () => t, owner: () => who, WS, raf: cb => { const i = ++id; Q.set(i, { at: t, fn: cb, raf: 1 }); return i; }, caf: i => Q.delete(i),
      setTimeout: (fn, ms) => { const i = ++id; Q.set(i, { at: t + ms, fn }); return i; }, clearTimeout: i => Q.delete(i),
      setInterval: (fn, ms) => { const i = ++id; Q.set(i, { at: t + ms, fn, ms }); return i; }, clearInterval: i => Q.delete(i),
      load: () => store.s || {}, save: o => { store.s = o; } },
    real: () => Q.size, adv(ms){ const end = t + ms; for (;;){ let nx = null; for (const [i, q] of Q) if (q.at <= end && (!nx || q.at < Q.get(nx).at)) nx = i; if (!nx) break; const q = Q.get(nx); t = q.at; if (q.ms) q.at += q.ms; else Q.delete(nx); q.fn(); } t = end; } };
  return E; }
const E = env(), M = X.create(E.env);
let a = 0, b = 0, c = 0; E.who = "short"; M.setInterval(() => a++, 1000); M.setTimeout(() => b++, 5000); const ws = M.makeWS("wss://x"); E.who = "meme"; M.setInterval(() => c++, 1000); E.who = null;
E.adv(2000); ok(a === 2 && c === 2 && E.real() === 3, "both sections run (3 real timers)");
let s = M.stats("short"); ok(s.intervals === 1 && s.timeouts === 1 && s.sockets === 1, "stats short before: 1 interval, 1 timeout, 1 socket");
M.set("short", false); s = M.stats("short");
ok(s.intervals === 0 && s.timeouts === 0 && s.sockets === 0 && s.held === 2 && ws.readyState === 3, "PASİF: short timers cleared + socket closed");
ok(E.real() === 1, "only MEME's interval still armed");
E.adv(10000); ok(a === 2 && b === 0 && c === 12, "PASİF short does nothing for 10 s, MEME keeps running");
E.who = "short"; let d = 0; M.setTimeout(() => d++, 100); const w2 = M.makeWS("wss://y"); let opened = 0; w2.onopen = () => opened++; E.who = null;
ok(E.real() === 1 && w2.readyState === 0 && E.sockets.length === 1, "new timers / sockets of a PASİF section are held, nothing real created");
ok(E.store.s && E.store.s.short === false, "state persisted");
M.set("short", true); ok(E.sockets.length === 2 && w2.__real && M.stats("short").intervals === 1, "AKTİF: held socket opens for real, interval re-armed");
E.sockets[1].open(); ok(opened === 1 && w2.readyState === 1, "held socket forwards open + readyState");
E.adv(3000); ok(b === 1 && d === 1 && a === 5, "AKTİF: pending timeout fires with its remaining delay, interval resumes");
// SİNYAL / ANALİZ share the engine
E.who = "sig"; let g = 0; M.setInterval(() => g++, 1000); E.who = null;
M.set("scalp", false); E.adv(2000); ok(g === 2, "engine keeps running while ANALİZ is AKTİF");
M.set("analiz", false); E.adv(2000); ok(g === 2 && M.stats("sig").held === 1, "engine stops when SİNYAL and ANALİZ are both PASİF");
M.set("analiz", true); E.adv(1000); ok(g === 3, "engine resumes");
// clearInterval while held
M.set("meme", false); const before = M.stats("meme").held; M.T.forEach((r, id) => { if (r.sec === "meme") M.clearInterval(id); }); ok(before === 1 && M.stats("meme").held === 0, "clearInterval works on held timers");
// a reloaded app starts with the saved state (default AKTİF)
const E2 = env(); E2.store.s = { fut: false }; const M2 = X.create(E2.env); ok(M2.paused("fut") && !M2.paused("meme") && !M2.paused("short"), "load: saved PASİF kept, others default AKTİF");
// owner attribution
ok(X.ownerOf("Error\n at a (https://h/sections.js?v=7.30:1:1)\n at b (https://h/vendor/lightweight-charts.standalone.production.js:1:1)\n at c (https://h/coinan.js?v=7.28:9:9)") === "fut", "owner: vendor skipped → coinan = VADELİ");
ok(X.ownerOf("at a (https://h/bus.js?v=7.18:1:1)\n at b (https://h/sinyal.js:2:2)") === null, "owner: unmapped app file (bus.js) is not paused");
ok(X.ownerOf("at a (https://h/pump.js:1:1)") === "meme" && X.ownerOf("at a (https://h/badge.js:1:1)") === "badge" && X.ownerOf("at a (https://h/watch.js:1:1)") === "scalp", "owner: pump → MEME, badge → ROZET, watch → SİNYAL");
{ const src = require("fs").readFileSync(__dirname + "/../sections.js", "utf8"); ok(!/visibilitychange|appStateChange|fapi\/v1\/order|X-MBX-APIKEY/.test(src), "no background auto-pause, no orders/keys"); }
console.log(f ? f + " FAIL" : "ALL PASS"); process.exit(f ? 1 : 0);
