/* Selected-aircraft enrichment from traffic.hpradar.com.
 * Live motion remains local AirWire/readsb. Never fan out across all aircraft.
 * Aircraft registry cache: 24h. Callsign/route cache: 30m.
 */
(()=>{'use strict';
const BASE=String(window.HPR_CONFIG?.trafficApi||'https://traffic.hpradar.com').replace(/\/$/,'');
const AC_TTL=24*3600e3,ROUTE_TTL=30*60e3,cache=new Map();
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function findPair(label){for(const kv of document.querySelectorAll('#detailBody .kv')){const c=[...kv.children];for(let i=0;i<c.length-1;i+=2)if(c[i].textContent.trim()===label)return c[i+1].textContent.trim()}return''}
function unwrapAircraft(j){return j?.response?.aircraft||j?.aircraft||j?.response||j||null}
function unwrapRoute(j){return j?.response?.flightroute||j?.flightroute||j?.route||j?.response||j||null}
async function cached(key,ttl,url){const now=Date.now(),old=cache.get(key);if(old&&now-old.ts<ttl)return old.value;try{const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw Error(String(r.status));const value=await r.json();cache.set(key,{ts:now,value});return value}catch(_){cache.set(key,{ts:now,value:null});return null}}
function airportName(a){if(!a)return'';const code=a.icao_code||a.icao||a.iata_code||a.iata||'';const name=a.name||a.municipality||'';return [code,name].filter(Boolean).join(' · ')}
function routeText(r){if(!r)return'';const o=r.origin||r.departure||null,d=r.destination||r.arrival||null;if(o||d)return `${airportName(o)||'—'} → ${airportName(d)||'—'}`;return r.airport_codes||r.route||''}
function airlineText(r){const a=r?.airline||null;return [a?.name,r?.airline_code||a?.icao||a?.iata].filter(Boolean).join(' · ')}
function kv(label,value){return value?`<span>${esc(label)}</span><span>${esc(value)}</span>`:''}
async function decorate(){
  const body=$('#detailBody');if(!body)return;const hex=findPair('ICAO').toLowerCase();if(!/^[0-9a-f]{6}$/.test(hex))return;
  const callsign=findPair('Callsign').replace(/—/g,'').trim().toUpperCase();const sig=`${hex}:${callsign}`;if(body.dataset.hprTraffic===sig)return;body.dataset.hprTraffic=sig;
  const [aj,rj]=await Promise.all([
    cached(`ac:${hex}`,AC_TTL,`${BASE}/v0/aircraft/${encodeURIComponent(hex)}`),
    callsign?cached(`rt:${callsign}`,ROUTE_TTL,`${BASE}/v0/callsign/${encodeURIComponent(callsign)}`):Promise.resolve(null)
  ]);
  if(body.dataset.hprTraffic!==sig)return;const a=unwrapAircraft(aj),r=unwrapRoute(rj);if(!a&&!r)return;
  const manufacturer=a?.manufacturer||'',model=a?.model||a?.type||'',owner=a?.registered_owner||a?.owner||'',year=a?.year||'',mil=a?.military===true?'YES':a?.military===false?'NO':'';
  const route=routeText(r),airline=airlineText(r);if(!manufacturer&&!model&&!route&&!airline&&!owner&&!year&&!mil)return;
  let sec=body.querySelector('#hprTrafficEnrich');if(!sec){sec=document.createElement('div');sec.id='hprTrafficEnrich';sec.className='section';body.appendChild(sec)}
  sec.innerHTML=`<h3>HPR Traffic enrichment</h3><div class="kv">${kv('Manufacturer / model',[manufacturer,model].filter(Boolean).join(' '))}${kv('Owner / operator',owner)}${kv('Year',year)}${kv('Military',mil)}${kv('Airline',airline)}${kv('Route',route)}</div>`;
}
function init(){const body=$('#detailBody');if(body)new MutationObserver(()=>queueMicrotask(decorate)).observe(body,{childList:true,subtree:true});decorate()}
document.addEventListener('DOMContentLoaded',init,{once:true});
window.HPREdgeTraffic=Object.freeze({base:BASE,unwrapAircraft,unwrapRoute,clear:()=>cache.clear()});
})();
