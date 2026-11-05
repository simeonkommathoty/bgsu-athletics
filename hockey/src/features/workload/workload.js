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
// Reference: originals/hockey.html:2585
const WL_SORT_KEYS = ['jumpVol','avgJumpHt','playerLoad','acuteLoad','chronicLoad','acwr'];


// Reference: originals/hockey.html:2586
function populateWLSort(){
  context.api.populateMetricSelect('wl-sort', WL_SORT_KEYS);
}


// Reference: originals/hockey.html:2844
let wlFocusAthlete=null;

// athlete id currently focused in history charts
// Reference: originals/hockey.html:2846
function initWL(){
  const signal=context.signal;
  return Promise.all([context.api.loadAllSessions(), context.api.loadAllSessionDrills()]).then(()=>{
    if(signal?.aborted)return;
    console.log('WL: SESSIONS loaded, count=', context.api.SESSIONS.length, 'firstbeat=', Object.keys(context.api.getKinexonSessions()).length, 'drills=', context.api.SESSION_DRILLS.length);
    renderWLKpis(); renderWLBoard(); renderWLHistory();
  });
}


// Reference: originals/hockey.html:2853
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

  // Populate athlete dropdown with athletes who have Firstbeat sessions
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
    document.getElementById('wl-kpis').innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text3);font-family:var(--fm);font-size:11px;">No Firstbeat data yet. Import a Firstbeat export CSV/TSV to populate this page.</div>`;
    return;
  }
  const avg=k=>{const vals=latestPerAthlete.map(s=>s[k]).filter(v=>v!=null&&!isNaN(v));return vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:null;};
  const kpis=[
    {label:'Avg TRIMP Total',   value:avg('trimp_total'),        fmt:v=>Math.round(v),  unit:'',         color:'#FE5000'},
    {label:'Avg HR',            value:avg('avg_hr'),             fmt:v=>Math.round(v),  unit:'bpm',      color:'#FCD34D'},
    {label:'Avg Efficiency',    value:avg('effic_score'),        fmt:v=>v.toFixed(2),   unit:'',         color:'#4ADE80'},
    {label:'Athletes Tracked',  value:latestPerAthlete.length,   fmt:v=>v,              unit:'of '+context.api.rosterAthletes().length, color:'#CDA077'},
  ];
  document.getElementById('wl-kpis').innerHTML=kpis.map(k=>`
    <div class="kpi-card">
      <div class="kpi-lbl">${k.label}</div>
      <div class="kpi-val" style="color:${k.color};">${k.value!=null?k.fmt(k.value):'—'}</div>
      <div class="kpi-sub">${k.unit}</div>
    </div>`).join('');
}


// Reference: originals/hockey.html:2911
function renderWLBoard(){
  const sortKey=document.getElementById('wl-sort')?.value||'jumpVol';
  const sortMap={jumpVol:'trimp_total',avgHR:'avg_hr',efficScore:'effic_score',duration:'session_duration_min'};
  const sessionKey=sortMap[sortKey]||'trimp_total';
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
    document.getElementById('wl-tbody').innerHTML=`<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text3);font-family:var(--fm);">No Firstbeat session data. Import a Firstbeat export.</td></tr>`;
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
    const avgHR=sess.avg_hr!=null?Math.round(sess.avg_hr):null;
    const trimp=sess.trimp_total!=null?Math.round(sess.trimp_total):null;

    const isActive=wlFocusAthlete===a.id;
    return `<tr class="r${i+1}" data-onclick="wlFocusRow(${a.id})" style="cursor:pointer;${isActive?'background:rgba(254,80,0,0.06);':''}" title="Click to view session history">
      <td class="rn" style="padding:5px 8px;">${i<3?medals[i]:i+1}</td>
      <td style="padding:5px 8px;"><div style="display:flex;align-items:center;gap:7px;">${context.api.ava(a)}<div><div style="font-weight:500;">${a._canonicalName||a.name}</div><div style="font-size:9px;color:var(--text3);font-family:var(--fm);">${d}</div></div></div></td>
      <td style="padding:5px 8px;">${context.api.posPill(a.pos)}</td>
      ${td(sess.session_type||'—','var(--text3)')}
      ${td(trimp, tlColor(trimp,100,160))}
      ${td(sess.trimp_per_min!=null?sess.trimp_per_min.toFixed(2):null,'var(--text3)')}
      ${td(avgHR, tlColor(avgHR,140,165))}
      ${td(sess.effic_score!=null?sess.effic_score.toFixed(2):null,'var(--text)')}
    </tr>`;
  }).join('');

  renderDrillBreakdown();
}

