#!/bin/sh
# E7 Pi resource sampler. Runs OUTSIDE the tested containers.
# Usage:
#   ./tools/e7-pi-sample.sh hpr-edge edge-pi.csv
#   ./tools/e7-pi-sample.sh tar1090 tar-pi.csv
# Start it immediately before performing the 8 browser tasks; Ctrl-C after export.
set -eu

CONTAINER="${1:-hpr-edge}"
OUT="${2:-e7-pi.csv}"
INTERVAL="${E7_INTERVAL:-1}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found" >&2
  exit 2
fi
if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "container not found: $CONTAINER" >&2
  exit 2
fi

printf '%s\n' 'unix_ts,cpu_percent,mem_usage,mem_percent,net_io,block_io,pids' > "$OUT"
echo "E7 sampling $CONTAINER -> $OUT every ${INTERVAL}s (Ctrl-C to stop)"

while :; do
  ts=$(date +%s)
  row=$(docker stats --no-stream --format '{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}},{{.PIDs}}' "$CONTAINER" | head -n1)
  printf '%s,%s\n' "$ts" "$row" >> "$OUT"
  sleep "$INTERVAL"
done
