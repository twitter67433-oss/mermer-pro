# NEON//TERMINAL · SUNUCU (7/24 MEME bot)

Runs the unchanged MEME engine (meme.js + exec.js + copy.js + pump.js) in headless Chrome on an always-on Linux machine, so the bot keeps trading when the phone page is closed. The phone site becomes a remote control (⚡ MEME → 🖥 SUNUCU).

```
bash server/start.sh     # start (idempotent) — prints the tunnel URL; pairing link in $NEON_DATA/pair-link.txt
bash server/status.sh    # PIDs, tunnel, mode / OTO / equity
bash server/stop.sh      # stop everything (bot state is kept)
```

* Data dir `NEON_DATA` (default `/workspace/neon-bot-data`, chmod 700, **not in the repo**): Chrome profile (localStorage: settings, SIM account, PIN-encrypted bot wallet), `token` (600), `pair-link.txt`, `tunnel-url.txt`, logs.
* `supervise.sh` restarts `server.mjs` 5 s after any exit; `server.mjs` restarts the bot page if it crashes / stops answering for 20 s, and resumes OTO (SIM always; GERÇEK only while the wallet is unlocked).
* Public access: Cloudflare quick tunnel if outbound 7844 works, else LocalToLink (HTTPS :443, no account, links renewed every ~2 h). The URL changes on renewal/restart; the phone finds the new one by itself through an AES-GCM-encrypted message (key and topic derived from the token) on ntfy.sh. `NEON_DISCOVERY=0` disables that.
* Every `/api/*` call needs the token (Bearer header or `t` in a text/plain JSON body — no CORS preflight). The phone uploads only the PIN-encrypted wallet record; the PIN is sent over HTTPS to unlock and is kept in server memory only. After a process restart the wallet is locked and GERÇEK trading stays off until the PIN is entered again from the phone.
* Env: `NEON_PORT` (8899), `NEON_CHROME`, `NEON_SITE`, `NEON_TUNNEL=0`, `NEON_TUNNEL_ORDER=cloudflared,localtolink`.


## 🖥 BİLEŞİK OTO sunucusu (v8.2.1 · yalnız SİM)

`comp-server.mjs` + `comp-engine.cjs`: telefondaki BİLEŞİK OTO'nun tarayıcısız Node sürümü (aynı `sert.js` / `aksiyon.js` / `psim.js` / `comp.js` / `squeeze.js`). Sanal kasa; **yalnız halka açık Binance GET verisi, anahtar/imza/cüzdan/emir yok** (testle kanıtlı). MEME botundan (`server.mjs`, Chrome + cüzdan) ayrı ve bağımsızdır.

```
bash server/comp-start.sh     # başlat (idempotent): supervisor + sunucu + tünel; eşleşme linki → $COMP_DATA/pair-link.txt
bash server/comp-status.sh    # PID'ler + kasa / bugün / açık / tarama / not
bash server/comp-stop.sh      # durdur (durum state.json'da kalır)
```

* Veri dizini `COMP_DATA` (varsayılan `/workspace/neon-comp-data`, 700; `token`, `state.json`, `events.jsonl`, `pair-link.txt`, loglar 600; depoda yok).
* `comp-supervise.sh`: çökerse 5 sn sonra yeniden başlatır; heartbeat 3 dk bayatsa yeniden başlatır. Kutu yeniden başlarsa süreçler ölür → `comp-start.sh` yeniden çalıştırılmalı.
* API (token şart; `/api/ping` hariç): `GET|POST /api/state` (salt-okunur), `POST /api/cfg` (beyaz listeli SİM ayarları), `/api/toggle`, `/api/kill`, `/api/reset` (`confirm:"SIFIRLA"`). Başka uç yok (emir/ticaret uç noktası bulunmaz).
* Tünel: LocalToLink (~2 saatte bir yenilenir) → telefon yeni adresi token'dan türetilen şifreli ntfy kanalından bulur. Env: `COMP_PORT` (8898), `COMP_TUNNEL=0`, `COMP_DISCOVERY=0`.
* Telefon: SHORT / LONG sekmesi → 🖥 SUNUCU → eşleşme linkini yapıştır.
