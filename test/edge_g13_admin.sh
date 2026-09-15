#!/bin/sh
set -eu

# Static contract: persistent receiver config + local admin + child-only reload.
sh -n hpr/edge/entrypoint.sh
sh -n hpr/edge/admin.cgi
grep -Fq '/data/hpr-edge' docker/edge.Dockerfile
grep -Fq 'jq' docker/edge.Dockerfile
grep -Fq 'busybox' docker/edge.Dockerfile
grep -Fq 'location = /api/admin' hpr/edge/nginx.conf
grep -Fq 'readsb child restart only' hpr/edge/entrypoint.sh
grep -Fq 'hpr-edge-data:/data/hpr-edge' deploy/compose.yml
grep -Fq 'hpr-edge-data:/data/hpr-edge' deploy/compose.pi.yml
grep -Fq 'edge-g13-receiver.js' hpr/edge/ui/hpr-config.js
! grep -q 'MutationObserver\|setInterval' hpr/edge/ui/edge-g13-receiver.js

# Functional CGI contract.
D="$(mktemp -d)"; trap 'rm -rf "$D"' EXIT
mkdir -p "$D/data" "$D/run"
printf '%s\n' '{"station":{"name":"Old","lat":20,"lon":106,"height_m":5,"uuid":"123e4567-e89b-42d3-a456-426614174000"}}' > "$D/data/config.json"
printf '%s\n' '123456' > "$D/data/pin"
GET="$(env REQUEST_METHOD=GET QUERY_STRING=op=config HPR_EDGE_DATA_DIR="$D/data" HPR_EDGE_RELOAD_FILE="$D/run/reload" sh hpr/edge/admin.cgi)"
printf '%s' "$GET" | grep -Fq '200 OK'
printf '%s' "$GET" | grep -Fq 'readsb-child-restart'
BODY='{"pin":"123456","name":"New","lat":20.844,"lon":106.688,"height_m":18,"uuid":"123e4567-e89b-42d3-a456-426614174000"}'
POST="$(printf '%s' "$BODY" | env REQUEST_METHOD=POST QUERY_STRING=op=station HPR_EDGE_DATA_DIR="$D/data" HPR_EDGE_RELOAD_FILE="$D/run/reload" sh hpr/edge/admin.cgi)"
printf '%s' "$POST" | grep -Fq '200 OK'
test -e "$D/run/reload"
test "$(jq -r '.station.name' "$D/data/config.json")" = New
test "$(jq -r '.station.height_m' "$D/data/config.json")" = 18
BAD='{"pin":"000000","name":"Bad","lat":20,"lon":106,"height_m":5,"uuid":"123e4567-e89b-42d3-a456-426614174000"}'
DENY="$(printf '%s' "$BAD" | env REQUEST_METHOD=POST QUERY_STRING=op=station HPR_EDGE_DATA_DIR="$D/data" HPR_EDGE_RELOAD_FILE="$D/run/reload" sh hpr/edge/admin.cgi)"
printf '%s' "$DENY" | grep -Fq '403 Forbidden'
test "$(jq -r '.station.name' "$D/data/config.json")" = New
printf '%s\n' 'edge_g13_admin: PASS'
