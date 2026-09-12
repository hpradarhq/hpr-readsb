import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('hpr/edge/ui/airwire-adapter.js','utf8');
const context={window:{}};vm.runInNewContext(source,context);
const {adaptEnvelope}=context.window.HPRAirWire;
const row=['8880e3',5,1|2|4|8|16|32,'HVN123',20.98765,106.12345,35000,35625,468.2,87.4,-640,128,'1234',167,0,.2,.1,-13.5,'VN-A123','A321',3,12548];
const snapshot=adaptEnvelope([1,1789181234567,82736492,[row,null,'bad']]);
assert.equal(snapshot.version,1);
assert.equal(snapshot.generationTime,1789181234567);
assert.equal(snapshot.totalMessages,82736492);
assert.equal(snapshot.aircraft.length,1);
assert.deepEqual(JSON.parse(JSON.stringify(snapshot.aircraft[0])), {
  kind:'aircraft',id:'8880e3',sourceClass:5,source:'MLAT',callsign:'HVN123',latitude:20.98765,longitude:106.12345,
  coordinates:[106.12345,20.98765],barometricAltitudeFt:35000,geometricAltitudeFt:35625,groundSpeedKt:468.2,
  trackDeg:87.4,barometricRateFpm:-640,geometricRateFpm:128,squawk:'1234',categoryCode:'A7',emergency:0,
  seenPositionSec:.2,seenSec:.1,rssiDbfs:-13.5,registration:'VN-A123',typeCode:'A321',dbFlags:3,messageCount:12548,
  isGround:true,isAlert:true,isSpi:true,isNonIcao:true,hasPosition:true,isMlat:true,freshness:'live'
});
assert.throws(()=>adaptEnvelope([2,0,0,[]]),/Invalid AirWire v1/);
assert.throws(()=>adaptEnvelope({}),/Invalid AirWire v1/);

const bridge=fs.readFileSync('hpr/edge/ui/atlas-edge-live-bridge.js','utf8');
assert.doesNotMatch(bridge,/\bconst F\s*=|\bconst FLAG\s*=|\bfunction decode\s*\(|\benv\s*\[/);
assert.match(bridge,/AirWire\.adaptEnvelope/);
assert.match(bridge,/air:'\/api\/air\/v1'/);
console.log('G4 PASS: AirWire indexes and flags are isolated in airwire-adapter.js; canonical Atlas consumes only named fields through the live bridge');
