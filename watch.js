/* MERMER TERMİNAL v7.20 — İZLEME LİSTESİ engine for SANAL TAKİP (paper tracking only).
   Runs the same SİNYAL decision (GENEL YÖN consensus over 1dk–1G + A+ / kırılım / gated trend → GİR LONG / GİR SHORT / BEKLE + triggers)
   for every coin the user put on the watchlist, on the intervals the user picked, and reports virtual entries through cb.add().
   NO orders, NO keys, NO wallet: public Binance USDⓈ-M futures klines only (fapi.binance.com REST).
   Background differences vs the open SİNYAL screen: no live derivative / order-book veto, no BTC-lead input; evaluated every ~1 min (on fresh 1m data) and on candle closes.
   Rate limits: one REST call at a time, ≥ 350 ms apart (≤ ~170 calls/min). First load 499 candles (weight 2), then 3-candle refreshes (weight 1) merged in; HTTP 429/418 → pause. */
"use strict";
(function (root, factory){ const M = factory(); if (typeof module === "object" && module.exports) module.exports = M; else root.WAT = M; })(typeof self !== "undefined" ? self : this, function (){
const fin = x => typeof x === "number" && isFinite(x), clip = (x, a = -1, b = 1) => Math.max(a, Math.min(b, x));
const MAXC = 15, DEF_TF = ["15m", "1h"], GAP = 350, GR_MS = 10*6e4;
const dOf = (st, v) => st === "LONG" || st === "PUMP" ? 1 : st === "SHORT" || st === "DUMP" ? -1 : st === "SIKIŞMA" ? (v || 0)*0.5 : v;
const bars = a => a.map(k => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5], T: +k[6], tb: +k[9], x: true }));
/* merge fresh candles into a series (same open time → replace), keep last 600 */
function merge(a, fresh){ if (!a || !a.length) return fresh.slice(); const out = a.slice(); for (const b of fresh){ const i = out.length - 1;
    if (b.t === out[i].t) out[i] = b; else if (b.t > out[i].t) out.push(b); else { const j = out.findIndex(x => x.t === b.t); if (j >= 0) out[j] = b; } }
  return out.length > 600 ? out.slice(-600) : out; }
/* does a 3-candle refresh leave a hole? (then reload fully) */
const gap = (a, fresh) => !!(a && a.length && fresh.length && fresh[0].t > a[a.length - 1].t + (a[a.length - 1].T - a[a.length - 1].t + 1));
/* is interval t of series a due for a refresh at time now? (never loaded, or its live candle has closed) */
const due = (a, now) => !a || !a.length || now >= a[a.length - 1].T + 1500;
/* carry the newest 1m candle into the live candle of every other interval (price / high / low; volume unchanged) */
function patchLive(K, m1, now){ if (!m1) return; for (const t of Object.keys(K)){ if (t === "1m") continue; const a = K[t]; if (!a || !a.length) continue; const l = a[a.length - 1];
    if (m1.t >= l.t && m1.t <= l.T && l.T >= now - 1){ l.h = Math.max(l.h, m1.h); l.l = Math.min(l.l, m1.l); l.c = m1.c; l.x = false; } } }
/* one interval's state (same rules as the SİNYAL overview row) */
function item(K, t, o){ const { SMT, SCM } = o, a = K[t]; if (!a || a.length < 60) return null; const H = SMT.prepHigher(a), v = H ? H.v[H.v.length - 1] : null, rel = SMT.tfRel(H, a.map(x => x.c), 3);
  let st = "BEKLE", pUp = null, plan = null, sd = 0, atr = null, ema21 = null; const px = a[a.length - 1].c;
  if (a.length >= 150){ const [h1, h2] = SCM.higher(t), P = SMT.prep(a, { tms: SCM.TF_MS[t], h1: K[h1], h2: K[h2] }), L = SMT.walk(P, { mode: o.mode || "trend" }).live, z = L.sq || L.sqRecent, i = P.n - 1;
    st = z ? (z.d > 0 ? "PUMP" : "DUMP") : L.squeeze ? "SIKIŞMA" : L.aplus ? (L.d > 0 ? "LONG" : "SHORT") : "BEKLE"; atr = P.A[i]; ema21 = P.e21 ? P.e21[i] : null; sd = z ? z.d : L.d;
    plan = L.sq ? { entry: px, stop: L.sq.stop, tp: L.sq.tp } : L.sqRecent ? { entry: z.entry, stop: z.stop, tp: z.tp } : L.aplus && L.plan ? { entry: L.plan.entry, stop: L.plan.stop, tp: L.plan.tp } : null;
    if (st === "SIKIŞMA" && L.squeeze.box){ const bx = L.squeeze.box; pUp = SMT.squeezeDir({ pos: clip(((px - bx.lo)/(bx.hi - bx.lo || 1) - 0.5)*2), cvd: clip((P.cvd[i] - P.cvd[bx.from])/((P.vs20[i] || 1)*bx.len)*4), mtf: L.a.T.mtf }).pUp; plan = { longAbove: bx.hi, shortBelow: bx.lo }; } }
  return { st, v, d: dOf(st, v), rel, pUp, plan, sd, atr, ema21, px, bt: a[a.length - 1].t }; }
