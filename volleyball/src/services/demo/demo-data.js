// 100% synthetic Volleyball demo dataset. No real athlete, name, or measurement
// is used. Values come from a fixed seed inside this sport's own position norms,
// with dates relative to "today" so recency windows stay populated.
import {DEMO_AVATAR} from './demo-avatar.js';
function prng(seed){let t=seed>>>0;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296;};}
const iso=(today,daysAgo)=>new Date(today.getTime()-daysAgo*86400000).toISOString().slice(0,10);
const lerp=(lo,hi,q)=>lo+(hi-lo)*q;

// [position, quality 0..1, class year]
const ROSTER=[
  ['OH',0.85,'Sr'],['OH',0.66,'Jr'],['OH',0.48,'Fr'],
  ['MB',0.78,'Jr'],['MB',0.58,'So'],['MB',0.40,'Fr'],
  ['S',0.72,'Sr'],['S',0.50,'So'],
  ['RS',0.62,'Jr'],['OPP',0.74,'So'],
  ['Lib',0.68,'Jr'],['Lib',0.44,'Fr'],
  ['DS',0.56,'So'],['DS',0.36,'Fr'],
];
// Names carry NO digits: the app's own identity normalisation (normName) strips digits, so
// "Demo Forward 01" and "Demo Forward 02" would be merged into one athlete by dedupe.
const SUFFIX=['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf'];
const WORD={OH:'Outside',MB:'Middle',S:'Setter',RS:'RightSide',OPP:'Opposite',Lib:'Libero',DS:'DefSpec'};
// Position ranges inside the sport's own NORMS (cm/in as the app uses them).
const RANGE={
  OH:{app:[108,126],cmj:[15,21],sv:[17,25]},MB:{app:[108,126],cmj:[15,21],sv:[18,26]},S:{app:[106,124],cmj:[14,20],sv:[16,24]},
  RS:{app:[108,126],cmj:[15,21],sv:[17,25]},OPP:{app:[108,126],cmj:[15,21],sv:[18,26]},Lib:{app:null,cmj:[13,19],sv:[13,20]},DS:{app:null,cmj:[13,19],sv:[14,21]},
};
// Intentionally incomplete records (indexes into ROSTER).
const NO_FORCE_PLATE=new Set([2]);
const NO_STRENGTH=new Set([5]);
const NO_TESTING=new Set([13]);          // name and position only
const NO_KINEXON=new Set([11]);

