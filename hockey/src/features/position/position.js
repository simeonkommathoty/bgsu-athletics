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
// ── Position board radar ── (position avg vs team avg)
// Reference: originals/hockey.html:2131
function renderPositionRadar(grp){
  context.api.kc('pos-radar');
  const {labels:posLabels, data:posData}=context.api.groupRadarFiltered(grp);
  const {labels:teamLabels, data:teamData}=context.api.groupRadarFiltered(context.api.rosterAthletes());
  // Use team labels as base (may have more spokes), fill pos with 0 where missing
  const allLabels=[...new Set([...posLabels,...teamLabels])];
  const alignData=(src,srcLabels)=>allLabels.map(l=>{const i=srcLabels.indexOf(l);return i>=0?src[i]:0;});
  context.api.CH['pos-radar']=new Chart(document.getElementById('pos-radar'),{
    type:'radar',
    data:{labels:allLabels,datasets:[
      {label:'Position',data:alignData(posData,posLabels),borderColor:'#FE5000',backgroundColor:'rgba(254,80,0,0.09)',pointBackgroundColor:'#FE5000',borderWidth:2,pointRadius:3},
      {label:'Team',data:alignData(teamData,teamLabels),borderColor:'rgba(255,255,255,0.14)',backgroundColor:'rgba(255,255,255,0.02)',pointBackgroundColor:'rgba(255,255,255,0.18)',borderWidth:1.5,borderDash:[4,3],pointRadius:2}
    ]},
    options:context.api.RADAR_OPTIONS
  });
  const leg3=document.getElementById('pos-radar-legend');
  if(leg3) leg3.innerHTML=context.api.VB_RADAR_LEGEND_HTML;
}

/* ─── POSITION ─── */
// Reference: originals/hockey.html:3471
let activePos='F';


// Reference: originals/hockey.html:3472
function initPos(){
  const posColors={F:'#FE5000',D:'#60A5FA',G:'#F87171'};
  document.getElementById('pos-kpi-strip').innerHTML=context.api.POSITIONS.map(p=>{
    const g=context.api.rosterAthletes().filter(a=>a.pos===p);
    const avg=g.length?Math.round(g.reduce((s,a)=>s+a.composite,0)/g.length):0;
    return`<div class="wl-card"><div style="font-size:9px;color:var(--text3);font-family:var(--fm);letter-spacing:1px;margin-bottom:5px;">${p}</div><div class="wl-val" style="color:${posColors[p]};">${g.length}</div><div class="wl-lbl">athletes</div><div style="font-size:9px;color:var(--text2);font-family:var(--fm);margin-top:3px;">avg ${avg} pts</div></div>`;
  }).join('');
  document.getElementById('pos-tabs').innerHTML=context.api.POSITIONS.map(p=>`<div class="pos-tab${p===activePos?' active':''}" data-onclick="setPosTab('${p}')">${p}</div>`).join('');
  renderPosBoard();
}


// Reference: originals/hockey.html:3482
function setPosTab(p){activePos=p;document.querySelectorAll('.pos-tab').forEach(t=>t.classList.toggle('active',t.textContent===p));renderPosBoard();}


// Reference: originals/hockey.html:3483
function renderPosBoard(){
  const grp=context.api.rosterAthletes().filter(a=>a.pos===activePos).sort((a,b)=>b.composite-a.composite);
  document.getElementById('pos-title').innerHTML=`<div class="cdot"></div>${activePos} — ${context.api.POS_FULL[activePos]} (${grp.length})`;
  const tierCols=['#FCD34D','#FE5000','#60A5FA','#3D2A1E'];
  document.getElementById('pos-sections').innerHTML=context.api.TIERS.map(t=>{
    const members=grp.filter(a=>a.tier===t);
    return`<div class="tier-grp"><div class="tg-header"><span class="tier ${context.api.TIER_CLASS_MAP[t]}">${t}</span><span style="font-size:9px;color:var(--text3);font-family:var(--fm);">${members.length} athlete${members.length!==1?'s':''}</span>${members.length?`<span style="font-size:9px;color:var(--text3);font-family:var(--fm);margin-left:auto;">avg ${Math.round(members.reduce((s,a)=>s+a.composite,0)/members.length)} pts</span>`:''}</div>
    ${members.map((a,i)=>`<div class="p-row" data-onclick="openAth(${a.id})"><span style="font-family:var(--fm);font-size:10px;color:var(--text3);width:16px;">${i+1}</span>${context.api.ava(a)}<div style="flex:1;"><div style="font-size:12px;font-weight:500;">${a.name}</div><div style="font-size:9px;color:var(--text3);font-family:var(--fm);">${a.yr} · App ${a._approachJumpFresh!=null?a._approachJumpFresh.toFixed(1)+'"':'—'} · CMJ ${a.cmjHeight!=null?a.cmjHeight.toFixed(1)+'"':'—'}</div></div><div style="text-align:right;"><div style="font-family:var(--fm);font-size:13px;color:var(--orange);font-weight:600;">${a.composite}</div></div>${context.api.spark(a.trend)}</div>`).join('')}
    </div>`;
  }).join('');

  // Position radar
  context.api.kc('pos-radar');
  renderPositionRadar(grp);

  // Tier legend
  const tc=context.api.TIERS.map(t=>grp.filter(a=>a.tier===t).length);
  document.getElementById('pos-tier-legend').innerHTML=context.api.TIERS.map((t,i)=>`
    <div style="display:flex;align-items:center;justify-content:space-between;"><div style="display:flex;align-items:center;gap:7px;"><div style="width:7px;height:7px;border-radius:2px;background:${tierCols[i]};"></div><span style="font-size:11px;color:var(--text2);font-family:var(--fm);">${t}</span></div><div style="display:flex;align-items:center;gap:8px;"><div style="width:50px;background:var(--bg4);border-radius:2px;height:3px;overflow:hidden;"><div style="width:${grp.length?Math.round(tc[i]/grp.length*100):0}%;height:100%;background:${tierCols[i]};border-radius:2px;"></div></div><span style="font-family:var(--fm);font-size:10px;color:var(--text3);">${tc[i]}</span></div></div>`).join('');

  // Position averages
  if(grp.length){
    const keyMets=['approachJump','cmjHeight','peakPower','sprint10','jumpVol'];
    document.getElementById('pos-avgs').innerHTML=`<div style="background:var(--bg3);border-radius:var(--r);padding:10px;border:1px solid var(--border);">
      <div style="font-size:9px;color:var(--text3);font-family:var(--fm);letter-spacing:1px;margin-bottom:9px;">POSITION AVERAGES</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:7px;">
        ${keyMets.map(k=>{const m=context.api.getM(k);const av=grp.reduce((s,a)=>s+a[k],0)/grp.length;return`<div style="text-align:center;"><div style="font-family:var(--fm);font-size:14px;color:var(--orange);">${m.fmt(av)}</div><div style="font-size:8.5px;color:var(--text3);font-family:var(--fm);margin-top:2px;">${m.label.split(' ').slice(0,2).join(' ')}</div></div>`;}).join('')}
      </div></div>`;
  }
}

return Object.defineProperties({}, {
  renderPositionRadar: {enumerable:true, configurable:true, get:()=>renderPositionRadar},
  activePos: {enumerable:true, configurable:true, get:()=>activePos, set:value=>{activePos=value;}},
  initPos: {enumerable:true, configurable:true, get:()=>initPos},
  setPosTab: {enumerable:true, configurable:true, get:()=>setPosTab},
  renderPosBoard: {enumerable:true, configurable:true, get:()=>renderPosBoard}
});
}
