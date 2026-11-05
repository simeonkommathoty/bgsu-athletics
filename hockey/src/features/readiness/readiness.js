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
// {id, athlete_id, athlete_name, test_date, jump_height, ...}
// Reference: originals/hockey.html:6057
let readinessSelectedDate = null;


// Reference: originals/hockey.html:6058
let _lastReadinessRender = null;

// Fill the date dropdown with every date that has force plate data, newest first,
// labelled with how many athletes tested. Keeps the current selection if it's still valid.
// Reference: originals/hockey.html:6275
function populateReadinessDates(){
  const sel=document.getElementById('readiness-date');
  if(!sel) return [];
  const byDate={};
  context.api.SESSIONS.filter(context.api.isValdSession).forEach(s=>{
    (byDate[s.test_date]=byDate[s.test_date]||new Set()).add(context.api.nameKey(s.athlete_name));
  });
  const dates=Object.keys(byDate).sort().reverse();
  const fmtD=d=>{const [y,m,dd]=d.split('-').map(Number);return new Date(y,m-1,dd).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});};
  sel.innerHTML=dates.length
    ? dates.map(d=>`<option value="${d}">${fmtD(d)} · ${byDate[d].size} tested</option>`).join('')
    : '<option value="">No force plate data yet</option>';
  return dates;
}


// Reference: originals/hockey.html:6290
function initReadiness(){
  const dates=populateReadinessDates();
  // Default = most recent date that actually has force plate data
  if(!readinessSelectedDate||!dates.includes(readinessSelectedDate)){
    readinessSelectedDate=dates[0]||'';
  }
  document.getElementById('readiness-date').value=readinessSelectedDate;
  // Let the page switch paint first, then do the heavy render
  const tb=document.getElementById('readiness-tbody');
  if(tb&&!tb.innerHTML) tb.innerHTML='<tr><td style="padding:24px;color:var(--text3);font-family:var(--fm);font-size:11px;">Loading readiness…</td></tr>';
  setTimeout(renderReadiness,30);
}


