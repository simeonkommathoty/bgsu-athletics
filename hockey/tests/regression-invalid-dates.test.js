import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {services} from './support.js';
import {buildDemoTables} from '../src/services/demo/demo-data.js';
import {createDemoClient} from '../src/services/demo/demo-backend.js';
import {createModule as createReadiness} from '../src/features/readiness/readiness.js';

class StubChart{constructor(){}destroy(){}update(){}}
const BAD=[null,undefined,'','not-a-date','2026-13-45','2026-02-30','2025-02-29','2026-00-10','2026-04-00','0000-01-01','1999-12-31','2101-01-01',20260305,{},'03/05/2026','2026-3-5'];
const GOOD=['2026-03-05','2024-02-29','2000-01-01','2100-12-31','2026-03-05T10:00:00Z','2026-03-05 10:00:00'];
const demoSessions=()=>buildDemoTables(new Date('2026-03-01')).test_sessions;
function setup(extraSessions=[]){
  const c=services({Chart:StubChart});const t=buildDemoTables(new Date('2026-03-01'));
  c.api.ATHLETES=t.athletes.map((r,i)=>c.api.dbRowToAthlete(r,i)).map((a,i)=>({...a,id:i}));
  c.api.SESSIONS=[...t.test_sessions,...extraSessions];
  return {c,t};
}

test('regression: isValidTestDate accepts real YYYY-MM-DD dates and rejects null, missing, malformed, impossible and implausible values',()=>{
  const {c}=setup();
  for(const v of GOOD)assert.equal(c.api.isValidTestDate(v),true,`valid: ${v}`);
  for(const v of BAD)assert.equal(c.api.isValidTestDate(v),false,`invalid: ${JSON.stringify(v)}`);
});
test('regression: isOutlier never throws on a malformed reference date; the hard range check still applies and nothing is guessed',()=>{
  const {c}=setup();
  const metric=c.api.FP_METRIC_KEYS.find(k=>c.api.FP_HARD_RANGES[k]);
  const [lo,hi]=c.api.FP_HARD_RANGES[metric];
  for(const d of BAD.filter(x=>typeof x==='string'&&x!=='')){
    assert.equal(c.api.isOutlier(metric,hi*10,'Demo Forward Alpha',d),true,`out-of-range value stays an outlier (refDate ${d})`);
    assert.equal(c.api.isOutlier(metric,(lo+hi)/2,'Demo Forward Alpha',d),false,`in-range value is not flagged by a guessed window (refDate ${d})`);
  }
});
test('regression: valid-date results are identical with and without malformed-date sessions present (valid data parity)',()=>{
  const a=setup(),b=setup(BAD.map((d,i)=>({...demoSessions()[0],id:900+i,test_date:d})));
  const metrics=a.c.api.FP_METRIC_KEYS;
  for(const s of demoSessions().slice(0,80))for(const m of metrics){
    if(s[m]==null)continue;
    assert.equal(b.c.api.isOutlier(m,s[m],s.athlete_name,s.test_date),a.c.api.isOutlier(m,s[m],s.athlete_name,s.test_date),`${m} ${s.athlete_name} ${s.test_date}`);
  }
});
test('regression: a rolling-window outlier is still detected for valid dates (existing behaviour preserved)',()=>{
  const {c}=setup();const name='Parity Check Athlete',metric=c.api.FP_METRIC_KEYS.find(k=>c.api.FP_HARD_RANGES[k]&&c.api.FP_HARD_RANGES[k][0]>0);const [lo,hi]=c.api.FP_HARD_RANGES[metric];
  const base=(lo+hi)/2;
  c.api.SESSIONS=Array.from({length:c.api.MIN_SESSIONS_FOR_ROLLING+1},(_,i)=>({id:i,athlete_name:name,test_date:`2026-02-${String(10+i).padStart(2,'0')}`,[metric]:base}));
  const spike=base*(1+c.api.OUTLIER_PCT_THRESHOLD*2);
  if(spike<=hi)assert.equal(c.api.isOutlier(metric,spike,name,'2026-02-28'),true);
  assert.equal(c.api.isOutlier(metric,base,name,'2026-02-28'),false);
});
test('regression: sessions with invalid dates are skipped with a warning at load, valid sessions all remain, and Readiness renders',async()=>{
  const c=services({Chart:StubChart});const t=buildDemoTables(new Date('2026-03-01'));
  const bad=BAD.map((d,i)=>({...t.test_sessions[0],id:900+i,test_date:d}));
  c.api.sb=createDemoClient({...t,test_sessions:[...t.test_sessions,...bad]});c.api.currentUser={id:'demo'};
  const warnings=[];const orig=console.warn;console.warn=(...a)=>warnings.push(a.join(' '));
  try{await c.api.loadAllSessions();}finally{console.warn=orig;}
  assert.equal(c.api.SESSIONS.length,t.test_sessions.length,'every valid session kept, every invalid one dropped');
  assert.ok(c.api.SESSIONS.every(s=>c.api.isValidTestDate(s.test_date)));
  assert.ok(warnings.some(w=>new RegExp(`Skipped ${bad.length} session`).test(w)),'the skip is announced, not silent');
  c.api.ATHLETES=t.athletes.map((r,i)=>c.api.dbRowToAthlete(r,i)).map((a,i)=>({...a,id:i}));
  const mod=createReadiness(c);await mod.initReadiness();await mod.renderReadiness();
});
test('regression: Readiness date list never offers an invalid date even if bad rows reach SESSIONS',()=>{
  const {c}=setup(BAD.map((d,i)=>({...demoSessions()[0],id:900+i,test_date:d,peak_power:3000,power:3000})));
  const sel=c.document.getElementById('readiness-date');
  const dates=createReadiness(c).populateReadinessDates();
  assert.ok(dates.length>0);assert.ok(dates.every(d=>c.api.isValidTestDate(d)),`offered dates: ${dates.slice(0,5)}`);
});
test('regression: import dialog says changes are temporary in Demo Mode and keeps its production wording otherwise',()=>{
  const html=fs.readFileSync(new URL('../src/services/import/import.html',import.meta.url),'utf8');
  assert.match(html,/id="imp-save-note"/);
  assert.match(html,/Supabase database|session-only/,'production wording is still in the template');
  const demo=services({window:{location:{hash:'#demo'}}});
  try{demo.api.openImport();}catch(e){/* only the note matters; the rest of the dialog needs a real DOM */}
  const note=demo.document.getElementById('imp-save-note').textContent;
  assert.match(note,/DEMO MODE/);assert.match(note,/temporary/);assert.match(note,/never affect production data/);
  const live=services({window:{location:{hash:''}}});
  try{live.api.openImport();}catch(e){}
  assert.equal(live.document.getElementById('imp-save-note').textContent,'','real sessions: note text untouched');
});
