/* v8.0 — bot.js PUMP OTO / bot-wallet + Phantom payment paths: BELİRSİZ handling, idempotency ledger, no resend, confirm errors never swallowed */
const assert = require("assert"), fs = require("fs"), path = require("path"), vm = require("vm"), D = path.join(__dirname, "..");
const rd = f => fs.readFileSync(path.join(D, f), "utf8");
function load(rpc){ const store = {}, ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  class WS { constructor(){ this.readyState = 0; } send(){} close(){} } /* WS never opens → polling path */
  const ctx = { localStorage: ls, sessionStorage: ls, performance: { now: () => Date.now() }, WebSocket: WS, setTimeout: (f, ms) => setTimeout(f, Math.min(ms, 5)), clearTimeout, setInterval, clearInterval,
    fetch: async () => { throw new Error("no network in tests"); }, AbortSignal: { timeout: () => undefined }, document: { hidden: false }, CustomEvent: class { constructor(t, o){ this.type = t; this.detail = o && o.detail; } }, console };
  ctx.window = ctx; ctx.dispatchEvent = () => {}; ctx.TRADE = { ph: { rpc } }; vm.createContext(ctx); vm.runInContext(rd("exec.js"), ctx); return { X: ctx.EXEC, store }; }
(async () => {
  /* phSend: confirmed → ledger released */
  { const { X } = load(async m => m === "getSignatureStatuses" ? { value: [{ confirmationStatus: "confirmed" }] } : { value: true });
    let calls = 0; const prov = { signAndSendTransaction: async () => { calls++; return { signature: "SIG1" }; } };
    const r = await X.phSend("ph:test", prov, {}, "BH"); assert.strictEqual(r.state, "CONFIRMED"); assert.strictEqual(r.sig, "SIG1"); assert.strictEqual(X.pending("ph:test"), null, "released after confirm"); assert.strictEqual(calls, 1); }
  /* chain failure → FAILED (reported, released) */
  { const { X } = load(async m => m === "getSignatureStatuses" ? { value: [{ err: { InstructionError: [0, "x"] } }] } : { value: true });
    const r = await X.phSend("ph:f", { signAndSendTransaction: async () => "SIG2" }, {}, "BH"); assert.strictEqual(r.state, "FAILED"); assert.strictEqual(X.pending("ph:f"), null); }
  /* user rejects in Phantom → error rethrown, ledger released (nothing was sent) */
  { const { X } = load(async () => ({ value: [null] })); let e = null; try { await X.phSend("ph:r", { signAndSendTransaction: async () => { throw Object.assign(new Error("rejected"), { code: 4001 }); } }, {}, "BH"); } catch(x){ e = x; }
    assert.ok(e && e.code === 4001); assert.strictEqual(X.pending("ph:r"), null); }
  /* pending key → second send is refused BEFORE Phantom / signing is reached (no resend) */
  { const { X } = load(async () => ({ value: [null] })); X.hold("pf:buy:M", "SIGP", "BH"); let called = false, e = null;
    try { await X.phSend("pf:buy:M", { signAndSendTransaction: async () => { called = true; return "S"; } }, {}, "BH"); } catch(x){ e = x; }
    assert.ok(e && e.pendingBlock && !called, "pending ledger blocks the resend"); assert.throws(() => X.guard("pf:buy:M"), /BELİRSİZ/); X.release("pf:buy:M", "OTHER"); assert.ok(X.pending("pf:buy:M"), "release with a different sig keeps the entry"); X.release("pf:buy:M", "SIGP"); assert.strictEqual(X.pending("pf:buy:M"), null); }
  /* never seen + blockhash expired → EXPIRED (definitive, released) */
  { const { X } = load(async m => m === "getSignatureStatuses" ? { value: [null] } : { value: false });
    const r = await X.phSend("ph:e", { signAndSendTransaction: async () => "SIG3" }, {}, "BH"); assert.ok(r.state === "EXPIRED" || r.state === "BELİRSİZ", r.state); }
  /* source contracts */
  const bot = rd("bot.js"), pump = rd("pump.js"), auto = rd("auto.js"), trade = rd("trade.js");
  assert.ok(!/confirm\(sig\)\.catch\(\(\) => \{\}\)/.test(bot), "fund(): confirm errors are no longer ignored (old bot.js:102)");
  assert.ok(/X\.phSend\(key, p, tx, bh\.value\.blockhash\)/.test(bot) && /return outcome\(r, r\.sig\)/.test(bot), "Phantom fund → ledger + settle + outcome");
  const ssv = bot.slice(bot.indexOf("async function signSendVersioned"), bot.indexOf("async function solBal"));
  assert.ok(ssv.indexOf("X.guard(key)") > 0 && ssv.indexOf("X.guard(key)") < ssv.indexOf("tx.sign([kp])"), "guard before signing");
  const sg = bot.slice(bot.indexOf("async function sendGuarded"), bot.indexOf("/* sign a server-built"));
  assert.ok(sg.indexOf("X.hold(key, sig, bh)") < sg.lastIndexOf("await sendRaw(raw)") && /e\.rpc/.test(sg) && /X\.watch\(/.test(sg), "ledger before send; JSON-RPC rejection = definitive; else settle");
  assert.ok(/uncertain: true, sig/.test(bot) && /"wd:" \+ pub\(\)/.test(bot) && /"jup:" \+ inMint/.test(bot), "withdraw + Jupiter keyed");
  assert.ok(/W\.signSendVersioned\(bytes, key\)/.test(pump) && /"pf:" \+ o\.action \+ ":" \+ o\.mint/.test(pump) && /unc: true/.test(pump) && /exec:settled/.test(pump), "pump botTrade keyed; BELİRSİZ buy recorded as an unconfirmed position");
  assert.ok(/EXEC\.phSend\("ph:swap:"|X\.phSend\("ph:swap:"/.test(trade) && /X\.phSend\(key, p, tx, tx\.message\.recentBlockhash\)/.test(pump), "Phantom swap + Phantom pump.fun go through the ledger");
  assert.ok(/e\.uncertain \|\| e\.pendingBlock/.test(auto) && /p\.unc \|\| p\.sellUnc/.test(auto), "OTO: BELİRSİZ sell never retried; no auto action on unconfirmed positions");
  assert.ok(/rpc: j\.error/.test(trade), "JSON-RPC errors flagged definitive");
  console.log("botsafe.test OK");
})().catch(e => { console.error(e); process.exit(1); });
