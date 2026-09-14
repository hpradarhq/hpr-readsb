/* Native HPR AirWire v1 -> Atlas model.
 * Motion hot path stays binary /ws/air.
 * 0x0A carries DB-backed ICAO type + registration.
 * Slow-changing source/RSSI/geom fields may still be enriched from local readsb JSON.
 */
(()=>{'use strict';
const POS=0x02,IDENT=0x06,META=0x0A,POS_SIZE=20,IDENT_SIZE=15,META_SIZE=20,STALE_MS=120000,META_MS=3000;
const cache=new Map();
const nativeFetch=window.fetch.bind(window);
let ws=null,retryMs=1000,connected=false,totalFrames=0;
const textDecoder=new TextDecoder('ascii');
const u24=(d,o)=>d.getUint8(o)|(d.getUint8(o+1)<<8)|(d.getUint8(o+2)<<16);
const idOf=n=>n.toString(16).padStart(6,'0');
const clean=s=>{s=String(s??'').trim();return s||null};
const SRC={adsb_icao:[0,'ADS-B'],adsb_icao_nt:[1,'ADS-B NT'],adsr_icao:[2,'ADS-R'],tisb_icao:[3,'TIS-B'],adsc:[4,'ADS-C'],mlat:[5,'MLAT'],mode_s:[7,'Mode-S'],adsb_other:[8,'ADS-B other'],adsr_other:[9,'ADS-R other'],tisb_trackfile:[10,'TIS-B track'],tisb_other:[11,'TIS-B other'],mode_ac:[12,'Mode-A']};
function aircraft(id){
  let a=cache.get(id);
  if(!a){a={kind:'aircraft',id,sourceClass:13,source:'Unknown',callsign:null,latitude:null,longitude:null,coordinates:null,barometricAltitudeFt:null,geometricAltitudeFt:null,groundSpeedKt:null,trackDeg:null,barometricRateFpm:null,geometricRateFpm:null,squawk:null,categoryCode:null,emergency:null,rssiDbfs:null,registration:null,typeCode:null,typeDescription:null,dbFlags:0,messageCount:0,isGround:false,isAlert:false,isSpi:false,isNonIcao:false,hasPosition:false,isMlat:false,lastSeenMs:0,lastPositionMs:0};cache.set(id,a)}
  return a;
}
function decodePosition(d,o,now){
  const a=aircraft(idOf(u24(d,o+1)));
  a.longitude=d.getInt32(o+4,true)/600000;a.latitude=d.getInt32(o+8,true)/600000;a.coordinates=[a.longitude,a.latitude];
  a.barometricAltitudeFt=d.getInt16(o+12,true)*25;a.trackDeg=d.getUint16(o+14,true)/10;a.groundSpeedKt=d.getUint16(o+16,true)/10;a.barometricRateFpm=d.getInt16(o+18,true);
  a.hasPosition=true;a.lastPositionMs=now;a.lastSeenMs=now;a.messageCount++;
}
function decodeIdentity(d,o,now){
  const a=aircraft(idOf(u24(d,o+1))),raw=new Uint8Array(d.buffer,d.byteOffset+o+4,8);
  a.callsign=clean(textDecoder.decode(raw).replace(/\0.*$/,''));
  const cat=d.getUint8(o+12);if(cat&&!a.categoryCode)a.categoryCode=cat.toString(16).padStart(2,'0').toUpperCase();
  const sq=d.getUint16(o+13,true);a.squawk=sq?sq.toString(16).padStart(4,'0'):null;a.lastSeenMs=now;a.messageCount++;
}
function decodeMetadata(d,o,now){
  const a=aircraft(idOf(u24(d,o+1)));
  const typeRaw=new Uint8Array(d.buffer,d.byteOffset+o+4,4),regRaw=new Uint8Array(d.buffer,d.byteOffset+o+8,12);
  a.typeCode=clean(textDecoder.decode(typeRaw).replace(/\0.*$/,''))?.toUpperCase()||null;
  a.registration=clean(textDecoder.decode(regRaw).replace(/\0.*$/,''))||null;
  a.lastSeenMs=Math.max(a.lastSeenMs,now);a.messageCount++;
}
function decode(buffer){const d=new DataView(buffer);let o=0;const now=Date.now();while(o<d.byteLength){const t=d.getUint8(o),n=t===POS?POS_SIZE:t===IDENT?IDENT_SIZE:t===META?META_SIZE:0;if(!n||o+n>d.byteLength)break;if(t===POS)decodePosition(d,o,now);else if(t===IDENT)decodeIdentity(d,o,now);else decodeMetadata(d,o,now);totalFrames++;o+=n}}
function enrich(x){
  const id=clean(x?.hex)?.toLowerCase();if(!id||id.startsWith('~'))return;const a=aircraft(id),now=Date.now();
  a.callsign=clean(x.flight)||a.callsign;a.registration=a.registration||clean(x.r);a.typeCode=a.typeCode||clean(x.t)?.toUpperCase()||null;a.typeDescription=clean(x.desc);a.categoryCode=clean(x.category)?.toUpperCase()||a.categoryCode;a.squawk=clean(x.squawk)||a.squawk;a.emergency=clean(x.emergency);a.rssiDbfs=Number.isFinite(Number(x.rssi))?Number(x.rssi):a.rssiDbfs;a.messageCount=Number.isFinite(Number(x.messages))?Number(x.messages):a.messageCount;
  const src=SRC[String(x.type||'').toLowerCase()]||[13,'Unknown'];a.sourceClass=src[0];a.source=src[1];a.isMlat=src[0]===5||(Array.isArray(x.mlat)&&x.mlat.includes('lat'));a.isGround=x.alt_baro==='ground'||x.ground===true;a.isAlert=!!x.alert;a.isSpi=!!x.spi;a.isNonIcao=String(x.hex||'').startsWith('~');
  if(Number.isFinite(Number(x.alt_geom)))a.geometricAltitudeFt=Number(x.alt_geom);if(Number.isFinite(Number(x.geom_rate)))a.geometricRateFpm=Number(x.geom_rate);if(Number.isFinite(Number(x.baro_rate)))a.barometricRateFpm=Number(x.baro_rate);
  if(!a.hasPosition&&Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lon))){a.latitude=Number(x.lat);a.longitude=Number(x.lon);a.coordinates=[a.longitude,a.latitude];a.hasPosition=true;a.lastPositionMs=now-(Number(x.seen_pos)||0)*1000}
  a.lastSeenMs=Math.max(a.lastSeenMs,now-(Number(x.seen)||0)*1000);
}
async function refreshMetadata(){try{const r=await nativeFetch('/api/readsb/aircraft.json',{cache:'no-store'});if(r.ok){const j=await r.json();for(const x of j.aircraft||[])enrich(x)}}catch(_){}finally{setTimeout(refreshMetadata,META_MS)}}
function snapshotRows(){const now=Date.now(),rows=[];for(const [id,a] of cache){const seen=(now-a.lastSeenMs)/1000;if(seen>STALE_MS/1000){cache.delete(id);continue}const seenPos=a.lastPositionMs?(now-a.lastPositionMs)/1000:null;let flags=a.hasPosition?16:0;if(a.isGround)flags|=1;if(a.isAlert)flags|=2;if(a.isSpi)flags|=4;if(a.isNonIcao)flags|=8;if(a.isMlat)flags|=32;rows.push([id,a.sourceClass,flags,a.callsign,a.latitude,a.longitude,a.barometricAltitudeFt,a.geometricAltitudeFt,a.groundSpeedKt,a.trackDeg,a.barometricRateFpm,a.geometricRateFpm,a.squawk,a.categoryCode,a.emergency,seenPos,seen,a.rssiDbfs,a.registration,a.typeCode,a.dbFlags,a.messageCount])}return rows}
function envelope(){return[1,Date.now()/1000,totalFrames,snapshotRows()]}
function wsUrl(){return window.HPR_CONFIG?.ws||`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws/air`}
function connect(){try{ws=new WebSocket(wsUrl());ws.binaryType='arraybuffer'}catch(_){return reconnect()}ws.onopen=()=>{connected=true;retryMs=1000};ws.onmessage=e=>{if(e.data instanceof ArrayBuffer)decode(e.data)};ws.onerror=()=>{};ws.onclose=()=>{connected=false;reconnect()}}
function reconnect(){const wait=retryMs;retryMs=Math.min(retryMs*2,10000);setTimeout(connect,wait)}
function categoryCode(v){if(typeof v==='string'&&/^[ABC]\d$/i.test(v))return v.toUpperCase();const n=Number(v);return Number.isFinite(n)&&n>0?n.toString(16).padStart(2,'0').toUpperCase():null}
function adaptRow(r){if(!Array.isArray(r)||!r[0])return null;const seen=Number(r[16]),flags=Number(r[2]||0),src=Number(r[1]??13);return{kind:'aircraft',id:String(r[0]).toLowerCase(),sourceClass:src,source:(Object.values(SRC).find(v=>v[0]===src)||[13,'Unknown'])[1],callsign:r[3]||null,latitude:r[4]??null,longitude:r[5]??null,coordinates:r[4]==null||r[5]==null?null:[r[5],r[4]],barometricAltitudeFt:r[6]??null,geometricAltitudeFt:r[7]??null,groundSpeedKt:r[8]??null,trackDeg:r[9]??null,barometricRateFpm:r[10]??null,geometricRateFpm:r[11]??null,squawk:r[12]||null,categoryCode:categoryCode(r[13]),emergency:r[14]||null,seenPositionSec:r[15]??null,seenSec:Number.isFinite(seen)?seen:null,rssiDbfs:r[17]??null,registration:r[18]||null,typeCode:r[19]||null,dbFlags:r[20]||0,messageCount:r[21]||0,isGround:!!(flags&1),isAlert:!!(flags&2),isSpi:!!(flags&4),isNonIcao:!!(flags&8),hasPosition:!!(flags&16),isMlat:!!(flags&32),freshness:seen<=10?'live':seen<=30?'aging':'stale'}}
function adaptEnvelope(p){if(!Array.isArray(p)||p[0]!==1||!Array.isArray(p[3]))throw new TypeError('Invalid AirWire v1 envelope');return{version:1,generationTime:Number(p[1])||0,totalMessages:Number(p[2])||0,aircraft:p[3].map(adaptRow).filter(Boolean)}}
window.fetch=async function(input,init){const raw=typeof input==='string'?input:input?.url;let path='';try{path=new URL(raw,location.href).pathname}catch(_){}if(path==='/api/air/v1')return{ok:connected||cache.size>0,status:connected||cache.size>0?200:503,json:async()=>envelope()};return nativeFetch(input,init)};
window.HPRAirWire=Object.freeze({adaptEnvelope,stats:()=>({connected,aircraft:cache.size,frames:totalFrames})});connect();refreshMetadata();
})();
