// MERMER TERMİNAL v8.2.1 — SUNUCU · BİLEŞİK OTO (SİM ONLY). Runs the phone's BİLEŞİK OTO compounding paper-trader 24/7 on an always-on machine (Node, no browser),
// using the app's own engine files (see comp-engine.cjs). Public Binance market data only — NO API key, NO signed / order endpoint, NO wallet exists here.
// The phone sees the state and sends settings through a token-protected API behind a tunnel (token + pairing link live in $COMP_DATA, chmod 600, never in git).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { Engine, TUN_VER } = require("./comp-engine.cjs");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.COMP_DATA || "/workspace/neon-comp-data";
const PORT = +(process.env.COMP_PORT || 8898);
const SITE = process.env.NEON_SITE || "https://twitter67433-oss.github.io/neon-terminal-mobile/";
const TUNNEL = process.env.COMP_TUNNEL !== "0";
const DISC = process.env.COMP_DISCOVERY !== "0";
fs.mkdirSync(DATA, { recursive: true, mode: 0o700 }); try { fs.chmodSync(DATA, 0o700); } catch {}
process.umask(0o077);
const F = n => path.join(DATA, n);
const wsecret = (n, s) => { fs.writeFileSync(F(n), s, { mode: 0o600 }); fs.chmodSync(F(n), 0o600); };
const T0 = Date.now();

/* ---------------- log + events (chmod 600, size-capped) ---------------- */
function rot(file, max){ try { if (fs.existsSync(file) && fs.statSync(file).size > max) fs.renameSync(file, file + ".1"); } catch {} }
function log(...a){ const line = new Date().toISOString() + " " + a.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" ") + "\n"; rot(F("server.log"), 3e6); try { fs.appendFileSync(F("server.log"), line, { mode: 0o600 }); } catch {} process.stdout.write(line); }
const ERRS = []; const err = m => { ERRS.unshift({ t: Date.now(), m: String(m).slice(0, 300) }); ERRS.length = Math.min(ERRS.length, 20); log("ERR", m); };
function event(e){ rot(F("events.jsonl"), 8e6); try { fs.appendFileSync(F("events.jsonl"), JSON.stringify(Object.assign({ t: Date.now() }, e)) + "\n", { mode: 0o600 }); } catch {} }

/* ---------------- token (random, generated once, chmod 600) ---------------- */
let TOKEN; try { TOKEN = fs.readFileSync(F("token"), "utf8").trim(); } catch {}
if (!TOKEN || TOKEN.length < 32){ TOKEN = crypto.randomBytes(32).toString("base64url"); wsecret("token", TOKEN + "\n"); log("new token generated →", F("token")); }
const TB = Buffer.from(TOKEN);
const authed = (req, bd) => { const h = req.headers.authorization || ""; const t = h.startsWith("Bearer ") ? h.slice(7).trim() : (req.headers["x-neon-token"] || (bd && typeof bd.t === "string" ? bd.t : "")); const b = Buffer.from(String(t)); return b.length === TB.length && crypto.timingSafeEqual(b, TB); };
const FAILS = new Map(); const ipOf = req => String(req.headers["x-forwarded-for"] || req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "?").split(",")[0].trim();

/* ---------------- engine ---------------- */
const E = new Engine({ log, events: event });
try { if (E.load(JSON.parse(fs.readFileSync(F("state.json"), "utf8")))) log("state restored: bal", E.S.acct.bal.toFixed(2), "open", E.S.acct.pos.length, "hold", E.HOLD.size); } catch {}
let dirty = true;
function saveState(){ try { const tmp = F("state.json.tmp"); fs.writeFileSync(tmp, JSON.stringify(E.dump()), { mode: 0o600 }); fs.renameSync(tmp, F("state.json")); fs.chmodSync(F("state.json"), 0o600); } catch(e){ err("kayıt: " + e.message); } }
const TUN = { proc: null, url: null, kind: null, exp: null, pubAt: 0, fails: 0, since: 0 };
const srvMeta = () => ({ uptime: Math.round((Date.now() - T0)/1000), pid: process.pid, tunnel: TUN.kind, tunExp: TUN.exp, errs: ERRS.slice(0, 3), mode: "SİM — gerçek emir yok" });
let tickN = 0; const OFFLINE = process.env.COMP_OFFLINE === "1"; /* tests: no market loops */
if (!OFFLINE) setInterval(async () => { try { await E.step(); if (++tickN % 2 === 0) saveState(); } catch(e){ err("döngü: " + e.message); } }, 3000);
if (!OFFLINE){ setInterval(() => { E.scan().catch(e => err("tarama: " + e.message)); }, 20000); setTimeout(() => E.scan().catch(() => {}), 1500); }
setInterval(() => { fs.writeFile(F("heartbeat"), String(Date.now()), { mode: 0o600 }, () => {}); }, 10000); /* alive even if a price fetch is briefly stale — otherwise the supervisor kills a healthy process */

