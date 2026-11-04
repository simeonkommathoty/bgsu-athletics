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
// ── Profile radar ── (athlete vs team avg)
// called from inside renderProfile, uses local `a` variable
// Reference: originals/hockey.html:2114
function renderProfileRadar(a){
  context.api.kc('p-radar');
  const athleteData=context.api.athleteRadarData(a);
  const teamData=context.api.groupRadarData(context.api.rosterAthletes());
  context.api.CH['p-radar']=new Chart(document.getElementById('p-radar'),{
    type:'radar',
    data:{labels:context.api.RADAR_LABELS,datasets:[
      {label:a._canonicalName||a.name,data:athleteData,borderColor:'#FE5000',backgroundColor:'rgba(254,80,0,0.09)',pointBackgroundColor:'#FE5000',borderWidth:2,pointRadius:3},
      {label:'Team Avg',data:teamData,borderColor:'rgba(255,255,255,0.14)',backgroundColor:'rgba(255,255,255,0.03)',pointBackgroundColor:'rgba(255,255,255,0.18)',borderWidth:1.5,borderDash:[4,3],pointRadius:2}
    ]},
    options:context.api.RADAR_OPTIONS
  });
  const leg2=document.getElementById('p-radar-legend');
  if(leg2) leg2.innerHTML=context.api.VB_RADAR_LEGEND_HTML;
}

/* ─── PROFILE ─── */
// Reference: originals/hockey.html:2208
function initProfile(){
  const sel=document.getElementById('profile-sel');
  sel.innerHTML=context.api.athleteOptions();
  renderProfile();
}


