# Geçmiş Test Raporu — v7.50 (FAZ 3, 15dk) + v7.51 (FAZ 3b, 1s / 4s)

**Bu rapor geçmiş testtir, canlı performans değildir.** Kârlılık garantisi yoktur.

## Kurulum
- **Veri:** Binance USDⓈ-M, 40 USDT perp (24 saatlik hacme göre ilk 40; en az 150 gündür listede). Ana aralık 15m. Eski TREND motorunun çok aralıklı oylaması için 5m / 30m / 1h / 2h / 4h / 1d de çekildi.
- **Dönem:** 2026-07-22 → 2026-11-19 (120 gün, saatler UTC). İlk 30 gün yalnızca eğitim / ısınma için kullanıldı. **Örneklem dışı karşılaştırma: 2026-08-21 → 2026-11-19 (90 gün).**
- **Maliyet (her iki motor için aynı, `SIG8.COST`):**
  - taker %0.05 giriş + %0.05 çıkış
  - spread %0.01
  - kayma %0.02 her bacakta; stop çıkışında ×2
  - funding %0.01 / 8 saat (yönden bağımsız maliyet sayıldı)
  - Bu değerler varsayımdır. Panelden değiştirilebilir.
- **Çözücü (her iki motor için aynı, `SIG8.resolve`):**
  - Giriş, sinyal mumunun kapanışından yapılır.
  - Aynı mumda hem stop hem hedef değerse **önce stop** sayılır (temkinli varsayım).
  - Süre dolunca mum kapanışından çıkılır.
  - Açık mum kullanılmaz.
  - Coin + motor başına aynı anda tek açık işlem (çakışan tekrarlar sayılmaz).
- **R:** net % / başlangıç stop mesafesi %. **Yanlış sinyal:** maliyet sonrası sonucu ≤ 0 olan işlem.
- **Max DD:** tüm coinlerin işlemleri zamana göre sıralanıp, işlem başına 1R ile hesaplandı. Çok işlem üreten motorda doğal olarak büyür.

## Sonuç tablosu (örneklem dışı, 90 gün, 40 coin)
| Motor | İşlem | Coin·gün başına | Kazanan % | Net beklenti (R) | Net beklenti (%) | PF | Max DD (R) | Yanlış sinyal (net ≤ 0) |
|---|---|---|---|---|---|---|---|---|
| ESKİ SCALP GİR (varsayılan mod) | 4341 | 1.21 | 42.9 | -0.183 | -0.093 | 0.71 | 805.5 | 2479 (%57.1) |
| ESKİ TREND GİR (genel yön + kapı) | 847 | 0.24 | 41.6 | -0.155 | -0.220 | 0.72 | 141.4 | 495 (%58.4) |
| ESKİ A+ (trend) | 406 | 0.11 | 48.0 | -0.117 | -0.167 | 0.71 | 47.6 | 211 (%52.0) |
| ESKİ A+ (dönüş) | 708 | 0.20 | 51.3 | -0.061 | -0.039 | 0.85 | 58.3 | 345 (%48.7) |
| ESKİ PUMP/DUMP kırılım | 3087 | 0.86 | 47.2 | -0.125 | -0.243 | 0.69 | 395.7 | 1631 (%52.8) |
| ESKİ TOPLAM (hepsi) | 9389 | 2.61 | 45.0 | -0.149 | -0.153 | 0.72 | 1412.7 | 5161 (%55.0) |
| ESKİ SCALP, kapı maliyeti %0.15 | 3054 | 0.85 | 43.2 | -0.166 | -0.075 | 0.74 | 517.1 | 1734 (%56.8) |
| ESKİ A+ trend, kapı maliyeti %0.15 | 194 | 0.05 | 44.3 | -0.168 | -0.245 | 0.63 | 32.5 | 108 (%55.7) |
| ESKİ A+ dönüş, kapı maliyeti %0.15 | 601 | 0.17 | 50.6 | -0.062 | -0.054 | 0.85 | 54.5 | 297 (%49.4) |
| YENİ SİNYAL 8 ORTA+ (≥60) | 17821 | 4.95 | 37.1 | -0.145 | -0.141 | 0.79 | 2828.0 | 11203 (%62.9) |
| YENİ · GÜÇLÜ (≥70) | 13170 | 3.66 | 37.6 | -0.122 | -0.118 | 0.82 | 1846.4 | 8212 (%62.4) |
| YENİ · ORTA (60–69) | 8492 | 2.36 | 36.2 | -0.197 | -0.176 | 0.73 | 1737.5 | 5421 (%63.8) |
| YENİ · ZAYIF (50–59) | 7710 | 2.14 | 37.0 | -0.213 | -0.158 | 0.70 | 1668.6 | 4858 (%63.0) |
| YENİ · eşik altı (<50) | 11524 | 3.20 | 38.7 | -0.221 | -0.176 | 0.69 | 2543.3 | 7063 (%61.3) |