// Bar chart + table of TRIMP-by-drill for the currently focused athlete on
// the currently selected date (from the sessions board above). Built from
// Firstbeat's per-drill "Lap" rows, captured separately from the day-total
// "Measurement" rows.
// Reference: originals/hockey.html:2982
function renderDrillBreakdown(){
  const label=document.getElementById('wl-drill-label');
  const tableEl=document.getElementById('wl-drill-table');
  context.api.kc('wl-drill-chart');

  const date=document.getElementById('wl-date-sel')?.value;
  if(!date){
    label.textContent='Pick a date above to see TRIMP by drill';
    tableEl.innerHTML='';
    return;
  }

  if(!wlFocusAthlete){
    renderDrillBreakdownTeamAvg(date,label,tableEl);
    return;
  }

  const athlete=context.api.ATHLETES.find(a=>a.id===wlFocusAthlete);
  if(!athlete){
    label.textContent='Pick a date above to see TRIMP by drill';
    tableEl.innerHTML='';
    return;
  }
  const drills=context.api.SESSION_DRILLS.filter(d=>d.athlete_id===athlete._dbId&&d.test_date===date);
  if(!drills.length){
    label.textContent=`${athlete._canonicalName||athlete.name} — ${context.api.fmtDate(date)||date}: no drill-level data for this date`;
    tableEl.innerHTML='';
    return;
  }
  const totalTrimp=drills.reduce((s,d)=>s+(d.trimp||0),0);
  label.textContent=`${athlete._canonicalName||athlete.name} — ${context.api.fmtDate(date)||date} — ${drills.length} drills, ${totalTrimp.toFixed(0)} TRIMP total`;

  const sorted=[...drills].sort((a,b)=>(b.trimp||0)-(a.trimp||0));
  context.api.CH['wl-drill-chart']=new Chart(document.getElementById('wl-drill-chart'),{
    type:'bar',
    data:{labels:sorted.map(d=>d.drill_name),datasets:[{
      label:'TRIMP',
      data:sorted.map(d=>d.trimp),
      backgroundColor:'rgba(254,80,0,0.7)',
      borderRadius:3,borderSkipped:false,
    }]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',
      plugins:{legend:{display:false},tooltip:{callbacks:{
        label:ctx=>`TRIMP: ${ctx.raw?.toFixed?.(1)??ctx.raw}`
      }}},
      scales:{
        x:{grid:{color:'rgba(254,80,0,0.04)'},ticks:{color:'#6A5646',font:{size:9,family:'Share Tech Mono'}}},
        y:{grid:{display:false},ticks:{color:'#BCA898',font:{size:9,family:'Share Tech Mono'}}}
      }
    }
  });

  tableEl.innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:11px;font-family:var(--fm);">
    <thead><tr style="color:var(--text3);text-align:left;">
      <th style="padding:5px 8px;">Drill</th><th style="padding:5px 8px;text-align:center;">Duration</th>
      <th style="padding:5px 8px;text-align:center;">TRIMP</th><th style="padding:5px 8px;text-align:center;">TRIMP/min</th>
      <th style="padding:5px 8px;text-align:center;">Movement Load</th><th style="padding:5px 8px;text-align:center;">Avg HR</th>
    </tr></thead><tbody>${sorted.map(d=>`<tr style="border-top:1px solid var(--border);">
      <td style="padding:5px 8px;">${d.drill_name}</td>
      <td style="padding:5px 8px;text-align:center;color:var(--text3);">${d.duration_min!=null?d.duration_min.toFixed(1)+' min':'—'}</td>
      <td style="padding:5px 8px;text-align:center;color:var(--orange);">${d.trimp!=null?d.trimp.toFixed(1):'—'}</td>
      <td style="padding:5px 8px;text-align:center;color:var(--yellow);">${d.trimp_per_min!=null?d.trimp_per_min.toFixed(2):'—'}</td>
      <td style="padding:5px 8px;text-align:center;color:#60A5FA;">${d.movement_load!=null?d.movement_load.toFixed(1):'—'}</td>
      <td style="padding:5px 8px;text-align:center;color:#F87171;">${d.avg_hr!=null?Math.round(d.avg_hr):'—'}</td>
    </tr>`).join('')}</tbody></table>`;
}

// Team-average view: same chart/table shape as the individual view above,
// but each "drill" bar is the AVERAGE TRIMP/duration/HR across every athlete
// who ran that drill on the selected date — lets a coach see which drills
// ran hottest across the whole team, independent of any one player.
// Reference: originals/hockey.html:3053
function renderDrillBreakdownTeamAvg(date,label,tableEl){
  const drillsOnDate=context.api.SESSION_DRILLS.filter(d=>d.test_date===date);
  if(!drillsOnDate.length){
    label.textContent=`Team average — ${context.api.fmtDate(date)||date}: no drill-level data for this date`;
    tableEl.innerHTML='';
    return;
  }
  const byDrill={};
  for(const d of drillsOnDate){
    if(!byDrill[d.drill_name]) byDrill[d.drill_name]={drill_name:d.drill_name,trimps:[],durations:[],hrs:[],trimpMins:[],movementLoads:[],athletes:new Set()};
    const g=byDrill[d.drill_name];
    if(d.trimp!=null) g.trimps.push(d.trimp);
    if(d.duration_min!=null) g.durations.push(d.duration_min);
    if(d.avg_hr!=null) g.hrs.push(d.avg_hr);
    if(d.trimp_per_min!=null) g.trimpMins.push(d.trimp_per_min);
    if(d.movement_load!=null) g.movementLoads.push(d.movement_load);
    g.athletes.add(d.athlete_id);
  }
  const avg=arr=>arr.length?arr.reduce((s,v)=>s+v,0)/arr.length:null;
  const rows=Object.values(byDrill).map(g=>({
    drill_name:g.drill_name,
    avgTrimp:avg(g.trimps),
    avgDuration:avg(g.durations),
    avgHr:avg(g.hrs),
    avgTrimpPerMin:avg(g.trimpMins),
    avgMovementLoad:avg(g.movementLoads),
    athleteCount:g.athletes.size,
  }));
  const totalAthletes=new Set(drillsOnDate.map(d=>d.athlete_id)).size;
  label.textContent=`Team average — ${context.api.fmtDate(date)||date} — ${rows.length} drills across ${totalAthletes} athletes`;

  const sorted=[...rows].sort((a,b)=>(b.avgTrimp||0)-(a.avgTrimp||0));
  context.api.CH['wl-drill-chart']=new Chart(document.getElementById('wl-drill-chart'),{
    type:'bar',
    data:{labels:sorted.map(d=>d.drill_name),datasets:[{
      label:'Avg TRIMP',
      data:sorted.map(d=>d.avgTrimp),
      backgroundColor:'rgba(254,80,0,0.7)',
      borderRadius:3,borderSkipped:false,
    }]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',
      plugins:{legend:{display:false},tooltip:{callbacks:{
        label:ctx=>`Avg TRIMP: ${ctx.raw?.toFixed?.(1)??ctx.raw}`,
        afterLabel:ctx=>`${sorted[ctx.dataIndex].athleteCount} athlete${sorted[ctx.dataIndex].athleteCount!==1?'s':''}`
      }}},
      scales:{
        x:{grid:{color:'rgba(254,80,0,0.04)'},ticks:{color:'#6A5646',font:{size:9,family:'Share Tech Mono'}}},
        y:{grid:{display:false},ticks:{color:'#BCA898',font:{size:9,family:'Share Tech Mono'}}}
      }
    }
  });

  tableEl.innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:11px;font-family:var(--fm);">
    <thead><tr style="color:var(--text3);text-align:left;">
      <th style="padding:5px 8px;">Drill</th><th style="padding:5px 8px;text-align:center;">Avg Duration</th>
      <th style="padding:5px 8px;text-align:center;">Avg TRIMP</th><th style="padding:5px 8px;text-align:center;">Avg TRIMP/min</th>
      <th style="padding:5px 8px;text-align:center;">Avg Movement Load</th><th style="padding:5px 8px;text-align:center;">Avg HR</th>
    </tr></thead><tbody>${sorted.map(d=>`<tr style="border-top:1px solid var(--border);">
      <td style="padding:5px 8px;">${d.drill_name}</td>
      <td style="padding:5px 8px;text-align:center;color:var(--text3);">${d.avgDuration!=null?d.avgDuration.toFixed(1)+' min':'—'}</td>
      <td style="padding:5px 8px;text-align:center;color:var(--orange);">${d.avgTrimp!=null?d.avgTrimp.toFixed(1):'—'}</td>
      <td style="padding:5px 8px;text-align:center;color:var(--yellow);">${d.avgTrimpPerMin!=null?d.avgTrimpPerMin.toFixed(2):'—'}</td>
      <td style="padding:5px 8px;text-align:center;color:#60A5FA;">${d.avgMovementLoad!=null?d.avgMovementLoad.toFixed(1):'—'}</td>
      <td style="padding:5px 8px;text-align:center;color:#F87171;">${d.avgHr!=null?Math.round(d.avgHr):'—'}</td>
    </tr>`).join('')}</tbody></table>`;
}


