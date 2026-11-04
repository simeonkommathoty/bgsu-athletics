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
// Force Plate sort dropdown options — order matters for UX
// Reference: originals/hockey.html:2572
const FP_SORT_KEYS = ['peakPower','cmjHeight','rsi','asymmetry','eccRFD','concImpulse','eccImpulse','contractionTime','takeoffVelocity','concImpulseAsym','eccBrakingAsym'];


// Reference: originals/hockey.html:2574
function populateFPSort(){
  context.api.populateMetricSelect('fp-sort', FP_SORT_KEYS, context.api.athletesWithLatestSession());
}


// Reference: originals/hockey.html:2590
function initFP(){
  populateFPSort();
  const r=context.api.athletesWithLatestSession();
  if(!r.length){
    document.getElementById('fp-pp').textContent='—';
    document.getElementById('fp-rsi').textContent='—';
    document.getElementById('fp-rfd').textContent='—';
    return;
  }
  const avg=k=>{
    const vals=r.map(a=>a[k]).filter(v=>v!==null&&v!==undefined&&!isNaN(v));
    return vals.length?parseFloat((vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(1)):null;
  };
  const jh=avg('cmjHeight'), pp=avg('peakPower'), rsiV=avg('rsi'), rfd=avg('eccRFD');
  document.getElementById('fp-jh').textContent=jh!=null?jh.toFixed(1)+'"':'—';
  document.getElementById('fp-pp').textContent=pp!=null?pp:'—';
  document.getElementById('fp-rsi').textContent=rsiV!=null?rsiV.toFixed(3):'—';
  document.getElementById('fp-rfd').textContent=rfd!=null?Math.round(rfd):'—';
  renderFPBoard();
  renderCMJScatter();
  renderPRTracker();

  context.api.kc('phase-bar');
  const posAvg=(pos,k)=>{const g=r.filter(a=>a.pos===pos);return parseFloat((g.reduce((s,a)=>s+(a[k]||0),0)/Math.max(1,g.length)).toFixed(1));};
  context.api.CH['phase-bar']=new Chart(document.getElementById('phase-bar'),{
    type:'bar',data:{labels:context.api.POSITIONS,datasets:[
      {label:'Ecc. RFD (÷100)',data:context.api.POSITIONS.map(p=>posAvg(p,'eccRFD')/100),backgroundColor:'rgba(205,160,119,0.7)',borderRadius:3,borderSkipped:false},
      {label:'Conc. Impulse',data:context.api.POSITIONS.map(p=>posAvg(p,'concImpulse')),backgroundColor:'rgba(56,189,248,0.65)',borderRadius:3,borderSkipped:false},
      {label:'Ecc. Impulse',data:context.api.POSITIONS.map(p=>posAvg(p,'eccImpulse')),backgroundColor:'rgba(167,139,250,0.6)',borderRadius:3,borderSkipped:false},
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#BCA898',font:{size:10,family:'Share Tech Mono'}}},y:{grid:{color:'rgba(254,80,0,0.04)'},ticks:{color:'#6A5646',font:{size:9}}}}}
  });
}


// Reference: originals/hockey.html:2624
function renderCMJScatter(){
  context.api.kc('cmj-scatter');
  const sel=document.getElementById('cmj-athlete-sel');
  const focusId=sel?.value?parseInt(sel.value):null;

  // Build athlete dropdown if empty
  if(sel&&sel.options.length<=1){
    const athWithData=context.api.SESSIONS.filter(s=>s.jump_height!=null)
      .map(s=>context.api.normName(s.athlete_name));
    const unique=[...new Set(athWithData)];
    const opts=context.api.rosterAthletes()
      .filter(a=>unique.includes(context.api.normName(a._canonicalName||a.name)))
      .map(a=>`<option value="${a.id}">${a._canonicalName||a.name} (${a.pos})</option>`)
      .join('');
    sel.innerHTML='<option value="">All athletes</option>'+opts;
    if(focusId) sel.value=focusId;
  }

  // 6 months ago
  const cutoff=new Date();
  cutoff.setMonth(cutoff.getMonth()-6);
  const cutoffStr=cutoff.toISOString().slice(0,10);
  const KINEXON_TYPES=new Set(['Match','Training','Lift']);

  // Build datasets
  const POS_COLORS={'F':'rgba(254,80,0,0.75)','D':'rgba(96,165,250,0.75)','G':'rgba(248,113,113,0.75)'};

  // Only VALD sessions (exclude Kinexon match/training/lift sessions which have jump height in ft)
  // Also filter to realistic CMJ range: 5-20 inches (VALD CMJ, not Kinexon ft values)
  let sessions=context.api.SESSIONS.filter(s=>
    s.jump_height!=null &&
    s.jump_height>=5 && s.jump_height<=21 &&
    s.test_date>=cutoffStr &&
    !KINEXON_TYPES.has(s.session_type)
  );
  if(focusId){
    const a=context.api.ATHLETES.find(x=>x.id===focusId);
    if(a){
      const nm=context.api.normName(a._canonicalName||a.name);
      sessions=sessions.filter(s=>context.api.normName(s.athlete_name)===nm);
    }
  }

  // Group by athlete for separate datasets
  const byAthlete={};
  for(const s of sessions){
    const nm=context.api.normName(s.athlete_name);
    if(!byAthlete[nm]) byAthlete[nm]={name:s.athlete_name,pos:'F',points:[]};
    // Find position
    const ath=context.api.rosterAthletes().find(a=>context.api.normName(a._canonicalName||a.name)===nm);
    if(ath) byAthlete[nm].pos=ath.pos;
    byAthlete[nm].points.push({x:s.test_date,y:parseFloat(s.jump_height.toFixed(1)),date:s.test_date});
  }

  const datasets=Object.values(byAthlete).map(d=>({
    label:d.name,
    data:d.points.sort((a,b)=>a.x.localeCompare(b.x)),
    backgroundColor:POS_COLORS[d.pos]||'rgba(254,80,0,0.6)',
    pointRadius:5,pointHoverRadius:8,
    showLine:focusId?true:false, // show line for individual, dots for team
    borderColor:POS_COLORS[d.pos]||'rgba(254,80,0,0.6)',
    borderWidth:focusId?2:0,
    tension:0.3,
  }));

  if(!datasets.length){
    const ctx=document.getElementById('cmj-scatter').getContext('2d');
    ctx.fillStyle='#6A5646';ctx.font='12px Share Tech Mono';
    ctx.fillText('No CMJ session data in the last 6 months',20,135);
    return;
  }

  context.api.CH['cmj-scatter']=new Chart(document.getElementById('cmj-scatter'),{
    type:'line',
    data:{datasets},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:!focusId,position:'right',labels:{color:'#BCA898',font:{size:9,family:'Share Tech Mono'},boxWidth:8,padding:6}},
        tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${c.parsed.y.toFixed(1)}" (${c.raw.date})`}}
      },
      scales:{
        x:{type:'category',grid:{display:false},ticks:{color:'#6A5646',font:{size:9,family:'Share Tech Mono'},maxRotation:40,autoSkip:true},
          title:{display:true,text:'Test Date',color:'#6A5646',font:{size:9}}},
        y:{grid:{color:'rgba(254,80,0,0.04)'},ticks:{color:'#6A5646',font:{size:9}},
          title:{display:true,text:'Vertical Jump (in)',color:'#6A5646',font:{size:9}},
          min:10}
      }
    }
  });
}


