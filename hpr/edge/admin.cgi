#!/bin/sh
set -eu

DATA_DIR="${HPR_EDGE_DATA_DIR:-/data/hpr-edge}"
CONFIG="$DATA_DIR/config.json"
PIN_FILE="$DATA_DIR/pin"
RELOAD_FILE="${HPR_EDGE_RELOAD_FILE:-/run/hpr-edge/reload}"
mkdir -p "$DATA_DIR" "$(dirname "$RELOAD_FILE")"

status_json() {
  code="$1"; shift
  printf 'Status: %s\r\n' "$code"
  printf 'Content-Type: application/json\r\n'
  printf 'Cache-Control: no-store\r\n\r\n'
  printf '%s\n' "$1"
  exit 0
}

ok() { status_json '200 OK' "$1"; }
bad() { status_json '400 Bad Request' "$(jq -cn --arg e "$1" '{ok:false,error:$e}')"; }
forbidden() { status_json '403 Forbidden' '{"ok":false,"error":"invalid PIN"}'; }
method_not_allowed() { status_json '405 Method Not Allowed' '{"ok":false,"error":"method not allowed"}'; }

body='{}'
if [ "${REQUEST_METHOD:-GET}" = "POST" ]; then
  body="$(cat)"
  printf '%s' "$body" | jq -e . >/dev/null 2>&1 || bad 'invalid JSON'
fi

query_value() {
  key="$1"
  printf '%s' "${QUERY_STRING:-}" | tr '&' '\n' | sed -n "s/^${key}=//p" | head -n1
}

op="$(query_value op)"
[ -n "$op" ] || op='config'

need_post() { [ "${REQUEST_METHOD:-GET}" = "POST" ] || method_not_allowed; }
verify_pin() {
  pin="$(printf '%s' "$body" | jq -r '.pin // ""')"
  [ "$pin" = "$(cat "$PIN_FILE" 2>/dev/null || true)" ] || forbidden
}
write_atomic() {
  src="$1"
  chmod 600 "$src"
  mv "$src" "$CONFIG"
}
trigger_reload() { : > "$RELOAD_FILE"; }

