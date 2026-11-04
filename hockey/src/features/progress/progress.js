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

// Reference: originals/hockey.html:6165
function initProgress(){
  const signal=context.signal;
  return context.api.loadKpiHistory().then(()=>{
    if(signal?.aborted)return;
    const sel=document.getElementById('prog-athlete-sel');
    if(sel){
      const current=sel.value;
      const athletes=context.api.rosterAthletes();
      sel.innerHTML=athletes.map(a=>`<option value="${a.id}">${a._canonicalName||a.name} (${a.pos})</option>`).join('');
      // Default to the first athlete rather than a "whole team" placeholder —
      // the team-wide view already lives in the table below the chart.
      if(current&&athletes.some(a=>String(a.id)===current)) sel.value=current;
      else if(athletes.length) sel.value=athletes[0].id;
    }
    renderProgressChart();
  });
}


// Reference: originals/hockey.html:6181
function renderProgressChart(){
  const athleteId=document.getElementById('prog-athlete-sel')?.value;
  const metricKey=document.getElementById('prog-metric-sel')?.value;
  const m=context.api.getM(metricKey);
  context.api.kc('prog-chart');

  if(!athleteId){
    // No athlete selected — show team progress table only, hide the individual chart/history
    document.getElementById('prog-chart-title').textContent=`Select an athlete above to see their ${m.label} progress over time`;
    document.getElementById('prog-history-tbody').innerHTML='';
    renderProgressTeamTable(metricKey,m);
    return;
  }

  const athlete=context.api.ATHLETES.find(a=>a.id===parseInt(athleteId));
  const rows=athlete?context.api.officialHist(athlete,metricKey):[];

  document.getElementById('prog-chart-title').textContent=
    `${athlete?._canonicalName||athlete?.name||''} — ${m.label} Over Time`;

  if(!rows.length){
    document.getElementById('prog-history-tbody').innerHTML=`<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--text3);font-family:var(--fm);">No official (Aug/Sep) test results logged yet.</td></tr>`;
    renderProgressTeamTable(metricKey,m);
    return;
  }

  context.api.CH['prog-chart']=new Chart(document.getElementById('prog-chart'),{
    type:'line',
    data:{labels:rows.map(r=>context.api.fmtDate(r.test_date)||r.test_date),datasets:[{
      label:m.label,
      data:rows.map(r=>r.value),
      borderColor:'#FE5000', backgroundColor:'rgba(254,80,0,0.12)',
      fill:true, tension:0.25, pointRadius:4, pointBackgroundColor:'#FE5000',
    }]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{
        label:ctx=>`${m.label}: ${m.fmt(ctx.raw)} ${m.unit||''}`
      }}},
      scales:{
        x:{grid:{color:'rgba(254,80,0,0.04)'},ticks:{color:'#6A5646',font:{size:9,family:'Share Tech Mono'}}},
        y:{grid:{color:'rgba(254,80,0,0.04)'},ticks:{color:'#6A5646',font:{size:9,family:'Share Tech Mono'}}}
      }
    }
  });

  document.getElementById('prog-history-tbody').innerHTML=rows.map((r,i)=>{
    const prev=i>0?rows[i-1].value:null;
    const change=prev!=null?r.value-prev:null;
    const better=change!=null?(m.hb?change>0:change<0):null;
    return `<tr>
      <td style="font-family:var(--fm);">${context.api.fmtDate(r.test_date)||r.test_date}</td>
      <td style="font-family:var(--fm);color:var(--orange);">${m.fmt(r.value)} ${m.unit||''}</td>
      <td style="font-family:var(--fm);${better===true?'color:var(--green);':better===false?'color:var(--red);':'color:var(--text3);'}">${change!=null?(change>0?'+':'')+change.toFixed(2):'—'}</td>
    </tr>`;
  }).reverse().join('');

  renderProgressTeamTable(metricKey,m);
}


// Reference: originals/hockey.html:6240
function renderProgressTeamTable(metricKey,m){
  const rows=context.api.rosterAthletes().map(a=>{
    const hist=context.api.officialHist(a,metricKey);
    if(!hist.length) return null;
    const latest=hist[hist.length-1];
    const prev=hist.length>1?hist[hist.length-2]:null;
    return {athlete:a, latest, prev};
  }).filter(Boolean).sort((a,b)=>m.hb?(b.latest.value-a.latest.value):(a.latest.value-b.latest.value));

  document.getElementById('prog-team-sub').textContent=
    `${m.label} — change from previous official test (best Aug/Sep each year) to most recent`;

  if(!rows.length){
    document.getElementById('prog-team-tbody').innerHTML=`<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text3);font-family:var(--fm);">No official (Aug/Sep) test results logged yet.</td></tr>`;
    return;
  }

  document.getElementById('prog-team-tbody').innerHTML=rows.map(({athlete,latest,prev})=>{
    const change=prev?latest.value-prev.value:null;
    const better=change!=null?(m.hb?change>0:change<0):null;
    return `<tr data-onclick="document.getElementById('prog-athlete-sel').value='${athlete.id}';renderProgressChart();" style="cursor:pointer;">
      <td><div style="display:flex;align-items:center;gap:7px;">${context.api.ava(athlete)}<span>${athlete._canonicalName||athlete.name}</span></div></td>
      <td style="font-family:var(--fm);color:var(--text3);">${prev?m.fmt(prev.value)+' '+(m.unit||''):'—'}</td>
      <td style="font-family:var(--fm);color:var(--orange);">${m.fmt(latest.value)} ${m.unit||''}</td>
      <td style="font-family:var(--fm);${better===true?'color:var(--green);':better===false?'color:var(--red);':'color:var(--text3);'}">${change!=null?(change>0?'+':'')+change.toFixed(2):'—'}</td>
    </tr>`;
  }).join('');
}

return Object.defineProperties({}, {
  initProgress: {enumerable:true, configurable:true, get:()=>initProgress},
  renderProgressChart: {enumerable:true, configurable:true, get:()=>renderProgressChart},
  renderProgressTeamTable: {enumerable:true, configurable:true, get:()=>renderProgressTeamTable}
});
}