## Walk-forward ayarı
- 4 kat × 30 gün. Kat k için parametreler yalnızca önceki katlarda **ve kat başlamadan kapanmış** işlemlerle seçildi.
- Seçilen parametreler:
  - strateji başına minimum teknik güven: 45…85
  - MTF şartı: yok / ters değil / aynı yön
  - hedef: 1 / 1.5 / 2 / 3R; bant stratejisi için bant ortası
- **Hedef fonksiyonu:** toplam net R − 0.5 × max DD. Şartlar: eğitimde en az 40 işlem ve PF ≥ 1.05.
  - Yalnızca kazanma oranına ya da sinyal sayısına göre optimize edilmedi.
- **Sonuç:** hiçbir katta, hiçbir strateji için eğitim döneminde kârlı ayar bulunamadı. Bu yüzden ayarlı motor örneklem dışında **0 işlem** üretir (hepsi KAPALI).
- **Duyarlılık testi (düşük maliyet: maker giriş, kayma %0.01):** birkaç ayar eğitimde geçti, ama örneklem dışında 579 işlemde −0.111R/işlem, PF 0.83 verdi. Eğitimde iyi görünen ayar dışarıda tutmadı. Bu, aşırı uyumun (overfitting) tipik işaretidir.

## Yorum (dürüst)
1. **Ücret + spread + kayma sonrası, bu 90 günde ne eski ne yeni motor kâr etti.** Bütün satırlar negatif.
2. **SİNYAL 8, eskisinden ölçülebilir biçimde iyi değil:**
   - Net beklenti hemen hemen aynı: −0.145R'e karşı eski toplam −0.149R.
   - Kazanan oranı daha düşük: %37'ye karşı %45. Bunun bir kısmı 1.5–2R hedeflerden kaynaklanıyor.
   - Yanlış sinyal oranı daha yüksek: %62.9'a karşı %55.0. **Yanlış sinyal azalması yok, artış var.**
   - Sinyal akışı yaklaşık 1.9 kat: coin·gün başına 4.95'e karşı 2.61. Akış sürekli, ama kâr getirmiyor.
3. **Ölçülen tek olumlu özellik:** sınıflar sıralı. GÜÇLÜ (−0.122R), ORTA (−0.197R) ve ZAYIF (−0.213R)'ten daha az kötü. Yani teknik güven puanı bilgi taşıyor, ama maliyeti karşılamaya yetmiyor.
4. **H (gerçekçi maliyetle eski kapılar):** kapı maliyetini %0.10'dan %0.15'e çıkarmak net sonucu düzeltmedi.
   - SCALP biraz daha az kötü ve sinyal %30 daha az.
   - A+ trend daha kötü.
   - Bu yüzden eski kapı varsayılanı (%0.10) değiştirilmedi; artık `SMT.setFee` ile ayarlanabiliyor. Gerçekçi net rakamlar SİNYAL 8 panelinde ve bu raporda.

