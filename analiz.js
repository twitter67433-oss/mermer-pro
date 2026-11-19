/* MERMER TERMİNAL v7.21 — 🔍 ANALİZ tab: coin + interval → ONE answer. Signal only: no orders, no keys, no wallet.
   It renders the SAME decision object the SİNYAL tab computes (SCALP.S.dec / S.A / S.G — shared engine, shared coin + interval),
   so the two tabs can never disagree. GİR LONG / GİR SHORT only when SİNYAL says GİR (A+ / kırılım / proven rule gate unchanged);
   otherwise BEKLE with the leaning (eğilim LONG / SHORT / yatay) and the trigger line. */
"use strict";
(function (root, factory){ const M = factory(); if (typeof module === "object" && module.exports) module.exports = M; else root.ANZ = M; })(typeof self !== "undefined" ? self : this, function (){
const fin = x => typeof x === "number" && isFinite(x), sgn = (x, e = 0) => x > e ? 1 : x < -e ? -1 : 0;
/* pure: SİNYAL state → what the ANALİZ card shows */
function view(x){ const dec = x.dec, C = x.C, A = x.A || {}; if (!dec || !C) return null; const word = dec.word, go = word === "GİR LONG" || word === "GİR SHORT";
  const an = dec.scalp ? "anlık " : "", lean = C.dir > 0 ? an + "eğilim LONG" : C.dir < 0 ? an + "eğilim SHORT" : "yatay", leanCls = C.dir > 0 ? "up" : C.dir < 0 ? "dn" : "y";
  const dirs = (x.TF || []).map(t => { const it = x.I && x.I[t]; const d = it ? sgn(Math.abs(it.d) >= 0.25 ? it.d : 0) : null; return { t, d, st: it ? it.st : null }; });
  return { word, go, cls: word === "GİR LONG" ? "up" : word === "GİR SHORT" ? "dn" : "y", lean, leanCls, strong: !!C.strong, label: C.label, yon: dec.yon,
    conf: fin(C.strength) ? Math.max(0, Math.min(100, Math.round(C.strength))) : 0,
    plan: go ? { entry: A.entry, stop: A.stop, tp: A.tp, kind: A.kind } : null,
    trig: go ? [] : (dec.trig || []).map(t => ({ d: t.d, t: t.t })), note: dec.note || null,
    reasons: (x.sum || []).slice(0, 3), dirs, rev: dec.rev || null, scalp: dec.scalp || null, hold: dec.hold || "" }; }
return { view };
});
/* ---------------- UI ---------------- */
if (typeof window !== "undefined" && typeof document !== "undefined") window.ANALIZ = (() => {
const $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const { TF_SEL, TF_LBL } = SCM, fin = x => typeof x === "number" && isFinite(x); let t0 = 0, inited = false, list = [], bt = 0, pend = false;
const Sx = () => window.SCALP && SCALP.S;
function html(){ const S = Sx() || {}; return `<div class="az-q"><input id="az-q" placeholder="coin ara: BTC, SOL, PEPE…" autocomplete="off" spellcheck="false" value="${esc(S.sym || "BTCUSDT")}"><div id="az-l" class="az-l hidden"></div></div>
  <div class="az-sm" role="radiogroup" aria-label="sinyal modu">${["scalp", "trend", "rev"].map(m => `<button type="button" role="radio" data-sel="${m}" class="${(S.sel || "scalp") === m ? "on" : ""}" aria-checked="${(S.sel || "scalp") === m}">${m === "scalp" ? "SCALP" : m === "trend" ? "TREND" : "DÖNÜŞ"}</button>`).join("")}</div>
  <div class="az-tf" role="group" aria-label="mum aralığı">${TF_SEL.map(t => `<button type="button" data-azt="${t}" class="${t === S.tf ? "on" : ""}">${TF_LBL[t]}</button>`).join("")}</div>
  <button type="button" id="az-go" class="az-go">ANALİZ ET</button>
  <div id="az-r" class="az-r"><div class="az-empty">Coin ve mum aralığı seç, <b>ANALİZ ET</b>'e dokun.</div></div>
  <div class="az-foot">Kesin değil, sinyal amaçlı; emir yok. Aynı motor: ⏱ SİNYAL sekmesi (gelişmiş görünüm).</div>`; }
function pickSym(v){ v = String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (!v) return null; if (list.length){ const hit = list.find(x => x.s === v) || list.find(x => x.s === v + "USDT") || list.find(x => x.b === v); return hit ? hit.s : null; } return v.endsWith("USDT") ? v : v + "USDT"; }
function run(sym, tf){ const S = Sx(); if (!S) return; sym = sym || pickSym($("#az-q").value) || S.sym; if (!sym){ return; } tf = tf || S.tf; t0 = Date.now();
  document.querySelectorAll("[data-azt]").forEach(b => b.classList.toggle("on", b.dataset.azt === tf)); $("#az-q").value = sym; $("#az-l").classList.add("hidden");
  SCALP.analyze(sym, tf); paint(); }
function suggest(){ const q = $("#az-q"), l = $("#az-l"); const r = SCALP.search(q.value).slice(0, 12); l.innerHTML = r.length ? r.map(x => `<button type="button" data-azs="${esc(x.s)}">${esc(x.b)} <small>${esc(x.s)}</small></button>`).join("") : `<div class="dim">${list.length ? "bulunamadı" : "liste yükleniyor…"}</div>`; l.classList.remove("hidden"); }
function bind(){ const q = $("#az-q"), l = $("#az-l");
  q.oninput = () => { clearTimeout(bt); suggest(); }; q.onfocus = () => { clearTimeout(bt); q.select(); SCALP.list().then(L => { list = L; if (document.activeElement === q) suggest(); }); suggest(); };
  q.onblur = () => { clearTimeout(bt); bt = setTimeout(() => l.classList.add("hidden"), 250); }; l.onpointerdown = e => e.preventDefault(); l.onmousedown = e => e.preventDefault();
  q.onkeydown = e => { if (e.key === "Enter"){ const b = l.querySelector("[data-azs]"); run(b && !pickSym(q.value) ? b.dataset.azs : null); q.blur(); } };
  l.onclick = e => { const b = e.target.closest("[data-azs]"); if (!b) return; q.value = b.dataset.azs; q.blur(); run(b.dataset.azs); };
  $("#az-go").onclick = () => run(); document.querySelector(".az-tf").onclick = e => { const b = e.target.closest("[data-azt]"); if (b) run(null, b.dataset.azt); };
  $("#az-r").onclick = e => { if (e.target.closest("#az-re")) run(Sx().sym, Sx().tf); if (e.target.closest("#az-adv")) NAV.go("scalp"); };
  SCALP.list().then(L => { list = L; }); }
let azOpen = null; /* ANALİZ detay fold: null → follow the global detay switch */
/* v7.26 chart: candles + giriş/stop/hedef (GİR) or the trigger (BEKLE) + pivot support/resistance + formation markers (PAT) */
function chart(cv, S, v){ const all = S.b[S.tf] || [], N = 70, b = all.slice(-N), off = all.length - b.length; if (!cv || b.length < 5) return; const w = cv.clientWidth || 340, h = cv.clientHeight || 200, dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = w*dpr; cv.height = h*dpr;
  const night = document.documentElement.classList.contains("night"), UP = night ? "#3fb47c" : "#0f6b45", DN = night ? "#e0566b" : "#9b1c31", GOLD = night ? "#d8b46a" : "#8a6828", INK = night ? "#e9e1d2" : "#2b2f36", BLUE = night ? "#8fb2de" : "#1e3a5f";
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); const lv = [];
  if (v.plan) lv.push([v.plan.entry, BLUE, "giriş", []], [v.plan.stop, DN, "stop", []], [v.plan.tp, UP, "hedef", []]);
  else for (const t of (S.dec.trig || []).slice(0, 2)) if (t.k === "kırılım") lv.push([t.lv, t.d > 0 ? UP : DN, t.d > 0 ? "LONG >" : "SHORT <", [5, 3]]);
  const P = window.PAT, px = b[b.length - 1].c; if (P) for (const l of P.levels(all.slice(-200), px)) lv.push([l.p, GOLD, l.k === "R" ? "direnç" : "destek", [2, 3]]);
  const RW = 46; let hi = Math.max(...b.map(x => x.h)), lo = Math.min(...b.map(x => x.l)); for (const [p] of lv) if (fin(p) && Math.abs(p/px - 1) < 0.08){ hi = Math.max(hi, p); lo = Math.min(lo, p); }
  const pad = (hi - lo)*0.06; hi += pad; lo -= pad; const Y = p => 14 + (hi - p)/((hi - lo) || 1)*(h - 28), cw = (w - RW - 4)/b.length;
  g.strokeStyle = night ? "rgba(216,180,106,.12)" : "rgba(184,151,90,.18)"; g.lineWidth = 1; for (let k = 1; k < 4; k++){ g.beginPath(); g.moveTo(0, h*k/4); g.lineTo(w - RW, h*k/4); g.stroke(); }
  b.forEach((x, i) => { const up = x.c >= x.o, cx = 2 + i*cw + cw/2; g.strokeStyle = g.fillStyle = up ? UP : DN; g.beginPath(); g.moveTo(cx, Y(x.h)); g.lineTo(cx, Y(x.l)); g.stroke(); const y1 = Y(Math.max(x.o, x.c)); g.fillRect(cx - cw*0.34, y1, cw*0.68, Math.max(1, Y(Math.min(x.o, x.c)) - y1)); });
  g.font = "600 9.5px system-ui, sans-serif"; g.textBaseline = "middle"; const used = [];
  for (const [p, c, t, dash] of lv){ if (!fin(p) || p > hi || p < lo) continue; const y = Y(p); g.setLineDash(dash); g.strokeStyle = c; g.lineWidth = dash.length ? 1 : 1.5; g.beginPath(); g.moveTo(0, y); g.lineTo(w - RW, y); g.stroke(); g.setLineDash([]);
    if (used.some(u => Math.abs(u - y) < 11)) continue; used.push(y); g.fillStyle = c; g.fillRect(w - RW, y - 7, RW, 14); g.fillStyle = night ? "#15130f" : "#fffdf8"; g.fillText(t, w - RW + 3, y + 0.5); }
  const yp = Y(px); g.strokeStyle = GOLD; g.lineWidth = 1; g.beginPath(); g.moveTo(0, yp); g.lineTo(w - RW, yp); g.stroke();
  if (P){ const seen = new Set(), M = P.chart(all).concat(P.candles(all, 40).reverse()).filter(m => m.i >= off && !seen.has(m.i) && seen.add(m.i)).slice(0, 6), box = [];
    const hit = (x, y, w2) => box.some(r => x < r[0] + r[2] && x + w2 > r[0] && Math.abs(y - r[1]) < 12);
    for (const m of M){ const i = m.i - off, x = b[i], cx = 2 + i*cw + cw/2, top = m.d < 0 || (m.d === 0 && x.c >= x.o), tw = g.measureText(m.t).width + 6, tx = Math.max(0, Math.min(w - RW - tw, cx - tw/2));
      let ty = top ? Y(x.h) - 9 : Y(x.l) + 9, k = 0; while (hit(tx, ty, tw) && k++ < 6) ty += top ? -12 : 12; if (ty < 6 || ty > h - 6) continue; box.push([tx, ty, tw]);
      g.fillStyle = night ? "rgba(21,19,15,.82)" : "rgba(255,253,248,.88)"; g.fillRect(tx, ty - 6, tw, 12); g.fillStyle = m.d > 0 ? UP : m.d < 0 ? DN : INK; g.fillText(m.t, tx + 3, ty); } } }
function paint(){ const el = $("#az-r"), S = Sx(); if (!el || !S) return; if (!t0) return; const fp = SCALP.fp, have = TF_SEL.filter(t => S.I && S.I[t]).length, coin = esc(S.sym.replace("USDT", "")), tfL = TF_LBL[S.tf];
  if (S.err){ el.innerHTML = `<div class="az-card"><div class="az-err">✖ ${esc(S.err)}</div><button type="button" id="az-re" class="az-mini">↻ tekrar dene</button></div>`; return; }
  const sc = S.sm === "scalp", ready = S.dec && S.G && (sc ? !!S.V && S.dec.scalp : (have >= 11 || (have >= 6 && Date.now() - t0 > 25000)));
  if (!ready){ el.innerHTML = `<div class="az-card az-load"><div class="az-coin">${coin} <small>${tfL}</small></div><div class="az-wait">analiz ediliyor… <b>${have}</b>/12 aralık okundu</div><div class="az-cbar"><span style="width:${Math.round(have/12*100)}%"></span></div></div>`; setTimeout(paint, 700); return; }
  const v = ANZ.view({ dec: S.dec, C: S.G, A: S.A, I: S.I, sum: S.sum, TF: TF_SEL }); if (!v) return; const when = new Date(S.decAt || Date.now()).toLocaleTimeString("tr-TR", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dots = v.dirs.map(d => `<span class="az-d ${d.d > 0 ? "up" : d.d < 0 ? "dn" : d.st === "SIKIŞMA" ? "m" : d.d === null ? "na" : "n"}${d.t === S.tf ? " on" : ""}"><i>${d.d === null ? "·" : d.st === "SIKIŞMA" ? "◇" : d.d > 0 ? "↑" : d.d < 0 ? "↓" : "•"}</i><small>${TF_LBL[d.t]}</small></span>`).join("");
  const sq = window.SQZ ? SQZ.get(S.sym) : null, blockS = !!(sq && sq.on && v.word === "GİR SHORT"), sqH = window.SQZ ? SQZ.html(S.sym) : ""; /* v7.27 warning only */
  const open = (azOpen === null ? !!(window.DETAY && DETAY.on()) : azOpen) ? " open" : "";
  el.innerHTML = `<div class="az-card ${v.cls}"><div class="az-coin">${coin} <small>${tfL} · ${fp(S.D ? S.D.px : null)}</small></div>
    <div class="az-word ${blockS ? "y" : v.cls}">${blockS ? "SHORT GİRME" : esc(v.word)}</div>${sqH}
    ${v.go && !blockS ? `<div class="az-plan"><div><small>giriş</small><b>${fp(v.plan.entry)}</b></div><div><small>stop</small><b class="dn">${fp(v.plan.stop)}</b></div><div><small>hedef</small><b class="up">${fp(v.plan.tp)}</b></div></div>` : ""}
    <canvas id="az-cv" class="az-cv" aria-label="mum grafiği: giriş, stop, hedef, destek/direnç ve formasyonlar"></canvas>
    <details class="az-det"${open}><summary>detay</summary>
    <div class="az-mode">${sc ? "SCALP · " + esc(tfL) + " + emir akışı" : (S.sel === "rev" ? "DÖNÜŞ" : "TREND") + " · 12 aralık"}</div>${v.rev ? `<div class="az-rev ${v.rev.d > 0 ? "up" : "dn"}" role="note"><b>⚠ DÖNÜŞ UYARISI</b> ${esc(v.rev.why)}</div>` : ""}
    ${v.go ? `<div class="az-kind">${esc(v.plan.kind || "")} · kanıtlı kurulum${v.hold ? " · tutma " + esc(v.hold) : ""}</div>`
      : `<div class="az-lean ${v.leanCls}">${v.lean === "yatay" ? "yön: yatay" : esc(v.lean)}${v.scalp && v.scalp.flowW && v.lean !== "yatay" ? ` <small>· tepki (akış: ${esc(v.scalp.flowW)})</small>` : ""}${v.strong && v.lean !== "yatay" ? " · güçlü" : ""}</div><div class="az-why">${v.scalp ? "anlık eğilim — " + esc(v.scalp.why) : "eğilim = yön, giriş değil — GİR için kanıtlı kurulum (A+) bekleniyor"}</div>
        ${v.trig.length ? `<div class="az-trig">${v.trig.map(t => `<div class="${t.d > 0 ? "up" : "dn"}">→ ${esc(t.t)}</div>`).join("")}</div>` : `<div class="az-trig dim">net tetik yok</div>`}`}
    <div class="az-conf"><small>güven (yön gücü)</small><div class="az-cbar ${v.leanCls}"><span style="width:${v.conf}%"></span></div><b>%${v.conf}</b></div>
    <ul class="az-rs">${v.reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
    <div class="az-dots">${dots}</div>
    ${v.note ? `<div class="az-note dim">${esc(v.note)}</div>` : ""}<button type="button" id="az-adv" class="az-mini">detaylar → SİNYAL</button></details>
    <div class="az-bot"><span class="dim">${when} Berlin</span><button type="button" id="az-re" class="az-mini">↻ yenile</button></div></div>`;
  { const d = el.querySelector(".az-det"); if (d) d.ontoggle = () => { azOpen = d.open; }; }
  chart($("#az-cv"), S, v); }
function init(){ const box = $("#analiz-box"); if (!box || inited) return; inited = true; box.innerHTML = html(); bind();
  window.addEventListener("sinyal:update", () => { if (document.body.dataset.pg !== "analiz" || pend) return; pend = true; setTimeout(() => { pend = false; paint(); }, 400); });
  window.addEventListener("themechange", () => paint()); window.addEventListener("detay:change", () => { azOpen = null; paint(); }); window.addEventListener("sqz:update", e => { const S = Sx(); if (S && e.detail && e.detail.sym === S.sym && document.body.dataset.pg === "analiz") paint(); });
  window.addEventListener("sinyal:mode", () => { const S = Sx(); document.querySelectorAll(".az-sm [data-sel]").forEach(b => { const on = b.dataset.sel === S.sel; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    document.querySelectorAll("[data-azt]").forEach(b => b.classList.toggle("on", b.dataset.azt === S.tf)); if (t0) t0 = Date.now(); paint(); }); window.addEventListener("resize", () => { if (document.body.dataset.pg === "analiz") paint(); }); }
function show(){ init(); const S = Sx(); if (!S || !inited) return; document.querySelectorAll("[data-azt]").forEach(b => b.classList.toggle("on", b.dataset.azt === S.tf)); const q = $("#az-q"); if (q && document.activeElement !== q) q.value = S.sym;
  if (!t0) run(S.sym, S.tf); else paint(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
return { show, run, paint };
})();
