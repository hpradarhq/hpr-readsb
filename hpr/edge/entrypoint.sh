#!/bin/sh
set -eu

mkdir -p /run/readsb

# nginx only serves Atlas Edge UI and readsb-generated JSON.
nginx

set -- /usr/local/bin/readsb \
  --device-type rtlsdr \
  --gain="${READSB_GAIN:-auto}" \
  --net \
  --quiet \
  --write-json=/run/readsb \
  --write-json-every="${READSB_JSON_INTERVAL:-1}" \
  --db-file=/usr/local/share/hpr-readsb/aircraft.csv.gz \
  --net-ro-port=30002 \
  --net-sbs-port=30003 \
  --net-beast-reduce-out-port=30004 \
  --net-bo-port=30005

if [ -n "${RECEIVER_LAT:-}" ]; then
  set -- "$@" "--lat=${RECEIVER_LAT}"
fi
if [ -n "${RECEIVER_LON:-}" ]; then
  set -- "$@" "--lon=${RECEIVER_LON}"
fi
if [ -n "${READSB_MAX_RANGE_NM:-}" ]; then
  set -- "$@" "--max-range=${READSB_MAX_RANGE_NM}"
fi
if [ -n "${HPR_FEEDER_UUID:-}" ]; then
  set -- "$@" "--uuid=${HPR_FEEDER_UUID}"
fi
if [ -n "${HPR_UPSTREAM_HOST:-}" ]; then
  set -- "$@" "--net-connector=${HPR_UPSTREAM_HOST},${HPR_UPSTREAM_PORT:-30004},beast_reduce_plus_out"
fi

printf '%s\n' "HPR Edge starting: Atlas UI :80, BeastReduce :30004, Beast :30005"
exec "$@"
