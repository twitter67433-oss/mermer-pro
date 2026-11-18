/* NEON//TERMINAL v7.17 — ⏱ SİNYAL tab UI: + SANAL TAKİP (virtual signal journal, paper only — no orders); ONE decision (GİR LONG / GİR SHORT / BEKLE + trigger) with YÖN shown separately; GENEL YÖN (all intervals → one direction + plain summary + ŞİMDİ NE YAPMALI + instant alert), AKILLI SİNYAL (self-learning, A+ only), squeeze → PUMP/DUMP, big chart, mascot "VOLTİ".
   Binance USDⓈ-M FUTURES public data only (fapi.binance.com REST, fstream.binance.com /market + /public WebSockets). No spot, no keys, no orders, no wallet. */
"use strict";
window.SCALP = (() => {
const $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const FUT = "https://fapi.binance.com", WSF = "wss://fstream.binance.com", { TF_MS, TF_SEL, TF_ALL, TF_LBL, higher, dataPeriod, dur } = SCM;
const QUICK = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT", "PAXGUSDT"], HK = "neon.scalp.hist", SK = "neon.scalp.stats", LK = "neon.sinyal.learn";
const fin = x => typeof x === "number" && isFinite(x), clip = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x)), sgn = x => x > 0 ? 1 : x < 0 ? -1 : 0;
const tf0 = localStorage.getItem("neon.scalp.tf");
function alLoad(){ let o = {}; try { o = JSON.parse(localStorage.getItem("neon.sinyal.al") || "{}"); } catch(e){} return { snd: o.snd !== false, vib: o.vib !== false, ntf: o.ntf === undefined ? !!window.NEON_NATIVE : !!o.ntf }; }
const S = { sym: localStorage.getItem("neon.scalp.sym") || "BTCUSDT", tf: TF_SEL.includes(tf0) ? tf0 : "15m", mode: localStorage.getItem("neon.sinyal.mode") === "rev" ? "rev" : "trend", b: {}, btc: null, book: null, bookMem: null, wl: null, der: {}, oiH: [], liq: null,
  W: null, D: null, ws: [], wsOk: false, lastTick: 0, started: false, gen: 0, off: 0, err: null, snd: true, al: alLoad(), ovB: {}, ovR: {}, ovCalcAt: 0, gR: null, gRAt: 0, G: null, A: null, sum: [], curKey: "", pendKey: "", alAt: {}, lastFinal: 0, list: [], poll: null, ov: {}, ovAt: 0, ovBusy: false, view: { n: 50, off: 0 } };
const tfs = () => [S.tf].concat(higher(S.tf)), key = () => S.sym + "@" + S.tf, base = () => S.b[S.tf] || [];
let DP = 2; const fp = x => !fin(x) ? "—" : (+x).toFixed(DP), now = () => Date.now() + S.off, big = x => !fin(x) ? "—" : x >= 1e9 ? (x/1e9).toFixed(2) + "B" : x >= 1e6 ? (x/1e6).toFixed(1) + "M" : x >= 1e3 ? (x/1e3).toFixed(0) + "k" : x.toFixed(0);
const bars = a => a.map(k => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5], T: +k[6], tb: +k[9], x: true }));
async function fj(p){ const r = await fetch(FUT + p, { cache: "no-store" }); if (!r.ok) throw new Error("Binance vadeli HTTP " + r.status + (r.status === 429 ? " (istek limiti)" : r.status === 451 || r.status === 403 ? " (bölge engeli)" : "")); return r.json(); }
const H = { load(){ let o; try { o = JSON.parse(localStorage.getItem(HK) || "{}"); } catch(e){ o = {}; } for (const k of Object.keys(o)) if (!k.includes("@")){ o[k + "@1m"] = (o[k + "@1m"] || []).concat(o[k].map(x => ({ tf: "1m", ...x }))); delete o[k]; } return o; },
  save(o){ const ks = Object.keys(o).sort((a, z) => ((o[z][0] || {}).t || 0) - ((o[a][0] || {}).t || 0)).slice(0, 40), r = {}; ks.forEach(k => r[k] = o[k].slice(0, 50)); try { localStorage.setItem(HK, JSON.stringify(r)); } catch(e){} } };
const ST = { load(){ try { return JSON.parse(localStorage.getItem(SK) || "{}"); } catch(e){ return {}; } }, bump(k0, h, r){ const o = ST.load(); const k = o[k0] = o[k0] || {}; const x = k[h] = k[h] || { n: 0, tp: 0, sl: 0, dir: 0 }; x.n++; if (r.r === "TP") x.tp++; else if (r.r === "SL") x.sl++; if (r.r === "TP" || r.r === "+") x.dir++; try { localStorage.setItem(SK, JSON.stringify(o)); } catch(e){} } };
/* learned weights snapshot per coin+interval+mode (refreshed on every candle close; shown and kept across reloads) */
function saveLearn(W){ try { const o = JSON.parse(localStorage.getItem(LK) || "{}"), cn = W.mode === "rev" ? W.cntR : W.cntT; o[key() + "|" + W.mode] = { at: Date.now(), w: Object.fromEntries(W.keys.map(k => [k, +SMT.wOf(cn[k]).toFixed(3)])) };
  const ks = Object.keys(o).sort((a, b) => o[b].at - o[a].at).slice(0, 60); localStorage.setItem(LK, JSON.stringify(Object.fromEntries(ks.map(k => [k, o[k]])))); } catch(e){} }
/* ---------------- mascot VOLTİ (original inline SVG) ---------------- */
const MASC = `<svg class="masc-svg" viewBox="0 0 120 130" aria-hidden="true">
  <defs><linearGradient id="mMarble" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffdf8"/><stop offset=".45" stop-color="#efe9de"/><stop offset=".55" stop-color="#e4ddd0"/><stop offset="1" stop-color="#f7f3ea"/></linearGradient>
  <linearGradient id="mGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3cc96"/><stop offset=".5" stop-color="#b8975a"/><stop offset="1" stop-color="#7a5a22"/></linearGradient></defs>
  <g class="m-zz"><text x="92" y="22">z</text><text x="100" y="12">Z</text></g>
  <line x1="60" y1="20" x2="60" y2="8" class="m-line"/><circle cx="60" cy="7" r="5" class="m-bulb"/>
  <g class="m-horns"><path d="M28 34 Q16 22 20 10 Q26 24 36 30Z"/><path d="M92 34 Q104 22 100 10 Q94 24 84 30Z"/></g>
  <g class="m-ears"><circle cx="28" cy="26" r="8"/><circle cx="92" cy="26" r="8"/></g>
  <rect x="22" y="20" width="76" height="58" rx="22" class="m-head"/>
  <rect x="32" y="32" width="56" height="30" rx="14" class="m-visor"/>
  <g class="m-eyes e-happy"><path d="M42 50 q6 -9 12 0"/><path d="M66 50 q6 -9 12 0"/></g>
  <g class="m-eyes e-worry"><path d="M41 42 l12 4"/><path d="M79 42 l-12 4"/><circle cx="48" cy="51" r="3.5"/><circle cx="72" cy="51" r="3.5"/></g>
  <g class="m-eyes e-sleep"><path d="M41 48 h13"/><path d="M66 48 h13"/></g>
  <g class="m-eyes e-alert"><circle cx="48" cy="47" r="7"/><circle cx="72" cy="47" r="7"/><circle cx="49" cy="46" r="2.6" class="m-pupil"/><circle cx="73" cy="46" r="2.6" class="m-pupil"/></g>
  <path class="m-mouth mo-smile" d="M50 69 q10 8 20 0"/><path class="m-mouth mo-sad" d="M50 73 q10 -7 20 0"/><path class="m-mouth mo-flat" d="M52 71 h16"/><ellipse class="m-mouth mo-o" cx="60" cy="71" rx="5" ry="4"/>
  <rect x="38" y="80" width="44" height="32" rx="12" class="m-body"/><circle cx="60" cy="95" r="6" class="m-core"/>
  <g class="m-arms a-down"><path d="M38 88 q-12 6 -14 18"/><path d="M82 88 q12 6 14 18"/></g>
  <g class="m-arms a-up"><path d="M38 88 q-14 -6 -16 -20"/><path d="M82 88 q14 -6 16 -20"/></g>
  <path d="M46 112 v10 M74 112 v10" class="m-line"/></svg>`;
/* ---------------- HTML ---------------- */
function html(){ return `<div class="sg-top"><div class="can-search sc-search"><input id="sc-q" placeholder="vadeli coin (BTC, SOL, PAXG=altın…)" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(S.sym)}"><button type="button" id="sc-go" class="mini">SEÇ</button></div>
  <div id="sc-list" class="can-list hidden"></div>
  <div class="tfbar sc-quick">${QUICK.map(s => `<button type="button" data-sq="${s}">${s === "PAXGUSDT" ? "ALTIN" : s.replace("USDT", "")}</button>`).join("")}</div>
  <div class="tfbar sc-tfs" role="toolbar" aria-label="Mum aralığı">${TF_SEL.map(t => `<button type="button" data-stf="${t}" class="${t === S.tf ? "on" : ""}">${TF_LBL[t]}</button>`).join("")}</div>
  <div class="sg-mode"><div class="seg sg-seg"><button type="button" data-md="trend" class="${S.mode === "trend" ? "on" : ""}">TREND</button><button type="button" data-md="rev" class="${S.mode === "rev" ? "on" : ""}">DÖNÜŞ</button></div><span class="sg-als"><label title="sesli uyarı"><input type="checkbox" id="al-snd" ${S.al.snd ? "checked" : ""}>🔊</label><label title="titreşim"><input type="checkbox" id="al-vib" ${S.al.vib ? "checked" : ""}>📳</label><button type="button" id="al-ntf" class="mini" title="tarayıcı bildirimi">${S.al.ntf ? "🔔" : "🔕"}</button></span><span id="sc-st" class="dim sg-st"></span></div></div>
  <div id="sg-gen" class="sg-gen"><div id="sg-now" class="sg-now"><div class="empty">karar hesaplanıyor…</div></div><div class="sg-hero"><div id="sg-masc" class="masc st-wait">${MASC}<div class="masc-name">VOLTİ</div></div><div id="sg-gcard" class="sg-gcard"><div class="empty">GENEL YÖN hesaplanıyor…</div></div></div>
   <div id="sg-bubble" class="sg-bubble">Merhaba! Ben VOLTİ. Tüm aralıkları okuyorum…</div>
   </div>
  <div id="sg-card" class="sg-card sg-mcard"><div class="empty">yükleniyor…</div></div>
  <div class="sg-chartwrap"><canvas id="sc-cv" class="sg-cv"></canvas><div class="sg-zoom"><button type="button" data-z="-1">－</button><button type="button" data-z="1">＋</button><button type="button" data-z="0">⟲</button></div></div>
  <details class="keys sg-jr" id="sg-jr"><summary>📒 SANAL TAKİP <small id="jr-sum" class="dim"></small></summary><div id="jr-box"></div></details>
  <div class="sg-det"><div class="sg-det-h">DETAYLAR</div>
   <details class="keys"><summary>🧭 GENEL YÖN nasıl hesaplanır · geçmiş testi</summary><div id="sd-gen"></div></details>
   <details class="keys"><summary>⚡ Canlı uyarılar</summary><div id="sg-alerts" class="sg-alerts"></div></details>
   <details class="keys"><summary>🧠 Neden bu sinyal?</summary><div id="sd-why"></div></details>
   <details class="keys"><summary>⚖ Öğrenilen ağırlıklar</summary><div id="sd-w"></div></details>
   <details class="keys"><summary>🕯 Mum formasyonları</summary><div id="sd-pat"></div></details>
   <details class="keys"><summary>🗜 Sıkışma / kırılım</summary><div id="sd-sq"></div></details>
   <details class="keys"><summary>🧲 Likidasyon mıknatısları</summary><div id="sd-liq"></div></details>
   <details class="keys"><summary>🧱 Emir defteri duvarları · spoof</summary><div id="sd-ob"></div></details>
   <details class="keys"><summary>📍 Kilit seviyeler · BTC · seans</summary><div id="sd-lv"></div></details>
   <details class="keys"><summary>📜 Sinyal geçmişi · isabet</summary><div id="sc-hist"></div></details>
   <details class="keys"><summary>⟲ Geriye dönük test</summary><div id="sc-bt"></div></details></div>
  <div class="plan-foot">AKILLI SİNYAL yalnızca <b>sinyaldir</b>: emir göndermez, API anahtarı ve cüzdana dokunmaz. Sinyaller <b>olasılıksaldır, garanti değildir</b>. "Geçmişte %X tuttu" bu coin + aralığın yüklü geçmişinden, o anki bilgiyle (ileriye bakmadan) hesaplanır; geçmiş gelecek değildir. Ücret ≈ %0.10 gidiş-dönüş dahil edilir. Veri: yalnızca Binance USDⓈ-M vadeli (anahtarsız, spot kullanılmaz). Yatırım tavsiyesi değildir.</div>`; }
