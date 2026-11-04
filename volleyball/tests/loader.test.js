import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverFeatures} from '../src/layout/feature-loader.js';

const metadata=id=>({id,title:id,icon:'',order:1});
test('automatic metadata discovery never executes feature code; invalid entries are isolated',async()=>{
  const errors=[];let loads=0;
  const entries=await discoverFeatures({
    './features/a/registration.js':async()=>({default:metadata('a')}),
    './features/b/registration.js':async()=>{throw new Error('metadata import failed');},
    './features/c/registration.js':async()=>({default:{id:'c'}}),
  },{'./features/a/feature.js':async()=>{loads++;return {default:{...metadata('a'),mount(){}}};}},(...args)=>errors.push(args));
  assert.equal(entries.length,1);assert.equal(loads,0);assert.equal(errors.length,2);
  assert.equal((await entries[0].load()).id,'a');assert.equal(loads,1);
});
test('failed feature imports and invalid mount contracts reject at activation',async()=>{
  for(const load of [async()=>{throw new Error('chunk failed');},async()=>({default:{id:'a'}})]){
    const entries=await discoverFeatures({'./features/a/registration.js':async()=>({default:metadata('a')})},{'./features/a/feature.js':load});
    await assert.rejects(entries[0].load());
  }
});
