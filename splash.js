/* MERMER TERMİNAL v7.23 — AÇILIŞ UYARISI: a playful retro "Trading Error" dialog shown after the boot screen.
   Pure overlay: engines, alerts and data feeds keep starting underneath. Can be turned off in ⚙ AYARLAR ("açılış uyarısı").
   Keeps its retro (Windows 9x) look in day and night themes: its own scoped style, not part of night.css. */
"use strict";
(() => {
const KEY = "mermer.splash", on = () => { try { return localStorage.getItem(KEY) !== "off"; } catch(e){ return true; } };
const LINES = ["Geri dönüş yok, grafik seni bekliyor 😅", "Hata 0x0DOLAR: geri dönmek stop'a takıldı 😅", "Mum kapanmadan kaçmak yok! 🕯️", "Piyasa açık, cesaretin kapalı mı? 😏", "Tamam tamam… ama yine de BAŞLA'ya bas 😄"];
const SKULL = `<svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#d40000" stroke="#7a0000" stroke-width="2"/><circle cx="32" cy="32" r="30" fill="url(#spg)"/><defs><radialGradient id="spg" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ff6b6b" stop-opacity=".9"/><stop offset=".6" stop-color="#d40000" stop-opacity="0"/></radialGradient></defs>
  <path d="M32 13c-9.4 0-16 6.3-16 14.6 0 5 2.4 8.6 5.6 10.6V44c0 1.6 1.2 2.8 2.8 2.8h1.6v3.6c0 1 .8 1.6 1.6 1.6h1c.9 0 1.6-.7 1.6-1.6v-3.6h3.6v3.6c0 1 .7 1.6 1.6 1.6h1c.9 0 1.6-.7 1.6-1.6v-3.6h1.6c1.6 0 2.8-1.2 2.8-2.8v-5.8c3.2-2 5.6-5.6 5.6-10.6C48 19.3 41.4 13 32 13z" fill="#fff"/>
  <ellipse cx="25.3" cy="29.5" rx="4.6" ry="5.2" fill="#1a0000"/><ellipse cx="38.7" cy="29.5" rx="4.6" ry="5.2" fill="#1a0000"/><path d="M32 35.2l-2.6 5h5.2z" fill="#1a0000"/></svg>`;
const CSS = `#spl{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.42);-webkit-tap-highlight-color:transparent}
#spl .w{width:min(92vw,380px);background:#c0c0c0;color:#000;border:2px solid;border-color:#fff #404040 #404040 #fff;box-shadow:inset -1px -1px #808080,inset 1px 1px #dfdfdf,6px 8px 0 rgba(0,0,0,.35);font:13px/1.35 Tahoma,"MS Sans Serif",Verdana,"Segoe UI",sans-serif;animation:splIn .22s ease-out;padding:3px}
#spl .t{display:flex;align-items:center;justify-content:space-between;height:26px;padding:0 3px 0 7px;background:linear-gradient(90deg,#000080,#1084d0);color:#fff;font:700 13px Tahoma,Verdana,sans-serif;letter-spacing:.2px;user-select:none}
#spl .x{all:unset;box-sizing:border-box;width:22px;height:20px;display:flex;align-items:center;justify-content:center;background:#c0c0c0;color:#000;font:700 13px/1 Tahoma,Verdana,sans-serif;border:2px solid;border-color:#fff #404040 #404040 #fff;cursor:pointer}
#spl .b{display:flex;gap:14px;align-items:flex-start;padding:18px 14px 10px}
#spl .b svg{flex:0 0 auto;filter:drop-shadow(1px 2px 0 rgba(0,0,0,.25))}
#spl h2{all:unset;display:block;font:900 17px/1.2 Tahoma,Verdana,sans-serif;color:#000;margin:2px 0 8px;letter-spacing:.2px}
#spl p{all:unset;display:block;font:13px/1.4 Tahoma,Verdana,sans-serif;color:#000;margin:0 0 6px}
#spl .j{min-height:18px;font:700 12.5px/1.35 Tahoma,Verdana,sans-serif;color:#a00000;padding:0 14px 4px 72px}
#spl .k{display:flex;justify-content:center;gap:12px;padding:8px 10px 12px}
#spl .k button{all:unset;box-sizing:border-box;min-width:112px;padding:7px 12px;text-align:center;background:#c0c0c0;color:#000;font:700 13px Tahoma,Verdana,sans-serif;border:2px solid;border-color:#fff #404040 #404040 #fff;box-shadow:inset -1px -1px #808080,inset 1px 1px #dfdfdf;cursor:pointer;transition:transform .25s}
#spl button:active{border-color:#404040 #fff #fff #404040!important;box-shadow:inset 1px 1px #808080!important}
#spl button:focus-visible{outline:1px dotted #000;outline-offset:-5px}
#spl .k .spl-go{outline:1px solid #000;outline-offset:0}
#spl .k .spl-go:focus-visible{outline:1px dotted #000;outline-offset:-5px;box-shadow:inset -1px -1px #808080,inset 1px 1px #dfdfdf,0 0 0 1px #000}
#spl.shake .w{animation:splShake .45s}
#spl.bye{animation:splFade .28s forwards}#spl.bye .w{animation:splPop .28s forwards}
@keyframes splIn{from{transform:scale(.85);opacity:0}to{transform:none;opacity:1}}
@keyframes splShake{0%,100%{transform:none}15%{transform:translateX(-10px) rotate(-1deg)}30%{transform:translateX(9px) rotate(1deg)}45%{transform:translateX(-7px)}60%{transform:translateX(6px)}75%{transform:translateX(-3px)}}
@keyframes splPop{0%{transform:none}35%{transform:scale(1.06)}100%{transform:scale(.2);opacity:0}}
@keyframes splFade{to{background:rgba(0,0,0,0)}}
@media (prefers-reduced-motion:reduce){#spl .w,#spl.shake .w,#spl.bye .w{animation:none}#spl .k button{transition:none}}`;
let ac = null;
function ding(){ /* synthesized retro error chord, only ever after a tap */ try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const t = ac.currentTime;
  [[880, 0], [659.25, .11]].forEach(([f, d]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = "triangle"; o.frequency.value = f; g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(.14, t + d + .01); g.gain.exponentialRampToValueAtTime(.001, t + d + .35); o.connect(g).connect(ac.destination); o.start(t + d); o.stop(t + d + .4); }); } catch(e){} }
function show(){ if (document.getElementById("spl")) return; if (!document.getElementById("spl-css")){ const s = document.createElement("style"); s.id = "spl-css"; s.textContent = CSS; document.head.appendChild(s); }
  const prev = document.activeElement, el = document.createElement("div"); el.id = "spl"; el.setAttribute("role", "alertdialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "spl-h"); el.setAttribute("aria-describedby", "spl-d");
  el.innerHTML = `<div class="w"><div class="t"><span>Trading Error</span><button type="button" class="x" aria-label="Kapat">✕</button></div>
    <div class="b">${SKULL}<div><h2 id="spl-h">TRADING'E HOŞ GELDİNİZ</h2><div id="spl-d"><p>Hatanın mazeretle değil dolarla bedelini ödediğin yer.</p><p>Başlamaya hazır mısın?</p></div></div></div>
    <div class="j" aria-live="assertive"></div><div class="k"><button type="button" class="spl-no">GERİ DÖN</button><button type="button" class="spl-go">BAŞLA</button></div></div>`;
  document.body.appendChild(el); const go = el.querySelector(".spl-go"), no = el.querySelector(".spl-no"), x = el.querySelector(".x"), j = el.querySelector(".j"); let n = 0, dodged = false;
  const joke = () => { ding(); j.textContent = LINES[Math.min(n, LINES.length - 1)]; n++; el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
    if (!dodged){ dodged = true; no.style.transform = "translate(" + (Math.random() < .5 ? -1 : 1)*18 + "px,-14px) rotate(-4deg)"; setTimeout(() => { no.style.transform = ""; }, 700); } go.focus(); };
  const close = () => { if (el.classList.contains("bye")) return; el.classList.add("bye"); setTimeout(() => { el.remove(); try { (prev && prev.focus && prev !== document.body ? prev : document.body).focus(); } catch(e){} }, matchMedia("(prefers-reduced-motion:reduce)").matches ? 0 : 290); };
  go.onclick = close; no.onclick = joke; x.onclick = close; /* v8.0.2: ✕ closes; and the dialog closes by itself after 4 s — it can never block the app */
  setTimeout(close, 4000);
  el.addEventListener("keydown", e => { if (e.key === "Escape"){ e.preventDefault(); joke(); return; } if (e.key === "Tab"){ const f = [x, no, go], i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } });
  setTimeout(() => go.focus(), 30); }
function whenBooted(cb){ const t0 = Date.now(); (function w(){ if (!document.getElementById("boot") || Date.now() - t0 > 5000) cb(); else setTimeout(w, 120); })(); }
const qs = new URLSearchParams(location.search); if (on() && !qs.get("nosplash")) whenBooted(show);
/* ⚙ AYARLAR toggle */
function bindSetting(){ const c = document.getElementById("set-splash"); if (!c) return; c.checked = on(); c.onchange = () => { try { localStorage.setItem(KEY, c.checked ? "on" : "off"); } catch(e){} }; }
document.addEventListener("click", e => { if (e.target.closest && e.target.closest("#gear")) setTimeout(bindSetting, 0); }, true); bindSetting();
window.SPLASH = { show, on };
})();
