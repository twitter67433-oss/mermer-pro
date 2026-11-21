# CHANGELOG — MERMER TERMİNAL

## 8.1.0 — 2026-11-21 · GİR / BEKLE / ÇIK
- Her SHORT/LONG listesi (7 kural) ve HAREKET satırının yanında canlı tek kelimelik yönlendirme: **GİR**, **BEKLE**, **ÇIK** (neden: STOP / HEDEF2 / SÜRE DOLDU / TERS SİNYAL), hedef1'de **KÂR AL · STOP GİRİŞE**. "yönlendirme, kanıtlanmadı" — ispatlanmış avantaj değil.
- Eşikler (varsayılan, `mermer.aksiyon` veya `AKSIYON.setCfg`): GİR, fiyat girişe ≤**0.3R** mesafede ve stop vurmamışken; 60 dk tavan (DEFTER / sim ile aynı); ÇIK satırı 8 dk daha görünür. Stop-önce (aynı anda stop ve hedef → STOP). Boşluk: fiyat seviyeyi geçmişse vurulmuş sayılır (gapX ile aynı fikir). Canlı rozet önerilen SL/TP kullanır, DEFTER'deki 1×ATR izi değil.
- HAREKET (SL/TP yok): 15dk/1s — hareket durduğu sürece GİR; %50'sinden fazlası geri verildiyse BEKLE; başlangıca döndüyse ÇIK; 24s 30 dk sonra BEKLE KOVALAMA.
- İsteğe bağlı telefon bildirimi: SİM'de açtığın veya izlediğin bir sinyal ÇIK olunca, coin+neden başına bir kez.
- Sinyal; emir yok, otomatik alım yok, GERÇEK değişmedi.
- Testler: `tests/aksiyon.test.js` (47 kontrol) — 33 dosya.

