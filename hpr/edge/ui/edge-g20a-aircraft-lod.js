/* G20A: Atlas aircraft silhouettes at operational zoom; decluttered dots only at low zoom. */
(()=>{'use strict';
if(!window.maplibregl?.Map)return;
const proto=window.maplibregl.Map.prototype;
if(proto.__hprG20a)return;
const addLayer=proto.addLayer;
proto.addLayer=function(layer,beforeId){
  if(!layer||!layer.id)return addLayer.call(this,layer,beforeId);
  if(layer.id==='aircraft-halo'){
    const dot={
      id:'aircraft-lod-dot',type:'symbol',source:layer.source,maxzoom:5.8,
      layout:{
        'text-field':'●','text-font':['Noto Sans Regular'],'text-size':['interpolate',['linear'],['zoom'],2,8,5.8,10],
        'text-allow-overlap':false,'text-ignore-placement':false,
        'symbol-sort-key':['case',['==',['get','selected'],1],0,['match',['get','status'],'live',1,'aging',2,3]]
      },
      paint:{
        'text-color':['match',['get','status'],'live','#42dfa3','aging','#ffb84d','#70869c'],
        'text-halo-color':'rgba(0,0,0,.32)','text-halo-width':1
      }
    };
    addLayer.call(this,dot,beforeId);
    // Selected emphasis is the silhouette only (G3); no status ring.
    layer={...layer,minzoom:5.8,paint:{...layer.paint,'circle-opacity':0,'circle-stroke-opacity':0,'circle-stroke-width':0}};
  }
  if(layer.id==='aircraft-symbol'){
    // Icons always render at operational zoom; only labels/dots declutter.
    layer={...layer,minzoom:5.4,layout:{...layer.layout,
      'icon-size':['interpolate',['linear'],['zoom'],5.4,.48,7,.62,9,.78,12,.96],
      'icon-allow-overlap':true,'icon-ignore-placement':true,
      'symbol-sort-key':['case',['==',['get','selected'],1],0,['match',['get','status'],'live',1,'aging',2,3]]
    }};
    const result=addLayer.call(this,layer,beforeId);
    const selected={...layer,id:'aircraft-selected-symbol',minzoom:4.6,filter:['==',['get','selected'],1],layout:{...layer.layout,'icon-size':['interpolate',['linear'],['zoom'],4.6,.52,7,.7,12,1.02],'icon-allow-overlap':true,'icon-ignore-placement':true}};
    addLayer.call(this,selected,beforeId);
    return result;
  }
  if(layer.id==='aircraft-label'){
    layer={...layer,minzoom:6.4,layout:{...layer.layout,'text-allow-overlap':false,'text-ignore-placement':false,'text-optional':true}};
  }
  return addLayer.call(this,layer,beforeId);
};
proto.__hprG20a=true;
})();
