window.APP_V = "8.2.1"; /* v8.0: was an inline <script> — moved to a file so the CSP can drop script-src 'unsafe-inline' */
/* v8.0.2 AÇILIŞ KORUMASI — first script in <head>, plain ES5 so even an old Android WebView runs it. Never touches localStorage data.
   1) boot screen (#boot) is removed after 4 s no matter what (slow network, a script that failed, a JS error) → the app can never hang on it.
   2) startup errors / a script or stylesheet that failed to load → a small "YENİLE" bar instead of a frozen screen.
   3) stale copy: version.json (no-store) newer than this file → clear Cache Storage + unregister any service worker + reload once with ?r=
      (sessionStorage guard → at most one automatic reload per version, no loop). */
(function(){
  var W = window, D = document, T0 = Date.now(), CUR = W.APP_V, shown = false;
  function cmp(a, b){ var x = String(a || "0").replace(/^v/, "").split("."), y = String(b || "0").replace(/^v/, "").split("."), i, d;
    for (i = 0; i < Math.max(x.length, y.length); i++){ d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0); if (d) return d > 0 ? 1 : -1; } return 0; }
  function fresh(){ var u = location.href.replace(/([?&])r=\d+&?/, "$1").replace(/[?&]$/, "").split("#")[0]; return u + (u.indexOf("?") < 0 ? "?" : "&") + "r=" + Date.now(); }
  function hard(){ var done = false, go = function(){ if (done) return; done = true; location.replace(fresh()); };
    setTimeout(go, 2500); /* never wait forever on the cleanup */
    var p = [];
    try { if (W.caches && caches.keys) p.push(caches.keys().then(function(ks){ return Promise.all(ks.map(function(k){ return caches.delete(k); })); })); } catch(e){}
    try { if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) p.push(navigator.serviceWorker.getRegistrations().then(function(rs){ return Promise.all(rs.map(function(r){ return r.unregister(); })); })); } catch(e){}
    try { Promise.all(p).then(go, go); } catch(e){ go(); } }
  function killBoot(){ var b = D.getElementById("boot"); if (!b) return; try { b.className += " fade"; } catch(e){} setTimeout(function(){ if (b.parentNode) b.parentNode.removeChild(b); }, 450); }
  function bar(msg){ if (shown) return; shown = true; var put = function(){ if (!D.body){ setTimeout(put, 200); return; } killBoot();
      var d = D.createElement("div"); d.id = "boot-err"; d.setAttribute("role", "alert");
      d.style.cssText = "position:fixed;left:8px;right:8px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:2147483600;display:flex;gap:8px;align-items:center;padding:9px 10px;border-radius:10px;background:#2b2722;color:#f3eee4;font:600 13px/1.3 system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.35)";
      var s = D.createElement("span"); s.style.flex = "1"; s.textContent = "⚠ Uygulama tam yüklenemedi" + (msg ? " (" + msg + ")" : "") + ". Verilerin silinmez.";
      var b = D.createElement("button"); b.type = "button"; b.textContent = "YENİLE"; b.style.cssText = "font:700 13px system-ui,sans-serif;padding:7px 12px;border-radius:8px;border:0;background:#d6b171;color:#1f1e1b";
      b.addEventListener("click", function(){ b.disabled = true; b.textContent = "…"; hard(); });
      var x = D.createElement("button"); x.type = "button"; x.textContent = "✕"; x.setAttribute("aria-label", "kapat"); x.style.cssText = "border:0;background:none;color:#f3eee4;font:700 15px system-ui;padding:4px 6px";
      x.addEventListener("click", function(){ if (d.parentNode) d.parentNode.removeChild(d); });
      d.appendChild(s); d.appendChild(b); d.appendChild(x); D.body.appendChild(d); }; put(); }
  setTimeout(function g(){ killBoot(); if (Date.now() - T0 < 90000) setTimeout(g, 500); }, 4000); /* on a slow network #boot may be parsed only later → keep removing it */
  W.addEventListener("error", function(e){ var t = e && e.target;
    if (t && t !== W && (t.tagName === "SCRIPT" || (t.tagName === "LINK" && /stylesheet/.test(t.rel || "")))){ var u = t.src || t.href || ""; if (u.indexOf(location.host) >= 0) bar((u.split("/").pop() || "").split("?")[0] + " yüklenemedi"); return; }
    if (Date.now() - T0 < 20000 && e && (!e.filename || e.filename.indexOf(location.host) >= 0)) bar("başlangıç hatası"); }, true);
  W.MERMER_BOOT = { killBoot: killBoot, bar: bar, hard: hard, cmp: cmp, fresh: fresh };
  /* stale copy check (cheap, no-store, ~20 bytes) */
  try { if (W.fetch && /^https?:/.test(location.protocol)) fetch("version.json?t=" + Date.now(), { cache: "no-store" }).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
      if (!j || !j.v || cmp(j.v, CUR) <= 0) return; var k = "mermer.autoref", s = null; try { s = sessionStorage.getItem(k); } catch(e){}
      if (s === j.v) return; try { sessionStorage.setItem(k, j.v); } catch(e){} hard(); })["catch"](function(){}); } catch(e){}
})();
