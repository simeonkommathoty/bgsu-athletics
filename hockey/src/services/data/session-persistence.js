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
// ── Session import: called from import flow when test_date column detected ──
// Save per-drill (Lap-row) TRIMP breakdown data to session_drills. Simple
// bulk insert in chunks — drills aren't deduplicated/upserted like the daily
// totals are, since re-importing the same date is rare enough that a plain
// "delete this date's drills, then insert fresh" is simplest and safest.
// Reference: originals/hockey.html:6765
async function saveSessionDrills(drills){
  if(!drills||!drills.length||!context.api.sb||!context.api.currentUser) return 0;
  // Re-resolve each drill's real Supabase athlete id by name at save time
  // (same pattern saveTestSessions uses) rather than trusting whatever local
  // in-memory id got attached during parsing, which is a different, unstable
  // identifier than the database's actual athletes.id foreign key.
  const resolved=drills.map(d=>{
    const athlete=context.api.ATHLETES.find(a=>context.api.normName(a._canonicalName||a.name)===context.api.normName(d.canonicalName||d.name));
    return athlete&&athlete._dbId ? {...d, dbAthleteId:athlete._dbId} : null;
  }).filter(Boolean);
  if(!resolved.length) return 0;

  const byKey={}; // dbAthleteId|date -> true, so we only delete-then-insert once per athlete/date
  for(const d of resolved){
    byKey[`${d.dbAthleteId}|${d.date}`]=true;
  }
  for(const key of Object.keys(byKey)){
    const [athleteId,date]=key.split('|');
    try{
      await context.api.sb.from('session_drills').delete().eq('athlete_id',athleteId).eq('test_date',date);
    }catch(e){console.warn('session_drills delete failed:',e.message);}
  }
  const rows=resolved.map(d=>({
    athlete_id:d.dbAthleteId, athlete_name:d.canonicalName,
    test_date:d.date, drill_name:d.drill_name,
    duration_min:d.duration_min, trimp:d.trimp, avg_hr:d.avg_hr,
    trimp_per_min:d.trimp_per_min, movement_load:d.movement_load,
  }));
  let saved=0;
  const CHUNK=200;
  for(let i=0;i<rows.length;i+=CHUNK){
    const chunk=rows.slice(i,i+CHUNK);
    try{
      const {error}=await context.api.sb.from('session_drills').insert(chunk);
      if(!error) saved+=chunk.length;
      else console.warn('session_drills insert failed:',error.message);
    }catch(e){console.warn('session_drills insert failed:',e.message);}
  }
  return saved;
}


