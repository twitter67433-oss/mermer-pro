const X = require("../../sert.js"), fs = require("fs"), B = "https://fapi.binance.com";
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fj(p){ for (let a = 0; a < 5; a++){ const r = await fetch(B + p); if (r.status === 429 || r.status === 418){ await sleep(30000); continue; } if (!r.ok) throw new Error("HTTP " + r.status + " " + p); return r.json(); } throw new Error("429"); }
(async () => {
  const ei = await fj("/fapi/v1/exchangeInfo"), U = X.universe(ei), KIND = {}, CT = {}; for (const s of ei.symbols){ KIND[s.symbol] = X.kind(s); CT[s.symbol] = s.contractType; }
  const HRS = +(process.argv[2] || 48), now = Date.now(), from = now - HRS*3600000, lim = Math.min(1500, 100 + Math.ceil(HRS*4) + 300);
  console.error("universe", U.length, "tradfi", U.filter(s => CT[s] === "TRADIFI_PERPETUAL").length);
  const out = {}; let i = 0, done = 0;
  const work = async () => { while (i < U.length){ const s = U[i++];
    try { const k = await fj(`/fapi/v1/klines?symbol=${s}&interval=15m&limit=${lim}`);
      const b = k.filter(x => +x[6] < now).map(x => ({ t: +x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4], qv: +x[7], tb: +x[10] }));
      const idx = []; for (let j = 100; j < b.length; j++) if (b[j].t + 900000 > from) idx.push(j);
      const pre = {}; let anyPre = false; const F = idx.map(j => { const f = X.feat(b.slice(Math.max(0, j - 299), j + 1)); return f; });
      for (const f of F) for (const l of X.LISTS) if (!l.ext && X.preK(l.k, f)){ pre[l.k] = (pre[l.k] || 0) + 1; anyPre = true; }
      let oh = [], fr = [];
      if (anyPre){ [oh, fr] = await Promise.all([fj(`/futures/data/openInterestHist?symbol=${s}&period=5m&limit=500`).catch(() => []), fj(`/fapi/v1/fundingRate?symbol=${s}&startTime=${from - 86400000}&limit=100`).catch(() => [])]); }
      const oiAt = t => { let v = NaN; for (const x of oh) if (+x.timestamp <= t) v = +x.sumOpenInterest; return v; };
      const trig = {}, vrs = [], det = [];
      F.forEach((f, n) => { if (!f) return; const cT = f.x.t + 900000; vrs.push(f.vr);
        if (!X.LISTS.some(l => !l.ext && X.preK(l.k, f))) return;
        const a = oiAt(cT - 3600000), c = oiAt(cT), oi1 = a > 0 && c > 0 ? c/a - 1 : NaN; let r = NaN; for (const x of fr) if (+x.fundingTime <= cT) r = +x.fundingRate;
        for (const t of X.evalAll(f.bars || b.slice(Math.max(0, idx[n] - 299), idx[n] + 1), oi1, r, null)){ trig[t.k] = (trig[t.k] || 0) + 1; det.push({ k: t.k, t: f.x.t, vr: +f.vr.toFixed(1), oi1, fr: r }); } });
      out[s] = { kind: KIND[s] || "KRİPTO", ct: CT[s], vol: b.slice(-96).reduce((a, x) => a + x.qv, 0), pre, trig, det, vrHi: vrs.filter(v => v >= 3).length, nb: vrs.length, zeroBars: b.slice(-96).filter(x => x.qv === 0).length };
    } catch(e){ out[s] = { err: e.message }; }
    if (++done % 100 === 0) console.error(done); await sleep(120); } };
  await Promise.all(Array.from({ length: 6 }, work));
  fs.writeFileSync(`rep${HRS}.json`, JSON.stringify({ now, from, out })); console.error("done");
})();
