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
! grep -q 'MutationObserver\|setInterval\|fetch(' hpr/edge/ui/edge-g6-detail-layout.js
