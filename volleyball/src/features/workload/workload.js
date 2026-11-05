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
// Workload sort
// Reference: originals/volleyball.html:2343
const WL_SORT_KEYS = ['jumpVol','avgJumpHt','playerLoad','acuteLoad','chronicLoad','acwr'];


// Reference: originals/volleyball.html:2344
function populateWLSort(){
  context.api.populateMetricSelect('wl-sort', WL_SORT_KEYS);
}


// Reference: originals/volleyball.html:2592
let wlFocusAthlete=null;

// athlete id currently focused in history charts
// Reference: originals/volleyball.html:2594
function initWL(){
  const signal=context.signal;
  return context.api.loadAllSessions().then(()=>{
    if(signal?.aborted)return;
    console.log('WL: SESSIONS loaded, count=', context.api.SESSIONS.length, 'kinexon=', Object.keys(context.api.getKinexonSessions()).length);
    renderWLKpis(); renderWLBoard(); renderWLHistory();
  });
}


// Reference: originals/volleyball.html:2601
function renderWLKpis(){
  const kSessions=context.api.getKinexonSessions();

  // Populate date dropdown with all available session dates
  const allDates=[...new Set(Object.values(kSessions).flat().map(s=>s.test_date))].sort().reverse();
  const dateSel=document.getElementById('wl-date-sel');
  if(dateSel&&allDates.length){
    const currentVal=dateSel.value;
    dateSel.innerHTML=allDates.map(d=>`<option value="${d}">${context.api.fmtDate(d)||d}</option>`).join('');
    if(currentVal&&allDates.includes(currentVal)) dateSel.value=currentVal;
  } else if(dateSel){
    dateSel.innerHTML='<option value="">No sessions yet</option>';
  }

  const selectedDate=dateSel?.value||allDates[0]||null;

  // Populate athlete dropdown with athletes who have Kinexon sessions
  const athSel=document.getElementById('wl-athlete-sel');
  if(athSel){
    const currentAth=athSel.value;
    const athWithData=context.api.rosterAthletes().filter(a=>{
      const nm=context.api.normName(a._canonicalName||a.name);
      return kSessions[nm]||Object.keys(kSessions).some(k=>k.replace(/\s+/g,' ')===nm.replace(/\s+/g,' '));
    });
    athSel.innerHTML='<option value="">Team average</option>'+
      athWithData.map(a=>`<option value="${a.id}">${a._canonicalName||a.name} (${a.pos})</option>`).join('');
    if(currentAth) athSel.value=currentAth;
  }

  const latestPerAthlete=context.api.rosterAthletes().map(a=>{
    const nm=context.api.normName(a._canonicalName||a.name);
    let sessions=kSessions[nm];
    if(!sessions){
      const key=Object.keys(kSessions).find(k=>k===nm||k.replace(/\s+/g,' ')===nm.replace(/\s+/g,' '));
      sessions=key?kSessions[key]:null;
    }
    const dated=selectedDate?sessions?.find(s=>s.test_date===selectedDate):null;
    return dated||sessions?.[0]||null;
  }).filter(Boolean);
  if(!latestPerAthlete.length){
    document.getElementById('wl-kpis').innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text3);font-family:var(--fm);font-size:11px;">No Kinexon data yet. Import a Kinexon Export CSV to populate this page.</div>`;
    return;
  }
  const avg=k=>{const vals=latestPerAthlete.map(s=>s[k]).filter(v=>v!=null&&!isNaN(v));return vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:null;};
  const kpis=[
    {label:'Avg Accel Load',    value:avg('accel_load'),         fmt:v=>Math.round(v),  unit:'AU',       color:'#FE5000'},
    {label:'Avg Total Jumps',   value:avg('jumps_total'),        fmt:v=>Math.round(v),  unit:'jumps',    color:'#FCD34D'},
    {label:'Avg High Jumps',    value:avg('jumps_high'),         fmt:v=>Math.round(v),  unit:'≥ 0.98ft', color:'#4ADE80'},
    {label:'Avg Mid Jumps',     value:avg('jumps_mid'),          fmt:v=>Math.round(v),  unit:'0.66–0.98ft',color:'#60A5FA'},
    {label:'Athletes Tracked',  value:latestPerAthlete.length,   fmt:v=>v,              unit:'of '+context.api.rosterAthletes().length, color:'#CDA077'},
  ];
  document.getElementById('wl-kpis').innerHTML=kpis.map(k=>`
    <div class="kpi-card">
      <div class="kpi-lbl">${k.label}</div>
      <div class="kpi-val" style="color:${k.color};">${k.value!=null?k.fmt(k.value):'—'}</div>
      <div class="kpi-sub">${k.unit}</div>
    </div>`).join('');
}


