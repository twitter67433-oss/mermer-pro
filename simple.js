/* MERMER TERMİNAL v7.26 — SADE GÖRÜNÜM. Default: body.simple → one result per coin (GİR LONG / GİR SHORT / BEKLE + giriş/stop/hedef).
   Every engine keeps running; only the UI hides the detail texts. One global "detay" switch (off by default, saved) brings them back. */
"use strict";
(function(){ const K = "mermer.detay", PANELS = ["scalp", "psim", "coinan", "meme", "pump"];
  const on = () => { try { return localStorage.getItem(K) === "1"; } catch(e){ return false; } };
  function apply(){ const d = on(); document.body.classList.toggle("simple", !d);
    document.querySelectorAll(".dt-tg").forEach(b => { b.setAttribute("aria-pressed", String(d)); b.textContent = d ? "detay ▴" : "detay ▾"; b.title = d ? "detayları gizle (sade görünüm)" : "detayları göster"; });
    try { window.SGB && SGB.repaint(); } catch(e){} window.dispatchEvent(new Event("detay:change")); }
  function set(v){ try { localStorage.setItem(K, v ? "1" : "0"); } catch(e){} apply(); }
  function add(){ for (const id of PANELS){ const s = document.getElementById(id), h = s && s.querySelector(":scope > h3"); if (!h || h.querySelector(".dt-tg")) continue;
      const b = document.createElement("button"); b.type = "button"; b.className = "dt-tg"; b.onclick = e => { e.preventDefault(); e.stopPropagation(); set(!on()); }; h.appendChild(b); }
    apply(); }
  document.body.classList.toggle("simple", !on()); /* before the panels paint */
  window.DETAY = { on, set, apply };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add); else add();
})();
