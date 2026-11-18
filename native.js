/* NEON//TERMINAL — Android app bridge (Capacitor). Does NOTHING in a normal browser.
   Inside the Neon Terminal APK it maps the web APIs the app already uses onto native plugins:
   Notification → @capacitor/local-notifications (Android 13+ POST_NOTIFICATIONS asked once), navigator.vibrate → @capacitor/haptics,
   navigator.wakeLock → @capacitor-community/keep-awake. No keys, no orders, no network calls of its own. */
"use strict";
(function(){ const C = window.Capacitor; if (!C || typeof C.isNativePlatform !== "function" || !C.isNativePlatform()) return;
  const call = (p, m, o) => { try { const P = C.Plugins && C.Plugins[p]; return P && P[m] ? P[m](o || {}) : C.nativePromise(p, m, o || {}); } catch(e){ return Promise.reject(e); } };
  const nop = () => {}; window.NEON_NATIVE = { platform: "android", call }; document.documentElement.classList.add("native-app");
  /* notifications */
  let perm = "default", nid = 1000 + Math.floor(Math.random()*1e5); const mapP = s => s === "granted" ? "granted" : s === "denied" ? "denied" : "default";
  const chan = call("LocalNotifications", "createChannel", { id: "neon-signal", name: "Sinyal uyarıları", description: "AKILLI SİNYAL ve alarm bildirimleri", importance: 5, visibility: 1, vibration: true, lights: true, lightColor: "#00F0FF" }).catch(nop);
  function NativeNotification(title, o){ o = o || {}; const id = nid++; this.title = String(title || "NEON"); this.body = String(o.body || ""); this.tag = o.tag || ""; this.onclick = null;
    chan.then(() => call("LocalNotifications", "schedule", { notifications: [{ id, title: this.title, body: this.body, channelId: "neon-signal", smallIcon: "ic_stat_neon", iconColor: "#00F0FF", autoCancel: true, isExactNotification: false }] })).catch(nop);
    this.close = () => call("LocalNotifications", "cancel", { notifications: [{ id }] }).catch(nop); }
  NativeNotification.prototype.addEventListener = nop;
  Object.defineProperty(NativeNotification, "permission", { get: () => perm });
  NativeNotification.requestPermission = async cb => { try { perm = mapP((await call("LocalNotifications", "requestPermissions")).display); } catch(e){} if (typeof cb === "function") cb(perm); return perm; };
  try { window.Notification = NativeNotification; } catch(e){}
  call("LocalNotifications", "checkPermissions").then(r => { perm = mapP(r && r.display); if (perm === "default") return NativeNotification.requestPermission(); }).catch(nop);
  /* vibration: pattern [on, off, on, …] */
  try { navigator.vibrate = p => { const a = Array.isArray(p) ? p : [p]; let t = 0; a.forEach((ms, i) => { ms = +ms || 0; if (i % 2 === 0 && ms > 0) setTimeout(() => call("Haptics", "vibrate", { duration: Math.min(ms, 1000) }).catch(nop), t); t += ms; }); return true; }; } catch(e){}
  /* screen wake lock (Android WebView has no Wake Lock API) */
  const wl = { request: async () => { await call("KeepAwake", "keepAwake"); const ls = []; const s = { type: "screen", released: false, onrelease: null,
      addEventListener: (ev, f) => { if (ev === "release") ls.push(f); }, removeEventListener: nop,
      release: async () => { if (s.released) return; s.released = true; await call("KeepAwake", "allowSleep").catch(nop); ls.forEach(f => { try { f(); } catch(e){} }); s.onrelease && s.onrelease(); } }; return s; } };
  try { Object.defineProperty(navigator, "wakeLock", { value: wl, configurable: true }); } catch(e){}
})();
