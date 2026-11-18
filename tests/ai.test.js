// v7.16 AI provider layer tests: node tests/ai.test.js
const A = require("../ai.js"), fs = require("fs"); let f = 0; const ok = (n, c, i) => { console.log((c ? "PASS " : "FAIL ") + n + (i !== undefined ? "  · " + i : "")); if (!c) f++; };
const LS = o => { const m = new Map(Object.entries(o || {})); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
// migration of the old xAI-only settings
{ const ls = LS({ "neon.xai.key": "xai-OLD", "neon.xai.model": "grok-4.6" }), c = A.load(ls), e = A.eff(c);
  ok("migration: old xAI key becomes provider xai with its model", c.prov === "xai" && e.key === "xai-OLD" && e.model === "grok-4.6" && e.base === "https://api.x.ai/v1" && A.ready(e));
  ok("migration: saved once, old key left in place (nothing breaks)", !!ls.getItem(A.CK) && ls.getItem("neon.xai.key") === "xai-OLD");
  const c2 = A.load(ls); ok("migration: runs once (second load keeps config)", c2.prov === "xai" && c2.keys.xai === "xai-OLD"); }
{ const c = A.load(LS()); ok("fresh install: default provider Groq (free tier), not ready without key", c.prov === "groq" && !A.ready(A.eff(c))); }
// presets
ok("presets: every ORDER entry exists, OpenAI-compatible ones have https base + default model", A.ORDER.every(k => A.PRESETS[k]) && A.ORDER.filter(k => !A.PRESETS[k].custom && !A.PRESETS[k].local).every(k => /^https:\/\//.test(A.PRESETS[k].base) && A.PRESETS[k].model));
ok("presets: OpenRouter default is a :free model; Gemini uses its OpenAI-compatible endpoint", /:free$/.test(A.PRESETS.openrouter.model) && /generativelanguage\.googleapis\.com\/v1beta\/openai$/.test(A.PRESETS.gemini.base));
// request building
{ const c = A.load(LS()); c.prov = "gemini"; c.keys.gemini = "G"; const e = A.eff(c), r = A.buildReq(e, [{ role: "system", content: "s" }, { role: "user", content: "u" }], { stream: true, max_tokens: 9 });
  ok("openai-compatible: POST {base}/chat/completions, only authorization + content-type headers (Gemini CORS)", r.url === "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" && Object.keys(r.headers).sort().join() === "authorization,content-type" && r.headers.authorization === "Bearer G" && r.body.stream === true && r.body.model === "gemini-2.5-flash" && r.body.max_tokens === 9);
  c.prov = "custom"; c.bases.custom = "https://my.host/v1/"; c.models.custom = "m1"; c.keys.custom = "K"; const ec = A.eff(c); ok("custom: base URL trailing slash trimmed, model + key used", A.buildReq(ec, [{ role: "user", content: "x" }]).url === "https://my.host/v1/chat/completions" && A.ready(ec));
  c.prov = "ollama"; const eo = A.eff(c); ok("local Ollama: no key needed, no authorization header", A.ready(eo) && !A.buildReq(eo, [{ role: "user", content: "x" }]).headers.authorization);
  c.prov = "anthropic"; c.keys.anthropic = "sk-ant"; const ea = A.eff(c), ra = A.buildReq(ea, [{ role: "system", content: "S1" }, { role: "system", content: "S2" }, { role: "user", content: "hi" }, { role: "assistant", content: "yo" }], { stream: true });
  ok("anthropic: native /messages, system joined, x-api-key + version + browser header, max_tokens set", ra.url === "https://api.anthropic.com/v1/messages" && ra.body.system === "S1\n\nS2" && ra.body.messages.length === 2 && ra.headers["x-api-key"] === "sk-ant" && ra.headers["anthropic-version"] && ra.headers["anthropic-dangerous-direct-browser-access"] === "true" && ra.body.max_tokens > 0 && !ra.headers.authorization); }
// parsing
ok("stream parse: OpenAI delta + Anthropic content_block_delta", A.sseDelta("openai", '{"choices":[{"delta":{"content":"ab"}}]}') === "ab" && A.sseDelta("anthropic", '{"type":"content_block_delta","delta":{"type":"text_delta","text":"cd"}}') === "cd" && A.sseDelta("openai", "garbage") === "");
ok("full parse: OpenAI message + Anthropic content", A.fullText("openai", { choices: [{ message: { content: "x" } }] }) === "x" && A.fullText("anthropic", { content: [{ type: "text", text: "y" }] }) === "y");
ok("errors: 401 → anahtar geçersiz, 429 → kota", /anahtar geçersiz/.test(A.errText(A.eff(A.load(LS())), 401, "")) && /kota/.test(A.errText(A.eff(A.load(LS())), 429, "")));
ok("model list: Gemini 'models/' prefix stripped", A.modelIds("openai", { data: [{ id: "models/gemini-2.5-flash" }] })[0] === "gemini-2.5-flash");
// advisory only: the AI module has no trading/order/wallet code paths
{ const src = fs.readFileSync(__dirname + "/../ai.js", "utf8");
  ok("advisory only: ai.js never calls exec/wallet/order code (only MEME.applySuggestion on a user tap, MEME.context for reading)", !/EXEC\.|WALLET\.|pumpportal\.fun|signTransaction|sendTransaction|\/order|placeOrder|MEME\.manual|MEME\.enter/.test(src) && (src.match(/MEME\.applySuggestion/g) || []).length === 1 && /data-ap/.test(src));
  ok("keys: nothing that looks like a real API key in the source", !/(xai|gsk|sk-or|sk-ant|AIza)[-_A-Za-z0-9]{20,}/.test(src)); }
console.log(f ? f + " FAIL" : "ALL PASS"); process.exit(f ? 1 : 0);
