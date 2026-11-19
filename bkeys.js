/* MERMER TERMİNAL v7.40 — BKEYS: Binance API Secret at rest = AES-256-GCM with a key derived from the user's API PIN (PBKDF2-SHA256, 300k rounds),
   same scheme as the BOT CÜZDANI. The decrypted secret lives only in memory for this page session (reload / KİLİTLE → gone).
   Honest limits: encryption protects the secret at rest (stolen storage, backups, casual inspection). JavaScript running in this origin while the
   secret is unlocked (e.g. an XSS) can still use it — that is why the API key must have NO withdrawal permission and should be IP-restricted.
   v8.0: inside the Android APK (≥ 8.0) the PIN-ciphertext is additionally wrapped by an Android Keystore key (ksWrap / ksUnwrap below); see docs/ANDROID.md.
   Nothing is ever logged; the PIN is never stored. */
(function(root, f){ const M = f(); if (typeof module === "object" && module.exports) module.exports = M; else root.BKEYS = M; })(typeof self !== "undefined" ? self : this, function(){
"use strict";
const ITER = 300000, te = s => new TextEncoder().encode(s), td = b => new TextDecoder().decode(b);
const b64 = u => { let s = ""; const a = new Uint8Array(u); for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }, unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const cs = () => globalThis.crypto;
async function kdf(pin, salt, iter){ const base = await cs().subtle.importKey("raw", te(pin), "PBKDF2", false, ["deriveKey"]);
  return cs().subtle.deriveKey({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]); }
const pinOk = pin => typeof pin === "string" && pin.length >= 6 && pin.length <= 64;
async function enc(secret, pin, iter = ITER){ if (!pinOk(pin)) throw new Error("PIN en az 6 karakter olmalı"); if (!secret) throw new Error("Secret boş");
  const salt = cs().getRandomValues(new Uint8Array(16)), iv = cs().getRandomValues(new Uint8Array(12)), k = await kdf(pin, salt, iter);
  const ct = await cs().subtle.encrypt({ name: "AES-GCM", iv }, k, te(secret)); return { v: 1, kdf: "PBKDF2-SHA256", iter, salt: b64(salt), iv: b64(iv), ct: b64(ct) }; }
/* v8.0 Android Keystore layer (APK ≥ 8.0 only): after the PIN encryption, the PIN-ciphertext is wrapped once more with a non-exportable
   AES-256-GCM key that lives in the phone's Android Keystore (native plugin "NeonKeystore", see docs/ANDROID.md). The native side only ever
   sees the PIN-ciphertext — never the plaintext Secret or the PIN. A copied storage dump is then useless off this phone even with the PIN.
   Browser / older APK: no plugin → the record stays PIN-only (same as v7.40). A Keystore-bound record cannot be opened outside this app install. */
function ksPlugin(){ try { const C = globalThis.Capacitor; if (!C || typeof C.isNativePlatform !== "function" || !C.isNativePlatform()) return null;
  const hs = C.PluginHeaders; if (Array.isArray(hs) && !hs.some(h => h && h.name === "NeonKeystore")) return null;
  const P = C.Plugins && C.Plugins.NeonKeystore; if (P && typeof P.wrap === "function") return P;
  return typeof C.nativePromise === "function" ? { wrap: o => C.nativePromise("NeonKeystore", "wrap", o), unwrap: o => C.nativePromise("NeonKeystore", "unwrap", o) } : null; } catch(e){ return null; } }
const tmo = (p, ms) => Promise.race([p, new Promise((_, j) => setTimeout(() => j(new Error("keystore timeout")), ms))]);
async function ksWrap(e){ const P = ksPlugin(); if (!P) return e; try { const r = await tmo(P.wrap({ data: e.ct }), 8000);
    if (!r || !r.ct || !r.iv) return e; return Object.assign({}, e, { ct: r.ct, ks: { v: 1, iv: r.iv, alias: r.alias || "mermer_secret_wrap_v1" } }); } catch(x){ return e; } }
async function ksUnwrap(o){ if (!o || !o.ks) return o; const P = ksPlugin(); if (!P) throw new Error("Bu Secret telefonun Android Keystore'una bağlı — yalnızca bu cihazdaki Mermer Terminal uygulamasında açılır");
  let r; try { r = await tmo(P.unwrap({ ct: o.ct, iv: o.ks.iv }), 8000); } catch(x){ throw new Error("Android Keystore açılamadı (uygulama yeniden kuruldu mu?) — Secret'ı yeniden gir"); }
  if (!r || !r.data) throw new Error("Android Keystore açılamadı"); const c = Object.assign({}, o, { ct: r.data }); delete c.ks; return c; }
async function dec(o, pin){ if (!o || !o.ct) throw new Error("şifreli kayıt yok"); o = await ksUnwrap(o); const k = await kdf(String(pin || ""), unb64(o.salt), +o.iter || ITER);
  try { return td(await cs().subtle.decrypt({ name: "AES-GCM", iv: unb64(o.iv) }, k, unb64(o.ct))); } catch(e){ throw new Error("PIN yanlış"); } }
/* profile record in storage: v7.39-: { key, secret }  →  v7.40: { key, enc: {…} } (no plaintext). state(): "none" | "plain" | "locked" | "open" */
const S = {}; /* in-memory unlocked secrets per profile: { test, real } */
function state(rec, w){ if (!rec || !rec.key) return "none"; if (rec.enc) return S[w] ? "open" : "locked"; return rec.secret ? "plain" : "none"; }
async function seal(rec, pin, w, iter){ if (!rec || !rec.secret) throw new Error("şifrelenecek düz metin Secret yok"); const e = await ksWrap(await enc(rec.secret, pin, iter)); const out = { key: rec.key, enc: e };
  if (w) S[w] = rec.secret; return out; } /* caller writes `out` back — plaintext is dropped from storage */
async function open(rec, pin, w){ const s = await dec(rec.enc, pin); if (w) S[w] = s; return s; }
const secretOf = (rec, w) => rec && rec.enc ? (S[w] || "") : ((rec && rec.secret) || "");
function lock(w){ if (w) delete S[w]; else for (const k of Object.keys(S)) delete S[k]; }
/* ---- browser: PIN sheet (uses the shared #confirm box) ---- */
function ask(title, sub, okText){ return new Promise(res => { const box = typeof document !== "undefined" && document.getElementById("confirm"), cf = box && document.getElementById("cf-box"); if (!cf){ res(null); return; }
  cf.innerHTML = `<div class="cf-mode test">🔒 API PIN<small></small></div><div class="sheet-title"></div><div class="cf-warn" id="bk-sub"></div>
    <label>PIN<input id="bk-pin" type="password" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" minlength="6"></label>
    <div class="sheet-btns"><button type="button" id="cf-no">İPTAL</button><button type="button" id="cf-ok" class="cf-ok"></button></div>`;
  cf.querySelector(".sheet-title").textContent = title; cf.querySelector(".cf-mode small").textContent = "Secret yalnızca bu cihazda, şifreli"; cf.querySelector("#bk-sub").textContent = sub || ""; cf.querySelector("#cf-ok").textContent = okText || "AÇ";
  box.classList.remove("hidden"); const inp = cf.querySelector("#bk-pin"); setTimeout(() => inp.focus(), 50);
  const done = v => { box.classList.add("hidden"); cf.innerHTML = ""; res(v); };
  cf.querySelector("#cf-no").onclick = () => done(null); cf.querySelector("#cf-ok").onclick = () => done(inp.value); inp.onkeydown = e => { if (e.key === "Enter") done(inp.value); }; }); }
return { ITER, enc, dec, ksWrap, ksUnwrap, ksPlugin, pinOk, state, seal, open, secretOf, lock, ask, _S: S };
});
