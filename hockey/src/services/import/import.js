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
// Reference: originals/hockey.html:3560
let importSrc='custom';


// Reference: originals/hockey.html:3561
let pasteSrc2='custom';


// Reference: originals/hockey.html:3562
let parsedData=null;


// Reference: originals/hockey.html:3563
let kinexonCommitLock=false;

// guards against double-click / double-submit re-running the same import twice
// Reference: originals/hockey.html:3564
let kinexonCollisionDetected=false;

// set true by warnKinexonCollisions when a same-day row already exists
// Reference: originals/hockey.html:3565
let manEditId=null;


// Reference: originals/hockey.html:3567
const SRC_INFO = {
  custom:`Standard / Custom Format — flexible header detection.
Required: Name, Position (F/D/G)
Performance Testing: ApproachJump (Broad Jump), CMJHeight (Vertical Jump), StandVert (Goal to Blue), Sprint10, FrontSquatMax, NGChinUp, OnIceBeep
Teambuildr Strength: BenchMax (Bench Press 1RM), HangCleanMax (Hang Clean 1RM)
VALD ForceDecks: PeakPower, RSI, Asymmetry, EccRFD, ConcImpulse, EccImpulse, ContractionTime
Firstbeat: JumpVol (TRIMP), AvgJumpHt (Avg HR), PlayerLoad (Efficiency), AcuteLoad, ChronicLoad
Header names are case-insensitive; common aliases are auto-detected.`,
  vald:`VALD Hub Export — ForceDecks CMJ Results Table.
Export from: VALD Hub → Profiles → Results Table → CMJ → Export CSV.
Expected columns: Name, Group (=Sport), Jump Height (cm or in — auto-converted), 
Peak Power (W) or Peak Relative Power (W/kg) — both supported, RSI Modified, Limb Symmetry Index (%), 
Eccentric Braking RFD (N/s), Propulsive Impulse (N·s), Braking Impulse (N·s), 
Time to Takeoff (ms). Additional athlete info (Position, Year) can be added.`,
  kinexon:`Firstbeat Sports Export — tab-delimited session file, one row per athlete/session.
Export: Firstbeat Sports → Export training data as CSV (tab-delimited).
Expected columns: Athlete name, Start date (dd.mm.yyyy), Measurement type, Title,
TRIMP (Index), TRIMP/min (Index), Duration (hh:mm:ss), Average HR (bpm), Movement load.
Efficiency Score is calculated automatically as Movement load ÷ TRIMP.
All athletes auto-matched to roster — no athlete selection needed.`,
  teambuildr:`Teambuildr Comparison Report — wide format with historical maxes.
Export from: Teambuildr → Reports → Comparison Report → All athletes → Export CSV.
Imports: Front Squat, NG Chin Up, Bench Press, Hang Clean, 10-yd Sprint.
Each athlete's all-time max per exercise is stored.
Names will be matched to your locked canonical roster automatically.`,
  approachvert:`Broad Jump Testing — simple touch/distance test format.
First row should be the test title with date (e.g. "BROAD JUMP TESTING 8/26/25").
Header row 2: Name, Standing Reach, 4 Step Approach Height (inches), 4 Step Approach Height (feet), Approach Vert (Inches).
Names can be last-name-only — will match to existing roster automatically.
Will display as feet + inches on profiles.
Empty rows (no jump data) are skipped automatically. Negative values are filtered as outliers.`,
  singletest:`Single-Test Leaderboard Export — one test per file (e.g. Teambuildr's
per-exercise leaderboard export). Expected: a title row naming the test/date
(e.g. "8/25/26 Vertical Jump"), then a header row with Name and Value columns
(a Rank column is fine too, it's ignored). Pick which test this file is from
the dropdown above — auto-detected from the title where possible.
Value formats handled automatically: ft/in for Broad Jump (9' 6"), plain
inches for Vertical Jump (36"), plain lbs for strength lifts, "8+3" style
scores for On-Ice Beep, plain seconds for Goal to Blue / 10-yd Sprint.
Works for both .xlsx and .csv exports of this format.`,
  longterm:`Long-Term History (Wide Format) — a multi-year tracking sheet with
one row per athlete/exercise and REPEATING Date+Max column pairs (Max 1,
Max 2, Max 3...) covering however many tests you've logged over time.
Expected columns: Name, Exercise, then pairs of (Date, Max) columns.
Exercise names recognized: Vertical Jump, Broad Jump (ft/in like 9' 6"),
Goal to Blue, 10-yd Sprint, Front Squat, NG Chin Up, On-Ice Beep, Bench
Press, Hang Clean — matched the same way as Single-Test Leaderboard.
This logs FULL history for every date column found (not just the most
recent), and also updates each athlete's current value to their latest
test. Same-day duplicate entries are automatically resolved to the best
value. Works for both .xlsx and .csv.`,
};


// Reference: originals/hockey.html:3620
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
  frontSquatMax:  ['frontsquatmax','front squat max','front squat','front squat 1rm','front squat (1rm)','fs 1rm','fs max'],
  ngChinUp:       ['ngchinup','ng chin up','ng chin up (1rm)','ng chin up 1rm','neutral grip chin up','chin up','chinup','ng chinup'],
  onIceBeep:      ['onicebeep','on-ice beep','on ice beep','beep test','beep score'],
  benchMax:       ['benchmax','bench press','bench press max','bench press (1rm)','bench 1rm','bench max','barbell bench press'],
  hangCleanMax:   ['hangcleanmax','hang clean','hang clean max','hang clean (1rm)','hang clean 1rm'],
};

// ── Placeholder data audit (10-yd sprint) ────────────────────────
// An athlete's sprint10 is "placeholder" if no logged source ever actually
// confirmed it — meaning it's still whatever the random position-range
// fallback (rndf) assigned when the field was first created.
// Reference: originals/hockey.html:3672
function findSprintPlaceholders(){
  return context.api.allAthletes().filter(a=>a.sprint10!=null && !context.api.sourceForKey(a,'sprint10'));
}


// Reference: originals/hockey.html:3676
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


// Reference: originals/hockey.html:3697
function closeSprintAudit(){
  document.getElementById('sprint-audit-overlay').style.display='none';
  document.body.style.overflow='';
}


