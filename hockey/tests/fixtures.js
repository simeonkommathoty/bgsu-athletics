export function syntheticAthletes(count=9) {
  return Array.from({length:count},(_,id)=>({
    id,name:`Synthetic Skater${String.fromCharCode(65+id)}`,_canonicalName:`Synthetic Skater${String.fromCharCode(65+id)}`,
    initials:`S${id+1}`,pos:['F','D','G'][id%3],yr:['Fr','So','Jr','Sr'][id%4],age:20,av:`a${id%6}`,
    _posLocked:true,_nameLocked:true,trend:[44,50,55,60,65,70],_sources:[],
    approachJump:99+id,approachJumpDate:'2026-10-15',cmjHeight:25+id/2,standVert:3.09-id/100,
    sprint10:1.47-id/100,peakPower:2800+id*100,rsi:0.35+id/100,asymmetry:3+id/2,eccRFD:2500+id*100,
    concImpulse:180+id,eccImpulse:160+id,contractionTime:720-id,takeoffVelocity:2.8+id/100,concImpulseAsym:4,eccBrakingAsym:5,
    jumpVol:100+id*4,avgJumpHt:150+id,playerLoad:1+id/20,acuteLoad:100+id,chronicLoad:95+id,acwr:1.05,
    frontSquatMax:275+id*5,ngChinUp:70+id*2,onIceBeep:6+id/10,benchMax:165+id*5,hangCleanMax:155+id*5,
    composite:65,tier:'Advanced',
  }));
}
export function syntheticSessions(athletes=syntheticAthletes()) {
  return athletes.flatMap((athlete,i)=>Array.from({length:10},(_,day)=>({
    id:`synthetic-${i}-${day}`,athlete_name:athlete.name,test_date:`2026-10-${String(day+12).padStart(2,'0')}`,
    jump_height:25+i/2+(day%3)*0.3,peak_power:3000+i*80+(day%3)*30,rsi_mod:0.4+i/100,
    takeoff_velocity:2.8+i/100,conc_impulse:180+i,ecc_impulse:160+i,ecc_rfd:2600+i*50,
    contraction_time:700+i,asymmetry:3+i/2,conc_impulse_asym:4,ecc_braking_asym:5,
    trimp_total:100+i+day,avg_hr:150+i,max_hr:185,session_duration_min:60,effic_score:1.1,session_type:'Practice',
  })));
}
export function syntheticHistory(athletes=syntheticAthletes()) {
  return athletes.flatMap(a=>['approachJump','cmjHeight','sprint10','frontSquatMax','ngChinUp'].flatMap(metric_key=>
    ['2025-09-10','2026-08-20','2026-09-10','2026-10-20'].map((test_date,i)=>({
      athlete_name:a.name,metric_key,test_date,value:a[metric_key]*(metric_key==='sprint10'?1.03-i/100:0.9+i/30),source:'synthetic.csv',
    }))));
}

