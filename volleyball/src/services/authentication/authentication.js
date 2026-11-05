// Extracted from the authoritative reference; see source line annotations.
// Dependencies are supplied per application instance, never through window.
export function createModule(context) {
const document=context.document;
const window=context.window;
const Chart=context.Chart;
const XLSX=context.XLSX;
const setTimeout=context.setTimeout;
const clearTimeout=context.clearTimeout;
const requestAnimationFrame=context.requestAnimationFrame;

// Reference: originals/volleyball.html:5837
const SUPABASE_URL = context.config.supabaseUrl;


// Reference: originals/volleyball.html:5838
const SUPABASE_ANON_KEY = context.config.supabaseKey;


// Reference: originals/volleyball.html:5841
let sb = null;

// Supabase client
// Reference: originals/volleyball.html:5842
let currentUser = null;

// signed-in coach
// Reference: originals/volleyball.html:5843
let syncing = false;

// sync in progress
// Reference: originals/volleyball.html:5844
let isLocalChange = false;

// suppress realtime echo

// Initialize Supabase client (after library loads)
// Reference: originals/volleyball.html:5847
function initSupabase(){
  if(context.api.demoMode) return false; // Demo Mode never creates a real client
  if(!context.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY){
    setSyncStatus('error','LIBRARY MISSING');
    document.getElementById('login-msg').innerHTML='<span style="color:var(--red);">Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, then restart Vite.</span>';
    return false;
  }
  // Read the recovery state from the URL BEFORE the client is created: supabase-js consumes
  // and strips the token fragment while initialising. Only the kind of link is kept; the tokens
  // themselves are never read, stored or logged by this module.
  const link=readRecoveryLink();
  recoveryLinkError=link.error;
  recoveryHint=link.recovery;
  sb = context.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // A reset-email link signs the person in with a short-lived recovery session and Supabase
  // fires PASSWORD_RECOVERY. That session must only be used to set a new password, so show the
  // reset screen instead of loading the dashboard.
  sb.auth.onAuthStateChange((event)=>{
    if(event==='PASSWORD_RECOVERY') showResetScreen();
  });
  return true;
}

// ── Password recovery ────────────────────────────────────────────
// Recovery state lives in memory only.
let recoveryMode = false;
let recoveryHint = false;
let recoveryLinkError = false;

function say(id, text, kind){
  const el=document.getElementById(id);
  if(!el) return;
  el.style.color=kind==='ok'?'var(--green)':kind==='err'?'var(--red)':'var(--text3)';
  el.textContent=text;   // textContent: server-provided text is never parsed as HTML
}

// Looks at the fragment and query only to classify the link (never returns token values).
function readRecoveryLink(){
  const loc=window.location||{};
  const params=new URLSearchParams(String(loc.hash||'').replace(/^#/,'')+'&'+String(loc.search||'').replace(/^[?]/,''));
  const error=params.has('error')||params.has('error_code')||params.has('error_description');
  return {error, recovery:!error && params.get('type')==='recovery'};
}

// Removes any auth parameters from the address bar so they cannot be copied or reused.
function clearAuthFromUrl(){
  try{
    const loc=window.location||{};
    window.history?.replaceState?.(null,'',loc.pathname||'');
  }catch(e){/* cosmetic only */}
}

function showResetScreen(){
  recoveryMode=true;
  document.getElementById('login-overlay').style.display='none';
  document.getElementById('reset-password-overlay').style.display='flex';
}

function showLoginScreen(){
  document.getElementById('reset-password-overlay').style.display='none';
  document.getElementById('login-overlay').style.display='flex';
}

const GENERIC_RESET_SENT='If that email belongs to a coach account, a password reset link has been sent. Check your inbox.';

// Always answers with the same text whether or not the address belongs to a coach.
async function doForgotPassword(){
  const email=document.getElementById('login-email').value.trim();
  if(!email){say('login-msg','Enter your email address above first, then click "Forgot password?"','err');return;}
  if(!sb&&!initSupabase()) return;
  say('login-msg','Sending reset email...','info');
  try{
    // Return to this app's own route (current origin + path, no query or hash), so it works on
    // localhost and under the GitHub Pages sub-path alike. The URL must be allow-listed in
    // this project's Supabase Authentication -> URL Configuration.
    const redirectTo=window.location.origin+window.location.pathname;
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo});
    if(error&&(error.status===429||/rate limit|too many/i.test(error.message||''))){
      say('login-msg','Too many reset requests. Please wait a few minutes and try again.','err');return;
    }
    if(error) console.warn('Password reset request failed');   // details intentionally not logged or shown
    say('login-msg',GENERIC_RESET_SENT,'ok');
  } catch(e){
    say('login-msg','Could not send the reset email right now. Check your connection and try again.','err');
  }
}

async function endRecoverySession(){
  recoveryMode=false;recoveryHint=false;
  currentUser=null;
  try{await sb?.auth.signOut({scope:'local'});}catch(e){/* session is discarded anyway */}
  clearAuthFromUrl();
}

async function doSetNewPassword(){
  const pw=document.getElementById('reset-password-new').value;
  const pw2=document.getElementById('reset-password-confirm').value;
  const btn=document.getElementById('reset-password-btn');
  if(!pw||!pw2){say('reset-password-msg','Please fill in both fields.','err');return;}
  if(pw!==pw2){say('reset-password-msg',"Passwords don't match.",'err');return;}
  if(pw.length<6){say('reset-password-msg','Password must be at least 6 characters.','err');return;}
  if(!sb||!recoveryMode){say('reset-password-msg','This reset link is no longer active. Request a new one from the sign-in page.','err');return;}
  btn.disabled=true;btn.textContent='SAVING...';
  say('reset-password-msg','Saving new password...','info');
  try{
    const {error}=await sb.auth.updateUser({password:pw});
    if(error) throw error;
    // Return to the normal login experience: end the recovery session and sign in afresh.
    await endRecoverySession();
    document.getElementById('reset-password-new').value='';
    document.getElementById('reset-password-confirm').value='';
    document.getElementById('login-password').value='';
    btn.disabled=false;btn.textContent='SET NEW PASSWORD';
    say('reset-password-msg','','info');
    showLoginScreen();
    setSyncStatus('offline','SIGNED OUT');
    say('login-msg','✓ Password updated. Sign in with your new password.','ok');
  } catch(e){
    // Weak-password messages from Supabase are shown as-is (helpful, not sensitive).
    const expired=e&&(e.status===401||e.status===403||/session|expired|not authenticated|jwt/i.test(e.message||''));
    say('reset-password-msg',expired?'This reset link has expired or was already used. Request a new one from the sign-in page.':((e&&e.message)||'Could not update password'),'err');
    btn.disabled=false;btn.textContent='SET NEW PASSWORD';
  }
}

async function cancelPasswordReset(){
  await endRecoverySession();
  document.getElementById('reset-password-new').value='';
  document.getElementById('reset-password-confirm').value='';
  say('reset-password-msg','','info');
  showLoginScreen();
  setSyncStatus('offline','SIGNED OUT');
  say('login-msg','','info');
}

// ── Sync status indicator ────────────────────────────────────────
// Reference: originals/volleyball.html:5858
function setSyncStatus(state, text){
  const dot=document.getElementById('sync-dot');
  const txt=document.getElementById('sync-text');
  if(!dot||!txt) return;
  txt.textContent=text||state.toUpperCase();
  const colors={
    online:'var(--green)',
    syncing:'var(--yellow)',
    offline:'var(--text3)',
    error:'var(--red)',
  };
  dot.style.background=colors[state]||'var(--text3)';
  if(state==='syncing'){dot.style.animation='pulse 1s infinite';}
  else{dot.style.animation='';}
}

// ── Login ────────────────────────────────────────────────────────
// Reference: originals/volleyball.html:5875
async function doLogin(){
  const email=document.getElementById('login-email').value.trim();
  const password=document.getElementById('login-password').value;
  const msg=document.getElementById('login-msg');
  const btn=document.getElementById('login-btn');
  if(!email||!password){msg.innerHTML='<span style="color:var(--red);">Email and password required.</span>';return;}
  if(!sb&&!initSupabase()) return;
  btn.disabled=true;btn.textContent='SIGNING IN...';
  msg.innerHTML='<span style="color:var(--text3);">Authenticating...</span>';
  try{
    const {data, error} = await sb.auth.signInWithPassword({email, password});
    if(error) throw error;
    currentUser = data.user;
    msg.innerHTML='<span style="color:var(--green);">✓ Signed in. Loading roster...</span>';
    await onLoginSuccess();
  } catch(e){
    msg.innerHTML='<span style="color:var(--red);">'+(e.message||'Sign-in failed')+'</span>';
    btn.disabled=false;btn.textContent='SIGN IN';
  }
}


// Reference: originals/volleyball.html:5896
async function doSignOut(){
  if(context.api.demoMode){context.api.exitDemo();return;}
  if(!sb) return;
  if(!confirm('Sign out? Any unsaved local changes will be lost.')) return;
  await sb.auth.signOut();
  location.reload();
}


// Reference: originals/volleyball.html:5903
async function onLoginSuccess(){
  document.getElementById('login-overlay').style.display='none';
  setSyncStatus('syncing','LOADING');
  await context.api.loadAllSessions();
  await context.api.loadAllAthletes();
  context.api.enrichAthletesFromSessions();  // merge session metrics into ATHLETES for dashboard
  context.api.subscribeToChanges();
  setSyncStatus('online','SYNCED');
  // Re-render the feature the user is on (dashboard by default) with the loaded data. A fixed
  // navigate('dashboard') would override any feature the user opened while data was loading.
  const landing=()=>context.activeFeature?.()||'dashboard';
  context.navigate(landing());
  setTimeout(()=>context.navigate(landing()), 300);
}

// ── Boot: check for existing session, otherwise show login ───────
// Reference: originals/volleyball.html:6304
async function bootSupabase(){
  if(context.api.demoMode) return;
  if(!initSupabase()) return;
  const {data:{session}} = await sb.auth.getSession();
  if(recoveryLinkError){
    // Expired, invalid or already-used link: stay on the login screen and explain.
    clearAuthFromUrl();
    setSyncStatus('offline','SIGNED OUT');
    say('login-msg','That password reset link is invalid, expired, or was already used. Enter your email and choose "Forgot password?" for a new one.','err');
    return;
  }
  if(session&&(recoveryMode||recoveryHint)){
    // Opened from a reset email: never load the dashboard on the recovery session.
    if(!recoveryMode) showResetScreen();
    clearAuthFromUrl();
    setSyncStatus('offline','SIGNED OUT');
    return;
  }
  if(session){
    currentUser=session.user;
    await onLoginSuccess();
  } else {
    setSyncStatus('offline','SIGNED OUT');
  }
}

return Object.defineProperties({}, {
  SUPABASE_URL: {enumerable:true, configurable:true, get:()=>SUPABASE_URL},
  SUPABASE_ANON_KEY: {enumerable:true, configurable:true, get:()=>SUPABASE_ANON_KEY},
  sb: {enumerable:true, configurable:true, get:()=>sb, set:value=>{sb=value;}},
  currentUser: {enumerable:true, configurable:true, get:()=>currentUser, set:value=>{currentUser=value;}},
  syncing: {enumerable:true, configurable:true, get:()=>syncing, set:value=>{syncing=value;}},
  isLocalChange: {enumerable:true, configurable:true, get:()=>isLocalChange, set:value=>{isLocalChange=value;}},
  initSupabase: {enumerable:true, configurable:true, get:()=>initSupabase},
  doForgotPassword: {enumerable:true, configurable:true, get:()=>doForgotPassword},
  doSetNewPassword: {enumerable:true, configurable:true, get:()=>doSetNewPassword},
  cancelPasswordReset: {enumerable:true, configurable:true, get:()=>cancelPasswordReset},
  setSyncStatus: {enumerable:true, configurable:true, get:()=>setSyncStatus},
  doLogin: {enumerable:true, configurable:true, get:()=>doLogin},
  doSignOut: {enumerable:true, configurable:true, get:()=>doSignOut},
  onLoginSuccess: {enumerable:true, configurable:true, get:()=>onLoginSuccess},
  bootSupabase: {enumerable:true, configurable:true, get:()=>bootSupabase}
});
}
