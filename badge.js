/* MERMER TERMİNAL v7.22 — SİNYAL ROZETİ: a small, display-only signal badge wherever a coin / token is shown (MEME, VADELİ, CÜZDAN, AI context).
   Same unified engine as SİNYAL / ANALİZ (smart.js consensus → action → A+ / proven-rule gate → decision via watch.js).
   - Binance USDⓈ-M perp: futures klines (shared SİNYAL state / İZLEME engine when they already cover the coin, otherwise a small badge engine, ≤ 6 coins).
   - DEX token without a perp (Solana mint): GeckoTerminal OHLCV (5dk / 15dk / 1s), marked "DEX", confidence halved; too few candles → "veri yok". Never invented.
   - Lazy: only badges on screen are evaluated; results cached ~1 min (perp) / ~2 min (DEX); GeckoTerminal ≤ 1 call / 3 s, 45 s pause on its rate limit.
   DISPLAY ONLY: nothing here can buy, sell, sign, or change any trading setting; no other module reads these results to trade. */
"use strict";
(function (root, factory){ const M = factory(); if (typeof module === "object" && module.exports) module.exports = M; else root.SGBX = M; })(typeof self !== "undefined" ? self : this, function (){
const fin = x => typeof x === "number" && isFinite(x);
const DEX_TF = ["5m", "15m", "1h"], GT_TF = { "5m": ["minute", 5], "15m": ["minute", 15], "1h": ["hour", 1] }, TFMS = { "5m": 3e5, "15m": 9e5, "1h": 36e5 };
/* GeckoTerminal ohlcv_list ([sec, o, h, l, c, v], newest first) → our candles (taker-buy volume unknown → neutral half) */
function dexBars(list, tf, now = Date.now()){ const ms = TFMS[tf]; return (list || []).slice().reverse().filter(r => r && fin(+r[4])).map(r => { const t = +r[0]*1000; return { t, o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +r[5] || 0, tb: (+r[5] || 0)/2, T: t + ms - 1, x: t + ms - 1 < now }; }); }
/* DEX decision from the intervals that exist; never better than the data */
function dexEval(K, tf, o){ const { SMT, SCM, WAT } = o, items = {};
  if (o.sm === "scalp" && o.SCX){ const a = K[tf]; if (!a || a.length < 80) return { word: "veri yok", none: true, src: "dex" }; const V = o.SCX.view(a, {}); if (!V) return { word: "veri yok", none: true, src: "dex" };
    return { word: "BEKLE", d: V.d, conf: Math.round(V.strength/2), trig: "", src: "dex", sm: "scalp" }; } /* DEX: no replay gate → never GİR */ for (const t of Object.keys(K)) if (K[t] && K[t].length >= 60){ try { const it = WAT.item(K, t, { SMT, SCM }); if (it) items[t] = it; } catch(e){} }
  if (!Object.keys(items).length) return { word: "veri yok", none: true, src: "dex" }; const C = SMT.consensus(items); let r = null; try { r = WAT.evalCoin(K, tf, items, null, { SMT }); } catch(e){}
  return { word: r ? r.dec.word : "BEKLE", d: C.dir, conf: fin(C.strength) ? Math.round(C.strength/2) : 0, trig: r && r.dec.trig.length ? r.dec.trig[0].t : "", src: "dex", n: Object.keys(items).length }; }
/* from the open SİNYAL screen (same coin + interval, fully computed) */
function fromScalp(S, sym, tf){ if (!S || S.sym !== sym || S.tf !== tf || !S.dec || !S.G) return null; const have = Object.keys(S.I || {}).length; if (have < 11) return null;
  return { word: S.dec.word, d: S.G.dir, conf: S.G.strength, trig: S.dec.trig && S.dec.trig.length ? S.dec.trig[0].t : "", src: "perp" }; }
const fromLast = (x, maxAge, now = Date.now()) => x && now - x.at <= maxAge ? { word: x.word, d: x.d, conf: x.conf, trig: x.trig || "", src: "perp" } : null;
/* badge text / class */
function label(r){ if (!r) return { txt: "⋯", cls: "na" }; if (r.none || r.err) return { txt: r.err ? "hata" : "veri yok", cls: "na" };
  if (r.word === "GİR LONG") return { txt: "GİR LONG", cls: "up" }; if (r.word === "GİR SHORT") return { txt: "GİR SHORT", cls: "dn" };
  return { txt: "BEKLE · " + (r.d > 0 ? "eğilim L" : r.d < 0 ? "eğilim S" : "yatay"), cls: r.d > 0 ? "bl up" : r.d < 0 ? "bl dn" : "y" }; }
/* v7.26 simple view: the badge is just a colored LONG / SHORT / BEKLE (GİR only → LONG/SHORT; eğilim stays BEKLE) */
function labelS(r){ const L = label(r); if (L.cls === "na") return L; return L.txt === "GİR LONG" ? { txt: "LONG", cls: "up" } : L.txt === "GİR SHORT" ? { txt: "SHORT", cls: "dn" } : { txt: "BEKLE", cls: "y" }; }
return { DEX_TF, GT_TF, dexBars, dexEval, fromScalp, fromLast, label, labelS };
});
/* ---------------- browser ---------------- */
if (typeof window !== "undefined" && typeof document !== "undefined") window.SGB = (() => {
const X = SGBX, esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const GT = "https://api.geckoterminal.com/api/v2", FUT = "https://fapi.binance.com", cache = new Map(), fails = new Map(), pools = new Map(), dexQ = [], recent = [];
let gtAt = 0, gtPause = 0, lastP = 0, busyK = null, perps = null, dexBusy = false;
const tfNow = () => (window.SCALP && SCALP.S && SCALP.S.tf) || "15m", TFL = () => (window.SCM && SCM.TF_LBL) || {};
async function fj(p){ const r = await fetch(FUT + p, { cache: "no-store" }); if (!r.ok) throw new Error("Binance vadeli HTTP " + r.status); return r.json(); }
const BE = WAT.create({ SMT, SCM, SCX: window.SCX, JRN: window.JRN, fj, cb: { add: () => {}, eval: () => repaint() } }); BE.config({ list: [], tfs: [tfNow()], auto: false, trig: false }); /* auto:false → never records, never trades */
function perpSet(){ if (!perps && window.SCALP) SCALP.list().then(L => { perps = new Set(L.map(x => x.s)); }).catch(() => {}); return perps; }
/* markup used by the tabs */
function tag(o){ const k = o.perp ? "p:" + o.perp : o.mint ? "m:" + o.mint : null; if (!k) return ""; const tf = o.perp ? tfNow() : DEXTF(), r = get(k, tf), L = LBL(r, k);
  return `<button type="button" class="sgb ${L.cls}${o.mint ? " dex" : ""}" data-sgb="${esc(k)}"${o.sym ? ` data-sgs="${esc(o.sym)}"` : ""} title="sinyal rozeti · ${o.mint ? "DEX verisi (GeckoTerminal), düşük güven" : "Binance vadeli"} · yalnızca gösterim, emir yok">${inner(L, tf, !!o.mint, r)}</button>`; }
const DEXTF = () => X.DEX_TF.includes(tfNow()) ? tfNow() : "15m";
const SIMPLE = () => document.body.classList.contains("simple"), LBL0 = r => SIMPLE() ? X.labelS(r) : X.label(r);
/* v7.27: a SHORT badge on a coin with an active squeeze warning (already cached by SQZ) shows "SHORT GİRME" instead — display only */
const LBL = (r, k) => { const L = LBL0(r), q = k && k.startsWith("p:") && window.SQZ && SQZ.peek(k.slice(2)); return q && q.on && /SHORT/.test(L.txt) ? { txt: "SHORT GİRME", cls: "y" } : L; };
const inner = (L, tf, dex, r) => SIMPLE() ? `<b>${esc(L.txt)}</b>` : `<b>${esc(L.txt)}</b><small>${esc(TFL()[tf] || tf)}${dex ? " · DEX" : ""}${r && fin(r.conf) && !r.none ? " · %" + r.conf : ""}</small>`;
const fin = x => typeof x === "number" && isFinite(x);
function get(k, tf){ const kk = k + "@" + tf, c = cache.get(kk); const sym = k.slice(2);
  if (k.startsWith("p:")){ const s = window.SCALP && SCALP.S, a = X.fromScalp(s, sym, tf); if (a){ cache.set(kk, { ...a, at: Date.now() }); return a; }
    const w = window.SCALP && SCALP._j && SCALP._j.WE && X.fromLast(SCALP._j.WE.W.last[sym + "@" + tf], 180000); if (w) return w;
    const b = X.fromLast(BE.W.last[sym + "@" + tf], 180000); if (b){ cache.set(kk, { ...b, at: Date.now() }); return b; } }
  return c || null; }
/* which badges are on screen → schedule */
function scan(){ if (document.hidden) return; const tf = tfNow(), vis = [...document.querySelectorAll(".sgb[data-sgb]")].filter(e => { if (!e.offsetParent) return false; const r = e.getBoundingClientRect(); return r.bottom > -100 && r.top < innerHeight + 200; });
  const want = new Set(vis.map(e => e.dataset.sgb)); const P = perpSet(); dexQ.length = 0; /* only what is on screen now */
  for (const k of want){ if (k.startsWith("p:")){ const s = k.slice(2); if (P && !P.has(s)){ cache.set(k + "@" + tf, { none: true, word: "veri yok", at: Date.now() }); continue; }
      const covered = X.fromScalp(window.SCALP && SCALP.S, s, tf) || (window.SCALP && SCALP._j && SCALP._j.WE && SCALP._j.WE.W.list.includes(s) && SCALP._j.WE.W.tfs.includes(tf));
      if (!covered){ const i = recent.indexOf(s); if (i >= 0) recent.splice(i, 1); recent.unshift(s); } }
    else { const tfd = DEXTF(), c = cache.get(k + "@" + tfd); if ((!c || Date.now() - c.at > 120000) && !dexQ.includes(k) && k !== busyK) dexQ.push(k); } }
  recent.length = Math.min(recent.length, 6); const L = recent.slice(); if ([...want].some(k => k.startsWith("p:"))) lastP = Date.now();
  const smN = (window.SCALP && SCALP.S && SCALP.S.sm) || "trend"; if (L.join() !== BE.W.list.join() || BE.W.tfs[0] !== tf || BE.W.sm !== smN){ if (BE.W.sm !== smN) for (const k of Object.keys(BE.W.last)) delete BE.W.last[k]; BE.config({ list: L, tfs: [tf], sm: smN }); } /* runs only while a perp badge was on screen in the last 2 min */
  if (L.length && Date.now() - lastP < 120000) BE.start(); else BE.stop();
  dexStep(); repaint(); }
async function gt(p){ const w = gtAt + 3000 - Date.now(); if (w > 0) await new Promise(r => setTimeout(r, w)); gtAt = Date.now(); const r = await fetch(GT + p, { headers: { accept: "application/json" } });
  if (r.status === 429){ gtPause = Date.now() + 60000; throw new Error("GeckoTerminal istek limiti"); } if (r.status === 404) return null; if (!r.ok) throw new Error("GeckoTerminal HTTP " + r.status); return r.json(); }
async function dexStep(){ if (dexBusy || !dexQ.length || Date.now() < gtPause) return; dexBusy = true; const k = busyK = dexQ.shift(), mint = k.slice(2), tf = DEXTF();
  try { let pool = pools.get(mint); if (pool === undefined){ const j = await gt(`/networks/solana/tokens/${mint}/pools?page=1`); pool = j && j.data && j.data[0] ? j.data[0].attributes.address : null; pools.set(mint, pool); }
    if (!pool){ cache.set(k + "@" + tf, { none: true, word: "veri yok", src: "dex", at: Date.now() }); return; } const K = {};
    for (const t of X.DEX_TF){ const [u, a] = X.GT_TF[t], j = await gt(`/networks/solana/pools/${pool}/ohlcv/${u}?aggregate=${a}&limit=300&currency=usd`); K[t] = X.dexBars(j && j.data && j.data.attributes && j.data.attributes.ohlcv_list, t); }
    cache.set(k + "@" + tf, { ...X.dexEval(K, tf, { SMT, SCM, WAT, SCX: window.SCX, sm: (window.SCALP && SCALP.S && SCALP.S.sm) || "trend" }), at: Date.now() }); _ok(k); }
  catch(e){ /* GeckoTerminal answers its rate limit without CORS headers → "Failed to fetch": pause, retry later, show ⋯ (only 3 misses → "hata") */
    const n = (fails.get(k) || 0) + 1; fails.set(k, n); if (/fetch|limit|429/i.test(String(e.message || e))) gtPause = Date.now() + 45000;
    if (n >= 3) cache.set(k + "@" + tf, { err: String(e.message || e), at: Date.now() - 60000 }); else if (!dexQ.includes(k)) dexQ.push(k); }
  finally { dexBusy = false; busyK = null; repaint(); if (dexQ.length) setTimeout(dexStep, 100); } }
/* successful token → forget its misses */ const _ok = k => fails.delete(k);
function repaint(){ const tf = tfNow(); document.querySelectorAll(".sgb[data-sgb]").forEach(e => { const k = e.dataset.sgb, dex = k.startsWith("m:"), t = dex ? DEXTF() : tf, r = get(k, t), L = LBL(r, k), h = inner(L, t, dex, r);
    if (e.innerHTML !== h){ e.innerHTML = h; e.className = `sgb ${L.cls}${dex ? " dex" : ""}`; } }); }
/* tap → ANALİZ (perp) or a short note (DEX: ANALİZ is Binance-futures only) */
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".sgb[data-sgb]"); if (!b) return; e.preventDefault(); e.stopPropagation(); const k = b.dataset.sgb;
  if (k.startsWith("p:") && window.NAV && window.ANALIZ){ NAV.go("analiz"); setTimeout(() => ANALIZ.run(k.slice(2), tfNow()), 50); return; }
  const r = get(k, DEXTF()), L = X.label(r); try { NOTIFY.toast(`${b.dataset.sgs || "token"}: ${L.txt} (${TFL()[DEXTF()]}, DEX verisi, düşük güven${r && r.trig ? " · " + r.trig : ""}) — ANALİZ yalnızca Binance vadeli coinler için`, "info"); } catch(x){} }, true);
