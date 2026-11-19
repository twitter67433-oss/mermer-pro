/* MERMER TERMİNAL v7.33 — TOPLAMA / DAĞITIM: multi-exchange public data, keyless (signal only, no orders, no keys).
   Sources (CORS-checked from the browser): Binance USDⓈ-M, Bybit v5, OKX v5 (public REST + ws on 443), Bitget v2 mix, CoinGecko (squeeze.js cache).
   Not used: OKX rubik (long/short, OI history) — no CORS header; GeckoTerminal — CEX perp ↔ DEX pool mapping is unreliable.
   Per coin: total OI (USD) over exchanges + 1h change, OI-weighted funding, OI-weighted long/short (accounts), taker delta (Binance 5m klines),
   live liquidations (Binance !forceOrder via sert.js, Bybit allLiquidation, OKX liquidation-orders) and large prints ≥ $50k for the selected coin. */
"use strict";
(function (root, factory){ const M = factory(); if (typeof module === "object" && module.exports) module.exports = M; else root.AGGX = M; })(typeof self !== "undefined" ? self : this, function (){
const fin = x => typeof x === "number" && isFinite(x);
/* coin key shared by all exchanges: SOLUSDT / SOL-USDT-SWAP / 1000PEPEUSDT → SOL / PEPE */
const key = s => String(s || "").toUpperCase().replace(/-USDT-SWAP$|USDT$|_UMCBL$/, "").replace(/^(1000000|10000|1000|100|1M)(?=[A-Z])/, "");
/* rows: [{ ex, oiUsd, fr, ls (long account share 0..1) }] → OI-weighted aggregate */
function combine(rows){ const R = (rows || []).filter(r => r && fin(r.oiUsd) && r.oiUsd > 0); const oi = R.reduce((a, r) => a + r.oiUsd, 0);
  const wavg = f => { const S = R.filter(r => fin(r[f])); const w = S.reduce((a, r) => a + r.oiUsd, 0); return w > 0 ? S.reduce((a, r) => a + r[f]*r.oiUsd, 0)/w : NaN; };
  return { oiUsd: oi, fr: wavg("fr"), ls: wavg("ls"), n: R.length, ex: R.map(r => r.ex) }; }
/* OI change over exchanges that have both values (now and ~1h ago) */
function chg(pairs){ let a = 0, b = 0; for (const p of pairs || []) if (p && fin(p.now) && fin(p.ago) && p.ago > 0){ a += p.now; b += p.ago; } return b > 0 ? a/b - 1 : NaN; }
/* detector (v7.33; thresholds checked on 45 d history — see CFG note): x = { p1, p4 (price change 1h / 4h), v1 (1h volume ÷ 24h hourly avg), oi1 (agg OI 1h), td1 (taker delta 1h: (buy − sell)/(buy + sell)) } */
const CFG = { top: { p1: 0.01, p4: 0.02, v1: 1.5, oi1: 0.03, td1: 0.03 }, dag: { p4: 0.03, td1: -0.10, oi1: 0.01 } }; /* 45 d, 109 alts, Binance+Bybit OI: TOPLAMA n=102 +0.17 %/işlem stoplu (son %40: +0.50 %, n=30); DAĞITIM n=271 −0.03 % — zararda, yalnızca bilgi. Kanıtlanmadı. */
function detect(x){ const c = CFG; if (!x) return { state: "", why: "" };
  const top = fin(x.p1) && fin(x.p4) && Math.abs(x.p1) <= c.top.p1 && Math.abs(x.p4) <= c.top.p4 && x.v1 >= c.top.v1 && x.oi1 >= c.top.oi1 && x.td1 >= c.top.td1;
  const dag = fin(x.p4) && x.p4 >= c.dag.p4 && x.td1 <= c.dag.td1 && x.oi1 >= c.dag.oi1;
  const pc = v => fin(v) ? (v >= 0 ? "+" : "") + (v*100).toFixed(1) + "%" : "—";
  return { state: top ? "TOPLAMA" : dag ? "DAĞITIM" : "", why: `fiyat 1s ${pc(x.p1)} · 4s ${pc(x.p4)} · hacim ${fin(x.v1) ? x.v1.toFixed(1) + "×" : "—"} · OI 1s ${pc(x.oi1)} · taker ${pc(x.td1)}` }; }
/* taker delta + price/volume features from Binance 5m klines [{ c, qv, tb }] (oldest → newest, closed) */
function kfeat(b){ const n = (b || []).length; if (n < 49) return null; const last = b[n - 1], S = (i, j, f) => b.slice(i, j).reduce((a, x) => a + f(x), 0);
  const v1 = S(n - 12, n, x => x.qv), vAll = S(0, n, x => x.qv), tb1 = S(n - 12, n, x => x.tb);
  return { p1: last.c/b[n - 13].c - 1, p4: last.c/b[n - 49].c - 1, v1: vAll > 0 ? v1/(vAll/n*12) : NaN, td1: v1 > 0 ? (2*tb1 - v1)/v1 : NaN }; }
const usd = v => !fin(v) ? "—" : v >= 1e9 ? "$" + (v/1e9).toFixed(2) + "B" : v >= 1e6 ? "$" + (v/1e6).toFixed(1) + "M" : v >= 1e3 ? "$" + (v/1e3).toFixed(0) + "k" : "$" + Math.round(v);
return { key, combine, chg, detect, kfeat, CFG, usd };
});

