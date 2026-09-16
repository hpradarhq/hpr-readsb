#!/bin/sh
set -eu
JS=hpr/edge/ui/edge-g20a-aircraft-lod.js
DOCKER=docker/edge.Dockerfile
test -s "$JS"
grep -q "aircraft-lod-dot" "$JS"
grep -q "aircraft-selected-symbol" "$JS"
grep -q "icon-allow-overlap':true" "$JS"
grep -q "circle-stroke-opacity':0" "$JS"
grep -q "text-allow-overlap':false" "$JS"
grep -q "edge-g20a-aircraft-lod.js" "$DOCKER"
echo 'G20A PASS: aircraft silhouettes + low-zoom LOD contract wired.'
