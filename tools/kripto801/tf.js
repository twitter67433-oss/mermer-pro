const X = require("../../sert.js"), fs = require("fs"), B = "https://fapi.binance.com";
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fj(p){ for (let a = 0; a < 5; a++){ const r = await fetch(B + p); if (r.status === 429 || r.status === 418){ await sleep(30000); continue; } if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); } }
(async () => { const ei = await fj("/fapi/v1/exchangeInfo"), U = X.universe(ei), K = {}; for (const s of ei.symbols) K[s.symbol] = X.kind(s) || "KRİPTO";
  const out = {}; let i = 0; const now = Date.now();
  const work = async () => { while (i < U.length){ const s = U[i++]; try { const k = await fj(`/fapi/v1/klines?symbol=${s}&interval=15m&limit=500`);
    out[s] = { kind: K[s], b: k.filter(x => +x[6] < now).map(x => [+x[0], +x[1], +x[2], +x[3], +x[4], +x[7], +x[10]]) }; } catch(e){} await sleep(60); } };
  await Promise.all(Array.from({ length: 8 }, work)); fs.writeFileSync("bars.json", JSON.stringify({ now, out })); console.log("ok", Object.keys(out).length); })();
