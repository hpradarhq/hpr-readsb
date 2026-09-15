#!/bin/sh
set -eu
WF=.github/workflows/edge-image.yml
grep -q 'Chromium interaction regression' "$WF"
grep -q 'Synthetic 400-aircraft websocket load' "$WF"
grep -q 'Build arm64 + armv7' "$WF"
grep -q 'value=edge-ux' "$WF"
grep -q 'edge-g20a-aircraft-lod.js' docker/edge.Dockerfile
grep -q '4.7.5-edge.rc1' docker/edge.Dockerfile
echo 'G21 source gate PASS: RC wired to full CI and edge-ux multi-arch publish.'
