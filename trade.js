/* NEON//TERMINAL — İŞLEM (trading) module.
   Binance USDⓈ-M Futures (LONG + SHORT) and Phantom (Solana spot swaps via Jupiter).
   Safety: nothing is ever sent automatically. Every order / swap opens a confirmation sheet and needs a tap on ONAYLA.
   API keys live only in this device's localStorage and are only ever sent to Binance (key in a header, secret never leaves the device: it signs locally). */
"use strict";
const TRADE = (() => {
const $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = (x, d) => (x === null || x === undefined || !isFinite(+x)) ? "—" : (+x).toLocaleString("en-US", { maximumFractionDigits: d ?? 8 });
const fp = x => { x = +x; if (!isFinite(x)) return "—"; const a = Math.abs(x); return "$" + (a >= 1000 ? x.toLocaleString("en-US",{maximumFractionDigits:2}) : a >= 1 ? x.toFixed(4) : a >= 0.01 ? x.toFixed(5) : x.toPrecision(4)); };
let D = null, TAB = "bfx", livePx = null;

/* ---------------- generic confirmation sheet ---------------- */
function confirmSheet({ title, rows, mode, warn, okText }){
  return new Promise(res => {
    const real = mode === "GERÇEK", sim = mode === "SIM";
    $("#cf-box").innerHTML = `<div class="cf-mode ${real ? "real" : "test"}">${real ? "⚠ GERÇEK PARA" : sim ? "SIM · SANAL" : "TESTNET"}<small>${real ? "Gerçek hesabında işlem yapılacak" : sim ? "Sanal para · canlı fiyat · hiçbir şey gönderilmez" : "Test parası · gerçek değil"}</small></div>
      <div class="sheet-title">${esc(title)}</div>
      <div class="cf-rows">${rows.map(([k, v, c]) => `<div class="${c || ""}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>
      ${warn ? `<div class="cf-warn">${warn}</div>` : ""}
      <div class="sheet-btns"><button type="button" id="cf-no">İPTAL</button><button type="button" id="cf-ok" class="cf-ok ${real ? "real" : ""}" disabled>${esc(okText || "ONAYLA")}</button></div>`;
    const box = $("#confirm"); box.classList.remove("hidden");
    const ok = $("#cf-ok"); setTimeout(() => { ok.disabled = false; }, 700);
    const done = v => { box.classList.add("hidden"); $("#cf-box").innerHTML = ""; res(v); };
    $("#cf-no").onclick = () => done(false); ok.onclick = () => done(true);
    box.onclick = e => { if (e.target === box) done(false); };
  });
}
function log(id, msg, cls){ const el = $(id); if (!el) return; const t = new Date().toLocaleTimeString("tr-TR");
  el.insertAdjacentHTML("afterbegin", `<div class="${cls || ""}"><small>${t}</small> ${msg}</div>`); }

/* =====================================================================
   BINANCE USDⓈ-M FUTURES
   reads: REST (browser CORS ok on fapi + testnet). writes (orders): WebSocket API
   (ws-fapi) because testnet's REST order endpoints fail the browser CORS preflight.
   ===================================================================== */
const BK = "neon.bfx", PK = { test: "neon.bfx.test", real: "neon.bfx.real" };
/* two separate key stores: TEST API (testnet) and GERÇEK API (mainnet); "active" picks which one orders use */
function rd(k){ try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch(e){ return {}; } }
(function migrate(){ const o = rd(BK); if (o.key || o.secret){ const w = o.testnet === false ? "real" : "test"; const p = rd(PK[w]);
  if (!p.key) localStorage.setItem(PK[w], JSON.stringify({ key: o.key, secret: o.secret }));
  o.active = o.active || w; delete o.key; delete o.secret; delete o.testnet; localStorage.setItem(BK, JSON.stringify(o)); } })();
function base(){ return Object.assign({ active: "test", lev: 1, attach: true }, rd(BK)); }
/* v7.40: secret at rest is AES-GCM encrypted (BKEYS, PIN-derived key); plaintext records from ≤ v7.39 still work for TESTNET until sealed, GERÇEK orders need the sealed form */
function prof(w){ const r = rd(PK[w]); return { key: r.key || "", secret: BKEYS.secretOf(r, w), enc: r.enc || null, st: BKEYS.state(r, w) }; }
function pput(w, rec){ localStorage.setItem(PK[w], JSON.stringify({ key: rec.key, enc: rec.enc })); }
async function ensureOpen(w){ w = w || base().active; const r = rd(PK[w]), st = BKEYS.state(r, w); if (st !== "locked") return st !== "none";
  for (let i = 0; i < 3; i++){ const pin = await BKEYS.ask((w === "real" ? "GERÇEK" : "TEST") + " API SECRET KİLİDİNİ AÇ", "Secret bu cihazda PIN'inle şifreli. Sayfa yenilenince yeniden kilitlenir.", "KİLİDİ AÇ"); if (pin === null) return false;
    try { await BKEYS.open(r, pin, w); return true; } catch(e){ try { NOTIFY.toast("✖ " + e.message, "bad"); } catch(x){} } } return false; }
const lockedErr = w => new Error(`${w === "real" ? "GERÇEK" : "TEST"} API Secret kilitli — İŞLEM'de YENİLE'ye dokunup PIN gir (ya da BAĞLANTILAR → BINANCE).`);
function bget(w){ const b = base(), a = w || b.active, p = prof(a); return Object.assign({}, b, { which: a, key: p.key, secret: p.secret, kst: p.st, testnet: a !== "real" }); }
function bset(o){ const b = rd(BK); delete o.key; delete o.secret; delete o.testnet; localStorage.setItem(BK, JSON.stringify(Object.assign(b, o))); }
function pset(w, o){ const r = rd(PK[w]); if (o && o.secret) throw new Error("Secret düz metin saklanmaz — PIN ile şifrele"); localStorage.setItem(PK[w], JSON.stringify(Object.assign({ key: r.key, enc: r.enc }, o))); }
function pdel(w){ localStorage.removeItem(PK[w]); BKEYS.lock(w); }
const REST = t => t ? "https://testnet.binancefuture.com" : "https://fapi.binance.com";
const WSAPI = t => t ? "wss://testnet.binancefuture.com/ws-fapi/v1" : "wss://ws-fapi.binance.com/ws-fapi/v1";
const ERR_TR = { "-1000": "Binance bilinmeyen hata", "-1003": "Çok fazla istek, biraz bekle", "-1021": "Zaman damgası uyuşmuyor (saat senkronu); tekrar dene",
  "-1022": "İmza geçersiz: API Secret yanlış", "-1102": "Zorunlu parametre eksik", "-1111": "Hassasiyet hatası (miktar/fiyat ondalığı)", "-1121": "Bu sembol vadelide yok",
  "-2010": "Emir reddedildi", "-2011": "İptal edilecek emir yok", "-2014": "API anahtarı biçimi geçersiz", "-2015": "API anahtarı geçersiz ya da izin/IP yetkisi yok (Futures izni açık mı? Testnet anahtarını testnet modunda mı kullanıyorsun?)",
  "-2019": "Yetersiz teminat (margin)", "-2021": "Stop/hedef fiyatı hemen tetiklenirdi (fiyat seviyeyi geçmiş)", "-2022": "ReduceOnly emri reddedildi (kapatılacak pozisyon yok)",
  "-4003": "Miktar sıfırdan büyük olmalı", "-4005": "Miktar üst sınırı aşıyor", "-4061": "Pozisyon yönü ayarı uyuşmuyor (hedge/one-way)", "-4120": "Bu emir türü algo uç noktası istiyor",
  "-4131": "Fiyat koruma sınırı dışında", "-4164": "Emir tutarı minimumun altında (min. notional)", "-4028": "Kaldıraç geçersiz", "-5000": "Uç nokta geçersiz", "-4411": "Bu sembol için önce Binance'te vadeli sözleşme onayı gerekiyor" };
function trErr(e){ if (!e) return "bilinmeyen hata"; if (e.http === 451) return "Binance bu konumdan erişimi kısıtlıyor (HTTP 451). Telefonun bulunduğu ülkeden erişebilmelisin; VPN açıksa kapat.";
  if (e.http === 418 || e.http === 429) return "Binance istek sınırı (HTTP " + e.http + "): biraz bekle.";
  if (e.code !== undefined){ const t = ERR_TR[String(e.code)]; return (t ? t + " · " : "") + "Binance " + e.code + ": " + (e.msg || ""); }
  if (e.name === "TypeError") return "Ağ/CORS hatası: Binance'e ulaşılamadı (" + e.message + ")";
  return e.message || String(e); }
class BErr extends Error { constructor(o){ super(o.msg || ("HTTP " + o.http)); Object.assign(this, o); } }
const enc = s => new TextEncoder().encode(s), hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
async function hmac(secret, msg){ const k = await crypto.subtle.importKey("raw", enc(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return hex(await crypto.subtle.sign("HMAC", k, enc(msg))); }
let tOff = 0, tFor = null, tAt = 0;
async function syncTime(t){ if (tFor === t && Date.now() - tAt < 300e3) return; const a = Date.now(); const r = await fetch(REST(t) + "/fapi/v1/time", { cache: "no-store" });
  if (!r.ok) throw new BErr({ http: r.status }); const j = await r.json(); const b = Date.now(); tOff = j.serverTime - Math.round((a + b)/2); tFor = t; tAt = b; }
async function pub(path, c){ c = c || bget(); const r = await fetch(REST(c.testnet) + path, { cache: "no-store" }); const j = await r.json().catch(() => ({}));
  if (!r.ok || (j && j.code < 0)) throw new BErr({ http: r.status, code: j.code, msg: j.msg }); return j; }
async function signed(method, path, params = {}, c){
  c = c || bget(); if (c.key && !c.secret && c.kst === "locked") throw lockedErr(c.which); if (!c.key || !c.secret) throw new Error("Önce API Key ve Secret gir (BAĞLANTILAR → BINANCE).");
  await syncTime(c.testnet);
  const q = new URLSearchParams(Object.assign({}, params, { timestamp: Date.now() + tOff, recvWindow: 5000 })).toString();
  const sig = await hmac(c.secret, q);
  const r = await fetch(REST(c.testnet) + path + "?" + q + "&signature=" + sig, { method, headers: { "X-MBX-APIKEY": c.key }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || (j && typeof j.code === "number" && j.code < 0)) throw new BErr({ http: r.status, code: j.code, msg: j.msg }); return j;
}
let wsc = null;
function wsOpen(t){
  if (wsc && wsc.t === t && wsc.ws.readyState <= 1) return wsc.ready;
  if (wsc) try { wsc.ws.close(); } catch(e){}
  const ws = new WebSocket(WSAPI(t)), pend = new Map();
  wsc = { t, ws, pend, ready: new Promise((ok, no) => { ws.onopen = () => ok(); ws.onerror = () => no(new Error("WebSocket API bağlantısı kurulamadı")); setTimeout(() => no(new Error("WebSocket API zaman aşımı")), 10000); }) };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch(e){ return; } const p = pend.get(m.id); if (!p) return; pend.delete(m.id);
    if (m.status !== 200 || m.error) p.no(new BErr({ http: m.status, code: m.error && m.error.code, msg: m.error && m.error.msg })); else p.ok(m.result); };
  ws.onclose = () => { for (const p of pend.values()) p.no(new Error("WebSocket API bağlantısı kapandı")); pend.clear(); if (wsc && wsc.ws === ws) wsc = null; };
  return wsc.ready;
}
async function wsCall(method, params, c){
  c = c || bget(); if (c.key && !c.secret && c.kst === "locked") throw lockedErr(c.which); if (!c.key || !c.secret) throw new Error("Önce API Key ve Secret gir (BAĞLANTILAR → BINANCE).");
  await syncTime(c.testnet); await wsOpen(c.testnet);
  const p = Object.assign({}, params, { apiKey: c.key, timestamp: Date.now() + tOff, recvWindow: 5000 });
  const q = Object.keys(p).sort().map(k => k + "=" + p[k]).join("&"); p.signature = await hmac(c.secret, q);
  const id = "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  return new Promise((ok, no) => { wsc.pend.set(id, { ok, no }); wsc.ws.send(JSON.stringify({ id, method, params: p }));
    setTimeout(() => { if (wsc && wsc.pend.has(id)){ wsc.pend.delete(id); no(new Error("Binance yanıt vermedi (12 sn)")); } }, 12000); });
}
/* symbol meta */
const xinfo = {};
async function meta(d){ const base = typeof d === "string" ? d : d.base, exact = typeof d === "object" && d.src === "fut" ? d.symbol : null;
  const c = bget(), k = c.testnet ? "t" : "m";
  if (!xinfo[k]) xinfo[k] = pub("/fapi/v1/exchangeInfo").catch(e => { delete xinfo[k]; throw e; });
  const info = await xinfo[k];
  for (const [pre, mult] of (exact ? [["@", 1]] : []).concat([["", 1], ["1000", 1000], ["1000000", 1e6], ["1M", 1e6]])){
    const want = pre === "@" ? exact : pre + base + "USDT";
    const s = info.symbols.find(x => x.symbol === want && x.contractType === "PERPETUAL" && x.status === "TRADING");
    if (s){ const f = t => s.filters.find(x => x.filterType === t) || {}; const lot = f("MARKET_LOT_SIZE").stepSize ? f("MARKET_LOT_SIZE") : f("LOT_SIZE");
      const dec = v => { v = String(v); return v.includes(".") ? v.replace(/0+$/, "").split(".")[1].length : 0; };
      return { symbol: s.symbol, mult, step: +lot.stepSize, qdec: dec(lot.stepSize), minQty: +lot.minQty, maxQty: +lot.maxQty, tick: +f("PRICE_FILTER").tickSize, pdec: dec(f("PRICE_FILTER").tickSize), minNotional: +(f("MIN_NOTIONAL").notional || 5) }; } }
  return null;
}
/* unit multiplier between analysed prices and the order contract: 1 when the analysis already uses futures data */
const UM = () => (D && D.src === "fut") ? 1 : (M ? M.mult : 1);
const floorStep = (x, step, d) => (Math.floor(x/step + 1e-9)*step).toFixed(d), roundTick = (x, tick, d) => (Math.round(x/tick)*tick).toFixed(d);
let acct = null, dual = null, M = null;
async function refreshAccount(interactive){
  if (interactive === true && !(await ensureOpen())){ renderAcct("API Secret kilitli — YENİLE ile PIN gir"); return; }
  const c = bget(); if (!c.key){ renderAcct(); return; } if (!c.secret && c.kst === "locked"){ acct = null; renderAcct("🔒 API Secret kilitli — YENİLE'ye dokunup PIN gir"); return; }
  try {
    let a; try { a = await signed("GET", "/fapi/v2/account"); } catch(e){ if (e.http === 404 || e.code === -5000) a = await signed("GET", "/fapi/v3/account"); else throw e; }
    let pos; try { pos = await signed("GET", "/fapi/v2/positionRisk"); } catch(e){ pos = await signed("GET", "/fapi/v3/positionRisk"); }
    try { dual = !!(await signed("GET", "/fapi/v1/positionSide/dual")).dualSidePosition; } catch(e){ dual = false; }
    const u = (a.assets || []).find(x => x.asset === "USDT") || {};
    acct = { wallet: +u.walletBalance || 0, avail: +(u.availableBalance ?? a.availableBalance) || 0, upnl: +a.totalUnrealizedProfit || 0, pos: (pos || []).filter(p => +p.positionAmt !== 0), t: Date.now() };
    renderAcct(); log("#bfx-log", "Hesap okundu ✔ (" + (c.testnet ? "TESTNET" : "GERÇEK") + ")", "up");
  } catch(e){ acct = null; renderAcct(trErr(e)); log("#bfx-log", "✖ " + esc(trErr(e)), "dn"); }
}
function renderAcct(err){
  const el = $("#bfx-acct"); if (!el) return; const c = bget();
  if (!c.key){ el.innerHTML = `<div class="empty">API anahtarı yok. Aşağıdaki ayarlardan ekle.</div>`; return; }
  if (err){ el.innerHTML = `<div class="err-line">✖ ${esc(err)}</div>`; return; }
  if (!acct){ el.innerHTML = `<div class="empty">Hesap okunmadı. "YENİLE"ye dokun.</div>`; return; }
  el.innerHTML = `<div class="kv"><span class="k">USDT cüzdan</span><span class="v">${fmt(acct.wallet, 2)}</span><span class="k">Kullanılabilir</span><span class="v">${fmt(acct.avail, 2)}</span>
    <span class="k">Gerçekleşmemiş K/Z</span><span class="v ${acct.upnl >= 0 ? "up" : "dn"}">${fmt(acct.upnl, 2)}</span><span class="k">Pozisyon modu</span><span class="v">${dual ? "Hedge (çift yön)" : "Tek yön"}</span></div>
    <div class="pos-list">${acct.pos.length ? acct.pos.map(p => { const amt = +p.positionAmt, L = amt > 0;
      return `<div class="pos ${L ? "l" : "s"}"><b>${esc(p.symbol)} ${L ? "LONG" : "SHORT"}</b><span>${fmt(Math.abs(amt))} @ ${fp(p.entryPrice)} · mark ${fp(p.markPrice)} · ${p.leverage ? p.leverage + "x" : ""}</span><span class="${+p.unRealizedProfit >= 0 ? "up" : "dn"}">K/Z ${fmt(+p.unRealizedProfit, 2)} USDT</span><button type="button" data-close="${esc(p.symbol)}" data-ps="${esc(p.positionSide || "BOTH")}">KAPAT</button></div>`; }).join("") : `<div class="empty">Açık pozisyon yok.</div>`}</div>`;
  el.querySelectorAll("[data-close]").forEach(b => b.onclick = () => closePosition(b.dataset.close, b.dataset.ps));
}
function levelsFor(side){ const S = D && D.data.signal; if (!S) return null; return S.levels[side]; }
/* v7.40: sizing goes through BFXSAFE.size() — manual quantity is validated against max zarar (incl. taker fees + slippage both legs), cap and margin;
   NaN / Infinity / negative / zero-distance stops are rejected; minNotional vs max-loss conflicts block the order. Leverage change re-runs calc(). */
function sizeNow(px, opt){ const cfg = ENGINE.config(), f = $("#bfx-form"), side = f.dataset.side, lev = +$("#bfx-lev").value || 1;
  return BFXSAFE.size({ side, px, st: BFXSAFE.num($("#bfx-stop").value), tg: BFXSAFE.num($("#bfx-tgt").value), lev, manual: $("#bfx-qty").value, maxLoss: cfg.max_loss_per_trade,
    accountSize: cfg.account_size, capPct: cfg.position_cap_pct, avail: opt && opt.avail !== undefined ? opt.avail : (acct ? acct.avail : null), M }); }
async function calc(){
  const out = $("#bfx-calc"); if (!out || !D) return null; const c = bget();
  if (!M){ out.innerHTML = `<div class="err-line">✖ ${esc(D.base)} için Binance USDⓈ-M vadeli sözleşme bulunamadı (${c.testnet ? "testnet" : "gerçek"}).</div>`; return null; }
  const px = (livePx || D.price) * UM(), k = sizeNow(px), cfg = ENGINE.config();
  out.innerHTML = `<div class="kv"><span class="k">Sözleşme</span><span class="v">${esc(M.symbol)}${UM() > 1 ? ` (spot fiyatı ×${M.mult})` : ""} · ${D.src === "fut" ? "PERP" : "SPOT verisi"}</span>
    <span class="k">Fiyat (canlı)</span><span class="v">${fp(px)}</span><span class="k">Miktar</span><span class="v">${k.qty.toFixed(M.qdec)} <small>(${esc(k.by)}${k.maxQty > 0 ? ` · en çok ${BFXSAFE.floorStep(k.maxQty, M.step, M.qdec)}` : ""})</small></span>
    <span class="k">Tutar / teminat</span><span class="v">$${k.notional.toFixed(2)} / $${k.margin.toFixed(2)}</span><span class="k">Stopta zarar ≈</span><span class="v dn">$${k.loss.toFixed(2)} <small>(ücret+kayma dahil · max $${cfg.max_loss_per_trade})</small></span>
    <span class="k">Hedefte kâr ≈</span><span class="v up">$${k.gain.toFixed(2)} <small>(ücret sonrası)</small></span></div>${k.issues.map(i => `<div class="err-line">✖ ${esc(i)}</div>`).join("")}
    <div class="dim" style="font-size:10.5px">varsayım: taker %${(k.fee*100).toFixed(2)} + kayma %${(k.slip*100).toFixed(2)} her bacakta</div>`;
  return Object.assign({ side: k.L ? "long" : "short" }, k); }
/* v7.40 order ledger: a symbol whose last order ended BELİRSİZ (reply lost) is blocked until reconciled — never resent blindly */
const PENDK = "neon.bfx.pend", pendRd = () => { try { return JSON.parse(localStorage.getItem(PENDK) || "{}") || {}; } catch(e){ return {}; } }, pendWr = o => localStorage.setItem(PENDK, JSON.stringify(o));
const inflight = new Set();
function safeApi(c){ return { place: p => wsCall("order.place", p, c), algoPlace: p => wsCall("algoOrder.place", p, c), algoCancel: p => wsCall("algoOrder.cancel", p, c),
  query: async p => { try { return await signed("GET", "/fapi/v1/order", p, c); } catch(e){ if (e && (e.code === -2013 || e.http === 400)) throw e; return await wsCall("order.status", p, c); } },
  openAlgo: async sym => { const r = await signed("GET", "/fapi/v1/openAlgoOrders", { symbol: sym, algoType: "CONDITIONAL" }, c); return Array.isArray(r) ? r : (r && (r.orders || r.rows)) || []; },
  positions: async sym => (await positionsNow(c)).filter(p => p.symbol === sym),
  sleep: ms => new Promise(r => setTimeout(r, ms)), log: (m, cls) => log("#bfx-log", esc(m), cls), err: e => trErr(e),
  critical: m => { log("#bfx-log", "‼ " + esc(m), "dn crit"); try { NOTIFY.ping("bad", "‼ " + m); } catch(e){} try { window.BUS && BUS.emit("critical", { msg: m }); } catch(e){} } }; }
async function pendCheck(c, sym){ const P = pendRd(), e = P[sym]; if (!e) return true; if (Date.now() - e.t > 24*3600e3){ delete P[sym]; pendWr(P); return true; }
  const o = await BFXSAFE.reconcile(safeApi(c), sym, e.cid, 2); if (o){ delete P[sym]; pendWr(P); log("#bfx-log", `Önceki BELİRSİZ emir çözüldü: ${esc(o.status)}`, "up"); return true; }
  log("#bfx-log", `✖ ${esc(sym)}: önceki emir hâlâ BELİRSİZ (${esc(e.cid)}) — Binance'te kontrol et; yeni emir engellendi.`, "dn"); return false; }
async function placeOrder(){
  if (!(await ensureOpen())){ log("#bfx-log", "✖ API Secret kilitli/eksik — emir gönderilmedi.", "dn"); return; }
  const c = bget(); if (!c.key || !c.secret){ log("#bfx-log", "✖ Önce API anahtarlarını kaydet.", "dn"); return; }
  if (!c.testnet && c.kst === "plain"){ log("#bfx-log", "✖ Güvenlik: GERÇEK API Secret düz metin saklanıyor — önce BAĞLANTILAR → BINANCE'ta PIN ile şifrele.", "dn"); return; }
  try { await syncTime(c.testnet); M = await meta(D); } catch(e){ log("#bfx-log", "✖ " + esc(trErr(e)), "dn"); return; }
  const k = await calc(); if (!k) return; if (!k.ok){ log("#bfx-log", "✖ Emir hazırlanamadı: " + esc(k.issues.join("; ")), "dn"); return; }
  const attach = $("#bfx-attach").checked, mode = c.testnet ? "TESTNET" : "GERÇEK";
  if (!c.testnet && !attach){ log("#bfx-log", "✖ GERÇEK hesapta stop zorunlu: 'Stop ve hedef emirlerini ekle' kutusunu işaretle.", "dn"); return; }
  if (inflight.has(M.symbol)){ log("#bfx-log", "✖ Bu sembolde bir emir zaten işleniyor (çift dokunma engellendi).", "dn"); return; }
  if (!(await pendCheck(c, M.symbol))) return;
  let tMark = null; if (c.testnet) try { tMark = +(await pub("/fapi/v1/premiumIndex?symbol=" + M.symbol)).markPrice; } catch(e){}
  const rows = [["Mod", mode, c.testnet ? "" : "dn"], ["Sembol", M.symbol], ["Yön", k.L ? "LONG (BUY)" : "SHORT (SELL)", k.L ? "up" : "dn"], ["Tür", "MARKET (piyasa)"],
    ["Miktar", k.qty.toFixed(M.qdec)], ["Tutar ≈", "$" + k.notional.toFixed(2)], ["Kaldıraç", k.lev + "x", k.lev > 3 ? "dn" : ""], ["Teminat ≈", "$" + k.margin.toFixed(2)],
    ["Stop", attach ? roundTick(k.st, M.tick, M.pdec) + " (STOP_MARKET, tümünü kapat)" : "YOK", attach ? "dn" : "dn"], ["Hedef", attach ? roundTick(k.tg, M.tick, M.pdec) + " (TAKE_PROFIT_MARKET)" : "YOK", "up"],
    ["Stopta zarar ≈", "$" + k.loss.toFixed(2) + " (ücret+kayma dahil)", "dn"], ["Analiz fiyatı", fp(k.px) + (D.src === "fut" ? " (mainnet PERP)" : " (SPOT)")]];
  if (tMark) rows.push(["Testnet mark fiyatı", fp(tMark), Math.abs(tMark/k.px - 1) > 0.01 ? "dn" : ""]);
  const warn = (k.lev > 3 ? "⚠ Yüksek kaldıraç: küçük bir hareket teminatını eritebilir, likidasyon riski var.<br>" : "") + (attach ? "" : "⚠ Stop eklenmedi: zarar sınırsız büyüyebilir.<br>") +
    (c.testnet ? `ℹ Testnet fiyatı gerçek piyasadan farklı olabilir${tMark && Math.abs(tMark/k.px - 1) > 0.01 ? ` (şu an %${((tMark/k.px - 1)*100).toFixed(1)} fark — stop/hedef testnette hemen tetiklenebilir ya da reddedilebilir)` : ""}. Analiz gerçek (mainnet) vadeli verisini kullanır.<br>` : "") +
    (D.src !== "fut" ? "⚠ Analiz SPOT verisiyle yapıldı (Futures erişilemedi); vadeli fiyat farklı olabilir.<br>" : "") +
    "Sinyal garanti değildir. Piyasa emri anlık fiyattan dolar; kayma olabilir.";
  if (!(await confirmSheet({ title: "EMRİ ONAYLA", rows, mode, warn, okText: "ONAYLA · " + (k.L ? "LONG" : "SHORT") }))){ log("#bfx-log", "Emir iptal edildi (onaylanmadı)."); return; }
  const Mo = M, sym = Mo.symbol; inflight.add(sym);
  try {
    /* re-validate right before sending: fresh account (margin) + fresh price, same inputs → same rules */
    await refreshAccount(); if (!acct){ log("#bfx-log", "✖ Hesap okunamadı — emir gönderilmedi.", "dn"); return; }
    let fresh = k.px; try { fresh = +(await pub("/fapi/v1/ticker/price?symbol=" + sym)).price || k.px; } catch(e){}
    if (M !== Mo){ log("#bfx-log", "✖ Coin değişti — emir gönderilmedi.", "dn"); return; } const k2 = sizeNow(fresh, { avail: acct.avail }); if (!k2.ok || k2.qty > k.qty + 1e-12){ log("#bfx-log", "✖ Son kontrol başarısız (fiyat/teminat değişti): " + esc(k2.issues.join("; ") || "miktar arttı") + " — tekrar hazırla.", "dn"); calc().catch(() => {}); return; }
    try { await signed("POST", "/fapi/v1/leverage", { symbol: sym, leverage: k.lev }); log("#bfx-log", `Kaldıraç ${k.lev}x ayarlandı`); }
    catch(e){ log("#bfx-log", "✖ Kaldıraç ayarlanamadı: " + esc(trErr(e)) + " — emir gönderilmedi", "dn"); return; }
    const cid = BFXSAFE.cid("mt"), P = pendRd(); P[sym] = { cid, t: Date.now(), net: c.testnet ? "t" : "m" }; pendWr(P);
    const r = await BFXSAFE.openProtected(safeApi(c), { symbol: sym, L: k.L, qty: k2.qty.toFixed(Mo.qdec), stPx: roundTick(k.st, Mo.tick, Mo.pdec), tgPx: roundTick(k.tg, Mo.tick, Mo.pdec), dual: !!dual, attach, cid });
    if (r.state !== "BELİRSİZ"){ const Q = pendRd(); delete Q[sym]; pendWr(Q); }
    window.BUS && BUS.emit("order", { to: "bn" });
    const ids = JSON.parse(localStorage.getItem("neon.algo." + (c.testnet ? "t" : "m")) || "{}"); ids[sym] = ids[sym] || [];
    for (const x of [r.sl, r.tp]) if (x && x.ok && x.algoId && !ids[sym].includes(x.algoId)) ids[sym].push(x.algoId); localStorage.setItem("neon.algo." + (c.testnet ? "t" : "m"), JSON.stringify(ids));
    const ok = /^AÇIK/.test(r.state);
    log("#bfx-log", `${ok ? "✔" : "✖"} ${k.L ? "LONG" : "SHORT"} · ${esc(r.state)}${r.exec ? ` · dolan ${r.exec}${r.partial ? " (KISMİ)" : ""} @ ${r.avg || "?"}` : ""}${r.sl && r.sl.ok ? ` · stop ${r.sl.verified ? "borsada doğrulandı" : "kuruldu (doğrulanamadı)"}` : ""}${r.tp && r.tp.ok ? " · hedef kuruldu" : ""}${r.err ? " · " + esc(trErr(r.err)) : ""}`, ok ? "up" : "dn");
  } catch(e){ log("#bfx-log", "✖ Emir başarısız: " + esc(trErr(e)), "dn"); }
  finally { inflight.delete(sym); }
  refreshAccount();
}
async function closePosition(sym, posSide){
  const c = bget(); if (!acct) await refreshAccount(); if (!acct) return;
  const list = acct.pos.filter(p => p.symbol === sym && (!posSide || (p.positionSide || "BOTH") === posSide));
  if (!list.length){ log("#bfx-log", `${esc(sym)} için açık pozisyon yok.`); return; }
  for (const p of list){ const amt = +p.positionAmt, L = amt > 0;
    const rows = [["Mod", c.testnet ? "TESTNET" : "GERÇEK", c.testnet ? "" : "dn"], ["Sembol", sym], ["İşlem", "POZİSYONU KAPAT (" + (L ? "LONG → SELL" : "SHORT → BUY") + ")"], ["Miktar", String(Math.abs(amt))],
      ["Tür", "MARKET, reduceOnly"], ["Mark fiyat", fp(p.markPrice)], ["Kaldıraç", (p.leverage || "?") + "x"], ["Stop / hedef", "bu sembolün bekleyen stop/hedef emirleri iptal edilir"], ["Tahmini K/Z", fmt(+p.unRealizedProfit, 2) + " USDT", +p.unRealizedProfit >= 0 ? "up" : "dn"]];
    if (!(await confirmSheet({ title: "POZİSYONU KAPAT", rows, mode: c.testnet ? "TESTNET" : "GERÇEK", okText: "ONAYLA · KAPAT" }))){ log("#bfx-log", "Kapatma iptal edildi."); continue; }
    try { const prm = { symbol: sym, side: L ? "SELL" : "BUY", type: "MARKET", quantity: String(Math.abs(amt)), newOrderRespType: "RESULT" };
      if (dual) prm.positionSide = p.positionSide; else prm.reduceOnly = "true";
      prm.newClientOrderId = BFXSAFE.cid("mc"); let o; try { o = await wsCall("order.place", prm); } catch(e){ if (BFXSAFE.definitive(e)) throw e; o = await BFXSAFE.reconcile(safeApi(c), sym, prm.newClientOrderId); if (!o) throw new Error("kapatma emri durumu BELİRSİZ — yeniden gönderilmedi, Binance'te kontrol et"); }
      log("#bfx-log", `✔ ${esc(sym)} kapatma · #${esc(o.orderId)} · ${esc(o.status)} · ort. ${esc(o.avgPrice || "?")}`, "up");
      await cleanupAfterClose(c, sym, dual ? p.positionSide : null);
    } catch(e){ log("#bfx-log", "✖ Kapatılamadı: " + esc(trErr(e)), "dn"); }
  }
  refreshAccount();
}
/* v7.40: after a close, verify the position is gone and remove ONLY the orphaned protection orders of that side
   (hedge mode: the other side's stop stays). If the position is still open, nothing is cancelled. */
async function cleanupAfterClose(c, sym, posSide){ const api = safeApi(c); let left = null;
  for (let i = 0; i < 3 && left !== 0; i++){ try { left = (await api.positions(sym)).filter(x => !posSide || (x.positionSide || "BOTH") === posSide).reduce((a, x) => a + Math.abs(+x.positionAmt || 0), 0); } catch(e){ left = null; } if (left) await api.sleep(700); }
  if (left === null){ log("#bfx-log", "⚠ Pozisyon kapanışı doğrulanamadı — stop/hedef emirleri silinmedi.", "dn"); return; }
  if (left > 0){ api.critical(`${sym}: kapatma sonrası hâlâ ${left} açık — stop/hedef korunuyor, elle kontrol et`); return; }
  let list = null; try { list = await api.openAlgo(sym); } catch(e){}
  if (list){ let n = 0; for (const a of list) if (!posSide || (a.positionSide || "BOTH") === posSide){ try { await api.algoCancel({ symbol: sym, algoId: a.algoId }); n++; } catch(e){} }
    log("#bfx-log", `✔ ${n} artık stop/hedef emri temizlendi (${esc(sym)}${posSide ? " " + esc(posSide) : ""})`, "up"); return; }
  if (!posSide) await cancelAll(sym, true); else log("#bfx-log", "⚠ Hedge: artık emirler listelenemedi — diğer yönün stopunu korumak için toplu iptal yapılmadı.", "dn"); }
async function cancelAll(sym, silent){
  const c = bget(); if (!c.key){ log("#bfx-log", "✖ API anahtarı yok.", "dn"); return; }
  if (!silent && !(await confirmSheet({ title: "AÇIK EMİRLERİ İPTAL ET", rows: [["Mod", c.testnet ? "TESTNET" : "GERÇEK", c.testnet ? "" : "dn"], ["Sembol", sym], ["İşlem", "bekleyen tüm emirler + stop/hedef (algo) emirleri iptal"]], mode: c.testnet ? "TESTNET" : "GERÇEK", warn: "Açık pozisyon kapanmaz; yalnızca bekleyen emirler silinir. Stop iptal edilirse pozisyon korumasız kalır." }))) return;
  const key = "neon.algo." + (c.testnet ? "t" : "m"), ids = JSON.parse(localStorage.getItem(key) || "{}");
  if (!c.testnet){
    for (const [path, n] of [["/fapi/v1/allOpenOrders", "normal"], ["/fapi/v1/algoOpenOrders", "stop/hedef"]]){
      try { await signed("DELETE", path, { symbol: sym }); log("#bfx-log", `✔ ${n} emirler iptal edildi (${esc(sym)})`, "up"); } catch(e){ if (e.code !== -2011) log("#bfx-log", `⚠ ${n} iptal: ` + esc(trErr(e)), "dn"); }
    }
    ids[sym] = [];
  } else {
    const left = []; for (const id of ids[sym] || []){ try { await wsCall("algoOrder.cancel", { symbol: sym, algoId: id }); log("#bfx-log", `✔ algo #${id} iptal`, "up"); }
      catch(e){ if (!/-2011|-20|not exist|Unknown/i.test(String(e.code) + e.msg)) left.push(id); log("#bfx-log", `· algo #${id}: ` + esc(trErr(e))); } }
    ids[sym] = left; if (!(ids[sym] || []).length) log("#bfx-log", "Testnet: bu cihazdan kurulan stop/hedef emirleri temizlendi. (Testnet REST iptal uçları tarayıcıdan CORS ile kapalı; başka yerden kurulan emirleri Binance testnet sitesinden sil.)");
  }
  localStorage.setItem(key, JSON.stringify(ids));
}
function bfxHTML(){
  const c = bget(), S = D && D.data.signal, side = S ? (S.dir === "SHORT" ? "short" : S.dir === "LONG" ? "long" : S.lean) : "long", lv = levelsFor(side) || {};
  return `<div class="mode-row"><span class="mode-badge ${c.testnet ? "test" : "real"}">${c.testnet ? "TESTNET" : "⚠ GERÇEK PARA"}</span><span class="dim">Binance USDⓈ-M vadeli · LONG ve SHORT</span></div>
  <div class="sub-h">HESAP <button type="button" id="bfx-refresh" class="mini">YENİLE</button></div><div id="bfx-acct"></div>
  <div class="sub-h">YENİ EMİR · ${esc(D ? D.base : "")}</div>
  <form id="bfx-form" data-side="${side}" onsubmit="return false">
    <div class="side-btns"><button type="button" data-side="long" class="${side === "long" ? "on" : ""} l">▲ LONG</button><button type="button" data-side="short" class="${side === "short" ? "on" : ""} s">▼ SHORT</button></div>
    <div class="f2"><label>Kaldıraç<select id="bfx-lev">${Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}" ${i + 1 === (+c.lev || 1) ? "selected" : ""}>${i + 1}x</option>`).join("")}</select></label>
    <label>Miktar (boş = otomatik)<input id="bfx-qty" inputmode="decimal" placeholder="otomatik"></label></div>
    <div id="bfx-levwarn" class="cf-warn ${(+c.lev || 1) > 3 ? "" : "hidden"}">⚠ ${(+c.lev || 1)}x kaldıraç: fiyat %${(100/(+c.lev || 1)).toFixed(0)} ters giderse teminatın tamamı gider (likidasyon). 1x önerilir.</div>
    <div class="f2"><label>Stop<input id="bfx-stop" inputmode="decimal" value="${lv.stop ?? ""}"></label><label>Hedef (2R)<input id="bfx-tgt" inputmode="decimal" value="${lv.target ?? ""}"></label></div>
    <label class="chk"><input type="checkbox" id="bfx-attach" ${c.attach ? "checked" : ""}> Stop ve hedef emirlerini ekle (STOP_MARKET / TAKE_PROFIT_MARKET, tümünü kapat)</label>
    <div id="bfx-calc"></div>
    <button type="button" id="bfx-go" class="go">EMRİ HAZIRLA → ONAY</button>
    <div class="f2"><button type="button" id="bfx-close" class="mini wide">POZİSYONU KAPAT</button><button type="button" id="bfx-cancel" class="mini wide">AÇIK EMİRLERİ İPTAL</button></div>
  </form>
  <div class="sub-h">KAYIT</div><div id="bfx-log" class="tlog"></div>
  <div class="keys-link"><span>API anahtarları: <b class="${c.testnet ? "" : "dn"}">${c.testnet ? "TEST API (Testnet)" : "⚠ GERÇEK API"}</b> aktif ${c.key ? "· " + esc(c.key.slice(0, 4)) + "…" + esc(c.key.slice(-4)) : "· anahtar yok"}</span><button type="button" class="mini" onclick="window.CONN && CONN.open('bn')">BAĞLANTILAR →</button></div>
  <div class="plan-foot">Analiz hiçbir emri kendisi göndermez. Her emir onay penceresi ve ONAYLA dokunuşu ister. Vadeli işlemler kaldıraçlıdır; kaybın teminatı aşabilir.</div>`;
}
function bindBfx(){
  const f = $("#bfx-form"), recalc = () => calc().catch(() => {});
  f.querySelectorAll(".side-btns button").forEach(b => b.onclick = () => { f.dataset.side = b.dataset.side; f.querySelectorAll(".side-btns button").forEach(x => x.classList.toggle("on", x === b));
    const lv = levelsFor(b.dataset.side) || {}; $("#bfx-stop").value = lv.stop ?? ""; $("#bfx-tgt").value = lv.target ?? ""; if (UM() > 1){ $("#bfx-stop").value = (lv.stop*UM()).toPrecision(6); $("#bfx-tgt").value = (lv.target*UM()).toPrecision(6); } recalc(); });
  $("#bfx-lev").onchange = e => { const v = +e.target.value; bset({ lev: v }); const w = $("#bfx-levwarn"); w.classList.toggle("hidden", v <= 3); w.innerHTML = `⚠ ${v}x kaldıraç: fiyat %${(100/v).toFixed(0)} ters giderse teminatın tamamı gider (likidasyon). 1x önerilir.`; recalc(); };
  for (const id of ["#bfx-qty", "#bfx-stop", "#bfx-tgt"]) $(id).oninput = recalc;
  $("#bfx-attach").onchange = e => bset({ attach: e.target.checked });
  $("#bfx-go").onclick = placeOrder; $("#bfx-refresh").onclick = () => refreshAccount(true);
  $("#bfx-close").onclick = () => M ? closePosition(M.symbol) : log("#bfx-log", "✖ Vadeli sözleşme yok.", "dn");
  $("#bfx-cancel").onclick = () => M ? cancelAll(M.symbol) : log("#bfx-log", "✖ Vadeli sözleşme yok.", "dn");
  renderAcct();
  meta(D).then(m => { M = m; if (m && UM() > 1){ const lv = levelsFor(f.dataset.side) || {}; $("#bfx-stop").value = (lv.stop*UM()).toPrecision(6); $("#bfx-tgt").value = (lv.target*UM()).toPrecision(6); } recalc(); })
    .catch(e => { M = null; $("#bfx-calc").innerHTML = `<div class="err-line">✖ Vadeli sembol bilgisi alınamadı: ${esc(trErr(e))}</div>`; });
  if (bget().key && !acct) refreshAccount();
}

/* =====================================================================
   PHANTOM (Solana) · spot swaps via Jupiter · no shorting
   ===================================================================== */
const SOL = { mint: "So11111111111111111111111111111111111111112", symbol: "SOL", decimals: 9 }, USDC = { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", decimals: 6 };
/* keyless browser-CORS RPCs (tested 2026-11-10); a user RPC (e.g. Helius) can be set in localStorage "neon.rpc" */
const RPCS = ["https://solana-rpc.publicnode.com", "https://solana-mainnet.gateway.tatum.io"];
const rpcCool = new Map(); /* url -> time until which it is skipped after 429/403 */
const rpcList = () => { const c = (localStorage.getItem("neon.rpc") || "").trim(); return (/^https:\/\//.test(c) ? [c] : []).concat(RPCS); };
const JUP = "https://lite-api.jup.ag";
let ph = { pk: null, bal: {}, tok: null, quote: null, qAt: 0, from: "USDC", to: "SOL" };
const prov = () => (window.phantom && window.phantom.solana && window.phantom.solana.isPhantom) ? window.phantom.solana : (window.solana && window.solana.isPhantom ? window.solana : null);
async function rpc(method, params){
  let last;
  for (let round = 0; round < 2; round++){ const now = Date.now(), L = rpcList().filter(u => round || !(rpcCool.get(u) > now));
    for (const u of L){
      try { const r = await fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
        if (r.status === 429 || r.status === 403){ rpcCool.set(u, Date.now() + 30000); last = new Error("RPC sınırı (" + r.status + ")"); continue; }
        const j = await r.json(); if (j.error){ last = new Error(j.error.message); if (j.error.code === -32005 || /rate limit/i.test(j.error.message)){ rpcCool.set(u, Date.now() + 30000); continue; } if (method === "sendTransaction") throw last; continue; } return j.result; }
      catch(e){ if (method === "sendTransaction" && last === e) throw e; last = e; }
    }
    await new Promise(r => setTimeout(r, 700));
  }
  throw new Error("Solana RPC erişilemedi: " + (last && last.message));
}
async function tokenBal(owner, mint){ const r = await rpc("getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed" }]);
  return (r.value || []).reduce((a, x) => a + (+x.account.data.parsed.info.tokenAmount.uiAmount || 0), 0); }
async function refreshBal(){
  if (!ph.pk) return; const el = $("#ph-bal"); if (el) el.innerHTML = `<div class="empty">bakiyeler okunuyor…</div>`;
  try { const lam = await rpc("getBalance", [ph.pk]); ph.bal.SOL = lam.value/1e9; ph.bal.USDC = await tokenBal(ph.pk, USDC.mint);
    if (ph.tok) ph.bal[ph.tok.symbol] = await tokenBal(ph.pk, ph.tok.mint); phBal(); }
  catch(e){ if (el) el.innerHTML = `<div class="err-line">✖ ${esc(e.message)}</div>`; }
}
function phBal(){ const el = $("#ph-bal"); if (!el) return;
  el.innerHTML = `<div class="kv"><span class="k">SOL</span><span class="v">${fmt(ph.bal.SOL, 6)}</span><span class="k">USDC</span><span class="v">${fmt(ph.bal.USDC, 4)}</span>${ph.tok ? `<span class="k">${esc(ph.tok.symbol)}</span><span class="v">${fmt(ph.bal[ph.tok.symbol], 6)}</span>` : ""}</div>`; }
async function findToken(q){ const r = await fetch(JUP + "/tokens/v2/search?query=" + encodeURIComponent(q)); if (!r.ok) throw new Error("Jupiter token araması HTTP " + r.status); return r.json(); }
async function autoToken(){
  const el = $("#ph-tok"); if (!D || !el) return; const base = D.base.toUpperCase();
  if (base === "SOL" || base === "USDC"){ el.innerHTML = `<small>${base} zaten listede.</small>`; return; }
  try { const list = (await findToken(base)).filter(t => (t.symbol || "").toUpperCase() === base).sort((a, b) => (b.isVerified - a.isVerified) || ((b.liquidity || 0) - (a.liquidity || 0)));
    const t = list[0];
    if (t && (t.isVerified || (t.liquidity || 0) > 100000)){ setTok({ mint: t.id, symbol: t.symbol, decimals: t.decimals, name: t.name, verified: t.isVerified }); }
    else el.innerHTML = `<small>${esc(base)} için doğrulanmış Solana tokenı bulunamadı. Mint adresini biliyorsan aşağıya yapıştır.</small>`;
  } catch(e){ el.innerHTML = `<small>Token araması başarısız: ${esc(e.message)}</small>`; }
}
function setTok(t){ ph.tok = t; const el = $("#ph-tok");
  if (el) el.innerHTML = `<div class="tok"><b>${esc(t.symbol)}</b> ${esc(t.name || "")} ${t.verified ? '<span class="up">✔ doğrulanmış</span>' : '<span class="dn">⚠ doğrulanmamış — mint adresini kontrol et</span>'}<br><small>mint: ${esc(t.mint)}</small></div>`;
  phSelects(); if (ph.pk) refreshBal(); }
const tokens = () => [USDC, SOL].concat(ph.tok ? [ph.tok] : []);
function phSelects(){ const opts = sel => tokens().map(t => `<option ${t.symbol === sel ? "selected" : ""}>${esc(t.symbol)}</option>`).join("");
  const a = $("#ph-from"), b = $("#ph-to"); if (!a) return; a.innerHTML = opts(ph.from); b.innerHTML = opts(ph.to); }
async function getQuote(){
  const out = $("#ph-quote"); const T = tokens(), fi = T.find(t => t.symbol === $("#ph-from").value), to = T.find(t => t.symbol === $("#ph-to").value);
  const amt = parseFloat(($("#ph-amt").value || "").replace(",", ".")), slip = Math.round(parseFloat(($("#ph-slip").value || "0.5").replace(",", "."))*100);
  ph.from = fi.symbol; ph.to = to.symbol; ph.quote = null;
  if (fi.mint === to.mint){ out.innerHTML = `<div class="err-line">✖ Aynı token seçili.</div>`; return null; }
  if (!(amt > 0)){ out.innerHTML = `<div class="err-line">✖ Miktar gir.</div>`; return null; }
  if (!(slip >= 1 && slip <= 500)){ out.innerHTML = `<div class="err-line">✖ Kayma %0.01–%5 arası olmalı.</div>`; return null; }
  out.innerHTML = `<div class="empty">teklif alınıyor…</div>`;
  try { const raw = Math.round(amt*10**fi.decimals);
    const r = await fetch(`${JUP}/swap/v1/quote?inputMint=${fi.mint}&outputMint=${to.mint}&amount=${raw}&slippageBps=${slip}&restrictIntermediateTokens=true`);
    const q = await r.json(); if (!r.ok || q.error) throw new Error(q.error || ("HTTP " + r.status));
    const outAmt = +q.outAmount/10**to.decimals, minOut = +q.otherAmountThreshold/10**to.decimals, imp = (+q.priceImpactPct || 0)*100;
    ph.quote = { q, fi, to, amt, outAmt, minOut, imp, slip }; ph.qAt = Date.now();
    out.innerHTML = `<div class="kv"><span class="k">Verilen</span><span class="v">${fmt(amt, 8)} ${esc(fi.symbol)}</span><span class="k">Alınacak ≈</span><span class="v up">${fmt(outAmt, 8)} ${esc(to.symbol)}</span>
      <span class="k">En az (kayma sonrası)</span><span class="v">${fmt(minOut, 8)} ${esc(to.symbol)}</span><span class="k">Fiyat etkisi</span><span class="v ${imp > 1 ? "dn" : ""}">${imp.toFixed(3)}%</span>
      <span class="k">Kayma</span><span class="v">%${(slip/100).toFixed(2)}</span><span class="k">Rota</span><span class="v">${esc((q.routePlan || []).map(x => x.swapInfo && x.swapInfo.label).filter(Boolean).join(" → ") || "—")}</span></div>${imp > 2 ? `<div class="err-line">⚠ Fiyat etkisi yüksek (%${imp.toFixed(2)}).</div>` : ""}`;
    return ph.quote;
  } catch(e){ out.innerHTML = `<div class="err-line">✖ Jupiter teklif hatası: ${esc(e.message)}</div>`; return null; }
}
let w3p = null;
function web3(){ if (window.solanaWeb3) return Promise.resolve(window.solanaWeb3);
  return w3p = w3p || new Promise((ok, no) => { const s = document.createElement("script"); s.src = "vendor/solana-web3.iife.min.js?v=7.30.1"; s.onload = () => ok(window.solanaWeb3); s.onerror = () => { w3p = null; no(new Error("solana web3 yüklenemedi")); }; document.head.appendChild(s); }); }
async function doSwap(){
  const p = prov(); if (!p || !ph.pk){ log("#ph-log", "✖ Önce Phantom'u bağla.", "dn"); return; }
  let Q = ph.quote; if (!Q || Date.now() - ph.qAt > 25000){ Q = await getQuote(); if (!Q) return; log("#ph-log", "Teklif yenilendi (eskiydi). Kontrol et."); }
  const rows = [["Ağ", "Solana MAINNET (gerçek)", "dn"], ["Cüzdan", ph.pk.slice(0, 4) + "…" + ph.pk.slice(-4)], ["Verilen", fmt(Q.amt, 8) + " " + Q.fi.symbol], ["Alınacak ≈", fmt(Q.outAmt, 8) + " " + Q.to.symbol, "up"],
    ["En az", fmt(Q.minOut, 8) + " " + Q.to.symbol], ["Fiyat etkisi", Q.imp.toFixed(3) + "%", Q.imp > 1 ? "dn" : ""], ["Kayma", "%" + (Q.slip/100).toFixed(2)], ["Tür", "SPOT swap (Jupiter) · kaldıraç yok · short yok"]];
  if (!(await confirmSheet({ title: "SWAP ONAYLA", rows, mode: "GERÇEK", warn: "Phantom ayrıca kendi onay penceresini açacak; orada da kontrol et. İşlem zincire gidince geri alınamaz.", okText: "ONAYLA · PHANTOM'DA İMZALA" }))){ log("#ph-log", "Swap iptal edildi."); return; }
  try {
    const r = await fetch(JUP + "/swap/v1/swap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quoteResponse: Q.q, userPublicKey: ph.pk, wrapAndUnwrapSol: true, dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 1000000, priorityLevel: "medium" } } }) });
    const j = await r.json(); if (!r.ok || !j.swapTransaction) throw new Error(j.error || ("Jupiter swap HTTP " + r.status));
    const W = await web3(); const bytes = Uint8Array.from(atob(j.swapTransaction), c => c.charCodeAt(0)); const tx = W.VersionedTransaction.deserialize(bytes);
    const res = await p.signAndSendTransaction(tx); const sig = res.signature || res;
    window.BUS && BUS.emit("order", { to: "ph" });
    log("#ph-log", `✔ Gönderildi: <a href="https://solscan.io/tx/${esc(sig)}" target="_blank" rel="noopener">${esc(String(sig).slice(0, 10))}… (Solscan)</a>`, "up");
    ph.quote = null; setTimeout(refreshBal, 6000);
  } catch(e){ log("#ph-log", "✖ Swap başarısız: " + esc(e.code === 4001 ? "Phantom'da reddedildi" : (e.message || String(e))), "dn"); }
}
function phHTML(){
  const p = prov(), url = location.href.split("#")[0], deep = `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(location.origin + location.pathname)}`;
  return `<div class="mode-row"><span class="mode-badge real">SOLANA MAINNET</span><span class="dim">Phantom · Jupiter swap · yalnızca SPOT</span></div>
  <div class="cf-warn">Phantom ile <b>SHORT açılamaz</b> ve kaldıraç yoktur: yalnızca token alıp satarsın (spot). SHORT sinyali için Binance Vadeli sekmesini kullan.</div>
  ${p ? (ph.pk ? `<div class="addr">● bağlı: <b>${esc(ph.pk.slice(0, 6))}…${esc(ph.pk.slice(-6))}</b> <button type="button" id="ph-disc" class="mini">AYIR</button> <button type="button" id="ph-ref" class="mini">YENİLE</button></div><div id="ph-bal"></div>`
        : `<button type="button" id="ph-conn" class="go">PHANTOM'U BAĞLA</button>`)
      : `<div class="empty" style="font-style:normal">Bu tarayıcıda Phantom bulunamadı. Telefonda siteyi Phantom uygulamasının içindeki tarayıcıda aç:</div>
         <a class="go" href="${esc(deep)}">PHANTOM'DA AÇ ↗</a><div class="plan-foot">Masaüstünde Phantom tarayıcı eklentisini kurup sayfayı yenileyebilirsin.</div>`}
  <div class="sub-h">TOKEN · ${esc(D ? D.base : "")}</div><div id="ph-tok"><small>aranıyor…</small></div>
  <div class="f2"><label>Mint adresi yapıştır<input id="ph-mint" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ör. JUPyiwrY…"></label><button type="button" id="ph-mint-go" class="mini wide" style="align-self:end">KULLAN</button></div>
  <div class="sub-h">SWAP</div>
  <div class="f2"><label>Ver<select id="ph-from"></select></label><label>Al<select id="ph-to"></select></label></div>
  <div class="f2"><label>Miktar<input id="ph-amt" inputmode="decimal" placeholder="ör. 10"></label><label>Kayma %<input id="ph-slip" inputmode="decimal" value="0.5"></label></div>
  <div class="f2"><button type="button" id="ph-q" class="mini wide">TEKLİF AL</button><button type="button" id="ph-swap" class="go" style="margin:0">SWAP → ONAY</button></div>
  <div id="ph-quote"></div><div class="sub-h">KAYIT</div><div id="ph-log" class="tlog"></div>
  <div class="plan-foot">Özel anahtarın Phantom'da kalır; bu site yalnızca açık adresini görür ve senin imzalaman için işlem hazırlar. Bakiye: halka açık Solana RPC (yoğunlukta sınırlanabilir).</div>`;
}
function bindPh(){
  const p = prov();
  if ($("#ph-conn")) $("#ph-conn").onclick = async () => { try { const r = await p.connect(); ph.pk = (r.publicKey || p.publicKey).toString(); render(); refreshBal(); } catch(e){ log("#ph-log", "✖ Bağlantı reddedildi: " + esc(e.message || e), "dn"); } };
  if ($("#ph-disc")) $("#ph-disc").onclick = async () => { try { await p.disconnect(); } catch(e){} ph.pk = null; render(); };
  if ($("#ph-ref")) $("#ph-ref").onclick = refreshBal;
  $("#ph-mint-go").onclick = async () => { const m = $("#ph-mint").value.trim(); if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m)){ log("#ph-log", "✖ Geçersiz mint adresi.", "dn"); return; }
    try { const t = (await findToken(m)).find(x => x.id === m); if (!t) throw new Error("Jupiter bu minti tanımıyor"); setTok({ mint: t.id, symbol: t.symbol, decimals: t.decimals, name: t.name, verified: t.isVerified }); }
    catch(e){ log("#ph-log", "✖ " + esc(e.message), "dn"); } };
  $("#ph-q").onclick = getQuote; $("#ph-swap").onclick = doSwap;
  phSelects(); if (ph.tok) setTok(ph.tok); else autoToken(); if (ph.pk) { phBal(); refreshBal(); }
  if (p && !ph.pk) p.connect({ onlyIfTrusted: true }).then(r => { ph.pk = r.publicKey.toString(); render(); refreshBal(); }).catch(() => {});
}


