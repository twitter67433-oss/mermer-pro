# Geçmiş Test Raporu — v7.50 (FAZ 3)

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
