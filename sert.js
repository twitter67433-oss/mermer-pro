/* MERMER TERMİNAL v7.32 — SHORT + LONG tabs, 7 lists (v7.31 STOPSUZ defter, v7.29 SHORT tab): SERT SHORT scanner, verdict + chart, DEFTER (journal). v7.28: main signal + 15m SHORT scanner. SIGNAL ONLY: public Binance reads, no keys, no orders, never MEME auto-buy.
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
/* v8.0 gap fill: the trailing stop is moved at a bar's CLOSE, so the next bar can OPEN already past it — then the fill is that open, not the stop
   (the old code filled at the stop = too good). side −1 = SHORT (stop above), +1 = LONG (stop below). Bars without o (old caches) fall back to the stop. */
const gapX = (side, s, k) => fin(k.o) ? (side < 0 ? Math.max(s, k.o) : Math.min(s, k.o)) : s;
/* follow a SHORT on 1m bars from the signal close: stop-first, then trail = min(stop, low + atr); 60 bars → close */
function simExit(e, stop, atr, bars, tmax = 60){ let s = stop; const B = (bars || []).slice(0, tmax);
  for (let i = 0; i < B.length; i++){ const k = B[i]; if (k.h >= s){ const x = gapX(-1, s, k); return { exit: x, net: (e - x)/e - FEE2, why: s < stop ? "iz" : "stop", bars: i + 1, gap: x !== s ? 1 : undefined }; } if (fin(atr) && atr > 0) s = Math.min(s, k.l + atr); }
  if (B.length < tmax) return null; const x = B[B.length - 1].c; return { exit: x, net: (e - x)/e - FEE2, why: "60dk", bars: tmax }; }
/* v7.29 TERSİ: the mirrored LONG at the same entry — stop = entry − (stop − entry), stop-first, trail = max(stop, high − atr), 60 bars, same fee */
function simLong(e, stopS, atr, bars, tmax = 60){ const stop = 2*e - stopS; let s = stop; const B = (bars || []).slice(0, tmax);
  for (let i = 0; i < B.length; i++){ const k = B[i]; if (k.l <= s){ const x = gapX(1, s, k); return { exit: x, net: (x - e)/e - FEE2, why: s > stop ? "iz" : "stop", bars: i + 1, gap: x !== s ? 1 : undefined }; } if (fin(atr) && atr > 0) s = Math.max(s, k.h - atr); }
  if (B.length < tmax) return null; const x = B[B.length - 1].c; return { exit: x, net: (x - e)/e - FEE2, why: "60dk", bars: tmax }; }
/* v7.29 Önerilen SL / TP: SL = signal high +0.05 %, R = SL − entry, TP1 = entry − 1R, TP2 = entry − 2R (TERSİ LONG mirrored).
   tpTrack: which comes first within 60 one-minute bars — SL before TP1 → "SL"; TP2 → "TP2"; TP1 only → "TP1"; neither → null (caller uses iz/60dk).
   Same bar touching SL and a TP counts as SL (conservative). */
function levels(e, sl, side = -1){ const R = Math.abs(sl - e), s = side < 0 ? 1 : -1; return { sl: e + s*R, tp1: e - s*R, tp2: e - 2*s*R, R }; }
function tpTrack(side, e, slS, bars, tmax = 60){ const L = levels(e, slS, side), B = (bars || []).slice(0, tmax); let g1 = false;
  for (const k of B){ const hitSL = side < 0 ? k.h >= L.sl : k.l <= L.sl; if (hitSL) return { tp1: g1, tp2: false, first: g1 ? "TP1" : "SL" };
    if (side < 0 ? k.l <= L.tp2 : k.h >= L.tp2) return { tp1: true, tp2: true, first: "TP2" }; if (side < 0 ? k.l <= L.tp1 : k.h >= L.tp1) g1 = true; }
  if (B.length < tmax) return null; return { tp1: g1, tp2: false, first: g1 ? "TP1" : null }; }
/* v7.31 STOPSUZ: same trigger with NO stop — exit when TP2 (entry ∓ 2R, R from the suggested SL) is touched, else the 60th 1m close.
   mae = worst move against the position until exit (fraction of entry; includes the exit bar). Same fee 0.10 %. side −1 = SHORT, +1 = TERSİ LONG. */
function simFree(side, e, slS, bars, tmax = 60){ const L = levels(e, slS, side), B = (bars || []).slice(0, tmax); let mae = 0;
  for (let i = 0; i < B.length; i++){ const k = B[i]; mae = Math.max(mae, side < 0 ? (k.h - e)/e : (e - k.l)/e);
    if (side < 0 ? k.l <= L.tp2 : k.h >= L.tp2){ const x = L.tp2; return { exit: x, net: side*(x - e)/e - FEE2, why: "TP2", bars: i + 1, mae }; } }
  if (B.length < tmax) return null; const x = B[B.length - 1].c; return { exit: x, net: side*(x - e)/e - FEE2, why: "60dk", bars: tmax, mae }; }
function stats(J){ const R = (J || []).filter(j => j.res); const w = R.filter(j => j.res.net > 0).length, s = R.reduce((a, j) => a + j.res.net, 0);
  return { n: R.length, open: (J || []).length - R.length, winRate: R.length ? w/R.length : null, avg: R.length ? s/R.length : null }; }
/* v7.29 DEFTER: DOĞRU = net > 0 after the 0.10 % fee; open = no result yet */
const WHY = { stop: "stop", iz: "trailing", "60dk": "60dk", TP2: "TP2" };
/* v7.31 Defter modu → which result is the main DOĞRU/YANLIŞ: STOPLU = res/rev, STOPSUZ = ns/nsr */
const KEYS = { STOPLU: ["res", "rev"], STOPSUZ: ["ns", "nsr"] };
function summary(J, k = "res"){ const tk = k === "res" ? "tp" : "tpr", T = (J || []).filter(j => j[tk]), t1 = T.filter(j => j[tk].tp1).length, t2 = T.filter(j => j[tk].tp2).length; J = (J || []).map(j => ({ res: j[k] })); const R = J.filter(j => j.res), w = R.filter(j => j.res.net > 0).length, tot = R.reduce((a, j) => a + j.res.net, 0);
  return { toplam: (J || []).length, dogru: w, yanlis: R.length - w, acik: (J || []).length - R.length, kazanma: R.length ? w/R.length : null, ort: R.length ? tot/R.length : null, net: tot, tpN: T.length, tp1: T.length ? t1/T.length : null, tp2: T.length ? t2/T.length : null, ...((M) => ({ maeOrt: M.length ? M.reduce((a, x) => a + x, 0)/M.length : null, maeMax: M.length ? Math.max(...M) : null }))(R.map(j => j.res.mae).filter(x => typeof x === "number" && isFinite(x))) }; }
