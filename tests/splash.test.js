// v7.23 AÇILIŞ UYARISI (splash.js): node tests/splash.test.js
const s = require("fs").readFileSync(require("path").join(__dirname, "../splash.js"), "utf8"); let f = 0; const ok = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) f++; };
ok("texts", ["Trading Error", "TRADING'E HOŞ GELDİNİZ", "Hatanın mazeretle değil dolarla bedelini ödediğin yer", "Başlamaya hazır mısın?", "GERİ DÖN", "BAŞLA"].every(t => s.includes(t)));
ok("accessible: alertdialog, aria-modal, labelled/described, Escape + Tab trap", /alertdialog/.test(s) && /aria-modal/.test(s) && /aria-labelledby/.test(s) && /Escape/.test(s) && /"Tab"/.test(s));
ok("can be disabled (mermer.splash = off)", /mermer\.splash/.test(s) && /"off"/.test(s));
ok("pure overlay: no network, no trading, no keys", !/fetch\(|WebSocket|localStorage\.getItem\("(?!mermer\.splash)|SCALP|MEME\.|WALLET|EXEC|\border\b/i.test(s.replace(/KEY = "mermer\.splash"/, "")));
ok("sound only from a tap handler (ding() called inside joke)", (s.match(/ding\(\)/g) || []).length === 2);
console.log(f ? f + " FAIL" : "ALL PASS"); process.exit(f ? 1 : 0);
