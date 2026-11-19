/* MERMER TERMİNAL v7.27 — ⚠ SQUEEZE RİSKİ (uyarı, emir değil). Public Binance futures data + CoinGecko supply/mcap (cached).
   ON when: (OI in coins ≥ circulating supply OR OI USD ≥ 1.5 × market cap) AND account long/short < 0.6 and falling AND 24h change ≥ +20 %.
   Supply data missing → only the L/S + 24h conditions are checked and the result is marked "kısmi". Never trades. */
"use strict";
(function (root, factory){ const M = factory(); if (typeof module === "object" && module.exports) module.exports = M; else root.SQZ = M; })(typeof self !== "undefined" ? self : this, function (){
const fin = x => typeof x === "number" && isFinite(x);
const CFG = { ls: 0.6, chg: 20, oiMcap: 1.5 };
/* base asset + contract multiplier: 1000PEPEUSDT → PEPE ×1000, 1000000MOGUSDT → MOG ×1e6 */
function base(sym){ let b = String(sym || "").toUpperCase().replace(/USDT$|USDC$/, ""), m = 1; const r = b.match(/^(1000000|10000|1000|100)(?=[A-Z])/); if (r){ m = +r[1]; b = b.slice(r[1].length); } return { b, m }; }
/* x: { oiCoins (contract units), mult, px, circ, mcap, ls: [oldest … newest account L/S], chg24 (%) } */
function evaluate(x){ const ls = (x.ls || []).filter(fin), last = ls.length ? ls[ls.length - 1] : NaN, first = ls.length ? ls[0] : NaN;
  const lsLow = fin(last) && last < CFG.ls, falling = ls.length >= 2 && last < first, up = fin(x.chg24) && x.chg24 >= CFG.chg;
  const coins = fin(x.oiCoins) ? x.oiCoins*(x.mult || 1) : NaN, oiUsd = fin(coins) && fin(x.px) ? coins*x.px : NaN;
  const haveSup = fin(x.circ) && x.circ > 0 || fin(x.mcap) && x.mcap > 0;
  const supRatio = fin(coins) && fin(x.circ) && x.circ > 0 ? coins/x.circ : NaN, mcRatio = fin(oiUsd) && fin(x.mcap) && x.mcap > 0 ? oiUsd/x.mcap : NaN;
  const oiHeavy = (fin(supRatio) && supRatio >= 1) || (fin(mcRatio) && mcRatio >= CFG.oiMcap);
  const on = lsLow && falling && up && (haveSup ? oiHeavy : true), partial = !haveSup;
  const why = [`L/S ${fin(last) ? last.toFixed(2) : "—"}${falling ? "↓" : ""}`, `24s ${fin(x.chg24) ? (x.chg24 >= 0 ? "+" : "") + x.chg24.toFixed(0) + "%" : "—"}`];
  if (fin(supRatio)) why.push(`OI = arzın ${supRatio.toFixed(1)}×`); if (fin(mcRatio)) why.push(`OI = mcap ${mcRatio.toFixed(1)}×`); if (partial) why.push("arz verisi yok (kısmi)");
  return { on, partial, lsLow, falling, up, oiHeavy, supRatio, mcRatio, why: why.join(" · ") }; }
const line = r => r && r.on ? `⚠ SQUEEZE RİSKİ — SHORT GİRME${r.partial ? " (kısmi)" : ""} · ${r.why}` : "";
return { CFG, base, evaluate, line };
});

/* ---------------- browser: fetch + cache (2 min per coin, CoinGecko 6 h) ---------------- */
if (typeof window !== "undefined") (() => {
const S = window.SQZ, F = "https://fapi.binance.com", cache = new Map(), busy = new Map(), CGK = "mermer.cg.sup";
let cg = (() => { try { return JSON.parse(localStorage.getItem(CGK) || "{}"); } catch(e){ return {}; } })();
const j = async u => { const r = await fetch(u); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
async function supply(b){ const k = b.toLowerCase(), c = cg[k]; if (c && Date.now() - c.at < 6*3600e3) return c;
  try { const a = await j(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&symbols=${encodeURIComponent(k)}`); const x = (a || []).filter(y => y.market_cap > 0).sort((p, q) => q.market_cap - p.market_cap)[0];
    const v = { at: Date.now(), circ: x ? +x.circulating_supply || null : null, mcap: x ? +x.market_cap || null : null, id: x ? x.id : null }; cg[k] = v; try { localStorage.setItem(CGK, JSON.stringify(cg)); } catch(e){} return v; }
  catch(e){ return c || { circ: null, mcap: null }; } }
async function load(sym){ const { b, m } = S.base(sym);
  const [oi, t24, ls, sup] = await Promise.all([j(`${F}/fapi/v1/openInterest?symbol=${sym}`).catch(() => null), j(`${F}/fapi/v1/ticker/24hr?symbol=${sym}`).catch(() => null),
    j(`${F}/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=1h&limit=4`).catch(() => null), supply(b)]);
  const r = S.evaluate({ oiCoins: oi ? +oi.openInterest : NaN, mult: m, px: t24 ? +t24.lastPrice : NaN, circ: sup.circ, mcap: sup.mcap, ls: (ls || []).map(x => +x.longShortRatio), chg24: t24 ? +t24.priceChangePercent : NaN });
  r.at = Date.now(); r.sym = sym; cache.set(sym, r); window.dispatchEvent(new CustomEvent("sqz:update", { detail: { sym } })); return r; }
S.get = sym => { if (!sym) return null; const c = cache.get(sym); if ((!c || Date.now() - c.at > 120000) && !busy.get(sym)){ busy.set(sym, true); load(sym).catch(() => {}).finally(() => busy.delete(sym)); } return c || null; };
S.peek = sym => cache.get(sym) || null;
S.html = sym => { const r = S.get(sym); return r && r.on ? `<div class="sqz-line" role="alert">${S.line(r).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>` : ""; };
})();
