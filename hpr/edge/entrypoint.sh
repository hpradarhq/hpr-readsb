#!/bin/sh
set -eu

DATA_DIR="${HPR_EDGE_DATA_DIR:-/data/hpr-edge}"
CONFIG="$DATA_DIR/config.json"
PIN_FILE="$DATA_DIR/pin"
RUN_DIR=/run/hpr-edge
RELOAD_FILE="$RUN_DIR/reload"
mkdir -p /run/readsb "$DATA_DIR" "$RUN_DIR"

TZ_VALUE="${FEEDER_TZ:-${EEDER_TZ:-Asia/Ho_Chi_Minh}}"
export TZ="$TZ_VALUE"
if [ -e "/usr/share/zoneinfo/$TZ_VALUE" ]; then
  ln -snf "/usr/share/zoneinfo/$TZ_VALUE" /etc/localtime
  printf '%s\n' "$TZ_VALUE" > /etc/timezone
fi

# First boot imports legacy env once. After that /data/hpr-edge/config.json is canonical.
if [ ! -s "$CONFIG" ]; then
  umask 077
  jq -n \
    --arg name "${FEEDER_NAME:-hpr-edge}" \
    --arg lat "${FEEDER_LAT:-${RECEIVER_LAT:-}}" \
    --arg lon "${FEEDER_LONG:-${RECEIVER_LON:-}}" \
    --arg altm "${FEEDER_ALT_M:-}" \
    --arg altft "${FEEDER_ALT_FT:-}" \
    --arg uuid "${MULTIFEEDER_UUID:-${HPR_FEEDER_UUID:-}}" \
    --arg upstream "${HPR_UPSTREAM_HOST:-}" \
    --arg upstream_port "${HPR_UPSTREAM_PORT:-30004}" '
    {
      station:{
        name:$name,
        lat:(if $lat=="" then null else ($lat|tonumber) end),
        lon:(if $lon=="" then null else ($lon|tonumber) end),
        height_m:(if $altm!="" then ($altm|tonumber) elif $altft!="" then (($altft|tonumber)*0.3048) else null end),
        uuid:$uuid
      },
      display:{units:"nautical",ring_enabled:true,ring_count:4,ring_step_nm:50,ring_color:"#59ddff",actual_range:true},
      feeders:(if $upstream=="" then [] else [{id:"hpr",name:"HPRadar",host:$upstream,port:($upstream_port|tonumber),protocol:"beast_reduce_plus_out",enabled:true,uuid:$uuid}] end)
    }' > "$CONFIG"
  chmod 600 "$CONFIG"
fi

if [ ! -s "$PIN_FILE" ]; then
  n="$(od -An -N4 -tu4 /dev/urandom | tr -d ' ')"
  pin="$(printf '%06d' $((n % 1000000)))"
  umask 077; printf '%s\n' "$pin" > "$PIN_FILE"; chmod 600 "$PIN_FILE"
  printf '%s\n' "HPR Edge first-run ADMIN PIN: $pin"
fi

write_station_json() {
  jq '{
    name:.station.name,
    lat:.station.lat,
    lon:.station.lon,
    alt_m:.station.height_m,
    alt_ft:(if .station.height_m==null then null else (.station.height_m/0.3048) end),
    multifeeder_uuid:.station.uuid,
    adsbx_uuid:"",
    heywhatsthat_id:"",
    heywhatsthat_alts:""
  }' "$CONFIG" > /run/readsb/station.json
}

READSB_PID=''
start_readsb() {
  write_station_json
  LAT="$(jq -r '.station.lat // empty' "$CONFIG")"
  LON="$(jq -r '.station.lon // empty' "$CONFIG")"
  UUID="$(jq -r '.station.uuid // empty' "$CONFIG")"

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
    --db-file-lt \
    --net-ro-port=30002 \
    --net-sbs-port=30003 \
    --net-beast-reduce-out-port=30004 \
    --net-bo-port=30005

  if [ -n "${ADSB_SDR_SERIAL:-}" ]; then set -- "$@" "--device=${ADSB_SDR_SERIAL}"; fi
  if [ -n "${ADSB_SDR_PPM:-}" ] && [ "${ADSB_SDR_PPM}" != "xxx" ] && [ "${ADSB_SDR_PPM}" != "XXX" ]; then set -- "$@" "--ppm=${ADSB_SDR_PPM}"; fi
  if [ -n "$LAT" ]; then set -- "$@" "--lat=${LAT}"; fi
  if [ -n "$LON" ]; then set -- "$@" "--lon=${LON}"; fi
  if [ -n "${READSB_MAX_RANGE_NM:-}" ]; then set -- "$@" "--max-range=${READSB_MAX_RANGE_NM}"; fi
  if [ -n "$UUID" ]; then
    umask 077; printf '%s' "$UUID" > "$RUN_DIR/uuid"; chmod 600 "$RUN_DIR/uuid"
    set -- "$@" "--uuid-file=$RUN_DIR/uuid"
  fi

  for encoded in $(jq -r '.feeders[]? | select(.enabled==true) | @base64' "$CONFIG"); do
    row="$(printf '%s' "$encoded" | base64 -d)"
    host="$(printf '%s' "$row" | jq -r '.host')"
    port="$(printf '%s' "$row" | jq -r '.port')"
    proto="$(printf '%s' "$row" | jq -r '.protocol')"
    fuuid="$(printf '%s' "$row" | jq -r '.uuid // empty')"
    connector="$host,$port,$proto"
    if [ -n "$fuuid" ]; then connector="$connector,uuid=$fuuid"; fi
    set -- "$@" "--net-connector=$connector"
  done

  printf '%s\n' "HPR Edge readsb start: station=$(jq -r '.station.name' "$CONFIG") feeders=$(jq '[.feeders[]? | select(.enabled==true)]|length' "$CONFIG") Atlas=:80 AirWire=:${HPR_AIRWIRE_WS_PORT:-30154}"
  "$@" &
  READSB_PID=$!
}

stop_all() {
  [ -n "$READSB_PID" ] && kill "$READSB_PID" 2>/dev/null || true
  [ -n "${ADMIN_PID:-}" ] && kill "$ADMIN_PID" 2>/dev/null || true
  nginx -s quit 2>/dev/null || true
  wait 2>/dev/null || true
  exit 0
}
trap stop_all INT TERM

nginx
busybox httpd -f -p 127.0.0.1:8082 -h /usr/local/lib/hpr-edge/www &
ADMIN_PID=$!
start_readsb

while :; do
  if [ -e "$RELOAD_FILE" ]; then
    rm -f "$RELOAD_FILE"
    printf '%s\n' 'HPR Edge applying persistent station/feeder configuration (readsb child restart only)'
    kill "$READSB_PID" 2>/dev/null || true
    wait "$READSB_PID" 2>/dev/null || true
    sleep 1
    start_readsb
  elif ! kill -0 "$READSB_PID" 2>/dev/null; then
    wait "$READSB_PID" 2>/dev/null || true
    printf '%s\n' 'HPR Edge readsb exited; restarting child process'
    sleep 1
    start_readsb
  fi
  sleep 1
done