export function buildDemoTables(today=new Date()) {
  const rnd=prng(20260302);
  const athletes=[],sessions=[];
  const counts={};
  ROSTER.forEach(([pos,q,yr],i)=>{
    const n=counts[pos]=(counts[pos]||0)+1;
    const name=`Demo ${WORD[pos]} ${SUFFIX[n-1]}`;
    const cl=v=>Math.min(1,Math.max(0,v));
    const j=(spread=0.08)=>cl(q+(rnd()-0.5)*spread*2);
    const latest=iso(today,5+i%5);
    const R=RANGE[pos];
    const row={
      id:i+1,canonical_name:name,display_name:name,initials:`D${pos[0]}${n}`,pos,yr,age:18+['Fr','So','Jr','Sr'].indexOf(yr)+Math.floor(rnd()*2),av:`a${i%6}`,
      photo_url:DEMO_AVATAR,name_locked:true,pos_locked:true,archived:false,
      sources:[{file:'demo-synthetic.csv',date:iso(today,6),keys:['approachJump','cmjHeight','standVert']}],
      trend:Array.from({length:6},(_,k)=>Math.round(32+q*45+k*2+(rnd()-0.5)*6)),
    };
    const dated=(col,val)=>{row[col]=val;row[col+'_date']=latest;};
    if(!NO_TESTING.has(i)){
      if(R.app)dated('approach_jump',+lerp(R.app[0],R.app[1],j()).toFixed(0));
      dated('cmj_height',+lerp(R.cmj[0],R.cmj[1],j()).toFixed(1));
      dated('stand_vert',+lerp(R.sv[0],R.sv[1],j()).toFixed(1));
      row.sprint_10=+lerp(1.88,1.6,j()).toFixed(2);
      if(!NO_STRENGTH.has(i)){
        dated('back_squat_max',Math.round(lerp(125,250,j())/5)*5);dated('trap_bar_max',Math.round(lerp(165,335,j())/5)*5);
        dated('front_squat_max',Math.round(lerp(100,205,j())/5)*5);dated('bench_max',Math.round(lerp(85,160,j())/5)*5);dated('hang_clean_max',Math.round(lerp(95,170,j())/5)*5);
      }
      if(!NO_FORCE_PLATE.has(i)){
        row.peak_power=Math.round(lerp(1800,3900,j()));row.rsi=+lerp(0.29,0.55,j()).toFixed(3);row.asymmetry=+lerp(13,2.5,j(0.15)).toFixed(1);
        row.ecc_rfd=Math.round(lerp(2200,4200,j()));row.conc_impulse=Math.round(lerp(160,240,j()));row.ecc_impulse=Math.round(lerp(140,220,j()));row.contraction_time=Math.round(lerp(780,600,j()));
      }
      if(!NO_KINEXON.has(i)){
        row.jump_vol=Math.round(lerp(pos==='Lib'||pos==='DS'?85:165,pos==='Lib'||pos==='DS'?130:260,rnd()));
        row.avg_jump_ht=+lerp(15,22,j()).toFixed(1);row.player_load=Math.round(lerp(440,640,rnd()));
        row.acute_load=Math.round(lerp(400,600,rnd()));row.chronic_load=Math.round(row.acute_load*lerp(0.85,1.15,rnd()));
      }
    }
    athletes.push(row);
    if(NO_TESTING.has(i))return;

    // VALD ForceDecks sessions (every ~12 days, newest first dates). cmjHeight is later
    // taken from the best valid jump_height (5-21 in) exactly as in the live app.
    if(!NO_FORCE_PLATE.has(i)){
      for(let k=0;k<7;k++){
        const drift=1-k*0.012,miss=(k===3&&i%3===0);
        sessions.push({id:sessions.length+1,athlete_name:name,test_date:iso(today,4+i%4+k*12),test_type:'vald_forcedecks',
          jump_height:+Math.min(21,lerp(14,20.5,j(0.1))*drift).toFixed(1),
          power:miss?null:Math.round(row.peak_power*drift*(1+(rnd()-0.5)*0.05)),mrsi:+(row.rsi*drift).toFixed(3),
          takeoff_velocity:+lerp(2.2,3.0,j()).toFixed(2),concentric_impulse:Math.round(row.conc_impulse*drift),ecc_impulse:Math.round(row.ecc_impulse*drift),
          ecc_rfd:miss?null:Math.round(row.ecc_rfd*drift),contraction_time:Math.round(row.contraction_time/drift),asymmetry:row.asymmetry,
          conc_impulse_asym:+lerp(3,9,rnd()).toFixed(1),ecc_braking_asym:+lerp(3,10,rnd()).toFixed(1)});
      }
    }
    // Approach / vertical touch sessions (4 testing blocks).
    if(R.app){
      [120,80,40,0].forEach((ago,k)=>sessions.push({id:sessions.length+1,athlete_name:name,test_date:iso(today,Math.max(ago,5+i%5)),test_type:'approach_vert',
        approach_height_inches:+(row.approach_jump*(0.96+k*0.0135)).toFixed(1),approach_vert:+(row.cmj_height*(0.97+k*0.01)).toFixed(1),standing_reach:+lerp(94,106,rnd()).toFixed(1)}));
    }
    // Kinexon load sessions (every 3 days for 5 weeks).
    if(!NO_KINEXON.has(i)){
      for(let k=0;k<12;k++){
        const kind=['Training','Training','Lift','Match','Training'][(k+i)%5];
        const dur=kind==='Match'?85:kind==='Lift'?50:90;
        const back=(pos==='Lib'||pos==='DS')?0.55:1;
        const jumps=kind==='Lift'?Math.round(10+rnd()*20):Math.round((kind==='Match'?150:120)*back*(0.8+rnd()*0.4));
        sessions.push({id:sessions.length+1,athlete_name:name,test_date:iso(today,1+k*3+i%3),test_type:'kinexon',session_type:kind,session_duration_min:dur,
          jumps_total:jumps,jumps_per_min:+(jumps/dur).toFixed(2),jumps_high:Math.round(jumps*0.2),jumps_mid:Math.round(jumps*0.35),jumps_low:Math.round(jumps*0.45),
          accel_load:Math.round(dur*(kind==='Lift'?3.2:5.4)*(0.85+rnd()*0.3)),accel_load_per_min:+(kind==='Lift'?3.2:5.4).toFixed(2)});
      }
    }
  });
  return {athletes,test_sessions:sessions,audit_log:[
    {id:1,changed_at:new Date(today.getTime()-3600e3).toISOString(),athlete_name:athletes[0].canonical_name,action:'update',changed_by:'demo@synthetic.invalid',changed_fields:{fields:['demo (synthetic entry)']}},
  ]};
}
