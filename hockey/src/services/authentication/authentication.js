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

// Reference: originals/hockey.html:6926
const SUPABASE_URL = context.config.supabaseUrl;


// Reference: originals/hockey.html:6927
const SUPABASE_ANON_KEY = context.config.supabaseKey;


// Reference: originals/hockey.html:6929
let sb = null;

// Supabase client
// Reference: originals/hockey.html:6930
let currentUser = null;

// signed-in coach
// Reference: originals/hockey.html:6931
let syncing = false;

// sync in progress
// Reference: originals/hockey.html:6932
let isLocalChange = false;

// suppress realtime echo

// Initialize Supabase client (after library loads)
// Reference: originals/hockey.html:6935
function initSupabase(){
  if(context.api.demoMode) return false; // Demo Mode never creates a real client
  if(!context.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY){
    setSyncStatus('error','LIBRARY MISSING');
    document.getElementById('login-msg').innerHTML='<span style="color:var(--red);">Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, then restart Vite.</span>';
    return false;
  }
  sb = context.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // A password-reset email link logs the person in directly (the link itself
  // IS a valid session token) — Supabase fires a PASSWORD_RECOVERY event when
  // that happens, distinct from a normal sign-in. Without handling it, someone
  // clicking "reset password" just silently lands in the dashboard with their
  // OLD password unchanged and no way to actually set a new one. Catch that
  // case here and show the "set new password" screen instead.
  sb.auth.onAuthStateChange((event, session)=>{
    if(event==='PASSWORD_RECOVERY'){
      document.getElementById('login-overlay').style.display='none';
      document.getElementById('reset-password-overlay').style.display='flex';
    }
  });

  return true;
}

// ── Forgot password ─────────────────────────────────────────────
// Reference: originals/hockey.html:6960
async function doForgotPassword(){
  const email=document.getElementById('login-email').value.trim();
  const msg=document.getElementById('login-msg');
  if(!email){msg.innerHTML='<span style="color:var(--red);">Enter your email address above first, then click "Forgot password?"</span>';return;}
  if(!sb&&!initSupabase()) return;
  msg.innerHTML='<span style="color:var(--text3);">Sending reset email...</span>';
  try{
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});
    if(error) throw error;
    msg.innerHTML='<span style="color:var(--green);">✓ Check your email for a password reset link.</span>';
  } catch(e){
    msg.innerHTML='<span style="color:var(--red);">'+(e.message||'Could not send reset email')+'</span>';
  }
}

// ── Set new password (after arriving via a reset email link) ───────
// Reference: originals/hockey.html:6976
async function doSetNewPassword(){
  const pw=document.getElementById('reset-password-new').value;
  const pw2=document.getElementById('reset-password-confirm').value;
  const msg=document.getElementById('reset-password-msg');
  const btn=document.getElementById('reset-password-btn');
  if(!pw||!pw2){msg.innerHTML='<span style="color:var(--red);">Please fill in both fields.</span>';return;}
  if(pw!==pw2){msg.innerHTML='<span style="color:var(--red);">Passwords don\'t match.</span>';return;}
  if(pw.length<6){msg.innerHTML='<span style="color:var(--red);">Password must be at least 6 characters.</span>';return;}
  btn.disabled=true;btn.textContent='SAVING...';
  msg.innerHTML='<span style="color:var(--text3);">Saving new password...</span>';
  try{
    const {data,error}=await sb.auth.updateUser({password:pw});
    if(error) throw error;
    currentUser=data.user;
    msg.innerHTML='<span style="color:var(--green);">✓ Password updated. Loading dashboard...</span>';
    setTimeout(async ()=>{
      document.getElementById('reset-password-overlay').style.display='none';
      await onLoginSuccess();
    }, 800);
  } catch(e){
    msg.innerHTML='<span style="color:var(--red);">'+(e.message||'Could not update password')+'</span>';
    btn.disabled=false;btn.textContent='SET NEW PASSWORD';
  }
}

// ── Sync status indicator ────────────────────────────────────────
// Reference: originals/hockey.html:7002
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
// Reference: originals/hockey.html:7019
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


// Reference: originals/hockey.html:7040
async function doSignOut(){
  if(context.api.demoMode){context.api.exitDemo();return;}
  if(!sb) return;
  if(!confirm('Sign out? Any unsaved local changes will be lost.')) return;
  await sb.auth.signOut();
  location.reload();
}


// Reference: originals/hockey.html:7047
async function onLoginSuccess(){
  document.getElementById('login-overlay').style.display='none';
  setSyncStatus('syncing','LOADING');
  await context.api.loadAllSessions();
  await context.api.loadAllAthletes();
  context.api.enrichAthletesFromSessions();  // merge session metrics into ATHLETES for dashboard
  await context.api.loadKpiHistory();
  context.api.applyBestRecentValues();       // upgrade current values to best-in-9-months where history shows a better result
  context.api.rescoreAllAthletes();          // composite from the fully merged values (fixed baseline)
  context.api.subscribeToChanges();
  setSyncStatus('online','SYNCED');
  context.navigate('dashboard');
  setTimeout(()=>context.navigate('dashboard'), 300);
}

// ── Boot: check for existing session, otherwise show login ───────
// Reference: originals/hockey.html:7544
async function bootSupabase(){
  if(context.api.demoMode) return;
  if(!initSupabase()) return;
  const {data:{session}} = await sb.auth.getSession();
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
  setSyncStatus: {enumerable:true, configurable:true, get:()=>setSyncStatus},
  doLogin: {enumerable:true, configurable:true, get:()=>doLogin},
  doSignOut: {enumerable:true, configurable:true, get:()=>doSignOut},
  onLoginSuccess: {enumerable:true, configurable:true, get:()=>onLoginSuccess},
  bootSupabase: {enumerable:true, configurable:true, get:()=>bootSupabase}
});
}
