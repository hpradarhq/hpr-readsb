/* G3: selected aircraft is emphasized by its silhouette only; no selected halo. */
(()=>{'use strict';
const MapCtor=window.maplibregl?.Map;if(!MapCtor)return;
const original=MapCtor.prototype.addLayer;
MapCtor.prototype.addLayer=function(layer,before){
  if(layer?.id==='aircraft-halo'){
    layer={...layer,paint:{...layer.paint,
      'circle-radius':8,
      'circle-stroke-width':1,
      'circle-stroke-color':['match',['get','status'],'live','#42dfa3','aging','#ffb84d','#70869c']
    }};
  }
  if(layer?.id==='aircraft-symbol'){
    const normal=['interpolate',['linear'],['zoom'],5,.56,8,.72,12,.96];
    const selected=['interpolate',['linear'],['zoom'],5,.64,8,.82,12,1.10];
    layer={...layer,layout:{...layer.layout,'icon-size':['case',['==',['get','selected'],1],selected,normal]}};
  }
  return original.call(this,layer,before);
};
})();
