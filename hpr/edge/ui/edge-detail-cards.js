/* Detail-card treatment: AirNav-like aircraft hierarchy, FR24-like station summary. */
(()=>{'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function pair(label){for(const kv of $$('#detailBody .kv')){const c=[...kv.children];for(let i=0;i<c.length-1;i+=2)if(c[i].textContent.trim()===label)return c[i+1].textContent.trim()}return''}
function icao(){const v=pair('ICAO').toLowerCase();return/^[0-9a-f]{6}$/.test(v)?v:null}
function aircraftCard(){
  const body=$('#detailBody'),id=icao();if(!body||!id)return false;body.classList.add('hpr-airnav-detail');body.classList.remove('hpr-fr24-station');
  $('#hprTrace')?.remove();const actions=$('#hprDetailActions');if(actions)actions.style.gridTemplateColumns='1fr 1fr';
  let strip=$('#hprAirnavStrip');if(!strip){strip=document.createElement('div');strip.id='hprAirnavStrip';strip.className='hpr-airnav-strip';(actions||body.querySelector('.detail-head'))?.after(strip)}
  const a=window.HPREdgeE1E7?.aircraft?.(id),source=a?.source||pair('Source')||'ADS-B',sq=a?.squawk||pair('Squawk')||'—',seen=a?.seenSec==null?'LIVE':`${Math.max(0,Math.round(a.seenSec))}s`,emergency=['7500','7600','7700'].includes(String(sq));
  strip.innerHTML=`<span class="${emergency?'danger':'live'}">${emergency?'EMERGENCY':'LIVE'}</span><span>${source}</span><span>SQ ${sq}</span><span>${seen}</span>`;
  return true
}
function stationCard(){
  const body=$('#detailBody');if(!body||icao())return false;if(![...body.querySelectorAll('h3')].some(x=>x.textContent.trim()==='Capabilities'))return false;body.classList.add('hpr-fr24-station');body.classList.remove('hpr-airnav-detail');
  let card=$('#hprStationOverview');if(!card){card=document.createElement('div');card.id='hprStationOverview';card.className='hpr-station-overview';body.querySelector('.detail-head')?.after(card)}
  const cfg=window.HPREdgeAdmin?.config?.()||{},s=cfg.station||{},aw=window.HPRAirWire?.stats?.()||{},title=body.querySelector('.detail-title b')?.textContent.trim()||s.name||'HPR Edge';
  const coords=s.lat!=null&&s.lon!=null?`${Number(s.lat).toFixed(5)}, ${Number(s.lon).toFixed(5)}`:(body.querySelector('.detail-title small')?.textContent.split(' · ').at(-1)||'—');
  const version=(body.querySelector('.detail-title small')?.textContent.split(' · ')[0]||'readsb').trim();
  card.innerHTML=`<div class="hpr-station-title"><div><small>STATION</small><b>${title}</b></div><span class="${aw.connected?'online':'offline'}">${aw.connected?'Online':'Offline'}</span></div><div class="hpr-station-kv"><span>Coordinates</span><b>${coords}</b><span>UUID</span><b>${s.uuid||pair('UUID')||'—'}</b><span>Software</span><b>${version}</b><span>Aircraft now</span><b>${Number(aw.aircraft||0)}</b><span>AirWire frames</span><b>${Number(aw.frames||0).toLocaleString()}</b><span>Signal</span><b>${pair('Peak signal')||pair('Signal')||'—'}</b></div>`;
  return true
}
function decorate(){const body=$('#detailBody');if(!body)return;if(!aircraftCard())stationCard()}
function style(){if($('#hprDetailCardStyle'))return;const s=document.createElement('style');s.id='hprDetailCardStyle';s.textContent=`
.hpr-airnav-detail .detail-head{padding:12px 13px 10px}.hpr-airnav-detail .detail-title b{font-size:18px;letter-spacing:.1px}.hpr-airnav-detail .detail-title small{font-size:10px;margin-top:2px}.hpr-airnav-detail .metric-grid{grid-template-columns:1fr 1fr}.hpr-airnav-detail .metric{padding:11px 12px}.hpr-airnav-detail .metric b{font-size:15px}.hpr-airnav-detail .section{margin:8px;border:1px solid var(--border);border-radius:7px;padding:10px;background:color-mix(in srgb,var(--s2) 46%,transparent)}.hpr-airnav-detail .section+.section{margin-top:7px}.hpr-airnav-strip{display:flex;gap:5px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--border);background:var(--s2)}.hpr-airnav-strip span{padding:2px 5px;border:1px solid var(--border);border-radius:4px;color:var(--muted);font-size:8px;font-weight:750}.hpr-airnav-strip .live{color:var(--live);border-color:color-mix(in srgb,var(--live) 45%,var(--border))}.hpr-airnav-strip .danger{color:var(--danger);border-color:var(--danger)}
.hpr-fr24-station .detail-head{padding:10px 12px}.hpr-fr24-station .detail-head .plane-big{display:none}.hpr-station-overview{padding:10px 12px;border-bottom:1px solid var(--border);background:linear-gradient(180deg,color-mix(in srgb,var(--s2) 82%,transparent),transparent)}.hpr-station-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.hpr-station-title small{display:block;font-size:8px;color:var(--muted);letter-spacing:.6px}.hpr-station-title b{font-size:15px}.hpr-station-title>span{padding:3px 7px;border-radius:10px;font-size:8px;font-weight:800}.hpr-station-title .online{color:var(--live);background:color-mix(in srgb,var(--live) 12%,transparent)}.hpr-station-title .offline{color:var(--danger);background:color-mix(in srgb,var(--danger) 12%,transparent)}.hpr-station-kv{display:grid;grid-template-columns:92px 1fr;gap:5px 8px;font-size:9px}.hpr-station-kv span{color:var(--muted)}.hpr-station-kv b{text-align:right;font-weight:650;overflow-wrap:anywhere}.hpr-fr24-station #hprE5Health{display:none}.hpr-fr24-station .metric-grid{margin:8px;border:1px solid var(--border);border-radius:7px;overflow:hidden}
`;document.head.appendChild(s)}
document.addEventListener('DOMContentLoaded',()=>{style();decorate();const d=$('#detailBody');if(d)new MutationObserver(()=>queueMicrotask(decorate)).observe(d,{childList:true});setInterval(decorate,1500)},{once:true});
window.HPREdgeDetailCards=Object.freeze({decorate});
})();