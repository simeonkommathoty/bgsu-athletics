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
// Builds a clean, light-theme, 2-page report of the selected date and opens the
// print dialog (choose "Save as PDF"). Page 1: team score, flagged athletes, team
// averages. Page 2: every athlete's values vs their own 30-day baseline.
// Reference: originals/hockey.html:6593
function exportReadinessPdf(){
  const d=context.api._lastReadinessRender;
  if(!d||!d.todaySessions.length){context.api.toast('⚠ No force plate data on this date to export');return;}
  const {todaySessions, windowSessions, date, resolveName}=d;
  const prs=d.prs||context.api.computeReadinessPRs(todaySessions, date, resolveName);
  const r=context.api.computeTeamReadiness(todaySessions, windowSessions, date, resolveName);
  const bandColor={'GOOD TO GO':'#1f9d55','MONITOR CLOSELY':'#c98a00','BACK OFF TODAY':'#d64545'}[r.label]||'#555';
  const [y,mo,dd]=date.split('-').map(Number);
  const dateStr=new Date(y,mo-1,dd).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const perf=context.api.READINESS_METRICS.filter(m=>m.hb===true);
  const stats=(name,m)=>{
    const t=todaySessions.find(s=>resolveName(s.athlete_name)===name);
    const v=t?t[m.key]:null;
    const today=(v==null||context.api.isOutlier(m.key,v,name,date))?null:v;
    const vals=windowSessions.filter(s=>resolveName(s.athlete_name)===name).map(s=>s[m.key]).filter(x=>x!=null&&!context.api.isOutlier(m.key,x,name,date));
    const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
    let z=null;
    if(today!=null&&vals.length>=2){const sd=Math.sqrt(vals.reduce((a,x)=>a+(x-avg)**2,0)/(vals.length-1));if(sd>0)z=(today-avg)/sd;}
    return {today,avg,z};
  };
  // Team averages (same idea as the on-screen strip)
  const teamRows=perf.map(m=>{
    const tv=todaySessions.filter(s=>s[m.key]!=null&&!context.api.isOutlier(m.key,s[m.key],resolveName(s.athlete_name),date)).map(s=>s[m.key]);
    const wv=windowSessions.filter(s=>s[m.key]!=null&&!context.api.isOutlier(m.key,s[m.key],resolveName(s.athlete_name),date)).map(s=>s[m.key]);
    const t=tv.length?tv.reduce((a,b)=>a+b,0)/tv.length:null, a=wv.length?wv.reduce((x,y)=>x+y,0)/wv.length:null;
    const pct=(t!=null&&a)?(t-a)/Math.abs(a)*100:null;
    return `<tr><td class="l">${m.label}${m.unit?` (${m.unit})`:''}</td><td>${t!=null?m.fmt(t):'—'}</td><td>${a!=null?m.fmt(a):'—'}</td><td class="${pct!=null&&pct<=-3?'lo':pct!=null&&pct>=3?'hi':''}">${pct!=null?(pct>=0?'+':'')+pct.toFixed(1)+'%':'—'}</td></tr>`;
  }).join('');
  const flagged=r.flaggedAthletes.length
    ? `<table><tr><th class="l">Athlete</th><th>Metrics down</th><th class="l">Detail (vs own 30-day avg)</th></tr>${r.flaggedAthletes.map(f=>`<tr><td class="l"><b>${f.name}</b></td><td class="${f.flags.length>=2?'lo':''}">${f.flags.length}</td><td class="l">${f.flags.map(x=>`${x.label} ${x.z.toFixed(1)}σ`).join(', ')}</td></tr>`).join('')}</table>`
    : '<div class="rp-sub">No athletes flagged on this date.</div>';
  const names=[...new Set(todaySessions.map(s=>resolveName(s.athlete_name)))].sort((a,b)=>a.split(' ').slice(-1)[0].localeCompare(b.split(' ').slice(-1)[0]));
  const indiv=`<table><tr><th class="l">Athlete</th>${perf.map(m=>`<th colspan="2">${m.label}</th>`).join('')}</tr>
    <tr>${'<th></th>'}${perf.map(()=>'<th>Today</th><th>vs avg</th>').join('')}</tr>
    ${names.map(n=>`<tr><td class="l"><b>${n}</b></td>${perf.map(m=>{const st=stats(n,m);const cls=st.z!=null&&st.z<=-context.api.READINESS_Z?'lo':st.z!=null&&st.z>=context.api.READINESS_Z?'hi':'';return `<td class="${(prs[n]||{})[m.key]?'pr':''}">${st.today!=null?m.fmt(st.today)+((prs[n]||{})[m.key]?' ★':''):'—'}</td><td class="${cls}">${st.z!=null?(st.z>=0?'+':'')+st.z.toFixed(1)+'σ':'—'}</td>`;}).join('')}</tr>`).join('')}</table>`;
  const prLabel={jump_height:'Jump Height'};
  const prFmt=context.api.READINESS_METRICS.reduce((o,m)=>(o[m.key]=m.fmt,o),{});
  const prNames=Object.keys(prs).sort();
  const prHtml=prNames.length
    ? `<table><tr><th class="l">Athlete</th><th class="l">PR (previous best)</th></tr>${prNames.map(n=>`<tr><td class="l"><b>${n}</b></td><td class="l pr">${Object.keys(prs[n]).map(k=>`${prLabel[k]} ${prFmt[k](prs[n][k].value)}" (was ${prFmt[k](prs[n][k].prev)}")`).join(', ')}</td></tr>`).join('')}</table>`
    : '<div class="rp-sub">No new PRs on this date.</div>';
  const head=`<div class="rp-head"><div><div class="rp-title">BGSU HOCKEY · READINESS REPORT</div><div class="rp-sub">${dateStr}</div></div><div class="rp-sub">VALD ForceDecks CMJ · ${r.testedCount} tested</div></div>`;
  document.getElementById('readiness-print').innerHTML=`
    <div class="rp-page">${head}
      <div class="rp-score"><div class="rp-num" style="color:${bandColor}">${r.score}</div>
        <div><div class="rp-band" style="color:${bandColor}">${r.label}</div>
        <div class="rp-sub">${r.multiCount||0} of ${r.testedCount} athletes down on 2+ metrics · ${r.watchCount||0} single-metric watch (more than 1.5 SD below their own 30-day average)</div>
        ${context.api.readinessTrendLine(r,'print')}
        <div class="rp-sub">85+ good to go · 65–84 monitor closely · under 65 back off</div></div></div>
      <h3>New PRs</h3>${prHtml}
      <h3>Flagged athletes</h3>${flagged}
      <h3>Team averages — today vs 30-day</h3><table><tr><th class="l">Metric</th><th>Today</th><th>30-day avg</th><th>Change</th></tr>${teamRows}</table>
    </div>
    <div class="rp-page">${head}
      <h3>Individual readings vs own 30-day baseline</h3>${indiv}
      <div class="rp-note">σ = standard deviations from the athlete's own 30-day average. Orange = more than 1.5 SD below (flag); green = more than 1.5 SD above. Outlier readings are excluded. ★ = new jump height personal record (previous best = all-time ForceDecks history).</div>
    </div>`;
  document.body.classList.add('printing-readiness');
  const done=()=>{document.body.classList.remove('printing-readiness');window.removeEventListener('afterprint',done);};
  window.addEventListener('afterprint',done);
  setTimeout(()=>window.print(),50);
}

return Object.defineProperties({}, {
  exportReadinessPdf: {enumerable:true, configurable:true, get:()=>exportReadinessPdf}
});
}
