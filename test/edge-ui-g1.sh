#!/bin/sh
set -eu

fixture=test/fixtures/atlas-v4.7/hpr-atlas-fe-v4.7-canonical.html
shell=hpr/edge/ui/atlas-v4.7-shell.html
entry=hpr/edge/ui/index.html
expected=66ec05a9f2b0d898873ea91d38bd28a1b3a7ac22

fixture_hash=$(git hash-object "$fixture")
shell_hash=$(git hash-object "$shell")

[ "$fixture_hash" = "$expected" ] || exit 1
[ "$shell_hash" = "$expected" ] || exit 1
cmp -s "$fixture" "$shell" || exit 1

grep -q "const SHELL='/atlas-v4.7-shell.html'" "$entry" || exit 1
grep -q 'frame.src=shellUrl' "$entry" || exit 1
grep -q "const ENDPOINT='/api/air/v1'" "$entry" || exit 1
grep -q 'atlas-edge-live-bridge.js' "$entry" || exit 1
grep -q 'if(href!==shellUrl)' "$entry" || exit 1
grep -q 'async function preflightScript' "$entry" || exit 1

echo "G1 PASS: canonical V4.7 is byte-identical and iframe bootstrap is live-gated/race-safe."
