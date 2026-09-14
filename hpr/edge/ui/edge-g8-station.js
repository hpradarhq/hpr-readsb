/* G8: compact FR24-like station overview from already-rendered local station data. */
(()=>{'use strict';
const capture=(html,label)=>{const m=html.match(new RegExp(`<span>${label}<\\/span><span>([\\s\\S]*?)<\\/span>`));return m?m[1]:'&mdash;'};
const metric=(html,label)=>{const m=html.match(new RegExp(`<div class="metric"><small>${label}<\\/small><b>([\\s\\S]*?)<\\/b><\\/div>`));return m?m[1]:'&mdash;'};
function transform(html){
  if(typeof html!=='string'||html.includes('<span>ICAO</span>')||!html.includes('<h3>Capabilities</h3>')||html.includes('data-hpr-g8="1"'))return html;
  const title=html.match(/<span class="detail-title"><b>([\s\S]*?)<\/b><small>([\s\S]*?)<\/small><\/span>/),name=title?.[1]||'HPR Edge',sub=title?.[2]||'',parts=sub.split(' · '),software=parts[0]||'readsb',coords=parts.slice(1).join(' · ')||'Position not configured';
  const online=window.HPRAirWire?.stats?.().connected!==false;
  const card=`<div class="hpr-station-overview" data-hpr-g8="1"><div class="hpr-station-title"><div><small>STATION</small><b>${name}</b></div><span class="${online?'online':'offline'}">${online?'Online':'Offline'}</span></div><div class="hpr-station-kv"><span>Coordinates</span><b>${coords}</b><span>UUID</span><b>${capture(html,'UUID')}</b><span>Software</span><b>${software}</b><span>Aircraft now</span><b>${metric(html,'Aircraft')}</b><span>AirWire frames</span><b>${capture(html,'Total messages')}</b><span>Signal</span><b>${metric(html,'Signal')}</b></div></div>`;
  html=html.replace('<div class="detail-head">','<div class="detail-head hpr-station-head">');
  return html.replace('<div class="metric-grid">',card+'<div class="metric-grid">');
}
function install(){const root=document.getElementById('detailBody');if(!root||root.__hprG8)return;root.__hprG8=true;const own=Object.getOwnPropertyDescriptor(root,'innerHTML'),base=own||Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');if(!base?.get||!base?.set)return;Object.defineProperty(root,'innerHTML',{configurable:true,get(){return base.get.call(this)},set(v){return base.set.call(this,transform(v))}});const s=document.createElement('style');s.textContent='.hpr-station-head .plane-big{display:none}.hpr-station-overview{padding:10px 12px;border-bottom:1px solid var(--border);background:var(--s2)}.hpr-station-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}.hpr-station-title small{display:block;color:var(--muted);font-size:8px;letter-spacing:.6px}.hpr-station-title b{font-size:15px}.hpr-station-title>span{padding:3px 7px;border-radius:10px;font-size:8px;font-weight:800}.hpr-station-title .online{color:var(--live);background:color-mix(in srgb,var(--live) 12%,transparent)}.hpr-station-title .offline{color:var(--danger);background:color-mix(in srgb,var(--danger) 12%,transparent)}.hpr-station-kv{display:grid;grid-template-columns:92px 1fr;gap:5px 8px;font-size:9px}.hpr-station-kv span{color:var(--muted)}.hpr-station-kv b{text-align:right;overflow-wrap:anywhere}';document.head.appendChild(s)}
document.addEventListener('DOMContentLoaded',install,{once:true});
window.HPREdgeStation=Object.freeze({transform});
})();