// Reference: originals/hockey.html:2715
function renderPRTracker(){
  const tbody=document.getElementById('pr-tbody');
  const dateRangeEl=document.getElementById('pr-date-range');
  if(!tbody) return;

  const KINEXON_TYPES=new Set(['Match','Training','Lift']);

  // Get all valid VALD CMJ sessions (jump_height 5–21", not Kinexon)
  const valdSessions=context.api.SESSIONS.filter(s=>
    s.jump_height!=null &&
    s.jump_height>=5 && s.jump_height<=21 &&
    !KINEXON_TYPES.has(s.session_type)
  );

  console.log('PR Tracker: SESSIONS=',context.api.SESSIONS.length,'valdSessions=',valdSessions.length);
  if(valdSessions.length) console.log('Sample:',valdSessions[0]);

  if(!valdSessions.length){
    tbody.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text3);">No VALD session data found.</td></tr>`;
    return;
  }

  // Date range label
  const dates=valdSessions.map(s=>s.test_date).sort();
  if(dateRangeEl) dateRangeEl.textContent=`${context.api.fmtDate(dates[0])} – ${context.api.fmtDate(dates[dates.length-1])}`;

  // Build per-athlete PR data
  const byAthlete={};
  for(const s of valdSessions){
    const nm=context.api.normName(s.athlete_name);
    if(!byAthlete[nm]) byAthlete[nm]={sessions:[]};
    byAthlete[nm].sessions.push(s);
  }

  // Match to roster athletes
  const rows=context.api.rosterAthletes().map(a=>{
    const nm=context.api.normName(a._canonicalName||a.name);
    const key=Object.keys(byAthlete).find(k=>k===nm||k.replace(/\s+/g,' ')===nm.replace(/\s+/g,' '));
    if(!key) return null;
    const sessions=byAthlete[key].sessions.sort((a,b)=>a.test_date.localeCompare(b.test_date));
    const pr=sessions.reduce((best,s)=>s.jump_height>best.jump_height?s:best, sessions[0]);
    const recent=sessions[sessions.length-1];
    return {a, pr, recent, count:sessions.length};
  }).filter(Boolean).sort((x,y)=>y.pr.jump_height-x.pr.jump_height);

  const medals=['🥇','🥈','🥉'];

  tbody.innerHTML=rows.map(({a,pr,recent,count},i)=>{
    const diff=parseFloat((recent.jump_height-pr.jump_height).toFixed(1));
    const diffColor=diff===0?'var(--orange)':diff>0?'#4ADE80':'rgba(248,113,113,0.9)';
    const diffStr=diff===0?'AT PR':(diff>0?'+':'')+diff+'"';
    const isAtPR=recent.test_date===pr.test_date;
    return `<tr class="r${i+1}" data-onclick="openAth(${a.id})" style="cursor:pointer;">
      <td class="rn" style="padding:6px 10px;">${i<3?medals[i]:i+1}</td>
      <td style="padding:6px 10px;"><div style="display:flex;align-items:center;gap:7px;">${context.api.ava(a)}<span style="font-weight:500;">${a._canonicalName||a.name}</span></div></td>
      <td style="padding:6px 10px;text-align:center;">${context.api.posPill(a.pos)}</td>
      <td style="padding:6px 10px;text-align:center;font-family:var(--fh);font-size:14px;color:var(--orange);font-weight:700;">${pr.jump_height.toFixed(1)}"</td>
      <td style="padding:6px 10px;text-align:center;font-family:var(--fm);font-size:10px;color:var(--text3);">${context.api.fmtDate(pr.test_date)}</td>
      <td style="padding:6px 10px;text-align:center;font-family:var(--fm);font-size:12px;color:${isAtPR?'var(--orange)':'var(--text)'};">${recent.jump_height.toFixed(1)}"${isAtPR?' 🏆':''}</td>
      <td style="padding:6px 10px;text-align:center;font-family:var(--fm);font-size:10px;color:var(--text3);">${context.api.fmtDate(recent.test_date)}</td>
      <td style="padding:6px 10px;text-align:center;font-family:var(--fm);font-size:12px;font-weight:600;color:${diffColor};">${diff===0?'AT PR':(diff>0?'+':'')+diff+'"'}</td>
      <td style="padding:6px 10px;text-align:center;font-family:var(--fm);font-size:11px;color:var(--text3);">${count}</td>
    </tr>`;
  }).join('');
}


