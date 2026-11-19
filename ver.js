/* v7.30.1 — sürüm kontrolü: her açılışta + 5 dk'da bir version.json (no-store). Daha yeni sürüm varsa "YENİ SÜRÜM — YENİLE";
   dokununca önbellekler temizlenir, service worker (varsa) kaldırılır, sayfa önbelleği atlayan bir adresle yeniden yüklenir. Emir/anahtar yok. */
(function(root, f){ const X = f(); if (typeof module === "object" && module.exports) module.exports = X; else root.VER = X; })(typeof self !== "undefined" ? self : this, function(){
  function cmp(a, b){ const p = s => String(s || "0").replace(/^v/, "").split(".").map(n => parseInt(n, 10) || 0); const x = p(a), y = p(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++){ const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; } return 0; }
  function freshUrl(href, ts){ const u = new URL(href); u.searchParams.set("r", String(ts)); u.hash = ""; return u.toString(); }
  return { cmp, freshUrl };
});
(function(){ if (typeof window === "undefined" || typeof document === "undefined") return;
  const W = window, CUR = W.APP_V || "0", X = W.VER; let shown = null;
  async function hardReload(){
    try { if (W.caches && caches.keys) for (const k of await caches.keys()) await caches.delete(k); } catch(e){}
    try { if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch(e){}
    location.replace(X.freshUrl(location.href, Date.now())); }
  function banner(v){ if (shown === v) return; shown = v; let b = document.getElementById("ver-new");
    if (!b){ b = document.createElement("button"); b.id = "ver-new"; b.type = "button"; b.addEventListener("click", hardReload); document.body.appendChild(b); }
    b.textContent = `YENİ SÜRÜM v${v} — YENİLE`; }
  async function check(){ try { const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" }); if (!r.ok) return; const j = await r.json();
      if (j && j.v && X.cmp(j.v, CUR) > 0) banner(j.v); } catch(e){} }
  function start(){ const s = document.getElementById("ver"); if (s) s.textContent = "v" + CUR; check(); setInterval(check, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); }); /* yalnızca kontrol — hiçbir akış durdurulmaz */ }
  W.VER.check = check; W.VER.hardReload = hardReload;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
