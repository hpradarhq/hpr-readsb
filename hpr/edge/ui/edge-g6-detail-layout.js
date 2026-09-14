/* G6: deterministic aircraft-detail hierarchy. Data enrichment belongs to G7. */
(()=>{'use strict';
const capture=(html,label)=>{const m=html.match(new RegExp(`<span>${label}<\\/span><span>([\\s\\S]*?)<\\/span>`));return m?m[1]:'—'};
function transform(html){
  if(typeof html!=='string'||!html.includes('class="detail-head"')||!html.includes('<span>ICAO</span>')||html.includes('data-hpr-g6="1"'))return html;
  const source=capture(html,'Source'),squawk=capture(html,'Squawk');
  const insert=`<div class="hpr-detail-status" data-hpr-g6="1"><b>LIVE</b><span>${source}</span><span>SQ ${squawk}</span></div><div class="hpr-detail-route"><small>ROUTE</small><b><span data-hpr-route-from>—</span><i>→</i><span data-hpr-route-to>—</span></b></div><div class="hpr-detail-context"><div><small>Operator</small><b data-hpr-operator>—</b></div><div><small>Airframe</small><b data-hpr-airframe>—</b></div></div><div class="hpr-detail-photo" data-hpr-photo-slot hidden></div>`;
  return html.replace('<div class="metric-grid">',insert+'<div class="metric-grid">');
}
function install(){
  const detail=document.getElementById('detailBody');if(!detail||detail.__hprG6)return;detail.__hprG6=true;
  const own=Object.getOwnPropertyDescriptor(detail,'innerHTML');const base=own||Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');if(!base?.get||!base?.set)return;
  Object.defineProperty(detail,'innerHTML',{configurable:true,get(){return base.get.call(this)},set(v){return base.set.call(this,transform(v))}});
  const s=document.createElement('style');s.textContent='.hpr-detail-status{display:flex;align-items:center;gap:5px;padding:6px 10px;border-bottom:1px solid var(--border);background:var(--s2)}.hpr-detail-status>*{font-size:8px}.hpr-detail-status b{color:var(--live);border:1px solid color-mix(in srgb,var(--live) 45%,var(--border));border-radius:4px;padding:2px 5px}.hpr-detail-status span{color:var(--muted);border:1px solid var(--border);border-radius:4px;padding:2px 5px}.hpr-detail-route{padding:10px 12px;border-bottom:1px solid var(--border)}.hpr-detail-route small,.hpr-detail-context small{display:block;color:var(--muted);font-size:8px;letter-spacing:.5px}.hpr-detail-route b{display:flex;align-items:center;justify-content:space-between;margin-top:4px;font-size:13px}.hpr-detail-route i{font-style:normal;color:var(--accent)}.hpr-detail-context{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border);border-bottom:1px solid var(--border)}.hpr-detail-context>div{padding:8px 12px;background:var(--surface)}.hpr-detail-context b{display:block;margin-top:2px;font-size:11px;overflow-wrap:anywhere}.hpr-detail-photo:not([hidden]){border-bottom:1px solid var(--border)}';document.head.appendChild(s);
}
document.addEventListener('DOMContentLoaded',install,{once:true});
window.HPREdgeDetailLayout=Object.freeze({transform});
})();
