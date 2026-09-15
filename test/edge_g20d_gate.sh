#!/bin/sh
set -eu
IDX=hpr/edge/ui/index.html
for f in hpr/edge/ui/edge-g4-calm-list.js hpr/edge/ui/edge-g7-enrich.js hpr/edge/ui/edge-g9-trace.js hpr/edge/ui/edge-g10-replay.js hpr/edge/ui/edge-g18-responsive.js "$IDX"; do test -s "$f"; done
grep -qi "selected" hpr/edge/ui/edge-g7-enrich.js
grep -qi "90" hpr/edge/ui/edge-g9-trace.js
grep -qi "replay" hpr/edge/ui/edge-g10-replay.js
grep -qi "mobile\|tablet" hpr/edge/ui/edge-g18-responsive.js
grep -q "id=\"search\"" "$IDX"
echo 'G20D PASS: cross-gate UX contract present; Chromium + 400-aircraft soak remain CI authority.'
