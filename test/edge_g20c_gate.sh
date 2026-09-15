#!/bin/sh
set -eu
for f in hpr/edge/ui/edge-g13-receiver.js hpr/edge/ui/edge-g15-feeds.js hpr/edge/ui/edge-g16-security.js hpr/edge/admin.cgi; do test -s "$f"; done
grep -q "/data/hpr-edge\|hpr-edge" hpr/edge/admin.cgi
grep -qi "pin" hpr/edge/ui/edge-g16-security.js
grep -qi "feed" hpr/edge/ui/edge-g15-feeds.js
grep -qi "uuid" hpr/edge/ui/edge-g13-receiver.js
echo 'G20C PASS: receiver/admin/feed persistence and security surfaces present.'
