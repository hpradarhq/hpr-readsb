import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context={window:{}};vm.runInNewContext(fs.readFileSync('hpr/edge/ui/station-context.js','utf8'),context);
const view=context.window.HPRStationContext.adapt(
  {version:'readsb test',refresh:1000,readsb:true,dbServer:true,binCraft:true,zstd:true},
  {last1min:{start:100,end:160,local:{accepted:[1200,300],signal:-18.2,peak_signal:-2.1,strong_signals:7,blocks_dropped:0},tracks:{all:54}}},
  {name:'HPR Hanoi',lat:21.0278,lon:105.8342,alt_ft:40,multifeeder_uuid:'station-1'}
);
assert.equal(view.name,'HPR Hanoi');
assert.equal(view.acceptedPerSecond,25);
assert.equal(view.signalDbfs,-18.2);
assert.equal(view.trackCount,54);
assert.equal(view.capabilities.readsb,true);
const bridge=fs.readFileSync('hpr/edge/ui/atlas-edge-live-bridge.js','utf8');
for(const path of ['/api/readsb/receiver.json','/data/stats.json','/api/readsb/station.json'])assert.match(bridge,new RegExp(path.replaceAll('/','\\/')));
assert.match(bridge,/StationContext\.adapt/);
console.log('G5 PASS: receiver, stats, and station context use named fields through the canonical Atlas live bridge');