// Reference: originals/volleyball.html:2660
function renderWLBoard(){
  const sortKey=document.getElementById('wl-sort')?.value||'jumpVol';
  const sortMap={jumpVol:'jumps_total',jumpsHigh:'jumps_high',jumpsMid:'jumps_mid',accelLoad:'accel_load',accelLoadPerMin:'accel_load_per_min',duration:'session_duration_min'};
  const sessionKey=sortMap[sortKey]||'jumps_total';
  const kSessions=context.api.getKinexonSessions();
  const selectedDate=document.getElementById('wl-date-sel')?.value||null;
  const medals=['🥇','🥈','🥉'];

  const rows=context.api.rosterAthletes().map(a=>{
    const nm=context.api.normName(a._canonicalName||a.name);
    let sessions=kSessions[nm];
    if(!sessions){
      const key=Object.keys(kSessions).find(k=>k===nm||k.replace(/\s+/g,' ')===nm.replace(/\s+/g,' '));
      sessions=key?kSessions[key]:null;
    }
    // Use selected date session, fallback to most recent
    const sess=selectedDate
      ? (sessions?.find(s=>s.test_date===selectedDate)||null)
      : (sessions?.[0]||null);
    return {a, sess};
  }).filter(r=>r.sess!=null)
    .sort((x,y)=>{
      const vx=x.sess[sessionKey]??-1;
      const vy=y.sess[sessionKey]??-1;
      return vy-vx;
    });

  if(!rows.length){
    document.getElementById('wl-tbody').innerHTML=`<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--text3);font-family:var(--fm);">No Kinexon session data. Import a Kinexon Export CSV.</td></tr>`;
    return;
  }

  document.getElementById('wl-tbody').innerHTML=rows.map(({a,sess},i)=>{
    const d=sess.test_date?context.api.fmtDate(sess.test_date):'—';

    // Traffic light color helper
    const tlColor=(v,lo,hi)=>{
      if(v==null) return 'var(--text3)';
      if(v>=hi)  return 'rgba(248,113,113,0.9)';  // red
      if(v>=lo)  return 'rgba(252,211,77,0.9)';   // yellow
      return            'rgba(74,222,128,0.9)';    // green
    };

    const td=(v,color='var(--text3)')=>v!=null&&v!==undefined
      ?`<td style="text-align:center;padding:5px 8px;font-family:var(--fm);font-size:11px;color:${color};">${v}</td>`
      :`<td style="text-align:center;padding:5px 8px;font-family:var(--fm);font-size:11px;color:var(--text3);">—</td>`;

    const durMin=sess.session_duration_min!=null?Math.round(sess.session_duration_min):null;
    const highJumps=sess.jumps_high;
    const accelLoad=sess.accel_load!=null?Math.round(sess.accel_load):null;

    const isActive=wlFocusAthlete===a.id;
    return `<tr class="r${i+1}" data-onclick="wlFocusRow(${a.id})" style="cursor:pointer;${isActive?'background:rgba(254,80,0,0.06);':''}" title="Click to view session history">
      <td class="rn" style="padding:5px 8px;">${i<3?medals[i]:i+1}</td>
      <td style="padding:5px 8px;"><div style="display:flex;align-items:center;gap:7px;">${context.api.ava(a)}<div><div style="font-weight:500;">${a._canonicalName||a.name}</div><div style="font-size:9px;color:var(--text3);font-family:var(--fm);">${d}</div></div></div></td>
      <td style="padding:5px 8px;">${context.api.posPill(a.pos)}</td>
      ${td(durMin!=null?durMin+' min':null, tlColor(durMin,60,120))}
      ${td(sess.jumps_total,'var(--text)')}
      ${td(sess.jumps_per_min!=null?sess.jumps_per_min.toFixed(2):null,'var(--text3)')}
      ${td(sess.jumps_low,'var(--text3)')}
      ${td(sess.jumps_mid,'var(--text3)')}
      ${td(highJumps, tlColor(highJumps,60,100))}
      ${td(accelLoad, tlColor(accelLoad,400,550))}
      ${td(sess.accel_load_per_min!=null?sess.accel_load_per_min.toFixed(2):null,'var(--text3)')}
    </tr>`;
  }).join('');
}


