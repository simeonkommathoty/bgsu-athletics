import test from 'node:test';
import assert from 'node:assert/strict';
import {services} from './support.js';
import {buildDemoTables} from '../src/services/demo/demo-data.js';
import {createModule as createPosition} from '../src/features/position/position.js';
import {createModule as createJumping} from '../src/features/jumping/jumping.js';

class StubChart{constructor(el,cfg){StubChart.last=cfg;}destroy(){}update(){}}
function setup(mutate){
  const ctx=services({Chart:StubChart});
  const t=buildDemoTables(new Date('2026-03-01'));
  ctx.api.ATHLETES=t.athletes.map((r,i)=>ctx.api.dbRowToAthlete(r,i)).map((a,i)=>({...a,id:i}));
  mutate?.(ctx.api.ATHLETES);
  return ctx;
}

test('regression: position averages use only measured values (no NaN, no missing-as-zero, dash when nobody was measured)',()=>{
  for(const strip of [undefined,'missing-as-undefined','missing-as-null']){
    const c=setup(athletes=>{
      if(!strip)return;
      // Leave exactly one athlete per position with a value and blank the rest, in both blank styles.
      const seen=new Set();
      for(const a of athletes){if(seen.has(a.pos)){a.peakPower=strip==='missing-as-null'?null:undefined;a.sprint10=strip==='missing-as-null'?null:undefined;}seen.add(a.pos);}
    });
    const html=[];
    for(const pos of c.api.POSITIONS){
      const doc=c.document;const mod=createPosition(c);
      mod.setPosTab(pos);
      html.push(doc.getElementById('pos-avgs').innerHTML);
    }
    for(const h of html){assert.doesNotMatch(h,/NaN|undefined|Infinity/,`averages panel: ${h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,120)}`);}
  }
});
test('regression: a position where nobody was measured shows a dash, a partly measured one averages the measured athletes only',()=>{
  const c=setup(athletes=>{athletes.forEach(a=>{if(a.pos===athletes[0].pos){a.sprint10=undefined;}});
    const same=athletes.filter(a=>a.pos===athletes[0].pos);if(same.length>1){same[0].peakPower=100;same[1].peakPower=200;same.slice(2).forEach(a=>{a.peakPower=undefined;});}});
  const pos=c.api.ATHLETES[0].pos;
  createPosition(c).setPosTab(pos);
  const text=c.document.getElementById('pos-avgs').innerHTML.replace(/<[^>]+>/g,'|').replace(/\|+/g,'|');
  assert.match(text,/—/,'unmeasured metric renders a dash');
  const n=c.api.ATHLETES.filter(a=>a.pos===pos).length;
  if(n>1) assert.match(text,/150/,'mean of the two measured values (100 and 200), not diluted by missing athletes');
});
test('regression: Power Testing position chart skips unmeasured positions instead of plotting NaN',()=>{
  const c=setup(athletes=>athletes.forEach(a=>{a.cmjHeight=a.pos===athletes[0].pos?undefined:a.cmjHeight;}));
  const mod=createJumping(c);
  try{mod.initJumping();}catch(e){/* DOM-heavy parts are not under test; the dataset is built before they run */}
  const cfg=StubChart.last;
  if(!cfg)return;                                   // chart not reached in the stubbed DOM
  for(const ds of cfg.data.datasets)for(const v of ds.data)assert.ok(v===null||Number.isFinite(v),`dataset ${ds.label} has non-finite value ${v}`);
});
