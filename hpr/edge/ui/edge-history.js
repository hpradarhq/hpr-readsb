(()=>{'use strict';
/* Real readsb trace. Selecting an aircraft shows its trace immediately.
 * Replay is explicit and uses a compact timeline; positions are never synthesized.
 */
const EMPTY={type:'FeatureCollection',features:[]};
let map=null,selected=null,points=[],traceGeo=EMPTY,lastLoad=0,traceVisible=false,dockOpen=false;
let replayId=0,replaySpeed=5,replayIndex=0,replayStartedWall=0,replayStartedTs=0;
const $=s=>document.querySelector(s);
const fmtTime=ts=>new Date(ts*1000).toISOString().slice(11,19);
const num=v=>Number.isFinite(Number(v))?Number(v):null;
function captureMap(){
  if(!window.maplibregl?.Map||window.__HPR_MAP_CAPTURED)return;
  const Native=window.maplibregl.Map;
  window.maplibregl.Map=class extends Native{constructor(opts){super(opts);map=this;window.HPREdgeMap=this;this.on('style.load',()=>{ensureLayers();renderTrace();setReplayPoint(points[replayIndex]||null)})}};
  window.__HPR_MAP_CAPTURED=true;
}
function pointGeo(p){return p?{type:'FeatureCollection',features:[{type:'Feature',properties:{alt:p.alt??'',gs:p.gs??'',track:p.track??''},geometry:{type:'Point',coordinates:[p.lon,p.lat]}}]}:EMPTY}
function traceToGeo(list){const lines=[];let line=[];for(const p of list){if((p.flags&2)&&line.length>1){lines.push(line);line=[]}line.push([p.lon,p.lat])}if(line.length>1)lines.push(line);return{type:'FeatureCollection',features:lines.map((coordinates,i)=>({type:'Feature',properties:{leg:i+1},geometry:{type:'LineString',coordinates}}))}}
function ensureLayers(){
  if(!map?.isStyleLoaded?.())return;
  try{
    if(!map.getSource('hpr-readsb-trace'))map.addSource('hpr-readsb-trace',{type:'geojson',data:EMPTY});
    if(!map.getLayer('hpr-readsb-trace'))map.addLayer({id:'hpr-readsb-trace',type:'line',source:'hpr-readsb-trace',paint:{'line-color':'#25c8ff','line-width':['interpolate',['linear'],['zoom'],4,1.3,10,2.4],'line-opacity':.78}});
    if(!map.getSource('hpr-readsb-replay'))map.addSource('hpr-readsb-replay',{type:'geojson',data:EMPTY});
    if(!map.getLayer('hpr-readsb-replay'))map.addLayer({id:'hpr-readsb-replay',type:'circle',source:'hpr-readsb-replay',paint:{'circle-radius':4,'circle-color':'#25c8ff','circle-opacity':.92,'circle-stroke-width':0}});
  }catch(e){console.warn('HPR trace layers',e)}
}
function renderTrace(){ensureLayers();try{map?.getSource('hpr-readsb-trace')?.setData(traceVisible?traceGeo:EMPTY)}catch(_){}}
function setReplayPoint(p){ensureLayers();try{map?.getSource('hpr-readsb-replay')?.setData(p?pointGeo(p):EMPTY)}catch(_){}}
function traceUrl(id,kind){return`/data/traces/${id.slice(-2)}/trace_${kind}_${id}.json`}
async function getJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(String(r.status));return r.json()}
function normalizeTrace(j){const base=Number(j?.timestamp||0);if(!base||!Array.isArray(j?.trace))return[];return j.trace.map(p=>({ts:base+Number(p?.[0]||0),lat:Number(p?.[1]),lon:Number(p?.[2]),alt:p?.[3],gs:p?.[4],track:p?.[5],flags:Number(p?.[6]||0),vr:p?.[7]})).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon))}
function mergePoints(parts){const m=new Map();for(const list of parts)for(const p of list)m.set(`${p.ts.toFixed(3)}:${p.lat.toFixed(5)}:${p.lon.toFixed(5)}`,p);return[...m.values()].sort((a,b)=>a.ts-b.ts)}
function status(t){const e=$('#hprTraceStatus');if(e)e.textContent=t}
function setDock(on){
  dockOpen=!!on;const e=$('#hprTraceDock');if(e)e.hidden=!dockOpen;
  if(dockOpen){traceVisible=true;renderTrace();syncTimeline();$('#detail')?.classList.remove('open')}else stopReplay(true)
}
async function loadTrace(id,force=false){
  if(!id)return;if(!force&&id===selected&&Date.now()-lastLoad<12000)return;
  selected=id;lastLoad=Date.now();stopReplay(false);status('loading…');
  const results=await Promise.allSettled([getJson(traceUrl(id,'full')),getJson(traceUrl(id,'recent'))]);if(id!==selected)return;
  const good=results.filter(x=>x.status==='fulfilled').map(x=>normalizeTrace(x.value));points=mergePoints(good);traceGeo=traceToGeo(points);replayIndex=Math.max(0,points.length-1);
  traceVisible=true;renderTrace();setReplayPoint(null);syncTimeline();
  if(points.length){const mins=Math.max(0,(points.at(-1).ts-points[0].ts)/60);status(`${points.length} pts · ${mins.toFixed(mins<10?1:0)} min`)}else status('trace warming up')
}
function fitTrace(){if(!map||!points.length)return;const b=new maplibregl.LngLatBounds();points.forEach(p=>b.extend([p.lon,p.lat]));map.fitBounds(b,{padding:{top:70,bottom:110,left:90,right:90},maxZoom:11,duration:400})}
function syncTimeline(){const r=$('#hprTimeline'),start=$('#hprTimeStart'),now=$('#hprTimeNow'),end=$('#hprTimeEnd');if(!r)return;r.max=Math.max(0,points.length-1);r.value=Math.min(replayIndex,Math.max(0,points.length-1));r.disabled=points.length<2;if(points.length){start.textContent=fmtTime(points[0].ts);end.textContent=fmtTime(points.at(-1).ts);now.textContent=fmtTime(points[replayIndex]?.ts||points[0].ts)}else start.textContent=now.textContent=end.textContent='--:--:--'}
function scrub(i,center=false){if(!points.length)return;replayIndex=Math.max(0,Math.min(points.length-1,Number(i)||0));const p=points[replayIndex];setReplayPoint(p);syncTimeline();const alt=p.alt==='ground'?'GND':num(p.alt)!=null?`${Math.round(Number(p.alt)).toLocaleString()} ft`:'—',gs=num(p.gs)!=null?`${Math.round(Number(p.gs))} kt`:'—';status(`${fmtTime(p.ts)} · ${alt} · ${gs}`);if(center&&map)p&&map.easeTo({center:[p.lon,p.lat],duration:120})}
function stopReplay(clear=false){if(replayId)cancelAnimationFrame(replayId);replayId=0;const b=$('#hprReplayBtn');if(b)b.textContent='▶ Play';if(clear)setReplayPoint(null)}
function startReplay(fromCurrent=true){
  if(points.length<2)return;traceVisible=true;renderTrace();setDock(true);stopReplay(false);if(!fromCurrent||replayIndex>=points.length-1)replayIndex=0;
  replayStartedWall=performance.now();replayStartedTs=points[replayIndex].ts;const btn=$('#hprReplayBtn');if(btn)btn.textContent='❚❚ Pause';
  function frame(now){if(!replayId)return;const target=replayStartedTs+(now-replayStartedWall)/1000*replaySpeed;while(replayIndex+1<points.length&&points[replayIndex+1].ts<=target)replayIndex++;scrub(replayIndex,false);if(replayIndex>=points.length-1){stopReplay(false);status('Replay complete');return}replayId=requestAnimationFrame(frame)}
  replayId=requestAnimationFrame(frame)
}
function toggleReplay(){replayId?stopReplay(false):startReplay(true)}
function showFor(id){if(id&&id!==selected)return loadTrace(id,true);traceVisible=true;renderTrace();return Promise.resolve()}
function replayFor(id){if(id&&id!==selected){loadTrace(id,true).then(()=>{setDock(true);startReplay(false)})}else{setDock(true);startReplay(false)}}
function buildDock(){
  if($('#hprTraceDock'))return;const d=document.createElement('section');d.id='hprTraceDock';d.hidden=true;d.innerHTML=`<div class="hpr-trace-row"><div class="hpr-trace-title"><b>REPLAY</b><span id="hprTraceStatus">—</span></div><span id="hprTimeStart">--:--:--</span><input id="hprTimeline" type="range" min="0" max="0" value="0" step="1"><span id="hprTimeEnd">--:--:--</span><b id="hprTimeNow">--:--:--</b><button id="hprTraceFit">Fit</button><button id="hprReplayBtn">▶ Play</button><select id="hprReplaySpeed"><option value="1">1×</option><option value="5" selected>5×</option><option value="10">10×</option><option value="20">20×</option><option value="40">40×</option></select><button id="hprTraceClose">×</button></div>`;document.body.appendChild(d);
  const st=document.createElement('style');st.textContent=`#hprTraceDock{position:fixed;z-index:74;left:calc(86px + var(--list) + 12px);right:56px;bottom:10px;padding:7px 9px;background:color-mix(in srgb,var(--solid) 95%,transparent);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow);backdrop-filter:blur(14px)}#hprTraceDock[hidden]{display:none}.hpr-trace-row{display:grid;grid-template-columns:minmax(115px,auto) 48px minmax(120px,1fr) 48px 54px auto auto auto auto;gap:6px;align-items:center}.hpr-trace-title{min-width:0}.hpr-trace-title b,.hpr-trace-title span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hpr-trace-title b{font-size:9px;color:var(--accent);letter-spacing:.6px}.hpr-trace-title span,#hprTraceDock>div>span{font-size:9px;color:var(--muted)}#hprTraceDock input{width:100%;accent-color:var(--accent)}#hprTraceDock button,#hprTraceDock select{height:27px;border:1px solid var(--border);border-radius:5px;background:var(--s2);color:var(--text);font:9px system-ui;padding:0 7px}#hprTimeNow{font:9px system-ui;color:var(--text2);text-align:right}@media(max-width:900px){#hprTraceDock{left:86px;right:10px}.hpr-trace-row{grid-template-columns:80px 1fr auto auto auto}.hpr-trace-row>#hprTimeStart,.hpr-trace-row>#hprTimeEnd,.hpr-trace-row>#hprTimeNow,.hpr-trace-row>#hprTraceFit{display:none}}@media(max-width:680px){#hprTraceDock{left:6px;right:6px;bottom:74px}.hpr-trace-row{grid-template-columns:68px 1fr auto auto}.hpr-trace-row>#hprReplaySpeed{display:none}}`;document.head.appendChild(st);
  $('#hprTraceFit').onclick=fitTrace;$('#hprReplayBtn').onclick=toggleReplay;$('#hprReplaySpeed').onchange=e=>replaySpeed=Number(e.target.value)||5;$('#hprTraceClose').onclick=()=>setDock(false);$('#hprTimeline').oninput=e=>{stopReplay(false);scrub(Number(e.target.value),false)};$('#hprTimeline').onchange=e=>scrub(Number(e.target.value),true)
}
function selectedFromDom(){return document.querySelector('#airList .row.selected')?.dataset?.id||null}
function watchSelection(){setInterval(()=>{const id=selectedFromDom();if(id&&id!==selected){loadTrace(id,true)}else if(!id&&selected){selected=null;points=[];traceGeo=EMPTY;replayIndex=0;stopReplay(true);traceVisible=false;renderTrace();setDock(false)}else if(id&&Date.now()-lastLoad>15000&&!replayId)loadTrace(id,true)},700)}
captureMap();
document.addEventListener('DOMContentLoaded',()=>{buildDock();watchSelection()},{once:true});
window.addEventListener('hpr:history:show',e=>showFor(String(e.detail?.id||selectedFromDom()||'').toLowerCase()));
window.addEventListener('hpr:history:replay',e=>replayFor(String(e.detail?.id||selectedFromDom()||'').toLowerCase()));
window.HPREdgeHistory=Object.freeze({show:()=>showFor(selectedFromDom()),play:()=>replayFor(selectedFromDom()),hide:()=>setDock(false),fit:fitTrace,state:()=>({selected,points:points.length,replayIndex,replaySpeed,dockOpen,traceVisible})});
})();