/* HPRadar Edge local label policy. Keep configured Vietnamese labels visible
 * across MapLibre style reloads and keep blocked alternate labels hidden.
 */
(()=>{'use strict';
const SOURCE_ID='hpr-vn-archipelago-labels';
const LAYER_ID='hpr-vn-archipelago-labels';
const BLOCKED=['sansha','sansha city','nansha','nansha qundao','三沙','三沙市','南沙','南沙群岛'];
const DATA={type:'FeatureCollection',features:[
  {type:'Feature',properties:{name:'HOÀNG SA'},geometry:{type:'Point',coordinates:[112.25,16.50]}},
  {type:'Feature',properties:{name:'TRƯỜNG SA'},geometry:{type:'Point',coordinates:[114.25,10.00]}}
]};
function blockedFilter(){const name=['downcase',['coalesce',['get','name_en'],['get','name'],'']];return ['!', ['match',name,BLOCKED,true,false]]}
function ensure(map){
  if(!map?.isStyleLoaded?.())return false;
  try{
    if(map.getLayer('place-city')){
      if(map.__hprPlaceCityBaseFilter===undefined)map.__hprPlaceCityBaseFilter=map.getFilter('place-city')||null;
      const base=map.__hprPlaceCityBaseFilter;
      map.setFilter('place-city',base?['all',base,blockedFilter()]:blockedFilter());
    }
    const src=map.getSource(SOURCE_ID);
    if(src?.setData)src.setData(DATA);else map.addSource(SOURCE_ID,{type:'geojson',data:DATA});
    if(!map.getLayer(LAYER_ID)){
      const dark=document.documentElement.dataset.theme==='dark';
      const layer={id:LAYER_ID,type:'symbol',source:SOURCE_ID,minzoom:4,maxzoom:14,
        layout:{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':['interpolate',['linear'],['zoom'],4,9,9,12],'text-letter-spacing':0.05,'text-transform':'uppercase','text-allow-overlap':true,'text-ignore-placement':true,'text-optional':false},
        paint:{'text-color':dark?'#9fb1c8':'#3a5160','text-halo-color':dark?'#0a1018':'#ffffff','text-halo-width':1.2,'text-halo-blur':0.2,'text-opacity':.88}};
      const before=map.getLayer('aircraft-symbol')?'aircraft-symbol':undefined;
      map.addLayer(layer,before);
    } else map.setLayoutProperty?.(LAYER_ID,'visibility','visible');
    return true;
  }catch(e){console.warn('HPR map label policy',e);return false}
}
function schedule(map){ensure(map);for(const delay of [80,250,750])setTimeout(()=>ensure(map),delay)}
function bind(){
  const map=window.HPREdgeMap;if(!map)return false;
  if(!map.__hprMapPolicyBound){map.__hprMapPolicyBound=true;map.on('style.load',()=>schedule(map));map.on('idle',()=>{if(!map.getLayer?.(LAYER_ID))ensure(map)})}
  schedule(map);return true;
}
const timer=setInterval(()=>{if(bind())clearInterval(timer)},100);
window.HPREdgeMapPolicy=Object.freeze({apply:ensure,ensure,labels:()=>DATA,blockedNames:()=>BLOCKED.slice()});
})();