# MERMER TERMİNAL — Güvenlik Denetimi (v7.40, v8.0 güncellemesi)

## Anahtarlar ve sırlar
| Varlık | Önce (v7.33.3) | v7.40 |
|---|---|---|
| Binance API Secret | localStorage'da **düz metin** (trade.js:36–47, conn.js:48–49) | **AES-256-GCM** ile şifreli. Anahtar, PIN'den PBKDF2-SHA256 (300 000 tur, rastgele salt + IV) ile türetiliyor (bkeys.js). Düz metin kayıt kabul edilmiyor (`pset` hata veriyor). Çözülmüş Secret yalnızca bellekte tutuluyor ve KİLİTLE ile siliniyor. |
| Eski düz metin kayıt | — | BAĞLANTILAR'da "⚠ DÜZ METİN — PIN yaz ve ŞİFRELE" uyarısı çıkıyor. **GERÇEK hesap düz metin Secret ile emir göndermiyor ve OTO açmıyor.** |
| Binance API Key | düz metin | düz metin (tek başına imza atamaz). Withdraw izni kapalı tutulmalı. |
| Bot cüzdanı (Solana) | AES-GCM/PBKDF2 PIN (bot.js) | değişmedi |
| Loglar | — | Secret, PIN veya seed hiçbir yerde loglanmıyor. Testler `console.*(secret|pin|apiKey)` olmadığını denetliyor. |

### Dürüst sınırlar
- PIN'li şifreleme cihaz çalınmasına ve diske, yedeğe veya localStorage'a erişime karşı korur. **Uygulama açıkken ve kilit açıkken** sayfada çalışan kötü amaçlı kod (XSS, kötü niyetli eklenti, ele geçirilmiş bir CDN) bellekteki Secret'e ulaşabilir.
- Kısa ya da tahmin edilebilir bir PIN çevrimdışı kaba kuvvetle kırılabilir. En az 6 karakter zorunlu, daha uzun PIN önerilir.
- ~~Native Android Keystore köprüsü yok~~ → **v8.0:** APK 8.0'da `NeonKeystore` eklentisi var (docs/ANDROID.md). Binance API Secret kaydı önce PIN ile (değişmedi), sonra telefonun Android Keystore'undaki dışa aktarılamaz AES-256-GCM anahtarıyla bir kez daha şifrelenir. Native taraf yalnız PIN-şifreli metni görür. Kopyalanan bir depolama dökümü başka cihazda PIN bilinse bile açılmaz. Sınır: kilit açıkken sayfadaki kötü kod yine Secret'e ulaşabilir (Keystore bunu çözmez); tarayıcıda ve eski APK'da kayıt PIN-only kalır; cihazda elle denenmedi. Bot cüzdanı PIN-only kalır (yedek dosyası ve sunucuya şifreli gönderim taşınabilir olmalı).
- En iyi koruma Binance tarafındadır: API anahtarında **withdraw kapalı**, IP kısıtlaması ve yalnızca vadeli işlem izni.

## CSP (index.html) — v8.0 sıkılaştırıldı
`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:*; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`

- **v8.0: `script-src` artık yalnız `'self'`.** Satır içi `<script>` yok (APP_V → `appv.js`). 8 satır içi olay işleyicisi (app.js img onerror, pump.js ×2 img onerror, bot.js / trade.js / auto.js / meme.js onclick, trade.js onsubmit) `act.js` içindeki `data-act` / `data-onerr` / `data-nosubmit` yetkili dinleyicilerine taşındı. Satır içi betik enjekte edilse bile çalışmaz.
- `eval` / `new Function` / `javascript:` yok (tests/v8.test.js tüm .js dosyalarını tarar).
- `style-src 'unsafe-inline'` kalıyor: ~50 yerde `style=` özniteliği ve grafik kütüphanesi satır içi stil kullanıyor. Bu betik çalıştırmaz; risk CSS ile görsel/veri sızdırma ile sınırlı.
- `connect-src` https/wss'e açık: borsalar, RPC'ler ve kullanıcının seçtiği AI sağlayıcıları. Yerel AI için localhost:11434/1234 izinli.
- Android: Capacitor köprüsü modern WebView'da `addDocumentStartJavaScript` ile enjekte edilir (CSP'den etkilenmez). Çok eski WebView'da (DOCUMENT_START_SCRIPT yok) Capacitor satır içi `<script>` yedeğine düşer; bu CSP onu engeller → yalnız bildirim/titreşim/ekran açık/Keystore köprüsü çalışmaz, web uygulaması çalışır, Secret PIN-only kalır. Android System WebView güncel tutulmalı.
- Doğrulama: yerelde ve canlıda her sekme gezildi, `securitypolicyviolation` olayı ve konsol "Refused to" mesajı sayıldı → 0 (TEST_REPORT.md).

## XSS incelemesi
- innerHTML ile basılan dış veriler (coin adı, token sembolü, hata mesajı, AI cevabı) `esc()` ile kaçışlanıyor.
- NOTIFY.toast textContent kullanıyor. Yeni PIN penceresi (BKEYS.ask) textContent kullanıyor.
- auto.js `alog` ve meme.js `tl` HTML alıyor. Tüm çağıran yerler dış değerleri `esc()` ile kaçışlıyor. v7.40'ta eklenen tüm loglarda da `esc()` kullanıldı.

## Emir güvenliği (gerçek para)
- GERÇEK hesap: önce yazılı onay gerekiyor. Ardından stop zorunlu, şifreli ve açık Secret zorunlu. Kaldıraç ayarlanamazsa emir yok. Onaydan sonra taze fiyatla yeniden boyutlanıyor. Aynı anda tek emir gidiyor. newClientOrderId ve uzlaştırma var, yeniden gönderim yok.
- Stop kurulamazsa acil reduce-only kapatma yapılıyor ve kritik uyarı veriliyor.
- Binance OTO: günlük zarar limiti, 2 ardışık zarar sonrası 60 dk bekleme, açık pozisyon sınırı ve kill switch var.
- MEME GERÇEK: BELİRSİZ işlem tekrar gönderilmiyor ve preflight açık. GERÇEK limitleri ve varsayılanları değişmedi (test ediliyor).
- v8.0: bot cüzdanı (fund / withdraw / Jupiter / PUMP OTO) ve Phantom (İŞLEM swap, pump.fun elle) yolları da EXEC BELİRSİZ defterinde: imzadan önce anahtar başına kilit, popup/gönderimden önce yer tutucu, zaman aşımı → BELİRSİZ (başarısız sayılmaz, yeniden gönderilmez), arka planda uzlaştırma (`exec:settled`). OTO BELİRSİZ pozisyonu izlemez/satmaz; satış BELİRSİZ ise yeniden denemez. bot.js:102 hata yutma kaldırıldı.
- Sinyaller (SERT, SİNYAL 8, AKILLI) hiçbir yerde otomatik alım tetiklemez (testlerle denetleniyor).
- Testlerde ve canlı doğrulamada gerçek emir gönderilmedi. Order/algo/sendTransaction istek sayısı 0.
