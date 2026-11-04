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
   ROSTER SETUP
═══════════════════════════════════════════════════════════════ */

// Track in-progress position changes before saving
// Reference: originals/volleyball.html:1338
let rosterDraft = {};

// id → pos
// Reference: originals/volleyball.html:1339
let rosterFilter = 'all';


// Reference: originals/volleyball.html:1340
const POS_UNSET_SENTINEL = 'OH';


// Reference: originals/volleyball.html:1354
function setRosterFilter(f){
  rosterFilter=f;
  document.querySelectorAll('[id^="rf-"]').forEach(el=>el.classList.toggle('active',el.id==='rf-'+f));
  renderRosterGrid();
}


// Reference: originals/volleyball.html:1360
function initRoster(){
  rosterDraft={};
  renderRosterGrid();
  context.api.updateRosterBadge();
}


// Reference: originals/volleyball.html:1367
function renderRosterGrid(){
  // Archived filter: show archived athletes with restore option
  if(rosterFilter==='archived'){
    const archived=context.api.archivedAthletes();
    const banner=document.getElementById('roster-status-banner');
    banner.style.display='flex';banner.style.background='rgba(248,113,113,0.07)';banner.style.border='1px solid rgba(248,113,113,0.2)';
    banner.innerHTML=`<span style="font-size:18px;">🗄️</span><div><div style="color:var(--red);font-weight:500;">${archived.length} archived athlete${archived.length!==1?'s':''}</div><div style="color:var(--text3);margin-top:2px;">Hidden from all leaderboards and dashboards. Click Restore to bring them back.</div></div>`;
    document.getElementById('roster-save-status').textContent='';
    document.getElementById('roster-grid').innerHTML=archived.length?archived.map(a=>`
      <div style="background:var(--bg2);border:1px solid rgba(248,113,113,0.2);border-radius:var(--r2);padding:12px 14px;display:flex;align-items:center;gap:11px;min-height:64px;opacity:0.7;">
        <div style="flex-shrink:0;">${context.api.ava(a,'-lg')}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a._canonicalName||a.name}</div>
          <div style="font-size:9px;color:var(--text3);font-family:var(--fm);margin-top:2px;">${a.pos} · ${a.yr} · <span style="color:var(--red);">ARCHIVED</span></div>
        </div>
        <button data-onclick="restoreAthlete(${a.id})" style="flex-shrink:0;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.3);border-radius:var(--r);padding:6px 12px;color:var(--green);font-family:var(--fm);font-size:10px;cursor:pointer;letter-spacing:0.5px;">RESTORE</button>
      </div>`).join('')
      :`<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3);font-family:var(--fm);font-size:12px;">No archived athletes.</div>`;
    return;
  }

  let athletes=context.api.allAthletes();  // excludes archived
  if(rosterFilter==='unset') athletes=athletes.filter(a=>!context.api.posIsSet(a)||!a._nameLocked);
  else if(rosterFilter==='inactive') athletes=athletes.filter(a=>!context.api.isAthleteActive(a));
  else if(rosterFilter!=='all') athletes=athletes.filter(a=>a.pos===rosterFilter);

  const unset=context.api.unsetCount();
  const nameUnset=context.api.allAthletes().filter(a=>!a._nameLocked).length;
  const inactiveCount=context.api.allAthletes().filter(a=>!context.api.isAthleteActive(a)).length;
  const banner=document.getElementById('roster-status-banner');
  if(unset>0||nameUnset>0){
    const issues=[];
    if(nameUnset>0) issues.push(`${nameUnset} name${nameUnset!==1?'s':''} not confirmed`);
    if(unset>0) issues.push(`${unset} position${unset!==1?'s':''} unassigned`);
    banner.style.display='flex';banner.style.background='rgba(252,211,77,0.08)';banner.style.border='1px solid rgba(252,211,77,0.25)';
    banner.innerHTML=`<span style="font-size:18px;">⚠️</span><div><div style="color:var(--yellow);font-weight:500;">${issues.join(' · ')}</div><div style="color:var(--text3);margin-top:2px;">Confirm full name and set position for each athlete. Both lock permanently and survive future imports.</div></div>`;
  } else {
    banner.style.display='flex';banner.style.background='rgba(74,222,128,0.07)';banner.style.border='1px solid rgba(74,222,128,0.2)';
    const activeCount=context.api.rosterAthletes().length;
    banner.innerHTML=`<span style="font-size:18px;">✅</span><div style="color:var(--green);">${activeCount} active athlete${activeCount!==1?'s':''} on the active roster${inactiveCount>0?` · <span style="color:var(--text3);">${inactiveCount} inactive (no testing in last 6 months) — hidden from leaderboards</span>`:''}</div>`;
  }

  const pending=Object.keys(rosterDraft).length;
  document.getElementById('roster-save-status').textContent=pending>0?`${pending} unsaved change${pending!==1?'s':''}` : 'All changes saved';

  if(!athletes.length){
    document.getElementById('roster-grid').innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3);font-family:var(--fm);font-size:12px;">No athletes match this filter.</div>`;
    return;
  }

  const POS_COLORS_MAP={OH:'var(--orange)',MB:'var(--blue)',S:'var(--green)',RS:'var(--yellow)',OPP:'var(--purple)',Lib:'var(--tan)',DS:'var(--tan)'};

  document.getElementById('roster-grid').innerHTML=athletes.map(a=>{
    const draft=rosterDraft[a.id]||{};
    const currentPos=draft.pos!==undefined?draft.pos:a.pos;
    const currentName=draft.name!==undefined?draft.name:(a._canonicalName||a.name);
    const posLocked=context.api.posIsSet(a)&&draft.pos===undefined;
    const nameLocked=!!a._nameLocked&&draft.name===undefined;
    const inactive=!context.api.isAthleteActive(a);
    const changed=Object.keys(draft).length>0;
    const posColor=POS_COLORS_MAP[currentPos]||'var(--text2)';
    const borderColor=changed?'rgba(254,80,0,0.4)':(!posLocked||!nameLocked)?'rgba(252,211,77,0.3)':inactive?'rgba(120,120,120,0.25)':'var(--border)';
    const cardOpacity=inactive?'opacity:0.6;':'';

    return`<div style="background:var(--bg2);border:1px solid ${borderColor};border-radius:var(--r2);padding:12px 14px;display:flex;align-items:center;gap:11px;transition:border-color 0.15s;min-height:64px;${cardOpacity}" id="rcard-${a.id}">
      <div style="flex-shrink:0;">${context.api.ava(a,'-lg')}</div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:3px;">
        ${nameLocked
          ? `<div style="font-weight:600;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${currentName}${inactive?` <span style="font-size:9px;color:var(--text3);font-family:var(--fm);background:var(--bg4);padding:1px 6px;border-radius:3px;margin-left:4px;white-space:nowrap;">INACTIVE</span>`:` <span style="font-size:9px;color:var(--green);font-family:var(--fm);background:var(--green-dim);padding:1px 6px;border-radius:3px;margin-left:4px;white-space:nowrap;">locked</span>`}</div>`
          : `<input type="text" value="${currentName}" data-oninput="draftName(${a.id},this.value)" style="background:var(--bg4);border:1px solid rgba(252,211,77,0.35);border-radius:5px;padding:5px 9px;color:var(--text);font-family:var(--fb);font-size:13px;font-weight:500;width:100%;outline:none;box-sizing:border-box;" placeholder="Enter full name">`
        }
        <div style="font-size:9px;color:var(--text3);font-family:var(--fm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.yr} · as: <em>${a.name}</em>${a._sources?.length?` · ${a._sources[0].file.replace(/\.csv$/i,'')}`:''}</div>
      </div>
      <select data-onchange="draftPosition(${a.id},this.value)" style="flex-shrink:0;background:var(--bg4);border:1px solid ${draft.pos?'var(--orange)':posLocked?'var(--border2)':'rgba(252,211,77,0.3)'};border-radius:var(--r);padding:6px 8px;color:${posColor};font-family:var(--fh);font-size:14px;font-weight:700;letter-spacing:0.5px;width:74px;cursor:pointer;">
        ${context.api.POSITIONS.map(p=>`<option value="${p}" ${currentPos===p?'selected':''}>${p}</option>`).join('')}
      </select>
      <button data-onclick="openMergeModal(${a.id})" title="Merge into another athlete record" style="flex-shrink:0;background:none;border:1px solid var(--border);border-radius:var(--r);padding:6px 8px;color:var(--text3);font-family:var(--fm);font-size:10px;cursor:pointer;letter-spacing:0.5px;" data-onmouseover="this.style.borderColor='rgba(96,165,250,0.5)';this.style.color='var(--blue)'" data-onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text3)'">⇄</button>
      <button data-onclick="archiveAthlete(${a.id})" title="Archive athlete — removes from all leaderboards" style="flex-shrink:0;background:none;border:1px solid var(--border);border-radius:var(--r);padding:6px 8px;color:var(--text3);font-family:var(--fm);font-size:10px;cursor:pointer;letter-spacing:0.5px;" data-onmouseover="this.style.borderColor='rgba(248,113,113,0.5)';this.style.color='var(--red)'" data-onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text3)'">🗄</button>
    </div>`;
  }).join('');
}


// Reference: originals/volleyball.html:1449
async function archiveAthlete(id){
  const a=context.api.ATHLETES.find(x=>x.id===id);
  if(!a) return;
  if(!confirm(`Archive ${a._canonicalName||a.name}?\n\nThey will be hidden from all leaderboards and dashboards. You can restore them from the Archived filter in Roster Setup.`)) return;
  a._archived=true;
  if(context.api.sb&&context.api.currentUser&&a._dbId){
    try{
      await context.api.sb.from('athletes').update({archived:true}).eq('id',a._dbId);
      context.api.toast(`🗄 ${a._canonicalName||a.name} archived`);
    } catch(e){context.api.toast('⚠ Archive failed: '+e.message);}
  }
  context.api.refreshAll();
  renderRosterGrid();
  context.api.updateRosterBadge();
}


// Reference: originals/volleyball.html:1465
async function restoreAthlete(id){
  const a=context.api.ATHLETES.find(x=>x.id===id);
  if(!a) return;
  a._archived=false;
  if(context.api.sb&&context.api.currentUser&&a._dbId){
    try{
      await context.api.sb.from('athletes').update({archived:false}).eq('id',a._dbId);
      context.api.toast(`✓ ${a._canonicalName||a.name} restored to active roster`);
    } catch(e){context.api.toast('⚠ Restore failed: '+e.message);}
  }
  context.api.refreshAll();
  renderRosterGrid();
  context.api.updateRosterBadge();
}

// ── Merge Duplicate Athlete ───────────────────────────────────────
// Folds a duplicate athlete record into another (canonical) one: any
// Kinexon/test_sessions rows saved under either of the duplicate's name
// spellings get reassigned to the canonical athlete's name, then the
// duplicate athlete record itself is deleted. Built after repeatedly
// needing to do this by hand via direct SQL for stray/typo'd roster entries.
// Reference: originals/volleyball.html:1486
let mergeSourceId=null;


// Reference: originals/volleyball.html:1488
function openMergeModal(id){
  const src=context.api.ATHLETES.find(x=>x.id===id);
  if(!src) return;
  mergeSourceId=id;
  document.getElementById('merge-source-label').textContent=src._canonicalName||src.name;
  document.getElementById('merge-source-sub').textContent=`${src.pos||'—'} · as: ${src.name}${src._canonicalName&&src._canonicalName!==src.name?` (canonical: ${src._canonicalName})`:''}`;

  // Candidates: every other non-archived athlete, sorted by name similarity
  // to the source so the most likely real duplicate target sorts first.
  const srcName=src._canonicalName||src.name;
  const candidates=context.api.allAthletes()
    .filter(a=>a.id!==id)
    .map(a=>({a,score:context.api.nameSimilarity(srcName,a._canonicalName||a.name)}))
    .sort((x,y)=>y.score-x.score);

  const sel=document.getElementById('merge-target-sel');
  if(!candidates.length){
    sel.innerHTML=`<option value="">No other athletes available</option>`;
  } else {
    sel.innerHTML=candidates.map(({a,score})=>
      `<option value="${a.id}">${a._canonicalName||a.name} — ${a.pos||'—'}${score>=0.5?' (likely match)':''}</option>`
    ).join('');
  }
  renderMergePreview();
  document.getElementById('merge-overlay').style.display='block';
  document.body.style.overflow='hidden';
}


// Reference: originals/volleyball.html:1516
function closeMergeModal(){
  document.getElementById('merge-overlay').style.display='none';
  document.body.style.overflow='';
  mergeSourceId=null;
}


// Reference: originals/volleyball.html:1521
document.getElementById('merge-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('merge-overlay'))closeMergeModal();});


// Reference: originals/volleyball.html:1523
function renderMergePreview(){
  const src=context.api.ATHLETES.find(x=>x.id===mergeSourceId);
  const targetId=parseInt(document.getElementById('merge-target-sel').value);
  const tgt=context.api.ATHLETES.find(x=>x.id===targetId);
  const preview=document.getElementById('merge-preview');
  if(!src||!tgt){preview.innerHTML='Select a target athlete above.';return;}
  const variants=[...new Set([src.name,src._canonicalName].filter(Boolean))];
  preview.innerHTML=`Any Kinexon sessions saved as <b>${variants.map(v=>`"${v}"`).join(' or ')}</b> will be reassigned to `+
    `<b>"${tgt._canonicalName||tgt.name}"</b>. The duplicate record for <b>${src._canonicalName||src.name}</b> will then be permanently deleted.`+
    `<div style="margin-top:6px;color:var(--yellow);">This cannot be undone.</div>`;
}


// Reference: originals/volleyball.html:1535
async function doMergeAthletes(){
  const src=context.api.ATHLETES.find(x=>x.id===mergeSourceId);
  const targetId=parseInt(document.getElementById('merge-target-sel').value);
  const tgt=context.api.ATHLETES.find(x=>x.id===targetId);
  if(!src||!tgt){context.api.toast('⚠ Choose a target athlete first.');return;}
  if(!confirm(`Merge "${src._canonicalName||src.name}" into "${tgt._canonicalName||tgt.name}"?\n\nThis will move any Kinexon session data over and permanently delete the duplicate record. This cannot be undone.`)) return;

  const btn=document.getElementById('merge-confirm-btn');
  btn.disabled=true;btn.style.opacity='0.5';btn.textContent='MERGING…';

  const targetName=tgt._canonicalName||tgt.name;
  const variants=[...new Set([src.name,src._canonicalName].filter(Boolean))];
  let movedSessions=0;

  try{
    if(context.api.sb&&context.api.currentUser){
      for(const variant of variants){
        if(variant===targetName) continue;
        const {data,error}=await context.api.sb.from('test_sessions')
          .update({athlete_name:targetName})
          .eq('athlete_name',variant)
          .select();
        if(error){console.warn('Merge: session reassign failed for variant',variant,error.message);}
        else movedSessions+=(data?.length||0);
      }
      if(src._dbId){
        const {error:delErr}=await context.api.sb.from('athletes').delete().eq('id',src._dbId);
        if(delErr) throw new Error('Could not delete duplicate athlete record: '+delErr.message);
      }
    }
    context.api.ATHLETES=context.api.ATHLETES.filter(a=>a.id!==src.id);
    delete rosterDraft[src.id];
    await context.api.loadAllSessions(); // refresh cached sessions so reassigned rows show up immediately
    context.api.toast(`✓ Merged into ${targetName}${movedSessions?` · ${movedSessions} session${movedSessions!==1?'s':''} moved`:''}`);
    closeMergeModal();
    renderRosterGrid();
    context.api.updateRosterBadge();
  } catch(e){
    context.api.toast('⚠ Merge failed: '+e.message);
    console.error('Merge error:',e);
  } finally{
    btn.disabled=false;btn.style.opacity='1';btn.textContent='MERGE & DELETE DUPLICATE';
  }
}


// Reference: originals/volleyball.html:1580
function draftName(id, name){
  if(!rosterDraft[id]) rosterDraft[id]={};
  rosterDraft[id].name=name;
  const pending=Object.keys(rosterDraft).length;
  document.getElementById('roster-save-status').textContent=pending>0?`${pending} unsaved change${pending!==1?'s':''}` : 'All changes saved';
  // Update border live
  const card=document.getElementById('rcard-'+id);
  if(card) card.style.borderColor='rgba(254,80,0,0.4)';
}


// Reference: originals/volleyball.html:1590
function draftPosition(id, pos){
  const a=context.api.ATHLETES.find(x=>x.id===id);if(!a)return;
  if(!rosterDraft[id]) rosterDraft[id]={};
  if(pos===a.pos&&context.api.posIsSet(a)) delete rosterDraft[id].pos;
  else rosterDraft[id].pos=pos;
  if(!Object.keys(rosterDraft[id]).length) delete rosterDraft[id];
  const card=document.getElementById('rcard-'+id);
  if(card){const changed=rosterDraft[id]&&Object.keys(rosterDraft[id]).length;card.style.borderColor=changed?'rgba(254,80,0,0.4)':context.api.posIsSet(a)?'var(--border)':'rgba(252,211,77,0.25)';}
  const pending=Object.keys(rosterDraft).length;
  document.getElementById('roster-save-status').textContent=pending>0?`${pending} unsaved change${pending!==1?'s':''}` : 'All changes saved';
}


// Reference: originals/volleyball.html:1602
function saveAllPositions(){
  if(!Object.keys(rosterDraft).length){context.api.toast('All changes already saved');return;}
  let count=0;
  for(const [idStr, draft] of Object.entries(rosterDraft)){
    const id=parseInt(idStr);
    const idx=context.api.ATHLETES.findIndex(a=>a.id===id);
    if(idx<0) continue;
    const a=context.api.ATHLETES[idx];
    // Save name — lock it as canonical, update initials
    if(draft.name!==undefined&&draft.name.trim()){
      const fullName=draft.name.trim();
      a._canonicalName=fullName;
      a.name=fullName;
      a._nameLocked=true;
      const parts=fullName.split(' ');
      a.initials=(parts[0]?.[0]||'?')+(parts[parts.length-1]?.[0]||'');
    }
    // Save position
    if(draft.pos!==undefined){
      a.pos=draft.pos;
      a._posLocked=true;
      a.composite=context.api.calcCompositeVB(a);
      a.tier=context.api.calcTier(a.composite);
    }
    count++;
  }
  rosterDraft={};
  context.api.updateRosterBadge();
  context.api.refreshAll();
  renderRosterGrid();
  context.api.toast(`✓ ${count} athlete${count!==1?'s':''} saved`);
}

return Object.defineProperties({}, {
  rosterDraft: {enumerable:true, configurable:true, get:()=>rosterDraft, set:value=>{rosterDraft=value;}},
  rosterFilter: {enumerable:true, configurable:true, get:()=>rosterFilter, set:value=>{rosterFilter=value;}},
  POS_UNSET_SENTINEL: {enumerable:true, configurable:true, get:()=>POS_UNSET_SENTINEL},
  setRosterFilter: {enumerable:true, configurable:true, get:()=>setRosterFilter},
  initRoster: {enumerable:true, configurable:true, get:()=>initRoster},
  renderRosterGrid: {enumerable:true, configurable:true, get:()=>renderRosterGrid},
  archiveAthlete: {enumerable:true, configurable:true, get:()=>archiveAthlete},
  restoreAthlete: {enumerable:true, configurable:true, get:()=>restoreAthlete},
  mergeSourceId: {enumerable:true, configurable:true, get:()=>mergeSourceId, set:value=>{mergeSourceId=value;}},
  openMergeModal: {enumerable:true, configurable:true, get:()=>openMergeModal},
  closeMergeModal: {enumerable:true, configurable:true, get:()=>closeMergeModal},
  renderMergePreview: {enumerable:true, configurable:true, get:()=>renderMergePreview},
  doMergeAthletes: {enumerable:true, configurable:true, get:()=>doMergeAthletes},
  draftName: {enumerable:true, configurable:true, get:()=>draftName},
  draftPosition: {enumerable:true, configurable:true, get:()=>draftPosition},
  saveAllPositions: {enumerable:true, configurable:true, get:()=>saveAllPositions}
});
}
