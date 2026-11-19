/* v8.0: SERT/SQUEEZE lists, last 28 days, top 120 USDT perps by 24h volume (survivorship: today's list), real OI (15m hist) + funding; 1m follow-up with OLD (stop-price) vs NEW (gap) fill */
const fs = require("fs"), NEW = require("../../sert.js"), OLD = require(process.env.OLD_SERT || "./old_sert.js"), B = "https://fapi.binance.com";
const fj = async u => { for (let i = 0; i < 6; i++){ try { const r = await fetch(B + u, { signal: AbortSignal.timeout(20000) }); if (r.status === 429 || r.status === 418){ await new Promise(z => setTimeout(z, 60000)); continue; } if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); } catch(e){ if (i === 5) throw e; await new Promise(z => setTimeout(z, 2000)); } } };
const END = Math.floor(Date.now()/9e5)*9e5 - 36e5, START = END - 28*864e5;
(async () => { const tk = await fj("/fapi/v1/ticker/24hr"), ei = await fj("/fapi/v1/exchangeInfo"), U = new Set(NEW.universe(ei)), syms = NEW.top(tk, 300).filter(s => U.has(s)).slice(0, 120);
  const trig = []; let qi = 0;
  const w = async () => { while (qi < syms.length){ const s = syms[qi++]; try {
      let b = []; for (let t = START - 300*9e5; t < END; ){ const a = await fj(`/fapi/v1/klines?symbol=${s}&interval=15m&startTime=${t}&limit=1500`); if (!a.length) break; for (const x of a) if (+x[6] < END) b.push({ t: +x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4], qv: +x[7], tb: +x[10], T: +x[6] }); t = +a[a.length - 1][0] + 9e5; if (a.length < 1500) break; }
      let oi = []; for (let t = START - 2*36e5; t < END; ){ const a = await fj(`/futures/data/openInterestHist?symbol=${s}&period=15m&limit=500&startTime=${t}`); if (!a.length) break; oi.push(...a.map(x => [+x.timestamp, +x.sumOpenInterest])); t = +a[a.length - 1].timestamp + 1; if (a.length < 500) break; }
      const fr = (await fj(`/fapi/v1/fundingRate?symbol=${s}&startTime=${START - 864e5}&limit=1000`)).map(x => [+x.fundingTime, +x.fundingRate]);
      const at = (A, t) => { let r = null; for (const x of A) if (x[0] <= t) r = x; else break; return r; }; const busy = {};
      for (let i = 300; i < b.length; i++){ if (b[i].t < START) continue; const cT = b[i].T + 1, w3 = b.slice(i - 299, i + 1), f = NEW.feat(w3); if (!f) continue; if (!NEW.LISTS.some(l => !l.ext && NEW.preK(l.k, f))) continue;
        const n0 = at(oi, cT - 9e5), a0 = at(oi, cT - 9e5 - 36e5), oi1 = n0 && a0 ? n0[1]/a0[1] - 1 : NaN, q = at(fr, cT), r = q ? q[1] : NaN;
        for (const t of NEW.evalAll(w3, oi1, r)){ if ((busy[t.k] || 0) > cT) continue; busy[t.k] = cT + 36e5; trig.push(Object.assign({ sym: s, t: cT }, t)); } }
      process.stdout.write(s + " "); } catch(e){ process.stdout.write("ERR " + s + " "); } } };
  await Promise.all(Array.from({ length: 6 }, w)); console.log("\ntriggers", trig.length);
  let k = 0; const w2 = async () => { while (k < trig.length){ const j = trig[k++]; try { const a = await fj(`/fapi/v1/klines?symbol=${j.sym}&interval=1m&startTime=${j.t}&limit=60`); j.b = a.map(x => ({ t: +x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4], T: +x[6] })).filter(x => x.t >= j.t); } catch(e){} } };
  await Promise.all(Array.from({ length: 6 }, w2));
  const out = {}; for (const j of trig){ if (!j.b || j.b.length < 60) continue; const o = OLD.follow(j, j.b), n = NEW.follow(j, j.b), L = (out[j.k] = out[j.k] || { n: 0, oldW: 0, oldS: 0, newW: 0, newS: 0, gap: 0, nsW: 0, nsS: 0 });
    if (!o.res || !n.res) continue; L.n++; L.oldS += o.res.net; L.newS += n.res.net; L.oldW += o.res.net > 0; L.newW += n.res.net > 0; L.gap += n.res.exit !== o.res.exit; if (n.ns){ L.nsS += n.ns.net; L.nsW += n.ns.net > 0; } }
  fs.writeFileSync("sertbt.json", JSON.stringify({ START, END, syms: syms.length, out }));
  for (const kk in out){ const L = out[kk]; console.log(kk, `n=${L.n} STOPLU eski %${(L.oldW/L.n*100).toFixed(0)} ${(L.oldS/L.n*100).toFixed(2)}% → yeni %${(L.newW/L.n*100).toFixed(0)} ${(L.newS/L.n*100).toFixed(2)}% (gap ${L.gap}) · STOPSUZ %${(L.nsW/L.n*100).toFixed(0)} ${(L.nsS/L.n*100).toFixed(2)}%`); } })();
