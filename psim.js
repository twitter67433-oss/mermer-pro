/* MERMER TERMİNAL v7.26 — VADELİ SİMÜLATÖR (kağıt işlem). Live Binance USD-M prices, VIRTUAL balance only.
   No API key, no order endpoint, nothing is ever sent to Binance except public price reads (fstream aggTrade / fapi ticker).
   Core (PSIM) is pure and unit-tested; the UI below only runs in the browser. */
"use strict";
(function (root, factory){ const M = factory(); if (typeof module === "object" && module.exports) module.exports = M; else root.PSIM = M; })(typeof self !== "undefined" ? self : this, function (){
const FEE = 0.0005, MMR = 0.004, fin = x => typeof x === "number" && isFinite(x);
const create = (bal = 1000) => ({ v: 1, bal: +bal, start: +bal, pos: [], hist: [], id: 0 });
const used = st => st.pos.reduce((s, p) => s + p.margin, 0);
const free = st => st.bal - used(st);
const liqPx = (side, entry, lev) => side > 0 ? entry*(1 - 1/lev + MMR) : entry*(1 + 1/lev - MMR);
const upnl = (p, px) => p.side*(px - p.entry)*p.qty;
function open(st, o){ const side = o.side > 0 ? 1 : -1, margin = +o.margin, lev = Math.round(+o.lev), px = +o.px;
  if (!o.sym) throw new Error("coin seç"); if (!(margin > 0)) throw new Error("teminat > 0 olmalı"); if (!(lev >= 1 && lev <= 125)) throw new Error("kaldıraç 1–125"); if (!(px > 0)) throw new Error("canlı fiyat yok");
  const stop = o.stop === "" || o.stop == null || !(+o.stop > 0) ? null : +o.stop, tp = o.tp === "" || o.tp == null || !(+o.tp > 0) ? null : +o.tp;
  if (stop !== null && (stop - px)*side >= 0) throw new Error(side > 0 ? "LONG stop fiyatın altında olmalı" : "SHORT stop fiyatın üstünde olmalı");
  if (tp !== null && (tp - px)*side <= 0) throw new Error(side > 0 ? "LONG hedef fiyatın üstünde olmalı" : "SHORT hedef fiyatın altında olmalı");
  const notional = margin*lev, fee = notional*FEE; if (margin + fee > free(st) + 1e-9) throw new Error(`serbest bakiye yetmiyor (${free(st).toFixed(2)} USDT)`);
  const liq = liqPx(side, px, lev); if (stop !== null && (stop - liq)*side <= 0) throw new Error("stop likidasyon fiyatının ötesinde — kaldıracı düşür");
  st.bal -= fee; const p = { id: ++st.id, sym: o.sym, side, margin, lev, entry: px, qty: notional/px, stop, tp, liq, feeIn: fee, t: o.t || Date.now(), sig: o.sig || null }; st.pos.push(p); return p; }
function close(st, id, px, why, t){ const i = st.pos.findIndex(p => p.id === id); if (i < 0) return null; const p = st.pos[i]; st.pos.splice(i, 1);
  let gross, feeOut; if (why === "likidasyon"){ gross = -p.margin; feeOut = 0; } else { gross = upnl(p, px); feeOut = p.qty*px*FEE; }
  st.bal += gross - feeOut; const net = gross - feeOut - p.feeIn;
  const r = { id: p.id, sym: p.sym, side: p.side, lev: p.lev, margin: p.margin, entry: p.entry, exit: px, why, net, roe: net/p.margin, fee: feeOut + p.feeIn, t0: p.t, t1: t || Date.now(), sig: p.sig }; st.hist.unshift(r); if (st.hist.length > 300) st.hist.length = 300; return r; }
/* hi/lo = extremes seen since the last check (default px). Adverse level first (stop or liquidation, whichever is nearer), then target —
   if both are touched inside one check the stop is assumed (conservative). */
function mark(st, sym, px, t, hi, lo){ hi = fin(hi) ? Math.max(hi, px) : px; lo = fin(lo) ? Math.min(lo, px) : px; const out = [];
  for (const p of st.pos.slice()){ if (p.sym !== sym) continue; const s = p.side, adv = s > 0 ? lo : hi, fav = s > 0 ? hi : lo;
    const stopFirst = p.stop !== null && (p.stop - p.liq)*s > 0;
    if (stopFirst && (adv - p.stop)*s <= 0){ out.push(close(st, p.id, p.stop, "stop", t)); continue; }
    if ((adv - p.liq)*s <= 0){ out.push(close(st, p.id, p.liq, "likidasyon", t)); continue; }
    if (p.tp !== null && (fav - p.tp)*s >= 0){ out.push(close(st, p.id, p.tp, "hedef", t)); continue; } }
  return out; }
function addBal(st, v){ v = +v; if (!(v > 0) || !fin(v) || v > 1e9) throw new Error("miktar > 0 olmalı"); st.bal += v; st.start += v; return st.bal; }
function reset(st, v = 1000){ const n = create(v); Object.keys(st).forEach(k => delete st[k]); Object.assign(st, n); return st; }
/* sinyal doğruluğu: for trades opened while a signal had a direction (GİR or eğilim), did price move that way by the exit? */
function stats(st){ const H = st.hist, n = H.length, w = H.filter(r => r.net > 0).length, tot = H.reduce((s, r) => s + r.net, 0);
  const S = H.filter(r => r.sig && r.sig.d), sh = S.filter(r => (r.exit - r.entry)*r.sig.d > 0).length, G = H.filter(r => r.sig && /^GİR/.test(r.sig.word || "")), gw = G.filter(r => r.net > 0).length;
  return { n, wins: w, winRate: n ? w/n : null, total: tot, sigN: S.length, sigAcc: S.length ? sh/S.length : null, girN: G.length, girWin: G.length ? gw/G.length : null }; }
function equity(st, prices){ return st.bal + st.pos.reduce((s, p) => s + (fin(prices[p.sym]) ? upnl(p, prices[p.sym]) - p.qty*prices[p.sym]*FEE : 0), 0); }
return { FEE, MMR, create, open, close, mark, addBal, reset, stats, equity, free, used, liqPx, upnl };
});

