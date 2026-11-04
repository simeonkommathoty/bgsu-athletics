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
   DATA MODEL — BGSU VOLLEYBALL
═══════════════════════════════════════════════════════════════ */
// Reference: originals/volleyball.html:1083
const POSITIONS = ['OH','MB','S','RS','OPP','Lib','DS'];


// Reference: originals/volleyball.html:1084
const POS_FULL = {OH:'Outside Hitter',MB:'Middle Blocker',S:'Setter',RS:'Right Side',OPP:'Opposite',Lib:'Libero',DS:'Defensive Spec.'};


// Reference: originals/volleyball.html:1085
const TIERS = ['Elite','Advanced','Proficient','Developing'];


// Reference: originals/volleyball.html:1086
const TIER_CLASS_MAP = {Elite:'t-E',Advanced:'t-A',Proficient:'t-P',Developing:'t-D'};


// Reference: originals/volleyball.html:1087
const TIER_COLORS = {Elite:'#FCD34D',Advanced:'#FE5000',Proficient:'#60A5FA',Developing:'#6A5646'};


// Reference: originals/volleyball.html:1088
const TEST_BLOCKS = ['Aug Pre','Sep Early','Oct Mid','Nov Late','Jan Pre','Mar End'];

// Position-specific norms (D1 women's volleyball benchmarks)
// Reference: originals/volleyball.html:1091
const NORMS = {
  OH:  {approachJump:[110,126],cmjHeight:[19,28],standVert:[17,25],sprint10:[1.62,1.85],peakPower:[1800,3900],rsi:[0.28,0.55],asymmetry:[2,14],eccRFD:[2200,4200],concImpulse:[160,240],eccImpulse:[140,220],contractionTime:[600,780],jumpVol:[160,240],avgJumpHt:[15,22],playerLoad:[440,640],acuteLoad:[400,600],chronicLoad:[380,560],backSquatMax:[130,245],trapBarMax:[165,330],frontSquatMax:[100,200],benchMax:[85,155],hangCleanMax:[95,165]},
  MB:  {approachJump:[110,126],cmjHeight:[20,29],standVert:[18,26],sprint10:[1.64,1.88],peakPower:[1900,4000],rsi:[0.27,0.52],asymmetry:[2,13],eccRFD:[2300,4400],concImpulse:[165,245],eccImpulse:[145,225],contractionTime:[590,770],jumpVol:[180,270],avgJumpHt:[16,23],playerLoad:[460,660],acuteLoad:[420,620],chronicLoad:[390,570],backSquatMax:[140,260],trapBarMax:[175,350],frontSquatMax:[110,215],benchMax:[90,160],hangCleanMax:[100,175]},
  S:   {approachJump:[110,126],cmjHeight:[18,26],standVert:[16,24],sprint10:[1.60,1.82],peakPower:[1700,3700],rsi:[0.30,0.56],asymmetry:[2,12],eccRFD:[2100,4000],concImpulse:[155,235],eccImpulse:[135,215],contractionTime:[610,790],jumpVol:[200,300],avgJumpHt:[14,21],playerLoad:[480,680],acuteLoad:[440,640],chronicLoad:[400,580],backSquatMax:[120,230],trapBarMax:[150,310],frontSquatMax:[95,185],benchMax:[80,145],hangCleanMax:[88,155]},
  RS:  {approachJump:[110,126],cmjHeight:[19,28],standVert:[17,25],sprint10:[1.63,1.87],peakPower:[1800,3900],rsi:[0.28,0.53],asymmetry:[2,14],eccRFD:[2200,4200],concImpulse:[160,240],eccImpulse:[140,220],contractionTime:[600,780],jumpVol:[155,235],avgJumpHt:[15,22],playerLoad:[430,630],acuteLoad:[390,590],chronicLoad:[370,550],backSquatMax:[130,245],trapBarMax:[165,330],frontSquatMax:[100,200],benchMax:[85,155],hangCleanMax:[95,165]},
  OPP: {approachJump:[110,126],cmjHeight:[20,29],standVert:[18,26],sprint10:[1.62,1.86],peakPower:[1900,4000],rsi:[0.28,0.54],asymmetry:[2,13],eccRFD:[2250,4300],concImpulse:[162,242],eccImpulse:[142,222],contractionTime:[595,775],jumpVol:[150,230],avgJumpHt:[16,23],playerLoad:[420,620],acuteLoad:[380,580],chronicLoad:[360,540],backSquatMax:[135,252],trapBarMax:[170,340],frontSquatMax:[105,205],benchMax:[87,157],hangCleanMax:[97,168]},
  Lib: {cmjHeight:[15,22],standVert:[13,20],sprint10:[1.55,1.78],peakPower:[1500,3200],rsi:[0.32,0.58],asymmetry:[2,11],eccRFD:[1900,3700],concImpulse:[140,210],eccImpulse:[120,200],contractionTime:[580,760],jumpVol:[80,130],avgJumpHt:[12,18],playerLoad:[400,580],acuteLoad:[360,540],chronicLoad:[340,500],backSquatMax:[110,210],trapBarMax:[140,285],frontSquatMax:[85,170],benchMax:[75,135],hangCleanMax:[82,145]},
  DS:  {cmjHeight:[16,23],standVert:[14,21],sprint10:[1.56,1.79],peakPower:[1600,3300],rsi:[0.31,0.57],asymmetry:[2,12],eccRFD:[2000,3800],concImpulse:[145,215],eccImpulse:[125,205],contractionTime:[585,765],jumpVol:[85,135],avgJumpHt:[13,19],playerLoad:[410,590],acuteLoad:[370,550],chronicLoad:[345,505],backSquatMax:[112,215],trapBarMax:[142,290],frontSquatMax:[87,172],benchMax:[76,138],hangCleanMax:[83,147]},
};


