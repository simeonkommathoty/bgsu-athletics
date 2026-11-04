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
// Merge latest clean session values (cmjHeight, peakPower, rsi etc) into ATHLETES array
// Reference: originals/volleyball.html:5916
function enrichAthletesFromSessions(){
  if(!context.api.SESSIONS.length) return;
  const byName={};
  for(const s of context.api.SESSIONS){
    const k=context.api.normName(s.athlete_name);
    if(!byName[k]) byName[k]=[];
    byName[k].push(s);
  }
  Object.values(byName).forEach(arr=>arr.sort((a,b)=>b.test_date.localeCompare(a.test_date)));

  const pickBest=(athName,metric)=>{
    const sessions=byName[context.api.normName(athName)]||[];
    // For jump_height: return all-time best (PR), not most recent
    if(metric==='jump_height'){
      let best=null;
      for(const s of sessions){
        const v=s[metric];
        if(v!=null&&!isNaN(v)&&v>=5&&v<=21&&!context.api.isOutlier(metric,v,athName)){
          if(best===null||v>best) best=v;
        }
      }
      return best;
    }
    // For all other metrics: most recent clean value
    for(const s of sessions){
      const v=s[metric];
      if(v!=null&&!isNaN(v)&&v>0&&!context.api.isOutlier(metric,v,athName)) return v;
    }
    return null;
  };

  context.api.ATHLETES=context.api.ATHLETES.map(a=>{
    const name=a._canonicalName||a.name;
    const cmj=pickBest(name,'jump_height');
    const pp=pickBest(name,'peak_power')||pickBest(name,'power');
    const rsi=pickBest(name,'rsi_mod')||pickBest(name,'mrsi');
    const cia=pickBest(name,'conc_impulse_asym');
    return {
      ...a,
      cmjHeight:       cmj??a.cmjHeight??null,
      peakPower:       pp??a.peakPower??null,
      rsi:             rsi??a.rsi??null,
      concImpulseAsym: cia??a.concImpulseAsym??null,
    };
  });
}

// ── Cloud → Local: load all athletes ─────────────────────────────
// Reference: originals/volleyball.html:5964
async function loadAllAthletes(){
  try{
    const {data, error} = await context.api.sb.from('athletes').select('*');
    if(error) throw error;
    if(!data||!data.length){
      console.log('Cloud roster empty. Using sample data until you import.');
      return;
    }
    // Clear sample data and replace with cloud roster
    context.api.ATHLETES = data.map((r,i)=>context.api.dbRowToAthlete(r,i));
    context.api.dedupeATHLETES();
    context.api.ATHLETES = context.api.ATHLETES.map((a,i)=>({...a,id:i}));
    context.api.refreshApproachJumpFreshness();
    Object.keys(context.api.CH).forEach(k=>context.api.kc(k));
    context.api._cloudDataLoaded = true;
    // Re-render immediately so dashboard populates with real data
    const ap=document.querySelector('.page.active');
    if(ap) context.navigate(ap.id.replace('page-',''));
  } catch(e){
    console.error('Load failed:',e);
    context.api.setSyncStatus('error','LOAD FAILED');
    context.api.toast('⚠ Could not load cloud roster: '+e.message);
  }
}

return Object.defineProperties({}, {
  enrichAthletesFromSessions: {enumerable:true, configurable:true, get:()=>enrichAthletesFromSessions},
  loadAllAthletes: {enumerable:true, configurable:true, get:()=>loadAllAthletes}
});
}
