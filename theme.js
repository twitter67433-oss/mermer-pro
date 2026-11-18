/* MERMER TERMİNAL v7.19 — Gündüz / Gece / Otomatik theme (design only).
   - nightColor(): maps any day-theme colour to its night (black-marble) twin. The same function builds night.css
     (tools/night-build.js) and recolours every <canvas> at draw time, so charts follow the theme without per-chart code.
   - Loaded in <head> before the stylesheets: applies html.night before first paint (no flash) and sets theme-color. */
(function (root, factory){ const T = factory(); if (typeof module === "object" && module.exports) module.exports = T; else root.THEME = T; })(typeof self !== "undefined" ? self : this, function (){
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function hsl(r, g, b){ r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn)/2, d = mx - mn; let h = 0, s = 0;
    if (d){ s = l > .5 ? d/(2 - mx - mn) : d/(mx + mn); h = mx === r ? (g - b)/d + (g < b ? 6 : 0) : mx === g ? (b - r)/d + 2 : (r - g)/d + 4; h *= 60; } return [h, s, l, d]; }
  function rgb(h, s, l){ const k = n => (n + h/30) % 12, a = s*Math.min(l, 1 - l), f = n => l - a*Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); return [f(0), f(8), f(4)].map(v => Math.round(clamp(v, 0, 1)*255)); }
  /* day colour -> night colour ([r,g,b], alpha multiplier) */
  function mapRGB(r, g, b){
    if (r === 40 && g === 30 && b === 15) return [[0, 0, 0], 1.8];                      // warm soft shadow -> deep shadow
    const [h, s, l, ch] = hsl(r, g, b);
    if (ch >= 0.25 && l > 0.12 && l < 0.88){                                            // jewel accents -> brighter jewels for dark stone
      let L = 0.64, S = clamp(s, 0.45, 0.72);
      if (h >= 70 && h < 170){ L = 0.56; S = 0.55; }                                    // emerald
      else if (h < 15 || h >= 330){ L = 0.68; S = 0.75; }                               // ruby
      else if (h >= 25 && h < 70){ L = 0.64; S = 0.55; }                                // gold
      else if (h >= 170 && h < 260){ L = 0.74; S = 0.5; }                               // navy -> soft sapphire
      return [rgb(h, S, L), 1]; }
    let L;                                                                               // neutrals: ivory <-> black marble
    if (l > 0.85) L = 0.06 + (l - 0.85)*0.5;                                          // page / cards (cards stay a touch lighter than the page)
    else if (l > 0.5) L = 0.42 - (l - 0.5)*0.36;                                        // lines, borders, veins
    else L = 0.93 - l*0.5;                                                               // ink -> ivory
    return [rgb(h, Math.min(s, 0.5)*(L > 0.5 ? 0.5 : 0.28), L), 1];
  }
  const hex2 = v => v.toString(16).padStart(2, "0");
  const cache = new Map();
  function nightColor(str){
    if (typeof str !== "string") return str; const hit = cache.get(str); if (hit !== undefined) return hit; let out = str;
    const t = str.trim(); let m;
    if ((m = t.match(/^#([0-9a-f]{3,8})$/i))){ let x = m[1]; if (x.length < 5) x = x.split("").map(c => c + c).join("");
      if (x.length === 6 || x.length === 8){ const [c, am] = mapRGB(parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)); const a = (x.length === 8 ? parseInt(x.slice(6), 16)/255 : 1)*am;
        out = "#" + c.map(hex2).join("") + (a < 1 ? hex2(Math.round(clamp(a, 0, 1)*255)) : ""); } }
    else if ((m = t.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i))){ const [c, am] = mapRGB(+m[1], +m[2], +m[3]); const a = (m[4] === undefined ? 1 : +m[4])*am;
      out = a < 1 ? `rgba(${c.join(",")},${+clamp(a, 0, 1).toFixed(3)})` : `rgb(${c.join(",")})`; }
    if (cache.size < 4000) cache.set(str, out); return out; }
  /* replace every colour inside a CSS value / text */
  function nightText(s){
    return s.replace(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/gi, c => nightColor(c))
            .replace(/#([0-9a-f]{3,8})\b(?![\w-])/gi, c => nightColor(c))
            .replace(/%23([0-9a-f]{6})\b/gi, (c, x) => "%23" + nightColor("#" + x).slice(1, 7)); }
  const KEY = "mermer.theme", MODES = ["auto", "day", "night"], META = { day: "#efe9dd", night: "#141311" };
  const T = { nightColor, nightText, mapRGB, KEY, MODES, META, mode: "auto", night: false };
  if (typeof document === "undefined") return T;
  /* ---------- browser ---------- */
  const mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  const isNight = m => m === "night" || (m === "auto" && !!(mq && mq.matches));
  function apply(mode, fire){ T.mode = MODES.includes(mode) ? mode : "auto"; T.night = isNight(T.mode); const h = document.documentElement;
    h.classList.toggle("night", T.night); h.dataset.theme = T.mode; h.style.colorScheme = T.night ? "dark" : "light";
    let mt = document.querySelector('meta[name="theme-color"]'); if (!mt){ mt = document.createElement("meta"); mt.name = "theme-color"; (document.head || h).appendChild(mt); }
    mt.content = T.night ? META.night : META.day; const cs = document.querySelector('meta[name="color-scheme"]'); if (cs) cs.content = T.night ? "dark" : "light";
    paintBtn(); if (fire) try { window.dispatchEvent(new CustomEvent("themechange", { detail: { mode: T.mode, night: T.night } })); window.dispatchEvent(new Event("resize")); } catch(e){} }
  let saved = "auto"; try { saved = localStorage.getItem(KEY) || "auto"; } catch(e){}
  T.set = m => { try { localStorage.setItem(KEY, m); } catch(e){} apply(m, true); };
  T.cycle = () => T.set(MODES[(MODES.indexOf(T.mode) + 1) % MODES.length]);
  const LBL = { auto: ["◐", "Otomatik (sistem)"], day: ["☀", "Gündüz"], night: ["☾", "Gece"] };
  function paintBtn(){ const b = document.getElementById("thm"); if (!b) return; const [i, t] = LBL[T.mode]; b.textContent = i; b.title = "Tema: " + t + " — dokun: değiştir"; b.setAttribute("aria-label", "Tema: " + t); }
  /* canvas: recolour at draw time in night mode */
  try { const P = CanvasRenderingContext2D.prototype;
    for (const k of ["fillStyle", "strokeStyle", "shadowColor"]){ const d = Object.getOwnPropertyDescriptor(P, k); if (!d || !d.set) continue;
      Object.defineProperty(P, k, { configurable: true, enumerable: d.enumerable, get(){ return d.get.call(this); }, set(v){ d.set.call(this, T.night && typeof v === "string" ? nightColor(v) : v); } }); }
    const as = CanvasGradient.prototype.addColorStop; CanvasGradient.prototype.addColorStop = function (o, c){ return as.call(this, o, T.night ? nightColor(c) : c); };
  } catch(e){}
  apply(saved, false);
  if (mq) (mq.addEventListener ? mq.addEventListener("change", () => T.mode === "auto" && apply("auto", true)) : mq.addListener(() => T.mode === "auto" && apply("auto", true)));
  document.addEventListener("DOMContentLoaded", () => { const b = document.getElementById("thm"); if (b) b.addEventListener("click", T.cycle); paintBtn(); });
  return T;
});
