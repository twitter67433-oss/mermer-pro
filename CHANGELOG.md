# CHANGELOG — MERMER PRO (MERMER TERMİNAL 8.2.5'ten ayrılmış kopya)

## 9.0.1 — 2026-11-22 · telefonda kısa doğrulama tablosu
- Strateji kanıtı tablosu kısaltıldı (TPB/RREV/BRK/SWP + açıklama satırı); risk kontrolü gölge portföyün gerçek durumunu (günlük zarar, soğuma, açık sayısı) kullanır.

## 9.0.0 — 2026-11-22 · MERMER PRO: kanıta dayalı PRO sekmesi
- **Ayrı uygulama:** ad MERMER PRO, Android paketi `com.onur.mermerpro`, ayrı GitHub deposu/Pages adresi, `mpro:` önekli depolama (orijinal uygulamanın verisi görülmez).
- **PRO sekmesi (varsayılan açılış):** tek cevap LONG / SHORT / BEKLE; dokununca giriş, ATR stop, TP1/TP2, geçersizlik, RR, aile kanıtları, reddedilen adaylar. Yalnız kapanmış mumlar; 5dk/15dk/1s/4s; EMA, RSI, MACD, ADX, ATR, VWAP, Bollinger, OBV, taker delta, fonlama, yapı (HH/HL/LH/LL, BOS), süpürme; aileler bir kez sayılır. Rejim: TREND / YATAY / GEÇİŞ / YÜKSEK VOL / DÜŞÜK LİKİDİTE / ANORMAL.
- **Doğrulama (tools/pro):** 120 coin × 180 gün Binance USDⓈ-M, maliyet+kayma+fonlama, iki örnek-dışı yarı, bootstrap GA, rastgele giriş tabanı. **Sonuç: 4 stratejinin hiçbiri geçmedi → hepsi "kanıtlanmadı", PRO sekmesi BEKLE der.** Ayrıntı: docs/PRO_VALIDATION.md.
- **İleri test günlüğü:** her kurulum (gölge) kaydedilir, TP/SL/zaman aşımıyla kendiliğinden sonuçlanır; strateji/giriş/rejim başına canlı isabet ve ortalama R. Otomatik ayar yok.
- **Risk motoru:** işlem başı %1 (en fazla %2), stop mesafesinden boyut, kaldıraç tavanı (≤10, varsayılan 5), stop likidasyonun içinde, günlük zarar %3, 3 kayıp → 12 saat soğuma, en fazla 2 açık, KAPAT ALL, ACİL DURDURMA. Martingale / kayıptan sonra büyütme yok.
- **Denetim düzeltmeleri:** kapanmamış mum (repaint) coinan.js + agents.js, Wilder RSI (agentcore.js), EMA SMA tohumu (chart.js), BİLEŞİK OTO varsayılan kapalı/5× (comp.js). Liste: docs/PRO_AUDIT.md.
- **Testler:** 36 mevcut test (uyarlandı) + 5 yeni (indikatör referansları, ileriye bakış yok, risk, sonuçlandırıcı, depolama/güvenlik) = 41, hepsi geçiyor.
- Dokunulmadı: GERÇEK sekmesi ve güvenceleri, MEME. PRO sekmesi emir göndermez, API anahtarı kullanmaz.

---


## 8.2.5 — 2026-11-21 · formda satır içi onsubmit yok (CSP)
- 8.2.4'teki `onsubmit="return false"` CSP'yi ihlal ediyordu; kaldırıldı, gönderim JS ile `preventDefault` ile durdurulur. Ayarlar aynı.


## 8.2.4 — 2026-11-21 · 🧪 ayar radyoları SHORT/LONG'da birbirini bozmuyordu
- Her yerel panel kendi `<form>`'unda: SHORT ve LONG'daki OTOMATİK / % / $ seçimleri artık aynı `name` grubunu paylaşmıyor (işaretli mod görünür ve KAYDET doğru okur). Davranış 8.2.3 ile aynı.


