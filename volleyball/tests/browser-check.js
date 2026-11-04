import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createServer,preview} from 'vite';
import {chromium} from 'playwright-core';
import {syntheticAthletes,syntheticSessions} from './fixtures.js';

const server=await createServer({server:{port:5178,strictPort:true,host:'127.0.0.1',hmr:false,watch:null}});
let browser,production;
try{
  await server.listen();
  const executablePath=process.env.VOLLEYBALL_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
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
  await page.waitForFunction(()=>window.volleyballTest,{timeout:20000});
  const ids=await page.locator('#feature-nav [data-feature]').evaluateAll(nodes=>nodes.map(n=>n.dataset.feature));
  assert.equal(ids.length,11);

  // A separate browser page evaluates the untouched reference with bundled chart
  // libraries. Its backend boot is disabled and all external traffic is blocked.
  let reference=fs.readFileSync(new URL('../../originals/volleyball.html',import.meta.url),'utf8');
  reference=reference.replace(/<script src="[^\"]*chart[^\"]*"><\/script>/i,()=>`<script>${fs.readFileSync('node_modules/chart.js/dist/chart.umd.js','utf8')}</script>`)
    .replace(/<script src="[^\"]*supabase[^\"]*"><\/script>/i,'')
    .replace(/if\(typeof window.supabase!=='undefined'\) bootSupabase\(\);\s*else window.addEventListener\('load',bootSupabase\);/,'');
  await context.route('**/__reference.html',route=>route.fulfill({contentType:'text/html',body:reference}));
  const original=await context.newPage();const originalErrors=[];original.on('pageerror',error=>originalErrors.push(error.message));
  await original.goto('http://127.0.0.1:5178/__reference.html');
  const athletes=syntheticAthletes(),sessions=syntheticSessions(athletes);
  await original.evaluate(({athletes,sessions})=>{
    ATHLETES=athletes;SESSIONS=sessions;refreshApproachJumpFreshness();
    document.getElementById('login-overlay').style.display='none';
  },{athletes,sessions});

  function snapshot(id,newApp){
    const root=newApp?document.querySelector('[data-feature-root]')?.shadowRoot:document;
    const element=root.querySelector('#page-'+id);
    const registry=newApp?window.volleyballTest.context.api.CH:CH;
    const charts=Object.entries(registry).filter(([,chart])=>chart.canvas?.closest('#page-'+id)).map(([key,chart])=>({
      key,type:chart.config.type,labels:chart.data.labels,
      datasets:chart.data.datasets.map(({label,data,borderColor,backgroundColor})=>({label,data,borderColor,backgroundColor})),
    }));
    return {text:element.innerText.replace(/\s+/g,' ').trim(),charts};
  }
  const result=[];
  const selectedIds=process.env.VOLLEYBALL_FEATURE?ids.filter(id=>id===process.env.VOLLEYBALL_FEATURE):ids;
  assert.ok(selectedIds.length,'VOLLEYBALL_FEATURE must name a registered feature');
  for(const id of selectedIds){
    const success=await page.evaluate(id=>window.volleyballTest.layout.navigate(id),id);
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
    assert.equal(await page.evaluate(()=>Object.values(window.volleyballTest.context.api.CH).every(chart=>chart.canvas?.isConnected)),true,`${id}: no detached chart instances survive navigation`);
    result.push({id,charts:actual.charts.length});
    console.log(`PASS ${id}: rendered text and ${actual.charts.length} charts match`);
  }
  assert.deepEqual(pageErrors,[],'no application page errors');
  assert.deepEqual(originalErrors,[],'no reference page errors');

  // Real delegated interactions and modal behavior, including dynamic row events.
  await page.locator('[data-feature="dashboard"]').first().click();
  await page.waitForFunction(()=>window.volleyballTest.layout.activeId==='dashboard'&&window.volleyballTest.context.api.sortKpi);
  await page.locator('#kpi-sort').selectOption('cmjHeight');
  await page.locator('#kpi-tbody tr').first().click();
  await page.waitForFunction(()=>window.volleyballTest.layout.activeId==='profile'&&window.volleyballTest.context.api.renderProfile);
  assert.ok(await page.locator('#profile-sel').inputValue());
  await page.locator('[data-feature="leaderboard"]').first().click();
  await page.waitForFunction(()=>window.volleyballTest.context.api.setM);
  await page.locator('#feature-content').getByText('Approach Touch',{exact:true}).first().click();
  assert.equal(await page.evaluate(()=>window.volleyballTest.context.api.activeM),'approachJump');
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
  await page.evaluate(()=>window.volleyballTest.layout.navigate('readiness'));
  await original.evaluate(()=>nav('readiness'));
  await page.waitForTimeout(100);await original.waitForTimeout(100);
  await page.locator('#page-readiness').getByText('⇩ EXPORT PDF',{exact:true}).click();
  await original.locator('#page-readiness').getByText('⇩ EXPORT PDF',{exact:true}).click();
  const actualReport=await page.locator('#readiness-print').innerHTML();
  const referenceReport=await original.locator('#readiness-print').innerHTML();
  assert.equal(actualReport,referenceReport,'Readiness PDF report markup matches');
  await page.waitForTimeout(100);
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('printing-readiness')),false);

  // Actual browser FileReader flows, with the same clock/randomness.
  const uploadRows=[['name','position','cmj height','peak power','10yd sprint'],['Synthetic UploadA','OH',22.5,3200,1.72]];
  for(const file of [
    {name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from(uploadRows.map(row=>row.join(',')).join(String.fromCharCode(10)))},
  ]){
    for(const target of [page,original]){
      await target.evaluate(()=>{Date.now=()=>1793738400000;Math.random=()=>0.5;});
      await target.getByText('↑ IMPORT DATA',{exact:true}).click();
      await target.locator('#itab-csv').click();
      await target.locator('#csv-input').setInputFiles(file);
      await target.waitForFunction(()=>document.getElementById('dz-athlete-count').textContent.includes('1 athlete'));
    }
    const parsed=await page.evaluate(()=>JSON.parse(JSON.stringify(window.volleyballTest.context.api.parsedData)));
    const expectedParsed=await original.evaluate(()=>JSON.parse(JSON.stringify(parsedData)));
    assert.deepEqual(parsed,expectedParsed,`${file.name} preview matches`);
    for(const target of [page,original])await target.locator('#imp-overlay .modal-close').click();
  }

  // A slow feature import can be abandoned without stalling unrelated navigation.
  await page.evaluate(()=>{
    const registration=window.volleyballTest.features.find(f=>f.id==='compare');
    window.volleyballTest.originalCompareLoader=registration.load;
    registration.load=()=>new Promise(resolve=>{window.volleyballTest.finishSlowImport=resolve;});
    window.volleyballTest.slowNavigation=window.volleyballTest.layout.navigate('compare');
  });
  await page.waitForTimeout(20);
  assert.equal(await page.evaluate(()=>window.volleyballTest.layout.navigate('dashboard')),true);
  assert.equal(await page.evaluate(()=>window.volleyballTest.slowNavigation),false);
  await page.evaluate(async()=>{
    window.volleyballTest.finishSlowImport({id:'compare',mount(){throw new Error('Cancelled feature must not mount');}});
    window.volleyballTest.features.find(f=>f.id==='compare').load=window.volleyballTest.originalCompareLoader;
  });

  // Recoverable load / mount / cleanup failures must leave sidebar usable.
  await page.evaluate(()=>{
    const broken=window.volleyballTest.features.find(f=>f.id==='compare');
    broken.load=async()=>{throw new Error('synthetic import failure');};
  });
  assert.equal(await page.evaluate(()=>window.volleyballTest.layout.navigate('compare')),false);
  assert.match(await page.locator('#feature-errors').innerText(),/synthetic import failure/);
  assert.equal(await page.evaluate(()=>window.volleyballTest.layout.navigate('dashboard')),true);
  await page.evaluate(()=>{
    window.volleyballTest.features.find(f=>f.id==='compare').load=async()=>({id:'compare',mount(){throw new Error('synthetic mount failure');},unmount(){throw new Error('synthetic cleanup failure');}});
  });
  assert.equal(await page.evaluate(()=>window.volleyballTest.layout.navigate('compare')),false);
  assert.equal(await page.evaluate(()=>window.volleyballTest.layout.navigate('roster')),true);
  assert.equal(await page.evaluate(()=>Object.keys(window.volleyballTest.context.api.CH).length),0,'charts cleaned up when leaving a chart feature');
  await page.evaluate(()=>{window.volleyballTest.features.find(f=>f.id==='compare').load=window.volleyballTest.originalCompareLoader;});
  for(let index=0;index<ids.length;index++){
    const id=ids[index],recovery=ids[(index+1)%ids.length];
    await page.evaluate(id=>{
      const registration=window.volleyballTest.features.find(f=>f.id===id);
      window.volleyballTest.savedLoader=registration.load;
      registration.load=async()=>{throw new Error('synthetic per-feature import failure');};
    },id);
    assert.equal(await page.evaluate(id=>window.volleyballTest.layout.navigate(id),id),false,`${id}: failure is contained`);
    await page.evaluate(id=>{window.volleyballTest.features.find(f=>f.id===id).load=window.volleyballTest.savedLoader;},id);
    assert.equal(await page.evaluate(id=>window.volleyballTest.layout.navigate(id),recovery),true,`${id}: unrelated navigation recovers`);
  }
  assert.deepEqual(pageErrors,[],'no unexpected page errors after interactions and failures');
  assert.deepEqual(originalErrors,[],'no reference errors after interactions');

  if(fs.existsSync('dist/index.html')){
    production=await preview({preview:{host:'127.0.0.1',port:5179,strictPort:true}});
    const built=await context.newPage();const builtErrors=[];built.on('pageerror',error=>builtErrors.push(error.message));
    await built.goto('http://127.0.0.1:5179/');
    await built.waitForFunction(()=>document.querySelectorAll('#feature-nav [data-feature]').length===11);
    assert.equal(await built.locator('#login-overlay').isVisible(),true);
    assert.equal(await built.evaluate(()=>Object.hasOwn(window,'volleyballTest')),false,'production excludes test hooks');
    assert.deepEqual(builtErrors,[],'built application starts without page errors');
    await built.close();
  }
  assert.equal(backendAttempts,0,'tests never contact Supabase');
  fs.mkdirSync('test-results',{recursive:true});
  await page.evaluate(()=>window.volleyballTest.layout.navigate('dashboard'));
  await page.screenshot({path:'test-results/dashboard.png',fullPage:true});
  fs.writeFileSync('test-results/browser.json',JSON.stringify({features:result,pageErrors,backendAttempts},null,2));
  console.log(JSON.stringify({passed:result.length,features:result,backendAttempts}));
}finally{
  await browser?.close();await server.close();
  if(production)await new Promise(resolve=>production.httpServer.close(resolve));
}