/* ------------------------------ UI (browser only) ------------------------------ */
if (typeof window !== "undefined" && typeof document !== "undefined") window.PSIMUI = (() => {
const K = "mermer.psim", P = window.PSIM, $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let st = (() => { try { const s = JSON.parse(localStorage.getItem(K) || "null"); if (s && s.v === 1 && isFinite(s.bal)) return s; } catch(e){} return P.create(1000); })();
const save = () => { try { localStorage.setItem(K, JSON.stringify(st)); } catch(e){} };
const px = {}, ext = {}; let ws = null, wsKey = "", side = 1, sel = "", lastPaint = 0, pollT = null;
const fp = v => !isFinite(v) ? "—" : v >= 1000 ? v.toFixed(1) : v >= 10 ? v.toFixed(2) : v >= 1 ? v.toFixed(3) : v >= 0.01 ? v.toFixed(5) : v.toPrecision(4);
const us = v => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
const curSym = () => { const v = String(($("#ps-sym") || {}).value || sel || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return !v ? "" : v.endsWith("USDT") ? v : v + "USDT"; };
function sigFor(sym){ const S = window.SCALP && SCALP.S; if (S && S.sym === sym && S.dec) return { word: S.dec.word, d: S.G ? Math.sign(S.G.dir || 0) : 0, tf: S.tf, plan: /^GİR/.test(S.dec.word) && S.A ? { stop: S.A.stop, tp: S.A.tp } : null };
  try { const c = window.SGB && SGB._c; if (c) for (const [k, r] of c) if (k.startsWith("p:" + sym + "@") && r && r.word && !r.none) return { word: r.word, d: Math.sign(r.d || 0), tf: k.split("@")[1], plan: null }; } catch(e){} return null; }
/* live prices: public aggTrade stream for the open + selected symbols; REST fallback every 3 s */
function syms(){ const s = new Set(st.pos.map(p => p.sym)); const c = curSym(); if (c && document.body.dataset.pg === "fut" && !document.hidden) s.add(c); return [...s].slice(0, 8); }
function stream(){ const L = syms(), key = L.join(","); if (key === wsKey && ws && ws.readyState <= 1) return; wsKey = key; try { ws && ws.close(); } catch(e){} ws = null; if (!L.length) return;
  try { const w = new WebSocket("wss://fstream.binance.com/stream?streams=" + L.map(s => s.toLowerCase() + "@aggTrade").join("/")); ws = w;
    w.onmessage = ev => { try { const d = JSON.parse(ev.data).data; if (!d) return; const s = d.s, p = +d.p; px[s] = p; const e = ext[s] || (ext[s] = { hi: p, lo: p }); if (p > e.hi) e.hi = p; if (p < e.lo) e.lo = p; } catch(e){} };
    w.onclose = () => { if (ws === w){ ws = null; wsKey = ""; } }; } catch(e){} }
async function poll(){ for (const s of syms()){ if (ws && ws.readyState === 1 && px[s]) continue; try { const r = await fetch("https://fapi.binance.com/fapi/v1/ticker/price?symbol=" + s); if (r.ok){ const j = await r.json(); const p = +j.price; if (p > 0){ px[s] = p; const e = ext[s] || (ext[s] = { hi: p, lo: p }); e.hi = Math.max(e.hi, p); e.lo = Math.min(e.lo, p); } } } catch(e){} } }
function tick(){ let changed = false; for (const s of Object.keys(ext)){ const e = ext[s], p = px[s]; delete ext[s]; if (!(p > 0)) continue; const r = P.mark(st, s, p, Date.now(), e.hi, e.lo);
    for (const x of r){ changed = true; try { NOTIFY.toast(`SİM: ${x.sym.replace("USDT", "")} ${x.side > 0 ? "LONG" : "SHORT"} kapandı (${x.why}) ${us(x.net)} USDT`, x.net >= 0 ? "good" : "bad"); } catch(e){} } }
  if (changed){ save(); stream(); } if (changed || Date.now() - lastPaint > 900) paint(); }
function html(){ return `<div class="ps-bal" id="ps-bal"></div>
  <div class="ps-row"><input id="ps-sym" placeholder="coin (BTC, SOL…)" autocomplete="off" autocapitalize="characters" spellcheck="false"><span id="ps-px" class="ps-px">—</span></div>
  <div class="seg ps-side"><button type="button" data-ps="1" class="on up">LONG</button><button type="button" data-ps="-1" class="dn">SHORT</button></div>
  <div class="ps-grid"><label>teminat USDT<input id="ps-m" inputmode="decimal" value="100"></label><label>kaldıraç<select id="ps-lev">${[1, 2, 3, 5, 10, 20, 25, 50, 75, 100, 125].map(x => `<option${x === 10 ? " selected" : ""}>${x}</option>`).join("")}</select></label>
    <label>stop<input id="ps-stop" inputmode="decimal" placeholder="isteğe bağlı"></label><label>hedef<input id="ps-tp" inputmode="decimal" placeholder="isteğe bağlı"></label></div>
  <div class="ps-btns"><button type="button" id="ps-fill" class="mini">SİNYALDEN DOLDUR</button><button type="button" id="ps-open" class="mini wide ps-go">SANAL AÇ</button></div>
  <div class="ps-info dim" id="ps-info"></div>
  <div class="sub-h">AÇIK POZİSYONLAR</div><div id="ps-pos" class="ps-pos"></div>
  <div class="ps-sum" id="ps-sum"></div>
  <details class="keys ps-h"><summary>📜 Geçmiş</summary><div id="ps-hist"></div></details>
  <div class="ps-tools"><input id="ps-add" inputmode="decimal" value="1000" aria-label="eklenecek sanal USDT"><button type="button" id="ps-addb" class="mini">+ BAKİYE</button><button type="button" id="ps-reset" class="mini">SIFIRLA</button></div>
  <div class="plan-foot">Kağıt işlem: <b>gerçek emir yok</b>, API anahtarı yok — yalnızca Binance'in herkese açık canlı fiyatı okunur. Ücret işlem başı %${(P.FEE*100).toFixed(2)} (giriş + çıkış), likidasyon tahmini (bakım %${(P.MMR*100).toFixed(1)}); stop/hedef son işlem fiyatıyla kontrol edilir. Sonuçlar gerçek işlemde kayma/fonlama yüzünden farklı olur.</div>`; }
function paint(){ const box = $("#psim-box"); if (!box || !box.firstChild) return; lastPaint = Date.now(); const sym = curSym(), p = px[sym];
  const eq = P.equity(st, px), upl = st.pos.reduce((s, q) => s + (px[q.sym] ? P.upnl(q, px[q.sym]) : 0), 0);
  $("#ps-bal").innerHTML = `<div><small>bakiye</small><b>${st.bal.toFixed(2)}</b></div><div><small>serbest</small><b>${P.free(st).toFixed(2)}</b></div><div><small>açık K/Z</small><b class="${upl >= 0 ? "up" : "dn"}">${us(upl)}</b></div><div><small>özsermaye</small><b>${eq.toFixed(2)}</b></div>`;
  $("#ps-px").textContent = p ? fp(p) : "—";
  const m = +$("#ps-m").value, lev = +$("#ps-lev").value; $("#ps-info").textContent = p && m > 0 ? `büyüklük ${(m*lev).toFixed(0)} USDT · ücret ~${(m*lev*P.FEE*2).toFixed(2)} · likidasyon ~${fp(P.liqPx(side, p, lev))}` : "";
  $("#ps-pos").innerHTML = st.pos.length ? st.pos.map(q => { const c = px[q.sym], u = c ? P.upnl(q, c) : 0; return `<div class="ps-p ${q.side > 0 ? "up" : "dn"}"><div><b>${esc(q.sym.replace("USDT", ""))} ${q.side > 0 ? "LONG" : "SHORT"} ${q.lev}x</b> <small>${fp(q.entry)} → ${c ? fp(c) : "—"}</small></div>
      <div class="ps-u ${u >= 0 ? "up" : "dn"}">${us(u)} <small>(%${(u/q.margin*100).toFixed(1)})</small></div><div class="ps-l dim">stop ${q.stop !== null ? fp(q.stop) : "—"} · hedef ${q.tp !== null ? fp(q.tp) : "—"} · liq ${fp(q.liq)}</div><button type="button" class="mini" data-psc="${q.id}">KAPAT</button></div>`; }).join("") : `<div class="empty">açık sanal pozisyon yok</div>`;
  const S = P.stats(st), pc = x => x === null ? "—" : "%" + Math.round(x*100);
  $("#ps-sum").innerHTML = `<span>${S.n} işlem</span><span>kazanma <b>${pc(S.winRate)}</b></span><span>toplam <b class="${S.total >= 0 ? "up" : "dn"}">${us(S.total)}</b></span><span>sinyal doğruluğu <b>${pc(S.sigAcc)}</b> <small>(${S.sigN})</small></span>`;
  const hb = $("#ps-hist"); if (hb && hb.closest("details").open) hb.innerHTML = st.hist.length ? st.hist.slice(0, 40).map(r => `<div class="ps-hr"><span>${new Date(r.t1).toLocaleString("tr-TR", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span><b>${esc(r.sym.replace("USDT", ""))} ${r.side > 0 ? "L" : "S"} ${r.lev}x</b><span>${fp(r.entry)}→${fp(r.exit)}</span><span>${esc(r.why)}</span><b class="${r.net >= 0 ? "up" : "dn"}">${us(r.net)}</b><small>${r.sig ? esc(r.sig.word) : "—"}</small></div>`).join("") : `<div class="empty">henüz işlem yok</div>`; }
function setSide(s){ side = s; document.querySelectorAll("[data-ps]").forEach(b => b.classList.toggle("on", +b.dataset.ps === s)); paint(); }
function fill(){ const sym = curSym(); if (!sym) return; const g = sigFor(sym); if (!g){ NOTIFY.toast("Bu coin için sinyal yok — önce ANALİZ/SİNYAL'de aç", "bad"); return; }
  if (g.d) setSide(g.d); const P2 = g.plan; $("#ps-stop").value = P2 && P2.stop ? +P2.stop : ""; $("#ps-tp").value = P2 && P2.tp ? +P2.tp : "";
  NOTIFY.toast(P2 ? `Sinyal: ${g.word} → yön, stop, hedef dolduruldu` : `Sinyal: ${g.word}${g.d ? " · yalnızca yön dolduruldu (plan yok)" : " · yön yok"}`, P2 ? "good" : "info"); }
function doOpen(){ const sym = curSym(), p = px[sym]; try { const g = sigFor(sym); const q = P.open(st, { sym, side, margin: $("#ps-m").value.replace(",", "."), lev: $("#ps-lev").value, px: p, stop: $("#ps-stop").value.replace(",", "."), tp: $("#ps-tp").value.replace(",", "."), sig: g ? { word: g.word, d: g.d, tf: g.tf } : null });
    ext[sym] = { hi: p, lo: p }; save(); stream(); paint(); NOTIFY.toast(`SİM: ${sym.replace("USDT", "")} ${q.side > 0 ? "LONG" : "SHORT"} ${q.lev}x @ ${fp(q.entry)} açıldı (sanal)`, "good"); } catch(e){ NOTIFY.toast("✖ " + e.message, "bad"); } }
function init(){ const box = $("#psim-box"); if (!box || box.dataset.on) return; box.dataset.on = "1"; box.innerHTML = html();
  sel = (window.SCALP && SCALP.S && SCALP.S.sym) || localStorage.getItem("neon.can.sym") || "BTCUSDT"; $("#ps-sym").value = sel.replace("USDT", "");
  $("#ps-sym").onchange = () => { sel = curSym(); stream(); poll(); paint(); };
  box.querySelector(".ps-side").onclick = e => { const b = e.target.closest("[data-ps]"); if (b) setSide(+b.dataset.ps); };
  $("#ps-m").oninput = $("#ps-lev").onchange = () => paint(); $("#ps-fill").onclick = fill; $("#ps-open").onclick = doOpen;
  $("#ps-pos").onclick = e => { const b = e.target.closest("[data-psc]"); if (!b) return; const q = st.pos.find(x => x.id === +b.dataset.psc); if (!q) return; const c = px[q.sym]; if (!c){ NOTIFY.toast("canlı fiyat yok", "bad"); return; }
    const r = P.close(st, q.id, c, "elle", Date.now()); save(); stream(); paint(); NOTIFY.toast(`SİM kapandı ${us(r.net)} USDT`, r.net >= 0 ? "good" : "bad"); };
  box.querySelector(".ps-h").ontoggle = () => paint();
  $("#ps-addb").onclick = () => { try { P.addBal(st, $("#ps-add").value.replace(",", ".")); save(); paint(); NOTIFY.toast("✔ sanal bakiye eklendi", "good"); } catch(e){ NOTIFY.toast("✖ " + e.message, "bad"); } };
  $("#ps-reset").onclick = async () => { const ok = window.CONN && CONN.typedConfirm ? await CONN.typedConfirm("SİMÜLATÖRÜ SIFIRLA", "Sanal bakiye <b>1000 USDT</b> olur; açık sanal pozisyonlar ve geçmiş silinir. Gerçek hesap etkilenmez.", "SIFIRLA") : confirm("Simülatör sıfırlansın mı?"); if (!ok) return; P.reset(st, 1000); save(); stream(); paint(); };
  stream(); poll(); paint(); setInterval(tick, 500); setInterval(stream, 2000); pollT = setInterval(poll, 3000); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
return { get st(){ return st; }, px, sigFor, paint, _save: save };
})();
