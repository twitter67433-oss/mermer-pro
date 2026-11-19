/* MERMER TERMİNAL v7.28 — SERT SHORT as a main signal + 15m SHORT scanner. SIGNAL ONLY: public Binance reads, no keys, no orders, never MEME auto-buy.
   Rule = PSIM.sertShort (v7.27, unchanged): red 15m close < lowest low of prior 4, volume ≥3× 24h avg, taker sell ≥55 %, OI 1h ≥ +1 % or funding ≥ +0.05 %.
   Stop = signal high +0.05 % (skip if >3 % away). Exit = 1×ATR(15m) trailing or 60 min. Backtest: ≈ +0.08 %/trade, NOT significant — "kanıtlanmadı".
   Live ledger: every trigger is followed on 1m bars (stop-first, fee 0.10 % round trip) so the rule's real win rate is shown. */
"use strict";
(function (root, factory){ const M = factory(); if (typeof module === "object" && module.exports) module.exports = M; else root.SERTX = M; })(typeof self !== "undefined" ? self : this, function (){
const fin = x => typeof x === "number" && isFinite(x), FEE2 = 0.001, MAXR = 0.03;
const STABLE = /^(USDC|FDUSD|BUSD|TUSD|USDP|DAI|USDE|EUR|BTC|ETH)USDT$/;
/* top alts by 24h quote volume from /fapi/v1/ticker/24hr (perpetual USDT symbols only, live in the last hour) */
function top(tk, n = 50, now = Date.now()){ return (tk || []).filter(x => /^[A-Z0-9]+USDT$/.test(x.symbol) && !STABLE.test(x.symbol) && +x.closeTime > now - 3600000 && +x.quoteVolume > 0)
  .sort((a, b) => +b.quoteVolume - +a.quoteVolume).slice(0, n).map(x => x.symbol); }
/* cheap part of the rule (no OI/funding) — only coins passing this get the two extra requests */
function pre(b){ const n = b.length; if (n < 101) return false; const x = b[n - 1], lo4 = Math.min(b[n - 5].l, b[n - 4].l, b[n - 3].l, b[n - 2].l);
  let s = 0; for (let i = n - 97; i < n - 1; i++) s += b[i].qv; const avg = s/96; return x.c < x.o && x.c < lo4 && avg > 0 && x.qv/avg >= 3 && x.qv > 0 && 1 - x.tb/x.qv >= 0.55; }
/* follow a SHORT on 1m bars from the signal close: stop-first, then trail = min(stop, low + atr); 60 bars → close */
function simExit(e, stop, atr, bars, tmax = 60){ let s = stop; const B = (bars || []).slice(0, tmax);
  for (let i = 0; i < B.length; i++){ const k = B[i]; if (k.h >= s){ const x = s; return { exit: x, net: (e - x)/e - FEE2, why: s < stop ? "iz" : "stop", bars: i + 1 }; } if (fin(atr) && atr > 0) s = Math.min(s, k.l + atr); }
  if (B.length < tmax) return null; const x = B[B.length - 1].c; return { exit: x, net: (e - x)/e - FEE2, why: "60dk", bars: tmax }; }
function stats(J){ const R = (J || []).filter(j => j.res); const w = R.filter(j => j.res.net > 0).length, s = R.reduce((a, j) => a + j.res.net, 0);
  return { n: R.length, open: (J || []).length - R.length, winRate: R.length ? w/R.length : null, avg: R.length ? s/R.length : null }; }
const okRisk = (entry, stop) => entry > 0 && stop > entry && (stop - entry)/entry <= MAXR;
return { top, pre, simExit, stats, okRisk, MAXR };
});

