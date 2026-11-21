/* MERMER TERMİNAL v8.1 — AKSİYON: one-word live guidance (GİR / BEKLE / ÇIK / KÂR AL) next to SHORT/LONG list rows and HAREKET.
   Guidance only, not a proven edge ("yönlendirme, kanıtlanmadı"). SIGNAL ONLY: no orders, no keys, no wallet, never auto-buy.
   Levels match sert.js (SL / TP1 = 1R / TP2 = 2R). Stop-first, same as DEFTER / tpTrack (stop and TP on the same tick → STOP).
   Gap-fill: a live price already past a level counts as that level being hit (we do not pretend we filled at the level — same idea as sert.js gapX).
   Trailing 1×ATR used in DEFTER after entry is NOT used here: the badge reads the suggested SL / TP, which is what the row already shows. */
(function (root, f){ const M = f(); if (typeof module === "object" && module.exports) module.exports = M; else root.AKSIYONX = M; })(typeof self !== "undefined" ? self : this, function (){
"use strict";
const DEF = { zone: 0.3, tmax: 60 * 60000, linger: 8 * 60000, ntf: true, retrace: 0.5, move24: 30 * 60000 };
const fin = x => typeof x === "number" && isFinite(x);
function cfgOf(o){ const c = Object.assign({}, DEF, o || {});
  for (const k of ["zone", "tmax", "linger", "retrace", "move24"]){ const v = +c[k]; c[k] = fin(v) && v > 0 ? v : DEF[k]; }
  c.ntf = c.ntf !== false; return c; }
/* same formula as SERTX.levels */
function levels(e, sl, side){ const R = Math.abs(sl - e), s = side < 0 ? 1 : -1; return { sl: e + s*R, tp1: e - s*R, tp2: e - 2*s*R, R }; }
const hitStop = (side, stop, px) => fin(px) && fin(stop) && (px - stop) * side <= 0;
const hitLvl = (side, lvl, px) => fin(px) && fin(lvl) && (px - lvl) * side >= 0; /* TP: price has reached/passed the target */
function pack(st, why, label, sub, extra){ return Object.assign({ st, why, label, sub }, extra || {}); }
/* sig: { side, entry, stop, close|t, atr? }  opt: { squeeze, opposite, latch, cfg, now already arg } */
function verdict(sig, px, now, opt){
  opt = opt || {}; const c = cfgOf(opt.cfg), side = sig.side < 0 ? -1 : 1, e = +sig.entry, st = +sig.stop, t0 = +(sig.close || sig.t) || now;
  const L = levels(e, st, side), age = now - t0, extra = { R: L.R, age, tp1: L.tp1, tp2: L.tp2 };
  if (opt.latch && opt.latch.st === "CIK") return pack("CIK", opt.latch.why, "ÇIK", opt.latch.sub || subOf(opt.latch.why), Object.assign(extra, { latch: 1 }));
  if (hitStop(side, st, px)) return pack("CIK", "STOP", "ÇIK", "STOP", extra);
  if (hitLvl(side, L.tp2, px)) return pack("CIK", "HEDEF2", "ÇIK", "HEDEF2", extra);
  if (age >= c.tmax) return pack("CIK", "SURE", "ÇIK", "SÜRE DOLDU", extra);
  if (opt.opposite) return pack("CIK", "TERS", "ÇIK", "TERS SİNYAL", extra);
  if (hitLvl(side, L.tp1, px)) return pack("KAR", "TP1", "KÂR AL", "STOP GİRİŞE", extra);
  if (opt.squeeze && side < 0) return pack("BEKLE", "SQUEEZE", "BEKLE", "SQUEEZE", extra);
  if (!fin(px) || !(e > 0) || !(L.R > 0)) return pack("BEKLE", "FIYAT", "BEKLE", "FİYAT YOK", extra);
  const favR = side * (px - e) / L.R; extra.favR = favR;
  if (favR > c.zone) return pack("BEKLE", "GEC", "BEKLE", "GEÇ KALDIN", extra);
  return pack("GIR", "ZONE", "GİR", "", extra);
}
function subOf(why){ return ({ STOP: "STOP", HEDEF2: "HEDEF2", SURE: "SÜRE DOLDU", TERS: "TERS SİNYAL", TP1: "STOP GİRİŞE", SQUEEZE: "SQUEEZE", FIYAT: "FİYAT YOK", GEC: "GEÇ KALDIN", DONDU: "DÖNDÜ", KOVALA: "KOVALAMA" })[why] || ""; }
function stillOn(sig, now, v, cfg){ const c = cfgOf(cfg), t0 = +(sig.close || sig.t) || now;
  if (v && v.st === "CIK"){ const at = sig._cikAt || v.at || now; return now - at <= c.linger; }
  return now - t0 <= c.tmax; }
/* HAREKET (no SL/TP): ev { dir, ch, w, t, px } + live px. 15dk/1s: GİR while the move holds (≥ retrace of the trigger move still in place).
   24s: BEKLE (don't chase a day-long move) unless the alert is fresh (< move24) and the move still holds. Reversal past the origin → ÇIK DÖNDÜ. */
function moveVerdict(ev, px, now, opt){
  opt = opt || {}; const c = cfgOf(opt.cfg), dir = ev.dir > 0 ? 1 : -1, t0 = +ev.t || now, age = now - t0;
  const cap = ev.w === "24s" ? 4 * 3600000 : ev.w === "1s" ? c.tmax : 30 * 60000;
  if (opt.latch && opt.latch.st === "CIK") return pack("CIK", opt.latch.why, "ÇIK", opt.latch.sub || subOf(opt.latch.why), { age });
  if (age >= cap) return pack("CIK", "SURE", "ÇIK", "SÜRE DOLDU", { age });
  if (opt.squeeze && dir > 0) return pack("BEKLE", "SQUEEZE", "BEKLE", "SQUEEZE", { age });
  const px0 = +ev.px, ch = +ev.ch; if (!fin(px) || !fin(px0) || !(px0 > 0)) return pack("BEKLE", "FIYAT", "BEKLE", "FİYAT YOK", { age });
  const origin = fin(ch) ? px0 / (1 + ch) : NaN;
  if (fin(origin) && origin > 0 && (px - origin) * dir <= origin * 1e-6) return pack("CIK", "DONDU", "ÇIK", "DÖNDÜ", { age });
  const hold = fin(ch) && ch !== 0 ? dir * (px - origin) / origin / Math.abs(ch) : 1; /* 1 = full trigger move still in place */
  if (hold < (1 - c.retrace)) return pack("BEKLE", "GEC", "BEKLE", "GEÇ KALDIN", { age, hold });
  if (ev.w === "24s" && age >= c.move24) return pack("BEKLE", "KOVALA", "BEKLE", "KOVALAMA", { age, hold });
  return pack("GIR", "ZONE", "GİR", "", { age, hold });
}
function badge(v){ if (!v) return ""; const k = { GIR: "gir", BEKLE: "bekle", CIK: "cik", KAR: "kar" }[v.st] || "bekle";
  const sub = v.sub ? `<small>${v.sub}</small>` : "";
  return `<span class="ax ax-${k}" title="yönlendirme, kanıtlanmadı${v.sub ? " · " + v.sub : ""}">${v.label}${sub}</span>`; }
return { DEF, cfgOf, levels, verdict, moveVerdict, stillOn, badge, hitStop, hitLvl };
});