/* full decision for coin K on interval t. items = { tf: item } (all intervals available), gR = gReplay result for the gate */
function evalCoin(K, t, items, gR, o){ const { SMT } = o, it = items[t], a = K[t]; if (!it || !a || a.length < 150) return null; const I = {}; for (const k of Object.keys(items)) if (items[k]) I[k] = items[k];
  const C = SMT.consensus(I), px = it.px, atr = it.atr; let A = SMT.action(C, { main: { state: it.st, d: it.sd, plan: it.plan, pUp: it.pUp }, px, atr, ema21: it.ema21 });
  if (A.kind === "trend" && !SMT.gGate(gR)) A = { act: "BEKLE", d: 0, prefer: C.dir, kind: "kapı", wait: "A+ onayını bekle" };
  const bb = a.slice(-10), dec = SMT.decision(C, A, { px, atr, ema21: it.ema21, hi: Math.max(...bb.map(k => k.h)), lo: Math.min(...bb.map(k => k.l)) });
  return { C, A, dec, px, atr, st: it.st, live: a[a.length - 1] }; }
const jType = (A, st) => A.kind === "A+ kurulum" ? "A+" : A.kind === "kırılım" ? (st === "PUMP" || st === "DUMP" ? st : "kırılım") : A.kind === "trend" ? "trend" : A.kind || "sinyal";
/* ---------- scheduler (browser) ---------- */
function create(o){ const { SMT, SCM, fj, cb } = o, now = o.now || (() => Date.now()), TF = SCM.TF_SEL; const W = { coins: new Map(), list: [], tfs: DEF_TF.slice(), trig: true, auto: true, mode: "trend",
    busy: false, pauseTo: 0, rr: 0, calls: 0, callsAt: 0, err: null, skip: null, timer: null, last: {} };
  const coin = s => { if (!W.coins.has(s)) W.coins.set(s, { K: {}, items: {}, gR: {}, gRAt: {}, trig: {}, retry: {}, dirty: false, evAt: 0, err: 0 }); return W.coins.get(s); };
  function config(c){ if (c.list) W.list = c.list.slice(0, MAXC); if (c.tfs) W.tfs = c.tfs.filter(t => TF.includes(t)); for (const k of ["trig", "auto", "mode"]) if (c[k] !== undefined) W[k] = c[k]; if (c.skip !== undefined) W.skip = c.skip;
    for (const s of [...W.coins.keys()]) if (!W.list.includes(s)) W.coins.delete(s); W.list.forEach(coin); }
  /* next REST task: round-robin over coins; per coin the most urgent interval (never loaded first, then shortest due) */
  function nextTask(){ const n = W.list.length, tn = now(); for (let k = 0; k < n; k++){ const s = W.list[(W.rr + k) % n], c = coin(s); if (tn < (c.backTo || 0)) continue;
      for (const t of TF){ const a = c.K[t]; if (!a) return { s, t, full: true, i: k }; }
      for (const t of TF){ if (due(c.K[t], tn) && !(tn < (c.retry[t] || 0))) return { s, t, full: false, i: k }; } } return null; }
  async function step(){ if (W.busy || !W.list.length || now() < W.pauseTo || (typeof document !== "undefined" && document.hidden)) return; const job = nextTask(); if (!job){ evalDirty(); return; }
    W.busy = true; W.rr = (W.rr + job.i + 1) % Math.max(1, W.list.length); const c = coin(job.s);
    try { const fresh = bars(await fj(`/fapi/v1/klines?symbol=${job.s}&interval=${job.t}&limit=${job.full ? 499 : 3}`)); W.calls++; const tn = now(); for (const b of fresh) if (b.T >= tn) b.x = false;
      if (!job.full && gap(c.K[job.t], fresh)) c.K[job.t] = null; else { const prev = c.K[job.t], closedNow = prev && prev.length ? prev[prev.length - 1] : null; c.K[job.t] = merge(prev, fresh);
        /* BEKLE trigger of the candle that just closed */ const g = c.trig[job.t]; if (g && closedNow){ const cl = c.K[job.t].find(b => b.t === g.candle && b.x); if (cl){ delete c.trig[job.t]; if (W.trig && W.auto) fireTrig(job.s, job.t, g, cl); } }
        if (job.t === "1m") patchLive(c.K, c.K["1m"][c.K["1m"].length - 1], tn);
        try { c.items[job.t] = item(c.K, job.t, { SMT, SCM, mode: W.mode }); } catch(e){ c.items[job.t] = null; } c.dirty = true;
        /* Binance may still serve the old candle right after the close → retry that interval in 5 s, not every step */ if (due(c.K[job.t], tn)) c.retry[job.t] = tn + 5000; } c.err = 0; W.err = null; }
    catch(e){ c.err++; W.err = String(e.message || e); if (/429|418/.test(W.err)) W.pauseTo = now() + 60000; else c.backTo = now() + Math.min(300000, 5000*2**c.err); }
    finally { W.busy = false; } evalDirty(); }
  function fireTrig(s, t, g, bar){ const R = fin(g.atr) && g.atr > 0 ? g.atr : bar.c*0.003; for (const tg of g.trig){ const f = o.JRN.trigFired(tg, bar); if (!f) continue; const e = f.entry, st = e - tg.d*1.5*R;
      cb.add({ sym: s, tf: t, d: tg.d, entry: e, stop: st, tp: e + tg.d*1.5*Math.abs(e - st), type: "tetik", why: tg.k + " tetiği (izleme)", src: "izleme", t: bar.T + 1 }); break; } }
  /* evaluate one dirty coin per call (all its intervals must be loaded) */
  function evalDirty(){ const tn = now(); for (const s of W.list){ const c = coin(s); if (!c.dirty || TF.some(t => !c.K[t])) continue; c.dirty = false; c.evAt = tn;
      for (const t of W.tfs){ if (W.skip && W.skip(s, t)) continue; try {
          c.items[t] = item(c.K, t, { SMT, SCM, mode: W.mode }); if (!c.gRAt[t] || tn - c.gRAt[t] > GR_MS){ c.gRAt[t] = tn; try { c.gR[t] = SMT.gReplay(c.K, t); } catch(e){ c.gR[t] = null; } }
          const r = evalCoin(c.K, t, c.items, c.gR[t], { SMT }); if (!r) continue; W.last[s + "@" + t] = { act: r.A.act, word: r.dec.word, dir: r.C.label, d: r.C.dir, conf: r.C.strength, trig: r.dec.trig.length ? r.dec.trig[0].t : "", at: tn, px: r.px };
          if (W.auto && (r.A.act === "GİR LONG" || r.A.act === "GİR SHORT")) cb.add({ sym: s, tf: t, d: r.A.d, entry: r.px, stop: r.A.stop, tp: r.A.tp, type: jType(r.A, r.st), why: r.A.kind + " (izleme)", src: "izleme", t: tn });
          if (r.dec.word === "BEKLE" && r.dec.trig.length && !r.live.x) c.trig[t] = { candle: r.live.t, trig: r.dec.trig.slice(), atr: r.atr }; else if (c.trig[t] && c.trig[t].candle !== r.live.t) delete c.trig[t];
        } catch(e){} }
      if (cb.eval) cb.eval(s); return; } }
  function start(){ if (!W.timer) W.timer = setInterval(step, GAP); } function stop(){ if (W.timer){ clearInterval(W.timer); W.timer = null; } }
  function status(){ const n = W.list.length, ready = W.list.filter(s => TF.every(t => coin(s).K[t])).length; return { n, ready, calls: W.calls, err: W.err, paused: now() < W.pauseTo }; }
  return { W, config, start, stop, step, status, coin }; }
return { MAXC, DEF_TF, GAP, merge, gap, due, patchLive, item, evalCoin, create, bars, jType };
});
