import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const fixturePath = 'test/fixtures/atlas-v4.7/hpr-atlas-fe-v4.7-canonical.html';
const productionPath = 'hpr/edge/ui/index.html';
const html = fs.readFileSync(fixturePath, 'utf8');
const production = fs.readFileSync(productionPath, 'utf8');

function includesAll(label, source, needles) {
  const missing = needles.filter(needle => !source.includes(needle));
  assert.deepEqual(missing, [], `${label} missing: ${missing.join(', ')}`);
}

assert.equal(
  crypto.createHash('sha256').update(Buffer.from(html)).digest('hex'),
  '360dc1b014ef2da81789ec8b9b72958abfc874270ae514044544160451ef3f80',
  'V4.7 visual fixture changed'
);

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(Boolean)
  .join('\n');
new Function(scripts);

includesAll('search', html, [
  'function searchScore',
  'function search()',
  "if(ids.includes(q))return 120",
  "e.key==='ArrowDown'",
  "e.key==='ArrowUp'",
  "e.key==='Enter'",
  "e.key==='Escape'",
  'aria-activedescendant',
]);

includesAll('collection/detail', html, [
  'function openCollection',
  'function closeCollection',
  'function selectEntity',
  'function renderList',
  'function renderDetail',
  '[data-related]',
  "$('#closeCollection').onclick=closeCollection",
  "$('#closeDetail').onclick=",
]);

includesAll('map controls and state', html, [
  'new maplibregl.NavigationControl',
  'new maplibregl.GlobeControl',
  'new maplibregl.FullscreenControl',
  'function applyLayerVisibility',
  'function cameraInsets',
  'function settleMapLayout',
  "map.on('click'",
  "map.on('move'",
  "map.on('zoom'",
]);

includesAll('tools/preferences', html, [
  'function renderTool',
  'data-layer=',
  'data-setting="units"',
  'data-setting="labelDensity"',
  'data-basemap="minimal"',
  'data-basemap="contextual"',
  'data-basemap="satellite"',
  'function persistPreferences',
  'function restorePreferences',
  'hprAtlasV47Preferences',
]);

includesAll('responsive composition', html, [
  'function compositionMode()',
  'function syncAdaptiveChrome()',
  'function closeAdaptiveMenus()',
  'function mobileSwitchKind(',
  '#rail{position:absolute',
  '@media (min-width:768px) and (max-width:1279px)',
  '@media (max-width:767px)',
  'id="tabletDock"',
  'id="mobileContextBar"',
  'id="mobilePeekBar"',
  "document.body.classList.toggle('sheet-open'",
]);

assert(!/fetch\s*\(|XMLHttpRequest|WebSocket\s*\(/.test(scripts), 'G2 fixture must remain contract-free');
assert(production.includes("'/api/air/v1'"), 'production AirWire endpoint changed');
assert(production.includes('V4.7 LIVE / AIRWIRE'), 'production FE identity changed');

includesAll('production search', production, [
  'function searchScore',
  "if(values.includes(q))return 120",
  "e.key==='ArrowDown'",
  "e.key==='ArrowUp'",
  "e.key==='Enter'",
  'aria-activedescendant',
]);
includesAll('production collection/detail', production, [
  'function renderList',
  'function renderDetail',
  'function closeDetail',
  'function selectAircraft',
]);
includesAll('production controls/preferences', production, [
  'new maplibregl.NavigationControl',
  'new maplibregl.GlobeControl',
  'new maplibregl.FullscreenControl',
  'function applyLayerVisibility',
  'function renderTool',
  'data-layer=',
  'data-setting=',
  'function persistPreferences',
  'function restorePreferences',
]);
includesAll('production responsive composition', production, [
  'function compositionMode',
  'function syncAdaptiveChrome',
  '@media(max-width:900px)',
  '@media(max-width:680px)',
]);

console.log('G2 PASS: V4.4 interaction behavior is locked in the fixture and the aircraft-only production UI.');