/* ---------------- list / search ---------------- */
async function loadList(){ if (S.list.length) return; try { const ei = await fj("/fapi/v1/exchangeInfo"); S.list = ei.symbols.filter(s => /PERPETUAL/.test(s.contractType) && s.quoteAsset === "USDT" && s.status === "TRADING").map(s => ({ s: s.symbol, b: s.baseAsset, tick: +((s.filters.find(f => f.filterType === "PRICE_FILTER") || {}).tickSize || 0.01) })); } catch(e){} }
function search(q){ q = String(q || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); const L = S.list; if (!q) return L.slice(0, 30);
  return L.filter(x => x.s.startsWith(q) || x.b.startsWith(q) || x.b.replace(/^1000+|^1M/, "").startsWith(q)).concat(L.filter(x => !(x.s.startsWith(q) || x.b.startsWith(q)) && x.s.includes(q))).slice(0, 30); }
function paintList(q){ const el = $("#sc-list"); if (!el) return; const r = search(q); el.classList.remove("hidden");
  el.innerHTML = r.length ? r.map(x => `<button type="button" data-ss="${esc(x.s)}"><b>${esc(x.s)}</b><small>USDⓈ-M perp</small><small></small></button>`).join("") : `<div class="dim" style="padding:8px">${S.list.length ? "Binance USDⓈ-M vadelide böyle bir USDT perp yok" : "liste yükleniyor…"}</div>`; }
/* ---------------- data (futures only) ---------------- */
async function loadKlines(sym, my){ const T = tfs(), K = await Promise.all(T.map((t, i) => fj(`/fapi/v1/klines?symbol=${sym}&interval=${t}&limit=${i ? 300 : 1000}`))); if (my !== S.gen) return;
  S.b = {}; S.bSym = sym; T.forEach((t, i) => { const a = bars(K[i]), l = a[a.length - 1]; if (l && l.T > now()) l.x = false; S.b[t] = a; }); }
async function loadBtc(my){ if (S.sym === "BTCUSDT"){ S.btc = null; return; } try { const a = bars(await fj(`/fapi/v1/klines?symbol=BTCUSDT&interval=${S.tf}&limit=1000`)); if (my === S.gen){ const l = a[a.length - 1]; if (l && l.T > now()) l.x = false; S.btc = a; S.btcAt = Date.now(); } } catch(e){} }
async function loadDer(sym, my){ const o = p => fj(p).catch(() => null), per = dataPeriod(S.tf);
  const [pr, oi, ls, tk] = await Promise.all([o(`/fapi/v1/premiumIndex?symbol=${sym}`), o(`/futures/data/openInterestHist?symbol=${sym}&period=${per}&limit=200`), o(`/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=${per}&limit=1`), o(`/futures/data/takerlongshortRatio?symbol=${sym}&period=${per}&limit=200`)]);
  if (my !== S.gen) return; const tkm = new Map((tk || []).map(x => [+x.timestamp, +x.buySellRatio]));
  S.oiH = (oi || []).map(x => { const r = tkm.get(+x.timestamp); return { t: +x.timestamp, oi: +x.sumOpenInterest, px: +x.sumOpenInterestValue/+x.sumOpenInterest, ls: fin(r) ? r/(1 + r) : 0.5 }; });
  const o7 = S.oiH.slice(-7), oc = o7.length > 1 && o7[0].oi ? (o7[o7.length - 1].oi/o7[0].oi - 1)*100 : NaN, tl = tk && tk.length ? +tk[tk.length - 1].buySellRatio : NaN;
  S.der = { fund: pr ? +pr.lastFundingRate : NaN, oiCh: oc, per: TF_LBL[per], ls: ls && ls[0] ? +ls[0].longShortRatio : NaN, tk: tl, at: Date.now() }; }
async function loadBook(sym, my){ try { const d = await fj(`/fapi/v1/depth?symbol=${sym}&limit=500`); if (my !== S.gen) return; S.book = d; S.bookAt = Date.now(); const w = SMT.walls(d, S.bookMem, Date.now()); S.bookMem = w.mem; S.wl = w;
    const mid = w.mid, band = mid*0.0025; let b = 0, a = 0; for (const [p, q] of d.bids) if (mid - +p <= band) b += +q*+p; for (const [p, q] of d.asks) if (+p - mid <= band) a += +q*+p; S.imb = b + a ? (b - a)/(b + a) : 0; } catch(e){} }
function onKline(k, tf){ const x0 = { t: +k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v, T: +k.T, tb: +k.V, x: !!k.x }; let fin1 = false, upd = false;
  for (const [a, cap] of [[S.b[tf], 1200], [S.ovB[tf] !== S.b[tf] ? S.ovB[tf] : null, 520]]){ if (!a || !a.length) continue; const x = { ...x0 }, l = a[a.length - 1];
    if (x.t === l.t){ a[a.length - 1] = x; upd = true; } else if (x.t > l.t){ if (!l.x){ l.x = true; if (a === S.b[tf]) fin1 = true; } a.push(x); if (a.length > cap) a.shift(); upd = true; } }
  if (!upd) return; if (tf === S.tf){ if (fin1) finalize(); S.lastTick = Date.now(); if (x0.x) finalize(); } }
function closeWs(){ (S.ws || []).forEach(w => { try { w.onclose = null; w.close(); } catch(e){} }); S.ws = []; S.wsOk = false; }
/* Binance USDⓈ-M WebSocket split (2026): klines on /market */
function connect(sym){ closeWs(); S.wsAt = Date.now(); const s = sym.toLowerCase(), my = S.gen, streams = Array.from(new Set(tfs().concat(TF_SEL))).map(t => `${s}@kline_${t}`); if (sym !== "BTCUSDT") streams.push(`btcusdt@kline_${S.tf}`);
  let ws; try { ws = new WebSocket(WSF + "/market/stream?streams=" + streams.join("/")); } catch(e){ startPoll(); return; } S.ws = [ws];
  ws.onopen = () => { if (my !== S.gen) return; S.wsOk = true; S.wsAt = Date.now(); paintSt(); };
  ws.onmessage = ev => { if (my !== S.gen) return; try { const m = JSON.parse(ev.data), d = m.data || m; if (!d.k) return; if (d.s === "BTCUSDT" && sym !== "BTCUSDT") onBtc(d.k); else { onKline(d.k, d.k.i); stopPoll(); } } catch(e){} };
  ws.onclose = () => { if (my !== S.gen) return; S.wsOk = false; startPoll(); paintSt(); setTimeout(() => { if (my === S.gen && !S.wsOk) connect(sym); }, 8000); }; ws.onerror = () => {}; }
function onBtc(k){ const a = S.btc; if (!a || !a.length) return; const x = { t: +k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v, T: +k.T, tb: +k.V, x: !!k.x }, l = a[a.length - 1]; if (x.t === l.t) a[a.length - 1] = x; else if (x.t > l.t){ l.x = true; a.push(x); if (a.length > 1200) a.shift(); } }
function startPoll(){ if (S.poll) return; S.poll = setInterval(async () => { const my = S.gen, sym = S.sym, tf = S.tf; try { const k = await fj(`/fapi/v1/klines?symbol=${sym}&interval=${tf}&limit=3`); if (my !== S.gen) return;
    for (const r of k){ const T = +r[6]; onKline({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5], T, V: r[9], x: T < now() }, tf); } S.pollErr = 0; } catch(e){ S.pollErr = (S.pollErr || 0) + 1; paintSt(e.message); } }, 3000); }
function stopPoll(){ if (S.poll){ clearInterval(S.poll); S.poll = null; } }
async function start(sym, tf){ sym = String(sym || S.sym).toUpperCase().replace(/[^A-Z0-9]/g, ""); if (!sym) return; if (tf && TF_SEL.includes(tf)) S.tf = tf; const my = ++S.gen;
  Object.assign(S, { sym, W: null, D: null, err: null, book: null, bookMem: null, wl: null, der: {}, oiH: [], liq: null, btc: null, lastFinal: 0, ovB: {}, ovR: {}, ovCalcAt: 0, gR: null, gRAt: 0, G: null, A: null, sum: [], curKey: "", pendKey: "", view: { n: S.view.n, off: 0 } }); stopPoll(); closeWs();
  localStorage.setItem("neon.scalp.sym", sym); localStorage.setItem("neon.scalp.tf", S.tf);
  const q = $("#sc-q"); if (q) q.value = sym; document.querySelectorAll("[data-stf]").forEach(x => x.classList.toggle("on", x.dataset.stf === S.tf)); paintHead(); paintAll();
  try { await loadList(); const info = S.list.find(x => x.s === sym); if (S.list.length && !info) throw new Error(sym + " Binance USDⓈ-M vadelide USDT perp olarak yok");
    await loadKlines(sym, my); if (my !== S.gen) return; if (!base().length) throw new Error("mum verisi yok");
    const lp = base()[base().length - 1].c; DP = info ? Math.max(0, Math.min(8, Math.round(-Math.log10(info.tick)))) : Math.max(0, Math.min(8, 5 - Math.floor(Math.log10(lp || 1))));
    await Promise.all([loadDer(sym, my), loadBook(sym, my), loadBtc(my)]); if (my !== S.gen) return; connect(sym); compute(true); resolveAll(); if (S.W) saveLearn(S.W); loadOv(sym, my); }
  catch(e){ if (my === S.gen){ S.err = e.message; paintAll(); } } }
/* ---------------- engine ---------------- */
function liveDerVotes(){ const D = S.der, v = {}; if (fin(D.fund)) v.fund = D.fund > 0.0005 ? -1 : D.fund > 0.0002 ? -0.4 : D.fund < -0.0003 ? 1 : D.fund < 0 ? 0.3 : 0;
  const b = base(), n = b.length; if (fin(D.oiCh) && n > 8){ const pu = sgn(b[n - 1].c - b[n - 8].c); v.oi = D.oiCh > 0.3 ? pu : D.oiCh < -0.3 ? pu*0.3 : 0; }
  if (fin(D.tk)) v.tk = D.tk > 1.15 ? 1 : D.tk > 1.03 ? 0.4 : D.tk < 0.87 ? -1 : D.tk < 0.97 ? -0.4 : 0; if (fin(D.ls)) v.ls = D.ls > 2.5 ? -0.8 : D.ls > 1.8 ? -0.3 : D.ls < 0.7 ? 0.8 : D.ls < 0.9 ? 0.3 : 0;
  if (S.wl) v.wall = clip(S.wl.tilt*1.2); if (fin(S.imb)) v.ob = Math.abs(S.imb) < 0.08 ? 0 : clip(S.imb*2); return v; }
function run(closedOnly){ const T = tfs(), b = closedOnly ? base().filter(x => x.x) : base(); if (b.length < 120) return null; const P = SMT.prep(b, { tms: TF_MS[S.tf], h1: S.b[T[1]], h2: S.b[T[2]], btc: S.btc });
  const l = b[b.length - 1]; if (!l.x){ const el = clip((now() - l.t)/(l.T - l.t + 1), 0.15, 1); P.volProj = l.v/el; } return { P, W: SMT.walk(P, { mode: S.mode }) }; }