// Reference: originals/hockey.html:3120
function wlSelectAthlete(){
  const sel=document.getElementById('wl-athlete-sel');
  wlFocusAthlete=sel?.value?parseInt(sel.value):null;
  renderWLBoard();
  renderWLHistory();
}


// Reference: originals/hockey.html:3127
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


// Reference: originals/hockey.html:3138
function renderWLHistory(){
  context.api.kc('wl-accel-chart'); context.api.kc('wl-jump-chart'); context.api.kc('wl-dur-chart');

  const kSessions=context.api.getKinexonSessions();
  const allDates=[...new Set(Object.values(kSessions).flat().map(s=>s.test_date))].sort();
  if(!allDates.length){
    // #wl-focus-label is not in the page template, so fall back to the calendar label instead of throwing.
    const emptyLbl=document.getElementById('wl-focus-label')||document.getElementById('wl-cal-label');
    if(emptyLbl) emptyLbl.textContent='No Firstbeat session data yet.';
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
    // Team view: take only the BEST session per athlete for this date — not
    // every row. Each athlete's array is already sorted (real, properly-linked
    // row first; stale orphaned duplicates last), so .find() picks the correct
    // one. Flattening every row here would dilute the average with old
    // leftover duplicate rows that shouldn't count as separate athletes.
    return Object.values(kSessions)
      .map(athSessions=>athSessions.find(s=>s.test_date===date))
      .filter(Boolean);
  };

  // TRIMP — avg per athlete for team view, session value for individual
  const accelData=days.map(d=>{
    const ss=getSessionsForDay(d);
    const vals=ss.map(s=>s.trimp_total).filter(v=>v!=null&&v>0);
    if(!vals.length) return null;
    // Team view: average per athlete. Individual view: their value directly.
    return focusAthlete
      ? parseFloat(vals[0].toFixed(1))
      : parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1));
  });
  // Avg HR — avg per athlete for team view, session value for individual
  const hrData=days.map(d=>{
    const ss=getSessionsForDay(d);
    const vals=ss.map(s=>s.avg_hr).filter(v=>v!=null&&v>0);
    if(!vals.length) return null;
    return focusAthlete
      ? Math.round(vals[0])
      : Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
  });
  const hasSession= days.map(d=>getSessionsForDay(d).length>0);
  const jumpLabel = focusAthlete?'AVG HR':'TEAM AVG HR';
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

  // TRIMP bar chart
  const accelLabel=focusAthlete?'TRIMP Total':'Avg TRIMP / Athlete';
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
  if(accelTitle) accelTitle.textContent=focusAthlete?'TRIMP LOAD':'AVG TRIMP LOAD / ATHLETE';

  // Avg HR line chart
  context.api.CH['wl-jump-chart']=new Chart(document.getElementById('wl-jump-chart'),{
    type:'line',
    data:{labels:dayLabels,datasets:[
      {label:'Avg HR (bpm)', data:hrData, borderColor:'#F87171', backgroundColor:'rgba(248,113,113,0.15)',
       fill:true, tension:0.3, pointRadius:3, pointBackgroundColor:'#F87171'},
    ]},
    options:{...chartBase,
      plugins:{legend:{display:false},tooltip:{callbacks:{
        label:ctx=>`Avg HR: ${ctx.raw??'—'} bpm`
      }}},
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


// Reference: originals/hockey.html:3311
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
  // TRIMP:      green <100, yellow 100-160, red >160
  const trimpColor=(v)=>thresholdColor(v,100,160);
  // Avg HR:     green <140, yellow 140-165, red >165
  const hrColor=(v)=>thresholdColor(v,140,165);
  // Duration:    green <60, yellow 60-120, red >120
  const durColor=(v)=>thresholdColor(v,60,120);

  cal.innerHTML = days14.map(date=>{
    const ss=getSessionsForDay(date);
    const hasData=ss.length>0;
    const n=focusAthlete?1:Math.max(ss.length,1);

    const trimp=hasData?(()=>{
      const vals=ss.map(s=>s.trimp_total).filter(v=>v!=null&&v>0);
      return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null;
    })():null;
    const avgHR=hasData?(()=>{
      const vals=ss.map(s=>s.avg_hr).filter(v=>v!=null&&v>0);
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
          <div style="background:${trimpColor(trimp)};border-radius:3px;padding:3px 5px;">
            <div style="font-size:8px;color:rgba(255,255,255,0.6);font-family:var(--fm);">TRIMP</div>
            <div style="font-size:13px;font-family:var(--fh);color:#fff;font-weight:700;">${trimp??'—'}</div>
          </div>
          <div style="background:${hrColor(avgHR)};border-radius:3px;padding:3px 5px;">
            <div style="font-size:8px;color:rgba(255,255,255,0.6);font-family:var(--fm);">AVG HR</div>
            <div style="font-size:13px;font-family:var(--fh);color:#fff;font-weight:700;">${avgHR??'—'}</div>
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
  renderDrillBreakdown: {enumerable:true, configurable:true, get:()=>renderDrillBreakdown},
  renderDrillBreakdownTeamAvg: {enumerable:true, configurable:true, get:()=>renderDrillBreakdownTeamAvg},
  wlSelectAthlete: {enumerable:true, configurable:true, get:()=>wlSelectAthlete},
  wlFocusRow: {enumerable:true, configurable:true, get:()=>wlFocusRow},
  renderWLHistory: {enumerable:true, configurable:true, get:()=>renderWLHistory},
  renderWLCalendar: {enumerable:true, configurable:true, get:()=>renderWLCalendar}
});
}
