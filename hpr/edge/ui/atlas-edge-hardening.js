/* Edge production hardening for the byte-identical Atlas V4.7 shell. */
(()=>{'use strict';
const empty=()=>({type:'FeatureCollection',features:[]});

// Canonical V4.7 carries deterministic demo catalog/network/environment data.
// Edge production must expose only data backed by local readsb/AirWire contracts.
try{REFERENCE_ENTITIES.splice(0,REFERENCE_ENTITIES.length)}catch(_){}
try{NETWORK_ENTITIES.splice(0,NETWORK_ENTITIES.length)}catch(_){}
try{for(const key of Object.keys(RELATIONS))delete RELATIONS[key]}catch(_){}
try{weatherCollection=empty}catch(_){}

const style=document.createElement('style');
style.id='atlas-edge-production-style';
style.textContent=`
.entity-icon .rotorcraft-art{display:block;width:25px;height:25px;max-width:25px;max-height:25px;object-fit:contain}
.photo-frame.aircraft .photo-asset>.rotorcraft-art{display:block;width:100%;height:auto;max-height:116px;object-fit:contain}
`;
document.head.appendChild(style);

function clearDemoSources(){
  if(!map)return;
  for(const id of ['atlas-vessel','atlas-aton','atlas-source','atlas-airports','atlas-seaports','atlas-flight-routes','atlas-sea-lanes','atlas-weather','atlas-meteo-aton']){
    try{map.getSource(id)?.setData(empty())}catch(_){}
  }
}
function bindMap(){
  if(!map){setTimeout(bindMap,100);return}
  clearDemoSources();
  map.on('style.load',()=>setTimeout(clearDemoSources,25));
}

const canonicalRenderTool=renderTool;
renderTool=function(name){
  canonicalRenderTool(name);
  if(name==='settings'){
    const code=document.querySelector('#toolBody .tool-note code');
    if(code)code.innerHTML='Canonical Atlas V4.7 shell<br>Live AirWire v1 + readsb context';
  }
  if(name==='weather'){
    const note=document.querySelector('#toolBody .tool-note');
    if(note)note.innerHTML='<b>Edge receiver scope.</b> No local meteo/hydro contract is wired; environment sources remain empty.';
  }
};

bindMap();
})();