/* =====================================================================
   OTO AL-SAT hooks (auto.js). Only called when the user switched Binance auto ON.
   Testnet: allowed. GERÇEK: only if the separate "Binance GERÇEK'te oto" box is ticked (auto.js enforces it).
   ===================================================================== */
async function positionsNow(c){ let pos; try { pos = await signed("GET", "/fapi/v2/positionRisk", {}, c); } catch(e){ pos = await signed("GET", "/fapi/v3/positionRisk", {}, c); } return (pos || []).filter(p => +p.positionAmt !== 0); }
async function autoOrder(d, { lev = 1, cfgOverride } = {}){
  const c = bget(); if (c.key && c.kst === "locked") throw lockedErr(c.which); if (!c.key || !c.secret) throw new Error("aktif Binance bölümünde anahtar yok");
  if (!c.testnet && c.kst === "plain") throw new Error("GERÇEK API Secret düz metin — önce PIN ile şifrele");
  const S = d.data.signal; if (!S || (S.dir !== "LONG" && S.dir !== "SHORT")) throw new Error("sinyal yok");
  await syncTime(c.testnet); const m = await meta(d); if (!m) throw new Error(d.symbol + " vadeli sözleşmesi yok");
  if (inflight.has(m.symbol)) return { skipped: "bu sembolde emir işleniyor" };
  const P0 = pendRd(); if (P0[m.symbol] && Date.now() - P0[m.symbol].t < 24*3600e3) return { skipped: "önceki emir BELİRSİZ — elle kontrol et" };
  const open = await positionsNow(c); if (open.some(p => p.symbol === m.symbol)) return { skipped: "bu sembolde zaten açık pozisyon var" };
  try { dual = !!(await signed("GET", "/fapi/v1/positionSide/dual", {}, c)).dualSidePosition; } catch(e){ dual = false; }
  const L = S.dir === "LONG", a = S.active, cfg = Object.assign(ENGINE.config(), cfgOverride || {});
  let px = d.price; try { px = +(await pub("/fapi/v1/ticker/price?symbol=" + m.symbol, c)).price || px; } catch(e){}
  let avail = null; try { const ac = await signed("GET", "/fapi/v2/account", {}, c); avail = +(((ac.assets || []).find(x => x.asset === "USDT") || {}).availableBalance ?? ac.availableBalance); } catch(e){}
  if (!(avail >= 0)) return { skipped: "hesap/teminat okunamadı" };
  const k = BFXSAFE.size({ side: L ? "long" : "short", px, st: a.stop, tg: a.target, lev, manual: "", maxLoss: cfg.max_loss_per_trade, accountSize: cfg.account_size, capPct: cfg.position_cap_pct, avail: avail*0.9/0.95, M: m });
  if (!k.ok) return { skipped: k.issues.join("; ") };
  try { await signed("POST", "/fapi/v1/leverage", { symbol: m.symbol, leverage: lev }, c); } catch(e){ return { skipped: "kaldıraç ayarlanamadı: " + trErr(e) }; }
  inflight.add(m.symbol);
  try { const cid = BFXSAFE.cid("ma"), P = pendRd(); P[m.symbol] = { cid, t: Date.now(), net: c.testnet ? "t" : "m" }; pendWr(P);
    const r = await BFXSAFE.openProtected(safeApi(c), { symbol: m.symbol, L, qty: k.qty.toFixed(m.qdec), stPx: roundTick(a.stop, m.tick, m.pdec), tgPx: roundTick(a.target, m.tick, m.pdec), dual: !!dual, attach: true, cid });
    if (r.state !== "BELİRSİZ"){ const Q = pendRd(); delete Q[m.symbol]; pendWr(Q); }
    window.BUS && BUS.emit("order", { to: "bn" });
    const ids = JSON.parse(localStorage.getItem("neon.algo." + (c.testnet ? "t" : "m")) || "{}"); ids[m.symbol] = ids[m.symbol] || [];
    for (const x of [r.sl, r.tp]) if (x && x.ok && x.algoId && !ids[m.symbol].includes(x.algoId)) ids[m.symbol].push(x.algoId); localStorage.setItem("neon.algo." + (c.testnet ? "t" : "m"), JSON.stringify(ids));
    if (!/^AÇIK/.test(r.state)) throw new Error(r.state + (r.err ? ": " + trErr(r.err) : ""));
    const q = r.exec || k.qty, ap = r.avg || px;
    return { symbol: m.symbol, side: S.dir, qty: q, px: ap, notional: q*ap, margin: q*ap/lev, stop: a.stop, target: a.target, orderId: r.orderId, testnet: c.testnet, state: r.state,
      prot: [r.sl && r.sl.ok ? "Stop ✔" + (r.sl.verified ? " (borsada doğrulandı)" : "") : "Stop ✖", r.tp && r.tp.ok ? "Hedef ✔" : "Hedef ✖"].concat(r.partial ? ["KISMİ dolum"] : []) }; }
  finally { inflight.delete(m.symbol); } }
