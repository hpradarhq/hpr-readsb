#!/bin/sh
set -eu
IDX=hpr/edge/ui/index.html
# P1 smooth live map
grep -q 'projectPosition' "$IDX"
grep -q 'hpr-live-trail' "$IDX"
grep -q 'liveFrame' "$IDX"
# P2 altitude ramp + hpr-globe shapes
grep -q 'ALT_COLORS' hpr/edge/ui/aircraft-renderer.js
test -s hpr/edge/ui/acicon.js
# P3 interaction
grep -q 'distBearing' "$IDX"
grep -q 'followBtn' "$IDX"
grep -q 'filterAlt' "$IDX"
# P4 history
grep -q 'Coverage' "$IDX"
grep -q 'geojson' hpr/edge/ui/edge-g9-trace.js
# readsb JSON API exposure (/api/readsb/ and /data/ mirrors, CORS)
grep -q 'location /api/readsb/' hpr/edge/nginx.conf
grep -q 'location /data/' hpr/edge/nginx.conf
grep -Fq 'receiver|stats|station|aircraft|status|airwire' hpr/edge/nginx.conf
grep -q '/api/readsb/stats.json' "$IDX"
# JSON files must be world-readable: the script umask stays 022 and secrets use
# their own subshell umask (no leak into readsb -> nginx 403).
grep -q '^umask 022' hpr/edge/entrypoint.sh
! grep -q '^umask 077' hpr/edge/entrypoint.sh
# P5 platform
test -s hpr/edge/ui/manifest.webmanifest
# Local real flags (offline-safe, inlined, no CDN)
test -s hpr/edge/ui/flag-icons.css
test -s hpr/edge/ui/assets/flags/4x3/vn.svg
grep -q 'flag-icons.css' "$IDX"
grep -q 'checkAlerts' "$IDX"
grep -q 'perfHud' "$IDX"
grep -q 'applyLang' "$IDX"
for f in test/edge_g22_live_map.spec.js test/edge_g23_interaction.spec.js test/edge_g24_history.spec.js test/edge_g25_platform.spec.js; do test -s "$f"; done
echo 'G22-G25 PASS: smooth map, visual, interaction, history and platform contracts present.'