const ilk = (j, k = "res") => { if (k === "ns" || k === "nsr") return j[k] ? WHY[j[k].why] || j[k].why : ""; const t = j[k === "res" ? "tp" : "tpr"], r = j[k]; return t && t.first ? t.first : t && r ? (WHY[r.why] || r.why) : ""; };
const sonuc = (j, k = "res") => !j[k] ? "AÇIK" : j[k].net > 0 ? "DOĞRU" : "YANLIŞ";
const berlin = t => new Date(t).toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).slice(0, 16);
function csv(J){ const q = v => /[;"\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
  return ["zaman (Berlin);coin;giriş;stop (SL);TP1;TP2;sonuç;çıkış nedeni;çıkış;net % (ücret dahil);ilk (TP1/TP2/SL/iz/60dk);TP1 vurdu;TP2 vurdu;squeeze;tersi LONG SL;tersi TP1;tersi TP2;tersi sonuç;tersi çıkış nedeni;tersi çıkış;tersi net %;tersi ilk;tersi TP1 vurdu;tersi TP2 vurdu;stopsuz sonuç;stopsuz çıkış nedeni;stopsuz çıkış;stopsuz net %;stopsuz MAE %;tersi stopsuz sonuç;tersi stopsuz net %;tersi stopsuz MAE %;liste;yön"].concat((J || []).slice().sort((a, b) => a.t - b.t).map(j =>
    ((L, M, yn) => [berlin(j.t), j.sym.replace("USDT", ""), j.entry, j.stop, +L.tp1.toPrecision(8), +L.tp2.toPrecision(8), sonuc(j), j.res ? WHY[j.res.why] || j.res.why : "", j.res ? j.res.exit : "", j.res ? (j.res.net*100).toFixed(3) : "", ilk(j), yn(j.tp, "tp1"), yn(j.tp, "tp2"), j.sq ? "evet" : "",
      +M.sl.toPrecision(8), +M.tp1.toPrecision(8), +M.tp2.toPrecision(8), sonuc(j, "rev"), j.rev ? WHY[j.rev.why] || j.rev.why : "", j.rev ? j.rev.exit : "", j.rev ? (j.rev.net*100).toFixed(3) : "", ilk(j, "rev"), yn(j.tpr, "tp1"), yn(j.tpr, "tp2"), sonuc(j, "ns"), j.ns ? WHY[j.ns.why] || j.ns.why : "", j.ns ? j.ns.exit : "", j.ns ? (j.ns.net*100).toFixed(3) : "", j.ns ? (j.ns.mae*100).toFixed(3) : "", sonuc(j, "nsr"), j.nsr ? (j.nsr.net*100).toFixed(3) : "", j.nsr ? (j.nsr.mae*100).toFixed(3) : "", (LK[j.k || "sert"] || LK.sert).name, (j.side || -1) < 0 ? "SHORT" : "LONG"])(levels(j.entry, j.stop, j.side || -1), levels(j.entry, j.stop, -(j.side || -1)), (t, k) => t ? (t[k] ? "evet" : "hayır") : "").map(q).join(";"))).join("\n"); }
/* v7.29 small tag for non-crypto contracts (kept in the scanner): gold → ALTIN, other commodities → EMTİA, stocks/ETFs → HİSSE */
function kind(s){ if (!s) return ""; const b = String(s.baseAsset || s.symbol || "").replace(/USDT$/, ""), u = String(s.underlyingType || ""), sub = (s.underlyingSubType || []).join(",");
  if (/^(XAU|PAXG|XAUT)$/.test(b)) return "ALTIN"; if (u === "COMMODITY") return "EMTİA"; if (/EQUITY|PREMARKET/.test(u) || (/TradFi/.test(sub) && u !== "COIN")) return "HİSSE"; return ""; }
/* v7.29 full universe: every USD-M PERPETUAL contract with status TRADING (crypto, gold, stocks …) */
const isUsdt = s => s && (s.quoteAsset ? s.quoteAsset === "USDT" : /USDT$/.test(s.symbol || "")); /* v7.33.1: only USDT-quoted perps (no USDC / other quotes) */
const universe = ei => ((ei && ei.symbols) || []).filter(s => (s.contractType === "PERPETUAL" || s.contractType === "TRADIFI_PERPETUAL") && s.status === "TRADING" && isUsdt(s)).map(s => s.symbol); /* gold/stocks are TRADIFI_PERPETUAL */
/* scan order: priority (selected/watchlist) first, then by 24h quote volume, then the rest */
function order(U, pri, vol){ const seen = new Set(), out = []; for (const x of pri || []) if (x && /USDT$/.test(x) && !seen.has(x)){ seen.add(x); out.push(x); }
  for (const x of (U || []).slice().sort((a, b) => ((vol && vol[b]) || 0) - ((vol && vol[a]) || 0))) if (/USDT$/.test(x) && !seen.has(x)){ seen.add(x); out.push(x); } return out; }
/* incremental 15m bars: merge a short fresh fetch into the cached closed bars (new wins), keep the last max */
function merge(old, nb, max = 110){ const m = new Map(); for (const x of old || []) m.set(x.t, x); for (const x of nb || []) m.set(x.t, x); return [...m.values()].sort((a, b) => a.t - b.t).slice(-max); }
/* ===== v7.32 RULE BOOK — SHORT tab: SHORT · SQUEEZE SHORT · SQUEEZE DEVAM (SHORT); LONG tab: LONG · SQUEEZE LONG · KAPİTÜLASYON · SQUEEZE DEVAM (LONG).
   All on closed 15m bars (last = signal bar). x = { oi1: OI change over the last hour, fr: last funding rate } (NaN when unknown).
   bt = 45-day backtest (109 alts, fee 0.10 %, next-bar entry, 60 min) — every rule is "kanıtlanmadı" (none is statistically significant). */
const LISTS = [
  { k: "sert", side: -1, tab: "short", name: "SHORT", sub: "SERT SHORT · 1s dip kırılımı · hacim≥3× · satış≥%55 · OI↑ / funding↑", maxR: 0.03, bt: "45g test: n=276 · stoplu %37 +0.04% · stopsuz %47 +0.04% · v8.0 28g tekrar (120 coin, boşluk dolumlu): n=101 · stoplu %38 −0.04% · stopsuz %48 +0.03%" },
  { k: "sqs", side: -1, tab: "short", name: "SQUEEZE SHORT", sub: "pompa sonrası söndürme · funding≥%0.05 ya da 72s +%30 & funding≥%0.03 · kırmızı kırılım", maxR: 0.05, bt: "45g test: n≈160 · stoplu %43 +0.35% · stopsuz %52 +0.23% (az coin, kanıtlanmadı) · v8.0 28g tekrar (120 coin, boşluk dolumlu): n=259 · stoplu %36 +0.05% · stopsuz %56 +0.56%" },
  { k: "dag", side: -1, tab: "short", ext: 1, name: "DAĞITIM (SHORT)", sub: "çok borsa: fiyat 4s ≥+%3 · taker satış ≥%10 ağır · toplam OI 1s ≥+%1", maxR: 0.05, bt: "45g test: n=271 · stoplu %35 −0.03% · stopsuz %54 −0.15% — ZARARDA" },
  { k: "dvs", side: -1, tab: "short", name: "SQUEEZE DEVAM (SHORT)", sub: "long tasfiyesi sürüyor · sert düşüş · OI↓ · funding≥0 · hacim≥3×", maxR: 0.05, bt: "45g test: n=99 · stoplu %27 −0.23% · stopsuz %32 −0.42% — ZARARDA · v8.0 28g tekrar (120 coin, boşluk dolumlu): n=13 · stoplu %62 +0.57% · stopsuz %100 +1.07% (çok az örnek)" },
  { k: "lng", side: 1, tab: "long", name: "LONG", sub: "1s tepe kırılımı · hacim≥3× · alış≥%55 · OI≥+%1", maxR: 0.03, bt: "45g test: n=299 · stoplu %32 −0.17% · stopsuz %36 −0.31% — ZARARDA · v8.0 28g tekrar (120 coin, boşluk dolumlu): n=36 · stoplu %19 −0.31% · stopsuz %25 −0.57% (çok az örnek)" },
  { k: "sql", side: 1, tab: "long", name: "SQUEEZE LONG", sub: "short kalabalık · funding≤−%0.03 · OI≥0 · 1s tepe kırılımı · hacim≥2×", maxR: 0.05, bt: "45g test: n=179 · stoplu %41 +0.42% · stopsuz %56 +1.06% (19 coin, kanıtlanmadı) · v8.0 28g tekrar (120 coin, boşluk dolumlu): n=43 · stoplu %49 +0.75% · stopsuz %65 +1.45% (çok az örnek)" },
  { k: "kap", side: 1, tab: "long", name: "KAPİTÜLASYON (LONG)", sub: "3 kırmızı sonrası · aralık≥2 ATR · hacim≥3× · alt fitil≥%50", maxR: 0.05, bt: "45g test: n=404 · stoplu %31 −0.06% · stopsuz %45 −0.09% — ZARARDA · v8.0 28g tekrar (120 coin, boşluk dolumlu): n=301 · stoplu %29 −0.04% · stopsuz %44 +0.03%" },
  { k: "top", side: 1, tab: "long", ext: 1, name: "TOPLAMA (LONG)", sub: "çok borsa: fiyat 1s ±%1 / 4s ±%2 · hacim ≥1.5× · toplam OI 1s ≥+%3 · taker alış ≥%3", maxR: 0.05, bt: "45g test: n=102 · stoplu %41 +0.17% · stopsuz %53 +0.16% (kanıtlanmadı)" },
  { k: "dvl", side: 1, tab: "long", name: "SQUEEZE DEVAM (LONG)", sub: "short squeeze sürüyor · sert yükseliş · OI↓ · funding≤%0.01 · hacim≥3×", maxR: 0.05, bt: "45g test: n=32 · stoplu %28 −0.14% · stopsuz %41 +0.12% (çok az örnek) · v8.0 28g tekrar (120 coin, boşluk dolumlu): n=11 · stoplu %9 −0.72% · stopsuz %55 −1.45% (çok az örnek)" } ];
const LK = Object.fromEntries(LISTS.map(l => [l.k, l]));
function feat(b){ const n = (b || []).length; if (n < 101) return null; const x = b[n - 1], P = b.slice(Math.max(0, n - 289), n - 1);
  let s = 0; for (let i = n - 97; i < n - 1; i++) s += b[i].qv; const avg = s/96, rng = x.h - x.l;
  let a = null; for (let i = 0; i < n; i++){ const y = b[i], pc = i ? b[i - 1].c : y.c, tr = Math.max(y.h - y.l, Math.abs(y.h - pc), Math.abs(y.l - pc)); a = i < 14 ? (i === 0 ? tr : (a*i + tr)/(i + 1)) : (a*13 + tr)/14; }
  return { x, red: x.c < x.o, green: x.c > x.o, vr: avg > 0 ? x.qv/avg : 0, sell: x.qv > 0 ? 1 - x.tb/x.qv : 0, lo4p: Math.min(...b.slice(n - 5, n - 1).map(y => y.l)), hi4p: Math.max(...b.slice(n - 5, n - 1).map(y => y.h)),
    pl1: b[n - 2].l, r15: x.c/x.o - 1, c4: x.c/b[n - 5].c - 1, lo72: Math.min(...P.map(y => y.l)), atr: a, rng, lw: rng > 0 ? (Math.min(x.o, x.c) - x.l)/rng : 0,
    red3: b[n - 2].c < b[n - 2].o && b[n - 3].c < b[n - 3].o && b[n - 4].c < b[n - 4].o, hi4: Math.max(...b.slice(n - 4).map(y => y.h)), lo4: Math.min(...b.slice(n - 4).map(y => y.l)) }; }
/* bars-only part (decides whether OI/funding are fetched) */
function preK(k, f){ if (!f) return false; const x = f.x;
  switch (k){ case "sert": return f.red && x.c < f.lo4p && f.vr >= 3 && f.sell >= 0.55;
    case "sqs": return f.red && f.vr >= 2 && (x.c < f.lo4p || (x.c/f.lo72 - 1 >= 0.30 && x.c < f.pl1));
    case "dvs": return f.red && x.c < f.lo4p && f.vr >= 3 && (f.r15 <= -0.02 || f.c4 <= -0.04);
    case "lng": return f.green && x.c > f.hi4p && f.vr >= 3 && f.sell <= 0.45;
    case "sql": return f.green && x.c > f.hi4p && f.vr >= 2;
    case "kap": return f.red3 && f.rng >= 2*f.atr && f.vr >= 3 && f.lw >= 0.5;
    case "dvl": return f.green && x.c > f.hi4p && f.vr >= 3 && (f.r15 >= 0.02 || f.c4 >= 0.04); } return false; }
const needX = k => k !== "kap";
function fullK(k, f, oi1, fr){ if (!preK(k, f)) return false; const x = f.x, o = fin(oi1) ? oi1 : NaN, r = fin(fr) ? fr : NaN;
  switch (k){ case "sert": return o >= 0.01 || r >= 0.0005;
    case "sqs": return (r >= 0.0005 && x.c < f.lo4p) || (x.c/f.lo72 - 1 >= 0.30 && r >= 0.0003 && x.c < f.pl1);
    case "dvs": return o <= -0.01 && r >= 0;
    case "lng": return o >= 0.01;
    case "sql": return r <= -0.0003 && o >= 0;
    case "kap": return true;
    case "dvl": return o <= -0.01 && r <= 0.0001; } return false; }
function stopK(k, f){ const x = f.x; return k === "dvs" ? f.hi4*1.0005 : k === "dvl" ? f.lo4*0.9995 : LK[k].side < 0 ? x.h*1.0005 : x.l*0.9995; }
const okR = (side, e, st, maxR) => e > 0 && (st - e)*side < 0 && Math.abs(st - e)/e <= maxR;
/* every rule for one coin → triggers [{ k, side, entry, stop, atr, why }] */
function evalAll(b, oi1, fr, on){ const f = feat(b); if (!f) return []; const out = [];
  for (const l of LISTS){ if (l.ext || (on && on[l.k] === false)) continue; if (!fullK(l.k, f, oi1, fr)) continue; const st = stopK(l.k, f), e = f.x.c; if (!okR(l.side, e, st, l.maxR)) continue;
    out.push({ k: l.k, side: l.side, entry: e, stop: st, atr: f.atr, vr: f.vr, sell: f.sell, oi1, fr, why: `hacim ${f.vr.toFixed(1)}× · satış %${Math.round(f.sell*100)} · 15dk ${(f.r15*100).toFixed(1)}% · OI 1s ${fin(oi1) ? (oi1*100).toFixed(1) + "%" : "—"} · funding ${fin(fr) ? (fr*100).toFixed(3) + "%" : "—"}` }); }
  return out; }
/* generic follow-up for one journal record on 1m bars: main side, mirrored (TERSİ), stopsuz both, TP tracking */
function follow(j, b){ const s = j.side || -1, e = j.entry, st = j.stop, o = {};
  const main = s < 0 ? simExit(e, st, j.atr, b, 60) : simLong(e, 2*e - st, j.atr, b, 60), rev = s < 0 ? simLong(e, st, j.atr, b, 60) : simExit(e, 2*e - st, j.atr, b, 60);
  const put = (r, extra) => r ? Object.assign({ net: r.net, why: r.why, exit: r.exit, t1: j.t + r.bars*60000 }, extra ? { mae: r.mae } : {}) : null;
  o.res = put(main); o.rev = put(rev); o.ns = put(simFree(s, e, st, b, 60), 1); o.nsr = put(simFree(-s, e, st, b, 60), 1); o.tp = tpTrack(s, e, st, b, 60); o.tpr = tpTrack(-s, e, st, b, 60); return o; }
const okRisk = (entry, stop) => entry > 0 && stop > entry && (stop - entry)/entry <= MAXR;
return { LISTS, LK, feat, preK, fullK, needX, stopK, okR, evalAll, follow, kind, universe, order, merge, top, pre, simExit, simLong, simFree, KEYS, levels, tpTrack, stats, okRisk, MAXR, summary, sonuc, ilk, csv, berlin, WHY };
});