## Sınırlar
- **Hayatta kalma yanlılığı:** coinler bugünkü hacme göre seçildi; delist edilen coinler yok.
- **Tek piyasa dönemi:** 120 gün tek bir dönemdir; farklı bir rejimde sonuç değişebilir.
- **Türev verisi yok:** funding / OI / long-short geçmişi teste katılmadı. SİNYAL 8'de bu katman canlıda kullanılır ama **test edilmedi**.
- **Eski motorların taklidi yaklaşık:**
  - A+, tüm geçmişte bir kez öğrenerek çalıştırıldı (canlıda 1000 mumla yeniden öğrenir).
  - SCALP kapısı her 4 mumda bir 1000 mumluk pencereyle yenilendi.
  - TREND kapısı, tüm geçmiş üzerinden hesaplanan gReplay işlemlerinin son 1000 mumuyla nedensel olarak uygulandı. Canlıda 12 aralık var, testte 7 aralık kullanıldı.
- Kısmi dolum, emir reddi ve gecikme modellenmedi. Giriş, kapanış fiyatından ve anında varsayıldı (iyimser).
- Keşif notu: aday kovalarına tüm dönemde bir kez bakıldı (ana.js). Motor tasarımı bundan sonra değiştirilmedi. Kova taraması (diag.js) yalnızca ilk 30 günde yapıldı.

Yeniden üretme: `tools/bt8/README.md`.

---

# FAZ 3b — 1 saat ve 4 saat (v7.51)

**Kısa sonuç: 1s ve 4s'te de, örneklem dışında, maliyetler sonrası istikrarlı ve gerçek bir avantaj bulunamadı. Ana görünüme hiçbir şey eklenmedi.** 4s'te SİNYAL 8'in GÜÇLÜ/ORTA sınıfı küçük artıda (+0.03R) çıktı. Ancak 4 dönemin 2'si eksi, ve aynı yönde rastgele zamanda açılan işlemler de aynı kadar kazandı. Yani bu artı zamanlamadan değil, piyasa yönünden (alt coin düşüşü) geliyor. Kanıt sayılmaz.

