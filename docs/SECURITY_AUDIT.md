# MERMER TERMİNAL — Güvenlik Denetimi (v7.40)

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
- Native Android Keystore köprüsü **yok** (native.js'te böyle bir köprü bulunmuyor). APK da aynı WebView localStorage şifrelemesini kullanır.
- En iyi koruma Binance tarafındadır: API anahtarında **withdraw kapalı**, IP kısıtlaması ve yalnızca vadeli işlem izni.

## CSP (index.html)
`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:*; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`

- Dış kaynaktan script yüklenemez. Tüm kütüphaneler `vendor/` içinden geliyor. `eval` / `new Function` engelli.
- `'unsafe-inline'` gerekiyor: satır içi `APP_V` script'i ve onclick/onerror işleyicileri var. Bunlar kaldırılırsa nonce/hash ile sıkılaştırılabilir (sonraki faz).
- `connect-src` https/wss'e açık: borsalar, RPC'ler ve kullanıcının seçtiği AI sağlayıcıları. Yerel AI için localhost:11434/1234 izinli.
- Yerel testte CSP ihlali 0, sayfa hatası 0.

## XSS incelemesi
- innerHTML ile basılan dış veriler (coin adı, token sembolü, hata mesajı, AI cevabı) `esc()` ile kaçışlanıyor.
- NOTIFY.toast textContent kullanıyor. Yeni PIN penceresi (BKEYS.ask) textContent kullanıyor.
- auto.js `alog` ve meme.js `tl` HTML alıyor. Tüm çağıran yerler dış değerleri `esc()` ile kaçışlıyor. v7.40'ta eklenen tüm loglarda da `esc()` kullanıldı.

## Emir güvenliği (gerçek para)
- GERÇEK hesap: önce yazılı onay gerekiyor. Ardından stop zorunlu, şifreli ve açık Secret zorunlu. Kaldıraç ayarlanamazsa emir yok. Onaydan sonra taze fiyatla yeniden boyutlanıyor. Aynı anda tek emir gidiyor. newClientOrderId ve uzlaştırma var, yeniden gönderim yok.
- Stop kurulamazsa acil reduce-only kapatma yapılıyor ve kritik uyarı veriliyor.
- Binance OTO: günlük zarar limiti, 2 ardışık zarar sonrası 60 dk bekleme, açık pozisyon sınırı ve kill switch var.
- MEME GERÇEK: BELİRSİZ işlem tekrar gönderilmiyor ve preflight açık. GERÇEK limitleri ve varsayılanları değişmedi (test ediliyor).
- Testlerde ve canlı doğrulamada gerçek emir gönderilmedi. Order/algo/sendTransaction istek sayısı 0.
