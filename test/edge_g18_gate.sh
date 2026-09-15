#!/bin/sh
set -eu

test -s hpr/edge/ui/edge-g18-responsive.js
grep -Fq 'edge-g18-responsive.js' hpr/edge/ui/hpr-config.js
grep -Fq "const compact=()=>matchMedia('(max-width:900px)').matches" hpr/edge/ui/edge-g18-responsive.js
grep -Fq '@media (min-width:901px)' hpr/edge/ui/edge-g18-responsive.js
grep -Fq '@media (max-width:900px)' hpr/edge/ui/edge-g18-responsive.js
grep -Fq "detail?.classList.remove('open')" hpr/edge/ui/edge-g18-responsive.js
grep -Fq "collection?.classList.remove('open')" hpr/edge/ui/edge-g18-responsive.js
! grep -q 'MutationObserver\|setInterval\|setTimeout' hpr/edge/ui/edge-g18-responsive.js
test -s test/edge_g18_responsive.spec.js

echo 'edge_g18_gate: PASS'