// Reference: originals/hockey.html:6303
function renderReadiness(){
  readinessSelectedDate=document.getElementById('readiness-date').value;
  const date=readinessSelectedDate;
  // With no sessions there is no date to select; new Date('') is invalid and toISOString() would throw.
  const base=new Date(date);
  const date30d=isNaN(base)?'':new Date(base.getTime()-30*24*60*60*1000).toISOString().slice(0,10);

  // This table is specifically VALD ForceDecks CMJ data — jump_height/peak_power/
  // rsi_mod/takeoff velocity/conc_impulse/asymmetry are all VALD-specific fields.
  // Other import types (Firstbeat, Broad Jump Testing) write to the same shared
  // test_sessions table but populate none of these — only include a row here if
  // it actually has at least one genuine VALD field set.
  const isValdRow=s=>s.peak_power!=null||s.rsi_mod!=null||s.takeoff_velocity!=null||s.conc_impulse!=null;

  // Resolve raw athlete_name strings on sessions to canonical roster names,
  // but ONLY on an exact (whitespace/case-normalized) match — never a fuzzy
  // one. This table auto-groups rows with zero human review, unlike the CSV
  // import preview where a coach can catch and reject a bad match before it's
  // saved. A fuzzy match here previously merged "Makiaya Turner" into an
  // entirely different real athlete, "Jacob Turner," just because they share
  // a last name — silently misattributing one person's force-plate data to
  // someone else. Exact-only means near-duplicate typos (e.g. "Marin Dunway"
  // vs "Marin Dunaway") won't auto-consolidate here, but that's a cosmetic
  // gap, not a correctness risk — use the Roster page's Merge tool to fix
  // those specific duplicates at the source instead.
  // Known spelling aliases (NICKNAME_ALIASES, e.g. "Synthetic Skater" -> "Synthetic Skater",
  // "Synthetic Skater" -> "Synthetic Skater") are explicit, coach-approved mappings, so they
  // are applied here too -- that's still exact matching, just through the alias table.
  const nameCache=new Map();
  const resolveName=(raw)=>{
    if(nameCache.has(raw)) return nameCache.get(raw);
    const key=context.api.nameKey(raw);
    const exact=context.api.ATHLETES.find(a=>context.api.athleteKey(a)===key);
    const resolved=exact?(exact._canonicalName||exact.name):raw;
    nameCache.set(raw,resolved);
    return resolved;
  };

  // The same test can exist twice when an export was imported under two spellings
  // of one name. Once names resolve to the same athlete, keep one row per
  // athlete per date (prefer the row linked to an athlete id) so duplicates don't
  // double-count in averages / standard deviations.
  const dedupeByAthleteDate=rows=>{
    const keep=new Map();
    rows.forEach(s=>{
      const k=resolveName(s.athlete_name)+'|'+s.test_date;
      const cur=keep.get(k);
      if(!cur||(cur.athlete_id==null&&s.athlete_id!=null)) keep.set(k,s);
    });
    return [...keep.values()];
  };

  // Sessions today and in the 30-day window
  const todaySessions=dedupeByAthleteDate(context.api.SESSIONS.filter(s=>s.test_date===date&&isValdRow(s)));
  const windowSessions=dedupeByAthleteDate(context.api.SESSIONS.filter(s=>s.test_date<=date && s.test_date>date30d&&isValdRow(s)));

  // Empty state
  if(!todaySessions.length&&!context.api.SESSIONS.filter(isValdRow).length){
    document.getElementById('readiness-empty').style.display='block';
    document.getElementById('readiness-thead').innerHTML='';
    document.getElementById('readiness-tbody').innerHTML='';
    document.getElementById('readiness-team-strip').innerHTML='';
    document.getElementById('team-readiness-score').innerHTML='';
    const pb=document.getElementById('readiness-pr-banner'); if(pb) pb.innerHTML='';
    return;
  }
  document.getElementById('readiness-empty').style.display='none';

  // ─── TEAM READINESS SCORE (selected date) ───
  renderTeamReadinessScore(todaySessions, windowSessions, date, resolveName);
  const prs=context.api.computeReadinessPRs(todaySessions, date, resolveName);
  _lastReadinessRender={todaySessions, windowSessions, date, resolveName, prs};
  renderPRBanner(prs, date);

  // ─── TEAM STRIP (30-day rolling) ───
  renderTeamStrip(windowSessions, date);

  // ─── INDIVIDUAL MACRO VIEW ───
  // Get unique (resolved) athletes who have ANY data in window
  const athletesWithData = new Set();
  windowSessions.forEach(s=>athletesWithData.add(resolveName(s.athlete_name)));

  // Build table header
  let head=`<tr style="background:var(--orange);color:#fff;">
    <th style="text-align:left;padding:7px 10px;font-family:var(--fh);font-size:11px;font-weight:700;border:1px solid var(--brown);white-space:nowrap;min-width:130px;position:sticky;left:0;background:var(--orange);z-index:3;">Athlete</th>`;
  for(const m of context.api.READINESS_METRICS){
    head+=`<th colspan="${m.flag?4:3}" style="text-align:center;padding:5px 4px;font-family:var(--fh);font-size:10px;font-weight:700;border:1px solid var(--brown);white-space:nowrap;">${m.label}</th>`;
  }
  head+=`</tr><tr style="background:var(--bg3);">
    <th style="border:1px solid var(--border);padding:4px 10px;position:sticky;left:0;background:var(--bg3);z-index:2;"></th>`;
  for(const m of context.api.READINESS_METRICS){
    head+=`<th style="padding:4px 5px;font-size:9px;color:var(--text3);font-style:italic;text-align:center;border:1px solid var(--border);white-space:nowrap;min-width:44px;">Today</th>`;
    head+=`<th style="padding:4px 5px;font-size:9px;color:var(--text3);font-style:italic;text-align:center;border:1px solid var(--border);white-space:nowrap;min-width:44px;">Avg</th>`;
    head+=`<th style="padding:4px 5px;font-size:9px;color:var(--text3);font-style:italic;text-align:center;border:1px solid var(--border);white-space:nowrap;min-width:52px;">Dev</th>`;
    if(m.flag) head+=`<th style="padding:4px 5px;font-size:9px;color:var(--text3);font-style:italic;text-align:center;border:1px solid var(--border);min-width:30px;">⚑</th>`;
  }
  head+=`</tr>`;
  document.getElementById('readiness-thead').innerHTML=head;

  // Build rows — sorted alphabetically by athlete name
  const sortedNames=[...athletesWithData].sort();
  let rows='';
  sortedNames.forEach((name,rowIdx)=>{
    const todaySess=todaySessions.find(s=>resolveName(s.athlete_name)===name);
    const athleteSessions=windowSessions.filter(s=>resolveName(s.athlete_name)===name);
    // Zebra striping so it's easier to track a single row across this many columns.
    // The athlete-name cell is pinned (sticky) so it stays visible on horizontal
    // scroll — it needs its own solid, matching background or it'll go see-
    // through and show whatever scrolled underneath it.
    const rowBg=rowIdx%2===0?'var(--bg2)':'var(--bg)';
    rows+=`<tr style="background:${rowBg};">
      <td style="padding:8px 10px;font-weight:600;font-family:var(--fb);font-size:12px;color:var(--text);border:1px solid var(--border);position:sticky;left:0;background:${rowBg};z-index:1;white-space:nowrap;">${name}</td>`;
    for(const m of context.api.READINESS_METRICS){
      const todayRaw=todaySess?todaySess[m.key]:null;
      const todayIsOutlier=todayRaw!==null&&context.api.isOutlier(m.key,todayRaw,name,date);
      const today=todayIsOutlier?null:todayRaw;
      // Exclude outliers from rolling avg + stddev
      const vals=athleteSessions
        .map(s=>s[m.key])
        .filter(v=>v!==null&&v!==undefined&&!context.api.isOutlier(m.key,v,name,date));
      const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
      // Sample standard deviation of this athlete's own 30-day values. Needs at
      // least 2 points to be meaningful; with exactly 1 point stddev is 0 by
      // definition, which would make a z-score divide-by-zero — treat that the
      // same as "not enough data" rather than showing a false ±Infinity.
      let stdDev=null;
      if(vals.length>=2){
        const variance=vals.reduce((s,v)=>s+Math.pow(v-avg,2),0)/(vals.length-1);
        stdDev=Math.sqrt(variance);
      }
      const deviation=(today!==null&&avg!==null&&stdDev!=null&&stdDev>0)?((today-avg)/stdDev):null;
      // Only tint when a deviation is actually meaningful (|z| >= 1) — coloring
      // every single cell regardless of magnitude (the old behavior) meant
      // nearly everything was tinted and nothing actually stood out.
      const notable=deviation!==null&&Math.abs(deviation)>=context.api.READINESS_Z;
      let devColor='var(--text2)', bgToday='', bgAvg='', bgDev='';
      if(m.flag){
        if(today!==null&&Math.abs(today)>context.api.ASYM_FLAG_THRESHOLD) bgToday='background:rgba(248,113,113,0.15);';
        if(avg!==null&&Math.abs(avg)>context.api.ASYM_FLAG_THRESHOLD) bgAvg='background:rgba(248,113,113,0.15);';
      } else if(m.hb&&deviation!==null){
        if(notable&&deviation>0){bgDev='background:rgba(74,222,128,0.22);';devColor='var(--green)';}
        else if(notable&&deviation<0){bgDev='background:rgba(252,211,77,0.22);';devColor='var(--yellow)';}
        else devColor='var(--text3)'; // small/insignificant deviation — keep it quiet, not colored
      }
      const prInfo=(prs[name]||{})[m.key];
      const todayStr=today!==null?(m.fmt(today)+(prInfo?' 🏆':'')):(todayIsOutlier?'—*':'—');
      if(prInfo) bgToday='background:rgba(250,204,21,0.22);';
      const todayTitle=prInfo?` title="New PR! Previous best ${m.fmt(prInfo.prev)} ${m.unit||''}"`:todayIsOutlier?` title="Outlier filtered: raw value ${m.fmt(todayRaw)} ${m.unit||''}"`:'';
      const avgStr=avg!==null?m.fmt(avg):'—';
      const devStr=deviation!==null?(deviation>=0?'+':'')+deviation.toFixed(2)+'σ':'—';
      const devTitle=deviation!==null?` title="${today>=avg?'+':''}${m.fmt(today-avg)} ${m.unit||''} vs 30-day avg, ${stdDev.toFixed(2)} SD"`:'';
      rows+=`<td${todayTitle} style="text-align:center;padding:6px 5px;font-family:var(--fm);font-size:11px;font-weight:600;color:var(--text);border:1px solid var(--border);${bgToday}">${todayStr}</td>`;
      rows+=`<td style="text-align:center;padding:6px 5px;font-family:var(--fm);font-size:10px;color:var(--text3);font-style:italic;border:1px solid var(--border);${bgAvg}">${avgStr}</td>`;
      rows+=`<td${devTitle} style="text-align:center;padding:6px 5px;font-family:var(--fm);font-size:10px;color:${devColor};font-weight:${notable?700:400};border:1px solid var(--border);${bgDev}">${devStr}</td>`;
      if(m.flag){
        const flag=today!==null&&Math.abs(today)>context.api.ASYM_FLAG_THRESHOLD;
        rows+=`<td style="text-align:center;padding:6px 5px;border:1px solid var(--border);background:${flag?'rgba(248,113,113,0.2)':''};">${flag?'<span style="color:var(--red);font-size:14px;">⚠</span>':''}</td>`;
      }
    }
    rows+=`</tr>`;
  });
  document.getElementById('readiness-tbody').innerHTML=rows;
}


