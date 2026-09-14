/* HPRadar Edge calm operator UI.
 * Keep the map live; make LOCAL AIRCRAFT visually stable and slower-changing.
 * Also removes duplicate selection glow, prevents replay/table overlap, and
 * expands high-value operator layers without adding new backend work.
 */
(()=>{'use strict';
const TABLE_REFRESH_MS=2500;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const stableOrder=new Map(), valueCache=new Map(); let nextOrder=1,reordering=false;

/* Map selection: no halo/shadow. Selected aircraft is only slightly larger and
 * its label uses the accent color. This wraps MapLibre before map creation. */
if(window.maplibregl?.Map?.prototype&&!window.__HPR_CALM_LAYER_PATCH){
  window.__HPR_CALM_LAYER_PATCH=true;
  const nativeAdd=window.maplibregl.Map.prototype.addLayer;
  window.maplibregl.Map.prototype.addLayer=function(layer,beforeId){
    if(layer?.id==='aircraft-halo'||layer?.id==='aircraft-selected-emphasis')return this;
    if(layer?.id==='aircraft-symbol'){
      layer={...layer,layout:{...(layer.layout||{}),
        'icon-size':['case',['==',['get','selected'],1],
          ['interpolate',['linear'],['zoom'],5,.64,8,.82,12,1.08],
          ['interpolate',['linear'],['zoom'],5,.56,8,.72,12,.96]]}};
    }
    if(layer?.id==='aircraft-label'){
      const base=layer.paint?.['text-color']||'#dbe6f4';
      layer={...layer,paint:{...(layer.paint||{}),'text-color':['case',['==',['get','selected'],1],'#59ddff',base]}};
    }
    return nativeAdd.call(this,layer,beforeId);
  };
}

function stripAge(meta){
  if(!meta)return;
  const p=meta.textContent.split(' · ');if(p.length>2)meta.textContent=p.slice(0,2).join(' · ');
}
function calmRow(row,now){
  const id=row.dataset.id;if(!id)return;
  if(!stableOrder.has(id))stableOrder.set(id,nextOrder++);
  stripAge(row.querySelector('.meta'));
  const alt=row.querySelector('.kpi b'),spd=row.querySelector('.kpi small');
  const current={alt:alt?.textContent||'',spd:spd?.textContent||''};
  const prev=valueCache.get(id);
  if(prev&&now-prev.ts<TABLE_REFRESH_MS){if(alt)alt.textContent=prev.alt;if(spd)spd.textContent=prev.spd}
  else valueCache.set(id,{ts:now,...current});
}
function calmList(){
  const list=$('#airList');if(!list||reordering)return;
  const rows=$$('#airList .row[data-id]'),now=performance.now();rows.forEach(r=>calmRow(r,now));
  const opt=$('#hprSort option[value="seen"]');if(opt)opt.textContent='Stable';
  const search=$('#search')?.value.trim();const mode=$('#hprSort')?.value||'seen';
  if(search||mode!=='seen'||rows.length<2)return;
  const sorted=[...rows].sort((a,b)=>(stableOrder.get(a.dataset.id)||0)-(stableOrder.get(b.dataset.id)||0));
  if(sorted.every((r,i)=>r===rows[i]))return;
  reordering=true;for(const r of sorted)list.appendChild(r);reordering=false;
}

function layerVisible(id){const m=window.HPREdgeMap;if(!m?.getLayer?.(id))return false;return m.getLayoutProperty(id,'visibility')!=='none'}
function setLayer(ids,on){const m=window.HPREdgeMap;if(!m)return;for(const id of ids){try{if(m.getLayer(id))m.setLayoutProperty(id,'visibility',on?'visible':'none')}catch(_){}}}
function switchRow(label,note,key,checked){return `<label class="setting-row"><span><b>${label}</b><small>${note}</small></span><span class="switch"><input type="checkbox" data-hpr-layer="${key}" ${checked?'checked':''}><span class="switch-track"></span></span></label>`}
function enhanceLayerMenu(){
  const body=$('#detailBody');if(!body||body.querySelector('#hprMoreLayers'))return;
  const title=body.querySelector('.panel-head b')?.textContent.trim();if(title!=='Map layers')return;
  const m=window.HPREdgeMap,ops=window.HPREdgeOps?.state?.()||{};
  const sec=document.createElement('div');sec.id='hprMoreLayers';sec.className='section';
  sec.innerHTML=`<h3>Operational overlays</h3>
    ${switchRow('Receiver coverage','Range rings + actual 24h outline','coverage',ops.rings!==false)}
    ${switchRow('Recent tracks','30 / 60 / 120 min readsb traces','tracks',!!ops.allTracks)}
    ${switchRow('City labels','Basemap place names','cities',m?layerVisible('place-city'):true)}
    ${switchRow('Country borders','National boundary context','borders',m?layerVisible('boundary-country'):true)}
    ${switchRow('Vietnamese archipelago names','HOÀNG SA / TRƯỜNG SA labels','vnlabels',m?layerVisible('hpr-vn-archipelago-labels'):true)}`;
  body.appendChild(sec);
  sec.querySelectorAll('[data-hpr-layer]').forEach(input=>input.onchange=()=>{
    const on=input.checked,key=input.dataset.hprLayer;
    if(key==='coverage'){const s=window.HPREdgeOps?.state?.();if(!!s?.rings!==on)$('#hprCoverage')?.click()}
    else if(key==='tracks'){const s=window.HPREdgeOps?.state?.();if(!!s?.allTracks!==on)$('#hprAllTracks')?.click()}
    else if(key==='cities')setLayer(['place-city'],on);
    else if(key==='borders')setLayer(['boundary-country','boundary-state'],on);
    else if(key==='vnlabels')setLayer(['hpr-vn-archipelago-labels'],on);
  });
}

function installStyle(){if($('#hprCalmStyle'))return;const st=document.createElement('style');st.id='hprCalmStyle';st.textContent=`
  /* LOCAL AIRCRAFT: no decorative aircraft icon; stable, compact rows. */
  #airList .row{grid-template-columns:8px minmax(0,1fr) auto!important;min-height:54px!important}
  #airList .row>.plane-icon{display:none!important}
  #airList .row.selected{background:color-mix(in srgb,var(--accent) 9%,transparent)!important;box-shadow:inset 2px 0 var(--accent)}
  #airList .kpi{font-variant-numeric:tabular-nums}
  /* Replay must consume map space, never sit on top of LOCAL AIRCRAFT/detail. */
  body:has(#hprTraceDock:not([hidden])) #collection,
  body:has(#hprTraceDock:not([hidden])) #detail{max-height:calc(100vh - var(--top) - 175px)!important}
  @media(max-width:680px){
    body:has(#hprTraceDock:not([hidden])) #collection{max-height:26vh!important}
    body:has(#hprTraceDock:not([hidden])) #detail{bottom:245px!important;max-height:28vh!important}
  }
  `;document.head.appendChild(st)}
function init(){
  installStyle();const list=$('#airList'),detail=$('#detailBody');
  if(list)new MutationObserver(()=>queueMicrotask(calmList)).observe(list,{childList:true});
  if(detail)new MutationObserver(()=>queueMicrotask(enhanceLayerMenu)).observe(detail,{childList:true,subtree:true});
  calmList();enhanceLayerMenu();setInterval(calmList,TABLE_REFRESH_MS);
}
document.addEventListener('DOMContentLoaded',init,{once:true});
window.HPREdgeCalm=Object.freeze({tableRefreshMs:TABLE_REFRESH_MS,calmList,enhanceLayerMenu});
})();