// Reference: originals/hockey.html:2213
function renderProfile(){
  const id=parseInt(document.getElementById('profile-sel').value);
  // Dropdown values are athlete ids, which need not equal array positions (e.g. after dedup/merge).
  const a=context.api.ATHLETES.find(x=>x.id===id)||context.api.ATHLETES[0];
  if(!a){document.getElementById('prof-hero').innerHTML='';return;}
  const rankAll=context.api.rosterAthletes().sort((x,y)=>y.composite-x.composite).findIndex(x=>x.id===a.id)+1;
  const rankPos=context.api.rosterAthletes().filter(x=>x.pos===a.pos).sort((x,y)=>y.composite-x.composite).findIndex(x=>x.id===a.id)+1;
  const acwrC=a.acwr>1.5?'var(--red)':a.acwr>1.3?'var(--yellow)':a.acwr<0.8?'var(--blue)':'var(--green)';

  document.getElementById('prof-hero').innerHTML=`
    <div class="prof-hero">
      <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:20px;">
        <div class="photo-uploader" data-onclick="document.getElementById('photo-upload-input').click()">
          ${context.api.ava(a,'-xl')}
          <div class="upload-overlay"><span style="font-size:16px;">📷</span><span>${a.photo_url?'CHANGE':'UPLOAD'}</span></div>
          ${a.photo_url?`<div class="remove-photo" data-onclick="event.stopPropagation();removeAthletePhoto(${a.id})">×</div>`:''}
        </div>
        <input type="file" id="photo-upload-input" accept="image/jpeg,image/png,image/webp" style="display:none;" data-onchange="handlePhotoUpload(event,${a.id})">
        <div style="flex:1;">
          <div style="font-family:var(--fh);font-size:30px;font-weight:900;text-transform:uppercase;letter-spacing:1px;line-height:1;">${a.name}</div>
          <div style="display:flex;align-items:center;gap:7px;margin-top:7px;flex-wrap:wrap;">
            ${context.api.posPill(a.pos)} ${context.api.tierBadge(a.tier)}
            <span style="font-size:10px;color:var(--text3);font-family:var(--fm);">${context.api.POS_FULL[a.pos]} · ${a.yr} · Age ${a.age}</span>
            <span style="font-size:10px;color:var(--text3);font-family:var(--fm);">#${rankAll} team · #${rankPos} at ${a.pos}</span>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:var(--fh);font-size:52px;font-weight:900;color:var(--orange);letter-spacing:-2px;line-height:1;">${a.composite}</div>
          <div style="font-size:9px;color:var(--text3);font-family:var(--fm);letter-spacing:1px;">COMPOSITE</div>
          <div style="margin-top:5px;">${context.api.spark(a.trend)}</div>
        </div>
      </div>
      <div class="prof-kpis">
        ${[['App Jmp', a._approachJumpFresh!=null?(a._approachFeetDisplay||context.api.inchesToFeet(a._approachJumpFresh)):'—','#FE5000'],['CMJ Ht',a.cmjHeight!=null?a.cmjHeight.toFixed(1)+'"':'—','#FCD34D'],['Goal-Blue',a.standVert!=null?a.standVert.toFixed(2)+'s':'—','#FB923C'],['10-yd',a.sprint10!=null?a.sprint10.toFixed(2)+'s':'—','#a78bfa'],['Pk Pwr',a.peakPower?Math.round(a.peakPower)+' W':'—','#60A5FA'],['RSI',a.rsi!=null?a.rsi.toFixed(3):'—','#4ADE80'],['Asymm',a.concImpulseAsym!=null?a.concImpulseAsym.toFixed(1)+'%':'—',a.concImpulseAsym&&Math.abs(a.concImpulseAsym)>10?'var(--red)':'var(--text2)'],['ACWR',a.acwr!=null&&!isNaN(a.acwr)?a.acwr.toFixed(2):'—',acwrC]].map(([l,v,c])=>`<div class="pkpi"><div class="pkv" style="color:${c}">${v}</div><div class="pkl">${l}</div></div>`).join('')}
      </div>
    </div>`;

  // Radar
  context.api.kc('p-radar');
  renderProfileRadar(a);

  // Trend
  context.api.kc('p-trend');
  context.api.CH['p-trend']=new Chart(document.getElementById('p-trend'),{
    type:'line',data:{labels:context.api.TEST_BLOCKS,datasets:[{label:'Score',data:a.trend,borderColor:'#FE5000',backgroundColor:'rgba(254,80,0,0.07)',tension:0.4,pointRadius:5,pointBackgroundColor:'#FE5000',borderWidth:2,fill:true}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(254,80,0,0.03)'},ticks:{color:'#6A5646',font:{size:10,family:'Share Tech Mono'}}},y:{grid:{color:'rgba(254,80,0,0.03)'},ticks:{color:'#6A5646',font:{size:9}},min:20,max:100}}}
  });

  // Jump bar
  context.api.kc('p-jump-bar');
  const posAthletes=context.api.rosterAthletes().filter(x=>x.pos===a.pos);
  context.api.CH['p-jump-bar']=new Chart(document.getElementById('p-jump-bar'),{
    type:'bar',data:{labels:['Broad Jump','Vertical Jump','Goal to Blue'],
    datasets:[
      {label:a.name,data:[a._approachJumpFresh,a.cmjHeight,a.standVert],backgroundColor:'rgba(254,80,0,0.7)',borderRadius:4},
      {label:'Pos Avg',data:['approachJump','cmjHeight','standVert'].map(k=>{const have=posAthletes.filter(x=>x[k]!=null);return have.length?parseFloat((have.reduce((s,x)=>s+x[k],0)/have.length).toFixed(1)):null;}),backgroundColor:'rgba(255,255,255,0.1)',borderRadius:4},
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#BCA898',font:{size:10,family:'Share Tech Mono'}}},y:{grid:{color:'rgba(254,80,0,0.04)'},ticks:{color:'#6A5646',font:{size:9}},min:0}}}
  });

  // FP Details
  document.getElementById('p-fp-grid').innerHTML=[
    ['Peak Power',a.peakPower?Math.round(a.peakPower):'—','W','#60A5FA'],
    ['RSI-Modified',a.rsi!=null?a.rsi.toFixed(3):'—','','#4ADE80'],
    ['Conc Imp Asym',a.concImpulseAsym!=null?a.concImpulseAsym.toFixed(1):'—','%',a.concImpulseAsym&&Math.abs(a.concImpulseAsym)>10?'var(--red)':'var(--text2)'],
    ['Ecc. RFD',a.eccRFD!=null?Math.round(a.eccRFD):'—','N/s','#CDA077'],
    ['Conc. Impulse',a.concImpulse!=null?Math.round(a.concImpulse):'—','N·s','#38BDF8'],
    ['Ecc. Impulse',a.eccImpulse!=null?Math.round(a.eccImpulse):'—','N·s','#A78BFA'],
    ['Contraction Time',a.contractionTime!=null?Math.round(a.contractionTime):'—','ms','#94A3B8'],
  ].map(([l,v,u,c])=>`<div class="card-sm"><div style="font-size:9px;color:var(--text3);font-family:var(--fm);margin-bottom:5px;">${l}</div><div style="font-family:var(--fh);font-size:20px;font-weight:800;color:${c};">${v}<span style="font-size:11px;font-weight:400;font-family:var(--fm);color:var(--text3);margin-left:3px;">${u}</span></div></div>`).join('');

  // All metrics with source attribution
  document.getElementById('p-metrics').innerHTML=context.api.ALL_METRICS.filter(m=>m.key!=='composite'&&m.key!=='acwr').map(m=>{
    const val=a[m.key];
    const has=val!=null&&!isNaN(val);
    const pct=has?Math.min(100,Math.round(m.hb?val/m.max*100:(1-val/m.max)*100)):0;
    const tp=has?context.api.pctile(context.api.ATHLETES,val,m.key,m.hb):null;
    const src=context.api.sourceForKey(a,m.key);
    const srcBadge=src?`<span style="font-size:8px;color:var(--text3);font-family:var(--fm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:block;margin-top:2px;" title="${src.file}">${src.file.replace(/\.csv$/i,'')}</span>`:'';
    return`<div class="card-sm"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;"><span style="font-size:9px;color:var(--text3);font-family:var(--fm);">${m.label}</span><span style="font-family:var(--fm);font-size:11px;color:${m.color};font-weight:500;">${has?m.fmt(val)+' '+m.unit:'—'}</span></div><div class="bw" style="margin-bottom:4px;"><div class="bf" style="width:${pct}%;background:${m.color};"></div></div><div style="font-size:9px;color:var(--text3);">Top <span style="color:var(--text2);">${tp!=null?tp+'%':'—'}</span></div>${srcBadge}</div>`;
  }).join('');

  // Data sources panel
  const sourcesCard=document.getElementById('p-sources-card');
  const sourcesEl=document.getElementById('p-sources');
  if(a._sources&&a._sources.length){
    sourcesCard.style.display='block';
    sourcesEl.innerHTML=`
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${a._sources.map((s,si)=>`
          <div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:12px 14px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <div style="background:var(--orange-dim);border:1px solid var(--border2);border-radius:4px;padding:3px 10px;font-family:var(--fh);font-size:13px;font-weight:700;color:var(--orange);">${s.file}</div>
              <div style="font-size:10px;color:var(--text3);font-family:var(--fm);">imported ${s.date}</div>
              <div style="margin-left:auto;font-size:10px;color:var(--text3);font-family:var(--fm);">${s.keys.length} field${s.keys.length!==1?'s':''}</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;">
              ${s.keys.map(k=>{const m=context.api.ALL_METRICS.find(x=>x.key===k);return m?`<span style="background:var(--bg4);border:1px solid var(--border);border-radius:3px;padding:2px 8px;font-size:9px;font-family:var(--fm);color:${m.color};">${m.label}</span>`:''}).join('')}
            </div>
          </div>`).join('')}
      </div>`;
  } else {
    sourcesCard.style.display='none';
  }
}

return Object.defineProperties({}, {
  renderProfileRadar: {enumerable:true, configurable:true, get:()=>renderProfileRadar},
  initProfile: {enumerable:true, configurable:true, get:()=>initProfile},
  renderProfile: {enumerable:true, configurable:true, get:()=>renderProfile}
});
}
