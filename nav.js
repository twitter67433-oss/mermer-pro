/* MERMER TERMİNAL v7.32 — page tabs: SHORT (default) · LONG · VADELİ (v7.21: ANALİZ · SİNYAL) · MEME · AI · CÜZDAN. Earlier: ⚡ MEME (home) · 🤖 GROK · 📈 VADELİ (Binance futures analysis + İŞLEM) · ⏱ SCALP (v7.11 per-candle 2–5 min signal, no orders) · ◈ CÜZDAN (bot wallet, Binance OTO, journal). */
"use strict";
const NAV = (() => {
const PG = { pro: "pro", short: "short", long: "long", meme: "meme", grok: "grok", fut: "vadeli", wal: "cuzdan" }, BY = Object.fromEntries(Object.entries(PG).map(([k, v]) => [v, k]));
function go(p, push = true){ if (p === "analiz") p = "short"; if (p === "scalp") p = "long"; if (!PG[p]) p = "pro"; /* v7.32: ANALİZ/SİNYAL/SHORT → SHORT + LONG */ document.body.dataset.pg = p; document.querySelectorAll("#nav button").forEach(b => { b.classList.toggle("on", b.dataset.go === p); b.setAttribute("aria-selected", b.dataset.go === p); });
  document.querySelectorAll(".mm-adv-ext").forEach(d => { if (d.id === "adv-bus") d.open = p === "fut"; });
  if (push) history.replaceState(null, "", location.pathname + location.search + "#" + PG[p]);
  requestAnimationFrame(() => { window.dispatchEvent(new Event("resize")); if (p === "pro" && window.MPRO) MPRO.paint(); if (p === "meme" && window.MEME) MEME.paint(true); if ((p === "short" || p === "long") && window.ANALIZ) ANALIZ.show(); if ((p === "short" || p === "long") && window.SERTS) SERTS.show(); if (p === "grok"){ const m = document.getElementById("gk-msgs"); if (m) m.scrollTop = m.scrollHeight; } });
  window.scrollTo({ top: 0 }); }
document.querySelectorAll("#nav button").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
const h = location.hash.slice(1), qs = new URLSearchParams(location.search);
go(BY[h] || (h === "pump" ? "meme" : h === "analiz" ? "short" : h === "scalp" ? "long" : null) || (qs.get("coin") ? "fut" : "pro"), false);
window.addEventListener("hashchange", () => { const hh = location.hash.slice(1), k = BY[hh] || (hh === "analiz" ? "short" : hh === "scalp" ? "long" : null); if (k) go(k, false); });
return { go };
})();
window.NAV = NAV;
