#!/bin/sh
set -eu

test -s hpr/edge/ui/edge-g16-security.js
grep -Fq 'edge-g16-security.js' hpr/edge/ui/hpr-config.js
grep -Fq "PIN must be exactly 6 digits" hpr/edge/admin.cgi
! grep -q 'MutationObserver\|setInterval' hpr/edge/ui/edge-g16-security.js

D="$(mktemp -d)"; trap 'rm -rf "$D"' EXIT
mkdir -p "$D/data" "$D/run"
printf '%s\n' '{"station":{"name":"HPR","lat":20,"lon":106,"height_m":5,"uuid":""},"display":{},"feeders":[]}' > "$D/data/config.json"
printf '%s\n' '123456' > "$D/data/pin"
GOOD='{"pin":"123456","new_pin":"654321"}'
OUT="$(printf '%s' "$GOOD" | env REQUEST_METHOD=POST QUERY_STRING=op=pin HPR_EDGE_DATA_DIR="$D/data" HPR_EDGE_RELOAD_FILE="$D/run/reload" sh hpr/edge/admin.cgi)"
printf '%s' "$OUT" | grep -Fq 'pin-changed'
test "$(cat "$D/data/pin")" = 654321
test ! -e "$D/run/reload"
BAD='{"pin":"123456","new_pin":"111111"}'
printf '%s' "$BAD" | env REQUEST_METHOD=POST QUERY_STRING=op=pin HPR_EDGE_DATA_DIR="$D/data" HPR_EDGE_RELOAD_FILE="$D/run/reload" sh hpr/edge/admin.cgi | grep -Fq '403 Forbidden'
test "$(cat "$D/data/pin")" = 654321
SHORT='{"pin":"654321","new_pin":"12345"}'
printf '%s' "$SHORT" | env REQUEST_METHOD=POST QUERY_STRING=op=pin HPR_EDGE_DATA_DIR="$D/data" HPR_EDGE_RELOAD_FILE="$D/run/reload" sh hpr/edge/admin.cgi | grep -Fq '400 Bad Request'
printf '%s\n' 'edge_g16_admin: PASS'
