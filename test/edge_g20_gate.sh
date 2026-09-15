#!/bin/sh
set -eu

test -s test/edge_g20_browser_soak.spec.js
grep -Fq 'function airwire400()' test/edge_g20_browser_soak.spec.js
grep -Fq 'toBe(400)' test/edge_g20_browser_soak.spec.js
grep -Fq 'for(let i=0;i<24;i++)' test/edge_g20_browser_soak.spec.js
grep -Fq "page.on('crash'" test/edge_g20_browser_soak.spec.js
grep -Fq 'requestAnimationFrame' test/edge_g20_browser_soak.spec.js
grep -Fq 'toBeLessThanOrEqual(400)' test/edge_g20_browser_soak.spec.js

echo 'edge_g20_gate: PASS'