// Reference: originals/volleyball.html:2728
function wlSelectAthlete(){
  const sel=document.getElementById('wl-athlete-sel');
  wlFocusAthlete=sel?.value?parseInt(sel.value):null;
  renderWLBoard();
  renderWLHistory();
}


// Reference: originals/volleyball.html:2735
function wlFocusRow(athleteId){
  wlFocusAthlete=(wlFocusAthlete===athleteId||athleteId===null)?null:athleteId;
  // Sync dropdown
  const sel=document.getElementById('wl-athlete-sel');
  if(sel) sel.value=wlFocusAthlete||'';
  renderWLBoard();
  renderWLHistory();
  const btn=document.getElementById('wl-clear-focus');
  if(btn) btn.style.display=wlFocusAthlete?'block':'none';
}


// Reference: originals/volleyball.html:2746
function renderWLHistory(){
  context.api.kc('wl-accel-chart'); context.api.kc('wl-jump-chart'); context.api.kc('wl-dur-chart');

  const kSessions=context.api.getKinexonSessions();
  const allDates=[...new Set(Object.values(kSessions).flat().map(s=>s.test_date))].sort();
  if(!allDates.length){
    // #wl-focus-label is not in the page template, so fall back to the calendar label instead of throwing.
    const emptyLbl=document.getElementById('wl-focus-label')||document.getElementById('wl-cal-label');
    if(emptyLbl) emptyLbl.textContent='No Kinexon session data yet.';
    return;
  }

  const endDateEl=document.getElementById('wl-date');
  // Default end date = most recent session date
  if(endDateEl&&!endDateEl.value) endDateEl.value=allDates[allDates.length-1];
  const endDate=endDateEl?.value||allDates[allDates.length-1];

  // Build 7-day window ending on selected date
  const end=new Date(endDate+'T12:00:00');
  const days=[];
  for(let i=6;i>=0;i--){
    const d=new Date(end);
    d.setDate(d.getDate()-i);
    days.push(d.toISOString().slice(0,10));
  }

  // Only show days that either have data OR are within the window
  // But label all 7 days so the x-axis is consistent
  const dayLabels=days.map(d=>{
    const dt=new Date(d+'T12:00:00');
    return dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  });

  const focusAthlete=wlFocusAthlete?context.api.ATHLETES.find(a=>a.id===wlFocusAthlete):null;

  // Update focus label (keep for row-click feedback)
  const lbl=document.getElementById('wl-focus-label');
  if(lbl) lbl.textContent=focusAthlete
    ?`📍 ${focusAthlete._canonicalName||focusAthlete.name}`
    :'';

  const getSessionsForDay=(date)=>{
    if(focusAthlete){
      const nm=context.api.normName(focusAthlete._canonicalName||focusAthlete.name);
      let athSessions=kSessions[nm];
      if(!athSessions){
        const key=Object.keys(kSessions).find(k=>k.replace(/\s+/g,' ')===nm.replace(/\s+/g,' '));
        athSessions=key?kSessions[key]:[];
      }
      return (athSessions||[]).filter(s=>s.test_date===date);
    }
    return Object.values(kSessions).flat().filter(s=>s.test_date===date);
  };

  // Accel Load — avg per athlete for team view, total for individual
  const accelData=days.map(d=>{
    const ss=getSessionsForDay(d);
    const vals=ss.map(s=>s.accel_load).filter(v=>v!=null&&v>0);
    if(!vals.length) return null;
    // Team view: average per athlete. Individual view: their value directly.
    return focusAthlete
      ? parseFloat(vals[0].toFixed(1))
      : parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1));
  });
  // For team: avg per athlete. For individual: their value.
  const aggJumps=(key,d)=>{
    const ss=getSessionsForDay(d);
    if(!ss.length) return null;
    const total=ss.reduce((s,x)=>s+(x[key]||0),0);
    return focusAthlete?total:Math.round(total/ss.length)||null;
  };
  const jumpsLow  = days.map(d=>aggJumps('jumps_low',d));
  const jumpsMid  = days.map(d=>aggJumps('jumps_mid',d));
  const jumpsHigh = days.map(d=>aggJumps('jumps_high',d));
  const hasSession= days.map(d=>getSessionsForDay(d).length>0);
  const jumpLabel = focusAthlete?'JUMP VOLUME':'AVG JUMPS / ATHLETE';
  const jTitle=document.getElementById('wl-jump-title');
  if(jTitle) jTitle.textContent=jumpLabel;
  if(!hasSession.some(Boolean)&&focusAthlete){
    if(lbl) lbl.textContent=`📍 ${focusAthlete._canonicalName||focusAthlete.name} — no data in this 7-day window, adjust date`;
  }

  const chartBase={
    responsive:true, maintainAspectRatio:false,
    plugins:{legend:{display:false}},
    scales:{
      x:{grid:{display:false},ticks:{color:'#6A5646',font:{size:9,family:'Share Tech Mono'},maxRotation:30}},
      y:{grid:{color:'rgba(254,80,0,0.04)'},ticks:{color:'#6A5646',font:{size:9}},beginAtZero:true}
    }
  };

  // Accel Load bar chart
  const accelLabel=focusAthlete?'Accel Load':'Avg Accel Load / Athlete';
  context.api.CH['wl-accel-chart']=new Chart(document.getElementById('wl-accel-chart'),{
    type:'bar',
    data:{labels:dayLabels,datasets:[{
      label:accelLabel,
      data:accelData,
      backgroundColor:days.map((d,i)=>hasSession[i]
        ?(d===endDate?'rgba(254,80,0,0.9)':'rgba(254,80,0,0.55)')
        :'rgba(254,80,0,0.08)'),
      borderRadius:3,borderSkipped:false,
    }]},
    options:{...chartBase,plugins:{...chartBase.plugins,
      tooltip:{callbacks:{label:ctx=>ctx.raw!=null?`${accelLabel}: ${ctx.raw}`:'No session'}}
    }}
  });

  // Update section label
  const accelTitle=document.getElementById('wl-accel-title');
  if(accelTitle) accelTitle.textContent=focusAthlete?'ACCEL LOAD':'AVG ACCEL LOAD / ATHLETE';

  // Jump Volume stacked bar — High on top for emphasis
  context.api.CH['wl-jump-chart']=new Chart(document.getElementById('wl-jump-chart'),{
    type:'bar',
    data:{labels:dayLabels,datasets:[
      {label:'Low (0–0.66ft)',   data:jumpsLow,  backgroundColor:'rgba(100,86,70,0.5)',  borderRadius:0,borderSkipped:false,stack:'j'},
      {label:'Mid (0.66–0.98ft)',data:jumpsMid,  backgroundColor:'rgba(96,165,250,0.7)', borderRadius:0,borderSkipped:false,stack:'j'},
      {label:'High (≥0.98ft)',   data:jumpsHigh, backgroundColor:'rgba(74,222,128,0.85)',borderRadius:3,borderSkipped:false,stack:'j'},
    ]},
    options:{...chartBase,
      plugins:{legend:{display:false},tooltip:{callbacks:{
        label:ctx=>`${ctx.dataset.label}: ${ctx.raw??0}`,
        footer:items=>`Total: ${items.reduce((s,i)=>s+(i.raw||0),0)}`
      }}},
      scales:{
        x:{...chartBase.scales.x,stacked:true},
        y:{...chartBase.scales.y,stacked:true}
      }
    }
  });
  // ── 14-day duration chart ──
  const end14=new Date(endDate+'T12:00:00');
  const days14=[];
  for(let i=13;i>=0;i--){
    const d=new Date(end14); d.setDate(d.getDate()-i);
    days14.push(d.toISOString().slice(0,10));
  }
  const day14Labels=days14.map(d=>{
    const dt=new Date(d+'T12:00:00');
    return dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  });
  const durData=days14.map(d=>{
    const ss=getSessionsForDay(d);
    const vals=ss.map(s=>s.session_duration_min).filter(v=>v!=null&&v>0);
    if(!vals.length) return null;
    return focusAthlete
      ? parseFloat(vals[0].toFixed(1))
      : parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1));
  });
  const hasDurSession=days14.map(d=>getSessionsForDay(d).some(s=>s.session_duration_min!=null&&s.session_duration_min>0));
  const durTitle=document.getElementById('wl-dur-title');
  if(durTitle) durTitle.textContent=focusAthlete
    ?`SESSION DURATION — ${focusAthlete._canonicalName||focusAthlete.name} — 14 DAYS`
    :'AVG SESSION DURATION / ATHLETE — 14 DAYS';
  context.api.CH['wl-dur-chart']=new Chart(document.getElementById('wl-dur-chart'),{
    type:'bar',
    data:{labels:day14Labels,datasets:[{
      label:'Duration (min)',
      data:durData,
      backgroundColor:days14.map((d,i)=>hasDurSession[i]
        ?(d===endDate?'rgba(205,160,119,0.9)':'rgba(205,160,119,0.5)')
        :'rgba(205,160,119,0.08)'),
      borderRadius:3,borderSkipped:false,
    }]},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>ctx.raw!=null?`${ctx.raw} min`:'No session'}}},
      scales:{
        x:{grid:{display:false},ticks:{color:'#6A5646',font:{size:9,family:'Share Tech Mono'},maxRotation:30}},
        y:{grid:{color:'rgba(254,80,0,0.04)'},ticks:{color:'#6A5646',font:{size:9}},beginAtZero:true}
      }
    }
  });
  renderWLCalendar(days14, getSessionsForDay, focusAthlete, endDate);
}