/* ---------------- HTTP API (token on every call except /api/ping) ---------------- */
const send = (res, code, o) => { const b = JSON.stringify(o); res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(b); };
const body = req => new Promise((ok, no) => { let n = 0; const c = []; req.on("data", d => { n += d.length; if (n > 20000){ no(new Error("gövde çok büyük")); req.destroy(); } else c.push(d); }); req.on("end", () => { try { ok(JSON.parse(Buffer.concat(c).toString() || "{}")); } catch { no(new Error("geçersiz JSON")); } }); req.on("error", no); });
const ACT = { /* read-only */ "/api/state": () => E.snapshot(srvMeta()), "/api/status": () => E.snapshot(srvMeta()),
  /* SİM settings / controls (virtual account only) */
  "/api/cfg": b => { E.setCfg(b.cfg || {}); dirty = true; saveState(); return E.snapshot(srvMeta()); },
  "/api/toggle": b => { E.toggle(typeof b.on === "boolean" ? b.on : undefined); saveState(); return E.snapshot(srvMeta()); },
  "/api/kill": () => { E.kill(); saveState(); return E.snapshot(srvMeta()); },
  "/api/reset": b => { if (b.confirm !== "SIFIRLA") throw new Error("onay (SIFIRLA) gerekli"); E.reset(); saveState(); return E.snapshot(srvMeta()); } };
const READONLY = new Set(["/api/state", "/api/status"]);
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  res.setHeader("access-control-allow-origin", "*"); res.setHeader("access-control-allow-headers", "authorization, content-type, x-neon-token"); res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS"); res.setHeader("access-control-max-age", "600");
  if (!url.pathname.startsWith("/api/")){ res.writeHead(302, { location: SITE }); return res.end(); }
  if (req.method === "OPTIONS"){ res.writeHead(204); return res.end(); }
  if (url.pathname === "/api/ping") return send(res, 200, { ok: true, app: "neon-comp-server", ver: TUN_VER });
  const ip = ipOf(req), fl = (FAILS.get(ip) || []).filter(t => Date.now() - t < 600000);
  if (fl.length >= 30) return send(res, 429, { ok: false, error: "çok fazla hatalı token — 10 dk bekle" });
  let b = {}; if (req.method === "POST"){ try { b = await body(req); } catch(e){ return send(res, 400, { ok: false, error: e.message }); } }
  if (!authed(req, b)){ fl.push(Date.now()); FAILS.set(ip, fl); return send(res, 401, { ok: false, error: "token geçersiz" }); }
  delete b.t; const h = ACT[url.pathname]; if (!h) return send(res, 404, { ok: false, error: "bilinmeyen uç" });
  if (!READONLY.has(url.pathname) && req.method !== "POST") return send(res, 405, { ok: false, error: "POST gerekli" });
  try { const r = await h(b); if (!READONLY.has(url.pathname)) log("api", url.pathname, JSON.stringify(b).slice(0, 200)); return send(res, 200, r); }
  catch(e){ return send(res, 400, { ok: false, error: e.message }); } });
server.on("error", e => { log("FATAL listen", e.message); process.exit(1); });
server.listen(PORT, "127.0.0.1", () => { log(`listening http://127.0.0.1:${PORT} · data ${DATA} · v${TUN_VER} · SİM ONLY`); startTunnel(); });

/* ---------------- public tunnel (LocalToLink: HTTPS :443, no account, links expire ~2 h → renewed; Cloudflare quick tunnel if the binary exists) ----------------
   The URL changes on renewal. The phone follows it: the server publishes the URL AES-GCM-encrypted (key from the token) on a secret ntfy.sh topic (name from the token). */
