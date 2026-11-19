# MERMER TERMİNAL — Android APK (v8.0)

## Ne var
- Capacitor 8 kabuğu (`com.onur.neonterminal`, minSdk 24, target/compile 36). Uygulama canlı siteyi açar (`server.url` = GitHub Pages `?app=android`); web güncellemeleri APK güncellemesi olmadan gelir.
- Eklentiler: yerel bildirim, titreşim, ekran açık (native.js eşler) ve **v8.0: `NeonKeystore`** (bu repoda kopyası `android/NeonKeystorePlugin.java`, `android/MainActivity.java`).
- İmza: v7.15 / v7.26 ile **aynı sertifika** (SHA-256 `e6701980…b5b0a3`) → üstüne kurulum (güncelleme) çalışır, veriler kalır.

## NeonKeystore (v8.0)
- Telefonun Android Keystore'unda dışa aktarılamaz AES-256-GCM anahtarı (`mermer_secret_wrap_v1`), donanım (TEE/StrongBox) varsa orada.
- `bkeys.js` Binance API Secret'ı **önce PIN ile** şifreler (PBKDF2-SHA256 300k + AES-GCM, değişmedi), sonra çıkan PIN-şifreli metni `wrap` ile Keystore anahtarıyla bir kez daha şifreler (`enc.ks` alanı). Native taraf düz Secret'i ve PIN'i hiç görmez, hiçbir şey loglamaz, ağ kullanmaz.
- Açarken: `unwrap` → PIN ile çöz. PIN yine gerekir.
- Tarayıcıda / eski APK'da eklenti yok → kayıt PIN-only (v7.40 ile aynı). Keystore'a bağlı bir kayıt başka cihazda veya uygulama silinip kurulunca açılmaz → Secret yeniden girilir (Binance'te anahtar yeniden alınabilir; para riski yok).
- Mevcut PIN-only kayıtlar kendiliğinden göçmez; BAĞLANTILAR'da Secret yeniden kaydedilince Keystore katmanı eklenir.
- Bot cüzdanı (Solana) PIN-only kalır: yedek dosyası ve sunucuya şifreli gönderim başka cihazda açılabilmeli.

## Dürüst sınırlar
- **Gerçek cihazda/emülatörde denenmedi** (bu ortamda cihaz yok). Java derlendi, APK imzalandı ve doğrulandı; JS tarafı sahte eklentiyle test edildi (tests/v8.test.js). Keystore çalışmazsa kod PIN-only'ye düşer (Secret yine şifreli).
- Kilit açıkken sayfada çalışan kötü kod Secret'e ulaşabilir; Keystore bunu çözmez. API anahtarında withdraw kapalı + IP kısıtı şart.
- Sıkı CSP: Capacitor köprüsü modern WebView'da CSP'den bağımsız enjekte edilir; çok eski WebView'da köprü engellenir (bkz. SECURITY_AUDIT.md). Android System WebView'ı güncel tutun.

## Derleme (yeniden üretme)
```
cd neon-apk && npm install && npx cap sync android
cd android && ANDROID_HOME=/opt/build/sdk ./gradlew assembleRelease
```
İmza ayarları `NEON_KEYSTORE_PROPS` (varsayılan repo dışı bir yol) dosyasından okunur; anahtar deposu ve şifreleri **hiçbir repoda yok** (.gitignore `*.jks`, `keystore.properties`, `*.apk`).
versionCode 800 / versionName 8.0. Çıktı: `MermerTerminal-v8.0.apk` (GitHub Release `v8.0`).
