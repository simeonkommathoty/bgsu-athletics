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
// Athletes array starts empty — all data loads from Supabase on login
// Reference: originals/hockey.html:1378
let ATHLETES = [];

// default when imported with no position

// A position is "set" if it was explicitly assigned (has _posLocked flag)
// Reference: originals/hockey.html:1535
function posIsSet(a){ return !!a._posLocked; }


// Reference: originals/hockey.html:1536
function unsetCount(){ return ATHLETES.filter(a=>!posIsSet(a)).length; }

// Called after every import — auto-lock positions already set, auto-nav to roster if any unset
// Reference: originals/hockey.html:1855
function postImportPositionCheck(){
  ATHLETES.forEach(a=>{
    if(a._hasPos&&a.pos) a._posLocked=true;
    // If athlete has no canonical name yet, set it from .name but leave unlocked for confirmation
    if(!a._canonicalName) a._canonicalName=a.name;
  });
  context.api.updateRosterBadge();
  const needsSetup=ATHLETES.filter(a=>!posIsSet(a)||!a._nameLocked).length;
  if(needsSetup>0){
    setTimeout(()=>{ context.navigate('roster'); context.api.toast(`${needsSetup} athlete${needsSetup!==1?'s':''} need name/position — confirm here`); }, 400);
  }
}

// ── Deduplication ────────────────────────────────────────────────
// Merge any duplicate canonical names in ATHLETES in-place.
// For each group sharing the same canonical name: merge all records into one
// (best composite wins numeric values, locked flags are OR'd, sources are combined).
// Reference: originals/hockey.html:5934
function dedupeATHLETES(){
  const seen = new Map(); // canonical → index in ATHLETES
  const toRemove = new Set();

  for(let i=0;i<ATHLETES.length;i++){
    const a=ATHLETES[i];
    const key=context.api.nameKey(a._canonicalName||a.name);
    if(!key) continue;

    if(!seen.has(key)){
      seen.set(key,i);
    } else {
      // Merge into the first occurrence
      const primaryIdx=seen.get(key);
      const primary=ATHLETES[primaryIdx];
      const dup=a;

      // For each numeric metric, keep the better value
      const metricKeys=['approachJump','cmjHeight','standVert','sprint10','peakPower','rsi','asymmetry','eccRFD','concImpulse','eccImpulse','contractionTime','jumpVol','avgJumpHt','playerLoad','acuteLoad','chronicLoad','frontSquatMax','ngChinUp','onIceBeep','benchMax','hangCleanMax'];
      for(const k of metricKeys){
        const m=context.api.getM(k);
        if(!m) continue;
        const primVal=primary[k], dupVal=dup[k];
        if(typeof dupVal==='number'&&!isNaN(dupVal)&&typeof primVal==='number'&&!isNaN(primVal)){
          // "Better" = higher for higherBetter metrics, lower for time/asymmetry
          primary[k]=m.hb?Math.max(primVal,dupVal):Math.min(primVal,dupVal);
        }
      }

      // Inherit locked flags
      if(dup._posLocked) primary._posLocked=true;
      if(dup._nameLocked){ primary._nameLocked=true; primary._canonicalName=dup._canonicalName||primary._canonicalName; }
      if(dup.pos&&!primary._posLocked) primary.pos=dup.pos;
      if(dup.yr&&primary.yr==='Jr') primary.yr=dup.yr;
      if(dup.age&&primary.age===20) primary.age=dup.age;

      // Merge sources
      if(dup._sources?.length){
        primary._sources=(primary._sources||[]);
        for(const s of dup._sources){
          if(!primary._sources.find(x=>x.file===s.file)) primary._sources.push(s);
        }
      }

      // Recompute
      primary.acwr=context.api.calcACWR(primary);
      primary.composite=context.api.calcCompositeVB(primary);
      primary.tier=context.api.calcTier(primary.composite);
      primary.trend[primary.trend.length-1]=primary.composite;

      toRemove.add(i);
    }
  }

  if(toRemove.size>0){
    ATHLETES=ATHLETES.filter((_,i)=>!toRemove.has(i));
  }
}

