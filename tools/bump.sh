#!/bin/sh
# usage: tools/bump.sh 7.31 "footer note"  — sets every local ?v=, APP_V, version.json, header badge
V="$1"; cd "$(dirname "$0")/.." || exit 1
sed -i -E "s/(\.(js|css))\?v=[0-9.]+\"/\1?v=$V\"/g; s/window\.APP_V=\"[0-9.]+\"/window.APP_V=\"$V\"/; s/(<small id=\"ver\" class=\"ver\">)v[0-9.]+/\1v$V/; s/MERMER TERMİNAL · v[0-9.]+ ·/MERMER TERMİNAL · v$V ·${2:+ $2 ·}/" index.html
printf '{"v":"%s"}\n' "$V" > version.json
