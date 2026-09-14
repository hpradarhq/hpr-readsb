/* Selected-aircraft enrichment from traffic.hpradar.com via same-origin proxy.
 * Live motion remains local AirWire/readsb. Never fan out across all aircraft.
 */
(()=>{'use strict';
const BASE=String(window.HPR_CONFIG?.trafficApi||'/api/traffic').replace(/\/$/,'');
const AC_TTL=24*3600e3,ROUTE_TTL=30*60e3,cache=new Map();
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function findPair(label){for(const kv of document.querySelectorAll('#detailBody .kv')){const c=[...kv.children];for(let i=0;i<c.length-1;i+=2)if(c[i].textContent.trim()===label)return c[i+1].textContent.trim()}return''}
function unwrapAircraft(j){return j?.response?.aircraft||j?.aircraft||j?.response||j||null}
function unwrapRoute(j){return j?.response?.flightroute||j?.flightroute||j?.route||j?.response||j||null}
async function cached(key,ttl,url){const now=Date.now(),old=cache.get(key);if(old&&now-old.ts<ttl)return old.value;try{const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw Error(String(r.status));const value=await r.json();cache.set(key,{ts:now,value});return value}catch(_){cache.set(key,{ts:now,value:null});return null}}
function airportCode(a){return a?.icao_code||a?.icao||a?.iata_code||a?.iata||'—'}
function airportName(a){return a?.name||a?.municipality||''}
function airlineText(r){const a=r?.airline||null;return[a?.name,r?.airline_code||a?.icao||a?.iata].filter(Boolean).join(' · ')}
function kv(label,value){return value?`<span>${esc(label)}</span><b>${esc(value)}</b>`:''}
async function decorate(){
  const body=$('#detailBody');if(!body)return;const hex=findPair('ICAO').toLowerCase();if(!/^[0-9a-f]{6}$/.test(hex))return;
  const callsign=findPair('Callsign').replace(/—/g,'').trim().toUpperCase(),sig=`${hex}:${callsign}`;if(body.dataset.hprTrafficLoading===sig&&body.querySelector('#hprTrafficEnrich'))return;body.dataset.hprTrafficLoading=sig;
  const [aj,rj]=await Promise.all([cached(`ac:${hex}`,AC_TTL,`${BASE}/v0/aircraft/${encodeURIComponent(hex)}`),callsign?cached(`rt:${callsign}`,ROUTE_TTL,`${BASE}/v0/callsign/${encodeURIComponent(callsign)}`):Promise.resolve(null)]);
  if(findPair('ICAO').toLowerCase()!==hex)return;const a=unwrapAircraft(aj),r=unwrapRoute(rj);if(!a&&!r)return;
  const manufacturer=a?.manufacturer||'',model=a?.model||a?.type||'',owner=a?.registered_owner||a?.owner||'',year=a?.year||'',mil=a?.military===true?'Military':a?.military===false?'Civil':'';
  const origin=r?.origin||r?.departure||null,dest=r?.destination||r?.arrival||null,airline=airlineText(r);
  let sec=body.querySelector('#hprTrafficEnrich');if(!sec){sec=document.createElement('section');sec.id='hprTrafficEnrich';sec.className='hpr-traffic-card';const anchor=body.querySelector('#hprAirnavStrip')||body.querySelector('#hprDetailActions')||body.querySelector('.detail-head');anchor?.after(sec)}
  const route=(origin||dest)?`<div class="hpr-route"><div><small>FROM</small><b>${esc(airportCode(origin))}</b><span>${esc(airportName(origin))}</span></div><i>→</i><div><small>TO</small><b>${esc(airportCode(dest))}</b><span>${esc(airportName(dest))}</span></div></div>`:'';
  sec.innerHTML=`${route}<div class="hpr-flight-meta">${kv('Operator',airline||owner)}${kv('Aircraft',[manufacturer,model].filter(Boolean).join(' '))}${kv('Year',year)}${kv('Class',mil)}</div>`;
}
function init(){const body=$('#detailBody');if(body)new MutationObserver(()=>queueMicrotask(decorate)).observe(body,{childList:true,subtree:true});decorate();const st=document.createElement('style');st.textContent=`.hpr-traffic-card{margin:8px;border:1px solid var(--border);border-radius:7px;background:color-mix(in srgb,var(--s2) 58%,transparent);overflow:hidden}.hpr-route{display:grid;grid-template-columns:1fr auto 1fr;gap:9px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--border)}.hpr-route>div:last-child{text-align:right}.hpr-route small,.hpr-route span{display:block;color:var(--muted);font-size:8px}.hpr-route b{display:block;font-size:18px;letter-spacing:.5px}.hpr-route i{font-style:normal;color:var(--accent);font-size:17px}.hpr-flight-meta{display:grid;grid-template-columns:82px 1fr;gap:5px 8px;padding:8px 12px;font-size:9px}.hpr-flight-meta span{color:var(--muted)}.hpr-flight-meta b{text-align:right;font-weight:650;overflow-wrap:anywhere}`;document.head.appendChild(st)}
document.addEventListener('DOMContentLoaded',init,{once:true});
window.HPREdgeTraffic=Object.freeze({base:BASE,unwrapAircraft,unwrapRoute,clear:()=>cache.clear()});
})();