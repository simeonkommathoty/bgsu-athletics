import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sports} from '../src/sports.js';
import {selectableSports,availableSports,renderCards} from '../src/portal.js';

const page=html=>({ok:true,text:async()=>html});
const sportPage=page('<!doctype html><html><body><div id="x-app"></div></body></html>');
const portalPage=page('<!doctype html><html><body><div id="portal-root"></div></body></html>');
const base='http://localhost/';

test('registry defines hockey and volleyball with required fields',()=>{
  assert.deepEqual(sports.map(s=>s.id),['hockey','volleyball']);
  for(const s of sports)for(const key of ['id','name','description','icon','path','enabled','order'])assert.ok(s[key]!==undefined,`${s.id}.${key}`);
});
test('disabled and malformed sports are hidden; order is respected',()=>{
  const list=selectableSports([{id:'b',name:'B',path:'b/',enabled:true,order:2},{id:'a',name:'A',path:'a/',enabled:true,order:1},{id:'off',name:'Off',path:'off/',enabled:false,order:0},{id:'bad',enabled:true}]);
  assert.deepEqual(list.map(s=>s.id),['a','b']);
});
test('a synthetic third sport renders a card with no layout edit',async()=>{
  const third={id:'soccer',name:'Soccer',description:'d',icon:'<svg></svg>',path:'soccer/',enabled:true,order:3};
  const found=await availableSports([...sports,third],async()=>sportPage,base);
  const html=renderCards(found);
  assert.equal((html.match(/class="sport-card"/g)||[]).length,3);
  assert.match(html,/href="soccer\/"/);
});
test('missing, failing or portal-fallback application paths are hidden gracefully',async()=>{
  const fetchFn=async url=>{
    if(url.includes('hockey'))return sportPage;
    if(url.includes('volleyball'))return {ok:false,text:async()=>''};
    if(url.includes('ghost'))return portalPage;
    throw new Error('network down');
  };
  const registry=[...sports,{id:'ghost',name:'Ghost',path:'ghost/',enabled:true,order:3},{id:'net',name:'Net',path:'net/',enabled:true,order:4}];
  const warn=console.warn;console.warn=()=>{};
  try{assert.deepEqual((await availableSports(registry,fetchFn,base)).map(s=>s.id),['hockey']);}finally{console.warn=warn;}
});
test('cards escape registry text',()=>{
  assert.doesNotMatch(renderCards([{id:'x',name:'<img onerror=1>',path:'x/'}]),/<img/);
});
test('portal renders no hardcoded sport cards in HTML and has no auth logic',()=>{
  assert.doesNotMatch(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),/Hockey|Volleyball/);
  assert.doesNotMatch(fs.readFileSync(new URL('../src/portal.js',import.meta.url),'utf8'),/supabase|signIn|password/i);
});