// Reference: originals/hockey.html:6560
function renderTeamReadinessScore(todaySessions, windowSessions, date, resolveName){
  const el=document.getElementById('team-readiness-score');
  if(!el) return;
  const r=context.api.computeTeamReadiness(todaySessions, windowSessions, date, resolveName);
  if(r.score==null){
    el.innerHTML=`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r3);padding:16px 20px;color:var(--text3);font-family:var(--fm);font-size:12px;text-align:center;">No force plate sessions on this date — pick a date from the dropdown above.</div>`;
    return;
  }
  const list=r.flaggedAthletes.length
    ? `<div style="margin-top:10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:4px 18px;">${r.flaggedAthletes.map(f=>`
        <div style="font-size:11px;font-family:var(--fm);color:var(--text2);line-height:1.45;overflow-wrap:anywhere;">
          <span style="color:${f.flags.length>=2?'var(--red)':'var(--yellow)'};font-weight:700;">⚠</span>
          <span style="font-weight:600;color:var(--text);">${f.name}</span> — ${f.flags.map(x=>`${x.label} ${x.z.toFixed(1)}σ`).join(', ')}
        </div>`).join('')}</div>`
    : `<div style="margin-top:10px;font-size:11px;font-family:var(--fm);color:var(--text3);">No athletes flagged on this date.</div>`;
  el.innerHTML=`
    <div style="background:var(--bg2);border:1px solid var(--border);border-left:4px solid ${r.color};border-radius:var(--r3);padding:16px 22px;display:flex;align-items:flex-start;gap:24px;flex-wrap:wrap;">
      <div style="text-align:center;min-width:110px;">
        <div style="font-family:var(--fh);font-size:48px;font-weight:900;color:${r.color};letter-spacing:-1px;line-height:1;">${r.score}</div>
        <div style="font-size:9px;color:var(--text3);font-family:var(--fm);letter-spacing:1px;margin-top:4px;">TEAM READINESS</div>
      </div>
      <div style="border-left:1px solid var(--border);padding-left:20px;flex:1;min-width:240px;">
        <div style="font-family:var(--fh);font-size:15px;font-weight:800;color:${r.color};letter-spacing:0.5px;">${r.label}</div>
        <div style="font-size:10px;color:var(--text3);font-family:var(--fm);margin-top:3px;">${r.testedCount} athlete${r.testedCount!==1?'s':''} tested · ${r.multiCount||0} down on 2+ metrics · ${r.watchCount||0} single-metric watch (&gt;1.5 SD below own 30-day avg) · 85+ good to go · 65–84 monitor · &lt;65 back off</div>
        ${context.api.readinessTrendLine(r,'screen')}
        ${list}
      </div>
    </div>`;
}


