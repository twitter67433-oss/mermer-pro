/* MERMER PRO validation data — public Binance USD-M GET endpoints only (no keys, no orders).
   node tools/pro/fetch.js [days=180] [nCoins=120]  → $MPRO_DATA (default /workspace/mpro-data)/<SYM>.json {s,b:[[t,o,h,l,c,v,qv,tbq]],fr:[[t,rate]]}
   Coin set = top-N USDT perpetuals by 24h quote volume, listed ≥ days+5 days ago (survivorship bias: today's survivors). Resumable. */
"use strict";
const fs = require("fs"), B = "https://fapi.binance.com", OUT = process.env.MPRO_DATA || "/workspace/mpro-data";
const DAYS = +(process.argv[2] || 180), N = +(process.argv[3] || 120), M15 = 900000, WARM = 400;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fj(p){ for (let a = 0; a < 6; a++){ try { const r = await fetch(B + p); if (r.status === 429 || r.status === 418){ await sleep(30000); continue; } if (!r.ok){ if (r.status === 400) return []; throw new Error("HTTP " + r.status); } return await r.json(); } catch(e){ if (a === 5) throw e; await sleep(2000); } } }
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const now = Date.now(), END = Math.floor(now/86400000)*86400000;          // last full UTC day boundary
  const START = END - DAYS*86400000;
  const info = await fj("/fapi/v1/exchangeInfo"), t24 = await fj("/fapi/v1/ticker/24hr");
  const qv = new Map(t24.map(x => [x.symbol, +x.quoteVolume]));
  const STABLE = /^(USDC|FDUSD|TUSD|BUSD|USDP|DAI|EUR|GBP|BTCDOM|DEFI|XAU|XAG|PAXG)/;
  const syms = info.symbols.filter(x => x.contractType === "PERPETUAL" && x.status === "TRADING" && x.quoteAsset === "USDT" && !STABLE.test(x.baseAsset) && x.onboardDate < START - (WARM*M15) - 5*86400000)
    .map(x => x.symbol).sort((a, b) => (qv.get(b) || 0) - (qv.get(a) || 0)).slice(0, N);
  if (!syms.includes("BTCUSDT")) syms.unshift("BTCUSDT");
  fs.writeFileSync(OUT + "/_meta.json", JSON.stringify({ start: START, end: END, days: DAYS, syms, made: now, note: "top-N by 24h quote volume on fetch day; survivorship bias" }));
  let i = 0, done = 0; const failed = [];
  const work = async () => { while (i < syms.length){ const s = syms[i++]; const f = `${OUT}/${s}.json`; if (fs.existsSync(f)){ done++; continue; }
    try { const b = []; let st = START - WARM*M15;
      while (st < END){ const k = await fj(`/fapi/v1/klines?symbol=${s}&interval=15m&limit=1500&startTime=${st}&endTime=${END - 1}`); if (!k.length) break;
        for (const x of k) b.push([+x[0], +x[1], +x[2], +x[3], +x[4], +x[5], +x[7], +x[10]]); st = +k[k.length - 1][0] + M15; if (k.length < 1500) break; await sleep(50); }
      const fr = []; let fs0 = START - 86400000;
      while (fs0 < END){ const r = await fj(`/fapi/v1/fundingRate?symbol=${s}&startTime=${fs0}&endTime=${END}&limit=1000`); if (!r.length) break; for (const x of r) fr.push([+x.fundingTime, +x.fundingRate]); fs0 = +r[r.length - 1].fundingTime + 1; if (r.length < 1000) break; }
      fs.writeFileSync(f, JSON.stringify({ s, b, fr }));
    } catch(e){ failed.push(s + ":" + e.message); }
    if (++done % 10 === 0) console.error(done, "/", syms.length, "failed", failed.length); await sleep(30); } };
  await Promise.all(Array.from({ length: 4 }, work));
  console.error("done", done, "failed:", failed.join(" "));
})();