## 8.2.3 — 2026-11-21 · Yerel 🧪 BİLEŞİK OTO ayarları; 🖥 SUNUCU varsayılan kapalı
- **Yerel panel (KAYDET):** kaldıraç; işlem tutarı $ veya %; maks. pozisyon; STOP zorunlu — OTOMATİK (sinyal, likidasyon mesafesinin içinde sıkılaştırılır), % veya $ (likidasyonun ötesindeyse reddedilir); TP $ veya % + isteğe bağlı iz-süren; günlük hedef / günlük zarar; başlangıç kasa (yalnız SIFIRLA ile uygulanır). Geçersiz değerler kaydedilmez. Varsayılanlar eskisi gibi: 1000 $, maks. 2, %5, 20×, +7 $ net, OTOMATİK stop.
- **🖥 SUNUCU:** kutu sunucusu durduruldu (STOP dosyası, süreç yok; state.json duruyor). Panel kodu duruyor ama SHORT/LONG'da yerel 🧪'nin *altında*, varsayılan kapalı bir `<details>`. Eski eşleşme (v8.2.2) bir kez çözülür; eşleşmemişken sunucuya / ntfy'ye istek yok (0 istek). `#comppair=` otomatik eşlemez; BAĞLAN yolu ileride duruyor.
- Dokunulmadı: sinyal motoru, listeler, rozetler, GERÇEK, MEME. "Kanıtlanmadı" uyarısı duruyor.


## 8.2.2 — 2026-11-21 · 🖥 SUNUCU paneli SHORT/LONG üstünde, her zaman görünür
- **Düzeltme:** v8.2.1'de eşleşmemiş 🖥 SUNUCU paneli kapalı bir `<details>` idi ve yerel 🧪 BİLEŞİK OTO'nun *altında* duruyordu. Telefonda (412×915) 🧪 paneli ilk ekranı doldurduğu için 🖥 satırı ya katlanmış bir özet olarak kalıyor ya da kaydırınca bile yapıştırma kutusu görünmüyordu. Panel artık SHORT ve LONG'un *en üstünde*, her zaman açık bir kart: yapıştırma kutusu + **BAĞLAN** düğmesi.
- MEME sekmesindeki "Gelişmiş · SUNUCU" kutusuna BİLEŞİK (`#comppair=`) linki yapıştırılırsa ipucu çıkar: "Bu link SHORT sekmesindeki 🖥 SUNUCU için"; **SHORT'A GİT VE BAĞLAN** (veya o kutudaki bağlan düğmesi) paneli SHORT'a yönlendirir. MEME `#pair=` linkleri eskisi gibi çalışır; GERÇEK ve sinyal motoruna dokunulmadı.
- Sunucu heartbeat'i fiyat bayatsa da yazılır (kısa kopuklukta sürecin ölmesini önler).

## 8.2.1 — 2026-11-21 · 🖥 SUNUCU: BİLEŞİK OTO 7/24 (yalnız SİM / TEST)
- **Yeni:** BİLEŞİK OTO artık uygulama kapalıyken de çalışabilir: `server/comp-server.mjs` (Node, tarayıcı yok) aynı motor dosyalarını değiştirmeden kullanır — `sert.js` (sinyaller), `aksiyon.js` (GİR / ÇIK), `psim.js` (dolum, masraf, cross), `comp.js` (marj, +net-$ hedef, günlük hedef/zarar, 2 zarar → bekleme), `squeeze.js`. Varsayılanlar aynı: 1000 $, maks. 2, %5 marj, 20×, +7 $ net, zorunlu stop, yalnız GİR. Yalnız kripto (ayardan hisse/emtia eklenir).
- **Yalnız halka açık Binance USD-M piyasa verisi (GET).** Sunucuda API anahtarı, imza, cüzdan, emir/hesap uç noktası YOK; ağ katmanı 8 halka açık yol dışında her isteği reddeder. `tests/compserver.test.js` istekleri kaydeder + kaynak taraması yapar.
- **Telefon (compsrv.js, yeni dosya):** SHORT / LONG sekmesinde 🖥 SUNUCU paneli: kasa, bugün, açık pozisyonlar, son işlemler, "neden bekliyor" notu, tarama durumu; ayarlar sunucuya gider (kaldıraç, maks. pozisyon, marj %, hedef $, günlük hedef/zarar…), BAŞLAT/DURDUR, HEPSİNİ DURDUR, SIFIRLA (yazılı onay). Eşleşme linki `#comppair=adres|token` (yalnız cihazda saklanır). Eşliyken yerel panel durdurulur ve gizlenir (tek hesap); eşlemeyi kaldırınca geri gelir.
- **Erişim:** token'lı API (token rastgele, chmod 600, depoda yok); tünel adresi ~2 saatte bir değişir, telefon yeni adresi token'dan türetilen şifreli ntfy kanalından kendisi bulur. Veri dizini `/workspace/neon-comp-data` (700; dosyalar 600).
- **Dokunulmadı:** sinyal motoru, listeler, rozetler, GERÇEK sekmesi, `comp.js` / `psim.js` / `sert.js` / `aksiyon.js` (test: git diff). Eski MEME sunucusu (`server/server.mjs`) çalıştırılmadı.
- Testler: `tests/compserver.test.js`, `tests/compsrv.test.js` — 36 dosya.
- Hâlâ geçerli: 29 günlük gerçek-veri replay'inde bu kurallar zarar etti (docs/BACKTEST_REPORT.md). Sunucu yalnız sanal parayla bunu canlıda ölçer; "kanıtlanmadı".

