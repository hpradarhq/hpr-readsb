#!/bin/sh
set -eu

# G1 local rows
test -s hpr/edge/ui/edge-g1-list.css
grep -Fq 'edge-g1-list.css' hpr/edge/ui/hpr-config.js
grep -Fq '#airList .row>.plane-icon{display:none}' hpr/edge/ui/edge-g1-list.css
grep -Fq '#airList .row{grid-template-columns:8px 1fr auto}' hpr/edge/ui/edge-g1-list.css

# G3 selected aircraft map policy
test -s hpr/edge/ui/edge-g3-map.js
grep -Fq 'edge-g3-map.js' hpr/edge/ui/hpr-config.js
grep -Fq "layer?.id==='aircraft-halo'" hpr/edge/ui/edge-g3-map.js
grep -Fq "layer?.id==='aircraft-symbol'" hpr/edge/ui/edge-g3-map.js

# G4 calm local list
test -s hpr/edge/ui/edge-g4-calm-list.js
grep -Fq 'edge-g4-calm-list.js' hpr/edge/ui/hpr-config.js
grep -Fq 'const WINDOW_MS=2500' hpr/edge/ui/edge-g4-calm-list.js
grep -Fq 'const lastWrites=new WeakMap()' hpr/edge/ui/edge-g4-calm-list.js
grep -Fq 'const forceUntils=new WeakMap()' hpr/edge/ui/edge-g4-calm-list.js
grep -Fq "this.id!=='airList'" hpr/edge/ui/edge-g4-calm-list.js

# G5 local synchronous identity
test -s hpr/edge/ui/edge-g5-detail.js
grep -Fq 'edge-g5-detail.js' hpr/edge/ui/hpr-config.js
grep -Fq "0x888000,0x88ffff,'Viet Nam','vn'" hpr/edge/ui/edge-g5-detail.js
! grep -q 'MutationObserver\|setInterval' hpr/edge/ui/edge-g5-detail.js

# G6 deterministic hierarchy
test -s hpr/edge/ui/edge-g6-detail-layout.js
grep -Fq 'edge-g6-detail-layout.js' hpr/edge/ui/hpr-config.js
grep -Fq 'data-hpr-route-from' hpr/edge/ui/edge-g6-detail-layout.js
grep -Fq 'data-hpr-operator' hpr/edge/ui/edge-g6-detail-layout.js
grep -Fq 'data-hpr-photo-slot' hpr/edge/ui/edge-g6-detail-layout.js
grep -Fq '&mdash;' hpr/edge/ui/edge-g6-detail-layout.js
grep -Fq '&rarr;' hpr/edge/ui/edge-g6-detail-layout.js
! grep -q 'MutationObserver\|setInterval\|fetch(' hpr/edge/ui/edge-g6-detail-layout.js

# G7 selected-only enrichment
test -s hpr/edge/ui/edge-g7-enrich.js
grep -Fq 'edge-g7-enrich.js' hpr/edge/ui/hpr-config.js
grep -Fq "trafficApi: '/api/traffic'" hpr/edge/ui/hpr-config.js
grep -Fq "photoApi: '/api/photo/hex'" hpr/edge/ui/hpr-config.js
grep -Fq 'const cache=new Map(),inflight=new Map()' hpr/edge/ui/edge-g7-enrich.js
grep -Fq 'data-hpr-photo-slot' hpr/edge/ui/edge-g7-enrich.js
! grep -q 'MutationObserver\|setInterval' hpr/edge/ui/edge-g7-enrich.js
grep -Fq 'location /api/traffic/' hpr/edge/nginx.conf
grep -Fq 'proxy_pass https://traffic.hpradar.com/' hpr/edge/nginx.conf
grep -Fq 'location /api/photo/hex/' hpr/edge/nginx.conf

# G8 local station overview
test -s hpr/edge/ui/edge-g8-station.js
grep -Fq 'edge-g8-station.js' hpr/edge/ui/hpr-config.js
grep -Fq 'data-hpr-g8="1"' hpr/edge/ui/edge-g8-station.js
grep -Fq 'AirWire frames' hpr/edge/ui/edge-g8-station.js
! grep -q 'MutationObserver\|setInterval\|fetch(' hpr/edge/ui/edge-g8-station.js

# G9 selected segmented trace (CI gate)
test -s hpr/edge/ui/edge-g9-trace.js
grep -Fq 'edge-g9-trace.js' hpr/edge/ui/hpr-config.js
grep -Fq 'MAX_TRACE_MIN=90' hpr/edge/ui/edge-g9-trace.js
grep -Fq 'MAX_GAP_SEC=180' hpr/edge/ui/edge-g9-trace.js
grep -Fq 'MAX_IMPLIED_KT=950' hpr/edge/ui/edge-g9-trace.js
grep -Fq "traceUrl(id,'recent')" hpr/edge/ui/edge-g9-trace.js
grep -Fq "traceUrl(id,'full')" hpr/edge/ui/edge-g9-trace.js
grep -Fq "before=map.getLayer('aircraft-symbol')?'aircraft-symbol'" hpr/edge/ui/edge-g9-trace.js
! grep -qi 'MutationObserver\|setInterval\|allTracks\|all-tracks\|replay' hpr/edge/ui/edge-g9-trace.js
grep -Fq -- '--write-json-globe-index' hpr/edge/entrypoint.sh
grep -Fq -- '--json-trace-interval=' hpr/edge/entrypoint.sh
grep -Fq 'location /data/traces/' hpr/edge/nginx.conf
grep -Fq 'alias /run/readsb/traces/' hpr/edge/nginx.conf

