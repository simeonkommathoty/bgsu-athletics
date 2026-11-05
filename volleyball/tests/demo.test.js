import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createDemoClient} from '../src/services/demo/demo-backend.js';
import {buildDemoTables} from '../src/services/demo/demo-data.js';
import {services} from './support.js';

const POSITIONS=['DS','Lib','MB','OH','OPP','RS','S'];
test('demo dataset is synthetic, varied, dated and deliberately incomplete',()=>{
  const t=buildDemoTables(new Date('2026-11-03T12:00:00Z'));
  assert.ok(t.athletes.length>=12);
  assert.deepEqual([...new Set(t.athletes.map(a=>a.pos))].sort(),POSITIONS);
  assert.ok(t.athletes.every(a=>/^Demo (Outside|Middle|Setter|RightSide|Opposite|Libero|DefSpec) [A-Z][a-z]+$/.test(a.canonical_name)),'placeholder names only');
  assert.ok(new Set(t.test_sessions.map(s=>s.test_date)).size>=8,'multiple testing dates');
  assert.ok(t.test_sessions.some(s=>s.jumps_total!=null)&&t.test_sessions.some(s=>s.jump_height!=null),'workload and force plate sessions');
  assert.ok(new Set(t.test_sessions.filter(s=>s.test_type==='approach_vert').map(h=>h.test_date)).size>=3,'dated testing history');
  assert.ok(t.athletes.some(a=>a.peak_power==null)&&t.athletes.some(a=>a.bench_max==null)&&t.athletes.some(a=>a.approach_jump==null),'incomplete records present');
  const names=new Set(t.athletes.map(a=>a.canonical_name));
  assert.ok(t.test_sessions.every(s=>names.has(s.athlete_name)),'no foreign names');
  assert.deepEqual(buildDemoTables(new Date('2026-11-03T12:00:00Z')),t,'deterministic');
});
test('demo source carries no credentials or real-data imports',()=>{
  for(const f of ['demo-backend.js','demo-data.js','demo.js']){
    const s=fs.readFileSync(new URL(`../src/services/demo/${f}`,import.meta.url),'utf8');
    assert.doesNotMatch(s.replace(/\/\/.*$/gm,''),/fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie|import\.meta\.env|createClient/,f);
  }
});
test('in-memory client serves reads and keeps writes local',async()=>{
  const seed={athletes:[{id:1,canonical_name:'A',archived:false},{id:2,canonical_name:'B',archived:false}],test_sessions:[]};
  const sb=createDemoClient(seed);
  assert.equal((await sb.from('athletes').select('*').order('id',{ascending:false})).data[0].id,2);
  assert.equal((await sb.from('athletes').update({archived:true}).eq('id',1).select().single()).data.archived,true);
  assert.equal(seed.athletes[0].archived,false,'seed fixtures are never mutated');
  const ins=await sb.from('athletes').insert({canonical_name:'C'}).select().single();
  assert.equal(ins.data.id,3);
  await sb.from('athletes').delete().eq('id',2);
  assert.deepEqual((await sb.from('athletes').select('id')).data.map(r=>r.id),[1,3]);
  assert.match((await sb.storage.from('athlete-photos').upload('x',{})).error.message,/Demo Mode/);
  assert.match((await sb.auth.signInWithPassword({email:'a',password:'b'})).error.message,/Demo Mode/);
  assert.equal((await sb.auth.getSession()).data.session,null,'no session is ever fabricated');
  assert.equal(sb.channel('x').on('postgres_changes',{},()=>{}).subscribe(),sb.channel('x'));
  assert.throws(()=>sb.from('athletes').rpc(),TypeError,'unsupported operations fail loudly');
});
test('demo mode never creates a real Supabase client or contacts the backend',async()=>{
  let created=0;
  const api=services({window:{location:{hash:'#demo',pathname:'/volleyball/'},addEventListener(){}},supabase:{createClient(){created++;throw new Error('real client');}},config:{}}).api;
  assert.equal(api.demoMode,true);
  assert.equal(api.initSupabase(),false);
  await api.bootSupabase();
  assert.equal(created,0);
  assert.equal(api.sb,null);
});
test('outside demo mode the normal Supabase flow is unchanged',()=>{
  let created=0;
  const api=services({window:{location:{hash:'',pathname:'/volleyball/'},addEventListener(){}},supabase:{createClient(){created++;return {auth:{onAuthStateChange(){}}};}},config:{supabaseUrl:'https://x.invalid',supabaseKey:'k'}}).api;
  assert.equal(api.demoMode,false);
  assert.equal(api.initSupabase(),true);
  assert.equal(created,1);
});
