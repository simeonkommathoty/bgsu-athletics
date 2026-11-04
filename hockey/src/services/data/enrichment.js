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
// Metrics with full dated history logged via kpi_history (Force Plate/VALD
// metrics are NOT included here — those stay on the existing "always latest
// real session" system via enrichAthletesFromSessions above).
// Reference: originals/hockey.html:7065
const BEST_RECENT_METRIC_KEYS=['approachJump','cmjHeight','standVert','sprint10','frontSquatMax','ngChinUp','onIceBeep','benchMax','hangCleanMax'];


// Reference: originals/hockey.html:7066
const BEST_RECENT_WINDOW_DAYS=270;

// ~9 months

// For each athlete/metric, compares their CURRENT displayed value against the
// best value logged in kpi_history within the last 9 months, and upgrades to
// whichever is objectively better. Never downgrades or clears a value that
// has no matching history (e.g. from manual entry or an older import that
// predates history logging) -- this only ever improves what's shown, never
// erases legitimate data from a source that isn't tracked in kpi_history.
// Reference: originals/hockey.html:7074
function applyBestRecentValues(){
  if(!context.api.KPI_HISTORY.length) return;
  const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-BEST_RECENT_WINDOW_DAYS);
  const cutoffISO=cutoff.toISOString().slice(0,10);

  for(const a of context.api.ATHLETES){
    // 10-yd Sprint: September test dates only. Shown value = best result from
    // the most recent September testing block; anything else is cleared.
    const sprintHist=context.api.histFor(a,'sprint10').filter(h=>context.api.isSeptDate(h.test_date));
    if(sprintHist.length){
      const latestYear=sprintHist.reduce((y,h)=>h.test_date.slice(0,4)>y?h.test_date.slice(0,4):y,'0000');
      const block=sprintHist.filter(h=>h.test_date.slice(0,4)===latestYear);
      const best=block.reduce((b,h)=>h.value<b.value?h:b);
      a.sprint10=best.value; a.sprint10Date=best.test_date;
    } else if(a.sprint10!=null && !context.api.isSeptDate(a.sprint10Date)){
      a.sprint10=null; a.sprint10Date=null;
    }
    for(const key of BEST_RECENT_METRIC_KEYS){
      if(key==='sprint10') continue;
      const m=context.api.getM(key); if(!m) continue;
      const recent=context.api.histFor(a,key).filter(h=>h.test_date>=cutoffISO);
      if(!recent.length) continue;
      let best=recent[0];
      for(const h of recent){
        const isBetter=m.hb?(h.value>best.value):(h.value<best.value);
        if(isBetter) best=h;
      }
      const current=a[key];
      const historyIsBetter = current==null||isNaN(current) ? true : (m.hb?(best.value>current):(best.value<current));
      if(historyIsBetter){
        a[key]=best.value;
        a[key+'Date']=best.test_date;
      }
    }
  }
}


// Reference: originals/hockey.html:7111
function academicYearStart(){
  const d=new Date(), y=d.getMonth()>=6?d.getFullYear():d.getFullYear()-1; // Jul 1
  return y+'-07-01';
}


// Reference: originals/hockey.html:7115
function bestPowerThisYear(name){
  const from=academicYearStart();
  const vals=context.api.sessionsForAthlete(name)
    .filter(s=>s.test_date>=from)
    .map(s=>s.peak_power!=null?s.peak_power:s.power)
    .filter(v=>v!=null&&!isNaN(v)&&v>=800&&v<=7500)
    .sort((x,y)=>x-y);
  if(!vals.length) return null;
  const mid=Math.floor(vals.length/2), med=vals.length%2?vals[mid]:(vals[mid-1]+vals[mid])/2;
  const ok=vals.filter(v=>v<=med*1.2);
  return ok.length?ok[ok.length-1]:null;
}

// Merge session values into ATHLETES (peak power = best this academic year; rsi etc = latest clean)
// Reference: originals/hockey.html:7129
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
    // Peak power = BEST of the current academic year (Jul 1 on), so in-season
    // force plate testing can only raise a player's composite, never lower it.
    // Guard: ignore anything outside 800-7500 W or more than 20% above his own
    // median for the year (a junk export can't become his "best").
    const pp=bestPowerThisYear(name)??(pickBest(name,'peak_power')||pickBest(name,'power'));
    const rsi=pickBest(name,'rsi_mod')||pickBest(name,'mrsi');
    const cia=pickBest(name,'conc_impulse_asym');
    // NOTE: cmjHeight is intentionally NOT synced here. Unlike peakPower/rsi
    // (which are exclusively VALD concepts with no other data source), cmjHeight
    // doubles as this build's general "Vertical Jump" test result (from the
    // testing-spreadsheet CSV import / manual entry) everywhere outside the
    // Force Plate page. Overwriting it here would silently replace a real
    // jump-mat test with force-plate CMJ data on the Team Dashboard, leaderboards,
    // composite score, etc. The Force Plate page gets real VALD-only CMJ height
    // from its own separate athletesWithLatestSession() function instead.
    return {
      ...a,
      peakPower:       pp??a.peakPower??null,
      rsi:             rsi??a.rsi??null,
      concImpulseAsym: cia??a.concImpulseAsym??null,
    };
  });
}

return Object.defineProperties({}, {
  BEST_RECENT_METRIC_KEYS: {enumerable:true, configurable:true, get:()=>BEST_RECENT_METRIC_KEYS},
  BEST_RECENT_WINDOW_DAYS: {enumerable:true, configurable:true, get:()=>BEST_RECENT_WINDOW_DAYS},
  applyBestRecentValues: {enumerable:true, configurable:true, get:()=>applyBestRecentValues},
  academicYearStart: {enumerable:true, configurable:true, get:()=>academicYearStart},
  bestPowerThisYear: {enumerable:true, configurable:true, get:()=>bestPowerThisYear},
  enrichAthletesFromSessions: {enumerable:true, configurable:true, get:()=>enrichAthletesFromSessions}
});
}
