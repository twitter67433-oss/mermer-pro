/* MERMER TERMİNAL v7.29 — SHORT tab: SERT SHORT scanner, verdict + chart, DEFTER (journal). v7.28: main signal + 15m SHORT scanner. SIGNAL ONLY: public Binance reads, no keys, no orders, never MEME auto-buy.
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
/* v7.29 TERSİ: the mirrored LONG at the same entry — stop = entry − (stop − entry), stop-first, trail = max(stop, high − atr), 60 bars, same fee */
function simLong(e, stopS, atr, bars, tmax = 60){ const stop = 2*e - stopS; let s = stop; const B = (bars || []).slice(0, tmax);
  for (let i = 0; i < B.length; i++){ const k = B[i]; if (k.l <= s){ const x = s; return { exit: x, net: (x - e)/e - FEE2, why: s > stop ? "iz" : "stop", bars: i + 1 }; } if (fin(atr) && atr > 0) s = Math.max(s, k.h - atr); }
  if (B.length < tmax) return null; const x = B[B.length - 1].c; return { exit: x, net: (x - e)/e - FEE2, why: "60dk", bars: tmax }; }
/* v7.29 Önerilen SL / TP: SL = signal high +0.05 %, R = SL − entry, TP1 = entry − 1R, TP2 = entry − 2R (TERSİ LONG mirrored).
   tpTrack: which comes first within 60 one-minute bars — SL before TP1 → "SL"; TP2 → "TP2"; TP1 only → "TP1"; neither → null (caller uses iz/60dk).
   Same bar touching SL and a TP counts as SL (conservative). */
function levels(e, sl, side = -1){ const R = Math.abs(sl - e), s = side < 0 ? 1 : -1; return { sl: e + s*R, tp1: e - s*R, tp2: e - 2*s*R, R }; }
function tpTrack(side, e, slS, bars, tmax = 60){ const L = levels(e, slS, side), B = (bars || []).slice(0, tmax); let g1 = false;
  for (const k of B){ const hitSL = side < 0 ? k.h >= L.sl : k.l <= L.sl; if (hitSL) return { tp1: g1, tp2: false, first: g1 ? "TP1" : "SL" };
    if (side < 0 ? k.l <= L.tp2 : k.h >= L.tp2) return { tp1: true, tp2: true, first: "TP2" }; if (side < 0 ? k.l <= L.tp1 : k.h >= L.tp1) g1 = true; }
  if (B.length < tmax) return null; return { tp1: g1, tp2: false, first: g1 ? "TP1" : null }; }
function stats(J){ const R = (J || []).filter(j => j.res); const w = R.filter(j => j.res.net > 0).length, s = R.reduce((a, j) => a + j.res.net, 0);
  return { n: R.length, open: (J || []).length - R.length, winRate: R.length ? w/R.length : null, avg: R.length ? s/R.length : null }; }
/* v7.29 DEFTER: DOĞRU = net > 0 after the 0.10 % fee; open = no result yet */
const WHY = { stop: "stop", iz: "trailing", "60dk": "60dk" };
function summary(J, k = "res"){ const tk = k === "res" ? "tp" : "tpr", T = (J || []).filter(j => j[tk]), t1 = T.filter(j => j[tk].tp1).length, t2 = T.filter(j => j[tk].tp2).length; J = (J || []).map(j => ({ res: j[k] })); const R = J.filter(j => j.res), w = R.filter(j => j.res.net > 0).length, tot = R.reduce((a, j) => a + j.res.net, 0);
  return { toplam: (J || []).length, dogru: w, yanlis: R.length - w, acik: (J || []).length - R.length, kazanma: R.length ? w/R.length : null, ort: R.length ? tot/R.length : null, net: tot, tpN: T.length, tp1: T.length ? t1/T.length : null, tp2: T.length ? t2/T.length : null }; }
