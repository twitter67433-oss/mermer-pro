/* MERMER TERMİNAL v7.20 — SANAL SİNYAL DEFTERİ (virtual signal journal). Pure logic, no DOM, no network. Exported as JRN.
   PAPER TRACKING ONLY: it records what the SİNYAL tab said (GİR LONG / GİR SHORT, and BEKLE triggers that actually fired) and follows the
   price to see whether target or stop came first. It never places an order, never touches keys or a wallet.
   Rules: entry = signal price; target first → DOĞRU, stop first → YANLIŞ; if one candle touched both, STOP counts first (conservative);
   no hit within 20 candles of the signal's interval → closed at the last price ("SÜRE"), DOĞRU only if net > 0. Net % includes 0.10 % round-trip fee. */
"use strict";
(function (root, factory){ const M = factory(); if (typeof module === "object" && module.exports) module.exports = M; else root.JRN = M; })(typeof self !== "undefined" ? self : this, function (){
const FEE = 0.10, MAXN = 500, TOUT = 20, fin = x => typeof x === "number" && isFinite(x);
const TFMS = { "1m": 6e4, "3m": 18e4, "5m": 3e5, "15m": 9e5, "30m": 18e5, "1h": 36e5, "2h": 72e5, "4h": 144e5, "6h": 216e5, "8h": 288e5, "12h": 432e5, "1d": 864e5 };
const netPct = (d, entry, exit, fee = FEE) => d*(exit - entry)/entry*100 - fee;
/* new trade object (validated: stop and target on the correct sides) */
function make(o){ const d = o.d > 0 ? 1 : -1, e = +o.entry, st = +o.stop, tp = +o.tp; if (!fin(e) || !fin(st) || !fin(tp) || e <= 0) return null;
  if (d > 0 ? !(st < e && tp > e) : !(st > e && tp < e)) return null; const t = +o.t || Date.now(), ms = TFMS[o.tf] || 9e5;
  return { id: o.id || (t.toString(36) + Math.random().toString(36).slice(2, 6)), t, sym: String(o.sym), tf: o.tf, d, entry: e, stop: st, tp, type: o.type || "A+", why: o.why || "", src: o.src || "karar",
    exp: t + TOUT*ms, chk: t, st: "open", hi: e, lo: e }; }
/* add with dedupe: same coin + interval + direction is not re-opened while one is open */
function add(list, tr){ if (!tr) return { list, added: false, why: "geçersiz" }; if (list.some(x => x.st === "open" && x.sym === tr.sym && x.tf === tr.tf && x.d === tr.d)) return { list, added: false, why: "açık var" };
  let L = [tr].concat(list); if (L.length > MAXN){ const open = L.filter(x => x.st === "open"), closed = L.filter(x => x.st !== "open").sort((a, b) => b.t - a.t); L = open.concat(closed).slice(0, MAXN).sort((a, b) => b.t - a.t); }
  return { list: L, added: true }; }
function close(tr, how, px, at){ tr.st = "closed"; tr.how = how; tr.exit = px; tr.cT = at; tr.net = netPct(tr.d, tr.entry, px); tr.ok = how === "TP" ? true : how === "SL" ? false : tr.net > 0; return tr; }
/* resolve with candles (sorted, each {t,h,l,c,T}); candles that started before the entry are skipped (their pre-entry part is unknown; live ticks cover the entry candle); a candle is used if it ends after the last check.
   Inside one candle the order of high and low is unknown → if both stop and target are touched, STOP wins. */
function resolveBars(tr, bars, now = Date.now()){ if (!tr || tr.st !== "open") return tr;
  for (const b of bars){ if (b.t < tr.t || (b.T || b.t) < tr.chk) continue; if (b.t > tr.exp) break; const hs = tr.d > 0 ? b.l <= tr.stop : b.h >= tr.stop, ht = tr.d > 0 ? b.h >= tr.tp : b.l <= tr.tp;
    tr.hi = Math.max(tr.hi, b.h); tr.lo = Math.min(tr.lo, b.l);
    if (hs) return close(tr, "SL", tr.stop, Math.min(b.T || b.t, now)); if (ht) return close(tr, "TP", tr.tp, Math.min(b.T || b.t, now));
    if ((b.T || b.t) < now) tr.chk = (b.T || b.t) + 1; tr.last = b.c; }
  return expire(tr, now); }
/* live price tick */
function tick(tr, px, now = Date.now()){ if (!tr || tr.st !== "open" || !fin(px)) return tr; tr.last = px; tr.hi = Math.max(tr.hi, px); tr.lo = Math.min(tr.lo, px);
  if (tr.d > 0 ? px <= tr.stop : px >= tr.stop) return close(tr, "SL", tr.stop, now); if (tr.d > 0 ? px >= tr.tp : px <= tr.tp) return close(tr, "TP", tr.tp, now); return expire(tr, now); }
function expire(tr, now){ if (tr.st === "open" && now >= tr.exp && fin(tr.last)) close(tr, "SÜRE", tr.last, tr.exp); return tr; }
/* which kline interval to use to fill a gap from tr.chk to now (≤1500 candles) */
function gapTf(from, now){ for (const t of ["1m", "5m", "15m", "1h", "4h", "1d"]) if ((now - from)/TFMS[t] <= 1400) return t; return "1d"; }
/* has a BEKLE trigger fired on a just-closed candle? trig = {d, k:"kırılım", lv} or {d, k:"geri çekilme", a, b}; bar = closed candle */
function trigFired(trig, bar){ if (!trig || !bar) return null; const d = trig.d;
  if (trig.k === "kırılım" && fin(trig.lv)) return (d > 0 ? bar.c > trig.lv : bar.c < trig.lv) ? { entry: bar.c } : null;
  if (trig.k === "geri çekilme" && fin(trig.a) && fin(trig.b)) return (d > 0 ? bar.l <= trig.b : bar.h >= trig.a) ? { entry: d > 0 ? Math.min(trig.b, bar.o) : Math.max(trig.a, bar.o) } : null;
  return null; }
/* v7.20 "aynı anda açılanları tek say": same coin + same direction opened within the same minute (any interval) = ONE unit.
   A unit is open while any member is open; closed unit: net = mean of members, DOĞRU if most members were (tie → mean net > 0). */
function units(L){ const g = new Map(); for (const x of L){ const k = x.sym + "|" + x.d + "|" + Math.floor(x.t/6e4); if (!g.has(k)) g.set(k, []); g.get(k).push(x); }
  return [...g.values()].map(m => { if (m.length === 1) return m[0]; const open = m.some(x => x.st === "open"), hows = [...new Set(m.map(x => x.how))];
    const u = { ...m[0], tf: m.map(x => x.tf).join("+"), n: m.length, members: m.map(x => x.id) };
    if (open){ u.st = "open"; return u; } const net = m.reduce((s, x) => s + x.net, 0)/m.length, k = m.filter(x => x.ok).length;
    return { ...u, st: "closed", net, ok: k*2 > m.length || (k*2 === m.length && net > 0), how: hows.length === 1 ? hows[0] : "karışık" }; }); }
/* summary (optionally filtered). o.merge → totals and per-coin counted by units (see units()); per-interval / per-type tables always per trade. */
function stats(list, f = {}, o = {}){ const L = list.filter(x => (!f.sym || x.sym === f.sym) && (!f.tf || x.tf === f.tf)), C = L.filter(x => x.st !== "open"), by = (arr, k) => { const r = {};
    for (const x of arr){ const g = r[x[k]] = r[x[k]] || { n: 0, ok: 0, net: 0 }; g.n++; if (x.ok) g.ok++; g.net += x.net; } return r; };
  const U = o.merge ? units(L) : L, UC = U.filter(x => x.st !== "open"), ok = UC.filter(x => x.ok).length, net = UC.reduce((s, x) => s + x.net, 0);
  return { n: U.length, raw: L.length, merged: L.length - U.length, open: U.length - UC.length, closed: UC.length, ok, bad: UC.length - ok, hit: UC.length ? ok/UC.length : null, net, avg: UC.length ? net/UC.length : null,
    tp: UC.filter(x => x.how === "TP").length, sl: UC.filter(x => x.how === "SL").length, to: UC.filter(x => x.how === "SÜRE").length, byTf: by(C, "tf"), byType: by(C, "type"), byCoin: by(UC, "sym"), list: L }; }
/* v7.20 "geniş stop": stop farther than 5 % of the entry, or more than 3× the median stop distance of earlier records (needs ≥ 5) */
const stopPct = tr => Math.abs(tr.entry - tr.stop)/tr.entry*100;
function wideStop(list, tr, k = 3, cap = 5){ const p = stopPct(tr); if (p > cap) return true; const a = list.filter(x => x !== tr && fin(x.entry) && fin(x.stop)).slice(0, 200).map(stopPct).sort((x, y) => x - y);
  if (a.length < 5) return false; const m = a.length % 2 ? a[(a.length - 1)/2] : (a[a.length/2 - 1] + a[a.length/2])/2; return m > 0 && p > k*m; }
function csv(list, tz = "Europe/Berlin"){ const fmt = t => { try { return new Date(t).toLocaleString("sv-SE", { timeZone: tz }); } catch(e){ return new Date(t).toISOString(); } };
  const rows = [["zaman (Berlin)", "coin", "aralık", "yön", "tür", "neden", "geniş stop", "giriş", "stop", "hedef", "durum", "sonuç", "çıkış", "kapanış (Berlin)", "net %"]];
  for (const x of list) rows.push([fmt(x.t), x.sym, x.tf, x.d > 0 ? "LONG" : "SHORT", x.type, x.why, x.wide ? "evet" : "", x.entry, x.stop, x.tp, x.st === "open" ? "AÇIK" : x.ok ? "DOĞRU" : "YANLIŞ", x.how || "", x.exit ?? "", x.cT ? fmt(x.cT) : "", fin(x.net) ? x.net.toFixed(3) : ""]);
  return rows.map(r => r.map(v => { const s = String(v ?? ""); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\n"); }
return { FEE, MAXN, TOUT, TFMS, netPct, make, add, close, resolveBars, tick, gapTf, trigFired, stats, units, stopPct, wideStop, csv };
});
