/* HPRadar Edge operator parity layer.
 * Scope: <=400 aircraft, no clustering/LOD.
 * Adds the high-value tar1090 capabilities without turning Edge into tar1090:
 * filters/sort/presets, URL state, panel units, real readsb all-tracks,
 * range rings + actual reception outline, and station health.
 */
(()=>{'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={
  type:'',altMin:'',altMax:'',source:'all',sort:'seen',units:'nautical',preset:'',
  rings:true,outline:true,allTracks:false,trackMinutes:60,ids:[],data:new Map(),station:null,
  selectedFromUrl:null,lastUrl:'',health:null,allTrackRun:0
};
const num=v=>Number.isFinite(Number(v))?Number(v):null;
const upper=v=>String(v||'').trim().toUpperCase();
const sourceGroup=a=>a.isMlat?'mlat':String(a.source||'').toLowerCase().includes('mode')?'modes':String(a.source||'').toLowerCase().includes('tisb')?'tisb':'adsb';
const isEmergency=a=>['7500','7600','7700'].includes(String(a.squawk||''))||(a.emergency&&String(a.emergency).toLowerCase()!=='none');
const isRotor=a=>!!window.HPRAircraftRenderer?.isRotorcraft?.(a);
function distanceNm(a){
  if(!state.station||a.latitude==null||a.longitude==null)return Infinity;
  const r=3440.065,toRad=x=>x*Math.PI/180,p1=toRad(state.station.lat),p2=toRad(a.latitude),dp=toRad(a.latitude-state.station.lat),dl=toRad(a.longitude-state.station.lon);
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 2*r*Math.asin(Math.min(1,Math.sqrt(h)));
}
function match(a){
  if(!a)return false;
  const alt=a.isGround?0:num(a.barometricAltitudeFt);
  if(state.type&&!upper(a.typeCode).includes(upper(state.type)))return false;
  if(state.altMin!==''&&(alt==null||alt<Number(state.altMin)))return false;
  if(state.altMax!==''&&(alt==null||alt>Number(state.altMax)))return false;
  if(state.source!=='all'&&sourceGroup(a)!==state.source)return false;
  if(state.preset==='emergency'&&!isEmergency(a))return false;
  if(state.preset==='rotor'&&!isRotor(a))return false;
  if(state.preset==='low'&&(a.isGround||alt==null||alt>5000))return false;
  return true;
}
function compare(a,b){
  if(state.sort==='callsign')return String(a.callsign||a.registration||a.id).localeCompare(String(b.callsign||b.registration||b.id));
  if(state.sort==='altitude')return (num(b.barometricAltitudeFt)??-Infinity)-(num(a.barometricAltitudeFt)??-Infinity);
  if(state.sort==='distance')return distanceNm(a)-distanceNm(b);
  return (num(a.seenSec)??Infinity)-(num(b.seenSec)??Infinity);
}
function buildUi(){
  const collection=$('#collection'),tabs=$('#tabs');if(!collection||!tabs||$('#hprOpsBar'))return;
  const bar=document.createElement('div');bar.id='hprOpsBar';bar.innerHTML=`
    <div class="hpr-presets"><button data-preset="emergency">Emergency</button><button data-preset="rotor">Rotor</button><button data-preset="low">Low &lt;5k</button><button id="hprFilterToggle">Filter</button></div>
    <div id="hprFilterDrawer" hidden>
      <div class="hpr-grid"><label>Type<input id="hprType" placeholder="A32 / B738 / R44"></label><label>Source<select id="hprSource"><option value="all">All</option><option value="adsb">ADS-B</option><option value="mlat">MLAT</option><option value="modes">Mode-S</option><option value="tisb">TIS-B</option></select></label><label>Alt min<input id="hprAltMin" type="number" step="500" placeholder="ft"></label><label>Alt max<input id="hprAltMax" type="number" step="500" placeholder="ft"></label><label>Sort<select id="hprSort"><option value="seen">Seen</option><option value="callsign">Callsign</option><option value="altitude">Altitude ↓</option><option value="distance">Distance</option></select></label><label>Units<select id="hprUnits"><option value="nautical">Aviation</option><option value="metric">Metric</option></select></label></div>
      <div class="hpr-actions"><button id="hprClear">Clear</button><button id="hprAllTracks">All tracks</button><select id="hprTrackMinutes" title="All tracks window"><option value="30">30m</option><option value="60" selected>60m</option><option value="120">120m</option></select><button id="hprCoverage">Coverage</button></div>
    </div>`;
  tabs.after(bar);
  const st=document.createElement('style');st.textContent=`
  #hprOpsBar{border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--s2) 72%,transparent)}
  .hpr-presets{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:5px}.hpr-presets button,.hpr-actions button{min-height:28px;border:1px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text2);font-size:9px;font-weight:700}.hpr-presets button.on,.hpr-actions button.on{border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--surface))}
  #hprFilterDrawer{padding:5px 7px 7px;border-top:1px solid var(--border)}.hpr-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}.hpr-grid label{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.35px}.hpr-grid input,.hpr-grid select{display:block;width:100%;height:28px;margin-top:2px;border:1px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text);padding:0 6px;font:10px system-ui}.hpr-actions{display:grid;grid-template-columns:.75fr 1fr .62fr .9fr;gap:5px;margin-top:6px}.hpr-actions select{min-width:0;height:28px;border:1px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text2);padding:0 3px;font:9px system-ui}
  #hprHealth{border-top:1px solid var(--border);padding:10px 12px}.hpr-health-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 10px}.hpr-health-grid span:nth-child(odd){color:var(--muted)}.hpr-health-grid span:nth-child(even){text-align:right}.hpr-health-ok{color:var(--live)}.hpr-health-warn{color:var(--aging)}
  `;document.head.appendChild(st);
  $('#hprFilterToggle').onclick=()=>{const d=$('#hprFilterDrawer');d.hidden=!d.hidden;$('#hprFilterToggle').classList.toggle('on',!d.hidden)};
  $$('[data-preset]').forEach(b=>b.onclick=()=>{state.preset=state.preset===b.dataset.preset?'':b.dataset.preset;syncControls();applyAll(true)});
  for(const [id,key] of [['#hprType','type'],['#hprAltMin','altMin'],['#hprAltMax','altMax']])$(id).oninput=e=>{state[key]=e.target.value;applyAll(true)};
  for(const [id,key] of [['#hprSource','source'],['#hprSort','sort'],['#hprUnits','units']])$(id).onchange=e=>{state[key]=e.target.value;applyAll(true)};
  $('#hprClear').onclick=()=>{Object.assign(state,{type:'',altMin:'',altMax:'',source:'all',sort:'seen',preset:''});syncControls();applyAll(true)};
  $('#hprAllTracks').onclick=()=>{state.allTracks=!state.allTracks;$('#hprAllTracks').classList.toggle('on',state.allTracks);if(state.allTracks)loadAllTracks();else clearAllTracks();updateUrl()};
  $('#hprTrackMinutes').onchange=e=>{const n=Number(e.target.value);state.trackMinutes=[30,60,120].includes(n)?n:60;if(state.allTracks)loadAllTracks();updateUrl()};
  $('#hprCoverage').onclick=()=>{state.rings=!state.rings;state.outline=state.rings;$('#hprCoverage').classList.toggle('on',state.rings);renderCoverage();updateUrl()};
  syncControls();
}
function syncControls(){
  const map={hprType:'type',hprAltMin:'altMin',hprAltMax:'altMax',hprSource:'source',hprSort:'sort',hprUnits:'units'};for(const [id,key] of Object.entries(map)){const e=$('#'+id);if(e)e.value=state[key]}
  $$('[data-preset]').forEach(b=>b.classList.toggle('on',state.preset===b.dataset.preset));
  $('#hprAllTracks')?.classList.toggle('on',state.allTracks);if($('#hprTrackMinutes'))$('#hprTrackMinutes').value=String(state.trackMinutes);$('#hprCoverage')?.classList.toggle('on',state.rings);
}
async function snapshot(){
  try{const r=await fetch('/api/air/v1',{cache:'no-store'});if(!r.ok)return;const j=await r.json();const rows=window.HPRAirWire?.adaptEnvelope?.(j)?.aircraft||[];state.data=new Map(rows.map(a=>[a.id,a]));state.ids=rows.filter(match).sort(compare).map(a=>a.id);applyRows();applyMapFilter();applyUnits();resolveDeepLink()}catch(_){}
}
function applyRows(){
  const list=$('#airList');if(!list)return;const wanted=new Set(state.ids);const rows=$$('#airList .row[data-id]');for(const r of rows)r.hidden=!wanted.has(r.dataset.id);
  const byId=new Map(rows.map(r=>[r.dataset.id,r]));for(const id of state.ids){const r=byId.get(id);if(r&&r!==list.lastElementChild)list.appendChild(r)}
  const c=$('#listCount');if(c)c.textContent=`${state.ids.length} shown`;
}
function applyMapFilter(){
  const map=window.HPREdgeMap;if(!map?.isStyleLoaded?.())return;const f=state.ids.length?['in',['get','id'],['literal',state.ids]]:['==',['get','id'],'__none__'];
  for(const id of ['aircraft-symbol','aircraft-label','aircraft-hit'])try{if(map.getLayer(id))map.setFilter(id,f)}catch(_){}
}
function applyUnits(){
  if(state.units!=='metric')return;
  for(const row of $$('#airList .row[data-id]:not([hidden])')){const a=state.data.get(row.dataset.id);if(!a)continue;const alt=row.querySelector('.kpi b'),spd=row.querySelector('.kpi small');if(alt&&!a.isGround&&num(a.barometricAltitudeFt)!=null)alt.textContent=`${Math.round(a.barometricAltitudeFt*0.3048).toLocaleString()} m`;if(spd&&num(a.groundSpeedKt)!=null)spd.textContent=`${Math.round(a.groundSpeedKt*1.852)} km/h`}
  const d=$('#detailBody');if(!d)return;const selected=$('#airList .row.selected')?.dataset.id,a=state.data.get(selected);if(!a)return;for(const m of $$('#detailBody .metric')){const k=m.querySelector('small')?.textContent.trim(),v=m.querySelector('b');if(!v)continue;if(k==='Altitude'&&!a.isGround&&num(a.barometricAltitudeFt)!=null)v.textContent=`${Math.round(a.barometricAltitudeFt*0.3048).toLocaleString()} m`;if(k==='Ground speed'&&num(a.groundSpeedKt)!=null)v.textContent=`${(a.groundSpeedKt*1.852).toFixed(1)} km/h`;if(k==='Vertical rate'&&num(a.barometricRateFpm)!=null)v.textContent=`${(a.barometricRateFpm*0.00508).toFixed(1)} m/s`}
}
function applyAll(url=false){applyRows();applyMapFilter();applyUnits();if(url)updateUrl()}
function readUrl(){
  const q=new URLSearchParams(location.search);state.type=q.get('type')||'';state.altMin=q.get('altMin')||'';state.altMax=q.get('altMax')||'';state.source=q.get('source')||'all';state.sort=q.get('sort')||'seen';state.units=q.get('units')||'nautical';state.preset=q.get('preset')||'';state.selectedFromUrl=(q.get('icao')||'').toLowerCase()||null;state.allTracks=q.get('allTracks')==='1';const tm=Number(q.get('tracks'));state.trackMinutes=[30,60,120].includes(tm)?tm:60;state.rings=q.get('coverage')!=='0';
  const z=num(q.get('zoom')),lat=num(q.get('lat')),lon=num(q.get('lon'));const wait=setInterval(()=>{const m=window.HPREdgeMap;if(!m)return;clearInterval(wait);if(lat!=null&&lon!=null)m.jumpTo({center:[lon,lat],zoom:z??m.getZoom()});m.on('moveend',updateUrl);renderCoverage()},200);
}
function resolveDeepLink(){if(!state.selectedFromUrl)return;const row=document.querySelector(`#airList .row[data-id="${CSS.escape(state.selectedFromUrl)}"]`);if(row){state.selectedFromUrl=null;row.click()}}
function updateUrl(){
  const q=new URLSearchParams();if(state.type)q.set('type',state.type);if(state.altMin!=='')q.set('altMin',state.altMin);if(state.altMax!=='')q.set('altMax',state.altMax);if(state.source!=='all')q.set('source',state.source);if(state.sort!=='seen')q.set('sort',state.sort);if(state.units!=='nautical')q.set('units',state.units);if(state.preset)q.set('preset',state.preset);if(state.allTracks)q.set('allTracks','1');if(state.trackMinutes!==60)q.set('tracks',String(state.trackMinutes));if(!state.rings)q.set('coverage','0');const sel=$('#airList .row.selected')?.dataset.id;if(sel)q.set('icao',sel);const m=window.HPREdgeMap;if(m){const c=m.getCenter();q.set('lat',c.lat.toFixed(4));q.set('lon',c.lng.toFixed(4));q.set('zoom',m.getZoom().toFixed(2))}const s=q.toString(),u=location.pathname+(s?'?'+s:'');if(u!==state.lastUrl){state.lastUrl=u;history.replaceState(null,'',u)}}
function circle(lon,lat,nm,steps=96){const r=6371,km=nm*1.852,d=km/r,p=lat*Math.PI/180,l=lon*Math.PI/180,out=[];for(let i=0;i<=steps;i++){const b=2*Math.PI*i/steps,pp=Math.asin(Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(b)),ll=l+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(pp));out.push([ll*180/Math.PI,pp*180/Math.PI])}return out}
async function station(){try{const r=await fetch('/api/readsb/station.json',{cache:'no-store'}),j=await r.json();if(num(j.lat)!=null&&num(j.lon)!=null)state.station={lat:Number(j.lat),lon:Number(j.lon),name:j.name||'Receiver'}}catch(_){}renderCoverage()}
async function ensureCoverageLayers(){const m=window.HPREdgeMap;if(!m?.isStyleLoaded?.())return false;const empty={type:'FeatureCollection',features:[]};try{if(!m.getSource('hpr-range-rings'))m.addSource('hpr-range-rings',{type:'geojson',data:empty});if(!m.getLayer('hpr-range-rings'))m.addLayer({id:'hpr-range-rings',type:'line',source:'hpr-range-rings',paint:{'line-color':'#59ddff','line-width':1,'line-opacity':.35,'line-dasharray':[3,3]}});if(!m.getSource('hpr-actual-range'))m.addSource('hpr-actual-range',{type:'geojson',data:empty});if(!m.getLayer('hpr-actual-range'))m.addLayer({id:'hpr-actual-range',type:'line',source:'hpr-actual-range',paint:{'line-color':'#42dfa3','line-width':2,'line-opacity':.8}});return true}catch(_){return false}}
async function renderCoverage(){if(!await ensureCoverageLayers()||!state.station)return;const m=window.HPREdgeMap,empty={type:'FeatureCollection',features:[]};const rings=state.rings?{type:'FeatureCollection',features:[50,100,150,200].map(n=>({type:'Feature',properties:{nm:n},geometry:{type:'LineString',coordinates:circle(state.station.lon,state.station.lat,n)}}))}:empty;m.getSource('hpr-range-rings')?.setData(rings);if(!state.outline){m.getSource('hpr-actual-range')?.setData(empty);return}try{const r=await fetch('/api/readsb/outline.json',{cache:'no-store'});if(!r.ok)throw 0;const j=await r.json(),p=j?.actualRange?.last24h?.points||[],coords=p.map(x=>[Number(x[1]),Number(x[0])]).filter(x=>Number.isFinite(x[0])&&Number.isFinite(x[1]));m.getSource('hpr-actual-range')?.setData(coords.length>2?{type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[...coords,coords[0]]}}]}:empty)}catch(_){m.getSource('hpr-actual-range')?.setData(empty)}}
function traceUrl(id){return`/data/traces/${id.slice(-2)}/trace_recent_${id}.json`}
function normTrace(j,mins){const base=Number(j?.timestamp||0),cut=Date.now()/1000-mins*60;if(!base||!Array.isArray(j.trace))return[];return j.trace.map(p=>({ts:base+Number(p?.[0]||0),lat:Number(p?.[1]),lon:Number(p?.[2])})).filter(p=>p.ts>=cut&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)).map(p=>[p.lon,p.lat])}
async function ensureAllTracks(){const m=window.HPREdgeMap;if(!m?.isStyleLoaded?.())return false;const empty={type:'FeatureCollection',features:[]};try{if(!m.getSource('hpr-all-tracks'))m.addSource('hpr-all-tracks',{type:'geojson',data:empty});if(!m.getLayer('hpr-all-tracks'))m.addLayer({id:'hpr-all-tracks',type:'line',source:'hpr-all-tracks',paint:{'line-color':'#6fb7cf','line-width':1.15,'line-opacity':.42}});return true}catch(_){return false}}
async function loadAllTracks(){const run=++state.allTrackRun;if(!await ensureAllTracks())return;const ids=[...state.data.values()].filter(match).map(a=>a.id).slice(0,400),features=[];let i=0;async function worker(){while(i<ids.length){const id=ids[i++];try{const r=await fetch(traceUrl(id),{cache:'no-store'});if(!r.ok)continue;const c=normTrace(await r.json(),state.trackMinutes);if(c.length>1)features.push({type:'Feature',properties:{id},geometry:{type:'LineString',coordinates:c}})}catch(_){}if(run!==state.allTrackRun)return}}await Promise.all(Array.from({length:Math.min(8,ids.length)},worker));if(run!==state.allTrackRun||!state.allTracks)return;window.HPREdgeMap?.getSource('hpr-all-tracks')?.setData({type:'FeatureCollection',features})}
function clearAllTracks(){state.allTrackRun++;try{window.HPREdgeMap?.getSource('hpr-all-tracks')?.setData({type:'FeatureCollection',features:[]})}catch(_){}}
async function health(){
  const [stats,status]=await Promise.all([fetch('/data/stats.json',{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({})),fetch('/api/readsb/status.json',{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}))]);
  state.health={stats,status,wire:window.HPRAirWire?.stats?.()||{}};decorateHealth();
}
function decorateHealth(){const d=$('#detailBody');if(!d||!state.health||$('#hprHealth'))return;const title=d.querySelector('.detail-title b')?.textContent||'';if(!d.textContent.includes('Capabilities')&&!/receiver|station/i.test(title))return;const h=state.health,wire=h.wire||{},s=h.stats||{},st=h.status||{};const accepted=num(s?.last1min?.local?.accepted?.[0])??num(s?.last1min?.accepted?.[0]);const dropped=num(s?.last1min?.local?.samples_dropped)??num(s?.last1min?.samples_dropped)??0;const uptime=num(st.uptime)??(num(s?.total?.end)!=null&&num(s?.total?.start)!=null?num(s.total.end)-num(s.total.start):null);const el=document.createElement('div');el.id='hprHealth';el.innerHTML=`<h3>EDGE HEALTH</h3><div class="hpr-health-grid"><span>AirWire</span><span class="${wire.connected?'hpr-health-ok':'hpr-health-warn'}">${wire.connected?'LIVE':'OFFLINE'} · ${wire.frames||0} frames</span><span>Tracked</span><span>${wire.aircraft??'—'} / 400</span><span>Accepted</span><span>${accepted==null?'—':accepted.toFixed(0)+'/s'}</span><span>Dropped</span><span class="${dropped>0?'hpr-health-warn':'hpr-health-ok'}">${dropped}</span><span>Uptime</span><span>${uptime==null?'—':Math.floor(uptime/3600)+'h '+Math.floor((uptime%3600)/60)+'m'}</span><span>Coverage</span><span class="hpr-health-ok">outline.json · 24h</span></div>`;d.appendChild(el)}
function observe(){
  const detail=$('#detailBody');if(detail)new MutationObserver(()=>{applyUnits();decorateHealth();updateUrl()}).observe(detail,{childList:true,subtree:true});
  setInterval(snapshot,1000);setInterval(health,15000);setInterval(updateUrl,1500);setInterval(()=>{if(state.allTracks)loadAllTracks();if(state.rings)renderCoverage()},300000)
}
document.addEventListener('DOMContentLoaded',()=>{readUrl();buildUi();syncControls();station();snapshot();health();observe();setTimeout(()=>{if(state.allTracks)loadAllTracks()},2500)});
window.HPREdgeOps=Object.freeze({state:()=>({type:state.type,altMin:state.altMin,altMax:state.altMax,source:state.source,sort:state.sort,units:state.units,allTracks:state.allTracks,trackMinutes:state.trackMinutes,rings:state.rings}),reloadTracks:()=>state.allTracks&&loadAllTracks()});
})();
