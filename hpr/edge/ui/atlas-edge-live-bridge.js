/* Live readsb/AirWire contract layered onto the byte-identical Atlas V4.7 shell. */
(()=>{'use strict';
const AirWire=window.HPRAirWire;
const AircraftRenderer=window.HPRAircraftRenderer;
const StationContext=window.HPRStationContext;
if(!AirWire||!AircraftRenderer||!StationContext)throw new Error('Atlas Edge bridge dependencies missing');

const CONTRACT=Object.freeze({air:'/api/air/v1',receiver:'/api/readsb/receiver.json',stats:'/data/stats.json',station:'/api/readsb/station.json',version:'/version.json'});
let lastGood=0,lastCount=null,lastCountTs=0,msgRate=0,polling=false,contextTimer=0,airTimer=0,readySent=false,lastReportedError=0;
let stationModel=null;

const finite=v=>v!=null&&Number.isFinite(Number(v))?Number(v):null;
const text=(v,fallback='—')=>v==null||String(v).trim()===''?fallback:String(v).trim();
const ageText=sec=>{const n=finite(sec);if(n==null)return '—';if(n<60)return `${Math.max(0,Math.round(n))} s`;return `${Math.round(n/60)} m`};
const deg=v=>finite(v)==null?'—':`${String(Math.round((Number(v)+360)%360)).padStart(3,'0')}°`;
const signed=v=>{const n=finite(v);if(n==null)return '—';if(n===0)return '0';return `${n>0?'+':'−'}${Math.abs(Math.round(n)).toLocaleString('en-US')}`};
const quality=a=>a.freshness==='live'?95:a.freshness==='aging'?74:48;

function reportError(stage,error,extra={}){
  const message=error?.stack||error?.message||String(error||'unknown error');
  window.parent.postMessage({type:'hpr-edge-live-error',stage,message,...extra},location.origin);
}
function reportRecovered(){window.parent.postMessage({type:'hpr-edge-live-recovered'},location.origin)}

function atlasAircraft(a){
  return{
    id:`ac-${a.id}`,kind:'aircraft',name:text(a.callsign,text(a.registration,a.id.toUpperCase())),type:text(a.typeCode,'Aircraft'),
    coord:a.coordinates,status:a.freshness,age:ageText(a.seenSec),altitude:finite(a.barometricAltitudeFt)??finite(a.geometricAltitudeFt)??0,
    speed:finite(a.groundSpeedKt)??0,vertical:signed(finite(a.barometricRateFpm)??finite(a.geometricRateFpm)),track:deg(a.trackDeg),
    heading:deg(a.trackDeg),icao:a.id.toUpperCase(),registration:text(a.registration),airframe:text(a.typeCode,'Unknown'),typeCode:text(a.typeCode,''),
    categoryCode:a.categoryCode,source:a.source,quality:quality(a),origin:'—',destination:'—',squawk:text(a.squawk),method:a.isMlat?'MLAT':text(a.source,'ADS-B'),
    emergency:a.emergency,rssiDbfs:a.rssiDbfs,messageCount:a.messageCount,isGround:a.isGround,isAlert:a.isAlert,isSpi:a.isSpi,isNonIcao:a.isNonIcao
  };
}

function atlasStation(s,aircraftCount,mlatCount){
  if(s.latitude==null||s.longitude==null)return null;
  const coord=[s.longitude,s.latitude],caps=['ADSB'];if(mlatCount>0)caps.push('MLAT');
  const q=s.droppedBlocks>0?82:96;
  return{
    id:'stn-edge-local',kind:'station',name:text(s.name,'Local receiver'),type:'Receiver station',coord,canonicalCoord:[...coord],status:'live',age:'1 s',
    rate:String(Math.round(s.acceptedPerSecond||0)),objects:`${aircraftCount} aircraft`,uuid:text(s.stationUuid,'LOCAL'),siteId:text(s.stationUuid,'LOCAL EDGE'),
    family:'ADS-B',place:'Local Edge',quality:q,grade:q>=90?5:4,reachNm:0,uptime:'—',owner:'LOCAL',locationMethod:'station.json',
    capabilities:caps,receiverPositions:Object.fromEntries(caps.map(cap=>[cap,{coord:[...coord],accuracy:'station metadata'}])),
    clock:'—',mlatGeometry:'—',peers:[],peerCount:0,activePeers:0,sharedAircraft:mlatCount,
    readsbVersion:s.readsbVersion,refreshMs:s.refreshMs,signalDbfs:s.signalDbfs,peakSignalDbfs:s.peakSignalDbfs,strongSignalCount:s.strongSignalCount,
    droppedBlocks:s.droppedBlocks,trackCount:s.trackCount,statsPeriodSec:s.statsPeriodSec
  };
}

function syncSearchModel(){ALL_ENTITIES.splice(0,ALL_ENTITIES.length,...DATA)}
function trackLiveAircraft(items){
  for(const d of items){if(!d.coord)continue;const h=TRACK_HISTORY.get(d.id)||[];const last=h[h.length-1];if(!last||last[0]!==d.coord[0]||last[1]!==d.coord[1])h.push([...d.coord]);while(h.length>20)h.shift();TRACK_HISTORY.set(d.id,h)}
}
function repaint(){
  const selectedId=state.selected?.id;state.selected=selectedId?DATA.find(d=>d.id===selectedId)||null:null;
  renderHeaderContext();renderList();renderDetail();updateOperationalSources();syncAdaptiveChrome();
  const secondary=document.querySelector('.secondary-pill');if(secondary)secondary.innerHTML=`<strong class="num">${DATA.length}</strong> live entities`;
  const fixed=[...document.querySelectorAll('.top-fixed .pill')];const ratePill=fixed.at(-1);if(ratePill)ratePill.innerHTML=`<span class="status-dot"></span><span class="num">${Math.round(msgRate).toLocaleString('en-US')}</span> msg/s`;
}
function replaceAircraft(snapshot){
  const aircraft=snapshot.aircraft.filter(a=>a.coordinates).map(atlasAircraft);trackLiveAircraft(aircraft);
  const stations=DATA.filter(d=>d.kind==='station');DATA.splice(0,DATA.length,...aircraft,...stations);syncSearchModel();
  state.kind='aircraft';state.collectionScope=null;state.headerContext=state.collectionOpen?'aircraft':'overview';
  state.layers.aircraft=true;state.layers.vessel=false;state.layers.aton=false;state.layers.source=false;state.layers.airports=false;state.layers.seaports=false;state.layers.flightRoutes=false;state.layers.seaLanes=false;state.layers.wind=false;state.layers.waterLevel=false;state.layers.tide=false;state.layers.coverage=false;
  repaint();
}
function replaceStation(){
  const aircraft=DATA.filter(d=>d.kind==='aircraft'),mlatCount=aircraft.filter(d=>d.method==='MLAT').length;
  const station=stationModel?atlasStation(stationModel,aircraft.length,mlatCount):null;
  DATA.splice(0,DATA.length,...aircraft,...(station?[station]:[]));syncSearchModel();state.layers.station=!!station;repaint();
}

const originalOperationalIconSvg=operationalIconSvg;
operationalIconSvg=function(d){return d?.kind==='aircraft'?AircraftRenderer.markup(d):originalOperationalIconSvg(d)};
const originalFeatureCollection=featureCollection;
featureCollection=function(kind){
  if(kind!=='aircraft')return originalFeatureCollection(kind);
  return{type:'FeatureCollection',features:DATA.filter(d=>d.kind==='aircraft'&&d.coord).map(d=>({type:'Feature',properties:{id:d.id,name:d.name,heading:numeric(d.heading||d.track),asset:d.asset||'',icon:AircraftRenderer.iconKey(d),grade:d.grade??0,observed:isObserved(d)},geometry:{type:'Point',coordinates:d.coord}}))};
};

function loadImage(url){return new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=url})}
async function ensureRotorImages(){
  if(!map||!map.isStyleLoaded?.())return;
  for(const item of AircraftRenderer.mapImages(state.theme==='dark'?'#f2cf5b':'#8a5a00')){
    if(!item.url||map.hasImage(item.name))continue;const image=await loadImage(item.url);if(image&&!map.hasImage(item.name)){try{map.addImage(item.name,image,{pixelRatio:2})}catch(_){}}
  }
  map.getSource('atlas-aircraft')?.setData(featureCollection('aircraft'));
}
function bindMapBridge(){
  if(!map){setTimeout(bindMapBridge,100);return}
  map.on('style.load',()=>setTimeout(ensureRotorImages,0));ensureRotorImages();
}

