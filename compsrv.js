/* MERMER TERMİNAL v8.2.2 — 🖥 SUNUCU panel for BİLEŞİK OTO (SİM / TEST ONLY). The compounding paper-trader can run 24/7 on the always-on server (server/comp-server.mjs, Node, public market data only),
   so it keeps opening / closing SIMULATED trades while this app is closed. This file only talks to that server (state read + SİM settings) and to ntfy.sh (encrypted address lookup).
   It never touches the GERÇEK tab, trade.js, auto.js, exec.js, API keys or wallets and sends no order anywhere. Pairing: link …#comppair=<url>|<token> (kept only in this device's localStorage: mermer.compsrv).
   While paired the LOCAL BİLEŞİK OTO panel is stopped and hidden (one account, not two); unpair brings it back. */
"use strict";
(function (root, factory){ const M = factory(); if (typeof module === "object" && module.exports) module.exports = M; else root.COMPSRVX = M; })(typeof self !== "undefined" ? self : this, function (){
const K = "mermer.compsrv";
const normUrl = u => { u = String(u || "").trim().replace(/\/+$/, ""); if (u && !/^https?:\/\//.test(u)) u = "https://" + u; return u; };
function parsePair(s){ s = String(s || "").trim(); const i = s.indexOf("#comppair="); if (i >= 0) s = s.slice(i + 10); try { s = decodeURIComponent(s); } catch(e){ return null; } const j = s.lastIndexOf("|"); if (j < 0) return null;
  const url = normUrl(s.slice(0, j)), token = s.slice(j + 1).trim(); if (!/^https:\/\/[^\s/]+$/.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) return null; if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return null; return { url, token }; }
return { K, normUrl, parsePair };
});

if (typeof window !== "undefined" && typeof document !== "undefined") window.COMPSRV = (() => {
const X = window.COMPSRVX, $$ = s => [...document.querySelectorAll(s)], esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toast = (m, k) => { try { window.NOTIFY && NOTIFY.toast(m, k || "info"); } catch(e){} };
let P = (() => { try { const p = JSON.parse(localStorage.getItem(X.K) || "null"); return p && p.url && p.token ? p : null; } catch(e){ return null; } })();
const S = { j: null, at: 0, conn: P ? "conn" : "off", err: "", gen: 0, busy: false, note: "" };
const $f = v => !isFinite(v) ? "—" : "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), sg = v => (v >= 0 ? "+" : "−") + "$" + Math.abs(v).toFixed(2);
const fp = v => !isFinite(v) ? "—" : v >= 1000 ? v.toFixed(1) : v >= 10 ? v.toFixed(2) : v >= 1 ? v.toFixed(3) : v >= 0.01 ? v.toFixed(5) : v.toPrecision(4);
const tm = t => new Date(t).toLocaleTimeString("tr-TR", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", second: "2-digit" });
/* pairing link in the address bar: store, then strip it so the token does not stay in the URL / history */
(() => { const h = location.hash; if (!h.startsWith("#comppair=")) return; const p = X.parsePair(h); history.replaceState(null, "", location.pathname + location.search);
  if (p){ P = { url: p.url, token: p.token, at: Date.now() }; try { localStorage.setItem(X.K, JSON.stringify(P)); } catch(e){} setTimeout(() => { stopLocal(); try { window.NAV && NAV.go("short"); } catch(e){} toast("✔ BİLEŞİK OTO sunucusu eşlendi", "good"); }, 400); } else setTimeout(() => toast("✖ sunucu eşleşme linki geçersiz", "bad"), 800); })();
/* CORS-"simple" requests (POST text/plain, token inside the JSON body): no preflight */
async function api(path, body, to = 15000){ if (!P) throw new Error("eşli sunucu yok"); const ac = new AbortController(), tt = setTimeout(() => ac.abort(), to);
  try { const r = await fetch(P.url + path, { method: "POST", headers: { "content-type": "text/plain;charset=UTF-8" }, body: JSON.stringify(Object.assign({}, body || {}, { t: P.token })), cache: "no-store", signal: ac.signal });
    const j = await r.json().catch(() => ({})); if (r.status === 401) throw new Error("token geçersiz (yeniden eşle)"); if (!r.ok || j.ok === false) throw new Error(j.error || ("HTTP " + r.status)); return j; }
  catch(e){ if (e.name === "AbortError") throw new Error("sunucu cevap vermedi"); if (e instanceof TypeError) throw new Error("sunucuya ulaşılamadı (adres değişmiş olabilir)"); throw e; } finally { clearTimeout(tt); } }
/* the tunnel address changes every ~2 h: the server publishes it AES-GCM-encrypted (key from the token) on a secret ntfy.sh topic (name from the token) */
const u8 = s => new TextEncoder().encode(s), hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
let discAt = 0;
async function discover(force){ if (!P || !crypto.subtle) return false; if (!force && Date.now() - discAt < 8000) return false; discAt = Date.now();
  try { const topic = "neon" + hex(await crypto.subtle.digest("SHA-256", u8("neon-topic:" + P.token))).slice(0, 40);
    const key = await crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", u8("neon-url:" + P.token)), "AES-GCM", false, ["decrypt"]);
    const txt = await (await fetch(`https://ntfy.sh/${topic}/json?poll=1&since=24h`, { cache: "no-store" })).text(); let best = null;
    for (const line of txt.split("\n")){ if (!line.trim()) continue; try { const m = JSON.parse(line); if (m.event !== "message" || !m.message) continue; const b = unb64u(m.message.trim());
        const o = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b.slice(0, 12) }, key, b.slice(12)))); if (o.u && (!best || o.t > best.t)) best = o; } catch(e){} }
    if (best && /^https:\/\/[^\s/]+$/.test(best.u) && best.u !== P.url){ P.url = best.u; try { localStorage.setItem(X.K, JSON.stringify(P)); } catch(e){} return true; } } catch(e){} return false; }
function stopLocal(){ try { const b = document.querySelector('.cp [data-cp="toggle"].on'); if (b) b.click(); } catch(e){} document.body.classList.add("cps-on"); }
async function poll(){ if (!P || S.busy || document.hidden) return; S.busy = true;
  try { S.j = await api("/api/state"); S.at = Date.now(); S.err = ""; S.conn = "ok"; }
  catch(e){ S.err = e.message; S.conn = Date.now() - S.at > 20000 ? "err" : S.conn; if (await discover(true)){ S.err = "yeni sunucu adresi bulundu"; S.busy = false; return poll(); } }
  finally { S.busy = false; } paint(); }
async function cmd(path, body, okMsg){ try { S.j = await api(path, body || {}); S.at = Date.now(); S.conn = "ok"; S.err = ""; S.note = okMsg || "tamam"; toast("✔ " + S.note, "good"); paint(); return true; } catch(e){ S.note = "✖ " + e.message; toast(S.note, "bad"); paint(); return false; } }
const FIELDS = [["maxPos", "maks. pozisyon", "1"], ["stakePct", "marj % (kasa)", "0.5"], ["lev", "kaldıraç ×", "1"], ["tp", "hedef $ (net)", "0.5"], ["give", "iz geri verme $", "0.25"], ["target", "günlük hedef $", "10"], ["lossPct", "günlük zarar %", "1"]];
function openHtml(j){ if (!j.open.length) return `<div class="cp-e dim">açık pozisyon yok</div>`;
  return j.open.map(p => `<div class="cp-pos"><b>${esc(p.sym.replace("USDT", ""))}</b> <span class="${p.side > 0 ? "up" : "dn"}">${p.side > 0 ? "LONG" : "SHORT"}</span> <small>${p.lev}× · marj $${p.margin.toFixed(2)} · giriş ${fp(p.entry)}</small> <span class="${p.net >= 0 ? "up" : "dn"}">${sg(p.net)}</span>
    <small class="dim">stop ${fp(p.stop)} · hedef ${p.armed ? "iz-süren" : "+$" + j.cfg.tp + " net"} · likidasyon ≈ ${fp(p.liq)} (%${isFinite(p.liqDist) ? (p.liqDist*100).toFixed(0) : "—"} uzakta, cross)</small></div>`).join(""); }
function html(){
  if (!P) return `<div class="cps-card cps-unpaired"><div class="cps-hd"><b>🖥 SUNUCU</b> <small>BİLEŞİK OTO 7/24 · uygulama kapalıyken de çalışır · SİM</small> <span class="cp-st">EŞLİ DEĞİL</span></div>
    <p class="cps-help">Eşleşme linkini buraya yapıştır, sonra <b>BAĞLAN</b>'a bas. Link yalnız bu telefonda saklanır. Eşleşince yerel BİLEŞİK OTO durur; kasa ve işlemler sunucudan gösterilir. Gerçek emir yok.</p>
    <div class="cp-f"><label>eşleşme linki<input type="text" data-cs-in="link" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="url" placeholder="…#comppair=…"></label></div>
    <div class="cp-act"><button type="button" class="mini on" data-cs="pair">BAĞLAN</button></div>${S.note ? `<div class="cp-n dim">${esc(S.note)}</div>` : ""}</div>`;
  const j = S.j; if (!j) return `<div class="cps-card"><div class="cps-hd"><b>🖥 SUNUCU</b> <small>BİLEŞİK OTO 7/24 · SİM</small> <span class="cp-st warn">${S.conn === "err" ? "ULAŞILAMIYOR" : "BAĞLANIYOR"}</span></div><p class="cps-help dim">${esc(S.err || "bağlanılıyor…")}</p><div class="cp-act"><button type="button" class="mini" data-cs="unpair">EŞLEMEYİ KALDIR</button></div></div>`;
  const st = j.status, c = j.cfg, d = st.day, age = Math.round((Date.now() - S.at)/1000), cls = st.state === "AÇIK" ? "on" : /HEDEF/.test(st.state) ? "tp" : st.state === "KAPALI" ? "" : "warn", stale = S.conn === "err" || age > 30;
  const hist = j.hist.slice(0, 6).map(r => `<span class="${r.net >= 0 ? "up" : "dn"}" title="${esc(r.why)}">${esc(r.sym.replace("USDT", ""))} ${sg(r.net)}</span>`).join(" · ") || "—";
  const sc = j.scan, scTxt = sc.busy ? `taranıyor ${sc.done}/${sc.total}` : sc.at ? `son tarama ${tm(sc.at)} · ${sc.total} coin · ${Math.round(sc.dur/1000)} sn` : "tarama bekleniyor";
  return `<details class="cp-d cps-d" open><summary><b>🖥 SUNUCU · BİLEŞİK OTO</b> <small>7/24 · SİM · gerçek emir yok</small> <span class="cp-st ${stale ? "warn" : cls}">${stale ? "BAĞLANTI YOK" : st.state}</span> <span class="cp-sum">kasa ${$f(st.bal)} · bugün <b class="${d.pnl >= 0 ? "up" : "dn"}">${sg(d.pnl)}</b></span></summary>
  <div class="cp-b"><div class="cp-grid"><div><small>KASA</small><b>${$f(st.bal)}</b></div><div><small>BUGÜN</small><b class="${d.pnl >= 0 ? "up" : "dn"}">${sg(d.pnl)}</b></div><div><small>İŞLEM</small><b>${d.n}</b></div><div><small>KAZANMA</small><b>${st.wr === null ? "—" : "%" + Math.round(st.wr*100)}</b></div><div><small>AÇIK</small><b>${st.open}/${c.maxPos}</b></div><div><small>SONRAKİ MARJ</small><b>${st.stake ? "$" + st.stake.toFixed(2) : "—"}</b></div></div>
  <div class="cp-prog" title="gün başı ${$f(d.start)} → hedef ${$f(st.target)}"><i style="width:${(st.prog*100).toFixed(1)}%"></i></div><div class="cp-pl dim">${$f(st.bal)} → ${$f(st.target)} · %${(st.prog*100).toFixed(1)}${c.stocks ? " · hisse dahil" : " · yalnız kripto"}</div>
  <div class="cp-act"><button type="button" class="mini ${c.on ? "on" : ""}" data-cs="toggle">${c.on ? "■ DURDUR" : "▶ BAŞLAT (SİM, otomatik)"}</button><button type="button" class="mini" data-cs="kill">HEPSİNİ DURDUR</button><button type="button" class="mini" data-cs="reset">SIFIRLA</button></div>
  <div class="cp-open">${openHtml(j)}</div><div class="cp-h dim">son: ${hist}</div><div class="cp-n dim">${esc(j.note)} · ${esc(scTxt)} · veri ${age} sn önce${stale ? " ⚠ " + esc(S.err) : ""}${S.note ? " · " + esc(S.note) : ""}</div>
  <details class="cp-set"><summary>ayarlar (sunucuya gider)</summary><div class="cp-f">${FIELDS.map(([k, n, s]) => `<label>${n}<input type="number" step="${s}" data-cs-f="${k}" value="${c[k]}"></label>`).join("")}
  <label class="cp-ck"><input type="checkbox" data-cs-f="trail"${c.trail ? " checked" : ""}> iz-süren çıkış</label><label class="cp-ck"><input type="checkbox" data-cs-f="stocks"${c.stocks ? " checked" : ""}> hisse/emtia dahil</label></div>
  <small class="dim">Başlangıç kasa yalnız SIFIRLA ile uygulanır ($${c.start}). Sunucu: ${Math.floor(j.srv.uptime/3600)} sa ${Math.floor(j.srv.uptime/60)%60} dk çalışıyor · v${esc(j.ver)}.</small><div class="cp-act"><button type="button" class="mini" data-cs="unpair">EŞLEMEYİ KALDIR</button></div></details>
  <small class="cp-w dim">YALNIZ SİM — sunucuda API anahtarı, cüzdan, imzalı istek yok; yalnız halka açık Binance piyasa verisi okunur. GERÇEK sekmesi etkilenmez. Kanıtlanmadı: 29 günlük gerçek-veri replay'inde bu kurallar zarar etti (bkz. docs/BACKTEST_REPORT.md).</small></div></details>`; }
function paint(){ const els = $$(".cps"); if (!els.length) return; const ae = document.activeElement; if (ae && ae.closest && ae.closest(".cps") && ae.tagName === "INPUT") return;
  if (!P && els.some(e => { const i = e.querySelector("[data-cs-in]"); return i && i.value; })) return; /* never wipe a pasted link */
  const open = els.map(e => { const d = e.querySelector(".cps-d"), s = e.querySelector(".cp-set"); return [d && d.open, s && s.open]; }); const h = html();
  els.forEach((e, i) => { e.innerHTML = h; const d = e.querySelector(".cps-d"), s = e.querySelector(".cp-set"); if (d && open[i][0] !== undefined && open[i][0] !== null && e.dataset.init) d.open = open[i][0]; if (s && open[i][1]) s.open = true; e.dataset.init = "1"; }); }
function pairFrom(s){ const p = X.parsePair(s); if (!p) return false;
  P = { url: p.url, token: p.token, at: Date.now() }; try { localStorage.setItem(X.K, JSON.stringify(P)); } catch(err){}
  S.j = null; S.conn = "conn"; S.note = ""; S.err = ""; stopLocal();
  try { window.NAV && NAV.go("short"); } catch(e){}
  toast("✔ BİLEŞİK OTO sunucusu eşlendi", "good"); paint(); poll(); return true; }
function click(e){ const b = e.target.closest("[data-cs]"); if (!b) return; const a = b.dataset.cs;
  if (a === "pair"){ const el = b.closest(".cps").querySelector('[data-cs-in="link"]'); if (!pairFrom(el && el.value)){ S.note = "✖ link geçersiz (…#comppair=adres|token)"; paint(); } }
  else if (a === "unpair"){ P = null; S.j = null; S.conn = "off"; S.note = ""; try { localStorage.removeItem(X.K); } catch(err){} document.body.classList.remove("cps-on"); paint(); }
  else if (a === "toggle") cmd("/api/toggle", { on: !(S.j && S.j.cfg.on) }, S.j && S.j.cfg.on ? "durduruldu" : "başlatıldı");
  else if (a === "kill") cmd("/api/kill", {}, "HEPSİNİ DURDURULDU");
  else if (a === "reset"){ const go = () => cmd("/api/reset", { confirm: "SIFIRLA" }, "sıfırlandı");
    if (window.CONN && CONN.typedConfirm) CONN.typedConfirm("SUNUCU BİLEŞİK OTO SIFIRLA", "Sunucudaki sanal kasa başlangıç değerine döner; sanal pozisyonlar ve geçmiş silinir. Gerçek hesap etkilenmez.", "SIFIRLA").then(ok => ok && go()); else if (confirm("Sunucudaki bileşik SİM sıfırlansın mı?")) go(); } }
function change(e){ const i = e.target.closest("[data-cs-f]"); if (!i) return; const k = i.dataset.csF; cmd("/api/cfg", { cfg: { [k]: i.type === "checkbox" ? i.checked : i.value } }, "ayar sunucuya kaydedildi"); }
/* If a COMP pair link is pasted into the MEME tab's "Gelişmiş · SUNUCU" box, do not feed it to the MEME bot: show a hint and route it here. #pair= MEME links are left alone. */
function memeHint(on, el){ let h = document.getElementById("cps-meme-hint");
  if (!on){ if (h) h.remove(); return; }
  if (!h){ h = document.createElement("div"); h.id = "cps-meme-hint"; h.className = "cps-hint"; h.setAttribute("role", "status");
    const mount = (el && (el.closest("label") || el.parentNode)) || document.getElementById("srv-box"); if (!mount) return; mount.insertAdjacentElement("afterend", h);
    h.addEventListener("click", ev => { if (!ev.target.closest("[data-cs-memeroute]")) return; pairFrom((document.getElementById("sv-link") || {}).value); }); }
  h.innerHTML = `Bu link SHORT sekmesindeki 🖥 SUNUCU için. MEME botuna ait değil.<br><button type="button" class="mini on" data-cs-memeroute="1">SHORT'A GİT VE BAĞLAN</button>`; }
function init(){ document.addEventListener("click", ev => { if (ev.target.closest(".cps")) click(ev); }); document.addEventListener("change", ev => { if (ev.target.closest(".cps")) change(ev); });
  document.addEventListener("input", ev => { if (ev.target && ev.target.id === "sv-link") memeHint(!!X.parsePair(ev.target.value), ev.target); }, true);
  document.addEventListener("paste", ev => { if (!(ev.target && ev.target.id === "sv-link")) return; setTimeout(() => memeHint(!!X.parsePair(ev.target.value), ev.target), 0); }, true);
  document.addEventListener("click", ev => { const b = ev.target.closest && ev.target.closest("#sv-pair"); if (!b) return; const v = (document.getElementById("sv-link") || {}).value; if (!X.parsePair(v)) return;
    ev.preventDefault(); ev.stopPropagation(); pairFrom(v); }, true);
  if (P) document.body.classList.add("cps-on"); setInterval(poll, 5000); document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
  paint(); setTimeout(poll, 300); setInterval(paint, 4000); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
return { get P(){ return !!P; }, get S(){ return S; }, poll, paint, pairFrom, parsePair: X.parsePair };
})();
