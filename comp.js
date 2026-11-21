/* MERMER TERMİNAL v8.2 — BİLEŞİK OTO (SİM / TEST ONLY). A compounding paper-trading mode: it opens SIMULATED trades on the AKSİYON "GİR" signals,
   books a fixed net-$ profit, grows the stake with the balance and stops for the day at a target / loss limit.
   HARD BOUNDARIES: virtual balance in its own localStorage key (mermer.comp); it uses only PSIM (paper core) + AKSİYON verdicts; it never touches the GERÇEK tab,
   trade.js, auto.js, exec.js, API keys, wallets or any order endpoint. Nothing is sent anywhere except public price reads. Not a proven edge ("kanıtlanmadı"):
   a small fixed take-profit against a stop that is several times larger needs a very high win rate — see docs/BACKTEST_REPORT.md (v8.2.0) for the measured result. */
"use strict";
(function (root, factory){ const M = factory(typeof module === "object" && module.exports ? require("./psim.js") : root.PSIM, typeof module === "object" && module.exports ? require("./aksiyon.js") : root.AKSIYONX);
  if (typeof module === "object" && module.exports) module.exports = M; else root.COMPX = M; })(typeof self !== "undefined" ? self : this, function (P, AX){
const FEE = P.FEE, MMR = P.MMR, fin = x => typeof x === "number" && isFinite(x), clamp = (v, a, b, d) => { v = +v; return fin(v) ? Math.min(b, Math.max(a, v)) : d; };
/* defaults = the owner's brief: 1000 $ vault, max 2 positions, 5 % of the balance as margin (50 $ at 1000 → 60/70/80 as it grows), cross margin, +7 $ net take-profit, 2000 $ daily target */
const DEF = { on: true, start: 1000, maxPos: 2, stakePct: 5, minStake: 5, lev: 20, tp: 7, trail: false, give: 3, target: 2000, lossPct: 10, pauseLosses: 2, pauseMin: 60, tmax: 60*60000, stocks: false };
function cfgOf(o){ o = o || {}; return { on: o.on !== false, start: clamp(o.start, 10, 1e7, DEF.start), maxPos: Math.round(clamp(o.maxPos, 1, 5, DEF.maxPos)), stakePct: clamp(o.stakePct, 0.5, 25, DEF.stakePct),
  minStake: clamp(o.minStake, 1, 1e5, DEF.minStake), lev: Math.round(clamp(o.lev, 1, 50, DEF.lev)), tp: clamp(o.tp, 0.5, 1000, DEF.tp), trail: o.trail === true, give: clamp(o.give, 0.25, 500, DEF.give),
  target: clamp(o.target, 11, 1e9, DEF.target), lossPct: clamp(o.lossPct, 1, 90, DEF.lossPct), pauseLosses: Math.round(clamp(o.pauseLosses, 1, 10, DEF.pauseLosses)), pauseMin: clamp(o.pauseMin, 1, 1440, DEF.pauseMin),
  tmax: clamp(o.tmax, 60000, 6*3600000, DEF.tmax), stocks: o.stocks === true }; }
const berlin = t => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
const create = cfg => { cfg = cfgOf(cfg); return { v: 1, cfg, acct: P.create(cfg.start), day: null, streak: 0, lastLossT: 0, halted: false, seen: [], last: {}, tot: { n: 0, w: 0, pnl: 0, liq: 0 } }; };
/* new Berlin day → fresh counters, the day's starting balance is the realized balance */
function roll(S, t){ const k = berlin(t); if (!S.day || S.day.key !== k) S.day = { key: k, start: S.acct.bal, n: 0, w: 0, pnl: 0, stop: null }; return S.day; }
/* daily target: absolute cfg.target; when the day already starts at/above it (several good days), the target is a doubling of the day's start */
const targetOf = S => S.cfg.target > S.day.start*1.0001 ? S.cfg.target : S.day.start*2;
/* stake = balance × stakePct (compounds up after wins, shrinks after losses), never more than the free margin can carry (margin + entry fee) */
function stake(S){ const c = S.cfg, a = S.acct, cap = P.free(a)/(1 + c.lev*FEE) - 1e-6; let s = Math.floor(a.bal*c.stakePct)/100; s = Math.min(s, cap); return s >= c.minStake ? Math.floor(s*100)/100 : 0; }
/* trigger price at which a market take-profit nets ≈ X $ AFTER entry fee, exit fee and exit slippage/spread */
function tpPx(side, entry, qty, X, feeIn){ const C = P.COST, a = C.slip + C.lat + C.spread/2;
  const fill = side > 0 ? (X + feeIn + qty*entry)/(qty*(1 - FEE)) : (qty*entry - X - feeIn)/(qty*(1 + FEE)); return fill/(1 - side*a); }
const validStop = (side, px, stop) => fin(stop) && stop > 0 && fin(px) && px > 0 && (stop - px)*side < 0;
/* may a new trade open now? (the OTO-style gate: kill switch, daily limits, pause after N losses, max positions, one per coin) */
function check(S, sig, v, t){ const c = S.cfg, d = roll(S, t), a = S.acct;
  if (!c.on) return { ok: false, perm: false, why: "kapalı" }; if (S.halted) return { ok: false, perm: false, why: "DURDURULDU (kill switch)" };
  if (!v || v.st !== "GIR") return { ok: false, perm: false, why: "rozet GİR değil" };
  if (!validStop(sig.side, sig.entry, sig.stop)) return { ok: false, perm: true, why: "stop yok/geçersiz — stopsuz işlem açılmaz" };
  if (d.stop) return { ok: false, perm: false, why: d.stop === "hedef" ? "günlük hedef doldu" : "günlük zarar limiti doldu" };
  if (S.streak >= c.pauseLosses && t - S.lastLossT < c.pauseMin*60000) return { ok: false, perm: false, why: `${S.streak} ardışık zarar → bekleme` };
  if (a.pos.length >= c.maxPos) return { ok: false, perm: false, why: `maks. ${c.maxPos} pozisyon dolu` };
  if (a.pos.some(p => p.sym === sig.sym)) return { ok: false, perm: false, why: "bu coinde açık pozisyon var" };
  const m = stake(S); if (!(m > 0)) return { ok: false, perm: false, why: "marj yetmiyor" };
  return { ok: true, margin: m }; }
function enter(S, sig, px, t, o){ o = o || {}; const g = check(S, sig, o.v, t); /* the caller must hand in the real AKSİYON verdict — there is no default */ if (!g.ok) return g; const c = S.cfg, side = sig.side < 0 ? -1 : 1;
  let p; try { p = P.open(S.acct, { sym: sig.sym, side, margin: g.margin, lev: c.lev, px, stop: sig.stop, t, tmax: c.tmax, cross: true, rule: "comp:" + sig.k, book: o.book,
      sig: { word: "GİR " + (side > 0 ? "LONG" : "SHORT"), d: side, k: sig.k, side, entry: sig.entry, stop: sig.stop, close: sig.close || t } }); }
  catch(e){ return { ok: false, perm: true, why: e.message }; }
  p.tp = tpPx(side, p.entry, p.qty, c.tp, p.feeIn); p.armed = false; S.last[sig.sym] = px; return { ok: true, pos: p, margin: g.margin }; }
function after(S, r, t){ const d = roll(S, t), c = S.cfg; d.n++; if (r.net > 0) d.w++; d.pnl += r.net; S.tot.n++; if (r.net > 0) S.tot.w++; S.tot.pnl += r.net;
  if (r.net < 0){ S.streak++; S.lastLossT = t; } else S.streak = 0;
  if (!d.stop && S.acct.bal >= targetOf(S)) d.stop = "hedef"; if (!d.stop && d.pnl <= -d.start*c.lossPct/100) d.stop = "zarar"; return r; }
/* ---- cross-margin account check: equity (wallet + all open PnL) ≤ total maintenance margin → EVERYTHING is liquidated, the wallet is gone (minus what the maintenance margin leaves) ---- */
function crossEq(S, pxOf){ let eq = S.acct.bal, mm = 0; for (const p of S.acct.pos){ const x = pxOf(p); eq += P.upnl(p, x); mm += p.qty*x*MMR; } return { eq, mm }; }
function liqAll(S, pxOf, t, eq, mm){ const a = S.acct, out = []; for (const p of a.pos.slice()){ const x = pxOf(p), net = P.upnl(p, x) - p.feeIn;
    const r = { id: p.id, sym: p.sym, side: p.side, lev: p.lev, margin: p.margin, entry: p.entry, exit: x, trig: x, slip: p.slipIn || 0, filled: p.filled ?? 1, why: "likidasyon", net, roe: net/p.margin, fee: p.feeIn, t0: p.t, t1: t, sig: p.sig, rule: p.rule || null };
    a.hist.unshift(r); out.push(r); }
  a.pos = []; a.bal = Math.max(0, eq - mm); S.tot.liq++; for (const r of out) after(S, r, t); return out; }
/* one price update for a coin. bar = { o, h, l, c } (a live tick is o = h = l = c). Stop-first; a bar that OPENS beyond the stop fills at the open (gap), never at the stop. */
function stepSym(S, sym, bar, t){ const c = S.cfg, out = [], cl = bar.c, o = fin(bar.o) ? bar.o : cl, h = Math.max(fin(bar.h) ? bar.h : cl, cl, o), l = Math.min(fin(bar.l) ? bar.l : cl, cl, o); roll(S, t);
  for (const p of S.acct.pos.slice()){ if (p.sym !== sym) continue; const s = p.side, adv = s > 0 ? l : h, fav = s > 0 ? h : l;
    if (p.stop !== null && (o - p.stop)*s <= 0){ out.push(after(S, P.close(S.acct, p.id, o, "stop", t), t)); continue; }
    if (p.stop !== null && (adv - p.stop)*s <= 0){ out.push(after(S, P.close(S.acct, p.id, p.stop, "stop", t), t)); continue; }
    if (p.tp !== null && !p.armed && (fav - p.tp)*s >= 0){ const trig = s > 0 ? Math.max(p.tp, o) : Math.min(p.tp, o);
      if (!c.trail){ out.push(after(S, P.close(S.acct, p.id, trig, "hedef", t), t)); continue; }
      p.armed = true; p.best = fav; }
    if (p.armed){ p.best = s > 0 ? Math.max(p.best, fav) : Math.min(p.best, fav); const ns = p.best - s*c.give/p.qty; if ((ns - p.stop)*s > 0) p.stop = ns; }
    if (c.tmax > 0 && t - p.t >= c.tmax){ out.push(after(S, P.close(S.acct, p.id, cl, "süre", t), t)); continue; } }
  S.last[sym] = cl;
  if (S.acct.pos.length){ const pxOf = p => p.sym === sym ? (p.side > 0 ? l : h) : (S.last[p.sym] ?? p.entry), q = crossEq(S, pxOf); if (q.eq <= q.mm) out.push(...liqAll(S, pxOf, t, q.eq, q.mm)); }
  return out; }
/* ÇIK badge (target 2R, 60 min, opposite signal; STOP is the protective stop) closes at the live price */
function sigExit(S, p, px, t, opposite){ if (!p.sig || !fin(px)) return null; const v = AX.verdict({ side: p.side, entry: p.sig.entry, stop: p.sig.stop, close: p.sig.close }, px, t, { opposite: !!opposite });
  if (v.st !== "CIK") return null; return after(S, P.close(S.acct, p.id, px, "ÇIK · " + (v.sub || v.why), t), t); }
/* daily loss limit: wallet + open PnL below the day's start by lossPct → flatten at the last prices and stop for the day */
function guard(S, t){ const d = roll(S, t), a = S.acct, out = []; if (!a.pos.length) return out;
  const eq = a.bal + a.pos.reduce((s, p) => s + P.upnl(p, S.last[p.sym] ?? p.entry) - p.qty*(S.last[p.sym] ?? p.entry)*FEE, 0);
  if (!d.stop && eq - d.start <= -d.start*S.cfg.lossPct/100) d.stop = "zarar";
  if (d.stop === "zarar") for (const p of a.pos.slice()) out.push(after(S, P.close(a, p.id, S.last[p.sym] ?? p.entry, "günlük zarar", t), t)); return out; }
function killAll(S, t){ S.cfg.on = false; S.halted = true; const out = []; for (const p of S.acct.pos.slice()) out.push(after(S, P.close(S.acct, p.id, S.last[p.sym] ?? p.entry, "durdur", t), t)); return out; }
/* cross liquidation price of one position (others held at their last price): equity = maintenance → solve for this coin's price */
function liqInfo(S, p, px){ const s = p.side; let W = S.acct.bal; for (const q of S.acct.pos){ if (q === p) continue; const x = S.last[q.sym] ?? q.entry; W += P.upnl(q, x) - q.qty*x*MMR; }
  const x = (p.qty*s*p.entry - W)/(p.qty*(s - MMR)); return { px: x, dist: fin(px) && px > 0 ? Math.abs(x - px)/px : NaN, isolated: P.liqPx(s, p.entry, p.lev) }; }
const net = (p, px) => P.upnl(p, px) - p.qty*px*FEE - p.feeIn;
function status(S, t){ const d = roll(S, t || Date.now()), a = S.acct; let eq = a.bal; for (const p of a.pos){ const x = S.last[p.sym] ?? p.entry; eq += P.upnl(p, x) - p.qty*x*FEE; }
  const tg = targetOf(S); return { bal: a.bal, eq, day: d, target: tg, prog: Math.max(0, Math.min(1, (a.bal - d.start)/Math.max(1e-9, tg - d.start))), wr: d.n ? d.w/d.n : null, wrAll: S.tot.n ? S.tot.w/S.tot.n : null, stake: stake(S), open: a.pos.length,
    state: !S.cfg.on ? (S.halted ? "DURDURULDU" : "KAPALI") : d.stop === "hedef" ? "HEDEF DOLDU" : d.stop === "zarar" ? "ZARAR LİMİTİ" : (S.streak >= S.cfg.pauseLosses && (t || Date.now()) - S.lastLossT < S.cfg.pauseMin*60000) ? "BEKLEME" : "AÇIK" }; }
return { DEF, cfgOf, create, roll, berlin, stake, tpPx, validStop, check, enter, stepSym, sigExit, guard, killAll, liqInfo, status, targetOf, net, after, crossEq };
});

