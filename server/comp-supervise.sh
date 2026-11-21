#!/usr/bin/env bash
# Keeps comp-server.mjs running (BİLEŞİK OTO, SİM only): restarts it 5 s after any exit and when its heartbeat is stale for 3 min. Single instance (flock).
DATA="${COMP_DATA:-/workspace/neon-comp-data}"; HERE="$(cd "$(dirname "$0")" && pwd)"
umask 077; mkdir -p "$DATA"; chmod 700 "$DATA"
exec 9>"$DATA/supervisor.lock"; flock -n 9 || { echo "supervisor zaten çalışıyor"; exit 0; }
echo $$ > "$DATA/supervisor.pid"
child=""; trap 'kill -TERM "$child" 2>/dev/null; wait "$child" 2>/dev/null; rm -f "$DATA/supervisor.pid"; exit 0' TERM INT
while :; do
  [ -f "$DATA/STOP" ] && { rm -f "$DATA/supervisor.pid"; exit 0; }
  node "$HERE/comp-server.mjs" >>"$DATA/stdout.log" 2>&1 &
  child=$!; started=$(date +%s)
  while kill -0 "$child" 2>/dev/null; do
    sleep 30; [ -f "$DATA/STOP" ] && break
    now=$(date +%s); hb=$(stat -c %Y "$DATA/heartbeat" 2>/dev/null || echo 0)
    if [ $((now-started)) -gt 240 ] && [ $((now-hb)) -gt 180 ]; then echo "$(date -Is) heartbeat stale — restarting server" >>"$DATA/stdout.log"; kill -TERM "$child" 2>/dev/null; sleep 3; kill -KILL "$child" 2>/dev/null; break; fi
  done
  wait "$child" 2>/dev/null; code=$?
  echo "$(date -Is) comp-server.mjs exited ($code)" >>"$DATA/stdout.log"
  [ -f "$DATA/STOP" ] && { rm -f "$DATA/supervisor.pid"; exit 0; }
  [ "$(stat -c %s "$DATA/stdout.log" 2>/dev/null || echo 0)" -gt 5000000 ] && mv -f "$DATA/stdout.log" "$DATA/stdout.log.1"
  sleep 5
done
