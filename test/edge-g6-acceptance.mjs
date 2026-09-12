import fs from 'node:fs';
import os from 'node:os';
import process from 'node:process';

const base=(process.argv[2]||'http://127.0.0.1').replace(/\/$/,'');
const sampleCount=Number(process.env.HPR_G6_SAMPLES||60);
const requiredAircraft=Number(process.env.HPR_G6_REQUIRE_AIRCRAFT||0);
const allowNonArm=process.env.HPR_G6_ALLOW_NON_ARM==='1';
const receiptPath=process.env.HPR_G6_RECEIPT||`g6-acceptance-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const percentile=(values,p)=>values.slice().sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))];
async function get(path){const started=performance.now();const response=await fetch(base+path,{cache:'no-store',signal:AbortSignal.timeout(3000)});if(!response.ok)throw Error(`${path}: HTTP ${response.status}`);return{json:await response.json(),latencyMs:performance.now()-started}}

const receipt={gate:'G6',base,startedAt:new Date().toISOString(),platform:{arch:process.arch,model:os.cpus()[0]?.model||'unknown',cores:os.cpus().length,memoryBytes:os.totalmem()},sampleCount,requiredAircraft,checks:{},samples:[]};
let pass=true;
try{
  const [version,receiver,stats,station]=await Promise.all(['/version.json','/api/readsb/receiver.json','/data/stats.json','/api/readsb/station.json'].map(get));
  receipt.context={version:version.json,receiver:receiver.json,station:station.json};
  receipt.checks.armPlatform={pass:allowNonArm||['arm','arm64'].includes(process.arch),actual:process.arch};
  receipt.checks.rtlsdrActive={pass:Number(stats.json?.latest?.local?.blocks_processed||stats.json?.last1min?.local?.blocks_processed||0)>0};
  for(let i=0;i<sampleCount;i++){
    const sample=await get('/api/air/v1');const payload=sample.json;
    if(!Array.isArray(payload)||payload[0]!==1||!Array.isArray(payload[3]))throw Error('invalid AirWire v1 envelope');
    receipt.samples.push({at:Date.now(),latencyMs:sample.latencyMs,generationTime:payload[1],totalMessages:payload[2],aircraft:payload[3].length,bytes:Buffer.byteLength(JSON.stringify(payload))});
    if(i+1<sampleCount)await wait(1000);
  }
  const latencies=receipt.samples.map(x=>x.latencyMs),generations=receipt.samples.map(x=>x.generationTime),counts=receipt.samples.map(x=>x.totalMessages);
  const generationDeltas=generations.slice(1).map((value,index)=>value-generations[index]);
  receipt.metrics={p95LatencyMs:percentile(latencies,.95),medianGenerationIntervalMs:percentile(generationDeltas,.5),maxAircraft:Math.max(...receipt.samples.map(x=>x.aircraft)),maxPayloadBytes:Math.max(...receipt.samples.map(x=>x.bytes)),messageIncrease:counts.at(-1)-counts[0]};
  receipt.checks.airwirePolling={pass:receipt.samples.length===sampleCount};
  receipt.checks.endpointLatency={pass:receipt.metrics.p95LatencyMs<=250,limitMs:250};
  receipt.checks.oneHertz={pass:receipt.metrics.medianGenerationIntervalMs>=500&&receipt.metrics.medianGenerationIntervalMs<=1500,rangeMs:[500,1500]};
  receipt.checks.liveMessages={pass:receipt.metrics.messageIncrease>0};
  receipt.checks.aircraftCapacity={pass:receipt.metrics.maxAircraft>=requiredAircraft&&receipt.metrics.maxAircraft<=400,observed:receipt.metrics.maxAircraft,required:requiredAircraft,designLimit:400};
  pass=Object.values(receipt.checks).every(check=>check.pass);
}catch(error){receipt.error=String(error?.stack||error);pass=false}
receipt.completedAt=new Date().toISOString();receipt.result=pass?'PASS':'FAIL';
fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');
console.log(`${receipt.result}: G6 receipt ${receiptPath}`);
if(!pass)process.exitCode=1;
