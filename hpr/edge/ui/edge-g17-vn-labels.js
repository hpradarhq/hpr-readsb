/* G17: Vietnam archipelago label policy. No polling/observer loops. */
(()=>{'use strict';
const SOURCE_ID='hpr-vn-archipelago-labels',LAYER_ID='hpr-vn-archipelago-labels';
const BLOCKED=['sansha','sansha city','nansha','nansha qundao','三沙','三沙市','南沙','南沙群岛'];
const DATA={type:'FeatureCollection',features:[
  {type:'Feature',properties:{name:'HOÀNG SA'},geometry:{type:'Point',coordinates:[112.25,16.50]}},
  {type:'Feature',properties:{name:'TRƯỜNG SA'},geometry:{type:'Point',coordinates:[114.25,10.00]}}
]};
const nameExpr=['downcase',['coalesce',['get','name_en'],['get','name:en'],['get','name'],'']];
const denyExpr=()=>['!', ['match',nameExpr,BLOCKED,true,false]];
function labelLayers(map){return(map.getStyle?.()?.layers||[]).filter(l=>l?.id!==LAYER_ID&&l?.type==='symbol'&&!/aircraft|hpr/i.test(l.id||'')&&/place|city|town|settlement|label/i.test(l.id||'')&&l.layout?.['text-field'])}
function installDenyFilters(map,fresh=false){if(fresh||!(map.__hprG17BaseFilters instanceof Map))map.__hprG17BaseFilters=new Map();for(const l of labelLayers(map)){if(!map.__hprG17BaseFilters.has(l.id))map.__hprG17BaseFilters.set(l.id,map.getFilter?.(l.id)||null);const base=map.__hprG17BaseFilters.get(l.id),deny=denyExpr();try{map.setFilter?.(l.id,base?['all',base,deny]:deny)}catch(_){}}}
function addLabels(map){const src=map.getSource?.(SOURCE_ID);if(src?.setData)src.setData(DATA);else map.addSource?.(SOURCE_ID,{type:'geojson',data:DATA});if(!map.getLayer?.(LAYER_ID)){const dark=document.documentElement.dataset.theme==='dark';const before=map.getLayer?.('aircraft-symbol')?'aircraft-symbol':undefined;map.addLayer?.({id:LAYER_ID,type:'symbol',source:SOURCE_ID,minzoom:4,maxzoom:14,layout:{'text-field':['get','name'],'text-size':['interpolate',['linear'],['zoom'],4,9,9,12],'text-letter-spacing':.05,'text-transform':'uppercase','text-allow-overlap':true,'text-ignore-placement':true,'text-optional':false},paint:{'text-color':dark?'#9fb1c8':'#3a5160','text-halo-color':dark?'#0a1018':'#ffffff','text-halo-width':1.2,'text-halo-blur':.2,'text-opacity':.88}},before)}else map.setLayoutProperty?.(LAYER_ID,'visibility','visible')}
function apply(map=window.HPREdgeMap,fresh=false){if(!map)return false;try{installDenyFilters(map,fresh);addLabels(map);return true}catch(_){return false}}
function bind(){const map=window.HPREdgeMap;if(!map||map.__hprG17Bound)return false;map.__hprG17Bound=true;map.on?.('style.load',()=>apply(map,true));if(map.isStyleLoaded?.()!==false)apply(map,true);return true}
document.addEventListener('DOMContentLoaded',bind,{once:true});
window.HPREdgeVNLabels=Object.freeze({apply,labels:()=>DATA,blockedNames:()=>BLOCKED.slice(),_test:{labelLayers,denyExpr}});
})();
