/* Edge trace policy: selected-aircraft trace only.
 * The previous all-tracks view connected raw recent points too aggressively and is
 * intentionally withheld until it has the same segmentation guarantees as selected trace.
 */
(()=>{'use strict';
const EMPTY={type:'FeatureCollection',features:[]};
function stripUrl(){try{const u=new URL(location.href);let changed=false;for(const k of ['allTracks','tracks'])if(u.searchParams.has(k)){u.searchParams.delete(k);changed=true}if(changed)history.replaceState(null,'',u.pathname+(u.search?'?'+u.searchParams.toString():''))}catch(_){}}
function enforce(){
  const b=document.querySelector('#hprAllTracks'),m=document.querySelector('#hprTrackMinutes');if(b){b.hidden=true;b.setAttribute('aria-hidden','true')}if(m){m.hidden=true;m.setAttribute('aria-hidden','true')}
  try{window.HPREdgeMap?.getSource?.('hpr-all-tracks')?.setData(EMPTY)}catch(_){}
}
stripUrl();
document.addEventListener('DOMContentLoaded',()=>{enforce();setTimeout(enforce,500);setTimeout(enforce,3000)},{once:true});
window.HPREdgeTracePolicy=Object.freeze({mode:'selected-only',enforce,stripUrl});
})();