// Reference: originals/hockey.html:3701
document.getElementById('sprint-audit-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('sprint-audit-overlay'))closeSprintAudit();});


// Reference: originals/hockey.html:3703
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
// Reference: originals/hockey.html:3880
function commitSmartMatch(){
  if(!parsedData||!parsedData.length){
    showMsg('csv-msgs','err','No data parsed yet.');return;
  }
  // Session-style imports (VALD force plate, Firstbeat, Broad Jump testing) save
  // directly to test_sessions and are matched to the roster by name automatically —
  // there's no separate "smart match" step for these, so route straight to the
  // same save path as the other commit buttons rather than doing nothing.
  if(processRows._isSessionImport||processRows._isKinexonImport||processRows._isApproachVertImport){
    commitCSV(false);
    return;
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


// Reference: originals/hockey.html:3954
function applyAndClose(count){
  document.getElementById('smart-match-report').style.display='none';
  context.api.refreshAll();closeImport();
  context.api.postImportPositionCheck();
  if(context.api.unsetCount()===0) context.navigate('dashboard');
  context.api.toast(`✓ Smart Match — ${count} athletes updated`);
}


// Reference: originals/hockey.html:3962
function addUnmatched(){
  if(!parsedData)return;
  const existing=new Set(context.api.rosterAthletes().map(a=>context.api.normName(a._canonicalName||a.name)));
  const newAthletes=parsedData.filter(a=>!context.api.findBestMatch(a.name));
  const mx=context.api.ATHLETES.reduce((m,a)=>Math.max(m,a.id),0);
  context.api.ATHLETES=[...context.api.ATHLETES,...newAthletes.map((a,i)=>({...a,id:mx+i+1}))];
  context.api.refreshAll();closeImport();context.navigate('dashboard');
  context.api.toast(`✓ Added ${newAthletes.length} new athletes`);
}


// Reference: originals/hockey.html:3972
function openImport(){
  document.getElementById('imp-overlay').style.display='block';
  document.body.style.overflow='hidden';
  updateSrcInfo();
  setDZState('idle');
  const sel=document.getElementById('man-edit-sel');
  sel.innerHTML=context.api.athleteOptions('— new athlete —');
  requestAnimationFrame(()=>requestAnimationFrame(initDropZone));
}


// Reference: originals/hockey.html:3981
function closeImport(){document.getElementById('imp-overlay').style.display='none';document.body.style.overflow='';}


// Reference: originals/hockey.html:3982
document.getElementById('imp-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('imp-overlay'))closeImport();});

// Don't let the overlay swallow drag events before they reach the drop zone
// Reference: originals/hockey.html:3984
['dragenter','dragover','dragleave','drop'].forEach(evt=>{
  document.getElementById('imp-overlay').addEventListener(evt,e=>{
    if(e.target!==document.getElementById('imp-overlay'))return;
    e.preventDefault();e.stopPropagation();
  });
});


// Reference: originals/hockey.html:3991
function switchITab(t){
  ['csv','paste','manual'].forEach(x=>{document.getElementById('itab-'+x).classList.toggle('active',x===t);document.getElementById('ipanel-'+x).style.display=x===t?'block':'none';});
}


// Reference: originals/hockey.html:3994
function setSrc(s){
  importSrc=s;['custom','vald','kinexon','teambuildr','approachvert','singletest','longterm'].forEach(x=>document.getElementById('src-'+x).classList.toggle('active',x===s));
  // The long-term wide format determines each row's test from its own
  // "Exercise" column — no single-file metric picker needed, unlike
  // Single-Test Leaderboard which is one fixed test for the whole file.
  document.getElementById('singletest-metric-picker').style.display=(s==='singletest')?'block':'none';
  updateSrcInfo();resetCSVUI();
}


// Reference: originals/hockey.html:4002
function setPSrc(s){pasteSrc2=s;['custom','vald','kinexon','teambuildr','approachvert'].forEach(x=>document.getElementById('psrc-'+x).classList.toggle('active',x===s));}


// Reference: originals/hockey.html:4003
function updateSrcInfo(){document.getElementById('src-info').textContent=SRC_INFO[importSrc]||'';}


// Reference: originals/hockey.html:4005
function handleFileSelect(e){
  const f=e.target.files[0];
  console.log('handleFileSelect fired. files:',e.target.files.length,'first file:',f?f.name+' ('+f.type+', '+f.size+' bytes)':'none');
  if(!f){
    showMsg('csv-msgs','err','No file was received from the picker — this can happen with certain iPad file sources. Try the Paste Data tab instead, or re-save the file to "On My iPad" in the Files app first.');
    return;
  }
  try{
    readFile(f);
  }catch(err){
    console.error('handleFileSelect error:',err);
    setDZState('idle');
    showMsg('csv-msgs','err','Could not read this file: '+(err.message||err)+' — try the Paste Data tab instead.');
  }
}


// Reference: originals/hockey.html:4021
function readFile(f){
  const lname=f.name.toLowerCase();
  const isXlsx=lname.endsWith('.xlsx')||lname.endsWith('.xls');
  const isCsv=lname.endsWith('.csv');
  if(!isXlsx&&!isCsv){
    setDZState('idle');
    showMsg('csv-msgs','err','Please upload a .csv or .xlsx file.');return;
  }
  setDZState('reading');
  document.getElementById('dz-reading-label').textContent='Reading: '+f.name+'…';

  if(isXlsx){
    if(typeof XLSX==='undefined'){
      setDZState('idle');
      showMsg('csv-msgs','err','Excel file support failed to load — try again, or export as .csv instead.');
      return;
    }
    const r=new FileReader();
    r.onload=e=>{
      readFile._lastName=f.name;
      try{
        const wb=XLSX.read(e.target.result,{type:'array'});
        const sheetName=wb.SheetNames.includes('Summary')?'Summary':wb.SheetNames[0];
        const ws=wb.Sheets[sheetName];
        // raw:false formats every cell per its own Excel number format — this gives us
        // "13.02.2026" for dates and "03:35:18" for durations, matching the same string
        // formats plain-text exports use, so the rest of the pipeline doesn't need a
        // separate code path for Excel vs CSV.
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,blankrows:false});
        if(importSrc==='singletest'){
          processSingleTestRows(rows, sheetName, f.name);
        } else if(importSrc==='longterm'){
          processLongTermRows(rows, sheetName, f.name);
        } else {
          if(importSrc!=='kinexon') setSrc('kinexon');
          processKinexonRows(rows);
        }
      }catch(err){
        setDZState('idle');
        showMsg('csv-msgs','err','Could not read this Excel file: '+(err.message||err));
      }
    };
    r.onerror=()=>{setDZState('idle');showMsg('csv-msgs','err','Could not read file. Try the Paste tab instead.');};
    r.readAsArrayBuffer(f);
    return;
  }

  const r=new FileReader();
  r.onload=e=>{
    readFile._lastName=f.name;
    const txt=e.target.result.replace(/^\uFEFF/,'');
    const firstLine=txt.split('\n')[0];

    if(importSrc==='singletest'){
      const rows=parseCSVToRows(txt);
      processSingleTestRows(rows, '', f.name);
      return;
    }
    if(importSrc==='longterm'){
      const rows=parseCSVToRows(txt);
      processLongTermRows(rows, '', f.name);
      return;
    }

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

// Simple CSV/TSV text → array-of-arrays, used for sources (like Single-Test
// Leaderboard) that need raw rows rather than the header-object-per-row shape
// parseCSV() produces for the general roster-merge import path.
// Reference: originals/hockey.html:4122
function parseCSVToRows(txt){
  const delimiter = txt.split('\n')[0].includes('\t') ? '\t' : ',';
  const lines=txt.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim());
  return lines.map(line=>{
    const row=[];let f2='',inQ=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"'){if(inQ&&line[i+1]==='"'){f2+='"';i++;}else inQ=!inQ;}
      else if(c===delimiter&&!inQ){row.push(f2.trim());f2='';}
      else f2+=c;
    }
    row.push(f2.trim());
    return row;
  });
}


// Reference: originals/hockey.html:4138
function setDZState(state){
  document.getElementById('dz-idle').style.display    = state==='idle'    ? 'block':'none';
  document.getElementById('dz-reading').style.display = state==='reading' ? 'block':'none';
  document.getElementById('dz-ready').style.display   = state==='ready'   ? 'block':'none';
  // A fresh file load should always show the commit buttons, not a leftover progress bar from a prior import.
  const btnRow=document.getElementById('commit-buttons-row'), progRow=document.getElementById('commit-progress-row');
  if(btnRow) btnRow.style.display='flex';
  if(progRow) progRow.style.display='none';
}

// ── Drag-and-drop wired in JS (inline handlers blocked by modal overlay) ──
// Reference: originals/hockey.html:4149
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


// Reference: originals/hockey.html:4166
function parseCSV(txt){
  txt=txt.replace(/^\uFEFF/,'');
  // Auto-detect delimiter: tabs (Firstbeat exports) > semicolons > commas
  const firstLine=txt.split('\n')[0];
  const tabCount=firstLine.split('\t').length, semiCount=firstLine.split(';').length, commaCount=firstLine.split(',').length;
  const delimiter = tabCount>Math.max(semiCount,commaCount) ? '\t' : (semiCount>commaCount ? ';' : ',');
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
// Reference: originals/hockey.html:4210
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
// Reference: originals/hockey.html:4224
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
      conc_impulse: num('concImpulse'),
      conc_impulse_asym: numSigned('conc_impulse_asym'),
      ecc_braking_asym: numSigned('ecc_braking_asym'),
      peak_power: pp,
      rsi_mod: num('rsi'),
      asymmetry: num('asymmetry'),
      ecc_rfd: num('eccRFD'),
      ecc_impulse: num('eccImpulse'),
      contraction_time: num('contractionTime'),
      source_file: readFile._lastName||'paste',
    });
  }
  parsedData=sessions;
  processRows._isSessionImport=true;
  setDZState('ready');
  const fname=readFile._lastName||'session.csv';
  document.getElementById('dz-file-name').textContent='✓ '+fname+' (session data)';
  document.getElementById('dz-athlete-count').textContent=`${sessions.length} test session${sessions.length!==1?'s':''} ready to import to Readiness Hub`;
  // Build preview
  const previewCols=['athlete_name','test_date','jump_height','takeoff_velocity','peak_power','rsi_mod','conc_impulse_asym','ecc_braking_asym'];
  const colLabels=['Athlete','Date','Jump Ht','TO Velo','Power','mRSI','Conc Asym','Ecc Asym'];
  document.getElementById('col-map-tbl').innerHTML=`<div class="ok">Session-style CSV detected — date column found. These will save to Readiness Hub.</div>`;
  document.getElementById('csv-data-prev').innerHTML=`<table class="prev-tbl"><thead><tr>${colLabels.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${sessions.slice(0,5).map(s=>`<tr>${previewCols.map(k=>`<td>${s[k]===null||s[k]===undefined?'—':s[k]}</td>`).join('')}</tr>`).join('')}</tbody></table>${sessions.length>5?`<div style="font-size:9px;color:var(--text3);margin-top:6px;">... +${sessions.length-5} more</div>`:''}`;
  if(errors.length) showMsg('csv-msgs','warn',errors.slice(0,5).join('; ')+(errors.length>5?` (+${errors.length-5} more)`:''));
}

// ── Single-Test Leaderboard import (e.g. Teambuildr per-exercise leaderboard
// exports: "Rank, Name, Value" with a title row naming the test + date) ─────
// Reference: originals/hockey.html:4304
let _lastSingleTestRows=null, _lastSingleTestFileName='';


// Reference: originals/hockey.html:4306
const SINGLETEST_METRIC_HINTS = {
  approachJump:  ['broad jump'],
  cmjHeight:     ['vertical jump','vert jump'],
  standVert:     ['goal to blue','goal-to-blue'],
  sprint10:      ['10 yd sprint','10-yd sprint','10 yard sprint','10yd sprint','10y sprint'],
  frontSquatMax: ['front squat'],
  ngChinUp:      ['ng chin up','neutral grip chin up'],
  onIceBeep:     ['on-ice beep','on ice beep','beep test'],
  benchMax:      ['bench press'],
  hangCleanMax:  ['hang clean'],
};


// Reference: originals/hockey.html:4318
function processSingleTestRows(rows, sheetTitle, fileName){
  if(!rows||rows.length<2){
    setDZState('idle');
    showMsg('csv-msgs','err','File appears empty or too short.');
    return;
  }
  _lastSingleTestRows=rows;
  _lastSingleTestFileName=fileName||'';

  // Auto-detect which metric this file represents. Prefer an explicit
  // "Exercise" column when the file has one (e.g. Teambuildr leaderboard
  // exports include this on every row) — far more reliable than guessing
  // from a title row or file name, which may use underscores/dashes instead
  // of spaces and miss a plain substring match.
  let exerciseHint='';
  for(let i=0;i<Math.min(rows.length,5);i++){
    const row=(rows[i]||[]).map(c=>(c||'').toString().trim().toLowerCase());
    const ec=row.indexOf('exercise');
    if(ec>=0&&rows[i+1]&&rows[i+1][ec]){exerciseHint=String(rows[i+1][ec]);break;}
  }
  const normalize=s=>(s||'').toLowerCase().replace(/[_-]+/g,' ');
  const hintText=[exerciseHint,rows[0]?.[0],sheetTitle,fileName].filter(Boolean).map(normalize).join(' ');
  let detected=null;
  for(const [key,hints] of Object.entries(SINGLETEST_METRIC_HINTS)){
    if(hints.some(h=>hintText.includes(h))){detected=key;break;}
  }
  if(detected) document.getElementById('singletest-metric-sel').value=detected;

  runSingleTestParse();
}


