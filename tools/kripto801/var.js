const d = require("./bars.json"), from = d.now - 48*3600000;
const V = { cur: a => a.reduce((s, x) => s + x, 0)/a.length,
  nz: a => { const z = a.filter(x => x > 0); return z.length ? z.reduce((s, x) => s + x, 0)/z.length : 0; },
  act10: a => { const m = a.reduce((s, x) => s + x, 0)/a.length, z = a.filter(x => x >= 0.1*m); return z.length ? z.reduce((s, x) => s + x, 0)/z.length : 0; },
  act25: a => { const m = a.reduce((s, x) => s + x, 0)/a.length, z = a.filter(x => x >= 0.25*m); return z.length ? z.reduce((s, x) => s + x, 0)/z.length : 0; },
  sameHr: null };
const R = {};
for (const [s, v] of Object.entries(d.out)){ const c = v.kind === "KRİPTO" ? "K" : "T", b = v.b;
  for (let j = 100; j < b.length; j++){ if (b[j][0] + 900000 <= from) continue; const a = b.slice(j - 96, j).map(x => x[5]), q = b[j][5];
    for (const [n, f] of Object.entries(V)){ let base; if (n === "sameHr"){ /* same 15m slot on the previous days (1..4 days back) */ const z = [1,2,3].map(k => b[j - 96*k]).filter(Boolean).map(x => x[5]); base = z.length ? Math.max(z.reduce((s,x)=>s+x,0)/z.length, 0) : 0; } else base = f(a);
      const key = c + ":" + n; R[key] = R[key] || [0, 0]; R[key][1]++; if (base > 0 && q/base >= 3) R[key][0]++; } } }
for (const k of Object.keys(R).sort()) console.log(k, (100*R[k][0]/R[k][1]).toFixed(2) + "%");
