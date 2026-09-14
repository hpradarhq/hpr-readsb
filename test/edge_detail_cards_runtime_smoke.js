'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const code=fs.readFileSync('hpr/edge/ui/edge-detail-cards.js','utf8');
let domReady=null,observed=null,observeOptions=null;
const body={
  classList:{add:()=>{},remove:()=>{}},
  querySelector:()=>null,
  querySelectorAll:()=>[]
};
const document={
  addEventListener:(name,cb)=>{if(name==='DOMContentLoaded')domReady=cb},
  querySelector:(s)=>s==='#detailBody'?body:null,
  querySelectorAll:()=>[],
  createElement:()=>({}),
  head:{appendChild:()=>{}}
};
function MutationObserver(cb){this.cb=cb;this.observe=(target,options)=>{observed=target;observeOptions=options}}
const context={window:{},document,console,Object,Array,Number,String,Math,MutationObserver,queueMicrotask:()=>{},setInterval:()=>1};
vm.createContext(context);vm.runInContext(code,context,{filename:'edge-detail-cards.js'});
assert(domReady,'DOMContentLoaded hook missing');
domReady();
assert.strictEqual(observed,body,'detail observer must attach to detail body');
assert.strictEqual(observeOptions.childList,true,'detail observer must watch detail replacement');
assert.notStrictEqual(observeOptions.subtree,true,'detail observer must not watch its own card subtree mutations');
assert(context.window.HPREdgeDetailCards,'detail cards export missing');
console.log('edge detail observer runtime smoke PASS');
