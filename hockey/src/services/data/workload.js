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
// Reference: originals/hockey.html:2806
function getKinexonSessions(){
  const byAthlete={};
  for(const s of context.api.SESSIONS){
    // Firstbeat sessions have TRIMP or HR data populated
    const hasFirstbeat = s.trimp_total!=null || s.avg_hr!=null || s.trimp_per_min!=null || s.effic_score!=null;
    if(!hasFirstbeat) continue;
    const nm=context.api.normName(s.athlete_name);
    if(!byAthlete[nm]) byAthlete[nm]=[];
    byAthlete[nm].push(s);
  }
  for(const nm of Object.keys(byAthlete)){
    // Sorting by test_date alone leaves same-day rows in whatever order the
    // database happened to return them — which can silently prefer a stale
    // orphaned row (athlete_id null, left over from a previous broken/re-run
    // import) over the correct, properly-linked one. Break same-date ties by
    // preferring a real athlete_id first, then the most recently created row.
    byAthlete[nm].sort((a,b)=>{
      const dateCmp=b.test_date.localeCompare(a.test_date);
      if(dateCmp!==0) return dateCmp;
      const aLinked=a.athlete_id!=null?1:0, bLinked=b.athlete_id!=null?1:0;
      if(aLinked!==bLinked) return bLinked-aLinked;
      return (b.created_at||'').localeCompare(a.created_at||'');
    });
  }
  return byAthlete;
}


// Reference: originals/hockey.html:2833
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