const ilk = (j, k = "res") => { const t = j[k === "res" ? "tp" : "tpr"], r = j[k]; return t && t.first ? t.first : t && r ? (WHY[r.why] || r.why) : ""; };
const sonuc = (j, k = "res") => !j[k] ? "AÇIK" : j[k].net > 0 ? "DOĞRU" : "YANLIŞ";
const berlin = t => new Date(t).toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).slice(0, 16);
function csv(J){ const q = v => /[;"\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
  return ["zaman (Berlin);coin;giriş;stop (SL);TP1;TP2;sonuç;çıkış nedeni;çıkış;net % (ücret dahil);ilk (TP1/TP2/SL/iz/60dk);TP1 vurdu;TP2 vurdu;squeeze;tersi LONG SL;tersi TP1;tersi TP2;tersi sonuç;tersi çıkış nedeni;tersi çıkış;tersi net %;tersi ilk;tersi TP1 vurdu;tersi TP2 vurdu"].concat((J || []).slice().sort((a, b) => a.t - b.t).map(j =>
    ((L, M, yn) => [berlin(j.t), j.sym.replace("USDT", ""), j.entry, j.stop, +L.tp1.toPrecision(8), +L.tp2.toPrecision(8), sonuc(j), j.res ? WHY[j.res.why] || j.res.why : "", j.res ? j.res.exit : "", j.res ? (j.res.net*100).toFixed(3) : "", ilk(j), yn(j.tp, "tp1"), yn(j.tp, "tp2"), j.sq ? "evet" : "",
      +M.sl.toPrecision(8), +M.tp1.toPrecision(8), +M.tp2.toPrecision(8), sonuc(j, "rev"), j.rev ? WHY[j.rev.why] || j.rev.why : "", j.rev ? j.rev.exit : "", j.rev ? (j.rev.net*100).toFixed(3) : "", ilk(j, "rev"), yn(j.tpr, "tp1"), yn(j.tpr, "tp2")])(levels(j.entry, j.stop, -1), levels(j.entry, j.stop, 1), (t, k) => t ? (t[k] ? "evet" : "hayır") : "").map(q).join(";"))).join("\n"); }
/* v7.29 small tag for non-crypto contracts (kept in the scanner): gold → ALTIN, other commodities → EMTİA, stocks/ETFs → HİSSE */
function kind(s){ if (!s) return ""; const b = String(s.baseAsset || s.symbol || "").replace(/USDT$/, ""), u = String(s.underlyingType || ""), sub = (s.underlyingSubType || []).join(",");
  if (/^(XAU|PAXG|XAUT)$/.test(b)) return "ALTIN"; if (u === "COMMODITY") return "EMTİA"; if (/EQUITY|PREMARKET/.test(u) || (/TradFi/.test(sub) && u !== "COIN")) return "HİSSE"; return ""; }
/* v7.29 full universe: every USD-M PERPETUAL contract with status TRADING (crypto, gold, stocks …) */
const universe = ei => ((ei && ei.symbols) || []).filter(s => s.contractType === "PERPETUAL" && s.status === "TRADING").map(s => s.symbol);
/* scan order: priority (selected/watchlist) first, then by 24h quote volume, then the rest */
function order(U, pri, vol){ const seen = new Set(), out = []; for (const x of pri || []) if (x && !seen.has(x)){ seen.add(x); out.push(x); }
  for (const x of (U || []).slice().sort((a, b) => ((vol && vol[b]) || 0) - ((vol && vol[a]) || 0))) if (!seen.has(x)){ seen.add(x); out.push(x); } return out; }
/* incremental 15m bars: merge a short fresh fetch into the cached closed bars (new wins), keep the last max */
function merge(old, nb, max = 110){ const m = new Map(); for (const x of old || []) m.set(x.t, x); for (const x of nb || []) m.set(x.t, x); return [...m.values()].sort((a, b) => a.t - b.t).slice(-max); }
const okRisk = (entry, stop) => entry > 0 && stop > entry && (stop - entry)/entry <= MAXR;
return { kind, universe, order, merge, top, pre, simExit, simLong, levels, tpTrack, stats, okRisk, MAXR, summary, sonuc, ilk, csv, berlin, WHY };
});

