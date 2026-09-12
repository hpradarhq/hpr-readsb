import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import vm from 'node:vm';

const context={window:{}};vm.runInNewContext(fs.readFileSync('hpr/edge/ui/aircraft-renderer.js','utf8'),context);
const renderer=context.window.HPRAircraftRenderer;
const exact={MH6:['xBoeing_MH-6_1.svg','cf9222c6d9d13343b20ad6172035a7042119b85e'],B222:['xBell_222_1.svg','74540671f8ae6c779f606ca3262d7944b04b8d49'],V22:['V22.svg','906bf24fc5db3374889352f8db599be8b584c377'],AH1Z:['Bell_AH-1Z_Viper.svg','f9f0770ebc2fb655ad88e8f55ffb5519e4f1057f'],AH1J:['Bell_AH-1J.svg','cddf3b730442763a9937ed6c46960c8e49d10243'],A129:['Augusta_A129.svg','41c360eb930d5301f5febe5053ae69988e798ed0']};
for(const [typeCode,[file,blob]] of Object.entries(exact)){
  const aircraft={kind:'aircraft',typeCode};
  assert.equal(renderer.iconKey(aircraft),`rotor-${typeCode}`);
  assert.equal(renderer.exactRotorcraft(aircraft).url,`assets/rotorcraft/${file}`);
  assert.equal(execFileSync('git',['hash-object',`hpr/edge/ui/assets/rotorcraft/${file}`],{encoding:'utf8'}).trim(),blob);
}
assert.equal(renderer.rotorcraftReason({kind:'aircraft',categoryCode:'A7'}),'category');
assert.equal(renderer.isRotorcraft({kind:'aircraft',typeCode:'H60'}),true);
assert.equal(renderer.isRotorcraft({kind:'vessel',typeCode:'H60'}),false);
assert.equal(renderer.exactRotorcraft({kind:'aircraft',typeCode:'H60'}),null);
assert.equal(renderer.iconKey({kind:'aircraft',typeCode:'H60'}),'airliner');
assert.equal(renderer.iconKey({kind:'aircraft',typeCode:'A388'}),'heavy_2e');
assert.equal(renderer.iconKey({kind:'aircraft',typeCode:'DH8D'}),'twin_large');
assert.doesNotMatch(fs.readFileSync('hpr/edge/ui/aircraft-renderer.js','utf8'),/puma\s*:\s*\{\s*viewBox/i);
console.log('G3 PASS: exact V4.8.3 rotorcraft mapping and aircraft ontology are locked');
