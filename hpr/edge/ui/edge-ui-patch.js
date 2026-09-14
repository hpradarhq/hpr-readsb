/* Edge-only UI polish.
 * <=400 aircraft: no clustering/LOD. Suppress marker halos, add ICAO-country
 * flags, and lazy-load one aircraft photo only when detail is open.
 */
(()=>{'use strict';

/* Suppress the green/aging/stale ring around every aircraft marker. */
if(window.maplibregl?.Map?.prototype){
  const addLayer=window.maplibregl.Map.prototype.addLayer;
  window.maplibregl.Map.prototype.addLayer=function(layer,beforeId){
    if(layer?.id==='aircraft-halo')return this;
    return addLayer.call(this,layer,beforeId);
  };
}

const R=[
[0x100000,0x1fffff,'Russia','ru'],
[0x300000,0x33ffff,'Italy','it'],[0x340000,0x37ffff,'Spain','es'],[0x380000,0x3bffff,'France','fr'],[0x3c0000,0x3fffff,'Germany','de'],
[0x400000,0x43ffff,'United Kingdom','gb'],[0x440000,0x447fff,'Austria','at'],[0x448000,0x44ffff,'Belgium','be'],[0x458000,0x45ffff,'Denmark','dk'],[0x460000,0x467fff,'Finland','fi'],[0x468000,0x46ffff,'Greece','gr'],[0x478000,0x47ffff,'Norway','no'],[0x480000,0x487fff,'Netherlands','nl'],[0x488000,0x48ffff,'Poland','pl'],[0x490000,0x497fff,'Portugal','pt'],[0x498000,0x49ffff,'Czechia','cz'],[0x4a0000,0x4a7fff,'Romania','ro'],[0x4a8000,0x4affff,'Sweden','se'],[0x4b0000,0x4b7fff,'Switzerland','ch'],[0x4b8000,0x4bffff,'Türkiye','tr'],[0x4ca000,0x4cafff,'Ireland','ie'],
[0x710000,0x717fff,'Saudi Arabia','sa'],[0x718000,0x71ffff,'South Korea','kr'],[0x720000,0x727fff,'North Korea','kp'],[0x728000,0x72ffff,'Iraq','iq'],[0x730000,0x737fff,'Iran','ir'],[0x738000,0x73ffff,'Israel','il'],[0x740000,0x747fff,'Jordan','jo'],[0x748000,0x74ffff,'Lebanon','lb'],[0x750000,0x757fff,'Malaysia','my'],[0x758000,0x75ffff,'Philippines','ph'],[0x760000,0x767fff,'Pakistan','pk'],[0x768000,0x76ffff,'Singapore','sg'],[0x770000,0x777fff,'Sri Lanka','lk'],
[0x789000,0x789fff,'Hong Kong','hk'],[0x780000,0x7bffff,'China','cn'],[0x7c0000,0x7fffff,'Australia','au'],[0x800000,0x83ffff,'India','in'],[0x840000,0x87ffff,'Japan','jp'],[0x880000,0x887fff,'Thailand','th'],[0x888000,0x88ffff,'Viet Nam','vn'],[0x890000,0x890fff,'Yemen','ye'],[0x894000,0x894fff,'Bahrain','bh'],[0x895000,0x895fff,'Brunei','bn'],[0x896000,0x896fff,'United Arab Emirates','ae'],[0x897000,0x897fff,'Solomon Islands','sb'],[0x898000,0x898fff,'Papua New Guinea','pg'],[0x899000,0x899fff,'Taiwan','tw'],[0x8a0000,0x8a7fff,'Indonesia','id'],[0x8e0000,0x8e7fff,'Myanmar','mm'],[0x900000,0x900fff,'Afghanistan','af'],[0x901000,0x901fff,'Bangladesh','bd'],[0x902000,0x902fff,'Bhutan','bt'],[0x903000,0x903fff,'Cambodia','kh'],[0x904000,0x904fff,'Laos','la'],[0x905000,0x905fff,'Nepal','np'],[0x906000,0x906fff,'Oman','om'],[0x907000,0x907fff,'Qatar','qa'],
[0xa00000,0xafffff,'United States','us'],[0xc00000,0xc3ffff,'Canada','ca'],[0xc80000,0xc87fff,'New Zealand','nz']
];
function flag(code){return code?code.toUpperCase().replace(/[A-Z]/g,c=>String.fromCodePoint(127397+c.charCodeAt(0))):''}
function country(hex){const n=parseInt(String(hex||'').replace(/^~/,''),16);if(!Number.isFinite(n))return null;const x=R.find(r=>n>=r[0]&&n<=r[1]);return x?{name:x[2],code:x[3],flag:flag(x[3])}:null}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function decorateList(){
  document.querySelectorAll('#airList .row[data-id]').forEach(row=>{
    const name=row.querySelector('.name');if(!name||name.dataset.flagged)return;
    const c=country(row.dataset.id);if(c){name.textContent=`${c.flag} ${name.textContent}`;name.title=c.name}
    name.dataset.flagged='1';
  });
}

async function photo(hex){
  const key=`hprPhoto:${hex}`;
  try{const c=sessionStorage.getItem(key);if(c)return JSON.parse(c)}catch(_){}
  let value=null;
  try{
    const r=await fetch(`/api/photo/hex/${hex}`,{cache:'force-cache'});
    if(r.ok){const j=await r.json(),p=j?.photos?.[0];if(p?.thumbnail?.src)value={src:p.thumbnail.src,link:p.link||`https://www.planespotters.net/hex/${hex.toUpperCase()}`,photographer:p.photographer||'Planespotters.net'}}
  }catch(_){}
  try{sessionStorage.setItem(key,JSON.stringify(value))}catch(_){}
  return value;
}

function findIcao(detail){
  for(const kv of detail.querySelectorAll('.kv')){
    const s=[...kv.children];
    for(let i=0;i<s.length-1;i+=2)if(s[i].textContent.trim()==='ICAO')return s[i+1].textContent.trim().toLowerCase();
  }
  return null;
}

async function decorateDetail(){
  const detail=document.querySelector('#detailBody');if(!detail)return;
  const hex=findIcao(detail);if(!/^[0-9a-f]{6}$/.test(hex||''))return;
  if(detail.dataset.hprDecorated===hex)return;
  detail.dataset.hprDecorated=hex;
  const c=country(hex);
  const title=detail.querySelector('.detail-title b');
  if(c&&title&&!title.dataset.flagged){title.textContent=`${c.flag} ${title.textContent}`;title.dataset.flagged='1'}
  const identity=[...detail.querySelectorAll('.section')].find(s=>s.querySelector('h3')?.textContent.trim()==='Identity');
  const kv=identity?.querySelector('.kv');
  if(c&&kv){const a=document.createElement('span'),b=document.createElement('span');a.textContent='Country';b.textContent=`${c.flag} ${c.name}`;kv.append(a,b)}

  const p=await photo(hex);
  if(!p||detail.dataset.hprDecorated!==hex)return;
  const metric=detail.querySelector('.metric-grid');if(!metric)return;
  const card=document.createElement('div');card.className='hpr-photo';
  card.innerHTML=`<a href="${esc(p.link)}" target="_blank" rel="noopener"><img src="${esc(p.src)}" alt="Aircraft ${hex.toUpperCase()}" loading="lazy"></a><div>© ${esc(p.photographer)} · Planespotters.net</div>`;
  metric.before(card);
}

function polishCopy(){document.querySelectorAll('.setting-row small').forEach(el=>{if(el.textContent.includes('status halos'))el.textContent='Symbols and hit targets'})}
function decorate(){decorateList();polishCopy();decorateDetail()}

const style=document.createElement('style');
style.textContent='.hpr-photo{border-bottom:1px solid var(--border);background:var(--s2)}.hpr-photo img{display:block;width:100%;max-height:190px;object-fit:cover}.hpr-photo div{padding:5px 9px;color:var(--muted);font-size:9px}.hpr-photo a{display:block}.detail-title b{display:flex!important;align-items:center;gap:5px}';
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded',()=>{decorate();const root=document.body;new MutationObserver(()=>queueMicrotask(decorate)).observe(root,{childList:true,subtree:true})});
window.HPREdgeMeta=Object.freeze({country});
})();
