/* v7.40 FAZ 2 B — Binance secret at rest: AES-256-GCM / PBKDF2-SHA256, PIN, migration from plaintext, no plaintext after save (spec 31, 33–35) */
const assert = require("assert"), fs = require("fs"), path = require("path"), K = require("../bkeys.js"), D = path.join(__dirname, "..");
(async () => {
  const SECRET = "s3cr3t-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdef", PIN = "482913";
  const e = await K.enc(SECRET, PIN, 1000); assert.ok(e.ct && e.iv && e.salt && e.kdf === "PBKDF2-SHA256"); assert.ok(!JSON.stringify(e).includes(SECRET), "ciphertext only");
  assert.strictEqual(await K.dec(e, PIN), SECRET, "roundtrip");
  await assert.rejects(() => K.dec(e, "000000"), "wrong PIN must fail");
  const e2 = await K.enc(SECRET, PIN, 1000); assert.notStrictEqual(e.iv, e2.iv); assert.notStrictEqual(e.ct, e2.ct, "fresh salt/iv each time");
  await assert.rejects(() => K.enc(SECRET, "12"), "short PIN refused"); assert.ok(!K.pinOk("12345") && K.pinOk("123456"));
  assert.strictEqual(K.ITER, 300000);
  // migration: plaintext record → sealed record without the secret field
  const plain = { key: "APIKEY", secret: SECRET }; assert.strictEqual(K.state(plain, "real"), "plain");
  const sealed = await K.seal(plain, PIN, "real", 1000); assert.ok(sealed.enc && !("secret" in sealed) && !JSON.stringify(sealed).includes(SECRET));
  assert.strictEqual(K.state(sealed, "real"), "open", "unlocked for this session after sealing"); K.lock("real"); assert.strictEqual(K.state(sealed, "real"), "locked"); assert.strictEqual(K.secretOf(sealed, "real") || "", "");
  assert.strictEqual(await K.open(sealed, PIN, "real"), SECRET); assert.strictEqual(K.state(sealed, "real"), "open"); K.lock();
  assert.strictEqual(K.state(null), "none"); assert.strictEqual(K.state({ key: "k" }), "none");
  // source: trade.js never stores a plaintext secret; GERÇEK blocked while plaintext; nothing logs secrets
  const tr = fs.readFileSync(path.join(D, "trade.js"), "utf8"), cn = fs.readFileSync(path.join(D, "conn.js"), "utf8"), bk = fs.readFileSync(path.join(D, "bkeys.js"), "utf8");
  assert.ok(/function pset\([^)]*\)\{[^\n]*throw/.test(tr), "pset refuses plaintext");
  assert.ok(/düz metin/i.test(tr) && /ensureOpen/.test(tr), "GERÇEK needs encrypted + unlocked secret");
  for (const s of [tr, cn, bk, fs.readFileSync(path.join(D, "auto.js"), "utf8")]) assert.ok(!/console\.(log|info|debug|warn)\([^)]*(secret|pin|apiKey)/i.test(s), "no secret in console");
  const html = fs.readFileSync(path.join(D, "index.html"), "utf8");
  assert.ok(/http-equiv="Content-Security-Policy"/.test(html) && /object-src 'none'/.test(html) && /base-uri 'self'/.test(html), "CSP");
  assert.ok(html.indexOf("bkeys.js") < html.indexOf("trade.js") && html.indexOf("bfxsafe.js") < html.indexOf("trade.js"), "load order");
  console.log("bkeys.test OK");
})().catch(e => { console.error(e); process.exit(1); });
