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
/* ─── FORCE PLATE ─── */

// Returns roster athletes with their most recent NON-OUTLIER session merged in.
// If the latest session is an outlier for a given metric, fall back to the
// next-most-recent clean value for that metric.
// Reference: originals/volleyball.html:2228
function athletesWithLatestSession(){
  const ros=context.api.rosterAthletes();
  // For each athlete, sort sessions newest→oldest and pick the newest CLEAN value per metric
  const byName={};
  for(const s of context.api.SESSIONS){
    const k=context.api.normName(s.athlete_name);
    if(!byName[k]) byName[k]=[];
    byName[k].push(s);
  }
  Object.values(byName).forEach(arr=>arr.sort((a,b)=>b.test_date.localeCompare(a.test_date)));

  // For each metric, find the newest non-outlier value
  const pickClean=(athName, metric)=>{
    const sessions=byName[context.api.normName(athName)]||[];
    for(const s of sessions){
      const v=s[metric];
      if(v!==null&&v!==undefined&&!isNaN(v)&&!context.api.isOutlier(metric,v,athName)) return {value:v, date:s.test_date};
    }
    return null;
  };

  return ros.map(a=>{
    const name=a._canonicalName||a.name;
    const sessions=byName[context.api.normName(name)];

    if(!sessions||!sessions.length) return a;

    const peakPower=pickClean(name,'peak_power')||pickClean(name,'power');
    const rsi=pickClean(name,'rsi_mod')||pickClean(name,'mrsi');
    const asymmetry=pickClean(name,'asymmetry');
    const eccRFD=pickClean(name,'ecc_rfd');
    const concImpulse=pickClean(name,'concentric_impulse')||pickClean(name,'conc_impulse');
    const eccImpulse=pickClean(name,'ecc_impulse');
    const contractionTime=pickClean(name,'contraction_time');
    const cmjHeight=pickClean(name,'jump_height');
    const takeoffVelocity=pickClean(name,'takeoff_velocity');
    const concImpulseAsym=pickClean(name,'conc_impulse_asym');
    const eccBrakingAsym=pickClean(name,'ecc_braking_asym');

    // Helper: use clean session value if available, else fall back to clean athlete record value.
    // If both are outliers/missing, return undefined (athlete excluded from that metric's leaderboard).
    // pickClean already iterates sessions newest→oldest so the first result is always the best clean one.
    const cleanFallback=(sessionResult, athleteKey)=>{
      if(sessionResult?.value!==undefined) return sessionResult.value;
      const v=a[athleteKey];
      if(v!==null&&v!==undefined&&!isNaN(v)&&!context.api.isOutlier(athleteKey,v,name)) return v;
      return undefined;
    };

    return {
      ...a,
      peakPower: peakPower?.value ?? a.peakPower,
      rsi: rsi?.value ?? a.rsi,
      asymmetry: cleanFallback(asymmetry,'asymmetry'),
      eccRFD: cleanFallback(eccRFD,'eccRFD'),
      concImpulse: cleanFallback(concImpulse,'concImpulse'),
      eccImpulse: cleanFallback(eccImpulse,'eccImpulse'),
      contractionTime: cleanFallback(contractionTime,'contractionTime'),
      cmjHeight: cleanFallback(cmjHeight,'cmjHeight'),
      takeoffVelocity: takeoffVelocity?.value ?? null,
      concImpulseAsym: concImpulseAsym?.value ?? null,
      eccBrakingAsym: eccBrakingAsym?.value ?? null,
      _latestSessionDate: sessions[0].test_date,
    };
  });
}

return Object.defineProperties({}, {
  athletesWithLatestSession: {enumerable:true, configurable:true, get:()=>athletesWithLatestSession}
});
}
