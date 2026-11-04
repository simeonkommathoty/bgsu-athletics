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
/* ═══════════════════════════════════════════════════════════════
   DATA MODEL — BGSU HOCKEY
═══════════════════════════════════════════════════════════════ */
// Reference: originals/hockey.html:1186
const POSITIONS = ['F','D','G'];


// Reference: originals/hockey.html:1187
const CLASS_YEARS = ['Fr','So','Jr','Sr','5Y'];


// Reference: originals/hockey.html:1188
const POS_FULL = {F:'Forward',D:'Defense',G:'Goalie'};


// Reference: originals/hockey.html:1189
const TIERS = ['Elite','Advanced','Proficient','Developing'];


// Reference: originals/hockey.html:1190
const TIER_CLASS_MAP = {Elite:'t-E',Advanced:'t-A',Proficient:'t-P',Developing:'t-D'};


// Reference: originals/hockey.html:1191
const TIER_COLORS = {Elite:'#FCD34D',Advanced:'#FE5000',Proficient:'#60A5FA',Developing:'#6A5646'};


// Reference: originals/hockey.html:1192
const TEST_BLOCKS = ['Aug Pre','Sep Early','Oct Mid','Nov Late','Jan Pre','Mar End'];

// Position-specific norms. Ranges for the 7 fall 2025 hockey testing metrics are
// derived from the actual roster's 10th-90th percentile spread (28 athletes) and
// applied across F/D/G since testing wasn't split by position — tighten these
// per-position once enough data exists to split them out.
// NOTE ON KEY NAMES: to minimize changes to the underlying app, this hockey build
// reuses several metric keys/fields from the original template with NEW meanings:
//   approachJump -> Broad Jump (in, ft/in display)      cmjHeight -> Vertical Jump (in)
//   standVert    -> Goal to Blue (sec, on-ice sprint)    sprint10  -> 10-Yd Sprint (sec, unchanged)
//   frontSquatMax-> Front Squat (Est 1RM, lbs, unchanged)
//   ngChinUp     -> NG Chin Up (Est 1RM, lbs, fall testing)
//   onIceBeep    -> On-Ice Beep (score, e.g. "8+3" stored as 8.3, fall testing)
//   benchMax     -> Bench Press (Est 1RM, lbs) — REAL meaning restored; tracked via Teambuildr
//   hangCleanMax -> Hang Clean (Est 1RM, lbs) — REAL meaning restored; tracked via Teambuildr
// benchMax/hangCleanMax norms below are placeholder estimates (no historical
// team data yet) — tighten once real Teambuildr numbers come in.
// VALD force-plate keys (peakPower, rsi, asymmetry, eccRFD, etc.) are untouched —
// generic biomechanics metrics, ready to use if/when force-plate testing starts.
// Reference: originals/hockey.html:1211
const NORMS = {
  F: {approachJump:[96,111],cmjHeight:[24.5,33.5],standVert:[2.86,3.13],sprint10:[1.36,1.48],peakPower:[2200,4400],rsi:[0.28,0.55],asymmetry:[2,14],eccRFD:[2200,4200],concImpulse:[160,240],eccImpulse:[140,220],contractionTime:[600,780],jumpVol:[80,180],avgJumpHt:[130,175],playerLoad:[0.7,1.5],acuteLoad:[70,160],chronicLoad:[70,150],frontSquatMax:[255,327],ngChinUp:[61,101],onIceBeep:[5.5,7.7],benchMax:[135,225],hangCleanMax:[135,205]},
  D: {approachJump:[96,111],cmjHeight:[24.5,33.5],standVert:[2.86,3.13],sprint10:[1.36,1.48],peakPower:[2200,4400],rsi:[0.28,0.55],asymmetry:[2,14],eccRFD:[2200,4200],concImpulse:[160,240],eccImpulse:[140,220],contractionTime:[600,780],jumpVol:[80,180],avgJumpHt:[130,175],playerLoad:[0.7,1.5],acuteLoad:[70,160],chronicLoad:[70,150],frontSquatMax:[255,327],ngChinUp:[61,101],onIceBeep:[5.5,7.7],benchMax:[135,225],hangCleanMax:[135,205]},
  G: {approachJump:[90,105],cmjHeight:[22,30],standVert:[2.90,3.18],sprint10:[1.40,1.52],peakPower:[2000,4000],rsi:[0.26,0.50],asymmetry:[2,14],eccRFD:[2000,3900],concImpulse:[150,225],eccImpulse:[130,205],contractionTime:[610,790],jumpVol:[70,160],avgJumpHt:[125,168],playerLoad:[0.6,1.3],acuteLoad:[60,145],chronicLoad:[60,135],frontSquatMax:[220,300],ngChinUp:[55,92],onIceBeep:[5.0,7.2],benchMax:[115,195],hangCleanMax:[115,175]},
};


