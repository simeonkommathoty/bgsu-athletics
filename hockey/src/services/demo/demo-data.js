// 100% synthetic Hockey demo dataset. No real athlete, name, or measurement is
// used. Values are generated from a fixed seed inside the sport's own norm
// ranges, with dates relative to "today" so the recency windows stay populated.
import {DEMO_AVATAR} from './demo-avatar.js';
function prng(seed){let t=seed>>>0;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296;};}
const iso=(today,daysAgo)=>new Date(today.getTime()-daysAgo*86400000).toISOString().slice(0,10);
const lerp=(lo,hi,q)=>lo+(hi-lo)*q;

// Names are placeholders on purpose: "Demo <Position> <n>".
const ROSTER=[
  ['F',0.82,'Sr'],['F',0.70,'Jr'],['F',0.64,'Jr'],['F',0.55,'So'],['F',0.47,'So'],['F',0.38,'Fr'],['F',0.30,'Fr'],
  ['D',0.76,'Sr'],['D',0.60,'Jr'],['D',0.52,'So'],['D',0.42,'Fr'],['D',0.34,'Fr'],
  ['G',0.66,'Jr'],['G',0.45,'So'],
];
const WORD={F:'Forward',D:'Defense',G:'Goalie'};
// Intentionally incomplete records (indexes into ROSTER) for missing-data handling.
const NO_FORCE_PLATE=new Set([6,11]);   // no VALD sessions or force-plate fields
const NO_STRENGTH=new Set([5]);         // no lift tests
const NO_SPEED=new Set([13]);           // no sprint / goal-to-blue
const NO_TESTING=new Set([12]);         // almost nothing but a name and position

