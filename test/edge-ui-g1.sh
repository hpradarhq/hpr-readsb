#!/bin/sh
set -eu

fixture=test/fixtures/atlas-v4.7/hpr-atlas-fe-v4.7-canonical.html
expected=66ec05a9f2b0d898873ea91d38bd28a1b3a7ac22
actual=$(git hash-object "$fixture")

[ "$actual" = "$expected" ] || {
  echo "G1 FAIL: V4.7 fixture hash mismatch: $actual" >&2
  exit 1
}

[ ! -e hpr/edge/ui/fixtures/hpr-atlas-fe-v4.7-canonical.html ] || {
  echo "G1 FAIL: mock fixture is inside the production UI copy path" >&2
  exit 1
}

echo "G1 PASS: canonical Atlas V4.7 fixture is byte-identical and outside production image."
