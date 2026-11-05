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
   IMPORT SYSTEM
═══════════════════════════════════════════════════════════════ */
// Reference: originals/volleyball.html:3165
let importSrc='custom';


// Reference: originals/volleyball.html:3166
let pasteSrc2='custom';


// Reference: originals/volleyball.html:3167
let parsedData=null;


// Reference: originals/volleyball.html:3168
let kinexonCommitLock=false;

// guards against double-click / double-submit re-running the same import twice
// Reference: originals/volleyball.html:3169
let kinexonCollisionDetected=false;

// set true by warnKinexonCollisions when a same-day row already exists
// Reference: originals/volleyball.html:3170
let manEditId=null;


// Reference: originals/volleyball.html:3172
const SRC_INFO = {
  custom:`Standard / Custom Format — flexible header detection.
Required: Name, Position (OH/MB/S/RS/OPP/Lib/DS)
Jump Testing: ApproachJump, CMJHeight, StandVert, Sprint10
VALD ForceDecks: PeakPower, RSI, Asymmetry, EccRFD, ConcImpulse, EccImpulse, ContractionTime
Kinexon: JumpVol, AvgJumpHt, PlayerLoad, AcuteLoad, ChronicLoad
Header names are case-insensitive; common aliases are auto-detected.`,
  vald:`VALD Hub Export — ForceDecks CMJ Results Table.
Export from: VALD Hub → Profiles → Results Table → CMJ → Export CSV.
Expected columns: Name, Group (=Sport), Jump Height (cm or in — auto-converted), 
Peak Power (W) or Peak Relative Power (W/kg) — both supported, RSI Modified, Limb Symmetry Index (%), 
Eccentric Braking RFD (N/s), Propulsive Impulse (N·s), Braking Impulse (N·s), 
Time to Takeoff (ms). Additional athlete info (Position, Year) can be added.`,
  kinexon:`Kinexon Session Export — two formats supported:

FORMAT 1 — Per-Athlete Summary (semicolon-delimited, one file per athlete):
  Export: Kinexon App → select athlete → Sessions → Export CSV
  Provides: Jumps total, jump bands (low/mid/high), Jumps/min per band
  Select the athlete from the dropdown after uploading.

FORMAT 2 — Raw Match Event Export (semicolon-delimited, all athletes):
  Export: Kinexon App → session → Export → Raw Data / Event Export
  Provides: Jump counts with height bands, Accel Load (calculated approximation)
  All athletes auto-matched to roster — no athlete selection needed.

Note: Official "Accumulated Acceleration Load" from Kinexon PDF reports is not
available in any CSV export format. The Accel Load shown is a calculated 
approximation from raw exertion events.`,
  teambuildr:`Teambuildr Comparison Report — wide format with historical maxes.
Export from: Teambuildr → Reports → Comparison Report → All athletes → Export CSV.
Imports: Vertical Jump (→ Standing Vert), Back Squat, Trap Bar Deadlift, Front Squat, Bench Press, Hang Clean.
Each athlete's all-time max per exercise is stored.
Names will be matched to your locked canonical roster automatically.`,
  approachvert:`Approach Vert Testing — BGSU 4-step approach test format.
First row should be the test title with date (e.g. "APPROACH VERT TESTING 4/16/26").
Header row 2: Name, Standing Reach, 4 Step Approach Height (inches), 4 Step Approach Height (feet), Approach Vert (Inches).
Names can be last-name-only — will match to existing roster automatically.
4 Step Approach Height is touch height; will display as feet + inches on profiles.
Empty rows (no jump data) are skipped automatically. Negative values are filtered as outliers.`,
};


// Reference: originals/volleyball.html:3213
const COL_ALIASES = {
  name:           ['name','athlete','athlete name','full name','player'],
  pos:            ['pos','position','role'],
  yr:             ['yr','year','class','grade'],
  age:            ['age'],
  test_date:      ['date','test date','session date','date tested','date of test','test_date'],
  approachJump:   ['approachjump','approach jump','app jump','approach','run jump','approach vert','approach vert (in)','approach vert (inches)','run approach','app vert','approach vertical','app vertical','4 step approach height','4 step approach height (inches)','4-step approach height','approach touch','touch height','approach height'],
  cmjHeight:      ['cmjheight','cmj height','cmj','cmj ht','jump height (in)','jump height (cm)','jump height (flight time)','countermovement jump','cmj (in)'],
  standVert:      ['standvert','standing vert','standing vertical','vert','vertical','stand vert','standing jump'],
  sprint10:       ['sprint10','10yd','10-yd','10 yd','10yd sprint','10-yd sprint','10 yard','10 yard sprint','split 10yd'],
  peakPower:      ['peakpower','peak power','peak relative power','relative peak power','power (w/kg)','pp w/kg','peak power w/kg','power','power (w)'],
  rsi:            ['rsi','rsi modified','rsi-modified','rsi mod','rsim','mrsi'],
  asymmetry:      ['asymmetry','limb symmetry index','lsi','asymmetry %','lsi %','limb asym','bilateral deficit'],
  eccRFD:         ['eccrfd','eccentric rfd','ecc rfd','braking rfd','eccentric braking rfd','deceleration rfd'],
  concImpulse:    ['concimpulse','concentric impulse','propulsive impulse','conc impulse','conc. impulse'],
  eccImpulse:     ['eccimpulse','eccentric impulse','braking impulse','ecc impulse','ecc. impulse'],
  contractionTime:['contractiontime','contraction time','time to takeoff','ttt','takeoff duration'],
  takeoff_velocity:['takeoff velocity','takeoff velo','takeoff vel','to velocity','vertical velocity at takeoff','velocity at takeoff'],
  conc_impulse_asym:['conc impulse asym','concentric impulse asymmetry','conc imp asym','conc impulse asym (-l/+r)','concentric impulse asymmetry (-l/+r)','concentric impulse % (asym)','conc impulse % (asym)'],
  ecc_braking_asym:['ecc braking asym','eccentric braking asymmetry','ecc brake asym','ecc braking asymmetry (-l/+r)','eccentric braking asymmetry (-l/+r)','eccentric braking impulse % (asym)','ecc braking impulse % (asym)'],
  jumpVol:        ['jumpvol','jump volume','jump count','total jumps','jumps','# jumps'],
  avgJumpHt:      ['avgjumpht','avg jump height','average jump height','mean jump height','avg jump ht'],
  playerLoad:     ['playerload','player load','session load','total load','load'],
  acuteLoad:      ['acuteload','acute load','7-day load','7 day load','7d load','recent load'],
  chronicLoad:    ['chronicload','chronic load','28-day load','28 day load','28d load','rolling load'],
};

// ── Placeholder data audit (10-yd sprint) ────────────────────────
// An athlete's sprint10 is "placeholder" if no logged source ever actually
// confirmed it — meaning it's still whatever the random position-range
// fallback (rndf) assigned when the field was first created.
// Reference: originals/volleyball.html:3260
function findSprintPlaceholders(){
  return context.api.allAthletes().filter(a=>a.sprint10!=null && !context.api.sourceForKey(a,'sprint10'));
}


// Reference: originals/volleyball.html:3264
function openSprintAudit(){
  const list=findSprintPlaceholders();
  const body=document.getElementById('sprint-audit-body');
  if(!list.length){
    body.innerHTML=`<div class="ok">✓ No unconfirmed 10-yd sprint values found — every athlete's current value traces back to a real import.</div>`;
  } else {
    body.innerHTML=
      `<div class="warn" style="margin-bottom:14px;">${list.length} athlete${list.length!==1?'s have':' has'} a 10-yd time that was never confirmed by a real import — it's a randomly-generated placeholder, not real data.</div>`+
      `<table class="prev-tbl" style="width:100%;margin-bottom:16px;"><thead><tr><th>Athlete</th><th>Pos</th><th>Current value shown</th></tr></thead><tbody>`+
      list.map(a=>`<tr><td>${a._canonicalName||a.name}</td><td>${a.pos||'—'}</td><td style="color:var(--yellow);">${a.sprint10.toFixed(2)}s</td></tr>`).join('')+
      `</tbody></table>`+
      `<div style="display:flex;gap:10px;">`+
      `<button data-onclick="clearSprintPlaceholders()" style="flex:1;background:var(--orange);border:none;border-radius:var(--r);padding:11px 16px;color:#fff;font-family:var(--fh);font-size:13px;font-weight:800;letter-spacing:0.5px;cursor:pointer;text-transform:uppercase;">CLEAR THESE ${list.length} TO BLANK</button>`+
      `<button data-onclick="closeSprintAudit()" style="flex:0 0 auto;background:var(--bg4);border:1px solid var(--border2);border-radius:var(--r);padding:11px 18px;color:var(--text2);font-family:var(--fh);font-size:13px;font-weight:700;cursor:pointer;">CANCEL</button>`+
      `</div>`+
      `<div style="margin-top:10px;font-size:10px;color:var(--text3);font-family:var(--fm);line-height:1.5;">Note: source-tracking was slightly inaccurate before this fix — if an athlete showed "–" for 10-yd in a Teambuildr file you already imported, their old placeholder may not be caught here. Double-check anyone you know had no data in the file.</div>`;
  }
  document.getElementById('sprint-audit-overlay').style.display='block';
  document.body.style.overflow='hidden';
}


// Reference: originals/volleyball.html:3285
function closeSprintAudit(){
  document.getElementById('sprint-audit-overlay').style.display='none';
  document.body.style.overflow='';
}


