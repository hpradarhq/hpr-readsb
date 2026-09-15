#!/bin/sh
set -eu
D="${HPR_EDGE_DATA_DIR:-/data/hpr-edge}"; C="$D/config.json"; P="$D/pin"; R="${HPR_EDGE_RELOAD_FILE:-/run/hpr-edge/reload}"
reply(){ printf 'Status: %s\r\nContent-Type: application/json\r\nCache-Control: no-store\r\n\r\n%s\n' "$1" "$2"; exit 0; }
bad(){ reply '400 Bad Request' "$(jq -cn --arg e "$1" '{ok:false,error:$e}')"; }
forbid(){ reply '403 Forbidden' '{"ok":false,"error":"invalid PIN"}'; }
post_body(){ [ "${REQUEST_METHOD:-GET}" = POST ] || reply '405 Method Not Allowed' '{"ok":false,"error":"method not allowed"}'; B="$(cat)"; printf '%s' "$B" | jq -e . >/dev/null 2>&1 || bad 'invalid JSON'; [ "$(printf '%s' "$B" | jq -r '.pin // ""')" = "$(cat "$P" 2>/dev/null || true)" ] || forbid; }
save_json(){ T="$(mktemp "$D/config.XXXXXX")"; cat > "$T"; chmod 600 "$T"; mv "$T" "$C"; }
valid_uuid(){ [ -z "$1" ] || printf '%s' "$1" | grep -Eqi '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'; }
OP="$(printf '%s' "${QUERY_STRING:-}" | tr '&' '\n' | sed -n 's/^op=//p' | head -n1)"; [ -n "$OP" ] || OP=config
case "$OP" in
config)
  [ "${REQUEST_METHOD:-GET}" = GET ] || reply '405 Method Not Allowed' '{"ok":false,"error":"method not allowed"}'
  [ -s "$C" ] || bad 'configuration not initialized'
  reply '200 OK' "$(jq -c '. + {ok:true,pin_set:true,apply_mode:"readsb-child-restart"}' "$C")";;
station)
  post_body
  printf '%s' "$B" | jq -e '(.name|type)=="string" and (.name|length)>=1 and (.name|length)<=64 and (.lat==null or ((.lat|type)=="number" and .lat>=-90 and .lat<=90)) and (.lon==null or ((.lon|type)=="number" and .lon>=-180 and .lon<=180)) and (.height_m==null or ((.height_m|type)=="number" and .height_m>=-500 and .height_m<=10000)) and (.uuid|type)=="string"' >/dev/null 2>&1 || bad 'invalid station fields'
  U="$(printf '%s' "$B" | jq -r '.uuid')"; valid_uuid "$U" || bad 'invalid UUID'
  mkdir -p "$D" "$(dirname "$R")"; jq --argjson v "$(printf '%s' "$B" | jq '{name,lat,lon,height_m,uuid}')" '.station=$v' "$C" | save_json
  : > "$R"; reply '200 OK' '{"ok":true,"applied":"readsb-child-restart"}';;
display)
  post_body
  printf '%s' "$B" | jq -e '(.units=="nautical" or .units=="metric") and (.ring_enabled|type)=="boolean" and ((.ring_count|type)=="number" and .ring_count>=0 and .ring_count<=8 and (.ring_count|floor)==.ring_count) and ((.ring_step_nm|type)=="number" and .ring_step_nm>=5 and .ring_step_nm<=200) and (.ring_color|type)=="string" and (.actual_range|type)=="boolean"' >/dev/null 2>&1 || bad 'invalid display fields'
  COLOR="$(printf '%s' "$B" | jq -r '.ring_color')"; printf '%s' "$COLOR" | grep -Eq '^#[0-9A-Fa-f]{6}$' || bad 'invalid ring color'
  jq --argjson v "$(printf '%s' "$B" | jq '{units,ring_enabled,ring_count,ring_step_nm,ring_color,actual_range}')" '.display=$v' "$C" | save_json
  reply '200 OK' '{"ok":true,"applied":"live-ui"}';;
feeder_upsert)
  post_body
  printf '%s' "$B" | jq -e '(.id|type)=="string" and (.id|length)>=1 and (.id|length)<=40 and (.name|type)=="string" and (.name|length)>=1 and (.name|length)<=64 and (.host|type)=="string" and (.host|length)>=1 and (.host|length)<=253 and ((.port|type)=="number" and .port>=1 and .port<=65535 and (.port|floor)==.port) and (.protocol|type)=="string" and (.enabled|type)=="boolean" and (.uuid|type)=="string"' >/dev/null 2>&1 || bad 'invalid feeder fields'
  I="$(printf '%s' "$B" | jq -r '.id')"; H="$(printf '%s' "$B" | jq -r '.host')"; Q="$(printf '%s' "$B" | jq -r '.protocol')"; U="$(printf '%s' "$B" | jq -r '.uuid')"
  printf '%s' "$I" | grep -Eq '^[A-Za-z0-9_-]+$' || bad 'invalid feeder id'; printf '%s' "$H" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9.-]*$' || bad 'invalid feeder host'
  case "$Q" in beast_reduce_plus_out|beast_reduce_out|beast_out|raw_out|sbs_out|json_out) ;; *) bad 'unsupported feeder protocol';; esac
  valid_uuid "$U" || bad 'invalid feeder UUID'
  F="$(printf '%s' "$B" | jq '{id,name,host,port,protocol,enabled,uuid}')"; jq --argjson f "$F" '.feeders=((.feeders//[])|map(select(.id!=$f.id))+[$f])' "$C" | save_json
  : > "$R"; reply '200 OK' '{"ok":true,"applied":"readsb-child-restart"}';;
feeder_delete)
  post_body; I="$(printf '%s' "$B" | jq -r '.id // ""')"; printf '%s' "$I" | grep -Eq '^[A-Za-z0-9_-]+$' || bad 'invalid feeder id'
  jq --arg id "$I" '.feeders=((.feeders//[])|map(select(.id!=$id)))' "$C" | save_json
  : > "$R"; reply '200 OK' '{"ok":true,"applied":"readsb-child-restart"}';;
pin)
  post_body; NEW="$(printf '%s' "$B" | jq -r '.new_pin // ""')"; printf '%s' "$NEW" | grep -Eq '^[0-9]{6}$' || bad 'PIN must be exactly 6 digits'
  umask 077; T="$(mktemp "$D/pin.XXXXXX")"; printf '%s\n' "$NEW" > "$T"; chmod 600 "$T"; mv "$T" "$P"
  reply '200 OK' '{"ok":true,"applied":"pin-changed"}';;
*) bad 'unknown operation';;
esac
