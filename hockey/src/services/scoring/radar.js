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
// ── Hockey Performance Radar ─────────────────────────────────
// 6-pillar framework: Explosiveness, Reactive Power, Peak Power,
// Strength Base, Rate of Force Dev, Symmetry
// Each spoke normalized 0-100 vs position norms (or team-level max when no norm)
// Reference: originals/hockey.html:1951
const VB_RADAR = [
  {
    key:   'explosiveness',
    label: 'Vert Jump',
    desc:  'Vertical Jump',
    score: (a) => radarNorm(a, 'cmjHeight', true),
  },
  {
    key:   'approach',
    label: 'Broad Jump',
    desc:  'Broad Jump',
    score: (a) => radarNorm(a, 'approachJump', true),
  },
  {
    key:   'peakpower',
    label: 'Peak Power',
    desc:  'Watts (VALD)',
    score: (a) => radarNorm(a, 'peakPower', true),
  },
  {
    key:   'strength',
    label: 'Strength Base',
    desc:  'Front Squat + NG Chin Up (avg)',
    score: (a) => {
      const pos=a.pos||'F';
      const n=context.api.NORMS[pos]||context.api.NORMS['F'];
      const normLift=(v,key)=>{
        if(!v||isNaN(v)||!n[key]) return null;
        const [lo,hi]=n[key];
        return hi===lo?0.5:Math.max(0,Math.min(1,(v-lo)/(hi-lo)));
      };
      const lifts=[
        normLift(a.frontSquatMax,'frontSquatMax'),
        normLift(a.ngChinUp,'ngChinUp'),
      ].filter(v=>v!==null);
      if(!lifts.length) return null;
      return parseFloat((lifts.reduce((s,v)=>s+v,0)/lifts.length*100).toFixed(1));
    },
  },
  {
    key:   'reactive',
    label: 'Reactive Power',
    desc:  'RSI-Modified',
    score: (a) => radarNorm(a, 'rsi', true),
  },
  {
    key:   'speed',
    label: '10-yd Speed',
    desc:  '10-yd Sprint',
    score: (a) => radarNorm(a, 'sprint10', false),
  },
];

// Normalize a metric 0-100 using position-specific norms.
// 0 = bottom of norm range, 100 = top of norm range (or beyond).
// Falls back to ALL_METRICS max if no position norm exists.
// valueOverride lets a caller supply a value other than a[metricKey] directly
// (used for approachJump, where the radar should reflect the freshness-filtered value).
// Reference: originals/hockey.html:2009
function radarNorm(a, metricKey, hb, valueOverride){
  const v = valueOverride!==undefined ? valueOverride : a[metricKey];
  if(v===null||v===undefined||isNaN(v)||v===0) return null;
  const pos = a.pos||'F';
  const norm = context.api.NORMS[pos]?.[metricKey];
  if(norm){
    const [lo, hi] = norm;
    if(hi===lo) return 50;
    const score = hb ? (v - lo)/(hi - lo) : 1-(v - lo)/(hi - lo);
    return Math.max(0, Math.min(100, parseFloat((score*100).toFixed(1))));
  }
  // Fallback to ALL_METRICS max
  const m = context.api.getM(metricKey);
  if(!m) return null;
  const score = hb ? (v/m.max)*100 : (1-(v/m.max))*100;
  return Math.max(0, Math.min(100, parseFloat(score.toFixed(1))));
}

// Build radar data — returns only spokes that have real data
// Returns {labels, data} so charts can use the filtered set
// Reference: originals/hockey.html:2029
function athleteRadarDataFiltered(a){
  const labels=[], data=[];
  VB_RADAR.forEach(spoke=>{
    const s=spoke.score(a);
    if(s!==null){ labels.push(spoke.label); data.push(s); }
    else{ labels.push(spoke.label); data.push(0); } // keep spoke but at 0
  });
  return {labels, data};
}

// Build radar data for one athlete — 0 for missing metrics
// Reference: originals/hockey.html:2040
function athleteRadarData(a){
  return VB_RADAR.map(spoke=>{
    const s=spoke.score(a);
    return s!==null?s:0;
  });
}

// Build radar labels and data for a group, skipping spokes where fewer than 50% have data
// Reference: originals/hockey.html:2048
function groupRadarFiltered(athletes){
  const labels=[], data=[];
  const threshold=Math.max(1, Math.floor(athletes.length * 0.5));
  VB_RADAR.forEach(spoke=>{
    const vals=athletes.map(a=>spoke.score(a)).filter(v=>v!==null&&v>0);
    if(vals.length>=threshold){
      labels.push(spoke.label);
      data.push(parseFloat((vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(1)));
    }
  });
  return {labels, data};
}

// Build radar data for a list of athletes (team/position average) — keeps all spokes
// Reference: originals/hockey.html:2062
function groupRadarData(athletes){
  return VB_RADAR.map(spoke=>{
    const vals=athletes.map(a=>spoke.score(a)).filter(v=>v!==null&&v>0);
    return vals.length?parseFloat((vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(1)):0;
  });
}


// Reference: originals/hockey.html:2069
const RADAR_LABELS = VB_RADAR.map(s=>s.label);


// Reference: originals/hockey.html:2070
const VB_RADAR_LEGEND_HTML = `
  <div style="width:100%;padding:8px 4px 4px;border-top:1px solid var(--border);margin-top:4px;">
    <div style="font-size:9px;color:var(--text3);font-family:var(--fm);letter-spacing:0.5px;margin-bottom:6px;">RADAR METRICS</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px 12px;">
      ${VB_RADAR.map(s=>`
        <div style="display:flex;align-items:baseline;gap:5px;">
          <span style="font-size:9px;font-family:var(--fm);font-weight:600;color:var(--orange);white-space:nowrap;">${s.label}</span>
          <span style="font-size:9px;font-family:var(--fm);color:var(--text3);">${s.desc}</span>
        </div>`).join('')}
    </div>
  </div>`;


// Reference: originals/hockey.html:2081
const RADAR_OPTIONS = {
  responsive:true, maintainAspectRatio:false,
  plugins:{
    legend:{display:false},
    tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${ctx.raw}`}}
  },
  scales:{r:{
    min:0, max:100,
    ticks:{display:false, stepSize:20},
    grid:{color:'rgba(254,80,0,0.07)'},
    angleLines:{color:'rgba(254,80,0,0.07)'},
    pointLabels:{color:'#BCA898', font:{size:10, family:'Share Tech Mono'}}
  }}
};

return Object.defineProperties({}, {
  VB_RADAR: {enumerable:true, configurable:true, get:()=>VB_RADAR},
  radarNorm: {enumerable:true, configurable:true, get:()=>radarNorm},
  athleteRadarDataFiltered: {enumerable:true, configurable:true, get:()=>athleteRadarDataFiltered},
  athleteRadarData: {enumerable:true, configurable:true, get:()=>athleteRadarData},
  groupRadarFiltered: {enumerable:true, configurable:true, get:()=>groupRadarFiltered},
  groupRadarData: {enumerable:true, configurable:true, get:()=>groupRadarData},
  RADAR_LABELS: {enumerable:true, configurable:true, get:()=>RADAR_LABELS},
  VB_RADAR_LEGEND_HTML: {enumerable:true, configurable:true, get:()=>VB_RADAR_LEGEND_HTML},
  RADAR_OPTIONS: {enumerable:true, configurable:true, get:()=>RADAR_OPTIONS}
});
}