// Reference: originals/volleyball.html:3289
document.getElementById('sprint-audit-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('sprint-audit-overlay'))closeSprintAudit();});


// Reference: originals/volleyball.html:3291
function clearSprintPlaceholders(){
  const list=findSprintPlaceholders();
  if(!list.length) return;
  if(!confirm(`Clear the 10-yd sprint value for ${list.length} athlete${list.length!==1?'s':''}?\n\nThey'll show as "—" until real data is imported for them. This cannot be undone.`)) return;
  for(const a of list){
    a.sprint10=null;
    a.sprint10Date=null;
    a.composite=context.api.calcCompositeVB(a);
    a.tier=context.api.calcTier(a.composite);
    context.api.queueSave(a);
  }
  context.api.refreshAll();
  context.api.toast(`✓ Cleared placeholder 10-yd data for ${list.length} athlete${list.length!==1?'s':''}`);
  closeSprintAudit();
}

// ── Smart Match & Update ─────────────────────────────────────────
// Reference: originals/volleyball.html:3430
function commitSmartMatch(){
  if(!parsedData||!parsedData.length){
    showMsg('csv-msgs','err','No data parsed yet.');return;
  }
  const presentKeys=processRows._presentKeys||new Set();
  const fname=readFile._lastName||'import.csv';
  const matched=[], unmatched=[], ambiguous=[];

  for(const incoming of parsedData){
    const result=context.api.findBestMatch(incoming.name);
    if(!result){unmatched.push(incoming.name);continue;}
    const {athlete,score,exact,matchType,conflicts}=result;

    // Ambiguous last name — multiple athletes share it, can't auto-assign
    if(matchType==='ambiguous-last-name'){
      unmatched.push(incoming.name+'  ⚠ multiple athletes with this last name: '+conflicts.map(c=>c._canonicalName||c.name).join(', '));
      continue;
    }

    if(!exact&&score<0.95) ambiguous.push({incoming:incoming.name,matched:athlete._canonicalName||athlete.name,score,matchType});
    const updated=context.api.mergeAthleteRecords(athlete, incoming, presentKeys, fname);
    const idx=context.api.ATHLETES.findIndex(a=>a.id===athlete.id);
    if(idx>=0) context.api.ATHLETES[idx]=updated;
    matched.push({from:incoming.name,to:athlete._canonicalName||athlete.name,exact,matchType,updatedKeys:[...presentKeys]});
  }

  const matchCount=matched.length;
  const report=document.getElementById('smart-match-report');
  let html=`<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);padding:14px;font-family:var(--fm);font-size:11px;">`;
  html+=`<div style="font-family:var(--fh);font-size:14px;font-weight:800;color:var(--text);margin-bottom:12px;letter-spacing:0.5px;">SMART MATCH RESULTS — ${fname}</div>`;

  if(matched.length){
    html+=`<div style="color:var(--green);margin-bottom:7px;letter-spacing:0.5px;">✓ UPDATED ${matched.length} ATHLETE${matched.length!==1?'S':''}</div>`;
    html+=`<div style="display:flex;flex-direction:column;gap:3px;margin-bottom:12px;">`;
    html+=matched.map(m=>`
      <div style="display:flex;align-items:center;gap:8px;padding:5px 9px;background:var(--green-dim);border-radius:4px;">
        <span style="color:var(--green);flex-shrink:0;">✓</span>
        <span style="color:var(--text);font-weight:500;">${m.to}</span>
        ${!m.exact?`<span style="color:var(--text3);">← matched from "${m.from}"</span>`:''}
        <span style="color:var(--text3);margin-left:auto;font-size:10px;">${m.updatedKeys.slice(0,4).join(', ')}${m.updatedKeys.length>4?` +${m.updatedKeys.length-4} more`:''}</span>
      </div>`).join('');
    html+=`</div>`;
  }
  if(ambiguous.length){
    html+=`<div style="color:var(--yellow);margin-bottom:7px;">⚠ FUZZY MATCHES — verify before applying</div>`;
    html+=`<div style="display:flex;flex-direction:column;gap:3px;margin-bottom:12px;">`;
    html+=ambiguous.map(a=>`<div style="padding:5px 9px;background:var(--yellow-dim);border-radius:4px;color:var(--yellow);">"${a.incoming}" → "${a.matched}" <span style="color:var(--text3);">(${Math.round(a.score*100)}% match)</span></div>`).join('');
    html+=`</div>`;
  }
  if(unmatched.length){
    html+=`<div style="color:var(--red);margin-bottom:7px;">✗ NO MATCH FOUND (${unmatched.length})</div>`;
    html+=`<div style="display:flex;flex-direction:column;gap:3px;margin-bottom:12px;">`;
    html+=unmatched.map(n=>`<div style="padding:5px 9px;background:var(--red-dim);border-radius:4px;color:var(--red);">${n}</div>`).join('');
    html+=`</div>`;
  }

  html+=`<div style="display:flex;gap:8px;flex-wrap:wrap;">
    <button data-onclick="applyAndClose(${matchCount})" style="background:var(--blue-dim);border:1px solid rgba(96,165,250,0.4);border-radius:var(--r);padding:8px 18px;color:var(--blue);font-family:var(--fm);font-size:11px;cursor:pointer;letter-spacing:0.5px;">APPLY &amp; CLOSE</button>
    ${unmatched.length?`<button data-onclick="addUnmatched()" style="background:var(--bg4);border:1px solid var(--border2);border-radius:var(--r);padding:8px 14px;color:var(--text2);font-family:var(--fm);font-size:11px;cursor:pointer;letter-spacing:0.5px;">+ ADD UNMATCHED AS NEW</button>`:''}
  </div>`;
  html+=`</div>`;
  report.innerHTML=html;
  report.style.display='block';
  report.scrollIntoView({behavior:'smooth',block:'nearest'});
}


// Reference: originals/volleyball.html:3496
function applyAndClose(count){
  document.getElementById('smart-match-report').style.display='none';
  context.api.refreshAll();closeImport();
  context.api.postImportPositionCheck();
  if(context.api.unsetCount()===0) context.navigate('dashboard');
  context.api.toast(`✓ Smart Match — ${count} athletes updated`);
}


// Reference: originals/volleyball.html:3504
function addUnmatched(){
  if(!parsedData)return;
  const existing=new Set(context.api.rosterAthletes().map(a=>context.api.normName(a._canonicalName||a.name)));
  const newAthletes=parsedData.filter(a=>!context.api.findBestMatch(a.name));
  const mx=context.api.ATHLETES.reduce((m,a)=>Math.max(m,a.id),0);
  context.api.ATHLETES=[...context.api.ATHLETES,...newAthletes.map((a,i)=>({...a,id:mx+i+1}))];
  context.api.refreshAll();closeImport();context.navigate('dashboard');
  context.api.toast(`✓ Added ${newAthletes.length} new athletes`);
}


// Reference: originals/volleyball.html:3514
function openImport(){
  document.getElementById('imp-overlay').style.display='block';
  // Real sessions keep the wording in import.html. Demo Mode is synthetic and in-memory only.
  const saveNote=document.getElementById('imp-save-note');
  if(saveNote&&context.api.demoMode) saveNote.textContent='DEMO MODE — synthetic data only. Imported changes are temporary: they exist only in this browser tab, are cleared when you reload or exit the demo, and never affect production data.';
  document.body.style.overflow='hidden';
  updateSrcInfo();
  setDZState('idle');
  const sel=document.getElementById('man-edit-sel');
  sel.innerHTML=context.api.athleteOptions('— new athlete —');
  requestAnimationFrame(()=>requestAnimationFrame(initDropZone));
}


// Reference: originals/volleyball.html:3523
function closeImport(){document.getElementById('imp-overlay').style.display='none';document.body.style.overflow='';}


// Reference: originals/volleyball.html:3524
document.getElementById('imp-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('imp-overlay'))closeImport();});

// Don't let the overlay swallow drag events before they reach the drop zone
// Reference: originals/volleyball.html:3526
['dragenter','dragover','dragleave','drop'].forEach(evt=>{
  document.getElementById('imp-overlay').addEventListener(evt,e=>{
    if(e.target!==document.getElementById('imp-overlay'))return;
    e.preventDefault();e.stopPropagation();
  });
});


// Reference: originals/volleyball.html:3533
function switchITab(t){
  ['csv','paste','manual'].forEach(x=>{document.getElementById('itab-'+x).classList.toggle('active',x===t);document.getElementById('ipanel-'+x).style.display=x===t?'block':'none';});
}


// Reference: originals/volleyball.html:3536
function setSrc(s){
  importSrc=s;['custom','vald','kinexon','teambuildr','approachvert'].forEach(x=>document.getElementById('src-'+x).classList.toggle('active',x===s));
  updateSrcInfo();resetCSVUI();
}


// Reference: originals/volleyball.html:3540
function setPSrc(s){pasteSrc2=s;['custom','vald','kinexon','teambuildr','approachvert'].forEach(x=>document.getElementById('psrc-'+x).classList.toggle('active',x===s));}


// Reference: originals/volleyball.html:3541
function updateSrcInfo(){document.getElementById('src-info').textContent=SRC_INFO[importSrc]||'';}


// Reference: originals/volleyball.html:3543
function handleFileSelect(e){const f=e.target.files[0];if(f)readFile(f);}


// Reference: originals/volleyball.html:3545
function readFile(f){
  if(!f.name.toLowerCase().endsWith('.csv')){
    setDZState('idle');
    showMsg('csv-msgs','err','Please upload a .csv file.');return;
  }
  setDZState('reading');
  document.getElementById('dz-reading-label').textContent='Reading: '+f.name+'…';
  const r=new FileReader();
  r.onload=e=>{
    readFile._lastName=f.name;
    const txt=e.target.result.replace(/^\uFEFF/,'');
    const firstLine=txt.split('\n')[0];

    // Auto-detect Kinexon: semicolon-delimited AND contains "Event type" or "Player ID" or "Timestamp"
    // OR source tab is explicitly set to kinexon
    const looksLikeKinexon = importSrc==='kinexon' ||
      (firstLine.includes(';') &&
       (firstLine.toLowerCase().includes('event type') ||
        firstLine.toLowerCase().includes('player id') ||
        firstLine.toLowerCase().includes('timestamp') ||
        firstLine.toLowerCase().includes('start;description;type')));

    if(looksLikeKinexon){
      // Parse with semicolon delimiter and route to Kinexon handler
      const lines=txt.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim());
      const rows=lines.map(line=>{
        const row=[];let f2='',inQ=false;
        for(let i=0;i<line.length;i++){
          const c=line[i];
          if(c==='"'){if(inQ&&line[i+1]==='"'){f2+='"';i++;}else inQ=!inQ;}
          else if(c===';'&&!inQ){row.push(f2.trim());f2='';}
          else f2+=c;
        }
        row.push(f2.trim());
        return row;
      });
      // Switch source tab to kinexon visually
      if(importSrc!=='kinexon') setSrc('kinexon');
      processKinexonRows(rows);
      return;
    }
    parseCSV(txt);
  };
  r.onerror=()=>{setDZState('idle');showMsg('csv-msgs','err','Could not read file. Try the Paste tab instead.');};
  r.readAsText(f);
}


// Reference: originals/volleyball.html:3592
function setDZState(state){
  document.getElementById('dz-idle').style.display    = state==='idle'    ? 'block':'none';
  document.getElementById('dz-reading').style.display = state==='reading' ? 'block':'none';
  document.getElementById('dz-ready').style.display   = state==='ready'   ? 'block':'none';
}

// ── Drag-and-drop wired in JS (inline handlers blocked by modal overlay) ──
// Reference: originals/volleyball.html:3599
function initDropZone(){
  const dz=document.getElementById('drop-zone');
  if(!dz||dz._dzReady)return;
  dz._dzReady=true;
  dz.addEventListener('click',()=>document.getElementById('csv-input').click());
  dz.addEventListener('dragenter',e=>{e.preventDefault();e.stopPropagation();dz.style.borderColor='var(--orange)';dz.style.background='rgba(254,80,0,0.06)';});
  dz.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();dz.style.borderColor='var(--orange)';dz.style.background='rgba(254,80,0,0.06)';});
  dz.addEventListener('dragleave',e=>{e.preventDefault();e.stopPropagation();dz.style.borderColor='';dz.style.background='';});
  dz.addEventListener('drop',e=>{
    e.preventDefault();e.stopPropagation();
    dz.style.borderColor='';dz.style.background='';
    const f=e.dataTransfer.files[0];
    if(f){readFile(f);}
    else{setDZState('idle');showMsg('csv-msgs','err','No file detected — try the Browse button or Paste tab.');}
  });
}


// Reference: originals/volleyball.html:3616
function parseCSV(txt){
  txt=txt.replace(/^\uFEFF/,'');
  // Auto-detect delimiter: if first line has more semicolons than commas, use semicolons
  const firstLine=txt.split('\n')[0];
  const delimiter=(firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
  const rows=[];
  const lines=txt.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim());
  for(const line of lines){
    const row=[];let f='',inQ=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"'){if(inQ&&line[i+1]==='"'){f+='"';i++;}else inQ=!inQ;}
      else if(c===delimiter&&!inQ){row.push(f.trim());f='';}
      else f+=c;
    }
    row.push(f.trim());
    rows.push(row);
  }
  if(rows.length<2){setDZState('idle');showMsg('csv-msgs','err','File appears empty.');return;}

  // Title row detection: a row that has mostly empty cells OR doesn't include "name" anywhere
  // We sniff: if the first row has fewer than 3 non-empty cells, OR if the first cell looks like a title
  // (contains "test", "vert", "session", and/or a date), treat as title and skip.
  // Also handles Teambuildr comparison report which has a " , ,Max 1,,,Max 2..." merge header as row 1.
  const titleRowDate = extractDateFromTitle(rows[0]);
  const firstRowFilledCells = rows[0].filter(c=>c.trim()).length;
  const firstCellNorm = (rows[0][0]||'').trim().toLowerCase();
  const isTBMergeRow = rows[0].some(c=>/^max\s*\d+$/i.test((c||'').trim()));
  const looksLikeTitle = (firstRowFilledCells<=2) ||
                        /test(ing)?|session|vert|approach/i.test(rows[0][0]||'') ||
                        isTBMergeRow;
  if(looksLikeTitle && rows.length>=3){
    parseCSV._titleRowDate = titleRowDate;
    rows.shift();
  } else {
    parseCSV._titleRowDate = null;
  }

  if(rows.length<2){setDZState('idle');showMsg('csv-msgs','err','File has no data rows after the title.');return;}
  processRows(rows, importSrc, parseCSV._titleRowDate);
}

// Extract a date from a title row like "APPROACH VERT TESTING 4/16/26"
// Reference: originals/volleyball.html:3659
function extractDateFromTitle(row){
  for(const cell of row){
    if(!cell) continue;
    // Match M/D/YY, M/D/YYYY, MM-DD-YYYY, YYYY-MM-DD
    const m=cell.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/) || cell.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if(m){
      const d=new Date(cell.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/)[0]);
      if(!isNaN(d.getTime())) return d.toISOString().slice(0,10);
    }
  }
  return null;
}

// Parse a session-style CSV (each row = one athlete on one date) into the test_sessions table
// Reference: originals/volleyball.html:3673
function processSessionRows(data, colIdx, headers){
  const sessions=[];
  const errors=[];
  for(const row of data){
    const name=row[colIdx.name]?.trim();if(!name)continue;
    const dateRaw=row[colIdx.test_date]?.trim();if(!dateRaw)continue;
    // Parse date — accept MM/DD/YYYY, YYYY-MM-DD, M/D/YY etc.
    let dateISO=null;
    const d=new Date(dateRaw);
    if(!isNaN(d.getTime())){
      dateISO=d.toISOString().slice(0,10);
    } else {
      errors.push(`Bad date: ${dateRaw} for ${name}`);
      continue;
    }
    const num=(f)=>{
      if(colIdx[f]===null||row[colIdx[f]]===undefined) return null;
      const v=parseFloat(row[colIdx[f]]);
      return isNaN(v)?null:v;
    };
    // Signed asymmetry parse: VALD exports these as e.g. "4.6 L" / "11 R" — a
    // plain parseFloat keeps only the magnitude and silently drops which side
    // it's on. Per the app's own "-L/+R" convention (see column headers),
    // L should be negative and R positive so coaches can see WHICH side is
    // behind, not just that an imbalance exists.
    const numSigned=(f)=>{
      if(colIdx[f]===null||row[colIdx[f]]===undefined) return null;
      const raw=(row[colIdx[f]]||'').trim();
      const m=raw.match(/(-?[\d.]+)\s*([LR])?/i);
      if(!m) return null;
      const mag=parseFloat(m[1]);
      if(isNaN(mag)) return null;
      const side=(m[2]||'').toUpperCase();
      if(side==='L') return -Math.abs(mag);
      if(side==='R') return Math.abs(mag);
      return mag; // no L/R suffix — already signed or unitless, leave as-is
    };
    // Peak power conversion: W/kg → W if header says relative or value is suspiciously low
    let pp=num('peakPower');
    if(pp!==null){
      const ph=colIdx.peakPower!==null?headers[colIdx.peakPower]:'';
      const isRelative=ph.includes('w/kg')||ph.includes('relative')||ph.includes('/kg');
      if(isRelative||pp<200){
        const bw=parseFloat(row[colIdx.weight]||row[colIdx.bodyweight]||'')||70;
        pp=Math.round(pp*bw);
      }
    }
    sessions.push({
      athlete_name: name,
      test_date: dateISO,
      jump_height: num('cmjHeight'),
      takeoff_velocity: num('takeoff_velocity'),
      power: pp,
      concentric_impulse: num('concImpulse'),
      mrsi: num('rsi'),
      conc_impulse_asym: numSigned('conc_impulse_asym'),
      ecc_braking_asym: numSigned('ecc_braking_asym'),
      peak_power: pp,
      rsi_mod: num('rsi'),
      asymmetry: num('asymmetry'),
      ecc_rfd: num('eccRFD'),
      ecc_impulse: num('eccImpulse'),
      contraction_time: num('contractionTime'),
      source_file: readFile._lastName||'paste',
      test_type: 'vald_forcedecks', // real CMJ jump_height — the only source the readiness hub's "Jump Height" column should read from
    });
  }
  parsedData=sessions;
  processRows._isSessionImport=true;
  setDZState('ready');
  const fname=readFile._lastName||'session.csv';
  document.getElementById('dz-file-name').textContent='✓ '+fname+' (session data)';
  document.getElementById('dz-athlete-count').textContent=`${sessions.length} test session${sessions.length!==1?'s':''} ready to import to Readiness Hub`;
  // Build preview
  const previewCols=['athlete_name','test_date','jump_height','takeoff_velocity','power','mrsi','conc_impulse_asym','ecc_braking_asym'];
  const colLabels=['Athlete','Date','Jump Ht','TO Velo','Power','mRSI','Conc Asym','Ecc Asym'];
  document.getElementById('col-map-tbl').innerHTML=`<div class="ok">Session-style CSV detected — date column found. These will save to Readiness Hub.</div>`;
  document.getElementById('csv-data-prev').innerHTML=`<table class="prev-tbl"><thead><tr>${colLabels.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${sessions.slice(0,5).map(s=>`<tr>${previewCols.map(k=>`<td>${s[k]===null||s[k]===undefined?'—':s[k]}</td>`).join('')}</tr>`).join('')}</tbody></table>${sessions.length>5?`<div style="font-size:9px;color:var(--text3);margin-top:6px;">... +${sessions.length-5} more</div>`:''}`;
  if(errors.length) showMsg('csv-msgs','warn',errors.slice(0,5).join('; ')+(errors.length>5?` (+${errors.length-5} more)`:''));
}

