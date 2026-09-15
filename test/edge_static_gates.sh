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
