# Sinyal Motoru Raporu — v7.50 (FAZ 3)

## Ne teslim edildi
**SİNYAL 8** (`sig8.js`): ağırlıklı kanıt ile çalışan yeni bir sinyal motoru.
- Yalnızca bilgi verir ve **deneyseldir**.
- Yeri: LONG sayfası → "Gelişmiş · SİNYAL motoru" → (başlıktaki **detay ▾** açıkken) **DETAYLAR → "🧪 SİNYAL 8 · deneysel"**. Panel kapalı başlar. Sade görünümde (varsayılan) hiç görünmez.
- **Ana görünüm (tek LONG / SHORT / BEKLE kararı) değişmedi.**
- SERT SHORT/LONG listeleri, SIKIŞMA/PUMP/DUMP, SCALP, TREND ve DÖNÜŞ motorlarına dokunulmadı. Akışları aynı.
- **Neden ana karara bağlanmadı?** 40 coin × 90 gün örneklem dışı testte, ücret ve kayma sonrası eskisinden ölçülebilir biçimde iyi çıkmadı (bkz. BACKTEST_REPORT.md). Bu yüzden panel **"KANITLANMADI"** etiketiyle ve ölçülen sınıf sonuçlarıyla birlikte gösteriliyor.
- Emir göndermez, otomatik alım tetiklemez, sanal deftere yazmaz, alarm çalmaz (testle denetleniyor).

## Mimari (Onur'un şartları → uygulama)
| Şart | Uygulama |
|---|---|
| Sürekli akış, aşırı filtre yok | Dört strateji her kapanmış mumda iki yönde aday üretir. Örneklem dışında coin·gün başına yaklaşık 5 ORTA+ aday (eski toplam 2.6). |
| Tüm göstergelerin aynı yönde olması şartı yok, ağırlıklı kanıt | Altı katman var: trend/yapı %25, hacim/akış %20, türev %20, MTF %15, likidite %10, volatilite/rejim %10. Her katman −1…+1 arası. Eksik katman 0 sayılmaz; çıkarılır ve ağırlıklar yeniden normalize edilir. |
| MTF çatışması güveni düşürür, reddetmez | 1h/4h ters yöndeyse puan düşer ve "üst zaman dilimi ters" uyarısı çıkar. Asla engel değildir (testli). |
| Düşük ADX → bant stratejisi | ADX < 20 iken trend adayı üretilmez; bant kenarı stratejisi devreye girer (testli). |
| Ayrı stratejiler | trend (geri çekilme), kırılım, dönüş, yatay bant. Rejim uygunluğu ayrı bir katmanda değerlendirilir: güçlü trende karşı dönüş cezalanır. |
| GÜÇLÜ / ORTA / ZAYIF, ayarlanabilir eşik | Eşikler ≥70 / ≥60 / ≥50. Gösterim eşiği panelden seçilir (varsayılan ORTA+). Eşik altı adaylar silinmez, "reddedilen" listesinde nedenleriyle durur. |
| Sert engel yalnızca geçersiz veri / uygulanamaz emir / zorunlu risk | Veri kalitesi < 60/100 (NaN, eksik / tekrar eden / sırası bozuk mum, bayat veri); geçersiz stop/hedef; hedefin ücret+kaymayı karşılamaması. Başka engel yok. |
| Reddedilenler nedenleriyle | Panelde "reddedilen / eşik altı" listesi, her adayın nedeni ve uyarılarıyla. |
| Coin / aralık başına sıklık | Her kapanmış mumda sınıflanan adaylar sayılır: `neon.sig8.freq`, 7 gün, en fazla 80 coin@aralık. Panelde 24 saat ve 7 gün sayısı görünür. |
| Teknik güven ≠ olasılık | Panelde ayrı gösterilir: teknik güven (0–100) ve geçmiş testteki sınıf sonuçları ("canlı değil"). |
| Bakış-ileri (look-ahead) yok | Yalnızca kapanmış mumlar kullanılır. Üst aralık, ancak kapanış zamanı ≤ mumun kapanışı ise kullanılır. Testte i. mumdaki sonuç, gelecekteki mumlar silinse de aynı kalıyor. |
| Giriş kalitesi | Her adayda giriş, stop (geçersizlik seviyesi), TP1/TP2/TP3 (1/2/3R), ATR mesafesi, beklenen maliyet ve net R/R hesaplanır. Uzamış fiyat (EMA20'den > 2.5 ATR) ve düşük net R/R puandan düşülür. |

## H — maliyet modeli
- `SIG8.COST` alanları: taker / maker (giriş ve çıkış ayrı), spread, kayma (stopta ×2), funding / 8 saat. Hepsi % cinsinden ve panelde varsayım olarak yazılı.
- `costPct()` hem canlı adaylarda (net R/R) hem geçmiş testte kullanılıyor. Brüt ve net PnL ayrı hesaplanıyor.
- `smart.js` kapı maliyeti artık ayarlanabilir (`SMT.setFee`). Varsayılan %0.10 kaldı, çünkü %0.15 ile kapı çalıştırmak net sonucu ölçülebilir şekilde düzeltmedi.

## Ölçüm özeti (örneklem dışı, 90 gün, 40 coin, 15dk, maliyet dahil)
| | Eski toplam | SİNYAL 8 ORTA+ | GÜÇLÜ | ORTA | ZAYIF |
|---|---|---|---|---|---|
| Sinyal sayısı | 9389 | 17821 | 13170 | 8492 | 7710 |
| Kazanan % | 45.0 | 37.1 | 37.6 | 36.2 | 37.0 |
| Net beklenti (R) | −0.149 | −0.145 | −0.122 | −0.197 | −0.213 |
| Net beklenti (%) | −0.153 | −0.141 | −0.118 | −0.176 | −0.158 |
| PF | 0.72 | 0.79 | 0.82 | 0.73 | 0.70 |
| Max DD (R) | 1413 | 2828 | 1846 | 1738 | 1669 |
| Yanlış sinyal oranı | %55.0 | %62.9 | %62.4 | %63.8 | %63.0 |

- Walk-forward ile ayarlanan motor: eğitimde kârlı ayar yok, örneklem dışında 0 işlem.
- **Sonuç: iyileşme kanıtlanmadı.** Yanlış sinyal oranı azalmadı, arttı. Ölçülen tek olumlu sonuç sınıf sıralaması (GÜÇLÜ > ORTA > ZAYIF).

## Sonraki adımlar (öneri)
- Daha yüksek aralıklar (1h/4h) ve maliyet/risk oranı daha düşük kurulumlar test edilmeli. 15dk'da ortalama maliyet stopun yaklaşık %10'u.
- Türev verisi (funding / OI) için tarihçe toplanıp bu katman ölçülmeli. Şu an test edilmedi.
- Daha uzun ve farklı piyasa dönemleri ile delist edilmiş coinler eklenmeli.
- Herhangi bir iyileşme ancak bu rapordaki aynı karşılaştırma tekrarlanıp ölçülürse iddia edilecek.
