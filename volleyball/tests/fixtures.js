export function syntheticAthletes(count=9) {
  return Array.from({length:count},(_,id)=>({
    id,name:`Synthetic Player${String.fromCharCode(65+id)}`,_canonicalName:`Synthetic Player${String.fromCharCode(65+id)}`,
    initials:`S${id+1}`,pos:['OH','MB','S','RS','OPP','Lib','DS'][id%7],yr:['Fr','So','Jr','Sr'][id%4],age:20,av:`a${id%6}`,
    _posLocked:true,_nameLocked:true,trend:[44,50,55,60,65,70],_sources:[],
    approachJump:112+id,approachJumpDate:'2026-10-15',cmjHeight:22+id/2,standVert:20+id/4,
    sprint10:1.75-id/100,peakPower:2800+id*100,rsi:0.35+id/100,asymmetry:3+id/2,eccRFD:2500+id*100,
    concImpulse:180+id,eccImpulse:160+id,contractionTime:720-id,takeoffVelocity:2.8+id/100,concImpulseAsym:4,eccBrakingAsym:5,
    jumpVol:100+id*4,avgJumpHt:150+id,playerLoad:1+id/20,acuteLoad:100+id,chronicLoad:95+id,acwr:1.05,
    backSquatMax:200+id*5,trapBarMax:300+id*5,frontSquatMax:175+id*5,benchMax:125+id*5,hangCleanMax:125+id*5,
    composite:65,tier:'Advanced',
  }));
}
export function syntheticSessions(athletes=syntheticAthletes()) {
  return athletes.flatMap((athlete,i)=>Array.from({length:10},(_,day)=>({
    id:`synthetic-${i}-${day}`,athlete_name:athlete.name,test_date:`2026-10-${String(day+12).padStart(2,'0')}`,
    jump_height:22+i/2+(day%3)*0.3,power:3000+i*80+(day%3)*30,mrsi:0.4+i/100,test_type:'vald_forcedecks',
    takeoff_velocity:2.8+i/100,concentric_impulse:180+i,ecc_rfd:2600+i*50,
    contraction_time:700+i,conc_impulse_asym:4,ecc_braking_asym:5,
    session_type:'Practice',
  })).concat(Array.from({length:6},(_,day)=>({
    id:`synthetic-kinexon-${i}-${day}`,athlete_name:athlete.name,test_date:`2026-10-${String(day+14).padStart(2,'0')}`,
    test_type:'kinexon',session_type:day%2?'Match':'Training',jumps_total:80+i*3+day*5,jumps_low:40,jumps_mid:30,jumps_high:10+day,
    jumps_per_min:1.1+i/20,accel_load:40+i+day,accel_load_per_min:0.4+i/50,session_duration_min:70,
  }))));
}
