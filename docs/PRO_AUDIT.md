# MERMER PRO 9.0.0 — kaynak denetimi (MERMER TERMİNAL 8.2.5 kopyası)

Bu belge kopyadaki kod denetimini listeler. Orijinal uygulama (neon-terminal-mobile) değiştirilmedi.

## Düzeltilen hatalar (bu kopyada)
| # | dosya | sorun | etki | düzeltme |
|---|---|---|---|---|
| 1 | coinan.js | Binance klines yanıtının son (henüz kapanmamış) mumu indikatörlere giriyordu | **repaint**: sinyal mum içinde gelip gidebiliyordu | yalnız `closeTime < now` mumlar kullanılır |
| 2 | agents.js `scanPerps` | 1s taramada oluşmakta olan mum dahildi | repaint / ileriye bakış | limit 61 + kapanmamış mum atılır |
| 3 | agentcore.js `rsi` | 14 mumluk basit ortalama ("Cutler") RSI; uygulamanın geri kalanı Wilder kullanıyordu | aynı coin için farklı RSI değerleri | tüm seri üzerinde Wilder RSI |
| 4 | chart.js `emaAll` | EMA ilk kapanışla tohumlanıyordu | ilk ~3×n mumda yanlış EMA | SMA tohumu (standart) |
| 5 | comp.js BİLEŞİK OTO | varsayılan **açık** ve 20× kaldıraç; 29 günlük testte işlem başı −2.68 $ | sessiz zarar riski | varsayılan kapalı, 5×; `on` yalnız açıkça `true` ise |
| 6 | (tüm uygulama) | orijinal ile aynı alan adında (github.io) → aynı localStorage | iki uygulama birbirinin ayarlarını/şifreli anahtarlarını görürdü | `ns.js`: tüm anahtarlar `mpro:` önekli; orijinalin verisi okunamaz/silinemez |

## Belgelenen ama kodda değiştirilmeyen zayıflıklar
- **smart.js AKILLI SİNYAL**: 24 indikatör oyu bağımsız sayılıyor; çoğu aynı bilgiyi taşıyor (EMA/SuperTrend/PSAR/Ichimoku/ADX = trend; RSI/StochRSI/CCI/WR/MFI = momentum). Yüksek "güven" yüzdesi istatistiksel güven değildir. PRO motoru indikatörleri **ailelere** ayırır ve her aileyi bir kez sayar.
- **psim.js SİM**: fonlama ödemesini içermiyor → uzun tutulan pozisyonlarda iyimser.
- **SERT / BİLEŞİK**: kâr hedefi (+7 $) ile stop (~−16 $) asimetrik → başa baş için ~%65 kazanma gerekir; testlerde bu oran tutmadı.
- Eski sekmelerdeki sinyaller (SHORT/LONG listeleri, rozetler) örnek dışı doğrulanmadı; PRO sekmesi bunları kullanmaz.

## PRO motoru — ileriye bakış önlemleri
- Yalnız kapanmış 15dk mumlar; 1s/4s, 15dk'dan **yalnız tamamlanmış** kovalarla üretilir ve kapanış zamanına göre hizalanır (15dk mum, 1s mumu ancak o saat kapandıktan sonra görür).
- Swing tepe/dipleri k mum sonra (onaylandığında) raporlanır; BOS/yapı bu gecikmeyle hesaplanır.
- Donchian kanalı i'den ÖNCEKİ n mumu kullanır; yüzdelik sıralar yalnız geçmiş pencere.
- Giriş: sinyal mumundan SONRAKİ açılış (MKT) veya sonraki mumlarda limit (PB). Belirsiz mumda önce stop.
- `tests/pro-lookahead.test.js`: seriyi i'de kesmek, i'deki aile/rejim/aday çıktısını değiştirmez (215 nokta + gelecek mumları bozma testi).

## Bilinen sınırlar
- Likidasyon: Binance yalnız canlı `forceOrder` akışı verir (sembol başına saniyede en fazla 1 olay, geçmiş yok) → yalnız bilgi, karar dışı.
- OI geçmişi ~30 gün, emir defteri geçmişi yok, 5dk canlı → bunlar doğrulanamadığı için kararlarda **kullanılmaz** ("karar dışı" etiketli).
- Coin listesi bugünün en likit 120 perpetual'ı → hayatta kalma yanlılığı (sonuçları iyimser yapar; yine de negatif).
- 40 test yapıldı (8 strateji×giriş, 16 filtre, 16 rejim seçimi); çoklu test düzeltmesiyle (Bonferroni p < 0.00125) tek bir pozitif sonuç bile şans olabilirdi — zaten hiçbiri pozitif değil.
