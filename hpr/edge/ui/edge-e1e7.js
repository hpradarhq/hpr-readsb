/* HPRadar Edge E1-E7 UX layer.
 * Edge scope is deliberately <=400 aircraft: full fidelity, no cluster, no LOD.
 * E1 selected-aircraft actions; E2 operator filters; E4 selected silhouette emphasis;
 * E5 station-health summary. E3 replay is implemented in edge-history.js.
 */
(()=>{'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const CAPACITY=Number(window.HPR_CONFIG?.edgeCapacity)||400;
const quick=new Set();
let countryFilter='',squawkFilter='',airMap=new Map(),followId=null,applyQueued=false,lastAircraftCount=0;
const MIL_TYPES=new Set([
  'A10','A400','A4','A6','A7','AN12','AN26','AN72','B1','B2','B52','BE20','C130','C17','C2','C27J','C30J','C5M','C5','C6','E2','E3CF','E6','EUFI','F15','F16','F18','F22','F35','F5','H47','H53','H60','HAWK','IL76','KC10','K35R','KC46','M346','MIG2','MIR2','P3','P8','Q4','R135','RQ4','SU27','T38','TEX2','V22','VULC'
]);
const num=v=>Number.isFinite(Number(v))?Number(v):null;
const upper=v=>String(v||'').trim().toUpperCase();
const selectedId=()=>document.querySelector('#airList .row.selected')?.dataset.id||null;
const countryOf=id=>window.HPREdgeMeta?.country?.(id)||null;
const isEmergency=a=>['7500','7600','7700'].includes(String(a?.squawk||''))||(a?.emergency&&String(a.emergency).toLowerCase()!=='none');
const isRotor=a=>!!window.HPRAircraftRenderer?.isRotorcraft?.(a);
function isMilitary(a){
  if(!a)return false;
  if((Number(a.dbFlags)||0)&1)return true;
  const t=upper(a.typeCode);if(!t)return false;
  if(MIL_TYPES.has(t))return true;
  return /^(F1[4568]|F2[235]|F35|SU\d|MIG\d|C1(30|7)|KC\d|RQ\d|MQ\d|AH\d|UH\d|CH\d)/.test(t);
}
function extraMatch(a){
  if(!a)return false;
  if(quick.has('emergency')&&!isEmergency(a))return false;
  if(quick.has('rotor')&&!isRotor(a))return false;
  if(quick.has('low')){const alt=a.isGround?null:num(a.barometricAltitudeFt);if(alt==null||alt>5000)return false}
  if(quick.has('military')&&!isMilitary(a))return false;
  if(countryFilter){const c=countryOf(a.id);if(!c||c.code!==countryFilter)return false}
  if(squawkFilter&&String(a.squawk||'').replace(/^0+/, '')!==squawkFilter.replace(/^0+/, ''))return false;
  return true;
}
async function refreshSnapshot(){
  try{
    const r=await fetch('/api/air/v1',{cache:'no-store'});if(!r.ok)return;
    const snap=window.HPRAirWire?.adaptEnvelope?.(await r.json());if(!snap)return;
    airMap=new Map((snap.aircraft||[]).map(a=>[a.id,a]));lastAircraftCount=airMap.size;
    refreshCountries();queueApply();decorateDetail();renderHealth();
  }catch(_){}
}
function refreshCountries(){
  const sel=$('#hprCountry');if(!sel)return;
  const old=countryFilter,seen=new Map();
  for(const a of airMap.values()){const c=countryOf(a.id);if(c)seen.set(c.code,c)}
  const rows=[...seen.values()].sort((a,b)=>a.name.localeCompare(b.name));
  const html=['<option value="">All countries</option>',...rows.map(c=>`<option value="${c.code}">${c.flag} ${c.name}</option>`)].join('');
  if(sel.dataset.signature!==html){sel.innerHTML=html;sel.dataset.signature=html;sel.value=old}
}
function replaceQuickBar(){
  const bar=$('#hprOpsBar .hpr-presets');if(!bar||bar.dataset.e2)return;
  bar.dataset.e2='1';
  bar.innerHTML=`<button data-hpr-quick="emergency">Emergency</button><button data-hpr-quick="rotor">Rotor</button><button data-hpr-quick="low">Low &lt;5k</button><button data-hpr-quick="military">Military</button><button id="hprFilterToggleE2">Filter</button>`;
  bar.style.gridTemplateColumns='repeat(5,1fr)';
  $$('[data-hpr-quick]').forEach(b=>b.onclick=()=>{const k=b.dataset.hprQuick;quick.has(k)?quick.delete(k):quick.add(k);syncQuick();queueApply();updateExtraUrl()});
  $('#hprFilterToggleE2').onclick=()=>{const d=$('#hprFilterDrawer');if(!d)return;d.hidden=!d.hidden;$('#hprFilterToggleE2').classList.toggle('on',!d.hidden)};
}
function extendDrawer(){
  const grid=$('#hprFilterDrawer .hpr-grid');if(!grid||$('#hprCountry'))return;
  const country=document.createElement('label');country.innerHTML='Country<select id="hprCountry"><option value="">All countries</option></select>';
  const squawk=document.createElement('label');squawk.innerHTML='Squawk<input id="hprSquawk" inputmode="numeric" maxlength="4" placeholder="7500 / 7600 / 7700">';
  grid.append(country,squawk);
  $('#hprCountry').onchange=e=>{countryFilter=e.target.value;queueApply();updateExtraUrl()};
  $('#hprSquawk').oninput=e=>{squawkFilter=e.target.value.replace(/\D/g,'').slice(0,4);e.target.value=squawkFilter;queueApply();updateExtraUrl()};
}
function syncQuick(){
  $$('[data-hpr-quick]').forEach(b=>b.classList.toggle('on',quick.has(b.dataset.hprQuick)));
}
function queueApply(){if(applyQueued)return;applyQueued=true;queueMicrotask(()=>{applyQueued=false;applyExtra()})}
function applyExtra(){
  const rows=$$('#airList .row[data-id]'),visible=[];
  for(const row of rows){
    const a=airMap.get(row.dataset.id);
    const baseHidden=row.hidden&&row.dataset.hprExtraHidden!=='1';
    const extraHidden=!extraMatch(a);
    row.dataset.hprExtraHidden=extraHidden?'1':'0';
    row.hidden=baseHidden||extraHidden;
    if(!row.hidden)visible.push(row.dataset.id);
  }
  const map=window.HPREdgeMap;if(map?.isStyleLoaded?.()){
    const f=visible.length?['in',['get','id'],['literal',visible]]:['==',['get','id'],'__none__'];
    for(const id of ['aircraft-symbol','aircraft-label','aircraft-hit','aircraft-selected-emphasis'])try{if(map.getLayer(id))map.setFilter(id,id==='aircraft-selected-emphasis'?['all',f,['==',['get','selected'],1]]:f)}catch(_){}
  }
  const count=$('#listCount');if(count)count.textContent=`${visible.length} shown`;
}
function readExtraUrl(){
  const q=new URLSearchParams(location.search);countryFilter=q.get('country')||'';squawkFilter=q.get('squawk')||'';
  for(const k of ['emergency','rotor','low','military'])if(q.get(k)==='1')quick.add(k);
  const apply=()=>{replaceQuickBar();extendDrawer();syncQuick();if($('#hprCountry'))$('#hprCountry').value=countryFilter;if($('#hprSquawk'))$('#hprSquawk').value=squawkFilter;queueApply()};
  setTimeout(apply,0);setTimeout(apply,400);
}
function updateExtraUrl(){
  const u=new URL(location.href);for(const k of ['emergency','rotor','low','military'])quick.has(k)?u.searchParams.set(k,'1'):u.searchParams.delete(k);
  countryFilter?u.searchParams.set('country',countryFilter):u.searchParams.delete('country');squawkFilter?u.searchParams.set('squawk',squawkFilter):u.searchParams.delete('squawk');
  history.replaceState(null,'',u.pathname+(u.search?'?'+u.searchParams.toString():''));
}
function ensureSelectedLayer(){
  const map=window.HPREdgeMap;if(!map?.isStyleLoaded?.()||!map.getSource('aircraft')||map.getLayer('aircraft-selected-emphasis'))return;
  try{
    map.addLayer({id:'aircraft-selected-emphasis',type:'symbol',source:'aircraft',filter:['==',['get','selected'],1],layout:{'icon-image':['concat','aircraft-',['get','icon']],'icon-size':['interpolate',['linear'],['zoom'],5,.72,8,.92,12,1.20],'icon-rotate':['get','track'],'icon-rotation-alignment':'map','icon-allow-overlap':true},paint:{'icon-opacity':.34}},'aircraft-symbol');
  }catch(_){}
}
function icaoFromDetail(){
  for(const kv of $$('#detailBody .kv')){const cells=[...kv.children];for(let i=0;i<cells.length-1;i+=2)if(cells[i].textContent.trim()==='ICAO')return cells[i+1].textContent.trim().toLowerCase()}
  return null;
}
function actionButton(id,label){const b=document.createElement('button');b.id=id;b.className='hpr-detail-action';b.textContent=label;return b}
function decorateDetail(){
  const body=$('#detailBody');if(!body)return;const id=icaoFromDetail();if(!/^[0-9a-f]{6}$/.test(id||''))return;
  const head=body.querySelector('.detail-head');if(!head)return;
  let actions=body.querySelector('#hprDetailActions');if(!actions){
    actions=document.createElement('div');actions.id='hprDetailActions';actions.className='hpr-detail-actions';
    actions.append(actionButton('hprFollow','Follow'),actionButton('hprTrace','Trace'),actionButton('hprReplay','Replay'));
    head.after(actions);
  }
  $('#hprFollow').classList.toggle('on',followId===id);
  $('#hprFollow').onclick=()=>{followId=followId===id?null:id;decorateDetail()};
  $('#hprTrace').onclick=()=>window.dispatchEvent(new CustomEvent('hpr:history:show',{detail:{id}}));
  $('#hprReplay').onclick=()=>window.dispatchEvent(new CustomEvent('hpr:history:replay',{detail:{id}}));
  const a=airMap.get(id),c=countryOf(id),title=body.querySelector('.detail-title small');
  if(a&&title&&!title.dataset.e1){title.dataset.e1='1';title.textContent=[a.registration||id.toUpperCase(),a.typeCode||'Unknown type',c?.name].filter(Boolean).join(' · ')}
}
function followTick(){
  if(!followId)return;const a=airMap.get(followId),map=window.HPREdgeMap;if(!a?.coordinates||!map)return;
  const c=map.getCenter(),dx=Math.abs(c.lng-a.longitude),dy=Math.abs(c.lat-a.latitude);if(dx+dy<0.002)return;
  map.easeTo({center:a.coordinates,duration:450,essential:true});
}
function renderHealth(){
  const body=$('#detailBody');if(!body||icaoFromDetail())return;
  if(![...body.querySelectorAll('h3')].some(x=>x.textContent.trim()==='Capabilities'))return;
  let box=$('#hprE5Health');if(!box){box=document.createElement('div');box.id='hprE5Health';box.className='hpr-e5-health';const metric=body.querySelector('.metric-grid');metric?.after(box)}
  const s=window.HPRAirWire?.stats?.()||{},ratio=Math.min(1,(Number(s.aircraft)||lastAircraftCount)/CAPACITY),connected=!!s.connected;
  const level=!connected?'OFFLINE':ratio>.9?'HIGH LOAD':'GOOD',klass=!connected?'bad':ratio>.9?'warn':'good';
  box.innerHTML=`<div><small>EDGE HEALTH</small><b class="${klass}">${level}</b></div><div><small>Tracked</small><b>${Number(s.aircraft)||lastAircraftCount} / ${CAPACITY}</b></div><div><small>AirWire</small><b>${connected?'CONNECTED':'OFFLINE'}</b></div><div><small>Frames</small><b>${Number(s.frames||0).toLocaleString()}</b></div>`;
}
function installStyle(){
  if($('#hprE1E7Style'))return;const st=document.createElement('style');st.id='hprE1E7Style';st.textContent=`
  #hprOpsBar .hpr-presets{grid-template-columns:repeat(5,1fr)!important}.hpr-detail-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:7px 10px;border-bottom:1px solid var(--border);background:var(--s2)}.hpr-detail-action{height:32px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text2);font-size:10px;font-weight:750}.hpr-detail-action:hover,.hpr-detail-action.on{border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--surface))}.row.selected .plane-icon{transform:scale(1.12)}.hpr-e5-health{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border);border-bottom:1px solid var(--border)}.hpr-e5-health>div{padding:8px 10px;background:var(--surface)}.hpr-e5-health small,.hpr-e5-health b{display:block}.hpr-e5-health small{font-size:8px;color:var(--muted);letter-spacing:.5px}.hpr-e5-health b{margin-top:2px;font-size:11px}.hpr-e5-health .good{color:var(--live)}.hpr-e5-health .warn{color:var(--aging)}.hpr-e5-health .bad{color:var(--danger)}
  @media(max-width:680px){#hprOpsBar .hpr-presets{grid-template-columns:repeat(5,1fr)!important}.hpr-detail-actions{position:sticky;top:0;z-index:2}}
  `;document.head.appendChild(st)
}
function watchDom(){
  const list=$('#airList'),detail=$('#detailBody');if(list)new MutationObserver(()=>queueApply()).observe(list,{childList:true,subtree:false});if(detail)new MutationObserver(()=>{decorateDetail();renderHealth()}).observe(detail,{childList:true,subtree:true});
}
function init(){installStyle();readExtraUrl();watchDom();refreshSnapshot();setInterval(refreshSnapshot,1000);setInterval(()=>{ensureSelectedLayer();followTick();decorateDetail();renderHealth()},700)}
document.addEventListener('DOMContentLoaded',init,{once:true});
window.HPREdgeE1E7=Object.freeze({aircraft:id=>airMap.get(String(id||'').toLowerCase())||null,isMilitary,countryOf,quickFilters:()=>[...quick],capacity:CAPACITY});
})();
