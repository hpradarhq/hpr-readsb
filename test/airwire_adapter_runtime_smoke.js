'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('hpr/edge/ui/airwire-adapter.js','utf8');
class FakeWebSocket{
  constructor(){this.binaryType='';}
}
const window={
  fetch:async()=>({ok:true,json:async()=>({aircraft:[]})}),
  HPR_CONFIG:{ws:'ws://localhost/ws/air'}
};
const context={
  window,
  location:{protocol:'http:',host:'localhost'},
  WebSocket:FakeWebSocket,
  TextDecoder,
  DataView,
  Uint8Array,
  ArrayBuffer,
  Map,
  Object,
  Number,
  String,
  Date,
  TypeError,
  setTimeout:()=>0,
  clearTimeout:()=>{},
  console
};
vm.createContext(context);
vm.runInContext(code,context,{filename:'airwire-adapter.js'});
assert(window.HPRAirWire,'HPRAirWire export missing');
assert.strictEqual(typeof window.HPRAirWire.adaptEnvelope,'function','adaptEnvelope export missing');
const out=window.HPRAirWire.adaptEnvelope([1,123,7,[['88804e',0,16,'HVN1548',20.9,106.8,10825,null,286.4,90,null,null,'1234','A3',null,1,2,-20,'VN-A353','A321',0,42]]]);
assert.strictEqual(out.version,1);
assert.strictEqual(out.totalMessages,7);
assert.strictEqual(out.aircraft.length,1);
assert.strictEqual(out.aircraft[0].id,'88804e');
assert.strictEqual(out.aircraft[0].typeCode,'A321');
console.log('airwire-adapter runtime smoke PASS');
