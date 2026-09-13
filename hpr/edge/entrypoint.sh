#!/bin/sh
set -eu

mkdir -p /run/readsb

# Existing HPR feeder env vocabulary is canonical on edge nodes.
TZ_VALUE="${FEEDER_TZ:-${EEDER_TZ:-Asia/Ho_Chi_Minh}}"
export TZ="$TZ_VALUE"
if [ -e "/usr/share/zoneinfo/$TZ_VALUE" ]; then
  ln -snf "/usr/share/zoneinfo/$TZ_VALUE" /etc/localtime
  printf '%s\n' "$TZ_VALUE" > /etc/timezone
fi

LAT="${FEEDER_LAT:-${RECEIVER_LAT:-}}"
LON="${FEEDER_LONG:-${RECEIVER_LON:-}}"
UUID="${MULTIFEEDER_UUID:-${HPR_FEEDER_UUID:-}}"

cat > /run/readsb/station.json <<EOF
{"name":"${FEEDER_NAME:-}","lat":${LAT:-null},"lon":${LON:-null},"alt_m":${FEEDER_ALT_M:-null},"alt_ft":${FEEDER_ALT_FT:-null},"multifeeder_uuid":"${MULTIFEEDER_UUID:-}","adsbx_uuid":"${ADSBX_UUID:-}","heywhatsthat_id":"${FEEDER_HEYWHATSTHAT_ID:-}","heywhatsthat_alts":"${FEEDER_HEYWHATSTHAT_ALTS:-}"}
EOF

nginx

set -- /usr/local/bin/readsb \
  --device-type rtlsdr \
  --gain="${READSB_GAIN:-auto}" \
  --net \
  --quiet \
  --write-json=/run/readsb \
  --write-json-every="${READSB_JSON_INTERVAL:-1}" \
  --write-json-globe-index \
  --json-trace-interval="${READSB_TRACE_INTERVAL:-1}" \
  --db-file=/usr/local/share/hpr-readsb/aircraft.csv.gz \
  --net-ro-port=30002 \
  --net-sbs-port=30003 \
  --net-beast-reduce-out-port=30004 \
  --net-bo-port=30005

if [ -n "${ADSB_SDR_SERIAL:-}" ]; then
  set -- "$@" "--device=${ADSB_SDR_SERIAL}"
fi
if [ -n "${ADSB_SDR_PPM:-}" ] && [ "${ADSB_SDR_PPM}" != "xxx" ] && [ "${ADSB_SDR_PPM}" != "XXX" ]; then
  set -- "$@" "--ppm=${ADSB_SDR_PPM}"
fi
if [ -n "$LAT" ]; then
  set -- "$@" "--lat=${LAT}"
fi
if [ -n "$LON" ]; then
  set -- "$@" "--lon=${LON}"
fi
if [ -n "${READSB_MAX_RANGE_NM:-}" ]; then
  set -- "$@" "--max-range=${READSB_MAX_RANGE_NM}"
fi
if [ -n "$UUID" ]; then
  set -- "$@" "--uuid=${UUID}"
fi
if [ -n "${HPR_UPSTREAM_HOST:-}" ]; then
  set -- "$@" "--net-connector=${HPR_UPSTREAM_HOST},${HPR_UPSTREAM_PORT:-30004},beast_reduce_plus_out"
fi

printf '%s\n' "HPR Edge starting: station=${FEEDER_NAME:-hpr-edge} serial=${ADSB_SDR_SERIAL:-auto} Atlas=:80 AirWire=:${HPR_AIRWIRE_WS_PORT:-30154} BeastReduce=:30004 Beast=:30005"
exec "$@"
