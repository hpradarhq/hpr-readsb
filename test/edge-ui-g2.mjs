import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const fixturePath='test/fixtures/atlas-v4.7/hpr-atlas-fe-v4.7-canonical.html';
const shellPath='hpr/edge/ui/atlas-v4.7-shell.html';
const entryPath='hpr/edge/ui/index.html';
const hardeningPath='hpr/edge/ui/atlas-edge-hardening.js';
const bridgePath='hpr/edge/ui/atlas-edge-live-bridge.js';
const fixture=fs.readFileSync(fixturePath,'utf8');
const shell=fs.readFileSync(shellPath,'utf8');
const entry=fs.readFileSync(entryPath,'utf8');
const hardening=fs.readFileSync(hardeningPath,'utf8');
const bridge=fs.readFileSync(bridgePath,'utf8');

function includesAll(label,source,needles){const missing=needles.filter(needle=>!source.includes(needle));assert.deepEqual(missing,[],`${label} missing: ${missing.join(', ')}`)}

assert.equal(crypto.createHash('sha256').update(Buffer.from(fixture)).digest('hex'),'360dc1b014ef2da81789ec8b9b72958abfc874270ae514044544160451ef3f80','V4.7 visual fixture changed');
assert.equal(shell,fixture,'production shell must be byte-identical to canonical Atlas V4.7');

const scripts=[...shell.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match=>match[1]).filter(Boolean).join('\n');
new Function(scripts);
new Function(hardening);
new Function(bridge);

includesAll('canonical search',shell,['function searchScore','function search()',"if(ids.includes(q))return 120","e.key==='ArrowDown'","e.key==='ArrowUp'","e.key==='Enter'",'aria-activedescendant']);
includesAll('canonical collection/detail',shell,['function openCollection','function closeCollection','function selectEntity','function renderList','function renderDetail','[data-related]','id="collectionPanel"','id="detailCard"']);
includesAll('canonical map controls',shell,['new maplibregl.NavigationControl','new maplibregl.GlobeControl','new maplibregl.FullscreenControl','function applyLayerVisibility','function cameraInsets','function settleMapLayout']);
includesAll('canonical adaptive composition',shell,['function compositionMode()','function syncAdaptiveChrome()','@media (min-width:768px) and (max-width:1279px)','@media (max-width:767px)','id="tabletDock"','id="mobileContextBar"','id="mobilePeekBar"']);
assert(!/fetch\s*\(|XMLHttpRequest|WebSocket\s*\(/.test(scripts),'canonical V4.7 shell must remain contract-free');

includesAll('production entry',entry,["const ENDPOINT='/api/air/v1'","frame.src='atlas-v4.7-shell.html'","payload[0]===1&&Array.isArray(payload[3])","'airwire-adapter.js'","'aircraft-renderer.js'","'station-context.js'","'atlas-edge-hardening.js'","'atlas-edge-live-bridge.js'",'frame.contentDocument','hpr-edge-live-ready']);
assert(!entry.includes('src="atlas-v4.7-shell.html"'),'canonical shell must not auto-start before live backend readiness');
assert(!entry.includes('--surface:'),'entry must not reimplement Atlas visual tokens');
assert(!entry.includes('maplibregl'),'entry must not create a parallel map implementation');

includesAll('production hardening',hardening,['REFERENCE_ENTITIES.splice(0,REFERENCE_ENTITIES.length)','NETWORK_ENTITIES.splice(0,NETWORK_ENTITIES.length)','delete RELATIONS[key]','weatherCollection=empty','atlas-edge-production-style','rotorcraft-art','clearDemoSources','Canonical Atlas V4.7 shell','Live AirWire v1 + readsb context']);

includesAll('live contracts',bridge,["air:'/api/air/v1'","receiver:'/api/readsb/receiver.json'","stats:'/data/stats.json'","station:'/api/readsb/station.json'",'AirWire.adaptEnvelope','StationContext.adapt']);
includesAll('Atlas model bridge',bridge,['function atlasAircraft','function atlasStation','DATA.splice(0,DATA.length','ALL_ENTITIES.splice(0,ALL_ENTITIES.length','state.kind=\'aircraft\'','renderHeaderContext();renderList();renderDetail();updateOperationalSources();syncAdaptiveChrome()']);
includesAll('renderer bridge',bridge,['AircraftRenderer.markup','AircraftRenderer.iconKey','AircraftRenderer.mapImages','loadImage(item.url)']);
includesAll('mock shutdown',bridge,['clearInterval(simulationTimer)','startSimulation=()=>{}','TRACK_HISTORY.clear()']);
includesAll('live reveal',bridge,['function signalReady(snapshot)','hpr-edge-live-ready','signalReady(snapshot)']);
assert(!/\bROW\s*\[|\bENVELOPE\s*\[|\bFLAGS\s*\[/.test(bridge),'AirWire positional indexes leaked into production bridge');
assert(!/WebSocket\s*\(/.test(bridge),'Edge bridge must use the frozen HTTP AirWire contract');

console.log('G2 PASS: canonical Atlas boots only after live AirWire and renders readsb-backed entities through isolated adapters.');