// Reference: originals/hockey.html:6806
async function saveTestSessions(sessions, onProgress){
  if(!context.api.sb||!context.api.currentUser){context.api.toast('⚠ Sign in to save sessions');return 0;}

  // Two different kinds of "multiple rows for the same athlete+date" can show
  // up here, and they need OPPOSITE handling:
  //  - VALD jump-testing reps: multiple attempts on the same day — keep only
  //    the best one (highest jump_height), same as before.
  //  - Firstbeat sessions: a real team can log more than one distinct
  //    Measurement block on the same calendar day (e.g. a separate warmup/
  //    testing recording plus the main practice). These are NOT competing
  //    reps of the same thing — every one of them is real training that
  //    happened, so they must be SUMMED (TRIMP, duration) rather than have
  //    all but one silently discarded, which is what a "keep the best" rule
  //    would otherwise do here since jump_height is null for all of them.
  // Canonicalize names first: "Synthetic Skater"/"Synthetic Skater"/"Synthetic Skater" become the
  // roster spelling, and former players are never saved.
  sessions=sessions.filter(sess=>!context.api.isFormerPlayer(sess.athlete_name)).map(sess=>{
    const ath=context.api.ATHLETES.find(a=>context.api.athleteKey(a)===context.api.nameKey(sess.athlete_name));
    return ath?{...sess,athlete_name:ath._canonicalName||ath.name}:sess;
  });
  const bestByKey={};
  for(const sess of sessions){
    const key=`${context.api.normName(sess.athlete_name)}|${sess.test_date}`;
    const isFirstbeat = sess.trimp_total!=null && sess.jump_height==null;
    if(!bestByKey[key]){
      bestByKey[key]=sess;
    } else if(isFirstbeat){
      const cur=bestByKey[key];
      const curDur=cur.session_duration_min||0, newDur=sess.session_duration_min||0;
      const totalDur=curDur+newDur;
      const merged={...cur};
      merged.trimp_total = (cur.trimp_total||0) + (sess.trimp_total||0);
      merged.session_duration_min = totalDur||null;
      // Duration-weighted average HR, falling back to a plain average if
      // duration is missing on one side.
      merged.avg_hr = (cur.avg_hr!=null&&sess.avg_hr!=null)
        ? (totalDur>0
            ? parseFloat(((cur.avg_hr*curDur+sess.avg_hr*newDur)/totalDur).toFixed(1))
            : parseFloat(((cur.avg_hr+sess.avg_hr)/2).toFixed(1)))
        : (cur.avg_hr??sess.avg_hr??null);
      merged.trimp_per_min = totalDur>0 ? parseFloat((merged.trimp_total/totalDur).toFixed(2)) : (cur.trimp_per_min??sess.trimp_per_min??null);
      // Movement-load-derived efficiency doesn't carry a raw movement-load
      // total through to this point, so keep whichever session's own
      // efficiency score is higher-duration-weighted (best available proxy).
      merged.effic_score = newDur>curDur ? (sess.effic_score??cur.effic_score) : (cur.effic_score??sess.effic_score);
      // Acute/Chronic Training Load and ACWR are Firstbeat's own rolling
      // calculations over its full history — every same-day row reports
      // essentially the same value, so no summing needed; just keep either.
      merged.acute_load = cur.acute_load??sess.acute_load??null;
      merged.chronic_load = cur.chronic_load??sess.chronic_load??null;
      merged.acwr = cur.acwr??sess.acwr??null;
      merged.session_type = (cur.session_type&&sess.session_type&&cur.session_type!==sess.session_type)
        ? `${cur.session_type} + ${sess.session_type}` : (cur.session_type||sess.session_type||null);
      bestByKey[key]=merged;
    } else {
      // VALD jump-testing rep — keep the highest jump_height
      const cur=bestByKey[key];
      if((sess.jump_height||0) > (cur.jump_height||0)) bestByKey[key]=sess;
    }
  }
  const dedupedSessions=Object.values(bestByKey);

  // Split into matched (has a real athlete_id — safe to bulk-upsert) and
  // unmatched (name didn't resolve to a roster athlete — handled one at a
  // time below, since each needs its own duplicate-guard check).
  const matched=[], unmatched=[];
  for(const sess of dedupedSessions){
    const athlete=context.api.ATHLETES.find(a=>context.api.athleteKey(a)===context.api.nameKey(sess.athlete_name));
    if(athlete&&athlete._dbId){ sess.athlete_id=athlete._dbId; matched.push(sess); }
    else unmatched.push(sess);
  }

  let saved=0;
  let firstError=null;
  const total=matched.length+unmatched.length;
  let done=0;

  // Bulk-upsert matched sessions in chunks — this is the path almost all
  // rows take once names are cleaned up, and it's what makes a 1000+ row
  // import take seconds instead of minutes.
  const CHUNK=200;
  for(let i=0;i<matched.length;i+=CHUNK){
    const chunk=matched.slice(i,i+CHUNK).map(s=>({...s, created_by:context.api.currentUser.email}));
    try{
      const {error}=await context.api.sb.from('test_sessions').upsert(chunk,{onConflict:'athlete_id,test_date'});
      if(!error) saved+=chunk.length;
      else { console.warn('Chunk upsert failed:',error); if(!firstError) firstError=error.message||String(error); }
    } catch(e){ console.warn('Chunk upsert failed:',e); if(!firstError) firstError=e.message||String(e); }
    done+=chunk.length;
    if(onProgress) onProgress(done,total);
  }

  // Unmatched sessions (name never resolved to a roster athlete) — handled
  // one at a time since each needs its own find-and-replace-by-name check
  // to avoid piling up duplicate rows on repeat imports.
  for(const sess of unmatched){
    try{
      sess.created_by=context.api.currentUser.email;
      const {data:existing}=await context.api.sb.from('test_sessions')
        .select('id')
        .eq('athlete_name', sess.athlete_name)
        .eq('test_date', sess.test_date)
        .is('athlete_id', null);
      if(existing&&existing.length){
        await context.api.sb.from('test_sessions').delete().in('id', existing.map(r=>r.id));
      }
      const {error}=await context.api.sb.from('test_sessions').insert(sess);
      if(!error) saved++;
      else if(!firstError) firstError=error.message||String(error);
    } catch(e){ console.warn('Session save failed:',sess.athlete_name,e); if(!firstError) firstError=e.message||String(e); }
    done++;
    if(onProgress) onProgress(done,total);
  }

  await context.api.loadAllSessions();
  return {saved, total, firstError};
}

return Object.defineProperties({}, {
  saveSessionDrills: {enumerable:true, configurable:true, get:()=>saveSessionDrills},
  saveTestSessions: {enumerable:true, configurable:true, get:()=>saveTestSessions}
});
}
