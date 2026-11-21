#!/usr/bin/env bash
DATA="${COMP_DATA:-/workspace/neon-comp-data}"
for n in supervisor server tunnel; do p=$(cat "$DATA/$n.pid" 2>/dev/null); printf "%-12s %s %s\n" "$n" "${p:--}" "$( [ -n "$p" ] && kill -0 "$p" 2>/dev/null && echo çalışıyor || echo YOK)"; done
curl -s -m 10 -H "authorization: Bearer $(cat "$DATA/token")" http://127.0.0.1:${COMP_PORT:-8898}/api/state | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s),t=j.status;console.log("durum",t.state,"· kasa",t.bal.toFixed(2),"· bugün",t.day.pnl.toFixed(2),"· açık",j.open.length,"· işlem",j.tot.n,"· tarama",j.scan.done+"/"+j.scan.total,"· fiyat",j.px.n,"· not:",j.note)}catch(e){console.log("API cevap yok")}})'
