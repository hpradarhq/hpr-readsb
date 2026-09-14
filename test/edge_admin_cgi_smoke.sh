#!/bin/sh
set -eu
ROOT="$(mktemp -d)"; trap 'rm -rf "$ROOT"' EXIT
DATA="$ROOT/data"; RUN="$ROOT/reload"; mkdir -p "$DATA"
printf '%s\n' '123456' > "$DATA/pin"
cat > "$DATA/config.json" <<'JSON'
{"station":{"name":"EDGE","lat":20.8,"lon":106.7,"height_m":15,"uuid":""},"display":{"units":"nautical","ring_enabled":true,"ring_count":4,"ring_step_nm":50,"ring_color":"#59ddff","actual_range":true},"feeders":[]}
JSON
CGI=hpr/edge/admin-v2.cgi
run_get(){ REQUEST_METHOD=GET QUERY_STRING="op=$1" HPR_EDGE_DATA_DIR="$DATA" HPR_EDGE_RELOAD_FILE="$RUN" sh "$CGI"; }
run_post(){ op="$1"; payload="$2"; printf '%s' "$payload" | REQUEST_METHOD=POST QUERY_STRING="op=$op" CONTENT_TYPE=application/json HPR_EDGE_DATA_DIR="$DATA" HPR_EDGE_RELOAD_FILE="$RUN" sh "$CGI"; }
OUT="$(run_get config)"; printf '%s' "$OUT" | grep -q 'Status: 200 OK'; printf '%s' "$OUT" | grep -q '"ok":true'
OUT="$(run_post display '{"pin":"000000","units":"metric","ring_enabled":true,"ring_count":3,"ring_step_nm":25,"ring_color":"#112233","actual_range":false}')"; printf '%s' "$OUT" | grep -q 'Status: 403 Forbidden'
OUT="$(run_post display '{"pin":"123456","units":"metric","ring_enabled":true,"ring_count":3,"ring_step_nm":25,"ring_color":"#112233","actual_range":false}')"; printf '%s' "$OUT" | grep -q 'Status: 200 OK'; test "$(jq -r '.display.units' "$DATA/config.json")" = metric; test ! -e "$RUN"
OUT="$(run_post station '{"pin":"123456","name":"HP-EDGE","lat":20.9,"lon":106.8,"height_m":22,"uuid":"550e8400-e29b-41d4-a716-446655440000"}')"; printf '%s' "$OUT" | grep -q 'readsb-child-restart'; test -e "$RUN"; rm -f "$RUN"
OUT="$(run_post feeder_upsert '{"pin":"123456","id":"hpr","name":"HPRadar","host":"feed.hpradar.com","port":30004,"protocol":"beast_reduce_plus_out","enabled":true,"uuid":"550e8400-e29b-41d4-a716-446655440000"}')"; printf '%s' "$OUT" | grep -q 'Status: 200 OK'; test "$(jq -r '.feeders[0].host' "$DATA/config.json")" = feed.hpradar.com; test -e "$RUN"
OUT="$(run_post pin '{"pin":"123456","new_pin":"654321"}')"; printf '%s' "$OUT" | grep -q 'pin-changed'; test "$(cat "$DATA/pin")" = 654321
node test/edge_admin_ui_runtime_smoke.js
printf '%s\n' 'edge admin CGI smoke PASS'