## 8.2.0 — 2026-11-21 · BİLEŞİK OTO (yalnız SİM / TEST)
- **Yeni (SHORT ve LONG sekmesinde, minimal panel):** 🧪 **BİLEŞİK OTO** — sanal kasada (varsayılan **1000 $**) AKSİYON rozeti **GİR** olan sinyalleri sinyal yönünde otomatik açar. Varsayılanlar (hepsi panelde "ayarlar"dan değişir): **maks. 2 pozisyon**, marj = kasa × **%5** (başlangıçta **50 $** → kazandıkça 60 → 70 → 80, kaybedince küçülür), **20×** (1–50 ayarlanabilir; likidasyon uzaklığı pozisyon satırında), **cross** (tüm pozisyonlar aynı kasayı paylaşır; özkaynak ≤ bakım marjı olursa HEPSİ likide olur, kasa gider), **net +7 $** kâr al (ücret + kayma sonrası; 5–10 $ ayarlanabilir; isteğe bağlı iz-süren çıkış), **her işlemde stop zorunlu** (stopsuz işlem açılmaz), ÇIK rozetinde (HEDEF2 / 60 dk / ters sinyal) kapanış, günlük hedef **2000 $** (ulaşınca gün biter), günlük zarar **−%10** (açıkları kapatır, gün biter), 2 ardışık zarar → 60 dk bekleme, HEPSİNİ DURDUR (kill switch), SIFIRLA.
- **Panel:** kasa, bugün K/Z, işlem sayısı, kazanma oranı, açık pozisyonlar, hedefe ilerleme çubuğu, son 5 işlem. Onur'un isteğiyle **otomatik**: açılışta AÇIK (yalnız SİM), onay sormadan açar/kapatır; ■ DURDUR / HEPSİNİ DURDUR ile kapanır.
- **Sınırlar (kod + test):** yalnızca SİM. Kendi anahtarı `mermer.comp`; GERÇEK sekmesi, `trade.js`, `auto.js`, `exec.js`, API anahtarı, cüzdan, emir uç noktası **hiç kullanılmaz** (test: kaynak taraması + GERÇEK modüllerinde COMP referansı yok). Sinyal rozetinden gerçek emir yok.
- **ÖLÇÜLDÜ (docs/BACKTEST_REPORT.md):** 29 gün, 519 kripto perp, gerçek 15dk + OI + funding verisi, gün gün 1000 $ ile: **2000 $'a ulaşan gün 0/29**, gün sonu medyanı **897 $**, en kötü gün **878 $**, likidasyon **0**, 977 işlem, kazanma **%49** (başabaş için %64 gerekirdi), işlem başına **−2.68 $**; kesintisiz 29 gün: 1000 $ → 126 $. Avantaj kanıtı yok; panel bunu açıkça yazar.
- `psim.js`: `open(..., {cross:true})` (yalnız BİLEŞİK OTO; manuel SİM davranışı aynı). `sert.js`: `SERTS.all()` / `SERTS.opp()` (salt-okunur). `aksiyon.js`: BİLEŞİK pozisyonlar "takipte" sayılır (ÇIK bildirimi).
- Araçlar: `tools/compound820/fetch.js`, `backtest.js`, `result.json`. Testler: `tests/compound.test.js` (74 kontrol) — 34 dosya.

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