// Parse the BGSU Approach Vert Testing CSV format.
// Row 1: title with date (e.g. "APPROACH VERT TESTING 4/16/26")
// Row 2: headers — Name, Standing Reach, 4 Step Approach Height (inches), 4 Step Approach Height (feet), Approach Vert (Inches)
// Rows 3+: athletes — name (last-name-only allowed), values
// Saves to test_sessions table with approachJump = 4 Step Approach Height (inches)
// Reference: originals/volleyball.html:3759
function processApproachVertRows(rows, titleRowDate){
  // rows[0] = headers (title row already stripped by parseCSV)
  // titleRowDate = ISO date extracted from title row, or null
  const testDate = titleRowDate || new Date().toISOString().slice(0,10);

  const headers = (rows[0]||[]).map(h=>h.toLowerCase().trim().replace(/\u00A0/g,' '));
  const data = rows.slice(1).filter(r=>r.some(c=>c&&c.trim()));

  const findCol = (...aliases) => {
    for(const a of aliases){
      const i = headers.findIndex(h=>h===a||h.includes(a));
      if(i>=0) return i;
    }
    return -1;
  };

  const nameIdx           = findCol('name','athlete');
  const reachIdx          = findCol('standing reach','reach');
  const approachInchesIdx = findCol('4 step approach height (inches)','approach height (inches)','approach height inches','4-step approach');
  const approachFeetIdx   = findCol('4 step approach height (feet)','approach height (feet)','approach height feet');
  const approachVertIdx   = findCol('approach vert (inches)','approach vert','approach vertical');

  if(nameIdx<0){
    setDZState('idle');
    showMsg('csv-msgs','err','Could not find Name column. Make sure the "Approach Vert Testing" tab is selected and the CSV has correct headers.');
    return;
  }

  const sessions=[], errors=[], matched=[], unmatched=[];

  for(const row of data){
    const rawName=(row[nameIdx]||'').trim();
    if(!rawName) continue;
    const num=(idx)=>{
      if(idx<0||row[idx]===undefined||row[idx]==='') return null;
      const v=parseFloat(row[idx]); return isNaN(v)?null:v;
    };
    const reach               = num(reachIdx);
    const approachTouchInches = num(approachInchesIdx);
    const approachFeetDisplay = approachFeetIdx>=0
      ? (row[approachFeetIdx]||'').trim().replace(/"{2,}/g,'"') : '';
    const approachVert        = num(approachVertIdx);

    if(approachTouchInches===null && approachVert===null) continue;
    if(approachTouchInches!==null && approachTouchInches<60)
      errors.push(`${rawName}: implausible touch height ${approachTouchInches}"`);
    if(approachVert!==null && approachVert<0)
      errors.push(`${rawName}: negative vertical filtered (${approachVert})`);

    const match = context.api.findBestMatch(rawName);
    const canonicalName = match?.athlete ? (match.athlete._canonicalName||match.athlete.name) : rawName;
    if(match) matched.push({raw:rawName, canonical:canonicalName});
    else unmatched.push(rawName);

    const cleanTouch = (approachTouchInches!==null&&approachTouchInches>=60) ? approachTouchInches : null;
    sessions.push({
      athlete_name:           canonicalName,
      test_date:              testDate,
      approach_height_inches: cleanTouch,
      approach_height_feet:   approachFeetDisplay || (cleanTouch ? context.api.inchesToFeet(cleanTouch) : null),
      approach_vert:          (approachVert!==null&&approachVert>=0) ? approachVert : null,
      standing_reach:         reach,
      source_file:            readFile._lastName||'approach-vert.csv',
    });
  }

  if(!sessions.length){
    setDZState('idle');
    showMsg('csv-msgs','err','No valid rows found. Make sure the "Approach Vert Testing" tab is selected and the CSV has data.');
    return;
  }

  parsedData = sessions;
  processRows._isApproachVertImport = true;
  setDZState('ready');
  const fname = readFile._lastName||'approach-vert.csv';
  document.getElementById('dz-file-name').textContent = '\u2713 '+fname+' (approach vert test)';
  document.getElementById('dz-athlete-count').textContent =
    `${sessions.length} athletes \u00b7 test date ${testDate} \u00b7 ${matched.length} matched to roster`+
    (unmatched.length ? ` \u00b7 ${unmatched.length} unmatched` : '');

  const previewCols = ['athlete_name','test_date','approach_height_inches','approach_height_feet','approach_vert','standing_reach'];
  const colLabels   = ['Athlete','Date','Touch (in)','Touch (ft)','Approach Vert','Reach'];
  let msgs = '';
  if(unmatched.length)
    msgs += `<div class="warn">${unmatched.length} name${unmatched.length!==1?'s':''} did not match roster: ${unmatched.slice(0,5).join(', ')}${unmatched.length>5?'...':''}. Will be added as new athletes.</div>`;
  if(errors.length)
    msgs += `<div class="warn">${errors.length} value${errors.length!==1?'s':''} filtered: ${errors.slice(0,3).join('; ')}${errors.length>3?'...':''}</div>`;
  document.getElementById('col-map-tbl').innerHTML =
    `<div class="ok">Approach Vert format detected \u00b7 test date ${testDate}</div>${msgs}`;
  document.getElementById('csv-data-prev').innerHTML =
    `<table class="prev-tbl"><thead><tr>${colLabels.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>`+
    sessions.slice(0,8).map(s=>`<tr>${previewCols.map(k=>`<td>${s[k]===null||s[k]===undefined?'\u2014':s[k]}</td>`).join('')}</tr>`).join('')+
    `</tbody></table>`+
    (sessions.length>8?`<div style="font-size:9px;color:var(--text3);margin-top:6px;">... +${sessions.length-8} more</div>`:'');
}

// ── Kinexon Raw Event Export Import ─────────────────────────────
// Format: semicolon-delimited, 4-row compound header, all athletes in one file
// Event types: Jump (count + height band), Exertion (accel load), Change of Orientation
// Columns: Timestamp(ms) | Date | Player ID | Name | Event type | ...varies by event type
// Jump cols:     [5]=Airtime, [6]=Height(ft), [7]=Distance, [8]=Jump Ratio, [9]=Jump category
// Exertion cols: [5]=Duration, [6]=Accel Load avg, [7]=Accel Load max, [8]=Distance, [9]=Speed
// Reference: originals/volleyball.html:3861
function processKinexonRows(rows){
  if(!rows||rows.length<6){
    setDZState('idle');
    showMsg('csv-msgs','err','Kinexon file appears empty or too short.');
    return;
  }

  // Detect format: team summary (has "Name" + "Accumulated Acceleration Load")
  const row0Joined=rows[0].join(' ').toLowerCase();
  const isTeamSummary=rows[0].some(h=>/^name$/i.test((h||'').trim())) &&
    rows[0].some(h=>h.toLowerCase().includes('accumulated acceleration'));
  const isEventLevel=row0Joined.includes('event type')||row0Joined.includes('player id');
  const isSummary=rows[0].some(h=>/^start$/i.test((h||'').trim()));

  if(isTeamSummary){
    processKinexonTeamSummaryRows(rows);
    return;
  }

  if(isSummary){
    processKinexonSummaryRows(rows);
    return;
  }

  if(!isEventLevel){
    setDZState('idle');
    showMsg('csv-msgs','err','Kinexon format not recognized. Expected raw event export or summary export.');
    return;
  }

  // Event-level format: skip 4 compound header rows, data starts at row 4
  const dataRows=rows.slice(4).filter(r=>r.some(c=>c&&c.trim()));

  // Aggregate per athlete per date
  const byAthlete={};
  const parseKinDate=(s)=>{
    if(!s) return null;
    const part=s.split(',')[0].trim(); // "04/18/2026, 10:00:37 AM" → "04/18/2026"
    const d=new Date(part);
    return isNaN(d.getTime())?null:d.toISOString().slice(0,10);
  };

  for(const row of dataRows){
    const name=(row[3]||'').trim().replace(/\s+/g,' '); // normalize double spaces
    const event=(row[4]||'').trim();
    const date=parseKinDate(row[1]);
    if(!name||!event||!date) continue;

    const tsMs=parseInt(row[0]);
    const key=`${name}|||${date}`;
    if(!byAthlete[key]) byAthlete[key]={
      name, date,
      jumps_total:0, jumps_low:0, jumps_mid:0, jumps_high:0,
      accel_load:0, accel_load_max:0, exertion_count:0, exertion_dur_s:0,
      first_ms:null, last_ms:null,
    };
    const a=byAthlete[key];
    if(!isNaN(tsMs)){
      if(a.first_ms===null||tsMs<a.first_ms) a.first_ms=tsMs;
      if(a.last_ms===null||tsMs>a.last_ms) a.last_ms=tsMs;
    }

    if(event==='Jump'){
      // col[9] = Jump category: '≥ 0.98 ft' | '0.66 - 0.98 ft' | 'category1' (= 0-0.66 ft)
      const cat=(row[9]||'').trim().replace(/[""]/g,'').replace(/\u2265/g,'>=');
      a.jumps_total++;
      if(cat==='category1'||cat.includes('0 - 0.66')||cat.includes('0-0.66')){
        a.jumps_low++;
      } else if(cat.includes('0.66')){
        a.jumps_mid++;
      } else if(cat.includes('>= 0.98')||cat.includes('0.98')){
        a.jumps_high++;
      } else {
        a.jumps_low++; // fallback
      }
    } else if(event==='Exertion'){
      // col[6] = Acceleration Load (avg per exertion)
      const load=parseFloat(row[6]);
      if(!isNaN(load)&&load>0){ a.accel_load+=load; a.exertion_count++; }
    }
  }

  const entries=Object.values(byAthlete).map(e=>{
    // Calculate jumps/min and accel/min using session window (first to last event)
    const durMin=(e.last_ms&&e.first_ms)?(e.last_ms-e.first_ms)/1000/60:null;
    e.jumps_per_min=durMin&&e.jumps_total?parseFloat((e.jumps_total/durMin).toFixed(2)):null;
    e.jumps_high_per_min=durMin&&e.jumps_high?parseFloat((e.jumps_high/durMin).toFixed(2)):null;
    e.accel_load_per_min=durMin&&e.accel_load>0?parseFloat((e.accel_load/durMin).toFixed(2)):null;
    if(durMin!=null) e.session_duration_min=parseFloat(durMin.toFixed(1));
    return e;
    // NOTE: previously this filtered to jumps_total>0 only, which silently
    // dropped any athlete whose session was Exertion/accel-only with zero
    // recorded Jump events (e.g. MBs on blocking-heavy days) — their whole
    // day vanished before ever reaching the preview or commit step.
  }).filter(e=>e.jumps_total>0||e.accel_load>0||e.exertion_count>0);
  if(!entries.length){
    setDZState('idle');
    showMsg('csv-msgs','err','No valid jump or exertion data found in Kinexon file.');
    return;
  }

  // Match athlete names to roster
  const matched=[], unmatched=[];
  for(const e of entries){
    const m=context.api.findBestMatch(e.name);
    if(m&&m.matchType!=='ambiguous-last-name'){
      e.canonicalName=m.athlete._canonicalName||m.athlete.name;
      e.athleteId=m.athlete.id;
      matched.push(e);
    } else {
      e.canonicalName=e.name;
      unmatched.push(e);
    }
  }

  // Store and show preview
  parsedData=[...matched,...unmatched];
  processRows._isKinexonImport=true;
  processRows._kinexonSessions=parsedData;
  processRows._kinexonEventLevel=true;

  const fname=readFile._lastName||'kinexon.csv';
  document.getElementById('dz-file-name').textContent='✓ '+fname+' (Kinexon match/session)';
  document.getElementById('dz-athlete-count').textContent=
    `${matched.length} athletes matched · ${[...new Set(entries.map(e=>e.date))].length} date(s)`+
    (unmatched.length?` · ${unmatched.length} unmatched`:' · All matched to roster');

  // Show name match info
  const nameInfo=matched.filter(e=>e.name!==e.canonicalName)
    .slice(0,3).map(e=>`${e.name} → ${e.canonicalName}`).join(', ');

  document.getElementById('col-map-tbl').innerHTML=
    `<div class="ok">Kinexon event export detected · ${matched.length} athletes · all auto-matched to roster</div>`+
    (nameInfo?`<div class="ok">Name variants resolved: ${nameInfo}</div>`:'')+
    (unmatched.length?`<div class="warn">${unmatched.length} unmatched: ${unmatched.map(e=>e.name).join(', ')}</div>`:'');
  warnKinexonCollisions(matched);
  warnRosterAthletesMissingFromFile(matched);

  // Preview table
  document.getElementById('csv-data-prev').innerHTML=`
    <table class="prev-tbl"><thead><tr>
      <th>Athlete</th><th>Date</th><th>Total Jumps</th><th>Low</th><th>Mid</th><th>High (≥0.98ft)</th><th>Accel Load</th>
    </tr></thead><tbody>${parsedData.slice(0,10).map(e=>`<tr>
      <td>${e.canonicalName}</td>
      <td style="font-family:var(--fm)">${e.date}</td>
      <td style="color:var(--orange);font-family:var(--fm)">${e.jumps_total}</td>
      <td>${e.jumps_low}</td>
      <td>${e.jumps_mid}</td>
      <td style="color:#4ADE80;font-family:var(--fm)">${e.jumps_high}</td>
      <td style="font-family:var(--fm)">${e.accel_load>0?e.accel_load.toFixed(1):'—'}</td>
    </tr>`).join('')}</tbody></table>
    ${parsedData.length>10?`<div style="font-size:9px;color:var(--text3);margin-top:6px;">... +${parsedData.length-10} more</div>`:''}`;

  setDZState('ready');
}

// Team session summary format: one row per athlete, official Kinexon aggregated values
// Columns: Name | Group name | Session begin | Accel Load (max) | Jump Height (max) |
//          Jumps | Jumps (≥0.98ft) | Accumulated Acceleration Load | Accels Load / min |
//          Jumps / min | Jumps (0-0.66ft) | Jumps (0.66-0.98ft) | Duration (s)
// Reference: originals/volleyball.html:4021
function processKinexonTeamSummaryRows(rows){
  const headers=rows[0].map(h=>(h||'').trim().replace(/[""]/g,'').toLowerCase());
  const data=rows.slice(1).filter(r=>r.some(c=>c&&c.trim()));

  const ci={
    name:     headers.findIndex(h=>h==='name'),
    date:     headers.findIndex(h=>h.includes('session begin')||h.includes('start')),
    accelLoad:headers.findIndex(h=>h.includes('accumulated acceleration')),
    accelMin: headers.findIndex(h=>h.includes('accumulated acceleration load / min')||h.includes('accumulated acceleration load/min')||h==='accels load / min'),
    jumps:    headers.findIndex(h=>h==='jumps'),
    jHigh:    headers.findIndex(h=>h.includes('0.98')),
    jLow:     headers.findIndex(h=>h.includes('0 - 0.66')||h.includes('0-0.66')),
    jMid:     headers.findIndex(h=>h.includes('0.66 - 0.98')||h.includes('0.66-0.98')),
    jPerMin:  headers.findIndex(h=>h==='jumps / min'),
    durSec:   headers.findIndex(h=>h.includes('duration')),
  };

  const parseKinDate=(s)=>{
    if(!s) return null;
    // "04/18/2026 10:00:00 AM" or "Apr 18, 2026 10:00 AM"
    const d=new Date(s);
    return isNaN(d.getTime())?null:d.toISOString().slice(0,10);
  };

  const entries=data.map(row=>{
    const name=(row[ci.name]||'').trim().replace(/\s+/g,' ');
    const date=parseKinDate(row[ci.date]);
    if(!name||!date) return null;
    return {
      name, date,
      accel_load:       ci.accelLoad>=0?parseFloat(row[ci.accelLoad])||null:null,
      accel_load_per_min:ci.accelMin>=0?parseFloat(row[ci.accelMin])||null:null,
      jumps_total:      ci.jumps>=0?parseInt(row[ci.jumps])||null:null,
      jumps_high:       ci.jHigh>=0?parseInt(row[ci.jHigh])||null:null,
      jumps_low:        ci.jLow>=0?parseInt(row[ci.jLow])||null:null,
      jumps_mid:        ci.jMid>=0?parseInt(row[ci.jMid])||null:null,
      jumps_per_min:    ci.jPerMin>=0?parseFloat(row[ci.jPerMin])||null:null,
      session_duration_min: ci.durSec>=0?(parseInt(row[ci.durSec])||0)/60||null:null,
    };
  }).filter(Boolean);

  if(!entries.length){
    setDZState('idle');
    showMsg('csv-msgs','err','No valid rows found in Kinexon team summary file.');
    return;
  }

  // Match athlete names to roster
  const matched=[], unmatched=[];
  for(const e of entries){
    const m=context.api.findBestMatch(e.name);
    if(m&&m.matchType!=='ambiguous-last-name'){
      e.canonicalName=m.athlete._canonicalName||m.athlete.name;
      matched.push(e);
    } else {
      e.canonicalName=e.name;
      unmatched.push(e);
    }
  }

  parsedData=[...matched,...unmatched];
  processRows._isKinexonImport=true;
  processRows._kinexonSessions=parsedData;
  processRows._kinexonEventLevel=true; // reuse event-level commit path (all athletes in one file)

  const fname=readFile._lastName||'kinexon.csv';
  document.getElementById('dz-file-name').textContent='✓ '+fname+' (Kinexon team summary)';
  document.getElementById('dz-athlete-count').textContent=
    `${matched.length} athletes matched · ${[...new Set(entries.map(e=>e.date))].length} date(s)`+
    (unmatched.length?` · ${unmatched.length} unmatched`:' · All matched');

  const nameInfo=matched.filter(e=>e.name!==e.canonicalName).slice(0,3)
    .map(e=>`${e.name} → ${e.canonicalName}`).join(', ');
  document.getElementById('col-map-tbl').innerHTML=
    `<div class="ok">Kinexon team summary detected · ${matched.length} athletes · official Accumulated Accel Load values</div>`+
    (nameInfo?`<div class="ok">Name variants resolved: ${nameInfo}</div>`:'')+
    (unmatched.length?`<div class="warn">${unmatched.length} unmatched: ${unmatched.map(e=>e.name).join(', ')}</div>`:'');
  warnKinexonCollisions(matched);
  warnRosterAthletesMissingFromFile(matched);

  document.getElementById('csv-data-prev').innerHTML=`
    <table class="prev-tbl"><thead><tr>
      <th>Athlete</th><th>Date</th><th>Jumps</th><th>High</th><th>Accel Load</th><th>Accel/Min</th><th>Duration</th>
    </tr></thead><tbody>${parsedData.slice(0,10).map(e=>`<tr>
      <td>${e.canonicalName}</td>
      <td style="font-family:var(--fm)">${e.date}</td>
      <td style="color:var(--orange);font-family:var(--fm)">${e.jumps_total??'—'}</td>
      <td style="color:#4ADE80;font-family:var(--fm)">${e.jumps_high??'—'}</td>
      <td style="color:var(--orange);font-family:var(--fm)">${e.accel_load??'—'}</td>
      <td style="color:#CDA077;font-family:var(--fm)">${e.accel_load_per_min??'—'}</td>
      <td style="font-family:var(--fm)">${e.session_duration_min?Math.round(e.session_duration_min)+' min':'—'}</td>
    </tr>`).join('')}</tbody></table>
    ${parsedData.length>10?`<div style="font-size:9px;color:var(--text3);margin-top:6px;">... +${parsedData.length-10} more</div>`:''}`;

  setDZState('ready');
}


// Reference: originals/volleyball.html:4119
function processKinexonSummaryRows(rows){
  const headers=rows[0].map(h=>(h||'').toLowerCase().trim());
  const data=rows.slice(1).filter(r=>r.some(c=>c&&c.trim()));
  const ci={
    date:    headers.findIndex(h=>h==='start'),
    desc:    headers.findIndex(h=>h.includes('desc')),
    type:    headers.findIndex(h=>h==='type'),
    jumps:   headers.findIndex(h=>h==='jumps'),
    jLow:    headers.findIndex(h=>h.includes('0 - 0.66')||h.includes('0-0.66')),
    jMid:    headers.findIndex(h=>h.includes('0.66 - 0.98')),
    jHigh:   headers.findIndex(h=>h.includes('0.98')&&!h.includes('min')),
    jPerMin: headers.findIndex(h=>h.includes('jumps / min')&&!h.includes('0.66')&&!h.includes('0.98')&&!h.includes('0 -')),
    jHighPerMin: headers.findIndex(h=>h.includes('jumps / min')&&h.includes('0.98')),
  };
  const parseDate=(s)=>{if(!s)return null;const d=new Date(s);return isNaN(d.getTime())?null:d.toISOString().slice(0,10);};
  const sessions=data.map(row=>({
    test_date:     parseDate(row[ci.date]),
    session_type:  ci.type>=0?(row[ci.type]||'').trim():null,
    session_desc:  ci.desc>=0?(row[ci.desc]||'').trim():null,
    jumps_total:   ci.jumps>=0?parseInt(row[ci.jumps])||null:null,
    jumps_low:     ci.jLow>=0?parseInt(row[ci.jLow])||null:null,
    jumps_mid:     ci.jMid>=0?parseInt(row[ci.jMid])||null:null,
    jumps_high:    ci.jHigh>=0?parseInt(row[ci.jHigh])||null:null,
    jumps_per_min: ci.jPerMin>=0?parseFloat(row[ci.jPerMin])||null:null,
    jumps_high_per_min: ci.jHighPerMin>=0?parseFloat(row[ci.jHighPerMin])||null:null,
  })).filter(s=>s.test_date);

  if(!sessions.length){setDZState('idle');showMsg('csv-msgs','err','No valid sessions found.');return;}

  parsedData=sessions;
  processRows._isKinexonImport=true;
  processRows._kinexonSessions=sessions;
  processRows._kinexonEventLevel=false;

  const fname=readFile._lastName||'kinexon.csv';
  document.getElementById('dz-file-name').textContent='✓ '+fname+' (Kinexon summary — '+sessions.length+' sessions)';
  document.getElementById('dz-athlete-count').textContent=sessions.length+' sessions';

  const opts=context.api.allAthletes().map(a=>`<option value="${a.id}">${a._canonicalName||a.name} (${a.pos})</option>`).join('');
  document.getElementById('col-map-tbl').innerHTML=`
    <div style="margin-bottom:10px;">
      <div style="font-size:10px;color:var(--tan);font-family:var(--fm);letter-spacing:0.5px;margin-bottom:6px;">SELECT ATHLETE FOR THIS FILE</div>
      <select id="kinexon-athlete-sel" style="width:100%;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--r);padding:8px 10px;color:var(--text);font-family:var(--fm);font-size:12px;">
        <option value="">-- Select athlete --</option>${opts}
      </select>
    </div>`;

  document.getElementById('csv-data-prev').innerHTML=`
    <table class="prev-tbl"><thead><tr><th>Date</th><th>Type</th><th>Total Jumps</th><th>Low</th><th>Mid</th><th>High</th></tr></thead>
    <tbody>${sessions.slice(0,8).map(s=>`<tr>
      <td>${s.test_date}</td><td>${s.session_type||'—'}</td>
      <td style="color:var(--orange);font-family:var(--fm)">${s.jumps_total??'—'}</td>
      <td>${s.jumps_low??'—'}</td><td>${s.jumps_mid??'—'}</td>
      <td style="color:#4ADE80;font-family:var(--fm)">${s.jumps_high??'—'}</td>
    </tr>`).join('')}</tbody></table>`;
  setDZState('ready');
}

// ── Row Dispatcher ──────────────────────────────────────────────
// Reference: originals/volleyball.html:4180
function processRows(rows, src, titleRowDate){
  if(src==='approachvert'){processApproachVertRows(rows, titleRowDate);return;}
  if(src==='kinexon'){processKinexonRows(rows);return;}
  if(src==='teambuildr'){
    // Comparison report: first row already has real headers (Name, Exercise, Date, Max, Unit...)
    // because parseCSV stripped the "Max 1, Max 2..." merge row as a title
    const headers=rows[0].map(h=>(h||'').toLowerCase().trim());
    const data=rows.slice(1).filter(r=>r.some(c=>c&&c.trim()));
    processTB(headers,data);
    return;
  }
  const headers=rows[0].map(h=>h.toLowerCase().trim().replace(/\u00A0/g,' '));
  const data=rows.slice(1).filter(r=>r.some(c=>c.trim()));
  if(src==='teambuildr'){processTB(headers,data);return;}
  const colIdx={};
  const mapInfo=[];
  // concImpulse/eccImpulse should only match the actual impulse VALUE column
  // (e.g. "Concentric Impulse [N s]"), never the asymmetry PERCENT column
  // (e.g. "Concentric Impulse % (Asym) (%)") — VALD exports commonly include
  // both, with the asymmetry one often appearing first in column order, which
  // was causing the wrong column (a string like "4.6 L") to get picked up.
  const NO_PERCENT_FIELDS = new Set(['concImpulse','eccImpulse']);
  for(const [field,aliases] of Object.entries(COL_ALIASES)){
    const candidates = headers
      .map((h,i)=>({h,i}))
      .filter(({h})=> !(NO_PERCENT_FIELDS.has(field) && (h.includes('%')||h.includes('asym'))));
    const found=candidates.find(({h})=>aliases.includes(h)||aliases.some(a=>h.includes(a)));
    const idx=found?found.i:-1;
    colIdx[field]=idx>=0?idx:null;
    mapInfo.push({field,found:idx>=0?headers[idx]:null});
  }
  if(colIdx.name===null){setDZState('idle');showMsg('csv-msgs','err','Column "Name" not found. Check your headers match the expected format.');return;}

  // ── SESSION-STYLE IMPORT: if test_date column exists, parse rows as test sessions ──
  if(colIdx.test_date!==null){
    processSessionRows(data, colIdx, headers);
    return;
  }

  // Track which metric keys were actually in this CSV (for Smart Match selective update)
  const metricKeys=['approachJump','cmjHeight','standVert','sprint10','peakPower','rsi','asymmetry','eccRFD','concImpulse','eccImpulse','contractionTime','jumpVol','avgJumpHt','playerLoad','acuteLoad','chronicLoad'];
  const presentKeys=new Set(metricKeys.filter(k=>colIdx[k]!==null));
  if(colIdx.pos!==null) presentKeys.add('pos');
  if(colIdx.yr!==null) presentKeys.add('yr');
  if(colIdx.age!==null) presentKeys.add('age');
  processRows._presentKeys=presentKeys;

  const athletes=data.map((row,ri)=>{
    const name=colIdx.name!==null?row[colIdx.name]?.trim():'';if(!name)return null;
    const get=(f,def)=>colIdx[f]!==null&&row[colIdx[f]]!==undefined?row[colIdx[f]].trim():def;
    const num=(f)=>{const v=parseFloat(get(f,''));return isNaN(v)?null:v;};

    // Position: use from CSV if present, otherwise try to match to existing athlete, else default OH
    const hasPos=colIdx.pos!==null;
    const rawPos=hasPos?get('pos',''):'';
    let pos='OH';
    if(hasPos&&rawPos){
      pos=context.api.POSITIONS.includes(rawPos)?rawPos:(context.api.POSITIONS.find(p=>rawPos.toLowerCase().includes(p.toLowerCase()))||'OH');
    } else {
      // Try to find existing athlete by name for their position
      const existing=context.api.findBestMatch(name);
      if(existing) pos=existing.athlete.pos;
    }

    const n=context.api.NORMS[pos];
    let cmj=num('cmjHeight');
    if(cmj!==null&&src==='vald'){const h=colIdx.cmjHeight!==null?headers[colIdx.cmjHeight]:'';if((h.includes('cm')||cmj>35))cmj=parseFloat((cmj/2.54).toFixed(1));}
    let avgJH=num('avgJumpHt');
    if(avgJH!==null&&avgJH>30)avgJH=parseFloat((avgJH/2.54).toFixed(1));
    // Peak power: auto-convert W/kg → W if header indicates relative or value is suspiciously low (<200W)
    let pp=num('peakPower');
    if(pp!==null){
      const ph=colIdx.peakPower!==null?headers[colIdx.peakPower]:'';
      const isRelative=ph.includes('w/kg')||ph.includes('relative')||ph.includes('/kg');
      if(isRelative||pp<200){
        // Multiply by athlete bodyweight if available, otherwise use 70kg female VB default
        const bw=parseFloat(get('weight',''))||parseFloat(get('bodyweight',''))||70;
        pp=Math.round(pp*bw);
      }
    }
    const a={
      id:Date.now()+ri,name,initials:(name.split(' ')[0][0]||'?')+(name.split(' ')[1]?.[0]||''),
      pos,yr:get('yr','Jr'),age:parseInt(get('age','20'))||20,av:context.api.avCls(ri),
      _hasPos:hasPos,  // flag for smart match
      // NOTE: previously any metric missing from the import file was silently
      // fabricated with a random plausible-looking number (rndf/rnd within
      // the position's norm range). That's exactly the kind of fake data that
      // caused hours of confusion earlier (10-yd sprint, approach jump, etc.)
      // — a genuinely untested athlete should show blank, not a made-up stat.
      approachJump:num('approachJump'),
      cmjHeight:cmj,
      standVert:num('standVert'),
      sprint10:num('sprint10'),
      peakPower:pp,
      rsi:num('rsi'),
      asymmetry:num('asymmetry'),
      eccRFD:num('eccRFD'),
      concImpulse:num('concImpulse'),
      eccImpulse:num('eccImpulse'),
      contractionTime:num('contractionTime'),
      jumpVol:num('jumpVol'),
      avgJumpHt:avgJH,
      playerLoad:num('playerLoad'),
      acuteLoad:num('acuteLoad'),
      chronicLoad:num('chronicLoad'),
    };
    a.acwr=context.api.calcACWR(a);a.composite=context.api.calcCompositeVB(a);a.tier=context.api.calcTier(a.composite);
    a.trend=context.api.TEST_BLOCKS.map(()=>Math.max(20,Math.min(100,a.composite+context.api.rnd(-14,14))));
    a.trend[a.trend.length-1]=a.composite;
    return a;
  }).filter(Boolean);
  parsedData=athletes;
  showMappingPreview(mapInfo,athletes);
}

// Teambuildr exercise name → local metric key
// Reference: originals/volleyball.html:4296
const TB_EX_MAP = {
  'vertical jump':   'standVert',
  'barbell back squat': 'backSquatMax',
  'back squat':      'backSquatMax',
  'trap bar deadlift':'trapBarMax',
  'trap bar':        'trapBarMax',
  'front squat':     'frontSquatMax',
  'barbell bench press':'benchMax',
  'bench press':     'benchMax',
  'hang clean':      'hangCleanMax',
  '10y sprint':      'sprint10',
  '10-yd sprint':    'sprint10',
  '10 yd sprint':    'sprint10',
  '10 yard sprint':  'sprint10',
  '10yd sprint':     'sprint10',
};

// Metrics where a LOWER value is the better/all-time-best result (e.g. sprint times).
// Everything else in TB_EX_MAP is "bigger is better" (squat/bench/vert), which is
// the default assumption below.
// Reference: originals/volleyball.html:4315
const TB_LOWER_IS_BETTER = new Set(['sprint10']);


// Reference: originals/volleyball.html:4317
function processTB(headers, rows){
  // Detect comparison report: headers are Name, Exercise, Date, Max, Unit, [Date, Max, Change]...
  const isComparisonReport =
    headers[0]==='name' &&
    headers[1]==='exercise' &&
    headers[2]==='date' &&
    headers[3]==='max';

  if(isComparisonReport){
    processTBComparison(headers, rows);
  } else if(headers.some(h=>['athlete','name','athlete name'].includes(h)) &&
            headers.some(h=>['exercise','exercise name','lift'].includes(h))){
    processTBLegacy(headers, rows);
  } else {
    setDZState('idle');
    showMsg('csv-msgs','err',
      'Teambuildr format not recognized. Expected a Comparison Report CSV with columns: Name, Exercise, Date, Max, Unit...');
  }
}


// Reference: originals/volleyball.html:4337
function processTBComparison(headers, rows){
  // Format: Name | Exercise | Date | Max | Unit | [Date | Max | Change] × N
  // Athlete name appears on first exercise row; subsequent exercises have empty Name cell.
  // Goal: extract all-time max per exercise per athlete.
  let currentAthlete = null;
  const athleteMap = {}; // canonicalName → {standVert, backSquatMax, ...}

  for(const row of rows){
    const rawName = (row[0]||'').trim();
    if(rawName) currentAthlete = rawName;
    if(!currentAthlete) continue;

    const exercise = (row[1]||'').trim().toLowerCase();
    if(!exercise) continue;

    // Find which local metric this exercise maps to
    let metricKey = null;
    for(const [tbName, key] of Object.entries(TB_EX_MAP)){
      if(exercise===tbName || exercise.includes(tbName)) { metricKey=key; break; }
    }
    if(!metricKey) continue;

    // Unit column (index 4) tells us lbs vs inches
    const unit = (row[4]||'').trim().toLowerCase();

    // Collect all valid (date, max) pairs across all columns
    // Col 2=date, 3=max for first; then cols i,i+1 for i=5,8,11... for subsequent
    const allEntries = []; // [{date, val}]
    const parseDate = (d) => {
      if(!d||d==='-') return null;
      const m = d.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
      if(!m) return null;
      let [,mo,dy,yr]=m; if(yr.length===2) yr='20'+yr;
      return `${yr}-${String(mo).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
    };
    const addEntry = (dateStr, valStr) => {
      const n=parseFloat(valStr); if(isNaN(n)||n<=0) return;
      allEntries.push({date: parseDate(dateStr), val: n});
    };
    addEntry(row[2], row[3]); // first entry: date col2, max col3
    for(let i=5; i<row.length-1; i+=3){
      addEntry(row[i], row[i+1]);
    }
    if(!athleteMap[currentAthlete]) athleteMap[currentAthlete] = {name: currentAthlete};
    if(!allEntries.length){
      // This athlete has a row for this exercise, but every date column is
      // "-" (no valid attempt on file). For sprint10 specifically, explicitly
      // clear the field rather than silently skipping — skipping left old
      // placeholder values sitting untouched even when the file clearly
      // shows "no data here." Other lifts (squat/bench/etc.) keep the old
      // skip-if-empty behavior, since a missing entry there is more likely
      // "not tested in this date window" than "no real max exists."
      if(metricKey==='sprint10') athleteMap[currentAthlete][metricKey] = null;
      continue;
    }

    // Find all-time best and the date it was achieved. For most lifts/jumps,
    // "best" = highest number. For time-based metrics like the 10-yd sprint,
    // "best" = lowest number (fastest) — inverted below, or every sprint
    // import would report someone's SLOWEST time as their best.
    const best = TB_LOWER_IS_BETTER.has(metricKey)
      ? allEntries.reduce((b,e)=>e.val<b.val?e:b, allEntries[0])
      : allEntries.reduce((b,e)=>e.val>b.val?e:b, allEntries[0]);
    const allTimeMax = best.val;
    const allTimeMaxDate = best.date; // ISO date string or null

    // Date key for this metric
    const dateKey = {
      standVert:'standVertDate', backSquatMax:'backSquatMaxDate',
      trapBarMax:'trapBarMaxDate', frontSquatMax:'frontSquatMaxDate',
      benchMax:'benchMaxDate', hangCleanMax:'hangCleanMaxDate',
      sprint10:'sprint10Date',
    }[metricKey];

    if(!athleteMap[currentAthlete]) athleteMap[currentAthlete] = {name: currentAthlete};
    athleteMap[currentAthlete][metricKey] = allTimeMax;
    if(dateKey && allTimeMaxDate) athleteMap[currentAthlete][dateKey] = allTimeMaxDate;
  }
  if(!Object.keys(athleteMap).length){
    setDZState('idle');
    showMsg('csv-msgs','err','No data found. Make sure you selected the Teambuildr source tab and uploaded a Comparison Report CSV.');
    return;
  }

  // Build athlete update objects — use Smart Match to find canonical names
  const updates = [];
  const unmatched = [];
  const matched = [];
  const presentKeys = new Set(['standVert','backSquatMax','trapBarMax','frontSquatMax','benchMax','hangCleanMax','sprint10',
    'standVertDate','backSquatMaxDate','trapBarMaxDate','frontSquatMaxDate','benchMaxDate','hangCleanMaxDate','sprint10Date']);

  for(const [rawName, data] of Object.entries(athleteMap)){
    const match = context.api.findBestMatch(rawName);
    if(match && match.matchType !== 'ambiguous-last-name'){
      const canonicalName = match.athlete._canonicalName || match.athlete.name;
      matched.push({raw: rawName, canonical: canonicalName});
      updates.push({...data, name: canonicalName, _matchedId: match.athlete.id});
    } else {
      unmatched.push(rawName);
      updates.push({...data, name: rawName}); // will be added as new if needed
    }
  }

  parsedData = updates;
  processRows._presentKeys = presentKeys;
  processRows._isTBComparison = true;
  setDZState('ready');

  const fname = readFile._lastName||'teambuildr.csv';
  document.getElementById('dz-file-name').textContent = '✓ '+fname+' (Teambuildr comparison report)';
  document.getElementById('dz-athlete-count').textContent =
    `${updates.length} athletes · ${matched.length} matched to roster`+
    (unmatched.length ? ` · ${unmatched.length} unmatched` : '');

  // Preview table
  const previewCols = ['name','standVert','backSquatMax','trapBarMax','frontSquatMax','benchMax','hangCleanMax','sprint10'];
  const previewLabels = ['Athlete','Vert (in)','Back Squat','Trap Bar','Front Squat','Bench','Hang Clean','10-yd (s)'];
  let msgs = '';
  if(unmatched.length)
    msgs += `<div class="warn">${unmatched.length} unmatched: ${unmatched.slice(0,5).join(', ')}${unmatched.length>5?'...':''}. Will be added as new athletes.</div>`;
  if(matched.find(m=>m.raw!==m.canonical))
    msgs += `<div class="ok">Name variants auto-matched: ${matched.filter(m=>m.raw!==m.canonical).slice(0,3).map(m=>`${m.raw} → ${m.canonical}`).join(', ')}</div>`;

  document.getElementById('col-map-tbl').innerHTML =
    `<div class="ok">Teambuildr Comparison Report detected · ${updates.length} athletes · all-time maxes</div>${msgs}`;
  document.getElementById('csv-data-prev').innerHTML =
    `<table class="prev-tbl"><thead><tr>${previewLabels.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>`+
    updates.slice(0,8).map(a=>`<tr>${previewCols.map(k=>`<td>${a[k]!==undefined?a[k]:'—'}</td>`).join('')}</tr>`).join('')+
    `</tbody></table>`+
    (updates.length>8?`<div style="font-size:9px;color:var(--text3);margin-top:6px;">... +${updates.length-8} more</div>`:'');
}


// Reference: originals/volleyball.html:4469
function processTBLegacy(headers, rows){
  // Original row-per-exercise format fallback
  const ni=headers.findIndex(h=>['athlete','name','athlete name'].includes(h));
  const ei=headers.findIndex(h=>['exercise','exercise name','lift','movement'].includes(h));
  const mi=headers.findIndex(h=>['max','1rm','weight','max weight','value','result'].includes(h));
  if(ni<0||ei<0||mi<0){showMsg('csv-msgs','err','Teambuildr format not recognized. Expected Comparison Report or row-per-exercise format.');return;}
  const map={};
  rows.forEach(row=>{
    const nm=row[ni]?.trim();if(!nm)return;
    if(!map[nm])map[nm]={name:nm};
    const ex=(row[ei]||'').toLowerCase().trim();
    const val=parseFloat(row[mi]);if(isNaN(val))return;
    for(const [tbName,key] of Object.entries(TB_EX_MAP)){
      if(ex===tbName||ex.includes(tbName)){
        if(!map[nm][key]||val>map[nm][key]) map[nm][key]=val; // keep max
        break;
      }
    }
  });
  const presentKeys=new Set(Object.values(TB_EX_MAP));
  const updates=Object.values(map).map(a=>{
    const match=context.api.findBestMatch(a.name);
    if(match) a._matchedId=match.athlete.id;
    return a;
  });
  parsedData=updates;
  processRows._presentKeys=presentKeys;
  processRows._isTBComparison=true;
  setDZState('ready');
  const fname=readFile._lastName||'teambuildr.csv';
  document.getElementById('dz-file-name').textContent='✓ '+fname+' (Teambuildr)';
  document.getElementById('dz-athlete-count').textContent=updates.length+' athletes';
  showDataPreview(updates);
}


// Reference: originals/volleyball.html:4504
function showMappingPreview(mapInfo,athletes){
  parsedData=athletes;
  setDZState('ready');
  const fname=readFile._lastName||'file.csv';
  document.getElementById('dz-file-name').textContent='✓ '+fname;

  // Build status line
  const hasPos=athletes.some(a=>a._hasPos);
  const matchedCount=athletes.filter(a=>context.api.findBestMatch(a.name)).length;
  let statusLine=athletes.length+' athlete'+(athletes.length!==1?'s':'')+' parsed';
  if(!hasPos) statusLine+=' · no position column detected';
  if(context.api.ATHLETES.length>0) statusLine+=` · ${matchedCount} match existing roster`;
  document.getElementById('dz-athlete-count').textContent=statusLine;

  // Missing position notice
  const msgs=document.getElementById('csv-msgs');
  let notices='';
  if(!hasPos&&context.api.ATHLETES.length>0) notices+=`<div class="warn">No position column found — positions will be inherited from matching roster athletes. Use Smart Match &amp; Update to layer in this data.</div>`;
  else if(!hasPos) notices+=`<div class="warn">No position column — athletes will default to OH. Add a "Position" column or use Smart Match after uploading your roster.</div>`;
  if(notices) msgs.innerHTML=notices;

  // Column mapping
  document.getElementById('col-map-tbl').innerHTML=`<table class="map-tbl"><thead><tr><th>Field</th><th>CSV Column Detected</th><th>Status</th></tr></thead><tbody>${mapInfo.map(m=>`<tr><td>${m.field}</td><td class="${m.found?'mc':'sk'}">${m.found||'—'}</td><td class="${m.found?'mc':m.field==='name'?'req':'sk'}">${m.found?'✓ Mapped':m.field==='name'?'⚠ REQUIRED':'– Skipped'}</td></tr>`).join('')}</tbody></table>`;
  showDataPreview(athletes);
}


// Reference: originals/volleyball.html:4530
function showDataPreview(athletes){
  const prev=athletes.slice(0,4);
  const cols=['name','pos','approachJump','cmjHeight','peakPower','rsi','asymmetry','jumpVol','composite','tier'];
  const hdrs=['Name','Pos','App Jmp','CMJ','Pk Pwr','RSI','Asym%','Jmp Vol','Score','Tier'];
  document.getElementById('csv-data-prev').innerHTML=`<div style="font-size:9px;color:var(--text3);font-family:var(--fm);letter-spacing:1px;margin-bottom:6px;">PREVIEW (${Math.min(4,athletes.length)} of ${athletes.length} athletes)</div><table class="prev-tbl"><thead><tr>${hdrs.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${prev.map(a=>`<tr>${cols.map(k=>`<td>${typeof a[k]==='number'&&!Number.isInteger(a[k])?a[k].toFixed(2):a[k]}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}


// Reference: originals/volleyball.html:4537
function showMsg(el,type,txt){const d=document.getElementById(el);if(d)d.innerHTML=`<div class="${type}">${txt}</div>`;}

// ── Kinexon same-day session merging ─────────────────────────────
// If an athlete already has a Kinexon row for a given date and a new
// import brings in another session for that same date, we SUM the two
// (rather than silently overwriting one with the other) and surface it.
// Reference: originals/volleyball.html:4543
const fmtAccel=v=>v==null?'0':(Number(v).toFixed?Number(v).toFixed(1):v);


// Reference: originals/volleyball.html:4544
function mergeKinexonSessions(oldRow,newRow){
  const merged={...newRow};
  const sumKeys=['jumps_total','jumps_low','jumps_mid','jumps_high','accel_load','session_duration_min'];
  for(const k of sumKeys){
    const a=oldRow[k],b=newRow[k];
    merged[k]=(a==null&&b==null)?null:(a==null?0:Number(a))+(b==null?0:Number(b));
  }
  if(merged.session_duration_min>0){
    merged.jumps_per_min=merged.jumps_total!=null?parseFloat((merged.jumps_total/merged.session_duration_min).toFixed(2)):null;
    merged.accel_load_per_min=merged.accel_load!=null?parseFloat((merged.accel_load/merged.session_duration_min).toFixed(2)):null;
  } else {
    merged.jumps_per_min=newRow.jumps_per_min??oldRow.jumps_per_min??null;
    merged.accel_load_per_min=newRow.accel_load_per_min??oldRow.accel_load_per_min??null;
  }
  merged.session_type=(oldRow.session_type&&newRow.session_type&&oldRow.session_type!==newRow.session_type)
    ?`${oldRow.session_type} + ${newRow.session_type}`
    :(newRow.session_type||oldRow.session_type||null);
  return merged;
}

// Preview-stage advisory: warn (before commit) when an athlete/date pair
// in the file being previewed already has a saved Kinexon session, so the
// coach knows totals will be combined rather than replaced.
// Reference: originals/volleyball.html:4567
async function warnKinexonCollisions(entries){
  kinexonCollisionDetected=false;
  if(!context.api.sb||!context.api.currentUser||!entries.length) return;
  const dates=[...new Set(entries.map(e=>e.date))];
  let existing=[];
  try{
    // Pull ALL kinexon rows for these dates (not name-filtered server-side) and
    // match client-side with normName() — an exact-string .in('athlete_name',...)
    // misses rows saved under a different spelling/spacing/case, the same gap
    // that let the MB rows silently dodge this warning before.
    const {data,error}=await context.api.sb.from('test_sessions')
      .select('athlete_name,test_date,jumps_total,accel_load')
      .in('test_date',dates).not('jumps_total','is',null);
    if(error||!data) return;
    existing=data;
  }catch(e){return;}
  if(!existing.length) return;
  const collisions=entries.filter(e=>existing.some(r=>context.api.normName(r.athlete_name)===context.api.normName(e.canonicalName||e.name)&&r.test_date===e.date));
  if(!collisions.length) return;
  kinexonCollisionDetected=true;
  const rows=collisions.map(e=>{
    const prev=existing.find(r=>context.api.normName(r.athlete_name)===context.api.normName(e.canonicalName||e.name)&&r.test_date===e.date);
    return `<div>${e.canonicalName||e.name} — ${context.api.fmtDate(e.date)||e.date}: existing ${prev.jumps_total??0} jumps`+
      `${prev.accel_load!=null?` / ${fmtAccel(prev.accel_load)} accel`:''} vs. this file's ${e.jumps_total??0} jumps`+
      `${e.accel_load!=null?` / ${fmtAccel(e.accel_load)} accel`:''}</div>`;
  }).join('');
  const msgs=document.getElementById('csv-msgs');
  if(msgs) msgs.innerHTML+=`<div class="warn">`+
    `<b>⚠ ${collisions.length} athlete/date pair${collisions.length!==1?'s':''} already ${collisions.length!==1?'have':'has'} a Kinexon session logged for that day.</b> `+
    `<div style="margin-top:6px;font-family:var(--fm);font-size:11px;line-height:1.5;">${rows}</div>`+
    `<div style="margin-top:10px;padding:10px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--r);">`+
    `<div style="font-size:11px;margin-bottom:8px;"><b>Choose how to handle this before importing — required:</b></div>`+
    `<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:11px;line-height:1.4;margin-bottom:8px;">`+
    `<input type="radio" name="kinexon-collision-choice" id="kinexon-mode-sum" style="margin-top:2px;">`+
    `<span>This is a genuinely <b>separate second session</b> that day (e.g. lift + practice) — <b>sum</b> it with what's already saved.</span>`+
    `</label>`+
    `<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:11px;line-height:1.4;">`+
    `<input type="radio" name="kinexon-collision-choice" id="kinexon-mode-replace" style="margin-top:2px;">`+
    `<span>This file is a <b>correction</b> — <b>replace</b> the existing totals with this file's numbers (use this to undo duplicate/bad imports).</span>`+
    `</label></div></div>`;
}

// Preview-stage advisory: flag current roster athletes who simply have NO
// row at all in the file being imported, so a coach isn't left guessing
// whether "no data" means a real gap (sensor not worn, didn't participate)
// or a silent matching failure.
// Reference: originals/volleyball.html:4613
function warnRosterAthletesMissingFromFile(entries){
  const foundNames=new Set(entries.map(e=>context.api.normName(e.canonicalName||e.name)));
  const missing=context.api.rosterAthletes().filter(a=>!foundNames.has(context.api.normName(a._canonicalName||a.name)));
  const msgs=document.getElementById('csv-msgs');
  if(!msgs||!missing.length) return;
  msgs.innerHTML+=`<div class="warn"><b>⚠ ${missing.length} roster athlete${missing.length!==1?'s':''} not found in this file:</b> `+
    `${missing.map(a=>`${a._canonicalName||a.name} (${a.pos})`).join(', ')}. `+
    `Their existing data will be left as-is — this file simply has no rows for them (not necessarily an error, but confirm they weren't tracked before assuming their totals are complete).</div>`;
}

// ── Core deduplication engine ────────────────────────────────────
// Every import path runs through this. For each incoming athlete:
//   - If a matching name exists → merge (update only present keys, keep rest)
//   - If no match → add as new
// Returns {updated, added} counts.
// Reference: originals/volleyball.html:4627
function smartMergeInto(incoming, presentKeys, fname){
  let updated=0, added=0;
  const stamped=incoming.map(a=>context.api.logSource({...a},fname,presentKeys));
  for(const a of stamped){
    const match=context.api.findBestMatch(a.name);
    if(match&&match.matchType!=='ambiguous-last-name'){
      const idx=context.api.ATHLETES.findIndex(x=>x.id===match.athlete.id);
      if(idx>=0){
        context.api.ATHLETES[idx]=context.api.mergeAthleteRecords(context.api.ATHLETES[idx],a,presentKeys,fname);
        updated++;
      }
    } else if(!match){
      const mx=context.api.ATHLETES.reduce((m,x)=>Math.max(m,x.id),-1);
      // Set canonical name on first entry
      context.api.ATHLETES.push({...a,id:mx+1,_canonicalName:a.name,_nameLocked:false});
      added++;
    }
    // ambiguous-last-name: skip silently (commitSmartMatch shows it for review)
  }
  return {updated,added};
}


// Reference: originals/volleyball.html:4649
async function commitCSV(replace){
  if(!parsedData||!parsedData.length){
    showMsg('csv-msgs','err','No data parsed yet — upload a CSV file first.');return;
  }

  // Kinexon per-athlete import
  if(processRows._isKinexonImport){
    // Guard against double-click / double-submit: without this, clicking either
    // commit button twice (or both) re-runs the whole import and double/triple-sums
    // every session, which is what caused the tripled totals.
    if(kinexonCommitLock){
      context.api.toast('Import already in progress — please wait.');
      return;
    }
    kinexonCommitLock=true;
    const replaceBtn=document.getElementById('commit-replace-btn'),updateBtn=document.getElementById('commit-update-btn');

    // A same-day collision was flagged in preview — refuse to guess. The coach
    // must explicitly pick sum vs. replace; this is what previously defaulted
    // silently to "sum" and caused totals to be repeatedly added on top of
    // already-inflated data.
    if(kinexonCollisionDetected){
      const sumChosen=document.getElementById('kinexon-mode-sum')?.checked;
      const replaceChosen=document.getElementById('kinexon-mode-replace')?.checked;
      if(!sumChosen&&!replaceChosen){
        kinexonCommitLock=false;
        showMsg('csv-msgs','err','⚠ Please choose "sum" or "replace" above before importing — a session already exists for one or more of these athlete/date pairs.');
        return;
      }
    }
    [replaceBtn,updateBtn].forEach(b=>{if(b){b.disabled=true;b.style.opacity='0.5';b.style.pointerEvents='none';}});

    const isEventLevel=processRows._kinexonEventLevel;
    const sessions=processRows._kinexonSessions||[];
    console.log('Kinexon commit: isEventLevel=',isEventLevel,'sessions=',sessions.length,'sb=',!!context.api.sb,'user=',!!context.api.currentUser);
    let sessionRows=[];

    if(isEventLevel){
      // Event-level: all athletes already matched, canonicalName on each entry
      sessionRows=sessions.map(e=>({
        athlete_name:        e.canonicalName||e.name,
        test_date:           e.date,
        session_type:        'Match',
        test_type:           'kinexon',
        jumps_total:         e.jumps_total||null,
        jumps_low:           e.jumps_low||null,
        jumps_mid:           e.jumps_mid||null,
        jumps_high:          e.jumps_high||null,
        accel_load:          e.accel_load>0?parseFloat(e.accel_load.toFixed(2)):null,
        accel_load_per_min:  e.accel_load_per_min||null,
        jumps_per_min:       e.jumps_per_min||null,
        session_duration_min:e.session_duration_min||null,
      }));
    } else {
      // Summary: single athlete selected from dropdown
      const sel=document.getElementById('kinexon-athlete-sel');
      const athleteId=sel?parseInt(sel.value):null;
      if(!athleteId){
        showMsg('csv-msgs','err','Please select an athlete for this Kinexon file before importing.');
        return;
      }
      const athlete=context.api.ATHLETES.find(a=>a.id===athleteId);
      if(!athlete){showMsg('csv-msgs','err','Athlete not found.');return;}
      const canonicalName=athlete._canonicalName||athlete.name;
      sessionRows=sessions.map(s=>({
        athlete_name: canonicalName,
        test_date:    s.test_date,
        session_type: s.session_type,
        test_type:    'kinexon',
        jumps_total:  s.jumps_total,
        jumps_low:    s.jumps_low,
        jumps_mid:    s.jumps_mid,
        jumps_high:   s.jumps_high,
      }));
    }

    context.api.setSyncStatus('syncing','SAVING SESSIONS');
    let saved=0, skipped=0;
    const merges=[]; // athlete/date pairs where an existing session was SUMMED with this import (Update mode)
    const overwrites=[]; // athlete/date pairs where an existing session was REPLACED outright (Replace mode)
    const failures=[]; // surfaced to the UI, not just the console, so a non-dev can see why a row failed
    if(context.api.sb&&context.api.currentUser){
      try{
        console.log('Saving',sessionRows.length,'session rows, first:',JSON.stringify(sessionRows[0]));
        // Pull every Kinexon row already saved for the dates in this file ONCE,
        // then match by normalized name client-side (same normName() the rest of
        // the app uses for roster matching) instead of an exact-string .eq() on
        // athlete_name. An exact-string match misses rows saved under a slightly
        // different spelling/spacing/case, which is exactly what caused delete to
        // silently remove 0 rows and the subsequent insert to violate the
        // "test_sessions_kin_uq" unique constraint for the MBs.
        const datesInFile=[...new Set(sessionRows.map(r=>r.test_date))];
        let existingByDate=[];
        try{
          const {data,error}=await context.api.sb.from('test_sessions').select('*')
            .in('test_date',datesInFile).not('jumps_total','is',null);
          if(error) console.warn('Bulk existing-session lookup failed:',error.message);
          existingByDate=data||[];
        }catch(e){console.warn('Bulk existing-session lookup threw:',e.message);}

        for(const row of sessionRows){
          // Decision is driven by the explicit "sum" vs "replace" radio choice
          // shown in the collision warning — NOT by which of the two generic
          // commit buttons was clicked (that ambiguity is what caused repeated
          // accidental double-summing).
          const forceReplace=document.getElementById('kinexon-mode-replace')?.checked||false;
          const rowNorm=context.api.normName(row.athlete_name);
          const existingMatches=existingByDate.filter(r=>r.test_date===row.test_date&&context.api.normName(r.athlete_name)===rowNorm);

          let finalRow=row;
          if(existingMatches.length&&!forceReplace){
            const prev=existingMatches[0];
            finalRow=mergeKinexonSessions(prev,row);
            merges.push({
              athlete:row.athlete_name, date:row.test_date,
              prevJumps:prev.jumps_total, newJumps:row.jumps_total, totalJumps:finalRow.jumps_total,
              prevAccel:prev.accel_load, newAccel:row.accel_load, totalAccel:finalRow.accel_load,
            });
          } else if(existingMatches.length&&forceReplace){
            overwrites.push({
              athlete:row.athlete_name, date:row.test_date,
              prevJumps:existingMatches[0].jumps_total, newJumps:row.jumps_total,
              prevAccel:existingMatches[0].accel_load, newAccel:row.accel_load,
            });
          }

          // Delete every matched row BY ID (handles the case where the same
          // athlete somehow ended up saved under more than one name spelling
          // for this date — a plain name+date delete would only catch one).
          let deleteFailed=false;
          for(const m of existingMatches){
            if(m.id==null) continue;
            const {error:delErr}=await context.api.sb.from('test_sessions').delete().eq('id', m.id);
            if(delErr){
              console.warn('Delete error:',delErr.message);
              failures.push({athlete:row.athlete_name,date:row.test_date,stage:'delete',error:delErr.message});
              deleteFailed=true;
            }
          }
          if(deleteFailed) continue; // don't attempt insert if we couldn't clear the old row(s) — it would just collide again

          // Insert fresh (merged totals if a same-day session already existed)
          const {data:insData, error:insErr}=await context.api.sb.from('test_sessions').insert(finalRow).select();
          if(!insErr&&insData){
            saved++;
          } else if(insErr){
            console.warn('Insert failed:',insErr.message,'row:',JSON.stringify(finalRow));
            failures.push({athlete:row.athlete_name,date:row.test_date,stage:'insert',error:insErr.message});
            skipped++;
          }
        }
        const athletes=[...new Set(sessionRows.map(r=>r.athlete_name))];
        context.api.toast(`✓ ${saved} Kinexon sessions saved · ${athletes.length} athlete${athletes.length!==1?'s':''}`+
          `${merges.length?` · ${merges.length} same-day session${merges.length!==1?'s':''} summed`:''}`+
          `${overwrites.length?` · ${overwrites.length} corrected/overwritten`:''}`+
          `${skipped?` · ${skipped} failed`:''}`);
        if(skipped>0) console.error(`${skipped} sessions failed to save — check console for details`);

        let msgHtml='';
        if(overwrites.length){
          const rows=overwrites.map(o=>
            `<div>${o.athlete} — ${context.api.fmtDate(o.date)||o.date}: `+
            `jumps ${o.prevJumps??0} → <b>${o.newJumps??0}</b>`+
            ((o.prevAccel!=null||o.newAccel!=null)
              ?` · accel load ${fmtAccel(o.prevAccel)} → <b>${fmtAccel(o.newAccel)}</b>`
              :'')+
            `</div>`
          ).join('');
          msgHtml+=`<div><b>✓ ${overwrites.length} existing session${overwrites.length!==1?'s':''} replaced</b> (Replace mode — old totals discarded, this file's numbers are now the record):`+
            `<div style="margin-top:6px;font-family:var(--fm);font-size:11px;line-height:1.6;">${rows}</div></div>`;
        }
        if(merges.length){
          const rows=merges.map(m=>
            `<div>${m.athlete} — ${context.api.fmtDate(m.date)||m.date}: `+
            `jumps ${m.prevJumps??0} + ${m.newJumps??0} = <b>${m.totalJumps??0}</b>`+
            ((m.prevAccel!=null||m.newAccel!=null)
              ?` · accel load ${fmtAccel(m.prevAccel)} + ${fmtAccel(m.newAccel)} = <b>${fmtAccel(m.totalAccel)}</b>`
              :'')+
            `</div>`
          ).join('');
          msgHtml+=`<div style="${overwrites.length?'margin-top:10px;':''}"><b>⚠ Multiple Kinexon sessions detected on the same day.</b> `+
            `An existing session already existed for these athlete/date pairs, so totals were <b>summed</b> rather than overwritten (Update mode):`+
            `<div style="margin-top:6px;font-family:var(--fm);font-size:11px;line-height:1.6;">${rows}</div>`+
            `<div style="margin-top:6px;color:var(--text3);">If these were actually duplicate imports of the same session, use REPLACE FULL ROSTER instead to correct them, rather than importing again in Update mode.</div></div>`;
        }
        if(failures.length){
          const rows=failures.map(f=>
            `<div>${f.athlete} — ${context.api.fmtDate(f.date)||f.date} <span style="color:var(--text3);">(${f.stage})</span>: ${f.error}</div>`
          ).join('');
          msgHtml+=`<div style="${(overwrites.length||merges.length)?'margin-top:10px;':''}"><b>✗ ${failures.length} session${failures.length!==1?'s':''} failed to save.</b> Exact error(s) reported by the database:`+
            `<div style="margin-top:6px;font-family:var(--fm);font-size:11px;line-height:1.6;color:var(--red);">${rows}</div>`+
            `<div style="margin-top:6px;color:var(--text3);">If these mention a permissions/policy issue, an admin may need to check row-level security rules on test_sessions for these specific rows.</div></div>`;
        }
        if(msgHtml) showMsg('csv-msgs','warn',msgHtml);
      } catch(e){context.api.toast('⚠ Save failed: '+e.message); console.error('Kinexon save error:',e);}
    } else {
      console.warn('Kinexon save: no Supabase connection or not logged in');
    }
    parsedData=null;
    processRows._isKinexonImport=false;
    processRows._kinexonSessions=null;
    processRows._kinexonEventLevel=false;
    context.api.setSyncStatus('online','SYNCED');
    kinexonCommitLock=false;
    [replaceBtn,updateBtn].forEach(b=>{if(b){b.disabled=false;b.style.opacity='1';b.style.pointerEvents='';}});
    // If we merged or overwrote same-day sessions, keep the import panel open so the coach
    // can actually read the summary before it disappears behind a nav.
    if(merges.length||overwrites.length||failures.length){
      document.getElementById('dz-file-name').textContent='';
      document.getElementById('dz-athlete-count').textContent='';
      document.getElementById('csv-data-prev').innerHTML='';
    } else {
      closeImport();
      context.navigate('workload');
    }
    return;
  }

  // Session-style import: save to test_sessions table, no athlete record changes
  if(processRows._isSessionImport){
    const count=parsedData.length;
    context.api.setSyncStatus('syncing','SAVING SESSIONS');
    const saved=await context.api.saveTestSessions(parsedData);
    parsedData=null;
    processRows._isSessionImport=false;
    context.api.setSyncStatus('online','SYNCED');
    closeImport();
    await context.api.loadAllSessions();
    context.refreshFeature('forceplate');
    context.api.toast(`✓ ${saved} of ${count} test sessions saved`);
    return;
  }

  // Approach Vert Testing import: save sessions AND update athlete approachJump (touch height)
  if(processRows._isApproachVertImport){
    const avSessions=parsedData;
    const count=avSessions.length;
    context.api.setSyncStatus('syncing','SAVING APPROACH VERT');

    // Build test_sessions rows
    const sessionRows=avSessions.map(s=>({
      athlete_name: s.athlete_name,
      test_date: s.test_date,
      // NOTE: previously this also wrote to `jump_height` (the same column VALD
      // ForceDecks CMJ data uses), which silently blended two different tests
      // together in the Readiness Hub. Approach vert now gets its own column
      // instead, and jump_height is left untouched by this import entirely.
      approach_vert_inches: s.approach_vert,
      approach_height_inches: s.approach_height_inches, // real touch height, kept separately so future PR-recovery queries compare the right metric
      source_file: s.source_file,
      test_type: 'approach_vert',
    }));
    const saved=await context.api.saveTestSessions(sessionRows);

    // Also update each matched athlete's approachJump (touch height in inches) so
    // leaderboards reflect their ALL-TIME BEST touch, not just whatever this
    // particular file's most recent test happened to be. First collapse this
    // file down to each athlete's single best entry (a file can contain
    // multiple test dates for the same athlete), then only overwrite the
    // athlete's stored value if that best is actually higher than what's on
    // record — a lower/average test result should never erase a real PR.
    const bestByAthlete = {}; // normName → {athlete_name, approach_height_inches, approach_height_feet, source_file}
    for(const s of avSessions){
      if(s.approach_height_inches===null) continue;
      const key=context.api.normName(s.athlete_name);
      if(!bestByAthlete[key] || s.approach_height_inches>bestByAthlete[key].approach_height_inches){
        bestByAthlete[key]=s;
      }
    }

    let athletesUpdated=0;
    let athletesAdded=0;
    let athletesSkippedNotPR=0;
    for(const s of Object.values(bestByAthlete)){
      const existing=context.api.ATHLETES.find(a=>context.api.normName(a._canonicalName||a.name)===context.api.normName(s.athlete_name));
      if(existing){
        const isNewPR = existing.approachJump==null || s.approach_height_inches>existing.approachJump;
        if(!isNewPR){ athletesSkippedNotPR++; continue; }
        existing.approachJump=s.approach_height_inches;
        existing._approachFeetDisplay=s.approach_height_feet;
        existing.approachJumpDate=s.test_date||null;
        // Re-stamp source log
        context.api.logSource(existing, s.source_file, new Set(['approachJump']));
        // Recompute composite
        existing.composite=context.api.calcCompositeVB(existing);
        existing.tier=context.api.calcTier(existing.composite);
        context.api.queueSave(existing);
        athletesUpdated++;
      } else if(!replace) {
        // Add as new athlete (touch-only entry; position defaults to OH until Roster Setup confirms)
        const initials=(s.athlete_name.split(' ')[0]?.[0]||'?')+(s.athlete_name.split(' ')[1]?.[0]||'');
        const newAthlete={
          id:context.api.ATHLETES.reduce((m,a)=>Math.max(m,a.id),-1)+1,
          name:s.athlete_name,
          _canonicalName:s.athlete_name,
          initials,
          pos:'OH', yr:'Jr', age:20,
          av:context.api.avCls(context.api.ATHLETES.length%6),
          approachJump:s.approach_height_inches,
          _approachFeetDisplay:s.approach_height_feet,
          composite:50, tier:'Proficient',
          trend:context.api.TEST_BLOCKS.map(()=>50),
          _sources:[],
          _nameLocked:false, _posLocked:false,
        };
        context.api.logSource(newAthlete, s.source_file, new Set(['approachJump']));
        context.api.ATHLETES.push(newAthlete);
        context.api.queueSave(newAthlete);
        athletesAdded++;
      }
    }

    parsedData=null;
    processRows._isApproachVertImport=false;
    context.api.refreshAll();
    context.api.setSyncStatus('online','SYNCED');
    closeImport();
    context.api.postImportPositionCheck();
    if(context.api.unsetCount()===0) context.navigate('dashboard');
    context.api.toast(`✓ ${saved} sessions saved · ${athletesUpdated} new PR${athletesUpdated!==1?'s':''}${athletesSkippedNotPR?` · ${athletesSkippedNotPR} not a PR (kept existing best)`:''}${athletesAdded?` · ${athletesAdded} new added`:''}`);
    return;
  }

  // Teambuildr comparison report: update/merge strength fields only
  if(processRows._isTBComparison){
    const updates=parsedData;
    const presentKeys=processRows._presentKeys||new Set(['standVert','backSquatMax','trapBarMax','frontSquatMax','benchMax','hangCleanMax']);
    const fname=readFile._lastName||'teambuildr.csv';
    let updated=0,added=0;
    for(const u of updates){
      let idx=u._matchedId!==undefined?context.api.ATHLETES.findIndex(a=>a.id===u._matchedId):-1;
      if(idx<0) idx=context.api.ATHLETES.findIndex(a=>context.api.normName(a._canonicalName||a.name)===context.api.normName(u.name));
      if(idx>=0){
        // Only apply — and only LOG as sourced — the keys this athlete actually
        // had a value for in this file. Logging the full static presentKeys
        // regardless of per-athlete presence was inaccurate: an athlete with
        // "–" for an exercise would still get marked as "sourced" for it,
        // making it impossible to later tell a real value from a placeholder.
        const actualKeys=[...presentKeys].filter(k=>u[k]!==undefined);
        for(const k of actualKeys) context.api.ATHLETES[idx][k]=u[k];
        context.api.ATHLETES[idx].composite=context.api.calcCompositeVB(context.api.ATHLETES[idx]);
        context.api.ATHLETES[idx].tier=context.api.calcTier(context.api.ATHLETES[idx].composite);
        if(actualKeys.length) context.api.logSource(context.api.ATHLETES[idx],fname,actualKeys);
        context.api.queueSave(context.api.ATHLETES[idx]);
        updated++;
      } else {
        const nm=u.name,parts=nm.split(' ');
        const newA={
          id:context.api.ATHLETES.reduce((m,a)=>Math.max(m,a.id),-1)+1,
          name:nm,_canonicalName:nm,
          initials:(parts[0]?.[0]||'?')+(parts[parts.length-1]?.[0]||''),
          pos:'OH',yr:'Jr',age:20,av:context.api.avCls(context.api.ATHLETES.length%6),
          _nameLocked:false,_posLocked:false,_sources:[],trend:context.api.TEST_BLOCKS.map(()=>50),
        };
        const actualKeys=[...presentKeys].filter(k=>u[k]!==undefined);
        for(const k of actualKeys) newA[k]=u[k];
        newA.composite=context.api.calcCompositeVB(newA);newA.tier=context.api.calcTier(newA.composite);
        newA.trend[newA.trend.length-1]=newA.composite;
        if(actualKeys.length) context.api.logSource(newA,fname,actualKeys);
        context.api.ATHLETES.push(newA);
        context.api.queueSave(newA);
        added++;
      }
    }
    parsedData=null;
    processRows._isTBComparison=false;
    context.api.refreshAll();closeImport();context.api.postImportPositionCheck();
    if(context.api.unsetCount()===0) context.navigate('dashboard');
    context.api.toast(`✓ Teambuildr: ${updated} updated · ${added} new`);
    return;
  }

  const fname=readFile._lastName||'import.csv';
  const presentKeys=processRows._presentKeys||new Set();
  if(replace){
    context.api.ATHLETES=parsedData.map((a,i)=>context.api.logSource({...a,id:i},fname,presentKeys));
    const count=parsedData.length;
    parsedData=null;
    context.api.refreshAll();closeImport();
    context.api.postImportPositionCheck();
    if(context.api.unsetCount()===0) context.navigate('dashboard');
    context.api.toast(`✓ Replaced roster — ${count} athletes loaded`);
  } else {
    const {updated,added}=smartMergeInto(parsedData,presentKeys,fname);
    parsedData=null;
    context.api.refreshAll();closeImport();
    context.api.postImportPositionCheck();
    if(context.api.unsetCount()===0) context.navigate('dashboard');
    context.api.toast(`✓ ${updated} updated · ${added} new added`);
  }
}


// Reference: originals/volleyball.html:5041
function commitPaste(replace){
  if(!parsedData||!parsedData.length){
    showMsg('paste-msgs','err','No data parsed — click Preview first.');return;
  }
  const fname='paste-'+(new Date().toISOString().slice(0,10))+'.csv';
  const presentKeys=processRows._presentKeys||new Set();
  if(replace){
    context.api.ATHLETES=parsedData.map((a,i)=>context.api.logSource({...a,id:i},fname,presentKeys));
  } else {
    smartMergeInto(parsedData,presentKeys,fname);
  }
  const count=parsedData.length;
  parsedData=null;
  context.api.refreshAll();closeImport();
  context.api.postImportPositionCheck();
  if(context.api.unsetCount()===0) context.navigate('dashboard');
  context.api.toast(`✓ ${replace?'Replaced roster — ':''}${count} athletes processed`);
}


// Reference: originals/volleyball.html:5059
function parsePaste(){
  const txt=document.getElementById('paste-ta').value.trim();
  if(!txt){showMsg('paste-msgs','err','Nothing to parse.');return;}
  const delim=txt.split('\n')[0].includes('\t')?'\t':',';
  const rows=txt.split('\n').filter(l=>l.trim()).map(l=>l.split(delim).map(c=>c.trim().replace(/^"|"$/g,'')));
  if(rows.length<2){showMsg('paste-msgs','err','Need a header row and at least one data row.');return;}
  parsedData=null;
  const src=pasteSrc2;
  if(src==='teambuildr'){processTB(rows[0].map(h=>h.toLowerCase()),rows.slice(1));}
  else{processRows(rows,src);}
  if(parsedData){
    document.getElementById('paste-prev').style.display='block';
    showMsg('paste-msgs','ok',`Parsed ${parsedData.length} athletes — ready to import.`);
    document.getElementById('paste-imp-btn').style.display='';
    document.getElementById('paste-mrg-btn').style.display='';
  }
}


// Reference: originals/volleyball.html:5077
function resetCSVUI(){
  parsedData=null;
  readFile._lastName=null;
  setDZState('idle');
  document.getElementById('csv-input').value='';
  document.getElementById('csv-msgs').innerHTML='';
  document.getElementById('col-map-tbl').innerHTML='';
  document.getElementById('csv-data-prev').innerHTML='';
}


// Reference: originals/volleyball.html:5086
function loadForEdit(){
  const id=document.getElementById('man-edit-sel').value;document.getElementById('man-ok').style.display='none';
  if(!id){clearManual();document.getElementById('man-del-btn').style.display='none';manEditId=null;return;}
  const a=context.api.ATHLETES.find(x=>x.id===parseInt(id));if(!a)return;
  manEditId=a.id;
  const s=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
  s('m-name',a.name);s('m-pos',a.pos);s('m-yr',a.yr);s('m-age',a.age);
  s('m-appr',a.approachJump);s('m-cmj',a.cmjHeight);s('m-vert',a.standVert);s('m-s10',a.sprint10);
  s('m-pp',a.peakPower);s('m-rsi',a.rsi);s('m-asym',a.asymmetry);s('m-rfd',a.eccRFD);s('m-ci',a.concImpulse);s('m-ei',a.eccImpulse);s('m-ct',a.contractionTime);
  s('m-jv',a.jumpVol);s('m-ajh',a.avgJumpHt);s('m-pl',a.playerLoad);s('m-al',a.acuteLoad);s('m-cl',a.chronicLoad);
  document.getElementById('man-del-btn').style.display='';
}


// Reference: originals/volleyball.html:5098
function clearManual(){['m-name','m-pos','m-yr','m-age','m-appr','m-cmj','m-vert','m-s10','m-pp','m-rsi','m-asym','m-rfd','m-ci','m-ei','m-ct','m-jv','m-ajh','m-pl','m-al','m-cl'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});document.getElementById('man-del-btn').style.display='none';document.getElementById('man-ok').style.display='none';document.getElementById('man-msgs').innerHTML='';manEditId=null;}


// Reference: originals/volleyball.html:5099
function submitManual(){
  const name=document.getElementById('m-name').value.trim();
  const pos=document.getElementById('m-pos').value;
  if(!name||!pos){showMsg('man-msgs','err','Name and Position are required.');return;}
  document.getElementById('man-msgs').innerHTML='';
  const gn=(id)=>{const v=parseFloat(document.getElementById(id).value);return isNaN(v)?null:v;};
  const n=context.api.NORMS[pos];
  const a={
    id:manEditId??Date.now(),name,initials:(name.split(' ')[0][0]||'?')+(name.split(' ')[1]?.[0]||''),
    pos,yr:document.getElementById('m-yr').value,age:parseInt(document.getElementById('m-age').value)||20,av:context.api.avCls(context.api.ATHLETES.length%6),
    // NOTE: previously a blank field here got silently fabricated with a
    // random plausible-looking number (rndf/rnd within the position's norm
    // range) instead of staying blank. A newly-added, not-yet-tested athlete
    // should show "—" for what hasn't been tested, not a made-up stat.
    approachJump:gn('m-appr'),
    cmjHeight:gn('m-cmj'),
    standVert:gn('m-vert'),
    sprint10:gn('m-s10'),
    peakPower:gn('m-pp'),
    rsi:gn('m-rsi'),
    asymmetry:gn('m-asym'),
    eccRFD:gn('m-rfd'),
    concImpulse:gn('m-ci'),
    eccImpulse:gn('m-ei'),
    contractionTime:gn('m-ct'),
    jumpVol:gn('m-jv'),
    avgJumpHt:gn('m-ajh'),
    playerLoad:gn('m-pl'),
    acuteLoad:gn('m-al'),
    chronicLoad:gn('m-cl'),
  };
  a.acwr=context.api.calcACWR(a);a.composite=context.api.calcCompositeVB(a);a.tier=context.api.calcTier(a.composite);
  a.trend=context.api.TEST_BLOCKS.map(()=>Math.max(20,Math.min(100,a.composite+context.api.rnd(-12,12))));
  a.trend[a.trend.length-1]=a.composite;
  if(manEditId!==null){const idx=context.api.ATHLETES.findIndex(x=>x.id===manEditId);if(idx>=0)context.api.ATHLETES[idx]=a;else context.api.ATHLETES.push(a);}else context.api.ATHLETES.push(a);
  context.api.refreshAll();
  context.navigate('dashboard');
  const ok=document.getElementById('man-ok');ok.textContent=`✓ ${manEditId!==null?'Updated':'Added'} ${name} successfully.`;ok.style.display='block';
  const sel=document.getElementById('man-edit-sel');sel.innerHTML=context.api.athleteOptions('— new athlete —');
  sel.value=a.id;manEditId=a.id;document.getElementById('man-del-btn').style.display='';
}


// Reference: originals/volleyball.html:5140
function deleteAthlete(){
  if(manEditId===null)return;
  const a=context.api.ATHLETES.find(x=>x.id===manEditId);if(!a)return;
  if(!confirm(`Remove ${a.name}?`))return;
  context.api.ATHLETES=context.api.ATHLETES.filter(x=>x.id!==manEditId);context.api.refreshAll();context.navigate('dashboard');clearManual();
  const sel=document.getElementById('man-edit-sel');sel.innerHTML='<option value="">— new athlete —</option>'+context.api.ATHLETES.map(x=>`<option value="${x.id}">${x.name} (${x.pos})</option>`).join('');
  context.api.toast(`Removed ${a.name}`);
}

// ── Deduplication ────────────────────────────────────────────────
// Merge any duplicate canonical names in ATHLETES in-place.
// For each group sharing the same canonical name: merge all records into one
// (best composite wins numeric values, locked flags are OR'd, sources are combined).
// Reference: originals/volleyball.html:5153
function dedupeATHLETES(){
  const seen = new Map(); // canonical → index in ATHLETES
  const toRemove = new Set();

  for(let i=0;i<context.api.ATHLETES.length;i++){
    const a=context.api.ATHLETES[i];
    const key=context.api.normName(a._canonicalName||a.name);
    if(!key) continue;

    if(!seen.has(key)){
      seen.set(key,i);
    } else {
      // Merge into the first occurrence
      const primaryIdx=seen.get(key);
      const primary=context.api.ATHLETES[primaryIdx];
      const dup=a;

      // For each numeric metric, keep the better value
      const metricKeys=['approachJump','cmjHeight','standVert','sprint10','peakPower','rsi','asymmetry','eccRFD','concImpulse','eccImpulse','contractionTime','jumpVol','avgJumpHt','playerLoad','acuteLoad','chronicLoad'];
      for(const k of metricKeys){
        const m=context.api.getM(k);
        if(!m) continue;
        const primVal=primary[k], dupVal=dup[k];
        if(typeof dupVal==='number'&&!isNaN(dupVal)&&typeof primVal==='number'&&!isNaN(primVal)){
          // "Better" = higher for higherBetter metrics, lower for time/asymmetry
          primary[k]=m.hb?Math.max(primVal,dupVal):Math.min(primVal,dupVal);
        }
      }

      // Inherit locked flags
      if(dup._posLocked) primary._posLocked=true;
      if(dup._nameLocked){ primary._nameLocked=true; primary._canonicalName=dup._canonicalName||primary._canonicalName; }
      if(dup.pos&&!primary._posLocked) primary.pos=dup.pos;
      if(dup.yr&&primary.yr==='Jr') primary.yr=dup.yr;
      if(dup.age&&primary.age===20) primary.age=dup.age;

      // Merge sources
      if(dup._sources?.length){
        primary._sources=(primary._sources||[]);
        for(const s of dup._sources){
          if(!primary._sources.find(x=>x.file===s.file)) primary._sources.push(s);
        }
      }

      // Recompute
      primary.acwr=context.api.calcACWR(primary);
      primary.composite=context.api.calcCompositeVB(primary);
      primary.tier=context.api.calcTier(primary.composite);
      primary.trend[primary.trend.length-1]=primary.composite;

      toRemove.add(i);
    }
  }

  if(toRemove.size>0){
    context.api.ATHLETES=context.api.ATHLETES.filter((_,i)=>!toRemove.has(i));
  }
}

return Object.defineProperties({}, {
  importSrc: {enumerable:true, configurable:true, get:()=>importSrc, set:value=>{importSrc=value;}},
  pasteSrc2: {enumerable:true, configurable:true, get:()=>pasteSrc2, set:value=>{pasteSrc2=value;}},
  parsedData: {enumerable:true, configurable:true, get:()=>parsedData, set:value=>{parsedData=value;}},
  kinexonCommitLock: {enumerable:true, configurable:true, get:()=>kinexonCommitLock, set:value=>{kinexonCommitLock=value;}},
  kinexonCollisionDetected: {enumerable:true, configurable:true, get:()=>kinexonCollisionDetected, set:value=>{kinexonCollisionDetected=value;}},
  manEditId: {enumerable:true, configurable:true, get:()=>manEditId, set:value=>{manEditId=value;}},
  SRC_INFO: {enumerable:true, configurable:true, get:()=>SRC_INFO},
  COL_ALIASES: {enumerable:true, configurable:true, get:()=>COL_ALIASES},
  findSprintPlaceholders: {enumerable:true, configurable:true, get:()=>findSprintPlaceholders},
  openSprintAudit: {enumerable:true, configurable:true, get:()=>openSprintAudit},
  closeSprintAudit: {enumerable:true, configurable:true, get:()=>closeSprintAudit},
  clearSprintPlaceholders: {enumerable:true, configurable:true, get:()=>clearSprintPlaceholders},
  commitSmartMatch: {enumerable:true, configurable:true, get:()=>commitSmartMatch},
  applyAndClose: {enumerable:true, configurable:true, get:()=>applyAndClose},
  addUnmatched: {enumerable:true, configurable:true, get:()=>addUnmatched},
  openImport: {enumerable:true, configurable:true, get:()=>openImport},
  closeImport: {enumerable:true, configurable:true, get:()=>closeImport},
  switchITab: {enumerable:true, configurable:true, get:()=>switchITab},
  setSrc: {enumerable:true, configurable:true, get:()=>setSrc},
  setPSrc: {enumerable:true, configurable:true, get:()=>setPSrc},
  updateSrcInfo: {enumerable:true, configurable:true, get:()=>updateSrcInfo},
  handleFileSelect: {enumerable:true, configurable:true, get:()=>handleFileSelect},
  readFile: {enumerable:true, configurable:true, get:()=>readFile},
  setDZState: {enumerable:true, configurable:true, get:()=>setDZState},
  initDropZone: {enumerable:true, configurable:true, get:()=>initDropZone},
  parseCSV: {enumerable:true, configurable:true, get:()=>parseCSV},
  extractDateFromTitle: {enumerable:true, configurable:true, get:()=>extractDateFromTitle},
  processSessionRows: {enumerable:true, configurable:true, get:()=>processSessionRows},
  processApproachVertRows: {enumerable:true, configurable:true, get:()=>processApproachVertRows},
  processKinexonRows: {enumerable:true, configurable:true, get:()=>processKinexonRows},
  processKinexonTeamSummaryRows: {enumerable:true, configurable:true, get:()=>processKinexonTeamSummaryRows},
  processKinexonSummaryRows: {enumerable:true, configurable:true, get:()=>processKinexonSummaryRows},
  processRows: {enumerable:true, configurable:true, get:()=>processRows},
  TB_EX_MAP: {enumerable:true, configurable:true, get:()=>TB_EX_MAP},
  TB_LOWER_IS_BETTER: {enumerable:true, configurable:true, get:()=>TB_LOWER_IS_BETTER},
  processTB: {enumerable:true, configurable:true, get:()=>processTB},
  processTBComparison: {enumerable:true, configurable:true, get:()=>processTBComparison},
  processTBLegacy: {enumerable:true, configurable:true, get:()=>processTBLegacy},
  showMappingPreview: {enumerable:true, configurable:true, get:()=>showMappingPreview},
  showDataPreview: {enumerable:true, configurable:true, get:()=>showDataPreview},
  showMsg: {enumerable:true, configurable:true, get:()=>showMsg},
  fmtAccel: {enumerable:true, configurable:true, get:()=>fmtAccel},
  mergeKinexonSessions: {enumerable:true, configurable:true, get:()=>mergeKinexonSessions},
  warnKinexonCollisions: {enumerable:true, configurable:true, get:()=>warnKinexonCollisions},
  warnRosterAthletesMissingFromFile: {enumerable:true, configurable:true, get:()=>warnRosterAthletesMissingFromFile},
  smartMergeInto: {enumerable:true, configurable:true, get:()=>smartMergeInto},
  commitCSV: {enumerable:true, configurable:true, get:()=>commitCSV},
  commitPaste: {enumerable:true, configurable:true, get:()=>commitPaste},
  parsePaste: {enumerable:true, configurable:true, get:()=>parsePaste},
  resetCSVUI: {enumerable:true, configurable:true, get:()=>resetCSVUI},
  loadForEdit: {enumerable:true, configurable:true, get:()=>loadForEdit},
  clearManual: {enumerable:true, configurable:true, get:()=>clearManual},
  submitManual: {enumerable:true, configurable:true, get:()=>submitManual},
  deleteAthlete: {enumerable:true, configurable:true, get:()=>deleteAthlete},
  dedupeATHLETES: {enumerable:true, configurable:true, get:()=>dedupeATHLETES}
});
}
