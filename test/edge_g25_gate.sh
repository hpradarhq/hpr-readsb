#!/bin/sh
set -eu
IDX=hpr/edge/ui/index.html
# P1 smooth live map
grep -q 'projectPosition' "$IDX"
grep -q 'hpr-live-trail' "$IDX"
grep -q 'liveFrame' "$IDX"
# P2 altitude ramp + trend
grep -q 'ALT_COLORS' hpr/edge/ui/aircraft-renderer.js
grep -q 'aircraft-trend' "$IDX"
# P3 interaction
grep -q 'distBearing' "$IDX"
grep -q 'followBtn' "$IDX"
grep -q 'filterAlt' "$IDX"
# P4 history
grep -q 'Coverage' "$IDX"
grep -q 'geojson' hpr/edge/ui/edge-g9-trace.js
# P5 platform
test -s hpr/edge/ui/manifest.webmanifest
test -s hpr/edge/ui/sw.js
grep -q 'checkAlerts' "$IDX"
grep -q 'perfHud' "$IDX"
grep -q 'applyLang' "$IDX"
for f in test/edge_g22_live_map.spec.js test/edge_g23_interaction.spec.js test/edge_g24_history.spec.js test/edge_g25_platform.spec.js; do test -s "$f"; done
echo 'G22-G25 PASS: smooth map, visual, interaction, history and platform contracts present.'