// Reference: originals/hockey.html:1217
const ALL_METRICS = [
  // On-ice / off-ice testing
  {key:'approachJump',  label:'Broad Jump',           unit:"",   max:130, hb:true,  fmt:v=>context.api.inToFtIn(v), color:'#FE5000',   group:'jump'},
  {key:'cmjHeight',     label:'Vertical Jump',        unit:'in',  max:38,  hb:true,  fmt:v=>v.toFixed(1), color:'#FCD34D',   group:'jump'},
  {key:'standVert',     label:'Goal to Blue',         unit:'s',   max:3.5, hb:false, fmt:v=>v.toFixed(2), color:'#FB923C',   group:'speed'},
  {key:'sprint10',      label:'10-yd Sprint',         unit:'s',   max:2.0, hb:false, fmt:v=>v.toFixed(2), color:'#a78bfa',   group:'speed'},
  {key:'frontSquatMax', label:'Front Squat (1RM)',    unit:'lbs', max:400, hb:true,  fmt:v=>Math.round(v),color:'#34D399',   group:'strength'},
  {key:'ngChinUp',       label:'NG Chin Up (1RM)',     unit:'lbs', max:150, hb:true,  fmt:v=>Math.round(v),color:'#34D399',   group:'strength'},
  {key:'onIceBeep',      label:'On-Ice Beep',          unit:'',    max:10,  hb:true,  fmt:v=>v.toFixed(1), color:'#34D399',   group:'strength'},
  {key:'benchMax',      label:'Bench Press (1RM)',    unit:'lbs', max:350, hb:true,  fmt:v=>Math.round(v),color:'#22C55E',   group:'teambuildr'},
  {key:'hangCleanMax',  label:'Hang Clean (1RM)',     unit:'lbs', max:250, hb:true,  fmt:v=>Math.round(v),color:'#22C55E',   group:'teambuildr'},
  // VALD Force Plate
  {key:'peakPower',     label:'Peak Power',           unit:'W',   max:5500,hb:true,  fmt:v=>Math.round(v), color:'#60A5FA',   group:'vald'},
  {key:'rsi',           label:'RSI-Modified',         unit:'',    max:0.65,hb:true,  fmt:v=>v.toFixed(3), color:'#4ADE80',   group:'vald'},
  {key:'asymmetry',     label:'Limb Asymmetry',       unit:'%',   max:20,  hb:false, fmt:v=>v.toFixed(1), color:'#F87171',   group:'vald'},
  {key:'eccRFD',        label:'Eccentric RFD',        unit:'N/s', max:4800,hb:true,  fmt:v=>Math.round(v),color:'#CDA077',   group:'vald'},
  {key:'concImpulse',   label:'Concentric Impulse',   unit:'N·s', max:260, hb:true,  fmt:v=>Math.round(v),color:'#38BDF8',   group:'vald'},
  {key:'eccImpulse',    label:'Eccentric Impulse',    unit:'N·s', max:240, hb:true,  fmt:v=>Math.round(v),color:'#A78BFA',   group:'vald'},
  {key:'contractionTime',label:'Contraction Time',    unit:'ms',  max:820, hb:false, fmt:v=>Math.round(v),color:'#94A3B8',   group:'vald'},
  {key:'takeoffVelocity',label:'Takeoff Velocity',    unit:'m/s', max:4.5, hb:true,  fmt:v=>v.toFixed(2), color:'#F472B6',   group:'vald'},
  {key:'concImpulseAsym',label:'Conc Impulse Asym',   unit:'%',   max:20,  hb:false, fmt:v=>v.toFixed(1), color:'#FCA5A5',   group:'vald'},
  {key:'eccBrakingAsym', label:'Ecc Braking Asym',    unit:'%',   max:20,  hb:false, fmt:v=>v.toFixed(1), color:'#FBBF24',   group:'vald'},
  // Firstbeat HR / Workload
  {key:'jumpVol',       label:'TRIMP Total',          unit:'',    max:220, hb:true,  fmt:v=>Math.round(v),color:'#FE5000',   group:'firstbeat'},
  {key:'avgJumpHt',     label:'Avg HR',               unit:'bpm', max:210, hb:true,  fmt:v=>Math.round(v),color:'#FCD34D',   group:'firstbeat'},
  {key:'playerLoad',    label:'Efficiency Score',     unit:'',    max:2.0, hb:true,  fmt:v=>v.toFixed(2), color:'#60A5FA',   group:'firstbeat'},
  {key:'acuteLoad',     label:'Acute TRIMP (7d)',     unit:'',    max:200, hb:true,  fmt:v=>Math.round(v),color:'#4ADE80',   group:'firstbeat'},
  {key:'chronicLoad',   label:'Chronic TRIMP (28d)',  unit:'',    max:190, hb:true,  fmt:v=>Math.round(v),color:'#A78BFA',   group:'firstbeat'},
  {key:'acwr',          label:'AC:WR Ratio',          unit:'',    max:2.0, hb:false, fmt:v=>v.toFixed(2), color:'#F87171',   group:'firstbeat'},
  // Composite
  {key:'composite',     label:'Composite Score',      unit:'',    max:100, hb:true,  fmt:v=>String(v),    color:'#FE5000',   group:'score'},
];


