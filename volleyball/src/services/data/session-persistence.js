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

// ── Session import: called from import flow when test_date column detected ──
// Reference: originals/volleyball.html:5782
async function saveTestSessions(sessions){
  if(!context.api.sb||!context.api.currentUser){context.api.toast('⚠ Sign in to save sessions');return 0;}

  // Pre-aggregate: keep best rep per athlete per date (highest jump_height wins)
  const bestByKey={};
  for(const sess of sessions){
    const key=`${context.api.normName(sess.athlete_name)}|${sess.test_date}`;
    if(!bestByKey[key]){
      bestByKey[key]=sess;
    } else {
      // Keep the rep with the highest jump_height
      const cur=bestByKey[key];
      if((sess.jump_height||0) > (cur.jump_height||0)) bestByKey[key]=sess;
    }
  }
  const dedupedSessions=Object.values(bestByKey);

  let saved=0;
  for(const sess of dedupedSessions){
    try{
      const athlete=context.api.ATHLETES.find(a=>context.api.normName(a._canonicalName||a.name)===context.api.normName(sess.athlete_name));
      if(athlete&&athlete._dbId) sess.athlete_id=athlete._dbId;
      sess.created_by=context.api.currentUser.email;

      if(sess.athlete_id){
        // Matched to a real roster athlete — the DB's unique index on
        // (athlete_id, test_date) can safely dedupe this via upsert.
        const {error}=await context.api.sb.from('test_sessions').upsert(sess,{onConflict:'athlete_id,test_date'});
        if(!error) saved++;
      } else {
        // NOT matched to any roster athlete (typo, or a real person not yet
        // added to the roster). athlete_id is null here — and a unique index
        // can never treat two nulls as conflicting, so a plain upsert would
        // insert a brand-new duplicate row every single time this same
        // person's data gets re-imported, forever. Explicitly find and
        // replace any existing row for this exact name+date instead.
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
      }
    } catch(e){console.warn('Session save failed:',sess.athlete_name,e);}
  }
  await context.api.loadAllSessions();
  return saved;
}

return Object.defineProperties({}, {
  saveTestSessions: {enumerable:true, configurable:true, get:()=>saveTestSessions}
});
}
