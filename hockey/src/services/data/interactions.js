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
/* ─── Global Search ─── */
// Reference: originals/hockey.html:1475
function gsearchFn(q){
  const d=document.getElementById('sdrop');
  if(!q){d.style.display='none';return;}
  const r=context.api.rosterAthletes().filter(a=>(a._canonicalName||a.name).toLowerCase().includes(q.toLowerCase())||a.pos.toLowerCase().includes(q.toLowerCase()));
  if(!r.length){d.style.display='none';return;}
  d.innerHTML=r.slice(0,8).map(a=>`<div data-onclick="openAth(${a.id})" style="padding:9px 13px;cursor:pointer;display:flex;align-items:center;gap:9px;border-bottom:1px solid var(--border);" data-onmouseenter="this.style.background='var(--bg3)'" data-onmouseleave="this.style.background=''">${context.api.ava(a)}<div><div style="font-size:12px;">${a.name}</div><div style="font-size:9px;color:var(--text3);font-family:var(--fm);">${a.pos} · ${a.yr} · ${context.api.tierBadge(a.tier)}</div></div></div>`).join('');
  d.style.display='block';
}


// Reference: originals/hockey.html:1483
async function openAth(id){
  document.getElementById('sdrop').style.display='none';
  document.getElementById('gsearch').value='';
  if(await context.navigate('profile')) {
    document.getElementById('profile-sel').value=id;
    context.api.renderProfile();
  }
}

// Manual metric deletion — clears a single metric value from an athlete record
// Reference: originals/hockey.html:1486
async function clearMetric(athleteId, metricKey, label){
  const a=context.api.ATHLETES.find(x=>x.id===athleteId);
  if(!a) return;
  if(!confirm(`Clear ${label} for ${a._canonicalName||a.name}?\n\nThis removes the value from their record. You can re-import to restore it.`)) return;
  a[metricKey]=null;
  // Also clear from Supabase athlete record
  if(context.api.sb&&context.api.currentUser&&a._dbId){
    const dbCol=context.api.DB_FIELDS[metricKey];
    if(dbCol){
      try{
        await context.api.sb.from('athletes').update({[dbCol]:null}).eq('id',a._dbId);
        context.api.toast(`✓ Cleared ${label} for ${a._canonicalName||a.name}`);
      } catch(e){context.api.toast('⚠ Clear failed: '+e.message);}
    }
  }
  // Also clear from any test_sessions
  if(context.api.sb&&context.api.currentUser){
    const sessionCols={'peakPower':'peak_power','rsi':'rsi_mod','cmjHeight':'jump_height'};
    const sc=sessionCols[metricKey];
    if(sc){
      try{
        const nm=a._canonicalName||a.name;
        await context.api.sb.from('test_sessions').update({[sc]:null,power:sc==='peak_power'?null:undefined}).eq('athlete_name',nm);
      } catch(e){console.warn('Session clear failed:',e);}
    }
  }
  context.api.refreshAll();
  // Re-render current page
  const ap=document.querySelector('.page.active');
  if(ap) context.navigate(ap.id.replace('page-',''));
}


// Reference: originals/hockey.html:1517
document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap'))document.getElementById('sdrop').style.display='none';});


// Reference: originals/hockey.html:1538
function updateRosterBadge(){
  const n=context.api.unsetCount();
  const badge=document.getElementById('roster-badge');
  if(!badge) return;
  if(n>0){ badge.textContent=n; badge.style.display='inline'; }
  else { badge.style.display='none'; }
}

return Object.defineProperties({}, {
  gsearchFn: {enumerable:true, configurable:true, get:()=>gsearchFn},
  openAth: {enumerable:true, configurable:true, get:()=>openAth},
  clearMetric: {enumerable:true, configurable:true, get:()=>clearMetric},
  updateRosterBadge: {enumerable:true, configurable:true, get:()=>updateRosterBadge}
});
}
