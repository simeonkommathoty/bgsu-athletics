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
// data from the most recent Hub render, reused by the PDF export

// Metric definitions for the readiness table
// Reference: originals/hockey.html:6061
const READINESS_METRICS = [
  {key:'jump_height',        label:'Jump Height',         unit:'in',  hb:true,  fmt:v=>v.toFixed(2)},
  {key:'peak_power',         label:'Power',               unit:'W',   hb:true,  fmt:v=>v.toFixed(0)},
  {key:'rsi_mod',            label:'mRSI',                unit:'',    hb:true,  fmt:v=>v.toFixed(2)},
  {key:'takeoff_velocity',   label:'Takeoff Velo',        unit:'m/s', hb:true,  fmt:v=>v.toFixed(2)},
  {key:'conc_impulse',       label:'Concentric Impulse',  unit:'N·s', hb:true,  fmt:v=>v.toFixed(2)},
  // Asymmetry (conc_impulse_asym / ecc_braking_asym) intentionally removed from this
  // view and from flagging: exported max asymmetry values vary too much to trust.
  // The raw values are still saved on each session in Supabase.
];


// Reference: originals/hockey.html:6072
const TEAM_STRIP_METRICS = [
  {key:'jump_height',        label:'Jump Height',        unit:'in', fmt:v=>v.toFixed(2)},
  {key:'takeoff_velocity',   label:'Takeoff Velo',       unit:'m/s',fmt:v=>v.toFixed(2)},
  {key:'peak_power',         label:'Power',              unit:'W',  fmt:v=>v.toFixed(0)},
  {key:'conc_impulse',       label:'Concentric Imp',     unit:'N·s',fmt:v=>v.toFixed(2)},
  {key:'rsi_mod',            label:'mRSI',               unit:'',   fmt:v=>v.toFixed(2)},
];


// Reference: originals/hockey.html:6080
const READINESS_Z = 1.5;

// flag/tint threshold in SDs from the athlete's own 30-day avg (both directions)
// Reference: originals/hockey.html:6081
const ASYM_FLAG_THRESHOLD = 10;

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
   - Single-metric flags are "watch" only: 3 pts each (one -1.5 SD dip on one of
     5 metrics happens to ~1 in 4 athletes by chance on a normal day).
     Multi-metric drops (2+ flags) use the 8/flag, cap-16 penalty.
   - Breadth: share of tested athletes with 2+ flags x 30.
   - Group trend: each athlete's mean z across the 5 metrics, averaged over the
     team (each athlete counts once). Only a team-wide DECLINE costs points:
     25 pts per 1.0 SD of average decline, capped at 25. A team-wide
     improvement costs nothing and adds nothing.
   - Tested = athletes with at least one valid metric value on the date.
   - Score = 100 - severity - breadth - group trend (0-100).
   Note: with a -1.5 SD cut across 5 metrics, a few scattered single-metric
   dips are expected from noise alone; multi-metric drops on the same athlete
   and many athletes down at once are the real signal. */
// Reference: originals/hockey.html:6488
const READINESS_RED_PENALTY = 8;

// points per flagged metric
// Reference: originals/hockey.html:6489
const READINESS_MAX_PENALTY_PER_ATHLETE = READINESS_RED_PENALTY*2;

// cap per athlete
// Reference: originals/hockey.html:6490
const READINESS_BREADTH_WEIGHT = 30;

// max points if 100% have 2+ flags
// Reference: originals/hockey.html:6491
const READINESS_SINGLE_FLAG_PENALTY = 3;

// a lone single-metric dip ("watch")
// Reference: originals/hockey.html:6492
const READINESS_TREND_WEIGHT = 25;

// points per 1.0 SD of team-wide average decline
// Reference: originals/hockey.html:6493
const READINESS_TREND_CAP = 25;