async function autoClose(sym){ const c = bget(); const list = (await positionsNow(c)).filter(p => p.symbol === sym); let n = 0;
  for (const p of list){ const amt = +p.positionAmt, hedge = (p.positionSide || "BOTH") !== "BOTH", prm = { symbol: sym, side: amt > 0 ? "SELL" : "BUY", type: "MARKET", quantity: String(Math.abs(amt)), newOrderRespType: "RESULT", newClientOrderId: BFXSAFE.cid("mk") };
    if (hedge) prm.positionSide = p.positionSide; else prm.reduceOnly = "true";
    try { await wsCall("order.place", prm, c); } catch(e){ if (BFXSAFE.definitive(e)) throw e; const o = await BFXSAFE.reconcile(safeApi(c), sym, prm.newClientOrderId); if (!o) throw new Error(sym + " kapatma durumu BELİRSİZ — yeniden gönderilmedi"); }
    n++; await cleanupAfterClose(c, sym, hedge ? p.positionSide : null); }
  return n; }
async function realized(sym, since){ const c = bget(); const r = await signed("GET", "/fapi/v1/income", { symbol: sym, startTime: since - 60000, limit: 1000 }, c);
  return (r || []).filter(x => x.incomeType === "REALIZED_PNL" || x.incomeType === "COMMISSION" || x.incomeType === "FUNDING_FEE").reduce((s, x) => s + +x.income, 0); }