/* for the AI tab: read-only snapshot of what the badges show (advisory context) */
function snapshot(){ const out = []; const tf = tfNow(); const S = window.SCALP && SCALP.S; if (S && S.dec) out.push({ coin: S.sym, aralik: S.tf, karar: S.dec.word, egilim: S.G ? (S.G.dir > 0 ? "LONG" : S.G.dir < 0 ? "SHORT" : "yatay") : null, kaynak: "SİNYAL" });
  for (const [kk, r] of cache){ if (Date.now() - r.at > 300000 || r.none || r.err) continue; const [k, t] = kk.split("@"); out.push({ coin: k.slice(2), aralik: t, karar: r.word, egilim: r.d > 0 ? "LONG" : r.d < 0 ? "SHORT" : "yatay", kaynak: r.src === "dex" ? "DEX (düşük güven)" : "Binance vadeli" }); }
  const W = window.SCALP && SCALP._j && SCALP._j.WE; if (W) for (const [k, x] of Object.entries(W.W.last)) out.push({ coin: k.split("@")[0], aralik: k.split("@")[1], karar: x.word, egilim: x.d > 0 ? "LONG" : x.d < 0 ? "SHORT" : "yatay", kaynak: "izleme listesi" });
  void tf; return out.slice(0, 25); }
setInterval(scan, 2000); document.addEventListener("scroll", () => { clearTimeout(scan.t); scan.t = setTimeout(scan, 300); }, { passive: true }); window.addEventListener("sinyal:update", () => repaint()); window.addEventListener("sqz:update", () => repaint());
return { tag, snapshot, scan, repaint, _c: cache };
})();