if (typeof window !== "undefined" && typeof document !== "undefined") window.SERTS = (() => {
const X = window.SERTX, JK = "mermer.sert.j", $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fp = v => !isFinite(v) ? "—" : v >= 1000 ? v.toFixed(1) : v >= 10 ? v.toFixed(2) : v >= 1 ? v.toFixed(3) : v >= 0.01 ? v.toFixed(5) : v.toPrecision(4);
const fj = async u => { const r = await fetch("https://fapi.binance.com" + u); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
const R = { sig: new Map(), scanned: 0, slot: 0, busy: false, n: 0, top: [], topAt: 0, want: new Set() }; /* same shape as v7.27 SR (simulator reuses it) */
let J = (() => { try { const a = JSON.parse(localStorage.getItem(JK) || "[]"); return Array.isArray(a) ? a.filter(j => j && j.sym && isFinite(j.t) && !(j.res && j.res.skip)) : []; } /* v7.28 records migrate as-is; TERSİ is back-filled */ catch(e){ return []; } })();
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
/* 15m bars per symbol: first pass limit=110 (weight 2), then limit=6 (weight 1) merged into the cache */
const C = new Map();
async function bars15(s){ const now = Date.now(), lastT = Math.floor(now/900000)*900000 - 900000, o = C.get(s), inc = o && o.length >= 101 && o[o.length - 1].t >= lastT - 4*900000;
  const k = await fj(`/fapi/v1/klines?symbol=${s}&interval=15m&limit=${inc ? 6 : 110}`), nb = k.filter(x => +x[6] < now).map(x => ({ t: +x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4], qv: +x[7], tb: +x[10] }));
  const b = inc ? X.merge(o, nb) : nb.slice(-110); C.set(s, b); return b; }
async function one(s){ const b = await bars15(s);
  if (!X.pre(b)){ R.sig.delete(s); return; } const last = b[b.length - 1], cT = last.t + 900000;
  const [oh, on, fr] = await Promise.all([fj(`/futures/data/openInterestHist?symbol=${s}&period=15m&limit=8`).catch(() => []), fj(`/fapi/v1/openInterest?symbol=${s}`).catch(() => null), fj(`/fapi/v1/fundingRate?symbol=${s}&limit=1`).catch(() => [])]);
  const ago = (oh || []).filter(x => +x.timestamp <= cT - 3600000).pop(), oiNow = on ? +on.openInterest : NaN, oi1 = ago && oiNow > 0 ? oiNow/(+ago.sumOpenInterest) - 1 : NaN;
  const r = window.PSIM.sertShort(b, oi1, fr && fr[0] ? +fr[0].fundingRate : NaN); r.sym = s; r.entry = last.c; r.until = cT + 900000; r.close = cT;
  R.cand = (R.cand || 0) + 1; if (r.sig && X.okRisk(r.entry, r.stop)){ R.sig.set(s, r); paintList(); } else R.sig.delete(s); }
const KIND = {}; let kindAt = 0, UNI = [], VOL = {}, volAt = 0;
async function loadKinds(){ if (Date.now() - kindAt < 6*3600000) return; try { const ei = await fj("/fapi/v1/exchangeInfo"); for (const s of ei.symbols){ const k = X.kind(s); if (k) KIND[s.symbol] = k; } UNI = X.universe(ei); kindAt = Date.now(); } catch(e){} }
const ktag = sym => KIND[sym] ? ` <small class="sert-k">${KIND[sym]}</small>` : "";
/* full pass over every TRADING perpetual (~570): 5 workers, ~6 requests/s → ~1.5–2 min per pass, weight ≈ 600–1200 per pass (limit 2400/min).
   OI/funding only for candidates passing the cheap kline check. 429/418 → pause 60 s and continue. */
const sleep = ms => new Promise(z => setTimeout(z, ms));
async function scan(force){ const slot = Math.floor(Date.now()/900000); if (R.busy || (!force && slot === R.slot) || !window.PSIM) return; R.busy = true; R.slot = slot; R.t0 = Date.now();
  await loadKinds(); try { if (Date.now() - volAt > 3600000){ for (const x of await fj("/fapi/v1/ticker/24hr")) VOL[x.symbol] = +x.quoteVolume; volAt = Date.now(); } } catch(e){}
  const L = X.order(UNI.length ? UNI : list(), list(), VOL); R.n = R.total = L.length; R.done = 0; R.cand = 0; let i = 0, lastP = 0;
  const work = async () => { while (i < L.length){ while (R.pause > Date.now()) await sleep(1000); const s = L[i++];
      try { await one(s); } catch(e){ if (/HTTP (429|418)/.test(e.message)){ R.e429 = (R.e429 || 0) + 1; R.pause = Date.now() + 60000; L.push(s); continue; } }
      R.done++; if (Date.now() - lastP > 1500){ lastP = Date.now(); paintList(); } await sleep(650); } };
  await Promise.all([work(), work(), work(), work(), work()]); R.scanned = Date.now(); R.dur = R.scanned - R.t0; R.busy = false;
  const nw = [...R.sig.values()].filter(r => !J.some(j => j.sym === r.sym && j.t === r.close)); const go = (await Promise.all(nw.map(fresh))).filter(Boolean); alertAll(go);
  resolve(); paint(); window.dispatchEvent(new CustomEvent("sert:update")); }
/* new trigger: log it to the live ledger and alert (respects SİNYAL 🔊/📳/🔔 settings); squeeze-risk coins get no GİR SHORT alert */
async function fresh(r){ const j = { sym: r.sym, t: r.close, entry: r.entry, stop: r.stop, atr: r.atr }; J.push(j); jSave();
  if (window.SQZ){ SQZ.get(r.sym); for (let k = 0; k < 24 && !SQZ.peek(r.sym); k++) await new Promise(z => setTimeout(z, 250)); } if (sqOn(r.sym)){ j.sq = 1; jSave(); return null; }
  return r; }
/* one short toast + one notification per scan (sound once), however many coins triggered */
function alertAll(L){ if (!L.length) return; const cs = L.map(r => r.sym.replace("USDT", "")), one = L.length === 1 ? L[0] : null;
  const body = one ? `${cs[0]} 15dk · giriş ${fp(one.entry)} · SL ${fp(one.stop)} · 1×ATR iz / 60dk (kanıtlanmadı)` : `${cs.join(", ")} · 15dk · SHORT sekmesinde giriş/SL/TP (kanıtlanmadı)`;
  try { window.NOTIFY && NOTIFY.toast(`GİR SHORT · ${cs.slice(0, 4).join(", ")}${cs.length > 4 ? ` +${cs.length - 4}` : ""} → SHORT`, "bad"); } catch(e){}
  try { window.SCALP && SCALP.extAlert && SCALP.extAlert("GİR SHORT · " + (one ? cs[0] : cs.length + " coin"), body, "neon-sert"); } catch(e){} }
/* DEFTER outcomes: runs every minute on every tab while the app is open; on reopen it back-fills open records from 1m klines.
   A record is closed as soon as its stop/trailing is hit, or after 60 one-minute bars. */
let resBusy = false;
async function resolve(){ if (resBusy) return; resBusy = true; let n = 0;
  for (const j of J){ if ((j.res && j.rev && j.tp && j.tpr) || Date.now() < j.t + 60000 || n >= 20) continue; n++;
    try { const k = await fj(`/fapi/v1/klines?symbol=${j.sym}&interval=1m&startTime=${j.t}&limit=60`); const b = k.map(x => ({ t: +x[0], h: +x[2], l: +x[3], c: +x[4], T: +x[6] })).filter(x => x.t >= j.t && x.T < Date.now());
      const r = j.res ? null : X.simExit(j.entry, j.stop, j.atr, b, 60), v = j.rev ? null : X.simLong(j.entry, j.stop, j.atr, b, 60); if (r) j.res = { net: r.net, why: r.why, exit: r.exit, t1: j.t + r.bars*60000 }; if (v) j.rev = { net: v.net, why: v.why, exit: v.exit, t1: j.t + v.bars*60000 }; if (!j.tp) j.tp = X.tpTrack(-1, j.entry, j.stop, b, 60) || undefined; if (!j.tpr) j.tpr = X.tpTrack(1, j.entry, j.stop, b, 60) || undefined; else if (!b.length && Date.now() > j.t + 3*86400000) j.skip = 1; } catch(e){} await new Promise(z => setTimeout(z, 80)); }
  J = J.filter(j => !j.skip); jSave(); resBusy = false; if (n) paint(); }
function liveLine(){ const s = X.stats(J), pc = x => x === null ? "—" : "%" + Math.round(x*100);
  return `SERT SHORT canlı: ${s.n} işlem · kazanma ${pc(s.winRate)} · ort ${s.avg === null ? "—" : (s.avg >= 0 ? "+" : "") + (s.avg*100).toFixed(2) + "%"} (ücret dahil)${s.open ? ` · ${s.open} takipte` : ""}`; }
/* ---- SHORT tab: scanner list · selected trigger (big verdict + chart) · DEFTER ---- */
let SEL = "", CH = { sym: "", b: null, at: 0 };
const pct = (x, d = 2) => x === null || !isFinite(x) ? "—" : (x >= 0 ? "+" : "−") + Math.abs(x*100).toFixed(d) + "%";
function paintList(){ const el = $("#sert-box"); if (!el) return; const rows = [...R.sig.keys()].map(active).filter(Boolean);
  if (!SEL || !rows.some(r => r.sym === SEL)) SEL = rows.length ? (rows.find(r => !sqOn(r.sym)) || rows[0]).sym : "";
  el.innerHTML = `<div class="sert-h">SHORT TETİKLERİ · 15dk <small class="dim">${R.busy ? `taranan ${R.done || 0}/${R.total || "…"}` : `${R.n} kontrat · ${R.scanned ? tm(R.scanned) : "taranıyor…"}`}</small></div>`
    + (rows.length ? rows.map(r => { const q = sqOn(r.sym), opened = window.PSIMUI && PSIMUI.st.pos.some(p => p.rule === "sert" && p.sym === r.sym);
      return `<div class="sert-r${r.sym === SEL ? " on" : ""}" data-sgo="${esc(r.sym)}" role="button" tabindex="0"><b class="${q ? "y" : "dn"}">${esc(r.sym.replace("USDT", ""))}${ktag(r.sym)}</b><span>${q ? "SHORT GİRME · squeeze" : ((L) => `giriş ${fp(r.entry)} · SL ${fp(r.stop)} · TP1 ${fp(L.tp1)} · TP2 ${fp(L.tp2)}`)(X.levels(r.entry, r.stop, -1))}</span>${q ? "" : opened ? `<small class="dim">simde</small>` : `<button type="button" class="mini" data-ssim="${esc(r.sym)}">SİMDE AÇ</button>`}</div>`; }).join("")
      : `<div class="dim">şu an SHORT tetiği yok · her 15dk kapanışında taranır</div>`); }
const tpLine = r => { const L = X.levels(r.entry, r.stop, -1); return `<div class="sg-dline sert-tp">Önerilen <span>SL <b class="dn">${fp(r.stop)}</b></span> · <span>TP1 <b class="up">${fp(L.tp1)}</b></span> · <span>TP2 <b class="up">${fp(L.tp2)}</b></span> <small class="dim">veya 1×ATR iz / 60dk</small></div>`; };
function paintDet(){ const el = $("#sert-det"); if (!el) return; const r = SEL && active(SEL);
  if (!r){ el.innerHTML = ""; el.hidden = true; return; } el.hidden = false; const q = sqOn(r.sym), c = r.sym.replace("USDT", "");
  el.innerHTML = `<div class="sert-coin">${esc(c)}${ktag(r.sym)} <small class="dim">15dk · ${tm(r.close)}</small></div>` + (q ? `<div class="sert-big y">SHORT GİRME</div>${window.SQZ ? SQZ.html(r.sym) : ""}` : `<div class="sert-big dn">GİR SHORT</div>${line(r)}${tpLine(r)}`)
    + `<canvas id="sert-cv" class="az-cv" aria-label="15dk mum grafiği: giriş, stop, iz"></canvas>`;
  chartFor(r); }
async function chartFor(r){ if (CH.sym !== r.sym || Date.now() - CH.at > 30000){ try { const k = await fj(`/fapi/v1/klines?symbol=${r.sym}&interval=15m&limit=48`); CH = { sym: r.sym, at: Date.now(), b: k.map(x => ({ t: +x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4] })) }; } catch(e){ return; } }
  draw($("#sert-cv"), CH.b, r); }
function draw(cv, b, r){ if (!cv || !b || !b.length) return; const w = cv.clientWidth || 340, h = cv.clientHeight || 200, dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = w*dpr; cv.height = h*dpr;
  const g = cv.getContext("2d"); g.scale(dpr, dpr); const after = b.filter(x => x.t >= r.close), lowS = after.length ? Math.min(...after.map(x => x.l)) : r.entry, iz = Math.min(r.stop, lowS + r.atr);
  const T = X.levels(r.entry, r.stop, -1), lv = [["SL", r.stop, "#9b1c31"], ["giriş", r.entry, "#1e3a5f"], ["iz", iz, "#9a7432"], ["TP1", T.tp1, "#0f6b45"], ["TP2", T.tp2, "#0f6b45"]], hi = Math.max(...b.map(x => x.h), r.stop), lo = Math.min(...b.map(x => x.l), T.tp2), pad = (hi - lo)*0.06 || hi*0.01;
  const R0 = 64, cw = (w - R0 - 6)/b.length, Y = v => 6 + (hi + pad - v)/(hi - lo + 2*pad)*(h - 12), dark = document.documentElement.classList.contains("night");
  g.clearRect(0, 0, w, h); b.forEach((x, i) => { const X0 = 3 + i*cw + cw/2, up = x.c >= x.o; g.strokeStyle = g.fillStyle = up ? "#0f6b45" : "#9b1c31"; g.beginPath(); g.moveTo(X0, Y(x.h)); g.lineTo(X0, Y(x.l)); g.stroke();
    const y1 = Y(Math.max(x.o, x.c)), y2 = Y(Math.min(x.o, x.c)); g.fillRect(X0 - Math.max(1, cw*0.35), y1, Math.max(2, cw*0.7), Math.max(1, y2 - y1)); if (x.t + 900000 === r.close){ g.strokeStyle = dark ? "#d6b171" : "#9a7432"; g.strokeRect(X0 - cw*0.6, Y(x.h) - 3, cw*1.2, Y(x.l) - Y(x.h) + 6); } });
  g.font = "11px system-ui, sans-serif"; let lastY = -99; lv.sort((a, b2) => b2[1] - a[1]).forEach(([t, v, col]) => { const y = Y(v); g.strokeStyle = col; g.setLineDash(t === "giriş" ? [] : [5, 4]); g.beginPath(); g.moveTo(0, y); g.lineTo(w - R0, y); g.stroke(); g.setLineDash([]);
    const ty = Math.max(y, lastY + 15); lastY = ty; g.fillStyle = col; g.fillRect(w - R0 + 2, ty - 8, R0 - 4, 16); g.fillStyle = "#fff"; g.fillText(`${t} ${fp(v)}`.slice(0, 11), w - R0 + 5, ty + 4); }); }
function paintJ(){ const el = $("#sert-j"); if (!el) return; const S = X.summary(J), V = X.summary(J, "rev"), pc = x => x === null ? "—" : "%" + Math.round(x*100);
  const rows = J.slice().sort((a, b) => b.t - a.t).slice(0, 100).map(j => { const s = X.sonuc(j); return `<tr><td>${esc(X.berlin(j.t).slice(5))}</td><td><b>${esc(j.sym.replace("USDT", ""))}</b>${ktag(j.sym)}${j.sq ? ` <small class="y">sq</small>` : ""}</td><td>${fp(j.entry)}</td><td>${fp(j.stop)}</td><td class="${s === "DOĞRU" ? "up" : s === "YANLIŞ" ? "dn" : "dim"}">${s}</td><td>${j.res || j.tp ? esc(X.ilk(j)) : "—"}</td><td class="${j.res ? (j.res.net > 0 ? "up" : "dn") : "dim"}">${j.res ? pct(j.res.net) : "—"}</td><td class="sert-rev ${j.rev ? (j.rev.net > 0 ? "up" : "dn") : "dim"}">${j.rev ? `${j.rev.net > 0 ? "D" : "Y"} ${pct(j.rev.net)} · ${esc(X.ilk(j, "rev"))}` : "—"}</td></tr>`; }).join("");
  el.innerHTML = `<div class="sert-h">DEFTER <small class="dim">her tetik otomatik · DOĞRU = iz/60dk çıkışı net &gt; 0 (%0.10 ücret dahil) · ilk = TP1/TP2/SL hangisi önce</small></div>
    <div class="sert-sum"><span><b class="dn">SHORT</b></span><span>toplam <b>${S.toplam}</b></span><span>doğru <b class="up">${S.dogru}</b></span><span>yanlış <b class="dn">${S.yanlis}</b></span>${S.acik ? `<span>açık <b>${S.acik}</b></span>` : ""}<span>kazanma <b>${pc(S.kazanma)}</b></span><span>ort net <b class="${S.ort > 0 ? "up" : S.ort < 0 ? "dn" : ""}">${pct(S.ort)}</b></span><span>toplam net <b class="${S.net > 0 ? "up" : S.net < 0 ? "dn" : ""}">${S.toplam - S.acik ? pct(S.net) : "—"}</b></span><span>TP1 <b>${pc(S.tp1)}</b></span><span>TP2 <b>${pc(S.tp2)}</b></span></div>
    <div class="sert-sum sert-sum2"><span><b>TERSİ (LONG)</b></span><span>kazanma <b>${pc(V.kazanma)}</b></span><span>ort net <b class="${V.ort > 0 ? "up" : V.ort < 0 ? "dn" : ""}">${pct(V.ort)}</b></span><span>toplam net <b class="${V.net > 0 ? "up" : V.net < 0 ? "dn" : ""}">${V.toplam - V.acik ? pct(V.net) : "—"}</b></span><span>TP1 <b>${pc(V.tp1)}</b></span><span>TP2 <b>${pc(V.tp2)}</b></span></div>
    ${rows ? `<div class="sert-tw"><table class="sert-t"><tr><th>zaman</th><th>coin</th><th>giriş</th><th>stop</th><th>sonuç</th><th>ilk</th><th>net</th><th>TERSİ (LONG)</th></tr>${rows}</table></div>` : `<div class="dim">henüz kayıt yok</div>`}
    <div class="sert-btns"><button type="button" class="mini" id="sert-csv"${J.length ? "" : " disabled"}>CSV dışa aktar</button><button type="button" class="mini" id="sert-clr"${J.length ? "" : " disabled"}>temizle</button></div>`; }
function paint(){ paintList(); if (document.body.dataset.pg === "short") paintDet(); paintJ(); }
async function exportCsv(){ const txt = "\ufeff" + X.csv(J), name = `mermer-short-defter-${X.berlin(Date.now()).slice(0, 10)}.csv`;
  try { const f = new File([txt], name, { type: "text/csv" }); if (navigator.canShare && navigator.canShare({ files: [f] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)){ await navigator.share({ files: [f], title: name }); return; } } catch(e){ if (e && e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  try { window.NOTIFY && NOTIFY.toast("✔ CSV: " + name, "good"); } catch(e){} }
async function clearJ(){ const ok = confirm(`SHORT DEFTERİ TEMİZLENSİN Mİ?\n${J.length} kayıt silinir (CSV ile önce dışa aktarabilirsin). Simülatör ve gerçek hesap etkilenmez.`);
  if (!ok) return; J = []; jSave(); paint(); }
async function simOpen(sym){ try { if (!window.PSIMUI) throw new Error("simülatör yok"); if (!(PSIMUI.px[sym] > 0)){ const t = await fj(`/fapi/v1/ticker/price?symbol=${sym}`); PSIMUI.px[sym] = +t.price; }
    PSIMUI.sertOpen(sym); paintList(); } catch(e){ try { NOTIFY.toast("✖ " + e.message, "bad"); } catch(x){} } }
function show(){ paint(); }
function init(){ const el = $("#short-box"); if (el) el.onclick = e => { const s = e.target.closest("[data-ssim]"); if (s){ e.stopPropagation(); simOpen(s.dataset.ssim); return; }
    const b = e.target.closest("[data-sgo]"); if (b){ SEL = b.dataset.sgo; paintList(); paintDet(); const d = $("#sert-det"); d && d.scrollIntoView({ behavior: "smooth", block: "nearest" }); return; }
    if (e.target.closest("#sert-csv")) exportCsv(); else if (e.target.closest("#sert-clr")) clearJ(); };
  paint(); setTimeout(() => scan(true), 3000); setTimeout(resolve, 5000);
  setInterval(() => { if (Math.floor(Date.now()/900000) !== R.slot && Date.now() % 900000 > 4000) scan(false); else paintList(); }, 10000); setInterval(resolve, 60000);
  setInterval(() => { if (document.body.dataset.pg === "short" && !document.hidden && SEL) paintDet(); }, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) resolve(); });
  window.addEventListener("sqz:update", paint); window.addEventListener("themechange", () => { if (document.body.dataset.pg === "short") paintDet(); }); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
return { R, scan, active, big, line, sqOn, paint, show, resolve, select: s => { SEL = s; paint(); }, _fresh: fresh, want: s => { if (s) R.want.add(s); }, get J(){ return J; }, liveLine };
})();
