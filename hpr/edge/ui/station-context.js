/* readsb receiver/stats/station JSON -> named Atlas station context. */
(()=>{'use strict';
const num=v=>v==null||v===''||!Number.isFinite(Number(v))?null:Number(v);
const text=v=>v==null||String(v).trim()===''?null:String(v).trim();
const sum=v=>Array.isArray(v)?v.reduce((total,item)=>total+(num(item)||0),0):0;
function adapt(receiver={},stats={},station={}){
  const period=stats.last1min||stats.latest||{};
  const seconds=Math.max(1,(num(period.end)||0)-(num(period.start)||0));
  const local=period.local||{};
  return{
    name:text(station.name)||'Local receiver',latitude:num(station.lat),longitude:num(station.lon),
    altitudeM:num(station.alt_m),altitudeFt:num(station.alt_ft),stationUuid:text(station.multifeeder_uuid),
    readsbVersion:text(receiver.version)||'readsb',refreshMs:num(receiver.refresh)||1000,
    capabilities:{readsb:!!receiver.readsb,dbServer:!!receiver.dbServer,binCraft:!!receiver.binCraft,zstd:!!receiver.zstd},
    acceptedPerSecond:sum(local.accepted)/seconds,signalDbfs:num(local.signal),peakSignalDbfs:num(local.peak_signal),
    strongSignalCount:num(local.strong_signals),droppedBlocks:num(local.blocks_dropped),trackCount:num(period.tracks?.all),
    statsPeriodSec:seconds
  };
}
window.HPRStationContext=Object.freeze({adapt});
})();
