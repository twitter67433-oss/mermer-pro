// v8.2 BİLEŞİK OTO (SİM only) tests: node tests/compound.test.js
const fs = require("fs"), path = require("path"), P = require("../psim.js"), C = require("../comp.js"), AX = require("../aksiyon.js"); let f = 0;
const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i !== undefined ? "  · " + i : "")); if (!c) f++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const T0 = Date.parse("2026-11-10T10:00:00Z"), GIR = { st: "GIR" };
const sig = (o = {}) => Object.assign({ sym: "AAAUSDT", k: "sert", side: -1, entry: 100, stop: 103, close: T0 }, o);
const mk = (cfg = {}) => { const S = C.create(Object.assign({ on: true }, cfg)); C.roll(S, T0); return S; };
const tick = (S, sym, px, t) => C.stepSym(S, sym, { o: px, h: px, l: px, c: px }, t);
/* defaults = the owner's brief */
{ const c = C.cfgOf({}); ok("defaults: 1000 $ vault, max 2 positions, 5 % stake (=50 $), 20×, +7 $ net TP, 2000 $ target, −10 % day loss, automatic (on) in SİM", c.start === 1000 && c.maxPos === 2 && c.stakePct === 5 && c.lev === 20 && c.tp === 7 && c.target === 2000 && c.lossPct === 10 && c.on === true && c.trail === false);
  const d = C.cfgOf({ lev: 999, maxPos: 99, tp: -5, stakePct: "x", start: 0 }); ok("settings are clamped / sanitized", d.lev === 50 && d.maxPos === 5 && d.tp === 0.5 && d.stakePct === 5 && d.start === 10, JSON.stringify([d.lev, d.maxPos, d.tp, d.stakePct, d.start])); }
/* compounding stake 50 → 60 → 70 → 80, shrink after loss */
{ const S = mk(); ok("stake at 1000 = 50 $", C.stake(S) === 50);
  S.acct.bal = 1200; ok("stake at 1200 = 60 $", C.stake(S) === 60); S.acct.bal = 1400; ok("stake at 1400 = 70 $", C.stake(S) === 70); S.acct.bal = 1600; ok("stake at 1600 = 80 $", C.stake(S) === 80);
  S.acct.bal = 800; ok("stake shrinks after losses (800 → 40 $)", C.stake(S) === 40); S.acct.bal = 50; ok("below min stake → no trade", C.stake(S) === 0);
  const s2 = mk(); const g = C.enter(s2, sig(), 100, T0, { v: GIR }); ok("margin of the first trade = 50 $, notional 1000 $ at 20×", g.ok && near(g.pos.margin, 50) && near(g.pos.qty*g.pos.entry, 1000, 1e-6), g.pos && g.pos.margin); }
/* take-profit nets +7 $ AFTER fees, with the realistic cost model ON and OFF */
for (const side of [1, -1]) for (const costs of [true, false]){ const C0 = Object.assign({}, P.COST); if (!costs) P.setCost({ spread: 0, slip: 0, lat: 0 });
  const S = mk(), g = C.enter(S, sig({ side, entry: 100, stop: side > 0 ? 97 : 103 }), 100, T0, { v: GIR }), p = g.pos; const r = tick(S, "AAAUSDT", p.tp, T0 + 60000);
  ok(`TP nets +7 $ after fees (${side > 0 ? "LONG" : "SHORT"}, costs ${costs ? "on" : "off"})`, r.length === 1 && r[0].why === "hedef" && near(r[0].net, 7, 0.02), r[0] && r[0].net.toFixed(4)); P.setCost(C0); }
/* mandatory stop */
{ const S = mk(); let g = C.enter(S, sig({ stop: undefined }), 100, T0, { v: GIR }); ok("no stop → trade refused", !g.ok && /stop/.test(g.why), g.why);
  g = C.enter(S, sig({ side: -1, stop: 99 }), 100, T0, { v: GIR }); ok("SHORT stop below price → refused", !g.ok, g.why); g = C.enter(S, sig({ side: 1, entry: 100, stop: 101 }), 100, T0, { v: GIR }); ok("LONG stop above price → refused", !g.ok);
  g = C.enter(S, sig(), 100, T0, { v: GIR }); ok("every open position carries its stop", g.ok && g.pos.stop === 103 && S.acct.pos.every(p => p.stop > 0)); }
