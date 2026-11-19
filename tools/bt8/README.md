# SİNYAL 8 geçmiş testi (v7.50) — yeniden üretme

Betikler kutuda `/workspace/r750` altında çalıştırıldı. Yollar mutlak olduğundan başka bir yerde çalıştırmadan önce düzenlenmeli.

1. `node fetch.js`: 40 Binance USDT perp için 15m / 1h / 4h mumlarını çeker. Pencere: 120 gün + 300 mum ısınma.
2. `node fetch2.js`: aynı coinler için 5m / 30m / 2h / 1d mumlarını çeker (yalnızca eski TREND GİR motorunun çok aralıklı oylaması için).
3. Eski motor kodu: `git show 6b3b6b6:smart.js > old733/smart.js`, aynı şekilde `scalp.js`.
   - `old733f` = aynı dosya, ama `FEE = 0.15`.
   - `old733g` = aynı dosya, ama `gReplay` giriş planını da kaydeder.
4. `node oldeval.js walk`, `node oldeval.js scalp`, `node oldtrend.js`: eski motorların sinyalleri. Hepsi aynı maliyet ve aynı çözücü ile değerlendirilir (`SIG8.resolve`).
5. `node newscan2.js`: SİNYAL 8'in tüm adayları ve her hedef (1 / 1.5 / 2 / 3R) için sonucu.
6. `node wf.js`: walk-forward. 4 × 30 gün; her katta parametreler yalnızca önceki katlarda, kapanmış işlemlerle seçilir.
7. `node table.js`: eski / yeni karşılaştırma tablosu (örneklem dışı 90 gün).
