// v8.2.2 🖥 SUNUCU phone panel (compsrv.js) tests: node tests/compsrv.test.js
const fs = require("fs"), path = require("path"), X = require("../compsrv.js"), D = path.join(__dirname, ".."); let f = 0;
const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i !== undefined ? "  · " + i : "")); if (!c) f++; };
const T = "A".repeat(43);
{ const p = X.parsePair(`https://x.io/app/#comppair=${encodeURIComponent("https://abc123.localtolink.com")}|${T}`); ok("pairing link parses (url + token)", p && p.url === "https://abc123.localtolink.com" && p.token === T);
  ok("bare 'url|token' works", !!X.parsePair(`https://abc.example.com|${T}`));
  ok("http only for localhost", !X.parsePair(`http://evil.example.com|${T}`) && !!X.parsePair(`http://127.0.0.1:8898|${T}`));
  ok("rejects a short token, a path in the url, garbage", !X.parsePair(`https://a.b|short`) && !X.parsePair(`https://a.b/x|${T}`) && !X.parsePair("hello") && !X.parsePair("")); }
const src = fs.readFileSync(path.join(D, "compsrv.js"), "utf8"), code = src.replace(/\/\*[\s\S]*?\*\//g, "");
ok("compsrv.js never references GERÇEK / key / wallet modules or order endpoints", !/\b(TRADE|EXEC|AUTO|MEME|BKEYS|BFXSAFE|REMOTE|CONN\.(save|key))\b\.|fapi\/v1\/(order|batchOrders|leverage|algoOrder)|\/api\/trade|trade-local|sendTransaction|sendBundle|apiKey|api_key|secret/i.test(code));
ok("its only storage key is mermer.compsrv", (code.match(/mermer\.[a-z.]+/g) || []).every(k => k === "mermer.compsrv"), (code.match(/mermer\.[a-z.]+/g) || []).join());
ok("fetches only the paired server (POST text/plain) and ntfy.sh", (code.match(/fetch\(([^)]*)/g) || []).every(x => /P\.url \+ path|ntfy\.sh/.test(x)), (code.match(/fetch\(([^)]*)/g) || []).map(x => x.slice(0, 40)).join(" | "));
ok("calls only the SİM endpoints state / cfg / toggle / kill / reset", [...code.matchAll(/"(\/api\/[a-z]+)"/g)].every(m => /^\/api\/(state|cfg|toggle|kill|reset)$/.test(m[1])), [...code.matchAll(/"(\/api\/[a-z]+)"/g)].map(m => m[1]).join());
ok("reset asks for the typed word (CONN.typedConfirm)", /typedConfirm\("SUNUCU BİLEŞİK OTO SIFIRLA"[^)]*"SIFIRLA"\)/.test(code));
ok("pairing hash is stripped from the address bar", /history\.replaceState/.test(code));
const html = fs.readFileSync(path.join(D, "index.html"), "utf8");
ok("index.html: compsrv.js loads after comp.js; panel containers in SHORT + LONG", html.indexOf("compsrv.js") > html.indexOf("comp.js") && /id="cps-short"/.test(html) && /id="cps-long"/.test(html));
const ger = html.match(/<section id="(?:real|gercek|trade)[^>]*>[\s\S]*?<\/section>/i); ok("no SUNUCU panel inside a GERÇEK section", !ger || !/class="cps"/.test(ger[0]));
ok("local comp.js is unchanged by v8.2.1 (separate account stays untouched; hidden only while paired)", /body\.cps-on \.cp\{display:none\}/.test(fs.readFileSync(path.join(D, "meme.css"), "utf8")));
for (const fl of ["trade.js", "auto.js", "exec.js", "bkeys.js", "bfxsafe.js", "copy.js", "remote.js", "meme.js", "pump.js", "sert.js", "aksiyon.js", "sig8.js", "badge.js"]){ const s = fs.readFileSync(path.join(D, fl), "utf8"); ok(`${fl}: no compsrv / COMPSRV reference`, !/compsrv|COMPSRV|comppair/i.test(s)); }

ok("unpaired panel is an always-open card with a paste box and BAĞLAN (not a collapsed details)", /cps-unpaired/.test(src) && />BAĞLAN</.test(src) && !/data-cs="pair">EŞLE</.test(src) && src.indexOf("cps-unpaired") < src.indexOf("<details"));
ok("index.html: 🖥 SUNUCU sits ABOVE the local 🧪 panel in SHORT and LONG", html.indexOf('id="cps-short"') < html.indexOf('id="cp-short"') && html.indexOf('id="cps-long"') < html.indexOf('id="cp-long"'));
ok("a COMP pair link in the MEME SUNUCU box is detected and routed (hint + intercept); #pair= is left to remote.js", /sv-link/.test(src) && /Bu link SHORT sekmesindeki/.test(src) && /#sv-pair/.test(src) && /pairFrom/.test(src) && !/indexOf\("#pair="\)/.test(src));
ok("paints immediately (not after 1.5 s)", /paint\(\); setTimeout\(poll/.test(code) && !/setTimeout\(\(\) => \{ paint\(\); poll\(\); \}, 1500\)/.test(code));

console.log(f ? `\n${f} FAILED` : "\nall passed"); process.exit(f ? 1 : 0);
