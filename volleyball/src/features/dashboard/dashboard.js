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

// Reference: originals/volleyball.html:1648
function initDash(){
  populateKpiSort();
  const roster=context.api.rosterAthletes();
  if(!roster.length){
    document.getElementById('kpi-n').textContent='—';
    document.getElementById('kpi-tbody').innerHTML=`<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text3);font-family:var(--fm);">Loading from cloud...</td></tr>`;
    return;
  }
  const avg=(k)=>{
    const vals=roster.map(a=>a[k]).filter(v=>v!==null&&v!==undefined&&!isNaN(v));
    return vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:0;
  };
  document.getElementById('kpi-n').textContent=roster.length;
  document.getElementById('kpi-appr').textContent=context.api.inchesToFeet(avg('_approachJumpFresh'));
  document.getElementById('kpi-cmj').textContent=(()=>{const v=avg('cmjHeight');return v?v.toFixed(1)+'"':'—';})();
  document.getElementById('kpi-vert').textContent=(()=>{const v=avg('standVert');return v?v.toFixed(1)+'"':'—';})();
  document.getElementById('kpi-pp').textContent=(()=>{const v=avg('peakPower');return isNaN(v)||v===0?'—':Math.round(v);})();
  const el=roster.filter(a=>a.tier==='Elite').length;
  document.getElementById('kpi-elite').textContent=el;
  document.getElementById('kpi-elite-pct').textContent=Math.round(el/roster.length*100)+'% of roster';
  const top=roster.filter(a=>a._approachJumpFresh!=null).sort((a,b)=>b._approachJumpFresh-a._approachJumpFresh)[0];
  if(top){
    document.getElementById('kpi-top').textContent=top.name;
    document.getElementById('kpi-top-pos').textContent=top.pos+' · '+(top._approachFeetDisplay||context.api.inchesToFeet(top._approachJumpFresh));
  }
  renderKpiTable();renderTierDonut();renderTeamRadar();renderJumpCompareBar();renderTrendLine();
}


// Reference: originals/volleyball.html:1676
let kpiSortKey='composite';


// Reference: originals/volleyball.html:1677
function sortKpi(k){kpiSortKey=k;document.getElementById('kpi-sort').value=k;renderKpiTable();}


// Reference: originals/volleyball.html:1678
function renderKpiTable(){
  kpiSortKey=document.getElementById('kpi-sort').value||'composite';
  const m=context.api.getM(kpiSortKey)||{hb:true,fmt:v=>v,unit:'',color:'var(--orange)'};
  const isComposite=kpiSortKey==='composite';
  const roster=context.api.rosterAthletes();
  if(!roster.length){
    document.getElementById('kpi-tbody').innerHTML=`<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text3);font-family:var(--fm);">Loading athletes from cloud...</td></tr>`;
    return;
  }
  const sortVal=(a,key)=>key==='approachJump'?a._approachJumpFresh:a[key];
  const sorted=roster
    .filter(a=>{
      if(isComposite) return true;
      const v=sortVal(a,kpiSortKey);
      return v!==null&&v!==undefined&&!isNaN(v)&&v!==0;
    })
    .sort((a,b)=>m.hb?sortVal(b,kpiSortKey)-sortVal(a,kpiSortKey):sortVal(a,kpiSortKey)-sortVal(b,kpiSortKey));
  const medals=['🥇','🥈','🥉'];
  document.getElementById('kpi-tbody').innerHTML=sorted.map((a,i)=>`
    <tr class="r${i+1}" data-onclick="openAth(${a.id})" style="cursor:pointer;">
      <td class="rn">${i<3?medals[i]:i+1}</td>
      <td><div style="display:flex;align-items:center;gap:7px;">${context.api.ava(a)}<span style="font-weight:500;">${a.name}</span><span style="font-size:9px;color:var(--text3);font-family:var(--fm);">${a.yr}</span></div></td>
      <td>${context.api.posPill(a.pos)}</td>
      <td style="font-family:var(--fm);color:var(--orange);">${a._approachJumpFresh!=null?(a._approachFeetDisplay||context.api.inchesToFeet(a._approachJumpFresh)):'—'}</td>
      <td style="font-family:var(--fm);">${a.cmjHeight!=null?a.cmjHeight.toFixed(1)+'"':'—'}</td>
      <td style="font-family:var(--fm);">${a.standVert!=null?a.standVert.toFixed(1)+'"':'—'}</td>
      <td style="font-family:var(--fm);">${a.peakPower?Math.round(a.peakPower):'—'}</td>
      <td style="font-family:var(--fm);${a.sprint10&&a.sprint10<1.70?'color:var(--green);':''}">${a.sprint10!=null?a.sprint10.toFixed(2)+'s':'—'}</td>
      <td><span style="font-family:var(--fm);font-weight:600;color:var(--orange);">${a.composite}</span></td>
      <td>${context.api.tierBadge(a.tier)}</td>
    </tr>`).join('');
}


