import test from 'node:test';
import assert from 'node:assert/strict';
import {services,referenceOracle,syntheticAthletes,syntheticSessions} from './support.js';

test('reference baseline is executable with synthetic data and no network',()=>{
  const oracle=referenceOracle();oracle.set('ATHLETES',syntheticAthletes());
  assert.equal(oracle.run('calcTier(80)'),'Elite');
  assert.equal(typeof oracle.run('calcCompositeVB(ATHLETES[0])'),'number');
});
test('1,479 deterministic synthetic composite cases match the original (new corpus)',()=>{
  const {api}=services();const oracle=referenceOracle();
  const metrics=api.ALL_METRICS.filter(m=>api.COMPOSITE_NORMS[m.key]);
  for(let index=0;index<1479;index++){
    const athlete=syntheticAthletes(1)[0];athlete.pos=['F','D','G'][index%3];
    for(let j=0;j<metrics.length;j++){
      const m=metrics[j],[lo,hi]=api.COMPOSITE_NORMS[m.key];
      const part=((index*31+j*17)%131)/100;
      athlete[m.key]=(index+j)%19===0?null:lo+(hi-lo)*part;
    }
    const actual=structuredClone(athlete);oracle.set('ATHLETES',[structuredClone(athlete)]);
    const expected=oracle.run('calcCompositeVB(ATHLETES[0])');
    assert.equal(api.calcCompositeVB(actual),expected,`case ${index}`);
  }
});
test('fall declines, goalie exception, missing metrics, readiness, outliers and radar match',()=>{
  const {api}=services();const oracle=referenceOracle();
  const athletes=syntheticAthletes(),sessions=syntheticSessions(athletes);
  const history=athletes.flatMap(a=>[
    {athlete_name:a.name,metric_key:'sprint10',test_date:'2026-09-10',value:1.4},
    {athlete_name:a.name,metric_key:'sprint10',test_date:'2026-10-20',value:1.49},
  ]);
  api.ATHLETES=structuredClone(athletes);api.SESSIONS=structuredClone(sessions);api.KPI_HISTORY=structuredClone(history);
  oracle.set('ATHLETES',structuredClone(athletes));oracle.set('SESSIONS',structuredClone(sessions));oracle.set('KPI_HISTORY',structuredClone(history));
  for(let i=0;i<athletes.length;i++){
    assert.equal(api.calcCompositeVB(api.ATHLETES[i]),oracle.run(`calcCompositeVB(ATHLETES[${i}])`));
    assert.deepEqual(JSON.parse(JSON.stringify(api.athleteRadarData(api.ATHLETES[i]))),JSON.parse(JSON.stringify(oracle.run(`athleteRadarData(ATHLETES[${i}])`))));
    for(const value of [null,0,5,20,25,50,80])assert.equal(api.isOutlier('jump_height',value,athletes[i].name,'2026-10-21'),oracle.run(`isOutlier('jump_height',${value},ATHLETES[${i}].name,'2026-10-21')`));
  }
  const today=sessions.filter(s=>s.test_date==='2026-10-21');
  oracle.set('SESSIONS',sessions);oracle.set('ATHLETES',athletes);
  const actual=api.computeTeamReadiness(today,sessions,'2026-10-21',n=>n);
  const expected=oracle.run("computeTeamReadiness(SESSIONS.filter(s=>s.test_date==='2026-10-21'),SESSIONS,'2026-10-21',n=>n)");
  assert.deepEqual(JSON.parse(JSON.stringify(actual)),JSON.parse(JSON.stringify(expected)));
});
