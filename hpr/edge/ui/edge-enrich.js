/* E6 offline-first enrichment from the AirWire adapter's local readsb DB cache.
 * No duplicate aircraft.json polling and no global API dependency.
 */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function findIcao(){for(const kv of document.querySelectorAll('#detailBody .kv')){const c=[...kv.children];for(let i=0;i<c.length-1;i+=2)if(c[i].textContent.trim()==='ICAO')return c[i+1].textContent.trim().toLowerCase()}return null}
const value=v=>v==null||v===''?'—':String(v);
function decorate(){
  const body=$('#detailBody'),id=findIcao();if(!body||!/^[0-9a-f]{6}$/.test(id||''))return;if(body.querySelector(`[data-hpr-enrich="${id}"]`))return;
  const a=window.HPRAirWire?.meta?.(id);if(!a)return;
  const existing=[...body.querySelectorAll('.section')].find(s=>s.querySelector('h3')?.textContent.trim()==='Identity');if(!existing)return;
  const section=document.createElement('div');section.className='section';section.dataset.hprEnrich=id;
  section.innerHTML=`<h3>Airframe / operator</h3><div class="kv"><span>Description</span><span>${esc(value(a.typeDescription))}</span><span>Owner / operator</span><span>${esc(value(a.ownerOperator))}</span><span>Year</span><span>${esc(value(a.year))}</span><span>DB flags</span><span>${Number(a.dbFlags)||0}</span></div>`;
  existing.after(section);
}
function init(){const body=$('#detailBody');if(body)new MutationObserver(()=>queueMicrotask(decorate)).observe(body,{childList:true,subtree:true});setInterval(decorate,1200);decorate()}
document.addEventListener('DOMContentLoaded',init,{once:true});
window.HPREdgeEnrich=Object.freeze({get:id=>window.HPRAirWire?.meta?.(id)||null});
})();