// Reference: originals/volleyball.html:1101
const ALL_METRICS = [
  // Jump Testing
  {key:'approachJump',  label:'Approach Touch',      unit:"",   max:140, hb:true,  fmt:v=>context.api.inToFtIn(v), color:'#FE5000',   group:'jump'},
  {key:'cmjHeight',     label:'CMJ Height',           unit:'in',  max:32,  hb:true,  fmt:v=>v.toFixed(1), color:'#FCD34D',   group:'jump'},
  {key:'standVert',     label:'Standing Vertical',    unit:'in',  max:28,  hb:true,  fmt:v=>v.toFixed(1), color:'#FB923C',   group:'jump'},
  {key:'backSquatMax',  label:'Back Squat Max',       unit:'lbs', max:300, hb:true,  fmt:v=>Math.round(v),color:'#34D399',   group:'strength'},
  {key:'trapBarMax',    label:'Trap Bar DL Max',      unit:'lbs', max:400, hb:true,  fmt:v=>Math.round(v),color:'#34D399',   group:'strength'},
  {key:'frontSquatMax', label:'Front Squat Max',      unit:'lbs', max:250, hb:true,  fmt:v=>Math.round(v),color:'#34D399',   group:'strength'},
  {key:'benchMax',      label:'Bench Press Max',      unit:'lbs', max:200, hb:true,  fmt:v=>Math.round(v),color:'#34D399',   group:'strength'},
  {key:'hangCleanMax',  label:'Hang Clean Max',       unit:'lbs', max:200, hb:true,  fmt:v=>Math.round(v),color:'#34D399',   group:'strength'},
  {key:'sprint10',      label:'10-yd Sprint',         unit:'s',   max:2.0, hb:false, fmt:v=>v.toFixed(2), color:'#a78bfa',   group:'speed'},
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
  // Kinexon
  {key:'jumpVol',       label:'Jump Volume',          unit:'',    max:310, hb:true,  fmt:v=>Math.round(v),color:'#FE5000',   group:'kinexon'},
  {key:'avgJumpHt',     label:'Avg Jump Height',      unit:'in',  max:25,  hb:true,  fmt:v=>v.toFixed(1), color:'#FCD34D',   group:'kinexon'},
  {key:'playerLoad',    label:'Player Load',          unit:'AU',  max:700, hb:true,  fmt:v=>Math.round(v),color:'#60A5FA',   group:'kinexon'},
  {key:'acuteLoad',     label:'Acute Load (7d)',      unit:'AU',  max:660, hb:true,  fmt:v=>Math.round(v),color:'#4ADE80',   group:'kinexon'},
  {key:'chronicLoad',   label:'Chronic Load (28d)',   unit:'AU',  max:600, hb:true,  fmt:v=>Math.round(v),color:'#A78BFA',   group:'kinexon'},
  {key:'acwr',          label:'AC:WR Ratio',          unit:'',    max:2.0, hb:false, fmt:v=>v.toFixed(2), color:'#F87171',   group:'kinexon'},
  // Composite
  {key:'composite',     label:'Composite Score',      unit:'',    max:100, hb:true,  fmt:v=>String(v),    color:'#FE5000',   group:'score'},
];