/* GİR only */
{ for (const v of [{ st: "BEKLE" }, { st: "CIK" }, { st: "KAR" }, null]){ const S = mk(); const g = C.enter(S, sig(), 100, T0, { v }); ok(`badge ${v ? v.st : "none"} → no trade`, !g.ok && !S.acct.pos.length, g.why); }
  const S = mk(), v = AX.verdict(sig(), 100, T0 + 1000, {}); ok("real AKSİYON verdict at the entry price = GİR", v.st === "GIR"); ok("GİR → trade opens", C.enter(S, sig(), 100, T0, { v }).ok);
  const late = AX.verdict(sig(), 99, T0 + 1000, {}); ok("price already 0.33R in favour (GEÇ KALDIN) → BEKLE → no trade", late.st === "BEKLE" && !C.enter(mk(), sig(), 99, T0, { v: late }).ok); }
/* max 2 positions, one per coin, off / kill switch */
{ const S = mk(); ok("1st opens", C.enter(S, sig({ sym: "A1USDT" }), 100, T0, { v: GIR }).ok); let g = C.enter(S, sig({ sym: "A1USDT" }), 100, T0, { v: GIR }); ok("same coin twice refused", !g.ok, g.why);
  ok("2nd opens", C.enter(S, sig({ sym: "A2USDT" }), 100, T0, { v: GIR }).ok); g = C.enter(S, sig({ sym: "A3USDT" }), 100, T0, { v: GIR }); ok("3rd refused (max 2 open)", !g.ok && /maks/.test(g.why) && S.acct.pos.length === 2, g.why);
  ok("cross margin: both positions share one wallet (used margin 100 of the same balance)", near(P.used(S.acct), 100, 0.1) && S.acct.pos.every(p => p.cross === true));
  const off = mk({ on: false }); ok("switch off → refused", !C.enter(off, sig(), 100, T0, { v: GIR }).ok);
  const k = C.killAll(S, T0 + 1000); ok("kill switch flattens everything and blocks new trades", k.length === 2 && !S.acct.pos.length && S.halted && !C.enter(S, sig({ sym: "A4USDT" }), 100, T0, { v: GIR }).ok); }
/* compounding after a win, shrink after a loss, win/loss accounting */
{ const S = mk(), p = C.enter(S, sig(), 100, T0, { v: GIR }).pos; tick(S, "AAAUSDT", p.tp, T0 + 1000); ok("after a win the balance grows by the net profit and the day counts 1 win", near(S.acct.bal, 1007, 0.05) && S.day.w === 1 && S.day.n === 1, S.acct.bal.toFixed(3));
  const q = C.enter(S, sig({ sym: "BBBUSDT" }), 100, T0 + 2000, { v: GIR }).pos; ok("next stake is larger (balance × 5 %)", q.margin > 50 && near(q.margin, Math.floor(S.acct.bal*5)/100, 0.011) || near(q.margin, S.acct.bal*0.05, 0.02), q.margin);
  const r = tick(S, "BBBUSDT", 103.5, T0 + 3000); ok("stop hit → loss, stake shrinks again", r.length === 1 && r[0].why === "stop" && r[0].net < 0 && C.stake(S) < q.margin); }
/* gap: stop is filled at the (worse) open, not at the stop */
{ const S = mk(), p = C.enter(S, sig({ side: -1, stop: 103 }), 100, T0, { v: GIR }).pos; const r = C.stepSym(S, "AAAUSDT", { o: 106, h: 107, l: 105, c: 106 }, T0 + 900000); ok("gap beyond the stop → filled at the open", r.length === 1 && r[0].why === "stop" && r[0].trig === 106 && r[0].exit >= 106, r[0] && r[0].exit); }
{ const S = mk(), p = C.enter(S, sig({ side: -1, stop: 103 }), 100, T0, { v: GIR }).pos; const r = C.stepSym(S, "AAAUSDT", { o: 100, h: 104, l: p.tp - 1, c: 100 }, T0 + 900000); ok("bar touching stop AND target → stop (conservative)", r.length === 1 && r[0].why === "stop"); }
/* pause after 2 losses, then continue */
{ const S = mk({ lev: 10 }); for (let i = 0; i < 2; i++){ const s = sig({ sym: "L" + i + "USDT" }), p = C.enter(S, s, 100, T0 + i*1000, { v: GIR }).pos; tick(S, s.sym, 104, T0 + i*1000 + 500); }
  let g = C.enter(S, sig({ sym: "NEWUSDT" }), 100, T0 + 10000, { v: GIR }); ok("2 losses in a row → pause", !g.ok && /ardışık/.test(g.why) && C.status(S, T0 + 10000).state === "BEKLEME", g.why);
  g = C.enter(S, sig({ sym: "NEWUSDT" }), 100, T0 + 61*60000, { v: GIR }); ok("after the pause the bot trades again", g.ok, g.why); }