function decide(R){ const W = R.W, L = W.live, P = R.P, b = P.b, i = L.i, px = b[i].c, dv = liveDerVotes(), dsum = Object.values(dv).reduce((s, x) => s + x, 0), out = { px, i, L, dv, alerts: [] };
  const SQ = W.sqB, sqStat = d => { const B = d > 0 ? SQ.up : SQ.dn; return { n: B.tp + B.sl, hit: SMT.hitB(B), net: B.n ? B.pnl/B.n : null }; };
  if (S.liq){ const near = [...S.liq.above.slice(0, 1), ...S.liq.below.slice(0, 1)]; void near; }
  if (L.info === undefined) void 0;
  const A = L.a, info = A.info; if (info.btc) out.alerts.push({ c: info.btc.dir > 0 ? "up" : "dn", t: `BTC ${info.btc.dir > 0 ? "↑ kırdı" : "↓ kırdı"} (${info.btc.bm.toFixed(1)} ATR) — ${S.sym.replace("USDT", "")} henüz takip etmedi` });
  if (S.wl && S.wl.mem && S.wl.mem.spoof.length) out.alerts.push({ c: "y", t: `spoof şüphesi: ${S.wl.mem.spoof.length} duvar fiyat gelmeden kayboldu (15 dk)` });
  if (info.lvl) out.alerts.push({ c: "c", t: "seviye: " + info.lvl.replace("dH", "gün tepesi").replace("dL", "gün dibi").replace("pH", "dünkü tepe").replace("pL", "dünkü dip").replace("wO", "hafta açılışı") });
  const cdiv = A.T.cvdd; if (cdiv) out.alerts.push({ c: cdiv > 0 ? "up" : "dn", t: `CVD uyumsuzluğu: fiyat ${cdiv > 0 ? "yeni dip, alıcı akışı güçlü" : "yeni tepe, alıcı akışı zayıf"}` });
  if (L.sq || L.sqRecent){ const z = L.sq || L.sqRecent, d = z.d, bx = L.sq ? L.sq.box : P.box[z.i - 1], st = sqStat(d); out.state = d > 0 ? "PUMP" : "DUMP"; out.d = d; out.box = bx; out.conf = st;
    out.plan = { entry: L.sq ? px : z.entry, stop: L.sq ? L.sq.stop : z.stop, tp: L.sq ? L.sq.tp : z.tp }; out.sub = L.sq ? "kırılım — mum kapanışında onaylanır" : "kutu kırıldı, hacimle onaylı"; return out; }
  if (L.fake){ out.alerts.unshift({ c: "y", t: `SAHTE KIRILIM: ${L.fake.d > 0 ? "yukarı" : "aşağı"} kırılım kutuya geri döndü` }); out.box = L.fake.box; }
  if (L.squeeze && !L.fake){ const bx = L.squeeze.box, n = P.n, f = { pos: bx ? clip(((px - bx.lo)/(bx.hi - bx.lo || 1) - 0.5)*2) : null, cvd: bx ? clip((P.cvd[i] - P.cvd[bx.from])/((P.vs20[i] || 1)*bx.len)*4) : null,
      tk: fin(S.der.tk) ? clip((S.der.tk - 1)*5) : null, ob: S.wl ? clip(S.wl.tilt) : fin(S.imb) ? S.imb : null, oi: fin(S.der.oiCh) ? clip(S.der.oiCh/2)*sgn(P.cvd[i] - P.cvd[Math.max(0, i - 10)]) : null,
      fund: fin(S.der.fund) ? -clip(S.der.fund/0.0005) : null, liq: S.liq ? clip(S.liq.pull) : null, mtf: A.T.mtf, btc: A.T.btc || null }; void n;
    const sd = SMT.squeezeDir(f); out.state = "SIKIŞMA"; out.box = bx; out.pUp = sd.pUp; out.sqParts = sd.parts; out.d = sd.pUp >= 0.5 ? 1 : -1; out.sub = "patlama yakın";
    out.plan = bx ? { longAbove: bx.hi, shortBelow: bx.lo, h: bx.hi - bx.lo } : null; return out; }
  if (L.aplus){ if (dsum*L.d <= -1.5){ out.state = "BEKLE"; out.lean = L.d; out.reason = "canlı türev/defter verisi ters yönde"; } else { out.state = L.d > 0 ? "LONG" : "SHORT"; out.d = L.d; out.conf = L.setup; out.plan = { entry: L.plan.entry, stop: L.plan.stop, tp: L.plan.tp, tp2: L.plan.tp2 }; return out; } }
  out.state = "BEKLE"; out.lean = out.lean || (Math.abs(L.sc.S) >= 0.1 ? L.d : 0); out.reason = out.reason || L.why[0] || "net kurulum yok"; out.conf = L.setup; return out; }
let lastRun = 0;
function compute(force){ if (!base().length) return; const t = Date.now(); if (!force && t - lastRun < 2000) return; lastRun = t;
  try { const R = run(false); if (!R){ S.err = "yeterli mum yok (en az 120 gerekir) — daha kısa aralık seç"; paintAll(); return; } S.R = R; S.W = R.W; if (S.oiH.length) S.liq = SMT.liqMagnets(S.oiH, R.P.c[R.P.n - 1], R.P.b); S.D = decide(R); S.err = null; summarize(); }
  catch(e){ S.err = "hesap hatası: " + e.message; } if (visible()) paintAll(); }
function finalize(){ const b = base().filter(x => x.x), l = b[b.length - 1]; if (!l || l.t <= S.lastFinal) return; S.lastFinal = l.t; jTrigCheck(l); let R, D; try { R = run(true); if (!R) return; D = decide(R); } catch(e){ return; }
  saveLearn(R.W); const all = H.load(), L = all[key()] = all[key()] || []; if (L.length && L[0].t >= l.t) return; const prev = L[0], act = ["LONG", "SHORT", "PUMP", "DUMP"].includes(D.state) && D.plan && fin(D.plan.stop);
  L.unshift({ tf: S.tf, t: l.t, side: act ? (D.d > 0 ? "LONG" : "SHORT") : "BEKLE", state: D.state, mode: S.mode, conf: D.conf && fin(D.conf.hit) ? Math.round(D.conf.hit*100) : null, entry: l.c, stop: act ? D.plan.stop : null, tp1: act ? D.plan.tp : null, res: {} });
  H.save(all); resolveAll(); void prev; }
function resolveAll(){ const all = H.load(), k = key(), L = all[k]; if (!L) return; let ch = false; const b1 = base();
  for (const s of L){ s.tf = s.tf || S.tf; if (s.side === "BEKLE" || !fin(s.stop)) continue; for (const h of [2, 3, 5]){ if (s.res[h]) continue; const r = SCM.outcome(s, b1, h); if (r){ s.res[h] = r; ch = true; ST.bump(k, h, r); } } }
  if (ch){ H.save(all); paintHist(); } }
function alarm(side){ if (S.al.vib) try { navigator.vibrate && navigator.vibrate(side === "LONG" ? [120, 80, 120, 80, 120] : [300, 100, 300]); } catch(e){}
  if (S.al.snd) try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; const ac = alarm.ac = alarm.ac || new C(), o = ac.createOscillator(), g = ac.createGain(); ac.resume && ac.resume(); o.frequency.value = side === "LONG" ? 880 : 330; g.gain.value = 0.09; o.connect(g); g.connect(ac.destination); o.start(); o.frequency.setValueAtTime(side === "LONG" ? 1175 : 247, ac.currentTime + 0.18); o.stop(ac.currentTime + 0.4); } catch(e){} }
/* ---------------- v7.14 all intervals: REST once (sequential, 499 bars), then live via the same /market WS; recomputed every ~15 s ---------------- */
async function loadOv(sym, my){ for (const t of TF_SEL){ if (my !== S.gen) return; if (S.b[t] && S.b[t].length >= 300){ S.ovB[t] = S.b[t]; continue; }
    try { const a = bars(await fj(`/fapi/v1/klines?symbol=${sym}&interval=${t}&limit=499`)), l = a[a.length - 1]; if (l && l.T > now()) l.x = false; if (my === S.gen) S.ovB[t] = a; } catch(e){} await new Promise(r => setTimeout(r, 120)); }
  if (my === S.gen){ S.ovCalcAt = 0; ovCalc(true); } }
const dOf = (st, v) => st === "LONG" || st === "PUMP" ? 1 : st === "SHORT" || st === "DUMP" ? -1 : st === "SIKIŞMA" ? (v || 0)*0.5 : v;
async function ovCalc(force){ if (S.ovBusy || (!force && Date.now() - S.ovCalcAt < 15000)) return; S.ovBusy = true; S.ovCalcAt = Date.now(); const my = S.gen;
  try { for (const t of TF_SEL){ await new Promise(r => setTimeout(r, 0)); if (my !== S.gen) return; if (t === S.tf) continue; const K = S.ovB[t]; if (!K || K.length < 60){ S.ovR[t] = null; continue; }
      try { const H = SMT.prepHigher(K), v = H ? H.v[H.v.length - 1] : null, rel = SMT.tfRel(H, K.map(x => x.c), 3); let st = "BEKLE", pUp = null;
        if (K.length >= 150){ const [h1, h2] = higher(t), P = SMT.prep(K, { tms: TF_MS[t], h1: S.ovB[h1], h2: S.ovB[h2] }), L = SMT.walk(P, { mode: S.mode }).live;
          st = L.sq || L.sqRecent ? ((L.sq || L.sqRecent).d > 0 ? "PUMP" : "DUMP") : L.squeeze ? "SIKIŞMA" : L.aplus ? (L.d > 0 ? "LONG" : "SHORT") : "BEKLE";
          { const px1 = P.c[P.n - 1], z = L.sq || L.sqRecent; S.ovP = { atr: P.A[P.n - 1], d: z ? z.d : L.d, plan: L.sq ? { entry: px1, stop: L.sq.stop, tp: L.sq.tp } : L.sqRecent ? { entry: z.entry, stop: z.stop, tp: z.tp } : L.aplus && L.plan ? { entry: L.plan.entry, stop: L.plan.stop, tp: L.plan.tp } : null }; }
          if (st === "SIKIŞMA" && L.squeeze.box){ const bx = L.squeeze.box, i = P.n - 1, px = P.c[i]; pUp = SMT.squeezeDir({ pos: clip(((px - bx.lo)/(bx.hi - bx.lo || 1) - 0.5)*2), cvd: clip((P.cvd[i] - P.cvd[bx.from])/((P.vs20[i] || 1)*bx.len)*4), mtf: L.a.T.mtf }).pUp; } }
        let plan = null, sd = 0, atr = null; if (K.length >= 150 && S.ovP){ const X = S.ovP; plan = X.plan; sd = X.d; atr = X.atr; } S.ovP = null;
        S.ovR[t] = { st, v, d: dOf(st, v), rel, pUp, plan, sd, atr, px: K[K.length - 1].c }; } catch(e){ S.ovR[t] = null; } }
    if (my === S.gen && (Date.now() - S.gRAt > 120000 || !S.gR)){ S.gRAt = Date.now(); const K = { ...S.ovB }; K[S.tf] = base(); try { S.gR = SMT.gReplay(K, S.tf); } catch(e){ S.gR = null; } }
    if (my === S.gen) summarize(); } finally { S.ovBusy = false; } }
/* ---------------- GENEL YÖN: one direction + summary + action ---------------- */
function mainItem(){ const b = base(); if (b.length < 60 || !S.D) return null; const H = SMT.prepHigher(b), v = H.v[H.v.length - 1]; return { st: S.D.state, v, d: dOf(S.D.state, v), rel: SMT.tfRel(H, b.map(x => x.c), 3), pUp: S.D.pUp, main: true }; }
function extraItem(I){ const D = S.D, L1 = TF_LBL[S.tf], px = D ? D.px : null; if (!D) return null;
  if (D.state === "PUMP" || D.state === "DUMP") return `${L1}'da yatay kutu ${D.state === "PUMP" ? "yukarı" : "aşağı"} kırıldı (${D.state}).`;
  if (D.state === "SIKIŞMA") return `${L1}'da sıkışma var, ${D.pUp >= 0.5 ? "yukarı" : "aşağı"} kırılım olasılığı %${Math.round(Math.max(D.pUp, 1 - D.pUp)*100)}.`;
  if (D.L && D.L.fake) return `${L1}'da SAHTE KIRILIM: ${D.L.fake.d > 0 ? "yukarı" : "aşağı"} kırılım kutuya geri döndü.`;
  const sq = TF_SEL.filter(t => I[t] && I[t].st === "SIKIŞMA" && TF_MS[t] >= 9e5); if (sq.length){ const t = sq[0], p = I[t].pUp; return `${TF_LBL[t]}'da sıkışma var${fin(p) ? `, ${p >= 0.5 ? "yukarı" : "aşağı"} kırılım olasılığı %${Math.round(Math.max(p, 1 - p)*100)}` : ""}.`; }
  const A = D.L && D.L.a, info = A && A.info; if (info && info.btc) return `BTC ${info.btc.dir > 0 ? "yukarı" : "aşağı"} kırdı, ${S.sym.replace("USDT", "")} henüz takip etmedi (BTC öncülük).`;
  const pt = info && (info.pats || []).find(p => p.ctx); if (pt) return `${L1} mumunda ${pt.n} (${pt.d > 0 ? "yukarı" : "aşağı"} işaret, bağlamlı).`;
  if (S.liq && fin(px)){ const c = [...(S.liq.above || []).slice(0, 1).map(x => ({ ...x, up: 1 })), ...(S.liq.below || []).slice(0, 1).map(x => ({ ...x, up: 0 }))].filter(x => fin(x.p)).sort((a, z) => Math.abs(a.p - px) - Math.abs(z.p - px))[0];
    if (c) return `Likidasyon mıknatısı ${c.up ? "yukarıda" : "aşağıda"} ${fp(c.p)} (%${(Math.abs(c.p/px - 1)*100).toFixed(1)} uzakta).`; }
  if (info && info.lvl) return `Fiyat kilit seviyede (${info.lvl.replace("dH", "gün tepesi").replace("dL", "gün dibi").replace("pH", "dünkü tepe").replace("pL", "dünkü dip").replace("wO", "hafta açılışı")}).`;
  return null; }