// Reference: originals/hockey.html:1250
function rnd(a,b){return Math.round(Math.random()*(b-a)+a);}


// Reference: originals/hockey.html:1251
function rndf(a,b,d=1){return parseFloat((Math.random()*(b-a)+a).toFixed(d));}


// Reference: originals/hockey.html:1252
function avCls(i){return ['a0','a1','a2','a3','a4','a5'][i%6];}


// Reference: originals/hockey.html:1254
const NAMES = [];

// Sample data removed — all athletes load from Supabase
// Reference: originals/hockey.html:1256
const APPROACH_JUMP_FRESHNESS_MONTHS = 6;

// An athlete's approach jump only "counts" (for display, ranking, and the
// composite score) if it was set within the last N months. If there's no
// recorded date at all (older/manual entries, imported before date-tracking
// existed), it's treated as current rather than hidden — per team decision,
// since we can't actually tell how old it is.
// Reference: originals/hockey.html:1262
function isApproachJumpFresh(a){
  // Broad Jump has no staleness window for hockey — always "fresh" if a value exists.
  return a.approachJump!=null;
}

// Precomputed per-athlete display value: the approach jump number to actually
// show/rank/score with, or null if it's aged out. Call refreshApproachJumpFreshness()
// after any data change so this stays in sync — cheap, safe to call often.
// Reference: originals/hockey.html:1269
function refreshApproachJumpFreshness(){
  for(const a of context.api.ATHLETES){
    const fresh=isApproachJumpFresh(a);
    a._approachJumpFresh = fresh ? a.approachJump : null;
    a._approachJumpStale = a.approachJump!=null && !fresh; // has a value, but it's too old to show
  }
}

// ── Composite score: fixed standards ──────────────────────────────
// Each metric is graded against the fixed ranges in NORMS.F (team-wide, not by
// position): 0 at the low end, 100 at the high end, reversed for times. These
// are the same standards the dashboard's original scores were built on.
// Because the ranges never move, a player's score only changes when his own
// numbers change: it never depends on teammates or on when the page loaded.
// Goal to Blue is skaters only; metrics with no data are skipped.
// Reference: originals/hockey.html:1284
const COMPOSITE_NORMS = NORMS.F;


// Reference: originals/hockey.html:1285
const COMPOSITE_EXCLUDE = ['asymmetry','concImpulseAsym','rsi'];


// Reference: originals/hockey.html:1286
function getTeamNormRange(metricKey){ return COMPOSITE_NORMS[metricKey]||null; }