// The single source of truth for all UI rendering — always deduplicated and sorted by name
// ── Active athlete filter ────────────────────────────────────────
// Athletes are "active" if they have a test session in the last 6 months.
// Inactive athletes are hidden from leaderboards/charts but remain editable in Roster Setup.
// Reference: originals/hockey.html:5997
const ACTIVE_WINDOW_DAYS = 183;

// ~6 months
// Reference: originals/hockey.html:5999
function isAthleteActive(athlete){
  if(!context.api.SESSIONS||!context.api.SESSIONS.length) return true; // No sessions at all → show everyone
  const cutoff=new Date(Date.now()-ACTIVE_WINDOW_DAYS*24*60*60*1000).toISOString().slice(0,10);
  const canonical=context.api.normName(athlete._canonicalName||athlete.name);
  return context.api.SESSIONS.some(s=>
    s.test_date>=cutoff &&
    context.api.normName(s.athlete_name)===canonical
  );
}

// All non-archived athletes (for Roster Setup, manual edit, dropdowns)
// Reference: originals/hockey.html:6010
function allAthletes(){
  dedupeATHLETES();
  return ATHLETES.filter(a=>!a._archived)
    .slice().sort((a,b)=>(a._canonicalName||a.name).localeCompare(b._canonicalName||b.name));
}

// Archived athletes only — for the Archived filter in Roster Setup
// Reference: originals/hockey.html:6017
function archivedAthletes(){
  dedupeATHLETES();
  return ATHLETES.filter(a=>a._archived)
    .slice().sort((a,b)=>(a._canonicalName||a.name).localeCompare(b._canonicalName||b.name));
}

// Active-only roster — used by all leaderboards, charts, KPIs, dashboards
// Reference: originals/hockey.html:6024
function rosterAthletes(){
  const all=allAthletes(); // already excludes archived
  if(!context.api.SESSIONS||!context.api.SESSIONS.length) return all;
  const active=all.filter(isAthleteActive);
  return active.length>0 ? active : all;
}

// Build athlete <option> list for dropdowns — always deduplicated, sorted alphabetically
// Reference: originals/hockey.html:6032
function athleteOptions(includePlaceholder=''){
  // Profile/Compare dropdowns include ALL athletes (so you can review inactive players too)
  const sorted=allAthletes();
  const opts=sorted.map(a=>{
    const inactive=!isAthleteActive(a);
    const suffix=inactive?' · INACTIVE':'';
    return`<option value="${a.id}">${a._canonicalName||a.name} (${a.pos})${suffix}</option>`;
  }).join('');
  return includePlaceholder?`<option value="">${includePlaceholder}</option>${opts}`:opts;
}


// Reference: originals/hockey.html:6043
function refreshAll(){
  dedupeATHLETES();
  ATHLETES=ATHLETES.map((a,i)=>({...a,id:i}));
  context.api.refreshApproachJumpFreshness();
  Object.keys(context.api.CH).forEach(k=>context.api.kc(k));
  if(context.api.sb && context.api.currentUser && context.api._cloudDataLoaded) context.api.queueSaveAll();
}

return Object.defineProperties({}, {
  ATHLETES: {enumerable:true, configurable:true, get:()=>ATHLETES, set:value=>{ATHLETES=value;}},
  posIsSet: {enumerable:true, configurable:true, get:()=>posIsSet},
  unsetCount: {enumerable:true, configurable:true, get:()=>unsetCount},
  postImportPositionCheck: {enumerable:true, configurable:true, get:()=>postImportPositionCheck},
  dedupeATHLETES: {enumerable:true, configurable:true, get:()=>dedupeATHLETES},
  ACTIVE_WINDOW_DAYS: {enumerable:true, configurable:true, get:()=>ACTIVE_WINDOW_DAYS},
  isAthleteActive: {enumerable:true, configurable:true, get:()=>isAthleteActive},
  allAthletes: {enumerable:true, configurable:true, get:()=>allAthletes},
  archivedAthletes: {enumerable:true, configurable:true, get:()=>archivedAthletes},
  rosterAthletes: {enumerable:true, configurable:true, get:()=>rosterAthletes},
  athleteOptions: {enumerable:true, configurable:true, get:()=>athleteOptions},
  refreshAll: {enumerable:true, configurable:true, get:()=>refreshAll}
});
}