/* daily target and daily max loss */
{ const S = mk({ target: 1005 }); const p = C.enter(S, sig(), 100, T0, { v: GIR }).pos; tick(S, "AAAUSDT", p.tp, T0 + 1000); ok("daily target reached → stop for the day", S.day.stop === "hedef" && C.status(S, T0 + 2000).state === "HEDEF DOLDU");
  const g = C.enter(S, sig({ sym: "BBBUSDT" }), 100, T0 + 2000, { v: GIR }); ok("no new trade after the target", !g.ok && /hedef/.test(g.why), g.why);
  const n = C.roll(S, T0 + 24*3600000); ok("next Berlin day resets the day (new start = balance)", n.stop === null && n.n === 0 && near(n.start, S.acct.bal)); }
{ const S = mk({ lev: 20, stakePct: 25, lossPct: 5, pauseLosses: 9 }); const a = C.enter(S, sig({ stop: 104 }), 100, T0, { v: GIR }).pos; ok("target above start keeps absolute value 2000", C.targetOf(S) === 2000);
  const r = tick(S, "AAAUSDT", 104, T0 + 1000); ok("loss ≥ limit → day stopped (zarar)", S.day.stop === "zarar", S.day.pnl.toFixed(2)); ok("no more trades after the loss limit", !C.enter(S, sig({ sym: "ZZUSDT" }), 100, T0 + 2000, { v: GIR }).ok); }
{ const S = mk({ lev: 20, stakePct: 25, lossPct: 5 }); const a = C.enter(S, sig({ stop: 110 }), 100, T0, { v: GIR }).pos; S.last.AAAUSDT = 102; const out = C.guard(S, T0 + 1000); ok("open loss beyond the day limit → flattened at once", out.length === 1 && out[0].why === "günlük zarar" && S.day.stop === "zarar" && !S.acct.pos.length); }
{ const S = mk({ target: 1500 }); S.acct.bal = 3000; const d = C.roll(S, T0 + 2*86400000); ok("day already above the target → target = 2× the day's start", near(C.targetOf(S), 6000)); }
/* trailing */
{ const S = mk({ trail: true, give: 3 }), p = C.enter(S, sig({ side: 1, entry: 100, stop: 97 }), 100, T0, { v: GIR }).pos; let r = tick(S, "AAAUSDT", p.tp, T0 + 1000); ok("trailing: reaching the target arms the trail (no close yet)", r.length === 0 && p.armed && S.acct.pos.length === 1);
  tick(S, "AAAUSDT", p.tp + 0.5, T0 + 2000); const st = p.stop; ok("trail ratchets the stop up", st > 97 && st > p.entry); r = tick(S, "AAAUSDT", st - 0.001, T0 + 3000); ok("pullback closes the trade in profit (> +1 $ net) above the fixed target minus the give-back", r.length === 1 && r[0].net > 1 && r[0].net < 12, r[0] && r[0].net.toFixed(2)); }
