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
// ── Generic data-availability helpers for sort dropdowns ─────────
// Returns true if any active athlete has a real value for this metric.
// Reference: originals/volleyball.html:2297
function metricHasData(metricKey, athleteList){
  const r=athleteList||context.api.rosterAthletes();
  return r.some(a=>{
    const v=a[metricKey];
    return v!==null&&v!==undefined&&!isNaN(v);
  });
}

// Generic populator: pass a select element id and an ordered list of metric keys.
// Disables options whose metric has no data across the active roster.
// Preserves selection if still valid, otherwise falls back to first enabled option.
// Reference: originals/volleyball.html:2308
function populateMetricSelect(selectId, metricKeys, athleteList){
  const sel=document.getElementById(selectId);
  if(!sel) return;
  const r=athleteList||context.api.rosterAthletes();
  const currentValue=sel.value;
  sel.innerHTML=metricKeys.map(k=>{
    const m=context.api.getM(k);
    if(!m) return '';
    const hasData=k==='composite'||metricHasData(k, r);
    const label=`${m.label}${m.unit?' ('+m.unit+')':''}${hasData?'':' — no data'}`;
    return `<option value="${k}"${hasData?'':' disabled style="color:var(--text4);"'}>${label}</option>`;
  }).join('');
  // Restore previous selection if still enabled, else fall back
  const prevOpt=Array.from(sel.options).find(o=>o.value===currentValue&&!o.disabled);
  if(prevOpt){sel.value=currentValue;}
  else{
    const firstEnabled=Array.from(sel.options).find(o=>!o.disabled);
    if(firstEnabled) sel.value=firstEnabled.value;
  }
}

return Object.defineProperties({}, {
  metricHasData: {enumerable:true, configurable:true, get:()=>metricHasData},
  populateMetricSelect: {enumerable:true, configurable:true, get:()=>populateMetricSelect}
});
}