## 8.0.2 — 2026-11-20 · açılış takılması
- **Neden:** açılış ekranını (#boot) yalnızca app.js kaldırıyordu. app.js 47 dosyanın sonlarında yükleniyor; yavaş bağlantıda (ölçüm: 750 kbit/s, 300 ms) açılış ekranı 26 sn kaldı, bir dosya yüklenemez ya da bir başlangıç hatası olursa hiç kalkmıyordu. Ekranda yazan satırlar da sabit ve eskiydi ("v7.18", "OTO AL-SAT KAPALI" — ayarından bağımsız). Ardından gelen "Trading Error" penceresi yalnız BAŞLA ile kapanıyordu (✕ şaka yapıyordu).
- **Düzeltme:** `appv.js` (ilk betik, düz ES5) açılış ekranını en geç 4 sn'de kaldırır (yavaş ağda sonradan gelirse de); dosya yüklenemezse veya ilk 20 sn'de JS hatası olursa alta "⚠ Uygulama tam yüklenemedi · YENİLE" çubuğu çıkar (YENİLE = Cache Storage + service worker temizliği + ?r= ile yeniden yükleme; localStorage — DEFTER, ayarlar, cüzdan — korunur); version.json daha yeni bir sürüm gösterirse eski kopya bir kez kendiliğinden yenilenir (döngü yok). Açılış ekranı ≈1 sn, güncel sürümü yazar, sabit iddialar kaldırıldı. Trading Error penceresi 4 sn'de kendiliğinden kapanır, ✕ kapatır. Grafik kütüphanesi `<head>`'den çıkarıldı (sayfa önce çizilir); 767 kontrat taraması ve HAREKET sayfa yüklendikten sonra başlar. `<meta Expires 0>`.
- APK yeniden derlenmedi: uygulama canlı siteyi açar; GitHub Pages sayfayı en çok 10 dk önbellekte tutar, 8.0.2'den sonra eski kopya kendiliğinden yenilenir.
- Testler: `tests/boot.test.js` (21 kontrol) — 32 dosya.

## 8.0.1 — 2026-11-20
**"Sinyal hep hisse veriyor, coinler niye yok" + "Bu coinler yükselmiş niye haberim yok".** Yatırım tavsiyesi değildir.
- **Neden hisse çıkıyordu (ölçüldü, 48 saat, 767 USDT perp = 519 kripto + 248 hisse/emtia):** listelerdeki tetiklerin %65'i hisseydi (kripto 224, hisse/emtia 421), oysa kontratların yalnız %32'si hisse. Sebep kural yanlılığı, tarama hatası değil: (1) hisse kontratlarında borsa kapalıyken hacim ~0 → 24 saatlik ortalama düşük → "hacim ≥3×" her seans açılışında kendiliğinden tutuyor (hisse mumlarının %7.6'sı vs kripto %4.25; 14–15 UTC = ABD açılışı en yoğun saat); (2) hisse OI'si ince → "OI 1s ≥+%1" kolay (medyan +%3.2 vs kripto +%1.5); (3) hisse funding'i yapısal olarak yüksek → SQUEEZE SHORT'un "funding ≥%0.05" şartı hisselerde hep tutuyor (68'in 68'i).
- **Düzeltme:** hisse/emtia için hacim tabanı yalnız aktif (seans) mumlardan → hisse tetikleri 421 → 275 (−%35), kripto kuralları ve sayıları aynı (224). OI/funding yanlılığı kalıyor → görünüm filtresiyle çözüldü.
- **KRİPTO / HİSSE / HEPSİ** düğmesi (SHORT ve LONG sekmelerinin üstü, varsayılan **KRİPTO**): hisse/emtia silinmedi, ayrıldı. Listeler, DEFTER, 24s sayaçları ve telefon bildirimleri filtreye uyar; gizli hisse tetiği sayısı gösterilir. Tarama sırası: izleme listesi → tüm kripto (hacme göre) → hisse/emtia.
- **HAREKET (yeni, yalnız kripto):** 1 saatte ±%8, 24 saatte ±%15 ya da 15dk mumda ±%4 + hacim ≥3× → listede ↑ POMPA / ↓ DÜŞÜŞ + telefon bildirimi; coin+pencere başına bir uyarı (1s: 60 dk, 24s: 12 sa, 15dk: mum başına; yeniden açılışta tekrar etmez); squeeze/tasfiye risk satırı (SQZ modülü + funding); eşikler ayarlanabilir, AKTİF/PASİF, 🔔 aç/kapa. Sinyal; emir yok, otomatik alım yok.
- **Hata (gerçek):** Binance USDⓈ-M WebSocket'leri ayrıldı; eski `/ws` ve `/stream` yolları açılıyor ama işlem/likidasyon/ticker göndermiyor. Etkilenen: SİM canlı fiyatı (REST yedeğiyle 2 sn gecikmeli çalışıyordu), canlı likidasyon satırı (SHORT/LONG, ANALİZ — hep boştu), çok borsa aggTrade (Binance ayağı). Hepsi `/market` (işlem, ticker, likidasyon) ve `/public` (emir defteri) yollarına taşındı.
- Testler: `tests/hareket.test.js` (39 kontrol) — 31 dosya.

## 8.0.0 — 2026-11-19
**FAZ 4 / teslim.** Yatırım tavsiyesi değildir; sinyaller kanıtlanmış değildir.
- **SERT defteri boşluk dolumu (düzeltme):** iz süren stop mumun stopun ötesinde açıldığı durumda artık açılıştan dolar (`sert.js gapX`); 1dk mumlar açılışı saklar, eski sonuçlar bir kez yeniden hesaplanır. 28 gün / 120 coin tekrar: etki küçük ve olumsuz (−0.00…−0.02 puan/işlem) — BACKTEST_REPORT.md §v8.0, liste açıklamaları güncellendi.
- **F — gerçekçi vadeli SİM (yalnız SİM):** emir defteri (`@depth20@500ms`, ≤3 sn taze) üzerinde VWAP dolum, derinlik yetmezse KISMİ dolum, defter yoksa spread/2 + kayma + gecikme modeli, stopta 2× kayma, taker ücret; teminat ve likidasyon gerçek dolumdan. Meme SİM'in pump.fun/PumpPortal ücreti, ağ/öncelik ücreti, Jito, ATA kirası, gecikme ve haircut modeli belgelendi.
- **BELİRSİZ işlem koruması her ödeme yolunda:** bot cüzdanı (OTO PUMP al/sat, fund, withdraw, Jupiter) ve Phantom (İŞLEM swap, pump.fun elle) EXEC defterine bağlandı — imzadan önce kilit, zaman aşımı BELİRSİZ (başarısız değil), yeniden gönderim yok, arka planda uzlaştırma; OTO BELİRSİZ pozisyonu satmaz/yeniden denemez. bot.js:102 hata yutma kaldırıldı.
- **Sıkı CSP:** `script-src 'self'` (unsafe-inline yok). Satır içi APP_V → `appv.js`; 8 satır içi işleyici → `act.js` yetkili dinleyiciler.
- **Android APK 8.0:** `NeonKeystore` eklentisi — API Secret'ın PIN-şifreli kaydı Android Keystore anahtarıyla ikinci kez sarılır (docs/ANDROID.md). Cihazda denenmedi.
- Belgeler: README, CHANGELOG, docs/BUG_REPORT, SECURITY_AUDIT, SIGNAL_ENGINE_REPORT, BACKTEST_REPORT, TEST_REPORT, ANDROID. Sürüm 8.0.0 (version.json, appv.js, tüm `?v=` etiketleri).
- Yeni testler: `tests/botsafe.test.js`, `tests/v8.test.js`, `tests/psim.test.js` v8.0 bölümü.
- Değişmeyenler: GERÇEK limitleri/varsayılanları, onay pencereleri, OTO varsayılan KAPALI, sinyal → otomatik alım yok.

## 7.51 — FAZ 3b: 1s/4s eski–yeni karşılaştırma (kanıtlanmış avantaj yok), SİNYAL 8 panelinde yalnız test etiketi.
## 7.50 — FAZ 3: SİNYAL 8 deneysel motor + maliyet modeli + 15dk walk-forward.
## 7.40 — FAZ 1 denetim + FAZ 2 düzeltmeler (elle miktar zarar sınırı, SL doğrulama/acil kapatma, idempotency, hedge-güvenli kapatma, Binance OTO zarar sınırları, Secret şifreleme, Solana BELİRSİZ, preflight, dürüst istatistik).
## 7.33.x ve öncesi — bkz. git geçmişi ve README.
