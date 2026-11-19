/* MERMER TERMİNAL v7.30 — per-section AKTİF / PASİF.
   Loaded first. Every timer (setTimeout / setInterval / requestAnimationFrame) and WebSocket is attributed to the app file that created it
   (top-most app frame of the call stack). PASİF for a section: its intervals and pending timeouts are cleared (remembered), its sockets are closed,
   new timers are held and new sockets are not opened. AKTİF again: held timers are re-armed (timeouts with their remaining delay), held sockets open
   for real, so each module's own reconnect / loop logic resumes. Nothing is paused automatically when the app goes to background.
   SİNYAL and ANALİZ share one engine (sinyal.js): it stops only when both are PASİF. No orders, no keys — this only stops/starts data work. */
"use strict";
(function (root, factory){ const M = factory(); if (typeof module === "object" && module.exports) module.exports = M; else root.SECX = M; })(typeof self !== "undefined" ? self : this, function (){
const FILES = { "meme.js": "meme", "copy.js": "meme", "exec.js": "meme", "pump.js": "meme",
  "coinan.js": "fut", "market.js": "fut", "psim.js": "fut", "app.js": "fut", "chart.js": "fut",
  "watch.js": "scalp", "sinyal.js": "sig", "analiz.js": "analiz", "sert.js": "short", "badge.js": "badge", "agg.js": "agg" };
const SECS = ["meme", "fut", "scalp", "analiz", "short", "badge", "agg"];
const LABEL = { meme: "MEME", fut: "VADELİ", scalp: "SİNYAL", analiz: "ANALİZ", short: "SHORT/LONG tarayıcı", badge: "ROZET", agg: "TOPLAMA / DAĞITIM" };
/* which section owns a call: first app .js frame in the stack (vendor and this file are skipped; an unmapped app file → nobody) */
function ownerOf(stack){ for (const ln of String(stack || "").split("\n")){ if (ln.indexOf("/vendor/") >= 0) continue; const m = /\/([A-Za-z0-9_.-]+\.js)(?:\?[^:\s)]*)?:\d+/.exec(ln); if (!m) continue;
    if (m[1] === "sections.js") continue; return FILES[m[1]] || null; } return null; }
function create(env){
  const on = Object.assign(Object.fromEntries(SECS.map(s => [s, true])), env.load ? env.load() : {});
  const paused = s => !s ? false : s === "sig" ? !on.scalp && !on.analiz : on[s] === false;
  const T = new Map(), SOCK = new Set(), FAKE = new Set(), RAF = new Map(); let n = 0;
  const owner = () => env.owner ? env.owner() : null;
  function arm(id, r){ if (r.kind === "t"){ r.due = env.now() + r.left; r.real = env.setTimeout(() => { T.delete(id); r.fn.apply(null, r.args); }, r.left); }
    else r.real = env.setInterval(() => r.fn.apply(null, r.args), r.ms); r.held = false; }
  function setT(kind, fn, ms, args){ if (typeof fn !== "function") return (kind === "t" ? env.setTimeout : env.setInterval)(fn, ms);
    const id = ++n, r = { kind, fn, ms: +ms || 0, left: +ms || 0, args, sec: owner(), held: false }; T.set(id, r);
    if (paused(r.sec)) r.held = true; else arm(id, r); return id; }
  function clr(id){ const r = T.get(id); if (!r) return; if (!r.held) (r.kind === "t" ? env.clearTimeout : env.clearInterval)(r.real); T.delete(id); }
  function raf(cb){ const sec = owner(); if (paused(sec)){ const id = -(++n); RAF.set(id, { cb, sec }); return id; } return env.raf(cb); }
  function caf(id){ if (RAF.has(id)) RAF.delete(id); else env.caf(id); }
  function track(w, sec){ w.__sec = sec; SOCK.add(w); try { w.addEventListener("close", () => SOCK.delete(w)); } catch(e){} return w; }
  function makeWS(url, prot){ const sec = owner(); if (!paused(sec)) return track(prot === undefined ? new env.WS(url) : new env.WS(url, prot), sec);
    /* held socket: looks like a CONNECTING WebSocket until the section is AKTİF again */
    const L = { open: [], message: [], close: [], error: [] }, f = { url, protocol: "", extensions: "", bufferedAmount: 0, binaryType: "blob", onopen: null, onmessage: null, onclose: null, onerror: null, __sec: sec, __st: 0, __real: null, __prot: prot,
      addEventListener(t, h){ (L[t] = L[t] || []).push(h); }, removeEventListener(t, h){ L[t] = (L[t] || []).filter(x => x !== h); },
      send(d){ if (f.__real) f.__real.send(d); }, close(c, r){ if (f.__real) f.__real.close(c, r); else if (f.__st < 3){ f.__st = 3; FAKE.delete(f); } },
      __emit(t, e){ const h = f["on" + t]; if (h) try { h.call(f, e); } catch(x){ setTimeout(() => { throw x; }); } for (const g of (L[t] || []).slice()) try { g.call(f, e); } catch(x){} } };
    Object.defineProperty(f, "readyState", { get: () => f.__real ? f.__real.readyState : f.__st });
    for (const k of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) f[k] = env.WS[k]; FAKE.add(f); return f; }
  function pause(sec){ for (const [id, r] of T) if (r.sec === sec && !r.held){ (r.kind === "t" ? env.clearTimeout : env.clearInterval)(r.real); if (r.kind === "t") r.left = Math.max(0, r.due - env.now()); r.held = true; }
    for (const w of [...SOCK]) if (w.__sec === sec && w.readyState < 2) try { w.close(4000, "PASİF"); } catch(e){} }
  function resume(sec){ for (const [id, r] of T) if (r.sec === sec && r.held) arm(id, r);
    for (const [id, x] of [...RAF]) if (x.sec === sec){ RAF.delete(id); env.raf(x.cb); }
    for (const f of [...FAKE]) if (f.__sec === sec){ FAKE.delete(f); const w = track(f.__prot === undefined ? new env.WS(f.url) : new env.WS(f.url, f.__prot), sec); w.binaryType = f.binaryType; f.__real = w;
      for (const t of ["open", "message", "close", "error"]) w.addEventListener(t, e => f.__emit(t, e)); } }
  function apply(){ for (const s of [...SECS, "sig"]) paused(s) ? pause(s) : resume(s); }
  function set(sec, v){ if (!SECS.includes(sec)) return; on[sec] = !!v; if (env.save) env.save(Object.assign({}, on)); apply(); }
  function stats(sec){ let iv = 0, to = 0, held = 0; for (const r of T.values()) if (r.sec === sec){ if (r.held) held++; else if (r.kind === "i") iv++; else to++; }
    let ws = 0; for (const w of SOCK) if (w.__sec === sec && w.readyState < 2) ws++; let hw = 0; for (const f of FAKE) if (f.__sec === sec) hw++;
    for (const x of RAF.values()) if (x.sec === sec) held++; return { intervals: iv, timeouts: to, sockets: ws, held, heldSockets: hw }; }
  return { on, paused, set, apply, stats, setTimeout: (fn, ms, ...a) => setT("t", fn, ms, a), setInterval: (fn, ms, ...a) => setT("i", fn, ms, a), clearTimeout: clr, clearInterval: clr, raf, caf, makeWS, T, SOCK, FAKE }; }
return { FILES, SECS, LABEL, ownerOf, create };
});