function summarize(){ if (!S.D || !S.R) return; const I = {}; for (const t of TF_SEL) if (S.ovR[t]) I[t] = S.ovR[t]; const mi = mainItem(); if (mi) I[S.tf] = mi;
  const C = SMT.consensus(I), P = S.R.P, n = P.n - 1; let A = SMT.action(C, { main: S.D, px: S.D.px, atr: P.A[n], ema21: P.e21[n] });
  if (A.kind === "trend" && !SMT.gGate(S.gR)){ const T = S.gR && S.gR.T; A = { act: "BEKLE", d: 0, prefer: C.dir, kind: "kapı", wait: "A+ onayını bekle",
    note: T && T.n ? `${C.label} ama bu kural ${S.sym.replace("USDT", "")} ${TF_LBL[S.tf]}'da geçmişte %${Math.round(T.win*100)} kazandırdı (${T.n} giriş, ücret sonrası ${T.net >= 0 ? "+" : ""}${T.net.toFixed(1)}%)` : `${C.label} ama bu kural için yeterli geçmiş yok` }; }
  const bb = base().slice(-10), f = v => fp(v); S.dec = SMT.decision(C, A, { px: S.D.px, atr: P.A[n], ema21: P.e21[n], hi: Math.max(...bb.map(k => k.h)), lo: Math.min(...bb.map(k => k.l)), f });
  S.mv = SMT.mainView(S.dec, S.D, mi, TF_LBL[S.tf]);
  S.G = C; S.A = A; S.I = I; S.sum = SMT.summary(I, C, TF_LBL, extraItem(I)); if (visible()) paintGen(); checkAlert(); jFromDecision(C, A, P.A[n]); }
function actKey(){ const A = S.A, C = S.G; if (!A || !C) return ""; if (A.act !== "BEKLE") return A.act; if (C.strong) return "YÖN " + SMT.DIRW[C.label]; return ""; }
function checkAlert(){ const k = actKey(); if (k === S.curKey){ S.pendKey = ""; return; } if (!k){ S.curKey = ""; S.pendKey = ""; return; }
  if (S.pendKey !== k){ S.pendKey = k; return; } /* must hold on two consecutive updates (≈2+ s) so a flicker does not ring */
  S.curKey = k; S.pendKey = ""; if (Date.now() - (S.alAt[k] || 0) < 600000) return; S.alAt[k] = Date.now(); fireAlert(k); }
function fireAlert(k, test){ const up = /LONG|YUKARI/.test(k), coin = S.sym.replace("USDT", ""), A = S.A || {}, body = (test ? "[TEST] " : "") + `${coin} ${TF_LBL[S.tf]}: ${k}` + (fin(A.entry) && A.act !== "BEKLE" ? ` · giriş ${fp(A.entry)} stop ${fp(A.stop)} hedef ${fp(A.tp)}` : "");
  alarm(up ? "LONG" : "SHORT"); const g = $("#sg-gen"); if (g){ g.classList.remove("flash"); void g.offsetWidth; g.classList.add("flash"); setTimeout(() => g.classList.remove("flash"), 6000); }
  S.lastAlert = { k, at: Date.now(), body, test: !!test };
  if (S.al.ntf && window.Notification && Notification.permission === "granted"){ const o = { body, tag: "neon-sinyal", renotify: true };
    try { navigator.serviceWorker && navigator.serviceWorker.getRegistration ? navigator.serviceWorker.getRegistration().then(r => r ? r.showNotification("MERMER SİNYAL · " + k, o) : new Notification("MERMER SİNYAL · " + k, o)).catch(() => { try { new Notification("MERMER SİNYAL · " + k, o); } catch(e){} }) : new Notification("MERMER SİNYAL · " + k, o); } catch(e){} }
  return body; }
const ARW = { "GÜÇLÜ LONG": "⇈", LONG: "↑", "NÖTR": "↔", SHORT: "↓", "GÜÇLÜ SHORT": "⇊" };
function paintGen(){ const gc = $("#sg-gcard"), bub = $("#sg-bubble"), nw = $("#sg-now"), m = $("#sg-masc"); if (!gc) return;
  if (S.err){ gc.innerHTML = `<div class="err-line">✖ ${esc(S.err)}<br><small>Vadeli veri alınamadı — spot'a geçilmez.</small></div><button type="button" id="sc-retry" class="mini wide">↻ TEKRAR DENE</button>`; $("#sc-retry").onclick = () => start(S.sym);
    m.className = "masc st-short"; bub.textContent = "Veri gelmedi… tekrar deneyelim mi?"; bub.className = "sg-bubble dn"; nw.innerHTML = ""; return; }
  const C = S.G, A = S.A; if (!C || !A){ gc.innerHTML = `<div class="empty">GENEL YÖN hesaplanıyor…</div>`; return; }
  const cls = C.dir > 0 ? "up" : C.dir < 0 ? "dn" : "y", have = TF_SEL.filter(t => S.I[t]).length, w = Math.min(50, Math.abs(C.G)*50);
  const dots = TF_SEL.map(t => { const x = S.I[t], d = x ? sgn(Math.abs(x.d) >= 0.25 ? x.d : 0) : null, ic = !x ? "·" : x.st === "PUMP" ? "🚀" : x.st === "DUMP" ? "💥" : x.st === "SIKIŞMA" ? "◇" : d > 0 ? (x.st === "LONG" ? "▲" : "↑") : d < 0 ? (x.st === "SHORT" ? "▼" : "↓") : "•";
    return `<button type="button" data-stf="${t}" class="gd ${!x ? "na" : x.st === "SIKIŞMA" ? "m" : d > 0 ? "up" : d < 0 ? "dn" : "n"}${t === S.tf ? " on" : ""}" title="${TF_LBL[t]} ${x ? x.st + " · eğilim " + (x.d || 0).toFixed(2) : "veri yok"}"><i>${ic}</i><small>${TF_LBL[t]}</small></button>`; }).join("");
  const dec = S.dec || { word: "BEKLE", line: "BEKLE", text: "BEKLE.", yon: "↔ YÖN: YATAY", dirW: "YATAY" }, wc = dec.word === "GİR LONG" ? "up" : dec.word === "GİR SHORT" ? "dn" : "y";
  gc.innerHTML = `<div class="sg-glab">GENEL YÖN <small class="dim">${esc(S.sym.replace("USDT", ""))} · ${have}/12 aralık · yön, işlem değil</small></div>
    <div class="sg-gdir sg-yon ${cls}">${esc(dec.yon)}</div>
    <div class="sg-bar" title="−100 AŞAĞI … +100 YUKARI"><span class="sg-bar0"></span><span class="sg-barf ${cls}" style="${C.G >= 0 ? "left:50%" : "right:50%"};width:${w}%"></span></div>
    <div class="dim sg-gsub">güç <b class="${cls}">%${C.strength}</b> · büyük ${C.big >= 0 ? "+" : ""}${Math.round(C.big*100)} · kısa ${C.short >= 0 ? "+" : ""}${Math.round(C.short*100)}${fin(C.relAvg) ? ` · aralık isabeti ~%${Math.round(C.relAvg*100)}` : ""}</div>
    <div class="sg-dots">${dots}</div>`;
  bub.innerHTML = [dec.text].concat(S.sum).slice(0, 4).map((x, k) => k ? esc(x) : `<b>${esc(x)}</b>`).join("<br>"); bub.className = "sg-bubble " + wc;
  const lv = dec.word === "BEKLE" ? `<div class="sg-dline">→ ${dec.trig.length ? dec.trig.map(t => `<span class="${t.d > 0 ? "up" : "dn"}">${esc(t.t)}</span>`).join(" · ") : "net tetik yok"}</div>`
    : `<div class="sg-dline"><span>giriş <b>${fp(A.entry)}</b></span> · <span>stop <b class="dn">${fp(A.stop)}</b></span> · <span>hedef <b class="up">${fp(A.tp)}</b></span> <small class="dim">${esc(A.kind)}</small></div>`;
  nw.innerHTML = `<div class="sg-nowh">ŞİMDİ NE YAPMALI? <small class="dim">· ${esc(dec.yon)}</small></div><div class="sg-dword ${wc}">${dec.word}</div>${lv}${dec.note ? `<div class="dim sg-dnote">${esc(dec.note)}</div>` : ""}`;
  nw.className = "sg-now sg-dec " + wc;
  const D = S.D; m.className = "masc " + (dec.word === "GİR LONG" ? (D && D.state === "PUMP" ? "st-pump" : "st-long") : dec.word === "GİR SHORT" ? (D && D.state === "DUMP" ? "st-dump" : "st-short") : A.wait === "kırılımı bekle" ? "st-sqz" : "st-wait");
  const sd = $("#sd-gen"); if (sd && sd.closest("details").open) paintGenDet(); }
function paintGenDet(){ const el = $("#sd-gen"); if (!el) return; const g = S.gR, C = S.G, P2 = x => fin(x) ? "%" + (x*100).toFixed(1) : "—";
  const rows = TF_SEL.map(t => { const x = S.I && S.I[t]; return `<tr><td>${TF_LBL[t]}</td><td class="${x && x.d > 0.25 ? "up" : x && x.d < -0.25 ? "dn" : ""}">${x ? x.st + " " + (x.d >= 0 ? "+" : "") + x.d.toFixed(2) : "—"}</td><td>${x && x.rel && x.rel.n ? P2(SMT.relAcc(x.rel)) + ` <small>${x.rel.n}</small>` : "—"}</td><td>${(SMT.GW[t]).toFixed(2)}</td></tr>`; }).join("");
  el.innerHTML = `<div class="dim" style="font-size:11px;line-height:1.45">Her aralığın trend oyu (EMA9/21, SuperTrend, MACD, fiyat/EMA21; A+ / PUMP / DUMP varsa ±1) birleştirilir: <b>büyük resim 1s–1G %60</b>, orta 15–30dk %25, kısa 1–5dk %15 (zamanlama). Her aralığın ağırlığı kendi ölçülen isabetiyle (sonraki 3 mum, az örnekte %50'ye çekilir) ölçeklenir. |G| ≥ 20 → LONG/SHORT, ≥ 50 ve büyük+orta aynı yön → GÜÇLÜ. <b>GİR</b> yalnızca A+ / PUMP-DUMP (kendi geçmişi geçen) ya da GÜÇLÜ + kısa vade aynı yön <i>ve</i> bu kural bu coin + aralıkta geçmişte ≥%55 kazandırıp ücret sonrası artıdaysa (≥20 giriş).</div>
    <table class="can-t"><tr><th>aralık</th><th>durum · oy</th><th>isabet</th><th>taban ağ.</th></tr>${rows}</table>
    ${g && g.T ? `<div style="margin-top:6px;font-size:11.5px">Yüklü veriyle geçmiş testi (${TF_LBL[S.tf]}, ~${g.days.toFixed(1)} gün, ileriye bakmadan): yön isabeti (3 mum) <b>${P2(g.dir.n ? g.dir.ok/g.dir.n : null)}</b> (${g.dir.n}) · GÜÇLÜ ${P2(g.str.n ? g.str.ok/g.str.n : null)} · GİR(trend) ${g.T.n} giriş, kazanan ${P2(g.T.win)}, ücret sonrası toplam <b class="${g.T.net >= 0 ? "up" : "dn"}">${g.T.net.toFixed(2)}%</b> → ${SMT.gGate(g) ? '<b class="up">kapı açık</b>' : '<b class="y">kapı kapalı (GİR gösterilmez)</b>'}<br><small class="dim">Kısa aralıkların yüklü geçmişi kısa (1dk ≈ 8 saat); eski mumlarda eksik aralıklar hariç tutulur.</small></div>` : `<div class="dim">geçmiş testi hesaplanıyor…</div>`}`; }
