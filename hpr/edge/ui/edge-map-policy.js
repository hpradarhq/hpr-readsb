/* HPRadar Edge local map-label policy.
 * Scope: labels only. Does not alter boundary geometry or source tiles.
 * Vietnamese profile suppresses PRC administrative labels for the disputed
 * archipelagos and renders HPR-controlled Vietnamese place labels.
 */
(()=>{'use strict';
const SOURCE_ID='hpr-vn-archipelago-labels';
const LAYER_ID='hpr-vn-archipelago-labels';
const BLOCKED=['sansha','sansha city','nansha','nansha qundao','三沙','三沙市','南沙','南沙群岛'];
const DATA={type:'FeatureCollection',features:[
  {type:'Feature',properties:{name:'HOÀNG SA'},geometry:{type:'Point',coordinates:[112.25,16.50]}},
  {type:'Feature',properties:{name:'TRƯỜNG SA'},geometry:{type:'Point',coordinates:[114.25,10.00]}}
]};
function blockedFilter(){
  const name=['downcase',['coalesce',['get','name_en'],['get','name'],'']];
  return ['!', ['match',name,BLOCKED,true,false]];
}
function apply(map){
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
      const layer={
        id:LAYER_ID,type:'symbol',source:SOURCE_ID,minzoom:4,maxzoom:15,
        layout:{
          'text-field':['get','name'],
          'text-font':['Noto Sans Regular'],
          'text-size':['interpolate',['linear'],['zoom'],4,12,7,15,10,18],
          'text-letter-spacing':0.08,
          'text-allow-overlap':true,
          'text-ignore-placement':false
        },
        paint:{
          'text-color':dark?'#f3f8ff':'#10272f',
          'text-halo-color':dark?'#07121e':'#fffef9',
          'text-halo-width':2,
          'text-halo-blur':0.4
        }
      };
      const before=map.getLayer('aircraft-symbol')?'aircraft-symbol':undefined;
      map.addLayer(layer,before);
    }
    return true;
  }catch(e){console.warn('HPR map label policy',e);return false}
}
function bind(){
  const map=window.HPREdgeMap;if(!map)return false;
  if(!map.__hprMapPolicyBound){map.__hprMapPolicyBound=true;map.on('style.load',()=>apply(map));}
  apply(map);return true;
}
const timer=setInterval(()=>{if(bind())clearInterval(timer)},100);
window.HPREdgeMapPolicy=Object.freeze({apply,labels:()=>DATA,blockedNames:()=>BLOCKED.slice()});
})();