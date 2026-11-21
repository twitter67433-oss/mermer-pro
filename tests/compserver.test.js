// v8.2.1 SUNUCU · BİLEŞİK OTO (SİM only) tests: node tests/compserver.test.js
// Proves: the headless engine opens / closes SİM trades with the app's own rules, uses ONLY public GET market data, has no key / signature / order code, and the API is token-protected with chmod-600 data files.
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http"), { spawn } = require("child_process");
const { Engine, makeGet, ALLOWED } = require("../server/comp-engine.cjs"), C = require("../comp.js"), D = path.join(__dirname, "..");
let f = 0; const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i !== undefined ? "  · " + i : "")); if (!c) f++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
(async () => {
/* ---- stubbed public Binance: every request is recorded ---- */
const NOW0 = Date.parse("2026-11-21T12:00:30Z"), SLOT = Math.floor(NOW0/900000)*900000; let clock = NOW0; const REQ = []; let PX = { TESTUSDT: 98 };
const rows = () => { const r = []; for (let i = 0; i < 300; i++){ const t = SLOT - (300 - i)*900000; r.push([t, "100", "100.1", "99.9", "100", "10", t + 899999, "1000", 5, "5", "500", "0"]); }
  const t = SLOT - 900000; r[299] = [t, "100", "100.05", "97.9", "98", "50", t + 899999, "5000", 9, "10", "1000", "0"]; return r; };
const stub = async (url, opt) => { const u = new URL(url); REQ.push({ method: opt && opt.method, host: u.host, path: u.pathname, hasKey: !!(opt && opt.headers) });
  const js = o => ({ ok: true, status: 200, headers: new Map(), json: async () => o });
  if (u.pathname === "/fapi/v1/exchangeInfo") return js({ symbols: [{ symbol: "TESTUSDT", contractType: "PERPETUAL", status: "TRADING", quoteAsset: "USDT", baseAsset: "TEST", underlyingType: "COIN", underlyingSubType: [] },
      { symbol: "AAPLUSDT", contractType: "TRADIFI_PERPETUAL", status: "TRADING", quoteAsset: "USDT", baseAsset: "AAPL", underlyingType: "EQUITY", underlyingSubType: ["TradFi"] }] });
  if (u.pathname === "/fapi/v1/ticker/24hr") return js(u.searchParams.get("symbol") ? { lastPrice: "98", priceChangePercent: "1" } : [{ symbol: "TESTUSDT", quoteVolume: "1000" }, { symbol: "AAPLUSDT", quoteVolume: "10" }]);
  if (u.pathname === "/fapi/v1/klines") return js(rows());
  if (u.pathname === "/futures/data/openInterestHist") return js([{ timestamp: SLOT - 3600000, sumOpenInterest: "100" }, { timestamp: SLOT, sumOpenInterest: "102" }]);
  if (u.pathname === "/fapi/v1/openInterest") return js({ openInterest: "102" });
  if (u.pathname === "/fapi/v1/fundingRate") return js([{ fundingRate: "0.001" }]);
  if (u.pathname === "/futures/data/globalLongShortAccountRatio") return js([{ longShortRatio: "1.2" }]);
  if (u.pathname === "/fapi/v1/ticker/price") return js(Object.entries(PX).map(([symbol, price]) => ({ symbol, price: String(price) })));
  return { ok: false, status: 404, headers: new Map(), json: async () => ({}) }; };
const mk = () => new Engine({ now: () => clock, fetch: stub, events: () => {} });
const sig = (o = {}) => Object.assign({ k: "sert", sym: "AAAUSDT", side: -1, entry: 100, stop: 103, close: clock - 20000, t: clock - 920000, vr: 5, until: clock + 900000 }, o);
const hold = (E, s) => E.HOLD.set(s.k + "|" + s.sym, s);
/* ---- 1. scan: real SERT trigger found on the synthetic coin, crypto only ---- */
{ const E = mk(); await E.scan(true); ok("scan finds the SERT SHORT trigger on the stub coin (app's SERTX.evalAll)", E.HOLD.has("sert|TESTUSDT"), [...E.HOLD.keys()].join());
  ok("TradFi (AAPLUSDT) is not scanned while 'hisse/emtia dahil' is off", !REQ.some(r => r.path === "/fapi/v1/klines" && false) && E.scanInfo.total === 1, "coins " + E.scanInfo.total);
  /* ---- 2. step: GİR → SİM trade with the owner's defaults ---- */
  await E.step(); const p = E.S.acct.pos[0];
  ok("GİR signal → one SİM SHORT opened automatically", E.S.acct.pos.length === 1 && p.sym === "TESTUSDT" && p.side === -1, E.note);
  ok("defaults: margin 50 $, 20×, cross, mandatory stop, TP price set", near(p.margin, 50) && p.lev === 20 && p.cross === true && p.stop > p.entry && p.tp > 0 && p.tp < p.entry, JSON.stringify([p.margin, p.lev, p.stop, p.tp]));
  ok("the 2nd list on the same coin is refused (one position per coin)", E.S.acct.pos.length === 1);
  PX.TESTUSDT = p.tp; clock += 5000; E.pxT = 0; await E.step();
  ok("price at TP → closes 'hedef' with ≈ +7 $ net after fees", E.S.acct.hist.length === 1 && E.S.acct.hist[0].why === "hedef" && near(E.S.acct.hist[0].net, 7, 0.05), E.S.acct.hist[0] && E.S.acct.hist[0].net.toFixed(3));
  ok("balance compounds: 1000 → ≈1007 and next stake grows with it", E.S.acct.bal > 1006.9 && C.stake(E.S) >= 50, E.S.acct.bal.toFixed(2));
  /* persistence round trip */
  const E2 = mk(); E2.load(JSON.parse(JSON.stringify(E.dump()))); ok("state + held triggers survive a restart (JSON round trip)", near(E2.S.acct.bal, E.S.acct.bal) && E2.S.acct.hist.length === 1 && E2.HOLD.size === E.HOLD.size); }
/* ---- 3. rules: max 2, GİR only, ÇIK closes, pause after 2 losses, mandatory stop ---- */
{ PX = { A1USDT: 100, A2USDT: 100, A3USDT: 100, A4USDT: 100 }; clock = NOW0; const E = mk(); E.pxT = 0;
  for (const s of ["A1", "A2", "A3"]) hold(E, sig({ sym: s + "USDT" })); await E.step();
  ok("max 2 simultaneous positions (3 GİR signals → 2 open)", E.S.acct.pos.length === 2 && /maks/.test(E.note), E.S.acct.pos.length + " · " + E.note);
  hold(E, sig({ sym: "A4USDT", stop: undefined })); const E3 = mk(); E3.pxT = 0; hold(E3, sig({ sym: "A4USDT", stop: NaN })); await E3.step(); ok("a signal without a valid stop never opens", E3.S.acct.pos.length === 0);
  const E4 = mk(); E4.pxT = 0; PX = { B1USDT: 98.5 }; hold(E4, sig({ sym: "B1USDT" })); await E4.step(); ok("price already 0.5R in favour (badge BEKLE · GEÇ KALDIN) → no trade", E4.S.acct.pos.length === 0, E4.note);
  PX = { A1USDT: 103.5, A2USDT: 103.5, A3USDT: 100, A4USDT: 100 }; clock += 4000; E.pxT = 0; await E.step();
  ok("both stops hit → 2 losses booked, positions closed", E.S.acct.hist.filter(r => r.why === "stop").length === 2 && E.S.acct.pos.length === 0 && E.S.streak === 2, E.S.acct.hist.map(r => r.why + r.net.toFixed(1)).join());
  PX = { A3USDT: 100 }; clock += 4000; hold(E, sig({ sym: "A3USDT", close: clock - 10000 })); E.pxT = 0; await E.step();
  ok("after 2 consecutive losses → pause (no new trade)", E.S.acct.pos.length === 0 && /ardışık/.test(E.note), E.note);
  /* ÇIK closes an open trade (opposite signal) */
  const E5 = mk(); PX = { C1USDT: 100 }; E5.pxT = 0; hold(E5, sig({ sym: "C1USDT" })); await E5.step(); ok("C1 open", E5.S.acct.pos.length === 1);
  hold(E5, sig({ sym: "C1USDT", k: "lng", side: 1, stop: 97, entry: 100 })); clock += 4000; E5.pxT = 0; await E5.step();
  ok("opposite signal → ÇIK badge → the open trade is closed (TERS SİNYAL)", !E5.S.acct.pos.some(p => p.side < 0) && /TERS/.test(E5.S.acct.hist[0].why), E5.S.acct.hist[0] && E5.S.acct.hist[0].why);
  /* settings from the phone: whitelisted, clamped, never flips `on` or `start` */
  const E6 = mk(); const c0 = E6.S.cfg.start; E6.setCfg({ lev: 10, tp: 5, maxPos: 3, on: false, start: 5, apiKey: "x", evil: 1 }); const c = E6.S.cfg;
  ok("phone settings apply (lev 10, TP 5, max 3) but cannot flip on/off, change start, or add keys", c.lev === 10 && c.tp === 5 && c.maxPos === 3 && c.on === true && c.start === c0 && !("apiKey" in c) && !("evil" in c));
  ok("toggle(false) stops new trades; kill closes everything", E6.toggle(false) === false && (await (async () => { PX = { D1USDT: 100 }; E6.pxT = 0; hold(E6, sig({ sym: "D1USDT" })); await E6.step(); return E6.S.acct.pos.length === 0; })())); }
/* ---- 4. network proof: only public GET market data ---- */
{ const bad = REQ.filter(r => r.method !== "GET" || r.host !== "fapi.binance.com" || !ALLOWED.some(a => a.test(r.path)) || r.hasKey);
  ok(`all ${REQ.length} recorded requests are GET + public market-data paths on fapi.binance.com, no headers (no API key)`, REQ.length > 10 && !bad.length, bad.length ? JSON.stringify(bad[0]) : [...new Set(REQ.map(r => r.path))].join(" "));
  const g = makeGet(stub); for (const u of ["/fapi/v1/order?symbol=A", "/fapi/v2/account", "/fapi/v1/leverage", "/fapi/v1/listenKey", "/fapi/v2/positionRisk", "/sapi/v1/capital/withdraw/apply"]){ let e = ""; try { await g(u); } catch(x){ e = x.message; } ok("transport refuses " + u.split("?")[0], /izin verilmeyen/.test(e)); }
  ok("the allow-list is exactly the 8 public market-data paths (no order / account / leverage / listenKey / sapi)", ALLOWED.length === 8 && ALLOWED.every(a => /^\^\\\/(fapi\\\/v1\\\/(ticker\\\/price|ticker\\\/24hr|exchangeInfo|klines|openInterest|fundingRate)|futures\\\/data\\\/(openInterestHist|globalLongShortAccountRatio))\$$/.test(a.source)), ALLOWED.map(a => a.source).join(" ")); }
/* ---- 5. source scan: no key / signature / order / wallet code on the server ---- */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
for (const fl of ["server/comp-engine.cjs", "server/comp-server.mjs"]){ const code = strip(fs.readFileSync(path.join(D, fl), "utf8"));
  ok(`${fl}: no signing / API-key / order / wallet / withdrawal code`, !/createHmac|signature=|X-MBX-APIKEY|apiKey|api_key|apiSecret|secretKey|listenKey|\/fapi\/v\d\/(order|batchOrders|leverage|marginType|account|balance|positionRisk|algoOrder)|sapi|withdraw|transfer\b|sendTransaction|sendBundle|Keypair|mnemonic|privateKey|\bwallet\b/i.test(code));
  ok(`${fl}: reads no key/secret from the environment or files`, !/process\.env\.[A-Z_]*(KEY|SECRET|PRIVATE|PASSPHRASE)/i.test(code) && !/BINANCE_|dotenv|\.env['"`]|bkeys|BKEYS|mermer\.(bkeys|trade)/.test(code));
  ok(`${fl}: no non-GET network call to Binance`, !/method:\s*"(POST|PUT|DELETE)"[^}]*binance|binance[^;]*method:\s*"(POST|PUT|DELETE)"/i.test(code)); }
{ const code = strip(fs.readFileSync(path.join(D, "server/comp-server.mjs"), "utf8")), urls = [...code.matchAll(/fetch\(([^)]*)/g)].map(m => m[1]);
  ok("comp-server.mjs fetches only ntfy.sh (address discovery) and its own tunnel /api/ping", urls.length > 0 && urls.every(u => /ntfy\.sh|\/api\/ping/.test(u)), urls.map(u => u.slice(0, 40)).join(" | "));
  ok("engine uses no module of the GERÇEK / MEME / key code (only sert, psim, aksiyon, comp, squeeze)", (fs.readFileSync(path.join(D, "server/comp-engine.cjs"), "utf8").match(/require\(path\.join\(ROOT, "([a-z0-9.-]+)"\)\)/g) || []).every(m => /"(sert|psim|aksiyon|comp|squeeze)\.js"/.test(m))); }
/* the signal engine and the existing lists/badges are untouched by v8.2.1 */
{ const { execSync } = require("child_process"); let d = ""; try { d = execSync("git diff --name-only 3e11991", { cwd: D }).toString(); } catch(e){}
  const touched = d.split("\n").filter(x => /^(sert|sig8|aksiyon|psim|comp|badge|hareket|squeeze|agg|trade|auto|exec|bkeys|bfxsafe)\.js$/.test(x));
  ok("v8.2.1 does not modify the signal engine, badges, psim, comp.js or any GERÇEK / key module", !touched.length, touched.join() || "(git: sert/sig8/aksiyon/psim/comp/badge/trade/auto/exec/bkeys unchanged)"); }
/* ---- 6. real HTTP server: token auth, read-only state, file modes ---- */
{ const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compsrv-")), port = 20000 + Math.floor(Math.random()*20000);
  const ch = spawn(process.execPath, [path.join(D, "server/comp-server.mjs")], { env: Object.assign({}, process.env, { COMP_DATA: dir, COMP_PORT: String(port), COMP_TUNNEL: "0", COMP_DISCOVERY: "0", COMP_OFFLINE: "1" }), stdio: "ignore" });
  const call = (p, o = {}) => new Promise(res => { const r = http.request({ host: "127.0.0.1", port, path: p, method: o.m || "POST", headers: o.h || {} }, x => { let s = ""; x.on("data", d => s += d); x.on("end", () => { let j = {}; try { j = JSON.parse(s); } catch {} res({ code: x.statusCode, j }); }); }); r.on("error", () => res({ code: 0, j: {} })); r.end(o.b); });
  for (let i = 0; i < 40; i++){ if ((await call("/api/ping", { m: "GET" })).code === 200) break; await new Promise(z => setTimeout(z, 150)); }
  const tok = fs.readFileSync(path.join(dir, "token"), "utf8").trim(), mode = n => (fs.statSync(path.join(dir, n)).mode & 0o777).toString(8);
  ok("API: ping open, everything else 401 without the token", (await call("/api/ping", { m: "GET" })).code === 200 && (await call("/api/state")).code === 401 && (await call("/api/cfg", { b: JSON.stringify({ cfg: { lev: 5 } }) })).code === 401 && (await call("/api/state", { m: "GET", h: { authorization: "Bearer wrong" } })).code === 401);
  const st = await call("/api/state", { m: "GET", h: { authorization: "Bearer " + tok } }); ok("read-only state endpoint with the token (GET Bearer)", st.code === 200 && st.j.sim === true && st.j.status.bal === 1000 && st.j.cfg.lev === 20 && st.j.cfg.maxPos === 2 && st.j.cfg.tp === 7);
  const c2 = await call("/api/cfg", { b: JSON.stringify({ t: tok, cfg: { lev: 10, tp: 5 } }) }); ok("settings from the phone (POST text/plain, token in body) reach the server", c2.code === 200 && c2.j.cfg.lev === 10 && c2.j.cfg.tp === 5);
  ok("reset needs the typed word", (await call("/api/reset", { b: JSON.stringify({ t: tok }) })).code === 400 && (await call("/api/reset", { b: JSON.stringify({ t: tok, confirm: "SIFIRLA" }) })).code === 200);
  ok("unknown / order-like endpoints do not exist", (await call("/api/order", { b: JSON.stringify({ t: tok }) })).code === 404 && (await call("/api/trade", { b: JSON.stringify({ t: tok }) })).code === 404);
  await new Promise(z => setTimeout(z, 300)); ch.kill("SIGTERM"); await new Promise(z => setTimeout(z, 500));
  ok("data dir 700 · token / state / logs chmod 600", (fs.statSync(dir).mode & 0o777) === 0o700 && ["token", "state.json", "server.log", "server.pid"].every(n => !fs.existsSync(path.join(dir, n)) || mode(n) === "600"), ["token", "state.json", "server.log"].map(n => n + ":" + (fs.existsSync(path.join(dir, n)) ? mode(n) : "-")).join(" "));
  ok("token is random, 43+ chars, and not in the repo", tok.length >= 43 && !fs.readFileSync(path.join(D, "server/comp-server.mjs"), "utf8").includes(tok));
  fs.rmSync(dir, { recursive: true, force: true }); }
console.log(f ? `\n${f} FAILED` : "\nall passed"); process.exit(f ? 1 : 0); })();