if (typeof window !== "undefined" && typeof document !== "undefined") window.SERTS = (() => {
/* v7.32 browser part: ONE full-universe 15m scanner feeds 7 lists on two tabs (SHORT / LONG). Signal only — public Binance reads, no keys, no orders. */
const X = window.SERTX, JK = "mermer.sert.j", OK = "mermer.hx.on", $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fp = v => !isFinite(v) ? "—" : v >= 1000 ? v.toFixed(1) : v >= 10 ? v.toFixed(2) : v >= 1 ? v.toFixed(3) : v >= 0.01 ? v.toFixed(5) : v.toPrecision(4);
const fj = async u => { const r = await fetch("https://fapi.binance.com" + u); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
const R = { sig: new Map(), L: Object.fromEntries(X.LISTS.map(l => [l.k, new Map()])), scanned: 0, slot: 0, busy: false, n: 0, top: [], topAt: 0, want: new Set(), br: null }; /* R.sig = SHORT (SERT) list — simulator/ANALİZ reuse it */
R.L.sert = R.sig;
let ON = (() => { try { return Object.assign(Object.fromEntries(X.LISTS.map(l => [l.k, true])), JSON.parse(localStorage.getItem(OK) || "{}")); } catch(e){ return Object.fromEntries(X.LISTS.map(l => [l.k, true])); } })();
let J = (() => { try { const a = JSON.parse(localStorage.getItem(JK) || "[]"); return Array.isArray(a) ? a.filter(j => j && j.sym && isFinite(j.t) && !(j.res && j.res.skip)).map(j => Object.assign({ k: "sert", side: -1 }, j)) : []; } /* v7.32 migrate: old records = SHORT (SERT) */ catch(e){ return []; } })();
const jSave = () => { try { localStorage.setItem(JK, JSON.stringify(J.slice(-600))); } catch(e){} };
const tm = t => new Date(t).toLocaleTimeString("tr-TR", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
const pct = (x, d = 2) => x === null || !isFinite(x) ? "—" : (x >= 0 ? "+" : "−") + Math.abs(x*100).toFixed(d) + "%";
const mp = x => x === null || !isFinite(x) ? "—" : (x*100).toFixed(2) + "%";
const W = s => s < 0 ? "SHORT" : "LONG";
function list(){ const s = new Set(); try { const S = window.SCALP && SCALP.S; if (S && S.sym) s.add(S.sym); if (S && S.wo) for (const x of S.wo.list) s.add(x); } catch(e){}
  try { const c = localStorage.getItem("neon.can.sym"); if (c) s.add(c); } catch(e){} for (const x of R.want) s.add(x); for (const x of R.top) s.add(x); return [...s].slice(0, 70); }
function livePx(sym){ try { const S = window.SCALP && SCALP.S; if (S && S.sym === sym && S.D && S.D.px > 0) return S.D.px; } catch(e){} try { const p = window.PSIMUI && PSIMUI.px[sym]; if (p > 0) return p; } catch(e){} return NaN; }
const sqOn = sym => { const q = window.SQZ && SQZ.peek(sym); return !!(q && q.on); };
/* live trigger of list k: until the next 15m close, while price has not crossed the stop and DEFTER has not closed it */
function act(k, sym){ const M = R.L[k], r = M && M.get(sym); if (!r) return null; if (Date.now() > r.until){ M.delete(sym); return null; } const p = livePx(sym); if (p > 0 && (p - r.stop)*r.side <= 0) return null; /* price crossed the stop (SHORT: p ≥ SL, LONG: p ≤ SL) */
  const j = J.find(x => x.k === k && x.sym === sym && x.t === r.close); if (j && j.res) return null; return r; }
const active = sym => act("sert", sym);
const line = r => `<div class="sg-dline sert-l"><span>giriş <b>${fp(r.entry)}</b></span> · <span>önerilen SL <b class="dn">${fp(r.stop)}</b></span> · <span>çıkış 1×ATR iz / 60dk · stopsuz: TP2 / 60dk</span> <small class="sert-tag">${esc((X.LK[r.k || "sert"] || X.LK.sert).name)} · kanıtlanmadı</small></div>`;
function big(sym){ const r = active(sym); if (!r || sqOn(sym)) return ""; return `<div class="sert-big dn">GİR SHORT</div>${line(r)}`; }
/* ---- live liquidations: Binance public !forceOrder@arr (all symbols, ≤1 msg/s per symbol). SELL = a long was liquidated. Info only. ---- */
const LQ = new Map(); let lws = null, lwsT = 0;
function liqOpen(){ if (lws && lws.readyState < 2) return; try { lws = new WebSocket("wss://fstream.binance.com/ws/!forceOrder@arr");
    lws.onmessage = ev => { try { const d = JSON.parse(ev.data), a = Array.isArray(d) ? d : [d]; for (const m of a){ const o = m.o || m; if (!o || !o.s) continue; const usd = (+o.ap || +o.p)*(+o.z || +o.q); if (!(usd > 0)) continue;
        const L = LQ.get(o.s) || []; L.push({ t: +o.T || Date.now(), usd, long: o.S === "SELL" }); LQ.set(o.s, L); } } catch(e){} };
    lws.onclose = e => { if (e && e.code === 4000) return; clearTimeout(lwsT); lwsT = setTimeout(liqOpen, 15000); }; } catch(e){} }
function liq(sym, ms = 900000){ const L = (LQ.get(sym) || []).filter(x => x.t > Date.now() - ms); LQ.set(sym, L); let lo = 0, sh = 0; for (const x of L) x.long ? lo += x.usd : sh += x.usd; return { lo, sh }; }
const usdK = v => v >= 1e6 ? "$" + (v/1e6).toFixed(1) + "M" : v >= 1e3 ? "$" + (v/1e3).toFixed(0) + "k" : "$" + Math.round(v);
const liqTxt = sym => { const q = liq(sym); return q.lo + q.sh > 0 ? `lik. 15dk: long ${usdK(q.lo)} · short ${usdK(q.sh)}` : ""; };
/* ---- scanner ---- */
const C = new Map();
async function bars15(s){ const now = Date.now(), lastT = Math.floor(now/900000)*900000 - 900000, o = C.get(s), inc = o && o.length >= 101 && o[o.length - 1].t >= lastT - 4*900000;
  const k = await fj(`/fapi/v1/klines?symbol=${s}&interval=15m&limit=${inc ? 6 : 300}`), nb = k.filter(x => +x[6] < now).map(x => ({ t: +x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4], qv: +x[7], tb: +x[10] }));
  const b = inc ? X.merge(o, nb, 300) : nb.slice(-300); C.set(s, b); return b; }
async function one(s){ const b = await bars15(s), f = X.feat(b); const ks = SCAN.filter(l => ON[l.k] !== false && X.preK(l.k, f)).map(l => l.k);
  if (f && X.preK("sert", f)) R.brN = (R.brN || 0) + 1; if (f) R.brD = (R.brD || 0) + 1;
  if (!ks.length){ for (const l of SCAN) R.L[l.k].delete(s); return; } const last = b[b.length - 1], cT = last.t + 900000; let oi1 = NaN, fr = NaN;
  if (ks.some(X.needX)){ const [oh, on, fq] = await Promise.all([fj(`/futures/data/openInterestHist?symbol=${s}&period=15m&limit=8`).catch(() => []), fj(`/fapi/v1/openInterest?symbol=${s}`).catch(() => null), fj(`/fapi/v1/fundingRate?symbol=${s}&limit=1`).catch(() => [])]);
    const ago = (oh || []).filter(x => +x.timestamp <= cT - 3600000).pop(), oiNow = on ? +on.openInterest : NaN; oi1 = ago && oiNow > 0 ? oiNow/(+ago.sumOpenInterest) - 1 : NaN; fr = fq && fq[0] ? +fq[0].fundingRate : NaN; }
  R.cand = (R.cand || 0) + 1; const T = X.evalAll(b, oi1, fr, ON), got = new Set(T.map(t => t.k));
  for (const t of T){ Object.assign(t, { sym: s, close: cT, until: cT + 900000, t: last.t }); R.L[t.k].set(s, t); }
  for (const l of SCAN) if (!got.has(l.k)) R.L[l.k].delete(s); if (T.length) paintLists(); }
const KIND = {}; let kindAt = 0, UNI = [], VOL = {}, volAt = 0;
async function loadKinds(){ if (Date.now() - kindAt < 6*3600000) return; try { const ei = await fj("/fapi/v1/exchangeInfo"); for (const s of ei.symbols){ const k = X.kind(s); if (k) KIND[s.symbol] = k; } UNI = X.universe(ei); kindAt = Date.now(); } catch(e){} }
const ktag = sym => KIND[sym] ? ` <small class="sert-k">${KIND[sym]}</small>` : "";
const sleep = ms => new Promise(z => setTimeout(z, ms));
const SCAN = X.LISTS.filter(l => !l.ext); /* scanner-owned lists (TOPLAMA / DAĞITIM come from agg.js) */
const anyOn = () => X.LISTS.some(l => ON[l.k] !== false);
/* full pass over every TRADING perpetual (~810): 5 workers, 650 ms gap → ~6 req/s; OI/funding only for bar-level candidates. 429/418 → pause 60 s */
async function scan(force){ const slot = Math.floor(Date.now()/900000); if (R.busy || (!force && slot === R.slot) || !anyOn()) return; R.busy = true; R.slot = slot; R.t0 = Date.now();
  await loadKinds(); try { if (Date.now() - volAt > 3600000){ for (const x of await fj("/fapi/v1/ticker/24hr")) VOL[x.symbol] = +x.quoteVolume; volAt = Date.now(); } } catch(e){}
  const L = X.order(UNI.length ? UNI : list(), list(), VOL); R.n = R.total = L.length; R.done = 0; R.cand = 0; R.brN = 0; R.brD = 0; let i = 0, lastP = 0;
  const work = async () => { while (i < L.length){ while (R.pause > Date.now()) await sleep(1000); const s = L[i++];
      try { await one(s); } catch(e){ if (/HTTP (429|418)/.test(e.message)){ R.e429 = (R.e429 || 0) + 1; R.pause = Date.now() + 60000; L.push(s); continue; } }
      R.done++; if (Date.now() - lastP > 1500){ lastP = Date.now(); paintLists(); } await sleep(650); } };
  await Promise.all([work(), work(), work(), work(), work()]); R.scanned = Date.now(); R.dur = R.scanned - R.t0; R.busy = false; R.br = R.brD ? R.brN/R.brD : null;
  const nw = []; for (const k in R.L) for (const r of R.L[k].values()) if (!J.some(j => j.k === k && j.sym === r.sym && j.t === r.close)) nw.push(r);
  const go = (await Promise.all(nw.map(fresh))).filter(Boolean); alertAll(go); resolve(); paint(); window.dispatchEvent(new CustomEvent("sert:update")); }
/* new trigger → DEFTER (+ breadth at that scan). Squeeze-risk coins never get GİR SHORT (record kept, flagged "sq") */
async function fresh(r){ const j = { k: r.k, side: r.side, sym: r.sym, t: r.close, entry: r.entry, stop: r.stop, atr: r.atr, br: R.br === null ? undefined : +R.br.toFixed(3) }; J.push(j); jSave();
  if (r.side < 0 && window.SQZ){ SQZ.get(r.sym); for (let k = 0; k < 24 && !SQZ.peek(r.sym); k++) await sleep(250); if (sqOn(r.sym)){ j.sq = 1; jSave(); return null; } } return r; }
function alertAll(L){ for (const side of [-1, 1]){ const A = L.filter(r => r.side === side); if (!A.length) continue; const cs = A.map(r => r.sym.replace("USDT", "")), w = "GİR " + W(side);
  try { window.NOTIFY && NOTIFY.toast(`${w} · ${cs.slice(0, 4).join(", ")}${cs.length > 4 ? ` +${cs.length - 4}` : ""} → ${W(side)}`, side < 0 ? "bad" : "good"); } catch(e){}
  try { window.SCALP && SCALP.extAlert && SCALP.extAlert(`${w} · ${A.length === 1 ? cs[0] : cs.length + " coin"}`, `${cs.join(", ")} · 15dk · ${W(side)} sekmesinde giriş/SL/TP (kanıtlanmadı)`, "neon-sert"); } catch(e){} } }
/* DEFTER follow-up on 1m bars (every minute, every tab while open; back-fills on reopen/resume) */
let resBusy = false;
async function resolve(){ if (resBusy) return; resBusy = true; let n = 0;
  for (const j of J){ /* v8.0: records resolved before the gap-fill fix (no gf) get their trailing results (res / rev) recomputed once — they may get worse */
    const re = !j.gf && !!(j.res || j.rev); if ((!re && j.res && j.rev && j.tp && j.tpr && j.ns && j.nsr) || Date.now() < j.t + 60000 || n >= 20) continue; n++;
    if (re){ delete j.res; delete j.rev; }
    try { const k = await fj(`/fapi/v1/klines?symbol=${j.sym}&interval=1m&startTime=${j.t}&limit=60`); const b = k.map(x => ({ t: +x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4], T: +x[6] })).filter(x => x.t >= j.t && x.T < Date.now());
      const o = X.follow(j, b); for (const key of ["res", "rev", "ns", "nsr", "tp", "tpr"]) if (!j[key] && o[key]) j[key] = o[key]; if (j.res || j.rev) j.gf = 1;
      if (!b.length && Date.now() > j.t + 3*86400000) j.skip = 1; } catch(e){} await sleep(80); }
  J = J.filter(j => !j.skip); jSave(); resBusy = false; if (n) paint(); }
function liveLine(){ const s = X.stats(J.filter(j => j.k === "sert")), pc = x => x === null ? "—" : "%" + Math.round(x*100);
  return `SERT SHORT canlı: ${s.n} işlem · kazanma ${pc(s.winRate)} · ort ${s.avg === null ? "—" : (s.avg >= 0 ? "+" : "") + (s.avg*100).toFixed(2) + "%"} (ücret dahil)${s.open ? ` · ${s.open} takipte` : ""}`; }
/* ---- UI: per tab → scanner status · one block per list · selected trigger (big verdict + chart) · DEFTER (list chooser, STOPLU | STOPSUZ) ---- */
const TABS = { short: X.LISTS.filter(l => l.tab === "short"), long: X.LISTS.filter(l => l.tab === "long") };
const SEL = { short: null, long: null }, JSEL = { short: "sert", long: "sql" }, CH = { sym: "", b: null, at: 0 };
const MK = "mermer.sert.mode"; let MODE = (() => { try { return localStorage.getItem(MK) === "STOPLU" ? "STOPLU" : "STOPSUZ"; } catch(e){ return "STOPSUZ"; } })();
function status(){ return !anyOn() ? "tüm listeler PASİF — tarama durdu" : window.SEC && !SEC.on("short") ? "PASİF — tarama durdu" : R.busy ? `taranan ${R.done || 0}/${R.total || "…"}` : `${R.n} kontrat · ${R.scanned ? tm(R.scanned) : "taranıyor…"}${R.br !== null && R.br !== undefined ? ` · genişlik %${(R.br*100).toFixed(1)}` : ""}`; }
/* v7.33.3: how many triggers this list logged in DEFTER in the last 24 h (+ last time), so "şu an tetik yok" is not mistaken for a dead scanner */
function last24(k){ const now = Date.now(), L = J.filter(j => (j.k || "sert") === k && now - j.t < 86400000); return ` <small class="dim hx-24">24s: ${L.length}${L.length ? " · son " + tm(Math.max(...L.map(j => j.t))) : ""}</small>`; }
function rowsOf(k){ return [...R.L[k].keys()].map(s => act(k, s)).filter(Boolean); }
function paintLists(){ for (const tab of ["short", "long"]){ const el = $(`#hx-${tab}`); if (!el) continue;
    const sel = SEL[tab]; if (sel && !act(sel.k, sel.sym)) SEL[tab] = null;
    if (!SEL[tab]) for (const l of TABS[tab]){ const r = rowsOf(l.k).find(r => !(r.side < 0 && sqOn(r.sym))); if (r){ SEL[tab] = { k: l.k, sym: r.sym }; break; } }
    el.innerHTML = `<div class="hx-st dim">${status()}</div>` + TABS[tab].map(l => { const on = ON[l.k] !== false, rows = on ? rowsOf(l.k) : [];
      return `<div class="hx-l${on ? "" : " off"}"><div class="hx-lh"><b class="${l.side < 0 ? "dn" : "up"}">${esc(l.name)}</b> <small class="dim">kanıtlanmadı</small>${last24(l.k)}<button type="button" class="sec-tg hx-tg${on ? "" : " off"}" data-hxon="${l.k}">${on ? "AKTİF" : "PASİF"}</button></div>
        <div class="hx-sub dim">${esc(l.sub)} · ${esc(l.bt)}</div>`
        + (!on ? "" : rows.length ? rows.map(r => { const q = r.side < 0 && sqOn(r.sym), opened = window.PSIMUI && PSIMUI.st.pos.some(p => p.rule === r.k && p.sym === r.sym), L = X.levels(r.entry, r.stop, r.side), on2 = SEL[tab] && SEL[tab].k === r.k && SEL[tab].sym === r.sym, lq = r.k[0] === "d" ? liqTxt(r.sym) : "";
          return `<div class="sert-r${on2 ? " on" : ""}" data-hxgo="${r.k}|${esc(r.sym)}" role="button" tabindex="0"><b class="${q ? "y" : r.side < 0 ? "dn" : "up"}">${esc(r.sym.replace("USDT", ""))}${ktag(r.sym)}</b><span>${q ? "SHORT GİRME · squeeze" : `giriş ${fp(r.entry)} · SL ${fp(r.stop)} · TP1 ${fp(L.tp1)} · TP2 ${fp(L.tp2)}${lq ? ` · ${lq}` : ""}`}</span>${q ? "" : opened ? `<small class="dim">simde</small>` : `<button type="button" class="mini" data-hxsim="${r.k}|${esc(r.sym)}">SİMDE AÇ</button>`}</div>`; }).join("")
          : `<div class="dim hx-none">şu an tetik yok</div>`) + `</div>`; }).join(""); } }
function tpLine(r){ const L = X.levels(r.entry, r.stop, r.side); return `<div class="sg-dline sert-tp">Önerilen <span>SL <b class="dn">${fp(r.stop)}</b></span> · <span>TP1 <b class="up">${fp(L.tp1)}</b></span> · <span>TP2 <b class="up">${fp(L.tp2)}</b></span> <small class="dim">veya 1×ATR iz / 60dk</small></div>`; }
function paintDet(tab){ const el = $(`#hx-det-${tab}`); if (!el) return; const s = SEL[tab], r = s && act(s.k, s.sym);
  if (!r){ el.innerHTML = ""; el.hidden = true; return; } el.hidden = false; const q = r.side < 0 && sqOn(r.sym), c = r.sym.replace("USDT", ""), l = X.LK[r.k], lq = liqTxt(r.sym);
  el.innerHTML = `<div class="sert-coin">${esc(c)}${ktag(r.sym)} <small class="dim">${esc(l.name)} · 15dk · ${tm(r.close)} · kanıtlanmadı</small></div>` + (q ? `<div class="sert-big y">SHORT GİRME</div>${window.SQZ ? SQZ.html(r.sym) : ""}` : `<div class="sert-big ${r.side < 0 ? "dn" : "up"}">GİR ${W(r.side)}</div>${line(r)}${tpLine(r)}`)
    + `<div class="hx-why dim">${esc(r.why)}${lq ? " · " + lq : ""}</div><canvas id="hx-cv-${tab}" class="az-cv" aria-label="15dk mum grafiği: giriş, stop, iz"></canvas>`;
  chartFor(r, tab); }
async function chartFor(r, tab){ if (CH.sym !== r.sym || Date.now() - CH.at > 30000){ try { const k = await fj(`/fapi/v1/klines?symbol=${r.sym}&interval=15m&limit=48`); CH = { sym: r.sym, at: Date.now(), b: k.map(x => ({ t: +x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4] })) }; } catch(e){ return; } }
  draw($(`#hx-cv-${tab}`), CH.b, r); }
function draw(cv, b, r){ if (!cv || !b || !b.length) return; const w = cv.clientWidth || 340, h = cv.clientHeight || 200, dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = w*dpr; cv.height = h*dpr;
  const g = cv.getContext("2d"); g.scale(dpr, dpr); const sd = r.side || -1, after = b.filter(x => x.t >= r.close), ex = after.length ? (sd < 0 ? Math.min(...after.map(x => x.l)) : Math.max(...after.map(x => x.h))) : r.entry, iz = sd < 0 ? Math.min(r.stop, ex + r.atr) : Math.max(r.stop, ex - r.atr);
  const T = X.levels(r.entry, r.stop, sd), lv = [["SL", r.stop, "#9b1c31"], ["giriş", r.entry, "#1e3a5f"], ["iz", iz, "#9a7432"], ["TP1", T.tp1, "#0f6b45"], ["TP2", T.tp2, "#0f6b45"]], hi = Math.max(...b.map(x => x.h), r.stop, T.tp2), lo = Math.min(...b.map(x => x.l), T.tp2, r.stop), pad = (hi - lo)*0.14 || hi*0.01;
  const R0 = 64, cw = (w - R0 - 6)/b.length, Y = v => 6 + (hi + pad - v)/(hi - lo + 2*pad)*(h - 12), dark = document.documentElement.classList.contains("night");
  g.clearRect(0, 0, w, h); b.forEach((x, i) => { const X0 = 3 + i*cw + cw/2, up = x.c >= x.o; g.strokeStyle = g.fillStyle = up ? "#0f6b45" : "#9b1c31"; g.beginPath(); g.moveTo(X0, Y(x.h)); g.lineTo(X0, Y(x.l)); g.stroke();
    const y1 = Y(Math.max(x.o, x.c)), y2 = Y(Math.min(x.o, x.c)); g.fillRect(X0 - Math.max(1, cw*0.35), y1, Math.max(2, cw*0.7), Math.max(1, y2 - y1)); if (x.t + 900000 === r.close){ g.strokeStyle = dark ? "#d6b171" : "#9a7432"; g.strokeRect(X0 - cw*0.6, Y(x.h) - 3, cw*1.2, Y(x.l) - Y(x.h) + 6); } });
  g.font = "11px system-ui, sans-serif"; let lastY = -99; lv.sort((a, b2) => b2[1] - a[1]).forEach(([t, v, col]) => { const y = Y(v); g.strokeStyle = col; g.setLineDash(t === "giriş" ? [] : [5, 4]); g.beginPath(); g.moveTo(0, y); g.lineTo(w - R0, y); g.stroke(); g.setLineDash([]);
    const ty = Math.min(h - 9 - (lv.length - 1 - lv.findIndex(q => q[0] === t))*15, Math.max(y, lastY + 15)); lastY = ty; g.fillStyle = col; g.fillRect(w - R0 + 2, ty - 8, R0 - 4, 16); g.fillStyle = "#fff"; g.fillText(`${t} ${fp(v)}`.slice(0, 11), w - R0 + 5, ty + 4); }); }
function sumLine(lab, S, cls, free){ const pc = x => x === null ? "—" : "%" + Math.round(x*100), sg = x => x > 0 ? "up" : x < 0 ? "dn" : "";
  return `<div class="sert-sum${cls}"><span><b${lab[1] ? ` class="${lab[1]}"` : ""}>${lab[0]}</b></span>${lab[2] ? `<span>toplam <b>${S.toplam}</b></span><span>doğru <b class="up">${S.dogru}</b></span><span>yanlış <b class="dn">${S.yanlis}</b></span>${S.acik ? `<span>açık <b>${S.acik}</b></span>` : ""}` : ""}<span>kazanma <b>${pc(S.kazanma)}</b></span><span>ort net <b class="${sg(S.ort)}">${pct(S.ort)}</b></span><span>toplam net <b class="${sg(S.net)}">${S.toplam - S.acik ? pct(S.net) : "—"}</b></span>${free ? `<span>ort MAE <b class="dn">${mp(S.maeOrt)}</b></span><span>en kötü MAE <b class="dn">${mp(S.maeMax)}</b></span>` : `<span>TP1 <b>${pc(S.tp1)}</b></span><span>TP2 <b>${pc(S.tp2)}</b></span>`}</div>`; }
const JL = k => J.filter(j => (j.k || "sert") === k);
function paintJ(tab){ const el = $(`#hx-j-${tab}`); if (!el) return; const lk = JSEL[tab], l = X.LK[lk], JJ = JL(lk), [k, kr] = X.KEYS[MODE], free = MODE === "STOPSUZ", w = W(l.side), wr = W(-l.side);
  const rows = JJ.slice().sort((a, b) => b.t - a.t).slice(0, 100).map(j => { const s = X.sonuc(j, k), r = j[k], v = j[kr]; return `<tr><td>${esc(X.berlin(j.t).slice(5))}</td><td><b>${esc(j.sym.replace("USDT", ""))}</b>${ktag(j.sym)}${j.sq ? ` <small class="y">sq</small>` : ""}</td><td>${fp(j.entry)}</td><td class="dim">${fp(j.stop)}</td><td class="${s === "DOĞRU" ? "up" : s === "YANLIŞ" ? "dn" : "dim"}">${s}</td><td>${r || (!free && j.tp) ? esc(X.ilk(j, k)) : "—"}</td><td class="${r ? (r.net > 0 ? "up" : "dn") : "dim"}">${r ? pct(r.net) : "—"}</td><td class="dn">${j.ns ? mp(j.ns.mae) : "—"}</td><td class="sert-rev ${v ? (v.net > 0 ? "up" : "dn") : "dim"}">${v ? `${v.net > 0 ? "D" : "Y"} ${pct(v.net)} · ${esc(X.ilk(j, kr))}` : "—"}</td></tr>`; }).join("");
  el.innerHTML = `<div class="sert-h">DEFTER <small class="dim">her tetik otomatik · DOĞRU = net &gt; 0 (%0.10 ücret dahil) · STOPLU: SL / 1×ATR iz / 60dk · STOPSUZ: SL yok, TP2 ya da 60dk · MAE = en çok ters gidiş</small></div>
    <div class="sert-mode hx-jl">${TABS[tab].map(x => `<button type="button" class="mini${x.k === lk ? " on" : ""}" data-hxj="${tab}|${x.k}">${esc(x.name)} <small>${JL(x.k).length}</small></button>`).join("")}</div>
    <div class="sert-mode">Defter modu: <button type="button" class="mini${MODE === "STOPLU" ? " on" : ""}" data-smode="STOPLU">STOPLU</button><button type="button" class="mini${free ? " on" : ""}" data-smode="STOPSUZ">STOPSUZ</button></div>
    ${sumLine([`${w} · STOPLU`, l.side < 0 ? "dn" : "up", !free], X.summary(JJ, "res"), free ? " sert-sum2" : "", false)}
    ${sumLine([`${w} · STOPSUZ`, l.side < 0 ? "dn" : "up", free], X.summary(JJ, "ns"), free ? "" : " sert-sum2", true)}
    ${sumLine([`TERSİ (${wr}) · ${MODE}`, "", false], X.summary(JJ, kr), " sert-sum2", free)}
    ${rows ? `<div class="sert-tw"><table class="sert-t"><tr><th>zaman</th><th>coin</th><th>giriş</th><th>önerilen SL</th><th>sonuç (${MODE})</th><th>çıkış</th><th>net</th><th>MAE</th><th>TERSİ (${wr})</th></tr>${rows}</table></div>` : `<div class="dim">henüz kayıt yok</div>`}
    <div class="sert-btns"><button type="button" class="mini" data-hxcsv="${lk}"${JJ.length ? "" : " disabled"}>CSV dışa aktar</button><button type="button" class="mini" data-hxclr="${lk}"${JJ.length ? "" : " disabled"}>temizle</button></div>`; }
function navMarks(){ for (const tab of ["short", "long"]){ const b = document.querySelector(`#nav button[data-go="${tab}"]`); if (b) b.classList.toggle("sec-off", !TABS[tab].some(l => ON[l.k] !== false)); } }
function paint(){ paintLists(); paintPos(); const pg = document.body.dataset.pg; if (pg === "short" || pg === "long") paintDet(pg); paintJ("short"); paintJ("long"); navMarks(); }
const paintList = paintLists;
async function exportCsv(k){ const txt = "\ufeff" + X.csv(JL(k)), name = `mermer-${k}-defter-${X.berlin(Date.now()).slice(0, 10)}.csv`;
  try { const f = new File([txt], name, { type: "text/csv" }); if (navigator.canShare && navigator.canShare({ files: [f] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)){ await navigator.share({ files: [f], title: name }); return; } } catch(e){ if (e && e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  try { window.NOTIFY && NOTIFY.toast("✔ CSV: " + name, "good"); } catch(e){} }
function clearJ(k){ const n = JL(k).length; if (!confirm(`${X.LK[k].name} DEFTERİ TEMİZLENSİN Mİ?\n${n} kayıt silinir (CSV ile önce dışa aktarabilirsin). Diğer listeler, simülatör ve gerçek hesap etkilenmez.`)) return; J = J.filter(j => (j.k || "sert") !== k); jSave(); paint(); }
/* v7.33.2: SİMDE AÇ stays on this tab (no tab switch, no scroll): inline confirmation + AÇIK SANAL POZİSYONLAR block below. Paper only. */
const NOTE = { short: "", long: "" };
async function simOpen(k, sym){ const tab = X.LK[k].tab, y = window.scrollY; try { const r = act(k, sym); if (!r) throw new Error("tetik süresi doldu"); if (!window.PSIMUI) throw new Error("simülatör yok");
    if (!(PSIMUI.px[sym] > 0)){ const t = await fj(`/fapi/v1/ticker/price?symbol=${sym}`); PSIMUI.px[sym] = +t.price; } const q = k === "sert" ? PSIMUI.sertOpen(sym) : PSIMUI.ruleOpen(r);
    NOTE[tab] = q ? `✔ SİM açıldı: ${sym.replace("USDT", "")} ${W(q.side)} ${q.lev}x @ ${fp(q.entry)} (sanal, gerçek emir yok)` : ""; } catch(e){ NOTE[tab] = "✖ " + e.message; }
  clearTimeout(NOTE["t" + tab]); NOTE["t" + tab] = setTimeout(() => { NOTE[tab] = ""; paintPos(); }, 8000); paintLists(); paintPos(); requestAnimationFrame(() => { if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y); }); }
function paintPos(){ const P = window.PSIM, U = window.PSIMUI; for (const tab of ["short", "long"]){ const el = $(`#hx-pos-${tab}`); if (!el) continue; const L = U ? U.st.pos : [];
    el.innerHTML = (NOTE[tab] ? `<div class="hx-note ${NOTE[tab][0] === "✔" ? "up" : "dn"}">${esc(NOTE[tab])}</div>` : "") + (L.length ? `<div class="sert-h">AÇIK SANAL POZİSYONLAR <small class="dim">${L.length} · VADELİ simülatörü ile aynı · gerçek emir yok</small></div>` + L.map(q => { const c = U.px[q.sym], u = c && P ? P.upnl(q, c) : NaN, roe = isFinite(u) ? u/q.margin : NaN, nm = q.rule && X.LK[q.rule] ? X.LK[q.rule].name : q.rule === "sert" ? "SHORT" : (q.sig && q.sig.word) || "elle";
      return `<div class="hx-pos ${q.side > 0 ? "up" : "dn"}"><b>${esc(q.sym.replace("USDT", ""))} ${W(q.side)} ${q.lev}x</b> <small class="dim">${esc(nm)}</small><span>giriş ${fp(q.entry)} → ${c ? fp(c) : "—"} · <b class="${u >= 0 ? "up" : "dn"}">${isFinite(u) ? (u >= 0 ? "+" : "−") + Math.abs(u).toFixed(2) + " USDT (" + pct(roe, 1) + ")" : "—"}</b></span><span class="dim">SL ${q.stop ? fp(q.stop) : "—"} · TP ${q.tp ? fp(q.tp) : "—"}${q.trail ? " · iz " + fp(q.trail) : ""}</span><button type="button" class="mini" data-hxpc="${q.id}">kapat</button></div>`; }).join("") : ""); } }
function setOn(k, v){ ON[k] = v; try { localStorage.setItem(OK, JSON.stringify(ON)); } catch(e){} if (!v) R.L[k].clear();
  if (window.SEC){ const want = anyOn(); if (SEC.on("short") !== want) SEC.set("short", want); } /* scanner (and its sockets/timers) stop only when every list is PASİF */
  else if (v) scan(true); paint(); try { window.NOTIFY && NOTIFY.toast(`${X.LK[k].name} ${v ? "AKTİF" : "PASİF"}`, v ? "good" : "info"); } catch(e){} }
function show(){ paint(); }
function onClick(e){ const t = e.target;
  const o = t.closest("[data-hxon]"); if (o){ e.stopPropagation(); setOn(o.dataset.hxon, ON[o.dataset.hxon] === false); return; }
  const s = t.closest("[data-hxsim]"); if (s){ e.stopPropagation(); const [k, y] = s.dataset.hxsim.split("|"); simOpen(k, y); return; }
  const g = t.closest("[data-hxgo]"); if (g){ const [k, y] = g.dataset.hxgo.split("|"), tab = X.LK[k].tab; SEL[tab] = { k, sym: y }; paintLists(); paintDet(tab); const d = $(`#hx-det-${tab}`); d && d.scrollIntoView({ behavior: "smooth", block: "nearest" }); return; }
  const jl = t.closest("[data-hxj]"); if (jl){ const [tab, k] = jl.dataset.hxj.split("|"); JSEL[tab] = k; paintJ(tab); return; }
  const m = t.closest("[data-smode]"); if (m){ MODE = m.dataset.smode; try { localStorage.setItem(MK, MODE); } catch(x){} paintJ("short"); paintJ("long"); return; }
  const pc = t.closest("[data-hxpc]"); if (pc){ e.stopPropagation(); if (window.PSIMUI) PSIMUI.closePos(pc.dataset.hxpc); paintPos(); return; }
  const c = t.closest("[data-hxcsv]"); if (c){ exportCsv(c.dataset.hxcsv); return; } const z = t.closest("[data-hxclr]"); if (z){ clearJ(z.dataset.hxclr); return; } }
function init(){ for (const id of ["#short", "#long"]){ const el = $(id); if (el) el.addEventListener("click", onClick); }
  paint(); liqOpen(); if (window.SEC && SEC.on("short") !== anyOn()) SEC.set("short", anyOn());
  setTimeout(() => scan(true), 3000); setTimeout(resolve, 5000);
  setInterval(() => { if (Math.floor(Date.now()/900000) !== R.slot && Date.now() % 900000 > 4000) scan(false); else paintLists(); }, 10000); setInterval(resolve, 60000);
  setInterval(() => { const pg = document.body.dataset.pg; if ((pg === "short" || pg === "long") && !document.hidden && SEL[pg]) paintDet(pg); }, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) resolve(); });
  window.addEventListener("sqz:update", () => paintLists()); window.addEventListener("psim:change", () => paintPos()); setInterval(() => { const pg = document.body.dataset.pg; if ((pg === "short" || pg === "long") && !document.hidden && window.PSIMUI && PSIMUI.st.pos.length) paintPos(); }, 3000);
  window.addEventListener("sec:change", e => { if (e.detail && e.detail.sec === "short"){ if (e.detail.on){ liqOpen(); resolve(); scan(true); } paint(); } });
  window.addEventListener("themechange", () => { const pg = document.body.dataset.pg; if (pg === "short" || pg === "long") paintDet(pg); }); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
async function push(r){ if (!R.L[r.k] || ON[r.k] === false || !/USDT$/.test(r.sym || "")) return; r.sym = r.sym; R.L[r.k].set(r.sym, r); if (!J.some(j => j.k === r.k && j.sym === r.sym && j.t === r.close)){ const g = await fresh(r); if (g) alertAll([g]); } paint(); } /* v7.33 external lists (TOPLAMA / DAĞITIM) */
return { R, ON, push, scan, active, act, big, line, sqOn, paint, paintList, show, resolve, liq, setOn, select: (s, k = "sert") => { SEL[X.LK[k].tab] = { k, sym: s }; paint(); }, _fresh: fresh, want: s => { if (s) R.want.add(s); }, get J(){ return J; }, liveLine };
})();