/* ---------------- shell ---------------- */
function render(){
  const box = $("#trade-box"); if (!box) return;
  document.querySelectorAll(".ttabs button").forEach(b => b.classList.toggle("on", b.dataset.tt === TAB));
  if (!D){ box.innerHTML = `<div class="empty">Önce bir coin analiz et.</div>`; return; }
  try { if (TAB === "bfx"){ box.innerHTML = bfxHTML(); bindBfx(); } else { box.innerHTML = phHTML(); bindPh(); } }
  catch(e){ console.error(e); box.innerHTML = `<div class="err-line">✖ İşlem paneli hatası: ${esc(e.message)}</div>`; }
}
document.querySelectorAll(".ttabs button").forEach(b => b.addEventListener("click", () => { TAB = b.dataset.tt; render(); }));
let calcT = 0;
return {
  onAnalysis(d){ const sameBase = D && D.base === d.base; D = d; livePx = null; if (!sameBase){ M = null; ph.tok = null; ph.quote = null; } render(); },
  onTick(p){ livePx = p; if (TAB === "bfx" && $("#bfx-calc") && Date.now() - calcT > 1000){ calcT = Date.now(); calc().catch(() => {}); } },
  _test: { hmac, trErr, wsCall, signed, meta, bget, bset },
  /* used by BAĞLANTILAR (conn.js) */
  keys: { bget, bset, prof, pset, pput, pdel, ensureOpen, raw: w => rd(PK[w]) },
  reset(){ acct = null; dual = null; tFor = null; xinfo.t = xinfo.m = undefined; delete xinfo.t; delete xinfo.m; M = null; if (wsc) try { wsc.ws.close(); } catch(e){} wsc = null; render(); },
  async testProfile(w){ if (!(await ensureOpen(w))) throw new Error("Secret kilitli (PIN girilmedi)"); const c = bget(w); if (!c.key || !c.secret) throw new Error("bu bölümde anahtar yok");
    tFor = null; let a;
    try { a = await signed("GET", "/fapi/v2/account", {}, c); } catch(e){ if (e.http === 404 || e.code === -5000) a = await signed("GET", "/fapi/v3/account", {}, c); else if (e.name === "TypeError"){ const r = await wsCall("v2/account.balance", {}, c); return { via: "ws", usdt: (r || []).find(x => x.asset === "USDT") || {} }; } else throw e; }
    tFor = null; const u = (a.assets || []).find(x => x.asset === "USDT") || {};
    return { via: "rest", usdt: { balance: u.walletBalance, availableBalance: u.availableBalance ?? a.availableBalance, crossUnPnl: a.totalUnrealizedProfit }, canTrade: a.canTrade, pos: (a.positions || []).filter(p => +p.positionAmt !== 0).length }; },
  trErr, confirmSheet,
  auto: { order: autoOrder, close: autoClose, positions: () => positionsNow(bget()), realized },
  ph: { get pk(){ return ph.pk; }, set pk(v){ ph.pk = v; }, prov, rpc, web3, refresh(){ if (TAB === "ph") render(); } }
};
})();
window.TRADE = TRADE;