// Reference: originals/volleyball.html:1711
function renderTierDonut(){
  context.api.kc('tier-donut');
  const cnt={}; context.api.TIERS.forEach(t=>cnt[t]=0); context.api.rosterAthletes().forEach(a=>cnt[a.tier]++);
  const cols=['#FCD34D','#FE5000','#60A5FA','#3D2A1E'];
  context.api.CH['tier-donut']=new Chart(document.getElementById('tier-donut'),{
    type:'doughnut',data:{labels:context.api.TIERS,datasets:[{data:context.api.TIERS.map(t=>cnt[t]),backgroundColor:cols,borderColor:'#130D08',borderWidth:2,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{display:false}}}
  });
  document.getElementById('tier-legend').innerHTML=context.api.TIERS.map((t,i)=>`
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:7px;"><div style="width:7px;height:7px;border-radius:2px;background:${cols[i]};"></div><span style="font-size:11px;color:var(--text2);font-family:var(--fm);">${t}</span></div>
      <div style="display:flex;align-items:center;gap:8px;"><div style="width:55px;background:var(--bg4);border-radius:2px;height:3px;overflow:hidden;"><div style="width:${Math.round(cnt[t]/context.api.rosterAthletes().length*100)}%;height:100%;background:${cols[i]};border-radius:2px;"></div></div>
      <span style="font-family:var(--fm);font-size:10px;color:var(--text3);">${cnt[t]}</span></div>
    </div>`).join('');
}


// Reference: originals/volleyball.html:1881
function renderTeamRadar(){
  context.api.kc('team-radar');
  const {labels, data}=context.api.groupRadarFiltered(context.api.rosterAthletes());
  context.api.CH['team-radar']=new Chart(document.getElementById('team-radar'),{
    type:'radar',
    data:{labels,datasets:[{
      label:'Team Avg',data,
      borderColor:'#FE5000',backgroundColor:'rgba(254,80,0,0.09)',
      pointBackgroundColor:'#FE5000',pointRadius:3,borderWidth:2
    }]},
    options:context.api.RADAR_OPTIONS
  });
  const leg=document.getElementById('team-radar-legend');
  if(leg) leg.innerHTML=context.api.VB_RADAR_LEGEND_HTML;
}


// Reference: originals/volleyball.html:1954
function renderJumpCompareBar(){
  context.api.kc('jump-compare-bar');
  const sorted=context.api.rosterAthletes().sort((a,b)=>(b._approachJumpFresh??-1)-(a._approachJumpFresh??-1));
  context.api.CH['jump-compare-bar']=new Chart(document.getElementById('jump-compare-bar'),{
    type:'bar',
    data:{labels:sorted.map(a=>a.name.split(' ')[0]),
    datasets:[
      {label:'Approach Jump',data:sorted.map(a=>a._approachJumpFresh),backgroundColor:'rgba(254,80,0,0.7)',borderRadius:3,borderSkipped:false},
      {label:'CMJ Height',data:sorted.map(a=>a.cmjHeight),backgroundColor:'rgba(252,211,77,0.6)',borderRadius:3,borderSkipped:false},
      {label:'Standing Vert',data:sorted.map(a=>a.standVert),backgroundColor:'rgba(96,165,250,0.55)',borderRadius:3,borderSkipped:false},
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{mode:'index'}},scales:{
      x:{grid:{display:false},ticks:{color:'#3D2A1E',font:{size:9,family:'Share Tech Mono'},maxRotation:40,autoSkip:false}},
      y:{grid:{color:'rgba(254,80,0,0.04)'},ticks:{color:'#6A5646',font:{size:9}}}
    }}
  });
}


// Reference: originals/volleyball.html:1972
function renderTrendLine(){
  context.api.kc('trend-line');
  const cmpTrend=context.api.TEST_BLOCKS.map((_,bi)=>parseFloat((context.api.rosterAthletes().reduce((s,a)=>s+a.trend[bi],0)/context.api.rosterAthletes().length).toFixed(1)));
  const cmjTrend=context.api.TEST_BLOCKS.map((_,bi)=>parseFloat((context.api.rosterAthletes().reduce((s,a)=>s+a.cmjHeight,0)/context.api.rosterAthletes().length*(0.9+bi*0.02)).toFixed(1)));
  const legend=document.getElementById('trend-legend');
  legend.innerHTML=[['#FE5000','Composite'],['#FCD34D','CMJ Avg']].map(([c,l])=>`<div style="display:flex;align-items:center;gap:5px;font-size:10px;color:var(--text2);font-family:var(--fm);"><div style="width:14px;height:2px;background:${c};border-radius:1px;"></div>${l}</div>`).join('');
  context.api.CH['trend-line']=new Chart(document.getElementById('trend-line'),{
    type:'line',
    data:{labels:context.api.TEST_BLOCKS,datasets:[
      {label:'Composite',data:cmpTrend,borderColor:'#FE5000',backgroundColor:'rgba(254,80,0,0.05)',tension:0.4,pointRadius:4,pointBackgroundColor:'#FE5000',borderWidth:2,fill:true,yAxisID:'y'},
      {label:'CMJ',data:cmjTrend,borderColor:'#FCD34D',backgroundColor:'transparent',tension:0.4,pointRadius:3,pointBackgroundColor:'#FCD34D',borderWidth:1.5,borderDash:[4,3],yAxisID:'y1'},
    ]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false}},scales:{
      x:{grid:{color:'rgba(254,80,0,0.03)'},ticks:{color:'#6A5646',font:{size:10,family:'Share Tech Mono'}}},
      y:{grid:{color:'rgba(254,80,0,0.03)'},ticks:{color:'#6A5646',font:{size:9}},min:40,max:100},
      y1:{grid:{display:false},ticks:{color:'#FCD34D',font:{size:9}},position:'right',min:14,max:30}
    }}
  });
}

