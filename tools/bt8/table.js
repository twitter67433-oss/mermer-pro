const fs = require("fs"), S8 = require("/workspace/neon-terminal-mobile/sig8.js"), { META } = require("./lib.js");
const OOS0 = META.START + 30*864e5, OOS1 = META.END, days = (OOS1 - OOS0)/864e5, coins = META.syms.length;
function take(L){ const busy = {}, T = []; for (const x of L.slice().sort((a, z) => a.t - z.t)){ const k = x.s; if ((busy[k] ?? -1) >= x.i) continue; busy[k] = x.j; T.push(x); } return T; }
function eng(file, filt){ const D = JSON.parse(fs.readFileSync(file)), by = {}; for (const s in D){ const L = Array.isArray(D[s]) ? D[s] : D[s].L; const g = {}; for (const x of L) if (!filt || filt(x)) (g[x.s] = g[x.s] || []).push(x); for (const e in g) by[e] = (by[e] || []).concat(take(g[e]).filter(x => x.t >= OOS0 && x.t < OOS1)); } return by; }
function newEng(lo, hi){ const D = JSON.parse(fs.readFileSync("new_raw2.json")); const T = []; for (const s in D){ for (const st of ["trend", "breakout", "reversal", "range"]){ let busy = -1; for (const x of D[s]){ if (x.s !== st || x.t < OOS0 || x.sc < lo || x.sc >= hi) continue; const o = x.o[st === "range" ? "mid" : S8.DEF.tpR[st]] || x.o[1.5]; if (!o || x.i <= busy) continue; busy = o[2]; T.push({ t: x.t, R: o[0], net: o[1], r: o[3] }); } } } return T; }
const rows = []; const add = (name, T) => { const s = S8.stats(T); rows.push({ name, ...s, perCoinDay: s.n/coins/days }); };
const W = eng("old_walk.json"), Sc = eng("old_scalp.json"), Tg = eng("old_trendgir.json"), Wf = eng("old_walk_f15.json"), Scf = eng("old_scalp_f15.json");
add("ESKİ SCALP GİR (varsayılan mod)", Sc.SCALP); add("ESKİ TREND GİR (genel yön + kapı)", Tg["TREND-GİR"]); add("ESKİ A+ (trend)", W["A+trend"]); add("ESKİ A+ (dönüş)", W["A+rev"]); add("ESKİ PUMP/DUMP kırılım", W["PUMP/DUMP"]);
add("ESKİ TOPLAM (hepsi)", [].concat(Sc.SCALP, Tg["TREND-GİR"], W["A+trend"], W["A+rev"], W["PUMP/DUMP"]));
add("ESKİ SCALP, kapı maliyeti %0.15", Scf.SCALP); add("ESKİ A+ trend, kapı maliyeti %0.15", Wf["A+trend"]); add("ESKİ A+ dönüş, kapı maliyeti %0.15", Wf["A+rev"]);
add("YENİ SİNYAL 8 ORTA+ (≥60)", newEng(60, 999)); add("YENİ · GÜÇLÜ (≥70)", newEng(70, 999)); add("YENİ · ORTA (60–69)", newEng(60, 70)); add("YENİ · ZAYIF (50–59)", newEng(50, 60)); add("YENİ · eşik altı (<50)", newEng(-1, 50));
const wf = JSON.parse(fs.readFileSync("wf_result.json")); rows.push({ name: "YENİ walk-forward ayarlı (yalnız eğitimde kârlı ayarlar)", n: wf.oos.all.n || 0 });
const f2 = (x, d = 3) => x === null || x === undefined || !isFinite(x) ? "—" : x.toFixed(d);
console.log("| Motor | İşlem | Coin·gün başına | Kazanan % | Net beklenti (R) | Net beklenti (%) | PF | Max DD (R) | Yanlış sinyal (net ≤ 0) |"); console.log("|---|---|---|---|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.name} | ${r.n} | ${r.n ? f2(r.perCoinDay, 2) : "—"} | ${r.n ? (r.win*100).toFixed(1) : "—"} | ${r.n ? f2(r.expR) : "—"} | ${r.n ? f2(r.expP) : "—"} | ${r.n ? f2(r.pf, 2) : "—"} | ${r.n ? f2(r.maxDD, 1) : "—"} | ${r.n ? r.false + " (%" + (r.false/r.n*100).toFixed(1) + ")" : "—"} |`);
fs.writeFileSync("table.json", JSON.stringify(rows)); console.log("\nOOS", new Date(OOS0).toISOString(), "→", new Date(OOS1).toISOString(), days, "gün", coins, "coin");