const ORDER = (process.env.COMP_TUNNEL_ORDER || "localtolink").split(",").map(x => x.trim()).filter(Boolean);
const sha = s => crypto.createHash("sha256").update(s).digest();
const TOPIC = "neon" + sha("neon-topic:" + TOKEN).toString("hex").slice(0, 40), UKEY = sha("neon-url:" + TOKEN);
function sealUrl(u){ const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", UKEY, iv); const ct = Buffer.concat([c.update(JSON.stringify({ u, t: Date.now() })), c.final(), c.getAuthTag()]); return Buffer.concat([iv, ct]).toString("base64url"); }
async function publishUrl(){ if (!DISC || !TUN.url) return; try { const r = await fetch("https://ntfy.sh/" + TOPIC, { method: "POST", body: sealUrl(TUN.url), headers: { "x-cache": "yes", "x-firebase": "no", title: "x" }, signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error("HTTP " + r.status); TUN.pubAt = Date.now(); log("discovery: encrypted URL published"); } catch(e){ err("keşif yayını başarısız: " + e.message); } }
setInterval(() => { if (TUN.url && Date.now() - TUN.pubAt > 6*3600000) publishUrl(); }, 600000);
function writeLinks(){ wsecret("tunnel-url.txt", TUN.url + "\n"); wsecret("pair-link.txt", `${SITE}#comppair=${encodeURIComponent(TUN.url)}|${TOKEN}\n`); log("TUNNEL", TUN.kind, TUN.url, TUN.exp ? "(bitiş " + TUN.exp + ")" : "", "· eşleşme linki →", F("pair-link.txt")); publishUrl(); }
function setUrl(u, kind, exp){ if (TUN.url === u) return; Object.assign(TUN, { url: u, kind, exp: exp || null, fails: 0, since: Date.now() }); writeLinks(); }
const LTL = (() => { try { return require.resolve("localtolink/package.json").replace(/package\.json$/, ""); } catch { return null; } })();
let tunGen = 0, tunBackoff = 5000;
function killTunnel(){ const p = TUN.proc; TUN.proc = null; if (p) try { process.kill(-p.pid, "SIGTERM"); } catch { try { p.kill("SIGTERM"); } catch {} } }
function startTunnel(kind){ if (!TUNNEL) return; kind = kind || ORDER[0]; const gen = ++tunGen; killTunnel();
  try { const old = +fs.readFileSync(F("tunnel.pid"), "utf8"); if (old) process.kill(-old, "SIGTERM"); } catch {}
  let p; if (kind === "cloudflared") p = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${PORT}`], { stdio: ["ignore", "pipe", "pipe"], detached: true });
  else { const bin = LTL ? path.join(LTL, JSON.parse(fs.readFileSync(path.join(LTL, "package.json"), "utf8")).bin?.localtolink || "bin/localtolink.js") : null;
    p = bin && fs.existsSync(bin) ? spawn(process.execPath, [bin, "--port", String(PORT), "--json", "--no-qr"], { stdio: ["ignore", "pipe", "pipe"], detached: true }) : spawn("npx", ["-y", "localtolink", "--port", String(PORT), "--json", "--no-qr"], { stdio: ["ignore", "pipe", "pipe"], detached: true }); }
  p.on("error", e => err("tünel başlatılamadı: " + e.message)); TUN.proc = p; TUN.kind = kind; wsecret("tunnel.pid", String(p.pid)); log("tunnel starting:", kind); let okSeen = false;
  const onOut = d => { const s = d.toString(); if (gen !== tunGen) return;
    if (kind === "cloudflared"){ const m = s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/); if (m) setTimeout(async () => { try { const r = await fetch(m[0] + "/api/ping", { signal: AbortSignal.timeout(10000) }); if (r.ok && gen === tunGen) setUrl(m[0], kind); } catch {} }, 8000); return; }
    for (const line of s.split("\n")){ if (!line.trim()) continue; let j; try { j = JSON.parse(line); } catch { fs.appendFile(F("tunnel.log"), line + "\n", { mode: 0o600 }, () => {}); continue; }
      if (j.status === "connected" && j.url){ okSeen = true; tunBackoff = 5000; setUrl(j.url, kind, j.expiresAt); } else { fs.appendFile(F("tunnel.log"), line + "\n", { mode: 0o600 }, () => {}); if (j.code === "RATE_LIMITED") tunBackoff = 60000; } } };
  p.stdout.on("data", onOut); p.stderr.on("data", onOut);
  p.on("exit", c => { if (gen !== tunGen) return; log("tunnel exited", kind, c); TUN.proc = null; TUN.url = null; const wait = okSeen ? 3000 : tunBackoff; tunBackoff = Math.min(300000, tunBackoff*2); setTimeout(() => { if (gen === tunGen) startTunnel(); }, wait); }); }
setInterval(async () => { if (!TUN.url || !TUN.proc || Date.now() - TUN.since < 60000) return;
  if (TUN.exp && Date.parse(TUN.exp) - Date.now() < 60000){ log("tunnel expiring → renewing"); TUN.url = null; return startTunnel(); }
  try { const r = await fetch(TUN.url + "/api/ping", { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error("HTTP " + r.status); TUN.fails = 0; }
  catch(e){ if (++TUN.fails >= 3){ err("tünel cevap vermiyor → yeni tünel açılıyor (adres değişecek): " + e.message); TUN.url = null; startTunnel(); } } }, 60000);

/* ---------------- lifecycle ---------------- */
function shutdown(sig){ log("shutdown", sig); tunGen++; killTunnel(); saveState(); process.exit(0); }
process.on("SIGTERM", () => shutdown("SIGTERM")); process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", e => err("unhandledRejection: " + (e && e.message || e)));
process.on("uncaughtException", e => { err("uncaughtException: " + (e && e.message || e)); });
wsecret("server.pid", String(process.pid));