if (typeof window !== "undefined" && typeof document !== "undefined") window.SERTS = (() => {
const X = window.SERTX, JK = "mermer.sert.j", $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fp = v => !isFinite(v) ? "—" : v >= 1000 ? v.toFixed(1) : v >= 10 ? v.toFixed(2) : v >= 1 ? v.toFixed(3) : v >= 0.01 ? v.toFixed(5) : v.toPrecision(4);
const fj = async u => { const r = await fetch("https://fapi.binance.com" + u); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
const R = { sig: new Map(), scanned: 0, slot: 0, busy: false, n: 0, top: [], topAt: 0, want: new Set() }; /* same shape as v7.27 SR (simulator reuses it) */
let J = (() => { try { const a = JSON.parse(localStorage.getItem(JK) || "[]"); return Array.isArray(a) ? a : []; } catch(e){ return []; } })();
const jSave = () => { try { localStorage.setItem(JK, JSON.stringify(J.slice(-300))); } catch(e){} };
const tm = t => new Date(t).toLocaleTimeString("tr-TR", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
function list(){ const s = new Set(); try { const S = window.SCALP && SCALP.S; if (S && S.sym) s.add(S.sym); if (S && S.wo) for (const x of S.wo.list) s.add(x); } catch(e){}
  try { const c = localStorage.getItem("neon.can.sym"); if (c) s.add(c); } catch(e){} for (const x of R.want) s.add(x); for (const x of R.top) s.add(x); return [...s].slice(0, 70); }
function livePx(sym){ try { const S = window.SCALP && SCALP.S; if (S && S.sym === sym && S.D && S.D.px > 0) return S.D.px; } catch(e){} try { const p = window.PSIMUI && PSIMUI.px[sym]; if (p > 0) return p; } catch(e){} return NaN; }
/* active trigger for a coin: until the next 15m close, and only while price has not crossed the stop */
function active(sym){ const r = R.sig.get(sym); if (!r) return null; if (Date.now() > r.until){ R.sig.delete(sym); return null; } const p = livePx(sym); if (p > 0 && p >= r.stop) return null; return r; }
const sqOn = sym => { const q = window.SQZ && SQZ.peek(sym); return !!(q && q.on); };
const line = r => `<div class="sg-dline sert-l"><span>giriş <b>${fp(r.entry)}</b></span> · <span>stop <b class="dn">${fp(r.stop)}</b></span> · <span>çıkış 1×ATR iz / 60dk</span> <small class="sert-tag">SERT SHORT</small></div>`;
/* VADELİ main block */
function big(sym){ const r = active(sym); if (!r || sqOn(sym)) return ""; return `<div class="sert-big dn">GİR SHORT</div>${line(r)}`; }
async function one(s, closeT){ const k = await fj(`/fapi/v1/klines?symbol=${s}&interval=15m&limit=120`); const b = k.filter(x => +x[6] < Date.now()).map(x => ({ t: +x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4], qv: +x[7], tb: +x[10] }));
  if (!X.pre(b)){ R.sig.delete(s); return; } const last = b[b.length - 1], cT = last.t + 900000;
  const [oh, on, fr] = await Promise.all([fj(`/futures/data/openInterestHist?symbol=${s}&period=15m&limit=8`).catch(() => []), fj(`/fapi/v1/openInterest?symbol=${s}`).catch(() => null), fj(`/fapi/v1/fundingRate?symbol=${s}&limit=1`).catch(() => [])]);
  const ago = (oh || []).filter(x => +x.timestamp <= cT - 3600000).pop(), oiNow = on ? +on.openInterest : NaN, oi1 = ago && oiNow > 0 ? oiNow/(+ago.sumOpenInterest) - 1 : NaN;
  const r = window.PSIM.sertShort(b, oi1, fr && fr[0] ? +fr[0].fundingRate : NaN); r.sym = s; r.entry = last.c; r.until = cT + 900000; r.close = cT;
  if (r.sig && X.okRisk(r.entry, r.stop)) R.sig.set(s, r); else R.sig.delete(s); }
async function scan(force){ const slot = Math.floor(Date.now()/900000); if (R.busy || (!force && slot === R.slot) || !window.PSIM) return; R.busy = true; R.slot = slot;
  try { if (Date.now() - R.topAt > 3600000 || !R.top.length){ R.top = X.top(await fj("/fapi/v1/ticker/24hr"), 50); R.topAt = Date.now(); } } catch(e){}
  const L = list(); R.n = L.length; let i = 0; const work = async () => { while (i < L.length){ const s = L[i++]; try { await one(s); } catch(e){} await new Promise(r => setTimeout(r, 60)); } };
  await Promise.all([work(), work(), work(), work()]); R.scanned = Date.now(); R.busy = false;
  for (const r of R.sig.values()) if (!J.some(j => j.sym === r.sym && j.t === r.close)) await fresh(r);
  resolve(); paint(); window.dispatchEvent(new CustomEvent("sert:update")); }
/* new trigger: log it to the live ledger and alert (respects SİNYAL 🔊/📳/🔔 settings); squeeze-risk coins get no GİR SHORT alert */
async function fresh(r){ J.push({ sym: r.sym, t: r.close, entry: r.entry, stop: r.stop, atr: r.atr }); jSave();
  if (window.SQZ){ SQZ.get(r.sym); for (let k = 0; k < 24 && !SQZ.peek(r.sym); k++) await new Promise(z => setTimeout(z, 250)); } if (sqOn(r.sym)) return;
  const c = r.sym.replace("USDT", ""), body = `${c} 15dk · giriş ${fp(r.entry)} · stop ${fp(r.stop)} · çıkış 1×ATR iz / 60dk (SERT SHORT, kanıtlanmadı)`;
  try { window.NOTIFY && NOTIFY.toast("GİR SHORT · " + body, "bad"); } catch(e){} try { window.SCALP && SCALP.extAlert && SCALP.extAlert("GİR SHORT · " + c, body, "neon-sert-" + r.sym); } catch(e){} }
let resBusy = false;
async function resolve(){ if (resBusy) return; resBusy = true; let n = 0;
  for (const j of J){ if (j.res || Date.now() < j.t + 61*60000 || n >= 6) continue; n++;
    try { const k = await fj(`/fapi/v1/klines?symbol=${j.sym}&interval=1m&startTime=${j.t}&limit=60`); const b = k.map(x => ({ t: +x[0], h: +x[2], l: +x[3], c: +x[4] })).filter(x => x.t >= j.t);
      const r = X.simExit(j.entry, j.stop, j.atr, b, 60); if (r) j.res = { net: r.net, why: r.why, exit: r.exit }; else if (Date.now() > j.t + 3*86400000) j.res = { net: 0, why: "veri yok", skip: 1 }; } catch(e){} }
  J = J.filter(j => !(j.res && j.res.skip)); jSave(); resBusy = false; if (n) paint(); }
function liveLine(){ const s = X.stats(J), pc = x => x === null ? "—" : "%" + Math.round(x*100);
  return `SERT SHORT canlı: ${s.n} işlem · kazanma ${pc(s.winRate)} · ort ${s.avg === null ? "—" : (s.avg >= 0 ? "+" : "") + (s.avg*100).toFixed(2) + "%"} (ücret dahil)${s.open ? ` · ${s.open} takipte` : ""}`; }
function paint(){ const el = $("#sert-box"); if (!el) return; const rows = [...R.sig.keys()].map(active).filter(Boolean);
  el.innerHTML = `<div class="sert-h">SHORT TETİKLERİ · 15dk <small class="dim">${R.n} coin · ${R.scanned ? tm(R.scanned) : "taranıyor…"}</small></div>`
    + (rows.length ? rows.map(r => { const q = sqOn(r.sym); return `<button type="button" class="sert-r" data-sgo="${esc(r.sym)}"><b class="${q ? "y" : "dn"}">${esc(r.sym.replace("USDT", ""))}</b><span>${q ? "SHORT GİRME · squeeze" : `giriş ${fp(r.entry)} · stop ${fp(r.stop)}`}</span></button>`; }).join("") : `<div class="dim">şu an SHORT tetiği yok</div>`)
    + `<div class="dim sert-live">${liveLine()}</div>`; }
function init(){ const el = $("#sert-box"); if (el) el.onclick = e => { const b = e.target.closest("[data-sgo]"); if (!b) return; try { NAV.go("analiz"); ANALIZ.run(b.dataset.sgo, "15m"); } catch(x){} };
  paint(); setTimeout(() => scan(true), 3000);
  setInterval(() => { if (Math.floor(Date.now()/900000) !== R.slot && Date.now() % 900000 > 4000) scan(false); else paint(); }, 10000); setInterval(resolve, 60000);
  window.addEventListener("sqz:update", paint); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
return { R, scan, active, big, line, sqOn, paint, _fresh: fresh, want: s => { if (s) R.want.add(s); }, get J(){ return J; }, liveLine };
})();
