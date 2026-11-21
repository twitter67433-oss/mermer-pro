#!/usr/bin/env bash
# Stop the BİLEŞİK OTO server (state is kept in $COMP_DATA/state.json; start again with comp-start.sh).
DATA="${COMP_DATA:-/workspace/neon-comp-data}"; touch "$DATA/STOP"
[ -f "$DATA/supervisor.pid" ] && kill -TERM "$(cat "$DATA/supervisor.pid")" 2>/dev/null
[ -f "$DATA/server.pid" ] && kill -TERM "$(cat "$DATA/server.pid")" 2>/dev/null
for i in $(seq 1 15); do [ -f "$DATA/supervisor.pid" ] && kill -0 "$(cat "$DATA/supervisor.pid")" 2>/dev/null || break; sleep 1; done
p=$(cat "$DATA/tunnel.pid" 2>/dev/null); [ -n "$p" ] && { kill -TERM -"$p" 2>/dev/null || kill -TERM "$p" 2>/dev/null; }; echo durduruldu
