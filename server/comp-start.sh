#!/usr/bin/env bash
# Start the 24/7 BİLEŞİK OTO server (SİM only, idempotent). Pairing link (a secret) is written to $COMP_DATA/pair-link.txt — never print it into chat.
DATA="${COMP_DATA:-/workspace/neon-comp-data}"; HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$DATA"; chmod 700 "$DATA"; rm -f "$DATA/STOP"
if [ -f "$DATA/supervisor.pid" ] && kill -0 "$(cat "$DATA/supervisor.pid")" 2>/dev/null; then echo "zaten çalışıyor (supervisor $(cat "$DATA/supervisor.pid"))"
else setsid nohup bash "$HERE/comp-supervise.sh" >/dev/null 2>&1 < /dev/null & echo "başlatıldı"; fi
for i in $(seq 1 90); do [ -s "$DATA/tunnel-url.txt" ] && break; sleep 1; done
echo "tünel: $( [ -s "$DATA/tunnel-url.txt" ] && echo hazır || echo bekleniyor)"; echo "eşleşme linki dosyası: $DATA/pair-link.txt"
