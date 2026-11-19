/* MERMER TERMİNAL v7.40 — BKEYS: Binance API Secret at rest = AES-256-GCM with a key derived from the user's API PIN (PBKDF2-SHA256, 300k rounds),
   same scheme as the BOT CÜZDANI. The decrypted secret lives only in memory for this page session (reload / KİLİTLE → gone).
   Honest limits: encryption protects the secret at rest (stolen storage, backups, casual inspection). JavaScript running in this origin while the
   secret is unlocked (e.g. an XSS) can still use it — that is why the API key must have NO withdrawal permission and should be IP-restricted.
   The Android APK has no native secure-storage bridge yet (native.js maps only notifications / haptics / keep-awake); see docs/SECURITY_AUDIT.md.
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
async function dec(o, pin){ if (!o || !o.ct) throw new Error("şifreli kayıt yok"); const k = await kdf(String(pin || ""), unb64(o.salt), +o.iter || ITER);
  try { return td(await cs().subtle.decrypt({ name: "AES-GCM", iv: unb64(o.iv) }, k, unb64(o.ct))); } catch(e){ throw new Error("PIN yanlış"); } }
/* profile record in storage: v7.39-: { key, secret }  →  v7.40: { key, enc: {…} } (no plaintext). state(): "none" | "plain" | "locked" | "open" */
const S = {}; /* in-memory unlocked secrets per profile: { test, real } */
function state(rec, w){ if (!rec || !rec.key) return "none"; if (rec.enc) return S[w] ? "open" : "locked"; return rec.secret ? "plain" : "none"; }
async function seal(rec, pin, w, iter){ if (!rec || !rec.secret) throw new Error("şifrelenecek düz metin Secret yok"); const e = await enc(rec.secret, pin, iter); const out = { key: rec.key, enc: e };
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
return { ITER, enc, dec, pinOk, state, seal, open, secretOf, lock, ask, _S: S };
});
