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
/* ─── Helpers ─── */
// Reference: originals/volleyball.html:1218
function tierBadge(t){return`<span class="tier ${context.api.TIER_CLASS_MAP[t]}">${t}</span>`;}


// Reference: originals/volleyball.html:1219
function inchesToFeet(inches){
  if(inches===null||inches===undefined||isNaN(inches)) return '—';
  // For sub-foot values, just show inches
  if(inches<12) return inches.toFixed(1)+'"';
  const feet=Math.floor(inches/12);
  const remaining=inches-feet*12;
  // Trim trailing zero (10' 5.0" → 10' 5")
  const inchStr=remaining%1===0?String(Math.round(remaining)):remaining.toFixed(1);
  return `${feet}' ${inchStr}"`;
}


// Reference: originals/volleyball.html:1229
function posPill(p){return`<span class="pos-pill p-${p}">${p}</span>`;}


// Reference: originals/volleyball.html:1230
function ava(a,sz=''){
  if(a.photo_url){
    return`<div class="av${sz} av-photo" style="background-image:url('${a.photo_url}');background-size:cover;background-position:center;background-color:var(--bg4);"></div>`;
  }
  return`<div class="av${sz} ${a.av}">${a.initials}</div>`;
}


// Reference: originals/volleyball.html:1236
function spark(t){const mx=Math.max(...t,1);return`<span class="spk">${t.map(v=>`<span class="spkb${v===Math.max(...t)?' hi':''}" style="height:${Math.round(v/mx*100)}%"></span>`).join('')}</span>`;}


// Reference: originals/volleyball.html:1237
function getM(key){return context.api.ALL_METRICS.find(m=>m.key===key);}

// Return the best available date for a metric on an athlete
// Checks: per-metric date field → session date → source log
// Reference: originals/volleyball.html:1241
const METRIC_DATE_KEY = {
  backSquatMax:'backSquatMaxDate', trapBarMax:'trapBarMaxDate',
  frontSquatMax:'frontSquatMaxDate', benchMax:'benchMaxDate',
  hangCleanMax:'hangCleanMaxDate', standVert:'standVertDate',
  approachJump:'approachJumpDate', cmjHeight:'cmjHeightDate',
};

// Metrics sourced from test_sessions (force plate) — these use _latestSessionDate
// Reference: originals/volleyball.html:1248
const FP_SESSION_METRICS = new Set(['peakPower','rsi','asymmetry','eccRFD','concImpulse','eccImpulse',
  'contractionTime','takeoffVelocity','concImpulseAsym','eccBrakingAsym','cmjHeight']);


// Reference: originals/volleyball.html:1251
function metricDate(athlete, metricKey){
  // 1. Explicit per-metric date field (Teambuildr maxes, approach vert)
  const dk=METRIC_DATE_KEY[metricKey];
  if(dk && athlete[dk]) return fmtDate(athlete[dk]);
  // 2. Session date — only for force plate metrics, not jumps/kinexon/composite
  if(FP_SESSION_METRICS.has(metricKey) && athlete._latestSessionDate)
    return fmtDate(athlete._latestSessionDate);
  // 3. Source log
  const src=context.api.sourceForKey(athlete, metricKey);
  if(src?.date) return src.date;
  return null;
}


// Reference: originals/volleyball.html:1263
function fmtDate(iso){
  if(!iso) return null;
  // Accept ISO date string like 2026-04-13 → Apr 13, 2026
  const d=new Date(iso+'T12:00:00'); // noon to avoid timezone issues
  if(isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}


// Reference: originals/volleyball.html:1270
function pctile(arr,val,key,hb){const v=arr.filter(a=>a[key]<=val).length/arr.length*100;return hb?Math.round(100-v):Math.round(v);}

// Convert raw inches to feet-and-inches display format: 125 → "10' 5\""
// Reference: originals/volleyball.html:1273
function inToFtIn(v){
  if(v===null||v===undefined||isNaN(v)) return '—';
  const totalInches=Math.round(v*2)/2;  // round to nearest 0.5"
  const ft=Math.floor(totalInches/12);
  const inches=totalInches-ft*12;
  const inStr=Number.isInteger(inches)?String(inches):inches.toFixed(1);
  return `${ft}' ${inStr}"`;
}

return Object.defineProperties({}, {
  tierBadge: {enumerable:true, configurable:true, get:()=>tierBadge},
  inchesToFeet: {enumerable:true, configurable:true, get:()=>inchesToFeet},
  posPill: {enumerable:true, configurable:true, get:()=>posPill},
  ava: {enumerable:true, configurable:true, get:()=>ava},
  spark: {enumerable:true, configurable:true, get:()=>spark},
  getM: {enumerable:true, configurable:true, get:()=>getM},
  METRIC_DATE_KEY: {enumerable:true, configurable:true, get:()=>METRIC_DATE_KEY},
  FP_SESSION_METRICS: {enumerable:true, configurable:true, get:()=>FP_SESSION_METRICS},
  metricDate: {enumerable:true, configurable:true, get:()=>metricDate},
  fmtDate: {enumerable:true, configurable:true, get:()=>fmtDate},
  pctile: {enumerable:true, configurable:true, get:()=>pctile},
  inToFtIn: {enumerable:true, configurable:true, get:()=>inToFtIn}
});
}
