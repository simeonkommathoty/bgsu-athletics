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
/* ─── WORKLOAD ─── */
// Get most recent Kinexon session per athlete
// Kinexon sessions are identified by having accel_load or jumps_total populated
// Reference: originals/volleyball.html:2563
function getKinexonSessions(){
  const byAthlete={};
  for(const s of context.api.SESSIONS){
    // Kinexon sessions have jump or accel data populated
    const hasKinexon = s.jumps_total!=null || s.accel_load!=null || 
                       s.jumps_per_min!=null || s.accel_load_per_min!=null ||
                       s.session_type==='Match' || s.session_type==='Training' || s.session_type==='Lift';
    if(!hasKinexon) continue;
    const nm=context.api.normName(s.athlete_name);
    if(!byAthlete[nm]) byAthlete[nm]=[];
    byAthlete[nm].push(s);
  }
  for(const nm of Object.keys(byAthlete)){
    byAthlete[nm].sort((a,b)=>b.test_date.localeCompare(a.test_date));
  }
  return byAthlete;
}


// Reference: originals/volleyball.html:2581
function getKinexonSessionForAthlete(athlete){
  const nm=context.api.normName(athlete._canonicalName||athlete.name);
  // Try exact match first, then fuzzy
  for(const [key, sessions] of Object.entries(getKinexonSessions())){
    if(key===nm) return sessions;
    // Also try without accents / extra spaces
    if(key.replace(/\s+/g,' ')===nm.replace(/\s+/g,' ')) return sessions;
  }
  return null;
}

return Object.defineProperties({}, {
  getKinexonSessions: {enumerable:true, configurable:true, get:()=>getKinexonSessions},
  getKinexonSessionForAthlete: {enumerable:true, configurable:true, get:()=>getKinexonSessionForAthlete}
});
}
