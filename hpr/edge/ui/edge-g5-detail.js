/* G5: synchronous local aircraft identity decoration; no observer, timer or network. */
(()=>{'use strict';
const R=[
[0x004000,0x0047ff,'Zimbabwe','zw'],[0x008000,0x00ffff,'South Africa','za'],[0x010000,0x017fff,'Egypt','eg'],[0x020000,0x027fff,'Morocco','ma'],[0x0ac000,0x0adfff,'Colombia','co'],[0x0d0000,0x0d7fff,'Mexico','mx'],[0x0d8000,0x0dffff,'Venezuela','ve'],
[0x100000,0x1fffff,'Russia','ru'],[0x300000,0x33ffff,'Italy','it'],[0x340000,0x37ffff,'Spain','es'],[0x380000,0x3bffff,'France','fr'],[0x3c0000,0x3fffff,'Germany','de'],[0x400000,0x43ffff,'United Kingdom','gb'],[0x440000,0x447fff,'Austria','at'],[0x448000,0x44ffff,'Belgium','be'],[0x450000,0x457fff,'Bulgaria','bg'],[0x458000,0x45ffff,'Denmark','dk'],[0x460000,0x467fff,'Finland','fi'],[0x468000,0x46ffff,'Greece','gr'],[0x470000,0x477fff,'Hungary','hu'],[0x478000,0x47ffff,'Norway','no'],[0x480000,0x487fff,'Netherlands','nl'],[0x488000,0x48ffff,'Poland','pl'],[0x490000,0x497fff,'Portugal','pt'],[0x498000,0x49ffff,'Czechia','cz'],[0x4a0000,0x4a7fff,'Romania','ro'],[0x4a8000,0x4affff,'Sweden','se'],[0x4b0000,0x4b7fff,'Switzerland','ch'],[0x4b8000,0x4bffff,'Türkiye','tr'],[0x4ca000,0x4cafff,'Ireland','ie'],
[0x700000,0x700fff,'Afghanistan','af'],[0x702000,0x702fff,'Bangladesh','bd'],[0x704000,0x704fff,'Myanmar','mm'],[0x706000,0x706fff,'Kuwait','kw'],[0x708000,0x708fff,'Laos','la'],[0x710000,0x717fff,'Saudi Arabia','sa'],[0x718000,0x71ffff,'South Korea','kr'],[0x720000,0x727fff,'North Korea','kp'],[0x728000,0x72ffff,'Iraq','iq'],[0x730000,0x737fff,'Iran','ir'],[0x738000,0x73ffff,'Israel','il'],[0x740000,0x747fff,'Jordan','jo'],[0x748000,0x74ffff,'Lebanon','lb'],[0x750000,0x757fff,'Malaysia','my'],[0x758000,0x75ffff,'Philippines','ph'],[0x760000,0x767fff,'Pakistan','pk'],[0x768000,0x76ffff,'Singapore','sg'],[0x770000,0x777fff,'Sri Lanka','lk'],[0x778000,0x77ffff,'Syria','sy'],[0x789000,0x789fff,'Hong Kong','hk'],[0x780000,0x7bffff,'China','cn'],[0x7c0000,0x7fffff,'Australia','au'],[0x800000,0x83ffff,'India','in'],[0x840000,0x87ffff,'Japan','jp'],[0x880000,0x887fff,'Thailand','th'],[0x888000,0x88ffff,'Viet Nam','vn'],[0x890000,0x890fff,'Yemen','ye'],[0x894000,0x894fff,'Bahrain','bh'],[0x895000,0x895fff,'Brunei','bn'],[0x896000,0x896fff,'United Arab Emirates','ae'],[0x899000,0x899fff,'Taiwan','tw'],[0x8a0000,0x8a7fff,'Indonesia','id'],[0x8e0000,0x8e7fff,'Myanmar','mm'],[0x900000,0x900fff,'Afghanistan','af'],[0x901000,0x901fff,'Bangladesh','bd'],[0x903000,0x903fff,'Cambodia','kh'],[0x904000,0x904fff,'Laos','la'],[0x905000,0x905fff,'Nepal','np'],[0x906000,0x906fff,'Oman','om'],[0x907000,0x907fff,'Qatar','qa'],
[0xa00000,0xafffff,'United States','us'],[0xc00000,0xc3ffff,'Canada','ca'],[0xc80000,0xc87fff,'New Zealand','nz'],[0xe00000,0xe3ffff,'Argentina','ar'],[0xe40000,0xe7ffff,'Brazil','br'],[0xe80000,0xe80fff,'Chile','cl'],[0xe84000,0xe84fff,'Ecuador','ec'],[0xe88000,0xe88fff,'Paraguay','py'],[0xe8c000,0xe8cfff,'Peru','pe'],[0xe90000,0xe90fff,'Uruguay','uy']
];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function flag(code){return String(code||'').toUpperCase().replace(/[A-Z]/g,c=>String.fromCodePoint(127397+c.charCodeAt(0)))}
function country(hex){const n=parseInt(String(hex||'').replace(/^~/,''),16);if(!Number.isFinite(n))return null;const x=R.find(r=>n>=r[0]&&n<=r[1]);return x?{name:x[2],code:x[3],flag:flag(x[3])}:null}
function transform(html){
  if(typeof html!=='string'||!html.includes('class="detail-head"')||!html.includes('<span>ICAO</span>'))return html;
  const m=html.match(/<span>ICAO<\/span><span>([0-9A-Fa-f]{6})<\/span>/);if(!m)return html;
  const c=country(m[1]);
  const head=`<span class="plane-big hpr-flag-head" title="${esc(c?.name||'Country unavailable')}"><span class="hpr-country-flag" aria-hidden="true">${c?.flag||'—'}</span></span>`;
  html=html.replace(/<span class="plane-big"[^>]*>[\s\S]*?<\/span>/,head);
  if(c)html=html.replace(/(<span class="detail-title"><b>[\s\S]*?<\/b><small>)([\s\S]*?)(<\/small><\/span>)/,(_,a,b,z)=>`${a}${b}${b.includes(c.name)?'':` · ${esc(c.name)}`}${z}`);
  return html;
}
function install(){
  const detail=document.getElementById('detailBody');if(!detail||detail.__hprG5)return;detail.__hprG5=true;
  const d=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');if(!d?.get||!d?.set)return;
  Object.defineProperty(detail,'innerHTML',{configurable:true,get(){return d.get.call(this)},set(v){return d.set.call(this,transform(v))}});
  const style=document.createElement('style');style.textContent='.hpr-flag-head{background:var(--s2)!important;border:1px solid var(--border);overflow:hidden}.hpr-country-flag{font-size:30px;line-height:1;filter:none;transform:none}';document.head.appendChild(style);
}
document.addEventListener('DOMContentLoaded',install,{once:true});
window.HPREdgeCountry=Object.freeze({country,flag,transform});
})();
