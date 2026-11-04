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

// Reference: originals/volleyball.html:2995
let activeM='composite';


// Reference: originals/volleyball.html:2996
function initLB(){
  const chips=document.getElementById('metric-chips');
  const r=context.api.rosterAthletes();
  const groups={jump:'Jump Testing',speed:'Speed',vald:'VALD Force Plate',kinexon:'Kinexon',strength:'Strength (Teambuildr)',score:'Score'};
  let html='';
  for(const [g,lbl] of Object.entries(groups)){
    const mets=context.api.ALL_METRICS.filter(m=>m.group===g);
    if(mets.length){
      html+=`<span style="font-size:9px;color:var(--text3);font-family:var(--fm);padding:4px 2px;letter-spacing:1px;">${lbl}:</span>`;
      html+=mets.map(m=>{
        const hasData=context.api.metricHasData(m.key, r);
        const classes=`chip${m.key===activeM&&hasData?' active':''}${hasData?'':' chip-disabled'}`;
        const onclick=hasData?`data-onclick="setM('${m.key}')"`:'title="No data available"';
        const style=hasData?'':'style="opacity:0.35;cursor:not-allowed;pointer-events:none;"';
        return `<div class="${classes}" ${onclick} ${style}>${m.label}${hasData?'':' — no data'}</div>`;
      }).join('');
    }
  }
  chips.innerHTML=html;
  // If currently active metric has no data, fall back to composite or first available
  if(!context.api.metricHasData(activeM, r)){
    const fallback=context.api.ALL_METRICS.find(m=>context.api.metricHasData(m.key, r));
    if(fallback) activeM=fallback.key;
  }
  renderLB();
}


// Reference: originals/volleyball.html:3022
function setM(k){
  if(!context.api.metricHasData(k)) return;
  activeM=k;
  document.querySelectorAll('#metric-chips .chip').forEach(c=>{
    const isActive=c.textContent.replace(' — no data','')===context.api.ALL_METRICS.find(m=>m.key===k)?.label;
    c.classList.toggle('active',isActive);
  });
  renderLB();
}


// Reference: originals/volleyball.html:3031
function renderLB(){
  const m=context.api.getM(activeM);
  // Only include athletes who have a real value for this metric
  const withData=context.api.rosterAthletes().filter(a=>{
    const v=a[activeM];
    if(activeM==='composite') return true;
    return v!==null&&v!==undefined&&!isNaN(v)&&v!==0;
  });
  const sorted=withData.sort((a,b)=>m.hb?b[activeM]-a[activeM]:a[activeM]-b[activeM]);
  const noDataCount=context.api.rosterAthletes().length-sorted.length;
  document.getElementById('lb-title').innerHTML=`<div class="cdot"></div>Top ${sorted.length} — ${m.label}${noDataCount>0?` <span style="font-size:10px;color:var(--text3);font-weight:400;">(${noDataCount} athlete${noDataCount!==1?'s':''} excluded — no data)</span>`:''}`;
  document.getElementById('lb-col').textContent=m.label;
  const medals=['🥇','🥈','🥉'];
  if(!sorted.length){
    document.getElementById('lb-tbody').innerHTML=`<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text3);font-family:var(--fm);font-size:12px;">No data for this metric yet — import a CSV with ${m.label} values.</td></tr>`;
    context.api.kc('lb-chart');
    document.getElementById('lb-stats').innerHTML='';
    return;
  }
  document.getElementById('lb-tbody').innerHTML=sorted.map((a,i)=>{
    const date=context.api.metricDate(a, activeM);
    return`<tr class="r${i+1}" data-onclick="openAth(${a.id})" style="cursor:pointer;">
      <td class="rn">${i<3?medals[i]:i+1}</td>
      <td><div style="display:flex;align-items:center;gap:7px;">${context.api.ava(a)}<div><div style="font-weight:${i<3?'600':'400'}">${a.name}</div>${date?`<div style="font-size:9px;color:var(--text3);font-family:var(--fm);">${date}</div>`:''}</div></div></td>
      <td>${context.api.posPill(a.pos)}</td>
      <td style="font-family:var(--fm);color:${m.color};font-weight:${i<3?'600':'400'};">${m.fmt(a[activeM])} ${m.unit}</td>
      <td>${context.api.tierBadge(a.tier)}</td>
    </tr>`;
  }).join('');
  context.api.kc('lb-chart');
  const bgs=sorted.map((_,i)=>i===0?m.color+'cc':i<3?m.color+'88':m.color+'33');
  context.api.CH['lb-chart']=new Chart(document.getElementById('lb-chart'),{
    type:'bar',data:{labels:sorted.map(a=>a.name.split(' ')[0]),datasets:[{label:m.label,data:sorted.map(a=>a[activeM]),backgroundColor:bgs,borderRadius:3,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#3D2A1E',font:{size:9,family:'Share Tech Mono'},maxRotation:50,autoSkip:false}},y:{grid:{color:'rgba(254,80,0,0.04)'},ticks:{color:'#6A5646',font:{size:9}}}}}
  });
  const vals=sorted.map(a=>a[activeM]);
  const maxV=Math.max(...vals),minV=Math.min(...vals),avgV=vals.reduce((a,b)=>a+b,0)/vals.length;
  document.getElementById('lb-stats').innerHTML=[
    ['Best',m.fmt(m.hb?maxV:minV)+' '+m.unit,m.color],
    ['Average',m.fmt(avgV)+' '+m.unit,'var(--text2)'],
    ['Range',m.fmt(m.hb?minV:maxV)+' '+m.unit,'var(--text3)']
  ].map(([l,v,c])=>`<div style="text-align:center;background:var(--bg3);padding:10px;border-radius:var(--r);border:1px solid var(--border);"><div style="font-family:var(--fm);font-size:15px;color:${c};">${v}</div><div style="font-size:9px;color:var(--text3);font-family:var(--fm);margin-top:3px;letter-spacing:1px;">${l}</div></div>`).join('');
}

return Object.defineProperties({}, {
  activeM: {enumerable:true, configurable:true, get:()=>activeM, set:value=>{activeM=value;}},
  initLB: {enumerable:true, configurable:true, get:()=>initLB},
  setM: {enumerable:true, configurable:true, get:()=>setM},
  renderLB: {enumerable:true, configurable:true, get:()=>renderLB}
});
}