const SC = { LONG: "up", PUMP: "up", SHORT: "dn", DUMP: "dn", "SIKIŞMA": "m", BEKLE: "y" }, ICO = { LONG: "▲", SHORT: "▼", PUMP: "🚀", DUMP: "💥", "SIKIŞMA": "🗜", BEKLE: "◆" };
/* ---------------- v7.17 SANAL TAKİP — virtual signal journal (paper only: NO orders, no keys, no wallet) ---------------- */
const JK = "neon.sinyal.journal", JO = "neon.sinyal.jopt";
S.J = (() => { try { const a = JSON.parse(localStorage.getItem(JK) || "[]"); return Array.isArray(a) ? a : []; } catch(e){ return []; } })();
S.jo = (() => { let o = {}; try { o = JSON.parse(localStorage.getItem(JO) || "{}"); } catch(e){} return { auto: o.auto !== false, trig: o.trig !== false, all: !!o.all, ntf: o.ntf !== false }; })();
S.jf = { sym: "", tf: "" }; S.jTrig = null;
const jSave = () => { try { localStorage.setItem(JK, JSON.stringify(S.J)); } catch(e){} }, joSave = () => { try { localStorage.setItem(JO, JSON.stringify(S.jo)); } catch(e){} };
const jType = (A, st) => A.kind === "A+ kurulum" ? "A+" : A.kind === "kırılım" ? (st === "PUMP" || st === "DUMP" ? st : "kırılım") : A.kind === "trend" ? "trend" : A.kind || "sinyal";
function jAdd(o){ const tr = JRN.make(o); if (!tr) return false; const r = JRN.add(S.J, tr); if (!r.added) return false; S.J = r.list; jSave(); paintJournal();
  try { NOTIFY && NOTIFY.toast && NOTIFY.toast(`📒 sanal ${tr.d > 0 ? "LONG" : "SHORT"} kaydedildi · ${tr.sym.replace("USDT", "")} ${TF_LBL[tr.tf]}`, "good"); } catch(e){} return true; }
/* record GİR decisions of the viewed interval (and, if enabled, of the other intervals of this coin) + remember BEKLE triggers for this candle */
function jFromDecision(C, A, atr){ if (!S.jo.auto || !S.D) return; const px = S.D.px, now1 = Date.now();
  if (A.act === "GİR LONG" || A.act === "GİR SHORT") jAdd({ sym: S.sym, tf: S.tf, d: A.d, entry: px, stop: A.stop, tp: A.tp, type: jType(A, S.D.state), why: A.kind, src: "karar", t: now1 });
  const b = base(), l = b[b.length - 1]; S.jTrig = S.dec && S.dec.word === "BEKLE" && S.jo.trig && l && !l.x ? { sym: S.sym, tf: S.tf, candle: l.t, trig: S.dec.trig.slice(), atr } : S.jTrig && S.jTrig.candle === (l && l.t) ? S.jTrig : null;
  if (S.jo.all) for (const t of TF_SEL){ if (t === S.tf) continue; const x = S.ovR[t]; if (!x || !x.plan || !["LONG", "SHORT", "PUMP", "DUMP"].includes(x.st)) continue;
    const a = SMT.action(C, { main: { state: x.st, d: x.sd, plan: x.plan }, px: x.px, atr: x.atr });
    if (a.act === "GİR LONG" || a.act === "GİR SHORT") jAdd({ sym: S.sym, tf: t, d: a.d, entry: x.px, stop: a.stop, tp: a.tp, type: jType(a, x.st), why: a.kind + " (arka plan)", src: "arka plan", t: now1 }); } }
function jTrigCheck(bar){ const g = S.jTrig; if (!g || g.sym !== S.sym || g.tf !== S.tf || g.candle !== bar.t || !S.jo.auto || !S.jo.trig) return; S.jTrig = null; const R = fin(g.atr) && g.atr > 0 ? g.atr : bar.c*0.003;
  for (const tg of g.trig){ const f = JRN.trigFired(tg, bar); if (!f) continue; const e = f.entry, st = e - tg.d*1.5*R;
    jAdd({ sym: S.sym, tf: S.tf, d: tg.d, entry: e, stop: st, tp: e + tg.d*1.5*Math.abs(e - st), type: "tetik", why: tg.k + " tetiği", src: "tetik", t: bar.T + 1 }); break; } }
function jClosed(tr){ const txt = `SANAL ${tr.sym.replace("USDT", "")} ${TF_LBL[tr.tf]} ${tr.d > 0 ? "LONG" : "SHORT"}: ${tr.ok ? "DOĞRU" : "YANLIŞ"} (${tr.how}) ${tr.net >= 0 ? "+" : ""}${tr.net.toFixed(2)}%`;
  try { NOTIFY && NOTIFY.toast && NOTIFY.toast("📒 " + txt, tr.ok ? "good" : "bad"); } catch(e){}
  if (S.jo.ntf){ alarm(tr.ok ? "LONG" : "SHORT"); if (window.Notification && Notification.permission === "granted") try { new Notification("MERMER · sanal takip", { body: txt + " — gerçek emir yok", tag: "neon-jr-" + tr.id }); } catch(e){} } }
/* live: price ticks of the viewed coin (1m stream) */
function jLive(){ if (S.bSym !== S.sym) return; const bb = S.ovB["1m"] || base(), l = bb && bb[bb.length - 1]; if (!l) return; let ch = false;
  for (const tr of S.J){ if (tr.st !== "open" || tr.sym !== S.sym) continue; JRN.tick(tr, l.c, now()); if (tr.st !== "open"){ ch = true; jClosed(tr); } }
  if (ch){ jSave(); paintJournal(); } else if (Date.now() - (jLive.p || 0) > 5000){ jLive.p = Date.now(); paintJournal(true); } }
/* REST: fill gaps (app closed / other coins) from futures klines since the last check — conservative same-candle rule */
let jBusy = false;
async function jRemote(){ if (jBusy || document.hidden) return; jBusy = true; try { const open = S.J.filter(x => x.st === "open").slice(0, 15); let ch = false;
    for (const tr of open){ const t = JRN.gapTf(Math.max(tr.chk, tr.t), Date.now()); try { const k = bars(await fj(`/fapi/v1/klines?symbol=${tr.sym}&interval=${t}&startTime=${Math.max(tr.t - JRN.TFMS[t], tr.chk - JRN.TFMS[t])}&limit=1500`));
        const st0 = tr.st; JRN.resolveBars(tr, k, now()); if (tr.st !== st0){ ch = true; jClosed(tr); } else ch = true; } catch(e){} await new Promise(r => setTimeout(r, 150)); }
    if (ch){ jSave(); paintJournal(); } } finally { jBusy = false; } }