if (typeof window !== "undefined" && typeof document !== "undefined") window.AKSIYON = (() => {
const X = window.AKSIYONX, CK = "mermer.aksiyon", NK = "mermer.aksiyon.ntf";
let C = (() => { try { return X.cfgOf(JSON.parse(localStorage.getItem(CK) || "{}")); } catch(e){ return X.cfgOf(); } })();
const save = () => { try { localStorage.setItem(CK, JSON.stringify(C)); } catch(e){} };
const px = {}, sent = (() => { const m = new Map(); try { const o = JSON.parse(localStorage.getItem(NK) || "{}"), n = Date.now(); for (const k in o) if (n - o[k] < 12*3600000) m.set(k, o[k]); } catch(e){} return m; })();
const saveSent = () => { try { const o = {}, n = Date.now(); for (const [k, t] of sent) if (n - t < 12*3600000) o[k] = t; localStorage.setItem(NK, JSON.stringify(o)); } catch(e){} };
function live(sym){ try { const S = window.SCALP && SCALP.S; if (S && S.sym === sym && S.D && S.D.px > 0) return S.D.px; } catch(e){}
  try { const p = window.PSIMUI && PSIMUI.px[sym]; if (p > 0) return p; } catch(e){}
  try { const a = window.HAREKET && HAREKET.S && HAREKET.S.px && HAREKET.S.px.get(sym); if (a && a.length && a[a.length - 1][1] > 0) return a[a.length - 1][1]; } catch(e){}
  return px[sym] > 0 ? px[sym] : NaN; }
async function poll(){ try { const r = await fetch("https://fapi.binance.com/fapi/v1/ticker/price"); const a = await r.json();
    if (Array.isArray(a)) for (const x of a){ const p = +x.price; if (x.symbol && p > 0) px[x.symbol] = p; } } catch(e){} }
function ofSig(r, opt){ const now = Date.now(), latch = r._latch; const v = X.verdict(r, live(r.sym), now, Object.assign({ cfg: C, latch }, opt || {}));
  if (v.st === "CIK" && !r._cikAt) r._cikAt = now; if (v.st === "CIK") r._latch = { st: "CIK", why: v.why, sub: v.sub }; r._ax = v; return v; }
function ofMove(e){ const latch = e._latch, sq = !!(e.sq && e.sq.on) || (e.risk && /SQUEEZE RİSKİ/.test(e.risk));
  const v = X.moveVerdict(e, live(e.sym), Date.now(), { cfg: C, latch, squeeze: sq });
  if (v.st === "CIK" && !e._cikAt) e._cikAt = Date.now(); if (v.st === "CIK") e._latch = { st: "CIK", why: v.why, sub: v.sub }; e._ax = v; return v; }
function tracked(r){ try { if (window.PSIMUI && PSIMUI.st && PSIMUI.st.pos.some(p => p.sym === r.sym && (!p.rule || p.rule === r.k))) return "sim"; } catch(e){}
  try { if (window.SERTS && SERTS.R && SERTS.R.want && SERTS.R.want.has(r.sym)) return "izle"; } catch(e){}
  try { const S = window.SERTS && SERTS; if (S && ((S._sel && S._sel.sym === r.sym) || (window.SCALP && SCALP.S && SCALP.S.sym === r.sym))) return "sec"; } catch(e){}
  return ""; }
function ntf(r, v, kind){ if (!C.ntf || !v || v.st !== "CIK") return; const who = tracked(r); if (!who && kind !== "sim") return;
  const key = (r.k || r.w || "ax") + "|" + r.sym + "|" + (r.close || r.t) + "|" + v.why; if (sent.has(key)) return; sent.set(key, Date.now()); saveSent();
  const c = (r.sym || "").replace("USDT", ""), msg = `${c} · ÇIK${v.sub ? " · " + v.sub : ""} · yönlendirme, kanıtlanmadı`;
  try { window.NOTIFY && NOTIFY.toast("AKSİYON " + msg, "info"); } catch(e){}
  try { window.SCALP && SCALP.extAlert && SCALP.extAlert("AKSİYON ÇIK · " + c, msg, "neon-aksiyon-" + key); } catch(e){} }
function hint(){ return "GİR ≤" + (C.zone * 100).toFixed(0) + "%R · 60dk · yönlendirme, kanıtlanmadı"; }
let tPoll = 0; function tick(){ const pg = document.body && document.body.dataset.pg; if (pg === "short" || pg === "long"){ if (Date.now() - tPoll > 8000){ tPoll = Date.now(); poll().then(() => { try { window.SERTS && SERTS.paint && SERTS.paint(); } catch(e){} try { window.HAREKET && HAREKET.paint && HAREKET.paint(); } catch(e){} }); } } }
setInterval(tick, 4000);
{ let st = false; const go = () => { if (st) return; st = true; setTimeout(poll, 2000); };
  if (document.readyState === "complete") go(); else { window.addEventListener("load", go); setTimeout(go, 15000); } }
return { get cfg(){ return C; }, setCfg: o => { C = X.cfgOf(Object.assign({}, C, o)); save(); return C; }, px, live, ofSig, ofMove, ntf, tracked, badge: v => X.badge(v), hint, stillOn: (s, v) => X.stillOn(s, Date.now(), v, C) };
})();