# G10 explicit replay dock
test -s hpr/edge/ui/edge-g10-replay.js
grep -Fq 'edge-g10-replay.js' hpr/edge/ui/hpr-config.js
grep -Fq "d.id='hprReplayDock'" hpr/edge/ui/edge-g10-replay.js
grep -Fq "b.textContent='Replay'" hpr/edge/ui/edge-g10-replay.js
grep -Fq 'requestAnimationFrame(frame)' hpr/edge/ui/edge-g10-replay.js
grep -Fq 'left:calc(86px + var(--list) + 12px)' hpr/edge/ui/edge-g10-replay.js
! grep -q 'MutationObserver\|setInterval' hpr/edge/ui/edge-g10-replay.js

# G11 All Tracks stays disabled/hidden
! grep -qiE 'All Tracks|allTracks|data-all-tracks|id="all-tracks"|id="allTracks"' hpr/edge/ui/index.html hpr/edge/ui/hpr-config.js hpr/edge/ui/edge-g10-replay.js

# G12 compact Settings shell
test -s hpr/edge/ui/edge-g12-settings-shell.js
grep -Fq 'edge-g12-settings-shell.js' hpr/edge/ui/hpr-config.js
grep -Fq "['receiver','Receiver']" hpr/edge/ui/edge-g12-settings-shell.js
grep -Fq "['display','Display']" hpr/edge/ui/edge-g12-settings-shell.js
grep -Fq "['feeds','Feeds']" hpr/edge/ui/edge-g12-settings-shell.js
grep -Fq "['security','Security']" hpr/edge/ui/edge-g12-settings-shell.js
! grep -q 'MutationObserver\|setInterval\|fetch(' hpr/edge/ui/edge-g12-settings-shell.js

# G13 persistent Receiver settings; only readsb child restarts
test -s hpr/edge/ui/edge-g13-receiver.js
grep -Fq 'edge-g13-receiver.js' hpr/edge/ui/hpr-config.js
grep -Fq "api('station',payload)" hpr/edge/ui/edge-g13-receiver.js
grep -Fq 'Saved · readsb child restarting' hpr/edge/ui/edge-g13-receiver.js
grep -Fq 'DATA_DIR="${HPR_EDGE_DATA_DIR:-/data/hpr-edge}"' hpr/edge/entrypoint.sh
grep -Fq 'HPR Edge applying persistent config: readsb child restart only' hpr/edge/entrypoint.sh
test -s test/edge_g13_admin.sh
test -s test/edge_g13_receiver.spec.js

# G14 persistent Display settings; live apply without readsb restart
test -s hpr/edge/ui/edge-g14-display.js
grep -Fq 'edge-g14-display.js' hpr/edge/ui/hpr-config.js
grep -Fq "api('display',{pin,...d})" hpr/edge/ui/edge-g14-display.js
grep -Fq "map.addSource('hpr-display-rings'" hpr/edge/ui/edge-g14-display.js
grep -Fq 'Applies live; readsb is not restarted.' hpr/edge/ui/edge-g14-display.js
test -s test/edge_g14_admin.sh
test -s test/edge_g14_display.spec.js

# G15 provider-first feeds; advanced transport only for Custom
test -s hpr/edge/ui/edge-g15-feeds.js
grep -Fq 'edge-g15-feeds.js' hpr/edge/ui/hpr-config.js
grep -Fq "id:'hpradar',name:'HPRadar',host:'skyfeed.hpradar.com',port:30004,protocol:'beast_reduce_plus_out'" hpr/edge/ui/edge-g15-feeds.js
grep -Fq '<div id="hprFeedCustom" hidden>' hpr/edge/ui/edge-g15-feeds.js
grep -Fq "e.target.value!=='custom'" hpr/edge/ui/edge-g15-feeds.js
test -s test/edge_g15_admin.sh
test -s test/edge_g15_feeds.spec.js

# G16 six-digit admin PIN management
test -s hpr/edge/ui/edge-g16-security.js
grep -Fq 'edge-g16-security.js' hpr/edge/ui/hpr-config.js
grep -Fq "fetch('/api/admin?op=pin'" hpr/edge/ui/edge-g16-security.js
grep -Fq "if(!/^\\d{6}$/.test(pin)||!/^\\d{6}$/.test(next))" hpr/edge/ui/edge-g16-security.js
grep -Fq 'PIN changed' hpr/edge/ui/edge-g16-security.js
grep -Fq 'PIN_FILE="$DATA_DIR/pin"' hpr/edge/entrypoint.sh
grep -Fq "printf '%06d'" hpr/edge/entrypoint.sh
test -s test/edge_g16_admin.sh
test -s test/edge_g16_security.spec.js
