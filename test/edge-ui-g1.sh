#!/bin/sh
set -eu

fixture=test/fixtures/atlas-v4.7/hpr-atlas-fe-v4.7-canonical.html
shell=hpr/edge/ui/atlas-v4.7-shell.html
entry=hpr/edge/ui/index.html
expected=66ec05a9f2b0d898873ea91d38bd28a1b3a7ac22

fixture_hash=$(git hash-object "$fixture")
shell_hash=$(git hash-object "$shell")

[ "$fixture_hash" = "$expected" ] || {
  echo "G1 FAIL: V4.7 fixture hash mismatch: $fixture_hash" >&2
  exit 1
}

[ "$shell_hash" = "$expected" ] || {
  echo "G1 FAIL: production V4.7 shell is not canonical: $shell_hash" >&2
  exit 1
}

cmp -s "$fixture" "$shell" || {
  echo "G1 FAIL: production shell differs byte-for-byte from canonical fixture" >&2
  exit 1
}

grep -q "frame.src='atlas-v4.7-shell.html'" "$entry" || {
  echo "G1 FAIL: backend-gated entry does not load the canonical shell" >&2
  exit 1
}

grep -q "const ENDPOINT='/api/air/v1'" "$entry" || {
  echo "G1 FAIL: production entry is not gated by live AirWire" >&2
  exit 1
}

grep -q "atlas-edge-live-bridge.js" "$entry" || {
  echo "G1 FAIL: live bridge is not injected into canonical shell" >&2
  exit 1
}

echo "G1 PASS: canonical V4.7 is byte-identical and only boots after live AirWire is available."