// max points from group trend
// Reference: originals/hockey.html:6494
const READINESS_TIERS = [
  {min:85, label:'GOOD TO GO',      color:'var(--green)'},
  {min:65, label:'MONITOR CLOSELY', color:'var(--yellow)'},
  {min:0,  label:'BACK OFF TODAY',  color:'var(--red)'},
];


// Reference: originals/hockey.html:6500
function computeTeamReadiness(todaySessions, windowSessions, date, resolveName){
  const perfMetrics=READINESS_METRICS.filter(m=>m.hb===true);
  const sessionNames=[...new Set(todaySessions.map(s=>resolveName(s.athlete_name)))].sort();
  const flaggedAthletes=[];
  const athleteMeanZ=[];   // one mean z per athlete with any baseline-comparable metric
  const testedNames=[];    // athletes with at least one valid metric value today
  sessionNames.forEach(name=>{
    const todaySess=todaySessions.find(s=>resolveName(s.athlete_name)===name);
    const hist=windowSessions.filter(s=>resolveName(s.athlete_name)===name);
    const flags=[];
    const zs=[];
    let hasValue=false;
    perfMetrics.forEach(m=>{
      const v=todaySess?todaySess[m.key]:null;
      if(v==null||isNaN(v)||context.api.isOutlier(m.key,v,name,date)) return;
      hasValue=true;
      const vals=hist.map(s=>s[m.key]).filter(x=>x!=null&&!isNaN(x)&&!context.api.isOutlier(m.key,x,name,date));
      if(vals.length<2) return;
      const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
      const sd=Math.sqrt(vals.reduce((a,x)=>a+Math.pow(x-avg,2),0)/(vals.length-1));
      if(!(sd>0)) return;
      const z=(v-avg)/sd;
      zs.push(z);
      if(z<=-READINESS_Z) flags.push({label:m.label,z});
    });
    if(!hasValue) return; // on the session list but no usable data today -> not counted as tested
    testedNames.push(name);
    if(zs.length) athleteMeanZ.push(zs.reduce((a,b)=>a+b,0)/zs.length);
    if(flags.length) flaggedAthletes.push({name,flags});
  });
  const testedCount=testedNames.length;
  if(!testedCount) return {score:null,label:'NO DATA',color:'var(--text3)',testedCount:0,flaggedAthletes:[],teamMeanZ:null,belowAvgCount:0,trendCount:0,trend:0};
  const severity=flaggedAthletes.reduce((a,f)=>a+(f.flags.length>=2?Math.min(f.flags.length*READINESS_RED_PENALTY,READINESS_MAX_PENALTY_PER_ATHLETE):READINESS_SINGLE_FLAG_PENALTY),0)/testedCount;
  const multiCount=flaggedAthletes.filter(f=>f.flags.length>=2).length;
  const watchCount=flaggedAthletes.length-multiCount;
  const breadth=(multiCount/testedCount)*READINESS_BREADTH_WEIGHT;
  const trendCount=athleteMeanZ.length;
  const teamMeanZ=trendCount?athleteMeanZ.reduce((a,b)=>a+b,0)/trendCount:null;
  const belowAvgCount=athleteMeanZ.filter(z=>z<0).length;
  const trend=teamMeanZ!=null&&teamMeanZ<0?Math.min(-teamMeanZ*READINESS_TREND_WEIGHT,READINESS_TREND_CAP):0;
  const score=Math.max(0,Math.min(100,Math.round(100-severity-breadth-trend)));
  const tier=READINESS_TIERS.find(t=>score>=t.min);
  // Most concerning first: more metrics down, then the deepest single drop
  flaggedAthletes.sort((a,b)=>b.flags.length-a.flags.length||Math.min(...a.flags.map(f=>f.z))-Math.min(...b.flags.map(f=>f.z)));
  return {score,label:tier.label,color:tier.color,testedCount,flaggedAthletes,multiCount,watchCount,teamMeanZ,belowAvgCount,trendCount,trend,severity,breadth};
}