// Reference: originals/hockey.html:4349
function runSingleTestParse(){
  const rows=_lastSingleTestRows;
  if(!rows) return;
  const metricKey=document.getElementById('singletest-metric-sel').value;
  const m=context.api.getM(metricKey);

  // Find the header row (contains "Name" and "Value") — everything before it
  // (title rows like "8/25/26 Vertical Jump") is skipped. Also grab a "Date
  // Set"/"Test Date" column if the file has one (e.g. Teambuildr leaderboard
  // exports) — a real per-row date beats guessing one date for the whole file.
  let headerRowIdx=-1, nameCol=-1, valueCol=-1, dateCol=-1;
  for(let i=0;i<Math.min(rows.length,5);i++){
    const row=(rows[i]||[]).map(c=>(c||'').toString().trim().toLowerCase());
    const nc=row.indexOf('name'), vc=row.indexOf('value');
    if(nc>=0&&vc>=0){
      headerRowIdx=i;nameCol=nc;valueCol=vc;
      dateCol=row.findIndex(h=>h.includes('date'));
      break;
    }
  }
  if(headerRowIdx<0){
    setDZState('idle');
    showMsg('csv-msgs','err','Could not find Name/Value columns. Expected a "Rank, Name, Value" style leaderboard export.');
    return;
  }

  // Fallback date: try to pull one out of a title row (e.g. "8/25/26 Vertical
  // Jump") for files with no per-row date column. Per-row dates (below) win
  // when present.
  const titleText=(rows[0]?.[0]||'').toString();
  let fallbackDateISO=null;
  const dm=titleText.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if(dm){
    let yr=dm[3]; if(yr.length===2) yr='20'+yr;
    fallbackDateISO=`${yr}-${dm[1].padStart(2,'0')}-${dm[2].padStart(2,'0')}`;
  }
  if(!fallbackDateISO) fallbackDateISO=new Date().toISOString().slice(0,10);

  // Parse a per-row date cell — handles "Sep. 4, 2026", "9/4/2026", etc.
  const parseRowDate=(raw)=>{
    if(!raw) return null;
    const s=String(raw).trim();
    let m2=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if(m2){let yr=m2[3];if(yr.length===2)yr='20'+yr;return `${yr}-${m2[1].padStart(2,'0')}-${m2[2].padStart(2,'0')}`;}
    const d=new Date(s.replace(/\./g,''));
    return isNaN(d.getTime())?null:d.toISOString().slice(0,10);
  };

  // Convert a raw "Value" cell into the numeric form this metric expects
  const convertValue=(raw)=>{
    if(raw==null) return null;
    const s=String(raw).trim();
    if(!s) return null;
    if(metricKey==='approachJump'){
      // ft/in format, e.g. 9' 6" or 9' 6.5"
      const fm=s.match(/(\d+)'\s*([\d.]+)/);
      if(fm) return parseFloat((parseInt(fm[1])*12+parseFloat(fm[2])).toFixed(1));
      const n=parseFloat(s.replace(/["']/g,''));
      return isNaN(n)?null:n;
    }
    if(metricKey==='onIceBeep'){
      const bm=s.match(/(\d+)\+(\d+)/);
      if(bm) return parseFloat((parseFloat(bm[1])+parseFloat(bm[2])/10).toFixed(1));
      const n=parseFloat(s);
      return isNaN(n)?null:n;
    }
    // Plain numeric metrics — strip inches marks, "lbs", "s", stray quotes
    const n=parseFloat(s.replace(/["']|lbs?|s$/gi,'').trim());
    return isNaN(n)?null:n;
  };

  const dateKey=metricKey+'Date';
  const dataRows=rows.slice(headerRowIdx+1).filter(r=>r&&r[nameCol]);
  const entries=dataRows.map(row=>{
    const name=(row[nameCol]||'').toString().trim();
    const val=convertValue(row[valueCol]);
    if(!name||val==null) return null;
    const rowDate=dateCol>=0?parseRowDate(row[dateCol]):null;
    return {name, value:val, date:rowDate||fallbackDateISO};
  }).filter(Boolean);

  if(!entries.length){
    setDZState('idle');
    showMsg('csv-msgs','err','No valid rows found under the selected test.');
    return;
  }

  const matched=[], newNames=[];
  for(const e of entries){
    const mm=context.api.findBestMatch(e.name);
    if(mm&&mm.matchType!=='ambiguous-last-name'){
      matched.push({name: mm.athlete._canonicalName||mm.athlete.name, [metricKey]:e.value, [dateKey]:e.date});
    } else {
      // Not on the roster yet — include as-is so "Update/Add by Name" creates
      // them as new athletes, same as every other import source in this app.
      matched.push({name: e.name, [metricKey]:e.value, [dateKey]:e.date});
      newNames.push(e.name);
    }
  }

  parsedData=matched;
  processRows._presentKeys=new Set([metricKey,dateKey]);
  processRows._isSessionImport=false;
  processRows._isKinexonImport=false;
  processRows._isApproachVertImport=false;

  const uniqueDates=[...new Set(entries.map(e=>e.date))];
  const dateLabel=uniqueDates.length===1?uniqueDates[0]:`${uniqueDates.length} dates`;
  document.getElementById('dz-file-name').textContent='✓ '+(_lastSingleTestFileName||'file')+` (${m.label})`;
  document.getElementById('dz-athlete-count').textContent=
    `${matched.length} athletes total`+(newNames.length?` · ${newNames.length} new (not currently on roster)`:' · all already on roster');

  document.getElementById('col-map-tbl').innerHTML=
    `<div class="ok">Single-Test Leaderboard detected · test: <b>${m.label}</b> · date: ${dateLabel}${dateCol>=0?' (from file)':' (no date column found — using today\'s date)'}</div>`+
    (newNames.length?`<div class="warn">${newNames.length} not currently on your roster — "Update/Add by Name" will add them as new athletes: ${newNames.join(', ')}</div>`:'');

  document.getElementById('csv-data-prev').innerHTML=`
    <table class="prev-tbl"><thead><tr><th>Athlete</th><th>${m.label}</th><th>Date</th></tr></thead><tbody>${matched.slice(0,10).map(e=>`<tr>
      <td>${e.name}</td><td style="font-family:var(--fm);color:var(--orange);">${m.fmt(e[metricKey])} ${m.unit||''}</td><td style="font-family:var(--fm);color:var(--text3);">${e[dateKey]}</td>
    </tr>`).join('')}</tbody></table>
    ${matched.length>10?`<div style="font-size:9px;color:var(--text3);margin-top:6px;">... +${matched.length-10} more</div>`:''}`;

  setDZState('ready');
}

// ── Long-Term History (Wide Format) import ──────────────────────────
// One row per athlete/exercise, with repeating (Date, Max) column pairs
// covering however many tests have been logged over time. Unlike every
// other import path, this one both (a) logs FULL history for every date
// column found, not just the latest, and (b) still updates each athlete's
// current value to their most recent test, so the rest of the app (Team
// Dashboard, KPI table, composite score) stays in sync too.
// Reference: originals/hockey.html:4481
let _lastLongTermRows=null, _lastLongTermFileName='';


// Reference: originals/hockey.html:4483
function processLongTermRows(rows, sheetTitle, fileName){
  if(!rows||rows.length<2){
    setDZState('idle');
    showMsg('csv-msgs','err','File appears empty or too short.');
    return;
  }
  _lastLongTermRows=rows;
  _lastLongTermFileName=fileName||'';

  // Find the header row (contains "Name" and "Exercise")
  let headerRowIdx=-1, nameCol=-1, exerciseCol=-1;
  for(let i=0;i<Math.min(rows.length,5);i++){
    const row=(rows[i]||[]).map(c=>(c||'').toString().trim().toLowerCase());
    const nc=row.indexOf('name'), ec=row.indexOf('exercise');
    if(nc>=0&&ec>=0){headerRowIdx=i;nameCol=nc;exerciseCol=ec;break;}
  }
  if(headerRowIdx<0){
    setDZState('idle');
    showMsg('csv-msgs','err','Could not find Name/Exercise columns. Expected a wide format with repeating Date/Max column pairs.');
    return;
  }

  // Every column after Exercise is a repeating block starting with a "Date"
  // column — but the block WIDTH varies by export: some formats use 2
  // columns per test (Date, Max), others use 3 (Date, Max, Unit — with later
  // blocks using Date, Max, Change instead of Unit). Detect the real stride
  // from the header row itself rather than assuming a fixed width, so both
  // shapes parse correctly.
  const pairStart=exerciseCol+1;
  const headerRow=(rows[headerRowIdx]||[]).map(c=>(c||'').toString().trim().toLowerCase());
  const dateColIndexes=[];
  for(let c=pairStart;c<headerRow.length;c++) if(headerRow[c]==='date') dateColIndexes.push(c);
  const blockWidth=dateColIndexes.length>=2 ? (dateColIndexes[1]-dateColIndexes[0]) : 2;

  const convertValue=(metricKey,raw)=>{
    if(raw==null) return null;
    const s=String(raw).trim();
    if(!s||s==='-') return null;
    if(metricKey==='approachJump'){
      const fm=s.match(/(\d+)'\s*([\d.]+)/);
      if(fm) return parseFloat((parseInt(fm[1])*12+parseFloat(fm[2])).toFixed(1));
      const n=parseFloat(s.replace(/["']/g,''));
      return isNaN(n)?null:n;
    }
    if(metricKey==='onIceBeep'){
      const bm=s.match(/(\d+)\+(\d+)/);
      if(bm) return parseFloat((parseFloat(bm[1])+parseFloat(bm[2])/10).toFixed(1));
      const n=parseFloat(s);
      return isNaN(n)?null:n;
    }
    const n=parseFloat(s.replace(/["']|lbs?|s$/gi,'').trim());
    return isNaN(n)?null:n;
  };
  const parseCellDate=(raw)=>{
    if(!raw) return null;
    const s=String(raw).trim();
    if(!s||s==='-') return null;
    let m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if(m){let yr=m[3];if(yr.length===2)yr='20'+yr;return `${yr}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;}
    const d=new Date(s.replace(/\./g,''));
    return isNaN(d.getTime())?null:d.toISOString().slice(0,10);
  };

  // Parse every row into flat {name, metricKey, date, value} entries,
  // carrying the athlete name forward for blank-name rows (one name per
  // athlete, followed by one row per exercise).
  let currentName=null;
  const rawEntries=[];
  const unrecognizedExercises=new Set();
  for(let r=headerRowIdx+1;r<rows.length;r++){
    const row=rows[r]||[];
    const nameCell=(row[nameCol]||'').toString().trim();
    if(nameCell) currentName=nameCell;
    const exerciseCell=(row[exerciseCol]||'').toString().trim();
    if(!exerciseCell||!currentName) continue;

    const normalize=s=>(s||'').toLowerCase().replace(/[_-]+/g,' ');
    const exNorm=normalize(exerciseCell);
    let metricKey=null;
    for(const [key,hints] of Object.entries(SINGLETEST_METRIC_HINTS)){
      if(hints.some(h=>exNorm.includes(h))){metricKey=key;break;}
    }
    if(!metricKey){unrecognizedExercises.add(exerciseCell);continue;}

    for(let c=pairStart;c<row.length;c+=blockWidth){
      const date=parseCellDate(row[c]);
      if(!date) continue;
      const value=convertValue(metricKey,row[c+1]);
      if(value==null) continue;
      rawEntries.push({name:currentName, metricKey, date, value});
    }
  }

  if(!rawEntries.length){
    setDZState('idle');
    showMsg('csv-msgs','err','No valid dated entries found. Expected repeating Date/Max column pairs after Name and Exercise.');
    return;
  }

  // Best-per-date dedup: if the same athlete/metric/date appears more than
  // once (e.g. a duplicate Max slot), keep whichever value is better.
  const bestByKey={};
  for(const e of rawEntries){
    const key=`${context.api.normName(e.name)}|${e.metricKey}|${e.date}`;
    const m=context.api.getM(e.metricKey);
    if(!bestByKey[key]){
      bestByKey[key]=e;
    } else {
      const cur=bestByKey[key];
      const isBetter=m.hb?(e.value>cur.value):(e.value<cur.value);
      if(isBetter) bestByKey[key]=e;
    }
  }
  const dedupedEntries=Object.values(bestByKey);
  const dupesResolved=rawEntries.length-dedupedEntries.length;

  // Match names to roster
  const matched=[], newNames=new Set();
  for(const e of dedupedEntries){
    const mm=context.api.findBestMatch(e.name);
    if(mm&&mm.matchType!=='ambiguous-last-name'){
      matched.push({...e, canonicalName:mm.athlete._canonicalName||mm.athlete.name});
    } else {
      matched.push({...e, canonicalName:e.name});
      newNames.add(e.name);
    }
  }

  processRows._isLongTermImport=true;
  processRows._longTermEntries=matched;
  parsedData=matched; // satisfies commitCSV's "no data parsed" guard; the actual commit reads _longTermEntries

  const uniqueAthletes=new Set(matched.map(e=>e.canonicalName));
  const uniqueMetrics=new Set(matched.map(e=>e.metricKey));
  const dateRange=matched.map(e=>e.date).sort();

  document.getElementById('dz-file-name').textContent='✓ '+(_lastLongTermFileName||'file')+` (long-term history)`;
  document.getElementById('dz-athlete-count').textContent=
    `${uniqueAthletes.size} athletes · ${matched.length} dated entries · ${uniqueMetrics.size} test type${uniqueMetrics.size!==1?'s':''}`;

  document.getElementById('col-map-tbl').innerHTML=
    `<div class="ok">Long-Term History detected · ${dateRange[0]} to ${dateRange[dateRange.length-1]} · tests: ${[...uniqueMetrics].map(k=>context.api.getM(k).label).join(', ')}${dupesResolved?` · ${dupesResolved} same-day duplicate${dupesResolved!==1?'s':''} resolved to best value`:''}</div>`+
    (newNames.size?`<div class="warn">${newNames.size} not currently on your roster — will be added as new athletes: ${[...newNames].join(', ')}</div>`:'')+
    (unrecognizedExercises.size?`<div class="warn">${unrecognizedExercises.size} exercise name(s) not recognized, skipped: ${[...unrecognizedExercises].join(', ')}</div>`:'');

  document.getElementById('csv-data-prev').innerHTML=`
    <table class="prev-tbl"><thead><tr><th>Athlete</th><th>Test</th><th>Date</th><th>Value</th></tr></thead><tbody>${matched.slice(0,10).map(e=>{
      const m=context.api.getM(e.metricKey);
      return `<tr><td>${e.canonicalName}</td><td>${m.label}</td><td style="font-family:var(--fm)">${e.date}</td><td style="font-family:var(--fm);color:var(--orange);">${m.fmt(e.value)} ${m.unit||''}</td></tr>`;
    }).join('')}</tbody></table>
    ${matched.length>10?`<div style="font-size:9px;color:var(--text3);margin-top:6px;">... +${matched.length-10} more</div>`:''}`;

  setDZState('ready');
}

// Row 1: title with date (e.g. "APPROACH VERT TESTING 4/16/26")
// Row 2: headers — Name, Standing Reach, 4 Step Approach Height (inches), 4 Step Approach Height (feet), Approach Vert (Inches)
// Rows 3+: athletes — name (last-name-only allowed), values
// Saves to test_sessions table with approachJump = 4 Step Approach Height (inches)
// Reference: originals/hockey.html:4643
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
// Reference: originals/hockey.html:4745
function processKinexonRows(rows){
  // Firstbeat Sports export — supports both the plain CSV/TSV format and the
  // full default .xlsx "Summary" sheet export, one row per athlete per session.
  // Key columns (case/spacing tolerant): Athlete name, Start date (dd.mm.yyyy),
  // Measurement type, Analysis period, Title, TRIMP (Index), TRIMP/min (Index),
  // Duration (hh:mm:ss), Average HR (bpm), Movement load, Acute Training Load,
  // Chronic Training Load, ACWR.
  if(!rows||rows.length<2){
    setDZState('idle');
    showMsg('csv-msgs','err','Firstbeat file appears empty or too short.');
    return;
  }
  const headers=rows[0].map(h=>(h||'').trim());
  const hLower=headers.map(h=>h.toLowerCase());
  const findCol=(...needles)=>hLower.findIndex(h=>needles.some(n=>h.includes(n)));
  const ci={
    name:      findCol('athlete name','athlete','name'),
    date:      findCol('start date','date'),
    type:      findCol('measurement type','type'),
    period:    findCol('analysis period'),
    title:     findCol('title','drill'),
    trimp:     findCol('trimp (index)','trimp'),
    trimpMin:  findCol('trimp/min','trimp per min'),
    duration:  findCol('duration'),
    avgHr:     findCol('average hr','avg hr','heart rate'),
    movement:  findCol('movement load'),
    acute:     findCol('acute training load'),
    chronic:   findCol('chronic training load'),
    acwr:      findCol('acwr'),
  };
  if(ci.name<0||ci.date<0){
    setDZState('idle');
    showMsg('csv-msgs','err','Firstbeat format not recognized. Expected columns for Athlete name and Start date.');
    return;
  }

  const parseFBDate=(s)=>{
    if(!s) return null;
    s=String(s).trim();
    // dd.mm.yyyy (Firstbeat default text export)
    let m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if(m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    // mm/dd/yyyy
    m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    // Raw Excel serial date number (e.g. "46066") — SheetJS doesn't always
    // format date cells as text even with raw:false, so fall back to the
    // standard Excel-epoch conversion for a plain integer/decimal string.
    if(/^\d{4,6}(\.\d+)?$/.test(s)){
      const serial=parseFloat(s);
      if(serial>15000&&serial<80000){ // sane range for real calendar dates
        const d=new Date(Date.UTC(1899,11,30)+Math.round(serial)*86400000);
        if(!isNaN(d.getTime())) return d.toISOString().slice(0,10);
      }
    }
    const d=new Date(s);
    return isNaN(d.getTime())?null:d.toISOString().slice(0,10);
  };
  const parseDurationMin=(s)=>{
    if(!s) return null;
    const parts=s.split(':').map(Number);
    if(parts.length!==3||parts.some(isNaN)) return null;
    return parseFloat((parts[0]*60+parts[1]+parts[2]/60).toFixed(1));
  };

  let dataRows=rows.slice(1).filter(r=>r.some(c=>c&&String(c).trim()));

  // The full Firstbeat .xlsx export includes THREE row types per session:
  // "Measurement" (the complete session), "Lap" (a breakdown per drill/
  // segment), and "Team Session" (a sub-window of the session). "Measurement"
  // rows are the day totals we save to test_sessions; "Lap" rows are captured
  // separately below as the per-drill breakdown. "Team Session" rows are
  // redundant with Measurement and skipped entirely.
  let measurementRows=dataRows, lapRows=[];
  let skippedNonMeasurement=0;
  if(ci.period>=0){
    const before=dataRows.length;
    measurementRows=dataRows.filter(r=>(r[ci.period]||'').trim().toLowerCase()==='measurement');
    lapRows=dataRows.filter(r=>(r[ci.period]||'').trim().toLowerCase()==='lap');
    skippedNonMeasurement=before-measurementRows.length-lapRows.length;
  }

  const entries=measurementRows.map(row=>{
    const name=(row[ci.name]||'').trim();
    const date=parseFBDate(row[ci.date]);
    if(!name||!date) return null;
    const durationMin=ci.duration>=0?parseDurationMin(row[ci.duration]):null;
    const trimp=ci.trimp>=0?parseFloat(row[ci.trimp]):null;
    const movement=ci.movement>=0?parseFloat(row[ci.movement]):null;
    const acute=ci.acute>=0?parseFloat(row[ci.acute]):null;
    const chronic=ci.chronic>=0?parseFloat(row[ci.chronic]):null;
    const acwr=ci.acwr>=0?parseFloat(row[ci.acwr]):null;
    return {
      name, date,
      session_type: ci.type>=0?(row[ci.type]||'').trim()||null:null,
      drill_name:   ci.title>=0?(row[ci.title]||'').trim()||null:null,
      trimp_total:  !isNaN(trimp)?trimp:null,
      trimp_per_min:ci.trimpMin>=0&&!isNaN(parseFloat(row[ci.trimpMin]))?parseFloat(row[ci.trimpMin]):null,
      avg_hr:       ci.avgHr>=0&&!isNaN(parseFloat(row[ci.avgHr]))?parseFloat(row[ci.avgHr]):null,
      session_duration_min: durationMin,
      effic_score:  (movement&&trimp&&trimp>0)?parseFloat((movement/trimp).toFixed(2)):null,
      // Firstbeat computes these itself from its own longer history — use its
      // numbers directly rather than our own same-import rolling estimate.
      acute_load:   acute!=null&&!isNaN(acute)?parseFloat(acute.toFixed(1)):null,
      chronic_load: chronic!=null&&!isNaN(chronic)?parseFloat(chronic.toFixed(1)):null,
      acwr:         acwr!=null&&!isNaN(acwr)?parseFloat(acwr.toFixed(2)):null,
    };
  }).filter(Boolean);

  if(!entries.length){
    setDZState('idle');
    showMsg('csv-msgs','err','No valid Firstbeat sessions found in file.'+(skippedNonMeasurement?` (${skippedNonMeasurement} Lap/Team Session rows were skipped)`:''));
    return;
  }

  // Per-drill breakdown (Lap rows) — same columns, but keyed to a drill name
  // rather than being a whole-day total. Kept separate from `entries` since
  // these save to a different table (session_drills, not test_sessions).
  const drillEntries=lapRows.map(row=>{
    const name=(row[ci.name]||'').trim();
    const date=parseFBDate(row[ci.date]);
    const drillName=ci.title>=0?(row[ci.title]||'').trim():'';
    if(!name||!date||!drillName) return null;
    const durationMin=ci.duration>=0?parseDurationMin(row[ci.duration]):null;
    const trimp=ci.trimp>=0?parseFloat(row[ci.trimp]):null;
    const avgHr=ci.avgHr>=0?parseFloat(row[ci.avgHr]):null;
    const trimpMin=ci.trimpMin>=0?parseFloat(row[ci.trimpMin]):null;
    const movement=ci.movement>=0?parseFloat(row[ci.movement]):null;
    return {
      name, date, drill_name:drillName,
      trimp: !isNaN(trimp)?trimp:null,
      duration_min: durationMin,
      avg_hr: !isNaN(avgHr)?avgHr:null,
      trimp_per_min: !isNaN(trimpMin)?trimpMin:null,
      movement_load: !isNaN(movement)?movement:null,
    };
  }).filter(Boolean);

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

  // Resolve drill entries to the same canonical names (unmatched drill rows
  // are simply dropped — no point storing per-drill data for an athlete we
  // can't even attach the day-total session to).
  const resolvedDrills=[];
  for(const d of drillEntries){
    const m=context.api.findBestMatch(d.name);
    if(m&&m.matchType!=='ambiguous-last-name'){
      resolvedDrills.push({...d, canonicalName:m.athlete._canonicalName||m.athlete.name, athleteId:m.athlete.id});
    }
  }
  processRows._kinexonDrills=resolvedDrills;

  // Store and show preview
  parsedData=[...matched,...unmatched];
  processRows._isKinexonImport=true;
  processRows._kinexonSessions=parsedData;
  processRows._kinexonEventLevel=true; // one row per athlete/session already — no aggregation needed

  const fname=readFile._lastName||'firstbeat.csv';
  document.getElementById('dz-file-name').textContent='✓ '+fname+' (Firstbeat HR sessions)';
  document.getElementById('dz-athlete-count').textContent=
    `${matched.length} athletes matched · ${[...new Set(entries.map(e=>e.date))].length} date(s)`+
    (unmatched.length?` · ${unmatched.length} unmatched`:' · All matched to roster')+
    (resolvedDrills.length?` · ${resolvedDrills.length} drill rows captured`:'');

  const nameInfo=matched.filter(e=>e.name!==e.canonicalName)
    .slice(0,3).map(e=>`${e.name} → ${e.canonicalName}`).join(', ');

  document.getElementById('col-map-tbl').innerHTML=
    `<div class="ok">Firstbeat export detected · ${matched.length} sessions · auto-matched to roster${skippedNonMeasurement?` · ${skippedNonMeasurement} Team Session rows skipped`:''}${resolvedDrills.length?` · ${resolvedDrills.length} per-drill rows will be saved too`:''}</div>`+
    (nameInfo?`<div class="ok">Name variants resolved: ${nameInfo}</div>`:'')+
    (unmatched.length?`<div class="warn">${unmatched.length} unmatched: ${unmatched.map(e=>e.name).join(', ')}</div>`:'');
  warnKinexonCollisions(matched);
  warnRosterAthletesMissingFromFile(matched);

  // Preview table
  document.getElementById('csv-data-prev').innerHTML=`
    <table class="prev-tbl"><thead><tr>
      <th>Athlete</th><th>Date</th><th>Type</th><th>TRIMP</th><th>Duration</th><th>Avg HR</th>
    </tr></thead><tbody>${parsedData.slice(0,10).map(e=>`<tr>
      <td>${e.canonicalName}</td>
      <td style="font-family:var(--fm)">${e.date}</td>
      <td>${e.session_type||'—'}</td>
      <td style="color:var(--orange);font-family:var(--fm)">${e.trimp_total??'—'}</td>
      <td>${e.session_duration_min?e.session_duration_min+' min':'—'}</td>
      <td style="color:#F87171;font-family:var(--fm)">${e.avg_hr??'—'}</td>
    </tr>`).join('')}</tbody></table>
    ${parsedData.length>10?`<div style="font-size:9px;color:var(--text3);margin-top:6px;">... +${parsedData.length-10} more</div>`:''}`;

  setDZState('ready');
}

// ── Row Dispatcher ──────────────────────────────────────────────
// Reference: originals/hockey.html:4951
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
  const metricKeys=['approachJump','cmjHeight','standVert','sprint10','peakPower','rsi','asymmetry','eccRFD','concImpulse','eccImpulse','contractionTime','jumpVol','avgJumpHt','playerLoad','acuteLoad','chronicLoad','frontSquatMax','ngChinUp','onIceBeep','benchMax','hangCleanMax'];
  const presentKeys=new Set(metricKeys.filter(k=>colIdx[k]!==null));
  if(colIdx.pos!==null) presentKeys.add('pos');
  if(colIdx.yr!==null) presentKeys.add('yr');
  if(colIdx.age!==null) presentKeys.add('age');
  processRows._presentKeys=presentKeys;

  const athletes=data.map((row,ri)=>{
    const name=colIdx.name!==null?row[colIdx.name]?.trim():'';if(!name)return null;
    const get=(f,def)=>colIdx[f]!==null&&row[colIdx[f]]!==undefined?row[colIdx[f]].trim():def;
    const num=(f)=>{const v=parseFloat(get(f,''));return isNaN(v)?null:v;};

    // Position: use from CSV if present, otherwise try to match to existing athlete, else default F
    const hasPos=colIdx.pos!==null;
    const rawPos=hasPos?get('pos',''):'';
    let pos='F';
    if(hasPos&&rawPos){
      pos=context.api.POSITIONS.includes(rawPos)?rawPos:(context.api.POSITIONS.find(p=>rawPos.toLowerCase().includes(p.toLowerCase()))||'F');
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
      approachJump:num('approachJump')?? null,
      cmjHeight:cmj?? null,
      standVert:num('standVert')?? null,
      sprint10:num('sprint10')?? null,
      peakPower:pp?? null,
      rsi:num('rsi')?? null,
      asymmetry:num('asymmetry')?? null,
      eccRFD:num('eccRFD')?? null,
      concImpulse:num('concImpulse')?? null,
      eccImpulse:num('eccImpulse')?? null,
      contractionTime:num('contractionTime')?? null,
      jumpVol:num('jumpVol')?? null,
      avgJumpHt:avgJH?? null,
      playerLoad:num('playerLoad')?? null,
      acuteLoad:num('acuteLoad')?? null,
      chronicLoad:num('chronicLoad')?? null,
      frontSquatMax:num('frontSquatMax')?? null,
      ngChinUp:num('ngChinUp')?? null,
      onIceBeep:num('onIceBeep')?? null,
      benchMax:num('benchMax')?? null,
      hangCleanMax:num('hangCleanMax')?? null,
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
// Reference: originals/hockey.html:5067
const TB_EX_MAP = {
  'front squat':     'frontSquatMax',
  'neutral grip chin up':'ngChinUp',
  'ng chin up':      'ngChinUp',
  'chin up':         'ngChinUp',
  'bench press':          'benchMax',
  'barbell bench press':  'benchMax',
  'bb bench press':       'benchMax',
  'hang clean':           'hangCleanMax',
  'barbell hang clean':   'hangCleanMax',
  '10y sprint':      'sprint10',
  '10-yd sprint':    'sprint10',
  '10 yd sprint':    'sprint10',
  '10 yard sprint':  'sprint10',
  '10yd sprint':     'sprint10',
};

// Metrics where a LOWER value is the better/all-time-best result (e.g. sprint times).
// Everything else in TB_EX_MAP is "bigger is better" (squat/bench/vert), which is
// the default assumption below.
// Reference: originals/hockey.html:5086
const TB_LOWER_IS_BETTER = new Set(['sprint10']);


// Reference: originals/hockey.html:5088
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


// Reference: originals/hockey.html:5108
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
  const presentKeys = new Set(['standVert','frontSquatMax','ngChinUp','onIceBeep','benchMax','hangCleanMax','sprint10',
    'standVertDate','frontSquatMaxDate','ngChinUpDate','onIceBeepDate','benchMaxDate','hangCleanMaxDate','sprint10Date']);

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
  const previewCols = ['name','standVert','frontSquatMax','ngChinUp','onIceBeep','benchMax','hangCleanMax','sprint10'];
  const previewLabels = ['Athlete','Goal-Blue (s)','Front Squat','NG Chin Up','On-Ice Beep','Bench Press','Hang Clean','10-yd (s)'];
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


// Reference: originals/hockey.html:5240
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


// Reference: originals/hockey.html:5275
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
  else if(!hasPos) notices+=`<div class="warn">No position column — athletes will default to F. Add a "Position" column or use Smart Match after uploading your roster.</div>`;
  if(notices) msgs.innerHTML=notices;

  // Column mapping
  document.getElementById('col-map-tbl').innerHTML=`<table class="map-tbl"><thead><tr><th>Field</th><th>CSV Column Detected</th><th>Status</th></tr></thead><tbody>${mapInfo.map(m=>`<tr><td>${m.field}</td><td class="${m.found?'mc':'sk'}">${m.found||'—'}</td><td class="${m.found?'mc':m.field==='name'?'req':'sk'}">${m.found?'✓ Mapped':m.field==='name'?'⚠ REQUIRED':'– Skipped'}</td></tr>`).join('')}</tbody></table>`;
  showDataPreview(athletes);
}


// Reference: originals/hockey.html:5301
function showDataPreview(athletes){
  const prev=athletes.slice(0,4);
  const cols=['name','pos','approachJump','cmjHeight','peakPower','rsi','asymmetry','jumpVol','composite','tier'];
  const hdrs=['Name','Pos','App Jmp','CMJ','Pk Pwr','RSI','Asym%','Jmp Vol','Score','Tier'];
  document.getElementById('csv-data-prev').innerHTML=`<div style="font-size:9px;color:var(--text3);font-family:var(--fm);letter-spacing:1px;margin-bottom:6px;">PREVIEW (${Math.min(4,athletes.length)} of ${athletes.length} athletes)</div><table class="prev-tbl"><thead><tr>${hdrs.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${prev.map(a=>`<tr>${cols.map(k=>`<td>${typeof a[k]==='number'&&!Number.isInteger(a[k])?a[k].toFixed(2):a[k]}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}


// Reference: originals/hockey.html:5308
function showMsg(el,type,txt){
  const d=document.getElementById(el);
  if(!d) return;
  d.innerHTML=`<div class="${type}">${txt}</div>`;
  // Error/warning messages are easy to miss if they land below the visible
  // part of the import modal (e.g. on a smaller screen) — force them into view.
  if(type==='err'||type==='warn') d.scrollIntoView({behavior:'smooth',block:'nearest'});
}

// ── Kinexon same-day session merging ─────────────────────────────
// If an athlete already has a Kinexon row for a given date and a new
// import brings in another session for that same date, we SUM the two
// (rather than silently overwriting one with the other) and surface it.
// Reference: originals/hockey.html:5321
const fmtAccel=v=>v==null?'0':(Number(v).toFixed?Number(v).toFixed(1):v);


// Reference: originals/hockey.html:5322
function mergeKinexonSessions(oldRow,newRow){
  const merged={...newRow};
  // TRIMP and duration make sense to sum (two sessions same day = more total load).
  const sumKeys=['trimp_total','session_duration_min'];
  for(const k of sumKeys){
    const a=oldRow[k],b=newRow[k];
    merged[k]=(a==null&&b==null)?null:(a==null?0:Number(a))+(b==null?0:Number(b));
  }
  // HR and efficiency are rates, not totals — average them instead of summing.
  const avgKeys=['avg_hr','effic_score'];
  for(const k of avgKeys){
    const a=oldRow[k],b=newRow[k];
    if(a==null&&b==null) merged[k]=null;
    else if(a==null) merged[k]=b;
    else if(b==null) merged[k]=a;
    else merged[k]=parseFloat(((Number(a)+Number(b))/2).toFixed(2));
  }
  if(merged.session_duration_min>0){
    merged.trimp_per_min=merged.trimp_total!=null?parseFloat((merged.trimp_total/merged.session_duration_min).toFixed(2)):null;
  } else {
    merged.trimp_per_min=newRow.trimp_per_min??oldRow.trimp_per_min??null;
  }
  merged.session_type=(oldRow.session_type&&newRow.session_type&&oldRow.session_type!==newRow.session_type)
    ?`${oldRow.session_type} + ${newRow.session_type}`
    :(newRow.session_type||oldRow.session_type||null);
  return merged;
}

// Preview-stage advisory: warn (before commit) when an athlete/date pair
// in the file being previewed already has a saved Kinexon session, so the
// coach knows totals will be combined rather than replaced.
// Reference: originals/hockey.html:5353
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
      .select('athlete_name,test_date,trimp_total,avg_hr')
      .in('test_date',dates).not('trimp_total','is',null);
    if(error||!data) return;
    existing=data;
  }catch(e){return;}
  if(!existing.length) return;
  const collisions=entries.filter(e=>existing.some(r=>context.api.normName(r.athlete_name)===context.api.normName(e.canonicalName||e.name)&&r.test_date===e.date));
  if(!collisions.length) return;
  kinexonCollisionDetected=true;
  const rows=collisions.map(e=>{
    const prev=existing.find(r=>context.api.normName(r.athlete_name)===context.api.normName(e.canonicalName||e.name)&&r.test_date===e.date);
    return `<div>${e.canonicalName||e.name} — ${context.api.fmtDate(e.date)||e.date}: existing ${prev.trimp_total??0} TRIMP`+
      `${prev.avg_hr!=null?` / ${fmtAccel(prev.avg_hr)} bpm`:''} → this file's ${e.trimp_total??0} TRIMP`+
      `${e.avg_hr!=null?` / ${fmtAccel(e.avg_hr)} bpm`:''}</div>`;
  }).join('');
  const msgs=document.getElementById('csv-msgs');
  if(msgs) msgs.innerHTML+=`<div class="warn">`+
    `<b>ℹ ${collisions.length} athlete/date pair${collisions.length!==1?'s':''} already ${collisions.length!==1?'have':'has'} a Firstbeat session logged for that day.</b> `+
    `Importing will replace the existing total with this file's number (multiple same-day sessions for the same athlete in this file are already summed together automatically):`+
    `<div style="margin-top:6px;font-family:var(--fm);font-size:11px;line-height:1.5;">${rows}</div>`+
    `</div>`;
}

// Preview-stage advisory: flag current roster athletes who simply have NO
// row at all in the file being imported, so a coach isn't left guessing
// whether "no data" means a real gap (sensor not worn, didn't participate)
// or a silent matching failure.
// Reference: originals/hockey.html:5391
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
// Reference: originals/hockey.html:5405
function smartMergeInto(incoming, presentKeys, fname){
  let updated=0, added=0;
  const stamped=incoming.map(a=>context.api.logSource({...a},fname,presentKeys));
  for(const a of stamped){
    if(context.api.isFormerPlayer(a.name)) continue;
    const match=context.api.findBestMatch(a.name);
    if(match&&match.matchType!=='ambiguous-last-name'){
      const idx=context.api.ATHLETES.findIndex(x=>x.id===match.athlete.id);
      if(idx>=0){
        context.api.ATHLETES[idx]=context.api.mergeAthleteRecords(context.api.ATHLETES[idx],a,presentKeys,fname);
        updated++;
      }
    } else if(!match){
      const mx=context.api.ATHLETES.reduce((m,x)=>Math.max(m,x.id),-1);
      const parts=a.name.trim().split(/\s+/);
      const newA={
        pos:'F', yr:'Jr', age:20, av:context.api.avCls(context.api.ATHLETES.length%6),
        initials:(parts[0]?.[0]||'?')+(parts[parts.length-1]?.[0]||''),
        ...a, // any of these the import actually provided (e.g. a real Position column) win
        id:mx+1, _canonicalName:a.name, _nameLocked:false, _posLocked:false,
      };
      context.api.ATHLETES.push(newA);
      added++;
    }
    // ambiguous-last-name: skip silently (commitSmartMatch shows it for review)
  }
  return {updated,added};
}

// After any CSV import that included a metric + its paired date column
// (e.g. Single-Test Leaderboard, Custom/Standard, Teambuildr Maxes), log
// each dated value into kpi_history too — so long-term progress tracking
// keeps building automatically from normal imports, not just this backfill.
// Only logs for athletes who already existed on the roster before this
// import (a real database id is required); brand-new athletes start
// accumulating history from their next test onward.
// Reference: originals/hockey.html:5441
async function logKpiHistoryFromImport(rows, presentKeys, source){
  if(!rows||!rows.length||!presentKeys) return;
  const metricKeys=[...presentKeys].filter(k=>presentKeys.has(k+'Date')&&context.api.getM(k));
  if(!metricKeys.length) return;
  for(const row of rows){
    if(context.api.isFormerPlayer(row.name)) continue;
    const athlete=context.api.ATHLETES.find(a=>context.api.athleteKey(a)===context.api.nameKey(row.name));
    if(!athlete) continue;
    for(const key of metricKeys){
      const val=row[key], date=row[key+'Date'];
      if(val==null||!date) continue;
      await context.api.logKpiHistory(athlete, key, date, val, source);
    }
  }
}


// Reference: originals/hockey.html:5457
async function commitCSV(replace){
  if(!parsedData||!parsedData.length){
    showMsg('csv-msgs','err','No data parsed yet — upload a CSV file first.');return;
  }

  // Long-Term History (Wide Format) import
  if(processRows._isLongTermImport){
    const entries=processRows._longTermEntries||[];
    context.api.setSyncStatus('syncing','SAVING HISTORY');
    const btnRow=document.getElementById('commit-buttons-row'), progRow=document.getElementById('commit-progress-row');
    if(btnRow) btnRow.style.display='none';
    if(progRow) progRow.style.display='block';
    const label=document.getElementById('commit-progress-label'), cnt=document.getElementById('commit-progress-count'), fill=document.getElementById('commit-progress-fill');
    if(label) label.textContent=`SAVING ${entries.length} HISTORY ENTRIES...`;

    // 1. Log every dated entry to kpi_history (full history, not just latest).
    //    Athletes not yet on the roster are created first via the standard
    //    Update/Add-by-Name path so they get a real database id to log against.
    // Former players are skipped entirely. Unknown names still get added, but
    // history is matched by NAME so no wait for database ids is needed.
    const newNames=[...new Set(entries.filter(e=>!context.api.isFormerPlayer(e.canonicalName)&&!context.api.ATHLETES.some(a=>context.api.athleteKey(a)===context.api.nameKey(e.canonicalName))).map(e=>e.canonicalName))];
    if(newNames.length){
      const newRows=newNames.map(name=>({name}));
      smartMergeInto(newRows,new Set(),readFile._lastName||_lastLongTermFileName||'longterm-import');
    }

    let done=0;
    for(const e of entries){
      const athlete=context.api.isFormerPlayer(e.canonicalName)?null:context.api.ATHLETES.find(a=>context.api.athleteKey(a)===context.api.nameKey(e.canonicalName));
      if(athlete){
        await context.api.logKpiHistory(athlete, e.metricKey, e.date, e.value, _lastLongTermFileName||'longterm-import');
      }
      done++;
      if(cnt) cnt.textContent=`${done} / ${entries.length}`;
      if(fill) fill.style.width=Math.round(done/entries.length*100)+'%';
    }

    // 2. Update each athlete's CURRENT value for each metric to their most
    //    recent test, so the rest of the app (Team Dashboard, composite
    //    score, leaderboards) reflects this import too, not just the
    //    Progress Tracking page.
    const latestByAthleteMetric={};
    for(const e of entries){
      const key=`${context.api.normName(e.canonicalName)}|${e.metricKey}`;
      if(!latestByAthleteMetric[key]||e.date>latestByAthleteMetric[key].date) latestByAthleteMetric[key]=e;
    }
    const byAthlete={};
    for(const e of Object.values(latestByAthleteMetric)){
      if(!byAthlete[e.canonicalName]) byAthlete[e.canonicalName]={name:e.canonicalName};
      byAthlete[e.canonicalName][e.metricKey]=e.value;
      byAthlete[e.canonicalName][e.metricKey+'Date']=e.date;
    }
    const currentValueRows=Object.values(byAthlete);
    const presentKeysForUpdate=new Set();
    for(const row of currentValueRows) for(const k of Object.keys(row)) if(k!=='name') presentKeysForUpdate.add(k);
    smartMergeInto(currentValueRows,presentKeysForUpdate,_lastLongTermFileName||'longterm-import');

    await context.api.loadKpiHistory();context.api.applyBestRecentValues();

    parsedData=null;
    processRows._isLongTermImport=false;
    processRows._longTermEntries=null;
    context.api.setSyncStatus('online','SYNCED');
    if(btnRow) btnRow.style.display='flex';
    if(progRow) progRow.style.display='none';
    context.api.refreshAll();closeImport();
    context.api.postImportPositionCheck();
    if(context.api.unsetCount()===0) context.navigate('dashboard');
    context.api.toast(`✓ ${entries.length} history entries saved across ${Object.keys(byAthlete).length} athletes`, 7000);
    return;
  }

  // Kinexon per-athlete import
  if(processRows._isKinexonImport){
    if(kinexonCommitLock){
      context.api.toast('Import already in progress — please wait.');
      return;
    }
    kinexonCommitLock=true;
    const replaceBtn=document.getElementById('commit-replace-btn'),updateBtn=document.getElementById('commit-update-btn');
    [replaceBtn,updateBtn].forEach(b=>{if(b){b.disabled=true;b.style.opacity='0.5';b.style.pointerEvents='none';}});

    const isEventLevel=processRows._kinexonEventLevel;
    const sessions=processRows._kinexonSessions||[];
    const drills=processRows._kinexonDrills||[];
    let sessionRows=[];

    if(isEventLevel){
      sessionRows=sessions.map(e=>({
        athlete_name:        e.canonicalName||e.name,
        test_date:            e.date,
        session_type:        e.session_type||'Training',
        drill_name:           e.drill_name||null,
        trimp_total:          e.trimp_total??null,
        trimp_per_min:        e.trimp_per_min??null,
        avg_hr:               e.avg_hr??null,
        effic_score:          e.effic_score??null,
        session_duration_min: e.session_duration_min||null,
        acute_load:           e.acute_load??null,
        chronic_load:         e.chronic_load??null,
        acwr:                 e.acwr??null,
      }));
    } else {
      const sel=document.getElementById('kinexon-athlete-sel');
      const athleteId=sel?parseInt(sel.value):null;
      if(!athleteId){
        showMsg('csv-msgs','err','Please select an athlete for this file before importing.');
        kinexonCommitLock=false;
        [replaceBtn,updateBtn].forEach(b=>{if(b){b.disabled=false;b.style.opacity='1';b.style.pointerEvents='';}});
        return;
      }
      const athlete=context.api.ATHLETES.find(a=>a.id===athleteId);
      if(!athlete){showMsg('csv-msgs','err','Athlete not found.');kinexonCommitLock=false;return;}
      const canonicalName=athlete._canonicalName||athlete.name;
      sessionRows=sessions.map(s=>({
        athlete_name: canonicalName,
        test_date:    s.test_date,
        session_type: s.session_type,
        trimp_total:  s.trimp_total??null,
        avg_hr:       s.avg_hr??null,
      }));
    }

    context.api.setSyncStatus('syncing','SAVING SESSIONS');
    const btnRow=document.getElementById('commit-buttons-row'), progRow=document.getElementById('commit-progress-row');
    if(btnRow) btnRow.style.display='none';
    if(progRow) progRow.style.display='block';
    const label=document.getElementById('commit-progress-label'), cnt=document.getElementById('commit-progress-count'), fill=document.getElementById('commit-progress-fill');
    if(label) label.textContent=`SAVING ${sessionRows.length} SESSIONS...`;

    let saved=0, firstError=null, drillsSaved=0;
    if(context.api.sb&&context.api.currentUser){
      const result=await context.api.saveTestSessions(sessionRows,(done,total)=>{
        if(cnt) cnt.textContent=`${done} / ${total}`;
        if(fill) fill.style.width=(total?Math.round(done/total*100):0)+'%';
      });
      saved=result.saved; firstError=result.firstError;
      if(drills.length){
        if(label) label.textContent=`SAVING ${drills.length} DRILL ROWS...`;
        drillsSaved=await context.api.saveSessionDrills(drills);
      }
    } else {
      console.warn('Firstbeat save: no Supabase connection or not logged in');
    }

    parsedData=null;
    processRows._isKinexonImport=false;
    processRows._kinexonSessions=null;
    processRows._kinexonEventLevel=false;
    processRows._kinexonDrills=null;
    context.api.setSyncStatus('online','SYNCED');
    kinexonCommitLock=false;
    if(btnRow) btnRow.style.display='flex';
    if(progRow) progRow.style.display='none';
    [replaceBtn,updateBtn].forEach(b=>{if(b){b.disabled=false;b.style.opacity='1';b.style.pointerEvents='';}});
    closeImport();
    await context.api.loadAllSessions();
    context.refreshFeature('forceplate');
    if(document.getElementById('page-readiness')?.classList.contains('active')) context.refreshFeature('readiness'); // new dates show up in the dropdown right away
    if(saved===0&&firstError){
      context.api.toast(`⚠ 0 of ${sessionRows.length} saved — error: ${firstError}`, 12000);
    } else {
      context.api.toast(`✓ ${saved} of ${sessionRows.length} sessions saved`+
        (drillsSaved?` · ${drillsSaved} drill rows`:'')+
        (saved<sessionRows.length&&firstError?` (error on rest: ${firstError})`:''), 7000);
    }
    context.navigate('workload');
    return;
  }

  // Session-style import: save to test_sessions table, no athlete record changes
  if(processRows._isSessionImport){
    const count=parsedData.length;
    context.api.setSyncStatus('syncing','SAVING SESSIONS');
    const btnRow=document.getElementById('commit-buttons-row'), progRow=document.getElementById('commit-progress-row');
    if(btnRow) btnRow.style.display='none';
    if(progRow) progRow.style.display='block';
    const label=document.getElementById('commit-progress-label'), cnt=document.getElementById('commit-progress-count'), fill=document.getElementById('commit-progress-fill');
    if(label) label.textContent=`SAVING ${count} SESSIONS...`;
    const {saved,firstError}=await context.api.saveTestSessions(parsedData,(done,total)=>{
      if(cnt) cnt.textContent=`${done} / ${total}`;
      if(fill) fill.style.width=(total?Math.round(done/total*100):0)+'%';
    });
    parsedData=null;
    processRows._isSessionImport=false;
    context.api.setSyncStatus('online','SYNCED');
    if(btnRow) btnRow.style.display='flex';
    if(progRow) progRow.style.display='none';
    closeImport();
    await context.api.loadAllSessions();
    context.refreshFeature('forceplate');
    if(document.getElementById('page-readiness')?.classList.contains('active')) context.refreshFeature('readiness'); // new dates show up in the dropdown right away
    if(saved===0&&firstError){
      context.api.toast(`⚠ 0 of ${count} saved — error: ${firstError}`, 12000);
    } else {
      context.api.toast(`✓ ${saved} of ${count} test sessions saved`+(saved<count&&firstError?` (error on rest: ${firstError})`:''), 7000);
    }
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
      approach_vert: s.approach_vert,
      approach_height_inches: s.approach_height_inches, // real touch height, kept separately so future PR-recovery queries compare the right metric
      source_file: s.source_file,
    }));
    const {saved,firstError:approachVertErr}=await context.api.saveTestSessions(sessionRows);
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
        // Add as new athlete (touch-only entry; position defaults to F until Roster Setup confirms)
        const initials=(s.athlete_name.split(' ')[0]?.[0]||'?')+(s.athlete_name.split(' ')[1]?.[0]||'');
        const newAthlete={
          id:context.api.ATHLETES.reduce((m,a)=>Math.max(m,a.id),-1)+1,
          name:s.athlete_name,
          _canonicalName:s.athlete_name,
          initials,
          pos:'F', yr:'Jr', age:20,
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
    context.api.toast(`✓ ${saved} sessions saved · ${athletesUpdated} new PR${athletesUpdated!==1?'s':''}${athletesSkippedNotPR?` · ${athletesSkippedNotPR} not a PR (kept existing best)`:''}${athletesAdded?` · ${athletesAdded} new added`:''}`+(saved===0&&approachVertErr?` — error: ${approachVertErr}`:''));
    return;
  }

  // Teambuildr comparison report: update/merge strength fields only
  if(processRows._isTBComparison){
    const updates=parsedData;
    const presentKeys=processRows._presentKeys||new Set(['standVert','frontSquatMax','ngChinUp','onIceBeep','benchMax','hangCleanMax']);
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
          pos:'F',yr:'Jr',age:20,av:context.api.avCls(context.api.ATHLETES.length%6),
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
    const rowsForHistory=parsedData;
    parsedData=null;
    await logKpiHistoryFromImport(rowsForHistory,presentKeys,fname);
    await context.api.loadKpiHistory();context.api.applyBestRecentValues();
    context.api.refreshAll();closeImport();
    context.api.postImportPositionCheck();
    if(context.api.unsetCount()===0) context.navigate('dashboard');
    context.api.toast(`✓ Replaced roster — ${count} athletes loaded`);
  } else {
    const {updated,added}=smartMergeInto(parsedData,presentKeys,fname);
    const rowsForHistory=parsedData;
    parsedData=null;
    await logKpiHistoryFromImport(rowsForHistory,presentKeys,fname);
    await context.api.loadKpiHistory();context.api.applyBestRecentValues();
    context.api.refreshAll();closeImport();
    context.api.postImportPositionCheck();
    if(context.api.unsetCount()===0) context.navigate('dashboard');
    context.api.toast(`✓ ${updated} updated · ${added} new added`);
  }
}


// Reference: originals/hockey.html:5820
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


// Reference: originals/hockey.html:5838
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


// Reference: originals/hockey.html:5856
function resetCSVUI(){
  parsedData=null;
  readFile._lastName=null;
  setDZState('idle');
  document.getElementById('csv-input').value='';
  document.getElementById('csv-msgs').innerHTML='';
  document.getElementById('col-map-tbl').innerHTML='';
  document.getElementById('csv-data-prev').innerHTML='';
}


// Reference: originals/hockey.html:5865
function loadForEdit(){
  const id=document.getElementById('man-edit-sel').value;document.getElementById('man-ok').style.display='none';
  if(!id){clearManual();document.getElementById('man-del-btn').style.display='none';manEditId=null;return;}
  const a=context.api.ATHLETES.find(x=>x.id===parseInt(id));if(!a)return;
  manEditId=a.id;
  const s=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
  s('m-name',a.name);s('m-pos',a.pos);s('m-yr',a.yr);s('m-age',a.age);
  s('m-appr',a.approachJump);s('m-cmj',a.cmjHeight);s('m-vert',a.standVert);s('m-s10',a.sprint10);
  s('m-fs',a.frontSquatMax);s('m-ngc',a.ngChinUp);s('m-beep',a.onIceBeep);s('m-bench',a.benchMax);s('m-hc',a.hangCleanMax);
  s('m-pp',a.peakPower);s('m-rsi',a.rsi);s('m-asym',a.asymmetry);s('m-rfd',a.eccRFD);s('m-ci',a.concImpulse);s('m-ei',a.eccImpulse);s('m-ct',a.contractionTime);
  s('m-jv',a.jumpVol);s('m-ajh',a.avgJumpHt);s('m-pl',a.playerLoad);s('m-al',a.acuteLoad);s('m-cl',a.chronicLoad);
  document.getElementById('man-del-btn').style.display='';
}


// Reference: originals/hockey.html:5878
function clearManual(){['m-name','m-pos','m-yr','m-age','m-appr','m-cmj','m-vert','m-s10','m-fs','m-ngc','m-beep','m-bench','m-hc','m-pp','m-rsi','m-asym','m-rfd','m-ci','m-ei','m-ct','m-jv','m-ajh','m-pl','m-al','m-cl'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});document.getElementById('man-del-btn').style.display='none';document.getElementById('man-ok').style.display='none';document.getElementById('man-msgs').innerHTML='';manEditId=null;}


// Reference: originals/hockey.html:5879
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
    approachJump:gn('m-appr')?? null,
    cmjHeight:gn('m-cmj')?? null,
    standVert:gn('m-vert')?? null,
    sprint10:gn('m-s10')?? null,
    frontSquatMax:gn('m-fs')?? null,
    ngChinUp:gn('m-ngc')?? null,
    onIceBeep:gn('m-beep')?? null,
    benchMax:gn('m-bench')?? null,
    hangCleanMax:gn('m-hc')?? null,
    peakPower:gn('m-pp')?? null,
    rsi:gn('m-rsi')?? null,
    asymmetry:gn('m-asym')?? null,
    eccRFD:gn('m-rfd')?? null,
    concImpulse:gn('m-ci')?? null,
    eccImpulse:gn('m-ei')?? null,
    contractionTime:gn('m-ct')?? null,
    jumpVol:gn('m-jv')?? null,
    avgJumpHt:gn('m-ajh')?? null,
    playerLoad:gn('m-pl')?? null,
    acuteLoad:gn('m-al')?? null,
    chronicLoad:gn('m-cl')?? null,
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


// Reference: originals/hockey.html:5921
function deleteAthlete(){
  if(manEditId===null)return;
  const a=context.api.ATHLETES.find(x=>x.id===manEditId);if(!a)return;
  if(!confirm(`Remove ${a.name}?`))return;
  context.api.ATHLETES=context.api.ATHLETES.filter(x=>x.id!==manEditId);context.api.refreshAll();context.navigate('dashboard');clearManual();
  const sel=document.getElementById('man-edit-sel');sel.innerHTML='<option value="">— new athlete —</option>'+context.api.ATHLETES.map(x=>`<option value="${x.id}">${x.name} (${x.pos})</option>`).join('');
  context.api.toast(`Removed ${a.name}`);
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
  parseCSVToRows: {enumerable:true, configurable:true, get:()=>parseCSVToRows},
  setDZState: {enumerable:true, configurable:true, get:()=>setDZState},
  initDropZone: {enumerable:true, configurable:true, get:()=>initDropZone},
  parseCSV: {enumerable:true, configurable:true, get:()=>parseCSV},
  extractDateFromTitle: {enumerable:true, configurable:true, get:()=>extractDateFromTitle},
  processSessionRows: {enumerable:true, configurable:true, get:()=>processSessionRows},
  _lastSingleTestRows: {enumerable:true, configurable:true, get:()=>_lastSingleTestRows, set:value=>{_lastSingleTestRows=value;}},
  _lastSingleTestFileName: {enumerable:true, configurable:true, get:()=>_lastSingleTestFileName, set:value=>{_lastSingleTestFileName=value;}},
  SINGLETEST_METRIC_HINTS: {enumerable:true, configurable:true, get:()=>SINGLETEST_METRIC_HINTS},
  processSingleTestRows: {enumerable:true, configurable:true, get:()=>processSingleTestRows},
  runSingleTestParse: {enumerable:true, configurable:true, get:()=>runSingleTestParse},
  _lastLongTermRows: {enumerable:true, configurable:true, get:()=>_lastLongTermRows, set:value=>{_lastLongTermRows=value;}},
  _lastLongTermFileName: {enumerable:true, configurable:true, get:()=>_lastLongTermFileName, set:value=>{_lastLongTermFileName=value;}},
  processLongTermRows: {enumerable:true, configurable:true, get:()=>processLongTermRows},
  processApproachVertRows: {enumerable:true, configurable:true, get:()=>processApproachVertRows},
  processKinexonRows: {enumerable:true, configurable:true, get:()=>processKinexonRows},
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
  logKpiHistoryFromImport: {enumerable:true, configurable:true, get:()=>logKpiHistoryFromImport},
  commitCSV: {enumerable:true, configurable:true, get:()=>commitCSV},
  commitPaste: {enumerable:true, configurable:true, get:()=>commitPaste},
  parsePaste: {enumerable:true, configurable:true, get:()=>parsePaste},
  resetCSVUI: {enumerable:true, configurable:true, get:()=>resetCSVUI},
  loadForEdit: {enumerable:true, configurable:true, get:()=>loadForEdit},
  clearManual: {enumerable:true, configurable:true, get:()=>clearManual},
  submitManual: {enumerable:true, configurable:true, get:()=>submitManual},
  deleteAthlete: {enumerable:true, configurable:true, get:()=>deleteAthlete}
});
}
