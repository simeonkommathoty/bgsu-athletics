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
   READINESS HUB — Session-based daily monitoring
═══════════════════════════════════════════════════════════════ */
// Reference: originals/volleyball.html:5275
let SESSIONS = [];

// % — anything beyond this absolute value gets a flag
// Reference: originals/volleyball.html:5302
async function loadAllSessions(){
  if(!context.api.sb||!context.api.currentUser) return;
  try{
    // Supabase returns at most 1000 rows per request, silently. The table is now
    // ~3000 rows, so a single query only returned the newest ~1000 and cut off
    // everything before mid-Aug 2026 (breaking PRs and long-term history). Page
    // through the whole table instead.
    const PAGE=1000; let all=[];
    for(let from=0;;from+=PAGE){
      const {data, error} = await context.api.sb.from('test_sessions').select('*')
        .order('test_date',{ascending:false}).order('id',{ascending:true})
        .range(from,from+PAGE-1);
      if(error) throw error;
      all=all.concat(data||[]);
      if(!data||data.length<PAGE) break;
    }
    // Sessions without a valid test_date cannot be placed in time, so they are excluded from every
    // date-based view instead of being repaired or crashing the app. Never silent: warn and toast.
    SESSIONS = all.filter(s=>context.api.isValidTestDate(s.test_date));
    const skipped=all.length-SESSIONS.length;
    if(skipped){
      console.warn(`Skipped ${skipped} session(s) with a missing or invalid test_date:`,all.filter(s=>!context.api.isValidTestDate(s.test_date)).map(s=>s.id));
      context.api.toast?.(`⚠ ${skipped} session${skipped===1?'':'s'} with an invalid date ${skipped===1?'was':'were'} skipped`);
    }
  } catch(e){
    console.error('Load sessions failed:',e);
    SESSIONS = [];
  }
}


// Reference: originals/volleyball.html:5359
function isValdSession(s){return s.test_type==='vald_forcedecks'||(!s.test_type&&(s.power!=null||s.mrsi!=null||s.takeoff_velocity!=null||s.concentric_impulse!=null));}

return Object.defineProperties({}, {
  SESSIONS: {enumerable:true, configurable:true, get:()=>SESSIONS, set:value=>{SESSIONS=value;}},
  loadAllSessions: {enumerable:true, configurable:true, get:()=>loadAllSessions},
  isValdSession: {enumerable:true, configurable:true, get:()=>isValdSession}
});
}
