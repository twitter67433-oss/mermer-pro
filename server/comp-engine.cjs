/* MERMER TERMİNAL v8.2.1 — SUNUCU · BİLEŞİK OTO (SİM / TEST ONLY), headless Node port of the phone's BİLEŞİK OTO.
   It re-uses the app's OWN engine files unchanged: sert.js (SERTX: feat / evalAll / universe / order), aksiyon.js (AKSIYONX.verdict → GİR / ÇIK),
   psim.js (PSIM: fills, fees, slippage, cross), comp.js (COMPX: stake, +net-$ TP, caps, daily stops, liquidation), squeeze.js (SQZ).
   The scan / GİR / ÇIK / entry logic mirrors sert.js (browser part, scan/one/act/axOf/oppLive) and comp.js (browser part, step) line by line.
   HARD BOUNDARIES: virtual balance only. PUBLIC Binance USD-M market data only (GET, no key, no signature, no account / order endpoint, no wallet).
   No API key exists on this server. tests/compserver.test.js scans this file + comp-server.mjs and records every request to prove it. */
"use strict";
const path = require("path"), fs = require("fs"), ROOT = path.resolve(__dirname, "..");
const X = require(path.join(ROOT, "sert.js")), P = require(path.join(ROOT, "psim.js")), AX = require(path.join(ROOT, "aksiyon.js")), C = require(path.join(ROOT, "comp.js")), SQ = require(path.join(ROOT, "squeeze.js"));
const fin = x => typeof x === "number" && isFinite(x);
const BASE = "https://fapi.binance.com";
/* the ONLY endpoints this server may call (all public GET market data) — enforced at runtime by pubGet() and by the test */
const ALLOWED = [/^\/fapi\/v1\/ticker\/price$/, /^\/fapi\/v1\/ticker\/24hr$/, /^\/fapi\/v1\/exchangeInfo$/, /^\/fapi\/v1\/klines$/, /^\/fapi\/v1\/openInterest$/, /^\/fapi\/v1\/fundingRate$/,
  /^\/futures\/data\/openInterestHist$/, /^\/futures\/data\/globalLongShortAccountRatio$/];
const SCAN = X.LISTS.filter(l => !l.ext);
const AXCFG = AX.cfgOf({}); /* app defaults: zone 0.3R, tmax 60 min, linger 8 min */
const TUN_VER = "8.2.1";

/* default transport: public GET only. `fetchImpl` is injectable for tests. */
function makeGet(fetchImpl, onWeight){ return async function pubGet(u, timeout = 12000){
  const url = new URL(BASE + u); if (url.origin !== BASE || !ALLOWED.some(r => r.test(url.pathname))) throw new Error("izin verilmeyen uç (yalnız halka açık piyasa verisi): " + url.pathname);
  const r = await fetchImpl(url.toString(), { method: "GET", signal: AbortSignal.timeout(timeout) });
  if (!r.ok){ const e = new Error("HTTP " + r.status); e.status = r.status; e.retry = +(r.headers && r.headers.get && r.headers.get("retry-after")) || 0; throw e; }
  return r.json(); }; }