// Reference: originals/hockey.html:2781
function renderFPBoard(){
  const sortKey=document.getElementById('fp-sort').value;
  const m=context.api.getM(sortKey);
  const isJumpHt=sortKey==='cmjHeight'; // avoid showing the same value twice when sorting by Vertical Jump itself
  const r=context.api.athletesWithLatestSession().filter(a=>{const v=a[sortKey];return v!==null&&v!==undefined&&!isNaN(v);});
  const sorted=r.sort((a,b)=>m.hb?(b[sortKey]||0)-(a[sortKey]||0):(a[sortKey]||0)-(b[sortKey]||0));
  const hd=document.getElementById('fp-col-hd');
  hd.textContent=m.label;
  hd.style.display=isJumpHt?'none':'';
  const medals=['🥇','🥈','🥉'];
  document.getElementById('fp-tbody').innerHTML=sorted.map((a,i)=>`
    <tr class="r${i+1}">
      <td class="rn">${i<3?medals[i]:i+1}</td>
      <td data-onclick="openAth(${a.id})" style="cursor:pointer;"><div style="display:flex;align-items:center;gap:7px;">${context.api.ava(a)}<span>${a.name}</span>${a._latestSessionDate?`<span style="font-size:9px;color:var(--text3);font-family:var(--fm);">${a._latestSessionDate}</span>`:''}</div></td>
      <td>${context.api.posPill(a.pos)}</td>
      <td style="font-family:var(--fm);color:var(--yellow);">${a.cmjHeight!=null?a.cmjHeight.toFixed(1)+'"':'—'}</td>
      <td style="font-family:var(--fm);color:${m.color};display:${isJumpHt?'none':''};">${a[sortKey]!=null?m.fmt(a[sortKey]):'—'} ${a[sortKey]!=null?m.unit:''}</td>
      <td>${context.api.tierBadge(a.tier)}</td>
      <td style="text-align:center;"><button data-onclick="clearMetric(${a.id},'${sortKey}','${m.label}')" title="Clear this value" style="background:none;border:1px solid var(--border);border-radius:3px;color:var(--text3);padding:2px 6px;cursor:pointer;font-size:10px;">×</button></td>
    </tr>`).join('');
}

return Object.defineProperties({}, {
  FP_SORT_KEYS: {enumerable:true, configurable:true, get:()=>FP_SORT_KEYS},
  populateFPSort: {enumerable:true, configurable:true, get:()=>populateFPSort},
  initFP: {enumerable:true, configurable:true, get:()=>initFP},
  renderCMJScatter: {enumerable:true, configurable:true, get:()=>renderCMJScatter},
  renderPRTracker: {enumerable:true, configurable:true, get:()=>renderPRTracker},
  renderFPBoard: {enumerable:true, configurable:true, get:()=>renderFPBoard}
});
}