if (typeof window !== "undefined" && typeof document !== "undefined") window.AGG = (() => {
const X = window.AGGX, $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const j = async u => { const r = await fetch(u); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }, fin = x => typeof x === "number" && isFinite(x);
const BN = "https://fapi.binance.com", BY = "https://api.bybit.com", OK = "https://www.okx.com", BG = "https://api.bitget.com";
const BULK = { by: new Map(), ok: new Map(), bg: new Map(), bn: new Map(), at: {} }, RING = new Map(), C = new Map(), SRC = { binance: 0, bybit: 0, okx: 0, bitget: 0 }, ERR = {};
const ok = (s, v) => { SRC[s] = v ? Date.now() : SRC[s]; if (!v) ERR[s] = (ERR[s] || 0) + 1; };
/* bulk snapshots: Bybit + OKX every 60 s, Bitget (≈450 kB) every 5 min, Binance funding every 60 s */
async function bulk(){ const now = Date.now();
  try { const r = await j(`${BY}/v5/market/tickers?category=linear`); for (const t of r.result.list) if (/USDT$/.test(t.symbol)) BULK.by.set(X.key(t.symbol), { oiUsd: +t.openInterestValue, fr: +t.fundingRate, px: +t.lastPrice }); ok("bybit", 1); } catch(e){ ok("bybit", 0); }
  try { const [oi, tk] = await Promise.all([j(`${OK}/api/v5/public/open-interest?instType=SWAP`), BULK.at.okt && now - BULK.at.okt < 300000 ? null : j(`${OK}/api/v5/market/tickers?instType=SWAP`)]);
    for (const t of oi.data) if (/-USDT-SWAP$/.test(t.instId)){ const k = X.key(t.instId), o = BULK.ok.get(k) || {}; o.oiUsd = +t.oiUsd; o.inst = t.instId; BULK.ok.set(k, o); }
    if (tk){ BULK.at.okt = now; for (const t of tk.data) if (/-USDT-SWAP$/.test(t.instId)){ const o = BULK.ok.get(X.key(t.instId)) || {}; o.px = +t.last; BULK.ok.set(X.key(t.instId), o); } } ok("okx", 1); } catch(e){ ok("okx", 0); }
  if (!BULK.at.bg || now - BULK.at.bg > 300000){ try { const r = await j(`${BG}/api/v2/mix/market/tickers?productType=USDT-FUTURES`); BULK.at.bg = now; for (const t of r.data) BULK.bg.set(X.key(t.symbol), { oiUsd: +t.holdingAmount*(+t.lastPr), fr: +t.fundingRate, px: +t.lastPr }); ok("bitget", 1); } catch(e){ ok("bitget", 0); } }
  if (!BULK.at.oki || now - BULK.at.oki > 6*3600000){ try { const r = await j(`${OK}/api/v5/public/instruments?instType=SWAP`); BULK.at.oki = now; for (const t of r.data) if (/-USDT-SWAP$/.test(t.instId)){ const o = BULK.ok.get(X.key(t.instId)) || {}; o.ct = +t.ctVal || 1; o.inst = t.instId; BULK.ok.set(X.key(t.instId), o); } } catch(e){} } /* OKX sizes are contracts × ctVal */
  try { const r = await j(`${BN}/fapi/v1/premiumIndex`); for (const t of r) if (/USDT$/.test(t.symbol)) BULK.bn.set(t.symbol, { fr: +t.lastFundingRate, px: +t.markPrice }); ok("binance", 1); } catch(e){ ok("binance", 0); }
  for (const ex of ["ok", "bg"]) for (const [k, v] of BULK[ex]){ if (!fin(v.oiUsd)) continue; const R = RING.get(ex + k) || []; R.push([now, v.oiUsd]); while (R.length && R[0][0] < now - 2*3600000) R.shift(); RING.set(ex + k, R); } }
const ringAgo = (ex, k, ms = 3600000) => { const R = RING.get(ex + k) || [], t = Date.now() - ms; let v = NaN; for (const [a, b] of R) if (a <= t + 120000 && a >= t - 600000) v = b; return v; };
/* per watched coin (≤ 10): Binance OI (now + 1h), 5m klines, L/S; Bybit OI 1h + L/S; OKX funding; Bitget L/S */
async function coin(sym){ const k = X.key(sym), base = sym.replace(/USDT$/, ""), out = { sym, k, at: Date.now(), ex: {} };
  const [bo, bh, kl, bls, yh, yls, of, gls] = await Promise.all([
    j(`${BN}/fapi/v1/openInterest?symbol=${sym}`).catch(() => null), j(`${BN}/futures/data/openInterestHist?symbol=${sym}&period=5m&limit=13`).catch(() => null),
    j(`${BN}/fapi/v1/klines?symbol=${sym}&interval=5m&limit=289`).catch(() => null), j(`${BN}/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=5m&limit=1`).catch(() => null),
    j(`${BY}/v5/market/open-interest?category=linear&symbol=${sym}&intervalTime=5min&limit=13`).catch(() => null), j(`${BY}/v5/market/account-ratio?category=linear&symbol=${sym}&period=5min&limit=1`).catch(() => null),
    BULK.ok.get(k) && BULK.ok.get(k).inst ? j(`${OK}/api/v5/public/funding-rate?instId=${BULK.ok.get(k).inst}`).catch(() => null) : null,
    j(`${BG}/api/v2/mix/market/account-long-short?symbol=${base}USDT&period=5m`).catch(() => null)]);
  const now = Date.now(), b = (kl || []).filter(x => +x[6] < now).map(x => ({ c: +x[4], qv: +x[7], tb: +x[10] })), px = b.length ? b[b.length - 1].c : NaN;
  const bnOi = bo ? +bo.openInterest*px : NaN, bnAgo = bh && bh.length ? +bh[0].sumOpenInterestValue : NaN, bnLs = bls && bls[0] ? +bls[0].longAccount : NaN;
  const yl = yh && yh.result && yh.result.list || [], yNow = yl.length ? +yl[0].openInterest : NaN, yAgo = yl.length ? +yl[yl.length - 1].openInterest : NaN, by = BULK.by.get(k) || {}, yPx = by.px || px;
  const yLs = yls && yls.result && yls.result.list && yls.result.list[0] ? +yls.result.list[0].buyRatio : NaN;
  const okx = BULK.ok.get(k) || {}, okFr = of && of.data && of.data[0] ? +of.data[0].fundingRate : NaN, bg = BULK.bg.get(k) || {}, gL = gls && gls.data && gls.data.length ? +gls.data[gls.data.length - 1].longAccountRatio : NaN;
  const rows = [{ ex: "Binance", oiUsd: bnOi, fr: (BULK.bn.get(sym) || {}).fr, ls: bnLs }, { ex: "Bybit", oiUsd: by.oiUsd, fr: by.fr, ls: yLs }, { ex: "OKX", oiUsd: okx.oiUsd, fr: okFr }, { ex: "Bitget", oiUsd: bg.oiUsd, fr: bg.fr, ls: gL }];
  out.ex = rows; out.agg = X.combine(rows);
  out.oi1 = X.chg([{ now: bnOi, ago: bnAgo }, { now: fin(yNow) ? yNow*yPx : NaN, ago: fin(yAgo) ? yAgo*yPx : NaN }, { now: okx.oiUsd, ago: ringAgo("ok", k) }, { now: bg.oiUsd, ago: ringAgo("bg", k) }]);
  out.f = X.kfeat(b); out.det = X.detect(out.f ? Object.assign({}, out.f, { oi1: out.oi1 }) : null); out.px = px; C.set(sym, out); return out; }
/* ---- live streams for ONE selected coin: trades (CVD, large prints) + liquidations; battery: only while the section is AKTİF ---- */
const LV = { sym: "", ws: [], cvd: [], big: [], liq: [] }; const BIG = 50000;
function tick(ex, usdV, buy, t){ if (!(usdV > 0)) return; LV.cvd.push([t || Date.now(), buy ? usdV : -usdV]); if (usdV >= BIG){ LV.big.unshift({ ex, usd: usdV, buy, t: t || Date.now() }); LV.big.length = Math.min(LV.big.length, 12); } }
function liqAdd(ex, usdV, longLiq, t){ if (usdV > 0) LV.liq.push([t || Date.now(), usdV, longLiq, ex]); }
function live(sym){ const want = 3 + (BULK.ok.get(X.key(sym || "")) && BULK.ok.get(X.key(sym)).inst ? 1 : 0); if (LV.sym === sym && LV.ws.filter(w => w.readyState < 2).length >= want) return; for (const w of LV.ws) try { w.onclose = null; w.close(); } catch(e){} LV.ws = []; LV.sym = sym; LV.cvd = []; LV.big = []; LV.liq = []; if (!sym) return;
  const k = X.key(sym), lo = sym.toLowerCase(), add = (u, sub, on) => { try { const w = new WebSocket(u); w.onopen = () => { if (sub) w.send(sub); }; w.onmessage = e => { try { on(JSON.parse(e.data)); } catch(x){} }; LV.ws.push(w); if (sub && /bybit|okx|bitget/.test(u)) w._ping = setInterval(() => { try { w.readyState === 1 && w.send(/okx|bitget/.test(u) ? "ping" : JSON.stringify({ op: "ping" })); } catch(x){} }, 20000); w.addEventListener("close", () => clearInterval(w._ping)); w.addEventListener("close", e => { if (e.code !== 4000 && LV.ws.includes(w)) lastSel = ""; }); } catch(e){} }; /* reconnect on the next 5 s tick */
  add(`wss://fstream.binance.com/ws/${lo}@aggTrade`, null, d => tick("Binance", +d.p*(+d.q), !d.m, d.T));
  add("wss://stream.bybit.com/v5/public/linear", JSON.stringify({ op: "subscribe", args: [`publicTrade.${sym}`, `allLiquidation.${sym}`] }), d => { if (!d.topic) return;
    if (d.topic.startsWith("publicTrade")) for (const t of d.data) tick("Bybit", +t.p*(+t.v), t.S === "Buy", +t.T); else for (const t of d.data || []) liqAdd("Bybit", +t.p*(+t.v), t.S === "Buy", +t.T); }); /* Bybit: S=Buy → a long position was liquidated */
  const ok2 = BULK.ok.get(k); if (ok2 && ok2.inst) add("wss://ws.okx.com/ws/v5/public", JSON.stringify({ op: "subscribe", args: [{ channel: "trades", instId: ok2.inst }, { channel: "liquidation-orders", instType: "SWAP" }] }), d => { if (!d.arg || !d.data) return;
    if (d.arg.channel === "trades") for (const t of d.data) tick("OKX", +t.px*(+t.sz)*(ok2.ct || 1), t.side === "buy", +t.ts); else for (const o of d.data) if (o.instId === ok2.inst) for (const x of o.details || []) liqAdd("OKX", +x.bkPx*(+x.sz)*(ok2.ct || 1), x.posSide === "long", +x.ts); });
  add("wss://ws.bitget.com/v2/ws/public", JSON.stringify({ op: "subscribe", args: [{ instType: "USDT-FUTURES", channel: "trade", instId: sym }] }), d => { if (d.arg && d.data && d.arg.channel === "trade") for (const t of d.data) tick("Bitget", +t.price*(+t.size), t.side === "buy", +t.ts); }); }
function liveSum(ms = 900000){ const t = Date.now() - ms; LV.cvd = LV.cvd.filter(x => x[0] > t - 3600000); let d = 0, v = 0; for (const [a, u] of LV.cvd) if (a > t){ d += u; v += Math.abs(u); }
  let lo = 0, sh = 0; for (const [a, u, l] of LV.liq) if (a > t) l ? lo += u : sh += u; const bn = window.SERTS && SERTS.liq ? SERTS.liq(LV.sym, ms) : { lo: 0, sh: 0 };
  return { cvd: d, td: v > 0 ? d/v : NaN, vol: v, liqL: lo + bn.lo, liqS: sh + bn.sh, big: LV.big.filter(x => x.t > t) }; }
/* ---- watched coins + loop ---- */
function watched(){ const s = new Set(["BTCUSDT"]); try { const S = window.SCALP && SCALP.S; if (S && S.sym) s.add(S.sym); } catch(e){}
  try { if (window.SERTS){ for (const k in SERTS.R.L) for (const r of SERTS.R.L[k].values()) s.add(r.sym); } } catch(e){} return [...s].filter(x => /USDT$/.test(x)).slice(0, 10); }
let busy = false, lastSel = "";
async function loop(){ if (busy) return; busy = true; try { await bulk(); for (const s of watched()){ try { const o = await coin(s); logDet(o); } catch(e){} await new Promise(z => setTimeout(z, 300)); } } finally { busy = false; } paint(); }
/* detector → DEFTER (TOPLAMA = LONG tab, DAĞITIM = SHORT tab); once per coin per 15m slot; stop = 15m swing low/high of the last 4 bars */
const LOGGED = new Set();
async function logDet(o){ if (!o.det.state || !window.SERTS || !SERTS.push) return; const k = o.det.state === "TOPLAMA" ? "top" : "dag", slot = Math.floor(Date.now()/900000), id = k + o.sym + slot; if (LOGGED.has(id) || (SERTS.ON && SERTS.ON[k] === false)) return; LOGGED.add(id);
  try { const kl = await j(`${BN}/fapi/v1/klines?symbol=${o.sym}&interval=15m&limit=5`), b = kl.filter(x => +x[6] < Date.now()).slice(-4); const side = k === "top" ? 1 : -1;
    const stop = side > 0 ? Math.min(...b.map(x => +x[3]))*0.9995 : Math.max(...b.map(x => +x[2]))*1.0005; SERTS.push({ k, side, sym: o.sym, entry: o.px, stop, atr: Math.abs(o.px - stop), why: o.det.why, close: slot*900000, until: (slot + 1)*900000 }); } catch(e){} }
/* ---- UI: one line per coin; per-exchange breakdown + live tape only with "detay" ---- */
const pc = (v, d = 1) => fin(v) ? (v >= 0 ? "+" : "−") + Math.abs(v*100).toFixed(d) + "%" : "—";
const lsTxt = s => fin(s) && s > 0 && s < 1 ? (s/(1 - s)).toFixed(2) : "—";
function paint(){ const el = $("#agg-box"); if (!el) return; const sel = watched(), L = sel.map(s => C.get(s)).filter(Boolean);
  const srcs = Object.entries(SRC).map(([k, t]) => `<span class="${t && Date.now() - t < 600000 ? "up" : "dn"}">${k}</span>`).join(" · ");
  el.innerHTML = `<div class="agg-src dim">kaynak: ${srcs}${window.SEC && !SEC.on("agg") ? " · PASİF" : ""}</div>` + (L.length ? L.map(o => { const a = o.agg, d = o.det, cls = d.state === "TOPLAMA" ? "up" : d.state === "DAĞITIM" ? "dn" : "dim";
      return `<div class="agg-r"><b>${esc(o.sym.replace("USDT", ""))}</b> <span>OI ${X.usd(a.oiUsd)} <small>(${a.n} borsa)</small> ${pc(o.oi1)}</span> · <span>fund ${fin(a.fr) ? (a.fr*100).toFixed(3) + "%" : "—"}</span> · <span>L/S ${lsTxt(a.ls)}</span> · <span>taker ${o.f ? pc(o.f.td1, 0) : "—"}</span> <b class="${cls}">${d.state || "—"}</b>
        <div class="agg-det dim">${o.ex.map(r => `${r.ex}: ${X.usd(r.oiUsd)} · ${fin(r.fr) ? (r.fr*100).toFixed(4) + "%" : "—"}${fin(r.ls) ? " · L/S " + lsTxt(r.ls) : ""}`).join(" | ")} · ${esc(d.why)}</div></div>`; }).join("") : `<div class="dim">yükleniyor…</div>`)
    + (LV.sym ? ((q) => `<div class="agg-live"><b>${esc(LV.sym.replace("USDT", ""))} canlı 15dk</b> · CVD ${X.usd(Math.abs(q.cvd))} ${q.cvd >= 0 ? "alış" : "satış"} (${pc(q.td, 0)}) · lik. long ${X.usd(q.liqL)} / short ${X.usd(q.liqS)}<div class="agg-det dim">büyük işlemler ≥$50k: ${q.big.length ? q.big.slice(0, 6).map(x => `${x.ex} ${x.buy ? "AL" : "SAT"} ${X.usd(x.usd)}`).join(" · ") : "yok"}</div></div>`)(liveSum()) : ""); }
function selCoin(){ let s = ""; try { const S = window.SCALP && SCALP.S; if (S && S.sym) s = S.sym; } catch(e){} return s; }
function init(){ setTimeout(loop, 6000); setInterval(loop, 60000); setInterval(() => { const s = selCoin(); if (s && (s !== lastSel || LV.ws.filter(w => w.readyState < 2).length < 3 + (BULK.ok.get(X.key(s)) && BULK.ok.get(X.key(s)).inst ? 1 : 0))){ lastSel = s; live(s); } const pg = document.body.dataset.pg; if (pg === "short" || pg === "long") paint(); }, 5000);
  window.addEventListener("sec:change", e => { if (e.detail && e.detail.sec === "agg"){ if (e.detail.on){ LV.sym = ""; lastSel = ""; loop(); } paint(); } }); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
return { C, BULK, SRC, ERR, LV, loop, coin, liveSum, paint, watched };
})();
