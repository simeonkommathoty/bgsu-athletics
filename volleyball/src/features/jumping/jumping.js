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
/* ─── JUMP TESTING ─── */
// Reference: originals/volleyball.html:2102
function initJumping(){
  const sorted_appr=context.api.rosterAthletes().filter(a=>a._approachJumpFresh>0).sort((a,b)=>b._approachJumpFresh-a._approachJumpFresh);
  const sorted_cmj=context.api.rosterAthletes().filter(a=>a.cmjHeight>0).sort((a,b)=>b.cmjHeight-a.cmjHeight);
  const sorted_vert=context.api.rosterAthletes().filter(a=>a.standVert>0).sort((a,b)=>b.standVert-a.standVert);
  const medals=['🥇','🥈','🥉'];
  const mkRow=(a,i,k,fmt)=>`<tr class="r${i+1}" data-onclick="openAth(${a.id})" style="cursor:pointer;"><td class="rn">${i<3?medals[i]:i+1}</td><td><div style="display:flex;align-items:center;gap:7px;">${context.api.ava(a)}<span>${a.name}</span></div></td><td>${context.api.posPill(a.pos)}</td><td style="font-family:var(--fm);color:var(--orange);">${fmt(a[k])}"</td><td>${context.api.tierBadge(a.tier)}</td></tr>`;
  // Approach jump shows feet'inches" format (touch height) — only athletes with a fresh (within 6mo) PR make this board
  const mkApprRow=(a,i)=>`<tr class="r${i+1}" data-onclick="openAth(${a.id})" style="cursor:pointer;"><td class="rn">${i<3?medals[i]:i+1}</td><td><div style="display:flex;align-items:center;gap:7px;">${context.api.ava(a)}<span>${a.name}</span></div></td><td>${context.api.posPill(a.pos)}</td><td style="font-family:var(--fm);color:var(--orange);">${a._approachFeetDisplay||context.api.inchesToFeet(a._approachJumpFresh)}</td><td>${context.api.tierBadge(a.tier)}</td></tr>`;
  document.getElementById('appr-lb').innerHTML=sorted_appr.length
    ? sorted_appr.slice(0,10).map((a,i)=>mkApprRow(a,i)).join('')
    : `<tr><td colspan="5" style="text-align:center;padding:18px;color:var(--text3);font-family:var(--fm);font-size:11px;">No approach jump tests within the last ${context.api.APPROACH_JUMP_FRESHNESS_MONTHS} months.</td></tr>`;
  document.getElementById('cmj-lb').innerHTML=sorted_cmj.slice(0,10).map((a,i)=>mkRow(a,i,'cmjHeight',v=>v.toFixed(1))).join('');
  document.getElementById('vert-lb').innerHTML=sorted_vert.slice(0,10).map((a,i)=>mkRow(a,i,'standVert',v=>v.toFixed(1))).join('');

  // Scatter
  context.api.kc('jump-scatter');
  context.api.CH['jump-scatter']=new Chart(document.getElementById('jump-scatter'),{
    type:'scatter',
    data:{datasets:[{label:'Athletes',data:context.api.rosterAthletes().map(a=>({x:a.cmjHeight,y:a._approachJumpFresh,label:a._canonicalName||a.name})),backgroundColor:context.api.rosterAthletes().map(a=>{const cs={OH:'#FE5000',MB:'#60A5FA',S:'#4ADE80',RS:'#FCD34D',OPP:'#C084FC',Lib:'#CDA077',DS:'#94A3B8'};return(cs[a.pos]||'#FE5000')+'CC';}),pointRadius:6,pointHoverRadius:8}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.raw.label}: App ${c.parsed.y!=null?c.parsed.y.toFixed(1)+'"':'—'} | CMJ ${c.parsed.x.toFixed(1)}"`}}},scales:{
      x:{title:{display:true,text:'CMJ Height (in)',color:'#6A5646',font:{size:10,family:'Share Tech Mono'}},grid:{color:'rgba(254,80,0,0.04)'},ticks:{color:'#6A5646',font:{size:9}}},
      y:{title:{display:true,text:'Approach Jump (in)',color:'#6A5646',font:{size:10,family:'Share Tech Mono'}},grid:{color:'rgba(254,80,0,0.04)'},ticks:{color:'#6A5646',font:{size:9}}}
    }}
  });

  // Sprint bar
  context.api.kc('sprint-bar');
  const sprintSorted=context.api.rosterAthletes().sort((a,b)=>a.sprint10-b.sprint10);
  context.api.CH['sprint-bar']=new Chart(document.getElementById('sprint-bar'),{
    type:'bar',data:{labels:sprintSorted.map(a=>a.name.split(' ')[0]),datasets:[{label:'10-yd (s)',data:sprintSorted.map(a=>a.sprint10),backgroundColor:sprintSorted.map(a=>a.sprint10<1.68?'rgba(74,222,128,0.7)':a.sprint10<1.78?'rgba(254,80,0,0.7)':'rgba(248,113,113,0.6)'),borderRadius:3,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{min:1.5,max:2.0,grid:{color:'rgba(254,80,0,0.04)'},ticks:{color:'#6A5646',font:{size:9,family:'Share Tech Mono'}}},y:{grid:{display:false},ticks:{color:'#BCA898',font:{size:10,family:'Share Tech Mono'}}}}}
  });

  // Position jump radar
  context.api.kc('pos-jump-radar');
  const posAvg=(pos,k)=>{const g=context.api.rosterAthletes().filter(a=>a.pos===pos);return parseFloat((g.reduce((s,a)=>s+a[k],0)/Math.max(1,g.length)).toFixed(1));};
  const posColors={OH:'#FE5000',MB:'#60A5FA',S:'#4ADE80',RS:'#FCD34D',OPP:'#C084FC',Lib:'#CDA077',DS:'#94A3B8'};
  context.api.CH['pos-jump-radar']=new Chart(document.getElementById('pos-jump-radar'),{
    type:'bar',
    data:{labels:context.api.POSITIONS,datasets:[
      {label:'Approach Jump',data:context.api.POSITIONS.map(p=>posAvg(p,'_approachJumpFresh')),backgroundColor:'rgba(254,80,0,0.7)',borderRadius:3,borderSkipped:false},
      {label:'CMJ Height',data:context.api.POSITIONS.map(p=>posAvg(p,'cmjHeight')),backgroundColor:'rgba(252,211,77,0.65)',borderRadius:3,borderSkipped:false},
      {label:'Standing Vert',data:context.api.POSITIONS.map(p=>posAvg(p,'standVert')),backgroundColor:'rgba(96,165,250,0.6)',borderRadius:3,borderSkipped:false},
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#BCA898',font:{size:10,family:'Share Tech Mono'}}},y:{grid:{color:'rgba(254,80,0,0.04)'},ticks:{color:'#6A5646',font:{size:9}}}}}
  });
}

return Object.defineProperties({}, {
  initJumping: {enumerable:true, configurable:true, get:()=>initJumping}
});
}
