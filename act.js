/* MERMER TERMİNAL v8.0 — CSP helper: no inline scripts / inline event handlers anywhere (script-src 'self', no 'unsafe-inline').
   Generated HTML uses data attributes instead; this file wires them with delegated listeners:
   data-act="<name>" [data-arg="…"] on click · <form data-nosubmit> · <img data-onerr="remove|pumpbad">. Signal / order logic is not touched here. */
"use strict";
(function (){
  const ACT = {
    "wallet-render": () => window.WALLET && WALLET.render && WALLET.render(),
    "conn-open": a => window.CONN && CONN.open && CONN.open(a),
    "nav": a => window.NAV && NAV.go && NAV.go(a),
    "meme-endpause": () => window.MEME && MEME.endPause && MEME.endPause() };
  document.addEventListener("click", e => { const el = e.target && e.target.closest && e.target.closest("[data-act]"); if (!el) return; const f = ACT[el.dataset.act]; if (!f) return;
    if (el.tagName === "A") e.preventDefault(); try { f(el.dataset.arg); } catch(x){} });
  document.addEventListener("submit", e => { if (e.target && e.target.hasAttribute && e.target.hasAttribute("data-nosubmit")) e.preventDefault(); }, true);
  /* image errors do not bubble → capture phase */
  document.addEventListener("error", e => { const el = e.target; if (!el || el.tagName !== "IMG" || !el.dataset || !el.dataset.onerr) return;
    if (el.dataset.onerr === "pumpbad" && window.PUMP && PUMP.badImg) PUMP.badImg(el); else el.remove(); }, true);
  window.ACT = ACT;
})();
