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

// Reference: originals/hockey.html:6050
let toastT;


// Reference: originals/hockey.html:6051
function toast(msg,durationMs=3000){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:fixed;bottom:24px;right:24px;background:var(--bg3);border:1px solid var(--green);border-radius:var(--r);padding:10px 16px;font-family:var(--fm);font-size:11px;color:var(--green);z-index:600;transition:opacity 0.3s;pointer-events:none;max-width:340px;';document.body.appendChild(t);}t.textContent=msg;t.style.opacity='1';clearTimeout(toastT);toastT=setTimeout(()=>t.style.opacity='0',durationMs);}

return Object.defineProperties({}, {
  toastT: {enumerable:true, configurable:true, get:()=>toastT, set:value=>{toastT=value;}},
  toast: {enumerable:true, configurable:true, get:()=>toast}
});
}
