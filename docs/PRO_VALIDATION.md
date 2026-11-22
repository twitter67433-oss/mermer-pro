# MERMER PRO — doğrulama raporu (walk-forward, örnek dışı)

Üretim: 2026-11-22T11:41:09.964Z · 120 coin (en likit USDT perpetual'lar, bugün listede olanlar → hayatta kalma yanlılığı) · 15dk mum · 2026-06-05 → 2026-11-22 · 2,121,600 mum · 1,958,400 değerlendirme.
H1 = 2026-06-05 → 2026-08-29, H2 = 2026-08-29 → 2026-11-22. Strateji parametreleri önceden sabit (hiçbir şey veriye uydurulmadı) → iki yarı da örnek dışı. Maliyet: taker %0.05/taraf (limit girişte maker %0.02), spread+kayma likiditeye göre %0.01–0.10/taraf, stopta 2×, fonlama ödemeleri dahil. Giriş: MKT = sinyal mumundan sonraki açılış; PB = 0.3 ATR daha iyi limit, 4 mum, yalnız fiyat limitin İÇİNDEN geçerse dolar. Çıkış: stop (belirsiz mumda önce stop), TP1 = 1R yarısı + stop başa başa, TP2 = 2R, 8 saat zaman aşımı. Rastgele taban çizgisi: aynı coin, aynı yarı, aynı yön, aynı ATR stop mesafesi ve aynı çıkışlar, rastgele giriş mumu (200 tekrar).

| strateji | giriş | H1 n | H1 beklenti R [95% GA] | H1 PF | H1 kazanma | H1 Sharpe | H1 rastgele (p) | H2 n | H2 beklenti R [95% GA] | H2 PF | H2 kazanma | H2 Sharpe | H2 rastgele (p) | brüt R H1/H2 | portföy $1000 H1 / H2 (maks DD) | durum |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Trend geri çekilme (TPB) | MKT | 3481 | -0.098 [-0.177, -0.021] | 0.81 | 49.4% | -5.21 | -0.154 (0.00) | 4931 | -0.083 [-0.150, -0.017] | 0.84 | 49.8% | -5.11 | -0.120 (0.01) | -0.023 / -0.013 | 534 (50.7%) / 665 (45.1%) | kanıtlanmadı |
| Trend geri çekilme (TPB) | PB | 3258 | -0.064 [-0.142, 0.014] | 0.88 | 51.1% | -3.32 | -0.119 (0.00) | 4641 | -0.040 [-0.096, 0.021] | 0.92 | 52.5% | -2.71 | -0.097 (0.00) | -0.000 / 0.020 | 524 (56.4%) / 859 (26.2%) | kanıtlanmadı |
| Yatay bant dönüşü (RREV) | MKT | 295 | -0.055 [-0.203, 0.104] | 0.90 | 54.2% | -1.41 | -0.215 (0.01) | 406 | -0.142 [-0.254, -0.034] | 0.76 | 50.7% | -5.50 | -0.180 (0.24) | 0.049 / -0.035 | 750 (36.6%) / 543 (47.7%) | kanıtlanmadı |
| Yatay bant dönüşü (RREV) | PB | 245 | -0.015 [-0.156, 0.130] | 0.97 | 55.9% | -0.42 | -0.212 (0.00) | 336 | -0.117 [-0.249, 0.014] | 0.80 | 52.1% | -3.71 | -0.193 (0.12) | 0.086 / -0.010 | 926 (22.0%) / 731 (30.2%) | kanıtlanmadı |
| Sıkışma kırılımı (BRK) | MKT | 189 | -0.442 [-0.630, -0.265] | 0.39 | 36.5% | -9.29 | -0.165 (1.00) | 304 | -0.152 [-0.299, -0.005] | 0.74 | 47.7% | -4.10 | -0.125 (0.71) | -0.344 / -0.065 | 616 (38.8%) / 716 (36.7%) | kanıtlanmadı |
| Sıkışma kırılımı (BRK) | PB | 178 | -0.266 [-0.504, -0.049] | 0.58 | 43.3% | -4.93 | -0.142 (0.95) | 274 | -0.185 [-0.356, 0.001] | 0.68 | 48.2% | -4.04 | -0.101 (0.91) | -0.183 / -0.110 | 768 (26.4%) / 691 (36.3%) | kanıtlanmadı |
| Likidite süpürme dönüşü (SWP) | MKT | 3574 | -0.150 [-0.207, -0.089] | 0.74 | 49.5% | -9.57 | -0.229 (0.00) | 5181 | -0.133 [-0.196, -0.069] | 0.76 | 49.4% | -7.90 | -0.207 (0.00) | -0.057 / -0.046 | 332 (70.9%) / 297 (71.7%) | kanıtlanmadı |
| Likidite süpürme dönüşü (SWP) | PB | 2848 | -0.145 [-0.200, -0.093] | 0.75 | 49.7% | -10.46 | -0.226 (0.00) | 4293 | -0.158 [-0.213, -0.097] | 0.74 | 47.9% | -10.06 | -0.213 (0.00) | -0.057 / -0.072 | 212 (79.8%) / 328 (68.3%) | kanıtlanmadı |

Portföy: kronolojik, $1000 başlangıç, işlem başı mevcut bakiyenin %1'i, en fazla 2 açık, günlük zarar %3, 3 kayıp → 12 saat soğuma (pro/core.js `portfolio`). Sharpe günlük getiriden, yıllıklandırılmış. GA = gün kümeli bootstrap (2000).

## Önceden bildirilen filtre deneyleri

| strateji | giriş | filtre | H1 n / beklenti / GA alt | H2 n / beklenti / GA alt | geçti mi |
|---|---|---|---|---|---|
| TPB | MKT | aile uyumu (≥3 lehte, 0 aleyhte) | 371 / -0.123 / -0.259 | 508 / -0.082 / -0.193 | hayır |
| TPB | MKT | yüksek likidite (24s ≥ $100M) | 1479 / -0.066 / -0.168 | 2209 / -0.058 / -0.130 | hayır |
| TPB | PB | aile uyumu (≥3 lehte, 0 aleyhte) | 430 / -0.023 / -0.158 | 592 / -0.030 / -0.132 | hayır |
| TPB | PB | yüksek likidite (24s ≥ $100M) | 1404 / -0.051 / -0.154 | 2061 / -0.023 / -0.089 | hayır |
| RREV | MKT | aile uyumu (≥3 lehte, 0 aleyhte) | 0 / — / — | 0 / — / — | hayır |
| RREV | MKT | yüksek likidite (24s ≥ $100M) | 91 / 0.009 / -0.196 | 153 / -0.116 / -0.270 | hayır |
| RREV | PB | aile uyumu (≥3 lehte, 0 aleyhte) | 0 / — / — | 0 / — / — | hayır |
| RREV | PB | yüksek likidite (24s ≥ $100M) | 75 / -0.067 / -0.305 | 126 / -0.076 / -0.292 | hayır |
| BRK | MKT | aile uyumu (≥3 lehte, 0 aleyhte) | 115 / -0.421 / -0.617 | 195 / -0.148 / -0.343 | hayır |
| BRK | MKT | yüksek likidite (24s ≥ $100M) | 69 / -0.387 / -0.672 | 118 / -0.136 / -0.369 | hayır |
| BRK | PB | aile uyumu (≥3 lehte, 0 aleyhte) | 109 / -0.288 / -0.529 | 174 / -0.208 / -0.448 | hayır |
| BRK | PB | yüksek likidite (24s ≥ $100M) | 65 / -0.169 / -0.489 | 106 / -0.113 / -0.362 | hayır |
| SWP | MKT | aile uyumu (≥3 lehte, 0 aleyhte) | 0 / — / — | 2 / -0.993 / -1.028 | hayır |
| SWP | MKT | yüksek likidite (24s ≥ $100M) | 1409 / -0.155 / -0.229 | 2380 / -0.099 / -0.168 | hayır |
| SWP | PB | aile uyumu (≥3 lehte, 0 aleyhte) | 0 / — / — | 2 / -0.989 / -1.027 | hayır |
| SWP | PB | yüksek likidite (24s ≥ $100M) | 1119 / -0.143 / -0.213 | 1992 / -0.111 / -0.180 | hayır |

## Rejime göre (walk-forward seçim: bir yarıda pozitif olan rejim diğer yarıda test edilir)

| strateji | giriş | rejim | H1 n / beklenti | H2 n / beklenti | H1'de seçilip H2'de | H2'de seçilip H1'de |
|---|---|---|---|---|---|---|
| TPB | MKT | TREND | 3481 / -0.098 | 4931 / -0.083 | seçilmedi | seçilmedi |
| TPB | PB | TREND | 3258 / -0.064 | 4641 / -0.040 | seçilmedi | seçilmedi |
| RREV | MKT | YATAY | 295 / -0.055 | 406 / -0.142 | seçilmedi | seçilmedi |
| RREV | PB | YATAY | 245 / -0.015 | 336 / -0.117 | seçilmedi | seçilmedi |
| BRK | MKT | GEÇİŞ | 104 / -0.446 | 131 / -0.201 | seçilmedi | seçilmedi |
| BRK | MKT | TREND | 85 / -0.437 | 173 / -0.115 | seçilmedi | seçilmedi |
| BRK | PB | GEÇİŞ | 98 / -0.216 | 122 / -0.176 | seçilmedi | seçilmedi |
| BRK | PB | TREND | 80 / -0.329 | 152 / -0.193 | seçilmedi | seçilmedi |
| SWP | MKT | TREND | 1034 / -0.100 | 1659 / -0.164 | seçilmedi | seçilmedi |
| SWP | MKT | YATAY | 496 / -0.231 | 698 / -0.205 | seçilmedi | seçilmedi |
| SWP | MKT | GEÇİŞ | 1414 / -0.149 | 1880 / -0.102 | seçilmedi | seçilmedi |
| SWP | MKT | YÜKSEK VOL | 630 / -0.168 | 944 / -0.089 | seçilmedi | seçilmedi |
| SWP | PB | TREND | 816 / -0.169 | 1397 / -0.157 | seçilmedi | seçilmedi |
| SWP | PB | YATAY | 409 / -0.166 | 586 / -0.203 | seçilmedi | seçilmedi |
| SWP | PB | GEÇİŞ | 1113 / -0.120 | 1526 / -0.153 | seçilmedi | seçilmedi |
| SWP | PB | YÜKSEK VOL | 510 / -0.145 | 784 / -0.134 | seçilmedi | seçilmedi |

## Sonuç

Test: 120 Binance USDⓈ-M coin, 15dk, 2026-06-05 → 2026-11-22 (H1/H2 bölünme 2026-08-29), ücret %0.05/taraf + spread/kayma + fonlama. Hiçbir strateji iki yarıda da maliyet sonrası pozitif değil → tüm stratejiler kanıtlanmadı, PRO cevabı BEKLE. Toplam 40 test (çoklu test uyarısı).

Çoklu test: 40 karşılaştırma yapıldı; Bonferroni ile %5 için tek test eşiği p < 0.0013. Aktif olma kuralı (önceden yazıldı): her iki yarıda n ≥ 30, beklenti > 0, GA alt sınırı > −0.05R, rastgele tabandan iyi ve p < 0.10.

Rejim dağılımı (değerlendirme sayısı): TREND 337332 · YÜKSEK VOL 78035 · GEÇİŞ 315803 · YATAY 197666 · ANORMAL 783 · DÜŞÜK LİKİDİTE 1028781.