## Kurulum (15dk testinden farkları)
- **Coinler (hayatta kalma yanlılığını azaltmak için delist edilenler dahil):**
  - **1s:** 150 USDT perp. Bunlar: önceki 40'tan 1 yıldan eski olan 34'ü + dönem içinde delist edilen 40 coin (`SETTLING`) + rastgele seçilmiş diğer coinler. Hepsi başlangıçtan en az 30 gün önce listelenmiş.
  - **4s:** başlangıçtan en az 30 gün önce listelenmiş **tüm** 247 USDT perp (53'ü sonradan delist edildi). Seçim hacme göre değil.
  - Delist edilen coinlerin verisi teslim (delivery) tarihinde kesilir.
- **Dönem:**
  - **1s:** 2025-11-19 → 2026-11-19 (1 yıl). 6 kat × ~61 gün. Kat 1 yalnız eğitim. **Örneklem dışı: 2026-01-18 → 2026-11-19 (304 gün).**
  - **4s:** 2024-05-20 → 2026-11-19 (2.5 yıl). 5 kat × ~183 gün. Kat 1 yalnız eğitim. **Örneklem dışı: 2024-11-18 → 2026-11-19 (730 gün).**
- **Üst aralıklar (MTF):** 1s için 4s + 1g, 4s için 1g + 1h(hafta).
- **Maliyet:** 15dk testindekiyle aynı (taker %0.05 + %0.05, spread %0.01, kayma %0.02 / bacak, stopta ×2). Tek fark: **funding artık sabit varsayım değil, Binance `fundingRate` tarihçesinden gerçek değer.** Pozisyon girişten (sinyal mumu kapanışı) çıkışa kadar açık kaldığı her funding anında, yönüne göre öder ya da alır.
- **Boşluk (gap) dolumu:** Stop, açılışı stopun ötesinde olan bir mumda değerse, dolum stop fiyatından değil **açılış fiyatından** sayılır. Hedefte bu yapılmadı (temkinli).
- **Çözücü / R / yanlış sinyal tanımı:** 15dk testindekiyle aynı (`SIG8.resolve`, aynı mumda önce stop, coin + motor başına tek açık işlem).

## 1 saat — örneklem dışı 2026-01-18 → 2026-11-19 (304 gün, 150 coin)

|---|---|---|---|---|---|---|---|---|
| ESKİ SCALP GİR (varsayılan mod) | 14395 | 0.316 | 42.6 | -0.125 | -0.169 | 0.79 | 1824.8 | 57.4 |
| ESKİ A+ (trend) | 9025 | 0.198 | 48.6 | -0.060 | -0.125 | 0.84 | 618.9 | 51.4 |
| ESKİ A+ (dönüş) | 5603 | 0.123 | 48.7 | -0.058 | -0.088 | 0.85 | 327.1 | 51.3 |
| ESKİ PUMP/DUMP kırılım (squeeze kutusu) | 7597 | 0.167 | 50.8 | -0.029 | -0.183 | 0.91 | 379.8 | 49.2 |
| ESKİ TOPLAM (SCALP + A+ + PUMP/DUMP) | 36620 | 0.803 | 46.7 | -0.079 | -0.149 | 0.83 | 2911.0 | 53.3 |
| ESKİ SERT SHORT (OI yok, yalnız funding dalı) | 0 | — | — | — | — | — | — | — |
| ESKİ SQUEEZE SHORT (birebir) | 155 | 0.003 | 34.2 | -0.196 | -0.726 | 0.56 | 32.2 | 65.8 |
| ESKİ SQUEEZE DEVAM SHORT (OI yok) | 1271 | 0.028 | 37.5 | -0.005 | -0.029 | 0.97 | 48.7 | 62.5 |
| ESKİ SERT LONG (OI yok) | 4188 | 0.092 | 34.6 | -0.077 | -0.123 | 0.82 | 329.5 | 65.4 |
| ESKİ SQUEEZE LONG (OI yok) | 573 | 0.013 | 35.3 | -0.030 | -0.013 | 0.93 | 40.9 | 64.7 |
| ESKİ KAPİTÜLASYON LONG (birebir) | 337 | 0.007 | 39.2 | -0.120 | -0.293 | 0.55 | 41.7 | 60.8 |
| ESKİ SQUEEZE DEVAM LONG (OI yok) | 2062 | 0.045 | 36.7 | -0.016 | -0.081 | 0.92 | 65.3 | 63.3 |
| YENİ SİNYAL 8 ORTA+ (≥60, ayarsız) | 48274 | 1.058 | 38.6 | -0.040 | -0.091 | 0.94 | 3418.3 | 61.4 |
| YENİ · GÜÇLÜ (≥70) | 35677 | 0.782 | 38.7 | -0.030 | -0.077 | 0.95 | 2656.5 | 61.3 |
| YENİ · ORTA (60–69) | 23341 | 0.512 | 37.8 | -0.068 | -0.156 | 0.89 | 1996.2 | 62.2 |
| YENİ · ZAYIF (50–59) | 20753 | 0.455 | 36.8 | -0.100 | -0.217 | 0.84 | 2130.5 | 63.2 |
| YENİ · eşik altı (<50) | 28700 | 0.629 | 38.2 | -0.130 | -0.192 | 0.80 | 3764.4 | 61.8 |
| YENİ walk-forward ayarlı (toplam) | 6060 | 0.133 | 35.6 | -0.105 | -0.194 | 0.84 | 785.7 | 64.4 |
| YENİ WF · GÜÇLÜ (eşik+10) | 2000 | 0.044 | 35.1 | -0.143 | -0.295 | 0.79 | 354.8 | 64.9 |
| YENİ WF · ORTA (eşik..+10) | 5016 | 0.110 | 35.5 | -0.101 | -0.176 | 0.84 | 679.3 | 64.5 |
| YENİ WF · ZAYIF (eşik−10..eşik) | 6059 | 0.133 | 33.4 | -0.130 | -0.262 | 0.81 | 907.8 | 66.6 |

**Kat bazında (net beklenti R / işlem):**

| Motor | 2026-01 | 2026-03 | 2026-05 | 2026-07 | 2026-09 |
|---|---|---|---|---|---|
| YENİ ORTA+ | 0.054 (n=11229) | -0.081 (n=10315) | -0.108 (n=9502) | -0.063 (n=8619) | -0.015 (n=8609) |
| YENİ GÜÇLÜ | 0.079 (n=8608) | -0.081 (n=7478) | -0.108 (n=6897) | -0.082 (n=6274) | 0.019 (n=6420) |
| YENİ WF ayarlı | -0.004 (n=808) | -0.114 (n=3353) | -0.130 (n=1899) | — | — |
| ESKİ TOPLAM | -0.084 (n=9119) | -0.069 (n=8064) | -0.061 (n=8618) | -0.103 (n=6730) | -0.087 (n=4089) |
| ESKİ SQS | -0.126 (n=35) | -0.255 (n=35) | -0.328 (n=31) | -0.081 (n=24) | -0.165 (n=30) |
| ESKİ DVS | 0.104 (n=215) | -0.095 (n=246) | 0.046 (n=248) | -0.086 (n=240) | 0.012 (n=322) |
| ESKİ LNG | -0.087 (n=762) | 0.008 (n=1106) | -0.122 (n=743) | -0.079 (n=1017) | -0.164 (n=560) |
| ESKİ SQL | -0.113 (n=262) | 0.150 (n=132) | -0.134 (n=79) | -0.252 (n=56) | 0.390 (n=44) |
| ESKİ KAP | -0.295 (n=69) | 0.058 (n=40) | 0.021 (n=73) | -0.121 (n=44) | -0.169 (n=111) |
| ESKİ DVL | -0.035 (n=389) | 0.036 (n=552) | -0.052 (n=394) | 0.000 (n=454) | -0.068 (n=273) |

## 4 saat — örneklem dışı 2024-11-18 → 2026-11-19 (730 gün, 247 coin)

|---|---|---|---|---|---|---|---|---|
| ESKİ SCALP GİR (varsayılan mod) | 8758 | 0.049 | 40.9 | -0.125 | -0.311 | 0.79 | 1201.2 | 59.1 |
| ESKİ A+ (trend) | 8276 | 0.046 | 48.4 | -0.046 | -0.185 | 0.87 | 483.3 | 51.6 |
| ESKİ A+ (dönüş) | 5365 | 0.030 | 47.5 | -0.057 | -0.257 | 0.85 | 380.6 | 52.5 |
| ESKİ PUMP/DUMP kırılım (squeeze kutusu) | 7916 | 0.044 | 50.9 | -0.048 | -0.145 | 0.87 | 512.3 | 49.1 |
| ESKİ TOPLAM (SCALP + A+ + PUMP/DUMP) | 30315 | 0.168 | 46.7 | -0.071 | -0.224 | 0.84 | 2382.6 | 53.3 |
| ESKİ SERT SHORT (OI yok, yalnız funding dalı) | 0 | — | — | — | — | — | — | — |
| ESKİ SQUEEZE SHORT (birebir) | 92 | 0.001 | 18.5 | -0.521 | -2.013 | 0.19 | 48.4 | 81.5 |
| ESKİ SQUEEZE DEVAM SHORT (OI yok) | 153 | 0.001 | 40.5 | 0.077 | 0.304 | 1.38 | 8.6 | 59.5 |
| ESKİ SERT LONG (OI yok) | 1200 | 0.007 | 34.0 | -0.102 | -0.164 | 0.82 | 186.2 | 66.0 |
| ESKİ SQUEEZE LONG (OI yok) | 395 | 0.002 | 37.5 | -0.019 | -0.072 | 0.96 | 34.2 | 62.5 |
| ESKİ KAPİTÜLASYON LONG (birebir) | 57 | 0.000 | 42.1 | -0.074 | -0.149 | 0.73 | 8.4 | 57.9 |
| ESKİ SQUEEZE DEVAM LONG (OI yok) | 568 | 0.003 | 37.5 | -0.033 | -0.144 | 0.87 | 43.6 | 62.5 |
| YENİ SİNYAL 8 ORTA+ (≥60, ayarsız) | 50415 | 0.279 | 40.5 | 0.020 | 0.132 | 1.03 | 1908.6 | 59.5 |
| YENİ · GÜÇLÜ (≥70) | 36132 | 0.200 | 41.6 | 0.031 | 0.218 | 1.05 | 1654.1 | 58.4 |
| YENİ · ORTA (60–69) | 25326 | 0.140 | 39.5 | 0.014 | 0.097 | 1.02 | 1250.9 | 60.5 |
| YENİ · ZAYIF (50–59) | 23160 | 0.128 | 37.1 | -0.036 | -0.168 | 0.94 | 1547.8 | 62.9 |
| YENİ · eşik altı (<50) | 32772 | 0.182 | 37.7 | -0.081 | -0.232 | 0.87 | 3082.6 | 62.3 |
| YENİ walk-forward ayarlı (toplam) | 41194 | 0.228 | 37.1 | 0.006 | 0.070 | 1.01 | 2092.6 | 62.9 |
| YENİ WF · GÜÇLÜ (eşik+10) | 32995 | 0.183 | 37.4 | 0.024 | 0.207 | 1.04 | 1785.7 | 62.6 |
| YENİ WF · ORTA (eşik..+10) | 15208 | 0.084 | 36.1 | 0.004 | -0.070 | 1.01 | 856.9 | 63.9 |
| YENİ WF · ZAYIF (eşik−10..eşik) | 16341 | 0.091 | 40.3 | 0.010 | 0.055 | 1.02 | 710.4 | 59.7 |

**Kat bazında (net beklenti R / işlem):**

| Motor | 2024-11 | 2025-05 | 2025-11 | 2026-05 |
|---|---|---|---|---|
| YENİ ORTA+ | 0.087 (n=13838) | -0.030 (n=13237) | 0.004 (n=12061) | 0.012 (n=11279) |
| YENİ GÜÇLÜ | 0.117 (n=9695) | -0.026 (n=9295) | -0.003 (n=8705) | 0.030 (n=8437) |
| YENİ WF ayarlı | 0.092 (n=14390) | -0.035 (n=13991) | -0.045 (n=6893) | -0.046 (n=5920) |
| ESKİ TOPLAM | -0.048 (n=10547) | -0.092 (n=6585) | -0.050 (n=8749) | -0.137 (n=4434) |
| ESKİ SQS | -0.538 (n=74) | -0.306 (n=11) | -0.809 (n=5) | -0.348 (n=2) |
| ESKİ DVS | -0.103 (n=20) | 0.275 (n=55) | 0.130 (n=24) | -0.081 (n=54) |
| ESKİ LNG | -0.069 (n=178) | -0.191 (n=261) | -0.122 (n=387) | -0.035 (n=374) |
| ESKİ SQL | 0.170 (n=94) | -0.014 (n=96) | -0.108 (n=159) | -0.108 (n=46) |
| ESKİ KAP | 0.887 (n=4) | -0.266 (n=10) | 0.495 (n=4) | -0.182 (n=39) |
| ESKİ DVL | -0.052 (n=51) | -0.044 (n=128) | -0.101 (n=193) | 0.045 (n=196) |

**Tablo notları**
- "YENİ · GÜÇLÜ / ORTA / ZAYIF" satırları **ayarsız varsayılan** eşiklerdir (≥70 / 60–69 / 50–59) ve varsayılan hedeflerle hesaplandı.
- "YENİ WF" satırları walk-forward ayarlı sonuçlardır. Her katta eşik, MTF filtresi ve hedef yalnızca o kattan önceki, kapanmış işlemlerle seçildi.
  - Ölçüt: J = ΣR − 0.5·maxDD. Eğitimde en az 40 işlem ve PF ≥ 1.05 şart.
  - Bu şartı sağlayan ayar yoksa strateji o katta KAPALI kalır.
- Her satırda coin + motor başına tek açık işlem kuralı ayrı uygulanır. Bu yüzden alt satırların toplamı üst satırı tutmaz.
- **Eski TREND GİR (genel yön):**
  - 5 dk tarihçe gerektirdiği için 1 yıllık testte çalıştırılamadı.
  - Bunun yerine eldeki 120 günlük veride (40 coin, 5m…1d) 1s ana aralıkla denendi. Bu satırda funding gerçek değil, sabit %0.01/8s.
  - Sonuç, örneklem dışı 90 gün: 110 işlem, 0.031 / coin·gün, kazanan %47.3, **−0.041R** (−0.313 %), PF 0.91, max DD 14.5R, yanlış sinyal %52.7.
  - 4s'te kapının istediği 1000 mumluk geçmiş 166 güne denk geliyor. Bu veriyle kapı dolmadığı için 4s'te test edilemedi.
- **SERT / SQUEEZE listeleri (uyarlandı):**
  - Binance açık pozisyon (OI) tarihçesini yalnız son 30 gün için veriyor. Bu yüzden OI şartları çıkarıldı.
  - "OI yok" yazan satırlar uygulamadaki kuralın **daha gevşek** hâlidir.
  - SQUEEZE SHORT ve KAPİTÜLASYON birebir aynı kuraldır (bu ikisi OI kullanmıyor).
  - Funding şartı için sinyal anındaki son ödenmiş oran kullanıldı.
  - Mum sayıları aynı tutuldu: 96 mum hacim ortalaması, 4 mumluk kırılım. Çıkış uygulamadaki "stoplu" kuralla aynı: 1×ATR iz süren stop, en çok 4 mum.
  - SERT SHORT'un funding dalı (≥ %0.05) 1s/4s'te hiç tetiklenmedi.
  - Çok borsalı TOPLAMA / DAĞITIM listeleri test edilemedi (tarihçe yok).

## Walk-forward ayarlarının dönem dönem sonucu
- **1s:** Eğitimde kârlı görünen her ayar örneklem dışında zarar etti.
  - Ocak katı: range −0.004R.
  - Mart katı: trend −0.187, breakout −0.102, range −0.068.
  - Mayıs katı: breakout −0.131, reversal −0.108.
  - Temmuz ve Eylül katlarında eğitim şartını sağlayan ayar kalmadı, tüm stratejiler KAPALI.
  - Toplam: 6060 işlem, **−0.105R**, PF 0.84.
- **4s:** Breakout 3R, ilk örneklem dışı katta (Kas 2024 – May 2025) +0.228R verdi. Sonraki üç katta −0.016, −0.071 ve −0.067 oldu.
  - Trend, ilk iki katta eksi (−0.018, −0.051), son iki katta artı (+0.048, +0.042).
  - Toplam: 41194 işlem, **+0.006R**, PF 1.01. Katlar: +0.092 / −0.035 / −0.045 / −0.046.
  - Ayarlı sürüm ayarsızdan kötü. Eğitim döneminin artısı sonraki döneme taşınmıyor.

## Sağlamlık kontrolleri (pozitif görünen her şey için)
1. **4s SİNYAL 8 GÜÇLÜ, +0.031R (n = 36132):**
   - Gün kümeli bootstrap ile %95 güven aralığı −0.049 … +0.115R. Ortalamanın ≤ 0 olma olasılığı %22.
   - Ek %0.1 maliyette +0.009R'ye, ek %0.2'de −0.012R'ye iniyor.
   - Kazancın tamamı SHORT tarafından geliyor:
     - trend SHORT +0.058R, breakout SHORT +0.085R
     - trend LONG −0.078R, breakout LONG −0.092R
   - **Kontrol testi:** Aynı coinde, aynı stop %'si, hedef ve süreyle, rastgele zamanda açılan aynı yönlü işlem.

     | Kurulum | Sinyal | Rastgele zaman |
     |---|---|---|
     | trend SHORT | +0.053R | +0.059R |
     | breakout SHORT | +0.081R | +0.066R |

     Breakout SHORT katlarda: +0.325 / +0.078 / −0.049 / −0.030, kontrol: +0.079 / +0.082 / +0.046 / +0.054.
   - **Sonuç:** Kazanç sinyalin zamanlamasından değil, 2024–2026 alt coin düşüşünden (short drift) geliyor. Zamanlama avantajı yok.
2. **1s SQUEEZE DEVAM LONG (uyarlanmış):**
   - İlk çalıştırmada +0.091R, PF 1.60 çıktı ve 5 katın 5'inde artıydı.
   - Ancak bu, iz süren stopun **boşluk dolumu hatasından** geliyordu. İz stop mum kapanışında güncelleniyor. Fiyat zaten stopun altındaysa sonraki mum stopun altında açılır, ve eski hesap bu durumda yine de stop fiyatından dolum sayıyordu.
   - Açılıştan dolum ile sonuç: **−0.016R**, PF 0.92. Yalnız canlı coinlerde −0.009, delist edilenlerde −0.071.
   - Diğer "OI yok" listeleri de aynı düzeltmeyle sıfırın altına ya da etrafına indi:

     | Liste | Örneklem dışı | Bootstrap: ortalama ≤ 0 olasılığı |
     |---|---|---|
     | SQUEEZE DEVAM SHORT | −0.005R | %57 |
     | SQUEEZE LONG | −0.030R | %75 |
     | SERT LONG | −0.077R | %100 |

   - **Uygulama için bulgu:** `sert.js` `simExit` / `simLong` canlı defter takibi (1 dk mumlar) aynı iyimser dolumu yapıyor. 1 dk'da etkisi küçük ama sıfır değil. BUG_REPORT'a eklendi. Davranış değişikliği yasak olduğu için bu fazda düzeltilmedi.
3. **4s SQUEEZE DEVAM SHORT, +0.077R:** Yalnız 153 işlem. Katlar −0.103 / +0.275 / +0.130 / −0.081. Bootstrap: ortalamanın ≤ 0 olma olasılığı %25. Yetersiz ve istikrarsız.

## Karar
- **Ölçülebilir, maliyet sonrası, katlar arasında istikrarlı ve yeterli örneklemli pozitif bir şey yok.** 1s'te hepsi negatif. 4s'te görülen küçük artı, piyasa yönü kontrolünü geçemiyor.
- Bu yüzden **ana görünüm için öneri yok.** Önceki "ana karar değişmez" kararı geçerli.
- **Uygulamada değişen tek şey (v7.51, yalnız etiket):**
  - Deneysel SİNYAL 8 panelinde 1s ve 4s seçiliyken artık kendi test özeti görünüyor, KANITLANMADI etiketiyle (`SIG8.BT.byTf`).
  - Bu ikisi "hiç test edilmedi" listesinden çıktı.
  - Sinyal, emir ve otomatik alım davranışı değişmedi.
- **İleride bir şey kanıtlanırsa nasıl gösterilir (öneri, uygulanmadı):**
  - Ancak ileri tarihli (paper) 3 ayda da aynı işaret görülürse,
  - yalnız detay panelinde, "X dönemde Y'si artı" istikrar satırıyla gösterilmeli,
  - ana LONG / SHORT / BEKLE kararına bağlanmadan.

## Sınırlar
- Seçilen 1s coinlerinin yarısından fazlası bugün hâlâ işlemde. Hayatta kalma yanlılığı azaldı ama sıfırlanmadı.
- OI / taker oranı tarihçesi yok. SERT/SQUEEZE listelerinin OI şartları test edilemedi.
- Delist öncesi düşük likiditede gerçek kayma, %0.02 varsayımından büyük olabilir. Ek maliyet duyarlılığı yukarıda verildi.
- Tek borsa (Binance). Tek bir piyasa dönemi kümesi: 2024–2026 alt coin düşüşü baskın.

## Yeniden üretme
Betikler `tools/bt8/tf/` altında. Kutuda `/workspace/r750` yolu ile çalıştırıldı.
1. `node fetch3.js`: 1s / 4s / 1g / 1h(hafta) mumları ve funding tarihçesi, delist edilen coinler dahil.
2. `TF=1h` (ya da `TF=4h`) ile şunlar:
   - `node new8.js`
   - `node old2.js walk`, `node old2.js scalp`, `node old2.js sert`
   - `node wf2.js`
   - `node table2.js`
3. Sağlamlık kontrolleri:
   - `node diag2.js SERT-dvl` (liste sağlamlığı)
   - `node diag8.js 70` (yön / bootstrap)
   - `node ctrl.js 70 trend:-1` (rastgele zamanlı kontrol)
4. `node oldtrend1h.js`: 120 günlük veride 1s TREND GİR.
