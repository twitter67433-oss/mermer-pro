# CHANGELOG — MERMER TERMİNAL

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
