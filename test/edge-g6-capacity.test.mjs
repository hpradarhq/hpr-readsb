import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context={window:{}};
vm.runInNewContext(fs.readFileSync('hpr/edge/ui/airwire-adapter.js','utf8'),context);
vm.runInNewContext(fs.readFileSync('hpr/edge/ui/aircraft-renderer.js','utf8'),context);
const types=['A321','A388','DH8D','MH6','B222','V22','AH1Z','AH1J','A129','H60'];
const rows=Array.from({length:400},(_,index)=>[
  index.toString(16).padStart(6,'0'),0,16,`HPR${index}`,20+(index%20)/10,105+(index%30)/10,
  1000+index*100,1050+index*100,120+(index%300),index%360,0,0,'1200',index%17===0?167:160,0,.2,.1,-20,
  `REG${index}`,types[index%types.length],0,index*10
]);
const envelope=[1,Date.now(),100000,rows];
const started=performance.now();
const snapshot=context.window.HPRAirWire.adaptEnvelope(envelope);
const iconKeys=snapshot.aircraft.map(context.window.HPRAircraftRenderer.iconKey);
const elapsedMs=performance.now()-started;
assert.equal(snapshot.aircraft.length,400);
assert.equal(iconKeys.length,400);
assert(iconKeys.includes('rotor-MH6'));
assert(iconKeys.includes('heavy_2e'));
assert(iconKeys.includes('twin_large'));
assert(!iconKeys.includes('puma'));
console.log(`G6 capacity readiness PASS: 400 named aircraft classified in ${elapsedMs.toFixed(2)} ms on ${process.arch}`);
