import test from 'node:test';
import assert from 'node:assert/strict';
import {services,referenceOracle,syntheticAthletes,syntheticSessions} from './support.js';

const plain=value=>JSON.parse(JSON.stringify(value));
test('database mapping, explicit photo removal, deduplication and active roster match',()=>{
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
  const csv='name,pos,cmjHeight\n"Synthetic, SkaterA",F,28.5\n"Synthetic ""Quoted""",D,30';
  oracle.set('ATHLETES',[csv]);
  assert.deepEqual(plain(api.parseCSVToRows(csv)),plain(oracle.run('parseCSVToRows(ATHLETES[0])')));
  for(const source of ['custom','vald','teambuildr']){
    const rows=source==='teambuildr'?[['athlete','exercise','max'],['Synthetic SkaterA','front squat','300']]:[['name','position','cmj height','peak power','10yd sprint'],['Synthetic SkaterA','F','28.5','3200','1.42']];
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
  await api.loadAllSessions();await api.loadAllSessionDrills();await api.loadKpiHistory();
  assert.equal(calls,0);
});
test('paginated session reads preserve the original 1000-row boundary',async()=>{
  const {api}=services();const ranges=[];
  api.sb={from:()=>({select:()=>({order(){return this;},async range(from,to){ranges.push([from,to]);return {data:Array.from({length:from===0?1000:2},(_,i)=>({id:from+i})),error:null};}})})};
  const result=await api.fetchAllRows('test_sessions','test_date',false);
  assert.equal(result.data.length,1002);assert.deepEqual(ranges,[[0,999],[1000,1999]]);
});
test('authentication delegates to Supabase and supports password-recovery events',async()=>{
  let authChange,signIn,resetRequest,updatedPassword;
  const client={auth:{
    onAuthStateChange:callback=>{authChange=callback;},
    getSession:async()=>({data:{session:null}}),
    signInWithPassword:async credentials=>{signIn=credentials;return {error:new Error('Synthetic rejected sign-in')};},
    resetPasswordForEmail:async(...args)=>{resetRequest=args;return {error:null};},
    updateUser:async request=>{updatedPassword=request;return {data:{user:{id:'synthetic-coach'}},error:null};},
  }};
  const context=services({config:{supabaseUrl:'https://synthetic.invalid',supabaseKey:'synthetic-public-key'},supabase:{createClient:()=>client},window:{location:{origin:'http://127.0.0.1',pathname:'/hockey/'}}});
  const {api,document}=context;
  await api.bootSupabase();assert.equal(api.currentUser,null);
  document.getElementById('login-email').value='coach@example.invalid';document.getElementById('login-password').value='synthetic-password';
  await api.doLogin();assert.equal(signIn.email,'coach@example.invalid');assert.match(document.getElementById('login-msg').innerHTML,/Synthetic rejected sign-in/);
  await api.doForgotPassword();assert.equal(resetRequest[0],'coach@example.invalid');assert.equal(resetRequest[1].redirectTo,'http://127.0.0.1/hockey/');
  authChange('PASSWORD_RECOVERY',{});assert.equal(document.getElementById('reset-password-overlay').style.display,'flex');
  document.getElementById('reset-password-new').value='synthetic-new-password';document.getElementById('reset-password-confirm').value='synthetic-new-password';
  await api.doSetNewPassword();assert.deepEqual(updatedPassword,{password:'synthetic-new-password'});assert.equal(api.currentUser.id,'synthetic-coach');
});
test('password-reset redirect returns to the Hockey route under any base path, without query or hash',async()=>{
  for(const [origin,pathname,expected] of [['http://127.0.0.1:5170','/hockey/','http://127.0.0.1:5170/hockey/'],['https://athletics.example.invalid','/apps/hockey/','https://athletics.example.invalid/apps/hockey/']]){
    let resetRequest,authChange;
    const client={auth:{onAuthStateChange:cb=>{authChange=cb;},getSession:async()=>({data:{session:null}}),resetPasswordForEmail:async(...args)=>{resetRequest=args;return {error:null};}}};
    const {api,document}=services({config:{supabaseUrl:'https://synthetic.invalid',supabaseKey:'synthetic-public-key'},supabase:{createClient:()=>client},window:{location:{origin,pathname,search:'?x=1',hash:'#access_token=synthetic'}}});
    await api.bootSupabase();
    document.getElementById('login-email').value='coach@example.invalid';
    await api.doForgotPassword();
    assert.equal(resetRequest[1].redirectTo,expected);
    authChange('PASSWORD_RECOVERY',{});
    assert.equal(document.getElementById('reset-password-overlay').style.display,'flex');
  }
});
