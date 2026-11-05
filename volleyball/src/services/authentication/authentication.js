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
  sb = context.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return true;
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
  setSyncStatus: {enumerable:true, configurable:true, get:()=>setSyncStatus},
  doLogin: {enumerable:true, configurable:true, get:()=>doLogin},
  doSignOut: {enumerable:true, configurable:true, get:()=>doSignOut},
  onLoginSuccess: {enumerable:true, configurable:true, get:()=>onLoginSuccess},
  bootSupabase: {enumerable:true, configurable:true, get:()=>bootSupabase}
});
}
