/* G4: calm only the LOCAL AIRCRAFT DOM; map/data cadence stays untouched. */
(()=>{'use strict';
const descriptor=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
if(!descriptor?.get||!descriptor?.set)return;
const WINDOW_MS=2500;
const lastWrites=new WeakMap();
const forceUntils=new WeakMap();
function force(host=document.getElementById('airList')){if(host)forceUntils.set(host,performance.now()+150)}
document.addEventListener('click',()=>force(),true);
document.addEventListener('input',()=>force(),true);
document.addEventListener('keydown',()=>force(),true);
function stableHtml(host,html){
  const current=[...host.querySelectorAll('.row[data-id]')].map(row=>row.dataset.id);
  if(!current.length)return html;
  const rank=new Map(current.map((id,index)=>[id,index]));
  const tpl=document.createElement('template');tpl.innerHTML=html;
  const rows=[...tpl.content.querySelectorAll('.row[data-id]')];
  if(!rows.length)return html;
  rows.sort((a,b)=>(rank.get(a.dataset.id)??1e9)-(rank.get(b.dataset.id)??1e9)||a.dataset.id.localeCompare(b.dataset.id));
  rows.forEach(row=>tpl.content.appendChild(row));
  return tpl.innerHTML;
}
Object.defineProperty(Element.prototype,'innerHTML',{...descriptor,set:function(value){
  if(this.id!=='airList')return descriptor.set.call(this,value);
  const now=performance.now();
  const lastWrite=lastWrites.get(this)??-Infinity;
  const forceUntil=forceUntils.get(this)??0;
  const forceWrite=!this.dataset.hprCalmReady||now<=forceUntil;
  if(!forceWrite&&now-lastWrite<WINDOW_MS)return;
  const html=forceWrite?String(value):stableHtml(this,String(value));
  descriptor.set.call(this,html);
  this.dataset.hprCalmReady='1';
  lastWrites.set(this,now);
}});
window.HPRCalmList=Object.freeze({windowMs:WINDOW_MS,force});
})();
