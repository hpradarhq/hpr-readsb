'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('hpr/edge/ui/edge-map-policy.js','utf8');
const calls={filters:[],sources:[],layers:[],events:{}};
const sources=new Map(),layers=new Map([['place-city',{}],['aircraft-symbol',{}]]);
const map={
  __hprPlaceCityBaseFilter:undefined,
  isStyleLoaded:()=>true,
  getLayer:id=>layers.get(id)||null,
  getFilter:id=>id==='place-city'?['all',['==',['get','class'],'city']]:null,
  setFilter:(id,f)=>calls.filters.push([id,f]),
  getSource:id=>sources.get(id)||null,
  addSource:(id,s)=>{calls.sources.push([id,s]);sources.set(id,{setData:d=>{sources.get(id).data=d},data:s.data})},
  addLayer:(l,before)=>{calls.layers.push([l,before]);layers.set(l.id,l)},
  on:(ev,fn)=>{calls.events[ev]=fn}
};
const window={HPREdgeMap:map};
const document={documentElement:{dataset:{theme:'dark'}}};
let timerCb=null;
const context={window,document,console,Object,Array,Map,JSON,setInterval:fn=>{timerCb=fn;return 1},clearInterval:()=>{}};
vm.createContext(context);
vm.runInContext(code,context,{filename:'edge-map-policy.js'});
assert.strictEqual(typeof timerCb,'function','map bind timer missing');
timerCb();
assert(window.HPREdgeMapPolicy,'map policy export missing');
assert.strictEqual(typeof window.HPREdgeMapPolicy.apply,'function');
assert.strictEqual(calls.filters.length,1,'place-city filter not applied');
const filterText=JSON.stringify(calls.filters[0][1]).toLowerCase();
assert(filterText.includes('sansha'),'Sansha not blocked');
assert(filterText.includes('nansha'),'Nansha not blocked');
assert.strictEqual(calls.sources.length,1,'label source not added');
const names=calls.sources[0][1].data.features.map(f=>f.properties.name);
assert.strictEqual(JSON.stringify(names),JSON.stringify(['HOÀNG SA','TRƯỜNG SA']),'localized labels mismatch');
assert.strictEqual(calls.layers.length,1,'label layer not added');
assert.strictEqual(calls.layers[0][0].id,'hpr-vn-archipelago-labels');
assert(calls.events['style.load'],'style.load reapply handler missing');
console.log('edge map policy runtime smoke PASS');