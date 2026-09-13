/* HPR AirWire v1 -> Atlas aircraft model. Positional indexes live only here. */
(()=>{'use strict';
const ROW={ID:0,SOURCE_CLASS:1,FLAGS:2,CALLSIGN:3,LATITUDE:4,LONGITUDE:5,BARO_ALTITUDE:6,GEOM_ALTITUDE:7,GROUND_SPEED:8,TRACK:9,BARO_RATE:10,GEOM_RATE:11,SQUAWK:12,CATEGORY:13,EMERGENCY:14,SEEN_POSITION:15,SEEN:16,RSSI:17,REGISTRATION:18,TYPE_CODE:19,DB_FLAGS:20,MESSAGE_COUNT:21};
const ENVELOPE={VERSION:0,GENERATED_AT:1,TOTAL_MESSAGES:2,AIRCRAFT:3};
const FLAGS={GROUND:1,ALERT:2,SPI:4,NON_ICAO:8,POSITION:16,MLAT:32};
const SOURCE_NAMES=['ADS-B','ADS-B NT','ADS-R','TIS-B','ADS-C','MLAT','Other','Mode-S','ADS-B other','ADS-R other','TIS-B track','TIS-B other','Mode-A','Unknown'];
const numberOrNull=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
const stringOrNull=value=>value==null||String(value).trim()===''?null:String(value).trim();
function categoryCode(value){const n=numberOrNull(value);return n==null?null:Math.max(0,Math.min(255,Math.trunc(n))).toString(16).padStart(2,'0').toUpperCase()}
function adaptRow(row){
  if(!Array.isArray(row))return null;
  const id=stringOrNull(row[ROW.ID]);if(!id)return null;
  const flagBits=numberOrNull(row[ROW.FLAGS])||0;
  const sourceClass=numberOrNull(row[ROW.SOURCE_CLASS]);
  const latitude=numberOrNull(row[ROW.LATITUDE]),longitude=numberOrNull(row[ROW.LONGITUDE]);
  const seenSec=numberOrNull(row[ROW.SEEN]);
  return{
    kind:'aircraft',id:id.toLowerCase(),sourceClass:sourceClass==null?13:sourceClass,
    source:SOURCE_NAMES[sourceClass]||'Unknown',
    callsign:stringOrNull(row[ROW.CALLSIGN]),latitude,longitude,
    coordinates:latitude==null||longitude==null?null:[longitude,latitude],
    barometricAltitudeFt:numberOrNull(row[ROW.BARO_ALTITUDE]),geometricAltitudeFt:numberOrNull(row[ROW.GEOM_ALTITUDE]),
    groundSpeedKt:numberOrNull(row[ROW.GROUND_SPEED]),trackDeg:numberOrNull(row[ROW.TRACK]),
    barometricRateFpm:numberOrNull(row[ROW.BARO_RATE]),geometricRateFpm:numberOrNull(row[ROW.GEOM_RATE]),
    squawk:stringOrNull(row[ROW.SQUAWK]),categoryCode:categoryCode(row[ROW.CATEGORY]),
    emergency:numberOrNull(row[ROW.EMERGENCY]),seenPositionSec:numberOrNull(row[ROW.SEEN_POSITION]),seenSec,
    rssiDbfs:numberOrNull(row[ROW.RSSI]),registration:stringOrNull(row[ROW.REGISTRATION]),
    typeCode:stringOrNull(row[ROW.TYPE_CODE]),dbFlags:numberOrNull(row[ROW.DB_FLAGS])||0,
    messageCount:numberOrNull(row[ROW.MESSAGE_COUNT])||0,
    isGround:!!(flagBits&FLAGS.GROUND),isAlert:!!(flagBits&FLAGS.ALERT),isSpi:!!(flagBits&FLAGS.SPI),
    isNonIcao:!!(flagBits&FLAGS.NON_ICAO),hasPosition:!!(flagBits&FLAGS.POSITION),isMlat:!!(flagBits&FLAGS.MLAT),
    freshness:seenSec!=null&&seenSec<=10?'live':seenSec!=null&&seenSec<=30?'aging':'stale'
  };
}
function adaptEnvelope(payload){
  if(!Array.isArray(payload)||payload[ENVELOPE.VERSION]!==1||!Array.isArray(payload[ENVELOPE.AIRCRAFT]))throw new TypeError('Invalid AirWire v1 envelope');
  return{version:1,generationTime:numberOrNull(payload[ENVELOPE.GENERATED_AT]),totalMessages:numberOrNull(payload[ENVELOPE.TOTAL_MESSAGES])||0,aircraft:payload[ENVELOPE.AIRCRAFT].map(adaptRow).filter(Boolean)};
}
window.HPRAirWire=Object.freeze({adaptEnvelope});
})();
