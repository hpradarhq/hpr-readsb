#!/bin/sh
set -eu
# G15 CI gate: provider-first feeders + child-only restart.

test -s hpr/edge/ui/edge-g15-feeds.js
grep -Fq 'skyfeed.hpradar.com' hpr/edge/ui/edge-g15-feeds.js
grep -Fq 'beast_reduce_plus_out' hpr/edge/ui/edge-g15-feeds.js
grep -Fq 'edge-g15-feeds.js' hpr/edge/ui/hpr-config.js
grep -Fq "for ENCODED in \$(jq -r '.feeders[]? | select(.enabled==true) | @base64'" hpr/edge/entrypoint.sh
! grep -q 'MutationObserver\|setInterval' hpr/edge/ui/edge-g15-feeds.js

D="$(mktemp -d)"; trap 'rm -rf "$D"' EXIT
mkdir -p "$D/data" "$D/run"
printf '%s\n' '{"station":{"name":"HPR","lat":20,"lon":106,"height_m":5,"uuid":""},"display":{},"feeders":[]}' > "$D/data/config.json"
printf '%s\n' '123456' > "$D/data/pin"
BODY='{"pin":"123456","id":"hpradar","name":"HPRadar","host":"skyfeed.hpradar.com","port":30004,"protocol":"beast_reduce_plus_out","enabled":true,"uuid":""}'
OUT="$(printf '%s' "$BODY" | env REQUEST_METHOD=POST QUERY_STRING=op=feeder_upsert HPR_EDGE_DATA_DIR="$D/data" HPR_EDGE_RELOAD_FILE="$D/run/reload" sh hpr/edge/admin.cgi)"
printf '%s' "$OUT" | grep -Fq 'readsb-child-restart'
test -e "$D/run/reload"
test "$(jq -r '.feeders[0].host' "$D/data/config.json")" = skyfeed.hpradar.com
test "$(jq -r '.feeders[0].port' "$D/data/config.json")" = 30004
rm -f "$D/run/reload"
DEL='{"pin":"123456","id":"hpradar"}'
printf '%s' "$DEL" | env REQUEST_METHOD=POST QUERY_STRING=op=feeder_delete HPR_EDGE_DATA_DIR="$D/data" HPR_EDGE_RELOAD_FILE="$D/run/reload" sh hpr/edge/admin.cgi | grep -Fq '200 OK'
test -e "$D/run/reload"
test "$(jq '.feeders|length' "$D/data/config.json")" = 0
printf '%s\n' 'edge_g15_admin: PASS'
