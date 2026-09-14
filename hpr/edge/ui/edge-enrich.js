/* E6 offline-first enrichment from local readsb aircraft.json / DB.
 * No global API dependency. Photo remains optional in edge-ui-patch.js.
 */
(()=>{'use strict';
let cache=new Map(),last=0,loading=null;
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function refresh(){
  if(loading)return loading;if(Date.now()-last<4000)return;
  loading=(async()=>{try{const r=await fetch('/api/readsb/aircraft.json',{cache:'no-store'});if(!r.ok)return;const j=await r.json();cache=new Map((j.aircraft||[]).filter(x=>x?.hex&&!String(x.hex).startsWith('~')).map(x=>[String(x.hex).toLowerCase(),x]));last=Date.now()}catch(_){}finally{loading=null}})();return loading;
}
function findIcao(){for(const kv of document.querySelectorAll('#detailBody .kv')){const c=[...kv.children];for(let i=0;i<c.length-1;i+=2)if(c[i].textContent.trim()==='ICAO')return c[i+1].textContent.trim().toLowerCase()}return null}
function value(v){return v==null||v===''?'—':String(v)}
async function decorate(){
  const body=$('#detailBody'),id=findIcao();if(!body||!/^[0-9a-f]{6}$/.test(id||''))return;if(body.querySelector(`[data-hpr-enrich="${id}"]`))return;
  await refresh();const a=cache.get(id);if(!a)return;
  const existing=[...body.querySelectorAll('.section')].find(s=>s.querySelector('h3')?.textContent.trim()==='Identity');if(!existing)return;
  const section=document.createElement('div');section.className='section';section.dataset.hprEnrich=id;
  const owner=a.ownOp||a.owner||a.operator||null,year=a.year||null,desc=a.desc||null,category=a.category||null;
  section.innerHTML=`<h3>Airframe / operator</h3><div class="kv"><span>Description</span><span>${esc(value(desc))}</span><span>Owner / operator</span><span>${esc(value(owner))}</span><span>Year</span><span>${esc(value(year))}</span><span>ADS-B category</span><span>${esc(value(category))}</span></div>`;
  existing.after(section);
}
function init(){refresh();setInterval(refresh,5000);const body=$('#detailBody');if(body)new MutationObserver(()=>queueMicrotask(decorate)).observe(body,{childList:true,subtree:true});decorate()}
document.addEventListener('DOMContentLoaded',init,{once:true});
window.HPREdgeEnrich=Object.freeze({get:id=>cache.get(String(id||'').toLowerCase())||null,refresh});
})();
