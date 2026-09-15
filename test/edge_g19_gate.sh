#!/bin/sh
set -eu

test -s test/edge_g19_search_filter.spec.js
grep -Fq 'function searchScore(a,q)' hpr/edge/ui/index.html
grep -Fq "if(values.includes(q))return 120" hpr/edge/ui/index.html
grep -Fq "value.startsWith(q)" hpr/edge/ui/index.html
grep -Fq "value.includes(q)" hpr/edge/ui/index.html
grep -Fq "if(tab==='airborne'&&a.isGround)return false" hpr/edge/ui/index.html
grep -Fq "if(tab==='ground'&&!a.isGround)return false" hpr/edge/ui/index.html
grep -Fq "if(tab==='mlat'&&!a.isMlat)return false" hpr/edge/ui/index.html
grep -Fq "e.key==='ArrowDown'||e.key==='ArrowUp'" hpr/edge/ui/index.html
grep -Fq "e.key==='Enter'&&rows.length" hpr/edge/ui/index.html
grep -Fq "e.key==='Escape'" hpr/edge/ui/index.html

echo 'edge_g19_gate: PASS'