export function buildDemoTables(today=new Date()) {
  const rnd=prng(20260301);
  const athletes=[],sessions=[],history=[];
  let sid=1,hid=1;
  const counts={F:0,D:0,G:0};
  ROSTER.forEach(([pos,q0,yr],i)=>{
    const n=++counts[pos];
    const name=`Demo ${WORD[pos]} ${String(n).padStart(2,'0')}`;
    const q=q0;const j=(spread=0.08)=>q+(rnd()-0.5)*spread*2;
    const cl=v=>Math.min(1,Math.max(0,v));
    const latest=iso(today,4+i%5);
    const row={
      id:i+1,canonical_name:name,display_name:name,initials:`D${pos}${n}`,pos,yr,age:18+['Fr','So','Jr','Sr'].indexOf(yr)+Math.floor(rnd()*2),av:`a${i%6}`,
      photo_url:DEMO_AVATAR,name_locked:true,pos_locked:true,archived:false,sources:[{file:'demo-synthetic.csv',date:iso(today,5),keys:['approachJump','cmjHeight','sprint10']}],
      trend:Array.from({length:6},(_,k)=>Math.round(30+q*45+k*2+(rnd()-0.5)*6)),
    };
    const set=(col,val,dateCol)=>{row[col]=val;if(dateCol)row[dateCol]=latest;};
    const speed=!NO_SPEED.has(i)&&!NO_TESTING.has(i),jump=!NO_TESTING.has(i),lift=!NO_STRENGTH.has(i)&&!NO_TESTING.has(i);
    if(jump){set('approach_jump',+lerp(94,114,cl(j())).toFixed(0),'approach_jump_date');set('cmj_height',+lerp(23,34,cl(j())).toFixed(1),'cmj_height_date');}
    if(speed&&pos!=='G'){set('stand_vert',+lerp(3.18,2.84,cl(j())).toFixed(2),'stand_vert_date');}
    if(speed){set('sprint_10',+lerp(1.5,1.35,cl(j())).toFixed(2),'sprint_10_date');}
    if(lift){
      set('front_squat_max',Math.round(lerp(225,375,cl(j()))/5)*5,'front_squat_max_date');
      set('ng_chin_up',Math.round(lerp(35,120,cl(j()))/5)*5,'ng_chin_up_date');
      set('bench_max',Math.round(lerp(155,285,cl(j()))/5)*5,'bench_max_date');
      set('hang_clean_max',Math.round(lerp(135,225,cl(j()))/5)*5,'hang_clean_max_date');
      set('on_ice_beep',+lerp(4.5,9,cl(j())).toFixed(1),'on_ice_beep_date');
    }
    if(!NO_FORCE_PLATE.has(i)&&!NO_TESTING.has(i)){
      row.peak_power=Math.round(lerp(2300,4400,cl(j())));row.rsi=+lerp(0.29,0.55,cl(j())).toFixed(3);
      row.asymmetry=+lerp(13,2.5,cl(j(0.15))).toFixed(1);row.ecc_rfd=Math.round(lerp(2300,4200,cl(j())));
      row.conc_impulse=Math.round(lerp(165,240,cl(j())));row.ecc_impulse=Math.round(lerp(145,215,cl(j())));row.contraction_time=Math.round(lerp(780,610,cl(j())));
    }
    if(!NO_TESTING.has(i)){
      row.jump_vol=Math.round(lerp(70,170,rnd()));row.avg_jump_ht=Math.round(lerp(148,172,rnd()));row.player_load=+lerp(0.9,1.6,rnd()).toFixed(2);
      row.acute_load=Math.round(lerp(80,170,rnd()));row.chronic_load=Math.round(row.acute_load*lerp(0.8,1.2,rnd()));
    }
    athletes.push(row);

    // Dated testing history (4 testing blocks) trending up to the current value.
    const tracked=[['approachJump','approach_jump',false],['cmjHeight','cmj_height',false],['standVert','stand_vert',true],['sprint10','sprint_10',true],
      ['frontSquatMax','front_squat_max',false],['ngChinUp','ng_chin_up',false],['onIceBeep','on_ice_beep',false],['benchMax','bench_max',false],['hangCleanMax','hang_clean_max',false]];
    for(const [key,col,lowerBetter] of tracked){
      if(row[col]==null)continue;
      [150,100,50,0].forEach((ago,k)=>{
        const f=(3-k)*0.025;                    // earlier blocks were weaker/slower
        history.push({id:hid++,athlete_name:name,metric_key:key,test_date:iso(today,Math.max(ago,4+i%5)),value:+(row[col]*(lowerBetter?1+f:1-f)).toFixed(3),source:'demo-synthetic'});
      });
    }

    // VALD force-plate sessions (every ~12 days) — absent for incomplete records.
    if(!NO_FORCE_PLATE.has(i)&&!NO_TESTING.has(i)){
      for(let k=0;k<7;k++){
        const date=iso(today,3+i%4+k*12);const drift=1-k*0.012;
        const miss=(k===3&&i%4===1);                  // an occasional half-empty session
        sessions.push({id:sid++,athlete_name:name,test_date:date,session_type:'CMJ',
          jump_height:+(lerp(14,20,cl(j(0.1)))*drift).toFixed(1),
          peak_power:miss?null:Math.round(row.peak_power*drift*(1+(rnd()-0.5)*0.05)),
          rsi_mod:+(row.rsi*drift).toFixed(3),takeoff_velocity:+lerp(2.3,3.1,cl(j())).toFixed(2),
          conc_impulse:Math.round(row.conc_impulse*drift),ecc_impulse:Math.round(row.ecc_impulse*drift),ecc_rfd:miss?null:Math.round(row.ecc_rfd*drift),
          contraction_time:Math.round(row.contraction_time/drift),asymmetry:row.asymmetry,conc_impulse_asym:+lerp(3,9,rnd()).toFixed(1),ecc_braking_asym:+lerp(3,10,rnd()).toFixed(1)});
      }
    }
    // Firstbeat / workload sessions (every 3 days, last 5 weeks).
    if(!NO_TESTING.has(i)){
      for(let k=0;k<12;k++){
        const kind=['Practice','Practice','Lift','Match','Training'][(k+i)%5];
        const dur=kind==='Match'?(pos==='G'?60:52):kind==='Lift'?55:70;
        const rate=(pos==='G'?0.9:1.7)*(kind==='Lift'?0.7:kind==='Match'?1.3:1)*(0.85+rnd()*0.3);
        const trimp=Math.round(dur*rate);
        sessions.push({id:sid++,athlete_name:name,test_date:iso(today,1+k*3+i%3),session_type:kind,
          trimp_total:trimp,trimp_per_min:+rate.toFixed(2),avg_hr:Math.round(128+rate*14+rnd()*6),max_hr:Math.round(172+rnd()*18),
          session_duration_min:dur,effic_score:+lerp(0.8,1.5,rnd()).toFixed(2)});
      }
    }
  });
  return {athletes,test_sessions:sessions,kpi_history:history,session_drills:[],audit_log:[
    {id:1,changed_at:new Date(today.getTime()-3600e3).toISOString(),athlete_name:athletes[0].canonical_name,action:'update',changed_by:'demo@synthetic.invalid',changed_fields:{fields:['demo (synthetic entry)']}},
  ]};
}