/* ------------------------------ UI (browser only) ------------------------------ */
if (typeof window !== "undefined" && typeof document !== "undefined") window.COMP = (() => {
const X = window.COMPX, K = "mermer.comp", $$ = s => [...document.querySelectorAll(s)], esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let S = (() => { try { const s = JSON.parse(localStorage.getItem(K) || "null"); if (s && s.v === 1 && s.acct && isFinite(s.acct.bal) && Array.isArray(s.acct.pos) && Array.isArray(s.acct.hist)) { s.cfg = X.cfgOf(s.cfg); s.seen = Array.isArray(s.seen) ? s.seen : []; s.last = s.last && typeof s.last === "object" ? s.last : {}; s.tot = s.tot || { n: 0, w: 0, pnl: 0, liq: 0 }; return s; } } catch(e){} return X.create(); })();
const save = () => { try { localStorage.setItem(K, JSON.stringify(S)); } catch(e){} };
const px = {}; let pxT = 0, busy = false, note = "";
const $f = v => !isFinite(v) ? "—" : "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), sg = v => (v >= 0 ? "+" : "−") + "$" + Math.abs(v).toFixed(2);
const fp = v => !isFinite(v) ? "—" : v >= 1000 ? v.toFixed(1) : v >= 10 ? v.toFixed(2) : v >= 1 ? v.toFixed(3) : v >= 0.01 ? v.toFixed(5) : v.toPrecision(4);
const toast = (m, k) => { try { window.NOTIFY && NOTIFY.toast(m, k || "info"); } catch(e){} };
async function poll(){ try { const r = await fetch("https://fapi.binance.com/fapi/v1/ticker/price"), a = await r.json(); if (!Array.isArray(a)) return; for (const x of a){ const p = +x.price; if (x.symbol && p > 0){ px[x.symbol] = p; try { window.AKSIYON && (AKSIYON.px[x.symbol] = p); } catch(e){} } } pxT = Date.now(); } catch(e){} }
function tell(rs){ for (const r of rs) toast(`SİM BİLEŞİK ${r.sym.replace("USDT", "")} ${r.side > 0 ? "LONG" : "SHORT"} kapandı ${sg(r.net)} · ${r.why}`, r.net >= 0 ? "good" : "bad"); }
async function step(){ if (busy) return; busy = true; try { const now = Date.now(); X.roll(S, now); const open = S.cfg.on || S.acct.pos.length; if (!open){ paint(); return; }
    if (now - pxT > 2500) await poll(); const fresh = Date.now() - pxT < 20000;
    if (fresh){ for (const sym of [...new Set(S.acct.pos.map(p => p.sym))]) if (px[sym] > 0) tell(X.stepSym(S, sym, { o: px[sym], h: px[sym], l: px[sym], c: px[sym] }, now));
      for (const p of S.acct.pos.slice()){ const opp = window.SERTS && SERTS.opp ? SERTS.opp(p.sym, p.side) : false; const r = px[p.sym] > 0 ? X.sigExit(S, p, px[p.sym], now, opp) : null; if (r) tell([r]); }
      tell(X.guard(S, now));
      if (S.cfg.on && window.SERTS && SERTS.all){ const L = SERTS.all(S.cfg.stocks).sort((a, b) => (b.vr || 0) - (a.vr || 0));
        for (const r of L){ const v = r._ax; if (!v || v.st !== "GIR") continue; const id = r.k + "|" + r.sym + "|" + (r.close || r.t); if (S.seen.includes(id)) continue; const p0 = px[r.sym]; if (!(p0 > 0)) continue;
          const g = X.enter(S, r, p0, now, { v }); if (g.ok){ S.seen.push(id); toast(`SİM BİLEŞİK ${r.sym.replace("USDT", "")} ${r.side > 0 ? "LONG" : "SHORT"} açıldı · marj $${g.margin.toFixed(2)} × ${S.cfg.lev} · stop ${fp(r.stop)} · hedef +$${S.cfg.tp} net`, "info"); }
          else { note = g.why; if (g.perm) S.seen.push(id); } }
        if (S.seen.length > 300) S.seen = S.seen.slice(-200); } }
    save(); paint(); } catch(e){ note = "hata: " + e.message; } finally { busy = false; } }
function openHtml(){ const a = S.acct; if (!a.pos.length) return `<div class="cp-e dim">açık pozisyon yok</div>`;
  return a.pos.map(p => { const x = px[p.sym] || S.last[p.sym] || p.entry, n = X.net(p, x), L = X.liqInfo(S, p, x), sl = p.stop !== null ? p.side*(p.entry - p.stop)*p.qty + p.feeIn : NaN;
    return `<div class="cp-pos"><b>${esc(p.sym.replace("USDT", ""))}</b> <span class="${p.side > 0 ? "up" : "dn"}">${p.side > 0 ? "LONG" : "SHORT"}</span> <small>${p.lev}× · marj $${p.margin.toFixed(2)} · giriş ${fp(p.entry)}</small> <span class="${n >= 0 ? "up" : "dn"}">${sg(n)}</span>
      <small class="dim">stop ${fp(p.stop)} (≈ −$${isFinite(sl) ? sl.toFixed(2) : "—"}) · hedef ${p.armed ? "iz-süren" : "+$" + S.cfg.tp + " net"} · likidasyon ≈ ${fp(L.px)} (%${isFinite(L.dist) ? (L.dist*100).toFixed(0) : "—"} uzakta, cross)</small></div>`; }).join(""); }
function hist5(){ const H = S.acct.hist.slice(0, 5); return H.length ? H.map(r => `<span class="${r.net >= 0 ? "up" : "dn"}" title="${esc(r.why)}">${esc(r.sym.replace("USDT", ""))} ${sg(r.net)}</span>`).join(" · ") : "—"; }
const FIELDS = [["start", "başlangıç kasa $", "1"], ["maxPos", "maks. pozisyon", "1"], ["stakePct", "marj % (kasa)", "0.5"], ["lev", "kaldıraç ×", "1"], ["tp", "hedef $ (net)", "0.5"], ["give", "iz geri verme $", "0.25"], ["target", "günlük hedef $", "10"], ["lossPct", "günlük zarar %", "1"]];
function html(){ const st = X.status(S, Date.now()), c = S.cfg, d = st.day, cls = st.state === "AÇIK" ? "on" : /HEDEF/.test(st.state) ? "tp" : st.state === "KAPALI" ? "" : "warn";
  return `<details class="cp-d"${S.cfg.on || S.acct.pos.length ? " open" : ""}><summary><b>🧪 BİLEŞİK OTO</b> <small>SİM · gerçek emir yok</small> <span class="cp-st ${cls}">${st.state}</span> <span class="cp-sum">kasa ${$f(st.bal)} · bugün <b class="${d.pnl >= 0 ? "up" : "dn"}">${sg(d.pnl)}</b></span></summary>
  <div class="cp-b"><div class="cp-grid"><div><small>KASA</small><b>${$f(st.bal)}</b></div><div><small>BUGÜN</small><b class="${d.pnl >= 0 ? "up" : "dn"}">${sg(d.pnl)}</b></div><div><small>İŞLEM</small><b>${d.n}</b></div><div><small>KAZANMA</small><b>${st.wr === null ? "—" : "%" + Math.round(st.wr*100)}</b></div><div><small>AÇIK</small><b>${st.open}/${c.maxPos}</b></div><div><small>SONRAKİ MARJ</small><b>${st.stake ? "$" + st.stake.toFixed(2) : "—"}</b></div></div>
  <div class="cp-prog" title="gün başı ${$f(d.start)} → hedef ${$f(st.target)}"><i style="width:${(st.prog*100).toFixed(1)}%"></i></div><div class="cp-pl dim">${$f(st.bal)} → ${$f(st.target)} · %${(st.prog*100).toFixed(1)}${c.stocks ? " · hisse dahil" : " · yalnız kripto"}</div>
  <div class="cp-act"><button type="button" class="mini ${c.on ? "on" : ""}" data-cp="toggle">${c.on ? "■ DURDUR" : "▶ BAŞLAT (SİM, otomatik)"}</button><button type="button" class="mini" data-cp="kill" title="Açık sanal pozisyonları kapat ve kapat">HEPSİNİ DURDUR</button><button type="button" class="mini" data-cp="reset">SIFIRLA</button></div>
  <div class="cp-open">${openHtml()}</div><div class="cp-h dim">son: ${hist5()}</div>${note ? `<div class="cp-n dim">${esc(note)}</div>` : ""}
  <details class="cp-set"><summary>ayarlar</summary><div class="cp-f">${FIELDS.map(([k, n, s]) => `<label>${n}<input type="number" step="${s}" data-cpf="${k}" value="${c[k]}"></label>`).join("")}
  <label class="cp-ck"><input type="checkbox" data-cpf="trail"${c.trail ? " checked" : ""}> iz-süren çıkış (+$${c.tp} sonrası ${c.give}$ geri verince)</label><label class="cp-ck"><input type="checkbox" data-cpf="stocks"${c.stocks ? " checked" : ""}> hisse/emtia dahil</label></div>
  <small class="dim">Marj $${(c.start*c.stakePct/100).toFixed(0)} × ${c.lev} = pozisyon $${(c.start*c.stakePct/100*c.lev).toFixed(0)} (başlangıçta). Başlangıç kasa yalnız SIFIRLA ile uygulanır. Cross: her pozisyon aynı kasayı paylaşır; her işlemde stop zorunlu; ${c.pauseLosses} ardışık zarar → ${c.pauseMin} dk bekleme.</small></details>
  <small class="cp-w dim">YALNIZ SİM/TEST — gerçek emir, anahtar, cüzdan yok; GERÇEK sekmesi etkilenmez. Kanıtlanmadı — ÖLÇÜLDÜ: 29 günlük gerçek-veri replay'inde (519 coin, 15dk) 2000 $'a ulaşan gün 0/29, gün sonu medyanı 897 $ (başlangıç 1000 $); kâr almak için %64 kazanma gerekirdi, ölçülen %49. Ayrıntı: docs/BACKTEST_REPORT.md (v8.2.0). Fiyatlar 3 sn'de bir okunur.</small></div></details>`; }
function paint(){ const els = $$(".cp"); if (!els.length) return; const open = els.map(e => { const d = e.querySelector(".cp-d"), s = e.querySelector(".cp-set"); return [d && d.open, s && s.open]; });
  if (document.activeElement && document.activeElement.closest && document.activeElement.closest(".cp") && document.activeElement.tagName === "INPUT") return; /* never repaint while typing */
  const h = html(); els.forEach((e, i) => { e.innerHTML = h; const d = e.querySelector(".cp-d"), s = e.querySelector(".cp-set"); if (d && open[i][0] !== undefined && open[i][0] !== null && e.dataset.init) d.open = open[i][0]; if (s && open[i][1]) s.open = true; e.dataset.init = "1"; }); }
function setCfg(o){ const c = S.cfg, keep = { on: c.on }; S.cfg = X.cfgOf(Object.assign({}, c, o, keep)); S.cfg.on = keep.on; save(); }
function click(e){ const b = e.target.closest("[data-cp]"); if (!b) return; const a = b.dataset.cp, now = Date.now();
  if (a === "toggle"){ if (S.cfg.on){ S.cfg.on = false; note = "durduruldu — açık pozisyonlar stop/hedefte yönetilir"; } else { S.cfg.on = true; S.halted = false; note = ""; poll(); } save(); paint(); step(); }
  else if (a === "kill"){ tell(X.killAll(S, now)); note = "HEPSİ DURDURULDU (kill switch)"; save(); paint(); }
  else if (a === "reset"){ const go = () => { const c = S.cfg; S = X.create(Object.assign({}, c, { on: true })); note = "sıfırlandı"; save(); paint(); };
    if (window.CONN && CONN.typedConfirm) CONN.typedConfirm("BİLEŞİK OTO SIFIRLA", `Sanal kasa <b>${S.cfg.start} $</b> olur; sanal pozisyonlar ve geçmiş silinir. Gerçek hesap etkilenmez.`, "SIFIRLA").then(ok => ok && go()); else if (confirm("Bileşik SİM sıfırlansın mı?")) go(); } }
function change(e){ const i = e.target.closest("[data-cpf]"); if (!i) return; const k = i.dataset.cpf; setCfg({ [k]: i.type === "checkbox" ? i.checked : i.value }); note = "ayar kaydedildi"; paint(); }
function init(){ document.addEventListener("click", ev => { if (ev.target.closest(".cp")) click(ev); }); document.addEventListener("change", ev => { if (ev.target.closest(".cp")) change(ev); });
  setInterval(step, 3000); setInterval(paint, 4000); setTimeout(paint, 1500); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
return { get S(){ return S; }, has: sym => S.acct.pos.some(p => p.sym === sym), step, paint, setCfg, _px: px };
})();
