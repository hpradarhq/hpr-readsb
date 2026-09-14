'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('hpr/edge/ui/edge-calm-ui.js','utf8');
function MapMock(){this.added=[]}
MapMock.prototype.addLayer=function(layer,before){this.added.push([layer,before]);return this};
const window={maplibregl:{Map:MapMock}};
const document={addEventListener:()=>{},querySelector:()=>null,querySelectorAll:()=>[],head:{appendChild:()=>{}},createElement:()=>({})};
const context={window,document,console,Object,Array,Map,JSON,performance:{now:()=>0},setInterval:()=>1,clearInterval:()=>{},MutationObserver:function(){},queueMicrotask:()=>{}};
vm.createContext(context);vm.runInContext(code,context,{filename:'edge-calm-ui.js'});
assert(window.HPREdgeCalm,'calm UI export missing');
assert.strictEqual(window.HPREdgeCalm.tableRefreshMs,2500);
const m=new window.maplibregl.Map();
m.addLayer({id:'aircraft-selected-emphasis',type:'symbol'});
assert.strictEqual(m.added.length,0,'selected shadow layer must be suppressed');
m.addLayer({id:'aircraft-symbol',layout:{'icon-size':1}});
assert.strictEqual(m.added.length,1,'aircraft symbol should be added');
const expr=m.added[0][0].layout['icon-size'];
assert.strictEqual(expr[0],'interpolate','selected marker must use one top-level zoom interpolation');
function countZoomBased(node){
  if(!Array.isArray(node))return 0;
  let n=0;
  if((node[0]==='interpolate'||node[0]==='step')&&Array.isArray(node[2])&&node[2][0]==='zoom')n++;
  for(const child of node)n+=countZoomBased(child);
  return n;
}
assert.strictEqual(countZoomBased(expr),1,'MapLibre allows only one zoom-based step/interpolate subexpression');
m.addLayer({id:'aircraft-label',paint:{'text-color':'#fff'}});
assert.strictEqual(m.added[1][0].paint['text-color'][0],'case','selected label must use accent expression');
console.log('edge calm UI runtime smoke PASS');
