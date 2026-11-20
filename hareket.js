/* MERMER TERMİNAL v8.0.1 — HAREKET: sharp-move alert for USDT CRYPTO perpetuals only (stocks / gold / commodities excluded).
   Fires when a coin moves ≥ h1 in 1 hour, ≥ h24 in 24 hours, or on a 15m bar with |move| ≥ m15 AND volume ≥ vr15 × its 24 h average.
   One alert per coin per window and direction (1s: 60 min, 24s: 12 h, 15dk: per bar) — no spam. Shows ↑ POMPA / ↓ DÜŞÜŞ and a squeeze-risk line.
   SIGNAL ONLY: no orders, no keys, no wallet, never triggers auto-buy (tests/hareket.test.js checks the source). Data: Binance public !miniTicker@arr
   (all symbols, 24 h open/close every second), the SHORT/LONG scanner's 15m bars, and /fapi/v1/premiumIndex (funding) for the risk line. */
(function (root, f){ const M = f(); if (typeof module === "object" && module.exports) module.exports = M; else root.HAREKETX = M; })(typeof self !== "undefined" ? self : this, function (){
"use strict";
const DEF = { on: true, ntf: true, h1: 0.08, h24: 0.15, m15: 0.04, vr15: 3 };
const CD = { "1s": 3600000, "24s": 12*3600000 };
const fin = x => typeof x === "number" && isFinite(x);
function cfgOf(o){ const c = Object.assign({}, DEF, o || {}); for (const k of ["h1", "h24", "m15", "vr15"]) if (!fin(+c[k]) || +c[k] <= 0) c[k] = DEF[k]; else c[k] = +c[k]; c.on = c.on !== false; c.ntf = c.ntf !== false; return c; }
function state(){ return { px: new Map(), sent: new Map(), ev: [] }; }
/* minute price samples per coin, kept 75 min */
function feed(S, sym, t, p){ if (!(p > 0) || !fin(t)) return; let a = S.px.get(sym); if (!a){ a = []; S.px.set(sym, a); }
  const last = a[a.length - 1]; if (last && t - last[0] < 50000){ last[1] = p; return; } a.push([t, p]); while (a.length && a[0][0] < t - 75*60000) a.shift(); }
/* seed 1h history from closed 15m bars (close at t + 15 min) so the 1h change works right after the app opens */
function seed(S, sym, bars){ const b = (bars || []).slice(-6); let a = S.px.get(sym) || []; const have = new Set(a.map(x => x[0]));
  for (const x of b){ const t = x.t + 900000; if (!have.has(t)) a.push([t, x.c]); } a.sort((p, q) => p[0] - q[0]); S.px.set(sym, a); }
/* change over the last hour: needs a sample 55–75 min old */
function ch1h(S, sym, t){ const a = S.px.get(sym); if (!a || a.length < 2) return NaN; const now = a[a.length - 1]; let ref = null;
  for (const x of a){ if (t - x[0] >= 55*60000 && t - x[0] <= 75*60000){ ref = x; } } return ref && ref[1] > 0 ? now[1]/ref[1] - 1 : NaN; }
function okSend(S, key, t, cd){ const l = S.sent.get(key); if (l && (cd === 0 || t - l < cd)) return false; S.sent.set(key, t); return true; }
/* ticker check: ch24 = 24 h change (fraction). Returns new events */
function check(S, sym, t, ch24, c){ c = cfgOf(c); const out = [], h = ch1h(S, sym, t);
  if (fin(h) && Math.abs(h) >= c.h1){ const d = h > 0 ? 1 : -1; if (okSend(S, `${sym}|1s|${d}`, t, CD["1s"])) out.push({ sym, w: "1s", ch: h, dir: d, t }); }
  if (fin(ch24) && Math.abs(ch24) >= c.h24){ const d = ch24 > 0 ? 1 : -1; if (okSend(S, `${sym}|24s|${d}`, t, CD["24s"])) out.push({ sym, w: "24s", ch: ch24, dir: d, t }); }
  return out; }
/* closed 15m bar from the scanner: f = SERTX.feat(b) (r15 = bar move, vr = volume / 24 h avg) */
function check15(S, sym, f, c){ c = cfgOf(c); if (!f || !f.x) return []; const r = f.r15, v = f.vr;
  if (!(fin(r) && Math.abs(r) >= c.m15 && fin(v) && v >= c.vr15)) return []; const d = r > 0 ? 1 : -1;
  return okSend(S, `${sym}|15dk|${f.x.t}`, f.x.t + 900000, 0) ? [{ sym, w: "15dk", ch: r, dir: d, vr: v, t: f.x.t + 900000 }] : []; }
/* risk line: pump + squeeze module ON → short squeeze; pump with negative funding → shorts paying, squeeze fuel; dump with high funding → long liquidations */
function risk(dir, fr, sq){ if (dir > 0 && sq && sq.on) return "⚠ SQUEEZE RİSKİ (short sıkışması) — SHORT açma";
  if (dir > 0 && fin(fr) && fr < 0) return "⚠ squeeze riski: funding negatif, shortlar ödüyor — SHORT riskli";
  if (dir < 0 && fin(fr) && fr >= 0.0005) return "⚠ long tasfiye riski: funding yüksek — düşüş sürebilir";
  return fin(fr) ? `funding ${(fr*100).toFixed(3)}% · squeeze işareti yok` : "squeeze bilgisi yok"; }
const crypto = (s, kind) => !!s && s.contractType === "PERPETUAL" && s.status === "TRADING" && (s.quoteAsset ? s.quoteAsset === "USDT" : /USDT$/.test(s.symbol)) && !kind;
return { DEF, CD, cfgOf, state, feed, seed, ch1h, check, check15, risk, crypto };
});