case "$op" in
  config)
    [ "${REQUEST_METHOD:-GET}" = "GET" ] || method_not_allowed
    if [ ! -s "$CONFIG" ]; then bad 'configuration not initialized'; fi
    jq '. + {ok:true,pin_set:true,apply_mode:"readsb-child-restart"}' "$CONFIG" 2>/dev/null || bad 'configuration unreadable'
    ;;

  station)
    need_post; verify_pin
    printf '%s' "$body" | jq -e '
      (.name|type)=="string" and (.name|length)<=64 and
      (.lat==null or ((.lat|type)=="number" and .lat>=-90 and .lat<=90)) and
      (.lon==null or ((.lon|type)=="number" and .lon>=-180 and .lon<=180)) and
      (.height_m==null or ((.height_m|type)=="number" and .height_m>=-500 and .height_m<=10000)) and
      (.uuid|type)=="string"' >/dev/null 2>&1 || bad 'invalid station fields'
    uuid="$(printf '%s' "$body" | jq -r '.uuid')"
    if [ -n "$uuid" ]; then printf '%s' "$uuid" | grep -Eqi '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' || bad 'invalid UUID'; fi
    tmp="$(mktemp "$DATA_DIR/config.XXXXXX")"
    jq --argjson in "$(printf '%s' "$body" | jq '{name,lat,lon,height_m,uuid}')" '.station=$in' "$CONFIG" > "$tmp" || { rm -f "$tmp"; bad 'write failed'; }
    write_atomic "$tmp"; trigger_reload
    ok '{"ok":true,"applied":"readsb-child-restart"}'
    ;;

  display)
    need_post; verify_pin
    printf '%s' "$body" | jq -e '
      (.units=="nautical" or .units=="metric") and
      (.ring_enabled|type)=="boolean" and
      ((.ring_count|type)=="number" and .ring_count>=0 and .ring_count<=8 and (.ring_count|floor)==.ring_count) and
      ((.ring_step_nm|type)=="number" and .ring_step_nm>=5 and .ring_step_nm<=200) and
      (.ring_color|type)=="string" and
      (.actual_range|type)=="boolean"' >/dev/null 2>&1 || bad 'invalid display fields'
    color="$(printf '%s' "$body" | jq -r '.ring_color')"
    printf '%s' "$color" | grep -Eq '^#[0-9A-Fa-f]{6}$' || bad 'invalid ring color'
    tmp="$(mktemp "$DATA_DIR/config.XXXXXX")"
    jq --argjson in "$(printf '%s' "$body" | jq '{units,ring_enabled,ring_count,ring_step_nm,ring_color,actual_range}')" '.display=$in' "$CONFIG" > "$tmp" || { rm -f "$tmp"; bad 'write failed'; }
    write_atomic "$tmp"
    ok '{"ok":true,"applied":"live-ui"}'
    ;;

  feeder_upsert)
    need_post; verify_pin
    printf '%s' "$body" | jq -e '
      (.id|type)=="string" and (.id|length)>=1 and (.id|length)<=40 and
      (.name|type)=="string" and (.name|length)<=64 and
      (.host|type)=="string" and (.host|length)>=1 and (.host|length)<=253 and
      ((.port|type)=="number" and .port>=1 and .port<=65535 and (.port|floor)==.port) and
      (.protocol|type)=="string" and (.enabled|type)=="boolean" and (.uuid|type)=="string"' >/dev/null 2>&1 || bad 'invalid feeder fields'
    id="$(printf '%s' "$body" | jq -r '.id')"; host="$(printf '%s' "$body" | jq -r '.host')"; proto="$(printf '%s' "$body" | jq -r '.protocol')"; uuid="$(printf '%s' "$body" | jq -r '.uuid')"
    printf '%s' "$id" | grep -Eq '^[A-Za-z0-9_-]+$' || bad 'invalid feeder id'
    printf '%s' "$host" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9.-]*$' || bad 'invalid feeder host'
    case "$proto" in beast_reduce_plus_out|beast_reduce_out|beast_out|raw_out|sbs_out|json_out) ;; *) bad 'unsupported feeder protocol';; esac
    if [ -n "$uuid" ]; then printf '%s' "$uuid" | grep -Eqi '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' || bad 'invalid feeder UUID'; fi
    feeder="$(printf '%s' "$body" | jq '{id,name,host,port,protocol,enabled,uuid}')"
    tmp="$(mktemp "$DATA_DIR/config.XXXXXX")"
    jq --argjson f "$feeder" '.feeders=((.feeders // []) | map(select(.id != $f.id)) + [$f])' "$CONFIG" > "$tmp" || { rm -f "$tmp"; bad 'write failed'; }
    write_atomic "$tmp"; trigger_reload
    ok '{"ok":true,"applied":"readsb-child-restart"}'
    ;;

  feeder_delete)
    need_post; verify_pin
    id="$(printf '%s' "$body" | jq -r '.id // ""')"
    printf '%s' "$id" | grep -Eq '^[A-Za-z0-9_-]+$' || bad 'invalid feeder id'
    tmp="$(mktemp "$DATA_DIR/config.XXXXXX")"
    jq --arg id "$id" '.feeders=((.feeders // []) | map(select(.id != $id)))' "$CONFIG" > "$tmp" || { rm -f "$tmp"; bad 'write failed'; }
    write_atomic "$tmp"; trigger_reload
    ok '{"ok":true,"applied":"readsb-child-restart"}'
    ;;

  pin)
    need_post; verify_pin
    new_pin="$(printf '%s' "$body" | jq -r '.new_pin // ""')"
    printf '%s' "$new_pin" | grep -Eq '^[0-9]{6}$' || bad 'PIN must be exactly 6 digits'
    umask 077; printf '%s\n' "$new_pin" > "$PIN_FILE"; chmod 600 "$PIN_FILE"
    ok '{"ok":true,"applied":"pin-changed"}'
    ;;

  *) bad 'unknown operation' ;;
esac
