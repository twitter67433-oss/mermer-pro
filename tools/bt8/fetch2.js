const fs = require("fs"); const B = "https://fapi.binance.com", sleep = ms => new Promise(r => setTimeout(r, ms));
const { syms, START, END } = JSON.parse(fs.readFileSync("data/syms.json"));
async function j(u){ for (let k = 0; k < 5; k++){ try { const r = await fetch(u); if (r.ok) return r.json(); } catch(e){} await sleep(1000*(k + 1)); } throw new Error("fail " + u); }
async function kl(sym, iv, ms){ const out = []; let t = START - 300*ms; while (t < END){ const a = await j(`${B}/fapi/v1/klines?symbol=${sym}&interval=${iv}&startTime=${t}&limit=1500`); if (!a.length) break;
    for (const x of a){ if (x[0] >= END) break; out.push([x[0], +x[1], +x[2], +x[3], +x[4], +x[5], x[6], +x[9]]); } t = a[a.length - 1][0] + ms; await sleep(100); if (a.length < 1500) break; } return out; }
(async () => { for (const s of syms){ for (const [iv, ms] of [["5m", 3e5], ["30m", 18e5], ["2h", 72e5], ["1d", 864e5]]){ const f = `data/${s}_${iv}.json`; if (fs.existsSync(f)) continue; fs.writeFileSync(f, JSON.stringify(await kl(s, iv, ms))); } process.stdout.write(s + " "); } console.log("\ndone"); })();
