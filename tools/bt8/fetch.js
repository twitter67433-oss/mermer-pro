const fs = require("fs"); const B = "https://fapi.binance.com", sleep = ms => new Promise(r => setTimeout(r, ms));
const DAYS = 120, END = Date.parse("2026-11-19T00:00:00Z"), START = END - DAYS*864e5;
async function j(u){ for (let k = 0; k < 5; k++){ const r = await fetch(u); if (r.ok) return r.json(); await sleep(1000*(k + 1)); } throw new Error("fail " + u); }
async function kl(sym, iv, ms){ const out = []; let t = START - 300*ms; while (t < END){ const a = await j(`${B}/fapi/v1/klines?symbol=${sym}&interval=${iv}&startTime=${t}&limit=1500`); if (!a.length) break;
    for (const x of a){ if (x[0] >= END) break; out.push([x[0], +x[1], +x[2], +x[3], +x[4], +x[5], x[6], +x[9]]); } t = a[a.length - 1][0] + ms; await sleep(120); if (a.length < 1500) break; } return out; }
(async () => { const ex = await j(B + "/fapi/v1/exchangeInfo"), tk = await j(B + "/fapi/v1/ticker/24hr");
  const ok = new Set(ex.symbols.filter(s => s.contractType === "PERPETUAL" && s.quoteAsset === "USDT" && s.status === "TRADING" && s.onboardDate < START - 30*864e5 && s.underlyingType === "COIN").map(s => s.symbol));
  const syms = tk.filter(t => ok.has(t.symbol)).sort((a, b) => +b.quoteVolume - +a.quoteVolume).slice(0, 40).map(t => t.symbol); if (!syms.includes("BTCUSDT")) syms.unshift("BTCUSDT");
  fs.writeFileSync("data/syms.json", JSON.stringify({ syms, START, END }));
  for (const s of syms){ for (const [iv, ms] of [["15m", 9e5], ["1h", 36e5], ["4h", 144e5]]){ const f = `data/${s}_${iv}.json`; if (fs.existsSync(f)) continue; fs.writeFileSync(f, JSON.stringify(await kl(s, iv, ms))); } process.stdout.write(s + " "); }
  console.log("\ndone", syms.length); })();