/* ÇIK badge exits */
{ const S = mk(), p = C.enter(S, sig(), 100, T0, { v: GIR }).pos; ok("GİR keeps the trade", C.sigExit(S, p, 100.1, T0 + 1000, false) === null && S.acct.pos.length === 1);
  const r = C.sigExit(S, p, 100.2, T0 + 2000, true); ok("opposite signal (ÇIK TERS) closes at market", r && /ÇIK/.test(r.why) && !S.acct.pos.length, r && r.why); }
{ const S = mk(), p = C.enter(S, sig(), 100, T0, { v: GIR }).pos; const r = C.sigExit(S, p, 100.1, T0 + 61*60000, false); ok("60 min (ÇIK SÜRE) closes", r && /ÇIK/.test(r.why)); }
/* cross-margin: the whole wallet is exposed to a liquidation */
{ const S = mk({ lev: 50, stakePct: 25, maxPos: 2 }); const a = C.enter(S, sig({ sym: "X1USDT", side: 1, entry: 100, stop: 99.9 }), 100, T0, { v: GIR }).pos, b = C.enter(S, sig({ sym: "X2USDT", side: 1, entry: 100, stop: 99.9 }), 100, T0, { v: GIR }).pos;
  ok("two 25 % × 50× positions open on a 1000 $ wallet (notional ≈ 25 000 $)", a && b && near(a.qty*a.entry + b.qty*b.entry, 24900, 150)); a.stop = null; b.stop = null; const tot0 = S.acct.bal;
  const r = C.stepSym(S, "X1USDT", { o: 100, h: 100, l: 88, c: 90 }, T0 + 900000); ok("adverse move: account equity ≤ maintenance → ALL positions liquidated (cross)", r.length === 2 && r.every(x => x.why === "likidasyon") && !S.acct.pos.length && S.tot.liq === 1, r.map(x => x.sym).join());
  ok("the wallet is (almost) gone, not just one position's margin", S.acct.bal < tot0*0.1, S.acct.bal.toFixed(2)); ok("a liquidated account cannot trade (stake < min)", C.stake(S) === 0); }
{ const S = mk({ lev: 20 }); const a = C.enter(S, sig({ side: 1, entry: 100, stop: 97 }), 100, T0, { v: GIR }).pos; const L = C.liqInfo(S, a, 100); ok("cross liquidation distance is far beyond the stop (shown in the panel)", L.dist > 0.3 && L.px < 97 && L.isolated > L.px, L.dist.toFixed(3) + " / isolated " + L.isolated.toFixed(2)); }
/* PSIM stays strict for the manual simulator */
{ const st = P.create(1000); let e = ""; try { P.open(st, { sym: "A", side: 1, margin: 50, lev: 50, px: 100, stop: 97 }); } catch(x){ e = x.message; } ok("manual SİM (isolated) still refuses a stop beyond liquidation", /likidasyon/.test(e));
  const p = P.open(st, { sym: "A", side: 1, margin: 50, lev: 50, px: 100, stop: 97, cross: true }); ok("cross open allows it (account-level check instead)", p.cross === true && p.liq === 0); }
