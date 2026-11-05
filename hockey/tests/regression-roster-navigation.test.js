import test from 'node:test';
import assert from 'node:assert/strict';
import {services} from './support.js';
import {buildDemoTables} from '../src/services/demo/demo-data.js';
import {createDemoClient} from '../src/services/demo/demo-backend.js';

const load=api=>{const t=buildDemoTables(new Date('2026-03-01'));api.ATHLETES=t.athletes.map((r,i)=>api.dbRowToAthlete(r,i)).map((a,i)=>({...a,id:i}));return t;};

test('regression: synthetic roster is not merged by identity dedupe (names must stay distinct after normName)',()=>{
  const {api}=services();const t=load(api);
  const keys=new Set(t.athletes.map(a=>(api.nameKey||api.normName)(a.canonical_name)));
  assert.equal(keys.size,t.athletes.length,'every synthetic name keeps a distinct identity key');
  assert.equal(api.allAthletes().length,t.athletes.length,'no athlete was merged away');
});
test('regression: every profile/compare dropdown option resolves to the athlete it is labelled with',()=>{
  const {api}=services();load(api);
  const options=[...api.athleteOptions().matchAll(/<option value="(\d+)">(.*?) \(/g)];
  assert.equal(options.length,api.allAthletes().length);
  for(const [,id,label] of options){
    const a=api.ATHLETES.find(x=>x.id===Number(id));
    assert.ok(a,`option ${id} resolves to an athlete`);
    assert.equal(a._canonicalName||a.name,label,`option ${id} is labelled with its own athlete`);
  }
});
test('regression: finishing login re-renders the feature the user opened while data was loading, not the dashboard',async()=>{
  for(const active of ['profile','dashboard',undefined]){
    const nav=[];
    const {api}=services({navigate:async id=>{nav.push(id);return true;},activeFeature:()=>active,setTimeout:fn=>{fn();return 0;}});
    api.sb=createDemoClient(buildDemoTables(new Date('2026-03-01')));api.currentUser={id:'demo'};
    await api.onLoginSuccess();
    assert.deepEqual(nav,Array(2).fill(active||'dashboard'),`active=${active}`);
  }
});
