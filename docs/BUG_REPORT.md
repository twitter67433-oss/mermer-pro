# MERMER TERMİNAL — Hata Raporu (FAZ 1 denetimi → FAZ 2 düzeltmeleri, v7.40)

Denetlenen sürüm: **v7.33.3 (commit 6b3b6b6)**. Satır numaraları aksi yazmadıkça bu sürüme aittir.
Yöntem: tüm JS için `node --check` (0 sözdizimi hatası), mevcut 23 testin tamamı (hepsi geçti), her iddia kodda satır satır doğrulandı.
İddialar doğru varsayılmadı: her biri **DOĞRULANDI / HATA DEĞİL / KISMEN** olarak işaretlendi.

## 1. İddialar A–K

| # | İddia | Sonuç | Kanıt (v7.33.3) | Gerekçe | v7.40 |
|---|---|---|---|---|---|
| A | Elle girilen miktar max zarar sınırını aşabiliyor | **DOĞRULANDI** | trade.js:148 `if (man){ raw = +man; by = "elle girildi"; }` | Elle miktar zararı yalnızca gösteriyordu, emri engellemiyordu. Ücret ve kayma hesaba katılmıyordu. `+man` "1e" / "abc" gibi girdileri de NaN'a çeviriyordu. | Düzeltildi: bfxsafe.js `size()`, trade.js `sizeNow()`/`calc()` |
| B | Binance API Secret düz metin saklanıyor | **DOĞRULANDI** | trade.js:36–47 `rd/prof/pset`, conn.js:48–49 | Secret localStorage'da düz metin duruyordu. CSP yoktu. | Düzeltildi: bkeys.js (AES-GCM + PBKDF2 PIN), göç, CSP. Sınırlar için SECURITY_AUDIT.md'ye bakın. |
| C | SL/TP kurulamazsa pozisyon korumasız kalıyor | **DOĞRULANDI** | trade.js:182–191 (`✖ … kurulamadı` yazıp devam), autoOrder 390–413, kaldıraç hatası yalnızca uyarıydı | Stop kurulamayınca pozisyon açık kalıyordu. Doğrulama, idempotency ve uzlaştırma yoktu. closePosition 197–212 `cancelAll(sym)` hedge modda karşı tarafın stopunu da siliyordu. | Düzeltildi: bfxsafe.js `openProtected/placeVerified/reconcile`, trade.js `cleanupAfterClose` |
| D | SIM sermayesi gerçek cüzdana bağlı | **KISMEN** | meme.js:30 `SIM_FALLBACK = 0.212`, 413–417, 731 | SIM defteri zaten ayrıydı (neon.sim, RK/EK("SIM")). Ancak "SIM = GERÇEK BAKİYE" cüzdan okunamayınca eski gerçek bakiyeyi (0.212) sessizce kullanıyordu. | Düzeltildi: okunamazsa hiçbir şey değişmez. SANAL etiketi eklendi. |
| E | Solana zaman aşımı = başarısız sayılıyor, tekrar gönderim riski var | **DOĞRULANDI** | exec.js:47 `confirm()` 40 sn sonra throw. meme.js:250/261 alım "başarısız" sayılıyordu, 292 `retryAt` satışı yeniden gönderiyordu. | Zaman aşımında işlem zincire girmiş olabilir. Bu durumda çift alım/satış riski oluşuyordu. | Düzeltildi: BELİRSİZ durumu, blockhash süresi dolana kadar sorgulama, bekleyen defter, aynı işlem için yeniden gönderim yok |
| F | Simülatör gerçekçi değil | **KISMEN** | exec.js:108 `sim()` | Ücret, gecikme ve haircut zaten modelleniyor. Kısmi dolum ve gerçek likidite derinliği modellenmiyor. | **v8.0 düzeltildi:** PSIM (vadeli SİM) dolumu emir defterinden (Binance `@depth20@500ms`, ≤3 sn taze) VWAP ile yürür, derinlik yetmezse KISMİ dolum; defter yoksa model (spread/2 + kayma + gecikme), stopta 2× kayma, taker ücret. Meme SİM zaten pump.fun %1.25 + PumpPortal %0.5 + ağ/öncelik ücreti + Jito + ATA kira 0.00203928 SOL + gecikme + haircut modelliyordu (exec.js). Yalnız SİM; GERÇEK yol değişmedi. |
| G | İstatistikler yanıltıcı (isabet oranı) | **DOĞRULANDI** | smart.js:131 `hitB = TP/(TP+SL)`, 155 minHit kapısı | Süresi dolan işlemler oranın dışında kalıyordu. "Tuttu %" net kazanç değildi. | Düzeltildi: her işlem tek bir sınıfta sayılıyor (TP/SL/süre+/süre−). Net kazanç % ve TP % ayrı gösteriliyor. Kapı min(TP/SL, net kazanç) kullanıyor (daha sıkı). |
| H | Ücret modeli eksik | **DOĞRULANDI** | smart.js:13 `FEE = 0.10` | Gidiş-dönüş taker ücreti var, kayma yok. Sinyal istatistiği gerçekte olduğundan biraz iyimser. | v7.50: SIG8.COST maliyet modeli (maker/taker, spread, kayma, funding) + `SMT.setFee`. Kapı varsayılanı ölçümle korundu (BACKTEST_REPORT.md). |
| I | Binance OTO için zarar sınırları yok | **DOĞRULANDI** | auto.js `onAnalysis` yalnızca `maxDay` | Kümülatif günlük zarar, ardışık zarar sonrası bekleme ve açık pozisyon sınırı yoktu. (ST.bn kalıcı değil; yeniden yüklemede OTO kapanır, bu iyi.) | Düzeltildi: bfxsafe.js `gate()`, auto.js |
| J | skipPreflight varsayılan açık | **DOĞRULANDI** | exec.js:15 `skipPre: true`, 58–60 | Başarısız olacak işlem de gönderiliyor ve ücret yakıyordu. | Düzeltildi: varsayılan kapalı, bir kerelik göç (pv=1), açarken onay istenir |
| K | Belgeler ve sürüm etiketleri güncel değil | **DOĞRULANDI** | README v6/v7.13'ü anlatıyor. engine.js:221 `tm-worker.js?v=7.30.1` (bump.sh kaçırıyor). | Eski worker önbellekten gelebilir. | Worker etiketi APP_V'ye bağlandı. README sonraki faz. |