class Engine {
  constructor(o = {}){ this.now = o.now || Date.now; this.log = o.log || (() => {}); this.get = makeGet(o.fetch || globalThis.fetch);
    this.S = C.create(); this.S.cfg.on = true; this.HOLD = new Map(); this.CD = new Map(); this.px = {}; this.pxT = 0; this.KIND = {}; this.UNI = []; this.VOL = {}; this.kindAt = 0; this.volAt = 0;
    this.scanInfo = { slot: 0, busy: false, done: 0, total: 0, cand: 0, trig: 0, dur: 0, at: 0, e429: 0, errs: 0 }; this.pause = 0; this.note = "başlıyor"; this.noteAt = 0; this.sq = new Map();
    this.busy = false; this.stats = { ticks: 0, opened: 0, closed: 0, lastErr: "", lastErrAt: 0 }; this.events = o.events || (() => {}); this.pending = []; }
  /* ---------- persistence ---------- */
  dump(){ return { v: 1, ver: TUN_VER, savedAt: this.now(), S: this.S, hold: [...this.HOLD.values()], scan: { at: this.scanInfo.at, dur: this.scanInfo.dur, total: this.scanInfo.total, cand: this.scanInfo.cand, trig: this.scanInfo.trig } }; }
  load(j){ try { const s = j && j.S; if (s && s.v === 1 && s.acct && fin(s.acct.bal) && Array.isArray(s.acct.pos) && Array.isArray(s.acct.hist)){ s.cfg = C.cfgOf(s.cfg); s.seen = Array.isArray(s.seen) ? s.seen : []; s.last = s.last && typeof s.last === "object" ? s.last : {};
        s.tot = s.tot || { n: 0, w: 0, pnl: 0, liq: 0 }; this.S = s; }
      for (const r of (j && j.hold) || []) if (r && r.sym && r.k) this.HOLD.set(r.k + "|" + r.sym, r); if (j && j.scan) for (const k of ["at", "dur", "total", "cand", "trig"]) if (fin(j.scan[k])) this.scanInfo[k] = j.scan[k]; /* the slot is NOT restored: a restart rescans at once */ return true; } catch(e){ return false; } }
  setNote(n){ if (n !== this.note){ this.note = n; this.noteAt = this.now(); this.events({ type: "bekle", why: n }); } }
  /* ---------- settings (phone → server). `on` only through toggle(); `start` only through reset(), exactly like the app ---------- */
  setCfg(o){ const c = this.S.cfg, keep = { on: c.on }, safe = {}; for (const k of ["maxPos", "stakePct", "minStake", "lev", "tp", "trail", "give", "target", "lossPct", "pauseLosses", "pauseMin", "tmax", "stocks"]) if (o && o[k] !== undefined) safe[k] = o[k];
    this.S.cfg = C.cfgOf(Object.assign({}, c, safe, keep)); this.S.cfg.on = keep.on; this.events({ type: "ayar", cfg: this.S.cfg }); return this.S.cfg; }
  toggle(on){ const S = this.S; if (on === undefined) on = !S.cfg.on; if (on){ S.cfg.on = true; S.halted = false; } else S.cfg.on = false; this.events({ type: on ? "başlat" : "durdur" }); return S.cfg.on; }
  kill(){ const r = C.killAll(this.S, this.now()); this.tell(r); this.events({ type: "hepsini-durdur" }); return r.length; }
  reset(){ const c = this.S.cfg; this.S = C.create(Object.assign({}, c, { on: true })); this.events({ type: "sıfırla" }); }
  tell(rs){ for (const r of rs){ this.stats.closed++; this.events({ type: "kapandı", sym: r.sym, side: r.side, net: +r.net.toFixed(2), why: r.why, entry: r.entry, exit: r.exit, t0: r.t0, t1: r.t1, rule: r.rule }); } }
  /* ---------- live action verdict (sert.js axOf / oppLive / act) ---------- */
  sqOn(sym){ const q = this.sq.get(sym); return !!(q && q.on && this.now() - q.at < 600000); }
  oppLive(sym, side){ const now = this.now(); for (const r of this.HOLD.values()){ if (r.sym !== sym || r.side === side) continue; if (now - (r.close || r.t) > 60*60000) continue;
      const v = AX.verdict(r, this.px[sym], now, { cfg: AXCFG, opposite: false, squeeze: false, latch: r._latch }); if (!v || v.st !== "CIK") return true; } return false; }
  axOf(r){ const now = this.now(), v = AX.verdict(r, this.px[r.sym], now, { cfg: AXCFG, latch: r._latch, squeeze: r.side < 0 && this.sqOn(r.sym), opposite: this.oppLive(r.sym, r.side) });
    if (v.st === "CIK" && !r._cikAt) r._cikAt = now; if (v.st === "CIK") r._latch = { st: "CIK", why: v.why, sub: v.sub }; r._ax = v; return v; }
  act(key){ const r = this.HOLD.get(key); if (!r) return null; const v = this.axOf(r), on = AX.stillOn(r, this.now(), v, AXCFG); if (!on){ this.HOLD.delete(key); return null; } r._ax = v; return r; }
  all(stocks){ const out = []; for (const key of [...this.HOLD.keys()]){ const s = key.slice(key.indexOf("|") + 1); if (!stocks && this.KIND[s]) continue; const r = this.act(key); if (r) out.push(r); } return out; }
  /* squeeze guard for SHORT candidates (same SQZ rule as the app; lazily, only for coins already +20 % in 24 h; supply data not used → "kısmi") */
  async sqzCheck(sym){ const c = this.sq.get(sym); if (c && this.now() - c.at < 120000) return c; let q = { on: false, at: this.now() };
    try { const [t24, ls] = await Promise.all([this.get(`/fapi/v1/ticker/24hr?symbol=${sym}`).catch(() => null), this.get(`/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=1h&limit=4`).catch(() => null)]);
      const r = SQ.evaluate({ oiCoins: NaN, mult: 1, px: t24 ? +t24.lastPrice : NaN, circ: null, mcap: null, ls: (ls || []).map(x => +x.longShortRatio), chg24: t24 ? +t24.priceChangePercent : NaN }); q = Object.assign(r, { at: this.now() }); } catch(e){}
    this.sq.set(sym, q); return q; }
  /* ---------- prices ---------- */
  async poll(){ try { const a = await this.get("/fapi/v1/ticker/price", 10000); if (!Array.isArray(a)) return false; for (const x of a){ const p = +x.price; if (x.symbol && p > 0) this.px[x.symbol] = p; } this.pxT = this.now(); return true; } catch(e){ this.err("fiyat: " + e.message); return false; } }
  err(m){ this.stats.lastErr = String(m).slice(0, 200); this.stats.lastErrAt = this.now(); }
  /* ---------- one trading step (comp.js browser step) ---------- */
  async step(){ if (this.busy) return; this.busy = true; try { const S = this.S, now = this.now(); C.roll(S, now); const open = S.cfg.on || S.acct.pos.length; if (!open){ this.setNote("KAPALI — yeni işlem açılmıyor"); return; }
      if (now - this.pxT > 2500) await this.poll(); const fresh = this.now() - this.pxT < 20000; if (!fresh){ this.setNote("fiyat verisi eski — bekleniyor"); return; } this.stats.ticks++; const t = this.now(), px = this.px;
      for (const sym of [...new Set(S.acct.pos.map(p => p.sym))]) if (px[sym] > 0) this.tell(C.stepSym(S, sym, { o: px[sym], h: px[sym], l: px[sym], c: px[sym] }, t));
      for (const p of S.acct.pos.slice()){ const r = px[p.sym] > 0 ? C.sigExit(S, p, px[p.sym], t, this.oppLive(p.sym, p.side)) : null; if (r) this.tell([r]); }
      this.tell(C.guard(S, t));
      if (S.cfg.on){ const L = this.all(S.cfg.stocks).sort((a, b) => (b.vr || 0) - (a.vr || 0)); let girs = 0, why = "";
        for (const r of L){ if (r.side < 0 && r._ax && r._ax.st === "GIR"){ const q0 = this.sq.get(r.sym); if (!q0 || this.now() - q0.at > 120000){ await this.sqzCheck(r.sym); this.axOf(r); } } const v = r._ax; if (!v || v.st !== "GIR") continue; girs++;
          const id = r.k + "|" + r.sym + "|" + (r.close || r.t); if (S.seen.includes(id)) continue; const p0 = px[r.sym]; if (!(p0 > 0)) continue;
          const g = C.enter(S, r, p0, this.now(), { v }); if (g.ok){ S.seen.push(id); this.stats.opened++; this.events({ type: "açıldı", sym: r.sym, side: r.side, k: r.k, margin: +g.margin.toFixed(2), lev: S.cfg.lev, entry: g.pos.entry, stop: r.stop, tp: g.pos.tp }); }
          else { why = g.why; if (g.perm) S.seen.push(id); } }
        if (S.seen.length > 300) S.seen = S.seen.slice(-200);
        const st = C.status(S, this.now()); this.setNote(why ? "yeni işlem yok: " + why : girs ? "GİR sinyali var, işlem açıldı/işlendi" : st.state !== "AÇIK" ? st.state : `sinyal bekleniyor (${L.length} izlenen tetik, GİR yok)`); }
      if (S.acct.hist.length > 1000) S.acct.hist.length = 1000;
    } catch(e){ this.err("adım: " + e.message); } finally { this.busy = false; } }
  /* ---------- scanner (sert.js browser part: bars15 / one / loadKinds / scan) ---------- */
  async loadKinds(){ if (this.now() - this.kindAt < 6*3600000) return; try { const ei = await this.get("/fapi/v1/exchangeInfo", 30000); for (const s of ei.symbols){ const k = X.kind(s); if (k) this.KIND[s.symbol] = k; } this.UNI = X.universe(ei); this.kindAt = this.now(); } catch(e){ this.err("exchangeInfo: " + e.message); } }
  async bars15(s){ const now = this.now(), lastT = Math.floor(now/900000)*900000 - 900000, o = this.CD.get(s), inc = o && o.length >= 101 && o[o.length - 1].t >= lastT - 4*900000;
    const k = await this.get(`/fapi/v1/klines?symbol=${s}&interval=15m&limit=${inc ? 6 : 300}`), nb = k.filter(x => +x[6] < now).map(x => ({ t: +x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4], qv: +x[7], tb: +x[10] }));
    const b = inc ? X.merge(o, nb, 300) : nb.slice(-300); this.CD.set(s, b); return b; }
  async one(s){ const b = await this.bars15(s), so = { sess: !!this.KIND[s] }, f = X.feat(b, so); const ks = SCAN.filter(l => X.preK(l.k, f)).map(l => l.k); if (!ks.length) return;
    const last = b[b.length - 1], cT = last.t + 900000; let oi1 = NaN, fr = NaN;
    if (ks.some(X.needX)){ const [oh, on, fq] = await Promise.all([this.get(`/futures/data/openInterestHist?symbol=${s}&period=15m&limit=8`).catch(() => []), this.get(`/fapi/v1/openInterest?symbol=${s}`).catch(() => null), this.get(`/fapi/v1/fundingRate?symbol=${s}&limit=1`).catch(() => [])]);
      const ago = (oh || []).filter(x => +x.timestamp <= cT - 3600000).pop(), oiNow = on ? +on.openInterest : NaN; oi1 = ago && oiNow > 0 ? oiNow/(+ago.sumOpenInterest) - 1 : NaN; fr = fq && fq[0] ? +fq[0].fundingRate : NaN; }
    this.scanInfo.cand++; const T = X.evalAll(b, oi1, fr, null, so);
    for (const t of T){ Object.assign(t, { sym: s, close: cT, until: cT + 900000, t: last.t }); const id = t.k + "|" + s, p = this.HOLD.get(id); if (!p || t.close >= (p.close || 0)){ this.HOLD.set(id, t); this.scanInfo.trig++; this.events({ type: "tetik", sym: s, k: t.k, side: t.side, entry: t.entry, stop: t.stop, vr: t.vr }); } } }
  /* full pass over the universe once per 15m slot. crypto only unless the "hisse/emtia dahil" switch is on. 8 workers, 150 ms gap; 429/418 → pause (Retry-After or 60 s) */
  async scan(force){ const si = this.scanInfo, slot = Math.floor(this.now()/900000); if (si.busy || (!force && slot === si.slot)) return; si.busy = true; si.slot = slot; const t0 = this.now();
    try { await this.loadKinds(); try { if (this.now() - this.volAt > 3600000){ for (const x of await this.get("/fapi/v1/ticker/24hr", 30000)) this.VOL[x.symbol] = +x.quoteVolume; this.volAt = this.now(); } } catch(e){}
      const stocks = this.S.cfg.stocks, L = X.order(this.UNI.length ? this.UNI : [], [], this.VOL, s => !!this.KIND[s]).filter(s => stocks || !this.KIND[s]); si.total = L.length; si.done = 0; si.cand = 0; si.trig = 0; si.errs = 0; let i = 0;
      const sleep = ms => new Promise(z => setTimeout(z, ms));
      const work = async () => { while (i < L.length){ while (this.pause > this.now()) await sleep(1000); const s = L[i++];
          try { await this.one(s); } catch(e){ if (e.status === 429 || e.status === 418){ si.e429++; this.pause = this.now() + Math.max(60000, (e.retry || 0)*1000); L.push(s); continue; } si.errs++; }
          si.done++; await sleep(150); } };
      await Promise.all(Array.from({ length: 8 }, work)); si.at = this.now(); si.dur = si.at - t0; this.events({ type: "tarama", coins: si.total, ms: si.dur, tetik: si.trig, errs: si.errs });
    } catch(e){ this.err("tarama: " + e.message); } finally { si.busy = false; } }
  /* ---------- snapshot for the phone (read-only) ---------- */
  snapshot(extra){ const S = this.S, now = this.now(), st = C.status(S, now), px = this.px, open = S.acct.pos.map(p => { const x = px[p.sym] || S.last[p.sym] || p.entry, L = C.liqInfo(S, p, x), n = C.net(p, x);
      return { sym: p.sym, side: p.side, lev: p.lev, margin: +p.margin.toFixed(2), entry: p.entry, px: x, net: +n.toFixed(2), stop: p.stop, tp: p.tp, armed: !!p.armed, liq: L.px, liqDist: L.dist, t: p.t, rule: p.rule }; });
    const trig = [...this.HOLD.values()].filter(r => r._ax).map(r => ({ sym: r.sym, k: r.k, side: r.side, st: r._ax.st, sub: r._ax.sub || "", entry: r.entry, stop: r.stop, close: r.close })).filter(r => !this.KIND[r.sym] || S.cfg.stocks).slice(0, 40);
    return { ok: true, sim: true, ver: TUN_VER, now, cfg: S.cfg, status: Object.assign({}, st, { halted: !!S.halted, streak: S.streak }), open, hist: S.acct.hist.slice(0, 30).map(r => ({ sym: r.sym, side: r.side, net: +r.net.toFixed(2), why: r.why, t0: r.t0, t1: r.t1, entry: r.entry, exit: r.exit, rule: r.rule })),
      tot: S.tot, note: this.note, noteAt: this.noteAt, scan: Object.assign({}, this.scanInfo), px: { n: Object.keys(px).length, at: this.pxT }, trig, stats: this.stats, srv: extra || {} }; }
}
module.exports = { Engine, makeGet, ALLOWED, BASE, SCAN, AXCFG, TUN_VER };
