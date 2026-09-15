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
    // MapLibre permits only one zoom-based subexpression per expression, so the
    // selected/normal switch must live inside the interpolation stops.
    const sel=['==',['get','selected'],1];
    layer={...layer,layout:{...layer.layout,'icon-size':['interpolate',['linear'],['zoom'],5,['case',sel,.64,.56],8,['case',sel,.82,.72],12,['case',sel,1.10,.96]]}};
  }
  return original.call(this,layer,before);
};
})();
