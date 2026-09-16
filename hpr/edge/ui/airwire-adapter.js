/* HPR binary AirWire v1 -> Atlas V4.7 aircraft model.
 * Compatibility boundary: the legacy V4.7 shell still calls fetch('/api/air/v1').
 * This file intercepts only that path and serves it from the native /ws/air cache.
 * No backend JSON serialization/parsing occurs on the aircraft hot path.
 */
(()=>{'use strict';
const POS=0x02,IDENT=0x06,POS_SIZE=20,IDENT_SIZE=15,STALE_MS=120000;
const cache=new Map();
const nativeFetch=window.fetch.bind(window);
let ws=null,retryMs=1000,connected=false,totalFrames=0;
const textDecoder=new TextDecoder('ascii');
const u24=(d,o)=>d.getUint8(o)|(d.getUint8(o+1)<<8)|(d.getUint8(o+2)<<16);
const idOf=n=>n.toString(16).padStart(6,'0');
function aircraft(id){
  let a=cache.get(id);
  if(!a){a={kind:'aircraft',id,sourceClass:13,source:'Unknown',callsign:null,latitude:null,longitude:null,coordinates:null,barometricAltitudeFt:null,geometricAltitudeFt:null,groundSpeedKt:null,trackDeg:null,barometricRateFpm:null,geometricRateFpm:null,squawk:null,categoryCode:null,emergency:null,rssiDbfs:null,registration:null,typeCode:null,dbFlags:0,messageCount:0,isGround:false,isAlert:false,isSpi:false,isNonIcao:false,hasPosition:false,isMlat:false,lastSeenMs:0,lastPositionMs:0,trail:[]};cache.set(id,a)}
  return a;
}
function decodePosition(d,o,now){
  const a=aircraft(idOf(u24(d,o+1)));
  a.longitude=d.getInt32(o+4,true)/600000;
  a.latitude=d.getInt32(o+8,true)/600000;
  a.coordinates=[a.longitude,a.latitude];
  const trail=a.trail,last=trail[trail.length-1];
  if(!last||last[0]!==a.longitude||last[1]!==a.latitude){trail.push([a.longitude,a.latitude,now,a.barometricAltitudeFt]);if(trail.length>180)trail.shift()}
  a.barometricAltitudeFt=d.getInt16(o+12,true)*25;
  a.groundSpeedKt=d.getUint16(o+16,true)/10;
  a.trackDeg=d.getUint16(o+14,true)/10;
  a.barometricRateFpm=d.getInt16(o+18,true);
  a.hasPosition=true;a.lastPositionMs=now;a.lastSeenMs=now;a.messageCount++;
}
function decodeIdentity(d,o,now){
  const a=aircraft(idOf(u24(d,o+1)));
  const raw=new Uint8Array(d.buffer,d.byteOffset+o+4,8);
  const callsign=textDecoder.decode(raw).replace(/\0.*$/,'').trim();
  a.callsign=callsign||null;
  const category=d.getUint8(o+12);a.categoryCode=category?category.toString(16).padStart(2,'0').toUpperCase():null;
  const squawk=d.getUint16(o+13,true);a.squawk=squawk?squawk.toString(16).padStart(4,'0'):null;
  a.lastSeenMs=now;a.messageCount++;
}
function decode(buffer){
  const d=new DataView(buffer);let o=0;const now=Date.now();
  while(o<d.byteLength){
    const type=d.getUint8(o),size=type===POS?POS_SIZE:type===IDENT?IDENT_SIZE:0;
    if(!size||o+size>d.byteLength)break;
    if(type===POS)decodePosition(d,o,now);else decodeIdentity(d,o,now);
    totalFrames++;o+=size;
  }
}
function snapshotRows(){
  const now=Date.now(),rows=[];
  for(const [id,a] of cache){
    const seen=(now-a.lastSeenMs)/1000;if(seen>STALE_MS/1000){cache.delete(id);continue}
    const seenPos=a.lastPositionMs?(now-a.lastPositionMs)/1000:null;
    rows.push([id,13,a.hasPosition?16:0,a.callsign,a.latitude,a.longitude,a.barometricAltitudeFt,null,a.groundSpeedKt,a.trackDeg,a.barometricRateFpm,null,a.squawk,a.categoryCode?parseInt(a.categoryCode,16):null,null,seenPos,seen,null,a.registration,a.typeCode,a.dbFlags,a.messageCount]);
  }
  return rows;
}
function envelope(){return[1,Date.now()/1000,totalFrames,snapshotRows()]}
function wsUrl(){return window.HPR_CONFIG?.ws||`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws/air`}
function connect(){
  try{ws=new WebSocket(wsUrl());ws.binaryType='arraybuffer'}catch(_){return scheduleReconnect()}
  ws.onopen=()=>{connected=true;retryMs=1000};
  ws.onmessage=e=>{if(e.data instanceof ArrayBuffer)decode(e.data)};
  ws.onerror=()=>{};
  ws.onclose=()=>{connected=false;scheduleReconnect()};
}
function scheduleReconnect(){const wait=retryMs;retryMs=Math.min(retryMs*2,10000);setTimeout(connect,wait)}
function categoryCode(value){const n=Number(value);return Number.isFinite(n)&&n>0?Math.max(0,Math.min(255,Math.trunc(n))).toString(16).padStart(2,'0').toUpperCase():null}
function adaptRow(row){
  if(!Array.isArray(row)||!row[0])return null;const seen=Number(row[16]);
  return{kind:'aircraft',id:String(row[0]).toLowerCase(),sourceClass:13,source:'Unknown',callsign:row[3]||null,latitude:row[4]??null,longitude:row[5]??null,coordinates:row[4]==null||row[5]==null?null:[row[5],row[4]],barometricAltitudeFt:row[6]??null,geometricAltitudeFt:null,groundSpeedKt:row[8]??null,trackDeg:row[9]??null,barometricRateFpm:row[10]??null,geometricRateFpm:null,squawk:row[12]||null,categoryCode:categoryCode(row[13]),emergency:null,seenPositionSec:row[15]??null,seenSec:Number.isFinite(seen)?seen:null,rssiDbfs:null,registration:row[18]||null,typeCode:row[19]||null,dbFlags:row[20]||0,messageCount:row[21]||0,isGround:false,isAlert:false,isSpi:false,isNonIcao:false,hasPosition:!!(row[2]&16),isMlat:false,freshness:seen<=10?'live':seen<=30?'aging':'stale'};
}
function adaptEnvelope(payload){if(!Array.isArray(payload)||payload[0]!==1||!Array.isArray(payload[3]))throw new TypeError('Invalid AirWire v1 envelope');return{version:1,generationTime:Number(payload[1])||0,totalMessages:Number(payload[2])||0,aircraft:payload[3].map(adaptRow).filter(Boolean)}}
window.fetch=async function(input,init){
  const raw=typeof input==='string'?input:input?.url;
  let path='';try{path=new URL(raw,location.href).pathname}catch(_){}
  if(path==='/api/air/v1')return{ok:connected||cache.size>0,status:connected||cache.size>0?200:503,json:async()=>envelope()};
  return nativeFetch(input,init);
};
window.HPRAirWire=Object.freeze({adaptEnvelope,stats:()=>({connected,aircraft:cache.size,frames:totalFrames}),trail:id=>{const a=cache.get(String(id).toLowerCase());return a&&a.trail?a.trail:[]}});
connect();
})();