function paintJournal(light){ const sm = $("#jr-sum"), box = $("#jr-box"); if (!sm) return; const all = JRN.stats(S.J), P2 = x => fin(x) ? "%" + Math.round(x*100) : "—", sg = x => (x >= 0 ? "+" : "") + x.toFixed(2) + "%";
  sm.innerHTML = `${all.n} kayıt · ${all.open} açık${all.closed ? ` · isabet ${P2(all.hit)} · net <b class="${all.net >= 0 ? "up" : "dn"}">${sg(all.net)}</b>` : ""} · gerçek emir yok`;
  if (!box || !$("#sg-jr").open || (light && box.dataset.ok)) { if (box && box.dataset.ok && light){ for (const tr of S.J) if (tr.st === "open"){ const c = box.querySelector(`[data-jl="${tr.id}"]`); if (c && fin(tr.last)) c.textContent = sg(JRN.netPct(tr.d, tr.entry, tr.last)); } } return; }
  const st = JRN.stats(S.J, S.jf), syms = [...new Set(S.J.map(x => x.sym))], when = t => new Date(t).toLocaleString("tr-TR", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const grp = (o, lab) => { const ks = Object.keys(o); return ks.length ? `<table class="can-t"><tr><th>${lab}</th><th>işlem</th><th>isabet</th><th>net</th></tr>${ks.sort((a, b) => o[b].n - o[a].n).map(k => `<tr><td>${esc(TF_LBL[k] || k)}</td><td>${o[k].n}</td><td>${P2(o[k].ok/o[k].n)}</td><td class="${o[k].net >= 0 ? "up" : "dn"}">${sg(o[k].net)}</td></tr>`).join("")}</table>` : ""; };
  const chk = (k, l) => `<label class="jr-o"><input type="checkbox" data-jo="${k}" ${S.jo[k] ? "checked" : ""}> ${l}</label>`;
  box.dataset.ok = "1"; box.innerHTML = `<div class="jr-warn">SANAL TAKİP — gerçek emir yok. Sinyal anındaki fiyattan sanal giriş; hedef önce → DOĞRU, stop önce → YANLIŞ; aynı mumda ikisi birden → stop sayılır; ${JRN.TOUT} mumda sonuç yoksa son fiyattan kapanır (net artıysa doğru). Net % ≈ %${JRN.FEE.toFixed(2)} gidiş-dönüş ücret dahil.</div>
    <div class="jr-opts">${chk("auto", "otomatik kaydet (GİR)")}${chk("trig", "BEKLE tetikleri (tetik)")}${chk("all", "tüm aralıkları takip et (bu coin)")}${chk("ntf", "kapanışta bildir")}</div>
    <div class="jr-f"><select id="jr-fs"><option value="">tüm coinler</option>${syms.map(x => `<option ${x === S.jf.sym ? "selected" : ""} value="${esc(x)}">${esc(x.replace("USDT", ""))}</option>`).join("")}</select><select id="jr-ft"><option value="">tüm aralıklar</option>${TF_SEL.map(t => `<option ${t === S.jf.tf ? "selected" : ""} value="${t}">${TF_LBL[t]}</option>`).join("")}</select></div>
    <div class="jr-sum"><div><small>toplam</small><b>${st.n}</b></div><div><small>doğru</small><b class="up">${st.ok}</b></div><div><small>yanlış</small><b class="dn">${st.bad}</b></div><div><small>açık</small><b>${st.open}</b></div><div><small>isabet</small><b>${P2(st.hit)}</b></div><div><small>net</small><b class="${st.net >= 0 ? "up" : "dn"}">${sg(st.net)}</b></div></div>
    <div class="dim" style="font-size:10.5px">hedef ${st.tp} · stop ${st.sl} · süre doldu ${st.to}${fin(st.avg) ? ` · işlem başı ${sg(st.avg)}` : ""}</div>
    ${grp(st.byTf, "aralık")}${grp(st.byType, "tür")}
    <div class="sc-hl"><table class="can-t jr-t"><tr><th>coin · zaman</th><th>yön</th><th>giriş<br><small>stop / hedef</small></th><th>sonuç</th><th>net</th></tr>${st.list.length ? st.list.slice(0, 200).map(x => { const dp = Math.max(0, Math.min(8, 5 - Math.floor(Math.log10(x.entry || 1)))), f2 = v => fin(v) ? (+v).toFixed(dp) : "—";
      return `<tr><td>${esc(x.sym.replace("USDT", ""))} <small>${TF_LBL[x.tf]} · ${esc(x.type)}</small><br><small>${when(x.t)}</small></td><td class="${x.d > 0 ? "up" : "dn"}">${x.d > 0 ? "LONG" : "SHORT"}</td><td>${f2(x.entry)}<br><small><span class="dn">${f2(x.stop)}</span> / <span class="up">${f2(x.tp)}</span></small></td>
        <td>${x.st === "open" ? '<span class="y">AÇIK</span>' : x.ok ? `<span class="up">DOĞRU</span><br><small>${x.how}</small>` : `<span class="dn">YANLIŞ</span><br><small>${x.how}</small>`}</td><td ${x.st === "open" ? `data-jl="${x.id}"` : ""} class="${x.st === "open" ? "dim" : x.net >= 0 ? "up" : "dn"}">${x.st === "open" ? (fin(x.last) ? sg(JRN.netPct(x.d, x.entry, x.last)) : "…") : sg(x.net)}</td></tr>`; }).join("") : `<tr><td colspan="5" class="dim">henüz kayıt yok — karar GİR LONG / GİR SHORT olunca ya da BEKLE tetiği mum kapanışında gerçekleşince buraya yazılır.</td></tr>`}</table></div>
    <div class="f2"><button type="button" id="jr-csv" class="mini wide">CSV İNDİR</button><button type="button" id="jr-clr" class="mini wide">DEFTERİ TEMİZLE</button></div>`;
  box.querySelectorAll("[data-jo]").forEach(c => c.onchange = () => { S.jo[c.dataset.jo] = c.checked; joSave(); });
  $("#jr-fs").onchange = e => { S.jf.sym = e.target.value; paintJournal(); }; $("#jr-ft").onchange = e => { S.jf.tf = e.target.value; paintJournal(); };
  $("#jr-clr").onclick = () => { if (!confirm("Sanal takip defterinin TAMAMI silinsin mi? (" + S.J.length + " kayıt, yalnızca bu cihaz)")) return; S.J = []; jSave(); paintJournal(); };
  $("#jr-csv").onclick = () => { const b = new Blob(["\ufeff" + JRN.csv(S.J)], { type: "text/csv;charset=utf-8" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "neon-sanal-takip.csv"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }; }
/* ---------------- paint ---------------- */
const visible = () => document.body.dataset.pg === "scalp" && !document.hidden, row = (k, v, c) => `<div><span>${k}</span><b class="${c || ""}">${v}</b></div>`, pc = x => fin(x) ? "%" + Math.round(x*100) : "—";
const cdf = ms => { ms = Math.max(0, ms); const s = Math.ceil(ms/1000), h = Math.floor(s/3600), m = Math.floor(s % 3600/60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };
function paintHead(){ const h = $("#scalp h3 .sc-h-tf"); if (h) h.textContent = TF_LBL[S.tf]; }
function paintSt(msg){ const el = $("#sc-st"); if (!el) return; const age = S.lastTick ? Math.round((Date.now() - S.lastTick)/1000) : null;
  el.innerHTML = `vadeli · ${S.wsOk && !S.poll ? '<span class="up">● canlı</span>' : S.poll ? `<span class="y">● yoklama${S.pollErr ? " · " + esc(msg || "hata") : ""}</span>` : "○ bağlanıyor"}${age !== null ? ` · ${age}sn` : ""}`; }
function speech(D){ const c = (D.state === "LONG" || D.state === "SHORT") && D.conf && fin(D.conf.hit) ? `Geçmişte %${Math.round(D.conf.hit*100)} tuttu (${D.conf.n} örnek).` : "";
  switch (D.state){
    case "LONG": return `Yukarı yön! Güçlü kurulum. ${c} Stop ${fp(D.plan.stop)}, hedef ${fp(D.plan.tp)}.`;
    case "SHORT": return `Aşağı yön! Güçlü kurulum. ${c} Stop ${fp(D.plan.stop)}, hedef ${fp(D.plan.tp)}.`;
    case "PUMP": return `PUMP! Yatay kutu yukarı kırıldı. ${D.conf && D.conf.n ? `Bu coinde yukarı kırılımlar %${Math.round((D.conf.hit || 0)*100)} tuttu (${D.conf.n}).` : "Bu coinde kırılım geçmişi az."} Stop kutunun altında.`;
    case "DUMP": return `DUMP! Yatay kutu aşağı kırıldı. ${D.conf && D.conf.n ? `Aşağı kırılımlar %${Math.round((D.conf.hit || 0)*100)} tuttu (${D.conf.n}).` : "Bu coinde kırılım geçmişi az."} Stop kutunun üstünde.`;
    case "SIKIŞMA": return `Dikkat! Fiyat sıkıştı, patlama yakın. Yukarı ihtimali %${Math.round(D.pUp*100)}. Kutu kırılınca haber veririm.`;
    default: return `Şimdilik bekle — ${esc(({ "öğrenilmiş skor zayıf": "bu coinde şu an işe yarayan göstergeler net bir yön göstermiyor", "göstergeler çelişiyor": "göstergeler birbirini tutmuyor", "kurulum ücret sonrası zararda": "bu kurulum geçmişte ücretten sonra para kaybettirdi" })[D.reason] || D.reason || "")}${D.lean ? ` (hafif ${D.lean > 0 ? "yukarı" : "aşağı"} eğilim)` : ""}.`; } }
function paintMain(){ const card = $("#sg-card"), al = $("#sg-alerts"); if (!card) return; paintGen();
  if (S.err){ card.innerHTML = ""; return; }
  const D = S.D; if (!D){ card.innerHTML = `<div class="empty">${TF_LBL[S.tf]} mumlar yükleniyor, öğreniyorum…</div>`; return; }
  const b = base(), l = b[b.length - 1], left = l ? l.T + 1 - now() : 0, cls = SC[D.state], P = D.plan;
  const sub = D.state === "LONG" || D.state === "SHORT" ? `geçmişte <b>${pc(D.conf.hit)}</b> tuttu (${D.conf.n} örnek) · ücret sonrası ort. ${fin(D.conf.net) ? (D.conf.net >= 0 ? "+" : "") + D.conf.net.toFixed(2) + "%" : "—"}`
    : D.state === "PUMP" || D.state === "DUMP" ? `${D.sub} · geçmiş kırılımlar ${D.conf.n ? pc(D.conf.hit) + " (" + D.conf.n + ")" : "az örnek"}`
    : D.state === "SIKIŞMA" ? `patlama yakın · <b class="${D.pUp >= 0.5 ? "up" : "dn"}">${D.pUp >= 0.5 ? "yukarı" : "aşağı"} %${Math.round(Math.max(D.pUp, 1 - D.pUp)*100)}</b>`
    : `${esc(D.reason)}`;
  const line = P && fin(P.stop) ? `<div class="sg-line"><span>Giriş <b>${fp(P.entry)}</b></span><span>Stop <b class="dn">${fp(P.stop)}</b></span><span>Hedef <b class="up">${fp(P.tp)}</b></span></div>`
    : P && fin(P.longAbove) ? `<div class="sg-line"><span>↑ <b class="up">${fp(P.longAbove)}</b> üstü kapanış</span><span>↓ <b class="dn">${fp(P.shortBelow)}</b> altı kapanış</span></div>` : "";
  const V = S.mv, go = V && V.word !== "BEKLE", wcls = !V ? cls : V.word === "GİR LONG" ? "up" : V.word === "GİR SHORT" ? "dn" : "y"; void line;
  card.innerHTML = `<div class="sg-sym"><b>${esc(S.sym.replace("USDT", ""))}</b> <span class="sc-px">${fp(D.px)}</span> <small class="dim">${TF_LBL[S.tf]} · ${S.mode === "rev" ? "DÖNÜŞ" : "TREND"} · seçili aralık</small></div>
    <div class="sg-state ${wcls}">${V ? V.word : "…"}</div><div class="sg-sub">${V ? esc(V.sub) : ""}</div>${V && V.note ? `<div class="sg-warn">⚠ ${esc(V.note)}</div>` : ""}
    <div class="sg-sub dim">${V ? esc(V.tag) + " · " : ""}${sub}</div><div class="dim sg-cd">mum kapanışına <b id="sc-cd">${cdf(left)}</b>${go && P && fin(P.stop) ? ` · çıkış en geç ${dur(SMT.H_OUT*TF_MS[S.tf])}` : ""}</div>`;
  if (al) al.innerHTML = (D.alerts.length ? "" : '<span class="dim">şu an uyarı yok</span>') + D.alerts.slice(0, 4).map(a => `<span class="sg-al ${a.c}">${esc(a.t)}</span>`).join(""); }
/* ---------------- big chart ---------------- */
function paintChart(){ const cv = $("#sc-cv"); if (!cv) return; const w = cv.clientWidth || 360, h = cv.clientHeight || 420, dpr = window.devicePixelRatio || 1; if (cv.width !== Math.round(w*dpr) || cv.height !== Math.round(h*dpr)){ cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); }
  const x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h); const R = S.R, D = S.D; if (!R || !D) return; const P = R.P, all = P.b, N = Math.max(20, Math.min(160, S.view.n)), off = Math.max(0, Math.min(all.length - N, S.view.off));
  const e = all.length - off, s0 = Math.max(0, e - N), b = all.slice(s0, e), axis = 62, pw = w - axis, cw = pw/b.length, top = 16, bot = h - 18;
  const lv = []; if (D.plan){ for (const k of ["stop", "tp", "entry", "longAbove", "shortBelow"]) if (fin(D.plan[k])) lv.push(D.plan[k]); }
  let hi = Math.max(...b.map(k => k.h)), lo = Math.min(...b.map(k => k.l)); const pad0 = (hi - lo)*0.08; for (const p of lv) if (p < hi + 3*(hi - lo) && p > lo - 3*(hi - lo)){ hi = Math.max(hi, p); lo = Math.min(lo, p); } hi += pad0; lo -= pad0; if (hi <= lo){ hi += 1; lo -= 1; }
  const Y = p => top + (hi - p)/(hi - lo)*(bot - top), X = i => (i - s0)*cw + cw/2, inR = p => fin(p) && p <= hi && p >= lo;
  x.strokeStyle = "rgba(30,58,95,.07)"; x.lineWidth = 1; for (let g = 0; g <= 5; g++){ const yy = top + g*(bot - top)/5; x.beginPath(); x.moveTo(0, yy); x.lineTo(pw, yy); x.stroke(); x.fillStyle = "#415674"; x.font = "10px monospace"; x.fillText(fp(hi - g*(hi - lo)/5), pw + 4, yy + 3); }
  /* squeeze / breakout box */ const bx = D.box; if (bx && bx.from + bx.len - 1 >= s0){ const x0 = X(Math.max(s0, bx.from)) - cw/2, x1 = D.state === "SIKIŞMA" ? pw : X(Math.min(e - 1, bx.from + bx.len - 1)) + cw/2; x.fillStyle = D.state === "SIKIŞMA" ? "rgba(154,116,50,.12)" : "rgba(138,104,40,.08)"; x.strokeStyle = D.state === "SIKIŞMA" ? "#9a7432" : "#8a6828";
    x.setLineDash([5, 4]); x.fillRect(x0, Y(bx.hi), x1 - x0, Y(bx.lo) - Y(bx.hi)); x.strokeRect(x0, Y(bx.hi), x1 - x0, Y(bx.lo) - Y(bx.hi)); x.setLineDash([]); x.fillStyle = x.strokeStyle; x.font = "bold 11px monospace"; x.fillText(D.state === "SIKIŞMA" ? "SIKIŞMA" : "KUTU", x0 + 4, Y(bx.hi) - 4); }
  /* key levels */ const L = P.lv[P.n - 1] || {}; for (const [k, p, col] of [["gün T", L.dH, "#33445b"], ["gün D", L.dL, "#33445b"], ["dün T", L.pH, "#3d516d"], ["dün D", L.pL, "#3d516d"], ["hafta A", L.wO, "#48433b"]]){ if (!inR(p)) continue; x.strokeStyle = col; x.globalAlpha = 0.55; x.setLineDash([2, 4]); x.beginPath(); x.moveTo(0, Y(p)); x.lineTo(pw, Y(p)); x.stroke(); x.setLineDash([]); x.globalAlpha = 1; x.fillStyle = col; x.font = "9px monospace"; x.fillText(k, 3, Y(p) - 2); }
  /* liquidation magnets */ if (S.liq) for (const m of S.liq.above.concat(S.liq.below)){ if (!inR(m.p)) continue; x.strokeStyle = "rgba(154,116,50,.7)"; x.lineWidth = 2; x.setLineDash([8, 4]); x.beginPath(); x.moveTo(pw*0.55, Y(m.p)); x.lineTo(pw, Y(m.p)); x.stroke(); x.setLineDash([]); x.lineWidth = 1; x.fillStyle = "#37332d"; x.font = "9px monospace"; x.fillText("🧲 " + big(m.usd), pw*0.55, Y(m.p) - 3); }
  /* EMAs subtle */ const ln = (a, col) => { x.strokeStyle = col; x.lineWidth = 1.2; x.globalAlpha = 0.5; x.beginPath(); let st = false; for (let i = s0; i < e; i++){ const v = a[i]; if (!fin(v)) continue; st ? x.lineTo(X(i), Y(v)) : x.moveTo(X(i), Y(v)); st = true; } x.stroke(); x.globalAlpha = 1; }; ln(P.e21, "#8a6828"); ln(P.e50, "#9a7432");
  /* candles (thick) */ for (let i = s0; i < e; i++){ const k = all[i], up = k.c >= k.o, col = up ? "#0f6b45" : "#9b1c31", xx = X(i); x.strokeStyle = col; x.lineWidth = Math.max(1, cw*0.12); x.beginPath(); x.moveTo(xx, Y(k.h)); x.lineTo(xx, Y(k.l)); x.stroke();
    const y1 = Y(Math.max(k.o, k.c)), y2 = Y(Math.min(k.o, k.c)), bw = Math.max(2, cw*0.72); x.fillStyle = up ? "rgba(15,107,69,.85)" : "rgba(155,28,49,.9)"; x.shadowColor = col; x.shadowBlur = 0; x.fillRect(xx - bw/2, y1, bw, Math.max(1.5, y2 - y1)); x.shadowBlur = 0; }
  /* pattern arrows + past A+ marks */ const W = S.W; x.font = "bold 10px monospace"; for (let i = Math.max(s0, W.from); i < e; i++){ const a = W.V[i - W.from]; if (!a) continue; for (const p of a.info.pats){ if (!p.ctx) continue; const k = all[i], d = p.d; x.fillStyle = d > 0 ? "#0f6b45" : "#9b1c31"; const yy = d > 0 ? Y(k.l) + 14 : Y(k.h) - 6; x.fillText(d > 0 ? "▲" : "▼", X(i) - 4, yy); x.font = "8px monospace"; x.fillText(p.n.split(" ")[0].slice(0, 7), X(i) - 12, d > 0 ? yy + 10 : yy - 9); x.font = "bold 10px monospace"; break; } }
  for (const sg of W.sig){ if (sg.i < s0 || sg.i >= e) continue; x.fillStyle = "#1e3a5f"; x.beginPath(); x.arc(X(sg.i), sg.d > 0 ? Y(all[sg.i].l) + 22 : Y(all[sg.i].h) - 18, 3.5, 0, 7); x.fill(); }
  /* plan lines */ const hl = (p, col, t) => { if (!inR(p)) return; x.strokeStyle = col; x.lineWidth = 1.5; x.setLineDash([6, 3]); x.beginPath(); x.moveTo(0, Y(p)); x.lineTo(pw, Y(p)); x.stroke(); x.setLineDash([]); x.lineWidth = 1; x.fillStyle = col; x.fillRect(pw, Y(p) - 8, axis, 16); x.fillStyle = "#f3f0eb"; x.font = "bold 10px monospace"; x.fillText(t, pw + 3, Y(p) + 4); };
  if (D.plan){ hl(D.plan.stop, "#9b1c31", "STOP"); hl(D.plan.tp, "#0f6b45", "HEDEF"); hl(D.plan.longAbove, "#0f6b45", "↑KIRIL"); hl(D.plan.shortBelow, "#9b1c31", "↓KIRIL"); }
  const px = all[all.length - 1].c; if (inR(px)){ x.strokeStyle = "rgba(184,151,90,.9)"; x.lineWidth = 1; x.setLineDash([2, 3]); x.beginPath(); x.moveTo(0, Y(px)); x.lineTo(pw, Y(px)); x.stroke(); x.setLineDash([]); x.fillStyle = "#8a6a2c"; x.fillRect(pw, Y(px) - 8, axis, 16); x.fillStyle = "#f3f0eb"; x.font = "bold 10px monospace"; x.fillText(fp(px).slice(0, 9), pw + 3, Y(px) + 4); }
  x.fillStyle = "#415674"; x.font = "10px monospace"; x.fillText(`${S.sym} · ${TF_LBL[S.tf]} · ${b.length} mum${off ? " · ←" + off : ""}`, 4, h - 5); }
/* ---------------- details ---------------- */
const NM = k => SMT.NAMES[k] || ({ fund: "Funding", oi: "OI değişimi", tk: "Taker oranı", ls: "Long/Short", wall: "Defter duvarları", ob: "Defter dengesizliği" }[k] || k), vc = v => v > 0.1 ? "up" : v < -0.1 ? "dn" : "dim", ar = v => v > 0.1 ? "▲" : v < -0.1 ? "▼" : "•";
function paintDetails(){ const D = S.D, W = S.W; if (!D || !W) return; const L = D.L, cn = S.mode === "rev" ? W.cntR : W.cntT;
  $("#sd-why").innerHTML = `<div class="can-kv">${row("öğrenilmiş skor", (L.sc.S >= 0 ? "+" : "") + L.sc.S.toFixed(2) + " <small>(±0.20 gerekir)</small>", vc(L.sc.S))}${row("uyum", "%" + Math.round(L.sc.agree*100) + " <small>(%65 gerekir)</small>")}${row("kurulum geçmişi", L.setup.n ? `${pc(L.setup.hit)} · ${L.setup.n} örnek · ort. ${fin(L.setup.net) ? L.setup.net.toFixed(2) : "—"}%` : "henüz yok")}${row("seans", `${L.sess} · ${L.hour}:00 UTC${L.hourB && L.hourB.n ? ` · bu saat %${Math.round(L.hourB.ok/L.hourB.n*100)} (${Math.round(L.hourB.n)})` : ""}`)}</div>
    ${L.why.length ? `<div class="sc-veto">${L.why.map(w => `<div>⏸ ${esc(w)}</div>`).join("")}</div>` : `<div class="up">✔ tüm A+ koşulları sağlandı</div>`}
    <div class="sub-h">en çok etkileyenler (öğrenilmiş)</div><div class="can-f">${L.sc.parts.slice(0, 8).map(p => `<span class="${vc(p.x)}">${ar(p.x)} ${esc(NM(p.k))} ${p.w < 0 ? "<small>(ters)</small>" : ""}</span>`).join("") || '<span class="dim">hiçbir gösterge bu coin/aralıkta işe yaramıyor → ağırlık 0</span>'}</div>
    <div class="sub-h">canlı türev / defter (öğrenilmez, ters ise LONG/SHORT engellenir)</div><div class="can-f">${Object.entries(D.dv).map(([k, v]) => `<span class="${vc(v)}">${ar(v)} ${esc(NM(k))}</span>`).join("") || '<span class="dim">veri yok</span>'}</div>
    <div class="dim sc-note">funding ${fin(S.der.fund) ? "%" + (S.der.fund*100).toFixed(4) : "—"} · OI ${fin(S.der.oiCh) ? (S.der.oiCh >= 0 ? "+" : "") + S.der.oiCh.toFixed(2) + "% (" + S.der.per + "×6)" : "—"} · taker ${fin(S.der.tk) ? S.der.tk.toFixed(2) : "—"} · L/S ${fin(S.der.ls) ? S.der.ls.toFixed(2) : "—"}</div>`;
  $("#sd-w").innerHTML = `<table class="can-t sc-t"><tr><th>gösterge</th><th>şimdi</th><th>isabet</th><th>ağırlık</th></tr>${W.keys.map(k => { const c = cn[k], acc = c && c.n ? c.ok/c.n : null, wv = SMT.wOf(c), v = (S.mode === "rev" ? L.a.R : L.a.T)[k] || 0;
    return { k, wv, html: `<tr><td>${esc(NM(k))}</td><td class="${vc(v)}">${ar(v)} ${v.toFixed(2)}</td><td>${acc === null ? "—" : "%" + Math.round(acc*100)} <small>n${c ? Math.round(c.n) : 0}</small></td><td class="${wv > 0 ? "up" : wv < 0 ? "dn" : "dim"}">${wv ? (wv > 0 ? "+" : "") + wv.toFixed(2) : "0"}${wv < 0 ? " ters" : ""}</td></tr>` }; }).sort((a, b) => Math.abs(b.wv) - Math.abs(a.wv)).map(x => x.html).join("")}</table>
    <div class="dim sc-note">Her gösterge, bu coin + aralıkta ${SMT.H_LAB} mum sonraki yönü ne sıklıkla doğru gösterdi (yakın geçmiş daha ağır). %50'den anlamlı farkı yoksa ağırlık 0; tersine çalışıyorsa negatif ağırlık. Mum kapanışında yenilenir, cihazda saklanır.</div>`;
  const pats = Object.entries(W.patB).sort((a, b) => b[1].n - a[1].n), cur = (L.a.info.pats || []);
  $("#sd-pat").innerHTML = `<div class="can-f">${cur.length ? cur.map(p => `<span class="${p.ctx ? vc(p.d) : "dim"}">${esc(p.n)}${p.ctx ? "" : " (bağlam yok)"}</span>`).join("") : '<span class="dim">son mumda formasyon yok</span>'}</div>
    <table class="can-t"><tr><th>formasyon (bağlamlı)</th><th>isabet</th><th>n</th></tr>${pats.length ? pats.map(([k, B]) => `<tr><td>${esc(B.name)}</td><td class="${B.ok/B.n >= 0.55 ? "up" : B.ok/B.n < 0.45 ? "dn" : ""}">%${Math.round(B.ok/B.n*100)}</td><td>${B.n}</td></tr>`).join("") : '<tr><td colspan="3" class="dim">yüklü geçmişte bağlamlı formasyon yok</td></tr>'}</table>
    <div class="dim sc-note">Formasyon yalnızca bağlamda sayılır: hareket sonrası, seviye/salınım noktasında ve hacim ≥1.2×. İsabet = ${SMT.H_LAB} mum sonra beklenen yönde mi.</div>`;
  const q = W.sqB, sqr = (B, l) => `${l}: ${B.n ? `${pc(SMT.hitB(B))} (${B.tp}/${B.tp + B.sl}) · ort. ${(B.pnl/B.n).toFixed(2)}%` : "örnek yok"}`;
  $("#sd-sq").innerHTML = `<div class="can-kv">${row("durum", D.state === "SIKIŞMA" ? '<b class="m">SIKIŞMA — patlama yakın</b>' : D.state === "PUMP" || D.state === "DUMP" ? D.state : L.fake ? "SAHTE KIRILIM" : "sıkışma yok")}
    ${L.squeeze ? row("koşullar", Object.entries(L.squeeze.cond).filter(x => x[1]).map(x => ({ bwLow: "BB dar", kcIn: "Keltner içi", atrDrop: "ATR düştü", volDry: "hacim kurudu" }[x[0]])).join(" · ")) : ""}
    ${D.box ? row("kutu", `${fp(D.box.lo)} – ${fp(D.box.hi)} · ${D.box.len} mum · yükseklik %${((D.box.hi - D.box.lo)/D.px*100).toFixed(2)}`) : ""}
    ${row("geçmiş kırılımlar", `↑${q.ups} · ↓${q.dns}`)}${row("", sqr(q.up, "yukarı"))}${row("", sqr(q.dn, "aşağı"))}</div>
    ${D.sqParts ? `<div class="sub-h">yön ihtimali: yukarı %${Math.round(D.pUp*100)}</div><div class="can-f">${D.sqParts.map(([n, v]) => `<span class="${vc(v)}">${ar(v)} ${esc(n)}</span>`).join("")}</div>` : ""}
    <div class="dim sc-note">Kırılım = sıkışma kutusunun dışında kapanış + hacim ≥1.3×. Plan: stop kutunun öbür tarafı, hedef kutu yüksekliği. Kapanış kutuya geri dönerse SAHTE KIRILIM.</div>`;
  const lq = S.liq; $("#sd-liq").innerHTML = lq ? `<table class="can-t"><tr><th>seviye</th><th>uzaklık</th><th>tahmini $</th></tr>${lq.above.map(m => `<tr><td class="dn">↑ ${fp(m.p)}</td><td>+%${((m.p/D.px - 1)*100).toFixed(2)}</td><td>${big(m.usd)} <small>short likidasyonu</small></td></tr>`).join("")}${lq.below.map(m => `<tr><td class="up">↓ ${fp(m.p)}</td><td>−%${((1 - m.p/D.px)*100).toFixed(2)}</td><td>${big(m.usd)} <small>long likidasyonu</small></td></tr>`).join("")}</table>
    <div class="dim sc-note">TAHMİN: OI artışları (${S.der.per || ""} × ${S.oiH.length}) 10x/25x/50x/100x kaldıraçla dağıtılıp likidasyon fiyatları kümelendi; fiyatın geçtiği kümeler silindi. Gerçek pozisyonlar görünmez. Çekim ${lq.pull > 0 ? "yukarı" : "aşağı"} (${lq.pull.toFixed(2)}).</div>` : '<div class="dim">OI geçmişi yok</div>';
  const wl = S.wl; $("#sd-ob").innerHTML = wl ? `<table class="can-t"><tr><th>duvar</th><th>uzaklık</th><th>$</th><th>yaş</th></tr>${wl.list.map(w => `<tr><td class="${w.side > 0 ? "up" : "dn"}">${w.side > 0 ? "ALIŞ" : "SATIŞ"} ${fp(w.p)}</td><td>${((w.p/wl.mid - 1)*100).toFixed(2)}%</td><td>${big(w.u)}</td><td>${Math.round((Date.now() - w.first)/1000)}sn</td></tr>`).join("") || '<tr><td colspan="4" class="dim">büyük duvar yok</td></tr>'}</table>
    <div class="sub-h">spoof şüphesi (fiyat gelmeden kaybolan duvarlar, 15 dk)</div><div class="can-f">${wl.mem.spoof.map(s => `<span class="y">${s.side > 0 ? "alış" : "satış"} ${fp(s.p)} · ${big(s.usd)} · ${Math.round(s.life/1000)}sn</span>`).join("") || '<span class="dim">yok</span>'}</div>
    <div class="dim sc-note">500 kademe derinlik, 20 sn'de bir. Duvar = ±%3 içinde medyanın ≥8 katı. Eğim ${wl.tilt >= 0 ? "alıcı" : "satıcı"} (${wl.tilt.toFixed(2)}).</div>` : '<div class="dim">defter yükleniyor…</div>';
  const lvx = R => R.P.lv[R.P.n - 1] || {}, LV = lvx(S.R), bi = L.a.info.btc, hb = W.hourB;
  $("#sd-lv").innerHTML = `<div class="can-kv">${row("gün tepe / dip", fp(LV.dH) + " / " + fp(LV.dL))}${row("dün tepe / dip", fp(LV.pH) + " / " + fp(LV.pL))}${row("hafta açılışı", fp(LV.wO))}${row("son seviye olayı", esc(L.a.info.lvl || "—"))}
    ${row("BTC öncülük", S.sym === "BTCUSDT" ? "bu BTC" : bi ? `<b class="${bi.dir > 0 ? "up" : "dn"}">BTC ${bi.dir > 0 ? "yukarı" : "aşağı"} kırdı, ${S.sym.replace("USDT", "")} geride</b>` : "BTC'de sert kırılım yok")}</div>
    ${S.tf !== "4h" && TF_MS[S.tf] < 144e5 ? `<div class="sub-h">saat etkisi (UTC, öğrenilmiş skor yönü doğru mu)</div><div class="sg-hours">${Array.from({ length: 24 }, (_, h) => { const x = hb[h], r = x && x.n >= 5 ? x.ok/x.n : null; return `<span class="${r === null ? "dim" : r >= 0.55 ? "up" : r < 0.47 ? "dn" : ""}" title="${h}:00">${h}<br><small>${r === null ? "·" : Math.round(r*100)}</small></span>`; }).join("")}</div><div class="dim sc-note">Kırmızı saatlerde (≥15 örnek, <%47) A+ sinyal verilmez. Berlin = UTC+1.</div>` : ""}`;
  paintBt(); }
function paintBt(){ const el = $("#sc-bt"); if (!el || !S.W || !S.R) return; const r = SMT.replay(S.W, S.R.P.b), f = B => B.n ? `${pc(SMT.hitB(B))} <small>(${B.tp}/${B.tp + B.sl})</small> · ort. <b class="${B.pnl/B.n > 0 ? "up" : "dn"}">${(B.pnl/B.n >= 0 ? "+" : "") + (B.pnl/B.n).toFixed(3)}%</b>` : "sinyal yok";
  el.innerHTML = `<div class="can-kv">${row("A+ sinyaller (" + r.aplus.n + ")", f(r.aplus))}${row("PUMP/DUMP kırılımları (" + r.brk.n + ")", f(r.brk))}</div><div class="dim sc-note">${S.sym} · ${TF_LBL[S.tf]} · ${S.mode === "rev" ? "DÖNÜŞ" : "TREND"} · yüklü ${S.R.P.n} mum (${dur(S.R.P.n*TF_MS[S.tf])}). Her mumda yalnızca o ana kadar bilinenle karar verildi (ileriye bakmadan); öğrenme de aynı yürüyüşte. Ortalamalar ücret (%0.10) düşülmüş, TP=1R ya da kutu yüksekliği, ${SMT.H_OUT} mum içinde. Türev/defter verisi geçmişte olmadığından testte yok.</div>`; }
function paintHist(){ const el = $("#sc-hist"); if (!el) return; const k = key(), L = (H.load()[k] || []), st = SCM.stats(L), tms = TF_MS[S.tf], P2 = x => x === null || !fin(x) ? "—" : "%" + x.toFixed(0);
  const oc = r => !r ? '<span class="dim">…</span>' : `<span class="${r.r === "TP" || r.r === "+" ? "up" : "dn"}">${r.r === "TP" ? "TP" : r.r === "SL" ? "SL" : r.r + Math.abs(r.pnl).toFixed(2)}</span>`;
  const when = t => tms >= 864e5 ? new Date(t).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }) : tms >= 36e5 ? new Date(t).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  const act = L.filter(s => s.side !== "BEKLE");
  el.innerHTML = `<table class="can-t"><tr><th>süre</th><th>TP isabet</th><th>yön doğru</th><th>Σ %</th></tr>${[2, 3, 5].map(h => `<tr><td>${h} mum <small>${dur(h*tms)}</small></td><td>${P2(st[h].hit)} <small>${st[h].tp}/${st[h].tp + st[h].sl}</small></td><td>${P2(st[h].dir)}</td><td class="${st[h].pnl >= 0 ? "up" : "dn"}">${st[h].pnl.toFixed(2)}%</td></tr>`).join("")}</table>
    <div class="sc-hl"><table class="can-t"><tr><th>mum</th><th>durum</th><th>giriş</th><th>2</th><th>3</th><th>5</th></tr>${act.length ? act.map(s => `<tr><td>${when(s.t)}</td><td class="${s.side === "LONG" ? "up" : "dn"}">${esc(s.state || s.side)}${s.conf ? ` <small>%${s.conf}</small>` : ""}</td><td>${fp(s.entry)}</td>${[2, 3, 5].map(h => `<td>${oc(s.res[h])}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="6" class="dim">henüz canlı sinyal yok — A+ ve PUMP/DUMP mum kapanışında buraya yazılır (sekme açıkken). BEKLE mumları: ${L.length - act.length}</td></tr>`}</table></div>
    <button type="button" id="sc-clr" class="mini">bu coin + aralığın geçmişini sıfırla</button>`;
  $("#sc-clr").onclick = () => { if (!confirm(S.sym + " · " + TF_LBL[S.tf] + " sinyal geçmişi silinsin mi? (yalnızca bu cihaz)")) return; const a = H.load(); delete a[k]; H.save(a); const o = ST.load(); delete o[k]; localStorage.setItem(SK, JSON.stringify(o)); paintHist(); }; }
function paintAll(){ paintHead(); paintSt(); paintMain(); paintJournal(); paintChart(); if (S.D) paintDetails(); paintHist(); }
function tick(){ if (!S.started) return; if (!visible()) return; const b = base(), l = b[b.length - 1], cd = $("#sc-cd"); if (cd && l) cd.textContent = cdf(l.T + 1 - now());
  if (l && !S.err && !S.poll && ((!S.wsOk && now() > l.T + 5000) || (S.wsOk && Date.now() - Math.max(S.lastTick, S.wsAt || 0) > 10000))) startPoll();
  if (Date.now() - (S.der.at || 0) > 60000 && S.D){ S.der.at = Date.now(); loadDer(S.sym, S.gen); }
  if (Date.now() - (S.bookAt || 0) > 20000 && S.D){ S.bookAt = Date.now(); loadBook(S.sym, S.gen); }
  if (S.sym !== "BTCUSDT" && Date.now() - (S.btcAt || 0) > 300000 && S.D){ S.btcAt = Date.now(); loadBtc(S.gen); }
  compute(); paintSt(); if (S.D && Object.keys(S.ovB).length) ovCalc(); }
function bind(){ const q = $("#sc-q"); q.oninput = () => paintList(q.value); q.onfocus = () => { q.select(); loadList().then(() => paintList("")); };
  q.onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); const r = search(q.value)[0]; pick(r ? r.s : q.value); } };
  $("#sc-list").onclick = e => { const b = e.target.closest("[data-ss]"); if (b) pick(b.dataset.ss); };
  $("#sc-go").onclick = () => { const v = q.value.trim().toUpperCase(), r = search(v); pick(r.some(x => x.s === v) ? v : r[0] ? r[0].s : v); };
  document.querySelector(".sc-quick").onclick = e => { const b = e.target.closest("[data-sq]"); if (b) pick(b.dataset.sq); };
  const box = $("#scalp-box"); box.addEventListener("click", e => { const b = e.target.closest("[data-stf]"); if (b && b.dataset.stf !== S.tf) start(S.sym, b.dataset.stf);
    const md = e.target.closest("[data-md]"); if (md && md.dataset.md !== S.mode){ S.mode = md.dataset.md; localStorage.setItem("neon.sinyal.mode", S.mode); document.querySelectorAll("[data-md]").forEach(x => x.classList.toggle("on", x === md)); S.ovCalcAt = 0; compute(true); ovCalc(true); }
    const z = e.target.closest("[data-z]"); if (z){ const k = +z.dataset.z; if (k === 0) S.view = { n: 50, off: 0 }; else S.view.n = Math.max(20, Math.min(160, Math.round(S.view.n*(k > 0 ? 0.75 : 1.33)))); paintChart(); } });
  const alSave = () => { try { localStorage.setItem("neon.sinyal.al", JSON.stringify(S.al)); } catch(e){} };
  $("#al-snd").onchange = e => { S.al.snd = e.target.checked; alSave(); if (S.al.snd) alarm("LONG"); };
  $("#al-vib").onchange = e => { S.al.vib = e.target.checked; alSave(); if (S.al.vib) try { navigator.vibrate && navigator.vibrate(80); } catch(x){} };
  $("#al-ntf").onclick = async () => { const b = $("#al-ntf"); if (S.al.ntf){ S.al.ntf = false; alSave(); b.textContent = "🔕"; return; } if (!window.Notification){ alert("Bu tarayıcı bildirim desteklemiyor."); return; }
    let p = Notification.permission; if (p === "default") try { p = await Notification.requestPermission(); } catch(e){} S.al.ntf = p === "granted"; alSave(); b.textContent = S.al.ntf ? "🔔" : "🔕"; if (!S.al.ntf) alert("Bildirim izni verilmedi — ses/titreşim yine çalışır."); };
  box.addEventListener("pointerdown", () => { try { const C = window.AudioContext || window.webkitAudioContext; if (C && !alarm.ac) alarm.ac = new C(); alarm.ac && alarm.ac.resume && alarm.ac.resume(); } catch(e){} }, { once: true });
  box.addEventListener("toggle", e => { if (e.target.id === "sg-jr" && e.target.open){ const bx = $("#jr-box"); if (bx) delete bx.dataset.ok; paintJournal(); } if (e.target.querySelector && e.target.querySelector("#sd-gen") && e.target.open) paintGenDet(); }, true);
  /* drag to scroll back in time */ const cv = $("#sc-cv"); let dx = null, o0 = 0; const pos = e => (e.touches ? e.touches[0].clientX : e.clientX);
  cv.addEventListener("pointerdown", e => { dx = e.clientX; o0 = S.view.off; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); }); cv.addEventListener("pointermove", e => { if (dx === null) return; const cw = (cv.clientWidth - 62)/S.view.n; S.view.off = Math.max(0, Math.round(o0 + (e.clientX - dx)/cw)); paintChart(); });
  ["pointerup", "pointercancel", "pointerleave"].forEach(t => cv.addEventListener(t, () => { dx = null; })); void pos;
  document.addEventListener("click", e => { if (!e.target.closest(".sc-search") && !e.target.closest("#sc-list")){ const l = $("#sc-list"); l && l.classList.add("hidden"); } });
  window.addEventListener("resize", () => visible() && paintChart());
  let hidAt = 0; document.addEventListener("visibilitychange", () => { if (document.hidden){ hidAt = Date.now(); return; } if (S.started && hidAt && Date.now() - hidAt > 20000) start(S.sym); hidAt = 0; }); }
function pick(sym){ const q = $("#sc-q"); q.value = sym; $("#sc-list").classList.add("hidden"); q.blur(); start(sym); }
function ensure(){ if (S.started){ if (visible()) paintAll(); return; } S.started = true; fj("/fapi/v1/time").then(t => { S.off = +t.serverTime - Date.now(); }).catch(() => {}); start(S.sym); setInterval(tick, 1000); setInterval(jLive, 2000); setInterval(() => jRemote(), 60000); jRemote(); }
function init(){ const box = $("#scalp-box"); if (!box) return; box.innerHTML = html(); bind(); paintHead(); if (document.body.dataset.pg === "scalp") ensure();
  window.addEventListener("hashchange", () => { if (document.body.dataset.pg === "scalp") ensure(); }); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
return { ensure, start, _j: { add: o => jAdd(o), remote: () => jRemote(), trig: b => jTrigCheck(b) }, checkAlert, testAlert: () => fireAlert(S.A && S.A.act !== "BEKLE" ? S.A.act : "YÖN GÜÇLÜ YUKARI", true), get S(){ return S; } };
})();