> Not: I iddiasının özgün metni bu çalışmada elimde yoktu. Denetim notlarımdaki "Binance OTO zarar sınırı" bulgusuyla eşleştirildi. Spec ile karşılaştırılmalı.

## 2. Diğer bulgular (önem derecesiyle)

| Önem | Bulgu | Yer | Durum |
|---|---|---|---|
| KRİTİK | Hedge modda pozisyon kapatma `cancelAll` ile diğer yönün stopunu da siliyordu | trade.js:197–212 | v7.40'ta düzeltildi: yalnızca o yönün emirleri iptal ediliyor. Hedge modda toplu iptal yapılmıyor. |
| YÜKSEK | Kaldıraç ayarlanamazsa emir yine de gidiyordu (yanlış kaldıraç) | trade.js placeOrder | v7.40'ta düzeltildi: emir engelleniyor |
| YÜKSEK | ONAYLA ile gönderim arasında coin, fiyat veya bakiye değişebiliyordu | trade.js placeOrder | v7.40'ta düzeltildi: onaydan sonra taze fiyat ve yeniden boyutlama yapılıyor. Coin değişti veya miktar arttıysa emir engelleniyor. Aynı anda ikinci gönderime kilit var. |
| YÜKSEK | Emir yanıtı kaybolunca durum bilinmiyordu, tekrar basılınca çift emir olabiliyordu | trade.js | v7.40'ta düzeltildi: newClientOrderId kullanılıyor ve sorgulanıyor, yeniden gönderilmiyor. Bekleyen defter: neon.bfx.pend. |
| ORTA | bot.js:102 `confirm(sig).catch(()=>{})` (Phantom yolu) onay hatasını yutuyor | bot.js:102 | **v8.0 düzeltildi:** `.catch(()=>{})` kaldırıldı; Phantom yolu `EXEC.phSend` (defter + BELİRSİZ + yeniden gönderim yok). |
| ORTA | pump.js / auto.js PUMP OTO, `WALLET.signSendVersioned` üzerinden gidiyor; E'deki BELİRSİZ defteri bu yolu kapsamıyor | bot.js:86 | **v8.0 düzeltildi:** `signSendVersioned` / withdraw / Jupiter / fund ve pump.js / trade.js Phantom yolları EXEC defterinde (anahtar başına tek bekleyen işlem, imzadan önce kilit, zaman aşımı = BELİRSİZ, arka planda uzlaştırma, OTO BELİRSİZ pozisyonu satmaz/yeniden göndermez). tests/botsafe.test.js |
| ORTA | MEME bölümü PASİF yapılırsa BELİRSİZ işlemin arka plan kontrolü de duraklar (sections.js). Defter yine yeniden gönderimi engeller (güvenli taraf). | exec.js bgSettle | Bilinen davranış |
| DÜŞÜK | XSS: innerHTML kullanan yerlerin hepsi incelendi. Dış veri `esc()` ile basılıyor. NOTIFY.toast textContent kullanıyor. auto.js alog / meme tl HTML'i çağıran yerde kaçışlanıyor. Yeni PIN penceresi textContent kullanıyor. | — | Sorun bulunmadı. CSP eklendi. |
| DÜŞÜK | Sözleşme bilgisi (exchangeInfo) yüklenirken hesap kutusu bir an "sözleşme bulunamadı" yazabiliyor, birkaç saniye sonra düzeliyor (canlı 7.33.3'te de aynı) | trade.js:153 | Gerileme değil, sonraki faz |

## 3. Test
- Önce: 23 test dosyası, hepsi geçti.
- v7.40: **27 test dosyası, hepsi geçti.** Yeni dosyalar: `bfxsafe.test.js`, `bkeys.test.js`, `exec.test.js`, `stats.test.js`. memetest'te SIM sabitinin yeniden adlandırması normalize edildi (değer aynı, GERÇEK varsayılanları değişmedi).
- Spec maddeleri: 1–10 (boyut, elle miktar, stop/hedef/kaldıraç, teminat, minNotional, SL hatası → acil kapatma, TP hatası, kayıp yanıt → uzlaştırma), 17 (kısmi dolum), 18 (mükerrer/öksüz emir), 19 (hedge), 21–23 (BELİRSİZ / blockhash / yeniden gönderim yok / preflight), 31 ve 33–35 (şifreleme, yanlış PIN, göç, düz metin yok, CSP), OTO kapısı (günlük zarar, bekleme, kill switch, açık pozisyon sınırı).

## 4. Sonraki fazlar için plan

### Sinyal motoru (Onur'un ek şartları)
- Sürekli akış olmalı, aşırı filtreleme olmamalı. Kararlar ağırlıklı kanıtla verilmeli, "tüm göstergeler aynı yönde" şartı aranmamalı.
- Zaman dilimleri (MTF) çelişirse güven düşmeli, sinyal reddedilmemeli.
- Düşük ADX'te range stratejileri devreye girmeli. Trend, kırılım, dönüş ve range stratejileri birbirinden ayrı olmalı.
- Sinyaller GÜÇLÜ / ORTA / ZAYIF olarak sınıflanmalı, minimum eşik ayarlanabilir olmalı. Riskli ama geçerli sinyaller silinmemeli, sınıflanmalı.
- Sert engel yalnızca şu durumlarda olmalı: geçersiz veri, uygulanamaz emir, zorunlu risk/güvenlik ihlali.
- Reddedilen sinyaller gerekçesiyle gösterilmeli. Coin ve zaman dilimi başına sinyal sıklığı izlenmeli.
- Eşikler örneklem dışı (out-of-sample) veride optimize edilmeli. Ölçütler: sıklık, ücret+kayma sonrası net beklenti, profit factor, max DD, riske göre getiri. Yalnızca kazanma oranı veya sinyal sayısı yeterli değil.
- Teslimden önce eski ve yeni motor aynı geçmiş veride karşılaştırılmalı: sinyal sayısı, kazanma oranı, net beklenti, yanlış sinyal azalması, max DD. **Ölçmeden iyileşme iddia edilmeyecek.**
- H (kayma), G'nin bu kıyas çerçevesine taşınması ve F (kısmi dolum / derinlik simülasyonu) bu fazda ele alınacak.

### FAZ 3b'de bulunan (v7.51) — **v8.0'da DÜZELTİLDİ**
- **ORTA: `sert.js` `simExit` / `simLong`, iz süren stopta iyimser dolum.** İz stop mum kapanışında güncelleniyor. Fiyat zaten stopun ötesindeyse sonraki mum stopun ötesinde açılır, ama çıkış yine stop fiyatından sayılıyor; gerçekte açılıştan dolar. Bu, canlı SERT defterinin kazanma / ortalama rakamlarını biraz iyi gösterir. 1s geçmiş testte bu hata bir listeyi −0.016R'den +0.091R'ye çıkarıyordu (BACKTEST_REPORT §FAZ 3b). Öneri: dolum için `side < 0 ? max(s, k.o) : min(s, k.o)`.

### Diğer
- PUMP OTO ve Phantom yolunda (bot.js) BELİRSİZ defteri.
- Native Android Keystore köprüsü.
- README ve belge güncellemesi.
- Bekleyen kararlar (breadth filtresi, TradFi hariç tutma, kaybeden listeleri gizleme, kapitülasyon kuralı) yalnızca istenirse yapılacak.

## 5. v8.0 durumu

| Bulgu | v8.0 |
|---|---|
| SERT `simExit`/`simLong` iyimser dolum | **Düzeltildi.** Mum stopun ötesinde açılırsa dolum açılıştan (`gapX`). 1dk mumlar artık açılışı saklıyor; eski sonuçlar bir kez yeniden hesaplanıyor (`gf` bayrağı, en çok 20/tur). 28 günlük tekrar: etki küçük (STOPLU ortalama −0.00…−0.02 puan, ayrıntı BACKTEST_REPORT.md §v8.0). |
| F — gerçekçi SİM | **Düzeltildi** (yukarıda F satırı). |
| bot.js:102 + PUMP OTO BELİRSİZ | **Düzeltildi** (yukarıda). |
| CSP `script-src 'unsafe-inline'` | **Kaldırıldı.** Satır içi `<script>` (APP_V → appv.js) ve 8 satır içi olay işleyicisi (onclick/onerror/onsubmit → act.js `data-act` / `data-onerr` / `data-nosubmit`) yok. `style-src 'unsafe-inline'` kalıyor (çok sayıda `style=` özniteliği; betik çalıştırmaz). |
| Native Android Keystore | **Eklendi (APK 8.0):** NeonKeystore eklentisi, API Secret'ın PIN-şifreli kaydını bir kez daha Keystore anahtarıyla sarar. Cihazda elle denenmedi (emülatör/cihaz yok) — docs/ANDROID.md. Bot cüzdanı PIN-only kalır (yedek/sunucuya gönderim taşınabilir olmalı). |
| "sözleşme bulunamadı" anlık yazısı | Açık (DÜŞÜK, görsel). |