/* persistence is plain JSON; SİM only, never GERÇEK */
{ const S = mk(); C.enter(S, sig(), 100, T0, { v: GIR }); const j = JSON.parse(JSON.stringify(S)); ok("state survives a JSON round trip (localStorage)", j.acct.pos.length === 1 && j.acct.pos[0].stop === 103 && j.cfg.lev === 20); }
const src = fs.readFileSync(path.join(__dirname, "../comp.js"), "utf8"), code = src.replace(/\/\*[\s\S]*?\*\//g, "");
ok("comp.js never references real-trading modules or order endpoints", !/\b(TRADE|EXEC|AUTO|MEME|BKEYS|BFXSAFE|CONN\.(save|key))\b\.|fapi\/v1\/(order|batchOrders|leverage|algoOrder)|\/api\/trade|trade-local|sendTransaction|sendBundle|apiKey|api_key|secret|privateKey|signTransaction|X-MBX-APIKEY/i.test(code));
ok("its only storage key is mermer.comp", (code.match(/mermer\.[a-z.]+/g) || []).every(k => k === "mermer.comp"), (code.match(/mermer\.[a-z.]+/g) || []).join());
ok("fetches only the public ticker price", (code.match(/fetch\(([^)]*)\)/g) || []).every(x => /ticker\/price/.test(x)));
for (const fl of ["trade.js", "auto.js", "exec.js", "bkeys.js", "bfxsafe.js", "copy.js", "remote.js", "meme.js", "pump.js"]){ const s = fs.readFileSync(path.join(__dirname, "..", fl), "utf8"); ok(`${fl}: no BİLEŞİK / COMP reference (test-only settings cannot leak into GERÇEK)`, !/COMPX|window\.COMP\b|mermer\.comp/.test(s)); }
const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8"); ok("index.html loads comp.js after psim.js and has the panel in SHORT + LONG", html.indexOf("comp.js") > html.indexOf("psim.js") && /id="cp-short"/.test(html) && /id="cp-long"/.test(html));
const ger = html.match(/<section id="(?:real|gercek|trade)[^>]*>[\s\S]*?<\/section>/i); ok("no panel inside a GERÇEK section", !ger || !/class="cp"/.test(ger[0]));

/* v8.2.3: manual settings ($, %, auto stop) + validation */
{ const c = C.cfgOf({}); ok("v8.2.3 defaults keep auto stop, % stake, $7 TP (old behaviour)", c.slMode === "auto" && c.stakeMode === "pct" && c.tpMode === "usd" && c.tp === 7 && c.stakePct === 5);
  const v = C.validateCfg({}); ok("empty / default settings validate", v.ok && !v.errs.length);
  ok("leverage 99 is rejected", !C.validateCfg({ lev: 99 }).ok);
  ok("stop % past liquidation is rejected (20× max ~4.1 %)", !C.validateCfg({ slMode: "pct", slPct: 10, lev: 20 }).ok && /likidasyon/.test(C.validateCfg({ slMode: "pct", slPct: 10, lev: 20 }).errs.join()));
  ok("1 % stop at 20× is inside the cap", C.validateCfg({ slMode: "pct", slPct: 1, lev: 20 }).ok);
  ok("daily target ≤ start is rejected", !C.validateCfg({ start: 1000, target: 1000 }).ok);
  ok("stake $ larger than the vault is rejected", !C.validateCfg({ stakeMode: "usd", stakeUsd: 2000, start: 1000 }).ok); }
{ const S = mk({ stakeMode: "usd", stakeUsd: 80 }); ok("fixed $ stake is 80, not 5 % of 1000", C.stake(S) === 80);
  const g = C.enter(S, sig(), 100, T0, { v: GIR }); ok("usd-stake trade opens with 80 $ margin", g.ok && near(g.pos.margin, 80)); }
{ const S = mk({ slMode: "pct", slPct: 1 }); const g = C.enter(S, sig({ stop: 103 }), 100, T0, { v: GIR });
  ok("stop % = 1 % below/above entry (SHORT → 101)", g.ok && near(g.pos.stop, 101, 0.02), g.pos && g.pos.stop);
  const S2 = mk({ slMode: "pct", slPct: 1 }); const g2 = C.enter(S2, sig({ stop: undefined }), 100, T0, { v: GIR });
  ok("pct stop does not need a signal SL", g2.ok && near(g2.pos.stop, 101, 0.02)); }
{ const S = mk({ slMode: "usd", slUsd: 10 }); const g = C.enter(S, sig(), 100, T0, { v: GIR });
  const loss = g.pos.side*(g.pos.entry - g.pos.stop)*g.pos.qty;
  ok("stop $ ≈ 10 $ loss (fill slippage allowed)", g.ok && g.pos.stop > g.pos.entry && near(loss, 10, 0.5), g.pos && loss); }
{ const S = mk({ slMode: "pct", slPct: 10, lev: 20 }); const g = C.enter(S, sig({ stop: 103 }), 100, T0, { v: GIR });
  ok("user stop past liq is refused", !g.ok && /likidasyon/.test(g.why), g.why); }
{ const far = 100 + 20; /* 20 % away, far past 20× liq */ const S = mk({ slMode: "auto" }); const g = C.enter(S, sig({ side: -1, stop: far }), 100, T0, { v: GIR });
  const cap = 100 * C.maxSlPct(20)/100; ok("OTOMATİK stop past liq is tightened inside the cap, not refused", g.ok && g.tightened && g.pos.stop <= 100 + cap + 1e-9 && g.pos.stop > 100, g.pos && g.pos.stop); }
{ const S = mk({ tpMode: "pct", tpPct: 1 }); const g = C.enter(S, sig({ side: -1, stop: 103 }), 100, T0, { v: GIR });
  ok("TP % = 1 % of entry (SHORT below entry)", g.ok && g.pos.tp < g.pos.entry && near(g.pos.tp, g.pos.entry*0.99, 0.02), g.pos && g.pos.tp); }
{ const html = fs.readFileSync(path.join(__dirname, "../comp.js"), "utf8");
  ok("local panel has KAYDET and OTOMATİK / % / $ stop+stake+TP", /data-cp="save">KAYDET</.test(html) && /OTOMATİK/.test(html) && /stakeMode/.test(html) && /tpMode/.test(html) && /slMode/.test(html));
  ok("each panel is its own form so SHORT/LONG radios do not share a checked state", /<form class="cp-wrap"/.test(html) && /<\/form>/.test(html));
  ok("form has no inline onsubmit (CSP)", !/onsubmit=/.test(html)); }

console.log(f ? `\n${f} FAILED` : "\nall passed"); process.exit(f ? 1 : 0);
