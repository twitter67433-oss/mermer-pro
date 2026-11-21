/* v8.2 data fetch for the BİLEŞİK OTO backtest: last N Berlin days of REAL Binance USD-M 15m klines (crypto perps) + real 15m open-interest history + funding history.
   node tools/compound820/fetch.js [days=29] [outDir=/workspace/r820/data]. Public GET only. OI is fetched only for the windows that contain a candidate bar (the API allows 1000 calls / 5 min). */
const X = require("../../sert.js"), fs = require("fs"), B = "https://fapi.binance.com", DAYS = +(process.argv[2] || 29), OUT = process.argv[3] || "/workspace/r820/data";
const sleep = ms => new Promise(r => setTimeout(r, ms));
let oiCalls = [];
async function fj(p, oi){ for (let a = 0; a < 6; a++){
    if (oi){ const n = Date.now(); oiCalls = oiCalls.filter(t => n - t < 300000); if (oiCalls.length >= 900){ await sleep(300000 - (n - oiCalls[0]) + 500); } oiCalls.push(Date.now()); }
    const r = await fetch(B + p); if (r.status === 429 || r.status === 418){ await sleep(30000); continue; } if (!r.ok){ if (r.status === 400) return []; throw new Error("HTTP " + r.status + " " + p); } return r.json(); } throw new Error("429"); }
const berlinMidnight = t => { const k = X.berlin ? null : null; const d = new Date(t); const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  /* find the UTC instant of Berlin 00:00 on that date */ let g = Date.parse(f + "T00:00:00Z") - 2*3600000; while (new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(g)) !== f) g += 3600000; 
  while (new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(g - 60000)) === f) g -= 60000; return g; };
(async () => {
  const ei = await fj("/fapi/v1/exchangeInfo"), U = X.universe(ei), KIND = {}; for (const s of ei.symbols) KIND[s.symbol] = X.kind(s);
  const crypto = U.filter(s => !KIND[s]); const now = Date.now(), end = berlinMidnight(now), from = end - DAYS*86400000;
  console.error("crypto perps", crypto.length, "from", new Date(from).toISOString(), "to", new Date(end).toISOString());
  fs.writeFileSync(OUT + "/_meta.json", JSON.stringify({ from, end, days: DAYS, fetched: now, n: crypto.length }));
  let i = 0, done = 0; const failed = [];
  const work = async () => { while (i < crypto.length){ const s = crypto[i++]; let old = null; if (fs.existsSync(`${OUT}/${s}.json`)){ old = JSON.parse(fs.readFileSync(`${OUT}/${s}.json`)); if (!old.nc || old.oi.length){ done++; continue; } } /* re-run: reuse stored klines when OI is missing */
    try { const need = Math.ceil((end - from)/900000) + 320; let bars = old ? old.b : [], et = end;
      while (!old && bars.length < need){ const k = await fj(`/fapi/v1/klines?symbol=${encodeURIComponent(s)}&interval=15m&limit=1500&endTime=${et - 1}`); if (!k.length) break; const part = k.filter(x => +x[6] < end).map(x => [+x[0], +x[1], +x[2], +x[3], +x[4], +x[7], +x[10]]); bars = part.concat(bars); et = +k[0][0]; if (k.length < 1500) break; await sleep(100); }
      bars = bars.filter(x => x[0] >= from - 320*900000).sort((a, b) => a[0] - b[0]);
      const b = bars.map(x => ({ t: x[0], o: x[1], h: x[2], l: x[3], c: x[4], qv: x[5], tb: x[6] }));
      const cand = []; for (let j = 100; j < b.length; j++){ if (b[j].t + 900000 <= from) continue; const f = X.feat(b.slice(Math.max(0, j - 299), j + 1), {}); if (f && X.LISTS.some(l => !l.ext && X.preK(l.k, f))) cand.push(b[j].t + 900000); }
      let oi = [], fr = [];
      if (cand.length){ /* windows of 500 × 15m ending at each 5.2-day boundary that contains a candidate (+1h lookback) */
        const W = 500*900000, w0 = from - 3600000, need2 = new Set(); for (const c of cand){ need2.add(Math.floor((c - w0)/W)); need2.add(Math.floor((c - 3600000 - w0)/W)); }
        for (const w of [...need2].sort((a, b) => a - b)){ const st = w0 + w*W, en = Math.min(st + W, end + 900000); if (st > now) continue;
          const o = await fj(`/futures/data/openInterestHist?symbol=${encodeURIComponent(s)}&period=15m&limit=500&startTime=${Math.floor(Math.max(st, now - 29.9*86400000))}&endTime=${en}`, true); for (const x of o) oi.push([+x.timestamp, +x.sumOpenInterest]); await sleep(60); }
        oi.sort((a, b) => a[0] - b[0]); oi = oi.filter((x, n) => !n || x[0] !== oi[n - 1][0]);
        const f = await fj(`/fapi/v1/fundingRate?symbol=${encodeURIComponent(s)}&startTime=${from - 2*86400000}&limit=1000`); fr = f.map(x => [+x.fundingTime, +x.fundingRate]); }
      fs.writeFileSync(`${OUT}/${s}.json`, JSON.stringify({ s, b: bars, oi, fr, nc: cand.length }));
    } catch(e){ failed.push(s + ":" + e.message); }
    if (++done % 25 === 0) console.error(done, "/", crypto.length, "failed", failed.length); await sleep(80); } };
  await Promise.all(Array.from({ length: 4 }, work)); console.error("done; failed:", failed.join(" "));
})();
