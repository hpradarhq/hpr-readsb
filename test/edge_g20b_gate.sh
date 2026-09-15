#!/bin/sh
set -eu
IDX=hpr/edge/ui/index.html
G14=hpr/edge/ui/edge-g14-display.js
G17=hpr/edge/ui/edge-g17-vn-labels.js
G9=hpr/edge/ui/edge-g9-trace.js
for f in "$IDX" "$G14" "$G17" "$G9"; do test -s "$f"; done
grep -q "boundary-country" "$IDX"
grep -q "place-city" "$IDX"
grep -q "aircraft-label" "$IDX"
grep -qi "actual" "$G14"
grep -q "HOÀNG SA\|HOANG SA" "$G17"
grep -q "TRƯỜNG SA\|TRUONG SA" "$G17"
echo 'G20B PASS: map/display contract present.'