// Team Dashboard KPI sort
// Reference: originals/volleyball.html:2337
const KPI_SORT_KEYS = ['composite','approachJump','cmjHeight','standVert','peakPower','rsi','asymmetry','sprint10','jumpVol','playerLoad'];


// Reference: originals/volleyball.html:2338
function populateKpiSort(){
  context.api.populateMetricSelect('kpi-sort', KPI_SORT_KEYS);
}

return Object.defineProperties({}, {
  initDash: {enumerable:true, configurable:true, get:()=>initDash},
  kpiSortKey: {enumerable:true, configurable:true, get:()=>kpiSortKey, set:value=>{kpiSortKey=value;}},
  sortKpi: {enumerable:true, configurable:true, get:()=>sortKpi},
  renderKpiTable: {enumerable:true, configurable:true, get:()=>renderKpiTable},
  renderTierDonut: {enumerable:true, configurable:true, get:()=>renderTierDonut},
  renderTeamRadar: {enumerable:true, configurable:true, get:()=>renderTeamRadar},
  renderJumpCompareBar: {enumerable:true, configurable:true, get:()=>renderJumpCompareBar},
  renderTrendLine: {enumerable:true, configurable:true, get:()=>renderTrendLine},
  KPI_SORT_KEYS: {enumerable:true, configurable:true, get:()=>KPI_SORT_KEYS},
  populateKpiSort: {enumerable:true, configurable:true, get:()=>populateKpiSort}
});
}
