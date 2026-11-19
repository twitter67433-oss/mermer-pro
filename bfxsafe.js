/* MERMER TERMİNAL v7.40 — BFXSAFE: Binance USDⓈ-M order safety layer (pure, no DOM; every exchange call is injected → fully testable).
   • size(): risk sizing for auto AND manual quantity — the stop-loss incl. taker fees + slippage on both legs can never exceed max_loss_per_trade.
   • openProtected(): market entry → read executedQty / avgPrice (reconcile by newClientOrderId when the reply is lost — never resend) →
     stop (closePosition) → verify on the exchange (openAlgoOrders) → retry once → emergency reduce-only market close + critical alert → TP (failure = warning, SL kept).
   • gate(): Binance OTO limits — kill switch, cumulative daily loss, max open positions, cooldown after consecutive losses.
   Nothing here sends anything by itself; trade.js passes the real wsCall/signed functions after the user's ONAYLA. No keys are read or logged here. */
(function(root, f){ const M = f(); if (typeof module === "object" && module.exports) module.exports = M; else root.BFXSAFE = M; })(typeof self !== "undefined" ? self : this, function(){
"use strict";
const fin = x => typeof x === "number" && isFinite(x);
const DEF = { fee: 0.0005, slip: 0.0005, maxLev: 20 }; /* Binance USDⓈ-M taker 0.05 % (VIP0) per side; slippage assumption 0.05 % per side — both configurable, shown as assumptions */
const floorStep = (x, step, d) => { if (!(step > 0)) return x; const q = Math.floor(x/step + 1e-9)*step; return +q.toFixed(d ?? 8); };
const num = v => { if (typeof v === "number") return v; const s = String(v ?? "").trim().replace(",", "."); if (!s) return NaN; if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return NaN; return +s; };
/* o: { side: "long"|"short", px, st, tg, lev, manual (string|number|""), maxLoss, accountSize, capPct, avail (number|null), M: { step, qdec, minQty, maxQty, minNotional }, fee, slip, maxLev } */
function size(o){ const fee = fin(o.fee) ? o.fee : DEF.fee, slip = fin(o.slip) ? o.slip : DEF.slip, maxLev = o.maxLev || DEF.maxLev, M = o.M || {};
  const L = o.side === "long", px = +o.px, st = +o.st, tg = +o.tg, lev = +o.lev, issues = [];
  const out = { L, px, st, tg, lev, qty: 0, notional: 0, margin: 0, loss: 0, lossGross: 0, gain: 0, by: "", issues, ok: false, maxQty: 0, fee, slip };
  if (!(fin(px) && px > 0)) issues.push("fiyat geçersiz");
  if (!(fin(st) && st > 0)) issues.push("stop geçersiz (sayı ve > 0 olmalı)");
  if (!(fin(tg) && tg > 0)) issues.push("hedef geçersiz (sayı ve > 0 olmalı)");
  if (!(Number.isInteger(lev) && lev >= 1 && lev <= maxLev)) issues.push(`kaldıraç 1–${maxLev}x tam sayı olmalı`);
  if (!(fin(o.maxLoss) && o.maxLoss > 0)) issues.push("max zarar ayarı geçersiz");
  if (issues.length) return out;
  if (L ? !(st < px && tg > px) : !(st > px && tg < px)) issues.push(L ? "LONG için stop fiyatın altında, hedef üstünde olmalı" : "SHORT için stop fiyatın üstünde, hedef altında olmalı");
  const rpu = Math.abs(px - st); if (!(rpu > 0) || rpu/px < 1e-6) issues.push("stop mesafesi sıfır/çok küçük");
  if (issues.length) return out;
  /* worst-case loss per unit at the stop: price distance + entry fee + exit fee + slippage on entry and on the stop fill */
  const lossPU = rpu + px*(fee + slip) + st*(fee + slip), gainPU = Math.abs(tg - px) - px*fee - tg*fee;
  const riskQty = o.maxLoss/lossPU; let capN = fin(o.accountSize) && fin(o.capPct) ? o.accountSize*o.capPct/100*lev : Infinity, capBy = `pozisyon tavanı %${o.capPct} × ${lev}x`;
  if (fin(o.avail)){ const a = Math.max(0, o.avail)*lev*0.95; if (a < capN){ capN = a; capBy = "kullanılabilir bakiye × kaldıraç"; } }
  const capQty = capN/px; out.maxQty = Math.min(riskQty, capQty);
  let raw; const manStr = o.manual === undefined || o.manual === null ? "" : String(o.manual).trim();
  if (manStr){ const m = num(manStr); if (!(fin(m) && m > 0)){ issues.push("elle miktar geçersiz (pozitif sayı olmalı)"); return out; }
    raw = m; out.by = "elle girildi";
    if (m > riskQty*(1 + 1e-9)) issues.push(`elle miktar max zararı aşıyor: stopta ≈$${(m*lossPU).toFixed(2)} > $${o.maxLoss} (ücret+kayma dahil izin verilen en çok ${floorStep(riskQty, M.step, M.qdec)})`);
    if (m > capQty*(1 + 1e-9)) issues.push(`elle miktar ${capBy} sınırını aşıyor (en çok ${floorStep(capQty, M.step, M.qdec)})`); }
  else { raw = Math.min(riskQty, capQty); out.by = riskQty <= capQty ? `max zarar $${o.maxLoss} (ücret+kayma dahil)` : capBy; }
  const qty = floorStep(raw, M.step, M.qdec); out.qty = qty; out.notional = qty*px; out.margin = out.notional/lev; out.loss = qty*lossPU; out.lossGross = qty*rpu; out.gain = qty*gainPU;
  if (!(qty > 0)) issues.push("miktar sıfır (max zarar / bakiye çok küçük)");
  if (fin(M.minQty) && qty < M.minQty) issues.push(`miktar minimumun altında (min ${M.minQty})`);
  if (fin(M.minNotional) && out.notional < M.minNotional) issues.push(`tutar $${out.notional.toFixed(2)} < Binance minimumu $${M.minNotional} — max zarar sınırıyla çelişiyor, emir engellendi`);
  if (fin(M.maxQty) && M.maxQty > 0 && qty > M.maxQty) issues.push("miktar üst sınırı aşıyor");
  if (fin(o.avail) && out.margin + out.notional*fee > o.avail) issues.push("teminat yetersiz (teminat + giriş ücreti > kullanılabilir)");
  if (out.loss > o.maxLoss*(1 + 1e-6)) issues.push(`stopta zarar $${out.loss.toFixed(2)} > max $${o.maxLoss}`);
  out.ok = !issues.length; return out; }
/* ---- idempotency ---- */
const cid = (pre, t, r) => (pre || "mt") + (t || Date.now()).toString(36) + (r || Math.random().toString(36).slice(2, 8)); /* ≤ 36 chars, [.A-Z:/a-z0-9_-] */
/* a Binance error with its own code is a definitive answer (order NOT placed) — except "send status unknown" codes; no code (timeout, socket closed, network) = unknown */
const UNKNOWN_CODES = new Set([-1000, -1006, -1007]);
const definitive = e => !!e && typeof e.code === "number" && !UNKNOWN_CODES.has(e.code) && !(e.http >= 500);
const filled = o => o && (o.status === "FILLED" || o.status === "PARTIALLY_FILLED" || +o.executedQty > 0);
async function reconcile(api, symbol, clientId, tries = 4){ for (let i = 0; i < tries; i++){ try { const o = await api.query({ symbol, origClientOrderId: clientId }); if (o) return o; }
    catch(e){ if (e && (e.code === -2013 || /does not exist|Order does not exist/i.test(e.msg || e.message || ""))) return { status: "NOT_FOUND" }; }
    await api.sleep(800*(i + 1)); } return null; }
/* place one conditional (SL/TP) order and verify it is live on the exchange; never two of the same kind on the same side */
async function placeVerified(api, p, kind, trigger, tries){ const type = kind === "SL" ? "STOP_MARKET" : "TAKE_PROFIT_MARKET", side = p.L ? "SELL" : "BUY", ps = p.dual ? { positionSide: p.L ? "LONG" : "SHORT" } : {};
  const same = a => (a.orderType || a.type) === type && (!p.dual || (a.positionSide || "BOTH") === ps.positionSide) && a.symbol === p.symbol;
  let last = null;
  for (let k = 0; k < tries; k++){ const id = p.cid + (kind === "SL" ? "s" : "t") + k;
    try { const pre = await api.openAlgo(p.symbol).catch(() => null);
      for (const ex of (pre || []).filter(same)){ if (Math.abs(+ex.triggerPrice - +trigger) <= Math.abs(+trigger)*1e-9) return { ok: true, algoId: ex.algoId, verified: true, reused: true };
        /* an older SL/TP of the same kind at another price = orphan from a previous position → cancel it first (no duplicate protection orders) */
        try { await api.algoCancel({ symbol: p.symbol, algoId: ex.algoId }); api.log(`· eski ${kind} emri #${ex.algoId} iptal edildi (mükerrer olmasın)`); } catch(e){ api.log(`⚠ eski ${kind} #${ex.algoId} iptal edilemedi: ${api.err(e)}`, "dn"); } }
      const r = await api.algoPlace(Object.assign({ algoType: "CONDITIONAL", symbol: p.symbol, side, type, triggerPrice: trigger, closePosition: "true", workingType: "MARK_PRICE", clientAlgoId: id }, ps));
      let list = null; try { list = await api.openAlgo(p.symbol); } catch(e){}
      if (list === null) return { ok: true, algoId: r && r.algoId, verified: false, note: "borsa onayı var (algoId), liste sorgulanamadı" };
      if (list.some(a => (r && a.algoId === r.algoId) || a.clientAlgoId === id)) return { ok: true, algoId: r && r.algoId, verified: true };
      last = new Error(kind + " emri borsada görünmüyor"); }
    catch(e){ last = e; if (!definitive(e)){ const list = await api.openAlgo(p.symbol).catch(() => null); const f = list && list.find(a => a.clientAlgoId === id || same(a)); if (f) return { ok: true, algoId: f.algoId, verified: true, note: "yanıt kayboldu, borsada bulundu" }; } }
    if (k < tries - 1){ api.log(`⚠ ${kind} kurulamadı (${api.err(last)}) — 1 kez daha deneniyor`, "dn"); await api.sleep(600); } }
  return { ok: false, err: last }; }
/* p: { symbol, L, qty (string), stPx, tgPx (strings, tick-rounded), dual, attach, cid } · api: { place, query, algoPlace, openAlgo, positions, sleep, log, critical, err } */
async function openProtected(api, p){ const side = p.L ? "BUY" : "SELL", ps = p.dual ? { positionSide: p.L ? "LONG" : "SHORT" } : {}, res = { cid: p.cid, symbol: p.symbol, state: "?", exec: 0, avg: null, partial: false, sl: null, tp: null };
  let o = null;
  try { o = await api.place(Object.assign({ symbol: p.symbol, side, type: "MARKET", quantity: p.qty, newOrderRespType: "RESULT", newClientOrderId: p.cid }, ps)); }
  catch(e){ if (definitive(e)){ res.state = "REDDEDİLDİ"; res.err = e; return res; }
    api.log("⚠ emir yanıtı alınamadı — durum borsadan sorgulanıyor (yeniden GÖNDERİLMEZ)", "dn"); o = await reconcile(api, p.symbol, p.cid);
    if (!o){ res.state = "BELİRSİZ"; res.err = e; api.critical(`${p.symbol}: emir durumu BELİRSİZ — Binance'te kontrol et; yeni emir gönderilmedi`); return res; }
    if (o.status === "NOT_FOUND"){ res.state = "GÖNDERİLMEDİ"; res.err = e; return res; } }
  for (let i = 0; o && !filled(o) && (o.status === "NEW" || !o.status) && i < 5; i++){ await api.sleep(400); try { o = (await api.query({ symbol: p.symbol, origClientOrderId: p.cid })) || o; } catch(e){} }
  res.exec = +o.executedQty || 0; res.avg = +o.avgPrice || null; res.orderId = o.orderId; res.status = o.status;
  if (!(res.exec > 0)){ res.state = o.status === "NEW" ? "BELİRSİZ" : "DOLMADI"; if (res.state === "BELİRSİZ") api.critical(`${p.symbol}: piyasa emri dolmadı/bekliyor — Binance'te kontrol et`); return res; }
  res.partial = res.exec < +p.qty - 1e-12;
  if (!p.attach){ res.state = "AÇIK · STOPSUZ (kullanıcı seçimi)"; return res; }
  res.sl = await placeVerified(api, p, "SL", p.stPx, 2);
  if (!res.sl.ok){ api.critical(`${p.symbol}: STOP KURULAMADI (${api.err(res.sl.err)}) — pozisyon ACİL kapatılıyor`);
    const close = Object.assign({ symbol: p.symbol, side: p.L ? "SELL" : "BUY", type: "MARKET", quantity: String(o.executedQty), newOrderRespType: "RESULT", newClientOrderId: p.cid + "x" }, p.dual ? ps : { reduceOnly: "true" });
    let closed = false; try { await api.place(close); closed = true; } catch(e){ if (!definitive(e)){ const q = await reconcile(api, p.symbol, p.cid + "x"); closed = !!(q && filled(q)); } }
    let left = null; try { left = (await api.positions(p.symbol)).filter(x => !p.dual || (x.positionSide || "BOTH") === ps.positionSide).reduce((s, x) => s + Math.abs(+x.positionAmt || 0), 0); } catch(e){}
    res.state = closed && left === 0 ? "ACİL KAPATILDI (stop kurulamadı)" : "KORUMASIZ — ELLE KAPAT"; api.critical(`${p.symbol}: ${res.state}${left ? ` · açık miktar ${left}` : ""}`); return res; }
  res.tp = await placeVerified(api, p, "TP", p.tgPx, 1);
  if (!res.tp.ok) api.log(`⚠ ${p.symbol}: hedef (TP) kurulamadı (${api.err(res.tp.err)}) — STOP yerinde, hedefi elle kur`, "dn");
  res.state = res.tp.ok ? "AÇIK · STOP+HEDEF KURULU" : "AÇIK · STOP KURULU, HEDEF YOK"; return res; }
/* Binance OTO gate. j = journal entries of venue binance mode OTO; o: { now, day0, dailyLossLimit, maxOpen, maxDay, lossStreak, coolMin, halted } */
function gate(j, o){ const today = j.filter(e => e.openT >= o.day0), closed = j.filter(e => !e.open && Number.isFinite(e.out) && Number.isFinite(e.in)).sort((a, b) => (a.closeT || 0) - (b.closeT || 0));
  if (o.halted) return { ok: false, why: "HEPSİNİ DURDUR / OTO kapalı" };
  const dayPnl = closed.filter(e => (e.closeT || 0) >= o.day0).reduce((s, e) => s + (e.out - e.in), 0);
  if (fin(o.dailyLossLimit) && dayPnl <= -o.dailyLossLimit) return { ok: false, stop: true, why: `günlük zarar limiti doldu (${dayPnl.toFixed(2)} ≤ −${o.dailyLossLimit} USDT)` };
  const open = j.filter(e => e.open).length; if (fin(o.maxOpen) && open >= o.maxOpen) return { ok: false, why: `açık oto pozisyon sınırı (${open}/${o.maxOpen})` };
  if (fin(o.maxDay) && today.length >= o.maxDay) return { ok: false, why: `günlük oto işlem sınırı (${o.maxDay}) doldu` };
  let streak = 0, lastT = 0; for (let i = closed.length - 1; i >= 0; i--){ if (closed[i].out - closed[i].in < 0){ streak++; lastT = Math.max(lastT, closed[i].closeT || 0); } else break; }
  if (fin(o.lossStreak) && streak >= o.lossStreak && o.now - lastT < (o.coolMin || 60)*60000) return { ok: false, why: `${streak} ardışık zarar → ${Math.ceil(((o.coolMin || 60)*60000 - (o.now - lastT))/60000)} dk bekleme` };
  return { ok: true, dayPnl, open, streak }; }
return { DEF, size, num, floorStep, cid, definitive, reconcile, placeVerified, openProtected, gate };
});
