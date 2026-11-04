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

// Reference: originals/volleyball.html:5280
const READINESS_METRICS = [
  {key:'jump_height',        label:'Jump Height',         unit:'in',  hb:true,  fmt:v=>v.toFixed(2)},
  {key:'power',              label:'Power',               unit:'W',   hb:true,  fmt:v=>v.toFixed(0)},
  {key:'mrsi',            label:'mRSI',                unit:'',    hb:true,  fmt:v=>v.toFixed(2)},
  {key:'takeoff_velocity',   label:'Takeoff Velo',        unit:'m/s', hb:true,  fmt:v=>v.toFixed(2)},
  {key:'concentric_impulse',       label:'Concentric Impulse',  unit:'N·s', hb:true,  fmt:v=>v.toFixed(2)},
  // Asymmetry (conc_impulse_asym / ecc_braking_asym) intentionally removed from this
  // view and from flagging: exported max asymmetry values vary too much to trust.
  // The raw values are still saved on each session in Supabase.
];


// Reference: originals/volleyball.html:5291
const TEAM_STRIP_METRICS = [
  {key:'jump_height',        label:'Jump Height',        unit:'in', fmt:v=>v.toFixed(2)},
  {key:'takeoff_velocity',   label:'Takeoff Velo',       unit:'m/s',fmt:v=>v.toFixed(2)},
  {key:'power',              label:'Power',              unit:'W',  fmt:v=>v.toFixed(0)},
  {key:'concentric_impulse',       label:'Concentric Imp',     unit:'N·s',fmt:v=>v.toFixed(2)},
  {key:'mrsi',            label:'mRSI',               unit:'',   fmt:v=>v.toFixed(2)},
];


// Reference: originals/volleyball.html:5299
const READINESS_Z = 1.5;

// flag/tint threshold in SDs from the athlete's own 30-day avg (both directions)
// Reference: originals/volleyball.html:5300
const ASYM_FLAG_THRESHOLD = 10;


// Reference: originals/volleyball.html:5326
const PR_METRICS=['jump_height'];

// Hard-range sanity only (not the rolling check) so old valid values still count as history.
// Reference: originals/volleyball.html:5328
function prHardOk(metric,v){
  if(v==null||isNaN(v)) return false;
  const r=context.api.FP_HARD_RANGES[metric];
  return !(r&&(v<r[0]||v>r[1]));
}

// A PR = today's (non-outlier) value beats every earlier ForceDecks value for that athlete.
// Needs at least one earlier value, so an athlete's first-ever test isn't called a PR.
// Returns {athleteName: {metricKey: {value, prev}}}
// Reference: originals/volleyball.html:5336
function computeReadinessPRs(todaySessions, date, resolveName){
  const isV=s=>s.test_type==='vald_forcedecks'||(!s.test_type&&(s.power!=null||s.mrsi!=null||s.takeoff_velocity!=null||s.concentric_impulse!=null));
  const out={};
  const prior={};
  context.api.SESSIONS.forEach(s=>{
    if(s.test_date>=date||!isV(s)) return;
    const n=resolveName(s.athlete_name);
    (prior[n]=prior[n]||[]).push(s);
  });
  todaySessions.forEach(t=>{
    const name=resolveName(t.athlete_name);
    PR_METRICS.forEach(k=>{
      const v=t[k];
      if(v==null||isNaN(v)||context.api.isOutlier(k,v,name,date)) return;
      const hist=(prior[name]||[]).map(x=>x[k]).filter(x=>prHardOk(k,x));
      if(!hist.length) return;
      const prev=Math.max(...hist);
      if(v>prev) (out[name]=out[name]||{})[k]={value:v,prev};
    });
  });
  return out;
}

/* ── TEAM READINESS SCORE ──────────────────────────────────────────
   Rolls the Individual Macro View's own flags up into one team number for
   the selected date.
   - Metrics: the 5 directional VALD metrics only (Jump Height, Power, mRSI,
     Takeoff Velo, Concentric Impulse). Asymmetry is deliberately EXCLUDED --
     exported max asymmetry values vary too much to flag on reliably.
   - Flag: today's value more than READINESS_Z (1.5) SD BELOW the athlete's own 30-day
     average (outliers filtered). Improvements never flag.
   - Severity: 8 pts per flag, capped at 16 per athlete, summed over flagged
     athletes and divided by the number tested.
   - Breadth: share of tested athletes with >=1 flag x 30.
   - Score = 100 - severity - breadth (0-100).
   Note: with a -1.5 SD cut across 5 metrics, a few scattered single-metric
   dips are expected from noise alone; multi-metric drops on the same athlete
   and many athletes down at once are the real signal. */
