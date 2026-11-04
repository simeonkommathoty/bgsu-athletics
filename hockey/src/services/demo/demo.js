import {createDemoClient} from './demo-backend.js';
import {buildDemoTables} from './demo-data.js';

// Demo Mode is selected only by the URL fragment "#demo" and always starts from
// a fresh page load, so no live client, session, cache or athlete record can
// exist in memory when it begins (and none can survive when it ends).
export const DEMO_HASH='#demo';
export function isDemoRequested(location){return location.hash===DEMO_HASH;}

export function createModule(context) {
const document=context.document;
const window=context.window;
const demo=isDemoRequested(window.location||{hash:''});

// Entering and leaving are page loads: any change of the fragment between modes
// (button, address bar, or browser back/forward) reloads, so the old JavaScript
// heap and its in-flight requests are discarded rather than reused.
window.addEventListener?.('hashchange',()=>{if(isDemoRequested(window.location)!==demo)window.location.reload();});
function enterDemo(){window.location.hash=DEMO_HASH;}
function exitDemo(){window.location.hash='';}

function banner(){
  const bar=document.createElement('div');
  bar.id='demo-banner';
  bar.setAttribute('role','status');
  bar.style.cssText='position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:10001;display:flex;gap:12px;align-items:center;padding:6px 14px;background:#7c2d12;color:#fff;border:1px solid var(--orange);border-radius:6px;font:700 11px/1.2 var(--fm,monospace);letter-spacing:1px;box-shadow:0 2px 10px #0008;';
  const label=document.createElement('span');label.textContent='DEMO — SYNTHETIC DATA';
  const exit=document.createElement('button');exit.id='demo-exit';exit.type='button';exit.textContent='EXIT DEMO';
  exit.style.cssText='background:#fff;color:#7c2d12;border:0;border-radius:4px;padding:3px 9px;font:inherit;cursor:pointer;';
  exit.setAttribute('data-onclick','exitDemo()');
  bar.append(label,exit);
  document.body.appendChild(bar);
}

// Replaces the backend with the in-memory client and runs the normal
// post-login pipeline against it. The real Supabase client is never created.
async function startDemo(){
  context.api.sb=createDemoClient(buildDemoTables());
  context.api.currentUser={email:'demo@synthetic.invalid',demo:true};
  const login=document.getElementById('login-overlay');if(login)login.style.display='none';
  banner();
  if(window.document)window.document.title='DEMO — '+window.document.title;
  await context.api.onLoginSuccess();
  context.api.setSyncStatus('offline','DEMO · SYNTHETIC');
  const out=document.getElementById('signout-btn');
  if(out){out.title='Exit demo';out.setAttribute('data-onclick','exitDemo()');}
}

return Object.defineProperties({}, {
  demoMode: {enumerable:true, configurable:true, get:()=>demo},
  enterDemo: {enumerable:true, configurable:true, get:()=>enterDemo},
  exitDemo: {enumerable:true, configurable:true, get:()=>exitDemo},
  startDemo: {enumerable:true, configurable:true, get:()=>startDemo}
});
}
