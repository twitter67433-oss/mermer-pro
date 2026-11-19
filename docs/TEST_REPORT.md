# MERMER TERMİNAL — Test Raporu (v8.0.0, 2026-11-19)

## Birim / sözleşme testleri
`for f in tests/*.test.js; do node $f; done` → **30 dosya, 30 geçti, 0 başarısız** (v7.51: 28 dosya).

| Yeni / genişletilen | Ne denetler |
|---|---|
| `tests/v8.test.js` (yeni, 121 kontrol) | SERT boşluk dolumu (SHORT/LONG, iz stop, eski önbellek uyumu, göç bayrağı); CSP `script-src 'self'`, satır içi `<script>` yok, kök dizindeki hiçbir .js ve index.html'de satır içi olay işleyicisi / eval / new Function / `javascript:` yok; act.js yetkili dinleyiciler (sahte DOM); sürüm 8.0.0; BKEYS Android Keystore katmanı (sahte eklenti: native taraf yalnız PIN-şifreli metin görür, yanlış PIN, eklentisiz/eski APK, tarayıcıda Keystore kaydı net hata, Keystore hatası → PIN-only); Java eklenti kaynağı (AndroidKeyStore, AES/GCM, log yok). |
| `tests/botsafe.test.js` (yeni) | EXEC.phSend: onaylandı / başarısız / kullanıcı reddi (defter temizlenir) / bekleyen işlem varken ikinci gönderim engeli / zaman aşımı → BELİRSİZ ve yeniden gönderim yok; bot.js, pump.js, auto.js, trade.js kaynak sözleşmeleri (hata yutma yok, imzadan önce kilit, OTO BELİRSİZ'i satmaz/yeniden denemez). |
| `tests/psim.test.js` v8.0 bölümü | model dolum, gidiş-dönüş maliyeti, SHORT stopta 2× kayma, TP taker, defterden KISMİ dolum, VWAP + gecikme, derin defter tam dolum, ince defterde çıkış tam dolum, bayat defter yok sayılır, likidasyon dolumdan, emir uç noktası yok. Eski testler maliyet sıfırla aynen geçer. |
| `tests/ver.test.js` | APP_V artık appv.js'te; index.html'de satır içi betik yok; 52 yerel referansın tamamı `?v=8.0.0`. |

## Tarayıcı doğrulaması (Playwright, Chrome, mobil 390×844)
Her sekme gezilir (SHORT → LONG → VADELİ → MEME → AI → CÜZDAN → SHORT), `securitypolicyviolation` olayları ve konsoldaki "Refused to / Content Security Policy" mesajları tam metinle toplanır, emir istekleri (`fapi/v1/order|batchOrders|leverage|algoOrder`, `/api/trade`, `trade-local`, `/swap`, `sendTransaction|sendBundle`, WS `order.place`) sayılır, `data-onerr` resim işleyicisi canlı denenir.

| Ortam | Koşu | Emir isteği | Sayfa hatası | CSP ihlali | Not |
|---|---|---|---|---|---|
| yerel (python http.server) | 1 | 0 | 0 | 0 | APP_V 8.0.0, act.js çalışıyor |
LIVE_ROWS

## Android
APK derlendi (Gradle 8.14.3, compileSdk 36), aynı sertifikayla imzalandı, `apksigner verify` v2 geçti, `aapt2` versionCode 800 / versionName 8.0, NeonKeystorePlugin dex içinde. **Gerçek cihazda/emülatörde çalıştırılmadı.**

## Kaynak arşivi
`git archive` → `MermerTerminal-kaynak-v8.0.zip`; jks/keystore/properties/private key/API secret taraması: ZIP_SCAN