// Reference: originals/hockey.html:6688
function renderPRBanner(prs, date){
  const el=document.getElementById('readiness-pr-banner');
  if(!el) return;
  const names=Object.keys(prs).sort();
  if(!names.length){el.innerHTML='';return;}
  const label={jump_height:'Jump Height'};
  const fm=context.api.READINESS_METRICS.reduce((o,m)=>(o[m.key]=m.fmt,o),{});
  el.innerHTML=`<div style="background:var(--bg2);border:1px solid var(--border);border-left:4px solid #facc15;border-radius:var(--r3);padding:14px 22px;">
    <div style="font-family:var(--fh);font-size:14px;font-weight:800;color:#facc15;letter-spacing:0.5px;">🏆 NEW JUMP HEIGHT PRs · ${names.length} athlete${names.length!==1?'s':''}</div>
    <div style="margin-top:8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:4px 18px;">${names.map(n=>`
      <div style="font-size:11px;font-family:var(--fm);color:var(--text2);line-height:1.45;"><span style="font-weight:600;color:var(--text);">${n}</span> — ${Object.keys(prs[n]).map(k=>`${label[k]} ${fm[k](prs[n][k].value)}" <span style="color:var(--text3);">(prev ${fm[k](prs[n][k].prev)}")</span>`).join(', ')}</div>`).join('')}</div>
  </div>`;
}


