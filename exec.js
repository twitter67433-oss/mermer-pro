/* NEON//TERMINAL v6 — EXECUTOR: the low-latency path from an event to a signed, sent and confirmed Solana transaction.
   • blockhash cache refreshed every ~2 s (used for Jito tip txs; also a live RPC health/RTT probe)
   • the bot keypair stays decrypted in memory for the session (WALLET), signing is local (<5 ms)
   • PumpPortal trade-local builds the swap (priority fee inside); optional pre-built txs (candidate buys / open-position sells)
   • the signed bytes are fanned out in parallel to every RPC (custom e.g. Helius first) + optional Jito bundle (trade + tip)
   • confirmation: WebSocket signatureSubscribe, with getSignatureStatuses polling as fallback
   • every trade records latency: event→sent, sent→confirmed (+ build / sign split)
   SIM mode uses the same live market data and fills on the bonding-curve state AFTER the measured/modelled latency,
   with pump.fun fee, PumpPortal fee, priority + base fee and token-account rent — nothing is sent in SIM. */
"use strict";
const EXEC = (() => {
const T = () => window.TRADE, W = () => window.WALLET;
const now = () => performance.now();
const K = "neon.exec";
const DEF = { rpc: "", ws: "", jito: false, tip: 0.0001, skipPre: false, fan: true, simDelay: 600, dryPipe: true }; /* v7.40: preflight ON by default (skipPre = advanced, with a warning) */
let C = Object.assign({}, DEF, (() => { try { return JSON.parse(localStorage.getItem(K) || "{}"); } catch(e){ return {}; } })());
if (!C.rpc){ const old = (localStorage.getItem("neon.rpc") || "").trim(); if (/^https:\/\//.test(old)) C.rpc = old; }
/* v7.40 migration (once): skipPreflight was ON by default before — switch it OFF so the RPC simulates every GERÇEK tx before it lands; the user can re-enable it in the advanced settings */
if ((C.pv|0) < 1){ C.skipPre = false; C.pv = 1; try { localStorage.setItem(K, JSON.stringify(C)); } catch(e){} }
function set(o){ Object.assign(C, o); localStorage.setItem(K, JSON.stringify(C)); if (C.rpc) localStorage.setItem("neon.rpc", C.rpc); else localStorage.removeItem("neon.rpc"); }
/* api.mainnet-beta.solana.com answers 403 to any browser Origin (HTTP and WS, checked 2026-11-10) → not used from the page */
const PUB = ["https://solana-rpc.publicnode.com", "https://solana-mainnet.gateway.tatum.io"];
const JITO = "https://mainnet.block-engine.jito.wtf/api/v1";
const rpcs = () => (/^https:\/\//.test(C.rpc) ? [C.rpc] : []).concat(PUB);
const wsUrl = () => /^wss:\/\//.test(C.ws) ? C.ws : "wss://solana-rpc.publicnode.com";
const host = u => { try { return new URL(u).host.replace(/^(solana-|api\.)/, "").split(".")[0]; } catch(e){ return "?"; } };
const ST = { bh: null, bhAt: 0, bhRtt: null, bhVia: null, bhErr: 0, rtt: new Map(), lat: [], pend: 0, sent: 0, conf: 0, fail: 0, pre: new Map(), tips: null, keepT: null, last: null };
const b64 = b => { let s = ""; const u = new Uint8Array(b); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
async function post(u, method, params, ms = 4000){ const t0 = now(); const r = await fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(ms) });
  const dt = now() - t0, e = ST.rtt.get(u) || { ms: dt, ok: 0, bad: 0 }; if (r.status !== 200){ e.bad++; ST.rtt.set(u, e); throw new Error(host(u) + " HTTP " + r.status); }
  const j = await r.json(); e.ms = e.ms*0.7 + dt*0.3; e.ok++; ST.rtt.set(u, e); if (j.error) throw Object.assign(new Error(j.error.message), { rpc: j.error }); return j.result; }
/* ---------------- blockhash cache (~2 s) ---------------- */
/* every 2 s only the primary RPC (custom or publicnode) is asked; the others are raced only after a failure — free RPCs rate-limit (429) otherwise */
async function refreshBh(){ const all = rpcs(), L = ST.bhErr ? all : all.slice(0, 1); const t0 = now();
  try { const r = await Promise.any(L.map(u => post(u, "getLatestBlockhash", [{ commitment: "confirmed" }], 2500).then(x => ({ x, u }))));
    ST.bh = r.x.value; ST.bhAt = Date.now(); ST.bhRtt = now() - t0; ST.bhVia = host(r.u); ST.bhErr = 0; } catch(e){ ST.bhErr++; } }
function keepWarm(on){ clearInterval(ST.keepT); ST.keepT = null; if (on){ refreshBh(); ST.keepT = setInterval(() => { if (!document.hidden) refreshBh(); }, 2000); } }
const bhAge = () => ST.bhAt ? Date.now() - ST.bhAt : null;
/* ---------------- WS signature confirmations ---------------- */
const SW = { ws: null, open: false, id: 1, req: new Map(), sub: new Map(), q: [] };
function swOpen(){ if (SW.ws) return; const ws = new WebSocket(wsUrl()); SW.ws = ws;
  ws.onopen = () => { SW.open = true; SW.q.splice(0).forEach(f => f()); };
  ws.onmessage = ev => { let j; try { j = JSON.parse(ev.data); } catch(e){ return; }
    if (j.id && SW.req.has(j.id)){ const w = SW.req.get(j.id); SW.req.delete(j.id); if (typeof j.result === "number") SW.sub.set(j.result, w); return; }
    if (j.method === "signatureNotification"){ const w = SW.sub.get(j.params.subscription); if (w){ SW.sub.delete(j.params.subscription); w(j.params.result.value); } } };
  ws.onclose = () => { SW.ws = null; SW.open = false; SW.sub.clear(); }; ws.onerror = () => {}; }
function wsWait(sig){ return new Promise(res => { const go = () => { const id = SW.id++; SW.req.set(id, res); SW.ws.send(JSON.stringify({ jsonrpc: "2.0", id, method: "signatureSubscribe", params: [sig, { commitment: "confirmed" }] })); };
  swOpen(); SW.open ? go() : SW.q.push(go); }); }
/* v7.40: a timeout is NOT a failure. settle() keeps checking getSignatureStatuses (and the WS notification) until the tx is confirmed / failed,
   or until its blockhash is no longer valid (isBlockhashValid = false → it can never land → EXPIRED). Only then is the outcome final.
   If the RPCs cannot answer at all within the hard cap the result is BELİRSİZ: nothing is resent, the key stays blocked and a background check continues. */
const SETTLE = { CONFIRMED: "ONAYLANDI", FAILED: "BAŞARISIZ", EXPIRED: "SÜRESİ DOLDU", UNKNOWN: "BELİRSİZ" };
async function settle(io, sig, bh, o = {}){ const t0 = io.now(), cap = o.cap || 120000, minBh = o.minBh ?? 20000, step = o.step || 900; let rpcOk = false, bhOk = null;
  while (io.now() - t0 < cap){
    if (io.ws && io.ws.done){ const v = io.ws.value; return v && v.err ? { state: "FAILED", err: v.err, via: "ws" } : { state: "CONFIRMED", via: "ws" }; }
    try { const s = await io.status(sig); rpcOk = true; if (s){ if (s.err) return { state: "FAILED", err: s.err, via: "poll" }; if (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized") return { state: "CONFIRMED", via: "poll" }; } } catch(e){}
    if (bh && io.now() - t0 >= minBh){ try { bhOk = await io.bhValid(bh); } catch(e){ bhOk = null; }
      if (bhOk === false){ try { const s = await io.status(sig); if (s && s.err) return { state: "FAILED", err: s.err, via: "poll" }; if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return { state: "CONFIRMED", via: "poll" }; if (s) { await io.sleep(step); continue; } } catch(e){ await io.sleep(step); continue; }
        return { state: "EXPIRED" }; } }
    await io.sleep(step); }
  return { state: "UNKNOWN", rpcOk }; }
/* pending ledger (idempotency): key = "<buy|sell>:<mint>" → { sig, bh, t }. While a key is pending, real() refuses to send that action again. */
const PK = "neon.exec.pend"; let PEND = (() => { try { return JSON.parse(localStorage.getItem(PK) || "{}") || {}; } catch(e){ return {}; } })();
const pendSave = () => { try { localStorage.setItem(PK, JSON.stringify(PEND)); } catch(e){} };
const pending = key => { const e = PEND[key]; if (e && Date.now() - e.t > 30*60000){ delete PEND[key]; pendSave(); return null; } return e || null; };
function io(sig){ const w = { done: false, value: null }; wsWait(sig).then(v => { w.done = true; w.value = v; }).catch(() => {});
  return { now: () => Date.now(), sleep: ms => new Promise(r => setTimeout(r, ms)), ws: w,
    status: async s => { const r = await T().ph.rpc("getSignatureStatuses", [[s], { searchTransactionHistory: true }]); return r && r.value && r.value[0]; },
    bhValid: async bh => { const r = await T().ph.rpc("isBlockhashValid", [bh, { commitment: "processed" }]); return r && typeof r.value === "boolean" ? r.value : null; } }; }
function bgSettle(key, sig, bh){ (async () => { const r = await settle(io(sig), sig, bh, { cap: 15*60000, minBh: 0, step: 5000 }); if (r.state === "UNKNOWN") return; /* stays pending; expires from the ledger after 30 min */
    delete PEND[key]; pendSave(); try { window.dispatchEvent(new CustomEvent("exec:settled", { detail: { key, sig, state: r.state, err: r.err || null } })); } catch(e){} })(); }
async function confirm(sig, ms = 40000, bh){ const r = await settle(io(sig), sig, bh, { cap: bh ? Math.max(ms, 90000) : ms });
  if (r.state === "CONFIRMED") return r.via;
  if (r.state === "FAILED") throw Object.assign(new Error("işlem zincirde başarısız: " + JSON.stringify(r.err)), { chain: true, final: true });
  if (r.state === "EXPIRED") throw Object.assign(new Error("işlem zincire girmedi (blockhash süresi doldu) — gönderilmemiş sayılır"), { expired: true, final: true });
  throw Object.assign(new Error("onay BELİRSİZ: RPC yanıt vermedi — işlem gerçekleşmiş olabilir; tekrar GÖNDERİLMEDİ, arka planda kontrol ediliyor (Solscan: " + sig.slice(0, 10) + "…)"), { uncertain: true, sig }); }
/* ---------------- send fan-out ---------------- */
async function fan(raw){ const L = C.fan ? rpcs() : rpcs().slice(0, 1), enc = b64(raw);
  const opts = { encoding: "base64", skipPreflight: !!C.skipPre, preflightCommitment: "processed", maxRetries: 3 };
  const ps = L.map(u => post(u, "sendTransaction", [enc, opts], 6000).then(() => host(u)));
  try { return await Promise.any(ps); } catch(e){ const all = e.errors || [e], errs = all.map(x => x.message);
    /* every RPC answered with a JSON-RPC error (e.g. preflight simulation failed) → definitively not sent; a network error/timeout on any RPC = maybe sent */
    throw Object.assign(new Error("gönderilemedi: " + errs.join(" | ").slice(0, 220)), { final: all.length > 0 && all.every(x => x && x.rpc) }); } }
async function tipAccounts(){ if (ST.tips) return ST.tips; ST.tips = await post(JITO + "/bundles", "getTipAccounts", [], 4000); return ST.tips; }
async function jitoBundle(raw){ const w3 = await T().ph.web3(), kp = W().kpPub; if (!kp) throw new Error("kilitli");
  if (!ST.bh || bhAge() > 20000) await refreshBh(); const acc = (await tipAccounts())[Math.floor(Math.random()*8)];
  const tip = new w3.Transaction({ feePayer: kp, recentBlockhash: ST.bh.blockhash }).add(w3.SystemProgram.transfer({ fromPubkey: kp, toPubkey: new w3.PublicKey(acc), lamports: Math.round(C.tip*1e9) }));
  W().sign(tip); await post(JITO + "/bundles", "sendBundle", [[b64(raw), b64(tip.serialize())], { encoding: "base64" }], 6000); return "jito"; }
/* ---------------- PumpPortal trade-local ---------------- */
async function build(pub, o){ const r = await fetch("https://pumpportal.fun/api/trade-local", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicKey: pub, action: o.action, mint: o.mint, amount: o.amount, denominatedInSol: o.denominatedInSol, slippage: o.slip, priorityFee: o.prio, pool: o.pool || "auto" }), signal: AbortSignal.timeout(8000) });
  if (r.status !== 200){ const tx = await r.text().catch(() => ""); throw new Error("PumpPortal HTTP " + r.status + (tx ? ": " + tx.slice(0, 140) : "")); }
  return new Uint8Array(await r.arrayBuffer()); }
/* pre-build: key → { bytes, at, ref } (blockhash inside is valid ~60 s; we use ≤ 35 s) */
async function prebuild(key, o, ref){ if (!W().unlocked()) return; try { const bytes = await build(W().pub(), o); ST.pre.set(key, { bytes, at: Date.now(), ref, o }); } catch(e){} }
function takePre(key, ref, tolPct){ const p = ST.pre.get(key); ST.pre.delete(key); if (!p || Date.now() - p.at > 35000) return null;
  if (ref && p.ref && Math.abs(ref/p.ref - 1)*100 > tolPct) return null; return p.bytes; }
function record(m){ ST.lat.unshift(m); if (ST.lat.length > 60) ST.lat.length = 60; ST.last = m; try { sessionStorage.setItem("neon.lat", JSON.stringify(ST.lat.slice(0, 30))); } catch(e){} }
try { ST.lat = JSON.parse(sessionStorage.getItem("neon.lat") || "[]"); } catch(e){}
/* ---------------- REAL swap (bot wallet) ---------------- */
async function real(o, tEv, meta = {}){ const w = W(); if (!w || !w.unlocked()) throw new Error("BOT CÜZDANI kilitli ya da yok");
  const key = (meta.key || (o.action + ":" + o.mint)), pe = pending(key); if (pe) throw Object.assign(new Error(`önceki ${o.action === "buy" ? "alım" : "satış"} BELİRSİZ (${pe.sig.slice(0, 8)}…) — sonuç netleşmeden tekrar gönderilmez`), { pendingBlock: true, sig: pe.sig });
  const m = { t: Date.now(), mode: "GERÇEK", sym: o.sym, side: o.action, src: meta.src || "", pre: false };
  const t0 = tEv || now(); ST.pend++;
  try { let bytes = meta.preKey ? takePre(meta.preKey, meta.ref, (o.slip || 20)/3) : null; m.pre = !!bytes; const tb = now();
    if (!bytes) bytes = await build(w.pub(), o); m.build = now() - tb;
    const w3 = await T().ph.web3(); const ts = now(); const tx = w3.VersionedTransaction.deserialize(bytes); w.sign(tx); m.sign = now() - ts;
    const raw = tx.serialize(), sig = w.b58(tx.signatures[0]); m.sig = sig; const bh = tx.message && tx.message.recentBlockhash;
    PEND[key] = { sig, bh, t: Date.now() }; pendSave(); /* written BEFORE the send: a crash/reload mid-send still blocks a duplicate */
    const ps = [fan(raw)]; if (C.jito) ps.push(jitoBundle(raw).catch(() => null));
    const tSend = now(); m.via = await Promise.any(ps.map(p => p.then(v => { if (!v) throw 0; return v; }))).catch(e => { const f = e.errors && e.errors[0]; throw Object.assign(new Error((f && f.message) || e.message || "gönderilemedi"), { final: !C.jito && !!(f && f.final) }); });
    m.ev2sent = tSend - t0; m.ack = now() - tSend; ST.sent++; window.BUS && BUS.emit("order", { to: "pf", from: "bt" });
    let cv; try { cv = await confirm(sig, 40000, bh); } catch(e){ if (e.uncertain){ m.unc = true; bgSettle(key, sig, bh); } else { delete PEND[key]; pendSave(); } throw e; }
    delete PEND[key]; pendSave(); m.sent2conf = now() - tSend; m.confVia = cv; ST.conf++; m.ok = true; record(m);
    return { sig, m }; }
  catch(e){ ST.fail++; m.ok = false; m.err = e.message; record(m);
    if (e.final && PEND[key] && PEND[key].sig === m.sig){ delete PEND[key]; pendSave(); }
    else if (!e.uncertain && !e.pendingBlock && PEND[key] && !e.final){ /* send itself failed (no RPC accepted it) → check once more that it did not land, then release */ const pe = PEND[key]; bgSettle(key, pe.sig, pe.bh); }
    throw e; } finally { ST.pend--; } }
/* exact SOL / token delta of a confirmed bot tx (off the critical path) */
async function txDelta(sig, mint){ const pub = W().pub();
  for (let i = 0; i < 6; i++){ try { const tx = await T().ph.rpc("getTransaction", [sig, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]);
      if (tx && tx.meta){ const keys = tx.transaction.message.accountKeys.map(k => k.pubkey || k), i0 = keys.indexOf(pub); const sol = i0 >= 0 ? (tx.meta.postBalances[i0] - tx.meta.preBalances[i0])/1e9 : null;
        const tb = a => (a || []).filter(b => b.mint === mint && b.owner === pub).reduce((s, b) => s + (+b.uiTokenAmount.uiAmount || 0), 0);
        return { sol, tokens: tb(tx.meta.postTokenBalances), tokDelta: tb(tx.meta.postTokenBalances) - tb(tx.meta.preTokenBalances) }; } } catch(e){}
    await new Promise(r => setTimeout(r, 1200)); } return null; }
/* ---------------- SIM fill engine ---------------- */
const PUMP_FEE = 0.0125, PP_FEE = 0.005, BASE_FEE = 0.000005, RENT = 0.00203928;
let dryKp = null;
async function dry(o){ /* real pipeline minus the send: build at PumpPortal for a throw-away key + local sign → realistic latency */
  const w3 = await T().ph.web3(); dryKp = dryKp || w3.Keypair.generate(); const tb = now(); const bytes = await build(dryKp.publicKey.toBase58(), o); const b = now() - tb;
  const ts = now(); const tx = w3.VersionedTransaction.deserialize(bytes); tx.sign([dryKp]); tx.serialize(); return { build: b, sign: now() - ts }; }
const buyOut = (c, sol) => { const eff = sol*(1 - PUMP_FEE); return c.vTok - c.vSol*c.vTok/(c.vSol + eff); };
const sellOut = (c, tok) => Math.max(0, (c.vSol - c.vSol*c.vTok/(c.vTok + tok))*(1 - PUMP_FEE));
/* o: { action, sol (buy) | tokens (sell), slip, prio, sym, mint }, getC(): latest curve state, c0: state at decision time */
async function sim(o, getC, c0, tEv, meta = {}){ const m = { t: Date.now(), mode: "SIM", sym: o.sym, side: o.action, src: meta.src || "", pre: false, sim: true }; const t0 = tEv || now(); ST.pend++;
  try { if (C.dryPipe && o.mint){ try { const d = await dry({ action: o.action, mint: o.mint, amount: o.action === "buy" ? o.sol : "100%", denominatedInSol: o.action === "buy" ? "true" : "false", slip: o.slip, prio: o.prio, pool: "auto" }); m.build = d.build; m.sign = d.sign; m.dry = true; } catch(e){ m.dryErr = e.message; } }
    const tSend = now(); m.ev2sent = tSend - t0; m.via = "SIM";
    await new Promise(r => setTimeout(r, Math.max(150, +C.simDelay || 600))); /* modelled network + slot time to landing */
    const c = getC() || c0; if (!c) throw new Error("curve verisi yok");
    const fee = (o.prio || 0) + BASE_FEE + (C.jito ? (+C.tip || 0) + BASE_FEE : 0); /* v7.7: same costs as GERÇEK incl. the Jito tip tx when Jito is on */
    let res; if (o.action === "buy"){ if (c.complete) throw new Error("curve tamamlandı (AMM) — SIM alım yok");
      const tok = buyOut(c, o.sol), exp = c0 ? buyOut(c0, o.sol) : tok;
      if (tok < exp*(1 - o.slip/100)) throw new Error(`kayma aşıldı (beklenen ${exp.toFixed(0)}, dolum ${tok.toFixed(0)})`);
      const hc = Math.max(0, Math.min(0.3, +meta.hc || 0)), tokH = tok*(1 - hc); m.hc = hc; /* v7.5 SIM haircut: adverse fill / MEV on fast moves */
      const cost = o.sol*(1 + PP_FEE) + fee + (meta.newAta ? RENT : 0); res = { tokens: tokH, sol: -cost, px: o.sol/tokH }; }
    else { let out = c.complete ? o.tokens*(c.vSol/c.vTok)*(1 - 0.02) : sellOut(c, o.tokens), exp = c0 ? sellOut(c0, o.tokens) : out;
      if (out < exp*(1 - o.slip/100)) out = exp*(1 - o.slip/100); /* real tx would fail; we assume the retry fills at the slippage limit */
      const hc = Math.max(0, Math.min(0.3, +meta.hc || 0)); out *= (1 - hc); m.hc = hc;
      res = { tokens: -o.tokens, sol: Math.max(0, out*(1 - PP_FEE) - fee), px: out/o.tokens }; }
    m.sent2conf = now() - tSend; m.ok = true; ST.sent++; ST.conf++; record(m); window.BUS && BUS.emit("order", { to: "pf", from: "bt" }); return Object.assign(res, { m }); }
  catch(e){ ST.fail++; m.ok = false; m.err = e.message; record(m); throw e; } finally { ST.pend--; } }
/* ---------------- latency probe (nothing is sent) ---------------- */
async function probe(mint){ const out = [];
  for (const u of rpcs()){ const t0 = now(); try { await post(u, "getLatestBlockhash", [{ commitment: "confirmed" }], 4000); out.push([host(u) + " · blockhash", now() - t0, true]); } catch(e){ out.push([host(u) + " · " + e.message.slice(0, 40), now() - t0, false]); } }
  { const t0 = now(); try { await post(JITO + "/bundles", "getTipAccounts", [], 4000); out.push(["jito · tip hesapları", now() - t0, true]); } catch(e){ out.push(["jito · " + e.message.slice(0, 40), now() - t0, false]); } }
  if (mint){ try { const d = await dry({ action: "buy", mint, amount: 0.01, denominatedInSol: "true", slip: 20, prio: 0.0005, pool: "auto" }); out.push(["PumpPortal trade-local (hazırla)", d.build, true]); out.push(["yerel imza", d.sign, true]); } catch(e){ out.push(["PumpPortal · " + e.message.slice(0, 50), 0, false]); } }
  return out; }
const stats = () => { const ok = ST.lat.filter(x => x.ok), avg = k => { const v = ok.map(x => x[k]).filter(x => isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0)/v.length : null; };
  return { n: ST.lat.length, ok: ok.length, ev2sent: avg("ev2sent"), sent2conf: avg("sent2conf"), build: avg("build"), pend: ST.pend, sent: ST.sent, conf: ST.conf, fail: ST.fail, bhAge: bhAge(), bhRtt: ST.bhRtt, bhVia: ST.bhVia, rtt: [...ST.rtt].map(([u, e]) => [host(u), e.ms, e.ok, e.bad]) }; };
/* v8.0 shared guard for every other GERÇEK Solana path (bot-wallet pump.fun / Jupiter / withdraw, Phantom signAndSend): same ledger + same settle → never resent while BELİRSİZ */
function guard(key){ const pe = pending(key); if (pe) throw Object.assign(new Error(`önceki işlem BELİRSİZ (${String(pe.sig).slice(0, 10)}…) — sonuç netleşmeden tekrar gönderilmez`), { pendingBlock: true, sig: pe.sig }); }
function hold(key, sig, bh){ PEND[key] = { sig: sig || "(gönderiliyor)", bh: bh || null, t: Date.now() }; pendSave(); }
function release(key, sig){ const e = PEND[key]; if (e && (!sig || e.sig === sig || e.sig === "(gönderiliyor)")){ delete PEND[key]; pendSave(); } }
/* never throws: CONFIRMED | FAILED | EXPIRED (both definitive → ledger released) | BELİRSİZ (ledger kept, background settle → "exec:settled") */
async function watch(key, sig, bh, ms = 40000){ try { const via = await confirm(sig, ms, bh); release(key, sig); return { state: "CONFIRMED", via }; }
  catch(e){ if (e.uncertain){ bgSettle(key, sig, bh); return { state: "BELİRSİZ", err: e.message }; } release(key, sig); return { state: e.expired ? "EXPIRED" : "FAILED", err: e.message }; } }
/* Phantom signs AND sends (we never see the bytes go out): ledger entry before the popup, released if Phantom refuses; then the same settle. Returns { sig, state, err }. */
async function phSend(key, prov, tx, bh){ guard(key); hold(key, null, bh); let sig; try { const r = await prov.signAndSendTransaction(tx); sig = String((r && r.signature) || r); } catch(e){ release(key); throw e; }
  hold(key, sig, bh); window.BUS && BUS.emit("order", { to: "ph" }); const w = await watch(key, sig, bh); return Object.assign({ sig }, w); }
return { phSend, guard, hold, release, watch, bgSettle, get C(){ return C; }, set, real, sim, settle, SETTLE, pending, get PEND(){ return PEND; }, txDelta, prebuild, takePre, keepWarm, refreshBh, probe, stats, confirm, buyOut, sellOut, get lat(){ return ST.lat; }, rpcs, wsUrl, PUMP_FEE, PP_FEE, RENT, BASE_FEE, _ST: ST };
})();
window.EXEC = EXEC;
