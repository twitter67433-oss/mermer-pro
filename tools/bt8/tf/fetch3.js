/* v7.50 FAZ 3b data: 1h (1 year) and 4h (2.5 years) universes incl. delisted (SETTLING) contracts, + funding history */
const fs = require("fs"); const B = "https://fapi.binance.com", sleep = ms => new Promise(r => setTimeout(r, ms));
const END = Date.parse("2026-11-19T00:00:00Z"), CFG = { "1h": { start: END - 365*864e5, n: 150, ivs: [["1h", 36e5], ["4h", 144e5], ["1d", 864e5]] }, "4h": { start: END - 913*864e5, n: 9999, ivs: [["4h", 144e5], ["1d", 864e5], ["1w", 6048e5]] } };
let calls = 0; async function j(u){ for (let k = 0; k < 6; k++){ try { const r = await fetch(u); calls++; if (r.ok) return await r.json(); if (r.status === 429 || r.status === 418) await sleep(60000); } catch(e){} await sleep(1500*(k + 1)); } throw new Error("fail " + u); }
async function kl(sym, iv, ms, start, end){ const out = []; let t = start - 300*ms; while (t < end){ const a = await j(`${B}/fapi/v1/klines?symbol=${sym}&interval=${iv}&startTime=${t}&limit=1500`); if (!a.length) break;
    for (const x of a){ if (x[0] >= end) break; out.push([x[0], +x[1], +x[2], +x[3], +x[4], +x[5], x[6], +x[9]]); } t = a[a.length - 1][0] + ms; if (a.length < 1500) break; } return out; }
async function fund(sym, start, end){ const out = []; let t = start - 7*864e5; while (t < end){ const a = await j(`${B}/fapi/v1/fundingRate?symbol=${sym}&startTime=${t}&limit=1000`); if (!a.length) break; for (const x of a) if (x.fundingTime < end) out.push([x.fundingTime, +x.fundingRate]); t = a[a.length - 1].fundingTime + 1; await sleep(400); if (a.length < 1000) break; } return out; }
let seed = 11; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;
(async () => { const ex = await j(B + "/fapi/v1/exchangeInfo"), tk = await j(B + "/fapi/v1/ticker/24hr"), orig = JSON.parse(fs.readFileSync("data/syms.json")).syms;
  for (const tf of ["1h", "4h"]){ const C = CFG[tf], dir = "d" + tf; fs.mkdirSync(dir, { recursive: true });
    const el = ex.symbols.filter(s => s.quoteAsset === "USDT" && s.contractType === "PERPETUAL" && s.underlyingType === "COIN" && s.onboardDate < C.start - 30*864e5 && (s.status === "TRADING" || (s.status === "SETTLING" && s.deliveryDate > C.start + 30*864e5)));
    const del = el.filter(s => s.status === "SETTLING"), live = el.filter(s => s.status === "TRADING"); let pick = [];
    if (C.n >= el.length) pick = el; else { const o = live.filter(s => orig.includes(s.symbol)), rest = live.filter(s => !orig.includes(s.symbol)).sort(() => rnd() - 0.5); pick = o.concat(del.slice(0, 40)); pick = pick.concat(rest.slice(0, C.n - pick.length)); }
    const meta = { start: C.start, end: END, syms: pick.map(s => ({ s: s.symbol, st: s.status, del: s.status === "SETTLING" ? s.deliveryDate : null })) }; fs.writeFileSync(`${dir}/meta.json`, JSON.stringify(meta));
    console.log(tf, "eligible", el.length, "delisted", del.length, "picked", pick.length);
    let qi = 0; const work = async () => { while (qi < pick.length){ const s = pick[qi++]; const end = s.status === "SETTLING" ? Math.min(END, s.deliveryDate) : END;
      for (const [iv, ms] of C.ivs){ const f = `${dir}/${s.symbol}_${iv}.json`; if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify((await kl(s.symbol, iv, ms, C.start, end)).filter(x => x[5] > 0 || x[0] < end - 864e5))); }
      const ff = `${dir}/${s.symbol}_fund.json`; if (!fs.existsSync(ff)) fs.writeFileSync(ff, JSON.stringify(await fund(s.symbol, C.start, end))); process.stdout.write(s.symbol + " "); } };
    await Promise.all([1,2,3,4,5,6,7].map(work)); console.log("\n" + tf + " done, calls", calls); } })();
