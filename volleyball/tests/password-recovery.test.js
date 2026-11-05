import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {services} from './support.js';

const CONFIG={supabaseUrl:'https://synthetic.invalid',supabaseKey:'synthetic-public-key'};
// A Supabase client double that records calls. `auth` replaces individual auth methods.
function setup({location={origin:'http://127.0.0.1:5170',pathname:'/volleyball/',search:'',hash:''},auth={},session=null}={}){
  const calls={reset:[],update:[],signOut:[],signIn:[],replace:[]};let authChange=()=>{};
  const chain=()=>new Proxy(function(){},{get:(_,k)=>k==='then'?(res=>res({data:[],error:null})):chain,apply:()=>chain()});
  const client={from:chain,channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel(){},auth:{
    onAuthStateChange:cb=>{authChange=cb;},
    getSession:async()=>({data:{session}}),
    signInWithPassword:async c=>{calls.signIn.push(c);return {data:{user:{id:'synthetic-coach'}},error:null};},
    resetPasswordForEmail:async(...a)=>{calls.reset.push(a);return {error:null};},
    updateUser:async r=>{calls.update.push(r);return {data:{user:{id:'synthetic-coach'}},error:null};},
    signOut:async o=>{calls.signOut.push(o);return {error:null};},
    ...auth}};
  const navigated=[];
  const ctx=services({config:CONFIG,supabase:{createClient:()=>client},navigate:id=>navigated.push(id),
    window:{location,history:{replaceState:(...a)=>calls.replace.push(a)}}});
  const el=id=>ctx.document.getElementById(id);
  return {...ctx,calls,navigated,el,fire:(e,s)=>authChange(e,s)};
}
const fill=(t,pw,pw2)=>{t.el('reset-password-new').value=pw;t.el('reset-password-confirm').value=pw2;};

