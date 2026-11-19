const { S8, SYMS, OOS0, OOS1, FOLDS, TF, fs } = require("./lib2.js");
const days = (OOS1 - OOS0)/864e5, coins = Object.keys(JSON.parse(fs.readFileSync(`new_${TF}.json`))).length;
function take(L){ const busy = {}, T = []; for (const x of L.slice().sort((a, z) => a.t - z.t)){ if ((busy[x.s] ?? -1) >= x.i) continue; busy[x.s] = x.j; T.push(x); } return T; }
function eng(file){ if (!fs.existsSync(file)) return {}; const D = JSON.parse(fs.readFileSync(file)), by = {}; for (const s in D){ const g = {}; for (const x of D[s]) (g[x.s] = g[x.s] || []).push(x); for (const e in g) by[e] = (by[e] || []).concat(take(g[e]).filter(x => x.t >= OOS0 && x.t < OOS1)); } return by; }
const ND = JSON.parse(fs.readFileSync(`new_${TF}.json`));
function newEng(lo, hi, a = OOS0, b = OOS1){ const T = []; for (const s in ND) for (const st of ["trend", "breakout", "reversal", "range"]){ let busy = -1; for (const x of ND[s]){ if (x.s !== st || x.t < a || x.t >= b || x.sc < lo || x.sc >= hi) continue; const o = x.o[st === "range" ? "mid" : S8.DEF.tpR[st]] || x.o[1.5]; if (!o || x.i <= busy) continue; busy = o[2]; T.push({ t: x.t, R: o[0], net: o[1], r: o[3] }); } } return T; }
const rows = [], add = (name, T) => { T = T || []; const s = S8.stats(T); rows.push({ name, ...s, perCoinDay: s.n/coins/days }); return T; };
const W = eng(`old_walk_${TF}.json`), Sc = eng(`old_scalp_${TF}.json`), Se = eng(`old_sert_${TF}.json`);
add("ESKİ SCALP GİR (varsayılan mod)", Sc.SCALP); add("ESKİ A+ (trend)", W["A+trend"]); add("ESKİ A+ (dönüş)", W["A+rev"]); add("ESKİ PUMP/DUMP kırılım (squeeze kutusu)", W["PUMP/DUMP"]);
add("ESKİ TOPLAM (SCALP + A+ + PUMP/DUMP)", [].concat(Sc.SCALP || [], W["A+trend"] || [], W["A+rev"] || [], W["PUMP/DUMP"] || []));
const NM = { sert: "SERT SHORT (OI yok, yalnız funding dalı)", sqs: "SQUEEZE SHORT (birebir)", dvs: "SQUEEZE DEVAM SHORT (OI yok)", lng: "SERT LONG (OI yok)", sql: "SQUEEZE LONG (OI yok)", kap: "KAPİTÜLASYON LONG (birebir)", dvl: "SQUEEZE DEVAM LONG (OI yok)" };
for (const k in NM) add("ESKİ " + NM[k], Se["SERT-" + k]);
add("YENİ SİNYAL 8 ORTA+ (≥60, ayarsız)", newEng(60, 999)); add("YENİ · GÜÇLÜ (≥70)", newEng(70, 999)); add("YENİ · ORTA (60–69)", newEng(60, 70)); add("YENİ · ZAYIF (50–59)", newEng(50, 60)); add("YENİ · eşik altı (<50)", newEng(-1, 50));
const wf = JSON.parse(fs.readFileSync(`wf_${TF}.json`)); rows.push(Object.assign({ name: "YENİ walk-forward ayarlı (toplam)" }, wf.oos.all, { perCoinDay: (wf.oos.all.n || 0)/coins/days }));
for (const g of ["strong", "medium", "weak"]) if (wf.oos["grade_" + g]) rows.push(Object.assign({ name: "YENİ WF · " + { strong: "GÜÇLÜ (eşik+10)", medium: "ORTA (eşik..+10)", weak: "ZAYIF (eşik−10..eşik)" }[g] }, wf.oos["grade_" + g], { perCoinDay: (wf.oos["grade_" + g].n || 0)/coins/days }));
const f2 = (x, d = 3) => x === null || x === undefined || !isFinite(x) ? "—" : x.toFixed(d);
const line = r => `| ${r.name} | ${r.n || 0} | ${r.n ? f2(r.perCoinDay, 3) : "—"} | ${r.n ? (r.win*100).toFixed(1) : "—"} | ${r.n ? f2(r.expR) : "—"} | ${r.n ? f2(r.expP) : "—"} | ${r.n ? f2(r.pf, 2) : "—"} | ${r.n ? f2(r.maxDD, 1) : "—"} | ${r.n ? (r.false/r.n*100).toFixed(1) : "—"} |`;
console.log(`### ${TF} — örneklem dışı ${new Date(OOS0).toISOString().slice(0, 10)} → ${new Date(OOS1).toISOString().slice(0, 10)} (${days.toFixed(0)} gün, ${coins} coin)\n`);
console.log("| Motor | İşlem | Coin·gün başına | Kazanan % | Net beklenti (R) | Net beklenti (%) | PF | Max DD (R) | Yanlış % (net ≤ 0) |"); console.log("|---|---|---|---|---|---|---|---|---|"); for (const r of rows) console.log(line(r));
/* stability: per fold, every row that is positive overall */
console.log("\n**Kat bazında (net beklenti R / işlem):**\n"); const FO = FOLDS.slice(1); console.log("| Motor | " + FO.map(f => new Date(f[0]).toISOString().slice(0, 7)).join(" | ") + " |"); console.log("|---|" + FO.map(() => "---|").join(""));
const per = (name, T) => console.log(`| ${name} | ` + FO.map(([a, b]) => { const s = S8.stats(T.filter(x => x.t >= a && x.t < b)); return s.n ? `${s.expR.toFixed(3)} (n=${s.n})` : "—"; }).join(" | ") + " |");
per("YENİ ORTA+", newEng(60, 999)); per("YENİ GÜÇLÜ", newEng(70, 999)); console.log("| YENİ WF ayarlı | " + wf.perFold.map(p => p.n ? `${p.expR.toFixed(3)} (n=${p.n})` : "—").join(" | ") + " |");
per("ESKİ TOPLAM", [].concat(Sc.SCALP || [], W["A+trend"] || [], W["A+rev"] || [], W["PUMP/DUMP"] || [])); for (const k in NM) if (Se["SERT-" + k]) per("ESKİ " + k.toUpperCase(), Se["SERT-" + k]);
fs.writeFileSync(`table_${TF}.json`, JSON.stringify(rows));
