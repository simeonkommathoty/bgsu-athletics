import test from 'node:test';
import assert from 'node:assert/strict';
import {services,fakeDocument} from './support.js';
import {buildDemoTables} from '../src/services/demo/demo-data.js';

function exportCsv(mutate){
  const doc=fakeDocument();let anchor;
  doc.createElement=()=>{anchor={click(){}};return anchor;};
  const c=services({document:doc});
  const t=buildDemoTables(new Date('2026-03-01'));
  c.api.ATHLETES=t.athletes.map((r,i)=>c.api.dbRowToAthlete(r,i)).map((a,i)=>({...a,id:i}));
  mutate(c.api.ATHLETES);
  c.api.doExport();
  const csv=decodeURIComponent(anchor.href.replace('data:text/csv,',''));
  return {csv,file:anchor.download};
}
const parse=csv=>{const rows=[];let row=[],cell='',q=false;for(let i=0;i<csv.length;i++){const ch=csv[i];
  if(q){if(ch==='"'&&csv[i+1]==='"'){cell+='"';i++;}else if(ch==='"')q=false;else cell+=ch;}
  else if(ch==='"')q=true;else if(ch===','){row.push(cell);cell='';}else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';}else cell+=ch;}
  row.push(cell);rows.push(row);return rows;};

test('regression: CSV export writes blanks for non-finite numbers and quotes commas/quotes, keeping every row the same width',()=>{
  const {csv}=exportCsv(a=>{a[0].acwr=NaN;a[0].composite=Infinity;a[1]._canonicalName=a[1].name='Doe, Jane "JJ"';a[1].tier=undefined;});
  assert.doesNotMatch(csv,/NaN|undefined|Infinity/);
  const rows=parse(csv);
  const width=rows[0].length;
  for(const r of rows)assert.equal(r.length,width,'every row has the same number of columns');
  assert.ok(rows.some(r=>r[0]==='Doe, Jane "JJ"'),'name with comma and quotes round-trips intact');
});
test('regression: each sport exports under its own file name',()=>{
  assert.equal(exportCsv(()=>{}).file,'bgsu-hockey-sc.csv');
});
