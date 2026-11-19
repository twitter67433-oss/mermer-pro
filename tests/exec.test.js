/* v7.40 FAZ 2 E/J — Solana tx timeout = BELİRSİZ (not failed), poll until the blockhash expires, never resend while pending; preflight on by default (spec 21–23) */
const assert = require("assert"), fs = require("fs"), path = require("path"), vm = require("vm"), D = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(D, "exec.js"), "utf8");
const a = src.indexOf("async function settle("), b = src.indexOf("/* pending ledger", a); assert.ok(a > 0 && b > a);
const ctx = {}; vm.createContext(ctx); vm.runInContext(src.slice(a, b) + "\nthis.settle = settle;", ctx); const settle = ctx.settle;
function io(script){ let t = 0, n = 0; return { now: () => t, sleep: async ms => { t += ms; }, status: async () => script.status(n++, t), bhValid: async () => script.bh(t) }; }
(async () => {
  assert.strictEqual((await settle(io({ status: n => n < 3 ? null : { confirmationStatus: "confirmed" }, bh: () => true }), "S", "BH", { step: 1000 })).state, "CONFIRMED");
  assert.strictEqual((await settle(io({ status: () => ({ err: { InstructionError: [0, "x"] } }), bh: () => true }), "S", "BH")).state, "FAILED");
  // never seen + blockhash expired → EXPIRED (safe to retry), but only after the blockhash really expired
  { const r = await settle(io({ status: () => null, bh: t => t < 70000 }), "S", "BH", { step: 1000, minBh: 20000 }); assert.strictEqual(r.state, "EXPIRED"); }
  // RPC dead and blockhash unknown → UNKNOWN (BELİRSİZ) at the cap — never "failed"
  { const r = await settle(io({ status: () => { throw new Error("rpc down"); }, bh: () => { throw new Error("rpc down"); } }), "S", "BH", { step: 1000, cap: 30000 }); assert.strictEqual(r.state, "UNKNOWN"); }
  // landed late (after the 40 s window) is still found
  assert.strictEqual((await settle(io({ status: (n, t) => t > 50000 ? { confirmationStatus: "finalized" } : null, bh: () => true }), "S", "BH", { step: 1000 })).state, "CONFIRMED");
  // source contracts
  assert.ok(/skipPre: false/.test(src) && /C\.pv \| 0\) < 1\)\{ C\.skipPre = false/.test(src.replace(/\s+/g, " ").replace("(C.pv|0)", "C.pv | 0)")) || /\(C\.pv\|0\) < 1\)\{ C\.skipPre = false/.test(src), "preflight on by default + migration");
  assert.ok(/pendingBlock/.test(src) && /PEND\[key\] = \{ sig, bh/.test(src), "pending ledger written before send");
  assert.ok(src.indexOf("PEND[key] = { sig, bh") < src.indexOf("const ps = [fan(raw)]"), "ledger before fan-out");
  assert.ok(/uncertain/.test(src) && /bgSettle\(key, sig, bh\)/.test(src), "timeout → background settle, not failure");
  const mm = fs.readFileSync(path.join(D, "meme.js"), "utf8");
  assert.ok(/e\.uncertain/.test(mm) && /exec:settled/.test(mm) && /tekrar ALINMAYACAK/.test(mm), "meme treats BELİRSİZ buy as a held position");
  assert.ok(/p\.sellUnc \|\| \(X\(\)\.pending/.test(mm), "no sell resend while pending");
  assert.ok(/skipPre" && v === true && !window\.confirm/.test(mm), "skipPreflight needs explicit confirm");
  // D: SIM capital never silently copies a stale real balance
  assert.ok(!/SIM_FALLBACK/.test(mm) && !/b \|\| SIM_/.test(mm), "no real-balance fallback for SIM");
  assert.ok(/SANAL sermaye değişmedi/.test(mm));
  console.log("exec.test OK");
})().catch(e => { console.error(e); process.exit(1); });
