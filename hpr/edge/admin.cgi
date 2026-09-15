#!/bin/sh
set -eu
D="${HPR_EDGE_DATA_DIR:-/data/hpr-edge}"; C="$D/config.json"; P="$D/pin"; R="${HPR_EDGE_RELOAD_FILE:-/run/hpr-edge/reload}"
reply(){ printf 'Status: %s\r\nContent-Type: application/json\r\nCache-Control: no-store\r\n\r\n%s\n' "$1" "$2"; exit 0; }
bad(){ reply '400 Bad Request' "$(jq -cn --arg e "$1" '{ok:false,error:$e}')"; }
forbid(){ reply '403 Forbidden' '{"ok":false,"error":"invalid PIN"}'; }
post_body(){ [ "${REQUEST_METHOD:-GET}" = POST ] || reply '405 Method Not Allowed' '{"ok":false,"error":"method not allowed"}'; B="$(cat)"; printf '%s' "$B" | jq -e . >/dev/null 2>&1 || bad 'invalid JSON'; [ "$(printf '%s' "$B" | jq -r '.pin // ""')" = "$(cat "$P" 2>/dev/null || true)" ] || forbid; }
save_json(){ T="$(mktemp "$D/config.XXXXXX")"; cat > "$T"; chmod 600 "$T"; mv "$T" "$C"; }
OP="$(printf '%s' "${QUERY_STRING:-}" | tr '&' '\n' | sed -n 's/^op=//p' | head -n1)"; [ -n "$OP" ] || OP=config
case "$OP" in
config)
  [ "${REQUEST_METHOD:-GET}" = GET ] || reply '405 Method Not Allowed' '{"ok":false,"error":"method not allowed"}'
  [ -s "$C" ] || bad 'configuration not initialized'
  reply '200 OK' "$(jq -c '. + {ok:true,pin_set:true,apply_mode:"readsb-child-restart"}' "$C")";;
station)
  post_body
  printf '%s' "$B" | jq -e '(.name|type)=="string" and (.name|length)>=1 and (.name|length)<=64 and (.lat==null or ((.lat|type)=="number" and .lat>=-90 and .lat<=90)) and (.lon==null or ((.lon|type)=="number" and .lon>=-180 and .lon<=180)) and (.height_m==null or ((.height_m|type)=="number" and .height_m>=-500 and .height_m<=10000)) and (.uuid|type)=="string"' >/dev/null 2>&1 || bad 'invalid station fields'
  U="$(printf '%s' "$B" | jq -r '.uuid')"; if [ -n "$U" ]; then printf '%s' "$U" | grep -Eqi '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' || bad 'invalid UUID'; fi
  mkdir -p "$D" "$(dirname "$R")"
  jq --argjson v "$(printf '%s' "$B" | jq '{name,lat,lon,height_m,uuid}')" '.station=$v' "$C" | save_json
  : > "$R"; reply '200 OK' '{"ok":true,"applied":"readsb-child-restart"}';;
display)
  post_body
  printf '%s' "$B" | jq -e '(.units=="nautical" or .units=="metric") and (.ring_enabled|type)=="boolean" and ((.ring_count|type)=="number" and .ring_count>=0 and .ring_count<=8 and (.ring_count|floor)==.ring_count) and ((.ring_step_nm|type)=="number" and .ring_step_nm>=5 and .ring_step_nm<=200) and (.ring_color|type)=="string" and (.actual_range|type)=="boolean"' >/dev/null 2>&1 || bad 'invalid display fields'
  COLOR="$(printf '%s' "$B" | jq -r '.ring_color')"; printf '%s' "$COLOR" | grep -Eq '^#[0-9A-Fa-f]{6}$' || bad 'invalid ring color'
  jq --argjson v "$(printf '%s' "$B" | jq '{units,ring_enabled,ring_count,ring_step_nm,ring_color,actual_range}')" '.display=$v' "$C" | save_json
  reply '200 OK' '{"ok":true,"applied":"live-ui"}';;
*) bad 'unknown operation';;
esac
