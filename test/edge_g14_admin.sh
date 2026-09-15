#!/bin/sh
set -eu
D="$(mktemp -d)"; trap 'rm -rf "$D"' EXIT
mkdir -p "$D/data" "$D/run"
printf '%s\n' '{"station":{"name":"HPR","lat":20,"lon":106,"height_m":5,"uuid":""},"display":{"units":"nautical","ring_enabled":true,"ring_count":4,"ring_step_nm":50,"ring_color":"#59ddff","actual_range":true}}' > "$D/data/config.json"
printf '%s\n' '123456' > "$D/data/pin"
BODY='{"pin":"123456","units":"metric","ring_enabled":true,"ring_count":3,"ring_step_nm":25,"ring_color":"#336699","actual_range":false}'
OUT="$(printf '%s' "$BODY" | env REQUEST_METHOD=POST QUERY_STRING=op=display HPR_EDGE_DATA_DIR="$D/data" HPR_EDGE_RELOAD_FILE="$D/run/reload" sh hpr/edge/admin.cgi)"
printf '%s' "$OUT" | grep -Fq '200 OK'
printf '%s' "$OUT" | grep -Fq 'live-ui'
test ! -e "$D/run/reload"
test "$(jq -r '.display.units' "$D/data/config.json")" = metric
test "$(jq -r '.display.ring_count' "$D/data/config.json")" = 3
test "$(jq -r '.display.ring_color' "$D/data/config.json")" = '#336699'
printf '%s\n' 'edge_g14_admin: PASS'
