/* HPRadar Edge persistent administration UI.
 * Configuration is stored by /api/admin in /data/hpr-edge.
 * All mutations require a six-digit PIN. Docker/nginx stay up; station/feeder
 * changes restart only the readsb child process.
 */
(()=>{'use strict';
const $=s=>document.querySelector(s);
let cfg=null,hookedMap=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,fallback=null)=>Number.isFinite(Number(v))?Number(v):fallback;
function uuid4(){
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
  const b=new Uint8Array(16);globalThis.crypto?.getRandomValues?.(b);
  if(!b.some(Boolean)){for(let i=0;i<16;i++)b[i]=Math.floor(Math.random()*256)}
  b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
async function api(op,payload){
  const r=await fetch(`/api/admin?op=${encodeURIComponent(op)}`,{method:payload?'POST':'GET',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined,cache:'no-store'});
  let j={};try{j=await r.json()}catch(_){j={ok:false,error:`HTTP ${r.status}`}}
  if(!r.ok||j.ok===false)throw new Error(j.error||`HTTP ${r.status}`);return j;
}
async function load(){cfg=await api('config');applyPersistentDisplay();return cfg}
function pin(){const p=$('#hprAdminPin')?.value||'';if(!/^\d{6}$/.test(p))throw new Error('Enter the 6-digit admin PIN');return p}
function msg(text,good=true){const e=$('#hprAdminMsg');if(!e)return;e.textContent=text;e.className=good?'good':'bad'}
function field(label,html,note=''){return `<label class="hpr-admin-field"><span>${label}</span>${html}${note?`<small>${note}</small>`:''}</label>`}
function circle(lon,lat,nm,steps=96){const r=6371,km=nm*1.852,d=km/r,p=lat*Math.PI/180,l=lon*Math.PI/180,out=[];for(let i=0;i<=steps;i++){const b=2*Math.PI*i/steps,pp=Math.asin(Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(b)),ll=l+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(pp));out.push([ll*180/Math.PI,pp*180/Math.PI])}return out}
function applyPersistentDisplay(){
  if(!cfg?.display)return;
  const el=$('#hprUnits');if(el&&el.value!==cfg.display.units){el.value=cfg.display.units;el.dispatchEvent(new Event('change',{bubbles:true}))}
  applyRings();
}
function applyRings(){
  const m=window.HPREdgeMap,d=cfg?.display,s=cfg?.station;if(!m?.isStyleLoaded?.()||!d||!s)return;
  try{
    const overlayVisible=window.HPREdgeOps?.state?.().rings!==false;
    if(m.getLayer('hpr-range-rings'))m.setLayoutProperty('hpr-range-rings','visibility','none');
    const features=[];if(d.ring_enabled&&Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.lon))){for(let i=1;i<=Number(d.ring_count||0);i++)features.push({type:'Feature',properties:{nm:i*Number(d.ring_step_nm)},geometry:{type:'LineString',coordinates:circle(Number(s.lon),Number(s.lat),i*Number(d.ring_step_nm))}})}
    const data={type:'FeatureCollection',features};
    if(!m.getSource('hpr-admin-rings'))m.addSource('hpr-admin-rings',{type:'geojson',data});else m.getSource('hpr-admin-rings').setData(data);
    if(!m.getLayer('hpr-admin-rings'))m.addLayer({id:'hpr-admin-rings',type:'line',source:'hpr-admin-rings',paint:{'line-color':d.ring_color||'#59ddff','line-width':1,'line-opacity':.45,'line-dasharray':[3,3]}});else m.setPaintProperty('hpr-admin-rings','line-color',d.ring_color||'#59ddff');
    m.setLayoutProperty('hpr-admin-rings','visibility',d.ring_enabled&&overlayVisible?'visible':'none');
    if(m.getLayer('hpr-actual-range'))m.setLayoutProperty('hpr-actual-range','visibility',d.actual_range&&overlayVisible?'visible':'none');
  }catch(_){}
}
function hookMap(){const m=window.HPREdgeMap;if(!m)return false;if(hookedMap)return true;hookedMap=true;m.on?.('style.load',()=>setTimeout(applyRings,120));applyRings();return true}
function waitMap(){if(hookMap())return;setTimeout(waitMap,200)}
function feederRows(){
  const rows=(cfg?.feeders||[]);if(!rows.length)return '<div class="tool-note">No outbound feeders configured.</div>';
  return `<div class="hpr-feeders">${rows.map(f=>`<div class="hpr-feeder" data-id="${esc(f.id)}"><div><b>${esc(f.name||f.id)}</b><small>${esc(f.host)}:${Number(f.port)} · ${esc(f.protocol)}</small></div><label class="switch" title="Enable feeder"><input type="checkbox" data-feed-toggle ${f.enabled?'checked':''}><span class="switch-track"></span></label><button data-feed-edit>Edit</button><button data-feed-delete>×</button></div>`).join('')}</div>`;
}
function renderSettings(){
  const body=$('#detailBody');if(!body||body.querySelector('#hprPersistentSettings'))return;
  const title=body.querySelector('.panel-head b')?.textContent.trim();if(title!=='Settings')return;
  if(!cfg){load().then(renderSettings).catch(e=>{const n=document.createElement('div');n.id='hprPersistentSettings';n.className='section';n.innerHTML=`<h3>Persistent settings</h3><div class="tool-note">${esc(e.message)}</div>`;body.appendChild(n)});return}
  const s=cfg.station||{},d=cfg.display||{};
  const root=document.createElement('div');root.id='hprPersistentSettings';root.innerHTML=`
    <div class="section"><h3>Receiver identity & position</h3><div class="hpr-admin-grid">
      ${field('Name',`<input id="hprSetName" value="${esc(s.name||'')}">`)}
      ${field('Latitude',`<input id="hprSetLat" inputmode="decimal" value="${s.lat??''}">`)}
      ${field('Longitude',`<input id="hprSetLon" inputmode="decimal" value="${s.lon??''}">`)}
      ${field('Height ASL (m)',`<input id="hprSetHeight" inputmode="decimal" value="${s.height_m??''}">`)}
      ${field('Station UUID',`<div class="hpr-inline"><input id="hprSetUuid" value="${esc(s.uuid||'')}"><button id="hprGenUuid">Generate</button></div>`,'Generated locally in this browser')}
      ${field('Units',`<select id="hprSetUnits"><option value="nautical" ${d.units==='nautical'?'selected':''}>Aviation · ft / kt / NM</option><option value="metric" ${d.units==='metric'?'selected':''}>Metric · m / km/h / km</option></select>`)}
    </div></div>
    <div class="section"><h3>Coverage display</h3><div class="hpr-admin-grid">
      ${field('Range rings',`<label class="switch hpr-switchline"><input id="hprRingEnabled" type="checkbox" ${d.ring_enabled?'checked':''}><span class="switch-track"></span></label>`)}
      ${field('Number of rings',`<input id="hprRingCount" type="number" min="0" max="8" step="1" value="${Number(d.ring_count??4)}">`)}
      ${field('Ring spacing (NM)',`<input id="hprRingStep" type="number" min="5" max="200" step="5" value="${Number(d.ring_step_nm??50)}">`)}
      ${field('Ring color',`<input id="hprRingColor" type="color" value="${esc(d.ring_color||'#59ddff')}">`)}
      ${field('Actual range outline',`<label class="switch hpr-switchline"><input id="hprActualRange" type="checkbox" ${d.actual_range?'checked':''}><span class="switch-track"></span></label>`,'readsb 24h outline')}
    </div></div>
    <div class="section"><h3>Outbound feeders</h3>${feederRows()}<div class="hpr-admin-grid hpr-feed-form">
      <input id="hprFeedId" type="hidden">
      ${field('Name',`<input id="hprFeedName" placeholder="adsb.lol">`)}
      ${field('Host',`<input id="hprFeedHost" placeholder="in.example.net">`)}
      ${field('Port',`<input id="hprFeedPort" type="number" min="1" max="65535" value="30004">`)}
      ${field('Protocol',`<select id="hprFeedProto"><option>beast_reduce_plus_out</option><option>beast_reduce_out</option><option>beast_out</option><option>raw_out</option><option>sbs_out</option><option>json_out</option></select>`)}
      ${field('Feeder UUID',`<div class="hpr-inline"><input id="hprFeedUuid"><button id="hprUseStationUuid">Station UUID</button></div>`,'Optional; useful with beast_reduce_plus_out')}
    </div><button class="tool-action hpr-wide" id="hprSaveFeeder">Add / update feeder</button></div>
    <div class="section"><h3>Confirm changes</h3>${field('Admin PIN',`<input id="hprAdminPin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="6 digits">`,'Required for every persistent change')}<div class="tool-actions"><button class="tool-action" id="hprSaveAll">Save station & display</button><button class="tool-action" id="hprReloadAdmin">Reload</button></div><div id="hprAdminMsg" class="hpr-admin-msg"></div></div>
    <div class="section"><h3>Change PIN</h3><div class="hpr-inline"><input id="hprNewPin" type="password" inputmode="numeric" maxlength="6" placeholder="New 6-digit PIN"><button id="hprChangePin">Change PIN</button></div></div>`;
  body.appendChild(root);bind(root)
}
function stationPayload(p){const lat=$('#hprSetLat').value.trim(),lon=$('#hprSetLon').value.trim(),height=$('#hprSetHeight').value.trim();return {pin:p,name:$('#hprSetName').value.trim(),lat:lat===''?null:num(lat),lon:lon===''?null:num(lon),height_m:height===''?null:num(height),uuid:$('#hprSetUuid').value.trim()}}
function displayPayload(p){return {pin:p,units:$('#hprSetUnits').value,ring_enabled:$('#hprRingEnabled').checked,ring_count:Number($('#hprRingCount').value),ring_step_nm:Number($('#hprRingStep').value),ring_color:$('#hprRingColor').value,actual_range:$('#hprActualRange').checked}}
function feederPayload(p,enabled=true){const id=$('#hprFeedId').value||`f_${uuid4().slice(0,8)}`;return {pin:p,id,name:$('#hprFeedName').value.trim(),host:$('#hprFeedHost').value.trim(),port:Number($('#hprFeedPort').value),protocol:$('#hprFeedProto').value,enabled,uuid:$('#hprFeedUuid').value.trim()}}
async function refreshUi(){await load();const old=$('#hprPersistentSettings');old?.remove();renderSettings();hookMap()}
function bind(root){
  $('#hprGenUuid').onclick=()=>{$('#hprSetUuid').value=uuid4()};
  $('#hprUseStationUuid').onclick=()=>{$('#hprFeedUuid').value=$('#hprSetUuid').value.trim()};
  $('#hprReloadAdmin').onclick=()=>refreshUi().catch(e=>msg(e.message,false));
  $('#hprSaveAll').onclick=async()=>{try{const p=pin();await api('station',stationPayload(p));await api('display',displayPayload(p));msg('Saved. readsb child is reloading; Docker/UI stay online.');setTimeout(()=>refreshUi().catch(()=>{}),1300)}catch(e){msg(e.message,false)}};
  $('#hprSaveFeeder').onclick=async()=>{try{const p=pin(),f=feederPayload(p,true);await api('feeder_upsert',f);msg('Feeder saved. readsb child is reloading.');setTimeout(()=>refreshUi().catch(()=>{}),1300)}catch(e){msg(e.message,false)}};
  root.querySelectorAll('[data-feed-toggle]').forEach(input=>input.onchange=async()=>{try{const p=pin(),row=input.closest('.hpr-feeder'),f=(cfg.feeders||[]).find(x=>x.id===row.dataset.id);await api('feeder_upsert',{...f,pin:p,enabled:input.checked});msg(`${f.name||f.id} ${input.checked?'enabled':'disabled'}.`);setTimeout(()=>refreshUi().catch(()=>{}),1300)}catch(e){input.checked=!input.checked;msg(e.message,false)}});
  root.querySelectorAll('[data-feed-delete]').forEach(b=>b.onclick=async()=>{try{const p=pin(),id=b.closest('.hpr-feeder').dataset.id;await api('feeder_delete',{pin:p,id});msg('Feeder deleted.');setTimeout(()=>refreshUi().catch(()=>{}),1300)}catch(e){msg(e.message,false)}});
  root.querySelectorAll('[data-feed-edit]').forEach(b=>b.onclick=()=>{const id=b.closest('.hpr-feeder').dataset.id,f=(cfg.feeders||[]).find(x=>x.id===id);if(!f)return;$('#hprFeedId').value=f.id;$('#hprFeedName').value=f.name||'';$('#hprFeedHost').value=f.host||'';$('#hprFeedPort').value=f.port||30004;$('#hprFeedProto').value=f.protocol||'beast_reduce_plus_out';$('#hprFeedUuid').value=f.uuid||''});
  $('#hprChangePin').onclick=async()=>{try{const p=pin(),np=$('#hprNewPin').value.trim();if(!/^\d{6}$/.test(np))throw new Error('New PIN must be exactly 6 digits');await api('pin',{pin:p,new_pin:np});$('#hprAdminPin').value=np;$('#hprNewPin').value='';msg('PIN changed.')}catch(e){msg(e.message,false)}}
}
function style(){if($('#hprAdminStyle'))return;const s=document.createElement('style');s.id='hprAdminStyle';s.textContent=`.hpr-admin-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.hpr-admin-field>span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}.hpr-admin-field input,.hpr-admin-field select{width:100%;height:31px;border:1px solid var(--border);border-radius:5px;background:var(--s2);color:var(--text);padding:0 7px;font:11px system-ui}.hpr-admin-field small{display:block;color:var(--muted);font-size:8px;margin-top:2px}.hpr-inline{display:flex;gap:5px}.hpr-inline input{min-width:0;flex:1}.hpr-inline button,.hpr-feeder button{border:1px solid var(--border);border-radius:5px;background:var(--s2);color:var(--text2);font-size:9px;padding:0 7px}.hpr-switchline{height:31px;display:flex;align-items:center}.hpr-feeders{margin-bottom:8px}.hpr-feeder{min-height:42px;display:grid;grid-template-columns:1fr auto auto auto;gap:6px;align-items:center;border-bottom:1px solid var(--border)}.hpr-feeder small{display:block;color:var(--muted);font-size:8px}.hpr-feeder>button{height:27px}.hpr-wide{width:100%;margin-top:8px}.hpr-admin-msg{min-height:18px;margin-top:7px;font-size:9px}.hpr-admin-msg.good{color:var(--live)}.hpr-admin-msg.bad{color:var(--danger)}@media(max-width:680px){.hpr-admin-grid{grid-template-columns:1fr}}`;document.head.appendChild(s)}
function observe(){const body=$('#detailBody');if(body)new MutationObserver(()=>queueMicrotask(renderSettings)).observe(body,{childList:true,subtree:false})}
document.addEventListener('DOMContentLoaded',()=>{style();observe();waitMap();load().then(renderSettings).catch(()=>{})},{once:true});
window.HPREdgeAdmin=Object.freeze({config:()=>cfg,reload:load,applyRings,uuid4});
})();