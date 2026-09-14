/* E7 browser benchmark capture.
 * Enabled only with ?bench=1. Records operator task time/clicks and browser timing.
 * The same eight tasks are intended to be performed against tar1090 on the same Pi/browser/RF input.
 */
(()=>{'use strict';
if(new URLSearchParams(location.search).get('bench')!=='1')return;
const TASKS=[
 ['find_aircraft','Find a named aircraft'],
 ['filter_rotor','Show rotorcraft only'],
 ['find_emergency','Show emergency aircraft'],
 ['open_detail','Open selected aircraft detail'],
 ['show_trace','Show real selected trace'],
 ['replay','Start and scrub replay'],
 ['all_tracks','Show all recent tracks'],
 ['coverage','Show receiver coverage']
];
const state={suite:'HPR Edge',startedAt:new Date().toISOString(),task:null,start:0,clicks:0,runs:[],firstAircraftMs:null,firstMapMs:null};
const $=s=>document.querySelector(s);
function aircraftCount(){return Number(window.HPRAirWire?.stats?.().aircraft||0)}
function memory(){const m=performance.memory;return m?{usedJSHeap:m.usedJSHeapSize,totalJSHeap:m.totalJSHeapSize,limit:m.jsHeapSizeLimit}:null}
function navMetrics(){const n=performance.getEntriesByType('navigation')[0];return n?{domInteractive:n.domInteractive,domContentLoaded:n.domContentLoadedEventEnd,loadEvent:n.loadEventEnd,transferSize:n.transferSize,encodedBodySize:n.encodedBodySize}:null}
function base(){return{suite:state.suite,startedAt:state.startedAt,url:location.href,userAgent:navigator.userAgent,viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio},hardwareConcurrency:navigator.hardwareConcurrency||null,deviceMemory:navigator.deviceMemory||null,aircraft:aircraftCount(),firstAircraftMs:state.firstAircraftMs,firstMapMs:state.firstMapMs,navigation:navMetrics(),memory:memory(),runs:state.runs}}
function renderStatus(t){const e=$('#e7Status');if(e)e.textContent=t}
function begin(){if(state.task)return;const task=$('#e7Task').value;state.task=task;state.start=performance.now();state.clicks=0;renderStatus(`RUNNING · ${task}`);$('#e7Start').disabled=true;$('#e7Done').disabled=false;$('#e7Fail').disabled=false}
function finish(ok){if(!state.task)return;state.runs.push({task:state.task,ok,ms:Math.round(performance.now()-state.start),clicks:state.clicks,aircraft:aircraftCount(),at:new Date().toISOString()});renderStatus(`${ok?'PASS':'FAIL'} · ${state.task} · ${state.runs.at(-1).ms} ms · ${state.clicks} clicks`);state.task=null;$('#e7Start').disabled=false;$('#e7Done').disabled=true;$('#e7Fail').disabled=true;renderRuns()}
function renderRuns(){const e=$('#e7Runs');if(!e)return;e.innerHTML=state.runs.map(r=>`<div class="${r.ok?'ok':'bad'}"><span>${r.task}</span><b>${r.ok?(r.ms/1000).toFixed(2)+'s':'FAIL'}</b><small>${r.clicks} clicks</small></div>`).join('')}
function exportJson(){const blob=new Blob([JSON.stringify(base(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`e7-edge-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function build(){
 const p=document.createElement('section');p.id='e7Bench';p.innerHTML=`<header><b>E7 BENCHMARK</b><button id="e7Close">×</button></header><label>Task<select id="e7Task">${TASKS.map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><div class="e7-buttons"><button id="e7Start">Start</button><button id="e7Done" disabled>Done</button><button id="e7Fail" disabled>Fail</button></div><div id="e7Status">Ready · same Pi/browser/RF input</div><div id="e7Runs"></div><button id="e7Export">Export JSON</button>`;document.body.appendChild(p);
 const s=document.createElement('style');s.textContent=`#e7Bench{position:fixed;z-index:120;right:8px;top:56px;width:250px;background:var(--solid);border:1px solid var(--accent);border-radius:8px;box-shadow:var(--shadow);padding:9px;color:var(--text);font:10px system-ui}#e7Bench header{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}#e7Bench header b{color:var(--accent);letter-spacing:.6px}#e7Bench header button{border:0;background:transparent;color:var(--muted);font-size:18px}#e7Bench label{display:grid;gap:3px;color:var(--muted)}#e7Bench select,#e7Bench button{height:29px;border:1px solid var(--border);border-radius:5px;background:var(--s2);color:var(--text);font:10px system-ui}.e7-buttons{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin:6px 0}#e7Status{padding:6px;border-radius:5px;background:var(--s2);color:var(--text2);margin-bottom:5px}#e7Runs{max-height:210px;overflow:auto}#e7Runs>div{display:grid;grid-template-columns:1fr auto;gap:2px 7px;padding:4px 2px;border-bottom:1px solid var(--border)}#e7Runs small{grid-column:1/3;color:var(--muted)}#e7Runs .ok b{color:var(--live)}#e7Runs .bad b{color:var(--danger)}#e7Export{width:100%;margin-top:6px;border-color:var(--accent)!important;color:var(--accent)!important}`;document.head.appendChild(s);
 $('#e7Start').onclick=begin;$('#e7Done').onclick=()=>finish(true);$('#e7Fail').onclick=()=>finish(false);$('#e7Export').onclick=exportJson;$('#e7Close').onclick=()=>p.remove();
 document.addEventListener('click',e=>{if(state.task&&!e.target.closest('#e7Bench'))state.clicks++},true);
}
function observeBoot(){const start=performance.now();const t=setInterval(()=>{if(state.firstAircraftMs==null&&aircraftCount()>0)state.firstAircraftMs=Math.round(performance.now());if(state.firstMapMs==null&&window.HPREdgeMap?.loaded?.())state.firstMapMs=Math.round(performance.now());if((state.firstAircraftMs!=null&&state.firstMapMs!=null)||performance.now()-start>30000)clearInterval(t)},100)}
document.addEventListener('DOMContentLoaded',()=>{build();observeBoot()},{once:true});
})();
