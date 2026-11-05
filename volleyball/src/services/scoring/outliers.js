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
/* ─── OUTLIER DETECTION (force plate only) ─────────────────────
   A value is flagged as an outlier if:
   1. It's outside the hard sanity range for that metric, OR
   2. It's > 30% off the athlete's rolling average for that metric
      (requires 3+ historical sessions to be reliable; falls back to (1) only)
*/
// Reference: originals/volleyball.html:2158
const FP_METRIC_KEYS = ['asymmetry','ecc_rfd','concentric_impulse','conc_impulse','ecc_impulse','contraction_time','jump_height','takeoff_velocity',
  'eccRFD','concImpulse','eccImpulse','contractionTime','cmjHeight'];


// Reference: originals/volleyball.html:2161
const FP_HARD_RANGES = {
  peak_power:         [800, 6000],      // W — flag above 6000 as outlier, use next session
  peakPower:          [800, 6000],
  power:              [800, 6000],
  rsi_mod:            [0, 0.8],         // RSI above 0.8 is physiologically implausible
  mrsi:               [0, 0.8],
  rsi:                [0, 0.8],
  asymmetry:          [-50, 50],
  ecc_rfd:            [500, 10000],
  eccRFD:             [500, 10000],
  concentric_impulse: [50, 500],
  conc_impulse:       [50, 500],
  concImpulse:        [50, 500],
  ecc_impulse:        [40, 400],
  eccImpulse:         [40, 400],
  contraction_time:   [200, 1500],
  contractionTime:    [200, 1500],
  jump_height:        [5, 50],
  cmjHeight:          [5, 50],
  takeoff_velocity:   [1.0, 4.5],
};


// Reference: originals/volleyball.html:2183
const OUTLIER_PCT_THRESHOLD = 0.30;

// 30% off rolling average
// Reference: originals/volleyball.html:2184
const MIN_SESSIONS_FOR_ROLLING = 3;

// A usable test date is a real calendar date written YYYY-MM-DD (an ISO time suffix is tolerated),
// the format the database stores and the rest of the app compares as a string. null, missing,
// non-string, malformed (e.g. "not-a-date"), impossible (2026-02-30, 2026-13-45) and implausible
// (before 2000 / after 2100) values are rejected. Callers must NOT repair a rejected date.
function isValidTestDate(value){
  if(typeof value!=='string') return false;
  const m=/^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/.exec(value);
  if(!m) return false;
  const year=+m[1], month=+m[2], day=+m[3];
  if(year<2000||year>2100||month<1||month>12||day<1) return false;
  return day<=new Date(Date.UTC(year,month,0)).getUTCDate(); // days in that month
}

// Check if a single value is an outlier for a given metric on a given athlete
// Reference: originals/volleyball.html:2187
function isOutlier(metric, value, athleteName, refDate){
  if(value===null||value===undefined||isNaN(value)) return false;
  if(!FP_METRIC_KEYS.includes(metric)) return false;

  // Hard sanity check
  const range=FP_HARD_RANGES[metric];
  if(range && (value<range[0]||value>range[1])) return true;

  // Rolling average check — only if enough historical data.
  // IMPORTANT: this baseline is scoped to a recent window (60 days back from
  // refDate, or "all sessions" if no refDate given), not the athlete's
  // entire all-time history. Comparing against all-time was a real bug: a
  // batch of old corrupted values (e.g. from a since-fixed column-mapping
  // issue) would permanently drag the "expected" average down, so any
  // number of genuinely correct NEW values would keep getting flagged as
  // outliers forever, no matter how much new correct data came in.
  // A malformed refDate cannot define a 60-day window. Skip only the rolling check (the hard range
  // check above still applies) rather than guessing a date or throwing.
  if(refDate&&!isValidTestDate(refDate)) return false;
  const cutoff=refDate?new Date(new Date(refDate).getTime()-60*24*60*60*1000).toISOString().slice(0,10):null;
  const otherSessions=context.api.SESSIONS.filter(s=>
    context.api.normName(s.athlete_name)===context.api.normName(athleteName) &&
    s[metric]!==null && s[metric]!==undefined && !isNaN(s[metric]) &&
    (!cutoff || (isValidTestDate(s.test_date) && s.test_date>cutoff && (!refDate||s.test_date<=refDate)))
  );
  if(otherSessions.length>=MIN_SESSIONS_FOR_ROLLING){
    // Compute average of all OTHER sessions (excluding this value if it's in there)
    const avg=otherSessions.reduce((s,sess)=>s+sess[metric],0)/otherSessions.length;
    if(avg!==0 && Math.abs((value-avg)/avg)>OUTLIER_PCT_THRESHOLD) return true;
  }

  return false;
}

// Get a clean (non-outlier) value for a metric, or null if it's an outlier
// Reference: originals/volleyball.html:2219
function cleanValue(metric, value, athleteName){
  return isOutlier(metric, value, athleteName) ? null : value;
}

return Object.defineProperties({}, {
  isValidTestDate: {enumerable:true, configurable:true, get:()=>isValidTestDate},
  FP_METRIC_KEYS: {enumerable:true, configurable:true, get:()=>FP_METRIC_KEYS},
  FP_HARD_RANGES: {enumerable:true, configurable:true, get:()=>FP_HARD_RANGES},
  OUTLIER_PCT_THRESHOLD: {enumerable:true, configurable:true, get:()=>OUTLIER_PCT_THRESHOLD},
  MIN_SESSIONS_FOR_ROLLING: {enumerable:true, configurable:true, get:()=>MIN_SESSIONS_FOR_ROLLING},
  isOutlier: {enumerable:true, configurable:true, get:()=>isOutlier},
  cleanValue: {enumerable:true, configurable:true, get:()=>cleanValue}
});
}