// Reference: originals/volleyball.html:5568
const READINESS_RED_PENALTY = 8;

// points per flagged metric
// Reference: originals/volleyball.html:5569
const READINESS_MAX_PENALTY_PER_ATHLETE = READINESS_RED_PENALTY*2;

// cap per athlete
// Reference: originals/volleyball.html:5570
const READINESS_BREADTH_WEIGHT = 30;

// max points if 100% flagged
// Reference: originals/volleyball.html:5571
const READINESS_TIERS = [
  {min:85, label:'GOOD TO GO',      color:'var(--green)'},
  {min:65, label:'MONITOR CLOSELY', color:'var(--yellow)'},
  {min:0,  label:'BACK OFF TODAY',  color:'var(--red)'},
];


// Reference: originals/volleyball.html:5577
function computeTeamReadiness(todaySessions, windowSessions, date, resolveName){
  const perfMetrics=READINESS_METRICS.filter(m=>m.hb===true);
  const testedNames=[...new Set(todaySessions.map(s=>resolveName(s.athlete_name)))].sort();
  const flaggedAthletes=[];
  testedNames.forEach(name=>{
    const todaySess=todaySessions.find(s=>resolveName(s.athlete_name)===name);
    const hist=windowSessions.filter(s=>resolveName(s.athlete_name)===name);
    const flags=[];
    perfMetrics.forEach(m=>{
      const v=todaySess?todaySess[m.key]:null;
      if(v==null||isNaN(v)||context.api.isOutlier(m.key,v,name,date)) return;
      const vals=hist.map(s=>s[m.key]).filter(x=>x!=null&&!isNaN(x)&&!context.api.isOutlier(m.key,x,name,date));
      if(vals.length<2) return;
      const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
      const sd=Math.sqrt(vals.reduce((a,x)=>a+Math.pow(x-avg,2),0)/(vals.length-1));
      if(!(sd>0)) return;
      const z=(v-avg)/sd;
      if(z<=-READINESS_Z) flags.push({label:m.label,z});
    });
    if(flags.length) flaggedAthletes.push({name,flags});
  });
  const testedCount=testedNames.length;
  if(!testedCount) return {score:null,label:'NO DATA',color:'var(--text3)',testedCount:0,flaggedAthletes:[]};
  const severity=flaggedAthletes.reduce((a,f)=>a+Math.min(f.flags.length*READINESS_RED_PENALTY,READINESS_MAX_PENALTY_PER_ATHLETE),0)/testedCount;
  const breadth=(flaggedAthletes.length/testedCount)*READINESS_BREADTH_WEIGHT;
  const score=Math.max(0,Math.min(100,Math.round(100-severity-breadth)));
  const tier=READINESS_TIERS.find(t=>score>=t.min);
  // Most concerning first: more metrics down, then the deepest single drop
  flaggedAthletes.sort((a,b)=>b.flags.length-a.flags.length||Math.min(...a.flags.map(f=>f.z))-Math.min(...b.flags.map(f=>f.z)));
  return {score,label:tier.label,color:tier.color,testedCount,flaggedAthletes};
}

return Object.defineProperties({}, {
  READINESS_METRICS: {enumerable:true, configurable:true, get:()=>READINESS_METRICS},
  TEAM_STRIP_METRICS: {enumerable:true, configurable:true, get:()=>TEAM_STRIP_METRICS},
  READINESS_Z: {enumerable:true, configurable:true, get:()=>READINESS_Z},
  ASYM_FLAG_THRESHOLD: {enumerable:true, configurable:true, get:()=>ASYM_FLAG_THRESHOLD},
  PR_METRICS: {enumerable:true, configurable:true, get:()=>PR_METRICS},
  prHardOk: {enumerable:true, configurable:true, get:()=>prHardOk},
  computeReadinessPRs: {enumerable:true, configurable:true, get:()=>computeReadinessPRs},
  READINESS_RED_PENALTY: {enumerable:true, configurable:true, get:()=>READINESS_RED_PENALTY},
  READINESS_MAX_PENALTY_PER_ATHLETE: {enumerable:true, configurable:true, get:()=>READINESS_MAX_PENALTY_PER_ATHLETE},
  READINESS_BREADTH_WEIGHT: {enumerable:true, configurable:true, get:()=>READINESS_BREADTH_WEIGHT},
  READINESS_TIERS: {enumerable:true, configurable:true, get:()=>READINESS_TIERS},
  computeTeamReadiness: {enumerable:true, configurable:true, get:()=>computeTeamReadiness}
});
}