if (typeof window !== "undefined" && typeof document !== "undefined") window.HAREKET = (() => {
const H = window.HAREKETX, S = H.state(), SK = "mermer.hareket.sent";
/* sent keys survive a reload / app reopen → no repeat burst of the same alerts */
try { const o = JSON.parse(localStorage.getItem(SK) || "{}"); for (const k in o) if (Date.now() - o[k] < 12*3600000) S.sent.set(k, o[k]); } catch(e){}
const saveSent = () => { try { const o = {}; for (const [k, t] of S.sent) if (Date.now() - t < 12*3600000) o[k] = t; localStorage.setItem(SK, JSON.stringify(o)); } catch(e){} };
const CK = "mermer.hareket", F = "https://fapi.binance.com", MAX = 40;
let C = (() => { try { return H.cfgOf(JSON.parse(localStorage.getItem(CK) || "{}")); } catch(e){ return H.cfgOf(); } })();
const save = () => { try { localStorage.setItem(CK, JSON.stringify(C)); } catch(e){} };
let CRY = new Set(), ws = null, wsT = 0, eiAt = 0, paintT = 0; const FR = new Map();
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tm = t => new Date(t).toLocaleTimeString("tr-TR", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
const pc = x => (x >= 0 ? "+" : "−") + Math.abs(x*100).toFixed(1) + "%";
async function loadUni(){ if (Date.now() - eiAt < 6*3600000 && CRY.size) return; try { const r = await fetch(F + "/fapi/v1/exchangeInfo"); const ei = await r.json(); const K = window.SERTX;
    CRY = new Set(ei.symbols.filter(s => H.crypto(s, K ? K.kind(s) : "")).map(s => s.symbol)); eiAt = Date.now(); } catch(e){} }
async function funding(sym){ const c = FR.get(sym); if (c && Date.now() - c.at < 300000) return c.fr;
  try { const r = await fetch(`${F}/fapi/v1/premiumIndex?symbol=${sym}`); const j = await r.json(); const fr = +j.lastFundingRate; FR.set(sym, { fr, at: Date.now() }); return fr; } catch(e){ return NaN; } }
/* events are listed + notified at once; the risk line (funding / squeeze) is filled in afterwards, in parallel */
async function enrich(e){ e.fr = await funding(e.sym); if (e.dir > 0 && window.SQZ){ try { SQZ.get(e.sym); } catch(x){} for (let k = 0; k < 12 && !SQZ.peek(e.sym); k++) await new Promise(r => setTimeout(r, 250)); e.sq = SQZ.peek(e.sym); }
  e.risk = H.risk(e.dir, e.fr, e.sq); }
function emit(E){ if (!E.length) return; for (const e of E){ e.risk = "risk kontrol ediliyor…"; S.ev.unshift(e); } S.ev = S.ev.slice(0, MAX); saveSent(); paint();
  Promise.all(E.slice(0, 12).map(e => enrich(e).catch(() => {}))).then(paint);
  if (!C.ntf) return; const up = E.filter(e => e.dir > 0), dn = E.filter(e => e.dir < 0);
  for (const [A, w] of [[up, "↑ POMPA"], [dn, "↓ DÜŞÜŞ"]]){ if (!A.length) continue; const cs = A.map(e => `${e.sym.replace("USDT", "")} ${pc(e.ch)} (${e.w})`);
    try { window.NOTIFY && NOTIFY.toast(`HAREKET ${w} · ${cs.slice(0, 3).join(", ")}${cs.length > 3 ? ` +${cs.length - 3}` : ""}`, A[0].dir > 0 ? "good" : "bad"); } catch(x){}
    try { window.SCALP && SCALP.extAlert && SCALP.extAlert(`HAREKET ${w} · ${A.length === 1 ? A[0].sym.replace("USDT", "") : A.length + " coin"}`, cs.slice(0, 8).join(", ") + (cs.length > 8 ? ` +${cs.length - 8}` : "") + " · kripto · sinyal, emir değil", "neon-hareket"); } catch(x){} } }
function onTick(a){ if (!C.on) return; const t = Date.now(), E = []; for (const m of a){ if (!m || !CRY.has(m.s)) continue; const c = +m.c, o = +m.o; H.feed(S, m.s, t, c); E.push(...H.check(S, m.s, t, o > 0 ? c/o - 1 : NaN, C)); } if (E.length) emit(E); }
function open(){ if (!C.on || (ws && ws.readyState < 2)) return; try { ws = new WebSocket("wss://fstream.binance.com/market/ws/!miniTicker@arr");
    ws.onmessage = ev => { try { const d = JSON.parse(ev.data); onTick(Array.isArray(d) ? d : [d]); } catch(e){} };
    ws.onclose = () => { clearTimeout(wsT); if (C.on) wsT = setTimeout(open, 15000); }; } catch(e){} }
function close(){ clearTimeout(wsT); try { ws && ws.close(); } catch(e){} ws = null; }
/* called by the SHORT/LONG scanner for every closed 15m bar set */
function bars(sym, b, f){ if (!C.on || !CRY.has(sym)) return; H.seed(S, sym, b); const E = H.check15(S, sym, f, C); if (E.length) emit(E); }
function row(e){ return `<div class="mv-r ${e.dir > 0 ? "up" : "dn"}"><b>${e.dir > 0 ? "↑" : "↓"} ${esc(e.sym.replace("USDT", ""))}</b> <span>${pc(e.ch)} · ${e.w === "15dk" ? `15dk mum · hacim ${e.vr.toFixed(1)}×` : e.w === "1s" ? "1 saatte" : "24 saatte"} · ${tm(e.t)}</span><small class="${/⚠/.test(e.risk) ? "y" : "dim"}">${esc(e.risk)}</small></div>`; }
function paint(){ clearTimeout(paintT); paintT = setTimeout(() => { for (const [tab, d] of [["long", 1], ["short", -1]]){ const el = document.getElementById("mv-" + tab); if (!el) continue;
    const L = S.ev.filter(e => e.dir === d).slice(0, 8);
    el.innerHTML = `<details class="mv-d"${L.length ? " open" : ""}><summary><b class="${d > 0 ? "up" : "dn"}">HAREKET ${d > 0 ? "↑ POMPA" : "↓ DÜŞÜŞ"}</b> <small class="dim">yalnız kripto · ${C.on ? `${L.length} uyarı` : "KAPALI"} · sinyal, emir yok</small></summary>`
      + (L.length ? L.map(row).join("") : `<div class="dim hx-none">${C.on ? `şu an yok — eşik: 1s ±%${(C.h1*100).toFixed(0)} · 24s ±%${(C.h24*100).toFixed(0)} · 15dk ±%${(C.m15*100).toFixed(0)} + hacim ≥${C.vr15}×` : "HAREKET kapalı"}</div>`)
      + `<div class="mv-cfg"><label>1s %<input type="number" min="1" max="100" step="1" data-mvk="h1" value="${(C.h1*100).toFixed(0)}"></label><label>24s %<input type="number" min="1" max="500" step="1" data-mvk="h24" value="${(C.h24*100).toFixed(0)}"></label><label>15dk %<input type="number" min="1" max="50" step="0.5" data-mvk="m15" value="${C.m15*100}"></label><label>hacim ×<input type="number" min="1" max="50" step="0.5" data-mvk="vr15" value="${C.vr15}"></label>`
      + `<button type="button" class="mini${C.ntf ? " on" : ""}" data-mvt="ntf">🔔 ${C.ntf ? "AÇIK" : "KAPALI"}</button><button type="button" class="mini${C.on ? " on" : ""}" data-mvt="on">${C.on ? "AKTİF" : "PASİF"}</button></div></details>`; } }, 120); }
document.addEventListener("change", e => { const i = e.target.closest && e.target.closest("[data-mvk]"); if (!i) return; const k = i.dataset.mvk, v = +i.value; C[k] = k === "vr15" ? v : v/100; C = H.cfgOf(C); save(); paint(); });
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-mvt]"); if (!b) return; e.preventDefault(); const k = b.dataset.mvt; C[k] = !C[k]; save(); if (k === "on"){ if (C.on){ loadUni().then(open); } else close(); } paint(); });
{ let st = false; const go = () => { if (st) return; st = true; setTimeout(() => loadUni().then(() => { open(); paint(); }), 1500); }; /* v8.0.2: after page load (max 15 s) */
  if (document.readyState === "complete") go(); else { window.addEventListener("load", go); setTimeout(go, 15000); } } paint(); setInterval(loadUni, 3600000);
return { S, bars, get cfg(){ return C; }, paint, _emit: emit };
})();