// Reference: originals/volleyball.html:1134
function rnd(a,b){return Math.round(Math.random()*(b-a)+a);}


// Reference: originals/volleyball.html:1135
function rndf(a,b,d=1){return parseFloat((Math.random()*(b-a)+a).toFixed(d));}


// Reference: originals/volleyball.html:1136
function avCls(i){return ['a0','a1','a2','a3','a4','a5'][i%6];}


// Reference: originals/volleyball.html:1138
const NAMES = [];

// Sample data removed — all athletes load from Supabase
// Reference: originals/volleyball.html:1140
const APPROACH_JUMP_FRESHNESS_MONTHS = 6;

// An athlete's approach jump only "counts" (for display, ranking, and the
// composite score) if it was set within the last N months. If there's no
// recorded date at all (older/manual entries, imported before date-tracking
// existed), it's treated as current rather than hidden — per team decision,
// since we can't actually tell how old it is.
// Reference: originals/volleyball.html:1146
function isApproachJumpFresh(a){
  if(a.approachJump==null) return false;
  if(!a.approachJumpDate) return true;
  const cutoff=new Date(); cutoff.setMonth(cutoff.getMonth()-APPROACH_JUMP_FRESHNESS_MONTHS);
  const d=new Date(a.approachJumpDate+'T00:00:00');
  if(isNaN(d.getTime())) return true;
  return d>=cutoff;
}

// Precomputed per-athlete display value: the approach jump number to actually
// show/rank/score with, or null if it's aged out. Call refreshApproachJumpFreshness()
// after any data change so this stays in sync — cheap, safe to call often.
// Reference: originals/volleyball.html:1157
function refreshApproachJumpFreshness(){
  for(const a of context.api.ATHLETES){
    const fresh=isApproachJumpFresh(a);
    a._approachJumpFresh = fresh ? a.approachJump : null;
    a._approachJumpStale = a.approachJump!=null && !fresh; // has a value, but it's too old to show
  }
}


// Reference: originals/volleyball.html:1165
function calcCompositeVB(a){
  const scores=[];
  const mets=ALL_METRICS.filter(m=>m.group!=='score'&&m.group!=='kinexon'&&m.key!=='asymmetry'&&m.key!=='concImpulseAsym');
  for(const m of mets){
    // DS and Lib don't approach jump — skip it for their composite
    if(m.key==='approachJump'&&(a.pos==='DS'||a.pos==='Lib')) continue;
    const n=NORMS[a.pos];if(!n||!n[m.key])continue;
    // Approach jump only contributes to the score if it's within the freshness window
    const v = m.key==='approachJump' ? (isApproachJumpFresh(a)?a.approachJump:null) : a[m.key];
    if(v===null||v===undefined||isNaN(v)) continue;
    const [lo,hi]=n[m.key];
    if(hi===lo) continue;
    let s=m.hb?(v-lo)/(hi-lo):(1-(v-lo)/(hi-lo));
    scores.push(Math.max(0,Math.min(1,s)));
  }
  if(!scores.length) return 0;
  return Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*100);
}


// Reference: originals/volleyball.html:1183
function calcACWR(a){return parseFloat((a.acuteLoad/Math.max(a.chronicLoad,1)).toFixed(2));}


// Reference: originals/volleyball.html:1184
function calcTier(s){return s>=80?'Elite':s>=63?'Advanced':s>=45?'Proficient':'Developing';}


// Reference: originals/volleyball.html:1185
function acwrZone(v){return v>1.5?'red':v>1.3?'amber':v<0.8?'blue':'green';}

return Object.defineProperties({}, {
  POSITIONS: {enumerable:true, configurable:true, get:()=>POSITIONS},
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
  calcCompositeVB: {enumerable:true, configurable:true, get:()=>calcCompositeVB},
  calcACWR: {enumerable:true, configurable:true, get:()=>calcACWR},
  calcTier: {enumerable:true, configurable:true, get:()=>calcTier},
  acwrZone: {enumerable:true, configurable:true, get:()=>acwrZone}
});
}