// ── Rapid-drop check ─────────────────────────────────────────────
// The standards above put most of the roster at the top of the power and bench
// ranges, and tested metrics keep each player's best result, so on their own
// they can't show a decline. So each category is also checked against the
// player's OWN Fall 2026 number. Inside normal variation nothing changes; past
// DROP_START that category's credit shrinks, reaching zero at DROP_FULL.
//  - Peak power is NOT checked: the composite uses each player's best force
//    plate result of the academic year, so in-season testing can't hurt it.
//  - Tested metrics: his most recent retest vs his best Aug-Sep 2026 result
//    (nothing happens until there is a retest after September).
// Reference: originals/hockey.html:1298
const FALL_BASELINE_FROM = '2026-08-01';


// Reference: originals/hockey.html:1299
const FALL_BASELINE_TO   = '2026-09-30';


// Reference: originals/hockey.html:1300
const DROP_RULES = {
  // [drop where credit starts shrinking, drop where the category is lost]
  default:  [0.05, 0.15],  // 5% worse -> starts; 15% worse -> zero credit
  sprint10: [0.02, 0.06],  // times: 2% slower -> starts; 6% slower -> zero
  standVert:[0.02, 0.06],
};


// Reference: originals/hockey.html:1306
function compositeDropFor(a, key, m){
  try{
    const name=a._canonicalName||a.name;
    let base=null, latest=null, latestDate=null;
    if(key==='peakPower'){
      return null; // force plate never lowers the composite (best of the academic year is used)
      if(typeof context.api.sessionsForAthlete!=='function') return null;
      const rows=context.api.sessionsForAthlete(name)
        .filter(s=>s.peak_power!=null&&!isNaN(s.peak_power)&&s.peak_power>=800&&s.peak_power<=7500)
        .sort((x,y)=>y.test_date.localeCompare(x.test_date));
      const fall=rows.filter(s=>s.test_date>='2026-09-01'&&s.test_date<=FALL_BASELINE_TO);
      const last3=rows.slice(0,3);
      if(!fall.length||last3.length<3||last3[last3.length-1].test_date<=FALL_BASELINE_TO) return null;
      const fv=fall.map(r=>r.peak_power).sort((x,y)=>x-y), mid=Math.floor(fv.length/2);
      base=fv.length%2?fv[mid]:(fv[mid-1]+fv[mid])/2; // September MEDIAN: one bad or junk test can't skew it
      latest=last3.reduce((s,r)=>s+r.peak_power,0)/3;
      latestDate=last3[0].test_date;
    } else {
      if(typeof context.api.histFor!=='function'||typeof context.api.KPI_HISTORY==='undefined'||!context.api.KPI_HISTORY.length) return null;
      const hist=context.api.histFor(a,key).filter(r=>r.value!=null&&!isNaN(r.value));
      if(!hist.length) return null;
      const fall=hist.filter(r=>r.test_date>=FALL_BASELINE_FROM&&r.test_date<=FALL_BASELINE_TO);
      const after=hist.filter(r=>r.test_date>FALL_BASELINE_TO).sort((x,y)=>y.test_date.localeCompare(x.test_date));
      if(!fall.length||!after.length) return null;
      base=fall.reduce((b,r)=>m.hb?Math.max(b,r.value):Math.min(b,r.value), m.hb?-Infinity:Infinity);
      latest=after[0].value; latestDate=after[0].test_date;
    }
    if(!(base>0)) return null;
    const drop=m.hb?(base-latest)/base:(latest-base)/base; // positive = worse
    const [start,full]=DROP_RULES[key]||DROP_RULES.default;
    const factor=1-Math.max(0,Math.min(1,(drop-start)/(full-start)));
    return {factor, drop, base, latest, latestDate};
  }catch(e){ return null; }
}


// Reference: originals/hockey.html:1341
function calcCompositeVB(a){
  const scores=[];
  const drops=[];
  const mets=ALL_METRICS.filter(m=>m.group!=='score'&&m.group!=='firstbeat'&&!COMPOSITE_EXCLUDE.includes(m.key)
    &&!(a.pos==='G'&&m.key==='standVert'));
  for(const m of mets){
    const range=COMPOSITE_NORMS[m.key]; if(!range) continue;
    const v=a[m.key];
    if(v===null||v===undefined||isNaN(v)) continue;
    const [lo,hi]=range;
    if(hi===lo) continue;
    let s=Math.max(0,Math.min(1,m.hb?(v-lo)/(hi-lo):(1-(v-lo)/(hi-lo))));
    const d=compositeDropFor(a,m.key,m);
    if(d&&d.factor<1){
      const before=s; s*=d.factor;
      drops.push({key:m.key,label:m.label,pct:d.drop*100,lost:before-s});
    }
    scores.push(s);
  }
  a._compositeDrops=drops;
  if(!scores.length) return 0;
  return Math.round(scores.reduce((x,y)=>x+y,0)/scores.length*100);
}