// One line describing the team-wide shift: average deviation across all athletes
// and metrics, how many sit below their own average, and the points it cost.
// Reference: originals/hockey.html:6549
function readinessTrendLine(r, mode){
  if(r.teamMeanZ==null) return '';
  const z=r.teamMeanZ, pts=Math.round(r.trend);
  const zTxt=`${z>=0?'+':''}${z.toFixed(2)}σ`;
  const ptsTxt=pts>0?` · −${pts} pts`:'';
  const txt=`Group trend ${zTxt} avg across all metrics · ${r.belowAvgCount} of ${r.trendCount} below their own average${ptsTxt}`;
  if(mode==='print') return `<div class="rp-sub">${txt}</div>`;
  const c=z<=-0.5?'var(--red)':z<0?'var(--yellow)':'var(--green)';
  return `<div style="font-size:11px;font-family:var(--fm);margin-top:5px;color:var(--text2);"><span style="color:${c};font-weight:700;">●</span> ${txt}</div>`;
}

/* ── JUMP HEIGHT PRs ─────────────────────────────────────────────
   A PR = today's (non-outlier) jump height beats every earlier ForceDecks
   jump height for that athlete (all-time, alias-aware). Needs at least one
   earlier test, so an athlete's first-ever test isn't called a PR.
   Returns {athleteName: {jump_height: {value, prev}}} */
// Reference: originals/hockey.html:6661
const PR_METRICS=['jump_height'];

// Hard-range sanity only (not the rolling check) so old valid values still count as history.
// Reference: originals/hockey.html:6663
function prHardOk(metric,v){
  if(v==null||isNaN(v)) return false;
  const r=context.api.FP_HARD_RANGES[metric];
  return !(r&&(v<r[0]||v>r[1]));
}


// Reference: originals/hockey.html:6668
function computeReadinessPRs(todaySessions, date, resolveName){
  const out={}, prior={};
  context.api.SESSIONS.forEach(s=>{
    if(s.test_date>=date||!context.api.isValdSession(s)) return;
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

return Object.defineProperties({}, {
  READINESS_METRICS: {enumerable:true, configurable:true, get:()=>READINESS_METRICS},
  TEAM_STRIP_METRICS: {enumerable:true, configurable:true, get:()=>TEAM_STRIP_METRICS},
  READINESS_Z: {enumerable:true, configurable:true, get:()=>READINESS_Z},
  ASYM_FLAG_THRESHOLD: {enumerable:true, configurable:true, get:()=>ASYM_FLAG_THRESHOLD},
  READINESS_RED_PENALTY: {enumerable:true, configurable:true, get:()=>READINESS_RED_PENALTY},
  READINESS_MAX_PENALTY_PER_ATHLETE: {enumerable:true, configurable:true, get:()=>READINESS_MAX_PENALTY_PER_ATHLETE},
  READINESS_BREADTH_WEIGHT: {enumerable:true, configurable:true, get:()=>READINESS_BREADTH_WEIGHT},
  READINESS_SINGLE_FLAG_PENALTY: {enumerable:true, configurable:true, get:()=>READINESS_SINGLE_FLAG_PENALTY},
  READINESS_TREND_WEIGHT: {enumerable:true, configurable:true, get:()=>READINESS_TREND_WEIGHT},
  READINESS_TREND_CAP: {enumerable:true, configurable:true, get:()=>READINESS_TREND_CAP},
  READINESS_TIERS: {enumerable:true, configurable:true, get:()=>READINESS_TIERS},
  computeTeamReadiness: {enumerable:true, configurable:true, get:()=>computeTeamReadiness},
  readinessTrendLine: {enumerable:true, configurable:true, get:()=>readinessTrendLine},
  PR_METRICS: {enumerable:true, configurable:true, get:()=>PR_METRICS},
  prHardOk: {enumerable:true, configurable:true, get:()=>prHardOk},
  computeReadinessPRs: {enumerable:true, configurable:true, get:()=>computeReadinessPRs}
});
}
