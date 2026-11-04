import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createServer,preview} from 'vite';
import {chromium} from 'playwright-core';
import * as XLSX from 'xlsx';
import {syntheticAthletes,syntheticSessions,syntheticHistory} from './fixtures.js';

const server=await createServer({server:{port:5178,strictPort:true,host:'127.0.0.1',hmr:false,watch:null}});
let browser,production;
try{
  await server.listen();
  const executablePath=process.env.HOCKEY_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  browser=await chromium.launch({executablePath,headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  let backendAttempts=0;
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1')return route.continue();
    if(url.hostname.endsWith('supabase.co'))backendAttempts++;
    await route.abort();
  });
  const page=await context.newPage();
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('http://127.0.0.1:5178/tests/browser-harness.html');
  await page.waitForFunction(()=>window.hockeyTest,{timeout:20000});
  const ids=await page.locator('#feature-nav [data-feature]').evaluateAll(nodes=>nodes.map(n=>n.dataset.feature));
  assert.equal(ids.length,12);

  // A separate browser page evaluates the untouched reference with bundled chart
  // libraries. Its backend boot is disabled and all external traffic is blocked.
  let reference=fs.readFileSync(new URL('../../originals/hockey.html',import.meta.url),'utf8');
  reference=reference.replace(/<script src="[^\"]*chart[^\"]*"><\/script>/i,()=>`<script>${fs.readFileSync('node_modules/chart.js/dist/chart.umd.js','utf8')}</script>`)
    .replace(/<script src="[^\"]*supabase[^\"]*"><\/script>/i,'')
    .replace(/<script src="[^\"]*xlsx[^\"]*"><\/script>/i,()=>`<script>${fs.readFileSync('node_modules/xlsx/dist/xlsx.full.min.js','utf8')}</script>`)
    .replace(/if\(typeof window.supabase!=='undefined'\) bootSupabase\(\);\s*else window.addEventListener\('load',bootSupabase\);/,'');
  await context.route('**/__reference.html',route=>route.fulfill({contentType:'text/html',body:reference}));
  const original=await context.newPage();const originalErrors=[];original.on('pageerror',error=>originalErrors.push(error.message));
  await original.goto('http://127.0.0.1:5178/__reference.html');
  const athletes=syntheticAthletes(),sessions=syntheticSessions(athletes),history=syntheticHistory(athletes);
  await original.evaluate(({athletes,sessions,history})=>{
    ATHLETES=athletes;SESSIONS=sessions;KPI_HISTORY=history;refreshApproachJumpFreshness();rescoreAllAthletes();
    document.getElementById('login-overlay').style.display='none';
  },{athletes,sessions,history});

  function snapshot(id,newApp){
    const root=newApp?document.querySelector('[data-feature-root]')?.shadowRoot:document;
    const element=root.querySelector('#page-'+id);
    const registry=newApp?window.hockeyTest.context.api.CH:CH;
    const charts=Object.entries(registry).filter(([,chart])=>chart.canvas?.closest('#page-'+id)).map(([key,chart])=>({
      key,type:chart.config.type,labels:chart.data.labels,
      datasets:chart.data.datasets.map(({label,data,borderColor,backgroundColor})=>({label,data,borderColor,backgroundColor})),
    }));
    return {text:element.innerText.replace(/\s+/g,' ').trim(),charts};
  }
  const result=[];
  const selectedIds=process.env.HOCKEY_FEATURE?ids.filter(id=>id===process.env.HOCKEY_FEATURE):ids;
  assert.ok(selectedIds.length,'HOCKEY_FEATURE must name a registered feature');
  for(const id of selectedIds){
    const success=await page.evaluate(id=>window.hockeyTest.layout.navigate(id),id);
    assert.equal(success,true,`${id} mounts: ${await page.locator('#feature-errors').innerText()}`);
    await original.evaluate(id=>nav(id),id);
    await original.waitForTimeout(150);await page.waitForTimeout(150);
    const actual=await page.evaluate(({id,fn})=>eval(`(${fn})`)(id,true),{id,fn:snapshot.toString()});
    const expected=await original.evaluate(({id,fn})=>eval(`(${fn})`)(id,false),{id,fn:snapshot.toString()});
    assert.deepEqual(actual,expected,`${id}: rendered text and chart inputs match the reference`);
    assert.equal(await page.locator('#feature-errors').innerText(),'');
    const {verify}=await import(`../src/features/${id}/${id}.test.js`);
    await verify(page);await verify(original);
    await page.waitForTimeout(100);await original.waitForTimeout(100);
    const after=await page.evaluate(({id,fn})=>eval(`(${fn})`)(id,true),{id,fn:snapshot.toString()});
    const referenceAfter=await original.evaluate(({id,fn})=>eval(`(${fn})`)(id,false),{id,fn:snapshot.toString()});
    assert.deepEqual(after,referenceAfter,`${id}: interactions match`);
    assert.equal(await page.locator('#feature-content > section').count(),1);
    assert.equal(await page.evaluate(()=>Object.values(window.hockeyTest.context.api.CH).every(chart=>chart.canvas?.isConnected)),true,`${id}: no detached chart instances survive navigation`);
    result.push({id,charts:actual.charts.length});
    console.log(`PASS ${id}: rendered text and ${actual.charts.length} charts match`);
  }
  assert.deepEqual(pageErrors,[],'no application page errors');
  assert.deepEqual(originalErrors,[],'no reference page errors');

  // Real delegated interactions and modal behavior, including dynamic row events.
  await page.locator('[data-feature="dashboard"]').first().click();
  await page.waitForFunction(()=>window.hockeyTest.layout.activeId==='dashboard'&&window.hockeyTest.context.api.sortKpi);
  await page.locator('#kpi-sort').selectOption('cmjHeight');
  await page.locator('#kpi-tbody tr').first().click();
  await page.waitForFunction(()=>window.hockeyTest.layout.activeId==='profile'&&window.hockeyTest.context.api.renderProfile);
  assert.ok(await page.locator('#profile-sel').inputValue());
  await page.locator('[data-feature="leaderboard"]').first().click();
  await page.waitForFunction(()=>window.hockeyTest.context.api.setM);
  await page.locator('#feature-content').getByText('Broad Jump',{exact:true}).first().click();
  assert.equal(await page.evaluate(()=>window.hockeyTest.context.api.activeM),'approachJump');
  await page.getByText('↑ IMPORT DATA',{exact:true}).click();
  await page.locator('#itab-manual').click();
  assert.equal(await page.locator('#ipanel-manual').isVisible(),true);
  await page.locator('#imp-overlay .modal-close').click();
  assert.equal(await page.locator('#imp-overlay').isVisible(),false);

  // CSV output and PDF report are compared against the reference too.
  const csvDownload=page.waitForEvent('download');
  await page.getByText('↓ EXPORT CSV',{exact:true}).click();
  const csv=await csvDownload;
  const originalCsvDownload=original.waitForEvent('download');
  await original.getByText('↓ EXPORT CSV',{exact:true}).click();
  const originalCsv=await originalCsvDownload;
  assert.equal(fs.readFileSync(await csv.path(),'utf8'),fs.readFileSync(await originalCsv.path(),'utf8'),'CSV export matches');
  for(const target of [page,original]){
    await target.evaluate(()=>{window.print=()=>{window.dispatchEvent(new Event('afterprint'));};});
  }
  await page.evaluate(()=>window.hockeyTest.layout.navigate('readiness'));
  await original.evaluate(()=>nav('readiness'));
  await page.waitForTimeout(100);await original.waitForTimeout(100);
  await page.locator('#page-readiness').getByText('⇩ EXPORT PDF',{exact:true}).click();
  await original.locator('#page-readiness').getByText('⇩ EXPORT PDF',{exact:true}).click();
  const actualReport=await page.locator('#readiness-print').innerHTML();
  const referenceReport=await original.locator('#readiness-print').innerHTML();
  assert.equal(actualReport,referenceReport,'Readiness PDF report markup matches');
  await page.waitForTimeout(100);
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('printing-readiness')),false);

  // Actual browser FileReader flows, including XLSX, with the same clock/randomness.
  const uploadRows=[['name','position','cmj height','peak power','10yd sprint'],['Synthetic UploadA','F',28.5,3200,1.42]];
  const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet(uploadRows),'Testing');
  for(const file of [
    {name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from(uploadRows.map(row=>row.join(',')).join('\n'))},
    {name:'synthetic.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(workbook,{type:'buffer',bookType:'xlsx'})},
  ]){
    for(const target of [page,original]){
      await target.evaluate(()=>{Date.now=()=>1793738400000;Math.random=()=>0.5;});
      await target.getByText('↑ IMPORT DATA',{exact:true}).click();
      await target.locator('#itab-csv').click();
      await target.locator('#csv-input').setInputFiles(file);
      await target.waitForFunction(()=>document.getElementById('dz-athlete-count').textContent.includes('1 athlete'));
    }
    const parsed=await page.evaluate(()=>JSON.parse(JSON.stringify(window.hockeyTest.context.api.parsedData)));
    const expectedParsed=await original.evaluate(()=>JSON.parse(JSON.stringify(parsedData)));
    assert.deepEqual(parsed,expectedParsed,`${file.name} preview matches`);
    for(const target of [page,original])await target.locator('#imp-overlay .modal-close').click();
  }

  // Regression: partial athlete records and non-contiguous ids (ids need not equal array positions).
  {
    const read=()=>page.evaluate(()=>{const r=document.querySelector('[data-feature-root]').shadowRoot;return r.querySelector('[id^="page-"]')?.innerText.replace(/\s+/g,' ')||'';});
    await page.evaluate(()=>{
      const api=window.hockeyTest.context.api;window.hockeyTest.savedAthletes=api.ATHLETES;
      const next=structuredClone(api.ATHLETES).filter(a=>a.id!==1);
      for(const k of ['cmjHeight','rsi','eccRFD','concImpulse','eccImpulse','contractionTime','sprint10','peakPower','concImpulseAsym','standVert'])next.find(a=>a.id===2)[k]=null;
      api.ATHLETES=next;api.refreshApproachJumpFreshness();
    });
    assert.equal(await page.evaluate(()=>window.hockeyTest.layout.navigate('profile')),true);
    await page.locator('#profile-sel').selectOption('2');
    let text=await read();
    assert.equal(await page.locator('#feature-errors').innerText(),'');
    assert.doesNotMatch(text,/NaN|undefined/,'profile shows no NaN/undefined for partial record');
    assert.ok(text.length>200,'profile rendered: '+text.length);
    assert.ok(text.includes('—'),'missing measurements use the dash convention');
    await page.locator('#profile-sel').selectOption('3');
    assert.ok((await read()).includes(await page.evaluate(()=>window.hockeyTest.context.api.ATHLETES.find(a=>a.id===3).name)),'profile shows the athlete selected by id');
    assert.equal(await page.evaluate(()=>window.hockeyTest.layout.navigate('compare')),true);
    await page.locator('#cmp-a').selectOption('2');await page.locator('#cmp-b').selectOption('3');
    text=await read();
    assert.equal(await page.locator('#feature-errors').innerText(),'');
    assert.doesNotMatch(text,/NaN|undefined/,'comparison shows no NaN/undefined for partial record');
    // A removed athlete's id left in a selector must be skipped, not crash.
    await page.evaluate(()=>{const r=document.querySelector('[data-feature-root]').shadowRoot;const sel=r.querySelector('#cmp-b');sel.insertAdjacentHTML('beforeend','<option value="1">removed</option>');sel.value='1';window.hockeyTest.context.api.renderCompare();});
    text=await read();
    assert.equal(await page.locator('#feature-errors').innerText(),'');
    assert.doesNotMatch(text,/NaN|undefined/);
    await page.evaluate(()=>{window.hockeyTest.context.api.ATHLETES=window.hockeyTest.savedAthletes;window.hockeyTest.context.api.refreshApproachJumpFreshness();});
    assert.equal(await page.evaluate(()=>window.hockeyTest.layout.navigate('dashboard')),true);
  }

  // A slow feature import can be abandoned without stalling unrelated navigation.
  await page.evaluate(()=>{
    const registration=window.hockeyTest.features.find(f=>f.id==='compare');
    window.hockeyTest.originalCompareLoader=registration.load;
    registration.load=()=>new Promise(resolve=>{window.hockeyTest.finishSlowImport=resolve;});
    window.hockeyTest.slowNavigation=window.hockeyTest.layout.navigate('compare');
  });
  await page.waitForTimeout(20);
  assert.equal(await page.evaluate(()=>window.hockeyTest.layout.navigate('dashboard')),true);
  assert.equal(await page.evaluate(()=>window.hockeyTest.slowNavigation),false);
  await page.evaluate(async()=>{
    window.hockeyTest.finishSlowImport({id:'compare',mount(){throw new Error('Cancelled feature must not mount');}});
    window.hockeyTest.features.find(f=>f.id==='compare').load=window.hockeyTest.originalCompareLoader;
  });

  // An older rejected initialization cannot tear down a newer mount of the
  // same cached feature after the user leaves and returns quickly.
  await page.evaluate(()=>{
    const api=window.hockeyTest.context.api;
    window.hockeyTest.historyLoader=Object.getOwnPropertyDescriptor(api,'loadKpiHistory');
    let calls=0;
    Object.defineProperty(api,'loadKpiHistory',{configurable:true,value:()=>++calls===1?new Promise((resolve,reject)=>{window.hockeyTest.rejectOldHistory=reject;}):Promise.resolve()});
    window.hockeyTest.oldProgress=window.hockeyTest.layout.navigate('progress');
  });
  await page.waitForFunction(()=>window.hockeyTest.rejectOldHistory);
  assert.equal(await page.evaluate(()=>window.hockeyTest.layout.navigate('dashboard')),true);
  assert.equal(await page.evaluate(()=>window.hockeyTest.layout.navigate('progress')),true);
  await page.evaluate(()=>{
    Object.defineProperty(window.hockeyTest.context.api,'loadKpiHistory',window.hockeyTest.historyLoader);
    window.hockeyTest.rejectOldHistory(new Error('synthetic superseded initialization'));
  });
  await page.waitForTimeout(30);
  assert.equal(await page.evaluate(()=>typeof window.hockeyTest.context.api.renderProgressChart),'function');
  assert.equal(await page.locator('#feature-errors').innerText(),'');

  // Recoverable load / mount / cleanup failures must leave sidebar usable.
  await page.evaluate(()=>{
    const broken=window.hockeyTest.features.find(f=>f.id==='compare');
    broken.load=async()=>{throw new Error('synthetic import failure');};
  });
  assert.equal(await page.evaluate(()=>window.hockeyTest.layout.navigate('compare')),false);
  assert.match(await page.locator('#feature-errors').innerText(),/synthetic import failure/);
  assert.equal(await page.evaluate(()=>window.hockeyTest.layout.navigate('dashboard')),true);
  await page.evaluate(()=>{
    window.hockeyTest.features.find(f=>f.id==='compare').load=async()=>({id:'compare',mount(){throw new Error('synthetic mount failure');},unmount(){throw new Error('synthetic cleanup failure');}});
  });
  assert.equal(await page.evaluate(()=>window.hockeyTest.layout.navigate('compare')),false);
  assert.equal(await page.evaluate(()=>window.hockeyTest.layout.navigate('roster')),true);
  assert.equal(await page.evaluate(()=>Object.keys(window.hockeyTest.context.api.CH).length),0,'charts cleaned up when leaving a chart feature');
  await page.evaluate(()=>{window.hockeyTest.features.find(f=>f.id==='compare').load=window.hockeyTest.originalCompareLoader;});
  for(let index=0;index<ids.length;index++){
    const id=ids[index],recovery=ids[(index+1)%ids.length];
    await page.evaluate(id=>{
      const registration=window.hockeyTest.features.find(f=>f.id===id);
      window.hockeyTest.savedLoader=registration.load;
      registration.load=async()=>{throw new Error('synthetic per-feature import failure');};
    },id);
    assert.equal(await page.evaluate(id=>window.hockeyTest.layout.navigate(id),id),false,`${id}: failure is contained`);
    await page.evaluate(id=>{window.hockeyTest.features.find(f=>f.id===id).load=window.hockeyTest.savedLoader;},id);
    assert.equal(await page.evaluate(id=>window.hockeyTest.layout.navigate(id),recovery),true,`${id}: unrelated navigation recovers`);
  }
  assert.deepEqual(pageErrors,[],'no unexpected page errors after interactions and failures');
  assert.deepEqual(originalErrors,[],'no reference errors after interactions');

  if(fs.existsSync('dist/index.html')){
    production=await preview({preview:{host:'127.0.0.1',port:5179,strictPort:true}});
    const built=await context.newPage();const builtErrors=[];built.on('pageerror',error=>builtErrors.push(error.message));
    await built.goto('http://127.0.0.1:5179/');
    await built.waitForFunction(()=>document.querySelectorAll('#feature-nav [data-feature]').length===12);
    assert.equal(await built.locator('#login-overlay').isVisible(),true);
    assert.equal(await built.evaluate(()=>Object.hasOwn(window,'hockeyTest')),false,'production excludes test hooks');
    assert.deepEqual(builtErrors,[],'built application starts without page errors');
    await built.close();
  }
  assert.equal(backendAttempts,0,'tests never contact Supabase');
  fs.mkdirSync('test-results',{recursive:true});
  await page.evaluate(()=>window.hockeyTest.layout.navigate('dashboard'));
  await page.screenshot({path:'test-results/dashboard.png',fullPage:true});
  fs.writeFileSync('test-results/browser.json',JSON.stringify({features:result,pageErrors,backendAttempts},null,2));
  console.log(JSON.stringify({passed:result.length,features:result,backendAttempts}));
}finally{
  await browser?.close();await server.close();
  if(production)await new Promise(resolve=>production.httpServer.close(resolve));
}