// Reference: originals/hockey.html:6702
function renderTeamStrip(windowSessions, date){
  const stripEl=document.getElementById('readiness-team-strip');
  const todaySess=windowSessions.filter(s=>s.test_date===date);
  let html='';
  for(const m of context.api.TEAM_STRIP_METRICS){
    // Filter out outliers from team aggregates
    const todayVals=todaySess
      .map(s=>({v:s[m.key],name:s.athlete_name}))
      .filter(o=>o.v!==null&&o.v!==undefined&&!context.api.isOutlier(m.key,o.v,o.name,date))
      .map(o=>o.v);
    const today=todayVals.length?todayVals.reduce((a,b)=>a+b,0)/todayVals.length:null;
    const winVals=windowSessions
      .map(s=>({v:s[m.key],name:s.athlete_name}))
      .filter(o=>o.v!==null&&o.v!==undefined&&!context.api.isOutlier(m.key,o.v,o.name,date))
      .map(o=>o.v);
    const avg=winVals.length?winVals.reduce((a,b)=>a+b,0)/winVals.length:null;
    const pctChange=(today!==null&&avg!==null&&avg!==0)?((today-avg)/Math.abs(avg)*100):null;
    const changeColor=pctChange===null?'var(--text3)':pctChange>=0?'var(--green)':'var(--red)';

    // Sparkline (also outlier-filtered)
    const dailyByDate={};
    windowSessions.forEach(s=>{
      if(s[m.key]===null||s[m.key]===undefined) return;
      if(context.api.isOutlier(m.key,s[m.key],s.athlete_name,date)) return;
      if(!dailyByDate[s.test_date]) dailyByDate[s.test_date]={sum:0,n:0};
      dailyByDate[s.test_date].sum+=s[m.key];
      dailyByDate[s.test_date].n++;
    });
    const sparkDates=Object.keys(dailyByDate).sort();
    const sparkVals=sparkDates.map(d=>dailyByDate[d].sum/dailyByDate[d].n);
    const sMax=Math.max(...sparkVals,1), sMin=Math.min(...sparkVals,0);
    const sparkPoints=sparkVals.map((v,i)=>{
      const x=sparkDates.length===1?50:(i/(sparkDates.length-1))*100;
      const y=sMax===sMin?50:(1-(v-sMin)/(sMax-sMin))*100;
      return`${x},${y}`;
    }).join(' ');

    html+=`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);overflow:hidden;">
      <div style="background:var(--orange);color:#fff;padding:7px 12px;font-family:var(--fh);font-size:12px;font-weight:700;text-align:center;letter-spacing:0.5px;">${m.label}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;text-align:center;font-family:var(--fm);font-size:10px;border-bottom:1px solid var(--border);">
        <div style="padding:4px;color:var(--text3);font-style:italic;border-right:1px solid var(--border);">Today</div>
        <div style="padding:4px;color:var(--text3);font-style:italic;border-right:1px solid var(--border);">Avg</div>
        <div style="padding:4px;color:var(--text3);font-style:italic;">Change</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;text-align:center;font-family:var(--fm);font-size:13px;color:var(--text);padding:8px 0;">
        <div style="border-right:1px solid var(--border);">${today!==null?m.fmt(today):'—'}</div>
        <div style="border-right:1px solid var(--border);">${avg!==null?m.fmt(avg):'—'}</div>
        <div style="color:${changeColor};font-weight:500;">${pctChange!==null?(pctChange>=0?'+':'')+pctChange.toFixed(2)+'%':'—'}</div>
      </div>
      <div style="text-align:center;font-size:9px;color:var(--text3);font-family:var(--fm);font-style:italic;padding-top:4px;">30 Day</div>
      <div style="padding:0 10px 8px 10px;height:30px;">
        ${sparkVals.length>1?`<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%;"><polyline points="${sparkPoints}" stroke="var(--orange)" stroke-width="2" fill="none" vector-effect="non-scaling-stroke"/></svg>`:'<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text3);font-family:var(--fm);font-size:9px;">need more data</div>'}
      </div>
    </div>`;
  }
  stripEl.innerHTML=html;
}

return Object.defineProperties({}, {
  readinessSelectedDate: {enumerable:true, configurable:true, get:()=>readinessSelectedDate, set:value=>{readinessSelectedDate=value;}},
  _lastReadinessRender: {enumerable:true, configurable:true, get:()=>_lastReadinessRender, set:value=>{_lastReadinessRender=value;}},
  populateReadinessDates: {enumerable:true, configurable:true, get:()=>populateReadinessDates},
  initReadiness: {enumerable:true, configurable:true, get:()=>initReadiness},
  renderReadiness: {enumerable:true, configurable:true, get:()=>renderReadiness},
  renderTeamReadinessScore: {enumerable:true, configurable:true, get:()=>renderTeamReadinessScore},
  renderPRBanner: {enumerable:true, configurable:true, get:()=>renderPRBanner},
  renderTeamStrip: {enumerable:true, configurable:true, get:()=>renderTeamStrip}
});
}
