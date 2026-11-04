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
  const positions=Object.keys(api.NORMS);
  const metrics=api.ALL_METRICS.filter(m=>m.group!=='score');
  for(let index=0;index<1479;index++){
    const athlete=syntheticAthletes(1)[0];athlete.pos=positions[index%positions.length];
    const norms=api.NORMS[athlete.pos];
    for(let j=0;j<metrics.length;j++){
      const m=metrics[j],range=norms[m.key]||[0,100];
      const part=((index*31+j*17)%131)/100;
      athlete[m.key]=(index+j)%19===0?null:range[0]+(range[1]-range[0])*part;
    }
    athlete.approachJumpDate=index%5===0?'2020-01-01':'2026-10-15';
    const actual=structuredClone(athlete);oracle.set('ATHLETES',[structuredClone(athlete)]);
    assert.equal(api.calcCompositeVB(actual),oracle.run('calcCompositeVB(ATHLETES[0])'),`case ${index}`);
  }
});
test('tiers, ACWR, outliers, radar and team readiness match the original',()=>{
  const {api}=services();const oracle=referenceOracle();
  const athletes=syntheticAthletes(),sessions=syntheticSessions(athletes);
  api.ATHLETES=structuredClone(athletes);api.SESSIONS=structuredClone(sessions);
  oracle.set('ATHLETES',structuredClone(athletes));oracle.set('SESSIONS',structuredClone(sessions));
  for(const score of [0,44,45,62,63,79,80,100])assert.equal(api.calcTier(score),oracle.run(`calcTier(${score})`));
  for(let i=0;i<athletes.length;i++){
    assert.equal(api.calcCompositeVB(api.ATHLETES[i]),oracle.run(`calcCompositeVB(ATHLETES[${i}])`));
    assert.equal(api.calcACWR(api.ATHLETES[i]),oracle.run(`calcACWR(ATHLETES[${i}])`));
    assert.deepEqual(JSON.parse(JSON.stringify(api.athleteRadarData(api.ATHLETES[i]))),JSON.parse(JSON.stringify(oracle.run(`athleteRadarData(ATHLETES[${i}])`))));
    for(const value of [null,0,5,20,25,50,80])assert.equal(api.isOutlier('jump_height',value,athletes[i].name,'2026-10-21'),oracle.run(`isOutlier('jump_height',${value},ATHLETES[${i}].name,'2026-10-21')`));
  }
  const today=sessions.filter(s=>s.test_date==='2026-10-21');
  const actual=api.computeTeamReadiness(today,sessions,'2026-10-21',n=>n);
  const expected=oracle.run("computeTeamReadiness(SESSIONS.filter(s=>s.test_date==='2026-10-21'),SESSIONS,'2026-10-21',n=>n)");
  assert.deepEqual(JSON.parse(JSON.stringify(actual)),JSON.parse(JSON.stringify(expected)));
});