// Reference: originals/volleyball.html:2919
function renderWLCalendar(days14, getSessionsForDay, focusAthlete, endDate){
  const cal=document.getElementById('wl-calendar');
  const lbl=document.getElementById('wl-cal-label');
  if(!cal) return;

  if(lbl) lbl.textContent=focusAthlete
    ?`${focusAthlete._canonicalName||focusAthlete.name} · click row again for team view`
    :'Team averages · click athlete row to filter';

  // Color helpers — Green/Yellow/Red thresholds
  const thresholdColor=(v, lo, hi)=>{
    if(v==null) return 'var(--bg3)';
    if(v>=hi)   return 'rgba(248,113,113,0.75)';  // red
    if(v>=lo)   return 'rgba(252,211,77,0.75)';   // yellow
    return              'rgba(74,222,128,0.75)';   // green
  };
  // High jumps:  green <60, yellow 60-100, red >100
  const highJumpColor=(v)=>thresholdColor(v,60,100);
  // Accel load:  green <400, yellow 400-550, red >550
  const accelColor=(v)=>thresholdColor(v,400,550);
  // Duration:    green <60, yellow 60-120, red >120
  const durColor=(v)=>thresholdColor(v,60,120);

  cal.innerHTML = days14.map(date=>{
    const ss=getSessionsForDay(date);
    const hasData=ss.length>0;
    const n=focusAthlete?1:Math.max(ss.length,1);

    const highJumps=hasData?Math.round(ss.reduce((s,x)=>s+(x.jumps_high||0),0)/n):null;
    const accelLoad=hasData?(()=>{
      const vals=ss.map(s=>s.accel_load).filter(v=>v!=null&&v>0);
      return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null;
    })():null;
    const duration=hasData?(()=>{
      const vals=ss.map(s=>s.session_duration_min).filter(v=>v!=null&&v>0);
      return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null;
    })():null;

    const dt=new Date(date+'T12:00:00');
    const dayLabel=dt.toLocaleDateString('en-US',{weekday:'short'});
    const dateLabel=dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});
    const isToday=date===new Date().toISOString().slice(0,10);
    const isEnd=date===endDate;

    return `<div style="
      background:${hasData?'var(--bg2)':'var(--bg)'};
      border:1px solid ${isEnd?'var(--orange)':isToday?'rgba(254,80,0,0.3)':'var(--border)'};
      border-radius:var(--r);
      padding:8px 6px;
      min-height:110px;
      position:relative;
      ${!hasData?'opacity:0.4;':''}
    ">
      <div style="font-family:var(--fh);font-size:9px;color:${isEnd?'var(--orange)':'var(--text3)'};letter-spacing:0.5px;margin-bottom:2px;">${dayLabel}</div>
      <div style="font-family:var(--fm);font-size:10px;color:${isEnd?'var(--orange)':'var(--text)'};margin-bottom:6px;font-weight:${isEnd?'700':'400'};">${dateLabel}</div>
      ${hasData?`
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="background:${highJumpColor(highJumps)};border-radius:3px;padding:3px 5px;">
            <div style="font-size:8px;color:rgba(255,255,255,0.6);font-family:var(--fm);">HIGH JMP</div>
            <div style="font-size:13px;font-family:var(--fh);color:#fff;font-weight:700;">${highJumps??'—'}</div>
          </div>
          <div style="background:${accelColor(accelLoad)};border-radius:3px;padding:3px 5px;">
            <div style="font-size:8px;color:rgba(255,255,255,0.6);font-family:var(--fm);">ACCEL</div>
            <div style="font-size:13px;font-family:var(--fh);color:#fff;font-weight:700;">${accelLoad??'—'}</div>
          </div>
          <div style="background:${durColor(duration)};border-radius:3px;padding:3px 5px;">
            <div style="font-size:8px;color:rgba(255,255,255,0.6);font-family:var(--fm);">MIN</div>
            <div style="font-size:13px;font-family:var(--fh);color:#fff;font-weight:700;">${duration??'—'}</div>
          </div>
        </div>
      `:`<div style="font-size:9px;color:var(--text3);font-family:var(--fm);margin-top:8px;">No session</div>`}
    </div>`;
  }).join('');
}

return Object.defineProperties({}, {
  WL_SORT_KEYS: {enumerable:true, configurable:true, get:()=>WL_SORT_KEYS},
  populateWLSort: {enumerable:true, configurable:true, get:()=>populateWLSort},
  wlFocusAthlete: {enumerable:true, configurable:true, get:()=>wlFocusAthlete, set:value=>{wlFocusAthlete=value;}},
  initWL: {enumerable:true, configurable:true, get:()=>initWL},
  renderWLKpis: {enumerable:true, configurable:true, get:()=>renderWLKpis},
  renderWLBoard: {enumerable:true, configurable:true, get:()=>renderWLBoard},
  wlSelectAthlete: {enumerable:true, configurable:true, get:()=>wlSelectAthlete},
  wlFocusRow: {enumerable:true, configurable:true, get:()=>wlFocusRow},
  renderWLHistory: {enumerable:true, configurable:true, get:()=>renderWLHistory},
  renderWLCalendar: {enumerable:true, configurable:true, get:()=>renderWLCalendar}
});
}