// Re-score everyone. Call AFTER all data is merged (session power, best
// recent values) so the score always reflects what the dashboard shows.
// Reference: originals/hockey.html:1366
function rescoreAllAthletes(){
  for(const a of context.api.ATHLETES){
    a.composite=calcCompositeVB(a);
    a.tier=calcTier(a.composite);
    if(Array.isArray(a.trend)&&a.trend.length) a.trend[a.trend.length-1]=a.composite;
  }
}


// Reference: originals/hockey.html:1373
function calcACWR(a){return parseFloat((a.acuteLoad/Math.max(a.chronicLoad,1)).toFixed(2));}


// Reference: originals/hockey.html:1374
function calcTier(s){return s>=80?'Elite':s>=63?'Advanced':s>=45?'Proficient':'Developing';}


// Reference: originals/hockey.html:1375
function acwrZone(v){return v>1.5?'red':v>1.3?'amber':v<0.8?'blue':'green';}

return Object.defineProperties({}, {
  POSITIONS: {enumerable:true, configurable:true, get:()=>POSITIONS},
  CLASS_YEARS: {enumerable:true, configurable:true, get:()=>CLASS_YEARS},
  POS_FULL: {enumerable:true, configurable:true, get:()=>POS_FULL},
  TIERS: {enumerable:true, configurable:true, get:()=>TIERS},
  TIER_CLASS_MAP: {enumerable:true, configurable:true, get:()=>TIER_CLASS_MAP},
  TIER_COLORS: {enumerable:true, configurable:true, get:()=>TIER_COLORS},
  TEST_BLOCKS: {enumerable:true, configurable:true, get:()=>TEST_BLOCKS},
  NORMS: {enumerable:true, configurable:true, get:()=>NORMS},
  ALL_METRICS: {enumerable:true, configurable:true, get:()=>ALL_METRICS},
  rnd: {enumerable:true, configurable:true, get:()=>rnd},
  rndf: {enumerable:true, configurable:true, get:()=>rndf},
  avCls: {enumerable:true, configurable:true, get:()=>avCls},
  NAMES: {enumerable:true, configurable:true, get:()=>NAMES},
  APPROACH_JUMP_FRESHNESS_MONTHS: {enumerable:true, configurable:true, get:()=>APPROACH_JUMP_FRESHNESS_MONTHS},
  isApproachJumpFresh: {enumerable:true, configurable:true, get:()=>isApproachJumpFresh},
  refreshApproachJumpFreshness: {enumerable:true, configurable:true, get:()=>refreshApproachJumpFreshness},
  COMPOSITE_NORMS: {enumerable:true, configurable:true, get:()=>COMPOSITE_NORMS},
  COMPOSITE_EXCLUDE: {enumerable:true, configurable:true, get:()=>COMPOSITE_EXCLUDE},
  getTeamNormRange: {enumerable:true, configurable:true, get:()=>getTeamNormRange},
  FALL_BASELINE_FROM: {enumerable:true, configurable:true, get:()=>FALL_BASELINE_FROM},
  FALL_BASELINE_TO: {enumerable:true, configurable:true, get:()=>FALL_BASELINE_TO},
  DROP_RULES: {enumerable:true, configurable:true, get:()=>DROP_RULES},
  compositeDropFor: {enumerable:true, configurable:true, get:()=>compositeDropFor},
  calcCompositeVB: {enumerable:true, configurable:true, get:()=>calcCompositeVB},
  rescoreAllAthletes: {enumerable:true, configurable:true, get:()=>rescoreAllAthletes},
  calcACWR: {enumerable:true, configurable:true, get:()=>calcACWR},
  calcTier: {enumerable:true, configurable:true, get:()=>calcTier},
  acwrZone: {enumerable:true, configurable:true, get:()=>acwrZone}
});
}
