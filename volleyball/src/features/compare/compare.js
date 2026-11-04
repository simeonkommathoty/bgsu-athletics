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
// ── Compare radar ── (up to 3 athletes)
// Reference: originals/volleyball.html:1936
function renderCompareRadar(players){
  context.api.kc('cmp-radar');
  const pCols=['#FE5000','#60A5FA','#FCD34D'];
  const pAlpha=['rgba(254,80,0,0.09)','rgba(96,165,250,0.09)','rgba(252,211,77,0.09)'];
  context.api.CH['cmp-radar']=new Chart(document.getElementById('cmp-radar'),{
    type:'radar',
    data:{labels:context.api.RADAR_LABELS,datasets:players.map((p,i)=>({
      label:p._canonicalName||p.name, data:context.api.athleteRadarData(p),
      borderColor:pCols[i], backgroundColor:pAlpha[i],
      pointBackgroundColor:pCols[i], borderWidth:2, pointRadius:3
    }))},
    options:context.api.RADAR_OPTIONS
  });
  const leg4=document.getElementById('cmp-radar-legend');
  if(leg4) leg4.innerHTML=context.api.VB_RADAR_LEGEND_HTML;
}

/* ─── COMPARE ─── */
// Reference: originals/volleyball.html:3120
function initCmp(){
  const opts=context.api.athleteOptions();
  ['cmp-a','cmp-b','cmp-c'].forEach((id,i)=>{
    const el=document.getElementById(id);
    if(id==='cmp-c')el.innerHTML='<option value="">— none —</option>'+opts;else el.innerHTML=opts;
    // Option values are athlete ids; default to the first two listed athletes.
    if(id==='cmp-a'&&el.options[0])el.value=el.options[0].value;if(id==='cmp-b'&&el.options[1])el.value=el.options[1].value;
  });
  renderCompare();
}


// Reference: originals/volleyball.html:3129
function renderCompare(){
  // Dropdown values are athlete ids (not array positions); a removed/unknown selection is skipped.
  const byId=v=>v===''?null:context.api.ATHLETES.find(x=>x.id===parseInt(v))||null;
  const players=['cmp-a','cmp-b','cmp-c'].map(id=>byId(document.getElementById(id).value)).filter(Boolean);
  if(!players.length){context.api.kc('cmp-radar');document.getElementById('cmp-cards').innerHTML='';document.getElementById('cmp-bars').innerHTML='';return;}
  const pCols=['#FE5000','#60A5FA','#FCD34D'];

  context.api.kc('cmp-radar');
  renderCompareRadar(players);

  document.getElementById('cmp-cards').innerHTML=players.map((p,i)=>`
    <div style="flex:1;min-width:110px;background:var(--bg3);border:1px solid ${pCols[i]}44;border-radius:var(--r2);padding:13px;text-align:center;">
      ${context.api.ava(p,'-lg')}
      <div style="font-family:var(--fh);font-size:14px;font-weight:800;text-transform:uppercase;margin:7px 0 2px;letter-spacing:0.5px;">${p.name}</div>
      <div style="font-size:9px;color:var(--text3);font-family:var(--fm);margin-bottom:7px;">${context.api.posPill(p.pos)} ${p.yr}</div>
      ${context.api.tierBadge(p.tier)}
      <div style="font-family:var(--fh);font-size:32px;font-weight:900;color:${pCols[i]};margin-top:8px;letter-spacing:-1px;">${p.composite}</div>
      <div style="font-size:8.5px;color:var(--text3);font-family:var(--fm);">composite</div>
      <div style="margin-top:7px;font-size:10px;color:var(--text2);font-family:var(--fm);">${p._approachJumpFresh!=null?p._approachJumpFresh.toFixed(1)+'"':'—'} app · ${p.sprint10!=null?p.sprint10.toFixed(2)+'s':'—'} 10yd</div>
    </div>`).join('');

  const displayMets=context.api.ALL_METRICS.filter(m=>m.key!=='composite'&&m.key!=='acwr');
  document.getElementById('cmp-bars').innerHTML=displayMets.map(m=>{
    const vals=players.map(p=>p[m.key]);
    const present=vals.filter(v=>v!=null);
    const maxV=Math.max(...present,0.001);
    const minV=present.length?Math.min(...present):0;
    const pct=m.hb?(v=>Math.round(v/maxV*100)):(v=>Math.max(15,Math.round((1-(v-minV)/(maxV-minV||1))*100)));
    return`<div style="margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:10px;color:var(--text2);font-family:var(--fm);"><span>${m.label}</span><span>${vals.map((v,i)=>`<span style="color:${pCols[i]}">${v!=null?m.fmt(v)+' '+m.unit:'—'}</span>`).join(' · ')}</span></div>
    ${players.map((p,i)=>`<div style="display:flex;align-items:center;gap:9px;margin-bottom:4px;"><div style="font-size:10px;color:var(--text3);width:60px;font-family:var(--fm);overflow:hidden;text-overflow:ellipsis;">${p.name.split(' ')[0]}</div><div style="flex:1;background:var(--bg4);border-radius:3px;height:6px;overflow:hidden;"><div style="height:100%;width:${p[m.key]!=null?Math.min(100,pct(p[m.key])):0}%;background:${pCols[i]};border-radius:3px;transition:width 0.5s;"></div></div><span style="font-family:var(--fm);font-size:10px;color:${pCols[i]};width:55px;text-align:right;">${p[m.key]!=null?m.fmt(p[m.key])+' '+m.unit:'—'}</span></div>`).join('')}
    </div><div style="height:1px;background:var(--border);margin:4px 0;"></div>`;
  }).join('');
}

return Object.defineProperties({}, {
  renderCompareRadar: {enumerable:true, configurable:true, get:()=>renderCompareRadar},
  initCmp: {enumerable:true, configurable:true, get:()=>initCmp},
  renderCompare: {enumerable:true, configurable:true, get:()=>renderCompare}
});
}
