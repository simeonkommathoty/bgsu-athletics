// Runs against the unified production build in dist/ (run `npm run build` first).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {preview} from 'vite';
import {chromium} from 'playwright-core';

assert.ok(fs.existsSync('dist/index.html'),'run npm run build first');
const server=await preview({root:process.cwd(),appType:'mpa',preview:{host:'127.0.0.1',port:5172,strictPort:true}});
const origin='http://127.0.0.1:5172';
let browser;
try{
  browser=await chromium.launch({executablePath:process.env.BGSU_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const external=[];
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1')return route.continue();if(u.hostname.endsWith('supabase.co'))external.push(u.href);return route.abort();});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/');
  await page.waitForSelector('.sport-card');
  assert.deepEqual(await page.locator('.sport-card').evaluateAll(n=>n.map(x=>x.dataset.sport)),['hockey','volleyball']);
  assert.ok(await page.locator('.sport-card svg').count()===2,'icons render');

  // Each card reaches its independently built application (sign-in screen, no data).
  for(const [id,appRoot] of [['hockey','#hockey-app'],['volleyball','#volleyball-app']]){
    await page.goto(origin+'/');await page.waitForSelector('.sport-card');
    await page.locator(`[data-sport="${id}"]`).click();
    await page.waitForURL(`**/${id}/`);
    await page.waitForSelector(appRoot);
    await page.waitForSelector('#login-overlay',{state:'visible'});
    assert.equal(await page.locator('#feature-nav [data-feature]').count()>0,true,`${id} sidebar registered`);
    // Refresh and direct URL keep working.
    await page.reload();await page.waitForSelector('#login-overlay',{state:'visible'});
    await page.goto(`${origin}/${id}/`);await page.waitForSelector(appRoot);
    // Back navigation returns to the portal.
    await page.goBack();
    await page.goForward();
    await page.goBack();
    await page.goto(origin+'/');
    await page.goto(`${origin}/${id}/`);
    await page.goBack();
    assert.equal(new URL(page.url()).pathname,'/');
    await page.waitForSelector('.sport-card');
  }
  // Sports Home button: login screen, demo dashboard, browser back, and sub-path hosting.
  for(const [id,appRoot] of [['hockey','#hockey-app'],['volleyball','#volleyball-app']]){
    await page.goto(`${origin}/${id}/`);await page.waitForSelector('#login-overlay',{state:'visible'});
    await page.locator('#login-sports-home').click();
    await page.waitForSelector('.sport-card');
    assert.equal(new URL(page.url()).pathname,'/',`${id} login Sports Home reaches the portal`);
    await page.goBack();await page.waitForSelector('#login-overlay',{state:'visible'});
    await page.locator('#demo-btn').click();
    await page.waitForSelector('#demo-banner');
    assert.equal(new URL(page.url()).pathname,`/${id}/`);
    await page.locator('#shell-sports-home').click();
    await page.waitForSelector('.sport-card');
    assert.equal(new URL(page.url()).pathname,'/',`${id} dashboard Sports Home reaches the portal`);
    await page.goBack();await page.waitForSelector('#demo-banner',{timeout:20000});
    assert.equal(new URL(page.url()).hash,'#demo','back from portal returns to the demo dashboard');
    assert.equal(await page.locator(`${appRoot} #feature-nav [data-feature]`).count()>0,true);
    // Deployed under a sub-directory the same relative link resolves to that directory's portal.
    assert.equal(await page.locator('#shell-sports-home').evaluate(a=>new URL(a.getAttribute('href'),'https://host.example/athletics/'+location.pathname.slice(1)).pathname),'/athletics/');
  }
  // Refresh on the portal.
  await page.goto(origin+'/');await page.reload();await page.waitForSelector('.sport-card');

  // Disabled / missing sports are hidden: stub the registry-visible fetches.
  await page.route('**/volleyball/',route=>route.fulfill({status:404,body:'missing'}));
  await page.goto(origin+'/');await page.reload();await page.waitForSelector('.sport-card');
  assert.deepEqual(await page.locator('.sport-card').evaluateAll(n=>n.map(x=>x.dataset.sport)),['hockey'],'unavailable application is hidden');
  await page.unroute('**/volleyball/');

  // Responsive: no horizontal overflow on mobile; cards stack.
  await page.setViewportSize({width:390,height:800});await page.reload();await page.waitForSelector('.sport-card');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'no horizontal scroll on mobile');
  const boxes=await page.locator('.sport-card').evaluateAll(n=>n.map(x=>x.getBoundingClientRect().top));
  assert.ok(boxes[1]>boxes[0],'cards stack on mobile');
  fs.mkdirSync('test-results',{recursive:true});
  await page.screenshot({path:'test-results/portal-mobile.png',fullPage:true});
  await page.setViewportSize({width:1280,height:900});await page.reload();await page.waitForSelector('.sport-card');
  await page.screenshot({path:'test-results/portal-desktop.png',fullPage:true});
  assert.deepEqual(errors,[],'no page errors');
  assert.deepEqual(external,[],'no Supabase requests');
  console.log('PASS portal browser checks');
}finally{await browser?.close();await new Promise(r=>server.httpServer.close(r));}