/* ---- browser install: patch globals before any other script runs ---- */
if (typeof window !== "undefined" && typeof document !== "undefined" && !window.SEC) window.SEC = (() => {
const X = window.SECX, K = "mermer.sec", W = window, RealWS = W.WebSocket;
const env = { setTimeout: W.setTimeout.bind(W), clearTimeout: W.clearTimeout.bind(W), setInterval: W.setInterval.bind(W), clearInterval: W.clearInterval.bind(W),
  raf: W.requestAnimationFrame.bind(W), caf: W.cancelAnimationFrame.bind(W), WS: RealWS, now: () => Date.now(), owner: () => X.ownerOf(new Error().stack),
  load: () => { try { return JSON.parse(localStorage.getItem(K) || "{}") || {}; } catch(e){ return {}; } }, save: o => { try { localStorage.setItem(K, JSON.stringify(o)); } catch(e){} } };
const M = X.create(env);
W.setTimeout = M.setTimeout; W.setInterval = M.setInterval; W.clearTimeout = M.clearTimeout; W.clearInterval = M.clearInterval; W.requestAnimationFrame = M.raf; W.cancelAnimationFrame = M.caf;
function PWS(url, prot){ return M.makeWS(url, prot); } PWS.prototype = RealWS.prototype; for (const k of ["CONNECTING", "OPEN", "CLOSING", "CLOSED"]) PWS[k] = RealWS[k]; W.WebSocket = PWS;
/* ---- UI: one small toggle per section header, PASİF marker on the nav tab ---- */
const HOST = { meme: "#meme h3", fut: "#coinan h3", scalp: "#scalp h3", analiz: "#analiz h3", badge: "#scalp h3", agg: "#agg h3" }; /* v7.32: SHORT/LONG scanner has per-list toggles (sert.js) */
const NAVP = { meme: "meme", fut: "fut" }, PANEL = { meme: ["#meme", "#pump"], fut: ["#coinan", "#psim"], scalp: ["#scalp"], analiz: ["#analiz"], short: ["#short", "#long"], agg: ["#agg"] };
function realGuard(){ try { const m = W.MEME; if (!m || m.mode !== "GERÇEK") return 0; const g = m.realOpen ? m.realOpen() : 0; return g; } catch(e){ return 0; } }
function paint(){ for (const s of X.SECS){ const on = M.on[s] !== false;
    document.querySelectorAll(`[data-sec="${s}"]`).forEach(b => { b.textContent = (s === "badge" ? "ROZET " : "") + (on ? "AKTİF" : "PASİF"); b.classList.toggle("off", !on); b.setAttribute("aria-pressed", on); b.title = `${X.LABEL[s]}: ${on ? "akışlar açık — dokun: PASİF (websocket, zamanlayıcı, tarama durur)" : "PASİF — dokun: AKTİF"}`; });
    if (NAVP[s]){ const nb = document.querySelector(`#nav button[data-go="${NAVP[s]}"]`); if (nb) nb.classList.toggle("sec-off", !on); }
    for (const q of PANEL[s] || []){ const p = document.querySelector(q); if (p) p.classList.toggle("sec-off", !on); } } }
async function toggle(s){ const on = M.on[s] !== false;
  if (on && s === "meme"){ const n = realGuard(); if (n && !confirm(`MEME GERÇEK modda ${n} açık pozisyon var.\nPASİF yaparsan otomatik satış (stop / kâr al / iz süren stop) ve canlı fiyat DURUR — pozisyonlar korumasız kalır.\nGERÇEK limitler değişmez. Yine de PASİF yapılsın mı?`)) return; }
  M.set(s, !on); paint(); W.dispatchEvent(new CustomEvent("sec:change", { detail: { sec: s, on: !on } }));
  try { W.NOTIFY && NOTIFY.toast(`${X.LABEL[s]} ${!on ? "AKTİF — akışlar yeniden başladı" : "PASİF — akışlar durdu"}`, !on ? "good" : "info"); } catch(e){} }
function ui(){ for (const s of X.SECS){ const h = document.querySelector(HOST[s]); if (!h || h.querySelector(`[data-sec="${s}"]`)) continue; const b = document.createElement("button"); b.type = "button"; b.className = "sec-tg"; b.dataset.sec = s;
    b.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); toggle(s); }); h.appendChild(b); } paint();
  if (M.on.meme === false) setTimeout(() => { const n = realGuard(); if (n) try { NOTIFY.toast(`⚠ MEME PASİF · GERÇEK ${n} açık pozisyon — otomatik satış çalışmıyor`, "bad"); } catch(e){} }, 4000); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ui); else ui();
return { on: s => M.on[s] !== false, set: (s, v) => { M.set(s, v); paint(); W.dispatchEvent(new CustomEvent("sec:change", { detail: { sec: s, on: !!v } })); }, toggle, stats: M.stats, paused: M.paused, _M: M };
})();
