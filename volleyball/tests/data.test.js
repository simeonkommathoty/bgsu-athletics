import test from 'node:test';
import assert from 'node:assert/strict';
import {services,referenceOracle,syntheticAthletes,syntheticSessions} from './support.js';

const plain=value=>JSON.parse(JSON.stringify(value));
test('database mapping, deduplication and active roster match the original',()=>{
  const {api}=services(),oracle=referenceOracle();
  const athletes=syntheticAthletes();
  for(const athlete of athletes){
    athlete.photo_url=null;
    oracle.set('ATHLETES',[structuredClone(athlete)]);
    assert.deepEqual(plain(api.athleteToDbRow(athlete)),plain(oracle.run('athleteToDbRow(ATHLETES[0])')));
    const row={...api.athleteToDbRow(athlete),id:'synthetic-db-row'};
    oracle.set('ATHLETES',[structuredClone(row)]);
    assert.deepEqual(plain(api.dbRowToAthlete(row,0)),plain(oracle.run('dbRowToAthlete(ATHLETES[0],0)')));
  }
  const duplicates=[...athletes,structuredClone(athletes[0])];
  api.ATHLETES=structuredClone(duplicates);oracle.set('ATHLETES',structuredClone(duplicates));
  api.SESSIONS=syntheticSessions(athletes);oracle.set('SESSIONS',syntheticSessions(athletes));
  assert.deepEqual(plain(api.rosterAthletes()),plain(oracle.run('rosterAthletes()')));
});
test('CSV quoting and custom/VALD/Teambuildr import characterization match the reference',t=>{
  t.mock.method(Date,'now',()=>1793738400000);
  t.mock.method(Math,'random',()=>0.5);
  const {api}=services(),oracle=referenceOracle();
  for(const source of ['custom','vald','teambuildr']){
    const rows=source==='teambuildr'?[['athlete','exercise','max'],['Synthetic PlayerA','front squat','175']]:[['name','position','cmj height','peak power','10yd sprint'],['Synthetic PlayerA','OH','22.5','3200','1.72']];
    oracle.set('ATHLETES',[]);oracle.set('SESSIONS',rows);
    api.ATHLETES=[];api.parsedData=null;
    api.processRows(structuredClone(rows),source);
    const expected=oracle.run(`parsedData=null;processRows(SESSIONS,'${source}');parsedData`);
    assert.deepEqual(plain(api.parsedData),plain(expected),source);
  }
});
test('session reads are gated by both client and authenticated user',async()=>{
  const {api}=services();let calls=0;
  api.sb={from(){calls++;throw new Error('unauthenticated query');}};
  await api.loadAllSessions();
  assert.equal(calls,0);
});
test('paginated session reads preserve the original 1000-row boundary',async()=>{
  const {api}=services();const ranges=[];
  api.sb={from:()=>({select:()=>({order(){return this;},async range(from,to){ranges.push([from,to]);return {data:Array.from({length:from===0?1000:2},(_,i)=>({id:from+i})),error:null};}})})};
  api.currentUser={id:'synthetic-coach'};
  await api.loadAllSessions();
  assert.equal(api.SESSIONS.length,1002);assert.deepEqual(ranges,[[0,999],[1000,1999]]);
});
test('authentication delegates to Supabase and reports rejected sign-in',async()=>{
  let signIn;
  const client={auth:{
    onAuthStateChange(){},
    getSession:async()=>({data:{session:null}}),
    signInWithPassword:async credentials=>{signIn=credentials;return {data:null,error:new Error('Synthetic rejected sign-in')};},
  }};
  const context=services({config:{supabaseUrl:'https://synthetic.invalid',supabaseKey:'synthetic-public-key'},supabase:{createClient:()=>client},window:{location:{origin:'http://127.0.0.1'}}});
  const {api,document}=context;
  await api.bootSupabase();assert.equal(api.currentUser,null);
  document.getElementById('login-email').value='coach@example.invalid';document.getElementById('login-password').value='synthetic-password';
  await api.doLogin();assert.equal(signIn.email,'coach@example.invalid');assert.match(document.getElementById('login-msg').innerHTML,/Synthetic rejected sign-in/);
  assert.equal(api.currentUser,null);
});
test('volleyball has no password-recovery flow, so no root-origin redirect can exist',async()=>{
  const {readFileSync}=await import('node:fs');
  const source=readFileSync(new URL('../src/services/authentication/authentication.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/resetPasswordForEmail|PASSWORD_RECOVERY|location\.origin/);
});
