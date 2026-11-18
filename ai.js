/* NEON//TERMINAL v7.16 — AI asistan (any provider). Replaces the xAI-only GROK tab.
   • OpenAI-compatible /chat/completions for Groq, OpenRouter (":free" models), Google Gemini (OpenAI endpoint), Cerebras, DeepSeek, Mistral, Together,
     OpenAI, xAI, local Ollama / LM Studio, or "Özel" (any base URL + model). Anthropic via its native /v1/messages format.
   • The user's API key(s) live ONLY in this device's localStorage (neon.ai.cfg) and are sent ONLY to the chosen provider's base URL. Nothing is in the repo.
   • Old xAI key (neon.xai.key) is migrated as provider "xai" so nothing breaks.
   • The AI NEVER trades. It answers and proposes ```neon {"actions":[…]}``` suggestions the user applies with a tap; buys/sells still open the ONAYLA sheet.
     Optional "AI onayı" gate can only say yes/no before an auto buy (timeout → rule fallback). This rule is unchanged from v6.
   • In the Android app, if the browser request fails for CORS/network reasons, the call is retried once through Capacitor's native HTTP (no streaming). */
"use strict";
(function (root, factory){ const M = factory(); if (typeof module === "object" && module.exports) module.exports = M; else { root.AIP = M; } })(typeof self !== "undefined" ? self : this, function (){
const PRESETS = {
  groq:       { n: "Groq (ücretsiz katman)",      base: "https://api.groq.com/openai/v1",                       model: "llama-3.3-70b-versatile",            gmodel: "llama-3.1-8b-instant",        keyUrl: "console.groq.com/keys", free: true },
  openrouter: { n: "OpenRouter (:free modeller)",  base: "https://openrouter.ai/api/v1",                         model: "google/gemma-4-31b-it:free",         gmodel: "google/gemma-4-26b-a4b-it:free", keyUrl: "openrouter.ai/keys", free: true },
  gemini:     { n: "Google Gemini (ücretsiz katman)", base: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash",             gmodel: "gemini-2.5-flash-lite",       keyUrl: "aistudio.google.com/apikey", free: true },
  cerebras:   { n: "Cerebras (ücretsiz katman)",   base: "https://api.cerebras.ai/v1",                           model: "llama-3.3-70b",                      gmodel: "llama3.1-8b",                 keyUrl: "cloud.cerebras.ai", free: true },
  mistral:    { n: "Mistral (ücretsiz deneme katmanı)", base: "https://api.mistral.ai/v1",                      model: "mistral-small-latest",               gmodel: "mistral-small-latest",        keyUrl: "console.mistral.ai/api-keys", free: true },
  deepseek:   { n: "DeepSeek",                     base: "https://api.deepseek.com/v1",                          model: "deepseek-chat",                      gmodel: "deepseek-chat",               keyUrl: "platform.deepseek.com/api_keys" },
  together:   { n: "Together AI",                  base: "https://api.together.xyz/v1",                          model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", gmodel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", keyUrl: "api.together.ai/settings/api-keys" },
  openai:     { n: "OpenAI",                       base: "https://api.openai.com/v1",                            model: "gpt-4.1-mini",                       gmodel: "gpt-4.1-nano",                keyUrl: "platform.openai.com/api-keys" },
  xai:        { n: "xAI (Grok)",                   base: "https://api.x.ai/v1",                                  model: "grok-4.7",                           gmodel: "grok-4.20-0309-non-reasoning", keyUrl: "console.x.ai" },
  anthropic:  { n: "Anthropic (Claude)",           base: "https://api.anthropic.com/v1",                         model: "claude-haiku-4-5",                   gmodel: "claude-haiku-4-5",            keyUrl: "console.anthropic.com", kind: "anthropic" },
  ollama:     { n: "Ollama (yerel)",               base: "http://localhost:11434/v1",                            model: "llama3.2",                           gmodel: "llama3.2",                    noKey: true, local: true },
  lmstudio:   { n: "LM Studio (yerel)",            base: "http://localhost:1234/v1",                             model: "local-model",                        gmodel: "local-model",                 noKey: true, local: true },
  custom:     { n: "Özel (OpenAI uyumlu)",         base: "",                                                     model: "",                                   gmodel: "",                            custom: true } };
const ORDER = ["groq", "openrouter", "gemini", "cerebras", "mistral", "deepseek", "together", "openai", "xai", "anthropic", "ollama", "lmstudio", "custom"];
const CK = "neon.ai.cfg";
/* load config; migrate the old xAI-only settings once */
function load(ls){ let c = null; try { c = JSON.parse(ls.getItem(CK) || "null"); } catch(e){}
  if (!c || typeof c !== "object"){ c = { prov: "groq", keys: {}, models: {}, gmodels: {}, bases: {} };
    const k = ls.getItem("neon.xai.key"); if (k){ c.prov = "xai"; c.keys.xai = k; const m = ls.getItem("neon.xai.model"), g = ls.getItem("neon.xai.gmodel"); if (m) c.models.xai = m; if (g) c.gmodels.xai = g; c.migrated = "xai"; }
    try { ls.setItem(CK, JSON.stringify(c)); } catch(e){} }
  for (const f of ["keys", "models", "gmodels", "bases"]) if (!c[f] || typeof c[f] !== "object") c[f] = {}; if (!PRESETS[c.prov]) c.prov = "groq"; return c; }
const save = (ls, c) => { try { ls.setItem(CK, JSON.stringify(c)); } catch(e){} };
/* effective settings for the current provider */
function eff(c, prov){ const p = prov || c.prov, P = PRESETS[p] || PRESETS.custom; return { prov: p, P, kind: P.kind || "openai", base: String(c.bases[p] || P.base || "").trim().replace(/\/+$/, ""),
  key: c.keys[p] || "", model: c.models[p] || P.model, gmodel: c.gmodels[p] || P.gmodel || c.models[p] || P.model }; }
const ready = e => !!(e.base && e.model && (e.key || e.P.noKey || (e.P.custom && /localhost|127\.0\.0\.1/.test(e.base))));
/* build one HTTP request. msgs = [{role, content}] (system messages allowed anywhere). Only the headers each API needs (Gemini's CORS allows just authorization + content-type). */
function buildReq(e, msgs, o = {}){ const model = o.model || e.model;
  if (e.kind === "anthropic"){ const sys = msgs.filter(m => m.role === "system").map(m => m.content).join("\n\n"), conv = msgs.filter(m => m.role !== "system").map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
    const body = { model, max_tokens: o.max_tokens || 1500, messages: conv.length ? conv : [{ role: "user", content: "." }], stream: !!o.stream }; if (sys) body.system = sys; if (o.temperature !== undefined) body.temperature = o.temperature;
    return { url: e.base + "/messages", headers: { "content-type": "application/json", "x-api-key": e.key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body }; }
  const body = { model, messages: msgs, stream: !!o.stream }; if (o.max_tokens) body.max_tokens = o.max_tokens; if (o.temperature !== undefined) body.temperature = o.temperature;
  const h = { "content-type": "application/json" }; if (e.key) h.authorization = "Bearer " + e.key; return { url: e.base + "/chat/completions", headers: h, body }; }
function modelsReq(e){ return e.kind === "anthropic" ? { url: e.base + "/models", headers: { "x-api-key": e.key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" } } : { url: e.base + "/models", headers: e.key ? { authorization: "Bearer " + e.key } : {} }; }
/* streaming: one SSE "data:" payload → text delta */
function sseDelta(kind, d){ try { const j = JSON.parse(d); if (kind === "anthropic") return j.type === "content_block_delta" && j.delta && j.delta.text || "";
  const c = j.choices && j.choices[0]; return c && (c.delta && c.delta.content || c.message && c.message.content) || ""; } catch(e){ return ""; } }
function fullText(kind, j){ if (!j) return ""; if (kind === "anthropic") return (j.content || []).filter(x => x.type === "text").map(x => x.text).join("");
  const c = j.choices && j.choices[0]; return c && c.message && (typeof c.message.content === "string" ? c.message.content : Array.isArray(c.message.content) ? c.message.content.map(x => x.text || "").join("") : "") || ""; }
function errText(e, status, m){ const n = e.P.n; m = String(m || "").slice(0, 160);
  return status === 401 || status === 403 || /api.?key|unauthori[sz]ed|invalid.*key/i.test(m) ? `${n}: anahtar geçersiz ya da yetkisiz (${status})${e.P.keyUrl ? " — " + e.P.keyUrl : ""}`
    : status === 429 ? `${n}: kullanım/ücretsiz kota sınırı (429) — biraz bekle ya da başka sağlayıcı seç` : status === 404 ? `${n}: model ya da adres bulunamadı (404) — model adını kontrol et` : status === 402 ? `${n}: bakiye yok (402)` : `${n} HTTP ${status}${m ? ": " + m : ""}`; }
const modelIds = (kind, j) => ((j && (j.data || j.models)) || []).map(m => m.id || m.name || "").map(s => s.replace(/^models\//, "")).filter(Boolean);
return { PRESETS, ORDER, CK, load, save, eff, ready, buildReq, modelsReq, sseDelta, fullText, errText, modelIds };
});
/* ---------------- browser UI (AI tab) ---------------- */
if (typeof window !== "undefined" && typeof document !== "undefined") (function(){
const A = window.AIP, $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let C = A.load(localStorage), E = A.eff(C), H = (() => { try { return JSON.parse(sessionStorage.getItem("neon.xai.hist") || "[]"); } catch(e){ return []; } })(), busy = false, ctrl = null, extra = [];
const hSave = () => sessionStorage.setItem("neon.xai.hist", JSON.stringify(H.slice(-30))), refresh = () => { E = A.eff(C); }, persist = () => { A.save(localStorage, C); refresh(); };
const SYS = () => `Sen MERMER AI'sın: MERMER TERMİNAL adlı, telefonda çalışan bir pump.fun meme-coin işlem platformunun içindeki yardımcısın. Kullanıcı Onur, Türkçe konuş, kısa ve net ol.
Platform: SIM (sanal para, canlı veri) ve GERÇEK (BOT CÜZDANI) modları; ajanlar: İZLEYİCİ (yeni token filtreleri), KOPYACI (takip edilen cüzdanların pump.fun alımlarını kopyalar), YÜRÜTÜCÜ (PumpPortal trade-local + paralel RPC), RİSK (kayıp sonrası yarım boyut, 2 kayıp üst üste = ara, boyutu yalnızca yeni zirvede büyüt, günlük max zarar).
KURALLAR: Asla işlem yaptığını söyleme — işlem YAPAMAZSIN. Öneri sunmak istersen cevabının sonuna tek bir blok ekle:
\`\`\`neon
{"actions":[{"type":"set","key":"tp","value":60,"why":"..."}]}
\`\`\`
İzinli türler: set (key: base,maxTrade,budget,dailyLoss,maxPos,tp,sl,trail,holdMin,slip,prio,w.minInit,w.minMcap,w.maxMcap,w.maxDev,w.maxRisk,w.waitSec,w.minMom,w.needSoc,w.on,cp.on,cp.minSrc,cp.maxMcap,cp.cool,cp.max10,cp.follow,rules.half,rules.pause2,rules.pauseMin,rules.upHigh,gk.gate), buy {mint,sol,why}, sell {mint,why}, track {wallet,label,why}, untrack {wallet}, pause {min,why}, stop {why}. Kullanıcı her birini ayrıca onaylar; alım/satım için ayrıca ONAYLA ekranı açılır.
Riskleri dürüstçe söyle: pump.fun tokenlarının çoğu sıfıra gider; kâr garantisi yok; yatırım tavsiyesi verme, olasılık ve risk yönetimi açısından konuş. Verilen bağlam JSON'u gerçek zamanlı uygulama durumudur; onun dışında güncel piyasa bilgin yok.`;
const nativeHttp = () => { const Cp = window.Capacitor; return window.NEON_NATIVE && Cp && Cp.Plugins && Cp.Plugins.CapacitorHttp ? Cp.Plugins.CapacitorHttp : null; };
/* POST JSON; returns { stream: Response|null, json, status }. Browser fetch first (streams); in the app, a CORS/network failure is retried once via native HTTP (no stream). */
async function post(req, signal){ let r;
  try { r = await fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal }); }
  catch(e){ const N = nativeHttp(); if (e.name === "AbortError" || !N) throw new Error(e.name === "AbortError" ? "iptal / zaman aşımı" : `ağ/CORS hatası: ${E.P.n} tarayıcıdan erişilemedi${E.P.local ? " (yerel sunucuda CORS/OLLAMA_ORIGINS izni gerekli)" : ""}`);
    const nb = { ...req.body, stream: false }, x = await N.request({ url: req.url, method: "POST", headers: req.headers, data: nb, responseType: "json" }); let j = x.data; if (typeof j === "string") try { j = JSON.parse(j); } catch(_){}
    if (x.status >= 400){ throw new Error(A.errText(E, x.status, j && j.error && (j.error.message || j.error))); } return { json: j, native: true }; }
  if (!r.ok){ let m = ""; try { let j = await r.json(); if (Array.isArray(j)) j = j[0] || {}; m = j.error && (j.error.message || j.error) || j.message || ""; } catch(e){} throw new Error(A.errText(E, r.status, typeof m === "string" ? m : JSON.stringify(m))); }
  return { res: r }; }
async function chat(msgs, o = {}, signal){ const req = A.buildReq(E, msgs, o), p = await post(req, signal);
  if (p.json) return { text: A.fullText(E.kind, p.json), native: true };
  if (!o.stream) return { text: A.fullText(E.kind, await p.res.json()) };
  return { res: p.res }; }
function ctxMsg(){ let c = {}; try { c = window.MEME ? MEME.context() : {}; } catch(e){ c = { err: e.message }; }
  /* v7.22: read-only signal badges as advisory context (no order functions are given to the AI) */ try { if (window.SGB){ const g = SGB.snapshot(); if (g.length) c = { ...c, sinyal_rozetleri: { not: "yalnızca bilgi; GİR = kanıtlı kurulum, BEKLE = bekle; DEX kaynaklılar düşük güven; emir/işlem yok", liste: g } }; } } catch(e){}
  return { role: "system", content: "UYGULAMA DURUMU (JSON):\n" + JSON.stringify(c) }; }
async function ask(text){ if (!A.ready(E)){ addMsg("sys", `Önce aşağıdaki ⚙ AI SAĞLAYICI bölümünden sağlayıcı seç ve API anahtarını gir${E.P.keyUrl ? " (" + E.P.keyUrl + ")" : ""}.`); return; } if (busy) return; busy = true; paintBusy();
  H.push({ role: "user", content: text }); hSave(); paintMsgs(); const a = { role: "assistant", content: "" }; H.push(a); window.BUS && BUS.emit("grok");
  const t0 = performance.now(); ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 90000);
  try { const r = await chat([{ role: "system", content: SYS() }, ctxMsg(), ...H.slice(-14, -1).map(m => ({ role: m.role === "sys" ? "system" : m.role, content: m.content }))], { stream: true, max_tokens: 1500 }, ctrl.signal);
    if (r.res && r.res.body){ const rd = r.res.body.getReader(), dec = new TextDecoder(); let buf = "", first = null;
      for (;;){ const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i;
        while ((i = buf.indexOf("\n")) >= 0){ const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line.startsWith("data:")) continue; const d = line.slice(5).trim(); if (d === "[DONE]") continue;
          const c = A.sseDelta(E.kind, d); if (c){ if (first === null) first = performance.now() - t0; a.content += c; paintLast(); } } }
      a.first = first && Math.round(first); } else a.content = r.text || "";
    a.ms = Math.round(performance.now() - t0); a.model = E.model; a.prov = E.P.n; if (!a.content) a.content = "(boş cevap)"; }
  catch(e){ a.content = (a.content ? a.content + "\n\n" : "") + "✖ " + (e.name === "AbortError" ? "iptal / zaman aşımı" : e.message); a.err = true; }
  clearTimeout(to); busy = false; ctrl = null; hSave(); paintMsgs(); paintBusy(); }
/* yes/no gate before an auto buy (fast model, strict timeout). It can only block a buy, never start one. */
async function gate(info, timeout = 2500){ if (!A.ready(E)) return { error: "AI ayarlı değil" }; const t0 = performance.now(), ac = new AbortController(), to = setTimeout(() => ac.abort(), timeout);
  try { const r = await chat([{ role: "system", content: "pump.fun yeni token risk kapısısın. Yalnızca JSON döndür: {\"ok\":true|false,\"why\":\"en fazla 8 kelime Türkçe\"}. Rug riski yüksek, sosyal hesabı olmayan, geliştirici payı yüksek ya da isim kopyası tokenlara hayır de." }, { role: "user", content: JSON.stringify(info) }], { model: E.gmodel, temperature: 0, max_tokens: 80 }, ac.signal);
    const m = /\{[\s\S]*\}/.exec(r.text || ""); let o = null; try { o = m ? JSON.parse(m[0]) : null; } catch(e){}
    if (!o || typeof o.ok !== "boolean") return { error: "anlaşılmayan cevap", ms: performance.now() - t0 };
    return { ok: o.ok, why: String(o.why || "").slice(0, 80), ms: performance.now() - t0 }; }
  catch(e){ return e.name === "AbortError" || /iptal|zaman/.test(e.message) ? { timeout: true, error: "zaman aşımı " + timeout + " ms", ms: performance.now() - t0 } : { error: e.message, ms: performance.now() - t0 }; }
  finally { clearTimeout(to); } }
/* connection test: list models (if the API has /models) + a tiny real chat call with the chosen model */
async function test(){ const el = $("#gk-res"); el.textContent = "test ediliyor…"; const t0 = performance.now(); let list = [], note = "";
  try { const q = A.modelsReq(E); const r = await fetch(q.url, { headers: q.headers }); if (r.ok){ list = A.modelIds(E.kind, await r.json()); } else note = ` (model listesi: HTTP ${r.status})`; } catch(e){ note = " (model listesi alınamadı)"; }
  try { const r = await chat([{ role: "user", content: "Sadece 'tamam' yaz." }], { max_tokens: 16, temperature: 0 });
    const ms = Math.round(performance.now() - t0), fr = list.filter(x => /:free$/.test(x)); extra = (E.prov === "openrouter" && fr.length ? fr : list).filter(x => !/embed|whisper|tts|image|imagine|video|audio|moderation|guard|rerank/i.test(x)).slice(0, 60);
    el.innerHTML = `✔ bağlantı tamam · ${esc(E.P.n)} · <b>${esc(E.model)}</b> cevap verdi: “${esc((r.text || "").trim().slice(0, 40))}” · ${ms} ms${r.native ? " · uygulama yerel HTTP" : ""}${note}${extra.length ? `<br><small>${extra.length} model${E.prov === "openrouter" ? " (ücretsiz)" : ""}: ${esc(extra.slice(0, 25).join(", "))}${extra.length > 25 ? "…" : ""}</small>` : ""}`;
    setTimeout(render, 4000); }
  catch(e){ el.textContent = "✖ " + e.message + note; } }
/* ---------------- UI ---------------- */
function parseActs(txt){ const m = /```neon\s*([\s\S]*?)```/.exec(txt); if (!m) return null; try { const j = JSON.parse(m[1]); return Array.isArray(j.actions) ? j.actions.slice(0, 6) : null; } catch(e){ return null; } }
function md(t){ let s = esc(t.replace(/```neon[\s\S]*?(```|$)/, "").trim()); s = s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/^\s*[-•]\s+/gm, "• ").replace(/\n/g, "<br>"); return s; }
const actTxt = a => a.type === "set" ? `AYAR: ${a.key} → ${a.value}` : a.type === "buy" ? `AL: ${String(a.mint || "").slice(0, 6)}… ${a.sol || ""} SOL` : a.type === "sell" ? `SAT: ${String(a.mint || "").slice(0, 6)}…` : a.type === "track" ? `TAKİP: ${String(a.wallet || "").slice(0, 6)}… ${a.label || ""}` : a.type === "untrack" ? `TAKİPTEN ÇIK: ${String(a.wallet || "").slice(0, 6)}…` : a.type === "pause" ? `ARA: ${a.min} dk` : a.type === "stop" ? "OTO'YU DURDUR" : a.type;
function msgHTML(m, i){ if (m.role === "sys") return `<div class="gm sys">${esc(m.content)}</div>`; if (m.role === "user") return `<div class="gm u">${esc(m.content)}</div>`;
  const acts = parseActs(m.content);
  return `<div class="gm a ${m.err ? "err" : ""}"><div class="gm-h">AI${m.prov ? " · " + esc(m.prov) : ""}${m.model ? " · " + esc(m.model) : ""}${m.ms ? ` · ${(m.ms/1000).toFixed(1)} sn${m.first ? " (ilk token " + m.first + " ms)" : ""}` : ""}</div><div class="gm-t" data-i="${i}">${md(m.content) || '<span class="dots3"><i></i><i></i><i></i></span>'}</div>
    ${acts ? `<div class="gm-acts">${acts.map((a, k) => `<div class="gact"><div><b>${esc(actTxt(a))}</b>${a.why ? `<small>${esc(a.why)}</small>` : ""}</div><button type="button" class="mini" data-ap="${i}:${k}" ${a._done ? "disabled" : ""}>${a._done ? esc(a._done) : a.type === "buy" || a.type === "sell" ? "ONAYA GÖNDER" : "UYGULA"}</button></div>`).join("")}</div>` : ""}</div>`; }
function paintMsgs(){ const el = $("#gk-msgs"); if (!el) return; el.innerHTML = H.length ? H.map(msgHTML).join("") : `<div class="gm sys">AI hazır (${esc(E.P.n)}). Durumu, pozisyonları, ajanları ve son işlemleri görür; ayar ve işlem <b>önerir</b>, ama işlemi sen onaylarsın.</div>`;
  el.querySelectorAll("[data-ap]").forEach(b => b.onclick = () => { const [i, k] = b.dataset.ap.split(":").map(Number), acts = parseActs(H[i].content); if (!acts) return; const a = acts[k];
    const res = window.MEME ? MEME.applySuggestion(a) : "✖ motor yok"; NOTIFY.toast(res, /^✖/.test(res) ? "bad" : "good"); b.textContent = res.slice(0, 26); b.disabled = true; });
  el.scrollTop = el.scrollHeight; }
let plQ = false; function paintLast(){ if (plQ) return; plQ = true; requestAnimationFrame(() => { plQ = false; const el = $("#gk-msgs"); if (!el) return; const i = H.length - 1, n = el.querySelector(`[data-i="${i}"]`); if (n){ n.innerHTML = md(H[i].content); el.scrollTop = el.scrollHeight; } else paintMsgs(); }); }
function paintBusy(){ const b = $("#gk-send"); if (b){ b.textContent = busy ? "■" : "GÖNDER"; b.classList.toggle("busy", busy); } }
function addMsg(role, content){ H.push({ role, content }); hSave(); paintMsgs(); }
function html(){ const P = E.P, ok = A.ready(E), dl = [...new Set([E.model, P.model].concat(extra))].filter(Boolean);
  return `<div class="gk-top"><span class="mode-badge ${ok ? "sim" : ""}">${ok ? "● " + esc(P.n) : "○ AI AYARLI DEĞİL"}</span><small class="dim">${esc(E.model || "")}</small></div>
  <div id="gk-msgs" class="gk-msgs" aria-live="polite"></div>
  <div class="gk-chips">${["Durumu özetle", "Neden kaybediyorum?", "Filtreleri iyileştir", "Seçili tokenı yorumla", "Takip ettiğim cüzdanlar nasıl?", "Risk ayarlarım mantıklı mı?"].map(c => `<button type="button" class="chip" data-q="${esc(c)}">${esc(c)}</button>`).join("")}</div>
  <form id="gk-form" class="gk-form" autocomplete="off"><textarea id="gk-in" rows="2" placeholder="AI'ya sor… (ör. bugünkü işlemlerimi değerlendir)" enterkeyhint="send"></textarea><button type="submit" id="gk-send" class="go">GÖNDER</button></form>
  <div class="f2"><button type="button" id="gk-clr" class="mini wide">SOHBETİ TEMİZLE</button><button type="button" id="gk-ctx" class="mini wide">AI'NIN GÖRDÜĞÜ BAĞLAM</button></div><pre id="gk-ctxv" class="gk-ctxv hidden"></pre>
  <details class="keys" ${ok ? "" : "open"}><summary>⚙ AI SAĞLAYICI · model · API anahtarı</summary>
    <label>Sağlayıcı<select id="ai-prov">${A.ORDER.map(k => `<option value="${k}" ${k === E.prov ? "selected" : ""}>${esc(A.PRESETS[k].n)}${C.keys[k] ? " ✓" : ""}</option>`).join("")}</select></label>
    <label>Adres (base URL)<input id="ai-base" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(E.base)}" placeholder="https://…/v1"></label>
    <label>Model<input id="ai-model" list="ai-ml" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(E.model)}" placeholder="model adı"></label>
    <label>Hızlı model (AI onayı kapısı)<input id="ai-gmodel" list="ai-ml" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(E.gmodel)}"></label><datalist id="ai-ml">${dl.map(m => `<option value="${esc(m)}">`).join("")}</datalist>
    ${P.noKey ? `<div class="plan-foot">Yerel sunucu: anahtar gerekmez. Telefondan erişim için sunucunun ağda açık ve CORS'a izinli olması gerekir (Ollama: OLLAMA_ORIGINS=*).</div>` : `<label>API anahtarı<input id="gk-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${C.keys[E.prov] ? "•••••• kayıtlı (değiştirmek için yaz)" : "anahtarı yapıştır"}"></label>`}
    <div class="sheet-btns"><button type="button" id="gk-del">ANAHTARI SİL</button><button type="button" id="gk-test">BAĞLANTIYI TEST ET</button><button type="button" class="save" id="gk-save">KAYDET</button></div><div id="gk-res" class="kc-res"></div>
    <div class="plan-foot">${P.keyUrl ? `Anahtar: <b>${esc(P.keyUrl)}</b>. ` : ""}${P.free ? "Bu sağlayıcının ücretsiz katmanı var (kota/hız sınırlı). " : ""}Anahtarlar <b>yalnızca bu cihazda</b> (localStorage) saklanır ve yalnızca seçili sağlayıcının adresine gönderilir; GitHub'daki kodda yoktur. Her sağlayıcının anahtarı ayrı saklanır.</div></details>
  <div class="plan-foot">AI işlem yapamaz: önerileri sen <b>UYGULA</b>'ya basarak uygularsın; alım/satım önerileri ayrıca ONAYLA ekranı açar. "AI onayı" (MEME → ayarlar) açıksa her oto alımdan önce hızlı model evet/hayır der; zaman aşımında kurala göre devam edilir.</div>`; }
function readForm(){ const p = E.prov, b = $("#ai-base"), m = $("#ai-model"), g = $("#ai-gmodel"), k = $("#gk-key");
  if (b){ const v = b.value.trim(); if (v && v !== A.PRESETS[p].base) C.bases[p] = v; else delete C.bases[p]; }
  if (m){ const v = m.value.trim(); if (v && v !== A.PRESETS[p].model) C.models[p] = v; else delete C.models[p]; }
  if (g){ const v = g.value.trim(); if (v && v !== A.PRESETS[p].gmodel) C.gmodels[p] = v; else delete C.gmodels[p]; }
  if (k && k.value.trim()) C.keys[p] = k.value.trim(); persist(); }
function bind(){ $("#gk-form").onsubmit = e => { e.preventDefault(); if (busy){ ctrl && ctrl.abort(); return; } const v = $("#gk-in").value.trim(); if (!v) return; $("#gk-in").value = ""; ask(v); };
  $("#gk-in").onkeydown = e => { if (e.key === "Enter" && !e.shiftKey && matchMedia("(pointer:fine)").matches){ e.preventDefault(); $("#gk-form").requestSubmit(); } };
  document.querySelectorAll("#grok-box .chip").forEach(b => b.onclick = () => ask(b.dataset.q));
  $("#ai-prov").onchange = e => { readForm(); C.prov = e.target.value; extra = []; persist(); render(); const d = $("#grok-box details.keys"); if (d) d.open = true; };
  $("#gk-clr").onclick = () => { H = []; hSave(); paintMsgs(); };
  $("#gk-ctx").onclick = () => { const p = $("#gk-ctxv"); p.classList.toggle("hidden"); if (!p.classList.contains("hidden")) p.textContent = JSON.stringify(window.MEME ? MEME.context() : {}, null, 1); };
  $("#gk-save").onclick = () => { readForm(); render(); const d = $("#grok-box details.keys"); if (d) d.open = true; NOTIFY.toast(A.ready(E) ? E.P.n + " kaydedildi" : "eksik: anahtar / model / adres", A.ready(E) ? "good" : "bad"); };
  $("#gk-del").onclick = () => { delete C.keys[E.prov]; persist(); render(); NOTIFY.toast(E.P.n + " anahtarı silindi"); };
  $("#gk-test").onclick = () => { readForm(); if (!A.ready(E)){ $("#gk-res").textContent = "✖ eksik: anahtar / model / adres"; return; } test(); };
  paintMsgs(); paintBusy(); }
function render(){ const box = $("#grok-box"); if (!box) return; C = A.load(localStorage); refresh(); const keep = $("#gk-in") ? $("#gk-in").value : ""; box.innerHTML = html(); bind(); if (keep) $("#gk-in").value = keep; }
render();
const API = { ready: () => A.ready(E), ask, gate, render, get model(){ return E.model; }, get gmodel(){ return E.gmodel; }, get provider(){ return E.P.n; }, _H: () => H, parseActs };
window.AI = API; window.GROK = API; /* GROK kept as an alias so older code paths keep working */
})();
