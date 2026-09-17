#!/bin/sh
set -eu
WF=.github/workflows/edge-image.yml
grep -q 'Chromium interaction regression' "$WF"
grep -q 'Synthetic 400-aircraft websocket load' "$WF"
grep -q 'Build arm64 + armv7' "$WF"
grep -q 'value=edge-ux' "$WF"
grep -q 'edge-g20a-aircraft-lod.js' docker/edge.Dockerfile
grep -q '4.7.5-edge.rc10' docker/edge.Dockerfile
# Real MapLibre rejects an expression with two zoom-based interpolates, which
# silently dropped aircraft-symbol. Guard the single-interpolate form.
test -s test/edge_g21_real_map.spec.js
! grep -Fq "const selected=['interpolate'" hpr/edge/ui/edge-g3-map.js
grep -Fq "['case',sel" hpr/edge/ui/edge-g3-map.js
grep -q 'maplibre-gl@5.24.0' .github/workflows/edge-image.yml
# Tag builds must publish a clean image tag and never move latest/edge.
grep -Fq 'latest=false' "$WF"
grep -Fq 'type=match,pattern=^edge-v(.+)$,group=1' "$WF"
echo 'G21 source gate PASS: RC wired to full CI and edge-ux multi-arch publish.'
