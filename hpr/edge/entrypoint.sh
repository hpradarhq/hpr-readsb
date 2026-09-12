#!/bin/sh
set -eu

mkdir -p /run/readsb
rm -f /run/readsb/airwire.json

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

# Expose feeder metadata next to readsb JSON for Atlas Edge / diagnostics.
cat > /run/readsb/station.json <<EOF
{"name":"${FEEDER_NAME:-}","lat":${LAT:-null},"lon":${LON:-null},"alt_m":${FEEDER_ALT_M:-null},"alt_ft":${FEEDER_ALT_FT:-null},"multifeeder_uuid":"${MULTIFEEDER_UUID:-}","adsbx_uuid":"${ADSBX_UUID:-}","heywhatsthat_id":"${FEEDER_HEYWHATSTHAT_ID:-}","heywhatsthat_alts":"${FEEDER_HEYWHATSTHAT_ALTS:-}"}
EOF

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

STATUS=/run/readsb/backend-status.json
LOG=/run/readsb/backend.log
: > "$LOG"
printf '{"state":"starting","pid":null,"exit_code":null}\n' > "$STATUS"

printf '%s\n' "HPR Edge starting: station=${FEEDER_NAME:-hpr-edge} serial=${ADSB_SDR_SERIAL:-auto} Atlas=:80 BeastReduce=:30004 Beast=:30005"
printf '%s\n' "HPR Edge diagnostics remain available on :80 even if readsb fails."

# Keep nginx alive independently so startup/backend failures remain visible in the browser.
nginx -g 'daemon off;' &
NGINX_PID=$!

# Mirror readsb output to container logs while retaining it for browser diagnostics.
tail -n 0 -F "$LOG" >&2 &
TAIL_PID=$!

"$@" >>"$LOG" 2>&1 &
READSB_PID=$!
printf '{"state":"running","pid":%s,"exit_code":null}\n' "$READSB_PID" > "$STATUS"

shutdown() {
  trap - TERM INT
  kill "$READSB_PID" 2>/dev/null || true
  kill "$TAIL_PID" 2>/dev/null || true
  kill "$NGINX_PID" 2>/dev/null || true
  wait "$READSB_PID" 2>/dev/null || true
  wait "$TAIL_PID" 2>/dev/null || true
  wait "$NGINX_PID" 2>/dev/null || true
  exit 0
}
trap shutdown TERM INT

READSB_REPORTED=0
while kill -0 "$NGINX_PID" 2>/dev/null; do
  if [ "$READSB_REPORTED" -eq 0 ] && ! kill -0 "$READSB_PID" 2>/dev/null; then
    set +e
    wait "$READSB_PID"
    READSB_EXIT=$?
    set -e
    printf '{"state":"exited","pid":%s,"exit_code":%s}\n' "$READSB_PID" "$READSB_EXIT" > "$STATUS"
    printf '{"error":"readsb exited","exit_code":%s}\n' "$READSB_EXIT" > /run/readsb/airwire.json
    printf '%s\n' "HPR Edge: readsb exited with code $READSB_EXIT; AirWire invalidated; nginx diagnostics remain online." >&2
    READSB_REPORTED=1
  fi
  sleep 1
done

set +e
wait "$NGINX_PID"
NGINX_EXIT=$?
set -e
kill "$READSB_PID" 2>/dev/null || true
kill "$TAIL_PID" 2>/dev/null || true
wait "$READSB_PID" 2>/dev/null || true
wait "$TAIL_PID" 2>/dev/null || true
exit "$NGINX_EXIT"
