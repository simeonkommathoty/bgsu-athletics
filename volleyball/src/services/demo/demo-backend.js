// In-memory stand-in for the Supabase client, used ONLY in Demo Mode.
// It performs no network I/O of any kind: no fetch, no WebSocket, no storage,
// no cookies and no localStorage. Reads are served from the synthetic tables
// handed to createDemoClient(); writes change only those in-memory tables and
// vanish on reload. Unsupported query methods are simply absent (a TypeError
// is raised), so an unknown operation can never silently reach a real backend.
const DISABLED='Disabled in Demo Mode (synthetic data only)';

function matchLike(value,pattern){
  const escaped=String(pattern).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp('^'+escaped.replace(/%/g,'.*').replace(/_/g,'.')+'$','i');
  return re.test(String(value??''));
}
const tests={
  eq:(v,x)=>v===x, neq:(v,x)=>v!==x, in:(v,x)=>x.includes(v),
  gt:(v,x)=>v>x, gte:(v,x)=>v>=x, lt:(v,x)=>v<x, lte:(v,x)=>v<=x,
  ilike:(v,x)=>matchLike(v,x), like:(v,x)=>matchLike(v,x),
  is:(v,x)=>x===null?v==null:v===x,
};

class Query {
  constructor(store,table){this.store=store;this.table=table;this.op='select';this.filters=[];this.orders=[];this.window=null;this.max=null;this.mode=null;this.payload=null;this.options={};this.returning=false;}
  select(){if(this.op!=='select')this.returning=true;return this;}
  insert(rows){this.op='insert';this.payload=rows;return this;}
  update(patch){this.op='update';this.payload=patch;return this;}
  upsert(rows,options){this.op='upsert';this.payload=rows;this.options=options||{};return this;}
  delete(){this.op='delete';return this;}
  order(col,{ascending=true}={}){this.orders.push([col,ascending]);return this;}
  range(from,to){this.window=[from,to];return this;}
  limit(n){this.max=n;return this;}
  single(){this.mode='single';return this;}
  maybeSingle(){this.mode='maybe';return this;}
  not(col,op,value){const t=tests[op];this.filters.push(row=>!t(row[col],value));return this;}
  then(resolve,reject){return Promise.resolve().then(()=>this.run()).then(resolve,reject);}
}
for(const name of Object.keys(tests)){
  Query.prototype[name]=function(col,value){this.filters.push(row=>tests[name](row[col],value));return this;};
}
Query.prototype.run=function(){
  const rows=this.store.rows(this.table);
  const clone=row=>({...row});
  const finish=list=>{
    let out=list;
    if(this.mode==='single'){return out.length===1?{data:clone(out[0]),error:null}:{data:null,error:{message:'Expected one row'}};}
    if(this.mode==='maybe'){return {data:out[0]?clone(out[0]):null,error:null};}
    return {data:out.map(clone),error:null};
  };
  const selected=()=>rows.filter(r=>this.filters.every(f=>f(r)));
  if(this.op==='select'){
    let list=selected();
    for(const [col,asc] of [...this.orders].reverse()){
      list=[...list].sort((a,b)=>{const x=a[col],y=b[col];if(x===y)return 0;if(x==null)return 1;if(y==null)return -1;return (x<y?-1:1)*(asc?1:-1);});
    }
    if(this.window)list=list.slice(this.window[0],this.window[1]+1);
    if(this.max!=null)list=list.slice(0,this.max);
    return finish(list);
  }
  if(this.op==='insert'||this.op==='upsert'){
    const incoming=(Array.isArray(this.payload)?this.payload:[this.payload]).map(clone);
    const keys=this.options.onConflict?this.options.onConflict.split(','):['id'];
    const saved=[];
    for(const row of incoming){
      const existing=this.op==='upsert'?rows.find(r=>keys.every(k=>row[k]!=null&&r[k]===row[k])):null;
      if(existing){Object.assign(existing,row);saved.push(existing);}
      else{if(row.id==null)row.id=this.store.nextId(this.table);row.created_at=row.created_at||new Date().toISOString();rows.push(row);saved.push(row);}
    }
    return this.returning?finish(saved):{data:null,error:null};
  }
  if(this.op==='update'){
    const hit=selected();hit.forEach(r=>Object.assign(r,this.payload));
    return this.returning?finish(hit):{data:null,error:null};
  }
  if(this.op==='delete'){
    const hit=new Set(selected());
    this.store.tables[this.table]=rows.filter(r=>!hit.has(r));
    return {data:null,error:null};
  }
  return {data:null,error:{message:'Unsupported operation'}};
};

export function createDemoClient(seed) {
  const tables={};
  for(const [name,rows] of Object.entries(seed))tables[name]=rows.map(r=>({...r}));
  const counters={};
  const store={
    tables,
    rows:name=>(tables[name]||(tables[name]=[])),
    nextId:name=>{counters[name]=(counters[name]||Math.max(0,...store.rows(name).map(r=>+r.id||0)))+1;return counters[name];},
  };
  const channel={on(){return channel;},subscribe(){return channel;},unsubscribe(){return Promise.resolve('ok');}};
  const failure=()=>Promise.resolve({data:null,error:{message:DISABLED}});
  return {
    isDemo:true,
    tables,
    from:table=>new Query(store,table),
    channel:()=>channel,
    removeChannel:()=>Promise.resolve('ok'),
    storage:{from:()=>({upload:failure,remove:failure,getPublicUrl:()=>({data:{publicUrl:''}})})},
    auth:{
      signInWithPassword:()=>Promise.resolve({data:{user:null,session:null},error:{message:'Sign-in is not available in Demo Mode'}}),
      signOut:()=>Promise.resolve({error:null}),
      getSession:()=>Promise.resolve({data:{session:null}}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
      resetPasswordForEmail:failure, updateUser:failure,
    },
  };
}