async function jsonOrEmpty(url){
  try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${url} HTTP ${r.status}`);return await r.json()}
  catch(error){console.warn('Atlas Edge context fetch',error);return{}}
}
async function refreshContext(){
  try{
    const [receiver,stats,station]=await Promise.all([jsonOrEmpty(CONTRACT.receiver),jsonOrEmpty(CONTRACT.stats),jsonOrEmpty(CONTRACT.station)]);
    stationModel=StationContext.adapt(receiver,stats,station);replaceStation();
  }catch(error){reportError('station/readsb context',error)}
}
function setConnected(ok){
  const dot=document.querySelector('.top-fixed .status-dot');if(dot){dot.style.background=ok?'var(--live)':'var(--danger)';dot.style.boxShadow=ok?'0 0 7px color-mix(in srgb,var(--live) 60%,transparent)':'none'}
  document.body.dataset.edgeConnection=ok?'live':'offline';
}
function signalReady(snapshot){
  if(readySent)return;
  readySent=true;
  window.parent.postMessage({type:'hpr-edge-live-ready',aircraft:snapshot.aircraft.length,generationTime:snapshot.generationTime},location.origin);
}
function backendPayloadError(payload){
  if(!payload||Array.isArray(payload)||typeof payload!=='object'||!payload.error)return null;
  const code=payload.exit_code==null?'':` · exit code ${payload.exit_code}`;
  return new Error(`${payload.error}${code}`);
}
async function tick(){
  if(polling)return;polling=true;
  try{
    const r=await fetch(CONTRACT.air,{cache:'no-store'});
    if(!r.ok){const body=await r.text();throw new Error(`GET ${CONTRACT.air} HTTP ${r.status}${body?`: ${body.slice(0,240)}`:''}`)}
    const raw=await r.text();let payload;
    try{payload=JSON.parse(raw)}catch(error){throw new Error(`AirWire invalid JSON: ${error.message}; body=${raw.slice(0,240)}`)}
    const backendError=backendPayloadError(payload);if(backendError)throw backendError;
    const snapshot=AirWire.adaptEnvelope(payload),now=Date.now();
    if(lastCount!=null&&snapshot.totalMessages>=lastCount)msgRate=(snapshot.totalMessages-lastCount)/Math.max((now-lastCountTs)/1000,.001);
    lastCount=snapshot.totalMessages;lastCountTs=now;lastGood=now;replaceAircraft(snapshot);replaceStation();setConnected(true);ensureRotorImages();signalReady(snapshot);
    if(lastReportedError){lastReportedError=0;reportRecovered()}
  }catch(error){
    if(Date.now()-lastGood>3500)setConnected(false);
    console.warn('Atlas Edge AirWire poll',error);
    const now=Date.now();if(!lastReportedError||now-lastReportedError>5000){lastReportedError=now;reportError('AirWire live poll',error,{http:'poll failed',payload:'no usable live snapshot'})}
  }finally{polling=false}
}
async function loadVersion(){
  const v=await jsonOrEmpty(CONTRACT.version);const label=document.querySelector('.build-tag');if(label)label.textContent=v.fe?`EDGE ${v.fe}`:'EDGE LIVE';document.title=v.fe?`HPRadar Atlas Edge · FE v${v.fe}`:'HPRadar Atlas Edge';
}

function bootstrap(){
  try{if(simulationTimer){clearInterval(simulationTimer);simulationTimer=null}}catch(_){}
  try{startSimulation=()=>{}}catch(_){}
  TRACK_HISTORY.clear();
  DATA.splice(0,DATA.length);ALL_ENTITIES.splice(0,ALL_ENTITIES.length);
  state.selected=null;state.kind='aircraft';state.collectionScope=null;state.tabByKind.aircraft='visible';state.headerContext=state.collectionOpen?'aircraft':'overview';state.follow=false;state.trailFocus=null;state.observedSource=null;state.mlatFocus=null;
  Object.assign(state.layers,{aircraft:true,vessel:false,aton:false,station:false,source:false,coverage:false,trails:true,airports:false,seaports:false,flightRoutes:false,seaLanes:false,wind:false,waterLevel:false,tide:false,labels:true,mlatTopology:false});
  repaint();bindMapBridge();loadVersion();refreshContext();tick();
  airTimer=setInterval(tick,1000);contextTimer=setInterval(refreshContext,10000);
  window.addEventListener('beforeunload',()=>{clearInterval(airTimer);clearInterval(contextTimer)},{once:true});
}
try{bootstrap()}catch(error){reportError('Atlas bridge bootstrap',error);throw error}
})();