test('password recovery request uses the Volleyball route as redirect, on localhost and Pages',async()=>{
  for(const [origin,pathname,expected] of [['http://127.0.0.1:5170','/volleyball/','http://127.0.0.1:5170/volleyball/'],['https://simeonkommathoty.github.io','/bgsu-athletics/volleyball/','https://simeonkommathoty.github.io/bgsu-athletics/volleyball/']]){
    const t=setup({location:{origin,pathname,search:'?x=1',hash:'#unrelated=1'}});
    await t.api.bootSupabase();
    t.el('login-email').value=' coach@example.invalid ';
    await t.api.doForgotPassword();
    assert.equal(t.calls.reset.length,1);
    assert.equal(t.calls.reset[0][0],'coach@example.invalid');
    assert.equal(t.calls.reset[0][1].redirectTo,expected);
  }
});
test('password recovery request needs an email and never reveals whether an account exists',async()=>{
  const t=setup();await t.api.bootSupabase();
  await t.api.doForgotPassword();
  assert.equal(t.calls.reset.length,0);assert.match(t.el('login-msg').textContent,/Enter your email/);
  t.el('login-email').value='member@example.invalid';await t.api.doForgotPassword();const known=t.el('login-msg').textContent;
  // A server-side error must not leak details or differ from the normal answer.
  const u=setup({auth:{resetPasswordForEmail:async()=>({error:Object.assign(new Error('User not found in project xyz'),{status:400})})}});
  await u.api.bootSupabase();u.el('login-email').value='nobody@example.invalid';await u.api.doForgotPassword();
  assert.equal(u.el('login-msg').textContent,known);
  assert.doesNotMatch(known,/not found|no account|member@/i);
  assert.match(known,/If that email belongs to a coach account/);
});
test('password recovery request reports rate limiting and network failures without raw server text',async()=>{
  const r=setup({auth:{resetPasswordForEmail:async()=>({error:Object.assign(new Error('email rate limit exceeded'),{status:429})})}});
  await r.api.bootSupabase();r.el('login-email').value='a@example.invalid';await r.api.doForgotPassword();
  assert.match(r.el('login-msg').textContent,/Too many reset requests/);
  const n=setup({auth:{resetPasswordForEmail:async()=>{throw new Error('<img src=x onerror=alert(1)>');}}});
  await n.api.bootSupabase();n.el('login-email').value='a@example.invalid';await n.api.doForgotPassword();
  assert.match(n.el('login-msg').textContent,/Could not send the reset email/);
  assert.doesNotMatch(n.el('login-msg').textContent,/img/);
});
test('password recovery event shows the reset screen and a recovery session never loads the dashboard',async()=>{
  const t=setup({location:{origin:'http://127.0.0.1',pathname:'/volleyball/',search:'',hash:'#access_token=synthetic&type=recovery'},session:{user:{id:'synthetic-coach'}}});
  await t.api.bootSupabase();
  assert.equal(t.el('reset-password-overlay').style.display,'flex');   // shown from the link type even before the event
  assert.equal(t.el('login-overlay').style.display,'none');
  assert.deepEqual(t.navigated,[]);assert.equal(t.api.currentUser,null);
  assert.ok(t.calls.replace.length>0);assert.equal(t.calls.replace[0][2],'/volleyball/');   // tokens removed from the address bar
  const e=setup({session:{user:{id:'synthetic-coach'}}});await e.api.bootSupabase();
  e.fire('PASSWORD_RECOVERY',{});
  assert.equal(e.el('reset-password-overlay').style.display,'flex');assert.equal(e.el('login-overlay').style.display,'none');
});
test('password recovery success saves the password, ends the recovery session and returns to sign-in',async()=>{
  const t=setup();await t.api.bootSupabase();t.fire('PASSWORD_RECOVERY',{});
  fill(t,'synthetic-new-password','synthetic-new-password');
  await t.api.doSetNewPassword();
  assert.deepEqual(t.calls.update,[{password:'synthetic-new-password'}]);
  assert.deepEqual(t.calls.signOut,[{scope:'local'}]);
  assert.equal(t.el('reset-password-overlay').style.display,'none');assert.equal(t.el('login-overlay').style.display,'flex');
  assert.match(t.el('login-msg').textContent,/Password updated\. Sign in with your new password/);
  assert.equal(t.api.currentUser,null);assert.deepEqual(t.navigated,[]);
  assert.equal(t.el('reset-password-new').value,'');assert.equal(t.el('reset-password-confirm').value,'');
  // The recovery session is over: a second submit cannot change anything.
  fill(t,'another-password','another-password');await t.api.doSetNewPassword();
  assert.equal(t.calls.update.length,1);assert.match(t.el('reset-password-msg').textContent,/no longer active/);
});
test('password recovery rejects empty, mismatched and too-short passwords before calling Supabase',async()=>{
  const t=setup();await t.api.bootSupabase();t.fire('PASSWORD_RECOVERY',{});
  for(const [a,b,re] of [['','',/fill in both/],['abcdef1','abcdef2',/don't match/],['abc','abc',/at least 6/]]){
    fill(t,a,b);await t.api.doSetNewPassword();assert.match(t.el('reset-password-msg').textContent,re);
  }
  assert.equal(t.calls.update.length,0);
});
test('password recovery shows Supabase rejections and re-enables the form; expired sessions get a clear message',async()=>{
  const weak=setup({auth:{updateUser:async()=>({data:null,error:Object.assign(new Error('Password should contain a number'),{status:422})})}});
  await weak.api.bootSupabase();weak.fire('PASSWORD_RECOVERY',{});fill(weak,'abcdefgh','abcdefgh');await weak.api.doSetNewPassword();
  assert.match(weak.el('reset-password-msg').textContent,/should contain a number/);
  assert.equal(weak.el('reset-password-btn').disabled,false);assert.equal(weak.el('reset-password-overlay').style.display,'flex');
  const old=setup({auth:{updateUser:async()=>({data:null,error:Object.assign(new Error('Auth session missing!'),{status:401})})}});
  await old.api.bootSupabase();old.fire('PASSWORD_RECOVERY',{});fill(old,'abcdefgh','abcdefgh');await old.api.doSetNewPassword();
  assert.match(old.el('reset-password-msg').textContent,/expired or was already used/);
});
test('password recovery handles expired, invalid and already-used links on the sign-in screen',async()=>{
  for(const hash of ['#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired','#error_code=otp_expired']){
    const t=setup({location:{origin:'http://127.0.0.1',pathname:'/volleyball/',search:'',hash}});
    await t.api.bootSupabase();
    assert.match(t.el('login-msg').textContent,/invalid, expired, or was already used/);
    assert.notEqual(t.el('reset-password-overlay').style.display,'flex');assert.deepEqual(t.navigated,[]);
    assert.equal(t.calls.replace[0][2],'/volleyball/');
  }
});
test('password recovery can be cancelled back to sign-in',async()=>{
  const t=setup();await t.api.bootSupabase();t.fire('PASSWORD_RECOVERY',{});
  await t.api.cancelPasswordReset();
  assert.equal(t.el('login-overlay').style.display,'flex');assert.equal(t.el('reset-password-overlay').style.display,'none');
  assert.deepEqual(t.calls.signOut,[{scope:'local'}]);assert.equal(t.calls.update.length,0);
});
test('password recovery does not log tokens or passwords',async()=>{
  const seen=[];const orig={log:console.log,warn:console.warn,error:console.error,info:console.info};
  for(const k of Object.keys(orig))console[k]=(...a)=>seen.push(a.join(' '));
  try{
    const t=setup({location:{origin:'http://127.0.0.1',pathname:'/volleyball/',search:'',hash:'#access_token=SECRETTOKEN&type=recovery'},session:{access_token:'SECRETTOKEN',user:{id:'x'}},
      auth:{resetPasswordForEmail:async()=>({error:new Error('boom SECRETTOKEN')})}});
    await t.api.bootSupabase();t.el('login-email').value='a@example.invalid';await t.api.doForgotPassword();
    fill(t,'SECRETPASSWORD','SECRETPASSWORD');await t.api.doSetNewPassword();
  }finally{Object.assign(console,orig);}
  assert.doesNotMatch(seen.join('\n'),/SECRETTOKEN|SECRETPASSWORD/);
});
test('password recovery leaves normal login and session restoration unchanged',async()=>{
  const t=setup();await t.api.bootSupabase();
  t.el('login-email').value='coach@example.invalid';t.el('login-password').value='synthetic-password';
  await t.api.doLogin();
  assert.deepEqual(t.calls.signIn,[{email:'coach@example.invalid',password:'synthetic-password'}]);
  assert.equal(t.api.currentUser.id,'synthetic-coach');assert.equal(t.el('login-overlay').style.display,'none');assert.ok(t.navigated.length>0);
  // A stored (non-recovery) session is restored straight into the dashboard.
  const r=setup({session:{user:{id:'synthetic-coach'}}});await r.api.bootSupabase();
  assert.equal(r.api.currentUser.id,'synthetic-coach');assert.equal(r.el('login-overlay').style.display,'none');assert.ok(r.navigated.length>0);
  assert.notEqual(r.el('reset-password-overlay').style.display,'flex');
});
test('password recovery code is independent of Hockey and hardcodes no project or origin',()=>{
  const src=readFileSync(new URL('../src/services/authentication/authentication.js',import.meta.url),'utf8');
  assert.doesNotMatch(src,/hockey|supabase\.co|https?:\/\/[a-z]/i);
  assert.match(src,/window\.location\.origin\+window\.location\.pathname/);
});
