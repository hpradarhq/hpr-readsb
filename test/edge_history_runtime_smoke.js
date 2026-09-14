'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('hpr/edge/ui/edge-history.js','utf8');
function NativeMap(){}
const window={maplibregl:{Map:NativeMap}};
const document={addEventListener:()=>{},querySelector:()=>null,createElement:()=>({})};
const context={window,document,console,Object,Array,Map,JSON,Date,Math,Number,String,Promise,setInterval:()=>1,clearInterval:()=>{},setTimeout:()=>1,requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},performance:{now:()=>0},fetch:async()=>({ok:false,json:async()=>({})})};
vm.createContext(context);vm.runInContext(code,context,{filename:'edge-history.js'});
assert(window.HPREdgeHistory,'history export missing');
const t=window.HPREdgeHistory._test;assert(t,'history test hooks missing');
const base=100000;
const raw=[
  {ts:base,lat:20,lon:106,flags:0},
  {ts:base+30,lat:20.03,lon:106.04,flags:0},
  {ts:base+60,lat:20.06,lon:106.08,flags:0},
  {ts:base+90,lat:35,lon:120,flags:0}, // impossible jump: must start a new segment
  {ts:base+120,lat:20.09,lon:106.12,flags:2}, // readsb new-leg bit
  {ts:base+150,lat:20.12,lon:106.16,flags:0}
];
const clean=t.sanitizeTrace(raw,90);
assert.strictEqual(clean.length,raw.length);
assert.strictEqual(clean[3].breakBefore,true,'impossible position jump must break the trace');
assert.strictEqual(clean[4].breakBefore,true,'readsb new-leg flag must break the trace');
const geo=t.traceToGeo(clean);
assert(geo.features.length>=2,'broken trace must render as separate line features');
for(const f of geo.features)assert(f.geometry.coordinates.length>=2,'single bad points must not become visible lines');
const recentText=code.indexOf("getJson(traceUrl(id,'recent'))"),fullText=code.indexOf("getJson(traceUrl(id,'full'))");
assert(recentText>=0&&fullText>recentText,'trace_recent must be preferred before trace_full fallback');
assert(!code.includes('Promise.allSettled([getJson(traceUrl(id,\'full\'))'),'full and recent traces must never be merged');
assert(code.includes("map.addLayer({id:'hpr-readsb-trace'")&&code.includes("before);"),'trace layer must be inserted below aircraft when possible');
console.log('edge history runtime smoke PASS');
