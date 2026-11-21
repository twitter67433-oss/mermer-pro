# MERMER TERMİNAL — Test Raporu (v8.2.4, 2026-11-21)

## v8.2.4
- 36 test dosyası, hepsi geçti. `tests/compound.test.js`: her 🧪 paneli kendi formunda (SHORT/LONG radyo grubu ayrılır).

## v8.2.3
- 36 test dosyası, hepsi geçti. `tests/compound.test.js`: varsayılan davranış korunur (OTOMATİK stop, %5 marj, +7 $ TP); validateCfg (boş/varsayılan geçer, kaldıraç 99 ve likidasyon-ötesi stop % reddedilir); sabit $ marj; stop % / $; OTOMATİK stop likidasyon içinde sıkılaşır, kullanıcı stopu reddedilir; TP %; panelde KAYDET + OTOMATİK / % / $. `tests/compsrv.test.js`: eşleşmemiş 🖥 kapalı details (BAĞLAN duruyor), yerel 🧪 üstte, v8.2.2 eşleşmesi bir kez çözülür (mig !== 823), eşleşmemişken poll/discover/ntfy yok, `#comppair=` otomatik eşlemez.

## v8.2.2
- 36 test dosyası. `tests/compsrv.test.js`: eşleşmemiş kart her zaman açık (BAĞLAN + yapıştırma kutusu, kapalı details yok), panel SHORT/LONG'da 🧪'nin üstünde, MEME kutusundaki `#comppair=` yönlendirmesi, anında boyama. GERÇEK / sinyal dosyalarına referans yok.

## v8.2.1
- 36 test dosyası, hepsi geçti. Yeni: `tests/compserver.test.js` (sunucu motoru: tarama → GİR → SİM işlem, varsayılanlar, +7 $ net, maks. 2, zorunlu stop, GEÇ KALDIN → işlem yok, 2 zarar → bekleme, ÇIK, telefon ayarları beyaz liste, yeniden başlatmada durum; **ağ kanıtı:** kaydedilen tüm istekler halka açık GET, anahtar/imza/emir kodu yok, izin listesi 8 yol; token'sız 401, dosya modları 700/600) ve `tests/compsrv.test.js` (telefon paneli: eşleşme linki, yalnız sunucu + ntfy fetch, yalnız SİM uç noktaları, GERÇEK modüllerinde referans yok).
- Canlı: tünel üzerinden token'lı durum + ayar değişimi, tarayıcıda panel (0 sayfa hatası, 0 CSP ihlali, emir isteği yok).

## v8.2.0
- 34 test dosyası. Yeni: `tests/compound.test.js` (74 kontrol): varsayılanlar (1000 $ / 2 poz / %5 / 20× / +7 $ / 2000 $ / −%10) ve ayar sınırları, marj 50 → 60 → 70 → 80 ve kayıpta küçülme, +7 $ net hedef (LONG/SHORT × maliyet açık/kapalı → +7.00 $), zorunlu stop (stopsuz / ters taraf reddedilir), yalnız GİR rozeti (BEKLE/ÇIK/KÂR AL/yok → işlem yok), maks. 2 pozisyon + coin başına bir, kapalı / kill switch, boşlukta stop açılıştan dolar, stop+hedef aynı mumda → stop, 2 ardışık zarar → bekleme → devam, günlük hedef / günlük zarar (+açıkları kapatma) / Berlin günü sıfırlama, iz-süren çıkış, ÇIK (ters sinyal, 60 dk), **cross likidasyon (hepsi likide, kasa gider)**, cross likidasyon uzaklığı, manuel SİM'in izole kuralı değişmedi, JSON gidiş-dönüş, **kaynak taraması: emir uç noktası / anahtar / GERÇEK modülü yok, tek depolama anahtarı `mermer.comp`, GERÇEK modüllerinde COMP referansı yok**, panel yalnız SHORT/LONG.
- Geriye dönük: psim.test (manuel SİM) ve aksiyon.test değişmeden geçti.

## v8.1.0
- 33 test dosyası, hepsi geçti. Yeni: `tests/aksiyon.test.js` (47 kontrol: GİR bölgesi 0.3R, stop-önce, boşlukta seviye vurulmuş sayılır, TP1/TP2, 60 dk, ters sinyal, squeeze yalnız SHORT, mandal, linger, eşikler, HAREKET tutma/dönüş/kovalama, rozet HTML, emir/anahtar yok, bağlama).
- Canlı doğrulama teslim notunda.

## v8.0.1

## v8.0.1
- 31 test dosyası, hepsi geçti. Yeni: `tests/hareket.test.js` (39 kontrol: 1s/24s/15dk eşikleri, coin+pencere başına tek uyarı, yön, risk satırı, yalnız kripto, emir/anahtar/cüzdan yok, KRİPTO/HİSSE/HEPSİ, kripto önce tarama, hisse seans hacim tabanı, eski fstream yolu yok).
- Tarayıcı (yerel): KRİPTO varsayılan, tam tarama 767/767 (~177 sn), HAREKET 45 sn'de 13 uyarı (EVAA, MMT, CYBER, DOS, PIPPIN …), 0 emir, 0 sayfa hatası, 0 CSP. Canlı sonuçlar teslim notunda.

## v8.0.0

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
| canlı GitHub Pages (8.0.0) — tüm sekmeler | 6 (3+3 paralel) | 0 | 0 | 0 | `securitypolicyviolation` olayı 0, `data-onerr` canlı çalıştı |
| canlı — SİNYAL 8 paneli 15dk / 1s / 4s | 3 | 0 | 0 | 0 | APP_V 8.0.0, SIG8 yüklü |

v7.51'de 5 canlı koşudan 1'inde görülen tek CSP mesajı v8.0'da 9 canlı + 1 yerel koşuda **tekrarlanmadı**. Mesajın tam metni o zaman 200 karakterde kesildiği için kaynağı kesin belirlenemedi; artık tam metin ve `securitypolicyviolation` ayrıntıları (yönerge, URI, dosya, satır) kaydediliyor (`v800.js`).

## Android
APK derlendi (Gradle 8.14.3, compileSdk 36), aynı sertifikayla imzalandı, `apksigner verify` v2 geçti, `aapt2` versionCode 800 / versionName 8.0, NeonKeystorePlugin dex içinde. **Gerçek cihazda/emülatörde çalıştırılmadı.**

## Kaynak arşivi
`git archive` → `MermerTerminal-kaynak-v8.0.zip`; jks/keystore/properties/private key/API secret taraması: dosya adlarında `.jks/.keystore/.p12/.pem/keystore.properties/.env/.apk` yok; içerikte `PRIVATE KEY`, `storePassword/keyPassword`, Binance gizli anahtar biçimi (64 karakter alfanümerik `secret` ataması), Solana 64-bayt gizli anahtar dizisi aranır → bulgu yok (bkz. teslim notu).
