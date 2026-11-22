/* MERMER PRO — PRO tab: one answer (LONG / SHORT / BEKLE) per coin, details on tap. Public Binance USDⓈ-M GET + forceOrder WS only.
   No API keys, no orders, no wallet: this tab cannot trade. A strategy may produce LONG/SHORT only if tools/pro validation marked it
   "aktif" (out-of-sample positive in both halves, CI not clearly negative, beats random entries). Otherwise every setup is logged as a
   GÖLGE (shadow) forward test and the answer stays BEKLE. Storage keys live under the "mpro:" namespace (ns.js). */
"use strict";
(function (){
if (typeof window === "undefined" || typeof document === "undefined") return;
const C = window.MPC, V = window.MPV || { status: {}, rows: [], meta: {} }, FA = "https://fapi.binance.com";
const $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fin = x => typeof x === "number" && isFinite(x), M15 = 900000;
const K = { cfg: "pro.cfg", log: "pro.flog" };
const DEF = { sym: "BTCUSDT", balance: 1000, riskPct: 1, maxLev: 5, dailyLoss: 3, maxConsec: 3, coolH: 12, maxOpen: 2, scan: true, kill: false };
const LIM = { balance: [10, 1e7], riskPct: [0.1, 2], maxLev: [1, 10], dailyLoss: [1, 10], maxConsec: [1, 10], coolH: [1, 48], maxOpen: [1, 5] };
const ld = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch(e){ return d; } }, sv = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };
let cfg = Object.assign({}, DEF, ld(K.cfg, {})), LOG = ld(K.log, []);
const S = { data: null, err: null, busy: false, health: { lat: [], err: 0, lastErr: "", okAt: 0 }, scan: { at: 0, n: 0, cands: [], busy: false, err: null }, liq: [], ws: null, wsOk: false, open: {} };
const tz = t => new Date(t).toLocaleTimeString("tr-TR", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
const tzd = t => new Date(t).toLocaleString("tr-TR", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const px = v => !fin(v) ? "—" : v >= 1000 ? v.toFixed(2) : v >= 1 ? v.toFixed(4) : v.toPrecision(5);
const pc = (v, d = 2) => !fin(v) ? "—" : (v >= 0 ? "+" : "") + (v*100).toFixed(d) + "%";
const active = k => !!(V.status && V.status[k] && V.status[k].active);
async function j(p){ const t0 = performance.now(); try { const r = await fetch(FA + p, { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); const x = await r.json();
    S.health.lat.push(performance.now() - t0); if (S.health.lat.length > 30) S.health.lat.shift(); S.health.okAt = Date.now(); return x; }
  catch(e){ S.health.err++; S.health.lastErr = (e && e.message) || String(e); throw e; } }
const kb = a => { const now = Date.now(); return a.filter(x => +x[6] < now).map(x => ({ t: +x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4], v: +x[5], qv: +x[7], tb: +x[10] })); };
/* ---------- forward-test log (every setup, active or shadow) ---------- */
function logCands(sym, P, i, ev){ let ch = false;
  for (const cd of ev.cands){ const t = P.b[i].t + M15, id = sym + "|" + cd.key + "|" + t; if (LOG.some(e => e.id === id)) continue;
    const f = ev.fam; LOG.push({ id, sym, key: cd.key, name: cd.name, dir: cd.dir, t, entry: cd.entry, stop: cd.stop, tp1: cd.tp1, tp2: cd.tp2, rg: ev.rg.r, active: active(cd.key),
      fam: { trend: f.trend.d, mom: f.mom.d, flow: f.flow.d, pos: f.pos.d, str: f.str.d }, pro: cd.pro, con: cd.con, res: { MKT: null, PB: null }, done: false }); ch = true; }
  if (LOG.length > 2000) LOG = LOG.slice(-2000); if (ch) sv(K.log, LOG); }
function resolve(sym, P){ let ch = false; const now = Date.now();
  for (const e of LOG){ if (e.done || e.sym !== sym) continue; const i = P.b.findIndex(x => x.t + M15 === e.t);
    if (i < 0){ if (now - e.t > 3*864e5){ e.done = true; e.expired = true; ch = true; } continue; }
    for (const m of ["MKT", "PB"]){ if (e.res[m]) continue; const r = C.simTrade(P, i, { dir: e.dir, entry: e.entry, stop: e.stop }, m); if (!r || r.open) continue;
      e.res[m] = r.fill ? { out: r.out, netR: +r.netR.toFixed(3), t0: r.t0, t1: r.t1, entry: r.entry } : { out: "DOLMADI", why: r.why }; ch = true; }
    if (e.res.MKT && e.res.PB){ e.done = true; ch = true; } }
  if (ch) sv(K.log, LOG); }
function closeAll(){ const d = S.data; let n = 0;
  for (const e of LOG){ if (e.done) continue; const p = d && d.sym === e.sym ? d.P.c[d.P.n - 1] : null;
    for (const m of ["MKT", "PB"]) if (!e.res[m]){ const R = Math.abs(e.entry - e.stop); e.res[m] = p ? { out: "KAPAT", netR: +((e.dir*(p - e.entry) - 2*0.0007*e.entry)/R).toFixed(3), t0: e.t, t1: Date.now() } : { out: "KAPAT", netR: 0, t0: e.t, t1: Date.now(), note: "fiyat yok" }; }
    e.done = true; e.manual = true; n++; }
  sv(K.log, LOG); return n; }
function fwdStats(){ const g = new Map(); for (const e of LOG){ for (const m of ["MKT", "PB"]){ const r = e.res[m]; const k = e.key + "|" + m + "|" + e.rg; const v = g.get(k) || { key: e.key, mode: m, rg: e.rg, n: 0, fill: 0, tp1: 0, sum: 0, open: 0 };
      if (!r){ v.open++; } else if (r.out !== "DOLMADI"){ v.n++; v.fill++; v.sum += r.netR; if (/TP/.test(r.out)) v.tp1++; } else v.n++; g.set(k, v); } }
  return [...g.values()].sort((a, b) => (a.key + a.mode).localeCompare(b.key + b.mode)); }
function shadowPortfolio(){ const L = LOG.filter(e => e.res.MKT && fin(e.res.MKT.netR)).map(e => ({ sym: e.sym, t: e.res.MKT.t0, t1: e.res.MKT.t1, netR: e.res.MKT.netR }));
  return C.portfolio(L, { start: cfg.balance, riskPct: cfg.riskPct/100, maxOpen: cfg.maxOpen, dailyLoss: cfg.dailyLoss/100, maxConsec: cfg.maxConsec, coolMs: cfg.coolH*3600000, kill: cfg.kill }); }
/* ---------- decision ---------- */
function decide(d){ if (!d) return { v: "BEKLE", why: S.err ? "veri alınamadı: " + S.err : "yükleniyor…" };
  const age = Date.now() - (d.P.b[d.P.n - 1].t + M15); if (age > 20*60000) return { v: "BEKLE", why: "veri eski (" + Math.round(age/60000) + " dk)" };
  const ev = d.ev; if (!ev.rg.ok) return { v: "BEKLE", why: "rejim " + ev.rg.r + (ev.rg.why ? " — " + ev.rg.why : "") + " → işlem yok" };
  const act = ev.cands.filter(c => active(c.key)), sh = ev.cands.filter(c => !active(c.key));
  if (cfg.kill) return { v: "BEKLE", why: "ACİL DURDURMA açık", sh };
  if (act.length){ const c = act.sort((a, b) => (b.pro - b.con) - (a.pro - a.con))[0]; const st = shadowPortfolio(), now = Date.now(), d0 = Math.floor(now/864e5)*864e5; let ds = st.start; for (const [t, v] of st.curve) if (t < d0) ds = v;
      const nOpen = LOG.filter(e => e.active && !(e.res.MKT && fin(e.res.MKT.netR))).length;
      const g = C.guard({ balance: st.end, dayStart: ds, consec: st.consec, coolUntil: st.coolUntil, open: nOpen, kill: cfg.kill }, now, { maxOpen: cfg.maxOpen, dailyLoss: cfg.dailyLoss/100, maxConsec: cfg.maxConsec });
    if (!g.ok) return { v: "BEKLE", why: "risk: " + g.why.join(", "), cand: c, sh };
    return { v: c.dir > 0 ? "LONG" : "SHORT", why: c.name + " · doğrulanmış strateji (" + (V.status[c.key].mode || "MKT") + ")", cand: c, sh }; }
  if (sh.length) return { v: "BEKLE", why: "aday var ama strateji kanıtlanmadı (OOS negatif) → işlem yok", sh };
  return { v: "BEKLE", why: ev.rej.length ? "kurulum yok · " + ev.rej.map(r => r.why).slice(0, 2).join(" · ") : "kurulum yok (" + ev.rg.r + ")" , sh }; }
/* ---------- data ---------- */
async function load(sym){ if (S.busy) return; S.busy = true; S.err = null;
  try { const opt = p => j(p).catch(() => null);
    const [k15, fr, oi, dp, k5, pm] = await Promise.all([j(`/fapi/v1/klines?symbol=${sym}&interval=15m&limit=1500`), opt(`/fapi/v1/fundingRate?symbol=${sym}&limit=100`),
      opt(`/futures/data/openInterestHist?symbol=${sym}&period=15m&limit=17`), opt(`/fapi/v1/depth?symbol=${sym}&limit=100`), opt(`/fapi/v1/klines?symbol=${sym}&interval=5m&limit=300`), opt(`/fapi/v1/premiumIndex?symbol=${sym}`)]);
    const b = kb(k15); if (b.length < 1100) throw new Error("geçmiş az (" + b.length + " mum) — yeni coin");
    const P = C.prepare(b, { fr: (fr || []).map(x => [+x.fundingTime, +x.fundingRate]) }), i = P.n - 1, ev = C.evalAt(P, i);
    // live-only context (NOT used in decisions: no history to validate it)
    const x = {}; if (oi && oi.length > 4){ const v = oi.map(o => +o.sumOpenInterestValue); x.oi1 = v[v.length - 1]/v[v.length - 5] - 1; x.oi4 = v[v.length - 1]/v[0] - 1; x.oiUsd = v[v.length - 1]; }
    if (dp && dp.bids){ const mid = (+dp.bids[0][0] + +dp.asks[0][0])/2, w = 0.005; let bq = 0, aq = 0; for (const [p, q] of dp.bids) if (+p >= mid*(1 - w)) bq += +p*+q; for (const [p, q] of dp.asks) if (+p <= mid*(1 + w)) aq += +p*+q; x.obi = bq + aq ? (bq - aq)/(bq + aq) : null; x.spread = (+dp.asks[0][0] - +dp.bids[0][0])/mid; }
    if (k5){ const b5 = kb(k5), c5 = b5.map(y => y.c), r5 = window.MPI.rsi(c5), m5 = window.MPI.macd(c5).hist, d5 = window.MPI.delta(b5); x.rsi5 = r5[r5.length - 1]; x.macd5 = m5[m5.length - 1]; x.d5 = d5.slice(-3).reduce((s, y) => s + y, 0)/3; }
    if (pm){ x.mark = +pm.markPrice; x.frNext = +pm.lastFundingRate; x.nextT = +pm.nextFundingTime; }
    S.data = { sym, P, ev, x, at: Date.now() }; logCands(sym, P, i, ev); resolve(sym, P); liqWs(sym);
  } catch(e){ S.err = (e && e.message) || String(e); } finally { S.busy = false; paint(); } }
async function scan(){ if (S.scan.busy || !cfg.scan) return; S.scan.busy = true; S.scan.err = null;
  try { const t = await j("/fapi/v1/ticker/24hr"); const L = t.filter(x => /USDT$/.test(x.symbol) && +x.quoteVolume >= 2e7 && !/^(USDC|FDUSD|BTCDOM)/.test(x.symbol)).sort((a, b) => +b.quoteVolume - +a.quoteVolume).slice(0, 30).map(x => x.symbol);
    const out = []; for (let q = 0; q < L.length; q += 3){ await Promise.all(L.slice(q, q + 3).map(async s => { try {
        const [k, fr] = await Promise.all([j(`/fapi/v1/klines?symbol=${s}&interval=15m&limit=1500`), j(`/fapi/v1/fundingRate?symbol=${s}&limit=100`).catch(() => [])]);
        const b = kb(k); if (b.length < 1100) return; const P = C.prepare(b, { fr: fr.map(x => [+x.fundingTime, +x.fundingRate]) }), ev = C.evalAt(P, P.n - 1);
        logCands(s, P, P.n - 1, ev); resolve(s, P); for (const c of ev.cands) out.push({ sym: s, key: c.key, name: c.name, dir: c.dir, act: active(c.key), rg: ev.rg.r, t: P.b[P.n - 1].t + M15 }); } catch(e){} })); }
    S.scan = { at: Date.now(), n: L.length, cands: out, busy: false, err: null }; }
  catch(e){ S.scan.err = (e && e.message) || String(e); } finally { S.scan.busy = false; paint(); } }
function liqWs(sym){ if (S.ws && S.ws.sym === sym) return; try { S.ws && S.ws.close(); } catch(e){} S.liq = []; S.wsOk = false;
  const hosts = [`wss://fstream.binance.com/market/ws/${sym.toLowerCase()}@forceOrder`, `wss://fstream.binance.com/ws/${sym.toLowerCase()}@forceOrder`]; let h = 0;
  const open = () => { let ws; try { ws = new WebSocket(hosts[h % 2]); } catch(e){ return; } ws.sym = sym; S.ws = ws;
    ws.onopen = () => { S.wsOk = true; }; ws.onmessage = m => { try { const o = (JSON.parse(m.data).o) || {}; S.liq.push({ t: +o.T || Date.now(), side: o.S, usd: +o.ap*+o.z || +o.p*+o.q }); const c = Date.now() - 3600000; S.liq = S.liq.filter(x => x.t >= c); } catch(e){} };
    ws.onclose = () => { S.wsOk = false; if (S.ws === ws){ h++; setTimeout(() => { if (S.ws === ws) open(); }, 10000); } }; ws.onerror = () => {}; };
  open(); }
/* ---------- view ---------- */
const arrow = d => d > 0 ? '<b class="pro-up">↑</b>' : d < 0 ? '<b class="pro-dn">↓</b>' : '<b class="pro-nt">–</b>';
function famRows(f){ const t = f.trend, m = f.mom, fl = f.flow, p = f.pos, s = f.str, v = f.vol;
  return `<table class="pro-t"><tr><th>aile (1 kez sayılır)</th><th>yön</th><th>ayrıntı</th></tr>
  <tr><td>Trend (4s EMA20/50, 1s EMA50/200, ADX/DMI)</td><td>${arrow(t.d)}</td><td>ADX 1s ${fin(t.adx1h) ? t.adx1h.toFixed(0) : "—"} · oylar ${t.parts.join(" ")}</td></tr>
  <tr><td>Momentum (RSI 15dk/1s, MACD)</td><td>${arrow(m.d)}</td><td>RSI ${fin(m.rsi15) ? m.rsi15.toFixed(0) : "—"} / ${fin(m.rsi1h) ? m.rsi1h.toFixed(0) : "—"}</td></tr>
  <tr><td>Akış (taker delta, OBV, VWAP)</td><td>${arrow(fl.d)}</td><td>delta 1s ${fin(fl.delta4) ? (fl.delta4*100).toFixed(0) + "%" : "—"} · hacim ${fin(fl.vr) ? fl.vr.toFixed(1) + "×" : "—"}</td></tr>
  <tr><td>Pozisyonlanma (fonlama, kontra)</td><td>${arrow(p.d)}</td><td>fonlama ${fin(p.fr) ? (p.fr*100).toFixed(4) + "%" : "—"}</td></tr>
  <tr><td>Yapı (swing HH/HL, BOS)</td><td>${arrow(s.d)}</td><td>${esc(s.label)}${s.bos ? " · BOS " + (s.bos > 0 ? "↑" : "↓") : ""}</td></tr>
  <tr><td>Volatilite (yön yok)</td><td>·</td><td>ATR ${fin(v.atrp) ? (v.atrp*100).toFixed(2) + "%" : "—"} · ATR sıra ${fin(v.atrRank) ? (v.atrRank*100).toFixed(0) : "—"} · BB genişlik sıra ${fin(v.bbwRank) ? (v.bbwRank*100).toFixed(0) : "—"}</td></tr></table>`; }
function candBox(c, d){ const sz = C.size({ balance: cfg.balance, riskPct: cfg.riskPct/100, maxLev: cfg.maxLev, entry: c.entry, stop: c.stop });
  return `<div class="pro-lv"><div><span>Giriş (sonraki 15dk açılış)</span><b>${px(c.entry)}</b></div><div><span>Geri çekilme limiti (alternatif)</span><b>${px(c.entry - c.dir*0.3*d.P.atr[d.P.n - 1])}</b></div>
  <div><span>Stop (ATR/yapı)</span><b>${px(c.stop)}</b></div><div><span>TP1 (1R, yarısı + stop başa başa)</span><b>${px(c.tp1)}</b></div><div><span>TP2 (2R)</span><b>${px(c.tp2)}</b></div><div><span>R:R</span><b>1 : ${c.rr}</b></div></div>
  <div class="pro-note">Geçersizlik: ${esc(c.inv)}</div>
  <div class="pro-note">Boyut (risk %${cfg.riskPct} · bakiye $${cfg.balance}): ${sz.ok ? `${sz.qty.toPrecision(4)} adet ≈ $${sz.notional.toFixed(0)} · ${sz.lev}× · marj $${sz.margin.toFixed(0)} · risk $${sz.riskUsd.toFixed(2)} · tahmini likidasyon ${px(sz.liq)}` : "uygun değil — " + esc(sz.why.join(", "))}${sz.why && sz.why.length && sz.ok ? " · " + esc(sz.why.join(", ")) : ""}</div>
  <ul class="pro-why">${c.why.map(w => `<li>${esc(w)}</li>`).join("")}<li>aileler: ${c.pro} lehte · ${c.con} aleyhte</li></ul>`; }
function evidenceTable(){ const R = V.rows || []; if (!R.length) return '<div class="empty">doğrulama verisi yok</div>';
  const f = (x, d = 3) => fin(x) ? x.toFixed(d) : "—";
  return `<table class="pro-t"><tr><th>strateji · giriş</th><th>H1 R [95% GA]</th><th>H2 R [95% GA]</th><th>PF H1/H2</th><th>rastgele</th><th>durum</th></tr>${R.map(r => `<tr><td title="${esc(r.name)}"><b>${esc(r.key)}</b> ${r.mode === "PB" ? "limit" : "piyasa"}</td>
    <td>${f(r.h1.exp)} [${f(r.h1.ciLo, 2)}, ${f(r.h1.ciHi, 2)}] n${r.h1.n}</td><td>${f(r.h2.exp)} [${f(r.h2.ciLo, 2)}, ${f(r.h2.ciHi, 2)}] n${r.h2.n}</td><td>${f(r.h1.pf, 2)} / ${f(r.h2.pf, 2)}</td><td>${f(r.h1.rand)} / ${f(r.h2.rand)}</td><td>${r.pass ? '<b class="pro-up">aktif</b>' : '<b class="pro-dn">✗ kanıt yok</b>'}</td></tr>`).join("")}</table><div class="pro-note">TPB = trend geri çekilme · RREV = yatay bant dönüşü · BRK = sıkışma kırılımı · SWP = likidite süpürme dönüşü · limit = 0.3 ATR geri çekilme limiti. Hepsi: kanıtlanmadı.</div>
  <div class="pro-note">${esc(V.meta.text || "")}</div>`; }
function paint(){ const box = $("#pro-box"); if (!box) return; const d = S.data, dec = decide(d), ev = d && d.ev;
  const keep = {}; box.querySelectorAll("details[data-k]").forEach(x => keep[x.dataset.k] = x.open);
  const op = k => (keep[k] ?? S.open[k]) ? " open" : "";
  const cls = dec.v === "LONG" ? "pro-long" : dec.v === "SHORT" ? "pro-short" : "pro-wait";
  const lat = S.health.lat.length ? S.health.lat.reduce((s, x) => s + x, 0)/S.health.lat.length : null, age = d ? Date.now() - (d.P.b[d.P.n - 1].t + M15) : null;
  const fs = fwdStats(), pf = shadowPortfolio(), pend = LOG.filter(e => !e.done).length, x = d ? d.x : {};
  const liqL = S.liq.filter(y => y.side === "SELL").reduce((s, y) => s + (y.usd || 0), 0), liqS = S.liq.filter(y => y.side === "BUY").reduce((s, y) => s + (y.usd || 0), 0);
  const scanAct = S.scan.cands.filter(c => c.act), scanSh = S.scan.cands.filter(c => !c.act);
  box.innerHTML = `<form class="pro-q" id="pro-q"><input id="pro-sym" value="${esc(cfg.sym)}" autocomplete="off" spellcheck="false" aria-label="coin"><button type="submit">ANALİZ</button><button type="button" id="pro-rf" aria-label="yenile">↻</button></form>
  <details class="pro-card ${cls}" data-k="card"${op("card")}><summary><div class="pro-v">${dec.v}</div><div class="pro-s">${esc(cfg.sym)} · ${esc(dec.why)}</div>
    <div class="pro-m">${ev ? "rejim: <b>" + esc(ev.rg.r) + (ev.rg.d ? (ev.rg.d > 0 ? " ↑" : " ↓") : "") + "</b> · " : ""}${d ? "son kapanmış mum " + tz(d.P.b[d.P.n - 1].t + M15) + " Berlin" : ""}${S.busy ? " · yükleniyor…" : ""} · ayrıntı için dokun</div></summary>
    ${dec.cand ? candBox(dec.cand, d) : ""}
    ${dec.sh && dec.sh.length ? `<div class="pro-sh"><b>Reddedilen adaylar (kanıtlanmadı → işlem yok, yalnız gölge kayıt):</b>${dec.sh.map(c => `<div>${c.dir > 0 ? "LONG" : "SHORT"} · ${esc(c.name)} — giriş ${px(c.entry)} · stop ${px(c.stop)} · TP1 ${px(c.tp1)} · TP2 ${px(c.tp2)}</div>`).join("")}</div>` : ""}
    ${ev ? famRows(ev.fam) : ""}
    ${ev && ev.rej.length ? `<div class="pro-sh"><b>Elenen kurulumlar:</b>${ev.rej.map(r => `<div>${esc(r.key === "*" ? "tümü" : C.STRATS[r.key].name)}: ${esc(r.why)}</div>`).join("")}</div>` : ""}
    ${d ? `<div class="pro-sh"><b>Canlı bağlam (karar dışı — geçmişi olmadığı için doğrulanamadı):</b><div>OI 1s ${pc(x.oi1)} · 4s ${pc(x.oi4)} · emir defteri dengesizliği ±%0.5: ${fin(x.obi) ? (x.obi*100).toFixed(0) + "%" : "—"} · spread ${fin(x.spread) ? (x.spread*100).toFixed(3) + "%" : "—"}</div>
      <div>5dk RSI ${fin(x.rsi5) ? x.rsi5.toFixed(0) : "—"} · 5dk taker delta ${fin(x.d5) ? (x.d5*100).toFixed(0) + "%" : "—"} · likidasyon (son 1s, WS ${S.wsOk ? "bağlı" : "yok"}): long $${(liqL/1e3).toFixed(0)}k / short $${(liqS/1e3).toFixed(0)}k <small>(Binance akışı saniyede en fazla 1 olay gönderir → eksik sayar)</small></div></div>` : ""}
  </details>
  <div class="pro-scan">${cfg.scan ? (S.scan.at ? `TARAMA ${tz(S.scan.at)}: ${S.scan.n} likit coin · <b>${scanAct.length}</b> doğrulanmış sinyal · ${scanSh.length} gölge aday${scanAct.length ? " — " + scanAct.map(c => `<button type="button" class="pro-go" data-sym="${esc(c.sym)}">${esc(c.sym)} ${c.dir > 0 ? "LONG" : "SHORT"}</button>`).join(" ") : ""}` : (S.scan.busy ? "tarama sürüyor…" : "tarama bekliyor")) : "tarama kapalı"}${S.scan.err ? " · hata: " + esc(S.scan.err) : ""}</div>
  <details class="pro-sec" data-k="ev"${op("ev")}><summary>Strateji kanıtı (geçmiş test, örnek dışı)</summary>${evidenceTable()}</details>
  <details class="pro-sec" data-k="fw"${op("fw")}><summary>İleri test · canlı kayıt (${LOG.length} kayıt, ${pend} açık)</summary>
    ${fs.length ? `<table class="pro-t"><tr><th>strateji</th><th>giriş</th><th>rejim</th><th>sonuçlanan</th><th>TP1 oranı</th><th>ort. net R</th><th>açık</th></tr>${fs.map(v => `<tr><td>${esc(v.key)}${active(v.key) ? "" : " <small>gölge</small>"}</td><td>${v.mode}</td><td>${esc(v.rg)}</td><td>${v.fill}/${v.n}</td><td>${v.fill ? (v.tp1/v.fill*100).toFixed(0) + "%" : "—"}</td><td>${v.fill ? (v.sum/v.fill).toFixed(2) : "—"}</td><td>${v.open}</td></tr>`).join("")}</table>` : '<div class="empty">henüz kayıt yok — her kurulum (aktif ya da gölge) burada kendiliğinden sonuçlanır (TP/SL/zaman aşımı)</div>'}
    <div class="pro-note">Az örnekle oran yanıltır: 30'dan az sonuçlanan kayıtla karar verme. Parametreler canlı sonuçlara göre otomatik değişmez; değişiklik yalnız tools/pro walk-forward testinden geçerek yapılır.</div>
    <div class="pro-sh">${LOG.slice(-8).reverse().map(e => `<div>${tzd(e.t)} · ${esc(e.sym)} ${e.dir > 0 ? "LONG" : "SHORT"} · ${esc(e.key)} · ${esc(e.rg)} → ${e.res.MKT ? esc(e.res.MKT.out) + (fin(e.res.MKT.netR) ? " " + e.res.MKT.netR.toFixed(2) + "R" : "") : "açık"}${e.active ? "" : " <small>(gölge)</small>"}</div>`).join("")}</div>
    <div class="pro-btns"><button type="button" id="pro-clr">KAYDI SİL</button></div></details>
  <details class="pro-sec" data-k="pf"${op("pf")}><summary>Gölge portföy (SİM) · $${pf.end.toFixed(0)}</summary>
    <div class="pro-note">Kayıttaki sonuçlanmış kurulumlar (piyasa girişi) risk motorundan geçirilir: işlem başı %${cfg.riskPct} risk (bakiyeye göre, kayıptan sonra büyütme yok), en fazla ${cfg.maxOpen} açık, günlük zarar %${cfg.dailyLoss}, ${cfg.maxConsec} kayıp → ${cfg.coolH} saat soğuma. Gerçek emir yok.</div>
    <div>Başlangıç $${cfg.balance} → <b>$${pf.end.toFixed(2)}</b> · en büyük düşüş ${(pf.maxDD*100).toFixed(1)}% · alınan ${pf.taken} · risk kuralı ile atlanan ${pf.skipped}</div>
    <div class="pro-btns"><button type="button" id="pro-closeall">■ KAPAT ALL (SİM)</button><button type="button" id="pro-kill" class="${cfg.kill ? "on" : ""}">${cfg.kill ? "ACİL DURDURMA: AÇIK (kapat)" : "ACİL DURDURMA"}</button></div></details>
  <details class="pro-sec" data-k="rk"${op("rk")}><summary>Risk ayarları</summary><form id="pro-risk" class="pro-risk">
    ${[["balance", "Bakiye ($)"], ["riskPct", "İşlem başı risk (%) · en fazla 2"], ["maxLev", "Kaldıraç tavanı (×) · en fazla 10"], ["dailyLoss", "Günlük zarar limiti (%)"], ["maxConsec", "Art arda kayıp → soğuma"], ["coolH", "Soğuma (saat)"], ["maxOpen", "En fazla açık pozisyon"]].map(([k, l]) => `<label>${l}<input name="${k}" type="number" step="any" inputmode="decimal" value="${cfg[k]}"></label>`).join("")}
    <label class="pro-chk"><input type="checkbox" name="scan"${cfg.scan ? " checked" : ""}> 5 dakikada bir 30 likit coini tara</label>
    <div class="pro-note">Martingale yok, kayıptan sonra boyut artırma yok, stop zorunlu ve likidasyondan önce. Bu sekme emir göndermez; GERÇEK işlem yalnız VADELİ/İŞLEM bölümünde ONAYLIYORUM + ONAYLA ile.</div>
    <div class="pro-btns"><button type="submit">KAYDET</button></div><div id="pro-risk-msg" class="pro-note"></div></form></details>
  <details class="pro-sec" data-k="hl"${op("hl")}><summary>Sistem sağlığı</summary>
    <div>API gecikmesi ort. ${fin(lat) ? lat.toFixed(0) + " ms" : "—"} · hata ${S.health.err}${S.health.lastErr ? " (son: " + esc(S.health.lastErr) + ")" : ""}</div>
    <div>Veri tazeliği: ${fin(age) ? Math.round(age/60000) + " dk (son kapanmış 15dk mum)" : "—"} · likidasyon WS ${S.wsOk ? "bağlı" : "bağlı değil"} · depolama ayrı alan ${window.MPRO_NS ? "evet (mpro:)" : "HAYIR — tarayıcı izin vermedi"}</div>
    <div>Doğrulama: ${V.meta.coins || "—"} coin · ${V.meta.days || "—"} gün · ${V.meta.made ? tzd(V.meta.made) : "—"} · sürüm ${esc(window.APP_V || "")}</div></details>`;
}
/* ---------- events ---------- */
document.addEventListener("submit", ev => { const f = ev.target; if (!f || !f.id) return;
  if (f.id === "pro-q"){ ev.preventDefault(); const v = String($("#pro-sym").value || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (!v) return; cfg.sym = /USDT$/.test(v) ? v : v + "USDT"; sv(K.cfg, cfg); S.data = null; paint(); load(cfg.sym); }
  if (f.id === "pro-risk"){ ev.preventDefault(); const fd = new FormData(f), bad = [], nc = Object.assign({}, cfg);
    for (const k of Object.keys(LIM)){ const v = +fd.get(k); if (!fin(v) || v < LIM[k][0] || v > LIM[k][1]) bad.push(k + " " + LIM[k][0] + "–" + LIM[k][1]); else nc[k] = v; }
    nc.scan = fd.get("scan") === "on"; if (bad.length){ $("#pro-risk-msg").textContent = "geçersiz: " + bad.join(", "); return; } cfg = nc; sv(K.cfg, cfg); paint(); } });
document.addEventListener("click", ev => { const t = ev.target; if (!t || !t.closest || !t.closest("#pro-box")) return;
  if (t.id === "pro-rf"){ load(cfg.sym); }
  else if (t.id === "pro-clr"){ if (confirm("İleri test kaydı silinsin mi?")){ LOG = []; sv(K.log, LOG); paint(); } }
  else if (t.id === "pro-closeall"){ const n = closeAll(); paint(); alert(n + " açık SİM kaydı kapatıldı (gerçek emir yok)."); }
  else if (t.id === "pro-kill"){ cfg.kill = !cfg.kill; sv(K.cfg, cfg); paint(); }
  else if (t.classList.contains("pro-go")){ cfg.sym = t.dataset.sym; sv(K.cfg, cfg); load(cfg.sym); } });
function tick(){ if (document.hidden) return; if (document.body.dataset.pg === "pro"){ const d = S.data; const due = !d || d.sym !== cfg.sym || Date.now() - d.at > 60000; if (due) load(cfg.sym); else { const ae = document.activeElement; if (!(ae && ae.closest && ae.closest("#pro-box") && ae.tagName === "INPUT")) paint(); } }
  if (cfg.scan && Date.now() - S.scan.at > 300000) scan(); }
window.MPRO = { load, scan, paint, decide: () => decide(S.data), log: () => LOG, state: S, cfg: () => cfg };
paint(); setTimeout(tick, 800); setInterval(tick, 15000);
})();
