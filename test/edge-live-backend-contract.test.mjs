import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');

const makefile = read('Makefile');
const airwireC = read('hpr/airwire/hpr_airwire.c');
const nginx = read('hpr/edge/nginx.conf');
const index = read('hpr/edge/ui/index.html');
const bridge = read('hpr/edge/ui/atlas-edge-live-bridge.js');
const dockerfile = read('docker/edge.Dockerfile');

assert.match(makefile, /-DwriteJsonToFile=hprWriteJsonToFile/,
  'readsb.c must route JSON writes through the HPR AirWire wrapper');
assert.match(makefile, /-include hpr\/airwire\/hpr_airwire\.h/,
  'readsb.c must see the AirWire wrapper prototype');
assert.match(airwireC, /Modes\.aircraftActive/,
  'AirWire must be generated from readsb canonical live aircraft state');
assert.match(airwireC, /strcmp\(file, "aircraft\.json"\) == 0/,
  'AirWire generation must follow the real aircraft.json write cycle');
assert.match(nginx, /location = \/api\/air\/v1[\s\S]*alias \/run\/readsb\/airwire\.json/,
  'the FE AirWire endpoint must expose readsb-generated airwire.json');
assert.match(index, /const ENDPOINT='\/api\/air\/v1'/,
  'Atlas bootstrap must probe the live AirWire endpoint');
assert.ok(!index.includes('src="atlas-v4.7-shell.html"'),
  'Atlas demo shell must not auto-start before the backend is live');
assert.match(index, /payload\[0\]===1&&Array\.isArray\(payload\[3\]\)/,
  'bootstrap must validate an AirWire v1 envelope before loading Atlas');
assert.match(bridge, /fetch\(CONTRACT\.air,\{cache:'no-store'\}\)/,
  'runtime aircraft updates must fetch the BE contract');
assert.match(bridge, /DATA\.splice\(0,DATA\.length/,
  'runtime must replace canonical demo entities with backend entities');
assert.match(bridge, /hpr-edge-live-ready/,
  'Atlas must only become visible after the first decoded live snapshot');
assert.match(dockerfile, /test -s \/run\/readsb\/airwire\.json/,
  'container health must depend on live AirWire output');

console.log('EDGE LIVE BACKEND PASS: readsb -> AirWire -> /api/air/v1 -> Atlas; no demo-first startup.');
